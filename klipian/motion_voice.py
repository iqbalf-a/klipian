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


# The expression and pause tags of the Google AI Studio script (the Gemini TTS docs, checked 2026-10-28): only these, in English, in angle brackets.
# A tag is never a sound effect. They exist in the export only; the story has none, and the matching ignores them.
EXPRESSION_TAGS = frozenset({"argh", "breath", "heavy breath", "exhales", "cackle", "cheer", "chuckle", "chuckles", "cough", "cry", "gasp", "giggle",
                             "groan", "growl", "grunt", "grr", "hiss", "laugh", "laughter", "moan", "pant", "pff", "phew", "scream", "shout", "shriek",
                             "sigh", "sighs", "sneeze", "snicker", "snort", "sob", "throat-clearing", "tsk", "whimper", "whispers", "whispering", "yawn",
                             "short pause", "long pause"})
_TAG_RE = re.compile("<(" + "|".join(re.escape(t) for t in sorted(EXPRESSION_TAGS, key=len, reverse=True)) + ")>")


# the square-bracket tags (VoiceStudio: the pauses, the optional [laughter] and [sigh]) and the "Bagian N" marker lines of the exports
_SQUARE_RE = re.compile(r"\[(?:pause(?: \d+(?:ms|s))?|laughter|sigh|laughs(?: harder)?|starts laughing|wheezing|whispers|sighs|exhales|sarcastic|curious|excited|crying|snorts|mischievously)\]")
_ELLIPSIS_RE = re.compile(r"\.\.\.(?=\s|$)")         # an ellipsis that ends a sentence goes back to its full stop
_MARKER_RE = re.compile(r"(?m)^Bagian \d+ \(sekitar \d+ detik\)\s*$")


def strip_tags(text: str) -> str:
    """The text without the expression and pause tags and the export's "Bagian N" marker lines, with its spaces made single."""
    t = _TAG_RE.sub(" ", str(text or ""))
    t = _SQUARE_RE.sub(" ", t)
    t = _MARKER_RE.sub(" ", t)
    t = _ELLIPSIS_RE.sub(".", t)
    return re.sub(r"\s+", " ", t).strip()


def tokens(text: str) -> list[tuple[str, str]]:
    """The words of a text as (as written, normalised): the first goes on the screen, the second is what is matched. Tags are not words."""
    out = []
    for raw in strip_tags(text).split():
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
        out["unmatched"] = []                                  # the estimate does not use what was heard: nothing to show
        return out
    unmatched = [{"beat": beats[flat[i][0]]["id"], "w": flat[i][1]} for i, t in enumerate(times) if t is None]
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
    out = _collect(beats, flat, fixed, "whisper", ratio)
    out["unmatched"] = unmatched
    return out


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
# several narration files: their order and what is wrong with the series (no files here: the names only)
# --------------------------------------------------------------------------

PART_RE = re.compile(r"^(?P<prefix>.*?)[ _-]*(?P<num>\d+)$")
GAP = 0.25                   # seconds of silence between two parts (a setting of 0 to 1 s)
PART_MIN, PART_MAX = 0.3, 180.0


def series(names: list[str]) -> dict:
    """The order of the parts: by the number at the end of each name (natural: 2 before 10), not by the name. {"ok", "order" (indexes into names),
    "warnings", "errors"}. A name with no number is an error when there are several parts; a missing number or a different prefix is a warning."""
    out: dict = {"ok": True, "order": list(range(len(names))), "warnings": [], "errors": []}
    if len(names) <= 1:
        return out
    rows = []
    for i, name in enumerate(names):
        m = PART_RE.match(Path(name).stem)
        if not m:
            out["errors"].append(f"{name}: a part needs a number at the end of its name, like colokan_1.wav")
            continue
        rows.append((int(m.group("num")), m.group("prefix").rstrip(" _-"), i))
    if out["errors"]:
        out["ok"] = False
        return out
    rows.sort()
    nums = [r[0] for r in rows]
    if len(set(nums)) != len(nums):
        out["errors"].append(f"two parts have the same number: {', '.join(str(n) for n in sorted({n for n in nums if nums.count(n) > 1}))}")
        out["ok"] = False
        return out
    prefixes = sorted({r[1] for r in rows})
    if len(prefixes) > 1:
        out["warnings"].append(f"the names do not share one prefix: {', '.join(repr(p) for p in prefixes)}")
    missing = [n for n in range(nums[0], nums[-1] + 1) if n not in nums]
    if missing:
        out["warnings"].append(f"the series has no part {', '.join(str(n) for n in missing)}")
    out["order"] = [r[2] for r in rows]
    return out


