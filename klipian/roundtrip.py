"""Manual round-trip through Claude, without an API key.

Workflow:

    klipian brief video.mp4      ->  out/<video>/brief-claude.md
                                     drop into Claude, ask it to work
    (Claude replies with JSON)
    klipian import video.mp4 reply.json
                                 ->  out/<video>/kandidat.json

Why this matters beyond just avoiding costs: you see Claude's reasoning
before anything is rendered, and you can argue with it. API-based tools
hide that step.

Key division of labor:

    Claude   gives APPROXIMATE times in min:sec
    klipian  snaps those times to the nearest word boundary

Claude doesn't need millisecond precision -- that's not its job, and forcing
it only makes the results brittle. The per-word timestamps we already have in
cache handle the final rounding.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass
from pathlib import Path

from .models import Transcript, Word


def fmt_time(seconds: float) -> str:
    t = max(0, int(round(seconds)))  # clamp to 0 to avoid negative values
    return f"{t // 60}:{t % 60:02d}" if t < 3600 else f"{t // 3600}:{(t % 3600) // 60:02d}:{t % 60:02d}"


def seconds(text: str) -> float:
    """Accept 1:07, 01:07, or 1:24:10."""
    parts = [float(x) for x in str(text).strip().split(":")]
    result = 0.0
    for b in parts:
        result = result * 60 + b
    return result


# --------------------------------------------------------------------------
# EXPORT: files dropped into Claude
# --------------------------------------------------------------------------

def build_brief(transcript: Transcript, rubric: Path, video: Path) -> str:
    """A single self-contained file: task, rubric, transcript, and expected
    answer format. The user just drops it in and says "do it" -- no
    additional explanation needed."""

    rubric_text = rubric.read_text(encoding="utf-8") if rubric.exists() else ""
    # strip rubric title so it doesn't clash with the brief title
    rubric_text = re.sub(r"\A# .*?\n+", "", rubric_text)
    # Strip rubric intro paragraph that addresses the USER, not Claude.
    # "Edit this file if the results don't match your taste" is meaningless
    # to whoever is reading this brief.
    rubric_text = re.sub(r"\AIni yang dibaca Claude.*?---\s*\n+", "", rubric_text, flags=re.S)

    lines = []
    for seg in transcript.segments:
        text = seg.text.strip()
        if text:
            lines.append(f"[{fmt_time(seg.start)}] {text}")
    transcript_lines = "\n".join(lines)

    return f"""# Find clips — {video.name}

Hello. Please read the transcript at the bottom of this file and pick moments
worth turning into short vertical videos.

**Source duration:** {fmt_time(transcript.duration)} · **{len(transcript.words)} words**

The times you give don't need to be precise. Approximate min:sec is fine;
klipian will snap the cut points to the nearest word boundary.

---

## Evaluation rubric

{rubric_text}

---

## Answer format

Reply with **a single JSON block** exactly like this, no extra explanation
outside the block. Save as `.json`, then import back into klipian.

