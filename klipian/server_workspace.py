"""Workspace routes of the local server: the clips list and its bulk actions, assets, sources, credits and the thumbnail preview (a mixin of server.Handler).
"""
from __future__ import annotations

import json
import mimetypes
import time
import uuid
from pathlib import Path
from urllib.parse import parse_qs, quote, urlparse

from .cache import Cache
from . import compose as composer
from . import credits as credits_mod
from .schedule import CLIPS_LOCK, mark_uploads as _mark_uploads, uploads_of as _uploads_of, bulk_update as _bulk_update, set_schedules as _set_schedules, delete_rows as _delete_rows, restore_rows as _restore_rows, with_missing_flags as _with_missing_flags, created_of as _created_of, load_clips as _load_clips, migrate_created as _migrate_created, save_clips as _save_clips
from . import paths as _paths
from . import recycle
from .paths import ASSETS, CACHE_DIR, OUT_ROOT, SOURCES, find_video
from .projects import _all_projects


VIDEO_EXT = {".mp4", ".mkv", ".mov", ".webm"}


def _source_duration(video: Path, cache: Cache) -> float | None:
    """Length in seconds, read by ffprobe once per file (cached by the file's
    fingerprint) so the dashboard doesn't probe gigabytes on every load.
    None when the file can't be read."""
    path = cache.probe_path(video)
    try:
        return float(json.loads(path.read_text(encoding="utf-8"))["duration"])
    except (OSError, ValueError, KeyError, TypeError):
        pass
    try:
        from .ffmpeg_tools import probe
        duration = float(probe(video).duration)
    except Exception:                          # noqa: BLE001
        return None
    try:
        _paths.write_text_atomic(path, json.dumps({"duration": duration}))
    except OSError:
        pass
    return duration


