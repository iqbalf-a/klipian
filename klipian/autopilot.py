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
