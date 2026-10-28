"""Motion videos (P28-B): a fun-fact video from a typed topic, with no API key.

The flow is one brief and one answer (docs/roadmap.md, P28):
  topic + length  ->  build_brief()  ->  you paste it into Claude or ChatGPT  ->  paste() the JSON back
  ->  stills per beat, the fact gate (every claim and its sources checked by a person), a title
  ->  render()  ->  an MP4 and a row in Clips (fileFolder "motion"), ready for the upload of P16.

Where things live: profiles/<id>/motion/<project>/ holds project.json (topic, length, notes, status, the chosen
title), story.json (the last valid answer; earlier versions in history/), facts.json (every claim: checked or
rejected, with the date) and out/ (the stills and the MP4). Work is per active profile, like the rest of klipian.

One source of truth: the catalogue of what a video can contain and the rules a story must obey live in remotion/
(src/catalog.ts, src/schema.ts). Python runs two small Node scripts and copies nothing:
    node remotion/catalog-export.mjs      the catalogue as JSON (it goes into the brief)
    node remotion/validate.mjs story.json {ok} or {ok: false, errors: [{path, message}]}
and renders with node remotion/render.mjs <job.json> (mode "stills" for the sheet, mode "video" for the MP4).
Every call that touches Node goes through `_node`, so the selftest can swap it.
"""

from __future__ import annotations

import contextvars
import datetime
import hashlib
import json
import os
import re
import shutil
import subprocess
import threading
import time
import uuid
from pathlib import Path

from . import hashtags as hashtags_mod, motion_voice as voicelib, paths, profiles, roundtrip, sched, schedule
from .progress import Eta

REMOTION = paths.ROOT / "remotion"
DURATIONS = (30, 45, 60)
DEFAULT_DURATION = 45
RENDER_RATIO = 1.7              # seconds of rendering per second of video on a usual machine, for the first ETA (measured: 1.6)
STILL_AT = 0.85                 # the sheet shows each beat 85 % of the way through it, where its things have arrived
HISTORY_KEEP = 20
_ID = re.compile(r"^[a-z0-9][a-z0-9-]{2,62}$")
_LOCK = threading.RLock()


class MotionError(Exception):
    """An error with a code the UI can switch on and a sentence for the person."""

    def __init__(self, code: str, message: str, **extra):
        super().__init__(message)
        self.code, self.message, self.extra = code, message, extra


# --------------------------------------------------------------------------
# the one place that runs Node (replaced in the selftest when a test needs it)
# --------------------------------------------------------------------------

class _Node:
    def exe(self) -> str | None:
        return shutil.which("node")

    def ready(self) -> tuple[bool, str]:
        if not self.exe():
            return False, "Node.js was not found. klipian needs it to build the video (https://nodejs.org)."
        if not (REMOTION / "node_modules" / "remotion").is_dir():
            return False, f'The video project is not installed: run "npm install" in {REMOTION}.'
        return True, ""

    def json(self, script: str, *args: str, timeout: int = 60) -> dict:
        ok, why = self.ready()
        if not ok:
            raise MotionError("missing", why)
        try:
            proc = subprocess.run([self.exe(), str(REMOTION / script), *args], cwd=str(REMOTION), capture_output=True,
                                  text=True, encoding="utf-8", errors="replace", timeout=timeout)
        except subprocess.TimeoutExpired:
            raise MotionError("node", f"{script} took too long.") from None
        try:
            return json.loads(proc.stdout)
        except ValueError:
            tail = (proc.stderr or proc.stdout or "").strip().splitlines()[-1:] or ["no output"]
            raise MotionError("node", f"{script} failed: {tail[0][:300]}") from None

    def popen(self, job_file: Path, log: Path) -> subprocess.Popen:
        """render.mjs with a job file. Its stdout is read line by line (JSON); a line "cancel" on its stdin stops it
        (a SIGTERM does not reach a Node child on Windows). stderr goes to a log file, so nothing blocks on a full pipe."""
        err = open(log, "wb")
        try:
            return subprocess.Popen([self.exe(), str(REMOTION / "render.mjs"), str(job_file)], cwd=str(REMOTION),
                                    stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=err, text=True,
                                    encoding="utf-8", errors="replace", bufsize=1)
        finally:
            err.close()


_node = _Node()


def _video_dirs() -> list[Path]:
    root = REMOTION / "videos"
    return sorted(d for d in root.iterdir() if d.is_dir() and (d / "index.tsx").is_file()) if root.is_dir() else []


def compositions() -> list[dict]:
    """The custom compositions of remotion/videos/<slug>/ that klipian offers (the ones whose meta.json does not hide them), each {slug, title}."""
    out = []
    for d in _video_dirs():
        meta = _read(d / "meta.json", {})
        meta = meta if isinstance(meta, dict) else {}
        if not meta.get("hidden"):
            out.append({"slug": d.name, "title": str(meta.get("title") or d.name), "description": str(meta.get("description") or "")})
    return out


def composition_id(p: dict) -> str:
    """The Remotion composition a project renders with: the template (FunFact), or video-<slug> for a custom composition."""
    slug = p.get("composition") or ""
    return f"video-{slug}" if slug else "FunFact"


def status() -> dict:
    ok, why = _node.ready()
    return {"installed": ok, "message": why, "durations": list(DURATIONS), "defaultDuration": DEFAULT_DURATION, "compositions": compositions() if ok else []}


# --------------------------------------------------------------------------
# projects
# --------------------------------------------------------------------------

def motion_dir() -> Path:
    return Path(paths.profile_dir()) / "motion"


def project_dir(pid: str) -> Path:
    if not _ID.match(str(pid or "")):
        raise MotionError("not_found", "That video does not exist.")
    return motion_dir() / pid


def _read(path: Path, default):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return default


def _write(path: Path, data) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    tmp.replace(path)


