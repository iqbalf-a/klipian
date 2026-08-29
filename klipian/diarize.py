"""Deteksi pembicara aktif (speaker diarization) untuk AI Framing.

Dipakai untuk menjawab "siapa yang bicara di detik ke berapa" dalam satu
klip, supaya kotak framing bisa otomatis mengikuti orangnya -- lihat
diskusi konsepnya sebelum modul ini ditulis: pendekatan audio-only lewat
pyannote dipilih dibanding deteksi wajah manual, karena audio podcast yang
direkam dengan mic terpisah jauh lebih bersih dan lebih murah dihitung
daripada computer vision per-frame.

Butuh HF_TOKEN (lihat .env.example) -- model `speaker-diarization-community-1`
gratis tapi tetap gated di HuggingFace: token dipakai SEKALI untuk mengunduh
bobotnya, sesudah itu jalan offline seperti Whisper.

Catatan Windows: pyannote 4.x memakai `torchcodec` untuk decode audio, dan
paket itu gagal memuat DLL native-nya di banyak instalasi Windows (lihat
percobaan sebelum modul ini ditulis -- error "Could not load this library").
Jalan pintasnya: audio dibaca manual lewat `soundfile`, lalu diberikan ke
pipeline sebagai tensor waveform, bukan lewat path file -- itu membuat
pipeline tidak pernah memanggil torchcodec sama sekali.
"""

from __future__ import annotations

import os
import tempfile
from pathlib import Path

_pipeline = None   # singleton -- memuat model butuh belasan detik, jangan berulang


def _load_pipeline():
    global _pipeline
    if _pipeline is not None:
        return _pipeline

    token = os.environ.get("HF_TOKEN", "").strip()
    if not token:
        raise RuntimeError(
            "HF_TOKEN belum diset. Buat token gratis di "
            "https://huggingface.co/settings/tokens, setujui akses model di "
            "https://huggingface.co/pyannote/speaker-diarization-community-1, "
            "lalu isi HF_TOKEN=... di file .env (lihat .env.example)."
        )
    from pyannote.audio import Pipeline
    _pipeline = Pipeline.from_pretrained(
        "pyannote/speaker-diarization-community-1", token=token,
    )
    return _pipeline


def _merge_turns(turns: list[dict], min_gap: float = 1.5,
                  min_dur: float = 0.6) -> list[dict]:
    """Giliran super pendek (<min_dur) dibuang -- kemungkinan besar
    backchannel ("iya", "hmm", tertawa singkat), bukan giliran bicara
    sungguhan. Giliran pembicara yang SAMA dengan jeda <min_gap digabung
    jadi satu -- tanpa ini tiap jeda napas memicu titik framing baru dan
    videonya kedap-kedip. Sejalan dengan prinsip FRAMING yang sudah ada:
    potong keras, tidak merayap."""
    turns = sorted(turns, key=lambda t: t["start"])
    turns = [t for t in turns if t["end"] - t["start"] >= min_dur]
    if not turns:
        return []
    keluar = [dict(turns[0])]
    for t in turns[1:]:
        terakhir = keluar[-1]
        if t["speaker"] == terakhir["speaker"] and t["start"] - terakhir["end"] < min_gap:
            terakhir["end"] = max(terakhir["end"], t["end"])
        else:
            keluar.append(dict(t))
    return keluar


def diarize_segment(video: Path, start: float, end: float) -> list[dict]:
    """Giliran bicara dalam rentang [start, end) detik SUMBER video.

    Kembalikan daftar {start, end, speaker} -- speaker berupa label
    sembarang dari pipeline ("SPEAKER_00", dst), waktunya sudah relatif ke
    video SUMBER (bukan relatif ke potongan segmennya)."""
    import soundfile as sf
    import torch

    from .ffmpeg_tools import _require, run

    pipeline = _load_pipeline()

    with tempfile.TemporaryDirectory(prefix="klipian-diarize-") as tmp:
        wav = Path(tmp) / "segmen.wav"
        run([
            _require("ffmpeg"), "-y", "-loglevel", "error",
            "-ss", f"{start:.3f}", "-t", f"{max(0.1, end - start):.3f}",
            "-i", str(video),
            "-vn", "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le",
            str(wav),
        ], desc="mengekstrak audio segmen")

        data, sr = sf.read(str(wav), dtype="float32")
        if data.ndim == 1:
            data = data[:, None]
        waveform = torch.from_numpy(data.T)   # (channel, time)
        result = pipeline({"waveform": waveform, "sample_rate": sr})

    turns = [
        {"start": round(start + turn.start, 3),
         "end": round(start + turn.end, 3),
         "speaker": speaker}
        for turn, _, speaker in
        result.exclusive_speaker_diarization.itertracks(yield_label=True)
    ]
    return _merge_turns(turns)
