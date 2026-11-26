"""Local server -- what makes the Render button in the UI actually produce MP4.

Static pages can't run ffmpeg. As long as the UI is only served by
`http.server`, the Render button has nothing to call, and the progress
it displays is a lie. This file closes that gap.

Deliberately uses Python's built-in library, not FastAPI: klipian keeps
its installation lightweight, and for one user on one machine
ThreadingHTTPServer is more than enough.

    klipian serve            ->  http://127.0.0.1:5177

Bound to 127.0.0.1 only. This server opens Explorer and runs ffmpeg on
HTTP requests; safe for a local tool, but must not be reachable from
the network.
"""

from __future__ import annotations

import faulthandler
import json
import mimetypes
import os
import re
import shutil
import sys
import threading
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlparse

from .server_json import read_json
from .cache import Cache, fingerprint as _fingerprint
from .models import Transcript
from . import ffmpeg_tools
from . import render as engine
from . import credits as credits_mod
from .schedule import manual_dir as _schedule_manual_dir, title_from_file as _title_from_file
from . import cues as cues_mod
from . import roundtrip
from . import autopilot as _autopilot
from . import autopilot_deps as _autopilot_deps
from . import rubrics as _rubrics
from .jobs import JOBS, LOCK
from . import hashtags as _hashtags_mod
from . import paths as _paths
from . import profiles as _profiles
from . import buildid as _buildid  # noqa: F401  (STARTED is taken here, at start)
from .paths import CACHE_DIR, ROOT, SOURCES, find_video, safe_dirname
from .projects import _free_name, _project_file, _read_project

from .server_motion import MotionRoutes
from .server_services import ServiceRoutes
from .server_projects import ProjectRoutes
from .server_render import RenderRoutes, RANGE_ENDPOINTS
from .server_workspace import WorkspaceRoutes, VIDEO_EXT

# Folders under ROOT served as-is. "assets" holds only vendored, already-
# public files with their licenses beside them -- the OFL web fonts the UI
# loads (see ui/css/fonts.css) and the ONNX models. Note this is ROOT/assets,
# NOT workspace/assets, which stays behind /api/workspace/... below for the
# opposite reason: that one holds the user's own files.
SERVED_DIRS = ("ui", "prompts", "assets")

# Python's mimetypes table doesn't know these on every platform, and on
# Windows it reads them out of the registry, so the answer differs per
# machine. Registered explicitly: the UI's own fonts were being served as
# application/octet-stream, which browsers tolerate for @font-face but
# which is wrong and trips strict Content-Security-Policy setups.
mimetypes.add_type("font/woff2", ".woff2")
mimetypes.add_type("font/woff", ".woff")
mimetypes.add_type("font/ttf", ".ttf")
mimetypes.add_type("image/svg+xml", ".svg")
# Workspace sub-folders accessible directly via URL /workspace/<...> --
# assets/ and schedule/ are deliberately excluded, same as projects/
# below: their contents must only be accessed via /api/workspace/... so
# file names don't become an attack surface on their own.
WORKSPACE_SERVED = ("sources", "out", "cache")


# Operational content (upload schedule, clip status) -- not part of the
# render flow, and deliberately NOT static files, same as projects/ above.
# (The schedule file and its lock live in schedule.py: a finished render adds
# its row there too.)




def _load_dotenv() -> None:
    """Read .env manually, no extra dependencies -- only KEY=VALUE lines.

    Used for HF_TOKEN (AI Framing). Variables already set in the
    environment (e.g. via shell) are NOT overwritten -- .env only fills
    gaps for more convenient daily use."""
    env_file = ROOT / ".env"
    if not env_file.is_file():
        return
    for line in env_file.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip())


# --------------------------------------------------------------------------
# quick previews
# --------------------------------------------------------------------------




# ═══════════════════════════════ workspace ═══════════════════════════════
# Dashboard at /workspace: one place to view render output (workspace/out/),
# manage upload schedule (clips.json), and additional assets
# (workspace/assets/). Separate from projects (per-video working state) --
# this is about WHAT HAPPENS AFTER a clip becomes MP4, not about editing
# the clip itself.

