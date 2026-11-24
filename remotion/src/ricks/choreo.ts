/* Choreography for the stick cast (B55): ONE action authored as curves over time, the way the strongest test clip did it, instead of easing from named
   pose to named pose. Plain TypeScript (no React, no three), ported from that clip: `sampler` (smooth keyframe curves that never overshoot between keys),
   `footTrack` (where each foot is in the world, with an arc while it is lifted), `legIK` (knee from hip and foot) and `choreoAt`, which turns the tracks
   into a rig `Pose` plus the hip's world x and a hop, so `StickHero` can draw it. Camera: `camTrack`. Time: `warpTable` (slow motion on an impact). */
import { HIP_L, HIP_R, SHIN, THIGH, type Pose } from "./rig.ts";

const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const smooth = (t: number) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
export const easeOut = (t: number) => { t = clamp(t, 0, 1); return 1 - Math.pow(1 - t, 3); };

/** A smooth curve through keys [[seconds, value], ...] (monotone Hermite: no overshoot between two keys, a flat tangent at every turn). Held before the first and after the last. */
export function sampler(keys: [number, number][]): (t: number) => number {
  const n = keys.length, d: number[] = [], m: number[] = [];
  for (let i = 0; i < n - 1; i++) d.push((keys[i + 1][1] - keys[i][1]) / (keys[i + 1][0] - keys[i][0]));
  for (let i = 0; i < n; i++) {
    if (i === 0 || i === n - 1) m.push(0);
    else { const a = d[i - 1], b = d[i]; m.push(a * b <= 0 ? 0 : (2 * a * b) / (a + b)); }
  }
  return (t) => {
    if (t <= keys[0][0]) return keys[0][1];
    if (t >= keys[n - 1][0]) return keys[n - 1][1];
    let i = 0;
    while (i < n - 2 && t > keys[i + 1][0]) i++;
    const t0 = keys[i][0], h = keys[i + 1][0] - t0, s = (t - t0) / h, s2 = s * s, s3 = s2 * s;
    return (2 * s3 - 3 * s2 + 1) * keys[i][1] + (s3 - 2 * s2 + s) * h * m[i] + (-2 * s3 + 3 * s2) * keys[i + 1][1] + (s3 - s2) * h * m[i + 1];
  };
}

/** One foot move: [from s, to s, x from, x to, lift from, lift to, arc height, "out" for a slide that slows to a stop]. */
export type Move = [number, number, number, number, number, number, number, ("out" | "smooth")?];
/** Where a foot is over time: stands at `x0` until its first move, then each move in turn (an arc of `arc` metres while it is in the air). Returns [x, lift]. */
export function footTrack(x0: number, moves: Move[]): (t: number) => [number, number] {
  return (t) => {
    let x = x0, y = 0;
    for (const [t0, t1, xa, xb, ya, yb, arc, ez] of moves) {
      if (t >= t1) { x = xb; y = yb; continue; }
      if (t >= t0) {
        const s = (t - t0) / (t1 - t0), e = ez === "out" ? easeOut(s) : smooth(s);
        return [lerp(xa, xb, e), lerp(ya, yb, e) + arc * Math.sin(Math.PI * s)];
      }
      break;
    }
    return [x, y];
  };
}

/** Alternating steps for a walk or a run, for both feet: `n` steps of `stride` metres starting at `t0`, one every `dt` seconds (right foot first). */
export function strides(xr: number, xl: number, n: number, stride: number, t0: number, dt: number, arc = 0.12, air = 1): { r: Move[]; l: Move[]; xr: number; xl: number } {
  const r: Move[] = [], l: Move[] = [];
  let ar = xr, al = xl;
  for (let i = 0; i < n; i++) {
    const right = i % 2 === 0, from = right ? ar : al, to = Math.max(ar, al) + stride;
    (right ? r : l).push([t0 + i * dt, t0 + i * dt + dt * air, from, to, 0, 0, arc]);
    if (right) ar = to; else al = to;
  }
  return { r, l, xr: ar, xl: al };
}

