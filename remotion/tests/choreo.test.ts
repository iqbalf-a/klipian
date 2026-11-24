/* B55: the choreography layer. A planted foot never moves, a lifted foot is above the ground, the hip never leaves what the legs can reach, the sampler never overshoots. */
import assert from "node:assert/strict";
import { camTrack, choreoAt, footTrack, legIK, legLen, sampler, strides, warpTable, slowAround, type Choreo } from "../src/ricks/choreo.ts";

const s = sampler([[0, 0], [1, 1], [2, 1], [3, 4]]);
for (let t = 0; t <= 3; t += 0.01) { assert.ok(s(t) >= -1e-9 && s(t) <= 4 + 1e-9); if (t >= 1 && t <= 2) assert.ok(Math.abs(s(t) - 1) < 1e-9, "flat between equal keys"); }
assert.ok(Math.abs(s(1) - 1) < 1e-9);

const { thigh, shin } = legLen(1.7);
const k = legIK([0, 0.45], [0.1, 0], thigh, shin);
assert.ok(Math.abs(Math.hypot(k.knee[0], k.knee[1] - 0.45) - thigh) < 1e-9 && Math.abs(Math.hypot(k.knee[0] - 0.1, k.knee[1]) - shin) < 1e-9, "bones keep their length");
assert.ok(k.knee[0] > 0.05, "the knee bends forward");

const st = strides(0, -0.1, 6, 0.5, 0.2, 0.3);
const c: Choreo = { footR: footTrack(0, st.r), footL: footTrack(-0.1, st.l), hipFrac: sampler([[0, 0.97], [2, 0.97]]), lean: sampler([[0, 5], [2, 5]]),
  rSh: sampler([[0, 0], [2, 0]]), rEl: sampler([[0, 0], [2, 0]]), lSh: sampler([[0, 0], [2, 0]]), lEl: sampler([[0, 0], [2, 0]]) };
for (let t = 0; t <= 2.2; t += 1 / 60) {
  const o = choreoAt(c, t);
  for (const f of [o.feet.r, o.feet.l]) assert.ok(f[1] >= -1e-9);
  assert.ok(o.pose.rKn > -1 && o.pose.lKn > -1, "knees never bend backward");
}
// a foot that is not moving is the same x on both sides of a time where the other foot moves
const a = choreoAt(c, 0.25).feet.l[0], b = choreoAt(c, 0.45).feet.l[0];
assert.equal(a, b, "the planted left foot does not slide while the right steps");
assert.ok(choreoAt(c, 0.35).feet.r[1] > 0.05, "the stepping foot is lifted");

const w = warpTable(slowAround(2, 0.7), 4, 30);
assert.ok(w(1) > 0.99 && w(1) < 1.01);
assert.ok(w(3) - w(2.5) < 0.5, "slower around the hit");
const ct = camTrack([[0, 0, 1, 5, 0, 1, 0], [1, 2, 1, 5, 2, 1, 0]]);
assert.deepEqual(ct(0.5).pos, [1, 1, 5]);
console.log("choreo ok");
// locomote: the hip follows the path, a planted foot never moves, the hip never leaves what the legs reach
import { locomote } from "../src/ricks/choreo.ts";
for (const kind of ["walk", "jog"] as const) {
  const hip = (t: number) => 1.1 * Math.min(t, 4), L = locomote(hip, 0, 4, kind, 0.2);
  const { thigh, shin } = legLen(1.7);
  let prev = choreoAt(L, 0), still = 0;
  for (let t = 1 / 60; t <= 4.6; t += 1 / 60) {
    const o = choreoAt(L, t);
    for (const k of ["r", "l"] as const) {
      const dx = o.feet[k][0] - prev.feet[k][0], dy = o.feet[k][1];
      if (dy === 0 && prev.feet[k][1] === 0) { still++; assert.ok(Math.abs(dx) < 1e-9, `${kind}: a planted foot slid ${dx} at ${t}`); }
      assert.ok(Math.hypot(o.feet[k][0] - o.x, 0) < thigh + shin + 1e-6, `${kind}: foot out of reach at ${t}`);
    }
    prev = o;
  }
  assert.ok(still > 50, `${kind}: feet are planted part of the time`);
  assert.ok(Math.abs(choreoAt(L, 2).x - 2.2) < 1e-9, "the hip x is the path");
}
console.log("locomote ok");
