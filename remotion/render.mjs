// node render.mjs <job.json>
//
// The one entry point klipian (Python) will call: it reads a job, validates the story, bundles the template (cached by a hash of
// src/), renders a still or the whole video, and reports on stdout as JSON lines, one per line:
//   {"type":"progress","stage":"browser"|"bundle"|"render","pct":0..100, ...}
//   {"type":"timing","stage":"bundle","ms":..,"cached":true|false}
//   {"type":"done","out":"<path>","bytes":..,"ms":..}
//   {"type":"error","message":"...","cancelled":true|false}
// Job: { "mode": "still" | "video", "story": "stories/x.json", "out": "name.mp4" (inside out/),
//        "frame": 120 | "beat": "lensa" (+ "at": 0.85) for a still, "concurrency": 4 (optional) }
// Cancel: SIGINT/SIGTERM/SIGBREAK, or a line "cancel" on stdin (Windows cannot deliver SIGTERM), is passed to Remotion's cancel signal.
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { bundle } from "@remotion/bundler";
import { ensureBrowser, makeCancelSignal, renderMedia, renderStill, selectComposition } from "@remotion/renderer";
import { validateStory } from "./src/schema.ts";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(ROOT, "out");
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

/** A hash of everything the bundle is made of: src/, the fonts and the default story, and the pinned packages. */
function bundleHash() {
  const h = createHash("sha1");
  for (const dir of ["src", "public", "stories"]) {
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

async function main() {
  const jobFile = process.argv[2];
  if (!jobFile) fail("usage: node render.mjs <job.json>");
  let job;
  try { job = JSON.parse(readFileSync(path.resolve(jobFile), "utf8")); } catch (e) { fail(`cannot read the job: ${e.message}`); }
  if (!["still", "video"].includes(job.mode)) fail('the job needs "mode": "still" or "video"');
  let raw;
  try { raw = JSON.parse(readFileSync(path.resolve(path.dirname(path.resolve(jobFile)), String(job.story)), "utf8")); }
  catch { try { raw = JSON.parse(readFileSync(path.resolve(ROOT, String(job.story)), "utf8")); } catch (e) { fail(`cannot read the story: ${e.message}`); } }
  const checked = validateStory(raw);
  if (!checked.ok) fail("the story is not valid", { errors: checked.errors });
  const story = checked.story;
  const t0 = Date.now();

  progress("browser", 0);
  await ensureBrowser({ onBrowserDownload: () => ({ onProgress: ({ percent }) => progress("browser", percent * 100) }) });
  const serveUrl = await getBundle();
  if (cancelled) fail("cancelled");
  const composition = await selectComposition({ serveUrl, id: "FunFact", inputProps: { story }, logLevel: "error" });

  if (job.mode === "still") {
    let frame = job.frame;
    if (frame === undefined && job.beat) {
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
    await renderStill({ composition, serveUrl, output: out, frame, inputProps: { story }, imageFormat: "png", cancelSignal, logLevel: "error" });
    emit({ type: "done", out, bytes: statSync(out).size, ms: Date.now() - t0, frame });
    return;
  }

  const out = resolveOut(job, "mp4");
  await renderMedia({
    composition, serveUrl, outputLocation: out, codec: "h264", inputProps: { story },
    muted: true,                                           // the voice and the sounds come later (P28-C)
    concurrency: job.concurrency ?? null,
    cancelSignal, logLevel: "error",
    onProgress: ({ progress: p, renderedFrames, encodedFrames }) => progress("render", p * 100, { renderedFrames, encodedFrames, total: composition.durationInFrames }),
  });
  progress("render", 100, { total: composition.durationInFrames });
  emit({ type: "done", out, bytes: statSync(out).size, ms: Date.now() - t0, frames: composition.durationInFrames });
}

main().then(() => process.exit(0)).catch((e) => {
  const msg = String(e?.message ?? e);
  if (cancelled || /cancel/i.test(msg)) { cancelled = true; fail("cancelled"); }
  fail(msg);
});
