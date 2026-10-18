"""Command-line interface for klipian."""

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
from . import credits, cues, roundtrip
from .paths import GLOSSARY

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_CACHE = ROOT / "workspace" / "cache"
DEFAULT_OUT = ROOT / "workspace" / "out"
DEFAULT_GLOSSARY = GLOSSARY
RUBRICS = roundtrip.RUBRICS


# --------------------------------------------------------------------------
# command: info
# --------------------------------------------------------------------------

def cmd_info(args: argparse.Namespace) -> int:
    info = probe(Path(args.video))
    print()
    print(info.summary())
    print()

    warnings = []
    if not info.has_audio:
        warnings.append("No audio track -- cannot be transcribed.")
    if not info.is_landscape:
        warnings.append(
            "Source is not landscape. klipian turns 16:9 into 9:16; a portrait "
            "source probably does not need reframing."
        )
    if info.duration and info.duration < 30:
        warnings.append("Under 30 seconds -- too short to look for clips in.")

    if warnings:
        print("Note:")
        for w in warnings:
            print(f"  ! {w}")
        print()

    qsv = has_encoder("h264_qsv")
    print(f"Encoder  : {'h264_qsv (Intel Arc acceleration)' if qsv else 'libx264 (CPU)'}")
    print()
    return 0


# --------------------------------------------------------------------------
# command: transcribe
# --------------------------------------------------------------------------

def cmd_transcribe(args: argparse.Namespace) -> int:
    video = Path(args.video)
    cache = Cache(Path(args.cache_dir))
    glossary_path = Path(args.glossary) if args.glossary else None
    glossary = Glossary.load(glossary_path)

    info = probe(video)
    if not info.has_audio:
        print("This video has no audio track.", file=sys.stderr)
        return 1

    tpath = cache.transcript_path(video, args.model, args.lang, glossary_path)

    if tpath.exists() and not args.force:
        transcript = Transcript.load(tpath)
        print(f"\nTranscript taken from cache: {tpath.name}")
        print("Use --force to transcribe again.\n")
    else:
        print(f"\n{video.name}  ({fmt_duration(info.duration)})")
        print("\n[1/2] Extracting audio ...")
        wav = cache.audio_path(video)
        extract_audio(video, wav)
        print(f"      {wav.name}")

        try:
            print("\n[2/2] Transcribing ...")
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
            print(f"      saved: {tpath.name}")
        finally:
            if not args.keep_audio:
                wav.unlink(missing_ok=True)

    words = transcript.words
    print()
    print(f"Language : {transcript.language}")
    print(f"Segments : {len(transcript.segments)}")
    print(f"Words    : {len(words)}")
    if words:
        suspects = transcript.suspect_words
        print(f"Flagged  : {len(suspects)} words possibly misheard "
              f"({len(suspects) / len(words) * 100:.1f}%)")
        if suspects:
            from collections import Counter
            common = Counter(w.text.strip().lower() for w in suspects).most_common(8)
            print("           " + ", ".join(f"{k} x{n}" if n > 1 else k
                                            for k, n in common))
            print("           candidates for prompts/glossary.txt")

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
# command: brief  -- file to drop into Claude
# --------------------------------------------------------------------------

def _load_transcript(args):
    """Get transcript from cache. Return (video, None) if not found yet."""
    video = Path(args.video)
    cache = Cache(Path(args.cache_dir))
    # Cache.find_transcript is the one rule: this exact model/language if it
    # was transcribed that way, else the newest transcript for the video.
    tpath = cache.find_transcript(video, args.model, args.lang)
    if tpath is None:
        print("", file=sys.stderr)
        print(f"No transcript for {video.name} yet.", file=sys.stderr)
        print(f"Run this first:  klipian transcribe {args.video}", file=sys.stderr)
        print("", file=sys.stderr)
        return video, None
    return video, Transcript.load(tpath)


