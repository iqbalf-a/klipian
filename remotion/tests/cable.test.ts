/* The cable curve (src/cable.ts): `npm test`. Every corner of a route is rounded, so the curve has no kink; it hangs a little where it
   is long and horizontal; it starts and ends where the route does. */
import assert from "node:assert/strict";
import { cablePath, cableSamples, cableSegments, sharpestTurn, type Pt } from "../src/cable.ts";

let n = 0;
const yes = (cond: boolean, what: string) => { n++; assert.ok(cond, what); };
const near = (got: number, want: number, tol: number, what: string) => { n++; assert.ok(Math.abs(got - want) <= tol, `${what}: got ${got}, wanted ${want} +- ${tol}`); };

// the cable of the hook: down from the socket, round a corner onto the floor, along it, out of the frame (a right angle and a bend)
const hook: Pt[] = [[400, 1040], [400, 1470], [440, 1555], [560, 1590], [1180, 1590]];
const samples = cableSamples(hook, undefined, 6);
near(samples[0][0], 400, 1e-9, "it starts where the route starts (x)");
near(samples[0][1], 1040, 1e-9, "(y)");
near(samples[samples.length - 1][0], 1180, 1e-9, "it ends where the route ends (x)");
near(samples[samples.length - 1][1], 1590, 8, "(y, within the sag)");
yes(sharpestTurn(samples) < 6, `no sharp corner on the hook's cable: the sharpest step turns ${sharpestTurn(samples).toFixed(1)} degrees`);

// a plain right angle becomes a round bend, not a corner
const right: Pt[] = [[100, 100], [100, 700], [700, 700]];
const bend = cableSamples(right, undefined, 4);
yes(sharpestTurn(bend) < 4, `a right angle is rounded: the sharpest step turns ${sharpestTurn(bend).toFixed(1)} degrees`);
const cornerPoint = [100, 700];
yes(bend.every((p) => Math.hypot(p[0] - cornerPoint[0], p[1] - cornerPoint[1]) > 10), "the curve cuts the corner instead of touching it");
// without rounding (corner 0) the same route is a kink: the test would notice
yes(sharpestTurn(cableSamples(right, { corner: 6 }, 4)) > 15, "and a 6 px corner IS a kink (the check works)");

// it hangs: a long horizontal stretch sags below its straight line, a short or steep one does not
const flat = cableSamples([[0, 500], [900, 500]], { sag: 0.03 }, 5);
const mid = flat[Math.floor(flat.length / 2)];
yes(mid[1] > 515 && mid[1] < 530, `a long stretch sags about 20 px in the middle (${mid[1].toFixed(1)})`);
const steep = cableSamples([[0, 0], [100, 900]], { sag: 0.03 }, 5);
yes(steep.every((p) => Math.abs(p[0] - (p[1] / 900) * 100) < 0.01), "a steep stretch stays straight");
const taut = cableSamples([[0, 500], [900, 500]], { sag: 0 }, 5);
yes(taut.every((p) => p[1] === 500), "sag 0 = taut");

// the path is something @remotion/paths can draw on: an M, then L and C segments only, with finite numbers
const d = cablePath(hook);
yes(/^M [\d.]+ [\d.]+( (L|C) [\d. ]+)+$/.test(d), `a plain M / L / C path: ${d.slice(0, 80)}`);
yes(!/NaN|Infinity/.test(d), "no NaN in the path");
const segs = cableSegments(hook).segs;
yes(segs.filter((s) => s.kind === "C").length >= 3, "the route's bends are cubic curves");

// degenerate routes do not break it
yes(cablePath([[5, 5], [5, 5]]).startsWith("M"), "two equal points");
yes(cableSamples([[5, 5]]).length === 1, "one point");

console.log(`cable: ${n} checks ok`);
