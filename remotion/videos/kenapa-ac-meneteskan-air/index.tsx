/* Kenapa AC meneteskan air? — a custom video (videos/kenapa-ac-meneteskan-air/). READ remotion/DESIGN.md FIRST.
   One set (B27.15, set.json "ac-wall-section"): a house cut open along the plane x = XC. Left: the bedroom, its outer wall with the split AC's indoor unit high on it
   (the hero: a long box with the intake grille on top, the front cover, the display and the swinging louver at the bottom), a tiled floor and a potted plant.
   Right: the garden outside that wall, one step lower: a paved yard, the outdoor unit with its fan, a fence and the neighbour's wall far back. The drain hose leaves
   the indoor unit, crosses the wall in the cut face and hangs down outside over a floor drain; the refrigerant pipes run beside it to the outdoor unit.
   What the video shows: warm room air with its vapour is drawn into the unit; the cover opens on the cold evaporator coil (fins, copper bends), the cross-flow fan and
   the drain pan; the vapour condenses on the fins as drops that fall into the pan; the water runs down the hose and drips outside (normal); the outlet clogs, the pan
   overflows and drips inside onto the floor (the bad case); the outlet is cleared and the drip goes back outside. Every word comes from the checked story.
   Colours are tokens (the ISO tone sets). The camera is a function of the video's clock (plan.ts camAt). */
import React from "react";
import {
  BLACK, Brand, CaptionLayer, FONT_BOLD, G2, G3, Hatch, ISO, IsoBlock, Mascot, NumberLabel, OnPlane, Polys, SourceChip, STEAM, StoryVideo, TopText, WHITE, YELLOW,
  block, circlePts, cylinder, easeInOut, layerTransform, ptsAttr, smoothPath, springAt, swayDeg, toScreen,
  type P2, type P3, type Poly, type SceneProps, type StoryT, type Tones,
} from "../../src/design/index.ts";
import { Motes } from "../../src/components/Iso.tsx";
import {
  COIL, DRAIN, DRIP_PERIOD, FENCE_Y, FRONT_Y, HOSE, HOSE_END, NEIGHBOUR_Y, O, OUT, PAN, PLANT, U, UNIT, WALL_T, WB, XC, YARD_Z, camAt, makePlan, stateAt, world,
} from "./plan.ts";
import storyJson from "./story.json";

export const story = storyJson as unknown as StoryT;

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const AX: P3 = [1, 0, 0], AY: P3 = [0, 1, 0], AZ: P3 = [0, 0, 1];
const u = U, o = O;
const W = (p: P3): P2 => world(p);
const poly = (pts: readonly P3[]) => ptsAttr(pts.map(W));
/** A flat ellipse lying on a horizontal face at height z. */
const flatEllipse = (cx: number, cy: number, z: number, rx: number, ry: number) => ptsAttr(circlePts(0, 0, 1, 28).map(([a, b]) => W([cx + a * rx, cy + b * ry, z])));
/** Only the face of a block that looks +x (tone 2): a cut face. */
const xFace = (polys: Poly[]) => ptsAttr(polys[0].pts);

// ------------------------------------------------------------------------------------------------------ the far layer of the garden: the neighbour's wall and the fence
const Garden: React.FC = () => (
  <g>
    <Polys polys={block([XC - 30, NEIGHBOUR_Y - 1.2, YARD_Z], [140, NEIGHBOUR_Y, 30], u, o)} tones={ISO.labPlastic} />
    {/* the neighbour's wall: a coping on its top and a plinth band */}
    <Polys polys={block([XC - 30, NEIGHBOUR_Y - 1.4, 30], [140, NEIGHBOUR_Y + 0.3, 31], u, o)} tones={ISO.metal} />
    <Polys polys={block([XC - 30, NEIGHBOUR_Y, YARD_Z], [140, NEIGHBOUR_Y + 0.25, YARD_Z + 2.5], u, o)} tones={ISO.stone} />
    {/* the yard: concrete paving, cut at the front edge of the diorama, with its joints */}
    <Polys polys={block([XC - 40, NEIGHBOUR_Y, -40], [140, FRONT_Y, YARD_Z], u, o)} tones={ISO.stone} />
    {Array.from({ length: 9 }, (_, i) => XC + 4 + i * 6).map((x) => <polyline key={`jx${x}`} points={poly([[x, NEIGHBOUR_Y + 0.3, YARD_Z + 0.01], [x, FRONT_Y, YARD_Z + 0.01]])} stroke={ISO.stone[2]} strokeWidth={2.5} fill="none" opacity={0.6} />)}
    {Array.from({ length: 7 }, (_, i) => NEIGHBOUR_Y + 4 + i * 6).map((y) => <polyline key={`jy${y}`} points={poly([[XC - 40, y, YARD_Z + 0.01], [140, y, YARD_Z + 0.01]])} stroke={ISO.stone[2]} strokeWidth={2.5} fill="none" opacity={0.6} />)}
    {/* the fence: two rails and slats */}
    <Polys polys={block([XC - 20, FENCE_Y - 0.4, YARD_Z + 3], [140, FENCE_Y, YARD_Z + 3.6], u, o)} tones={ISO.dark} />
    <Polys polys={block([XC - 20, FENCE_Y - 0.4, YARD_Z + 11.5], [140, FENCE_Y, YARD_Z + 12.1], u, o)} tones={ISO.dark} />
    {Array.from({ length: 46 }, (_, i) => XC - 22 + i * 1.6).map((x) => <Polys key={`s${x}`} polys={block([x, FENCE_Y, YARD_Z], [x + 1.0, FENCE_Y + 0.3, YARD_Z + 13], u, o)} tones={ISO.labPlastic} />)}
  </g>
);

