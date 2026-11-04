/* Kenapa api lilin selalu mengarah ke atas?: one set (kind "night-cabinet": a low cabinet top against a dusky wall in a power cut, with a torch, a matchbox,
   a stack of books and a framed picture), one hero (a pillar candle on a saucer: a wax cylinder with a melt pool and a drip, a curved wick, and its real
   flame: a teardrop, round at the bottom and pointed at the top, a blue base, a dark zone round the wick and a yellow luminous zone) and one continuous
   camera (plan.ts CAM). The wax climbs the wick, the hot gas rises, the cold air sinks and flows in at the base, the glowing soot makes the yellow tip;
   in orbit (a porthole inset) the flame is a blue ball. The first frame is the last (loop). */
import React from "react";
import {
  BLACK, CaptionLayer, Label, Mascot, Motes, SourceChip, StoryVideo, TipCard, TopText, YELLOW, block, cam2At, clamp01, cylinder, easeInOut, easeOutBack,
  flicker, layerTransform, ptsAttr, springAt, swayDeg, useFonts, type P3, type Poly, type SceneProps, type StoryT,
} from "../../src/design/index.ts";
import { COFFEE, COFFEE_LIGHT, G1, G2, G3, G4, HOT1, HOT2, ISO, PLASTER, WHITE, YELLOW_D } from "../../src/tokens.ts";
import { mixRgb } from "../../src/natureGeometry.ts";
import { CAM, FLAME, O, SET, T, TOP_Y, U, WICK } from "./plan.ts";
import storyJson from "./story.json";

export const story = storyJson as unknown as StoryT;

type Tri = readonly [string, string, string];
const WALL = mixRgb(mixRgb(ISO.water[2], G1, 0.5), G2, 0.35), WALL_D = mixRgb(WALL, BLACK, 0.18), WALL_L = mixRgb(WALL, WHITE, 0.14);
const CAB: Tri = [mixRgb(COFFEE_LIGHT, G4, 0.45), mixRgb(COFFEE_LIGHT, G3, 0.3), mixRgb(COFFEE, G3, 0.35)];
const WAX: Tri = [mixRgb(WHITE, PLASTER, 0.12), mixRgb(G4, PLASTER, 0.3), mixRgb(G3, PLASTER, 0.45)];
const BOOK_A: Tri = [mixRgb(G3, ISO.water[0], 0.25), mixRgb(G2, G3, 0.5), mixRgb(G2, ISO.water[2], 0.15)];
const BOOK_B: Tri = [mixRgb(G3, COFFEE_LIGHT, 0.2), mixRgb(G3, COFFEE, 0.3), mixRgb(G2, COFFEE, 0.3)];
const PAGES: Tri = ISO.plastic;
const BOXT: Tri = [mixRgb(PLASTER, G4, 0.5), mixRgb(PLASTER, G3, 0.5), mixRgb(PLASTER, G2, 0.5)];
const STICK: Tri = [mixRgb(PLASTER, WHITE, 0.2), PLASTER, mixRgb(PLASTER, COFFEE_LIGHT, 0.5)];
const CHAR: Tri = [G2, G1, BLACK];
const STRIKE: Tri = [COFFEE_LIGHT, COFFEE, mixRgb(COFFEE, BLACK, 0.3)];
const ORANGE = HOT2, ORANGE_L = HOT1;
const COLD = ISO.water[0], COLD_D = ISO.water[1];
const INK = G1;
const SPACE = mixRgb(ISO.water[2], BLACK, 0.72);
const E1: P3 = [1, 0, 0], E2: P3 = [0, 1, 0];

const polys = (ps: Poly[], tones: Tri, op = 1, stroke = INK) => ps.map((p, i) => <polygon key={i} points={ptsAttr(p.pts)} fill={tones[p.tone]} stroke={stroke} strokeOpacity={0.35} strokeWidth={2} strokeLinejoin="round" opacity={op} />);
/** 0 to 1 over 0.35 s from `a`; and back to 0 at `b`. */
const on = (c: number, a: number, b = 1e9) => clamp01((c - a) / 0.35) * (1 - clamp01((c - b) / 0.35));
const frac = (x: number) => x - Math.floor(x);
const bez = (p: number[], s: number): [number, number] => {
  const m = 1 - s, a = m * m * m, b = 3 * m * m * s, c = 3 * m * s * s, d = s * s * s;
  return [a * p[0] + b * p[2] + c * p[4] + d * p[6], a * p[1] + b * p[3] + c * p[5] + d * p[7]];
};
const bezD = (p: number[]) => `M${p[0]} ${p[1]} C${p[2]} ${p[3]} ${p[4]} ${p[5]} ${p[6]} ${p[7]}`;
const mirror = (p: number[]) => p.map((v, i) => (i % 2 === 0 ? 2 * FLAME.x - v : v));

