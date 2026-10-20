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
    def upload(token: dict, file: Path, body: dict, progress, cancelled) -> dict:
        """videos.insert as a resumable upload in chunks. `progress(0..1)` is called after
        each chunk, `cancelled()` between chunks. Returns the API's video resource."""
        try:
            from googleapiclient.discovery import build
            from googleapiclient.errors import HttpError
            from googleapiclient.http import MediaFileUpload
            from google.oauth2.credentials import Credentials
        except ImportError:
            raise YouTubeError("no_library", "Install the YouTube packages.") from None
        creds = Credentials.from_authorized_user_info(token, list(SCOPES))
        service = build("youtube", "v3", credentials=creds, cache_discovery=False)
        media = MediaFileUpload(str(file), mimetype="video/mp4", chunksize=8 * 1024 * 1024, resumable=True)
        request = service.videos().insert(part="snippet,status", body=body, media_body=media)
        try:
            response = None
            while response is None:
                if cancelled():
                    raise YouTubeError("cancelled", "The upload was cancelled.")
                chunk, response = request.next_chunk()
                if chunk is not None:
                    progress(chunk.progress())
        except HttpError as exc:
            raise map_http_error(getattr(getattr(exc, "resp", None), "status", 0), _reason(exc)) from None
        except OSError:
            raise YouTubeError("offline", "Lost the connection to Google. Nothing was published; try again.") from None
        progress(1.0)
        return response

    @staticmethod
    def video_status(token: dict, video_id: str) -> dict:
        """videos.list part=status for one video -> {privacy, upload, publishAt, rejection}."""
        try:
            from googleapiclient.discovery import build
            from googleapiclient.errors import HttpError
            from google.oauth2.credentials import Credentials
        except ImportError:
            raise YouTubeError("no_library", "Install the YouTube packages.") from None
        creds = Credentials.from_authorized_user_info(token, list(SCOPES))
        try:
            reply = build("youtube", "v3", credentials=creds, cache_discovery=False).videos().list(
                part="status", id=video_id).execute()
        except HttpError as exc:
            raise map_http_error(getattr(getattr(exc, "resp", None), "status", 0), _reason(exc)) from None
        except OSError:
            raise YouTubeError("offline", "Could not reach Google.") from None
        items = reply.get("items") or []
        if not items:
            return {"gone": True}
        st = items[0].get("status") or {}
        return {"privacy": st.get("privacyStatus"), "upload": st.get("uploadStatus"),
                "publishAt": st.get("publishAt"), "rejection": st.get("rejectionReason") or st.get("failureReason")}

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


def _reason(exc) -> str:
    """The error `reason` of a googleapiclient HttpError (e.g. quotaExceeded), or ""."""
    try:
        details = json.loads(exc.content.decode("utf-8", "replace"))
        return str(((details.get("error") or {}).get("errors") or [{}])[0].get("reason") or "")
    except (ValueError, AttributeError, IndexError, TypeError):
        return ""


def map_http_error(status: int, reason: str) -> YouTubeError:
    """What a failed YouTube call means for the person."""
    if reason in ("quotaExceeded", "dailyLimitExceeded", "uploadLimitExceeded", "rateLimitExceeded"):
        return YouTubeError("quota", "YouTube's upload limit is used up for now (this project's daily quota, or "
                            "the channel's own daily upload limit). Try again tomorrow.")
    if status == 401 or reason in ("authError", "invalidCredentials"):
        return YouTubeError("expired", "Google no longer accepts this connection. Connect again in the profile settings.")
    if reason in ("youtubeSignupRequired", "channelNotFound"):
        return YouTubeError("other", "This Google account has no YouTube channel.")
    if status == 403:
        return YouTubeError("forbidden", "YouTube refused the request (403" + (f" {reason}" if reason else "") + ").")
    if status == 400:
        return YouTubeError("bad_request", "YouTube refused the video details (400" + (f" {reason}" if reason else "") + ").")
    return YouTubeError("other", f"YouTube answered {status}.")


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


# --------------------------------------------------------------------------
# uploading one schedule row (P16 stage 1)
# --------------------------------------------------------------------------

TITLE_MAX = 100
DESCRIPTION_MAX = 5000
SHORTS_MAX_SECONDS = 180

_UPLOADS: dict[str, dict] = {}
_UPLOAD_LOCK = threading.Lock()
_BUSY_ROWS: set[tuple[str, str]] = set()             # (profile, row id) with an upload running


