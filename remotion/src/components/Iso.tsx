/* The 2.5D isometric kit (P28 main style): SVG pieces built from src/iso.ts, three tones per object, light from the top-left. Generic pieces (a block, an
   extruded outline, a cylinder, content on a plane) and the socket set of the pilot "Kenapa colokan bisa panas?": a chunk of wall with an Indonesian
   socket (plate, recess, pin holes, earth clips, screws), a round plug with its cable, and the cutaway of one contact (spring leaves gripping the pin, tight
   or loose, the hot contact, the current as flowing yellow dashes). Every piece takes `u` (px per world unit) and `o` (the screen px of the world origin).
   Their named points (ISO_SOCKET_POINTS, ISO_CUT_POINTS) give the world point of a part, for labels: isoAt(point, u, o) then the camera's toScreen. */
import React from "react";
import { BLACK, CAVITY_SHADE, HOLE_SHADE, HOT1, HOT2, ISO, RED, YELLOW } from "../tokens.ts";
import { block, circlePts, cylinder, extrudeAnyXZ, extrudeXZ, isoAt, planeXZ, ptsAttr, roundRectPts, smoothPath, toneOf, visible, type P2, type P3, type Poly, type Tones } from "../iso.ts";
import { cablePath } from "../cable.ts";

const mix = (a: string, b: string, k: number): string => {
  const pa = a.match(/\d+/g)!.map(Number), pb = b.match(/\d+/g)!.map(Number), q = Math.max(0, Math.min(1, k));
  return `rgb(${pa.map((v, i) => Math.round(v + (pb[i] - v) * q)).join(",")})`;
};

/** Polygons in their tones. */
export const Polys: React.FC<{ polys: readonly Poly[]; tones: Tones; opacity?: number }> = ({ polys, tones, opacity }) => (
  <g opacity={opacity}>{polys.map((p, i) => <polygon key={i} points={ptsAttr(p.pts)} fill={tones[p.tone]} stroke={tones[p.tone]} strokeWidth={0.8} strokeLinejoin="round" />)}</g>
);
export const IsoBlock: React.FC<{ a: P3; b: P3; u: number; o: P2; tones: Tones; hatch?: string }> = ({ a, b, u, o, tones, hatch }) => {
  const polys = block(a, b, u, o);
  return <g><Polys polys={polys} tones={tones} />{hatch && <polygon points={ptsAttr(polys[1].pts)} fill={`url(#${hatch})`} />}</g>;
};
/** 2D content in (x, z) coordinates (z up) drawn on the plane y = y0. Text drawn here comes out upside down: keep text outside. */
export const OnPlane: React.FC<{ y: number; u: number; o: P2; children: React.ReactNode }> = ({ y, u, o, children }) => <g transform={planeXZ(y, u, o)}>{children}</g>;

/** The diagonal hatch that marks a cut face (a cutaway convention), as a pattern to put in <defs>. */
export const Hatch: React.FC<{ id: string; color?: string }> = ({ id, color = BLACK }) => (
  <pattern id={id} patternUnits="userSpaceOnUse" width={22} height={22} patternTransform="rotate(45)">
    <rect x={0} y={0} width={4} height={22} fill={color} opacity={0.13} />
  </pattern>
);

// ------------------------------------------------------------------------------------------------------------------------------------- socket on a wall
export const SOCKET_Z = 0.5, PLATE_FRONT = 0.3, RECESS_FLOOR = -0.05, RECESS_R = 0.86, PIN_X = 0.4;
/** Named world points of the wall socket and plug (plug at gap 0). */
export const ISO_SOCKET_POINTS = {
  plate: [-0.95, PLATE_FRONT, SOCKET_Z + 0.95], screw: [0, PLATE_FRONT, SOCKET_Z + 1.03], recess: [0, RECESS_FLOOR, SOCKET_Z], wall: [-1.5, 0, 1.9],
  collar: [0.95, PLATE_FRONT + 0.08, SOCKET_Z + 0.25], grip: [0.55, PLATE_FRONT + 0.75, SOCKET_Z + 0.75], plugBack: [0, PLATE_FRONT + 1.12, SOCKET_Z], relief: [0, PLATE_FRONT + 1.62, SOCKET_Z],
  junction: [0.98, PLATE_FRONT + 0.05, SOCKET_Z + 0.2], plugTop: [0, PLATE_FRONT + 0.7, SOCKET_Z + 0.95],
} as const satisfies Record<string, P3>;

