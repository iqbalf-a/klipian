/* Kenapa perut bunyi saat lapar? — the timing and the camera of this video (pure: no React). Look 2d (B28), 100 s.
   The story is a trip: a Chibi person holds a growling belly (plain background, the hook), a round x-ray lens opens on the belly and shows the stomach and the small
   intestine, the camera zooms into the lens and on into the stomach (the inside of the stomach), then out through the exit (pylorus) into the small intestine (a tunnel),
   and finally back out: the lens zooms out to the person again. No lift, no room: the only places are the outside (plain) and the inside of the organs, as the story says.
   Every number here is read by index.tsx and sfx.ts so the picture and the sound agree.
   Loop (B41): zoom, lens, amplitude and the hook text are the same on the last frame as on the first.
   // signature-moment: jam | the wave squeezes the tunnel */
import type { StoryT } from "../../src/schema.ts";

type Key = { t: number; v: number };

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

/** The outside world (the person, 1080x1920): feet at FEET, u = the head's half-width, the belly and the x-ray lens on it. */
export const U = 360, FEET = { x: 540, y: 1760 };
export const BELLY = { x: 540, y: 1384 }, LENS_R = 228, GUT_S = 0.408;
export const T_STOMACH = { x: 495, y: 1355 }, T_GUT = { x: 540, y: 1515 };       // where the camera dives: the stomach, later the small intestine

/** ln(zoom) of the camera: 0 = the whole person (frame 0), 2.77 = x16, the stomach wall fills the frame. In again from 6 s, out again from 72 s. */
export const ZOOM_KEYS: Key[] = [{ t: 0, v: 0 }, { t: 6.0, v: 0 }, { t: 12.4, v: 1.95 }, { t: 14.6, v: 2.77 }, { t: 71.0, v: 2.77 }, { t: 72.0, v: 2.77 }, { t: 82.0, v: 0 }, { t: 100, v: 0 }];
export const LENS_KEYS: Key[] = [{ t: 0, v: 0 }, { t: 4.3, v: 0 }, { t: 5.3, v: 1.08 }, { t: 5.8, v: 1 }, { t: 82.0, v: 1 }, { t: 83.6, v: 0 }, { t: 100, v: 0 }];
export const lensAt = (t: number) => through(LENS_KEYS, t);
/** The camera: the centre (it drifts from the screen centre to the dive point as the zoom grows) and the zoom. */
/** The person rises in the frame while the lens opens (so the belly sits above the captions): the camera centre goes from the middle of the frame to the belly, and back at the end. */
export const PAN_KEYS: Key[] = [{ t: 0, v: 0 }, { t: 4.0, v: 0 }, { t: 5.2, v: 1 }, { t: 82.0, v: 1 }, { t: 84.0, v: 0 }, { t: 100, v: 0 }];
export function camAt(t: number) {
  const L = through(ZOOM_KEYS, t), k = Math.min(1, Math.max(0, L / 2.77)), T = t < 60 ? T_STOMACH : T_GUT, p = through(PAN_KEYS, t), c0y = 960 + (BELLY.y - 960) * p;
  return { z: Math.exp(L), x: 540 + (T.x - 540) * k, y: c0y + (T.y - c0y) * k };
}

