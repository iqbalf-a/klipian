"""The upload schedule (workspace/schedule/clips.json): one row per clip, edited
on the /workspace dashboard, and filled in here when a Result finishes rendering.

A render makes a Draft row for its Result -- title, file, the source credit, and
the post text (caption, hashtags, credit) ready to paste -- and rendering the
same Result again updates THAT row instead of adding another. What was typed
into the dashboard is never overwritten: a text column is only filled while it is
empty; the file name is always the newest render's.
"""

from __future__ import annotations

import json
import threading
import time
import uuid
from pathlib import Path

from .paths import WORKSPACE

CLIPS_PATH = WORKSPACE / "schedule" / "clips.json"

# clips.json has its own lock rather than sharing the jobs LOCK. That one is
# taken several times per SECOND while a transcription reports progress, so
# putting a file read-modify-write behind it made a /workspace dashboard edit
# block every render/transcribe progress update, and vice versa. Two unrelated
# resources, two locks.
CLIPS_LOCK = threading.Lock()


def load_clips(path: Path | None = None) -> list[dict]:
    """One file for all clips -- unlike projects (one file per video) because
    this is a flat list viewed across videos at once, like a spreadsheet.
    Missing or corrupt files return an empty list, not an error -- a dashboard
    that's never been used must not fail to load."""
    path = path or CLIPS_PATH
    if not path.is_file():
        return []
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        return data.get("clip", []) if isinstance(data, dict) else []
    except (OSError, ValueError):
        return []


def save_clips(clips: list[dict], path: Path | None = None) -> None:
    """Write to a temporary file then rename, same as project -- a process
    that dies mid-write must not corrupt clips.json."""
    path = path or CLIPS_PATH
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps({"clip": clips}, ensure_ascii=False, indent=2),
                   encoding="utf-8")
    tmp.replace(path)


def description(post: dict | None, credit_lines: str = "") -> str:
    """The block pasted under an upload: caption, hashtags and the source credit,
    each only if there is one, with a blank line between. The Render screen's
    "Copy description" builds the same text (post.js, postDescription)."""
    p = post or {}
    return "\n\n".join(x for x in (
        (p.get("caption") or "").strip(),
        " ".join(p.get("hashtags") or []),
        (credit_lines or "").strip()) if x)


def upsert_render(*, project_id: str, result_id: str, title: str, file_name: str,
                  post: dict | None, credit_lines: str,
                  path: Path | None = None, lock: threading.Lock | None = None) -> tuple[str, bool]:
    """Make or update the schedule row of a finished render. Returns (row id,
    whether the row is new). Rows are found by project id + result id."""
    block = description(post, credit_lines)
    wanted = {
        "title": ((post or {}).get("title") or title or "").strip(),
        # One line: the dashboard's cell for it is a single-line field.
        "episode": " / ".join(l for l in (credit_lines or "").splitlines() if l.strip()),
        "description": block,
        "tiktokCaption": block,
    }
    with (lock or CLIPS_LOCK):
        clips = load_clips(path)
        row = next((c for c in clips if c.get("projectId") == project_id
                    and c.get("resultId") == result_id), None)
        created = row is None
        if created:
            row = {"id": uuid.uuid4().hex[:8], "status": "Draft", "platform": "YouTube + TikTok",
                   "projectId": project_id, "resultId": result_id}
            clips.append(row)
        row["file"] = file_name                       # always the newest render
        for key, value in wanted.items():
            if value and not (row.get(key) or "").strip():
                row[key] = value
        row["at"] = int(time.time())
        save_clips(clips, path)
        return row["id"], created
