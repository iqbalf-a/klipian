/* Kenapa langit berwarna biru? — the timing and the camera of this video (pure: no React here). One continuous take in an "air column": a tall glass box of
   air standing on a plaza slab, the sun above its left corner, a pedestal where an eye will stand. The picture (index.tsx) and the sound (sfx.ts) read the same
   numbers from here. B25: something moves about every second, something new every 3 to 4 seconds, each explain beat is a camera move inside the set. */
import type { StoryT } from "../../src/schema.ts";
import { cam2At, isoAt, toScreen, type Cam2, type Key2, type P2, type P3 } from "../../src/iso.ts";

export const U = 125;
export const O: P2 = [540, 1400];
/** The air column (world units; 1 unit is about 1 m of the drawing, not a scale of the sky): a glass box x -2.2..2.2, y -1.2..1.2, z 0..6.4. */
export const COL = { x0: -2.2, x1: 2.2, y0: -1.2, y1: 1.2, z1: 6.4 } as const;
export const SUN_NOON: P3 = [-2.8, 0, 6.6];
export const SUN_DUSK: P3 = [-8, 0, 1.4];
export const TARGET: P3 = [1.3, 0, 0.75];                 // the top of the pedestal: where the light is going and where the eye stands
export const EYE: P3 = [1.3, 0, 1.15];
export const PEDESTAL = { a: [1.0, -0.3, 0] as P3, b: [1.6, 0.3, 0.55] as P3 };
export const PRISM = { x: -1.7, z: 5.03, r: 0.5 } as const;  // on the beam from the noon sun to the target (s = 0.27)
export const AIR_LOW = { x0: -8.4, x1: 2.2, y0: -0.9, y1: 0.9, z1: 1.9 } as const;   // the long low layer of air the sunset light has to cross
export const w = (p: P3): P2 => isoAt(p, U, O);

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const ease = (k: number) => { const c = clamp01(k); return c < 0.5 ? 4 * c * c * c : 1 - Math.pow(-2 * c + 2, 3) / 2; };
const lerp3 = (a: P3, b: P3, k: number): P3 => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
/** A molecule of air: a fixed pseudo-random point inside the column (index i), so the picture and the sound agree. */
export const molecule = (i: number): P3 => {
  const h = (n: number) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
  return [COL.x0 + 0.3 + h(i + 1) * (COL.x1 - COL.x0 - 0.6), COL.y0 + 0.3 + h(i + 41) * (COL.y1 - COL.y0 - 0.6), 0.7 + h(i + 83) * (COL.z1 - 1.1)];
};
export const MOLECULES = 30;