// ------------------------------------------------------------------------------------------------------ the house: the outer wall and the bedroom floor, cut at x = XC
const House: React.FC = () => {
  const wall = block([-80, WB - WALL_T, -40], [XC, WB, 90], u, o);
  const floor = block([-80, WB, -40], [XC, FRONT_Y, 0], u, o);
  return (
    <g>
      <Polys polys={wall} tones={ISO.wall} />
      <polygon points={xFace(wall)} fill="url(#ac-cut)" />
      {/* a skirting board along the foot of the wall */}
      <Polys polys={block([-80, WB, 0], [XC, WB + 0.15, 1.0], u, o)} tones={ISO.metal} />
      <Polys polys={floor} tones={ISO.floor} />
      <polygon points={xFace(floor)} fill="url(#ac-cut)" />
      {/* floor tiles, 60 cm */}
      {Array.from({ length: 14 }, (_, i) => XC - i * 6).map((x) => <polyline key={`fx${x}`} points={poly([[x, WB + 0.15, 0.01], [x, FRONT_Y, 0.01]])} stroke={ISO.floor[2]} strokeWidth={2} fill="none" opacity={0.55} />)}
      {[WB + 5, WB + 11].map((y) => <polyline key={`fy${y}`} points={poly([[-80, y, 0.01], [XC, y, 0.01]])} stroke={ISO.floor[2]} strokeWidth={2} fill="none" opacity={0.55} />)}
      {/* the plinth step down to the yard: a thin band of the floor's edge */}
      <Polys polys={block([XC, WB, -0.4], [XC + 0.25, FRONT_Y, 0], u, o)} tones={ISO.metal} />
    </g>
  );
};

// ------------------------------------------------------------------------------------------------------ the dressing inside: a potted plant (50 cm)
const Plant: React.FC<{ clock: number }> = ({ clock }) => {
  const { x, y } = PLANT, sway = swayDeg(clock, 0.2, 2, 4);
  const top = W([x, y, 3.2]);
  const leaves: [number, number, number, number][] = [[-1.3, -1.6, 1.0, -30], [1.2, -1.4, 0.95, 28], [-0.4, -2.6, 1.1, -8], [0.7, -2.3, 0.9, 14], [-1.0, -0.8, 0.8, -50], [1.1, -0.6, 0.75, 52]];
  return (
    <g>
      <polygon points={flatEllipse(x + 0.4, y + 0.4, 0.01, 1.9, 1.7)} fill={ISO.floor[2]} opacity={0.5} />
      <Polys polys={cylinder([x, y, 0], [x, y, 3.2], 1.25, 1.6, AX, AY, u, o)} tones={ISO.labPlastic} />
      <polygon points={flatEllipse(x, y, 3.21, 1.4, 1.4)} fill={ISO.soil[2]} />
      <g transform={`rotate(${sway} ${top[0]} ${top[1]})`}>
        {leaves.map(([dx, dy, s, r], i) => {
          const cx = top[0] + dx * u, cy = top[1] + dy * u;
          return <g key={i} transform={`rotate(${r} ${cx} ${cy})`}>
            <ellipse cx={cx} cy={cy} rx={u * 0.42 * s} ry={u * 1.1 * s} fill={i % 2 ? ISO.leaf[1] : ISO.leaf[0]} />
            <ellipse cx={cx + u * 0.12 * s} cy={cy} rx={u * 0.2 * s} ry={u * 1.0 * s} fill={ISO.leaf[2]} opacity={0.55} />
          </g>;
        })}
      </g>
    </g>
  );
};