# --------------------------------------------------------------------------
# the match table and the subtitles (from the aligned, timed story)
# --------------------------------------------------------------------------

BEAT_WARN_PCT = 0.20         # a beat off by more than this share of its planned length is flagged
BEAT_WARN_S = 1.5            # or by more than this many seconds
LENGTH_MAX_PCT = 0.15        # the video follows the voice when its length is within this share of the chosen length


def match_table(planned: list[dict], timed: dict, target: float) -> dict:
    """Per beat: the planned length (the story as written), the real length (the aligned story), the difference and a warning; the new total and
    whether the length policy holds (within LENGTH_MAX_PCT of the chosen length)."""
    rows = []
    for plan_beat, real in zip(planned, timed["beats"]):
        expected, got = float(plan_beat["dur"]), float(real["dur"])
        delta = round(got - expected, 2)
        warn = abs(delta) > BEAT_WARN_S or (expected > 0 and abs(delta) > BEAT_WARN_PCT * expected)
        rows.append({"id": real["id"], "expected": round(expected, 2), "real": round(got, 2), "delta": delta, "warn": warn})
    total = round(float(timed["duration"]), 2)
    pct = round((total - target) / target * 100, 1) if target else 0.0
    return {"beats": rows, "total": total, "target": target, "percent": pct, "lengthOk": abs(total - target) <= LENGTH_MAX_PCT * target + 1e-9}


# --------------------------------------------------------------------------
# "fit": cut the recording at the subtitle lines and lay the pieces into the planned beats (the narration is shorter than the plan)
# --------------------------------------------------------------------------

_WIDTHS = json.loads((Path(__file__).parent / "caption_widths.json").read_text(encoding="utf-8"))   # made from remotion/src/fontMetrics.ts
# the caption looks of remotion/src/layout.ts CAPTION_VARIANTS: font size, text width, lines, words a page
CAPTION_LOOKS = {"classic": (56, 720, 2, 10**9), "wide": (46, 720, 1, 10**9), "punch": (76, 700, 1, 3)}
FIT_LEAD = 0.15              # a piece starts this long before its first word (less when the neighbour is closer)
FIT_TAIL = 0.30              # and ends this long after its last word
FIT_FADE = 0.01              # the fade in and out of every piece, so a cut never clicks


def text_width(text: str, fs: float) -> float:
    """textWidthEstimate of remotion/src/layout.ts."""
    return sum(_WIDTHS["widths"].get(c, _WIDTHS["fallback"]) for c in text) * fs