// ---- the leg in metres, for a figure `h` metres tall (the cast is drawn 1024 px tall) ----
const pxm = (h: number) => h / 1024;
export const legLen = (h = 1.7) => ({ thigh: THIGH * pxm(h), shin: SHIN * pxm(h), hipDx: ((HIP_R.x - HIP_L.x) / 2) * pxm(h) });
type P2 = [number, number];
/** Two-bone IK: the knee (it always bends toward +x) and ankle for a hip and a foot target; out of reach the leg stretches straight. */
export function legIK(hip: P2, foot: P2, a: number, b: number): { knee: P2; ankle: P2 } {
  let dx = foot[0] - hip[0], dy = foot[1] - hip[1], d = Math.hypot(dx, dy);
  const mx = (a + b) * 0.9995;
  if (d > mx) { dx *= mx / d; dy *= mx / d; d = mx; }
  d = Math.max(d, Math.abs(a - b) + 1e-3);
  const along = (a * a - b * b + d * d) / (2 * d), hh = Math.sqrt(Math.max(0, a * a - along * along));
  const ux = dx / d, uy = dy / d;
  let px = -uy, py = ux;
  if (px < 0) { px = -px; py = -py; }
  return { knee: [hip[0] + ux * along + px * hh, hip[1] + uy * along + py * hh], ankle: [hip[0] + dx, hip[1] + dy] };
}

/** One action as curves. Lengths in metres (x grows toward the way the person faces), angles in degrees measured from straight down toward +x, hip height as a fraction of the straight leg. */
export type Choreo = {
  /** the right and left foot: world x of the hip centre follows their mean */
  footR: (t: number) => [number, number]; footL: (t: number) => [number, number];
  hipFrac: (t: number) => number;       // 1 = hips as high as the straight legs allow; lower = crouched
  lean: (t: number) => number;          // torso lean, degrees, toward +x
  rSh: (t: number) => number; rEl: (t: number) => number; lSh: (t: number) => number; lEl: (t: number) => number;   // arms in WORLD angles (the leaned torso is subtracted for you)
  lift?: (t: number) => number;         // metres the whole body is off the ground (a jump)
  /** the arm curves are angles in the leaned torso's own frame (a gun held in both hands keeps its place while the torso leans), not world angles */
  armsFrame?: boolean;
  /** the hip centre's world x, when it is not the mean of the feet (walking: the hip moves at a steady pace while each planted foot stays where it landed) */
  hipX?: (t: number) => number;
};
export type ChoreoOut = { pose: Pose; x: number; hop: number; lift: number; feet: { r: P2; l: P2 }; ankles: { r: P2; l: P2 } };

/** The pose, the hip centre's world x and the hop (fraction of the height) at time t. `h` is the figure's height in metres. */
export function choreoAt(c: Choreo, t: number, h = 1.7): ChoreoOut {
  const { thigh, shin, hipDx } = legLen(h), reachMax = (thigh + shin) * 0.9995;
  const lift = c.lift ? c.lift(t) : 0;
  const fr = c.footR(t), fl = c.footL(t);
  const R: P2 = [fr[0], fr[1] + lift], L: P2 = [fl[0], fl[1] + lift];
  const hx = c.hipX ? c.hipX(t) : (R[0] + L[0]) / 2;
  let hy = c.hipFrac(t) * reachMax;
  for (const [f, off] of [[R, hipDx], [L, -hipDx]] as [P2, number][]) {   // the hip is never higher than a straight leg to that foot allows
    const dx = f[0] - (hx + off);
    hy = Math.min(hy, f[1] + Math.sqrt(Math.max(0, reachMax * reachMax - dx * dx)));
  }
  const kr = legIK([hx + hipDx, hy], R, thigh, shin), kl = legIK([hx - hipDx, hy], L, thigh, shin);
  const ang = (hip: P2, k: P2, a: P2) => {
    const th = (Math.atan2(k[0] - hip[0], hip[1] - k[1]) * 180) / Math.PI, sh = (Math.atan2(a[0] - k[0], k[1] - a[1]) * 180) / Math.PI;
    return { hip: th, kn: th - sh };
  };
  const ar = ang([hx + hipDx, hy], kr.knee, kr.ankle), al = ang([hx - hipDx, hy], kl.knee, kl.ankle);
  const lean = c.lean(t);
  const pose: Pose = {
    rHip: ar.hip, rKn: ar.kn, lHip: al.hip, lKn: al.kn, lean,
    rSh: c.rSh(t) + (c.armsFrame ? 0 : lean), rEl: c.rEl(t),
    lSh: -(c.lSh(t) + (c.armsFrame ? 0 : lean)), lEl: -c.lEl(t),   // the left arm's angles grow toward -x in the rig; mirrored so both arms swing the same way
  };
  return { pose, x: hx, hop: lift / h, lift, feet: { r: R, l: L }, ankles: { r: kr.ankle, l: kl.ankle } };
}

