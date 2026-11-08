"""The Gemini API key and model, global for every profile (set on the Admin page).

The key is typed by the person in Admin settings and kept in workspace/secrets/gemini.json. It is never sent to
the browser: the page only gets `status()` (a hint of the last four characters). The official `google-genai` SDK
is imported only when a call is made, and every function that talks to Google takes an optional `client`, so the
tests use a fake one and need neither the SDK nor a network.
"""

from __future__ import annotations

import json
import os
from pathlib import Path

from . import paths

PACKAGE = "google-genai"


class GeminiError(Exception):
    """A problem to show to the person; `code` is for the page."""

    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code, self.message = code, message


def install_command() -> str:
    return f"pip install {PACKAGE}"


def _file() -> Path:
    return Path(paths.WORKSPACE) / "secrets" / "gemini.json"


def load_settings() -> dict:
    try:
        data = json.loads(_file().read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}
    return data if isinstance(data, dict) else {}


def _write(data: dict) -> None:
    f = _file()
    f.parent.mkdir(parents=True, exist_ok=True)
    tmp = f.with_suffix(".tmp")
    tmp.write_text(json.dumps(data, indent=1), encoding="utf-8")
    os.replace(tmp, f)


def save_settings(*, api_key: str | None = None, remove_key: bool = False, model: str | None = None) -> None:
    data = load_settings()
    if remove_key:
        data.pop("apiKey", None)
    if api_key is not None and api_key.strip():
        data["apiKey"] = api_key.strip()
        data.pop("lastError", None)
    if model is not None:
        if model.strip():
            data["model"] = model.strip()
        else:
            data.pop("model", None)
    _write(data)


def set_last_error(message: str) -> None:
    """The last problem a call to Google had (empty: it worked), shown on the Admin page."""
    data = load_settings()
    if message:
        data["lastError"] = message
    else:
        data.pop("lastError", None)
    _write(data)


def sdk_available() -> bool:
    try:
        import google.genai  # noqa: F401
    except ImportError:
        return False
    return True


def status() -> dict:
    """What the page may know: never the key itself."""
    s = load_settings()
    key = s.get("apiKey") or ""
    return {"sdk": sdk_available(), "hasKey": bool(key), "keyHint": ("…" + key[-4:]) if len(key) >= 8 else ("…" if key else ""),
            "model": s.get("model") or "", "lastError": s.get("lastError") or "", "command": install_command()}


def _client():
    key = load_settings().get("apiKey")
    if not key:
        raise GeminiError("no_key", "There is no Gemini API key yet: paste one from Google AI Studio.")
    try:
        from google import genai
    except ImportError:
        raise GeminiError("sdk", f"The Google SDK is not installed. Run: {install_command()}") from None
    return genai.Client(api_key=key)


def map_error(exc: BaseException) -> GeminiError:
    """Google's errors in plain words. `code` is the HTTP status the SDK puts on its errors."""
    status = getattr(exc, "code", None)
    text = str(getattr(exc, "message", "") or exc)
    low = text.lower()
    if status == 429 or "resource_exhausted" in low or "quota" in low:
        return GeminiError("quota", "Gemini says the quota is used up. Wait a while and try again, or check the plan in AI Studio.")
    if status in (401, 403) or "api key not valid" in low or "api_key_invalid" in low or "permission_denied" in low:
        return GeminiError("bad_key", "Google does not accept this API key. Make a new one in AI Studio (aistudio.google.com).")
    if status == 404:
        return GeminiError("model", "That model is not available to this account.")
    if isinstance(exc, GeminiError):
        return exc
    return GeminiError("failed", f"Gemini could not be reached: {text[:300]}")


def list_models(client=None) -> list[dict]:
    """The account's Gemini models that can write text, newest names first: [{id, name}]."""
    client = client or _client()
    try:
        raw = list(client.models.list())
    except GeminiError:
        raise
    except Exception as exc:                                  # noqa: BLE001
        raise map_error(exc) from None
    out = []
    for m in raw:
        mid = str(getattr(m, "name", "") or "").removeprefix("models/")
        actions = getattr(m, "supported_actions", None)
        if mid.startswith("gemini-") and (actions is None or "generateContent" in actions):
            out.append({"id": mid, "name": getattr(m, "display_name", "") or mid})
    out.sort(key=lambda m: m["id"], reverse=True)
    return out


def test_key(client=None) -> dict:
    """Ask Google for the model list: does it accept the key, and is the chosen model among them? The result
    (or the problem) is also kept as the last error."""
    try:
        models = list_models(client)
    except GeminiError as err:
        set_last_error(err.message)
        raise
    chosen = load_settings().get("model") or ""
    if chosen and chosen not in {m["id"] for m in models}:
        note = f"The key works ({len(models)} models), but {chosen} is not one of them: choose another model."
    else:
        note = f"The key works ({len(models)} models)."
    set_last_error("")
    return {"note": note, "models": models}
