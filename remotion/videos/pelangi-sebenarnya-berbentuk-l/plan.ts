/* Pelangi sebenarnya berbentuk lingkaran: the timing of the video (pure, no React). One sky set ("cloud-deck": sky over a cloud deck, with one slab of
   ground that can be in the way), one hero (the rainbow ring) and one continuous camera. Every moment that something appears is named in `T`; index.tsx
   (the picture) and sfx.ts (the sound) read the same numbers. All times are seconds of the whole video. The first frame is the last (the loop). */
import type { StoryT } from "../../src/schema.ts";
import type { Key2 } from "../../src/iso.ts";

/** The named moments. Beats: hook 0, sting 3, tetes 4, cincin 14, cakrawala 24, pesawat 33, glory 39, tips 48, outro 56. */
export const T = {
  ringFade: 4.0, slabDown: 3.9, slabDownEnd: 5.2,
  ray: 5.6, rayIn: 5.6, rayBack: 7.2, rayOut: 8.6, split: 9.8, lblIn: 6.2, lblBack: 7.6, lblOut: 9.0, lblColours: 11.0,
  sweep: 14.6, sweepEnd: 17.4, axis: 17.8, axisLbl: 18.6, angle: 20.2, angleLbl: 20.9, centreLbl: 22.2,
  slabUp: 24.3, slabUpEnd: 25.8, cutLbl: 26.6, cutLbl2: 29.2, hide: 30.6,
  slabDown2: 33.2, slabDown2End: 34.8, plane: 33.4, mist: 35.2, lblPlane: 36.0, ringBack: 34.8,
  glory: 40.6, lblGlory: 42.4, lblRain: 44.2, lblSize: 45.8,
  sunWarn: 48.6, backArrow: 50.2, lblBack2: 51.0, lblOpp: 52.6,
  slabUp2: 54.2, slabUp2End: 55.8,
} as const;

/** The camera keys. The first and last key are the same wide shot, so the video loops. The droplet sits at DROP (world px). */
export const DROP = { x: 790, y: 700, r: 125 } as const;
export const RING = { x: 560, y: 1090, r: 330 } as const;
export const SUN = { x: 160, y: 580, r: 70 } as const;
export const CAM: Key2[] = [
  { t: 0, x: 540, y: 960, zoom: 1 }, { t: 3.0, x: 540, y: 960, zoom: 1 },
  { t: 4.8, x: 690, y: 735, zoom: 1.85 }, { t: 12.6, x: 700, y: 745, zoom: 1.95 },
  { t: 14.4, x: 540, y: 990, zoom: 1 }, { t: 23.4, x: 545, y: 1000, zoom: 1.04 },
  { t: 24.2, x: 540, y: 1000, zoom: 1 }, { t: 32.4, x: 545, y: 1040, zoom: 1.08 },
  { t: 33.2, x: 540, y: 1010, zoom: 1 }, { t: 38.6, x: 540, y: 1010, zoom: 1 },
  { t: 40.4, x: 560, y: 1060, zoom: 1.6 }, { t: 46.8, x: 560, y: 1060, zoom: 1.7 },
  { t: 48.6, x: 540, y: 990, zoom: 1.0 }, { t: 55.4, x: 540, y: 960, zoom: 1 }, { t: 60, x: 540, y: 960, zoom: 1 },
];

export function makePlan(story: StoryT) {
  const starts = story.beats.map((_, i) => story.beats.slice(0, i).reduce((a, b) => a + b.dur, 0));
  const total = story.beats.reduce((a, b) => a + b.dur, 0);
  const sting = starts[1] ?? 0;
  const outro = starts.at(-1) ?? total;
  const m = { sting, stingEnd: sting + (story.beats[1]?.dur ?? 1), react: NaN, outro, end: total };
  return {
    m, total,
    loopWeight: (t: number) => Math.min(1, Math.max(0, (t - outro) / 0.5)),
    tops: [] as { b: number; headline?: string }[],
    labels: [] as { to: number; text: string }[],
  };
}

/** The hero's box at time t, in the 1080 px frame: the ring (in the wide shot it fills the middle). */
export const HERO_BOX_AT = (_t: number) => ({ x: 540, y: 960, w: 700, h: 700 });
