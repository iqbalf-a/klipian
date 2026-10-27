/* The socket of the Three.js spike (round 2): the wall chunk on its shelf, the plate with a real round hole, the recess floor, two pin holes, the two
   pins and the earth clips as real geometry, the yellow plate outline (a flat ribbon on the plate front, with the same flash as PlateHighlight), the
   heat glow rings and the scorch tint. Built in the 2.5D world units (src/iso.ts), mapped to three with `at3` ((x, y, z) -> (x, z, y)). Every
   part takes its ISO kind (src/three/isoTone.ts): three flat tones by face normal, no lighting. */
import React from "react";
import * as THREE from "three";
import { HOT1, HOT2, YELLOW, ISO } from "../tokens.ts";
import { roundRectPts } from "../iso.ts";
import { toneMaterial } from "./isoTone.ts";
import { toThree, type IsoPoint } from "./isoCamera.ts";

export const SOCKET_Z = 0.5, PLATE_FRONT = 0.3, RECESS_FLOOR = 0.02, RECESS_R = 0.86, PIN_X = 0.4, PIN_R = 0.1, HOLE_R = 0.17;

/** The position of a 2.5D point in three's axes. */
export const at3 = (p: IsoPoint): [number, number, number] => { const v = toThree(p); return [v.x, v.y, v.z]; };

type Kind = keyof typeof ISO;
/** A tone material of an ISO kind, memoised per kind and tint (the scorch changes the plate's tint with `scorch`). */
export function Tone({ kind, tint, amount = 0 }: { kind: Kind; tint?: string; amount?: number }) {
  const mat = React.useMemo(() => toneMaterial(kind, tint ? new THREE.Color(tint) : undefined, amount), [kind, tint, amount]);
  return <primitive object={mat} attach="material" />;
}

/** A box between two 2.5D corners. */
export function Box3({ a, b, kind, tint, amount }: { a: IsoPoint; b: IsoPoint; kind: Kind; tint?: string; amount?: number }) {
  const c: IsoPoint = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
  return <mesh position={at3(c)}><boxGeometry args={[b[0] - a[0], b[2] - a[2], b[1] - a[1]]} /><Tone kind={kind} tint={tint} amount={amount} /></mesh>;
}

/** A cylinder whose axis runs along the 2.5D y (out of the wall): from y0 to y1 at (x, z), radii r0 at y0 and r1 at y1. */
export function CylY({ x, z, y0, y1, r0, r1 = r0, kind, n = 32 }: { x: number; z: number; y0: number; y1: number; r0: number; r1?: number; kind: Kind; n?: number }) {
  const c: IsoPoint = [x, (y0 + y1) / 2, z];
  return <mesh position={at3(c)} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[r1, r0, y1 - y0, n]} /><Tone kind={kind} /></mesh>;
}

/** A flat disc in the plane y = y (the 2.5D plane), centred at (x, z). */
export function DiscAt({ x, y, z, r, kind, n = 48, opacity = 1, color }: { x: number; y: number; z: number; r: number; kind?: Kind; n?: number; opacity?: number; color?: string }) {
  return (
    <mesh position={at3([x, y, z])}>
      <circleGeometry args={[r, n]} />
      {color ? <meshBasicMaterial color={color} transparent opacity={opacity} depthWrite={false} /> : <Tone kind={kind!} />}
    </mesh>
  );
}

/** The plate: the rounded square of the 2.5D plate (x, z), extruded from y 0 to the plate's front, with the recess hole cut through it. The scorch
    darkens its tint (the plate turns brown round the recess, as the SVG kit's `scorch`). */
export function PlateWithHole() {
  const shape = React.useMemo(() => {
    const s = new THREE.Shape(roundRectPts(0, SOCKET_Z, 2.4, 2.4, 0.36).map(([x, z]) => new THREE.Vector2(x, z)));
    const hole = new THREE.Path();
    for (let i = 0; i < 64; i++) { const a = (i / 64) * Math.PI * 2; const x = RECESS_R * Math.cos(a), z = SOCKET_Z + RECESS_R * Math.sin(a); if (i === 0) hole.moveTo(x, z); else hole.lineTo(x, z); }
    s.holes.push(hole);
    return s;
  }, []);
  return <mesh><extrudeGeometry args={[shape, { depth: PLATE_FRONT, bevelEnabled: false, curveSegments: 24 }]} /><Tone kind="plastic" /></mesh>;
}

