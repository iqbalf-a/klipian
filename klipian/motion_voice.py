"""The voice of a motion video (P28-P): word timings from a narration, and a story whose beats follow it.

Pure helpers, no files and no Node (motion.py does the project-bound work):
  align(beats, heard)       match what faster-whisper heard (words with times) to the words the story's narration says, beat by beat
  estimate(beats, total)    the fallback: the narration's words spread over the audio by their length
  timed_story(story, al, total)   a copy of the story whose beats last as long as their narration (with a minimum hold), the word times
                            written into each beat for the karaoke captions, `captions` on, `duration` = the new total

The narration is the file a person recorded or a local TTS command made; klipian never calls a cloud voice service.
"""

from __future__ import annotations

import copy
import difflib
import json
import re
import shlex
import subprocess
import tempfile
from pathlib import Path

MIN_HOLD = 1.0               # a beat lasts at least this long, however short its narration
TAIL = 0.6                   # what the last beat keeps after the last word
LEAD = 0.0                   # the narration starts where the video starts
MATCH_MIN = 0.5              # below this share of matched words the alignment is not trusted: the estimate is used


def tokens(text: str) -> list[tuple[str, str]]:
    """The words of a text as (as written, normalised): the first goes on the screen, the second is what is matched."""
    out = []
    for raw in str(text or "").split():
        norm = re.sub(r"[^\w]+", "", raw.lower(), flags=re.UNICODE)
        out.append((raw, norm))
    return out


def _flat(beats: list[dict]) -> list[tuple[int, str, str]]:
    return [(bi, raw, norm) for bi, b in enumerate(beats) for raw, norm in tokens(b.get("narration", ""))]


def estimate(beats: list[dict], total: float) -> dict:
    """Words spread over the audio in proportion to their length (the narration is assumed to fill it from LEAD to total - TAIL)."""
    flat = _flat(beats)
    span = max(0.5, total - LEAD - TAIL)
    weight = sum(len(n or r) + 2 for _, r, n in flat) or 1
    t, times = LEAD, []
    for _, raw, norm in flat:
        d = span * (len(norm or raw) + 2) / weight
        times.append((t, t + d))
        t += d
    return _collect(beats, flat, times, "estimate", 0.0)


def align(beats: list[dict], heard: list[dict], total: float) -> dict:
    """`heard`: [{text, start, end}] in speaking order (what the recogniser returned). Each word of the story that matches a heard word gets its time;
    the ones between are spread between their neighbours. Under MATCH_MIN matched, the estimate is returned instead (method "estimate")."""
    flat = _flat(beats)
    h = [(str(w.get("text", "")), re.sub(r"[^\w]+", "", str(w.get("text", "")).lower(), flags=re.UNICODE), float(w["start"]), float(w["end"])) for w in heard]
    h = [x for x in h if x[1]]
    sm = difflib.SequenceMatcher(None, [n for _, _, n in flat], [x[1] for x in h], autojunk=False)
    times: list[tuple[float, float] | None] = [None] * len(flat)
    matched = 0
    for a, b, size in sm.get_matching_blocks():
        for k in range(size):
            times[a + k] = (h[b + k][2], h[b + k][3])
            matched += 1
    ratio = matched / len(flat) if flat else 0.0
    if not flat or ratio < MATCH_MIN:
        out = estimate(beats, total)
        out["ratio"] = round(ratio, 2)
        return out
    # the words that were not heard: spread between the neighbours that were
    i = 0
    while i < len(times):
        if times[i] is not None:
            i += 1
            continue
        j = i
        while j < len(times) and times[j] is None:
            j += 1
        left = times[i - 1][1] if i > 0 else LEAD
        right = times[j][0] if j < len(times) else max(left + 0.2, total - TAIL)
        right = max(right, left + 0.05 * (j - i))
        step = (right - left) / (j - i)
        for k in range(i, j):
            times[k] = (left + (k - i) * step, left + (k - i + 1) * step)
        i = j
    # times never go back
    prev = 0.0
    fixed: list[tuple[float, float]] = []
    for a, b in times:                                         # type: ignore[misc]
        a = max(a, prev)
        b = max(b, a + 0.02)
        fixed.append((a, b))
        prev = b
    return _collect(beats, flat, fixed, "whisper", ratio)


