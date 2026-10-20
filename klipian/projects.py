"""Projects: the JSON files in workspace/projects/, their shape, and how an
older shape is brought up to the current one.

Before this, klipian saved nothing: reload the page and all Results,
framing points, and text corrections vanished. A project saves them as one
JSON file, alongside cache/ and out/ -- not in localStorage, so they survive
browser clearing and can be viewed and backed up as regular files.

Nothing here knows about HTTP or ffmpeg; server.py and the render jobs both
build on it."""

from __future__ import annotations

import json
import re
import threading
import time
import uuid
from pathlib import Path

from .paths import OUT_ROOT, PROJECTS_DIR

# Projects are NOT served as static files. Their contents can only be
# accessed via /api/project so file names don't become an attack surface.
PROJECTS = PROJECTS_DIR
# Serialises every write into PROJECTS, so two requests (an autosave and a
# migrate-on-read, say) never write the same file at once.
# Re-entrant: the POST handler holds it while it calls helpers that take it too.
PROJECTS_LOCK = threading.RLock()


def _slug(text: str) -> str:
    """A filename-safe, readable stub for a project name."""
    keep = [c if (c.isalnum() or c in "-_") else "-" for c in (text or "").strip().lower()]
    out = "".join(keep)
    while "--" in out:
        out = out.replace("--", "-")
    return out.strip("-")[:48] or "project"


# The id every existing span and candidate is migrated onto, and the id of
# the one asset a single-source project has. Short and stable rather than
# random: it appears in every span of every project file, and a readable
# constant is worth more there than uniqueness nothing depends on.
FIRST_ASSET = "a1"


def _new_project_id() -> str:
    """Short, random, and nothing to do with the video.

    The whole point of the id is that it does NOT come from the content:
    a name derived from the video's size and mtime breaks the moment it is
    re-encoded or restored from a backup -- same footage, new fingerprint,
    and the project is orphaned with a second card beside it for the same
    video. An id minted once and stored in the file can't drift like that."""
    return uuid.uuid4().hex[:12]


def _valid_project_id(pid) -> bool:
    """Ids become FILE NAMES (<id>.json), so only what _new_project_id()
    produces is accepted: lowercase hex, nothing that can carry a path."""
    return (isinstance(pid, str) and 6 <= len(pid) <= 32
            and all(c in "0123456789abcdef" for c in pid))


def _project_id(data: dict) -> str:
    """The id of a project dict, minting one if it predates ids."""
    pid = str(data.get("id") or "").strip()
    return pid if pid else _new_project_id()


def _primary_video(data: dict) -> str:
    """The project's first video -- what `video` used to hold. Read from
    `video` itself for a dict that hasn't been migrated yet."""
    for a in data.get("assets") or []:
        if isinstance(a, dict) and (a.get("kind") or "video") == "video" and a.get("file"):
            return a["file"]
    return data.get("video") or ""


def _project_out_dir(data: dict) -> Path:
    """Renders belong to the PROJECT, not to a video.

    They used to be grouped as out/<video-stem>/, which is the same thing
    only while a project holds exactly one video. A project with five
    episodes would scatter its renders across five folders named after
    videos, with nothing showing they belong together.

    The slug is the one stored at creation (`outSlug`), not the current
    name: renaming a project must not move a folder of files someone may
    have open in a player, or split one project's renders across two
    folders (ian's call on the plan's open question)."""
    slug = data.get("outSlug") or _slug(data.get("name") or Path(_primary_video(data)).stem)
    return OUT_ROOT / f"{slug}.{_project_id(data)}"