const Arrow2: React.FC<{ x1: number; y1: number; x2: number; y2: number; color: string; k: number; w?: number }> = ({ x1, y1, x2, y2, color, k, w = 12 }) => {
  if (k <= 0) return null;
  const ex = x1 + (x2 - x1) * k, ey = y1 + (y2 - y1) * k, a = Math.atan2(y2 - y1, x2 - x1), s = w * 2.2;
  return <g><line x1={x1} y1={y1} x2={ex} y2={ey} stroke={color} strokeWidth={w} strokeLinecap="round" />
    <polygon points={`${ex + Math.cos(a) * s * 0.4},${ey + Math.sin(a) * s * 0.4} ${ex - s * Math.cos(a - 0.55)},${ey - s * Math.sin(a - 0.55)} ${ex - s * Math.cos(a + 0.55)},${ey - s * Math.sin(a + 0.55)}`} fill={color} /></g>;
};

/** A moving stream of air: a dashed path whose dashes run along it (alive), with an arrowhead at its end. */
const Flow: React.FC<{ d: string; color: string; k: number; c: number; w: number; end?: [number, number, number] }> = ({ d, color, k, c, w, end }) => {
  if (k <= 0.01) return null;
  return <g opacity={k}>
    <path d={d} fill="none" stroke={color} strokeWidth={w} strokeLinecap="round" strokeDasharray={`${w * 2.6} ${w * 1.6}`} strokeDashoffset={-c * w * 9} />
    {end && <polygon points={`${end[0] + Math.cos(end[2]) * w * 1.6},${end[1] + Math.sin(end[2]) * w * 1.6} ${end[0] + Math.cos(end[2] + 2.3) * w * 1.6},${end[1] + Math.sin(end[2] + 2.3) * w * 1.6} ${end[0] + Math.cos(end[2] - 2.3) * w * 1.6},${end[1] + Math.sin(end[2] - 2.3) * w * 1.6}`} fill={color} />}
  </g>;
};

/** The candle flame as it really is (B27.16): a teardrop, round at the bottom and pointed at the top; a blue cup at the base, a dark zone round the wick,
    the yellow luminous zone and a pale core; it flickers and sways a little all the time. */
const Flame: React.FC<{ x: number; y: number; c: number; stretch?: number; sootK?: number }> = ({ x, y, c, stretch = 1, sootK = 0 }) => {
  const H = FLAME.h, W = FLAME.w;
  const tear = (w: number, h: number) => `M0 ${-h} C${0.35 * w} ${-0.62 * h} ${1.05 * w} ${-0.4 * h} ${w} ${-0.12 * h} C${0.95 * w} ${0.12 * h} ${0.55 * w} ${0.2 * h} 0 ${0.2 * h} C${-0.55 * w} ${0.2 * h} ${-0.95 * w} ${0.12 * h} ${-w} ${-0.12 * h} C${-1.05 * w} ${-0.4 * h} ${-0.35 * w} ${-0.62 * h} 0 ${-h} Z`;
  const fl = flicker(c, 0.1, 0.05), sw = swayDeg(c, 0.2, 2.4, 2.6);
  const soot: React.ReactNode[] = [];
  if (sootK > 0.01) for (let i = 0; i < 12; i++) {
    const s = frac(c / 1.4 + i / 12), yy = 0.05 * H - s * 0.85 * H, xx = (i % 2 ? 1 : -1) * W * 0.28 * Math.sin(i * 1.7 + s * 3) * (1 - s * 0.6);
    const hot = clamp01((s - 0.18) / 0.3);
    soot.push(<circle key={i} cx={xx} cy={yy} r={2.6} fill={hot > 0.5 ? mixRgb(YELLOW, WHITE, 0.6) : COFFEE} opacity={sootK * (1 - clamp01((s - 0.85) / 0.15))} />);
  }
  return (
    <g transform={`translate(${x} ${y}) rotate(${sw}) scale(${1 + (fl - 1) * 0.5} ${fl * stretch})`}>
      <path d={tear(W * 1.3, H * 1.08)} fill={mixRgb(WHITE, HOT1, 0.4)} opacity={0.22} />
      <path d={tear(W, H)} fill={ORANGE} />
      <g transform={`translate(0 ${-0.1 * H})`}><path d={tear(W * 0.9, H * 0.9)} fill={YELLOW} /></g>
      <g transform={`translate(0 ${-0.2 * H})`}><path d={tear(W * 0.5, H * 0.58)} fill={mixRgb(YELLOW, WHITE, 0.75)} opacity={0.9} /></g>
      <ellipse cx={0} cy={0.02 * H} rx={0.4 * W} ry={0.17 * H} fill={mixRgb(COFFEE, HOT2, 0.4)} opacity={0.55} />
      <path d={`M${-0.97 * W} ${-0.08 * H} Q0 ${0.36 * H} ${0.97 * W} ${-0.08 * H} Q0 ${0.15 * H} ${-0.97 * W} ${-0.08 * H} Z`} fill={ISO.water[1]} opacity={0.9} />
      {soot}
    </g>
  );
};

