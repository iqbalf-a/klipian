// node scripts/styleCheck.mjs <slug|folder>   (e.g. node scripts/styleCheck.mjs kenapa-colokan-panas)
//
// The Style Bible v1 checker (DESIGN.md section 0b). It checks by machine what can be read from a video's story, its source files and the
// dictionary (src/dictionary.ts): the beat formula, the stings and reactions, the outro, the screen text, the sources, the stage, the marks a video
// draws, the duration. What needs a render (the hero's share of the width, the loop's first and last frames, the detail budget) is listed as "render"
// and checked by the tests or by scripts/detailBudget.mjs. The human checklist is printed at the end. Each line starts with PASS, FLAG (a rule the video
// breaks: fix it or name the exception in the report), FAIL (one of the three musts of B16 is broken: the "Intip yuk!" sting, the loop-back
// ending, the consistent object style and animation; it is never a flag), INFO, RENDER (needs a render) or HUMAN (ian's eye).
// Exit code 1 if anything is FLAG or FAIL. The motion language and the colour rule are in src/motionLanguage.ts.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { pathToFileURL } from "node:url";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DICTIONARY, markComponents } from "../src/dictionary.ts";
import { borrowedSets, declaredKind, freeSets } from "../src/sets.ts";
import { loadSetOwners } from "./setOwners.mjs";
import { checkImports } from "./importCheck.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const slug = process.argv[2];
if (!slug) { console.error("usage: node scripts/styleCheck.mjs <slug>"); process.exit(2); }
const dir = path.isAbsolute(slug) ? slug : path.join(ROOT, "videos", slug);
const storyFile = path.join(dir, "story.json");
if (!existsSync(storyFile)) { console.error(`no story at videos/${slug}/story.json`); process.exit(2); }
const story = JSON.parse(readFileSync(storyFile, "utf8"));

const out = [];
const add = (level, what) => out.push({ level, what });
const words = (s) => (s || "").trim().split(/\s+/).filter(Boolean).length;
const beats = story.beats ?? [];
const kinds = beats.map((b) => b.kind);
const itemsOf = (b) => b.scene?.items ?? [];

