// node scripts/stingProbe.mjs [ids...]   a still of the "Intip yuk!" sting (0.9 s into the sting beat) of each video -> out/sting-probe/<id>.png, to see the pose against the hero.
import path from "node:path";
import { mkdirSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const ids = process.argv.slice(2);
const list = ids.length ? ids : readdirSync(path.join(ROOT, "videos")).filter((id) => id !== "selftest-tiny");
const serveUrl = await bundle({ entryPoint: path.join(ROOT, "src", "index.ts"), publicDir: path.join(ROOT, "public") });
const chromiumOptions = { gl: "angle" };
const dir = path.join(ROOT, "out", "sting-probe");
mkdirSync(dir, { recursive: true });
for (const id of list) {
  try {
    const composition = await selectComposition({ serveUrl, id: `video-${id}`, chromiumOptions, logLevel: "error" });
    const beats = composition.props.story.beats, i = beats.findIndex((b) => b.kind === "sting");
    const at = beats.slice(0, i).reduce((a, b) => a + b.dur, 0) + Math.min(Number(process.env.STING_AT ?? 0.9), beats[i].dur - 0.1);
    await renderStill({ composition, serveUrl, output: path.join(dir, `${id}.png`), frame: Math.round(at * composition.fps), chromiumOptions, imageFormat: "png", logLevel: "error", timeoutInMilliseconds: 120000 });
    console.log(id, at.toFixed(2));
  } catch (e) { console.log(id, "ERROR", String(e.message).split("\n")[0]); }
}
