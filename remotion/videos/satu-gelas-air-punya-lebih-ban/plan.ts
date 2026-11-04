/* Satu gelas air punya lebih banyak molekul daripada gelas di lautan — the timing and the camera of this video (pure: no React here). A flat 2D drawing
   (look 2d, B28) in its own set, a school lab bench seen from the side (set.json, kind "lab-bench-side"): the hero is a glass of water full of H2O molecules;
   the dressing is a tiled wall, a shelf of jars, a clock and a globe poster. A tall tank stands for the ocean (rows of tiny glasses) and a balance compares the two counts.
   One continuous take: the camera pushes and pans across the drawing, every beat is a move.
   Scale (B27.7, 35 px = 1 cm): the glass 14 cm tall and 8.5 cm wide at the rim, the teaspoon about 13 cm long, the jars 9 cm, the clock 12 cm across,
   a molecule is drawn at about 25 px (hugely enlarged on purpose, cartoon scale), the tank stands for the ocean and is cartoon-sized next to the glass.
   Shapes checked (Wikipedia: Properties of water, Water): a water molecule is bent, an oxygen atom with two hydrogens at about 104.5 degrees, not a straight line;
   a glass of water holds the liquid as one tightly packed crowd of molecules; the ocean is not a tank, the tank is only a stand-in (said on screen: "lautan"). */
import type { StoryT } from "../../src/schema.ts";
import { cam2At, type Cam2, type Key2 } from "../../src/iso.ts";

export const GLASS = { top: 1000, base: 1500, xl0: 390, xr0: 690, xl1: 420, xr1: 660, wall: 14, floorIn: 1486 } as const;
export const SURF = 1120;                                        // the water's surface in the glass
export const TANK = { x0: -1500, x1: -420, top: 720, base: 1500 } as const;
export const BAL = { x: 2000, pivotY: 980, half: 360, hang: 150 } as const;
export const SPOON = { x: 980, y: 1488 } as const;               // the bowl's centre, the handle goes right

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const ease = (k: number) => { const c = clamp01(k); return c < 0.5 ? 4 * c * c * c : 1 - Math.pow(-2 * c + 2, 3) / 2; };

