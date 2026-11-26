"""Selftest checks: the Claude API, rubrics, the guide, results and scheduling, progress, the face lock and the scratch folders."""

from __future__ import annotations


import json
import shutil
import tempfile
import time
from pathlib import Path

from .selftest_render import _pid_alive, sweep_stale_scratch
from .selftest_base import ROOT, FIXTURES, PASS, FAIL, _load


def check_claude() -> tuple[str, str]:
    """Find clips with Claude through the API (claude_api.py) with a FAKE client: nothing here reaches the
    network, and no real key is used. The request (streamed, adaptive thinking, the static part cached, no
    sampling parameters, no prefill), the model chosen, structured output and the plain-text fallback, usage
    and cost recorded, every error class mapped, a refusal and a cut-off reply imported as nothing, cancel,
    the key never in a response or a log, the SDK missing."""
    import contextlib
    import http.client
    import io
    import os
    import threading
    from datetime import datetime, timezone
    from http.server import ThreadingHTTPServer
    from types import SimpleNamespace as NS
    from . import claude_api as ca, paths, profiles
    from .cache import Cache
    from .models import Transcript
    from .server import Handler

    problems = []
    SECRET = "sk-ant-TESTSECRET-0123456789"

    # ---- a fake SDK: the classes carry the real SDK's names (the mapping reads the names)
    class AnthropicError(Exception):
        pass

    class APIError(AnthropicError):
        def __init__(self, message="x", status_code=None):
            super().__init__(message)
            self.message, self.status_code = message, status_code

    class APIConnectionError(APIError):
        pass

    class APITimeoutError(APIConnectionError):
        pass

    class APIStatusError(APIError):
        pass

    def status_class(name, code, base=APIStatusError):
        return type(name, (base,), {"code": code})

    AuthenticationError = status_class("AuthenticationError", 401)
    PermissionDeniedError = status_class("PermissionDeniedError", 403)
    NotFoundError = status_class("NotFoundError", 404)
    BadRequestError = status_class("BadRequestError", 400)
    RequestTooLargeError = status_class("RequestTooLargeError", 413)
    RateLimitError = status_class("RateLimitError", 429)
    InternalServerError = status_class("InternalServerError", 500)
    OverloadedError = status_class("OverloadedError", 529)
    ServiceUnavailableError = status_class("ServiceUnavailableError", 503)

    GOOD = json.dumps({"source": "x", "clips": [
        {"start": "0:10", "end": "0:30", "title": "Satu", "hook": "halo", "scores": {"hook": 8, "complete": 8, "payoff": 8},
         "reason": "bagus", "post": {"title": "Judul", "caption": "Teks.", "hashtags": ["#a", "#b"]}}]})

    class Fake:
        """The client and the SDK module in one."""
        def __init__(self):
            self.keys, self.streams, self.counts, self.closed = [], [], [], False
            self.model_list = [NS(id="claude-opus-4-8", display_name="Claude Opus 4.8", created_at=datetime(2026, 1, 1, tzinfo=timezone.utc)),
                           NS(id="claude-opus-5-5", display_name="Claude Opus 5.5", created_at=datetime(2026, 6, 1, tzinfo=timezone.utc)),
                           NS(id="claude-sonnet-5", display_name="Claude Sonnet 5", created_at=datetime(2026, 7, 1, tzinfo=timezone.utc)),
                           NS(id="other-thing", display_name="x", created_at=datetime(2026, 8, 1, tzinfo=timezone.utc))]
            self.list_error = None
            self.retrieve_error = None
            self.script = []                       # what each stream call does: an Exception to raise, or a dict
            self.slow = 0.0
            self.sdk = True

        # -- the SDK module
        def available(self):
            return self.sdk

        def client(self, api_key):
            if not self.sdk:
                raise ca.ClaudeError("no_sdk", "not installed", command="pip install")
            self.keys.append(api_key)
            return self

        # -- the client
        @property
        def messages(self):
            return self

        def count_tokens(self, **kw):
            self.counts.append(kw)
            if self.count_error and "format" in kw["output_config"]:
                raise self.count_error
            return NS(input_tokens=48000)

        count_error = None

        def stream(self, **kw):
            self.streams.append(kw)
            return Fake.Stream(self, kw, self.script.pop(0) if self.script else {})

        class Stream:
            def __init__(self, fake, kw, plan):
                self.fake, self.kw, self.plan = fake, kw, plan

            def __enter__(self):
                if isinstance(self.plan, BaseException):
                    raise self.plan
                return self

            def __exit__(self, *a):
                return False

            def __iter__(self):
                yield NS(type="content_block_start", content_block=NS(type="thinking"))
                for _ in range(int(self.fake.slow * 20)):
                    time.sleep(0.05)
                    yield NS(type="ping")
                yield NS(type="content_block_start", content_block=NS(type="text"))

            def close(self):
                self.fake.closed = True

            def get_final_message(self):
                p = self.plan
                usage = NS(input_tokens=p.get("in", 1000), output_tokens=p.get("out", 2000),
                           cache_read_input_tokens=p.get("read", 0), cache_creation_input_tokens=p.get("write", 0))
                return NS(stop_reason=p.get("stop", "end_turn"), stop_details=p.get("details"), usage=usage,
                          content=[NS(type="thinking", thinking=""), NS(type="text", text=p.get("text", GOOD))])

    class ModelsApi:
        def __init__(self, fake):
            self.fake = fake

        def list(self):
            if self.fake.list_error:
                raise self.fake.list_error
            return iter(self.fake.model_list)

        def retrieve(self, mid):
            if self.fake.retrieve_error:
                raise self.fake.retrieve_error
            return NS(id=mid, display_name="Fake " + mid)

    Fake.models = property(lambda self: ModelsApi(self))
    fake = Fake()

    def wait(jid, limit=20):
        t0 = time.time()
        while time.time() - t0 < limit:
            s = ca.job_state(jid)
            if s.get("state") != "running":
                return s
            time.sleep(0.03)
        return ca.job_state(jid)

    # a transcript for the brief
    video = "claude-test.mp4"
    (paths.SOURCES / video).write_bytes(b"not a real video")
    cache = Cache(paths.CACHE_DIR)
    from .paths import GLOSSARY
    from .transcribe import DEFAULT_LANGUAGE, DEFAULT_MODEL
    tpath = cache.transcript_path(paths.SOURCES / video, DEFAULT_MODEL, DEFAULT_LANGUAGE, GLOSSARY if GLOSSARY.is_file() else None)
    Transcript.load(FIXTURES / "brief" / "transcript.json").save(tpath)
    other = "claude-other.mp4"
    (paths.SOURCES / other).write_bytes(b"another one")
    Transcript.load(FIXTURES / "brief" / "transcript.json").save(cache.transcript_path(
        paths.SOURCES / other, DEFAULT_MODEL, DEFAULT_LANGUAGE, GLOSSARY if GLOSSARY.is_file() else None))

    from . import server as _server
    real_sdk = ca._sdk
    ca._sdk = fake
    saved_env = {k: os.environ.pop(k, None) for k in ("ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN")}
    srv = None
    err = io.StringIO()
    quiet = contextlib.redirect_stderr(err)
    try:
        ca.save_settings(api_key=SECRET)
        parts = _server._claude_parts(video)

        # --- the model: the newest Opus of the account (not a Sonnet that is newer), else the one chosen
        job = ca.start_find(parts, lambda text: _server._import_reply(video, text), video=video, count=9)
        s = wait(job)
        kw = fake.streams[-1]
        if s["state"] != "done" or s["model"] != "claude-opus-5-5":
            problems.append(f"the default model should be the newest Opus of the account: {s.get('model')} {s.get('message')}")
        if fake.keys[-1] != SECRET:
            problems.append("the saved key was not the one handed to the SDK")
        # --- the request: streamed, adaptive thinking, cached static part, no sampling, no prefill
        if kw["thinking"] != {"type": "adaptive"} or kw["max_tokens"] != ca.MAX_TOKENS or kw["model"] != "claude-opus-5-5":
            problems.append(f"request shape: {kw['thinking']} {kw['max_tokens']} {kw['model']}")
        if any(k in kw for k in ("temperature", "top_p", "top_k", "budget_tokens", "prefill")):
            problems.append("a sampling parameter was sent (current models reject them)")
        if kw["system"][0].get("cache_control") != {"type": "ephemeral"} or "Evaluation rubric" not in kw["system"][0]["text"]:
            problems.append("the static part (rubric, format) must be the system block with cache_control")
        if len(kw["messages"]) != 1 or kw["messages"][0]["role"] != "user" or "## Transcript" not in kw["messages"][0]["content"] \
                or "about 9 moments" not in kw["messages"][0]["content"] or video not in kw["messages"][0]["content"]:
            problems.append("the episode (and how many clips) belongs in the user message, with no assistant prefill")
        if kw["output_config"].get("effort") != "high" or kw["output_config"].get("format", {}).get("type") != "json_schema":
            problems.append(f"effort high and the JSON schema were expected: {kw['output_config']}")
        if video in kw["system"][0]["text"] or "about 9" in kw["system"][0]["text"]:
            problems.append("the system block must not change from one episode to the next (it is the cached part)")
        sysB = _server._claude_parts(other)(5)[0]
        if sysB != kw["system"][0]["text"]:
            problems.append("two episodes of one profile must share a byte-identical system block")
        if s.get("how") != "structured output" or len(s["candidates"]) != 1 or s["candidates"][0]["title"] != "Satu":
            problems.append(f"the structured reply was not imported like a pasted one: {s.get('how')} {s.get('candidates')}")

        # --- usage and cost: recorded per call, summed per month
        ca.save_settings(model="claude-opus-4-8")
        fake.script = [{"in": 2000, "out": 3000, "read": 40000, "write": 7000}]
        s = wait(ca.start_find(parts, lambda text: _server._import_reply(video, text), video=video))
        want = (2000 * 5 + 40000 * 5 * 0.1 + 7000 * 5 * 1.25 + 3000 * 25) / 1e6
        if s["state"] != "done" or s["model"] != "claude-opus-4-8" or abs(s["usage"]["cost"] - round(want, 4)) > 1e-9 \
                or s["usage"]["cacheRead"] != 40000 or s["usage"]["cacheWrite"] != 7000:
            problems.append(f"usage and cost: {s.get('usage')} wanted {want}")
        total = ca.usage_summary()["months"][0]
        if total["calls"] != 2 or total["cacheRead"] != 40000 or abs(total["cost"] - (round(want, 4) + ca.cost_of("claude-opus-5-5", {"input": 1000, "output": 2000}))) > 1e-3:
            problems.append(f"the monthly total: {total}")

        # --- the plan: the exact request is counted, nothing is generated
        n = len(fake.streams)
        plan = ca.plan_find(parts, 9)
        c = fake.counts[-1]
        if plan["inputTokens"] != 48000 or plan["model"] != "claude-opus-4-8" or len(fake.streams) != n:
            problems.append(f"plan: {plan}")
        if "max_tokens" in c or c["thinking"] != {"type": "adaptive"} or c["system"][0].get("cache_control") is None:
            problems.append("the tokens must be counted for the very request that would be sent")
        if abs(plan["cost"]["low"] - round(48000 * 5 / 1e6 + ca.EXPECTED_OUTPUT_TOKENS * 25 / 1e6, 2)) > 1e-9 or plan["cost"]["assumed"]:
            problems.append(f"plan cost: {plan['cost']}")
        if ca.price_of("claude-opus-9-9") is None or not ca.price_of("claude-opus-9-9")[2] or ca.price_of("zzz") is not None:
            problems.append("an unknown Opus is priced as the family (assumed), an unknown model not at all")

        # --- the schema is refused (a 400 about the format): plain text and the repairs, and it says so
        fake.script = [BadRequestError("output_config.format: json_schema is not supported for this model", 400), {"text": "```json\n" + GOOD + "\n```"}]
        n = len(fake.streams)
        s = wait(ca.start_find(parts, lambda text: _server._import_reply(video, text), video=video))
        if s["state"] != "done" or s["how"] != "plain text and the import repairs" or len(fake.streams) != n + 2 \
                or "format" in fake.streams[-1]["output_config"] or "format" not in fake.streams[-2]["output_config"]:
            problems.append(f"the plain-text fallback: {s.get('state')} {s.get('how')} {len(fake.streams) - n} calls")
        fake.count_error = BadRequestError("output_config.format is not supported", 400)
        if ca.plan_find(parts, 9)["structured"] is not False:
            problems.append("count_tokens should fall back to plain text too")
        fake.count_error = None

        # --- every error class
        cases = [(AuthenticationError("bad key", 401), "auth"), (PermissionDeniedError("no", 403), "permission"),
                 (NotFoundError("model", 404), "model"), (RateLimitError("slow", 429), "rate_limit"),
                 (OverloadedError("busy", 529), "overloaded"), (InternalServerError("boom", 500), "overloaded"),
                 (ServiceUnavailableError("down", 503), "overloaded"), (APIStatusError("teapot", 418), "api"),
                 (APIStatusError("gateway", 502), "overloaded"), (RequestTooLargeError("big", 413), "too_large"),
                 (BadRequestError("Your credit balance is too low to access the API", 400), "no_credit"),
                 (BadRequestError("messages: roles must alternate", 400), "bad_request"),
                 (APITimeoutError("t"), "timeout"), (APIConnectionError("c"), "offline"),
                 (AnthropicError("Could not resolve authentication method. Expected api_key"), "no_key"),
                 (RuntimeError("weird"), "other")]
        for exc, code in cases:
            fake.script = [exc]
            s = wait(ca.start_find(parts, lambda text: _server._import_reply(video, text), video=video))
            if s["state"] != "failed" or s.get("code") != code or SECRET in s.get("message", "") or s.get("candidates"):
                problems.append(f"{type(exc).__name__} should end as {code}: {s.get('state')} {s.get('code')} {s.get('message', '')[:60]}")

        # --- a refusal, a reply cut at max_tokens, an empty one, one that is not JSON: nothing is imported
        before = len(ca._read_usage())
        for plan_, code in (({"stop": "refusal", "details": NS(explanation="a policy")}, "refusal"),
                            ({"stop": "max_tokens", "text": GOOD[:60]}, "max_tokens"),
                            ({"text": "   "}, "empty"), ({"text": "this is not json at all"}, "bad_reply")):
            fake.script = [plan_]
            s = wait(ca.start_find(parts, lambda text: _server._import_reply(video, text), video=video))
            if s["state"] != "failed" or s.get("code") != code or "candidates" in s:
                problems.append(f"{code}: {s.get('state')} {s.get('code')} {'candidates' in s}")
            if code == "bad_reply" and s.get("reply") != "this is not json at all":
                problems.append("a reply that could not be read is kept for the manual import")
        if len(ca._read_usage()) != before + 4:
            problems.append("a call that cost tokens is recorded even when nothing is imported")

        # --- cancel: the stream is closed and nothing is imported or recorded
        fake.slow, fake.closed = 3.0, False
        before = len(ca._read_usage())
        fake.script = [{}]
        jid = ca.start_find(parts, lambda text: _server._import_reply(video, text), video=video)
        time.sleep(0.4)
        ca.cancel(jid)
        s = wait(jid)
        fake.slow = 0.0
        if s["state"] != "cancelled" or not fake.closed or s.get("candidates") or len(ca._read_usage()) != before:
            problems.append(f"cancel: {s.get('state')} closed={fake.closed}")

        # --- settings: the key goes in and never comes out
        ca.save_settings(remove_key=True)
        if ca.key_source() != "none" or ca.load_settings().get("apiKey"):
            problems.append("the key was not removed")
        os.environ["ANTHROPIC_API_KEY"] = "sk-ant-ENV"
        if ca.key_source() != "env":
            problems.append("ANTHROPIC_API_KEY should count as a key")
        del os.environ["ANTHROPIC_API_KEY"]
        ca.save_settings(api_key=SECRET, effort="low")
        try:
            ca.save_settings(effort="turbo")
            problems.append("an unknown effort was accepted")
        except ca.ClaudeError:
            pass
        if ca.status()["effort"] != "low" or SECRET in json.dumps(ca.status()):
            problems.append("the settings answer must not hold the key")
        fake.script = [{}]
        wait(ca.start_find(parts, lambda text: _server._import_reply(video, text), video=video))
        if fake.streams[-1]["output_config"]["effort"] != "low":
            problems.append("the effort of the settings was not used")
        ca.save_settings(effort="high")

        # --- over HTTP: every answer is free of the key; the Guest can look for clips but not change the key
        srv = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        port = srv.server_address[1]
        threading.Thread(target=srv.serve_forever, daemon=True).start()
        quiet.__enter__()
        seen = []

        def call(method, path, profile="selftest", body=None):
            conn = http.client.HTTPConnection("127.0.0.1", port, timeout=30)
            headers = {"Host": f"127.0.0.1:{port}", "X-Klipian-Profile": profile}
            data = None
            if body is not None:
                data = json.dumps(body).encode()
                headers["Content-Type"] = "application/json"
            conn.request(method, path, body=data, headers=headers)
            r = conn.getresponse()
            raw = r.read().decode("utf-8", "replace")
            conn.close()
            seen.append(raw)
            try:
                return r.status, json.loads(raw)
            except ValueError:
                return r.status, {}

        st, j = call("GET", "/api/claude/status")
        if st != 200 or not j["sdk"] or j["keySource"] != "saved" or "apiKey" in j:
            problems.append(f"status: {st} {j}")
        st, j = call("GET", "/api/claude/models")
        if st != 200 or j["newestOpus"] != "claude-opus-5-5" or [m["id"] for m in j["models"]][0] != "claude-sonnet-5":
            problems.append(f"models: {st} {j}")
        st, j = call("POST", "/api/claude/test", body={})
        if st != 200 or not j["ok"]:
            problems.append(f"test: {st} {j}")
        fake.retrieve_error = AuthenticationError("nope", 401)
        st, j = call("POST", "/api/claude/test", body={})
        fake.retrieve_error = None
        if st != 400 or j.get("code") != "auth":
            problems.append(f"a refused key on Test: {st} {j}")
        st, j = call("POST", "/api/claude/settings", body={"model": "claude-opus-4-8", "apiKey": SECRET})
        if st != 200 or SECRET in json.dumps(j) or j["model"] != "claude-opus-4-8":
            problems.append(f"settings: {st}")
        st, j = call("POST", "/api/claude/plan", body={"video": video, "count": 9})
        if st != 200 or j["inputTokens"] != 48000 or j["count"] != 9:
            problems.append(f"plan over HTTP: {st} {j}")
        st, j = call("POST", "/api/claude/plan", body={"video": "no-such.mp4"})
        if st != 400 or "transcript" not in j.get("error", "").lower():
            problems.append(f"plan with no transcript: {st} {j}")
        fake.script = [{}]
        st, j = call("POST", "/api/claude/find", body={"video": video, "count": 9})
        done = {}
        for _ in range(100):
            st2, done = call("GET", f"/api/claude/job?id={j.get('id')}")
            if done.get("state") != "running":
                break
            time.sleep(0.05)
        if st != 200 or done.get("state") != "done" or done["candidates"][0]["title"] != "Satu" or not done.get("usage"):
            problems.append(f"find over HTTP: {st} {done.get('state')} {done.get('message')}")
        gtok = paths.set_profile(paths.GUEST)
        try:
            profiles.ensure_dirs(paths.GUEST)
            (paths.SOURCES / video).write_bytes(b"guest copy")
        finally:
            paths._profile.reset(gtok)
        if call("POST", "/api/claude/settings", paths.GUEST, {"apiKey": "x"})[0] != 403:
            problems.append("the Guest must not change the key")
        if call("GET", "/api/claude/status", paths.GUEST)[0] != 200:
            problems.append("the Guest can see the status")
        st, j = call("GET", "/api/claude/usage")
        if st != 200 or not j["months"] or j["months"][0]["calls"] < 5:
            problems.append(f"usage over HTTP: {st} {str(j)[:120]}")
        if any(SECRET in raw for raw in seen) or SECRET in ca._usage_file().read_text(encoding="utf-8") \
                or SECRET in err.getvalue():
            problems.append("the API key appeared in a response, the usage log or a log")

        # --- the SDK is not installed
        fake.sdk = False
        st, j = call("GET", "/api/claude/status")
        if j.get("sdk") is not False:
            problems.append("status should say the SDK is missing")
        st, j = call("POST", "/api/claude/plan", body={"video": video})
        if st != 400 or j.get("code") != "no_sdk" or "requirements-claude.txt" not in j.get("command", "") + ca.install_command():
            problems.append(f"missing SDK: {st} {j}")
        fake.sdk = True
        ca._sdk = real_sdk
        import importlib.util
        if importlib.util.find_spec("anthropic") is None:
            try:
                real_sdk.client(None)
                problems.append("the real SDK layer should say the package is missing")
            except ca.ClaudeError as exc:
                if exc.code != "no_sdk":
                    problems.append(f"the real SDK layer: {exc.code}")
        ca._sdk = fake
    finally:
        if srv:
            quiet.__exit__(None, None, None)
            srv.shutdown()
        ca._sdk = real_sdk
        for k, v in saved_env.items():
            if v is not None:
                os.environ[k] = v
        for f in (ca._file(), ca._usage_file()):
            f.unlink(missing_ok=True)
        for n in (video, other):
            (paths.SOURCES / n).unlink(missing_ok=True)
    if problems:
        return FAIL, "\n      ".join(problems[:10])
    return PASS, "request shape, model default, cached system block, structured/plain fallback, usage and cost, 16 error classes, refusal/max_tokens/empty/bad reply import nothing, cancel, key never leaks, no SDK"


