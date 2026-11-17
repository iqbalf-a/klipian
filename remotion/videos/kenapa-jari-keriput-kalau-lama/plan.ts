/* Kenapa jari keriput kalau lama di air? — the timing of this video (pure: no React here). Look 2d (B28): a flat side view of a hand that hangs from the right into a wash basin,
   index finger in front and two fingers behind it, the fingertips in the water. The outside of the hand is drawn first (two tones, nail, creases); a cut opens on the index
   fingertip when the beats go inside (the cutaway: skin, layer under it, vessels, nerve, bone). Wrinkles only on the wet pad, strongest at the tip. In the grip beat the hand is lifted out
   of the water and a wet slab on the counter slides to the pad. The formula is DESIGN.md section 0b: the hook, the "Intip yuk!" sting right after it, the explain beats, the result
   and the loop-back outro. One world in px; the camera is a function of the video's clock (camAt), and the way back to the wide shot in the outro makes the last frame the first.
   motion-exception: the hook's establishing push (zoom 0.72 to 0.95 in 1.4 s) is the registry's establishing push (B27.8); the pans between places of the set last 1.3 to 2.5 s. */
import type { StoryT } from "../../src/schema.ts";

/** The world (px, y down). The finger points down: its axis is x = FX, its back (the nail side) is on the left, its pad on the right. */
export const FX = 420;
export const HW = 260;                       // half the finger's width (the fingertip is about 1.5 cm wide: the finger is the hero, the set is sized to it)
export const TOP = 300;                      // the side view of the index finger comes straight down from the top: it starts behind the plain board over the top of the frame
export const TIP_Y = 1560;                   // the lowest point of the pad
export const WATER_Y = 1200;                 // the water surface of the basin, level with the counter top
export const COUNTER_X = 740;                // the basin's wall: the water is on the left, the counter on the right
export const PAD_X = FX + HW - 26;           // the pad's skin at rest (the wet slab touches it here): the finger tapers 26 px each side towards the tip

