/* The pieces of the charger video, drawn in the iso kit's geometry (src/iso.ts): the wall, the desk, the power strip (a NEW socket: four outlets and a lit
   switch), the charger (a NEW charger: a rounded slab with a USB port and a lamp, no face), the cable, the dressing, and the charger cut open for the lens.
   Real shapes (B27.16): the strip is a long low slab with its outlets in the top face and the rocker on the front face; the charger stands on its blades, in an
   outlet; a USB-A charger has the port in its face. Three tones per part by the tone rule, flat colours from the tokens. */
import React from "react";
import {
  G1, G2, G3, G4, THEMES, WHITE, YELLOW, YELLOW_D, ISO, Polys, IsoBlock, OnPlane, circlePts, cylinder, extrudeXZ, ptsAttr, roundRectPts, smoothPath, planeXZ,
  type Tones,
} from "../../src/design/index.ts";
import { isoAt } from "../../src/iso.ts";
import { CH, GHOST, O, P3, STRIP, U } from "./plan.ts";

const WALL: Tones = [THEMES.sky.wall, THEMES.sky.ring, THEMES.sky.floorEdge];
const DESK: Tones = [THEMES.sky.floor, THEMES.sky.floorEdge, THEMES.sky.ring];
const NOTE: Tones = [YELLOW, YELLOW_D, YELLOW_D];

/* ---------- the room: a wall, a desk and their dressing (the set, faded in by the camera pull-back) ---------- */
export const Room: React.FC = () => {
  const frame = { x0: 3.0, x1: 4.8, z0: 1.9, z1: 3.2 };
  return (
    <g>
      <IsoBlock a={[-8, -0.4, -1]} b={[10, 0, 12]} u={U} o={O} tones={WALL} />
      {/* a framed picture on the wall: a hill and a sun, flat on the wall's plane */}
      <OnPlane y={0} u={U} o={O}>
        <rect x={frame.x0} y={frame.z0} width={frame.x1 - frame.x0} height={frame.z1 - frame.z0} rx={0.05} fill={WHITE} />
        <rect x={frame.x0 + 0.1} y={frame.z0 + 0.1} width={frame.x1 - frame.x0 - 0.2} height={frame.z1 - frame.z0 - 0.2} fill={THEMES.sky.wall} />
        <path d={`M ${frame.x0 + 0.1} ${frame.z0 + 0.1} L ${frame.x0 + 0.7} ${frame.z0 + 0.7} L ${frame.x0 + 1.1} ${frame.z0 + 0.4} L ${frame.x1 - 0.1} ${frame.z0 + 0.8} L ${frame.x1 - 0.1} ${frame.z0 + 0.1} Z`} fill={G3} />
        <circle cx={frame.x1 - 0.5} cy={frame.z1 - 0.38} r={0.2} fill={YELLOW} />
        {/* the wall outlet the strip's cord goes to: a plate with two round holes */}
        <rect x={6.75} y={0.42} width={0.7} height={0.7} rx={0.08} fill={WHITE} />
        <circle cx={7.0} cy={0.77} r={0.075} fill={G1} /><circle cx={7.2} cy={0.77} r={0.075} fill={G1} />
      </OnPlane>
      <IsoBlock a={[-8, 0, -9]} b={[10, 4.8, 0]} u={U} o={O} tones={DESK} />
      {/* dressing on the desk, at real size: a notebook with ruled pages, a mug */}
      <IsoBlock a={[5.0, 1.7, 0]} b={[6.3, 3.0, 0.12]} u={U} o={O} tones={NOTE} />
      {[0.25, 0.5, 0.75].map((k) => <line key={k} x1={isoAt([5.15, 1.7 + k * 1.3, 0.125], U, O)[0]} y1={isoAt([5.15, 1.7 + k * 1.3, 0.125], U, O)[1]} x2={isoAt([6.15, 1.7 + k * 1.3, 0.125], U, O)[0]} y2={isoAt([6.15, 1.7 + k * 1.3, 0.125], U, O)[1]} stroke={G2} strokeWidth={3} />)}
      <Polys polys={cylinder([7.4, 1.6, 0], [7.4, 1.6, 0.6], 0.3, 0.3, [1, 0, 0], [0, 1, 0], U, O)} tones={ISO.plastic} />
      <ellipse cx={isoAt([7.4, 1.6, 0.6], U, O)[0]} cy={isoAt([7.4, 1.6, 0.6], U, O)[1]} rx={0.24 * U * 0.866 * 1.4} ry={0.24 * U * 0.5 * 1.4} fill={G2} />
    </g>
  );
};

/* ---------- the strip, the cord, the charger ---------- */
const topPts = (cx: number, cy: number, r: number, z: number) => circlePts(cx, cy, r, 28).map(([x, y]) => isoAt([x, y, z], U, O));