def check_rubrics() -> tuple[str, str]:
    """Rubrics per niche (rubrics.py): every template passes the required-section check and goes into a brief
    with its own text and the hashtag block; a rubric in the workspace is listed, chosen and used; a deleted one
    falls back to dialog with a note; a bad id is refused; a rubric missing a section is refused naming it; the
    dialog brief stays what it was. Nothing is opened and nothing reaches the real Recycle Bin."""
    import contextlib
    import http.client
    import io
    import threading
    from http.server import ThreadingHTTPServer
    from . import paths, profiles, recycle, roundtrip, rubrics
    from .cache import Cache
    from .models import Transcript
    from .server import Handler

    problems = []
    real_open, real_bin = rubrics._open, recycle.to_recycle_bin
    opened = []
    rubrics._open = opened.append
    recycle.to_recycle_bin = lambda path: Path(path).unlink(missing_ok=True)       # the scratch workspace: no bin
    srv = None
    quiet = contextlib.redirect_stderr(io.StringIO())
    video = "rubric-test.mp4"
    try:
        transcript = Transcript.load(FIXTURES / "brief" / "transcript.json")
        rule = "TESTRULE: hashtags go first in the title."
        # --- every template is complete, and is what the brief carries
        names = [t["id"] for t in rubrics.templates()]
        if sorted(names) != ["edukasi", "gaming", "komedi-tv", "motivasi", "podcast"]:
            problems.append(f"templates found: {names}")
        for t in names:
            text = rubrics._read(rubrics._template_path(t))
            if rubrics.check(text):
                problems.append(f"template {t} lacks {rubrics.check(text)}")
            body = roundtrip.build_brief(transcript, text, "x.mp4", None, None, rule)
            api_sys, _ = roundtrip.build_api_brief(transcript, text, "x.mp4", None, None, rule, 5)
            marker = next(ln for ln in text.splitlines() if ln.startswith("### 1."))
            for label, out in (("brief", body), ("api brief", api_sys)):
                if marker not in out or "TESTRULE" not in out or "## Teks posting" not in out:
                    problems.append(f"{label} of template {t} lost its text or the hashtag block")
        for t in ("edukasi", "gaming", "komedi-tv", "motivasi"):
            if "podcast" in rubrics._read(rubrics._template_path(t)).lower():
                problems.append(f"template {t} still speaks of podcast")
        # --- the dialog rubric is the file as it was
        if rubrics.load("dialog") != ("dialog", roundtrip.read_rubric(roundtrip.RUBRICS["dialog"]), None) \
                or rubrics.load(None)[0] != "dialog" or rubrics.check(rubrics.load("dialog")[1]):
            problems.append("the dialog rubric changed or does not pass its own check")
        # --- the built-in "Lucu / komedi" is the komedi-tv template itself, complete, and what its brief carries
        lid, ltext, lnote = rubrics.load("lucu")
        tugas = ltext.split("## Tugas", 1)[1].strip().splitlines()[0]
        if lid != "lucu" or lnote or rubrics.check(ltext) or ltext != rubrics._read(rubrics.TEMPLATE_DIR / "komedi-tv.md")                 or tugas not in roundtrip.build_brief(transcript, ltext, "x.mp4", None, None, rule):
            problems.append(f"the built-in lucu rubric: {lid} {lnote} {rubrics.check(ltext)}")
        # --- a workspace rubric: made from a template, listed, chosen by the profile, used by the brief
        made = rubrics.create("komedi-tv", "Komedi Uji")
        if made != {"id": "komedi-uji", "name": "Komedi Uji"} or not (rubrics.workspace_dir() / "komedi-uji.md").is_file():
            problems.append(f"create: {made}")
        text = rubrics._read(rubrics.workspace_dir() / "komedi-uji.md")
        if not text.startswith("# Rubrik: Komedi Uji") or rubrics.check(text):
            problems.append("the copy should carry the new name and stay complete")
        for bad in (("komedi-tv", "Komedi Uji"), ("komedi-tv", "Dialog"), ("nope", "x"), ("../x", "x"), ("komedi-tv", "!!!")):
            try:
                rubrics.create(*bad)
                problems.append(f"create{bad} should have been refused")
            except rubrics.RubricError:
                pass
        listing = rubrics.list_all()
        if [r["id"] for r in listing["workspace"]] != ["komedi-uji"] or [r["id"] for r in listing["builtin"]] != ["dialog", "gameplay", "lucu"]:
            problems.append(f"listing: {listing}")
        profiles.update("selftest", {"defaults": {"rubric": "komedi-uji"}})
        if profiles.defaults().get("rubric") != "komedi-uji":
            problems.append("the profile could not choose a workspace rubric")
        profiles.update("selftest", {"defaults": {"rubric": "../evil"}})
        if profiles.defaults().get("rubric") == "../evil":
            problems.append("a rubric id with a path in it was stored")
        profiles.update("selftest", {"defaults": {"rubric": "komedi-uji"}})
        # the brief uses it: through the server (pasted brief and the API's cached block)
        (paths.SOURCES / video).write_bytes(b"not a real video")
        from .paths import GLOSSARY
        from .transcribe import DEFAULT_LANGUAGE, DEFAULT_MODEL
        transcript.save(Cache(paths.CACHE_DIR).transcript_path(paths.SOURCES / video, DEFAULT_MODEL, DEFAULT_LANGUAGE,
                                                                GLOSSARY if GLOSSARY.is_file() else None))
        from . import server as _server
        marker = next(ln for ln in text.splitlines() if ln.startswith("### 1."))
        sys1, _ = _server._claude_parts(video)(5)
        sys2, _ = _server._claude_parts(video)(9)
        if marker not in sys1 or sys1 != sys2:
            problems.append("the Claude brief should use the chosen rubric, byte-identical from one call to the next")
        dialog_sys, _ = _server._claude_parts(video, "dialog")(5)
        if marker in dialog_sys or dialog_sys == sys1:
            problems.append("an explicit rubric should override the profile's")

        srv = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        port = srv.server_address[1]
        threading.Thread(target=srv.serve_forever, daemon=True).start()
        quiet.__enter__()

        def call(method, path, profile="selftest", body=None):
            conn = http.client.HTTPConnection("127.0.0.1", port, timeout=30)
            headers = {"Host": f"127.0.0.1:{port}", "X-Klipian-Profile": profile}
            data = None
            if body is not None:
                data = json.dumps(body).encode()
                headers["Content-Type"] = "application/json"
            conn.request(method, path, body=data, headers=headers)
            r = conn.getresponse()
            raw = r.read().decode("utf-8", "replace")
            conn.close()
            try:
                return r.status, json.loads(raw)
            except ValueError:
                return r.status, raw

        st, brief = call("GET", f"/api/brief?video={video}")
        if st != 200 or marker not in brief:
            problems.append(f"/api/brief with the profile's rubric: {st}")
        st, brief = call("GET", f"/api/brief?video={video}&mode=dialog")
        if st != 200 or marker in brief or "## Teks posting" not in brief:
            problems.append("/api/brief?mode=dialog should override")
        # a transcript of only some ranges is no ground for the brief of path A (nor for Find clips with Claude)
        tpath = Cache(paths.CACHE_DIR).transcript_path(paths.SOURCES / video, DEFAULT_MODEL, DEFAULT_LANGUAGE,
                                                       GLOSSARY if GLOSSARY.is_file() else None)
        transcript.ranges = [[0.0, 3.0]]
        transcript.save(tpath)
        st, j = call("GET", f"/api/brief?video={video}")
        if st != 409 or "covers only the imported clips" not in j.get("error", ""):
            problems.append(f"/api/brief with a partial transcript should say so (409): {st} {j}")
        try:
            _server._claude_parts(video)
            problems.append("Find clips with Claude must refuse a partial transcript")
        except ValueError as exc:
            if "covers only the imported clips" not in str(exc):
                problems.append(f"Find clips with Claude on a partial transcript: {exc}")
        transcript.ranges = None
        transcript.save(tpath)
        st, j = call("GET", "/api/rubrics")
        if st != 200 or j["current"]["id"] != "komedi-uji" or j["current"]["note"] or len(j["templates"]) != 5:
            problems.append(f"/api/rubrics: {st} {j}")
        for bad in ("../../etc/passwd", "A%20B", "x" * 41, "a/b"):
            st, j = call("GET", f"/api/brief?video={video}&mode={bad}")
            if st != 400:
                problems.append(f"mode {bad!r} should be refused: {st}")
        for path, body in (("/api/rubrics/delete", {"id": "../x"}), ("/api/rubrics/delete", {"id": "dialog"}),
                           ("/api/rubrics/open", {"id": "../x"}), ("/api/rubrics/create", {"template": "../x", "name": "q"})):
            st, j = call("POST", path, body=body)
            if st != 400 or j.get("ok") is not False:
                problems.append(f"{path} {body} should be refused: {st}")
        # --- open: the file in the workspace folder, or the folder
        st, j = call("POST", "/api/rubrics/open", body={"id": "komedi-uji"})
        st2, j2 = call("POST", "/api/rubrics/open", body={})
        if st != 200 or st2 != 200 or [Path(o).name for o in opened] != ["komedi-uji.md", "rubrics"]:
            problems.append(f"open: {st} {st2} {opened}")
        # --- the Guest can choose too: it lists, creates and briefs
        st, j = call("GET", "/api/rubrics", profile="_guest")
        st2, j2 = call("POST", "/api/rubrics/create", profile="_guest", body={"template": "edukasi", "name": "Edu Tamu"})
        if st != 200 or st2 != 200 or j2.get("id") != "edu-tamu":
            problems.append(f"guest: {st} {st2} {j2}")
        # --- a rubric that lost a section is refused, naming it; never sent out silently
        path = rubrics.workspace_dir() / "komedi-uji.md"
        path.write_bytes(path.read_bytes().replace(b"## Teks posting", b"## Teks"))
        st, j = call("GET", f"/api/brief?video={video}")
        if st != 400 or "Teks posting" not in j.get("error", ""):
            problems.append(f"a rubric without 'Teks posting' must be refused with its name: {st} {j}")
        try:
            _server._claude_parts(video)
            problems.append("the Claude brief must not be built from an incomplete rubric")
        except rubrics.RubricError as exc:
            if "Teks posting" not in str(exc):
                problems.append(f"the message should name the section: {exc}")
        st, j = call("GET", "/api/rubrics")
        mine = {r["id"]: r for r in j["workspace"]}
        if not any("Teks posting" in m for m in mine["komedi-uji"]["missing"]) or j["current"].get("id") is not None:
            problems.append(f"the listing should show what is missing: {mine['komedi-uji']}")
        # --- deleted: the profile falls back to dialog, with a note
        st, j = call("POST", "/api/rubrics/delete", body={"id": "komedi-uji"})
        if st != 200 or path.exists():
            problems.append(f"delete: {st}")
        st, j = call("GET", "/api/rubrics")
        if j["current"]["id"] != "dialog" or "komedi-uji" not in (j["current"]["note"] or ""):
            problems.append(f"a deleted rubric should fall back to dialog with a note: {j['current']}")
        st, brief = call("GET", f"/api/brief?video={video}")
        if st != 200 or "## Teks posting" not in brief:
            problems.append("the brief should still be made (with dialog) after the rubric was deleted")
        st, j = call("POST", "/api/rubrics/delete", body={"id": "komedi-uji"})
        if st != 400:
            problems.append("deleting what is gone should say so")
    finally:
        if srv:
            quiet.__exit__(None, None, None)
            srv.shutdown()
        rubrics._open, recycle.to_recycle_bin = real_open, real_bin
        (paths.SOURCES / video).unlink(missing_ok=True)
        for f in list(rubrics.workspace_dir().glob("*.md")):
            f.unlink(missing_ok=True)
        profiles.update("selftest", {"defaults": {"rubric": ""}})
    if problems:
        return FAIL, "\n      ".join(problems[:10])
    return PASS, "5 templates complete and in the brief, workspace rubric listed/chosen/used (cached block byte-stable), deleted falls back with a note, bad ids refused, a missing section refused by name, dialog unchanged, Guest allowed"


