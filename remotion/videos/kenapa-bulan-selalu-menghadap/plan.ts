/* Kenapa bulan selalu menghadap kita dengan sisi yang sama?: the timing of the video (pure, no React). One set (kind "space"): the Moon goes round the Earth on a ring in
   the iso plane, and a pole on its near side points at the Earth all the time. The camera follows the Moon or the Earth with one continuous move (camAt).
   Every moment something appears is named in `T`; index.tsx (the picture) and sfx.ts (the sound) read the same numbers. All times are seconds of the whole video.
   The orbit takes 30 s and the Moon turns once in the same 30 s, so the first frame is the last frame (two laps in 60 s: the loop). */
import type { StoryT } from "../../src/schema.ts";
import { isoAt, toScreen, type Cam2, type P2 } from "../../src/iso.ts";

/** The set in world px (the scene is drawn at rest at zoom 1): the ring's centre, its radius and the two spheres. A sphere of radius R is drawn R * 1.2247 px big. */
export const SET = { cx: 540, cy: 960, ring: 345, earthR: 110, moonR: 52 } as const;
export const SPHERE_K = Math.sqrt(1.5);
export const LAP = 30;                                    // seconds for one lap round the Earth AND one turn on its own axis (the same, that is the story)
export const TH0 = (5 * Math.PI) / 4;                      // at t = 0 the Moon is behind the Earth, so its pole points at us and the hook can see it

export const theta = (t: number): number => TH0 + (2 * Math.PI * t) / LAP;
/** The Moon's turn: the locked turn is half a turn ahead of the lap (the near side looks at the Earth), plus the libration (6 degrees, once a lap). */
export const libAmp = (t: number): number => (t < 51.2 || t > 56.2 ? 1 : 1 + 2 * Math.sin((Math.PI * Math.min(1, (t - 51.2) / 1.0)) / 2) * (t < 55 ? 1 : Math.max(0, 1 - (t - 55) / 1.2)));   // x3 in the tips beat, where the wobble is the subject
export const libration = (t: number): number => 0.11 * libAmp(t) * Math.sin((2 * Math.PI * t) / LAP);
export const moonPhi = (t: number): number => theta(t) + Math.PI + libration(t);
/** The ghost that does not turn: it sits on the other side of the ring and keeps pointing the same way. */
export const ghostTheta = (t: number): number => theta(t) + Math.PI;
export const GHOST_PHI = 0.0;

export const worldOf = (th: number, ring: number = SET.ring): [number, number, number] => [ring * Math.cos(th), ring * Math.sin(th), 0];
export const screenOf = (th: number): P2 => isoAt(worldOf(th), 1, [SET.cx, SET.cy]);
export const moonPos = (t: number): P2 => screenOf(theta(t));
export const ghostPos = (t: number): P2 => screenOf(ghostTheta(t));
export const EARTH: P2 = [SET.cx, SET.cy];

export const T = {
  head: 0.15, push: 1.5, pushEnd: 3.0,
  // keliling (4 to 12)
  ring: 4.3, ringEnd: 5.5, arrow: 5.9, dot0: 6.6, lblLap: 7.6, lblMoon: 9.4, lapMark: 10.2,
  // putar (12 to 20)
  axis: 12.9, spinRing: 13.4, lblSpin: 14.4, tick: 16.0, lblEq: 17.8,
  // sama (20 to 34)
  snap0: 21.0, snapGap: 1.2, lblFace: 25.6, snapOut: 27.4, ghost: 28.0, lblGhost: 28.9, lblReal: 30.2, lblAll: 32.0,
  // kunci (34 to 43)
  bulge: 35.4, pull0: 36.0, lblBulge: 36.8, lblPull: 37.8, bar: 38.6, barDown: 39.2, barEnd: 41.8, lblYears: 40.0, locked: 41.9,
  // jauh (43 to 50)
  cardNear: 44.5, cardFar: 45.7, lblNear: 45.0, lblFar: 46.2, probe: 46.4, probeEnd: 49.4, lblLuna: 47.4,
  // tips (50 to 56)
  tipA: 51.0, tipB: 53.0, wobble: 52.2,
  // outro
  back: 56.2, backEnd: 58.4,
} as const;

type Target = "wide" | "earth" | "moon" | "mid" | "ghost";
type Key = { t: number; at: Target; zoom: number };
export const CAM_KEYS: readonly Key[] = [
  { t: 0, at: "wide", zoom: 0.88 }, { t: T.push, at: "wide", zoom: 0.88 }, { t: T.pushEnd, at: "mid", zoom: 1.3 }, { t: 4.0, at: "mid", zoom: 1.3 },
  { t: 5.4, at: "earth", zoom: 0.88 }, { t: 10.2, at: "earth", zoom: 0.9 }, { t: 12.4, at: "moon", zoom: 5.0 }, { t: 18.0, at: "moon", zoom: 5.2 },
  { t: 20.2, at: "earth", zoom: 0.88 }, { t: 33.4, at: "earth", zoom: 0.9 }, { t: 35.2, at: "mid", zoom: 1.25 }, { t: 42.4, at: "mid", zoom: 1.3 },
  { t: 44.2, at: "moon", zoom: 2.1 }, { t: 49.4, at: "moon", zoom: 2.2 }, { t: 51.0, at: "earth", zoom: 0.85 }, { t: 55.6, at: "earth", zoom: 0.85 },
  { t: T.back, at: "earth", zoom: 0.85 }, { t: T.backEnd, at: "wide", zoom: 0.88 }, { t: 60, at: "wide", zoom: 0.88 },
];
const WIDE: P2 = [540, 1010];
const focusOf = (at: Target, t: number): P2 => {
  if (at === "wide") return WIDE;
  if (at === "earth") return EARTH;
  if (at === "moon") return moonPos(t);
  if (at === "ghost") return ghostPos(t);
  const m = moonPos(t);
  return [(m[0] + EARTH[0]) / 2, (m[1] + EARTH[1]) / 2];
};
const smooth = (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
/** The camera at time t: eased between the keys; a key's focus is a target that may move (the Moon), so the camera follows it without a jump. */
export function camAt(t: number): Cam2 {
  const ks = CAM_KEYS;
  let i = 0;
  while (i < ks.length - 2 && t >= ks[i + 1].t) i++;
  const a = ks[i], b = ks[i + 1];
  const k = t <= a.t ? 0 : t >= b.t ? 1 : smooth((t - a.t) / (b.t - a.t));
  const fa = focusOf(a.at, t), fb = focusOf(b.at, t);
  return { x: fa[0] + (fb[0] - fa[0]) * k, y: fa[1] + (fb[1] - fa[1]) * k, zoom: Math.exp(Math.log(a.zoom) + (Math.log(b.zoom) - Math.log(a.zoom)) * k) };
}

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

/** The hero's box at time t, in the 1080 px frame: the Moon (centre third in the wide shot, about 55 % of the width in the close-up of the spin). */
export const HERO_BOX_AT = (t: number) => {
  const c = camAt(t), p = toScreen(c, moonPos(t)), w = 2 * SET.moonR * SPHERE_K * c.zoom;
  return { x: p[0], y: p[1], w, h: w };
};
