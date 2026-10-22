"""Background jobs: rendering, transcribing, diarizing.

Each _run_* function is what a worker thread runs for one job; progress and
the outcome go into the shared JOBS registry, which the HTTP side polls. The
request-parsing helpers they share (spans, crops, caption words) live here
too, so the same payload means the same thing wherever it is read.

Nothing here knows about HTTP: server.py starts the threads and answers the
polls, and the same functions can be driven without it (see selftest)."""

from __future__ import annotations

import hashlib
import json
import sys
import threading
import time
import uuid
from pathlib import Path

from .cache import Cache
from .models import Transcript
from . import compose as composer
from . import render as engine
from . import roundtrip
from . import sched
from .progress import JobProgress, batch_eta
from .paths import CACHE_DIR, GLOSSARY, GUEST, OUT_ROOT, SOURCES, current_profile, find_video, safe_dirname
from .projects import (_project_assets_dir, _project_file,
                       _project_out_dir, _read_project, read_render_records,
                       write_render_record)

# Render jobs currently / already running
JOBS: dict[str, dict] = {}
LOCK = threading.Lock()
# file identity -> running transcribe job id (see transcribe_key), so there aren't two jobs for the
# same file: the first to finish deletes the temp wav the other is still using. Keyed by what the
# cache keys by (size + mtime), NOT by the bare name: two profiles can hold different videos
# under one name, and identical (hardlinked) copies are one file.
ACTIVE_TRANSCRIBES: dict[str, str] = {}
MAX_JOBS = 100  # cap entries in JOBS to prevent memory leak
# Render job ids marked for cancellation. _run_render checks via
# cancel_check; render.py kills the running ffmpeg if listed.
CANCELLED: set[str] = set()


def layout_label(picture: str, background: str, position) -> str:
    """What the picture looks like in the 9:16 frame, for the render rows and the plan: "9:16", or
    "16:9 · blur bg · center". `position` is the picture's vertical place in the frame (0 top, 100 bottom).
    The same words as layoutLabel() in ui/js/editor/app.js."""
    if picture == "9:16":
        return "9:16"
    try:
        pos = int(round(float(position)))
    except (TypeError, ValueError):
        pos = 50
    where = "center" if pos == 50 else "top" if pos == 0 else "bottom" if pos == 100 else f"pos {pos}%"
    return f"{picture} · {'black' if background == 'black' else 'blur'} bg · {where}"


def _publish_progress(job_id: str, snap: dict) -> None:
    """Write a progress snapshot ({percent, stage, eta}) into the job and, for an item of a batch, into the item and
    the batch's total time left."""
    eta = None if snap.get("eta") is None else int(round(snap["eta"]))
    with LOCK:
        t = JOBS.get(job_id)
        if t is None:
            return
        t.update(percent=snap["percent"], stage=snap["stage"], eta=eta)
        m = t.get("mirror")
        if m:
            b = JOBS.get(m["batch"])
            if b is not None:
                b["items"][m["index"]].update(percent=snap["percent"], stage=snap["stage"], eta=eta)
                b["eta"] = _batch_total_eta(b)


def _batch_total_eta(b: dict) -> int | None:
    """Time left of the whole batch (call with LOCK held): the running clip's own estimate plus the queued clips'
    lengths at the usual speed."""
    items = b["items"]
    running = next((x for x in items if x["state"] == "running"), None)
    queued = [float(x["duration"]) for x in items if x["state"] == "queued" and not x.get("cancel")]
    ratio = b.get("ratio")
    left = float(running["duration"]) * (1 - (running.get("percent") or 0) / 100) if running else 0.0
    total = batch_eta(running.get("eta") if running else None, left, queued, ratio)
    return None if total is None else int(round(total))


def transcribe_key(name: str) -> str:
    """Which file a transcribe request is about: the cache's own fingerprint (size + mtime) of the profile's
    source of that name. A name that is not there gets a key of its own (the job fails at once)."""
    from .cache import fingerprint
    video = find_video(name) if name else None
    if video is None:
        return f"missing:{current_profile()}:{name}"
    try:
        return "fp:" + fingerprint(video)
    except OSError:
        return f"missing:{current_profile()}:{name}"


def _queue_updater(job_id: str):
    """What a waiting job tells the scheduler to show: state "queued" with `queue` {text, position, waitingFor}
    while it waits, back to "running" (no `queue`) once it has its slot."""
    def update(info):
        with LOCK:
            t = JOBS.get(job_id)
            if t is None:
                return
            if info:
                t["state"] = "queued"
                t["queue"] = info
            else:
                if t.get("state") == "queued":
                    t["state"] = "running"
                t.pop("queue", None)
    return update


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


def _load_transcript_words(video: Path, t: dict) -> list:
    """ANY transcript for this video -- don't guess model/lang, because a
    wrong silent guess removes captions without a message.

    A transcript that EXISTS but can't be read is a different thing from
    one that was never made, and a bare `except: pass` here used to erase
    that difference: a file truncated by a killed process, a JSON decode
    error or a locked file all produced words=[] and the render ran to
    completion, handing back an MP4 with no subtitles and no error
    anywhere. The reason is recorded on the job (`t`) so the History row
    can say so. The exception list is narrow on purpose -- anything else
    is a real bug that should surface, not be absorbed here.

    Factored out of _run_render so a multi-asset render can call it once
    per source video instead of once for the whole job."""
    words = []
    try:
        cache = Cache(CACHE_DIR)
        path = cache.find_transcript(video)
        if path and path.exists():
            words = Transcript.load(path).words
    except (OSError, ValueError, KeyError, TypeError) as exc:  # noqa: BLE001
        with LOCK:
            t["warning"] = (f"captions skipped: the transcript for {video.name} exists but "
                            f"could not be read ({exc})")
    return words


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