/** The set (kind "night-cabinet"): the wall with a rail and panels and a framed picture, the cabinet top and front, and the dressing on it. */
const SetBack: React.FC = () => {
  const panels: React.ReactNode[] = [];
  for (let i = -10; i < 16; i++) panels.push(<rect key={i} x={i * 330 + 40} y={700} width={250} height={SET.wallBottom - 740} rx={10} fill="none" stroke={WALL_L} strokeWidth={6} opacity={0.7} />);
  return (
    <g>
      <rect x={-3000} y={-4000} width={7000} height={4000 + SET.wallBottom} fill={WALL} />
      <rect x={-3000} y={640} width={7000} height={SET.wallBottom - 640} fill={WALL_D} />
      <rect x={-3000} y={624} width={7000} height={26} fill={WALL_L} />
      {panels}
      {/* a framed picture on the wall, 15 x 20 cm: a grey frame, a pale mat, a quiet grey print */}
      <g>
        <rect x={978} y={-42} width={495} height={660} fill={BLACK} opacity={0.35} />
        <rect x={960} y={-60} width={495} height={660} fill={G2} stroke={INK} strokeOpacity={0.4} strokeWidth={4} />
        <rect x={990} y={-30} width={435} height={600} fill={mixRgb(G2, G3, 0.6)} />
        <rect x={1035} y={15} width={345} height={510} fill={G4} />
        <circle cx={1280} cy={150} r={52} fill={G3} />
        <path d="M1035 525 L1035 390 Q1125 310 1210 380 Q1290 320 1380 395 L1380 525 Z" fill={mixRgb(G3, G2, 0.3)} />
      </g>
      {/* the cabinet: its top (from the wall to the front edge), a lip and the front with a drawer and a knob */}
      <rect x={-3000} y={SET.wallBottom} width={7000} height={SET.cabinetFront - SET.wallBottom} fill={CAB[0]} />
      <rect x={-3000} y={SET.wallBottom} width={7000} height={18} fill={CAB[2]} opacity={0.6} />
      <rect x={-3000} y={SET.cabinetFront} width={7000} height={40} fill={CAB[1]} />
      <rect x={-3000} y={SET.cabinetFront + 40} width={7000} height={3000} fill={CAB[2]} />
      <rect x={-3000} y={SET.cabinetFront + 420} width={7000} height={10} fill={INK} opacity={0.25} />
      <rect x={480} y={SET.cabinetFront + 200} width={120} height={36} rx={18} fill={ISO.metal[1]} stroke={INK} strokeOpacity={0.4} strokeWidth={3} />
    </g>
  );
};

/** The glow of the candle on the wall and the cabinet, a little alive (it flickers with the flame); drawn clipped so it stays out of the top text (B27.11). */
const Glow: React.FC<{ c: number }> = ({ c }) => {
  const f = flicker(c, 0.4, 0.06);
  return <g>{Array.from({ length: 14 }, (_, i) => 1 - i * 0.065).map((k, i) => <ellipse key={i} cx={FLAME.x} cy={FLAME.y - 60 + 40 * (1 - k)} rx={760 * k} ry={620 * k} fill={HOT1} opacity={0.026 * f} />)}</g>;
};

const Dressing: React.FC = () => (
  <g>
    {/* a stack of two books, back right (21 x 15 x 2.5 cm each) */}
    {polys(block([9, -18, 0], [30, -3, 2.5], U, O), BOOK_A)}
    {polys(block([9.4, -17.6, 2.5], [29.4, -3.6, 2.6], U, O), PAGES)}
    {polys(block([10, -17, 2.6], [29, -4, 5.1], U, O), BOOK_B)}
    {/* a torch lying on the cabinet, front left (13 cm body, a wider head towards the viewer) */}
    {polys(cylinder([-10, -1, 1.5], [-10, 10, 1.5], 1.5, 1.5, [1, 0, 0], [0, 0, 1], U, O), ISO.dark)}
    {polys(cylinder([-10, 10, 1.5], [-10, 12.6, 1.5], 1.6, 2.1, [1, 0, 0], [0, 0, 1], U, O), ISO.metal)}
  </g>
);

