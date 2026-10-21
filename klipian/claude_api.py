"""Find clips with Claude through the API (P24).

The brief that is otherwise copied into Claude by hand (roundtrip.build_api_brief: the rubric, the answer
format and the profile's hashtag rule first, then the episode's transcript and cues) is sent with the official
`anthropic` SDK, and the reply is imported exactly like a pasted one (roundtrip.parse_reply_notes, with its
repairs). Everything that touches the SDK goes through `_sdk` and the client it makes, so the selftest swaps
them for fakes and nothing here reaches the network in tests.

How a request is made (the claude-api skill is the reference for this):
  * streaming (`client.messages.stream` + `get_final_message`): a long transcript and a long reply;
  * `thinking: {"type": "adaptive"}`, `output_config: {"effort": ...}`; no temperature, top_p, budget_tokens
    or prefill (current models reject them);
  * the static part (the system block) carries `cache_control: ephemeral`, the episode comes after it;
  * `output_config.format` (a JSON schema) when the model takes it; otherwise, or when the API refuses it,
    plain text and the existing parser. The note says which was used;
  * `messages.count_tokens` for the exact request before anything is sent;
  * `stop_reason` is checked before the content is read: a refusal or a reply cut at max_tokens imports nothing.

The API key is typed by the person in the settings and kept in workspace/secrets/anthropic.json. It is never
returned by any endpoint, never written to a log and never put in an error message. Without a saved key the
SDK's own resolution (ANTHROPIC_API_KEY, an `ant auth login` profile) still applies.
"""

from __future__ import annotations

import contextvars
import json
import os
import sys
import threading
import time
import uuid
from pathlib import Path

from . import paths

MAX_TOKENS = 32000                 # room for 10-20 clips with post text and angle
MAX_RETRIES = 3                    # the SDK retries 429 / 5xx / connection errors itself
FALLBACK_MODEL = "claude-opus-4-8" # only when the account's model list cannot be read; never a cheaper one
DEFAULT_EFFORT = "high"
EFFORTS = ("low", "medium", "high", "xhigh", "max")
EXPECTED_OUTPUT_TOKENS = 12000     # for the cost estimate only

# ESTIMATE ONLY: US dollars per million tokens (input, output), from the published price list when this was
# written. Edit here when prices change. Cache reads cost 0.1x the input price, cache writes 1.25x.
PRICES = {
    "claude-fable-5": (10.0, 50.0), "claude-opus-4-8": (5.0, 25.0), "claude-opus-4-7": (5.0, 25.0),
    "claude-opus-4-6": (5.0, 25.0), "claude-sonnet-5": (3.0, 15.0), "claude-sonnet-4-6": (3.0, 15.0),
    "claude-haiku-4-5": (1.0, 5.0),
}
_FAMILY_PRICES = {"claude-opus-": (5.0, 25.0), "claude-sonnet-": (3.0, 15.0), "claude-haiku-": (1.0, 5.0),
                  "claude-fable-": (10.0, 50.0)}

# The reply's shape (the same as the pasted brief asks for): what roundtrip.parse_reply reads.
_SCORES = {"type": "object", "additionalProperties": False,
           "properties": {k: {"type": "integer"} for k in ("hook", "complete", "payoff", "emotion", "duration")},
           "required": ["hook", "complete", "payoff"]}