/** How much of the inside shows over the outside: the stomach (15 to 41 s), the tunnel (42 to 69 s). */
export const STOMACH_KEYS: Key[] = [{ t: 0, v: 0 }, { t: 13.8, v: 0 }, { t: 15.2, v: 1 }, { t: 41.2, v: 1 }, { t: 42.6, v: 0 }, { t: 100, v: 0 }];
export const TUNNEL_KEYS: Key[] = [{ t: 0, v: 0 }, { t: 41.2, v: 0 }, { t: 42.6, v: 1 }, { t: 69.0, v: 1 }, { t: 70.4, v: 0 }, { t: 100, v: 0 }];
export const stomachAt = (t: number) => through(STOMACH_KEYS, t);
export const tunnelAt = (t: number) => through(TUNNEL_KEYS, t);
/** Inside the stomach the camera pushes toward the exit (the pylorus) in 39 to 41.8 s; the tunnel then settles from a push (42.6 to 44.5 s). */
export const STOMACH_ZOOM: Key[] = [{ t: 0, v: 1.35 }, { t: 15.2, v: 1.0 }, { t: 39.0, v: 1.0 }, { t: 41.8, v: 7 }, { t: 100, v: 7 }];
export const TUNNEL_ZOOM: Key[] = [{ t: 0, v: 1.5 }, { t: 42.6, v: 1.5 }, { t: 44.5, v: 1.0 }, { t: 100, v: 1.0 }];
export const PYLORUS = { x: 830, y: 1120 };                                            // the exit of the stomach, on the screen

/** How loud the growl is (sound rings): quiet while food is inside, full once empty, stronger in the hunger contractions, 1 again for the loop. */
export const AMP_KEYS: Key[] = [{ t: 0, v: 1 }, { t: 14.0, v: 1 }, { t: 15.6, v: 0.3 }, { t: 29.0, v: 0.3 }, { t: 31.0, v: 1 }, { t: 56.0, v: 1 }, { t: 62.0, v: 1.5 }, { t: 69.0, v: 1.5 }, { t: 72.0, v: 1 }, { t: 100, v: 1 }];
export const ampAt = (t: number) => through(AMP_KEYS, t);
/** The squeeze waves: 0.55 usually, up to 1.1 as the hunger contractions start (jam); wave B (twice as many) shows with them. */
export const WAVE_KEYS: Key[] = [{ t: 0, v: 0.55 }, { t: 56.0, v: 0.55 }, { t: 61.0, v: 1.1 }, { t: 69.0, v: 1.1 }, { t: 72.0, v: 0.55 }, { t: 100, v: 0.55 }];
export const waveAt = (t: number) => through(WAVE_KEYS, t);
export const WAVE_B_KEYS: Key[] = [{ t: 0, v: 0 }, { t: 58.0, v: 0 }, { t: 61.0, v: 1 }, { t: 69.0, v: 1 }, { t: 72.0, v: 0 }, { t: 100, v: 0 }];
export const waveBAt = (t: number) => through(WAVE_B_KEYS, t);

/** The food lump: pops in the stomach at a, leaves through the exit from out0 to out1. */
export const FOOD = { a: 15.6, out0: 29.0, out1: 31.6 };
/** The two labels of lambung, the two bars of kosong, the 2-hour track and pill of jam, the two cards of pesan. */
export const LABELS = { gas: 17.4, fluid: 18.0, out: 26.6 };
export const BARS = { a1: 30.0, a2: 32.8, out: 39.4 };
export const TRACK = { a: 57.4, fill0: 57.8, fill1: 62.6, pill: 63.0, out: 70.2 };
export const TREMOR = { a: 63.2, b: 64.8 };
export const CARDS = [{ a: 86.4, out: 95.4 }, { a: 90.0, out: 95.4 }];

/** The screen shudders when the hunger waves hit (px, a damped tremor), 0 before and after. */
export function tremorAt(t: number): number {
  const u = t - TREMOR.a;
  if (u < 0 || u > TREMOR.b - TREMOR.a) return 0;
  return 12 * Math.exp(-u * 2.2) * Math.sin(u * 46);
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

/** The hero's box at time t, in the 1080 px frame (centre and size): the person (head 2.1 u wide, 3.3 u high), whatever the camera does. */
export const HERO_BOX_AT = (t: number) => {
  const c = camAt(t);
  return { x: 540 + (FEET.x - c.x) * c.z, y: 960 + (FEET.y - 1.65 * U - c.y) * c.z, w: 2.1 * U * c.z, h: 3.3 * U * c.z };
};
