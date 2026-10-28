/* The Style Bible v1 (DESIGN.md section 0b): `npm test`. The dictionary registry (every row is complete; every drawn row has its component in its file and
   its tile on the mark sheet; every component that draws a mark is in the registry; the rows still to build have no component); the DESIGN.md section
   and its contents and handover pointer; the checker runs on pilot 1 and reports its flags. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { DICTIONARY, markComponents } from "../src/dictionary.ts";
import { bibleWarnings, validateStory } from "../src/schema.ts";
import * as LANG from "../src/motionLanguage.ts";
import { soundSet } from "../scripts/soundHash.mjs";

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

// --- the outro is read from what the video draws (B12): pilot 1's outro has no mascot and no text; a fake video that draws a Mascot in its outro must FLAG
{
  const pilot = spawnSync(process.execPath, [path.join(ROOT, "scripts", "styleCheck.mjs"), "kenapa-colokan-panas"], { encoding: "utf8" });
  yes(pilot.stdout.includes("PASS   no mascot is drawn in the outro"), "pilot 1: no mascot is drawn in its outro (the plan's timing)");
  yes(pilot.stdout.includes("PASS   no text is on screen in the outro"), "pilot 1: no text is on screen in its outro");
  yes(pilot.stdout.includes("INFO   the video declares the loop-back"), "pilot 1 declares the loop-back (its plan has a loopWeight)");
  const fixture = path.join(ROOT, "out", "style-fixture", "outro-mascot");
  mkdirSync(fixture, { recursive: true });
  writeFileSync(path.join(fixture, "story.json"), readFileSync(path.join(ROOT, "videos", "kenapa-colokan-panas", "story.json"), "utf8"));
  // the fake plan: the reaction runs in the outro (from 43 s, the outro starts at 41 s), and the video code draws the mascot for it
  writeFileSync(path.join(fixture, "plan.ts"), `export function makePlan(story: { beats: { id: string; kind: string; dur: number }[] }) {
  const total = story.beats.reduce((a, b) => a + b.dur, 0);
  const m = { sting: 3, stingEnd: 4, react: 43, outro: 41, end: total };
  return { m, total, loopWeight: (t: number) => Math.min(1, Math.max(0, t - m.outro)), tops: [], labels: [] };
}
`);
  writeFileSync(path.join(fixture, "index.tsx"), "export const Fake = () => <g><Mascot x={1} y={1} /><Mascot x={2} y={2} /></g>;\n");
  const fake = spawnSync(process.execPath, [path.join(ROOT, "scripts", "styleCheck.mjs"), fixture], { encoding: "utf8" });
  yes(fake.stdout.includes("FLAG   no mascot is drawn in the outro"), "a fake video that draws a Mascot in its outro FLAGs the outro");
  yes(fake.status === 1, "the checker exits 1 when a flag is raised");
}

// --- round 2 (Style Bible v1, DESIGN.md B15 and B16): the bible warnings, the motion language, the sound set, the checker's musts, the scaffold
{
  const pilot = validateStory(JSON.parse(readFileSync(path.join(ROOT, "videos", "kenapa-colokan-panas", "story.json"), "utf8")));
  yes(pilot.ok, "pilot 1's story is valid (its bible warnings are not errors)");
  if (pilot.ok) {
    const w = bibleWarnings(pilot.story).map((x) => x.message);
    yes(w.length === 4, `pilot 1 gets its four bible warnings (${w.length})`);
    yes(w.some((m) => m.includes("220 px")) && w.some((m) => m.includes("no mascot, label or pill")) && w.some((m) => m.includes("narration must be empty")) && w.some((m) => m.includes("source card in a result")), "pilot 1's warnings say the sting's size, the outro's mascot and voice, and the source card");
    const strict = validateStory({ ...JSON.parse(readFileSync(path.join(ROOT, "videos", "kenapa-colokan-panas", "story.json"), "utf8")), bible: 1 });
    yes(!strict.ok && strict.errors.some((e) => e.includes("loop-back")), "a story with bible: 1 gets the bible rules as errors (pilot 1 is refused as it is)");
  }
  const tpl = validateStory(JSON.parse(readFileSync(path.join(ROOT, "templates", "video", "story.json"), "utf8")));
  yes(tpl.ok && bibleWarnings(tpl.story).length === 0 && tpl.story.bible === 1, "the scaffold's story follows the musts with no warning and carries bible: 1");
  const shifted = JSON.parse(readFileSync(path.join(ROOT, "templates", "video", "story.json"), "utf8"));
  shifted.beats[1].text = "Lihat ini";
  shifted.beats[1].narration = "Lihat ini";
  delete shifted.bible;                                                  // without the marker the musts are warnings, not errors
  const sv = validateStory(shifted);
  yes(sv.ok && bibleWarnings(sv.story).some((x) => x.message.includes("Intip yuk!")), "a story without the \"Intip yuk!\" sting gets the must 1 warning");
}

// the motion language is the one of src/motion.ts: the same springs, the same easings, the same ambient periods
{
  const motion = readFileSync(path.join(ROOT, "src", "motion.ts"), "utf8");
  yes(motion.includes("damping: 12, stiffness: 150, mass: 0.8") && motion.includes("damping: 20, stiffness: 120, mass: 0.9"), "the registry's springs are the springs of src/motion.ts");
  yes(motion.includes("Easing.out(Easing.cubic)") && motion.includes("Easing.inOut(Easing.cubic)") && motion.includes("Easing.out(Easing.back(1.4))") && motion.includes("Easing.inOut(Easing.quad)"), "the registry's easings are the easings of src/motion.ts");
  yes(Object.keys(LANG.EASINGS).length === 4 && Object.keys(LANG.SPRINGS).length === 2, "the registry lists four easings and two springs");
  yes(LANG.RANGES.cameraPush[0] <= 5 && LANG.RANGES.cameraPush[1] >= 7, "the push range covers pilot 1's pushes (5 to 7 s)");
  yes(LANG.STYLE_EXCEPTIONS.every((e) => e.reason.length > 20), "every colour exception has its reason");
}

// the approved sound set (B15): the record matches the set; the checker reports it
{
  const record = JSON.parse(readFileSync(path.join(ROOT, "scripts", "soundHash.json"), "utf8"));
  yes(record.hash === soundSet().hash, "the approved sound set is the recorded one (B15)");
  const check = spawnSync(process.execPath, [path.join(ROOT, "scripts", "styleCheck.mjs"), "kenapa-colokan-panas"], { encoding: "utf8" });
  yes(check.stdout.includes("PASS   B15: the approved sound set is unchanged"), "the checker passes the sound set on pilot 1");
}

// the musts (B16) and the checker: pilot 1 FAILs only on its outro's voice (its story keeps the narration: ian's edit), never on the sting or the loop
{
  const check = spawnSync(process.execPath, [path.join(ROOT, "scripts", "styleCheck.mjs"), "kenapa-colokan-panas"], { encoding: "utf8" });
  const fails = check.stdout.split("\n").filter((l) => l.startsWith("FAIL"));
  yes(fails.length === 1 && fails[0].includes("the outro has no voice"), `pilot 1's only FAIL is its outro's voice (${fails.length} fails)`);
  yes(check.stdout.includes("PASS   must 1: the \"Intip yuk!\" sting") && check.stdout.includes("PASS   must 3 (a)") && check.stdout.includes("PASS   must 3 (b)"), "pilot 1 passes must 1 (the sting), and must 3 (colours, easings and springs)");
}

// the rule log, the bible's musts and the motion language are in DESIGN.md; the report and the scaffold are in the package
{
  const design = read("DESIGN.md");
  for (const h of ["### The three musts (B16)", "### The motion language", "### The rule log", "B15 Sound", "B16 Musts"]) yes(design.includes(h), `DESIGN.md has "${h}"`);
  const pkg = JSON.parse(read("package.json"));
  yes(typeof pkg.scripts["style-report"] === "string" && typeof pkg.scripts["style-check"] === "string", "npm run style-report and style-check exist");
  yes(existsSync(path.join(ROOT, "scripts", "styleReport.mjs")) && existsSync(path.join(ROOT, "templates", "video", "plan.ts")) && existsSync(path.join(ROOT, "templates", "video-test.tpl")), "the report, the plan skeleton and the test skeleton are in place");
}

console.log(`style: ${n} checks ok`);
