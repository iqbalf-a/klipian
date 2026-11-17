/* Kenapa jari keriput kalau lama di air? — look 2d (B28): a flat side view of a fingertip cut open, pointing down into a wash basin (set kind "inside-body", see set.json).
   No hand: one finger, drawn in section like a textbook plate, with the real layers (the skin, the layer under it, four of its vessels, a nerve, the bone, the nail on the back
   and no nail on the pad). Two tones per part: a base and a shade moved down-right (light from the top left). One world, one camera (plan.ts camAt); the wrinkle value k
   (plan.ts wrinkle) pulls the pad's skin in at regular valleys (the skin is tied down every ~90 px, so it folds between the ties, which is what a pruney fingertip does) and the
   vessel value v (plan.ts narrow) narrows the vessels under it. A front view of the pad shows the real pattern: grooves that run along the finger, converge to the tip and
   branch in Y shapes, like a river system (Kareklas, Nettle and Smulders 2013), which is what the "alur ban" is. Every word comes from the checked story. */
import React from "react";
import {
  BLACK, CaptionLayer, textWidth, G1, G2, G3, G4, BLUSH, Label, METAL, PLASTER, SKIN_A, SKIN_B, StoryVideo, STEAM, THEMES, TopText, WHITE, YELLOW, YELLOW_D,
  clamp01, springAt, useFonts, loopClock, type SceneProps, type StoryT,
} from "../../src/design/index.ts";
import { COUNTER_X, FX, HW, PAD_X, T, TIP_Y, TOP, WATER_Y, camAt, drained, makePlan, narrow, ramp, scaleTilt, slabX, swell, win, wrinkle } from "./plan.ts";
import storyJson from "./story.json";
import { StingMark } from "../../src/components/StingMark.tsx";

export const story = storyJson as unknown as StoryT;

const W = 1080;
const WALL = THEMES.peach;           // its own backdrop (not the soap bubble video's mint tiles): a plain warm wall with window light, a pale stone counter
const STONE = THEMES.sky;
const SHADE = WALL.floorEdge;                   // the tone a part's shade takes on the wall
const lerp = (a: number, b: number, u: number) => a + (b - a) * u;
const sm = (x: number) => { const k = clamp01(x); return k * k * (3 - 2 * k); };
const ptsAttr = (p: [number, number][]) => p.map((q) => `${q[0].toFixed(1)},${q[1].toFixed(1)}`).join(" ");
const pathOf = (p: [number, number][], close = true) => `M ${p.map((q) => `${q[0].toFixed(1)} ${q[1].toFixed(1)}`).join(" L ")}${close ? " Z" : ""}`;
/** A straight bar from a to b of width w, as a filled quad. */
const bar = (x1: number, y1: number, x2: number, y2: number, w: number): string => {
  const dx = x2 - x1, dy = y2 - y1, l = Math.hypot(dx, dy) || 1, nx = (-dy / l) * w / 2, ny = (dx / l) * w / 2;
  return `M ${x1 + nx} ${y1 + ny} L ${x2 + nx} ${y2 + ny} L ${x2 - nx} ${y2 - ny} L ${x1 - nx} ${y1 - ny} Z`;
};

// ------------------------------------------------------------------------------------------------------ the fingertip's outline (side view)
type Pt = { x: number; y: number; nx: number; ny: number; s: number; seg: "L" | "T1" | "T2" | "R"; u: number; pf: number; mask: number };
const bez = (p0: [number, number], c1: [number, number], c2: [number, number], p3: [number, number], u: number): [number, number] => {
  const k = 1 - u;
  return [k * k * k * p0[0] + 3 * k * k * u * c1[0] + 3 * k * u * u * c2[0] + u * u * u * p3[0], k * k * k * p0[1] + 3 * k * k * u * c1[1] + 3 * k * u * u * c2[1] + u * u * u * p3[1]];
};
/** The closed outline, from the top of the back (left) side, down round the tip, and up the pad (right) side. Wrinkles fold the pad side and the tip, a little the back above the
    nail, and not the skin under the nail. */
