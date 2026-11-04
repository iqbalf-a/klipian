/* Pluto belum sekali pun mengelilingi Matahari sejak ditemukan — the timing, the camera and the orbit maths of this video (pure: no React here). A flat 2D drawing (look 2d, B28)
   in its own set, a lecture hall wall (set.json, kind "orbit-chart-hall"): the hero is the orbit chart (the Sun at a focus, Pluto's lonely ellipse, Neptune's ring) with a year ruler at its foot.
   One continuous take: the camera pushes and pans across the wall, every beat is a move. The sound is sfx.ts.
   Scale (B27.7): the chart is a drawing, 1 AU = 8.5 px (Pluto's semi-major axis 39.48 AU = 335 px, Neptune 30.07 AU = 255.6 px); the telescope (about 1.2 m) is drawn 300 px tall
   next to a 930 px chart frame, the plates 270 px wide: dressing is cartoon-sized beside the hero and the wall is the far layer.
   Shapes checked (Wikipedia: Pluto; Live Science): Pluto's orbit is an ellipse with eccentricity 0.2488 (not a circle) with the Sun at a focus, not the centre; its closest point (29.7 AU) is inside Neptune's
   ring (30.07 AU) for about twenty years of every orbit, a 3:2 resonance (two Pluto orbits to three of Neptune) keeps them apart; the first orbit since the 1930 discovery ends in 2178.
   The orbit is drawn flat on the chart; its real tilt of 17 degrees is not drawn. */
import type { StoryT } from "../../src/schema.ts";
import { cam2At, type Cam2, type Key2 } from "../../src/iso.ts";

export const PX_AU = 8.5;
export const ECC = 0.2488, A_AU = 39.482, NEP_AU = 30.07;
export const PERIOD = 247.94, NEP_PERIOD = 164.79;
export const PERI_YEAR = 1989.68, DISC_YEAR = 1930.13, NOW_YEAR = 2026.84, END_YEAR = DISC_YEAR + PERIOD;
export const A = A_AU * PX_AU, B = A * Math.sqrt(1 - ECC * ECC), C = A * ECC, NEP_R = NEP_AU * PX_AU;
export const BOARD = { x0: 90, x1: 990, y0: 430, y1: 1360, cx: 540 } as const;
export const FOCUS = { x: 540 - C, y: 880 };                       // the Sun sits at the focus (the ellipse centre is at x 540, the perihelion points left)
export const FLOOR_Y = 1600;
export const RULER = { x0: 150, x1: 930, y: 1300 } as const;

const TAU = Math.PI * 2;
/** Kepler's equation by Newton's method: the eccentric anomaly of a mean anomaly. */
function eccentric(M: number): number { let E = M + ECC * Math.sin(M); for (let i = 0; i < 12; i++) E -= (E - ECC * Math.sin(E) - M) / (1 - ECC * Math.cos(E)); return E; }
const meanAnomaly = (year: number) => { const k = ((year - PERI_YEAR) / PERIOD) % 1; return (k < -0.5 ? k + 1 : k > 0.5 ? k - 1 : k) * TAU; };
/** Pluto's place on the chart at a (virtual) year. The perihelion points left (-x), the motion goes anticlockwise on screen. */
export function plutoAt(year: number): [number, number] {
  const E = eccentric(meanAnomaly(year));
  const x = A * (Math.cos(E) - ECC), y = B * Math.sin(E);
  return [FOCUS.x - x, FOCUS.y + y];
}
/** Pluto's distance from the Sun in AU. */
export function plutoDist(year: number): number { const E = eccentric(meanAnomaly(year)); return A_AU * (1 - ECC * Math.cos(E)); }
/** Neptune on its ring (decorative phase: 90 degrees ahead of Pluto at Pluto's perihelion, as the resonance keeps them apart). */
export function neptuneAt(year: number): [number, number] {
  const th = Math.PI / 2 + ((year - PERI_YEAR) / NEP_PERIOD) * TAU;
  return [FOCUS.x - Math.cos(th) * NEP_R, FOCUS.y + Math.sin(th) * NEP_R];
}
/** The points of Pluto's orbit between two years, as an SVG polyline string. */
export function arcPoints(y0: number, y1: number, n = 90): string {
  const out: string[] = [];
  for (let i = 0; i <= n; i++) { const p = plutoAt(y0 + (y1 - y0) * (i / n)); out.push(`${p[0].toFixed(1)},${p[1].toFixed(1)}`); }
  return out.join(" ");
}
/** The years in which Pluto is inside Neptune's ring (from the maths above, about 1979 to 1999). */
export const INSIDE: [number, number] = (() => {
  let lo = NaN, hi = NaN;
  for (let y = 1930; y < 2050; y += 0.05) { if (plutoDist(y) < NEP_AU) { if (Number.isNaN(lo)) lo = y; hi = y; } }
  return [lo, hi];
})();
export const rulerX = (year: number) => RULER.x0 + (RULER.x1 - RULER.x0) * ((year - DISC_YEAR) / PERIOD);

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const ease = (k: number) => { const c = clamp01(k); return c < 0.5 ? 2 * c * c : 1 - Math.pow(-2 * c + 2, 2) / 2; };
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

