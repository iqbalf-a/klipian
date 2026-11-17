/* Kenapa gurun dingin banget di malam hari? — look 2d (B28): a flat SIDE view of a desert (set kind "desert-dunes", see set.json). Real shapes (B27.16): a dune is a
   long windward slope that ends in a sharp crest and a short slip face (the lee side, drawn as the darker tone); the thermometer is a glass tube with a bulb, a scale
   and a red column; the town is low blocks; a cloud is a flat-bottomed heap. Two tones per part (a base and a shade, light from the top left), no outlines, palette tokens
   only. One world, one camera (plan.ts camAt), one time of day d (dayAt) that moves the sun, the moon, the sky and the stars, one temperature T (tempAt) that fills the
   thermometer and glows the sand. Ambient motion (the sun's rays, the stars, the vapour, the heat shimmer) runs on the loop clock (B29). */
import React from "react";
import {
  loopClock, BLACK, CaptionLayer, FONT_BOLD, FONT_MONO, G1, G2, G3, G4, Arrow, HOT1, HOT2, Label, PLASTER, RED, SKIN_A, SKIN_B, StoryVideo, STEAM, THEMES, TopText,
  WHITE, YELLOW, YELLOW_D, clamp01, springAt, type SceneProps, type StoryT,
} from "../../src/design/index.ts";
import storyJson from "./story.json";
import { BOUNCE, CURVE, FREE, JACKET, LABELS, RAYS, RISE, THERMO_X, TOWN, camAt, cityTempAt, cloudAt, cloudFade, dayAt, tempAt } from "./plan.ts";
import { StingMark } from "../../src/components/StingMark.tsx";

export const story = storyJson as unknown as StoryT;

const W = 1080, H = 1920;
const KICKER: Record<string, string> = { hook: "GURUN", siang: "SIANG HARI", malam: "MALAM HARI", lembap: "KOTA LEMBAP", kering: "GURUN KERING", pasir: "PASIR", fakta: "FAKTA", tips: "TIPS" };
const SKY = THEMES.sky;
const GROUND = 1318;
const XS = [180, 330, 480, 800, 950];                      // where the heat rises from the sand (clear of the thermometer)                                      // the town's pavement (world y)

const lerp = (a: number, b: number, u: number) => a + (b - a) * u;
const win = (t: number, a: number, b: number, f = 0.3) => clamp01((t - a) / f) * (1 - clamp01((t - b) / f));
const sway = (t: number, p: number, a: number) => a * Math.sin((2 * Math.PI * t) / p);
const smooth01 = (u: number) => { const c = clamp01(u); return c * c * (3 - 2 * c); };

