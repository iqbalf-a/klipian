"""Detect hard visual cuts in the SOURCE video -- complement to AI Framing.

diarize.py answers WHO speaks and WHEN (audio); facebox.py answers WHERE
the box should point (face detection). This module answers the third,
different question: when does the IMAGE COMPOSITION ITSELF change -- camera
angle switch, zoom into a close-up, cut to someone else's reaction --
even though the same mic is still heard speaking (diarization sees no
speaker change at that point, because it isn't one). Without this signal,
the framing box can keep tracking the right person but still point
incorrectly once the source video switches shots -- AI Framing intentionally
skipped this case in the past (see old notes in framing.js), now captured
via its own signal, used to split a single speaking turn into multiple
tracking points in framing.js.

Detection uses ffmpeg's built-in `scene` filter (inter-frame difference
score 0..1, computed by ffmpeg itself from histograms) -- not a machine
learning model, consistent with facebox.py which is also intentionally
classic CV, keeping dependencies light.
"""

from __future__ import annotations

import re
from pathlib import Path

_PTS_TIME_RE = re.compile(r"pts_time:([\d.]+)")


def detect_cuts(video: Path, start: float, end: float,
                 threshold: float = 0.6) -> list[float]:
    """Seconds (relative to the SOURCE video, like `start`/`end`) where
    hard visual cuts are detected in [start, end) -- NOT including `start`
    itself (that's already the framing point from the speaking turn).

    Threshold 0.6 was chosen empirically against real talking-head podcasts:
    the common 0.3-0.4 threshold typically recommended for scene detection
    catches hand gestures / light flickers as "cuts" -- dozens per minute,
    too noisy to be framing points. 0.6 keeps only truly hard cuts
    (camera/shot changes)."""
    from .ffmpeg_tools import _require, run

    dur = max(0.0, end - start)
    if dur <= 0:
        return []

    # showinfo prints ONE line per frame that passes the select= filter --
    # its timestamp (pts_time) is relative to the seek point (`-ss` before
    # `-i`), NOT to the whole source video, so `start` is added manually
    # below. Same approach as facebox._extract_frames() which also doesn't
    # blindly trust ffmpeg's raw pts.
    proc = run([
        _require("ffmpeg"), "-loglevel", "info",
        "-ss", f"{start:.3f}", "-i", str(video), "-t", f"{dur:.3f}",
        "-vf", f"select='gt(scene,{threshold})',showinfo",
        "-an", "-f", "null", "-",
    ], desc="detecting visual cuts")

    cuts = []
    for m in _PTS_TIME_RE.finditer(proc.stderr or ""):
        t = start + float(m.group(1))
        if start < t < end:          # clamp overshoot from the last GOP
            cuts.append(round(t, 3))
    return cuts
