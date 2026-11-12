/* The tail warp (DESIGN.md B29): a short voiced video reaches its nominal end at the last frame; a long one is not touched; the loop clock takes the warp out again. */
import assert from "node:assert/strict";
import { setLoopWarp, unwarpClock, warpClock } from "../src/loopWarp.ts";
import { loopClock } from "../src/alive.ts";
import type { StoryT } from "../src/schema.ts";

const story = (durs: number[], duration = 60) => ({ duration, beats: durs.map((dur) => ({ dur })) }) as unknown as StoryT;
let n = 0;
const near = (a: number, b: number, msg: string) => { assert.ok(Math.abs(a - b) < 1e-9, `${msg}: ${a} vs ${b}`); n++; };

setLoopWarp(story([3, 1, 20, 20, 9.07, 4]), 53.07);            // 57.07 s: short
near(warpClock(57.07), 60, "the last frame is the nominal end");
near(warpClock(30), 30, "before the outro the clock is untouched");
near(warpClock(53.07), 53.07, "continuous at the outro start");
for (const c of [10, 53.5, 55, 57.07]) near(unwarpClock(warpClock(c)), c, "unwarp undoes warp");
near(loopClock(warpClock(57.07), 57.07), 60, "loopClock still gets 60 s at the end");
setLoopWarp(story([3, 1, 20, 20, 14.3, 4]), 58.3);             // 62.3 s: long, left alone
near(warpClock(62.3), 62.3, "a long video is not touched");
setLoopWarp(story([3, 1, 20, 20, 4.5, 4], 45), 48.5);             // 52.5 s of a 45 s story: long too
near(warpClock(52.5), 52.5, "longer than a 45 s base: untouched");
setLoopWarp(story([3, 1, 15, 15, 7.7, 4], 45), 40.7 - 0.0);     // 45.7: not short
near(warpClock(45.7), 45.7, "45.7 s of 45: untouched");
setLoopWarp(story([3, 1, 15, 14, 3, 4], 45), 33);               // 40 s
near(warpClock(40), 45, "a 40 s video of a 45 s story ends at 45");
console.log(`loopWarp: ${n} checks ok`);
