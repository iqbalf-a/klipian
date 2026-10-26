/* The 3D toon models of the colokan story (P28-A4): the Indonesian wall socket with its plug, their cutaway, a cable, smoke.
   They are assets (the AI picks them in the story JSON, it never writes them). Built in object units (the sheet's units x 0.02):
   the socket's plate is 2.4 wide. Colour code as everywhere: yellow = current, red/orange = heat, grey = material, light grey = metal.
   Depth (a recess, a hole, a cavity) is real here: the light from the top-left leaves a hard crescent on the inner edge by itself. */
import React from "react";
import * as THREE from "three";
import { BLACK, CAVITY_SHADE, G1, G2, G3, G4, HOLE_SHADE, HOT1, HOT2, METAL, PLUG_FACE, RECESS_SHADE, RED, SMOKE, WHITE, YELLOW, YELLOW_D } from "../tokens.ts";
import { cableSamples, type Pt } from "../cable.ts";
import { Flat, Mat, PX, extrude, roundedRect, toWorld, useGeometry } from "./common.tsx";

const U = 0.02;                                           // object units per sheet unit

// ---------------------------------------------------------------- the wall socket, seen from the front -------------------------------------
const PLATE = { size: 2.4, corner: 0.34, depth: 0.28, recess: 0.88, bevel: 0.05 };
export const PLUG_BODY = { w: 1.22, h: 1.4, depth: 0.9 };
const SCORCH = "rgb(120,104,92)";

export const WallSocket3D: React.FC<{ scorched?: boolean }> = ({ scorched }) => {
  const plate = useGeometry(() => {
    const shape = roundedRect(PLATE.size, PLATE.size, PLATE.corner);
    const hole = new THREE.Path();
    hole.absarc(0, 0, PLATE.recess, 0, Math.PI * 2, true);
    shape.holes.push(hole);
    return extrude(shape, PLATE.depth, PLATE.bevel);
  });
  const floorZ = -0.02;
  return (
    <group>
      <mesh geometry={plate}><Mat color={WHITE} /></mesh>
      {/* the recess: its floor, and the walls are the plate's own hole, so the light draws the crescent */}
      <mesh position={[0, 0, floorZ]}><circleGeometry args={[PLATE.recess + 0.02, 56]} /><Mat color={RECESS_SHADE} /></mesh>
      {/* two pin holes: a dark sleeve going in, with a lighter rim */}
      {[-0.32, 0.32].map((x) => (
        <group key={x} position={[x, 0, floorZ]}>
          {/* the hole reads as going in: a dark disc, its far side a little lighter (the crescent of shade is on the upper left) */}
          <mesh position={[0, 0, 0.004]}><ringGeometry args={[0.15, 0.21, 28]} /><Mat color={G4} /></mesh>
          <mesh position={[0, 0, 0.006]}><circleGeometry args={[0.15, 28]} /><Mat color={HOLE_SHADE} /></mesh>
          <mesh position={[0.035, -0.035, 0.008]}><circleGeometry args={[0.105, 28]} /><Mat color={PLUG_FACE} /></mesh>
        </group>
      ))}
      {/* the two side earth clips, in the wall of the recess */}
      {[-0.84, 0.84].map((x) => (
        <mesh key={x} position={[x, 0, 0.06]}><boxGeometry args={[0.16, 0.52, 0.12]} /><Mat color={METAL} /></mesh>
      ))}
      {/* two screws, top and bottom, each with a slot */}
      {[-1.02, 1.02].map((y, i) => (
        <group key={y} position={[0, y, PLATE.depth / 2 + PLATE.bevel]} rotation={[0, 0, i ? 0.6 : -0.4]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.1, 0.1, 0.05, 22]} /><Mat color={G3} /></mesh>
          <mesh position={[0, 0, 0.03]}><boxGeometry args={[0.15, 0.028, 0.02]} /><Mat color={G2} /></mesh>
        </group>
      ))}
      {scorched && (
        <group position={[0, 0, floorZ + 0.012]}>
          {/* the plastic around the hole is darkened: a brown ring on the plate, and charred patches in the recess */}
          <mesh position={[0, 0, PLATE.depth / 2 + PLATE.bevel - floorZ - 0.0]}><ringGeometry args={[PLATE.recess + 0.01, 1.06, 56]} /><Flat color={SCORCH} opacity={0.5} /></mesh>
          {([[-0.34, 0.14, 0.26, SCORCH], [-0.4, 0.02, 0.15, G1], [0.34, -0.16, 0.2, SCORCH]] as const).map(([x, y, r, c], i) => (
            <mesh key={i} position={[x, y, 0.004 * i]}><circleGeometry args={[r, 40]} /><Mat color={c} /></mesh>
          ))}
          <mesh position={[0.36, -0.22, 0.02]}><circleGeometry args={[0.07, 18]} /><Mat color={G1} /></mesh>
        </group>
      )}
    </group>
  );
};

