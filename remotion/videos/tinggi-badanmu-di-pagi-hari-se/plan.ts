/* Tinggi badanmu pagi hari lebih tinggi 1 cm, kok bisa? — the timing and the camera of this video (pure: no React). The look is 2d (B28): a flat side view of a
   person in a hallway, the spine shown through a cut window. One continuous world; the camera moves inside it by the clock of the whole video.
   motion-exception: the hook's establishing push (wide 0.66 to main 0.95) lasts 1.5 s as the registry's establishing push does; the pans between places of the set
   (head, discs, the disc detail) last 1.3 to 2 s. Every number below is read by index.tsx and sfx.ts so the picture and the sound agree. */
import type { StoryT } from "../../src/schema.ts";

export type Cam = { x: number; y: number; z: number };

/** Camera keys (seconds of the video): focus (world x, y) and zoom. Between two keys the camera eases (in/out quad); equal keys hold. */
export const CAM_KEYS: { t: number; c: Cam }[] = [
  { t: 0, c: { x: 540, y: 1010, z: 0.66 } },
  { t: 1.5, c: { x: 540, y: 1010, z: 0.66 } },     // the wide shot of the hallway, the person in the middle third
  { t: 3.0, c: { x: 540, y: 717, z: 0.95 } },      // establishing push to the main shot: head and spine
  { t: 6.0, c: { x: 540, y: 717, z: 0.98 } },
  { t: 8.0, c: { x: 540, y: 520, z: 1.25 } },      // tulang: close on the neck vertebrae
  { t: 9.6, c: { x: 540, y: 520, z: 1.27 } },
  { t: 11.2, c: { x: 560, y: 1000, z: 1.2 } },     // down to the lumbar vertebrae and their discs
  { t: 12.0, c: { x: 560, y: 1000, z: 1.2 } },
  { t: 13.5, c: { x: 700, y: 1300, z: 1.05 } },    // air: the disc detail bubble
  { t: 19.0, c: { x: 700, y: 1300, z: 1.1 } },
  { t: 20.8, c: { x: 540, y: 717, z: 0.95 } },     // siang: back to the whole spine under load
  { t: 27.5, c: { x: 540, y: 760, z: 1.0 } },
  { t: 29.4, c: { x: 700, y: 1300, z: 1.05 } },    // malam: the disc detail fills again
  { t: 35.6, c: { x: 700, y: 1300, z: 1.1 } },
  { t: 37.2, c: { x: 540, y: 780, z: 0.8 } },      // hasil: pull back, the whole person against the wall ruler
  { t: 43.6, c: { x: 540, y: 780, z: 0.83 } },
  { t: 45.2, c: { x: 400, y: 420, z: 1.15 } },     // fakta: close on the head and the ruler
  { t: 50.8, c: { x: 400, y: 440, z: 1.17 } },
  { t: 52.4, c: { x: 540, y: 780, z: 0.85 } },     // tips: the person in the morning
  { t: 57.0, c: { x: 540, y: 780, z: 0.85 } },
  { t: 58.6, c: { x: 540, y: 1010, z: 0.66 } },    // the loop-back: the wide shot of the hook
  { t: 60, c: { x: 540, y: 1010, z: 0.66 } },
];

const ease = (x: number) => (x < 0.5 ? 2 * x * x : 1 - 2 * (1 - x) * (1 - x));
export function camAt(t: number): Cam {
  const k = CAM_KEYS;
  if (t <= k[0].t) return k[0].c;
  for (let i = 1; i < k.length; i++) {
    if (t <= k[i].t) {
      const a = k[i - 1], b = k[i], u = b.t === a.t ? 1 : ease((t - a.t) / (b.t - a.t));
      return { x: a.c.x + (b.c.x - a.c.x) * u, y: a.c.y + (b.c.y - a.c.y) * u, z: a.c.z + (b.c.z - a.c.z) * u };
    }
  }
  return k[k.length - 1].c;
}

