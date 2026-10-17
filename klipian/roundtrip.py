"""Manual round-trip through Claude, without an API key.

Workflow:

    brief  ->  a file with the rubric and the transcript, dropped into Claude
    (Claude replies with JSON)
    import ->  that reply read back as clip candidates

The UI reaches this through /api/brief and /api/import; the CLI
(`klipian brief` / `klipian import`) calls the same functions. There is no
second copy of the logic in the browser -- the first version had one, and the
two could quietly drift apart on what is the product's core contract.

Why this matters beyond just avoiding costs: you see Claude's reasoning
before anything is rendered, and you can argue with it. API-based tools
hide that step.

Key division of labor:

    Claude   gives APPROXIMATE times in min:sec
    klipian  snaps those times to the nearest word boundary

Claude doesn't need millisecond precision -- that's not its job, and forcing
it only makes the results brittle. The per-word timestamps we already have in
cache handle the final rounding.

The arithmetic and edge cases here follow what the browser version did (it was
the one being tuned through the UI), including JavaScript's rounding and its
reading of numbers in text, so a reply imports to the same candidates as
before the logic moved. tests/fixtures/brief/ holds that version's output and
`klipian selftest` checks against it.
"""

from __future__ import annotations

import json
import math
import re
from decimal import ROUND_HALF_UP, Decimal
from pathlib import Path

from .cues import for_range
from .models import Transcript, Word
from .paths import ROOT

# The rubrics a brief can carry (CLI: --mode). The UI uses "dialog".
RUBRICS = {
    "dialog": ROOT / "prompts" / "rubrik" / "dialog-podcast.md",
    "gameplay": ROOT / "prompts" / "rubrik" / "gameplay-mlbb.md",
}

# ECMAScript's whitespace + line terminators, which is what String.trim()
# strips. Not the same set as Python's str.strip().
_JS_WS = ("\t\n\v\f\r          "
          "        　﻿")


def _trim(s: str) -> str:
    return s.strip(_JS_WS)


def _js_round(x: float) -> int:
    """Math.round: halves go up (Python's round() sends them to even)."""
    f = math.floor(x)
    return f + 1 if x - f >= 0.5 else f


def fmt_stamp(seconds: float) -> str:
    t = _js_round(seconds)
    if t < 3600:
        return f"{t // 60}:{t % 60:02d}"
    return f"{t // 3600}:{(t % 3600) // 60:02d}:{t % 60:02d}"


# --------------------------------------------------------------------------
# EXPORT: the file dropped into Claude
# --------------------------------------------------------------------------

def read_rubric(path: Path) -> str:
    """The rubric as the browser used to get it from fetch(): bytes decoded
    as UTF-8 (BOM dropped), line endings untouched, empty if unreadable."""
    try:
        return path.read_bytes().decode("utf-8-sig")
    except OSError:
        return ""


def _cues_block(cues_data: dict | None) -> str:
    """The brief's separate list of audio and timing cues (see cues.py): found
    by klipian from the sound and the word timestamps, not from the words
    themselves, so Claude is told where they come from and how sure they are.
    The section is never left out: when there is nothing, or the detection
    didn't run, it says so, so an empty list can't be mistaken for a missing one."""
    status = (cues_data or {}).get("status", {})
    cues = (cues_data or {}).get("cues", [])
    lines = []
    for c in sorted(cues, key=lambda c: (c["start"], c["kind"])):
        at = f"[{fmt_stamp(c['start'])}]"
        span = f"{at}–[{fmt_stamp(c['end'])}]"
        if c["kind"] == "pause":
            lines.append(f'- {at} pause {c["len"]:.1f} s before: "{c["before"]}"')
        elif c["kind"] == "fast talk":
            lines.append(f"- {span} fast talk")
        elif c["kind"] == "music":
            lines.append(f"- {span} music · avoid")
        else:
            lines.append(f"- {span} {c['kind']} · {c['level']} ({c['len']:.1f} s)")
    notes = []
    audio = status.get("audio", "not run")
    if audio == "failed":
        notes.append(f"Audio analysis failed ({status.get('audio_error', '')}), so there are no "
                     "laughter, applause, shout or music cues for this video.")
    elif audio != "ok":
        notes.append("Audio analysis was not run for this video, so there are no laughter, "
                     "applause, shout or music cues.")
    if not lines:
        notes.append("No audio or timing cues were detected in this video." if audio == "ok"
                     else "No timing cues (long pauses, fast talk) were found either.")
    body = "\n".join(lines + notes)
    return f"""

---

## Audio & timing cues (detected locally, not from the transcript)

These come from analysing the sound and the gaps between words, not from what is
said. You can't hear the audio, so this is your only evidence about it. Each line
has a time; `high` / `medium` / `low` says how strong and long the signal is.
Treat them as supporting evidence and check them against the sentences around
them.

A cue's time is a reaction, or a point inside a moment. It is never a clip
boundary and never a clip's `start`: a clip starts where its topic or story
begins (found in the transcript), and ends after the cue's reaction is over.
By kind:

- laughter, applause: a reaction. Laughter at [3:00] means something just before
  it landed; the clip starts where the topic building toward it begins (say
  [2:45]) and ends AFTER the reaction finishes.
- shout, gasp: an emotional moment. The clip still starts at the beginning of
  its topic, unless the shout is itself a self-contained opening, which you
  judge from the transcript.
- pause: inside a moment. The line after it is often the punchline, but the clip
  starts at the beginning of the topic.
- fast talk: the peak of a story, not its start.
- music: a stretch to avoid, not a cut point. A clip must not run into it.

{body}
"""