def check_guide() -> tuple[str, str]:
    """The guide page (ui/guide.html): /guide is served with no profile, its stylesheet too, and every anchor the
    interface links to (/guide#...) and every entry of its table of contents exists in the page."""
    import contextlib
    import http.client
    import io
    import re
    import threading
    from http.server import ThreadingHTTPServer
    from .server import Handler

    problems = []
    page = (ROOT / "ui" / "guide.html").read_text(encoding="utf-8")
    ws = (ROOT / "ui" / "workspace.html").read_text(encoding="utf-8")
    if not all(f'<option value="{u}"' in ws for u in ("minute", "hour", "day")) or 'value="day" selected' not in ws:
        problems.append("the bulk upload gap needs minutes | hours | days, days the default")
    if "Also change clips that already have a date and time" not in ws or "Off: only clips without a schedule" not in ws             or "reschedule rows that already" in ws:
        problems.append("the bulk upload's checkbox label and tooltip are not the agreed words")
    if "minutes" not in page or "Also change clips that already have a date and time" not in page:
        problems.append("the guide's #bulk part should mention minutes and the renamed option")
    ids = set(re.findall(r'\bid="([^"]+)"', page))
    for must in ("youtube", "youtube-status", "youtube-limits", "claude", "download", "profiles", "bulk", "youtube-client", "youtube-test-user",
                 "youtube-expired", "motion"):
        if must not in ids:
            problems.append(f"the guide lost its #{must} section")
    for anchor in re.findall(r'href="#([^"]+)"', page):
        if anchor not in ids:
            problems.append(f"the guide's own link #{anchor} points nowhere")
    linked = set()
    for f in list((ROOT / "ui").rglob("*.js")) + list((ROOT / "ui").rglob("*.html")):
        if f.name == "guide.html":
            continue
        text = f.read_text(encoding="utf-8", errors="replace")
        linked |= set(re.findall(r"/guide#([A-Za-z0-9_-]+)", text))
        linked |= set(re.findall(r'guideUrl\("#([A-Za-z0-9_-]+)"', text))
        for block in re.findall(r"YT_GUIDE = \{([^}]*)\}", text):
            linked |= set(re.findall(r'"([a-z-]+)"', block)) - {"none", "no_client", "expired", "different", "not_test_user", "offline", "no_library"}
    for anchor in sorted(linked):
        if anchor not in ids:
            problems.append(f"the interface links to /guide#{anchor}, which the guide does not have")
    if not linked:
        problems.append("expected the interface to link to the guide")
    srv = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    port = srv.server_address[1]
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    quiet = contextlib.redirect_stderr(io.StringIO())
    quiet.__enter__()
    try:
        for path, needle in (("/guide", 'id="youtube"'), ("/guide/", 'id="bulk"'), ("/ui/css/guide.css", ".guide-toc")):
            conn = http.client.HTTPConnection("127.0.0.1", port, timeout=15)
            conn.request("GET", path, headers={"Host": f"127.0.0.1:{port}"})
            r = conn.getresponse()
            body = r.read().decode("utf-8", "replace")
            conn.close()
            if r.status != 200 or needle not in body:
                problems.append(f"GET {path}: {r.status}")
    finally:
        quiet.__exit__(None, None, None)
        srv.shutdown()
    if problems:
        return FAIL, "\n      ".join(problems[:10])
    return PASS, f"/guide and its stylesheet are served without a profile; the {len(linked)} anchors the interface links to and the table of contents all exist"


def check_timefield() -> tuple[str, str]:
    """The browser code's pure functions, run by node on tests/*.test.js: the masked time field (ui/js/editor/timefield.js:
    digits fill from the right, tenths, the shapes for a short and a long source, seconds and minutes above 59 refused,
    empty and garbage, formatting and the round trip) and the merge of Claude's reply for one Result into its fields
    (postreply.js). Skipped (with a note) when node is not installed."""
    import shutil
    import subprocess
    node = shutil.which("node")
    if not node:
        return PASS, "skipped: node is not installed (tests/*.test.js not run)"
    done = []
    for test in sorted((ROOT / "tests").glob("*.test.js")):
        proc = subprocess.run([node, str(test)], capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=60)
        if proc.returncode != 0:
            return FAIL, f"{test.name}: " + (proc.stderr or proc.stdout).strip().splitlines()[-1][:300]
        done.append(proc.stdout.strip().splitlines()[-1])
    return PASS, "; ".join(done)


