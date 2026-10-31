/* The two scripts klipian (Python) calls: catalog-export.mjs and validate.mjs. `npm test`. The catalogue is read off the schema, so a type or an
   enum added there shows up here without anyone copying it; the example story in it is a valid story; validate.mjs says ok or lists errors
   with a path and a message. */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ITEM_TYPES, MASCOT_EXPRESSIONS, SFX_NAMES } from "../src/catalog.ts";
import { SAFE } from "../src/tokens.ts";
import { Item } from "../src/schema.ts";
import { catalog } from "../catalog-export.mjs";

let n = 0;
const yes = (cond: boolean, what: string) => { n++; assert.ok(cond, what); };
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

const run = (script: string, ...args: string[]) => {
  const r = spawnSync(process.execPath, [path.join(ROOT, script), ...args], { encoding: "utf8" });
  return { code: r.status, out: r.stdout, err: r.stderr };
};
const tmp = mkdtempSync(path.join(tmpdir(), "klipian-validate-"));
const validate = (story: unknown) => {
  const f = path.join(tmp, "story.json");
  writeFileSync(f, typeof story === "string" ? story : JSON.stringify(story));
  const r = run("validate.mjs", f);
  return { code: r.code, json: JSON.parse(r.out) };
};

// --- the catalogue --------------------------------------------------------------------------------------------------------------------------
const cat = JSON.parse(run("catalog-export.mjs").out);
yes(JSON.stringify(cat) === JSON.stringify(JSON.parse(JSON.stringify(catalog()))), "the script prints what catalog() returns");
yes(JSON.stringify(Object.keys(cat.items)) === JSON.stringify(Object.keys(Object.fromEntries(ITEM_TYPES.map((t) => [t, 1])))), "every item type of the schema is in the catalogue, in order");
yes(Object.keys(cat.items).length === (Item as any)._def.options.length, "and there are as many as the schema's union has");
yes(cat.items.socket.view.includes('"cutaway"') && cat.items.socket.variant.includes('"loose"'), "a socket's views and variants are read from the schema");
yes(JSON.stringify(cat.mascot.expressions) === JSON.stringify(MASCOT_EXPRESSIONS), "the mascot's expressions");
yes(JSON.stringify(cat.sfx.names) === JSON.stringify(SFX_NAMES), "the sound names");
yes(cat.limits.maxScreenWords === 6 && cat.limits.maxTransitions === 3 && cat.limits.safeArea.bottom === SAFE.bottom && cat.limits.safeArea.right === SAFE.right, "the limits of the channel");
yes(cat.format.width === 1080 && cat.format.height === 1920 && cat.format.fps === 30, "the format");
yes(cat.rules.length >= 6 && cat.rules.every((r: string) => r.length > 10), "the rules are sentences");
yes(Object.keys(cat.motionFields).join() === "enter?,exit?,actions?,sfx?", "the motion fields every item has are said once");
yes(!("enter?" in cat.items.label) && !("sfx?" in cat.items.mascot), "and are not repeated per item");
yes(cat.story.fields.beats === "array of beat (1..16)", "the story's beats refer to the beat shape instead of repeating it");
yes(cat.motion.transitions.includes("lens") && cat.motion.camera.includes("pan"), "the motion words");
yes(JSON.stringify(cat).length < 40000, `the catalogue stays small enough for a brief (${JSON.stringify(cat).length} characters)`);

// --- validate.mjs ---------------------------------------------------------------------------------------------------------------------------
const example = cat.example;
const ok = validate(example);
yes(ok.code === 0 && ok.json.ok === true && ok.json.beats.length === 6 && ok.json.duration === 30 && (ok.json.warnings ?? []).length === 0, "the example story (30 s) is valid, with no warnings");
const colokan = JSON.parse(readFileSync(path.join(ROOT, "stories", "colokan-panas.json"), "utf8"));
yes(validate(colokan).json.ok === true, "so is the colokan story");

const mutate = (fn: (s: any) => void) => { const s = structuredClone(example); fn(s); return validate(s); };
const wordy = mutate((s) => { s.beats[0].text = "satu dua tiga empat lima enam tujuh"; });
yes(wordy.json.ok === false && wordy.code === 0, "screen text over 6 words is refused (exit code 0: the answer is in the JSON)");
yes(wordy.json.errors.some((e: any) => e.path === "beats.0.text" && /6 words/.test(e.message)), "with the path and the reason");
const unknown = mutate((s) => { s.beats[1].scene.items.find((i: any) => i.type === "mascot").expr = "angry"; });
yes(unknown.json.errors.some((e: any) => e.path.endsWith(".expr")), "an expression that does not exist is refused at its path");
const noSource = mutate((s) => { s.claims[0].sources = []; });
yes(noSource.json.errors.some((e: any) => e.path === "claims.0.sources"), "a claim without a source is refused");
const wrongTotal = mutate((s) => { s.duration = 99; });
yes(wrongTotal.json.errors.some((e: any) => e.path === "duration"), "durations that do not add up are refused");
const ghost = mutate((s) => { s.claims[0].beats = ["nowhere"]; });
yes(ghost.json.errors.some((e: any) => /unknown beat/.test(e.message)), "a claim for a beat that does not exist is refused");
const badSocket = validate((() => { const s = structuredClone(colokan); const k = s.beats[0].scene.items.find((i: any) => i.type === "socket"); k.view = "cutaway"; k.variant = "scorched"; return s; })());
yes(badSocket.json.errors.some((e: any) => /variant/.test(e.message)), "a variant of the other view is refused");
const two = mutate((s) => { s.beats[0].text = "a b c d e f g"; s.claims[0].sources = []; });
yes(two.json.errors.length >= 2, "every error is listed, not only the first");
const notJson = validate("{ this is not json");
yes(notJson.code === 1 && notJson.json.ok === false && /not readable JSON/.test(notJson.json.errors[0].message), "a file that is not JSON is reported");
yes(run("validate.mjs").code === 2, "no argument: usage, exit code 2");

console.log(`scripts: ${n} checks ok`);