REPLY_SCHEMA = {
    "type": "object", "additionalProperties": False,
    "properties": {
        "source": {"type": "string"},
        "clips": {"type": "array", "items": {
            "type": "object", "additionalProperties": False,
            "properties": {
                "start": {"type": "string"}, "end": {"type": "string"}, "title": {"type": "string"},
                "hook": {"type": "string"}, "scores": _SCORES, "reason": {"type": "string"},
                "post": {"type": "object", "additionalProperties": False, "properties": {
                    "title": {"type": "string"}, "caption": {"type": "string"},
                    "hashtags": {"type": "array", "items": {"type": "string"}},
                    "youtubeTitle": {"type": "string"}}, "required": ["title", "caption", "hashtags"]},
                "angle": {"type": "object", "additionalProperties": False, "properties": {
                    "take": {"type": "string"}, "intro": {"type": "string"},
                    "notes": {"type": "array", "items": {"type": "object", "additionalProperties": False,
                                                         "properties": {"at": {"type": "string"}, "text": {"type": "string"}},
                                                         "required": ["at", "text"]}}},
                          "required": ["take", "intro"]},
            },
            "required": ["start", "end", "title", "hook", "scores", "reason"]}},
    },
    "required": ["clips"],
}


class ClaudeError(Exception):
    """A failure with a code the page can switch on and a sentence for the person."""

    def __init__(self, code: str, message: str, **extra):
        super().__init__(message)
        self.code, self.message, self.extra = code, message, extra


class Cancelled(Exception):
    pass


def install_command() -> str:
    return f'"{sys.executable}" -m pip install -r "{Path(paths.ROOT) / "requirements-claude.txt"}"'


# --------------------------------------------------------------------------
# the one place that imports the SDK (replaced by a fake in the selftest)
# --------------------------------------------------------------------------

class _Sdk:
    @staticmethod
    def available() -> bool:
        import importlib.util
        return importlib.util.find_spec("anthropic") is not None

    @classmethod
    def client(cls, api_key: str | None):
        try:
            import anthropic
        except ImportError:
            raise ClaudeError("no_sdk", "The Anthropic package is not installed.", command=install_command()) from None
        kwargs = {"max_retries": MAX_RETRIES}
        if api_key:
            kwargs["api_key"] = api_key
        return anthropic.Anthropic(**kwargs)


_sdk = _Sdk


# --------------------------------------------------------------------------
# settings (the key stays on the server)
# --------------------------------------------------------------------------

def _file() -> Path:
    return Path(paths.WORKSPACE) / "secrets" / "anthropic.json"


def load_settings() -> dict:
    try:
        data = json.loads(_file().read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}
    return data if isinstance(data, dict) else {}


def save_settings(*, api_key: str | None = None, remove_key: bool = False, model: str | None = None,
                  effort: str | None = None) -> None:
    data = load_settings()
    if remove_key:
        data.pop("apiKey", None)
    if api_key is not None and api_key.strip():
        data["apiKey"] = api_key.strip()
    if model is not None:
        if model.strip():
            data["model"] = model.strip()
        else:
            data.pop("model", None)
    if effort is not None:
        if effort not in EFFORTS:
            raise ClaudeError("bad_setting", f"Effort must be one of {', '.join(EFFORTS)}.")
        data["effort"] = effort
    f = _file()
    f.parent.mkdir(parents=True, exist_ok=True)
    tmp = f.with_suffix(".tmp")
    tmp.write_text(json.dumps(data, indent=1), encoding="utf-8")
    os.replace(tmp, f)


def key_source() -> str:
    """Where the key comes from: "saved" (the settings), "env" (ANTHROPIC_API_KEY / ANTHROPIC_AUTH_TOKEN) or
    "none" (the SDK may still find an `ant auth login` profile)."""
    if load_settings().get("apiKey"):
        return "saved"
    if os.environ.get("ANTHROPIC_API_KEY") or os.environ.get("ANTHROPIC_AUTH_TOKEN"):
        return "env"
    return "none"


def status() -> dict:
    """What the page may know: never the key itself."""
    s = load_settings()
    return {"sdk": _sdk.available(), "keySource": key_source(), "hasKey": key_source() != "none",
            "model": s.get("model") or "", "effort": s.get("effort") or DEFAULT_EFFORT,
            "efforts": list(EFFORTS), "command": install_command(), "maxTokens": MAX_TOKENS}


def _client():
    return _sdk.client(load_settings().get("apiKey"))


# --------------------------------------------------------------------------
# models and cost
# --------------------------------------------------------------------------

