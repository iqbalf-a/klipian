/* Kenapa gurun dingin banget di malam hari? — the timing and the camera of this video (pure: no React). The look is 2d (B28): a flat side view of a desert with
   dunes, a thermometer planted in the sand, a sun and a moon, and a humid town with a cloud far to the right. One continuous world; the camera moves inside it by the
   clock of the whole video. Every number here is read by index.tsx and sfx.ts so the picture and the sound agree.
   motion-exception: the hook's establishing push (wide 0.66 to main 0.95) lasts 1.5 s as the registry's establishing push does; the pans between the desert and
   the town last 1.8 s. */
import type { StoryT } from "../../src/schema.ts";

export type Cam = { x: number; y: number; z: number };

export const THERMO_X = 640;                                    // the thermometer's world x
export const CITY_X = 1960;                                     // the humid town's world x

/** Camera keys (seconds of the video): focus (world x, y) and zoom. Between two keys the camera eases (in/out quad); equal keys hold. */
export const CAM_KEYS: { t: number; c: Cam }[] = [
  { t: 0, c: { x: 640, y: 1000, z: 0.66 } },
  { t: 1.5, c: { x: 640, y: 1000, z: 0.66 } },     // the wide shot: dunes, the sun, the thermometer in the middle third
  { t: 3.0, c: { x: 640, y: 900, z: 0.95 } },      // establishing push to the thermometer
  { t: 4.0, c: { x: 640, y: 900, z: 0.95 } },      // the sting
  { t: 6.4, c: { x: 420, y: 1100, z: 1.05 } },     // siang: the sun's rays and the sand
  { t: 12.0, c: { x: 400, y: 1130, z: 1.25 } },
  { t: 13.6, c: { x: 560, y: 820, z: 0.9 } },      // malam: the sun sets, the heat rises from the sand
  { t: 19.6, c: { x: 560, y: 800, z: 0.95 } },
  { t: 21.4, c: { x: 1880, y: 960, z: 0.95 } },    // lembap: pan to the humid town
  { t: 27.6, c: { x: 1880, y: 960, z: 1.05 } },
  { t: 29.4, c: { x: 640, y: 830, z: 0.9 } },      // kering: back to the dry desert under a clear sky
  { t: 35.6, c: { x: 640, y: 800, z: 0.95 } },
  { t: 37.2, c: { x: 560, y: 1260, z: 0.85 } },     // pasir: the thermometer above the card, the sand under it
  { t: 42.8, c: { x: 560, y: 1280, z: 0.88 } },
  { t: 44.4, c: { x: 640, y: 900, z: 0.85 } },     // fakta: a cloud comes over the desert
  { t: 48.6, c: { x: 640, y: 900, z: 0.88 } },
  { t: 50.2, c: { x: 640, y: 1260, z: 0.8 } },     // tips: the night, the jacket under the thermometer
  { t: 56.2, c: { x: 640, y: 1260, z: 0.78 } },
  { t: 58.6, c: { x: 640, y: 1000, z: 0.66 } },    // the loop-back: the wide shot of the hook
  { t: 60, c: { x: 640, y: 1000, z: 0.66 } },
];

const ease = (x: number) => (x < 0.5 ? 2 * x * x : 1 - 2 * (1 - x) * (1 - x));
function through<T extends { t: number }>(keys: T[], t: number, get: (k: T) => number): number {
  if (t <= keys[0].t) return get(keys[0]);
  for (let i = 1; i < keys.length; i++) {
    if (t <= keys[i].t) {
      const a = keys[i - 1], b = keys[i], u = b.t === a.t ? 1 : ease((t - a.t) / (b.t - a.t));
      return get(a) + (get(b) - get(a)) * u;
    }
  }
  return get(keys[keys.length - 1]);
}
export function camAt(t: number): Cam {
  return { x: through(CAM_KEYS, t, (k) => k.c.x), y: through(CAM_KEYS, t, (k) => k.c.y), z: through(CAM_KEYS, t, (k) => k.c.z) };
}

/** The time of day d (0 = noon, 1 = deep night): it moves the sun, the moon, the sky and the stars. The hook shows a day pass in a flash. */
export const DAY_KEYS: { t: number; v: number }[] = [
  { t: 0, v: 0 }, { t: 1.3, v: 0 }, { t: 2.9, v: 1 },           // hook: the day passes
  { t: 3.1, v: 1 }, { t: 3.9, v: 0 },                          // sting: the next day
  { t: 12.4, v: 0 }, { t: 16.0, v: 1 },                        // malam: the sun sets
  { t: 56.4, v: 1 }, { t: 59.4, v: 0 },                        // the loop-back: the day returns
  { t: 60, v: 0 },
];
export const dayAt = (t: number) => through(DAY_KEYS, t, (k) => k.v);

