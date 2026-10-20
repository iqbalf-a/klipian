/* klipian — when each caption word is on screen (shared by the editor's preview; the same rules as
   caption_plan() in klipian/render.py, which burns the captions in -- selftest check `captions` runs
   both on one word list and requires the same numbers)
   ==========================================================================
   1. Lines break at pauses: a new line starts when the gap between two consecutive words is above
      PAUSE_SPLIT, after a word that ends in . ? !, and after a word ending in a comma when the line
      already has two words or more. `perLine` is a MAXIMUM: a line may have one word.
   2. No text during silence: a word's window runs from its own start to the start of the next word
      (same line or next line) when that gap is at most HOLD_GAP, so short gaps do not flicker;
      otherwise it ends TAIL after its own end. The last word: its end + TAIL.
   3. Reveal: "spoken" (default) shows only the words that have started, the rest of the line stays
      laid out but invisible (nothing shifts); "line" shows the whole line from the first word.
   4. The highlighted word is the one whose window it is.
   ========================================================================== */

const CAPTION_PAUSE_SPLIT = 0.35;
const CAPTION_HOLD_GAP = 0.25;
const CAPTION_TAIL = 0.15;

function captionEndsWith(text, re) {
  return re.test(String(text).replace(/["'\u201d\u2019)\]}]+$/, ""));
}

/* used = [{a, b, text}] in output order -> [{ words: [...], windows: [[start, end], ...] }] */
function captionPlan(used, perLine) {
  perLine = Math.max(1, Math.trunc(Number(perLine)) || 1);
  const lines = [];
  let cur = [];
  for (const w of used) {
    if (cur.length && (cur.length >= perLine || w.a - cur[cur.length - 1].b > CAPTION_PAUSE_SPLIT)) {
      lines.push(cur);
      cur = [];
    }
    cur.push(w);
    if (captionEndsWith(w.text, /[.?!]$/) || (cur.length >= 2 && captionEndsWith(w.text, /,$/))) {
      lines.push(cur);
      cur = [];
    }
  }
  if (cur.length) lines.push(cur);
  const flat = lines.flat();
  const plan = [];
  let n = 0;
  for (const words of lines) {
    const windows = words.map((w, j) => {
      const nxt = flat[n + j + 1];
      const end = nxt && nxt.a - w.b <= CAPTION_HOLD_GAP ? nxt.a : w.b + CAPTION_TAIL;
      return [w.a, end];
    });
    n += words.length;
    plan.push({ words, windows });
  }
  return plan;
}

/* What is on screen at output time `t`: { words, shown, highlight } or null. `shown` = how many words
   of the line are visible (the rest are laid out but hidden). */
function captionAt(used, perLine, reveal, t) {
  for (const line of captionPlan(used, perLine)) {
    for (let j = 0; j < line.words.length; j++) {
      const [s, e] = line.windows[j];
      if (e > s && t >= s && t < e) {
        return { words: line.words, shown: reveal === "line" ? line.words.length : j + 1, highlight: j };
      }
    }
  }
  return null;
}

if (typeof module !== "undefined") module.exports = { captionPlan, captionAt, CAPTION_PAUSE_SPLIT, CAPTION_HOLD_GAP, CAPTION_TAIL };
