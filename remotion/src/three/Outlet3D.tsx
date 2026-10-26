/* The semi-realistic socket set (P28-P, pilot "Kenapa colokan bisa panas?"): an Indonesian wall socket (Schuko type: a square plate, a deep round
   recess, the two earth clips at the top and the bottom of the recess wall, the cover screw in the middle of the floor, two plate screws), a round
   plug that fits it (nose, collar, a grip with ribs, a strain relief with grooves, a cable that drops away), and the cutaway of one contact: the pin
   between two spring leaves, tight or loose, with the current as flowing yellow dashes and the heat glowing at the contact point.
   Object units like Socket3D.tsx (the plate is 2.4 wide); the socket's front face is at z = PLATE_FRONT, the plug is built along +z towards the
   viewer. Palette only (through Mat): white/grey plastic, light-grey metal, black plug, yellow = current, orange/red = heat. Reused by later videos. */
import React from "react";
import * as THREE from "three";
import { BLACK, CAVITY_SHADE, G1, G2, G3, G4, HOLE_SHADE, HOT1, HOT2, METAL, PLUG_FACE, RECESS_SHADE, RED, WHITE, YELLOW } from "../tokens.ts";
import { Flat, Mat, extrude, roundedRect, useGeometry } from "./common.tsx";

const P = { size: 2.4, corner: 0.36, depth: 0.3, bevel: 0.05, recessR: 0.86, recessDepth: 0.5 };
/** Where the plate's front face is (object units) and how deep the recess goes. */
export const PLATE_FRONT = P.depth / 2 + P.bevel;
const FLOOR_Z = PLATE_FRONT - P.recessDepth;
const PIN_X = 0.4;
const SCORCH = "rgb(120,104,92)";

/** A colour between two palette colours (for heat tints that grow). */
export const mixColor = (a: string, b: string, k: number): string => `#${new THREE.Color(a).lerp(new THREE.Color(b), Math.max(0, Math.min(1, k))).getHexString()}`;

// ------------------------------------------------------------------------------------------------------------------------------------- the socket
/** The Indonesian wall socket, seen from the front. `scorch` (0..1) browns the plate round the recess and chars the floor. */
export const IndoSocket3D: React.FC<{ scorch?: number }> = ({ scorch = 0 }) => {
  const plate = useGeometry(() => {
    const shape = roundedRect(P.size, P.size, P.corner);
    const hole = new THREE.Path();
    hole.absarc(0, 0, P.recessR, 0, Math.PI * 2, true);
    shape.holes.push(hole);
    return extrude(shape, P.depth, P.bevel);
  });
  return (
    <group>
      <mesh geometry={plate}><Mat color={WHITE} rough={0.5} /></mesh>
      {/* the recess: a deep round wall (seen from inside) and its floor; the key light leaves the crescent of shade on the upper left by itself */}
      <mesh position={[0, 0, PLATE_FRONT - P.recessDepth / 2]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[P.recessR, P.recessR, P.recessDepth, 72, 1, true]} /><Mat color={G4} side={THREE.BackSide} />
      </mesh>
      <mesh position={[0, 0, FLOOR_Z]}><circleGeometry args={[P.recessR + 0.01, 72]} /><Mat color={RECESS_SHADE} /></mesh>
      {/* the two pin holes: a rim, a dark mouth and a sleeve going in */}
      {[-PIN_X, PIN_X].map((x) => (
        <group key={x} position={[x, 0, FLOOR_Z]}>
          <mesh position={[0, 0, 0.004]}><ringGeometry args={[0.13, 0.19, 32]} /><Mat color={G3} /></mesh>
          <mesh position={[0, 0, 0.006]}><circleGeometry args={[0.13, 32]} /><Mat color={HOLE_SHADE} /></mesh>
        </group>
      ))}
      {/* the cover screw in the middle of the floor */}
      <group position={[0, 0, FLOOR_Z + 0.03]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.1, 0.1, 0.06, 24]} /><Mat color={METAL} /></mesh>
        <mesh position={[0, 0, 0.032]} rotation={[0, 0, 0.5]}><boxGeometry args={[0.15, 0.026, 0.02]} /><Mat color={G2} /></mesh>
      </group>
      {/* the earth clips: bent metal tabs in the recess wall, top and bottom */}
      {[1, -1].map((sy) => (
        <group key={sy} position={[0, sy * (P.recessR - 0.05), PLATE_FRONT - 0.24]}>
          <mesh><boxGeometry args={[0.36, 0.07, 0.34]} /><Mat color={METAL} /></mesh>
          <mesh position={[0, -sy * 0.04, 0.13]} rotation={[sy * 0.5, 0, 0]}><boxGeometry args={[0.36, 0.05, 0.12]} /><Mat color={METAL} /></mesh>
        </group>
      ))}
      {/* the plate screws */}
      {[1.03, -1.03].map((y, i) => (
        <group key={y} position={[0, y, PLATE_FRONT]} rotation={[0, 0, i ? 0.7 : -0.3]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.09, 0.09, 0.05, 22]} /><Mat color={G3} metal={0.6} /></mesh>
          <mesh position={[0, 0, 0.03]}><boxGeometry args={[0.13, 0.024, 0.02]} /><Mat color={G2} /></mesh>
        </group>
      ))}
      {scorch > 0 && (
        <group>
          <mesh position={[0, 0, PLATE_FRONT + 0.004]}><ringGeometry args={[P.recessR, P.recessR + 0.32, 72]} /><Flat color={SCORCH} opacity={0.55 * scorch} /></mesh>
          <mesh position={[0.18, -0.1, PLATE_FRONT + 0.006]}><ringGeometry args={[P.recessR, P.recessR + 0.18, 40, 1, -0.8, 1.9]} /><Flat color={G1} opacity={0.45 * scorch} /></mesh>
          {([[-PIN_X, 0, 0.3], [PIN_X, 0, 0.26], [0.1, -0.5, 0.22]] as const).map(([x, y, r], i) => (
            <mesh key={i} position={[x, y, FLOOR_Z + 0.012 + i * 0.002]}><circleGeometry args={[r, 36]} /><Flat color={i === 2 ? SCORCH : G1} opacity={0.75 * scorch} /></mesh>
          ))}
        </group>
      )}
    </group>
  );
};

