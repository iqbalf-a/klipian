"""Which version of klipian's Python code is this server running, and which is on disk?

The pages are static files read from disk on every request, so they are always the
newest; the server's routes are the Python it loaded when it STARTED. After an update
the two can disagree (a page calls an endpoint the old server never had: "unknown
endpoint"). The server hashes klipian/*.py when it starts and again, when asked, from
disk: /api/version reports both, and the pages show a banner when they differ.
"""

from __future__ import annotations

import hashlib
from pathlib import Path

PACKAGE = Path(__file__).resolve().parent

_cache: tuple | None = None          # (signature of the files, hash)


def _files() -> list[Path]:
    return sorted(PACKAGE.glob("*.py"))


def current() -> str:
    """Hash of the contents of klipian/*.py as they are on disk now (re-read only
    when a file's size or modified time changed)."""
    global _cache
    files = _files()
    signature = tuple((f.name, f.stat().st_size, f.stat().st_mtime_ns) for f in files)
    if _cache and _cache[0] == signature:
        return _cache[1]
    h = hashlib.sha256()
    for f in files:
        h.update(f.name.encode())
        h.update(f.read_bytes())
    _cache = (signature, h.hexdigest()[:16])
    return _cache[1]


STARTED = current()                  # what this process loaded
