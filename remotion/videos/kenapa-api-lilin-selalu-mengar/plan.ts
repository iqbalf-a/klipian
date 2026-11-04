/* Kenapa api lilin selalu mengarah ke atas?: the timing of the video (pure, no React). One set (kind "night-cabinet": a low cabinet against a dusky wall in
   a power cut), one hero (a pillar candle on a saucer, its teardrop flame), one continuous camera (CAM). Every moment something appears is named in `T`;
   index.tsx (the picture) and sfx.ts (the sound) read the same numbers. All times are seconds of the whole video. */
import type { StoryT } from "../../src/schema.ts";
import type { Key2 } from "../../src/iso.ts";

/** The set's measures. The iso unit is 1 cm (U px a cm at zoom 1); O is the cabinet top under the saucer's centre. */
export const U = 33;
export const O: [number, number] = [540, 1250];
export const SET = { wallBottom: 1050, cabinetFront: 1820, saucerR: 7, saucerH: 0.8, candleR: 3.5, candleTop: 10.8 } as const;
/** The candle's top in world px, the wick's tip, and the flame's size (a real flame is about 1.5 cm wide and 4 to 5 cm tall). */
export const TOP_Y = O[1] - SET.candleTop * U;                // 893.6
export const WICK = { x: 546, y: 868 } as const;
export const FLAME = { x: 546, y: 872, h: 150, w: 28 } as const;

export const T = {
  topIn: 0.2, push: 1.5, pushEnd: 2.8,
  // sumbu 4 to 11
  pan1: 4.0, pool: 5.4, lblPool: 5.8, drops: 6.6, lblWick: 7.4, vapor: 8.6, lblVapor: 9.2,
  // panas 11 to 19
  pan2: 11.0, gas: 12.0, lblHot: 13.0, grow: 14.0, cmpCold: 15.4, cmpHot: 16.0, lblCold: 16.6, lblLight: 17.4,
  // naik 19 to 27
  pan3: 19.0, upFlow: 20.4, downL: 21.2, downR: 21.6, lblUp: 22.0, gravity: 22.8, lblDown: 23.6, lblConv: 25.0,
  // oksigen 27 to 35
  pan4: 27.0, inL: 28.4, inR: 28.8, lblFresh: 29.2, o2: 29.8, lblO2: 30.4, stretch: 31.6, lblLong: 32.4, outTop: 33.2,
  // kuning 35 to 42
  pan5: 35.0, soot: 36.2, lblSoot: 36.8, lblBlue: 38.0, lblTip: 39.2, chip: 40.2,
  // angkasa 42 to 49
  pan6: 42.0, port: 43.0, ball: 43.8, lblSpace: 44.6, lblEarth: 46.2, motes: 46.8,
  // tips 49 to 56
  pan7: 49.0, arrows: 50.0, cardA: 50.6, cardB: 52.4, chipT: 54.0,
  // outro 56 to 60
  back: 56.0, backEnd: 58.4,
} as const;

/** The camera keys. First and last are the same wide shot, so the video loops.
    motion-exception: the establishing push (1.5 to 2.8 s, zoom 0.55 to 1.25) and the pans into the flame are faster than a beat's push; the flame is a
    centimetre wide, so the explain beats look at it at 1.3 to 3.2 zoom, and each beat's own push stays under 0.05 zoom a second. */
export const CAM: Key2[] = [
  { t: 0, x: 540, y: 960, zoom: 0.55 }, { t: T.push, x: 540, y: 960, zoom: 0.55 }, { t: T.pushEnd, x: 540, y: 1000, zoom: 1.25 },
  { t: 4.0, x: 540, y: 1000, zoom: 1.27 },
  { t: 5.2, x: 540, y: 880, zoom: 2.5 }, { t: 10.8, x: 540, y: 880, zoom: 2.7 },
  { t: 12.2, x: 540, y: 700, zoom: 1.7 }, { t: 18.8, x: 540, y: 690, zoom: 1.8 },
  { t: 20.2, x: 540, y: 780, zoom: 1.3 }, { t: 26.8, x: 540, y: 780, zoom: 1.4 },
  { t: 28.2, x: 540, y: 860, zoom: 2.0 }, { t: 34.8, x: 540, y: 850, zoom: 2.2 },
  { t: 36.0, x: 540, y: 810, zoom: 3.0 }, { t: 41.8, x: 540, y: 810, zoom: 3.2 },
  { t: 43.2, x: 300, y: 960, zoom: 1.05 }, { t: 48.8, x: 300, y: 960, zoom: 1.1 },
  { t: 50.2, x: 540, y: 1180, zoom: 1.0 }, { t: 55.8, x: 540, y: 1180, zoom: 1.05 },
  { t: T.backEnd, x: 540, y: 960, zoom: 0.55 }, { t: 60, x: 540, y: 960, zoom: 0.55 },
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

/** The hero's box at time t, in the 1080 px frame: the candle on its saucer with its flame (centre third in the wide shot, about 65 % wide at the main shot). */
export const HERO_BOX_AT = (t: number) => (t < T.push ? { x: 540, y: 1027, w: 311, h: 395 } : { x: 540, y: 1061, w: 708, h: 898 });
