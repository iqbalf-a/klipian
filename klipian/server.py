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

import json
import mimetypes
import os
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
from . import render as engine

ROOT = Path(__file__).resolve().parent.parent
# All working files (source video, rendered output, cache, project, assets)
# live in THIS ONE folder -- not scattered (previously samples/out/cache/
# projects/ each at root), so new klipian users aren't confused about where
# to put videos (see workspace/README.md).
WORKSPACE = ROOT / "workspace"
SERVED_DIRS = ("ui", "prompts")   # folders under ROOT served as-is
# Workspace sub-folders accessible directly via URL /workspace/<...> --
# assets/ and schedule/ are deliberately excluded, same as projects/
# below: their contents must only be accessed via /api/workspace/... so
# file names don't become an attack surface on their own.
WORKSPACE_SERVED = ("samples", "out", "cache")

# Projects are NOT served as static files. Their contents can only be
# accessed via /api/project so file names don't become an attack surface.
PROJECTS = WORKSPACE / "projects"

# Operational content (upload schedule, clip status) -- not part of the
# render flow, and deliberately NOT static files, same as projects/ above.
CLIPS_PATH = WORKSPACE / "schedule" / "clips.json"
ASSETS_DIR = WORKSPACE / "assets"

# Render jobs currently / already running
JOBS: dict[str, dict] = {}
LOCK = threading.Lock()
# video -> running transcribe job id, so there aren't two jobs for the
# same file: the first to finish deletes the temp wav the other is still using
ACTIVE_TRANSCRIBES: dict[str, str] = {}
MAX_JOBS = 100  # cap entries in JOBS to prevent memory leak
# Quick preview (/api/preview): how many seconds of the clip are actually
# rendered through ffmpeg, with the EXACT SAME caption+watermark filters
# as the full render -- not just a CSS preview in the browser, which once
# proved it could differ from the real ASS/ffmpeg output (see watermark
# opacity bug). 5 seconds is enough to see the style, but short enough to
# stay "quick".
PREVIEW_MAX_SECONDS = 5.0
# Render job ids marked for cancellation. _run_render checks via
# cancel_check; render.py kills the running ffmpeg if listed.
CANCELLED: set[str] = set()


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