const Matchbox: React.FC = () => (
  <g>
    {polys(block([7.25, 5.25, 0], [12.75, 8.75, 1.6], U, O), BOXT)}
    {polys(block([7.25, 8.75, 0.25], [12.75, 8.9, 1.35], U, O), STRIKE)}
    {/* a burnt match beside it */}
    {polys(block([8, 2.8, 0], [12.5, 3.1, 0.25], U, O), STICK)}
    {polys(block([7.4, 2.7, 0], [8, 3.2, 0.32], U, O), CHAR)}
  </g>
);

/** The candle on its saucer: a white ceramic saucer, a wax cylinder (7 cm across, 10 cm high), the melt pool on top, a drip down the front, the wick. */
const Candle: React.FC<{ c: number; poolK: number }> = ({ c, poolK }) => {
  const rimY = TOP_Y;
  const rx = SET.candleR * Math.SQRT2 * Math.cos(Math.PI / 6) * U, ry = SET.candleR * Math.SQRT1_2 * U;
  return (
    <g>
      <ellipse cx={O[0] + 16} cy={O[1] + 30} rx={SET.saucerR * 1.32 * U} ry={SET.saucerR * 0.78 * U} fill={BLACK} opacity={0.18} />
      {polys(cylinder([0, 0, 0], [0, 0, SET.saucerH], SET.saucerR, SET.saucerR + 0.3, E1, E2, U, O), ISO.plastic)}
      <ellipse cx={O[0]} cy={O[1] - SET.saucerH * U} rx={(SET.saucerR - 1.6) * 1.2247 * U} ry={(SET.saucerR - 1.6) * 0.7071 * U} fill={G4} />
      {polys(cylinder([0, 0, SET.saucerH], [0, 0, SET.candleTop], SET.candleR, SET.candleR, E1, E2, U, O), WAX)}
      {/* the melt pool: a glossy liquid in a shallow cup inside the rim */}
      <ellipse cx={O[0]} cy={rimY + 4} rx={rx * 0.84} ry={ry * 0.84} fill={WAX[1]} />
      <ellipse cx={O[0]} cy={rimY + 6} rx={rx * 0.8} ry={ry * 0.78} fill={WHITE} opacity={0.6 + 0.4 * poolK} />
      <ellipse cx={O[0] - 40} cy={rimY - 8} rx={rx * 0.28} ry={ry * 0.16} fill={WHITE} opacity={0.4 + 0.4 * poolK * (0.5 + 0.5 * Math.sin(c * 3))} />
      {poolK > 0.01 && <ellipse cx={O[0] + 6} cy={rimY + 6} rx={rx * 0.3 * (1 + 1.6 * frac(c / 1.6))} ry={ry * 0.3 * (1 + 1.6 * frac(c / 1.6))} fill="none" stroke={WAX[2]} strokeWidth={2.5} opacity={poolK * (1 - frac(c / 1.6))} />}
      {/* a drip of wax down the front */}
      <path d={`M${O[0] - 82} ${rimY + 64} C${O[0] - 84} ${rimY + 120} ${O[0] - 86} ${rimY + 168} ${O[0] - 72} ${rimY + 176} C${O[0] - 58} ${rimY + 168} ${O[0] - 62} ${rimY + 120} ${O[0] - 58} ${rimY + 74} Z`} fill={WAX[0]} stroke={WAX[2]} strokeWidth={2.5} />
      {/* the wick: a cotton cord that curls a little, black where it burns, a glowing tip */}
      <path d={`M${O[0]} ${rimY + 6} Q${O[0] + 1} ${rimY - 10} ${WICK.x} ${WICK.y}`} fill="none" stroke={G1} strokeWidth={5.5} strokeLinecap="round" />
      <circle cx={WICK.x} cy={WICK.y} r={3.2} fill={ORANGE} opacity={0.7 + 0.3 * flicker(c, 0.7, 0.2)} />
    </g>
  );
};

