"""Where a clip's hashtags go on YouTube: in the title, in the description, or both.

YouTube makes hashtags clickable in the title and in the description; the first three
description hashtags are shown above the title, more than 60 make YouTube ignore all of
them, and a hashtag has no spaces (support.google.com/youtube/answer/6390658). A Short's
title usually carries its hashtags, so the profile chooses (settings: hashtagPlacement
"title" | "description" | "both", addShorts, titleTags 2 | 3), and the choice is applied when
a clip is UPLOADED, not when the row is stored: a row keeps its hashtag list (`hashtags`)
and its description as written.

ui/js/shared/hashtags.js is the same logic for the preview in the browser; the selftest runs
both on the same cases and requires the same answers. Change one, change the other.
"""

from __future__ import annotations

import re

TITLE_MAX = 100
MAX_TAGS = 15
PLACEMENTS = ("title", "description", "both")
DEFAULT_SETTINGS = {"placement": "title", "shorts": False, "titleTags": 3}

_ONLY_TAGS = re.compile(r"(?:#\w+[\s,]*)+")


def norm_tag(tag) -> str:
    """lowercase, only letters, digits and underscore, no '#': "" when nothing is left."""
    t = str(tag or "").strip().lstrip("#").lower()
    return "".join(c for c in t if c.isalnum() or c == "_")


def norm_tags(tags, cap: int = MAX_TAGS) -> list[str]:
    """The tags normalised, without empties or duplicates, at most `cap` of them, in order."""
    out: list[str] = []
    for t in tags or []:
        n = norm_tag(t)
        if n and n not in out:
            out.append(n)
        if len(out) >= cap:
            break
    return out


def _is_tag_line(line: str) -> bool:
    return bool(line.strip()) and bool(_ONLY_TAGS.fullmatch(line.strip()))


def split_description(description: str) -> tuple[list[str], str]:
    """(the hashtags that stand alone on their own lines, the description without those lines
    and with the blank lines collapsed)."""
    tags: list[str] = []
    kept: list[str] = []
    for line in str(description or "").splitlines():
        if _is_tag_line(line):
            tags += re.findall(r"#(\w+)", line)
        else:
            kept.append(line)
    text = re.sub(r"\n{3,}", "\n\n", "\n".join(l.rstrip() for l in kept)).strip()
    return tags, text


def settings_of(raw: dict | None) -> dict:
    raw = raw or {}
    placement = raw.get("placement") if raw.get("placement") in PLACEMENTS else DEFAULT_SETTINGS["placement"]
    return {"placement": placement, "shorts": bool(raw.get("shorts")),
            "titleTags": 2 if raw.get("titleTags") == 2 else 3}


def plan(title: str, description: str, hashtags, settings: dict | None = None) -> dict:
    """What goes to YouTube: {title, description, tags}.

    `hashtags` is the row's list (None for an old row: they are then read back out of the
    description, from the lines that hold only hashtags)."""
    s = settings_of(settings)
    title = " ".join(str(title or "").split())
    description = str(description or "")
    own, without = split_description(description)
    tags = norm_tags(hashtags if hashtags else own)
    api_tags = list(tags) + (["shorts"] if s["shorts"] and "shorts" not in tags else [])
    if s["placement"] == "description":
        return {"title": title, "description": description, "tags": api_tags}
    present = {norm_tag(t) for t in re.findall(r"#(\w+)", title)}
    chosen = tags[:s["titleTags"]] + (["shorts"] if s["shorts"] else [])
    final = title
    for t in chosen:
        if t in present:
            continue
        if len(final) + 1 + len(t) + 1 > TITLE_MAX:
            break                                   # in order: a later (less important) tag never jumps ahead
        final += f" #{t}"
        present.add(t)
    return {"title": final, "description": description if s["placement"] == "both" else without,
            "tags": api_tags}
