/* Bohlam pijar: lampu atau pemanas? — the timing of this video (pure: no React here). The formula is DESIGN.md section 0b: the hook, the "Intip yuk!" sting right after it,
   the explain beats, the result, the tip and the loop-back outro. The beats come from the story; the moments below are offsets from each beat's start.
   One set (B27): a dark table in front of a wall, the bare bulb on its stand is the hero (the iso kit), a coffee cup, a pile of books and a wall air conditioner are the dressing.
   The camera is a function of the video's clock: the wide shot of the set, the establishing push to the bulb, then a push or a pan inside the same set per beat, and the
   way back to the wide shot in the outro, so the last frame is the first. Every state (glow, heat, the energy bar, the LED) is a function of the clock as well.
   motion-exception: the hook's establishing push (zoom 0.5 to 1.15 in 1.4 s) is the registry's establishing push (B27.8); the pans and pushes stay in the ranges. */
import type { StoryT } from "../../src/schema.ts";
import { cam2At, isoAt, toScreen, type Cam2, type Key2, type P2, type P3 } from "../../src/iso.ts";

/** The set's one scale: U px per world unit, O the screen px of the world origin (the middle of the stand's foot on the table top). 1 unit is about 2.5 cm. */
export const U = 160;
export const O: P2 = [540, 1500];
export const world = (p: P3): P2 => isoAt(p, U, O);

/** Where things stand (world units, x to the lower right, y to the lower left, z up; the table top is z = 0, the wall is the plane y = WALL_Y). */
export const WALL_Y = -1.8;
export const BULB_AT = [0, 0] as const;                 // the hero
export const LED_AT = [3.6, -0.6] as const;             // the LED in the result beat
export const CLOCK_AT = [-4.2, 0.6] as const;            // the coffee cup
export const BOOKS_AT = [6.4, -0.9] as const;
export const AC_BOX = { a: [-13.6, WALL_Y, 4.6], b: [-9.6, -0.9, 6.2] } as const;
export const BAR = { x0: 1.04, y0: 1.34, cell: 0.4, gap: 0.08, n: 5 } as const;   // 25 cells: 24 hot, 1 light = 4 %, "less than 5 %"
export const BULB_ZC = 5.0, BULB_R = 1.45;

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

// the camera: the world px point at the middle of the screen, and a zoom. The beats start at 0, 3, 4, 11, 19, 27, 35, 42, 48, 56.
const K = (t: number, x: number, y: number, zoom: number): Key2 => ({ t, x, y, zoom });
export const CAM_KEYS: Key2[] = [
  K(0, 540, 1100, 0.5), K(1.5, 540, 1100, 0.5),         // the wide shot of the set, 1.5 s: the bulb in the middle third
  K(2.9, 540, 720, 1.15),                               // the establishing push: the bulb is about 60 % of the width
  K(4, 540, 730, 1.17),                                 // sting: the world keeps moving
  K(10.5, 540, 760, 1.4),                               // listrik: a slow push in on the filament
  K(11.8, 540, 780, 1.22),                              // pijar: back out a little, the whole bulb glows
  K(18.7, 540, 790, 1.3),
  K(20.2, 540, 790, 1.3),                               // panas: the light first ...
  K(21.8, 520, 1700, 1.0),                              // ... then a pan down to the 25 squares of energy
  K(25.7, 520, 1700, 1.0),
  K(27.2, 540, 760, 1.1),                               // infra: back up to the bulb, the invisible rays
  K(34.6, 540, 740, 1.25),
  K(36.2, 830, 900, 0.8),                               // hasil: a pan to the LED beside the bulb
  K(40.4, 830, 900, 0.88),
  K(42.9, -780, -250, 1.0),                               // ac: a pan to the air conditioner on the wall
  K(47.3, -780, -250, 1.05),
  K(49.1, 830, 900, 0.82),                              // tips: both bulbs again
  K(55.4, 830, 880, 0.88),
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
  // the filament: lit in the hook, off when the beat "listrik" starts, switched on at 5.4 s, lit to the end (the loop-back: lit at 0 and at 60)
  const glow = keyed(t, [[0, 1], [4.1, 1], [4.6, 0], [5.4, 0], [7.4, 1], [60, 1]]);
  const heat = keyed(t, [[0, 0.35], [4.1, 0.35], [4.6, 0], [5.4, 0], [8, 0.5], [19, 0.7], [23.5, 1], [47, 1], [48.5, 0.8], [56, 0.8], [59.5, 0.35], [60, 0.35]]);
  const ir = keyed(t, [[0, 0], [27.3, 0], [28.5, 1], [34, 1], [35, 0], [60, 0]]);        // the invisible infrared rings
  const current = keyed(t, [[0, 0], [5.3, 0], [5.6, 1], [10.6, 1], [11.4, 0], [60, 0]]); // the dots that run through the filament
  const bar = keyed(t, [[0, 0], [20.4, 0], [21.2, 1], [33.6, 1], [34.6, 0], [60, 0]]);   // the energy squares: shown
  const conv = keyed(t, [[0, 0], [22, 0], [26, 1], [60, 1]]);                            // ... and turned into heat, one by one
  const led = keyed(t, [[0, 0], [36, 0], [37.2, 1], [54.4, 1], [55.8, 0], [60, 0]]);     // the LED bulb: grows in, shrinks away
  const ac = keyed(t, [[0, 0.3], [42, 0.3], [44, 1], [47.5, 1], [49, 0.3], [60, 0.3]]);  // the air conditioner's load
  const near = keyed(t, [[0, 0], [42.5, 0], [44, 1], [47, 1], [48.5, 0], [60, 0]]);      // the heat that reaches the air conditioner
  return { glow, heat, ir, current, bar, conv, led, ac, near };
}

/** The kicker of the top text per beat kind (the headline is the beat's own text). */
const KICKER: Record<string, string> = { hook: "BOHLAM PIJAR", normal: "DI DALAM BOHLAM", result: "PERBANDINGAN", tips: "TIPS" };
const KICKER_BY_ID: Record<string, string> = { listrik: "FILAMEN", pijar: "CAHAYA", panas: "ENERGI", infra: "PANAS", ac: "RUANGAN" };

export function makePlan(story: StoryT) {
  const starts = story.beats.map((_, i) => story.beats.slice(0, i).reduce((a, b) => a + b.dur, 0));
  const total = story.beats.reduce((a, b) => a + b.dur, 0);
  const sting = starts[1] ?? 0;                                   // must 1: the "Intip yuk!" sting is the second beat
  const outro = starts.at(-1) ?? total;                           // must 2: the loop-back outro is the last beat
  const m = { sting, stingEnd: sting + (story.beats[1]?.dur ?? 1), react: NaN, outro, end: total, off: 4.1, on: 5.4, ledIn: 36, convStart: 22 };
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

/** The hero's box at time t, in the 1080 px frame (x, y, w, h): the bulb with its stand seen through the camera. */
export const HERO_BOX_AT = (t: number) => {
  const c = camAt(t), half = BULB_R * U * 1.22;
  const [x0, y0] = toScreen(c, [O[0] - half, O[1] - (BULB_ZC + BULB_R) * U]);
  const [x1, y1] = toScreen(c, [O[0] + half, O[1] + 40]);
  return { x: (x0 + x1) / 2, y: (y0 + y1) / 2, w: x1 - x0, h: y1 - y0 };
};
