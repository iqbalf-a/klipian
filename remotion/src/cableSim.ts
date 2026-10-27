/* A hanging cable as a chain (round 5): a string of fixed length that follows its anchor (the plug's end), falls under gravity, lies on the floor,
   and keeps out of the wall and the plug's body. The world of the 2.5D scenes: z is UP, the wall is the plane y = `face` (the plate front), the plug
   sticks out along +y from the wall, and the floor is the plane z = `floorZ`. So gravity pulls the free nodes DOWN the z axis, and the cable hangs
   from the plug toward the floor.

   The method is position-based (no speed is carried from one frame to the next): each frame the stub is placed on the anchor, then the free nodes
   sink a little and are projected back onto their constraints, many times. The constraints are the link lengths (the cable does not stretch), a bend
   limit at each node, the first link within FIRST_BEND of the plug's axis, the floor, the wall and the plug's body (the cable rests on and does not
   pass through them). The motion is a pure function of the anchor path: fixed passes, no randomness, so every frame is the same on every render. The
   frames are computed once per video (`simulateCable`) and read back by time. */

export type V3 = [number, number, number];

/** The plug's body while it is in the socket: a round thing along y, centre (x, z), radius r, from y0 to y1 (it moves with the plug's gap). */
export type Body = { x: number; z: number; r: number; y0: number; y1: number };

export type CableSimOpts = {
  /** The anchor (the plug's end) in world units at time t (seconds). */
  anchor: (t: number) => V3;
  /** The plug's body at time t (null when there is none). */
  body?: (t: number) => Body | null;
  /** Seconds of the video, and frames per second: one array of nodes per frame. */
  duration: number;
  fps: number;
  /** The cable's fixed length (world units). It is longer than the straight distance it covers, so it has slack. */
  length: number;
  /** The nodes (default 24). */
  nodes?: number;
  /** The plug's axis at the anchor (a unit vector, +y): the first `stub` units leave along it. */
  axis: V3;
  stub?: number;
  /** The floor: the plane z = floorZ (the cable lies on it; it may lie past the floor's edges). */
  floorZ: number;
  /** The wall: the plane y = face, over the footprint [x0, x1] x [z0, z1]; the cable stays in front of it (y >= face). */
  wall?: { face: number; x0: number; x1: number; z0: number; z1: number };
  /** Seconds the chain settles before t = 0 (default 3). */
  settle?: number;
};

