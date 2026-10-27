/* The plug of the Three.js spike (round 2): the collar, the ribbed grip, the body, the back cap, the strain-relief boot with three grooves and the
   collar over the joint, all as real cylinders and boxes along the iso y (out of the wall), in the same radii and heights as IsoPlug in
   src/components/Iso.tsx; and the cable as a tube along the simulateCable nodes (the same chain the SVG picture draws). Every part takes its ISO
   kind (three flat tones by face normal, src/three/isoTone.ts). The tube starts inside the boot, so the boot hides its start by depth. */
import React from "react";
import * as THREE from "three";
import { CylY, Tone, Box3, at3 } from "./IsoSocket3D.tsx";
import type { IsoPoint } from "./isoCamera.ts";

const SOCKET_Z = 0.5, PLATE_FRONT = 0.3, BOOT_END = 2.1, CABLE_R = 0.1, BOOT_START_R = 0.3;

/** The cable as a tube through the nodes (a Catmull-Rom curve), starting a little inside the boot. */
export function Cable3D({ nodes }: { nodes: readonly IsoPoint[] }) {
  const geo = React.useMemo(() => {
    const lead: IsoPoint = [nodes[0][0], nodes[0][1] - 0.25, nodes[0][2]];
    const curve = new THREE.CatmullRomCurve3([lead, ...nodes].map((p) => new THREE.Vector3(...at3(p))), false, "catmullrom", 0.5);
    return new THREE.TubeGeometry(curve, Math.min(400, nodes.length * 12), CABLE_R, 12, false);
  }, [nodes]);
  return <mesh geometry={geo}><Tone kind="dark" /></mesh>;
}

/** The plug: its face at PLATE_FRONT + gap, the collar, the ribbed grip, the body, the back cap, the boot with grooves and the joint's collar. */
export function IsoPlug3D({ gap, cableNodes }: { gap: number; cableNodes: readonly IsoPoint[] }) {
  const y0 = PLATE_FRONT + gap, x = 0, z = SOCKET_Z;
  const kind = "dark" as const;
  const ribs = [0.95, 1.35, 1.75, 2.15, 2.55];
  const grooves = [1.4, 1.66, 1.92];
  return (
    <group>
      <CylY x={x} z={z} y0={y0} y1={y0 + 0.14} r0={1.03} kind={kind} />
      <CylY x={x} z={z} y0={y0 + 0.14} y1={y0 + 1.0} r0={0.95} r1={0.86} kind={kind} />
      {/* the grip ribs: thin boxes on the grip, one per angle */}
      {ribs.map((th, i) => {
        const cx = Math.cos(th) * 0.95, cz = Math.sin(th) * 0.95;
        return <Box3 key={i} a={[x + cx - 0.03, y0 + 0.25, z + cz - 0.03]} b={[x + cx + 0.03, y0 + 0.92, z + cz + 0.03]} kind="dark" />;
      })}
      <CylY x={x} z={z} y0={y0 + 1.0} y1={y0 + 1.16} r0={0.86} r1={0.6} kind={kind} />
      <CylY x={x} z={z} y0={y0 + 1.14} y1={y0 + BOOT_END} r0={BOOT_START_R} r1={CABLE_R} kind={kind} n={32} />
      {/* the strain-relief grooves: three thin rings round the boot */}
      {grooves.map((dy, i) => <CylY key={i} x={x} z={z} y0={y0 + dy - 0.02} y1={y0 + dy + 0.02} r0={BOOT_START_R - (dy - 1.14) / (BOOT_END - 1.14) * (BOOT_START_R - CABLE_R) + 0.02} kind={kind} n={32} />)}
      {/* the collar over the joint, a little wider than the cable */}
      <CylY x={x} z={z} y0={y0 + BOOT_END - 0.04} y1={y0 + BOOT_END + 0.03} r0={CABLE_R + 0.03} kind="dark" n={32} />
      <Cable3D nodes={cableNodes.map((p) => [p[0], p[1], p[2]] as IsoPoint)} />
    </group>
  );
}