/** A chunk of wall standing on a piece of floor, the socket on its face. `scorch` 0..1 browns the plate round the recess; `heat` 0..1 glows round the plug's
    collar. Round 4: the recess is shallow (its floor at the plate's back, so every hole and clip is in view at the camera angle), its wall is a ring of
    faces graded by the tone rule (the faces that look at the viewer only), the holes have a lighter rim, and the scorch is a soft gradient. Draw the plug (IsoPlug) after it. */
export const IsoWallSocket: React.FC<{ u: number; o: P2; scorch?: number; heat?: number; t?: number; plug?: boolean }> = ({ u, o, scorch = 0, heat = 0, t = 0, plug = true }) => {
  const id = React.useId().replace(/:/g, "");
  const hole = circlePts(0, SOCKET_Z, RECESS_R).map(([x, z]) => isoAt([x, PLATE_FRONT, z], u, o));
  const pulse = 1 + 0.05 * Math.sin(t * 9);
  // the recess wall: one face per slice of the ring, from the plate's lip down to the floor; its normal points into the recess, so the faces
  // that look at the viewer are the far side of the hole, each graded by its own direction
  const N = 48, wall: { pts: P2[]; tone: 0 | 1 | 2 }[] = [];
  for (let i = 0; i < N; i++) {
    const a0 = (i / N) * Math.PI * 2, a1 = ((i + 1) / N) * Math.PI * 2, am = (a0 + a1) / 2;
    const n: P3 = [-Math.cos(am), 0, -Math.sin(am)];
    if (!visible(n)) continue;
    const q = (a: number, y: number): P3 => [RECESS_R * Math.cos(a), y, SOCKET_Z + RECESS_R * Math.sin(a)];
    wall.push({ pts: [q(a0, PLATE_FRONT), q(a1, PLATE_FRONT), q(a1, RECESS_FLOOR), q(a0, RECESS_FLOOR)].map((p) => isoAt(p, u, o) as P2), tone: toneOf(n) });
  }
  return (
    <g>
      <defs>
        <clipPath id={`rc${id}`}><polygon points={ptsAttr(hole)} /></clipPath>
        <radialGradient id={`sc${id}`}><stop offset="0%" stopColor="rgb(70,62,56)" stopOpacity={0.7} /><stop offset="100%" stopColor="rgb(70,62,56)" stopOpacity={0} /></radialGradient>
      </defs>
      <IsoBlock a={[-2.1, -0.5, -2.35]} b={[2.1, 2.7, -2.05]} u={u} o={o} tones={ISO.floor} />
      <IsoBlock a={[-2.1, -0.55, -2.05]} b={[2.1, 0, 2.3]} u={u} o={o} tones={ISO.wall} />
      <Polys polys={extrudeXZ(roundRectPts(0, SOCKET_Z, 2.4, 2.4, 0.36), 0, PLATE_FRONT, u, o)} tones={ISO.plastic} />
      {scorch > 0 && <OnPlane y={PLATE_FRONT} u={u} o={o}><circle cx={0} cy={SOCKET_Z} r={1.5} fill={`url(#sc${id})`} opacity={scorch} /></OnPlane>}
      {heat > 0.01 && <OnPlane y={PLATE_FRONT} u={u} o={o}>
        <circle cx={0} cy={SOCKET_Z} r={(1.12 + 0.4 * heat) * pulse} fill={HOT1} opacity={0.7 * heat} />
        <circle cx={0} cy={SOCKET_Z} r={(1.02 + 0.2 * heat) * pulse} fill={HOT2} opacity={0.8 * heat} />
      </OnPlane>}
      <g clipPath={`url(#rc${id})`}>
        {wall.map((w, i) => <polygon key={i} points={ptsAttr(w.pts)} fill={ISO.plastic[w.tone]} stroke={ISO.plastic[w.tone]} strokeWidth={0.6} strokeLinejoin="round" />)}
        <OnPlane y={RECESS_FLOOR} u={u} o={o}>
          <circle cx={0} cy={SOCKET_Z} r={RECESS_R} fill={ISO.plastic[1]} />
          {[-PIN_X, PIN_X].map((x) => <g key={x}><circle cx={x} cy={SOCKET_Z} r={0.2} fill={ISO.plastic[0]} /><circle cx={x} cy={SOCKET_Z} r={0.14} fill={HOLE_SHADE} /></g>)}
          <circle cx={0} cy={SOCKET_Z} r={0.1} fill={ISO.metal[1]} />
          <line x1={-0.07} y1={SOCKET_Z - 0.03} x2={0.07} y2={SOCKET_Z + 0.03} stroke={ISO.metal[2]} strokeWidth={0.03} />
          {scorch > 0 && [-PIN_X, PIN_X].map((x) => <circle key={x} cx={x} cy={SOCKET_Z} r={0.6} fill={`url(#sc${id})`} opacity={scorch} />)}
        </OnPlane>
        {/* the earth clips: two small metal tabs on the recess wall, above and below the centre, clipped by the hole's outline */}
        {[1, -1].map((s) => <IsoBlock key={s} a={[-0.22, RECESS_FLOOR, SOCKET_Z + s * 0.72 - 0.06]} b={[0.22, PLATE_FRONT - 0.02, SOCKET_Z + s * 0.72 + 0.06]} u={u} o={o} tones={ISO.metal} />)}
      </g>
      {/* the lip of the hole: a light rim on the plate */}
      <OnPlane y={PLATE_FRONT} u={u} o={o}><circle cx={0} cy={SOCKET_Z} r={RECESS_R} fill="none" stroke={ISO.plastic[0]} strokeWidth={0.05} opacity={0.9} /></OnPlane>
      {/* the plate screws */}
      {[1.03, -1.03].map((dz) => <g key={dz}>
        <Polys polys={cylinder([0, PLATE_FRONT, SOCKET_Z + dz], [0, PLATE_FRONT + 0.05, SOCKET_Z + dz], 0.1, 0.1, [1, 0, 0], [0, 0, 1], u, o, 24)} tones={ISO.metal} />
        <OnPlane y={PLATE_FRONT + 0.05} u={u} o={o}><line x1={-0.07} y1={SOCKET_Z + dz - 0.04} x2={0.07} y2={SOCKET_Z + dz + 0.04} stroke={ISO.metal[2]} strokeWidth={0.028} /></OnPlane>
      </g>)}
      {!plug && null}
    </g>
  );
};

