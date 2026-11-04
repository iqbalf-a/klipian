/* Kenapa jarum kompas selalu menunjuk utara? — one tabletop set (set kind "tabletop"), one hero (a compass on a map) and one continuous camera (plan.ts CAM).
   The needle is a small magnet that swings with a bar magnet; a desk globe shows Earth's liquid outer core (real proportions) and its field, a loop of
   the dipole field drawn as it really is (closed loops from pole to pole, the magnetic axis about 11 degrees off the spin axis); the field lines run
   across the map and the needle follows them; the field's pole in the north is a magnet's south pole; the needle is off true north (declination); and the
   tips: a magnet, a block of iron, the needle that dips near the poles. The first frame is the last (the loop). */
import React from "react";
import {
  BLACK, CaptionLayer, IsoCup, Label, Mascot, StoryVideo, TopText, YELLOW, YELLOW_D, block, cam2At, circlePts, clamp01, cylinder, easeInOut, easeOutBack,
  isoAt, layerTransform, ptsAttr, smoothPath, springAt, useFonts, type P2, type P3, type Poly, type SceneProps, type StoryT,
} from "../../src/design/index.ts";
import { BLUSH, ISO, G1, G2, G3, G4, PLASTER, SKIN_B, WHITE } from "../../src/tokens.ts";
import { mixRgb } from "../../src/natureGeometry.ts";
import { textWidth } from "../../src/design/index.ts";
import { CAM, GLOBE, T, magX, needleAngle } from "./plan.ts";
import storyJson from "./story.json";

export const story = storyJson as unknown as StoryT;

const U = 110, O: P2 = [540, 1050];                                  // the compass' iso unit and origin (world px)
const P = (p: P3): P2 => isoAt(p, U, O);
const WOOD = [mixRgb(ISO.soil[0], WHITE, 0.55), mixRgb(ISO.soil[1], WHITE, 0.55)], WOOD_EDGE = mixRgb(ISO.soil[1], WHITE, 0.2);
const PAPER = [WHITE, G4, ISO.plastic[2]], IRON = ISO.dark, N_COL = YELLOW, S_COL = G2;
const PENCIL: [string, string, string] = [YELLOW, YELLOW_D, mixRgb(YELLOW_D, BLACK, 0.3)];
const OCEAN = ISO.water, LAND = ISO.grass;
/** 0 to 1 over 0.35 s from `a`; and back to 0 at `b` (a thing is on screen from a to b). */
const on = (c: number, a: number, b = 1e9) => clamp01((c - a) / 0.35) * (1 - clamp01((c - b) / 0.35));
const blk = (a: P3, b: P3) => block(a, b, U, O);
const polys = (ps: Poly[], tones: readonly string[], stroke = G1, sw = 2.5, op = 1) => ps.map((p, i) => <polygon key={i} points={ptsAttr(p.pts)} fill={tones[p.tone]} stroke={stroke} strokeWidth={sw} strokeLinejoin="round" opacity={op} />);
const bold = { fontFamily: '"Outfit", sans-serif', fontWeight: 700 } as const;
const dirOf = (deg: number): [number, number] => [Math.sin((deg * Math.PI) / 180), -Math.cos((deg * Math.PI) / 180)];   // world (x, y) of a bearing: 0 = north = -y

/** The table: planks that run along the world x axis, past every edge of the frame (the far layer is the table itself). */
const Table: React.FC = () => (
  <g>
    <rect x={-4000} y={-3000} width={9000} height={8000} fill={WOOD[0]} />
    {Array.from({ length: 70 }, (_, i) => { const k = i - 35; return (
      <g key={i}>
        <polygon points={ptsAttr([P([-40, k * 1.3, 0]), P([40, k * 1.3, 0]), P([40, k * 1.3 + 1.3, 0]), P([-40, k * 1.3 + 1.3, 0])])} fill={WOOD[i % 2]} stroke={WOOD_EDGE} strokeWidth={3} />
        {[0.3, 0.7].map((f, j) => { const a = P([-40 + ((i * 7 + j * 11) % 13), k * 1.3 + f, 0]), b = P([-34 + ((i * 7 + j * 11) % 13), k * 1.3 + f, 0]); return <line key={j} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={WOOD_EDGE} strokeWidth={3} opacity={0.5} strokeLinecap="round" />; })}
      </g>); })}
  </g>
);