const OUTLINE: Pt[] = (() => {
  const raw: { x: number; y: number; seg: Pt["seg"]; u: number }[] = [];
  for (let y = TOP; y < 1250; y += 8) raw.push({ x: FX - HW, y, seg: "L", u: 0 });
  const a0: [number, number] = [FX - HW, 1250], a1: [number, number] = [FX - HW, 1440], a2: [number, number] = [FX - 130, 1560], a3: [number, number] = [FX + 20, 1560];
  for (let i = 0; i < 90; i++) { const u = i / 90, p = bez(a0, a1, a2, a3, u); raw.push({ x: p[0], y: p[1], seg: "T1", u }); }
  const b1: [number, number] = [FX + 170, 1560], b2: [number, number] = [PAD_X + 14, 1440], b3: [number, number] = [PAD_X + 14, 1250];
  for (let i = 0; i < 90; i++) { const u = i / 90, p = bez(a3, b1, b2, b3, u); raw.push({ x: p[0], y: p[1], seg: "T2", u }); }
  for (let y = 1250; y >= TOP; y -= 8) raw.push({ x: PAD_X + 14 * (1 - sm((1250 - y) / 250)), y, seg: "R", u: 0 });
  const n = raw.length;
  const out: Pt[] = [];
  let s = 0;
  raw.forEach((p, i) => {
    const a = raw[Math.max(0, i - 1)], b = raw[Math.min(n - 1, i + 1)];
    let tx = b.x - a.x, ty = b.y - a.y; const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
    if (i > 0) s += Math.hypot(p.x - raw[i - 1].x, p.y - raw[i - 1].y);
    const nx = -ty, ny = tx;
    const pf = Math.max(0, Math.min(1, 0.5 + 0.5 * nx + 0.6 * Math.max(0, ny)));
    let mask = 1;
    if (p.seg === "L") mask = 0.35 * sm((p.y + 200) / 500) * (1 - sm((p.y - 840) / 80));
    else if (p.seg === "T1") mask = Math.pow(sm(p.u), 1.5);
    else if (p.seg === "R") mask = sm((p.y + 200) / 500);
    out.push({ x: p.x, y: p.y, nx, ny, s, seg: p.seg, u: p.u, pf, mask });
  });
  return out;
})();
const LAMBDA = 92;                               // the skin is tied down about every 92 px: the folds between the ties are the wrinkles
const waveOf = (p: Pt) => 0.5 - 0.5 * Math.cos((2 * Math.PI * p.s) / LAMBDA);

/** One layer's boundary: its depth under the surface (d0 on the back, d1 on the pad), how deep the wrinkles dent it (A, times k) and how far the swell pushes it out. */
const layerPts = (d0: number, d1: number, A: number, k: number, grow = 0): [number, number][] =>
  OUTLINE.map((p) => { const d = lerp(d0, d1, p.pf) - grow + A * k * p.mask * waveOf(p); return [p.x - p.nx * d, p.y - p.ny * d]; });
/** A line that follows the surface at a depth, for the vessels: from a y on the pad side, round the tip, to the point `until` on the way back up the back. */
const trackPts = (d0: number, d1: number, A: number, k: number): [number, number][] =>
  OUTLINE.filter((p) => p.seg === "R" || p.seg === "T2" || (p.seg === "T1" && p.u > 0.45)).filter((p) => !(p.seg === "R" && p.y < 20))
    .map((p) => { const d = lerp(d0, d1, p.pf) + A * k * p.mask * waveOf(p); return [p.x - p.nx * d, p.y - p.ny * d]; });

const polyLen = (poly: [number, number][]) => poly.reduce((a, q, i) => (i ? a + Math.hypot(q[0] - poly[i - 1][0], q[1] - poly[i - 1][1]) : 0), 0);
const along = (poly: [number, number][], s: number): [number, number] => {
  let rest = Math.max(0, s);
  for (let i = 1; i < poly.length; i++) {
    const l = Math.hypot(poly[i][0] - poly[i - 1][0], poly[i][1] - poly[i - 1][1]);
    if (rest <= l) { const u = l ? rest / l : 0; return [lerp(poly[i - 1][0], poly[i][0], u), lerp(poly[i - 1][1], poly[i][1], u)]; }
    rest -= l;
  }
  return poly[poly.length - 1];
};

// ------------------------------------------------------------------------------------------------------ the set
const Wall: React.FC<{ amb: number }> = ({ amb }) => (
  <g>
    <rect x={-2600} y={-2600} width={6400} height={6200} fill={WALL.wall} />
    {/* window light falling across the wall: three slanting bands that drift a little */}
    {[0, 1, 2].map((i) => <polygon key={i} points={`${-300 + i * 520 + 18 * Math.sin(amb * 0.8 + i)},-2600 ${100 + i * 520 + 18 * Math.sin(amb * 0.8 + i)},-2600 ${1500 + i * 520},1200 ${1100 + i * 520},1200`} fill={WHITE} opacity={0.32} />)}
    <rect x={-2600} y={WATER_Y - 70} width={6400} height={70} fill={WALL.ring} opacity={0.7} />
  </g>
);