/** A yellow outline of the plate on its own plane (round 4): it sweeps once round the plate when the new plate goes in, then stays thin while `k` (0..1)
    holds. Draw it after the socket and BEFORE the plug, so the plug covers it where they overlap. `flash` (0..1) briefly brightens the plate. */
export const PlateHighlight: React.FC<{ u: number; o: P2; k: number; sweep: number; flash?: number }> = ({ u, o, k, sweep, flash = 0 }) => {
  if (k <= 0.01 && flash <= 0.01) return null;
  const d = "M " + roundRectPts(0, SOCKET_Z, 2.4, 2.4, 0.36).map(([x, z]) => `${x} ${z}`).join(" L ") + " Z";
  return <OnPlane y={PLATE_FRONT} u={u} o={o}>
    {flash > 0.01 && <path d={d} fill={ISO.plastic[0]} opacity={flash} />}
    {k > 0.01 && <>
      <path d={d} fill="none" stroke={YELLOW} strokeWidth={0.16} strokeLinejoin="round" opacity={0.35 * k} />
      <path d={d} fill="none" stroke={YELLOW} strokeWidth={0.07} strokeLinejoin="round" pathLength={100} strokeDasharray="100 100" strokeDashoffset={100 * (1 - sweep)} opacity={k} />
    </>}
  </OnPlane>;
};

/** A cable from simulated nodes (src/cableSim.ts): a smooth curve through the nodes, three tones along it (a light stripe on the top side, the mid body,
    the dark underside), and a soft contact shadow wherever it lies on the floor or the plate. */
