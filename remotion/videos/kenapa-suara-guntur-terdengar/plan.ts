/* Kenapa suara guntur terdengar lebih lambat dari kilat?: the timing of the video (pure, no React). One continuous camera over one set (a flat dry plain with a
   straight road and kilometre posts, set kind "plain-road"); every moment that something appears is named in `T`, and index.tsx (the picture) and sfx.ts (the
   sound) read the same numbers. All times are seconds of the whole video. */
import type { StoryT } from "../../src/schema.ts";
import type { Key2 } from "../../src/iso.ts";

/** The named moments. A flash is a lightning bolt; the sound ring is born on the same frame and grows at the real speed of sound (1 km in 3 s). */
export const T = {
  flashHook: 1.2, push: 1.5,
  lblKilat: 6.0, lblGuntur: 6.9, flashLahir: 8.4,
  flashA: 13.0, dotEnd: 13.35, lihat: 13.5, lblInstan: 14.4, lblSpeed: 15.6,
  tag3: 16.0, tag6: 19.0, tag9: 22.0, duar: 22.05, lblSound: 24.3,
  brace: 27.4, flashE: 28.0, tlBar: 27.8, tlEnd: 28.6, tlLabel: 33.0,
  slideOut: 35.4, slideOutEnd: 37.9, flashB: 38.3, lblGap: 39.6, slideBack: 40.6, slideBackEnd: 41.9,
  flashC: 43.0, lblC1: 43.7, lblC2: 45.0, pillLipat: 46.0,
  flashD: 48.9, card1: 49.6, card2: 51.4, card3: 53.4, pillEx: 55.2,
} as const;

/** The sound rings: where (km from the listener) and when each is born; a ring grows 1 km in 3 s. */
export const RINGS = [
  { tf: T.flashA, k: 3, until: 26.6 },
  { tf: T.flashE, k: 3, until: 35.6 },
  { tf: T.flashB, k: 5, until: 41.6 },
  { tf: T.flashC, k: 3, until: 47.6 },
  { tf: T.flashD, k: 3, until: 57.0 },
] as const;
/** Every flash: the time and how far (km) the storm stands. */
export const FLASHES = [
  { t: T.flashHook, k: 3 }, { t: T.flashLahir, k: 3 }, { t: T.flashA, k: 3 }, { t: T.flashE, k: 3 }, { t: T.flashB, k: 5 }, { t: T.flashC, k: 3 }, { t: T.flashD, k: 3 },
] as const;

/** The camera keys: x, y, zoom (the frame's middle is 540, 960). The first and the last key are the same wide shot, so the video loops. */
export const CAM: Key2[] = [
  { t: 0, x: 540, y: 1000, zoom: 0.5 }, { t: 1.5, x: 540, y: 1000, zoom: 0.5 }, { t: 3.0, x: 470, y: 960, zoom: 1.0 },
  { t: 10.6, x: 470, y: 940, zoom: 1.12 }, { t: 12.0, x: 540, y: 1020, zoom: 1.0 }, { t: 18.6, x: 540, y: 1020, zoom: 1.0 },
  { t: 19.8, x: 700, y: 1090, zoom: 1.1 }, { t: 25.2, x: 700, y: 1090, zoom: 1.1 }, { t: 26.6, x: 540, y: 1260, zoom: 0.85 },
  { t: 34.6, x: 540, y: 1260, zoom: 0.85 }, { t: 35.6, x: 520, y: 1010, zoom: 0.85 }, { t: 41.0, x: 520, y: 1010, zoom: 0.85 },
  { t: 42.0, x: 540, y: 1020, zoom: 1.0 }, { t: 47.6, x: 540, y: 1020, zoom: 1.0 }, { t: 48.7, x: 540, y: 1300, zoom: 0.8 },
  { t: 56.0, x: 540, y: 1300, zoom: 0.8 }, { t: 57.2, x: 540, y: 1000, zoom: 0.5 }, { t: 60, x: 540, y: 1000, zoom: 0.5 },
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

/** The hero's box at time t, in the 1080 px frame: the storm over the road (in the wide shot it sits in the middle third). */
export const HERO_BOX_AT = (_t: number) => ({ x: 540, y: 960, w: 700, h: 420 });