/** Dressing on the wall at the right, cut by the frame: a towel rail with a towel (it is only seen in the wide shot and beside the balance). */
const Towel: React.FC<{ amb: number }> = ({ amb }) => (
  <g>
    <rect x={1332} y={410} width={260} height={22} rx={11} fill={G3} /><rect x={1332} y={404} width={260} height={22} rx={11} fill={METAL} />
    <path d="M 1362 424 L 1572 424 L 1572 850 C 1530 880 1480 830 1440 862 C 1400 890 1380 850 1362 860 Z" fill={SHADE} transform="translate(10 10)" />
    <path d="M 1362 424 L 1572 424 L 1572 850 C 1530 880 1480 830 1440 862 C 1400 890 1380 850 1362 860 Z" fill={STEAM} />
    <rect x={1362} y={740} width={210} height={26} fill={WHITE} opacity={0.85} /><rect x={1362} y={790} width={210} height={14} fill={WHITE} opacity={0.85} />
  </g>
);

/** The counter: its top at the water's level, its left face the basin's wall (the water is on the left). Bleeds right and down. */
const Counter: React.FC = () => (
  <g>
    <rect x={COUNTER_X + 14} y={WATER_Y + 16} width={2600} height={2400} fill={SHADE} />
    <rect x={COUNTER_X} y={WATER_Y} width={2600} height={2400} fill={STONE.floor} />
    <rect x={COUNTER_X} y={WATER_Y} width={2600} height={40} fill={G4} />
    <rect x={COUNTER_X} y={WATER_Y + 40} width={26} height={2400} fill={STONE.floorEdge} />
    {Array.from({ length: 6 }, (_, i) => <rect key={i} x={COUNTER_X + 160 + i * 380} y={WATER_Y + 260} width={14} height={900} fill={STONE.floorEdge} opacity={0.6} />)}
  </g>
);

const waterTop = (amb: number): [number, number][] => {
  const p: [number, number][] = [];
  for (let x = -2600; x <= COUNTER_X; x += 40) p.push([x, WATER_Y + 5 * Math.sin(x * 0.018 + amb * 2.2)]);
  return p;
};
/** The basin's water: drawn over the finger so the tip shows through it; ripples where the finger goes in, bubbles rising along it. */
const Water: React.FC<{ amb: number; k: number }> = ({ amb, k }) => {
  const top = waterTop(amb);
  const body: [number, number][] = [...top, [COUNTER_X, 3400], [-2600, 3400]];
  const lit: [number, number][] = [...top, ...[...top].reverse().map(([x, y]) => [x, y + 16] as [number, number])];
  return (
    <g>
      <polygon points={ptsAttr(body)} fill={STEAM} opacity={0.6} />
      <polygon points={ptsAttr(lit)} fill={WHITE} opacity={0.5} />
      {[0, 1].map((i) => { const ph = ((amb * 0.35 + i * 0.5) % 1); return <ellipse key={i} cx={FX + 10} cy={WATER_Y + 4} rx={HW + 20 + ph * 200} ry={8 + ph * 8} fill={WHITE} opacity={0.5 * (1 - ph)} />; })}
      {Array.from({ length: 7 }, (_, i) => {
        const ph = ((amb * 0.22 + i * 0.143) % 1), x = FX - HW - 50 + ((i * 163) % 640) + 16 * Math.sin(amb * 2 + i * 1.7), y = TIP_Y + 140 - ph * (TIP_Y + 140 - WATER_Y - 20);
        return <circle key={i} cx={x} cy={y} r={7 + (i % 3) * 4} fill={WHITE} opacity={0.75 * Math.sin(Math.PI * ph)} />;
      })}
    </g>
  );
};

