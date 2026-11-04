/* Benarkah kita cuma pakai 10 persen otak?: the timing and the room of the video (pure, no React). One brain scan room (set kind "scan-room"): an MRI
   scanner with its bed on the left, a big wall screen in the middle that shows the scan of a brain (the hero), the operator's desk with a monitor on the
   right. One continuous camera (CAM). Every moment something appears is named in `T`; index.tsx (the picture) and sfx.ts (the sound) read the same
   numbers. All times are seconds of the whole video. World units are metres (one scale for the room, B27.7), U px a metre. */
import type { StoryT } from "../../src/schema.ts";
import { isoAt, type Key2, type P2, type P3 } from "../../src/iso.ts";

export const U = 360;
export const O: P2 = [540, 1300];
export const W = (p: P3): P2 => isoAt(p, U, O);

/** The room, in metres (x along the back wall, y towards the viewer, z up). Real sizes: an MRI scanner about 1.8 m wide and 2 m high, its bed 0.6 m wide
    at 0.74 m, a wall screen 2.4 x 1.6 m, a desk 75 cm high, a monitor about 80 x 50 cm, a book 35 x 25 x 5 cm. The boxes never intersect (B27.9). */
export const ROOM = {
  wall: { a: [-8, -0.3, 0] as P3, b: [8, 0, 9] as P3 },
  floor: { a: [-8, 0, -0.3] as P3, b: [8, 8, 0] as P3 },
  scanner: { a: [-2.2, 0.4, 0] as P3, b: [-0.4, 2.2, 2.0] as P3 },
  bore: { y: 1.3, z: 1.05, r: 0.36 },
  bedBase: { a: [-0.15, 1.1, 0] as P3, b: [0.5, 1.5, 0.64] as P3 },
  screen: { a: [0, 0, 1.0] as P3, b: [2.4, 0.1, 2.6] as P3 },
  desk: { a: [3.9, 0.3, 0.68] as P3, b: [5.3, 1.1, 0.75] as P3 },
  monitor: { a: [4.25, 0.5, 0.95] as P3, b: [5.05, 0.56, 1.45] as P3 },
  book: { a: [3.95, 0.72, 0.75] as P3, b: [4.3, 0.97, 0.8] as P3 },
  colA: { a: [1.9, 2.3, 0] as P3, b: [2.2, 2.6, 0.12] as P3 },     // 2 % of the body's weight
  colB: { a: [2.6, 2.3, 0] as P3, b: [2.9, 2.6, 1.2] as P3 },      // 20 % of the body's energy (ten times taller)
} as const;
/** The bed slides out of the bore along x: its x span at slide k (0 = out, 1 = in). */
export const bedX = (k: number): [number, number] => [-0.6 - 1.0 * k, 1.6 - 1.0 * k];
export const BED = { y0: 1.05, y1: 1.55, z0: 0.64, z1: 0.74 } as const;

/** The brain on the wall screen, in its own coordinates (nx -1 front .. 1 back, nz -1 bottom .. 1 top) mapped onto the screen's face (y = 0.1). */
export const BRAIN = { cx: 1.2, cz: 1.85, sx: 0.85, sz: 0.55, y: 0.101 } as const;
export const N = (nx: number, nz: number): P2 => W([BRAIN.cx + BRAIN.sx * nx, BRAIN.y, BRAIN.cz + BRAIN.sz * nz]);

export const T = {
  push: 1.5, pushEnd: 2.9, myth: 0.3,
  panScan: 4.3, bedIn: 5.6, scanRings: 6.6, lblScan: 7.2, bedStop: 7.4, panBack: 9.8, sweep: 10.4, reveal: 11.2,
  occ: 12.6, tem: 13.7, fro: 14.8, par: 15.9, cer: 17.0, night: 18.6, lblSleep: 19.4, day: 21.4,
  panCols: 22.3, colA: 23.9, lblA: 24.4, colB: 25.2, lblB: 25.9, panUp: 27.4, flow: 28.4, lblWaste: 29.4,
  panBrain: 31.0, hurtA: 32.6, lostA: 33.2, hurtB: 34.6, lostB: 35.2, heal: 36.2, stamp: 36.8, chip: 37.6,
  panDesk: 40.2, book: 41.6, lbl1936: 42.2, tag: 43.2, twist: 44.6, cross: 45.6,
  panTips: 48.0, wave: 48.4, tipA: 49.0, tipB: 51.6,
  back: 56.2, wide: 58.6,
} as const;

/** The camera keys. First and last are the same wide shot, so the video loops.
    motion-exception: the hook's establishing push (0.5 to 1.25 in 1.4 s) and the loop-back (1.1 to 0.5) are faster than a beat's push, as B27.8 asks. */
const WIDE = { x: 883, y: 1000, zoom: 0.5 }, MAIN = { x: 883, y: 830, zoom: 1.25 };
export const CAM: Key2[] = [
  { t: 0, ...WIDE }, { t: T.push, ...WIDE }, { t: T.pushEnd, ...MAIN }, { t: T.panScan, x: 883, y: 835, zoom: 1.27 },
  { t: 5.8, x: 200, y: 1150, zoom: 1.0 }, { t: T.panBack, x: 210, y: 1160, zoom: 1.06 },
  { t: 11.4, x: 883, y: 830, zoom: 1.2 }, { t: T.night, x: 883, y: 830, zoom: 1.28 }, { t: T.panCols, x: 883, y: 835, zoom: 1.3 },
  { t: 23.8, x: 820, y: 1900, zoom: 1.0 }, { t: T.panUp, x: 820, y: 1890, zoom: 1.08 },
  { t: 28.9, x: 860, y: 1250, zoom: 0.72 }, { t: T.panBrain, x: 860, y: 1250, zoom: 0.75 },
  { t: 32.3, ...MAIN }, { t: T.panDesk, x: 883, y: 830, zoom: 1.33 },
  { t: 41.8, x: 1680, y: 1860, zoom: 1.2 }, { t: T.panTips, x: 1680, y: 1860, zoom: 1.28 },
  { t: 49.5, x: 883, y: 720, zoom: 1.1 }, { t: T.back, x: 883, y: 720, zoom: 1.15 },
  { t: T.wide, ...WIDE }, { t: 60, ...WIDE },
];

/** The regions of the brain (the lobes, the cerebellum and the brainstem): their labels for the "aktif" beat and when each lights up. */
export const REGIONS = ["frontal", "parietal", "temporal", "occipital", "cerebellum", "stem"] as const;
export type Region = (typeof REGIONS)[number];
export const REGION_LABEL: Partial<Record<Region, { text: string; at: number; to: P2 }>> = {
  occipital: { text: "melihat", at: T.occ, to: [0.8, 0.3] },
  temporal: { text: "mendengar", at: T.tem, to: [-0.15, -0.35] },
  frontal: { text: "berpikir", at: T.fro, to: [-0.6, 0.4] },
  parietal: { text: "sentuhan", at: T.par, to: [0.3, 0.6] },
  cerebellum: { text: "keseimbangan", at: T.cer, to: [0.55, -0.6] },
};

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

/** The hero's box at time t, in the 1080 px frame: the brain on the wall screen (centre third in the wide shot, about 61 % wide at the main shot). */
export const HERO_BOX_AT = (t: number) => (t < T.push ? { x: 540, y: 885, w: 265, h: 246 } : { x: 540, y: 984, w: 662, h: 614 });
