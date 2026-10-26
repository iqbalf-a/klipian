/* DESIGN.md (the guide every video session reads first) and the library it describes: `npm test`. The headings the sessions rely on are there, every name the
   guide imports from the design barrel exists, the scaffold command it shows exists in package.json, and what it says about the rules matches the code. */
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MAX_MASCOT_REACTION_S, MAX_MASCOT_REACTIONS, MAX_SCREEN_WORDS, MAX_TRANSITIONS } from "../src/schema.ts";
import { SAFE } from "../src/tokens.ts";
import { ASSET_NAMES_FILE } from "./assetNames.ts";

let n = 0;
const yes = (c: boolean, what: string) => { n++; assert.ok(c, what); };
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const guide = readFileSync(path.join(ROOT, "DESIGN.md"), "utf8");

for (const h of ["How to start a new video", "palette", "Backgrounds", "The mascot and people", "3D objects", "Cables", "Motion", "Camera-led scenes", "Sound", "Layout", "Text", "quality bar", "How to add an asset"])
  yes(guide.toLowerCase().includes(h.toLowerCase()), `DESIGN.md has "${h}"`);

// the exact commands
const pkg = JSON.parse(readFileSync(path.join(ROOT, "package.json"), "utf8"));
for (const cmd of ["new-video", "studio", "assets-sheet", "check", "test"]) yes(typeof pkg.scripts[cmd] === "string" && guide.includes(cmd === "test" ? "npm test" : `npm run ${cmd}`), `npm run ${cmd} exists and the guide says it`);

// every name imported from the design barrel is exported somewhere in src/
const files: string[] = [];
const walk = (d: string) => { for (const f of readdirSync(d)) { const p = path.join(d, f); if (statSync(p).isDirectory()) walk(p); else if (/\.(ts|tsx)$/.test(f)) files.push(p); } };
walk(path.join(ROOT, "src"));
const exported = new Set<string>();
for (const f of files) {
  const src = readFileSync(f, "utf8");
  for (const m of src.matchAll(/export\s+(?:const|function|class|type|interface)\s+([A-Za-z0-9_]+)/g)) exported.add(m[1]);
  for (const m of src.matchAll(/export\s*\{([^}]*)\}/g)) for (const part of m[1].split(",")) { const name = part.trim().split(/\s+as\s+/).pop()!.replace(/^type\s+/, "").trim(); if (name) exported.add(name); }
}
const imported = [...guide.matchAll(/import\s*\{([^}]*)\}\s*from\s*"\.\.\/\.\.\/src\/design\/index\.ts"/g)].flatMap((m) => m[1].split(",").map((x) => x.trim().replace(/^type\s+/, "")).filter((x) => x && x !== "..."));
yes(imported.length >= 15, `the guide's examples import ${imported.length} names`);
for (const name of imported) yes(exported.has(name), `${name} (imported in DESIGN.md) is exported`);
const barrel = readFileSync(path.join(ROOT, "src", "design", "index.ts"), "utf8");
for (const name of ["StoryVideo", "SourceCard", "PointerLabel", "Onomatopoeia", "CaptionLayer", "TopText", "Host3D", "shots", "viewAt", "WallSocket3D", "Mascot", "Chibi", "Brand", "Lab"]) yes(barrel.includes(name), `the design barrel exports ${name}`);

// what the guide says about the rules is what the code says
yes(guide.includes(`at most **${MAX_MASCOT_REACTIONS} short reactions**`) && guide.includes(`${MAX_MASCOT_REACTION_S} s`), "the mascot rule in the guide is the validator's");
yes(guide.includes(`**At most ${MAX_SCREEN_WORDS} words`) && guide.includes(`**at most ${MAX_TRANSITIONS}**`), "the text and transition limits in the guide are the validator's");
yes(guide.includes(`left: ${SAFE.left}, right: ${SAFE.right}, top: ${SAFE.top}, bottom: ${SAFE.bottom}`), "the safe area in the guide is the code's");
yes(ASSET_NAMES_FILE.includes("3d cutaway loose") && ASSET_NAMES_FILE.includes("MASCOT_EXPRESSIONS") && ASSET_NAMES_FILE.includes("bg lab"), "the asset sheet lists the 2D and 3D assets by name");

console.log(`design: ${n} checks ok`);
