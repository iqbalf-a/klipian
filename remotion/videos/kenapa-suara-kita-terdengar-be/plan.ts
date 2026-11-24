/* Kenapa suara kita terdengar beda di rekaman? — the timing of the video (pure, no React). Look 2d: one continuous camera over one flat home-studio set
   (set kind "home-studio"): a person seen from the front (the hero) behind a desk with a microphone and a small recorder. Every moment something appears or
   moves is named in `T` (seconds of the whole video); index.tsx (the picture) and sfx.ts (the sound) read the same numbers. Everything that loops (the arcs,
   the mouth, the steam) has a period that divides 60 s, so the last frame is the first. */
import type { StoryT } from "../../src/schema.ts";
import type { Key2 } from "../../src/iso.ts";

export const T = {
  push: 1.4,
  // jalur (4 to 12)
  airOn: 5.0, lblAir: 5.3, boneOn: 7.2, lblBone: 7.5, lblEar: 9.6, ping: 10.2,
  // udara (12 to 20)
  panMouth: 12.1, arcsBig: 13.4, lblWave: 13.8, lblViaAir: 15.6, lblOthers: 17.6, reach: 18.4,
  // tulang (20 to 28)
  panHead: 20.1, skull: 21.8, lblSkull: 22.2, boneFlow: 22.6, lblLow: 24.6, lblHeavy: 26.6,
  // mic (28 to 35)
  panMic: 28.1, lblMic: 29.6, hit: 30.0, recOn: 30.6, lblRec: 31.0, cut: 32.0, lblNoBone: 32.6, cross: 33.6,
  // hasil (35 to 42)
  panMid: 35.1, play: 36.6, lblAirOnly: 37.5, lblThin: 39.2, lblOthersEar: 40.6,
  // fakta (42 to 48)
  panPoster: 42.1, poster: 43.3, ring: 43.7, lblPct: 45.0, lblSec: 46.0, lblYear: 46.9,
  // tips (48 to 57)
  panBack: 48.1, tip1: 49.8, tip2: 52.6, tip3: 55.0, fade: 56.4,
} as const;

/** The camera (2D: x, y = the point of the set in the middle of the frame): first and last key are the same wide shot, so the video loops.
    motion-exception: the establishing push (1.4 to 2.9 s) is faster than a beat's push (B27.8). */
const W = { x: 540, y: 1000, zoom: 0.62 };
export const CAM: Key2[] = [
  { t: 0, ...W }, { t: 1.4, ...W }, { t: 2.9, x: 540, y: 1010, zoom: 1.0 },
  { t: 11.6, x: 540, y: 1010, zoom: 1.05 },
  { t: 13.2, x: 540, y: 960, zoom: 1.2 }, { t: 19.6, x: 540, y: 960, zoom: 1.26 },
  { t: 21.3, x: 540, y: 900, zoom: 1.34 }, { t: 27.6, x: 540, y: 900, zoom: 1.42 },
  { t: 29.3, x: 700, y: 1040, zoom: 1.12 }, { t: 34.6, x: 700, y: 1040, zoom: 1.18 },
  { t: 36.3, x: 580, y: 1030, zoom: 0.95 }, { t: 41.6, x: 580, y: 1030, zoom: 1.0 },
  { t: 43.3, x: 1310, y: 800, zoom: 1.0 }, { t: 47.6, x: 1310, y: 800, zoom: 1.04 },
  { t: 49.3, x: 540, y: 990, zoom: 1.02 }, { t: 56.8, x: 540, y: 990, zoom: 1.08 },
  { t: 59.4, ...W }, { t: 60, ...W },
];

export function makePlan(story: StoryT) {
  const starts = story.beats.map((_, i) => story.beats.slice(0, i).reduce((a, b) => a + b.dur, 0));
  const total = story.beats.reduce((a, b) => a + b.dur, 0);
  const sting = starts[1] ?? 0;
  const outro = starts.at(-1) ?? total;
  const m = { sting, stingEnd: sting + (story.beats[1]?.dur ?? 1), react: NaN, outro, end: total };
  return {
    m, total, starts,
    loopWeight: (t: number) => Math.min(1, Math.max(0, (t - outro) / 0.5)),
    tops: [] as { b: number; headline?: string }[],
    labels: [] as { to: number; text: string }[],
  };
}

/** The hero's box at time t, in the 1080 px frame: the head with its ears and the two ways round it (about 65 % of the width in the main shot, small and in the middle in the wide shot). */
export const HERO_BOX_AT = (t: number) => (t < 1.4 ? { x: 540, y: 830, w: 420, h: 330 } : { x: 540, y: 800, w: 700, h: 560 });