/** The inset of the candle in orbit: a porthole, the dark cabin, a short candle and its flame as a blue ball (no convection, B27.16). */
const Porthole: React.FC<{ c: number; k: number; ballK: number; moteK: number }> = ({ c, k, ballK, moteK }) => {
  if (k <= 0.01) return null;
  const X = 330, Y = 790, R = 250;
  const mini = cylinder([0, 0, 0], [0, 0, 6], 2.4, 2.4, E1, E2, 15, [X, 1030]);
  const fy = 1030 - 6 * 15 - 22;
  return (
    <g transform={`translate(${X} ${Y}) scale(${k}) translate(${-X} ${-Y})`}>
      <defs>
        <clipPath id="port"><circle cx={X} cy={Y} r={R - 12} /></clipPath>
      </defs>
      <circle cx={X} cy={Y} r={R} fill={SPACE} />
      <g clipPath="url(#port)">
        {Array.from({ length: 22 }, (_, i) => <circle key={i} cx={X - 220 + ((i * 173) % 440)} cy={Y - 220 + ((i * 271) % 440)} r={1.5 + (i % 3)} fill={WHITE} opacity={0.35 + 0.35 * Math.sin(c * 2 + i)} />)}
        <rect x={X - 260} y={1030 - 10} width={520} height={240} fill={mixRgb(G2, ISO.water[2], 0.3)} />
        {polys(mini, WAX)}
        <line x1={X} y1={1030 - 90} x2={X + 2} y2={fy + 6} stroke={G1} strokeWidth={4} strokeLinecap="round" />
        <g transform={`translate(${X} ${fy}) scale(${(0.4 + 0.6 * ballK) * (1 + 0.03 * Math.sin(c * 5))})`} opacity={ballK}>
          <circle r={82} fill={ISO.water[1]} opacity={0.9} />
          <circle r={66} fill={mixRgb(ISO.water[0], WHITE, 0.25)} opacity={0.55} />
          <circle r={50} fill={SPACE} opacity={0.55} />
        </g>
        {moteK > 0.01 && Array.from({ length: 8 }, (_, i) => <circle key={i} cx={X - 160 + i * 46 + 10 * Math.sin(c * 0.8 + i)} cy={Y - 150 + ((i * 97) % 200) + 10 * Math.cos(c * 0.7 + i)} r={4} fill={WHITE} opacity={0.5 * moteK} />)}
      </g>
      <circle cx={X} cy={Y} r={R - 6} fill="none" stroke={ISO.metal[1]} strokeWidth={26} />
      <circle cx={X} cy={Y} r={R + 6} fill="none" stroke={ISO.metal[2]} strokeWidth={6} />
      {Array.from({ length: 8 }, (_, i) => <circle key={i} cx={X + (R - 6) * Math.cos((i * Math.PI) / 4)} cy={Y + (R - 6) * Math.sin((i * Math.PI) / 4)} r={6} fill={ISO.metal[0]} />)}
    </g>
  );
};

// the streams of air (world px): hot gas up the middle; the cold air down the sides and in at the base; the fresh air over the rim
const UP_D = `M${FLAME.x} 712 L${FLAME.x} 400`;
const R_TOP = [FLAME.x + 10, 395, 700, 330, 840, 380, 840, 520], R_DOWN = [840, 520, 840, 700, 840, 860, 604, 876];
const IN1 = [330, 1080, 385, 960, 420, 890, 530, 878], IN2 = [300, 830, 400, 840, 470, 862, 530, 874];

