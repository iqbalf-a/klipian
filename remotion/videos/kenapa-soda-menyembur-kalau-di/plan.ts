/* Kenapa soda menyembur kalau dikocok lalu dibuka? — the timing of the video (pure, no React). One cafe counter (set kind "cafe-counter"), one hero (a soda bottle)
   and one continuous camera (CAM). Every moment something appears or moves is named in `T` (seconds of the whole video); index.tsx (the picture) and sfx.ts
   (the sound) read the same numbers. The bottle's state (how many small bubbles float in it, how hard it is shaken, the cap, the foam) is a pure function of time.
   The first frame is the last (the loop): a closed bottle with only a few bubbles stands at the same place. */
import type { StoryT } from "../../src/schema.ts";
import type { Key2 } from "../../src/iso.ts";

export const T = {
  push: 1.6,
  // tekanan (4 to 12)
  dots: 5.0, lblGas: 5.4, pressA: 7.0, pressB: 7.5, pressC: 8.0, lblPress: 8.6, lblCap: 10.2,
  // kocok (12 to 22)
  shakeA: 13.2, shakeB: 17.6, lblSmall: 14.8, lblDust: 18.6, speck: 18.2, grow: 19.0, lblSpot: 19.6, chip: 20.6, chipEnd: 22.0,
  // buka (22 to 33)
  twist: 24.2, pop: 25.2, lblDrop: 25.9, lblMore: 27.6, spill: 28.4, lblOut: 30.0,
  // hasil (33 to 42)
  lblFoam: 33.6, wipe: 36.0, swapOut: 36.2, swapIn: 36.9, dissolveA: 37.6, dissolveB: 42.0, clock: 38.0, lblMin: 38.6,
  // tepuk (42 to 48)
  tap1: 43.2, tap2: 43.9, tap3: 44.6, cardN: 45.0, lblNo: 46.6,
  // tips (48 to 56)
  clockIn: 49.0, lblWait: 49.6, arrowAway: 52.4, lblAway: 52.9,
  fadeOut: 56.0,
} as const;

export const CAM: Key2[] = [
  { t: 0, x: 540, y: 960, zoom: 0.5 }, { t: 1.6, x: 540, y: 960, zoom: 0.5 }, { t: 3.0, x: 540, y: 960, zoom: 0.95 },
  { t: 4.0, x: 540, y: 960, zoom: 0.95 }, { t: 11.4, x: 540, y: 960, zoom: 1.0 },
  { t: 12.6, x: 540, y: 960, zoom: 1.04 }, { t: 21.6, x: 540, y: 960, zoom: 1.08 },
  { t: 23.4, x: 540, y: 800, zoom: 1.0 }, { t: 29.0, x: 540, y: 820, zoom: 1.0 },
  { t: 30.4, x: 540, y: 1000, zoom: 0.85 }, { t: 36.0, x: 540, y: 1000, zoom: 0.85 },
  { t: 37.4, x: 540, y: 960, zoom: 0.95 }, { t: 41.8, x: 540, y: 960, zoom: 0.98 },
  { t: 42.8, x: 540, y: 960, zoom: 1.04 }, { t: 47.6, x: 540, y: 960, zoom: 1.08 },
  { t: 49.0, x: 700, y: 1060, zoom: 0.9 }, { t: 55.4, x: 700, y: 1060, zoom: 0.9 },
  { t: 56.6, x: 540, y: 960, zoom: 0.5 }, { t: 60, x: 540, y: 960, zoom: 0.5 },
];

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const ease = (k: number) => { k = clamp01(k); return k * k * (3 - 2 * k); };

/** How many small bubbles float in the liquid (0.08 at rest, 1 after a long shake); the new bottle is shaken too and its bubbles dissolve again. */
export function dens(t: number): number {
  if (t < T.shakeA) return 0.08;
  if (t < T.swapIn) return 0.08 + 0.92 * ease((t - T.shakeA) / 3.8);
  return 1 - 0.92 * ease((t - T.dissolveA) / (T.dissolveB - T.dissolveA));
}
/** How hard the bottle is shaken now (0..1): a smooth envelope over the shaking, then a few taps. */
export function shakeAmp(t: number): number {
  const env = ease((t - T.shakeA) / 0.5) * (1 - ease((t - T.shakeB) / 0.5));
  return env;
}
/** The shake offset in world px: up and down 3 times a second, with a small side swing. */
export function shakeOff(t: number): { dx: number; dy: number; rot: number } {
  const a = shakeAmp(t), w = 2 * Math.PI * 3;
  return { dx: a * 22 * Math.sin(w * t * 0.5), dy: a * 46 * Math.sin(w * t), rot: a * 5 * Math.sin(w * t * 0.5) };
}
/** The tap pulses (0..1 each) at tap1 to tap3. */
export const tapAt = (t: number, a: number): number => (t < a || t > a + 0.5 ? 0 : Math.sin(((t - a) / 0.5) * Math.PI));

/** The cap: 1 on the bottle, 0 once it has gone; `flight` is the seconds since the pop. */
export const capOn = (t: number) => (t < T.twist ? 1 : 0);
export const capFlight = (t: number) => Math.max(0, t - T.pop);
/** The twist of the cap before it pops (0..1). */
export const twistK = (t: number) => ease((t - T.twist) / (T.pop - T.twist));
/** The foam: 0 closed; grows from the pop to the spill, runs down the side, then dies out by the wipe. */
export function foamK(t: number): number {
  if (t < T.pop) return 0;
  return ease((t - T.pop) / 2.2) * (1 - ease((t - 33.2) / 2.6));
}
export const spillK = (t: number) => ease((t - T.spill) / 2.6) * (1 - ease((t - T.wipe) / 1.0));
export const puddleK = (t: number) => ease((t - T.spill) / 3.4) * (1 - ease((t - T.wipe) / 1.0));
/** The bottle's slide in x (world px): the old one leaves to the left, the new one comes from the right; `fresh` says which bottle is on the counter. */
export function bottleSlot(t: number): { x: number; fresh: boolean } {
  if (t < T.swapOut) return { x: 0, fresh: false };
  if (t < T.swapIn - 0.2) return { x: -1600 * ease((t - T.swapOut) / 0.7), fresh: false };
  const k = clamp01((t - (T.swapIn - 0.2)) / 0.9);
  return { x: 1500 * (1 - ease(k)), fresh: true };
}

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

/** The hero's box at time t, in the 1080 px frame: the bottle (centre third in the wide shot, filling the height at the main shot). */
export const HERO_BOX_AT = (t: number) => (t < 1.6 ? { x: 540, y: 960, w: 190, h: 480 } : { x: 540, y: 900, w: 350, h: 930 });
