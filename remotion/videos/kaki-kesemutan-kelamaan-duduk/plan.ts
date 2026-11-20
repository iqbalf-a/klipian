/* Kakimu bukan tidur, sarafnya kejepit — the timing and the camera of this video (pure: no React). Look 2d (B28): a flat side view of a leg of someone sitting on a bench
   at a bus stop; the thigh has a window (a cutaway) onto the nerve and the blood vessel under it. One world, one camera (camAt) by the clock of the whole video.
   Every number here is read by index.tsx and sfx.ts so the picture and the sound agree.
   motion-exception: the pull-back from the nerve window to the whole leg (beat 'duduk') and the pan down to the foot ('berdiri') last 1.2 s each, as the registry's
   pans do; the hook has no establishing push (B41: frame 0 is already the hook, the camera only creeps in). */
import type { StoryT } from "../../src/schema.ts";

export type Cam = { x: number; y: number; z: number };
type Key = { t: number; v: number };

/** Camera keys (seconds of the video): focus (world x, y) and zoom. Between two keys the camera eases (in/out quad); equal keys hold. The last key is the first (the loop). */
export const CAM_KEYS: { t: number; c: Cam }[] = [
  { t: 0, c: { x: 540, y: 1080, z: 0.85 } },      // hook: the leg on the bench, frame 0 already the claim
  { t: 3.0, c: { x: 540, y: 1080, z: 0.9 } },
  { t: 3.9, c: { x: 540, y: 1080, z: 0.9 } },    // the sting
  { t: 5.0, c: { x: 485, y: 1085, z: 2.1 } },     // saraf: in to the window on the thigh
  { t: 9.4, c: { x: 485, y: 1085, z: 2.2 } },
  { t: 10.7, c: { x: 560, y: 1100, z: 0.85 } },    // duduk: back out to the whole leg
  { t: 17.6, c: { x: 560, y: 1100, z: 0.88 } },
  { t: 19.6, c: { x: 800, y: 1345, z: 1.65 } },   // berdiri: down to the shin and the foot (60 to 70 % of the width)
  { t: 25.0, c: { x: 800, y: 1345, z: 1.65 } },
  { t: 26.5, c: { x: 485, y: 1085, z: 2.1 } },    // jepit: the window again, now with the answer
  { t: 31.6, c: { x: 485, y: 1085, z: 2.2 } },
  { t: 32.9, c: { x: 560, y: 1010, z: 0.8 } },    // tips: the whole leg low in the frame, the cards above it
  { t: 36.6, c: { x: 560, y: 1010, z: 0.8 } },
  { t: 38.4, c: { x: 540, y: 1080, z: 0.85 } },    // the loop-back: the first shot
  { t: 40, c: { x: 540, y: 1080, z: 0.85 } },
];

