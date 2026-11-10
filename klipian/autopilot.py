"""Autopilot: the named TEMPLATES every profile can pick (workspace/autopilot.json, made on the Admin page) and the
schedule slots a run's clips are put on.

A template holds the format (picture, background, angle intro, caption style), AI Framing, the upload hours,
how many days after the start the clips go out, automatic upload on/off and the download quality. There is
always a "Default" template (it can be changed and reset, never deleted). A profile keeps the id of its template
in profile.json (`autopilotTemplate`, default "Default"); a run copies the template's values when it starts.

Phase 1 holds only these two. The run engine (link -> download -> transcribe -> clips -> render -> schedule)
comes later and calls `profile_template()` and `assign_slots()`.
"""

from __future__ import annotations

import copy
import json
import os
import random
import re
import uuid
from datetime import date, datetime, timedelta
from pathlib import Path

from . import paths

PICTURES = ("9:16", "3:4", "16:9")                    # the editor's Output Format choices
BACKGROUNDS = ("blur", "black")
INTRO_STYLES = ("dark", "light")                      # the editor's label box: dark = white text on black
QUALITIES = (720, 1080, 1440, 2160)
MAX_HOURS = 12
MAX_DAYS = 30
MAX_CLIPS = 10
DEFAULT_ID = "default"

DEFAULT_TEMPLATE = {
    "name": "Default",
    "format": {"picture": "3:4", "background": "blur", "angleIntro": True, "introStyle": "dark", "introSeconds": 2.5,
               "captionStyle": {}},                   # {} = klipian's own caption look (the project's caption options by id)
    "framing": True,
    "maxClips": 4,                                   # the brief says "at most <maxClips>; fewer is fine"
    "schedule": {"hours": ["11:00", "18:00"], "days": 1, "autoUpload": True},
    "quality": 1080,
}


def _file() -> Path:
    return Path(paths.WORKSPACE) / "autopilot.json"


def _hour(text) -> str:
    m = re.fullmatch(r"(\d{1,2}):(\d{2})", str(text).strip())
    if not m or int(m[1]) > 23 or int(m[2]) > 59:
        raise ValueError(f"{text!r} is not a time of day (HH:MM)")
    return f"{int(m[1]):02d}:{m[2]}"


def clean_template(raw: dict, base: dict | None = None) -> dict:
    """A full template: `base` (the defaults when none) with what `raw` changes. Anything nobody can use raises
    ValueError (a message for the person)."""
    raw = raw if isinstance(raw, dict) else {}
    out = copy.deepcopy(base or DEFAULT_TEMPLATE)
    if "name" in raw:
        name = re.sub(r"\s+", " ", str(raw["name"] or "")).strip()[:40]
        if not name:
            raise ValueError("A template needs a name")
        out["name"] = name
    f = raw.get("format") if isinstance(raw.get("format"), dict) else {}
    for key, allowed, label in (("picture", PICTURES, "Picture"), ("background", BACKGROUNDS, "Background"),
                                ("introStyle", INTRO_STYLES, "Intro style")):
        if key in f:
            if f[key] not in allowed:
                raise ValueError(f"{label} must be one of {', '.join(allowed)}")
            out["format"][key] = f[key]
    if "angleIntro" in f:
        out["format"]["angleIntro"] = bool(f["angleIntro"])
    if "introSeconds" in f:
        sec = f["introSeconds"]
        if isinstance(sec, bool) or not isinstance(sec, (int, float)) or not 0.5 <= sec <= 10:
            raise ValueError("The intro lasts between 0.5 and 10 seconds")
        out["format"]["introSeconds"] = float(sec)
    if "captionStyle" in f:
        cs = f["captionStyle"]
        if not isinstance(cs, dict) or len(json.dumps(cs)) > 2000:
            raise ValueError("The caption style is not valid")
        out["format"]["captionStyle"] = cs
    if "framing" in raw:
        out["framing"] = bool(raw["framing"])
    if "maxClips" in raw:
        n = raw["maxClips"]
        if isinstance(n, bool) or not isinstance(n, int) or not 1 <= n <= MAX_CLIPS:
            raise ValueError(f"The most clips of a run is a whole number from 1 to {MAX_CLIPS}")
        out["maxClips"] = n
    s = raw.get("schedule") if isinstance(raw.get("schedule"), dict) else {}
    if "hours" in s:
        if not isinstance(s["hours"], list):
            raise ValueError("The upload times must be a list")
        hours = sorted({_hour(h) for h in s["hours"]})
        if not hours:
            raise ValueError("Keep at least one upload time")
        if len(hours) > MAX_HOURS:
            raise ValueError(f"At most {MAX_HOURS} upload times")
        out["schedule"]["hours"] = hours
    if "days" in s:
        d = s["days"]
        if isinstance(d, bool) or not isinstance(d, int) or not 0 <= d <= MAX_DAYS:
            raise ValueError(f"Days after the start must be a whole number from 0 to {MAX_DAYS}")
        out["schedule"]["days"] = d
    if "autoUpload" in s:
        out["schedule"]["autoUpload"] = bool(s["autoUpload"])
    if "quality" in raw:
        if raw["quality"] not in QUALITIES:
            raise ValueError(f"Download quality must be one of {', '.join(map(str, QUALITIES))}")
        out["quality"] = raw["quality"]
    return out