// ------------------------------------------------------------------------------------------------------------------------------------- the plug
const latheZ = (pts: readonly [number, number][], segs = 72): THREE.LatheGeometry => {
  const g = new THREE.LatheGeometry(pts.map(([r, z]) => new THREE.Vector2(r, z)), segs);
  g.rotateX(Math.PI / 2);                                  // the lathe's axis (y) becomes +z (towards the viewer)
  return g;
};
/** The profile of the plug body (radius, z) from the nose in the recess to the back of the grip. */
const BODY: [number, number][] = [[0, -0.3], [0.77, -0.3], [0.8, -0.27], [0.8, 0.2], [1.0, 0.2], [1.03, 0.24], [1.03, 0.33], [0.99, 0.37], [0.96, 0.5], [0.91, 0.8], [0.83, 1.1], [0.7, 1.3], [0.5, 1.42], [0.3, 1.46], [0, 1.47]];
const RELIEF: [number, number][] = [[0, 1.38], [0.33, 1.38], [0.29, 1.62], [0.21, 1.9], [0.17, 2.06], [0, 2.07]];
const CABLE: [number, number, number][] = [[0, 0, 2.0], [0, 0, 2.35], [0, -0.35, 2.72], [0, -1.4, 2.95], [0, -4, 3.02], [0, -14, 3.02]];

/** The round plug. `gap` pulls it out along z (object units: the pins show), `wobble` (-1..1) tips it in the recess (a loose socket), `heat` (0..1) warms
    the collar. Origin = the socket's centre, so a plug at gap 0 sits in an IndoSocket3D. */
