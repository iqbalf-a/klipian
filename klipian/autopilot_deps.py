"""What an Autopilot run does in the real world: it calls the same code the pages use (ytdl, the transcribe job,
the project files, the Claude API, AI Framing, the render queue, the YouTube upload) and waits for each to finish.

autopilot.py knows the steps and never imports these; the tests give it a fake of the same shape.
Every method runs in the run's thread (a copy of the request's context, so the profile is the right one).
"""

from __future__ import annotations

import contextvars
import threading
import time
import uuid

from . import autopilot, claude_api, gemini_api, paths, renderreq, roundtrip, youtube, ytdl
from .autopilot import RunError


def _server():
    from . import server                      # late: server.py imports autopilot, and its helpers are what the pages use
    return server


def _poll(read, report, label: str, every: float = 1.0):
    """Call read() until it says it is over: it returns (finished, percent, text)."""
    while True:
        finished, percent, text = read()
        report(percent, text or label)
        if finished:
            return
        time.sleep(every)


class RealDeps:
    # ---- the link ----
    def video_id(self, url: str) -> str:
        try:
            return ytdl.video_id(url)
        except ytdl.YtError as exc:
            raise RunError(exc.message) from None

    def preview(self, url: str, quality) -> dict:
        try:
            return ytdl.preview(url, quality)
        except ytdl.YtError as exc:
            raise RunError(exc.message) from None

    # ---- download, transcribe, project ----
    def download(self, url: str, quality, report) -> str:
        try:
            started = ytdl.start(url, quality)
        except ytdl.YtError as exc:
            raise RunError(exc.message) from None
        if started.get("name"):
            return started["name"]
        jid = started["id"]
        box = {}

        def read():
            st = ytdl.state(jid)
            box.update(st)
            return st.get("state") not in ("queued", "running"), st.get("percent") or 0, st.get("message") or "Downloading"

        try:
            _poll(read, report, "Downloading")
        except BaseException:
            ytdl.cancel(jid)
            raise
        if box.get("state") != "done" or not box.get("name"):
            raise RunError(box.get("message") or "The download did not finish.")
        return box["name"]

    def transcribe(self, name: str, report) -> None:
        from . import jobs
        key = jobs.transcribe_key(name, False)
        job_id = uuid.uuid4().hex[:8]
        with jobs.LOCK:
            previous = jobs.ACTIVE_TRANSCRIBES.get(key)
            if previous and jobs.JOBS.get(previous, {}).get("state") in ("running", "queued"):
                job_id = previous                  # the same file is being transcribed already: wait for that one
            else:
                jobs.ACTIVE_TRANSCRIBES[key] = job_id
                jobs.JOBS[job_id] = {"state": "running", "key": key, "stage": "start", "percent": 0, "position": 0,
                                     "duration": 0, "file": None, "cached": False, "exact": False, "error": None}
                threading.Thread(target=contextvars.copy_context().run, args=(jobs._run_transcribe, job_id, {"video": name}),
                                 daemon=True).start()

        def read():
            with jobs.LOCK:
                t = dict(jobs.JOBS.get(job_id) or {"state": "failed", "error": "The transcription job is gone."})
            return t.get("state") not in ("running", "queued"), t.get("percent") or 0, "Transcribing" + (" (waiting for its turn)" if t.get("state") == "queued" else "")

        _poll(read, report, "Transcribing")
        with jobs.LOCK:
            t = dict(jobs.JOBS.get(job_id) or {})
        if t.get("state") != "done":
            raise RunError(t.get("error") or "The transcription did not finish.")

    def make_project(self, name: str, title: str, url: str) -> str:
        from .projects import PROJECTS, PROJECTS_LOCK, _migrate_project, _new_project_id, _write_project
        data = {"id": _new_project_id(), "video": name, "name": (title or name)[:80], "at": int(time.time()), "results": [],
                "youtube": {"url": url, "title": title}}
        data, _ = _migrate_project(data)
        PROJECTS.mkdir(parents=True, exist_ok=True)
        with PROJECTS_LOCK:
            _write_project(PROJECTS / f"{data['id']}.json", data)
        return data["id"]

    def read_project(self, pid: str) -> dict:
        from .projects import _project_file, _read_project
        f = _project_file(pid)
        data = _read_project(f) if f and f.is_file() else None
        if data is None:
            raise RunError("The project of this run is gone.")
        return data

    def write_project(self, pid: str, data: dict) -> None:
        from .projects import PROJECTS_LOCK, _migrate_project, _project_file, _write_project
        data["at"] = int(time.time())
        data, _ = _migrate_project(data)
        with PROJECTS_LOCK:
            _write_project(_project_file(pid), data)

    # ---- the AI ----
    def brief(self, name: str, most: int) -> str:
        srv = _server()
        transcript = srv._transcript_for(name)
        if transcript is None:
            raise RunError("No transcript for this video.")
        _, rubric, _ = srv._rubric_for("")
        from .cache import Cache
        from . import credits, cues as cues_mod, hashtags
        from .paths import CACHE_DIR
        cues_data = cues_mod.load(srv.find_video(name), Cache(CACHE_DIR))
        return roundtrip.build_brief(transcript, rubric, name, cues_data, credits.load().get(name),
                                     hashtags.brief_rule(srv._profiles.hashtag_settings()), at_most=most)

    def candidates_from_reply(self, name: str, text: str):
        return _server()._import_reply(name, text)

    def ask_claude(self, name: str, most: int, project: str, report):
        srv = _server()
        parts = srv._claude_parts(name, "", at_most=True)
        try:
            jid = claude_api.start_find(parts, lambda text: srv._import_reply(name, text), video=name, count=most, project=project)
        except claude_api.ClaudeError as exc:
            raise RunError(exc.message) from None
        box = {}

        def read():
            box.update(claude_api.job_state(jid))
            return box.get("state") != "running", None, box.get("message") or "Asking Claude"

        try:
            _poll(read, report, "Asking Claude", every=1.5)
        except BaseException:
            claude_api.cancel(jid)
            raise
        if box.get("state") != "done":
            raise RunError(box.get("message") or "Claude did not answer.")
        return box.get("candidates") or [], box.get("notes") or []

    # ---- framing, render, upload ----
    def ai_framing(self, project_id: str, result_id: str) -> None:
        """Boxes on the speaker, as the Framing screen's AI Framing button writes them (framing.js aiFramingStart)."""
        from . import facebox, jobs
        from .ffmpeg_tools import probe
        pdata = self.read_project(project_id)
        res = next((r for r in pdata.get("results") or [] if r.get("id") == result_id), None)
        if res is None:
            raise RunError("That Result is not in the project.")
        files = {a["id"]: a["file"] for a in pdata.get("assets") or [] if a.get("file")}
        picture = renderreq.output_options(res.get("output"))["picture"]
        points = []
        for seg in res.get("segments") or []:
            name = files.get(seg.get("asset") or "a1")
            video = _server().find_video(name or "")
            if not video:
                raise RunError(f"{name} is not in the sources.")
            info = probe(video)
            start, end = float(seg["start"]), float(seg["end"])
            box = renderreq.default_crop("single", picture, info.width / info.height)
            size = {"width": box["width"], "height": box["height"]}
            job_id = uuid.uuid4().hex[:8]
            jobs._register_job(job_id, {"state": "running", "turns": [], "error": None, "percent": 0, "stage": "start", "cached": False})
            jobs._run_diarize(job_id, {"video": name, "start": start, "end": end})
            turns = (jobs.JOBS.get(job_id) or {}).get("turns") or []        # no turns (no model, no speech): shot by shot
            found, _ = facebox.frame_segments(video, start, end, size, turns, lambda n, v=video, s=start, e=end: jobs.rediarize(v, s, e, n))
            points += [{"asset": seg.get("asset") or "a1", **p} for p in found]
        if not points:
            raise RunError("no frames could be read")
        framing = []
        for n, p in enumerate(sorted(points, key=lambda p: p["at"]), 1):
            framing.append({"id": f"f{n}", "asset": p["asset"], "at": p["at"], "format": "single", "crops": [p["crop"]]})
        res["framing"] = framing
        self.write_project(project_id, pdata)

    def render(self, project_id: str, ids: list[str], report) -> None:
        from . import jobs
        try:
            started = _server()._start_project_render(project_id, ids)
        except ValueError as exc:
            raise RunError(str(exc)) from None
        jid = started["id"]

        def read():
            with jobs.LOCK:
                t = dict(jobs.JOBS.get(jid) or {"state": "failed", "error": "The render job is gone."})
            total, done = max(1, t.get("total") or len(ids)), t.get("done") or 0
            return t.get("state") not in ("running", "queued"), 100 * done / total, f"Render {min(done + 1, total)} of {total}"

        try:
            _poll(read, report, "Rendering", every=1.5)
        except BaseException:
            jobs.cancel_job(jid)
            raise
        with jobs.LOCK:
            t = dict(jobs.JOBS.get(jid) or {})
        if t.get("state") == "cancelled":
            raise RunError("The render was cancelled.")
        if t.get("state") == "failed":
            raise RunError(t.get("error") or "The render failed.")

    def upload(self, row_ids: list[str], report) -> list[tuple[str, str]]:
        try:
            jid = youtube.start_bulk(row_ids, "schedule")
        except youtube.YouTubeError as exc:
            raise RunError(exc.message) from None
        box = {}

        def read():
            box.update(youtube.bulk_state(jid))
            rows = box.get("rows") or [{}]
            done = sum(1 for r in rows if r.get("state") == "done")
            return box.get("state") != "running", 100 * done / len(rows), f"Upload {min(done + 1, len(rows))} of {len(rows)}"

        _poll(read, report, "Uploading", every=2)
        failed = [(r.get("title") or r.get("id"), r.get("message") or box.get("note") or "not sent")
                  for r in box.get("rows") or [] if r.get("state") != "done"]
        return failed

    # ---- Check ----
    def youtube_checks(self) -> list[dict]:
        client = youtube.client_info()
        items = [{"key": "client", "ok": client["state"] == "valid", "label": "YouTube client",
                  "detail": "Installed" if client["state"] == "valid" else (client["reason"] or "Not installed"),
                  "fix": "" if client["state"] == "valid" else "Open the profile menu (top right) → Profile settings → YouTube, and choose the client_secret.json."}]
        if client["state"] != "valid":
            items.append({"key": "account", "ok": False, "label": "YouTube account", "detail": "Needs the YouTube client first.", "fix": ""})
            return items
        try:
            st = youtube.check()
        except youtube.YouTubeError as exc:
            st = {"state": "none", "message": exc.message}
        ok = st.get("state") == "ok"
        channel = (st.get("channel") or {}).get("title") or ""
        items.append({"key": "account", "ok": ok, "label": "YouTube account",
                      "detail": channel if ok else (st.get("message") or "Not connected."),
                      "fix": "" if ok else "Open the profile menu (top right) → Profile settings → YouTube, and connect the account."})
        return items

    def ai_check(self, mode: str) -> dict:
        if mode == "manual":
            return {"key": "ai", "ok": True, "label": "AI: Manual", "detail": "You paste the AI's reply when the run asks for it.", "fix": ""}
        if mode == "claude":
            st = claude_api.status()
            ok = st["sdk"] and st["hasKey"]
            return {"key": "ai", "ok": ok, "label": "AI: Claude API",
                    "detail": "Key set" if ok else ("The Anthropic SDK is not installed." if not st["sdk"] else "No Claude API key."),
                    "fix": "" if ok else "Add the key in the Find clips settings of the editor (Prepare screen), or choose Manual."}
        st = gemini_api.status()
        return {"key": "ai", "ok": False, "label": "AI: Gemini API",
                "detail": "Gemini runs come in the next step." + ("" if st["hasKey"] else " The Admin profile has no Gemini key yet."),
                "fix": "Choose Claude API or Manual for now."}