/** The map under the compass: a sheet of paper with contour loops, a river and a dashed route. */
const MapSheet: React.FC = () => {
  const loop = (cx: number, cy: number, rx: number, ry: number, ph: number) => smoothPath(Array.from({ length: 10 }, (_, i) => { const a = (i / 10) * Math.PI * 2; const k = 1 + 0.12 * Math.sin(a * 3 + ph); return P([cx + rx * k * Math.cos(a), cy + ry * k * Math.sin(a), 0.03]); }).concat([P([cx + rx * 1.1 * Math.cos(0), cy, 0.03])]));
  return (
    <g>
      {polys(blk([-5.4, -4.6, 0], [5.4, 4.6, 0.05]), PAPER, G3, 2)}
      {[[-3.6, -2.6, 0.9, 0.7, 0.5], [-3.6, -2.6, 1.5, 1.2, 1.2], [3.6, 2.9, 0.8, 0.9, 2.1], [3.6, 2.9, 1.5, 1.4, 0.2], [3.9, -2.8, 1.0, 0.8, 1.1]].map(([cx, cy, rx, ry, ph], i) =>
        <path key={i} d={loop(cx, cy, rx, ry, ph)} fill="none" stroke={ISO.grass[2]} strokeWidth={3} opacity={0.55} />)}
      <path d={smoothPath([P([-5.2, 0.6, 0.06]), P([-3, 1.4, 0.06]), P([-1.5, 3.4, 0.06]), P([1.2, 3.8, 0.06]), P([3.4, 1.6, 0.06]), P([5.2, 2.0, 0.06])])} fill="none" stroke={OCEAN[1]} strokeWidth={7} strokeLinecap="round" opacity={0.8} />
      <path d={smoothPath([P([-4.6, -1.4, 0.06]), P([-2.2, -0.6, 0.06]), P([2.4, -2.6, 0.06]), P([4.6, -3.4, 0.06])])} fill="none" stroke={G2} strokeWidth={4} strokeDasharray="14 12" strokeLinecap="round" opacity={0.6} />
      {/* the map's own north arrow, printed in the corner: true north */}
      <g transform={`translate(${P([-4.2, 3.6, 0.07]).join(" ")})`}><polygon points="0,-34 16,12 0,2 -16,12" fill={G2} opacity={0.7} /><text x={0} y={52} fontSize={26} textAnchor="middle" fill={G2} style={bold}>U</text></g>
    </g>
  );
};

const Pencil: React.FC = () => (
  <g>
    {polys(blk([-4.8, 3.3, 0.05], [-1.8, 3.62, 0.36]), PENCIL, G1, 2)}
    {polys(blk([-1.8, 3.34, 0.07], [-1.3, 3.58, 0.34]), [PLASTER, SKIN_B, mixRgb(SKIN_B, BLACK, 0.2)], G1, 2)}
    {polys(blk([-1.3, 3.4, 0.12], [-1.0, 3.52, 0.28]), IRON, G1, 2)}
    {polys(blk([-5.1, 3.3, 0.05], [-4.8, 3.62, 0.36]), [mixRgb(BLUSH, WHITE, 0.3), BLUSH, mixRgb(BLUSH, BLACK, 0.2)], G1, 2)}
  </g>
);

/** The block of iron (a hunk of steel): a heavy dark box on the map's right edge. */
const IronBlock: React.FC<{ k: number }> = ({ k }) => (
  <g>
    {polys(blk([3.0, 3.0, 0.05], [4.3, 4.3, 1.1]), IRON, G1, 2.5)}
    {k > 0 && <circle cx={P([3.65, 3.65, 0.6])[0]} cy={P([3.65, 3.65, 0.6])[1]} r={90 * k} fill="none" stroke={YELLOW_D} strokeWidth={5} opacity={0.55 * (1 - k * 0.3)} strokeDasharray="10 10" />}
  </g>
);

/** The bar magnet: two halves (south at the west end: grey; north at the east end: yellow), lettered on top. */
const BarMagnet: React.FC<{ x: number }> = ({ x }) => (
  <g>
    {polys(blk([x - 1.6, -0.45, 0.05], [x, 0.45, 0.6]), ISO.plastic, G1, 3)}
    {polys(blk([x, -0.45, 0.05], [x + 1.6, 0.45, 0.6]), [YELLOW, YELLOW_D, mixRgb(YELLOW_D, BLACK, 0.25)], G1, 3)}
    {(() => { const a = P([x - 0.8, 0, 0.62]), b = P([x + 0.8, 0, 0.62]); return <><text x={a[0]} y={a[1] + 10} fontSize={30} textAnchor="middle" fill={G1} style={bold}>S</text><text x={b[0]} y={b[1] + 10} fontSize={30} textAnchor="middle" fill={G1} style={bold}>U</text></>; })()}
  </g>
);

