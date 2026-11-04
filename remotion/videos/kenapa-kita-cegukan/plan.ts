/* Kenapa kita cegukan? — the timing and the camera of this video (pure: no React). The look is 2d (B28): a flat front view of the chest, cut open.
   One continuous world; the camera moves inside it by the clock of the whole video, so the sting and every beat share the same set.
   motion-exception: the hook's establishing push (wide 0.7 to main 1.0) lasts 1.3 s as the registry's establishing push does; the pans between places of
   the set (neck, diaphragm, stomach) last 1.3 to 1.5 s. Every number below is read by index.tsx and sfx.ts so the picture and the sound agree. */
import type { StoryT } from "../../src/schema.ts";

export type Cam = { x: number; y: number; z: number };

/** Camera keys (seconds of the video): focus (world x, y) and zoom. Between two keys the camera eases (in/out quad); equal keys hold. */
export const CAM_KEYS: { t: number; c: Cam }[] = [
  { t: 0, c: { x: 540, y: 1060, z: 0.7 } },
  { t: 1.5, c: { x: 540, y: 1060, z: 0.7 } },       // the wide shot of the chest, the diaphragm in the middle third
  { t: 2.8, c: { x: 540, y: 1190, z: 1.0 } },       // establishing push to the main shot
  { t: 12, c: { x: 540, y: 1190, z: 1.05 } },        // diafragma: a slow push (about 0.011 a second)
  { t: 13.5, c: { x: 540, y: 640, z: 0.95 } },      // saraf: pan up to the neck, where the nerves start
  { t: 17.5, c: { x: 540, y: 700, z: 1.0 } },
  { t: 19, c: { x: 540, y: 1190, z: 1.0 } },       // pan back to the diaphragm for the spasm
  { t: 22, c: { x: 540, y: 1190, z: 1.04 } },       // hik: the diaphragm drops
  { t: 23.3, c: { x: 540, y: 560, z: 1.0 } },       // pan up to the voice box
  { t: 27.4, c: { x: 540, y: 570, z: 1.02 } },
  { t: 28.9, c: { x: 540, y: 1190, z: 1.0 } },
  { t: 29.1, c: { x: 540, y: 1190, z: 1.0 } },
  { t: 30.5, c: { x: 600, y: 1470, z: 0.98 } },     // pemicu: pan down to the stomach
  { t: 37.5, c: { x: 600, y: 1470, z: 1.0 } },
  { t: 39.3, c: { x: 540, y: 1000, z: 0.78 } },     // akhir: pull back to see the whole reflex
  { t: 45.6, c: { x: 540, y: 1000, z: 0.84 } },
  { t: 47.3, c: { x: 540, y: 700, z: 1.0 } },      // fakta: close on the nerve, the diaphragm and the voice box
  { t: 55.6, c: { x: 540, y: 760, z: 1.0 } },
  { t: 58.4, c: { x: 540, y: 1060, z: 0.7 } },      // the loop-back: the wide shot of the hook
  { t: 60, c: { x: 540, y: 1060, z: 0.7 } },
];

const ease = (x: number) => (x < 0.5 ? 2 * x * x : 1 - 2 * (1 - x) * (1 - x));
export function camAt(t: number): Cam {
  const k = CAM_KEYS;
  if (t <= k[0].t) return k[0].c;
  for (let i = 1; i < k.length; i++) {
    if (t <= k[i].t) {
      const a = k[i - 1], b = k[i], u = (b.t === a.t) ? 1 : ease((t - a.t) / (b.t - a.t));
      return { x: a.c.x + (b.c.x - a.c.x) * u, y: a.c.y + (b.c.y - a.c.y) * u, z: a.c.z + (b.c.z - a.c.z) * u };
    }
  }
  return k[k.length - 1].c;
}

/** A hiccup: the diaphragm drops at `drop`, air runs down the windpipe, and the glottis shuts at `shut` (kept `hold` s). */
export type Hic = { drop: number; shut: number; hold: number; rise: number };
export const HICS: Hic[] = [
  { drop: 20.9, shut: 25.6, hold: 0.55, rise: 27.9 },     // hik beat, told slowly: drop, air in, the voice box shuts
  { drop: 41.0, shut: 41.7, hold: 0.5, rise: 42.9 },      // akhir: the whole reflex in order
  { drop: 48.2, shut: 49.2, hold: 0.6, rise: 51.0 },      // fakta: slow motion, 35 ms between the two
];
/** The nerve signals (yellow dashes) run from the neck to the diaphragm in these windows (seconds), and up from the stomach in the last. */
export const SIGNALS: { a: number; b: number; up?: boolean }[] = [
  { a: 15.0, b: 18.0 }, { a: 35.2, b: 37.6, up: true }, { a: 39.9, b: 41.0 }, { a: 47.4, b: 48.2 },
];
/** The diaphragm's twitch in the saraf beat (a small, quick shaking) and its highlight. */
export const TWITCH = { a: 18.2, b: 19.8 };

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

/** The hero's box at time t, in the 1080 px frame (x, y, w, h): the diaphragm (two domes, about 720 world px wide). */
export const HERO_BOX_AT = (t: number) => {
  const c = camAt(t);
  return { x: 540, y: 960 + (1190 - c.y) * c.z, w: 720 * c.z, h: 190 * c.z };
};

/** The labels on the set (world coordinates, seconds of the video): shown from `from` to `to`. */
export type WLabel = { text: string; x: number; y: number; fs: number; from: number; to: number };
export const LABELS: WLabel[] = [
  { text: "diafragma", x: 540, y: 1375, fs: 56, from: 5.0, to: 11.8 },
  { text: "paru-paru", x: 320, y: 950, fs: 52, from: 7.2, to: 11.8 },
  { text: "saraf frenikus", x: 300, y: 600, fs: 50, from: 14.0, to: 19.0 },
  { text: "saraf vagus", x: 770, y: 560, fs: 50, from: 15.3, to: 19.0 },
  { text: "udara masuk", x: 730, y: 700, fs: 44, from: 22.9, to: 25.4 },
  { text: "pita suara", x: 300, y: 420, fs: 48, from: 24.4, to: 28.4 },
  { text: "makan cepat", x: 340, y: 1390, fs: 52, from: 30.0, to: 34.0 },
  { text: "minuman soda", x: 390, y: 1580, fs: 52, from: 32.5, to: 37.0 },
  { text: "udara tertelan", x: 800, y: 1705, fs: 52, from: 35.0, to: 38.5 },
  { text: "saraf terganggu", x: 330, y: 640, fs: 50, from: 39.6, to: 44.8 },
  { text: "diafragma mengejang", x: 540, y: 1400, fs: 52, from: 41.0, to: 45.2 },
  { text: "celah menutup: hik", x: 810, y: 430, fs: 50, from: 41.8, to: 45.4 },
];
/** Food chunks that fall down the gullet in the pemicu beat (each starts at `at`, takes 1.4 s), the fizz bubbles, the swallowed-air bubble growing. */
export const CHUNKS = [30.3, 30.9, 31.5, 32.1];
export const FIZZ = { a: 33.0, b: 37.4 };
export const AIR_BUBBLE = { grow: 35.0, full: 37.0, back: 39.0 };
/** The "HIK!" burst after the voice box shuts, the 35 ms card (appears, counts, leaves). */
export const HIK_AT = [26.0, 41.9];
export const CARD = { a: 47.9, count: 48.2, to: 50.2, out: 54.5 };
