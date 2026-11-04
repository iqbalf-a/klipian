/* Kenapa AC meneteskan air? — the timing of this video (pure: no React here). The formula is DESIGN.md section 0b: the hook, the "Intip yuk!" sting right after it,
   the explain beats, the result, the bad case, the tip and the loop-back outro. The beats come from the story; the moments below are offsets from each beat's start.
   One set (B27.15, set.json "ac-wall-section"): a house cut open along the plane x = XC. On the left the bedroom: its outer wall (the plane y = WB) with the split AC's
   indoor unit high on it (the hero), a tiled floor and a potted plant; on the right the garden outside that wall: a paved yard, the outdoor unit, a fence and the
   neighbour's wall far back. The drain hose leaves the indoor unit, crosses the wall where the house is cut and hangs down outside over a floor drain.
   The camera is a function of the video's clock: the wide shot, the establishing push, a push or a pan per beat, and the way back to the wide shot in the outro,
   so the last frame is the first. Every state is a function of the clock, and every periodic motion has a period that divides 60 s.
   motion-exception: the hook's establishing push (zoom 0.45 to 1.3 in 1.4 s) is the registry's establishing push (B27.8); the pans and pushes stay in the ranges. */
import type { StoryT } from "../../src/schema.ts";
import { cam2At, isoAt, toScreen, type Cam2, type Key2, type P2, type P3 } from "../../src/iso.ts";

/** The set's one scale: 1 world unit is 10 cm. U px per unit, O the screen px of the world origin (the bedroom floor at the foot of the outer wall). */
export const U = 60;
export const O: P2 = [540, 2200];
export const world = (p: P3): P2 => isoAt(p, U, O);

/** Where things stand (world units, x to the lower right, y to the lower left, z up). The bedroom floor is z = 0, the yard is z = YARD_Z (the house stands on a plinth). */
export const XC = 10;                 // the plane where the house is cut open: the bedroom is x < XC, the garden x > XC
export const WB = -1;                 // the inner face of the outer wall (the plane y = WB); the wall is 15 cm thick, y from WB - 1.5 to WB
export const WALL_T = 1.5;
export const FRONT_Y = 13;            // the front edge of the diorama (the cut towards the viewer)
export const YARD_Z = -3;
/** The indoor unit (the hero): 80 cm wide, 22 cm deep, 30 cm high, its top 2.35 m above the floor (a real split unit's size). */
export const UNIT = { x0: XC - 8.5, x1: XC - 0.5, y0: WB, y1: WB + 2.2, z0: 20.5, z1: 23.5 } as const;
/** Inside the unit: the evaporator coil (fins), the cross-flow fan behind it and the drain pan under the coil. */
export const COIL = { x0: UNIT.x0 + 0.35, x1: UNIT.x1 - 0.35, y0: WB + 1.15, y1: WB + 1.75, z0: 21.35, z1: 23.15 } as const;
export const PAN = { x0: UNIT.x0 + 0.25, x1: UNIT.x1 - 0.25, y0: WB + 1.0, y1: WB + 2.0, z0: 20.6, z1: 20.95 } as const;
/** The drain hose: from the pan's outlet, through the wall where it is cut, down the outside of the wall to just above the drain. */
export const HOSE: readonly P3[] = [
  [UNIT.x1 - 0.3, WB + 1.5, 20.75], [XC - 0.15, WB + 1.1, 20.4], [XC + 0.05, WB + 0.2, 20.0], [XC + 0.1, WB - WALL_T * 0.5, 19.8],
  [XC + 0.25, WB - WALL_T - 0.4, 19.4], [XC + 0.6, WB - WALL_T - 0.9, 18.2], [XC + 0.65, WB - WALL_T - 0.95, 10], [XC + 0.65, WB - WALL_T - 0.95, 2.0], [XC + 0.8, WB - WALL_T - 1.1, YARD_Z + 1.4],
];
export const HOSE_END: P3 = HOSE[HOSE.length - 1];
export const DRAIN = { x: HOSE_END[0], y: HOSE_END[1], z: YARD_Z } as const;
/** The outdoor unit: 80 cm wide, 30 cm deep, 55 cm high, on feet in the yard; the refrigerant pipes run to it along the outside of the wall. */
export const OUT = { x0: XC + 3, x1: XC + 11, y0: WB - WALL_T - 5.5, y1: WB - WALL_T - 2.5, z0: YARD_Z + 0.4, z1: YARD_Z + 5.9 } as const;
export const PLANT = { x: XC - 17, y: WB + 3.2 } as const;
export const FENCE_Y = WB - 13;
export const NEIGHBOUR_Y = WB - 26;

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

