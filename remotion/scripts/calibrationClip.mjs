// node scripts/calibrationClip.mjs  ->  out/safe/calibration.mp4 (1080 x 1920, 6 s, no sound)
// The calibration clip of PLAN-SAFE-AREA / B24 (src/Calibration.tsx). klipian never uploads it: ian uploads it privately to each app, plays it, and sends the
// screenshots, so the profiles of SAFE_PLATFORMS can be set from what each app really covers (YouTube: an unlisted or private Short; TikTok: a draft or a private
// post; Instagram: close friends or an archived Reel).
import path from "node:path";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const serveUrl = await bundle({ entryPoint: path.join(ROOT, "src", "index.ts"), publicDir: path.join(ROOT, "public") });
const chromiumOptions = { gl: "angle" };
const composition = await selectComposition({ serveUrl, id: "Calibration", chromiumOptions, logLevel: "error" });
const outDir = path.join(ROOT, "out", "safe");
mkdirSync(outDir, { recursive: true });
const output = path.join(outDir, "calibration.mp4");
await renderMedia({ composition, serveUrl, codec: "h264", outputLocation: output, chromiumOptions, logLevel: "error", muted: true });
console.log(output);
