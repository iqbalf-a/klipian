"""Routes for the outside services of the local server: YouTube, rubrics, Claude, yt-dlp, voice, autopilot and the admin settings (a mixin of server.Handler).
"""
from __future__ import annotations

from urllib.parse import parse_qs, urlparse

from .server_json import read_json
from . import sched as _sched
from . import claude_api as _claude
from . import autopilot as _autopilot
from . import autopilot_deps as _autopilot_deps
from . import gemini_api as _gemini
from . import tts as _tts
from . import rubrics as _rubrics
from . import paths as _paths
from . import youtube as _youtube
from . import ytdl as _ytdl
from . import profiles as _profiles


class ServiceRoutes:
    """Methods of Handler (server.py), moved here; Handler inherits them."""

    def _youtube_reply(self, fn, *args):
        try:
            return self._send_json({"ok": True, **fn(*args)})
        except _youtube.YouTubeError as exc:
            return self._send_json({"error": exc.message, "code": exc.code, "ok": False,
                                    **{k: v for k, v in exc.extra.items() if k in ("detail", "report")}}, 400)
        except OSError as exc:
            return self._send_json({"error": f"could not do that: {exc}"}, 500)

    def _get_youtube_status(self):
        q = parse_qs(urlparse(self.path).query)
        return self._youtube_reply(_youtube.check if (q.get("check") or [""])[0] == "1" else _youtube.status)

    def _get_youtube_bulk_state(self):
        q = parse_qs(urlparse(self.path).query)
        return self._send_json(_youtube.bulk_state((q.get("id") or [""])[0]))

    def _get_youtube_upload_state(self):
        q = parse_qs(urlparse(self.path).query)
        return self._send_json(_youtube.upload_state((q.get("id") or [""])[0]))

    def _get_youtube_connect_state(self):
        q = parse_qs(urlparse(self.path).query)
        return self._send_json(_youtube.connect_state((q.get("id") or [""])[0]))

    # ---- rubrics per niche (rubrics.py) ----

    def _rubric_reply(self, fn):
        try:
            return self._send_json({"ok": True, **fn()})
        except _rubrics.RubricError as exc:
            return self._send_json({"ok": False, "error": str(exc)}, 400)

    def _get_rubrics(self):
        def listing():
            q = parse_qs(urlparse(self.path).query)
            data = _rubrics.list_all()
            want = (q.get("mode") or [""])[0] or _profiles.defaults().get("rubric") or _rubrics.DEFAULT
            try:
                used, _, note = _rubrics.load(want)
                data["current"] = {"wanted": want, "id": used, "note": note}
            except _rubrics.RubricError as exc:
                data["current"] = {"wanted": want, "id": None, "error": str(exc)}
            return data
        return self._rubric_reply(listing)

    @read_json
    def _post_rubrics(self, req):
        action = urlparse(self.path).path.rsplit("/", 1)[-1]
        if action == "create":
            return self._rubric_reply(lambda: _rubrics.create(req.get("template"), req.get("name")))
        if action == "delete":
            return self._rubric_reply(lambda: (_rubrics.delete(str(req.get("id") or "")), {})[1])
        if action == "open":
            return self._rubric_reply(lambda: (_rubrics.open_path(str(req["id"]) if req.get("id") else None), {})[1])
        return self._send_json({"error": "unknown action"}, 404)

    # ---- Find clips with Claude (claude_api.py; the key never leaves the server) ----

    def _claude_reply(self, fn):
        try:
            return self._send_json({"ok": True, **fn()})
        except _claude.ClaudeError as exc:
            return self._send_json({"ok": False, "error": exc.message, "code": exc.code,
                                    **({"command": exc.extra["command"]} if "command" in exc.extra else {})}, 400)
        except ValueError as exc:
            return self._send_json({"ok": False, "error": str(exc), "code": "not_ready"}, 400)

    def _get_claude_status(self):
        return self._send_json({"ok": True, **_claude.status()})

    def _get_claude_models(self):
        def models():
            found = _claude.list_models()
            return {"models": found, "newestOpus": _claude.newest_opus(found), "chosen": _claude.load_settings().get("model") or ""}
        return self._claude_reply(models)

    def _get_claude_usage(self):
        return self._send_json({"ok": True, **_claude.usage_summary()})

    def _get_claude_job(self):
        q = parse_qs(urlparse(self.path).query)
        return self._send_json(_claude.job_state((q.get("id") or [""])[0]))

    @read_json
    def _post_claude(self, req):
        action = urlparse(self.path).path.rsplit("/", 1)[-1]
        if action == "settings":
            if _paths.current_profile() == _paths.GUEST:
                return self._send_json({"error": "not available for the Guest profile"}, 403)

            def save():
                _claude.save_settings(api_key=req.get("apiKey") if isinstance(req.get("apiKey"), str) else None,
                                      remove_key=req.get("removeKey") is True,
                                      model=req.get("model") if isinstance(req.get("model"), str) else None,
                                      effort=req.get("effort") if isinstance(req.get("effort"), str) else None)
                return _claude.status()
            return self._claude_reply(save)
        if action == "test":
            return self._claude_reply(_claude.test_key)
        if action == "cancel":
            return self._send_json(_claude.cancel(str(req.get("id") or "")))
        from .server import _claude_parts, _import_reply   # in server.py (selftest and autopilot_deps use them there); a top import would be circular
        name = str(req.get("video") or "")
        count = req.get("count")
        count = count if isinstance(count, int) and 1 <= count <= 40 else 12
        mode = str(req.get("rubric") or "")
        if action == "plan":
            return self._claude_reply(lambda: _claude.plan_find(_claude_parts(name, mode), count))
        if action == "find":
            def start():
                parts = _claude_parts(name, mode)
                return {"id": _claude.start_find(parts, lambda text: _import_reply(name, text), video=name, count=count,
                                                 project=str(req.get("project") or "") or None)}
            return self._claude_reply(start)
        return self._send_json({"error": "unknown action"}, 404)

    # ---- Add from YouTube (ytdl.py; allowed for the Guest too) ----

    def _ytdl_reply(self, fn):
        try:
            return self._send_json({"ok": True, **fn()})
        except _ytdl.YtError as exc:
            return self._send_json({"ok": False, "error": exc.message, "code": exc.code, **exc.extra}, 400)
        except OSError as exc:
            return self._send_json({"ok": False, "error": f"could not do that: {exc}", "code": "other"}, 500)

    def _get_ytdl_status(self):
        return self._ytdl_reply(_ytdl.status)

    def _get_ytdl_state(self):
        q = parse_qs(urlparse(self.path).query)
        return self._send_json(_ytdl.state((q.get("id") or [""])[0]))

    @read_json
    def _post_ytdl(self, req):
        action = urlparse(self.path).path.rsplit("/", 1)[-1]
        if action == "preview":
            return self._ytdl_reply(lambda: _ytdl.preview(str(req.get("url") or ""), req.get("quality") or 1080))
        if action == "start":
            return self._ytdl_reply(lambda: _ytdl.start(str(req.get("url") or ""), req.get("quality") or 1080,
                                                        str(req["name"]) if req.get("name") else None,
                                                        req.get("section") or None))
        if action == "cancel":
            return self._ytdl_reply(lambda: _ytdl.cancel(str(req.get("id") or "")))
        if action == "update":
            return self._ytdl_reply(lambda: {"id": _ytdl.start_update()})
        return self._send_json({"error": "unknown action"}, 404)

    # ---- Motion videos (/remotion, motion.py): a topic -> a brief -> the AI's JSON -> the fact gate -> an MP4 in Clips ----

    @read_json
    def _post_youtube(self, req):
        action = urlparse(self.path).path.rsplit("/", 1)[-1]
        if action == "refresh-due":
            return self._youtube_reply(_youtube.refresh_due)
        if action == "sync-all":
            return self._youtube_reply(_youtube.sync_all)
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
        if action == "bulk-plan":
            return self._youtube_reply(lambda: _youtube.bulk_plan([str(i) for i in (req.get("ids") or [])], str(req.get("mode") or "schedule")))
        if action == "bulk-start":
            return self._youtube_reply(lambda: {"id": _youtube.start_bulk([str(i) for i in (req.get("ids") or [])], str(req.get("mode") or "schedule"))})
        if action == "bulk-cancel":
            return self._youtube_reply(lambda: _youtube.cancel_bulk(str(req.get("id") or "")))
        if action == "upload":
            return self._youtube_reply(lambda: {"id": _youtube.start_upload(str(req.get("row") or ""), bool(req.get("publishNow")))})
        if action == "upload-cancel":
            return self._youtube_reply(lambda: _youtube.cancel_upload(str(req.get("id") or "")))
        if action == "resend-thumbnail":
            return self._youtube_reply(lambda: _youtube.resend_thumbnail(str(req.get("row") or "")))
        if action == "video-status":
            return self._youtube_reply(lambda: _youtube.video_status(str(req.get("row") or "")))
        if action == "disconnect":
            return self._youtube_reply(_youtube.disconnect)
        return self._send_json({"error": "unknown endpoint"}, 404)

    def _get_machine(self):
        """Settings of THIS COMPUTER (not of a profile): how many renders may run at once."""
        return self._send_json({"renderJobs": _sched.render_limit(), "renderJobsMax": _sched.RENDER_JOBS_MAX})

    def _post_machine(self):
        try:
            req = self._read_json()
            return self._send_json({"ok": True, "renderJobs": _sched.set_render_limit(req.get("renderJobs")),
                                    "renderJobsMax": _sched.RENDER_JOBS_MAX})
        except ValueError as exc:
            return self._send_json({"error": str(exc)}, 400)
        except OSError as exc:
            return self._send_json({"error": f"could not save: {exc}"}, 500)

    def _get_tts(self):
        return self._send_json({"ok": True, **_tts.state()})

    def _post_tts(self):
        try:
            req = self._read_json()
            _tts.save(str(req.get("model") or ""), str(req.get("voice") or ""), str(req.get("style") or ""), req.get("noStyle") is True)
            return self._send_json({"ok": True, **_tts.state()})
        except ValueError as exc:
            return self._send_json({"error": str(exc)}, 400)
        except OSError as exc:
            return self._send_json({"error": f"could not save: {exc}"}, 500)

    def _post_tts_try(self):
        """One sample sentence in the saved voice: the WAV as base64 (a repeat of the same settings comes from the cache, no call to Google)."""
        import base64
        try:
            wav, secs = _tts.voice_for(_tts.SAMPLE)
            return self._send_json({"ok": True, "seconds": round(secs, 1), "audio": base64.b64encode(wav.read_bytes()).decode("ascii")})
        except _tts.TtsError as exc:
            return self._send_json({"error": str(exc)}, 400)

    # ---- Autopilot (autopilot.py; the page is /autopilot) ----

    def _autopilot_reply(self, fn):
        try:
            return self._send_json({"ok": True, **fn()})
        except _autopilot.RunError as exc:
            return self._send_json({"ok": False, "error": str(exc)}, 400)
        except (ValueError, OSError) as exc:
            return self._send_json({"ok": False, "error": str(exc)}, 400)

    def _get_autopilot_state(self):
        def state():
            claude = _claude.status()
            return {"settings": _autopilot.profile_settings(),
                    "templates": [{"id": t["id"], "name": t["name"], "summary": _autopilot.summary(t)} for t in _autopilot.list_templates()],
                    "ai": {"claudeReady": bool(claude["sdk"] and claude["hasKey"]), "geminiKey": _gemini.status()["hasKey"],
                           "geminiModel": _gemini.status()["model"]},
                    "runs": [_autopilot.public_run(r) for r in reversed(_autopilot.load_runs())],
                    "labels": _autopilot.STEP_LABELS, "steps": list(_autopilot.STEPS)}
        return self._autopilot_reply(state)

    def _get_autopilot_rerun_info(self):
        rid = (parse_qs(urlparse(self.path).query).get("id") or [""])[0]
        return self._autopilot_reply(lambda: _autopilot.rerun_info(rid, _autopilot_deps.RealDeps()))

    def _get_autopilot_brief(self):
        rid = (parse_qs(urlparse(self.path).query).get("id") or [""])[0]
        run = _autopilot.get_run(rid)
        if not run or not run.get("brief"):
            return self._send_json({"error": "This run has no brief to copy."}, 404)
        return self._send_text(run["brief"], "text/markdown")

    @read_json
    def _post_autopilot(self, req):
        action = urlparse(self.path).path.rsplit("/", 1)[-1]
        deps = _autopilot_deps.RealDeps()
        urls = [str(u).strip() for u in (req.get("urls") or []) if str(u).strip()]
        if action == "settings":
            def save():
                fields = {k: req[k] for k in ("ai", "template") if k in req}
                _profiles.update(_paths.current_profile(), fields)
                return {"settings": _autopilot.profile_settings()}
            return self._autopilot_reply(save)
        if action == "check":
            return self._autopilot_reply(lambda: _autopilot.check(urls, deps))
        if action == "start":
            return self._autopilot_reply(lambda: {"runs": _autopilot.start_runs(urls, deps)})
        rid = str(req.get("id") or "")
        if action == "retry":
            return self._autopilot_reply(lambda: {"run": _autopilot.retry(rid, deps)})
        if action == "cancel":
            return self._autopilot_reply(lambda: {"run": _autopilot.cancel(rid)})
        if action == "rerun":
            return self._autopilot_reply(lambda: {"run": _autopilot.rerun(rid, str(req.get("from") or ""), str(req.get("ai") or ""), deps)})
        if action == "clear":
            return self._autopilot_reply(lambda: {"removed": _autopilot.clear_finished()})
        if action == "reply":
            return self._autopilot_reply(lambda: {"run": _autopilot.reply(rid, str(req.get("text") or ""), deps)})
        return self._send_json({"error": "unknown action"}, 404)

    # ---- Admin settings (the Admin profile only: _set_profile refuses everyone else) ----

    def _admin_state(self):
        return {"ok": True, "templates": _autopilot.list_templates(), "gemini": _gemini.status(),
                "options": {"pictures": _autopilot.PICTURES, "backgrounds": _autopilot.BACKGROUNDS,
                            "introStyles": _autopilot.INTRO_STYLES, "qualities": _autopilot.QUALITIES}}

    def _gemini_reply(self, fn):
        try:
            return self._send_json({"ok": True, **fn()})
        except _gemini.GeminiError as exc:
            return self._send_json({"ok": False, "error": exc.message, "code": exc.code, **_gemini.status()}, 400)

    def _get_admin_settings(self):
        return self._send_json(self._admin_state())

    def _get_admin_models(self):
        return self._gemini_reply(lambda: {"models": _gemini.list_models()})

    @read_json
    def _post_admin(self, req):
        action = urlparse(self.path).path.rsplit("/", 1)[-1]
        if action == "test":
            return self._gemini_reply(lambda: {**_gemini.test_key(), "gemini": _gemini.status()})
        try:
            tid = str(req.get("template") or "")
            if action == "template":                         # create | duplicate | save | reset | delete
                what = req.get("action")
                if what == "create":
                    _autopilot.create_template(str(req.get("name") or ""))
                elif what == "duplicate":
                    _autopilot.create_template(str(req.get("name") or ""), copy_of=tid)
                elif what == "save":
                    _autopilot.save_template(tid, req.get("values") if isinstance(req.get("values"), dict) else {})
                elif what == "reset":
                    _autopilot.reset_template(tid)
                elif what == "delete":
                    _autopilot.delete_template(tid)
                else:
                    return self._send_json({"error": "unknown template action"}, 400)
                return self._send_json(self._admin_state())
            g = req.get("gemini") if isinstance(req.get("gemini"), dict) else {}
            if g:
                _gemini.save_settings(api_key=g.get("apiKey") if isinstance(g.get("apiKey"), str) else None,
                                      remove_key=g.get("removeKey") is True,
                                      model=g.get("model") if isinstance(g.get("model"), str) else None)
        except (ValueError, _profiles.ProfileError) as exc:
            return self._send_json({"error": str(exc)}, 400)
        except OSError as exc:
            return self._send_json({"error": f"could not save: {exc}"}, 500)
        return self._send_json(self._admin_state())