def check_resultpost() -> tuple[str, str]:
    """Post text for ONE Result through Claude chat (roundtrip.build_result_brief / parse_result_reply): the brief holds
    only that Result's words (corrections applied, times from the clip's start, two videos), the cues inside it, the
    credit context, the rubric's three sections and the hashtag rule; a rubric without a section is refused by name; a
    reply fills every field (tags normalised, note times in seconds), the .replace slip is repaired, a missing key is
    reported by name."""
    import re
    from . import roundtrip

    base = FIXTURES / "renderreq"
    project = _load(base / "project.json")
    words = {"ep1.mp4": [{"text": f"w{k}", "start": k * 0.5, "end": k * 0.5 + 0.4} for k in range(120)],
             "ep2.mp4": [{"text": f"v{k}", "start": 100 + k * 0.5, "end": 100 + k * 0.5 + 0.4} for k in range(20)]}
    rubric = roundtrip.read_rubric(roundtrip.RUBRICS["dialog"])
    rule = "TESTRULE: the first 3 hashtags go in the title."
    credit = {"ep1.mp4": {"platform": "YouTube", "creator": "Raditya Dika", "title": "Ep Satu", "url": "https://youtu.be/x"}}
    laugh = [{"kind": "laughter", "start": 14.0, "end": 15.5, "level": "high", "peak": 0.9, "len": 1.5},
             {"kind": "laughter", "start": 50.0, "end": 51.0, "level": "high", "peak": 0.9, "len": 1.0}]
    problems = []

    def brief(rid, rub=rubric):
        return roundtrip.build_result_brief(project, rid, words_of=words.get, size_of=lambda f: (1920, 1080),
                                            cues_of=lambda f: laugh if f == "ep1.mp4" else [], credit_of=credit.get,
                                            rubric=rub, hashtag_rule=rule)

    b = brief("res1")                                     # moment 10-20 s of ep1, corrections at 12.5 and 13.0
    if "Dikoreksi" not in b or re.search(r"\bw25\b", b):
        problems.append("the corrected word should be in the brief and the one it replaced not")
    for k in (20, 21, 39):
        if not re.search(rf"\bw{k}\b", b):
            problems.append(f"a word of the clip (w{k}) is missing")
    for k in (0, 5, 19, 40, 100):
        if re.search(rf"\bw{k}\b", b):
            problems.append(f"a word outside the clip (w{k}) is in the brief")
    if "[0:00] w20" not in b:
        problems.append("times should start at 0:00 at the start of the clip")
    if "laughter · high" not in b or "[0:04]" not in b or b.count("laughter") != 1:
        problems.append("only the cue inside the clip should be listed, from the clip's start (14 s -> 0:04)")
    if "YouTube · Raditya Dika" not in b or "https://youtu.be/x" in b or "Do not write a credit" not in b:
        problems.append("the credit context should name the source, without the link, and forbid a credit line of Claude's own")
    for h in ("## Judul dan hook", "## Teks posting", "## Sudut pandang"):
        if h not in b:
            problems.append(f"the rubric section {h} is not in the brief")
    if "Jangan menulis baris kredit" not in b or "Jangan mengulang kutipan" not in b:
        problems.append("the rubric sections should come verbatim")
    if "## Lima kriteria" in b or "## Berapa klip" in b:
        problems.append("only the three sections of the rubric belong in this brief")
    if rule not in b or "Plain JSON only" not in b or '"angle"' not in b or '"youtubeTitle"' not in b or "START OF THE CLIP" not in b:
        problems.append("the hashtag rule, the JSON sentence and the reply shape belong in the brief")
    two = brief("res2")                                   # two videos
    if not re.search(r"\bv0\b", two) or "ep2.mp4" not in two or re.search(r"\bw30\b", two):
        problems.append("a Result of two videos: its words from both, no others")
    for rid, want in (("res4", "no time points"), ("nope", "not in the project")):
        try:
            brief(rid)
            problems.append(f"{rid} should be refused")
        except ValueError as exc:
            if want not in str(exc):
                problems.append(f"{rid}: {exc}")
    try:
        brief("res1", rubric.replace("## Teks posting", "## Teks"))
        problems.append("a rubric without 'Teks posting' must be refused")
    except ValueError as exc:
        if "Teks posting" not in str(exc):
            problems.append(f"the message should name the section: {exc}")
    for tpl in ("komedi-tv", "edukasi", "gaming", "motivasi"):
        if "## Teks posting" not in brief("res1", roundtrip.read_rubric(ROOT / "prompts" / "rubrik" / "templates" / f"{tpl}.md")):
            problems.append(f"the {tpl} template should work for this brief")

    # the reply
    good = """Tentu, ini:
```json
{"title": "Rugi Karena Timing", "hook": "satu keputusan", "post": {"title": "Rugi 300 Juta", "caption": "Satu keputusan. Kamu pernah?",
 "hashtags": "bisnis, #podcast lucu", "youtubeTitle": "x"},
 "angle": {"take": "Keputusan kecil mahal.", "intro": "Satu keputusan ini", "notes": [{"at": "0:04", "text": "Dengar nadanya"}, {"at": "9:59", "text": "Jauh"}]}}
```"""
    f, notes = roundtrip.parse_result_reply(good, 10.0)
    if (f["title"], f["hook"]) != ("Rugi Karena Timing", "satu keputusan") or f["post"]["hashtags"] != ["#bisnis", "#podcast", "#lucu"] \
            or f["post"]["caption"] != "Satu keputusan. Kamu pernah?" or f["angle"]["take"] != "Keputusan kecil mahal." \
            or f["angle"]["intro"] != "Satu keputusan ini" or [n["at"] for n in f["angle"]["notes"]] != [4.0, 10.0] or notes:
        problems.append(f"a reply did not fill every field: {f} {notes}")
    slipped = good.replace('"Satu keputusan. Kamu pernah?"', '"Satu keputusan. Kamu pernah?".replace(" ", "")').replace('"Jauh"}]', '"Jauh"},]')
    f2, notes2 = roundtrip.parse_result_reply(slipped, 10.0)
    if f2["post"]["caption"] != "Satukeputusan.Kamupernah?" or len(notes2) != 2:
        problems.append(f"the .replace slip and the trailing comma should be repaired and said: {f2['post']['caption']} {notes2}")
    wrapped = '{"clips": [{"title": "Dari klip", "post": {"title": "T", "caption": "C", "hashtags": ["a"]}, "angle": {"take": "k", "intro": "i"}}]}'
    if roundtrip.parse_result_reply(wrapped, 10.0)[0]["title"] != "Dari klip":
        problems.append("a reply in the clips shape should be read from its first clip")
    broken = '{"title": "x", "post": {"title": "T", "hashtags": ["a"]}, "angle": {"intro": "i"}}'
    try:
        roundtrip.parse_result_reply(broken, 10.0)
        problems.append("a reply with missing keys should be refused")
    except ValueError as exc:
        for key in ("post.caption", "angle.take"):
            if key not in str(exc):
                problems.append(f"the message should name {key}: {exc}")
        if "post.title" in str(exc) or "angle.intro" in str(exc):
            problems.append(f"the message names something that is there: {exc}")
    for bad, want in (("no json here", "No JSON block"), ('{"title": "x", "post": {"a": }}', "broken")):
        try:
            roundtrip.parse_result_reply(bad, 10.0)
            problems.append(f"{bad!r} should be refused")
        except ValueError as exc:
            if want not in str(exc):
                problems.append(f"{bad!r}: {exc}")
    # ONE brief for several Results, and the reply with one entry per Result
    def many(ids):
        return roundtrip.build_results_brief(project, ids, words_of=words.get, size_of=lambda f: (1920, 1080),
                                             cues_of=lambda f: laugh if f == "ep1.mp4" else [], credit_of=credit.get,
                                             rubric=rubric, hashtag_rule=rule)

    mb = many(["res1", "res2"])
    if "`res1`" not in mb or "`res2`" not in mb or not re.search(r"\bw20\b", mb) or not re.search(r"\bv0\b", mb) or re.search(r"\bw100\b", mb):
        problems.append("the brief of several Results should hold each one's own id and words, and nobody else's")
    if mb.count("## Teks posting") != 1 or mb.count(rule) != 1 or mb.count("Plain JSON only") != 1 or '"results"' not in mb:
        problems.append("the rubric sections, the hashtag rule and the JSON sentence belong once; the reply shape has a results list")
    if mb.count("[0:00]") < 2:
        problems.append("each clip's times start at 0:00")
    for ids, want in ((["res1", "res4"], "res4"), ([], "No Result")):
        try:
            many(ids)
            problems.append(f"{ids} should be refused")
        except ValueError as exc:
            if want not in str(exc):
                problems.append(f"{ids}: {exc}")
    entry = lambda rid, **kw: {"id": rid, "title": "T " + rid, "post": {"title": "P", "caption": "C", "hashtags": ["a"]},   # noqa: E731
                               "angle": {"take": "k", "intro": "i"}, **kw}
    reply = "```json\n" + json.dumps({"results": [entry("res1"), entry("res2", hook="h"), entry("zzz")]}) + "\n```"
    got, notes = roundtrip.parse_results_reply(reply, {"res1": 10.0, "res2": 7.25})
    if sorted(got) != ["res1", "res2"] or got["res2"]["hook"] != "h" or got["res1"]["post"]["hashtags"] != ["#a"] or not any("zzz" in n for n in notes):
        problems.append(f"a reply of several Results: {sorted(got)} {notes}")
    for text, want in ((json.dumps({"results": [entry("res1")]}), "res2: no entry"),
                       (json.dumps({"results": [entry("res1"), {"id": "res2", "title": "x", "post": {"title": "P"}, "angle": {"take": "k"}}]}),
                        "res2: post.caption, post.hashtags, angle.intro"),
                       (json.dumps({"clips": []}), 'no "results" list')):
        try:
            roundtrip.parse_results_reply(text, {"res1": 10.0, "res2": 7.25})
            problems.append(f"{want!r} should have been refused")
        except ValueError as exc:
            if want not in str(exc) or ("res1:" in str(exc)):
                problems.append(f"the message should name {want!r} and only what is wrong: {exc}")
    one = roundtrip.parse_results_reply(json.dumps({k: v for k, v in entry("x").items() if k != "id"}), {"res1": 10.0})[0]
    if list(one) != ["res1"]:
        problems.append("a reply for a single clip without a list should be read for the one Result asked for")
    if problems:
        return FAIL, "\n      ".join(problems[:10])
    return PASS, "the brief holds only the Result's words (corrections, clip times, two videos), cues inside it, credit context, the rubric's 3 sections, the hashtag rule; rubric sections refused by name; reply fills every field, slips repaired, missing keys named"


# --------------------------------------------------------------------------
# check: the shared queue for heavy jobs (sched.py), the file-keyed transcribe dedupe
# --------------------------------------------------------------------------