def build_brief(transcript: Transcript, rubric: str, name: str,
                cues_data: dict | None = None) -> str:
    """A single self-contained file: task, rubric, transcript, and expected
    answer format. The user just drops it in and says "do it" -- no
    additional explanation needed.

    `rubric` is the rubric's text (read_rubric), `name` the video's file name,
    `cues_data` what cues.load returned for the video (None: not run)."""
    # strip rubric title so it doesn't clash with the brief title
    rubric = re.sub(r"\A# [^\n\r  ]*\n+", "", rubric, count=1)
    # Strip the rubric's intro paragraph, which addresses the USER, not Claude.
    # "Edit this file if the results don't match your taste" is meaningless
    # to whoever is reading this brief.
    rubric = re.sub(r"\AIni yang dibaca Claude.*?---\s*\n+", "", rubric, count=1, flags=re.S)

    row = "\n".join(f"[{fmt_stamp(s.start)}] {_trim(s.text)}"
                    for s in transcript.segments if _trim(s.text))

    return f"""# Find clips — {name}

Hello. Please read the transcript at the bottom of this file and pick moments
worth turning into short vertical videos.

**Source duration:** {fmt_stamp(transcript.duration)} · **{len(transcript.words)} words**

The times you give don't need to be precise. Approximate min:sec is fine;
klipian will snap the cut points to the nearest word boundary.

---

## Evaluation rubric

{rubric}

---

## Answer format

Reply with **a single JSON block** exactly like this, no extra explanation
outside the block.

```json
{{
  "source": "{name}",
  "clips": [
    {{
      "start": "0:12",
      "end": "1:07",
      "title": "Lose 300M Because of Timing",
      "hook": "exact quote from transcript",
      "scores": {{ "hook": 9, "complete": 8, "payoff": 9, "emotion": 8, "duration": 9 }},
      "reason": "one or two sentences for a human to read"
    }}
  ]
}}
```
{_cues_block(cues_data)}
---

## Transcript

{row}
"""


# --------------------------------------------------------------------------
# IMPORT: reading Claude's reply
# --------------------------------------------------------------------------

_UNDEFINED = object()          # a key the reply doesn't have (JS: undefined)


def _truthy(v) -> bool:
    """JS truthiness: [] and {} count as true, unlike Python."""
    if v is _UNDEFINED or v is None or v is False:
        return False
    if isinstance(v, (int, float)):
        return not (v == 0 or v != v)
    if isinstance(v, str):
        return v != ""
    return True


def _or(*values):
    """JS `a || b || c`."""
    for v in values:
        if _truthy(v):
            return v
    return values[-1]


def _nullish(a, b):
    """JS `a ?? b`."""
    return b if (a is _UNDEFINED or a is None) else a