export const RoundPlug3D: React.FC<{ gap?: number; wobble?: number; heat?: number; cable?: boolean }> = ({ gap = 0, wobble = 0, heat = 0, cable = true }) => {
  const body = useGeometry(() => latheZ(BODY));
  const relief = useGeometry(() => latheZ(RELIEF, 40));
  const wire = useGeometry(() => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(CABLE.map((p) => new THREE.Vector3(...p)), false, "centripetal"), 80, 0.14, 14, false));
  const warm = mixColor(BLACK, HOT2, heat * 0.55);
  return (
    <group position={[0, 0, gap]} rotation={[wobble * 0.05, wobble * 0.09, 0]}>
      <mesh geometry={body}><Mat color={G1} rough={0.55} emissive={warm} /></mesh>
      {/* grip ribs, following the taper of the body */}
      {Array.from({ length: 16 }, (_, i) => {
        const a = (i / 16) * Math.PI * 2;
        return (
          <group key={i} rotation={[0, 0, a]}>
            <mesh position={[0, 0.9, 0.78]} rotation={[-0.27, 0, 0]}><boxGeometry args={[0.07, 0.07, 0.62]} /><Mat color={PLUG_FACE} rough={0.7} /></mesh>
          </group>
        );
      })}
      <mesh geometry={relief}><Mat color={G1} rough={0.75} /></mesh>
      {[1.55, 1.68, 1.81, 1.94].map((z, i) => <mesh key={z} position={[0, 0, z]}><torusGeometry args={[0.3 - i * 0.03, 0.022, 8, 32]} /><Mat color={PLUG_FACE} /></mesh>)}
      {cable && <mesh geometry={wire}><Mat color={G1} rough={0.6} /></mesh>}
      {/* the earth strips on the nose and the two pins */}
      {[1, -1].map((sy) => <mesh key={sy} position={[0, sy * 0.8, -0.06]}><boxGeometry args={[0.28, 0.03, 0.4]} /><Mat color={METAL} /></mesh>)}
      {[-PIN_X, PIN_X].map((x) => (
        <group key={x} position={[x, 0, -0.3]}>
          <mesh position={[0, 0, -0.37]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.1, 0.1, 0.74, 22]} /><Mat color={METAL} metal={0.9} rough={0.25} /></mesh>
          <mesh position={[0, 0, -0.74]}><sphereGeometry args={[0.1, 18, 12]} /><Mat color={METAL} metal={0.9} rough={0.25} /></mesh>
        </group>
      ))}
    </group>
  );
};

/** The heat at the plug's collar, on the plate: rings of orange round the plug that grow and pulse with `heat` (0..1). */
export const CollarHeat: React.FC<{ heat: number; t: number }> = ({ heat, t }) => {
  if (heat <= 0.01) return null;
  const pulse = 1 + 0.05 * Math.sin(t * 9);
  return (
    <group position={[0, 0, PLATE_FRONT + 0.008]}>
      <mesh><ringGeometry args={[0.98, (1.12 + 0.42 * heat) * pulse, 64]} /><Flat color={HOT1} opacity={0.75 * heat} /></mesh>
      <mesh position={[0, 0, 0.003]}><ringGeometry args={[0.98, (1.04 + 0.2 * heat) * pulse, 64]} /><Flat color={HOT2} opacity={0.85 * heat} /></mesh>
    </group>
  );
};

/** Named points of the socket set (object units, socket frame) for labels that follow a part with projectView. */
export const OUTLET_POINTS = {
  plate: [-0.95, 0.95, PLATE_FRONT], screw: [0, 1.03, PLATE_FRONT], recess: [0, 0, FLOOR_Z], collar: [1.0, 0.2, 0.3], grip: [0.66, 0.55, 0.95],
  plugFace: [0, 0, 1.47], cable: [0, -1.4, 2.95], clip: [0, P.recessR - 0.05, PLATE_FRONT - 0.2],
} as const satisfies Record<string, [number, number, number]>;

// ------------------------------------------------------------------------------------------------------------------------------------- the cutaway
// One contact cut lengthwise, seen from the side: x = the way the plug goes in (plug on the left, the socket's insert on the right), y up, the cut face
// at z = 0 facing the viewer, the plastic extruded behind it. The pin is a whole cylinder (it is not cut), the leaves are bent metal strips.
const D = 0.9;
const shapeOf = (pts: readonly [number, number][]): THREE.Shape => new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
const slab = (pts: readonly [number, number][], depth = D, bevel = 0.02): THREE.BufferGeometry => { const g = extrude(shapeOf(pts), depth, bevel); g.translate(0, 0, -depth / 2); return g; };
const mirrorY = (pts: readonly [number, number][]): [number, number][] => pts.map(([x, y]) => [x, -y] as [number, number]).reverse();