def _run_words(k: dict, run_video: str, default_video: str, fallback) -> list:
    """The caption words for one video's run of a multi-video clip.

    The client sends one corrected word list for the whole clip, each word
    in its own video's seconds and naming that video when it isn't the
    request's one (same convention as spans, see serverClipFields in
    ui/js/editor/assets.js). Two episodes can share a timestamp, so the
    video is what keeps one episode's correction off the other's run.

    `fallback` is only called when the client sent nothing for this video:
    that video's transcript as-is, uncorrected."""
    if isinstance(k.get("words"), list) and k["words"]:
        mine = [w for w in k["words"]
                if isinstance(w, dict) and (w.get("video") or default_video) == run_video]
        if mine:
            return _clip_words({"words": mine}, [])
    return fallback()


def _run_render(job_id: str, req: dict, into: Path | None = None, record: bool = True, queue: bool = True) -> None:
    """Render a request once it has a render slot (sched.py: shared by every tab and profile). `queue` False
    is for a caller that already holds one (a batch takes a slot per item)."""
    if not queue:
        return _render_body(job_id, req, into, record)
    with sched.slot(sched.GROUP_RENDER, "render", job_id, cancelled=lambda: job_id in CANCELLED,
                    update=_queue_updater(job_id)) as ticket:
        if ticket is None:                         # cancelled while it waited
            with LOCK:
                JOBS[job_id]["state"] = "cancelled"
            CANCELLED.discard(job_id)
            return
        _render_body(job_id, req, into, record)


