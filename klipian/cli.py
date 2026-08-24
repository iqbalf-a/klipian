"""Antarmuka baris perintah klipian."""

from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path

from . import __version__
from .cache import Cache
from .ffmpeg_tools import FFmpegMissing, extract_audio, has_encoder, probe
from .glossary import Glossary
from .models import Transcript, fmt_duration
from .transcribe import (DEFAULT_MODEL, DEFAULT_THREADS, MODELS, WhisperMissing,
                         transcribe)
from . import roundtrip

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_CACHE = ROOT / "cache"
DEFAULT_OUT = ROOT / "out"
DEFAULT_GLOSSARY = ROOT / "prompts" / "glossary.txt"
RUBRICS = {
    "dialog": ROOT / "prompts" / "rubrik" / "dialog-podcast.md",
    "gameplay": ROOT / "prompts" / "rubrik" / "gameplay-mlbb.md",
}


# --------------------------------------------------------------------------
# perintah: info
# --------------------------------------------------------------------------

def cmd_info(args: argparse.Namespace) -> int:
    info = probe(Path(args.video))
    print()
    print(info.summary())
    print()

    warnings = []
    if not info.has_audio:
        warnings.append("Tidak ada trek audio -- tidak bisa ditranskripsi.")
    if not info.is_landscape:
        warnings.append(
            "Sumber bukan landscape. klipian dirancang mengubah 16:9 jadi 9:16; "
            "sumber portrait mungkin tidak butuh reframing."
        )
    if info.duration and info.duration < 30:
        warnings.append("Durasi di bawah 30 detik -- terlalu pendek untuk dicari klip.")

    if warnings:
        print("Catatan:")
        for w in warnings:
            print(f"  ! {w}")
        print()

    qsv = has_encoder("h264_qsv")
    print(f"Encoder  : {'h264_qsv (akselerasi Intel Arc)' if qsv else 'libx264 (CPU)'}")
    print()
    return 0


# --------------------------------------------------------------------------
# perintah: transcribe
# --------------------------------------------------------------------------

def cmd_transcribe(args: argparse.Namespace) -> int:
    video = Path(args.video)
    cache = Cache(Path(args.cache_dir))
    glossary = Glossary.load(Path(args.glossary) if args.glossary else None)

    info = probe(video)
    if not info.has_audio:
        print("Video ini tidak punya trek audio.", file=sys.stderr)
        return 1

    tpath = cache.transcript_path(video, args.model, args.lang)

    if tpath.exists() and not args.force:
        transcript = Transcript.load(tpath)
        print(f"\nTranskrip diambil dari cache: {tpath.name}")
        print("Pakai --force untuk transkripsi ulang.\n")
    else:
        print(f"\n{video.name}  ({fmt_duration(info.duration)})")
        print("\n[1/2] Mengekstrak audio ...")
        wav = cache.audio_path(video)
        extract_audio(video, wav)
        print(f"      {wav.name}")

        try:
            print("\n[2/2] Transkripsi ...")
            started = time.time()
            transcript = transcribe(
                wav,
                model_size=args.model,
                language=args.lang,
                glossary=glossary,
                threads=args.threads,
                source_label=str(video),
            )
            print(f"  total    : {fmt_duration(time.time() - started)}")

            transcript.save(tpath)
            print(f"      disimpan: {tpath.name}")
        finally:
            if not args.keep_audio:
                wav.unlink(missing_ok=True)

    words = transcript.words
    print()
    print(f"Bahasa   : {transcript.language}")
    print(f"Segmen   : {len(transcript.segments)}")
    print(f"Kata     : {len(words)}")
    if words:
        suspects = transcript.suspect_words
        print(f"Dicek    : {len(suspects)} kata mungkin salah dengar "
              f"({len(suspects) / len(words) * 100:.1f}%)")
        if suspects:
            from collections import Counter
            common = Counter(w.text.strip().lower() for w in suspects).most_common(8)
            print("           " + ", ".join(f"{k} x{n}" if n > 1 else k
                                            for k, n in common))
            print("           calon isi prompts/glossary.txt")

    if args.srt:
        out_dir = Path(args.out_dir) / video.stem
        out_dir.mkdir(parents=True, exist_ok=True)
        srt = out_dir / f"{video.stem}.srt"
        srt.write_text(transcript.to_srt(), encoding="utf-8")
        print(f"\nSRT      : {srt}")

    if args.preview:
        print("\n--- cuplikan awal ---")
        for seg in transcript.segments[: args.preview]:
            print(f"[{fmt_duration(seg.start)}] {seg.text.strip()}")

    print()
    return 0


