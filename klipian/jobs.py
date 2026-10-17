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
from pathlib import Path

from .cache import Cache
from .models import Transcript
from . import compose as composer
from . import render as engine
from .paths import GLOSSARY, WORKSPACE, find_video
from .projects import (_find_project_by_video, _project_assets_dir, _project_file,
                       _project_out_dir, _read_project, write_render_record)

# Render jobs currently / already running
JOBS: dict[str, dict] = {}
LOCK = threading.Lock()
# video -> running transcribe job id, so there aren't two jobs for the
# same file: the first to finish deletes the temp wav the other is still using
ACTIVE_TRANSCRIBES: dict[str, str] = {}
MAX_JOBS = 100  # cap entries in JOBS to prevent memory leak
# Render job ids marked for cancellation. _run_render checks via
# cancel_check; render.py kills the running ffmpeg if listed.
CANCELLED: set[str] = set()


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
        cache = Cache(WORKSPACE / "cache")
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


def _run_render(job_id: str, req: dict, into: Path | None = None, record: bool = True) -> None:
    """Render a request. `into` sends the files to that folder instead of the
    project's own (a replay, the selftest); `record` is whether the finished
    render is remembered as the Result's last (see _record_render)."""
    t = JOBS[job_id]
    try:
        video = find_video(req["video"])
        if not video:
            raise FileNotFoundError(
                f"{req['video']} is not in a folder the server can reach. "
                f"Put the file in samples/.")

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
        out_dir = WORKSPACE / "out" / video.stem
        # By the project's id when the client sends it; by video for a
        # client from before ids, which is the same answer for any project
        # that has only ever held one video.
        pf = _project_file(req.get("project"))
        if not (pf and pf.is_file()):
            pf = _find_project_by_video(req["video"])
        pdata = _read_project(pf) if pf else None
        if pdata:
            out_dir = _project_out_dir(pdata)
        if into is not None:
            out_dir = into
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

            spans_raw = k.get("spans", [])
            if not spans_raw:
                raise ValueError(f"Clip \"{k.get('title', '?')}\" has no spans.")
            # A span can carry its own `video` (library projects, stage 1);
            # one that doesn't belongs to the job's one video, exactly as
            # every span has until now. Grouped into RUNS of contiguous
            # spans sharing a video -- see engine.asset_runs -- because a single
            # moment doesn't jump source mid-span.
            runs = engine.asset_runs(spans_raw, req["video"])

            crop = k.get("crop") or {}
            crop_box = engine.CropBox(
                left=crop.get("left", 37), top=crop.get("top", 4),
                width=crop.get("width", 26), height=crop.get("height", 92))
            layout = k.get("layout", "face")
            out_width = int(k.get("width", 1080))
            quality = int(k.get("quality", 21))
            # Caption style comes from the Caption screen in the UI. If not
            # sent, build_ass uses its defaults. One style for the whole
            # clip, single- or multi-asset alike -- it's a look, not a
            # property of any one source video.
            style = k.get("style") if isinstance(k.get("style"), dict) else None
            name = engine.safe_filename(k["title"], f"clip-{i+1}")
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
                                       layout=layout, out_width=out_width, quality=quality)
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
                                f"reach. Put the file in samples/.")
                        run_info = probe(run_video)
                        run_words = _run_words(k, run_video_name, req["video"],
                                               lambda: _load_transcript_words(run_video, t))
                        run_spans = _spans_from_clip({"spans": run_spans_raw})
                        run_job = engine.RenderJob(title=k["title"], spans=run_spans,
                                                   crop=crop_box, layout=layout,
                                                   out_width=out_width, quality=quality)
                        part_dest = tmp_dir / f"part{ridx}.mp4"
                        engine.render(run_video, run_job, part_dest, words=run_words,
                                     style=style, src_width=run_info.width,
                                     src_height=run_info.height, has_audio=run_info.has_audio,
                                     verbose=False, cancel_check=lambda: job_id in CANCELLED)
                        parts.append(part_dest)
                        duration += run_job.duration
                    if job_id in CANCELLED:
                        with LOCK:
                            t["state"] = "cancelled"
                        return
                    if len(parts) == 1:
                        parts[0].replace(dest)
                    else:
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
                    composer.compose(raw, dest, width=out_width, height=out_h - (out_h & 1),
                                     duration=duration, elements=elements, volumes=volumes,
                                     quality=quality, cancel_check=lambda: job_id in CANCELLED)
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

        if record and pdata:
            _record_render(job_id, req, pdata, out_dir)
        with LOCK:
            t["state"] = "done"

    except Exception as exc:                       # noqa: BLE001
        with LOCK:
            t["state"] = "failed"
            t["error"] = str(exc)
    finally:
        CANCELLED.discard(job_id)                  # don't leak to the next job id


def _out_url(out_dir: Path, name: str) -> str:
    """Where the page can fetch a render from; empty for a folder outside out/
    (a replay's temporary one)."""
    try:
        return f"/workspace/out/{out_dir.relative_to(WORKSPACE / 'out').as_posix()}/{name}"
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
        from .transcribe import DEFAULT_LANGUAGE, DEFAULT_MODEL, DEFAULT_THREADS, transcribe

        video = find_video(req["video"])
        if not video:
            raise FileNotFoundError(
                f"{req['video']} is not in samples/.")

        cache = Cache(WORKSPACE / "cache")

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
            found = cache.find_transcript(video, model, lang, gloss_path)
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
        video = find_video(req["video"])
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
