"""Cache transkrip.

Alasan keberadaan file ini: transkripsi CPU untuk podcast 1 jam butuh
belasan menit, sementara menyetel rubrik pemilihan klip perlu diulang
berkali-kali. Tanpa cache, setiap percobaan membayar ongkos transkripsi lagi.
Dengan cache, ongkos itu dibayar sekali per video.
"""

from __future__ import annotations

import hashlib
from pathlib import Path


def fingerprint(path: Path, extra: str = "") -> str:
    """Identitas file berbasis path+ukuran+mtime.

    Sengaja tidak menghash seluruh isi file -- video 2GB akan lambat dibaca,
    sementara kombinasi ini sudah cukup membedakan dalam pemakaian normal.
    """
    p = Path(path).resolve()
    st = p.stat()
    raw = f"{p}|{st.st_size}|{st.st_mtime_ns}|{extra}"
    return hashlib.sha1(raw.encode("utf-8")).hexdigest()[:16]


class Cache:
    def __init__(self, root: Path):
        self.root = Path(root)
        self.root.mkdir(parents=True, exist_ok=True)

    def transcript_path(self, video: Path, model: str, language: str) -> Path:
        fp = fingerprint(video, extra=f"{model}|{language}")
        return self.root / f"{Path(video).stem}.{fp}.transcript.json"

    def audio_path(self, video: Path) -> Path:
        fp = fingerprint(video)
        return self.root / f"{Path(video).stem}.{fp}.wav"
