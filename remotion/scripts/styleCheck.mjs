// node scripts/styleCheck.mjs <slug>          (e.g. node scripts/styleCheck.mjs kenapa-colokan-panas)
//
// The Style Bible v1 checker (DESIGN.md section 0b). It checks by machine what can be read from a video's story, its source files and the
// dictionary (src/dictionary.ts): the beat formula, the stings and reactions, the outro, the screen text, the sources, the stage, the marks a video
// draws, the duration. What needs a render (the hero's share of the width, the loop's first and last frames, the detail budget) is listed as "render"
// and checked by the tests or by scripts/detailBudget.mjs. The human checklist is printed at the end. Each line starts with PASS, FLAG (a rule the video
// breaks: fix it or name the exception in the report), INFO, RENDER (needs a render) or HUMAN (ian's eye). Exit code 1 if anything is FLAG.
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DICTIONARY, markComponents } from "../src/dictionary.ts";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const slug = process.argv[2];
if (!slug) { console.error("usage: node scripts/styleCheck.mjs <slug>"); process.exit(2); }
const dir = path.join(ROOT, "videos", slug);
const storyFile = path.join(dir, "story.json");
if (!existsSync(storyFile)) { console.error(`no story at videos/${slug}/story.json`); process.exit(2); }
const story = JSON.parse(readFileSync(storyFile, "utf8"));

const out = [];
const add = (level, what) => out.push({ level, what });
const words = (s) => (s || "").trim().split(/\s+/).filter(Boolean).length;
const beats = story.beats ?? [];
const kinds = beats.map((b) => b.kind);
const itemsOf = (b) => b.scene?.items ?? [];

// 1. the duration: one of the three lengths, and the beats add up to it exactly
const total = beats.reduce((a, b) => a + b.dur, 0);
add(new Set([30, 45, 60]).has(story.duration) ? "PASS" : "FLAG", `duration ${story.duration} s is 30, 45 or 60 s`);
add(total === story.duration ? "PASS" : "FLAG", `the beats add up to ${total} s, the duration is ${story.duration} s`);

// 2. the beat formula: hook first, sting second (if there is one), outro last; the kinds are known
add(kinds[0] === "hook" ? "PASS" : "FLAG", `the first beat is a hook (it is "${kinds[0]}")`);
add(kinds[1] === "sting" ? "PASS" : "INFO", `the second beat is the sting (${kinds[1] === "sting" ? "it is" : `it is "${kinds[1]}"`})`);
add(kinds.at(-1) === "outro" ? "PASS" : "FLAG", `the last beat is the outro (it is "${kinds.at(-1)}")`);
const known = new Set(["hook", "sting", "lens", "normal", "loose", "result", "tips", "outro"]);
const unknown = kinds.filter((k) => !known.has(k));
add(unknown.length === 0 ? "PASS" : "FLAG", `every beat kind is one of the formula's kinds (${unknown.length ? `unknown: ${unknown.join(", ")}` : "all known"})`);
const explainKinds = kinds.filter((k) => ["lens", "normal", "loose"].includes(k));
add(explainKinds.length >= 2 && explainKinds.length <= 4 ? "PASS" : "FLAG", `the explain beats (lens, normal, loose) are two to four (${explainKinds.length})`);
add(kinds.includes("result") ? "PASS" : "FLAG", "a result beat says what the fact causes, with its source card");
add(kinds.includes("tips") || kinds.includes("result") ? "PASS" : "FLAG", "a tip or a result follows the explain beats");

// 3. the sting: at most one mascot sting
const stings = kinds.filter((k) => k === "sting").length;
add(stings <= 1 ? "PASS" : "FLAG", `at most one sting (${stings})`);

// 4. the mascot: at most two reactions outside the sting and the outro
const reactions = beats.filter((b) => !["sting", "outro"].includes(b.kind)).reduce((a, b) => a + itemsOf(b).filter((i) => i.type === "mascot").length, 0);
add(reactions <= 2 ? "PASS" : "FLAG", `at most two mascot reactions between the sting and the outro (${reactions})`);

// 5. the outro: no mascot and no text (the bible's rule); the loop-back has no voice
const outro = beats.at(-1) ?? {};
const outroMascot = itemsOf(outro).some((i) => i.type === "mascot");
const outroText = itemsOf(outro).filter((i) => ["label", "pill", "banner"].includes(i.type)).map((i) => i.text);
add(!outroMascot ? "PASS" : "FLAG", `the outro has no mascot (${outroMascot ? "it has one: the bible's rule says none; see the report" : "none"})`);
add(outroText.length === 0 ? "PASS" : "FLAG", `the outro has no text (${outroText.length ? `it has: ${outroText.join(" / ")}` : "none"})`);
add(!outro.narration || outro.narration.trim() === "" ? "PASS" : "INFO", "the outro has no voice (the loop-back)");
add("RENDER", "the first and last frames match (the loop test in tests/videos.test.ts or the loop check of the render)");