// ------------------------------------------------------------------------------------------------------ the outdoor unit (a supporting asset): a box on feet with a fan behind a round grille
const OutdoorUnit: React.FC<{ clock: number }> = ({ clock }) => {
  const { x0, x1, y0, y1, z0, z1 } = OUT, cx = (x0 + x1) / 2 - 1.0, cz = (z0 + z1) / 2, r = 2.1, spin = clock * 360 * 1.5;
  return (
    <g>
      <polygon points={poly([[x0 - 0.2, y0, YARD_Z + 0.01], [x1 + 0.6, y0, YARD_Z + 0.01], [x1 + 0.6, y1 + 0.6, YARD_Z + 0.01], [x0 - 0.2, y1 + 0.6, YARD_Z + 0.01]])} fill={ISO.stone[2]} opacity={0.45} />
      {[x0 + 0.6, x1 - 1.0].map((fx) => <Polys key={fx} polys={block([fx, y0 + 0.2, YARD_Z], [fx + 0.4, y1 - 0.2, z0], u, o)} tones={ISO.dark} />)}
      <IsoBlock a={[x0, y0, z0]} b={[x1, y1, z1]} u={u} o={o} tones={ISO.labPlastic} />
      <OnPlane y={y1} u={u} o={o}>
        <circle cx={cx} cy={cz} r={r} fill={ISO.dark[1]} />
        <g transform={`rotate(${spin} ${cx} ${cz})`}>
          {[0, 120, 240].map((a) => <ellipse key={a} cx={cx + 0.95 * Math.cos((a * Math.PI) / 180)} cy={cz + 0.95 * Math.sin((a * Math.PI) / 180)} rx={0.95} ry={0.42} transform={`rotate(${a} ${cx + 0.95 * Math.cos((a * Math.PI) / 180)} ${cz + 0.95 * Math.sin((a * Math.PI) / 180)})`} fill={ISO.dark[0]} />)}
          <circle cx={cx} cy={cz} r={0.3} fill={ISO.dark[2]} />
        </g>
        {[0.7, 1.4, 2.05].map((rr) => <circle key={rr} cx={cx} cy={cz} r={rr} fill="none" stroke={ISO.labPlastic[0]} strokeWidth={0.09} />)}
        <line x1={cx - r} y1={cz} x2={cx + r} y2={cz} stroke={ISO.labPlastic[0]} strokeWidth={0.09} />
        <line x1={cx} y1={cz - r} x2={cx} y2={cz + r} stroke={ISO.labPlastic[0]} strokeWidth={0.09} />
        {/* the side panel's louvres */}
        {[0, 1, 2, 3, 4, 5].map((i) => <rect key={i} x={x1 - 2.0} y={z0 + 0.8 + i * 0.7} width={1.4} height={0.22} fill={ISO.labPlastic[2]} />)}
      </OnPlane>
      {/* the valve cover where the pipes come in */}
      <Polys polys={block([x0 - 0.5, y1 - 1.6, z0 + 0.8], [x0, y1 - 0.4, z0 + 2.4], u, o)} tones={ISO.labPlastic} />
    </g>
  );
};

// ------------------------------------------------------------------------------------------------------ the pipes and the hose: tubes with a body, a lit stripe and a shade
const Tube: React.FC<{ pts: readonly P3[]; w: number; tones: Tones; ribs?: boolean }> = ({ pts, w, tones, ribs }) => {
  const d = smoothPath(pts.map(W), 0.5);
  return (
    <g fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} stroke={tones[2]} strokeWidth={w} />
      <path d={d} stroke={tones[1]} strokeWidth={w * 0.72} transform={`translate(${-w * 0.08} 0)`} />
      <path d={d} stroke={tones[0]} strokeWidth={w * 0.22} transform={`translate(${-w * 0.22} 0)`} />
      {ribs && <path d={d} stroke={tones[2]} strokeWidth={w * 0.8} strokeDasharray={`${w * 0.12} ${w * 0.38}`} opacity={0.35} />}
    </g>
  );
};
const PIPES: readonly P3[] = [[XC - 0.6, WB + 0.3, 21.4], [XC + 0.05, WB - 0.1, 21.2], [XC + 0.1, WB - WALL_T - 0.3, 21.0], [XC + 0.5, WB - WALL_T - 0.7, 19.6], [XC + 0.55, WB - WALL_T - 0.75, 6], [XC + 1.2, WB - WALL_T - 1.4, YARD_Z + 2.4], [OUT.x0 - 0.5, OUT.y1 - 1.0, OUT.z0 + 1.6]];

// ------------------------------------------------------------------------------------------------------ the drip outside: a drop forms at the hose's end and falls into the drain, a ring spreads
const DripOutside: React.FC<{ clock: number; k: number }> = ({ clock, k }) => {
  if (k < 0.02) return null;
  const end = W(HOSE_END), floor = W([DRAIN.x, DRAIN.y, DRAIN.z + 0.02]), fallPx = floor[1] - end[1];
  return (
    <g>
      {[0, 0.5].map((ph) => {
        const p = (((clock / DRIP_PERIOD + ph) % 1) + 1) % 1;
        const grow = clamp01(p / 0.55), fall = clamp01((p - 0.55) / 0.3), ring = clamp01((p - 0.85) / 0.15);
        const y = end[1] + u * 0.25 + fall * fall * fallPx, r = u * (0.12 + 0.12 * grow);
        return <g key={ph} opacity={k}>
          {p < 0.86 && <g>
            <ellipse cx={end[0]} cy={y} rx={r * 0.85} ry={r * (1 + 0.3 * fall)} fill={ISO.water[1]} />
            <ellipse cx={end[0] - r * 0.25} cy={y - r * 0.3} rx={r * 0.28} ry={r * 0.32} fill={ISO.water[0]} />
          </g>}
          {ring > 0 && <polygon points={flatEllipse(DRAIN.x, DRAIN.y, DRAIN.z + 0.03, 0.3 + 1.2 * ring, 0.3 + 1.2 * ring)} fill="none" stroke={ISO.water[0]} strokeWidth={4} opacity={1 - ring} />}
        </g>;
      })}
    </g>
  );
};
const Drain: React.FC<{ wet: number }> = ({ wet }) => {
  const z = DRAIN.z + 0.015, { x, y } = DRAIN;
  return (
    <g>
      <polygon points={poly([[x - 1.6, y - 1.6, z], [x + 1.6, y - 1.6, z], [x + 1.6, y + 1.6, z], [x - 1.6, y + 1.6, z]])} fill={ISO.metal[2]} />
      {[-1.0, -0.4, 0.2, 0.8].map((dx) => <polygon key={dx} points={poly([[x + dx, y - 1.3, z + 0.01], [x + dx + 0.3, y - 1.3, z + 0.01], [x + dx + 0.3, y + 1.3, z + 0.01], [x + dx, y + 1.3, z + 0.01]])} fill={G2} />)}
      <polygon points={flatEllipse(x + 1.4, y + 2.6, DRAIN.z + 0.01, 2.2 * wet + 0.01, 1.4 * wet + 0.01)} fill={ISO.water[0]} opacity={0.5 * wet} />
    </g>
  );
};