// ------------------------------------------------------------------------------------------------------ the fingertip
const NERVE_X = FX + 98;
const nerveTrunk: [number, number][] = [[NERVE_X, 0], [NERVE_X, 1130]];
const branchEnds = [0.9, 0.55, 0.2].map((u) => { const p = OUTLINE.find((q) => q.seg === "T2" && q.u >= u)!; return [p.x - p.nx * 96, p.y - p.ny * 96] as [number, number]; });
const nerveBranch = (i: number): [number, number][] => {
  const e = branchEnds[i], pts: [number, number][] = [];
  for (let k = 0; k <= 16; k++) { const u = k / 16, kk = 1 - u, c: [number, number] = [NERVE_X, e[1]]; pts.push([kk * kk * NERVE_X + 2 * kk * u * c[0] + u * u * e[0], kk * kk * 1130 + 2 * kk * u * c[1] + u * u * e[1]]); }
  return pts;
};
const BRANCHES = [0, 1, 2].map(nerveBranch);
const SIGNAL_PATHS = BRANCHES.map((b) => [...nerveTrunk, ...b]);

const NAIL_IDX = OUTLINE.map((p, i) => ({ p, i })).filter(({ p }) => p.y >= 880 && (p.seg === "L" || (p.seg === "T1" && p.u < 0.5)));
const HAIRS = Array.from({ length: 8 }, (_, i) => { const y = 300 + i * 68, p = OUTLINE.find((q) => q.seg === "L" && q.y >= y)!; return { p, i }; });

