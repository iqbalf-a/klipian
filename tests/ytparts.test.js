/* "From YouTube, parts only": the ranges to download and the mapping of clips onto the downloaded parts: node tests/ytparts.test.js */
const assert = require("assert");
const { partRanges, mapToParts, remainingRanges, stampShort, minutesOf } = require("../ui/js/editor/ytparts.js");

let n = 0;
const eq = (got, want, what) => { n++; assert.deepStrictEqual(got, want, `${what}: got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`); };
const K = (title, startSec, endSec, more = {}) => ({ title, startSec, endSec, importId: "x", ...more });

// ranges: 20 s of padding both sides, clamped to 0..duration, ranges closer than 5 s joined
eq(partRanges([K("a", 100, 160)], 3600), [[80, 180]], "one clip is padded by 20 s each side");
eq(partRanges([K("a", 5, 60)], 3600), [[0, 80]], "the start is clamped to 0");
eq(partRanges([K("a", 3550, 3590)], 3600), [[3530, 3600]], "the end is clamped to the duration");
eq(partRanges([K("a", 100, 160), K("b", 190, 250)], 3600), [[80, 270]], "padded clips that overlap are one range");
eq(partRanges([K("a", 100, 160), K("b", 203, 260)], 3600), [[80, 280]], "padded ranges 3 s apart are one");
eq(partRanges([K("a", 100, 160), K("b", 206, 260)], 3600), [[80, 180], [186, 280]], "padded ranges 6 s apart stay two");
eq(partRanges([K("a", 100, 160), K("b", 400, 460)], 3600), [[80, 180], [380, 480]], "far clips stay two ranges");
eq(partRanges([K("b", 400, 460), K("a", 100, 160)], 3600), [[80, 180], [380, 480]], "the order of the clips does not matter");
eq(partRanges([], 3600), [], "no clips, nothing to download");
eq(partRanges([K("a", 100, 160)], NaN), [[80, 180]], "an unknown duration clamps nothing");

// mapping YouTube seconds onto a part: t_file = t_youtube - a (a = the REAL start, which may differ from the requested one)
const parts = [{ asset: "a1", a: 80, b: 180 }, { asset: "a2", a: 380, b: 480 }];
let m = mapToParts([K("one", 100, 160), K("two", 400, 460)], parts);
eq(m.mapped.map((k) => [k.asset, k.startSec, k.endSec]), [["a1", 20, 80], ["a2", 20, 80]], "each clip lands in its own part");
eq(m.unmapped, [], "nothing left over");
m = mapToParts([K("one", 100, 160)], [{ asset: "a1", a: 79.2, b: 180 }]);
eq(m.mapped.map((k) => [k.startSec, k.endSec]), [[20.8, 80.8]], "the real start (79.2, not the requested 80) is what is subtracted");
m = mapToParts([K("one", 100, 160, { reason: "r" })], parts);
eq([m.mapped[0].title, m.mapped[0].reason, m.mapped[0].importId], ["one", "r", "x"], "the other fields of a clip are kept");
m = mapToParts([K("out", 170, 200), K("in", 100, 160)], parts);
eq([m.mapped.length, m.unmapped.map((k) => k.title)], [1, ["out"]], "a clip no part holds whole is reported, not dropped");
eq(mapToParts([K("edge", 80, 180)], parts).mapped[0].startSec, 0, "a clip at the very start of a part starts at 0");
eq(mapToParts([K("early", 79.97, 150)], parts).mapped[0].startSec, 0, "a frame before the real start is clamped to 0, not negative");

// what is still to download once some parts exist
eq(remainingRanges([[80, 180], [380, 480]], [{ asset: "a1", a: 79.5, b: 180 }]), [[380, 480]], "a downloaded range is not downloaded again");
eq(remainingRanges([[80, 180], [380, 480]], []), [[80, 180], [380, 480]], "nothing downloaded yet: all of it");
eq(remainingRanges([[80, 180]], [{ asset: "a1", a: 80, b: 180 }]), [], "everything downloaded: nothing remains");

eq([stampShort(754), stampShort(3725), stampShort(5)], ["12:34", "1:02:05", "0:05"], "clock labels");
eq([minutesOf(100), minutesOf(10)], [2, 1], "minutes, at least one");

console.log(`ytparts: ${n} checks ok`);
