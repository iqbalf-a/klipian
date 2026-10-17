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
    workspace/samples/, now sources/) changed its fingerprint, so old projects/caches
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

    def probe_path(self, video: Path) -> Path:
        """What ffprobe said about a video (the Sources panel's durations) --
        video fingerprint only, so a file that is replaced is read again."""
        fp = fingerprint(video)
        return self.root / f"{Path(video).stem}.{fp}.probe.json"

    def cues_path(self, video: Path) -> Path:
        """Raw audio cues (cues.run_audio_cues) -- video fingerprint only:
        they depend on the audio, not on the transcript or its settings."""
        fp = fingerprint(video)
        return self.root / f"{Path(video).stem}.{fp}.cues.json"

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

    def find_transcript(self, video: Path, model: str | None = None,
                        language: str | None = None, glossary: Path | None = None) -> Path | None:
        """THE transcript for a video -- the one rule every reader uses
        (captions in a render, the brief, the editor, the CLI).

        The one transcribed with exactly these settings if there is one (the
        defaults are what the app transcribes with); otherwise the newest
        transcript made for a video of this name. A transcript made with other
        settings, or before the video file or the glossary was touched, is
        still the right words, and asking people to re-transcribe a 40-minute
        episode for that would be worse than using it.

        `video` may name a file that isn't there: then only the second rule
        can apply."""
        from .paths import GLOSSARY
        from .transcribe import DEFAULT_LANGUAGE, DEFAULT_MODEL
        if glossary is None and GLOSSARY.is_file():
            glossary = GLOSSARY
        try:
            exact = self.transcript_path(video, model or DEFAULT_MODEL,
                                        language or DEFAULT_LANGUAGE, glossary)
        except OSError:
            exact = None
        if exact is not None and exact.is_file():
            return exact
        prefix = Path(video).stem + "."
        matches = sorted((p for p in self.root.glob("*.transcript.json")
                          if p.name.startswith(prefix)),
                         key=lambda p: p.stat().st_mtime, reverse=True)
        return matches[0] if matches else None