# --------------------------------------------------------------------------
# the templates (workspace/autopilot.json: {"templates": {id: template}}, "default" first)
# --------------------------------------------------------------------------

def _load() -> dict:
    try:
        data = json.loads(_file().read_text(encoding="utf-8"))
    except (OSError, ValueError):
        data = {}
    raw = data.get("templates") if isinstance(data, dict) and isinstance(data.get("templates"), dict) else {}
    out = {}
    for tid, t in raw.items():
        try:
            out[tid] = clean_template(t, {**copy.deepcopy(DEFAULT_TEMPLATE), "name": str(t.get("name") or tid)[:40]})
        except (ValueError, AttributeError):                  # a hand-edited template with a bad value: skip it
            continue
    out.setdefault(DEFAULT_ID, copy.deepcopy(DEFAULT_TEMPLATE))
    out[DEFAULT_ID]["name"] = "Default"
    return {DEFAULT_ID: out.pop(DEFAULT_ID), **out}


def _save(templates: dict) -> None:
    f = _file()
    f.parent.mkdir(parents=True, exist_ok=True)
    tmp = f.with_suffix(".tmp")
    tmp.write_text(json.dumps({"templates": templates}, indent=1, ensure_ascii=False), encoding="utf-8")
    os.replace(tmp, f)


def list_templates() -> list[dict]:
    return [{"id": tid, **t} for tid, t in _load().items()]


def template_exists(tid) -> bool:
    return isinstance(tid, str) and tid in _load()


def get_template(tid) -> dict:
    """The template with this id, else the Default (a template that was deleted)."""
    all_ = _load()
    return copy.deepcopy(all_.get(tid) or all_[DEFAULT_ID])


def _free_name(templates: dict, name: str, own: str | None = None) -> None:
    if any(t["name"].lower() == name.lower() and tid != own for tid, t in templates.items()):
        raise ValueError(f"There is a template called {name} already")


def create_template(name: str, copy_of: str | None = None) -> dict:
    """A new template: the defaults, or a copy of `copy_of` (Duplicate)."""
    all_ = _load()
    if copy_of is not None and copy_of not in all_:
        raise ValueError("That template does not exist")
    base = all_[copy_of] if copy_of else DEFAULT_TEMPLATE
    new = clean_template({"name": name}, base)
    _free_name(all_, new["name"])
    stem = re.sub(r"[^a-z0-9]+", "-", new["name"].lower()).strip("-")[:24] or "template"
    tid = stem if stem not in all_ else f"{stem}-{uuid.uuid4().hex[:4]}"
    all_[tid] = new
    _save(all_)
    return {"id": tid, **new}


def save_template(tid: str, raw: dict) -> dict:
    """Change a template (what `raw` names; a new name renames it). The Default keeps its name."""
    all_ = _load()
    if tid not in all_:
        raise ValueError("That template does not exist")
    if tid == DEFAULT_ID and "name" in (raw or {}):
        raw = {k: v for k, v in raw.items() if k != "name"}
    new = clean_template(raw, all_[tid])
    _free_name(all_, new["name"], tid)
    all_[tid] = new
    _save(all_)
    return {"id": tid, **new}


def reset_template(tid: str) -> dict:
    if tid != DEFAULT_ID:
        raise ValueError("Only the Default template can be reset")
    all_ = _load()
    all_[DEFAULT_ID] = copy.deepcopy(DEFAULT_TEMPLATE)
    _save(all_)
    return {"id": DEFAULT_ID, **all_[DEFAULT_ID]}


def delete_template(tid: str) -> list[str]:
    """Delete a template; the profiles that used it go back to the Default. Returns their ids."""
    from . import profiles
    if tid == DEFAULT_ID:
        raise ValueError("The Default template cannot be deleted")
    all_ = _load()
    if tid not in all_:
        raise ValueError("That template does not exist")
    moved = [p["id"] for p in profiles.list_profiles() if p.get("template") == tid]
    for pid in moved:
        profiles.update(pid, {"template": DEFAULT_ID})
    del all_[tid]
    _save(all_)
    return moved


def summary(t: dict) -> str:
    """One line for a template: "3:4 · blur · 11:00, 18:00 · Start +1 · up to 4 clips"."""
    f, s = t["format"], t["schedule"]
    return " · ".join([f["picture"], f["background"] if f["picture"] != "9:16" else "full frame", ", ".join(s["hours"]),
                       f"Start +{s['days']}", f"up to {t['maxClips']} clips"] + ([] if s["autoUpload"] else ["no auto upload"]))


def profile_template(pid: str) -> dict:
    """The template a profile uses now (a run copies it when it starts)."""
    from . import profiles
    meta = profiles.read_meta(pid) or {}
    return get_template(meta.get("template") or DEFAULT_ID)


# --------------------------------------------------------------------------
# schedule slots: `days` after the start, split over the template's hours
# --------------------------------------------------------------------------

def _at(day: date, hour: str) -> datetime:
    return datetime(day.year, day.month, day.day, int(hour[:2]), int(hour[3:]))


