// node scripts/frames.mjs <composition> <out folder inside out/> <seconds...>   -> one PNG per time (t-<sec>.png), for checking a video frame by frame.
// The composition's own defaultProps are used (a custom video reads its story.json). Renders in one browser session, so many frames are quick.
import path from "node:path";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const [id, dir, ...times] = process.argv.slice(2);
if (!id || !dir || !times.length) { console.error("usage: node scripts/frames.mjs <composition> <folder> <seconds...>"); process.exit(1); }
const serveUrl = await bundle({ entryPoint: path.join(ROOT, "src", "index.ts"), publicDir: path.join(ROOT, "public") });
const chromiumOptions = { gl: "angle" };
const composition = await selectComposition({ serveUrl, id, chromiumOptions, logLevel: "error" });
const outDir = path.join(ROOT, "out", dir);
mkdirSync(outDir, { recursive: true });
for (const s of times) {
  const frame = Math.min(composition.durationInFrames - 1, Math.round(Number(s) * composition.fps));
  const output = path.join(outDir, `t-${Number(s).toFixed(2)}.png`);
  await renderStill({ composition, serveUrl, output, frame, chromiumOptions, imageFormat: "png", logLevel: "error", timeoutInMilliseconds: 120000 });  // fonts can take longer than the default 30 s on a busy machine
  console.log(output);
}
