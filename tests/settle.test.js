/* Where a clip ends (settleEnd, ui/js/editor/gemini.js): the same cases as check_settle in klipian/selftest.py: node tests/settle.test.js */
const assert = require("assert");
const { settleEnd, CLIP_MAX_SEC, GEMINI_PROMPT } = require("../ui/js/editor/gemini.js");

let n = 0;
const eq = (got, want, what) => { n++; assert.deepStrictEqual(got, want, `${what}: got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`); };

// 12 sentences of 9 one-second words: sentence i is [10 i, 10 i + 9]
const words = [], segs = [];
for (let i = 0; i < 12; i++) {
  for (let k = 0; k < 9; k++) words.push({ text: `w${i}_${k}.`, start: 10 * i + k, end: 10 * i + k + 1 });
  segs.push({ start: 10 * i, end: 10 * i + 9 });
}
const at = (end, quote = "", start = 0, max = CLIP_MAX_SEC) => settleEnd(words, segs, start, end, quote, max);
const q2 = "w2_0 w2_1 w2_2 w2_3 w2_4 w2_5 w2_6 w2_7 w2_8";

let r = at(14);
eq([r.end, r.why.startsWith("extended 0:14 → 0:19")], [19, true], "an end in the middle of a sentence moves to its end");
r = at(14, q2);
eq([r.end, r.why.includes("quoted")], [29, true], "an endQuote 15 s further on extends the end to its last word");
eq(at(14, "zzz w2_1 w2_2 w2_3 w2_4 w2_5 w2_6 w2_7 w2_8").end, 29, "a quote with most words in place is found");
eq(at(14, "nothing like it at all").end, 19, "a quote that is not found: the end of the sentence");
eq(at(14, "w9_0 w9_1 w9_2 w9_3 w9_4 w9_5 w9_6 w9_7 w9_8").end, 19, "a quote more than 30 s away is not looked for");
r = at(19.2);
eq([r.end, r.why], [19, ""], "an end just inside the gap goes back to the sentence end quietly");
const gap = [{ start: 0, end: 9.5 }, { start: 13, end: 22 }];
eq(settleEnd([], gap, 0, 12.5, ""), { end: 12.5, why: "" }, "never pulled back by more than SNAP_MAX");
eq(settleEnd([], gap, 0, 11, "").end, 9.5, "an end in a gap goes to the sentence before, within SNAP_MAX");
r = settleEnd(words, segs, 0, 80.5, "", 85);
eq([r.end, r.why.includes("within 85")], [79, true], "past the longest clip: the last sentence end that fits");
eq(settleEnd(words, segs, 0, 50, "", 30).end, 49, "an already too long clip is not shortened by more than SNAP_MAX (word snap)");
eq(settleEnd(words, null, 0, 14.4, "").end, 14, "without segments: the word snap");
eq(settleEnd([], [], 0, 14.4, ""), { end: 14.4, why: "" }, "without words or segments: untouched");

// the question names the longest clip from the one constant, and still names nothing Gemini refuses
eq(CLIP_MAX_SEC, 180, "the longest clip");
eq(GEMINI_PROMPT.includes(`paling lama ${CLIP_MAX_SEC} detik`), true, "the prompt says the longest clip");
eq(GEMINI_PROMPT.includes("kalimat pertama dan kalimat terakhir"), true, "the prompt asks for the last sentence too");
eq(GEMINI_PROMPT.includes("kalau kalimat berikutnya masih membahas hal yang sama, ikutkan"), true, "the prompt says to include a continuing sentence");

console.log(`settle: ${n} checks ok`);