def _number(v) -> float:
    """JS Number(v): '' and null are 0, junk is NaN."""
    if v is _UNDEFINED:
        return math.nan
    if v is None:
        return 0.0
    if isinstance(v, bool):
        return 1.0 if v else 0.0
    if isinstance(v, (int, float)):
        try:
            return float(v)
        except OverflowError:
            return math.inf if v > 0 else -math.inf
    if isinstance(v, str):
        s = _trim(v)
        if s == "":
            return 0.0
        if re.fullmatch(r"[+-]?([0-9]+\.?[0-9]*|\.[0-9]+)([eE][+-]?[0-9]+)?", s):
            return float(s)
        if re.fullmatch(r"[+-]?Infinity", s):
            return -math.inf if s[0] == "-" else math.inf
        for prefix, base in (("0x", 16), ("0o", 8), ("0b", 2)):
            if s[:2].lower() == prefix and len(s) > 2:
                try:
                    return float(int(s[2:], base))
                except ValueError:
                    return math.nan
        return math.nan
    if isinstance(v, list):
        if not v:
            return 0.0
        return _number(v[0]) if len(v) == 1 else math.nan
    return math.nan


def _finite(x: float) -> bool:
    return not (math.isnan(x) or math.isinf(x))


def _text(v) -> str:
    """`(v || "").trim()` for a field that should be text."""
    if not _truthy(v):
        return ""
    if not isinstance(v, str):
        raise ValueError("A clip has a title, hook or reason that is not text.")
    return _trim(v)


def _to_seconds(t) -> float:
    """'1:07', '01:07', '1:24:10' or a bare number. Empty or missing is NaN,
    not 0: without that, "start": "" would become a clip starting at 0:00."""
    if isinstance(t, (int, float)) and not isinstance(t, bool):
        return _number(t)
    if t is _UNDEFINED or t is None:
        return math.nan
    s = _trim(str(t) if not isinstance(t, bool) else ("true" if t else "false"))
    if s == "":
        return math.nan
    total = 0.0
    for part in s.split(":"):
        total = total * 60 + _number(part)
    return total


def _parse_json(s: str):
    def refuse(name):
        raise ValueError(name)
    try:
        return json.loads(s, parse_constant=refuse)
    except ValueError:
        # json.loads accepts NaN/Infinity, JSON.parse doesn't; both end up here.
        # The raw parser message is technical English; the user gets a sentence
        # they can act on instead.
        raise ValueError("The JSON block is there, but its content is broken — copy "
                         "Claude's reply again from the start to the end of the block.") from None


def extract_json(text: str) -> dict:
    """Claude's replies are often wrapped in code fences or prefixed with
    prose. Look inside a code fence first, else take everything from the
    first { to the last }; don't require a clean file."""
    fence = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.S)
    if fence:
        return _parse_json(fence.group(1))
    first, last = text.find("{"), text.rfind("}")
    if first == -1 or last <= first:
        raise ValueError("No JSON block found in that text.")
    return _parse_json(text[first:last + 1])


# How far a cut point may be shifted to snap to a word boundary. A word
# boundary farther than this means Claude pointed at silence, not at a word
# that was slightly off -- the original number is correct there. Without
# this limit, a 5-second clip in the middle of a long pause once ballooned
# to 79 seconds. The editor's own snapToWord() (ui/js/editor/roundtrip.js,
# used when a boundary is dragged on the timeline) has the same limit; if
# one changes, change both.
SNAP_MAX = 2.0


def snap_to_word(words: list[Word], moment: float, side: str) -> float:
    """Snap to the nearest word boundary, at most SNAP_MAX seconds away.

    side="start" -> to the START of the word being/will-be spoken
    side="end"   -> to the END of the word that just finished

    This is the part Claude can't do: it doesn't have per-word timestamps.
    We do.
    """
    if not words or not _finite(moment):
        return moment
    candidates = [w.start for w in words] if side == "start" else [w.end for w in words]
    nearest = candidates[0]
    for c in candidates[1:]:
        if abs(c - moment) < abs(nearest - moment):
            nearest = c
    return nearest if abs(nearest - moment) <= SNAP_MAX else moment


def _score_values(scores) -> list:
    """Object.values(scores)."""
    if isinstance(scores, dict):
        return list(scores.values())
    if isinstance(scores, list):
        return scores
    if isinstance(scores, str):
        return list(scores)
    return []


def _get(scores, key):
    return scores.get(key, _UNDEFINED) if isinstance(scores, dict) else _UNDEFINED


def _one_decimal(x: float) -> float:
    """Number.prototype.toFixed(1): an exact half rounds up (8.25 -> 8.3)."""
    return float(Decimal(x).quantize(Decimal("0.1"), rounding=ROUND_HALF_UP))


