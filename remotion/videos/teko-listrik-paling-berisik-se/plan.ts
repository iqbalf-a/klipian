/* Teko listrik paling berisik sebelum mendidih — the timing of this video (pure: no React here). The formula is DESIGN.md section 0b: the hook, the "Intip yuk!" sting right after it,
   the explain beats, the result, the tip and the loop-back outro. The beats come from the story; the moments below are offsets from each beat's start.
   One set (B27): a kitchen wall and a counter that run past every edge of the frame; the electric kettle on its power base is the hero (the iso kit), a cup and two canisters are the
   dressing. The camera is a function of the video's clock: the wide shot of the set, the establishing push to the kettle, then a push or a pan inside the same set per beat (down to the
   heating element, up the water window, a macro on a collapsing bubble), and the way back to the wide shot in the outro, so the last frame is the first. Every state (the element's
   glow, the bubbles, the sound arcs, the meter, the power lamp) is a function of the clock as well, and every periodic motion has a period that divides 60 s.
   motion-exception: the hook's establishing push (zoom 0.5 to 1.15 in 1.4 s) is the registry's establishing push (B27.8); the pans and pushes stay in the ranges. */
import type { StoryT } from "../../src/schema.ts";
import { cam2At, isoAt, toScreen, type Cam2, type Key2, type P2, type P3 } from "../../src/iso.ts";

/** The set's one scale: U px per world unit, O the screen px of the world origin (the middle of the power base's foot on the counter top). 1 unit is about 7 cm, so the kettle
    (body 2.7 units wide, 3.8 high) is about 19 cm by 27 cm. */
export const U = 160;
export const O: P2 = [540, 1500];
export const world = (p: P3): P2 => isoAt(p, U, O);

/** Where things stand (world units, x to the lower right, y to the lower left, z up; the counter top is z = 0, the wall is the plane y = WALL_Y). */
export const WALL_Y = -2.2;
export const CUP_AT = [-5.6, 0.2] as const;               // the cup (dressing 1)
export const CAN_AT = [[6.6, -1.1], [8.2, -1.0]] as const;  // the two canisters (dressing 2)
export const METER = { x0: 3.4, y0: 2.6, cell: 0.5, gap: 0.1, n: 10 } as const;   // the heat meter in front of the kettle, on the counter
export const KETTLE = { rBase: 1.38, rTop: 1.22, z0: 0.62, z1: 3.5, lidZ: 3.86 } as const;
/** The water window on the kettle's front: the angles (deg) of its two edges round the axis, and its heights. */
export const WIN = { th0: 22, th1: 68, z0: 0.95, z1: 3.15 } as const;

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const smooth = (k: number) => { const c = clamp01(k); return c * c * (3 - 2 * c); };
/** A value that moves between keys [t, value] with a smooth ease, held before the first and after the last. */
export function keyed(t: number, keys: readonly (readonly [number, number])[]): number {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const [t1, v1] = keys[i], [t0, v0] = keys[i - 1];
    if (t < t1) return v0 + (v1 - v0) * smooth((t - t0) / (t1 - t0));
  }
  return keys[keys.length - 1][1];
}

// the camera: the world px point at the middle of the screen, and a zoom. The beats start at 0, 3, 4, 18, 26, 34, 41, 47, 56.
const K = (t: number, x: number, y: number, zoom: number): Key2 => ({ t, x, y, zoom });
export const CAM_KEYS: Key2[] = [
  K(0, 540, 1100, 0.5), K(1.5, 540, 1100, 0.5),         // the wide shot of the set, 1.5 s: the kettle in the middle third
  K(2.9, 540, 1150, 1.1),                               // the establishing push: the kettle is about 60 % of the width
  K(4, 540, 1160, 1.12),                                // sting: the world keeps moving
  K(9.6, 540, 1283, 1.17),                               // dasar: down to the element at the bottom of the window (the lid stays under the top text)
  K(10.4, 540, 1283, 1.17),
  K(17.6, 540, 1283, 1.19),                             // gelembung: a slow push while the bubbles grow and let go
  K(19.6, 540, 1283, 1.17),                             // runtuh: a pan up the window, the bubbles rise into cooler water
  K(25.6, 540, 1283, 1.18),
  K(27.4, 548, 1150, 1.17),                              // kejut: the macro on a collapsing bubble near the top
  K(33.6, 548, 1150, 1.18),
  K(36.4, 250, 930, 0.8),                              // hasil: back out to the whole kettle, the heat meter on the wall at the left
  K(40.4, 260, 935, 0.8),
  K(42.4, 640, 1240, 1.15),                              // fakta: a pan to the handle and the power lamp
  K(46.4, 640, 1235, 1.2),
  K(48.4, 560, 1150, 0.95),                             // tips: the whole kettle again
  K(55.4, 560, 1140, 0.92),
  K(59.4, 540, 1100, 0.5),                              // outro: back to the hook's wide shot (the last frame is the first)
  K(60, 540, 1100, 0.5),
];
export const camAt = (t: number): Cam2 => cam2At(CAM_KEYS, t);

export const startsOf = (story: StoryT): Record<string, number> => {
  const out: Record<string, number> = {};
  let a = 0;
  for (const b of story.beats) { out[b.id] = a; a += b.dur; }
  return out;
};

