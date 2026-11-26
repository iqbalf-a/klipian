/* Kenapa HP panas dicas sambil main game — the timing and the camera of this video (pure: no React). Look 2d (B28): a phone seen flat from the front, one world, one camera
   (camAt) by the clock of the whole video. The phone flips to show its inside (a battery of six cells, a chip, the charging cord), the heat of the two parts grows and meets,
   a thick case and a soft pad trap it, the sensors read it, the phone slows itself down. Loop (B41): the first and the last camera key, flip, case, pad, glow and gauge are the
   same, the set fades out and the hook text fades back in over the last 0.5 s. Every number here is read by index.tsx and sfx.ts so the picture and the sound agree. */
import type { StoryT } from "../../src/schema.ts";

export type Cam = { x: number; y: number; z: number };
type Key = { t: number; v: number };

const HOOK: Cam = { x: 540, y: 900, z: 1.0 };           // the phone sits a little low on the plain hook colour, under the hook text
export const CAM_KEYS: { t: number; c: Cam }[] = [
  { t: 0, c: HOOK },                                         // hook: the phone fills 74 % of the width, frame 0 is already the claim
  { t: 3.0, c: HOOK },
  { t: 3.9, c: { x: 540, y: 985, z: 0.85 } },                // the sting: pull back, the corner comes in around the phone
  { t: 4.6, c: { x: 540, y: 985, z: 0.85 } },
  { t: 5.8, c: { x: 480, y: 975, z: 0.9 } },                // cas: push toward the battery (left half)
  { t: 10.6, c: { x: 480, y: 975, z: 0.9 } },
  { t: 11.9, c: { x: 610, y: 975, z: 0.9 } },               // game: ease right to the chip
  { t: 18.6, c: { x: 610, y: 975, z: 0.9 } },
  { t: 19.9, c: { x: 540, y: 1000, z: 0.85 } },              // numpuk: wide again, the case and the pad need room
  { t: 26.6, c: { x: 540, y: 1000, z: 0.85 } },
  { t: 27.9, c: { x: 540, y: 975, z: 0.9 } },                // sensor: the three pins
  { t: 34.6, c: { x: 540, y: 975, z: 0.9 } },
  { t: 35.8, c: { x: 540, y: 1160, z: 0.85 } },              // hasil: the phone rides high, the three cards sit under it
  { t: 41.6, c: { x: 540, y: 1160, z: 0.85 } },
  { t: 42.9, c: { x: 500, y: 985, z: 0.9 } },               // umur: the battery
  { t: 49.6, c: { x: 500, y: 985, z: 0.9 } },
  { t: 50.9, c: { x: 540, y: 1160, z: 0.85 } },              // tips: the three tip cards
  { t: 56.4, c: { x: 540, y: 1160, z: 0.85 } },
  { t: 58.2, c: HOOK },                                      // the loop-back: exactly the first shot
  { t: 60, c: HOOK },
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
const K = (pairs: [number, number][]): Key[] => pairs.map(([t, v]) => ({ t, v }));
export function camAt(t: number): Cam {
  const k = (get: (c: Cam) => number): Key[] => CAM_KEYS.map((q) => ({ t: q.t, v: get(q.c) }));
  return { x: through(k((c) => c.x), t), y: through(k((c) => c.y), t), z: through(k((c) => c.z), t) };
}

/** The corner (wall, floor, crate, beanbag, pennants): plain hook background at frame 0, it comes in with the sting pull-back and goes out again at the loop end. */
export const setAt = (t: number) => through(K([[0, 0], [3.0, 0], [3.9, 1], [57.6, 1], [59.2, 0], [60, 0]]), t);

/** The flip: 0 = the front (the game screen), 1 = the back opened up (battery, chip, cord). Four flips, each 0.7 s. */
export const FLIPS = [4.0, 35.2, 42.0, 50.0];
export const flipAt = (t: number) => through(K([[0, 0], [4.0, 0], [4.7, 1], [35.2, 1], [35.9, 0], [42.0, 0], [42.7, 1], [50.0, 1], [50.7, 0], [60, 0]]), t);

/** The heat of the battery and of the chip (0..1), the heat that waves off the front face, the case, the pad, the body temperature gauge and the chip's work. */
export const batHeatAt = (t: number) => through(K([[0, 0], [4.8, 0.05], [10, 0.7], [36, 0.78], [50, 0.7], [55.5, 0.12], [60, 0]]), t);
export const chipHeatAt = (t: number) => through(K([[0, 0], [11.2, 0.05], [16, 0.85], [31, 0.92], [34, 0.6], [50, 0.62], [55.5, 0.1], [60, 0]]), t);
export const frontHeatAt = (t: number) => through(K([[0, 0.8], [3.5, 0.8], [4.3, 0], [35.3, 0], [36, 0.9], [41.6, 0.9], [42, 0], [50.4, 0], [50.9, 0.7], [55, 0.12], [57.6, 0.12], [59.6, 0.8], [60, 0.8]]), t);
export const caseAt = (t: number) => through(K([[0, 0], [22.5, 0], [23.4, 1], [51.2, 1], [51.9, 0], [60, 0]]), t);
export const padAt = (t: number) => through(K([[0, 0], [24.0, 0], [24.8, 1], [52.0, 1], [52.7, 0], [60, 0]]), t);
export const tempAt = (t: number) => through(K([[11.6, 0.2], [18.5, 0.55], [23, 0.8], [27, 0.86], [31, 0.96], [34, 0.82], [41, 0.9], [50, 0.9], [52, 0.7], [56, 0.25], [57.6, 0.25]]), t);
export const GAUGE = { a: 11.6, b: 57.6 };
export const loadAt = (t: number) => through(K([[0, 0], [11.6, 0.1], [12.6, 1], [31, 1], [32.6, 0.45], [50, 0.45], [51, 0.05], [60, 0.05]]), t);
/** How far the phone has slowed itself (0 = full performance): the screen brightness, the frames, the charge speed. */
export const dimAt = (t: number) => through(K([[0, 0], [36.2, 0], [38.6, 0.55], [42, 0.55], [50.6, 0.55], [51.4, 0], [60, 0]]), t);

/** Charge: six cells, each fills at CELL_A + i * CELL_STEP; the current flows in the cord from FLOW.a to FLOW.b; the cells age from AGE.a (the last two go grey). */
export const CELL_A = 5.2, CELL_STEP = 0.9;
export const FLOW = { a: 4.8, b: 50.0 };
export const AGE = { a: 44.0, step: 2.2 };
/** Labels on the phone (local coordinates): seconds in, seconds out. */
export const LABELS = {
  bat: { a: 5.2, b: 10.8 }, game: { a: 12.0, b: 18.6 }, casing: { a: 23.0, b: 26.8 }, kasur: { a: 24.6, b: 26.8 },
  pins: { a: 28.2, b: 34.6 }, rem: { a: 32.0, b: 34.6 }, umur: { a: 43.4, b: 49.6 }, rem2: { a: 47.0, b: 49.6 },
};
/** The three result cards (hasil) and the three tip cards (tips): pop in at a, bars fall to `to`. */
export const RESULT = [{ a: 36.4, to: 0.4 }, { a: 38.0, to: 0.45 }, { a: 39.6, to: 0.3 }];
export const RESULT_OUT = 41.6;
export const TIPS = [{ a: 51.4 }, { a: 53.0 }, { a: 54.6 }];
export const TIPS_OUT = 57.0;
export const PAUSE = 51.2;

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

/** The hero's box at time t, in the 1080 px frame: the phone is 800 wide and 360 high around the world point (540, 960). */
export const HERO_BOX_AT = (t: number) => {
  const c = camAt(t);
  return { x: 540 + (540 - c.x) * c.z, y: 960 + (960 - c.y) * c.z, w: 800 * c.z, h: 360 * c.z };
};