def run_slots(start: date, hours: list[str], count: int, days: int = 1, now: datetime | None = None,
              rng=None) -> list[tuple[str, str]]:
    """(YYYY-MM-DD, HH:MM) for each of `count` clips of one run: all on the day `days` after `start`, split evenly
    over `hours` (counts differ by at most 1; the hours that get the extra clip are random), in random order.
    With `now`, a slot that is not after it moves to the next hour of the list, and past the last hour to the
    first hour of the next day (N = 0, or a run that finishes late). Pure: the clock and the Clips play no part."""
    hours = sorted({_hour(h) for h in hours})
    if not hours or count <= 0:
        return []
    rng = rng or random
    base, extra = divmod(count, len(hours))
    more = set(rng.sample(range(len(hours)), extra))
    slots = [(start + timedelta(days=days), h) for k, h in enumerate(hours) for _ in range(base + (k in more))]
    if now is not None:
        slots = [_not_past(d, h, hours, now) for d, h in slots]
    rng.shuffle(slots)
    return [(d.isoformat(), h) for d, h in slots]


def _not_past(day: date, hour: str, hours: list[str], now: datetime) -> tuple[date, str]:
    k = hours.index(hour)
    while _at(day, hours[k]) <= now:
        k += 1
        if k == len(hours):
            day, k = day + timedelta(days=1), 0
    return day, hours[k]


def assign_slots(clip_ids: list, start: date, hours: list[str], days: int = 1, now: datetime | None = None, rng=None) -> list[dict]:
    """[{id, date, time}], the clips in random order each on a slot of run_slots."""
    ids = list(clip_ids)
    (rng or random).shuffle(ids)
    return [{"id": i, "date": d, "time": h} for i, (d, h) in zip(ids, run_slots(start, hours, len(ids), days, now, rng))]


# --------------------------------------------------------------------------
# a Result, built on the server from a clip candidate (what the editor builds for the same candidate)
# --------------------------------------------------------------------------

# the editor's Output Format, in SAVED order (app.js OPTIONS; renderreq._OUT_*): picture, resolution, quality, background, position
_PICTURE_AT = {"9:16": 0, "16:9": 1, "3:4": 2}
_BACKGROUND_AT = {"blur": 0, "black": 1}
_RESOLUTION_DEFAULT, _QUALITY_DEFAULT, _POSITION_DEFAULT = 1, 1, 50      # 1080p, Balanced, centred
INTRO_SECONDS = 2.5                                                      # angleintro.js ANGLE_INTRO_SECONDS
_BOX_LOOKS = {"light": "#111111", "dark": "#FFFFFF"}                      # angleintro.js BOX_LOOKS: the text colour of each box


def _round2(n: float) -> float:
    return round(n * 100 + 1e-9) / 100


def intro_overlay(text: str, total: float, seconds: float, style: str, overlay_id: str = "o1") -> dict | None:
    """angleintro.js withAngleIntro() on an empty list: the label the Intro & notes panel's Add button makes."""
    text = str(text or "").strip()
    if not text or not total > 0:
        return None
    return {"id": overlay_id, "kind": "text", "text": text, "x": 50, "y": 16, "size": 72, "color": _BOX_LOOKS.get(style, "#FFFFFF"),
            "box": True, "boxStyle": style if style in _BOX_LOOKS else "dark", "start": 0, "end": _round2(min(total, seconds)),
            "origin": "angle-intro"}


def build_result(cand: dict, template: dict, result_id: str, asset: str = "a1") -> dict:
    """The project's Result for one clip candidate under a template: what the editor makes with "Each as its own
    Result" (result.js, post.js carryPostFrom, angle.js carryAngleFrom) and the Output Format of the template.
    Raises ValueError for a candidate with no usable time."""
    start, end = cand.get("startSec"), cand.get("endSec")
    if not all(isinstance(x, (int, float)) and not isinstance(x, bool) for x in (start, end)) or end - start < 0.5:
        raise ValueError(f"The clip {cand.get('title') or ''!r} has no usable time points")
    fmt = template["format"]
    picture = fmt["picture"]
    background = None if picture == "9:16" else _BACKGROUND_AT[fmt["background"]]
    entry = {"id": result_id, "title": "",
             "segments": [{"id": "r1", "asset": asset, "start": start, "end": end,
                           "title": cand.get("title") or "Clip 1", "source": "ai"}],
             "framing": [], "corrections": {},
             "output": [_PICTURE_AT[picture], _RESOLUTION_DEFAULT, _QUALITY_DEFAULT, background, _POSITION_DEFAULT]}
    hook = " ".join(str(cand.get("hook") or "").split())
    if hook:                                                 # the clip's own line (an exact quote): the render and the Clips row carry it to the thumbnail text
        entry["hook"] = hook
    from . import thumbnail
    ai_thumb = thumbnail.clean_thumb(cand.get("thumb"))      # the AI's own thumbnail text
    if ai_thumb:
        entry["thumb"] = ai_thumb
    post = cand.get("post")
    if isinstance(post, dict):
        p = {"title": str(post.get("title") or "").strip(), "caption": str(post.get("caption") or "").strip(),
             "hashtags": [str(h) for h in post.get("hashtags") or []]}
        if p["title"] or p["caption"] or p["hashtags"]:
            entry["post"] = p
    angle = cand.get("angle")
    if isinstance(angle, dict):
        a = {"take": str(angle.get("take") or "").strip(), "intro": str(angle.get("intro") or "").strip(),
             "notes": [dict(n) for n in angle.get("notes") or []]}
        if a["take"] or a["intro"] or a["notes"]:
            seconds, style = float(fmt["introSeconds"]), fmt["introStyle"]
            if fmt["angleIntro"]:
                label = intro_overlay(a["intro"], end - start, seconds, style)
                if label:
                    entry["overlays"] = [label]
            if seconds != INTRO_SECONDS:                    # written only when it differs from the default, as angle.js does
                a["introSeconds"] = seconds
            if style != "dark":
                a["boxStyle"] = style
            entry["angle"] = a
    return entry


