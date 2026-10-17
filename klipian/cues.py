"""Audio and timing cues: what a transcript can't tell Claude.

Whisper writes down the WORDS. It rarely writes laughter, never writes
applause, and says nothing about a long silence or a sudden speed-up. This
module finds those, and the brief hands them to Claude as a separate list
(roundtrip.build_brief) -- "detected locally, not from the transcript".

Two families:

  audio   YAMNet (assets/models/yamnet.onnx, run with onnxruntime) over the whole
          audio once: laughter, applause/cheering, shouts/gasps, and music (a cue
          to AVOID). Expensive-ish (about 12 s for a 45-minute episode), so the
          raw ranges are cached per video: <stem>.<fingerprint>.cues.json.
  timing  Counted from the transcript's word timestamps: long pauses before a
          sentence, and stretches of unusually fast talk. Cheap, and they follow
          whichever transcript Cache.find_transcript picks, so they are computed
          when needed, not cached.

Everything tunable is in the tables right below. The ranges in the cache are
RAW (a score and a length); the level (low / medium / high) is worked out when
they are read, so changing a level rule needs no re-detection. Changing a
DETECT value does: bump CUES_VERSION.

Relative loudness (the sound level against the median of the surrounding
minute) is stored on each audio range as `rel_db`. It does not decide a level
yet, and is not a cue on its own: on mastered-to-the-ceiling audio "loud" says
little, and 60 such stretches in an episode would only be noise for Claude.

`klipian cues VIDEO --listen` cuts WAV clips of what this module found (the
same cache, the same levels) and lists them, to listen to and judge.
"""

from __future__ import annotations

import csv
import json
import subprocess
import time
from bisect import bisect_left
from pathlib import Path

from .paths import ROOT

CUES_VERSION = 1

MODEL = ROOT / "assets" / "models" / "yamnet.onnx"
CLASS_MAP = ROOT / "assets" / "models" / "yamnet_class_map.csv"
SR = 16000
HOP = 0.48               # YAMNet gives one row of scores per 0.48 s ...
WIN = 0.96               # ... each looking at 0.96 s of audio

# ------------------------------------------------------------------ the tables

# YAMNet classes, picked BY NAME from yamnet_class_map.csv (the index order is
# the model's business). A range's score is the highest of its classes.
GROUPS = {
    "laughter": ["Laughter", "Giggle", "Chuckle, chortle", "Belly laugh", "Snicker"],
    "applause": ["Applause", "Cheering"],
    "shout":    ["Shout", "Yell", "Screaming", "Gasp"],
    "music":    ["Music"],
}

# When a frame counts as "present" (score), how many quiet frames may sit
# between two present ones inside one range (gap), and the shortest range
# worth reporting (min_len, seconds).
DETECT = {
    "laughter": {"score": 0.30, "gap": 1, "min_len": 0.0},
    "applause": {"score": 0.30, "gap": 1, "min_len": 0.0},
    "shout":    {"score": 0.30, "gap": 1, "min_len": 0.0},
    # Music is only worth a line when it is long enough to be an intro, an
    # outro or an ad (and a copyright risk), not a few stray frames.
    "music":    {"score": 0.50, "gap": 4, "min_len": 3.0},
}

# Level rules, tried in order: the first whose peak score and length (seconds)
# are both reached wins. Anything under the last rule's peak is not a cue.
_STRONG_SOUND = [("high", 0.60, 0.0), ("high", 0.50, 2.5), ("medium", 0.45, 0.0), ("low", 0.30, 0.0)]
LEVELS = {
    "laughter": _STRONG_SOUND,
    "applause": _STRONG_SOUND,
    "shout":    _STRONG_SOUND,
    "music":    None,                    # no levels: always "avoid"
}

TIMING = {
    "pause_min": 3.0,            # seconds of silence between two words
    "pause_words": 6,            # how many of the words after it are quoted
    "fast_window": 10.0,         # words are counted per window of this many seconds ...
    "fast_step": 2.0,            # ... moved by this much
    "fast_percentile": 95,       # a window above this percentile of the video's own windows is fast
    "fast_merge_gap": 2.0,       # windows closer than this make one range
}

