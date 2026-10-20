"""Profiles: one per channel, each with its own sources, projects, renders, schedule,
assets and secrets (see paths.py for how the current one is chosen per request).

    workspace/
      cache/                shared by every profile
      profiles/<id>/        profile.json, sources/ projects/ out/ schedule/ assets/ secrets/
      profiles/_guest/      edits and renders only: no schedule/, no secrets/

A profile is a separation of data, not a lock: klipian runs on one person's computer.

migrate_legacy() moves the workspace as it was before profiles (sources/, projects/,
out/, schedule/, assets/ and secrets/client_secret.json straight under workspace/) into
the profile "podcast". It backs up every JSON file first, moves (never copies: same
drive), compares counts and hashes after, and can be run again safely.
"""

from __future__ import annotations

import hashlib
import json
import os
import re
import shutil
import time
from pathlib import Path

from . import paths
from .paths import DEFAULT_PROFILE, GUEST, valid_profile_id

PROFILE_DIRS = ("sources", "projects", "out", "schedule", "assets", "secrets")
GUEST_DIRS = ("sources", "projects", "out", "assets")          # no schedule/, no secrets/
LEGACY_DIRS = ("sources", "projects", "out", "schedule", "assets")
DEFAULT_COLORS = ("#e8b923", "#4aa8ff", "#5bd18b", "#ff7a59", "#b07cff", "#ff6fa8")


class ProfileError(ValueError):
    """A profile request that cannot be done; the message is for the person."""


# --------------------------------------------------------------------------
# a profile's files
# --------------------------------------------------------------------------

def _meta_file(pid: str) -> Path:
    return paths.profile_dir(pid) / "profile.json"