/** The states of the set at a time (all functions of the video's clock). */
export function stateAt(t: number) {
  // the element under the water: a little warm in the hook, red-hot while the water is noisy, dim again in the loop-back
  const heat = keyed(t, [[0, 0.3], [4, 0.3], [6, 1], [44.2, 1], [45.4, 0.15], [56, 0.15], [59.5, 0.3], [60, 0.3]]);
  // how much the water just over the element is hotter than the rest (the orange layer in the window)
  const layer = keyed(t, [[0, 0.15], [4, 0.15], [6.6, 1], [9.4, 1], [18, 0.8], [34, 0.8], [41, 0.3], [59, 0.3], [60, 0.15]]);
  // the share of bubbles at work (0..1), how high they rise before they collapse (0..1 of the window) and how hard the collapse shows (rings, shock arcs)
  const bubbles = keyed(t, [[0, 0.3], [4, 0.3], [9.5, 0.2], [11, 0.9], [14, 1], [35, 1], [44.2, 1], [45.6, 0], [56, 0], [59, 0.3], [60, 0.3]]);
  const reach = keyed(t, [[0, 0.5], [10, 0.5], [10.1, 0.22], [17.5, 0.22], [19.5, 0.55], [60, 0.55]]);
  const burst = keyed(t, [[0, 0.3], [4, 0.3], [18, 0.3], [20, 1], [34, 1], [41, 0.6], [45, 0.6], [46, 0], [56, 0], [59, 0.3], [60, 0.3]]);
  const sound = keyed(t, [[0, 0.3], [4, 0.3], [19, 0.3], [21, 1], [41, 1], [44.4, 1], [45.6, 0], [56, 0], [59, 0.3], [60, 0.3]]);   // the arcs round the kettle
  const meter = keyed(t, [[0, 0], [34.5, 0], [35.3, 1], [40.6, 1], [41.4, 0], [60, 0]]);                   // the heat meter: shown
  const fill = keyed(t, [[0, 0], [35.4, 0], [39.4, 1], [60, 1]]);                                           // ... and filled, cell by cell
  const lamp = keyed(t, [[0, 1], [44.2, 1], [44.7, 0], [57.5, 0], [59, 1], [60, 1]]);                       // the power lamp: on until the kettle switches itself off
  const steam = keyed(t, [[0, 0.4], [10, 0.5], [30, 0.6], [43, 1], [45.2, 0.4], [56, 0.1], [59.5, 0.4], [60, 0.4]]);
  return { heat, layer, bubbles, reach, burst, sound, meter, fill, lamp, steam };
}

/** The kicker of the top text per beat kind (the headline is the beat's own text). */
const KICKER: Record<string, string> = { hook: "TEKO LISTRIK", normal: "DI DALAM TEKO", result: "HASILNYA", tips: "TIPS" };
const KICKER_BY_ID: Record<string, string> = { dasar: "PEMANAS", runtuh: "RUNTUH", kejut: "BUNYI", hasil: "URUTANNYA", fakta: "TEKO MODERN" };

export function makePlan(story: StoryT) {
  const starts = story.beats.map((_, i) => story.beats.slice(0, i).reduce((a, b) => a + b.dur, 0));
  const total = story.beats.reduce((a, b) => a + b.dur, 0);
  const sting = starts[1] ?? 0;                                   // must 1: the "Intip yuk!" sting is the second beat
  const outro = starts.at(-1) ?? total;                           // must 2: the loop-back outro is the last beat
  const at = (id: string) => starts[story.beats.findIndex((b) => b.id === id)] ?? 0;
  const m = {
    sting, stingEnd: sting + (story.beats[1]?.dur ?? 1), react: NaN, outro, end: total,
    element: at("dasar") + 1.4, hotLayer: at("dasar") + 3.2, born: at("dasar") + 6.6, detach: at("dasar") + 9.5, rise: at("runtuh") + 0.4, pop: at("runtuh") + 3.2,
    shock: at("kejut") + 1.6, arcs: at("kejut") + 4.2, meter: at("hasil") + 0.8, boilMark: at("hasil") + 5.2, off: at("fakta") + 3.2, kw: at("fakta") + 0.8, tip: at("tips") + 0.6,
  };
  // the top text of every beat except the sting and the outro: the kicker and the headline (the beat's text)
  const tops = story.beats.map((b, i) => ({ a: starts[i], b: starts[i] + b.dur, id: b.id, kind: b.kind, kicker: KICKER_BY_ID[b.id] ?? KICKER[b.kind] ?? "INTIP", headline: b.text }))
    .filter((x) => x.kind !== "sting" && x.kind !== "outro");
  return {
    m, total, starts,
    // 0 at the start, 1 in the loop-back: the scene is the first beat's again at the end (the loop)
    loopWeight: (t: number) => Math.min(1, Math.max(0, (t - outro) / 0.5)),
    tops,
    labels: [] as { to: number; text: string }[],                  // the labels are placed in index.tsx
    cam: camAt,
    state: stateAt,
  };
}

/** The hero's box at time t, in the 1080 px frame (x, y, w, h): the kettle with its power base seen through the camera. */
export const HERO_BOX_AT = (t: number) => {
  const c = camAt(t), half = KETTLE.rBase * U * 1.2247 * 1.18;
  const [x0, y0] = toScreen(c, [O[0] - half, O[1] - KETTLE.lidZ * U - 0.35 * U]);
  const [x1, y1] = toScreen(c, [O[0] + half, O[1] + 0.8 * U]);
  return { x: (x0 + x1) / 2, y: (y0 + y1) / 2, w: x1 - x0, h: y1 - y0 };
};
