/* A hanging cable as a chain (round 4): a string of fixed length that follows its anchor (the plug's end), sinks under gravity, rests on the shelf
   and the plate, and keeps out of the plug's body. It leaves the anchor along the plug's axis for the first `stub` units, then bends where it falls.

   The method is position-based (no speed is carried from one frame to the next): each frame the stub is placed on the anchor, then the free nodes
   sink a little and are projected back onto their constraints, many times. The constraints are the link lengths (the cable does not stretch),
   a bend limit at each node (MAX_BEND, so no sharp corner), the first link within FIRST_BEND of the plug's axis (it never hangs back onto the
   stub), and the floor and the plug's body (the cable rests on them and does not pass through). The motion is a pure function of the anchor path:
   fixed passes, no randomness, so every frame is the same on every render. The frames are computed once per video (`simulateCable`) and read
   back by time. */

export type V3 = [number, number, number];

export type CableSimOpts = {
  /** The anchor (the plug's end) in world units at time t (seconds). */
  anchor: (t: number) => V3;
  /** Seconds of the video, and frames per second: one array of nodes per frame. */
  duration: number;
  fps: number;
  /** The cable's fixed length (world units). It is longer than the straight distance it covers, so it has slack. */
  length: number;
  /** The nodes (default 24). */
  nodes?: number;
  /** The plug's axis at the anchor (a unit vector): the first `stub` units leave along it. */
  axis: V3;
  stub?: number;
  /** The floor under (x, z): a height in world units (the shelf top, or the top of the plate). */
  ground: (x: number, z: number) => number;
  /** A round body the cable keeps out of (a vertical cylinder from y0 to y1, centre (x, z), radius r). */
  body?: { x: number; z: number; r: number; y0: number; y1: number };
  /** Seconds the chain settles before t = 0 (default 3). */
  settle?: number;
};

const SINK = 0.001;              // how far a free node sinks per relaxation pass (world units): the gravity of the method
const PASSES = 320;              // relaxation passes per frame
const MAX_BEND = 0.5;            // the largest turn at one node (rad): the smallest bend radius is about seg / MAX_BEND
const FIRST_BEND = Math.PI / 2;  // the most the first free link may turn from the plug's axis (rad): up or sideways, never back down
const RADIUS = 0.04;             // a node's half thickness, for the floor

