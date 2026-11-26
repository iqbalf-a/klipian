"""Project routes of the local server: the project list and history, project files and assets, saving, restoring, renaming (a mixin of server.Handler).
"""
from __future__ import annotations

import json
import mimetypes
import shutil
import time
from pathlib import Path
from urllib.parse import parse_qs, urlparse

from .cache import Cache
from . import compose as composer
from .schedule import scheduled_files as _scheduled_files, project_of_folder as _project_of_folder
from . import cues as cues_mod
from . import paths as _paths
from .paths import ASSETS, CACHE_DIR, OUT_ROOT, find_video
from .projects import (PROJECTS, PROJECTS_LOCK, _all_projects,
                       _free_name, _migrate_project, _new_project_id, _primary_video,
                       _project_assets_dir, _project_file, _project_summary,
                       _read_project, _write_project)


def _fill_candidate_cues(data: dict) -> None:
    """Give the suggestions a project already holds the `cues` they would have
    got on import (cues.for_range, the same rule), when they predate cues. Done
    as the project is read, in the response only: the file is not touched, and
    the editor writes them with its next real save. Only when the sound
    detection has run for that video: a list without the sounds would be
    stored as if it were complete."""
    cache = Cache(CACHE_DIR)
    files = {a.get("id"): a.get("file") for a in data.get("assets") or []
             if isinstance(a, dict) and (a.get("kind") or "video") == "video"}
    loaded: dict[str, dict | None] = {}
    for cand in data.get("candidates") or []:
        if not isinstance(cand, dict) or "cues" in cand:
            continue
        name = files.get(cand.get("asset")) or _primary_video(data)
        if name not in loaded:
            video = find_video(name) if name else None
            loaded[name] = cues_mod.load(video, cache) if video else None
        info = loaded[name]
        if not info or info["status"]["audio"] != "ok":
            continue
        try:
            start, end = float(cand["startSec"]), float(cand["endSec"])
        except (KeyError, TypeError, ValueError):
            continue
        cand["cues"] = cues_mod.for_range(info["cues"], start, end)