/** The compass: a case, a white dial with ticks and the letters U T S B (utara, timur, selatan, barat), a glass, and the needle (north half yellow, south half dark). */
const Compass: React.FC<{ angle: number; c: number }> = ({ angle, c }) => {
  const R = 2.3, DZ = 0.56, NZ = 0.66;
  const case_ = cylinder([0, 0, 0], [0, 0, DZ], R, R, [1, 0, 0], [0, 1, 0], U, O, 64);
  const ring = circlePts(0, 0, 2.0, 64).map(([x, y]) => P([x, y, DZ + 0.005]));
  const ticks = Array.from({ length: 36 }, (_, i) => { const a = (i * 10 * Math.PI) / 180, big = i % 9 === 0, r0 = big ? 1.55 : 1.8; const [dx, dy] = [Math.sin(a), -Math.cos(a)]; const p = P([dx * r0, dy * r0, DZ + 0.01]), q = P([dx * 1.98, dy * 1.98, DZ + 0.01]); return <line key={i} x1={p[0]} y1={p[1]} x2={q[0]} y2={q[1]} stroke={big ? G1 : G2} strokeWidth={big ? 5 : 3} strokeLinecap="round" />; });
  const letters = ["U", "T", "S", "B"].map((ch, i) => { const [dx, dy] = dirOf(i * 90); const p = P([dx * 2.16, dy * 2.16, DZ + 0.005]); return <text key={ch} x={p[0]} y={p[1] + 10} fontSize={30} textAnchor="middle" fill={i === 0 ? YELLOW : WHITE} style={bold}>{ch}</text>; });
  const [nx, ny] = dirOf(angle), [px, py] = [-ny, nx];
  const pt = (s: number, w: number): P2 => P([nx * s + px * w, ny * s + py * w, NZ]);
  const nHalf = [pt(1.75, 0), pt(0, 0.24), pt(0, -0.24)], sHalf = [pt(-1.75, 0), pt(0, 0.24), pt(0, -0.24)];
  const pivot = P([0, 0, NZ + 0.06]);
  const glint = 0.1 + 0.1 * Math.sin((c / 6) * Math.PI * 2);
  return (
    <g>
      {polys(case_, ISO.dark, G1, 3)}
      <polygon points={ptsAttr(ring)} fill={WHITE} stroke={G3} strokeWidth={4} />
      {ticks}{letters}
      <polygon points={ptsAttr(sHalf)} fill={S_COL} stroke={BLACK} strokeWidth={4} strokeLinejoin="round" />
      <polygon points={ptsAttr(nHalf)} fill={N_COL} stroke={BLACK} strokeWidth={4} strokeLinejoin="round" />
      <ellipse cx={pivot[0]} cy={pivot[1]} rx={22} ry={13} fill={G4} stroke={BLACK} strokeWidth={3} />
      <polygon points={ptsAttr(circlePts(0, 0, 2.0, 64).map(([x, y]) => P([x, y, NZ + 0.2])))} fill={WHITE} opacity={0.1 + glint * 0.4} />
      <path d={smoothPath([P([-1.5, 0.6, NZ + 0.2]), P([-1.2, 1.2, NZ + 0.2]), P([-0.6, 1.7, NZ + 0.2])])} fill="none" stroke={WHITE} strokeWidth={9} strokeLinecap="round" opacity={0.7} />
    </g>
  );
};

/** Lines across the map that show the direction of Earth's field (toward the north); dashes run to the north, the needle follows them. */
const FieldOnTable: React.FC<{ k: number; c: number }> = ({ k, c }) => (
  <g opacity={k}>
    {[-4.2, -2.8, -1.4, 0, 1.4, 2.8, 4.2].map((x, i) => {
      const a = P([x, 4.2, 0.07]), b = P([x, -4.2, 0.07]), tip = P([x, -4.5, 0.07]);
      const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
      return <g key={i}>
        <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={YELLOW_D} strokeWidth={9} strokeLinecap="round" strokeDasharray={`${l / 9} ${l / 12}`} strokeDashoffset={-(c * 70) % 1000} opacity={0.9} />
        <polygon points={ptsAttr([tip, P([x - 0.22, -4.0, 0.07]), P([x + 0.22, -4.0, 0.07])])} fill={YELLOW_D} />
      </g>;
    })}
  </g>
);

