/* The geometry of the nature kit (pilot 2): pure functions, no React, so the tests can read it. The 2.5D world of src/iso.ts: x to the lower right,
   y to the lower left, z up. The sea is a block whose top face is the plane z = SEA_TOP; the land is a block beside it whose top is higher (LAND_TOP),
   so a stream runs down from the land into the sea; the cloud floats above the sea at CLOUD_Z. Every function of time takes `phase` (0..1 over the
   loop) and is periodic in it, so the last frame of a loop equals the first.

   Depth order (the table the components obey; IsoNature.tsx draws in this order, and tests/nature.test.ts reads it):
   1. sea block (its top face and sides);  2. ripples and splash on the sea's top face (clipped to that face);
   3. vapour (starts inside the water, so it is drawn after the sea top);  4. land block (top, then its sides);
   5. runoff on the land top (clipped to it; beside the trees, falling into the sea);  6. trees on the land top (back to front; they cover the runoff
      where they touch);  7. sun (behind the cloud's upper edge, so before the cloud);  8. rain (drawn BEFORE the cloud: it starts behind the cloud's
      lower edge);  9. droplets (behind the cloud);  10. clouds (white, then grey: their puffs; `dark` sets the tone, `grow` the size).
   Labels and the caption are drawn last, by the scene. */
import { isoAt } from "./iso.ts";

export type P3 = [number, number, number];
export type P2 = [number, number];

export const SEA = { a: [-1.9, -1.5, -0.9] as P3, b: [0.9, 0.7, 0] as P3 };   // the sea block; its top face is at z = SEA.b[2]
export const SEA_TOP = SEA.b[2];
export const LAND = { a: [1.0, -0.6, -0.6] as P3, b: [2.8, 1.2, 0.2] as P3 }; // the land block; its top (z = LAND.b[2]) is above the sea's top
export const LAND_TOP = LAND.b[2];
export const CLOUD_Z = 2.8;                                                    // a cloud's centre height (the centre of its puff row)
/** The cloud's lowest belly edge (the flat underside): rain starts just below the top of the rain column, behind this edge. */
export const CLOUD_BOTTOM = CLOUD_Z - 0.38;
/** A tree's foot radius (the cone's half width) and the margin it keeps from the land's edges. */
export const TREE_R = 0.22, MARGIN = 0.25;

const TAU = Math.PI * 2;
export const ramp = (x: number, a: number, b: number): number => Math.max(0, Math.min(1, (x - a) / (b - a)));
export const smooth = (k: number): number => k * k * (3 - 2 * k);

/** The four corners of the sea's top face, in order. */
export function seaTopCorners(): P3[] {
  const [x0, y0] = SEA.a, [x1, y1] = SEA.b;
  return [[x0, y0, SEA_TOP], [x1, y0, SEA_TOP], [x1, y1, SEA_TOP], [x0, y1, SEA_TOP]];
}
/** The eight corners of a block. */
export const blockCorners = (b: { a: P3; b: P3 }): P3[] => {
  const [x0, y0, z0] = b.a, [x1, y1, z1] = b.b;
  return [[x0, y0, z0], [x1, y0, z0], [x0, y1, z0], [x1, y1, z0], [x0, y0, z1], [x1, y0, z1], [x0, y1, z1], [x1, y1, z1]];
};
/** Whether a point (x, y) lies on the sea's top face, with a margin. */
export const onSeaTop = (x: number, y: number, margin = 0): boolean =>
  x >= SEA.a[0] + margin && x <= SEA.b[0] - margin && y >= SEA.a[1] + margin && y <= SEA.b[1] - margin;
/** Whether a point (x, y) lies on the land's top face, with a margin. */
export const onLandTop = (x: number, y: number, margin = 0): boolean =>
  x >= LAND.a[0] + margin && x <= LAND.b[0] - margin && y >= LAND.a[1] + margin && y <= LAND.b[1] - margin;

/** Ripples on the sea's top face: arcs (x, y) that breathe with `phase` (periodic). */
export function ripples(phase: number): { cx: number; cy: number; r: number; pts: P2[] }[] {
  const centres: P2[] = [[-1.5, -0.5], [-0.7, -0.5], [0.1, -0.5], [-1.1, 0.3]];
  return centres.map(([cx, cy], i) => {
    const r = 0.26 + 0.03 * Math.sin(TAU * phase + i * 1.3);
    const pts: P2[] = [];
    for (let k = 0; k <= 16; k++) { const a = 0.4 + (k / 16) * 2.3; pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); }
    return { cx, cy, r, pts };
  });
}

