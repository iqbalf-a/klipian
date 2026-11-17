/* Kenapa jari keriput kalau lama di air? — the timing of this video (pure: no React here). Look 2d (B28): a flat side view of a fingertip cut open (skin, the layer under it,
   vessels, a nerve, the bone), pointing down into a wash basin; a wet slab and a balance stand on the counter beside it. The formula is DESIGN.md section 0b: the hook, the
   "Intip yuk!" sting right after it, the explain beats, the result and the loop-back outro. One world in px; the camera is a function of the video's clock (camAt): the wide
   shot, the establishing push, then a push or a pan inside the same flat set per beat, and the way back to the wide shot in the outro, so the last frame is the first.
   motion-exception: the hook's establishing push (zoom 0.55 to 1.15 in 1.4 s) is the registry's establishing push (B27.8); the pans between the places of the set (finger, tip,
   counter) last 1.3 to 2.5 s. Every number below is read by index.tsx and sfx.ts so the picture and the sound agree. */
import type { StoryT } from "../../src/schema.ts";

/** The world (px, y down). The finger points down: its axis is x = FX, its back (the nail side) is on the left, its pad on the right. */
export const FX = 420;
export const HW = 260;                       // half the finger's width (the fingertip is about 1.5 cm wide: the finger is the hero, the set is sized to it)
export const TOP = -1000;                    // the finger bleeds past the top of every shot
export const TIP_Y = 1560;                   // the lowest point of the pad
export const WATER_Y = 1100;                 // the water surface of the basin, level with the counter top
export const COUNTER_X = 740;                // the basin's wall: the water is on the left, the counter on the right
export const PAD_X = FX + HW;                // the pad's skin at rest (the wet slab touches it here)

/** Beat starts (seconds): hook 0, sting 3, dulu 4, saraf 11, darah 20, guna 29, ujung 38, debat 46, outro 56. These names are the moments inside. */
export const T = {
  push: 1.5, pushEnd: 2.9,
  drop1: 4.8, drop2: 6.2, drop3: 7.6, drop4: 9.0, swellA: 7.6, swellB: 9.2, swellOff: 10.8,
  nerveOn: 11.6, signalA: 12.4, signalEnd: 19.6, nerveOff: 28.6, lblNerve: 12.8, lblSignal: 16.2, pulse: 18.5,
  vesselOn: 20.4, vesselA: 21.2, vesselEnd: 27.0, vesselOff: 28.8, lblVessel: 22.0, lblSkin: 25.0,
  wrinkleUp: 22.5, wrinkleTop: 28.0, wrinkleDown: 56.2, wrinkleOff: 59.6,
  insetOn: 23.2, insetOff: 28.8,
  barIn: 29.3, touch: 31.2, drainA: 31.6, drainEnd: 36.6, barOut: 37.4, lblTread: 30.6, lblDrain: 34.2,
  tipPan: 38.3, lblKeratin: 39.8, hairOn: 42.6, lblHair: 42.8, hairOff: 56.0,
  scaleIn: 48.2, lblStudy14: 47.4, lblStudy21: 51.4, scaleOut: 56.0,
} as const;

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
/** cubic in-out easing, the same curve as src/motion.ts easeInOut (kept here so the plan stays plain Node). */
export const ease = (x: number) => { const k = clamp01(x); return k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2; };
/** 0 before a, 1 after b, eased in between. */
export const ramp = (t: number, a: number, b: number) => ease((t - a) / (b - a));
/** 1 between a and b, easing in and out over f seconds. */
export const win = (t: number, a: number, b: number, f = 0.4) => clamp01((t - a) / f) * (1 - clamp01((t - b) / f));

/** How wrinkled the fingertip is, 0..1: it builds up while the beats explain, holds, and eases away in the outro so the loop-back matches. */
export const wrinkle = (t: number) => ramp(t, T.wrinkleUp, T.wrinkleTop) * (1 - ramp(t, T.wrinkleDown, T.wrinkleOff));
/** How far the vessels under the skin have narrowed, 0..1 (a little before the skin shows it). */
export const narrow = (t: number) => ramp(t, T.vesselA, T.vesselEnd) * (1 - ramp(t, T.wrinkleDown, T.wrinkleOff));
/** The old idea: the skin soaks up water and swells. It swells a little in the dulu beat, then the picture drops the idea. */
export const swell = (t: number) => ramp(t, T.swellA, T.swellB) * (1 - ramp(t, T.swellB + 0.6, T.swellOff));
/** How much of the water between the pad and the wet slab has been pushed out along the grooves, 0..1. */
export const drained = (t: number) => ramp(t, T.drainA, T.drainEnd);
/** The wet slab's left edge (world x): it slides along the counter to the pad, stays, and slides back. */
export const SLAB_REST = 1500, SLAB_TOUCH = PAD_X + 14;
export const slabX = (t: number) => SLAB_REST + (SLAB_TOUCH - SLAB_REST) * ramp(t, T.barIn, T.touch) * (1 - ramp(t, T.barOut, T.barOut + 1.2));
/** The balance's tilt in degrees: it swings and settles level (the scientists do not agree). */
export const scaleTilt = (t: number) => (t < T.scaleIn ? 0 : 9 * Math.exp(-(t - T.scaleIn - 0.6) * 0.5) * Math.cos((t - T.scaleIn) * 2.2) * ramp(t, T.scaleIn, T.scaleIn + 0.8));

