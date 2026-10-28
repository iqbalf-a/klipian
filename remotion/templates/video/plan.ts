/* __TITLE__ — the timing of this video (pure: no React here). The formula is DESIGN.md section 0b: the hook, the "Intip yuk!" sting right after it,
   the explain beats, the result, the tip and the loop-back outro. Read the beats from the story; do not hard-code the durations.
   Colours come from src/tokens.ts; easings and springs from src/motionLanguage.ts (must 3 of B16). Add `motion-exception: <reason>` here
   only with ian's OK, when a move must leave the registry's ranges. */
import type { StoryT } from "../../src/schema.ts";

export function makePlan(story: StoryT) {
  const starts = story.beats.map((_, i) => story.beats.slice(0, i).reduce((a, b) => a + b.dur, 0));
  const total = story.beats.reduce((a, b) => a + b.dur, 0);
  const sting = starts[1] ?? 0;                                   // must 1: the "Intip yuk!" sting is the second beat
  const outro = starts.at(-1) ?? total;                           // must 2: the loop-back outro is the last beat
  const m = { sting, stingEnd: sting + (story.beats[1]?.dur ?? 1), react: NaN, outro, end: total };
  return {
    m, total,
    // 0 at the start, 1 in the loop-back: the scene is the first beat's again at the end (the loop)
    loopWeight: (t: number) => Math.min(1, Math.max(0, (t - outro) / 0.5)),
    tops: [] as { b: number; headline?: string }[],                // the top text layer: { a, b } per sentence (empty until the beats have words)
    labels: [] as { to: number; text: string }[],                  // the labels on the object: { from, to } per label
  };
}

/** The hero's box at time t, in the 1080 px frame (x, y, w, h). klipian's report measures its share of the width (60 to 70 %). Set it for the hero. */
export const HERO_BOX_AT = (_t: number) => ({ x: 540, y: 960, w: 0, h: 0 });