def check_sched() -> tuple[str, str]:
    """One heavy AI job at a time across profiles, renders limited to the setting (1 or 2), round-robin between
    profiles with a slot per batch ITEM, a waiting job can be cancelled, and a transcribe is shared by FILE
    (same bytes: one job; same name but another file: two jobs). Work is faked."""
    import os
    import threading
    from . import jobs, paths, profiles, sched
    from .jobs import JOBS, LOCK

    problems: list[str] = []
    for pid, name in (("sa", "Alpha"), ("sb", "Beta")):
        profiles.write_meta(pid, {"name": name, "color": "#123456"})
        profiles.ensure_dirs(pid)

    def in_profile(pid, fn, *a):
        def run():
            paths.set_profile(pid)
            fn(*a)
        th = threading.Thread(target=run, daemon=True)
        th.start()
        return th

    def until(cond, secs=5.0):
        end = time.time() + secs
        while time.time() < end:
            if cond():
                return True
            time.sleep(0.01)
        return False

    log: list[str] = []
    live = {"n": 0, "max": 0}
    lock = threading.Lock()

    def work(group, kind, jid, hold, tag, cancelled=lambda: False, update=None):
        with sched.slot(group, kind, jid, cancelled, update) as t:
            if t is None:
                with lock:
                    log.append(f"{tag}:cancelled")
                return
            with lock:
                live["n"] += 1
                live["max"] = max(live["max"], live["n"])
                log.append(tag)
            hold.wait(5)
            with lock:
                live["n"] -= 1

    saved_limit = sched.render_limit()
    sched.reset_for_tests()                               # nothing left by an earlier check
    try:
        # --- the setting: default 1, only 1 or 2, kept in a global file
        sched.set_render_limit(1)
        if sched.render_limit() != 1 or not (paths.workspace_dir() / "machine.json").is_file():
            problems.append("the render limit should default to 1 and live in workspace/machine.json")
        for bad in (0, 3, "x", None):
            try:
                sched.set_render_limit(bad)
                problems.append(f"render limit {bad!r} should be refused")
            except ValueError:
                pass

        # --- two transcribe-like jobs from two profiles run one after another; a third waits and is cancelled
        h1, h2, h3 = threading.Event(), threading.Event(), threading.Event()
        shown: dict[str, list] = {"b": [], "c": []}
        cancel_c = threading.Event()
        t1 = in_profile("sa", work, sched.GROUP_AI, "transcribe", "j1", h1, "T-A")
        until(lambda: "T-A" in log)
        t2 = in_profile("sb", work, sched.GROUP_AI, "transcribe", "j2", h2, "T-B", lambda: False, shown["b"].append)
        until(lambda: shown["b"])
        t3 = in_profile("sb", work, sched.GROUP_AI, "diarize", "j3", h3, "D-B", cancel_c.is_set, shown["c"].append)
        until(lambda: shown["c"])
        if not shown["b"] or "Alpha" not in shown["b"][-1]["text"] or shown["b"][-1]["position"] != 1 \
                or "transcription" not in shown["b"][-1]["text"]:
            problems.append(f"the waiting job should say it waits for Alpha's transcription at position 1: {shown['b'][-1:]}")
        until(lambda: shown["c"] and shown["c"][-1] and shown["c"][-1]["position"] == 2)
        if not shown["c"] or not shown["c"][-1] or shown["c"][-1]["position"] != 2:
            problems.append(f"the third job should be at position 2: {shown['c'][-1:]}")
        if log != ["T-A"]:
            problems.append(f"only the first job may run: {log}")
        cancel_c.set()
        sched.poke()
        until(lambda: "D-B:cancelled" in log)
        if "D-B:cancelled" not in log or shown["c"][-1] is not None:
            problems.append(f"a waiting job should leave the queue when cancelled (and its notice cleared): {log} {shown['c'][-1:]}")
        h1.set()
        until(lambda: "T-B" in log)
        if "T-B" not in log or shown["b"][-1] is not None:
            problems.append(f"the second profile's job should start after the first, and clear its waiting notice: {log}")
        h2.set()
        t1.join(5)
        t2.join(5)
        t3.join(5)
        if live["max"] != 1:
            problems.append(f"the AI group must never run two at once: max {live['max']}")

        # --- renders: 1 at a time, then 2 when the setting is raised while jobs wait
        log.clear()
        live.update(n=0, max=0)
        hs = [threading.Event() for _ in range(3)]
        # Started one at a time, each seen in the queue before the next starts: the order of arrival is then fixed
        # (threads started together can reach the scheduler in either order, which is what once made this flaky).
        ths = [in_profile("sa", work, sched.GROUP_RENDER, "render", "r0", hs[0], "R0")]
        until(lambda: "R0" in log)
        for i in (1, 2):
            ths.append(in_profile("sa", work, sched.GROUP_RENDER, "render", f"r{i}", hs[i], f"R{i}"))
            until(lambda i=i: len(sched.snapshot()["render"]["waiting"]) == i)
        time.sleep(0.2)
        if live["max"] != 1 or log != ["R0"]:
            problems.append(f"renders must run one at a time by default: {log} max {live['max']}")
        sched.set_render_limit(2)
        until(lambda: len(log) == 2)
        time.sleep(0.2)
        if live["max"] != 2 or log != ["R0", "R1"]:
            problems.append(f"raising the limit to 2 should start exactly the next one in line: {log} max {live['max']}")
        for h in hs:
            h.set()
        for th in ths:
            th.join(5)
        sched.set_render_limit(1)

        # --- round-robin: A's batch takes a slot per ITEM, B's two jobs wait together: A1, B1, A2, B2, A3, A4
        log.clear()
        gate = threading.Event()
        a_started = threading.Event()

        def batch_a():
            for i in range(1, 5):
                with sched.slot(sched.GROUP_RENDER, "render", f"A{i}"):
                    log.append(f"A{i}")
                    if i == 1:
                        a_started.set()
                        gate.wait(5)
                    else:
                        time.sleep(0.05)

        def one_b(i):
            with sched.slot(sched.GROUP_RENDER, "render", f"B{i}"):
                log.append(f"B{i}")
                time.sleep(0.05)

        ta = in_profile("sa", batch_a)
        a_started.wait(5)
        tb1 = in_profile("sb", one_b, 1)
        until(lambda: len(sched.snapshot()["render"]["waiting"]) == 1)
        tb2 = in_profile("sb", one_b, 2)
        until(lambda: len(sched.snapshot()["render"]["waiting"]) == 2)
        gate.set()
        for th in (ta, tb1, tb2):
            th.join(5)
        if log != ["A1", "B1", "A2", "B2", "A3", "A4"]:
            problems.append(f"profiles should take turns (a batch must not starve the other profile): {log}")

        # --- the real wrappers with faked work: batch items interleave with another profile's render, a waiting
        # item shows why it waits and can be cancelled, a waiting transcribe is "queued" and can be cancelled
        order: list[str] = []
        real_body, real_tbody, real_need = jobs._render_body, jobs._transcribe_body, jobs._transcribe_needs_work
        hold = threading.Event()

        def fake_render(job_id, req, into=None, record=True):
            order.append(job_id)
            if req.get("hold"):
                hold.wait(5)
            else:
                time.sleep(0.05)
            with LOCK:
                JOBS[job_id].update(state="done", result=[{"file": job_id + ".mp4", "duration": 1, "mb": 0.1}])

        def fake_transcribe(job_id, req):
            order.append(job_id)
            hold.wait(5)
            with LOCK:
                JOBS[job_id]["state"] = "done"

        jobs._render_body, jobs._transcribe_body, jobs._transcribe_needs_work = fake_render, fake_transcribe, lambda req: True
        try:
            items = [{"result": f"x{i}", "title": f"item {i}", "duration": 1, "layout": "9:16", "state": "queued",
                      "error": None, "cancel": False} for i in range(4)]
            jobs._register_job("bt", {"state": "running", "done": 0, "total": 4, "index": 0, "current": "", "result": [],
                                      "error": None, "batch": True, "items": items, "refused": []})
            reqs = [{"hold": i == 0} for i in range(4)]
            tbatch = in_profile("sa", jobs._run_batch, "bt", reqs)
            until(lambda: order == ["bt-0"])
            jobs._register_job("rb", {"state": "running", "done": 0, "total": 1, "index": 0, "current": "", "result": [], "error": None})
            trb = in_profile("sb", jobs._run_render, "rb", {"hold": False})
            until(lambda: JOBS["rb"].get("state") == "queued")
            with LOCK:
                qtext = (JOBS["rb"].get("queue") or {}).get("text", "")
            if "Alpha" not in qtext or "render" not in qtext:
                problems.append(f"a waiting render should say what it waits for: {qtext!r}")
            if not jobs.cancel_job("bt", 3):
                problems.append("a not-yet-started batch item should be cancellable")
            hold.set()
            tbatch.join(10)
            trb.join(10)
            if order[:3] != ["bt-0", "rb", "bt-1"] or "bt-3" in order:
                problems.append(f"the other profile's render should run between two items of the batch, and a cancelled item not at all: {order}")
            if [x["state"] for x in items] != ["done", "done", "done", "cancelled"]:
                problems.append(f"batch items: {[x['state'] for x in items]}")
            if JOBS["rb"]["state"] != "done" or "queue" in JOBS["rb"]:
                problems.append(f"a render that got its slot is done without a queue note: {JOBS['rb']}")

            # transcribes: A holds Whisper, B's is queued (state + text), then cancelled while queued
            order.clear()
            hold.clear()
            for jid in ("tr1", "tr2"):
                jobs._register_job(jid, {"state": "running", "key": "k" + jid, "stage": "start", "percent": 0})
            u1 = in_profile("sa", jobs._run_transcribe, "tr1", {"video": "none.mp4"})
            until(lambda: order == ["tr1"])
            u2 = in_profile("sb", jobs._run_transcribe, "tr2", {"video": "none.mp4"})
            until(lambda: JOBS["tr2"].get("state") == "queued")
            if "Alpha" not in (JOBS["tr2"].get("queue") or {}).get("text", ""):
                problems.append(f"a queued transcribe should name the profile it waits for: {JOBS['tr2'].get('queue')}")
            if not jobs.cancel_job("tr2"):
                problems.append("cancel_job should accept a queued job")
            u2.join(5)
            if JOBS["tr2"]["state"] != "cancelled" or "tr2" in order or "tr2" in jobs.CANCELLED:
                problems.append(f"a queued transcribe cancelled before it ran: {JOBS['tr2']} {order}")
            hold.set()
            u1.join(5)
        finally:
            jobs._render_body, jobs._transcribe_body, jobs._transcribe_needs_work = real_body, real_tbody, real_need
            hold.set()

        # --- the transcribe dedupe is by FILE: same name + other bytes = two keys; a hardlinked/identical copy = one
        src_a, src_b = paths.profile_dir("sa") / "sources", paths.profile_dir("sb") / "sources"
        src_a.mkdir(parents=True, exist_ok=True)
        src_b.mkdir(parents=True, exist_ok=True)
        (src_a / "episode.mp4").write_bytes(b"aaaa" * 100)
        (src_b / "episode.mp4").write_bytes(b"bbbbbb" * 100)                    # same name, another video
        (src_a / "twin.mp4").write_bytes(b"cccc" * 50)
        try:
            os.link(src_a / "twin.mp4", src_b / "twin.mp4")
        except OSError:
            shutil.copy2(src_a / "twin.mp4", src_b / "twin.mp4")
        keys = {}
        for pid in ("sa", "sb"):
            tok = paths.set_profile(pid)
            try:
                keys[pid] = (jobs.transcribe_key("episode.mp4"), jobs.transcribe_key("twin.mp4"), jobs.transcribe_key("nope.mp4"))
            finally:
                paths._profile.reset(tok)
        if keys["sa"][0] == keys["sb"][0]:
            problems.append("the same file NAME with different videos must not share a transcribe job")
        if keys["sa"][1] != keys["sb"][1]:
            problems.append("identical copies (same size + mtime) should share one transcribe job")
        if keys["sa"][2] == keys["sb"][2]:
            problems.append("a missing file must not share a key across profiles")
    finally:
        sched.set_render_limit(saved_limit)

    if problems:
        return FAIL, "\n      ".join(problems)
    return PASS, "AI jobs one at a time across profiles, renders 1 then 2, round-robin per batch item, waiting jobs show why and cancel, transcribe shared by file not name"


# --------------------------------------------------------------------------
# check: the transcript fallback (a transcript of another file with the same name is not reused)
# --------------------------------------------------------------------------

def check_fallback() -> tuple[str, str]:
    """Cache.find_transcript falls back to the newest transcript of the same file NAME only when it plausibly
    belongs to this file: same size, else the same duration (0.5 s); a transcript that records neither is
    refused. Another video with the same name (two profiles), an old transcript of a different length and one
    with no metadata give a fresh transcription; a touched copy and a re-muxed copy keep their transcript."""
    import os
    from .cache import Cache
    from .ffmpeg_tools import _require, run
    from .models import Transcript

    problems: list[str] = []
    ffmpeg = _require("ffmpeg")
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        cache = Cache(root / "cache")

        def make(folder: str, seconds: int, crf: str = "28") -> Path:
            d = root / folder
            d.mkdir(exist_ok=True)
            out = d / "episode.mp4"
            run([ffmpeg, "-y", "-loglevel", "error", "-f", "lavfi", "-i", f"testsrc=s=160x90:d={seconds}:r=10",
                 "-f", "lavfi", "-i", f"sine=f=330:d={seconds}", "-shortest", "-pix_fmt", "yuv420p", "-crf", crf, str(out)],
                desc="a test video", timeout=60)
            return out

        def store(name: str, duration: float, size: int) -> Path:
            p = cache.root / f"episode.{name}.transcript.json"
            Transcript(source="episode.mp4", duration=duration, language="id", model="m", segments=[],
                       source_size=size).save(p)
            return p

        a = make("a", 3)
        b = make("b", 7)
        a_size, b_size = a.stat().st_size, b.stat().st_size
        if a_size == b_size:
            problems.append("test setup: the two videos should differ in size")
        mine = store("mine", 3.0, a_size)

        got, why = cache.find_transcript_why(a)
        if got != mine:
            problems.append(f"the same video (same size) should find its transcript: {got} {why}")
        got, why = cache.find_transcript_why(b)
        if got is not None or not why or "duration" not in why[0]:
            problems.append(f"another video with the same name must not get it, and say why: {got} {why}")

        touched = root / "touched"
        touched.mkdir()
        tcopy = touched / "episode.mp4"
        shutil.copy2(a, tcopy)
        os.utime(tcopy, (time.time() + 99, time.time() + 99))
        if cache.find_transcript(tcopy) != mine:
            problems.append("a touched copy (same size, new mtime) should keep the transcript")

        remux = make("remux", 3, crf="40")                   # another size, the same length
        if remux.stat().st_size == a_size:
            problems.append("test setup: the re-encoded video should differ in size")
        if cache.find_transcript(remux) != mine:
            problems.append("a re-saved copy with another size but the same duration should keep the transcript")

        # a transcript with no size (made before sizes were kept): the duration decides
        mine.unlink()
        old = store("old", 3.0, 0)
        if cache.find_transcript(remux) != old:
            problems.append("an older transcript without a size but with the right duration should be accepted")
        if cache.find_transcript(b) is not None:
            problems.append("an older transcript without a size and another duration must be refused")
        # neither size nor duration: refused, with the reason
        old.unlink()
        bare = store("bare", 0.0, 0)
        got, why = cache.find_transcript_why(a)
        if got is not None or not why or "neither" not in why[0]:
            problems.append(f"a transcript that records neither size nor duration must be refused: {got} {why}")
        bare.unlink()
        # the exact one always wins, and a missing file cannot be compared
        from .paths import GLOSSARY
        exact = cache.transcript_path(a, "mm", "id", GLOSSARY if GLOSSARY.is_file() else None)
        Transcript(source="x", duration=99.0, language="id", model="mm", segments=[]).save(exact)
        if cache.find_transcript(a, "mm", "id") != exact:
            problems.append("the exact transcript must be used whatever it records")
        store("again", 3.0, a_size)
        if cache.find_transcript(root / "nowhere" / "episode.mp4") is not None:
            problems.append("without the file there is nothing to compare: no fallback")
        # new transcripts keep the size
        t = Transcript(source="x", duration=1.0, language="id", model="m", segments=[], source_size=1234)
        if Transcript.from_dict(t.to_dict()).source_size != 1234 or "source_size" not in t.to_dict():
            problems.append("a transcript must keep the size of its source through save and load")

    if problems:
        return FAIL, "\n      ".join(problems)
    return PASS, "same name + other video refused (with the reason), touched and re-muxed copies and old duration-only transcripts accepted, nothing recorded refused"