const INSERT_TOP: [number, number][] = [[0, 1.3], [3.0, 1.3], [3.0, 0.13], [2.72, 0.13], [2.72, 0.62], [0.8, 0.62], [0.8, 0.21], [0.5, 0.21], [0.5, 0.9], [0, 0.9]];
const PLATE_TOP: [number, number][] = [[-0.25, 0.9], [0, 0.9], [0, 2.0], [-0.25, 2.0]];
const PLUG_HALF: [number, number][] = [[0.47, 0.84], [-0.25, 0.84], [-0.25, 1.04], [-0.42, 1.04], [-0.56, 0.97], [-1.0, 0.9], [-1.5, 0.78], [-1.85, 0.6], [-1.96, 0.38]];
const PLUG_SECTION: [number, number][] = [...PLUG_HALF, ...mirrorY(PLUG_HALF)];
const RELIEF_SECTION: [number, number][] = [[-1.9, 0.33], [-2.62, 0.2], [-2.62, -0.2], [-1.9, -0.33]];
export const PIN = { x0: -0.9, x1: 2.25, r: 0.17 };
const LEAF_T = 0.075;

/** A leaf's centre line, from its foot at the terminal to its lip at the entry; `s` = +1 top, -1 bottom; `loose` 0..1 lets it spring away from the pin.
    Tight: both lie flat on the pin over a long stretch. Loose: the top one only just touches at one point, the bottom one stands off. */
function leafLine(s: 1 | -1, loose: number): [number, number][] {
  const on = PIN.r + LEAF_T / 2;
  const tight: [number, number][] = [[2.58, 0.5], [2.0, 0.42], [1.5, on + 0.01], [1.15, on], [0.88, on], [0.74, 0.33]];
  const off: [number, number][] = s > 0
    ? [[2.58, 0.5], [2.0, 0.46], [1.45, 0.34], [1.12, on + 0.02], [1.0, on], [0.8, 0.36]]
    : [[2.58, 0.5], [2.0, 0.49], [1.5, 0.44], [1.15, 0.38], [0.95, 0.37], [0.76, 0.46]];
  return tight.map(([x, y], i) => [x + (off[i][0] - x) * loose, s * (y + (off[i][1] - y) * loose)]);
}
/** Where the current passes from the pin into the leaves (object units, cutaway frame): the middle of the long stretch when tight, the one point when loose. */
export const contactPoint = (loose: number): [number, number, number] => [1.2 + (1.0 - 1.2) * loose, PIN.r, 0.05];

function leafGeometry(line: [number, number][]): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3(line.map(([x, y]) => new THREE.Vector3(x, y, 0)), false, "centripetal");
  const pts = curve.getPoints(48);
  const top: THREE.Vector2[] = [], bot: THREE.Vector2[] = [];
  pts.forEach((p, i) => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    const tx = b.x - a.x, ty = b.y - a.y, len = Math.hypot(tx, ty) || 1, nx = -ty / len, ny = tx / len;
    top.push(new THREE.Vector2(p.x + (nx * LEAF_T) / 2, p.y + (ny * LEAF_T) / 2));
    bot.push(new THREE.Vector2(p.x - (nx * LEAF_T) / 2, p.y - (ny * LEAF_T) / 2));
  });
  const g = extrude(new THREE.Shape([...top, ...bot.reverse()]), 0.5, 0.012);
  g.translate(0, 0, -0.25);
  return g;
}

/** The paths the current takes (cutaway frame): in along the cable's core and the pin, across the contact into a leaf, along it to the terminal, out
    along the wire. Tight: through both leaves. Loose: only through the one point. */
function currentPaths(loose: number): THREE.Vector3[][] {
  const z = 0.24, on = PIN.r + 0.02;
  const v = (x: number, y: number) => new THREE.Vector3(x, y, z);
  if (loose < 0.5) return [1, -1].map((s) => [v(-4.6, 0), v(-0.9, 0), v(0.95, 0), v(1.15, s * on), v(1.6, s * 0.3), v(2.1, s * 0.44), v(2.6, s * 0.46), v(2.66, s * 0.12), v(2.85, 0), v(5.2, 0)]);
  const c = contactPoint(loose);
  return [[v(-4.6, 0), v(-0.9, 0), v(c[0] - 0.12, 0), v(c[0], on), v(c[0] + 0.3, 0.3), v(2.1, 0.45), v(2.6, 0.47), v(2.66, 0.12), v(2.85, 0), v(5.2, 0)]];
}

