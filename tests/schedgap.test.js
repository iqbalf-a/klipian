/* The gap between scheduled clips (ui/js/workspace/schedgap.js): node tests/schedgap.test.js */
const assert = require("assert");
const { gapStepMs, gapSlotsMs } = require("../ui/js/workspace/schedgap.js");

let n = 0;
const eq = (got, want, what) => { n++; assert.deepStrictEqual(got, want, `${what}: got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`); };
// Fixed instants (UTC, so the test does not depend on this computer's timezone): 22 Oct 2026 23:30
const start = Date.UTC(2026, 9, 22, 23, 30);
const at = (ms) => new Date(ms).toISOString().slice(0, 16);

eq(gapStepMs(0, "minute"), 0, "a gap of 0");
eq(gapStepMs(15, "minute"), 900000, "15 minutes");
eq(gapStepMs(2, "hour"), 7200000, "hours");
eq(gapStepMs(1, "day"), 86400000, "days");
eq(gapStepMs(-1, "minute"), null, "negative refused");
eq(gapStepMs(1.5, "hour"), null, "not a whole number refused");
eq(gapStepMs(NaN, "day"), null, "empty refused");
eq(gapStepMs(5, "week"), null, "unknown unit refused");

eq(gapSlotsMs(start, 0, "minute", 3).map(at), ["2026-10-22T23:30", "2026-10-22T23:30", "2026-10-22T23:30"], "gap 0: all the same");
eq(gapSlotsMs(start, 15, "minute", 3).map(at), ["2026-10-22T23:30", "2026-10-22T23:45", "2026-10-23T00:00"], "15 min crosses midnight");
eq(gapSlotsMs(start, 90, "minute", 3).map(at), ["2026-10-22T23:30", "2026-10-23T01:00", "2026-10-23T02:30"], "90 min crosses an hour and a day");
eq(gapSlotsMs(start, 1, "day", 2).map(at), ["2026-10-22T23:30", "2026-10-23T23:30"], "a day");
eq(gapSlotsMs(start, 0.5, "day", 2), null, "an invalid gap gives no slots");

console.log(`schedgap: ${n} checks ok`);
