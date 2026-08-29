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


def glossary_fingerprint(path: Path | None) -> str:
    """Sidik jari glosarium berbasis ukuran+mtime -- masuk ke kunci cache
    transkrip supaya menyunting glossary.txt memaksa transkripsi ulang, bukan
    diam-diam memakai transkrip lama yang koreksinya belum kena."""
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

    def find_any_transcript(self, video: Path) -> Path | None:
        """Transkrip apa pun untuk video ini, tanpa peduli model/lang/glossary.

        Dipakai jalur render untuk caption: kalau ada transkrip, pakai; tidak
        perlu menebak dengan kombinasi persis mana video itu ditranskripsi.
        Ambil yang paling baru kalau ada beberapa."""
        cocok = sorted(self.root.glob(f"{Path(video).stem}.*.transcript.json"),
                       key=lambda p: p.stat().st_mtime, reverse=True)
        return cocok[0] if cocok else None