def _slug(text: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", str(text).lower().encode("ascii", "ignore").decode()).strip("-")
    return s[:40].strip("-") or "video"


def load(pid: str) -> dict:
    p = _read(project_dir(pid) / "project.json", None)
    if not isinstance(p, dict):
        raise MotionError("not_found", "That video does not exist.")
    return p


def save(p: dict) -> dict:
    p["updated"] = int(time.time())
    _write(project_dir(p["id"]) / "project.json", p)
    return p


def story_of(pid: str) -> dict | None:
    s = _read(project_dir(pid) / "story.json", None)
    return s if isinstance(s, dict) else None


def facts_of(pid: str) -> list[dict]:
    f = _read(project_dir(pid) / "facts.json", {})
    return f.get("claims", []) if isinstance(f, dict) else []


def create(topic: str, duration=DEFAULT_DURATION, notes: str = "") -> dict:
    topic = " ".join(str(topic or "").split())
    if len(topic) < 3:
        raise MotionError("topic", "Write the topic first, for example: fakta seru tentang colokan listrik panas.")
    if len(topic) > 200:
        raise MotionError("topic", "The topic is too long: at most 200 characters.")
    try:
        duration = int(duration)
    except (TypeError, ValueError):
        duration = 0
    if duration not in DURATIONS:
        raise MotionError("duration", f"The length must be one of {', '.join(map(str, DURATIONS))} seconds.")
    pid = f"{_slug(topic)}-{uuid.uuid4().hex[:4]}"
    now = int(time.time())
    p = {"id": pid, "topic": topic, "duration": duration, "notes": str(notes or "").strip()[:2000], "status": "draft",
         "title": "", "created": now, "updated": now, "needs": [], "render": None, "composition": ""}
    with _LOCK:
        project_dir(pid).mkdir(parents=True, exist_ok=True)
        save(p)
    return p


def update_project(pid: str, fields: dict) -> dict:
    """Edit the topic, length and notes (only before there is a story: the length is the story's total)."""
    with _LOCK:
        p = load(pid)
        if "topic" in fields:
            t = " ".join(str(fields["topic"] or "").split())
            if len(t) < 3:
                raise MotionError("topic", "Write the topic first.")
            p["topic"] = t[:200]
        if "notes" in fields:
            p["notes"] = str(fields["notes"] or "").strip()[:2000]
        if "composition" in fields:
            slug = str(fields["composition"] or "")
            if slug and slug not in {d.name for d in _video_dirs()}:
                raise MotionError("composition", f'There is no custom composition "{slug}" in remotion/videos/.')
            p["composition"] = slug
        if "duration" in fields:
            try:
                d = int(fields["duration"])
            except (TypeError, ValueError):
                d = 0
            if d not in DURATIONS:
                raise MotionError("duration", f"The length must be one of {', '.join(map(str, DURATIONS))} seconds.")
            if story_of(pid) is not None and d != p["duration"]:
                raise MotionError("duration", "The length cannot change once there is a story: make a new video.")
            p["duration"] = d
        return save(p)


def delete_project(pid: str) -> None:
    d = project_dir(pid)
    if is_busy(pid):
        raise MotionError("busy", "This video is being rendered: cancel it first.")
    if d.is_dir():
        shutil.rmtree(d, ignore_errors=True)


def summary(p: dict) -> dict:
    story = story_of(p["id"])
    facts = facts_of(p["id"]) if story else []
    return {"id": p["id"], "topic": p["topic"], "duration": p["duration"], "status": p.get("status", "draft"), "title": p.get("title", ""), "composition": p.get("composition", ""),
            "updated": p.get("updated"), "created": p.get("created"), "hasStory": story is not None,
            "claims": len(facts), "unchecked": sum(1 for f in facts if f.get("status") != "checked"),
            "rowId": (p.get("render") or {}).get("rowId")}


def list_projects() -> list[dict]:
    out = []
    root = motion_dir()
    if root.is_dir():
        for d in root.iterdir():
            p = _read(d / "project.json", None) if d.is_dir() else None
            if isinstance(p, dict) and p.get("id") == d.name:
                out.append(summary(p))
    return sorted(out, key=lambda x: x.get("updated") or 0, reverse=True)


def detail(pid: str) -> dict:
    """Everything the page needs about one video."""
    p = load(pid)
    story = story_of(pid)
    facts = facts_of(pid) if story else []
    stills = _stills_state(pid, story)
    return {**summary(p), "notes": p.get("notes", ""), "needs": p.get("needs", []), "warnings": (validate_story(story).get("warnings", []) if story else []), "storyPath": str(project_dir(pid) / "story.json"), "compositions": compositions(), "story": story, "facts": facts,
            "gate": gate(pid), "stills": stills, "render": p.get("render"), "job": job_state(pid), "voice": voice_info(pid),
            "versions": len(list((project_dir(pid) / "history").glob("story-*.json"))) if (project_dir(pid) / "history").is_dir() else 0}


# --------------------------------------------------------------------------
# the story: validate, save with history, edit
# --------------------------------------------------------------------------

def validate_story(story) -> dict:
    """{"ok": True, ...} or {"ok": False, "errors": [{"path", "message"}]}, by the zod schema in remotion/ (never by rules copied here)."""
    tmp = motion_dir() / ".tmp"
    tmp.mkdir(parents=True, exist_ok=True)
    f = tmp / f"validate-{uuid.uuid4().hex[:8]}.json"
    try:
        f.write_text(json.dumps(story, ensure_ascii=False), encoding="utf-8")
        return _node.json("validate.mjs", str(f))
    finally:
        f.unlink(missing_ok=True)


def _check_for(p: dict, story: dict) -> list[dict]:
    """The checks that belong to THIS video and not to the schema: it must be as long as asked, and its title must fit."""
    errors = []
    d = story.get("duration")
    if isinstance(d, (int, float)) and abs(d - p["duration"]) > 1.5:
        errors.append({"path": "duration", "message": f"this video is {p['duration']} seconds, but the story lasts {d} seconds"})
    return errors


def _save_story(pid: str, story: dict) -> None:
    d = project_dir(pid)
    cur = d / "story.json"
    if cur.is_file():
        hist = d / "history"
        hist.mkdir(exist_ok=True)
        n = len(list(hist.glob("story-*.json"))) + 1
        shutil.copyfile(cur, hist / f"story-{n:03d}.json")
        for old in sorted(hist.glob("story-*.json"))[:-HISTORY_KEEP]:
            old.unlink(missing_ok=True)
    _write(cur, story)


def _reconcile_facts(pid: str, story: dict) -> list[dict]:
    """The fact list of a story: a claim whose text is the same as before keeps its check (and the date), a new or changed one is pending."""
    before = {f.get("text"): f for f in facts_of(pid)}
    out = []
    for c in story.get("claims", []):
        old = before.get(c["text"])
        out.append({"text": c["text"], "beats": c["beats"], "sources": c["sources"],
                    "status": old.get("status", "pending") if old else "pending", "date": old.get("date", "") if old else "",
                    "note": old.get("note", "") if old else ""})
    _write(project_dir(pid) / "facts.json", {"claims": out})
    return out


def _accept(pid: str, story: dict) -> dict:
    p = load(pid)
    _save_story(pid, story)
    _reconcile_facts(pid, story)
    p["needs"] = [str(n) for n in story.get("needs", [])]
    if p.get("title") and p["title"] not in story.get("titles", []):
        p["title"] = ""                                     # a title that is not among the new ones must be chosen again
    p["status"] = "story"
    save(p)
    return p


def paste(pid: str, text: str, kind: str = "main", beats=None) -> dict:
    """The AI's answer: repaired when it is a common slip, validated, then saved ({ok, story, notes}) or answered with a
    message to paste back ({ok: false, errors, fix}). kind "revise": the answer holds only the replaced beats (and the claims)."""
    with _LOCK:
        p = load(pid)
        notes: list[str] = []
        try:
            data = roundtrip.extract_json(str(text or ""), notes)
        except ValueError as exc:
            errors = [{"path": "", "message": str(exc)}]
            return {"ok": False, "errors": errors, "fix": build_fix_message(errors, kind)}
        story = data
        if kind == "revise":
            story = _merge_revision(pid, data)
            if isinstance(story, list):                         # errors
                return {"ok": False, "errors": story, "fix": build_fix_message(story, kind)}
        v = validate_story(story)
        errors = list(v.get("errors", [])) if not v.get("ok") else []
        errors += _check_for(p, story) if isinstance(story, dict) else []
        if errors:
            return {"ok": False, "errors": errors, "fix": build_fix_message(errors, kind)}
        _accept(pid, story)
        return {"ok": True, "notes": notes, "story": story, "needs": story.get("needs", [])}


def _merge_revision(pid: str, data: dict):
    """The current story with the beats of `data["beats"]` swapped in (by id) and, when given, its claims, title choices and post."""
    story = story_of(pid)
    if story is None:
        return [{"path": "", "message": "there is no story to revise yet: paste the first answer first"}]
    if not isinstance(data.get("beats"), list) or not data["beats"]:
        return [{"path": "beats", "message": 'the answer must be a JSON object with "beats" (the replaced beats) and "claims"'}]
    ids = [b.get("id") for b in story["beats"]]
    merged = json.loads(json.dumps(story))
    errors = []
    for i, nb in enumerate(data["beats"]):
        bid = nb.get("id") if isinstance(nb, dict) else None
        if bid not in ids:
            errors.append({"path": f"beats.{i}.id", "message": f'"{bid}" is not a beat of this video (beats: {", ".join(ids)})'})
            continue
        merged["beats"][ids.index(bid)] = nb
    if errors:
        return errors
    for key in ("claims", "titles", "post", "question", "needs"):
        if key in data:
            merged[key] = data[key]
    return merged


def _edit(story: dict, edits: dict) -> dict:
    """The story with the edits applied: {"beats": {id: {"narration", "text", "items": {index: {"text", "lines"}}}}, "question", "post"}."""
    s = json.loads(json.dumps(story))
    for bid, e in (edits.get("beats") or {}).items():
        beat = next((b for b in s["beats"] if b["id"] == bid), None)
        if beat is None:
            raise MotionError("beat", f'There is no beat "{bid}".')
        for key in ("narration", "text"):
            if key in e:
                beat[key] = str(e[key])
        for idx, fields in (e.get("items") or {}).items():
            try:
                item = beat["scene"]["items"][int(idx)]
            except (ValueError, IndexError):
                raise MotionError("item", f"Beat {bid} has no item {idx}.") from None
            for key in ("text", "lines"):
                if key in fields:
                    if key == "text" and "text" not in item:
                        raise MotionError("item", f"A {item.get('type')} has no text.")
                    item[key] = fields[key]
    if isinstance(edits.get("question"), str):
        s["question"] = edits["question"]
    if isinstance(edits.get("post"), dict):
        s["post"] = {**s["post"], **{k: v for k, v in edits["post"].items() if k in ("description", "hashtags")}}
    return s


def update(pid: str, edits: dict) -> dict:
    """Edit narration and screen text from the page, then validate again: saved only when it is still a valid story."""
    with _LOCK:
        p = load(pid)
        story = story_of(pid)
        if story is None:
            raise MotionError("no_story", "There is no story yet.")
        new = _edit(story, edits if isinstance(edits, dict) else {})
        v = validate_story(new)
        errors = list(v.get("errors", [])) if not v.get("ok") else []
        errors += _check_for(p, new)
        if errors:
            return {"ok": False, "errors": errors, "fix": build_fix_message(errors, "main")}
        if new == story:
            return {"ok": True, "story": story, "changed": False}
        _accept(pid, new)
        return {"ok": True, "story": new, "changed": True}


# --------------------------------------------------------------------------
# the voice: a narration file per video (recorded, or made by a local TTS command), aligned to the words, and a story that follows it
# --------------------------------------------------------------------------

AUDIO_EXTS = {".wav", ".mp3", ".m4a", ".aac", ".ogg", ".opus", ".flac", ".mp4", ".webm", ".mkv"}
MAX_VOICE_BYTES = 300 * 1024 * 1024


class _Whisper:
    """The one place that runs the recogniser (faster-whisper, local); the selftest replaces it with a fake. Returns [{text, start, end}] in order."""

    def words(self, audio: Path) -> list[dict]:
        from . import transcribe
        t = transcribe.transcribe(audio, language="id", verbose=False)
        return [{"text": w.text, "start": w.start, "end": w.end} for w in t.words]


_whisper = _Whisper()


def voice_dir(pid: str) -> Path:
    return project_dir(pid) / "voice"


def voice_file(pid: str) -> Path | None:
    f = voice_dir(pid) / "narration.wav"
    return f if f.is_file() else None


def _voice_meta(pid: str) -> dict | None:
    v = _read(voice_dir(pid) / "voice.json", None)
    return v if isinstance(v, dict) else None


def import_voice(pid: str, *, source: Path | None = None, data: bytes | None = None, name: str = "") -> dict:
    """Takes the narration: a file on this computer (`source`) or uploaded bytes (`data`), keeps the original, and makes narration.wav (48 kHz mono)
    next to it, which is what is rendered. A new voice clears the old alignment."""
    from .ffmpeg_tools import _require, probe, run
    p = load(pid)
    name = Path(name or (source.name if source else "narration.wav")).name
    ext = Path(name).suffix.lower()
    if ext not in AUDIO_EXTS:
        raise MotionError("voice", f"A narration is an audio file ({', '.join(sorted(AUDIO_EXTS))}), not {ext or 'a file without an extension'}.")
    if source is not None:
        if not source.is_file():
            raise MotionError("voice", "That file was not found.")
        if source.stat().st_size > MAX_VOICE_BYTES:
            raise MotionError("voice", "That file is too big for a narration.")
    elif not data:
        raise MotionError("voice", "No file was sent.")
    with _LOCK:
        d = voice_dir(pid)
        shutil.rmtree(d, ignore_errors=True)
        d.mkdir(parents=True, exist_ok=True)
        original = d / f"original{ext}"
        if source is not None:
            shutil.copyfile(source, original)
        else:
            original.write_bytes(data)
        out = d / "narration.wav"
        try:
            run([_require("ffmpeg"), "-y", "-v", "error", "-i", str(original), "-vn", "-ac", "1", "-ar", "48000", "-c:a", "pcm_s16le", str(out)], desc="converting the narration", timeout=600)
            seconds = probe(out).duration
        except Exception as exc:                                  # noqa: BLE001
            shutil.rmtree(d, ignore_errors=True)
            raise MotionError("voice", f"That audio could not be read ({str(exc).strip().splitlines()[-1][:160] if str(exc).strip() else type(exc).__name__}).") from None
        if seconds < 1.0 or seconds > 180:
            shutil.rmtree(d, ignore_errors=True)
            raise MotionError("voice", f"The narration is {seconds:.1f} seconds: it must be between 1 and 180.")
        (project_dir(pid) / "story.voiced.json").unlink(missing_ok=True)
        p["voice"] = {"name": name, "duration": round(seconds, 2), "at": int(time.time()), "aligned": False}
        save(p)
    return p["voice"]


def clear_voice(pid: str) -> None:
    with _LOCK:
        p = load(pid)
        shutil.rmtree(voice_dir(pid), ignore_errors=True)
        (project_dir(pid) / "story.voiced.json").unlink(missing_ok=True)
        p.pop("voice", None)
        save(p)


def tts_available() -> str:
    return voicelib.tts_command(paths.workspace_dir() / "machine.json")


def make_voice_with_tts(pid: str) -> dict:
    """Runs the person's local text-to-speech command (machine.json "motionTts") on the story's narration and takes its WAV as the voice."""
    cmd = tts_available()
    if not cmd:
        raise MotionError("tts", 'No text-to-speech command is set. Put one in workspace/machine.json as "motionTts", e.g. mytts --in "{text}" --out "{out}".')
    story = story_of(pid)
    if story is None:
        raise MotionError("no_story", "There is no story yet.")
    text = "\n\n".join(b["narration"] for b in story["beats"])
    out = voice_dir(pid).parent / ".tts-out.wav"
    out.unlink(missing_ok=True)
    try:
        voicelib.run_tts(cmd, text, out)
    except (RuntimeError, OSError, subprocess.TimeoutExpired) as exc:
        raise MotionError("tts", str(exc) if isinstance(exc, RuntimeError) else f"the text-to-speech command could not run ({exc})") from None
    try:
        return import_voice(pid, source=out, name="tts.wav")
    finally:
        out.unlink(missing_ok=True)


def render_story(pid: str) -> dict | None:
    """The story that is drawn and rendered: the voiced one (beats as long as their narration, with word times) when there is a voice that was aligned to
    THIS story, else the story as the AI wrote it."""
    story = story_of(pid)
    if story is None:
        return None
    voiced = _read(project_dir(pid) / "story.voiced.json", None)
    meta = _voice_meta(pid)
    if isinstance(voiced, dict) and meta and meta.get("storyHash") == _story_hash(story) and voice_file(pid):
        return voiced
    return story


def story_file(pid: str) -> Path:
    story = story_of(pid)
    voiced = project_dir(pid) / "story.voiced.json"
    meta = _voice_meta(pid)
    if story is not None and voiced.is_file() and meta and meta.get("storyHash") == _story_hash(story) and voice_file(pid):
        return voiced
    return project_dir(pid) / "story.json"


def voice_info(pid: str) -> dict | None:
    """What the page shows about the voice: the file, whether it is aligned to the current story, the total and how it compares with the video's length."""
    p = load(pid)
    v = p.get("voice")
    if not v or not voice_file(pid):
        return {"tts": bool(tts_available())} if story_of(pid) else None
    story = story_of(pid)
    meta = _voice_meta(pid) or {}
    aligned = bool(story and meta.get("storyHash") == _story_hash(story) and (project_dir(pid) / "story.voiced.json").is_file())
    timed = render_story(pid) if aligned else None
    total = timed["duration"] if timed else v["duration"]
    return {"name": v["name"], "duration": v["duration"], "aligned": aligned, "stale": bool(meta) and not aligned, "method": meta.get("method"), "ratio": meta.get("ratio"),
            "total": total, "target": p["duration"], "tts": bool(tts_available()),
            "note": (f"The narration makes the video {total:.1f} s; it was planned for {p['duration']} s." if abs(total - p["duration"]) > 0.5 else "")}


def align_voice(pid: str) -> dict:
    """The alignment as a job in the AI queue (the recogniser is heavy): word times -> story.voiced.json."""
    if voice_file(pid) is None:
        raise MotionError("voice", "Import the narration first.")
    if story_of(pid) is None:
        raise MotionError("no_story", "There is no story yet: paste the AI's answer first.")
    return _start(pid, "voice", _run_voice)


def _run_voice(pid: str, key, ev: threading.Event) -> None:
    try:
        story = story_of(pid)
        audio = voice_file(pid)
        total = float(load(pid)["voice"]["duration"])
        with sched.slot(sched.GROUP_AI, "transcribe", f"motion-voice-{pid}", cancelled=ev.is_set, update=_waiting(key)) as ticket:
            if ticket is None or ev.is_set():
                return _finish(key, pid, state="cancelled", message="Dibatalkan.", percent=0)
            _set(key, state="running", message="Mencocokkan kata dengan suara…", percent=20)
            note = ""
            try:
                heard = _whisper.words(audio)
                al = voicelib.align(story["beats"], heard, total)
                if al["method"] == "estimate":
                    note = f"Suara tidak cocok dengan naskah (hanya {int(al['ratio'] * 100)}% kata): waktu kata diperkirakan merata."
            except Exception as exc:                                  # noqa: BLE001
                al = voicelib.estimate(story["beats"], total)
                note = f"Pengenal suara tidak bisa dipakai ({type(exc).__name__}): waktu kata diperkirakan merata."
        timed = voicelib.timed_story(story, al, total)
        v = validate_story(timed)
        if not v.get("ok"):
            msgs = "; ".join(f"{e['path']}: {e['message']}" for e in v.get("errors", [])[:3])
            raise MotionError("voice", f"The story does not fit the narration: {msgs}")
        _write(project_dir(pid) / "story.voiced.json", timed)
        _write(voice_dir(pid) / "voice.json", {"storyHash": _story_hash(story), "method": al["method"], "ratio": al.get("ratio"), "total": total, "alignment": al, "at": int(time.time())})
        p = load(pid)
        p["voice"] = {**p["voice"], "aligned": True}
        save(p)
        _finish(key, pid, state="done", percent=100, message=note or f"Selesai: video {timed['duration']:.1f} detik mengikuti narasi.", note=note)
    except MotionError as exc:
        _finish(key, pid, state="failed", message=exc.message, code=exc.code)
    except BaseException as exc:                              # noqa: BLE001
        _finish(key, pid, state="failed", message=f"The alignment failed ({type(exc).__name__}: {exc}).", code="other")


# --------------------------------------------------------------------------
# facts, the title and the gate
# --------------------------------------------------------------------------

def set_facts(pid: str, req: dict) -> dict:
    """{"claims": [{"index", "status": "checked"|"rejected"|"pending", "note"}], "title": "<one of the three titles>"}."""
    with _LOCK:
        p = load(pid)
        story = story_of(pid)
        if story is None:
            raise MotionError("no_story", "There is no story yet.")
        facts = facts_of(pid)
        today = datetime.date.today().isoformat()
        for c in req.get("claims") or []:
            try:
                f = facts[int(c["index"])]
            except (KeyError, ValueError, IndexError, TypeError):
                raise MotionError("claim", "That claim does not exist.") from None
            st = c.get("status", f.get("status"))
            if st not in ("checked", "rejected", "pending"):
                raise MotionError("claim", 'A claim is "checked", "rejected" or "pending".')
            if st != f.get("status"):
                f["status"], f["date"] = st, (today if st != "pending" else "")
            if "note" in c:
                f["note"] = str(c["note"] or "")[:500]
        _write(project_dir(pid) / "facts.json", {"claims": facts})
        if "title" in req:
            t = " ".join(str(req["title"] or "").split())
            if t and t not in story["titles"]:
                raise MotionError("title", "Choose one of the three titles.")
            p["title"] = t
        save(p)                                             # the gate reads the title from disk
        if p["status"] in ("story", "checked") and not gate(pid):
            p["status"] = "checked"
        elif p["status"] == "checked":
            p["status"] = "story"
        save(p)
        return {"facts": facts, "title": p["title"], "gate": gate(pid)}


def gate(pid: str) -> list[str]:
    """What stops a render, as sentences (empty: it may render). The server enforces this, not only the page."""
    story = story_of(pid)
    if story is None:
        return ["There is no story yet: paste the AI's answer first."]
    out = []
    facts = facts_of(pid)
    for i, f in enumerate(facts, 1):
        if f.get("status") == "rejected":
            out.append(f"Claim {i} was rejected: ask for a revision of its beats.")
        elif f.get("status") != "checked":
            out.append(f"Claim {i} is not checked yet.")
    p = load(pid)
    if not p.get("title"):
        out.append("Choose a title.")
    else:
        warn = hashtags_mod.title_warning(p["title"], (story.get("post") or {}).get("hashtags"), profiles.hashtag_settings())
        if warn:
            out.append(warn)
    return out


# --------------------------------------------------------------------------
# the briefs
# --------------------------------------------------------------------------

# What a video of each length is made of: (beat kind, seconds, what happens). The sum is the length. This is the channel's format
# (hook, "Intip yuk!", explanation, tips, outro), not a rule of the schema: the AI may adapt it as long as the total is exact.
STRUCTURE = {
    30: [("hook", 3, "an everyday hook: a question, a surprising statement or a myth"), ("sting", 1, 'a small mascot and the pill "Intip yuk!"'), ("lens or normal", 7, "step 1 of the cause (look inside through the lens only if the cause is inside the object)"),
         ("normal", 7, "step 2"), ("tips", 8, "what to do"), ("outro", 4, "loop-back: no mascot, no label, no voice; the scene of the first beat again")],
    45: [("hook", 3, "an everyday hook: a question, a surprising statement or a myth"), ("sting", 1, 'a small mascot and the pill "Intip yuk!"'), ("lens or normal", 6, "step 1 (the cutaway through the lens, if the cause is inside)"),
         ("normal", 7, "step 2"), ("loose / normal", 8, "step 3, or the bad case"), ("result", 7, "what happens in the end"), ("tips", 9, "2 tips"),
         ("outro", 4, "loop-back: no mascot, no label, no voice; the scene of the first beat again")],
    60: [("hook", 3, "an everyday hook: a question, a surprising statement or a myth"), ("sting", 1, 'a small mascot and the pill "Intip yuk!"'), ("lens or normal", 6, "step 1"), ("normal", 8, "step 2"), ("normal", 8, "step 3"),
         ("loose / normal", 8, "step 4, or the bad case"), ("result", 7, "what happens in the end"), ("normal", 6, "a fact that surprises"), ("tips", 9, "2-3 tips"),
         ("outro", 4, "loop-back: no mascot, no label, no voice; the scene of the first beat again")],
}


def _catalog() -> dict:
    return _node.json("catalog-export.mjs")


def _items_text(cat: dict) -> str:
    rows = [f"- **{t}**: " + ", ".join(f"`{k}: {v}`" for k, v in fields.items()) for t, fields in cat["items"].items()]
    motion = ", ".join(f"`{k}: {v}`" for k, v in cat["motionFields"].items())
    return "\n".join(rows) + f"\n\nEvery item also takes (all optional): {motion}"


def _catalog_text(cat: dict) -> str:
    e, ch, lim, mo = cat["enums"], cat["characters"], cat["limits"], cat["motion"]
    fmt = cat["format"]
    sa = lim["safeArea"]
    story = "\n".join(f"- `{k}`: {v}" for k, v in cat["story"]["fields"].items())
    beat = "\n".join(f"- `{k}`: {v}" for k, v in cat["story"]["beat"].items())
    return f"""## Catalogue: the only things a video can contain

Use only what is listed here. If the story needs an object that is not in this catalogue, **do not invent it**: write what
is missing in `needs` and use the closest listed thing meanwhile.

**Canvas:** {fmt['width']} x {fmt['height']} px, {fmt['fps']} fps, {fmt['unit']}. Keep text, the mascot and people inside x {sa['left']}..{sa['right']},
y {sa['top']}..{sa['bottom']} ({sa['note']}).

**The story** (`beats` are listed below; `item` is one of the items):
{story}

**A beat:**
{beat}

**Items** (`type` picks which; the fields after it belong to that type; `?` = optional):
{_items_text(cat)}

**Characters:** one person (`chibi`): roles {', '.join(ch['roles'])}; expressions {', '.join(ch['expressions'])}; poses {', '.join(ch['poses'])}; costumes {', '.join(ch['costumes'])}.
**The mascot** (the yellow bubble with the magnifying glass, no body): expressions {', '.join(cat['mascot']['expressions'])}.
**Backgrounds:** {', '.join(e['backgrounds'])} (`brand` = story scenes with a yellow spotlight; `lab` = the dark room inside the lens and for cutaways; `room`, `black` = plain).
**Beat kinds:** {', '.join(e['beatKinds'])}.
**Sockets:** views {', '.join(e['socketViews'])}; outside variants {', '.join(e['outsideVariants'])}; cutaway variants {', '.join(e['cutawayVariants'])}; `heat` 0..1 glows red at the contact; `plug.route` is a list of 2-6 [x, y] points the cable follows (it is drawn as a smooth curve).
**Parts a label or arrow can follow** (`follow`): {', '.join(e['anchors'])}. Label colours: {', '.join(e['labelColors'])}; arrow colours: {', '.join(e['arrowColors'])}.
**Motion words:** enter {', '.join(mo['enter'])}; exit {', '.join(mo['exit'])}; directions {', '.join(mo['directions'])}; actions {', '.join(mo['actions'])}; camera {', '.join(mo['camera'])}; transitions {', '.join(mo['transitions'])}. {mo['notes']}
**Sound effects:** {', '.join(cat['sfx']['names'])}, or "none". {cat['sfx']['note']}.

**Rules the answer is checked against** (klipian refuses anything else and sends you a list of what to fix):
""" + "\n".join(f"- {r}" for r in cat["rules"]) + f"""
- at most {lim['maxScreenWords']} words of screen text per piece of text; at most {lim['maxTransitions']} transitions other than a cut; {lim['beats']['min']}-{lim['beats']['max']} beats; at most {lim['itemsPerBeat']['max']} items per beat; narration at most {lim['narrationMaxChars']} characters per beat
"""


def _structure_text(duration: int) -> str:
    rows = STRUCTURE[min(STRUCTURE, key=lambda k: abs(k - duration))]          # the three lengths; anything else gets the nearest plan
    lines = [f"{i}. **{kind}** about {sec} s: {what}" for i, (kind, sec, what) in enumerate(rows, 1)]
    return "\n".join(lines) + f"\n\n(total {sum(r[1] for r in rows)} s, {len(rows)} beats)"


CHANNEL_RULES = """- Language: casual Indonesian that is easy to follow, as if talking to a friend. Narration is what a person would say aloud; screen text is short.
- Screen text: at most 6 words per piece (the validator counts). The screen shows the key point, the narration says the rest.
- The "look inside" (the cutaway through the magnifying lens) happens **at most once** per video and only when the cause is really inside an object. If it is not (for example a circuit breaker that trips because two heaters run together), use a meter or a diagram instead, no cutaway.
- Colour code: yellow = electric current, red/orange = heat or danger, grey = the object's material, light grey = metal. Red only for meaning, never decoration.
- Format: an everyday hook of about 3 seconds that makes people curious (a question such as "Kenapa ...?" or "Benarkah ...?", a surprising statement or a myth; it does not have to start with "kenapa"), then the "Intip yuk!" sting, the explanation in 2-3 steps, tips, and a loop-back ending.
- Two musts in every video: the small "Intip yuk!" sting right after the hook, and the loop (the ending returns to the scene of the first beat). Everything else in the format is a default a topic may adapt.
- No health or finance topics (if the topic is one, say so in `needs` and give the safest everyday framing, or none). Never teach anything dangerous: no instructions to open, modify or bypass mains electrical equipment, and tips are always "stop using it / unplug it / ask a technician".
- One idea per beat; every beat's narration should make sense heard alone."""

FACT_RULES = """- Every claim the video makes needs at least one source URL (a manufacturer, a safety agency, a standard, a university or a reputable reference). Search the web; do not rely on memory.
- If you are not sure about something, **leave it out**. A smaller true video is better than a bigger doubtful one.
- A claim is one checkable sentence. List each in `claims` with the ids of the beats that use it. A beat can use several claims; a claim can be used in several beats.
- Numbers (watts, degrees, amounts) must come from a source you list; otherwise do not state a number.
- A person will check every claim and its sources before the video is rendered, and any claim they reject comes back to you for a revision of the beats that use it."""


COMPOSITION = """- Every beat has a `banner` at the top that carries the beat's screen text (the same words as the beat's `text`).
- The main object is big: about 60-70% of the screen width, near the middle (x about 540), with supporting elements around it so the screen is not empty: its parts, arrows, short labels, numbered badges and movement. Empty space is filled by the object and its parts, never by characters.
- Backgrounds: `brand` for the story beats (including the hook); `lab` only for what is inside the lens and for cutaway beats.
- The "Intip yuk!" beat: a small `mascot` (w about 220, expression curious, `pop`) and a small `pill` that says "Intip yuk!" in the caption zone, with no veil; the picture behind it keeps moving.
- **One hero:** choose one main object or scene for the whole video; the other things on screen are simple supporting elements.
- **Kinds of fact:** an object is opened up (the lens); a process follows its flow around the scene; a cause is a chain of cause-and-effect arrows; a myth check ends with the verdict in the text of the `result` or `tips` beat: `MITOS`, `FAKTA` or `SEBAGIAN` (the verdict stamp is not drawn yet, so it is text only).
- **People are optional.** Put a person (`chibi`) in a beat only when the story needs one: someone doing something, a body part, or a person's reaction is the point. A topic about an object shows just the object.
- **The mascot is rare:** the "Intip yuk!" beat, plus at most 2 short reactions (about 1 s each, with `enter` delay and `exit`) at key moments in between. **The outro has no mascot.** Never park it in a corner for the whole video; `persist` is only for the sting.
- **The outro is a loop-back:** no mascot, no label, no pill, no voice (its narration is empty), 2 to 4 seconds; its scene is the same as the first beat's scene, so the video loops.
- **Source cards:** a `source` item shows one of your claims on the screen (its text or a short `quote`, the organisation, the date and the domain of its first source): place one for 2-3 seconds next to the object when the fact is stated, with `claim` = the claim's number (1 is the first). Use them sparingly: they are for the one or two facts that need to be seen.
- **Two text layers** (optional, for a video with a narration): a `headline` of 2-4 bold words with a small `kicker` above it (it replaces the banner of that beat), and `"captions": true` on the story for the karaoke captions; klipian fills in the word times from the narration. `music` (`{"track": "bed-calm"}`) adds a quiet bed under the voice.
- The look inside: first the outside of the object with the lens beside it (the `lens` item), then cutaway beats with `socket` view "cutaway" (about x 540, y 926, s 1). Give the cutaway an `id` and make labels and arrows `follow` its parts.
- The example below shows real coordinates for all of this; use similar ones."""


def _example_text(cat: dict) -> str:
    return json.dumps(cat["example"], ensure_ascii=False, indent=1)


def build_brief(p: dict) -> str:
    """The one self-contained file you give to an AI: task, structure for the length, channel and fact rules, the catalogue,
    this profile's title and hashtag rules, the answer format with an example, and `needs`."""
    cat = _catalog()
    d = p["duration"]
    notes = f"\n\n**Notes from the person making the video:** {p['notes']}" if p.get("notes") else ""
    rule = hashtags_mod.brief_rule(profiles.hashtag_settings())
    return f"""# Fun-fact motion video: {p['topic']}

Hello. You will plan one short vertical animated explainer video (a YouTube Short of about {d} seconds) for the channel
"klipian intip". klipian renders it from JSON with a fixed template, so you do not write code: you fill in a JSON story
using only the catalogue below.

**Topic:** {p['topic']}{notes}

## Your task

1. Turn the topic into **one everyday hook** of about 3 seconds that makes people curious: a question (for example "Kenapa ...?" or "Benarkah ...?"), a surprising statement or a myth. It does not have to start with "kenapa". The "Intip yuk!" sting comes right after it, and the video ends with a loop.
2. Find out the facts with a web search and write the explanation as beats (a narration line and a short screen text for each).
3. Choose what is on screen in every beat, from the catalogue.
4. Give 3 title options, a description and hashtags for the post.
5. List every factual claim with its source URLs and the beats that use it.

## Structure for {d} seconds

{_structure_text(d)}

Adapt the kinds and seconds to the topic if you need to, but **the beats must add up to exactly {d} seconds** and keep a hook first and an outro last.
Give each beat 2-4 moments of movement (things entering one after another, a highlight, a camera push or pan); a transition between
some beats (at most 3); the first beat has none.

## Channel rules

{CHANNEL_RULES}

## Composition

{COMPOSITION}

## Fact rules

{FACT_RULES}

{_catalog_text(cat)}
## Title, description and hashtags

Give three title options in `titles` (each at most 100 characters). Put the post description in `post.description` (it can mention what
the video explains; no hashtags in it) and the hashtags in `post.hashtags`. klipian adds the source links itself, so do not put URLs in the description.
**Hashtags for this profile:** {rule}

## Answer format

Reply with **a single JSON block**, no explanation outside it. Plain JSON only: no code, expressions, comments, trailing commas or
variables; every value is finished text or a number. The block is one story with these fields:

- `bible`: 1 (this story follows the channel's musts, so klipian checks them strictly); `question`: the hook (a question or a surprising statement, about 3 seconds); `titles`: exactly 3; `duration`: {d}; `beats`: the beats; `claims`: the claims with `text`, `beats` (ids) and `sources` (URLs);
  `post`: `description` and `hashtags`; `needs`: a list of objects or effects the story would need that the catalogue does not have (empty when there are none).
- each beat: `id` (lowercase, hyphens), `kind`, `dur`, `narration`, `text` (the screen text of the beat, at most 6 words), `scene` (`bg`, `items`), `sfx` (a short note on the sound for a human), and optionally `camera` and `transition`.

An example of a short story (3 beats, 12 s) to show the shape. Yours is {d} s with the structure above; do not copy its content:

```json
{_example_text(cat)}
```

If anything here is unclear, make the safest choice and continue; do not ask questions. klipian checks your JSON against the catalogue
and, if something is wrong, gives you the exact list to fix.
"""


def build_revise_brief(p: dict, beat_ids: list[str], note: str = "") -> str:
    """For rejected claims: only the beats that use them go back to the AI, with what was rejected and why."""
    story = story_of(p["id"])
    if story is None:
        raise MotionError("no_story", "There is no story to revise yet.")
    known = [b["id"] for b in story["beats"]]
    beat_ids = [b for b in dict.fromkeys(beat_ids or []) if b in known]
    facts = facts_of(p["id"])
    rejected = [(i, f) for i, f in enumerate(facts, 1) if f.get("status") == "rejected"]
    if not beat_ids:                                        # by default: the beats that use a rejected claim
        beat_ids = [b for b in known if any(b in f["beats"] for _, f in rejected)]
    if not beat_ids:
        raise MotionError("nothing", "Reject a claim first (or choose the beats to revise).")
    cat = _catalog()
    parts = [b for b in story["beats"] if b["id"] in beat_ids]
    bad = "\n".join(f"- Claim {i}: {f['text']}\n  Sources given: {', '.join(f['sources'])}" + (f"\n  Why it was rejected: {f['note']}" if f.get("note") else "") for i, f in rejected) \
        or "- (no claim was rejected: the person chose these beats to revise)"
    keep = "\n".join(f"- Claim {i}: {f['text']} [{f.get('status', 'pending')}]" for i, f in enumerate(facts, 1))
    note_text = f"\n**Note from the person:** {note.strip()}\n" if str(note or "").strip() else ""
    return f"""# Revise some beats: {p['topic']}

Hello. A fun-fact motion video for the channel "klipian intip" was planned from your JSON, and a person checked its facts.
Some claims were **rejected**. Please revise **only the beats listed below**; every other beat stays as it is.
{note_text}
## What was rejected

{bad}

## All claims now (the ones marked [checked] stay true: do not change them)

{keep}

## The beats to revise (current JSON)

```json
{json.dumps(parts, ensure_ascii=False, indent=1)}
```

## What to do

- Search the web again. Replace what was rejected with something you can back with a source URL; if you cannot, **leave it out** and
  make the beat about something that is certain.
- Keep each beat's `id` and `dur` the same (the video must keep its {p['duration']} seconds), and the same channel rules and catalogue as before.
- Keep the two musts: the "Intip yuk!" sting right after the hook, and the loop-back ending (no mascot, label, pill or voice in the outro).
- Give the **complete list of claims** again in `claims` (the checked ones unchanged, the revised ones with sources), with the beats that use them.

## Reply format

Reply with **a single JSON block** and nothing else, plain JSON only:

```json
{{
  "beats": [ ...only the revised beats, each complete, with the same id and dur... ],
  "claims": [ {{ "text": "...", "beats": ["beat-id"], "sources": ["https://..."] }} ]
}}
```

{_catalog_text(cat)}"""


def build_fix_message(errors: list[dict], kind: str = "main") -> str:
    """What to paste back to the AI when its answer was not accepted: every problem with where it is."""
    lines = []
    for e in errors:
        where = f"`{e['path']}`: " if e.get("path") else ""
        lines.append(f"- {where}{e['message']}")
    what = ("only the replaced beats and the full claims list, as before" if kind == "revise" else "the whole JSON story")
    return ("klipian could not accept your answer. These are the problems, with where each one is:\n\n"
            + "\n".join(lines)
            + f"\n\nPlease fix them and reply with {what} again: a single JSON block, plain JSON only (no code, comments or trailing commas), "
              "and nothing outside the block. Change only what is needed; keep everything else exactly as it was.")


# --------------------------------------------------------------------------
# the stills sheet and the render: jobs through the scheduler
# --------------------------------------------------------------------------

_JOBS: dict[tuple[str, str], dict] = {}
_CANCEL: dict[tuple[str, str], threading.Event] = {}
_PROCS: dict[tuple[str, str], subprocess.Popen] = {}
_JLOCK = threading.Lock()


def _key(pid: str) -> tuple[str, str]:
    return (paths.current_profile(), pid)


def is_busy(pid: str) -> bool:
    with _JLOCK:
        j = _JOBS.get(_key(pid))
        return bool(j and j.get("state") in ("queued", "running"))


def job_state(pid: str) -> dict:
    with _JLOCK:
        j = _JOBS.get(_key(pid))
        return dict(j) if j else {"state": "idle"}


def _set(key, **fields) -> None:
    with _JLOCK:
        if key in _JOBS:
            _JOBS[key].update(fields)


def _story_hash(story) -> str:
    return hashlib.sha1(json.dumps(story, sort_keys=True, ensure_ascii=False).encode("utf-8")).hexdigest()[:12]


def _stills_state(pid: str, story) -> dict:
    story = render_story(pid) if story is not None else None
    meta = _read(project_dir(pid) / "out" / "stills.json", None)
    if not story or not isinstance(meta, dict):
        return {"files": {}, "stale": bool(story)}
    folder = project_dir(pid) / "out" / "stills"
    files = {b: f"/api/motion/still?id={pid}&beat={b}&v={meta.get('hash')}" for b in meta.get("beats", []) if (folder / f"{b}.png").is_file()}
    return {"files": files, "stale": meta.get("hash") != _story_hash({"story": story, "composition": (_read(project_dir(pid) / "project.json", {}) or {}).get("composition", "")}), "at": meta.get("at")}


def still_file(pid: str, beat: str) -> Path | None:
    if not re.fullmatch(r"[a-z0-9-]{1,24}", beat or ""):
        return None
    f = project_dir(pid) / "out" / "stills" / f"{beat}.png"
    return f if f.is_file() else None


def _start(pid: str, kind: str, runner) -> dict:
    key = _key(pid)
    ok, why = _node.ready()
    if not ok:
        raise MotionError("missing", why)
    with _JLOCK:
        j = _JOBS.get(key)
        if j and j.get("state") in ("queued", "running"):
            raise MotionError("busy", "This video already has a job running." + (" Cancel it first." if j.get("kind") == "render" else ""))
        ev = threading.Event()
        _JOBS[key] = {"state": "queued", "kind": kind, "percent": 0, "eta": None, "stage": "", "message": "Menunggu…", "profile": key[0],
                      "id": pid, "started": int(time.time())}
        _CANCEL[key] = ev
    threading.Thread(target=contextvars.copy_context().run, args=(runner, pid, key, ev), daemon=True).start()
    return job_state(pid)


def preview(pid: str) -> dict:
    """One still per beat (a storyboard sheet), as a light job in the render queue."""
    if story_of(pid) is None:
        raise MotionError("no_story", "There is no story yet: paste the AI's answer first.")
    return _start(pid, "preview", _run_preview)


def render(pid: str) -> dict:
    """The MP4, through the same queue as clip renders. Refused while the fact gate is not passed."""
    problems = gate(pid)
    if problems:
        raise MotionError("gate", "Not yet: " + " ".join(problems), problems=problems)
    return _start(pid, "render", _run_render)


def cancel(pid: str) -> dict:
    key = _key(pid)
    with _JLOCK:
        ev, proc = _CANCEL.get(key), _PROCS.get(key)
        j = _JOBS.get(key)
        if not j or j.get("state") not in ("queued", "running"):
            return job_state(pid)
    if ev:
        ev.set()
    _set(key, message="Membatalkan…")
    if proc is not None and proc.poll() is None:
        try:
            proc.stdin.write("cancel\n")                      # a SIGTERM does not reach a Node child on Windows
            proc.stdin.flush()
        except (OSError, ValueError):
            pass
    sched.poke()
    return job_state(pid)


def _waiting(key):
    def update(info):
        _set(key, message=(info or {}).get("text") or "Memulai…", **({"state": "queued"} if info else {}))
    return update


def _read_lines(proc: subprocess.Popen, on_line) -> None:
    for line in proc.stdout:
        line = line.strip()
        if line.startswith("{"):
            try:
                on_line(json.loads(line))
            except ValueError:
                pass


def _run_job(pid: str, key, ev: threading.Event, kind_label: str, job: dict, on_line) -> dict | None:
    """Wait for a render slot, run render.mjs with `job`, feed its JSON lines to `on_line`. Returns the final "done" line, or
    None when cancelled. Raises MotionError when it failed."""
    pdir = project_dir(pid)
    (pdir / "out").mkdir(parents=True, exist_ok=True)
    job_file = pdir / "out" / "job.json"
    _write(job_file, job)
    with sched.slot(sched.GROUP_RENDER, "motion", f"motion-{pid}", cancelled=ev.is_set, update=_waiting(key)) as ticket:
        if ticket is None or ev.is_set():
            return None
        _set(key, state="running", message=kind_label)
        proc = _node.popen(job_file, pdir / "out" / "render.log")
        with _JLOCK:
            _PROCS[key] = proc
        final: dict = {}
        err = {"message": ""}

        def line(d: dict) -> None:
            if d.get("type") == "error":
                err["message"] = d.get("message") or "the render failed"
                err["cancelled"] = bool(d.get("cancelled"))
            elif d.get("type") == "done":
                final.update(d)
            on_line(d)

        reader = threading.Thread(target=_read_lines, args=(proc, line), daemon=True)
        reader.start()
        try:
            while proc.poll() is None:
                if ev.is_set():
                    try:
                        proc.stdin.write("cancel\n")
                        proc.stdin.flush()
                    except (OSError, ValueError):
                        pass
                    try:
                        proc.wait(timeout=15)
                    except subprocess.TimeoutExpired:
                        proc.kill()
                    break
                try:
                    proc.wait(timeout=0.3)
                except subprocess.TimeoutExpired:
                    pass
            reader.join(timeout=5)
        finally:
            with _JLOCK:
                _PROCS.pop(key, None)
            if proc.poll() is None:
                proc.kill()
        if ev.is_set() or err.get("cancelled"):
            return None
        if proc.returncode != 0 or not final:
            log = (pdir / "out" / "render.log")
            tail = ""
            try:
                tail = log.read_text(encoding="utf-8", errors="replace").strip().splitlines()[-1][:300]
            except (OSError, IndexError):
                pass
            raise MotionError("render", err["message"] or tail or f"the render stopped (exit code {proc.returncode})")
        return final


def _finish(key, pid: str, **fields) -> None:
    _set(key, **fields)
    with _JLOCK:
        _CANCEL.pop(key, None)


def _run_preview(pid: str, key, ev: threading.Event) -> None:
    try:
        story = render_story(pid)
        folder = project_dir(pid) / "out" / "stills"
        if folder.is_dir():
            shutil.rmtree(folder, ignore_errors=True)
        job = {"mode": "stills", "story": str(story_file(pid)), "out": "stills", "outRoot": str(project_dir(pid) / "out"), "at": STILL_AT, "composition": composition_id(load(pid))}

        def on_line(d):
            if d.get("type") == "progress" and d.get("stage") == "render":
                _set(key, percent=min(99, int(d.get("pct") or 0)), stage=d.get("beat", ""))

        done = _run_job(pid, key, ev, "Menggambar storyboard…", job, on_line)
        if done is None:
            return _finish(key, pid, state="cancelled", message="Dibatalkan.", percent=0)
        _write(project_dir(pid) / "out" / "stills.json", {"hash": _story_hash({"story": story, "composition": load(pid).get("composition", "")}), "beats": [b["id"] for b in story["beats"]], "at": int(time.time())})
        _finish(key, pid, state="done", percent=100, message="Storyboard siap.", ms=done.get("ms"))
    except MotionError as exc:
        _finish(key, pid, state="failed", message=exc.message, code=exc.code)
    except BaseException as exc:                              # noqa: BLE001
        _finish(key, pid, state="failed", message=f"The storyboard failed ({type(exc).__name__}).", code="other")


def _post_of(p: dict, story: dict) -> dict:
    """The upload text: the description, the hashtags, and the sources of the checked claims under it."""
    facts = [f for f in facts_of(p["id"]) if f.get("status") == "checked"]
    urls = list(dict.fromkeys(u for f in facts for u in f["sources"]))
    credit = ("Sumber:\n" + "\n".join(urls)) if urls else ""
    post = story.get("post") or {}
    return {"title": p["title"], "caption": post.get("description", ""), "hashtags": post.get("hashtags", [])}, credit


def _add_clip_row(p: dict, story: dict, file_name: str) -> tuple[str, bool]:
    post, credit = _post_of(p, story)
    block = schedule.description(post, credit)
    row_id, created = schedule.add_file_row(p["title"], file_name, None)
    fields = {"fileFolder": MOTION_FOLDER, "title": p["title"]}
    row = schedule.get_row(row_id) or {}
    if not (row.get("description") or "").strip():
        fields["description"] = block
    if not (row.get("tiktokCaption") or "").strip():
        fields["tiktokCaption"] = block
    if post["hashtags"] and not row.get("hashtags"):
        fields["hashtags"] = list(post["hashtags"])
    schedule.set_fields(row_id, fields)
    return row_id, created


MOTION_FOLDER = schedule.MOTION


def _free_name(stem: str) -> str:
    folder = schedule.folder_dir(MOTION_FOLDER)
    folder.mkdir(parents=True, exist_ok=True)
    name, n = f"{stem}.mp4", 2
    while (folder / name).exists():
        name, n = f"{stem} ({n}).mp4", n + 1
    return name


def _run_render(pid: str, key, ev: threading.Event) -> None:
    try:
        p = load(pid)
        story = render_story(pid)
        eta = Eta(RENDER_RATIO * float(story["duration"]))
        t0 = time.monotonic()
        work = f"{pid}.mp4"
        job = {"mode": "video", "story": str(story_file(pid)), "out": work, "outRoot": str(project_dir(pid) / "out"), "composition": composition_id(p)}
        if voice_file(pid) and story_file(pid).name == "story.voiced.json":
            job["voice"] = str(voice_file(pid))                      # the narration goes under the effects and the bed (render.mjs ducks them)

        def on_line(d):
            t = d.get("type")
            if t == "progress" and d.get("stage") == "render":
                frac = min(0.97, float(d.get("pct") or 0) / 100 * 0.96 + 0.01)
                _set(key, percent=int(frac * 100), eta=_round(eta.update(time.monotonic() - t0, frac)), stage="rendering", message="Merender…")
            elif t == "progress" and d.get("stage") == "browser":
                _set(key, stage="preparing", message="Menyiapkan…")
            elif t == "audio":
                _set(key, percent=99, stage="sound", eta=None, message="Menambah suara…")

        done = _run_job(pid, key, ev, "Merender…", job, on_line)
        if done is None:
            return _finish(key, pid, state="cancelled", message="Dibatalkan.", percent=0, eta=None)
        made = Path(done.get("out") or (project_dir(pid) / "out" / work))
        if not made.is_file():
            raise MotionError("render", "The render finished but the video file is missing.")
        with _LOCK:
            name = _free_name(paths.safe_name(p["title"])[:120] or pid)
            dest = schedule.folder_dir(MOTION_FOLDER) / name
            shutil.move(str(made), dest)
            row_id, _created = _add_clip_row(p, story, name)
            p = load(pid)
            p["status"] = "rendered"
            p["render"] = {"file": name, "rowId": row_id, "at": int(time.time()), "seconds": round(time.monotonic() - t0, 1),
                           "duration": story["duration"], "storyHash": _story_hash(story)}
            save(p)
        _finish(key, pid, state="done", percent=100, eta=None, stage="", message="Selesai: videonya ada di Clips.", rowId=row_id, file=name,
                seconds=round(time.monotonic() - t0, 1))
    except MotionError as exc:
        _finish(key, pid, state="failed", message=exc.message, code=exc.code, eta=None)
    except BaseException as exc:                              # noqa: BLE001
        _finish(key, pid, state="failed", message=f"The render failed ({type(exc).__name__}: {exc}).", code="other", eta=None)


def _round(x):
    return None if x is None else int(round(x))