/** The load n (0 = the morning, discs full; 1 = the night, discs thinned) by the clock. It also drives the sun, the moon, the clock hands and the head's height. */
export const LOAD_KEYS: { t: number; n: number }[] = [
  { t: 0, n: 0 }, { t: 3.3, n: 0 }, { t: 4.9, n: 1 },      // hook: a day passes, the head drops
  { t: 5.6, n: 1 }, { t: 7.0, n: 0 },                      // sting: the next morning
  { t: 19.4, n: 0 }, { t: 26.0, n: 1 },                    // siang: the load squeezes the water out
  { t: 28.6, n: 1 }, { t: 35.0, n: 0 },                    // malam: the rest fills the discs again
  { t: 38.0, n: 0 }, { t: 40.4, n: 1 },                    // hasil: morning, then night
  { t: 51.6, n: 1 }, { t: 53.4, n: 0 },                    // tips: the morning again
  { t: 60, n: 0 },
];
export function loadAt(t: number): number {
  const k = LOAD_KEYS;
  if (t <= k[0].t) return k[0].n;
  for (let i = 1; i < k.length; i++) {
    if (t <= k[i].t) {
      const a = k[i - 1], b = k[i], u = b.t === a.t ? 1 : ease((t - a.t) / (b.t - a.t));
      return a.n + (b.n - a.n) * u;
    }
  }
  return k[k.length - 1].n;
}

/** The disc detail bubble (a magnified disc between two vertebrae) is on screen from `a` to `b`. */
export const DETAIL = { a: 12.4, b: 36.0 };
/** The weight arrows press on the spine in this window (the siang beat). */
export const LOAD_ARROWS = { a: 20.2, b: 27.6 };
/** The "lying down" card (the malam beat) and the 1 cm bracket windows (hook end, hasil). */
export const BED_CARD = { a: 28.4, b: 35.4 };
export const BRACKETS = [{ a: 4.3, b: 5.0 }, { a: 40.0, b: 43.8 }, { a: 45.4, b: 51.4 }];
/** The note that the picture is exaggerated, and the number card of the fakta beat (appears, counts, leaves). */
export const NOTE = { a: 40.6, b: 43.8 };
export const CARD = { a: 46.0, count: 46.3, out: 50.8 };

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

/** The hero's box at time t, in the 1080 px frame (x, y, w, h): the person (about 300 world px wide). */
export const HERO_BOX_AT = (t: number) => {
  const c = camAt(t);
  return { x: 540, y: 960 + (1300 - c.y) * c.z, w: 300 * c.z, h: 2300 * c.z };
};

/** The labels on the set (world coordinates, seconds of the video): shown from `from` to `to`. */
export type WLabel = { text: string; x: number; y: number; fs: number; from: number; to: number };
export const LABELS: WLabel[] = [
  { text: "tulang belakang", x: 840, y: 650, fs: 50, from: 6.3, to: 8.2 },
  { text: "ruas tulang", x: 800, y: 470, fs: 52, from: 8.4, to: 11.8 },
  { text: "cakram", x: 790, y: 1010, fs: 56, from: 10.6, to: 12.2 },
  { text: "banyak air", x: 830, y: 1290, fs: 48, from: 13.0, to: 15.4 },
  { text: "peredam kejut", x: 830, y: 1330, fs: 46, from: 15.6, to: 18.8 },
  { text: "berdiri, duduk", x: 300, y: 300, fs: 48, from: 20.4, to: 23.2 },
  { text: "air terperas", x: 880, y: 1295, fs: 48, from: 23.4, to: 27.8 },
  { text: "tekanan hilang", x: 830, y: 1330, fs: 46, from: 29.8, to: 32.4 },
  { text: "air terserap lagi", x: 830, y: 1380, fs: 46, from: 32.6, to: 35.8 },
  { text: "pagi", x: 880, y: 130, fs: 50, from: 38.1, to: 40.1 },
];