const Finger: React.FC<{ clock: number; amb: number }> = ({ clock, amb }) => {
  const k = wrinkle(clock), v = narrow(clock), sw = swell(clock);
  const l0 = layerPts(0, 0, 26, k, 14 * sw), l1 = layerPts(14, 40, 18, k, 12 * sw), l2 = layerPts(66, 128, 6, k, 6 * sw);
  const nerveA = win(clock, T.nerveOn, T.nerveOff, 0.5), vesA = win(clock, T.vesselOn, T.vesselOff, 0.5);
  // the bone, the distal phalanx: a shaft that widens into the tuft just under the tip's pulp
  const bone = `M ${FX - 75} ${TOP} L ${FX - 75} 1080 C ${FX - 100} 1130 ${FX - 112} 1190 ${FX - 82} 1222 Q ${FX - 10} 1256 ${FX + 56} 1222 C ${FX + 88} 1190 ${FX + 78} 1130 ${FX + 65} 1080 L ${FX + 65} ${TOP} Z`;
  const vw = 30 * (1 - 0.62 * v);
  const t1 = trackPts(60, 96, 8, k), t2 = trackPts(92, 118, 4, k);
  const flowing = (poly: [number, number][], off: number) => Array.from({ length: 6 }, (_, j) => { const L = polyLen(poly), s = ((amb * 240 + j * (L / 6) + off) % L); return along(poly, s); });
  const nailTaper = (i: number) => Math.pow(Math.sin(Math.PI * clamp01(i / (NAIL_IDX.length - 1))), 0.6);
  const nailOuter: [number, number][] = NAIL_IDX.map(({ p }, i) => [p.x + p.nx * 34 * nailTaper(i), p.y + p.ny * 34 * nailTaper(i)]);
  const nailInner: [number, number][] = [...NAIL_IDX].reverse().map(({ p }) => [p.x - p.nx * 1, p.y - p.ny * 1]);
  const nail = [...nailOuter, ...nailInner];
  const sigs: { p: [number, number]; o: number }[] = [];
  for (let j = 0; j < 10; j++) {
    const ts = T.signalA + j * 0.85, pr = (clock - ts) / 2.4;
    if (pr >= 0 && pr < 1 && ts < T.signalEnd) { const path = SIGNAL_PATHS[j % 3]; sigs.push({ p: along(path, polyLen(path) * pr), o: Math.sin(Math.PI * clamp01(pr)) * 1.2 }); }
  }
  const pulse = clamp01((clock - T.pulse) / 0.9);
  return (
    <g>
      <polygon points={ptsAttr(l0)} fill={SHADE} transform="translate(12 14)" />
      <polygon points={ptsAttr(l0)} fill={SKIN_B} />
      {/* the nail plate on the back of the finger, none on the pad */}
      <polygon points={ptsAttr(nail)} fill={G4} transform="translate(5 7)" />
      <polygon points={ptsAttr(nail)} fill={WHITE} />
      <polygon points={ptsAttr(l1)} fill={SKIN_A} />
      <polygon points={ptsAttr(l2)} fill={PLASTER} />
      <path d={bone} fill={G3} transform="translate(7 9)" />
      <path d={bone} fill={WHITE} />
      <rect x={FX - 30} y={TOP} width={52} height={1060} rx={20} fill={G4} />
      {/* the nerve and the signal that runs along it */}
      {nerveA > 0.01 && <g opacity={nerveA}>
        <path d={pathOf(nerveTrunk, false)} stroke={YELLOW_D} strokeWidth={14} strokeLinecap="round" fill="none" />
        {BRANCHES.map((b, i) => <path key={i} d={pathOf(b, false)} stroke={YELLOW_D} strokeWidth={11} strokeLinecap="round" fill="none" />)}
        {sigs.map((s, i) => <circle key={i} cx={s.p[0]} cy={s.p[1]} r={15} fill={YELLOW} opacity={Math.min(1, s.o)} />)}
        {pulse > 0 && pulse < 1 && branchEnds.map((e, i) => <circle key={i} cx={e[0]} cy={e[1]} r={20 + 70 * pulse} fill={YELLOW} opacity={0.7 * (1 - pulse)} />)}
      </g>}
      {/* the vessels under the pad's skin: they narrow; blood dots keep flowing */}
      {vesA > 0.01 && <g opacity={vesA}>
        <path d={pathOf(t2, false)} stroke={BLUSH} strokeWidth={vw * 0.8} strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <path d={pathOf(t1, false)} stroke={BLUSH} strokeWidth={vw} strokeLinecap="round" strokeLinejoin="round" fill="none" />
        {flowing(t1, 0).map((q, i) => <circle key={`a${i}`} cx={q[0]} cy={q[1]} r={0.22 * vw} fill={WHITE} />)}
        {flowing(t2, 90).map((q, i) => <circle key={`b${i}`} cx={q[0]} cy={q[1]} r={0.2 * vw * 0.8} fill={WHITE} />)}
        {/* the water between the cells: it goes as the vessels narrow */}
        {Array.from({ length: 12 }, (_, i) => { const p = OUTLINE.filter((q) => q.seg === "R" && q.y > 200 && q.y < 1250)[(i * 9) % 120], d = 84 + (i % 3) * 5; return p ? <circle key={i} cx={p.x - p.nx * d} cy={p.y - p.ny * d + 8 * Math.sin(amb * 2 + i)} r={9} fill={STEAM} opacity={(1 - v) * 0.9} /> : null; })}
      </g>}
      {/* hairs and their oil on the back of the finger: none on the pad */}
      {HAIRS.map(({ p, i }) => {
        const g = ramp(clock, T.hairOn + i * 0.14, T.hairOn + i * 0.14 + 0.5) * (1 - ramp(clock, T.hairOff, T.hairOff + 1.0));
        if (g < 0.02) return null;
        const sway = 0.12 * Math.sin(amb * 1.6 + i), len = 64 * g, ca = Math.cos(sway), sa = Math.sin(sway);
        const dx = (-0.7 * ca - 0.7 * sa), dy = (0.7 * ca - 0.7 * sa);          // out of the back and down, swaying
        const ex = p.x + dx * len, ey = p.y + dy * len, mx = p.x + dx * len * 0.5 - dy * 6, my = p.y + dy * len * 0.5 + dx * 6;
        return (
          <g key={i}>
            <path d={`M ${p.x + 2} ${p.y - 5} Q ${mx} ${my - 4} ${ex} ${ey} Q ${mx + 3} ${my + 7} ${p.x + 2} ${p.y + 5} Z`} fill={G1} />
            <circle cx={p.x + 4} cy={p.y + 14 * g} r={8 * g} fill={WHITE} />
          </g>
        );
      })}
    </g>
  );
};

