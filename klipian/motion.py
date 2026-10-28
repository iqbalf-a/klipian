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
PREVIEW_RATIO = 0.4             # the half-size draft takes about this share of the final render's time (to be measured on the first real run)
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


VIDEOS_ROOT: Path | None = None      # the folder of the custom videos (the tests point it at a copy; never the person's own folder)


def videos_root() -> Path:
    return VIDEOS_ROOT or (REMOTION / "videos")


def _video_dirs() -> list[Path]:
    root = videos_root()
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


def kind_of(p: dict) -> str:
    """"custom" (a video made for this story in a Claude Code session) or "template" (klipian's template). The choice is the option "kind"
    ("khusus" or "otomatis"). A project saved before the choice existed: custom when it has a composition, else template."""
    raw = (p.get("options") or {}).get("kind")
    if raw:
        return "custom" if raw == "khusus" else "template"
    return "custom" if p.get("composition") else "template"


def composition_id(p: dict) -> str:
    """The Remotion composition a project renders with: the template (FunFact), or video-<slug> for a custom composition (only when the kind is custom)."""
    slug = p.get("composition") or ""
    return f"video-{slug}" if slug and kind_of(p) == "custom" else "FunFact"


# --------------------------------------------------------------------------
# the next step and the stage chips (PLAN-REMOTION-PAGE A): pure functions of the facts of a video, so the page and the tests agree
# --------------------------------------------------------------------------

FOLDER_SLUG = re.compile(r"[a-z0-9][a-z0-9-]{1,38}")


def folder_story_path(slug: str) -> Path:
    """The story.json of a video folder the person chose, and nothing else of it: a direct child of remotion/videos/, no "..", no symlink out."""
    if not isinstance(slug, str) or not FOLDER_SLUG.fullmatch(slug):
        raise MotionError("folder", "Pilih folder video dari daftar.")
    root = videos_root()
    folder = root / slug
    if folder.is_symlink() or not folder.is_dir():
        raise MotionError("folder", f"Folder {slug} tidak ada di remotion/videos/.")
    if folder.resolve().parent != root.resolve():
        raise MotionError("folder", "Folder itu bukan anak langsung dari remotion/videos/.")
    story = folder / "story.json"
    if story.is_symlink() or not story.is_file():
        raise MotionError("folder", f"Folder {slug} belum punya story.json.")
    if story.resolve().parent != folder.resolve():
        raise MotionError("folder", "story.json itu berada di luar folder.")
    return story


def _file_hash(path: Path) -> str:
    return hashlib.sha1(path.read_bytes()).hexdigest()[:12]


def folder_state(pid: str) -> dict | None:
    """The chosen folder of a Khusus video: its full path and the state (belum dipilih, cerita belum diambil, cerita diambil, folder berubah).
    None for a template video. Reads the folder's story.json only, and only to compare it with the story taken."""
    p = load(pid)
    if kind_of(p) != "custom":
        return None
    slug = p.get("composition") or ""
    if not slug:
        return {"slug": "", "path": "", "state": "belum dipilih"}
    path = str(videos_root() / slug)
    try:
        current = _file_hash(folder_story_path(slug))
    except MotionError:
        return {"slug": slug, "path": path, "state": "folder tidak lengkap"}
    take = p.get("folderTake") or {}
    if take.get("slug") != slug:
        state = "cerita belum diambil"
    else:
        state = "cerita diambil" if take.get("hash") == current else "folder berubah"
    return {"slug": slug, "path": path, "state": state}


def take_folder(pid: str, slug: str) -> dict:
    """"Ambil cerita dari folder": the story.json of the chosen folder, checked like a pasted answer (the same errors and the same fix message) and
    kept as the project's story when it is valid. A rejected story is not kept. Never writes into the folder."""
    story_file = folder_story_path(slug)
    try:
        story = json.loads(story_file.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        raise MotionError("folder", "story.json di folder itu tidak bisa dibaca sebagai JSON.") from None
    with _LOCK:
        p = load(pid)
        v = validate_story(story)
        errors = list(v.get("errors", [])) if not v.get("ok") else []
        errors += _check_for(p, story) if isinstance(story, dict) else []
        if errors:
            return {"ok": False, "errors": errors, "fix": build_fix_message(errors, "main", options_of(p))}
        _accept(pid, story)
        p = load(pid)
        p["composition"] = slug
        p["options"] = {**options_of(p), "kind": "khusus"}
        p["folderTake"] = {"slug": slug, "hash": _file_hash(story_file), "at": int(time.time())}
        save(p)
    return {"ok": True, "folder": folder_state(pid), "story": story}


def next_step(f: dict) -> dict:
    """The one thing to do now. `f` holds: story, pending, rejected, title, custom, composition, slug, voice, aligned, render ("none" | "current" |
    "stale"), gate (the reasons a render is blocked), briefed, storyPath. Returns {"key", "text", "action", "command"?}."""
    if f.get("custom"):                                                 # Khusus: the story comes from the chosen folder, never pasted
        state = f.get("folder")
        if state in (None, "belum dipilih"):
            return {"key": "folder", "text": "Salin brief ke Claude Code, lalu pilih folder hasilnya", "action": "brief"}
        if state in ("cerita belum diambil", "folder tidak lengkap") or not f.get("story"):
            return {"key": "take", "text": "Ambil cerita dari folder", "action": "take"}
        if state == "folder berubah":
            return {"key": "retake", "text": "Ambil ulang cerita (folder berubah)", "action": "take"}
    if not f.get("story"):
        if not f.get("briefed"):
            return {"key": "brief", "text": "Salin brief ke Claude Code", "action": "brief"}
        return {"key": "paste", "text": "Tempel jawaban dari Claude Code", "action": "paste"}
    if f.get("rejected"):
        return {"key": "fix", "text": f"Perbaiki {f['rejected']} klaim yang ditolak", "action": "facts"}
    if f.get("pending"):
        return {"key": "facts", "text": f"Centang {f['pending']} klaim lagi", "action": "facts"}
    if not f.get("title"):
        return {"key": "title", "text": "Pilih judul", "action": "title"}
    if f.get("voice") and not f.get("aligned"):
        return {"key": "align", "text": "Cocokkan narasi", "action": "align"}
    if f.get("gate"):
        return {"key": "blocked", "text": f"Belum bisa dirender: {f['gate'][0]}", "action": "none"}
    if f.get("render") == "current":
        return {"key": "clips", "text": "Buka di Clips", "action": "clips"}
    if f.get("render") == "stale":
        return {"key": "render", "text": "Render ulang (ada yang berubah)", "action": "render"}
    return {"key": "render", "text": "Render", "action": "render"}


def stage_chips(f: dict) -> list[dict]:
    """The stage chips in order: Cerita, Klaim, Judul, Suara, Gambar, Pratinjau, Render. A state is selesai, menunggu, usang, perlu or tidak ada."""
    chips = [{"key": "cerita", "label": "Cerita", "state": "selesai" if f.get("story") else "menunggu"}]
    if not f.get("story"):
        chips.append({"key": "klaim", "label": "Klaim", "state": "menunggu"})
    elif f.get("rejected") or f.get("pending"):
        chips.append({"key": "klaim", "label": "Klaim", "state": "perlu"})
    else:
        chips.append({"key": "klaim", "label": "Klaim", "state": "selesai"})
    chips.append({"key": "judul", "label": "Judul", "state": "selesai" if f.get("title") else "menunggu"})
    if f.get("folder") == "folder berubah":                              # the folder's story changed: what was built on it is stale
        for chip in chips[:3]:
            chip["state"] = "usang"
    if not f.get("voice"):
        chips.append({"key": "suara", "label": "Suara", "state": "tidak ada"})
    elif f.get("aligned"):
        chips.append({"key": "suara", "label": "Suara", "state": "usang" if f.get("voiceStale") else "selesai"})
    else:
        chips.append({"key": "suara", "label": "Suara", "state": "menunggu"})
    chips.append({"key": "gambar", "label": "Gambar", "state": {"ok": "selesai", "stale": "usang"}.get(f.get("stills"), "menunggu")})
    chips.append({"key": "pratinjau", "label": "Pratinjau", "state": {"current": "selesai", "stale": "usang"}.get(f.get("preview"), "menunggu")})
    chips.append({"key": "render", "label": "Render", "state": {"current": "selesai", "stale": "usang"}.get(f.get("render"), "menunggu")})
    return chips


def _render_now(p: dict, story) -> dict | None:
    """The last render with its state: current, or stale with the reasons (the story or the voice changed, the kind or the composition changed).
    A render saved before the kind was recorded is compared on the story only."""
    r = p.get("render")
    if not isinstance(r, dict):
        return None
    reasons = []
    if story is not None and r.get("storyHash") != _story_hash(story):
        reasons.append("cerita atau suara berubah")
    if r.get("kind") is not None and r.get("kind") != kind_of(p):
        reasons.append("jenis video berubah")
    if r.get("kind") is not None and r.get("composition") is not None and r.get("composition") != (p.get("composition") or ""):
        reasons.append("video khusus berbeda")
    return {**r, "current": not reasons, "reasons": reasons}


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


def create(topic: str, duration=DEFAULT_DURATION, notes: str = "", options: dict | None = None) -> dict:
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
         "title": "", "created": now, "updated": now, "needs": [], "render": None, "composition": "", "options": normalize_options({"music": DEFAULT_OPTIONS["music"], **(options or {})})}
    with _LOCK:
        project_dir(pid).mkdir(parents=True, exist_ok=True)
        save(p)
    return p


