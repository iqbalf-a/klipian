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


def project_of_folder(folder_name: str) -> str | None:
    """The project id at the end of an out/ folder name (<slug>.<projectId>), or None
    for a folder from before projects had ids."""
    tail = str(folder_name).rsplit(".", 1)[-1] if "." in str(folder_name) else ""
    return tail if len(tail) == 12 and all(c in "0123456789abcdef" for c in tail) else None


def file_exists(project_id: str | None, file_name: str | None) -> bool:
    return file_created(project_id, file_name) is not None


def with_missing_flags(clips: list[dict]) -> list[dict]:
    """The rows for the dashboard, each with `fileMissing: true` when its render file
    is no longer in the project's folder in out/. Derived every time and NEVER
    written to clips.json. A row with no file or no project has nothing to compare."""
    out = []
    for row in clips:
        row = dict(row)
        row.pop("fileMissing", None)
        if row.get("projectId") and row.get("file") and not file_exists(row["projectId"], row["file"]):
            row["fileMissing"] = True
        out.append(row)
    return out


def scheduled_files(clips: list[dict] | None = None) -> tuple[set, set]:
    """What the schedule already points at: {(projectId, file)} and, for rows with no
    project, {file}."""
    pairs, loose = set(), set()
    for row in (clips if clips is not None else load_clips()):
        if not row.get("file"):
            continue
        if row.get("projectId"):
            pairs.add((row["projectId"], row["file"]))
        else:
            loose.add(row["file"])
    return pairs, loose


def add_file_row(title: str, file_name: str, project_id: str | None,
                 path: Path | None = None, lock: threading.Lock | None = None) -> tuple[str, bool]:
    """A Draft row for a render file that has none (named after the file). Never a
    second row for a file the schedule already has."""
    with (lock or CLIPS_LOCK):
        clips = load_clips(path)
        for row in clips:
            if row.get("file") == file_name and (row.get("projectId") == project_id or not row.get("projectId")):
                return row["id"], False
        row = {"id": uuid.uuid4().hex[:8], "status": "Draft", "platform": "YouTube + TikTok",
               "title": title, "file": file_name, "at": int(time.time()),
               "createdAt": file_created(project_id, file_name) or int(time.time())}
        if project_id:
            row["projectId"] = project_id
        clips.append(row)
        save_clips(clips, path)
        return row["id"], True


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


TRASH_PATH = WORKSPACE / "schedule" / "clips.trash.json"
TRASH_KEEP = 200


def _load_trash(path: Path) -> list[dict]:
    if not path.is_file():
        return []
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        return data.get("row", []) if isinstance(data, dict) else []
    except (OSError, ValueError):
        return []


def _save_trash(rows: list[dict], path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps({"row": rows[-TRASH_KEEP:]}, ensure_ascii=False, indent=2), encoding="utf-8")
    tmp.replace(path)


def delete_rows(ids: list, path: Path | None = None, lock: threading.Lock | None = None,
                trash: Path | None = None) -> list[str]:
    """Delete rows in ONE save, and keep each deleted row (all its columns, and where
    it stood) in clips.trash.json, so a delete can be undone -- from the page's
    "Undo" now, or by hand later, even when the tab was closed. Returns the ids
    that were deleted."""
    wanted = {str(i) for i in ids}
    path = path or CLIPS_PATH
    trash = trash or (path.parent / "clips.trash.json")
    with (lock or CLIPS_LOCK):
        clips = load_clips(path)
        gone, kept = [], []
        for index, row in enumerate(clips):
            if str(row.get("id")) in wanted:
                gone.append({"row": row, "index": index, "deletedAt": int(time.time())})
            else:
                kept.append(row)
        if gone:
            _save_trash(_load_trash(trash) + gone, trash)        # first: a failure here deletes nothing
            save_clips(kept, path)
        return [g["row"]["id"] for g in gone]


def restore_rows(ids: list, path: Path | None = None, lock: threading.Lock | None = None,
                 trash: Path | None = None) -> list[dict]:
    """Put deleted rows back exactly as they were (every column, `createdAt`
    included) at the place they stood. A row whose id is back already is left
    alone. Returns the rows restored."""
    wanted = [str(i) for i in ids]
    path = path or CLIPS_PATH
    trash = trash or (path.parent / "clips.trash.json")
    with (lock or CLIPS_LOCK):
        clips = load_clips(path)
        bin_ = _load_trash(trash)
        have = {str(r.get("id")) for r in clips}
        back = []
        for rid in wanted:
            entry = next((e for e in reversed(bin_) if str(e["row"].get("id")) == rid), None)
            if entry is None:
                continue
            bin_.remove(entry)
            if rid in have:
                continue
            clips.insert(min(int(entry.get("index", len(clips))), len(clips)), entry["row"])
            have.add(rid)
            back.append(entry["row"])
        if back:
            save_clips(clips, path)
            _save_trash(bin_, trash)
        return back


STATUSES = ("Draft", "Ready", "Scheduled", "Posted", "Discarded")


def bulk_update(ids: list, status: str, date: str = "", time_: str = "",
                path: Path | None = None, lock: threading.Lock | None = None) -> dict:
    """Set the status of many rows in ONE save. When `date` is given it fills the
    upload date (and `time_`, the time) of those rows that have NO date yet: a row
    that already has one keeps both. Nothing else about a row changes -- `createdAt`
    in particular is kept. Raises ValueError for a status or date nobody can use.
    Returns {"clip": [the rows as saved], "dated": n, "kept": n (had a date), "missing": [ids]}."""
    import re
    if status not in STATUSES:
        raise ValueError(f"status must be one of {', '.join(STATUSES)}")
    if date and not re.fullmatch(r"\d{4}-\d{2}-\d{2}", date):
        raise ValueError("date must be YYYY-MM-DD")
    if time_ and not re.fullmatch(r"\d{2}:\d{2}", time_):
        raise ValueError("time must be HH:MM")
    wanted = {str(i) for i in ids}
    with (lock or CLIPS_LOCK):
        clips = load_clips(path)
        changed, dated, kept = [], 0, 0
        now = int(time.time())
        for row in clips:
            if str(row.get("id")) not in wanted:
                continue
            row["status"] = status
            if date:
                if (row.get("date") or "").strip():
                    kept += 1
                else:
                    row["date"] = date
                    if time_:
                        row["time"] = time_
                    dated += 1
            row["at"] = now
            changed.append(row)
        if changed:
            save_clips(clips, path)
        found = {str(r.get("id")) for r in changed}
        return {"clip": changed, "dated": dated, "kept": kept, "missing": sorted(wanted - found)}


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