/** The nodes of the cable at every frame: frame f is at time f / fps. Deterministic: the same inputs give the same frames. */
export function simulateCable(o: CableSimOpts): V3[][] {
  const N = o.nodes ?? 24, seg = o.length / (N - 1), stub = Math.max(1, Math.round((o.stub ?? 0.45) / seg));
  const settle = o.settle ?? 3, frames = Math.round(o.duration * o.fps);
  const axis = o.axis, anchor0 = o.anchor(0);
  const pinned = (i: number, a: V3): V3 => [a[0] + axis[0] * seg * i, a[1] + axis[1] * seg * i, a[2] + axis[2] * seg * i];
  // the start: out along the plug's axis for the stub, then level off to +x above the plug's body; it sinks and settles during the warm-up
  const pos: V3[] = Array.from({ length: N }, (_, i) => (i <= stub
    ? pinned(i, anchor0)
    : [anchor0[0] + axis[0] * seg * stub - seg * (i - stub) * 0.8, anchor0[1] + axis[1] * seg * stub, anchor0[2] + axis[2] * seg * stub + 0.35 * Math.sin((i - stub) * 0.9)] as V3));
  const maxD = (seg / 2) * Math.tan(MAX_BEND / 2);     // a node's deviation from the middle of its neighbours that a MAX_BEND turn allows

  const relax = (a: V3) => {
    pos[0] = [...a] as V3;
    for (let i = 1; i <= stub && i < N; i++) pos[i] = pinned(i, a);
    for (let k = 0; k < PASSES; k++) {
      for (let i = stub + 1; i < N; i++) pos[i] = [pos[i][0], pos[i][1] - SINK, pos[i][2]];   // gravity: the free nodes sink a little
      // the floor and the plug's body push the free nodes out; the shelf's ends are not walls (the cable may lie past them)
      for (let i = stub + 1; i < N; i++) {
        let [x, y, z] = pos[i];
        const h = o.ground(x, z) + RADIUS;
        if (y < h) y = h;
        if (o.body && y > o.body.y0 && y < o.body.y1) {
          const dx = x - o.body.x, dz = z - o.body.z, r = Math.hypot(dx, dz) || 1e-9;
          if (r < o.body.r) { x = o.body.x + (dx / r) * o.body.r; z = o.body.z + (dz / r) * o.body.r; }
        }
        pos[i] = [x, y, z];
      }
      // the lengths: each link is brought back to `seg`; a pinned end does not move
      for (let i = 0; i < N - 1; i++) {
        if (i + 1 <= stub) continue;
        const d: V3 = [pos[i + 1][0] - pos[i][0], pos[i + 1][1] - pos[i][1], pos[i + 1][2] - pos[i][2]];
        const L = Math.hypot(d[0], d[1], d[2]) || 1e-9, c = (L - seg) / L;
        const w = i <= stub + 1 ? 0 : 0.5, e = i <= stub + 1 ? 1 : 0.5;     // the stub and the first free node are owned by the stub and the cone: only the node after moves
        if (w > 0) pos[i] = [pos[i][0] + d[0] * c * w, pos[i][1] + d[1] * c * w, pos[i][2] + d[2] * c * w];
        pos[i + 1] = [pos[i + 1][0] - d[0] * c * e, pos[i + 1][1] - d[1] * c * e, pos[i + 1][2] - d[2] * c * e];
      }
      // the bend limit: a free node stays within the deviation a MAX_BEND turn allows from the middle of its neighbours
      for (let i = stub + 1; i < N - 1; i++) {
        const p = pos[i], m: V3 = [(pos[i - 1][0] + pos[i + 1][0]) / 2, (pos[i - 1][1] + pos[i + 1][1]) / 2, (pos[i - 1][2] + pos[i + 1][2]) / 2];
        const d: V3 = [p[0] - m[0], p[1] - m[1], p[2] - m[2]], D = Math.hypot(d[0], d[1], d[2]);
        if (D > maxD) pos[i] = [m[0] + d[0] * (maxD / D), m[1] + d[1] * (maxD / D), m[2] + d[2] * (maxD / D)];
      }
      // last of each pass: the first free link leaves the stub within FIRST_BEND of the plug's axis, so it never hangs back down onto the stub
      {
        const s0 = pos[stub], d: V3 = [pos[stub + 1][0] - s0[0], pos[stub + 1][1] - s0[1], pos[stub + 1][2] - s0[2]];
        const D = Math.hypot(d[0], d[1], d[2]) || 1e-9, u: V3 = [d[0] / D, d[1] / D, d[2] / D];
        const c = u[0] * axis[0] + u[1] * axis[1] + u[2] * axis[2];
        if (c < Math.cos(FIRST_BEND)) {
          const perp: V3 = [u[0] - c * axis[0], u[1] - c * axis[1], u[2] - c * axis[2]], P = Math.hypot(perp[0], perp[1], perp[2]) || 1e-9;
          const cs = Math.cos(FIRST_BEND), sn = Math.sin(FIRST_BEND);
          pos[stub + 1] = [0, 1, 2].map((k) => s0[k] + (axis[k] * cs + (perp[k] / P) * sn) * seg) as V3;
        }
      }
    }
  };

  for (let s = 0; s < Math.round(settle * o.fps); s++) relax(anchor0);
  const out: V3[][] = [];
  for (let f = 0; f <= frames; f++) {
    relax(o.anchor(f / o.fps));
    out.push(pos.map((p) => [...p] as V3));
  }
  return out;
}