type Pt = [number, number];
/** A smooth closed shape under a crest line (Catmull-Rom to Bezier), closed far below the frame. */
function layerPath(pts: Pt[]): string {
  let d = `M ${pts[0][0]} ${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    d += ` C ${p1[0] + (p2[0] - p0[0]) / 6} ${p1[1] + (p2[1] - p0[1]) / 6} ${p2[0] - (p3[0] - p1[0]) / 6} ${p2[1] - (p3[1] - p1[1]) / 6} ${p2[0]} ${p2[1]}`;
  }
  return `${d} L ${pts[pts.length - 1][0]} 2400 L ${pts[0][0]} 2400 Z`;
}
/** The crest line as a dense list of points (the same Catmull-Rom curve the shape is drawn with), so a lee side can follow the silhouette exactly. */
function dense(pts: Pt[]): Pt[] {
  const out: Pt[] = [pts[0]];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    const c1: Pt = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6], c2: Pt = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    for (let k = 1; k <= 16; k++) {
      const u = k / 16, v = 1 - u;
      out.push([v * v * v * p1[0] + 3 * v * v * u * c1[0] + 3 * v * u * u * c2[0] + u * u * u * p2[0], v * v * v * p1[1] + 3 * v * v * u * c1[1] + 3 * v * u * u * c2[1] + u * u * u * p2[1]]);
    }
  }
  return out;
}
const yAt = (pts: Pt[], x: number) => {
  const d = dense(pts);
  for (let i = 1; i < d.length; i++) if (x <= d[i][0]) { const a = d[i - 1], b = d[i]; return lerp(a[1], b[1], (x - a[0]) / Math.max(1e-6, b[0] - a[0])); }
  return d[d.length - 1][1];
};
/** The lee (slip face) of a dune: from the crest P down the silhouette to the foot V, then back up along an inner curve. */
function leePath(pts: Pt[], p: { x: number; run: number; h: number }): string {
  const d = dense(pts).filter((q) => q[0] >= p.x && q[0] <= p.x + p.run);
  const P = d[0], V = d[d.length - 1];
  return `M ${d.map((q) => `${q[0]} ${q[1]}`).join(" L ")} C ${V[0] - p.run * 0.35} ${V[1] + p.h * 0.2} ${P[0] + p.run * 0.2} ${P[1] + p.h * 0.75} ${P[0]} ${P[1]} Z`;
}

type Layer = { id: string; pts: Pt[]; base: string; lee: string; peaks: { x: number; run: number; h: number }[] };
const FAR: Layer = {
  id: "far", base: PLASTER, lee: SKIN_A,
  pts: [[-1000, 1110], [-500, 1040], [-100, 1085], [250, 1120], [600, 1050], [1000, 1015], [1400, 1095], [1800, 1080], [2200, 1030], [2600, 1075], [3200, 1090]],
  peaks: [{ x: -500, run: 300, h: 80 }, { x: 600, run: 280, h: 90 }, { x: 1000, run: 340, h: 100 }, { x: 2200, run: 320, h: 80 }],
};
const MID: Layer = {
  id: "mid", base: SKIN_A, lee: SKIN_B,
  pts: [[-1000, 1270], [-450, 1215], [-80, 1240], [300, 1275], [700, 1250], [1050, 1205], [1350, 1265], [1600, 1330], [3200, 1330]],
  peaks: [{ x: -450, run: 300, h: 70 }, { x: 700, run: 260, h: 70 }, { x: 1050, run: 280, h: 80 }],
};
const NEAR: Layer = {
  id: "near", base: SKIN_A, lee: SKIN_B,
  pts: [[-1000, 1370], [-450, 1312], [0, 1290], [380, 1335], [640, 1400], [860, 1392], [1200, 1345], [1500, 1332], [3200, 1332]],
  peaks: [{ x: 0, run: 360, h: 100 }, { x: -450, run: 260, h: 60 }],
};

/** One dune layer: the base, the lee sides (clipped to the shape), the dusk dimming and the glow of sand that has soaked up the sun. */
const Dunes: React.FC<{ layer: Layer; night: number; heat: number }> = ({ layer, night, heat }) => {
  const d = layerPath(layer.pts), cid = `clip-${layer.id}`;
  return (
    <g>
      <clipPath id={cid}><path d={d} /></clipPath>
      <path d={d} fill={layer.base} />
      <g clipPath={`url(#${cid})`}>
        {layer.peaks.map((p, i) => <path key={i} fill={layer.lee} d={leePath(layer.pts, p)} />)}
        {heat > 0.02 && <path d={d} fill={HOT1} opacity={0.5 * heat} />}
        {night > 0.02 && <path d={d} fill={G1} opacity={0.5 * night} />}
      </g>
    </g>
  );
};

const Sun: React.FC<{ x: number; y: number; amb: number }> = ({ x, y, amb }) => (
  <g transform={`translate(${x} ${y})`}>
    <g transform={`rotate(${amb * 24})`}>
      {Array.from({ length: 12 }, (_, i) => <rect key={i} x={-9} y={-150} width={18} height={50} rx={9} fill={YELLOW} transform={`rotate(${i * 30})`} />)}
    </g>
    <circle cx={8} cy={9} r={86} fill={YELLOW_D} />
    <circle r={86} fill={YELLOW} />
  </g>
);

