/* Kenapa jari keriput kalau lama di air? — the timing of this video (pure: no React here). The formula is DESIGN.md section 0b: the hook, the "Intip yuk!" sting right after it,
   the explain beats, the result and the loop-back outro. One set (B27.15, kind "inside-body"): a cut-away slab of soft tissue with a finger lying on it (a cylinder with a
   rounded tip), a thin slice of the same finger standing beside it to show what is under the skin, a pool of water around the finger, a nerve and a heart.
   The camera is a function of the video's clock (camAt): the wide shot of the set, the establishing push, then a push or a pan inside the same set per beat, and the way back
   to the wide shot in the outro, so the last frame is the first.
   motion-exception: the hook's establishing push (zoom 0.5 to 0.8 in 1.4 s) is the registry's establishing push (B27.8); the pans and pushes stay in the ranges. */
import type { StoryT } from "../../src/schema.ts";
import { cam2At, isoAt, type Cam2, type Key2, type P2, type P3 } from "../../src/iso.ts";

/** The world: iso units, one unit is U px; O is the screen point of the world origin at rest. */
export const U = 80;
export const O: P2 = [500, 1090];
export const R = 2.2;                       // the finger's radius (a fingertip is about 1.5 cm wide: the finger is the hero, everything else is sized to it)
export const FX = 1.5;                      // the finger's axis: x = FX, z = R, along y
export const SX = -4.6;                     // the slice's axis
export const SLICE_Y: [number, number] = [0.4, 1.2];
export const BODY_Y: [number, number] = [-5.5, 1.5];
export const TIP_L = 2.0;                   // the rounded tip, from y = 1.5
export const P = (p: P3): P2 => isoAt(p, U, O);

/** Beat starts (seconds): hook 0, sting 3, dulu 4, saraf 11, darah 20, guna 29, ujung 38, debat 46, outro 56. Read from the story in makePlan; these names are the moments inside. */
export const T = {
  push: 1.5, pushEnd: 2.9,
  drop1: 4.8, drop2: 6.2, drop3: 7.6, drop4: 9.0, swell: 8.2,
  nerveOn: 12.0, nerveEnd: 26.5, sliceIn: 11.4, lblNerve: 12.8, lblSignal: 16.2, pulse: 18.5,
  vesselOn: 20.8, vesselEnd: 27.0, lblVessel: 22.0, lblSkin: 25.0, heartOn: 21.0,
  wrinkleUp: 22.5, wrinkleTop: 28.0, wrinkleDown: 56.2, wrinkleOff: 59.6,
  gripOn: 29.8, drain: 31.0, lblTread: 30.8, lblDrain: 34.2, bar: 29.6,
  tipPan: 38.3, lblKeratin: 39.8, lblHair: 42.8, hairOn: 42.6,
  lblStudy14: 47.4, lblStudy21: 51.4, scale: 48.5,
} as const;

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
/** cubic in-out easing, the same curve as src/motion.ts easeInOut (kept here so the plan stays plain Node). */
export const ease = (x: number) => { const k = clamp01(x); return k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2; };

/** How wrinkled the finger is, 0..1: it builds up while the beats explain, holds, and eases away in the outro so the loop-back matches. */
export const wrinkle = (t: number) => ease((t - T.wrinkleUp) / (T.wrinkleTop - T.wrinkleUp)) * (1 - ease((t - T.wrinkleDown) / (T.wrinkleOff - T.wrinkleDown)));
/** How far the vessels under the skin have narrowed, 0..1 (a little before the skin shows it). */
export const narrow = (t: number) => ease((t - T.vesselOn) / (T.vesselEnd - T.vesselOn)) * (1 - ease((t - T.wrinkleDown) / (T.wrinkleOff - T.wrinkleDown)));

// the focus points of the camera, from the world
const FIN_MID = P([FX, -1, R]);
const SLICE_MID = P([SX, 0.8, R]);
const TIP = P([FX, 3, R]);
const PAIR = P([-1.6, 0.6, R]);               // the slice, the heart and the near end of the finger together
const BIG = (p: P2, dx = 0, dy = 0): P2 => [p[0] + dx, p[1] + dy];

const K = (t: number, f: P2, zoom: number): Key2 => ({ t, x: f[0], y: f[1], zoom });
const KEYS: Key2[] = [
  K(0, BIG(FIN_MID, 0, 40), 0.5),
  K(1.5, BIG(FIN_MID, 0, 40), 0.5),                // the wide shot of the set, 1.5 s
  K(2.9, FIN_MID, 0.8),                            // the establishing push: the finger is about 70 % of the width
  K(4, FIN_MID, 0.82),                             // sting: the world keeps moving
  K(11, BIG(FIN_MID, 120, 30), 1.1),              // dulu: a slow push over the finger as the drops land
  K(13.5, BIG(SLICE_MID, 60, -10), 1.14),          // saraf: pan to the slice
  K(20, BIG(SLICE_MID, 40, -10), 1.3),
  K(22.5, BIG(PAIR, -120, 20), 1.0),               // darah: out to see the slice, the heart and the finger together
  K(29, BIG(PAIR, -30, 10), 1.14),
  K(31.5, BIG(TIP, -40, -40), 1.3),                // guna: pan to the fingertip and the wet bar
  K(38, BIG(TIP, -30, -50), 1.42),
  K(40, BIG(TIP, 0, -70), 1.52),                   // ujung: close on the tip
  K(46, BIG(TIP, 10, -80), 1.6),
  K(48.5, BIG(FIN_MID, 80, 30), 0.82),             // debat: out to the whole finger and the scale
  K(56, BIG(FIN_MID, 80, 30), 0.86),
  K(60, BIG(FIN_MID, 0, 40), 0.5),                 // outro: back to the hook's wide shot
];
export const camAt = (t: number): Cam2 => cam2At(KEYS, t);