// the camera: the world px point at the middle of the screen, and a zoom. The beats start at 0, 3, 4, 11, 19, 27, 35, 42, 49, 56.
const K = (t: number, x: number, y: number, zoom: number): Key2 => ({ t, x, y, zoom });
export const WIDE = { x: 1000, y: 1830, zoom: 0.45 } as const;
export const CAM_KEYS: Key2[] = [
  K(0, WIDE.x, WIDE.y, WIDE.zoom), K(1.5, WIDE.x, WIDE.y, WIDE.zoom),  // the wide shot: the bedroom with the AC high on its wall, the garden, the hose over the drain
  K(2.9, 820, 1110, 1.3),                                            // the establishing push: the indoor unit (about 66 % of the width)
  K(4, 818, 1104, 1.31),                                             // sting: the world keeps moving
  K(10.8, 812, 1040, 1.4),                                           // udara: a slow push up to the intake on the unit's top
  K(18.8, 800, 1075, 1.75),                                          // dingin: a push into the opened unit, the coil
  K(26.6, 830, 1130, 2.05),                                          // embun: closer, the fins and the pan under them
  K(27.4, 830, 1130, 2.05),
  K(29.8, 1180, 1990, 0.72),                                          // selang: a pan along the hose to the outside
  K(34.8, 1190, 1990, 0.75),
  K(37.0, 1000, 1760, 0.62),                                         // hasil: back out to the house and the garden
  K(41.8, 1000, 1750, 0.66),
  K(43.8, 740, 1700, 0.62),                                          // bocor: a pan to the unit and the bedroom floor under it
  K(48.8, 740, 1690, 0.66),
  K(50.6, 880, 1730, 0.6),                                           // tips: a little to the right, the unit, the hose and the drain
  K(55.8, 880, 1720, 0.63),
  K(59.4, WIDE.x, WIDE.y, WIDE.zoom),                                // outro: back to the hook's wide shot (the last frame is the first)
  K(60, WIDE.x, WIDE.y, WIDE.zoom),
];
export const camAt = (t: number): Cam2 => cam2At(CAM_KEYS, t);

export const startsOf = (story: StoryT): Record<string, number> => {
  const out: Record<string, number> = {};
  let a = 0;
  for (const b of story.beats) { out[b.id] = a; a += b.dur; }
  return out;
};

/** The period of one drop from the hose (60 / 50 = 1.2 s: the loop stays whole). */
export const DRIP_PERIOD = 1.2;