# --------------------------------------------------------------------------
# perintah: brief  -- berkas yang dijatuhkan ke Claude
# --------------------------------------------------------------------------

def _load_transcript(args):
    """Ambil transkrip dari cache. Kembalikan (video, None) kalau belum ada."""
    video = Path(args.video)
    cache = Cache(Path(args.cache_dir))
    tpath = cache.transcript_path(video, args.model, args.lang)
    if not tpath.exists():
        print("", file=sys.stderr)
        print(f"Belum ada transkrip untuk {video.name}.", file=sys.stderr)
        print(f"Jalankan dulu:  klipian transcribe {args.video}", file=sys.stderr)
        print("", file=sys.stderr)
        return video, None
    return video, Transcript.load(tpath)


def cmd_brief(args: argparse.Namespace) -> int:
    video, transcript = _load_transcript(args)
    if transcript is None:
        return 1

    rubric = RUBRICS.get(args.mode, RUBRICS["dialog"])
    text = roundtrip.build_brief(transcript, rubric, video)

    dest = Path(args.out_dir) / video.stem / "brief-claude.md"
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(text, encoding="utf-8")

    print("")
    print(str(dest))
    print(f"  {len(text):,} karakter  ~{len(text.split()):,} kata"
          f"  (~{int(len(text) / 3.5):,} token)")
    print(f"  mode {args.mode}  ·  rubrik {rubric.name}")
    print("")
    print("Langkah berikutnya:")
    print("  1. Jatuhkan berkas itu ke Claude, minta dikerjakan")
    print("  2. Simpan balasan JSON-nya, misalnya jadi hasil.json")
    print(f"  3. klipian import {args.video} hasil.json")
    print("")
    return 0


# --------------------------------------------------------------------------
# perintah: impor  -- membaca balasan Claude
# --------------------------------------------------------------------------

def cmd_import(args: argparse.Namespace) -> int:
    video, transcript = _load_transcript(args)
    if transcript is None:
        return 1

    file = Path(args.reply)
    if not file.exists():
        print("", file=sys.stderr)
        print(f"Berkas tidak ada: {file}", file=sys.stderr)
        print("", file=sys.stderr)
        return 1

    try:
        candidates = roundtrip.parse_reply(transcript, file.read_text(encoding="utf-8"))
    except ValueError as exc:
        print("", file=sys.stderr)
        print(str(exc), file=sys.stderr)
        print("", file=sys.stderr)
        return 1

    if not candidates:
        print("", file=sys.stderr)
        print("Tidak ada kandidat yang terbaca dari berkas itu.", file=sys.stderr)
        print("", file=sys.stderr)
        return 1

    dest = roundtrip.save_candidates(
        candidates, video, Path(args.out_dir) / video.stem / "candidates.json")

    print("")
    print(f"{len(candidates)} kandidat diimpor  ->  {dest}")
    print("")
    print("  skor    mulai  durasi  judul")
    for k in candidates:
        print(f"  {k.total:>4}  {roundtrip.fmt_time(k.start):>7}  {round(k.duration):>5}s  {k.title}")
    print("")
    print("Titik potong sudah digeser ke batas kata terdekat.")
    print("")
    return 0


# --------------------------------------------------------------------------
# perintah: render  -- di sinilah MP4 benar-benar keluar
# --------------------------------------------------------------------------