def _render_body(job_id: str, req: dict, into: Path | None = None, record: bool = True) -> None:
    """Render a request. `into` sends the files to that folder instead of the
    project's own (a replay, the selftest); `record` is whether the finished
    render is remembered as the Result's last (see _record_render)."""
    t = JOBS[job_id]
    try:
        video = find_video(req["video"])
        if not video:
            raise FileNotFoundError(
                f"{req['video']} is not in a folder the server can reach. "
                f"Put the file in sources/.")

        # This job's one default video's transcript, used by every span that
        # doesn't name its own asset -- see _load_transcript_words for what
        # "any transcript" and the narrow exception list mean.
        words = _load_transcript_words(video, t)

        from .ffmpeg_tools import probe
        info = probe(video)
        # Renders belong to the PROJECT. Grouping them under the video's
        # stem is the same thing only while a project holds exactly one
        # video; a project with five episodes would scatter its output
        # across five folders named after videos, with nothing showing
        # they belong together (ian).
        #
        # A project that somehow can't be read still renders -- into the
        # old video-stem folder -- rather than failing the job over a
        # folder name.
        out_dir = OUT_ROOT / safe_dirname(video.stem)
        # By the project's id, which the editor always sends.
        pf = _project_file(req.get("project"))
        pdata = _read_project(pf) if pf and pf.is_file() else None
        if pdata:
            out_dir = _project_out_dir(pdata)
        if into is not None:
            out_dir = into
        clips = req["clips"]
        taken = _files_of_other_results(pdata, req.get("result"))
        # Under LOCK like every other JOBS write in this function. Rebinding
        # an existing key can't actually race, but the inconsistency is
        # exactly the kind of thing the surrounding code is careful about.
        with LOCK:
            t["total"] = len(clips)

        def span_seconds(raw_spans) -> float:
            try:
                return sum(max(0.0, float(p["end"]) - float(p["start"])) for p in raw_spans)
            except (KeyError, TypeError, ValueError):
                return 0.0

        # Real progress: ffmpeg reports the output seconds it has written; progress.py turns them into a percent
        # split by stage weight, and a time left from this profile's usual speed, then from the real pace.
        prog = JobProgress([span_seconds(k.get("spans", [])) for k in clips], speed_ratio(),
                           lambda snap: _publish_progress(job_id, snap))

        for i, k in enumerate(clips):
            if job_id in CANCELLED:
                with LOCK:
                    t["state"] = "cancelled"
                return
            with LOCK:
                t["current"] = k["title"]
                t["index"] = i

            spans_raw = k.get("spans", [])
            if not spans_raw:
                raise ValueError(f"Clip \"{k.get('title', '?')}\" has no spans.")
            # A span can carry its own `video` (library projects, stage 1);
            # one that doesn't belongs to the job's one video, exactly as
            # every span has until now. Grouped into RUNS of contiguous
            # spans sharing a video -- see engine.asset_runs -- because a single
            # moment doesn't jump source mid-span.
            runs = engine.asset_runs(spans_raw, req["video"])
            # Is there a second pass (compose.py)? Worked out now, with the same cleaning it gets later, so the
            # bar's weights are right from the start.
            clip_seconds = span_seconds(spans_raw)
            try:
                has_pass2 = bool(composer.clean_elements(
                    k.get("overlays"), clip_seconds,
                    (_project_assets_dir(pdata.get("id")) if pdata else None) or (out_dir / ".no-assets"))
                    or composer.clean_volumes(k.get("volumes"), clip_seconds))
            except Exception:                              # noqa: BLE001 (only a prediction)
                has_pass2 = bool(k.get("overlays") or k.get("volumes"))
            prog.begin_clip(i, [span_seconds(rs) for _, rs in runs], has_pass2)

            crop = k.get("crop") or {}
            crop_box = engine.CropBox(
                left=crop.get("left", 37), top=crop.get("top", 4),
                width=crop.get("width", 26), height=crop.get("height", 92))
            picture = engine.picture_options(k)
            out_width = int(k.get("width", 1080))
            quality = int(k.get("quality", 21))
            # Caption style comes from the Caption screen in the UI. If not
            # sent, build_ass uses its defaults. One style for the whole
            # clip, single- or multi-asset alike -- it's a look, not a
            # property of any one source video.
            style = style_with_profile(k.get("style") if isinstance(k.get("style"), dict) else None)
            # Named after the post title (what YouTube will read as the video's
            # title), else the Result's. Another Result's file is never taken: its
            # name gets -2, -3 ... A Result rendered again keeps writing its own.
            name = engine.unique_filename(
                engine.safe_filename(engine.clip_file_title(
                    {**k, "post": None} if current_profile() == GUEST else k), f"clip-{i+1}"), taken)
            taken.add(name.lower())
            dest = out_dir / name

            if len(runs) == 1 and runs[0][0] == req["video"]:
                # Exactly today's path -- the request's one video, spans
                # split only at framing points, one encode. Untouched, so a
                # single-asset clip renders byte-identically to before this
                # function learned what an asset is.
                # p["crop"] is what makes framing shift mid-clip: each
                # segment is framed independently before joining. p["crops"]
                # holds two boxes and turns the segment into a split frame.
                spans = _spans_from_clip(k)
                job = engine.RenderJob(title=k["title"], spans=spans, crop=crop_box,
                                       **picture, out_width=out_width, quality=quality)
                clip_words = _clip_words(k, words)
                try:
                    prog.advance()                         # preparing -> the encode
                    engine.render(video, job, dest, words=clip_words, style=style,
                                 src_width=info.width, src_height=info.height,
                                 has_audio=info.has_audio, verbose=False,
                                 cancel_check=lambda: job_id in CANCELLED, on_progress=prog.tick)
                except engine.RenderCancelled:
                    with LOCK:
                        t["state"] = "cancelled"
                    return
                duration = job.duration
            else:
                # Multi-asset: pass 1 of the library-projects plan. Each run
                # goes through the SAME single-source pipeline as the branch
                # above -- its own file, dimensions, transcript, crop and
                # captions -- to its own temp file; the pieces are then
                # joined. No multi-input filter graph, and every existing
                # feature (split frame, head tracking, the rounded
                # highlight box) works here for the same reason it works
                # above: the code doing it is the code that already does it.
                tmp_dir = out_dir / f".tmp-{job_id}"
                tmp_dir.mkdir(parents=True, exist_ok=True)
                parts: list[Path] = []
                duration = 0.0
                try:
                    for ridx, (run_video_name, run_spans_raw) in enumerate(runs):
                        run_video = find_video(run_video_name)
                        if not run_video:
                            raise FileNotFoundError(
                                f"{run_video_name} is not in a folder the server can "
                                f"reach. Put the file in sources/.")
                        run_info = probe(run_video)
                        run_words = _run_words(k, run_video_name, req["video"],
                                               lambda: _load_transcript_words(run_video, t))
                        run_spans = _spans_from_clip({"spans": run_spans_raw})
                        run_job = engine.RenderJob(title=k["title"], spans=run_spans,
                                                   crop=crop_box, **picture,
                                                   out_width=out_width, quality=quality)
                        part_dest = tmp_dir / f"part{ridx}.mp4"
                        prog.advance()                     # the next piece
                        engine.render(run_video, run_job, part_dest, words=run_words,
                                     style=style, src_width=run_info.width,
                                     src_height=run_info.height, has_audio=run_info.has_audio,
                                     verbose=False, cancel_check=lambda: job_id in CANCELLED,
                                     on_progress=prog.tick)
                        parts.append(part_dest)
                        duration += run_job.duration
                    if job_id in CANCELLED:
                        with LOCK:
                            t["state"] = "cancelled"
                        return
                    if len(parts) == 1:
                        parts[0].replace(dest)
                    else:
                        prog.advance()                     # joining
                        engine.concat_renders(parts, dest, quality)
                except engine.RenderCancelled:
                    with LOCK:
                        t["state"] = "cancelled"
                    return
                finally:
                    for p in parts:
                        p.unlink(missing_ok=True)
                        p.with_suffix(".ass").unlink(missing_ok=True)
                    try:
                        tmp_dir.rmdir()
                    except OSError:
                        pass

            # Pass 2 (compose.py): labels, stickers, sounds and per-segment
            # volume, timed against the finished clip. Only a clip that has
            # any reaches it -- every other render is exactly what pass 1
            # wrote, untouched.
            # Images and sounds come from the project's own folder.
            media_dir = (_project_assets_dir(pdata.get("id")) if pdata else None) or (out_dir / ".no-assets")
            elements = composer.clean_elements(k.get("overlays"), duration, media_dir)
            volumes = composer.clean_volumes(k.get("volumes"), duration)
            if elements or volumes:
                with LOCK:
                    t["current"] = f"{k['title']} · adding timeline elements"
                raw = dest.with_name(dest.stem + ".pass1.mp4")
                dest.replace(raw)
                out_h = out_width * 16 // 9
                try:
                    prog.advance()                         # the second pass
                    composer.compose(raw, dest, width=out_width, height=out_h - (out_h & 1),
                                     duration=duration, elements=elements, volumes=volumes,
                                     quality=quality, cancel_check=lambda: job_id in CANCELLED,
                                     on_progress=prog.tick)
                except engine.RenderCancelled:
                    raw.unlink(missing_ok=True)
                    with LOCK:
                        t["state"] = "cancelled"
                    return
                except Exception as exc:                # noqa: BLE001
                    # The clip itself is fine -- keep it rather than lose a
                    # finished render over a sticker, and say what's missing.
                    dest.unlink(missing_ok=True)
                    raw.replace(dest)
                    with LOCK:
                        t["warning"] = f"saved without its timeline elements: {exc}"
                finally:
                    raw.unlink(missing_ok=True)

            with LOCK:
                t["result"].append({
                    "title": k["title"],
                    "file": name,
                    # Relative to out_dir, not hardcoded to the job's one
                    # video -- out_dir may already be the project's own
                    # folder (_project_out_dir), which a multi-asset render
                    # always uses and a single-asset one uses whenever the
                    # project resolves.
                    "url": _out_url(out_dir, name),
                    "folder": str(out_dir),
                    "mb": round(dest.stat().st_size / 1048576, 1),
                    "duration": round(duration, 1),
                })
                t["done"] = i + 1
            prog.finish_clip()

        if record and pdata:
            _record_render(job_id, req, pdata, out_dir)
            if current_profile() != GUEST:           # the Guest makes no schedule rows
                _schedule_render(job_id, req, pdata)
        with LOCK:
            t.update(state="done", percent=100, stage="", eta=None)

    except Exception as exc:                       # noqa: BLE001
        with LOCK:
            t["state"] = "failed"
            t["error"] = str(exc)
    finally:
        CANCELLED.discard(job_id)                  # don't leak to the next job id


