// node scripts/motionDensity.mjs <video.mp4 | slug> [--json]      (npm run motion-density -- <video.mp4 | slug>)
//
// The motion density of a rendered video (DESIGN.md B25): something in the picture moves about every second, and something NEW (an element comes in, the camera goes
// to another place, the scene changes) every 3 to 4 seconds. A still picture that does not move for long reads as dead on a phone; a picture that never brings
// anything new is a long hold of the same shot. The measure reads the PICTURE, not the code: ffmpeg gives a 54 x 96 grey frame 4 times a second, the mean absolute
// difference between two neighbouring frames is the "movement" of that moment, and
//   still stretch    the longest run of moments below DENSITY.moveEps (nothing moves)             must be at most DENSITY.aliveMax seconds
//   new gap          the longest gap between moments above DENSITY.newEps (something new)         must be at most DENSITY.newMax seconds
// The picture is read WITHOUT the caption band and the top text (rows DENSITY.region of the frame): the karaoke captions change every few words and would count
// as "something new" for ever. "New" is measured against an anchor: the first frame is the anchor; the moment the picture differs from it by more than DENSITY.newEps
// (mean grey levels over the region) is a new thing and its frame becomes the anchor, so a label that comes in is small, a camera that goes somewhere else or
// another scene is big. The numbers are in src/motionLanguage.ts (DENSITY). A slug looks for the newest out/<slug>/*.mp4 (or out/density/<slug>*.mp4); render a draft first:
//   node render.mjs job.json  with  {"mode":"video","story":"videos/<slug>/story.json","composition":"video-<slug>","preview":true,"sound":false,"out":"<slug>/draft.mp4"}
// Exit code 1 when a limit is broken (the styleReport prints the same numbers as a flag; ian decides).
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const W = 54, H = 96;

/** The frames of a raw gray buffer, each cut to the rows of `region` (shares of the height, 0..1). */
export function framesOf(buf, region = [0, 1], w = W, h = H) {
  const size = w * h, n = Math.floor(buf.length / size), r0 = Math.round(region[0] * h) * w, r1 = Math.round(region[1] * h) * w, out = [];
  for (let f = 0; f < n; f++) out.push(buf.subarray(f * size + r0, f * size + r1));
  return out;
}
const meanDiff = (a, b) => { let sum = 0; for (let i = 0; i < a.length; i++) sum += Math.abs(a[i] - b[i]); return sum / a.length; };
/** The mean absolute difference between each frame and the one before it: out[k] is the change between sample k and k + 1. Pure: the tests feed it made-up frames. */
export const frameDiffs = (frames) => frames.slice(1).map((f, k) => meanDiff(f, frames[k]));
/** The new things: the times (seconds) at which the picture differs from the anchor by more than `eps`; each becomes the new anchor. */
export function newEvents(frames, fps, eps) {
  const out = [];
  let anchor = frames[0];
  frames.forEach((f, k) => { if (k > 0 && meanDiff(f, anchor) > eps) { out.push(k / fps); anchor = f; } });
  return out;
}

/** The measure from the differences and the events: the longest still stretch and the longest gap without something new, in seconds, and where they are. */
export function densityOf(diffs, events, fps, { moveEps }) {
  const dt = 1 / fps, total = (diffs.length + 1) * dt;
  let still = { len: 0, at: 0 }, run = 0, runAt = 0;
  diffs.forEach((d, k) => {
    if (d < moveEps) { if (run === 0) runAt = k * dt; run++; if (run * dt > still.len) still = { len: run * dt, at: runAt }; } else run = 0;
  });
  const merged = events;
  const marks = [0, ...merged, total];
  let gap = { len: 0, at: 0 };
  for (let i = 1; i < marks.length; i++) if (marks[i] - marks[i - 1] > gap.len) gap = { len: marks[i] - marks[i - 1], at: marks[i - 1] };
  const movingShare = diffs.filter((d) => d >= moveEps).length / Math.max(1, diffs.length);
  return { seconds: total, still, newGap: gap, events: merged.length, newPerMinute: (merged.length / total) * 60, movingShare };
}

/** Reads the picture of a video with ffmpeg: grey 54 x 96 frames at `fps` a second. */
export function readFrames(file, fps) {
  const r = spawnSync("ffmpeg", ["-v", "error", "-i", file, "-vf", `fps=${fps},scale=${W}:${H}:flags=area,format=gray`, "-f", "rawvideo", "-pix_fmt", "gray", "pipe:1"], { maxBuffer: 1 << 29 });
  if (r.status !== 0) throw new Error(`ffmpeg could not read ${file}: ${String(r.stderr)}`);
  return r.stdout;
}

/** Finds the video of a slug: the newest mp4 in out/<slug>/ or out/density/ that starts with the slug. */
export function findVideo(arg) {
  if (existsSync(arg) && statSync(arg).isFile()) return arg;
  const dirs = [path.join(ROOT, "out", arg), path.join(ROOT, "out", "density")];
  const found = dirs.filter(existsSync).flatMap((d) => readdirSync(d).filter((f) => f.endsWith(".mp4") && (d.endsWith("density") ? f.startsWith(arg) : true)).map((f) => path.join(d, f)));
  found.sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
  return found[0] ?? null;
}

export function measure(file) {
  const { DENSITY } = awaitedLang;
  const frames = framesOf(readFrames(file, DENSITY.sampleFps), DENSITY.region);
  const diffs = frameDiffs(frames), events = newEvents(frames, DENSITY.sampleFps, DENSITY.newEps);
  return { file, ...densityOf(diffs, events, DENSITY.sampleFps, DENSITY), limits: DENSITY, diffs };
}

const awaitedLang = await import(pathToFileURL(path.join(ROOT, "src", "motionLanguage.ts")).href);

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const arg = process.argv[2];
  if (!arg) { console.error("usage: node scripts/motionDensity.mjs <video.mp4 | slug> [--json]"); process.exit(2); }
  const file = findVideo(arg);
  if (!file) { console.error(`no video for "${arg}": render a draft first (see the top of scripts/motionDensity.mjs)`); process.exit(2); }
  const m = measure(file);
  const okStill = m.still.len <= m.limits.aliveMax + 1e-9, okNew = m.newGap.len <= m.limits.newMax + 1e-9;
  if (process.argv.includes("--json")) {
    const { diffs, ...rest } = m;
    console.log(JSON.stringify({ ...rest, okStill, okNew }));
  } else {
    console.log(`motion density: ${path.relative(ROOT, file)} (${m.seconds.toFixed(1)} s)`);
    console.log(`${okStill ? "PASS" : "FLAG"}   something moves about every second: the longest still stretch is ${m.still.len.toFixed(2)} s at ${m.still.at.toFixed(1)} s (at most ${m.limits.aliveMax} s)`);
    console.log(`${okNew ? "PASS" : "FLAG"}   something new every 3 to 4 seconds: the longest gap is ${m.newGap.len.toFixed(2)} s from ${m.newGap.at.toFixed(1)} s (at most ${m.limits.newMax} s); ${m.events} new things, ${m.newPerMinute.toFixed(1)} a minute`);
    console.log(`INFO   the picture moves in ${(m.movingShare * 100).toFixed(0)} % of the moments`);
  }
  process.exit(okStill && okNew ? 0 : 1);
}