def cmd_render(args: argparse.Namespace) -> int:
    from . import render as engine

    video, transcript = _load_transcript(args)
    if transcript is None:
        return 1

    file = Path(args.candidates)
    if not file.exists():
        print("", file=sys.stderr)
        print(f"Berkas kandidat tidak ada: {file}", file=sys.stderr)
        print(f"Buat dulu:  klipian import {args.video} balasan.json", file=sys.stderr)
        print("", file=sys.stderr)
        return 1

    import json
    data = json.loads(file.read_text(encoding="utf-8"))
    items = data.get("candidates") or data.get("kandidat") or []
    if args.only:
        valid = [items[i - 1] for i in args.only if 0 < i <= len(items)]
        bad = [i for i in args.only if not (0 < i <= len(items))]
        if bad:
            print(f"  Catatan: nomor {', '.join(map(str, bad))} di luar range "
                  f"(1-{len(items)}), diabaikan.", file=sys.stderr)
        items = valid
    if not items:
        print("Tidak ada kandidat yang dipilih.", file=sys.stderr)
        return 1

    info = probe(video)
    out_dir = Path(args.out_dir) / video.stem
    words = transcript.words

    print("")
    print(f"{video.name}  ->  {out_dir}")
    print(f"  sumber {info.width}x{info.height}  ·  layout {args.layout}"
          f"  ·  {args.width}x{args.width * 16 // 9}")
    print("")

    succeeded = 0
    for i, k in enumerate(items, 1):
        try:
            # candidates.json dari `klipian import` tidak menulis "spans",
            # jadi jalur normalnya justru cadangan di bawah ini. Kunci lama
            # (mulai_detik) tetap diterima supaya berkas lama masih terbaca.
            spans = [engine.Span(float(p["start"]), float(p["end"]))
                     for p in k.get("spans", [])]
            if not spans:
                a = k.get("start_sec", k.get("mulai_detik"))
                b = k.get("end_sec", k.get("selesai_detik"))
                if a is None or b is None:
                    raise KeyError("start_sec/end_sec")
                spans = [engine.Span(float(a), float(b))]
        except (KeyError, TypeError, ValueError) as exc:
            print(f"  SKIP klip #{i} ({k.get('title', '?')}): data potongan tidak sah — {exc}",
                  file=sys.stderr)
            continue

        job = engine.RenderJob(
            title=k["title"],
            spans=spans,
            crop=engine.CropBox(*args.crop) if args.crop else engine.CropBox(),
            layout=args.layout,
            out_width=args.width,
        )
        dest = out_dir / engine.safe_filename(k["title"], f"klip-{i}")

        print(f"[{i}/{len(items)}] {k['title']}")
        try:
            engine.render(video, job, dest, words=words,
                         src_width=info.width, src_height=info.height,
                         has_audio=info.has_audio)
        except RuntimeError as exc:
            print(f"  GAGAL: {exc}", file=sys.stderr)
            continue
        size = dest.stat().st_size / 1048576
        print(f"  {dest.name}  ·  {size:.1f} MB")
        print("")
        succeeded += 1

    print(f"{succeeded} dari {len(items)} klip selesai dirender.")
    print("")
    return 0 if succeeded else 1


# --------------------------------------------------------------------------
# perintah: serve  -- UI dengan render yang benar-benar jalan
# --------------------------------------------------------------------------

def cmd_serve(args: argparse.Namespace) -> int:
    from .server import serve
    return serve(args.port)


# --------------------------------------------------------------------------
# perintah: run (menyusul)
# --------------------------------------------------------------------------

def cmd_run(args: argparse.Namespace) -> int:
    print(
        "\nPipeline lengkap belum tersedia.\n\n"
        "Yang sudah jalan (fase 1):\n"
        "  klipian info <video>        -- baca metadata\n"
        "  klipian transcribe <video>  -- transkrip word-level + cache\n\n"
        "Menyusul:\n"
        "  fase 2  pemilihan klip oleh AI (--dry-run)\n"
        "  fase 3  caption + layout blur, klip pertama jadi\n"
        "  fase 4  layout split\n"
        "  fase 5  layout track\n",
        file=sys.stderr,
    )
    return 2


# --------------------------------------------------------------------------