def cmd_brief(args: argparse.Namespace) -> int:
    video, transcript = _load_transcript(args)
    if transcript is None:
        return 1

    rubric = RUBRICS.get(args.mode, RUBRICS["dialog"])
    cues_data = cues.load(video if video.is_file() else None, Cache(Path(args.cache_dir)))
    text = roundtrip.build_brief(transcript, roundtrip.read_rubric(rubric), video.name, cues_data,
                                 credits.load().get(video.name))

    dest = Path(args.out_dir) / video.stem / "brief-claude.md"
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(text, encoding="utf-8")

    print("")
    print(str(dest))
    print(f"  {len(text):,} characters  ~{len(text.split()):,} words"
          f"  (~{int(len(text) / 3.5):,} token)")
    print(f"  mode {args.mode}  ·  rubric {rubric.name}")
    print("")
    print("Next steps:")
    print("  1. Drop that file into Claude and ask it to do the work")
    print("  2. Save the JSON reply, for example as clips.json")
    print(f"  3. klipian import {args.video} clips.json")
    print("")
    return 0


# --------------------------------------------------------------------------
# command: import  -- read Claude's reply
# --------------------------------------------------------------------------

def cmd_import(args: argparse.Namespace) -> int:
    video, transcript = _load_transcript(args)
    if transcript is None:
        return 1

    file = Path(args.reply)
    if not file.exists():
        print("", file=sys.stderr)
        print(f"File not found: {file}", file=sys.stderr)
        print("", file=sys.stderr)
        return 1

    try:
        cue_list = cues.load(video if video.is_file() else None, Cache(Path(args.cache_dir)))["cues"]
        candidates = roundtrip.parse_reply(transcript.words, file.read_text(encoding="utf-8"), cue_list)
    except ValueError as exc:
        print("", file=sys.stderr)
        print(str(exc), file=sys.stderr)
        print("", file=sys.stderr)
        return 1

    if not candidates:
        print("", file=sys.stderr)
        print("No candidates could be read from that file.", file=sys.stderr)
        print("", file=sys.stderr)
        return 1

    # Best-first here, unlike the Clips screen (which keeps Claude's order,
    # since it doesn't show scores): this list is printed with its scores,
    # so ordering by score is the useful order and `--only 1` lands on the
    # best candidate.
    candidates.sort(key=lambda k: k["total"], reverse=True)

    dest = roundtrip.save_candidates(
        candidates, video, Path(args.out_dir) / video.stem / "candidates.json")

    print("")
    print(f"{len(candidates)} kandidat diimpor  ->  {dest}")
    print("")
    print("  score   start   length  title")
    for k in candidates:
        print(f"  {k['total']:>4}  {roundtrip.fmt_stamp(k['startSec']):>7}  {k['dur']:>5}s  {k['title']}")
    print("")
    print("Cut points were snapped to the nearest word boundary.")
    print("")
    return 0


# --------------------------------------------------------------------------
# command: render  -- this is where the MP4 actually comes out
# --------------------------------------------------------------------------

def cmd_replay(args: argparse.Namespace) -> int:
    """Run a Result's last render again and compare. The request is the one
    the editor sent (kept by the server, projects.read_render_records), run
    through the same jobs._run_render the Render button reaches, into a
    folder of its own that is deleted afterwards."""
    import shutil
    import tempfile
    from . import jobs
    from .projects import read_render_records

    records = read_render_records(args.replay, args.result)
    if not records:
        what = f"Result {args.result} of project {args.replay}" if args.result \
            else f"project {args.replay}"
        print(f"\nNo finished render is remembered for {what}.\n"
              f"Render it once from the editor (this only works for renders made "
              f"after this was added).\n", file=sys.stderr)
        return 1

    status = 0
    for rid, rec in records.items():
        print(f"\n{args.replay} / {rid}  (rendered {time.strftime('%Y-%m-%d %H:%M', time.localtime(rec['at']))})")
        missing = jobs.missing_inputs(rec["request"])
        if missing:
            print("  cannot replay here, not found: " + ", ".join(missing), file=sys.stderr)
            status = 1
            continue
        tmp = Path(tempfile.mkdtemp(prefix="klipian-replay-"))
        try:
            try:
                got = jobs.render_request(rec["request"], tmp)
            except RuntimeError as exc:
                print(f"  FAILED: {exc}", file=sys.stderr)
                status = 1
                continue
        finally:
            shutil.rmtree(tmp, ignore_errors=True)
        want = {o["file"]: o for o in rec["outputs"]}
        for o in got:
            was = want.get(o["file"])
            same = bool(was) and (o["md5"], o["sha256"], o["bytes"]) == (
                was["md5"], was["sha256"], was["bytes"])
            print(f"  {o['file']}: {'IDENTICAL' if same else 'DIFFERENT'}")
            print(f"    now   md5 {o['md5']}  sha256 {o['sha256'][:16]}...  {o['bytes']:,} bytes")
            if was:
                print(f"    then  md5 {was['md5']}  sha256 {was['sha256'][:16]}...  {was['bytes']:,} bytes")
            else:
                print("    then  (this file was not in the earlier render)")
            if not same:
                status = 1
    print()
    return status


