/* The hand seen from the back (dorsal view), fingers pointing down: the shapes only (pure: no React), so the readability test can fill them in one flat colour. World px, the same world as plan.ts:
   the index finger is the one the cutaway opens on (x = FX, half width HW); the thumb is on its left (a left hand, back of the hand towards the viewer). */
import { FX, HW } from "./plan.ts";

export type DFinger = { id: string; cx: number; w: number; tip: number; root: number; rot: number; pivot: [number, number]; nail: number; taper?: number };
export const DF_LIST: DFinger[] = [
  { id: "thumb", cx: 60, w: 540, tip: 1000, root: -700, rot: 35, pivot: [60, -380], nail: 0.45 },    // shorter, angled out to the left
  { id: "index", cx: FX, w: HW * 2, tip: 1560, root: -300, rot: 0, pivot: [FX, -300], nail: 0.52, taper: 0.5 },
  { id: "middle", cx: 1040, w: 500, tip: 1640, root: -300, rot: 0, pivot: [1040, -300], nail: 0.52 },   // the longest
  { id: "ring", cx: 1635, w: 470, tip: 1590, root: -300, rot: -3, pivot: [1635, -300], nail: 0.5 },
  { id: "little", cx: 2170, w: 380, tip: 1340, root: -300, rot: -8, pivot: [2170, -300], nail: 0.46 },  // clearly the shortest
];

/** One finger: straight sides that taper a little, a rounded tip. */
export const fingerPath = (f: { cx: number; w: number; tip: number; root: number; taper?: number }) => {
  const { cx, w, tip, root } = f, s = tip - 0.6 * w, n = (f.taper ?? 0.45) * w;
  return `M ${cx - w / 2} ${root} L ${cx - n} ${s} C ${cx - n} ${tip - 0.25 * w} ${cx - 0.25 * w} ${tip} ${cx} ${tip} C ${cx + 0.25 * w} ${tip} ${cx + n} ${tip - 0.25 * w} ${cx + n} ${s} L ${cx + w / 2} ${root} Z`;
};
export const rotOf = (f: DFinger) => (f.rot ? `rotate(${f.rot} ${f.pivot[0]} ${f.pivot[1]})` : undefined);

/** The back of the hand (with the base of the thumb on its left), the wrist and the forearm (it runs off the top of the frame). */
export const HAND_BODY = "M 160 -40 L 2400 -40 C 2420 -500 2200 -900 1820 -1400 L 1820 -4000 L 640 -4000 L 640 -1400 C 440 -1000 -140 -900 -140 -400 C -140 -200 40 -100 160 -40 Z";

/** The webs between the fingers: round off the top of each gap (x, y). */
export const WEBS: [number, number][] = [[735, -30], [1345, -30], [1925, -20]];

/** The nail on a finger's back: lighter plate near the tip. Returns the rounded rectangle (x, y, w, h, r). */
export const nailBox = (f: DFinger) => {
  const w = f.w * 0.66, h = f.w * f.nail, y1 = f.tip - 0.12 * f.w;
  return { x: f.cx - w / 2, y: y1 - h, w, h, r: w * 0.42 };
};

/** All the shapes in one flat colour (for the readability test: a stranger must read "a hand"). */
export function silhouetteSvg(fill: string, bg: string): string {
  const parts = [
    ...DF_LIST.map((f) => `<path d="${fingerPath(f)}"${f.rot ? ` transform="${rotOf(f)}"` : ""}/>`),
    `<path d="${HAND_BODY}"/>`,
    ...WEBS.map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="85" ry="130"/>`),
  ];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-1100 -2000 4000 4000" width="640" height="640"><rect x="-1100" y="-2000" width="4000" height="4000" fill="${bg}"/><g fill="${fill}">${parts.join("")}</g></svg>`;
}
