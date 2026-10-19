"""Where things live. Everything else imports its folders from here."""

from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
# All working files (source video, rendered output, cache, project, assets)
# live in THIS ONE folder -- not scattered (previously samples/out/cache/
# projects/ each at root), so new klipian users aren't confused about where
# to put videos (see workspace/README.md).
WORKSPACE = ROOT / "workspace"


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


def find_video(name: str) -> Path | None:
    """Browsers don't provide full paths, just filenames. A source video is
    looked up by name in workspace/sources/ and nowhere else: a render in
    out/ must never be mistaken for a source."""
    # Prevent path traversal: the name must be ONE path component. Looking at
    # the components (not for ".." anywhere in the text) keeps a name like
    # "Wow... ep.mp4" usable; ":" would be a drive or a stream name on Windows.
    if (not name or name in (".", "..") or any(c in name for c in "/\\:\x00")
            or Path(name).name != name):
        return None
    p = WORKSPACE / "sources" / name
    return p if p.is_file() else None


# The term glossary every transcription uses unless told otherwise; it is
# part of the transcript cache key (see Cache.transcript_path).
GLOSSARY = ROOT / "prompts" / "glossary.txt"