/** Splash rings on a horizontal face (the sea's top by default): radius grows and opacity fades with `k` (0..1; 0 and 1 give none). */
export function splashRings(k: number, at: P2 = [-0.2, -0.3]): { x: number; y: number; r: number; opacity: number }[] {
  if (k <= 0 || k >= 1) return [];
  return [0, 1].map((i) => {
    const p = Math.max(0, k - i * 0.25) / 0.75;
    return { x: at[0], y: at[1], r: 0.08 + 0.42 * p, opacity: (1 - p) * 0.9 };
  }).filter((r) => r.opacity > 0.01);
}

/** The cloud's puffs in its own unit: along the screen's horizontal row (x = s, y = -s), with the height z and the radius r. Seven puffs of at
    least three different radii, a big one in the middle, and the flat underside is the belly (BELLY, flatter ellipses). */
export const CLOUD_PUFFS: { s: number; z: number; r: number }[] = [
  { s: -0.62, z: 0.02, r: 0.34 }, { s: -0.36, z: 0.2, r: 0.46 }, { s: -0.04, z: 0.42, r: 0.62 }, { s: 0.3, z: 0.22, r: 0.5 },
  { s: 0.6, z: 0.0, r: 0.38 }, { s: -0.12, z: 0.66, r: 0.3 }, { s: 0.24, z: 0.62, r: 0.28 },
];
/** The flat belly ellipses under the puffs: s, z (the centre), rs (half width along the row), rz (half height). */
export const BELLY: { s: number; z: number; rs: number; rz: number }[] = [
  { s: -0.42, z: -0.2, rs: 0.42, rz: 0.13 }, { s: 0.02, z: -0.22, rs: 0.5, rz: 0.14 }, { s: 0.45, z: -0.2, rs: 0.4, rz: 0.12 },
];

/** A cloud's puffs and bellies in the world, centred at (cx, cy) with its height z = cz and a size `grow`; `phase` breathes the puffs (periodic). */
export function cloudParts(cx: number, cy: number, cz: number, grow = 1, phase = 0): {
  puffs: { x: number; y: number; z: number; r: number }[];
  back: { x: number; y: number; z: number; r: number }[];
  wisps: { x: number; y: number; z: number; r: number }[];
  belly: { x: number; y: number; z: number; rs: number; rz: number }[];
} {
  const breathe = 1 + 0.02 * Math.sin(TAU * phase);
  const at = (p: { s: number; z: number; r: number }) => ({ x: cx + p.s * grow, y: cy - p.s * grow, z: cz + p.z * grow, r: p.r * grow * breathe });
  return {
    puffs: CLOUD_PUFFS.map(at),
    back: BACK_PUFFS.map(at),
    wisps: WISPS.map(at),
    belly: BELLY.map((b) => ({ x: cx + b.s * grow, y: cy - b.s * grow, z: cz + b.z * grow, rs: b.rs * grow, rz: b.rz * grow })),
  };
}
/** The cloud of the demo: the white one (up and to the left) and the grey rain cloud (lower, to the right), as in the reference. */
export const CLOUD_WHITE = { cx: -1.6, cy: 1.2, cz: CLOUD_Z + 0.2, grow: 0.8 };
export const CLOUD_GREY = { cx: 0.6, cy: -0.3, cz: CLOUD_Z - 0.1, grow: 1 };

/** Rain: streaks that fall from just below the grey cloud's lower edge to the sea's top or the land's top (a streak with no surface under it is
    left out). `phase` moves the streaks down, periodically. */
export function rainStreaks(phase: number, n = 9): { a: P3; b: P3; onLand: boolean }[] {
  const out: { a: P3; b: P3; onLand: boolean }[] = [];
  const g = CLOUD_GREY;
  for (let i = 0; i < n; i++) {
    const s = -0.42 + (0.84 * i) / (n - 1) + 0.03 * Math.sin(i * 2.1);
    const x = g.cx + s * 0.8, y = g.cy - s * 0.8;
    const onLand = onLandTop(x, y), onSea = onSeaTop(x, y);
    if (!onLand && !onSea) continue;
    const bottom = onLand ? LAND_TOP : SEA_TOP, top = CLOUD_BOTTOM - 0.15;
    const span = top - bottom, len = 0.45;
    const h = (((i * 0.37 + phase) % 1) + 1) % 1;
    const z1 = top - h * span, z0 = Math.max(bottom, z1 - len);
    out.push({ a: [x, y, z1], b: [x, y, z0], onLand });
  }
  return out;
}