/** Beat starts (seconds): hook 0, sting 3, dulu 4, saraf 11, darah 20, guna 29, ujung 38, debat 46, outro 56. These names are the moments inside. */
export const T = {
  push: 1.5, pushEnd: 2.9,
  drop1: 4.8, drop2: 6.2, drop3: 7.6, drop4: 9.0, swellA: 7.6, swellB: 9.2, swellOff: 10.8,
  nerveOn: 11.6, signalA: 12.4, signalEnd: 19.6, nerveOff: 28.6, lblNerve: 12.8, lblSignal: 16.2, pulse: 18.5,
  vesselOn: 20.4, vesselA: 21.2, vesselEnd: 27.0, vesselOff: 28.8, lblVessel: 22.0, lblSkin: 25.0,
  wrinkleUp: 22.5, wrinkleTop: 28.0, wrinkleDown: 56.2, wrinkleOff: 59.6,
  insetOn: 23.2, insetOff: 28.8,
  liftA: 29.0, liftB: 30.6, lowerA: 37.4, lowerB: 38.8, cutA: 11.2, cutB: 12.2,
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
export const SLAB_REST = 1500, SLAB_TOUCH = PAD_X + 2, SLAB_TOP = 900, LIFT_PX = 360;
/** How far the hand is lifted out of the water (px): in the grip beat the wet fingertip comes up to the slab, then goes back in. */
export const lift = (t: number) => LIFT_PX * ramp(t, T.liftA, T.liftB) * (1 - ramp(t, T.lowerA, T.lowerB));
/** 1 while the whole hand is in the picture (the hook, the old idea, the outro), 0 while the beats look inside the index fingertip: the hand fades away (the index finger stays) and the side view fades in. */
export const handVis = (t: number) => Math.min(1, Math.max(0, 1 - ramp(t, 10.4, 11.0) + ramp(t, 58.0, 58.6)));
/** 1 while the side view of the index fingertip with its band is in the picture (the beats that look inside), 0 while the whole hand is: the two never show together (a dissolve of two big shapes looks like a ghost). */
export const sideVis = (t: number) => Math.min(1, Math.max(0, ramp(t, 11.0, 11.6) - ramp(t, 57.4, 58.0)));
/** How far the cut on the index fingertip is open, 0..1 (the cutaway is a window into the finger, never the whole finger). */
export const cut = (t: number) => ramp(t, T.cutA, T.cutB) * (1 - ramp(t, T.wrinkleDown, T.wrinkleDown + 1.8));
export const slabX = (t: number) => SLAB_REST + (SLAB_TOUCH - SLAB_REST) * ramp(t, T.barIn, T.touch) * (1 - ramp(t, T.barOut, T.barOut + 1.2));
/** The balance's tilt in degrees: it swings and settles level (the scientists do not agree). */
export const scaleTilt = (t: number) => (t < T.scaleIn ? 0 : 9 * Math.exp(-(t - T.scaleIn - 0.6) * 0.5) * Math.cos((t - T.scaleIn) * 2.2) * ramp(t, T.scaleIn, T.scaleIn + 0.8));

/** Camera keys: the world point at the centre of the frame and the zoom. Between two keys the camera eases; equal keys hold. */
export type Cam = { x: number; y: number; z: number };
export const CAM_KEYS: { t: number; c: Cam }[] = [
  { t: 0, c: { x: 863, y: -741, z: 0.21 } },
  { t: 1.5, c: { x: 863, y: -741, z: 0.21 } },        // the wide shot: the whole hand from the back, the fingertips in the water
  { t: 2.9, c: { x: 520, y: 1050, z: 0.55 } },        // the establishing push: down to the fingers in the water
  { t: 4, c: { x: 500, y: 1000, z: 0.5 } },           // sting: the world keeps moving
  { t: 10.0, c: { x: 500, y: 1000, z: 0.5 } },        // dulu: the drops land on the finger, it swells a little
  { t: 11.6, c: { x: 520, y: 1140, z: 1.0 } },        // the hand fades to the index fingertip: the cut opens
  { t: 13.2, c: { x: 440, y: 1140, z: 1.0 } },        // saraf: the nerve in it
  { t: 19.6, c: { x: 440, y: 1150, z: 1.02 } },
  { t: 22.0, c: { x: 700, y: 1160, z: 1.0 } },        // darah: the pad's vessels and the skin over them
  { t: 28.6, c: { x: 700, y: 1170, z: 1.0 } },
  { t: 31.0, c: { x: 800, y: 880, z: 1.0 } },         // guna: the hand is lifted, the pad meets the wet slab
  { t: 37.6, c: { x: 800, y: 880, z: 1.0 } },
  { t: 39.6, c: { x: 420, y: 1250, z: 1.0 } },        // ujung: the tip, then the back of the finger
  { t: 42.0, c: { x: 420, y: 1250, z: 1.0 } },
  { t: 43.8, c: { x: 300, y: 1100, z: 1.0 } },
  { t: 45.8, c: { x: 300, y: 1100, z: 1.0 } },
  { t: 48.0, c: { x: 880, y: 1300, z: 0.9 } },        // debat: out to the balance
  { t: 56.0, c: { x: 880, y: 1300, z: 0.9 } },
  { t: 60, c: { x: 863, y: -741, z: 0.21 } },         // outro: the hand fades back in and the camera is back at the hook's wide shot
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

/** The labels sit on plain background (wall or the counter's face), never over a drawn part: text (`lines` under it), the world point they point at (ax, ay), where the text is centred on
    the screen (lx, ly), the font size, the second they come in and leave. The leader runs from the text to the part. */
export type LabelSpec = { id: string; text: string; lines?: string[]; ax: number; ay: number; lx: number; ly: number; fs?: number; from: number; to: number };
export const LABELS: LabelSpec[] = [
  { id: "air", text: "air", ax: 735, ay: 1210, lx: 700, ly: 1400, from: 5.2, to: 10.4 },
  { id: "ujung", text: "mengembang?", ax: FX - HW, ay: 950, lx: 300, ly: 1470, from: 8.2, to: 10.4 },
  { id: "saraf", text: "saraf", ax: FX + 98, ay: 1100, lx: 880, ly: 770, from: T.lblNerve, to: 19.6 },
  { id: "sinyal", text: "kirim sinyal", ax: FX + 98, ay: 1300, lx: 930, ly: 880, from: T.lblSignal, to: 19.8 },
  { id: "pembuluh", text: "pembuluh menyempit", ax: PAD_X - 66, ay: 1250, lx: 810, ly: 1090, fs: 40, from: T.lblVessel, to: 28.6 },
  { id: "kulit", text: "kulit mengendur", ax: PAD_X - 14, ay: 1330, lx: 810, ly: 1200, fs: 40, from: T.lblSkin, to: 28.8 },
  { id: "alur", text: "alur ban", ax: PAD_X - 4, ay: 940, lx: 840, ly: 700, from: T.lblTread, to: 37.6 },
  { id: "tersingkir", text: "air tersingkir", ax: SLAB_TOUCH - 7, ay: 960, lx: 860, ly: 830, from: T.lblDrain, to: 37.8 },
  { id: "keratin", text: "keratin tebal", ax: PAD_X - 4, ay: 1480, lx: 945, ly: 700, fs: 38, from: T.lblKeratin, to: 43.2 },
  { id: "rambut", text: "tanpa", lines: ["rambut"], ax: PAD_X - 4, ay: 1060, lx: 1010, ly: 790, fs: 36, from: T.lblHair, to: 45.8 },
  { id: "adarambut", text: "rambut", lines: ["+ minyak"], ax: FX - HW + 8, ay: 940, lx: 100, ly: 880, fs: 36, from: T.lblHair + 0.2, to: 45.8 },
  { id: "s14", text: "2014:", lines: ["tak ada bedanya"], ax: 930, ay: 1110, lx: 585, ly: 625, fs: 40, from: T.lblStudy14, to: 55.6 },
  { id: "s21", text: "2021:", lines: ["genggam", "20% ringan"], ax: 1310, ay: 1110, lx: 927, ly: 610, fs: 40, from: T.lblStudy21, to: 55.6 },
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

/** The hero's box at time t, in the 1080 px frame (x, y, w, h): the whole hand while it is in the picture, the index fingertip with the hand's lower edge while the beats look inside it. */
export const HERO_BOX_AT = (t: number) => {
  const c = camAt(t), z = c.z, L = lift(t);
  if (handVis(t) > 0.5) {
    const x0 = 540 + (-860 - c.x) * z, x1 = 540 + (2600 - c.x) * z, y0 = 960 + (-1400 - c.y) * z, y1 = 960 + (1640 - c.y) * z;
    return { x: (x0 + x1) / 2, y: (y0 + y1) / 2, w: x1 - x0, h: y1 - y0 };
  }
  const x0 = 540 + (FX - HW - c.x) * z, x1 = 540 + (FX + HW - c.x) * z, y1 = 960 + (TIP_Y - L - c.y) * z;
  const y0 = Math.max(420, 960 + (TOP - L - c.y) * z);
  return { x: (x0 + x1) / 2, y: (y0 + y1) / 2, w: x1 - x0, h: y1 - y0 };
};