def pages_of(words: list[dict], look: str = "classic") -> list[list[dict]]:
    """pagesOf of remotion/src/captions.ts: the words ({"w","a","b"}) grouped into the subtitle pages the captions show (tests compare it with the TS one).
    A sentence ends its page; a sentence too long for one page is split at the comma nearest its middle (then again if needed)."""
    fs, max_width, max_lines, max_words = CAPTION_LOOKS.get(look or "classic", CAPTION_LOOKS["classic"])
    space = text_width(" ", fs)

    def greedy(ws: list[dict]) -> list[list[dict]]:
        pages: list[list[dict]] = []
        cur: list[dict] = []
        lines, width, on_line = 1, 0.0, 0
        for w in ws:
            if len(cur) >= max_words:
                pages.append(cur)
                cur, lines, width, on_line = [], 1, 0.0, 0
            wd = text_width(w["w"], fs)
            if on_line and width + space + wd > max_width:
                if lines >= max_lines:
                    pages.append(cur)
                    cur, lines, width, on_line = [], 1, 0.0, 0
                else:
                    lines, width, on_line = lines + 1, 0.0, 0
            width += (space if on_line else 0) + wd
            on_line += 1
            cur.append(w)
        if cur:
            pages.append(cur)
        return pages

    def fit_sentence(ws: list[dict]) -> list[list[dict]]:
        g = greedy(ws)
        commas = [i for i, w in enumerate(ws) if 0 < i < len(ws) - 1 and re.search(r"[,;:]$", w["w"])]
        if len(g) < 2 or not commas:
            return g
        k = min(commas, key=lambda i: abs(i + 1 - len(ws) / 2))          # the first of equals, as the TS reduce
        return fit_sentence(ws[:k + 1]) + fit_sentence(ws[k + 1:])

    pages: list[list[dict]] = []
    sentence: list[dict] = []
    for w in words:
        sentence.append(w)
        if re.search(r"[.!?…][\"'”’)]*$", w["w"]):
            pages += fit_sentence(sentence)
            sentence = []
    return pages + fit_sentence(sentence)


def fit(story: dict, alignment: dict, total: float) -> dict:
    """Lay the narration into the planned beats. Per beat the words go into subtitle pages; the recording is cut in the pause before each page (the middle
    of the gap between two words); the pieces sit at the start of their beat, each followed by an equal share of what is left of the beat's planned `dur`
    (so the speech never starts late and the pauses are the same size). A beat whose speech is longer than its `dur` is extended to the speech and a note
    says so. A beat with no narration keeps its `dur` in silence.
    Returns {"timed" (the story with the new durations and word times), "pieces" ([{"src": [a, b], "dst": t}] in order), "silences" ([{"dst", "len"}]),
    "pauses" (every inserted pause in seconds), "longestPause", "notes", "duration"}."""
    s = copy.deepcopy(story)
    beats = s["beats"]
    look = s.get("captionStyle") or "classic"
    flat = [w for b in beats for w in (alignment["beats"].get(b["id"]) or {}).get("words", [])]    # every word in speech order, for the neighbours
    nxt = {id(w): (flat[i + 1]["a"] if i + 1 < len(flat) else total) for i, w in enumerate(flat)}
    prv = {id(w): (flat[i - 1]["b"] if i else 0.0) for i, w in enumerate(flat)}
    pieces: list[dict] = []
    pauses: list[float] = []
    notes: list[str] = []
    clock = 0.0
    for b in beats:
        e = alignment["beats"].get(b["id"])
        plan = float(b["dur"])
        if not e or not e["words"]:
            b["dur"] = round(plan, 3)
            clock += plan
            continue
        pages = pages_of(e["words"], look)
        def cut(lead, tail):
            out = []
            for pg in pages:
                a, z = pg[0], pg[-1]
                lo = max(0.0, max(a["a"] - lead, (prv[id(a)] + a["a"]) / 2))
                hi = min(total, min(z["b"] + tail, (z["b"] + nxt[id(z)]) / 2 if nxt[id(z)] < total else total))
                out.append((lo, max(hi, z["b"] + 0.02)))
            return out

        cuts = cut(FIT_LEAD, FIT_TAIL)
        speech = sum(hi - lo for lo, hi in cuts)
        if speech > plan:                                            # no room: the cuts sit closer to the words (the beat is extended less)
            cuts = cut(FIT_LEAD / 3, FIT_TAIL / 3)
            speech = sum(hi - lo for lo, hi in cuts)
        extra = max(0.0, plan - speech) / len(pages)
        dur = max(plan, speech)
        if speech > plan + 1e-9:
            notes.append(f"{b['id']}: the speech is {speech:.1f} s, longer than the planned {plan:.1f} s; the beat is {dur:.1f} s.")
        t = 0.0
        words_out: list[dict] = []
        for pg, (lo, hi) in zip(pages, cuts):
            pieces.append({"src": [round(lo, 3), round(hi, 3)], "dst": round(clock + t, 3), "len": round(hi - lo, 3)})
            for w in pg:
                a = t + (w["a"] - lo)
                words_out.append({"w": w["w"], "a": round(a, 3), "b": round(max(a + 0.02, t + (w["b"] - lo)), 3)})
            t += hi - lo
            if extra > 1e-9:
                pauses.append(round(extra, 3))
            t += extra
        b["words"] = words_out
        b["dur"] = round(dur, 3)
        clock += dur
    s["duration"] = round(sum(x["dur"] for x in beats), 3)
    s["captions"] = True
    return {"timed": s, "pieces": pieces, "pauses": pauses, "longestPause": max(pauses, default=0.0), "notes": notes, "duration": s["duration"]}