// ---------------------------------------------------------------- the plug --------------------------------------------------------------------
/** The plug: a black body with a lighter face, grip ridges on both sides, two round metal pins and the strain relief where the cable
    leaves (the bottom). `gap` pulls it out of the socket (object units along z); the pins show when it is out. */
export const Plug3D: React.FC<{ gap?: number }> = ({ gap = 0 }) => {
  const body = useGeometry(() => extrude(roundedRect(PLUG_BODY.w, PLUG_BODY.h, 0.3), PLUG_BODY.depth, 0.04));
  const face = useGeometry(() => extrude(roundedRect(0.5, 0.78, 0.14), 0.04));
  const z = PLUG_BODY.depth / 2 + 0.03 + gap;                          // the back of the body just in front of the recess floor
  return (
    <group position={[0, 0, z]}>
      <mesh geometry={body}><Mat color={G1} /></mesh>
      <mesh geometry={face} position={[0, 0.06, PLUG_BODY.depth / 2 + 0.03]}><Mat color={PLUG_FACE} /></mesh>
      {[-0.45, -0.15, 0.15, 0.45].map((y) => [-1, 1].map((sx) => (
        <mesh key={`${y}${sx}`} position={[sx * (PLUG_BODY.w / 2 + 0.01), y, 0]}><boxGeometry args={[0.06, 0.13, 0.66]} /><Mat color={PLUG_FACE} /></mesh>
      )))}
      {/* the pins, round, going back towards the socket */}
      {[-0.32, 0.32].map((x) => (
        <mesh key={x} position={[x, 0, -PLUG_BODY.depth / 2 - 0.27]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.1, 0.1, 0.5, 20]} /><Mat color={METAL} /></mesh>
      ))}
      {/* the strain relief: a cone that eases the cable out of the bottom */}
      <mesh position={[0, -PLUG_BODY.h / 2 - 0.27, 0]}><cylinderGeometry args={[0.3, 0.14, 0.55, 22]} /><Mat color={G1} /></mesh>
    </group>
  );
};

/** Where the cable leaves the plug (object units, in the plug's frame): the tip of the strain relief. */
export const CABLE_EXIT = { x: 0, y: -(PLUG_BODY.h / 2 + 0.55), z: PLUG_BODY.depth / 2 + 0.03 };

/** The glow of a heating plug: two flat discs around it, in the colours of the 2D glow. */
export const PlugHeat: React.FC<{ heat: number; t: number }> = ({ heat, t }) => {
  if (heat <= 0) return null;
  const pulse = 1 + 0.06 * Math.sin(t * 12);
  return (
    <group position={[0, 0, 0.16]}>
      <mesh position={[0, 0, 0.0]}><circleGeometry args={[(1.0 + 0.45 * heat) * pulse, 48]} /><Flat color={HOT1} opacity={0.62 * heat} /></mesh>
      <mesh position={[0, 0, 0.01]}><circleGeometry args={[(0.86 + 0.2 * heat) * pulse, 48]} /><Flat color={HOT2} opacity={0.7 * heat} /></mesh>
    </group>
  );
};

/** A few puffs of smoke rising (grey toon spheres that grow as they climb). Offsets are the sheet's, in sheet units. */
export const Smoke3D: React.FC<{ t: number }> = ({ t }) => (
  <group>
    {([[-30, -96, 7], [-14, -112, 9], [6, -130, 11], [-4, -150, 13]] as const).map(([dx, dy, r], i) => {
      const up = (t * 10 + i * 5) % 18;
      return (
        <mesh key={i} position={[(dx + Math.sin(t * 5 + i) * 3) * U, -(dy + 22 - up) * U, 0.2]} scale={r * U * (0.85 + (up / 18) * 0.3)}>
          <sphereGeometry args={[1, 24, 18]} /><Mat color={SMOKE} />
        </mesh>
      );
    })}
  </group>
);