# --------------------------------------------------------------------------
# rendering Results of a saved project (P23): one request per Result, built here, run one after another
# --------------------------------------------------------------------------

def _request_adapters():
    """What renderreq needs from the machine: the words of a video (transcript cache) and its size."""
    from . import renderreq
    cache = Cache(CACHE_DIR)
    words: dict = {}
    sizes: dict = {}

    def words_of(file):
        if file not in words:
            video = find_video(file) or (SOURCES / Path(file).name)
            path = cache.find_transcript(video) if file else None
            words[file] = renderreq.words_from_transcript_json(path) if path else None
        return words[file]

    def size_of(file):
        if file not in sizes:
            video = find_video(file) if file else None
            try:
                from .ffmpeg_tools import probe
                info = probe(video) if video else None
                sizes[file] = (info.width, info.height) if info else None
            except Exception:                        # noqa: BLE001
                sizes[file] = None
        return sizes[file]

    return words_of, size_of


def plan_project_render(pdata: dict, result_ids: list[str]) -> tuple[list[dict], list[dict]]:
    """For each Result asked for: its request, or why it cannot be rendered.
    Returns (items, refused): items = [{result, title, request, duration}], refused = [{result, title, code, message}]."""
    from . import renderreq
    words_of, size_of = _request_adapters()
    titles = {r.get("id"): (r.get("title") or "") for r in pdata.get("results") or [] if isinstance(r, dict)}
    items, refused = [], []
    for rid in result_ids:
        title = titles.get(rid, "") or str(rid)
        try:
            req = renderreq.build_request(pdata, rid, words_of=words_of, size_of=size_of)
        except renderreq.RequestError as exc:
            refused.append({"result": rid, "title": title, "code": exc.code, "message": exc.message})
            continue
        clip = req["clips"][0]
        files = {req["video"]} | {s.get("video") for s in clip["spans"] if s.get("video")}
        missing = sorted(f for f in files if f and not find_video(f))
        if missing:
            refused.append({"result": rid, "title": clip["title"], "code": "no_source",
                            "message": f"{missing[0]} is not in this profile's sources."})
            continue
        duration = sum(s["end"] - s["start"] for s in clip["spans"])
        layout = layout_label(clip["picture"], clip["background"], clip["position"])
        items.append({"result": rid, "title": clip["title"], "request": req, "duration": round(duration, 1),
                      "layout": layout})
    return items, refused


def start_project_render(project_id: str, result_ids: list[str]) -> dict:
    """Render these Results of the saved project, one after another, as one job. Returns {id, items, refused};
    raises ValueError when nothing can be rendered."""
    pf = _project_file(project_id)
    pdata = _read_project(pf) if pf and pf.is_file() else None
    if not pdata:
        raise ValueError("That project is not saved yet.")
    ids = [str(r) for r in dict.fromkeys(result_ids)]
    if not ids:
        raise ValueError("No Result was chosen.")
    items, refused = plan_project_render(pdata, ids)
    if not items:
        raise ValueError(refused[0]["message"] if refused else "Nothing to render.")
    batch_id = uuid.uuid4().hex[:8]
    entry_items = [{"result": it["result"], "title": it["title"], "duration": it["duration"], "layout": it["layout"],
                    "state": "queued", "error": None, "cancel": False} for it in items]
    _register_job(batch_id, {"state": "running", "done": 0, "total": len(items), "index": 0, "current": "",
                             "result": [], "error": None, "batch": True, "items": entry_items,
                             "refused": refused})
    import contextvars
    threading.Thread(target=contextvars.copy_context().run,
                     args=(_run_batch, batch_id, [it["request"] for it in items]),
                     daemon=True).start()
    return {"id": batch_id, "items": [dict(i) for i in entry_items], "refused": refused}