def list_models(client=None) -> list[dict]:
    """The account's Claude models, newest first: [{id, name, created}]."""
    client = client or _client()
    try:
        raw = list(client.models.list())
    except Exception as exc:                                  # noqa: BLE001
        raise map_error(exc) from None
    out = []
    for m in raw:
        mid = getattr(m, "id", "")
        if mid.startswith("claude-"):
            created = getattr(m, "created_at", None)
            out.append({"id": mid, "name": getattr(m, "display_name", "") or mid,
                        "created": created.isoformat() if hasattr(created, "isoformat") else str(created or "")})
    out.sort(key=lambda m: m["created"], reverse=True)
    return out


def newest_opus(models: list[dict]) -> str | None:
    opus = [m for m in models if m["id"].startswith("claude-opus-")]
    return opus[0]["id"] if opus else None


def resolve_model(client) -> tuple[str, str]:
    """(the model to use, how it was chosen): the one in the settings, else the newest Opus of the account.
    Never a cheaper one by itself."""
    chosen = load_settings().get("model")
    if chosen:
        return chosen, "chosen in the settings"
    try:
        newest = newest_opus(list_models(client))
    except ClaudeError:
        newest = None
    if newest:
        return newest, "the newest Opus of this account"
    return FALLBACK_MODEL, "the default (the account's model list could not be read)"


def price_of(model: str) -> tuple[float, float, bool] | None:
    """(input $/MTok, output $/MTok, assumed): exact if the table has the model, the family's if only the
    family is known (assumed=True), None when nothing is known."""
    if model in PRICES:
        return (*PRICES[model], False)
    for prefix, p in _FAMILY_PRICES.items():
        if model.startswith(prefix):
            return (*p, True)
    return None


def cost_of(model: str, usage: dict) -> float | None:
    p = price_of(model)
    if not p:
        return None
    pin, pout, _ = p
    return round((usage.get("input", 0) * pin + usage.get("cacheRead", 0) * pin * 0.1
                  + usage.get("cacheWrite", 0) * pin * 1.25 + usage.get("output", 0) * pout) / 1e6, 4)


def _usage_of(msg) -> dict:
    u = getattr(msg, "usage", None)
    g = lambda name: int(getattr(u, name, 0) or 0) if u is not None else 0      # noqa: E731
    return {"input": g("input_tokens"), "output": g("output_tokens"),
            "cacheRead": g("cache_read_input_tokens"), "cacheWrite": g("cache_creation_input_tokens")}


# --------------------------------------------------------------------------
# errors
# --------------------------------------------------------------------------

def _text_of(exc: BaseException) -> str:
    return str(getattr(exc, "message", None) or exc)