// ------------------------------------------------------------------------------------------------------ the indoor unit (the hero)
const FIN_X = Array.from({ length: 42 }, (_, i) => COIL.x0 + 0.12 + i * ((COIL.x1 - COIL.x0 - 0.24) / 41));
const DEW: readonly (readonly [number, number, number])[] = [[1.2, 22.7, 0], [2.3, 22.2, 0.35], [3.4, 22.9, 0.7], [4.6, 22.4, 0.15], [5.6, 22.8, 0.55], [6.5, 22.1, 0.85], [7.3, 22.6, 0.25]];
const IndoorUnit: React.FC<{ clock: number; st: ReturnType<typeof stateAt> }> = ({ clock, st }) => {
  const { x0, x1, y0, y1, z0, z1 } = UNIT, open = st.open;
  const level = PAN.z0 + 0.06 + 0.24 * st.pan;
  return (
    <g>
      {/* the mounting shadow on the wall */}
      <polygon points={poly([[x0 + 0.3, y0 + 0.01, z0 - 0.4], [x1 + 0.3, y0 + 0.01, z0 - 0.4], [x1 + 0.3, y0 + 0.01, z1 - 0.2], [x0 + 0.3, y0 + 0.01, z1 - 0.2]])} fill={ISO.wall[2]} opacity={0.6} />
      {open > 0.01 && <g>
        {/* the inside: the back panel, the floor of the casing and the left end */}
        <Polys polys={block([x0, y0, z0], [x1, y0 + 0.1, z1], u, o)} tones={ISO.dark} />
        <Polys polys={block([x0, y0, z0], [x1, y1, z0 + 0.08], u, o)} tones={ISO.labPlastic} />
        <Polys polys={block([x0, y0, z0], [x0 + 0.1, y1, z1], u, o)} tones={ISO.labPlastic} />
        {/* the cross-flow fan behind the coil: a long drum with blades that run past */}
        <Polys polys={cylinder([x0 + 0.3, y0 + 0.75, 21.15], [x1 - 0.3, y0 + 0.75, 21.15], 0.42, 0.42, AY, AZ, u, o)} tones={ISO.dark} />
        {Array.from({ length: 10 }, (_, i) => x0 + 0.6 + i * 0.78).map((bx) => {
          const a = ((clock * 4 + bx) % 1) * Math.PI * 2;
          return <polyline key={bx} points={poly([[bx, y0 + 0.75 + 0.42 * Math.cos(a), 21.15 + 0.42 * Math.sin(a)], [bx + 0.5, y0 + 0.75 + 0.42 * Math.cos(a), 21.15 + 0.42 * Math.sin(a)]])} stroke={ISO.dark[0]} strokeWidth={3} />;
        })}
        {/* the evaporator coil: a block of thin aluminium fins with copper bends at its ends */}
        <Polys polys={block([COIL.x0, COIL.y0, COIL.z0], [COIL.x1, COIL.y1, COIL.z1], u, o)} tones={ISO.metal} />
        <OnPlane y={COIL.y1} u={u} o={o}>
          {FIN_X.map((fx) => <line key={fx} x1={fx} y1={COIL.z0 + 0.04} x2={fx} y2={COIL.z1 - 0.04} stroke={G3} strokeWidth={0.035} />)}
          {[COIL.x0 + 0.1, COIL.x1 - 0.1].map((bx) => [21.6, 22.1, 22.6, 23.0].map((bz) => <g key={`${bx}${bz}`}><circle cx={bx} cy={bz} r={0.11} fill={ISO.brass[1]} /><circle cx={bx - 0.03} cy={bz + 0.03} r={0.05} fill={ISO.brass[0]} /></g>))}
          <rect x={COIL.x0} y={COIL.z0} width={COIL.x1 - COIL.x0} height={COIL.z1 - COIL.z0} fill={STEAM} opacity={0.35 * st.cold} />
        </OnPlane>
        {/* the dew: drops grow on the fins, run down and fall into the pan (a 2 s cycle each) */}
        {st.dew > 0.02 && DEW.map(([dx, dz, ph], i) => {
          const p = (((clock / 2 + ph) % 1) + 1) % 1, x = COIL.x0 + dx;
          const grow = clamp01(p / 0.55), slide = clamp01((p - 0.55) / 0.2), fall = clamp01((p - 0.75) / 0.25);
          const z = fall > 0 ? COIL.z0 - fall * fall * (COIL.z0 - level) : dz - slide * (dz - COIL.z0 - 0.1);
          const yy = fall > 0 ? COIL.y1 - 0.1 : COIL.y1 + 0.02, c = W([x, yy, z]), r = u * 0.075 * (0.4 + 0.6 * grow) * st.dew;
          return <g key={i}><ellipse cx={c[0]} cy={c[1]} rx={r} ry={r * 1.2} fill={ISO.water[1]} /><circle cx={c[0] - r * 0.3} cy={c[1] - r * 0.35} r={r * 0.35} fill={ISO.water[0]} /></g>;
        })}
        {/* the drain pan under the coil, with its water and the outlet at its right end */}
        <Polys polys={block([PAN.x0, PAN.y0, PAN.z0], [PAN.x1, PAN.y1, PAN.z0 + 0.05], u, o)} tones={ISO.labPlastic} />
        <Polys polys={block([PAN.x0 + 0.06, PAN.y0 + 0.06, PAN.z0 + 0.05], [PAN.x1 - 0.06, PAN.y1 - 0.06, level], u, o)} tones={ISO.water} />
        {/* ripples where the drops land */}
        {st.dew > 0.02 && [0.2, 0.75].map((ph, i) => { const p = (((clock / 2 + ph) % 1) + 1) % 1; return <polygon key={i} points={flatEllipse(COIL.x0 + 2.3 + i * 3.6, (PAN.y0 + PAN.y1) / 2, level + 0.005, 0.1 + 0.4 * p, 0.08 + 0.2 * p)} fill="none" stroke={ISO.water[0]} strokeWidth={2.5} opacity={(1 - p) * st.dew} />; })}
        <Polys polys={block([PAN.x0, PAN.y1 - 0.06, PAN.z0], [PAN.x1, PAN.y1, PAN.z1], u, o)} tones={ISO.labPlastic} />
        {/* the clog: dirt in the outlet (bocor) */}
        {st.clog > 0.02 && <g opacity={st.clog}>
          {[[0.25, 0.2, 0.16], [0.5, 0.35, 0.12], [0.35, 0.55, 0.1]].map(([dx, dy, r], i) => { const c = W([PAN.x1 - dx, PAN.y0 + dy + 0.2, level + 0.05]); return <circle key={i} cx={c[0]} cy={c[1]} r={u * r * (0.6 + 0.4 * st.clog)} fill={i ? G2 : ISO.dark[2]} />; })}
        </g>}
        {/* the overflow: water runs over the pan's lip */}
        {st.leak > 0.02 && <polygon points={poly([[x0 + 2.4, PAN.y1, PAN.z1], [x0 + 4.0, PAN.y1, PAN.z1], [x0 + 3.6, PAN.y1 + 0.02, z0 + 0.05], [x0 + 2.8, PAN.y1 + 0.02, z0 + 0.05]])} fill={ISO.water[1]} opacity={0.85 * st.leak} />}
      </g>}
      {/* the casing: the right end, the top with its intake grille, then the front cover (it lifts away and fades when the unit is opened) */}
      <Polys polys={block([x1 - 0.1, y0, z0], [x1, y1, z1], u, o)} tones={ISO.plastic} />
      <Polys polys={block([x0, y0, z1 - 0.08], [x1, y1, z1], u, o)} tones={ISO.plastic} />
      {Array.from({ length: 18 }, (_, i) => x0 + 0.5 + i * 0.4).map((gx) => <polygon key={gx} points={poly([[gx, y0 + 0.25, z1 + 0.002], [gx + 0.16, y0 + 0.25, z1 + 0.002], [gx + 0.16, y1 - 0.45, z1 + 0.002], [gx, y1 - 0.45, z1 + 0.002]])} fill={ISO.plastic[2]} />)}
      {open < 0.99 && <g opacity={1 - open} transform={`translate(0 ${-open * u * 0.9})`}>
        <Polys polys={block([x0, y1 - 0.18, z0 + 0.32], [x1 - 0.1, y1, z1 - 0.08], u, o)} tones={ISO.plastic} />
        <OnPlane y={y1} u={u} o={o}>
          <line x1={x0 + 0.2} y1={z1 - 0.55} x2={x1 - 0.3} y2={z1 - 0.55} stroke={ISO.plastic[2]} strokeWidth={0.04} />
          <rect x={x1 - 1.9} y={z0 + 0.75} width={0.9} height={0.36} rx={0.08} fill={ISO.dark[1]} />
          <circle cx={x1 - 1.72} cy={z0 + 0.93} r={0.07} fill={STEAM} opacity={0.6 + 0.4 * Math.sin(clock * 2 * Math.PI / 3)} />
          <rect x={x1 - 1.55} y={z0 + 0.86} width={0.45} height={0.13} fill={WHITE} opacity={0.8} />
        </OnPlane>
      </g>}
      {/* the outlet under the cover and the louver that swings in it */}
      <Polys polys={block([x0 + 0.1, y1 - 0.5, z0], [x1 - 0.1, y1, z0 + 0.32], u, o)} tones={ISO.dark} />
      {(() => {
        const a = st.louver, L = 0.62, hy = y1 - 0.25, hz = z0 + 0.22;
        const e: P3 = [0, L * Math.sin(a), -L * Math.cos(a)];
        return <polygon points={poly([[x0 + 0.4, hy, hz], [x1 - 0.4, hy, hz], [x1 - 0.4, hy + e[1], hz + e[2]], [x0 + 0.4, hy + e[1], hz + e[2]]])} fill={ISO.plastic[1]} stroke={ISO.plastic[2]} strokeWidth={2} />;
      })()}
    </g>
  );
};