def set_options(pid: str, raw: dict) -> dict:
    """The options of a video (loop, the sting, the voice target, the music, the kind): the ones given change, the rest stay. The warnings say what
    the channel asks for; the brief and the fix message carry the options from now on."""
    with _LOCK:
        p = load(pid)
        p["options"] = normalize_options({**options_of(p), **(raw if isinstance(raw, dict) else {})})
        save(p)
    return {"options": p["options"], "warnings": option_warnings(p["options"])}


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
            if slug:                                              # choosing a video folder means the custom kind
                p["options"] = {**options_of(p), "kind": "khusus"}
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
    """Everything the page needs about one video, and the next step and the stage chips (from the same facts)."""
    p = load(pid)
    story = story_of(pid)
    facts = facts_of(pid) if story else []
    stills = _stills_state(pid, story)
    voice = voice_info(pid)
    preview = _preview_state(pid, story)
    render_now = _render_now(p, render_story(pid) if story is not None else None)
    gate_problems = gate(pid)
    pending = sum(1 for x in facts if x.get("status") not in ("checked", "rejected"))
    rejected = sum(1 for x in facts if x.get("status") == "rejected")
    folder = folder_state(pid)
    f = {"story": story is not None, "pending": pending, "rejected": rejected, "title": bool(p.get("title")), "custom": kind_of(p) == "custom",
         "folder": folder["state"] if folder else None,
         "composition": bool(p.get("composition")), "slug": _slug(p.get("topic", ""))[:39], "voice": bool(voice and voice.get("name")),
         "aligned": bool(voice and voice.get("aligned")), "voiceStale": bool(voice and voice.get("stale")),
         "render": "none" if not render_now else "current" if render_now["current"] else "stale", "gate": gate_problems,
         "briefed": bool(p.get("briefAt")), "storyPath": str(project_dir(pid) / "story.json"),
         "stills": "none" if not stills.get("files") else "stale" if stills.get("stale") else "ok",
         "preview": "none" if not preview else "stale" if preview.get("stale") else "current"}
    return {**summary(p), "options": options_of(p), "optionWarnings": option_warnings(options_of(p)), "notes": p.get("notes", ""), "needs": p.get("needs", []), "warnings": (validate_story(story).get("warnings", []) if story else []), "storyPath": str(project_dir(pid) / "story.json"), "compositions": compositions(), "story": story, "facts": facts,
            "kind": kind_of(p), "folder": folder, "gate": gate_problems, "stills": stills, "render": render_now, "job": job_state(pid), "voice": voice,
            "preview": preview, "next": next_step(f), "stages": stage_chips(f),
            "versions": len(list((project_dir(pid) / "history").glob("story-*.json"))) if (project_dir(pid) / "history").is_dir() else 0}


def note_brief(pid: str) -> None:
    """The brief was copied for the local Claude Code: the next step moves on to pasting the answer."""
    with _LOCK:
        p = load(pid)
        p["briefAt"] = int(time.time())
        save(p)




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
            return {"ok": False, "errors": errors, "fix": build_fix_message(errors, kind, options_of(p))}
        story = data
        if kind == "revise":
            story = _merge_revision(pid, data)
            if isinstance(story, list):                         # errors
                return {"ok": False, "errors": story, "fix": build_fix_message(story, kind, options_of(p))}
        v = validate_story(story)
        errors = list(v.get("errors", [])) if not v.get("ok") else []
        errors += _check_for(p, story) if isinstance(story, dict) else []
        if errors:
            return {"ok": False, "errors": errors, "fix": build_fix_message(errors, kind, options_of(p))}
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
            return {"ok": False, "errors": errors, "fix": build_fix_message(errors, "main", options_of(load(pid)))}
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