// B48 (ian, 2026-11-23): no asset reused in the short term. B42 widened from objects to every asset: backdrop, set, hook hero, supporting object, prop, effect, sound effect,
// music track, caption/colour set, icon, texture, font treatment. The 10 most recent videos (the date of the commit that first added each index.tsx; a video not committed yet
// counts by the file's time) are read for what the machine can read: the set kind, the music track, the effects drawn, the sound names, the theme and the stage. The rest
// (icon, texture, font treatment, hero and props) stays with the HUMAN line. `node scripts/styleCheck.mjs <slug> --b48` prints only this, before the video is drawn.
// The fixed channel pieces (the spoken "Intip yuk!", the looping ending) and the approved mix (B15) are the exceptions and are not looked at here.
const FX_NAMES = ["HeatRise", "SmokePuffs", "Sparks", "Motes", "HeatWaves", "Smoke", "Smoke3D", "PlugHeat", "CollarHeat", "Onomatopoeia", "LoopArrows", "Strike", "Crackle", "SmokeRing", "Debris", "CloudHole", "Segs", "shake"];
async function b48() {
  const { execFileSync } = await import("node:child_process");
  const { statSync } = await import("node:fs");
  const { SFX, MUSIC_NAMES, SFX_NAMES } = await import("../src/catalog.ts");
  // ian, 2026-11-23: the rule first, the catalog follows; the music and sound-name lines only bind once the catalog is big enough (30 beds and 100 sounds)
  const MIN_BEDS = 30, MIN_SFX = 100, enforced = MUSIC_NAMES.length >= MIN_BEDS && SFX_NAMES.length >= MIN_SFX;
  const soft = enforced ? "FLAG" : "INFO", note = enforced ? "" : ` (catalog too small, not enforced yet: ${MUSIC_NAMES.length} beds of ${MIN_BEDS}, ${SFX_NAMES.length} sounds of ${MIN_SFX})`;
  const mine = path.basename(dir), vroot = path.join(ROOT, "videos");
  const when = (name) => {
    const idx = path.join(vroot, name, "index.tsx");
    try {
      const o = execFileSync("git", ["log", "--diff-filter=A", "--format=%ct", "--", `remotion/videos/${name}/index.tsx`], { cwd: path.join(ROOT, ".."), encoding: "utf8" }).trim().split("\n").filter(Boolean).pop();
      if (o) return Number(o);
    } catch { /* not a repository: fall back to the file time */ }
    return Math.floor(statSync(idx).mtimeMs / 1000);
  };
  const recent = readdirSync(vroot, { withFileTypes: true }).filter((d) => d.isDirectory() && d.name !== mine && d.name !== "selftest-tiny" && existsSync(path.join(vroot, d.name, "index.tsx")))
    .map((d) => ({ name: d.name, t: when(d.name) })).sort((a, b) => b.t - a.t).slice(0, 10);
  const profile = (d) => {
    const read = (f) => (existsSync(path.join(d, f)) ? readFileSync(path.join(d, f), "utf8") : "");
    const src = readdirSync(d).filter((f) => /\.(ts|tsx)$/.test(f)).map(read).join("\n");
    const sfxSrc = read("sfx.ts"), st = existsSync(path.join(d, "story.json")) ? JSON.parse(read("story.json")) : {};
    let set = ""; try { set = JSON.parse(read("set.json")).kind ?? ""; } catch { /* no set.json */ }
    const track = /track:\s*"([\w-]+)"/.exec(sfxSrc)?.[1] ?? st.music?.track ?? "";
    const names = new Set(Object.keys(SFX).filter((n) => new RegExp(`"${n}"`).test(sfxSrc)));
    const fx = new Set(FX_NAMES.filter((n) => new RegExp(`\b${n}\b`).test(src)));
    return { set, track, names, fx, theme: st.theme ?? "", stage: st.stage ?? "", look: st.look ?? "" };
  };
  const me = profile(dir);
  const others = recent.map((r) => ({ ...r, ...profile(path.join(vroot, r.name)) }));
  const list = (xs) => (xs.length ? xs.map((x) => x.name).join(", ") : "none");
  add("INFO", `B48: the ${others.length} most recent videos (newest first): ${others.map((o) => o.name).join(", ")}`);
  const sameSet = me.set ? others.filter((o) => o.set === me.set) : [];
  add(!me.set ? "INFO" : sameSet.length ? "FLAG" : "PASS", `B48: the set kind${me.set ? ` "${me.set}"` : " is not declared yet"}${sameSet.length ? ` is REUSED from ${list(sameSet)}` : " is not in the recent videos"}`);
  const sameTrack = me.track ? others.filter((o) => o.track === me.track) : [];
  add(!me.track ? "INFO" : sameTrack.length ? soft : "PASS", `B48: the music track${me.track ? ` "${me.track}"` : " is not chosen yet"}${sameTrack.length ? ` is REUSED from ${list(sameTrack)}` : " is not in the recent videos"}${sameTrack.length ? note : ""}`);
  const fxHit = [...me.fx].map((n) => ({ n, v: others.filter((o) => o.fx.has(n)) })).filter((x) => x.v.length);
  add(fxHit.length ? "FLAG" : "PASS", `B48: ${fxHit.length ? `effects REUSED: ${fxHit.map((x) => `${x.n} from ${list(x.v)}`).join("; ")}` : "no effect of this video appears in the recent ones"} (effects drawn: ${[...me.fx].join(", ") || "none"})`);
  // B60 (ian, 2026-11-24): every sound name is one that none of the recent videos uses; only the fixed channel jingles may repeat.
  const JINGLES = new Set(["jingle-sting", "jingle-outro"]);
  const nameHit = [...me.names].filter((n) => !JINGLES.has(n)).map((n) => ({ n, v: others.filter((o) => o.names.has(n)) })).filter((x) => x.v.length);
  add(!me.names.size ? "INFO" : nameHit.length ? "FLAG" : "PASS", `B48/B60: the sound names (${me.names.size} distinct): ${!me.names.size ? "sfx.ts not written yet" : nameHit.length ? `REUSED from the recent videos: ${nameHit.map((x) => `${x.n} (${x.v.length}: ${x.v.slice(0, 2).map((o) => o.name).join(", ")}${x.v.length > 2 ? ", ..." : ""})`).join("; ")}` : "none is used by the recent videos (only the fixed jingles repeat)"}`);
  const themed = others.filter((o) => me.theme && o.theme === me.theme).length, staged = others.filter((o) => me.stage && o.stage === me.stage).length;
  add("INFO", `B48: the colour set "${me.theme || "cream"}" is in ${themed} of the recent videos, the stage "${me.stage || "slab"}" in ${staged}; pick the least used (the brief asks not to repeat the one of the video before: ${others[0]?.name ?? "none"} used "${others[0]?.theme || "cream"}" and "${others[0]?.stage || "slab"}")`);
  add("HUMAN", "B48: icon, texture, font treatment, hero, backdrop and every prop are also not in the recent videos (grep their index.tsx and set.json)");
}
if (process.argv.includes("--b48")) {
  await b48();
  for (const r of out) console.log(`${r.level.padEnd(6)} ${r.what}`);
  process.exit(out.some((r) => r.level === "FLAG" || r.level === "FAIL") ? 1 : 0);
}

