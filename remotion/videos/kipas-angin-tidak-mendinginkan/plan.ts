/* Kipas angin tidak mendinginkan udara — the timing of this video (pure: no React here). The formula is DESIGN.md section 0b: the hook, the "Intip yuk!" sting right after it,
   the explain beats, the result, the tip and the loop-back outro. The beats come from the story; the moments below are offsets from each beat's start.
   One set (B27): a room wall and a table that run past every edge of the frame; the desk fan (the iso kit's IsoFan, big) blows along the table's x axis, a standing thermometer stands in
   its stream and a slab of skin with drops of sweat lies further on; a cup and a pile of books are the dressing. The camera is a function of the
   video's clock: the wide shot, the establishing push, a push or a pan per beat (the thermometer, the skin, the motor), and the way back to the wide shot in the outro, so the last frame
   is the first. Every state (the fan's speed, the thermometer, the sweat, the heat) is a function of the clock, and every periodic motion has a period that divides 60 s.
   motion-exception: the hook's establishing push (zoom 0.55 to 1.1 in 1.4 s) is the registry's establishing push (B27.8); the pans and pushes stay in the ranges. */
import type { StoryT } from "../../src/schema.ts";
import { cam2At, isoAt, toScreen, type Cam2, type Key2, type P2, type P3 } from "../../src/iso.ts";

/** The set's one scale: U px per world unit, O the screen px of the world origin (the middle of the fan's foot on the table top). 1 unit is about 16 cm: the fan is 2.5 units (40 cm). */
export const U = 250;
export const O: P2 = [540, 1500];
export const world = (p: P3): P2 => isoAt(p, U, O);

/** Where things stand (world units, x to the lower right, y to the lower left, z up; the table top is z = 0, the wall is the plane y = WALL_Y). The fan blows along +x. */
export const WALL_Y = -2.6;
export const FAN_HEAD = [0.2, 0, 1.65] as const;          // the middle of the guard
export const MOTOR_AT = [-0.3, 0, 1.65] as const;
export const THERMO = { x: 1.7, y: 0.15, h: 1.5 } as const; // the thermometer in the stream: its tube is 1.5 units high
export const SLAB = { a: [3.1, -0.7, 0], b: [4.5, 0.9, 0.3] } as const;   // the skin
export const CUP_AT = [-2.6, -0.4] as const;
export const BOOKS_AT = [-5.0, -1.6] as const;

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

// the camera: the world px point at the middle of the screen, and a zoom. The beats start at 0, 3, 4, 13, 28, 37, 45, 56.
const K = (t: number, x: number, y: number, zoom: number): Key2 => ({ t, x, y, zoom });
export const CAM_KEYS: Key2[] = [
  K(0, 900, 1520, 0.55), K(1.5, 900, 1520, 0.55),       // the wide shot of the set, 1.5 s: the fan, the thermometer and the skin in a row
  K(2.9, 800, 1340, 1.1),                               // the establishing push: the fan and the thermometer (the fan's top stays under the top text)
  K(4, 800, 1345, 1.12),                                // sting: the world keeps moving
  K(12.4, 860, 1320, 1.15),                             // udara: a slow push on the thermometer in the stream
  K(15.2, 1330, 1850, 1.2),                             // badan: a pan down the table to the skin
  K(27.4, 1335, 1860, 1.25),
  K(30.2, 640, 1300, 1.2),                              // motor: a pan back to the fan's motor
  K(36.6, 650, 1305, 1.25),
  K(38.6, 930, 1560, 0.72),                             // hasil: back out to the whole row
  K(44.6, 930, 1560, 0.75),
  K(46.4, 800, 1400, 0.95),                             // tips: the fan again
  K(55.4, 800, 1400, 1.0),
  K(59.4, 900, 1520, 0.55),                             // outro: back to the hook's wide shot (the last frame is the first)
  K(60, 900, 1520, 0.55),
];
export const camAt = (t: number): Cam2 => cam2At(CAM_KEYS, t);

export const startsOf = (story: StoryT): Record<string, number> => {
  const out: Record<string, number> = {};
  let a = 0;
  for (const b of story.beats) { out[b.id] = a; a += b.dur; }
  return out;
};

