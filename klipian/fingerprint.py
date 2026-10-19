"""What a render is compared by in the selftest, beyond its bytes.

A render's bytes depend on the toolchain: an ffmpeg upgrade changes the AAC
encoder (and the encoder tags in the container) while the H.264 stream stays the
same. So a baseline records, next to the file hashes:

  ffmpeg      the version line of the ffmpeg that made it,
  video_md5   the md5 of the video stream's packets (`-c copy`): must be EXACTLY
              equal, a different video stream is a different render;
  audio       a small fingerprint of the decoded sound (mono, 48 kHz): the
              number of samples and the RMS level per 50 ms window, in dBFS.
              Different AAC encoders give the same sound to within a fraction of
              a dB (about 37 dB SNR measured between ffmpeg 8.1 and 9.0), which a
              tolerance can accept -- while audio that went missing, shifted or
              got quieter (a clip's volume bug) cannot pass.
"""

from __future__ import annotations

import subprocess
from pathlib import Path

from .ffmpeg_tools import _require

WINDOW_MS = 50
RATE = 48000
WINDOW = RATE * WINDOW_MS // 1000
# Windows quieter than this (either side) are not compared: noise floor.
FLOOR_DB = -50.0
# Per-window level difference accepted between two encoders of the same sound.
TOLERANCE_DB = 1.0
# Sample count may differ by this much (a couple of AAC frames of 1024).
SAMPLE_SLACK = 2048


def ffmpeg_version() -> str:
    """The first line of `ffmpeg -version`, e.g. "ffmpeg version 9.0.2-full_build ..."."""
    out = subprocess.run([_require("ffmpeg"), "-version"], capture_output=True, text=True,
                         encoding="utf-8", errors="replace", timeout=30).stdout
    return (out.splitlines() or [""])[0].strip()


def video_md5(path: Path) -> str:
    """md5 of the first video stream's packets, without decoding."""
    proc = subprocess.run([_require("ffmpeg"), "-v", "error", "-i", str(path), "-map", "0:v:0",
                           "-c", "copy", "-f", "md5", "-"], capture_output=True, text=True,
                          encoding="utf-8", errors="replace", timeout=300)
    line = proc.stdout.strip()
    if proc.returncode != 0 or not line.startswith("MD5="):
        raise RuntimeError(f"could not fingerprint the video of {path.name}: {proc.stderr.strip()[-200:]}")
    return line[4:]


def audio_fingerprint(path: Path) -> dict:
    """{"window_ms", "samples", "rms_db": [...]} of the decoded first audio stream."""
    import numpy as np
    proc = subprocess.run([_require("ffmpeg"), "-v", "error", "-i", str(path), "-map", "0:a:0",
                           "-ac", "1", "-ar", str(RATE), "-f", "f32le", "-"],
                          capture_output=True, timeout=300)
    if proc.returncode != 0:
        raise RuntimeError(f"could not decode the audio of {path.name}")
    x = np.frombuffer(proc.stdout, dtype="<f4")
    levels = []
    for i in range(0, len(x), WINDOW):
        w = x[i:i + WINDOW]
        rms = float(np.sqrt(np.mean(w.astype("float64") ** 2))) if len(w) else 0.0
        levels.append(round(20 * np.log10(rms), 1) if rms > 1e-9 else -120.0)
    return {"window_ms": WINDOW_MS, "samples": int(len(x)), "rms_db": levels}


def fingerprint(path: Path) -> dict:
    return {"ffmpeg": ffmpeg_version(), "video_md5": video_md5(path), "audio": audio_fingerprint(path)}


def compare_audio(want: dict, got: dict) -> str:
    """"" when `got` is the same sound as `want` within the tolerance, else why not."""
    if abs(want["samples"] - got["samples"]) > SAMPLE_SLACK:
        return f"audio length differs: {want['samples']} samples in the baseline, {got['samples']} now"
    a, b = want["rms_db"], got["rms_db"]
    if abs(len(a) - len(b)) > 1:
        return f"audio has {len(b)} windows of {WINDOW_MS} ms, the baseline {len(a)}"
    worst, at = 0.0, 0
    for i, (x, y) in enumerate(zip(a, b)):
        if x < FLOOR_DB and y < FLOOR_DB:
            continue
        d = abs(x - y)
        if d > worst:
            worst, at = d, i
    if worst > TOLERANCE_DB:
        return (f"audio level differs by {worst:.1f} dB at {at * WINDOW_MS / 1000:.2f} s "
                f"(tolerance {TOLERANCE_DB} dB)")
    return ""