/** Vapour wisps: from inside the sea (below its top face) up toward the cloud's lower edge; `k` is how much vapour there is. */
export function vapourWisps(k: number, phase: number): P3[][] {
  if (k <= 0) return [];
  const wisps: P3[][] = [];
  for (let w = 0; w < 3; w++) {
    const x0 = -1.5 + w * 0.5, y0 = -0.2 + 0.2 * w;
    const pts: P3[] = [];
    for (let s = 0; s <= 12; s++) {
      const f = s / 12;
      const z = SEA_TOP - 0.12 + f * (CLOUD_BOTTOM - SEA_TOP - 0.3);
      pts.push([x0 + 0.12 * Math.sin(TAU * (phase + w * 0.3) + f * 5), y0, z]);
    }
    wisps.push(pts);
  }
  return wisps;
}
/** Vapour's fade along a wisp (f 0 at the water, 1 at the cloud). */
export const vapourOpacity = (f: number, k: number): number => k * (1 - smooth(ramp(f, 0.5, 1)));

/** Trees on the land's top face: foot position (x, y), height, and kind (a pine of three tiers, or a round tree of three lobes). Drawn back to front
    (the order below: by x + y). */
export type TreeKind = "pine" | "round";
export const TREES: { x: number; y: number; h: number; kind: TreeKind }[] = [
  { x: 1.6, y: -0.05, h: 0.7, kind: "pine" }, { x: 2.0, y: 0.55, h: 0.85, kind: "round" }, { x: 2.25, y: -0.05, h: 0.6, kind: "pine" }, { x: 1.5, y: 0.6, h: 0.75, kind: "round" },
].sort((a, b) => a.x + a.y - (b.x + b.y)) as { x: number; y: number; h: number; kind: TreeKind }[];

/** The land's details (phase 1c), all on its top face or its sides: a hill step behind the trees, two rocks, two bushes, three white flowers, two puddles
    that grow after rain. Each is kept clear of the runoff and of the trees' feet (tests). */
export const HILL = { a: [2.3, -0.55, LAND_TOP] as P3, b: [2.7, -0.33, LAND_TOP + 0.3] as P3 };
export const ROCKS: { x: number; y: number; s: number; h: number }[] = [{ x: 2.5, y: 1.0, s: 0.12, h: 0.14 }, { x: 1.85, y: 0.95, s: 0.09, h: 0.1 }];
export const BUSHES: { x: number; y: number; r: number }[] = [{ x: 1.6, y: -0.45, r: 0.12 }, { x: 2.6, y: 0.4, r: 0.13 }];
export const FLOWERS: P2[] = [[2.1, 1.0], [1.9, 0.25], [1.35, -0.5]];
export const PUDDLES: { x: number; y: number; r: number }[] = [{ x: 1.75, y: -0.35, r: 0.11 }, { x: 2.45, y: 0.75, r: 0.1 }];
/** The land's strata: the layer boundaries (z) on the land's sides: topsoil, sand (clay), stone. */
export const STRATA_Z = [LAND.b[2], LAND.b[2] - 0.22, LAND.b[2] - 0.5, LAND.a[2]] as const;

/** Tree shadows on the grass: a flat ring at the foot, shifted away from the light (the light comes from the upper left). */
export const TREE_SHADOW = { dx: -0.12, dy: -0.12, r: 0.24 };
/** The cloud's shadow on the sea's top face (the grey cloud's), drawn on the water: its centre and radius in world units. */
export const CLOUD_SHADOW = { x: CLOUD_GREY.cx - 0.5, y: CLOUD_GREY.cy - 0.5, r: 0.55 };

