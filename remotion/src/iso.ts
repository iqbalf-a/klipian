/* The 2.5D isometric kit's geometry (P28, main style since 2026-10-26): pure maths, no React, so `npm test` can check it and a scene can compute where a
   part is on the screen. World axes: x runs to the screen's lower right, y to its lower left (towards the viewer's left), z up. One world unit is `u`
   pixels. Three tones per object (the tone rule): a face that looks up is the LIGHT tone, a face that looks to the lower left (+y) the MID tone, a face
   that looks to the lower right (+x) the DARK tone; light from the top-left. A face is visible when it looks towards the viewer, i.e. along (1, 1, 1).
   A 2D camera (focus + zoom) moves layered groups with parallax: far layers move and grow less. See DESIGN.md, "2.5D isometrik". */

export type P3 = readonly [number, number, number];
export type P2 = readonly [number, number];
export type Tone = 0 | 1 | 2;                      // 0 = light (top), 1 = mid (left, +y), 2 = dark (right, +x)
export type Tones = readonly [string, string, string];
export type Poly = { pts: P2[]; tone: Tone };

const C = Math.cos(Math.PI / 6);                    // 0.866
export const VIEW: P3 = [1, 1, 1];                 // towards the viewer
const LIGHT: P3 = [0.25, 0.55, 1];                  // brightness of a face = its normal . LIGHT: top 1, left 0.55, right 0.25

/** The screen point (relative to the origin) of a world point, at `u` px per unit. */
export const iso = (p: P3, u = 100): P2 => [(p[0] - p[1]) * C * u, (p[0] + p[1]) * 0.5 * u - p[2] * u];
export const isoAt = (p: P3, u: number, o: P2): P2 => { const q = iso(p, u); return [q[0] + o[0], q[1] + o[1]]; };