def _speed_file() -> Path:
    from .paths import profile_dir
    return profile_dir() / "render-speed.json"


def _note_speed(seconds: float, duration: float) -> None:
    """Remember how long a finished clip took (wall seconds per second of output), last 10, for the estimate."""
    if duration <= 0 or seconds <= 0:
        return
    try:
        f = _speed_file()
        try:
            data = json.loads(f.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            data = []
        data = (data if isinstance(data, list) else [])[-9:] + [{"sec": round(seconds, 2), "dur": round(duration, 2)}]
        f.parent.mkdir(parents=True, exist_ok=True)
        f.write_text(json.dumps(data), encoding="utf-8")
    except OSError:
        pass


def speed_ratio() -> float | None:
    """The usual wall seconds per second of output of this profile's renders (median of the last ten), or None."""
    ratios = []
    try:
        for x in json.loads(_speed_file().read_text(encoding="utf-8")):
            if x.get("dur", 0) > 0:
                ratios.append(float(x["sec"]) / float(x["dur"]))
    except (OSError, ValueError, TypeError, KeyError):
        ratios = []
    if ratios:
        ratios.sort()
        return ratios[len(ratios) // 2]
    return None


def estimate_seconds(durations: list[float]) -> tuple[int, str]:
    """(seconds, how it was worked out): the median of the last renders' speed, else about 30 s a clip."""
    ratio = speed_ratio()
    if ratio is not None:
        return int(round(sum(durations) * ratio)), "from the last renders"
    return 30 * len(durations), "a rough guess of 30 s a clip until a render has been timed"


def _run_batch(batch_id: str, requests: list[dict]) -> None:
    """Run the requests one after another, each as a render job of its own (so each records its last request,
    makes its schedule row and its History entry exactly as a single render does)."""
    t = JOBS[batch_id]
    items = t["items"]
    with LOCK:
        t["ratio"] = speed_ratio()
        for x in items:                              # each queued clip's own estimate, from this profile's usual speed
            x["est"] = int(round(float(x["duration"]) * t["ratio"])) if t["ratio"] else None
        t["eta"] = _batch_total_eta(t)
    try:
        for i, req in enumerate(requests):
            item = items[i]
            with LOCK:
                stop_all = batch_id in CANCELLED
                skip = item["cancel"]
                if stop_all or skip:
                    item["state"] = "cancelled"
                    continue

            def show_wait(info, item=item):
                with LOCK:
                    item["queue"] = info             # None once it has its slot

            # A slot per ITEM (not for the whole batch), so another tab's render gets its turn between two clips
            with sched.slot(sched.GROUP_RENDER, "render", f"{batch_id}-{i}",
                            cancelled=lambda item=item: batch_id in CANCELLED or item["cancel"],
                            update=show_wait) as ticket:
                if ticket is None:
                    with LOCK:
                        item["state"] = "cancelled"
                        item["queue"] = None
                    continue
                with LOCK:
                    item["state"] = "running"
                    item.pop("queue", None)
                    t["index"] = i
                    t["current"] = item["title"]
                sub = f"{batch_id}-{i}"
                started_at = time.time()
                _register_job(sub, {"state": "running", "done": 0, "total": 1, "index": 0, "current": "",
                                    "result": [], "error": None, "mirror": {"batch": batch_id, "index": i}})
                with LOCK:
                    item["job"] = sub
                    if item["cancel"]:                   # cancelled while AI Framing ran
                        CANCELLED.add(sub)
                _run_render(sub, req, queue=False)
            with LOCK:
                sj = JOBS.pop(sub, None) or {}
                item["job"] = None
                item["state"] = {"done": "done", "cancelled": "cancelled"}.get(sj.get("state"), "failed")
                if item["state"] == "done":
                    item.update(percent=100, eta=None, stage="")
                else:
                    item.update(eta=None, stage="")
                if item["state"] == "failed":
                    item["error"] = sj.get("error") or "the render failed"
                if sj.get("result"):
                    item["output"] = sj["result"][0]
                    t["result"].append(sj["result"][0])
                    if item["state"] == "done":
                        _note_speed(time.time() - started_at, float(sj["result"][0].get("duration") or item["duration"]))
                for key in ("schedule", "warning"):
                    if sj.get(key):
                        item[key] = sj[key]
                t["done"] = sum(1 for x in items if x["state"] == "done")
                t["eta"] = _batch_total_eta(t)
        with LOCK:
            t["eta"] = None
            cancelled = batch_id in CANCELLED
            for x in items:
                if x["state"] == "queued":
                    x["state"] = "cancelled"
            if cancelled:
                t["state"] = "cancelled"
            elif items and all(x["state"] == "failed" for x in items):
                t["state"] = "failed"
                t["error"] = items[0]["error"]
            else:
                t["state"] = "done"
    except Exception as exc:                          # noqa: BLE001
        with LOCK:
            t["state"] = "failed"
            t["error"] = str(exc)
    finally:
        CANCELLED.discard(batch_id)


def cancel_job(job_id: str, item: int | None = None) -> bool:
    """Cancel a render job. For a batch: the whole batch (`item` None) or one clip of it (a queued one is
    skipped, the running one is stopped and the next one starts). True when something was cancelled."""
    try:
        return _cancel_job(job_id, item)
    finally:
        sched.poke()                               # a job waiting for a slot leaves the queue at once


def _cancel_job(job_id: str, item: int | None) -> bool:
    with LOCK:
        t = JOBS.get(job_id)
        if not t or t.get("state") not in ("running", "queued"):
            return False
        if not t.get("batch"):
            CANCELLED.add(job_id)
            return True
        items = t["items"]
        if item is None:
            CANCELLED.add(job_id)
            for x in items:
                if x.get("job"):
                    CANCELLED.add(x["job"])
            return True
        if not 0 <= item < len(items):
            return False
        x = items[item]
        if x["state"] == "queued":
            x["cancel"] = True
            x["state"] = "cancelled"
            return True
        if x["state"] == "running":
            x["cancel"] = True
            if x.get("job"):
                CANCELLED.add(x["job"])
            return True
        return False


def _out_url(out_dir: Path, name: str) -> str:
    """Where the page can fetch a render from; empty for a folder outside out/
    (a replay's temporary one)."""
    try:
        # ?profile=: a <video> or <a> cannot send the profile header the API calls do
        return f"/workspace/out/{out_dir.relative_to(OUT_ROOT).as_posix()}/{name}?profile={current_profile()}"
    except ValueError:
        return ""


def hash_file(path: Path) -> dict:
    """What a render is compared by: md5, sha256, size."""
    md5, sha = hashlib.md5(), hashlib.sha256()
    size = 0
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            md5.update(chunk)
            sha.update(chunk)
            size += len(chunk)
    return {"md5": md5.hexdigest(), "sha256": sha.hexdigest(), "bytes": size}


def _files_of_other_results(pdata: dict | None, result_id) -> set[str]:
    """Lower-cased names of the files the OTHER Results of this project last
    rendered (their render records), which a new file must not overwrite."""
    if not pdata:
        return set()
    try:
        records = read_render_records(pdata.get("id"))
    except OSError:
        return set()
    return {o["file"].lower() for rid, rec in records.items() if rid != str(result_id or "")
            for o in rec.get("outputs") or [] if isinstance(o, dict) and o.get("file")}


def _record_render(job_id: str, req: dict, pdata: dict, out_dir: Path) -> None:
    """Remember a FINISHED render as its Result's last one: the request as the
    editor sent it, and the hashes of the files it produced. A cancelled or
    failed render never gets here; neither does the quick preview, which is not
    a render job. Failing to remember is a warning, never a failed render."""
    t = JOBS[job_id]
    result_id = req.get("result")
    if not result_id:
        return                              # an editor from before this existed
    try:
        outputs = [{"file": r["file"], **hash_file(out_dir / r["file"])} for r in t["result"]]
        saved = write_render_record(pdata.get("id"), result_id, {
            "project": pdata.get("id"), "result": result_id, "at": int(time.time()),
            "request": req, "outputs": outputs,
        })
    except OSError as exc:
        with LOCK:
            t["warning"] = f"render finished, but could not be remembered for replay ({exc})"
        return
    if not saved:
        with LOCK:
            t["warning"] = "render finished, but its Result id is not usable for replay"


def _schedule_render(job_id: str, req: dict, pdata: dict) -> None:
    """A finished render of a Result makes (or updates) its Draft row in the
    upload schedule: title, file, the source credit, and the post text ready to
    paste. Only for a real render of one Result -- never the quick preview (not a
    job), a replay or the selftest (`record` is off for them). Failing to add the
    row is a warning, never a failed render."""
    from . import credits, schedule
    t = JOBS[job_id]
    clips = req.get("clips") or []
    result_id = req.get("result")
    if len(clips) != 1 or not result_id or not t["result"]:
        return
    k = clips[0]
    try:
        names = []
        for span in k.get("spans") or []:
            name = (span.get("video") if isinstance(span, dict) else None) or req.get("video")
            if name and name not in names:
                names.append(name)
        row_id, created = schedule.upsert_render(
            project_id=pdata.get("id"), result_id=str(result_id),
            title=str(k.get("title") or ""), file_name=t["result"][0]["file"],
            post=roundtrip._post(k.get("post")), credit_lines=credits.lines(names))
    except (OSError, ValueError, TypeError) as exc:
        with LOCK:
            t["warning"] = f"render finished, but its upload-schedule row could not be saved ({exc})"
        return
    with LOCK:
        t["schedule"] = {"id": row_id, "created": created}


def add_render_to_schedule(folder: str, file_name: str) -> tuple[str, bool, str]:
    """A render file the schedule does not know (rendered before the schedule
    existed, or its row was deleted) gets a Draft row: from the render record of
    the Result that made it when there is one (title, post text, credit, project and
    result ids -- the same row a render makes), else from the file name alone. A file
    the schedule already has gets no second row. Returns (row id, created, how)."""
    from . import credits, schedule
    pid = schedule.project_of_folder(folder)
    pairs, loose = schedule.scheduled_files()
    if (pid, file_name) in pairs or file_name in loose:
        row = next(r for r in schedule.load_clips() if r.get("file") == file_name)
        return row["id"], False, "already in the schedule"
    if pid:
        for result_id, rec in read_render_records(pid).items():
            if not any(isinstance(o, dict) and o.get("file") == file_name for o in rec.get("outputs") or []):
                continue
            req = rec.get("request") or {}
            clips = req.get("clips") or [{}]
            k = clips[0] if isinstance(clips[0], dict) else {}
            if any(r.get("projectId") == pid and r.get("resultId") == result_id for r in schedule.load_clips()):
                break                      # that Result has its row (its newer file): no second one
            names = []
            for span in k.get("spans") or []:
                name = (span.get("video") if isinstance(span, dict) else None) or req.get("video")
                if name and name not in names:
                    names.append(name)
            row_id, created = schedule.upsert_render(
                project_id=pid, result_id=str(result_id), title=str(k.get("title") or ""),
                file_name=file_name, post=roundtrip._post(k.get("post")),
                credit_lines=credits.lines(names))
            return row_id, created, "from the render record"
    title = " ".join(Path(file_name).stem.replace("-", " ").replace("_", " ").split()) or file_name
    row_id, created = schedule.add_file_row(title, file_name, pid)
    return row_id, created, "from the file name"


def style_with_profile(style: dict | None) -> dict | None:
    """The caption style of a request, with the profile's own watermark text when the
    request does not name one."""
    from . import profiles
    wm = profiles.defaults().get("watermark")
    if wm and not (style or {}).get("watermark_text"):
        return {**(style or {}), "watermark_text": wm}
    return style


def missing_inputs(req: dict) -> list[str]:
    """What a request needs that isn't on this machine: its videos, and the
    project's images and sounds that its timeline elements use. Empty means it
    can be rendered. (A render without them would not fail -- it would quietly
    come out different, which is worse.)"""
    out = []
    names = {req.get("video")}
    for k in req.get("clips", []):
        names.update(p.get("video") for p in k.get("spans", []) if isinstance(p, dict))
        names.update(w.get("video") for w in k.get("words", []) if isinstance(w, dict))
    out += [f"video {n}" for n in sorted(x for x in names if x) if not find_video(n)]
    wanted = {Path(str(e.get("file") or "")).name
              for k in req.get("clips", []) for e in k.get("overlays", []) or []
              if isinstance(e, dict) and e.get("kind") in ("image", "sound") and e.get("file")}
    if wanted:
        folder = _project_assets_dir(req.get("project"))
        out += [f"asset {n}" for n in sorted(wanted) if not (folder and (folder / n).is_file())]
    return out


def render_request(req: dict, into: Path) -> list[dict]:
    """Run a render request to completion, in this thread, writing into `into`.
    Returns [{file, md5, sha256, bytes}] per clip; raises RuntimeError with the
    job's own message if it didn't finish. Not remembered as a Result's last
    render. This is the server's render, driven without the server."""
    job_id = "direct-" + str(time.time_ns())
    _register_job(job_id, {"state": "running", "done": 0, "total": len(req["clips"]),
                           "index": 0, "current": "", "result": [], "error": None})
    try:
        _run_render(job_id, req, into=into, record=False)
        job = JOBS[job_id]
        if job["state"] != "done":
            raise RuntimeError(job.get("error") or f"render ended {job['state']}")
        return [{"file": r["file"], **hash_file(into / r["file"])} for r in job["result"]]
    finally:
        JOBS.pop(job_id, None)


def _transcribe_needs_work(req: dict) -> bool:
    """False when a transcribe request would only report what is cached (the cues and a transcript are there
    and it is not forced): that takes no slot. Anything unclear counts as work."""
    try:
        from . import cues as cues_mod
        from .transcribe import DEFAULT_LANGUAGE, DEFAULT_MODEL
        if req.get("force"):
            return True
        video = find_video(req["video"])
        if not video:
            return False                           # it fails at once
        cache = Cache(CACHE_DIR)
        record = cues_mod.audio_record(video, cache)
        if record is None or record["status"] != "ok":
            return True
        model, lang = req.get("model", DEFAULT_MODEL), req.get("lang", DEFAULT_LANGUAGE)
        gloss_path = GLOSSARY if GLOSSARY.exists() else None
        found = cache.find_transcript(video, model, lang, gloss_path)
        return not (found is not None and (found == cache.transcript_path(video, model, lang, gloss_path) or (
            model == DEFAULT_MODEL and lang == DEFAULT_LANGUAGE)))
    except Exception:                              # noqa: BLE001
        return True


def _run_transcribe(job_id: str, req: dict) -> None:
    """Transcribe once Whisper's turn comes (sched.py: one heavy AI job at a time on this computer, for all tabs
    and profiles). A request that only reports the cache does not wait."""
    t = JOBS[job_id]
    try:
        if not _transcribe_needs_work(req):
            _transcribe_body(job_id, req)
            return
        with sched.slot(sched.GROUP_AI, "transcribe", job_id, cancelled=lambda: job_id in CANCELLED,
                        update=_queue_updater(job_id)) as ticket:
            if ticket is None:
                with LOCK:
                    t["state"] = "cancelled"
                return
            _transcribe_body(job_id, req)
    finally:
        CANCELLED.discard(job_id)
        with LOCK:
            # Only release the registration if it STILL belongs to this job (another job for the same
            # file may have registered since; an unconditional pop would delete ITS registration).
            key = t.get("key") or ""
            if key and ACTIVE_TRANSCRIBES.get(key) == job_id:
                ACTIVE_TRANSCRIBES.pop(key, None)


def _transcribe_body(job_id: str, req: dict) -> None:
    """Real transcription with real progress.

    Previously the Analysis screen just animated a bar for 9 seconds. The
    numbers were derived from the file duration, but nothing was actually
    transcribed -- the UI relied on cache filled via the command line.
    """
    t = JOBS[job_id]
    try:
        from .ffmpeg_tools import extract_audio, probe
        from .glossary import Glossary
        from .transcribe import DEFAULT_LANGUAGE, DEFAULT_MODEL, DEFAULT_THREADS, transcribe

        video = find_video(req["video"])
        if not video:
            raise FileNotFoundError(
                f"{req['video']} is not in sources/.")

        cache = Cache(CACHE_DIR)

        # Audio cues (laughter, applause, shouts, music): once per video, and
        # BEFORE the transcript cache-hit path below, so a video that already
        # has a transcript still gets them when Find clips is clicked. Never fatal, never silent: run_audio_cues saves a
        # failure into the cache file and the job reports it, so the editor
        # can say "failed" instead of showing nothing. A failed or out-of-date
        # result is tried again.
        from . import cues as cues_mod
        record = cues_mod.audio_record(video, cache)
        if record is None or record["status"] != "ok":
            with LOCK:
                t["stage"] = "cues"
            record = cues_mod.run_audio_cues(video, cache)
        with LOCK:
            t["cues"] = {"status": record["status"], "error": record.get("error", ""),
                         "seconds": record.get("seconds")}

        model = req.get("model", DEFAULT_MODEL)
        lang = req.get("lang", DEFAULT_LANGUAGE)
        threads = int(req.get("threads", DEFAULT_THREADS))
        with LOCK:
            t["model"] = model          # for the page to show what actually runs
            t["threads"] = threads
        gloss_path = GLOSSARY if GLOSSARY.exists() else None
        # Where a transcript made NOW is saved. Also the file that counts as
        # exact (find_transcript prefers it).
        path = cache.transcript_path(video, model, lang, gloss_path)

        info = probe(video)
        with LOCK:
            t["duration"] = info.duration
            t["battery"] = _on_battery()

        # Already transcribed? The same rule as everything that READS a
        # transcript (Cache.find_transcript): this exact one, else the newest
        # for the video. Otherwise Find clips would repeat 18 minutes of work
        # whenever the video file or glossary.txt was touched since, while the
        # editor shows the old transcript perfectly well. `force` is the
        # "Transcribe again" button. The newest-fallback is only for the
        # app's own model and language: asking for another one is asking for
        # a different transcript, so it always runs.
        if not req.get("force"):
            found, turned_down = cache.find_transcript_why(video, model, lang, gloss_path)
            if found is None and turned_down:
                with LOCK:
                    t["note"] = ("An older transcript with this file name was not reused (" + turned_down[0]
                                 + "): transcribing this file again.")
            if found is not None and (found == path or (
                    model == DEFAULT_MODEL and lang == DEFAULT_LANGUAGE)):
                with LOCK:
                    t["state"] = "done"
                    t["cached"] = True
                    t["exact"] = found == path
                    t["file"] = found.name
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
        gloss = Glossary.load(GLOSSARY)

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
            threads=threads,
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
            t["exact"] = True               # just made with today's settings
            t["file"] = path.name
            t["percent"] = 100

    except Exception as exc:                       # noqa: BLE001
        with LOCK:
            t["state"] = "failed"
            t["error"] = str(exc)
    finally:
        try:
            for leftover in CACHE_DIR.glob(f"*.{job_id}.wav"):
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
    """Diarize once the AI turn comes (sched.py); a clip whose turns are cached does not wait."""
    t = JOBS[job_id]
    try:
        video = find_video(req.get("video", ""))
        cached = bool(video) and not req.get("force") and \
            Cache(CACHE_DIR).diarize_path(video, float(req.get("start", 0)), float(req.get("end", 0))).exists()
    except Exception:                              # noqa: BLE001
        cached = False
    try:
        if cached:
            _diarize_body(job_id, req)
            return
        with sched.slot(sched.GROUP_AI, "diarize", job_id, cancelled=lambda: job_id in CANCELLED,
                        update=_queue_updater(job_id)) as ticket:
            if ticket is None:
                with LOCK:
                    t["state"] = "cancelled"
                return
            _diarize_body(job_id, req)
    finally:
        CANCELLED.discard(job_id)


def _diarize_body(job_id: str, req: dict) -> None:
    """AI Framing: who speaks at what second, within ONE clip. Deliberately
    limited to the clip range (not the whole video) -- diarization is
    roughly 1:1 with audio duration on CPU, and clips are only 30-45
    seconds, not tens of minutes."""
    t = JOBS[job_id]
    try:
        video = find_video(req["video"])
        if not video:
            raise FileNotFoundError(
                f"{req['video']} is not in a folder the server can reach.")
        start = float(req.get("start", 0))
        end = float(req.get("end", 0))
        if end <= start:
            raise ValueError("Invalid time range.")

        cache = Cache(CACHE_DIR)
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
