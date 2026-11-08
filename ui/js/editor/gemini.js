/* "Ask Gemini" on the Prepare screen (roundtrip.js): the question for YouTube's "Ask about this video", and the
   answer pasted back, kept per video so it survives a change of screen. */

/* Tested by a person: Gemini refuses a question that names clips, TikTok/Shorts, viral or editing, and answers this one.
   Do not reword it. */
// The longest a clip may be, in seconds (roundtrip.py CLIP_MAX_SEC): the question below says it and settleEnd caps at it.
const CLIP_MAX_SEC = 90;

// NOTE for ian: this wording is NEW (it also asks for the LAST sentence and says when the end time is). Try it once on
// YouTube's "Ask about this video"; if Gemini refuses or ignores it, go back to the old text in git (before 2026-11-08).
const GEMINI_PROMPT = `Apa saja 4 bagian paling menarik dari video ini? Tiap bagian berdurasi minimal 30 detik dan maksimal ${CLIP_MAX_SEC} detik. Pastikan tiap bagian membahas satu topik yang utuh dan tidak terpotong; kalau harus dipotong, mulai tepat di awal kalimat dan selesai tepat di akhir kalimat. Cari momen ketika pembicara menyampaikan pendapat yang tegas atau kontroversial, cerita lucu, fakta mengejutkan, pengakuan pribadi, atau tips praktis. Untuk tiap bagian, sebutkan waktu mulai dan selesai, kutip kalimat pertama dan kalimat terakhir yang diucapkan, dan jelaskan dalam satu kalimat kenapa bagian itu menarik. Waktu selesai adalah saat kalimat terakhir topik itu selesai diucapkan; kalau kalimat berikutnya masih membahas hal yang sama, ikutkan. Urutkan dari yang paling menarik.`;

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
const RANGE_PAD_AFTER_PARTS = 35;   // parts only: the end may be moved on to the end of its topic (up to ~30 s)
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
function clipRanges(spans, duration, padAfter = RANGE_PAD) {
  const end = Number.isFinite(duration) && duration > 0 ? duration : Infinity;
  return mergeRanges(spans.map(([a, b]) => [Math.max(0, a - RANGE_PAD), Math.min(end, b + padAfter)]), RANGE_GAP);
}

const rangesSeconds = (ranges) => ranges.reduce((n, [a, b]) => n + (b - a), 0);

/* The ticked moments of Choose moments (`ticked`: indexes into `candidates`): their [start, end] spans, and the list
   without them. Indexes that match nothing are ignored. */
function momentSpans(candidates, ticked) {
  return [...new Set(ticked)].sort((a, b) => a - b).map((i) => candidates[i])
    .filter((k) => k && Number.isFinite(k.startSec) && Number.isFinite(k.endSec)).map((k) => [k.startSec, k.endSec]);
}

function withoutMoments(candidates, ticked) {
  const gone = new Set(ticked);
  return candidates.filter((_, i) => !gone.has(i));
}

/* Where a clip should end so its topic is not cut short: { end, why } (why is "" when it did not move). The twin of
   settle_end in klipian/roundtrip.py: same steps, keep them the same. words [{text,start,end}], segments [{start,end}]. */
const settleTokens = (s) => (String(s || "").toLowerCase().match(/[\p{L}\p{N}]+/gu) || []);
const settleStamp = (t) => { const n = Math.round(t); return `${Math.floor(n / 60)}:${String(n % 60).padStart(2, "0")}`; };

function settleEnd(words, segments, start, end, endQuote = "", maxSec = CLIP_MAX_SEC, snapMax = 2.0) {
  const snapWord = (t) => {
    if (!words?.length) return t;
    const near = words.map((w) => w.end).reduce((a, b) => (Math.abs(b - t) < Math.abs(a - t) ? b : a));
    return Math.abs(near - t) <= snapMax ? near : t;
  };
  const base = snapWord(end);
  const segs = (segments || []).filter((s) => s.end > s.start);
  if (!Number.isFinite(end) || !((words || []).length || segs.length)) return { end: base, why: "" };
  const lo = end - snapMax;
  let target = null, how = "";
  const q = settleTokens(endQuote);
  if (q.length && words?.length) {
    const toks = words.map((w) => settleTokens(w.text));
    let best = null;
    words.forEach((w, j) => {
      if (Math.abs(w.end - end) > 30) return;
      const flat = toks.slice(Math.max(0, j - q.length * 2), j + 1).filter((t) => t.length).flat().slice(-q.length);
      if (flat.length < q.length) return;
      const same = flat.filter((x, i) => x === q[i]).length / q.length;
      if (same >= 0.7 && flat[flat.length - 1] === q[q.length - 1] && (best === null || Math.abs(w.end - end) < Math.abs(words[best].end - end))) best = j;
    });
    if (best !== null) { target = words[best].end; how = "the end of the sentence quoted as its last"; }
  }
  if (target === null && segs.length) {
    const inside = segs.find((s) => s.start <= end && end < s.end);
    if (inside) target = inside.end;
    else { const before = segs.filter((s) => s.end <= end).map((s) => s.end); target = before.length ? Math.max(...before) : null; }
    how = "the end of the sentence";
  }
  if (target === null || target < lo) return { end: base, why: "" };
  if (target - start > maxSec) {
    const fits = segs.map((s) => s.end).filter((e) => e >= lo && e <= start + maxSec);
    if (!fits.length) return { end: base, why: "" };
    target = Math.max(...fits);
    how = `the last sentence end within ${maxSec} s`;
  }
  if (Math.abs(target - end) < 0.5) return { end: target, why: "" };
  return { end: target, why: `${target > end ? "extended" : "moved"} ${settleStamp(end)} → ${settleStamp(target)} to ${how}` };
}

if (typeof module !== "undefined" && module.exports) module.exports = { CLIP_MAX_SEC, settleEnd, RANGE_PAD_AFTER_PARTS, GEMINI_PROMPT, geminiKey, loadGeminiText, saveGeminiText, mergeRanges, subtractRanges, clipRanges, rangesSeconds, momentSpans, withoutMoments };