def _register_job(job_id: str, entry: dict):
    """Prune + insert in a SINGLE lock hold. If insert is done outside the
    lock while another thread is iterating JOBS (prune), Python throws
    'dictionary changed size during iteration' and the request dies."""
    with LOCK:
        if len(JOBS) > MAX_JOBS:
            done = [k for k, v in JOBS.items()
                    if v.get("state") in ("done", "failed")]
            for k in done[:len(done) // 2]:
                JOBS.pop(k, None)
        JOBS[job_id] = entry


# --------------------------------------------------------------------------
# pekerjaan render
# --------------------------------------------------------------------------

def _on_battery() -> bool:
    """Transcription on battery can be twice as slow -- Intel throttles CPU
    power, and Whisper is the workload most visibly affected. Better that
    the user knows before waiting 40 minutes."""
    if sys.platform != "win32":
        return False
    try:
        import ctypes
        class S(ctypes.Structure):
            _fields_ = [("ACLineStatus", ctypes.c_byte), ("BatteryFlag", ctypes.c_byte),
                        ("BatteryLifePercent", ctypes.c_byte), ("Reserved1", ctypes.c_byte),
                        ("BatteryLifeTime", ctypes.c_ulong), ("BatteryFullLifeTime", ctypes.c_ulong)]
        st = S()
        if ctypes.windll.kernel32.GetSystemPowerStatus(ctypes.pointer(st)):
            return st.ACLineStatus == 0
    except Exception:                              # noqa: BLE001
        pass
    return False


def _find_video(name: str) -> Path | None:
    """Browsers don't provide full paths, just filenames. Search the folders
    the server can reach."""
    # Prevent path traversal: only accept filenames without directory components
    if "/" in name or "\\" in name or ".." in name:
        return None
    for folder in ("samples", "", "out"):
        p = WORKSPACE / folder / name if folder else WORKSPACE / name
        if p.is_file():
            return p
    return None


def _crop_from(d) -> "engine.CropBox | None":
    """Per-span crop from the client JSON. If absent, the clip's crop is
    used. Shared by both the real render and the quick preview -- both
    paths read the exact same `spans` format."""
    if not isinstance(d, dict):
        return None
    return engine.CropBox(
        left=float(d.get("left", 37)), top=float(d.get("top", 4)),
        width=float(d.get("width", 26)), height=float(d.get("height", 92)))


def _crops_from(d) -> "list[engine.CropBox] | None":
    """Two boxes for a split frame. Fewer than two = not a split, so ignored
    and the segment uses a single box."""
    if not isinstance(d, list) or len(d) < 2:
        return None
    boxes = [_crop_from(x) for x in d[:2]]
    return boxes if all(boxes) else None


def _tracking_from(d) -> "list[dict] | None":
    """Optional per-segment head tracking trajectory -- list of {t, left}
    from the client JSON (see track_head() in facebox.py which originally
    produces it). Not core data like crop: corrupted entries are silently
    discarded, and fewer than 2 points are treated as absent (the segment
    stays static) -- rather than failing the entire render."""
    if not isinstance(d, list):
        return None
    result = []
    for kf in d:
        if not isinstance(kf, dict):
            continue
        try:
            result.append({"t": float(kf["t"]), "left": float(kf["left"])})
        except (KeyError, TypeError, ValueError):
            continue
    return result if len(result) >= 2 else None


def _spans_from_clip(k: dict) -> "list[engine.Span]":
    """`k["spans"]` (client JSON) -> list of engine.Span, ready for RenderJob.
    One format, used by both the real render and preview -- both receive
    the same clip payload from the UI."""
    try:
        return [engine.Span(float(p["start"]), float(p["end"]),
                            _crop_from(p.get("crop")), _crops_from(p.get("crops")),
                            _tracking_from(p.get("tracking")))
                   for p in k.get("spans", [])]
    except (KeyError, TypeError, ValueError):
        raise ValueError(
            f"Clip \"{k.get('title', '?')}\" has no valid timestamps. "
            f"Re-import Claude's reply, or cut the clip manually.") from None


def _clip_words(k: dict, fallback: list) -> list:
    """Caption text may be sent by the UI. It's used when you fix a
    misheard word on the Edit screen -- the correction belongs to this
    result only and is NOT written back to the transcript, because the
    transcript has its own flow. `fallback` (transcript from cache/) is
    used when the clip doesn't send its own corrections, or the format
    is invalid."""
    if isinstance(k.get("words"), list) and k["words"]:
        try:
            from .models import Word
            return [Word(text=str(w["text"]),
                        start=float(w["start"]), end=float(w["end"]))
                    for w in k["words"]]
        except (KeyError, TypeError, ValueError):
            pass
    return fallback


def _trim_for_preview(spans: "list[engine.Span]", max_seconds: float,
                       start_from: float = 0.0) -> "list[engine.Span]":
    """Take a short slice from `spans`, up to max_seconds long, starting
    `start_from` seconds of OUTPUT time (after all spans are joined) from
    the beginning of the clip -- not always from the first second. Long
    clips (minutes) are rarely represented by just their first 3 seconds;
    `start_from` is usually the scrub position the user is looking at in
    the preview, so the quick preview actually shows the moment being
    checked.

    The LAST span covered is trimmed exactly at the boundary instead of
    being discarded whole -- so the preview stays as close as possible to
    the requested boundary."""
    result = []
    remaining_skip = max(0.0, start_from)
    remaining = max_seconds
    for s in spans:
        if remaining_skip > 0:
            if s.length <= remaining_skip:
                remaining_skip -= s.length
                continue
            # This segment's start is shifted forward -- if there's tracking
            # data, its times (relative to the OLD start) must be shifted
            # back by the same amount, not passed through raw (would be
            # misplaced) OR silently dropped (would fall back to a static
            # box even though the point is actually tracked).
            s = engine.Span(s.start + remaining_skip, s.end, s.crop, s.crops,
                            _shift_tracking(s.tracking, remaining_skip))
            remaining_skip = 0
        if remaining <= 0:
            break
        if s.length <= remaining:
            result.append(s)
            remaining -= s.length
        else:
            # Only the end is shortened, the start (and tracking times,
            # relative to start) don't change -- keyframes falling after
            # the new boundary are harmless if left as-is, sendcmd will
            # never reach that time in a segment this short.
            result.append(engine.Span(s.start, s.start + remaining, s.crop, s.crops,
                                     s.tracking))
            remaining = 0
    return result


def _shift_tracking(tracking: "list[dict] | None", offset: float) -> "list[dict] | None":
    """Shift every keyframe's time back by `offset` seconds -- used when a
    tracked span is cut from the FRONT for a quick preview. Keyframes that
    become negative (occurring BEFORE the new start) are discarded; fewer
    than 2 keyframes remaining -> None (falls back to a static box, safer
    than a trajectory with wrong direction/timing)."""
    if not tracking:
        return None
    shifted = [{"t": round(kf["t"] - offset, 3), "left": kf["left"]}
             for kf in tracking if kf["t"] - offset >= 0]
    return shifted if len(shifted) >= 2 else None


def _run_render(job_id: str, req: dict) -> None:
    t = JOBS[job_id]
    try:
        video = _find_video(req["video"])
        if not video:
            raise FileNotFoundError(
                f"{req['video']} is not in a folder the server can reach. "
                f"Put the file in samples/.")

        # Transcript used for captions; may be absent. Find ANY transcript
        # for this video -- don't guess model/lang, because a wrong silent
        # guess removes captions without a message.
        words = []
        try:
            cache = Cache(WORKSPACE / "cache")
            path = cache.find_any_transcript(video)
            if path and path.exists():
                words = Transcript.load(path).words
        except Exception:
            pass

        from .ffmpeg_tools import probe
        info = probe(video)
        out_dir = WORKSPACE / "out" / video.stem
        clips = req["clips"]
        t["total"] = len(clips)

        for i, k in enumerate(clips):
            if job_id in CANCELLED:
                with LOCK:
                    t["state"] = "cancelled"
                return
            with LOCK:
                t["current"] = k["title"]
                t["index"] = i

            # p["crop"] is what makes framing shift mid-clip: each segment
            # is framed independently before joining. p["crops"] holds two
            # boxes and turns the segment into a top-bottom split frame.
            spans = _spans_from_clip(k)
            if not spans:
                raise ValueError(f"Clip \"{k.get('title', '?')}\" has no spans.")
            crop = k.get("crop") or {}
            job = engine.RenderJob(
                title=k["title"],
                spans=spans,
                crop=engine.CropBox(
                    left=crop.get("left", 37), top=crop.get("top", 4),
                    width=crop.get("width", 26), height=crop.get("height", 92)),
                layout=k.get("layout", "face"),
                out_width=int(k.get("width", 1080)),
            )
            name = engine.safe_filename(k["title"], f"clip-{i+1}")
            dest = out_dir / name

            # Caption style comes from the Caption screen in the UI. If not
            # sent, build_ass uses its defaults.
            style = k.get("style") if isinstance(k.get("style"), dict) else None

            clip_words = _clip_words(k, words)

            try:
                engine.render(video, job, dest, words=clip_words, style=style,
                             src_width=info.width, src_height=info.height,
                             has_audio=info.has_audio, verbose=False,
                             cancel_check=lambda: job_id in CANCELLED)
            except engine.RenderCancelled:
                with LOCK:
                    t["state"] = "cancelled"
                return

            with LOCK:
                t["result"].append({
                    "title": k["title"],
                    "file": name,
                    "url": f"/workspace/out/{video.stem}/{name}",
                    "folder": str(out_dir),
                    "mb": round(dest.stat().st_size / 1048576, 1),
                    "duration": round(job.duration, 1),
                })
                t["done"] = i + 1

        with LOCK:
            t["state"] = "done"

    except Exception as exc:                       # noqa: BLE001
        with LOCK:
            t["state"] = "failed"
            t["error"] = str(exc)
    finally:
        CANCELLED.discard(job_id)                  # don't leak to the next job id


def _run_transcribe(job_id: str, req: dict) -> None:
    """Real transcription with real progress.

    Previously the Analysis screen just animated a bar for 9 seconds. The
    numbers were derived from the file duration, but nothing was actually
    transcribed -- the UI relied on cache filled via the command line.
    """
    t = JOBS[job_id]
    try:
        from .ffmpeg_tools import extract_audio, probe
        from .glossary import Glossary
        from .transcribe import DEFAULT_THREADS, transcribe

        video = _find_video(req["video"])
        if not video:
            raise FileNotFoundError(
                f"{req['video']} is not in samples/.")

        cache = Cache(WORKSPACE / "cache")

        # Once per video, NOT dependent on whether the transcript itself
        # is already cached -- that's why it's checked here, before the
        # transcript cache-hit path below might return early and skip it.
        # Deliberately non-fatal: a failed energy analysis must not fail
        # the far more important transcription.
        epath = cache.energy_path(video)
        if not epath.exists():
            with LOCK:
                t["stage"] = "energy"
            try:
                from .audio_energy import find_loud_moments
                epath.write_text(json.dumps(find_loud_moments(video)), encoding="utf-8")
            except Exception:                          # noqa: BLE001
                pass

        model = req.get("model", "large-v3-turbo")
        lang = req.get("lang", "id")
        gloss_path = ROOT / "prompts" / "glossary.txt"
        path = cache.transcript_path(video, model, lang,
                                     gloss_path if gloss_path.exists() else None)

        info = probe(video)
        with LOCK:
            t["duration"] = info.duration
            t["battery"] = _on_battery()

        if path.exists() and not req.get("force"):
            with LOCK:
                t["state"] = "done"
                t["cached"] = True
                t["file"] = path.name
            return

        with LOCK:
            t["stage"] = "audio"

        # wav is given a job id suffix: two jobs for the same video don't
        # delete each other's temporary files
        wav = cache.audio_path(video).with_suffix(f".{job_id}.wav")
        extract_audio(video, wav)
        if not wav.is_file():
            raise FileNotFoundError(
                f"Failed to prepare temporary audio: {wav.name}")

        with LOCK:
            t["stage"] = "transcribe"

        # transcribe() prints progress to stderr; here progress is read
        # from segment positions so it can be sent to the UI
        import faster_whisper
        gloss = Glossary.load(ROOT / "prompts" / "glossary.txt")
        # cpu_threads is set explicitly on purpose. faster-whisper's default
        # (0) is translated by CTranslate2 to just 4 threads. Benchmarked
        # on 185H: 8 threads is fastest; 22 threads actually slows down
        # because E-cores get used and bottleneck the others.
        wm = faster_whisper.WhisperModel(model, device="cpu", compute_type="int8",
                                         cpu_threads=int(req.get("threads", DEFAULT_THREADS)))
        segments_iter, meta = wm.transcribe(
            str(wav), language=lang, beam_size=5, word_timestamps=True,
            vad_filter=True, vad_parameters={"min_silence_duration_ms": 500},
            condition_on_previous_text=False,
            initial_prompt=gloss.initial_prompt(lang), hotwords=gloss.hotwords())

        from .models import Segment, Word
        segments = []
        total = meta.duration or info.duration
        for sg in segments_iter:
            segments.append(Segment(
                text=gloss.apply(sg.text), start=round(sg.start, 3), end=round(sg.end, 3),
                words=[Word(text=gloss.apply(w.word), start=round(w.start, 3),
                            end=round(w.end, 3), prob=round(getattr(w, "probability", 1.0), 3))
                       for w in (sg.words or [])]))
            with LOCK:
                t["position"] = sg.end
                t["percent"] = min(100, round(sg.end / total * 100))

        Transcript(source=str(video), duration=total, language=meta.language or lang,
                   model=model, segments=segments).save(path)

        with LOCK:
            t["state"] = "done"
            t["file"] = path.name
            t["percent"] = 100

    except Exception as exc:                       # noqa: BLE001
        with LOCK:
            t["state"] = "failed"
            t["error"] = str(exc)
    finally:
        with LOCK:
            # Only release the slot if it STILL belongs to this job. If not,
            # another job for the same video has already registered and an
            # unconditional pop would delete ITS registration -- opening a
            # double-job race.
            name = req.get("video", "")
            if ACTIVE_TRANSCRIBES.get(name) == job_id:
                ACTIVE_TRANSCRIBES.pop(name, None)
        try:
            for leftover in (WORKSPACE / "cache").glob(f"*.{job_id}.wav"):
                leftover.unlink(missing_ok=True)       # temp wav is never left behind
        except Exception:                          # noqa: BLE001
            pass


def _run_diarize(job_id: str, req: dict) -> None:
    """AI Framing: who speaks at what second, within ONE clip. Deliberately
    limited to the clip range (not the whole video) -- diarization is
    roughly 1:1 with audio duration on CPU, and clips are only 30-45
    seconds, not tens of minutes."""
    t = JOBS[job_id]
    try:
        video = _find_video(req["video"])
        if not video:
            raise FileNotFoundError(
                f"{req['video']} is not in a folder the server can reach.")
        start = float(req.get("start", 0))
        end = float(req.get("end", 0))
        if end <= start:
            raise ValueError("Invalid time range.")

        from .diarize import diarize_segment
        turns = diarize_segment(video, start, end)

        with LOCK:
            t["state"] = "done"
            t["turns"] = turns

    except Exception as exc:                       # noqa: BLE001
        with LOCK:
            t["state"] = "failed"
            t["error"] = str(exc)


# ══════════════════════════════ project ══════════════════════════════
# Before this, klipian saved nothing: reload the page and all Results,
# framing points, and text corrections vanished. Project saves them as
# one JSON per video, alongside cache/ and out/ -- not in localStorage,
# so they survive browser clearing and can be viewed and backed up as
# regular files.

def _project_path(video: str) -> Path:
    """One file per video. Keyed by the same fingerprint as the transcript
    cache, so a video whose content changes automatically becomes a
    different project."""
    from .cache import fingerprint
    src = WORKSPACE / "samples" / Path(video).name
    fp = fingerprint(src) if src.exists() else "unknown"
    return PROJECTS / f"{Path(video).stem}.{fp}.json"


def _active_result(data: dict) -> dict:
    """The part of a project containing the active result/framing/title --
    new format (one project can have multiple saved Results, see
    SAVED_RESULTS/`results`+`activeResult` in projects.js) or old format
    (flat result/framing/title at top level, from before that feature
    existed). Old projects that haven't been reopened since this feature
    was added must still display correctly on the home card, not just
    newer projects."""
    results = data.get("results")
    if isinstance(results, list) and results:
        active = data.get("activeResult")
        for r in results:
            if isinstance(r, dict) and r.get("id") == active:
                return r
        first = results[0]
        return first if isinstance(first, dict) else {}
    return data


def _project_summary(file: Path) -> dict | None:
    """Compact form for the homepage listing -- doesn't load the full
    contents.

    The entire body is wrapped in try/except: project files can be
    hand-edited or from older versions, so a non-numeric field or
    non-dict shape must not crash the entire homepage listing. Corrupted
    entries are silently skipped (return None)."""
    try:
        data = json.loads(file.read_text(encoding="utf-8"))
        st = file.stat()
        if not isinstance(data, dict):
            return None
        active = _active_result(data)
        spans = active.get("result") or []
        total = sum(max(0.0, float(r.get("end", 0)) - float(r.get("start", 0)))
                    for r in spans if isinstance(r, dict))
        framing = active.get("framing") or [{}]
        first_frame = framing[0] if isinstance(framing[0], dict) else {}
        return {
            "video": data.get("video", ""),
            "title": active.get("title", ""),
            "spans": len(spans),
            "seconds": round(total, 1),
            "at": int(st.st_mtime),
            "thumbAt": float(spans[0]["start"]) if spans and isinstance(spans[0], dict) else 0.0,
            # Thumbnail uses the project's own framing box. If the default
            # box were used, two projects from the same video would look
            # identical even though their frames are very different.
            "crop": ((first_frame.get("crops") or [None])[0]),
        }
    except (OSError, ValueError, TypeError, KeyError, IndexError):
        return None


# ═══════════════════════════════ workspace ═══════════════════════════════
# Dashboard at /workspace: one place to view render output (workspace/out/),
# manage upload schedule (clips.json), and additional assets
# (workspace/assets/). Separate from projects (per-video working state) --
# this is about WHAT HAPPENS AFTER a clip becomes MP4, not about editing
# the clip itself.

def _load_clips() -> list[dict]:
    """One file for all clips -- unlike projects (one file per video)
    because this is a flat list viewed across videos at once, like a
    spreadsheet. Missing or corrupt files return an empty list, not an
    error -- a dashboard that's never been used must not fail to load."""
    if not CLIPS_PATH.is_file():
        return []
    try:
        data = json.loads(CLIPS_PATH.read_text(encoding="utf-8"))
        return data.get("clip", []) if isinstance(data, dict) else []
    except (OSError, ValueError):
        return []


def _save_clips(clips: list[dict]) -> None:
    """Write to a temporary file then rename, same as project -- a process
    that dies mid-write must not corrupt clips.json."""
    CLIPS_PATH.parent.mkdir(parents=True, exist_ok=True)
    tmp = CLIPS_PATH.with_suffix(".tmp")
    tmp.write_text(json.dumps({"clip": clips}, ensure_ascii=False, indent=2),
                    encoding="utf-8")
    tmp.replace(CLIPS_PATH)


def _thumbnail(video: Path, seconds: float, crop: dict, width: int) -> Path:
    """One frame from the clip's second, already cropped to 9:16.

    Candidate cards need to show the person's face at that moment -- a
    generic frame doesn't help decide which clip to pick."""
    from .ffmpeg_tools import _require, probe
    dest = WORKSPACE / "out" / video.stem / "thumbs" /         f"{int(seconds*10)}-{int(crop['left'])}-{int(crop['width'])}-{width}.jpg"
    if dest.exists():
        return dest
    dest.parent.mkdir(parents=True, exist_ok=True)

    info = probe(video)
    even = lambda v: max(2, int(v) // 2 * 2)
    cw = even(info.width * crop["width"] / 100)
    ch = even(info.height * crop["height"] / 100)
    cx = even(info.width * crop["left"] / 100)
    cy = even(info.height * crop["top"] / 100)

    result = subprocess.run([
        _require("ffmpeg"), "-y", "-loglevel", "error",
        "-ss", f"{seconds:.2f}", "-i", str(video), "-frames:v", "1",
        "-vf", f"crop={cw}:{ch}:{cx}:{cy},scale={width}:-2",
        "-q:v", "4", str(dest)], capture_output=True)
    if result.returncode != 0:
        # Thumbnail failed -- return empty path so caller knows
        return Path()
    return dest


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

        if path == "/api/thumb":
            q = parse_qs(urlparse(self.path).query)
            # Non-numeric query params would make float() throw ValueError
            # that's uncaught in do_GET -> connection drops without a response.
            def num(k, d):
                try:
                    return float(q.get(k, [d])[0])
                except (TypeError, ValueError):
                    return float(d)
            video = _find_video(q.get("video", [""])[0])
            if not video:
                return self._send_json({"error": "video not found"}, 404)
            file = _thumbnail(video, num("t", 0),
                                {"left": num("left", 37), "top": num("top", 4),
                                 "width": num("width", 26), "height": num("height", 92)},
                                int(num("w", 132)))
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

        if path == "/api/probe":
            # UI needs fps to step per frame. The <video> element never
            # exposes that number, so ffprobe is the answer.
            q = parse_qs(urlparse(self.path).query)
            video = _find_video(q.get("video", [""])[0])
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

        if path == "/api/history":
            # History is read from the out/ folder contents, not session
            # memory: files that actually exist on disk are the honest
            # history, and persist across page reloads or server restarts.
            item = []
            for mp4 in (WORKSPACE / "out").glob("*/*.mp4"):
                try:
                    st = mp4.stat()
                except OSError:
                    continue
                item.append({
                    "file": mp4.name,
                    "video": mp4.parent.name,
                    "folder": str(mp4.parent),
                    "url": f"/workspace/out/{mp4.parent.name}/{mp4.name}",
                    "mb": round(st.st_size / 1048576, 1),
                    "at": int(st.st_mtime),
                })
            item.sort(key=lambda x: x["at"], reverse=True)   # newest first
            return self._send_json({"render": item})

        if path == "/api/projects":
            # Listing for the homepage. Corrupted entries are silently
            # skipped: one bad file must not crash the entire listing.
            item = []
            for f in PROJECTS.glob("*.json"):
                r = _project_summary(f)
                if r and r.get("video"):
                    item.append(r)
            item.sort(key=lambda x: x["at"], reverse=True)
            return self._send_json({"project": item})

        if path == "/api/project":
            name = (parse_qs(urlparse(self.path).query).get("video") or [""])[0]
            if not name:
                return self._send_json({"error": "video required"}, 400)
            f = _project_path(name)
            if not f.exists():
                return self._send_json({"error": "not found"}, 404)
            try:
                return self._send_json(json.loads(f.read_text(encoding="utf-8")))
            except ValueError:
                return self._send_json({"error": "project file is corrupt"}, 500)

        if path == "/api/workspace/clips":
            return self._send_json({"clip": _load_clips()})

        if path == "/api/workspace/assets":
            # Created if missing -- an empty folder is normal
            # (never added custom watermark/template), not an error.
            ASSETS_DIR.mkdir(parents=True, exist_ok=True)
            item = []
            for f in sorted(ASSETS_DIR.iterdir()):
                if f.is_file():
                    st = f.stat()
                    item.append({"name": f.name,
                                 "kb": round(st.st_size / 1024, 1),
                                 "at": int(st.st_mtime)})
            return self._send_json({"asset": item})

        if path == "/api/cache":
            # UI needs to know which transcripts are available. This server
            # doesn't generate HTML directory listings like http.server, so
            # a dedicated endpoint is provided.
            file = sorted(p.name for p in (WORKSPACE / "cache").glob("*.transcript.json"))
            return self._send_json({"transcript": file})

        if path == "/api/audio-energy":
            # Read separately from the transcription job -- the analysis is
            # triggered in _run_transcribe() (see energy_path()) and the
            # result is just a regular cache file. The client doesn't need
            # to know the difference between "not yet analyzed" vs
            # "analyzed, no notable moments" -- both return an empty list,
            # not an error.
            q = parse_qs(urlparse(self.path).query)
            video = _find_video(q.get("video", [""])[0])
            if not video:
                return self._send_json({"moments": []})
            epath = Cache(WORKSPACE / "cache").energy_path(video)
            if not epath.is_file():
                return self._send_json({"moments": []})
            try:
                moments = json.loads(epath.read_text(encoding="utf-8"))
            except ValueError:
                moments = []
            return self._send_json({"moments": moments})

        if path == "/api/video":
            file = sorted(p.name for p in (WORKSPACE / "samples").glob("*")
                            if p.suffix.lower() in {".mp4", ".mkv", ".mov", ".webm"})
            return self._send_json({"video": file})

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

        file = ROOT.joinpath(*parts)
        try:
            file = file.resolve(strict=True)
        except OSError:
            return self._send_json({"error": f"not found: {path}"}, 404)
        if not file.is_relative_to(ROOT.resolve()):
            return self._send_json({"error": "invalid path"}, 400)
        if not file.is_file():
            return self._send_json({"error": f"not found: {path}"}, 404)

        mime = mimetypes.guess_type(str(file))[0] or "application/octet-stream"
        return self._send_file(file, mime)

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
        path = urlparse(self.path).path

        if path == "/api/project":
            try:
                req = self._read_json()
            except Exception as exc:               # noqa: BLE001
                return self._send_json({"error": str(exc)}, 400)
            name = str(req.get("video") or "").strip()
            if not name:
                return self._send_json({"error": "video required"}, 400)
            # Filename only, no path components -- the name from the client
            # must not determine WHERE the file is written.
            req["video"] = Path(name).name
            PROJECTS.mkdir(parents=True, exist_ok=True)
            f = _project_path(req["video"])
            if req.get("delete"):
                f.unlink(missing_ok=True)
                return self._send_json({"ok": True, "deleted": True})
            req["at"] = int(time.time())
            # Write to a temp file then rename: if the process dies mid-write,
            # the old project stays intact, not half-written.
            tmp = f.with_suffix(".tmp")
            tmp.write_text(json.dumps(req, ensure_ascii=False), encoding="utf-8")
            tmp.replace(f)
            return self._send_json({"ok": True})

        if path == "/api/workspace/clips":
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
            with LOCK:
                clips = _load_clips()

                if req.get("delete"):
                    if not cid:
                        return self._send_json({"error": "id required"}, 400)
                    clips = [c for c in clips if c.get("id") != cid]
                    _save_clips(clips)
                    return self._send_json({"ok": True, "deleted": True})

                if not cid:
                    cid = uuid.uuid4().hex[:8]
                req["id"] = cid
                req["at"] = int(time.time())

                for i, c in enumerate(clips):
                    if c.get("id") == cid:
                        clips[i] = req
                        break
                else:
                    clips.append(req)

                _save_clips(clips)
            return self._send_json({"ok": True, "id": cid})

        if path == "/api/render":
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
            threading.Thread(target=_run_render, args=(job_id, req),
                             daemon=True).start()
            return self._send_json({"id": job_id})

        if path == "/api/render/cancel":
            try:
                req = self._read_json()
            except Exception as exc:               # noqa: BLE001
                return self._send_json({"error": str(exc)}, 400)
            job_id = str(req.get("id") or "")
            # Mark for cancellation; _run_render / render() checks it and
            # kills the running ffmpeg. Idempotent -- marking an already-
            # finished job is harmless (discarded in finally).
            with LOCK:
                ada = job_id in JOBS
            if ada:
                CANCELLED.add(job_id)
            return self._send_json({"ok": ada})

        if path == "/api/preview":
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

            video = _find_video(req.get("video", ""))
            if not video:
                return self._send_json(
                    {"error": f"{req.get('video')} is not in a folder the "
                               f"server can reach."}, 404)

            try:
                all_spans = _spans_from_clip(k)
                start_from = float(req.get("startFrom") or 0)
                spans = _trim_for_preview(all_spans, PREVIEW_MAX_SECONDS, start_from)
                if not spans and start_from > 0:
                    # Scrub landed exactly at the clip tail (less than one
                    # second remaining) -- rather than failing, show from
                    # the beginning.
                    spans = _trim_for_preview(all_spans, PREVIEW_MAX_SECONDS)
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
                    layout=k.get("layout", "face"),
                    out_width=int(k.get("width", 1080)),
                )

                words = []
                try:
                    cache = Cache(WORKSPACE / "cache")
                    tpath = cache.find_any_transcript(video)
                    if tpath and tpath.exists():
                        words = Transcript.load(tpath).words
                except Exception:                      # noqa: BLE001
                    pass
                clip_words = _clip_words(k, words)

                style = k.get("style") if isinstance(k.get("style"), dict) else None

                # Filename is FIXED, overwritten each time -- previews are
                # disposable, not files to collect like real render output
                # in the queue/history.
                dest = WORKSPACE / "out" / video.stem / "_preview.mp4"
                engine.render(video, job, dest, words=clip_words, style=style,
                              src_width=info.width, src_height=info.height,
                              has_audio=info.has_audio, verbose=False)
            except Exception as exc:                   # noqa: BLE001
                return self._send_json({"error": str(exc)}, 500)

            return self._send_json({
                # Filename stays the same each time -- without this timestamp
                # the browser's <video> element won't reload the newly-
                # overwritten version, even though the server wrote a
                # completely different file.
                "url": f"/workspace/out/{video.stem}/_preview.mp4?t={int(time.time())}",
                "duration": round(job.duration, 1),
            })

        if path == "/api/transcribe":
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
                                "cached": False, "error": None}
            threading.Thread(target=_run_transcribe, args=(job_id, req),
                             daemon=True).start()
            return self._send_json({"id": job_id})

        if path == "/api/diarize":
            try:
                req = self._read_json()
            except Exception as exc:               # noqa: BLE001
                return self._send_json({"error": str(exc)}, 400)
            if not req.get("video"):
                return self._send_json({"error": "video required"}, 400)

            job_id = uuid.uuid4().hex[:8]
            _register_job(job_id, {"state": "running", "turns": [], "error": None})
            threading.Thread(target=_run_diarize, args=(job_id, req),
                             daemon=True).start()
            return self._send_json({"id": job_id})

        if path == "/api/facefit":
            # Synchronous, not an async job like /api/diarize -- one frame
            # detects fast enough (under 1 second), not worth the polling
            # overhead for a job that short.
            try:
                req = self._read_json()
            except Exception as exc:               # noqa: BLE001
                return self._send_json({"error": str(exc)}, 400)
            video = _find_video(req.get("video", ""))
            if not video:
                return self._send_json({"error": "video not found"}, 404)
            try:
                at = float(req.get("at", 0))
            except (TypeError, ValueError):
                return self._send_json({"error": "invalid time"}, 400)
            rough = req.get("crop") or {}

            try:
                from .facebox import fit_crop_to_face
                crop = fit_crop_to_face(video, at, rough)
            except Exception as exc:               # noqa: BLE001
                return self._send_json({"error": str(exc)}, 500)
            if not crop:
                return self._send_json({"error": "no face detected"}, 404)
            return self._send_json({"crop": crop})

        if path == "/api/facetrack":
            # Synchronous too, same as /api/facefit -- but long turns can
            # take several seconds (per-frame sampling + repeated cascade
            # detection). If this feels slow in the UI later, this is the
            # first candidate to make an async job like /api/diarize.
            try:
                req = self._read_json()
            except Exception as exc:               # noqa: BLE001
                return self._send_json({"error": str(exc)}, 400)
            video = _find_video(req.get("video", ""))
            if not video:
                return self._send_json({"error": "video not found"}, 404)
            try:
                start = float(req.get("start", 0))
                end = float(req.get("end", 0))
            except (TypeError, ValueError):
                return self._send_json({"error": "invalid time"}, 400)
            if end <= start:
                return self._send_json({"error": "invalid range"}, 400)
            rough = req.get("crop") or {}
            try:
                from .facebox import track_crops
                points = track_crops(video, start, end, rough)
            except Exception as exc:               # noqa: BLE001
                return self._send_json({"error": str(exc)}, 500)
            return self._send_json({"points": points})

        if path == "/api/speakerlocate":
            # Synchronous like /api/facetrack -- AI Framing is now fully
            # automatic, without manual per-speaker confirmation (see
            # locate_speaker() in facebox.py for the reasoning).
            try:
                req = self._read_json()
            except Exception as exc:               # noqa: BLE001
                return self._send_json({"error": str(exc)}, 400)
            video = _find_video(req.get("video", ""))
            if not video:
                return self._send_json({"error": "video not found"}, 404)
            try:
                start = float(req.get("start", 0))
                end = float(req.get("end", 0))
            except (TypeError, ValueError):
                return self._send_json({"error": "invalid time"}, 400)
            if end <= start:
                return self._send_json({"error": "invalid range"}, 400)
            crop_size = req.get("size") or {}
            try:
                from .facebox import locate_speaker
                crop = locate_speaker(video, start, end, crop_size)
            except Exception as exc:               # noqa: BLE001
                return self._send_json({"error": str(exc)}, 500)
            if not crop:
                return self._send_json({"error": "no speaker detected"}, 404)
            return self._send_json({"crop": crop})

        if path == "/api/headtrack":
            # Synchronous like /api/facetrack -- head tracking trajectory,
            # OPTIONAL per framing point, triggered manually from the "Track
            # head" button (see track_head() in facebox.py for the reasoning).
            try:
                req = self._read_json()
            except Exception as exc:               # noqa: BLE001
                return self._send_json({"error": str(exc)}, 400)
            video = _find_video(req.get("video", ""))
            if not video:
                return self._send_json({"error": "video not found"}, 404)
            try:
                start = float(req.get("start", 0))
                end = float(req.get("end", 0))
            except (TypeError, ValueError):
                return self._send_json({"error": "invalid time"}, 400)
            if end <= start:
                return self._send_json({"error": "invalid range"}, 400)
            rough = req.get("crop") or {}
            try:
                from .facebox import track_head
                keyframes = track_head(video, start, end, rough)
            except Exception as exc:               # noqa: BLE001
                return self._send_json({"error": str(exc)}, 500)
            if not keyframes:
                return self._send_json({"error": "not enough tracking data"}, 404)
            return self._send_json({"keyframes": keyframes})

        if path == "/api/scenecut":
            # Synchronous like /api/facetrack -- inter-frame diff via
            # ffmpeg's built-in scene filter is far cheaper than per-frame
            # face cascade, one speaking turn (tens of seconds) finishes in
            # under 1 second.
            try:
                req = self._read_json()
            except Exception as exc:               # noqa: BLE001
                return self._send_json({"error": str(exc)}, 400)
            video = _find_video(req.get("video", ""))
            if not video:
                return self._send_json({"error": "video not found"}, 404)
            try:
                start = float(req.get("start", 0))
                end = float(req.get("end", 0))
            except (TypeError, ValueError):
                return self._send_json({"error": "invalid time"}, 400)
            if end <= start:
                return self._send_json({"error": "invalid range"}, 400)
            try:
                from .scenecut import detect_cuts
                cuts = detect_cuts(video, start, end)
            except Exception as exc:               # noqa: BLE001
                return self._send_json({"error": str(exc)}, 500)
            return self._send_json({"cuts": cuts})

        if path == "/api/open-folder":
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

        self._send_json({"error": "unknown endpoint"}, 404)


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
    pola = re.compile(r"\.[0-9a-f]{8}\.wav$")
    for w in (WORKSPACE / "cache").glob("*.wav"):
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