def map_error(exc: BaseException) -> ClaudeError:
    """An SDK or network failure as a ClaudeError. Looked up by the class names in the exception's MRO,
    most specific first (APITimeoutError before APIConnectionError, RateLimitError before APIStatusError)."""
    if isinstance(exc, ClaudeError):
        return exc
    text = _text_of(exc)
    low = text.lower()
    status = getattr(exc, "status_code", None)
    for cls in type(exc).__mro__:
        name = cls.__name__
        if name == "AuthenticationError":
            return ClaudeError("auth", "Anthropic refused the API key (401). Check it in Profile settings → Anthropic API, "
                                       "or remove it to use ANTHROPIC_API_KEY.")
        if name == "PermissionDeniedError":
            return ClaudeError("permission", "This API key is not allowed to do that (403): the model or the feature "
                                             "is not available to this account or workspace.")
        if name == "NotFoundError":
            return ClaudeError("model", "Anthropic does not know that model (404). Choose another one in Profile "
                                        "settings → Anthropic API.")
        if name == "RequestTooLargeError":
            return ClaudeError("too_large", "The request is too large for the API (413): the transcript is longer "
                                            "than the model accepts.")
        if name == "RateLimitError":
            return ClaudeError("rate_limit", "Anthropic is rate limiting this key (429), even after retrying. Wait a "
                                             "minute and try again.")
        if name in ("OverloadedError", "InternalServerError", "ServiceUnavailableError"):
            return ClaudeError("overloaded", "Anthropic's API is overloaded or having trouble (5xx), even after retrying. "
                                             "Try again in a few minutes.")
        if name == "BadRequestError":
            if "credit balance" in low:
                return ClaudeError("no_credit", "The Anthropic account has no credit left. Add credit in the Console, "
                                                "then try again.")
            return ClaudeError("bad_request", f"Anthropic refused the request (400): {text[:300]}")
        if name == "APITimeoutError":
            return ClaudeError("timeout", "Anthropic did not answer in time. Try again.")
        if name == "APIConnectionError":
            return ClaudeError("offline", "Could not reach Anthropic. Check the internet connection and try again.")
        if name == "APIStatusError":
            if status is not None and (status >= 500 or status == 529):
                return ClaudeError("overloaded", f"Anthropic's API had a problem ({status}). Try again in a few minutes.")
            if status == 429:
                return ClaudeError("rate_limit", "Anthropic is rate limiting this key (429). Wait a minute and try again.")
            return ClaudeError("api", f"Anthropic answered {status}: {text[:300]}")
    if "authentication method" in low or "api_key" in low or "auth_token" in low:
        return ClaudeError("no_key", "There is no API key. Add one in Profile settings → Anthropic API (or set "
                                     "ANTHROPIC_API_KEY, or sign in with `ant auth login`).")
    return ClaudeError("other", f"Claude could not be asked ({type(exc).__name__}): {text[:200]}")


def _is_format_problem(exc: BaseException) -> bool:
    """A 400 about the structured-output format: the request is sent again as plain text."""
    if not any(c.__name__ == "BadRequestError" for c in type(exc).__mro__):
        return False
    low = _text_of(exc).lower()
    return any(k in low for k in ("output_config", "json_schema", "structured", "schema", "format"))


# --------------------------------------------------------------------------
# the request
# --------------------------------------------------------------------------

def request_kwargs(model: str, system: str, user: str, effort: str, structured: bool, *, count: bool = False) -> dict:
    """The arguments of messages.stream (or, with count=True, of messages.count_tokens)."""
    output = {"effort": effort}
    if structured:
        output["format"] = {"type": "json_schema", "schema": REPLY_SCHEMA}
    kw = {"model": model,
          "system": [{"type": "text", "text": system, "cache_control": {"type": "ephemeral"}}],
          "messages": [{"role": "user", "content": user}],
          "thinking": {"type": "adaptive"},
          "output_config": output}
    if not count:
        kw["max_tokens"] = MAX_TOKENS
    return kw


def plan_find(build_parts, count: int) -> dict:
    """What a call would be, before it is made: the model, the exact input tokens (messages.count_tokens),
    and an estimated cost. Nothing is generated."""
    client = _client()
    s = load_settings()
    model, how = resolve_model(client)
    effort = s.get("effort") or DEFAULT_EFFORT
    system, user = build_parts(count)
    structured = True
    try:
        try:
            tokens = client.messages.count_tokens(**request_kwargs(model, system, user, effort, True, count=True)).input_tokens
        except Exception as exc:                              # noqa: BLE001
            if not _is_format_problem(exc):
                raise
            structured = False
            tokens = client.messages.count_tokens(**request_kwargs(model, system, user, effort, False, count=True)).input_tokens
    except ClaudeError:
        raise
    except Exception as exc:                                  # noqa: BLE001
        raise map_error(exc) from None
    p = price_of(model)
    cost = None
    if p:
        base = tokens * p[0] / 1e6
        cost = {"low": round(base + EXPECTED_OUTPUT_TOKENS * p[1] / 1e6, 2),
                "high": round(base + MAX_TOKENS * p[1] / 1e6, 2), "assumed": p[2]}
    return {"model": model, "modelHow": how, "effort": effort, "inputTokens": int(tokens), "count": int(count),
            "cost": cost, "structured": structured, "maxTokens": MAX_TOKENS}


