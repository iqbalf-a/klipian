// node scripts/soundHash.mjs            -> prints the hash of the approved sound set (Style Bible v1, B15) and whether it matches the record
// node scripts/soundHash.mjs --record   -> writes scripts/soundHash.json (only when ian has approved a change to the approved set)
//
// The approved sound set (ian, 2026-10-28: "the sound effects and all the sounds are perfect") is the reference of the channel. It has one entry per
// approved sound: each sound file in sfx/wav, the approved music beds (bed-calm and bed-tech: their files and their lines of the MUSIC table in
// src/catalog.ts), and the SFX table. Each entry is hashed on its own, and the set's hash is the hash of those entries, so a change to any of them
// changes the hash. Music beds added later (PLAN-VARIETY, B15 amended) are an OPEN set: they are listed, but they are not part of the approved hash
// until ian approves them and they are recorded in `approved`. The record keeps the hash of the approved set as it was approved (`legacyHash`).
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const RECORD = path.join(ROOT, "scripts", "soundHash.json");
// the beds that ian approved with the pilot 1 sound set (their files and their table lines are the reference)
export const APPROVED_BEDS = ["bed-calm", "bed-tech"];
// the variety effects (2026-11-13, B15 amended): added next to the approved set, never instead of it. Like the new beds they are OPEN: their files and
// their lines of the SFX table are left out of the approved hash, so the approved sounds still hash to the record. When ian approves them: empty this
// list and run --record.
export const OPEN_SFX = ["plop", "pop-wood", "swish-down", "whoosh-soft", "swoop", "tock", "click-soft", "marimba", "bell-soft", "page-flip", "stamp", "coin", "switch", "key-blip",
  "water-splash", "water-pour", "wave-wash", "bubble-pop", "stream-trickle", "gulp", "door-creak", "wood-crack",
  "drawer-slide", "door-knock", "metal-clang", "anvil-ting", "chain-rattle", "can-tap", "key-jingle", "cloth-rustle",
  "zipper-pull", "velcro-rip", "fabric-flap", "paper-crumple", "paper-tear", "scribble-pen", "glass-clink", "cork-pop",
  "glass-break", "crunch", "slurp", "soda-fizz", "knife-chop", "egg-crack", "bird-chirp", "meow",
  "frog-croak", "cricket", "bee-buzz", "car-horn", "bike-bell", "engine-rev", "train-whistle", "brake-squeal",
  "doorbell", "alarm-ring", "kettle-whistle", "microwave-ding", "toaster-pop", "phone-buzz", "camera-shutter", "typing",
  "power-up", "power-down", "static-burst", "notify-ding", "low-battery", "wind-gust", "thunder-rumble", "leaf-rustle",
  "fire-crackle", "success-fanfare", "error-buzz", "level-up", "toggle-on", "swipe", "sparkle", "countdown-beep",
  "heartbeat", "footstep", "clap-hands", "finger-snap", "bonk", "slide-whistle-up", "drum-roll", "cymbal-crash"];
const sha = (x) => createHash("sha256").update(x).digest("hex");

/** The approved entries (name -> hash), the open entries (new beds, not approved yet), the set's hash and the entry names. */
export function soundSet() {
  const approved = {}, open = {};
  for (const f of readdirSync(path.join(ROOT, "sfx", "wav")).filter((f) => /\.wav$/i.test(f)).sort()) {
    (OPEN_SFX.includes(f.replace(/\.wav$/i, "")) ? open : approved)[`sfx/wav/${f}`] = sha(readFileSync(path.join(ROOT, "sfx", "wav", f)));
  }
  for (const f of readdirSync(path.join(ROOT, "sfx", "music")).filter((f) => /\.wav$/i.test(f)).sort()) {
    const name = f.replace(/\.wav$/i, "");
    const entry = `sfx/music/${f}`;
    if (APPROVED_BEDS.includes(name)) approved[entry] = sha(readFileSync(path.join(ROOT, "sfx", "music", f)));
    else open[entry] = sha(readFileSync(path.join(ROOT, "sfx", "music", f)));
  }
  const catalog = readFileSync(path.join(ROOT, "src", "catalog.ts"), "utf8");
  const sfx = catalog.match(/export const SFX = \{[\s\S]*?\r?\n\}[^\n]*/);
  if (!sfx) throw new Error("src/catalog.ts has no SFX table");
  const openName = (line) => { const name = line.match(/^\s*"([a-z-]+)":/)?.[1]; return OPEN_SFX.includes(name) ? name : null; };
  const rows = sfx[0].replace(/\r/g, "").split("\n");                      // the content, not the line endings
  approved["src/catalog.ts SFX"] = sha(rows.filter((l) => !openName(l)).join("\n"));
  for (const l of rows) if (openName(l)) open[`src/catalog.ts SFX ${openName(l)}`] = sha(l);
  const music = catalog.match(/export const MUSIC = \{[\s\S]*?\r?\n\}[^\n]*/);
  if (!music) throw new Error("src/catalog.ts has no MUSIC table");
  for (const line of music[0].replace(/\r/g, "").split("\n")) {            // the content, not the line endings
    const m = line.match(/^\s*"([a-z-]+)":/);
    if (!m) continue;
    if (APPROVED_BEDS.includes(m[1])) approved[`src/catalog.ts MUSIC ${m[1]}`] = sha(line);
    else open[`src/catalog.ts MUSIC ${m[1]}`] = sha(line);
  }
  const hash = sha(Object.keys(approved).sort().map((k) => `${k}:${approved[k]}\n`).join(""));
  return { hash, parts: Object.keys(approved), approved, open };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const set = soundSet();
  if (process.argv.includes("--record")) {
    const old = existsSync(RECORD) ? JSON.parse(readFileSync(RECORD, "utf8")) : {};
    writeFileSync(RECORD, `${JSON.stringify({
      hash: set.hash,
      legacyHash: old.legacyHash ?? old.hash ?? null,
      approved: set.approved,
      covers: set.parts,
      note: "the approved sound set of pilot 1 (ian, 2026-10-28), one entry per approved sound; the open beds are not approved yet",
    }, null, 2)}\n`);
    console.log(`recorded ${set.hash}`);
  } else {
    const recorded = existsSync(RECORD) ? JSON.parse(readFileSync(RECORD, "utf8")).hash : null;
    console.log(`${set.hash}${recorded === set.hash ? " (matches the record)" : recorded ? " (differs from the record)" : " (no record yet)"}`);
    if (Object.keys(set.open).length) console.log(`open (not approved yet): ${Object.keys(set.open).join(", ")}`);
  }
}