# --------------------------------------------------------------------------
# check: render progress (percent, stage weights, ETA), the layout words
# --------------------------------------------------------------------------

def check_progress() -> tuple[str, str]:
    """ffmpeg's -progress lines parsed, the percent split by stage weight and never above 99 before the end, throttled to
    about 4 a second, the time left (initial estimate, real pace, smoothing, hidden under 3 s), the batch's total, a real
    ffmpeg run reporting seconds (and the same bytes with the progress flags), cancel still killing it, and the layout
    words the same in Python and JS."""
    import hashlib
    import shutil
    import subprocess
    from . import progress as pg
    from . import jobs, render as engine
    from .ffmpeg_tools import _require

    problems: list[str] = []

    # --- parsing: a recorded sample of `ffmpeg -progress pipe:1`
    sample = """frame=48
fps=95.2
stream_0_0_q=-1.0
bitrate=N/A
total_size=N/A
out_time_us=1900000
out_time_ms=1900000
out_time=00:00:01.900000
dup_frames=0
drop_frames=0
speed=3.8x
progress=continue
frame=120
out_time_us=4800000
out_time=00:00:04.800000
progress=continue
out_time_us=N/A
out_time=N/A
progress=end
"""
    got = [pg.parse_progress_line(ln) for ln in sample.splitlines()]
    secs = [g for g in got if g is not None]
    if secs != [1.9, 1.9, 1.9, 4.8, 4.8]:
        problems.append(f"progress lines should give 1.9 (x3 spellings) and 4.8 (x2): {secs}")
    if pg.parse_progress_line("out_time=01:02:03.500000") != 3723.5 or pg.parse_progress_line("out_time_us=-9223372036854775807") is not None \
            or pg.parse_progress_line("speed=2x") is not None:
        problems.append("progress parsing: hours, negative and unrelated lines")

    # --- the percent: weights, cap, stages, throttle (a fake clock)
    def run(durations, runs, pass2, ticks_each=40, clip=0, step=0.05):
        clock = {"t": 100.0}
        seen: list[dict] = []
        p = pg.JobProgress(durations, None, seen.append, clock=lambda: clock["t"])
        for i in range(clip + 1):
            p.begin_clip(i, runs if i == clip else [durations[i]], pass2 if i == clip else False)
        return p, seen, clock

    p, seen, clock = run([10.0], [10.0], True)
    p.advance()                                           # the encode
    marks = {}
    for n in range(1, 41):
        clock["t"] += 0.05
        p.tick(10.0 * n / 40)
    marks["encoded"] = p.snapshot()["percent"]
    p.advance()                                           # the second pass
    for n in range(1, 41):
        clock["t"] += 0.05
        p.tick(10.0 * n / 40)
    marks["overlays"] = p.snapshot()["percent"]
    p.finish_clip()
    marks["finish"] = p.snapshot()
    if marks["encoded"] != 60 or marks["overlays"] != 99 or marks["finish"]["percent"] != 99 or marks["finish"]["stage"] != "finishing…":
        problems.append(f"with a second pass the encode is worth 60 % (2 + 98 x 0.6), the end holds 99 'finishing…': {marks}")
    percents = [s["percent"] for s in seen]
    if percents != sorted(percents) or max(percents) > 99:
        problems.append(f"the percent must only rise and never pass 99: {percents[-5:]}")
    if not 8 <= len(seen) <= 20:
        problems.append(f"80 ticks over 4 s should be throttled to about 4 a second: {len(seen)} updates")
    if "overlays…" not in {s["stage"] for s in seen} or "preparing…" not in {s["stage"] for s in seen}:
        problems.append(f"the stages preparing… and overlays… should show: {sorted({s['stage'] for s in seen})}")

    p, seen, clock = run([10.0], [10.0], False)
    p.advance()
    p.tick(10.0)
    if p.snapshot()["percent"] != 99:
        problems.append(f"without a second pass the full encode is 99, not 100: {p.snapshot()}")
    p, seen, clock = run([10.0], [6.0, 4.0], False)
    p.advance()
    p.tick(6.0)
    first = p.snapshot()["percent"]                       # 2 + (98 - 4) x 0.6 = 58.4
    p.advance()
    p.tick(4.0)
    p.advance()                                           # joining
    st = p.snapshot()
    if first != 58 or st["stage"] != "joining…" or st["percent"] != 96:
        problems.append(f"two pieces then the join (4): wanted 58 then 96 'joining…': {first} {st}")
    # several clips are weighed by their length
    p = pg.JobProgress([10.0, 30.0], None, lambda s: None)
    p.begin_clip(0, [10.0], False)
    p.advance()
    p.tick(10.0)
    p.finish_clip()
    p.begin_clip(1, [30.0], False)
    p.advance()
    p.tick(15.0)
    expect = int((10 + (2 + 98 * 0.5) / 100 * 30) / 40 * 100)
    if p.snapshot()["percent"] != expect:
        problems.append(f"two clips (10 s and 30 s), half way through the second: wanted {expect}, got {p.snapshot()['percent']}")

    # --- the time left
    e = pg.Eta(initial_total=40.0)
    first_eta = e.update(0.0, 0.0)
    early = e.update(1.0, 0.02)
    if first_eta != 40.0 or not 38 < early <= 40:
        problems.append(f"before ffmpeg says anything the time left is the profile's usual estimate: {first_eta} {early}")
    for k in range(1, 60):                                 # a steady pace: 10 s elapsed at 50 % -> 10 s left
        last = e.update(10.0, 0.5)
    if last is None or abs(last - 10.0) > 0.6:
        problems.append(f"the smoothed time left should settle on the real pace (10): {last}")
    e = pg.Eta(None)
    if e.update(1.0, 0.01) is not None:
        problems.append("without history nothing is shown before 5 % or 3 s")
    shown = e.update(3.5, 0.35)
    if shown is None or abs(shown - 6.5) > 0.01:
        problems.append(f"after 3 s the pace decides (3.5 s for 35 % -> 6.5 s left): {shown}")
    e = pg.Eta(None)
    e.update(10.0, 0.9)
    if e.update(10.0, 0.9) is not None:                    # 1.1 s left
        problems.append("under 3 s left is hidden")
    # smoothing: one slow tick does not make the estimate jump
    e = pg.Eta(None)
    for k in range(20):
        base = e.update(10.0, 0.5)
    jumped = e.update(10.0, 0.25)                          # a stall: raw says 30 s
    if base is None or jumped is None or jumped - base > 0.31 * (30 - 10) + 0.01:
        problems.append(f"one odd tick must not make the estimate jump: {base} -> {jumped}")
    # the batch's total
    if pg.batch_eta(20.0, 5.0, [30.0, 30.0], 0.5) != 50.0 or pg.batch_eta(None, 10.0, [30.0], 2.0) != 80.0 \
            or pg.batch_eta(None, 10.0, [30.0], None) is not None or pg.batch_eta(7.0, 5.0, [], None) != 7.0:
        problems.append("batch total: the running clip's time left + the queued clips' length x the usual speed")
    b = {"ratio": 2.0, "items": [{"state": "done", "duration": 10}, {"state": "running", "duration": 20, "percent": 50, "eta": 12},
                                 {"state": "queued", "duration": 15}, {"state": "queued", "duration": 5, "cancel": True}]}
    if jobs._batch_total_eta(b) != 42:                    # 12 (running) + 15 x 2 (the cancelled one does not count)
        problems.append(f"the batch's total left should be 42: {jobs._batch_total_eta(b)}")

    # --- a real ffmpeg: it reports seconds, the bytes are the same with the progress flags, cancel kills it
    ffmpeg = _require("ffmpeg")
    with tempfile.TemporaryDirectory() as tmp:
        base_cmd = [ffmpeg, "-y", "-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i", "testsrc=s=320x180:d=4:r=25",
                    "-f", "lavfi", "-i", "sine=f=300:d=4", "-shortest", "-c:v", "libx264", "-crf", "30", "-preset", "veryfast",
                    "-threads", "1", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "64k", "-movflags", "+faststart"]
        plain, with_flags = Path(tmp) / "plain.mp4", Path(tmp) / "flags.mp4"
        subprocess.run([*base_cmd, str(plain)], capture_output=True, check=True)
        marks_seen: list[float] = []
        code, err = engine._run_ffmpeg([*base_cmd, str(with_flags)], None, with_flags, marks_seen.append)
        if code != 0 or hashlib.sha256(plain.read_bytes()).hexdigest() != hashlib.sha256(with_flags.read_bytes()).hexdigest():
            problems.append(f"the progress flags must not change the encode: exit {code}, {err[-200:]}")
        if not marks_seen or marks_seen != sorted(marks_seen) or not 3.5 <= marks_seen[-1] <= 4.2:
            problems.append(f"ffmpeg's progress should report rising output seconds up to about 4: {marks_seen[-4:]}")
        stopped = Path(tmp) / "stopped.mp4"
        long_cmd = list(base_cmd)
        long_cmd[long_cmd.index("testsrc=s=320x180:d=4:r=25")] = "testsrc=s=1280x720:d=600:r=25"
        long_cmd[long_cmd.index("sine=f=300:d=4")] = "sine=f=300:d=600"
        seen_one = {"n": 0}

        def on(sec):
            seen_one["n"] += 1

        t0 = time.time()
        try:
            engine._run_ffmpeg([*long_cmd, str(stopped)], lambda: seen_one["n"] > 0, stopped, on)
            problems.append("cancel should stop a running ffmpeg")
        except engine.RenderCancelled:
            if time.time() - t0 > 20 or stopped.exists():
                problems.append("cancel should kill ffmpeg quickly and delete the partial file")

    # --- the layout words: the same in Python and JS
    cases = [("9:16", "blur", 50), ("16:9", "blur", 50), ("16:9", "blur", 0), ("3:4", "black", 100), ("16:9", "black", 30),
             ("16:9", "blur", 29.6), ("3:4", "blur", 75)]
    py = [jobs.layout_label(*c) for c in cases]
    want = ["9:16", "16:9 · blur bg · center", "16:9 · blur bg · top", "3:4 · black bg · bottom", "16:9 · black bg · pos 30%",
            "16:9 · blur bg · pos 30%", "3:4 · blur bg · pos 75%"]
    if py != want:
        problems.append(f"layout_label: {py}")
    node = shutil.which("node")
    if node:
        js = subprocess.run([node, "-e", "const {layoutLabel}=require('./ui/js/editor/renderlabels.js');"
                             f"console.log(JSON.stringify({json.dumps(cases)}.map(c=>layoutLabel(...c))))"],
                            capture_output=True, text=True, encoding="utf-8", cwd=str(ROOT), timeout=60)
        if js.returncode != 0 or json.loads(js.stdout) != py:
            problems.append(f"the JS layoutLabel must say what the server says: {js.stdout.strip()[:200]} {js.stderr.strip()[:100]}")

    if problems:
        return FAIL, "\n      ".join(problems)
    return PASS, "progress lines parsed, 60/40 weights, 99 held until done, ~4 updates/s, ETA initial/real/smoothed/hidden, batch total, same bytes with the flags, cancel kills ffmpeg, layout words match in Python and JS"


