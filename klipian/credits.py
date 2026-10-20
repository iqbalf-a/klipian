"""Where a source video came from: platform, creator, title and link, kept per
video file in workspace/sources/credits.json.

It is the person's own data, not a cache (nothing rebuilds it), so it lives with
the videos. The credit LINE that goes under a post is built here, from those
fields -- never written by Claude -- so no name or link in a post is one that
somebody made up:

    Sumber: YouTube Raditya Dika — "Apa Kabar Syahrini" (https://...)

A credit is attribution, not permission to reuse the video.
"""

from __future__ import annotations

import json
import os
from pathlib import Path

from .paths import SOURCES

FIELDS = ("platform", "creator", "title", "url")
_LIMITS = {"platform": 40, "creator": 80, "title": 200, "url": 500}


def credits_file(folder: Path | None = None) -> Path:
    return (folder or SOURCES) / "credits.json"


def clean(entry) -> dict:
    """A credit as stored: only the four fields, trimmed and cut to length, and
    a link only if it is http(s). Empty fields are left out of the result."""
    out = {}
    if not isinstance(entry, dict):
        return out
    for key in FIELDS:
        val = entry.get(key)
        if not isinstance(val, str):
            continue
        val = " ".join(val.split())[:_LIMITS[key]]
        if key == "url" and val and not val.lower().startswith(("http://", "https://")):
            continue
        if val:
            out[key] = val
    return out


def load(folder: Path | None = None) -> dict[str, dict]:
    """{file name: credit}, for the files that are still in the folder."""
    folder = folder or SOURCES
    try:
        data = json.loads(credits_file(folder).read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}
    if not isinstance(data, dict):
        return {}
    out = {}
    for name, entry in data.items():
        credit = clean(entry)
        if credit and isinstance(name, str) and (folder / name).is_file():
            out[name] = credit
    return out


def save(name: str, entry, folder: Path | None = None) -> dict[str, dict]:
    """Set (or, with nothing in it, remove) the credit of one video, and drop
    the credits of videos that are no longer in the folder. Written to a temp
    file and renamed, like every other file the server writes."""
    folder = folder or SOURCES
    credits = load(folder)
    credit = clean(entry)
    if credit:
        credits[name] = credit
    else:
        credits.pop(name, None)
    dest = credits_file(folder)
    if credits:
        folder.mkdir(parents=True, exist_ok=True)
        tmp = dest.with_suffix(".tmp")
        tmp.write_text(json.dumps(credits, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
        os.replace(tmp, dest)
    else:
        dest.unlink(missing_ok=True)
    return credits


def line(credit: dict | None) -> str:
    """The credit line under a post: `Sumber: YouTube Raditya Dika — "Title" (url)`.
    Empty when there is nothing to say."""
    c = clean(credit)
    who = " ".join(x for x in (c.get("platform"), c.get("creator")) if x)
    text = who
    if c.get("title"):
        text += f' — "{c["title"]}"' if who else f'"{c["title"]}"'
    if c.get("url"):
        text += f' ({c["url"]})' if text else c["url"]
    return f"Sumber: {text}" if text else ""


def short(credit: dict | None) -> str:
    """The small label for the video itself: `Sumber: YouTube · Raditya Dika`."""
    c = clean(credit)
    who = " · ".join(x for x in (c.get("platform"), c.get("creator")) if x)
    return f"Sumber: {who}" if who else ""


def for_videos(names, folder: Path | None = None) -> list[dict]:
    """The credits of these videos, in order, each once."""
    credits = load(folder)
    seen, out = set(), []
    for name in names:
        c = credits.get(name)
        key = json.dumps(c, sort_keys=True) if c else None
        if c and key not in seen:
            seen.add(key)
            out.append(c)
    return out


def lines(names, folder: Path | None = None) -> str:
    """One credit line per distinct credit, for a Result made of these videos."""
    seen, out = set(), []
    for c in for_videos(names, folder):
        text = line(c)
        if text and text not in seen:
            seen.add(text)
            out.append(text)
    return "\n".join(out)


def brief_source(credit: dict | None) -> str:
    """How the brief names the source for Claude: `YouTube · Raditya Dika · "Title"`."""
    c = clean(credit)
    parts = [c[k] for k in ("platform", "creator") if k in c]
    if "title" in c:
        parts.append(f'"{c["title"]}"')
    return " · ".join(parts)