// ---- camera ----
export type CamKey = [number, number, number, number, number, number, number];   // [t, px, py, pz, lx, ly, lz]
/** A camera track: position and look-at point each on their own smooth curve over the keys, so the camera follows the action and never stops dead between shots. */
export function camTrack(keys: CamKey[]): (t: number) => { pos: [number, number, number]; look: [number, number, number] } {
  const s = [1, 2, 3, 4, 5, 6].map((i) => sampler(keys.map((k) => [k[0], k[i]] as [number, number])));
  return (t) => ({ pos: [s[0](t), s[1](t), s[2](t)], look: [s[3](t), s[4](t), s[5](t)] });
}

/** Slow motion: `speed(t)` is the playback speed at story time t (1 = normal); returns story time for a real time (seconds), integrated once. */
export function warpTable(speed: (t: number) => number, total: number, fps: number, tail = 8): (real: number) => number {
  const dt = 1 / (fps * 4), tab: number[] = [0];
  let T = 0;
  for (let i = 0; i < Math.ceil((total + tail) / dt); i++) { T += dt * speed(T); tab.push(T); }
  return (real) => { const k = clamp(real / dt, 0, tab.length - 1), i = Math.floor(k); return lerp(tab[i], tab[Math.min(i + 1, tab.length - 1)], k - i); };
}
/** A speed dip around `at`: `depth` (0..1) slower, in over `rise` s, out over `fall` s. */
export const slowAround = (at: number, depth = 0.7, rise = 0.15, fall = 0.35, lead = 0.35) => (T: number) =>
  1 - depth * smooth((T - (at - lead)) / rise) * (1 - smooth((T - (at + 0.3)) / fall));

/** Arm swing for a walk or run, keyed to the same steps as `strides`: the arm opposite the stepping foot goes forward. Returns [right arm keys, left arm keys] around `base` degrees. */
export function armSwing(t0: number, dt: number, n: number, amp: number, base = 12): { r: [number, number][]; l: [number, number][] } {
  const r: [number, number][] = [[t0 - dt, base]], l: [number, number][] = [[t0 - dt, base]];
  for (let i = 0; i <= n; i++) { const right = i % 2 === 0; r.push([t0 + i * dt, base + (right ? -amp : amp)]); l.push([t0 + i * dt, base + (right ? amp : -amp)]); }
  return { r, l };
}
/** keys joined in time: later keys win where they overlap (so a march and what follows it are one curve) */
export const joinKeys = (...parts: [number, number][][]): [number, number][] => parts.flat().sort((a, b) => a[0] - b[0]);

/** A walk or a jog along the hip path `hip(t)` (x grows the way the person faces) from `ta` to `tb`: the hip moves as the path says, each foot lands `stride/2` ahead of the hip and stays planted until its next step,
   so feet never slide whatever the pace (steady, eased in and out, stopping). Steps where the hip hardly moves are skipped. `lead` starts the first step before `ta` (mid-stride at the first frame). */
export function locomote(hip: (t: number) => number, ta: number, tb: number, kind: "walk" | "jog", lead = 0, armBase = 12): Choreo {
  const [stride, dt, air, amp, elb, lean, hf, arc] = kind === "walk" ? [0.55, 0.5, 1.0, 24, 14, 6, 0.97, 0.09] : [0.55, 0.2, 1.3, 50, 75, 14, 0.92, 0.18];
  const mv: [Move[], Move[]] = [[], []], last = [NaN, NaN];
  let steps = 0;
  for (let i = 0; ; i++) {
    const s = ta - lead + i * dt;
    if (s >= tb) break;
    steps = i + 1;
    const e = s + dt * air;
    if (Math.abs(hip(e) - hip(s)) < 0.04) continue;
    const k = i % 2, land = hip(e) + stride / 2;
    mv[k].push([s, e, Number.isNaN(last[k]) ? hip(s) - stride / 2 : last[k], land, 0, 0, arc]);
    last[k] = land;
  }
  const x0 = (k: number) => mv[k][0]?.[2] ?? hip(ta) + (k ? -0.06 : 0.06);
  const sw = armSwing(ta - lead, dt, steps, amp, armBase), rel = [[tb + 0.5, armBase]] as [number, number][];
  const kr = joinKeys(sw.r, rel), kl = joinKeys(sw.l, rel);
  const ramp = (v: number, rest: number): [number, number][] => [[ta - lead - 0.5, lead > 0 ? v : rest], [ta + 0.2, v], [tb, v], [tb + 0.5, rest]];
  return {
    footR: footTrack(x0(0), mv[0]), footL: footTrack(x0(1), mv[1]), hipX: hip,
    hipFrac: sampler(ramp(hf, 0.97)), lean: sampler(ramp(lean, 2)),
    rSh: sampler(kr), lSh: sampler(kl), rEl: sampler(ramp(elb, 8)), lEl: sampler(ramp(elb, 8)),
  };
}