# --------------------------------------------------------------------------
# usage log (per profile)
# --------------------------------------------------------------------------

def _usage_file() -> Path:
    return paths.profile_dir() / "claude-usage.json"


def _read_usage() -> list[dict]:
    try:
        data = json.loads(_usage_file().read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return []
    return data if isinstance(data, list) else []


def record_usage(entry: dict) -> None:
    try:
        rows = (_read_usage() + [entry])[-500:]
        f = _usage_file()
        f.parent.mkdir(parents=True, exist_ok=True)
        f.write_text(json.dumps(rows), encoding="utf-8")
    except OSError:
        pass


def usage_summary() -> dict:
    """This profile's calls, summed per month (newest first)."""
    months: dict[str, dict] = {}
    for r in _read_usage():
        key = time.strftime("%Y-%m", time.localtime(r.get("at", 0)))
        m = months.setdefault(key, {"month": key, "calls": 0, "input": 0, "output": 0, "cacheRead": 0, "cacheWrite": 0,
                                    "cost": 0.0, "unpriced": 0})
        m["calls"] += 1
        for k in ("input", "output", "cacheRead", "cacheWrite"):
            m[k] += int(r.get(k, 0) or 0)
        if r.get("cost") is None:
            m["unpriced"] += 1
        else:
            m["cost"] = round(m["cost"] + float(r["cost"]), 4)
    return {"months": sorted(months.values(), key=lambda m: m["month"], reverse=True), "estimate": True}


# --------------------------------------------------------------------------
# the job
# --------------------------------------------------------------------------

_JOBS: dict[str, dict] = {}
_LOCK = threading.Lock()
_CANCEL: set[str] = set()


def _set(jid: str, **fields) -> None:
    with _LOCK:
        if jid in _JOBS:
            _JOBS[jid].update(fields)


def job_state(jid: str) -> dict:
    with _LOCK:
        job = _JOBS.get(jid)
        if not job or job.get("profile") != paths.current_profile():
            return {"state": "missing"}
        return dict(job)


def cancel(jid: str) -> dict:
    with _LOCK:
        job = _JOBS.get(jid)
        if not job or job.get("profile") != paths.current_profile():
            return {"state": "missing"}
        if job["state"] == "running":
            _CANCEL.add(jid)
            job["message"] = "Cancelling…"
    return job_state(jid)


def start_find(build_parts, parse, *, video: str, count: int = 12, project: str | None = None) -> str:
    """Ask Claude for clips in the background. `build_parts(count)` -> (system, user); `parse(text)` ->
    (candidates, notes) or raises ValueError. Returns the job id; job_state(id) tells how it goes."""
    jid = uuid.uuid4().hex[:10]
    with _LOCK:
        _JOBS[jid] = {"state": "running", "step": "preparing", "message": "Getting ready…", "profile": paths.current_profile(),
                      "video": video, "startedAt": int(time.time())}
        if len(_JOBS) > 50:
            for old in [k for k, v in _JOBS.items() if v["state"] != "running"][:25]:
                _JOBS.pop(old, None)
    threading.Thread(target=contextvars.copy_context().run, args=(_run, jid, build_parts, parse, video, count, project),
                     daemon=True).start()
    return jid


def _stream_once(client, kw: dict, jid: str):
    """One streamed call; the step shown follows the stream (thinking, then writing). Cancel closes the stream."""
    _set(jid, step="sending", message="Sending the episode to Claude…")
    with client.messages.stream(**kw) as stream:
        for event in stream:
            if jid in _CANCEL:
                stream.close()
                raise Cancelled()
            if getattr(event, "type", "") == "content_block_start":
                kind = getattr(getattr(event, "content_block", None), "type", "")
                if kind == "thinking":
                    _set(jid, step="thinking", message="Claude is thinking…")
                elif kind == "text":
                    _set(jid, step="writing", message="Claude is writing the clips…")
        if jid in _CANCEL:
            raise Cancelled()
        return stream.get_final_message()


def _run(jid, build_parts, parse, video, count, project) -> None:
    started = time.time()
    msg = None
    model = how = ""
    structured = True
    try:
        client = _client()
        s = load_settings()
        model, how = resolve_model(client)
        effort = s.get("effort") or DEFAULT_EFFORT
        _set(jid, model=model)
        system, user = build_parts(count)
        while True:
            try:
                msg = _stream_once(client, request_kwargs(model, system, user, effort, structured), jid)
                break
            except Cancelled:
                raise
            except ClaudeError:
                raise
            except Exception as exc:                          # noqa: BLE001
                if structured and _is_format_problem(exc):
                    structured = False                        # the model or the API does not take the schema: plain text
                    continue
                raise
        usage = _usage_of(msg)
        cost = cost_of(model, usage)
        entry = {"at": int(time.time()), "video": video, "project": project, "model": model, **usage, "cost": cost,
                 "seconds": round(time.time() - started, 1), "stopReason": getattr(msg, "stop_reason", None)}
        record_usage(entry)                                    # a call that failed after generating still cost something
        _set(jid, usage={**usage, "cost": cost, "seconds": entry["seconds"]}, model=model)
        stop = getattr(msg, "stop_reason", None)
        if stop == "refusal":
            detail = getattr(msg, "stop_details", None)
            why = getattr(detail, "explanation", None) if detail is not None else None
            raise ClaudeError("refusal", "Claude declined to answer this request" + (f" ({why})" if why else "")
                              + ". Nothing was imported.")
        if stop == "max_tokens":
            raise ClaudeError("max_tokens", f"Claude's reply was cut off at {MAX_TOKENS:,} tokens, so nothing was imported "
                              "(an incomplete list would drop clips without saying so). Ask for fewer clips and try again.")
        text = "".join(getattr(b, "text", "") for b in (getattr(msg, "content", None) or [])
                       if getattr(b, "type", "") == "text").strip()
        if not text:
            raise ClaudeError("empty", "Claude's reply had no text. Nothing was imported.")
        _set(jid, step="importing", message="Importing the clips…")
        try:
            candidates, notes = parse(text)
        except ValueError as exc:
            raise ClaudeError("bad_reply", str(exc), reply=text) from None
        how_used = "structured output" if structured else "plain text and the import repairs"
        _set(jid, state="done", step="done", candidates=candidates, notes=notes, how=how_used, modelHow=how,
             message=f"{len(candidates)} suggestion{'' if len(candidates) == 1 else 's'} imported")
    except Cancelled:
        _set(jid, state="cancelled", step="cancelled", message="Cancelled. Nothing was imported.")
    except Exception as exc:                                   # noqa: BLE001
        err = map_error(exc)
        _set(jid, state="failed", step="failed", code=err.code, message=err.message,
             **({"reply": err.extra["reply"]} if "reply" in err.extra else {}),
             **({"command": err.extra["command"]} if "command" in err.extra else {}))
    finally:
        _CANCEL.discard(jid)


# --------------------------------------------------------------------------
# the settings page: test a key
# --------------------------------------------------------------------------

def test_key() -> dict:
    """A tiny models.retrieve with the saved (or environment) credentials: does Anthropic accept them?"""
    client = _client()
    s = load_settings()
    try:
        m = client.models.retrieve(s.get("model") or FALLBACK_MODEL)
    except Exception as exc:                                   # noqa: BLE001
        err = map_error(exc)
        if err.code == "model":                                # the key works; that model is just not there
            return {"ok": True, "note": "The key is accepted, but the chosen model is not available to this account."}
        raise err from None
    return {"ok": True, "note": f"The key works ({getattr(m, 'display_name', '') or getattr(m, 'id', '')} is available)."}