def _migrate_project(data: dict) -> tuple[dict, bool]:
    """Bring a project dict up to the current shape. Returns (data, changed).

    Reads both shapes and writes only the new one, the same approach used
    for the caption indices and for per-Result output.

    (`video` and each Result's `result` DO go now: they're rewritten as the
    first asset and `segments`.)

    This runs on READ **and** on write, which is what lets the shape move
    without the browser knowing yet: projectState() there builds its object
    from scratch and has never heard of assets, but anything it posts comes
    back through here and is completed before it reaches the disk.

    Only ever touches the dict, never the file's name (that is the id)."""
    changed = False
    if not _valid_project_id(data.get("id")):
        data["id"] = _new_project_id()
        changed = True
    if not data.get("name"):
        # What the home card showed before projects had names of their own.
        data["name"] = Path(_primary_video(data)).stem or "Untitled"
        changed = True
    if not data.get("outSlug"):
        # Fixed from here on -- see _project_out_dir(). Taken from the name
        # as it is NOW, which for every existing project is the name its
        # renders' folder was already created under.
        data["outSlug"] = _slug(data["name"])
        changed = True
    if not data.get("createdAt"):
        # No better record exists for an old project than `at`, the last
        # save; it at least orders the home cards sensibly.
        data["createdAt"] = int(data.get("at") or time.time())
        changed = True

    # A project holds a LIST of sources, not one. A file from before that
    # has a single `video`: the list is built from it, and then `video`
    # itself goes -- the project no longer has "a" video, its first asset
    # is just the first of several (_primary_video reads it from there).
    video = data.get("video") or ""
    if not isinstance(data.get("assets"), list) or not data["assets"]:
        data["assets"] = ([{"id": FIRST_ASSET, "kind": "video", "file": video}]
                          if video else [])
        changed = True
    if "video" in data:
        del data["video"]
        changed = True

    # The oldest shape of all: one flat result/framing/corrections/title at
    # the top level, from before a project could hold several Results.
    if not isinstance(data.get("results"), list) and any(
            k in data for k in ("result", "framing", "corrections")):
        data["results"] = [{
            "id": "res1", "title": data.pop("title", "") or "",
            "segments": data.pop("result", None) or [],
            "framing": data.pop("framing", None) or [],
            "corrections": data.pop("corrections", None) or {},
        }]
        data.setdefault("activeResult", "res1")
        changed = True

    # A Result's spans are its `segments` (the plan's name: each is a
    # segment of some asset, in play order). `result` was the name while a
    # Result could only be cut from one video.
    for res in data.get("results") or []:
        if isinstance(res, dict) and "result" in res:
            old = res.pop("result")
            if not isinstance(res.get("segments"), list):
                res["segments"] = old if isinstance(old, list) else []
            changed = True

    # Which source a span came from. There has only ever been one, so
    # everything on disk belongs to the first asset. `source` next to it is
    # NOT this -- that one records whether a span came from the AI or was
    # drawn by hand, and keeps doing so.
    first = data["assets"][0]["id"] if data["assets"] else FIRST_ASSET
    for res in data.get("results") or []:
        for span in (res.get("segments") if isinstance(res, dict) else None) or []:
            if isinstance(span, dict) and not span.get("asset"):
                span["asset"] = first
                changed = True
    # A hook belongs to the video it was found in, for the same reason.
    for cand in data.get("candidates") or []:
        if isinstance(cand, dict) and not cand.get("asset"):
            cand["asset"] = first
            changed = True

    return data, changed


def _project_file(pid) -> Path | None:
    """PROJECTS/<id>.json, or None for anything that isn't an id."""
    return PROJECTS / f"{pid}.json" if _valid_project_id(pid) else None


def _project_assets_dir(pid) -> Path | None:
    """A project's own images and sounds: PROJECTS/<id>/assets/ (ian: assets
    belong to the project). Videos are NOT here -- they stay in sources/,
    one copy however many projects use them, and a project only lists
    which ones it uses."""
    return PROJECTS / pid / "assets" if _valid_project_id(pid) else None


def _free_name(folder: Path, name: str) -> Path:
    """`name` in `folder`, or name-2, name-3 ... if taken -- an upload never
    replaces a file a timeline element may already point at."""
    dest = folder / name
    stem, ext = Path(name).stem, Path(name).suffix
    i = 2
    while dest.exists():
        dest = folder / f"{stem}-{i}{ext}"
        i += 1
    return dest


def _write_project(f: Path, data: dict) -> None:
    """Temp file then rename: if the process dies mid-write, the old
    project stays intact, not half-written."""
    tmp = f.with_suffix(".tmp")
    tmp.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
    tmp.replace(f)


