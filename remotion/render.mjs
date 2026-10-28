// node render.mjs <job.json>
//
// The one entry point klipian (Python) will call: it reads a job, validates the story, bundles the template (cached by a hash of
// src/), renders a still or the whole video, and reports on stdout as JSON lines, one per line:
//   {"type":"progress","stage":"browser"|"bundle"|"render","pct":0..100, ...}
//   {"type":"timing","stage":"bundle","ms":..,"cached":true|false}
//   {"type":"done","out":"<path>","bytes":..,"ms":..}
//   {"type":"error","message":"...","cancelled":true|false}
// Job: { "mode": "still" | "video", "story": "stories/x.json", "out": "name.mp4" (inside out/),
//        "frame": 120 | "time": 4.5 (seconds) | "beat": "lensa" (+ "at": 0.85) for a still, "concurrency": 4 (optional),
//        "mode": "stills" renders one picture per beat into the folder "out" (<beat id>.png, "at": 0..1 of the beat); "outRoot": an absolute folder to write into instead of out/,
//        "voice": "<abs path of a 48 kHz WAV>" (the narration: mixed on top, effects and the story's music bed duck under it),
//        "sound": false (optional: no sound effects; default true: they are mixed from the story and muxed in as AAC),
//        "preview": true (optional: a draft of the video, half size and a faster encode; the same timing, sound included),
//        "composition": "FunFact" (default) | "Dissect3D" (no story), "gl": "angle" | "swangle" | "swiftshader" | "egl" | "vulkan" (optional) }
// Cancel: SIGINT/SIGTERM/SIGBREAK, or a line "cancel" on stdin (Windows cannot deliver SIGTERM), is passed to Remotion's cancel signal.
import { createHash } from "node:crypto";
import { createServer } from "node:net";
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { bundle } from "@remotion/bundler";
import { RenderInternals, ensureBrowser, makeCancelSignal, renderMedia, renderStill, selectComposition } from "@remotion/renderer";
import { validateStory } from "./src/schema.ts";
import { defaultBeatSfx, dissectSfx, formatTimeline, planSfx, storySfx } from "./src/sfx.ts";
import { totalFrames } from "./src/timeline.ts";
import { loadVoice, mixTrack } from "./sfx/mix.mjs";
import { writeWav } from "./sfx/wav.mjs";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
let OUT_DIR = path.join(ROOT, "out");                     // a job may name another root ("outRoot": klipian keeps its renders in the profile's folder)
const CACHE_DIR = path.join(ROOT, ".cache");
const FPS = 30;

const emit = (obj) => process.stdout.write(JSON.stringify(obj) + "\n");
let lastProgress = 0;
const progress = (stage, pct, extra = {}) => {
  const now = Date.now();
  if (pct < 100 && now - lastProgress < 250) return;      // about 4 lines a second
  lastProgress = now;
  emit({ type: "progress", stage, pct: Math.round(pct * 10) / 10, ...extra });
};

const { cancelSignal, cancel } = makeCancelSignal();
let cancelled = false;
const askCancel = () => { cancelled = true; cancel(); };
for (const sig of ["SIGINT", "SIGTERM", "SIGBREAK"]) process.on(sig, askCancel);
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => { if (/cancel/i.test(chunk)) askCancel(); });
process.stdin.on("error", () => {});
process.stdin.unref?.();

function fail(message, extra = {}) {
  emit({ type: "error", message, cancelled, ...extra });
  process.exit(cancelled ? 2 : 1);
}

function filesUnder(dir) {
  const out = [];
  for (const name of readdirSync(dir).sort()) {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) out.push(...filesUnder(p));
    else out.push(p);
  }
  return out;
}

/** A hash of everything the bundle is made of: src/, the custom videos, the fonts and the default story, and the pinned packages. */
function bundleHash() {
  const h = createHash("sha1");
  for (const dir of ["src", "videos", "public", "stories"]) {
    for (const f of filesUnder(path.join(ROOT, dir))) {
      h.update(path.relative(ROOT, f).replaceAll("\\", "/"));
      h.update(readFileSync(f));
    }
  }
  h.update(readFileSync(path.join(ROOT, "package.json")));
  return h.digest("hex").slice(0, 12);
}

async function getBundle() {
  const dir = path.join(CACHE_DIR, `bundle-${bundleHash()}`);
  const t0 = Date.now();
  if (existsSync(path.join(dir, "index.html"))) {
    emit({ type: "timing", stage: "bundle", ms: Date.now() - t0, cached: true });
    return dir;
  }
  mkdirSync(CACHE_DIR, { recursive: true });
  await bundle({
    entryPoint: path.join(ROOT, "src", "index.ts"),
    outDir: dir,
    publicDir: path.join(ROOT, "public"),
    onProgress: (pct) => progress("bundle", pct),
  });
  emit({ type: "timing", stage: "bundle", ms: Date.now() - t0, cached: false });
  return dir;
}

