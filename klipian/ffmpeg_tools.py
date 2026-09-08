"""Thin wrapper around ffmpeg/ffprobe.

klipian doesn't use any editor application. All media processing goes
through ffmpeg, called directly from here.
"""

from __future__ import annotations

import json
import shutil
import subprocess
from functools import lru_cache
from pathlib import Path

from .models import MediaInfo


class FFmpegMissing(RuntimeError):
    pass


def _require(binary: str) -> str:
    found = shutil.which(binary)
    if not found:
        raise FFmpegMissing(
            f"'{binary}' was not found on PATH.\n"
            "klipian needs ffmpeg. Download a full build from https://www.gyan.dev/ffmpeg/builds/ "
            "then add its bin folder to PATH."
        )
    return found


def run(args: list[str], desc: str = "",
        timeout: float = 3600) -> subprocess.CompletedProcess:
    """A timeout is mandatory: a corrupt file or a hung network drive can
    make ffprobe/ffmpeg never return, and the server's job thread would
    hang forever along with it, holding the video's lock."""
    try:
        proc = subprocess.run(args, capture_output=True, text=True,
                              encoding="utf-8", errors="replace", timeout=timeout)
    except subprocess.TimeoutExpired:
        raise RuntimeError(
            f"ffmpeg did not respond{' while ' + desc if desc else ''} "
            f"after {timeout:.0f} seconds. The file may be corrupt."
        ) from None
    if proc.returncode != 0:
        tail = (proc.stderr or "").strip().splitlines()[-12:]
        raise RuntimeError(
            f"ffmpeg failed{' while ' + desc if desc else ''} (exit {proc.returncode}):\n"
            + "\n".join(tail)
        )
    return proc


def probe(path: Path) -> MediaInfo:
    """Read media metadata via ffprobe."""
    ffprobe = _require("ffprobe")
    path = Path(path)
    if not path.exists():
        raise FileNotFoundError(f"File not found: {path}")

    proc = run(
        [
            ffprobe, "-v", "error",
            "-print_format", "json",
            "-show_format", "-show_streams",
            str(path),
        ],
        desc="reading metadata",
    )
    data = json.loads(proc.stdout)

    streams = data.get("streams", [])
    vstream = next((s for s in streams if s.get("codec_type") == "video"), None)
    astream = next((s for s in streams if s.get("codec_type") == "audio"), None)

    duration = float(data.get("format", {}).get("duration") or 0.0)

    fps = 0.0
    width = height = 0
    vcodec = ""
    if vstream:
        width = int(vstream.get("width") or 0)
        height = int(vstream.get("height") or 0)
        vcodec = vstream.get("codec_name", "")
        rate = vstream.get("avg_frame_rate") or vstream.get("r_frame_rate") or "0/1"
        try:
            num, den = rate.split("/")
            fps = float(num) / float(den) if float(den) else 0.0
        except (ValueError, ZeroDivisionError):
            fps = 0.0
        if not duration:
            duration = float(vstream.get("duration") or 0.0)

    return MediaInfo(
        path=str(path),
        duration=duration,
        width=width,
        height=height,
        fps=fps,
        has_audio=astream is not None,
        vcodec=vcodec,
        acodec=(astream or {}).get("codec_name", ""),
    )


def extract_audio(src: Path, dest: Path) -> Path:
    """Extract audio as 16kHz mono PCM WAV -- the format Whisper expects.

    Deliberately not loudness-normalized: changing the audio's dynamics can
    shift silence-detection (VAD) results and throw off the timestamps.
    """
    ffmpeg = _require("ffmpeg")
    dest = Path(dest)
    dest.parent.mkdir(parents=True, exist_ok=True)
    run(
        [
            ffmpeg, "-y", "-loglevel", "error",
            "-i", str(src),
            "-vn",
            "-ac", "1",
            "-ar", "16000",
            "-c:a", "pcm_s16le",
            str(dest),
        ],
        desc="extracting audio",
    )
    return dest


@lru_cache(maxsize=8)
def has_encoder(name: str) -> bool:
    """Check encoder availability, used to choose h264_qsv vs libx264.

    Cached: the encoder list doesn't change during the process's lifetime,
    while without caching every clip in the queue would call ffmpeg again.

    Keep in mind this only proves the encoder EXISTS in the ffmpeg build,
    not that it runs on this machine -- see the fallback path in render.py.
    """
    try:
        ffmpeg = _require("ffmpeg")
    except FFmpegMissing:
        return False
    try:
        proc = subprocess.run(
            [ffmpeg, "-hide_banner", "-encoders"],
            capture_output=True, text=True, encoding="utf-8", errors="replace",
            timeout=30,
        )
    except (subprocess.TimeoutExpired, OSError):
        # ffmpeg hung or failed to run -- assume the encoder is unavailable
        # and let the caller fall back to libx264.
        return False
    if proc.returncode != 0:
        return False
    return any(line.split()[1:2] == [name] for line in proc.stdout.splitlines() if line.strip())
