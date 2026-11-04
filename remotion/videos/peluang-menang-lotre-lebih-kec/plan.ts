/* Lotre vs petir — the timing of this video (pure: no React here). Look text (B28): kinetic numbers and words in cards, no objects, no set.
   Every moment a card, a number or a tile appears is a named time in T (seconds into its beat); index.tsx draws on those times and sfx.ts puts a sound on each,
   so the picture and the sound share the same frame. Colours come from src/tokens.ts; easings and springs from src/motion.ts. */
import type { StoryT } from "../../src/schema.ts";

/** Beat-local times (seconds) of every element, per beat id. */
export const T = {
  hook: { cardL: 0.05, cardR: 0.25, vs: 0.9, wiggle: 1.8 },
  jackpot: { label: 0.2, roll: 0.7, rollDur: 1.1, land: 1.8, grid: 3.0, winner: 4.2, tag: 5.0, push: 5.6 },
  petir: { label: 0.2, roll: 0.7, rollDur: 1.1, land: 1.9, grid: 3.0, winner: 4.2, tag: 5.0, push: 5.6 },
  banding: { label: 0.2, barA: 0.6, barB: 1.8, roll: 2.6, rollDur: 1.2, land: 3.8, push: 4.4, formula: 5.0, tick: 6.2 },
  setahun: { label: 0.2, tiles: 0.7, tilesDur: 2.5, push: 2.5, winner: 3.4, roll: 3.9, rollDur: 1.1, land: 5.0, tag: 5.8 },
  fakta: { stamp: 0.4, cardL: 2.2, cardR: 3.0, less: 3.8, tag: 5.0, tick: 6.0 },
  hadiah: { label: 0.2, roll: 0.6, rollDur: 1.1, land: 1.7, tiles: 2.4, winner: 3.6, tag: 4.4, tick: 5.2 },
  tips: { t1: 0.3, t2: 3.0, t3: 6.0, push: 8.0 },
} as const;

export function makePlan(story: StoryT) {
  const starts = story.beats.map((_, i) => story.beats.slice(0, i).reduce((a, b) => a + b.dur, 0));
  const total = story.beats.reduce((a, b) => a + b.dur, 0);
  const sting = starts[1] ?? 0;                                   // must 1: the "Intip yuk!" sting is the second beat
  const outro = starts.at(-1) ?? total;                           // must 2: the loop-back outro is the last beat
  const m = { sting, stingEnd: sting + (story.beats[1]?.dur ?? 1), react: NaN, outro, end: total };
  const at = (id: string) => starts[story.beats.findIndex((b) => b.id === id)] ?? 0;
  const tops = story.beats.map((b, i) => ({ id: b.id, a: starts[i], b: starts[i] + b.dur, headline: b.headline ?? b.text })).filter((x) => !["sting", "outro"].includes(story.beats.find((b) => b.id === x.id)?.kind ?? ""));
  return {
    m, total, starts, at,
    // 0 at the start, 1 in the loop-back: the scene is the first beat's again at the end (the loop)
    loopWeight: (t: number) => Math.min(1, Math.max(0, (t - outro) / 0.5)),
    tops,                                                          // the top text layer: { a, b } per beat
    labels: [] as { to: number; text: string }[],                  // look text has no labels on an object
  };
}

/** Look text has no hero object; the central card of the main beats stands for it: x 540, y 985, about 65 % of the width. */
export const HERO_BOX_AT = (_t: number) => ({ x: 190, y: 700, w: 700, h: 570 });