const Moon: React.FC<{ x: number; y: number }> = ({ x, y }) => (
  <g transform={`translate(${x} ${y})`}>
    <circle cx={8} cy={9} r={72} fill={G3} />
    <circle r={72} fill={G4} />
    <circle cx={-22} cy={-18} r={14} fill={G3} /><circle cx={24} cy={14} r={10} fill={G3} /><circle cx={-12} cy={30} r={8} fill={G3} />
  </g>
);

/** The sky: stacked bands, the dusk glow near the horizon, the night veil and the stars. */
const Sky: React.FC<{ d: number; amb: number }> = ({ d, amb }) => {
  const dusk = Math.sin(Math.PI * d), night = clamp01((d - 0.3) / 0.5), stars = clamp01((d - 0.55) / 0.35);
  return (
    <g>
      <rect x={-1400} y={-900} width={5000} height={2500} fill={SKY.wall} />
      <rect x={-1400} y={820} width={5000} height={400} fill={WHITE} opacity={0.5} />
      <rect x={-1400} y={880} width={5000} height={340} fill={HOT1} opacity={0.65 * dusk} />
      <rect x={-1400} y={1000} width={5000} height={220} fill={HOT2} opacity={0.45 * dusk} />
      <rect x={-1400} y={-900} width={5000} height={2500} fill={G1} opacity={0.94 * night} />
      {stars > 0.01 && Array.from({ length: 44 }, (_, i) => {
        const x = -300 + ((i * 197) % 2700), y = 250 + ((i * 113) % 760), r = 3 + (i % 3) * 2;
        return <circle key={i} cx={x} cy={y} r={r * (0.75 + 0.25 * Math.sin((2 * Math.PI * amb) / [4, 5, 6, 10][i % 4] + i))} fill={WHITE} opacity={stars * 0.9} />;
      })}
    </g>
  );
};

/** The thermometer: a glass tube with a bulb on a stake, a scale on the left and a red column (T 0 to 1). Origin: the point where it is planted in the sand. */
const Thermo: React.FC<{ x: number; y: number; s: number; T: number }> = ({ x, y, s, T }) => {
  const top = -120 - 540 * T;
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <rect x={-14} y={-70} width={28} height={74} fill={G2} /><rect x={4} y={-70} width={10} height={74} fill={G1} />
      <rect x={-30} y={-760} width={76} height={660} rx={38} fill={G3} />
      <circle cx={8} cy={-118} r={64} fill={G3} />
      <rect x={-38} y={-768} width={76} height={668} rx={38} fill={WHITE} />
      <circle cx={0} cy={-124} r={64} fill={WHITE} />
      <rect x={-18} y={-700} width={36} height={600} rx={18} fill={G4} />
      <rect x={-13} y={top} width={26} height={-120 - top + 30} rx={13} fill={RED} />
      <circle cx={0} cy={-124} r={46} fill={RED} />
      <circle cx={-16} cy={-142} r={10} fill={WHITE} opacity={0.6} />
      {Array.from({ length: 15 }, (_, i) => <rect key={i} x={i % 5 === 0 ? -76 : -62} y={-690 + i * 40} width={i % 5 === 0 ? 30 : 18} height={6} rx={3} fill={G2} />)}
    </g>
  );
};

const Mound: React.FC<{ x: number; y: number; s: number }> = ({ x, y, s }) => (
  <g transform={`translate(${x} ${y}) scale(${s})`}>
    <path d="M -120 8 C -80 -20 -30 -40 10 -38 C 60 -36 100 -10 130 8 Z" fill={SKIN_B} />
    <path d="M -120 8 C -84 -22 -40 -36 -4 -36 C -50 -22 -86 -6 -96 8 Z" fill={SKIN_A} />
  </g>
);

