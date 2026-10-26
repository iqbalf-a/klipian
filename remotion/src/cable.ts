/* Cables are smooth curves (P28-A4): the story gives a route (points where the cable passes), and every corner of it is rounded
   with a cubic bezier, so there is no sharp corner anywhere; a long, mostly horizontal stretch sags a little, the way a hanging
   cable does. One shape for both worlds: the 2D scenes draw it as an SVG path (round joins and caps, constant thickness) and the
   3D scenes make a tube along the SAME curve. Pure maths, no drawing: `npm test` checks that the curve has no kinks. */

export type Pt = [number, number];
export type Seg = { kind: "L"; to: Pt } | { kind: "C"; c1: Pt; c2: Pt; to: Pt };
export type CableOptions = { corner?: number; sag?: number };

const add = (a: Pt, b: Pt): Pt => [a[0] + b[0], a[1] + b[1]];
const sub = (a: Pt, b: Pt): Pt => [a[0] - b[0], a[1] - b[1]];
const mul = (a: Pt, k: number): Pt => [a[0] * k, a[1] * k];
const len = (a: Pt): number => Math.hypot(a[0], a[1]);
const lerp = (a: Pt, b: Pt, t: number): Pt => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

const KAPPA = 0.5523;                 // a cubic bezier that draws a quarter circle

/** The segments of a cable through `route`. `corner` is the largest radius of a rounded corner (video px); `sag` is how far, as a
    fraction of its length, a mostly horizontal stretch hangs down in the middle (0 = taut). */
export function cableSegments(route: readonly Pt[], opts: CableOptions = {}): { start: Pt; segs: Seg[] } {
  const corner = opts.corner ?? 240, sag = opts.sag ?? 0.03;
  const pts = route.filter((p, i) => i === 0 || len(sub(p, route[i - 1])) > 0.5);
  if (pts.length < 2) return { start: pts[0] ?? [0, 0], segs: [] };
  const segs: Seg[] = [];
  let cursor: Pt = pts[0];
  const straight = (to: Pt) => {
    const d = sub(to, cursor), L = len(d);
    if (L < 1) return;
    const hang = Math.abs(d[0]) > Math.abs(d[1]) * 1.5 && L > 160 ? L * sag : 0;      // sag only where it hangs: long and mostly horizontal
    if (hang > 0) {
      // two cubics through the lowest point in the middle, both ends leaving horizontally, so the sag meets the corners without a kink
      const mid = add(lerp(cursor, to, 0.5), [0, hang]);
      const h1 = mul(sub(mid, cursor), 0.5 * 0.8), h2 = mul(sub(to, mid), 0.5 * 0.8);
      segs.push({ kind: "C", c1: add(cursor, [h1[0], 0]), c2: sub(mid, [h1[0], 0]), to: mid });
      segs.push({ kind: "C", c1: add(mid, [h2[0], 0]), c2: sub(to, [h2[0], 0]), to });
    } else segs.push({ kind: "L", to });
    cursor = to;
  };
  for (let i = 1; i < pts.length - 1; i++) {
    const p = pts[i], a = pts[i - 1], b = pts[i + 1];
    const da = sub(a, p), db = sub(b, p);
    const r = Math.min(corner, len(da) / 2, len(db) / 2);
    const ua = mul(da, 1 / len(da)), ub = mul(db, 1 / len(db));
    const before = add(p, mul(ua, r)), after = add(p, mul(ub, r));
    straight(before);
    // the corner: from `before` to `after`, leaving along the incoming direction and arriving along the outgoing one
    segs.push({ kind: "C", c1: add(before, mul(sub(p, before), KAPPA)), c2: add(after, mul(sub(p, after), KAPPA)), to: after });
    cursor = after;
  }
  straight(pts[pts.length - 1]);
  return { start: pts[0], segs };
}

const f = (n: number): string => (Math.round(n * 100) / 100).toString();

/** The SVG path of a cable (an `M` and then `L`/`C` segments: @remotion/paths can draw it on). */
export function cablePath(route: readonly Pt[], opts?: CableOptions): string {
  const { start, segs } = cableSegments(route, opts);
  return `M ${f(start[0])} ${f(start[1])} ` + segs.map((s) => s.kind === "L"
    ? `L ${f(s.to[0])} ${f(s.to[1])}`
    : `C ${f(s.c1[0])} ${f(s.c1[1])} ${f(s.c2[0])} ${f(s.c2[1])} ${f(s.to[0])} ${f(s.to[1])}`).join(" ");
}

/** Points along the same curve, about `step` px apart (for a 3D tube, and for the tests). */
export function cableSamples(route: readonly Pt[], opts?: CableOptions, step = 12): Pt[] {
  const { start, segs } = cableSegments(route, opts);
  const out: Pt[] = [start];
  let from = start;
  for (const s of segs) {
    if (s.kind === "L") {
      const n = Math.max(1, Math.round(len(sub(s.to, from)) / step));
      for (let i = 1; i <= n; i++) out.push(lerp(from, s.to, i / n));
    } else {
      const approx = len(sub(s.c1, from)) + len(sub(s.c2, s.c1)) + len(sub(s.to, s.c2));
      const n = Math.max(4, Math.round(approx / step));
      for (let i = 1; i <= n; i++) {
        const t = i / n, u = 1 - t;
        out.push([
          u * u * u * from[0] + 3 * u * u * t * s.c1[0] + 3 * u * t * t * s.c2[0] + t * t * t * s.to[0],
          u * u * u * from[1] + 3 * u * u * t * s.c1[1] + 3 * u * t * t * s.c2[1] + t * t * t * s.to[1],
        ]);
      }
    }
    from = s.to;
  }
  return out;
}

/** The sharpest turn along a sampled curve, in degrees between neighbouring steps (a smooth cable stays small). */
export function sharpestTurn(samples: readonly Pt[]): number {
  let worst = 0;
  for (let i = 1; i < samples.length - 1; i++) {
    const a = sub(samples[i], samples[i - 1]), b = sub(samples[i + 1], samples[i]);
    if (len(a) < 1e-6 || len(b) < 1e-6) continue;
    const cos = Math.max(-1, Math.min(1, (a[0] * b[0] + a[1] * b[1]) / (len(a) * len(b))));
    worst = Math.max(worst, (Math.acos(cos) * 180) / Math.PI);
  }
  return worst;
}
