"""Render-side routes of the local server: importing candidates, render and its plan, previews, transcription, diarization, ranges and the AI frame (a mixin of server.Handler).
"""
from __future__ import annotations

import contextvars
import importlib
import os
import subprocess
import sys
import threading
import time
import uuid
from pathlib import Path

from .cache import Cache
from .models import Transcript
from .server_json import read_json
from . import compose as composer
from . import render as engine
from .jobs import style_with_profile as _style_with_profile
from . import sched as _sched
from .jobs import cancel_job as _cancel_job, start_project_render as _start_project_render, transcribe_key as _transcribe_key
from .jobs import estimate_seconds as _estimate_seconds, plan_project_render as _plan_project_render
from .jobs import (ACTIVE_TRANSCRIBES, CANCELLED, JOBS, LOCK, MAX_JOBS, _clip_words,
                   _register_job, _run_diarize, _run_render, _run_transcribe,
                   _spans_from_clip)
from .paths import CACHE_DIR, ROOT, find_video
from .projects import _project_assets_dir, _project_file, _read_project


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


class RenderRoutes:
    """Methods of Handler (server.py), moved here; Handler inherits them."""

    def _post_import(self):
        """Claude's pasted reply -> clip candidates -- see roundtrip.parse_reply."""
        try:
            req = self._read_json()
            name = str(req.get("video") or "")
        except Exception as exc:               # noqa: BLE001
            return self._send_json({"error": str(exc)}, 400)
        # No transcript is not an error here: the cut points just aren't snapped. _import_reply reads it (once); a
        # transcript that cannot be read is answered the way it always was: a 400 with the message.
        from .server import _import_reply   # stays in server.py (autopilot_deps and the selftest use it there); a top import would be circular
        try:
            candidates, notes = _import_reply(name, str(req.get("text") or ""))
        except (ValueError, OSError, KeyError, TypeError) as exc:
            return self._send_json({"error": str(exc)}, 400)
        # `notes`: what was repaired in the JSON (a .replace(" ", "") or a trailing comma), to be said
        return self._send_json({"candidates": candidates, "notes": notes})

    @read_json
    def _post_render(self, req):
        if req.get("project") and isinstance(req.get("results"), list):
            # The Results of a SAVED project: the server builds each request itself (renderreq.py), so what is
            # rendered is what is saved. One job, one clip after another; see jobs.start_project_render.
            try:
                started = _start_project_render(str(req["project"]), [str(r) for r in req["results"]],
                                                cold={"coldOpen": req.get("coldOpen"), "coldVoice": req.get("coldVoice")})
            except ValueError as exc:
                return self._send_json({"error": str(exc)}, 400)
            return self._send_json(started)
        if not req.get("clips"):
            return self._send_json({"error": "no clips"}, 400)

        job_id = uuid.uuid4().hex[:8]
        _register_job(job_id, {"state": "running", "done": 0,
                           "total": len(req["clips"]), "index": 0,
                           "current": "", "result": [], "error": None})
        threading.Thread(target=contextvars.copy_context().run, args=(_run_render, job_id, req),
                         daemon=True).start()
        return self._send_json({"id": job_id})

    @read_json
    def _post_render_plan(self, req):
        """What a bulk render of these Results of a SAVED project would do, before it starts: the clips (title,
        length, picture), the ones that cannot be rendered and why, and a time estimate. Nothing is rendered."""
        pf = _project_file(str(req.get("project") or ""))
        pdata = _read_project(pf) if pf and pf.is_file() else None
        if not pdata:
            return self._send_json({"error": "That project is not saved yet."}, 400)
        ids = [str(r) for r in dict.fromkeys(req.get("results") or [])]
        items, refused = _plan_project_render(pdata, ids)
        seconds, how = _estimate_seconds([i["duration"] for i in items])
        return self._send_json({"items": [{k: v for k, v in i.items() if k != "request"} for i in items],
                                "refused": refused, "totalDuration": round(sum(i["duration"] for i in items), 1),
                                "estimateSeconds": seconds, "estimateHow": how})

    @read_json
    def _post_render_cancel(self, req):
        job_id = str(req.get("id") or "")
        item = req.get("item")
        if JOBS.get(job_id, {}).get("batch"):
            # A batch of Results: all of it, or one clip (`item` = its index)
            return self._send_json({"ok": _cancel_job(job_id, item if isinstance(item, int) else None)})
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
            running = JOBS.get(job_id, {}).get("state") in ("running", "queued")
            if running:
                CANCELLED.add(job_id)
        _sched.poke()                          # a job waiting for its turn leaves the queue now
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

    @read_json
    def _post_transcribe(self, req):
        name = req.get("video", "")
        key = _transcribe_key(str(name), bool(req.get("ranges")))               # the FILE (size + mtime), not its name: see jobs.transcribe_key
        # Entire check-then-register in one lock so no two threads both
        # slip through and create duplicate jobs, and so the JOBS insert
        # doesn't race with the prune that iterates JOBS.
        with LOCK:
            if len(JOBS) > MAX_JOBS:
                old = [k for k, v in JOBS.items()
                       if v.get("state") in ("done", "failed")]
                for k in old[:len(old) // 2]:
                    JOBS.pop(k, None)
            previous = ACTIVE_TRANSCRIBES.get(key)
            if previous and JOBS.get(previous, {}).get("state") in ("running", "queued"):
                return self._send_json({"id": previous, "already_running": True})
            job_id = uuid.uuid4().hex[:8]
            ACTIVE_TRANSCRIBES[key] = job_id
            JOBS[job_id] = {"state": "running", "key": key, "stage": "start", "percent": 0,
                            "position": 0, "duration": 0, "file": None,
                            "cached": False, "exact": False, "error": None}
        threading.Thread(target=contextvars.copy_context().run, args=(_run_transcribe, job_id, req),
                         daemon=True).start()
        return self._send_json({"id": job_id})

    @read_json
    def _post_diarize(self, req):
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

    def _post_aiframe(self):
        """AI Framing's boxes for one span: {video, start, end, size, turns: [{start, end, speaker}]} -> {points:
        [{at, crop, why}]}. One request at a time per span (the client waits for each), see facebox.frame_segments."""
        try:
            req = self._read_json()
            video = find_video(req.get("video", ""))
            if not video:
                return self._send_json({"error": "video not found"}, 404)
            start, end = float(req.get("start", 0)), float(req.get("end", 0))
            turns = [{"start": float(t["start"]), "end": float(t["end"]), "speaker": t.get("speaker")}
                     for t in (req.get("turns") or [])]
        except Exception as exc:               # noqa: BLE001
            return self._send_json({"error": str(exc)}, 400)
        if end <= start:
            return self._send_json({"error": "invalid range"}, 400)
        try:
            from . import facebox
            from .jobs import rediarize
            points, info = facebox.frame_segments(video, start, end, req.get("size") or {}, turns,
                                                  lambda n: rediarize(video, start, end, n))
        except Exception as exc:               # noqa: BLE001
            return self._send_json({"error": str(exc)}, 500)
        return self._send_json({"points": points, "info": info})