function resolveOut(job, ext) {
  mkdirSync(OUT_DIR, { recursive: true });
  const name = job.out || `${path.basename(String(job.story), ".json")}.${ext}`;
  const full = path.resolve(OUT_DIR, name);
  if (path.relative(OUT_DIR, full).startsWith("..") || path.isAbsolute(path.relative(OUT_DIR, full))) {
    fail(`the output must be inside ${OUT_DIR}`);
  }
  mkdirSync(path.dirname(full), { recursive: true });
  return full;
}

/** A free TCP port for the render server (asked of the OS), so the render never fights a Studio for 3000. */
const freePort = () => new Promise((resolve, reject) => {
  const srv = createServer();
  srv.once("error", reject);
  srv.listen(0, "127.0.0.1", () => { const { port } = srv.address(); srv.close(() => resolve(port)); });
});

/** The sound of a render: the template's from the story's motion words; a custom video's from its own videos/<slug>/sfx.ts (`export function sfx(story)`
    returning [{ t, name, vol, why }]), else the jingles and transitions of its beats. Dissect3D has its own. */
async function soundPlan(compId, story) {
  if (!story) return dissectSfx();
  if (compId === "FunFact") return storySfx(story);
  const mod = await videoSfx(compId);
  return planSfx(mod?.sfx ? mod.sfx(story) : defaultBeatSfx(story), totalFrames(story) / FPS);
}
/** A custom video's sfx.ts module, or null. It may also export `music` ({ track, level }): the bed used when the story names none. */
async function videoSfx(compId) {
  const file = path.join(ROOT, "videos", compId.replace(/^video-/, ""), "sfx.ts");
  return compId.startsWith("video-") && existsSync(file) ? import(pathToFileURL(file).href) : null;
}