/** The floor the cables lie on: the plane z = CABLE_FLOOR_Z (the floor block of IsoWallSocket is its top). */
export const CABLE_FLOOR_Z = -2.05;
const CableLine: React.FC<{ nodes: readonly P3[]; u: number; o: P2 }> = ({ nodes, u, o }) => {
  const sp = nodes.map((p) => isoAt(p, u, o) as P2), d = smoothPath(sp, 0.5);
  return <g>
    {/* a soft shadow on the floor under each node that is near it (the floor is the plane z = CABLE_FLOOR_Z: round 5) */}
    {nodes.map((p, i) => (p[2] < CABLE_FLOOR_Z + 0.12 ? <ellipse key={i} cx={isoAt([p[0], p[1], CABLE_FLOOR_Z], u, o)[0]} cy={isoAt([p[0], p[1], CABLE_FLOOR_Z], u, o)[1]} rx={u * 0.2} ry={u * 0.07} fill={BLACK} opacity={0.2} /> : null))}
    <path d={d} fill="none" stroke={ISO.dark[2]} strokeWidth={u * 0.25} strokeLinecap="round" strokeLinejoin="round" />
    <path d={d} fill="none" stroke={ISO.dark[1]} strokeWidth={u * 0.15} strokeLinecap="round" strokeLinejoin="round" transform={`translate(${-u * 0.012} ${-u * 0.02})`} />
    <path d={d} fill="none" stroke={ISO.dark[0]} strokeWidth={u * 0.035} strokeLinecap="round" strokeLinejoin="round" transform={`translate(${-u * 0.04} ${-u * 0.05})`} opacity={0.85} />
  </g>;
};

/** The round plug in the socket: collar, a ribbed grip, the back cap, the strain relief with grooves, and the cable as a smooth curve to the floor and
    away. `gap` pulls it out (world units, the pins show), `wobble` (-1..1) rocks it, `heat` warms it. */
export const IsoPlug: React.FC<{ u: number; o: P2; gap?: number; wobble?: number; heat?: number; cable?: boolean; cableTo?: readonly P3[]; cableNodes?: readonly P3[] }> = ({ u, o, gap = 0, wobble = 0, heat = 0, cable = true, cableTo, cableNodes }) => {
  const y0 = PLATE_FRONT + gap, cx = wobble * 0.05, tip = wobble * 0.14;
  const E1: P3 = [1, 0, 0], E2: P3 = [0, 0, 1];
  const at = (dy: number, k = 1): P3 => [cx + tip * k * (dy / 2), y0 + dy, SOCKET_Z];
  const dark = heat > 0 ? ([mix(ISO.dark[0], HOT2, heat * 0.09), mix(ISO.dark[1], HOT2, heat * 0.07), mix(ISO.dark[2], HOT2, heat * 0.05)] as const) : ISO.dark;
  const end = at(1.62);
  const route: P3[] = cableTo ? [end, ...cableTo] : [end, [end[0], end[1] + 0.55, end[2] - 0.15], [0.15, 2.45, -1.2], [0.3, 2.35, -2.05], [1.6, 2.3, -2.05], [3.2, 2.3, -2.05]];
  const screen = route.map((p) => isoAt(p, u, o) as [number, number]);
  const ribs = [0.95, 1.35, 1.75, 2.15, 2.55].map((th) => [Math.cos(th), Math.sin(th)] as const);
  return (
    <g>
      {gap > 0.05 && [-PIN_X, PIN_X].map((x) => <Polys key={x} polys={cylinder([x + cx, y0 - 0.74, SOCKET_Z], [x + cx, y0, SOCKET_Z], 0.1, 0.1, E1, E2, u, o, 24)} tones={ISO.metal} />)}
      <Polys polys={cylinder(at(0), at(0.14), 1.03, 1.03, E1, E2, u, o)} tones={dark} />
      <Polys polys={cylinder(at(0.14), at(1.0), 0.95, 0.86, E1, E2, u, o)} tones={dark} />
      {ribs.map(([c, s], i) => {
        const a = isoAt([at(0.25)[0] + c * 0.955, at(0.25)[1], SOCKET_Z + s * 0.955], u, o), b = isoAt([at(0.92)[0] + c * 0.875, at(0.92)[1], SOCKET_Z + s * 0.875], u, o);
        return <line key={i} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={ISO.dark[1]} strokeWidth={u * 0.05} strokeLinecap="round" />;
      })}
      <Polys polys={cylinder(at(1.0), at(1.16), 0.86, 0.6, E1, E2, u, o)} tones={dark} />
      <Polys polys={cylinder(at(1.14), at(1.62), 0.3, 0.18, E1, E2, u, o, 32)} tones={ISO.dark} />
      {[1.28, 1.4, 1.52].map((dy, i) => { const c = isoAt(at(dy), u, o); return <ellipse key={i} cx={c[0]} cy={c[1]} rx={(0.29 - i * 0.04) * u * 0.87} ry={(0.29 - i * 0.04) * u} fill="none" stroke={ISO.dark[0]} strokeWidth={u * 0.025} opacity={0.6} transform={`rotate(-30 ${c[0]} ${c[1]})`} />; })}
      {cable && cableNodes && <CableLine nodes={cableNodes} u={u} o={o} />}
      {cable && !cableNodes && <>
        <path d={cablePath(screen)} fill="none" stroke={ISO.dark[2]} strokeWidth={u * 0.28} strokeLinecap="round" strokeLinejoin="round" />
        <path d={cablePath(screen.map(([x, y]) => [x - u * 0.03, y - u * 0.05] as [number, number]))} fill="none" stroke={ISO.dark[0]} strokeWidth={u * 0.07} strokeLinecap="round" opacity={0.8} />
      </>}
    </g>
  );
};