/** A plate with a short text, in the world: white, rounded, coming in at `start`. */
const Tag: React.FC<{ text: string; x: number; y: number; fs?: number; c: number; a: number; b?: number; hl?: string[]; to?: P2 }> = ({ text, x, y, fs = 52, c, a, b = 1e9, hl, to }) => {
  const k = on(c, a, b);
  if (k <= 0.02) return null;
  const w = textWidth(text, fs) + fs * 1.1, h = fs * 1.5;
  return <g opacity={Math.min(1, k * 1.5)}>{to && <><line x1={x} y1={y} x2={to[0]} y2={to[1]} stroke={BLACK} strokeWidth={5} strokeLinecap="round" /><circle cx={to[0]} cy={to[1]} r={9} fill={BLACK} /></>}<rect x={x - w / 2} y={y - h * 0.58} width={w} height={h} rx={h / 2} fill={WHITE} opacity={0.92} stroke={G3} strokeWidth={3} /><Label text={text} x={x} y={y} fs={fs} t={c} start={a} highlight={hl} /></g>;
};
const Line: React.FC<{ x1: number; y1: number; x2: number; y2: number; k: number; col?: string; w?: number; head?: boolean }> = ({ x1, y1, x2, y2, k, col = BLACK, w = 7, head = true }) => {
  if (k <= 0) return null;
  const ex = x1 + (x2 - x1) * k, ey = y1 + (y2 - y1) * k, a = Math.atan2(y2 - y1, x2 - x1), s = 24;
  return <g><line x1={x1} y1={y1} x2={ex} y2={ey} stroke={col} strokeWidth={w} strokeLinecap="round" />{head && k > 0.9 && <polygon points={`${ex},${ey} ${ex - s * Math.cos(a - 0.5)},${ey - s * Math.sin(a - 0.5)} ${ex - s * Math.cos(a + 0.5)},${ey - s * Math.sin(a + 0.5)}`} fill={col} />}</g>;
};

/** A needle drawn flat on the screen (the globe is a plain disc): centre (x, y), length 2 * len, pointing at screen angle `deg` (0 = up, clockwise). */
const FlatNeedle: React.FC<{ x: number; y: number; len: number; deg: number; k?: number }> = ({ x, y, len, deg, k = 1 }) => (
  <g transform={`translate(${x} ${y}) rotate(${deg}) scale(${k})`}>
    <polygon points={`0,${len} ${len * 0.13},0 ${-len * 0.13},0`} fill={S_COL} stroke={BLACK} strokeWidth={4} strokeLinejoin="round" />
    <polygon points={`0,${-len} ${len * 0.13},0 ${-len * 0.13},0`} fill={N_COL} stroke={BLACK} strokeWidth={4} strokeLinejoin="round" />
    <circle r={len * 0.08} fill={G4} stroke={BLACK} strokeWidth={3} />
  </g>
);

const SPIN_TILT = 23.4, FIELD_TILT = SPIN_TILT - 11;                 // the magnetic axis is about 11 degrees off the spin axis (Wikipedia, Earth's magnetic field)
/** A closed dipole field loop (r = L cos^2(lat)) in the field's own frame (centre 0, 0; north up; screen y down); `side` -1 left, 1 right. Runs from the south pole round to the north. */
const loopPts = (L: number, side: 1 | -1, R: number, n = 40): P2[] => {
  const lm = Math.acos(Math.sqrt(1 / L)), out: P2[] = [];
  for (let i = 0; i <= n; i++) { const lat = -lm + (2 * lm * i) / n, r = L * Math.cos(lat) ** 2; out.push([side * r * Math.cos(lat) * R, -r * Math.sin(lat) * R]); }
  return out;
};
/** The field's direction (screen degrees, 0 = up) and the point at fraction f along the loop. */
const loopAt = (L: number, side: 1 | -1, R: number, f: number): { p: P2; deg: number } => {
  const pts = loopPts(L, side, R, 60), i = Math.max(1, Math.min(59, Math.round(f * 60))), a = pts[i - 1], b = pts[i + 1];
  return { p: pts[i], deg: (Math.atan2(b[0] - a[0], -(b[1] - a[1])) * 180) / Math.PI };
};

