/* The per-video Import panel store (ui/js/editor/importstore.js): node tests/importstore.test.js */
const assert = require("assert");
const { emptyImport, parkImport, takeImport, patchImport } = require("../ui/js/editor/importstore.js");

let n = 0;
const eq = (got, want, what) => { n++; assert.deepStrictEqual(got, want, `${what}: got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`); };

const store = {};
eq(takeImport(store, "a2"), emptyImport(), "a video that never had a panel shows an empty one");
eq(emptyImport().text, "", "empty box");
eq(emptyImport().lastImport, null, "nothing imported yet");

const st1 = { text: '{"clips":[]}', note: "3 clips", noteError: "false", lastImport: { id: "x", text: "t", orig: [[1, 2]] }, lastImportNotes: ["fixed a comma"] };
parkImport(store, "a1", st1);
eq(takeImport(store, "a2"), emptyImport(), "parking video 1 leaves video 2 empty");
eq(takeImport(store, "a1"), st1, "video 1 gets its own panel back");
st1.text = "changed after parking";
eq(takeImport(store, "a1").text, '{"clips":[]}', "the store holds a copy");
const got = takeImport(store, "a1"); got.text = "edited";
eq(takeImport(store, "a1").text, '{"clips":[]}', "what was taken is a copy too");

parkImport(store, "a2", { text: "two" });
eq(takeImport(store, "a1").text, '{"clips":[]}', "parking video 2 does not touch video 1");
eq(takeImport(store, "a2").note, "", "a partial park fills the rest with defaults");

patchImport(store, "a1", { text: "reply", noteError: "true" });
eq([takeImport(store, "a1").text, takeImport(store, "a1").note, takeImport(store, "a1").noteError], ["reply", "3 clips", "true"], "a patch changes only the named fields");
patchImport(store, "a3", { text: "late reply" });
eq(takeImport(store, "a3").text, "late reply", "a patch can create a panel for a video not on screen");

console.log(`importstore: ${n} checks ok`);