/** The sea's crests: two staggered rows of arcs, each with a small foam cap on top; their radii breathe with `phase` (periodic). */
export function crests(phase: number): { pts: P2[]; cap: P2[] }[] {
  const rows: [number, number[]][] = [[-0.55, [-1.7, -1.3, -0.9, -0.5, -0.1, 0.3, 0.6]], [0.35, [-1.45, -1.05, -0.65, -0.25, 0.15, 0.5]]];
  const out: { pts: P2[]; cap: P2[] }[] = [];
  let i = 0;
  for (const [y, xs] of rows) {
    for (const x of xs) {
      const r = (0.17 + 0.05 * ((i % 3) / 2)) * (1 + 0.1 * Math.sin(TAU * phase + i));
      const pts: P2[] = [], cap: P2[] = [];
      for (let k = 0; k <= 12; k++) { const a = 0.5 + (k / 12) * 2.1; pts.push([x + r * Math.cos(a), y + r * Math.sin(a)]); }
      for (let k = 0; k <= 4; k++) { const a = 0.9 + (k / 4) * 1.2; cap.push([x + 0.55 * r * Math.cos(a), y + 0.55 * r * Math.sin(a) + 0.02]); }
      out.push({ pts, cap });
      i++;
    }
  }
  return out;
}
/** The sea's glints: small diamonds on the water that twinkle (their brightness is periodic in `phase`). */
export const GLINTS: P2[] = [[-1.2, -1.0], [-0.2, 0.2], [0.5, -0.9], [-1.6, 0.1]];

/** The cloud's back puffs: drawn first, one tone darker than the front puffs, so the cloud has depth. */
export const BACK_PUFFS: { s: number; z: number; r: number }[] = [
  { s: -0.5, z: 0.3, r: 0.36 }, { s: -0.1, z: 0.55, r: 0.4 }, { s: 0.35, z: 0.42, r: 0.38 }, { s: 0.65, z: 0.18, r: 0.3 },
];
/** The cloud's two wisps at its ends (small puffs at the belly's level). */
export const WISPS: { s: number; z: number; r: number }[] = [{ s: -0.95, z: -0.06, r: 0.14 }, { s: 0.9, z: -0.02, r: 0.12 }];

/** The runoff: a thin stream beside the trees (at least 0.3 from each foot), from the back of the land's top to its edge nearest the sea, then a
    short fall into the sea. Two parts: `onLandPath` on the land's top face, `fall` from the land's edge (LAND_TOP) down to the sea (SEA_TOP). */
export const RUNOFF = {
  onLandPath: [[1.3, 0.95], [1.15, 0.35], [1.02, -0.2]] as P2[],
  fall: [[1.0, -0.25, LAND_TOP], [0.88, -0.25, SEA_TOP]] as P3[],
};

/** A tone mix of two rgb() colours (k 0 = a, 1 = b). */
export function mixRgb(a: string, b: string, k: number): string {
  const pa = a.match(/\d+/g)!.map(Number), pb = b.match(/\d+/g)!.map(Number), q = Math.max(0, Math.min(1, k));
  return `rgb(${pa.map((v, i) => Math.round(v + (pb[i] - v) * q)).join(",")})`;
}

/** The depth-order table, in draw order (runoff before the trees, so the trees cover the stream where they touch). */
export const DEPTH_ORDER = ["sea", "ripples", "vapour", "land", "hill", "puddles", "shadows", "runoff", "bushes", "rocks", "trees", "sun", "rain", "droplets", "cloud"] as const;

/** The screen points (video px, at the scale u and origin o) of a list of world points. */
export const screenOf = (pts: readonly P3[], u: number, o: P2): P2[] => pts.map((p) => isoAt(p, u, o) as P2);
/** The bounding box of a list of screen points. */
export function boundsOf(pts: readonly P2[]): { x0: number; y0: number; x1: number; y1: number } {
  return { x0: Math.min(...pts.map((p) => p[0])), y0: Math.min(...pts.map((p) => p[1])), x1: Math.max(...pts.map((p) => p[0])), y1: Math.max(...pts.map((p) => p[1])) };
}