/** The desk globe: a ball tilted on its stand. It cuts open to show Earth's layers in their real proportions (outer core to 0.545 of the radius, inner core 0.19). */
const Globe: React.FC<{ c: number }> = ({ c }) => {
  const { x: gx, y: gy, r: R } = GLOBE;
  const cutK = easeInOut(clamp01((c - T.cut) / 0.7)) * (1 - easeInOut(clamp01((c - T.uncut) / 0.7)));
  const drift = ((c * 14) % (R * 2.6));
  const blob = (cx: number, cy: number, rx: number, ry: number, ph: number) => smoothPath(Array.from({ length: 9 }, (_, i) => { const a = (i / 9) * Math.PI * 2; const k = 1 + 0.18 * Math.sin(a * 2 + ph); return [cx + rx * k * Math.cos(a), cy + ry * k * Math.sin(a)] as P2; }).concat([[cx + rx * 1.18, cy]])) + " Z";
  const lands = [[-0.3, -0.3, 0.42, 0.3, 0.5], [0.45, 0.15, 0.3, 0.42, 1.4], [-0.55, 0.45, 0.28, 0.2, 2.0], [0.1, 0.62, 0.22, 0.14, 0.9], [-0.05, -0.75, 0.3, 0.1, 0.1]];
  const base = [gx - Math.sin((SPIN_TILT * Math.PI) / 180) * (R + 120), gy + Math.cos((SPIN_TILT * Math.PI) / 180) * (R + 120) + 20] as P2;
  const stand = cylinder([0, 0, 0], [0, 0, 0.38], 1.6, 1.6, [1, 0, 0], [0, 1, 0], 110, [base[0], base[1] + 40], 48);
  const stem = cylinder([0, 0, 0.3], [0, 0, 0.9], 0.2, 0.2, [1, 0, 0], [0, 1, 0], 110, [base[0], base[1] + 40], 24);
  return (
    <g>
      {polys(stand, ISO.dark, G1, 3)}{polys(stem, ISO.metal, G1, 3)}
      <g transform={`rotate(${SPIN_TILT} ${gx} ${gy})`}>
        <path d={`M ${gx} ${gy - R * 1.12} A ${R * 1.12} ${R * 1.12} 0 0 0 ${gx} ${gy + R * 1.12}`} fill="none" stroke={ISO.metal[2]} strokeWidth={16} strokeLinecap="round" />
        <line x1={gx} y1={gy - R * 1.2} x2={gx} y2={gy + R * 1.2} stroke={G1} strokeWidth={6} strokeLinecap="round" opacity={0.5} strokeDasharray="6 22" />
        <defs><clipPath id="jk-ball"><circle cx={gx} cy={gy} r={R} /></clipPath></defs>
        <g opacity={1 - cutK}>
          <circle cx={gx} cy={gy} r={R} fill={OCEAN[1]} stroke={BLACK} strokeWidth={6} />
          <g clipPath="url(#jk-ball)">
            <circle cx={gx - R * 0.14} cy={gy - R * 0.14} r={R * 0.88} fill={OCEAN[0]} />
            {[0, -R * 2.6].map((o, k) => <g key={k} transform={`translate(${gx + drift + o - R * 0.4} ${gy})`}>{lands.map(([cx, cy, rx, ry, ph], i) => <path key={i} d={blob(cx * R, cy * R, rx * R, ry * R, ph)} fill={LAND[i % 2]} stroke={LAND[2]} strokeWidth={4} />)}</g>)}
            <circle cx={gx + R * 0.5} cy={gy + R * 0.5} r={R * 0.95} fill={OCEAN[2]} opacity={0.0} />
          </g>
          <circle cx={gx} cy={gy} r={R} fill="none" stroke={BLACK} strokeWidth={6} />
        </g>
        {cutK > 0.01 && <g opacity={cutK}>
          <circle cx={gx} cy={gy} r={R} fill={ISO.soil[2]} stroke={BLACK} strokeWidth={6} />
          <circle cx={gx} cy={gy} r={R * 0.985} fill={ISO.soil[1]} />
          <circle cx={gx} cy={gy} r={R * 0.545} fill={on(c, T.core) > 0 ? YELLOW : ISO.soil[0]} stroke={BLACK} strokeWidth={5} opacity={0.4 + 0.6 * on(c, T.core)} />
          <circle cx={gx} cy={gy} r={R * 0.19} fill={G3} stroke={BLACK} strokeWidth={5} />
          {on(c, T.flow) > 0.02 && <g opacity={on(c, T.flow)}>
            {[0.3, 0.38, 0.46].map((f, i) => <circle key={i} cx={gx} cy={gy} r={R * f} fill="none" stroke={YELLOW_D} strokeWidth={9} strokeLinecap="round" strokeDasharray={`${R * 0.16} ${R * 0.12}`} strokeDashoffset={(i % 2 ? 1 : -1) * c * 90} />)}
            {[0, 1, 2, 3, 4, 5].map((i) => { const a = (i / 6) * Math.PI * 2 + c * (i % 2 ? 0.5 : -0.5) * 0.4, r = R * (0.34 + 0.1 * (i % 2)); return <circle key={i} cx={gx + r * Math.cos(a)} cy={gy + r * Math.sin(a)} r={14} fill={WHITE} stroke={BLACK} strokeWidth={4} />; })}
          </g>}
        </g>}
      </g>
    </g>
  );
};

