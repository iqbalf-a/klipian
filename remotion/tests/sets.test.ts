/* The set registry (src/sets.ts, DESIGN.md B27.15 and B27.16): `node tests/sets.test.ts`. Every row is complete; an owner is a real video; the signature
   components exist; a video that draws another video's set is caught, its own set is not; the rules are written where the sessions read them. */
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SETS, borrowedSets, freeSets, ownSet, setsDrawn } from "../src/sets.ts";

let n = 0;
const yes = (c: boolean, what: string) => { n++; assert.ok(c, what); };
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (...p: string[]) => readFileSync(path.join(ROOT, ...p), "utf8");
const components = readdirSync(path.join(ROOT, "src", "components")).map((f) => read("src", "components", f)).join("\n");

yes(new Set(SETS.map((s) => s.id)).size === SETS.length, "every set has a unique id");
for (const s of SETS) {
  yes(s.id.length > 0 && s.name.length > 0 && s.fits.length > 0 && s.recipe.length > 0, `the set "${s.id}" is complete`);
  if (s.owner !== null) {
    yes(existsSync(path.join(ROOT, "videos", s.owner, "story.json")), `the set "${s.id}" is owned by a real video (${s.owner})`);
    yes(s.status === "drawn", `the set "${s.id}" has an owner, so it is drawn`);
  } else {
    yes(s.status === "to build", `the set "${s.id}" is free, so it is a recipe only`);
  }
  for (const c of s.signature) yes(new RegExp(`export const ${c}\\b`).test(components), `the set "${s.id}": ${c} is an exported component`);
}
yes(freeSets().length >= 5, "at least five free set kinds, so a new video always has a different place to choose");
yes(freeSets().some((s) => s.id === "sky-horizon"), "the sky-and-horizon kind (rainbow, light, air) is free");

// the check: the rain video's diorama is the rain video's; another video that draws it is caught
const diorama = "<IsoSea /><IsoLand /><IsoHill /><IsoHills /><IsoFields /><IsoTrees /><IsoBushes /><IsoRocks />";
yes(setsDrawn(diorama).some((d) => d.set.id === "nature-landscape"), "the nature diorama is recognised from its components");
yes(borrowedSets(diorama, "cara-kerja-hujan-buatan").length === 0, "the owner may draw its own set");
yes(borrowedSets(diorama, "pelangi-sebenarnya-berbentuk-l").length === 1, "a rainbow video that draws the rain video's set is caught");
yes(borrowedSets(diorama, "satu-awan-beratnya-ratusan-ton").length === 1, "a cloud video that draws the rain video's set is caught");
yes(borrowedSets("<IsoFarHills /><IsoSun /><IsoCloud />", "pelangi-x").length === 0, "a sky with far hills, a sun and a cloud (single pieces) is not the diorama");
yes(borrowedSets("<IsoLand /><IsoHill />", "x").length === 0, "two loose pieces do not make the set (fewer than four)");

// every existing video draws only its own set; every existing video's set is registered
for (const slug of readdirSync(path.join(ROOT, "videos"))) {
  if (/^selftest/.test(slug)) continue;
  const src = readdirSync(path.join(ROOT, "videos", slug)).filter((f) => /\.tsx?$/.test(f)).map((f) => read("videos", slug, f)).join("\n");
  yes(borrowedSets(src, slug).length === 0, `${slug} draws no other video's set`);
  yes(!!ownSet(slug), `${slug} has its set registered in src/sets.ts`);
}

// the rules are written where the sessions read them
const design = read("DESIGN.md"), brief = readFileSync(path.join(ROOT, "..", "klipian", "motion_brief.py"), "utf8"), skill = readFileSync(path.join(ROOT, "..", ".claude", "skills", "create", "SKILL.md"), "utf8");
yes(/15\. \*\*Own set per video\*\*/.test(design) && /16\. \*\*A shape with a real form/.test(design), "DESIGN.md has B27.15 and B27.16");
yes(design.includes("src/sets.ts"), "DESIGN.md points to src/sets.ts");
yes(brief.includes("remotion/src/sets.ts") && brief.includes("B27.16"), "the brief's hard rules name sets.ts and B27.16");
yes(/git merge --no-edit origin\/main/.test(skill) && skill.includes("sets.ts"), "the create skill refreshes the stock branch with main and names sets.ts");
yes(/id: "rainbow"/.test(read("src", "dictionary.ts")), "the dictionary has a rainbow row (a ring, not a half-arc)");

console.log(`sets.test: ${n} checks passed`);