// ---------------------------------------------------------------- the cable ---------------------------------------------------------------------
/** A tube along the cable's curve, in video pixels (the same curve as the 2D cable). `draw` (0..1) grows it from its start. It lives in
    world space, outside <Placed>, so the object's orbit does not move it. */
export const Cable3D: React.FC<{ route: readonly Pt[]; radiusPx: number; draw: number; z?: number }> = ({ route, radiusPx, draw, z = 0.5 }) => {
  const key = route.map((p) => p.join(",")).join(";");
  const geo = React.useMemo(() => {
    const pts = cableSamples(route, undefined, 14).map((p) => { const [x, y] = toWorld(p[0], p[1]); return new THREE.Vector3(x, y, z); });
    if (pts.length < 2) return null;
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, "centripetal"), Math.max(8, pts.length * 3), radiusPx / PX, 12, false);
  }, [key, radiusPx, z]);
  React.useLayoutEffect(() => {
    if (!geo?.index) return;
    const ring = 12 * 6;                                              // indices of one ring of the tube
    geo.setDrawRange(0, Math.max(0, Math.floor((geo.index.count * Math.min(1, Math.max(0, draw))) / ring)) * ring);
  }, [geo, draw]);
  if (!geo) return null;
  const [sx, sy] = toWorld(route[0][0], route[0][1]);
  return (
    <group>
      <mesh geometry={geo}><Mat color={G1} /></mesh>
      <mesh position={[sx, sy, z]}><sphereGeometry args={[radiusPx / PX, 14, 12]} /><Mat color={G1} /></mesh>
    </group>
  );
};

// ---------------------------------------------------------------- the cutaway ------------------------------------------------------------------
// The socket and plug cut lengthwise, side view: slabs of the cross-section with real thickness, so they turn and catch the light.
// Coordinates below are the sheet's (box 0..240 x 0..160, x to the right, y DOWN), converted to object units about the box centre.
const bx = (x: number): number => (x - 120) * U;
const by = (y: number): number => -(y - 80) * U;
export const CUTAWAY_DEPTH = 0.9;

const Box: React.FC<{ x0: number; y0: number; x1: number; y1: number; z?: number; d: number; color: string }> = ({ x0, y0, x1, y1, z = 0, d, color }) => (
  <mesh position={[bx((x0 + x1) / 2), by((y0 + y1) / 2), z]}><boxGeometry args={[(x1 - x0) * U, (y1 - y0) * U, d]} /><Mat color={color} /></mesh>
);

function polygonSlab(points: readonly [number, number][], depth: number, bevel = 0): THREE.BufferGeometry {
  const shape = new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(bx(x), by(y))));
  return extrude(shape, depth, bevel);
}

const Glow3D: React.FC<{ r: number; t: number }> = ({ r, t }) => {
  const pulse = 1 + 0.07 * Math.sin(t * 15);
  return (
    <group position={[bx(134), by(80), 0.46]}>
      <mesh><circleGeometry args={[r * pulse * U, 40]} /><Flat color={HOT1} /></mesh>
      <mesh position={[0, 0, 0.005]}><circleGeometry args={[r * 0.66 * pulse * U, 40]} /><Flat color={HOT2} /></mesh>
      <mesh position={[0, 0, 0.01]}><circleGeometry args={[r * 0.36 * pulse * U, 40]} /><Flat color={RED} /></mesh>
    </group>
  );
};

