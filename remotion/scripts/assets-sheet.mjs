// npm run assets-sheet  ->  out/assets-sheet.png (2D and 3D) and out/assets-sheet-iso.png (the 2.5D isometric kit and the overlays) and out/assets-sheet-life.png (the alive set): every asset with its name.
import { mkdirSync, writeFileSync, unlinkSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
mkdirSync(path.join(ROOT, "out"), { recursive: true });
const job = path.join(ROOT, "out", "assets-sheet.job.json");
let status = 0;
for (const [composition, out] of [["AssetSheet", "assets-sheet.png"], ["AssetSheetIso", "assets-sheet-iso.png"], ["AssetSheetLife", "assets-sheet-life.png"]]) {
  writeFileSync(job, JSON.stringify({ mode: "still", composition, frame: 12, out }));
  const r = spawnSync(process.execPath, [path.join(ROOT, "render.mjs"), job], { stdio: "inherit" });
  status ||= r.status ?? 1;
}
unlinkSync(job);
if (status === 0) console.log("the sheets are out/assets-sheet.png, out/assets-sheet-iso.png and out/assets-sheet-life.png");
process.exit(status);
