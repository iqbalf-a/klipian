"""The YouTube account of a profile (P21-C): connect, check, disconnect. Upload (P16) builds on it.

Per profile, in profiles/<id>/secrets/:
    client_secret.json   the OAuth client (type "installed", i.e. "Desktop app") of THAT
                         channel's Google Cloud project; workspace/secrets/ is only a fallback
    youtube.json         the token, and what klipian knows about the channel

Rules this module keeps:
  * the token and the client secret are never returned to the browser, logged or printed:
    callers get status() (a state and the channel's label), nothing else;
  * one channel belongs to one profile: connecting a channel another profile already has is
    refused;
  * every call that leaves this computer goes through the four functions of `_net` below
    (flow, refresh, channels, revoke), so tests replace those and never reach Google.
"""

from __future__ import annotations

import json
import threading
import time
import uuid
from pathlib import Path

from . import paths
from .paths import GUEST

SCOPES = ("https://www.googleapis.com/auth/youtube.upload",
          "https://www.googleapis.com/auth/youtube.readonly")

# What status() says. "none": no token; "ok": linked and checked; "expired": the token was
# refused (invalid_grant: a "Testing" project's token lasts about 7 days, or access was
# revoked); "different": the token is valid but for another channel than the saved one;
# "no_client": client_secret.json is missing or not usable; "not_test_user": Google refused
# the sign-in because the account is not a test user; "offline": could not ask Google.
STATES = ("none", "ok", "expired", "different", "no_client", "not_test_user", "offline", "no_library")


class YouTubeError(Exception):
    """A failure with a state (see STATES) and a sentence for the person."""

    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code
        self.message = message


# --------------------------------------------------------------------------
# files
# --------------------------------------------------------------------------

def client_path() -> Path | None:
    """This profile's client_secret.json, else the shared fallback."""
    own = Path(paths.SECRETS / "client_secret.json")
    if own.is_file():
        return own
    shared = paths.workspace_dir() / "secrets" / "client_secret.json"
    return shared if shared.is_file() else None


def token_path() -> Path:
    return Path(paths.SECRETS / "youtube.json")


def validate_client_secret(data) -> dict:
    """The OAuth client of a Desktop app: an `installed` object with a client_id ending in
    .apps.googleusercontent.com. Returns it; raises YouTubeError("no_client") otherwise.
    (The message never contains the secret.)"""
    inst = data.get("installed") if isinstance(data, dict) else None
    if not isinstance(inst, dict):
        raise YouTubeError("no_client", "This is not a Desktop app client: the file has no \"installed\" part. "
                           "In Google Cloud, create an OAuth client of type Desktop app and download its JSON.")
    cid = str(inst.get("client_id") or "")
    if not cid.endswith(".apps.googleusercontent.com"):
        raise YouTubeError("no_client", "The client_id does not end in .apps.googleusercontent.com: "
                           "this is not the JSON of an OAuth client.")
    if not inst.get("client_secret"):
        raise YouTubeError("no_client", "The file has no client_secret.")
    return inst


def save_client_secret(text: str) -> None:
    """Take the contents of a client_secret.json the person chose, check them, and keep
    them for THIS profile."""
    if paths.current_profile() == GUEST:
        raise YouTubeError("no_client", "The Guest has no YouTube account.")
    try:
        data = json.loads(text)
    except ValueError:
        raise YouTubeError("no_client", "That file is not valid JSON.") from None
    validate_client_secret(data)
    dest = Path(paths.SECRETS / "client_secret.json")
    dest.parent.mkdir(parents=True, exist_ok=True)
    tmp = dest.with_suffix(".tmp")
    tmp.write_text(json.dumps(data), encoding="utf-8")
    tmp.replace(dest)