/** The fan's speed (1 = 2.2 turns a second): it runs all the video, stops while the tip says to switch it off, and is back on in the loop-back. */
const speedAt = (t: number) => keyed(t, [[0, 1], [47.6, 1], [48.6, 0], [56, 0], [57, 1], [60, 1]]);
const SPIN_STEP = 1 / 30;
/** The fan's own clock: the integral of its speed, so the blades slow down and speed up instead of jumping (the table is built once). */
const SPIN: number[] = (() => { const a = [0]; for (let i = 1; i <= 60 * 30; i++) a.push(a[i - 1] + speedAt((i - 0.5) * SPIN_STEP) * SPIN_STEP); return a; })();
export const fanClock = (t: number): number => { const f = Math.max(0, Math.min(60 * 30, t * 30)), i = Math.floor(f); return SPIN[i] + (SPIN[Math.min(i + 1, SPIN.length - 1)] - SPIN[i]) * (f - i); };

/** The states of the set at a time (all functions of the video's clock). */
export function stateAt(t: number) {
  const speed = speedAt(t);
  // the air's temperature on the thermometer: the same all the way (0.55), a little up while the motor's waste heat is the point, back down by the loop-back
  const temp = keyed(t, [[0, 0.55], [30, 0.55], [34, 0.6], [46, 0.6], [56, 0.55], [60, 0.55]]);
  // the sweat on the skin: drops from the start, they shrink and rise as vapour while the fan blows (evap 0 to 1), and come back when it is off
  const evap = keyed(t, [[0, 0], [15, 0], [24, 1], [45, 1], [47, 1], [56, 0], [60, 0]]);
  const sweat = keyed(t, [[0, 0.8], [13, 0.8], [15, 1], [47, 1], [56, 0.8], [60, 0.8]]);
  const skinHeat = keyed(t, [[0, 0.5], [13, 0.5], [16, 1], [26, 0.7], [47, 0.7], [56, 0.5], [60, 0.5]]);   // the heat that leaves the skin
  const motorHeat = keyed(t, [[0, 0.25], [28, 0.25], [30, 1], [36, 1], [45, 0.6], [48.6, 0], [56, 0], [57, 0.25], [60, 0.25]]);
  const air = keyed(t, [[0, 1], [47.6, 1], [48.6, 0], [56, 0], [57, 1], [60, 1]]);                                // the streaks of air
  const cool = keyed(t, [[0, 0], [37.6, 0], [39.4, 1], [44.6, 1], [45.4, 0], [60, 0]]);                           // the verdict labels
  return { speed, temp, evap, sweat, skinHeat, motorHeat, air, cool };
}

/** The kicker of the top text per beat kind (the headline is the beat's own text). */
const KICKER: Record<string, string> = { hook: "KIPAS ANGIN", normal: "KIPAS ANGIN", result: "HASILNYA", tips: "TIPS" };
const KICKER_BY_ID: Record<string, string> = { udara: "UDARA", badan: "KULIT", motor: "MOTOR" };

export function makePlan(story: StoryT) {
  const starts = story.beats.map((_, i) => story.beats.slice(0, i).reduce((a, b) => a + b.dur, 0));
  const total = story.beats.reduce((a, b) => a + b.dur, 0);
  const sting = starts[1] ?? 0;                                   // must 1: the "Intip yuk!" sting is the second beat
  const outro = starts.at(-1) ?? total;                           // must 2: the loop-back outro is the last beat
  const at = (id: string) => starts[story.beats.findIndex((b) => b.id === id)] ?? 0;
  const m = {
    sting, stingEnd: sting + (story.beats[1]?.dur ?? 1), react: NaN, outro, end: total,
    flow: at("udara") + 0.6, thermo: at("udara") + 2.2, same: at("udara") + 5.4, drops: at("badan") + 2.4, vapour: at("badan") + 4.4, carry: at("badan") + 9.6,
    motor: at("motor") + 1.2, warm: at("motor") + 3.6, verdict: at("hasil") + 1.4, tip: at("tips") + 0.6, off: 47.6,
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

/** The hero's box at time t, in the 1080 px frame (x, y, w, h): the fan with the thermometer in its stream (the hero is the fan and the air it blows). */
export const HERO_BOX_AT = (t: number) => {
  const c = camAt(t);
  const pts = ([[0.2, 0.84, 2.5], [-0.55, 0.22, 1.65], [THERMO.x + 0.11, THERMO.y - 0.11, 0.1], [0.2, 0, 2.5], [0.6, 0.6, 0]] as P3[]).map((p) => toScreen(c, world(p)));
  const l = Math.min(...pts.map((p) => p[0])), r = Math.max(...pts.map((p) => p[0])), tp = Math.min(...pts.map((p) => p[1])), bt = Math.max(...pts.map((p) => p[1]));
  return { x: (l + r) / 2, y: (tp + bt) / 2, w: r - l, h: bt - tp };
};