// ------------------------------------------------------------------------------------------------------------------------------------- the cutaway
const PIN = { x0: -0.9, x1: 2.25, r: 0.17, y: -0.22 };
const LEAF_T = 0.1;
/** A spring leaf's centre line in (x, z): `s` = +1 top, -1 bottom; `loose` 0..1 lets it spring away (the top one then only touches at one point). */
export function leafLine(s: 1 | -1, loose: number): P2[] {
  const on = PIN.r + LEAF_T / 2;
  const tight: P2[] = [[2.58, 0.5], [2.0, 0.42], [1.5, on + 0.01], [1.15, on], [0.88, on], [0.74, 0.33]];
  const off: P2[] = s > 0 ? [[2.58, 0.5], [2.0, 0.46], [1.45, 0.35], [1.12, on + 0.03], [1.0, on], [0.8, 0.37]] : [[2.58, 0.5], [2.0, 0.49], [1.5, 0.45], [1.15, 0.39], [0.95, 0.38], [0.76, 0.47]];
  return tight.map(([x, z], i) => [x + (off[i][0] - x) * loose, s * (z + (off[i][1] - z) * loose)] as P2);
}
/** The contact point (x, z) on the cut plane: the middle of the long touch when tight, the one point when loose. */
export const isoContact = (loose: number): P2 => [1.2 - 0.2 * loose, PIN.r + 0.01];
/** Named world points of the cutaway. */
export const ISO_CUT_POINTS = {
  leaf: [2.05, 0, 0.44], pin: [-0.3, 0, -0.17], pinTip: [2.2, 0, 0], plug: [-1.2, 0, 0.6], wire: [3.9, -0.3, 0], housing: [1.8, 0, 1.1], terminal: [2.64, 0, 0.3],
} as const satisfies Record<string, P3>;
export const isoContactPoint = (loose: number): P3 => { const c = isoContact(loose); return [c[0], 0.05, c[1]]; };

