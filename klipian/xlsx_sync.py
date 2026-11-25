"""Writes what YouTube says about each uploaded clip into the planning .xlsx files of the workspace
of the current profile (workspace/profiles/<id>/schedule/*.xlsx): the status column, a "Video ID", a "Jadwal tayang" and a "Link YouTube" column (each created when the sheet lacks it, in every profile).

A sheet row is the clip's when its Video ID cell equals the clip's, else when its title (the "Judul..." or
"Topik" column) shares at least 60% of the clip title's words and is clearly the best match. Sheets with
no match are never touched; a file is copied to workspace/backups/xlsx-<time>/ before its first change."""
from __future__ import annotations

import re
import shutil
import time
from pathlib import Path

from . import paths

_STOP = {"yang", "dan", "di", "ke", "dari", "untuk", "dengan", "pada", "itu", "ini", "saat", "tiap"}
SKIP = (".lama-", ".sebelum-")
ID_COL, WHEN_COL, LINK_COL = "Video ID", "Jadwal tayang", "Link YouTube"


def _words(text) -> set[str]:
    return {w for w in re.findall(r"[a-z0-9]+", str(text or "").lower()) if len(w) > 2 and w not in _STOP}


def files() -> list[Path]:
    found = paths.SCHEDULE_DIR.glob("*.xlsx")                   # each profile has its own, next to its clips.json
    return sorted(f for f in found if not f.name.startswith("~$") and not any(s in f.name for s in SKIP))


def _columns(sheet) -> dict[str, int]:
    return {str(c.value).strip(): c.column for c in sheet[1] if c.value}


def _find(cols: dict[str, int], *starts: str) -> int | None:
    for name, col in cols.items():
        if name.lower().startswith(starts):
            return col
    return None


def _match(sheet, cols, item, taken: set[int], title_col: int) -> int | None:
    id_col = cols.get(ID_COL)
    rows = range(2, sheet.max_row + 1)
    if id_col:
        for r in rows:
            if sheet.cell(r, id_col).value == item["videoId"]:
                return r
    want = _words(item["title"])
    if not want:
        return None
    text = _words(item.get("text"))                              # the clip's title and description: a YouTube title is often a rewrite of the planned topic

    def score(r):
        topic = _words(sheet.cell(r, title_col).value)
        return max(len(want & topic) / len(want), len(text & topic) / len(topic) if topic else 0)
    scored = sorted(((score(r), r) for r in rows
                     if r not in taken and not (id_col and sheet.cell(r, id_col).value)), reverse=True)
    if scored and scored[0][0] >= 0.6 and (len(scored) == 1 or scored[0][0] > scored[1][0]):
        return scored[0][1]
    return None


def sync(items: list[dict]) -> dict:
    """items: [{videoId, title, state, when}]. Returns {files: [{file, rows}], unmatched: [titles], errors: [...]}."""
    out: dict = {"files": [], "unmatched": [], "errors": []}
    try:
        import openpyxl
    except ImportError:
        out["errors"].append("openpyxl is not installed (pip install openpyxl): the xlsx files were not touched.")
        return out
    matched: set[str] = set()
    backup = paths.workspace_dir() / "backups" / time.strftime("xlsx-%Y%m%d-%H%M%S")
    for f in files():
        try:
            book = openpyxl.load_workbook(f)
            changed = 0
            for sheet in book:
                cols = _columns(sheet)
                title_col = _find(cols, "judul", "topik")
                status_col = cols.get("Upload") or cols.get("Status")
                if not title_col or not status_col:
                    continue
                taken: set[int] = set()
                hits = [(it, _match(sheet, cols, it, taken, title_col)) for it in items]
                hits = [(it, r) for it, r in hits if r and not taken.add(r)]
                for it, r in hits:
                    id_col = cols.get(ID_COL) or cols.setdefault(ID_COL, sheet.max_column + 1)
                    when_col = cols.get(WHEN_COL) or cols.setdefault(WHEN_COL, max(cols.values()) + 1)
                    link_col = _find(cols, "link") or cols.setdefault(LINK_COL, max(cols.values()) + 1)
                    for name, col in ((ID_COL, id_col), (WHEN_COL, when_col), (LINK_COL, link_col)):
                        if not sheet.cell(1, col).value:
                            sheet.cell(1, col).value = name
                    link = it.get("url") or f"https://youtube.com/shorts/{it['videoId']}"
                    for col, value in ((status_col, it["state"]), (id_col, it["videoId"]), (when_col, it["when"]), (link_col, link)):
                        if sheet.cell(r, col).value != value:
                            sheet.cell(r, col).value = value
                            changed += 1
                    matched.add(it["videoId"])
            if changed:
                backup.mkdir(parents=True, exist_ok=True)
                shutil.copy2(f, backup / f.name)
                book.save(f)
                out["files"].append({"file": f.name, "cells": changed})
            book.close()
        except PermissionError:
            out["errors"].append(f"{f.name} is open in another program (Excel?); close it and sync again.")
        except Exception as exc:                        # noqa: BLE001  a broken file must not stop the others
            out["errors"].append(f"{f.name}: {exc}")
    out["unmatched"] = [it["title"] for it in items if it["videoId"] not in matched]
    return out
