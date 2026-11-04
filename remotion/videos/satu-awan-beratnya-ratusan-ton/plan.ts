/* Satu awan beratnya ratusan ton: the timing of the video (pure, no React). One continuous camera over one sky set; every moment that something
   appears is named in `T`, and index.tsx (the picture) and sfx.ts (the sound) read the same numbers. All times are seconds of the whole video. */
import type { StoryT } from "../../src/schema.ts";
import type { Key2 } from "../../src/iso.ts";

/** The named moments: when each thing of the picture comes in (and a sound lands on the same frame). */
export const T = {
  push: 1.6,                               // the establishing push (wide to main shot)
  cube: 5.0, cubeFill: 7.2, kmA: 5.6, kmB: 6.4, volume: 9.5,
  box: 13.5, glass: 14.3, specks: 15.2, marble: 16.0, marbleLand: 16.5, lblMarble: 17.4, lblHalf: 18.5,
  vol: 21.0, times: 22.0, equals: 23.2, kg: 24.4, ton: 26.0,
  rowA: 29.2, rowB: 30.0, rowC: 30.8, rowD: 31.6, lblElephants: 32.4, lblSpread: 33.4,
  air: 35.6, down: 36.4, up: 37.2, lblLight: 38.3,
  drops: 43.5, lblDrops: 44.5,
  finalTon: 50.0,
} as const;

/** The camera keys: x, y, zoom of the one camera (the frame's middle is 540, 960). First and last key are the same wide shot, so the video loops. */
export const CAM: Key2[] = [
  { t: 0, x: 540, y: 960, zoom: 0.5 }, { t: 1.6, x: 540, y: 960, zoom: 0.5 }, { t: 3.0, x: 540, y: 940, zoom: 1.2 },
  { t: 4.0, x: 540, y: 940, zoom: 1.2 }, { t: 5.2, x: 540, y: 940, zoom: 0.8 }, { t: 11.5, x: 540, y: 940, zoom: 0.76 },
  { t: 12.7, x: 540, y: 960, zoom: 0.9 }, { t: 13.2, x: 820, y: 1120, zoom: 1.45 }, { t: 19.4, x: 840, y: 1130, zoom: 1.6 },
  { t: 20.6, x: 540, y: 960, zoom: 0.8 }, { t: 27.5, x: 540, y: 940, zoom: 0.9 },
  { t: 28.8, x: 540, y: 1210, zoom: 0.95 }, { t: 34.2, x: 540, y: 1190, zoom: 0.9 },
  { t: 35.4, x: 540, y: 980, zoom: 0.95 }, { t: 41.5, x: 540, y: 960, zoom: 1.05 },
  { t: 42.9, x: 800, y: 920, zoom: 2.4 }, { t: 47.4, x: 780, y: 910, zoom: 2.6 },
  { t: 48.9, x: 540, y: 960, zoom: 1.0 }, { t: 55.4, x: 540, y: 960, zoom: 0.8 }, { t: 56.5, x: 540, y: 960, zoom: 0.5 }, { t: 60, x: 540, y: 960, zoom: 0.5 },
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

/** The hero's box at time t, in the 1080 px frame: the cloud (in the wide shot it sits in the middle third). */
export const HERO_BOX_AT = (_t: number) => ({ x: 540, y: 960, w: 700, h: 420 });