/** Dressing on the near dune: sand ripples and two small rocks (flat, two tones, never a meaning colour). */
const Dressing: React.FC<{ night: number }> = ({ night }) => (
  <g opacity={1 - 0.45 * night}>
    {[[180, 1470, 300], [520, 1530, 380], [140, 1600, 420], [700, 1610, 360], [1000, 1500, 260], [380, 1680, 340], [900, 1700, 300]].map(([x, y, w], i) => (
      <path key={i} d={`M ${x} ${y} q ${w / 4} -22 ${w / 2} 0 t ${w / 2} 0`} fill="none" stroke={SKIN_B} strokeWidth={6} strokeLinecap="round" opacity={0.5} />
    ))}
    {[[300, 1440, 1], [1010, 1450, 0.8]].map(([x, y, s], i) => (
      <g key={i} transform={`translate(${x} ${y}) scale(${s})`}>
        <path d="M -60 0 C -56 -34 -20 -52 14 -44 C 44 -38 62 -18 64 0 Z" fill={G2} />
        <path d="M 14 -44 C 44 -38 62 -18 64 0 L 20 0 C 24 -18 22 -34 14 -44 Z" fill={G1} />
      </g>
    ))}
  </g>
);

const Cloud: React.FC<{ x: number; y: number; s: number }> = ({ x, y, s }) => {
  const shapes = (c: string, dy: number) => (
    <g fill={c} transform={`translate(0 ${dy})`}>
      <rect x={-190} y={-10} width={380} height={80} rx={40} />
      <circle cx={-90} cy={-20} r={62} /><circle cx={10} cy={-48} r={88} /><circle cx={110} cy={-14} r={58} />
    </g>
  );
  return <g transform={`translate(${x} ${y}) scale(${s})`}>{shapes(G3, 16)}{shapes(WHITE, 0)}</g>;
};

/** Vapour dots (small water droplets) drifting in a box. `n` dots, drifting with the loop clock. */
const Vapor: React.FC<{ x: number; y: number; w: number; h: number; n: number; amb: number; o?: number }> = ({ x, y, w, h, n, amb, o = 1 }) => (
  <g opacity={o}>
    {Array.from({ length: n }, (_, i) => {
      const bx = ((i * 137) % 1000) / 1000, by = ((i * 59) % 1000) / 1000, p = [5, 6, 10, 12][i % 4];
      return <circle key={i} cx={x + bx * w + 14 * Math.sin((2 * Math.PI * amb) / p + i)} cy={y + by * h + 10 * Math.cos((2 * Math.PI * amb) / p + i * 2)} r={9 + (i % 3) * 2} fill={STEAM} />;
    })}
  </g>
);

/** A heat arrow that travels: constant length `len`, from y0 up (dir -1) or down (dir 1) over `dist`, looping with `period` seconds; `ph` shifts the phase. */
const Travel: React.FC<{ x: number; y0: number; dist: number; len: number; dir: -1 | 1; clock: number; period: number; ph: number; color: "red" | "yellow"; w?: number; o?: number }> = ({ x, y0, dist, len, dir, clock, period, ph, color, w = 16, o = 1 }) => {
  const p = (((clock / period) + ph) % 1 + 1) % 1, tail = y0 + dir * p * dist, head = tail + dir * len;
  return <g opacity={o * Math.pow(Math.sin(Math.PI * p), 0.6)}><Arrow x={x} y={tail} x2={x} y2={head} color={color} w={w} draw={1} /></g>;
};

const Town: React.FC<{ night: number }> = ({ night }) => {
  const blocks = [{ x: 1660, w: 140, h: 220 }, { x: 1810, w: 170, h: 330 }, { x: 1990, w: 130, h: 180 }, { x: 2130, w: 160, h: 270 }];
  return (
    <g>
      <rect x={1480} y={GROUND - 4} width={1700} height={34} fill={G3} /><rect x={1480} y={GROUND + 30} width={1700} height={40} fill={G2} />
      {blocks.map((b, i) => (
        <g key={i}>
          <rect x={b.x} y={GROUND - b.h} width={b.w} height={b.h} fill={G3} />
          <rect x={b.x + b.w - 30} y={GROUND - b.h} width={30} height={b.h} fill={G2} />
          <rect x={b.x - 8} y={GROUND - b.h - 14} width={b.w + 16} height={16} fill={G2} />
          {Array.from({ length: Math.floor(b.h / 70) }, (_, r) => Array.from({ length: 2 }, (_, c) => (
            <rect key={`${r}-${c}`} x={b.x + 22 + c * 52} y={GROUND - b.h + 24 + r * 66} width={34} height={38} rx={4} fill={night > 0.5 ? WHITE : G4} />
          )))}
        </g>
      ))}
      <rect x={1660} y={GROUND - 8} width={640} height={8} fill={G1} opacity={0.18} />
    </g>
  );
};