```json
{{
  "source": "{video.name}",
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

---

## Transcript

{transcript_lines}
"""


# --------------------------------------------------------------------------
# IMPORT: reading Claude's reply
# --------------------------------------------------------------------------

@dataclass
class Candidate:
    start: float
    end: float
    title: str
    hook: str
    scores: dict
    reason: str

    @property
    def duration(self) -> float:
        return self.end - self.start

    @property
    def total(self) -> float:
        n = []
        for v in self.scores.values():
            try:                       # "9" is counted, "nine" is skipped
                n.append(float(v))
            except (TypeError, ValueError):
                pass
        return round(sum(n) / len(n), 1) if n else 0.0


def extract_json(text: str) -> dict:
    """Claude's replies are often wrapped in code fences or prefixed with
    prose. Grab the largest JSON object found, don't require a clean file."""
    # Look inside code fences first. Use a lazy match ending at the closing
    # fence -- identical to extractJSON() in ui/roundtrip.js. The old greedy
    # version spanned from the first fence to the LAST fence, so replies
    # with two code blocks failed in the CLI but worked in the UI.
    fence = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.S)
    if fence:
        return json.loads(fence.group(1))
    # Fallback: find the largest { ... } (greedy rfind)
    first, end = text.find("{"), text.rfind("}")
    if first == -1 or end <= first:
        raise ValueError("No JSON block found in that file.")
    return json.loads(text[first:end + 1])


# How far a cut point may be shifted to snap to a word boundary. A word
# boundary farther than this means Claude pointed at silence, not at a word
# that was slightly off -- the original number is correct there. Without
# this limit, a 5-second clip in the middle of a long pause once ballooned
# to 79 seconds.
SNAP_MAX = 2.0


def snap_to_word(words: list[Word], moment: float, side: str) -> float:
    """Snap to the nearest word boundary, at most SNAP_MAX seconds away.

    side="start" -> to the START of the word being/will-be spoken
    side="end"   -> to the END of the word that just finished

    This is the part Claude can't do: it doesn't have per-word timestamps.
    We do.
    """
    if not words:
        return moment
    if side == "start":
        candidates = [w.start for w in words]
    else:
        candidates = [w.end for w in words]
    nearest = min(candidates, key=lambda t: abs(t - moment))
    return nearest if abs(nearest - moment) <= SNAP_MAX else moment


def parse_reply(transcript: Transcript, text: str) -> list[Candidate]:
    """English keys are primary; Indonesian keys are still accepted as
    fallback so older Claude replies can still be imported."""
    data = extract_json(text)
    raw = data.get("clips") or data.get("klip") or []
    if not raw:
        raise ValueError('The JSON has no "clips" list.')

    def pick(d, *keys):
        # Take the FIRST key that EXISTS, not the first truthy one: start=0
        # (a number) is valid but falsy, `a or b` would wrongly skip it.
        for key in keys:
            if key in d:
                return d[key]
        return None

    words = transcript.words
    result: list[Candidate] = []
    for k in raw:
        try:
            m = seconds(pick(k, "start", "mulai"))
            s = seconds(pick(k, "end", "selesai"))
        except (TypeError, ValueError):
            continue
        if s <= m:
            continue

        # Checked AGAIN after snapping: the two sides move independently,
        # so a range that was valid may become inverted. If that happens,
        # use Claude's original numbers -- a slight miss is better than a
        # broken candidate that only fails at render time.
        a = round(snap_to_word(words, m, "start"), 3)
        b = round(snap_to_word(words, s, "end"), 3)
        if b <= a:
            a, b = m, s

        result.append(Candidate(
            start=a,
            end=b,
            title=(k.get("title") or k.get("judul") or "Untitled").strip(),
            hook=(k.get("hook") or "").strip(),
            # Explicit check: empty dict {} is valid but falsy, don't use or
            scores=k["scores"] if "scores" in k else (k.get("skor") or {}),
            reason=(k.get("reason") or k.get("alasan") or "").strip(),
        ))

    result.sort(key=lambda x: x.total, reverse=True)
    return result


def save_candidates(candidates: list[Candidate], video: Path, dest: Path) -> Path:
    """The format is intentionally identical to the UI prototype, so it can
    be read directly without translation."""
    dest.parent.mkdir(parents=True, exist_ok=True)
    payload = json.dumps({
        "source": video.name,
        "candidates": [{
            "title": k.title,
            "hook": k.hook,
            "in": fmt_time(k.start),
            "out": fmt_time(k.end),
            "start_sec": k.start,
            "end_sec": k.end,
            "dur": round(k.duration),
            "total": k.total,
            "scores": k.scores,
            "reason": k.reason,
        } for k in candidates],
    }, ensure_ascii=False, indent=1)
    # Write to tmp then rename (atomic) -- a failed import won't leave a
    # truncated candidates.json. Same pattern as Transcript.save.
    tmp = dest.with_suffix(".tmp")
    tmp.write_text(payload, encoding="utf-8")
    tmp.replace(dest)
    return dest
