// node scripts/frames.mjs <composition> <out folder inside out/> <seconds...>   -> one PNG per time (t-<sec>.png), for checking a video frame by frame.
//   --strip a:b[:step]  adds a frame every `step` seconds (default 0.2) from a to b: the strip of a key action (a fall, a hand-over, a hit) that B71 asks for.
//   --sheet             tiles every frame of this run into <folder>/sheet.png with its time on it (6 columns), so one image shows the whole run (needs ffmpeg).
// The composition's own defaultProps are used (a custom video reads its story.json). Renders in one browser session, so many frames are quick.
import path from "node:path";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const raw = process.argv.slice(2), sheet = raw.includes("--sheet");
const strips = raw.flatMap((a, i) => (raw[i - 1] === "--strip" ? [a] : []));
const [id, dir, ...times] = raw.filter((a, i) => a !== "--sheet" && a !== "--strip" && raw[i - 1] !== "--strip");
for (const st of strips) { const [a, b, step = 0.2] = st.split(":").map(Number); if (![a, b, step].every(Number.isFinite) || !(step > 0) || b < a) { console.error(`bad --strip "${st}": use a:b[:step]`); process.exit(1); } for (let x = a; x <= b + 1e-9; x += step) times.push(x.toFixed(2)); }
if (!id || !dir || !times.length) { console.error("usage: node scripts/frames.mjs <composition> <folder> <seconds...> [--strip a:b[:step]] [--sheet]"); process.exit(1); }
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
if (sheet) {                                         // one labelled thumbnail per frame, then one tile image
  const font = ["C:/Windows/Fonts/arial.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", "/System/Library/Fonts/Supplemental/Arial.ttf"].find(existsSync);
  const th = path.join(outDir, "_th"); rmSync(th, { recursive: true, force: true }); mkdirSync(th);
  times.forEach((s, i) => {
    const label = font ? `,drawtext=fontfile='${font.replace(/^([A-Za-z]):/, "$1\\:")}':text='${Number(s).toFixed(2)} s':x=8:y=8:fontsize=26:fontcolor=white:box=1:boxcolor=black@0.6` : "";
    spawnSync("ffmpeg", ["-v", "error", "-y", "-i", path.join(outDir, `t-${Number(s).toFixed(2)}.png`), "-vf", `scale=270:-1${label}`, path.join(th, `${String(i).padStart(3, "0")}.png`)]);
  });
  const rows = Math.ceil(times.length / 6), out = path.join(outDir, "sheet.png");
  const r = spawnSync("ffmpeg", ["-v", "error", "-y", "-framerate", "1", "-i", path.join(th, "%03d.png"), "-vf", `tile=6x${rows}`, "-frames:v", "1", out], { encoding: "utf8" });
  rmSync(th, { recursive: true, force: true });
  console.log(r.status === 0 ? out : `sheet failed: ${r.stderr.slice(-300)}`);
}
