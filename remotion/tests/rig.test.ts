/* The camera rig (src/three/rigMath.ts): `npm test`. */
import assert from "node:assert/strict";
import { REST_VIEW, cameraFromView, shots, speedAt, viewAt, type Shot } from "../src/three/rigMath.ts";

let n = 0;
const yes = (c: boolean, what: string) => { n++; assert.ok(c, what); };
const near = (a: number, b: number, tol: number, what: string) => yes(Math.abs(a - b) <= tol, `${what}: ${a} vs ${b}`);

const rest = cameraFromView(REST_VIEW);
near(rest.position[0], 0, 1e-9, "the rest view looks straight on (x)");
near(rest.position[2], REST_VIEW.dist, 1e-6, "from the distance Placed relies on (z)");
near(REST_VIEW.dist, 1920 / (2 * 100 * Math.tan((20 * Math.PI) / 360)), 1e-6, "which is where 100 video pixels are 1 world unit");

const list: Shot[] = [shots.push(1, 3, 0.5), shots.orbit(3, 5, 40, 10), shots.dolly(5, 7, [4, -2, 0], 0.3), shots.macro(7, 8, [4, -2, 1])];
const v0 = viewAt(list, 0), v1 = viewAt(list, 1), v2 = viewAt(list, 2), v3 = viewAt(list, 3);
yes(JSON.stringify(v0) === JSON.stringify(REST_VIEW) && JSON.stringify(v1) === JSON.stringify(REST_VIEW), "before the first shot the camera is at rest");
near(v2.dist, REST_VIEW.dist * 0.75, 1e-6, "halfway through a push, an in-out ease puts the camera at the midpoint");
near(v3.dist, REST_VIEW.dist * 0.5, 1e-9, "at the end of a push it is where it was told");
yes(v2.dist < REST_VIEW.dist && v2.dist > v3.dist, "and it was between");
const o = viewAt(list, 5);
near(o.yaw, 40, 1e-9, "an orbit ends at its angle");
near(o.dist, REST_VIEW.dist * 0.5, 1e-9, "and keeps the distance the push left");
near(viewAt(list, 4).yaw, 20, 1e-6, "halfway through the orbit it has turned half way");
const d = viewAt(list, 7);
yes(d.target[0] === 4 && d.target[1] === -2 && Math.abs(d.dist - REST_VIEW.dist * 0.3) < 1e-9 && d.yaw === 40, "a dolly moves the target and the distance; what it does not name stays (the angle)");
const m = viewAt(list, 8);
near(m.dist, REST_VIEW.dist * 0.18, 1e-9, "a macro is very close");
yes(viewAt(list, 99).dist === m.dist && viewAt(list, 99).yaw === 40, "after the last shot the camera stays");

// no jump where one shot hands over to the next (the views just before and after agree)
for (const t of [3, 5, 7]) {
  const a = viewAt(list, t - 1e-6), b = viewAt(list, t + 1e-6);
  yes(Math.abs(a.dist - b.dist) < 1e-3 && Math.abs(a.yaw - b.yaw) < 1e-3 && Math.abs(a.target[0] - b.target[0]) < 1e-3, `no jump at ${t} s`);
}
// an orbit stays on a sphere round its target
for (const t of [3.5, 4, 4.5]) {
  const v = viewAt(list, t), c = cameraFromView(v);
  near(Math.hypot(c.position[0] - v.target[0], c.position[1] - v.target[1], c.position[2] - v.target[2]), v.dist, 1e-6, `the camera is ${v.dist.toFixed(1)} from its target at ${t} s`);
}
yes(speedAt(list, 2) > speedAt(list, 0.5) && speedAt(list, 0.5) === 0, "the speed is high in a push and zero at rest (a scene can switch motion blur on)");
yes(JSON.stringify(viewAt([], 3)) === JSON.stringify(REST_VIEW), "no shots, no movement");
console.log(`rig: ${n} checks ok`);
