"""Deteksi momen energi audio tinggi -- pelengkap transkrip untuk brief Claude.

Whisper cuma menuliskan KATA yang diucapkan. Tawa penonton, sorakan, atau
reaksi keras jarang tertranskripsi sebagai teks yang bisa diandalkan --
kalaupun tertulis, bentuknya tidak konsisten ("haha", "(tertawa)", atau
tidak sama sekali). Modul ini menjawab lewat jalur lain: murni dari VOLUME
suara, tanpa peduli isi katanya. Lonjakan energi jauh di atas rata-rata
video ITU SENDIRI kemungkinan besar reaksi/momen yang menonjol -- sinyal
pendukung buat Claude, bukan fakta pasti (klip yang benar tetap ditentukan
dari konteks kalimat di sekitarnya).

Diadaptasi dari referensi Auto-clipper/analysis/audio_detector.py
(D:\\github-repos\\github-autoclipper) -- levelnya via `ffmpeg -af astats`,
tanpa model, tanpa dependency baru. Dua bedanya:

  1. Referensi memakai ambang desibel TETAP per-game (butuh profil per
     jenis konten). Di sini ambangnya ADAPTIF -- persentil dari distribusi
     level video itu sendiri -- supaya podcast pelan dan rekaman keras
     sama-sama masuk akal tanpa perlu dikalibrasi manual.
  2. Referensi memaksa cluster jadi durasi klip siap-pakai (min/max/
     extension) dan melabeli isinya ("Gunfire/Explosion" dst -- spesifik
     game). Di sini cukup rentang waktu apa adanya + sedikit padding
     konteks; Claude yang menentukan batas klip dan menafsirkan isinya.
"""

from __future__ import annotations

import re
from pathlib import Path

# Baris headernya "frame:N    pts:N    pts_time:N" -- SATU baris, pts_time
# bukan di awal baris sendiri seperti dikira semula (diwarisi dari asumsi
# referensi juga). startswith("pts_time:") makanya tidak pernah cocok --
# current_time tidak pernah maju dari 0, dan SELURUH level di seluruh file
# salah kebaca sebagai detik ke-0. Dicek langsung lewat CLI sebelum
# diperbaiki jadi regex-search, bukan startswith.
_PTS_TIME_RE = re.compile(r"pts_time:(-?[\d.]+)")

# `astats`-nya reset=N TIDAK menghitung dalam sampel seperti dikira referensi
# asli (yang mengasumsikan reset=48000 ~ 1 detik di 48kHz) -- diuji langsung
# lewat CLI, reset=16000 bahkan tidak reset sama sekali dalam 10 detik
# pertama. Satuan reset di astats itu FRAME internal filter, bukan sampel,
# dan ukuran frame itu sendiri tidak dijamin berapa. Perbaikannya: paksa
# ukuran frame jadi PERSIS _SAMPLE_RATE sampel lewat asetnsamples dulu, baru
# reset=1 (reset tiap frame) -- jadi tiap frame = tiap DETIK, dijamin,
# bukan tebakan. Diverifikasi: pts_time keluar persis 0,1,2,3... dengan
# Peak_level yang genuinely beda tiap detik (bukan nilai kumulatif yang
# menyamar).
_SAMPLE_RATE = 16000


# percentile=97 dipilih dari uji nyata, bukan tebakan: di podcast 42 menit
# (radityadika-podcast.mp4) dan cuplikan gameplay 5 menit, 90 menandai
# ~20% dan ~27% dari videonya sebagai "menonjol" -- terlalu longgar untuk
# sinyal yang katanya "di luar kebiasaan". 97 menandai ~7-9% di keduanya,
# proporsinya konsisten lintas dua jenis konten yang levelnya beda jauh --
# itulah buktinya threshold adaptif ini bekerja tanpa perlu profil per-jenis
# konten seperti referensi.
def find_loud_moments(video: Path, percentile: float = 97.0,
                      merge_gap: float = 4.0, pad: float = 1.0) -> list[dict]:
    """Rentang waktu dengan energi audio jauh di atas rata-rata video ini.

    -> [{"start": float, "end": float, "peak_db": float}, ...] terurut waktu.
    Video tanpa audio / analisis gagal -> [] (non-fatal dengan sengaja --
    ini fitur pelengkap, kegagalannya tidak boleh menggagalkan transkripsi
    yang memanggilnya)."""
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
        ], desc="menganalisis energi audio",
           timeout=max(1800, info.duration * 4 if info.duration else 1800))
    except Exception:                                  # noqa: BLE001
        return []

    levels = _parse_astats(proc.stdout)
    if len(levels) < 10:
        # Klip terlalu pendek atau parsing gagal total -- persentil dari
        # segelintir titik tidak berarti apa-apa, jangan menandai apa pun.
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
    """Keluaran `ametadata=print` -> {detik: level_puncak_dB_tertinggi_di_detik_itu}.
    Formatnya blok per-frame: baris "frame:N pts:N pts_time:N" (SATU baris,
    lihat _PTS_TIME_RE) diikuti baris "lavfi.astats.Overall.Peak_level=Y"
    untuk frame itu."""
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
    """Detik-detik >= threshold yang berdekatan (jarak <= merge_gap)
    digabung jadi satu window (mulai, akhir, puncak)."""
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
