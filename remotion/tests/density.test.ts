/* The motion density measure (DESIGN.md B25, scripts/motionDensity.mjs): `npm test`. The pure parts, fed with made-up frames: a still picture is one long still
   stretch with nothing new; a picture that drifts a little moves all the time but brings nothing new; a picture that changes composition every 3 seconds passes both
   limits; the caption band is outside the region that is read. */
import assert from "node:assert/strict";
import { DENSITY } from "../src/motionLanguage.ts";
// @ts-expect-error the script is plain JS
import { densityOf, frameDiffs, framesOf, newEvents } from "../scripts/motionDensity.mjs";

let n = 0;
const yes = (c: boolean, what: string) => { n++; assert.ok(c, what); };
const W = 54, H = 96, FPS = DENSITY.sampleFps;
const frame = (fn: (x: number, y: number) => number) => { const b = new Uint8Array(W * H); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) b[y * W + x] = Math.max(0, Math.min(255, fn(x, y))); return b; };
const measure = (frames: Uint8Array[]) => { const f = frames.map((b) => b.subarray(0, W * H)); const d = frameDiffs(f), ev = newEvents(f, FPS, DENSITY.newEps); return densityOf(d, ev, FPS, DENSITY); };
const seconds = 12, count = seconds * FPS;

// a picture that never changes
const still = measure(Array.from({ length: count }, () => frame(() => 100)));
yes(still.still.len >= seconds - 0.5, `a still picture is one long still stretch (${still.still.len.toFixed(2)} s)`);
yes(still.newGap.len >= seconds - 0.5 && still.events === 0, "a still picture brings nothing new");

// a picture that drifts a little all the time (a small moving thing): it moves, nothing is new
const drift = measure(Array.from({ length: count }, (_, k) => frame((x, y) => 100 + (Math.abs(x - (4 + ((k * 2) % 44))) < 4 && Math.abs(y - 40) < 4 ? 60 : 0))));
yes(drift.still.len <= DENSITY.aliveMax, `a small moving thing keeps the picture alive (longest still ${drift.still.len.toFixed(2)} s)`);
yes(drift.newGap.len > DENSITY.newMax, `but a small moving thing is not something new (longest gap ${drift.newGap.len.toFixed(2)} s)`);

// a picture whose composition changes every 3 seconds and moves a little between: both limits hold
const scenes = measure(Array.from({ length: count }, (_, k) => { const s = Math.floor(k / (3 * FPS)); return frame((x, y) => (s % 2 ? (x < 27 ? 40 : 200) : (y < 48 ? 200 : 40)) + (k % 2) * 2); }));
yes(scenes.still.len <= DENSITY.aliveMax, "scenes that jitter a little never rest");
yes(scenes.newGap.len <= DENSITY.newMax, `a new composition every 3 s keeps the gap under ${DENSITY.newMax} s (${scenes.newGap.len.toFixed(2)} s)`);
yes(scenes.events >= 3, `the scene changes are counted as new things (${scenes.events})`);

// the region: the caption band is not read, so a caption that changes every moment is not movement
const captions = Array.from({ length: count }, (_, k) => frame((x, y) => (y > 0.8 * H ? (k % 2 ? 250 : 0) : 100)));
yes(measure(framesOf(Buffer.concat(captions), DENSITY.region, W, H) as never).still.len >= seconds - 0.5, "a changing caption band outside the region is not movement");
yes(DENSITY.region[0] > 0.15 && DENSITY.region[1] < 0.8, "the region leaves out the top text and the caption band");

console.log(`density: ${n} checks ok`);
