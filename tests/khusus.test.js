/* The panels of a video per kind, and the folder's chip (ui/js/remotion/khusus.js): node tests/khusus.test.js */
const assert = require("assert");
const { panelsFor, panelNumOf, folderChip, FOLDER_STATES } = require("../ui/js/remotion/khusus.js");

let n = 0;
const eq = (got, want, what) => { n++; assert.deepStrictEqual(got, want, `${what}: got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`); };

// Otomatis is unchanged: brief and answer, then the seven panels in order
eq(panelsFor("template").map((p) => p.key), ["brief", "paste", "voice", "story", "facts", "title", "render"], "Otomatis: the panels in order");
eq(panelsFor("template").map((p) => p.num), [1, 2, 3, 4, 5, 6, 7], "Otomatis: numbered 1 to 7");

// Khusus: the folder panel takes the place of brief and answer; no brief and no paste panel; numbered 1 to 6
eq(panelsFor("custom").map((p) => p.key), ["folder", "voice", "story", "facts", "title", "render"], "Khusus: the folder panel first");
eq(panelsFor("custom").map((p) => p.num), [1, 2, 3, 4, 5, 6], "Khusus: numbered 1 to 6");
eq(panelsFor("custom").some((p) => p.key === "brief" || p.key === "paste"), false, "Khusus: no brief and no paste panel");
eq(panelNumOf("custom", "render"), 6, "Khusus: the render panel is number 6");
eq(panelNumOf("template", "render"), 7, "Otomatis: the render panel is number 7");
eq(panelNumOf("custom", "brief"), "", "Khusus: the brief has no number");

// the folder's chip shows its state; an unknown state falls back to belum dipilih
eq(FOLDER_STATES, ["belum dipilih", "cerita belum diambil", "cerita diambil", "folder berubah", "folder tidak lengkap"], "the states");
eq(folderChip("folder berubah"), "folder berubah", "a changed folder shows its chip");
eq(folderChip("nonsense"), "belum dipilih", "an unknown state shows belum dipilih");

console.log(`khusus: ${n} checks ok`);