def _read_project(f: Path) -> dict | None:
    try:
        data = json.loads(f.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None
    return data if isinstance(data, dict) else None


def _all_projects() -> list[tuple[Path, dict]]:
    """Every readable id-named project, as (file, data)."""
    out = []
    for f in PROJECTS.glob("*.json"):
        if not _valid_project_id(f.stem):
            continue
        data = _read_project(f)
        if data is not None:
            out.append((f, data))
    return out


def _active_result(data: dict) -> dict:
    """The part of a project containing the active result/framing/title --
    new format (one project can have multiple saved Results, see
    SAVED_RESULTS/`results`+`activeResult` in projects.js) or old format
    (flat result/framing/title at top level, from before that feature
    existed). Old projects that haven't been reopened since this feature
    was added must still display correctly on the home card, not just
    newer projects."""
    results = data.get("results")
    if isinstance(results, list) and results:
        active = data.get("activeResult")
        for r in results:
            if isinstance(r, dict) and r.get("id") == active:
                return r
        first = results[0]
        return first if isinstance(first, dict) else {}
    return data


def _span_video(data: dict, span: dict) -> str:
    """The video file a stored span belongs to (its `asset`), falling back
    to the project's first video for a span from before assets."""
    aid = span.get("asset")
    for a in data.get("assets") or []:
        if isinstance(a, dict) and a.get("id") == aid and a.get("file"):
            return a["file"]
    return _primary_video(data)


def _project_summary(file: Path) -> dict | None:
    """Compact form for the homepage listing -- doesn't load the full
    contents.

    The entire body is wrapped in try/except: project files can be
    hand-edited or from older versions, so a non-numeric field or
    non-dict shape must not crash the entire homepage listing. Corrupted
    entries are silently skipped (return None)."""
    try:
        data = json.loads(file.read_text(encoding="utf-8"))
        st = file.stat()
        if not isinstance(data, dict):
            return None
        active = _active_result(data)
        # `segments` now; `result` in a file not rewritten since the rename.
        spans = active.get("segments") or active.get("result") or []
        total = sum(max(0.0, float(r.get("end", 0)) - float(r.get("start", 0)))
                    for r in spans if isinstance(r, dict))
        framing = active.get("framing") or [{}]
        first_frame = framing[0] if isinstance(framing[0], dict) else {}
        video = _primary_video(data)
        return {
            # The project's first video: the card's "is it still there"
            # check and the Home screen's missing marker read this.
            "video": video,
            # Identity of its own. The home card can show a name ian chose
            # and when the project was started, neither of which the video
            # filename could ever tell it.
            "id": data.get("id", ""),
            "name": data.get("name", "") or Path(video).stem,
            "createdAt": int(data.get("createdAt") or st.st_mtime),
            "title": active.get("title", ""),
            "spans": len(spans),
            "seconds": round(total, 1),
            "at": int(st.st_mtime),
            "thumbAt": float(spans[0]["start"]) if spans and isinstance(spans[0], dict) else 0.0,
            # The first span's own video: in a project with several, the
            # cover frame has to come from the file thumbAt is a second of.
            "thumbVideo": _span_video(data, spans[0]) if spans and isinstance(spans[0], dict)
                          else video,
            # Thumbnail uses the project's own framing box. If the default
            # box were used, two projects from the same video would look
            # identical even though their frames are very different.
            "crop": ((first_frame.get("crops") or [None])[0]),
            # The Result's Output Format as saved (one entry per option, see
            # OPTIONS in app.js): the card composes its cover the way the render
            # will, from the picture, background and position in there.
            "output": active.get("output") if isinstance(active.get("output"), list) else None,
        }
    except (OSError, ValueError, TypeError, KeyError, IndexError):
        return None


# What the last finished render of each Result was made from: the request the
# editor sent, and what came out. PROJECTS/<id>/renders/<result id>.json.
# Kept with the project (not in out/, which the dashboard lists as renders) so
# `klipian render --replay` can run the same request again and compare.

def render_record_file(pid, result_id) -> Path | None:
    if not _valid_project_id(pid) or not re.fullmatch(r"[A-Za-z0-9_-]{1,40}", str(result_id or "")):
        return None
    return PROJECTS / pid / "renders" / f"{result_id}.json"


def write_render_record(pid, result_id, record: dict) -> bool:
    f = render_record_file(pid, result_id)
    if f is None:
        return False
    f.parent.mkdir(parents=True, exist_ok=True)
    _write_project(f, record)
    return True


def read_render_records(pid, result_id=None) -> dict[str, dict]:
    """{result id: record} for a project -- one Result's, or all of them."""
    folder = PROJECTS / pid / "renders" if _valid_project_id(pid) else None
    if folder is None or not folder.is_dir():
        return {}
    files = ([render_record_file(pid, result_id)] if result_id
             else sorted(folder.glob("*.json")))
    out = {}
    for f in files:
        rec = _read_project(f) if f and f.is_file() else None
        if rec:
            out[f.stem] = rec
    return out
