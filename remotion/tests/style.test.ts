/* The Style Bible v1 (DESIGN.md section 0b): `npm test`. The dictionary registry (every row is complete; every drawn row has its component in its file and
   its tile on the mark sheet; every component that draws a mark is in the registry; the rows still to build have no component); the DESIGN.md section
   and its contents and handover pointer; the checker runs on pilot 1 and reports its flags. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { DICTIONARY, markComponents } from "../src/dictionary.ts";

let n = 0;
const yes = (c: boolean, what: string) => { n++; assert.ok(c, what); };
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (...p: string[]) => readFileSync(path.join(ROOT, ...p), "utf8");

// --- the registry: complete rows, the components exist, the sheet has a tile for each drawn row, the rows to build have no component
for (const r of DICTIONARY) {
  yes(r.id.length > 0 && r.thing.length > 0 && r.mark.length > 0, `the row "${r.id}" has its thing and its mark`);
  if (r.status === "drawn") {
    yes(r.components.length > 0, `the drawn row "${r.id}" names the component that draws it`);
  } else {
    yes(r.status === "to build" && r.components.length === 0, `the row "${r.id}" is to build: a spec only, with no component`);
  }
}
yes(new Set(DICTIONARY.map((r) => r.id)).size === DICTIONARY.length, "every row has a unique id");
for (const want of ["current", "heat", "danger", "water", "vapour", "light", "spark", "force", "air", "sound", "cold"]) {
  yes(DICTIONARY.some((r) => r.id === want), `the dictionary has the "${want}" row (the bible's marks, and spark)`);
}
for (const r of DICTIONARY.filter((k) => k.status === "drawn")) {
  for (const c of r.components) {
    const src = read(c.file);
    yes(new RegExp(`export const ${c.name}\\b|export function ${c.name}\\b`).test(src), `the row "${r.id}": ${c.name} is exported from ${c.file}`);
  }
}
{
  const sheet = read("src", "MarkSheet.tsx");
  for (const r of DICTIONARY.filter((k) => k.status === "drawn")) yes(sheet.includes(`case "${r.id}":`), `the mark sheet has the tile for "${r.id}"`);
  for (const r of DICTIONARY.filter((k) => k.status === "to build")) yes(!sheet.includes(`case "${r.id}":`), `the mark sheet draws nothing for "${r.id}" (to build)`);
}

// --- every component that draws a mark is in the registry (the list of the kit's mark-drawing components, read from their files)
{
  const markLike = ["HeatRise", "SmokePuffs", "Sparks", "IsoVapour", "IsoSun", "IsoSea", "IsoRain", "IsoDroplets", "Arrow", "IsoCutaway", "IsoWallSocket", "IsoSplash", "IsoRunoff"];
  const registered = new Set(markComponents());
  for (const name of markLike) {
    yes(registered.has(name), `the mark-drawing component ${name} is in the dictionary`);
  }
}

// --- the DESIGN.md section: the contents line, the section 0b with the five locks and the rules, the handover pointer to it
{
  const design = read("DESIGN.md");
  yes(design.includes("## 0b. The klipian intip formula (Style Bible v1)"), "DESIGN.md has the section 0b (the Style Bible v1)");
  yes(design.indexOf("## 0b.") < design.indexOf("## 0. How to start"), "section 0b comes before section 0 (the other sections refer to it)");
  yes(/Contents: \[0b\./.test(design), "DESIGN.md's contents line names section 0b");
  for (const lock of ["Diorama stage", "Visual dictionary", "One hero asset", "One beat formula", "checklist"]) yes(design.includes(lock), `section 0b has the lock "${lock}"`);
  yes(/B1[0-9]?\s/.test(design) && design.includes("B6 Detail budget"), "section 0b lists the numbered rules, the detail budget among them");
  const handover = design.slice(design.indexOf("## 12. Before you hand a video back"));
  yes(handover.includes("scripts/styleCheck.mjs") && handover.includes("0b"), "the handover section points to the checker and to section 0b");
}

// --- the checker runs on pilot 1 and prints its summary and the human checklist (its flags are reported, not hidden)
{
  const res = spawnSync(process.execPath, [path.join(ROOT, "scripts", "styleCheck.mjs"), "kenapa-colokan-panas"], { encoding: "utf8" });
  yes(res.stdout.includes("styleCheck: videos/kenapa-colokan-panas") && res.stdout.includes("summary:") && res.stdout.includes("human checklist"), "the checker runs on pilot 1 and prints the summary and the checklist");
  yes(res.status === 0 || res.status === 1, "the checker exits 0 or 1 (1 when it flags something), not an error");
}

console.log(`style: ${n} checks ok`);