/** Yellow dashes flowing along the paths. Loose: they crowd and crawl at the narrow point (time is spent there), then shoot on. */
const CurrentDashes: React.FC<{ t: number; loose: number; opacity: number; speed?: number }> = ({ t, loose, opacity, speed = 1.6 }) => {
  const paths = React.useMemo(() => currentPaths(loose).map((pts) => new THREE.CatmullRomCurve3(pts, false, "catmullrom", 0.1)), [loose < 0.5]);
  const c = contactPoint(loose);
  if (opacity <= 0.01) return null;
  return (
    <group>
      {paths.map((curve, pi) => {
        const L = curve.getLength(), N = 160;
        // time to cross each small step: slow near the contact when loose (the jam), so dashes evenly spaced in TIME bunch up there in space
        const pts = curve.getSpacedPoints(N);
        const cost = pts.map((p) => 1 + (loose >= 0.5 ? 5.5 * Math.exp(-((p.x - c[0]) ** 2 + (p.y - c[1]) ** 2) / 0.03) : 0));
        const cum = [0];
        for (let i = 1; i <= N; i++) cum.push(cum[i - 1] + (cost[i] + cost[i - 1]) / 2);
        const T = cum[N], gapT = (0.34 / L) * N;                       // one dash every 0.34 units of an unhindered path
        const count = Math.floor(T / gapT);
        const phase = ((t * speed) / L) * N + pi * gapT * 0.5;
        return Array.from({ length: count }, (_, k) => {
          const tau = (((phase + k * gapT) % T) + T) % T;
          let i = 1;
          while (i < N && cum[i] < tau) i++;
          const u = (i - 1 + (tau - cum[i - 1]) / (cum[i] - cum[i - 1] || 1)) / N;
          const p = curve.getPointAt(Math.min(1, u)), d = curve.getTangentAt(Math.min(1, u));
          const fade = Math.min(1, u * 12, (1 - u) * 12);
          return (
            <mesh key={`${pi}-${k}`} position={p} rotation={[0, 0, Math.atan2(d.y, d.x)]}>
              <boxGeometry args={[0.2, 0.065, 0.065]} /><Flat color={YELLOW} opacity={opacity * fade} />
            </mesh>
          );
        });
      })}
    </group>
  );
};

let glowTex: THREE.DataTexture | null = null;
/** A soft round spot (white in the middle, transparent at the rim) for sprites: the glow of the hot contact. */
export function glowTexture(): THREE.DataTexture {
  if (glowTex) return glowTex;
  const n = 64, data = new Uint8Array(n * n * 4);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const d = Math.hypot(x - n / 2 + 0.5, y - n / 2 + 0.5) / (n / 2), a = Math.max(0, 1 - d) ** 1.6;
    data.set([255, 255, 255, Math.round(a * 255)], (y * n + x) * 4);
  }
  glowTex = new THREE.DataTexture(data, n, n, THREE.RGBAFormat);
  glowTex.needsUpdate = true;
  return glowTex;
}

/** The cutaway of one contact. `loose` 0..1 (the leaves spring away and touch at one point), `heat` 0..1 (the contact glows, the leaf warms), `current`
    0..1 (the dashes' opacity), `t` seconds (they flow). */
