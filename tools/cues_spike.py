"""Spike: which audio and timing cues can be found in a video? (roadmap P6)

NOT part of the klipian package and not wired into the pipeline, the brief or
the UI. It runs YAMNet (assets/models/yamnet.onnx, via onnxruntime) over a
video's audio once, plus a few counts from the transcript's word timestamps,
and writes what it found where a person can LISTEN to it:

    workspace/cache/cues-spike/<video>/
        list.md                  what was found, per signal, with the words spoken there
        laughter-01.wav ...      about 3 s of context around each top candidate
        applause-01.wav ...

    .venv\\Scripts\\python.exe tools\\cues_spike.py "radityadika-podcast.mp4" --check 2372 2385
    .venv\\Scripts\\python.exe tools\\cues_spike.py "Raditya Dika - Apa Kabar Syahrini.mp4"

Signals: laughter, applause/cheering, shout/gasp (YAMNet classes picked BY NAME
from yamnet_class_map.csv), music (to AVOID), dramatic pauses (>= 3 s between
words), fast talk (words per 10 s above the 95th percentile) and relative energy
(RMS against the median of the surrounding +-60 s).
"""

from __future__ import annotations

import argparse
import csv
import subprocess
import sys
import time
import wave
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from klipian.cache import Cache                      # noqa: E402
from klipian.ffmpeg_tools import _require            # noqa: E402

SR = 16000
HOP = 0.48               # YAMNet: one score row per 0.48 s ...
WIN = 0.96               # ... looking at 0.96 s of audio
MODEL = ROOT / "assets" / "models" / "yamnet.onnx"
CLASS_MAP = ROOT / "assets" / "models" / "yamnet_class_map.csv"

# Classes by NAME (the index order is the model's business, not ours).
GROUPS = {
    "laughter": ["Laughter", "Giggle", "Chuckle, chortle", "Belly laugh", "Snicker"],
    "applause": ["Applause", "Cheering"],
    "shout": ["Shout", "Yell", "Screaming", "Gasp"],
    "music": ["Music"],
}
# (frame score to count as "present", frames of gap that still count as one range)
PARAMS = {"laughter": (0.30, 1), "applause": (0.30, 1), "shout": (0.30, 1), "music": (0.50, 4)}
TOP = {"laughter": 20, "applause": 5, "shout": 5, "music": 5,
       "pause": 5, "fast talk": 5, "relative energy": 5}


def fmt(t: float) -> str:
    t = int(round(t))
    return f"{t // 3600}:{t // 60 % 60:02d}:{t % 60:02d}" if t >= 3600 else f"{t // 60}:{t % 60:02d}"


# ---------------------------------------------------------------- audio / model

def decode(video: Path) -> np.ndarray:
    out = subprocess.run([_require("ffmpeg"), "-loglevel", "error", "-i", str(video), "-vn",
                          "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"],
                         capture_output=True, check=True).stdout
    return np.frombuffer(out, dtype=np.float32)


def yamnet_scores(wave_: np.ndarray) -> np.ndarray:
    import onnxruntime as ort
    sess = ort.InferenceSession(str(MODEL), providers=["CPUExecutionProvider"])
    return sess.run(["output_0"], {"waveform": wave_})[0]              # [frames, 521]


def class_indices(names: list[str]) -> list[int]:
    with open(CLASS_MAP, newline="", encoding="utf-8") as fh:
        by_name = {row["display_name"]: int(row["index"]) for row in csv.DictReader(fh)}
    missing = [n for n in names if n not in by_name]
    if missing:
        raise SystemExit(f"not in yamnet_class_map.csv: {missing}")
    return [by_name[n] for n in names]


# ---------------------------------------------------------------- ranges

def ranges_from_frames(score: np.ndarray, threshold: float, gap: int) -> list[dict]:
    """Frames at or above `threshold`, joined when at most `gap` frames apart."""
    idx = np.flatnonzero(score >= threshold)
    out: list[dict] = []
    for i in idx:
        if out and i - out[-1]["last"] <= gap + 1:
            out[-1]["last"] = int(i)
        else:
            out.append({"first": int(i), "last": int(i)})
    for r in out:
        sl = score[r["first"]:r["last"] + 1]
        r["start"] = r["first"] * HOP
        r["end"] = r["last"] * HOP + WIN
        r["peak"] = float(sl.max())
        r["mean"] = float(sl.mean())
        r["at"] = (r["first"] + int(sl.argmax())) * HOP + WIN / 2
    return out