/** The thermometer in the desert (0 = cold, 1 = hot). */
export const TEMP_KEYS: { t: number; v: number }[] = [
  { t: 0, v: 0.88 }, { t: 1.3, v: 0.88 }, { t: 2.9, v: 0.14 },
  { t: 3.1, v: 0.14 }, { t: 3.9, v: 0.45 }, { t: 9.0, v: 0.92 },   // siang: the sand soaks up the sun
  { t: 12.4, v: 0.92 }, { t: 19.5, v: 0.3 },                      // malam: the heat leaves
  { t: 28.0, v: 0.24 }, { t: 35.6, v: 0.08 },                     // kering: nothing holds it
  { t: 43.0, v: 0.08 }, { t: 47.6, v: 0.36 },                     // fakta: a cloud holds some back
  { t: 56.0, v: 0.1 }, { t: 59.4, v: 0.88 },
  { t: 60, v: 0.88 },
];
export const tempAt = (t: number) => through(TEMP_KEYS, t, (k) => k.v);
/** The thermometer in the humid town: it stays warmer. */
export const CITY_TEMP_KEYS: { t: number; v: number }[] = [{ t: 0, v: 0.62 }, { t: 20, v: 0.62 }, { t: 27.6, v: 0.55 }, { t: 60, v: 0.55 }];
export const cityTempAt = (t: number) => through(CITY_TEMP_KEYS, t, (k) => k.v);

/** The cloud that drifts over the desert in the fakta beat (world x of its centre): from the right edge in, then out to the left. */
export const CLOUD_KEYS: { t: number; v: number }[] = [{ t: 0, v: 2600 }, { t: 43.4, v: 2600 }, { t: 45.4, v: 760 }, { t: 48.8, v: 700 }, { t: 48.9, v: -900 }, { t: 60, v: -900 }];
export const cloudAt = (t: number) => (t > 48.8 ? -900 : through(CLOUD_KEYS, t, (k) => k.v));      // the cloud fades out in place at 48.2 to 48.8 (index.tsx), so it never crosses the tips headline
export const cloudFade = (t: number) => 1 - Math.min(1, Math.max(0, (t - 48.2) / 0.6));

/** Windows (seconds): the sun's rays on the sand, the heat that rises (the free escape), the town's bounce, the cloud's bounce. */
export const RAYS = { a: 4.6, b: 11.8 };
export const RISE = { a: 15.2, b: 19.8 };
export const TOWN = { a: 20.6, b: 27.6 };
export const FREE = { a: 28.4, b: 35.6 };
export const BOUNCE = { a: 45.0, b: 48.4 };
/** The day and night curve of the sand (the pasir beat) and the jacket card (the tips beat): shown from `a`, leave at `out`. */
export const CURVE = { a: 36.0, sweep: 37.0, out: 42.6 };
export const JACKET = { a: 49.6, out: 55.8 };

export function makePlan(story: StoryT) {
  const starts = story.beats.map((_, i) => story.beats.slice(0, i).reduce((a, b) => a + b.dur, 0));
  const total = story.beats.reduce((a, b) => a + b.dur, 0);
  const sting = starts[1] ?? 0;                                   // must 1: the "Intip yuk!" sting is the second beat
  const outro = starts.at(-1) ?? total;                           // must 2: the loop-back outro is the last beat
  const m = { sting, stingEnd: sting + (story.beats[1]?.dur ?? 1), react: NaN, outro, end: total };
  return {
    m, total, starts,
    // 0 at the start, 1 in the loop-back: the scene is the first beat's again at the end (the loop)
    loopWeight: (t: number) => Math.min(1, Math.max(0, (t - outro) / 0.5)),
    tops: [] as { b: number; headline?: string }[],
    labels: [] as { to: number; text: string }[],
  };
}

/** The hero's box at time t, in the 1080 px frame (x, y, w, h): the thermometer (about 150 world px wide, 800 tall). */
export const HERO_BOX_AT = (t: number) => {
  const c = camAt(t);
  return { x: 540 + (THERMO_X - c.x) * c.z, y: 960 + (1000 - c.y) * c.z, w: 165 * c.z, h: 850 * c.z };
};

/** The labels on the set (world coordinates, seconds of the video): shown from `from` to `to`. */
export type WLabel = { text: string; x: number; y: number; fs: number; from: number; to: number; lines?: string[] };
export const LABELS: WLabel[] = [
  { text: "sinar", x: 340, y: 780, fs: 52, from: 4.8, to: 7.4, lines: ["matahari"] },
  { text: "pasir menyerap", x: 330, y: 1190, fs: 52, from: 7.6, to: 11.8 },
  { text: "panas naik", x: 360, y: 640, fs: 54, from: 15.4, to: 17.4 },
  { text: "ke angkasa", x: 400, y: 400, fs: 52, from: 17.6, to: 19.6 },
  { text: "kota lembap", x: 1960, y: 1400, fs: 54, from: 21.6, to: 24.0 },
  { text: "uap air, awan", x: 1560, y: 560, fs: 50, from: 24.2, to: 27.4 },
  { text: "udara kering", x: 420, y: 520, fs: 54, from: 29.6, to: 32.4 },
  { text: "langit cerah", x: 460, y: 330, fs: 52, from: 32.6, to: 35.4 },
  { text: "awan menahan", x: 300, y: 700, fs: 50, from: 45.6, to: 48.8, lines: ["panas"] },
];
