/* Kenapa balon helium naik ke atas?: the timing of the video (pure, no React). One tall party hall, one hero (a helium balloon), one continuous camera (CAM).
   Every moment something appears is named in `T`; index.tsx (the picture) and sfx.ts (the sound) read the same numbers. All times are seconds of the whole video. */
import type { StoryT } from "../../src/schema.ts";
import type { Key2 } from "../../src/iso.ts";

/** Where things stand in the hall (world px). The balloon is tied to a gift box; the ceiling stops it. */
export const HALL = { floor: 1400, ceiling: -700, boxTop: 1275, ribbon: 640, rx: 215, ry: 260, restY: 335 } as const;
export const BALLOON_END_Y = HALL.ceiling + HALL.ry;

export const T = {
  push: 1.6,
  dots: 4.4, downA: 5.4, downB: 6.0, lblPress: 6.8,
  panScale: 10.9, beam: 11.7, cubeAir: 12.3, cubeHe: 12.8, tilt: 13.4, lblAir: 14.6, lblHe: 15.1, lblNum: 16.0,
  panBack: 17.9, hit: 18.6, upA: 19.2, upB: 19.7, upC: 20.2, upD: 20.7, lblPush: 21.2, weight: 23.0, lblWeight: 23.5, lblDisp: 24.5,
  untie: 26.5, lblFree: 26.9, rise: 27.4, riseEnd: 31.4, bump: 31.6,
  ghost: 34.5, lblBalloon: 35.5, less: 36.6, lblAirDisp: 37.4, chime: 38.6,
  grow: 41.5, growEnd: 44.5, thin: 42.0, lblPressure: 42.6, equal: 44.6, lblEqual: 45.2,
  tips: 47.6, cardA: 48.0, lblBreath: 48.6, cardB: 51.0, lblHelium: 51.6,
  fadeOld: 56.0, newBalloon: 57.0,
} as const;

/** The camera keys. First and last are the same wide shot, so the video loops. */
export const CAM: Key2[] = [
  { t: 0, x: 540, y: 800, zoom: 0.5 }, { t: 1.6, x: 540, y: 800, zoom: 0.5 }, { t: 3.0, x: 540, y: 640, zoom: 1.1 },
  { t: 4.0, x: 540, y: 640, zoom: 1.1 }, { t: 5.5, x: 540, y: 700, zoom: 0.9 }, { t: 10.6, x: 540, y: 700, zoom: 0.9 },
  { t: 11.9, x: 1330, y: 1020, zoom: 1.0 }, { t: 17.5, x: 1330, y: 1020, zoom: 1.1 },
  { t: 18.9, x: 540, y: 520, zoom: 1.0 }, { t: 26.3, x: 540, y: 500, zoom: 1.12 },
  { t: 27.4, x: 540, y: 420, zoom: 1.0 }, { t: 31.4, x: 540, y: -230, zoom: 1.0 },
  { t: 33.4, x: 540, y: -330, zoom: 1.1 }, { t: 40.6, x: 540, y: -300, zoom: 1.0 },
  { t: 41.5, x: 540, y: -330, zoom: 1.15 }, { t: 46.6, x: 540, y: -300, zoom: 1.2 },
  { t: 47.9, x: 540, y: 700, zoom: 0.8 }, { t: 55.4, x: 540, y: 760, zoom: 0.8 },
  { t: 56.6, x: 540, y: 800, zoom: 0.5 }, { t: 60, x: 540, y: 800, zoom: 0.5 },
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

/** The hero's box at time t, in the 1080 px frame: the balloon (centre third in the wide shot, about 60 % wide at the main shot). */
export const HERO_BOX_AT = (t: number) => (t < 1.6 ? { x: 540, y: 800 + (HALL.restY - 800) * 0.5, w: 215, h: 260 } : { x: 540, y: 640, w: 520, h: 560 });
