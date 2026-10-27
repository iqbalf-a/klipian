/* The orthographic camera of the spike (round "Three.js ortho", experiment): an OrthographicCamera that projects a 2.5D world point to the same
   video pixel as `isoAt(p, u, o)` (src/iso.ts), so the SVG labels, the captions and the layout manager can sit on top of a 3D layer unchanged.

   Axes. The 2.5D world has x to the lower right, y to the lower left (out of the wall, toward the viewer) and z up. Three.js is y-up, so a 2.5D
   point (x, y, z) is the three point (x, z, y): the 2.5D z becomes three's y (up), and the 2.5D y becomes three's z. The viewer sits along
   (1, 1, 1) (the same direction as `VIEW` in iso.ts), so the camera looks along -(1, 1, 1).

   Scale. The iso projection is isometric: its screen right is (1, -1, 0) / sqrt(2) and its screen down is (0.5, 0.5, -1) / sqrt(1.5), both
   scaled by s = u * sqrt(1.5) pixels per camera unit (u = px per world unit). The frustum is set so that one camera unit is s pixels, and the
   world origin lands on the screen point `o`. */
import * as THREE from "three";

export type IsoPoint = readonly [number, number, number];

/** A 2.5D world point as a three point: (x, y, z) -> (x, z, y). */
export const toThree = (p: IsoPoint): THREE.Vector3 => new THREE.Vector3(p[0], p[2], p[1]);

/** The orthographic camera for a frame of `width` x `height` pixels, `u` pixels per world unit, the world origin at the pixel `o`. */
export function makeIsoCamera(width: number, height: number, u: number, o: readonly [number, number], distance = 200): THREE.OrthographicCamera {
  const s = u * Math.sqrt(1.5);                                       // pixels per camera unit (the isometric scale), set as the camera's zoom
  // the frustum is the frame itself (react-three-fiber resets an orthographic frustum to the canvas size, so the scale goes in `zoom`), and the
  // camera looks at a point `c` chosen so that the world origin lands on the pixel `o`
  const cam = new THREE.OrthographicCamera(-width / 2, width / 2, height / 2, -height / 2, 0.1, 4 * distance);
  const dir = new THREE.Vector3(1, 1, 1).normalize();                 // from the scene toward the viewer (the 2.5D VIEW)
  const up = new THREE.Vector3(-0.5, 1, -0.5).normalize();            // the screen's up: minus the 2.5D screen-down vector, in three axes
  const right = new THREE.Vector3(1, 0, -1).normalize();              // the screen's right: the 2.5D screen-right (1, -1, 0), in three axes
  const c = right.clone().multiplyScalar((width / 2 - o[0]) / s).add(up.clone().multiplyScalar((o[1] - height / 2) / s));
  cam.zoom = s;
  cam.up.copy(up);
  cam.position.copy(c).add(dir.clone().multiplyScalar(distance));
  cam.lookAt(c);
  cam.updateProjectionMatrix();
  cam.updateMatrixWorld();
  return cam;
}

/** The pixel of a 2.5D world point through the camera (the same convention as the video: y down from the top). */
export function pixelOf(cam: THREE.OrthographicCamera, p: IsoPoint, width: number, height: number): [number, number] {
  const v = toThree(p).project(cam);
  return [((v.x + 1) / 2) * width, ((1 - v.y) / 2) * height];
}