// 1. the duration: one of the three lengths, and the beats add up to it exactly
const total = beats.reduce((a, b) => a + b.dur, 0);
add(new Set([30, 40, 45, 60]).has(story.duration) ? "PASS" : "FLAG", `duration ${story.duration} s is 30, 40, 45 or 60 s`);
add(total === story.duration ? "PASS" : "FLAG", `the beats add up to ${total} s, the duration is ${story.duration} s`);

// 2. the beat formula: hook first, sting second (if there is one), outro last; the kinds are known
add(kinds[0] === "hook" ? "PASS" : "FLAG", `the first beat is a hook (it is "${kinds[0]}")`);
// must 1 (B16): the small "Intip yuk!" sting right after the hook. A broken must is a FAIL, not a flag.
const stingText = beats[1]?.text ?? "";
add(kinds[1] === "sting" && /intip yuk/i.test(stingText) ? "PASS" : "FAIL", `must 1: the "Intip yuk!" sting is the second beat, with its text (${kinds[1] === "sting" ? `it is, with "${stingText}"` : `it is "${kinds[1]}"`})`);
// must 2 (B16): the loop-back ending (the last beat is the outro); its voice and its drawing are checked in section 5
add(kinds.at(-1) === "outro" ? "PASS" : "FAIL", `must 2: the last beat is the loop-back outro (it is "${kinds.at(-1)}")`);
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