/** The field of the globe, as the dipole really is: closed loops from the south pole round to the north pole, drawn in the field's frame (tilted about 11 degrees off the spin axis). */
const FieldLoops: React.FC<{ c: number; k: number }> = ({ c, k }) => {
  const { x: gx, y: gy, r: R } = GLOBE;
  const loops: [number, number][] = [[1.45, T.loop1], [1.8, T.loop2], [2.25, T.loop3]];
  return (
    <g transform={`rotate(${FIELD_TILT} ${gx} ${gy})`} opacity={k}>
      <g transform={`translate(${gx} ${gy})`}>
        <line x1={0} y1={-R * 1.3} x2={0} y2={R * 1.3} stroke={YELLOW_D} strokeWidth={8} strokeLinecap="round" strokeDasharray="22 16" opacity={on(c, T.tilt, T.panC) * 0.95} />
        {loops.flatMap(([L, a], i) => ([1, -1] as const).map((s) => {
          const g = clamp01((c - a) / 0.9), pts = loopPts(L, s, R);
          if (g <= 0) return null;
          const d = smoothPath(pts);
          return <g key={`${i}${s}`}>
            <path d={d} fill="none" stroke={YELLOW_D} strokeWidth={11} strokeLinecap="round" pathLength={1} strokeDasharray={`${g * 0.04} 0.025`} strokeDashoffset={-(c * 0.12) % 1} opacity={0.95 * g} />
            {g > 0.9 && (() => { const m = loopAt(L, s, R, 0.5); return <g transform={`translate(${m.p[0]} ${m.p[1]}) rotate(${m.deg})`}><polygon points="0,-30 -22,16 22,16" fill={BLACK} /></g>; })()}
          </g>;
        }))}
      </g>
    </g>
  );
};
const MiniNeedles: React.FC<{ c: number }> = ({ c }) => {
  const { x: gx, y: gy, r: R } = GLOBE;
  const spots: [number, 1 | -1, number][] = [[1.45, 1, 0.3], [1.8, 1, 0.7], [1.8, -1, 0.35], [2.25, -1, 0.62]];
  return <g transform={`rotate(${FIELD_TILT} ${gx} ${gy})`}><g transform={`translate(${gx} ${gy})`}>
    {spots.map(([L, s, f], i) => { const m = loopAt(L, s, R, f), k = easeOutBack(clamp01((c - T.mini - i * 0.2) / 0.5)), spin = (1 - easeInOut(clamp01((c - T.mini - i * 0.2) / 1.1))) * (140 + i * 60); return k > 0 ? <FlatNeedle key={i} x={m.p[0]} y={m.p[1]} len={95} deg={m.deg + spin} k={k} /> : null; })}
  </g></g>;
};

/** The bar magnet inside the globe (Earth as a magnet), along the magnetic axis: its south pole is at the top (the geographic north), its north pole at the bottom. */
const EarthMagnet: React.FC<{ c: number }> = ({ c }) => {
  const { x: gx, y: gy, r: R } = GLOBE, k = easeOutBack(clamp01((c - T.bar) / 0.6)) * (1 - clamp01((c - T.fadeG) / 0.6));
  if (k <= 0.01) return null;
  const w = R * 0.34, h = R * 0.8, pull = clamp01((c - T.arrows) / 0.5);
  return (
    <g transform={`rotate(${FIELD_TILT} ${gx} ${gy}) translate(${gx} ${gy}) scale(${k})`}>
      <rect x={-w / 2} y={-h} width={w} height={h} rx={26} fill={G4} stroke={BLACK} strokeWidth={6} />
      <rect x={-w / 2} y={0} width={w} height={h} rx={26} fill={YELLOW} stroke={BLACK} strokeWidth={6} />
      <text x={0} y={-h * 0.52 + 22} fontSize={74} textAnchor="middle" fill={G1} style={bold}>S</text>
      <text x={0} y={h * 0.52 + 22} fontSize={74} textAnchor="middle" fill={G1} style={bold}>U</text>
      {/* the needle above the north: its yellow (north) end points at the magnet's south pole; the two pull on each other */}
      {c >= T.needleG && <g opacity={clamp01((c - T.needleG) / 0.4)}><FlatNeedle x={0} y={-R * 1.52 + 8 * Math.sin(c * 5) * (1 - pull)} len={150} deg={180} k={easeOutBack(clamp01((c - T.needleG) / 0.5))} /></g>}
      <Line x1={0} y1={-R * 1.2} x2={0} y2={-h - 40} k={pull} col={BLACK} w={9} />
    </g>
  );
};

/** The side view of a needle near the pole: it dips (a card on the screen, not in the world). */
const DipCard: React.FC<{ c: number }> = ({ c }) => {
  const a = T.dip, b = T.dipEnd, k = on(c, a, b);
  if (k <= 0.02) return null;
  const dip = 70 * easeInOut(clamp01((c - a - 0.5) / 1.0)) + 3 * Math.sin(c * 5);
  return (
    <g opacity={k} transform={`translate(0 ${(1 - k) * 30})`}>
      <rect x={110} y={440} width={860} height={400} rx={36} fill={WHITE} stroke={G3} strokeWidth={4} opacity={0.97} />
      <g transform="translate(540 650)">
        <circle r={150} fill={G4} stroke={BLACK} strokeWidth={6} />
        <line x1={-150} y1={0} x2={150} y2={0} stroke={G3} strokeWidth={4} strokeDasharray="10 12" />
        <g transform={`rotate(${90 + dip})`}><polygon points="0,-120 14,0 -14,0" fill={N_COL} stroke={BLACK} strokeWidth={4} strokeLinejoin="round" /><polygon points="0,120 14,0 -14,0" fill={S_COL} stroke={BLACK} strokeWidth={4} strokeLinejoin="round" /></g>
        <circle r={12} fill={G4} stroke={BLACK} strokeWidth={3} />
      </g>
      <Label text="dekat kutub, jarum miring" x={540} y={812} fs={46} t={c} start={a + 0.2} highlight={["miring"]} />
    </g>
  );
};