// ------------------------------------------------------------------------------------------------------ the air: warm room air drawn into the top (white streaks), the vapour in it (pale dots), cold air out of the louver
const bez = (a: P3, b: P3, c: P3, s: number): P3 => [0, 1, 2].map((k) => (1 - s) * (1 - s) * a[k] + 2 * (1 - s) * s * b[k] + s * s * c[k]) as unknown as P3;
const IN_LANES = [UNIT.x0 + 1.4, UNIT.x0 + 3.4, UNIT.x0 + 5.2, UNIT.x0 + 7.0];
const AirIn: React.FC<{ clock: number; k: number; vapour: number }> = ({ clock, k, vapour }) => (
  <g fill="none" strokeLinecap="round">
    {IN_LANES.map((x, i) => {
      const A: P3 = [x + 0.6, WB + 7.5, 25.6], B: P3 = [x, WB + 3.0, 26.2], C: P3 = [x - 0.2, WB + 1.1, UNIT.z1 + 0.1];
      const ph = (((clock / 2.5 + i / IN_LANES.length) % 1) + 1) % 1, s1 = ph, s0 = Math.max(0, ph - 0.28);
      const pts = Array.from({ length: 6 }, (_, j) => W(bez(A, B, C, s0 + ((s1 - s0) * j) / 5)));
      const d = smoothPath(pts, 0.5), op = k * Math.sin(Math.PI * ph);
      const dots = [0.15, 0.45, 0.75].map((q) => (((clock / 3 + q + i * 0.21) % 1) + 1) % 1);
      return <g key={i}>
        {k > 0.02 && <g opacity={op}><path d={d} stroke={G3} strokeWidth={u * 0.11} transform="translate(0 3)" opacity={0.5} /><path d={d} stroke={WHITE} strokeWidth={u * 0.11} /></g>}
        {vapour > 0.02 && dots.map((q, j) => { const c = W(bez([A[0] - 0.8 + j * 0.6, A[1], A[2] - 0.6], [B[0] + 0.4, B[1], B[2] - 0.5], C, q)); return <circle key={j} cx={c[0]} cy={c[1]} r={u * 0.09} fill={STEAM} stroke={ISO.water[0]} strokeWidth={1.5} opacity={vapour * Math.sin(Math.PI * q)} />; })}
      </g>;
    })}
  </g>
);
const AirOut: React.FC<{ clock: number; k: number }> = ({ clock, k }) => (
  <g fill="none" strokeLinecap="round">
    {IN_LANES.map((x, i) => {
      const A: P3 = [x, UNIT.y1 + 0.2, UNIT.z0 - 0.1], B: P3 = [x + 0.2, WB + 4.5, 19.6], C: P3 = [x + 0.6, WB + 7.5, 16.5];
      const ph = (((clock / 2 + i / IN_LANES.length + 0.1) % 1) + 1) % 1, s1 = ph, s0 = Math.max(0, ph - 0.3);
      const d = smoothPath(Array.from({ length: 6 }, (_, j) => W(bez(A, B, C, s0 + ((s1 - s0) * j) / 5))), 0.5);
      return <path key={i} d={d} stroke={STEAM} strokeWidth={u * 0.1} opacity={k * 0.9 * Math.sin(Math.PI * ph)} />;
    })}
  </g>
);