def fit_command(ffmpeg: str, src: Path, out: Path, result: dict, story: dict) -> list[str]:
    """The ffmpeg command that makes the fitted audio: every piece trimmed with a 10 ms fade at both ends, silence for the rest of every beat."""
    parts, labels = [], []
    at = 0.0
    for i, pc in enumerate(result["pieces"]):
        gap = pc["dst"] - at
        if gap > 0.0005:
            parts.append(f"anullsrc=r=48000:cl=mono,atrim=0:{gap:.4f}[s{i}]")
            labels.append(f"[s{i}]")
        a, z = pc["src"]
        d = z - a
        f = min(FIT_FADE, d / 2)
        parts.append(f"[0:a]atrim={a:.4f}:{z:.4f},asetpts=PTS-STARTPTS,afade=t=in:d={f},afade=t=out:st={d - f:.4f}:d={f}[p{i}]")
        labels.append(f"[p{i}]")
        at = pc["dst"] + d
    tail = result["duration"] - at
    if tail > 0.0005:
        parts.append(f"anullsrc=r=48000:cl=mono,atrim=0:{tail:.4f}[tail]")
        labels.append("[tail]")
    parts.append("".join(labels) + f"concat=n={len(labels)}:v=0:a=1[o]")
    return [ffmpeg, "-y", "-loglevel", "error", "-i", str(src), "-filter_complex", ";".join(parts), "-map", "[o]", "-ar", "48000", "-ac", "1", str(out)]



def _stamp(sec: float, sep: str) -> str:
    ms = int(round(max(0.0, sec) * 1000))
    h, ms = divmod(ms, 3600_000)
    m, ms = divmod(ms, 60_000)
    s, ms = divmod(ms, 1000)
    return f"{h:02d}:{m:02d}:{s:02d}{sep}{ms:03d}"


LINE_MAX = 42                # characters a line may hold
LINES_PER_CUE = 2


def cues(story: dict) -> list[dict]:
    """One cue per caption: up to two lines of LINE_MAX characters, from the word times of the timed story (each beat's words are relative to its
    start). {"start", "end", "lines"} in seconds of the video. A cue never crosses a beat."""
    out: list[dict] = []
    cursor = 0.0
    for beat in story["beats"]:
        lines: list[list[str]] = []
        start = end = None
        for w in beat.get("words") or []:
            a, b = cursor + float(w["a"]), cursor + float(w["b"])
            if not lines or len(" ".join(lines[-1] + [w["w"]])) > LINE_MAX:
                if len(lines) == LINES_PER_CUE:                 # a cue is full: close it, start the next
                    out.append({"start": start, "end": end, "lines": [" ".join(ln) for ln in lines]})
                    lines, start = [], None
                lines.append([])
            if start is None:
                start = a
            lines[-1].append(w["w"])
            end = b
        if lines and start is not None:
            out.append({"start": start, "end": end, "lines": [" ".join(ln) for ln in lines if ln]})
        cursor += float(beat["dur"])
    return out


def srt(story: dict) -> str:
    return "".join(f"{i}\n{_stamp(c['start'], ',')} --> {_stamp(c['end'], ',')}\n" + "\n".join(c["lines"]) + "\n\n" for i, c in enumerate(cues(story), 1))


def vtt(story: dict) -> str:
    return "WEBVTT\n\n" + "".join(f"{_stamp(c['start'], '.')} --> {_stamp(c['end'], '.')}\n" + "\n".join(c["lines"]) + "\n\n" for c in cues(story))


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
