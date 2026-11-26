"""Motion routes of the local server (a mixin of server.Handler).
"""
from __future__ import annotations

from pathlib import Path
from urllib.parse import parse_qs, urlparse

from . import motion as _motion


class MotionRoutes:
    """Methods of Handler (server.py), moved here; Handler inherits them."""

    def _motion_reply(self, fn):
        try:
            return self._send_json({"ok": True, **fn()})
        except _motion.MotionError as exc:
            status = 409 if exc.code in ("gate", "busy") else 404 if exc.code == "not_found" else 400
            return self._send_json({"ok": False, "error": exc.message, "code": exc.code, **exc.extra}, status)
        except OSError as exc:
            return self._send_json({"ok": False, "error": f"could not do that: {exc}", "code": "other"}, 500)

    def _get_motion_projects(self):
        return self._motion_reply(lambda: {"projects": _motion.list_projects(), "status": _motion.status()})

    def _get_motion_project(self):
        q = parse_qs(urlparse(self.path).query)
        return self._motion_reply(lambda: {"project": _motion.detail((q.get("id") or [""])[0])})

    def _get_motion_status(self):
        q = parse_qs(urlparse(self.path).query)
        pid = (q.get("id") or [""])[0]
        return self._motion_reply(lambda: {"job": _motion.job_state(pid), "status": _motion.status(), **({"project": _motion.summary(_motion.load(pid))} if pid else {})})

    def _get_motion_brief(self):
        q = parse_qs(urlparse(self.path).query)
        pid, kind = (q.get("id") or [""])[0], (q.get("kind") or ["main"])[0]
        peek = bool((q.get("peek") or [""])[0])           # the page fetches the brief ahead (so the Copy click is instant): that is not the brief being copied

        def brief():
            p = _motion.load(pid)
            if kind == "revise":
                beats = [b for b in (q.get("beats") or [""])[0].split(",") if b]
                text = _motion.build_revise_brief(p, beats, (q.get("note") or [""])[0])
            elif kind == "main":
                text = _motion.build_brief(p)
            else:
                raise _motion.MotionError("kind", "kind: main or revise")
            _motion.note_brief(p['id']) if kind == 'main' and not peek else None
            reply = {"brief": text, "file": f"{p['id']}-{'revisi' if kind == 'revise' else 'brief'}.md"}
            if kind == "main":                                # the short -create command, and whether this checkout has the skill that runs it
                reply["short"] = _motion.short_command(p)
                reply["createSkill"] = (Path(__file__).resolve().parent.parent / ".claude" / "skills" / "create" / "SKILL.md").is_file()
            return reply
        return self._motion_reply(brief)

    def _get_motion_subtitles(self):
        q = parse_qs(urlparse(self.path).query)
        f = _motion.subtitles_file((q.get("id") or [""])[0], (q.get("format") or [""])[0])
        if f is None:
            return self._send_json({"error": "no subtitles yet: match the narration first"}, 404)
        fmt = (q.get("format") or ["srt"])[0]
        return self._send_file(f, "text/vtt; charset=utf-8" if fmt == "vtt" else "application/x-subrip; charset=utf-8")

    def _get_motion_narration(self):
        q = parse_qs(urlparse(self.path).query)
        return self._motion_reply(lambda: _motion.narration_for(((q.get("id") or [""])[0]), ((q.get("target") or ["voicestudio"])[0])))

    def _get_motion_preview_file(self):
        q = parse_qs(urlparse(self.path).query)
        try:
            f = _motion.preview_file((q.get("id") or [""])[0])
        except _motion.MotionError:
            f = None
        if f is None:
            return self._send_json({"error": "no preview yet"}, 404)
        return self._send_file(f, "video/mp4")

    def _get_motion_voice_file(self):
        q = parse_qs(urlparse(self.path).query)
        try:
            f = _motion.voice_file((q.get("id") or [""])[0])
        except _motion.MotionError:
            f = None
        if f is None:
            return self._send_json({"error": "no voice yet"}, 404)
        return self._send_file(f, "audio/wav")

    def _get_motion_still(self):
        q = parse_qs(urlparse(self.path).query)
        try:
            f = _motion.still_file((q.get("id") or [""])[0], (q.get("beat") or [""])[0])
        except _motion.MotionError:
            f = None
        if f is None:
            return self._send_json({"error": "no such picture"}, 404)
        return self._send_file(f, "image/png")

    def _post_motion_voice_upload(self):
        """The narration as a raw body: the video's id and the file name in the query (like the other uploads)."""
        q = parse_qs(urlparse(self.path).query)
        pid, name = (q.get("id") or [""])[0], Path((q.get("name") or ["narration.wav"])[0]).name
        try:
            n = int(self.headers.get("Content-Length", 0))
        except ValueError:
            n = 0
        if n <= 0 or n > _motion.MAX_VOICE_BYTES:
            return self._motion_reply(lambda: (_ for _ in ()).throw(_motion.MotionError("voice", "The narration must be 1 byte to 300 MB.")))
        data = bytearray()
        while len(data) < n:
            chunk = self.rfile.read(min(1 << 20, n - len(data)))
            if not chunk:
                break
            data += chunk
        return self._motion_reply(lambda: {"voice": _motion.import_voice(pid, data=bytes(data), name=name)})

    def _post_motion(self):
        action = urlparse(self.path).path.rsplit("/", 1)[-1]
        try:
            req = self._read_json()
        except Exception as exc:               # noqa: BLE001
            return self._send_json({"error": str(exc)}, 400)
        pid = str(req.get("id") or "")
        if action == "create":
            return self._motion_reply(lambda: {"project": _motion.summary(_motion.create(req.get("topic"), req.get("duration") or _motion.DEFAULT_DURATION, req.get("notes") or "", req.get("options")))})
        if action == "briefed":                                       # the person copied or downloaded the brief: the next step moves on
            return self._motion_reply(lambda: (_motion.note_brief(pid), {})[1])
        if action == "options":                                       # loop, the sting, the voice target, the music, the kind
            return self._motion_reply(lambda: _motion.set_options(pid, req.get("options") or {}))
        if action == "paste":
            return self._motion_reply(lambda: _motion.paste(pid, str(req.get("text") or ""), str(req.get("kind") or "main")))
        if action == "facts":
            return self._motion_reply(lambda: _motion.set_facts(pid, req))
        if action == "update":
            def upd():
                out = {}
                if isinstance(req.get("project"), dict):
                    out["project"] = _motion.summary(_motion.update_project(pid, req["project"]))
                if isinstance(req.get("edits"), dict):
                    out.update(_motion.update(pid, req["edits"]))
                return out
            return self._motion_reply(upd)
        if action == "preview":
            return self._motion_reply(lambda: {"job": _motion.preview(pid)})
        if action == "render":
            return self._motion_reply(lambda: {"job": _motion.render(pid)})
        if action == "cancel":
            return self._motion_reply(lambda: {"job": _motion.cancel(pid)})
        if action == "delete":
            return self._motion_reply(lambda: (_motion.delete_project(pid), {})[1])
        if action == "voice":                                         # the narration, from a file on this computer
            return self._motion_reply(lambda: {"voice": _motion.import_voice(pid, source=Path(str(req.get("path") or "").strip().strip('"')), name=str(req.get("name") or ""))})
        if action == "voice-align":
            return self._motion_reply(lambda: {"job": _motion.align_voice(pid)})
        if action == "voice-clear":
            return self._motion_reply(lambda: (_motion.clear_voice(pid), {})[1])
        if action == "voice-tts":
            return self._motion_reply(lambda: {"voice": _motion.make_voice_with_tts(pid)})
        if action == "voice-parts":                                   # several narration files, by their paths on this computer (ordered by their numbers)
            paths_list = [Path(str(x).strip().strip('"')) for x in (req.get("paths") or []) if str(x).strip()]
            return self._motion_reply(lambda: {"voice": _motion.import_voice_parts(pid, paths_list, float(req.get("gap") if req.get("gap") is not None else _motion.voicelib.GAP))})
        if action == "voice-part":                                    # one part of the series replaced by another file
            return self._motion_reply(lambda: {"voice": _motion.replace_voice_part(pid, int(req.get("no") or 0), Path(str(req.get("path") or "").strip().strip('"')))})
        if action == "voice-length":                                  # the length choice: continue at the narration's length, or edit the text
            return self._motion_reply(lambda: {"voice": _motion.choose_length(pid, str(req.get("choice") or ""))})
        if action == "take-folder":                                    # Khusus: the story.json of the folder the person chose (the only file read)
            return self._motion_reply(lambda: _motion.take_folder(pid, str(req.get("slug") or "")))
        if action == "preview-video":
            return self._motion_reply(lambda: {"job": _motion.preview_video(pid)})
        return self._send_json({"error": "unknown action"}, 404)
