/* Charger nyolok tanpa HP, listriknya tetap jalan? — the timing and the camera of this video (pure: no React). Look iso (B28): a power strip on a desk against a
   wall, a charger plugged into it with nothing on its cable. B44 (the feed look): frame 0 is the thumbnail: a huge text, ONE big charger (no face: objects never get one) on a plain
   yellow background; the set (wall, desk, dressing) fades in as the camera pulls back after the hook and fades out again in the outro, so the last frame is frame 0.
   Every number here is read by index.tsx and sfx.ts so the picture and the sound agree.
   motion-exception: the pull-back from the big charger to the strip (3.0 s to 5.2 s) and the push to the lens (9.2 s) last 2.2 s and 0.9 s as the registry's pans do;
   the hook has no establishing push (B41/B44: frame 0 is already the hook). */
import type { StoryT } from "../../src/schema.ts";
import { cam2At, isoAt, type Key2 } from "../../src/iso.ts";

export const U = 110;                                   // px per world unit of the desk world
export const O: [number, number] = [473, 1050];         // the screen px of the world origin: the charger's body is centred on (540, 1050)
export const P3 = (x: number, y: number, z: number): [number, number] => isoAt([x, y, z], U, O) as [number, number];

/** The charger (world units): a rounded slab standing on the strip, its face (USB port, lamp) looks to the lower left (+y). */
export const CH = { x0: 1.0, x1: 2.3, y0: 0.5, y1: 1.4, z0: 0.45, z1: 2.1 } as const;
export const STRIP = { x0: 0, x1: 4.4, y0: 0.5, y1: 1.4, z1: 0.45, sockets: [0.55, 1.65, 2.75, 3.85] } as const;
export const GHOST = { x0: 3.0, x1: 3.75, y0: 2.2, y1: 3.7 } as const;   // where the phone is not (a dashed outline on the desk)

export const CAM_KEYS: Key2[] = [
  { t: 0, x: 540, y: 966, zoom: 3.7 },        // hook: the charger fills about 72 % of the width (B44), frame 0 is the thumbnail
  { t: 3.0, x: 540, y: 966, zoom: 3.7 },
  { t: 5.2, x: 600, y: 1130, zoom: 1.45 },    // tanya: the strip and the charger, the set has come in
  { t: 9.2, x: 600, y: 1130, zoom: 1.45 },
  { t: 10.1, x: 560, y: 1050, zoom: 2.0 },    // dalam: in on the charger for the lens
  { t: 19.0, x: 560, y: 1050, zoom: 2.0 },
  { t: 20.2, x: 570, y: 1290, zoom: 1.3 },    // bukti: down the cable to where the phone is not
  { t: 24.4, x: 570, y: 1290, zoom: 1.3 },
  { t: 26.0, x: 580, y: 980, zoom: 1.45 },     // jawab: back to the charger, the answer card above
  { t: 31.8, x: 580, y: 980, zoom: 1.45 },
  { t: 32.6, x: 600, y: 930, zoom: 1.35 },    // tips: the strip with its switch, the cards above
  { t: 36.0, x: 600, y: 930, zoom: 1.35 },
  { t: 38.4, x: 540, y: 966, zoom: 3.7 },     // the loop-back: the big charger again
  { t: 40, x: 540, y: 966, zoom: 3.7 },
];
export const camAt = (t: number) => cam2At(CAM_KEYS, t);

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
/** The set (wall, desk, dressing) opacity: plain background in the hook (B44), in with the pull-back, out again with the loop-back. */
export const revealAt = (t: number) => clamp01((t - 3.3) / 1.5) * (1 - clamp01((t - 36.4) / 1.8));

/** The strip's switch: on at the start, off for the tip (34.6 s), on again as the loop comes home (37.0 s). */
export const SWITCH = { off: 34.6, on: 37.0 } as const;
export const switchOn = (t: number) => t < SWITCH.off || t >= SWITCH.on;
/** The lens: the dark inside of the charger opens as a circle from the charger and shuts again. */
export const LENS = { open: 9.6, full: 10.5, close: 18.3, shut: 19.1 } as const;
export const lensAt = (t: number) => (t < LENS.open || t >= LENS.shut ? 0 : t < LENS.full ? (t - LENS.open) / (LENS.full - LENS.open) : t < LENS.close ? 1 : 1 - (t - LENS.close) / (LENS.shut - LENS.close));

export const LABELS = [
  { id: "hp", world: "out", text: "tanpa HP", from: 5.2, to: 8.8, x: 760, y: 1410, at: P3(3.4, 2.5, 0) },
  { id: "trafo", world: "lab", text: "trafo", from: 11.0, to: 14.0, n: 1 },
  { id: "rangkaian", world: "lab", text: "rangkaian", from: 14.3, to: 17.6, n: 2 },
  { id: "stopkontak", world: "out", text: "tetap dari stopkontak", from: 20.6, to: 24.2, x: 640, y: 1000, at: P3(5.1, 0.95, 0) },
] as const;
export const CARDS = [
  { id: "arus", y: 470, title: "< 0,5 W", sub: "charger modern, tanpa HP", a: 27.3, out: 31.9 },
  { id: "lama", y: 680, title: "beberapa W", sub: "charger lama", a: 28.3, out: 31.9 },
  { id: "cabut", y: 470, title: "Cabut", sub: "kalau tidak dipakai", a: 32.5, out: 35.9 },
  { id: "saklar", y: 680, title: "Stopkontak bersaklar", sub: "matikan saklarnya", a: 33.9, out: 35.9 },
] as const;

/** The hero's box at time t, in the 1080 px frame (x, y, w, h): the charger at the hook, the strip with the charger after it. */
export const HERO_BOX_AT = (t: number) => {
  const c = camAt(t), big = t < 4.2 || t >= 37.6;
  const w = t >= LENS.full && t < LENS.close ? 620 : (big ? 209 : 505) * c.zoom;   // in the lens the hero is the cut charger
  return { x: 540, y: 960 + c.zoom * (1050 - c.y), w, h: w * 0.9 };
};

export function makePlan(story: StoryT) {
  const starts = story.beats.map((_, i) => story.beats.slice(0, i).reduce((a, b) => a + b.dur, 0));
  const total = story.beats.reduce((a, b) => a + b.dur, 0);
  const sting = starts[1] ?? 0;                                   // must 1: the "Intip yuk!" sting is the second beat
  const outro = starts.at(-1) ?? total;                           // must 2: the loop-back outro is the last beat
  const m = { sting, stingEnd: sting + (story.beats[1]?.dur ?? 1), react: NaN, outro, end: total };
  return {
    m, total, starts,
    // 0 at the start, 1 in the loop-back: the scene is the first beat's again at the end (the loop)
    loopWeight: (t: number) => Math.min(1, Math.max(0, (t - outro) / 0.5)),
    tops: story.beats.flatMap((b, i) => (b.kind === "hook" || b.kind === "sting" || b.kind === "outro" ? [] : [{ a: starts[i], b: starts[i] + b.dur, kicker: b.kicker, headline: b.headline ?? b.text }])),
    labels: LABELS,
  };
}