/** Camera keys: the world point at the centre of the frame and the zoom. Between two keys the camera eases; equal keys hold. */
export type Cam = { x: number; y: number; z: number };
export const CAM_KEYS: { t: number; c: Cam }[] = [
  { t: 0, c: { x: 560, y: 1000, z: 0.55 } },
  { t: 1.5, c: { x: 560, y: 1000, z: 0.55 } },        // the wide shot: the finger, the basin, the counter
  { t: 2.9, c: { x: 440, y: 1250, z: 1.15 } },        // the establishing push: the fingertip dipped in the water
  { t: 4, c: { x: 440, y: 1240, z: 1.17 } },          // sting: the world keeps moving
  { t: 11, c: { x: 520, y: 880, z: 1.12 } },          // dulu: a slow push to the pad where the drops land
  { t: 13.2, c: { x: 440, y: 950, z: 0.85 } },        // saraf: out to the whole fingertip and the nerve in it
  { t: 19.6, c: { x: 440, y: 1050, z: 1.0 } },
  { t: 22.0, c: { x: 700, y: 820, z: 1.0 } },         // darah: to the pad's vessels and the skin over them
  { t: 28.6, c: { x: 700, y: 840, z: 1.06 } },
  { t: 31.0, c: { x: 800, y: 900, z: 1.1 } },         // guna: to the pad and the wet slab
  { t: 37.6, c: { x: 800, y: 910, z: 1.14 } },
  { t: 39.6, c: { x: 420, y: 1355, z: 1.35 } },       // ujung: close on the tip, then up to the back of the finger
  { t: 42.0, c: { x: 420, y: 1355, z: 1.36 } },
  { t: 43.8, c: { x: 380, y: 900, z: 1.3 } },
  { t: 45.8, c: { x: 380, y: 900, z: 1.3 } },
  { t: 48.0, c: { x: 880, y: 900, z: 0.86 } },        // debat: out to the finger and the balance
  { t: 56.0, c: { x: 880, y: 900, z: 0.88 } },
  { t: 60, c: { x: 560, y: 1000, z: 0.55 } },         // outro: back to the hook's wide shot
];
const lerp = (a: number, b: number, u: number) => a + (b - a) * u;
export function camAt(t: number): Cam {
  const k = CAM_KEYS;
  if (t <= k[0].t) return k[0].c;
  for (let i = 1; i < k.length; i++) {
    if (t <= k[i].t) {
      const a = k[i - 1], b = k[i], u = b.t === a.t ? 1 : ease((t - a.t) / (b.t - a.t));
      return { x: lerp(a.c.x, b.c.x, u), y: lerp(a.c.y, b.c.y, u), z: lerp(a.c.z, b.c.z, u) };
    }
  }
  return k[k.length - 1].c;
}

/** The labels: text (at most 6 words, `lines` under it), the world point they point at (ax, ay), where the text sits on the screen (lx, ly), the second they come in and leave. */
export type LabelSpec = { id: string; text: string; lines?: string[]; ax: number; ay: number; lx: number; ly: number; from: number; to: number };
export const LABELS: LabelSpec[] = [
  { id: "air", text: "air", ax: 880, ay: 700, lx: 800, ly: 520, from: 5.2, to: 10.6 },
  { id: "ujung", text: "mengembang?", ax: PAD_X + 12, ay: 940, lx: 800, ly: 650, from: 8.2, to: 10.8 },
  { id: "saraf", text: "saraf", ax: FX + 98, ay: 480, lx: 850, ly: 520, from: T.lblNerve, to: 19.6 },
  { id: "sinyal", text: "kirim sinyal", ax: FX + 98, ay: 1000, lx: 850, ly: 650, from: T.lblSignal, to: 19.8 },
  { id: "pembuluh", text: "pembuluh menyempit", ax: PAD_X - 66, ay: 660, lx: 290, ly: 470, from: T.lblVessel, to: 28.6 },
  { id: "kulit", text: "kulit mengendur", ax: PAD_X - 14, ay: 900, lx: 270, ly: 1090, from: T.lblSkin, to: 28.8 },
  { id: "alur", text: "alur ban", ax: PAD_X - 10, ay: 720, lx: 830, ly: 520, from: T.lblTread, to: 37.6 },
  { id: "tersingkir", text: "air tersingkir", ax: PAD_X + 7, ay: 960, lx: 830, ly: 650, from: T.lblDrain, to: 37.8 },
  { id: "keratin", text: "keratin tebal", ax: PAD_X - 20, ay: 1400, lx: 740, ly: 1180, from: T.lblKeratin, to: 43.2 },
  { id: "rambut", text: "tanpa rambut", ax: PAD_X - 5, ay: 800, lx: 770, ly: 650, from: T.lblHair, to: 45.8 },
  { id: "adarambut", text: "rambut + minyak", ax: FX - HW - 28, ay: 640, lx: 400, ly: 520, from: T.lblHair + 0.2, to: 45.8 },
  { id: "s14", text: "2014:", lines: ["tak ada", "bedanya"], ax: 930, ay: 960, lx: 580, ly: 600, from: T.lblStudy14, to: 55.6 },
  { id: "s21", text: "2021:", lines: ["genggam", "20% ringan"], ax: 1310, ay: 960, lx: 920, ly: 600, from: T.lblStudy21, to: 55.6 },
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

/** The hero's box at time t, in the 1080 px frame (x, y, w, h): the fingertip (its width, from the top of the shot to the pad's lowest point) seen through the camera. */
export const HERO_BOX_AT = (t: number) => {
  const c = camAt(t), z = c.z;
  const x0 = 540 + (FX - HW - c.x) * z, x1 = 540 + (PAD_X + 14 - c.x) * z, y1 = 960 + (TIP_Y - c.y) * z;
  const y0 = Math.max(0, 960 + (TOP - c.y) * z);
  return { x: (x0 + x1) / 2, y: (y0 + y1) / 2, w: x1 - x0, h: y1 - y0 };
};
