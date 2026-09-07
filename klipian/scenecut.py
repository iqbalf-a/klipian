"""Deteksi potongan visual keras (hard cut) di video SUMBER -- pelengkap
AI Framing.

diarize.py menjawab SIAPA bicara dan KAPAN (audio); facebox.py menjawab KE
MANA kotak harus diarahkan (deteksi wajah). Modul ini menjawab pertanyaan
ketiga yang beda dari keduanya: kapan KOMPOSISI GAMBARNYA SENDIRI berubah --
ganti sudut kamera, zoom keluar jadi close-up, potong ke reaksi orang lain --
meski mic yang sama masih terdengar bicara (diarization tidak melihat
pergantian apa pun di titik itu, karena memang bukan pergantian pembicara).
Tanpa sinyal ini, kotak framing bisa terus menempel ke orang yang benar tapi
tetap salah menyorot begitu video sumbernya sendiri berpindah shot -- AI
Framing dulu sengaja melewatkan kasus ini (lihat catatan lama di
framing.js), sekarang ditangkap lewat sinyal sendiri, dipakai buat memecah
satu giliran bicara jadi beberapa titik lacak di framing.js.

Deteksinya lewat filter `scene` bawaan ffmpeg (skor beda antar-frame 0..1,
dihitung ffmpeg sendiri dari histogram) -- bukan model machine learning,
konsisten dengan facebox.py yang juga sengaja classic CV, tidak nambah
dependency berat.
"""

from __future__ import annotations

import re
from pathlib import Path

_PTS_TIME_RE = re.compile(r"pts_time:([\d.]+)")


def detect_cuts(video: Path, start: float, end: float,
                 threshold: float = 0.6) -> list[float]:
    """Detik (relatif ke video SUMBER, seperti `start`/`end`) tempat
    potongan visual keras terdeteksi di [start, end) -- TIDAK termasuk
    `start` sendiri (itu sudah jadi titik framing dari giliran bicara).

    Ambang 0.6 dipilih empiris terhadap podcast talking-head sungguhan:
    ambang umum 0.3-0.4 yang biasa disarankan untuk scene-detection malah
    menangkap gerak tangan/kedipan cahaya sebagai "potongan" -- puluhan
    per menit, terlalu berisik untuk jadi titik framing. 0.6 baru
    menyisakan potongan yang benar-benar keras (ganti kamera/shot)."""
    from .ffmpeg_tools import _require, run

    dur = max(0.0, end - start)
    if dur <= 0:
        return []

    # showinfo mencetak SATU baris per frame yang lolos filter select= --
    # waktunya (pts_time) relatif ke titik seek (`-ss` sebelum `-i`), BUKAN
    # ke video sumber utuh, jadi `start` ditambahkan manual di bawah. Sama
    # seperti pendekatan facebox._extract_frames() yang juga tidak percaya
    # begitu saja pada pts mentah ffmpeg.
    proc = run([
        _require("ffmpeg"), "-loglevel", "info",
        "-ss", f"{start:.3f}", "-i", str(video), "-t", f"{dur:.3f}",
        "-vf", f"select='gt(scene,{threshold})',showinfo",
        "-an", "-f", "null", "-",
    ], desc="mendeteksi potongan visual")

    cuts = []
    for m in _PTS_TIME_RE.finditer(proc.stderr or ""):
        t = start + float(m.group(1))
        if start < t < end:          # jepit overshoot GOP terakhir
            cuts.append(round(t, 3))
    return cuts