class ProjectRoutes:
    """Methods of Handler (server.py), moved here; Handler inherits them."""

    def _get_history(self):
        # History is read from the out/ folder contents, not session
        # memory: files that actually exist on disk are the honest
        # history, and persist across page reloads or server restarts.
        item = []
        for mp4 in OUT_ROOT.glob("*/*.mp4"):
            # Quick previews are not renders (they live in cache/previews/),
            # but the leading-underscore check also hides the _preview.mp4
            # files older builds left in out/ -- those used to appear in
            # History and on the workspace dashboard as real output.
            if mp4.name.startswith("_"):
                continue
            try:
                st = mp4.stat()
            except OSError:
                continue
            item.append({
                "file": mp4.name,
                "video": mp4.parent.name,
                "folder": str(mp4.parent),
                "url": f"/workspace/out/{mp4.parent.name}/{mp4.name}?profile={_paths.current_profile()}",
                "mb": round(st.st_size / 1048576, 1),
                "at": int(st.st_mtime),
                # When the file was made (the modified time where the system
                # keeps no creation time): what the dashboard's Created column shows.
                "created": int(getattr(st, "st_birthtime", None) or st.st_mtime),
            })
        item.sort(key=lambda x: x["created"], reverse=True)   # newest first
        # Which files the upload schedule has a row for (by project and file name).
        pairs, loose = _scheduled_files()
        for it in item:
            pid = _project_of_folder(it["video"])
            it["scheduled"] = (pid, it["file"]) in pairs or it["file"] in loose
        return self._send_json({"render": item})

    def _get_projects(self):
        # Listing for the homepage. Corrupted entries are silently
        # skipped: one bad file must not crash the entire listing.
        item = []
        for f, _ in _all_projects():
            r = _project_summary(f)
            # A project with no video left is still a project (ian).
            if r and r.get("id"):
                item.append(r)
        item.sort(key=lambda x: x["at"], reverse=True)
        return self._send_json({"project": item})

    def _get_project(self):
        # By id: what the editor holds once a project is open, and what
        # /edit/<id> carries.
        q = parse_qs(urlparse(self.path).query)
        pid = (q.get("id") or [""])[0]
        if not pid:
            return self._send_json({"error": "id required"}, 400)
        f = _project_file(pid)
        if not f or not f.is_file():
            return self._send_json({"error": "not found"}, 404)
        try:
            data = json.loads(f.read_text(encoding="utf-8"))
        except ValueError:
            return self._send_json({"error": "project file is corrupt"}, 500)
        # Migrating on READ, and writing back, means a project gains its
        # id the first time it is opened rather than the first time it
        # is saved -- so the id already exists for anything that asks
        # between opening and the next save (the render below does).
        data, changed = _migrate_project(data)
        # The file's name IS the id; a hand-edited `id` inside it can't
        # be allowed to point the browser at some other file.
        if data.get("id") != f.stem:
            data["id"] = f.stem
            changed = True
        if changed:
            try:
                with PROJECTS_LOCK:
                    _write_project(f, data)
            except OSError:
                # Best-effort: the request still answers with a migrated
                # dict even if the disk write fails, and the next save
                # will carry it.
                pass
        _fill_candidate_cues(data)
        return self._send_json(data)

    def _get_project_assets(self):
        # This project's own images and sounds (projects/<id>/assets/).
        folder = _project_assets_dir((parse_qs(urlparse(self.path).query).get("id") or [""])[0])
        if folder is None:
            return self._send_json({"error": "invalid id"}, 400)
        item = []
        if folder.is_dir():
            for f in sorted(folder.iterdir()):
                ext = f.suffix.lower()
                if f.is_file() and ext in (composer.IMAGE_EXT | composer.SOUND_EXT):
                    item.append({"name": f.name,
                                 "kind": "image" if ext in composer.IMAGE_EXT else "sound",
                                 "kb": round(f.stat().st_size / 1024, 1)})
        return self._send_json({"asset": item})

    def _get_project_asset_file(self):
        # One of them, for the editor's preview. By name only; .name
        # strips any path a caller put in it.
        q = parse_qs(urlparse(self.path).query)
        folder = _project_assets_dir((q.get("id") or [""])[0])
        name = Path((q.get("name") or [""])[0]).name
        f = folder / name if folder is not None and name else None
        if not f or f.suffix.lower() not in (composer.IMAGE_EXT | composer.SOUND_EXT) or not f.is_file():
            return self._send_json({"error": "not found"}, 404)
        return self._send_file(f, mimetypes.guess_type(f.name)[0] or "application/octet-stream")

    def _post_project_restore(self):
        """Undo deleting a project: the newest copy in projects/.trash/ comes back."""
        try:
            req = self._read_json()
        except Exception as exc:               # noqa: BLE001
            return self._send_json({"error": str(exc)}, 400)
        f = _project_file(req.get("id"))
        if f is None:
            return self._send_json({"error": "invalid id"}, 400)
        with PROJECTS_LOCK:
            copies = sorted((PROJECTS / ".trash").glob(f"{f.stem}.*.json"), key=lambda p: p.stat().st_mtime) \
                if (PROJECTS / ".trash").is_dir() else []
            if f.is_file():
                return self._send_json({"ok": True, "restored": False})
            if not copies:
                return self._send_json({"error": "nothing to restore"}, 404)
            shutil.copy2(copies[-1], f)
            copies[-1].unlink(missing_ok=True)
        return self._send_json({"ok": True, "restored": True})

    def _post_project(self):
        try:
            req = self._read_json()
        except Exception as exc:               # noqa: BLE001
            return self._send_json({"error": str(exc)}, 400)
        # The project's first video: from its assets, or `video` from a
        # client older than them. Filename only, no path components --
        # the name from the client must not determine WHERE anything is
        # looked up or written.
        name = Path(str(_primary_video(req) or "").strip()).name
        if req.get("video"):
            req["video"] = Path(str(req["video"])).name
        pid = req.get("id")
        PROJECTS.mkdir(parents=True, exist_ok=True)
        with PROJECTS_LOCK:
            # Which file: the id the client holds, or -- for the first save
            # of a project the client has no id for yet, which says `new` --
            # none yet. Never matched to another project by its video: two
            # projects can share an episode.
            if pid:
                f = _project_file(pid)
                if f is None:
                    return self._send_json({"error": "invalid id"}, 400)
            elif req.get("new"):
                f = None
            else:
                return self._send_json({"error": "id required (or new: true for a new project)"}, 400)

            if req.get("delete"):
                if f:
                    # A copy first (workspace/projects/.trash/): "Undo" puts it back
                    # (/api/project/restore), and so can a person by hand.
                    if f.is_file():
                        trash = PROJECTS / ".trash"
                        trash.mkdir(parents=True, exist_ok=True)
                        shutil.copy2(f, trash / f"{f.stem}.{int(time.time())}.json")
                        for old in sorted(trash.glob("*.json"), key=lambda p: p.stat().st_mtime)[:-20]:
                            old.unlink(missing_ok=True)
                    f.unlink(missing_ok=True)
                return self._send_json({"ok": True, "deleted": True})

            if not name and not pid and not isinstance(req.get("youtube"), dict):
                # Only a NEW project needs one: its first video is what
                # starts it. An existing one may have had all removed.
                return self._send_json({"error": "video required"}, 400)
            if f is None:
                f = PROJECTS / f"{_new_project_id()}.json"

            req["at"] = int(time.time())
            # The project's IDENTITY is the server's to keep, not the
            # client's to resend. projectState() in the browser builds
            # its object from scratch and doesn't carry the name, so a
            # plain write would erase it on the next autosave -- which
            # is what happened with the id before this: minted on open,
            # wiped seconds later. The name only changes through
            # /api/project/rename. Assets too, for now: the editor can't
            # add one yet, so anything it doesn't send is kept.
            old = _read_project(f) if f.is_file() else None
            if old:
                for key in ("name", "createdAt", "outSlug"):
                    if old.get(key):
                        req[key] = old[key]
                # Kept only when the client didn't send a list at all
                # (an older client). An EMPTY list is an answer: every
                # asset was removed, which a project is allowed (ian).
                if "assets" not in req and old.get("assets"):
                    req["assets"] = old["assets"]
            req["id"] = f.stem
            req.pop("delete", None)
            req.pop("new", None)
            req, _ = _migrate_project(req)
            _write_project(f, req)
        return self._send_json({"ok": True, "id": f.stem})

    def _post_project_asset_upload(self):
        # An image or sound dropped on the Assets screen, saved into THIS
        # project's own folder (projects/<id>/assets/) -- a project's
        # stickers and stings belong to it, not to a pool every project
        # draws from (ian). Raw body, the file's name in the query: no
        # multipart parsing for one file.
        q = parse_qs(urlparse(self.path).query)
        folder = _project_assets_dir((q.get("id") or [""])[0])
        if folder is None or not _project_file(folder.parent.name).is_file():
            return self._send_json({"error": "save the project first"}, 400)
        name = Path((q.get("name") or [""])[0]).name.strip()
        ext = Path(name).suffix.lower()
        if not name or ext not in (composer.IMAGE_EXT | composer.SOUND_EXT):
            return self._send_json({"error": "only images (png, jpg, webp, gif) and sounds "
                                              "(mp3, wav, m4a, ogg, flac) can be added"}, 400)
        n = int(self.headers.get("Content-Length", 0))
        MAX_ASSET = 100 * 1024 * 1024
        if n <= 0 or n > MAX_ASSET:
            return self._send_json({"error": f"file must be 1 byte to {MAX_ASSET // 1048576} MB"}, 400)
        folder.mkdir(parents=True, exist_ok=True)
        dest = _free_name(folder, name)
        tmp = dest.with_name(dest.name + ".part")
        try:
            with open(tmp, "wb") as out:
                remaining = n
                while remaining > 0:
                    chunk = self.rfile.read(min(1 << 20, remaining))
                    if not chunk:
                        raise ConnectionError("upload ended early")
                    out.write(chunk)
                    remaining -= len(chunk)
            tmp.replace(dest)
        except (OSError, ConnectionError) as exc:
            tmp.unlink(missing_ok=True)
            return self._send_json({"error": f"could not save the file: {exc}"}, 500)
        return self._send_json({"ok": True, "name": dest.name,
                                "kind": "image" if ext in composer.IMAGE_EXT else "sound"})

    def _post_project_asset_import(self):
        # A file from the shared library (workspace/assets/: logos,
        # banners, templates) COPIED into the project's folder. A copy,
        # not a reference: editing or deleting the shared file later
        # must not change a project that already used it.
        try:
            req = self._read_json()
        except Exception as exc:               # noqa: BLE001
            return self._send_json({"error": str(exc)}, 400)
        folder = _project_assets_dir(req.get("id"))
        if folder is None or not _project_file(folder.parent.name).is_file():
            return self._send_json({"error": "save the project first"}, 400)
        name = Path(str(req.get("name") or "")).name
        src = ASSETS / name
        ext = src.suffix.lower()
        if not name or ext not in (composer.IMAGE_EXT | composer.SOUND_EXT) or not src.is_file():
            return self._send_json({"error": "not found in workspace/assets/"}, 404)
        folder.mkdir(parents=True, exist_ok=True)
        # Already imported once, byte-for-byte: reuse that copy rather
        # than pile up banner-2.png, banner-3.png on every click.
        same = folder / name
        if same.is_file() and same.read_bytes() == src.read_bytes():
            dest = same
        else:
            dest = _free_name(folder, name)
            try:
                shutil.copyfile(src, dest)
            except OSError as exc:
                return self._send_json({"error": f"could not copy the file: {exc}"}, 500)
        return self._send_json({"ok": True, "name": dest.name,
                                "kind": "image" if ext in composer.IMAGE_EXT else "sound"})

    def _post_project_rename(self):
        try:
            req = self._read_json()
        except Exception as exc:               # noqa: BLE001
            return self._send_json({"error": str(exc)}, 400)
        # Collapsed whitespace and a length cap: it's shown on a card
        # and in the topbar, and nothing about a name needs a newline.
        new_name = " ".join(str(req.get("name") or "").split())[:80]
        if not new_name:
            return self._send_json({"error": "name required"}, 400)
        f = _project_file(req.get("id"))
        if f is None:
            return self._send_json({"error": "invalid id"}, 400)
        with PROJECTS_LOCK:
            data = _read_project(f) if f.is_file() else None
            if data is None:
                return self._send_json({"error": "not found"}, 404)
            # outSlug is migrated in BEFORE the name changes, so a
            # project renamed before it ever had one still keeps the
            # render folder it already has.
            data, _ = _migrate_project(data)
            data["name"] = new_name
            _write_project(f, data)
        return self._send_json({"ok": True, "name": new_name})