# several narration files (PLAN-ALUR-V2 phase 1): each part is kept as an original (voice/originals/NNN__name) and as a processed part
# (voice/parts/part-NNN.wav); narration.wav is the join of the parts with a silence between them. Replacing one part rebuilds the join from the
# originals and clears the alignment.
PART_LOUD_SPREAD_DB = 6.0     # parts further apart than this in loudness are evened out to the middle part's level (the page says so)
PART_GAIN_MAX_DB = 12.0       # no part is moved by more than this


def _mean_db(ff: str, wav: Path) -> float | None:
    proc = subprocess.run([ff, "-hide_banner", "-nostats", "-i", str(wav), "-af", "volumedetect", "-f", "null", "-"],
                          capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=300)
    m = re.search(r"mean_volume:\s*(-?[\d.]+)\s*dB", proc.stderr or "")
    return float(m.group(1)) if m else None


def _concat_line(path: Path) -> str:
    text = str(path).replace("\\", "/").replace("'", "'\\''")
    return f"file '{text}'\n"


def _build_voice(pid: str, originals: list[tuple[int, str, Path]], gap: float, notes: list[str]) -> dict:
    """The originals in order -> processed parts (48 kHz mono, evened out in loudness when they differ) -> narration.wav, joined with `gap` seconds
    of silence. Returns {"parts", "duration", "gap"}. Must be called with _LOCK held."""
    from .ffmpeg_tools import _require, probe, run
    ff = _require("ffmpeg")
    parts_dir = voice_dir(pid) / "parts"
    shutil.rmtree(parts_dir, ignore_errors=True)
    parts_dir.mkdir(parents=True, exist_ok=True)
    raw = []
    for no, name, src in originals:
        out = parts_dir / f"part-{no:03d}.raw.wav"
        run([ff, "-y", "-v", "error", "-i", str(src), "-vn", "-ac", "1", "-ar", "48000", "-c:a", "pcm_s16le", str(out)], desc=f"converting part {no}", timeout=600)
        raw.append((no, name, out))
    levels = {no: _mean_db(ff, f) for no, _name, f in raw}
    known = [v for v in levels.values() if v is not None]
    gains = {no: 0.0 for no, _name, _f in raw}
    if len(known) > 1 and max(known) - min(known) > PART_LOUD_SPREAD_DB:
        target = sorted(known)[len(known) // 2]
        for no, v in levels.items():
            if v is not None:
                gains[no] = max(-PART_GAIN_MAX_DB, min(PART_GAIN_MAX_DB, target - v))
        notes.append(f"the parts differed in loudness by {max(known) - min(known):.0f} dB: evened out to the middle part's level (at most {PART_GAIN_MAX_DB:.0f} dB each)")
    parts = []
    for no, name, f in raw:
        out = parts_dir / f"part-{no:03d}.wav"
        if gains[no]:
            run([ff, "-y", "-v", "error", "-i", str(f), "-af", f"volume={gains[no]:.2f}dB", "-c:a", "pcm_s16le", str(out)], desc=f"evening out part {no}", timeout=600)
        else:
            shutil.copyfile(f, out)
        seconds = probe(out).duration
        if seconds < voicelib.PART_MIN or seconds > voicelib.PART_MAX:
            raise MotionError("voice", f"{name} is {seconds:.1f} seconds: a part lasts from {voicelib.PART_MIN} to {voicelib.PART_MAX:.0f} s.")
        parts.append({"no": no, "name": name, "file": out, "duration": round(seconds, 2)})
    entries: list[Path] = []
    rows: list[dict] = []
    silence = parts_dir / "silence.wav"
    joined = gap > 0 and len(parts) > 1
    if joined:
        run([ff, "-y", "-v", "error", "-f", "lavfi", "-i", "anullsrc=r=48000:cl=mono", "-t", f"{gap:.3f}", "-c:a", "pcm_s16le", str(silence)], desc="the silence between parts", timeout=120)
    offset = 0.0
    for i, part in enumerate(parts):
        entries.append(part["file"])
        rows.append({"no": part["no"], "name": part["name"], "duration": part["duration"], "offset": round(offset, 2)})
        offset += part["duration"]
        if joined and i < len(parts) - 1:
            entries.append(silence)
            offset += gap
    join = parts_dir / "join.txt"
    join.write_text("".join(_concat_line(e) for e in entries), encoding="utf-8")
    out = voice_dir(pid) / "narration.wav"
    run([ff, "-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", str(join), "-ac", "1", "-ar", "48000", "-c:a", "pcm_s16le", str(out)], desc="joining the parts", timeout=900)
    total = probe(out).duration
    if total < 1.0 or total > 180:
        raise MotionError("voice", f"The narration is {total:.1f} seconds: it must be between 1 and 180.")
    return {"parts": rows, "duration": round(total, 2), "gap": gap}


def _check_audio(source: Path) -> None:
    if source.suffix.lower() not in AUDIO_EXTS:
        raise MotionError("voice", f"A narration is an audio file ({', '.join(sorted(AUDIO_EXTS))}), not {source.suffix.lower() or 'a file without an extension'}.")
    if not source.is_file():
        raise MotionError("voice", f"{source.name} was not found.")
    if source.stat().st_size > MAX_VOICE_BYTES:
        raise MotionError("voice", f"{source.name} is too big for a narration.")


def import_voice_parts(pid: str, sources: list[Path], gap: float = voicelib.GAP) -> dict:
    """Several narration files of one video: their order is the number at the end of each name (natural), checked by voicelib.series. One file is
    the same as import_voice. The warnings (a missing number, another prefix, the loudness) are kept in the voice's notes."""
    if not sources:
        raise MotionError("voice", "Choose the narration files first.")
    if len(sources) == 1:
        return import_voice(pid, source=sources[0])
    for s in sources:
        _check_audio(s)
    sv = voicelib.series([s.name for s in sources])
    if not sv["ok"]:
        raise MotionError("voice", " ".join(sv["errors"]))
    gap = min(1.0, max(0.0, float(gap)))
    notes = list(sv["warnings"])
    with _LOCK:
        p = load(pid)
        d = voice_dir(pid)
        shutil.rmtree(d, ignore_errors=True)
        (d / "originals").mkdir(parents=True, exist_ok=True)
        originals = []
        for no, idx in enumerate(sv["order"], 1):
            src = sources[idx]
            dst = d / "originals" / f"{no:03d}__{src.name}"
            shutil.copyfile(src, dst)
            originals.append((no, src.name, dst))
        try:
            built = _build_voice(pid, originals, gap, notes)
        except MotionError:
            shutil.rmtree(d, ignore_errors=True)
            raise
        except Exception as exc:                                  # noqa: BLE001
            shutil.rmtree(d, ignore_errors=True)
            raise MotionError("voice", f"The narration parts could not be joined ({type(exc).__name__}).") from None
        (project_dir(pid) / "story.voiced.json").unlink(missing_ok=True)
        p["voice"] = {"name": f"{len(sources)} files", "duration": built["duration"], "at": int(time.time()), "aligned": False,
                      "parts": built["parts"], "gap": built["gap"], "notes": notes}
        save(p)
    return p["voice"]


def replace_voice_part(pid: str, no: int, source: Path) -> dict:
    """Replaces one part (its number in the series) with another file: the others are kept, the join is made again, the alignment is cleared."""
    _check_audio(source)
    with _LOCK:
        p = load(pid)
        v = p.get("voice") or {}
        parts = v.get("parts") or []
        if not parts:
            raise MotionError("voice", "This narration is one file: import the parts (several files) to replace one of them.")
        if not 1 <= no <= len(parts):
            raise MotionError("voice", f"There is no part {no}: the narration has {len(parts)}.")
        d = voice_dir(pid)
        for old in (d / "originals").glob(f"{no:03d}__*"):
            old.unlink()
        dst = d / "originals" / f"{no:03d}__{source.name}"
        shutil.copyfile(source, dst)
        originals = []
        for k, part in enumerate(parts, 1):
            if k == no:
                originals.append((k, source.name, dst))
            else:
                originals.append((k, part["name"], d / "originals" / f"{k:03d}__{part['name']}"))
        notes = [n for n in v.get("notes", []) if not n.startswith("the parts differed")]
        built = _build_voice(pid, originals, float(v.get("gap", voicelib.GAP)), notes)
        (d / "voice.json").unlink(missing_ok=True)
        (project_dir(pid) / "story.voiced.json").unlink(missing_ok=True)
        p["voice"] = {**v, "duration": built["duration"], "parts": built["parts"], "aligned": False, "notes": notes, "lengthChoice": None}
        save(p)
    return p["voice"]


def choose_length(pid: str, choice: str) -> dict:
    """The two choices when the aligned length is off by more than the policy (15 %): "continue" renders the video at the narration's length; "edit"
    is the narration text (the page sends the person there, nothing is stored)."""
    if choice not in ("continue", "edit"):
        raise MotionError("voice", "The choice is continue or edit.")
    with _LOCK:
        p = load(pid)
        if not p.get("voice"):
            raise MotionError("voice", "There is no narration.")
        p["voice"]["lengthChoice"] = "continue" if choice == "continue" else None
        save(p)
    return p["voice"]


def narration_for(pid: str, target: str) -> dict:
    """The narration text for a voice app, from the current story (the words the person will have voiced) and the video's options."""
    story = story_of(pid)
    if story is None:
        raise MotionError("no_story", "There is no story yet: paste the AI's answer first.")
    return narration_export(story, target, options_of(load(pid)))


def subtitles_file(pid: str, fmt: str) -> Path | None:
    if fmt not in ("srt", "vtt"):
        return None
    f = voice_dir(pid) / f"captions.{fmt}"
    return f if f.is_file() else None


def preview_file(pid: str) -> Path | None:
    f = project_dir(pid) / "out" / "preview.mp4"
    return f if f.is_file() else None


def preview_video(pid: str) -> dict:
    """The whole video at half size (540 by 960), with the narration, the sound effects and the bed, as a draft. The final render is unchanged."""
    if story_of(pid) is None:
        raise MotionError("no_story", "There is no story yet: paste the AI's answer first.")
    return _start(pid, "preview-video", _run_preview_video)


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
    table = meta.get("table") if aligned else None
    return {"name": v["name"], "duration": v["duration"], "aligned": aligned, "stale": bool(meta) and not aligned, "method": meta.get("method"), "ratio": meta.get("ratio"),
            "total": total, "target": p["duration"], "tts": bool(tts_available()),
            "note": (f"The narration makes the video {total:.1f} s; it was planned for {p['duration']} s." if abs(total - p["duration"]) > 0.5 else ""),
            "parts": v.get("parts") or [], "gap": v.get("gap", voicelib.GAP), "notes": v.get("notes") or [],
            "table": table, "unmatched": (meta.get("unmatched") or []) if aligned else [],
            "lengthOk": table["lengthOk"] if table else True, "lengthChoice": v.get("lengthChoice"),
            "captions": bool(aligned and (voice_dir(pid) / "captions.srt").is_file())}


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
        table = voicelib.match_table(story["beats"], timed, float(story["duration"]))
        _write(project_dir(pid) / "story.voiced.json", timed)
        _write(voice_dir(pid) / "voice.json", {"storyHash": _story_hash(story), "method": al["method"], "ratio": al.get("ratio"), "total": total, "alignment": al,
                                               "table": table, "unmatched": al.get("unmatched", []), "at": int(time.time())})
        (voice_dir(pid) / "captions.srt").write_text(voicelib.srt(timed), encoding="utf-8")
        (voice_dir(pid) / "captions.vtt").write_text(voicelib.vtt(timed), encoding="utf-8")
        p = load(pid)
        p["voice"] = {**p["voice"], "aligned": True, "lengthChoice": None}
        save(p)
        msg = note or f"Selesai: video {timed['duration']:.1f} detik mengikuti narasi."
        if not table["lengthOk"]:
            msg += f" Panjang {table['total']:.1f} detik beda {table['percent']:+.0f}% dari {table['target']:.0f} detik: pilih lanjut atau ubah naskah."
        _finish(key, pid, state="done", percent=100, message=msg, note=note)
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
- One idea per beat; every beat's narration should make sense heard alone.
- Background theme (one for the whole video, in the story's `theme`): `cream` (the default: most videos), `sky` (a light blue: a gadget, electricity, a process), `mint` (a light green: nature, plants, water), `peach` (a warm light: food, the home, everyday objects). Two videos in a row should not share one."""

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


# the options of a video (PLAN-ALUR-V2 phase 2): what the person chooses before the brief. loop and the sting are musts of the channel: they default on,
# and turning one off gives a warning (the channel asks for them). The voice target only chooses the text format of the narration (the voice is made
# outside klipian, by the person's own voice app); the music is the story's bed.
VOICE_TARGETS = {"voicestudio": "VoiceStudio", "elevenlabs": "ElevenLabs", "googleai": "Google AI Studio"}
MUSIC_TRACKS = {"sunny": "bed-sunny", "bounce": "bed-bounce", "glow": "bed-glow", "curious": "bed-curious", "calm": "bed-calm", "tech": "bed-tech", "none": "none"}
# the labels the page shows (Indonesian). The two beds that exist are the legacy ones (PLAN-VARIETY stage 1): their tracks never change.
LEGACY_MUSIC = "calm"           # the bed of every video made before the choice of PLAN-VARIETY (ian picked sunny on 2026-10-28 for new videos only)
MUSIC_LABELS = {"sunny": "Ceria", "bounce": "Pantul", "glow": "Hangat", "curious": "Penasaran", "calm": "Tenang (lama)", "tech": "Teknologi (lama)", "none": "Tanpa musik"}
# when each bed fits (PLAN-VARIETY): the brief tells the AI which one to choose for which kind of fact
MUSIC_USE = {
    "sunny": "cheerful and major (about 120 BPM, a marimba-like melody): a cause or an object that works",
    "bounce": "bouncy and playful (about 120 BPM, staccato bass, light claps): a process or a gadget",
    "glow": "warm and friendly (about 100 BPM, pads and a bell arpeggio): everyday objects at home",
    "curious": "playful and a little mysterious (about 100 BPM, a Dorian feel): a myth check or a how-does-it-work",
    "calm": "calm and slow (the legacy bed, kept for old videos)",
    "tech": "a quiet pattern (the legacy bed, kept for old videos)",
    "none": "no music",
}
KINDS = {"otomatis": "Otomatis (template, paling cepat)", "khusus": "Khusus (video buatan sesi Claude Code, tampilan terbaik)"}
VS_GENDERS = ("female", "male")
VS_AGES = ("child", "teenager", "young adult", "middle-aged", "elderly")
VS_PITCH = "moderate pitch"          # the VoiceStudio pitch the export always writes (the pitch is not a choice in the panel)
VS_TAGS_MAX = 2                      # the optional [laughter] at most twice in a video
DEFAULT_OPTIONS = {"loop": True, "sting": True, "voiceTargets": list(VOICE_TARGETS), "voiceTargetFirst": "voicestudio", "music": "sunny", "kind": "otomatis",
                   "vsGender": "female", "vsAge": "young adult", "vsTags": False}


def normalize_options(raw) -> dict:
    """The options with the defaults filled in. The voice apps are a list of the apps checked (all three by default; an empty list is refused). The
    old single choice ("voiceTarget") is read as: all three apps, with that one first; it is never written again. A value that is not a choice is
    refused with the choices listed."""
    raw = raw if isinstance(raw, dict) else {}
    out = dict(DEFAULT_OPTIONS)
    out["voiceTargets"] = list(VOICE_TARGETS)
    out["voiceTargetFirst"] = DEFAULT_OPTIONS["voiceTargetFirst"]
    for key in ("loop", "sting"):
        if key in raw:
            if not isinstance(raw[key], bool):
                raise MotionError("options", f"{key} is yes or no.")
            out[key] = raw[key]
    if "voiceTarget" in raw and "voiceTargets" not in raw:               # the old single choice: all three, that one first
        if raw["voiceTarget"] not in VOICE_TARGETS:
            raise MotionError("options", f"voiceTarget is one of: {', '.join(VOICE_TARGETS)}.")
        out["voiceTargetFirst"] = raw["voiceTarget"]
    if "voiceTargets" in raw:
        targets = raw["voiceTargets"]
        if not isinstance(targets, list) or any(t not in VOICE_TARGETS for t in targets):
            raise MotionError("options", f"voiceTargets is a list of the apps: {', '.join(VOICE_TARGETS)}.")
        chosen = [t for t in VOICE_TARGETS if t in targets]              # in the order of the apps
        if not chosen:
            raise MotionError("options", "pilih minimal satu aplikasi suara.")
        out["voiceTargets"] = chosen
    if "voiceTargetFirst" in raw:
        if raw["voiceTargetFirst"] not in VOICE_TARGETS:
            raise MotionError("options", f"voiceTargetFirst is one of: {', '.join(VOICE_TARGETS)}.")
        out["voiceTargetFirst"] = raw["voiceTargetFirst"]
    if out["voiceTargetFirst"] not in out["voiceTargets"]:
        out["voiceTargetFirst"] = out["voiceTargets"][0]
    if "music" not in raw:
        out["music"] = LEGACY_MUSIC                              # a project saved before the choice keeps its bed: calm
    for key, choices in (("music", MUSIC_TRACKS), ("kind", KINDS)):
        if key in raw:
            if raw[key] not in choices:
                raise MotionError("options", f"{key} is one of: {', '.join(choices)}.")
            out[key] = raw[key]
    if "vsGender" in raw:
        if raw["vsGender"] not in VS_GENDERS:
            raise MotionError("options", f"vsGender is one of: {', '.join(VS_GENDERS)}.")
        out["vsGender"] = raw["vsGender"]
    if "vsAge" in raw:
        if raw["vsAge"] not in VS_AGES:
            raise MotionError("options", f"vsAge is one of: {', '.join(VS_AGES)}.")
        out["vsAge"] = raw["vsAge"]
    if "vsTags" in raw:
        if not isinstance(raw["vsTags"], bool):
            raise MotionError("options", "vsTags is yes or no.")
        out["vsTags"] = raw["vsTags"]
    return out


def voice_apps_text(targets: list[str]) -> str:
    return ", ".join(VOICE_TARGETS[t] for t in targets)


def options_of(p: dict) -> dict:
    return normalize_options(p.get("options") or {})


def option_warnings(opts: dict) -> list[str]:
    """What the channel asks for and what a choice takes away. A warning, not a refusal: the person may decide, and the brief says so."""
    out = []
    if not opts["loop"]:
        out.append("saluran ini mewajibkan loop: akhir video kembali ke adegan awal. Video tanpa loop hanya dengan persetujuan ian.")
    if not opts["sting"]:
        out.append('saluran ini mewajibkan "Intip yuk!" tepat setelah hook. Video tanpa sting hanya dengan persetujuan ian.')
    return out


def _options_text(opts: dict) -> str:
    music = f"{MUSIC_USE[opts['music']]} (story music track {MUSIC_TRACKS[opts['music']]})"
    lines = [f"- Loop: {'yes' if opts['loop'] else 'no'} (the ending returns to the scene of the first beat)",
             f"- Intip yuk!: {'yes' if opts['sting'] else 'no'} (the small sting right after the hook)",
             f"- Music: {music}",
             f"- Target voice apps: {voice_apps_text(opts['voiceTargets'])} (klipian writes the narration text in each app's own format; the voices are made outside klipian)",
             f"- Kind: {KINDS[opts['kind']]}"]
    warn = option_warnings(opts)
    if warn:
        lines.append("- Warning: " + " ".join(warn))
    return "## Pilihan video\n\n" + "\n".join(lines)


def _sentences(text: str) -> list[str]:
    return [s for s in re.split(r"(?<=[.!?])\s+", str(text or "").strip()) if s]


# words a second (the planner's range, 2.3 to 3.2): the estimate of a part's length is a range, never a single number
WPS_LOW, WPS_HIGH = 2.3, 3.2
PART_SECONDS = 12.0              # a part is about this long (suggested breaks at sentence ends, 10 to 15 s)


def narration_parts(story: dict) -> list[dict]:
    """The narration split into parts at sentence ends, each about PART_SECONDS long. Each part: {"no", "text", "words", "low", "high", "beats"} with
    the estimated seconds as a range. A beat boundary is kept as a boundary in the parts' text (for the markup that uses it)."""
    units = []
    for beat in story["beats"]:
        for sent in _sentences(beat.get("narration", "")):
            units.append({"beat": beat["id"], "text": sent, "words": len(sent.split())})
    parts: list[dict] = []
    cur: list[dict] = []
    seconds = 0.0
    for u in units:
        cur.append(u)
        seconds += u["words"] / ((WPS_LOW + WPS_HIGH) / 2)
        if seconds >= PART_SECONDS:
            parts.append(cur)
            cur, seconds = [], 0.0
    if cur:
        parts.append(cur)
    out = []
    for n, units_in in enumerate(parts, 1):
        words = sum(u["words"] for u in units_in)
        out.append({"no": n, "words": words, "low": round(words / WPS_HIGH, 1), "high": round(words / WPS_LOW, 1),
                    "units": units_in, "text": " ".join(u["text"] for u in units_in)})
    return out


def _google_style(story: dict) -> str:
    """The short style description, English, built from the beats the story has (no age, gender, names or accent: the docs ask for a concise style)."""
    kinds = {b["kind"] for b in story["beats"] if (b.get("narration") or "").strip()}
    parts = ["friendly, curious and upbeat"]
    if "hook" in kinds:
        parts.append("playful on the hook")
    if "sting" in kinds:
        parts.append("a little hushed on 'Intip yuk!'")
    if kinds & {"lens", "normal", "loose"}:
        parts.append("calm and neutral on the facts")
    if "result" in kinds:
        parts.append("clear on the result")
    if "tips" in kinds:
        parts.append("warm and slightly cautious on the tips")
    return "; ".join(parts) + "; medium pace, short natural pauses at sentence ends."


def _google_script(story: dict, parts: list[dict]) -> tuple[str, list[dict]]:
    """The script with the expression tags, placed by rule (no AI call): a short pause between beats, a long pause before the last tips beat, and at
    most one expression per beat and GOOGLE_EXPRESSIONS_MAX in all: <whispers> before "Intip yuk!", <chuckle> before a sentence that turns the fact
    ("Tapi", "Namun", "Padahal") in a result beat. Tags are never inside a word or after the last sentence. Returns (script, tags used)."""
    kind_of_beat = {b["id"]: b["kind"] for b in story["beats"]}
    tips = [b["id"] for b in story["beats"] if b["kind"] == "tips" and (b.get("narration") or "").strip()]
    last_tips = tips[-1] if tips else None
    tags: list[dict] = []
    used_beats: set[str] = set()
    expressions = 0
    pieces_per_part: list[str] = []
    prev: dict | None = None
    for part in parts:
        out = ""
        for u in part["units"]:
            kind = kind_of_beat[u["beat"]]
            text = u["text"]
            if prev is not None and prev["beat"] != u["beat"]:
                if u["beat"] == last_tips and kind == "tips":
                    out += " <long pause> "
                    tags.append({"tag": "long pause", "beat": u["beat"], "at": "sebelum tips terakhir"})
                else:
                    out += " <short pause> "
                    tags.append({"tag": "short pause", "beat": u["beat"], "at": "antar beat"})
            elif out:
                out += " "
            if u["beat"] not in used_beats and expressions < GOOGLE_EXPRESSIONS_MAX:
                if kind == "sting" and re.match(r"intip yuk", text, re.I):
                    text = f"<whispers> {text}"
                elif kind == "result" and re.match(r"(tapi|namun|padahal)\b", text, re.I):
                    text = f"<chuckle> {text}"
                if text.startswith("<whispers>") or text.startswith("<chuckle>"):
                    used_beats.add(u["beat"])
                    expressions += 1
                    tags.append({"tag": text.split(">")[0][1:], "beat": u["beat"], "at": "awal kalimat"})
            out += text
            prev = u
        pieces_per_part.append(re.sub(r"\s+", " ", out).strip())
    return "\n\n".join(pieces_per_part), tags


GOOGLE_EXPRESSIONS_MAX = 6


def _voicestudio(story: dict, parts: list[dict], options: dict) -> dict:
    """VoiceStudio (PLAN-VOICE-VOICESTUDIO, docs read 2026-10-28): [pause 500ms] between two beats, [pause 1s] once before the last tips, the optional
    [laughter] (only when the person checks it, at most VS_TAGS_MAX, before a turning sentence of a result beat), and the voice description: one value
    per category (gender, age, pitch). The header lines "Bagian N" are markers for the person; the matching strips them."""
    kind_of_beat = {b["id"]: b.get("kind") for b in story["beats"]}
    tips = [b["id"] for b in story["beats"] if b.get("kind") == "tips" and (b.get("narration") or "").strip()]
    last_tips = tips[-1] if tips else None
    tags: list[dict] = []
    tagged = 0
    blocks = []
    prev = None
    for part in parts:
        out = ""
        for u in part["units"]:
            kind = kind_of_beat[u["beat"]]
            text = u["text"]
            if prev is not None and prev["beat"] != u["beat"]:
                if u["beat"] == last_tips and kind == "tips":
                    out += " [pause 1s] "
                    tags.append({"tag": "pause 1s", "beat": u["beat"], "at": "sebelum tips terakhir"})
                else:
                    out += " [pause 500ms] "
                    tags.append({"tag": "pause 500ms", "beat": u["beat"], "at": "antar beat"})
            elif out:
                out += " "
            if options.get("vsTags") and kind == "result" and tagged < VS_TAGS_MAX and re.match(r"(tapi|namun|padahal)\b", text, re.I):
                text = f"[laughter] {text}"
                tagged += 1
                tags.append({"tag": "laughter", "beat": u["beat"], "at": "awal kalimat"})
            out += text
            prev = u
        mid = round((part["low"] + part["high"]) / 2)
        blocks.append(f"Bagian {part['no']} (sekitar {mid} detik)\n" + re.sub(r"\s+", " ", out).strip())
    script = "\n\n".join(blocks)
    style = f"{options.get('vsGender', 'female')}, {options.get('vsAge', 'young adult')}, {VS_PITCH}"
    return {"script": script, "style": style, "tags": tags}


# ElevenLabs (PLAN-VOICE-ELEVENLABS, docs read 2026-10-28): the voice-related tags of the official list, the pauses with "..." and [pause] (never
# <break>, which v4 and v3 do not support), and the model and the settings as a note, not as text.
EL_EXPRESSIONS = ("whispers", "curious", "laughs", "sighs", "excited", "exhales")   # the ones the export may use (the official voice list)
EL_EXPRESSIONS_MAX = 6


def _elevenlabs(story: dict, parts: list[dict]) -> dict:
    """One request: the whole narration (no part headers). "..." ends a sentence before a beat changes (a final "." becomes "..."), [pause] once
    before the last tips, [whispers] before "Intip yuk!", [curious] at the start of a hook that is a question. At most one tag per beat and six in all."""
    kind_of_beat = {b["id"]: b.get("kind") for b in story["beats"]}
    tips = [b["id"] for b in story["beats"] if b.get("kind") == "tips" and (b.get("narration") or "").strip()]
    last_tips = tips[-1] if tips else None
    units = [u for part in parts for u in part["units"]]
    tags: list[dict] = []
    used: set[str] = set()
    expressions = 0
    out = ""
    prev = None
    for u in units:
        kind = kind_of_beat[u["beat"]]
        text = u["text"]
        if prev is not None and prev["beat"] != u["beat"]:
            if out.endswith("."):                                   # the sentence before a beat ends in an ellipsis
                out = out[:-1] + "..."
            if u["beat"] == last_tips and kind == "tips":
                out += " [pause] "
                tags.append({"tag": "pause", "beat": u["beat"], "at": "sebelum tips terakhir"})
            else:
                out += " "
        elif out:
            out += " "
        if u["beat"] not in used and expressions < EL_EXPRESSIONS_MAX:
            tag = None
            if kind == "sting" and re.match(r"intip yuk", text, re.I):
                tag = "whispers"
            elif kind == "hook" and text.rstrip().endswith("?") and prev is None:
                tag = "curious"
            if tag:
                text = f"[{tag}] {text}"
                used.add(u["beat"])
                expressions += 1
                tags.append({"tag": tag, "beat": u["beat"], "at": "awal kalimat"})
        out += text
        prev = u
    script = re.sub(r"\s+", " ", out).strip()
    return {"script": script, "tags": tags}


def narration_export(story: dict, target: str, options: dict | None = None) -> dict:
    """The narration text for one voice app. VoiceStudio: plain text with a header line per part (the header is for the person: remove it before the
    voice reads). ElevenLabs: plain text with its punctuation; the Eleven v3 pause tags are not verified, so none are written. Google AI Studio (the
    Gemini TTS docs, checked 2026-10-28): the script with expression tags from the verified list (English, in angle brackets) and the short English
    style description, plus the long style of the older AI Studio format, labelled as optional. The tags exist only in this export: the story has none."""
    if target not in VOICE_TARGETS:
        raise MotionError("voice", f"the voice target is one of: {', '.join(VOICE_TARGETS)}.")
    parts = narration_parts(story)
    total_low = round(sum(p["low"] for p in parts), 1)
    total_high = round(sum(p["high"] for p in parts), 1)
    head = f"Total sekitar {total_low:.0f} sampai {total_high:.0f} detik, {len(parts)} bagian. Target: {VOICE_TARGETS[target]}."
    base = {"target": target, "label": VOICE_TARGETS[target], "total": {"low": total_low, "high": total_high},
            "parts": [{k: v for k, v in p.items() if k != "units"} for p in parts]}
    if target == "elevenlabs":
        el = _elevenlabs(story, parts)
        settings = ("Stability: rendah ke sedang (lebih ekspresif); Similarity: sedang. Speed dan Style tidak ada di v4. Uji dulu tanpa tag.")
        model = "Model: Eleven v4 (Eleven v3 jika v4 tidak ada)."
        text = (f"{head}\n\nNASKAH (satu permintaan; jeda dengan ... dan [pause])\n{el['script']}\n\n"
                f"PENGATURAN (di ElevenLabs, bukan teks)\n{settings}\n{model}\n\n"
                "Catatan: tag memakai kurung siku dari daftar resmi ElevenLabs (diperiksa 28 Okt 2026), bahasa Inggris. "
                "Jeda dibuat dengan ... dan [pause] karena <break> tidak didukung di Eleven v4 dan v3. "
                "Belum diverifikasi: tag pada teks Indonesia, dan dukungan tag di Multilingual v2 dan Flash v2.5.\n")
        return {**base, "status": "tag dari daftar resmi ElevenLabs; jeda dengan ... dan [pause]; belum diverifikasi untuk teks Indonesia",
                "style": None, "styleLong": None, "script": el["script"], "settings": settings, "model": model, "tags": el["tags"], "text": text}
    if target == "voicestudio":
        vs = _voicestudio(story, parts, normalize_options(options or {}))
        text = (f"{head}\n\nNASKAH (tempel di VoiceStudio; baris \"Bagian N\" adalah penanda, hapus sebelum dibacakan)\n{vs['script']}\n\n"
                f"DESKRIPSI SUARA (kolom deskripsi, satu nilai tiap kategori)\n{vs['style']}\n\n"
                "Catatan: tag memakai kurung siku dan hanya dari daftar VoiceStudio (diperiksa 28 Okt 2026). Nada paling ditentukan oleh klip suara referensi. "
                "Belum terbukti untuk bahasa Indonesia: kolom deskripsi dan tag selain [laughter] dan [sigh]. Coba dulu tanpa tag.\n")
        return {**base, "status": "tag [pause ...] dari daftar VoiceStudio; [laughter] hanya jika dicentang; belum terbukti untuk bahasa Indonesia",
                "style": vs["style"], "styleLong": None, "script": vs["script"], "tags": vs["tags"], "text": text}
    if target == "googleai":
        script, tags = _google_script(story, parts)
        style = _google_style(story)
        style_long = "Indonesian short-video science explainer. " + style[0].upper() + style[1:]
        text = (f"{head}\n\nNASKAH + EKSPRESI\n{script}\n\nDESKRIPSI (gaya, bahasa Inggris)\n{style}\n\n"
                f"DESKRIPSI LENGKAP (versi lama, opsional: bisa menggeser suara; coba yang singkat dulu)\n{style_long}\n\n"
                "Catatan: tag memakai <...> dan bahasa Inggris, sesuai dokumen Google (diperiksa 28 Okt 2026). Belum diverifikasi: bahasa kolom gaya dan apakah halaman AI Studio memakai kolom yang sama.\n")
        return {**base, "status": "tag jeda dan ekspresi dari daftar resmi; bahasa kolom gaya belum diverifikasi", "style": style, "styleLong": style_long,
                "script": script, "tags": tags, "text": text}
    lines = []
    for p in parts:
        mid = round((p["low"] + p["high"]) / 2)
        lines.append(f"Bagian {p['no']} (sekitar {mid} detik)")
        lines.append(p["text"])
        lines.append("")
    body = "\n".join(lines).strip() + "\n"
    status = {"voicestudio": "teks biasa: tanpa tag",
              "elevenlabs": "teks biasa dengan tanda baca; tag jeda Eleven v3 belum diverifikasi, tidak dipakai"}[target]
    return {**base, "status": status, "style": None, "styleLong": None, "script": None, "settings": None, "model": None, "tags": [], "text": head + "\n\n" + body}


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

{_options_text(options_of(p))}

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

- `bible`: 1 (this story follows the channel's musts, so klipian checks them strictly); `theme`: one of cream, sky, mint, peach (optional, see the channel rules); `music`: `{{"track": "bed-sunny" | "bed-bounce" | "bed-glow" | "bed-curious" | "bed-calm" | "bed-tech" | "none"}}`: the track of the options, or the one that fits the fact (cheerful beds for most videos); `question`: the hook (a question or a surprising statement, about 3 seconds); `titles`: exactly 3; `duration`: {d}; `beats`: the beats; `claims`: the claims with `text`, `beats` (ids) and `sources` (URLs);
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
- Keep the options of this video: loop {'yes' if options_of(p)['loop'] else 'no'}, Intip yuk! {'yes' if options_of(p)['sting'] else 'no'}, music {MUSIC_TRACKS[options_of(p)['music']]}, voice apps {voice_apps_text(options_of(p)['voiceTargets'])}.
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


def build_fix_message(errors: list[dict], kind: str = "main", options: dict | None = None) -> str:
    """What to paste back to the AI when its answer was not accepted: every problem with where it is."""
    lines = []
    for e in errors:
        where = f"`{e['path']}`: " if e.get("path") else ""
        lines.append(f"- {where}{e['message']}")
    what = ("only the replaced beats and the full claims list, as before" if kind == "revise" else "the whole JSON story")
    keep = ""
    if options is not None:                                  # the options stay as the person chose them
        keep = (f"\n\nThe options of this video stay as they are: loop {'yes' if options['loop'] else 'no'}, Intip yuk! {'yes' if options['sting'] else 'no'}, "
                f"music {MUSIC_TRACKS[options['music']]}, voice apps {voice_apps_text(options['voiceTargets'])}.")
    return ("klipian could not accept your answer. These are the problems, with where each one is:\n\n"
            + "\n".join(lines)
            + f"\n\nPlease fix them and reply with {what} again: a single JSON block, plain JSON only (no code, comments or trailing commas), "
              "and nothing outside the block. Change only what is needed; keep everything else exactly as it was." + keep)


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


def _preview_state(pid: str, story) -> dict | None:
    pv = load(pid).get("preview")
    if not isinstance(pv, dict) or not preview_file(pid):
        return None
    current = render_story(pid) if story is not None else None
    return {**pv, "url": f"/api/motion/preview-file?id={pid}&v={pv.get('storyHash')}", "stale": bool(current) and pv.get("storyHash") != _story_hash(current)}


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
    v = voice_info(pid) or {}
    if v.get("aligned") and not v.get("lengthOk") and v.get("lengthChoice") != "continue":
        problems = problems + [f"The narration makes the video {v['total']:.1f} s, {v['table']['percent']:+.0f}% from the {v['target']} s chosen: edit the narration, or choose to continue at its length."]
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


def _run_preview_video(pid: str, key, ev: threading.Event) -> None:
    try:
        p = load(pid)
        story = render_story(pid)
        eta = Eta(RENDER_RATIO * float(story["duration"]) * PREVIEW_RATIO)
        t0 = time.monotonic()
        job = {"mode": "video", "story": str(story_file(pid)), "out": "preview.mp4", "outRoot": str(project_dir(pid) / "out"), "composition": composition_id(p), "preview": True}
        if voice_file(pid) and story_file(pid).name == "story.voiced.json":
            job["voice"] = str(voice_file(pid))

        def on_line(d):
            t = d.get("type")
            if t == "progress" and d.get("stage") == "render":
                frac = min(0.97, float(d.get("pct") or 0) / 100 * 0.96 + 0.01)
                _set(key, percent=int(frac * 100), eta=_round(eta.update(time.monotonic() - t0, frac)), stage="rendering", message="Membuat pratinjau…")
            elif t == "progress" and d.get("stage") == "browser":
                _set(key, stage="preparing", message="Menyiapkan…")
            elif t == "audio":
                _set(key, percent=99, stage="sound", eta=None, message="Menambah suara…")

        done = _run_job(pid, key, ev, "Membuat pratinjau…", job, on_line)
        if done is None:
            return _finish(key, pid, state="cancelled", message="Dibatalkan.", percent=0, eta=None)
        made = Path(done.get("out") or (project_dir(pid) / "out" / "preview.mp4"))
        if not made.is_file():
            raise MotionError("render", "The preview finished but the file is missing.")
        seconds = round(time.monotonic() - t0, 1)
        p = load(pid)
        p["preview"] = {"file": "preview.mp4", "at": int(time.time()), "seconds": seconds, "duration": story["duration"], "storyHash": _story_hash(story)}
        save(p)
        _finish(key, pid, state="done", percent=100, eta=None, stage="", message=f"Pratinjau siap ({seconds:.0f} detik).", seconds=seconds)
    except MotionError as exc:
        _finish(key, pid, state="failed", message=exc.message, code=exc.code, eta=None)
    except BaseException as exc:                              # noqa: BLE001
        _finish(key, pid, state="failed", message=f"The preview failed ({type(exc).__name__}).", code="other", eta=None)


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
            p["render"] = {"kind": kind_of(p), "composition": p.get("composition") or "", "file": name, "rowId": row_id, "at": int(time.time()), "seconds": round(time.monotonic() - t0, 1),
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