/** The power strip: a dark slab, four outlets in its top face (two holes each), and the rocker switch on its front face with a lit lamp. */
export const Strip: React.FC<{ on: boolean; clock: number }> = ({ on, clock }) => {
  const s = STRIP, zt = s.z1 + 0.004;
  const sw = { x: 3.35, w: 0.7 };
  return (
    <g>
      <Polys polys={extrudeXZ(roundRectPts((s.x0 + s.x1) / 2, s.z1 / 2, s.x1 - s.x0, s.z1, 0.12), s.y0, s.y1, U, O)} tones={ISO.dark} />
      {s.sockets.map((cx) => (
        <g key={cx}>
          <polygon points={ptsAttr(topPts(cx, 0.95, 0.3, zt) as [number, number][])} fill={G1} stroke={G3} strokeWidth={3} />
          {[-0.1, 0.1].map((d) => <polygon key={d} points={ptsAttr(circlePts(cx + d, 0.95, 0.045, 10).map(([x, y]) => isoAt([x, y, zt + 0.002], U, O)) as [number, number][])} fill={G3} />)}
        </g>
      ))}
      {/* the front face: the rocker (its lit half moves) and the lamp */}
      <OnPlane y={s.y1} u={U} o={O}>
        <rect x={sw.x} y={0.09} width={sw.w} height={0.27} rx={0.05} fill={G1} />
        <rect x={on ? sw.x + sw.w / 2 : sw.x + 0.03} y={0.11} width={sw.w / 2 - 0.03} height={0.23} rx={0.04} fill={on ? WHITE : G3} />
        <circle cx={3.1} cy={0.225} r={0.07} fill={on ? YELLOW : G2} opacity={on ? 0.75 + 0.25 * Math.sin(clock * Math.PI) : 1} />
      </OnPlane>
    </g>
  );
};

/** The strip's cord to the wall outlet, with the small current dashes running along it while the switch is on. */
export const Cord: React.FC<{ on: boolean; clock: number }> = ({ on, clock }) => {
  const pts = [P3(4.4, 0.95, 0.22), P3(5.0, 0.95, 0.04), P3(6.0, 0.6, 0.0), P3(6.9, 0.3, 0.3), P3(7.0, 0.1, 0.62)];
  const d = smoothPath(pts);
  return (
    <g>
      <path d={d} fill="none" stroke={G1} strokeWidth={12} strokeLinecap="round" />
      {on && <path d={d} fill="none" stroke={YELLOW} strokeWidth={5} strokeLinecap="round" strokeDasharray="14 36" strokeDashoffset={-clock * 25} />}
      <IsoBlock a={[6.85, 0, 0.55]} b={[7.3, 0.22, 0.9]} u={U} o={O} tones={ISO.plastic} />
    </g>
  );
};

/** The charger: a rounded slab, a USB port and a small status lamp on its face (an object, no face: it never gets eyes or an expression). The lamp is lit while the strip is on. */
export const Charger: React.FC<{ on: boolean; clock: number }> = ({ on, clock }) => {
  const c = CH, cx = (c.x0 + c.x1) / 2, cz = (c.z0 + c.z1) / 2;
  return (
    <g>
      <Polys polys={extrudeXZ(roundRectPts(cx, cz, c.x1 - c.x0, c.z1 - c.z0, 0.2), c.y0, c.y1, U, O)} tones={ISO.plastic} />
      <OnPlane y={c.y1} u={U} o={O}>
        {/* a moulded rating panel: three bars, then the lamp and the USB-A port */}
        <rect x={cx - 0.4} y={1.45} width={0.8} height={0.55} rx={0.06} fill={ISO.plastic[2]} />
        {[1.6, 1.76, 1.92].map((z, i) => <rect key={z} x={cx - 0.3} y={z - 0.04} width={i === 2 ? 0.35 : 0.6} height={0.05} rx={0.02} fill={G3} />)}
        <circle cx={cx} cy={1.1} r={0.08} fill={on ? YELLOW : G3} opacity={on ? 0.75 + 0.25 * Math.sin(clock * Math.PI) : 1} />
        <rect x={cx - 0.28} y={0.62} width={0.56} height={0.16} rx={0.03} fill={G1} />
        <rect x={cx - 0.22} y={0.67} width={0.44} height={0.04} fill={G3} />
      </OnPlane>
    </g>
  );
};

/** The charger's USB cable, lying across the desk to where the phone is not; its far end is loose. */
export const Cable: React.FC = () => {
  const pts = [P3(1.65, 1.75, 0.72), P3(1.7, 2.1, 0.2), P3(2.1, 2.7, 0.03), P3(2.7, 3.15, 0.03), P3(3.2, 3.2, 0.03)];
  const end = P3(3.3, 3.2, 0.03);
  return (
    <g>
      <IsoBlock a={[1.35, 1.4, 0.6]} b={[1.95, 1.78, 0.84]} u={U} o={O} tones={ISO.metal} />
      <path d={smoothPath(pts)} fill="none" stroke={G1} strokeWidth={9} strokeLinecap="round" />
      <path d={smoothPath(pts)} fill="none" stroke={G2} strokeWidth={3} strokeLinecap="round" transform="translate(-2 -3)" />
      <IsoBlock a={[3.2, 3.1, 0]} b={[3.5, 3.3, 0.14]} u={U} o={O} tones={ISO.metal} />
      <circle cx={end[0]} cy={end[1]} r={0.1} fill="none" />
    </g>
  );
};