/** The screen points of the sea block, the land block and its trees, the cloud (white or grey), the sun and the rest, for the sheet's bounding boxes. */
export const SUN_CENTRE: P2 = [200, 520];
export const SUN_R = 70;
export function assetPoints(name: string, u: number, o: P2): P2[] {
  const sunRing = (cx: number, cy: number, r: number): P2[] => Array.from({ length: 24 }, (_, i) => { const a = (i / 24) * TAU; return [cx + r * 1.9 * Math.cos(a), cy + r * 1.9 * Math.sin(a)] as P2; });
  const cloudPts = (c: { cx: number; cy: number; cz: number; grow: number }): P2[] => {
    const parts = cloudParts(c.cx, c.cy, c.cz, c.grow);
    return screenOf([...parts.puffs.flatMap((p) => [[p.x - p.r, p.y, p.z - p.r], [p.x + p.r, p.y, p.z + p.r], [p.x, p.y - p.r, p.z]] as P3[]), ...parts.belly.flatMap((b) => [[b.x - b.rs, b.y, b.z - b.rz], [b.x + b.rs, b.y, b.z + b.rz]] as P3[])], u, o);
  };
  const treePts = (list: typeof TREES = TREES): P2[] => list.flatMap((t) => screenOf([[t.x, t.y, LAND_TOP], [t.x, t.y, LAND_TOP + t.h]], u, o).concat(screenOf([[t.x - TREE_R, t.y, LAND_TOP], [t.x + TREE_R, t.y, LAND_TOP]], u, o)));
  switch (name) {
    case "sea": return screenOf(blockCorners(SEA), u, o);
    case "land": return [...screenOf(blockCorners(LAND), u, o), ...treePts()];
    case "trees": return treePts();
    case "sun": return sunRing(o[0], o[1], u * 0.25);
    case "cloud-white": return cloudPts({ cx: CLOUD_WHITE.cx, cy: CLOUD_WHITE.cy, cz: CLOUD_WHITE.cz, grow: CLOUD_WHITE.grow });
    case "cloud-grey": return cloudPts({ cx: CLOUD_GREY.cx, cy: CLOUD_GREY.cy, cz: CLOUD_GREY.cz, grow: CLOUD_GREY.grow });
    case "clouds": return [...cloudPts({ cx: CLOUD_WHITE.cx, cy: CLOUD_WHITE.cy, cz: CLOUD_WHITE.cz, grow: CLOUD_WHITE.grow }), ...cloudPts({ cx: CLOUD_GREY.cx, cy: CLOUD_GREY.cy, cz: CLOUD_GREY.cz, grow: CLOUD_GREY.grow })];
    case "rain": return screenOf(rainStreaks(0).flatMap((s) => [s.a, s.b]), u, o);
    case "vapour": return [...screenOf(vapourWisps(1, 0).flat(), u, o), ...screenOf(Array.from({ length: 18 }, (_, i) => { const f = (i % 9) / 8, j = Math.floor(i / 9); return [-0.5 + 1.1 * f, -0.9 + 0.4 * j, SEA_TOP + 0.1 + 0.06 * j] as P3; }), u, o)];
    case "droplets": return screenOf([[-0.9, 0.2, 2.1], [-0.4, -0.2, 2.0], [0.2, 0.3, 2.05], [0.7, -0.1, 2.15]], u, o);
    case "splash": return [...screenOf(seaTopCorners(), u, o), ...screenOf(Array.from({ length: 24 }, (_, i) => { const a = (i / 24) * TAU; return [-0.2 + 0.5 * Math.cos(a), -0.3 + 0.5 * Math.sin(a), SEA_TOP] as P3; }), u, o)];
    case "runoff": return [...screenOf(blockCorners(LAND).slice(0, 4).map((p) => [p[0], p[1], LAND_TOP] as P3), u, o), ...screenOf([...RUNOFF.onLandPath.map(([x, y]) => [x, y, LAND_TOP] as P3), ...RUNOFF.fall], u, o)];
    case "pine": return treePts(TREES.filter((t) => t.kind === "pine").slice(0, 1));
    case "round": return treePts(TREES.filter((t) => t.kind === "round").slice(0, 1));
    case "hill": return screenOf(blockCorners(HILL), u, o);
    case "shadow": return screenOf(Array.from({ length: 24 }, (_, i) => { const a = (i / 24) * TAU; return [CLOUD_SHADOW.x + CLOUD_SHADOW.r * Math.cos(a), CLOUD_SHADOW.y + CLOUD_SHADOW.r * Math.sin(a), SEA_TOP] as P3; }), u, o);
    case "puddle": return screenOf(PUDDLES.flatMap((p) => Array.from({ length: 12 }, (_, i) => { const a = (i / 12) * TAU; return [p.x + p.r * Math.cos(a), p.y + p.r * Math.sin(a), LAND_TOP] as P3; })), u, o);
    case "scene": return [...screenOf(blockCorners(SEA), u, o), ...screenOf(blockCorners(LAND), u, o), ...sunRing(o[0] - 300, o[1] - 800, SUN_R * 0.25), ...cloudPts({ cx: CLOUD_WHITE.cx, cy: CLOUD_WHITE.cy, cz: CLOUD_WHITE.cz, grow: CLOUD_WHITE.grow }), ...cloudPts({ cx: CLOUD_GREY.cx, cy: CLOUD_GREY.cy, cz: CLOUD_GREY.cz, grow: CLOUD_GREY.grow })];
    default: return [];
  }
}

