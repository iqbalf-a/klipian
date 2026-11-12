// node scripts/loopProbe.mjs [multi | 56,58.5 | 62.3 | x1.038] [composition...]   (default: multi, every custom video)
// Loop check for a VOICED video (DESIGN.md B29): the story's beats are stretched so they add up to <total> seconds (sting and outro keep their length),
// then the first and the last frame are rendered and compared (PSNR, the caption band y >= 1500 left out). Above about 35 dB the loop-back is clean.
// Stills go to out/loop-probe/<id>-first.png and -last.png.
import path from "node:path";
import { mkdirSync, readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
// First argument: "multi" (the default, several lengths round the video's base: a voice makes any length, so one length proves nothing), "56,58.5" (a list) or one length.
const [first0, ...ids] = process.argv.slice(2);
const total = first0 || "multi";
const list = ids.length ? ids : readdirSync(path.join(ROOT, "videos")).filter((id) => id !== "selftest-tiny");
const serveUrl = await bundle({ entryPoint: path.join(ROOT, "src", "index.ts"), publicDir: path.join(ROOT, "public") });
const chromiumOptions = { gl: "angle" };
const dir = path.join(ROOT, "out", "loop-probe");
mkdirSync(dir, { recursive: true });

const stretch = (story, target) => {
  const fixed = story.beats.filter((b) => b.kind === "sting" || b.kind === "outro").reduce((a, b) => a + b.dur, 0);
  const free = story.beats.reduce((a, b) => a + b.dur, 0) - fixed, k = (Number(target) - fixed) / free;
  return { ...story, beats: story.beats.map((b) => (b.kind === "sting" || b.kind === "outro" ? b : { ...b, dur: Math.round(b.dur * k * 100) / 100 })) };
};

for (const id of list) {
  try {
    const own = await selectComposition({ serveUrl, id: `video-${id}`, chromiumOptions, logLevel: "error" }), v = { story: own.props.story };
    const target = String(total).startsWith("x") ? Number(String(total).slice(1)) * v.story.duration : total;
    const inputProps = { story: stretch(v.story, target) };
    const composition = await selectComposition({ serveUrl, id: `video-${id}`, inputProps, chromiumOptions, logLevel: "error" });
    const first = path.join(dir, `${id}-first.png`), last = path.join(dir, `${id}-last.png`);
    for (const [frame, output] of [[0, first], [composition.durationInFrames - 1, last]]) {
      await renderStill({ composition, serveUrl, output, frame, inputProps, chromiumOptions, imageFormat: "png", logLevel: "error", timeoutInMilliseconds: 120000 });
    }
    const r = spawnSync("ffmpeg", ["-hide_banner", "-i", first, "-i", last, "-lavfi", "[0]crop=1080:1500:0:0[a];[1]crop=1080:1500:0:0[b];[a][b]psnr", "-f", "null", "-"], { encoding: "utf8" });
    const m = /average:([\d.inf]+)/.exec(r.stderr || "");
    console.log(`${id}\t${composition.durationInFrames / composition.fps}s\t${m ? m[1] : "?"} dB`);
  } catch (e) { console.log(`${id}\tERROR ${String(e.message).split("\n")[0]}`); }
}
