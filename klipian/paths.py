"""Where things live. Everything else imports its folders from here."""

from __future__ import annotations

import contextvars
import os
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
# $KLIPIAN_WORKSPACE points the whole program at another folder (a scratch copy for tests).
DEFAULT_WORKSPACE = Path(os.environ["KLIPIAN_WORKSPACE"]) if os.environ.get("KLIPIAN_WORKSPACE") else ROOT / "workspace"

# All working files live under ONE folder, workspace/ (see workspace/README.md):
#   cache/                 shared by every profile (per-video transcripts, cues, thumbnails)
#   profiles/<id>/         one profile = one channel: sources, projects, out, schedule,
#                          assets and secrets of its own
# WHICH profile is not a global: the server sets it per request (contextvars), a
# background job takes a copy of the context when it starts, so a job keeps writing
# to the profile it began in even after the tab switches to another one.

_workspace_override: Path | None = None


def use_workspace(path) -> None:
    """Point everything at another workspace folder (the selftest's scratch copy); None
    goes back to workspace/."""
    global _workspace_override
    _workspace_override = Path(path) if path else None


def workspace_dir() -> Path:
    return _workspace_override or DEFAULT_WORKSPACE


class _Dyn(os.PathLike):
    """A folder that is worked out when it is USED, not when this module is imported:
    what `PROJECTS`, `SOURCES`, `OUT_ROOT` ... are, because they depend on the
    profile of the request or job running. Behaves as the Path it stands for."""

    def __init__(self, fn):
        self._fn = fn

    def _path(self) -> Path:
        return self._fn()

    def __fspath__(self) -> str:
        return os.fspath(self._path())

    def __truediv__(self, other):
        # Still lazy: `SCHEDULE_DIR / "clips.json"` written at the top of a module must
        # follow the profile too, not be fixed at import.
        return _Dyn(lambda: self._path() / other)

    def __str__(self) -> str:
        return str(self._path())

    def __repr__(self) -> str:
        return f"<{self._path()}>"

    def __eq__(self, other):
        return self._path() == (other._path() if isinstance(other, _Dyn) else other)

    def __hash__(self):
        return hash(self._path())

    def __getattr__(self, name):               # glob, mkdir, is_dir, parent, name ...
        return getattr(self._path(), name)


WORKSPACE = _Dyn(workspace_dir)
CACHE_DIR = _Dyn(lambda: workspace_dir() / "cache")          # shared by every profile
PROFILES_DIR = _Dyn(lambda: workspace_dir() / "profiles")

GUEST = "_guest"
DEFAULT_PROFILE = "podcast"
_PROFILE_ID = re.compile(r"[a-z0-9][a-z0-9_-]{0,39}")

_profile: contextvars.ContextVar = contextvars.ContextVar("klipian_profile", default=None)


def valid_profile_id(pid) -> bool:
    return isinstance(pid, str) and (pid == GUEST or bool(_PROFILE_ID.fullmatch(pid)))


def set_profile(pid: str | None):
    """Make `pid` the profile of the current request/job (returns the token to undo it)."""
    if pid is not None and not valid_profile_id(pid):
        raise ValueError(f"not a profile id: {pid!r}")
    return _profile.set(pid)


def current_profile() -> str:
    """The profile of what is running now: the request's or job's; for the CLI and
    scripts, $KLIPIAN_PROFILE, else "podcast"."""
    pid = _profile.get() or os.environ.get("KLIPIAN_PROFILE") or DEFAULT_PROFILE
    if not valid_profile_id(pid):
        raise ValueError(f"not a profile id: {pid!r}")
    return pid


def profile_dir(pid: str | None = None) -> Path:
    return workspace_dir() / "profiles" / (pid or current_profile())


SOURCES = _Dyn(lambda: profile_dir() / "sources")
PROJECTS_DIR = _Dyn(lambda: profile_dir() / "projects")
OUT_ROOT = _Dyn(lambda: profile_dir() / "out")
SCHEDULE_DIR = _Dyn(lambda: profile_dir() / "schedule")
ASSETS = _Dyn(lambda: profile_dir() / "assets")
SECRETS = _Dyn(lambda: profile_dir() / "secrets")


_RESERVED_DIRNAMES = frozenset(
    ["CON", "PRN", "AUX", "NUL"] + [f"COM{i}" for i in range(1, 10)] + [f"LPT{i}" for i in range(1, 10)])


def safe_dirname(name: str) -> str:
    """A folder name made from a video's stem (cache/thumbs/<stem>/, out/<stem>/ ...).

    Windows silently drops spaces and dots at the END of a folder name, so a video
    called "Ibu-ibu .mp4" (stem "Ibu-ibu ") got a folder called "Ibu-ibu" while the
    code went on using the path WITH the space -- and every file written under it
    failed (a broken thumbnail). So the name is made what the file system will keep:
    no spaces or dots at either end, no characters it refuses, never empty, never a
    device name (CON, NUL, COM1 ...). Names that were already fine come out unchanged.
    """
    n = re.sub(r'[<>:"/\\|?*\x00-\x1f]', " ", str(name or "")).strip(" .")
    if not n:
        n = "video"
    if n.upper() in _RESERVED_DIRNAMES:
        n += "-video"
    return n


# Quote characters never stay in a file name we make (a quote copied as a straight one breaks the
# "source" line of Claude's reply; see ytdl.py). An apostrophe inside a word goes too ("Don't" -> "Dont").
_QUOTES = "\"\u201c\u201d\u201e\u201f'\u2018\u2019\u201a\u201b`\u00b4\u00ab\u00bb\u2039\u203a"
_NO_QUOTES = {ord(c): None for c in _QUOTES}


def safe_name(text: str) -> str:
    """A file or folder name from free text: quotes removed, what Windows refuses removed, spaces
    collapsed, no space or dot at either end. "" when nothing is left."""
    text = (text or "").translate(_NO_QUOTES)
    return " ".join(safe_dirname(text).split()).strip(" .") if text.strip() else ""


def find_video(name: str) -> Path | None:
    """Browsers don't provide full paths, just filenames. A source video is
    looked up by name in the profile's sources/ and nowhere else: a render in
    out/ must never be mistaken for a source."""
    # Prevent path traversal: the name must be ONE path component. Looking at
    # the components (not for ".." anywhere in the text) keeps a name like
    # "Wow... ep.mp4" usable; ":" would be a drive or a stream name on Windows.
    if (not name or name in (".", "..") or any(c in name for c in "/\\:\x00")
            or Path(name).name != name):
        return None
    p = SOURCES / name
    return p if p.is_file() else None


# The term glossary every transcription uses unless told otherwise; it is
# part of the transcript cache key (see Cache.transcript_path).
GLOSSARY = ROOT / "prompts" / "glossary.txt"