/** The sand's day and night curve (the pasir beat): a card in the frame, not in the world. */
const CurveCard: React.FC<{ clock: number }> = ({ clock }) => {
  if (clock < CURVE.a || clock >= CURVE.out + 0.3) return null;
  const p = springAt(clock, CURVE.a) * (1 - clamp01((clock - CURVE.out) / 0.3));
  const f = (x: number) => 1370 - 170 * (smooth01((x - 300) / 100) - smooth01((x - 700) / 100));
  const sweep = clamp01((clock - CURVE.sweep) / 3.6), xe = lerp(170, 910, sweep);
  const pts: string[] = [];
  for (let x = 170; x <= xe; x += 10) pts.push(`${x},${f(x)}`);
  return (
    <g transform={`translate(540 1300) scale(${Math.max(0, p)}) translate(-540 -1300)`}>
      <rect x={110} y={1100} width={860} height={420} rx={40} fill={WHITE} />
      <text x={170} y={1180} fontSize={40} fill={G2} style={{ fontFamily: `"${FONT_MONO}", monospace` }}>suhu pasir</text>
      <rect x={170} y={1380} width={740} height={6} rx={3} fill={G3} />
      {pts.length > 1 && <polyline points={pts.join(" ")} fill="none" stroke={RED} strokeWidth={14} strokeLinecap="round" strokeLinejoin="round" />}
      <circle cx={xe} cy={f(xe)} r={20} fill={RED} />
      <circle cx={540} cy={1428} r={22} fill={YELLOW} />
      <circle cx={210} cy={1428} r={20} fill={G3} /><circle cx={870} cy={1428} r={20} fill={G3} />
      {([[210, "malam"], [540, "siang"], [870, "malam"]] as [number, string][]).map(([x, w]) => <text key={x} x={x} y={1492} textAnchor="middle" fontSize={34} fill={G2} style={{ fontFamily: `"${FONT_MONO}", monospace` }}>{w}</text>)}
    </g>
  );
};

const Jacket: React.FC<{ cx: number; cy: number }> = ({ cx, cy }) => (
  <g transform={`translate(${cx} ${cy})`}>
    <rect x={-58} y={-34} width={26} height={78} rx={13} fill={G1} transform="rotate(14 -45 -20)" />
    <rect x={32} y={-34} width={26} height={78} rx={13} fill={G1} transform="rotate(-14 45 -20)" />
    <rect x={-36} y={-44} width={72} height={96} rx={16} fill={G2} />
    <rect x={8} y={-44} width={28} height={96} rx={14} fill={G1} />
    <rect x={-3} y={-30} width={6} height={80} fill={WHITE} />
    <path d="M -24 -48 L 0 -26 L 24 -48 Z" fill={G1} />
  </g>
);

const JacketCard: React.FC<{ clock: number }> = ({ clock }) => {
  if (clock < JACKET.a || clock >= JACKET.out + 0.3) return null;
  const p = springAt(clock, JACKET.a) * (1 - clamp01((clock - JACKET.out) / 0.3));
  return (
    <g transform={`translate(540 1290) scale(${Math.max(0, p)}) translate(-540 -1290)`}>
      <rect x={110} y={1150} width={860} height={280} rx={40} fill={WHITE} />
      <rect x={110} y={1180} width={12} height={220} rx={6} fill={YELLOW} />
      <circle cx={230} cy={1290} r={74} fill={YELLOW} />
      <Jacket cx={230} cy={1292} />
      <text x={340} y={1272} fontSize={54} fill={BLACK} style={{ fontFamily: `"${FONT_BOLD}", sans-serif`, fontWeight: 700 }}>Bawa jaket tebal</text>
      <text x={340} y={1340} fontSize={38} fill={G2} style={{ fontFamily: `"${FONT_MONO}", monospace` }}>malam gurun dingin</text>
    </g>
  );
};

