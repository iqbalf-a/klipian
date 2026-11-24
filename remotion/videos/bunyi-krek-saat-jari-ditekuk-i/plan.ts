/* Bunyi krek jari: bukan tulang patah — the timing and the camera of this video (pure: no React). Look 2d (B28): a flat view of one index finger over the keys of an
   upright piano; the middle joint has a window (a cutaway) onto the two bone ends, the film of fluid between them and the gas that makes the cavity.
   One world, one camera (camAt) by the clock of the whole video. Every number here is read by index.tsx and sfx.ts so the picture and the sound agree.
   Loop (B41): the first and the last camera key are the same, the finger returns to the hook pose, the set fades out and the hook text fades back in, so the last
   frame is the first frame. motion-exception: the dives into and out of the window last 1.2 s each, as the registry's pans do. */
import type { StoryT } from "../../src/schema.ts";

export type Cam = { x: number; y: number; z: number };
type Key = { t: number; v: number };
/** The middle joint, the pivot of the window (world px; 1 cm = 55 px). */
export const J = { x: 380, y: 1250 };

const HOOK: Cam = { x: 330, y: 1060, z: 1.05 };
/** Camera keys (seconds): focus (world x, y) and zoom. Between two keys the camera eases (in/out quad); equal keys hold. The last key is the first (the loop). */
export const CAM_KEYS: { t: number; c: Cam }[] = [
  { t: 0, c: HOOK },                                         // hook: the finger fills 74 % of the width, frame 0 already the claim
  { t: 3.0, c: { ...HOOK, z: 1.08 } },
  { t: 3.9, c: { x: 330, y: 1290, z: 0.78 } },               // the sting: pull back so the piano comes in around the hand
  { t: 4.6, c: { x: 330, y: 1290, z: 0.78 } },
  { t: 5.7, c: { x: 380, y: 1250, z: 1.95 } },                // cairan: dive into the window on the middle joint
  { t: 10.6, c: { x: 380, y: 1250, z: 2.05 } },
  { t: 11.8, c: { x: 470, y: 1250, z: 1.3 } },               // tarik: out enough to see the finger pulled, and the window
  { t: 19.4, c: { x: 470, y: 1250, z: 1.3 } },
  { t: 20.6, c: { x: 380, y: 1250, z: 1.95 } },               // rongga: back in on the gap
  { t: 27.4, c: { x: 380, y: 1250, z: 2.0 } },
  { t: 28.9, c: { x: 330, y: 1150, z: 0.95 } },              // tips: the whole finger low in the frame, the cards above it
  { t: 36.4, c: { x: 330, y: 1150, z: 0.95 } },
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

/** The set (piano, wall, floor): plain hook background at frame 0, it comes in with the sting pull-back and goes out again at the loop end. */
export const SET_KEYS: Key[] = [{ t: 0, v: 0 }, { t: 3.0, v: 0 }, { t: 3.9, v: 1 }, { t: 37.6, v: 1 }, { t: 39.2, v: 0 }, { t: 40, v: 0 }];
export const setAt = (t: number) => through(SET_KEYS, t);

/** The window on the middle joint (0 closed, 1 open). */
export const WIN_KEYS: Key[] = [{ t: 0, v: 0 }, { t: 4.9, v: 0 }, { t: 5.7, v: 1 }, { t: 28.0, v: 1 }, { t: 28.8, v: 0 }, { t: 40, v: 0 }];
export const winAt = (t: number) => through(WIN_KEYS, t);

/** The bend of the middle joint and of the last joint (degrees, + is toward the keys, - is bent back). The finger is pulled back, held, and the joint gives way. */
export const PIP_KEYS: Key[] = [
  { t: 0, v: 28 }, { t: 3, v: 28 }, { t: 4.4, v: 12 }, { t: 11, v: 12 }, { t: 12.5, v: 4 }, { t: 14.5, v: -2 }, { t: 16.2, v: -6 },
  { t: 16.8, v: -12 }, { t: 26, v: -12 }, { t: 26.45, v: -15 }, { t: 27.1, v: -12 }, { t: 28.8, v: 12 }, { t: 36.4, v: 12 }, { t: 38.4, v: 28 }, { t: 40, v: 28 },
];
export const DIP_KEYS: Key[] = [
  { t: 0, v: 18 }, { t: 3, v: 18 }, { t: 4.4, v: 8 }, { t: 11, v: 8 }, { t: 14.5, v: 0 }, { t: 16.8, v: -6 }, { t: 26, v: -6 }, { t: 28.8, v: 8 },
  { t: 36.4, v: 8 }, { t: 38.4, v: 18 }, { t: 40, v: 18 },
];
export const pipAt = (t: number) => through(PIP_KEYS, t);
export const dipAt = (t: number) => through(DIP_KEYS, t);

/** The gap between the two bone ends (px): a thin film at rest, it resists the pull, then the surfaces let go all at once. */
export const GAP_KEYS: Key[] = [
  { t: 0, v: 6 }, { t: 11.8, v: 6 }, { t: 16.2, v: 10 }, { t: 16.5, v: 10 }, { t: 16.8, v: 42 }, { t: 28.8, v: 42 }, { t: 29.4, v: 6 }, { t: 40, v: 6 },
];
export const gapAt = (t: number) => through(GAP_KEYS, t);

/** The pressure of the fluid (1 normal, low after the surfaces let go). */
export const PRESS_KEYS: Key[] = [{ t: 0, v: 1 }, { t: 16.6, v: 1 }, { t: 19.6, v: 0.22 }, { t: 28.8, v: 0.22 }, { t: 29.4, v: 1 }, { t: 40, v: 1 }];
export const pressAt = (t: number) => through(PRESS_KEYS, t);
export const PRESSURE = { a: 16.4, b: 28.4 };

/** The gas dissolved in the fluid gathers (0..1) from GATHER.a and the cavity opens on CRACK (the word "krek"). */
export const GATHER = { a: 22.0, b: 26.3 };
export const CRACK = 26.4;
/** The pull arrow on the fingertip. */
export const PULL = { a: 12.0, b: 16.7 };
/** The labels (screen space; `at` is the world point the leader line ends on). */
export type SLabel = { text: string; x: number; y: number; from: number; to: number; at?: [number, number] };
export const LABELS: SLabel[] = [
  { text: "tulang", x: 250, y: 640, from: 6.0, to: 10.4, at: [270, 1262] },
  { text: "cairan sendi", x: 760, y: 640, from: 7.6, to: 10.4, at: [J.x, J.y - 40] },
  { text: "ditarik", x: 800, y: 800, from: 12.1, to: 16.6 },
  { text: "tekanan turun", x: 560, y: 560, from: 18.7, to: 22.0 },
  { text: "rongga gas", x: 700, y: 640, from: 25.9, to: 27.9, at: [J.x, J.y] },
];
export const CARDS = [{ a: 28.9, out: 36.6 }, { a: 33.2, out: 36.6 }];

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

/** The hero's box at time t, in the 1080 px frame (x, y centre, w, h): the finger and the hand (760 world px wide), or the window while it is open. */
export const HERO_BOX_AT = (t: number) => {
  const c = camAt(t);
  if (winAt(t) > 0.5) return { x: 540 + (J.x - c.x) * c.z, y: 960 + (J.y - c.y) * c.z, w: 350 * c.z, h: 240 * c.z };
  return { x: 540 + (300 - c.x) * c.z, y: 960 + (1260 - c.y) * c.z, w: 760 * c.z, h: 260 * c.z };
};