const Scene = ({ beat, t, clock }: SceneProps) => {
  useFonts();
  const c = clock;
  const cam = cam2At(CAM, c);
  const kind = beat.kind;
  const stretch = 1 + 0.14 * easeInOut(clamp01((c - T.stretch) / 0.8)) * (1 - clamp01((c - 34.6) / 0.6));
  const poolK = on(c, T.pool, 10.8);
  const sootK = on(c, T.soot, 41.8);

  // sumbu: the liquid wax climbs the wick and turns to vapour
  const drops: React.ReactNode[] = [];
  if (c > T.drops && c < 11) for (let i = 0; i < 4; i++) {
    const s = frac((c - T.drops) / 1.2 + i / 4);
    const x = O[0] + (WICK.x - O[0]) * s * s, y = TOP_Y + 6 + (WICK.y - TOP_Y - 6) * s;
    drops.push(<circle key={`d${i}`} cx={x} cy={y} r={3.6} fill={mixRgb(YELLOW_D, PLASTER, 0.3)} opacity={on(c, T.drops, 10.6)} />);
  }
  if (c > T.vapor && c < 11) for (let i = 0; i < 5; i++) {
    const s = frac((c - T.vapor) / 1.4 + i / 5);
    drops.push(<circle key={`v${i}`} cx={WICK.x + 8 * Math.sin(i * 2 + s * 4)} cy={WICK.y - 4 - 70 * s} r={3 + 3 * s} fill={G4} opacity={on(c, T.vapor, 10.6) * (1 - s) * 0.9} />);
  }

  // panas: bubbles of hot gas grow as they rise from the tip
  const gas: React.ReactNode[] = [];
  if (c > T.gas && c < 19.2) for (let i = 0; i < 4; i++) {
    const age = frac((c - T.gas) / 3.6 + i / 4) * 3.6;
    if (c - T.gas < i * 0.9) continue;
    const r = 14 + age * (c > T.grow ? 11 : 6), y = 712 - age * 80;
    const k = on(c, T.gas, 18.9) * (1 - clamp01((age - 2.8) / 0.8));
    gas.push(<g key={`g${i}`} opacity={k}><circle cx={FLAME.x + 6 * Math.sin(age * 2 + i)} cy={y} r={r} fill={ORANGE_L} opacity={0.4} stroke={ORANGE} strokeWidth={4} />
      {[0, 1, 2].map((j) => <circle key={j} cx={FLAME.x + Math.cos(j * 2.1 + i) * r * 0.5} cy={y + Math.sin(j * 2.1 + i) * r * 0.5} r={4} fill={ORANGE} />)}</g>);
  }

  // oksigen: molecules of fresh air ride the inflow
  const o2: React.ReactNode[] = [];
  const o2K = on(c, T.o2, 34.8);
  if (o2K > 0.01) [IN1, IN2, mirror(IN1), mirror(IN2)].forEach((p, pi) => {
    for (let i = 0; i < 3; i++) { const [x, y] = bez(p, frac(c / 2.2 + i / 3 + pi * 0.17)); o2.push(<circle key={`${pi}-${i}`} cx={x} cy={y} r={7} fill={WHITE} stroke={COLD_D} strokeWidth={3} opacity={o2K} />); }
  });

  const isOutro = kind === "outro";
  const kicker = ({ hook: "KENAPA LILIN", sumbu: "BAHAN BAKARNYA", panas: "INTIP UDARA", naik: "KONVEKSI", oksigen: "INTIP UDARA", kuning: "JAWABANNYA", angkasa: "DI LUAR ANGKASA", tips: "INGAT YA" } as Record<string, string>)[beat.id] ?? "INTIP LILIN";

  return (
    <svg width={1080} height={1920} viewBox="0 0 1080 1920">
      <defs>
        <clipPath id="belowTop"><rect x={0} y={345} width={1080} height={1575} /></clipPath>
      </defs>
      {/* far: the room beyond the light (p 0.3) */}
      <g transform={layerTransform(cam, 0.3)}><rect x={-3000} y={-3600} width={7000} height={8000} fill={WALL_D} /></g>
      {/* the set at p 1, and the candle's glow on it (clipped below the top text) */}
      <g transform={layerTransform(cam, 1)}><SetBack /></g>
      <g clipPath="url(#belowTop)"><g transform={layerTransform(cam, 1)}><Glow c={c} /></g></g>
      <g transform={layerTransform(cam, 1)}>
        <Dressing />
        <Candle c={c} poolK={poolK} />
        {gas}

        {/* naik: the convection loop */}
        <Flow d={UP_D} color={ORANGE} k={on(c, T.upFlow, 26.8)} c={c} w={13} end={[FLAME.x, 400, -Math.PI / 2]} />
        <Flow d={bezD(R_TOP)} color={ORANGE} k={on(c, T.downR, 26.8)} c={c} w={11} />
        <Flow d={bezD(R_DOWN)} color={COLD} k={on(c, T.downR, 26.8)} c={c} w={11} end={[604, 876, Math.PI]} />
        <Flow d={bezD(mirror(R_TOP))} color={ORANGE} k={on(c, T.downL, 26.8)} c={c} w={11} />
        <Flow d={bezD(mirror(R_DOWN))} color={COLD} k={on(c, T.downL, 26.8)} c={c} w={11} end={[2 * FLAME.x - 604, 876, 0]} />

        {/* oksigen: fresh air flows in over the rim, the hot gas leaves at the top */}
        <Flow d={bezD(IN1)} color={COLD} k={on(c, T.inL, 34.8)} c={c} w={7} end={[530, 878, -0.1]} />
        <Flow d={bezD(IN2)} color={COLD} k={on(c, T.inL, 34.8)} c={c} w={7} end={[530, 874, 0.2]} />
        <Flow d={bezD(mirror(IN1))} color={COLD} k={on(c, T.inR, 34.8)} c={c} w={7} end={[2 * FLAME.x - 530, 878, Math.PI + 0.1]} />
        <Flow d={bezD(mirror(IN2))} color={COLD} k={on(c, T.inR, 34.8)} c={c} w={7} end={[2 * FLAME.x - 530, 874, Math.PI - 0.2]} />
        <Flow d={`M${FLAME.x} 700 L${FLAME.x} 600`} color={ORANGE} k={on(c, T.outTop, 34.8)} c={c} w={7} end={[FLAME.x, 600, -Math.PI / 2]} />
        {o2}

        {/* tips: the two rules as arrows beside the flame */}
        <Flow d={`M700 860 L700 600`} color={ORANGE} k={on(c, T.arrows, 55.8)} c={c} w={12} end={[700, 600, -Math.PI / 2]} />
        <Flow d={`M392 600 L392 860`} color={COLD} k={on(c, T.arrows + 0.3, 55.8)} c={c} w={12} end={[392, 860, Math.PI / 2]} />

        <Flame x={FLAME.x} y={FLAME.y} c={c} stretch={stretch} sootK={sootK} />
        {/* the wick stands inside the flame's dark zone: seen through it, with the wax climbing it */}
        <path d={`M${O[0]} ${TOP_Y + 6} Q${O[0] + 1} ${TOP_Y - 10} ${WICK.x} ${WICK.y}`} fill="none" stroke={G1} strokeWidth={5.5} strokeLinecap="round" opacity={0.8} />
        {drops}
        <Matchbox />
      </g>
      {/* near: dust in the candle light (p 1.4) */}
      <g transform={layerTransform(cam, 1.4)} clipPath="url(#belowTop)"><g transform="translate(-200 -300) scale(1.4)"><Motes t={c} color={HOT1} n={16} opacity={0.22} /></g></g>

      {/* the labels and cards of each beat, in the frame (px) */}
      {kind === "normal" && beat.id === "sumbu" && <g>
        <Arrow2 x1={420} y1={680} x2={500} y2={780} color={WHITE} k={clamp01((c - T.lblVapor) / 0.4)} w={8} />
        <Label text="uap terbakar" x={300} y={640} fs={50} t={c} start={T.lblVapor} onDark highlight={["uap"]} />
        <Arrow2 x1={700} y1={850} x2={585} y2={920} color={WHITE} k={clamp01((c - T.lblWick) / 0.4)} w={8} />
        <Label text="naik lewat" lines={["sumbu"]} x={800} y={770} fs={44} t={c} start={T.lblWick} onDark highlight={["sumbu"]} />
        <Label text="lilin cair" x={540} y={1280} fs={54} t={c} start={T.lblPool} onDark highlight={["cair"]} />
      </g>}
      {beat.id === "panas" && <g>
        {on(c, T.cmpCold) > 0.01 && <g opacity={on(c, T.cmpCold)} transform={`translate(205 760) scale(${easeOutBack(clamp01((c - T.cmpCold) / 0.5))})`}>
          <circle r={105} fill={COLD} opacity={0.35} stroke={COLD_D} strokeWidth={5} />
          {Array.from({ length: 14 }, (_, i) => <circle key={i} cx={Math.cos(i * 2.4) * (20 + (i % 4) * 18) + 3 * Math.sin(c * 4 + i)} cy={Math.sin(i * 2.4) * (20 + (i % 4) * 18)} r={8} fill={COLD_D} />)}
        </g>}
        {on(c, T.cmpHot) > 0.01 && <g opacity={on(c, T.cmpHot)} transform={`translate(860 740) scale(${easeOutBack(clamp01((c - T.cmpHot) / 0.5))})`}>
          <circle r={135} fill={ORANGE_L} opacity={0.35} stroke={ORANGE} strokeWidth={5} />
          {Array.from({ length: 5 }, (_, i) => <circle key={i} cx={Math.cos(i * 1.26) * 75 + 8 * Math.sin(c * 5 + i)} cy={Math.sin(i * 1.26) * 75 + 8 * Math.cos(c * 5 + i)} r={8} fill={ORANGE} />)}
        </g>}
        <Label text="dingin, rapat" x={215} y={930} fs={42} t={c} start={T.lblCold} onDark />
        <Label text="panas, renggang" x={770} y={950} fs={42} t={c} start={T.lblCold + 0.3} onDark />
        {c < T.lblLight - 0.2 && <Label text="gas panas mengembang" x={540} y={1450} fs={50} t={c} start={T.lblHot} onDark highlight={["mengembang"]} />}
        {c >= T.lblLight - 0.2 && <Label text="lebih ringan dari udara" x={540} y={1450} fs={50} t={c} start={T.lblLight} onDark highlight={["ringan"]} />}
      </g>}
      {beat.id === "naik" && <g>
        <Label text="panas naik" x={760} y={640} fs={48} t={c} start={T.lblUp} onDark highlight={["naik"]} />
        <Label text="dingin turun" x={330} y={600} fs={46} t={c} start={T.lblDown} onDark highlight={["turun"]} />
        <Arrow2 x1={330} y1={690} x2={330} y2={890} color={WHITE} k={clamp01((c - T.gravity) / 0.5)} w={10} />
        <Label text="gravitasi" x={330} y={960} fs={44} t={c} start={T.gravity + 0.3} onDark />
        <Label text="ini konveksi" x={540} y={1450} fs={58} t={c} start={T.lblConv} onDark highlight={["konveksi"]} />
      </g>}
      {beat.id === "oksigen" && <g>
        <Label text="udara segar" x={250} y={640} fs={48} t={c} start={T.lblFresh} onDark />
        <Label text="oksigen" x={840} y={640} fs={48} t={c} start={T.lblO2} onDark highlight={["oksigen"]} />
        <Label text="api memanjang" x={540} y={1450} fs={54} t={c} start={T.lblLong} onDark highlight={["memanjang"]} />
      </g>}
      {beat.id === "kuning" && <g>
        <Arrow2 x1={700} y1={840} x2={630} y2={880} color={WHITE} k={clamp01((c - T.lblSoot) / 0.4)} w={8} />
        <Label text="jelaga" lines={["berpijar"]} x={800} y={790} fs={46} t={c} start={T.lblSoot} onDark highlight={["berpijar"]} />
        <Arrow2 x1={330} y1={1190} x2={450} y2={1210} color={WHITE} k={clamp01((c - T.lblBlue) / 0.4)} w={8} />
        <Label text="dasar biru" x={230} y={1180} fs={46} t={c} start={T.lblBlue} onDark />
        <Arrow2 x1={380} y1={700} x2={510} y2={710} color={WHITE} k={clamp01((c - T.lblTip) / 0.4)} w={8} />
        <Label text="meruncing" x={250} y={690} fs={46} t={c} start={T.lblTip} onDark highlight={["meruncing"]} />
        <SourceChip x={540} y={1440} text="Wikipedia: Candle, Flame" t={c} start={T.chip} align="middle" />
      </g>}
      {beat.id === "angkasa" && <g>
        <Porthole c={c} k={easeOutBack(clamp01((c - T.port) / 0.6))} ballK={clamp01((c - T.ball) / 0.6)} moteK={clamp01((c - T.motes) / 0.5)} />
        <Label text="luar angkasa: bulat" x={330} y={1110} fs={44} t={c} start={T.lblSpace} onDark highlight={["bulat"]} />
        <Label text="Bumi: meruncing" x={750} y={560} fs={42} t={c} start={T.lblEarth} onDark />
      </g>}
      {beat.id === "tips" && <g>
        <SourceChip x={540} y={1180} text="Wikipedia: Convection" t={c} start={T.chipT} align="middle" />
        <TipCard x={100} y={1240} w={880} n={1} title="Udara panas naik" keyword="panas" t={c} start={T.cardA} />
        <TipCard x={100} y={1400} w={880} n={2} title="Udara dingin turun" keyword="dingin" t={c} start={T.cardB} />
      </g>}

      {kind !== "sting" && !isOutro && <TopText key={beat.id} kicker={kicker} headline={beat.text} t={t} onDark />}
      {kind !== "sting" && !isOutro && <CaptionLayer beat={beat} t={t} />}
      {kind === "sting" && (() => {
        const p = springAt(c, 3.0), p2 = springAt(c, 3.25);
        return <g>
          <g transform={`translate(540 720) scale(${Math.max(0, p)}) translate(-540 -720)`}><Mascot x={540} y={720} w={220} expr="curious" t={t} clock={c} squash={0.18 * (1 - p)} /></g>
          <g transform={`translate(540 1489) scale(${Math.max(0, p2)}) translate(-540 -1489)`}>
            <rect x={-210 + 540} y={1443} width={420} height={92} rx={46} fill={YELLOW} />
            <text x={540} y={1507} fontSize={56} textAnchor="middle" fill={BLACK} style={{ fontFamily: '"Outfit", sans-serif', fontWeight: 700 }}>Intip yuk!</text>
          </g>
        </g>;
      })()}
    </svg>
  );
};

export const Video: React.FC<{ story: StoryT; layoutDebug?: boolean }> = (p) => <StoryVideo story={p.story} scene={Scene} layoutDebug={p.layoutDebug} />;