const Scene = ({ beat, t, clock }: SceneProps) => {
  useFonts();
  const c = clock, cam = cam2At(CAM, c), isOutro = beat.kind === "outro";
  const ang = needleAngle(c), mx = magX(c);
  const [gx, gy, gr] = [GLOBE.x, GLOBE.y, GLOBE.r];
  const declK = clamp01((c - T.lblDecl + 0.1) / 0.01) * (1 - clamp01((c - T.declBack) / 0.3));
  // the true-north line and the declination arc on the map plane
  const tn0 = P([0, 0, 0.7]), tn1 = P([0, -3.3, 0.07]);
  const arc = Array.from({ length: 12 }, (_, i) => { const a = (i / 11) * 14; const [dx, dy] = dirOf(a); return P([dx * 2.7, dy * 2.7, 0.07]); });
  const needleTip = (s: number, w: number): P2 => { const [nx, ny] = dirOf(ang); return P([nx * s - ny * w, ny * s + nx * w, 0.66]); };
  const gWin = Math.min(1, on(c, T.loop1, T.panC + 0.3) + on(c, T.panG2 - 0.4, T.fadeG));
  const kick = on(c, T.iron + 0.1, T.iron + 1.6);
  return (
    <svg width={1080} height={1920} viewBox="0 0 1080 1920">
      <g transform={layerTransform(cam, 0.85)}><Table /></g>
      <g transform={layerTransform(cam, 1)}>
        <MapSheet />
        <FieldOnTable k={on(c, T.flowT, T.panT)} c={c} />
        <Pencil />
        <g transform={`translate(0 ${-3 * Math.sin((c / 5) * Math.PI * 2)})`}><IsoCup u={96} o={P([1.0, 5.2, 0])} t={c} /></g>
        <IronBlock k={kick} />
        {/* true north: a dashed line from the dial to the top of the map */}
        {c >= T.tnLine - 0.1 && c < T.declBack + 1 && <g opacity={on(c, T.tnLine, T.declBack + 0.3)}>
          <line x1={tn0[0]} y1={tn0[1]} x2={tn1[0]} y2={tn1[1]} stroke={BLACK} strokeWidth={7} strokeDasharray="16 12" strokeLinecap="round" />
          <path d={smoothPath(arc.slice(0, 1 + Math.round(11 * clamp01((c - T.arc) / 0.6))))} fill="none" stroke={YELLOW_D} strokeWidth={9} strokeLinecap="round" opacity={clamp01((c - T.arc) / 0.2)} />
        </g>}
        <BarMagnet x={mx} />
        <Compass angle={ang} c={c} />
        {/* the labels on the compass and the magnet */}
        <Tag text="ujung utara" x={700} y={640} c={c} a={T.lblU} b={T.magIn - 0.2} hl={["utara"]} fs={50} to={needleTip(1.75, 0)} />
        <Tag text="ujung selatan" x={330} y={1290} c={c} a={T.lblS} b={T.magIn - 0.2} fs={50} to={needleTip(-1.75, 0)} />
        <Tag text="poros" x={400} y={720} c={c} a={T.lblPivot} b={T.magIn - 0.2} fs={50} to={P([0, 0, 0.72])} />
        <Tag text="magnet menarik jarum" x={P([4.5, -2.1, 1.3])[0] - 40} y={P([4.5, -2.1, 1.3])[1]} c={c} a={T.magPull} b={T.magOut} fs={44} />
        <Tag text="utara sejati" x={760} y={700} c={c} a={T.lblTrue} b={T.declBack + 0.3} fs={46} to={tn1} />
        <Tag text="utara jarum" x={380} y={720} c={c} a={T.lblDecl} b={T.declBack} fs={46} to={needleTip(1.75, 0)} />
        {declK > 0 && <Tag text="selisih" x={860} y={1130} c={c} a={T.lblDecl + 0.4} b={T.declBack} fs={44} to={P([0.33, -2.67, 0.07])} />}
        <Tag text="magnet" x={P([mx, 1.4, 1])[0]} y={P([mx, 1.4, 1])[1] + 20} c={c} a={T.lblMag} b={T.magOut2} fs={46} />
        <Tag text="besi besar" x={790} y={1330} c={c} a={T.lblIron} b={T.dipEnd} fs={46} to={P([4.3, 3.65, 0.7])} />
        {/* myth chips: "cari utara" is crossed out, "ikut medan" is what the needle does */}
        {c >= T.noChip - 0.1 && c < T.panC2 + 7 && <g>
          <Tag text="cari utara" x={540} y={600} c={c} a={T.noChip} b={41.0} fs={64} />
          <Line x1={330} y1={600} x2={750} y2={600} k={clamp01((c - T.noStrike) / 0.4)} col={BLACK} w={10} head={false} />
          <Tag text="ikut medan Bumi" x={540} y={1560} c={c} a={T.yesChip} b={41.0} fs={64} hl={["medan"]} />
        </g>}
        {/* the globe, its layers and its field */}
        <g opacity={clamp01((c - 9.0) / 0.6) * (c < 38 ? 1 : 1 - clamp01((c - 38) / 0.6)) + (c < 9.0 ? 1 : 0) * 0}><Globe c={c} /></g>
        <FieldLoops c={c} k={(1 - 0.65 * on(c, T.bar, T.fadeG)) * (1 - clamp01((c - T.fadeG) / 0.6)) * gWin} />
        {c >= T.mini && c < T.fadeG && gWin > 0.01 && <g opacity={gWin}><MiniNeedles c={c} /></g>}
        <EarthMagnet c={c} />
        <Tag text="besi & nikel cair" x={gx + 80} y={gy + gr * 0.48} c={c} a={T.lblLiquid} b={T.lblCrust} fs={48} hl={["cair"]} />
        <Tag text="inti luar Bumi" x={gx} y={gy - gr * 0.72} c={c} a={T.lblCrust} b={T.uncut} fs={48} />
        <Tag text="garis medan" x={gx + 380} y={gy - 440} c={c} a={T.lblLines} b={T.mini + 3} fs={50} hl={["medan"]} />
        <Tag text="miring ±11°" x={gx + 209} y={gy - 663} c={c} a={T.tilt} b={T.panC} fs={44} to={[gx + 1.3 * gr * Math.sin((FIELD_TILT * Math.PI) / 180), gy - 1.3 * gr * Math.cos((FIELD_TILT * Math.PI) / 180)]} />
        <Tag text="jarum ikut sejajar" x={540} y={600} c={c} a={T.lblAlign} b={T.panC2 + 1} fs={50} />
        <Tag text="kutub selatan magnet" x={gx + gr * 0.9} y={gy - gr * 0.9} c={c} a={T.kS} b={T.fadeG} fs={46} hl={["selatan"]} />
        <Tag text="ujung utara jarum" x={gx + gr * 1.0} y={gy - gr * 1.5} c={c} a={T.kN} b={T.fadeG} fs={46} />
        <Tag text="beda kutub: tarik" x={gx - gr * 0.1} y={gy + gr * 1.05} c={c} a={T.lblPull} b={T.fadeG} fs={50} />
      </g>
      {!isOutro && <DipCard c={c} />}
      {beat.kind !== "sting" && beat.kind !== "outro" && <TopText key={beat.id} kicker={KICK[beat.id] ?? "INTIP"} headline={beat.text} t={t} />}
      {beat.kind !== "sting" && beat.kind !== "outro" && <CaptionLayer beat={beat} t={t} />}
      {beat.kind === "sting" && (() => {
        const p = springAt(c, 3.0), p2 = springAt(c, 3.25);
        return <g>
          <g transform={`translate(540 720) scale(${Math.max(0, p)}) translate(-540 -720)`}><Mascot x={540} y={720} w={220} expr="curious" t={t} clock={c} squash={0.18 * (1 - p)} /></g>
          <g transform={`translate(540 1489) scale(${Math.max(0, p2)}) translate(-540 -1489)`}>
            <rect x={330} y={1443} width={420} height={92} rx={46} fill={YELLOW} />
            <text x={540} y={1507} fontSize={56} textAnchor="middle" fill={BLACK} style={bold}>Intip yuk!</text>
          </g>
        </g>;
      })()}
    </svg>
  );
};
const KICK: Record<string, string> = { hook: "KOMPAS", jarum: "JARUM", bumi: "BUMI", garis: "MEDAN", kutub: "KUTUB", hasil: "JAWABANNYA", fakta: "TAPI", tips: "TIPS" };

export const Video: React.FC<{ story: StoryT; layoutDebug?: boolean }> = (p) => <StoryVideo story={p.story} scene={Scene} layoutDebug={p.layoutDebug} />;