def cmd_render(args: argparse.Namespace) -> int:
    from . import render as engine

    if args.replay:
        return cmd_replay(args)
    if not (args.video and args.candidates):
        print("\nUsage:  klipian render VIDEO CANDIDATES.json\n"
              "        klipian render --replay PROJECT_ID [--result RESULT_ID]\n",
              file=sys.stderr)
        return 2

    video, transcript = _load_transcript(args)
    if transcript is None:
        return 1

    file = Path(args.candidates)
    if not file.exists():
        print("", file=sys.stderr)
        print(f"Candidates file not found: {file}", file=sys.stderr)
        print(f"Create it first:  klipian import {args.video} reply.json", file=sys.stderr)
        print("", file=sys.stderr)
        return 1

    import json
    try:
        data = json.loads(file.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        print(f"\nCandidates file is not valid JSON: {exc}\n", file=sys.stderr)
        return 1
    items = data.get("candidates") or data.get("kandidat") or []
    if args.only:
        valid = [items[i - 1] for i in args.only if 0 < i <= len(items)]
        bad = [i for i in args.only if not (0 < i <= len(items))]
        if bad:
            print(f"  Note: number{'s' if len(bad) > 1 else ''} {', '.join(map(str, bad))} "
                  f"out of range (1-{len(items)}), ignored.", file=sys.stderr)
        items = valid
    if not items:
        print("No candidates selected.", file=sys.stderr)
        return 1

    info = probe(video)
    out_dir = Path(args.out_dir) / video.stem
    words = transcript.words

    print("")
    print(f"{video.name}  ->  {out_dir}")
    shape = engine.picture_options({"layout": args.layout, "picture": args.picture,
                                    "background": args.background, "position": args.position})
    print(f"  sumber {info.width}x{info.height}  ·  picture {shape['picture']}"
          f"  ·  {args.width}x{args.width * 16 // 9}")
    print("")

    succeeded = 0
    for i, k in enumerate(items, 1):
        title = k.get("title") or k.get("judul") or f"clip-{i}"
        try:
            # candidates.json from `klipian import` doesn't write "spans",
            # so the fallback below is actually the normal path. The old key
            # (mulai_detik) is still accepted so old files remain readable.
            spans = [engine.Span(float(p["start"]), float(p["end"]))
                     for p in k.get("spans", [])]
            if not spans:
                a = k.get("start_sec", k.get("mulai_detik"))
                b = k.get("end_sec", k.get("selesai_detik"))
                if a is None or b is None:
                    raise KeyError("start_sec/end_sec")
                spans = [engine.Span(float(a), float(b))]
        except (KeyError, TypeError, ValueError) as exc:
            print(f"  SKIP clip #{i} ({title}): invalid span data — {exc}",
                  file=sys.stderr)
            continue

        job = engine.RenderJob(
            title=title,
            spans=spans,
            crop=engine.CropBox(*args.crop) if args.crop else engine.CropBox(),
            **shape,
            out_width=args.width,
        )
        dest = out_dir / engine.safe_filename(title, f"clip-{i}")

        print(f"[{i}/{len(items)}] {title}")
        try:
            engine.render(video, job, dest, words=words,
                         src_width=info.width, src_height=info.height,
                         has_audio=info.has_audio)
        except RuntimeError as exc:
            print(f"  FAILED: {exc}", file=sys.stderr)
            continue
        size = dest.stat().st_size / 1048576
        print(f"  {dest.name}  ·  {size:.1f} MB")
        print("")
        succeeded += 1

    print(f"{succeeded} of {len(items)} clips rendered.")
    print("")
    return 0 if succeeded else 1


# --------------------------------------------------------------------------
# command: cues  -- what the audio and the word timings say; listen to it
# --------------------------------------------------------------------------

def _parse_time(text: str) -> float:
    """'2:50', '1:02:30' or plain seconds."""
    seconds = 0.0
    for part in str(text).strip().split(":"):
        seconds = seconds * 60 + float(part)
    return seconds


def _fmt_time(t: float) -> str:
    t = int(round(t))
    return f"{t // 3600}:{t // 60 % 60:02d}:{t % 60:02d}" if t >= 3600 else f"{t // 60}:{t % 60:02d}"


def cmd_cues(args: argparse.Namespace) -> int:
    """The cues klipian found in a video (cues.load: the same cache, the same
    levels the brief uses). With --listen, WAV clips of them and a list.md in
    <cache>/cues-listen/<video>/, so they can be judged by ear. Detects the
    sound cues first if that hasn't been done."""
    video = Path(args.video)
    if not video.is_file():
        from .paths import find_video
        video = find_video(args.video) or video
    if not video.is_file():
        print(f"\nVideo not found: {args.video}\n", file=sys.stderr)
        return 1
    cache = Cache(Path(args.cache_dir))

    record = cues.audio_record(video, cache)
    if record is None or record["status"] != "ok":
        print("Listening for sound cues (takes about 10 s for 45 minutes) ...")
        record = cues.run_audio_cues(video, cache)
        if record["status"] != "ok":
            print(f"  failed: {record.get('error', '')}", file=sys.stderr)
    data = cues.load(video, cache)
    status = data["status"]
    print()
    print(f"{video.name}")
    print(f"  sound cues  : {status['audio']}" + (f" ({status['audio_error']})" if status["audio_error"] else ""))
    print(f"  timing cues : {status['timing']}")
    counts = cues.counts(data["cues"])
    for kind in cues.KINDS:
        levels = ""
        if kind in ("laughter", "applause", "shout"):
            by = {lv: sum(1 for c in data["cues"] if c["kind"] == kind and c.get("level") == lv)
                  for lv in ("high", "medium", "low")}
            levels = "   " + ", ".join(f"{n} {lv}" for lv, n in by.items() if n)
        print(f"  {kind:<10} {counts[kind]:>4}{levels}")
    print()
    if not args.listen:
        print("Add --listen to cut WAV clips of them.\n")
        return 0

    try:
        at = [_parse_time(t) for t in args.at] if args.at else None
    except ValueError:
        print("--at takes times like 2:50 or 1:02:30\n", file=sys.stderr)
        return 2
    chosen = cues.select(data["cues"], kind=args.kind, level=args.level,
                         top=None if at else args.top, at=at)
    if not chosen:
        what = f"near {', '.join(args.at)}" if at else "matching that"
        print(f"No cues {what}.\n", file=sys.stderr)
        return 1

    out = Path(args.cache_dir) / "cues-listen" / video.stem
    out.mkdir(parents=True, exist_ok=True)
    for old in list(out.glob("*.wav")) + list(out.glob("list.md")):
        old.unlink()
    wave = cues._decode(video)
    words = []
    tpath = cache.find_transcript(video)
    if tpath:
        words = Transcript.load(tpath).words

    lines = [f"# Cues to listen to: {video.name}", "",
             f"- sound cues: {status['audio']}; timing cues: {status['timing']}"
             + (f"; transcript: {tpath.name}" if tpath else "; no transcript (words column empty)"),
             f"- selection: " + ", ".join(filter(None, [
                 f"kind {args.kind}" if args.kind else "", f"level {args.level}" if args.level else "",
                 f"near {', '.join(args.at)}" if at else f"top {args.top} of each kind"])),
             "", "| clip | kind | time | length | level | score | words around it |", "|---|---|---|---|---|---|---|"]
    for c in chosen:
        name = f"{c['kind'].replace(' ', '-')}-{int(c['start']) // 60:02d}m{int(c['start']) % 60:02d}s.wav"
        cues.write_clip(wave, c["start"], c["end"], out / name)
        score = (f"{c['peak']:.2f}" if "peak" in c else f"{c['len']:.1f} s" if c["kind"] == "pause"
                 else f"{c.get('words', 0)} words/10 s")
        text = cues.words_near(words, c["start"], c["end"]).replace("|", "/")
        lines.append(f"| [{name}]({name}) | {c['kind']} | {_fmt_time(c['start'])}-{_fmt_time(c['end'])} "
                     f"| {c['end'] - c['start']:.2f} s | {c.get('level', '')} | {score} | {text[:160]} |")
    (out / "list.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"{len(chosen)} clip(s) (+-3 s around each) and list.md in")
    print(f"  {out}\n")
    return 0


# --------------------------------------------------------------------------
# command: serve  -- UI with actually-working render
# --------------------------------------------------------------------------

def cmd_serve(args: argparse.Namespace) -> int:
    from .server import serve
    return serve(args.port)


# --------------------------------------------------------------------------
# command: run (coming later)
# --------------------------------------------------------------------------

def cmd_run(args: argparse.Namespace) -> int:
    print(
        "\nThe full pipeline isn't available yet.\n\n"
        "What already works (stage 1):\n"
        "  klipian info <video>        -- read metadata\n"
        "  klipian transcribe <video>  -- word-level transcript + cache\n\n"
        "Coming next:\n"
        "  stage 2  AI clip selection (--dry-run)\n"
        "  stage 3  captions + blur layout, first clip working\n"
        "  stage 4  split layout\n"
        "  stage 5  track layout\n",
        file=sys.stderr,
    )
    return 2


# --------------------------------------------------------------------------

def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        prog="klipian",
        description="Cut long podcasts into vertical 9:16 clips ready to post.",
    )
    p.add_argument("--version", action="version", version=f"klipian {__version__}")
    sub = p.add_subparsers(dest="command", required=True)

    common = argparse.ArgumentParser(add_help=False)
    common.add_argument("video", help="source video/audio file")
    common.add_argument("--cache-dir", default=str(DEFAULT_CACHE),
                        help="transcript cache folder")
    common.add_argument("--out-dir", default=str(DEFAULT_OUT), help="output folder")

    s_info = sub.add_parser("info", parents=[common], help="show media metadata")
    s_info.set_defaults(func=cmd_info)

    s_tr = sub.add_parser("transcribe", parents=[common],
                          help="word-level transcription (result is cached)")
    s_tr.add_argument("--model", default=DEFAULT_MODEL, choices=MODELS,
                      help=f"Whisper model (default: {DEFAULT_MODEL})")
    s_tr.add_argument("--lang", default="id", help="language code (default: id)")
    s_tr.add_argument("--threads", type=int, default=DEFAULT_THREADS,
                      help=f"CPU thread count (default {DEFAULT_THREADS}; 0 = CTranslate2 default)")
    s_tr.add_argument("--glossary", default=str(DEFAULT_GLOSSARY),
                      help="term glossary file")
    s_tr.add_argument("--force", action="store_true",
                      help="ignore the cache, transcribe again")
    s_tr.add_argument("--srt", action="store_true", help="also export as .srt")
    s_tr.add_argument("--keep-audio", action="store_true",
                      help="don't delete the temporary wav")
    s_tr.add_argument("--preview", type=int, default=5, metavar="N",
                      help="show the first N segments (0 = none)")
    s_tr.set_defaults(func=cmd_transcribe)

    s_brief = sub.add_parser("brief", parents=[common],
                             help="build a file to drop into Claude")
    s_brief.add_argument("--mode", default="dialog", choices=sorted(RUBRICS),
                         help="rubric to use (default: dialog)")
    s_brief.add_argument("--model", default=DEFAULT_MODEL, choices=MODELS)
    s_brief.add_argument("--lang", default="id")
    s_brief.set_defaults(func=cmd_brief)

    s_import = sub.add_parser("import", parents=[common],
                             help="read Claude's JSON reply")
    s_import.add_argument("reply", help="Claude's JSON reply file")
    s_import.add_argument("--model", default=DEFAULT_MODEL, choices=MODELS)
    s_import.add_argument("--lang", default="id")
    s_import.set_defaults(func=cmd_import)

    s_render = sub.add_parser("render", help="render clips into vertical 9:16 MP4")
    s_render.add_argument("video", nargs="?", help="source video/audio file")
    s_render.add_argument("candidates", nargs="?",
                          help="the candidates.json produced by import")
    s_render.add_argument("--cache-dir", default=str(DEFAULT_CACHE),
                          help="transcript cache folder")
    s_render.add_argument("--out-dir", default=str(DEFAULT_OUT), help="output folder")
    s_render.add_argument("--replay", metavar="PROJECT_ID",
                          help="instead of video + candidates: render again the request the "
                               "editor last rendered for this project's Result(s), into a "
                               "temporary folder, and compare the file with the one it made "
                               "then. Nothing in out/ is touched.")
    s_render.add_argument("--result", metavar="RESULT_ID",
                          help="with --replay: just this Result (default: every Result "
                               "that has been rendered)")
    s_render.add_argument("--only", type=int, nargs="+", metavar="N",
                          help="render only this clip number (1 = top)")
    s_render.add_argument("--layout", default="face", choices=["face", "blur"],
                          help="the older way to say it: blur = --picture 16:9 on a blurred copy")
    s_render.add_argument("--picture", choices=["9:16", "16:9", "3:4"],
                          help="shape of the picture inside the 9:16 file (default 9:16)")
    s_render.add_argument("--background", choices=["blur", "black"], default="blur",
                          help="around a 3:4 or 16:9 picture (default blur)")
    s_render.add_argument("--position", type=float, default=50.0,
                          help="0-100: how far down the free height the picture sits (default 50)")
    s_render.add_argument("--width", type=int, default=1080, choices=[720, 1080])
    s_render.add_argument("--crop", type=float, nargs=4,
                          metavar=("LEFT", "TOP", "WIDTH", "HEIGHT"),
                          help="crop box in percent, e.g. 58 8 26 84")
    s_render.add_argument("--model", default=DEFAULT_MODEL, choices=MODELS)
    s_render.add_argument("--lang", default="id")
    s_render.set_defaults(func=cmd_render)

    s_cues = sub.add_parser("cues", parents=[common],
                            help="the audio and timing cues found in a video; --listen to hear them")
    s_cues.add_argument("--listen", action="store_true",
                        help="cut +-3 s WAV clips of them, with a list.md, to <cache>/cues-listen/<video>/")
    s_cues.add_argument("--kind", choices=cues.KINDS, help="only this kind of cue")
    s_cues.add_argument("--level", choices=["low", "medium", "high"], help="only this level")
    s_cues.add_argument("--top", type=int, default=10, metavar="N",
                        help="the N strongest of each kind (default 10)")
    s_cues.add_argument("--at", nargs="+", metavar="MM:SS",
                        help="instead of --top: the cues within 1 s of these times")
    s_cues.set_defaults(func=cmd_cues)

    s_serve = sub.add_parser("serve", help="run the UI with real rendering")
    s_serve.add_argument("--port", type=int, default=5177)
    s_serve.set_defaults(func=cmd_serve)

    from . import selftest
    selftest.add_parser(sub)

    s_run = sub.add_parser("run", parents=[common],
                           help="full pipeline (not available yet)")
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
        print(f"\nUnexpected error: {exc}\n", file=sys.stderr)
        return 1