const dot = (a: P3, b: P3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
/** The tone of a face by its outward normal. */
export function toneOf(n: P3): Tone {
  const b = dot(n, LIGHT) / Math.hypot(...n);
  return b >= (LIGHT[2] + LIGHT[1]) / 2 / Math.hypot(...LIGHT) ? 0 : b >= (LIGHT[1] + LIGHT[0]) / 2 / Math.hypot(...LIGHT) ? 1 : 2;
}
export const visible = (n: P3): boolean => dot(n, VIEW) > 1e-9;

/** SVG `matrix(...)` that draws 2D content given in (x, z) coordinates (z up) onto the plane y = y0: the face of a wall, a cut face. */
export const planeXZ = (y0: number, u: number, o: P2 = [0, 0]): string => `matrix(${C * u} ${0.5 * u} 0 ${-u} ${-C * u * y0 + o[0]} ${0.5 * u * y0 + o[1]})`;
/** The same for content in (y, z) coordinates on the plane x = x0 (a face that looks to the lower right). */
export const planeYZ = (x0: number, u: number, o: P2 = [0, 0]): string => `matrix(${-C * u} ${0.5 * u} 0 ${-u} ${C * u * x0 + o[0]} ${0.5 * u * x0 + o[1]})`;

/** The visible faces of a box, back to front: [right, left, top] with their tones. */
export function block(a: P3, b: P3, u: number, o: P2 = [0, 0]): Poly[] {
  const [x0, y0, z0] = a, [x1, y1, z1] = b, P = (x: number, y: number, z: number) => isoAt([x, y, z], u, o);
  return [
    { tone: 2, pts: [P(x1, y0, z0), P(x1, y1, z0), P(x1, y1, z1), P(x1, y0, z1)] },
    { tone: 1, pts: [P(x0, y1, z0), P(x1, y1, z0), P(x1, y1, z1), P(x0, y1, z1)] },
    { tone: 0, pts: [P(x0, y0, z1), P(x1, y0, z1), P(x1, y1, z1), P(x0, y1, z1)] },
  ];
}

/** Outline points of shapes in a plane's own 2D coordinates. */
export function roundRectPts(cx: number, cz: number, w: number, h: number, r: number, n = 8): P2[] {
  const out: P2[] = [];
  const corners: [number, number, number][] = [[cx + w / 2 - r, cz - h / 2 + r, -90], [cx + w / 2 - r, cz + h / 2 - r, 0], [cx - w / 2 + r, cz + h / 2 - r, 90], [cx - w / 2 + r, cz - h / 2 + r, 180]];
  for (const [x, z, a0] of corners) for (let k = 0; k <= n; k++) { const a = ((a0 + (90 * k) / n) * Math.PI) / 180; out.push([x + r * Math.cos(a), z + r * Math.sin(a)]); }
  return out;
}
export const circlePts = (cx: number, cz: number, r: number, n = 48): P2[] => Array.from({ length: n }, (_, k) => [cx + r * Math.cos((k / n) * Math.PI * 2), cz + r * Math.sin((k / n) * Math.PI * 2)] as P2);

const area = (pts: readonly P2[]) => pts.reduce((s, p, i) => { const q = pts[(i + 1) % pts.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0) / 2;

/** A convex outline drawn in the plane y = y0 (coordinates (x, z)) and extruded to y = y1: the visible side faces with their tones, then the face at y1
    (or at y0 if that is the one turned to the viewer). A socket plate on a wall, a cut slab, a card standing in the scene. */
export function extrudeXZ(outline: readonly P2[], y0: number, y1: number, u: number, o: P2 = [0, 0]): Poly[] {
  const pts = area(outline) < 0 ? [...outline].reverse() : [...outline];
  const out: Poly[] = [];
  pts.forEach((p, i) => {
    const q = pts[(i + 1) % pts.length], n: P3 = [q[1] - p[1], 0, -(q[0] - p[0])];       // outward normal of a CCW edge in (x, z)
    if (!visible(n)) return;
    out.push({ tone: toneOf(n), pts: [isoAt([p[0], y0, p[1]], u, o), isoAt([q[0], y0, q[1]], u, o), isoAt([q[0], y1, q[1]], u, o), isoAt([p[0], y1, p[1]], u, o)] });
  });
  const front = y1 > y0 ? y1 : y0;
  out.push({ tone: 1, pts: pts.map((p) => isoAt([p[0], front, p[1]], u, o)) });
  return out;
}

/** Any outline (convex or not) in the plane y = y0, extruded to y1: every visible side face (back to front), then the front face. For thin shapes (a
    bent spring leaf, a bracket) where extrudeXZ's convex shortcut does not hold. */
export function extrudeAnyXZ(outline: readonly P2[], y0: number, y1: number, u: number, o: P2 = [0, 0]): Poly[] {
  const pts = area(outline) < 0 ? [...outline].reverse() : [...outline];
  const sides: (Poly & { key: number })[] = [];
  pts.forEach((p, i) => {
    const q = pts[(i + 1) % pts.length], n: P3 = [q[1] - p[1], 0, -(q[0] - p[0])];
    if (!visible(n)) return;
    sides.push({ key: p[0] + q[0] + p[1] + q[1], tone: toneOf(n), pts: [isoAt([p[0], y0, p[1]], u, o), isoAt([q[0], y0, q[1]], u, o), isoAt([q[0], y1, q[1]], u, o), isoAt([p[0], y1, p[1]], u, o)] });
  });
  sides.sort((a, b) => a.key - b.key);
  return [...sides.map(({ tone, pts: ps }) => ({ tone, pts: ps })), { tone: 1, pts: pts.map((p) => isoAt([p[0], Math.max(y0, y1), p[1]], u, o)) }];
}

/** A cylinder or a cone frustum from `a` (radius ra) to `b` (radius rb); `e1`, `e2` are unit vectors across the axis. Returns the visible body in tone
    bands, then the cap that faces the viewer. A plug, a pin, a cable end, a screw. */
export function cylinder(a: P3, b: P3, ra: number, rb: number, e1: P3, e2: P3, u: number, o: P2 = [0, 0], n = 48): Poly[] {
  const at = (c: P3, r: number, th: number): P3 => [c[0] + r * (Math.cos(th) * e1[0] + Math.sin(th) * e2[0]), c[1] + r * (Math.cos(th) * e1[1] + Math.sin(th) * e2[1]), c[2] + r * (Math.cos(th) * e1[2] + Math.sin(th) * e2[2])];
  const normal = (th: number): P3 => [Math.cos(th) * e1[0] + Math.sin(th) * e2[0], Math.cos(th) * e1[1] + Math.sin(th) * e2[1], Math.cos(th) * e1[2] + Math.sin(th) * e2[2]];
  const ths = Array.from({ length: n + 1 }, (_, k) => (k / n) * Math.PI * 2);
  const out: Poly[] = [];
  let run: number[] = [], runTone: Tone | null = null;
  const flush = () => {
    if (run.length > 1 && runTone !== null) out.push({ tone: runTone, pts: [...run.map((th) => isoAt(at(a, ra, th), u, o)), ...[...run].reverse().map((th) => isoAt(at(b, rb, th), u, o))] });
    run = []; runTone = null;
  };
  for (const th of ths) {
    const nn = normal(th);
    if (!visible(nn)) { flush(); continue; }
    const tn = toneOf(nn);
    if (runTone !== null && tn !== runTone) { const last = run[run.length - 1]; flush(); run = [last]; }
    runTone = tn; run.push(th);
  }
  flush();
  const axis: P3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const capAt = visible(axis) ? b : a, capR = visible(axis) ? rb : ra, capN: P3 = visible(axis) ? axis : [-axis[0], -axis[1], -axis[2]];
  out.push({ tone: toneOf(capN), pts: ths.slice(0, n).map((th) => isoAt(at(capAt, capR, th), u, o)) });
  return out;
}

export const ptsAttr = (pts: readonly P2[]): string => pts.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");

// ------------------------------------------------------------------------------------------------------------------------------------- the 2D camera
/** A 2D camera: it looks at `focus` (world px of the scene drawn at rest) with `zoom`. At rest (focus = the frame's middle, zoom 1) nothing moves. */
export type Cam2 = { x: number; y: number; zoom: number };
export const REST_CAM: Cam2 = { x: 540, y: 960, zoom: 1 };
export type Key2 = { t: number } & Cam2;

const smooth = (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
/** The camera at time `t` from keyframes (sorted by t): eased in and out between them, held before the first and after the last. Zoom is eased in log
    space so a push feels even. A key with the same time as the one before is a cut (only use one while the layer is hidden). */
export function cam2At(keys: readonly Key2[], t: number): Cam2 {
  if (!keys.length) return REST_CAM;
  if (t <= keys[0].t) return keys[0];
  for (let i = 1; i < keys.length; i++) {
    const a = keys[i - 1], b = keys[i];
    if (t < b.t) {
      const k = b.t > a.t ? smooth((t - a.t) / (b.t - a.t)) : 1;
      return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, zoom: Math.exp(Math.log(a.zoom) + (Math.log(b.zoom) - Math.log(a.zoom)) * k) };
    }
  }
  return keys[keys.length - 1];
}

/** A layer's view of the camera: depth `p` = 1 moves with it, below 1 is further away (moves and grows less), above 1 is nearer (foreground). */
export function layerCam(cam: Cam2, p: number): { s: number; fx: number; fy: number } {
  return { s: Math.exp(Math.log(cam.zoom) * p), fx: REST_CAM.x + (cam.x - REST_CAM.x) * p, fy: REST_CAM.y + (cam.y - REST_CAM.y) * p };
}
/** The SVG transform of a layer of depth `p`. */
export const layerTransform = (cam: Cam2, p = 1): string => { const l = layerCam(cam, p); return `translate(540 960) scale(${l.s}) translate(${-l.fx} ${-l.fy})`; };
/** Where a world px point of a layer of depth `p` is on the screen. */
export const toScreen = (cam: Cam2, pt: P2, p = 1): P2 => { const l = layerCam(cam, p); return [540 + l.s * (pt[0] - l.fx), 960 + l.s * (pt[1] - l.fy)]; };

/** A smooth SVG path through points (Catmull-Rom as cubic Beziers): current paths, leaves, cables in a plane's own coordinates. */
export function smoothPath(pts: readonly P2[], tension = 0.5): string {
  if (pts.length < 2) return "";
  let d = `M ${pts[0][0]} ${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)], k = tension / 3;
    d += ` C ${p1[0] + (p2[0] - p0[0]) * k} ${p1[1] + (p2[1] - p0[1]) * k} ${p2[0] - (p3[0] - p1[0]) * k} ${p2[1] - (p3[1] - p1[1]) * k} ${p2[0]} ${p2[1]}`;
  }
  return d;
}
