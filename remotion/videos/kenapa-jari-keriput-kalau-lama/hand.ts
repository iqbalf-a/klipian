/* The shapes of this video (pure: no React), so the readability test can fill them in one flat colour (DESIGN B36). World px, the same world as plan.ts.
   1. The hand seen from the back (dorsal view), fingers pointing down: the index finger is the one the cutaway opens on (x = FX, half width HW); the thumb is on its left (a left hand).
   2. The side view of that one index finger (back with the nail on the left, pad on the right), coming straight down from the top, with a slight taper and a rounded tip: the closed outline
      the cutaway, the wrinkles and the layers are built on. Both views share the finger's width and tip, so one finger stays in place while the two views fade into each other. */
import { FX, HW, PAD_X, TOP } from "./plan.ts";

export type DFinger = { id: string; cx: number; w: number; tip: number; root: number; rot: number; pivot: [number, number]; taper?: number; tapAt?: number };
export const DF_LIST: DFinger[] = [
  { id: "thumb", cx: 60, w: 540, tip: 1000, root: -700, rot: 35, pivot: [60, -380], taper: 0.4 },    // shorter, angled out to the left
  { id: "index", cx: FX, w: HW * 2, tip: 1560, root: -300, rot: 0, pivot: [FX, -300], taper: 0.45, tapAt: 800 },   // the same outline as the side view (sideRaw)
  { id: "middle", cx: 1040, w: 500, tip: 1640, root: -300, rot: 0, pivot: [1040, -300], taper: 0.4 },   // the longest
  { id: "ring", cx: 1635, w: 470, tip: 1590, root: -300, rot: -3, pivot: [1635, -300], taper: 0.4 },
  { id: "little", cx: 2170, w: 380, tip: 1340, root: -300, rot: -8, pivot: [2170, -300], taper: 0.4 },  // clearly the shortest
];

/** One finger: sides that taper towards the tip, a rounded tip. */
export const fingerPath = (f: { cx: number; w: number; tip: number; root: number; taper?: number; tapAt?: number }) => {
  const { cx, w, tip, root } = f, s = tip - 0.6 * w, n = (f.taper ?? 0.4) * w, t0 = f.tapAt ?? root;
  return `M ${cx - w / 2} ${root} L ${cx - w / 2} ${t0} L ${cx - n} ${s} C ${cx - n} ${tip - 0.25 * w} ${cx - 0.25 * w} ${tip} ${cx} ${tip} C ${cx + 0.25 * w} ${tip} ${cx + n} ${tip - 0.25 * w} ${cx + n} ${s} L ${cx + w / 2} ${t0} L ${cx + w / 2} ${root} Z`;
};
export const rotOf = (f: DFinger) => (f.rot ? `rotate(${f.rot} ${f.pivot[0]} ${f.pivot[1]})` : undefined);

/** The back of the hand (with the base of the thumb on its left), the wrist and the forearm; the forearm ends in a sleeve (SLEEVE_PATH) above the frame's top text. */
export const HAND_BODY = "M 160 -40 L 2400 -40 C 2420 -500 2200 -900 1820 -1400 L 1820 -3200 L 640 -3200 L 640 -1400 C 440 -1000 -140 -900 -140 -400 C -140 -200 40 -100 160 -40 Z";
/** The webs between the fingers: round off the top of each gap (x, y). */
export const WEBS: [number, number][] = [[735, -30], [1345, -30], [1925, -20]];
/** A plain sleeve with a cuff at the end of the forearm: the sleeve (base tone) and the cuff band (shade tone). The cuff's lower edge is at y = -2700 (the board over the top of the frame hides the sleeve above it). */
export const SLEEVE_PATH = "M 500 -2700 L 1960 -2700 L 1900 -5200 L 560 -5200 Z";
export const CUFF_PATH = "M 500 -2700 L 1960 -2700 L 1954 -2880 L 506 -2880 Z";

/** The nail on a finger's back: a smaller, lighter plate near the tip (about 58 % of the finger's width). Returns the rounded rectangle (x, y, w, h, r). */
export const nailBox = (f: DFinger) => {
  const w = f.w * 0.58, h = w * 0.95, y1 = f.tip - 0.1 * f.w;
  return { x: f.cx - w / 2, y: y1 - h, w, h, r: w * 0.4 };
};

// ------------------------------------------------------------------------------------------------------ the side view of the index finger
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
/** How far the side is drawn in (px): none above y = 800, the full taper of 26 px each side by the tip's start at y = 1248. The dorsal index (tapAt 800, taper 0.45) is the same outline. */
const tp = (y: number) => 26 * clamp01((y - 800) / 448);
const bez = (p0: [number, number], c1: [number, number], c2: [number, number], p3: [number, number], u: number): [number, number] => {
  const k = 1 - u;
  return [k * k * k * p0[0] + 3 * k * k * u * c1[0] + 3 * k * u * u * c2[0] + u * u * u * p3[0], k * k * k * p0[1] + 3 * k * k * u * c1[1] + 3 * k * u * u * c2[1] + u * u * u * p3[1]];
};
export type SideRaw = { x: number; y: number; seg: "L" | "T1" | "T2" | "R"; u: number };
/** The closed outline of the one finger, from the top of its back (left) side, down round the tip, and up its pad (right) side. It comes straight down from the top (TOP). */
export function sideRaw(): SideRaw[] {
  const raw: SideRaw[] = [];
  for (let y = TOP; y < 1248; y += 8) raw.push({ x: FX - HW + tp(y), y, seg: "L", u: 0 });
  const a0: [number, number] = [FX - HW + 26, 1248], a1: [number, number] = [FX - HW + 26, 1430], a2: [number, number] = [FX - 130, 1560], a3: [number, number] = [FX, 1560];
  for (let i = 0; i < 90; i++) { const u = i / 90, p = bez(a0, a1, a2, a3, u); raw.push({ x: p[0], y: p[1], seg: "T1", u }); }
  const b1: [number, number] = [FX + 130, 1560], b2: [number, number] = [PAD_X, 1430], b3: [number, number] = [PAD_X, 1248];
  for (let i = 0; i < 90; i++) { const u = i / 90, p = bez(a3, b1, b2, b3, u); raw.push({ x: p[0], y: p[1], seg: "T2", u }); }
  for (let y = 1248; y >= TOP; y -= 8) raw.push({ x: FX + HW - tp(y), y, seg: "R", u: 0 });
  return raw;
}

// ------------------------------------------------------------------------------------------------------ the readability test (B36)
/** All the hand's shapes in one flat colour: a stranger must read "a hand". */
export function silhouetteSvg(fill: string, bg: string): string {
  const parts = [
    ...DF_LIST.map((f) => `<path d="${fingerPath(f)}"${f.rot ? ` transform="${rotOf(f)}"` : ""}/>`),
    `<path d="${HAND_BODY}"/>`,
    ...WEBS.map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="85" ry="130"/>`),
  ];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-1100 -2000 4000 4000" width="640" height="640"><rect x="-1100" y="-2000" width="4000" height="4000" fill="${bg}"/><g fill="${fill}">${parts.join("")}</g></svg>`;
}
/** The side view's finger in one flat colour, as it shows under the top board (from y = 540 down to the tip). */
export function sideSilhouetteSvg(fill: string, bg: string): string {
  const pts = sideRaw().map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-60 240 960 1400" width="480" height="700"><rect x="-60" y="240" width="960" height="1400" fill="${bg}"/><polygon fill="${fill}" points="${pts}"/></svg>`;
}