def _publish_at(row: dict, publish_now: bool):
    """The RFC 3339 UTC time to schedule at, or None to publish at once. The row's date and
    time are the person's local ones. A date without a time (or the reverse) is refused;
    a time in the past is refused too, rather than quietly published now."""
    import datetime as dt
    date, time_ = (row.get("date") or "").strip(), (row.get("time") or "").strip()
    if not date and not time_:
        if not publish_now:
            raise YouTubeError("not_ready", "This clip has no upload date and time. Fill them in to schedule it, "
                               "or choose to publish it now.")
        return None
    if not date or not time_:
        raise YouTubeError("not_ready", "Fill in both the upload date and the upload time.")
    try:
        local = dt.datetime.strptime(f"{date} {time_}", "%Y-%m-%d %H:%M").astimezone()
    except ValueError:
        raise YouTubeError("not_ready", "The upload date or time is not valid.") from None
    when = local.astimezone(dt.timezone.utc)
    if when <= dt.datetime.now(dt.timezone.utc) + dt.timedelta(minutes=2):
        raise YouTubeError("not_ready", f"The upload time ({date} {time_}) has already passed. Pick a time in "
                           "the future, or clear the date and time to publish now.")
    return when.strftime("%Y-%m-%dT%H:%M:%S.000Z")


def prepare(row: dict, publish_now: bool = False, probe_video: bool = True) -> dict:
    """Everything an upload of this row needs, checked: {file, body, publishAt}. Raises
    YouTubeError("not_ready", ...) saying what is missing. Used by single and bulk upload."""
    import re
    from . import schedule
    if row.get("videoId"):
        raise YouTubeError("already", f"This clip was already uploaded (video {row['videoId']}). Uploading it "
                           "again would make a second video.")
    title = " ".join(str(row.get("title") or "").replace("<", " ").replace(">", " ").split())
    if not title:
        raise YouTubeError("not_ready", "This clip has no title.")
    if len(title) > TITLE_MAX:
        raise YouTubeError("not_ready", f"The title is {len(title)} characters; YouTube allows {TITLE_MAX}.")
    description = str(row.get("description") or "")
    if len(description) > DESCRIPTION_MAX:
        raise YouTubeError("not_ready", f"The description is longer than {DESCRIPTION_MAX} characters.")
    file = schedule.find_render_file(row.get("projectId"), row.get("file"))
    if file is None:
        raise YouTubeError("not_ready", "The render file is not in the profile's out/ folder any more (file deleted).")
    if probe_video:
        from .ffmpeg_tools import probe
        info = probe(file)
        if not info.height > info.width:
            raise YouTubeError("not_ready", "This video is not vertical, so it cannot be a Short.")
        if info.duration > SHORTS_MAX_SECONDS:
            raise YouTubeError("not_ready", f"This video is {info.duration / 60:.1f} minutes: a Short can be at most 3.")
    publish_at = _publish_at(row, publish_now)
    tags = []
    for t in re.findall(r"#(\w{1,30})", description):
        if t.lower() not in (x.lower() for x in tags) and len(tags) < 15:
            tags.append(t)
    body = {"snippet": {"title": title, "description": description, "tags": tags, "categoryId": "22"},
            "status": {"selfDeclaredMadeForKids": False,
                       "privacyStatus": "private" if publish_at else "public",
                       **({"publishAt": publish_at} if publish_at else {})}}
    return {"file": file, "body": body, "publishAt": publish_at}


def require_linked() -> dict:
    """The profile's token after a live check, or YouTubeError saying why not."""
    st = check()
    if st.get("state") != "ok":
        raise YouTubeError(st.get("state") or "none", st.get("message") or "This profile is not connected to YouTube: "
                           "open the profile settings and connect it.")
    return _load_token_file()