def parse_reply(words: list[Word], text: str, cues: list[dict] | None = None) -> list[dict]:
    """Claude's reply -> clip candidates, in the shape the editor uses (the
    same one as before the logic moved here): title, hook, in/out (min:sec),
    startSec/endSec, dur, total, scores {hook, complete, payoff}, reason and
    spans. Candidates keep Claude's order. With `cues` (cues.load()["cues"])
    each also gets `cues`: the signals inside it or just after it (laughter,
    applause, ...), worked out here from the detection, not by Claude, so the
    same reply always gives the same list. Without them the key is absent,
    which is how a candidate imported before this existed reads. Raises ValueError with a message
    meant for the person pasting the reply.

    Indonesian keys (klip, mulai, judul, ...) are intentionally still accepted
    as fallback. The prompt asks for English keys, but replies saved before
    the rename must still be importable -- and Claude occasionally answers
    using terms from the prompt prose."""
    data = extract_json(text)
    raw = _or(data.get("clips", _UNDEFINED), data.get("klip", _UNDEFINED), [])
    if not isinstance(raw, list) or not raw:
        raise ValueError('JSON does not have a "clips" list.')

    result = []
    for k in raw:
        if not isinstance(k, dict):
            continue
        g = lambda key: k.get(key, _UNDEFINED)           # noqa: E731
        # Clips without timestamps are skipped, not accepted as 0:00.
        m0 = _to_seconds(_nullish(g("start"), g("mulai")))
        s0 = _to_seconds(_nullish(g("end"), g("selesai")))
        if not _finite(m0) or not _finite(s0) or s0 <= m0:
            continue

        # Re-check after snapping: each side moves independently, so a range
        # that was valid before can end up inverted. If so, fall back to the
        # original numbers from Claude.
        m = snap_to_word(words, m0, "start")
        s = snap_to_word(words, s0, "end")
        if s <= m:
            m, s = m0, s0

        # Scores are COERCED to numbers here, at the boundary where external
        # data enters. Claude occasionally writes "nine" or "9" (string), and
        # a non-numeric value must not reach the Clips screen as such.
        scores = _or(g("scores"), g("skor"), {})
        nums = [x for x in map(_number, _score_values(scores)) if _finite(x)]
        total = 0.0
        for x in nums:                       # in order: sum() is compensated
            total += x
        num = lambda v: (lambda n: n if _finite(n) else 0)(_number(v))   # noqa: E731
        dur = _js_round(s - m)
        if dur <= 0:
            continue
        result.append({
            "title": _text(_or(g("title"), g("judul"), "Untitled")),
            "hook": _text(g("hook")),
            "in": fmt_stamp(m), "out": fmt_stamp(s),
            "startSec": m, "endSec": s,
            "dur": dur,
            "total": _one_decimal(total / len(nums)) if nums else 0,
            "scores": {
                "hook": num(_get(scores, "hook")),
                "complete": num(_nullish(_get(scores, "complete"),
                                         _get(scores, "self_contained"))),
                "payoff": num(_get(scores, "payoff")),
            },
            "reason": _text(_or(g("reason"), g("alasan"))),
            "spans": [{"start": m, "end": s}],     # one whole piece until split
            **({"cues": for_range(cues, m, s)} if cues is not None else {}),
        })

    if not result:
        raise ValueError("All clips have zero or negative duration.")
    return result


def save_candidates(candidates: list[dict], video: Path, dest: Path) -> Path:
    """What `klipian import` writes and `klipian render` reads."""
    dest.parent.mkdir(parents=True, exist_ok=True)
    payload = json.dumps({
        "source": video.name,
        "candidates": [{
            "title": k["title"],
            "hook": k["hook"],
            "in": k["in"],
            "out": k["out"],
            "start_sec": k["startSec"],
            "end_sec": k["endSec"],
            "dur": k["dur"],
            "total": k["total"],
            "scores": k["scores"],
            "reason": k["reason"],
            **({"cues": k["cues"]} if "cues" in k else {}),
        } for k in candidates],
    }, ensure_ascii=False, indent=1)
    # Write to tmp then rename (atomic) -- a failed import won't leave a
    # truncated candidates.json. Same pattern as Transcript.save.
    tmp = dest.with_suffix(".tmp")
    tmp.write_text(payload, encoding="utf-8")
    tmp.replace(dest)
    return dest