/** The grooves of the pad in a front view: a skin plate, grooves that run along the finger and converge to the tip, with Y branches. k = how wrinkled. */
const GROOVES = (() => {
  const us = [-0.85, -0.57, -0.28, 0, 0.28, 0.57, 0.85];
  const mk = (u: number, y0: number, y1: number, ph: number, X: (u: number, s: number) => number) => {
    const pts: [number, number][] = [];
    for (let i = 0; i <= 20; i++) { const s = i / 20; pts.push([X(u, s) + 3.5 * Math.sin(s * 7 + ph), y0 + (y1 - y0) * s]); }
    return pts;
  };
  const X = (u: number, s: number) => u * 112 * (1 - 0.34 * s * s);
  const main = us.map((u, i) => mk(u, -236, 20 + Math.sqrt(Math.max(0.05, 1 - u * u)) * 128 - 18 - 14 * Math.abs(u), i * 1.3, X));
  const branches = [[1, 0.5, -1], [5, 0.5, 1], [3, 0.42, -1], [3, 0.6, 1]].map(([i, s0, dir], j) => {
    const base = main[i], a = base[Math.round(s0 * 20)], tgt = us[i] + 0.28 * dir, end: [number, number] = [X(tgt, 0.85), base[20][1] - 6];
    const pts: [number, number][] = [];
    for (let q = 0; q <= 10; q++) { const u = q / 10; pts.push([lerp(a[0], end[0], u * u * (3 - 2 * u)) + 4 * Math.sin(u * 5 + j), lerp(a[1], end[1], u)]); }
    return pts;
  });
  return [...main, ...branches];
})();
const grooveShape = (pts: [number, number][], w: number, k: number): string => {
  const L: [number, number][] = [], R: [number, number][] = [];
  pts.forEach((p, i) => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)], tx = b[0] - a[0], ty = b[1] - a[1], l = Math.hypot(tx, ty) || 1;
    const s = i / (pts.length - 1), th = (w * k * Math.pow(Math.sin(Math.PI * s), 0.55)) / 2;
    L.push([p[0] - (ty / l) * th, p[1] + (tx / l) * th]); R.push([p[0] + (ty / l) * th, p[1] - (tx / l) * th]);
  });
  return pathOf([...L, ...R.reverse()]);
};
const FrontPad: React.FC<{ k: number }> = ({ k }) => {
  const skin = `M -118 -280 L -118 20 C -118 110 -66 152 0 152 C 66 152 118 110 118 20 L 118 -280 Z`;
  return (
    <g>
      <path d={skin} fill={SKIN_B} transform="translate(10 12)" />
      <path d={skin} fill={SKIN_A} />
      {k > 0.02 && GROOVES.map((g, i) => <path key={i} d={grooveShape(g, 20, k)} fill={SKIN_B} />)}
      {k > 0.02 && GROOVES.slice(0, 7).map((g, i) => <path key={`h${i}`} d={grooveShape(g.map((p) => [p[0] - 5, p[1] - 3] as [number, number]), 6, k)} fill={WHITE} opacity={0.55} />)}
    </g>
  );
};
/** The round window with the front view of the pad. */
const Inset: React.FC<{ clock: number; k: number }> = ({ clock, k }) => {
  const p = springAt(clock, T.insetOn) * (1 - ramp(clock, T.insetOff, T.insetOff + 0.4));
  if (p <= 0.01) return null;
  const cx = 1000, cy = 580, R = 180;
  return (
    <g transform={`translate(${cx} ${cy}) scale(${Math.max(0.001, p)}) translate(${-cx} ${-cy})`}>
      <circle cx={cx + 10} cy={cy + 12} r={R + 16} fill={SHADE} />
      <circle cx={cx} cy={cy} r={R + 16} fill={WHITE} />
      <clipPath id="front-clip"><circle cx={cx} cy={cy} r={R} /></clipPath>
      <g clipPath="url(#front-clip)">
        <rect x={cx - R} y={cy - R} width={R * 2} height={R * 2} fill={G4} />
        <g transform={`translate(${cx} ${cy - 40}) scale(0.92)`}><FrontPad k={k} /></g>
      </g>
    </g>
  );
};

