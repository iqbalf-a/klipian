/* The set registry (src/sets.ts, DESIGN.md B27.15 and B27.16): `node tests/sets.test.ts`. Every row is complete; an owner is a real video; the signature
   components exist; a video that draws another video's set is caught, its own set is not; the rules are written where the sessions read them. */
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SETS, borrowedSets, declaredKind, freeSets, setsDrawn } from "../src/sets.ts";
import { loadSetOwners } from "../scripts/setOwners.mjs";

let n = 0;
const yes = (c: boolean, what: string) => { n++; assert.ok(c, what); };
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (...p: string[]) => readFileSync(path.join(ROOT, ...p), "utf8");
const components = readdirSync(path.join(ROOT, "src", "components")).map((f) => read("src", "components", f)).join("\n");

yes(new Set(SETS.map((s) => s.id)).size === SETS.length, "every set kind has a unique id");
for (const s of SETS) {
  yes(s.id.length > 0 && s.name.length > 0 && s.fits.length > 0 && s.recipe.length > 0, `the kind "${s.id}" is complete`);
  yes(!("owner" in s), `the kind "${s.id}" names no owner: owners live in videos/<slug>/set.json, never in this shared file`);
  for (const c of s.signature) yes(new RegExp(`export const ${c}\\b`).test(components), `the kind "${s.id}": ${c} is an exported component`);
}
const { owners, kinds, problems } = loadSetOwners(path.join(ROOT, "videos"));
yes(problems.length === 0, `every set.json is valid (${problems.join("; ")})`);
yes(freeSets({}, SETS).length >= 5, "at least five free set kinds, so a new video always has a different place to choose");
yes(SETS.some((s) => s.id === "sky-horizon"), "the sky-and-horizon kind (rainbow, light, air) exists");
for (const [kind, slugs] of Object.entries(owners)) yes(slugs.length === 1, `the kind "${kind}" is used by one video (${slugs.join(", ")})`);
yes(owners["nature-landscape"]?.[0] === "cara-kerja-hujan-buatan", "the nature diorama belongs to the rain video");

// the check: the rain video's diorama is the rain video's; another video that draws it is caught
const diorama = "<IsoSea /><IsoLand /><IsoHill /><IsoHills /><IsoFields /><IsoTrees /><IsoBushes /><IsoRocks />";
yes(setsDrawn(diorama).some((d) => d.set.id === "nature-landscape"), "the nature diorama is recognised from its components");
yes(borrowedSets(diorama, "cara-kerja-hujan-buatan", owners, kinds).length === 0, "the owner may draw its own set");
yes(borrowedSets(diorama, "pelangi-x", owners, kinds).length === 1, "a rainbow video that draws the rain video's set is caught");
yes(borrowedSets(diorama, "satu-awan-x", owners, kinds).length === 1, "a cloud video that draws the rain video's set is caught");
yes(borrowedSets("<IsoFarHills /><IsoSun /><IsoCloud />", "pelangi-x", owners, kinds).length === 0, "a sky with far hills, a sun and a cloud (single pieces) is not the diorama");
yes(borrowedSets("<IsoLand /><IsoHill />", "x", owners, kinds).length === 0, "two loose pieces do not make the set (fewer than four)");
yes(declaredKind("pelangi-x", { "sky-horizon": ["pelangi-x"] }).kind === "sky-horizon", "a video's declared kind is found");
yes(declaredKind("awan-x", { "sky-horizon": ["pelangi-x", "awan-x"] }).sharedWith.join() === "pelangi-x", "two videos that declare the same kind are caught");
yes(freeSets({ "sky-horizon": ["a"] }, SETS).every((k) => k.id !== "sky-horizon"), "a declared kind is no longer free");

// the loader on a scratch folder: a new kind needs name and fits
{
  const tmp = mkdtempSync(path.join(tmpdir(), "sets-"));
  mkdirSync(path.join(tmp, "a")); writeFileSync(path.join(tmp, "a", "set.json"), JSON.stringify({ kind: "sky-horizon" }));
  mkdirSync(path.join(tmp, "b")); writeFileSync(path.join(tmp, "b", "set.json"), JSON.stringify({ kind: "kitchen-sink" }));
  mkdirSync(path.join(tmp, "c")); writeFileSync(path.join(tmp, "c", "set.json"), JSON.stringify({ kind: "kitchen-sink", name: "a kitchen sink", fits: "washing up" }));
  const r = loadSetOwners(tmp);
  yes(r.owners["sky-horizon"]?.join() === "a" && r.owners["kitchen-sink"]?.join() === "c", "the loader reads set.json files; a new kind without name and fits is a problem");
  yes(r.problems.length === 1 && r.problems[0].startsWith("b/"), "the incomplete new kind is reported");
  rmSync(tmp, { recursive: true });
}

// every existing video draws only its own set and declares its set
for (const slug of readdirSync(path.join(ROOT, "videos"))) {
  if (/^selftest/.test(slug)) continue;
  const src = readdirSync(path.join(ROOT, "videos", slug)).filter((f) => /\.tsx?$/.test(f)).map((f) => read("videos", slug, f)).join("\n");
  yes(borrowedSets(src, slug, owners, kinds).length === 0, `${slug} draws no other video's set`);
  yes(declaredKind(slug, owners).kind !== null, `${slug} declares its set in videos/${slug}/set.json`);
}

// the rules are written where the sessions read them
const design = read("DESIGN.md"), brief = readFileSync(path.join(ROOT, "..", "klipian", "motion_brief.py"), "utf8"), skill = readFileSync(path.join(ROOT, "..", ".claude", "skills", "create", "SKILL.md"), "utf8");
yes(/15\. \*\*Own set per video\*\*/.test(design) && /16\. \*\*A shape with a real form/.test(design), "DESIGN.md has B27.15 and B27.16");
yes(design.includes("src/sets.ts"), "DESIGN.md points to src/sets.ts");
yes(brief.includes("remotion/src/sets.ts") && brief.includes("set.json") && brief.includes("B27.16"), "the brief's hard rules name sets.ts and B27.16");
yes(skill.includes("origin/main") && skill.includes("GIT_INDEX_FILE") && skill.includes("set.json"), "the create skill builds on main, pushes only the video's files to the stock branch and names set.json");
yes(/id: "rainbow"/.test(read("src", "dictionary.ts")), "the dictionary has a rainbow row (a ring, not a half-arc)");

console.log(`sets.test: ${n} checks passed`);