def _thumbnail(video: Path, seconds: float, crop: dict, width: int,
               picture: str = "9:16", background: str = "blur", position: float = 50.0) -> Path:
    """One frame from the clip's second, already cropped to 9:16.

    Candidate cards need to show the person's face at that moment -- a
    generic frame doesn't help decide which clip to pick.

    For a project whose picture is 3:4 or 16:9 the frame is composed the way
    the render composes it (engine.picture_canvas): a 9:16 image with the
    picture on black or a blurred copy, at its position. `width` is then the
    width of that 9:16 image."""
    from .ffmpeg_tools import _require, probe
    # The cache name has to cover EVERY input that changes the picture.
    # top/height used to be left out, so dragging the framing box up or
    # down produced the same filename and the strip kept showing the old
    # crop -- a stale thumbnail that looked like the drag hadn't worked.
    # In cache/, not out/: these are throwaway pictures, and out/ is for what
    # was rendered (History and /workspace both list it).
    # The file's fingerprint (size + mtime) is part of the name: two profiles can hold DIFFERENT videos under
    # one name, and the cache is shared by all of them.
    dest = CACHE_DIR / "thumbs" / safe_dirname(video.stem) / (
        f"{_fingerprint(video)[:10]}-{int(seconds * 10)}-{int(crop['left'])}-{int(crop['top'])}"
        f"-{int(crop['width'])}-{int(crop['height'])}-{width}"
        + ("" if picture == "9:16" else
           f"-{picture.replace(':', 'x')}-{background}-{int(position)}")
        + ".jpg")
    if dest.exists():
        return dest
    dest.parent.mkdir(parents=True, exist_ok=True)

    info = probe(video)
    even = lambda v: max(2, int(v) // 2 * 2)
    cw = even(info.width * crop["width"] / 100)
    ch = even(info.height * crop["height"] / 100)
    cx = even(info.width * crop["left"] / 100)
    cy = even(info.height * crop["top"] / 100)
    graph = None
    if picture != "9:16":
        W = even(width)
        H = even(W * 16 / 9)
        if picture == "3:4":
            # The stored box may still have the 9:16 shape it was made with:
            # keep its centre and height, and give it the 3:4 width.
            cw = min(info.width, even(ch * 3 / 4))
            cx = even(max(0, min(info.width - cw, info.width * (crop["left"] + crop["width"] / 2) / 100 - cw / 2)))
            pre = f"crop={cw}:{ch}:{cx}:{cy},scale={W}:-2"
            fw, fh = W, even(W * 4 / 3)
        else:
            pre, fw, fh = "null", info.width, info.height
        graph = f"[0:v]{pre}[c];" + engine.picture_canvas(
            picture, background, position, W, H, fw, fh, src="[c]", dst="[o]")

    # Render to a per-request temp file, then rename into place. Writing
    # straight to `dest` was a TOCTOU: the home page fires one /api/thumb
    # per project card and the framing strip one per point, so two request
    # threads can target the same cache path -- thread A's exists() check
    # passes while thread B's `ffmpeg -y` is midway through truncating and
    # rewriting it, and A hands back a half-written JPEG. replace() is
    # atomic, so a reader sees either the old file or the complete new one.
    tmp = dest.with_name(f"{dest.stem}.{uuid.uuid4().hex[:8]}.tmp.jpg")
    try:
        # Via ffmpeg_tools.run(), whose docstring says a timeout is
        # mandatory precisely so a hung ffmpeg can't pin a server thread
        # forever -- this call used to bypass it with a bare subprocess.run.
        # 60s is generous for a single frame; the default 3600 would mean a
        # wedged decode holds the thread for an hour.
        ffmpeg_tools.run([
            _require("ffmpeg"), "-y", "-loglevel", "error",
            "-ss", f"{seconds:.2f}", "-i", str(video), "-frames:v", "1",
            *(["-filter_complex", graph, "-map", "[o]"] if graph else
              ["-vf", f"crop={cw}:{ch}:{cx}:{cy},scale={width}:-2"]),
            "-q:v", "4", str(tmp)], desc="building a thumbnail", timeout=60)
        tmp.replace(dest)
    except (RuntimeError, OSError):
        # Thumbnail failed -- return empty path so the caller knows.
        tmp.unlink(missing_ok=True)
        return Path()
    return dest


def _transcript_for(name: str) -> Transcript | None:
    """The transcript for a video by file name (Cache.find_transcript), for
    the endpoints that work from what the page knows: a name, not a path."""
    video = find_video(name) or SOURCES / Path(name).name
    path = Cache(CACHE_DIR).find_transcript(video)
    return Transcript.load(path) if path else None


def _import_reply(name: str, text: str) -> tuple[list, list]:
    """Claude's reply (pasted, or returned by the API) -> (clip candidates, what was repaired). No transcript is not
    an error: the cut points just aren't snapped. Raises ValueError with a message for the person."""
    transcript = _transcript_for(name)
    candidates, notes = roundtrip.parse_reply_notes(
        transcript.words if transcript else [], text,
        cues_mod.load(find_video(name), Cache(CACHE_DIR))["cues"], name or None,
        segments=transcript.segments if transcript else None)
    # The final YouTube title is composed here, by this profile's rule, from title and hashtags
    # (what Claude wrote in youtubeTitle is not used): one that would not fit 100 characters
    # is flagged, so the person sees it before rendering.
    settings = _profiles.hashtag_settings()
    for k in candidates:
        post = k.get("post")
        if post:
            warning = _hashtags_mod.title_warning(post.get("title", ""), post.get("hashtags"), settings)
            if warning:
                k["postWarning"] = warning
    return candidates, notes


def _rubric_for(mode: str = ""):
    """(id used, text, note) for this brief: the one asked for, else this profile's default."""
    return _rubrics.load(mode or _profiles.defaults().get("rubric") or _rubrics.DEFAULT)


PARTIAL_TRANSCRIPT = "The transcript covers only the imported clips. Transcribe the whole video to use this."


def _claude_parts(name: str, mode: str = "", at_most: bool = False):
    """build_parts(count) for the Claude API: the brief of this video, split into the static system text and this
    episode's text (roundtrip.build_api_brief), from the same inputs as /api/brief."""
    transcript = _transcript_for(name)
    if transcript is None:
        raise ValueError("No transcript yet. Click Transcribe on the Prepare screen to make one.")
    if transcript.partial:
        raise ValueError(PARTIAL_TRANSCRIPT)
    _, rubric, _ = _rubric_for(mode)
    cues_data = cues_mod.load(find_video(name), Cache(CACHE_DIR))
    credit = credits_mod.load().get(name)
    rule = _hashtags_mod.brief_rule(_profiles.hashtag_settings())
    return lambda count: roundtrip.build_api_brief(transcript, rubric, name, cues_data, credit, rule, count, at_most=at_most)




# POSTs whose body is a file, not JSON (see Handler._guard).
RAW_UPLOADS = {"/api/video-upload", "/api/project-asset-upload", "/api/workspace/clips/file", "/api/motion/voice-upload"}



# A source video is hundreds of MB to a few GB (a 45-minute episode is about
# 750 MB), unlike the images and sounds /api/project-asset-upload takes (100 MB).
MAX_VIDEO = 10 * 1024 ** 3
# Free space left over after an upload: transcription and renders need room too.
VIDEO_DISK_MARGIN = 1024 ** 3
VIDEO_UPLOAD_LOCK = threading.Lock()


def _video_upload_problem(name: str, size: int) -> str:
    """Why this file can't be taken as a source video, or "" if it can."""
    if not name or Path(name).suffix.lower() not in VIDEO_EXT:
        return "only mp4, mkv, mov and webm videos can be added"
    if size <= 0 or size > MAX_VIDEO:
        return f"a video must be 1 byte to {MAX_VIDEO // 1024 ** 3} GB"
    return ""


def _tidy_video_name(name: str) -> str:
    """The name a video is kept under in sources/: no space or dot between the name
    and the extension ("Ibu-ibu .mp4" -> "Ibu-ibu.mp4"). Such a name made folders
    named after it (thumbnails, ...) unusable on Windows; see paths.safe_dirname."""
    p = Path(name)
    stem = p.stem.strip(" .")
    return f"{stem}{p.suffix}" if stem else name


def _same_video(name: str, size: int) -> str | None:
    """A file in workspace/sources/ that already holds exactly this upload:
    `name` itself with this size, or one of the name-2, name-3 ... that an
    earlier upload of a DIFFERENT file under the same name was given (see
    _free_name). One video then serves any number of projects, and uploading
    it again doesn't pile up copies."""
    folder = SOURCES
    stem, ext = Path(name).stem, Path(name).suffix
    i = 1
    while True:
        cand = folder / (name if i == 1 else f"{stem}-{i}{ext}")
        if not cand.exists():
            return None
        if cand.is_file() and cand.stat().st_size == size:
            return cand.name
        i += 1


# --------------------------------------------------------------------------
# HTTP
# --------------------------------------------------------------------------

class Handler(MotionRoutes, ServiceRoutes, WorkspaceRoutes, ProjectRoutes, RenderRoutes, BaseHTTPRequestHandler):
    server_version = "klipian"

    def log_message(self, format, *args):          # noqa: A002
        if "/api/" in str(args):                   # quiet for static files
            sys.stderr.write(f"  {args[0]}\n")

    # ---- util ----

    def _send_json(self, data, status=200):
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        try:
            self.wfile.write(body)
        except ConnectionError:
            # Called from ALL API endpoints, including the polling
            # /api/transcribe/<id> that fires every ~1 second --
            # reload/navigating away mid-request is normal, not an error.
            # Same reason as in _send_file().
            pass

    # ---- who may talk to this server ----

    def _refuse(self, message: str, status: int):
        """Answer a request the guard turns away. The body it sent is read off
        the socket first (up to 1 MiB): closing a connection with unread data
        makes the OS reset it, and the client then sees a dropped connection
        instead of the 403/415 (on Windows, some of the time)."""
        try:
            left = min(int(self.headers.get("Content-Length", 0)), 1024 ** 2)
        except ValueError:
            left = 0
        while left > 0:
            chunk = self.rfile.read(min(left, 65536))
            if not chunk:
                break
            left -= len(chunk)
        self._send_json({"error": message}, status)

    def _guard(self, post: bool) -> bool:
        """The one place that decides whether a request is from the page this
        server serves, or from some other site in the same browser.

        Bound to 127.0.0.1 is not enough: any web page you have open can send
        requests to 127.0.0.1:<port> (start a render, upload 10 GB into
        sources/, overwrite a project, open a folder), and DNS rebinding can
        even let it READ projects and transcripts. So:

          * the Host header must be this server's own address (rebinding
            arrives with the attacker's name in it);
          * a POST that carries an Origin must carry ours (browsers always send
            Origin on cross-site POSTs; curl and the CLI send none, and are fine);
          * a JSON endpoint must be sent as application/json, which a cross-site
            form or fetch cannot do without a preflight this server never
            answers. The two raw uploads are exempt (their Origin is checked).

        Answers 403 / 415 itself and returns False when the request is refused."""
        port = self.server.server_address[1]
        hosts = {f"127.0.0.1:{port}", f"localhost:{port}"}
        host = self.headers.get("Host")
        if host is not None and host.lower() not in hosts:
            self._refuse("this server only answers on its own address", 403)
            return False
        if post:
            origin = self.headers.get("Origin")
            if origin is not None and origin.lower() not in {f"http://{h}" for h in hosts}:
                self._refuse("cross-site request refused", 403)
                return False
            path = urlparse(self.path).path
            ctype = (self.headers.get("Content-Type") or "").split(";")[0].strip().lower()
            if path not in RAW_UPLOADS and ctype != "application/json":
                self._refuse("send this as application/json", 415)
                return False
        return self._set_profile()

    # Pages, the profile list and the version check need no profile. Everything else
    # does, and says which: a tab from before profiles (or one whose profile was
    # deleted) fails loudly instead of writing into the wrong profile.
    def _set_profile(self) -> bool:
        parsed = urlparse(self.path)
        path = unquote(parsed.path)
        _paths.set_profile(None)               # this thread served another request before
        parts = [p for p in path.split("/") if p]
        media = len(parts) >= 2 and parts[0] == "workspace" and parts[1] in ("sources", "out")
        if not path.startswith("/api/") and not media:
            return True
        if path.startswith("/api/profiles") or path == "/api/version":
            return True
        pid = (self.headers.get("X-Klipian-Profile")
               or (parse_qs(parsed.query).get("profile") or [""])[0])
        if not pid:
            self._send_json({"error": "no profile selected: reload the page", "needProfile": True}, 400)
            return False
        if not _paths.valid_profile_id(pid) or not _profiles.exists(pid):
            self._send_json({"error": "that profile does not exist: reload the page", "needProfile": True}, 404)
            return False
        _paths.set_profile(pid)
        if pid == _paths.ADMIN and not path.startswith("/api/admin"):
            self._send_json({"error": "the Admin profile only has settings"}, 403)
            return False
        if pid != _paths.ADMIN and path.startswith("/api/admin"):
            self._send_json({"error": "only the Admin profile can do this"}, 403)
            return False
        if pid == _paths.GUEST:
            _profiles.ensure_dirs(pid)             # made on first use (and after "Clear guest data")
        if pid == _paths.GUEST and (path.startswith("/api/workspace/clips") or path.startswith("/api/youtube") or path.startswith("/api/motion")
                                      or path.startswith("/api/autopilot")):
            self._send_json({"error": "not available for the Guest profile"}, 403)
            return False
        return True

    def _send_text(self, text: str, mime: str, status=200):
        body = text.encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", f"{mime}; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        try:
            self.wfile.write(body)
        except ConnectionError:
            pass                                   # navigated away mid-download

    def _read_json(self):
        n = int(self.headers.get("Content-Length", 0))
        MAX_BODY = 10 * 1024 * 1024  # 10 MB -- request body limit
        if n < 0:
            raise ValueError("Content-Length is negative")
        if n > MAX_BODY:
            raise ValueError(f"Body too large ({n:,} bytes, max {MAX_BODY:,})")
        data = json.loads(self.rfile.read(n) or b"{}")
        # All handlers call .get() -- a non-object body (list/number/string)
        # would throw AttributeError outside try/except. Reject here.
        if not isinstance(data, dict):
            raise ValueError("JSON body must be an object")
        return data

    # ---- GET ----

    def do_GET(self):                              # noqa: N802
        if not self._guard(post=False):
            return
        path = unquote(urlparse(self.path).path)

        # Copy first inside the lock: the render thread writes to the same
        # dict, and json.dumps iterating it while it changes will throw
        # "dictionary changed size during iteration".
        if (path.startswith("/api/render/") or path.startswith("/api/transcribe/")
                or path.startswith("/api/diarize/")):
            with LOCK:
                t = JOBS.get(path.rsplit("/", 1)[-1])
                salinan = dict(t) if t else None
                if salinan and isinstance(salinan.get("result"), list):
                    salinan["result"] = list(salinan["result"])
                if salinan and isinstance(salinan.get("items"), list):
                    salinan["items"] = [dict(x) for x in salinan["items"]]
            return self._send_json(salinan or {"state": "missing"}, 200 if salinan else 404)
        route = self.GET_ROUTES.get(path)
        if route:
            return route(self)
        return self._get_static(path)

    def _get_thumb(self):
        q = parse_qs(urlparse(self.path).query)
        # Non-numeric query params would make float() throw ValueError
        # that's uncaught in do_GET -> connection drops without a response.
        def num(k, d):
            try:
                return float(q.get(k, [d])[0])
            except (TypeError, ValueError):
                return float(d)
        video = find_video(q.get("video", [""])[0])
        if not video:
            return self._send_json({"error": "video not found"}, 404)
        shape = engine.picture_options({
            "picture": (q.get("picture") or [""])[0],
            "background": (q.get("background") or [""])[0],
            "position": (q.get("position") or ["50"])[0]})
        file = _thumbnail(video, num("t", 0),
                            {"left": num("left", 37), "top": num("top", 4),
                             "width": num("width", 26), "height": num("height", 92)},
                            int(num("w", 132)), **shape)
        if not file.is_file():
            return self._send_json({"error": "could not build thumbnail"}, 500)
        data = file.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", "image/jpeg")
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "max-age=3600")
        self.end_headers()
        try:
            self.wfile.write(data)
        except ConnectionError:
            pass    # page changed/closed mid-thumbnail load -- normal
        return

    def _get_probe(self):
        # UI needs fps to step per frame. The <video> element never
        # exposes that number, so ffprobe is the answer.
        q = parse_qs(urlparse(self.path).query)
        video = find_video(q.get("video", [""])[0])
        if not video:
            return self._send_json({"error": "video not found"}, 404)
        try:
            from .ffmpeg_tools import probe
            i = probe(video)
        except Exception as exc:               # noqa: BLE001
            return self._send_json({"error": str(exc)}, 500)
        return self._send_json({
            "duration": i.duration, "width": i.width, "height": i.height,
            "fps": round(i.fps, 3), "has_audio": i.has_audio,
        })

    def _get_version(self):
        """`running`: the Python this server loaded at start; `disk`: what is in
        klipian/*.py now. They differ after an update until the server is restarted."""
        from . import buildid
        disk = buildid.current()
        return self._send_json({"running": buildid.STARTED, "disk": disk,
                                "stale": buildid.STARTED != disk})

    # ---- the profile's YouTube account (youtube.py; the Guest is refused in _set_profile) ----

    @read_json
    def _post_profiles(self, req):
        """create / update / delete / clear-guest. None needs a profile in the header."""
        action = urlparse(self.path).path.rsplit("/", 1)[-1]
        try:
            if action == "create":
                return self._send_json({"ok": True, "profile": _profiles.create(req.get("name"), req.get("color"))})
            if action == "update":
                return self._send_json({"ok": True, "profile": _profiles.update(str(req.get("id") or ""), req)})
            if action == "delete":
                _profiles.delete(str(req.get("id") or ""))
                return self._send_json({"ok": True})
            if action == "clear-guest":
                _profiles.clear_guest()
                return self._send_json({"ok": True})
        except _profiles.ProfileError as exc:
            return self._send_json({"error": str(exc)}, 400)
        except OSError as exc:
            return self._send_json({"error": f"could not do that: {exc}"}, 500)
        return self._send_json({"error": "unknown endpoint"}, 404)

    def _get_profiles(self):
        """The profiles to pick from, and the Guest. Names and colours only."""
        return self._send_json({"profile": _profiles.list_profiles(),
                                "guest": _profiles.read_meta(_paths.GUEST),
                                "admin": _profiles.read_meta(_paths.ADMIN)})

    def _get_cache(self):
        # UI needs to know which transcripts are available. This server
        # doesn't generate HTML directory listings like http.server, so
        # a dedicated endpoint is provided.
        file = sorted(p.name for p in CACHE_DIR.glob("*.transcript.json"))
        return self._send_json({"transcript": file})

    def _get_transcript(self):
        """The transcript the page works from, as the file holds it."""
        q = parse_qs(urlparse(self.path).query)
        name = q.get("video", [""])[0]
        video = find_video(name) or SOURCES / Path(name).name
        path = Cache(CACHE_DIR).find_transcript(video)
        if path is None:
            return self._send_json({"error": f"No transcript yet for {name}"}, 404)
        return self._send_text(path.read_text(encoding="utf-8"), "application/json")

    def _get_cues(self):
        """What the audio and the word timings say about a video (cues.load):
        the status of each detector, every cue, and the count per kind."""
        q = parse_qs(urlparse(self.path).query)
        video = find_video(q.get("video", [""])[0])
        data = cues_mod.load(video, Cache(CACHE_DIR))
        data["counts"] = cues_mod.counts(data["cues"])
        return self._send_json(data)

    def _get_brief(self):
        """The file to drop into Claude -- see roundtrip.build_brief."""
        q = parse_qs(urlparse(self.path).query)
        name = q.get("video", [""])[0]
        try:
            transcript = _transcript_for(name)
        except (OSError, ValueError, KeyError) as exc:
            return self._send_json({"error": f"The transcript for {name} could not be read ({exc})"}, 500)
        if transcript is None:
            return self._send_json({"error": "No transcript yet. Click Transcribe on the Prepare screen to make one."}, 404)
        if transcript.partial:
            return self._send_json({"error": PARTIAL_TRANSCRIPT}, 409)
        try:
            _, rubric, _ = _rubric_for((q.get("mode") or [""])[0])
        except _rubrics.RubricError as exc:
            return self._send_json({"error": str(exc)}, 400)
        cues_data = cues_mod.load(find_video(name), Cache(CACHE_DIR))
        credit = credits_mod.load().get(name)
        return self._send_text(roundtrip.build_brief(
            transcript, rubric, name, cues_data, credit,
            _hashtags_mod.brief_rule(_profiles.hashtag_settings())),
            "text/markdown")

    def _post_geminibrief(self):
        """The brief for turning Gemini's answer (YouTube "Ask about this video") into the clip JSON -- see
        roundtrip.build_gemini_brief. Needs no transcript."""
        try:
            req = self._read_json()
            name = str(req.get("video") or "")
            text = roundtrip.build_gemini_brief(str(req.get("text") or ""), name or "video.mp4",
                                                _hashtags_mod.brief_rule(_profiles.hashtag_settings()))
        except Exception as exc:               # noqa: BLE001
            return self._send_json({"error": str(exc)}, 400)
        return self._send_json({"text": text})

    # ---- post text for ONE Result through Claude chat (no API key): the brief and the reply ----

    def _saved_project(self, project_id: str):
        pf = _project_file(project_id)
        return _read_project(pf) if pf and pf.is_file() else None

    def _get_result_brief(self):
        """The file for Claude asking for the post text of one Result of a SAVED project (roundtrip.build_result_brief)."""
        q = parse_qs(urlparse(self.path).query)
        pdata = self._saved_project((q.get("project") or [""])[0])
        if not pdata:
            return self._send_json({"error": "That project is not saved yet."}, 400)
        try:
            _, rubric, _ = _rubric_for((q.get("mode") or [""])[0])
            from .jobs import _request_adapters
            words_of, size_of = _request_adapters()
            cache = Cache(CACHE_DIR)
            credits_by_file = credits_mod.load()
            text = roundtrip.build_result_brief(
                pdata, (q.get("result") or [""])[0], words_of=words_of, size_of=size_of,
                cues_of=lambda f: cues_mod.load(find_video(f), cache)["cues"] if f else [],
                credit_of=lambda f: credits_by_file.get(f), rubric=rubric,
                hashtag_rule=_hashtags_mod.brief_rule(_profiles.hashtag_settings()))
        except (ValueError, _rubrics.RubricError) as exc:
            return self._send_json({"error": str(exc)}, 400)
        return self._send_text(text, "text/markdown")

    def _get_results_brief(self):
        """ONE brief for several Results of a saved project (roundtrip.build_results_brief)."""
        q = parse_qs(urlparse(self.path).query)
        pdata = self._saved_project((q.get("project") or [""])[0])
        if not pdata:
            return self._send_json({"error": "That project is not saved yet."}, 400)
        ids = [i for i in dict.fromkeys((q.get("results") or [""])[0].split(",")) if i]
        try:
            _, rubric, _ = _rubric_for((q.get("mode") or [""])[0])
            from .jobs import _request_adapters
            words_of, size_of = _request_adapters()
            cache = Cache(CACHE_DIR)
            credits_by_file = credits_mod.load()
            text = roundtrip.build_results_brief(
                pdata, ids, words_of=words_of, size_of=size_of,
                cues_of=lambda f: cues_mod.load(find_video(f), cache)["cues"] if f else [],
                credit_of=lambda f: credits_by_file.get(f), rubric=rubric,
                hashtag_rule=_hashtags_mod.brief_rule(_profiles.hashtag_settings()))
        except (ValueError, _rubrics.RubricError) as exc:
            return self._send_json({"error": str(exc)}, 400)
        return self._send_text(text, "text/markdown")

    @read_json
    def _post_results_reply(self, req):
        """Claude's reply for several Results -> {id: fields}, or the Results and fields that are missing."""
        pdata = self._saved_project(str(req.get("project") or ""))
        if not pdata:
            return self._send_json({"error": "That project is not saved yet."}, 400)
        by_id = {r.get("id"): r for r in pdata.get("results") or [] if isinstance(r, dict)}
        durations = {}
        for rid in [str(i) for i in dict.fromkeys(req.get("results") or [])]:
            entry = by_id.get(rid)
            if not entry:
                return self._send_json({"error": f"The Result {rid} is not in the saved project."}, 400)
            stored = entry.get("segments") if isinstance(entry.get("segments"), list) else entry.get("result") or []
            durations[rid] = sum(max(0.0, (s.get("end") or 0) - (s.get("start") or 0)) for s in stored if isinstance(s, dict))
        try:
            fields, notes = roundtrip.parse_results_reply(str(req.get("text") or ""), durations)
        except ValueError as exc:
            return self._send_json({"error": str(exc)}, 400)
        settings = _profiles.hashtag_settings()
        warnings = {}
        for rid, f in fields.items():
            w = _hashtags_mod.title_warning(f["post"].get("title", ""), f["post"].get("hashtags"), settings)
            if w:
                warnings[rid] = w
        return self._send_json({"ok": True, "results": fields, "notes": notes, "postWarnings": warnings})

    @read_json
    def _post_result_reply(self, req):
        """Claude's reply for one Result -> its fields (the page fills them in and asks before replacing)."""
        pdata = self._saved_project(str(req.get("project") or ""))
        entry = next((r for r in (pdata or {}).get("results") or [] if isinstance(r, dict) and r.get("id") == req.get("result")), None)
        if not entry:
            return self._send_json({"error": "That Result is not in the saved project."}, 400)
        stored = entry.get("segments") if isinstance(entry.get("segments"), list) else entry.get("result") or []
        duration = sum(max(0.0, (s.get("end") or 0) - (s.get("start") or 0)) for s in stored if isinstance(s, dict))
        try:
            fields, notes = roundtrip.parse_result_reply(str(req.get("text") or ""), duration)
        except ValueError as exc:
            return self._send_json({"error": str(exc)}, 400)
        settings = _profiles.hashtag_settings()
        warning = _hashtags_mod.title_warning(fields["post"].get("title", ""), fields["post"].get("hashtags"), settings)
        return self._send_json({"ok": True, **fields, "notes": notes, **({"postWarning": warning} if warning else {})})

    def _get_video(self):
        file = sorted(p.name for p in SOURCES.glob("*")
                        if p.suffix.lower() in VIDEO_EXT)
        return self._send_json({"video": file})

    def _get_video_check(self):
        """Before a video is uploaded: could it be, and is it already here?
        `reuse` names a file in sources/ that already holds exactly this one
        (same name and size), so the page can skip sending it."""
        q = parse_qs(urlparse(self.path).query)
        name = _tidy_video_name(Path((q.get("name") or [""])[0]).name.strip())
        try:
            size = int((q.get("size") or ["0"])[0])
        except ValueError:
            size = 0
        problem = _video_upload_problem(name, size)
        if problem:
            return self._send_json({"error": problem})
        sources = SOURCES
        sources.mkdir(parents=True, exist_ok=True)
        return self._send_json({"reuse": _same_video(name, size),
                                "free": shutil.disk_usage(sources).free})

    def _get_static(self, path):

        # Editor at root "/" -- not "/ui/". "/ui" is still served (used for
        # static files via SERVED_DIRS below), but is no longer the address
        # promoted to users: "ui" is a folder name on disk, not a page name.
        # Previously "/" redirected (302) to "/ui/" because index.html used
        # RELATIVE script paths that broke when served from root -- now all
        # asset paths in index.html/workspace.html are absolute
        # (/ui/css/..., /ui/js/...), so the pages themselves can be served
        # at any address without redirects.
        if path.rstrip("/") in ("", "/ui"):
            path = "/ui/index.html"
        if path.rstrip("/") == "/workspace":
            path = "/ui/workspace.html"
        if path.rstrip("/") == "/sources":
            path = "/ui/sources.html"
        if path.rstrip("/") == "/profiles":
            path = "/ui/profiles.html"
        if path.rstrip("/") == "/admin":
            path = "/ui/admin.html"
        if path.rstrip("/") == "/autopilot":
            path = "/ui/autopilot.html"
        if path.rstrip("/") == "/remotion":
            path = "/ui/remotion.html"
        if path.rstrip("/") == "/guide":
            path = "/ui/guide.html"             # static: no profile needed
        # /edit/<video> is the same editor page -- which project it opens is
        # decided in the browser (urlProject() in ui/js/editor/projects.js),
        # not here, so nothing in this path is looked up or trusted: it is
        # only ever handed back to index.html to read for itself. "/" still
        # works and still restores the last session, so old links and
        # bookmarks are unaffected.
        if path.rstrip("/") == "/edit" or path.startswith("/edit/"):
            path = "/ui/index.html"

        # Stripping ".." alone is NOT enough on Windows: a single path
        # component containing a backslash or drive letter can reset the
        # joinpath result, so "/ui/C:%5CWindows%5Cwin.ini" once served a
        # system file. Components containing path separators are rejected,
        # then the final result is still checked to be inside ROOT.
        parts = [b for b in path.strip("/").split("/") if b not in ("", ".", "..")]
        if not parts:
            return self._send_json({"error": "not served"}, 404)
        if parts[0] == "workspace":
            if len(parts) < 2 or parts[1] not in WORKSPACE_SERVED:
                return self._send_json({"error": "not served"}, 404)
        elif parts[0] not in SERVED_DIRS:
            return self._send_json({"error": "not served"}, 404)
        if any("\\" in b or "/" in b or b == ".." for b in parts):
            return self._send_json({"error": "invalid path"}, 400)

        # /workspace/sources and /workspace/out are the PROFILE's (set by _set_profile);
        # cache/ is shared; everything else is under the install folder.
        if parts[0] == "workspace" and parts[1] in ("sources", "out"):
            base = _paths.profile_dir()
            file = base.joinpath(*parts[1:])
        else:
            base = ROOT if parts[0] != "workspace" else _paths.workspace_dir()
            file = base.joinpath(*(parts if parts[0] != "workspace" else parts[1:]))
        try:
            file = file.resolve(strict=True)
        except OSError:
            return self._send_json({"error": f"not found: {path}"}, 404)
        if not file.is_relative_to(base.resolve()):
            return self._send_json({"error": "invalid path"}, 400)
        if not file.is_file():
            return self._send_json({"error": f"not found: {path}"}, 404)

        mime = mimetypes.guess_type(str(file))[0] or "application/octet-stream"
        return self._send_file(file, mime)

    GET_ROUTES = {
        "/api/thumb": _get_thumb,
        "/api/version": _get_version,
        "/api/profiles": _get_profiles,
        "/api/profiles/machine": ServiceRoutes._get_machine,
        "/api/admin/tts": ServiceRoutes._get_tts,
        "/api/rubrics": ServiceRoutes._get_rubrics,
        "/api/autopilot/state": ServiceRoutes._get_autopilot_state,
        "/api/autopilot/brief": ServiceRoutes._get_autopilot_brief,
        "/api/autopilot/rerun-info": ServiceRoutes._get_autopilot_rerun_info,
        "/api/admin/settings": ServiceRoutes._get_admin_settings,
        "/api/admin/gemini/models": ServiceRoutes._get_admin_models,
        "/api/claude/status": ServiceRoutes._get_claude_status,
        "/api/claude/models": ServiceRoutes._get_claude_models,
        "/api/claude/usage": ServiceRoutes._get_claude_usage,
        "/api/claude/job": ServiceRoutes._get_claude_job,
        "/api/motion/projects": MotionRoutes._get_motion_projects,
        "/api/motion/project": MotionRoutes._get_motion_project,
        "/api/motion/status": MotionRoutes._get_motion_status,
        "/api/motion/brief": MotionRoutes._get_motion_brief,
        "/api/motion/still": MotionRoutes._get_motion_still,
        "/api/motion/subtitles": MotionRoutes._get_motion_subtitles,
        "/api/motion/preview-file": MotionRoutes._get_motion_preview_file,
        "/api/motion/narration": MotionRoutes._get_motion_narration,
        "/api/motion/voice-file": MotionRoutes._get_motion_voice_file,
        "/api/ytdl/status": ServiceRoutes._get_ytdl_status,
        "/api/ytdl/state": ServiceRoutes._get_ytdl_state,
        "/api/youtube/status": ServiceRoutes._get_youtube_status,
        "/api/youtube/connect-state": ServiceRoutes._get_youtube_connect_state,
        "/api/youtube/upload-state": ServiceRoutes._get_youtube_upload_state,
        "/api/youtube/bulk-state": ServiceRoutes._get_youtube_bulk_state,
        "/api/probe": _get_probe,
        "/api/history": ProjectRoutes._get_history,
        "/api/projects": ProjectRoutes._get_projects,
        "/api/project": ProjectRoutes._get_project,
        "/api/workspace/clips": WorkspaceRoutes._get_workspace_clips,
        "/api/workspace/assets": WorkspaceRoutes._get_workspace_assets,
        "/api/workspace/sources": WorkspaceRoutes._get_workspace_sources,
        "/api/credits": WorkspaceRoutes._get_credits,
        "/api/project-assets": ProjectRoutes._get_project_assets,
        "/api/project-asset-file": ProjectRoutes._get_project_asset_file,
        "/api/workspace/asset-file": WorkspaceRoutes._get_workspace_asset_file,
        "/api/cache": _get_cache,
        "/api/transcript": _get_transcript,
        "/api/cues": _get_cues,
        "/api/brief": _get_brief,
        "/api/result-brief": _get_result_brief,
        "/api/results-brief": _get_results_brief,
        "/api/video": _get_video,
        "/api/video-check": _get_video_check,
    }

    def _send_file(self, file: Path, mime: str) -> None:
        """Send files in chunks, respecting Range headers.

        Previously the entire file was loaded into memory first -- a 2 GB
        source video meant 2 GB of RAM for a single request. Accept-Ranges
        was also advertised even though Range was ignored, so seeks in the
        <video> element requested slices that were never delivered.
        """
        size = file.stat().st_size
        start, end = 0, size - 1
        status = 200

        range_header = self.headers.get("Range", "")
        if range_header.startswith("bytes="):
            range_parts = range_header[6:].split(",")[0].split("-")
            try:
                if range_parts[0].strip():                     # bytes=100-  /  bytes=100-200
                    start = int(range_parts[0])
                    if len(range_parts) > 1 and range_parts[1].strip():
                        end = min(int(range_parts[1]), size - 1)
                elif len(range_parts) > 1 and range_parts[1].strip():  # bytes=-500 (tail)
                    start = max(0, size - int(range_parts[1]))
            except ValueError:
                start, end = 0, size - 1                 # Malformed Range: send whole file
            else:
                if start >= size or start > end:
                    self.send_response(416)
                    self.send_header("Content-Range", f"bytes */{size}")
                    self.send_header("Content-Length", "0")
                    self.end_headers()
                    return
                status = 206

        self.send_response(status)
        self.send_header("Content-Type", mime)
        self.send_header("Content-Length", str(end - start + 1))
        self.send_header("Accept-Ranges", "bytes")
        self.send_header("Cache-Control", "no-store")
        if status == 206:
            self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
        self.end_headers()

        remaining = end - start + 1
        with file.open("rb") as f:
            f.seek(start)
            while remaining > 0:
                blok = f.read(min(64 * 1024, remaining))
                if not blok:
                    break
                try:
                    self.wfile.write(blok)
                except ConnectionError:
                    # Player closes the connection during seek -- normal,
                    # happens every time the video is scrubbed.
                    # BrokenPipeError/ConnectionResetError have been caught
                    # here for a long time, but Windows throws
                    # ConnectionAbortedError (WinError 10053) for the exact
                    # same event -- different exception, so it slipped
                    # through and printed a full traceback to the log each
                    # time. ConnectionError is the parent of all three (also
                    # ConnectionRefusedError), so catching that directly
                    # closes this gap for all variants on all OS.
                    return
                remaining -= len(blok)

    # ---- POST ----

    def do_POST(self):                             # noqa: N802
        if not self._guard(post=True):
            return
        path = urlparse(self.path).path
        route = self.POST_ROUTES.get(path)
        if route:
            return route(self)
        if path in RANGE_ENDPOINTS:
            return self._post_range(path)
        self._send_json({"error": "unknown endpoint"}, 404)

    def _post_clip_file(self):
        """A video chosen for a schedule row that klipian did not render (the row's "Choose video…"):
        kept in out/manual/ under a clean name (paths.safe_name, " (2)" on a clash with a DIFFERENT file;
        the same bytes again are reused). Raw body, name in the query, like the source upload. Answers
        {file, folder, existed, title} where `title` is a first title made from the name."""
        import hashlib
        q = parse_qs(urlparse(self.path).query)
        asked = Path((q.get("name") or [""])[0]).name.strip()
        ext = Path(asked).suffix.lower()
        stem = _paths.safe_name(Path(asked).stem) or "video"
        try:
            n = int(self.headers.get("Content-Length", 0))
        except ValueError:
            n = 0
        if ext not in (".mp4", ".mov", ".webm"):
            return self._send_json({"error": "choose an mp4, mov or webm video"}, 400)
        if n <= 0 or n > MAX_VIDEO:
            return self._send_json({"error": f"a video must be 1 byte to {MAX_VIDEO // 1024 ** 3} GB"}, 400)
        folder = _schedule_manual_dir()
        folder.mkdir(parents=True, exist_ok=True)
        if n + VIDEO_DISK_MARGIN > shutil.disk_usage(folder).free:
            return self._send_json({"error": "not enough disk space for this video"}, 507)
        tmp = folder / f".{uuid.uuid4().hex[:8]}.part"
        digest = hashlib.sha256()
        try:
            with open(tmp, "wb") as out:
                remaining = n
                while remaining > 0:
                    chunk = self.rfile.read(min(1 << 20, remaining))
                    if not chunk:
                        raise ConnectionError("upload ended early")
                    out.write(chunk)
                    digest.update(chunk)
                    remaining -= len(chunk)
            with VIDEO_UPLOAD_LOCK:
                same = None
                for cand in sorted(folder.glob(f"*{ext}")):
                    if cand.is_file() and cand.stat().st_size == n:
                        h = hashlib.sha256()
                        with open(cand, "rb") as fh:
                            for block in iter(lambda: fh.read(1 << 20), b""):
                                h.update(block)
                        if h.digest() == digest.digest():
                            same = cand
                            break
                if same:
                    tmp.unlink(missing_ok=True)
                    name, existed = same.name, True
                else:
                    name, i = f"{stem}{ext}", 2
                    while (folder / name).exists():
                        name, i = f"{stem} ({i}){ext}", i + 1
                    tmp.replace(folder / name)
                    existed = False
        except (OSError, ConnectionError) as exc:
            tmp.unlink(missing_ok=True)
            return self._send_json({"error": f"could not save the file: {exc}"}, 500)
        return self._send_json({"ok": True, "file": name, "folder": "manual", "existed": existed,
                                "title": _title_from_file(name)})

    def _post_video_upload(self):
        # A source video from anywhere on disk, saved into workspace/sources/
        # (where the server looks videos up by name). Same shape as the
        # image/sound upload above -- raw body, name in the query, written in
        # 1 MB pieces to a .part file and then renamed -- but its own size
        # limit: a 45-minute episode is ~750 MB.
        q = parse_qs(urlparse(self.path).query)
        asked = Path((q.get("name") or [""])[0]).name.strip()
        name = _tidy_video_name(asked)
        try:
            n = int(self.headers.get("Content-Length", 0))
        except ValueError:
            n = 0
        problem = _video_upload_problem(name, n)
        if problem:
            return self._send_json({"error": problem}, 400)
        folder = SOURCES
        folder.mkdir(parents=True, exist_ok=True)
        free = shutil.disk_usage(folder).free
        if n + VIDEO_DISK_MARGIN > free:
            return self._send_json({"error": f"not enough disk space: {n / 1024 ** 3:.1f} GB needed, "
                                              f"{free / 1024 ** 3:.1f} GB free"}, 507)
        same = _same_video(name, n)
        if same:
            # Already here. The client checks first, so this is a race or an
            # old client: take the body off the wire and keep the file we have.
            self._drain(n)
            return self._send_json({"ok": True, "name": same, "existed": True, "renamedFrom": asked if asked != name else None})
        tmp = folder / f"{name}.{uuid.uuid4().hex[:8]}.part"
        try:
            with open(tmp, "wb") as out:
                remaining = n
                while remaining > 0:
                    chunk = self.rfile.read(min(1 << 20, remaining))
                    if not chunk:
                        raise ConnectionError("upload ended early")
                    out.write(chunk)
                    remaining -= len(chunk)
            # Decided under a lock and as late as possible: another upload of
            # the same name may have finished meanwhile, and a rename must
            # never replace somebody else's file.
            with VIDEO_UPLOAD_LOCK:
                same = _same_video(name, n)
                if same:
                    tmp.unlink(missing_ok=True)
                    return self._send_json({"ok": True, "name": same, "existed": True})
                dest = _free_name(folder, name)
                placed = _profiles.place_source(tmp, dest)   # a link to another profile's identical copy, else a rename
        except (OSError, ConnectionError) as exc:
            tmp.unlink(missing_ok=True)
            return self._send_json({"error": f"could not save the file: {exc}"}, 500)
        return self._send_json({"ok": True, "name": dest.name, "existed": False,
                                "renamedFrom": asked if asked != name else None,
                                "creditFrom": placed.get("creditFrom")})

    def _drain(self, n: int) -> None:
        try:
            while n > 0:
                chunk = self.rfile.read(min(1 << 20, n))
                if not chunk:
                    break
                n -= len(chunk)
        except OSError:
            pass

    POST_ROUTES = {
        "/api/aiframe": RenderRoutes._post_aiframe,
        "/api/project": ProjectRoutes._post_project,
        "/api/project/restore": ProjectRoutes._post_project_restore,
        "/api/motion/create": MotionRoutes._post_motion,
        "/api/motion/paste": MotionRoutes._post_motion,
        "/api/motion/facts": MotionRoutes._post_motion,
        "/api/motion/update": MotionRoutes._post_motion,
        "/api/motion/preview": MotionRoutes._post_motion,
        "/api/motion/render": MotionRoutes._post_motion,
        "/api/motion/cancel": MotionRoutes._post_motion,
        "/api/motion/delete": MotionRoutes._post_motion,
        "/api/motion/voice": MotionRoutes._post_motion,
        "/api/motion/voice-align": MotionRoutes._post_motion,
        "/api/motion/voice-clear": MotionRoutes._post_motion,
        "/api/motion/voice-tts": MotionRoutes._post_motion,
        "/api/motion/voice-parts": MotionRoutes._post_motion,
        "/api/motion/voice-part": MotionRoutes._post_motion,
        "/api/motion/voice-length": MotionRoutes._post_motion,
        "/api/motion/preview-video": MotionRoutes._post_motion,
        "/api/motion/options": MotionRoutes._post_motion,
        "/api/motion/briefed": MotionRoutes._post_motion,
        "/api/motion/take-folder": MotionRoutes._post_motion,
        "/api/motion/voice-upload": MotionRoutes._post_motion_voice_upload,
        "/api/ytdl/preview": ServiceRoutes._post_ytdl,
        "/api/ytdl/start": ServiceRoutes._post_ytdl,
        "/api/ytdl/cancel": ServiceRoutes._post_ytdl,
        "/api/ytdl/update": ServiceRoutes._post_ytdl,
        "/api/youtube/refresh-due": ServiceRoutes._post_youtube,
        "/api/youtube/sync-all": ServiceRoutes._post_youtube,
        "/api/youtube/client": ServiceRoutes._post_youtube,
        "/api/youtube/connect": ServiceRoutes._post_youtube,
        "/api/youtube/check": ServiceRoutes._post_youtube,
        "/api/youtube/upload": ServiceRoutes._post_youtube,
        "/api/youtube/resend-thumbnail": ServiceRoutes._post_youtube,
        "/api/youtube/bulk-plan": ServiceRoutes._post_youtube,
        "/api/youtube/bulk-start": ServiceRoutes._post_youtube,
        "/api/youtube/bulk-cancel": ServiceRoutes._post_youtube,
        "/api/youtube/upload-cancel": ServiceRoutes._post_youtube,
        "/api/youtube/video-status": ServiceRoutes._post_youtube,
        "/api/youtube/disconnect": ServiceRoutes._post_youtube,
        "/api/profiles/machine": ServiceRoutes._post_machine,
        "/api/admin/tts": ServiceRoutes._post_tts,
        "/api/admin/tts/try": ServiceRoutes._post_tts_try,
        "/api/profiles/create": _post_profiles,
        "/api/profiles/update": _post_profiles,
        "/api/profiles/delete": _post_profiles,
        "/api/profiles/clear-guest": _post_profiles,
        "/api/project-asset-upload": ProjectRoutes._post_project_asset_upload,
        "/api/video-upload": _post_video_upload,
        "/api/workspace/clips/file": _post_clip_file,
        "/api/project-asset-import": ProjectRoutes._post_project_asset_import,
        "/api/project/rename": ProjectRoutes._post_project_rename,
        "/api/workspace/clips": WorkspaceRoutes._post_workspace_clips,
        "/api/workspace/clips/bulk": WorkspaceRoutes._post_workspace_clips_bulk,
        "/api/workspace/clips/upload-mark": WorkspaceRoutes._post_workspace_clips_upload_mark,
        "/api/workspace/clips/thumbnail": WorkspaceRoutes._post_workspace_clips_thumbnail,
        "/api/thumbnail/preview": WorkspaceRoutes._post_thumbnail_preview,
        "/api/workspace/clips/schedule": WorkspaceRoutes._post_workspace_clips_schedule,
        "/api/workspace/clips/delete": WorkspaceRoutes._post_workspace_clips_delete,
        "/api/workspace/clips/restore": WorkspaceRoutes._post_workspace_clips_restore,
        "/api/workspace/clips/from-render": WorkspaceRoutes._post_workspace_clips_from_render,
        "/api/import": RenderRoutes._post_import,
        "/api/geminibrief": _post_geminibrief,
        "/api/render": RenderRoutes._post_render,
        "/api/render/cancel": RenderRoutes._post_render_cancel,
        "/api/render/plan": RenderRoutes._post_render_plan,
        "/api/result-reply": _post_result_reply,
        "/api/results-reply": _post_results_reply,
        "/api/rubrics/create": ServiceRoutes._post_rubrics,
        "/api/rubrics/delete": ServiceRoutes._post_rubrics,
        "/api/rubrics/open": ServiceRoutes._post_rubrics,
        "/api/admin/settings": ServiceRoutes._post_admin,
        "/api/admin/gemini/test": ServiceRoutes._post_admin,
        "/api/admin/template": ServiceRoutes._post_admin,
        "/api/autopilot/settings": ServiceRoutes._post_autopilot,
        "/api/autopilot/check": ServiceRoutes._post_autopilot,
        "/api/autopilot/start": ServiceRoutes._post_autopilot,
        "/api/autopilot/retry": ServiceRoutes._post_autopilot,
        "/api/autopilot/cancel": ServiceRoutes._post_autopilot,
        "/api/autopilot/clear": ServiceRoutes._post_autopilot,
        "/api/autopilot/rerun": ServiceRoutes._post_autopilot,
        "/api/autopilot/reply": ServiceRoutes._post_autopilot,
        "/api/claude/settings": ServiceRoutes._post_claude,
        "/api/claude/test": ServiceRoutes._post_claude,
        "/api/claude/plan": ServiceRoutes._post_claude,
        "/api/claude/find": ServiceRoutes._post_claude,
        "/api/claude/cancel": ServiceRoutes._post_claude,
        "/api/preview": RenderRoutes._post_preview,
        "/api/transcribe": RenderRoutes._post_transcribe,
        "/api/diarize": RenderRoutes._post_diarize,
        "/api/open-folder": RenderRoutes._post_open_folder,
        "/api/credit": WorkspaceRoutes._post_credit,
        "/api/workspace/sources/delete": WorkspaceRoutes._post_workspace_sources_delete,
    }


