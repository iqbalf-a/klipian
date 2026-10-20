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

import contextvars
import importlib
import json
import mimetypes
import os
import re
import shutil
import subprocess
import sys
import threading
import time
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlparse

from .cache import Cache
from .models import Transcript
from . import compose as composer
from . import ffmpeg_tools
from . import render as engine
from . import credits as credits_mod
from .schedule import (CLIPS_LOCK, bulk_update as _bulk_update, delete_rows as _delete_rows,
                       restore_rows as _restore_rows, scheduled_files as _scheduled_files,
                       project_of_folder as _project_of_folder, with_missing_flags as _with_missing_flags, created_of as _created_of, load_clips as _load_clips,
                       migrate_created as _migrate_created, save_clips as _save_clips)
from . import cues as cues_mod
from . import roundtrip
from .jobs import style_with_profile as _style_with_profile
from .jobs import (ACTIVE_TRANSCRIBES, CANCELLED, JOBS, LOCK, MAX_JOBS, _clip_words,
                   _register_job, _run_diarize, _run_render, _run_transcribe,
                   _spans_from_clip)
from . import paths as _paths
from . import youtube as _youtube
from . import profiles as _profiles
from . import buildid as _buildid  # noqa: F401  (STARTED is taken here, at start)
from .paths import (ASSETS, CACHE_DIR, OUT_ROOT, ROOT, SOURCES, WORKSPACE, find_video,
                    safe_dirname)
from .projects import (PROJECTS, PROJECTS_LOCK, _all_projects,
                       _free_name, _migrate_project, _new_project_id, _primary_video,
                       _project_assets_dir, _project_file, _project_summary,
                       _read_project, _write_project)

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
ASSETS_DIR = ASSETS
# Quick preview (/api/preview): how many seconds of the clip are actually
# rendered through ffmpeg, with the EXACT SAME caption+watermark filters
# as the full render -- not just a CSS preview in the browser, which once
# proved it could differ from the real ASS/ffmpeg output (see watermark
# opacity bug). 5 seconds is enough to see the style, but short enough to
# stay "quick".
PREVIEW_MAX_SECONDS = 5.0


# Endpoints handled by one shared block in do_POST -- see the comment
# there. Each entry: (module, function, extra request key or None,
# response key, 404 message when the result is empty or None).
RANGE_ENDPOINTS = {
    "/api/facetrack":     ("facebox", "track_crops", "crop", "points", None),
    "/api/speakerlocate": ("facebox", "locate_speaker", "size", "crop",
                           "no speaker detected"),
    "/api/headtrack":     ("facebox", "track_head", "crop", "keyframes",
                           "not enough tracking data"),
    "/api/scenecut":      ("scenecut", "detect_cuts", None, "cuts", None),
}


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


