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

import importlib
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
from . import ffmpeg_tools
from . import render as engine

ROOT = Path(__file__).resolve().parent.parent
# All working files (source video, rendered output, cache, project, assets)
# live in THIS ONE folder -- not scattered (previously samples/out/cache/
# projects/ each at root), so new klipian users aren't confused about where
# to put videos (see workspace/README.md).
WORKSPACE = ROOT / "workspace"
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
# clips.json has its own lock rather than sharing LOCK. LOCK is taken
# several times per SECOND while a transcription reports progress, so
# putting a file read-modify-write behind it made a /workspace dashboard
# edit block every render/transcribe progress update, and vice versa.
# Two unrelated resources, two locks.
CLIPS_LOCK = threading.Lock()
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
        #
        # A transcript that EXISTS but can't be read is a different thing
        # from one that was never made, and the bare `except: pass` here
        # used to erase that difference: a file truncated by a killed
        # process, a JSON decode error or a locked file all produced
        # words=[] and the render ran to completion, handing back an MP4
        # with no subtitles and no error anywhere. The reason is recorded
        # on the job now so the History row can say so. The exception list
        # is narrow on purpose -- anything else is a real bug that should
        # surface, not be absorbed here.
        words = []
        try:
            cache = Cache(WORKSPACE / "cache")
            path = cache.find_any_transcript(video)
            if path and path.exists():
                words = Transcript.load(path).words
        except (OSError, ValueError, KeyError, TypeError) as exc:  # noqa: BLE001
            with LOCK:
                t["warning"] = (f"captions skipped: the transcript exists but "
                                f"could not be read ({exc})")

        from .ffmpeg_tools import probe
        info = probe(video)
        out_dir = WORKSPACE / "out" / video.stem
        clips = req["clips"]
        # Under LOCK like every other JOBS write in this function. Rebinding
        # an existing key can't actually race, but the inconsistency is
        # exactly the kind of thing the surrounding code is careful about.
        with LOCK:
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

        # This used to be a second, inline implementation of transcribe():
        # it built its own WhisperModel and its own Segment/Word objects,
        # while still importing the real function and never calling it. The
        # two had already drifted in an output-visible way -- this copy did
        # gloss.apply(sg.text) on the segment text, whereas transcribe()
        # deliberately rebuilds segment text from the already-corrected
        # words precisely so the glossary is NOT applied twice. Both wrote
        # to the SAME cache file, so the same video transcribed from the CLI
        # and from the Analysis screen produced different text, and which
        # one you got depended on which path happened to fill the cache.
        #
        # The only thing the server genuinely needed that the CLI didn't is
        # progress reported to the browser instead of to stderr -- that is
        # now an on_segment callback, and there is one implementation again.
        gloss = Glossary.load(ROOT / "prompts" / "glossary.txt")

        def _tick(position: float, total: float) -> None:
            with LOCK:
                t["position"] = position
                t["percent"] = min(100, round(position / total * 100)) if total else 0

        # cpu_threads is passed explicitly on purpose. faster-whisper's
        # default (0) is translated by CTranslate2 to just 4 threads.
        # Benchmarked on 185H: 8 threads is fastest; 22 threads actually
        # slows down because E-cores get used and bottleneck the others.
        result = transcribe(
            wav,
            model_size=model,
            language=lang,
            glossary=gloss,
            threads=int(req.get("threads", DEFAULT_THREADS)),
            source_label=str(video),
            verbose=False,          # stderr progress is for the CLI
            on_segment=_tick,
        )
        # faster-whisper occasionally reports duration 0 for a stream it
        # can't measure; ffprobe's number is the reliable fallback. The old
        # inline copy did this as `meta.duration or info.duration`.
        if not result.duration:
            result.duration = info.duration
        result.save(path)

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


