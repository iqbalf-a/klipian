/* The geometry of the nature kit (pilot 2, phase 1): pure functions, no React, so the tests can read it. The 2.5D world of src/iso.ts: x to the lower
   right, y to the lower left, z up. The sea is a block whose top face is the plane z = SEA_TOP; the land is a block with its top at z = LAND_TOP;
   the cloud floats above the sea at CLOUD_Z. Every function of time takes `phase` (0..1 over the video's loop) and is periodic in it, so the last
   frame of a loop equals the first (the loop phase of the components in IsoNature.tsx).

   Depth order (the table the components obey; IsoNature.tsx draws in this order, and tests/nature.test.ts checks it in the demo's source):
   1. sea block (its top face and sides);  2. ripples and splash on the sea's top face (clipped to that face);
   3. vapour (starts inside the water, so it is drawn after the sea top);  4. land block (top, then its sides);
   5. trees on the land top (after the land top);  6. runoff on the land top (clipped to it);
   7. sun (behind the cloud's upper edge, so it is drawn before the cloud);  8. rain (drawn BEFORE the cloud: it starts behind the cloud's lower edge);
   9. droplets (behind the cloud);  10. cloud (its puffs; the dark tone is set by `dark`, the size by `grow`);
   Labels and the caption are drawn last, by the scene. */

export type P3 = [number, number, number];
export type P2 = [number, number];

export const SEA = { a: [-1.9, -1.5, -0.9] as P3, b: [0.9, 0.7, 0] as P3 };   // the sea block; its top face is at z = SEA.b[2]
export const SEA_TOP = SEA.b[2];
export const LAND = { a: [0.7, -0.6, -0.8] as P3, b: [2.2, 1.0, -0.2] as P3 }; // the land block; its top is at z = LAND.b[2]
export const LAND_TOP = LAND.b[2];
export const CLOUD_Z = 2.8;                                                    // the cloud's centre height
export const CLOUD_BOTTOM = 2.25;                                              // the cloud's lower edge (rain starts just below it)

const TAU = Math.PI * 2;
/** Smooth 0..1 for a ramp from `a` to `b` of the phase-free value `x`. */
export const ramp = (x: number, a: number, b: number): number => Math.max(0, Math.min(1, (x - a) / (b - a)));
export const smooth = (k: number): number => k * k * (3 - 2 * k);

/** The four corners of the sea's top face, in order (counter-clockwise on the screen). */
export function seaTopCorners(): P3[] {
  const [x0, y0] = SEA.a, [x1, y1] = SEA.b;
  return [[x0, y0, SEA_TOP], [x1, y0, SEA_TOP], [x1, y1, SEA_TOP], [x0, y1, SEA_TOP]];
}

/** Whether a point (x, y) of the world lies on the sea's top face, with a margin (the ripples keep inside it). */
export const onSeaTop = (x: number, y: number, margin = 0): boolean =>
  x >= SEA.a[0] + margin && x <= SEA.b[0] - margin && y >= SEA.a[1] + margin && y <= SEA.b[1] - margin;

/** Ripples on the sea's top face: arcs (x, y) that breathe with `phase` (periodic). Each arc is a short curve of radius r. */
export function ripples(phase: number): { cx: number; cy: number; r: number; pts: P2[] }[] {
  const centres: P2[] = [[-1.5, -0.5], [-0.7, -0.5], [0.1, -0.5], [-1.1, 0.3]];
  return centres.map(([cx, cy], i) => {
    const r = 0.26 + 0.03 * Math.sin(TAU * phase + i * 1.3);
    const pts: P2[] = [];
    for (let k = 0; k <= 16; k++) { const a = 0.4 + (k / 16) * 2.3; pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); }
    return { cx, cy, r, pts };
  });
}

/** Splash rings on the sea's top face after a drop lands: r grows and opacity fades, `k` 0..1 (0 = no splash). */
export function splashRings(k: number, at: P2 = [-0.2, -0.3]): { x: number; y: number; r: number; opacity: number }[] {
  if (k <= 0 || k >= 1) return [];
  return [0, 1].map((i) => {
    const p = Math.max(0, k - i * 0.25) / 0.75;
    return { x: at[0], y: at[1], r: 0.08 + 0.42 * p, opacity: (1 - p) * 0.9 };
  }).filter((r) => r.opacity > 0.01);
}

