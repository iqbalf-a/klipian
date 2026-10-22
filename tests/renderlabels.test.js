/* The render rows' words (ui/js/editor/renderlabels.js): node tests/renderlabels.test.js */
const assert = require("assert");
const { layoutLabel, fmtLeft } = require("../ui/js/editor/renderlabels.js");

let n = 0;
const eq = (got, want, what) => { n++; assert.strictEqual(got, want, `${what}: got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`); };

eq(layoutLabel("9:16", "blur", 50), "9:16", "9:16 has no background or position");
eq(layoutLabel("16:9", "blur", 50), "16:9 · blur bg · center", "50 is center");
eq(layoutLabel("16:9", "blur", 0), "16:9 · blur bg · top", "0 is top");
eq(layoutLabel("3:4", "black", 100), "3:4 · black bg · bottom", "100 is bottom, black background");
eq(layoutLabel("16:9", "black", 30), "16:9 · black bg · pos 30%", "other positions");
eq(layoutLabel("16:9", "blur", 29.6), "16:9 · blur bg · pos 30%", "rounded");
eq(layoutLabel("16:9", "blur", undefined), "16:9 · blur bg · center", "no position reads as center");
eq(layoutLabel("16:9", undefined, 50), "16:9 · blur bg · center", "no background reads as blur");

eq(fmtLeft(null), "", "unknown");
eq(fmtLeft(2.9), "", "hidden under 3 s");
eq(fmtLeft(3), "~3 s left", "3 s");
eq(fmtLeft(38), "~38 s left", "seconds");
eq(fmtLeft(89), "~89 s left", "still seconds under 90");
eq(fmtLeft(240), "~4 min left", "minutes");
eq(fmtLeft(3900), "~1 h 05 min left", "hours");

console.log(`renderlabels: ${n} checks ok`);
