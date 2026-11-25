/* Nasi di rice cooker warm seharian bisa basi? — the timing and the camera of this video (pure: no React). Look 2d (B28): a rice cooker cut open in front view stands on a
   counter in a cream tiled wall (set kind "counter-rice-section", see set.json). One world, one camera (camAt) by the clock of the whole video.
   Loop (B41): the first and the last camera key and the set weight are the same, the room fades out and the hook text fades back in over the last 0.5 s.
   Every number here is read by index.tsx and sfx.ts so the picture and the sound agree. */
import type { StoryT } from "../../src/schema.ts";

export type Cam = { x: number; y: number; z: number };
type Key = { t: number; v: number };

const HOOK: Cam = { x: 480, y: 920, z: 1.0 };
export const CAM_KEYS: { t: number; c: Cam }[] = [
  { t: 0, c: HOOK },                                         // hook: the cooker fills 72 % of the width, frame 0 already the claim
  { t: 3.0, c: { ...HOOK, z: 1.03 } },
  { t: 3.9, c: { x: 480, y: 1000, z: 0.8 } },                // the sting: pull back, the counter comes in around the cooker
  { t: 4.6, c: { x: 480, y: 1000, z: 0.8 } },
  { t: 5.6, c: { x: 520, y: 980, z: 0.86 } },                // spora: a push toward the callout card
  { t: 9.6, c: { x: 520, y: 980, z: 0.86 } },
  { t: 11.0, c: { x: 560, y: 1000, z: 0.84 } },              // panas: ease right, the thermometer comes in
  { t: 16.6, c: { x: 560, y: 1000, z: 0.84 } },
  { t: 17.8, c: { x: 520, y: 1010, z: 0.86 } },              // turun: back to the card and the thermometer
  { t: 24.6, c: { x: 520, y: 1010, z: 0.86 } },
  { t: 25.8, c: { x: 480, y: 1180, z: 0.78 } },              // racun: the cooker drops, the two cards fill the counter below
  { t: 30.6, c: { x: 480, y: 1180, z: 0.78 } },
  { t: 31.8, c: { x: 500, y: 1180, z: 0.8 } },               // tips
  { t: 35.6, c: { x: 500, y: 1180, z: 0.8 } },
  { t: 38.4, c: HOOK },                                      // the loop-back: exactly the first shot
  { t: 40, c: HOOK },
];

const ease = (x: number) => (x < 0.5 ? 2 * x * x : 1 - 2 * (1 - x) * (1 - x));
export function through(keys: Key[], t: number): number {
  if (t <= keys[0].t) return keys[0].v;
  for (let i = 1; i < keys.length; i++) {
    if (t <= keys[i].t) {
      const a = keys[i - 1], b = keys[i], u = b.t === a.t ? 1 : ease((t - a.t) / (b.t - a.t));
      return a.v + (b.v - a.v) * u;
    }
  }
  return keys[keys.length - 1].v;
}
export function camAt(t: number): Cam {
  const k = (get: (c: Cam) => number): Key[] => CAM_KEYS.map((q) => ({ t: q.t, v: get(q.c) }));
  return { x: through(k((c) => c.x), t), y: through(k((c) => c.y), t), z: through(k((c) => c.z), t) };
}

/** The counter, the wall and the sack: plain hook background at frame 0, they come in with the sting pull-back and go out again at the loop end. */
export const SET_KEYS: Key[] = [{ t: 0, v: 0 }, { t: 3.0, v: 0 }, { t: 3.9, v: 1 }, { t: 37.4, v: 1 }, { t: 39.0, v: 0 }, { t: 40, v: 0 }];
export const setAt = (t: number) => through(SET_KEYS, t);

/** The warm lamp of the cooker: on at the start, off when the heat goes (turun); back on for the loop. */
export const LAMP = { off: 18.2, on: 38.0 };
export const lampAt = (t: number) => (t < LAMP.off || t >= LAMP.on ? 1 : 0);
/** How hot the plate is (1 heating, 0 cold): it sinks over 18.4 to 21 and comes back for the loop. */
export const HEAT_KEYS: Key[] = [{ t: 0, v: 1 }, { t: 18.2, v: 1 }, { t: 21.0, v: 0 }, { t: 37.6, v: 0 }, { t: 39.6, v: 1 }, { t: 40, v: 1 }];
export const heatAt = (t: number) => through(HEAT_KEYS, t);

/** The magnified card of the rice grain with its spores: on screen in spora, panas and turun, gone before racun. */
export const CARD = { a: 5.0, b: 24.9 };
/** The flame that hits the spores in spora (they stay shut), and the three stages of turun: the shells crack, the rods multiply, the toxin drops fall. */
export const FLAME = { a: 6.8, b: 9.6 };
export const CRACK = 20.4, SPLIT = 21.6, DOUBLE = 22.8, DROPS = 23.4;
/** The thermometer (world): comes in at 10.4, the mercury rises to 65 °C by 13.2, falls from 18.4 to 35 °C by 21.0, fades with the card; it is back for the tips. */
export const THERMO = { a: 10.4, rise0: 11.0, rise1: 13.2, fall0: 18.4, fall1: 21.0, out: 24.9, again: 31.6, out2: 36.0 };
export function degAt(t: number): number {
  const rise = through([{ t: THERMO.rise0, v: 22 }, { t: THERMO.rise1, v: 65 }], t);
  const fall = through([{ t: THERMO.fall0, v: 65 }, { t: THERMO.fall1, v: 35 }], t);
  if (t < THERMO.fall0) return rise;
  if (t < THERMO.again) return fall;
  return through([{ t: THERMO.again, v: 35 }, { t: THERMO.again + 1.4, v: 65 }], t);
}
/** The pills on the thermometer: the 60 line in panas, the danger band in turun, the 60 line again in tips. */
export const PILLS = { hot: { a: 13.3, b: 16.9 }, cold: { a: 19.0, b: 24.9 }, tip: { a: 32.8, b: 36.0 } };
/** The verdict and the two cards of racun, and the two tip cards. */
export const STAMP = { a: 25.6, b: 31.2 };
export const RACUN_CARDS = [{ a: 26.8, out: 31.0 }, { a: 28.4, out: 31.0 }];
export const TIP_CARDS = [{ a: 32.0, out: 35.8 }, { a: 33.6, out: 35.8 }];

export function makePlan(story: StoryT) {
  const starts = story.beats.map((_, i) => story.beats.slice(0, i).reduce((a, b) => a + b.dur, 0));
  const total = story.beats.reduce((a, b) => a + b.dur, 0);
  const sting = starts[1] ?? 0;                                   // must 1: the "Intip yuk!" sting is the second beat
  const outro = starts.at(-1) ?? total;                           // must 2: the loop-back outro is the last beat
  const m = { sting, stingEnd: sting + (story.beats[1]?.dur ?? 1), react: NaN, outro, end: total };
  return {
    m, total, starts,
    loopWeight: (t: number) => Math.min(1, Math.max(0, (t - outro) / 0.5)),
    tops: [] as { b: number; headline?: string }[],
    labels: [] as { to: number; text: string }[],
  };
}

/** The hero's box at time t, in the 1080 px frame: the cooker, 780 px wide and 630 high around world (480, 1000). */
export const HERO_BOX_AT = (t: number) => {
  const c = camAt(t);
  return { x: 540 + (480 - c.x) * c.z, y: 960 + (1000 - c.y) * c.z, w: 780 * c.z, h: 630 * c.z };
};
