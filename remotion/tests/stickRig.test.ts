/* The ricks stick cast's skeleton (B52): joint maths, reach, easing and the real activity poses stay inside the 512 px canvas and the hands go where the action needs them. */
import assert from "node:assert/strict";
import { MOVING, POSES, arm, gait, handOffset, leg, poseAt, reach, rot, shovelDeg, spring } from "../src/ricks/rig.ts";

let n = 0;
const yes = (c: boolean, what: string) => { n++; assert.ok(c, what); };
const near = (a: number, b: number, e: number, what: string) => yes(Math.abs(a - b) <= e, `${what}: ${a} vs ${b}`);

// spring: starts at 0, ends at 1, overshoots on the way
near(spring(0), 0, 1e-9, "spring start"); near(spring(1), 1, 1e-9, "spring end");
yes(Math.max(...Array.from({ length: 50 }, (_, i) => spring(i / 50))) > 1.02, "spring overshoots");
// poseAt blends two named poses and lands on the second
near(poseAt([[0, "down"], [1, "up"]], 5, 0.3).rSh, POSES.up.rSh, 1e-6, "poseAt lands");
yes(poseAt([[0, "down"], [1, "up"]], 1.05, 0.3).rSh > POSES.down.rSh, "poseAt in between");
// reach puts the hand where it is asked (inside the arm's range), leaned or not
for (const lean of [0, 14, 24]) for (const side of ["l", "r"] as const) {
  const hit = arm({ ...POSES.down, lean }, side)[2], q = reach(side, hit.x - 4, hit.y - 6, lean), p = { ...POSES.down, lean, [side === "l" ? "lSh" : "rSh"]: q.sh, [side === "l" ? "lEl" : "rEl"]: q.el };
  const h = arm(p, side)[2];
  near(h.x, hit.x - 4, 3, `reach x ${side} ${lean}`); near(h.y, hit.y - 6, 3, `reach y ${side} ${lean}`);
}
// a walk: the legs alternate and the lifted foot rises (a knee folds only on the swinging leg)
const w1 = gait(POSES.down, 0.4), w2 = gait(POSES.down, 0.4 + Math.PI);
yes(w1.lHip * w2.lHip < 0, "legs swing opposite ways");
yes(leg(w1, "l")[2].y !== leg(w1, "r")[2].y, "one foot is lifted");
// the real activities stay in the canvas: every hand and elbow is inside 0..512 (a small stroke margin) and above the ground, over a whole cycle
for (const name of ["shoot", "dig", "bowl"]) for (let t = 0; t < 2.7; t += 0.05) {
  const p = MOVING[name](t);
  for (const side of ["l", "r"] as const) for (const pt of arm(p, side)) yes(pt.x > -12 && pt.x < 522 && pt.y < 1000, `${name} ${t.toFixed(2)} ${side} inside the canvas (${pt.x.toFixed(0)},${pt.y.toFixed(0)})`);
  const hd = rot({ x: 256, y: 260 }, p.lean ?? 0);
  yes(hd.x + 170 < 512 && hd.x - 170 > 0, `${name} ${t.toFixed(2)} head (and hat) inside the canvas`);
}
// shooting: both hands close together (one gun), forward of the body, at chest height; digging: hands near each other on the handle
const sh = MOVING.shoot(0), shr = arm(sh, "r")[2], shl = arm(sh, "l")[2];
yes(Math.hypot(shr.x - shl.x, shr.y - shl.y) < 60 && shr.x > 330 && shr.y > 430 && shr.y < 620, "shoot: two hands on the gun at chest height");
for (let t = 0; t < 1.9; t += 0.1) { const d = MOVING.dig(t), a = arm(d, "r")[2], b = arm(d, "l")[2]; yes(Math.hypot(a.x - b.x, a.y - b.y) < 90, `dig ${t.toFixed(1)}: hands on one handle`); }
// the shovel blade goes down into the soil (handle near vertical) and then swings out and up
yes(shovelDeg(0.28 * 1.9) < 30 && shovelDeg(0.8 * 1.9) > 90, "shovel: pressed in then swung out");
// handOffset: hands are in front of the body for a shoot, and metres scale with the height
yes(handOffset(sh, "r", 1.7).x > 0.1 && handOffset(sh, "r", 3.4).x > handOffset(sh, "r", 1.7).x, "handOffset scales and points forward");
console.log(`stickRig.test.ts: ${n} checks passed`);