# Weight/offset per pyannote hook stage (see diarize_segment()'s docstring
# for where these names come from) -- same fixed-weight idea as
# AI_FRAMING_WEIGHT/OFFSET in framing.js, so the bar only ever moves
# forward even though the true per-stage cost isn't known in advance.
# segmentation/embeddings are pyannote's two neural-network passes (the
# expensive ones); speaker_counting/discrete_diarization are cheap
# bookkeeping between them -- weighted accordingly, not evenly.
_DIARIZE_STAGE_WEIGHT = {"segmentation": 45, "speaker_counting": 5,
                         "embeddings": 45, "discrete_diarization": 5}
_DIARIZE_STAGE_OFFSET: dict[str, int] = {}
_acc = 0
for _name, _w in _DIARIZE_STAGE_WEIGHT.items():
    _DIARIZE_STAGE_OFFSET[_name] = _acc
    _acc += _w
del _acc, _name, _w


def _diarize_hook(job_id: str):
    """Turns pyannote's hook(step_name, step_artifact, total=, completed=)
    callbacks into JOBS[job_id]["percent"] -- see _run_diarize(). An
    unrecognized step_name (a pyannote version with different internal
    stage names) just contributes 0 rather than raising -- a stale-looking
    percent during that stage is a much smaller problem than crashing the
    diarization job over a progress cosmetic."""
    def hook(step_name, step_artifact, file=None, total=None, completed=None):
        within = (completed / total) if (total and completed is not None) else 1.0
        pct = _DIARIZE_STAGE_OFFSET.get(step_name, 0) + within * _DIARIZE_STAGE_WEIGHT.get(step_name, 0)
        with LOCK:
            t = JOBS.get(job_id)
            if t is not None:
                t["percent"] = min(99, round(pct))     # 100 reserved for true completion
                t["stage"] = step_name
    return hook


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

        cache = Cache(WORKSPACE / "cache")
        path = cache.diarize_path(video, start, end)
        if path.exists() and not req.get("force"):
            turns = json.loads(path.read_text(encoding="utf-8"))
            with LOCK:
                t["state"] = "done"
                t["turns"] = turns
                t["cached"] = True
                t["percent"] = 100
            return

        from .diarize import diarize_segment
        turns = diarize_segment(video, start, end, hook=_diarize_hook(job_id))
        path.write_text(json.dumps(turns), encoding="utf-8")

        with LOCK:
            t["state"] = "done"
            t["turns"] = turns
            t["percent"] = 100

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
    different project.

    The fingerprint is unavailable for a video the server can't reach, and
    the file used to be written as `<stem>.unknown.json`. That orphaned the
    work the moment the user followed the UI's own advice: drop a video from
    somewhere else, get told "not in workspace/samples/ -- move it there",
    move it, reload -- and the path now resolves to `<stem>.<realfp>.json`,
    a different file. The old one stayed listed on the home page, marked
    missing, and could never be opened again, with a second card beside it
    for the same video.

    So an `.unknown.json` left over from that is MIGRATED here as soon as
    the video becomes resolvable, instead of being stranded."""
    from .cache import fingerprint
    src = WORKSPACE / "samples" / Path(video).name
    stem = Path(video).stem
    if not src.exists():
        return PROJECTS / f"{stem}.unknown.json"

    real = PROJECTS / f"{stem}.{fingerprint(src)}.json"
    orphan = PROJECTS / f"{stem}.unknown.json"
    if orphan.exists() and not real.exists():
        try:
            orphan.replace(real)
        except OSError:
            # Migration is best-effort: if the rename fails (file locked,
            # permissions), the new project still works -- the old one just
            # stays where it was rather than taking the request down.
            pass
    return real


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
    # The cache name has to cover EVERY input that changes the picture.
    # top/height used to be left out, so dragging the framing box up or
    # down produced the same filename and the strip kept showing the old
    # crop -- a stale thumbnail that looked like the drag hadn't worked.
    dest = WORKSPACE / "out" / video.stem / "thumbs" / (
        f"{int(seconds * 10)}-{int(crop['left'])}-{int(crop['top'])}"
        f"-{int(crop['width'])}-{int(crop['height'])}-{width}.jpg")
    if dest.exists():
        return dest
    dest.parent.mkdir(parents=True, exist_ok=True)

    info = probe(video)
    even = lambda v: max(2, int(v) // 2 * 2)
    cw = even(info.width * crop["width"] / 100)
    ch = even(info.height * crop["height"] / 100)
    cx = even(info.width * crop["left"] / 100)
    cy = even(info.height * crop["top"] / 100)

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
            "-vf", f"crop={cw}:{ch}:{cx}:{cy},scale={width}:-2",
            "-q:v", "4", str(tmp)], desc="building a thumbnail", timeout=60)
        tmp.replace(dest)
    except (RuntimeError, OSError):
        # Thumbnail failed -- return empty path so the caller knows.
        tmp.unlink(missing_ok=True)
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
                # Quick previews are not renders. They live in a .preview/
                # subfolder now (one level deeper than this glob reaches),
                # but the leading-underscore check also hides the
                # _preview.mp4 files older builds left at this level --
                # those used to appear in History and on the workspace
                # dashboard as real output, one permanent row per video.
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
            #
            # Nothing writes to the socket inside this block. The delete
            # branch used to `return self._send_json(...)` while still
            # holding the lock, so a slow or stalled client kept every other
            # clips.json edit waiting on a network write.
            deleted = False
            with CLIPS_LOCK:
                clips = _load_clips()

                if req.get("delete"):
                    if not cid:
                        return self._send_json({"error": "id required"}, 400)
                    clips = [c for c in clips if c.get("id") != cid]
                    _save_clips(clips)
                    deleted = True
                else:
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
            if deleted:
                return self._send_json({"ok": True, "deleted": True})
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

                # Same reasoning as the render path above: an unreadable
                # transcript is reported, not silently turned into "no
                # captions". Returned in the response body since this
                # endpoint is synchronous and has no job to hang it on.
                words = []
                warning = ""
                try:
                    cache = Cache(WORKSPACE / "cache")
                    tpath = cache.find_any_transcript(video)
                    if tpath and tpath.exists():
                        words = Transcript.load(tpath).words
                except (OSError, ValueError, KeyError, TypeError) as exc:  # noqa: BLE001
                    warning = (f"captions skipped: the transcript exists but "
                               f"could not be read ({exc})")
                clip_words = _clip_words(k, words)

                style = k.get("style") if isinstance(k.get("style"), dict) else None

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
                # They also live in a .preview/ subfolder now: /api/history
                # globs out/*/*.mp4, so every preview used to show up in the
                # History screen and the workspace dashboard as if it were a
                # real render, permanently, one row per source video.
                pdir = WORKSPACE / "out" / video.stem / ".preview"
                pdir.mkdir(parents=True, exist_ok=True)
                tag = uuid.uuid4().hex[:8]
                dest = pdir / f"_preview.{tag}.mp4"
                _prune_previews(pdir, keep=dest)
                engine.render(video, job, dest, words=clip_words, style=style,
                              src_width=info.width, src_height=info.height,
                              has_audio=info.has_audio, verbose=False)
            except Exception as exc:                   # noqa: BLE001
                return self._send_json({"error": str(exc)}, 500)

            return self._send_json({
                "url": f"/workspace/out/{video.stem}/.preview/{dest.name}",
                "duration": round(job.duration, 1),
                **({"warning": warning} if warning else {}),
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
            _register_job(job_id, {"state": "running", "turns": [], "error": None,
                                   "percent": 0, "stage": "start", "cached": False})
            threading.Thread(target=_run_diarize, args=(job_id, req),
                             daemon=True).start()
            return self._send_json({"id": job_id})

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
        if path in RANGE_ENDPOINTS:
            module, fn_name, extra_key, out_key, empty_msg = RANGE_ENDPOINTS[path]
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
