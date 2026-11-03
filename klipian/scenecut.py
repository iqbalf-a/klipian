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


# a real cut moves the picture by 50+ of 255 between two frames (thumbnail mean difference); gesturing and a camera
# push stay under ~15 (measured on three TV episodes), so the margin is wide where the scene score's is thin
THUMB_JUMP = 30.0
THUMB_RATIO = 2.5       # ... and it is this many times the movement around it
_THUMB_W, _THUMB_H = 64, 36
_PTS_FRAME_RE = re.compile(r"n:\s*\d+ pts:\s*-?\d+ pts_time:(-?[\d.]+)")


def thumbnail_jumps(video: Path, start: float, end: float) -> list[tuple[float, float, float]]:
    """[(time of the frame, jump from the frame before, movement around it)] of every frame in [start, end) whose
    jump from the previous frame is a cut by thumbnail difference. Times are the frames' own timestamps."""
    import subprocess

    import numpy as np

    from .ffmpeg_tools import _require

    dur = max(0.0, end - start)
    if dur <= 0:
        return []
    proc = subprocess.run(
        [_require("ffmpeg"), "-loglevel", "info", "-ss", f"{max(0.0, start - 0.2):.3f}", "-copyts", "-t", f"{dur + 0.4:.3f}", "-i", str(video),
         "-an", "-vf", f"scale={_THUMB_W}:{_THUMB_H}:flags=area,format=gray,showinfo", "-f", "rawvideo", "-"],
        capture_output=True, timeout=600)
    times = [float(m.group(1)) for m in _PTS_FRAME_RE.finditer(proc.stderr.decode("utf-8", "replace"))]
    fr = np.frombuffer(proc.stdout, np.uint8)
    n = min(len(times), len(fr) // (_THUMB_W * _THUMB_H))
    if n < 2:
        return []
    fr = fr[:n * _THUMB_W * _THUMB_H].reshape(n, _THUMB_H, _THUMB_W).astype(np.float32)
    d = np.abs(np.diff(fr, axis=0)).mean(axis=(1, 2))              # d[i]: frame i -> i + 1
    out = []
    for i in range(len(d)):
        t = times[i + 1]
        if d[i] < THUMB_JUMP or not (start < t < end):
            continue
        around = np.concatenate([d[max(0, i - 3):i], d[i + 1:i + 4]])
        move = float(around.max()) if len(around) else 0.0
        if d[i] >= THUMB_RATIO * max(move, 1.0):
            out.append((t, float(d[i]), move))
    return out


def detect_cuts_exact(video: Path, start: float, end: float, threshold: float = 0.35) -> list[float]:
    """The cuts of the scene score (`threshold`) and of the thumbnail difference, as one list of frame times
    (a cut both find, or two a frame apart, counted once): the first frame of the new shot."""
    jumps = [t for t, _, _ in thumbnail_jumps(video, start, end)]
    cuts = []
    for t in sorted(jumps + detect_cuts(video, start, end, threshold)):
        if not cuts or t - cuts[-1] > 0.05:
            cuts.append(t)
        elif t in jumps and cuts[-1] not in jumps:
            cuts[-1] = t                                           # the thumbnail time is the frame's own
    return [_floor_ms(t) for t in cuts]


def _floor_ms(t: float) -> float:
    """Down to the millisecond: a time rounded up could miss the frame it names."""
    import math

    return math.floor(t * 1000 + 1e-6) / 1000
