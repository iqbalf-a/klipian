"""Detects moments of high audio energy -- a supplement to the transcript for
Claude's brief.

Whisper only writes down the WORDS spoken. Audience laughter, cheering, or
a loud reaction rarely gets transcribed as reliable text -- and even when it
does, it's inconsistent ("haha", "(laughs)", or not at all). This module
answers through a different path: purely from the VOLUME of the sound,
regardless of what's said. An energy spike far above this video's OWN
average is likely a standout reaction/moment -- a supporting signal for
Claude, not a certain fact (the correct clip boundary is still determined
from the surrounding sentence context).

Adapted from the reference Auto-clipper/analysis/audio_detector.py
(D:\\github-repos\\github-autoclipper) -- its levels come via
`ffmpeg -af astats`, no model, no new dependency. Two differences:

  1. The reference uses a FIXED decibel threshold per-game (needs a profile
     per content type). Here the threshold is ADAPTIVE -- a percentile of
     the video's own level distribution -- so a quiet podcast and a loud
     recording both make sense without needing manual calibration.
  2. The reference forces clusters into ready-to-use clip durations (min/max/
     extension) and labels their content ("Gunfire/Explosion" etc -- game-
     specific). Here it's just the raw time range + a bit of context
     padding; Claude is the one who decides the clip boundary and
     interprets its content.
"""

from __future__ import annotations

import re
from pathlib import Path

# Header line is "frame:N    pts:N    pts_time:N" -- ONE line, pts_time is
# NOT at the start of its own line as originally assumed (inherited from the
# reference's assumption too). startswith("pts_time:") therefore never matched
# -- current_time never advanced from 0, and ALL levels in the entire file
# were misread as second 0. Verified directly via CLI before being fixed to
# regex-search instead of startswith.
_PTS_TIME_RE = re.compile(r"pts_time:(-?[\d.]+)")

# astats's reset=N does NOT count in samples as the original reference assumed
# (which assumed reset=48000 ~ 1 second at 48kHz) -- tested directly via CLI,
# reset=16000 doesn't even reset at all in the first 10 seconds. The reset
# unit in astats is FRAME of the internal filter, not samples, and the frame
# size itself is not guaranteed. The fix: force frame size to EXACTLY
# _SAMPLE_RATE samples via asetnsamples first, then reset=1 (reset every
# frame) -- so every frame = every SECOND, guaranteed, not guessed.
# Verified: pts_time outputs exactly 0,1,2,3... with Peak_level genuinely
# different each second (not cumulative values disguised).
_SAMPLE_RATE = 16000


# percentile=97 chosen from real-world testing, not a guess: on a 42-minute
# podcast (radityadika-podcast.mp4) and a 5-minute gameplay clip, 90 marked
# ~20% and ~27% of the video as "prominent" -- too loose for signals that are
# supposedly "unusual". 97 marks ~7-9% on both, proportions consistent across
# two content types with vastly different levels -- that's the proof this
# adaptive threshold works without needing per-content-type profiles like the
# reference.
def find_loud_moments(video: Path, percentile: float = 97.0,
                      merge_gap: float = 4.0, pad: float = 1.0) -> list[dict]:
    """Time ranges with audio energy far above this video's average.

    -> [{"start": float, "end": float, "peak_db": float}, ...] sorted by time.
    Video without audio / analysis failure -> [] (intentionally non-fatal --
    this is a supplementary feature, its failure must not crash the
    transcription that calls it)."""
    from .ffmpeg_tools import _require, probe, run

    try:
        info = probe(video)
    except Exception:                                  # noqa: BLE001
        return []
    if not info.has_audio:
        return []

    try:
        ffmpeg = _require("ffmpeg")
        proc = run([
            ffmpeg, "-i", str(video),
            "-af", f"aresample={_SAMPLE_RATE},asetnsamples=n={_SAMPLE_RATE}:p=0,"
                   "astats=metadata=1:reset=1,"
                   "ametadata=print:key=lavfi.astats.Overall.Peak_level:file=-",
            "-f", "null", "-",
        ], desc="analyzing audio energy",
           timeout=max(1800, info.duration * 4 if info.duration else 1800))
    except Exception:                                  # noqa: BLE001
        return []

    levels = _parse_astats(proc.stdout)
    if len(levels) < 10:
        # Clip too short or parsing completely failed -- percentile from a
        # handful of points means nothing, don't mark anything.
        return []

    threshold = _percentile(sorted(levels.values()), percentile)
    windows = _cluster(levels, threshold, merge_gap)

    dur = info.duration or max(levels) + 1
    return [
        {"start": round(max(0.0, s - pad), 2),
         "end": round(min(dur, e + 1 + pad), 2),
         "peak_db": round(p, 1)}
        for (s, e, p) in windows
    ]


def _parse_astats(stdout: str) -> dict[int, float]:
    """`ametadata=print` output -> {second: highest_peak_dB_in_that_second}.
    Format is per-frame blocks: line "frame:N pts:N pts_time:N" (ONE line,
    see _PTS_TIME_RE) followed by "lavfi.astats.Overall.Peak_level=Y"
    for that frame."""
    levels: dict[int, float] = {}
    current_time = 0.0
    for raw in stdout.splitlines():
        line = raw.strip()
        m = _PTS_TIME_RE.search(line)
        if m:
            try:
                current_time = float(m.group(1))
            except ValueError:
                pass
            continue
        if line.startswith("lavfi.astats.Overall.Peak_level="):
            try:
                level = float(line.split("=", 1)[1])
            except (ValueError, IndexError):
                continue
            sec = int(current_time)
            if sec not in levels or level > levels[sec]:
                levels[sec] = level
    return levels


def _percentile(ordered: list[float], pct: float) -> float:
    if not ordered:
        return 0.0
    idx = min(len(ordered) - 1, max(0, int(len(ordered) * pct / 100)))
    return ordered[idx]


def _cluster(levels: dict[int, float], threshold: float,
            merge_gap: float) -> list[tuple[int, int, float]]:
    """Adjacent seconds >= threshold (gap <= merge_gap) are merged into
    one window (start, end, peak)."""
    loud = sorted(sec for sec, lvl in levels.items() if lvl >= threshold)
    if not loud:
        return []

    windows: list[tuple[int, int, float]] = []
    start = prev = loud[0]
    peak = levels[loud[0]]
    for sec in loud[1:]:
        if sec - prev <= merge_gap:
            peak = max(peak, levels[sec])
            prev = sec
            continue
        windows.append((start, prev, peak))
        start = prev = sec
        peak = levels[sec]
    windows.append((start, prev, peak))
    return windows