def _prune_previews(folder: "Path", keep: "Path", max_age: float = 3600) -> None:
    """Delete stale quick-preview files so the unique-name scheme doesn't
    just accumulate MP4s forever. Only touches this folder, only files
    matching the preview naming, and never one younger than `max_age`
    (another request could still be writing or serving it). Failures are
    ignored on purpose -- a preview that can't be cleaned up must not fail
    the preview the user actually asked for."""
    now = time.time()
    for f in folder.glob("_preview.*"):
        if f == keep:
            continue
        try:
            if now - f.stat().st_mtime > max_age:
                f.unlink()
        except OSError:
            pass


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
    dest = CACHE_DIR / "thumbs" / safe_dirname(video.stem) / (
        f"{int(seconds * 10)}-{int(crop['left'])}-{int(crop['top'])}"
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


def _source_duration(video: Path, cache: Cache) -> float | None:
    """Length in seconds, read by ffprobe once per file (cached by the file's
    fingerprint) so the dashboard doesn't probe gigabytes on every load.
    None when the file can't be read."""
    path = cache.probe_path(video)
    try:
        return float(json.loads(path.read_text(encoding="utf-8"))["duration"])
    except (OSError, ValueError, KeyError, TypeError):
        pass
    try:
        from .ffmpeg_tools import probe
        duration = float(probe(video).duration)
    except Exception:                          # noqa: BLE001
        return None
    try:
        path.write_text(json.dumps({"duration": duration}), encoding="utf-8")
    except OSError:
        pass
    return duration


# POSTs whose body is a file, not JSON (see Handler._guard).
RAW_UPLOADS = {"/api/video-upload", "/api/project-asset-upload"}

def _fill_candidate_cues(data: dict) -> None:
    """Give the suggestions a project already holds the `cues` they would have
    got on import (cues.for_range, the same rule), when they predate cues. Done
    as the project is read, in the response only: the file is not touched, and
    the editor writes them with its next real save. Only when the sound
    detection has run for that video: a list without the sounds would be
    stored as if it were complete."""
    cache = Cache(CACHE_DIR)
    files = {a.get("id"): a.get("file") for a in data.get("assets") or []
             if isinstance(a, dict) and (a.get("kind") or "video") == "video"}
    loaded: dict[str, dict | None] = {}
    for cand in data.get("candidates") or []:
        if not isinstance(cand, dict) or "cues" in cand:
            continue
        name = files.get(cand.get("asset")) or _primary_video(data)
        if name not in loaded:
            video = find_video(name) if name else None
            loaded[name] = cues_mod.load(video, cache) if video else None
        info = loaded[name]
        if not info or info["status"]["audio"] != "ok":
            continue
        try:
            start, end = float(cand["startSec"]), float(cand["endSec"])
        except (KeyError, TypeError, ValueError):
            continue
        cand["cues"] = cues_mod.for_range(info["cues"], start, end)


VIDEO_EXT = {".mp4", ".mkv", ".mov", ".webm"}
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

class Handler(BaseHTTPRequestHandler):
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
        if pid == _paths.GUEST:
            _profiles.ensure_dirs(pid)             # made on first use (and after "Clear guest data")
        if pid == _paths.GUEST and (path.startswith("/api/workspace/clips") or path.startswith("/api/youtube")):
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

    def _youtube_reply(self, fn, *args):
        try:
            return self._send_json({"ok": True, **fn(*args)})
        except _youtube.YouTubeError as exc:
            return self._send_json({"error": exc.message, "code": exc.code, "ok": False}, 400)
        except OSError as exc:
            return self._send_json({"error": f"could not do that: {exc}"}, 500)

    def _get_youtube_status(self):
        q = parse_qs(urlparse(self.path).query)
        return self._youtube_reply(_youtube.check if (q.get("check") or [""])[0] == "1" else _youtube.status)

    def _get_youtube_connect_state(self):
        q = parse_qs(urlparse(self.path).query)
        return self._send_json(_youtube.connect_state((q.get("id") or [""])[0]))

    def _post_youtube(self):
        action = urlparse(self.path).path.rsplit("/", 1)[-1]
        try:
            req = self._read_json()
        except Exception as exc:               # noqa: BLE001
            return self._send_json({"error": str(exc)}, 400)
        if action == "client":
            # The contents come from a file the person chose; they are checked and kept, never echoed.
            def put():
                _youtube.save_client_secret(str(req.get("text") or ""))
                return _youtube.status()
            return self._youtube_reply(put)
        if action == "connect":
            return self._youtube_reply(lambda: {"id": _youtube.start_connect()})
        if action == "check":
            return self._youtube_reply(_youtube.check)
        if action == "disconnect":
            return self._youtube_reply(_youtube.disconnect)
        return self._send_json({"error": "unknown endpoint"}, 404)

    def _post_profiles(self):
        """create / update / delete / clear-guest. None needs a profile in the header."""
        try:
            req = self._read_json()
        except Exception as exc:               # noqa: BLE001
            return self._send_json({"error": str(exc)}, 400)
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
                                "guest": _profiles.read_meta(_paths.GUEST)})

    def _get_history(self):
        # History is read from the out/ folder contents, not session
        # memory: files that actually exist on disk are the honest
        # history, and persist across page reloads or server restarts.
        item = []
        for mp4 in OUT_ROOT.glob("*/*.mp4"):
            # Quick previews are not renders (they live in cache/previews/),
            # but the leading-underscore check also hides the _preview.mp4
            # files older builds left in out/ -- those used to appear in
            # History and on the workspace dashboard as real output.
            if mp4.name.startswith("_"):
                continue
            try:
                st = mp4.stat()
            except OSError:
                continue
            item.append({
                "file": mp4.name,
                "video": mp4.parent.name,
                "folder": str(mp4.parent),
                "url": f"/workspace/out/{mp4.parent.name}/{mp4.name}?profile={_paths.current_profile()}",
                "mb": round(st.st_size / 1048576, 1),
                "at": int(st.st_mtime),
                # When the file was made (the modified time where the system
                # keeps no creation time): what the dashboard's Created column shows.
                "created": int(getattr(st, "st_birthtime", None) or st.st_mtime),
            })
        item.sort(key=lambda x: x["created"], reverse=True)   # newest first
        # Which files the upload schedule has a row for (by project and file name).
        pairs, loose = _scheduled_files()
        for it in item:
            pid = _project_of_folder(it["video"])
            it["scheduled"] = (pid, it["file"]) in pairs or it["file"] in loose
        return self._send_json({"render": item})

    def _get_projects(self):
        # Listing for the homepage. Corrupted entries are silently
        # skipped: one bad file must not crash the entire listing.
        item = []
        for f, _ in _all_projects():
            r = _project_summary(f)
            # A project with no video left is still a project (ian).
            if r and r.get("id"):
                item.append(r)
        item.sort(key=lambda x: x["at"], reverse=True)
        return self._send_json({"project": item})

    def _get_project(self):
        # By id: what the editor holds once a project is open, and what
        # /edit/<id> carries.
        q = parse_qs(urlparse(self.path).query)
        pid = (q.get("id") or [""])[0]
        if not pid:
            return self._send_json({"error": "id required"}, 400)
        f = _project_file(pid)
        if not f or not f.is_file():
            return self._send_json({"error": "not found"}, 404)
        try:
            data = json.loads(f.read_text(encoding="utf-8"))
        except ValueError:
            return self._send_json({"error": "project file is corrupt"}, 500)
        # Migrating on READ, and writing back, means a project gains its
        # id the first time it is opened rather than the first time it
        # is saved -- so the id already exists for anything that asks
        # between opening and the next save (the render below does).
        data, changed = _migrate_project(data)
        # The file's name IS the id; a hand-edited `id` inside it can't
        # be allowed to point the browser at some other file.
        if data.get("id") != f.stem:
            data["id"] = f.stem
            changed = True
        if changed:
            try:
                with PROJECTS_LOCK:
                    _write_project(f, data)
            except OSError:
                # Best-effort: the request still answers with a migrated
                # dict even if the disk write fails, and the next save
                # will carry it.
                pass
        _fill_candidate_cues(data)
        return self._send_json(data)

    def _get_workspace_clips(self):
        # Rows from before the Created column get one now (once; see
        # schedule.migrate_created).
        from_file, from_at = _migrate_created()
        if from_file or from_at:
            print(f"klipian: clips.json: gave {from_file + from_at} rows a createdAt "
                  f"({from_file} from their render file, {from_at} from their last save)")
        # `fileMissing` is worked out now, against what is in out/, and not stored.
        return self._send_json({"clip": _with_missing_flags(_load_clips())})

    def _get_workspace_assets(self):
        # Created if missing -- an empty folder is normal
        # (never added custom watermark/template), not an error.
        ASSETS_DIR.mkdir(parents=True, exist_ok=True)
        item = []
        for f in sorted(ASSETS_DIR.iterdir()):
            if f.is_file():
                st = f.stat()
                ext = f.suffix.lower()
                item.append({"name": f.name,
                             # What the timeline can use it as (compose.py).
                             "kind": ("image" if ext in composer.IMAGE_EXT
                                      else "sound" if ext in composer.SOUND_EXT else "other"),
                             "kb": round(st.st_size / 1024, 1),
                             "at": int(st.st_mtime)})
        return self._send_json({"asset": item})

    def _get_workspace_sources(self):
        """The raw videos in workspace/sources/ for the dashboard: size,
        length, when each came in, whether it has a transcript, and which
        projects use it (so a video nothing uses is easy to see)."""
        folder = SOURCES
        folder.mkdir(parents=True, exist_ok=True)
        cache = Cache(CACHE_DIR)
        credit = credits_mod.load(folder)
        used: dict[str, list[dict]] = {}
        for f, data in _all_projects():
            names = {a.get("file") for a in data.get("assets") or []
                     if isinstance(a, dict) and (a.get("kind") or "video") == "video" and a.get("file")}
            if data.get("video"):
                names.add(data["video"])
            for n in names:
                used.setdefault(n, []).append({"id": f.stem, "name": data.get("name") or f.stem})
        item = []
        for f in sorted(folder.iterdir(), key=lambda p: p.name.lower()):
            if not f.is_file() or f.suffix.lower() not in VIDEO_EXT:
                continue
            st = f.stat()
            item.append({
                "name": f.name,
                "bytes": st.st_size,
                # When it came in: the creation time where the platform keeps
                # one (a copy gets a new one; the modified time is the camera's).
                "at": int(getattr(st, "st_birthtime", None) or st.st_mtime),
                "duration": _source_duration(f, cache),
                "transcribed": cache.find_transcript(f) is not None,
                "used_by": sorted(used.get(f.name, []), key=lambda u: u["name"].lower()),
                "credit": credit.get(f.name) or {},
                "credit_line": credits_mod.line(credit.get(f.name)),
            })
        return self._send_json({"source": item, "folder": str(folder)})

    def _get_credits(self):
        """Every video's credit and the line built from it (credits.py), for the
        screens that show where a video came from."""
        credit = credits_mod.load()
        return self._send_json({"credit": {
            name: {**c, "line": credits_mod.line(c), "short": credits_mod.short(c)}
            for name, c in credit.items()}})

    def _post_credit(self):
        """Set or clear one video's credit: {file, platform, creator, title, url}.
        All four empty removes it."""
        try:
            req = self._read_json()
        except Exception as exc:               # noqa: BLE001
            return self._send_json({"error": str(exc)}, 400)
        name = str(req.get("file") or "")
        if Path(name).suffix.lower() not in VIDEO_EXT or not find_video(name):
            return self._send_json({"error": f"{name or 'that video'} is not in workspace/sources/"}, 404)
        try:
            credits_mod.save(name, req)
        except OSError as exc:
            return self._send_json({"error": f"could not save the credit ({exc})"}, 500)
        c = credits_mod.load().get(name) or {}
        return self._send_json({"ok": True, "credit": c, "line": credits_mod.line(c)})

    def _get_project_assets(self):
        # This project's own images and sounds (projects/<id>/assets/).
        folder = _project_assets_dir((parse_qs(urlparse(self.path).query).get("id") or [""])[0])
        if folder is None:
            return self._send_json({"error": "invalid id"}, 400)
        item = []
        if folder.is_dir():
            for f in sorted(folder.iterdir()):
                ext = f.suffix.lower()
                if f.is_file() and ext in (composer.IMAGE_EXT | composer.SOUND_EXT):
                    item.append({"name": f.name,
                                 "kind": "image" if ext in composer.IMAGE_EXT else "sound",
                                 "kb": round(f.stat().st_size / 1024, 1)})
        return self._send_json({"asset": item})

    def _get_project_asset_file(self):
        # One of them, for the editor's preview. By name only; .name
        # strips any path a caller put in it.
        q = parse_qs(urlparse(self.path).query)
        folder = _project_assets_dir((q.get("id") or [""])[0])
        name = Path((q.get("name") or [""])[0]).name
        f = folder / name if folder is not None and name else None
        if not f or f.suffix.lower() not in (composer.IMAGE_EXT | composer.SOUND_EXT) or not f.is_file():
            return self._send_json({"error": "not found"}, 404)
        return self._send_file(f, mimetypes.guess_type(f.name)[0] or "application/octet-stream")

    def _get_workspace_asset_file(self):
        # One image/sound from the shared library workspace/assets/ -- the
        # thumbnails in the Assets screen's "import" list.
        # By NAME only, through this endpoint rather than as a static
        # folder, for the reason given at ASSETS_DIR: the user's own files
        # don't become URLs of their own. Path(...).name strips any path.
        name = Path((parse_qs(urlparse(self.path).query).get("name") or [""])[0]).name
        f = ASSETS_DIR / name
        ext = f.suffix.lower()
        if not name or ext not in (composer.IMAGE_EXT | composer.SOUND_EXT) or not f.is_file():
            return self._send_json({"error": "not found"}, 404)
        mime = mimetypes.guess_type(f.name)[0] or "application/octet-stream"
        return self._send_file(f, mime)

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
            return self._send_json({"error": "No transcript yet. Click Find clips on the Analyze screen to make one."}, 404)
        mode = (q.get("mode") or [""])[0] or _profiles.defaults().get("rubric") or "dialog"
        rubric = roundtrip.RUBRICS.get(mode, roundtrip.RUBRICS["dialog"])
        cues_data = cues_mod.load(find_video(name), Cache(CACHE_DIR))
        credit = credits_mod.load().get(name)
        return self._send_text(roundtrip.build_brief(
            transcript, roundtrip.read_rubric(rubric), name, cues_data, credit),
            "text/markdown")

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
        if path.rstrip("/") == "/profiles":
            path = "/ui/profiles.html"
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
        "/api/youtube/status": _get_youtube_status,
        "/api/youtube/connect-state": _get_youtube_connect_state,
        "/api/probe": _get_probe,
        "/api/history": _get_history,
        "/api/projects": _get_projects,
        "/api/project": _get_project,
        "/api/workspace/clips": _get_workspace_clips,
        "/api/workspace/assets": _get_workspace_assets,
        "/api/workspace/sources": _get_workspace_sources,
        "/api/credits": _get_credits,
        "/api/project-assets": _get_project_assets,
        "/api/project-asset-file": _get_project_asset_file,
        "/api/workspace/asset-file": _get_workspace_asset_file,
        "/api/cache": _get_cache,
        "/api/transcript": _get_transcript,
        "/api/cues": _get_cues,
        "/api/brief": _get_brief,
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

    def _post_project_restore(self):
        """Undo deleting a project: the newest copy in projects/.trash/ comes back."""
        try:
            req = self._read_json()
        except Exception as exc:               # noqa: BLE001
            return self._send_json({"error": str(exc)}, 400)
        f = _project_file(req.get("id"))
        if f is None:
            return self._send_json({"error": "invalid id"}, 400)
        with PROJECTS_LOCK:
            copies = sorted((PROJECTS / ".trash").glob(f"{f.stem}.*.json"), key=lambda p: p.stat().st_mtime) \
                if (PROJECTS / ".trash").is_dir() else []
            if f.is_file():
                return self._send_json({"ok": True, "restored": False})
            if not copies:
                return self._send_json({"error": "nothing to restore"}, 404)
            shutil.copy2(copies[-1], f)
            copies[-1].unlink(missing_ok=True)
        return self._send_json({"ok": True, "restored": True})

    def _post_project(self):
        try:
            req = self._read_json()
        except Exception as exc:               # noqa: BLE001
            return self._send_json({"error": str(exc)}, 400)
        # The project's first video: from its assets, or `video` from a
        # client older than them. Filename only, no path components --
        # the name from the client must not determine WHERE anything is
        # looked up or written.
        name = Path(str(_primary_video(req) or "").strip()).name
        if req.get("video"):
            req["video"] = Path(str(req["video"])).name
        pid = req.get("id")
        PROJECTS.mkdir(parents=True, exist_ok=True)
        with PROJECTS_LOCK:
            # Which file: the id the client holds, or -- for the first save
            # of a project the client has no id for yet, which says `new` --
            # none yet. Never matched to another project by its video: two
            # projects can share an episode.
            if pid:
                f = _project_file(pid)
                if f is None:
                    return self._send_json({"error": "invalid id"}, 400)
            elif req.get("new"):
                f = None
            else:
                return self._send_json({"error": "id required (or new: true for a new project)"}, 400)

            if req.get("delete"):
                if f:
                    # A copy first (workspace/projects/.trash/): "Undo" puts it back
                    # (/api/project/restore), and so can a person by hand.
                    if f.is_file():
                        trash = PROJECTS / ".trash"
                        trash.mkdir(parents=True, exist_ok=True)
                        shutil.copy2(f, trash / f"{f.stem}.{int(time.time())}.json")
                        for old in sorted(trash.glob("*.json"), key=lambda p: p.stat().st_mtime)[:-20]:
                            old.unlink(missing_ok=True)
                    f.unlink(missing_ok=True)
                return self._send_json({"ok": True, "deleted": True})

            if not name and not pid:
                # Only a NEW project needs one: its first video is what
                # starts it. An existing one may have had all removed.
                return self._send_json({"error": "video required"}, 400)
            if f is None:
                f = PROJECTS / f"{_new_project_id()}.json"

            req["at"] = int(time.time())
            # The project's IDENTITY is the server's to keep, not the
            # client's to resend. projectState() in the browser builds
            # its object from scratch and doesn't carry the name, so a
            # plain write would erase it on the next autosave -- which
            # is what happened with the id before this: minted on open,
            # wiped seconds later. The name only changes through
            # /api/project/rename. Assets too, for now: the editor can't
            # add one yet, so anything it doesn't send is kept.
            old = _read_project(f) if f.is_file() else None
            if old:
                for key in ("name", "createdAt", "outSlug"):
                    if old.get(key):
                        req[key] = old[key]
                # Kept only when the client didn't send a list at all
                # (an older client). An EMPTY list is an answer: every
                # asset was removed, which a project is allowed (ian).
                if "assets" not in req and old.get("assets"):
                    req["assets"] = old["assets"]
            req["id"] = f.stem
            req.pop("delete", None)
            req.pop("new", None)
            req, _ = _migrate_project(req)
            _write_project(f, req)
        return self._send_json({"ok": True, "id": f.stem})

    def _post_project_asset_upload(self):
        # An image or sound dropped on the Assets screen, saved into THIS
        # project's own folder (projects/<id>/assets/) -- a project's
        # stickers and stings belong to it, not to a pool every project
        # draws from (ian). Raw body, the file's name in the query: no
        # multipart parsing for one file.
        q = parse_qs(urlparse(self.path).query)
        folder = _project_assets_dir((q.get("id") or [""])[0])
        if folder is None or not _project_file(folder.parent.name).is_file():
            return self._send_json({"error": "save the project first"}, 400)
        name = Path((q.get("name") or [""])[0]).name.strip()
        ext = Path(name).suffix.lower()
        if not name or ext not in (composer.IMAGE_EXT | composer.SOUND_EXT):
            return self._send_json({"error": "only images (png, jpg, webp, gif) and sounds "
                                              "(mp3, wav, m4a, ogg, flac) can be added"}, 400)
        n = int(self.headers.get("Content-Length", 0))
        MAX_ASSET = 100 * 1024 * 1024
        if n <= 0 or n > MAX_ASSET:
            return self._send_json({"error": f"file must be 1 byte to {MAX_ASSET // 1048576} MB"}, 400)
        folder.mkdir(parents=True, exist_ok=True)
        dest = _free_name(folder, name)
        tmp = dest.with_name(dest.name + ".part")
        try:
            with open(tmp, "wb") as out:
                remaining = n
                while remaining > 0:
                    chunk = self.rfile.read(min(1 << 20, remaining))
                    if not chunk:
                        raise ConnectionError("upload ended early")
                    out.write(chunk)
                    remaining -= len(chunk)
            tmp.replace(dest)
        except (OSError, ConnectionError) as exc:
            tmp.unlink(missing_ok=True)
            return self._send_json({"error": f"could not save the file: {exc}"}, 500)
        return self._send_json({"ok": True, "name": dest.name,
                                "kind": "image" if ext in composer.IMAGE_EXT else "sound"})

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
                _profiles.place_source(tmp, dest)      # a link to another profile's identical copy, else a rename
        except (OSError, ConnectionError) as exc:
            tmp.unlink(missing_ok=True)
            return self._send_json({"error": f"could not save the file: {exc}"}, 500)
        return self._send_json({"ok": True, "name": dest.name, "existed": False,
                                "renamedFrom": asked if asked != name else None})

    def _drain(self, n: int) -> None:
        try:
            while n > 0:
                chunk = self.rfile.read(min(1 << 20, n))
                if not chunk:
                    break
                n -= len(chunk)
        except OSError:
            pass

    def _post_project_asset_import(self):
        # A file from the shared library (workspace/assets/: logos,
        # banners, templates) COPIED into the project's folder. A copy,
        # not a reference: editing or deleting the shared file later
        # must not change a project that already used it.
        try:
            req = self._read_json()
        except Exception as exc:               # noqa: BLE001
            return self._send_json({"error": str(exc)}, 400)
        folder = _project_assets_dir(req.get("id"))
        if folder is None or not _project_file(folder.parent.name).is_file():
            return self._send_json({"error": "save the project first"}, 400)
        name = Path(str(req.get("name") or "")).name
        src = ASSETS_DIR / name
        ext = src.suffix.lower()
        if not name or ext not in (composer.IMAGE_EXT | composer.SOUND_EXT) or not src.is_file():
            return self._send_json({"error": "not found in workspace/assets/"}, 404)
        folder.mkdir(parents=True, exist_ok=True)
        # Already imported once, byte-for-byte: reuse that copy rather
        # than pile up banner-2.png, banner-3.png on every click.
        same = folder / name
        if same.is_file() and same.read_bytes() == src.read_bytes():
            dest = same
        else:
            dest = _free_name(folder, name)
            try:
                shutil.copyfile(src, dest)
            except OSError as exc:
                return self._send_json({"error": f"could not copy the file: {exc}"}, 500)
        return self._send_json({"ok": True, "name": dest.name,
                                "kind": "image" if ext in composer.IMAGE_EXT else "sound"})

    def _post_project_rename(self):
        try:
            req = self._read_json()
        except Exception as exc:               # noqa: BLE001
            return self._send_json({"error": str(exc)}, 400)
        # Collapsed whitespace and a length cap: it's shown on a card
        # and in the topbar, and nothing about a name needs a newline.
        new_name = " ".join(str(req.get("name") or "").split())[:80]
        if not new_name:
            return self._send_json({"error": "name required"}, 400)
        f = _project_file(req.get("id"))
        if f is None:
            return self._send_json({"error": "invalid id"}, 400)
        with PROJECTS_LOCK:
            data = _read_project(f) if f.is_file() else None
            if data is None:
                return self._send_json({"error": "not found"}, 404)
            # outSlug is migrated in BEFORE the name changes, so a
            # project renamed before it ever had one still keeps the
            # render folder it already has.
            data, _ = _migrate_project(data)
            data["name"] = new_name
            _write_project(f, data)
        return self._send_json({"ok": True, "name": new_name})

    def _post_workspace_clips_from_render(self):
        """Add a render file that has no schedule row: {folder, file} (names inside
        out/, never paths). Never makes a second row for the same file."""
        try:
            req = self._read_json()
        except Exception as exc:               # noqa: BLE001
            return self._send_json({"error": str(exc)}, 400)
        folder, file_name = str(req.get("folder") or ""), str(req.get("file") or "")
        if (Path(folder).name != folder or Path(file_name).name != file_name
                or not file_name.lower().endswith(".mp4") or file_name.startswith("_")
                or not (OUT_ROOT / folder / file_name).is_file()):
            return self._send_json({"error": "that render file was not found"}, 404)
        from .jobs import add_render_to_schedule
        row_id, created, how = add_render_to_schedule(folder, file_name)
        return self._send_json({"ok": True, "id": row_id, "created": created, "how": how})

    def _post_workspace_clips_delete(self):
        """Delete rows ({ids}); the rows are kept in clips.trash.json for Undo."""
        try:
            req = self._read_json()
        except Exception as exc:               # noqa: BLE001
            return self._send_json({"error": str(exc)}, 400)
        ids = req.get("ids")
        if not isinstance(ids, list) or not ids or not all(isinstance(i, str) for i in ids):
            return self._send_json({"error": "ids must be a list of row ids"}, 400)
        try:
            gone = _delete_rows(ids, keep=req.get("trash") is not False)
        except OSError as exc:
            return self._send_json({"error": f"could not delete: {exc}"}, 500)
        return self._send_json({"ok": True, "deleted": gone})

    def _post_workspace_clips_restore(self):
        """Undo a delete ({ids}): the rows come back exactly as they were."""
        try:
            req = self._read_json()
        except Exception as exc:               # noqa: BLE001
            return self._send_json({"error": str(exc)}, 400)
        ids = req.get("ids")
        if not isinstance(ids, list) or not ids or not all(isinstance(i, str) for i in ids):
            return self._send_json({"error": "ids must be a list of row ids"}, 400)
        back = _restore_rows(ids)
        from .schedule import with_missing_flags
        return self._send_json({"ok": True, "restored": [r["id"] for r in back],
                                "clip": with_missing_flags(back)})

    def _post_workspace_clips_bulk(self):
        """One request for an action on many schedule rows: {ids, status, date?,
        time?}. One read-modify-write, one save (see schedule.bulk_update)."""
        try:
            req = self._read_json()
        except Exception as exc:               # noqa: BLE001
            return self._send_json({"error": str(exc)}, 400)
        ids = req.get("ids")
        if not isinstance(ids, list) or not ids or len(ids) > 5000 or not all(isinstance(i, str) for i in ids):
            return self._send_json({"error": "ids must be a list of row ids"}, 400)
        try:
            out = _bulk_update(ids, str(req.get("status") or ""), str(req.get("date") or ""),
                               str(req.get("time") or ""))
        except ValueError as exc:
            return self._send_json({"error": str(exc)}, 400)
        out["clip"] = _with_missing_flags(out["clip"])
        return self._send_json({"ok": True, **out})

    def _post_workspace_clips(self):
        try:
            req = self._read_json()
        except Exception as exc:               # noqa: BLE001
            return self._send_json({"error": str(exc)}, 400)

        cid = str(req.get("id") or "")

        # Lock the entire read-modify-write: clips.json is one file shared
        # by all requests, and this server is multi-threaded
        # (ThreadingHTTPServer). Without this, two overlapping edits can
        # clobber each other -- the second thread writes back the list it
        # read BEFORE the first thread's write finished, and the first
        # change vanishes without an error.
        #
        # Nothing writes to the socket inside this block. The delete
        # branch used to `return self._send_json(...)` while still
        # holding the lock, so a slow or stalled client kept every other
        # clips.json edit waiting on a network write.
        deleted = False
        if req.get("delete"):
            if not cid:
                return self._send_json({"error": "id required"}, 400)
            _delete_rows([cid])
            return self._send_json({"ok": True, "deleted": True})
        with CLIPS_LOCK:
            clips = _load_clips()

            if req.get("delete"):
                pass
            else:
                if not cid:
                    cid = uuid.uuid4().hex[:8]
                req["id"] = cid
                req["at"] = int(time.time())
                req.pop("fileMissing", None)       # derived on every read, never stored

                for i, c in enumerate(clips):
                    if c.get("id") == cid:
                        # createdAt belongs to the server and never changes: an
                        # edit (the page resends the row) keeps the stored one.
                        req["createdAt"] = c.get("createdAt") or _created_of(c)
                        clips[i] = req
                        break
                else:
                    req["createdAt"] = int(time.time())
                    clips.append(req)

                _save_clips(clips)
        if deleted:
            return self._send_json({"ok": True, "deleted": True})
        return self._send_json({"ok": True, "id": cid, "createdAt": req.get("createdAt")})

    def _post_import(self):
        """Claude's pasted reply -> clip candidates -- see roundtrip.parse_reply."""
        try:
            req = self._read_json()
            name = str(req.get("video") or "")
            transcript = _transcript_for(name)
        except Exception as exc:               # noqa: BLE001
            return self._send_json({"error": str(exc)}, 400)
        # No transcript is not an error here: the cut points just aren't snapped.
        try:
            candidates = roundtrip.parse_reply(
                transcript.words if transcript else [], str(req.get("text") or ""),
                cues_mod.load(find_video(name), Cache(CACHE_DIR))["cues"])
        except ValueError as exc:
            return self._send_json({"error": str(exc)}, 400)
        return self._send_json({"candidates": candidates})

    def _post_render(self):
        try:
            req = self._read_json()
            if not req.get("clips"):
                return self._send_json({"error": "no clips"}, 400)
        except Exception as exc:               # noqa: BLE001
            return self._send_json({"error": str(exc)}, 400)

        job_id = uuid.uuid4().hex[:8]
        _register_job(job_id, {"state": "running", "done": 0,
                           "total": len(req["clips"]), "index": 0,
                           "current": "", "result": [], "error": None})
        threading.Thread(target=contextvars.copy_context().run, args=(_run_render, job_id, req),
                         daemon=True).start()
        return self._send_json({"id": job_id})

    def _post_render_cancel(self):
        try:
            req = self._read_json()
        except Exception as exc:               # noqa: BLE001
            return self._send_json({"error": str(exc)}, 400)
        job_id = str(req.get("id") or "")
        # Mark for cancellation; _run_render / render() checks it and
        # kills the running ffmpeg. Idempotent -- marking an already-
        # finished job is harmless (discarded in finally).
        # Only mark jobs that are STILL RUNNING. The button stays on
        # screen until the next poll, so cancelling an already-finished
        # job used to add its id here AFTER _run_render's finally had
        # discarded it -- and unlike JOBS, which is capped at MAX_JOBS
        # and pruned, CANCELLED had neither, so those ids stayed
        # forever. Also taken under LOCK now, for the same reason the
        # JOBS lookup beside it is.
        with LOCK:
            running = JOBS.get(job_id, {}).get("state") == "running"
            if running:
                CANCELLED.add(job_id)
        return self._send_json({"ok": running})

    def _post_preview(self):
        # REAL render through ffmpeg, just clipped short -- not a CSS
        # imitation in the browser. Synchronous (not a job queue like
        # /api/render): PREVIEW_MAX_SECONDS is short enough to finish
        # in seconds, and ThreadingHTTPServer already handles each
        # request in its own thread, so other requests (queue polling,
        # etc.) aren't blocked waiting for this.
        try:
            req = self._read_json()
            k = req.get("clip")
            if not isinstance(k, dict):
                return self._send_json({"error": "no clip"}, 400)
        except Exception as exc:                   # noqa: BLE001
            return self._send_json({"error": str(exc)}, 400)

        video = find_video(req.get("video", ""))
        if not video:
            return self._send_json(
                {"error": f"{req.get('video')} is not in a folder the "
                           f"server can reach."}, 404)

        try:
            all_spans = _spans_from_clip(k)
            start_from = float(req.get("startFrom") or 0)
            spans = engine.trim_for_preview(all_spans, PREVIEW_MAX_SECONDS, start_from)
            if not spans and start_from > 0:
                # Scrub landed exactly at the clip tail (less than one
                # second remaining) -- rather than failing, show from
                # the beginning.
                spans = engine.trim_for_preview(all_spans, PREVIEW_MAX_SECONDS)
                start_from = 0.0
            if not spans:
                return self._send_json({"error": "Clip has no spans."}, 400)

            from .ffmpeg_tools import probe
            info = probe(video)

            crop = k.get("crop") or {}
            job = engine.RenderJob(
                title="_preview",
                spans=spans,
                crop=engine.CropBox(
                    left=crop.get("left", 37), top=crop.get("top", 4),
                    width=crop.get("width", 26), height=crop.get("height", 92)),
                **engine.picture_options(k),
                out_width=int(k.get("width", 1080)),
            )

            # Same reasoning as the render path above: an unreadable
            # transcript is reported, not silently turned into "no
            # captions". Returned in the response body since this
            # endpoint is synchronous and has no job to hang it on.
            words = []
            warning = ""
            try:
                cache = Cache(CACHE_DIR)
                tpath = cache.find_transcript(video)
                if tpath and tpath.exists():
                    words = Transcript.load(tpath).words
            except (OSError, ValueError, KeyError, TypeError) as exc:  # noqa: BLE001
                warning = (f"captions skipped: the transcript exists but "
                           f"could not be read ({exc})")
            clip_words = _clip_words(k, words)

            style = _style_with_profile(k.get("style") if isinstance(k.get("style"), dict) else None)

            # Previews are disposable, but the name can NOT be fixed:
            # /api/preview is synchronous with no lock or job registry,
            # so two clicks in a row ran two ffmpeg processes writing
            # the same _preview.mp4, while render()'s `finally` deleted
            # the shared _preview.ass out from under whichever one was
            # still reading it (and _concat_filter's _preview.track0.cmd
            # collided the same way). A per-request id closes all three.
            # Same fix the transcribe path already applies to its temp
            # wav -- see the job-id suffix there.
            #
            # They live in cache/previews/, not in out/: a preview is not a
            # render, and out/ is what History and the dashboard list. (They
            # used to sit in out/<video name>/.preview/, which put a folder
            # named after the VIDEO back into out/ -- and a multi-video
            # project has no one video to name it after.)
            pdir = CACHE_DIR / "previews"
            pdir.mkdir(parents=True, exist_ok=True)
            tag = uuid.uuid4().hex[:8]
            dest = pdir / f"_preview.{tag}.mp4"
            _prune_previews(pdir, keep=dest)
            engine.render(video, job, dest, words=clip_words, style=style,
                          src_width=info.width, src_height=info.height,
                          has_audio=info.has_audio, verbose=False)

            # The Timeline's elements, same second pass as a full render
            # (compose.py), re-timed to this piece: `overlayBase` is
            # where the piece's run starts in the whole clip, start_from
            # how far into the run the piece begins.
            base = float(req.get("overlayBase") or 0) + start_from
            media_dir = _project_assets_dir(req.get("project")) or (pdir / ".no-assets")
            elements = composer.clean_elements(
                composer.shift_elements(k.get("overlays"), base), job.duration, media_dir)
            volumes = composer.clean_volumes(
                composer.shift_elements(k.get("volumes"), base), job.duration)
            if elements or volumes:
                raw = dest.with_name(dest.stem + ".pass1.mp4")
                dest.replace(raw)
                out_h = job.out_width * 16 // 9
                try:
                    composer.compose(raw, dest, width=job.out_width, height=out_h - (out_h & 1),
                                     duration=job.duration, elements=elements,
                                     volumes=volumes, quality=job.quality,
                                     has_audio=info.has_audio)
                except Exception as exc:           # noqa: BLE001
                    dest.unlink(missing_ok=True)
                    raw.replace(dest)
                    warning = (warning + " · " if warning else "") + \
                        f"timeline elements skipped: {exc}"
                finally:
                    raw.unlink(missing_ok=True)
        except Exception as exc:                   # noqa: BLE001
            return self._send_json({"error": str(exc)}, 500)

        return self._send_json({
            "url": f"/workspace/cache/previews/{dest.name}",
            "duration": round(job.duration, 1),
            **({"warning": warning} if warning else {}),
        })

    def _post_transcribe(self):
        try:
            req = self._read_json()
        except Exception as exc:               # noqa: BLE001
            return self._send_json({"error": str(exc)}, 400)
        name = req.get("video", "")
        # Entire check-then-register in one lock so no two threads both
        # slip through and create duplicate jobs, and so the JOBS insert
        # doesn't race with the prune that iterates JOBS.
        with LOCK:
            if len(JOBS) > MAX_JOBS:
                old = [k for k, v in JOBS.items()
                       if v.get("state") in ("done", "failed")]
                for k in old[:len(old) // 2]:
                    JOBS.pop(k, None)
            previous = ACTIVE_TRANSCRIBES.get(name)
            if previous and JOBS.get(previous, {}).get("state") == "running":
                return self._send_json({"id": previous, "already_running": True})
            job_id = uuid.uuid4().hex[:8]
            ACTIVE_TRANSCRIBES[name] = job_id
            JOBS[job_id] = {"state": "running", "stage": "start", "percent": 0,
                            "position": 0, "duration": 0, "file": None,
                            "cached": False, "exact": False, "error": None}
        threading.Thread(target=contextvars.copy_context().run, args=(_run_transcribe, job_id, req),
                         daemon=True).start()
        return self._send_json({"id": job_id})

    def _post_diarize(self):
        try:
            req = self._read_json()
        except Exception as exc:               # noqa: BLE001
            return self._send_json({"error": str(exc)}, 400)
        if not req.get("video"):
            return self._send_json({"error": "video required"}, 400)

        job_id = uuid.uuid4().hex[:8]
        _register_job(job_id, {"state": "running", "turns": [], "error": None,
                               "percent": 0, "stage": "start", "cached": False})
        threading.Thread(target=contextvars.copy_context().run, args=(_run_diarize, job_id, req),
                         daemon=True).start()
        return self._send_json({"id": job_id})

    def _post_open_folder(self):
        try:
            folder = Path(self._read_json().get("folder", "")).resolve()
            if not folder.is_dir():
                return self._send_json({"error": "folder not found"}, 404)
            # Prevent path traversal: only open folders inside the
            # project. Use is_relative_to, not startswith -- "klipian-other"
            # starts the same as "klipian" but is a different folder.
            if not folder.is_relative_to(ROOT.resolve()):
                return self._send_json(
                    {"error": "only folders inside the project can be opened"}, 403)
            if sys.platform == "win32":
                os.startfile(folder)           # noqa: S606
            elif sys.platform == "darwin":
                subprocess.Popen(["open", str(folder)])
            else:
                subprocess.Popen(["xdg-open", str(folder)])
            return self._send_json({"ok": True})
        except Exception as exc:               # noqa: BLE001
            return self._send_json({"error": str(exc)}, 500)

    # -- video-range analysis endpoints --------------------------
    # Four endpoints with an identical shape: read JSON, resolve the
    # video, parse start/end, reject an empty range, call ONE function,
    # wrap any failure in a 500. That preamble was written out four
    # times, so a fix to (say) the range check had to be made in four
    # places and could silently be applied to three. Each endpoint is
    # now only the part that actually differs.
    #
    # All four are synchronous rather than async jobs like /api/diarize:
    # scenecut finishes in under a second (ffmpeg's built-in scene
    # filter is far cheaper than per-frame face detection) and the three
    # facebox ones take a few seconds at most. ThreadingHTTPServer
    # already gives each request its own thread, so nothing else waits
    # meanwhile. If one of them ever gets slow enough to need a progress
    # bar, /api/diarize is the pattern to copy.
    def _post_range(self, path):
        module, fn_name, extra_key, out_key, empty_msg = RANGE_ENDPOINTS[path]
        try:
            req = self._read_json()
        except Exception as exc:               # noqa: BLE001
            return self._send_json({"error": str(exc)}, 400)
        video = find_video(req.get("video", ""))
        if not video:
            return self._send_json({"error": "video not found"}, 404)
        try:
            start = float(req.get("start", 0))
            end = float(req.get("end", 0))
        except (TypeError, ValueError):
            return self._send_json({"error": "invalid time"}, 400)
        if end <= start:
            return self._send_json({"error": "invalid range"}, 400)
        args = [video, start, end]
        if extra_key is not None:
            args.append(req.get(extra_key) or {})
        try:
            mod = importlib.import_module("." + module, __package__)
            result = getattr(mod, fn_name)(*args)
        except Exception as exc:               # noqa: BLE001
            return self._send_json({"error": str(exc)}, 500)
        # Some of these have a meaningful "ran fine, found nothing"
        # answer that is NOT an error condition on the server side but
        # is a 404 to the client; the others can't come back empty.
        if empty_msg and not result:
            return self._send_json({"error": empty_msg}, 404)
        return self._send_json({out_key: result})

    POST_ROUTES = {
        "/api/project": _post_project,
        "/api/project/restore": _post_project_restore,
        "/api/youtube/client": _post_youtube,
        "/api/youtube/connect": _post_youtube,
        "/api/youtube/check": _post_youtube,
        "/api/youtube/disconnect": _post_youtube,
        "/api/profiles/create": _post_profiles,
        "/api/profiles/update": _post_profiles,
        "/api/profiles/delete": _post_profiles,
        "/api/profiles/clear-guest": _post_profiles,
        "/api/project-asset-upload": _post_project_asset_upload,
        "/api/video-upload": _post_video_upload,
        "/api/project-asset-import": _post_project_asset_import,
        "/api/project/rename": _post_project_rename,
        "/api/workspace/clips": _post_workspace_clips,
        "/api/workspace/clips/bulk": _post_workspace_clips_bulk,
        "/api/workspace/clips/delete": _post_workspace_clips_delete,
        "/api/workspace/clips/restore": _post_workspace_clips_restore,
        "/api/workspace/clips/from-render": _post_workspace_clips_from_render,
        "/api/import": _post_import,
        "/api/render": _post_render,
        "/api/render/cancel": _post_render_cancel,
        "/api/preview": _post_preview,
        "/api/transcribe": _post_transcribe,
        "/api/diarize": _post_diarize,
        "/api/open-folder": _post_open_folder,
        "/api/credit": _post_credit,
    }


def _sweep_temp() -> int:
    """Clean up temp wavs left behind by forcefully terminated jobs.
    These files can be hundreds of MB and serve no purpose after the
    server is shut down.

    Only wavs with a job id suffix (8 hex) are swept -- those are written
    by _run_transcribe. wavs from `klipian transcribe --keep-audio` use a
    16-hex fingerprint and are intentionally kept by the user, don't
    delete those."""
    import re
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
    _load_dotenv()
    leftover = _sweep_temp()
    # The workspace as it was before profiles becomes the profile "podcast" (once;
    # backed up and checked, see profiles.migrate_legacy). The server has just started,
    # so no job is running.
    _profiles.migrate_legacy(log=lambda m: print(f"  {m}"))
    _profiles.ensure_dirs(_paths.GUEST)
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
