/* Cara kerja sedotan menyedot minuman — the timing and the camera of this video (pure: no React here). A flat 2D drawing (look 2d, B28) in its own set,
   a cafe table seen from the side (set.json, kind "drink-table-side"): a glass of drink with a straw, a round cartoon blob's mouth on the straw (a parody, not a real person), and a window, a napkin
   holder, a plant and a plate as dressing. One continuous take: the camera pushes and pans across the drawing, every beat is a move.
   Scale (B27.7, 35 px = 1 cm): the glass 14 cm tall and 8.5 cm wide at the rim, the straw 23 cm, the napkin holder 7 cm, the pot 5 cm, the plate 17 cm wide,
   a cookie 7 cm, the blob's head about 24 cm across, as a cartoon (not a real person's size); the window is a corner of its casing, cut by the frame.
   Shapes checked (Wikipedia: Drinking straw, Suction, Atmospheric pressure): a straw is a thin straight tube; the liquid is pushed up by the air pressure on its surface
   when the pressure in the mouth is lowered (not pulled); water can rise at most about 10.3 m by suction at standard pressure (a column drawn as a very tall tube, with a break mark). */
import type { StoryT } from "../../src/schema.ts";
import { cam2At, type Cam2, type Key2 } from "../../src/iso.ts";

export const GLASS = { top: 1000, base: 1500, xl0: 390, xr0: 690, xl1: 420, xr1: 660, wall: 14, floorIn: 1486 } as const;
export const SURF0 = 1120;                                       // the drink's surface at rest
export const STRAW = { s0: [520, 1470], s1: [664, 664], hw: 15 } as const;   // the straw's two ends (bottom in the glass, top in the mouth)
export const MOUTH = { x: 676, y: 664 } as const;
export const COL = { x: -450, top: -700, base: 1500 } as const;   // the very tall tube of the batas beat (a break mark hides the middle)

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const ease = (k: number) => { const c = clamp01(k); return c < 0.5 ? 4 * c * c * c : 1 - Math.pow(-2 * c + 2, 3) / 2; };
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

