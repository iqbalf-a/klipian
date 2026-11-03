/* Ask Gemini's prompt and the per-video answer (ui/js/editor/gemini.js): node tests/gemini.test.js */
const assert = require("assert");
const { GEMINI_PROMPT, geminiKey, loadGeminiText, saveGeminiText, mergeRanges, subtractRanges, clipRanges, rangesSeconds } = require("../ui/js/editor/gemini.js");

let n = 0;
const eq = (got, want, what) => { n++; assert.deepStrictEqual(got, want, `${what}: got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`); };
const store = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), m }; };

// the prompt that was tried out stays word for word, and names nothing Gemini refuses
eq(GEMINI_PROMPT.startsWith("Apa saja 8 bagian paling menarik dari video ini?"), true, "prompt start");
eq(GEMINI_PROMPT.endsWith("Urutkan dari yang paling menarik."), true, "prompt end");
eq(/klip|clip|tiktok|shorts|viral|edit/i.test(GEMINI_PROMPT), false, "no word Gemini refuses");

// kept per profile and per video
const s = store();
eq(geminiKey("podcast", "a.mp4"), "klipian:gemini:podcast:a.mp4", "key");
saveGeminiText(s, "podcast", "a.mp4", "1. Satu (0:10 - 0:40)");
saveGeminiText(s, "podcast", "b.mp4", "dua");
eq(loadGeminiText(s, "podcast", "a.mp4"), "1. Satu (0:10 - 0:40)", "a.mp4");
eq(loadGeminiText(s, "podcast", "b.mp4"), "dua", "b.mp4 apart");
eq(loadGeminiText(s, "komedi", "a.mp4"), "", "another profile apart");
saveGeminiText(s, "podcast", "a.mp4", "");
eq(s.m.has(geminiKey("podcast", "a.mp4")), false, "empty text removes the entry");

// storage that throws (private window, blocked): no crash, nothing kept
const bad = { getItem() { throw new Error("blocked"); }, setItem() { throw new Error("blocked"); }, removeItem() { throw new Error("blocked"); } };
saveGeminiText(bad, "p", "v", "x");
eq(loadGeminiText(bad, "p", "v"), "", "blocked storage reads empty");

// the ranges to transcribe: padding 20 s, kept inside the video, joined when overlapping or less than 5 s apart
eq(clipRanges([[30, 60]], 600), [[10, 80]], "one clip padded");
eq(clipRanges([[5, 30]], 600), [[0, 50]], "clamped at the start");
eq(clipRanges([[580, 595]], 600), [[560, 600]], "clamped at the end");
eq(clipRanges([[100, 120], [150, 170]], 600), [[80, 190]], "overlapping after padding: one");
eq(clipRanges([[100, 120], [170, 190]], 600), [[80, 140], [150, 210]], "10 s apart: two");
eq(clipRanges([[100, 120], [165, 190]], 600), [[80, 210]], "closer than 5 s: one");
eq(clipRanges([[100, 120]], undefined), [[80, 140]], "unknown duration: no upper limit");
eq(rangesSeconds([[80, 140], [150, 210]]), 120, "seconds in total");
eq(mergeRanges([[5, 10], [0, 3], [9, 12]]), [[0, 3], [5, 12]], "merge sorts and joins overlaps");
eq(subtractRanges([[0, 100]], [[10, 20], [50, 60]]), [[0, 10], [20, 50], [60, 100]], "uncovered parts");
eq(subtractRanges([[10, 20]], [[0, 100]]), [], "fully covered");
eq(subtractRanges([[10, 20]], null), [[10, 20]], "nothing covered");

console.log(`gemini: ${n} checks ok`);