// ------------------------------------------------------------------------------------------------------ the wet slab, the old idea's drops, the balance
const SLAB_TOP = 640;
const Slab: React.FC<{ clock: number; amb: number }> = ({ clock, amb }) => {
  const x = slabX(clock), dr = drained(clock), wet = ramp(clock, T.touch - 0.4, T.touch);
  // the water that sits in the grooves of the pad, between the pad's skin and the slab: it is pushed out and runs down the film
  const k = wrinkle(clock);
  const pad = OUTLINE.filter((p) => p.seg === "R" && p.y >= SLAB_TOP && p.y <= WATER_Y);
  const vall: [number, number][] = pad.map((p) => [p.x - p.nx * (26 * k * p.mask * waveOf(p) + 1), p.y]);
  const water = pathOf([[PAD_X, SLAB_TOP], ...vall, [PAD_X, WATER_Y]]);
  const drips = Array.from({ length: 6 }, (_, j) => {
    const ts = T.drainA + j * 0.8, q = (clock - ts) / 1.1;
    return q > 0 && q < 1 && ts < T.drainEnd ? { x: x - 7, y: lerp(SLAB_TOP + 40 + j * 40, WATER_Y - 6, q * q), r: 10 * (1 - 0.3 * q) } : null;
  }).filter(Boolean) as { x: number; y: number; r: number }[];
  return (
    <g>
      {k > 0.05 && wet > 0.01 && <path d={water} fill={STEAM} opacity={(1 - dr) * wet * 0.95} />}
      <rect x={x + 12} y={SLAB_TOP + 14} width={170} height={WATER_Y - SLAB_TOP} rx={22} fill={SHADE} />
      <rect x={x} y={SLAB_TOP} width={170} height={WATER_Y - SLAB_TOP} rx={22} fill={METAL} />
      <rect x={x + 120} y={SLAB_TOP} width={50} height={WATER_Y - SLAB_TOP} rx={22} fill={G3} opacity={0.8} />
      <rect x={x + 26} y={SLAB_TOP + 30} width={14} height={300} rx={7} fill={WHITE} opacity={0.8} />
      {/* the water film that wets the slab's face */}
      <rect x={x - 14} y={SLAB_TOP + 8} width={14} height={WATER_Y - SLAB_TOP - 8} fill={STEAM} opacity={0.95} />
      {drips.map((d, i) => <circle key={i} cx={d.x} cy={d.y} r={d.r} fill={STEAM} />)}
    </g>
  );
};

/** The old idea in a picture: drops fly to the pad and soak in, and the finger swells a little. */
const Drops: React.FC<{ clock: number }> = ({ clock }) => {
  const ts = [T.drop1, T.drop2, T.drop3, T.drop4], ys = [640, 720, 800, 880];
  return (
    <g>
      {ts.map((t0, i) => {
        const q = (clock - t0) / 0.9;
        if (q <= 0 || q > 1.5) return null;
        const e = clamp01(q), x = lerp(930, PAD_X + 6, e), y = ys[i] + 170 * e * e - 80 * (1 - e), r = 18 * (1 - 0.8 * sm((q - 0.9) / 0.1));
        const rip = clamp01((q - 0.95) / 0.55);
        return (
          <g key={i}>
            {q < 1 && <g><circle cx={x} cy={y} r={r} fill={STEAM} /><circle cx={x - r * 0.3} cy={y - r * 0.3} r={r * 0.28} fill={WHITE} /></g>}
            {rip > 0 && rip < 1 && <ellipse cx={PAD_X + 4} cy={ys[i] + 90} rx={8 + 26 * rip} ry={20 + 50 * rip} fill={WHITE} opacity={0.6 * (1 - rip)} />}
          </g>
        );
      })}
    </g>
  );
};

const Balance: React.FC<{ clock: number }> = ({ clock }) => {
  const p = springAt(clock, T.scaleIn) * (1 - ramp(clock, T.scaleOut, T.scaleOut + 0.5));
  if (p <= 0.01) return null;
  const cx = 1120, cy = 840, th = scaleTilt(clock), a = (th * Math.PI) / 180, L = 190;
  const lx = cx - L * Math.cos(a), ly = cy - L * Math.sin(a), rx = cx + L * Math.cos(a), ry = cy + L * Math.sin(a);
  const Pan: React.FC<{ x: number; y: number }> = ({ x, y }) => (
    <g>
      <path d={bar(x, y - 120, x - 70, y, 6)} fill={G2} /><path d={bar(x, y - 120, x + 70, y, 6)} fill={G2} />
      <path d={`M ${x - 86} ${y} L ${x + 86} ${y} C ${x + 70} ${y + 40} ${x - 70} ${y + 40} ${x - 86} ${y} Z`} fill={G3} transform="translate(5 7)" />
      <path d={`M ${x - 86} ${y} L ${x + 86} ${y} C ${x + 70} ${y + 40} ${x - 70} ${y + 40} ${x - 86} ${y} Z`} fill={METAL} />
    </g>
  );
  return (
    <g transform={`translate(${cx} ${WATER_Y}) scale(${Math.max(0.001, p)}) translate(${-cx} ${-WATER_Y})`}>
      <rect x={cx - 150 + 8} y={WATER_Y - 44 + 8} width={300} height={44} rx={10} fill={SHADE} /><rect x={cx - 150} y={WATER_Y - 44} width={300} height={44} rx={10} fill={SKIN_A} />
      <rect x={cx - 15 + 7} y={cy} width={30} height={WATER_Y - 44 - cy} fill={G3} /><rect x={cx - 15} y={cy} width={30} height={WATER_Y - 44 - cy} fill={METAL} />
      <path d={bar(lx, ly, rx, ry, 20)} fill={G3} transform="translate(5 6)" /><path d={bar(lx, ly, rx, ry, 20)} fill={G2} />
      <circle cx={cx} cy={cy} r={24} fill={YELLOW} />
      <Pan x={lx} y={ly + 130} /><Pan x={rx} y={ry + 130} />
    </g>
  );
};

