/* Kenapa bintang terlihat berkelip?: the timing of the video (pure, no React). One set (a flat house rooftop at night with a low parapet, a water tank, a TV
   antenna, a stool and a small telescope, set kind "night-rooftop"), one hero (the star and its light coming down through the curved shell of air) and one
   continuous camera (CAM). Every moment that something appears is named in `T`; index.tsx (the picture) and sfx.ts (the sound) read the same numbers.
   All times are seconds of the whole video. */
import type { StoryT } from "../../src/schema.ts";
import type { Key2 } from "../../src/iso.ts";
import { cam2At } from "../../src/iso.ts";

/** The named moments (beats: hook 0, sting 3, jauh 4, udara 10, belok 18, kedip 26, planet 34, ufuk 41, tips 47, outro 56). */
export const T = {
  push: 1.5,
  tagTitik: 5.4, rings: 6.2, tagJauh: 7.6,
  layers: 10.8, warm: 12.0, cold: 13.4, wind: 14.8, tagGolak: 16.2,
  ghost: 19.0, tagLurus: 19.5, bend: 20.6, tagBelok: 21.6, lens: 23.0, tagLensa: 23.6,
  meter: 26.9, tagTerang: 28.2, tagRedup: 29.4, colour: 30.6, tagWarna: 31.2,
  planet: 34.6, tagPlanet: 35.3, rays: 36.2, tagCakram: 37.2, chip: 38.4, tagBintang: 39.4,
  low: 41.6, pathHigh: 42.6, pathLow: 43.6, tagTebal: 45.0,
  card1: 47.8, card2: 50.2, card3: 52.8, chipTips: 54.4,
} as const;

/** How hard the air shakes the light, per moment (1 = normal): calm while the star is shown as a point, strong where the bending is the point. */
export function shakeAt(c: number): number {
  const k = (a: number, b: number) => Math.min(1, Math.max(0, (c - a) / (b - a)));
  let s = 1;
  s -= 0.6 * k(4.4, 5.2) * (1 - k(9.2, 10.2));                    // jauh: the point is seen almost still
  s += 0.7 * k(20.4, 21.4) * (1 - k(25.4, 26.4));                 // belok: the bending is shown bigger
  s += 0.4 * k(26.4, 27.2) * (1 - k(33.4, 34.2));                 // kedip: bright and dim
  return s;
}

/** The camera keys: x, y, zoom (the frame's middle is 540, 960). The first and the last key are the same wide shot, so the video loops.
    motion-exception: the establishing push (0.55 to 1.0 in 1.5 s) is the hook's wide-to-main move of B27.8, faster than a beat's push. */
export const CAM: Key2[] = [
  { t: 0, x: 540, y: 1000, zoom: 0.55 }, { t: 1.5, x: 540, y: 1000, zoom: 0.55 }, { t: 3.0, x: 520, y: 980, zoom: 1.0 },
  { t: 4.1, x: 520, y: 980, zoom: 1.0 }, { t: 5.2, x: 480, y: 780, zoom: 1.22 }, { t: 9.6, x: 480, y: 760, zoom: 1.3 },
  { t: 10.2, x: 480, y: 760, zoom: 1.3 }, { t: 11.6, x: 520, y: 1000, zoom: 0.95 }, { t: 17.6, x: 520, y: 990, zoom: 1.02 },
  { t: 18.2, x: 520, y: 990, zoom: 1.02 }, { t: 19.4, x: 500, y: 980, zoom: 1.32 }, { t: 25.6, x: 500, y: 970, zoom: 1.4 },
  { t: 26.2, x: 500, y: 970, zoom: 1.4 }, { t: 27.4, x: 690, y: 1000, zoom: 1.0 }, { t: 33.6, x: 690, y: 990, zoom: 1.06 },
  { t: 34.2, x: 690, y: 990, zoom: 1.06 }, { t: 35.4, x: 320, y: 830, zoom: 1.2 }, { t: 40.6, x: 320, y: 820, zoom: 1.26 },
  { t: 41.2, x: 320, y: 820, zoom: 1.26 }, { t: 42.6, x: 1140, y: 1050, zoom: 0.55 }, { t: 46.6, x: 1140, y: 1040, zoom: 0.58 },
  { t: 47.2, x: 1140, y: 1040, zoom: 0.58 }, { t: 48.4, x: 540, y: 1150, zoom: 0.75 }, { t: 55.6, x: 540, y: 1140, zoom: 0.78 },
  { t: 56.0, x: 540, y: 1140, zoom: 0.78 }, { t: 57.6, x: 540, y: 1000, zoom: 0.55 }, { t: 60, x: 540, y: 1000, zoom: 0.55 },
];

export function makePlan(story: StoryT) {
  const starts = story.beats.map((_, i) => story.beats.slice(0, i).reduce((a, b) => a + b.dur, 0));
  const total = story.beats.reduce((a, b) => a + b.dur, 0);
  const sting = starts[1] ?? 0;
  const outro = starts.at(-1) ?? total;
  const m = { sting, stingEnd: sting + (story.beats[1]?.dur ?? 1), react: NaN, outro, end: total };
  return {
    m, total,
    loopWeight: (t: number) => Math.min(1, Math.max(0, (t - outro) / 0.5)),
    tops: [] as { b: number; headline?: string }[],
    labels: [] as { to: number; text: string }[],
  };
}

/** The star and the telescope's front in world px of the set layer (index.tsx draws them from the same numbers). */
export const STAR = { x: 456, y: 583 } as const;
export const SCOPE_FRONT = { x: 551, y: 1377 } as const;

/** The hero's box at time t, in the 1080 px frame: the star, its light and the air pockets around it (210 px each side of the light). */
export const HERO_BOX_AT = (t: number) => {
  const cam = cam2At(CAM, t), sx = (x: number) => 540 + cam.zoom * (x - cam.x), sy = (y: number) => 960 + cam.zoom * (y - cam.y);
  const x0 = sx(Math.min(STAR.x, SCOPE_FRONT.x) - 210), x1 = sx(Math.max(STAR.x, SCOPE_FRONT.x) + 210), y0 = sy(STAR.y - 60), y1 = sy(SCOPE_FRONT.y + 40);
  return { x: (x0 + x1) / 2, y: (y0 + y1) / 2, w: x1 - x0, h: y1 - y0 };
};
