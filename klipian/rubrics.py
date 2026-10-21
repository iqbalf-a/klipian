"""Rubrics per niche (P26): what Claude is told to look for when it picks clips.

    prompts/rubrik/dialog-podcast.md, gameplay-mlbb.md   built in (ids "dialog", "gameplay")
    prompts/rubrik/templates/<id>.md                      templates shipped in the repo
    workspace/rubrics/<slug>.md                           the person's own, shared by every profile

A profile's default rubric is one of those ids. A rubric in the workspace is checked for the sections
the brief, the parser and the posting flow depend on (check()); one that lacks a section is refused
with a message naming it, never sent out silently. The built-in "gameplay" rubric is older than these
checks and is exempt; "dialog" and every template pass them (selftest).
"""

from __future__ import annotations

import os
import re
from pathlib import Path

from . import paths
from .paths import ROOT

_DIR = ROOT / "prompts" / "rubrik"
BUILTIN = {
    "dialog": ("Dialog / podcast", _DIR / "dialog-podcast.md"),
    "gameplay": ("Gameplay (Mobile Legends)", _DIR / "gameplay-mlbb.md"),
}
TEMPLATE_DIR = _DIR / "templates"
DEFAULT = "dialog"
SLUG = re.compile(r"[a-z0-9-]{1,40}")

# (what to tell the person, test on the text)
REQUIRED = [
    ("the 'Tugas' section", lambda t: "## Tugas" in t),
    ("the 'Lima kriteria' section", lambda t: "## Lima kriteria" in t),
    ("the 'Audio & timing cues' section", lambda t: re.search(r"^## .*Audio & timing cues", t, re.M) is not None),
    ("the 'Judul dan hook' section", lambda t: "## Judul dan hook" in t),
    ("the 'Teks posting' section", lambda t: "## Teks posting" in t),
    ("the credit rule in 'Teks posting' (\"Jangan menulis baris kredit\")", lambda t: "Jangan menulis baris kredit" in t),
    ("the 'Sudut pandang' section", lambda t: "## Sudut pandang" in t),
    ("the rule in 'Sudut pandang' (\"Jangan mengulang kutipan\")", lambda t: "Jangan mengulang kutipan" in t),
    ("the 'Topik yang berpotensi viral' part of the hook criterion", lambda t: "Topik yang berpotensi viral" in t),
]

_open = getattr(os, "startfile", None)               # a seam: selftest replaces it, nothing is opened there


class RubricError(ValueError):
    """A message meant to be shown as is."""


def workspace_dir() -> Path:
    return paths.workspace_dir() / "rubrics"


def valid_id(rid) -> bool:
    return isinstance(rid, str) and SLUG.fullmatch(rid) is not None


def _read(path: Path) -> str:
    try:
        return path.read_bytes().decode("utf-8-sig")
    except OSError:
        return ""


def check(text: str) -> list[str]:
    """What a rubric lacks (empty when it is complete)."""
    return [label for label, ok in REQUIRED if not ok(text)]


def _title(text: str, fallback: str) -> str:
    m = re.match(r"\s*#\s*(?:Rubrik:\s*)?([^\r\n]+)", text)
    return (m.group(1).strip() if m else "") or fallback


def _workspace_path(rid: str) -> Path:
    if not valid_id(rid) or rid in BUILTIN:
        raise RubricError("That is not a rubric name (lowercase letters, digits and - only, up to 40).")
    return workspace_dir() / f"{rid}.md"


def templates() -> list[dict]:
    """Templates a new rubric can start from: the ones shipped in the repo, plus the built-in dialog rubric."""
    out = [{"id": "podcast", "name": _title(_read(BUILTIN["dialog"][1]), "Dialog / podcast")}]
    try:
        files = sorted(TEMPLATE_DIR.glob("*.md"))
    except OSError:
        files = []
    for f in files:
        if valid_id(f.stem):
            out.append({"id": f.stem, "name": _title(_read(f), f.stem)})
    return out


def _template_path(tid: str) -> Path:
    if tid == "podcast":
        return BUILTIN["dialog"][1]
    if not valid_id(tid) or not (TEMPLATE_DIR / f"{tid}.md").is_file():
        raise RubricError("Unknown template.")
    return TEMPLATE_DIR / f"{tid}.md"


def list_all() -> dict:
    mine = []
    try:
        files = sorted(workspace_dir().glob("*.md"))
    except OSError:
        files = []
    for f in files:
        if not valid_id(f.stem) or f.stem in BUILTIN:
            continue
        text = _read(f)
        mine.append({"id": f.stem, "name": _title(text, f.stem), "missing": check(text)})
    return {"builtin": [{"id": k, "name": v[0]} for k, v in BUILTIN.items()], "workspace": mine,
            "templates": templates(), "folder": str(workspace_dir())}


def load(rid: str | None) -> tuple[str, str, str | None]:
    """(the id actually used, its text, a note for the person or None).

    An unknown or missing id falls back to "dialog" with a note (a deleted rubric must not break a profile);
    a bad id or a rubric that lacks a required section raises RubricError."""
    rid = rid or DEFAULT
    if rid in BUILTIN:
        return rid, _read(BUILTIN[rid][1]), None
    path = _workspace_path(rid)
    if not path.is_file():
        return DEFAULT, _read(BUILTIN[DEFAULT][1]), (
            f"The rubric \"{rid}\" is not there any more, so the {BUILTIN[DEFAULT][0]} rubric is used. "
            "Choose another one in Profile settings.")
    text = _read(path)
    missing = check(text)
    if missing:
        raise RubricError(f"The rubric \"{rid}\" is missing {'; '.join(missing)}. "
                          "Add it back (compare with a template) or choose another rubric.")
    return rid, text, None


def slugify(name: str) -> str:
    return re.sub(r"-+", "-", re.sub(r"[^a-z0-9]+", "-", str(name or "").lower())).strip("-")[:40].strip("-")


def create(template: str, name: str) -> dict:
    """Copy a template to workspace/rubrics/<slug>.md. Never overwrites."""
    src = _template_path(str(template or ""))
    title = re.sub(r"\s+", " ", str(name or "")).strip()[:60]
    slug = slugify(title)
    if not slug:
        raise RubricError("Give the rubric a name (letters or digits).")
    if slug in BUILTIN:
        raise RubricError("That name is used by a built-in rubric. Choose another.")
    dest = _workspace_path(slug)
    if dest.exists():
        raise RubricError(f"A rubric called \"{slug}\" already exists.")
    text = _read(src)
    text = re.sub(r"\A# [^\r\n]*", f"# Rubrik: {title}", text, count=1)
    missing = check(text)
    if missing:                                         # a template that lost a section (a repo problem)
        raise RubricError(f"That template is missing {'; '.join(missing)}.")
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(text.encode("utf-8"))
    return {"id": slug, "name": title}


def delete(rid: str) -> None:
    """To the Recycle Bin (a profile that used it falls back to dialog, with a note, until another is chosen)."""
    from .recycle import to_recycle_bin
    path = _workspace_path(rid)
    if not path.is_file():
        raise RubricError("That rubric is not there.")
    to_recycle_bin(path)


def open_path(rid: str | None = None) -> None:
    """Open a rubric file in the editor the system uses for .md, or the folder when no id is given."""
    target = _workspace_path(rid) if rid else workspace_dir()
    if rid and not target.is_file():
        raise RubricError("That rubric is not there.")
    target.parent.mkdir(parents=True, exist_ok=True)
    workspace_dir().mkdir(parents=True, exist_ok=True)
    if _open is None:
        raise RubricError(f"Open this yourself: {target}")
    _open(str(target))