def _load_token_file() -> dict | None:
    f = token_path()
    try:
        data = json.loads(f.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None
    return data if isinstance(data, dict) and isinstance(data.get("token"), dict) else None


def _write_token_file(data: dict) -> None:
    f = token_path()
    f.parent.mkdir(parents=True, exist_ok=True)
    tmp = f.with_suffix(".tmp")
    tmp.write_text(json.dumps(data), encoding="utf-8")
    tmp.replace(f)


def _other_profile_with(channel_id: str) -> str | None:
    """The name of ANOTHER profile that is linked to this channel, if any."""
    from . import profiles
    me = paths.current_profile()
    for meta in profiles.list_profiles():
        if meta["id"] == me:
            continue
        f = paths.profile_dir(meta["id"]) / "secrets" / "youtube.json"
        try:
            other = json.loads(f.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            continue
        if isinstance(other, dict) and (other.get("channel") or {}).get("id") == channel_id:
            return meta["name"]
    return None


# --------------------------------------------------------------------------
# the only code that talks to Google (tests replace these four)
# --------------------------------------------------------------------------

class _Net:
    @staticmethod
    def flow(client_file: Path) -> dict:
        """Sign in in the browser (OAuth loopback) and return the token info."""
        try:
            from google_auth_oauthlib.flow import InstalledAppFlow
        except ImportError:
            raise YouTubeError("no_library", "Install the YouTube packages: "
                               ".venv\\Scripts\\python.exe -m pip install -r requirements-youtube.txt") from None
        flow = InstalledAppFlow.from_client_secrets_file(str(client_file), list(SCOPES))
        try:
            creds = flow.run_local_server(port=0, open_browser=True, timeout_seconds=300,
                                          success_message="klipian is connected. You can close this tab.")
        except Exception as exc:                       # noqa: BLE001
            text = str(exc).lower()
            if "access_denied" in text or "access denied" in text:
                raise YouTubeError("not_test_user", "Google refused the sign-in (access_denied). While the "
                                   "project is in Testing, add this Google account as a test user "
                                   "(Google Auth Platform > Audience > Test users).") from None
            raise YouTubeError("other", f"Sign-in did not finish: {type(exc).__name__}") from None
        return json.loads(creds.to_json())

    @staticmethod
    def refresh(token: dict) -> dict:
        """The token info, refreshed if it needs it. invalid_grant -> YouTubeError("expired")."""
        try:
            from google.oauth2.credentials import Credentials
            from google.auth.transport.requests import Request
            from google.auth.exceptions import RefreshError, TransportError
        except ImportError:
            raise YouTubeError("no_library", "Install the YouTube packages: "
                               ".venv\\Scripts\\python.exe -m pip install -r requirements-youtube.txt") from None
        creds = Credentials.from_authorized_user_info(token, list(SCOPES))
        try:
            if not creds.valid:
                creds.refresh(Request())
        except RefreshError as exc:
            if "invalid_grant" in str(exc):
                raise YouTubeError("expired", "Google no longer accepts this connection (a Testing project's "
                                   "token lasts about 7 days, or access was revoked). Connect again.") from None
            raise YouTubeError("other", "Google refused to refresh the connection.") from None
        except (TransportError, OSError):
            raise YouTubeError("offline", "Could not reach Google.") from None
        return json.loads(creds.to_json())

    @staticmethod
    def channels(token: dict) -> dict:
        """channels.list mine=true -> {id, title, thumb}."""
        try:
            from googleapiclient.discovery import build
            from googleapiclient.errors import HttpError
            from google.oauth2.credentials import Credentials
        except ImportError:
            raise YouTubeError("no_library", "Install the YouTube packages.") from None
        creds = Credentials.from_authorized_user_info(token, list(SCOPES))
        try:
            reply = build("youtube", "v3", credentials=creds, cache_discovery=False).channels().list(
                part="snippet", mine=True).execute()
        except HttpError as exc:
            status = getattr(getattr(exc, "resp", None), "status", 0)
            if status in (401,):
                raise YouTubeError("expired", "Google no longer accepts this connection. Connect again.") from None
            raise YouTubeError("other", f"YouTube answered {status}.") from None
        except OSError:
            raise YouTubeError("offline", "Could not reach Google.") from None
        items = reply.get("items") or []
        if not items:
            raise YouTubeError("other", "This Google account has no YouTube channel.")
        sn = items[0].get("snippet") or {}
        thumbs = sn.get("thumbnails") or {}
        thumb = (thumbs.get("default") or thumbs.get("medium") or {}).get("url") or ""
        return {"id": items[0]["id"], "title": sn.get("title") or "", "thumb": thumb}

    @staticmethod
    def revoke(token: dict) -> None:
        """Ask Google to cancel the token. OSError when it cannot be reached."""
        import urllib.parse
        import urllib.request
        value = token.get("refresh_token") or token.get("token")
        if not value:
            return
        req = urllib.request.Request("https://oauth2.googleapis.com/revoke",
                                     urllib.parse.urlencode({"token": value}).encode(),
                                     {"Content-Type": "application/x-www-form-urlencoded"})
        urllib.request.urlopen(req, timeout=15).read()


_net = _Net


# --------------------------------------------------------------------------
# what the pages and the upload use
# --------------------------------------------------------------------------

def _public(state: str, message: str = "", channel: dict | None = None, checked: int | None = None) -> dict:
    """What may go to the browser: a state, a sentence, the channel's label. Never a token."""
    return {"state": state, "message": message, "checkedAt": checked,
            "channel": ({"title": channel.get("title", ""), "id": channel.get("id", ""),
                         "thumb": channel.get("thumb", "")} if channel else None),
            "hasClient": client_path() is not None}


def status() -> dict:
    """The last known state of this profile's YouTube account (no network)."""
    if paths.current_profile() == GUEST:
        raise YouTubeError("none", "The Guest has no YouTube account.")
    saved = _load_token_file()
    if not saved:
        return _public("none" if client_path() else "no_client",
                       "" if client_path() else "Choose this channel's client_secret.json first.")
    return _public(saved.get("state") or "ok", saved.get("message") or "", saved.get("channel"), saved.get("checkedAt"))


def _remember(saved: dict, state: str, message: str = "") -> dict:
    saved["state"], saved["message"], saved["checkedAt"] = state, message, int(time.time())
    _write_token_file(saved)
    return _public(state, message, saved.get("channel"), saved["checkedAt"])


def check() -> dict:
    """Refresh the token and ask YouTube whose it is (channels.list mine=true): the state
    the settings page shows, the chip's dot, and what an upload checks first."""
    saved = _load_token_file()
    if not saved:
        return status()
    if client_path() is None:
        return _remember(saved, "no_client", "client_secret.json is missing: choose it again.")
    try:
        saved["token"] = _net.refresh(saved["token"])
        channel = _net.channels(saved["token"])
    except YouTubeError as exc:
        if exc.code == "offline":                    # keep the last state; just say it could not be checked
            return _public(saved.get("state") or "ok", exc.message, saved.get("channel"), saved.get("checkedAt")) | {"offline": True}
        return _remember(saved, exc.code, exc.message)
    known = saved.get("channel") or {}
    if known.get("id") and channel["id"] != known["id"]:
        saved["channel_seen"] = channel
        return _remember(saved, "different", f"This connection now belongs to {channel['title']}, "
                         f"not {known.get('title', 'the saved channel')}. Connect again to accept it.")
    saved["channel"] = channel
    return _remember(saved, "ok", "")


def disconnect() -> dict:
    """Revoke the token at Google, then send youtube.json to the Recycle Bin. When Google
    cannot be reached the token is still dropped from this profile, and the message says so."""
    from .recycle import to_recycle_bin
    saved = _load_token_file()
    note = ""
    if saved:
        try:
            _net.revoke(saved["token"])
        except OSError:
            note = "Disconnected here, but Google could not be reached to cancel the token: " \
                   "remove klipian under myaccount.google.com/permissions."
        to_recycle_bin(token_path())
    out = status()
    out["message"] = note
    return out


# --------------------------------------------------------------------------
# connecting (a background job: the person signs in in the browser tab klipian opens)
# --------------------------------------------------------------------------

_JOBS: dict[str, dict] = {}
_JOBS_LOCK = threading.Lock()


def start_connect() -> str:
    """Begin the sign-in. Returns a job id; connect_state(id) tells how it went."""
    if paths.current_profile() == GUEST:
        raise YouTubeError("none", "The Guest has no YouTube account.")
    client = client_path()
    if client is None:
        raise YouTubeError("no_client", "Choose this channel's client_secret.json first.")
    validate_client_secret(json.loads(client.read_text(encoding="utf-8")))
    jid = uuid.uuid4().hex[:10]
    with _JOBS_LOCK:
        _JOBS[jid] = {"state": "waiting", "message": "Sign in with Google in the tab that opened.", "profile": paths.current_profile()}

    def run() -> None:
        try:
            token = _net.flow(client)
            channel = _net.channels(token)
            other = _other_profile_with(channel["id"])
            if other:
                raise YouTubeError("different", f"Channel {channel['title']} is already used by the profile {other}.")
            saved = {"token": token, "channel": channel}
            result = _remember(saved, "ok", "")
            with _JOBS_LOCK:
                _JOBS[jid] = {"state": "done", "status": result}
        except YouTubeError as exc:
            with _JOBS_LOCK:
                _JOBS[jid] = {"state": "failed", "code": exc.code, "message": exc.message}
        except Exception as exc:                       # noqa: BLE001
            with _JOBS_LOCK:
                _JOBS[jid] = {"state": "failed", "code": "other", "message": f"Connecting failed ({type(exc).__name__})."}

    import contextvars
    threading.Thread(target=contextvars.copy_context().run, args=(run,), daemon=True).start()
    return jid


def connect_state(jid: str) -> dict:
    with _JOBS_LOCK:
        return dict(_JOBS.get(jid) or {"state": "missing"})