export function makePlan(story: StoryT) {
  const starts = story.beats.map((_, i) => story.beats.slice(0, i).reduce((a, b) => a + b.dur, 0));
  const total = story.beats.reduce((a, b) => a + b.dur, 0);
  const at = (id: string) => starts[Math.max(0, story.beats.findIndex((b) => b.id === id))] ?? 0;
  const sting = starts[1] ?? 0;                                   // must 1: the "Intip yuk!" sting is the second beat
  const outro = starts.at(-1) ?? total;                           // must 2: the loop-back outro is the last beat
  const m = {
    sting, stingEnd: sting + (story.beats[1]?.dur ?? 1), react: NaN, outro, end: total,
    cahaya: at("cahaya"), udara: at("udara"), biru: at("biru"), mata: at("mata"), ungu: at("ungu"), senja: at("senja"), hasil: at("hasil"),
  };
  const keys: Key2[] = [
    { t: 0, x: 540, y: 1000, zoom: 0.5 }, { t: 1.5, x: 540, y: 1000, zoom: 0.5 }, { t: 2.8, x: 540, y: 1000, zoom: 0.95 },
    { t: m.cahaya, x: 540, y: 960, zoom: 0.95 }, { t: m.cahaya + 1.4, x: 360, y: 720, zoom: 1.2 }, { t: m.udara - 0.3, x: 380, y: 740, zoom: 1.22 },
    { t: m.udara + 0.8, x: 480, y: 900, zoom: 1.04 }, { t: m.biru - 0.3, x: 500, y: 920, zoom: 1.06 },
    { t: m.biru + 1.2, x: 540, y: 900, zoom: 1.0 }, { t: m.mata - 0.3, x: 560, y: 900, zoom: 1.0 },
    { t: m.mata + 1.6, x: 560, y: 930, zoom: 0.96 }, { t: m.ungu - 0.3, x: 560, y: 930, zoom: 0.96 },
    { t: m.ungu + 1.4, x: 640, y: 1260, zoom: 1.28 }, { t: m.senja - 0.3, x: 640, y: 1270, zoom: 1.3 },
    { t: m.senja + 1.6, x: 90, y: 1000, zoom: 0.62 }, { t: m.hasil - 0.3, x: 150, y: 1010, zoom: 0.66 },
    { t: m.hasil + 1.8, x: 540, y: 1000, zoom: 0.88 }, { t: outro - 0.1, x: 540, y: 1000, zoom: 0.88 },
    { t: outro + 2.6, x: 540, y: 1000, zoom: 0.5 }, { t: total, x: 540, y: 1000, zoom: 0.5 },
  ];
  const win = (t: number, a: number, b: number, d = 0.6) => ease((t - a) / d) * (1 - ease((t - b) / d));
  const lw = (t: number) => clamp01((t - outro) / 0.5);
  return {
    m, total,
    // 0 at the start, 1 in the loop-back: the scene is the first beat's again at the end (the loop)
    loopWeight: lw,
    cam: (t: number): Cam2 => cam2At(keys, t),
    tops: [] as { b: number; headline?: string }[],
    /** where the sun is: high at the left corner, down on the far left horizon at sunset, and home again for the loop */
    sun: (t: number): P3 => lerp3(SUN_NOON, SUN_DUSK, ease((t - (m.senja + 0.2)) / 1.6) * (1 - ease((t - (m.hasil + 0.3)) / 1.6))),
    /** how far the prism and the spread of five colours show (the cahaya beat) */
    prism: (t: number): number => win(t, m.cahaya + 0.5, m.cahaya + 6.2),
    spread: (t: number): number => ease((t - (m.cahaya + 1.6)) / 1.2) * (1 - ease((t - (m.cahaya + 6.2)) / 0.6)),
    /** the gas molecules (0..1 each, staggered) */
    molecules: (t: number, i: number): number => ease((t - (m.udara + 0.5 + (i % 10) * 0.18)) / 0.5) * (1 - ease((t - (m.hasil + 2.4)) / 0.6)) * (1 - lw(t)),
    /** the beam splits into blue and red (the biru beat) */
    split: (t: number): number => win(t, m.biru + 0.2, m.mata - 0.2, 0.7),
    /** the blue that bounces off the beam (udara and biru) */
    bounce: (t: number): number => win(t, m.udara + 2.4, m.mata + 0.2, 0.8),
    /** the blue that arrives from every part of the sky at the eye (mata, ungu) */
    toEye: (t: number): number => win(t, m.mata + 0.8, m.senja - 0.3, 0.8),
    eye: (t: number): number => win(t, m.mata + 0.4, m.senja - 0.2, 0.5),
    violet: (t: number): number => win(t, m.ungu + 0.8, m.senja - 0.3, 0.6),
    chip: (t: number): number => win(t, m.ungu + 3.6, m.senja - 0.3, 0.5),
    /** how blue the column of air is (a tint of the glass) */
    tint: (t: number): number => 0.5 * ease((t - (m.mata + 1.4)) / 3) * (1 - ease((t - (m.senja + 0.3)) / 1.2)) + 0.5 * ease((t - (m.hasil + 0.6)) / 1.6) * (1 - lw(t)),
    /** the sunset: the long low layer of air and the colours along the light */
    dusk: (t: number): number => win(t, m.senja + 0.6, m.hasil - 0.2, 0.8),
    waves: (t: number): number => win(t, m.biru + 0.8, m.mata - 0.3, 0.5),
    screen: (t: number, p: P3): P2 => toScreen(cam2At(keys, t), w(p)),
    labels: [
      { id: "campur", from: m.cahaya + 3.0, to: m.udara - 0.3, text: "semua warna", at: [0.3, 0, 3.4] as P3 },
      { id: "gas", from: m.udara + 2.6, to: m.biru - 0.3, text: "gas di udara", at: [-0.3, 0.6, 2.6] as P3 },
      { id: "pendek", from: m.biru + 2.4, to: m.mata - 0.3, text: "gelombang pendek", at: [-1.4, 0, 2.15] as P3 },
      { id: "mata", from: m.mata + 2.4, to: m.ungu - 0.3, text: "dari segala arah", at: [-1.4, 0.2, 4.6] as P3 },
      { id: "putih", from: m.ungu + 4.2, to: m.senja - 0.3, text: "biru keputihan", at: [1.3, 0, 2.6] as P3 },
      { id: "panjang2", from: m.biru + 4.6, to: m.mata - 0.3, text: "gelombang panjang", at: [-1.4, 0, 0.1] as P3 },
      { id: "panjang", from: m.senja + 2.4, to: m.senja + 5.2, text: "udara lebih panjang", at: [-3.6, 0.3, 2.3] as P3 },
      { id: "merah", from: m.senja + 5.4, to: m.hasil - 0.2, text: "tersisa merah", at: [-0.4, 0.3, 1.2] as P3 },
    ],
  };
}

/** The hero's box at the main shot (camera focus 540, 1000, zoom 0.95), in the 1080 px frame (x, y, w, h): the air column. */
export const HERO_BOX_AT = (_t: number) => {
  const c: Cam2 = { x: 540, y: 1000, zoom: 0.95 };
  const pts = ([[COL.x0, COL.y1, 0], [COL.x1, COL.y0, COL.z1], [COL.x0, COL.y0, COL.z1], [COL.x1, COL.y1, 0], [COL.x0, COL.y0, 0]] as P3[]).map((p) => toScreen(c, w(p)));
  const x0 = Math.min(...pts.map((p) => p[0])), x1 = Math.max(...pts.map((p) => p[0])), y0 = Math.min(...pts.map((p) => p[1])), y1 = Math.max(...pts.map((p) => p[1]));
  return { x: (x0 + x1) / 2, y: (y0 + y1) / 2, w: x1 - x0, h: y1 - y0 };
};