def _collect(beats, flat, times, method: str, ratio: float) -> dict:
    out: dict = {"method": method, "ratio": round(ratio, 2), "beats": {}}
    for (bi, raw, _), (a, b) in zip(flat, times):
        e = out["beats"].setdefault(beats[bi]["id"], {"words": []})
        e["words"].append({"w": raw, "a": round(a, 3), "b": round(b, 3)})
    for beat in beats:
        e = out["beats"].get(beat["id"])
        if e:
            e["start"], e["end"] = e["words"][0]["a"], e["words"][-1]["b"]
    return out


def timed_story(story: dict, alignment: dict, total: float, min_hold: float = MIN_HOLD) -> dict:
    """The story with its beats following the narration. A beat starts where its first word starts (the first one at 0) and lasts until the next
    beat's first word, at least `min_hold`; the last keeps TAIL after its last word and lasts until the audio ends. The word times go into the beats
    (relative to the beat) and `captions` is on. A beat with no narration words keeps its own length."""
    s = copy.deepcopy(story)
    beats = s["beats"]
    starts: list[float | None] = []
    for b in beats:
        e = alignment["beats"].get(b["id"])
        starts.append(e["start"] if e else None)
    starts[0] = 0.0 if starts[0] is not None else None
    cursor = 0.0
    for i, b in enumerate(beats):
        e = alignment["beats"].get(b["id"])
        nxt = next((starts[k] for k in range(i + 1, len(beats)) if starts[k] is not None), None)
        if e is None:
            dur = b["dur"]
        elif nxt is None:
            dur = max(min_hold, max(total, e["end"] + TAIL) - cursor)
        else:
            dur = max(min_hold, nxt - cursor)
        dur = round(min(30.0, dur), 3)
        if e:
            b["words"] = [{"w": w["w"], "a": round(max(0.0, w["a"] - cursor), 3), "b": round(min(dur, max(w["b"] - cursor, w["a"] - cursor + 0.02)), 3)} for w in e["words"]]
        b["dur"] = dur
        cursor += dur
    s["duration"] = round(sum(b["dur"] for b in beats), 3)
    s["captions"] = True
    return s


# --------------------------------------------------------------------------
# a local text-to-speech command (never a cloud service): the person sets it, klipian only runs it
# --------------------------------------------------------------------------

def tts_command(machine: Path) -> str:
    """The command that turns a text file into a WAV: "motionTts" in workspace/machine.json, e.g. 'mytts --in "{text}" --out "{out}"'. "" when none is set."""
    try:
        return str(json.loads(machine.read_text(encoding="utf-8")).get("motionTts") or "").strip()
    except (OSError, ValueError, AttributeError):
        return ""


def run_tts(command: str, text: str, out: Path, timeout: float = 900) -> None:
    """Runs `command` with {text} (a UTF-8 file holding the narration) and {out} (the WAV it must write) filled in. No shell."""
    with tempfile.TemporaryDirectory() as tmp:
        f = Path(tmp) / "narration.txt"
        f.write_text(text, encoding="utf-8")
        argv = [part.replace("{text}", str(f)).replace("{out}", str(out)) for part in shlex.split(command, posix=False)]
        argv = [a[1:-1] if len(a) > 1 and a[0] == a[-1] == '"' else a for a in argv]
        proc = subprocess.run(argv, capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=timeout)
    if proc.returncode != 0 or not out.is_file():
        tail = (proc.stderr or proc.stdout or "").strip().splitlines()[-1:] or ["no output"]
        raise RuntimeError(f"the text-to-speech command failed: {tail[0][:200]}")