function leafOutline(line: readonly P2[]): P2[] {
  // thicken the centre line (sampled smoothly) into a strip
  const pts: P2[] = [];
  for (let i = 0; i < line.length - 1; i++) for (let k = 0; k < 8; k++) {
    const p0 = line[Math.max(0, i - 1)], p1 = line[i], p2 = line[i + 1], p3 = line[Math.min(line.length - 1, i + 2)], t = k / 8, t2 = t * t, t3 = t2 * t;
    const f = (a: number, b: number, c: number, d: number) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
    pts.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
  }
  pts.push(line[line.length - 1]);
  const a: P2[] = [], b: P2[] = [];
  pts.forEach((p, i) => {
    const q0 = pts[Math.max(0, i - 1)], q1 = pts[Math.min(pts.length - 1, i + 1)], dx = q1[0] - q0[0], dz = q1[1] - q0[1], l = Math.hypot(dx, dz) || 1;
    a.push([p[0] - (dz / l) * LEAF_T / 2, p[1] + (dx / l) * LEAF_T / 2]); b.push([p[0] + (dz / l) * LEAF_T / 2, p[1] - (dx / l) * LEAF_T / 2]);
  });
  return [...a, ...b.reverse()];
}

/** A leaf: its strip extruded from y = -0.5 to 0 (brass, three tones), warmed towards orange by the heat (the top one, where it touches). */
const Leaf: React.FC<{ s: 1 | -1; loose: number; heat: number; u: number; o: P2 }> = ({ s, loose, heat, u, o }) => {
  const tones = ISO.brass.map((c) => mix(c, HOT2, heat * (s > 0 ? 0.6 : 0.15))) as unknown as Tones;
  return <Polys polys={extrudeAnyXZ(leafOutline(leafLine(s, loose)), -0.45, 0, u, o)} tones={tones} />;
};

/** The current's paths in (x, z): in along the cable's core and the pin, across the contact into a leaf, along it to the terminal, out along the wire. */
export function currentPaths(loose: number): P2[][] {
  const on = PIN.r + 0.03;
  if (loose < 0.5) return [1, -1].map((s) => [[-4.8, 0], [-0.9, 0], [0.95, 0], [1.15, s * on], [1.6, s * 0.3], [2.1, s * 0.45], [2.6, s * 0.47], [2.66, s * 0.12], [2.85, 0], [5.0, 0]] as P2[]);
  const c = isoContact(loose);
  return [[[-4.8, 0], [-0.9, 0], [c[0] - 0.14, 0], [c[0], on], [c[0] + 0.3, 0.31], [2.1, 0.46], [2.6, 0.48], [2.66, 0.12], [2.85, 0], [5.0, 0]]];
}

/** The cutaway of one contact (a lab scene). `loose` 0..1, `heat` 0..1 (the contact glows, the top leaf warms), `current` 0..1 (the dashes' opacity),
    `t` seconds (the dashes flow; loose: faster, and they crowd at the narrow point). */