REL_ENERGY = {"window": 60}      # seconds each side, for the median the level is compared to

# A candidate clip "has" the cues that overlap it or start within this many
# seconds after it ends (a laugh belongs to the line before it).
CLIP_TAIL = 5.0

# Order and wording of the signals wherever they are listed.
KINDS = ["laughter", "applause", "shout", "music", "pause", "fast talk"]


def level_of(kind: str, peak: float, length: float) -> str | None:
    """low / medium / high for a sound cue; "avoid" for music; None for kinds
    without levels (pauses, fast talk) and for a range too weak to be a cue."""
    if kind == "music":
        return "avoid"
    for level, min_peak, min_len in LEVELS.get(kind) or []:
        if peak >= min_peak and length >= min_len:
            return level
    return None


# ------------------------------------------------------------------ audio (YAMNet)

def _decode(video: Path):
    import numpy as np
    from .ffmpeg_tools import _require
    out = subprocess.run([_require("ffmpeg"), "-loglevel", "error", "-i", str(video), "-vn",
                          "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"],
                         capture_output=True, check=True).stdout
    return np.frombuffer(out, dtype=np.float32)


def _scores(wave):
    """YAMNet scores [frames, 521]. Run in 10-minute pieces so a two-hour
    stream doesn't need gigabytes: a piece starts on a frame boundary (a
    multiple of 0.48 s, which is a whole number of spectrogram hops) and carries
    the extra audio a frame needs, so the rows match a single run."""
    import numpy as np
    import onnxruntime as ort
    sess = ort.InferenceSession(str(MODEL), providers=["CPUExecutionProvider"])
    hop = int(HOP * SR)
    per_piece = 1250
    parts = []
    for first in range(0, max(1, (len(wave) - hop) // hop), per_piece):
        # One hop more than the piece's last frame needs: the model's own
        # framing of the spectrogram leaves that frame slightly different when
        # the audio ends exactly at its window (measured: up to 0.04 in the
        # score), so the extra row is computed and thrown away.
        piece = wave[first * hop: (first + per_piece) * hop + 2 * hop]
        if len(piece) < int(WIN * SR):
            break
        rows = sess.run(["output_0"], {"waveform": piece})[0]
        parts.append(rows[:per_piece])
    return np.concatenate(parts) if parts else np.zeros((0, 521), dtype=np.float32)


def _class_indices(names: list[str]) -> list[int]:
    with open(CLASS_MAP, newline="", encoding="utf-8") as fh:
        by_name = {row["display_name"]: int(row["index"]) for row in csv.DictReader(fh)}
    missing = [n for n in names if n not in by_name]
    if missing:
        raise RuntimeError(f"not in yamnet_class_map.csv: {missing}")
    return [by_name[n] for n in names]


def _ranges(score, threshold: float, gap: int) -> list[dict]:
    import numpy as np
    out: list[dict] = []
    for i in np.flatnonzero(score >= threshold):
        i = int(i)
        if out and i - out[-1]["last"] <= gap + 1:
            out[-1]["last"] = i
        else:
            out.append({"first": i, "last": i})
    for r in out:
        sl = score[r["first"]:r["last"] + 1]
        r["start"] = r["first"] * HOP
        r["end"] = r["last"] * HOP + WIN
        r["peak"] = float(sl.max())
        r["mean"] = float(sl.mean())
    return out


def detect_audio(video: Path) -> list[dict]:
    """Raw ranges for every audio kind: {kind, start, end, peak, mean, rel_db}."""
    import numpy as np
    wave = _decode(video)
    scores = _scores(wave)
    secs = int(len(wave) / SR)
    rms = np.sqrt(np.maximum((wave[:secs * SR].reshape(secs, SR) ** 2).mean(axis=1), 1e-12))
    db = 20 * np.log10(rms)
    w = REL_ENERGY["window"]
    rel = np.array([db[i] - np.median(db[max(0, i - w):min(secs, i + w + 1)]) for i in range(secs)])

    cues = []
    for kind, names in GROUPS.items():
        if not len(scores):
            break
        spec = DETECT[kind]
        score = scores[:, _class_indices(names)].max(axis=1)
        for r in _ranges(score, spec["score"], spec["gap"]):
            if r["end"] - r["start"] < spec["min_len"]:
                continue
            seg = rel[int(r["start"]):int(r["end"]) + 1]
            cues.append({"kind": kind, "start": round(r["start"], 2), "end": round(r["end"], 2),
                         "peak": round(r["peak"], 3), "mean": round(r["mean"], 3),
                         "rel_db": round(float(seg.max()), 1) if len(seg) else 0.0})
    return cues


def run_audio_cues(video: Path, cache) -> dict:
    """Detect and save. NEVER raises: a failure is written into the cache file
    (and returned) so the editor can say "failed: ..." instead of showing
    nothing, and so the next Find clips tries again."""
    started = time.time()
    try:
        record = {"version": CUES_VERSION, "status": "ok", "cues": detect_audio(video)}
    except Exception as exc:                                  # noqa: BLE001
        record = {"version": CUES_VERSION, "status": "failed",
                  "error": f"{type(exc).__name__}: {exc}", "cues": []}
    record["seconds"] = round(time.time() - started, 1)
    record["at"] = int(time.time())
    path = cache.cues_path(video)
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(record, ensure_ascii=False), encoding="utf-8")
    tmp.replace(path)
    return record


def audio_record(video: Path, cache) -> dict | None:
    """The saved result for this video, or None if there is none or it is from
    another version of the detection (then it counts as not run)."""
    try:
        record = json.loads(cache.cues_path(video).read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None
    return record if isinstance(record, dict) and record.get("version") == CUES_VERSION else None


# ------------------------------------------------------------------ timing (words)

def _percentile(sorted_values: list[int], q: float) -> float:
    """Linear interpolation between ranks, like numpy's default."""
    if not sorted_values:
        return 0.0
    pos = (len(sorted_values) - 1) * q / 100
    lo = int(pos)
    hi = min(lo + 1, len(sorted_values) - 1)
    return sorted_values[lo] + (sorted_values[hi] - sorted_values[lo]) * (pos - lo)


def timing_cues(words: list, duration: float) -> list[dict]:
    """Long pauses and fast talk from word timestamps (Word objects)."""
    out: list[dict] = []
    for i, (a, b) in enumerate(zip(words, words[1:])):
        gap = b.start - a.end
        if gap >= TIMING["pause_min"]:
            after = " ".join(w.text.strip() for w in words[i + 1:i + 1 + TIMING["pause_words"]])
            out.append({"kind": "pause", "start": round(a.end, 2), "end": round(b.start, 2),
                        "len": round(gap, 2), "before": after})

    if words and duration > TIMING["fast_window"]:
        starts = [w.start for w in words]
        win, step = TIMING["fast_window"], TIMING["fast_step"]
        grid = [k * step for k in range(int((duration - win) / step) + 1)]
        counts = [bisect_left(starts, t + win) - bisect_left(starts, t) for t in grid]
        limit = _percentile(sorted(counts), TIMING["fast_percentile"])
        over = [(t, t + win, c) for t, c in zip(grid, counts) if c > limit]
        merged: list[list] = []
        for a, b, c in over:
            if merged and a - merged[-1][1] <= TIMING["fast_merge_gap"]:
                merged[-1][1] = max(merged[-1][1], b)
                merged[-1][2] = max(merged[-1][2], c)
            else:
                merged.append([a, b, c])
        for a, b, c in merged:
            out.append({"kind": "fast talk", "start": round(a, 2), "end": round(b, 2), "words": c})
    return out


# ------------------------------------------------------------------ what readers get

def load(video: Path | None, cache) -> dict:
    """Everything known about a video, ready to read:

        {"status": {"audio": "ok" | "failed" | "not run", "audio_error": "...",
                    "timing": "ok" | "no transcript"},
         "cues": [{kind, start, end, level?, ...}, ...]}      sorted by start

    `video` may be None (a name the server can't find): then nothing is known.
    Levels are worked out here, from the raw ranges in the cache."""
    status = {"audio": "not run", "audio_error": "", "timing": "no transcript"}
    cues: list[dict] = []

    record = audio_record(video, cache) if video else None
    if record:
        status["audio"] = record["status"]
        status["audio_error"] = record.get("error", "")
        for c in record.get("cues", []):
            level = level_of(c["kind"], c["peak"], c["end"] - c["start"])
            if level is None:
                continue
            cues.append({**c, "level": level, "len": round(c["end"] - c["start"], 2)})

    tpath = cache.find_transcript(video) if video else None
    if tpath:
        from .models import Transcript
        try:
            transcript = Transcript.load(tpath)
            cues += timing_cues(transcript.words, transcript.duration)
            status["timing"] = "ok"
        except (OSError, ValueError, KeyError):
            status["timing"] = "failed"

    cues.sort(key=lambda c: (c["start"], c["kind"]))
    return {"status": status, "cues": cues}


def counts(cues: list[dict]) -> dict[str, int]:
    return {k: sum(c["kind"] == k for c in cues) for k in KINDS}


def for_range(cues: list[dict], start: float, end: float, tail: float = CLIP_TAIL) -> list[dict]:
    """The cues a candidate clip [start, end] has: those that overlap it or
    begin within `tail` seconds after it. Compact (kind, start, end, level)."""
    out = []
    for c in cues:
        if c["start"] < end + tail and c["end"] > start:
            item = {"kind": c["kind"], "start": c["start"], "end": c["end"]}
            if c.get("level"):
                item["level"] = c["level"]
            out.append(item)
    return out


# ------------------------------------------------------------------ for listening

def rank_key(c: dict):
    """Strongest first, within one kind."""
    if c["kind"] == "fast talk":
        return (c.get("words", 0), c["end"] - c["start"])
    if c["kind"] == "pause":
        return (c["len"], 0.0)
    if c["kind"] == "music":
        return ((c["end"] - c["start"]) * c.get("mean", 0.0), 0.0)
    return (c["peak"], c["end"] - c["start"])


def select(cues: list[dict], kind: str | None = None, level: str | None = None,
           top: int | None = None, at: list[float] | None = None, near: float = 1.0) -> list[dict]:
    """The cues to listen to. `kind` / `level` filter. `at` (seconds) keeps the
    cues within `near` seconds of any of those times; otherwise `top` keeps that
    many of each kind, strongest first. Time order in the result."""
    keep = [c for c in cues
            if (kind is None or c["kind"] == kind) and (level is None or c.get("level") == level)]
    if at:
        keep = [c for c in keep if any(c["start"] - near <= t <= c["end"] + near for t in at)]
    elif top:
        by_kind: dict[str, list[dict]] = {}
        for c in keep:
            by_kind.setdefault(c["kind"], []).append(c)
        keep = [c for group in by_kind.values()
                for c in sorted(group, key=rank_key, reverse=True)[:top]]
    return sorted(keep, key=lambda c: (c["start"], c["kind"]))


def write_clip(wave, start: float, end: float, dest: Path, pad: float = 3.0, max_len: float = 14.0) -> None:
    """A WAV of [start - pad, end + pad], at most `max_len` s (centred if longer)."""
    import wave as wavefile
    import numpy as np
    a, b = start - pad, end + pad
    if b - a > max_len:
        mid = (start + end) / 2
        a, b = mid - max_len / 2, mid + max_len / 2
    a = max(0.0, a)
    b = min(len(wave) / SR, b)
    pcm = (np.clip(wave[int(a * SR):int(b * SR)], -1, 1) * 32767).astype("<i2")
    with wavefile.open(str(dest), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())


def words_near(words: list, start: float, end: float, pad: float = 1.0) -> str:
    return " ".join(w.text.strip() for w in words if w.end >= start - pad and w.start <= end + pad)
