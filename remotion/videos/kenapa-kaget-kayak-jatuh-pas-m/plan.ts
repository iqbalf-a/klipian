/* Kenapa kaget kayak jatuh pas mau tidur — the timing and the camera of this video (pure: no React). Look 2d (B28): a brain seen from the side floats over a bed seen from
   the side at night (no person is drawn: the sleeper is a lump under a blanket, B43). One world, one camera (camAt) by the clock of the whole video.
   Loop (B41): the first and the last camera key, brain position and brain scale are the same, the room fades out and the hook text fades back in over the last 0.5 s.
   Every number here is read by index.tsx and sfx.ts so the picture and the sound agree. */
import type { StoryT } from "../../src/schema.ts";

export type Cam = { x: number; y: number; z: number };
type Key = { t: number; v: number };

const HOOK: Cam = { x: 540, y: 960, z: 1.0 };
export const CAM_KEYS: { t: number; c: Cam }[] = [
  { t: 0, c: HOOK },                                         // hook: the brain fills 74 % of the width, frame 0 already the claim
  { t: 3.0, c: { ...HOOK, z: 1.03 } },
  { t: 3.9, c: { x: 520, y: 1120, z: 0.82 } },               // the sting: pull back so the bedroom comes in around the brain
  { t: 4.6, c: { x: 520, y: 1120, z: 0.82 } },
  { t: 5.6, c: { x: 470, y: 1090, z: 0.95 } },               // rileks: push toward the blanket and the gauge
  { t: 10.6, c: { x: 470, y: 1090, z: 0.95 } },
  { t: 11.9, c: { x: 700, y: 1120, z: 0.88 } },              // umum: ease right, the ten icons sit above the bed
  { t: 18.6, c: { x: 700, y: 1120, z: 0.88 } },
  { t: 19.8, c: { x: 500, y: 1060, z: 0.9 } },               // dugaan: the brain and the blanket in one shot
  { t: 27.6, c: { x: 500, y: 1060, z: 0.9 } },
  { t: 28.9, c: { x: 800, y: 1180, z: 0.9 } },               // pemicu: toward the nightstand
  { t: 35.6, c: { x: 800, y: 1180, z: 0.9 } },
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

/** The room (bed, window, nightstand): plain hook background at frame 0, it comes in with the sting pull-back and goes out again at the loop end. */
export const SET_KEYS: Key[] = [{ t: 0, v: 0 }, { t: 3.0, v: 0 }, { t: 3.9, v: 1 }, { t: 37.4, v: 1 }, { t: 39.0, v: 0 }, { t: 40, v: 0 }];
export const setAt = (t: number) => through(SET_KEYS, t);

/** The brain: centre and scale (1 = 800 px wide). Big at the hook, it rises over the pillow when the room comes in and comes back for the loop. */
export const BRAIN_KEYS = {
  x: [{ t: 0, v: 540 }, { t: 3.0, v: 540 }, { t: 3.9, v: 430 }, { t: 36.0, v: 430 }, { t: 38.4, v: 540 }, { t: 40, v: 540 }] as Key[],
  y: [{ t: 0, v: 1000 }, { t: 3.0, v: 1000 }, { t: 3.9, v: 770 }, { t: 36.0, v: 770 }, { t: 38.4, v: 1000 }, { t: 40, v: 1000 }] as Key[],
  s: [{ t: 0, v: 0.96 }, { t: 3.0, v: 0.96 }, { t: 3.9, v: 0.52 }, { t: 36.0, v: 0.52 }, { t: 38.4, v: 0.96 }, { t: 40, v: 0.96 }] as Key[],
};
export const brainAt = (t: number) => ({ x: through(BRAIN_KEYS.x, t), y: through(BRAIN_KEYS.y, t), s: through(BRAIN_KEYS.s, t) });

/** How relaxed the muscles are (1 awake, 0.3 nearly asleep): it sinks slowly in rileks, falls fast at "otot yang lemas" (dugaan), springs back on the jolt. */
export const MUSCLE_KEYS: Key[] = [
  { t: 0, v: 1 }, { t: 4.6, v: 1 }, { t: 10.6, v: 0.3 }, { t: 22.0, v: 0.3 }, { t: 23.4, v: 0.05 }, { t: 27.0, v: 0.05 }, { t: 27.4, v: 1 }, { t: 40, v: 1 },
];
export const muscleAt = (t: number) => through(MUSCLE_KEYS, t);
export const GAUGE = { a: 4.5, b: 10.9, a2: 22.2, b2: 28.4 };      // the two windows the gauge card is on screen

/** The alarm: the "JATUH?!" bubble, the red pulses around the brain, the zigzag down to the blanket, and the jolt of the bed. */
export const BUBBLE = { a: 24.7, b: 28.0 };
export const ZAP = { a: 26.2, b: 27.4 };
export const JOLT = 27.0;
/** The bed's hop after the jolt (px up): a fast rise and a springy fall; 0 before and after. */
export function joltAt(t: number): number {
  const u = t - JOLT;
  if (u < 0 || u > 1.3) return 0;
  return 78 * Math.exp(-u * 3.2) * Math.abs(Math.sin(u * 7.2)) * (u < 0.12 ? u / 0.12 : 1);
}

/** The ten icons of "umum" (seven of ten have the jolt mark: 60 to 70 %), each pops in at a + i * step, and the pill. */
export const ICONS = { a: 12.3, step: 0.2, out: 18.7 };
export const PILL = { a: 13.6, b: 18.7 };
/** The two tip cards (pemicu) and the cup of coffee on the nightstand. */
export const CARDS = [{ a: 29.2, out: 35.7 }, { a: 32.4, out: 35.7 }];
export const CUP = { a: 28.6 };

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

/** The hero's box at time t, in the 1080 px frame: the brain (800 px wide at scale 1, about 560 high). */
export const HERO_BOX_AT = (t: number) => {
  const c = camAt(t), b = brainAt(t);
  return { x: 540 + (b.x - c.x) * c.z, y: 960 + (b.y - c.y) * c.z, w: 800 * b.s * c.z, h: 560 * b.s * c.z };
};
