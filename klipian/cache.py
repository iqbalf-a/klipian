"""Transcript cache.

Why this file exists: CPU transcription for a 1-hour podcast takes over
ten minutes, while tuning the clip-selection rubric needs to be repeated
many times. Without a cache, every attempt pays the transcription cost
again. With the cache, that cost is paid once per video.
"""

from __future__ import annotations

import hashlib
from pathlib import Path


def fingerprint(path: Path, extra: str = "") -> str:
    """File identity based on size+mtime -- DELIBERATELY excludes the path.

    The path used to be part of the hash, but that meant moving the video
    to another folder (exactly what happened when samples/ was merged into
    workspace/samples/) changed its fingerprint, so old projects/caches
    could no longer be found even though the video was identical -- it
    looked like lost work when it was really just "wrong cabinet".
    Size+mtime alone is enough to distinguish videos whose content actually
    changed, and is resilient to a video simply being moved/renamed.

    Deliberately doesn't hash the whole file content -- a 2GB video would
    be slow to read, and this combination is already enough to distinguish
    videos in normal use.
    """
    st = Path(path).stat()
    raw = f"{st.st_size}|{st.st_mtime_ns}|{extra}"
    return hashlib.sha1(raw.encode("utf-8")).hexdigest()[:16]


def glossary_fingerprint(path: Path | None) -> str:
    """Glossary fingerprint based on size+mtime -- goes into the transcript
    cache key so editing glossary.txt forces a re-transcription, instead of
    silently reusing an old transcript that didn't get the correction."""
    if not path:
        return ""
    p = Path(path)
    if not p.exists():
        return ""
    st = p.stat()
    return f"{st.st_size}|{st.st_mtime_ns}"


class Cache:
    def __init__(self, root: Path):
        self.root = Path(root)
        self.root.mkdir(parents=True, exist_ok=True)

    def transcript_path(self, video: Path, model: str, language: str,
                        glossary: Path | None = None) -> Path:
        gfp = glossary_fingerprint(glossary)
        fp = fingerprint(video, extra=f"{model}|{language}|{gfp}")
        return self.root / f"{Path(video).stem}.{fp}.transcript.json"

    def audio_path(self, video: Path) -> Path:
        fp = fingerprint(video)
        return self.root / f"{Path(video).stem}.{fp}.wav"

    def energy_path(self, video: Path) -> Path:
        """High audio-energy moments (audio_energy.find_loud_moments) --
        video fingerprint only, doesn't depend on model/language like
        transcript_path()."""
        fp = fingerprint(video)
        return self.root / f"{Path(video).stem}.{fp}.energy.json"

    def diarize_path(self, video: Path, start: float, end: float) -> Path:
        """AI Framing speaker turns for one [start, end) span -- range goes
        into the fingerprint (rounded to 10ms, plenty for a cache key) so
        each span of a multi-span Result gets its own entry, and a slightly
        adjusted range (e.g. after nudging an AI suggestion's start time)
        correctly misses the cache instead of reusing a stale span's turns.
        Same reasoning as transcript_path() -- diarization is the single
        most expensive AI Framing stage (usually 25-35s), and re-running
        AI Framing on a clip that hasn't changed (adjusting output size,
        retrying after a failed locate step) shouldn't pay that again."""
        fp = fingerprint(video, extra=f"{round(start, 2)}|{round(end, 2)}")
        return self.root / f"{Path(video).stem}.{fp}.diarize.json"

    def find_any_transcript(self, video: Path) -> Path | None:
        """Any transcript for this video, regardless of model/lang/glossary.

        Used by the render path for captions: if a transcript exists, use
        it; no need to guess the exact combination that video was
        transcribed with. Picks the most recent one if there are several."""
        matches = sorted(self.root.glob(f"{Path(video).stem}.*.transcript.json"),
                         key=lambda p: p.stat().st_mtime, reverse=True)
        return matches[0] if matches else None