// 5. the outro (B12: the loop-back, read from the plan): the loop-back. What the video DRAWS decides, not the story's outro items. A video declares the loop-back when its plan has a
//    loopWeight: then the story's outro items are ignored, and the plan's timing says when the mascot is on screen and which texts reach into the outro.
const outro = beats.at(-1) ?? {};
const planFile = path.join(dir, "plan.ts");
let P = null, planError = null;
if (existsSync(planFile)) {
  try { P = (await import(pathToFileURL(planFile).href)).makePlan(story); } catch (e) { planError = String(e.message ?? e).split("\n")[0]; }
}
const loopBack = !!P && typeof P.loopWeight === "function" && Number.isFinite(P.m?.outro);
const drawnSources = readdirSync(dir).filter((f) => /\.(ts|tsx)$/.test(f)).map((f) => readFileSync(path.join(dir, f), "utf8")).join("\n");
if (planError) add("FLAG", `the plan could not be read (${planError}): the outro is checked by the story only`);
if (loopBack) {
  add("INFO", "the video declares the loop-back (its plan has a loopWeight): the story's outro items are ignored, the video draws the loop-back");
  const windows = [];
  if (Number.isFinite(P.m.sting)) windows.push({ name: "sting", a: P.m.sting - 0.1, b: P.m.stingEnd + 0.15 });
  if (Number.isFinite(P.m.react)) windows.push({ name: "reaction", a: P.m.react, b: P.m.react + 1.25 });
  const late = windows.filter((w) => w.b > P.m.outro);
  add(late.length === 0 ? "PASS" : "FLAG", `no mascot is drawn in the outro (${late.length ? `the ${late[0].name} runs into it at ${late[0].a.toFixed(1)} s` : `the mascot ends by ${Math.max(...windows.map((w) => w.b)).toFixed(1)} s, the outro starts at ${P.m.outro.toFixed(1)} s`})`);
  const uses = (drawnSources.match(/<Mascot[\s/>]/g) ?? []).length;
  add(uses <= windows.length ? "PASS" : "FLAG", `the code draws the mascot no more often than its planned windows (${uses} uses, ${windows.length} windows)`);
  const texts = [...(P.labels ?? []).filter((l) => l.to > P.m.outro), ...(P.tops ?? []).filter((x) => x.b > P.m.outro)];
  add(texts.length === 0 ? "PASS" : "FLAG", `no text is on screen in the outro (${texts.length} planned texts reach into it)`);
} else {
  const outroMascot = itemsOf(outro).some((i) => i.type === "mascot");
  const outroText = itemsOf(outro).filter((i) => ["label", "pill", "banner"].includes(i.type)).map((i) => i.text);
  add(!outroMascot ? "PASS" : "FLAG", `the outro has no mascot (${outroMascot ? "the story's outro has one, and the video declares no loop-back" : "none"})`);
  add(outroText.length === 0 ? "PASS" : "FLAG", `the outro has no text (${outroText.length ? `the story's outro has: ${outroText.join(" / ")}` : "none"})`);
}
add(!outro.narration || outro.narration.trim() === "" ? "PASS" : "FAIL", `must 2: the outro has no voice (${outro.narration ? "its narration is not empty" : "empty: the loop-back"})`);
add("RENDER", "the first and last frames match (the loop test in tests/colokan.test.ts, or the loop check of the render)");

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
const look = story.look ?? "iso";                                  // B28: iso (the kit), 2d (flat drawing), text (kinetic numbers and words) or ricks (B46)
const isoParts = /Iso(WallSocket|Cutaway|Block|Plug|Sea|Land|Trees|Cloud|Bed|Lamp|Kettle|Fan|Clock|Cup|Battery|Heart|Brain)/.test(sources);
add(look !== "iso" ? "INFO" : isoParts ? "PASS" : "FLAG", look !== "iso" ? `look "${look}": no isometric stage block needed (B28)` : "the video draws its object in the isometric kit (a stage block)");
add("RENDER", "the hero is 60 to 70 % of the screen width at the main shot (measure it on the still)");

// 9. the marks: the components this video draws that are marks must be in the dictionary; a private mark is a FLAG
const registered = new Set(markComponents());
const markLike = ["HeatRise", "SmokePuffs", "Sparks", "IsoVapour", "IsoSun", "IsoSea", "IsoRain", "IsoDroplets", "Arrow", "IsoCutaway", "IsoWallSocket", "IsoSplash", "IsoRunoff", "IsoAir", "IsoLamp", "IsoKettle", "IsoFan", "IsoClock", "IsoCup", "IsoBattery", "IsoHeart", "IsoBrain"];
const used = markLike.filter((n) => new RegExp(`<${n}[\\s/>]`).test(sources));
const unregistered = used.filter((n) => !registered.has(n));
add(unregistered.length === 0 ? "PASS" : "FLAG", `every mark the video draws is in the dictionary (${used.length} used${unregistered.length ? `; missing rows: ${unregistered.join(", ")}` : ""})`);
const drawnMarks = DICTIONARY.filter((r) => r.status === "drawn").map((r) => r.id);
add("INFO", `marks in the video: ${used.map((n) => { const row = DICTIONARY.find((r) => r.components.some((c) => c.name === n)); return row ? `${row.id} (${n})` : `${n} (no row)`; }).join(", ") || "none"}; dictionary drawn rows: ${drawnMarks.join(", ")}`);

// 10. the new assets: at most three (a human count; the registry is the library)
add("HUMAN", "B56: a body part is a whole part (hand: palm, thumb, four fingers with joints and nails, wrist), real proportions, a sensible pose; fill its silhouette flat at 200 px for frame 0 and the main beats, open a 2x close-up of the part, and say you did");
add("HUMAN", "B58: ricks look: a person who is not acting stands completely still (breath 0); sellers stand behind their cart or table (occlude); no shot crops the hero or seller at an edge; props are rounded, textured and made of many parts, compared with real RicksClips3000 frames; open a still of every beat");
add("HUMAN", "at most three new loose supporting pieces (the hero and its own set are not counted, B27.15); say which pieces are new and which were reused");

// 10b. the set (B27.15): the video stands in its OWN set, declared in videos/<slug>/set.json. Drawing the set of another video, or naming a kind that another video
//      already declared, is a FAIL; a video without a set.json is a FLAG (the next video must be able to see that this background is taken).
const SO = loadSetOwners(path.join(ROOT, "videos"));
const freeIds = freeSets(SO.owners, SO.kinds).map((k) => k.id).join(", ");
const borrowed = borrowedSets(sources, slug, SO.owners, SO.kinds);
add(borrowed.length === 0 ? "PASS" : "FAIL", `B27.15: the set is the video's own (${borrowed.length ? borrowed.map(({ set, found, owner }) => `it draws "${set.id}", the set of ${owner} (${found.join(", ")}). Design a new set around this hero: free kinds are ${freeIds}; see src/sets.ts`).join("; ") : "no other video's set is drawn"})`);
if (look === "text") add("INFO", "B27.15: look text has no set, so no set.json is needed");
else if (look === "ricks") add("INFO", "B27.15: look ricks builds its set in three.js in the video's own files (no iso set kind, no set.json); B42 still applies");
else if (!/^selftest/.test(slug)) {
  const mine = declaredKind(slug, SO.owners);
  const bad = SO.problems.filter((x) => x.startsWith(`${slug}/`));
  if (!mine.kind) add("FLAG", `B27.15: the video declares its set (${bad.length ? bad.join("; ") : `add videos/${slug}/set.json: {"kind": "<id>"} with a free kind (${freeIds}), or a new kind with "name" and "fits"`})`);
  else add(mine.sharedWith.length === 0 ? "PASS" : "FAIL", `B27.15: the video's set kind "${mine.kind}" is used once (${mine.sharedWith.length ? `${mine.sharedWith.join(", ")} already stands in it; pick a free kind: ${freeIds}` : "no other video declares it"})`);
}

// 11. the myth check: a verdict stamp (only for a "Benarkah ...?" or "Mitos" question)
const myth = /^(benarkah|mitos)/i.test(story.question ?? "");
const hasVerdict = beats.some((b) => itemsOf(b).some((i) => i.type === "stamp" || i.type === "verdict"));
add(myth ? (hasVerdict ? "PASS" : "FLAG") : "INFO", myth ? "the myth check ends with a verdict stamp" : "not a myth check: no verdict stamp needed");

// 12. the detail budget: the hero reaches 80 % of the colokan's shapes and parts (scripts/detailBudget.mjs writes out/detail/budget.json)
add("RENDER", "the hero reaches 80 % of the colokan's shapes and parts (run scripts/detailBudget.mjs; the table is in the report)");
add("RENDER", "the motion density (B25): something moves about every second and something new every 3 to 4 seconds (render a draft, then npm run motion-density -- <slug>; the longest still stretch and the longest gap are in the report)");

// 13. must 3 (B16): the object style and the animation are consistent. (a) the colours come from the tokens (no literal colour, no gradient, except
//     the registered exceptions in src/motionLanguage.ts); (b) the easings and springs are the registry's; (c) the camera and the transitions are in the
//     ranges (a plan may leave one only with "motion-exception: <reason>" and ian's OK); (d) the motion blur is only on the fast moves.
const LANG = await import(pathToFileURL(path.join(ROOT, "src", "motionLanguage.ts")).href);
const videoName = path.basename(dir);
const sourceFiles = readdirSync(dir).filter((f) => /\.(ts|tsx)$/.test(f)).map((f) => ({ f, src: readFileSync(path.join(dir, f), "utf8") }));
const exceptions = LANG.STYLE_EXCEPTIONS.filter((e) => e.video === videoName);
const literals = [];
for (const { f, src } of sourceFiles) {
  let rest = src;
  for (const ex of exceptions) rest = rest.split(ex.match).join("");
  const hits = [...new Set(rest.match(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b|\brgba?\(|\bhsla?\(|linearGradient|radialGradient/g) ?? [])];
  if (hits.length) literals.push(`${f} (${hits.join(", ")})`);
}
add(literals.length === 0 ? "PASS" : "FAIL", `must 3 (a): every colour comes from the tokens (${literals.length ? `literal colours: ${literals.join("; ")}` : `none${exceptions.length ? `, except ${exceptions.length} registered exception(s)` : ""}`})`);
if (exceptions.length) add("INFO", `registered colour exceptions: ${exceptions.map((e) => `${e.match}: ${e.reason}`).join(" | ")}`);

// B17 (the text style is locked, DESIGN.md section 0b): the fonts are the tokens' (Outfit bold for the text, DM Mono for the labels); a literal font
// name is a FAIL unless it is one of the registered exceptions. The captions use the same tokens (src/components/Captions.tsx).
const fontLits = [];
for (const { f, src } of sourceFiles) {
  let rest = src;
  for (const ex of exceptions) rest = rest.split(ex.match).join("");
  if (/fontFamily:\s*['"`][^'"`]+['"`]/.test(rest)) fontLits.push(f);
}
// must 3 (e): the iso kit is mandatory (B27): the set and the hero are drawn in the kit's 2.5D iso camera, with src/design components and src/iso.ts geometry,
// never a flat side-view SVG. Fewer than two distinct Iso* components and no iso.ts geometry call means the video draws none.
const allSrc = sourceFiles.map((x) => x.src).join("\n");
const isoKit = [...new Set(allSrc.match(/<Iso[A-Z]\w*/g) ?? [])];
const isoCalls = /\b(block|extrudeXZ|extrudeAnyXZ|cylinder|planeXZ|planeYZ)\s*\(/.test(allSrc) && /from\s+"[^"]*iso\.ts"/.test(allSrc);
const isoOk = isoKit.length >= 2 || isoCalls;
if (look === "2d") add(isoKit.length === 0 && !isoCalls ? "PASS" : "FAIL", `must 3 (e): look "2d" is a flat drawing, no iso projection (${isoKit.length || isoCalls ? `iso helpers used: ${isoKit.join(", ")}${isoCalls ? " iso.ts geometry" : ""}` : "no iso helpers"})`);
else if (look === "text") add("INFO", 'must 3 (e): look "text": kinetic numbers and words in boxes, no iso geometry needed');
else if (look === "ricks") add(/ricks\/kit/.test(sources) && /\bRicksPost\b/.test(sources) && /\bStickHero\b/.test(sources) ? "PASS" : "FAIL", 'must 3 (e): look "ricks" uses the ricks kit (RicksPost for DOF + bloom + the sharp cast, StickHero for the cast, B46)');
else add(isoOk ? "PASS" : "FAIL", `must 3 (e): the set and the hero are drawn in the iso kit (${isoOk ? `${isoKit.length} Iso* component(s)${isoCalls ? ", iso.ts geometry" : ""}` : `${isoKit.length} Iso* component(s) and no iso.ts geometry: a flat side view is not the kit; build the asset from src/iso.ts block/extrude/cylinder and reuse src/design components`})`);

// must 3 (f): the channel's text format: kicker + headline at the top (TopText), the bottom caption with the spoken word yellow (CaptionLayer), no black top banner box.
const textMiss = look === "ricks"      // B46: the ricks look has its own text: one word at a time (WordCaption) and number pills, no TopText
  ? [!/\bWordCaption\b/.test(allSrc) && "WordCaption (one word at a time, B46)", /<Banner\b/.test(allSrc) && "a <Banner> box at the top"].filter(Boolean)
  : [!/\bTopText\b/.test(allSrc) && "TopText (kicker + headline)", !/\bCaptionLayer\b/.test(allSrc) && "CaptionLayer (bottom caption, spoken word yellow)", /<Banner\b/.test(allSrc) && "a <Banner> box at the top"].filter(Boolean);
add(textMiss.length === 0 ? "PASS" : "FAIL", `must 3 (f): the channel's text format (${textMiss.length ? `missing or wrong: ${textMiss.join("; ")}` : "TopText + CaptionLayer, no banner box"})`);

add(fontLits.length === 0 ? "PASS" : "FAIL", `B17: every font is the locked text style's (${fontLits.length ? `literal font names in ${fontLits.join(", ")}` : "the tokens' fonts, or the registered exceptions only"})`);

const planSrc = existsSync(planFile) ? readFileSync(planFile, "utf8") : "";
const planExceptions = [...planSrc.matchAll(/motion-exception:\s*([^\n*]+)/g)].map((m) => m[1].trim());
const motionBreaks = [];                                          // the range breaks; a plan's written exception makes them INFO
const inRange = (v, [lo, hi]) => v >= lo - 1e-9 && v <= hi + 1e-9;

// (b) easings and springs
const badEase = new Set();
const badSprings = [];
for (const { f, src } of sourceFiles) {
  for (const m of src.matchAll(/Easing\.\w+/g)) if (!LANG.EASING_TOKENS.includes(m[0])) badEase.add(`${f}: ${m[0]}`);
  for (const m of src.matchAll(/\bease[A-Z]\w*/g)) if (!["easeOut", "easeInOut", "easeOutBack"].includes(m[0])) badEase.add(`${f}: ${m[0]}`);
  for (const m of src.matchAll(/damping:\s*([\d.]+)[\s\S]{0,60}?stiffness:\s*([\d.]+)/g)) {
    const ok = Object.values(LANG.SPRINGS).some((s) => s.damping === Number(m[1]) && s.stiffness === Number(m[2]));
    if (!ok) badSprings.push(`${f}: damping ${m[1]}, stiffness ${m[2]}`);
  }
}
add(badEase.size === 0 ? "PASS" : "FAIL", `must 3 (b): the easings are the registry's (${badEase.size ? `not in the registry: ${[...badEase].join(", ")}` : "all in the registry"})`);
add(badSprings.length === 0 ? "PASS" : "FAIL", `must 3 (b): the springs are the registry's (${badSprings.length ? badSprings.join("; ") : "all in the registry"})`);

// (c) the camera and the transitions, in the ranges
for (const [i, b] of beats.entries()) {
  const c = b.camera;
  if (c && c.kind === "push") {
    const d = c.dur ?? b.dur, z = (c.zoom ?? 1.08) - 1;
    if (c.dur !== undefined && !inRange(d, LANG.RANGES.cameraPush)) motionBreaks.push(`beat ${b.id}: a push lasts ${d} s (${LANG.RANGES.cameraPush.join("-")} s)`);
    if (z / d > LANG.CAMERA_MAX.zoomPerSecond + 1e-9) motionBreaks.push(`beat ${b.id}: the push zooms ${(z / d).toFixed(3)} per second (at most ${LANG.CAMERA_MAX.zoomPerSecond})`);
  }
  if (c && c.kind === "pan") {
    const d = c.dur ?? 1;
    if (!inRange(d, LANG.RANGES.cameraPan)) motionBreaks.push(`beat ${b.id}: a pan lasts ${d} s (${LANG.RANGES.cameraPan.join("-")} s)`);
    if (Math.hypot(c.dx ?? 0, c.dy ?? 0) / d > LANG.CAMERA_MAX.panPxPerSecond) motionBreaks.push(`beat ${b.id}: the pan is faster than ${LANG.CAMERA_MAX.panPxPerSecond} px per second`);
  }
  const t = b.transition;
  if (t && t.dur !== undefined) {
    if (t.kind === "lens" && !inRange(t.dur, LANG.RANGES.lensDive)) motionBreaks.push(`beat ${b.id}: the lens transition lasts ${t.dur} s (${LANG.RANGES.lensDive.join("-")} s)`);
    if (["wipe", "slide"].includes(t.kind) && !inRange(t.dur, LANG.RANGES.wipeSlide)) motionBreaks.push(`beat ${b.id}: the ${t.kind} lasts ${t.dur} s (${LANG.RANGES.wipeSlide.join("-")} s)`);
  }
  // (d) the motion blur is for the fast moves only
  if (b.blur && !(t && LANG.BLUR_TRANSITIONS.includes(t.kind)) && !(c && c.kind === "pan")) {
    motionBreaks.push(`beat ${b.id}: a motion blur on a slow beat (blur is for a lens, slide, wipe or a pan)`);
  }
}
if (motionBreaks.length === 0) add("PASS", "must 3 (c, d): the camera, the transitions and the blur are in the motion language's ranges");
else if (planExceptions.length) add("INFO", `must 3 (c, d): the motion breaks are written as plan exceptions (${planExceptions.join(" | ")}): ${motionBreaks.join("; ")}`);
else add("FAIL", `must 3 (c, d): the motion is outside the ranges: ${motionBreaks.join("; ")}`);

// 13b. the files render.mjs loads in plain Node (sfx.ts, plan.ts) import only plain .ts modules: src/design/index.ts re-exports .tsx components, and Node cannot read a .tsx
//      ("Unknown file extension .tsx"): the video would not render. A FAIL, since it stops the render.
const nodeLoaded = ["sfx.ts", "plan.ts"].filter((f) => existsSync(path.join(dir, f)));
const badImports = nodeLoaded.filter((f) => /^\s*(import|export)\b[^;]*\bfrom\s+["\'][^"\']*design\/index(\.ts)?["\']/m.test(readFileSync(path.join(dir, f), "utf8")));
add(badImports.length === 0 ? "PASS" : "FAIL", `render: sfx.ts and plan.ts import only plain .ts modules (${badImports.length ? `${badImports.join(", ")} import src/design/index.ts, which re-exports .tsx: import from src/sfx.ts, src/schema.ts, src/layout.ts... instead` : "none imports src/design/index.ts"})`);

// 13c. every relative import of the video points at a file that exists with exactly that path and extension (tsc lets a wrong extension pass; the render bundler does not)
const importProblems = checkImports(dir);
add(importProblems.length === 0 ? "PASS" : "FAIL", `render: every relative import points at a file that exists, spelled exactly (${importProblems.length ? importProblems.join("; ") : "all found"})`);

// 14. the approved sound set (B15): the sound files and the SFX and MUSIC levels are the ones ian approved (scripts/soundHash.json). Changed = FAIL.
const { soundSet } = await import("./soundHash.mjs");
const soundRecord = path.join(ROOT, "scripts", "soundHash.json");
const approved = existsSync(soundRecord) ? JSON.parse(readFileSync(soundRecord, "utf8")).hash : null;
const nowSound = soundSet().hash;
add(approved === nowSound ? "PASS" : "FAIL", `B15: the approved sound set is unchanged (${approved === nowSound ? "it matches the record" : approved ? "it differs from the record: ian must approve it, then node scripts/soundHash.mjs --record": "no record yet"})`);

// B13/B15: the per-object sound is mandatory for a custom video: sfx.ts written by hand against the scenes, about one event a second (pilot 1: 44 in 45 s). A sfx.ts that
// is only the default, or under 0.7 events per second, is a FLAG; a sound name outside the locked set is a FAIL.
const sfxFile = path.join(dir, "sfx.ts");
if (existsSync(sfxFile)) {
  const sfxSrc = readFileSync(sfxFile, "utf8");
  const total = beats.reduce((a, b) => a + (b.dur ?? 0), 0);
  let events = null;
  try { events = (await import(pathToFileURL(sfxFile).href)).sfx(story); } catch (e) { add("FAIL", `B13: sfx.ts does not run (${String(e.message).slice(0, 100)})`); }
  if (events) {
    const { SFX_NAMES } = await import("../src/catalog.ts");
    const unknown = [...new Set(events.map((e) => e.name).filter((n) => !SFX_NAMES.includes(n)))];
    add(unknown.length === 0 ? "PASS" : "FAIL", `B15: every sound is from the locked set (${unknown.length ? `not in src/catalog.ts SFX: ${unknown.join(", ")}` : `${events.length} events`})`);
    const onlyDefault = /return\s+(defaultBeatSfx|storyEvents)\(story\)\s*;?\s*\}/.test(sfxSrc);
    const perSec = events.length / Math.max(1, total);
    add(onlyDefault || perSec < 0.7 ? "FLAG" : "PASS", `B13: a sound on every object, written by hand in sfx.ts (${events.length} events in ${total} s = ${perSec.toFixed(2)} a second${onlyDefault ? "; sfx.ts only returns the default" : ""}; pilot 1 has about 1 a second, at least 0.7)`);
  }
}

await b48();

// the report
const pad = (s) => s.padEnd(6);
console.log(`styleCheck: videos/${slug} (Style Bible v1)`);
for (const r of out) console.log(`${pad(r.level)} ${r.what}`);
const count = (l) => out.filter((r) => r.level === l).length;
console.log(`\nsummary: ${count("PASS")} pass, ${count("FAIL")} fail, ${count("FLAG")} flag, ${count("INFO")} info, ${count("RENDER")} need a render, ${count("HUMAN")} for a human`);
console.log(`\nhuman checklist (ian's quality bar, DESIGN.md section 10, and the bible's locks):
  [ ] one stage block on the brand background, the iso camera, the lens move the same way as in pilot 1
  [ ] its own set (src/sets.ts): not the sea, land and hills of another video; the set is registered with this video as owner
  [ ] a shape that really has a form is drawn in that form (B27.16: a rainbow is a full circle, cut by the horizon)
  [ ] one hero asset at the detail budget; supporting assets simple and flat; at most three new assets
  [ ] every mark drawn with its dictionary recipe; no private mark
  [ ] tone rule, flat tones, meaning colours; the nature colours only for nature
  [ ] two text layers, at most six words on screen; the sources and fact check for each claim
  [ ] the mascot is small, at most two reactions, none in the outro (if the bible's rule holds)
  [ ] the loop-back ending; a sound on each movement, at most three at once
  [ ] the in-between states checked as strips; the highlight lives on its object
  [ ] does it look like the same channel as pilot 1?`);
process.exit(count("FLAG") + count("FAIL") > 0 ? 1 : 0);