/** The yellow outline of the plate on its front (a ribbon: the rounded square with a hole inside, flat on the plate's plane), with an opacity for
    the flash and the hold. Drawn after the plate and before the plug (the plug is nearer, so the depth buffer covers the ribbon where they meet). */
export function PlateOutline({ opacity }: { opacity: number }) {
  if (opacity <= 0.01) return null;
  const shape = React.useMemo(() => {
    const outer = new THREE.Shape(roundRectPts(0, SOCKET_Z, 2.4, 2.4, 0.36).map(([x, z]) => new THREE.Vector2(x, z)));
    const inner = new THREE.Path(roundRectPts(0, SOCKET_Z, 2.2, 2.2, 0.3).map(([x, z]) => new THREE.Vector2(x, z)));
    outer.holes.push(inner);
    return outer;
  }, []);
  return <mesh position={[0, 0, PLATE_FRONT + 0.002]}><shapeGeometry args={[shape]} /><meshBasicMaterial color={YELLOW} transparent opacity={opacity} depthWrite={false} /></mesh>;
}

/** The socket: the wall, the shelf, the plate with its hole, the recess floor, the pin holes, the pins from the hole up to the plug's face at `gap`,
    the earth clips on the recess wall, and the heat rings in front of the plate (`heat` 0..1). */
export function IsoSocket3D({ gap, heat = 0, scorch = 0, outline = 0 }: { gap: number; heat?: number; scorch?: number; outline?: number }) {
  const faceY = PLATE_FRONT + gap;
  return (
    <group>
      <Box3 a={[-2.1, -0.5, -2.35]} b={[2.1, 2.7, -2.05]} kind="floor" />
      <Box3 a={[-2.1, -0.55, -2.05]} b={[2.1, 0, 2.3]} kind="wall" />
      <PlateWithHole />
      {/* the scorch: stacked discs that approximate the SVG kit's soft radial gradient (darkest at the recess) */}
      {scorch > 0 && [1.5, 1.25, 1.0, 0.75, 0.5].map((r, i) => <DiscAt key={i} x={0.08} y={PLATE_FRONT + 0.005 + i * 0.001} z={SOCKET_Z - 0.05} r={r} color="rgb(70,62,56)" opacity={0.08 * scorch} />)}
      <PlateOutline opacity={outline} />
      {heat > 0.01 && <>
        <DiscAt x={0} y={PLATE_FRONT + 0.003} z={SOCKET_Z} r={1.12 + 0.4 * heat} color={HOT1} opacity={0.7 * heat} />
        <DiscAt x={0} y={PLATE_FRONT + 0.004} z={SOCKET_Z} r={1.02 + 0.2 * heat} color={HOT2} opacity={0.8 * heat} />
      </>}
      {/* the floor of the recess, one tone darker than the plate face, and the pin holes (a light rim, a dark hole) */}
      <DiscAt x={0} y={RECESS_FLOOR} z={SOCKET_Z} r={RECESS_R} kind="plastic" />
      {[-PIN_X, PIN_X].map((x) => (
        <group key={x}>
          <DiscAt x={x} y={RECESS_FLOOR + 0.005} z={SOCKET_Z} r={HOLE_R} kind="plastic" n={24} />
          <DiscAt x={x} y={RECESS_FLOOR + 0.008} z={SOCKET_Z} r={HOLE_R * 0.8} kind="dark" n={24} />
          <CylY x={x} z={SOCKET_Z} y0={RECESS_FLOOR} y1={faceY} r0={PIN_R} kind="metal" n={24} />
        </group>
      ))}
      {/* the earth clips: two small metal tabs on the recess wall, above and below the centre */}
      {[1, -1].map((s) => <Box3 key={s} a={[-0.22, RECESS_FLOOR, SOCKET_Z + s * 0.72 - 0.06]} b={[0.22, PLATE_FRONT - 0.02, SOCKET_Z + s * 0.72 + 0.06]} kind="metal" />)}
      {/* the plate screws */}
      {[1.03, -1.03].map((dz) => <CylY key={dz} x={0} z={SOCKET_Z + dz} y0={PLATE_FRONT} y1={PLATE_FRONT + 0.05} r0={0.1} kind="metal" />)}
    </group>
  );
}

