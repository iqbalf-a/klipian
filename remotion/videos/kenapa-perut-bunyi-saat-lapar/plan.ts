/* Kenapa perut bunyi saat lapar? — the timing and the camera of this video (pure: no React). Look 2d (B28): a stomach and its small intestine, drawn whole and flat from the
   front, float in front of the closed doors of a lift car (the quiet small room where a growl is heard). No person is drawn (B43).
   One world, one camera (camAt) by the clock of the whole video. Every number here is read by index.tsx and sfx.ts so the picture and the sound agree.
   Loop (B41): the first and the last camera key, hero position, hero scale and the sound amplitude are the same, the lift fades out and the hook text fades back in over the last 0.5 s.
   // signature-moment: jam | rings rattle the lift */
import type { StoryT } from "../../src/schema.ts";

export type Cam = { x: number; y: number; z: number };
type Key = { t: number; v: number };

const HOOK: Cam = { x: 540, y: 960, z: 1.0 };
export const CAM_KEYS: { t: number; c: Cam }[] = [
  { t: 0, c: HOOK },                                           // hook: the gut fills 75 % of the width, frame 0 already the claim
  { t: 3.0, c: { ...HOOK, z: 1.03 } },
  { t: 3.9, c: { x: 540, y: 1010, z: 0.9 } },                  // the sting: pull back so the lift comes in around the gut
  { t: 4.6, c: { x: 540, y: 1010, z: 0.9 } },
  { t: 5.6, c: { x: 520, y: 1000, z: 0.97 } },                 // remas: push toward the stomach
  { t: 10.6, c: { x: 520, y: 1000, z: 0.97 } },
  { t: 11.9, c: { x: 600, y: 1010, z: 0.9 } },                 // kosong: ease right toward the call panel
  { t: 18.6, c: { x: 600, y: 1010, z: 0.9 } },
  { t: 19.9, c: { x: 540, y: 1030, z: 0.97 } },                // jam: push in, the turn
  { t: 27.6, c: { x: 540, y: 1030, z: 0.97 } },
  { t: 28.9, c: { x: 540, y: 1040, z: 0.8 } },                 // pesan: pull out to leave room for the two cards
  { t: 35.4, c: { x: 540, y: 1040, z: 0.8 } },
  { t: 38.4, c: HOOK },                                        // the loop-back: exactly the first shot
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

/** The lift: plain hook background at frame 0, it comes in with the sting pull-back and goes out again at the loop end. */
export const SET_KEYS: Key[] = [{ t: 0, v: 0 }, { t: 3.0, v: 0 }, { t: 3.9, v: 1 }, { t: 37.4, v: 1 }, { t: 39.0, v: 0 }, { t: 40, v: 0 }];
export const setAt = (t: number) => through(SET_KEYS, t);

/** The gut: centre and scale (1 = 740 px wide, 800 high). Big at the hook, it floats up in front of the doors when the lift comes in and comes back for the loop. */
export const HERO_KEYS = {
  y: [{ t: 0, v: 1060 }, { t: 3.0, v: 1060 }, { t: 3.9, v: 840 }, { t: 36.0, v: 840 }, { t: 38.4, v: 1060 }, { t: 40, v: 1060 }] as Key[],
  s: [{ t: 0, v: 1.1 }, { t: 3.0, v: 1.1 }, { t: 3.9, v: 0.95 }, { t: 36.0, v: 0.95 }, { t: 38.4, v: 1.1 }, { t: 40, v: 1.1 }] as Key[],
};
export const heroAt = (t: number) => ({ x: 540, y: through(HERO_KEYS.y, t), s: through(HERO_KEYS.s, t) });

/** How loud the growl is (sound rings): 1 at the hook, quiet while food is inside (remas), full again once the stomach is empty, growing in jam, back to 1 for the loop. */
export const AMP_KEYS: Key[] = [
  { t: 0, v: 1 }, { t: 4.4, v: 1 }, { t: 5.2, v: 0.3 }, { t: 12.7, v: 0.3 }, { t: 14.0, v: 1 }, { t: 20.0, v: 1 }, { t: 24.4, v: 1.4 }, { t: 28.0, v: 1.4 }, { t: 30.0, v: 1 }, { t: 40, v: 1 },
];
export const ampAt = (t: number) => through(AMP_KEYS, t);
/** The squeeze wave along the gut: 0.55 usually, up to 1 as the hunger contractions start (jam), back for the loop. Wave B (twice as many) shows with it. */
export const WAVE_KEYS: Key[] = [{ t: 0, v: 0.55 }, { t: 19.0, v: 0.55 }, { t: 24.4, v: 1 }, { t: 28.0, v: 1 }, { t: 31.0, v: 0.55 }, { t: 40, v: 0.55 }];
export const waveAt = (t: number) => through(WAVE_KEYS, t);
export const WAVE_B_KEYS: Key[] = [{ t: 0, v: 0 }, { t: 21.0, v: 0 }, { t: 24.4, v: 1 }, { t: 28.0, v: 1 }, { t: 31.0, v: 0 }, { t: 40, v: 0 }];
export const waveBAt = (t: number) => through(WAVE_B_KEYS, t);

/** The food lump in the stomach: pops in at a (the stomach is full), slides to the exit and shrinks away from out0 to out1 (the stomach is empty). */
export const FOOD = { a: 4.6, out0: 12.7, out1: 14.0 };
/** The two labels of remas, the two bars of kosong, the 2-hour track and the pill of jam, the two cards of pesan. */
export const LABELS = { gas: 6.4, fluid: 7.0, out: 10.6 };
export const BARS = { a1: 14.3, a2: 16.6, out: 18.8 };
export const TRACK = { a: 20.4, fill0: 20.8, fill1: 24.2, pill: 24.4, out: 27.8 };
export const TREMOR = { a: 24.6, b: 25.9 };
export const CARDS = [{ a: 29.6, out: 35.6 }, { a: 32.6, out: 35.6 }];

/** The lift shudders when the rings of the hunger contractions hit it (px, a damped tremor), 0 before and after. */
export function tremorAt(t: number): number {
  const u = t - TREMOR.a;
  if (u < 0 || u > TREMOR.b - TREMOR.a) return 0;
  return 9 * Math.exp(-u * 2.6) * Math.sin(u * 46);
}

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

/** The hero's box at time t, in the 1080 px frame: the gut (740 px wide at scale 1, 800 high). */
export const HERO_BOX_AT = (t: number) => {
  const c = camAt(t), h = heroAt(t);
  return { x: 540 + (h.x - c.x) * c.z, y: 960 + (h.y - c.y) * c.z, w: 740 * h.s * c.z, h: 800 * h.s * c.z };
};