// ------------------------------------------------------------------------------------------------------ the world and the scene
const World: React.FC<{ clock: number; amb: number }> = ({ clock, amb }) => {
  const k = wrinkle(clock);
  return (
    <g>
      <Wall amb={amb} />
      <Counter />
      <Towel amb={amb} />
      <Finger clock={clock} amb={amb} />
      <Water amb={amb} k={k} />
      <Drops clock={clock} />
      <Slab clock={clock} amb={amb} />
      <Balance clock={clock} />
      <Inset clock={clock} k={k} />
    </g>
  );
};

const Scene = ({ beat, t, clock }: SceneProps) => {
  useFonts();
  const P_ = React.useMemo(() => makePlan(story), []);
  const amb = loopClock(clock, story.beats.reduce((a, b) => a + b.dur, 0));   // B29: the ambient motion runs on the loop clock
  const c = camAt(clock), sting = beat.kind === "sting", outro = beat.kind === "outro";
  const top = P_.tops.find((x) => clock >= x.a && clock < x.b);
  const tx = `translate(${W / 2} 960) scale(${c.z}) translate(${-c.x} ${-c.y})`;
  const toScr = (x: number, y: number): [number, number] => [W / 2 + (x - c.x) * c.z, 960 + (y - c.y) * c.z];
  const stingP = sting ? springAt(t, 0) * (1 - ramp(t, 0.8, 1.0)) : 0;
  return (
    <svg width={W} height={1920} viewBox="0 0 1080 1920">
      <g transform={tx}><World clock={clock} amb={amb} /></g>
      {/* labels: short pointers from the text to the part */}
      {!sting && !outro && P_.labels.filter((l) => clock >= l.from - 0.05 && clock < l.to + 0.3).map((l) => {
        const a = toScr(l.ax, l.ay), p = clamp01((clock - l.from) / 0.3) * (1 - clamp01((clock - l.to) / 0.3));
        if (p <= 0) return null;
        const rows = 1 + (l.lines?.length ?? 0), fs = 44;
        const wide = Math.max(textWidth(l.text, fs), ...(l.lines ?? []).map((r) => textWidth(r, fs))) / 2 + 14, bottom = l.ly + (rows - 1) * fs * 1.22 + 14, topY = l.ly - fs * 0.8;
        // the leader leaves the text from the side that faces the part, never through the words
        const sx = a[0] > l.lx + wide ? l.lx + wide : a[0] < l.lx - wide ? l.lx - wide : l.lx;
        const sy = sx === l.lx ? (a[1] > bottom ? bottom : topY) : l.ly - fs * 0.3 + ((rows - 1) * fs * 1.22) / 2;
        return (
          <g key={l.id} opacity={p}>
            <line x1={sx} y1={sy} x2={a[0]} y2={a[1]} stroke={BLACK} strokeWidth={5} strokeLinecap="round" opacity={0.85} />
            <circle cx={a[0]} cy={a[1]} r={9} fill={BLACK} />
            <Label text={l.text} lines={l.lines} x={l.lx} y={l.ly} fs={44} t={clock} start={l.from} />
          </g>
        );
      })}
      {top && <TopText key={`${top.a}`} kicker={top.kicker} headline={top.headline} t={clock - top.a} />}
      {!sting && !outro && <CaptionLayer beat={beat} t={t} />}
      {stingP > 0.001 && <g><StingMark slug="kenapa-jari-keriput-kalau-lama" t={t} clock={clock} p={stingP} p2={stingP} /></g>}
    </svg>
  );
};

export const Video: React.FC<{ story: StoryT; layoutDebug?: boolean }> = (p) => <StoryVideo story={p.story} scene={Scene} layoutDebug={p.layoutDebug} />;