export const IsoCutaway: React.FC<{ u: number; o: P2; loose?: number; heat?: number; current?: number; t: number }> = ({ u, o, loose = 0, heat = 0, current = 1, t }) => {
  const id = `h${React.useId().replace(/:/g, "")}`;
  const H = ISO.labPlastic, Y: [number, number] = [-0.7, 0], TOP: [number, number] = [-0.7, -0.48];
  const bk = (x0: number, z0: number, x1: number, z1: number, tones: Tones = H, y: [number, number] = Y, hatch = true) => <IsoBlock a={[x0, y[0], z0]} b={[x1, y[1], z1]} u={u} o={o} tones={tones} hatch={hatch ? id : undefined} />;
  const E: [P3, P3] = [[0, 1, 0], [0, 0, 1]];
  const c = isoContact(loose), cs = isoAt([c[0], 0.05, c[1]], u, o), pulse = 1 + 0.08 * Math.sin(t * 13);
  const paths = currentPaths(loose), speed = 1.2 + 1.4 * loose;
  return (
    <g>
      <defs>
        <Hatch id={id} />
        <radialGradient id={`${id}g`}><stop offset="0%" stopColor={RED} stopOpacity={1} /><stop offset="35%" stopColor={HOT2} stopOpacity={0.9} /><stop offset="70%" stopColor={HOT1} stopOpacity={0.45} /><stop offset="100%" stopColor={HOT1} stopOpacity={0} /></radialGradient>
      </defs>
      {/* the hollow's back wall, then the plug (cut), its strain relief and cable */}
      <OnPlane y={-0.7} u={u} o={o}><rect x={0} y={-0.9} width={2.72} height={1.8} fill={CAVITY_SHADE} /></OnPlane>
      <Polys polys={cylinder([-5.2, -0.35, 0], [-2.6, -0.35, 0], 0.15, 0.15, ...E, u, o, 28)} tones={ISO.dark} />
      <Polys polys={extrudeXZ([[-2.62, -0.2], [-1.9, -0.33], [-1.9, 0.33], [-2.62, 0.2]], -0.6, -0.1, u, o)} tones={ISO.dark} />
      <Polys polys={extrudeXZ(roundRectPts(-1.18, 0, 1.54, 1.84, 0.3), -0.7, 0, u, o)} tones={ISO.dark} />
      {bk(-0.42, -1.04, -0.25, 1.04, ISO.dark)}
      {bk(0, -0.84, 0.47, 0.84, ISO.dark)}
      <OnPlane y={0.002} u={u} o={o}><rect x={-2.6} y={-0.05} width={1.75} height={0.1} fill={ISO.brass[1]} /><rect x={-0.98} y={-0.13} width={0.2} height={0.26} fill={ISO.metal[1]} /></OnPlane>
      {/* the insert, bottom half, then the bottom leaf, the pin, the top leaf, the top half, the plate */}
      {bk(0, -1.3, 3.0, -0.9)}{bk(0.5, -0.9, 3.0, -0.62)}{bk(0.5, -0.62, 0.8, -0.21)}{bk(2.72, -0.62, 3.0, -0.13)}
      <Leaf s={-1} loose={loose} heat={heat} u={u} o={o} />
      <Polys polys={cylinder([PIN.x0, PIN.y, 0], [PIN.x1, PIN.y, 0], PIN.r, PIN.r, ...E, u, o)} tones={ISO.metal} />
      <Polys polys={cylinder([PIN.x1, PIN.y, 0], [PIN.x1 + 0.12, PIN.y, 0], PIN.r, 0.07, ...E, u, o, 32)} tones={ISO.metal} />
      <Leaf s={1} loose={loose} heat={heat} u={u} o={o} />
      {/* the top half is cut back further (a stepped cut) so the top leaf can be seen from above */}
      {bk(0.5, 0.21, 0.8, 0.62, H, TOP)}{bk(2.72, 0.13, 3.0, 0.62, H, TOP)}{bk(0.5, 0.62, 3.0, 0.9, H, TOP)}{bk(0, 0.9, 3.0, 1.3, H, TOP)}
      {bk(-0.25, 0.9, 0, 2.0, ISO.plastic, [-0.9, 0.1])}{bk(-0.25, -2.0, 0, -0.9, ISO.plastic, [-0.9, 0.1])}
      {/* the terminal block, its screw head on top, the wire out of the back */}
      {bk(2.56, -0.6, 2.72, 0.6, ISO.metal, [-0.55, -0.1], false)}
      <Polys polys={cylinder([2.64, -0.35, 1.3], [2.64, -0.35, 1.42], 0.13, 0.13, [1, 0, 0], [0, 1, 0], u, o, 24)} tones={ISO.metal} />
      <Polys polys={cylinder([2.72, -0.3, 0], [3.25, -0.3, 0], 0.07, 0.07, ...E, u, o, 20)} tones={ISO.brass} />
      <Polys polys={cylinder([3.0, -0.3, 0], [5.4, -0.3, 0], 0.13, 0.13, ...E, u, o, 28)} tones={ISO.dark} />
      {/* the current: yellow dashes flowing along its paths (in front of the cut) */}
      {current > 0.01 && <OnPlane y={0.06} u={u} o={o}>
        {paths.map((p, i) => <path key={i} d={smoothPath(p)} fill="none" stroke={YELLOW} strokeWidth={0.065} strokeLinecap="round" strokeDasharray="0.16 0.15" strokeDashoffset={-(t * speed) - i * 0.15} opacity={current} />)}
        {loose >= 0.5 && <circle cx={c[0]} cy={c[1]} r={0.09} fill={YELLOW} opacity={current * (0.6 + 0.4 * Math.sin(t * 20))} />}
      </OnPlane>}
      {heat > 0.01 && <circle cx={cs[0]} cy={cs[1]} r={u * 0.7 * heat * pulse} fill={`url(#${id}g)`} />}
    </g>
  );
};

