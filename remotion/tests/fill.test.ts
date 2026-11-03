/* The fill measure (DESIGN.md B27.3, scripts/fill.mjs): `npm test`. A made-up picture, half of it the brand wall colour, reads about 50 %; the region leaves the top text and the caption rows out. */
import assert from "node:assert/strict";
// @ts-expect-error the script is plain JS
import { fillOf, fillPerBeat } from "../scripts/fill.mjs";

const W = 20, H = 40, wall = [238, 236, 230], other = [60, 60, 60];
const img = (fn: (x: number, y: number) => number[]) => { const b = new Uint8Array(W * H * 3); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) b.set(fn(x, y), (y * W + x) * 3); return b; };
const half = img((x) => (x < W / 2 ? wall : other));
assert.ok(Math.abs(fillOf(half, W, H, [0.2, 0.8], [wall]) - 0.5) < 0.01, "half wall colour is about 50 %");
assert.equal(fillOf(half, W, H, [0.2, 0.8], [wall], 3), fillOf(img((x) => (x < W / 2 ? [239, 235, 231] : other)), W, H, [0.2, 0.8], [wall], 3), "a colour one level off still counts");
assert.equal(fillOf(img(() => other), W, H, [0, 1], [wall]), 0, "no wall colour is 0 %");
// the rows outside the region do not count: wall only in the top 20 % of the picture
assert.equal(fillOf(img((_, y) => (y < H * 0.2 ? wall : other)), W, H, [0.21, 0.76], [wall]), 0, "the top text rows are not read");
// per beat: sting and dark (lens) frames are skipped, the median of the light ones is taken
const frames = [half, half, half, half, img(() => [20, 20, 20]), img(() => [20, 20, 20])];
const rows = fillPerBeat(frames, [{ id: "a", kind: "hook", dur: 2 }, { id: "b", kind: "lens", dur: 1 }], [wall], [0.2, 0.8], W, H, 2);
assert.ok(Math.abs(rows[0].fill - 0.5) < 0.01 && rows[1].fill === null, "a beat of dark frames is not measured");
console.log("fill.test: ok");