const World: React.FC<{ clock: number; amb: number }> = ({ clock, amb }) => {
  const d = dayAt(clock), T = tempAt(clock), c = camAt(clock);
  const night = clamp01((d - 0.3) / 0.5), heat = clamp01((T - 0.4) / 0.5);
  const sx = 120 + 330 * d, sy = 640 + 660 * d, mx = 1010, my = 1260 - 640 * d;
  const cloudX = cloudAt(clock);
  const par = `translate(${(c.x - 640) * 0.25} ${(c.y - 1000) * 0.15})`;
  const rays = win(clock, RAYS.a, RAYS.b), rise = win(clock, RISE.a, RISE.b), town = win(clock, TOWN.a, TOWN.b), free = win(clock, FREE.a, FREE.b), bounce = win(clock, BOUNCE.a, BOUNCE.b);
  const x0 = THERMO_X;
  return (
    <g>
      <g transform={par}>
        <Sky d={d} amb={amb} />
        <Sun x={sx} y={sy} amb={amb} />
        <Moon x={mx} y={my} />
        <Dunes layer={FAR} night={night} heat={0} />
      </g>
      <Dunes layer={MID} night={night} heat={heat} />
      <Dunes layer={NEAR} night={night} heat={heat} />
      {heat > 0.05 && [0, 1, 2].map((i) => <path key={i} d={`M ${60 + i * 330} ${1180 - i * 12} q 40 -26 80 0 t 80 0 t 80 0 t 80 0`} fill="none" stroke={HOT2} strokeWidth={8} strokeLinecap="round" opacity={0.7 * heat}
        transform={`translate(${sway(amb + i, 4, 14)} ${-30 - 18 * Math.abs(Math.sin((2 * Math.PI * amb) / 5 + i))})`} />)}
      <Dressing night={night} />
      <Town night={night} />
      <Thermo x={x0} y={1400} s={1.1} T={T} />
      <Mound x={x0} y={1404} s={1.1} />
      <Thermo x={1560} y={GROUND} s={0.55} T={cityTempAt(clock)} />
      <Mound x={1560} y={GROUND + 4} s={0.4} />

      {/* the sun's rays soak into the sand (siang) */}
      {rays > 0 && <g opacity={rays}>
        {[0, 1, 2].map((i) => {
          const tx = 220 + i * 150, ty = yAt(NEAR.pts, tx) - 40, ang = Math.atan2(ty - sy, tx - sx);
          const sxa = sx + Math.cos(ang) * 150, sya = sy + Math.sin(ang) * 150, len = Math.hypot(tx - sxa, ty - sya);
          const p = (((clock / 2) + i / 3) % 1);
          const a = Math.max(0, p * len * 1.2 - 140), b = Math.min(len, p * len * 1.2);
          return <g key={i} opacity={Math.pow(Math.sin(Math.PI * p), 0.5)}><Arrow x={sxa + Math.cos(ang) * a} y={sya + Math.sin(ang) * a} x2={sxa + Math.cos(ang) * Math.max(b, a + 30)} y2={sya + Math.sin(ang) * Math.max(b, a + 30)} color="yellow" w={18} draw={1} /></g>;
        })}
      </g>}

      {/* the heat rises from the sand and leaves (malam), freely under a clear sky (kering) */}
      {(rise > 0 || free > 0) && <g opacity={Math.max(rise, free)}>
        {[0, 1, 2, 3, 4].map((i) => <Travel key={i} x={XS[i]} y0={yAt(NEAR.pts, XS[i]) - 30} dist={1000} len={130} dir={-1} clock={clock} period={4} ph={i / 5} color="red" />)}
      </g>}
      {free > 0 && <Vapor x={720} y={520} w={300} h={380} n={3} amb={amb} o={free} />}

      {/* the humid town: vapour and a cloud send part of the heat back down (lembap) */}
      <g>
        <Vapor x={1580} y={700} w={760} h={330} n={26} amb={amb} o={clamp01((clock - 19.8) / 0.8) * (1 - clamp01((clock - 28.4) / 0.8))} />
        {(clock > 19.5 && clock < 29.2) && <g opacity={clamp01((clock - 19.8) / 0.8) * (1 - clamp01((clock - 28.4) / 0.8))}><Cloud x={1960} y={650} s={1.4} /></g>}
        {town > 0 && <g opacity={town}>
          {[0, 1, 2].map((i) => <Travel key={`u${i}`} x={1700 + i * 190} y0={1000 - i * 20} dist={140} len={110} dir={-1} clock={clock} period={3} ph={i / 3} color="red" />)}
          {[0, 1, 2].map((i) => <Travel key={`d${i}`} x={1760 + i * 190} y0={800} dist={150} len={110} dir={1} clock={clock} period={3} ph={i / 3 + 0.5} color="red" o={0.75} />)}
        </g>}
      </g>

      {/* a cloud drifts over the desert and holds some heat back (fakta) */}
      {cloudX < 2500 && cloudX > -800 && <g opacity={cloudFade(clock)}>
        <Vapor x={cloudX - 220} y={560} w={440} h={340} n={14} amb={amb} />
        <Cloud x={cloudX} y={430} s={1.3} />
        {bounce > 0 && <g opacity={bounce}>
          {[0, 1, 2].map((i) => <Travel key={`bu${i}`} x={cloudX - 190 + i * 190} y0={1290} dist={300} len={130} dir={-1} clock={clock} period={3} ph={i / 3} color="red" />)}
          {[0, 1, 2].map((i) => <Travel key={`bd${i}`} x={cloudX - 140 + i * 190} y0={560} dist={300} len={110} dir={1} clock={clock} period={3} ph={i / 3 + 0.5} color="red" o={0.75} />)}
        </g>}
      </g>}
    </g>
  );
};

