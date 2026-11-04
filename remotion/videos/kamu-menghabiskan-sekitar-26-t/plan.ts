/* Kamu habiskan sekitar 26 tahun hidup untuk tidur — the timing of this video (pure: no React here). Look text (B28): no objects, kinetic numbers and words
   in rounded cards. The times below are seconds INTO each beat; picture (index.tsx) and sound (sfx.ts) read the same numbers, so a sound lands on the frame
   of its picture. Colours come from src/tokens.ts; easings and springs from src/motion.ts (the motion registry). The beats' words come from story.json. */
import type { StoryT } from "../../src/schema.ts";

/** When things come in, per beat (seconds into the beat). A new card, number or bar comes about every 3 to 4 s (B25); a counter rolls over 0.8 to 1.2 s. */
export const CUE = {
  hook: { card: 0.05, roll: 0.25, rollDur: 1.15, sub: 1.8, bar: 2.3 },
  rentang: { c7: 0.4, c9: 1.1, span: 1.9, lab: 2.8, grid: 3.5, fill7: 4.1, fill9: 5.0 },
  sepertiga: { grid: 0.3, fill: 0.9, fillStep: 0.19, card: 3.0, flip: 4.6, thirds: 5.9, lab: 6.8 },
  umur: { n78: 0.3, div: 2.6, bar: 3.4, mark: 4.8, big: 5.2 },
  setahun: { card: 0.3, grid: 2.3, fill: 3.0, fillDur: 2.0, lab: 5.6 },
  rentangUmur: { r7: 0.4, r8: 1.6, r9: 2.8, foot: 4.8 },
  otak: { card: 0.3, bar1: 2.0, bar2: 3.4, stamp: 5.2 },
  akhir: { c1: 0.3, c2: 2.2, c3: 4.0 },
} as const;

export function makePlan(story: StoryT) {
  const starts = story.beats.map((_, i) => story.beats.slice(0, i).reduce((a, b) => a + b.dur, 0));
  const total = story.beats.reduce((a, b) => a + b.dur, 0);
  const sting = starts[1] ?? 0;                                   // must 1: the "Intip yuk!" sting is the second beat
  const outro = starts.at(-1) ?? total;                           // must 2: the loop-back outro is the last beat
  const m = { sting, stingEnd: sting + (story.beats[1]?.dur ?? 1), react: NaN, outro, end: total };
  const at = (id: string) => starts[story.beats.findIndex((b) => b.id === id)] ?? 0;
  // the top text of every explain beat: its kicker and headline, for the whole beat (the sting and the outro have none)
  const tops = story.beats.flatMap((b, i) => (b.kind === "sting" || b.kind === "outro" ? [] : [{ a: starts[i], b: starts[i] + b.dur, kicker: b.kicker, headline: b.headline ?? b.text }]));
  return {
    m, total, at, tops,
    // 0 at the start, 1 in the loop-back: the scene is the first beat's again at the end (the loop: the empty brand, before the first card pops in)
    loopWeight: (t: number) => Math.min(1, Math.max(0, (t - outro) / 0.5)),
    labels: [] as { to: number; text: string }[],                  // no labels on an object: the texts are cards in index.tsx
  };
}

/** No hero object in the text look: the big number card of the hook is the hero (about 75 % of the width at the main shot). */
export const HERO_BOX_AT = (_t: number) => ({ x: 540, y: 900, w: 810, h: 620 });
