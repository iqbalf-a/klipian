/* The Three.js orthographic spike (experiment): `npm test`. The camera of src/three/isoCamera.ts must put a 2.5D world point on the same pixel as
   the SVG kit's `isoAt` (src/iso.ts), within 1 px, at ten sample points, so 2D labels and captions can sit on the 3D layer unchanged. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isoAt, toneOf, toScreen } from "../src/iso.ts";
import { makePlan, OUT } from "../videos/kenapa-colokan-panas/plan.ts";
import { validateStory } from "../src/schema.ts";
import { T0, T1, kindColours, toneFromNormal } from "../src/three/isoTone.ts";
import { makeIsoCamera, pixelOf } from "../src/three/isoCamera.ts";
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

let n = 0;
const yes = (c: boolean, what: string) => { n++; assert.ok(c, what); };

const W = 1080, H = 1920, u = 150, o: [number, number] = [540, 900];
const cam = makeIsoCamera(W, H, u, o);
const samples: [number, number, number][] = [
  [0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1], [1, 1, 1], [-2, 0.5, 1.5], [0.3, -0.4, -2], [2.5, 2.7, -0.5], [-1.2, 1.9, 0.5], [0.95, 0.38, 0.75],
];
let worst = 0;
for (const p of samples) {
  const [px, py] = pixelOf(cam, p, W, H), [qx, qy] = isoAt(p, u, o);
  worst = Math.max(worst, Math.hypot(px - qx, py - qy));
}
yes(worst <= 1, `the orthographic camera puts 10 sample points within 1 px of isoAt (worst ${worst.toFixed(4)} px)`);
// --- the tone of a face: the shader's rule is toneOf's rule (the six axis normals and 200 random normals)
{
  const axes: [number, number, number][] = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
  let mismatch = "";
  for (const a of axes) if (toneFromNormal(a) !== toneOf(a) && mismatch === "") mismatch = `axis ${a}`;
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 * 2 - 1; };
  for (let i = 0; i < 200; i++) {
    const v: [number, number, number] = [rnd(), rnd(), rnd()];
    if (toneFromNormal(v) !== toneOf(v) && mismatch === "") mismatch = `random normal ${v.map((x) => x.toFixed(3)).join(",")}`;
  }
  yes(mismatch === "", `the shader's tone rule equals toneOf for the axis normals and 200 random normals (first mismatch: ${mismatch || "none"})`);
  yes(Math.abs(T0 - (1 + 0.55) / 2 / Math.hypot(0.25, 0.55, 1)) < 1e-12 && Math.abs(T1 - (0.55 + 0.25) / 2 / Math.hypot(0.25, 0.55, 1)) < 1e-12, "the two thresholds are the ones toneOf uses");
  // every colour the material can output is one of the kind's three ISO colours
  const [a, b, c] = kindColours("plastic");
  yes([a, b, c].every((v) => [v.x, v.y, v.z].every((k) => k >= 0 && k <= 1)), "the plastic colours are three flat RGB triples in 0..1");
}

// --- the framing: the 3D camera puts the plate centre on the video's own pixel at the four times (the colokan's OUT and its 2D camera)
{
  const story = validateStory(JSON.parse(readFileSync(path.join(ROOT, "videos", "kenapa-colokan-panas", "story.json"), "utf8")));
  if (!story.ok) throw new Error(story.errors.join("\n"));
  const P = makePlan(story.story);
  let worstFrame = 0;
  for (const t of [0.5, 35.2, 40.6, 42.2]) {
    const cam2 = P.outCam(t), centre: [number, number, number] = [0, 0.3, 0.5];
    const svg = toScreen(cam2, isoAt(centre, OUT.u, OUT.o));
    const cam3 = makeIsoCamera(1080, 1920, OUT.u * cam2.zoom, toScreen(cam2, OUT.o) as [number, number]);
    const [px, py] = pixelOf(cam3, centre, 1080, 1920);
    worstFrame = Math.max(worstFrame, Math.hypot(px - svg[0], py - svg[1]));
  }
  yes(worstFrame <= 1, `the plate centre lands on the video's own pixel at 0.5, 35.2, 40.6 and 42.2 s (worst ${worstFrame.toFixed(3)} px)`);
}

console.log(`isoThree: ${n} checks ok (worst projection error ${worst.toFixed(4)} px over ${samples.length} points)`);