/** The cloud's puffs: centre (x, y, z), radius, and which tone the puff is (0 light top, 1 mid, 2 dark underside). `grow` scales the cloud and
    `breath` (0..1, periodic) makes the puffs breathe a little. */
export function cloudPuffs(grow = 1, phase = 0): { x: number; y: number; z: number; r: number }[] {
  const base: [number, number, number, number][] = [[-0.6, 0.0, 0.0, 0.62], [0.0, 0.1, 0.25, 0.72], [0.55, -0.05, 0.0, 0.6], [-0.2, -0.25, -0.2, 0.5], [0.3, 0.3, -0.15, 0.45]];
  const breathe = 1 + 0.02 * Math.sin(TAU * phase);
  return base.map(([x, y, z, r]) => ({ x: x * grow, y: y * grow, z: CLOUD_Z + z * grow, r: r * grow * breathe }));
}

/** Rain: streaks that fall from just below the cloud's lower edge (behind the cloud) to the sea or the land. `phase` moves the streaks down,
    periodically; each streak is (start, end) in the world. */
export function rainStreaks(phase: number, n = 9): { a: P3; b: P3; onLand: boolean }[] {
  const out: { a: P3; b: P3; onLand: boolean }[] = [];
  for (let i = 0; i < n; i++) {
    const x = -1.2 + (2.6 * i) / (n - 1) + 0.07 * Math.sin(i * 2.1);
    const y = -0.4 + 0.9 * ((i * 0.61) % 1);
    const onLand = x > LAND.a[0] - 0.4 && y > -0.2;
    const top = CLOUD_BOTTOM - 0.15, bottom = onLand ? LAND_TOP : SEA_TOP;
    const span = top - bottom, len = 0.45;
    const h = (((i * 0.37 + phase) % 1) + 1) % 1;           // periodic fall, 0..1
    const z1 = top - h * span, z0 = Math.max(bottom, z1 - len);
    out.push({ a: [x, y, z1], b: [x, y, z0], onLand });
  }
  return out;
}

/** Vapour wisps: from inside the sea (below its top face) up toward the cloud's lower edge. `k` 0..1 is how much vapour there is (it fades out
    toward the cloud). Each wisp is a list of 3D points, wiggling sideways as it rises. */
export function vapourWisps(k: number, phase: number): P3[][] {
  if (k <= 0) return [];
  const wisps: P3[][] = [];
  for (let w = 0; w < 3; w++) {
    const x0 = -1.5 + w * 0.5, y0 = -0.2 + 0.2 * w;
    const pts: P3[] = [];
    for (let s = 0; s <= 12; s++) {
      const f = s / 12;                                       // 0 at the water, 1 at the cloud
      const z = SEA_TOP - 0.12 + f * (CLOUD_BOTTOM - SEA_TOP - 0.3);
      const x = x0 + 0.12 * Math.sin(TAU * (phase + w * 0.3) + f * 5);
      pts.push([x, y0, z]);
    }
    wisps.push(pts);
  }
  return wisps;
}

/** Vapour's fade along a wisp: opaque near the water, gone at the cloud; `k` scales the whole. */
export const vapourOpacity = (f: number, k: number): number => k * (1 - smooth(ramp(f, 0.5, 1)));

/** A tone mix of two rgb() colours (k 0 = a, 1 = b), used for the cloud's white to grey change. */
export function mixRgb(a: string, b: string, k: number): string {
  const pa = a.match(/\d+/g)!.map(Number), pb = b.match(/\d+/g)!.map(Number), q = Math.max(0, Math.min(1, k));
  return `rgb(${pa.map((v, i) => Math.round(v + (pb[i] - v) * q)).join(",")})`;
}

/** The depth-order table, in draw order. IsoNature.tsx and NatureDemo.tsx follow it; tests/nature.test.ts reads them to check it. */
export const DEPTH_ORDER = ["sea", "ripples", "vapour", "land", "trees", "runoff", "sun", "rain", "droplets", "cloud"] as const;
