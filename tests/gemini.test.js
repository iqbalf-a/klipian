/* Ask Gemini's prompt and the per-video answer (ui/js/editor/gemini.js): node tests/gemini.test.js */
const assert = require("assert");
const { GEMINI_PROMPT, geminiKey, loadGeminiText, saveGeminiText } = require("../ui/js/editor/gemini.js");

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

console.log(`gemini: ${n} checks ok`);
