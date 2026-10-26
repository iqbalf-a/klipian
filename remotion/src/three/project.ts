/* Where a world point lands on the screen through a rig view (a moving camera): labels and arrows that follow a part while the camera pushes, orbits or
   dollies. Pure (three's maths only, no WebGL, no React), so a test can check a layout frame by frame. Re-exported by common.tsx and the design barrel. */
import * as THREE from "three";
import { cameraFromView, type View } from "./rigMath.ts";

const W = 1080, H = 1920;
const cam = new THREE.PerspectiveCamera(20, W / H, 1, 400);
const v = new THREE.Vector3();

/** The video pixel of a WORLD point `p` (a part's object-unit position times its group's scale) seen through `view`, and whether it is in front of the camera. */
export function projectView(view: View, p: readonly [number, number, number]): { x: number; y: number; front: boolean } {
  const c = cameraFromView(view);
  cam.fov = view.fov;
  cam.position.set(...c.position);
  cam.lookAt(...c.target);
  cam.updateMatrixWorld();
  cam.updateProjectionMatrix();
  v.set(p[0], p[1], p[2]).project(cam);
  return { x: (v.x * 0.5 + 0.5) * W, y: (-v.y * 0.5 + 0.5) * H, front: v.z < 1 };
}

/** The screen box of a set of world points (the corners of a part's bounding box) through `view`. */
export function projectBox(view: View, pts: readonly (readonly [number, number, number])[]): { x0: number; y0: number; x1: number; y1: number } {
  const s = pts.map((p) => projectView(view, p));
  return { x0: Math.min(...s.map((q) => q.x)), y0: Math.min(...s.map((q) => q.y)), x1: Math.max(...s.map((q) => q.x)), y1: Math.max(...s.map((q) => q.y)) };
}

/** The 8 corners of a box [x0, y0, z0] .. [x1, y1, z1], scaled by `k` (object units -> world units). */
export const corners = (a: readonly [number, number, number], b: readonly [number, number, number], k = 1): [number, number, number][] =>
  [0, 1, 2, 3, 4, 5, 6, 7].map((i) => [(i & 1 ? b[0] : a[0]) * k, (i & 2 ? b[1] : a[1]) * k, (i & 4 ? b[2] : a[2]) * k]);
