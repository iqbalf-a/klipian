// npm run assets-sheet  ->  out/assets-sheet.png: one still with every asset of the library (2D and 3D), each with its name.
import { mkdirSync, writeFileSync, unlinkSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
mkdirSync(path.join(ROOT, "out"), { recursive: true });
const job = path.join(ROOT, "out", "assets-sheet.job.json");
writeFileSync(job, JSON.stringify({ mode: "still", composition: "AssetSheet", frame: 12, out: "assets-sheet.png" }));
const r = spawnSync(process.execPath, [path.join(ROOT, "render.mjs"), job], { stdio: "inherit" });
unlinkSync(job);
if (r.status === 0) console.log(`the sheet is out/assets-sheet.png`);
process.exit(r.status ?? 1);