def _write_json(path: Path, data: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    tmp.replace(path)


def write_meta(pid: str, meta: dict) -> None:
    """Write profile.json (name, colour, defaults); the Guest has none."""
    if pid == GUEST:
        return
    paths.profile_dir(pid).mkdir(parents=True, exist_ok=True)
    _write_json(_meta_file(pid), {"name": str(meta.get("name") or pid),
                                  "color": str(meta.get("color") or DEFAULT_COLORS[0]),
                                  "defaults": meta.get("defaults") if isinstance(meta.get("defaults"), dict) else {}})


def ensure_dirs(pid: str) -> Path:
    """Make a profile's folders (the Guest has no schedule/ and no secrets/)."""
    base = paths.profile_dir(pid)
    for name in (GUEST_DIRS if pid == GUEST else PROFILE_DIRS):
        (base / name).mkdir(parents=True, exist_ok=True)
    return base


def read_meta(pid: str) -> dict | None:
    """What profile.json says, or None when the profile does not exist."""
    if pid == GUEST:
        return {"id": GUEST, "name": "Guest", "color": "#8b8f98", "guest": True, "defaults": {}}
    f = _meta_file(pid)
    try:
        data = json.loads(f.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None
    if not isinstance(data, dict):
        return None
    return {"id": pid, "name": str(data.get("name") or pid), "color": str(data.get("color") or DEFAULT_COLORS[0]),
            "guest": False, "defaults": data.get("defaults") if isinstance(data.get("defaults"), dict) else {}}


def exists(pid) -> bool:
    if not valid_profile_id(pid):
        return False
    return paths.profile_dir(pid).is_dir() if pid == GUEST else read_meta(pid) is not None


def list_profiles() -> list[dict]:
    """The profiles to pick from (the Guest is separate: it is always there)."""
    root = paths.PROFILES_DIR
    out = []
    if root.is_dir():
        for d in sorted(root.iterdir()):
            if d.is_dir() and d.name != GUEST and valid_profile_id(d.name):
                meta = read_meta(d.name)
                if meta:
                    out.append(meta)
    return out


# --------------------------------------------------------------------------
# migration of the workspace as it was before profiles
# --------------------------------------------------------------------------

def _sha256(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for block in iter(lambda: f.read(1 << 20), b""):
            h.update(block)
    return h.hexdigest()


def _legacy_json_files(ws: Path) -> list[Path]:
    """Every JSON file the migration is about to move (the ones that are data and
    cannot be made again)."""
    found: list[Path] = []
    for name in LEGACY_DIRS:
        d = ws / name
        if d.is_dir():
            found += [p for p in d.rglob("*.json") if p.is_file()]
    secret = ws / "secrets" / "client_secret.json"
    if secret.is_file():
        found.append(secret)
    return found


def _dir_stats(d: Path) -> tuple[int, int]:
    n = size = 0
    if d.is_dir():
        for p in d.rglob("*"):
            if p.is_file():
                n += 1
                size += p.stat().st_size
    return n, size


def legacy_present(ws: Path | None = None) -> bool:
    ws = ws or paths.workspace_dir()
    return any((ws / name).is_dir() and any((ws / name).iterdir()) for name in LEGACY_DIRS) \
        or (ws / "secrets" / "client_secret.json").is_file()


def migrate_legacy(log=print, check_jobs=None, force: bool = False) -> dict:
    """Move the pre-profile workspace into profiles/podcast/. Returns a report
    {"state": "nothing"|"migrated"|"refused", "lines": [...], ...}.

    Safe to run again: with nothing left to move it does nothing. It refuses (and
    changes nothing) while a job is active (`check_jobs()` returns a message) and when
    both the old and the new layout hold data (a half-made migration needs a person)."""
    ws = paths.workspace_dir()
    lines: list[str] = []

    def say(text: str) -> None:
        lines.append(text)
        log(f"klipian: migrate: {text}")

    target = ws / "profiles" / DEFAULT_PROFILE
    if not legacy_present(ws):
        return {"state": "nothing", "lines": lines}
    if check_jobs and not force:
        busy = check_jobs()
        if busy:
            say(f"refused: {busy}")
            return {"state": "refused", "lines": lines, "reason": busy}
    clash = [n for n in LEGACY_DIRS if (ws / n).is_dir() and any((ws / n).iterdir())
             and (target / n).is_dir() and any((target / n).iterdir())]
    if clash:
        reason = (f"both workspace/{clash[0]}/ and profiles/{DEFAULT_PROFILE}/{clash[0]}/ hold files; "
                  "nothing was moved")
        say(f"refused: {reason}")
        return {"state": "refused", "lines": lines, "reason": reason}

    # 1. back up every JSON file, with its hash, before anything moves
    stamp = time.strftime("%Y%m%d-%H%M%S")
    backup = ws / "backups" / f"migrate-{stamp}"
    manifest: dict[str, dict] = {}
    for f in _legacy_json_files(ws):
        rel = f.relative_to(ws)
        dest = backup / rel
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(f, dest)
        manifest[rel.as_posix()] = {"sha256": _sha256(f), "bytes": f.stat().st_size}
    before = {n: _dir_stats(ws / n) for n in LEGACY_DIRS}
    (backup).mkdir(parents=True, exist_ok=True)
    _write_json(backup / "manifest.json", {"files": manifest, "dirs": {k: list(v) for k, v in before.items()}})
    say(f"backed up {len(manifest)} JSON files to {backup.relative_to(ws).as_posix()}/")

    # 2. move (same drive: a rename)
    moved: list[tuple[Path, Path]] = []
    try:
        target.mkdir(parents=True, exist_ok=True)
        for name in LEGACY_DIRS:
            src = ws / name
            if not src.is_dir():
                continue
            dst = target / name
            if dst.is_dir():                         # created empty by ensure_dirs: replace it
                dst.rmdir()
            os.replace(src, dst)
            moved.append((src, dst))
            say(f"moved {name}/ ({before[name][0]} files)")
        secret = ws / "secrets" / "client_secret.json"
        if secret.is_file():
            dst = target / "secrets" / "client_secret.json"
            dst.parent.mkdir(parents=True, exist_ok=True)
            os.replace(secret, dst)
            moved.append((secret, dst))
            say("moved secrets/client_secret.json")
        ensure_dirs(DEFAULT_PROFILE)
        if not _meta_file(DEFAULT_PROFILE).is_file():
            _write_json(_meta_file(DEFAULT_PROFILE), {"name": "klipian podcast", "color": DEFAULT_COLORS[0], "defaults": {}})

        # 3. check: the same files, byte for byte
        problems = []
        for rel, info in manifest.items():
            if rel.startswith("secrets/"):
                new = target / rel
            else:
                new = target / rel
            if not new.is_file():
                problems.append(f"missing after the move: {rel}")
            elif _sha256(new) != info["sha256"]:
                problems.append(f"changed by the move: {rel}")
        for name in LEGACY_DIRS:
            if before[name] != _dir_stats(target / name) and before[name][0]:
                problems.append(f"{name}/ has {_dir_stats(target / name)} (files, bytes) now, was {before[name]}")
        if problems:
            raise RuntimeError("; ".join(problems[:5]))
        say(f"checked: {len(manifest)} JSON files identical, file counts and sizes equal")
    except Exception as exc:                       # noqa: BLE001
        say(f"FAILED ({exc}); moving back")
        for src, dst in reversed(moved):
            try:
                src.parent.mkdir(parents=True, exist_ok=True)
                os.replace(dst, src)
            except OSError as back:
                say(f"could not move {dst} back: {back}")
        return {"state": "failed", "lines": lines, "reason": str(exc), "backup": str(backup)}
    say("done: the workspace is now the profile \"podcast\" (klipian podcast)")
    return {"state": "migrated", "lines": lines, "backup": str(backup), "files": len(manifest)}
