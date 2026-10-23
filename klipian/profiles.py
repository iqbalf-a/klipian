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

from . import paths, rubrics
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
    return True if pid == GUEST else read_meta(pid) is not None          # the Guest is always there


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
# create, change, delete
# --------------------------------------------------------------------------

_COLOR = re.compile(r"#[0-9a-fA-F]{6}")
RUBRIC_CHOICES = ("dialog", "gameplay")


def _clean_name(name) -> str:
    n = " ".join(str(name or "").split())[:40]
    if not n:
        raise ProfileError("give the profile a name")
    return n


def _clean_color(color) -> str:
    c = str(color or "")
    if not _COLOR.fullmatch(c):
        raise ProfileError("the colour must look like #e8b923")
    return c.lower()


def _clean_defaults(d) -> dict:
    """The per-profile defaults: watermark text, default rubric, caption look."""
    d = d if isinstance(d, dict) else {}
    out: dict = {}
    wm = re.sub(r"[{}\\\r\n]", " ", str(d.get("watermark") or "")).strip()[:40]
    if wm:
        out["watermark"] = wm
    if d.get("rubric") in RUBRIC_CHOICES or rubrics.valid_id(d.get("rubric")):
        out["rubric"] = d["rubric"]       # a workspace rubric too (rubrics.py); one that is gone falls back to dialog on use
    if d.get("hashtagPlacement") in ("title", "description", "both"):
        out["hashtagPlacement"] = d["hashtagPlacement"]
    if "addShorts" in d:
        out["addShorts"] = bool(d["addShorts"])
    if d.get("titleTags") in (2, 3):
        out["titleTags"] = d["titleTags"]
    preset = d.get("captionPreset")
    if isinstance(preset, dict) and len(json.dumps(preset)) <= 4000:
        out["captionPreset"] = preset
    return out


def defaults(pid: str | None = None) -> dict:
    meta = read_meta(pid or paths.current_profile())
    return (meta or {}).get("defaults") or {}


def hashtag_settings(pid: str | None = None) -> dict:
    """Where this profile puts a clip's hashtags on YouTube (see hashtags.py). The default for
    every profile, existing ones included: in the title."""
    from . import hashtags
    d = defaults(pid)
    return hashtags.settings_of({"placement": d.get("hashtagPlacement"), "shorts": d.get("addShorts"),
                                 "titleTags": d.get("titleTags")})


def _free_id(name: str) -> str:
    base = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")[:30] or "profile"
    if not _PROFILE_ID_OK(base):
        base = "p-" + base
    pid, n = base, 2
    while (paths.PROFILES_DIR / pid).exists() or pid == GUEST:
        pid = f"{base}-{n}"
        n += 1
    return pid


def _PROFILE_ID_OK(pid: str) -> bool:
    return valid_profile_id(pid) and pid != GUEST


def create(name, color=None) -> dict:
    name = _clean_name(name)
    if any(p["name"].lower() == name.lower() for p in list_profiles()):
        raise ProfileError(f"there is a profile called {name} already")
    color = _clean_color(color) if color else DEFAULT_COLORS[len(list_profiles()) % len(DEFAULT_COLORS)]
    pid = _free_id(name)
    write_meta(pid, {"name": name, "color": color, "defaults": {}})
    ensure_dirs(pid)
    return read_meta(pid)


def update(pid: str, fields: dict) -> dict:
    meta = read_meta(pid)
    if pid == GUEST or meta is None:
        raise ProfileError("that profile cannot be changed")
    if "name" in fields:
        name = _clean_name(fields["name"])
        if any(p["name"].lower() == name.lower() and p["id"] != pid for p in list_profiles()):
            raise ProfileError(f"there is a profile called {name} already")
        meta["name"] = name
    if "color" in fields:
        meta["color"] = _clean_color(fields["color"])
    if "defaults" in fields:
        merged = {**meta.get("defaults", {}), **(fields["defaults"] if isinstance(fields["defaults"], dict) else {})}
        meta["defaults"] = _clean_defaults({k: v for k, v in merged.items() if v not in ("", None)})
    write_meta(pid, meta)
    return read_meta(pid)


def delete(pid: str) -> None:
    """Send a profile's whole folder to the Recycle Bin (the Guest cannot be deleted)."""
    from .recycle import to_recycle_bin
    if pid == GUEST or not exists(pid):
        raise ProfileError("that profile cannot be deleted")
    to_recycle_bin(paths.profile_dir(pid))


def clear_guest() -> None:
    """Send everything the Guest made to the Recycle Bin. The shared cache stays."""
    from .recycle import to_recycle_bin
    base = paths.profile_dir(GUEST)
    if base.is_dir():
        for child in list(base.iterdir()):
            to_recycle_bin(child)
    ensure_dirs(GUEST)


def place_source(tmp: Path, dest: Path) -> dict:
    """Put an uploaded video (`tmp`) at `dest`. When another profile already holds this exact file
    (same size and bytes, under any name) on the same drive, link to it instead of keeping a second
    copy: a hardlink is a name of its own, so deleting it in one profile never removes it from the
    other. If that profile has a credit for the file and this one has none, the credit entry is
    copied (an existing credit is never overwritten).

    Returns {"how": "linked" | "saved", "creditFrom": the other profile's name or None}."""
    from . import credits
    size = tmp.stat().st_size
    root = paths.PROFILES_DIR
    same_file = None                                  # (profile id, the other file)
    if root.is_dir():
        tmp_hash = None
        for other in sorted(root.iterdir()):
            folder = other / "sources"
            if other.name == paths.current_profile() or not folder.is_dir():
                continue
            # the same name first, then any file of the same size
            cands = sorted((f for f in folder.iterdir() if f.is_file() and f.stat().st_size == size
                            and f.suffix.lower() in (".mp4", ".mkv", ".mov", ".webm")),
                           key=lambda f: f.name != dest.name)
            for cand in cands:
                try:
                    tmp_hash = tmp_hash or _sha256(tmp)
                    if _sha256(cand) != tmp_hash:
                        continue
                except OSError:
                    continue
                same_file = (other.name, cand)
                break
            if same_file:
                break
    how = "saved"
    if same_file:
        try:
            os.link(same_file[1], dest)
            tmp.unlink(missing_ok=True)
            how = "linked"
        except OSError:
            pass                                      # another drive, or no links here: a normal copy
    if how == "saved":
        tmp.replace(dest)
    credit_from = None
    if same_file:
        try:
            theirs = credits.load(paths.profile_dir(same_file[0]) / "sources").get(same_file[1].name)
            if theirs and dest.name not in credits.load():
                credits.save(dest.name, theirs)
                meta = read_meta(same_file[0])
                credit_from = (meta or {}).get("name") or same_file[0]
        except OSError:
            pass
    return {"how": how, "creditFrom": credit_from}


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
