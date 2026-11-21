// node scripts/ricksRender.mjs <slug> <voice.wav>      -> out/<slug>/<slug>.mp4
// The final render of a ricks video (B46): the voice converted to 48 kHz, the whole video rendered by render.mjs with that voice (the
// video's sfx.ts and music bed through the approved mix, B15), then one linear gain to about -14 LUFS (where Shorts play) with a
// -1 dBFS peak limiter, so the voice / bed / effects ratios stay as mixed. Prints the measured loudness.
import path from "node:path";
import { spawnSync } from "node:child_process";
import { mkdirSync, renameSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const run = (cmd, args) => { const r = spawnSync(cmd, args, { encoding: "utf8", cwd: ROOT, maxBuffer: 1 << 26 }); if (r.status !== 0) throw new Error(`${cmd} failed: ${(r.stderr || r.stdout).slice(-600)}`); return r; };
const lufsOf = (file) => Number([...run("ffmpeg", ["-v", "info", "-i", file, "-af", "ebur128", "-f", "null", "-"]).stderr.matchAll(/\bI:\s+(-?\d+(?:\.\d+)?)\s+LUFS/g)].pop()[1]);

/** Re-encodes the audio of `src` to about -14 LUFS (one linear gain + a -1 dBFS limiter) into `dst`; the picture is copied. */
export function toShortsLoudness(src, dst) {
  const before = lufsOf(src), gain = (-14 - before).toFixed(2);
  run("ffmpeg", ["-y", "-v", "error", "-i", src, "-map", "0:v:0", "-map", "0:a:0", "-c:v", "copy", "-af", `volume=${gain}dB,alimiter=limit=0.891:level=false`, "-c:a", "aac", "-b:a", "192k", "-ar", "48000", dst]);
  return { before, gain: +gain, after: lufsOf(dst) };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [slug, voice] = process.argv.slice(2);
  if (!slug || !voice) { console.error("usage: node scripts/ricksRender.mjs <slug> <voice.wav>"); process.exit(1); }
  const dir = path.join(ROOT, "out", slug);
  mkdirSync(dir, { recursive: true });
  const voice48 = path.join(dir, "voice48.wav");
  run("ffmpeg", ["-y", "-v", "error", "-i", path.resolve(voice), "-ar", "48000", "-ac", "1", voice48]);
  const job = path.join(dir, "job.json");
  writeFileSync(job, JSON.stringify({ mode: "video", story: `videos/${slug}/story.json`, composition: `video-${slug}`, voice: voice48, out: `${slug}/mixed.mp4` }));
  const r = run("node", ["render.mjs", job]);
  const err = r.stdout.split("\n").find((l) => l.includes('"type":"error"'));
  if (err) throw new Error(err);
  const mixed = path.join(dir, "mixed.mp4"), tmp = path.join(dir, "final.tmp.mp4"), out = path.join(dir, `${slug}.mp4`);
  const level = toShortsLoudness(mixed, tmp);
  renameSync(tmp, out);
  console.log(JSON.stringify({ out, lufsMixed: level.before, gainDb: level.gain, lufs: level.after }));
}
