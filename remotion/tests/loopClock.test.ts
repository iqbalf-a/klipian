/* The loop clock (DESIGN.md B29): a repeating motion on it holds the same phase at the first and the last frame, whatever length the voice gives the video. */
import assert from "node:assert/strict";
import { loopClock } from "../src/alive.ts";

let n = 0;
const yes = (ok: boolean, msg: string) => { assert.equal(ok, true, msg); n++; };
const wob = (c: number, period: number, phase = 0) => Math.sin(2 * Math.PI * (c / period + phase));

for (const total of [45, 48.7, 59.4, 60, 62.3, 71.05]) {
  yes(loopClock(0, total) === 0, `${total} s: the clock starts at 0`);
  yes(Math.abs(loopClock(total, total) - 60) < 1e-9, `${total} s: the end of the video is 60 s of loop clock`);
  for (const period of [2, 3, 4, 5, 6]) yes(Math.abs(wob(loopClock(total, total), period, 0.37) - wob(loopClock(0, total), period, 0.37)) < 1e-9, `${total} s: a ${period} s sway holds its phase from the first frame to the last`);
}
yes(Math.abs(loopClock(total45(), 45, 45) - 45) < 1e-9, "a 45 s video can say its base is 45");
yes(loopClock(7, 0) === 7, "no length known: the clock is left alone");
function total45() { return 45; }
console.log(`loopClock: ${n} checks ok`);