export function makePlan(story: StoryT) {
  const starts = story.beats.map((_, i) => story.beats.slice(0, i).reduce((a, b) => a + b.dur, 0));
  const total = story.beats.reduce((a, b) => a + b.dur, 0);
  const at = (id: string) => starts[Math.max(0, story.beats.findIndex((b) => b.id === id))] ?? 0;
  const sting = starts[1] ?? 0;                                   // must 1: the "Intip yuk!" sting is the second beat
  const outro = starts.at(-1) ?? total;                           // must 2: the loop-back outro is the last beat
  const m = {
    sting, stingEnd: sting + (story.beats[1]?.dur ?? 1), react: NaN, outro, end: total,
    mulut: at("mulut"), udara: at("udara"), dorong: at("dorong"), batas: at("batas"), hasil: at("hasil"), tips: at("tips"),
  };
  // the camera: wide shot (the glass in the centre third), push to the glass, then every beat is a move inside the drawing; the outro returns to the wide shot
  // motion-exception: the establishing push goes from zoom 0.62 to 2.2 in 1.3 s (the registered establishing range, B27.8), faster than a beat's push
  const WIDE: Cam2 = { x: 540, y: 1180, zoom: 0.62 };
  const keys: Key2[] = [
    { t: 0, ...WIDE }, { t: 1.5, ...WIDE }, { t: 2.8, x: 560, y: 900, zoom: 2.2 },
    { t: m.mulut, x: 560, y: 900, zoom: 2.2 }, { t: m.mulut + 1.0, x: 700, y: 800, zoom: 1.4 }, { t: m.udara - 0.2, x: 700, y: 790, zoom: 1.45 },
    { t: m.udara + 1.0, x: 540, y: 1120, zoom: 1.4 }, { t: m.dorong - 0.2, x: 540, y: 1110, zoom: 1.45 },
    { t: m.dorong + 1.2, x: 600, y: 1010, zoom: 1.2 }, { t: m.batas - 0.2, x: 600, y: 1000, zoom: 1.25 },
    { t: m.batas + 1.4, x: -120, y: 380, zoom: 0.5 }, { t: m.hasil - 0.4, x: -130, y: 360, zoom: 0.52 },
    { t: m.hasil + 1.0, x: 560, y: 1060, zoom: 1.15 }, { t: m.tips - 0.2, x: 560, y: 1050, zoom: 1.2 },
    { t: m.tips + 1.2, x: 600, y: 1200, zoom: 0.8 }, { t: outro - 0.1, x: 600, y: 1190, zoom: 0.83 },
    { t: outro + 2.6, ...WIDE }, { t: total, ...WIDE },
  ];
  /** how far the mouth has sucked (cheek hollow, 0..1): it starts in the mulut beat and lets go late in the tips beat */
  const suck = (t: number): number => ease((t - (m.mulut + 1.6)) / 1.4) * (1 - ease((t - (m.tips + 5.6)) / 1.0));
  /** how far the drink has risen in the straw (0 at rest .. 1 at the mouth) */
  const rise = (t: number): number => ease((t - (m.dorong + 1.0)) / 3.6) * (1 - ease((t - (m.tips + 6.0)) / 1.8));
  const strawLevel = (t: number): number => lerp(SURF0, 700, rise(t));
  const glassLevel = (t: number): number => SURF0 + 34 * rise(t);
  /** the very tall tube of the batas beat: how far it grows (0..1) and how far the water has climbed in it */
  const col = (t: number): number => ease((t - (m.batas + 0.3)) / 1.2) * (1 - ease((t - (m.hasil - 0.8)) / 0.7));
  const colWater = (t: number): number => ease((t - (m.batas + 2.2)) / 3.6);
  /** world-point labels: { from, to, at (world), text } in the order they appear */
  const labels = [
    { id: "kecil", from: m.mulut + 2.4, to: m.udara - 0.1, at: [330, 760] as [number, number], text: "tekanan kecil", fs: 46 },
    { id: "besar", from: m.udara + 1.6, to: m.dorong - 0.1, at: [250, 1040] as [number, number], text: "tekanan besar", fs: 46 },
    { id: "naik", from: m.dorong + 1.8, to: m.batas - 0.1, at: [330, 860] as [number, number], text: "didorong naik", fs: 46 },
    { id: "laut", from: m.batas + 4.2, to: m.hasil - 0.8, at: [COL.x + 330, COL.top + 170] as [number, number], text: "±10,3 meter", fs: 52 },
    { id: "bak", from: m.batas + 1.8, to: m.hasil - 0.8, at: [COL.x + 440, 1290] as [number, number], text: "sedotan raksasa", fs: 46 },
    { id: "didorong", from: m.hasil + 1.8, to: m.tips - 0.1, at: [330, 840] as [number, number], text: "didorong udara", fs: 46 },
    { id: "ditarik", from: m.hasil + 3.6, to: m.tips - 0.1, at: [300, 975] as [number, number], text: "bukan ditarik", fs: 46 },
  ];
  const lw = (t: number) => Math.min(1, Math.max(0, (t - outro) / 0.5));
  return {
    m, total, keys, starts, labels, suck, rise, strawLevel, glassLevel, col, colWater,
    // 0 at the start, 1 in the loop-back: the scene is the first beat's again at the end (the loop)
    loopWeight: lw,
    cam: (t: number): Cam2 => cam2At(keys, t),
    tops: [] as { b: number; headline?: string }[],
  };
}

/** The hero's box at time t, in the 1080 px frame (x, y, w, h): the glass with its straw, seen through the hook's own camera (wide shot, then the push to the main shot). */
const HOOK_KEYS: Key2[] = [{ t: 0, x: 540, y: 1180, zoom: 0.62 }, { t: 1.5, x: 540, y: 1180, zoom: 0.62 }, { t: 2.8, x: 560, y: 900, zoom: 2.2 }];
export const HERO_BOX_AT = (t: number) => {
  const c = cam2At(HOOK_KEYS, t), x0 = 540 + c.zoom * (GLASS.xl0 - c.x), x1 = 540 + c.zoom * (GLASS.xr0 - c.x), y0 = 960 + c.zoom * (GLASS.top - c.y), y1 = 960 + c.zoom * (GLASS.base - c.y);
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
};