/** The labels: text (at most 6 words), the world point they point at, the second of the video they come in, how long they stay, and where the text sits on the screen. */
export type LabelSpec = { id: string; text: string; at: P3; from: number; to: number; lx: number; ly: number };
export const LABELS: LabelSpec[] = [
  { id: "air", text: "air", at: [3.6, -3.5, 1.2], from: 5.2, to: 10.6, lx: 760, ly: 520 },
  { id: "ujung", text: "mengembang?", at: [FX + 1.2, 0.2, R + 1.8], from: 8.2, to: 10.8, lx: 330, ly: 640 },
  { id: "saraf", text: "saraf", at: [SX, -5, 0.2], from: T.lblNerve, to: 19.6, lx: 300, ly: 520 },
  { id: "sinyal", text: "kirim sinyal", at: [SX, -1.2, 0.2], from: T.lblSignal, to: 19.8, lx: 770, ly: 650 },
  { id: "pembuluh", text: "pembuluh menyempit", at: [SX + 0.55 * R * 0.7, 1.2, R + 0.55 * R * 0.7], from: T.lblVessel, to: 28.6, lx: 600, ly: 520 },
  { id: "kulit", text: "kulit mengendur", at: [FX + 0.4, -3.5, R * 2], from: T.lblSkin, to: 28.8, lx: 330, ly: 650 },
  { id: "alur", text: "alur ban", at: [FX, -1, R * 2], from: T.lblTread, to: 37.6, lx: 750, ly: 520 },
  { id: "tersingkir", text: "air tersingkir", at: [FX + R, 1.4, R + 0.3], from: T.lblDrain, to: 37.8, lx: 330, ly: 650 },
  { id: "keratin", text: "keratin tebal", at: [FX, 2.2, R * 1.9], from: T.lblKeratin, to: 45.6, lx: 760, ly: 520 },
  { id: "rambut", text: "tanpa rambut", at: [FX - R * 0.6, 2.6, R * 1.7], from: T.lblHair, to: 45.8, lx: 330, ly: 650 },
  { id: "s14", text: "2014: tak ada bedanya", at: [FX + 1.1, 4.3, 0.5], from: T.lblStudy14, to: 55.6, lx: 330, ly: 520 },
  { id: "s21", text: "2021: genggam 20% ringan", at: [FX - 1.2, 4.3, 0.5], from: T.lblStudy21, to: 55.6, lx: 760, ly: 650 },
];
/** The kicker of each beat's top text (the headline is the beat's own text). */
export const KICKERS: Record<string, string> = { hook: "intip", dulu: "dulu", saraf: "1935", darah: "di bawah kulit", guna: "manfaat?", ujung: "ujung jari", debat: "belum sepakat" };

export function makePlan(story: StoryT) {
  const starts = story.beats.map((_, i) => story.beats.slice(0, i).reduce((a, b) => a + b.dur, 0));
  const total = story.beats.reduce((a, b) => a + b.dur, 0);
  const sting = starts[1] ?? 0;                                   // must 1: the "Intip yuk!" sting is the second beat
  const outro = starts.at(-1) ?? total;                           // must 2: the loop-back outro is the last beat
  const m = { sting, stingEnd: sting + (story.beats[1]?.dur ?? 1), react: NaN, outro, end: total };
  return {
    m, total,
    // 0 at the start, 1 in the loop-back: the scene is the first beat's again at the end (the loop)
    loopWeight: (t: number) => Math.min(1, Math.max(0, (t - outro) / 0.5)),
    tops: story.beats.map((b, i) => ({ a: starts[i], b: starts[i] + b.dur, kicker: KICKERS[b.id], headline: b.text })).filter((x, i) => story.beats[i].kind !== "sting" && story.beats[i].kind !== "outro"),
    labels: LABELS,
  };
}

/** The hero's box at time t, in the 1080 px frame (x, y, w, h): the finger (its body and its tip) seen through the camera. */
export const HERO_BOX_AT = (t: number) => {
  const c = camAt(t), z = c.zoom;
  const pts = [P([FX + R, BODY_Y[0], 0]), P([FX - R, BODY_Y[1] + TIP_L, 0]), P([FX, BODY_Y[0], R * 2]), P([FX, BODY_Y[1] + TIP_L, 0])];
  const xs = pts.map((q) => 540 + (q[0] - c.x) * z), ys = pts.map((q) => 960 + (q[1] - c.y) * z);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  return { x: (x0 + x1) / 2, y: (y0 + y1) / 2, w: x1 - x0, h: y1 - y0 };
};
