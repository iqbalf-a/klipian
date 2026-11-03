/* "Ask Gemini" on the Prepare screen (roundtrip.js): the question for YouTube's "Ask about this video", and the
   answer pasted back, kept per video so it survives a change of screen. */

/* Tested by a person: Gemini refuses a question that names clips, TikTok/Shorts, viral or editing, and answers this one.
   Do not reword it. */
const GEMINI_PROMPT = "Apa saja 8 bagian paling menarik dari video ini? Cari momen ketika pembicara menyampaikan pendapat yang tegas atau kontroversial, cerita lucu, fakta mengejutkan, pengakuan pribadi, atau tips praktis. Untuk tiap bagian, sebutkan waktu mulai dan selesai, kutip kalimat pertama yang diucapkan, dan jelaskan dalam satu kalimat kenapa bagian itu menarik. Urutkan dari yang paling menarik.";

const geminiKey = (profile, video) => `klipian:gemini:${profile}:${video}`;

function loadGeminiText(storage, profile, video) {
  try { return storage.getItem(geminiKey(profile, video)) || ""; } catch { return ""; }
}

function saveGeminiText(storage, profile, video, text) {
  try {
    if (text) storage.setItem(geminiKey(profile, video), text);
    else storage.removeItem(geminiKey(profile, video));
  } catch { /* no storage: the text is just not kept */ }
}

/* ---------- which parts of the video to transcribe for the imported clips ---------- */

const RANGE_PAD = 20;         // seconds of audio before and after a clip
const RANGE_GAP = 5;          // ranges closer than this are one

/* [[start, end]] sorted, ranges that overlap or lie closer than `gap` seconds joined (klipian/models.py merge_ranges). */
function mergeRanges(ranges, gap = 0) {
  const out = [];
  for (const [a, b] of [...ranges].filter(([x, y]) => y > x).sort((p, q) => p[0] - q[0])) {
    if (out.length && a - out[out.length - 1][1] <= gap) out[out.length - 1][1] = Math.max(out[out.length - 1][1], b);
    else out.push([a, b]);
  }
  return out;
}

/* The parts of `wanted` that `covered` does not cover (klipian/models.py subtract_ranges). */
function subtractRanges(wanted, covered) {
  const out = [];
  const cov = mergeRanges(covered || []);
  for (const [a, b] of mergeRanges(wanted)) {
    let at = a;
    for (const [c, d] of cov) {
      if (d <= at || c >= b) continue;
      if (c > at) out.push([at, c]);
      at = Math.max(at, d);
      if (at >= b) break;
    }
    if (at < b) out.push([at, b]);
  }
  return out;
}

/* What to transcribe for clips [[start, end]]: each padded by RANGE_PAD both sides, kept inside 0..duration (when
   it is known), and joined when they overlap or lie closer than RANGE_GAP. */
function clipRanges(spans, duration) {
  const end = Number.isFinite(duration) && duration > 0 ? duration : Infinity;
  return mergeRanges(spans.map(([a, b]) => [Math.max(0, a - RANGE_PAD), Math.min(end, b + RANGE_PAD)]), RANGE_GAP);
}

const rangesSeconds = (ranges) => ranges.reduce((n, [a, b]) => n + (b - a), 0);

if (typeof module !== "undefined" && module.exports) module.exports = { GEMINI_PROMPT, geminiKey, loadGeminiText, saveGeminiText, mergeRanges, subtractRanges, clipRanges, rangesSeconds };
