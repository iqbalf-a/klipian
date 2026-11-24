/* Bunyi krek jari: bukan tulang patah — the timing and the camera of this video (pure: no React). Look 2d (B28): the back of a left hand over the keys of a piano seen
   from above (B56: a whole hand, thumb and four fingers); a second hand pinches the tip of the index finger and pulls; the index finger's middle joint has a window (a
   cutaway) onto the two bone ends, the film of fluid between them and the gas that makes the cavity. One world, one camera (camAt) by the clock of the whole video.
   Every number here is read by index.tsx and sfx.ts so the picture and the sound agree.
   Loop (B41): the first and the last camera key are the same, the pulling hand is back, the set fades out and the hook text fades back in, so the last frame is the
   first frame. motion-exception: the dives into and out of the window last 1.2 s each, as the registry's pans do. */
import type { StoryT } from "../../src/schema.ts";

export type Cam = { x: number; y: number; z: number };
type Key = { t: number; v: number };
/** The index finger's middle joint, the pivot of the window (world px; 1 cm = 55 px). The back of the hand is drawn in index.tsx around it. */
export const J = { x: 658, y: 999 };

const HOOK: Cam = { x: 580, y: 960, z: 1.0 };
/** Camera keys (seconds): focus (world x, y) and zoom. Between two keys the camera eases (in/out quad); equal keys hold. The last key is the first (the loop). */
export const CAM_KEYS: { t: number; c: Cam }[] = [
  { t: 0, c: HOOK },                                         // hook: the whole hand and the pinching fingers fill 77 % of the width, frame 0 already the claim
  { t: 3.0, c: { ...HOOK, z: 1.03 } },
  { t: 3.9, c: { x: 580, y: 1030, z: 0.8 } },                // the sting: pull back so the piano comes in around the hand
  { t: 4.6, c: { x: 580, y: 1030, z: 0.8 } },
  { t: 5.7, c: { x: J.x, y: J.y, z: 2.5 } },                 // cairan: dive into the window on the middle joint
  { t: 10.6, c: { x: J.x, y: J.y, z: 2.6 } },
  { t: 11.8, c: { x: 650, y: 880, z: 1.5 } },                // tarik: out enough to see the pinch and the pull, and the window
  { t: 19.4, c: { x: 650, y: 880, z: 1.5 } },
  { t: 20.6, c: { x: J.x, y: J.y, z: 2.5 } },                // rongga: back in on the gap
  { t: 27.4, c: { x: J.x, y: J.y, z: 2.6 } },
  { t: 28.9, c: { x: 580, y: 700, z: 0.95 } },               // tips: the whole hand low in the frame, the cards above it
  { t: 36.4, c: { x: 580, y: 700, z: 0.95 } },
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

/** The set (the piano from above, a sheet, the lid): plain hook background at frame 0, it comes in with the sting pull-back and goes out again at the loop end. */
export const SET_KEYS: Key[] = [{ t: 0, v: 0 }, { t: 3.0, v: 0 }, { t: 3.9, v: 1 }, { t: 37.6, v: 1 }, { t: 39.2, v: 0 }, { t: 40, v: 0 }];
export const setAt = (t: number) => through(SET_KEYS, t);

/** The window on the middle joint (0 closed, 1 open). */
export const WIN_KEYS: Key[] = [{ t: 0, v: 0 }, { t: 4.9, v: 0 }, { t: 5.7, v: 1 }, { t: 28.0, v: 1 }, { t: 28.8, v: 0 }, { t: 40, v: 0 }];
export const winAt = (t: number) => through(WIN_KEYS, t);

/** The gap between the two bone ends (px): a thin film at rest, it resists the pull, then the surfaces let go all at once. */
export const GAP_KEYS: Key[] = [
  { t: 0, v: 6 }, { t: 11.8, v: 6 }, { t: 16.2, v: 10 }, { t: 16.5, v: 10 }, { t: 16.8, v: 42 }, { t: 28.8, v: 42 }, { t: 29.4, v: 6 }, { t: 40, v: 6 },
];
export const gapAt = (t: number) => through(GAP_KEYS, t);
/** How far the pulling hand has drawn the fingertip away (px, on top of the gap): a light pull already in the hook, none while the window explains, a held pull before the crack. */
export const PULL_KEYS: Key[] = [
  { t: 0, v: 12 }, { t: 3, v: 12 }, { t: 4.4, v: 0 }, { t: 11.8, v: 0 }, { t: 16.2, v: 16 }, { t: 16.5, v: 16 }, { t: 16.8, v: 4 }, { t: 26, v: 4 }, { t: 26.45, v: 10 }, { t: 27.1, v: 4 },
  { t: 28.8, v: 0 }, { t: 36.4, v: 0 }, { t: 38.4, v: 12 }, { t: 40, v: 12 },
];
export const pullAt = (t: number) => through(PULL_KEYS, t);
/** The pulling hand's sideways slide (px to the right, off the frame): it is gone while the tip cards show and comes back for the loop. */
export const AWAY_KEYS: Key[] = [{ t: 0, v: 0 }, { t: 28.4, v: 0 }, { t: 29.4, v: 560 }, { t: 36.4, v: 560 }, { t: 38.2, v: 0 }, { t: 40, v: 0 }];
export const awayAt = (t: number) => through(AWAY_KEYS, t);

/** The pressure of the fluid (1 normal, low after the surfaces let go). */
export const PRESS_KEYS: Key[] = [{ t: 0, v: 1 }, { t: 16.6, v: 1 }, { t: 19.6, v: 0.22 }, { t: 28.8, v: 0.22 }, { t: 29.4, v: 1 }, { t: 40, v: 1 }];
export const pressAt = (t: number) => through(PRESS_KEYS, t);
export const PRESSURE = { a: 16.4, b: 28.4 };

/** The gas dissolved in the fluid gathers (0..1) from GATHER.a and the cavity opens on CRACK (the word "krek"). */
export const GATHER = { a: 22.0, b: 26.3 };
export const CRACK = 26.4;
/** The pull arrow above the fingertip. */
export const PULL = { a: 12.0, b: 16.7 };
/** The labels (screen space; `at` is the world point the leader line ends on). */
export type SLabel = { text: string; x: number; y: number; from: number; to: number; at?: [number, number] };
export const LABELS: SLabel[] = [
  { text: "tulang", x: 250, y: 1330, from: 6.0, to: 10.4, at: [J.x, J.y + 120] },
  { text: "cairan sendi", x: 790, y: 640, from: 7.6, to: 10.4, at: [J.x + 40, J.y - 40] },
  { text: "ditarik", x: 800, y: 620, from: 12.1, to: 16.6 },
  { text: "tekanan turun", x: 600, y: 560, from: 18.7, to: 22.0 },
  { text: "rongga gas", x: 770, y: 700, from: 25.9, to: 27.9, at: [J.x, J.y] },
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

/** The hero's box at time t, in the 1080 px frame (x, y centre, w, h): the hand with the pinching fingers (800 world px wide), or the window while it is open. */
export const HERO_BOX_AT = (t: number) => {
  const c = camAt(t);
  if (winAt(t) > 0.5) return { x: 540 + (J.x - c.x) * c.z, y: 960 + (J.y - c.y) * c.z, w: 250 * c.z, h: 350 * c.z };
  return { x: 540 + (640 - c.x) * c.z, y: 960 + (1250 - c.y) * c.z, w: 780 * c.z, h: 1090 * c.z };
};