// ------------------------------------------------------------------------------------------------------ the leak inside: drops from the unit's bottom onto the bedroom floor, a puddle
const LEAK_X = UNIT.x0 + 3.2, LEAK_Y = UNIT.y1 + 0.05;
const Leak: React.FC<{ clock: number; k: number; puddle: number }> = ({ clock, k, puddle }) => {
  const top = W([LEAK_X, LEAK_Y, UNIT.z0]), floor = W([LEAK_X, LEAK_Y, 0.02]);
  return (
    <g>
      {puddle > 0.01 && <g>
        <polygon points={flatEllipse(LEAK_X + 0.3, LEAK_Y + 0.2, 0.02, 0.4 + 2.6 * puddle, 0.3 + 1.6 * puddle)} fill={ISO.water[1]} opacity={0.75} />
        <polygon points={flatEllipse(LEAK_X - 0.2, LEAK_Y - 0.1, 0.025, 0.2 + 1.1 * puddle, 0.15 + 0.6 * puddle)} fill={ISO.water[0]} opacity={0.7} />
      </g>}
      {k > 0.02 && [0, 0.33, 0.66].map((ph) => {
        const p = (((clock / 1.5 + ph) % 1) + 1) % 1, y = top[1] + p * p * (floor[1] - top[1]), r = u * 0.14;
        return <g key={ph} opacity={k}>
          <ellipse cx={top[0]} cy={y} rx={r * 0.8} ry={r * 1.25} fill={ISO.water[1]} />
          <ellipse cx={top[0] - r * 0.25} cy={y - r * 0.35} rx={r * 0.25} ry={r * 0.3} fill={ISO.water[0]} />
        </g>;
      })}
    </g>
  );
};

