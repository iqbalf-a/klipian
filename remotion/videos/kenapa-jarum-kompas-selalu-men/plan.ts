/* Kenapa jarum kompas selalu menunjuk utara? — the timing of the video (pure, no React). One continuous camera over one tabletop set (set kind "tabletop"):
   a compass on a map (the hero), a small desk globe with Earth's field, a bar magnet and a block of iron. Every moment something appears or moves is named in `T`
   (seconds of the whole video); index.tsx (the picture) and sfx.ts (the sound) read the same numbers. The needle's angle is a pure function of time. */
import type { StoryT } from "../../src/schema.ts";
import type { Key2 } from "../../src/iso.ts";

export const T = {
  kick1: 0.5, push: 1.6,
  // jarum (4 to 10)
  lblU: 5.0, lblS: 5.6, lblPivot: 6.3, magIn: 7.4, magPull: 7.9, magOut: 9.2,
  // bumi (10 to 18)
  panG: 10.3, cut: 12.4, core: 13.2, flow: 13.8, lblLiquid: 14.4, lblCrust: 16.0, uncut: 18.0,
  // garis (18 to 26)
  loop1: 19.0, loop2: 19.5, loop3: 20.0, lblLines: 19.6, tilt: 20.8, mini: 21.4, panC: 22.2, kick2: 23.0, flowT: 23.4, lblAlign: 24.6,
  // kutub (26 to 34)
  panG2: 26.2, bar: 27.6, kS: 28.4, needleG: 29.0, kN: 29.6, arrows: 30.6, lblPull: 31.8, fadeG: 33.6,
  // hasil (34 to 41)
  panC2: 34.2, noChip: 36.0, noStrike: 36.8, yesChip: 37.8,
  // fakta (41 to 47)
  tnLine: 42.0, lblTrue: 42.4, decl: 43.0, arc: 43.9, lblDecl: 44.3, declBack: 46.4,
  // tips (47 to 56)
  panT: 47.3, magIn2: 49.0, lblMag: 49.8, magOut2: 52.4, iron: 53.0, lblIron: 53.3, dip: 53.8, dipEnd: 55.9,
} as const;

/** The camera: first and last key are the same wide shot, so the video loops. The globe sits at GLOBE.x/y; the compass at (540, 1050). */
export const GLOBE = { x: -650, y: 360, r: 480 } as const;
export const CAM: Key2[] = [
  { t: 0, x: 420, y: 1060, zoom: 0.55 }, { t: 1.6, x: 420, y: 1060, zoom: 0.55 }, { t: 3.0, x: 540, y: 1050, zoom: 1.0 },
  { t: 4.0, x: 540, y: 1050, zoom: 1.0 }, { t: 9.8, x: 560, y: 1060, zoom: 1.08 },
  { t: 10.3, x: 560, y: 1060, zoom: 1.08 }, { t: 11.7, x: GLOBE.x, y: 340, zoom: 0.72 }, { t: 22.0, x: GLOBE.x, y: 340, zoom: 0.74 },
  { t: 23.6, x: 540, y: 1050, zoom: 0.95 }, { t: 26.0, x: 540, y: 1050, zoom: 0.98 },
  { t: 27.5, x: GLOBE.x, y: 340, zoom: 0.72 }, { t: 34.0, x: GLOBE.x, y: 340, zoom: 0.74 },
  { t: 35.6, x: 540, y: 1050, zoom: 1.0 }, { t: 40.8, x: 540, y: 1050, zoom: 1.04 },
  { t: 42.2, x: 620, y: 1000, zoom: 1.1 }, { t: 46.8, x: 620, y: 1000, zoom: 1.1 },
  { t: 48.6, x: 560, y: 950, zoom: 0.8 }, { t: 55.6, x: 560, y: 950, zoom: 0.8 },
  { t: 57.6, x: 420, y: 1060, zoom: 0.55 }, { t: 60, x: 420, y: 1060, zoom: 0.55 },
];

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const ease = (k: number) => { k = clamp01(k); return k * k * (3 - 2 * k); };
/** A needle pulled by a magnet: it swings to `deg` between a and b (fast, with a little overshoot), then rings back to 0 once the magnet has gone. Zero before a. */
const swing = (t: number, a: number, b: number, deg: number): number => {
  if (t < a) return 0;
  if (t < b) { const d = t - a; return deg * (1 - Math.exp(-6 * d) * Math.cos(10 * d)); }
  const held = deg * (1 - Math.exp(-6 * (b - a)) * Math.cos(10 * (b - a))), d = t - b;
  return held * Math.exp(-1.3 * d) * Math.cos(2 * Math.PI * 0.85 * d);
};
/** A flick: the needle is spun by `deg` and rings down (it starts at 0, so the first frame is unchanged). */
const flick = (t: number, a: number, deg: number): number => (t < a ? 0 : deg * Math.exp(-1.15 * (t - a)) * Math.sin(2 * Math.PI * 0.95 * (t - a)));

/** The needle's angle at time t, in degrees clockwise from true north (0 = north, 90 = east). A soft wobble all the time, and the events of the story. */
export function needleAngle(t: number): number {
  const wobble = 3 * Math.sin((2 * Math.PI * t) / 6);                       // a whole number of periods in 60 s: the loop closes
  const decl = 14 * (ease((t - T.decl) / 0.9) - ease((t - T.declBack) / 0.8));
  return wobble + flick(t, T.kick1, 110) + swing(t, T.magPull, T.magOut, 72) + flick(t, T.kick2, 120) + decl
    + swing(t, T.magIn2 + 0.6, T.magOut2, 72) + swing(t, T.iron + 0.2, T.iron + 1.3, 12);
}

/** The bar magnet's x (world units from the compass, along +x): 9 = resting at the right edge, 4.7 = beside the compass. */
export function magX(t: number): number {
  const REST = 9.2, NEAR = 4.7;
  const a = ease((t - T.magIn) / 0.8) - ease((t - T.magOut) / 0.9), b = ease((t - T.magIn2) / 0.8) - ease((t - T.magOut2) / 0.9);
  return REST + (NEAR - REST) * clamp01(a + b);
}

export function makePlan(story: StoryT) {
  const starts = story.beats.map((_, i) => story.beats.slice(0, i).reduce((a, b) => a + b.dur, 0));
  const total = story.beats.reduce((a, b) => a + b.dur, 0);
  const sting = starts[1] ?? 0;
  const outro = starts.at(-1) ?? total;
  const m = { sting, stingEnd: sting + (story.beats[1]?.dur ?? 1), react: NaN, outro, end: total };
  return {
    m, total, starts,
    loopWeight: (t: number) => Math.min(1, Math.max(0, (t - outro) / 0.5)),
    tops: [] as { b: number; headline?: string }[],
    labels: [] as { to: number; text: string }[],
  };
}

/** The hero's box at time t, in the 1080 px frame: the compass (about 65 % of the width in the main shot). */
export const HERO_BOX_AT = (_t: number) => ({ x: 540, y: 960, w: 700, h: 430 });