# --------------------------------------------------------------------------
# check: the selftest's own housekeeping (stale scratch folders)
# --------------------------------------------------------------------------

def check_facelock() -> tuple[str, str]:
    """The face detector is one native object shared by every request thread: several threads calling
    facebox._detect_faces at once (AI Framing asks the server for several speakers at a time) must not corrupt it.
    Run in a child process so a native crash fails this check instead of killing the selftest."""
    import subprocess
    import sys
    code = (
        "import threading, numpy as np\n"
        "from klipian import facebox as fb\n"
        "rng = np.random.default_rng(1)\n"
        "img = rng.integers(0, 255, (360, 640, 3), dtype=np.uint8)\n"
        "errs = []\n"
        "def work(k):\n"
        "    try:\n"
        "        for i in range(40):\n"
        "            fb._detect_faces(img[:, : 640 - (k * 37 + i * 5) % 200], 600, min_frac=0.03)\n"
        "    except Exception as exc:\n"
        "        errs.append(repr(exc))\n"
        "ts = [threading.Thread(target=work, args=(k,)) for k in range(6)]\n"
        "[t.start() for t in ts]; [t.join() for t in ts]\n"
        "print('ERR' if errs else 'OK', errs[:1])\n")
    proc = subprocess.run([sys.executable, "-X", "faulthandler", "-c", code], capture_output=True, text=True, timeout=300,
                          cwd=str(Path(__file__).resolve().parent.parent))
    if proc.returncode != 0 or not proc.stdout.startswith("OK"):
        return FAIL, f"6 threads in _detect_faces: exit {proc.returncode}: {(proc.stdout + proc.stderr)[-300:]}"
    return PASS, "6 threads x 40 calls of _detect_faces at different sizes, no error and no crash"


def check_shotframe() -> tuple[str, str]:
    """Shot framing's pure parts (facebox._choose_box, _merge_faces, _shot_bounds, _same_box): where the box goes
    for 0, 1, close and far faces, never outside the frame, short shots joined, near-equal boxes joined."""
    from . import facebox as fb

    problems = []
    W, H = 1920, 1080
    size = {"width": 42.19, "height": 100}                       # 3:4 out of 16:9
    cw = size["width"] / 100 * W

    def box(faces):
        return fb._choose_box(faces, W, H, size)

    def centre(b):
        return (b["left"] + b["width"] / 2) / 100 * W

    if abs(centre(box([])) - W / 2) > 2:
        problems.append("no faces: the box should be at the centre")
    pair = [{"cx": 800, "cy": 400, "w": 120}, {"cx": 1000, "cy": 420, "w": 110}]
    if abs(centre(box(pair)) - 900) > 3:
        problems.append(f"two close faces: should be centred on the group, got {centre(box(pair)):.0f}")
    far = [{"cx": 300, "cy": 400, "w": 160}, {"cx": 1600, "cy": 400, "w": 90}]
    if abs(centre(box(far)) - 300 - 0) > 3 and box(far)["left"] != 0:
        problems.append(f"two far faces: should follow the largest, got {box(far)}")
    tie = [{"cx": 300, "cy": 400, "w": 100}, {"cx": 1000, "cy": 400, "w": 100}]
    if abs(centre(box(tie)) - 1000) > 3:
        problems.append("two equal far faces: should take the one nearer the centre")
    small = [{"cx": 900, "cy": 400, "w": 120}, {"cx": 1850, "cy": 400, "w": 40}]
    if abs(centre(box(small)) - 900) > 3:
        problems.append("a small face far away should not pull the box")
    wide = [{"cx": 400, "cy": 400, "w": 90}, {"cx": 1500, "cy": 400, "w": 120}]
    if fb._fits(wide, W, size) or not fb._fits(pair, W, size):
        problems.append("_fits: far apart faces do not fit, close ones do")
    for x in (0, 10, 960, 1910, 1920):
        b = box([{"cx": x, "cy": 5, "w": 100}])
        if b["left"] < 0 or b["top"] < 0 or b["left"] + b["width"] > 100.01 or b["top"] + b["height"] > 100.01:
            problems.append(f"face at x={x}: the box left the frame: {b}")

    if fb._shot_bounds([5, 5.2, 9], 0, 12) != [(0, 5.2), (5.2, 9), (9, 12)]:
        problems.append(f"a 0.2 s shot should join the one before: {fb._shot_bounds([5, 5.2, 9], 0, 12)}")
    if fb._shot_bounds([5, 5.4, 9], 0, 12, [5, 5.4]) != [(0, 5), (5, 5.4), (5.4, 9), (9, 12)]:
        problems.append(f"a 0.4 s shot with a camera cut on both sides keeps its own segment: {fb._shot_bounds([5, 5.4, 9], 0, 12, [5, 5.4])}")
    if fb._shot_bounds([5, 5.4, 9], 0, 12, [5]) != [(0, 5.4), (5.4, 9), (9, 12)]:
        problems.append("a short segment with a cut on one side only still joins the one before it")
    if fb._shot_bounds([0.3], 0, 4) != [(0, 4)]:
        problems.append("a short first shot should join the next")
    if fb._shot_bounds([], 2, 8) != [(2, 8)]:
        problems.append("no cuts: one shot")
    if not fb._same_box({"left": 10, "top": 0}, {"left": 12, "top": 0}) or fb._same_box({"left": 10, "top": 0}, {"left": 20, "top": 0}):
        problems.append("_same_box should join boxes under 3 % apart only")

    seen = [[{"cx": 500, "cy": 300, "w": 80}], [{"cx": 506, "cy": 302, "w": 84}, {"cx": 1500, "cy": 300, "w": 80}],
            [{"cx": 494, "cy": 298, "w": 82}], [{"cx": 500, "cy": 300, "w": 80}]]
    people = fb._merge_faces(seen)
    if len(people) != 1 or abs(people[0]["cx"] - 500) > 8:
        problems.append(f"_merge_faces: one steady face and one seen once should leave one person, got {people}")

    # the decision per segment (AI Framing, speaker first): the box is always centred on one face
    three = [{"cx": 400, "cy": 400, "w": 90}, {"cx": 960, "cy": 400, "w": 90}, {"cx": 1500, "cy": 400, "w": 90}]
    emb = {id(three[0]): [1.0, 0.0, 0.0], id(three[1]): [0.0, 1.0, 0.0], id(three[2]): [0.0, 0.0, 1.0]}
    embed = lambda p: emb[id(p)]
    sim = lambda a, b: sum(x * y for x, y in zip(a, b))
    known = {"A": [[0.0, 0.0, 1.0]]}
    c, why = fb._decide(three, W, H, size, "A", known, None, True, embed, sim)
    if why != "speaker-face" or abs(centre(c) - 1500) > 12:
        problems.append(f"_decide: a wide shot of three should be centred on the recognised speaker, got {why} {centre(c):.0f}")
    r = [{**three[0], "av": 0.7}, {**three[1], "av": 0.1}, {**three[2], "av": 0.0}]
    emb.update({id(r[0]): [1.0, 0.0, 0.0], id(r[1]): [0.0, 1.0, 0.0], id(r[2]): [0.0, 0.0, 1.0]})
    kn2: dict = {}
    c, why = fb._decide(r, W, H, size, "B", kn2, None, True, embed, sim)
    if why != "av-sync" or abs(centre(c) - 400) > 12 or "B" not in kn2:
        problems.append(f"_decide: a clear av-sync winner is the speaker and is remembered, got {why} {kn2.keys()}")
    r2 = [{**three[0], "av": 0.7}, {**three[1], "av": 0.1}, {**three[2], "av": 0.0}]
    emb.update({id(r2[0]): [1.0, 0.0, 0.0], id(r2[1]): [0.0, 1.0, 0.0], id(r2[2]): [0.0, 0.0, 1.0]})
    c, why = fb._decide(r2, W, H, size, "A", {"A": [[0.0, 0.0, 1.0]]}, None, True, embed, sim)
    if why != "av-sync" or abs(centre(c) - 400) > 12 or not r2[0].get("conflict"):
        problems.append(f"_decide: av-sync wins over the recognised face and notes the conflict, got {why}")
    mid = [{**three[0], "av": 0.42}, {**three[1], "av": 0.13}, {**three[2], "av": 0.0}]
    emb.update({id(mid[0]): [1.0, 0.0, 0.0], id(mid[1]): [0.0, 1.0, 0.0], id(mid[2]): [0.0, 0.0, 1.0]})
    c, why = fb._decide(mid, W, H, size, "A", {"A": [[0.0, 0.0, 1.0]]}, None, True, embed, sim)
    if why != "speaker-face" or abs(centre(c) - 1500) > 12 or not mid[0].get("conflict"):
        problems.append(f"_decide: a clear but not very clear av-sync winner loses to the recognised face, conflict noted, got {why}")
    two_av = [{**three[0], "av": 0.42}, {**three[1], "av": 0.13}]
    emb.update({id(two_av[0]): [1.0, 0.0, 0.0], id(two_av[1]): [0.0, 1.0, 0.0]})
    c, why = fb._decide(two_av, W, H, size, "A", {}, None, True, embed, sim)
    if why != "av-sync":
        problems.append(f"_decide: without a recognised face the plain rule (0.25 / 0.10) holds, got {why}")
    # a clear av-sync win teaches the speaker's face only over enough seconds (a laughing listener follows the words too)
    kn_short, kn_long = {}, {}
    fb._decide(two_av, W, H, size, "A", kn_short, None, True, embed, sim, None, None, 2.0)
    fb._decide(two_av, W, H, size, "A", kn_long, None, True, embed, sim, None, None, 5.0)
    if kn_short or "A" not in kn_long:
        problems.append(f"_decide: an av-sync win teaches a face only in a segment of {fb.AV_LEARN_MIN} s or more, got {kn_short} / {list(kn_long)}")
    # pass 1: a face that does not move with the sound (a reaction shot) is no evidence
    quiet, talking = {"av": 0.04}, {"av": 0.6}
    if fb._speaking(None, 0, 3, quiet, 1920, 1080, "", "") or not fb._speaking(None, 0, 3, talking, 1920, 1080, "", ""):
        problems.append("_speaking: the face must move with the sound to be pass-1 evidence")
    unclear = [{**three[0], "av": 0.3}, {**three[1], "av": 0.25}, {**three[2], "av": 0.0}]
    emb.update({id(unclear[0]): [1.0, 0.0, 0.0], id(unclear[1]): [0.0, 1.0, 0.0], id(unclear[2]): [0.0, 0.0, 1.0]})
    c, why = fb._decide(unclear, W, H, size, "A", {"A": [[0.0, 0.0, 1.0]]}, None, True, embed, sim)
    if why != "speaker-face" or abs(centre(c) - 1500) > 12:
        problems.append(f"_decide: no clear av-sync winner falls to the recognised face, got {why}")
    weak = [{**three[0], "av": 0.2}, {**three[1], "av": 0.0}]
    if fb._av_winner(weak) is not None:
        problems.append("_av_winner: a score under 0.25 is no winner")
    c, why = fb._decide(three, W, H, size, "C", {}, None, True, embed, sim)
    if why != "largest":
        problems.append(f"_decide: no clue about the speaker is the largest face, got {why}")
    c, why = fb._decide([three[1]], W, H, size, "C", {}, None, True, embed, sim)
    if why != "single" or abs(centre(c) - 960) > 3:
        problems.append(f"_decide: one face is single, got {why}")
    prev = box([{"cx": 300, "cy": 400, "w": 100}])
    c, why = fb._decide(three, W, H, size, "A", {"A": [[-1.0, -1.0, -1.0]]}, prev, False, embed, sim)
    if why != "kept" or c != prev:
        problems.append(f"_decide: a known speaker out of view in the same shot keeps the box, got {why}")
    c, why = fb._decide(three, W, H, size, "A", {"A": [[-1.0, -1.0, -1.0]]}, prev, True, embed, sim)
    if why != "largest":
        problems.append(f"_decide: a known speaker out of view in a new shot is the largest, got {why}")
    if fb._decide([], W, H, size, "A", {}, prev, False, embed, sim) != (prev, "kept") or fb._decide([], W, H, size, "A", {}, None, True, embed, sim)[1] != "center":
        problems.append("_decide: no faces is kept, or center for the first segment")
    # the first pass: evidence per speaker, a face two speakers claim stays with the one with more evidence
    ev = {"A": [[1.0, 0.0], [1.0, 0.0]], "B": [[1.0, 0.0]], "C": [[0.0, 1.0]]}
    kn = fb._learn_faces(ev, lambda a, b: a[0] * b[0] + a[1] * b[1])
    if sorted(kn) != ["A", "C"]:
        problems.append(f"_learn_faces: B claims A's face with less evidence and loses it, got {sorted(kn)}")
    if len(fb._main_faces(three + [{"cx": 5, "cy": 5, "w": 20}])) != 3:
        problems.append("_main_faces: a small far face is not a main face")
    # a wide TV shot: five people in front, an audience a row up behind them (smaller, much higher in the frame)
    front5 = [{"cx": 300 + 250 * i, "cy": 600 + 20 * (i % 2), "w": 70} for i in range(5)]
    crowd = [{"cx": 100 + 90 * i, "cy": 300, "w": 40} for i in range(20)]
    got = fb._main_faces(front5 + crowd)
    if sorted(f["cx"] for f in got) != sorted(f["cx"] for f in front5):
        problems.append(f"_main_faces: the audience behind the front row is dropped, got {len(got)} faces")
    if len(fb._main_faces([{"cx": 50 * i, "cy": 500, "w": 60} for i in range(12)])) != fb.MAX_MAIN_FACES:
        problems.append("_main_faces: the count of people is capped")
    near = [{"cx": 100, "cy": 500, "w": 80}, {"cx": 400, "cy": 440, "w": 60}]        # taller person, same row
    if len(fb._main_faces(near)) != 2:
        problems.append("_main_faces: someone a little higher in the same row stays")
    if not fb._alone_in_turn(0, 10, "A", [{"start": 0, "end": 10.5, "speaker": "A"}]) or fb._alone_in_turn(0, 10, "A", [{"start": 0, "end": 6, "speaker": "A"}, {"start": 6, "end": 10, "speaker": "B"}]):
        problems.append("_alone_in_turn: the segment must lie in one speaker's turn")
    segs = fb._segments([20.0], [{"start": 0, "end": 21.5, "speaker": "A"}, {"start": 21.5, "end": 40, "speaker": "B"}], 0, 40)
    if [(a, b, s) for a, b, s in segs] != [(0, 20.0, "A"), (20.0, 40, "B")]:
        problems.append(f"_segments: a turn starting within 2 s after a cut starts at the cut, got {segs}")
    segs = fb._segments([], [{"start": 0, "end": 10, "speaker": "A"}, {"start": 10, "end": 30, "speaker": "B"}], 0, 30)
    if [(a, b, s) for a, b, s in segs] != [(0, 10, "A"), (10, 30, "B")]:
        problems.append(f"_segments: a change of speaker is a boundary, got {segs}")

    # movement matched to the sound (synthetic arrays)
    import numpy as np
    rng = np.random.default_rng(3)
    n = 60
    env = np.abs(np.sin(np.arange(n) / 4.0)) + 0.05
    follows = env * 3 + rng.normal(0, 0.2, n)                   # moves with the sound
    random = rng.normal(0, 1, n) + 2.0                           # moves, but not with it
    glob = np.full(n, 1.0)
    sc = fb._av_core([follows, random], [follows, random], glob, env)
    if not sc or sc[0] < 0.25 or sc[0] - sc[1] < 0.1:
        problems.append(f"_av_core: the face moving with the sound should win clearly, got {sc}")
    g2 = glob.copy()
    g2[10:20] = 40.0                                             # a camera move: those steps are dropped
    spoiled = follows.copy()
    spoiled[10:20] = 200.0
    sc2 = fb._av_core([spoiled, random], [spoiled, random], g2, env)
    if not sc2 or sc2[0] < 0.25:
        problems.append(f"_av_core: steps with big global movement should be left out, got {sc2}")
    if fb._av_core([follows], [follows], glob, np.zeros(n)) is not None or fb._av_core([follows[:5]], [follows[:5]], glob[:5], env[:5]) is not None:
        problems.append("_av_core: silence or too little data is no score")
    box = {"left": 20.0, "top": 0.0, "width": 40.0, "height": 100.0}
    if not fb._face_in_box({"cx": 800, "cy": 400, "w": 100}, box, 1920, 1080) or fb._face_in_box({"cx": 1140, "cy": 400, "w": 100}, box, 1920, 1080):
        problems.append("_face_in_box: a speaker whole in the box keeps it, one half out of it does not")
    # small faces (the mouth cannot be read): the body decides, and its window reaches further down
    mouth_only = follows * 0 + rng.normal(0, 1, n)
    sc3 = fb._av_core([mouth_only, random], [follows, random], glob, env, [fb.AV_MOUTH_SMALL, fb.AV_MOUTH_SMALL])
    sc4 = fb._av_core([mouth_only, random], [follows, random], glob, env, [0.5, 0.5])
    if not sc3 or not sc4 or sc3[0] - sc3[1] <= sc4[0] - sc4[1]:
        problems.append(f"_av_core: with a small face the body should weigh more, got {sc3} vs {sc4}")
    tall = fb._body_windows([{"cx": 400, "cy": 300, "w": 60}], 1920, 1080)[0]
    short = fb._body_windows([{"cx": 400, "cy": 300, "w": 150}], 1920, 1080)[0]
    if (tall[3] - tall[1]) / 60 <= (short[3] - short[1]) / 150:
        problems.append("_body_windows: a small face's body window is taller in face heights (people stand full length)")
    two = [{"cx": 400, "cy": 300, "w": 100}, {"cx": 700, "cy": 300, "w": 100}]
    win = fb._body_windows(two, 1920, 1080)
    if win[0][2] > 550 or win[1][0] < 550 or win[0][1] < 300:
        problems.append(f"_body_windows: a window must stop at the middle between faces and start below the face, got {win}")
    same = lambda a, b: 1.0 if a == b else 0.0
    items = [(0, "A"), (1, "A"), (2, "B"), (3, "B"), (4, "C")]
    if fb._count_people(items, same) != 2:
        problems.append("_count_people: someone seen in one segment only is not counted")
    if fb._count_people(items[:4] + [(4, "C", True)], same) != 3:
        problems.append("_count_people: a close-up identity counts after one segment")
    if fb._count_people(items + [(5, "C")], same) != 3:
        problems.append("_count_people: three people seen in two segments each")

    import inspect
    if inspect.signature(fb._detect_faces).parameters["min_frac"].default != 0.15:
        problems.append("_detect_faces must keep its 0.15 default")
    if problems:
        return FAIL, "\n      ".join(problems)
    return PASS, "box at the centre / on the group / on the largest, never outside the frame, short shots and near boxes joined, faces merged across frames"


