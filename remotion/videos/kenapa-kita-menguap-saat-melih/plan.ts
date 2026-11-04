/* Kenapa kita menguap saat melihat orang menguap — the timing of this video (pure: no React here). Look text (B28): no objects, kinetic numbers and words
   in rounded cards. The times below are seconds INTO each beat; picture (index.tsx) and sound (sfx.ts) read the same numbers, so a sound lands on the frame
   of its picture. Colours come from src/tokens.ts; easings and springs from src/motion.ts (the motion registry). */
import type { StoryT } from "../../src/schema.ts";

/** When things come in, per beat (seconds into the beat). A new card, number or bar about every 3 to 4 s (B25); a counter rolls over 0.8 to 1.2 s. */
export const CUE = {
  hook: { card: 0.05, word: 0.3, sub: 1.5, bar: 2.1 },
  tular: { card: 0.3, roll: 0.5, rollDur: 1.2, grid: 2.4, fill: 3.2, fillStep: 0.32, lab: 5.4, note: 6.5 },
  indera: { c1: 0.3, c2: 1.8, c3: 3.2, card: 4.5, flip: 5.4 },
  dekat: { r0: 0.3, r1: 2.4, r2: 4.3, r3: 6.1, note: 8.1 },
  anak: { card: 0.3, roll: 0.6, rollDur: 1.2, grid: 2.3, scan: 3.0, scanStep: 0.28, mark: 4.4, lab: 5.7 },
  teori: { c1: 0.3, c2: 2.0, flip: 4.2, q: 5.6, c3: 6.6 },
  akhir: { c1: 0.3, c2: 2.4, flip: 3.4, c3: 5.0, c4: 6.8 },
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
export const HERO_BOX_AT = (_t: number) => ({ x: 540, y: 900, w: 740, h: 620 });
