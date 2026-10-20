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

from . import credits as credits_mod
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


def _hashtag_block(rule: str) -> str:
    return f"\n**Hashtags for this profile:** {rule}\n" if rule else ""


def build_brief(transcript: Transcript, rubric: str, name: str,
                cues_data: dict | None = None, credit: dict | None = None,
                hashtag_rule: str = "") -> str:
    """A single self-contained file: task, rubric, transcript, and expected
    answer format. The user just drops it in and says "do it" -- no
    additional explanation needed.

    `rubric` is the rubric's text (read_rubric), `name` the video's file name,
    `cues_data` what cues.load returned for the video (None: not run), `credit`
    the video's credit (credits.py) -- named at the top when there is one.
    `hashtag_rule` is the profile's rule for where hashtags go, in numbers
    (hashtags.brief_rule); left out when empty."""
    # strip rubric title so it doesn't clash with the brief title
    rubric = re.sub(r"\A# [^\n\r  ]*\n+", "", rubric, count=1)
    # Strip the rubric's intro paragraph, which addresses the USER, not Claude.
    # "Edit this file if the results don't match your taste" is meaningless
    # to whoever is reading this brief.
    rubric = re.sub(r"\AIni yang dibaca Claude.*?---\s*\n+", "", rubric, count=1, flags=re.S)

    row = "\n".join(f"[{fmt_stamp(s.start)}] {_trim(s.text)}"
                    for s in transcript.segments if _trim(s.text))

    # Who made the video, so Claude knows the creator and the guest, and the
    # rule that goes with it: the credit line under a post is built by klipian
    # from what the person entered, so nothing in it is invented.
    source = credits_mod.brief_source(credit)
    source_block = (
        f"\n\n**Source:** {source}\n\n"
        "klipian adds the source credit to each post by itself, from what its user "
        "entered. Do not write a credit or source line, a link or a channel handle "
        "of your own."
    ) if source else ""

    return f"""# Find clips — {name}

Hello. Please read the transcript at the bottom of this file and pick moments
worth turning into short vertical videos.

**Source duration:** {fmt_stamp(transcript.duration)} · **{len(transcript.words)} words**{source_block}

The times you give don't need to be precise. Approximate min:sec is fine;
klipian will snap the cut points to the nearest word boundary.

---

## Evaluation rubric

{rubric}

---

## Answer format

Reply with **a single JSON block** exactly like this, no extra explanation
outside the block. Plain JSON only: no code, function calls, expressions, variables
or comments; every value is finished text or a number.

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
      "reason": "one or two sentences for a human to read",
      "post": {{
        "title": "Rugi 300 Juta Gara-gara Salah Timing",
        "caption": "Satu keputusan di waktu yang salah bisa mahal banget. Kamu pernah ngalamin juga?",
        "hashtags": ["#bisnis", "#podcast", "#belajarbisnis", "#kegagalan", "#motivasi"],
        "youtubeTitle": "Rugi 300 Juta Gara-gara Salah Timing #bisnis #podcast #belajarbisnis"
      }},
      "angle": {{
        "take": "Keputusan yang kelihatan kecil bisa jadi yang paling mahal.",
        "intro": "Satu keputusan ini bikin rugi 300 juta",
        "notes": [{{ "at": "0:14", "text": "Perhatikan nadanya di sini" }}]
      }}
    }}
  ]
}}
```

`post` is the text for uploading the clip, written by you for each clip: `title`
(up to 70 characters), `caption` (1–3 sentences, no hashtags in it) and
`hashtags` (5–8, as a list). Also give `youtubeTitle`: the final title exactly as it
will appear on YouTube, as an example of the finished form (klipian composes the final
title itself from `title` and `hashtags`, so this is only a check on your side). Leave
`post` out if the rubric above does not ask for it.
{_hashtag_block(hashtag_rule)}
`angle` is a suggested point of view on the clip, for the person who cuts it to edit
and make their own: `take` (one sentence), `intro` (an opening line, at most 12
words) and `notes` (0–3 short comments of at most 8 words, each with `at`, the
time inside the clip counted from its start, as min:sec). Leave it out if the
rubric above does not ask for it.
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


def _hashtags(v) -> list[str]:
    """The tags of a post as a list of "#tag": from a list or from one string
    ("bisnis, #podcast lucu"). Each loses anything that is not a letter, digit
    or underscore and gets one leading #; empty ones and repeats (ignoring case)
    go."""
    if isinstance(v, str):
        items = re.split(r"[\s,]+", v)
    elif isinstance(v, list):
        items = [x for x in v if isinstance(x, str)]
    else:
        return []
    out, seen = [], set()
    for item in items:
        tag = re.sub(r"[^\w]", "", item)
        if tag and tag.lower() not in seen:
            seen.add(tag.lower())
            out.append("#" + tag)
    return out


def _post(v) -> dict | None:
    """The upload text Claude wrote for a clip -- optional, and read gently: a
    field that is not text counts as empty, because a clip is not worth
    refusing over its caption. None when there is nothing usable in it."""
    if not isinstance(v, dict):
        return None
    text = lambda x: _trim(x) if isinstance(x, str) else ""      # noqa: E731
    post = {"title": text(v.get("title")), "caption": text(v.get("caption")),
            "hashtags": _hashtags(v.get("hashtags"))}
    if not (post["title"] or post["caption"] or post["hashtags"]):
        return None
    # The final title Claude wrote as an example. klipian does not trust it: it composes the
    # final title itself (hashtags.plan) and only keeps this one for a person to compare.
    yt = text(v.get("youtubeTitle"))
    if yt:
        post["youtubeTitle"] = yt
    return post


# Limits the rubric asks for, applied here so a long reply can't flood the UI.
_ANGLE_NOTES = 3


def _angle(v, duration: float) -> dict | None:
    """The point of view Claude suggested for a clip -- optional, read gently like
    `post`: text is trimmed, a field that is not text counts as empty, `notes`
    must be a list of objects with usable text and a time (`at`, read like any
    other time, counted from the START OF THE CLIP and held inside it). At most
    three, earliest first. None when there is nothing usable."""
    if not isinstance(v, dict):
        return None
    text = lambda x: _trim(x) if isinstance(x, str) else ""      # noqa: E731
    notes = []
    for n in (v.get("notes") if isinstance(v.get("notes"), list) else []):
        if not isinstance(n, dict) or not text(n.get("text")):
            continue
        at = _to_seconds(_nullish(n.get("at", _UNDEFINED), None))
        if not _finite(at):
            continue
        notes.append({"at": round(max(0.0, min(float(duration), at)), 2), "text": text(n.get("text"))})
    notes = sorted(notes[:_ANGLE_NOTES], key=lambda n: n["at"])
    angle = {"take": text(v.get("take")), "intro": text(v.get("intro")), "notes": notes}
    return angle if (angle["take"] or angle["intro"] or notes) else None


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


_CODE_CALL = re.compile(r"^\.\s*[A-Za-z_$][\w$]*\s*\(")
_BARE = re.compile(r"^[A-Za-z_$][\w$]*")
_REPLACE_CALL = re.compile(r"""^\.replace\(\s*(?:" "|' ')\s*,\s*(?:""|'')\s*\)""")
_CURLY = "“”‘’"


def _repair(s: str) -> tuple[str, list[str]]:
    """Fix the two slips that are safe to fix, nothing else and never by running anything:
    `"text".replace(" ", "")` (the text with its spaces removed) and a trailing comma before ] or }.
    The text is read as JSON strings and what lies between them, so what is inside a string is
    never touched by the comma rule. Returns (text, what was fixed)."""
    out: list[str] = []
    done: list[str] = []
    i, n = 0, len(s)
    while i < n:
        ch = s[i]
        if ch == '"':
            j = i + 1
            while j < n and s[j] != '"':
                j += 2 if s[j] == "\\" else 1
            lit = s[i:j + 1]
            m = _REPLACE_CALL.match(s[j + 1:]) if j < n else None
            if m:
                lit = lit.replace(" ", "")
                j += m.end()
                if "replace" not in done:
                    done.append("replace")
            out.append(lit)
            i = j + 1
        elif ch == ",":
            k = i + 1
            while k < n and s[k] in " \t\r\n":
                k += 1
            if k < n and s[k] in "]}":
                if "comma" not in done:
                    done.append("comma")
            else:
                out.append(ch)
            i += 1
        else:
            out.append(ch)
            i += 1
    words = {"replace": 'a text followed by .replace(" ", "") became the text with its spaces removed',
             "comma": "a comma before a closing bracket was removed"}
    return "".join(out), [words[x] for x in done]


def _hint(s: str, pos: int) -> str:
    """What is most likely wrong at `pos` of a JSON block that would not parse, in words for the
    person who pasted it (the common slips of an AI reply). The text is only looked at, never run."""
    rest = s[pos:]
    line_start = s.rfind("\n", 0, pos) + 1
    line_end = s.find("\n", pos)
    line = s[line_start:line_end if line_end != -1 else len(s)]
    before = s[:pos].rstrip()
    if rest.startswith(("//", "/*")):
        return "A comment (// or /* */) in the JSON: remove it. JSON has no comments."
    if rest[:1] in "“”" or (any(c in line for c in "“”") and rest[:1] not in "'"):
        return 'Curly quotes (“ ”) used as JSON quotes: use plain straight double quotes (") around text and keys.'
    if _CODE_CALL.match(rest) or rest.startswith("+"):
        return ('Code inside the JSON (e.g. .replace(...), or texts joined with +): replace it with the '
                'finished text, e.g. "#beladiri".')
    if rest.startswith("'") or (rest[:1] in "‘’"):
        return "Single quotes (') around text or keys: JSON needs plain double quotes (\")."
    if (before.endswith(",") and rest[:1] in "]}") or re.match(r",\s*[\]}]", rest):
        return "A trailing comma before a closing ] or }: remove the last comma."
    m = _BARE.match(rest)
    if m:
        word = m.group(0)
        after = rest[m.end():].lstrip()
        if after.startswith(":"):
            return f'The key {word} has no quotes: write it as "{word}".'
        if word in ("True", "False", "None", "undefined", "NaN", "Infinity"):
            return f"{word} is not JSON: use true, false, null, a number or text in double quotes."
        if after.startswith("("):
            return (f"Code inside the JSON (a call such as {word}(...)): replace it with the "
                    "finished text or number.")
        return (f"The bare word {word} where JSON needs text or a number: put finished text in double "
                "quotes. No variables or code.")
    return "Check the commas, quotes and brackets near here."


def _where(s: str, exc: json.JSONDecodeError) -> str:
    """`line 12, column 9:` and about 40 characters around it with a caret under the spot."""
    lines = s.split("\n")
    lineno = min(max(exc.lineno, 1), len(lines))
    text = lines[lineno - 1].rstrip("\r")
    col = min(max(exc.colno, 1), len(text) + 1)
    start = max(0, col - 21)
    seg = text[start:col + 19]
    lead = "…" if start else ""
    caret = " " * (len(lead) + col - 1 - start) + "^"
    return f"line {lineno}, column {col}:\n    {lead}{seg}\n    {caret}"


def _parse_json(s: str, notes: list[str] | None = None):
    def refuse(name):
        raise ValueError(name)
    try:
        return json.loads(s, parse_constant=refuse)
    except json.JSONDecodeError as exc:
        # The commonest slips of an AI reply: a text with .replace(" ", "") after it, and a trailing
        # comma. Those two are fixed (by reading the text, never by running it) and the person is told.
        fixed, done = _repair(s)
        if done:
            try:
                value = json.loads(fixed, parse_constant=refuse)
            except ValueError:
                pass
            else:
                if notes is not None:
                    notes.extend(done)
                return value
        raise ValueError(
            f"The JSON block is broken at {_where(s, exc)}\n{_hint(s, exc.pos)}\n"
            "Fix that spot, or copy Claude's reply again from the start to the end of the block.") from None
    except ValueError:
        # json.loads accepts NaN/Infinity, JSON.parse doesn't; both end up here.
        raise ValueError("The JSON block is there, but its content is broken — copy "
                         "Claude's reply again from the start to the end of the block.") from None


def extract_json(text: str, notes: list[str] | None = None) -> dict:
    """Claude's replies are often wrapped in code fences or prefixed with
    prose. Look inside a code fence first, else take everything from the
    first { to the last }; don't require a clean file. `notes` collects what
    was repaired (see _repair)."""
    fence = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.S)
    if fence:
        return _parse_json(fence.group(1), notes)
    first, last = text.find("{"), text.rfind("}")
    if first == -1 or last <= first:
        raise ValueError("No JSON block found in that text.")
    return _parse_json(text[first:last + 1], notes)


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
    """Claude's reply -> clip candidates; see parse_reply_notes."""
    return parse_reply_notes(words, text, cues)[0]