# --------------------------------------------------------------------------
# the runs (workspace/profiles/<p>/autopilot/runs.json): a queue of links, one active run per profile
# --------------------------------------------------------------------------

import contextvars
import threading
import time
from datetime import datetime

AI_MODES = ("manual", "claude", "gemini")
STEPS = ("download", "transcribe", "project", "clips", "results", "framing", "render", "schedule")
STEP_LABELS = {"download": "Download", "transcribe": "Transcribe", "project": "Project", "clips": "Choosing clips",
               "results": "Making Results", "framing": "AI Framing", "render": "Render", "schedule": "Schedule"}
ACTIVE = ("queued", "running", "waiting")                     # states of a run that is not over
_LOCK = threading.RLock()
_WORKERS: dict[str, threading.Thread] = {}
_CANCEL: set[str] = set()


class RunError(Exception):
    """A step that failed in a way to tell the person (the run can be retried from this step)."""


class _Waiting(Exception):
    """The run needs the person (the AI's reply in Manual mode)."""


class _Finished(Exception):
    """The run ends here, successfully, with a note (no clip worth posting)."""


class _Cancelled(Exception):
    pass


def _runs_file() -> Path:
    return paths.profile_dir() / "autopilot" / "runs.json"


def load_runs() -> list[dict]:
    try:
        data = json.loads(_runs_file().read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return []
    return [r for r in data.get("runs", []) if isinstance(r, dict)] if isinstance(data, dict) else []


def _save_runs(runs: list[dict]) -> None:
    f = _runs_file()
    f.parent.mkdir(parents=True, exist_ok=True)
    tmp = f.with_suffix(".tmp")
    tmp.write_text(json.dumps({"runs": runs}, ensure_ascii=False, indent=1), encoding="utf-8")
    os.replace(tmp, f)


def get_run(rid: str) -> dict | None:
    return next((r for r in load_runs() if r.get("id") == rid), None)


def update_run(rid: str, **fields) -> dict | None:
    with _LOCK:
        runs = load_runs()
        run = next((r for r in runs if r.get("id") == rid), None)
        if run is None:
            return None
        run.update(fields)
        run["updatedAt"] = int(time.time())
        _save_runs(runs)
        return dict(run)


MAX_NOTES, NOTE_CHARS = 20, 300


def run_notes(run: dict) -> list[str]:
    """The notes of a run, whole: a list (an older run kept one string in `note`)."""
    if isinstance(run.get("notes"), list):
        return [str(n) for n in run["notes"]]
    return [run["note"]] if run.get("note") else []


def _with_notes(run: dict, new: list[str], keep: bool = True) -> list[str]:
    old = run_notes(run) if keep else []
    out = old + [n for n in (str(x).strip() for x in new) if n and n not in old]
    return [n[:NOTE_CHARS] for n in out][:MAX_NOTES]


def first_undone(run: dict) -> str:
    return next((s for s in STEPS if s not in (run.get("done") or [])), "")


def is_stalled(run: dict) -> bool:
    """A run that says it is going (running or queued) while no worker of this profile is alive in this process."""
    if run.get("state") not in ("running", "queued"):
        return False
    t = _WORKERS.get(paths.current_profile())
    return t is None or not t.is_alive()


def public_run(run: dict) -> dict:
    """What the page gets: no template copy, no candidates (long), no reply text."""
    out = {k: v for k, v in run.items() if k not in ("template", "candidates", "reply", "brief", "note")}
    out["hasBrief"] = bool(run.get("brief"))
    out["template"] = {"name": (run.get("template") or {}).get("name", "")}
    out["notes"] = run_notes(run)
    out["stalled"] = is_stalled(run)
    return out


def profile_settings(pid: str | None = None) -> dict:
    from . import profiles
    meta = profiles.read_meta(pid or paths.current_profile()) or {}
    tid = meta.get("template") or DEFAULT_ID
    return {"ai": meta.get("ai") or "manual", "template": tid if template_exists(tid) else DEFAULT_ID}


def start_runs(urls: list[str], deps, now: datetime | None = None) -> list[dict]:
    """Queue one run per link (a link that has a run in progress already is skipped). The template of the profile
    is copied into the run NOW: a later edit applies to the next run only."""
    now = now or datetime.now()
    prof = profile_settings()
    template = profile_template(paths.current_profile())
    made = []
    with _LOCK:
        runs = load_runs()
        busy = {r.get("videoId") for r in runs if r.get("state") in ACTIVE}
        for url in urls:
            vid = deps.video_id(url)                        # raises RunError for something that is not a YouTube video link
            if vid in busy:
                continue
            busy.add(vid)
            run = {"id": uuid.uuid4().hex[:8], "url": str(url).strip(), "videoId": vid, "title": "", "state": "queued", "step": "",
                   "progress": 0, "detail": "", "error": "", "notes": [], "done": [], "ai": prof["ai"], "template": template,
                   "startedAt": now.isoformat(timespec="seconds"), "createdAt": int(time.time()), "profile": paths.current_profile()}
            runs.append(run)
            made.append(run)
        _save_runs(runs)
    if made:
        kick(deps)
    return [public_run(r) for r in made]


def kick(deps) -> None:
    """Start this profile's worker if it is not running: it does the queued runs one after another."""
    pid = paths.current_profile()
    with _LOCK:
        t = _WORKERS.get(pid)
        if t is not None and t.is_alive():
            return
        t = threading.Thread(target=contextvars.copy_context().run, args=(_work, deps), daemon=True)
        _WORKERS[pid] = t
        t.start()


def wait_idle(timeout: float = 60) -> bool:
    """For the tests: the worker of this profile has finished."""
    t = _WORKERS.get(paths.current_profile())
    if t is not None:
        t.join(timeout)
    return t is None or not t.is_alive()


def _work(deps) -> None:
    while True:
        with _LOCK:
            run = next((r for r in load_runs() if r.get("state") == "queued"), None)
            if run is None:
                return
            update_run(run["id"], state="running", error="")
        try:
            _execute(run["id"], deps)
        except Exception as exc:                            # noqa: BLE001  (a bug must end this run, never the worker)
            now = get_run(run["id"]) or {}
            update_run(run["id"], state="failed", stoppedAt=now.get("step") or first_undone(now), error=f"Unexpected problem: {type(exc).__name__}: {exc}")


def _execute(rid: str, deps) -> None:
    for step in STEPS:
        run = get_run(rid)
        if run is None or step in run["done"]:
            continue
        if rid in _CANCEL:
            _CANCEL.discard(rid)
            update_run(rid, state="cancelled", detail="", step=step, stoppedAt=step)     # stopped between two steps: this one did not start
            return
        update_run(rid, step=step, progress=0, detail="")
        try:
            fields = STEP_FUNCS[step](rid, run, deps) or {}
        except _Waiting:
            update_run(rid, state="waiting", detail="Waiting for the AI's reply")
            return
        except _Finished as done:
            update_run(rid, state="done", step="", progress=100, detail="", notes=_with_notes(run, [str(done)]), done=list(STEPS))
            return
        except _Cancelled:
            _CANCEL.discard(rid)
            update_run(rid, state="cancelled", detail="", stoppedAt=step)
            return
        except (RunError, ValueError, OSError) as exc:
            update_run(rid, state="failed", stoppedAt=step, error=str(exc) or type(exc).__name__)
            return
        update_run(rid, done=run["done"] + [step], progress=100, **fields)
    update_run(rid, state="done", step="", detail="", progress=100)


def _progress(rid: str):
    """A callback (percent, text) for a step; it also stops the step when the run was cancelled."""
    def report(percent: float | None = None, text: str = "") -> None:
        if rid in _CANCEL:
            raise _Cancelled()
        fields = {"detail": text}
        if percent is not None:
            fields["progress"] = max(0, min(100, int(percent)))
        update_run(rid, **fields)
    return report


# --- the steps: each gets (run id, the run as it was when the step began, deps) and returns the fields to keep ---

def _step_download(rid, run, deps):
    info = deps.preview(run["url"], run["template"]["quality"])
    update_run(rid, title=info.get("title") or run["title"], duration=info.get("duration"))
    name = deps.download(run["url"], run["template"]["quality"], _progress(rid))
    return {"file": name, "title": info.get("title") or name}


def _step_transcribe(rid, run, deps):
    deps.transcribe(run["file"], _progress(rid))


def _step_project(rid, run, deps):
    return {"project": deps.make_project(run["file"], run["title"], run["url"])}


def merge_touching(cands: list[dict], max_sec: float | None = None, gap: float = 2.0) -> tuple[list[dict], list[str]]:
    """One story that the AI cut in two (neighbouring clips, less than `gap` s apart or overlapping) becomes one clip when
    the whole is at most `max_sec` (roundtrip.CLIP_MAX_SEC). The first clip keeps its title, hook, post and scores; the end,
    the end quote and the cues come from the last. Returns (clips in the AI's order, notes: merges and clips under CLIP_MIN_SEC)."""
    from . import roundtrip as rt
    cap = rt.CLIP_MAX_SEC if max_sec is None else max_sec
    order = sorted(range(len(cands)), key=lambda i: cands[i]["startSec"])
    out: list[tuple[int, dict]] = []
    merged = 0
    for i in order:
        c = cands[i]
        if out:
            at, last = out[-1]
            if c["startSec"] - last["endSec"] < gap and max(c["endSec"], last["endSec"]) - last["startSec"] <= cap:
                end = max(c["endSec"], last["endSec"])
                nxt = dict(last, endSec=end, out=rt.fmt_stamp(end), dur=round(end - last["startSec"]), spans=[{"start": last["startSec"], "end": end}])
                if c["endSec"] >= last["endSec"]:
                    nxt.pop("endQuote", None)
                    if c.get("endQuote"):
                        nxt["endQuote"] = c["endQuote"]
                if "cues" in last or "cues" in c:
                    nxt["cues"] = (last.get("cues") or []) + (c.get("cues") or [])
                out[-1] = (min(at, i), nxt)
                merged += 1
                continue
        out.append((i, c))
    notes = []
    if merged:
        notes.append(f"{merged} neighbouring clip{'s' if merged != 1 else ''} of one story {'were' if merged != 1 else 'was'} merged.")
    result = [c for _, c in sorted(out, key=lambda x: x[0])]
    short = sum(1 for c in result if c["endSec"] - c["startSec"] < rt.CLIP_MIN_SEC)
    if short:
        notes.append(f"{short} clip{'s are' if short != 1 else ' is'} under {rt.CLIP_MIN_SEC} s.")
    return result, notes


def cap_length(cands: list[dict], ends: list[float], max_sec: float | None = None) -> tuple[list[dict], list[str]]:
    """No clip longer than `max_sec` (roundtrip.CLIP_MAX_SEC): a longer one ends at the last sentence end (`ends`, the
    transcript's segment ends) that is at most start + max_sec; without one, exactly there. Nobody shortens a clip
    by hand in Autopilot, whatever the AI wrote. The end quote goes; spans and cues are cut at the new end.
    Returns (clips in the same order, a note per cut clip)."""
    from . import roundtrip as rt
    cap = rt.CLIP_MAX_SEC if max_sec is None else max_sec
    out, notes = [], []
    for c in cands:
        if c["endSec"] - c["startSec"] <= cap + 1e-6:
            out.append(c)
            continue
        limit = c["startSec"] + cap
        fits = [e for e in ends if c["startSec"] < e <= limit]
        end = max(fits) if fits else limit
        cut = dict(c, endSec=end, out=rt.fmt_stamp(end), dur=round(end - c["startSec"]))
        cut.pop("endQuote", None)
        cut["spans"] = [{"start": s["start"], "end": min(s["end"], end)} for s in c.get("spans") or [] if s["start"] < end] or [{"start": c["startSec"], "end": end}]
        if "cues" in c:
            cut["cues"] = [dict(q, end=min(q["end"], end)) for q in c["cues"] if q["start"] < end]
        out.append(cut)
        notes.append(f"Clip \"{c.get('title', '')}\" was {rt.fmt_stamp(c['endSec'] - c['startSec'])}, cut to {rt.fmt_stamp(end - c['startSec'])}"
                     + (" at the end of a sentence." if fits else " (no sentence end fits)."))
    return out, notes


def _step_clips(rid, run, deps):
    most = run["template"]["maxClips"]
    if run.get("candidates") is not None:
        return {}
    if run["ai"] == "manual":
        if not run.get("reply"):
            update_run(rid, brief=deps.brief(run["file"], most))
            raise _Waiting()
        found, notes = deps.candidates_from_reply(run["file"], run["reply"])
    elif run["ai"] == "claude":
        found, notes = deps.ask_claude(run["file"], most, run["project"], _progress(rid))
    else:
        found, notes, usage = deps.ask_gemini(run["file"], most, run["project"], _progress(rid))
        update_run(rid, ai_usage=usage)
    found, merge_notes = merge_touching(list(found))
    found, cap_notes = cap_length(found, deps.sentence_ends(run["file"]))
    found, notes = found[:most], list(notes or []) + merge_notes + cap_notes
    if not found:
        update_run(rid, candidates=[])
        raise _Finished("No topic in this video was worth a clip.")
    return {"candidates": found, "notes": _with_notes(run, notes, keep=False), "brief": "", "reply": ""}


def _step_results(rid, run, deps):
    pdata = deps.read_project(run["project"])
    # a run that was run again keeps the Results it made before (they may be scheduled): the new ones come after them
    keep = list(pdata.get("results") or []) if run.get("previousResults") else []
    top = max([int(m.group(1)) for r in keep if (m := re.fullmatch(r"res(\d+)", str(r.get("id"))))] + [0])
    results = [build_result(c, run["template"], f"res{top + i}") for i, c in enumerate(run["candidates"], 1)]
    pdata["results"], pdata["activeResult"] = keep + results, results[0]["id"]
    pdata["candidates"] = run["candidates"]
    if run["template"]["format"]["captionStyle"]:
        pdata["caption"] = run["template"]["format"]["captionStyle"]
    deps.write_project(run["project"], pdata)
    return {"results": [{"id": r["id"], "title": r["segments"][0]["title"], "start": r["segments"][0]["start"],
                         "end": r["segments"][0]["end"]} for r in results]}


def _step_framing(rid, run, deps):
    if not run["template"]["framing"]:
        return {}
    report, notes = _progress(rid), []
    for i, r in enumerate(run["results"]):
        n = len(run["results"])
        report(100 * i / n, f"AI Framing {i + 1} of {n}")
        try:
            deps.ai_framing(run["project"], r["id"], lambda f, text, i=i: report(100 * (i + f) / n, f"AI Framing {i + 1} of {n} · {text}"))
        except _Cancelled:
            raise
        except Exception as exc:                            # noqa: BLE001  (a clip without it is rendered with the default framing)
            notes.append(f"{r['title']}: {exc}")
    return {"framingNotes": notes[:5]} if notes else {}


def _rows_of(run: dict) -> dict[str, dict]:
    from . import schedule
    rows = [c for c in schedule.load_clips() if c.get("projectId") == run["project"]]
    return {c["resultId"]: c for c in rows if c.get("resultId")}


def _step_render(rid, run, deps):
    ids = [r["id"] for r in run["results"]]
    deps.render(run["project"], ids, _progress(rid))
    rows = _rows_of(run)
    missing = [r["title"] for r in run["results"] if r["id"] not in rows]
    if missing:
        raise RunError("These clips were not rendered: " + ", ".join(missing) + ". Retry renders them again.")
    return {"rows": {i: rows[i]["id"] for i in ids}}


def _step_schedule(rid, run, deps):
    from . import schedule
    rows = [run["rows"][r["id"]] for r in run["results"]]
    tpl = run["template"]
    slots = run.get("slots")
    if not slots:                                           # decided once: a retry keeps what was given
        started = datetime.fromisoformat(run["startedAt"])
        given = assign_slots(rows, started.date(), tpl["schedule"]["hours"], tpl["schedule"]["days"], datetime.now())
        slots = {g["id"]: {"date": g["date"], "time": g["time"]} for g in given}
        schedule.set_schedules([{"id": i, "date": s["date"], "time": s["time"]} for i, s in slots.items()])
        schedule.bulk_update(rows, "Ready")
        update_run(rid, slots=slots)
    update_run(rid, results=[{**r, **slots.get(run["rows"][r["id"]], {})} for r in run["results"]])
    if not tpl["schedule"]["autoUpload"]:
        return {"notes": _with_notes(run, ["Auto upload is off: the clips wait at Ready in Clips."])}
    pending = [i for i in rows if not (schedule.get_row(i) or {}).get("videoId")]
    if pending:
        failed = deps.upload(pending, _progress(rid))
        if failed:
            raise RunError("Not uploaded: " + "; ".join(f"{t}: {m}" for t, m in failed[:3]) + ". Retry uploads the rest.")
    return {}


STEP_FUNCS = {"download": _step_download, "transcribe": _step_transcribe, "project": _step_project, "clips": _step_clips,
              "results": _step_results, "framing": _step_framing, "render": _step_render, "schedule": _step_schedule}


def reply(rid: str, text: str, deps) -> dict:
    """Manual mode: the AI's reply pasted by the person; the run goes on from "Choosing clips"."""
    run = get_run(rid)
    if run is None or run["state"] != "waiting":
        raise RunError("That run is not waiting for a reply.")
    if not str(text or "").strip():
        raise RunError("Paste the AI's reply first.")
    try:
        deps.candidates_from_reply(run["file"], text)      # refuse a reply that cannot be read before the run goes on
    except ValueError as exc:
        raise RunError(str(exc)) from None
    update_run(rid, reply=str(text), state="queued", error="")
    kick(deps)
    return public_run(get_run(rid))


def retry(rid: str, deps) -> dict:
    run = get_run(rid)
    if run is None or not (run["state"] in ("failed", "cancelled") or is_stalled(run)):
        raise RunError("Only a failed, cancelled or stalled run can be retried.")
    _CANCEL.discard(rid)
    update_run(rid, state="queued", error="", stoppedAt="")
    kick(deps)
    return public_run(get_run(rid))


def cancel(rid: str) -> dict:
    run = get_run(rid)
    if run is None:
        raise RunError("That run does not exist.")
    if is_stalled(run):                                     # nobody is working on it: there is nothing to stop, only to mark
        update_run(rid, state="cancelled", detail="", stoppedAt=run.get("step") or first_undone(run))
    elif run["state"] == "running":
        _CANCEL.add(rid)                                    # the step in progress stops at its next report
        update_run(rid, detail="Cancelling…")
    elif run["state"] in ("queued", "waiting"):
        update_run(rid, state="cancelled", detail="", stoppedAt=first_undone(run))
    return public_run(get_run(rid))


RERUN_FROM = ("clips", "framing", "render", "schedule")
# what each step made, and every later step with it: a run again from a step empties these
_RERUN_CLEARS = {
    "clips": {"candidates": None, "brief": "", "reply": "", "ai_usage": None, "notes": [], "results": [], "framingNotes": [], "rows": {}, "slots": {}},
    "framing": {"framingNotes": [], "rows": {}, "slots": {}},
    "render": {"rows": {}, "slots": {}},
    "schedule": {"slots": {}},
}


def uploaded_clips(run: dict) -> list[dict]:
    """The clips of a run that are on YouTube already: [{title, date, time}] (a run again leaves them there)."""
    from . import schedule
    out = []
    for r in run.get("results") or []:
        row_id = (run.get("rows") or {}).get(r["id"])
        row = schedule.get_row(row_id) if row_id else None
        if row and row.get("videoId"):
            out.append({"title": r.get("title", ""), "date": row.get("date", ""), "time": row.get("time", "")})
    return out


def rerun_info(rid: str, deps) -> dict:
    """What the Run again dialog needs: which AI modes are ready (with the reason), and the clips already on YouTube."""
    run = get_run(rid)
    if run is None:
        raise RunError("That run does not exist.")
    ai = {m: {k: c.get(k, "") for k in ("ok", "detail", "fix", "link")} for m in AI_MODES for c in [deps.ai_check(m)]}
    return {"ai": ai, "current": run["ai"], "uploaded": uploaded_clips(run), "canRerun": not isOpen(run),
            "hasResults": "results" in run.get("done", []) and bool(run.get("results"))}


def isOpen(run: dict) -> bool:
    return run.get("state") in ("queued", "running", "waiting") and not is_stalled(run)


def rerun(rid: str, from_step: str, ai: str, deps, now: datetime | None = None) -> dict:
    """Run a run that is not going again from `from_step`, with `ai` for the clip choice. The Results made before stay
    in the project and on YouTube; new ones are added next to them, and the new slots count from now."""
    now = now or datetime.now()
    run = get_run(rid)
    if run is None:
        raise RunError("That run does not exist.")
    if isOpen(run):
        raise RunError("This run is still going: Cancel it first.")
    if from_step not in RERUN_FROM:
        raise RunError("Run again from Choosing clips, AI Framing, Render or Schedule.")
    ai = ai or run["ai"]
    if ai not in AI_MODES:
        raise RunError("Choose Manual, Claude API or Gemini API.")
    if from_step != "clips" and not ("results" in run.get("done", []) and run.get("results")):
        raise RunError("This run has no clips yet: run it again from Choosing clips.")
    if from_step == "clips" and not run.get("project") and "project" in run.get("done", []):
        raise RunError("This run has no project.")
    need = deps.ai_check(ai)
    if from_step == "clips" and not need["ok"]:
        raise RunError(f"{need['label']}: {need['detail']} {need.get('fix', '')}".strip())
    cut = STEPS.index(from_step)
    fields = dict(_RERUN_CLEARS[from_step])
    if from_step == "clips":
        fields["ai"] = ai
        fields["previousResults"] = list(run.get("previousResults") or []) + [r["id"] for r in run.get("results") or []]
    fields.update(
        done=[s for s in run.get("done", []) if STEPS.index(s) < cut], state="queued", error="", stoppedAt="", step="", progress=0, detail="",
        startedAt=now.isoformat(timespec="seconds"),
        history=list(run.get("history") or []) + [{"at": now.isoformat(timespec="seconds"), "fromStep": from_step, "ai": [run["ai"], fields.get("ai", run["ai"])],
                                                    "clips": len(run.get("results") or [])}])
    _CANCEL.discard(rid)
    update_run(rid, **fields)
    kick(deps)
    return public_run(get_run(rid))


def clear_finished() -> int:
    """Take the finished runs (done and cancelled) off the list. Only runs.json: the projects, renders and schedule stay."""
    with _LOCK:
        runs = load_runs()
        keep = [r for r in runs if r.get("state") not in ("done", "cancelled")]
        if len(keep) != len(runs):
            _save_runs(keep)
        return len(runs) - len(keep)


def resume_all(make_deps) -> None:
    """At server start: a run that was going when the server stopped goes back to the queue and carries on
    (it resumes at its step). `make_deps` builds the deps; this runs once per profile that has such a run."""
    from . import profiles
    for meta in profiles.list_profiles():
        token = paths.set_profile(meta["id"])
        try:
            with _LOCK:
                runs = load_runs()
                for r in runs:
                    if r.get("state") == "running":
                        r["state"] = "queued"
                if runs:
                    _save_runs(runs)
            if any(r.get("state") == "queued" for r in runs):
                kick(make_deps())
        finally:
            paths._profile.reset(token)


# --------------------------------------------------------------------------
# Check: what a run needs, before Start
# --------------------------------------------------------------------------

def check(urls: list[str], deps) -> dict:
    """[{key, ok, label, detail, fix}] for the links and what the run needs; ok when every item is ok."""
    prof, tpl = profile_settings(), profile_template(paths.current_profile())
    items = []
    for url in urls:
        try:
            deps.video_id(url)
            info = deps.preview(url, tpl["quality"])
            secs = info.get("duration")
            items.append({"key": "link", "ok": True, "label": info.get("title") or url,
                          "detail": f"{int(secs // 3600)}:{int(secs % 3600 // 60):02d}:{int(secs % 60):02d}" if isinstance(secs, (int, float)) else ""})
        except RunError as exc:
            items.append({"key": "link", "ok": False, "label": url, "detail": str(exc)})
    if not urls:
        items.append({"key": "link", "ok": False, "label": "No link yet", "detail": "Paste a YouTube link first."})
    if tpl["schedule"]["autoUpload"]:
        items += deps.youtube_checks()
    items.append(deps.ai_check(prof["ai"]))
    return {"ok": all(i["ok"] for i in items), "items": items}
