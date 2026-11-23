/* Mata kedutan? Bukan pertanda: the timing and the camera of this video (pure: no React). Look 2d (B28): a flat FRONT view of one eye in a round wall mirror; the upper
   lid has a window (a cutaway) onto the thin eyelid muscle and the facial nerve that moves it. One world, one camera (camAt) by the clock of the whole video.
   Every number is read by index.tsx and sfx.ts so the picture and the sound agree.
   motion-exception: the dive into the lid window (beat 'saraf') and the pull-back from it last 0.9 s each, as the registry's pans do; the hook has no establishing push
   (B41: frame 0 is already the claim, the camera only creeps in). */
import type { StoryT } from "../../src/schema.ts";

export type Cam = { x: number; y: number; z: number };
type Key = { t: number; v: number };

export const MIRROR = { x: 540, y: 1150, r: 420 };       // the round mirror (world px); the eye sits in its middle
export const WIN = { x: 540, y: 985, rx: 270, ry: 86 };   // the window on the upper lid

/** Camera keys (seconds of the video): focus (world x, y) and zoom. Between two keys the camera eases (in/out quad); equal keys hold. The last key is the first (the loop). */
export const CAM_KEYS: { t: number; c: Cam }[] = [
  { t: 0, c: { x: 540, y: 1070, z: 1.0 } },       // hook: the mirror fills 78 % of the width, the eye in the middle, below the hook text
  { t: 3.0, c: { x: 540, y: 1066, z: 0.92 } },
  { t: 4.0, c: { x: 540, y: 1066, z: 0.88 } },     // the sting
  { t: 4.9, c: { x: 540, y: 985, z: 1.35 } },       // saraf: in to the window on the lid
  { t: 10.3, c: { x: 540, y: 985, z: 1.4 } },
  { t: 11.4, c: { x: 540, y: 1250, z: 0.8 } },     // pemicu: back out and wide, so the triggers around the mirror fit
  { t: 18.6, c: { x: 540, y: 1250, z: 0.8 } },
  { t: 19.6, c: { x: 540, y: 1100, z: 0.88 } },     // lama: close on the eye again
  { t: 26.6, c: { x: 540, y: 1100, z: 0.9 } },
  { t: 27.8, c: { x: 540, y: 960, z: 0.78 } },    // tips: the mirror low in the frame, the cards above it
  { t: 36.6, c: { x: 540, y: 960, z: 0.78 } },
  { t: 38.2, c: { x: 540, y: 1070, z: 1.0 } },     // the loop-back: the first shot
  { t: 40, c: { x: 540, y: 1070, z: 1.0 } },
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

/** The window on the lid (0 closed, 1 open): it shows the muscle and the nerve while the beat 'saraf' talks about them. */
export const WIN_KEYS: Key[] = [{ t: 0, v: 0 }, { t: 4.4, v: 0 }, { t: 5.1, v: 1 }, { t: 10.3, v: 1 }, { t: 10.9, v: 0 }, { t: 40, v: 0 }];
export const winAt = (t: number) => through(WIN_KEYS, t);

/** How hard the lid twitches (0 calm, 1 strong). It twitches in the hook (the stake), when the nerve misfires, once for every trigger, then dies down and stays calm. */
export const TWITCH_KEYS: Key[] = [
  { t: 0, v: 0 }, { t: 0.2, v: 0.8 }, { t: 1.0, v: 0.8 }, { t: 1.3, v: 0 }, { t: 1.7, v: 0.9 }, { t: 2.5, v: 0.9 }, { t: 2.8, v: 0.3 }, { t: 3.4, v: 0 }, { t: 6.9, v: 0 },
  { t: 7.1, v: 0.7 }, { t: 7.9, v: 0.7 }, { t: 8.2, v: 0 }, { t: 8.8, v: 0 }, { t: 9.0, v: 0.9 }, { t: 9.9, v: 0.9 }, { t: 10.2, v: 0 }, { t: 12.2, v: 0 },
  { t: 12.3, v: 0.5 }, { t: 13.0, v: 0.5 }, { t: 13.2, v: 0 }, { t: 13.4, v: 0.5 }, { t: 14.1, v: 0.5 }, { t: 14.3, v: 0 }, { t: 14.8, v: 0.7 }, { t: 15.6, v: 0.7 },
  { t: 15.8, v: 0 }, { t: 16.2, v: 0.8 }, { t: 17.4, v: 0.8 }, { t: 17.7, v: 0 }, { t: 19.8, v: 0.6 }, { t: 21.0, v: 0.4 }, { t: 22.3, v: 0.15 }, { t: 23.4, v: 0 },
  { t: 38.6, v: 0 }, { t: 38.8, v: 0.7 }, { t: 39.5, v: 0.7 }, { t: 39.7, v: 0 }, { t: 40, v: 0 },
];
export const twitchAt = (t: number) => through(TWITCH_KEYS, t);

/** How tired the eye looks (0 awake, 1 heavy lid): it droops while the triggers pile up and comes back when the answer is in. */
export const TIRED_KEYS: Key[] = [{ t: 0, v: 0 }, { t: 11.6, v: 0 }, { t: 17.8, v: 1 }, { t: 19.4, v: 1 }, { t: 21.0, v: 0.2 }, { t: 40, v: 0 }];
export const tiredAt = (t: number) => through(TIRED_KEYS, t);

/** A blink (1 = shut): a single blink at 24.4 s once the twitch has gone, and one in the tips. */
export const BLINKS = [24.4, 31.0];
export const blinkAt = (t: number) => BLINKS.reduce((m, b) => Math.max(m, t > b && t < b + 0.28 ? Math.sin(((t - b) / 0.28) * Math.PI) : 0), 0);

/** The four triggers: when each comes in (the world piece) and goes (the camera leaves them), and the screen labels. */
export const TRIGGERS = { tidur: 12.0, stres: 13.0, kopi: 13.6, kering: 15.0, out: 18.8 };
/** The result stamp and the two time chips of the beat 'lama', the tip cards. */
export const STAMP = { a: 20.2, out: 26.6 };
export const CHIPS = [{ a: 21.8, out: 26.6 }, { a: 23.6, out: 26.6 }];
export const CARDS = [{ a: 28.2, out: 36.6 }, { a: 30.6, out: 36.6 }];
export type SLabel = { text: string; x: number; y: number; from: number; to: number; at?: [number, number] };
export const LABELS: SLabel[] = [
  { text: "saraf wajah", x: 770, y: 600, from: 5.7, to: 10.0, at: [740, 950] },
  { text: "otot kelopak", x: 270, y: 600, from: 6.3, to: 10.0, at: [400, 1040] },
  { text: "salah kirim sinyal", x: 540, y: 470, from: 8.7, to: 10.0, at: [610, 975] },
  { text: "kurang tidur", x: 300, y: 1440, from: 12.0, to: 18.6, at: [260, 1640] },
  { text: "stres", x: 270, y: 580, from: 13.0, to: 18.6, at: [270, 640] },
  { text: "kopi", x: 790, y: 1440, from: 13.6, to: 18.6, at: [790, 1640] },
  { text: "mata kering", x: 810, y: 580, from: 15.0, to: 18.6, at: [810, 620] },
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

/** The hero's box at time t, in the 1080 px frame (x, y, w, h): the mirror, or the window on the lid in the beat 'saraf'. */
export const HERO_BOX_AT = (t: number) => {
  const c = camAt(t);
  if (winAt(t) > 0.5) return { x: 540 + (WIN.x - c.x) * c.z, y: 960 + (WIN.y - c.y) * c.z, w: WIN.rx * 2 * c.z, h: WIN.ry * 2 * c.z };
  return { x: 540 + (MIRROR.x - c.x) * c.z, y: 960 + (MIRROR.y - c.y) * c.z, w: MIRROR.r * 2 * c.z, h: MIRROR.r * 2 * c.z };
};
