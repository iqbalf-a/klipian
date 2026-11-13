/* The tail of a short video (DESIGN.md B29). The camera keys and the states of a custom video are written for its nominal length (30, 45 or 60 s: the planned length, `nominalOf`; the voiced story's `duration` is the voiced total, so it is not used) and
   end on the first frame's picture at that time. A voiced video that is shorter than that (57 s, 59.9 s) would stop mid-way. So the clock that the scenes get runs on as it
   is up to the start of the last beat (the loop-back outro) and then, inside the outro, a little faster, so it reaches the nominal end exactly at the last frame. A video as long
   as its nominal length or longer is not touched (its keys are held after the end). `loopClock` takes the warp back out, so ambient motion still runs on the real clock. */
import type { StoryT } from "./schema.ts";

type W = { outro: number; total: number; nominal: number };
let W: W | null = null;

/** The length a video is planned for (30, 45 or 60 s, klipian/motion.py DURATIONS) that its voiced length is nearest to. The voiced story's own `duration` is the voiced total (voice timing rewrites it),
    so it cannot say what the keys were written for. */
export const nominalOf = (total: number): number => [30, 45, 60].reduce((best, d) => (Math.abs(d - total) < Math.abs(best - total) ? d : best), 60);

/** Set from the story before the scenes are drawn (a render is one story; with no story set every clock is left alone). */
export function setLoopWarp(story: StoryT, outro: number): void {
  const total = story.beats.reduce((a, b) => a + b.dur, 0), nominal = nominalOf(total);
  W = total > outro && nominal > total + 0.02 ? { outro, total, nominal } : null;
}
/** The real clock to the clock the scenes see. */
export const warpClock = (c: number): number => (W && c > W.outro ? c + ((W.nominal - W.total) * (c - W.outro)) / (W.total - W.outro) : c);
/** The scenes' clock back to the real one. */
export const unwarpClock = (c: number): number => (W && c > W.outro ? W.outro + ((c - W.outro) * (W.total - W.outro)) / (W.nominal - W.outro) : c);