def _sweep_temp() -> int:
    """Clean up temp wavs left behind by forcefully terminated jobs.
    These files can be hundreds of MB and serve no purpose after the
    server is shut down.

    Only wavs with a job id suffix (8 hex) are swept -- those are written
    by _run_transcribe. wavs from `klipian transcribe --keep-audio` use a
    16-hex fingerprint and are intentionally kept by the user, don't
    delete those."""
    n = 0
    # Half-uploaded videos (Add video, interrupted by closing the server).
    for part in SOURCES.glob("*.part"):
        try:
            part.unlink()
            n += 1
        except OSError:
            pass
    pola = re.compile(r"\.[0-9a-f]{8}\.wav$")
    for w in CACHE_DIR.glob("*.wav"):
        if not pola.search(w.name):
            continue
        try:
            w.unlink()
            n += 1
        except OSError:
            pass
    return n


def serve(port: int = 5177) -> int:
    # a crash inside native code (OpenCV, torch) leaves a trace in the log instead of the process just vanishing
    faulthandler.enable()
    _load_dotenv()
    leftover = _sweep_temp()
    # The workspace as it was before profiles becomes the profile "podcast" (once;
    # backed up and checked, see profiles.migrate_legacy). The server has just started,
    # so no job is running.
    _profiles.migrate_legacy(log=lambda m: print(f"  {m}"))
    _profiles.ensure_dirs(_paths.GUEST)
    _autopilot.resume_all(_autopilot_deps.RealDeps)       # runs that were going when the server stopped go on
    srv = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    print("")
    print(f"  klipian  ->  http://127.0.0.1:{port}")
    print(f"  serving {ROOT}")
    if leftover:
        print(f"  cleaned up {leftover} leftover temp audio file(s)")
    print("  Ctrl+C to stop")
    print("")
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        print("\n  stopped\n")
    return 0
