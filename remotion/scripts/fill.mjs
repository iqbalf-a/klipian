// node scripts/fill.mjs <video.mp4 | slug> [--slug=<slug> when a file] [--json]      (npm run fill -- <slug>)
//
// The fill of a video (DESIGN.md B27.3): the share of the picture, between the top text and the caption band, that is still the EMPTY brand background (the theme's
// wall tone and its yellow spot). A set bleeds past the frame, so at most 35 % may be empty in the main shot of each beat. ffmpeg gives 108 x 192 RGB frames twice a
// second; a beat's fill is the median over its frames, skipping the sting and outro beats and the dark frames (the lens: the Lab is dark and stays empty by rule).
// A flag, not a failure: exit code 0 always.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { findVideo } from "./motionDensity.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const W = 108, H = 192, FPS = 2, MAX = 0.35, TOL = 3, DARK = 120;
const parse = (c) => c.match(/\d+/g).map(Number);

/** The share (0..1) of the pixels in the rows `region` (shares of the height) of a raw RGB frame that match one of `colors` ([r,g,b]) within `tol` on every channel. Pure. */
export function fillOf(rgb, w, h, region, colors, tol = TOL) {
  const r0 = Math.round(region[0] * h), r1 = Math.round(region[1] * h);
  let hit = 0;
  for (let i = r0 * w; i < r1 * w; i++) {
    const p = i * 3;
    if (colors.some((c) => Math.abs(rgb[p] - c[0]) <= tol && Math.abs(rgb[p + 1] - c[1]) <= tol && Math.abs(rgb[p + 2] - c[2]) <= tol)) hit++;
  }
  return hit / Math.max(1, (r1 - r0) * w);
}
const meanLuma = (rgb, w, h, region) => {
  const r0 = Math.round(region[0] * h) * w, r1 = Math.round(region[1] * h) * w; let s = 0;
  for (let i = r0; i < r1; i++) s += (rgb[i * 3] + rgb[i * 3 + 1] + rgb[i * 3 + 2]) / 3;
  return s / (r1 - r0);
};
const median = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : null; };

/** Per beat of a story ({id, kind, dur}): the median fill of its light frames, null when the beat has none (sting, outro, the lens). */
export function fillPerBeat(frames, beats, colors, region, w = W, h = H, fps = FPS) {
  let at = 0;
  return beats.map((b) => {
    const a = at; at += b.dur;
    if (b.kind === "sting" || b.kind === "outro") return { id: b.id, a, b: at, fill: null };
    const vals = [];
    for (let k = Math.floor(a * fps) + 1; k < Math.floor(at * fps) - 1; k++) {
      const f = frames[k]; if (!f || meanLuma(f, w, h, region) < DARK) continue;
      vals.push(fillOf(f, w, h, region, colors));
    }
    return { id: b.id, a, b: at, fill: median(vals) };
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const arg = process.argv[2];
  if (!arg) { console.error("usage: node scripts/fill.mjs <video.mp4 | slug> [--json]"); process.exit(2); }
  const file = findVideo(arg), slug = (process.argv.find((a) => a.startsWith("--slug=")) ?? "").slice(7) || (existsSync(arg) ? path.basename(path.dirname(arg)) : arg);
  const storyFile = path.join(ROOT, "videos", slug, "story.json");
  if (!file || !existsSync(storyFile)) { console.error(`no video or videos/${slug}/story.json for "${arg}": render a draft first (see motionDensity.mjs)`); process.exit(2); }
  const story = JSON.parse(readFileSync(storyFile, "utf8")), theme = (await import(pathToFileURL(path.join(ROOT, "src", "tokens.ts")).href)).THEMES[story.theme ?? "cream"];
  const { DENSITY } = await import(pathToFileURL(path.join(ROOT, "src", "motionLanguage.ts")).href);
  const r = spawnSync("ffmpeg", ["-v", "error", "-i", file, "-vf", `fps=${FPS},scale=${W}:${H}:flags=area`, "-f", "rawvideo", "-pix_fmt", "rgb24", "pipe:1"], { maxBuffer: 1 << 29 });
  if (r.status !== 0) throw new Error(`ffmpeg could not read ${file}: ${String(r.stderr)}`);
  const size = W * H * 3, frames = Array.from({ length: Math.floor(r.stdout.length / size) }, (_, k) => r.stdout.subarray(k * size, (k + 1) * size));
  const rows = fillPerBeat(frames, story.beats, [theme.wall, theme.spot, theme.spotInner].map(parse), DENSITY.region);
  if (process.argv.includes("--json")) console.log(JSON.stringify(rows));
  else {
    console.log(`fill (empty brand background between the top text and the captions): ${path.relative(ROOT, file)}`);
    for (const x of rows) console.log(x.fill === null ? `INFO   ${x.id.padEnd(10)} not measured (sting, outro or inside the lens)` : `${x.fill <= MAX ? "PASS" : "FLAG"}   ${x.id.padEnd(10)} ${(x.fill * 100).toFixed(0).padStart(3)} %  (at most ${MAX * 100} %)`);
  }
}
