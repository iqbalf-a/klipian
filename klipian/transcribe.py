"""Transkripsi dengan faster-whisper, menghasilkan timestamp per kata.

Kenapa word-level dan bukan kalimat-level: caption karaoke (highlight kata
yang sedang diucapkan) dan pemotongan yang tidak memenggal kata di tengah
keduanya mustahil tanpa timestamp per kata. Ini pondasi seluruh pipeline.

Berjalan sepenuhnya di CPU -- CTranslate2 (mesin faster-whisper) tidak
memakai iGPU maupun NPU. Di Core Ultra 9 185H (16C/22T), model
`large-v3-turbo` int8 memproses podcast 1 jam dalam ~8-15 menit.
"""

from __future__ import annotations

import sys
import time
from pathlib import Path

from .glossary import Glossary
from .models import Segment, Transcript, Word, fmt_duration

# Model yang tersedia, dari cepat ke akurat.
MODELS = ["tiny", "base", "small", "medium", "large-v3-turbo", "large-v3"]
DEFAULT_MODEL = "large-v3-turbo"

# Diukur di Core Ultra 9 185H: 8 thread paling cepat, 22 justru turun karena
# E-core ikut dipakai dan menghambat yang lain. Bawaan CTranslate2 (0) berarti
# 4 thread saja -- kira-kira setengah kecepatannya, jadi jangan pakai 0.
DEFAULT_THREADS = 8


class WhisperMissing(RuntimeError):
    pass


def _load_backend():
    try:
        from faster_whisper import WhisperModel  # noqa: WPS433
    except ImportError as exc:  # pragma: no cover
        raise WhisperMissing(
            "faster-whisper belum terpasang.\n"
            "Jalankan:  pip install -r requirements.txt"
        ) from exc
    return WhisperModel


class _Progress:
    """Progres berbasis posisi timestamp, bukan jumlah segmen -- lebih jujur
    karena panjang tiap segmen tidak seragam."""

    def __init__(self, total: float, enabled: bool = True):
        self.total = max(total, 0.001)
        self.enabled = enabled and sys.stderr.isatty()
        self.started = time.time()
        self._last = 0.0

    def update(self, position: float) -> None:
        if not self.enabled:
            return
        now = time.time()
        if now - self._last < 0.25 and position < self.total:
            return
        self._last = now

        frac = min(position / self.total, 1.0)
        elapsed = now - self.started
        eta = (elapsed / frac - elapsed) if frac > 0.01 else 0
        bar_len = 24
        filled = int(bar_len * frac)
        bar = "#" * filled + "-" * (bar_len - filled)
        sys.stderr.write(
            f"\r  [{bar}] {frac*100:5.1f}%  "
            f"{fmt_duration(position)}/{fmt_duration(self.total)}  "
            f"berjalan {fmt_duration(elapsed)}  sisa ~{fmt_duration(eta)}   "
        )
        sys.stderr.flush()

    def done(self) -> None:
        if self.enabled:
            sys.stderr.write("\n")
            sys.stderr.flush()


def transcribe(
    audio: Path,
    *,
    model_size: str = DEFAULT_MODEL,
    language: str = "id",
    glossary: Glossary | None = None,
    threads: int = DEFAULT_THREADS,
    compute_type: str = "int8",
    beam_size: int = 5,
    vad: bool = True,
    source_label: str | None = None,
    verbose: bool = True,
) -> Transcript:
    """Transkripsikan file audio jadi objek Transcript."""

    WhisperModel = _load_backend()
    glossary = glossary or Glossary()

    if verbose:
        # threads=0 diterjemahkan CTranslate2 jadi ~4 thread, BUKAN semua core.
        # Menampilkan jumlah core untuk 0 itu menyesatkan.
        used = str(threads) if threads else "bawaan CTranslate2 (~4)"
        print(f"  model    : {model_size} ({compute_type}, CPU, {used} thread)")
        if glossary:
            print(f"  glosarium: {len(glossary.terms)} istilah, {len(glossary.fixes)} koreksi")

    # Waktu muat model dipisah dari waktu transkripsi. Kalau digabung, angka
    # "x realtime" jadi menyesatkan -- terutama pada pemakaian pertama ketika
    # bobot model masih diunduh dari internet.
    load_started = time.time()
    model = WhisperModel(
        model_size,
        device="cpu",
        compute_type=compute_type,
        cpu_threads=threads,
    )
    if verbose:
        print(f"  muat     : {fmt_duration(time.time() - load_started)}")

    work_started = time.time()
    segments_iter, info = model.transcribe(
        str(audio),
        language=language,
        beam_size=beam_size,
        word_timestamps=True,
        vad_filter=vad,
        vad_parameters={"min_silence_duration_ms": 500},
        # Dimatikan supaya model tidak terjebak mengulang kalimat yang sama
        # -- kegagalan klasik Whisper pada audio panjang.
        condition_on_previous_text=False,
        initial_prompt=glossary.initial_prompt(language),
        hotwords=glossary.hotwords(),
    )

    total = info.duration or 0.0
    progress = _Progress(total, enabled=verbose)

    segments: list[Segment] = []
    for seg in segments_iter:
        words = [
            Word(
                text=glossary.apply(w.word),
                start=round(w.start, 3),
                end=round(w.end, 3),
                prob=round(getattr(w, "probability", 1.0), 3),
            )
            for w in (seg.words or [])
        ]
        # Rekonstruksi segment text dari words yang sudah dikoreksi,
        # jangan apply glossary lagi ke seg.text (akan double-apply).
        # w.text dari Whisper sudah membawa spasi di depan (" halo"), jadi
        # digabung tanpa pemisah -- kalau tidak, jadi spasi ganda.
        seg_text = ("".join(w.text for w in words).strip() if words
                    else glossary.apply(seg.text))
        segments.append(
            Segment(
                text=seg_text,
                start=round(seg.start, 3),
                end=round(seg.end, 3),
                words=words,
            )
        )
        progress.update(seg.end)
    progress.done()

    if verbose:
        work = time.time() - work_started
        speed = total / work if work else 0.0
        print(f"  proses   : {fmt_duration(work)}  ({speed:.1f}x realtime)")

    return Transcript(
        source=source_label or str(audio),
        duration=total,
        language=info.language or language,
        model=model_size,
        segments=segments,
    )