/** Mixes the planned sound effects into a stereo track, writes it (and the event table) beside the video, and muxes it in as AAC. */
async function addSoundEffects(silent, out, plan, seconds, extras = {}) {
  const t0 = Date.now();
  const voice = extras.voice ? loadVoice(extras.voice, seconds) : null;       // the narration (a 48 kHz WAV klipian made on import), music bed and effects go under it
  const mixed = mixTrack(plan.events, seconds, { voice, music: extras.music ?? null });
  const wav = out.replace(/\.mp4$/, ".sfx.wav");
  writeWav(wav, mixed.channels, mixed.rate);
  writeFileSync(out.replace(/\.mp4$/, ".sfx.txt"), `${formatTimeline(plan)}
`);
  const ffmpeg = RenderInternals.getExecutablePath({ type: "ffmpeg", indent: false, logLevel: "error", binariesDirectory: null });
  await new Promise((resolve, reject) => {
    const p = spawn(ffmpeg, ["-y", "-v", "error", "-i", silent, "-i", wav, "-map", "0:v:0", "-map", "1:a:0", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-t", String(seconds), out], { stdio: ["ignore", "ignore", "pipe"] });
    let err = "";
    p.stderr.on("data", (d) => { err += d; });
    p.on("error", reject);
    p.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg failed: ${err.trim().slice(-300)}`))));
  });
  unlinkSync(silent);
  emit({ type: "audio", events: plan.events.length, dropped: plan.dropped.length, voice: !!voice, music: extras.music?.name ?? null, spoken: +mixed.segments.reduce((n, [a, b]) => n + (b - a), 0).toFixed(1), peak: +mixed.peak.toFixed(3), rms: +mixed.rms.toFixed(4), ms: Date.now() - t0 });
}

async function main() {
  const jobFile = process.argv[2];
  if (!jobFile) fail("usage: node render.mjs <job.json>");
  let job;
  try { job = JSON.parse(readFileSync(path.resolve(jobFile), "utf8")); } catch (e) { fail(`cannot read the job: ${e.message}`); }
  if (!["still", "stills", "video"].includes(job.mode)) fail('the job needs "mode": "still", "stills" (one picture per beat) or "video"');
  if (job.outRoot) OUT_DIR = path.resolve(String(job.outRoot));
  const compId = job.composition ?? "FunFact";
  let story = null;
  if (!["Dissect3D", "Models3D", "AssetSheet", "AssetSheetIso", "CardsDemo", "RigDemo", "IsoDemo", "IsoThreeDemo", "NatureDemo", "NatureSheet"].includes(compId)) {                    // FunFact and every custom video (video-<slug>) are made from a story
    let raw;
    try { raw = JSON.parse(readFileSync(path.resolve(path.dirname(path.resolve(jobFile)), String(job.story)), "utf8")); }
    catch { try { raw = JSON.parse(readFileSync(path.resolve(ROOT, String(job.story)), "utf8")); } catch (e) { fail(`cannot read the story: ${e.message}`); } }
    const checked = validateStory(raw);
    if (!checked.ok) fail("the story is not valid", { errors: checked.errors });
    story = checked.story;
  }
  const inputProps = { ...(story ? { story, ...(job.layout === false ? { layout: false } : {}), ...(job.layoutDebug ? { layoutDebug: true } : {}) } : {}), ...(job.props ?? {}) };   // "props": any extra props of the composition (e.g. {"look":"toon"})
  const port = await freePort();                          // never the default 3000: another project (a Studio) may be on it
  const chromiumOptions = { gl: job.gl ?? "angle" };       // the 3D layers need a GL backend; angle is the one that works headless here
  const t0 = Date.now();

  progress("browser", 0);
  await ensureBrowser({ onBrowserDownload: () => ({ onProgress: ({ percent }) => progress("browser", percent * 100) }) });
  const serveUrl = await getBundle();
  if (cancelled) fail("cancelled");
  const composition = await selectComposition({ serveUrl, id: compId, inputProps, chromiumOptions, port, logLevel: "error" });

  if (job.mode === "stills") {                             // one picture per beat of the story, into the folder `out` (named <beat id>.png)
    if (!story) fail("stills need a story");
    const dir = path.dirname(resolveOut({ out: path.join(String(job.out || "stills"), "x.png") }, "png"));
    const outs = [];
    let start = 0;
    for (const [i, b] of story.beats.entries()) {
      if (cancelled) fail("cancelled");
      const len = Math.round(b.dur * FPS), frame = start + Math.min(len - 1, Math.round(len * (job.at ?? 0.85)));
      start += len;
      const file = path.join(dir, `${b.id}.png`);
      await renderStill({ composition, serveUrl, output: file, frame, inputProps, chromiumOptions, port, imageFormat: "png", cancelSignal, logLevel: "error" });
      outs.push(file);
      progress("render", ((i + 1) / story.beats.length) * 100, { beat: b.id });
    }
    emit({ type: "done", out: dir, outs, ms: Date.now() - t0 });
    return;
  }

  if (job.mode === "still") {
    let frame = job.frame;
    if (frame === undefined && job.time !== undefined) frame = Math.round(job.time * FPS);
    if (frame === undefined && job.beat && story) {
      let start = 0;
      for (const b of story.beats) {
        const len = Math.round(b.dur * FPS);
        if (b.id === job.beat) { frame = start + Math.min(len - 1, Math.round(len * (job.at ?? 0.85))); break; }
        start += len;
      }
      if (frame === undefined) fail(`the story has no beat "${job.beat}"`);
    }
    if (!Number.isInteger(frame) || frame < 0 || frame >= composition.durationInFrames) fail(`frame must be 0..${composition.durationInFrames - 1}`);
    const out = resolveOut(job, "png");
    await renderStill({ composition, serveUrl, output: out, frame, inputProps, chromiumOptions, port, imageFormat: "png", cancelSignal, logLevel: "error" });
    emit({ type: "done", out, bytes: statSync(out).size, ms: Date.now() - t0, frame });
    return;
  }

  const out = resolveOut(job, "mp4");
  const withSound = job.sound !== false;                   // the picture is rendered silent; the sound effects are mixed from the story and muxed in after
  const silent = withSound ? out.replace(/\.mp4$/, ".silent.mp4") : out;
  await renderMedia({
    composition, serveUrl, outputLocation: silent, codec: "h264", inputProps, chromiumOptions, port,
    muted: true,                                           // the voice-over comes later (P28-C); the sound effects are added below
    concurrency: job.concurrency ?? null,
    ...(job.preview ? { scale: 0.5, crf: 30, x264Preset: "veryfast" } : {}),   // a draft: half size (540 by 960), a faster encode; the same frames and timing
    cancelSignal, logLevel: "error",
    onProgress: ({ progress: p, renderedFrames, encodedFrames }) => progress("render", p * 100, { renderedFrames, encodedFrames, total: composition.durationInFrames }),
  });
  progress("render", 100, { total: composition.durationInFrames });
  const bed = story?.music ?? (await videoSfx(compId))?.music ?? null;     // the story's bed wins; else the video's own choice
  if (withSound) await addSoundEffects(silent, out, await soundPlan(compId, story), composition.durationInFrames / composition.fps, { voice: job.voice, music: bed && bed.track !== "none" ? { name: bed.track, level: bed.level } : null });
  emit({ type: "done", out, bytes: statSync(out).size, ms: Date.now() - t0, frames: composition.durationInFrames });
}

main().then(() => process.exit(0)).catch((e) => {
  const msg = String(e?.message ?? e);
  if (cancelled || /cancel/i.test(msg)) { cancelled = true; fail("cancelled"); }
  fail(msg);
});
