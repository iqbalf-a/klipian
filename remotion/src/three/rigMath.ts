/* The camera rig of the 3D layer (P28-P): a view (where the camera looks, from how far, from which angle) and shots that move between views, so a scene can be
   ONE continuous object: push in, orbit, dolly through into the cutaway, a macro close-up. Pure maths (no three, no React): `npm test` checks it.
   The rest view looks straight at the z = 0 plane from DIST, so 100 video pixels = 1 world unit, as Placed expects (common.tsx). */
export type View = {
  target: [number, number, number];     // the point the camera looks at (world units)
  dist: number;                         // how far from it
  yaw: number;                          // degrees around the vertical axis (0 = straight on, positive = from the right)
  pitch: number;                        // degrees above the horizon (positive = from above)
  fov: number;                          // degrees
};

const FRAME_H = 1920, PX = 100, FOV = 20;
export const REST_VIEW: View = { target: [0, 0, 0], dist: FRAME_H / (2 * PX * Math.tan((FOV * Math.PI) / 360)), yaw: 0, pitch: 0, fov: FOV };

export type Shot = {
  t0: number; t1: number;               // seconds (into the beat or the video: whatever clock you pass to viewAt)
  to: Partial<View>;                    // where the shot ends (what it leaves out stays as it was at its start)
  ease?: "linear" | "inout" | "out";
  kind?: "push" | "orbit" | "dolly" | "macro" | "hold";   // a name for the reader: they all do the same, the numbers differ
};

const ease = (name: Shot["ease"], x: number): number => {
  const k = Math.max(0, Math.min(1, x));
  if (name === "linear") return k;
  if (name === "out") return 1 - Math.pow(1 - k, 3);
  return k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;      // inout (the default): a camera that starts and stops softly
};

/** The view at time `t`: from `start`, each shot in turn moves it to its `to` (what a shot does not name stays). Before the first shot it is `start`; after the
    last one it stays where it ended. Shots may not overlap (a later one starts from where the earlier one ended). */
export function viewAt(shots: readonly Shot[], t: number, start: View = REST_VIEW): View {
  let v = { ...start, target: [...start.target] as View["target"] };
  for (const s of [...shots].sort((a, b) => a.t0 - b.t0)) {
    const end: View = { ...v, ...s.to, target: (s.to.target ?? v.target) as View["target"] };
    if (t <= s.t0) return v;
    const k = s.t1 <= s.t0 ? 1 : ease(s.ease, (t - s.t0) / (s.t1 - s.t0));
    const mix = (a: number, b: number) => a + (b - a) * k;
    const here: View = { target: [mix(v.target[0], end.target[0]), mix(v.target[1], end.target[1]), mix(v.target[2], end.target[2])], dist: mix(v.dist, end.dist), yaw: mix(v.yaw, end.yaw), pitch: mix(v.pitch, end.pitch), fov: mix(v.fov, end.fov) };
    if (t < s.t1) return here;
    v = end;
  }
  return v;
}

/** The camera for a view: its position (on a sphere round the target) and the point it looks at. */
export function cameraFromView(v: View): { position: [number, number, number]; target: [number, number, number] } {
  const yaw = (v.yaw * Math.PI) / 180, pitch = (v.pitch * Math.PI) / 180;
  return {
    position: [v.target[0] + v.dist * Math.cos(pitch) * Math.sin(yaw), v.target[1] + v.dist * Math.sin(pitch), v.target[2] + v.dist * Math.cos(pitch) * Math.cos(yaw)],
    target: v.target,
  };
}

/** A few shots by name, for the common moves (all relative to the rest view's distance): push in by `by` (1 = no change, 0.5 = half the distance), orbit by degrees,
    dolly the target to a point, macro = very close. Each returns a Shot to put in a list. */
export const shots = {
  push: (t0: number, t1: number, by: number): Shot => ({ t0, t1, kind: "push", to: { dist: REST_VIEW.dist * by } }),
  orbit: (t0: number, t1: number, yaw: number, pitch = 0): Shot => ({ t0, t1, kind: "orbit", to: { yaw, pitch } }),
  dolly: (t0: number, t1: number, target: [number, number, number], by?: number): Shot => ({ t0, t1, kind: "dolly", to: by === undefined ? { target } : { target, dist: REST_VIEW.dist * by } }),
  macro: (t0: number, t1: number, target: [number, number, number]): Shot => ({ t0, t1, kind: "macro", ease: "out", to: { target, dist: REST_VIEW.dist * 0.18 } }),
  hold: (t0: number, t1: number): Shot => ({ t0, t1, kind: "hold", to: {} }),
};

/** How fast the camera moves at `t` (world units per second plus degrees per second, summed): a scene turns motion blur on when this is high. */
export function speedAt(list: readonly Shot[], t: number, start: View = REST_VIEW, dt = 1 / 60): number {
  const a = viewAt(list, t - dt, start), b = viewAt(list, t + dt, start);
  const d = Math.hypot(b.target[0] - a.target[0], b.target[1] - a.target[1], b.target[2] - a.target[2]) + Math.abs(b.dist - a.dist) * 0.05 + Math.abs(b.yaw - a.yaw) * 0.05 + Math.abs(b.pitch - a.pitch) * 0.05;
  return d / (2 * dt);
}