def check_labelbox() -> tuple[str, str]:
    """Boxed Timeline labels (compose.build_label_ass): one rounded box round the wrapped text, always inside the
    frame whatever x and y are, the light and dark styles, the libass fallback without Pillow, and labels without
    a box written exactly as before."""
    import re
    from . import compose, render

    problems = []
    W, H = compose.REF_W, compose.REF_H

    def label(**kw):
        base = {"kind": "text", "start": 0, "end": 3, "text": "Satu", "x": 50, "y": 20, "size": 72, "box": True}
        return compose.clean_elements([{**base, **kw}], 10, Path("."))

    def boxes(ass):
        """The (x0, y0, x1, y1) of each drawn box: the extremes of every number of its \\p1 path."""
        out = []
        for m in re.finditer(r"\\p1\}([^{]+)", ass):
            n = [int(v) for v in re.findall(r"-?\d+", m.group(1))]
            xs, ys = n[0::2], n[1::2]
            out.append((min(xs), min(ys), max(xs), max(ys)))
        return out

    twelve = " ".join(["kata"] * 12)
    cases = [("12 words at x=50", dict(text=twelve, x=50)), ("x=10", dict(text=twelve, x=10)),
             ("x=90", dict(text=twelve, x=90)), ("y=2", dict(text=twelve, y=2)), ("y=98", dict(text=twelve, y=98)),
             ("one very long word", dict(text="Supercalifragilisticexpialidocious" * 2, x=90, y=90))]
    for what, kw in cases:
        try:
            found = boxes(compose.build_label_ass(label(**kw)))
        except Exception as exc:                                   # noqa: BLE001
            problems.append(f"{what}: raised {exc!r}")
            continue
        if len(found) != 1 or not all(0 <= x0 and x1 <= W and 0 <= y0 and y1 <= H for x0, y0, x1, y1 in found):
            problems.append(f"{what}: the box is not one box inside the frame: {found}")
    if compose.build_label_ass(label(text=twelve, x=50)).count("\\N") < 1:
        problems.append("12 words at size 72 should wrap onto several lines")

    # the two styles, an old label without one, and a made-up value
    def box_colour(**kw):
        m = re.search(r"\\1c&H(\w+)&\\1a&H(\w+)&\\p1", compose.build_label_ass(label(**kw)))
        return m.groups() if m else None
    if box_colour(boxStyle="light", color="#111111") != ("FFFFFF", "1A"):
        problems.append("boxStyle light should draw a white box")
    if box_colour() != ("000000", "4C") or box_colour(boxStyle="pink") != ("000000", "4C"):
        problems.append("a label without boxStyle, or with a made-up one, should stay the dark box")
    if "&H00111111&" not in compose.build_label_ass(label(boxStyle="light", color="#111111")):
        problems.append("the light box should carry its dark text colour")

    # without Pillow or the font: libass's own box, with margins that keep it inside the frame
    real = render._measure
    render._measure = lambda *a, **k: None
    try:
        for x in (10, 50, 90):
            ass = compose.build_label_ass(label(text=twelve, x=x))
            m = re.search(r"LabelBox,,(\d+),(\d+),0,,\{\\an5\\pos\((\d+),", ass)
            if not m or int(m.group(1)) + int(m.group(2)) > W - compose.LABEL_MIN_TEXT * W:
                problems.append(f"fallback at x={x}: margins {m and m.groups()}")
        if "LabelBoxLight" not in compose.build_label_ass(label(boxStyle="light")):
            problems.append("the fallback ignored the light style")
    finally:
        render._measure = real

    # a label without a box: the same line as before, and none of the new styles
    plain = compose.build_label_ass(label(box=False, x=30, y=40, color="#FFD600"))
    want = "Dialogue: 2,0:00:00.00,0:00:03.00,Label,,0,0,0,,{\\an5\\pos(324,768)\\fs72\\c&H0000D6FF&}Satu"
    if want not in plain or "LabelBack" in plain or "LabelBoxLight" in plain:
        problems.append(f"a label without a box changed: {plain.splitlines()[-1]}")
    if problems:
        return FAIL, "\n      ".join(problems)
    return PASS, "one rounded box inside the frame at x 10/50/90, y 2/98 and a very long word, light/dark/made-up styles, libass fallback margins, plain labels unchanged"


def check_scratch() -> tuple[str, str]:
    """Scratch workspaces of killed runs are swept (older than an hour and not owned by a running process), a live
    run's folder and a fresh one are not, and a hardlink inside one is removed without touching its original."""
    import os
    problems: list[str] = []
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        now = time.time()

        def make(name: str, age_s: float, pid: int | None) -> Path:
            d = root / name
            d.mkdir()
            (d / "x.txt").write_text("x", encoding="utf-8")
            if pid is not None:
                (d / ".selftest.pid").write_text(str(pid), encoding="utf-8")
            os.utime(d, (now - age_s, now - age_s))
            return d

        original = root / "original.mp4"
        original.write_bytes(b"video")
        old_dead = make(".selftest-olddead", 7200, 4_000_000)           # no such process
        old_nopid = make(".selftest-oldnopid", 7200, None)
        old_live = make(".selftest-oldlive", 7200, os.getpid())         # this very process: alive
        fresh = make(".selftest-fresh", 60, 4_000_000)
        other = make("not-a-scratch", 7200, None)
        try:
            os.link(original, old_dead / "link.mp4")
        except OSError:
            shutil.copy2(original, old_dead / "link.mp4")
            os.utime(old_dead, (now - 7200, now - 7200))
        os.utime(old_dead, (now - 7200, now - 7200))
        removed = sweep_stale_scratch(root, now)
        if sorted(removed) != [".selftest-olddead", ".selftest-oldnopid"] or old_dead.exists() or old_nopid.exists():
            problems.append(f"old folders of dead runs should be removed: {removed}")
        if not old_live.exists() or not fresh.exists() or not other.exists():
            problems.append("a live run's folder, a fresh one and any other folder must stay")
        if original.read_bytes() != b"video":
            problems.append("removing a hardlink must leave the original alone")
        if not _pid_alive(os.getpid()) or _pid_alive(4_000_000) or _pid_alive(0):
            problems.append("_pid_alive should know this process from a missing one")
    if problems:
        return FAIL, "\n      ".join(problems)
    return PASS, "stale .selftest-* folders swept (old and not alive), live and fresh ones kept, hardlinks harmless"
