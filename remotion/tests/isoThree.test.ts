/* The Three.js orthographic spike (experiment): `npm test`. The camera of src/three/isoCamera.ts must put a 2.5D world point on the same pixel as
   the SVG kit's `isoAt` (src/iso.ts), within 1 px, at ten sample points, so 2D labels and captions can sit on the 3D layer unchanged. */
import assert from "node:assert/strict";
import { isoAt } from "../src/iso.ts";
import { makeIsoCamera, pixelOf } from "../src/three/isoCamera.ts";

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
console.log(`isoThree: ${n} checks ok (worst projection error ${worst.toFixed(4)} px over ${samples.length} points)`);
