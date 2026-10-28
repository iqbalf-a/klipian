// node scripts/soundHash.mjs            -> prints the hash of the approved sound set (Style Bible v1, B15)
// node scripts/soundHash.mjs --record   -> writes scripts/soundHash.json (only when ian has approved a change to the sound set)
//
// The approved sound set (ian, 2026-10-28: "the sound effects and all the sounds are perfect") is the reference of the channel: the sound files in
// sfx/wav and sfx/music, and the SFX and MUSIC tables of src/catalog.ts (their levels, cooldowns and lengths). A change to any of them changes the hash,
// and `scripts/styleCheck.mjs` FAILs until ian approves it and the hash is recorded again.
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const RECORD = path.join(ROOT, "scripts", "soundHash.json");

/** The hash of the approved set, and the parts it covers (for the report). */
export function soundSet() {
  const h = createHash("sha256");
  const parts = [];
  for (const dir of ["sfx/wav", "sfx/music"]) {
    const files = readdirSync(path.join(ROOT, dir)).filter((f) => /\.wav$/i.test(f)).sort();
    for (const f of files) {
      const buf = readFileSync(path.join(ROOT, dir, f));
      h.update(`${dir}/${f}:`).update(buf);
      parts.push(`${dir}/${f}`);
    }
  }
  const catalog = readFileSync(path.join(ROOT, "src", "catalog.ts"), "utf8");
  for (const name of ["SFX", "MUSIC"]) {
    const m = catalog.match(new RegExp(`export const ${name} = \\{[\\s\\S]*?\\r?\\n\\}[^\\n]*`));   // the table up to its closing brace line
    if (!m) throw new Error(`src/catalog.ts has no ${name} table`);
    h.update(`${name}:`).update(m[0]);
    parts.push(`src/catalog.ts ${name}`);
  }
  return { hash: h.digest("hex"), parts };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const set = soundSet();
  if (process.argv.includes("--record")) {
    writeFileSync(RECORD, `${JSON.stringify({ hash: set.hash, covers: set.parts, note: "the approved sound set of pilot 1 (ian, 2026-10-28)" }, null, 2)}\n`);
    console.log(`recorded ${set.hash}`);
  } else {
    const recorded = existsSync(RECORD) ? JSON.parse(readFileSync(RECORD, "utf8")).hash : null;
    console.log(`${set.hash}${recorded === set.hash ? " (matches the record)" : recorded ? " (differs from the record)" : " (no record yet)"}`);
  }
}
