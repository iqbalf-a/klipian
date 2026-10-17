"""Where things live. Everything else imports its folders from here."""

from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
# All working files (source video, rendered output, cache, project, assets)
# live in THIS ONE folder -- not scattered (previously samples/out/cache/
# projects/ each at root), so new klipian users aren't confused about where
# to put videos (see workspace/README.md).
WORKSPACE = ROOT / "workspace"


def find_video(name: str) -> Path | None:
    """Browsers don't provide full paths, just filenames. Search the folders
    the server can reach."""
    # Prevent path traversal: the name must be ONE path component. Looking at
    # the components (not for ".." anywhere in the text) keeps a name like
    # "Wow... ep.mp4" usable; ":" would be a drive or a stream name on Windows.
    if (not name or name in (".", "..") or any(c in name for c in "/\\:\x00")
            or Path(name).name != name):
        return None
    for folder in ("samples", "", "out"):
        p = WORKSPACE / folder / name if folder else WORKSPACE / name
        if p.is_file():
            return p
    return None


# The term glossary every transcription uses unless told otherwise; it is
# part of the transcript cache key (see Cache.transcript_path).
GLOSSARY = ROOT / "prompts" / "glossary.txt"
