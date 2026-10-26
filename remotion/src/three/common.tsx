/* The 3D toon layer of a 2D scene (P28-A4): the main objects (wall socket, plug, the cutaway) are real 3D models with toon shading,
   the same palette and the same top-left light as Dissect3D, drawn by a transparent ThreeCanvas that sits between the 2D layers.
   One convention ties the two worlds together: the canvas covers the whole frame, the camera looks straight at the z = 0 plane from
   a distance where 100 video pixels = 1 world unit, so a thing placed at video pixel (x, y) with a size in video pixels lands where the
   2D version would. Models are built in "object units" (the reference sheet's units x 0.02: a socket plate is 2.4 wide) and a
   <Placed> group scales them to the story's `s` and puts them at (x, y), with a gentle orbit so they read as real objects. */
import React, { createContext, useContext, useLayoutEffect, useMemo, useRef } from "react";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { FRAME, G2, G4, METAL, SHEET_TO_VIDEO as K } from "../tokens.ts";
import { cameraFromView, REST_VIEW, type View } from "./rigMath.ts";

export { REST_VIEW };
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

/** How the 3D models are drawn: "realistic" (default, P28-P: clean semi-realistic materials, small bevels, a soft key light from the top-left plus fill, soft
    self-shadows; the palette stays the guide) or "toon" (the flat three-step shading of A2-A4, kept for comparison and for old videos). */
export type Look = "realistic" | "toon";
export const LookContext = createContext<Look>("realistic");
/** The look a Host3D takes when it is not given one (a composition sets it for all its 3D items, e.g. FunFact's `look` prop). */
export const DefaultLookContext = createContext<Look>("realistic");

/** A surface in a palette colour. Matte plastic by default; the palette's metal colour is brass-like metal; `rough` and `metal` override. */
export const Mat: React.FC<{ color: string; emissive?: string; rough?: number; metal?: number; side?: THREE.Side }> = ({ color, emissive, rough, metal, side }) => {
  const look = useContext(LookContext);
  if (look === "toon") return <meshToonMaterial color={color} gradientMap={toonGradient()} emissive={emissive ?? "#000000"} side={side ?? THREE.FrontSide} />;
  const isMetal = metal ?? (color === METAL ? 0.85 : 0);
  return <meshStandardMaterial color={color} roughness={rough ?? (isMetal > 0.5 ? 0.34 : 0.62)} metalness={isMetal} emissive={emissive ?? "#000000"} envMapIntensity={isMetal > 0.5 ? 0.9 : 0.12} side={side ?? THREE.FrontSide} />;
};

/** A flat, unlit colour (glows, current dots). */
export const Flat: React.FC<{ color: string; opacity?: number }> = ({ color, opacity = 1 }) =>
  <meshBasicMaterial color={color} transparent={opacity < 1} opacity={opacity} depthWrite={opacity >= 1} />;

/** A small, soft environment (a lit room, made on the spot) so metal has something to reflect; plastic only picks up a little of it. */
const Environment: React.FC = () => {
  const { gl, scene } = useThree();
  useLayoutEffect(() => {
    const pm = new THREE.PMREMGenerator(gl);
    const env = pm.fromScene(new RoomEnvironment(), 0.04);
    const before = scene.environment;
    scene.environment = env.texture;
    scene.environmentIntensity = 0.22;                       // three 0.163+: the room lights every standard material by this much (a material's own envMapIntensity no longer counts)
    return () => { scene.environment = before; env.dispose(); pm.dispose(); };
  }, [gl, scene]);
  return null;
};

export const Lights: React.FC = () => {
  const look = useContext(LookContext);
  if (look === "toon") return (<><ambientLight intensity={1.15} /><directionalLight position={[-6, 8, 7]} intensity={2.1} /></>);
  // a soft key from the top-left (it casts soft shadows: the depth of holes, ridges and the plug in its socket), a fill from the right, a little sky
  return (
    <>
      <Environment />
      <hemisphereLight args={[G4, G2, 0.6]} />
      <directionalLight position={[-6, 8, 7]} intensity={1.3} castShadow shadow-mapSize={[2048, 2048]} shadow-radius={7} shadow-bias={-0.0004}
        shadow-camera-left={-14} shadow-camera-right={14} shadow-camera-top={14} shadow-camera-bottom={-14} shadow-camera-near={1} shadow-camera-far={40} />
      <directionalLight position={[7, -2, 5]} intensity={0.14} />
    </>
  );
};

/** Puts the camera where a view says (see rigMath.ts); the default view is the straight-on one the pixel mapping of Placed relies on. */
const RigCamera: React.FC<{ view: View }> = ({ view }) => {
  const camera = useThree((st) => st.camera) as THREE.PerspectiveCamera;
  useLayoutEffect(() => {
    const c = cameraFromView(view);
    camera.position.set(...c.position);
    camera.lookAt(...c.target);
    camera.fov = view.fov;
    camera.updateProjectionMatrix();
  }, [camera, view]);
  return null;
};

/** A transparent full-frame canvas for one 3D item. `rig` moves the camera (push, orbit, dolly, macro: see DESIGN.md); `look` picks the shading. */
export const Host3D: React.FC<{ children: React.ReactNode; look?: Look; rig?: View }> = ({ children, look: given, rig }) => {
  const look = given ?? useContext(DefaultLookContext);
  return (
  <ThreeCanvas flat shadows={look === "realistic" ? "soft" : false} width={FRAME.width} height={FRAME.height} style={{ position: "absolute", inset: 0 }}
    camera={{ fov: FOV, near: 1, far: 400, position: [0, 0, DIST] }}>
    <LookContext.Provider value={look}>
      <Lights />
      {rig && <RigCamera view={rig} />}
      {children}
    </LookContext.Provider>
  </ThreeCanvas>
  );
};

/** A group whose surfaces cast and receive the key light's soft shadows (the depth of holes, ridges and parts in front of each other). */
export const Shadowing: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const ref = useRef<THREE.Group>(null);
  useLayoutEffect(() => { ref.current?.traverse((m) => { const mesh = m as THREE.Mesh; if (mesh.isMesh && !(mesh.material as THREE.Material).transparent) { mesh.castShadow = true; mesh.receiveShadow = true; } }); });
  return <group ref={ref}>{children}</group>;
};

/** Puts a model (in object units) at video pixel (x, y), at story scale `s`, turned by the orbit. */
export const Placed: React.FC<{ x: number; y: number; s: number; clock: number; phase?: number; calm?: boolean; children: React.ReactNode }> =
  ({ x, y, s, clock, phase = 0, calm, children }) => {
    const [wx, wy] = toWorld(x, y);
    const o = orbitAt(clock, phase, calm);
    const k = objectScale(s);
    const ref = useRef<THREE.Group>(null);
    useLayoutEffect(() => { ref.current?.traverse((m) => { const mesh = m as THREE.Mesh; if (mesh.isMesh && !(mesh.material as THREE.Material).transparent) { mesh.castShadow = true; mesh.receiveShadow = true; } }); });
    return <group ref={ref} position={[wx, wy, 0]} rotation={[o.pitch, o.yaw, 0]} scale={k}>{children}</group>;
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

export { projectView, projectBox, corners } from "./project.ts";