const ease = (x: number) => (x < 0.5 ? 2 * x * x : 1 - 2 * (1 - x) * (1 - x));
function through(keys: Key[], t: number): number {
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

/** The window on the thigh (0 closed, 1 open): it shows the nerve and the vessel while the beats 'saraf' and 'jepit' talk about them. */
export const WIN_KEYS: Key[] = [
  { t: 0, v: 0 }, { t: 4.4, v: 0 }, { t: 5.1, v: 1 }, { t: 9.5, v: 1 }, { t: 10.1, v: 0 },
  { t: 26.2, v: 0 }, { t: 26.8, v: 1 }, { t: 31.7, v: 1 }, { t: 32.3, v: 0 }, { t: 40, v: 0 },
];
export const winAt = (t: number) => through(WIN_KEYS, t);

/** The thigh lifts off the seat (0 seated, 1 lifted: the person gets up). */
export const LIFT_KEYS: Key[] = [
  { t: 0, v: 0 }, { t: 18.9, v: 0 }, { t: 19.5, v: 1 }, { t: 25.0, v: 1 }, { t: 25.8, v: 0 },
  { t: 29.0, v: 0 }, { t: 29.5, v: 1 }, { t: 31.4, v: 1 }, { t: 32.2, v: 0 }, { t: 40, v: 0 },
];
export const liftAt = (t: number) => through(LIFT_KEYS, t);

/** How hard the nerve and its vessel are squeezed (0 free, 1 pinched flat). */
export const SQ_KEYS: Key[] = [
  { t: 0, v: 0 }, { t: 17.0, v: 0 }, { t: 18.8, v: 0.6 }, { t: 19.5, v: 0 }, { t: 26.9, v: 0 },
  { t: 28.0, v: 1 }, { t: 29.0, v: 1 }, { t: 29.5, v: 0 }, { t: 40, v: 0 },
];
export const sqAt = (t: number) => through(SQ_KEYS, t);

/** The needles of pins and needles around the foot (0 none, 1 many). It starts at 0.8 in the hook (a hint of the stake) and ends at 0.8 again (the loop). */
export const PRICK_KEYS: Key[] = [
  { t: 0, v: 0.8 }, { t: 2.7, v: 0.8 }, { t: 3.6, v: 0 }, { t: 19.3, v: 0 }, { t: 19.9, v: 1 }, { t: 24.4, v: 1 }, { t: 25.2, v: 0 },
  { t: 29.4, v: 0 }, { t: 29.9, v: 0.9 }, { t: 31.4, v: 0.9 }, { t: 32.2, v: 0 }, { t: 38.4, v: 0 }, { t: 39.6, v: 0.8 }, { t: 40, v: 0.8 },
];
export const prickAt = (t: number) => through(PRICK_KEYS, t);

/** The nerve fires by itself (the sparks in the window) once the pressure is gone. */
export const FIRE = { a: 29.5, b: 31.6 };
/** The weight on the thigh (the arrows of 'duduk'), the foot that feels thick, and the foot that wiggles (the tip). */
export const WEIGHT = { a: 11.0, b: 17.6 };
export const THICK = { a: 14.5, b: 18.6 };
export const WIGGLE = { a: 33.4, b: 36.6 };
/** The tip cards (screen space) and the labels (screen space; `at` is the world point the leader line ends on). */
export const CARDS = [{ a: 33.0, out: 36.6 }, { a: 34.1, out: 36.6 }];
export type SLabel = { text: string; x: number; y: number; from: number; to: number; at?: [number, number] };
export const LABELS: SLabel[] = [
  { text: "saraf", x: 250, y: 690, from: 5.4, to: 9.4, at: [380, 1114] },
  { text: "pembuluh darah", x: 690, y: 690, from: 6.4, to: 9.4, at: [560, 1086] },
  { text: "berat badan", x: 400, y: 650, from: 11.4, to: 17.2 },
  { text: "dijepit", x: 250, y: 690, from: 27.1, to: 29.0, at: [380, 1114] },
  { text: "darah berkurang", x: 690, y: 690, from: 27.5, to: 29.0, at: [560, 1086] },
  { text: "menyala lagi", x: 300, y: 690, from: 29.8, to: 31.6, at: [400, 1114] },
];

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

/** The hero's box at time t, in the 1080 px frame (x, y, w, h): the seated leg (thigh to toes, about 840 world px wide, 700 tall). */
export const HERO_BOX_AT = (t: number) => {
  const c = camAt(t);
  if (t >= 18.5 && t < 26.2) return { x: 540 + (590 - c.x) * c.z, y: 960 + (1078 - c.y) * c.z, w: 395 * c.z, h: 612 * c.z };   // 'berdiri': the hero is the shin and the foot
  if (winAt(t) > 0.5) return { x: 540 + (303 - c.x) * c.z, y: 960 + (1000 - c.y) * c.z, w: 298 * c.z, h: 150 * c.z };   // in the window beats the hero is the window on the thigh
  return { x: 540 + (540 - c.x) * c.z, y: 960 + (1340 - c.y) * c.z, w: 840 * c.z, h: 700 * c.z };
};