def parse_reply_notes(words: list[Word], text: str, cues: list[dict] | None = None) -> tuple[list[dict], list[str]]:
    """(candidates, what was repaired in the JSON on the way: see _repair, as sentences).

    Claude's reply -> clip candidates, in the shape the editor uses (the
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
    notes: list[str] = []
    data = extract_json(text, notes)
    raw = _or(data.get("clips", _UNDEFINED), data.get("klip", _UNDEFINED), [])
    if not isinstance(raw, list) or ("clips" not in data and "klip" not in data):
        raise ValueError('JSON does not have a "clips" list.')
    if not raw:
        # The list is there, just empty: say so, it is not the same mistake as
        # a reply with no list at all.
        raise ValueError('The "clips" list is empty, so there is nothing to import. '
                         "Ask Claude again, or check that you copied the whole reply.")

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
        post = _post(g("post"))
        angle = _angle(g("angle"), s - m)
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
            # The text for uploading the clip (title, caption, hashtags), when
            # Claude wrote any; absent otherwise, so a candidate from an older
            # reply reads exactly as it did.
            **({"post": post} if post else {}),
            # A suggested point of view (take, intro, notes), likewise.
            **({"angle": angle} if angle else {}),
            "spans": [{"start": m, "end": s}],     # one whole piece until split
            **({"cues": for_range(cues, m, s)} if cues is not None else {}),
        })

    if not result:
        raise ValueError("All clips have zero or negative duration.")
    return result, notes


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
            **({"post": k["post"]} if "post" in k else {}),
            **({"angle": k["angle"]} if "angle" in k else {}),
            **({"cues": k["cues"]} if "cues" in k else {}),
        } for k in candidates],
    }, ensure_ascii=False, indent=1)
    # Write to tmp then rename (atomic) -- a failed import won't leave a
    # truncated candidates.json. Same pattern as Transcript.save.
    tmp = dest.with_suffix(".tmp")
    tmp.write_text(payload, encoding="utf-8")
    tmp.replace(dest)
    return dest