export const Cutaway3D: React.FC<{ loose?: boolean; heat?: number; dots?: boolean; t: number; draw?: number }> = ({ loose, heat = 1, dots = true, t, draw = 1 }) => {
  const D = CUTAWAY_DEPTH, th = 7;
  const socket = useGeometry(() => polygonSlab([[110, 18], [240, 18], [240, 142], [110, 142], [110, 104], [232, 104], [232, 56], [110, 56]], D, 0.03));
  const plug = useGeometry(() => extrude(roundedRect(74 * U, 100 * U, 0.3), D, 0.03));
  const leaves = React.useMemo(() => [-1, 1].map((sgn) => {
    const base = 80 + sgn * 28, tip = 80 + sgn * 8 + (sgn > 0 ? 0 : -th);
    return polygonSlab([[214, base - th / 2], [214, base + th / 2], [132, tip + th], [132, tip]], 0.5);
  }), []);
  const phase = (t * 48) % 110;
  return (
    <group>
      <mesh geometry={socket}><Mat color={G3} /></mesh>
      <Box x0={110} y0={56} x1={232} y1={104} z={-D / 2 + 0.03} d={0.04} color={CAVITY_SHADE} />                    {/* the cavity's back: it reads as a hollow */}
      <mesh geometry={plug} position={[bx(41), by(80), 0]}><Mat color={G1} /></mesh>
      <mesh position={[bx(-4), by(80), 0]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.1, 0.1, 18 * U * draw + 0.001, 14]} /><Mat color={G1} /></mesh>
      <mesh position={[bx(214 + 20 * draw), by(80), 0]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.08, 0.08, 40 * U * draw + 0.001, 14]} /><Mat color={BLACK} /></mesh>
      <Box x0={78} y0={72} x1={196} y1={88} z={0.02} d={0.5} color={WHITE} />                                           {/* the pin */}
      <Box x0={78} y0={86} x1={196} y1={88} z={0.02} d={0.52} color={METAL} />
      {!loose ? (
        <>
          <Box x0={124} y0={72 - th} x1={214} y1={72} z={0.02} d={0.5} color={METAL} />
          <Box x0={124} y0={88} x1={214} y1={88 + th} z={0.02} d={0.5} color={METAL} />
          <Box x0={208} y0={58} x1={216} y1={102} z={0.02} d={0.6} color={METAL} />
        </>
      ) : (
        <>
          {leaves.map((g, i) => <mesh key={i} geometry={g} position={[0, 0, 0.02]}><Mat color={METAL} /></mesh>)}
          <Box x0={208} y0={50} x1={216} y1={110} z={0.02} d={0.6} color={METAL} />
          {heat > 0 && <Glow3D r={22 * (0.55 + 0.45 * heat)} t={t} />}
        </>
      )}
      {dots && !loose && (
        <group position={[0, 0, 0.3]}>
          {Array.from({ length: 5 }, (_, k) => <mesh key={k} position={[bx(84 + ((k * 22 + phase) % 110)), by(80), 0]}><sphereGeometry args={[0.07, 14, 12]} /><Flat color={YELLOW_D} /></mesh>)}
          {Array.from({ length: 7 }, (_, k) => [70, 90].map((y) => <mesh key={`${k}${y}`} position={[bx(132 + k * 12), by(y), 0]}><sphereGeometry args={[0.065, 12, 10]} /><Flat color={YELLOW_D} /></mesh>))}
        </group>
      )}
      {dots && loose && (
        <group position={[0, 0, 0.3]}>
          {Array.from({ length: 5 }, (_, k) => <mesh key={k} position={[bx(96 + k * 7 + ((t * 30) % 7) * (k % 2 ? 0.5 : 1)), by(80 + Math.sin(t * 17 + k * 2) * 3), 0]}><sphereGeometry args={[0.07, 14, 12]} /><Flat color={YELLOW_D} /></mesh>)}
          {[71, 89].map((y) => <mesh key={y} position={[bx(134), by(y), 0.08]}><sphereGeometry args={[0.065, 12, 10]} /><Flat color={YELLOW} /></mesh>)}
          {Array.from({ length: 6 }, (_, k) => {
            const a = (k * 60 + t * 240) * (Math.PI / 180);
            return <mesh key={k} position={[bx(134 + 9 * Math.cos(a)), by(80 + 9 * Math.sin(a)), 0.1]}><sphereGeometry args={[0.056, 12, 10]} /><Flat color={YELLOW} /></mesh>;
          })}
        </group>
      )}
    </group>
  );
};

// ---------------------------------------------------------------- where the parts are (for labels and arrows that follow them) ---------------------
/** Anchor points in SHEET units about the item's centre (y down, z towards the viewer), by name. */
export const ANCHORS: Record<string, [number, number, number]> = {
  center: [0, 0, 0],
  // the cutaway
  contact: [14, 0, 24], pin: [17, 0, 24], clip: [94, -10, 20], plug: [-79, 0, 24], wire: [114, 0, 10],
  // the outside view
  recess: [0, 0, 8], plugface: [0, 0, 62], cable: [0, 56, 40], top: [0, -60, 10],
};
