"""Pembungkus tipis di atas ffmpeg/ffprobe.

klipian tidak memakai aplikasi editor apa pun. Seluruh pemrosesan media
lewat ffmpeg yang dipanggil langsung dari sini.
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
            f"'{binary}' tidak ditemukan di PATH.\n"
            "klipian butuh ffmpeg. Unduh build lengkap dari https://www.gyan.dev/ffmpeg/builds/ "
            "lalu tambahkan folder bin-nya ke PATH."
        )
    return found


def run(args: list[str], desc: str = "",
        timeout: float = 3600) -> subprocess.CompletedProcess:
    """Timeout wajib ada: berkas rusak atau drive jaringan yang menggantung
    bisa membuat ffprobe/ffmpeg tidak pernah kembali, dan thread job di server
    ikut menggantung selamanya sambil menahan kunci video."""
    try:
        proc = subprocess.run(args, capture_output=True, text=True,
                              encoding="utf-8", errors="replace", timeout=timeout)
    except subprocess.TimeoutExpired:
        raise RuntimeError(
            f"ffmpeg tidak merespons{' saat ' + desc if desc else ''} "
            f"setelah {timeout:.0f} detik. Berkasnya mungkin rusak."
        ) from None
    if proc.returncode != 0:
        tail = (proc.stderr or "").strip().splitlines()[-12:]
        raise RuntimeError(
            f"ffmpeg gagal{' saat ' + desc if desc else ''} (exit {proc.returncode}):\n"
            + "\n".join(tail)
        )
    return proc


def probe(path: Path) -> MediaInfo:
    """Baca metadata media lewat ffprobe."""
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
        desc="membaca metadata",
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
    """Ekstrak audio jadi WAV 16kHz mono PCM -- format yang diminta Whisper.

    Sengaja tidak dinormalisasi loudness: mengubah dinamika audio bisa
    menggeser hasil deteksi silence (VAD) dan bikin timestamp meleset.
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
        desc="mengekstrak audio",
    )
    return dest


@lru_cache(maxsize=8)
def has_encoder(name: str) -> bool:
    """Cek ketersediaan encoder, dipakai untuk memilih h264_qsv vs libx264.

    Di-cache: daftar encoder tidak berubah selama proses hidup, sementara
    tanpa cache setiap klip dalam antrian memanggil ffmpeg sekali lagi.

    Perlu diingat ini hanya membuktikan encodernya ADA di build ffmpeg, bukan
    bahwa ia jalan di mesin ini -- lihat jalur mundur di render.py.
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
        # ffmpeg menggantung atau gagal dijalankan -- anggap encoder tak ada
        # dan biarkan pemanggil pakai jalur mundur libx264.
        return False
    if proc.returncode != 0:
        return False
    return any(line.split()[1:2] == [name] for line in proc.stdout.splitlines() if line.strip())