/** The states of the set at a time (all functions of the video's clock). */
export function stateAt(t: number) {
  // the front cover of the unit: shut, open to show the coil (dingin, embun, selang), shut, open again for the clogged pan (bocor), shut before the loop-back
  const open = keyed(t, [[0, 0], [11.4, 0], [12.4, 1], [35.4, 1], [36.4, 0], [43.6, 0], [44.6, 1], [53.6, 1], [54.6, 0], [60, 0]]);
  // the warm room air drawn into the top grille, and the vapour it carries (shown from udara on, faint in the hook so the loop matches)
  const air = keyed(t, [[0, 0.35], [4.2, 0.35], [5.0, 1], [34, 1], [36, 0.35], [60, 0.35]]);
  const vapour = keyed(t, [[0, 0], [5.6, 0], [6.6, 1], [26, 1], [28, 0], [60, 0]]);
  const cold = keyed(t, [[0, 0.4], [12.6, 0.4], [13.6, 1], [26, 1], [28, 0.4], [60, 0.4]]);      // the cold air out of the louver, the coil's frost tint
  const dew = keyed(t, [[0, 0], [19.6, 0], [21.2, 1], [41, 1], [42, 0.7], [53, 0.7], [55, 0], [60, 0]]);   // drops on the fins
  const pan = keyed(t, [[0, 0.25], [20.5, 0.25], [22.5, 0.45], [44, 0.45], [46, 1], [50.6, 1], [52, 0.25], [60, 0.25]]); // the water level in the pan
  const clog = keyed(t, [[0, 0], [43.4, 0], [44.4, 1], [50.2, 1], [51.2, 0], [60, 0]]);          // the dirt in the pan's outlet
  const leak = keyed(t, [[0, 0], [45.4, 0], [46.2, 1], [50.6, 1], [51.4, 0], [60, 0]]);          // drops falling inside the bedroom
  const puddle = keyed(t, [[0, 0], [45.8, 0], [49, 1], [51.5, 1], [54, 0], [60, 0]]);            // the puddle on the bedroom floor
  const flow = keyed(t, [[0, 1], [44.2, 1], [45.2, 0], [51.2, 0], [52.2, 1], [60, 1]]);          // the drip from the hose outside (stops while the outlet is clogged)
  const louver = 0.95 + 0.12 * Math.sin((2 * Math.PI * t) / 6);                                   // the flap swings slowly (period 6 s)
  return { open, air, vapour, cold, dew, pan, clog, leak, puddle, flow, louver };
}

/** The kicker of the top text per beat (the headline is the beat's own text). */
const KICKER: Record<string, string> = { hook: "AC NETES", normal: "DI DALAM AC", result: "HASILNYA", tips: "TIPS" };
const KICKER_BY_ID: Record<string, string> = { udara: "UDARA KAMAR", dingin: "DI DALAM AC", embun: "TITIK EMBUN", selang: "SELANG BUANG", bocor: "KALAU BOCOR" };

export function makePlan(story: StoryT) {
  const starts = story.beats.map((_, i) => story.beats.slice(0, i).reduce((a, b) => a + b.dur, 0));
  const total = story.beats.reduce((a, b) => a + b.dur, 0);
  const sting = starts[1] ?? 0;                                   // must 1: the "Intip yuk!" sting is the second beat
  const outro = starts.at(-1) ?? total;                           // must 2: the loop-back outro is the last beat
  const at = (id: string) => starts[story.beats.findIndex((b) => b.id === id)] ?? 0;
  const m = {
    sting, stingEnd: sting + (story.beats[1]?.dur ?? 1), outro, end: total,
    air: at("udara") + 1.0, vapour: at("udara") + 2.6, open: at("dingin") + 0.4, coil: at("dingin") + 1.6, coldOut: at("dingin") + 2.6,
    dew: at("embun") + 0.6, fall: at("embun") + 2.6, pan: at("selang") + 0.3, pan2: at("selang") + 0.6, out: at("selang") + 3.2,
    verdict: at("hasil") + 1.4, clog: at("bocor") + 1.4, leak: at("bocor") + 3.4, tip1: at("tips") + 0.6, clean: at("tips") + 1.2, tip2: at("tips") + 3.6,
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

/** The hero's box at time t, in the 1080 px frame (x, y, w, h): the indoor unit. */
export const HERO_BOX_AT = (t: number) => {
  const c = camAt(t);
  const pts = ([[UNIT.x0, UNIT.y1, UNIT.z0], [UNIT.x1, UNIT.y0, UNIT.z1], [UNIT.x1, UNIT.y1, UNIT.z0], [UNIT.x0, UNIT.y0, UNIT.z1], [UNIT.x1, UNIT.y1, UNIT.z1]] as P3[]).map((p) => toScreen(c, world(p)));
  const l = Math.min(...pts.map((p) => p[0])), r = Math.max(...pts.map((p) => p[0])), tp = Math.min(...pts.map((p) => p[1])), bt = Math.max(...pts.map((p) => p[1]));
  return { x: (l + r) / 2, y: (tp + bt) / 2, w: r - l, h: bt - tp };
};