// ------------------------------------------------------------------------------------------------------------------------------------- particles
/** Heat rising: wavy orange-red lines climbing from (x, y) (screen px) and fading, `k` 0..1 how hot. */
export const HeatRise: React.FC<{ x: number; y: number; k: number; t: number; scale?: number }> = ({ x, y, k, t, scale = 1 }) => {
  if (k <= 0.02) return null;
  return (
    <g opacity={Math.min(1, k * 1.3)}>
      {[-1, 0, 1].map((i) => {
        const ph = ((t * 0.9 + i * 0.33) % 1 + 1) % 1, y0 = y - ph * 150 * scale, op = Math.sin(Math.PI * ph);
        const d = Array.from({ length: 13 }, (_, j) => { const yy = y0 - j * 9 * scale; return `${j ? "L" : "M"} ${x + i * 46 * scale + Math.sin(j * 0.9 + t * 6 + i) * 9 * scale} ${yy}`; }).join(" ");
        return <path key={i} d={d} fill="none" stroke={i === 0 ? RED : HOT2} strokeWidth={7 * scale} strokeLinecap="round" opacity={op} />;
      })}
    </g>
  );
};
/** Smoke: puffs in three greys (dark underside, mid body, light top) that rise, grow and fade. */
export const SmokePuffs: React.FC<{ x: number; y: number; k: number; t: number; scale?: number }> = ({ x, y, k, t, scale = 1 }) => {
  if (k <= 0.02) return null;
  return (
    <g opacity={k}>
      {[0, 1, 2, 3].map((i) => {
        const ph = ((t * 0.45 + i * 0.25) % 1 + 1) % 1, r = (26 + 40 * ph) * scale, cx = x + Math.sin(t * 1.3 + i * 2) * 26 * scale + (i % 2 ? 30 : -24) * scale, cy = y - ph * 260 * scale;
        return (
          <g key={i} opacity={Math.sin(Math.PI * Math.min(1, ph * 1.15))}>
            <circle cx={cx + r * 0.1} cy={cy + r * 0.18} r={r} fill={ISO.dark[0]} opacity={0.55} />
            <circle cx={cx} cy={cy} r={r * 0.92} fill={ISO.metal[2]} />
            <circle cx={cx - r * 0.3} cy={cy - r * 0.3} r={r * 0.45} fill={ISO.metal[1]} />
          </g>
        );
      })}
    </g>
  );
};
/** Sparks thrown off a hot point (screen px): small yellow and orange dots flying out and falling. */
export const Sparks: React.FC<{ x: number; y: number; k: number; t: number; scale?: number }> = ({ x, y, k, t, scale = 1 }) => {
  if (k <= 0.05) return null;
  return (
    <g>
      {Array.from({ length: 9 }, (_, i) => {
        const ph = ((t * 1.4 + i * 0.111) % 1 + 1) % 1, a = (i * 137.5 * Math.PI) / 180, v = (70 + (i % 3) * 40) * scale;
        return <circle key={i} cx={x + Math.cos(a) * v * ph} cy={y + Math.sin(a) * v * ph * 0.7 + 90 * ph * ph * scale} r={(6 - 4 * ph) * scale} fill={i % 2 ? YELLOW : HOT2} opacity={k * (1 - ph)} />;
      })}
    </g>
  );
};
/** Dust in the air: faint dots drifting slowly (a near layer, for parallax). */
export const Motes: React.FC<{ t: number; color?: string; n?: number; opacity?: number }> = ({ t, color = "#ffffff", n = 18, opacity = 0.18 }) => (
  <g opacity={opacity}>
    {Array.from({ length: n }, (_, i) => {
      const x = ((i * 397) % 1080) + Math.sin(t * 0.3 + i) * 30, y = (((i * 613) % 1920) - t * (12 + (i % 5) * 4) + 1920 * 4) % 1920;
      return <circle key={i} cx={x} cy={y} r={3 + (i % 3) * 2} fill={color} />;
    })}
  </g>
);
