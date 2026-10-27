/* The socket of the Three.js spike (experiment, see tests/isoThree.test.ts and src/IsoThreeDemo.tsx): the wall chunk on its shelf, the plate with a real
   round hole, the recess floor, two pin holes and the two pins as real geometry. Built in the 2.5D world units (src/iso.ts) and mapped to three
   with `toThree` (x, y, z) -> (x, z, y): a plate shape drawn in (x, z) and extruded along +y is a true extrusion along three's +z.
   Materials: a 3-step toon, the ISO plastic and metal tones (the same colours as the SVG kit, lit along the iso LIGHT, see IsoThreeDemo). */
import React from "react";
import * as THREE from "three";
import { ISO } from "../tokens.ts";
import { roundRectPts } from "../iso.ts";
import { toonGradient } from "./common.tsx";
import { toThree, type IsoPoint } from "./isoCamera.ts";

const SOCKET_Z = 0.5, PLATE_FRONT = 0.3, RECESS_FLOOR = 0.02, RECESS_R = 0.86, PIN_X = 0.4, PIN_R = 0.1, HOLE_R = 0.17;

/** The position of a 2.5D point in three's axes. */
export const at3 = (p: IsoPoint): [number, number, number] => { const v = toThree(p); return [v.x, v.y, v.z]; };

/** A toon material in an ISO tone (the colour string is the SVG kit's). */
export function Toon({ color }: { color: string }) {
  return <meshToonMaterial color={color} gradientMap={toonGradient()} />;
}

/** A box between two 2.5D corners. */
export function Box3({ a, b, color }: { a: IsoPoint; b: IsoPoint; color: string }) {
  const c: IsoPoint = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
  return <mesh position={at3(c)}><boxGeometry args={[b[0] - a[0], b[2] - a[2], b[1] - a[1]]} /><Toon color={color} /></mesh>;
}

/** A cylinder whose axis runs along the 2.5D y (out of the wall): from y0 to y1 at (x, z). */
export function CylY({ x, z, y0, y1, r0, r1 = r0, color, n = 32 }: { x: number; z: number; y0: number; y1: number; r0: number; r1?: number; color: string; n?: number }) {
  const c: IsoPoint = [x, (y0 + y1) / 2, z];
  return <mesh position={at3(c)} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[r1, r0, y1 - y0, n]} /><Toon color={color} /></mesh>;
}

/** The plate: the rounded square of the 2.5D plate (x, z), extruded from y 0 to the plate's front, with the recess hole cut through it. */
export function PlateWithHole() {
  const shape = React.useMemo(() => {
    const s = new THREE.Shape(roundRectPts(0, SOCKET_Z, 2.4, 2.4, 0.36).map(([x, z]) => new THREE.Vector2(x, z)));
    const hole = new THREE.Path();
    for (let i = 0; i < 64; i++) { const a = (i / 64) * Math.PI * 2; const x = RECESS_R * Math.cos(a), z = SOCKET_Z + RECESS_R * Math.sin(a); if (i === 0) hole.moveTo(x, z); else hole.lineTo(x, z); }
    s.holes.push(hole);
    return s;
  }, []);
  return <mesh><extrudeGeometry args={[shape, { depth: PLATE_FRONT, bevelEnabled: false, curveSegments: 24 }]} /><Toon color={ISO.plastic[0]} /></mesh>;
}

/** The socket: wall, shelf, plate, the recess floor (a disc in the hole), two pin holes (dark discs with a light rim), and two pins from the hole
    up to the plug's face at `gap` (the plug's face is at PLATE_FRONT + gap). The pins are real cylinders; the part in the hole is inside the
    hole's walls by construction (the hole is cut in the plate, the pin is smaller than the hole). */
export function IsoSocket3D({ gap }: { gap: number }) {
  const faceY = PLATE_FRONT + gap;
  return (
    <group>
      <Box3 a={[-2.1, -0.5, -2.35]} b={[2.1, 2.7, -2.05]} color={ISO.floor[0]} />
      <Box3 a={[-2.1, -0.55, -2.05]} b={[2.1, 0, 2.3]} color={ISO.wall[0]} />
      <PlateWithHole />
      {/* the floor of the recess, one tone darker than the plate face */}
      <mesh position={at3([0, RECESS_FLOOR, SOCKET_Z])}><circleGeometry args={[RECESS_R, 48]} /><Toon color={ISO.plastic[1]} /></mesh>
      {[-PIN_X, PIN_X].map((x) => (
        <group key={x}>
          <mesh position={at3([x, RECESS_FLOOR + 0.005, SOCKET_Z])}><circleGeometry args={[HOLE_R, 24]} /><Toon color={ISO.plastic[0]} /></mesh>
          <mesh position={at3([x, RECESS_FLOOR + 0.008, SOCKET_Z])}><circleGeometry args={[HOLE_R * 0.8, 24]} /><Toon color="rgb(40,40,40)" /></mesh>
          <CylY x={x} z={SOCKET_Z} y0={RECESS_FLOOR} y1={faceY} r0={PIN_R} color={ISO.metal[0]} n={24} />
        </group>
      ))}
    </group>
  );
}