/** The nature asset sheet (NatureSheet.tsx): the tiles in a grid of 360 px columns and 380 px rows, each tile fitted by its bounding box (drawn at
    u = 100 about the origin) to 80 % of its drawing area, centred, and the bottom LABEL_H px kept for the label. */
export const SHEET = { colW: 360, rowH: 380, top: 20, labelH: 70, fill: 0.8, u: 100 };
/** The sheet's height: its seven rows (the sheet is taller than one video frame). */
export const SHEET_HEIGHT = SHEET.top + 7 * SHEET.rowH;
export const SHEET_TILES: { name: string; col: number; row: number; span: number; label: string }[] = [
  { name: "sea", col: 0, row: 0, span: 1, label: "sea" },
  { name: "land", col: 1, row: 0, span: 1, label: "land" },
  { name: "trees", col: 2, row: 0, span: 1, label: "trees" },
  { name: "sun", col: 0, row: 1, span: 1, label: "sun" },
  { name: "cloud-white", col: 1, row: 1, span: 1, label: "cloud white" },
  { name: "cloud-grey", col: 2, row: 1, span: 1, label: "cloud grey" },
  { name: "clouds", col: 0, row: 2, span: 2, label: "clouds: white and grey" },
  { name: "rain", col: 2, row: 2, span: 1, label: "rain" },
  { name: "vapour", col: 0, row: 3, span: 1, label: "vapour" },
  { name: "droplets", col: 1, row: 3, span: 1, label: "droplets" },
  { name: "splash", col: 2, row: 3, span: 1, label: "splash" },
  { name: "runoff", col: 0, row: 4, span: 1, label: "runoff" },
  { name: "scene", col: 1, row: 4, span: 2, label: "the whole scene" },
  { name: "pine", col: 0, row: 5, span: 1, label: "pine tree" },
  { name: "round", col: 1, row: 5, span: 1, label: "round tree" },
  { name: "hill", col: 2, row: 5, span: 1, label: "hill step" },
  { name: "shadow", col: 0, row: 6, span: 1, label: "cloud shadow" },
  { name: "puddle", col: 1, row: 6, span: 1, label: "puddles" },
];
/** The layout of one tile: its box, the drawing area, the bounding box of its drawing (at SHEET.u about the origin), and the transform that puts the
    drawing in its area: translate(tx, ty) scale(s) translate(-bcx, -bcy). */
export function sheetTile(name: string): { x: number; y: number; w: number; h: number; area: { x0: number; y0: number; x1: number; y1: number }; bbox: { x0: number; y0: number; x1: number; y1: number }; s: number; tx: number; ty: number; bcx: number; bcy: number; label: { x: number; y: number } } {
  const t = SHEET_TILES.find((k) => k.name === name);
  if (!t) throw new Error(`no sheet tile "${name}"`);
  const x = t.col * SHEET.colW, y = SHEET.top + t.row * SHEET.rowH, w = t.span * SHEET.colW, h = SHEET.rowH;
  const area = { x0: x + 10, y0: y + 10, x1: x + w - 10, y1: y + h - SHEET.labelH - 10 };
  const bbox = boundsOf(assetPoints(name, SHEET.u, [0, 0]));
  const bw = bbox.x1 - bbox.x0, bh = bbox.y1 - bbox.y0;
  const s = Math.min((SHEET.fill * (area.x1 - area.x0)) / bw, (SHEET.fill * (area.y1 - area.y0)) / bh);
  const bcx = (bbox.x0 + bbox.x1) / 2, bcy = (bbox.y0 + bbox.y1) / 2;
  const tx = (area.x0 + area.x1) / 2, ty = (area.y0 + area.y1) / 2;
  return { x, y, w, h, area, bbox, s, tx, ty, bcx, bcy, label: { x: x + w / 2, y: y + h - 24 } };
}
/** The screen box of a tile's drawing after its transform. */
export function sheetTileBox(name: string): { x0: number; y0: number; x1: number; y1: number } {
  const t = sheetTile(name);
  const map = (p: P2): P2 => [t.tx + t.s * (p[0] - t.bcx), t.ty + t.s * (p[1] - t.bcy)];
  const pts = assetPoints(name, SHEET.u, [0, 0]).map(map);
  return boundsOf(pts);
}