export function makePlan(story: StoryT) {
  const starts = story.beats.map((_, i) => story.beats.slice(0, i).reduce((a, b) => a + b.dur, 0));
  const total = story.beats.reduce((a, b) => a + b.dur, 0);
  const at = (id: string) => starts[Math.max(0, story.beats.findIndex((b) => b.id === id))] ?? 0;
  const sting = starts[1] ?? 0;                                   // must 1: the "Intip yuk!" sting is the second beat
  const outro = starts.at(-1) ?? total;                           // must 2: the loop-back outro is the last beat
  const m = {
    sting, stingEnd: sting + (story.beats[1]?.dur ?? 1), react: NaN, outro, end: total,
    gelas: at("gelas"), molekul: at("molekul"), lautan: at("lautan"), banding: at("banding"), hasil: at("hasil"), sendok: at("sendok"), tips: at("tips"),
  };
  // the camera: wide shot (the glass in the centre third), push to the glass, then every beat is a move inside the drawing; the outro returns to the wide shot
  // motion-exception: the establishing push goes from zoom 0.62 to 1.6 in 1.3 s (the registered establishing range, B27.8), faster than a beat's push
  const WIDE: Cam2 = { x: 540, y: 1180, zoom: 0.62 };
  const keys: Key2[] = [
    { t: 0, ...WIDE }, { t: 1.5, ...WIDE }, { t: 2.8, x: 540, y: 1250, zoom: 1.6 },
    { t: m.gelas + 0.2, x: 540, y: 1250, zoom: 1.6 }, { t: m.gelas + 2.2, x: 540, y: 1230, zoom: 1.85 }, { t: m.molekul - 0.2, x: 540, y: 1230, zoom: 1.88 },
    { t: m.molekul + 1.4, x: 540, y: 1310, zoom: 3.0 }, { t: m.lautan - 0.2, x: 548, y: 1300, zoom: 3.15 },
    { t: m.lautan + 1.5, x: -660, y: 1120, zoom: 0.92 }, { t: m.banding - 0.2, x: -690, y: 1115, zoom: 0.96 },
    { t: m.banding + 1.5, x: 1990, y: 1090, zoom: 1.05 }, { t: m.hasil - 0.2, x: 1990, y: 1080, zoom: 1.1 },
    { t: m.hasil + 1.5, x: 540, y: 1200, zoom: 1.3 }, { t: m.sendok - 0.2, x: 540, y: 1195, zoom: 1.34 },
    { t: m.sendok + 1.3, x: 1010, y: 1370, zoom: 2.3 }, { t: m.tips - 0.2, x: 1010, y: 1365, zoom: 2.36 },
    { t: m.tips + 1.3, x: 640, y: 1160, zoom: 0.92 }, { t: outro - 0.1, x: 640, y: 1160, zoom: 0.95 },
    { t: outro + 2.6, ...WIDE }, { t: total, ...WIDE },
  ];
  /** world-point labels: { from, to, at (world), text } in the order they appear */
  const labels = [
    { id: "ml", from: m.gelas + 1.8, to: m.molekul - 0.1, at: [330, 1090] as [number, number], text: "250 ml", fs: 50 },
    { id: "gram", from: m.gelas + 3.6, to: m.molekul - 0.1, at: [330, 1190] as [number, number], text: "±250 gram", fs: 46 },
    { id: "satu", from: m.molekul + 1.8, to: m.molekul + 4.6, at: [470, 1075] as [number, number], text: "1 molekul air", fs: 42 },
    { id: "isi", from: m.molekul + 4.6, to: m.lautan - 0.1, at: [540, 1010] as [number, number], text: "±8 × 10²⁴", fs: 56 },
    { id: "laut", from: m.lautan + 1.8, to: m.banding - 0.1, at: [-960, 650] as [number, number], text: "lautan", fs: 58 },
    { id: "gelasN", from: m.lautan + 4.2, to: m.banding - 0.1, at: [-960, 1560] as [number, number], text: "±5 × 10²¹ gelas", fs: 52 },
    { id: "kiri", from: m.banding + 1.8, to: m.hasil - 0.1, at: [BAL.x - BAL.half, 1340] as [number, number], text: "gelas: 10²¹", fs: 40 },
    { id: "kanan", from: m.banding + 2.4, to: m.hasil - 0.1, at: [BAL.x + BAL.half, 1400] as [number, number], text: "molekul: 10²⁴", fs: 40 },
    { id: "fakta", from: m.hasil + 2.0, to: m.sendok - 0.1, at: [540, 930] as [number, number], text: "FAKTA", fs: 64 },
    { id: "lima", from: m.sendok + 1.6, to: m.tips - 0.1, at: [SPOON.x, 1300] as [number, number], text: "5 ml", fs: 46 },
    { id: "sdk", from: m.sendok + 2.8, to: m.tips - 0.1, at: [SPOON.x + 40, 1230] as [number, number], text: "±1,7 × 10²³", fs: 46 },
  ];
  /** how many of the tank's rows of tiny glasses are filled (0..1, from the bottom up) */
  const tankFill = (t: number): number => ease((t - (m.lautan + 2.6)) / 3.4);
  /** the balance's tilt in degrees: level, then the glass-molecule side sinks (the right pan) */
  const tilt = (t: number): number => { const k = (t - (m.banding + 3.2)) / 1.6; return k <= 0 ? 0 : 11 * ease(k) + 2.4 * Math.sin(Math.max(0, k - 1) * 9) * Math.exp(-Math.max(0, k - 1) * 3) * (k > 1 ? 1 : 0); };
  /** the check mark's pop at the glass (hasil beat) */
  const check = (t: number): number => ease((t - (m.hasil + 1.8)) / 0.6) * (1 - clamp01((t - (m.sendok - 0.2)) / 0.4));
  const lw = (t: number) => Math.min(1, Math.max(0, (t - outro) / 0.5));
  return {
    m, total, keys, starts, labels, tankFill, tilt, check,
    // 0 at the start, 1 in the loop-back: the scene is the first beat's again at the end (the loop)
    loopWeight: lw,
    cam: (t: number): Cam2 => cam2At(keys, t),
    tops: [] as { b: number; headline?: string }[],
  };
}

/** The hero's box at time t, in the 1080 px frame (x, y, w, h): the glass, seen through the hook's own camera (wide shot, then the push to the main shot). */
const HOOK_KEYS: Key2[] = [{ t: 0, x: 540, y: 1180, zoom: 0.62 }, { t: 1.5, x: 540, y: 1180, zoom: 0.62 }, { t: 2.8, x: 540, y: 1250, zoom: 1.6 }];
export const HERO_BOX_AT = (t: number) => {
  const c = cam2At(HOOK_KEYS, t), x0 = 540 + c.zoom * (GLASS.xl0 - c.x), x1 = 540 + c.zoom * (GLASS.xr0 - c.x), y0 = 960 + c.zoom * (GLASS.top - c.y), y1 = 960 + c.zoom * (GLASS.base - c.y);
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
};