const SINK = 0.001;                    // how far a free node sinks (down the z axis) per relaxation pass (world units): the method's gravity
const PASSES = 320;                    // relaxation passes per frame
const MAX_BEND = 0.5;                  // the largest turn at one node (rad): the smallest bend radius is about seg / MAX_BEND
const FIRST_BEND = 0.2;                // the most the first free link may turn from the plug's axis (rad): the joint is tangent to the boot (round 6)
const NEAR_BEND = 0.2;                 // the turn per node for the first six free nodes after the stub (rad): the first bend is gentle, radius seg / NEAR_BEND
const sub3 = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot3 = (a: V3, b: V3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const unitOf = (a: V3): V3 => { const L = Math.hypot(a[0], a[1], a[2]) || 1e-9; return [a[0] / L, a[1] / L, a[2] / L]; };
const RADIUS = 0.04;                   // a node's half thickness

/** The nodes of the cable at every frame: frame f is at time f / fps. Deterministic: the same inputs give the same frames. */
export function simulateCable(o: CableSimOpts): V3[][] {
  const N = o.nodes ?? 24, seg = o.length / (N - 1), stub = Math.max(1, Math.round((o.stub ?? 0.45) / seg));
  const settle = o.settle ?? 3, frames = Math.round(o.duration * o.fps);
  const axis = o.axis, anchor0 = o.anchor(0);
  const pinned = (i: number, a: V3): V3 => [a[0] + axis[0] * seg * i, a[1] + axis[1] * seg * i, a[2] + axis[2] * seg * i];
  // the start: out along the plug's axis for the stub, then down toward the floor with a small sideways wave (so the slack curls on the floor
  // instead of lying straight); it settles during the warm-up
  const pos: V3[] = Array.from({ length: N }, (_, i) => (i <= stub
    ? pinned(i, anchor0)
    : [anchor0[0] + 0.3 * Math.sin((i - stub) * 0.9) - 0.12 * (i - stub), anchor0[1] - 0.3, anchor0[2] + axis[2] * seg * stub - seg * (i - stub)] as V3));

  const relax = (t: number, a: V3) => {
    pos[0] = [...a] as V3;
    for (let i = 1; i <= stub && i < N; i++) pos[i] = pinned(i, a);
    const body = o.body ? o.body(t) : null, wall = o.wall;
    for (let k = 0; k < PASSES; k++) {
      for (let i = stub + 1; i < N; i++) pos[i] = [pos[i][0], pos[i][1], pos[i][2] - SINK];   // gravity: the free nodes sink down the z axis
      // the obstacles: the floor (a node's z is at least floorZ + RADIUS), the wall (in its footprint a node stays in front of the face),
      // the plug's body (a node stays outside its round section while it is at the plug's height)
      for (let i = stub + 1; i < N; i++) {
        let [x, y, z] = pos[i];
        if (z < o.floorZ + RADIUS) z = o.floorZ + RADIUS;
        if (wall && x >= wall.x0 && x <= wall.x1 && z >= wall.z0 && z <= wall.z1 && y < wall.face + RADIUS) y = wall.face + RADIUS;
        if (body && y > body.y0 && y < body.y1) {
          const dx = x - body.x, dz = z - body.z, r = Math.hypot(dx, dz) || 1e-9;
          if (r < body.r) { x = body.x + (dx / r) * body.r; z = body.z + (dz / r) * body.r; }
        }
        pos[i] = [x, y, z];
      }
      // the lengths: each link is brought back to `seg`; a pinned end does not move, and the first free node is moved only by the stub's cone below
      for (let i = 0; i < N - 1; i++) {
        if (i + 1 <= stub) continue;
        const d: V3 = [pos[i + 1][0] - pos[i][0], pos[i + 1][1] - pos[i][1], pos[i + 1][2] - pos[i][2]];
        const L = Math.hypot(d[0], d[1], d[2]) || 1e-9, c = (L - seg) / L;
        const w = i <= stub + 1 ? 0 : 0.5, e = i <= stub + 1 ? 1 : 0.5;
        if (w > 0) pos[i] = [pos[i][0] + d[0] * c * w, pos[i][1] + d[1] * c * w, pos[i][2] + d[2] * c * w];
        pos[i + 1] = [pos[i + 1][0] - d[0] * c * e, pos[i + 1][1] - d[1] * c * e, pos[i + 1][2] - d[2] * c * e];
      }
      // the joint, walked outward from the stub: each of the first six links turns at most NEAR_BEND from the one before (the first from the plug's
      // axis, by FIRST_BEND), by moving the next node only: a tangent-continuous start and a gentle first bend, never a fold
      for (let i = stub; i < N - 1; i++) {
        const from: V3 = i === stub ? axis : unitOf(sub3(pos[i], pos[i - 1]));
        const v = unitOf(sub3(pos[i + 1], pos[i])), c = dot3(from, v), lim = i === stub ? FIRST_BEND : i < stub + 6 ? NEAR_BEND : MAX_BEND;
        if (c < Math.cos(lim)) {
          const perp = unitOf([v[0] - c * from[0], v[1] - c * from[1], v[2] - c * from[2]]), cs = Math.cos(lim), sn = Math.sin(lim);
          pos[i + 1] = [0, 1, 2].map((k) => pos[i][k] + (from[k] * cs + perp[k] * sn) * seg) as V3;
        }
      }
      // the bend limit: a free node stays within the deviation a MAX_BEND turn allows from the middle of its neighbours
      for (let i = stub + 1; i < N - 1; i++) {
        const p = pos[i], m: V3 = [(pos[i - 1][0] + pos[i + 1][0]) / 2, (pos[i - 1][1] + pos[i + 1][1]) / 2, (pos[i - 1][2] + pos[i + 1][2]) / 2];
        const d: V3 = [p[0] - m[0], p[1] - m[1], p[2] - m[2]], D = Math.hypot(d[0], d[1], d[2]);
        const maxDi = (seg / 2) * Math.tan((i <= stub + 6 ? NEAR_BEND : MAX_BEND) / 2);
        if (D > maxDi) pos[i] = [m[0] + d[0] * (maxDi / D), m[1] + d[1] * (maxDi / D), m[2] + d[2] * (maxDi / D)];
      }
    }
    // the obstacles hold for the frame as it is returned: the floor, the wall and the body are applied once more after the last pass
    for (let i = stub + 1; i < N; i++) {
      let [x, y, z] = pos[i];
      if (z < o.floorZ + RADIUS) z = o.floorZ + RADIUS;
      if (wall && x >= wall.x0 && x <= wall.x1 && z >= wall.z0 && z <= wall.z1 && y < wall.face + RADIUS) y = wall.face + RADIUS;
      if (body && y > body.y0 && y < body.y1) {
        const dx = x - body.x, dz = z - body.z, r = Math.hypot(dx, dz) || 1e-9;
        if (r < body.r) { x = body.x + (dx / r) * body.r; z = body.z + (dz / r) * body.r; }
      }
      pos[i] = [x, y, z];
    }
  };

  for (let s = 0; s < Math.round(settle * o.fps); s++) relax(0, anchor0);
  const out: V3[][] = [];
  for (let f = 0; f <= frames; f++) {
    const t = f / o.fps;
    relax(t, o.anchor(t));
    out.push(pos.map((p) => [...p] as V3));
  }
  return out;
}
