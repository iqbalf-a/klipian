/* The pure parts of ui/js/shared/notify.js: node tests/notify.test.js */
const assert = require("assert");
const { TitleSwap, OnceGuard, CHIME_NOTES, NOTIFY_VOLUMES } = require("../ui/js/shared/notify.js");

let n = 0;
const eq = (got, want, what) => { n++; assert.deepStrictEqual(got, want, `${what}: got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`); };

// the title while the tab is hidden
const t = new TitleSwap();
eq(t.restore(), null, "nothing marked, nothing to restore");
eq(t.mark("Render history · klipian", "success"), "✓ Done · klipian", "success marker");
eq(t.mark("✓ Done · klipian", "failure"), "⚠ Failed · klipian", "a second event changes the marker but keeps the real title");
eq(t.restore(), "Render history · klipian", "the first real title comes back");
eq(t.restore(), null, "restored once");

// once per job
const g = new OnceGuard(3);
eq([g.first("a"), g.first("a"), g.first("b")], [true, false, true], "the same job key chimes once");
eq([g.first(undefined), g.first(undefined), g.first("")], [true, true, true], "no key, no guard");
g.first("c"); g.first("d");                              // "a" falls out of the 3 kept
eq(g.first("a"), true, "the oldest keys are forgotten");

// the chime: success rises in about 0.4 s, failure is one lower note; never loud
const s = CHIME_NOTES.success, f = CHIME_NOTES.failure;
eq(s.length, 2, "two notes");
eq(s[1][0] > s[0][0], true, "rising");
const end = Math.max(...s.map(([, start, len]) => start + len));
eq(end >= 0.35 && end <= 0.45, true, "about 0.4 s");
eq(f.length === 1 && f[0][0] < s[0][0], true, "one lower note");
eq(NOTIFY_VOLUMES[0], 0, "Off");
eq(NOTIFY_VOLUMES[2], 0.25, "Medium is -12 dB");
eq(Math.max(...NOTIFY_VOLUMES) <= 0.5, true, "never louder than -6 dB");

console.log(`notify: ${n} checks ok`);