// 6. the screen text: at most six words on screen at once, each text from the story (the text of a beat or its labels)
const screenTexts = beats.flatMap((b) => [b.text, ...itemsOf(b).filter((i) => ["banner", "label", "pill", "badge"].includes(i.type)).map((i) => i.text)]).filter(Boolean);
const longText = screenTexts.filter((t) => words(t) > 6);
add(longText.length === 0 ? "PASS" : "FLAG", `every screen text is at most six words (${longText.length ? `too long: ${longText.join(" | ")}` : "all within six"})`);

// 7. the sources: every claim has a source; a source card names a real claim
const claims = story.claims ?? [];
const unsourced = claims.filter((c) => !c.sources || c.sources.length === 0);
add(claims.length > 0 && unsourced.length === 0 ? "PASS" : "FLAG", `every claim has at least one source (${claims.length} claims, ${unsourced.length} without)`);
const cards = beats.flatMap((b) => itemsOf(b).filter((i) => i.type === "source"));
add(cards.every((c) => Number.isInteger(c.claim) && c.claim >= 1 && c.claim <= claims.length) ? "PASS" : "FLAG", "every source card shows one of the story's claims");

// 8. the stage: the hook sits on the Brand background with its spot, and the video draws an isometric part
const hookBg = beats[0]?.scene?.bg;
add(hookBg === "brand" ? "PASS" : "FLAG", `the stage: the hook is on the brand background (it is "${hookBg}")`);
const sources = readdirSync(dir).filter((f) => /\.(ts|tsx)$/.test(f)).map((f) => readFileSync(path.join(dir, f), "utf8")).join("\n");
const isoParts = /Iso(WallSocket|Cutaway|Block|Plug|Sea|Land|Trees|Cloud)/.test(sources);
add(isoParts ? "PASS" : "FLAG", "the video draws its object in the isometric kit (a stage block)");
add("RENDER", "the hero is 60 to 70 % of the screen width at the main shot (measure it on the still)");

// 9. the marks: the components this video draws that are marks must be in the dictionary; a private mark is a FLAG
const registered = new Set(markComponents());
const markLike = ["HeatRise", "SmokePuffs", "Sparks", "IsoVapour", "IsoSun", "IsoSea", "IsoRain", "IsoDroplets", "Arrow", "IsoCutaway", "IsoWallSocket", "IsoSplash", "IsoRunoff"];
const used = markLike.filter((n) => new RegExp(`<${n}[\\s/>]`).test(sources));
const unregistered = used.filter((n) => !registered.has(n));
add(unregistered.length === 0 ? "PASS" : "FLAG", `every mark the video draws is in the dictionary (${used.length} used${unregistered.length ? `; missing rows: ${unregistered.join(", ")}` : ""})`);
const drawnMarks = DICTIONARY.filter((r) => r.status === "drawn").map((r) => r.id);
add("INFO", `marks in the video: ${used.map((n) => { const row = DICTIONARY.find((r) => r.components.some((c) => c.name === n)); return row ? `${row.id} (${n})` : `${n} (no row)`; }).join(", ") || "none"}; dictionary drawn rows: ${drawnMarks.join(", ")}`);

// 10. the new assets: at most three (a human count; the registry is the library)
add("HUMAN", "at most three new assets for this video (one hero, two supporting); say which were reused");

// 11. the myth check: a verdict stamp (only for a "Benarkah ...?" or "Mitos" question)
const myth = /^(benarkah|mitos)/i.test(story.question ?? "");
const hasVerdict = beats.some((b) => itemsOf(b).some((i) => i.type === "stamp" || i.type === "verdict"));
add(myth ? (hasVerdict ? "PASS" : "FLAG") : "INFO", myth ? "the myth check ends with a verdict stamp" : "not a myth check: no verdict stamp needed");

// 12. the detail budget: the hero reaches 80 % of the colokan's shapes and parts (scripts/detailBudget.mjs writes out/detail/budget.json)
add("RENDER", "the hero reaches 80 % of the colokan's shapes and parts (run scripts/detailBudget.mjs; the table is in the report)");

// the report
const pad = (s) => s.padEnd(6);
console.log(`styleCheck: videos/${slug} (Style Bible v1)`);
for (const r of out) console.log(`${pad(r.level)} ${r.what}`);
const count = (l) => out.filter((r) => r.level === l).length;
console.log(`\nsummary: ${count("PASS")} pass, ${count("FLAG")} flag, ${count("INFO")} info, ${count("RENDER")} need a render, ${count("HUMAN")} for a human`);
console.log(`\nhuman checklist (ian's quality bar, DESIGN.md section 10, and the bible's locks):
  [ ] one stage block on the brand background, the iso camera, the lens move the same way as in pilot 1
  [ ] one hero asset at the detail budget; supporting assets simple and flat; at most three new assets
  [ ] every mark drawn with its dictionary recipe; no private mark
  [ ] tone rule, flat tones, meaning colours; the nature colours only for nature
  [ ] two text layers, at most six words on screen; the sources and fact check for each claim
  [ ] the mascot is small, at most two reactions, none in the outro (if the bible's rule holds)
  [ ] the loop-back ending; a sound on each movement, at most three at once
  [ ] the in-between states checked as strips; the highlight lives on its object
  [ ] does it look like the same channel as pilot 1?`);
process.exit(count("FLAG") > 0 ? 1 : 0);