def start_upload(row_id: str, publish_now: bool = False) -> str:
    """Begin uploading a schedule row as a background job. Returns the job id."""
    import contextvars
    from . import schedule
    if paths.current_profile() == GUEST:
        raise YouTubeError("none", "The Guest has no YouTube account.")
    row = schedule.get_row(row_id)
    if row is None:
        raise YouTubeError("not_ready", "That clip is not in the schedule any more.")
    key = (paths.current_profile(), str(row_id))
    with _UPLOAD_LOCK:
        if key in _BUSY_ROWS:
            raise YouTubeError("already", "This clip is being uploaded right now.")
        _BUSY_ROWS.add(key)
    try:
        spec = prepare(row, publish_now)
        saved = require_linked()
    except BaseException:
        with _UPLOAD_LOCK:
            _BUSY_ROWS.discard(key)
        raise
    jid = uuid.uuid4().hex[:10]
    job = {"state": "uploading", "progress": 0.0, "row": row_id, "cancel": False,
           "scheduled": spec["publishAt"], "profile": key[0]}
    with _UPLOAD_LOCK:
        _UPLOADS[jid] = job

    def run() -> None:
        try:
            token = saved["token"]
            result = _net.upload(token, spec["file"], spec["body"],
                                 lambda p: job.__setitem__("progress", round(p, 3)), lambda: job["cancel"])
            video_id = result.get("id")
            if not video_id:
                raise YouTubeError("other", "YouTube did not return a video id.")
            warning = ""
            try:
                got = _net.video_status(token, video_id)
                if spec["publishAt"] and not got.get("publishAt") and got.get("privacy") == "private":
                    warning = ("YouTube kept the video private and ignored the schedule: the Google Cloud project "
                               "has not passed the YouTube API audit yet, so API uploads stay locked as private.")
                elif not spec["publishAt"] and got.get("privacy") not in (None, "public"):
                    warning = ("YouTube made the video " + str(got.get("privacy")) + " although it was sent as public: "
                               "the Google Cloud project has not passed the YouTube API audit yet.")
            except YouTubeError:
                pass                                   # the upload itself worked; Check status can look again
            fields = {"videoId": video_id, "youtubeUrl": f"https://youtube.com/shorts/{video_id}",
                      "status": "Scheduled" if spec["publishAt"] else "Posted", "uploadedAt": int(time.time())}
            plat = (row.get("platform") or "")
            if "YouTube" not in plat:
                fields["platform"] = "YouTube + TikTok" if plat == "TikTok" else "YouTube"
            if not spec["publishAt"] and not row.get("date"):
                import datetime as dt
                now = dt.datetime.now()
                fields["date"], fields["time"] = now.strftime("%Y-%m-%d"), now.strftime("%H:%M")
            schedule.set_fields(row_id, fields)
            job.update({"state": "done", "videoId": video_id, "url": fields["youtubeUrl"],
                        "status": fields["status"], "warning": warning, "progress": 1.0})
        except YouTubeError as exc:
            job.update({"state": "cancelled" if exc.code == "cancelled" else "failed", "code": exc.code, "message": exc.message})
        except Exception as exc:                       # noqa: BLE001
            job.update({"state": "failed", "code": "other", "message": f"The upload failed ({type(exc).__name__})."})
        finally:
            with _UPLOAD_LOCK:
                _BUSY_ROWS.discard(key)

    threading.Thread(target=contextvars.copy_context().run, args=(run,), daemon=True).start()
    return jid


def upload_state(jid: str) -> dict:
    with _UPLOAD_LOCK:
        job = _UPLOADS.get(jid)
        return {k: v for k, v in job.items() if k != "cancel"} if job else {"state": "missing"}


def cancel_upload(jid: str) -> dict:
    with _UPLOAD_LOCK:
        job = _UPLOADS.get(jid)
        if job:
            job["cancel"] = True
    return upload_state(jid)


def video_status(row_id: str) -> dict:
    """Ask YouTube how an uploaded row's video stands, and bring the row up to date: a
    Scheduled video that is public now becomes Posted."""
    from . import schedule
    row = schedule.get_row(row_id)
    if row is None or not row.get("videoId"):
        raise YouTubeError("not_ready", "This clip has not been uploaded to YouTube.")
    saved = require_linked()
    got = _net.video_status(saved["token"], row["videoId"])
    if got.get("gone"):
        return {"text": "YouTube does not have this video any more (deleted there?).", "gone": True}
    privacy, upload = got.get("privacy"), got.get("upload")
    if got.get("rejection"):
        text = f"YouTube did not accept it: {got['rejection']}."
    elif upload and upload != "processed":
        text = f"YouTube is still processing it ({upload})."
    elif privacy == "public":
        text = "Public."
        if row.get("status") == "Scheduled":
            schedule.set_fields(row_id, {"status": "Posted"})
    elif got.get("publishAt"):
        text = f"Scheduled for {got['publishAt']}."
    else:
        text = f"Private{' (locked: the project has not passed the API audit)' if privacy == 'private' else ''}."
    return {"text": text, "privacy": privacy, "upload": upload, "publishAt": got.get("publishAt")}