class WorkspaceRoutes:
    """Methods of Handler (server.py), moved here; Handler inherits them."""

    def _get_workspace_clips(self):
        # Rows from before the Created column get one now (once; see
        # schedule.migrate_created).
        from_file, from_at = _migrate_created()
        if from_file or from_at:
            print(f"klipian: clips.json: gave {from_file + from_at} rows a createdAt "
                  f"({from_file} from their render file, {from_at} from their last save)")
        # `fileMissing` is worked out now, against what is in out/, and not stored.
        return self._send_json({"clip": _with_missing_flags(_load_clips())})

    def _get_workspace_assets(self):
        # Created if missing -- an empty folder is normal
        # (never added custom watermark/template), not an error.
        ASSETS.mkdir(parents=True, exist_ok=True)
        item = []
        for f in sorted(ASSETS.iterdir()):
            if f.is_file():
                st = f.stat()
                ext = f.suffix.lower()
                item.append({"name": f.name,
                             # What the timeline can use it as (compose.py).
                             "kind": ("image" if ext in composer.IMAGE_EXT
                                      else "sound" if ext in composer.SOUND_EXT else "other"),
                             "kb": round(st.st_size / 1024, 1),
                             "at": int(st.st_mtime)})
        # `folder`: where THIS profile's assets really are (the Open folder button uses it).
        return self._send_json({"asset": item, "folder": str(ASSETS)})

    def _get_workspace_sources(self):
        """The raw videos in workspace/sources/ for the dashboard: size,
        length, when each came in, whether it has a transcript, and which
        projects use it (so a video nothing uses is easy to see)."""
        folder = SOURCES
        folder.mkdir(parents=True, exist_ok=True)
        cache = Cache(CACHE_DIR)
        credit = credits_mod.load(folder)
        used: dict[str, list[dict]] = {}
        for f, data in _all_projects():
            names = {a.get("file") for a in data.get("assets") or []
                     if isinstance(a, dict) and (a.get("kind") or "video") == "video" and a.get("file")}
            if data.get("video"):
                names.add(data["video"])
            for n in names:
                used.setdefault(n, []).append({"id": f.stem, "name": data.get("name") or f.stem})
        item = []
        here = set()
        for f in sorted(folder.iterdir(), key=lambda p: p.name.lower()):
            if not f.is_file() or f.suffix.lower() not in VIDEO_EXT:
                continue
            here.add(f.name)
            st = f.stat()
            item.append({
                "name": f.name,
                "bytes": st.st_size,
                # When it came in: the creation time where the platform keeps
                # one (a copy gets a new one; the modified time is the camera's).
                "at": int(getattr(st, "st_birthtime", None) or st.st_mtime),
                "duration": _source_duration(f, cache),
                "transcribed": cache.find_transcript(f) is not None,
                "used_by": sorted(used.get(f.name, []), key=lambda u: u["name"].lower()),
                "credit": credit.get(f.name) or {},
                "credit_line": credits_mod.line(credit.get(f.name)),
            })
        # Deleted from this page (kept in deleted.json) or just missing but still used by a project:
        # the project keeps its data, the row says the video is gone.
        gone = {n: e for n, e in credits_mod.deleted_load(folder).items() if n not in here}
        for n in used:
            if n not in here and n not in gone and Path(n).suffix.lower() in VIDEO_EXT:
                gone[n] = {}
        for n, e in sorted(gone.items(), key=lambda kv: kv[0].lower()):
            c = {k: v for k, v in e.items() if k != "deleted"}
            item.append({"name": n, "deleted": True, "deleted_at": e.get("deleted") or None,
                         "bytes": None, "duration": None, "at": None, "transcribed": False,
                         "used_by": sorted(used.get(n, []), key=lambda u: u["name"].lower()),
                         "credit": c, "credit_line": credits_mod.line(c),
                         "can_redownload": bool(c.get("videoId"))})
        return self._send_json({"source": item, "folder": str(folder)})

    def _post_workspace_sources_delete(self):
        """Delete one source video: its credit is written to deleted.json FIRST (credits.save forgets
        a file that is gone), then the file goes to the Recycle Bin. Projects are not touched."""
        try:
            req = self._read_json()
        except Exception as exc:               # noqa: BLE001
            return self._send_json({"error": str(exc)}, 400)
        name = str(req.get("file") or "")
        path = find_video(name)
        if Path(name).suffix.lower() not in VIDEO_EXT or path is None or not path.is_file():
            return self._send_json({"error": f"{name or 'that video'} is not in this profile's sources"}, 400)
        try:
            credits_mod.mark_deleted(name)
            recycle.to_recycle_bin(path)
        except OSError as exc:
            credits_mod.unmark_deleted(name)
            return self._send_json({"error": f"could not delete it ({exc})"}, 500)
        return self._send_json({"ok": True})

    def _get_credits(self):
        """Every video's credit and the line built from it (credits.py), for the
        screens that show where a video came from."""
        credit = credits_mod.load()
        return self._send_json({"credit": {
            name: {**c, "line": credits_mod.line(c), "short": credits_mod.short(c)}
            for name, c in credit.items()}})

    def _post_credit(self):
        """Set or clear one video's credit: {file, platform, creator, title, url}.
        All four empty removes it."""
        try:
            req = self._read_json()
        except Exception as exc:               # noqa: BLE001
            return self._send_json({"error": str(exc)}, 400)
        name = str(req.get("file") or "")
        if Path(name).suffix.lower() not in VIDEO_EXT or not find_video(name):
            return self._send_json({"error": f"{name or 'that video'} is not in workspace/sources/"}, 404)
        try:
            credits_mod.save(name, req)
        except OSError as exc:
            return self._send_json({"error": f"could not save the credit ({exc})"}, 500)
        c = credits_mod.load().get(name) or {}
        return self._send_json({"ok": True, "credit": c, "line": credits_mod.line(c)})

    def _get_workspace_asset_file(self):
        # One image/sound from the shared library workspace/assets/ -- the
        # thumbnails in the Assets screen's "import" list.
        # By NAME only, through this endpoint rather than as a static
        # folder, for the reason given at ASSETS: the user's own files
        # don't become URLs of their own. Path(...).name strips any path.
        name = Path((parse_qs(urlparse(self.path).query).get("name") or [""])[0]).name
        f = ASSETS / name
        ext = f.suffix.lower()
        if not name or ext not in (composer.IMAGE_EXT | composer.SOUND_EXT) or not f.is_file():
            return self._send_json({"error": "not found"}, 404)
        mime = mimetypes.guess_type(f.name)[0] or "application/octet-stream"
        return self._send_file(f, mime)

    def _post_workspace_clips_from_render(self):
        """Add a render file that has no schedule row: {folder, file} (names inside
        out/, never paths). Never makes a second row for the same file."""
        try:
            req = self._read_json()
        except Exception as exc:               # noqa: BLE001
            return self._send_json({"error": str(exc)}, 400)
        folder, file_name = str(req.get("folder") or ""), str(req.get("file") or "")
        if (Path(folder).name != folder or Path(file_name).name != file_name
                or not file_name.lower().endswith(".mp4") or file_name.startswith("_")
                or not (OUT_ROOT / folder / file_name).is_file()):
            return self._send_json({"error": "that render file was not found"}, 404)
        if folder == "manual":                       # a video chosen by hand: its row says where the file is
            from . import schedule as _sch
            row_id, created = _sch.add_file_row(_sch.title_from_file(file_name), file_name, None)
            if created:
                _sch.set_fields(row_id, {"fileFolder": "manual"})
            return self._send_json({"ok": True, "id": row_id, "created": created, "how": "manual"})
        from .jobs import add_render_to_schedule
        row_id, created, how = add_render_to_schedule(folder, file_name)
        return self._send_json({"ok": True, "id": row_id, "created": created, "how": how})

    def _post_workspace_clips_delete(self):
        """Delete rows ({ids}); the rows are kept in clips.trash.json for Undo."""
        try:
            req = self._read_json()
        except Exception as exc:               # noqa: BLE001
            return self._send_json({"error": str(exc)}, 400)
        ids = req.get("ids")
        if not isinstance(ids, list) or not ids or not all(isinstance(i, str) for i in ids):
            return self._send_json({"error": "ids must be a list of row ids"}, 400)
        try:
            gone = _delete_rows(ids, keep=req.get("trash") is not False)
        except OSError as exc:
            return self._send_json({"error": f"could not delete: {exc}"}, 500)
        return self._send_json({"ok": True, "deleted": gone})

    def _post_workspace_clips_restore(self):
        """Undo a delete ({ids}): the rows come back exactly as they were."""
        try:
            req = self._read_json()
        except Exception as exc:               # noqa: BLE001
            return self._send_json({"error": str(exc)}, 400)
        ids = req.get("ids")
        if not isinstance(ids, list) or not ids or not all(isinstance(i, str) for i in ids):
            return self._send_json({"error": "ids must be a list of row ids"}, 400)
        back = _restore_rows(ids)
        from .schedule import with_missing_flags
        return self._send_json({"ok": True, "restored": [r["id"] for r in back],
                                "clip": with_missing_flags(back)})

    def _post_workspace_clips_schedule(self):
        """The upload date and time of many rows in one request: {rows: [{id, date, time}]}
        (the bulk upload dialog's inline inputs and its Auto-fill). One read-modify-write."""
        try:
            req = self._read_json()
        except Exception as exc:               # noqa: BLE001
            return self._send_json({"error": str(exc)}, 400)
        rows = req.get("rows")
        if not isinstance(rows, list) or not rows or len(rows) > 5000:
            return self._send_json({"error": "rows must be a list of {id, date, time}"}, 400)
        try:
            out = _set_schedules(rows)
        except ValueError as exc:
            return self._send_json({"error": str(exc)}, 400)
        out["clip"] = _with_missing_flags(out["clip"])
        return self._send_json({"ok": True, **out})

    def _post_workspace_clips_bulk(self):
        """One request for an action on many schedule rows: {ids, status, date?,
        time?}. One read-modify-write, one save (see schedule.bulk_update)."""
        try:
            req = self._read_json()
        except Exception as exc:               # noqa: BLE001
            return self._send_json({"error": str(exc)}, 400)
        ids = req.get("ids")
        if not isinstance(ids, list) or not ids or len(ids) > 5000 or not all(isinstance(i, str) for i in ids):
            return self._send_json({"error": "ids must be a list of row ids"}, 400)
        try:
            out = _bulk_update(ids, str(req.get("status") or ""), str(req.get("date") or ""),
                               str(req.get("time") or ""), overwrite=req.get("overwrite") is True)
        except ValueError as exc:
            return self._send_json({"error": str(exc)}, 400)
        out["clip"] = _with_missing_flags(out["clip"])
        return self._send_json({"ok": True, **out})

    def _post_workspace_clips_upload_mark(self):
        """Mark by hand where clips are uploaded: {ids, platform: youtube|tiktok|instagram, state: none|scheduled|done, date?, time?, url?} (schedule.mark_uploads).
        Nothing is uploaded and no network call is made."""
        try:
            req = self._read_json()
        except Exception as exc:               # noqa: BLE001
            return self._send_json({"error": str(exc)}, 400)
        ids = req.get("ids")
        if not isinstance(ids, list) or not ids or len(ids) > 5000 or not all(isinstance(i, str) for i in ids):
            return self._send_json({"error": "ids must be a list of row ids"}, 400)
        try:
            out = _mark_uploads(ids, str(req.get("platform") or ""), str(req.get("state") or ""), str(req.get("date") or ""),
                                             str(req.get("time") or ""), str(req.get("url") or ""))
        except ValueError as exc:
            return self._send_json({"error": str(exc)}, 400)
        out["clip"] = _with_missing_flags(out["clip"])
        return self._send_json({"ok": True, **out})

    def _post_workspace_clips_thumbnail(self):
        """Make a clip's thumbnail card again from its final video: {id, text?}. `text` (when sent) is kept on the row as thumbText; empty clears it
        (the title is used). Used after editing thumbText and for old renders that have no JPG. No re-render, no network."""
        try:
            req = self._read_json()
        except Exception as exc:               # noqa: BLE001
            return self._send_json({"error": str(exc)}, 400)
        from . import schedule as _sch, thumbnail as _thumb
        row = _sch.get_row(str(req.get("id") or ""))
        if not row:
            return self._send_json({"error": "that clip is gone"}, 404)
        if "text" in req:
            row = _sch.set_fields(row["id"], {"thumbText": " ".join(str(req["text"] or "").split())[:80]}) or row
        file = _sch.row_file(row)
        if file is None:
            return self._send_json({"error": "the video file is not in the profile's out/ folder any more"}, 400)
        info: dict = {}
        if not _thumb.write(file, _thumb.text_of(row.get("thumbText"), row.get("title"), row.get("hook"), ai=row.get("thumb")), info=info):
            _sch.set_fields(row["id"], {"thumbError": info.get("error", "unknown reason")})
            return self._send_json({"error": f"the thumbnail could not be made from this video: {info.get('error', 'unknown reason')}"}, 500)
        row = _sch.set_fields(row["id"], {"thumbError": ""}) or row
        return self._send_json({"ok": True, "clip": _with_missing_flags([row])[0]})

    def _post_thumbnail_preview(self):
        """The settings preview: {style, text} -> a JPEG made by the same thumbnail.write as the real one, from the profile's newest rendered
        video, or from a plain placeholder frame when it has none. Nothing is saved."""
        try:
            req = self._read_json()
        except Exception as exc:               # noqa: BLE001
            return self._send_json({"error": str(exc)}, 400)
        from . import thumbnail as _thumb
        info: dict = {}
        data = _thumb.preview(req.get("style"), str(req.get("text") or ""), info)
        if not data:
            return self._send_json({"error": "the preview could not be made"}, 500)
        self.send_response(200)
        self.send_header("Content-Type", "image/jpeg")
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Thumb-Text", quote(info.get("text", "")))       # what the card says: the UI puts it in the Sample text box
        self.end_headers()
        try:
            self.wfile.write(data)
        except ConnectionError:
            pass

    def _post_workspace_clips(self):
        try:
            req = self._read_json()
        except Exception as exc:               # noqa: BLE001
            return self._send_json({"error": str(exc)}, 400)

        cid = str(req.get("id") or "")

        # Lock the entire read-modify-write: clips.json is one file shared
        # by all requests, and this server is multi-threaded
        # (ThreadingHTTPServer). Without this, two overlapping edits can
        # clobber each other -- the second thread writes back the list it
        # read BEFORE the first thread's write finished, and the first
        # change vanishes without an error.
        #
        # Nothing writes to the socket inside this block. The delete
        # branch used to `return self._send_json(...)` while still
        # holding the lock, so a slow or stalled client kept every other
        # clips.json edit waiting on a network write.
        deleted = False
        if req.get("delete"):
            if not cid:
                return self._send_json({"error": "id required"}, 400)
            _delete_rows([cid])
            return self._send_json({"ok": True, "deleted": True})
        with CLIPS_LOCK:
            clips = _load_clips()

            if req.get("delete"):
                pass
            else:
                if not cid:
                    cid = uuid.uuid4().hex[:8]
                req["id"] = cid
                req["at"] = int(time.time())
                req.pop("fileMissing", None)       # derived on every read, never stored
                req.pop("fileUrl", None)
                req.pop("uploadsView", None)
                req.pop("thumbUrl", None)
                req.pop("thumbCut", None)

                for i, c in enumerate(clips):
                    if c.get("id") == cid:
                        if "uploads" not in req and "uploads" in c:       # a page that does not know the field must not drop it
                            req["uploads"] = c["uploads"]
                        # createdAt belongs to the server and never changes: an
                        # edit (the page resends the row) keeps the stored one.
                        req["createdAt"] = c.get("createdAt") or _created_of(c)
                        clips[i] = req
                        break
                else:
                    req["createdAt"] = int(time.time())
                    clips.append(req)

                _save_clips(clips)
        if deleted:
            return self._send_json({"ok": True, "deleted": True})
        return self._send_json({"ok": True, "id": cid, "createdAt": req.get("createdAt"), "uploadsView": _uploads_of(req)})
