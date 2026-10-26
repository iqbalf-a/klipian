/* The 3D toon layer of a 2D scene (P28-A4): the main objects (wall socket, plug, the cutaway) are real 3D models with toon shading,
   the same palette and the same top-left light as Dissect3D, drawn by a transparent ThreeCanvas that sits between the 2D layers.
   One convention ties the two worlds together: the canvas covers the whole frame, the camera looks straight at the z = 0 plane from
   a distance where 100 video pixels = 1 world unit, so a thing placed at video pixel (x, y) with a size in video pixels lands where the
   2D version would. Models are built in "object units" (the reference sheet's units x 0.02: a socket plate is 2.4 wide) and a
   <Placed> group scales them to the story's `s` and puts them at (x, y), with a gentle orbit so they read as real objects. */
import React, { useMemo } from "react";
import { ThreeCanvas } from "@remotion/three";
import * as THREE from "three";
import { FRAME, SHEET_TO_VIDEO as K } from "../tokens.ts";

export const PX = 100;                                   // video pixels per world unit at the z = 0 plane
export const FOV = 20;
export const DIST = FRAME.height / (2 * PX * Math.tan((FOV * Math.PI) / 360));
export const UNIT = 0.02;                                // object units per sheet unit

export const toWorld = (x: number, y: number): [number, number] => [(x - FRAME.width / 2) / PX, -(y - FRAME.height / 2) / PX];
/** The scale that turns object units into world units for an item of story scale `s` (sheet unit -> K*s px -> /PX). */
export const objectScale = (s: number): number => (K * s) / UNIT / PX;

/** A gentle orbit and tilt, a function of the VIDEO's clock (so a thing that stays across beats, or sits inside the lens and then
    full-size, keeps turning the same way). `phase` makes two objects differ. */
export function orbitAt(clock: number, phase = 0, calm = false): { yaw: number; pitch: number } {
  const a = calm ? 0.5 : 1;
  return { yaw: THREE.MathUtils.degToRad(a * (13 * Math.sin(clock * 0.62 + phase) + 4)), pitch: THREE.MathUtils.degToRad(a * (4.5 * Math.sin(clock * 0.43 + phase * 1.7) - 2)) };
}

// --- flat-looking shading: a 3-step toon gradient, shared by every material -------------------------------------------------------
let gradient: THREE.DataTexture | null = null;
export function toonGradient(): THREE.DataTexture {
  if (!gradient) {
    gradient = new THREE.DataTexture(new Uint8Array([130, 195, 255]), 3, 1, THREE.RedFormat);
    gradient.minFilter = gradient.magFilter = THREE.NearestFilter;
    gradient.needsUpdate = true;
  }
  return gradient;
}

export const Mat: React.FC<{ color: string; emissive?: string }> = ({ color, emissive }) =>
  <meshToonMaterial color={color} gradientMap={toonGradient()} emissive={emissive ?? "#000000"} />;

/** A flat, unlit colour (glows, current dots). */
export const Flat: React.FC<{ color: string; opacity?: number }> = ({ color, opacity = 1 }) =>
  <meshBasicMaterial color={color} transparent={opacity < 1} opacity={opacity} depthWrite={opacity >= 1} />;

export const Lights: React.FC = () => (
  <>
    <ambientLight intensity={1.15} />
    <directionalLight position={[-6, 8, 7]} intensity={2.1} />
  </>
);

/** A transparent full-frame canvas for one 3D item. */
export const Host3D: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ThreeCanvas flat width={FRAME.width} height={FRAME.height} style={{ position: "absolute", inset: 0 }}
    camera={{ fov: FOV, near: 1, far: 400, position: [0, 0, DIST] }}>
    <Lights />
    {children}
  </ThreeCanvas>
);

/** Puts a model (in object units) at video pixel (x, y), at story scale `s`, turned by the orbit. */
export const Placed: React.FC<{ x: number; y: number; s: number; clock: number; phase?: number; calm?: boolean; children: React.ReactNode }> =
  ({ x, y, s, clock, phase = 0, calm, children }) => {
    const [wx, wy] = toWorld(x, y);
    const o = orbitAt(clock, phase, calm);
    const k = objectScale(s);
    return <group position={[wx, wy, 0]} rotation={[o.pitch, o.yaw, 0]} scale={k}>{children}</group>;
  };

// --- geometry helpers ---------------------------------------------------------------------------------------------------------------
export function roundedRect(w: number, h: number, r: number): THREE.Shape {
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.absarc(x + w - r, y + r, r, -Math.PI / 2, 0, false);
  s.lineTo(x + w, y + h - r); s.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2, false);
  s.lineTo(x + r, y + h); s.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI, false);
  s.lineTo(x, y + r); s.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false);
  return s;
}

/** An extruded shape centred on z = 0 (front face at +depth/2), optionally with a small bevel that catches the light. */
export function extrude(shape: THREE.Shape, depth: number, bevel = 0): THREE.BufferGeometry {
  const g = new THREE.ExtrudeGeometry(shape, {
    depth, bevelEnabled: bevel > 0, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 2, curveSegments: 18,
  });
  g.translate(0, 0, -depth / 2);
  return g;
}

export const useGeometry = <T extends THREE.BufferGeometry>(make: () => T): T => useMemo(make, []);   // models never change shape

// --- where a thing is on the screen: for labels and arrows that follow a 3D part ---------------------------------------------------
let projector: THREE.PerspectiveCamera | null = null;
/** The video pixel of a point of a 3D item. `local` is in SHEET units relative to the item's centre (z in sheet units too, towards the
    viewer positive). Mirrors <Placed>, so a label that follows a part stays on it while the object orbits. */
export function projectToScreen(x: number, y: number, s: number, clock: number, local: [number, number, number], phase = 0, calm = false, still = false): { x: number; y: number } {
  if (!projector) {
    projector = new THREE.PerspectiveCamera(FOV, FRAME.width / FRAME.height, 1, 400);
    projector.position.set(0, 0, DIST);
    projector.lookAt(0, 0, 0);
    projector.updateMatrixWorld();
    projector.updateProjectionMatrix();
  }
  const o = still ? { yaw: 0, pitch: 0 } : orbitAt(clock, phase, calm);
  const [wx, wy] = toWorld(x, y);
  const v = new THREE.Vector3(local[0] * UNIT, -local[1] * UNIT, local[2] * UNIT)
    .applyEuler(new THREE.Euler(o.pitch, o.yaw, 0)).multiplyScalar(objectScale(s)).add(new THREE.Vector3(wx, wy, 0)).project(projector);
  return { x: (v.x * 0.5 + 0.5) * FRAME.width, y: (-v.y * 0.5 + 0.5) * FRAME.height };
}