const Scene = ({ beat, t, clock, story }: SceneProps) => {
  const amb = loopClock(clock, story.beats.reduce((a, b) => a + b.dur, 0));   // B29: the ambient motion runs on the loop clock
  const c = camAt(clock), sting = beat.kind === "sting", outro = beat.kind === "outro";
  const d = dayAt(clock), n = clamp01((d - 0.4) / 0.25);
  const labels = LABELS.filter((l) => clock >= l.from && clock < l.to + 0.3);
  const tx = `translate(${W / 2} ${H / 2}) scale(${c.z}) translate(${-c.x} ${-c.y})`;
  const top = !sting && !outro;
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
      <g transform={tx}>
        <World clock={clock} amb={amb} />
        {labels.map((l) => <g key={l.text} opacity={1 - clamp01((clock - l.to) / 0.3)}><Label text={l.text} x={l.x} y={l.y} fs={l.fs} t={clock} start={l.from} color={n > 0.5 ? "white" : "black"} lines={l.lines} /></g>)}
      </g>
      <CurveCard clock={clock} />
      <JacketCard clock={clock} />
      {sting && <StingMark slug="kenapa-gurun-lebih-dingin-di-m" pose="topRight" t={t} clock={clock} />}
      {top && <g opacity={1 - n}><TopText key={`a${beat.id}`} kicker={KICKER[beat.id]} headline={beat.text} t={t} /></g>}
      {top && n > 0.01 && <g opacity={n}><TopText key={`b${beat.id}`} kicker={KICKER[beat.id]} headline={beat.text} t={t} onDark /></g>}
      {top && <CaptionLayer beat={beat} t={t} />}
    </svg>
  );
};

export const Video: React.FC<{ story: StoryT; layoutDebug?: boolean }> = (p) => <StoryVideo story={p.story} scene={Scene} layoutDebug={p.layoutDebug} />;
