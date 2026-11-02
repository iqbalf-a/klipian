/* The intro label of Intro & notes (ui/js/editor/angleintro.js): node tests/angleintro.test.js */
const assert = require("assert");
const { withAngleIntro, ANGLE_INTRO_SECONDS } = require("../ui/js/editor/angleintro.js");

let n = 0;
const eq = (got, want, what) => { n++; assert.deepStrictEqual(got, want, `${what}: got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`); };
let seq = 0;
const id = () => `o${++seq}`;

// no label yet: one is added with the shape of the panel's Add button
let out = withAngleIntro([], "Satu keputusan", 30, 4, id);
eq(out.length, 1, "one label added");
eq([out[0].origin, out[0].text, out[0].start, out[0].end, out[0].x, out[0].y, out[0].size, out[0].box, out[0].kind],
  ["angle-intro", "Satu keputusan", 0, 4, 50, 16, 72, true, "text"], "the new label");
eq(withAngleIntro([], "x", 30, ANGLE_INTRO_SECONDS, id)[0].end, 2.5, "the default length");

// seconds longer than the Result are cut at its end
eq(withAngleIntro([], "x", 3, 10, id)[0].end, 3, "cut at total");

// an existing intro label: text and end change, place, size and colour do not
const moved = { id: "o9", kind: "text", text: "lama", start: 0, end: 2.5, x: 20, y: 70, size: 40, color: "#FFD600", box: true, origin: "angle-intro" };
out = withAngleIntro([moved], "baru", 30, 4, id);
eq(out, [{ ...moved, text: "baru", end: 4 }], "existing label updated, place kept");
eq(moved.text, "lama", "the input list is not mutated");

// an empty intro or no length changes nothing
const list = [moved];
eq(withAngleIntro(list, "  ", 30, 4, id) === list, true, "empty intro");
eq(withAngleIntro(list, "x", 0, 4, id) === list, true, "no length");

// labels without that origin are not touched
const other = { id: "o3", kind: "text", text: "tangan", start: 1, end: 5, origin: "angle-note-0" };
out = withAngleIntro([other], "x", 30, 4, id);
eq([out[0], out.length], [other, 2], "another label stays, the intro is added beside it");

console.log(`angleintro: ${n} checks ok`);