def merge_spans(spans: list[tuple[float, float]], gap: float) -> list[tuple[float, float]]:
    out: list[list[float]] = []
    for a, b in sorted(spans):
        if out and a - out[-1][1] <= gap:
            out[-1][1] = max(out[-1][1], b)
        else:
            out.append([a, b])
    return [(a, b) for a, b in out]


# ---------------------------------------------------------------- output

def words_near(words, start: float, end: float, pad: float = 1.0) -> str:
    return " ".join(w.text.strip() for w in words if w.end >= start - pad and w.start <= end + pad)


def write_clip(wave_: np.ndarray, start: float, end: float, dest: Path) -> None:
    """[start - 3 s, end + 3 s], at most 14 s (centred if longer)."""
    a, b = start - 3.0, end + 3.0
    if b - a > 14.0:
        mid = (start + end) / 2
        a, b = mid - 7.0, mid + 7.0
    a = max(0.0, a)
    b = min(len(wave_) / SR, b)
    pcm = (np.clip(wave_[int(a * SR):int(b * SR)], -1, 1) * 32767).astype("<i2")
    with wave.open(str(dest), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("video", help="file name in workspace/samples/")
    ap.add_argument("--check", nargs=2, type=float, metavar=("START", "END"),
                    help="report whether the laughter detector caught this range (seconds)")
    args = ap.parse_args()

    video = ROOT / "workspace" / "samples" / args.video
    if not video.is_file():
        raise SystemExit(f"{video} not found")
    outdir = ROOT / "workspace" / "cache" / "cues-spike" / video.stem
    outdir.mkdir(parents=True, exist_ok=True)
    for old in list(outdir.glob("*.wav")) + list(outdir.glob("list.md")):
        old.unlink()

    t0 = time.time()
    wave_ = decode(video)
    t_decode = time.time() - t0
    duration = len(wave_) / SR
    t0 = time.time()
    scores = yamnet_scores(wave_)
    t_model = time.time() - t0
    print(f"{video.name}: {duration / 60:.1f} min of audio; decode {t_decode:.1f} s, "
          f"YAMNet {t_model:.1f} s ({scores.shape[0]} frames)")

    t_path = Cache(ROOT / "workspace" / "cache").find_transcript(video)
    words = []
    if t_path:
        from klipian.models import Transcript
        words = Transcript.load(t_path).words
    print(f"transcript: {t_path.name if t_path else 'none'} ({len(words)} words)")

    t0 = time.time()
    found: dict[str, list[dict]] = {}

    # --- YAMNet groups
    group_scores = {}
    for name, classes in GROUPS.items():
        group_scores[name] = scores[:, class_indices(classes)].max(axis=1)
        thr, gap = PARAMS[name]
        found[name] = ranges_from_frames(group_scores[name], thr, gap)
        key = (lambda r: (r["peak"], r["end"] - r["start"])) if name != "music" else \
              (lambda r: (r["end"] - r["start"]) * r["mean"])
        found[name].sort(key=key, reverse=True)

    # --- dramatic pauses
    gaps = []
    for a, b in zip(words, words[1:]):
        g = b.start - a.end
        if g >= 1.5:
            gaps.append({"start": a.end, "end": b.start, "len": g, "after": b.text.strip()})
    long_pauses = sorted((g for g in gaps if g["len"] >= 3.0), key=lambda g: g["len"], reverse=True)
    found["pause"] = [{"start": g["start"], "end": g["end"], "peak": g["len"], "mean": g["len"],
                       "at": g["end"]} for g in long_pauses]

    # --- fast talk: words per 10 s, sliding by 2 s
    fast = []
    if words:
        starts = np.array([w.start for w in words])
        grid = np.arange(0, duration - 10, 2.0)
        counts = np.array([int(((starts >= t) & (starts < t + 10)).sum()) for t in grid])
        p95 = float(np.percentile(counts, 95))
        median = float(np.median(counts))
        over = [(float(t), float(t) + 10.0, int(c)) for t, c in zip(grid, counts) if c > p95]
        merged = merge_spans([(a, b) for a, b, _ in over], gap=2.0)
        for a, b in merged:
            cs = [c for x, y, c in over if x >= a and y <= b]
            fast.append({"start": a, "end": b, "peak": float(max(cs)), "mean": float(np.mean(cs)),
                         "at": (a + b) / 2})
        fast.sort(key=lambda r: (r["peak"], r["end"] - r["start"]), reverse=True)
        fast_note = f"p95 = {p95:.0f} words / 10 s, median = {median:.0f}, max = {counts.max()}"
    else:
        fast_note = "no transcript"
    found["fast talk"] = fast

    # --- relative energy: RMS per second against the median of +-60 s around it
    secs = int(duration)
    rms = np.sqrt(np.maximum((wave_[:secs * SR].reshape(secs, SR) ** 2).mean(axis=1), 1e-12))
    db = 20 * np.log10(rms)
    rel = np.empty(secs)
    for i in range(secs):
        lo, hi = max(0, i - 60), min(secs, i + 61)
        rel[i] = db[i] - np.median(db[lo:hi])
    spans = [(float(i), float(i + 1)) for i in np.flatnonzero(rel >= 6.0)]
    energy = []
    for a, b in merge_spans(spans, gap=1.0):
        sl = rel[int(a):int(b)]
        energy.append({"start": a, "end": b, "peak": float(sl.max()), "mean": float(sl.mean()),
                       "at": a + float(sl.argmax())})
    energy.sort(key=lambda r: (r["peak"], r["end"] - r["start"]), reverse=True)
    found["relative energy"] = energy
    t_rest = time.time() - t0

    # --- files
    md = [f"# Cue spike: {video.name}", "",
          f"- audio {fmt(duration)}, decoded in {t_decode:.1f} s, YAMNet {t_model:.1f} s, "
          f"the other signals {t_rest:.1f} s",
          f"- transcript: {t_path.name if t_path else 'none (words column empty, no pauses or fast talk)'}",
          f"- fast talk: {fast_note}",
          f"- thresholds (frame score / bridging gap in frames): "
          + ", ".join(f"{k} {v[0]}/{v[1]}" for k, v in PARAMS.items()),
          "", "## Totals", "", "| signal | found | per detail |", "|---|---|---|"]
    for name, rs in found.items():
        detail = ""
        if name in GROUPS and name != "music":
            detail = f"{sum(r['peak'] >= 0.5 for r in rs)} with peak >= 0.5"
        if name == "pause":
            detail = f"{len(gaps)} pauses >= 1.5 s in all"
        if name == "music":
            detail = f"{sum(r['end'] - r['start'] for r in rs) / 60:.1f} min in all"
        md.append(f"| {name} | {len(rs)} | {detail} |")

    for name, rs in found.items():
        top = rs[:TOP[name]]
        md += ["", f"## {name}: top {len(top)} of {len(rs)}", "",
               "| # | time | length | peak | mean | words around it |", "|---|---|---|---|---|---|"]
        unit = {"pause": "s", "fast talk": " words/10 s", "relative energy": " dB"}.get(name, "")
        slug = name.replace(" ", "-")
        for n, r in enumerate(top, 1):
            clip = f"{slug}-{n:02d}.wav"
            write_clip(wave_, r["start"], r["end"], outdir / clip)
            text = words_near(words, r["start"], r["end"]).replace("|", "/")
            md.append(f"| [{n}]({clip}) | {fmt(r['start'])}–{fmt(r['end'])} | {r['end'] - r['start']:.1f} s "
                      f"| {r['peak']:.2f}{unit} | {r['mean']:.2f}{unit} | {text[:160]} |")

    if args.check:
        a, b = args.check
        lo, hi = int(a / HOP), int(b / HOP) + 1
        seg = group_scores["laughter"][lo:hi]
        hits = [r for r in found["laughter"] if r["end"] > a and r["start"] < b]
        order = {id(r): i + 1 for i, r in enumerate(found["laughter"])}
        md += ["", f"## Check: laughter between {a:.0f} s and {b:.0f} s ({fmt(a)}–{fmt(b)})", "",
               f"- highest laughter score in those frames: {float(seg.max()):.2f}",
               f"- laughter ranges overlapping it: {len(hits)}"
               + "".join(f"; {fmt(r['start'])}–{fmt(r['end'])} peak {r['peak']:.2f} "
                         f"(rank {order[id(r)]} of {len(found['laughter'])})" for r in hits)]
        top_classes = scores[lo:hi].mean(axis=0)
        with open(CLASS_MAP, newline="", encoding="utf-8") as fh:
            names = {int(row["index"]): row["display_name"] for row in csv.DictReader(fh)}
        md.append("- strongest classes there (mean score): "
                  + ", ".join(f"{names[i]} {top_classes[i]:.2f}" for i in np.argsort(top_classes)[::-1][:5]))
        write_clip(wave_, a, b, outdir / "check-range.wav")
        print(md[-3]); print(md[-2]); print(md[-1])

    (outdir / "list.md").write_text("\n".join(md) + "\n", encoding="utf-8")
    print("totals:", {k: len(v) for k, v in found.items()})
    print("written:", outdir)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
