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
OUT_DIR = WORKSPACE / "out"

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


def file_created(project_id: str | None, file_name: str | None) -> int | None:
    """When the render file of a row was made (creation time of
    out/<slug>.<projectId>/<file>; the modified time where the system keeps no
    creation time). None when the row has no project or the file is gone.

    The row's own `at` is NOT a creation time -- it is overwritten on every save.
    """
    if not project_id or not file_name:
        return None
    try:
        for folder in OUT_DIR.glob(f"*.{project_id}"):
            f = folder / Path(file_name).name
            if f.is_file():
                st = f.stat()
                return int(getattr(st, "st_birthtime", None) or st.st_mtime)
    except OSError:
        pass
    return None


def created_of(row: dict) -> int:
    """The creation time a row without `createdAt` should get: its render file's,
    else the last time it was saved (`at`), else now."""
    return (file_created(row.get("projectId"), row.get("file"))
            or int(row.get("at") or 0) or int(time.time()))


def migrate_created(path: Path | None = None, lock: threading.Lock | None = None) -> tuple[int, int]:
    """Give every row that has no `createdAt` one (once; rows that have one are
    never touched). Only adds that column. Keeps a copy of the file as it was in
    clips.pre-created.json (written once). Returns (rows given the time of their
    file, rows given `at` or now)."""
    path = path or CLIPS_PATH
    with (lock or CLIPS_LOCK):
        clips = load_clips(path)
        from_file = from_at = 0
        for row in clips:
            if row.get("createdAt"):
                continue
            made = file_created(row.get("projectId"), row.get("file"))
            if made:
                from_file += 1
            else:
                from_at += 1
            row["createdAt"] = made or int(row.get("at") or 0) or int(time.time())
        if from_file or from_at:
            backup = path.with_name("clips.pre-created.json")
            if path.is_file() and not backup.exists():
                backup.write_bytes(path.read_bytes())
            save_clips(clips, path)
        return from_file, from_at


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
                   "projectId": project_id, "resultId": result_id,
                   # Stable: made once, never changed by edits or a render again.
                   "createdAt": file_created(project_id, file_name) or int(time.time())}
            clips.append(row)
        row["file"] = file_name                       # always the newest render
        for key, value in wanted.items():
            if value and not (row.get(key) or "").strip():
                row[key] = value
        row.setdefault("createdAt", created_of(row))   # a row from before the column
        row["at"] = int(time.time())
        save_clips(clips, path)
        return row["id"], created
