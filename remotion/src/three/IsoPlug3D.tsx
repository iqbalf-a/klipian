/* The plug of the Three.js spike (experiment): the collar, the body, the back cap and the tapering boot as real cylinders along the iso y (out of the
   wall), and the cable as a tube along the simulateCable nodes (src/cableSim.ts, the same chain the SVG picture draws). The tube starts inside the
   boot, so the boot hides its start by depth. Same radii and heights as IsoPlug in src/components/Iso.tsx. */
import React from "react";
import * as THREE from "three";
import { ISO } from "../tokens.ts";
import { CylY, Toon, at3 } from "./IsoSocket3D.tsx";
import type { IsoPoint } from "./isoCamera.ts";

const SOCKET_Z = 0.5, PLATE_FRONT = 0.3, BOOT_END = 2.1, CABLE_R = 0.1, BOOT_START_R = 0.3;

/** The cable as a tube through the nodes (a Catmull-Rom curve), starting a little inside the boot. */
export function Cable3D({ nodes }: { nodes: readonly IsoPoint[] }) {
  const geo = React.useMemo(() => {
    const lead: IsoPoint = [nodes[0][0], nodes[0][1] - 0.25, nodes[0][2]];
    const curve = new THREE.CatmullRomCurve3([lead, ...nodes].map((p) => new THREE.Vector3(...at3(p))), false, "catmullrom", 0.5);
    return new THREE.TubeGeometry(curve, Math.min(400, nodes.length * 12), CABLE_R, 12, false);
  }, [nodes]);
  return <mesh geometry={geo}><Toon color={ISO.dark[2]} /></mesh>;
}

/** The plug: its face at PLATE_FRONT + gap, the collar, the body, the back cap and the boot to the cable. */
export function IsoPlug3D({ gap, cableNodes }: { gap: number; cableNodes: readonly IsoPoint[] }) {
  const y0 = PLATE_FRONT + gap, x = 0, z = SOCKET_Z;
  return (
    <group>
      <CylY x={x} z={z} y0={y0} y1={y0 + 0.14} r0={1.03} color={ISO.dark[0]} />
      <CylY x={x} z={z} y0={y0 + 0.14} y1={y0 + 1.0} r0={0.95} r1={0.86} color={ISO.dark[1]} />
      <CylY x={x} z={z} y0={y0 + 1.0} y1={y0 + 1.16} r0={0.86} r1={0.6} color={ISO.dark[2]} />
      <CylY x={x} z={z} y0={y0 + 1.14} y1={y0 + BOOT_END} r0={BOOT_START_R} r1={CABLE_R} color={ISO.dark[2]} n={32} />
      <CylY x={x} z={z} y0={y0 + BOOT_END - 0.04} y1={y0 + BOOT_END + 0.03} r0={CABLE_R + 0.03} color={ISO.dark[0]} n={32} />
      <Cable3D nodes={cableNodes.map((p) => [p[0], p[1], p[2]] as IsoPoint)} />
    </group>
  );
}