export const ContactCutaway3D: React.FC<{ loose?: number; heat?: number; current?: number; t: number }> = ({ loose = 0, heat = 0, current = 1, t }) => {
  const insertTop = useGeometry(() => slab(INSERT_TOP));
  const insertBottom = useGeometry(() => slab(mirrorY(INSERT_TOP)));
  const plateTop = useGeometry(() => slab(PLATE_TOP, D + 0.3));
  const plateBottom = useGeometry(() => slab(mirrorY(PLATE_TOP), D + 0.3));
  const plug = useGeometry(() => slab(PLUG_SECTION, D, 0.03));
  const relief = useGeometry(() => slab(RELIEF_SECTION, 0.5));
  const key = Math.round(loose * 40) / 40;
  const leaves = React.useMemo(() => [leafGeometry(leafLine(1, key)), leafGeometry(leafLine(-1, key))], [key]);
  const c = contactPoint(loose);
  const pulse = 1 + 0.08 * Math.sin(t * 13);
  const warmLeaf = mixColor(BLACK, HOT2, heat * 0.7);
  return (
    <group>
      {/* the socket: its insert (cut), the plate in front, the hollow behind the leaves, the terminal and its screw, the wire out of the back */}
      <mesh geometry={insertTop}><Mat color={G4} rough={0.55} /></mesh>
      <mesh geometry={insertBottom}><Mat color={G4} rough={0.55} /></mesh>
      <mesh geometry={plateTop}><Mat color={WHITE} rough={0.5} /></mesh>
      <mesh geometry={plateBottom}><Mat color={WHITE} rough={0.5} /></mesh>
      <mesh position={[1.36, 0, -D / 2 + 0.03]}><boxGeometry args={[2.72, 1.8, 0.04]} /><Mat color={CAVITY_SHADE} /></mesh>
      <mesh position={[2.64, 0, -0.2]}><boxGeometry args={[0.16, 1.2, 0.5]} /><Mat color={METAL} /></mesh>
      <mesh position={[2.64, 0.95, -0.1]}><cylinderGeometry args={[0.1, 0.1, 0.7, 18]} /><Mat color={G3} metal={0.6} /></mesh>
      <mesh position={[3.0, 0, 0]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.07, 0.07, 0.6, 14]} /><Mat color={METAL} /></mesh>
      <mesh position={[4.15, 0, 0]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.13, 0.13, 2.1, 16]} /><Mat color={G1} /></mesh>
      {/* the plug, cut: its body, the strain relief, the cable and the copper core running to the pin */}
      <mesh geometry={plug}><Mat color={G1} rough={0.55} /></mesh>
      <mesh geometry={relief}><Mat color={G1} rough={0.75} /></mesh>
      <mesh position={[-3.7, 0, 0]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.14, 0.14, 2.2, 16]} /><Mat color={G1} /></mesh>
      <mesh position={[-1.75, 0, 0.02]}><boxGeometry args={[1.9, 0.09, 0.06]} /><Mat color={METAL} /></mesh>
      <mesh position={[-0.82, 0, 0.02]}><boxGeometry args={[0.26, 0.24, 0.2]} /><Mat color={METAL} /></mesh>
      {/* the pin: whole, bright metal, a rounded tip */}
      <mesh position={[(PIN.x0 + PIN.x1) / 2, 0, 0]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[PIN.r, PIN.r, PIN.x1 - PIN.x0, 28]} /><Mat color={WHITE} metal={0.75} rough={0.28} emissive={mixColor(BLACK, HOT2, heat * 0.25)} /></mesh>
      <mesh position={[PIN.x1, 0, 0]}><sphereGeometry args={[PIN.r, 24, 16]} /><Mat color={WHITE} metal={0.75} rough={0.28} /></mesh>
      {/* the spring leaves */}
      <mesh geometry={leaves[0]}><Mat color={METAL} metal={0.85} rough={0.3} emissive={warmLeaf} /></mesh>
      <mesh geometry={leaves[1]}><Mat color={METAL} metal={0.85} rough={0.3} /></mesh>
      <CurrentDashes t={t} loose={loose} opacity={current} speed={1.6 + 0.8 * loose} />
      {/* the hot contact: soft spots that always face the camera, orange round a red core */}
      {heat > 0.01 && (
        <group position={c}>
          <sprite scale={[1.5 * heat * pulse, 1.5 * heat * pulse, 1]}><spriteMaterial map={glowTexture()} color={HOT1} transparent opacity={0.9} depthWrite={false} depthTest={false} /></sprite>
          <sprite scale={[0.85 * heat * pulse, 0.85 * heat * pulse, 1]}><spriteMaterial map={glowTexture()} color={HOT2} transparent opacity={0.95} depthWrite={false} depthTest={false} /></sprite>
          <sprite scale={[0.42 * heat * pulse, 0.42 * heat * pulse, 1]}><spriteMaterial map={glowTexture()} color={RED} transparent opacity={1} depthWrite={false} depthTest={false} /></sprite>
        </group>
      )}
    </group>
  );
};

/** Named points of the cutaway (object units, cutaway frame) for labels: the top leaf, the pin, the plug, the wire. Use contactPoint(loose) for the contact. */
export const CUTAWAY_POINTS = {
  leaf: [2.05, 0.44, 0.0], pin: [-0.2, -PIN.r, 0.1], pinTip: [2.2, 0, 0.1], plug: [-1.2, 0.6, 0.0], wire: [3.9, 0, 0.1], cable: [-3.3, 0, 0.1],
} as const satisfies Record<string, [number, number, number]>;