/** The phone that is not there: a dashed outline on the desk. */
export const GhostPhone: React.FC<{ clock: number }> = ({ clock }) => {
  const g = GHOST, r = 0.14, n = 5;
  const pts: [number, number][] = [];
  const corner = (cx: number, cy: number, a0: number) => { for (let k = 0; k <= n; k++) { const a = ((a0 + (90 * k) / n) * Math.PI) / 180; pts.push(isoAt([cx + r * Math.cos(a), cy + r * Math.sin(a), 0.004], U, O) as [number, number]); } };
  corner(g.x1 - r, g.y0 + r, -90); corner(g.x1 - r, g.y1 - r, 0); corner(g.x0 + r, g.y1 - r, 90); corner(g.x0 + r, g.y0 + r, 180);
  return <polygon points={ptsAttr(pts)} fill="none" stroke={G2} strokeWidth={5} strokeDasharray="16 14" strokeDashoffset={-clock * 10} strokeLinejoin="round" opacity={0.85} />;
};

/* ---------- inside the charger (the lens): the charger cut open along its face, a flat drawing on the cut plane ---------- */
export const LAB_U = 400;
export const LAB_O: [number, number] = [372, 1090];
const lab = (x: number, y: number, z: number) => isoAt([x, y, z], LAB_U, LAB_O);
/** Plane coordinates (x, z) of the parts on the cut face, read by the labels. */
export const PARTS = { trafo: { x: 0.45, z: 0.8 }, chip: { x: 0.92, z: 1.28 } } as const;
export const labPoint = (x: number, z: number): [number, number] => lab(x, 0.45, z) as [number, number];

/** The cut charger: the shell's back half and, on the cut face, the blades, the transformer, the capacitor, the chip and the USB port with the wires between. The
    current is a thin slow dash on the way in and none on the way out: nothing is charging. `clock` is a loop clock, the dash period 2 s divides 40. */
export const CutCharger: React.FC<{ clock: number; on: boolean }> = ({ clock, on }) => {
  const off = -((clock % 2) / 2) * 0.2;
  const wire = (d: string, flow: boolean) => (
    <g>
      <path d={d} fill="none" stroke={G3} strokeWidth={0.05} strokeLinecap="round" strokeLinejoin="round" />
      {flow && on && <path d={d} fill="none" stroke={YELLOW} strokeWidth={0.05} strokeLinecap="round" strokeDasharray="0.07 0.13" strokeDashoffset={off} />}
    </g>
  );
  return (
    <g>
      <IsoBlock a={[0, 0, 0]} b={[1.3, 0.45, 1.65]} u={LAB_U} o={LAB_O} tones={ISO.plastic} />
      <g transform={planeXZ(0.45, LAB_U, LAB_O)}>
        <rect x={0.1} y={0.1} width={1.1} height={1.45} rx={0.05} fill={G1} />
        {/* the blades, out of the bottom */}
        {[0.4, 0.9].map((x) => <rect key={x} x={x - 0.06} y={-0.35} width={0.12} height={0.5} fill={ISO.metal[1]} />)}
        {/* the transformer: an iron core with a copper coil */}
        <rect x={0.2} y={0.5} width={0.5} height={0.6} rx={0.03} fill={G3} />
        <rect x={0.26} y={0.56} width={0.38} height={0.48} rx={0.03} fill={YELLOW_D} />
        {[0.62, 0.7, 0.78, 0.86, 0.94].map((z) => <line key={z} x1={0.26} y1={z} x2={0.64} y2={z} stroke={G1} strokeWidth={0.02} />)}
        {/* the capacitor and the chip */}
        <rect x={0.84} y={0.5} width={0.2} height={0.46} rx={0.06} fill={G4} />
        <rect x={0.84} y={0.82} width={0.2} height={0.05} fill={G2} />
        <rect x={0.78} y={1.16} width={0.3} height={0.2} rx={0.02} fill={G2} />
        {[0.8, 0.88, 0.96, 1.04].map((x) => <rect key={x} x={x} y={1.12} width={0.04} height={0.05} fill={G3} />)}
        {/* the USB port */}
        <rect x={1.02} y={0.18} width={0.16} height={0.26} rx={0.02} fill={ISO.metal[1]} />
        {/* wires: in from the blades through the transformer to the chip (the current), out to the USB port (nothing flows) */}
        {wire("M 0.4 0.15 L 0.4 0.5", true)}{wire("M 0.9 0.15 L 0.9 0.34 L 0.6 0.34 L 0.6 0.5", true)}
        {wire("M 0.45 1.1 L 0.45 1.26 L 0.78 1.26", true)}{wire("M 0.94 1.16 L 0.94 1.04", true)}
        {wire("M 1.04 1.26 L 1.1 1.26 L 1.1 0.44", false)}
      </g>
    </g>
  );
};