// ------------------------------------------------------------------------------------------------------ the picture
const Picture: React.FC<SceneProps> = ({ beat, t, clock, story: s }) => {
  const P = React.useMemo(() => makePlan(s), [s]);
  const m = P.m, st = stateAt(clock), cam = camAt(clock), top = P.tops.find((x) => clock >= x.a && clock < x.b);
  const at = (p: P3): P2 => toScreen(cam, W(p));
  const Y = (y: number) => Math.max(470, Math.min(1400, y));
  const L = (id: string) => beat.id === id;
  const unitTop = at([UNIT.x0 + 4.5, WB + 1.1, UNIT.z1]), vapourAt = at([UNIT.x0 + 3.0, WB + 3.2, 25.4]);
  const coilAt = at([COIL.x0 + 4.0, COIL.y1, 22.3]), louverAt = at([UNIT.x0 + 6.4, UNIT.y1 + 0.4, UNIT.z0 - 0.2]);
  const dewAt = at([COIL.x0 + 3.4, COIL.y1, 22.9]), panAt = at([PAN.x0 + 4.0, PAN.y1, PAN.z1]), outletAt = at([PAN.x1 - 0.3, PAN.y1, PAN.z1]);
  const hoseMid = at([XC + 0.65, WB - WALL_T - 0.95, 9]), dripAt = at([DRAIN.x, DRAIN.y, DRAIN.z + 0.5]);
  const roomAt = at([UNIT.x0 + 1.0, WB + 6, 15]), puddleAt = at([LEAK_X + 0.3, LEAK_Y + 0.2, 0.05]), unitAt = at([UNIT.x0 + 4.0, UNIT.y1, (UNIT.z0 + UNIT.z1) / 2]);
  return (
    <div style={{ position: "absolute", inset: 0, width: 1080, height: 1920 }}>
      <svg width={1080} height={1920} viewBox="0 0 1080 1920" style={{ position: "absolute", inset: 0 }}>
        <defs><Hatch id="ac-cut" /></defs>
        {/* the far layer: the sky behind the garden (the brand wall; its spot stays low, under the top text's band) */}
        <g transform={layerTransform(cam, 0.3)}><Brand clock={clock} spot={{ x: 760, y: 1250, r: 260 }} /></g>
        <g transform={layerTransform(cam, 1)}>
          <Garden />
          <House />
          <Plant clock={clock} />
          <AirOut clock={clock} k={st.cold} />
          <IndoorUnit clock={clock} st={st} />
          <Leak clock={clock} k={st.leak} puddle={st.puddle} />
          <AirIn clock={clock} k={st.air} vapour={st.vapour} />
          <OutdoorUnit clock={clock} />
          <Drain wet={st.flow} />
          <Tube pts={PIPES} w={u * 0.42} tones={ISO.plastic} />
          <Tube pts={HOSE} w={u * 0.3} tones={ISO.labPlastic} ribs />
          <DripOutside clock={clock} k={st.flow} />
        </g>
        {cam.zoom < 2.2 && <g transform={layerTransform(cam, 1.35)}><Motes t={clock} color={WHITE} opacity={0.25} n={8} /></g>}

        {/* labels on their parts (screen px through the camera, beat-local time) */}
        {L("udara") && t > 0.9 && t < 3.6 && <NumberLabel text="udara hangat" x={300} y={Y(unitTop[1] - 230)} ax={unitTop[0] - 40} ay={unitTop[1] - 60} fs={46} t={t} start={1.0} end={3.5} />}
        {L("udara") && t > 2.5 && t < 6.7 && <NumberLabel text="uap air" x={790} y={Y(vapourAt[1] + 330)} ax={vapourAt[0]} ay={vapourAt[1]} fs={46} t={t} start={2.6} end={6.6} />}
        {L("dingin") && t > 1.5 && t < 5.6 && <NumberLabel text="evaporator" x={300} y={Y(coilAt[1] - 330)} ax={coilAt[0]} ay={coilAt[1]} fs={46} t={t} start={1.6} end={5.5} />}
        {L("dingin") && t > 2.9 && t < 7.7 && <NumberLabel text="udara dingin" x={760} y={Y(louverAt[1] + 300)} ax={louverAt[0]} ay={louverAt[1] + 40} fs={46} t={t} start={3.0} end={7.6} />}
        {L("embun") && t > 0.7 && t < 4.7 && <NumberLabel text="embun" x={760} y={Y(dewAt[1] - 330)} ax={dewAt[0]} ay={dewAt[1]} fs={46} t={t} start={0.8} end={4.6} />}
        {L("embun") && t > 2.7 && t < 6.5 && <NumberLabel text="menetes" x={330} y={Y(panAt[1] + 280)} ax={panAt[0]} ay={panAt[1]} fs={46} t={t} start={2.8} end={6.4} />}
        {L("selang") && t > 0.2 && t < 2.7 && <NumberLabel text="bak penampung" x={540} y={Y(panAt[1] + 300)} ax={panAt[0]} ay={panAt[1]} fs={46} t={t} start={0.3} end={2.6} />}
        {L("selang") && t > 3.1 && t < 6.5 && <NumberLabel text="selang buang" x={360} y={Y(hoseMid[1] - 120)} ax={hoseMid[0]} ay={hoseMid[1]} fs={46} t={t} start={3.2} end={6.4} />}
        {L("selang") && t > 4.9 && t < 7.9 && <NumberLabel text="ke luar rumah" x={760} y={Y(dripAt[1] - 260)} ax={dripAt[0]} ay={dripAt[1]} fs={46} t={t} start={5.0} end={7.8} />}
        {L("hasil") && t > 1.3 && t < 5.9 && <NumberLabel text="netes di luar: wajar" x={720} y={Y(dripAt[1] - 220)} ax={dripAt[0]} ay={dripAt[1]} fs={46} t={t} start={1.4} end={5.8} />}
        {L("hasil") && t > 2.5 && t < 6.9 && <NumberLabel text="udara lebih kering" x={330} y={Y(roomAt[1] + 120)} ax={roomAt[0]} ay={roomAt[1]} fs={46} t={t} start={2.6} end={6.8} />}
        {L("bocor") && t > 1.3 && t < 5.5 && <NumberLabel text="tersumbat" red x={780} y={Y(outletAt[1] + 180)} ax={outletAt[0]} ay={outletAt[1]} fs={46} t={t} start={1.4} end={5.4} />}
        {L("bocor") && t > 3.3 && t < 6.9 && <NumberLabel text="netes di dalam" red x={360} y={Y(puddleAt[1] - 260)} ax={puddleAt[0]} ay={puddleAt[1]} fs={46} t={t} start={3.4} end={6.8} />}
        {L("tips") && t > 0.5 && t < 3.5 && <NumberLabel n={1} text="rawat berkala" x={540} y={Y(unitAt[1] + 260)} ax={unitAt[0]} ay={unitAt[1]} fs={46} t={t} start={0.6} end={3.4} />}
        {L("tips") && t > 3.5 && t < 6.9 && <NumberLabel n={2} text="tetap bocor? panggil teknisi" x={540} y={Y(unitAt[1] + 260)} ax={unitAt[0]} ay={unitAt[1]} fs={44} t={t} start={3.6} end={6.8} />}

        {/* the sources */}
        {L("udara") && t > 4.5 && t < 6.9 && <SourceChip x={90} y={1340} text="Wikipedia: Dehumidifier" t={t} start={4.6} end={6.8} />}
        {L("dingin") && t > 5.5 && t < 7.9 && <SourceChip x={90} y={1340} text="Wikipedia: Air conditioning" t={t} start={5.6} end={7.8} />}
        {L("embun") && t > 5.3 && t < 7.9 && <SourceChip x={90} y={1340} text="Wikipedia: Dew point" t={t} start={5.4} end={7.8} />}
        {L("selang") && t > 1.0 && t < 3.0 && <SourceChip x={90} y={1340} text="Wikipedia: Condensate pump" t={t} start={1.1} end={2.9} />}
        {L("hasil") && t > 4.3 && t < 6.9 && <SourceChip x={90} y={1340} text="Wikipedia: Dehumidifier" t={t} start={4.4} end={6.8} />}
        {L("bocor") && t > 4.9 && t < 6.95 && <SourceChip x={90} y={1340} text="Wikipedia: Dehumidifier" t={t} start={5.0} end={6.9} />}

        {/* the mascot: the small "Intip yuk!" sting (no veil: the world keeps moving behind it) */}
        {clock >= m.sting - 0.1 && clock < m.stingEnd + 0.15 && (() => {
          const p = springAt(clock, m.sting), out2 = 1 - easeInOut(clamp01((clock - m.stingEnd + 0.18) / 0.25));
          const mx = 360, my = 1380, px = 680, py = 1380, pillW = 300;
          return <g>
            <g transform={`translate(${mx} ${my}) scale(${Math.max(0, p) * out2}) translate(${-mx} ${-my})`}><Mascot x={mx} y={my} w={200} expr="curious" t={clock - m.sting} clock={clock} squash={0.18 * (1 - p)} /></g>
            <g transform={`translate(${px} ${py}) scale(${Math.max(0, springAt(clock, m.sting + 0.25)) * out2}) translate(${-px} ${-py})`}>
              <rect x={px - pillW / 2} y={py - 46} width={pillW} height={92} rx={46} fill={YELLOW} />
              <text x={px} y={py + 18} fontSize={52} textAnchor="middle" fill={BLACK} style={{ fontFamily: FONT_BOLD, fontWeight: 700 }}>Intip yuk!</text>
            </g>
          </g>;
        })()}

        {/* the channel's text: the kicker and headline at the top, the caption at the bottom */}
        {top && <TopText key={`${top.a}`} kicker={top.kicker} headline={top.headline} t={clock - top.a} />}
        {beat.kind !== "outro" && beat.kind !== "sting" && <CaptionLayer beat={beat} t={t} />}
      </svg>
    </div>
  );
};

export const Video: React.FC<{ story: StoryT; layoutDebug?: boolean }> = (p) => <StoryVideo story={p.story} scene={(sp) => <Picture {...sp} />} layoutDebug={p.layoutDebug} />;