export function makePlan(story: StoryT) {
  const starts = story.beats.map((_, i) => story.beats.slice(0, i).reduce((a, b) => a + b.dur, 0));
  const total = story.beats.reduce((a, b) => a + b.dur, 0);
  const at = (id: string) => starts[Math.max(0, story.beats.findIndex((b) => b.id === id))] ?? 0;
  const sting = starts[1] ?? 0;                                   // must 1: the "Intip yuk!" sting is the second beat
  const outro = starts.at(-1) ?? total;                           // must 2: the loop-back outro is the last beat
  const m = {
    sting, stingEnd: sting + (story.beats[1]?.dur ?? 1), react: NaN, outro, end: total,
    temu: at("temu"), tahun: at("tahun"), jalan: at("jalan"), hasil: at("hasil"), neptunus: at("neptunus"), tips: at("tips"),
  };
  /** the virtual year shown by the chart at time t: parked at the discovery, then each beat runs the planet along its orbit */
  const yearKeys: [number, number][] = [
    [0, DISC_YEAR], [m.tahun + 1.2, DISC_YEAR], [m.tahun + 7.0, END_YEAR], [m.jalan - 0.01, END_YEAR], [m.jalan + 0.7, DISC_YEAR],
    [m.jalan + 1.0, DISC_YEAR], [m.jalan + 5.6, NOW_YEAR], [m.hasil + 0.6, NOW_YEAR], [m.hasil + 4.2, END_YEAR],
    [m.neptunus - 0.01, END_YEAR], [m.neptunus + 0.7, 1962], [m.neptunus + 1.0, 1962], [m.neptunus + 6.4, 2012], [m.tips - 0.01, 2012], [m.tips + 1.4, END_YEAR],
    [m.outro - 0.01, END_YEAR],
  ];
  const year = (t: number): number => {
    if (t >= m.outro) return END_YEAR;
    for (let i = 1; i < yearKeys.length; i++) {
      const [t0, y0] = yearKeys[i - 1], [t1, y1] = yearKeys[i];
      if (t <= t1) return t1 === t0 ? y1 : lerp(y0, y1, ease((t - t0) / (t1 - t0)));
    }
    return END_YEAR;
  };
  /** the swept trail: from which year to which, and how visible (0 outside the beats that use it) */
  const trail = (t: number): { from: number; to: number; a: number } => {
    const y = year(t);
    if (t >= m.tahun && t < m.neptunus) return { from: DISC_YEAR, to: Math.max(DISC_YEAR, y), a: t < m.jalan + 0.7 && t > m.jalan - 0.01 ? 1 - ease((t - m.jalan) / 0.7) : 1 };
    if (t >= m.neptunus && t < m.tips) return { from: Math.max(INSIDE[0], Math.min(INSIDE[1], 1962)), to: Math.min(INSIDE[1], Math.max(INSIDE[0], y)), a: ease((t - m.neptunus - 0.7) / 0.5) };
    if (t >= m.tips && t < m.outro) return { from: DISC_YEAR, to: END_YEAR, a: ease((t - m.tips - 1.2) / 0.5) };
    return { from: DISC_YEAR, to: DISC_YEAR, a: 0 };
  };
  // the camera: wide shot (the chart in the centre third), push to the chart, then every beat is a move inside the drawing; the outro returns to the wide shot
  // motion-exception: the establishing push goes from zoom 0.55 to 1.0 in 1.3 s (the registered establishing range, B27.8), faster than a beat's push
  const WIDE: Cam2 = { x: 540, y: 900, zoom: 0.55 };
  const dp = plutoAt(DISC_YEAR), np = plutoAt(NOW_YEAR);
  const keys: Key2[] = [
    { t: 0, ...WIDE }, { t: 1.5, ...WIDE }, { t: 2.8, x: 540, y: 930, zoom: 1.0 },
    { t: m.temu + 0.1, x: 540, y: 930, zoom: 1.0 }, { t: m.temu + 1.8, x: dp[0] + 10, y: dp[1] + 90, zoom: 1.8 }, { t: m.tahun - 0.2, x: dp[0] + 12, y: dp[1] + 92, zoom: 1.86 },
    { t: m.tahun + 1.3, x: 540, y: 930, zoom: 1.0 }, { t: m.jalan - 0.2, x: 520, y: 935, zoom: 1.08 },
    { t: m.jalan + 1.5, x: 540, y: 925, zoom: 1.12 }, { t: m.hasil - 0.2, x: 520, y: 930, zoom: 1.14 },
    { t: m.hasil + 1.5, x: 540, y: 950, zoom: 1.0 }, { t: m.neptunus - 0.2, x: 530, y: 950, zoom: 1.04 },
    { t: m.neptunus + 1.5, x: 420, y: 850, zoom: 1.28 }, { t: m.tips - 0.2, x: 420, y: 850, zoom: 1.32 },
    { t: m.tips + 1.5, x: 540, y: 1030, zoom: 0.8 }, { t: outro - 0.1, x: 540, y: 1030, zoom: 0.82 },
    { t: outro + 2.6, ...WIDE }, { t: total, ...WIDE },
  ];
  /** world-point labels: { from, to, at (world), text } in the order they appear */
  const labels = [
    { id: "y1930", from: m.temu + 1.8, to: m.tahun + 0.4, at: [dp[0] + 30, dp[1] - 60] as [number, number], text: "18 Feb 1930", fs: 50 },
    { id: "lowell", from: m.temu + 4.2, to: m.tahun + 0.4, at: [dp[0] + 30, dp[1] + 40] as [number, number], text: "Lowell", fs: 44 },
    { id: "x248", from: m.tahun + 2.0, to: m.jalan - 0.1, at: [540, 1010] as [number, number], text: "±248 tahun", fs: 58 },
    { id: "satu", from: m.tahun + 7.0, to: m.jalan - 0.1, at: [540, 1110] as [number, number], text: "satu putaran", fs: 44 },
    { id: "y2026", from: m.jalan + 5.0, to: m.hasil - 0.1, at: [np[0] + 20, np[1] - 80] as [number, number], text: "2026", fs: 52 },
    { id: "sep", from: m.jalan + 6.0, to: m.hasil - 0.1, at: [540, 1010] as [number, number], text: "belum separuh", fs: 46 },
    { id: "y2178", from: m.hasil + 3.6, to: m.neptunus - 0.1, at: [dp[0] + 20, dp[1] - 70] as [number, number], text: "2178", fs: 56 },
    { id: "pertama", from: m.hasil + 4.4, to: m.neptunus - 0.1, at: [540, 1010] as [number, number], text: "putaran pertama", fs: 44 },
    { id: "nep", from: m.neptunus + 1.6, to: m.tips - 0.1, at: [FOCUS.x - 40, FOCUS.y - NEP_R - 70] as [number, number], text: "Neptunus", fs: 46 },
    { id: "r32", from: m.neptunus + 4.2, to: m.tips - 0.1, at: [540, 1040] as [number, number], text: "resonansi 3 : 2", fs: 46 },
  ];
  /** the blink pair of plates: how far the dot has moved between the two (0..1, it flickers) */
  const lw = (t: number) => Math.min(1, Math.max(0, (t - outro) / 0.5));
  return {
    m, total, keys, starts, labels, year, trail,
    loopWeight: lw,                                                // 0 at the start, 1 in the loop-back: the scene is the first beat's again at the end (the loop)
    cam: (t: number): Cam2 => cam2At(keys, t),
    tops: [] as { b: number; headline?: string }[],
  };
}

/** The hero's box at time t, in the 1080 px frame (x, y, w, h): Pluto's orbit ellipse on the chart, seen through the hook's own camera (wide shot, then the push to the main shot). */
const HOOK_KEYS: Key2[] = [{ t: 0, x: 540, y: 900, zoom: 0.55 }, { t: 1.5, x: 540, y: 900, zoom: 0.55 }, { t: 2.8, x: 540, y: 930, zoom: 1.0 }];
export const HERO_BOX_AT = (t: number) => {
  const c = cam2At(HOOK_KEYS, t), x0 = 540 + c.zoom * (BOARD.cx - A - c.x), x1 = 540 + c.zoom * (BOARD.cx + A - c.x), y0 = 960 + c.zoom * (FOCUS.y - B - c.y), y1 = 960 + c.zoom * (FOCUS.y + B - c.y);
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
};