def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        prog="klipian",
        description="Memotong podcast panjang jadi klip vertikal 9:16 siap posting.",
    )
    p.add_argument("--version", action="version", version=f"klipian {__version__}")
    sub = p.add_subparsers(dest="command", required=True)

    common = argparse.ArgumentParser(add_help=False)
    common.add_argument("video", help="file video/audio sumber")
    common.add_argument("--cache-dir", default=str(DEFAULT_CACHE),
                        help="lokasi cache transkrip")
    common.add_argument("--out-dir", default=str(DEFAULT_OUT), help="lokasi hasil")

    s_info = sub.add_parser("info", parents=[common], help="tampilkan metadata media")
    s_info.set_defaults(func=cmd_info)

    s_tr = sub.add_parser("transcribe", parents=[common],
                          help="transkripsi word-level (hasilnya di-cache)")
    s_tr.add_argument("--model", default=DEFAULT_MODEL, choices=MODELS,
                      help=f"model Whisper (default: {DEFAULT_MODEL})")
    s_tr.add_argument("--lang", default="id", help="kode bahasa (default: id)")
    s_tr.add_argument("--threads", type=int, default=DEFAULT_THREADS,
                      help=f"jumlah thread CPU (default {DEFAULT_THREADS}; 0 = bawaan CTranslate2)")
    s_tr.add_argument("--glossary", default=str(DEFAULT_GLOSSARY),
                      help="file glosarium istilah")
    s_tr.add_argument("--force", action="store_true",
                      help="abaikan cache, transkripsi ulang")
    s_tr.add_argument("--srt", action="store_true", help="ekspor juga sebagai .srt")
    s_tr.add_argument("--keep-audio", action="store_true",
                      help="jangan hapus wav sementara")
    s_tr.add_argument("--preview", type=int, default=5, metavar="N",
                      help="tampilkan N segmen pertama (0 = jangan)")
    s_tr.set_defaults(func=cmd_transcribe)

    s_brief = sub.add_parser("brief", parents=[common],
                             help="buat berkas untuk dijatuhkan ke Claude")
    s_brief.add_argument("--mode", default="dialog", choices=sorted(RUBRICS),
                         help="rubrik yang dipakai (default: dialog)")
    s_brief.add_argument("--model", default=DEFAULT_MODEL, choices=MODELS)
    s_brief.add_argument("--lang", default="id")
    s_brief.set_defaults(func=cmd_brief)

    s_import = sub.add_parser("import", parents=[common],
                             help="baca balasan JSON dari Claude")
    s_import.add_argument("reply", help="berkas JSON balasan Claude")
    s_import.add_argument("--model", default=DEFAULT_MODEL, choices=MODELS)
    s_import.add_argument("--lang", default="id")
    s_import.set_defaults(func=cmd_import)

    s_render = sub.add_parser("render", parents=[common],
                              help="render klip jadi MP4 vertikal 9:16")
    s_render.add_argument("candidates", help="berkas candidates.json hasil impor")
    s_render.add_argument("--only", type=int, nargs="+", metavar="N",
                          help="hanya render klip nomor ini (1 = teratas)")
    s_render.add_argument("--layout", default="face", choices=["face", "blur"])
    s_render.add_argument("--width", type=int, default=1080, choices=[720, 1080])
    s_render.add_argument("--crop", type=float, nargs=4,
                          metavar=("LEFT", "TOP", "WIDTH", "HEIGHT"),
                          help="kotak crop dalam persen, mis. 58 8 26 84")
    s_render.add_argument("--model", default=DEFAULT_MODEL, choices=MODELS)
    s_render.add_argument("--lang", default="id")
    s_render.set_defaults(func=cmd_render)

    s_serve = sub.add_parser("serve", help="jalankan UI dengan render sungguhan")
    s_serve.add_argument("--port", type=int, default=5177)
    s_serve.set_defaults(func=cmd_serve)

    s_run = sub.add_parser("run", parents=[common],
                           help="pipeline lengkap (belum tersedia)")
    s_run.set_defaults(func=cmd_run)

    return p


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    try:
        return args.func(args)
    except (FFmpegMissing, WhisperMissing) as exc:
        print(f"\n{exc}\n", file=sys.stderr)
        return 1
    except FileNotFoundError as exc:
        print(f"\n{exc}\n", file=sys.stderr)
        return 1
    except KeyboardInterrupt:
        print("\nDibatalkan.", file=sys.stderr)
        return 130
    except Exception as exc:
        print(f"\nGalat tak terduga: {exc}\n", file=sys.stderr)
        return 1
