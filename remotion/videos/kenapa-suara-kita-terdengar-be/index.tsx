/* Kenapa suara kita terdengar beda di rekaman? — one home-studio set (set kind "home-studio"): a back wall with acoustic foam panels, a desk, a standing
   microphone and a small recorder, and one hero: a head in profile (an extruded outline from the iso kit). Real shapes checked (Wikipedia, "Sound",
   "Bone conduction"): sound is a longitudinal pressure wave, so it leaves the mouth as arcs that spread out in every direction, not as a straight beam;
   the skull carries low frequencies better than air does; a microphone takes only the air path. One continuous camera (plan.ts CAM); the first frame is
   the last (the loop): every moving thing has a period that divides 60 s. */
import React from "react";
import {
  BLACK, CaptionLayer, IsoCup, Label, Mascot, StoryVideo, TopText, YELLOW, YELLOW_D, block, cam2At, circlePts, clamp01, cylinder, easeInOut, extrudeAnyXZ,
  isoAt, layerTransform, planeXZ, ptsAttr, smoothPath, springAt, textWidth, useFonts, type P2, type P3, type Poly, type SceneProps, type StoryT,
} from "../../src/design/index.ts";
import { G1, G2, G3, G4, ISO, SKIN_A, SKIN_B, WHITE } from "../../src/tokens.ts";
import { mixRgb } from "../../src/natureGeometry.ts";
import { CAM, T } from "./plan.ts";
import storyJson from "./story.json";

export const story = storyJson as unknown as StoryT;

const U = 100, O: P2 = [540, 1150];
const P = (p: P3): P2 => isoAt(p, U, O);
const on = (c: number, a: number, b = 1e9) => clamp01((c - a) / 0.35) * (1 - clamp01((c - b) / 0.35));
const bold = { fontFamily: '"Outfit", sans-serif', fontWeight: 700 } as const;
const polys = (ps: Poly[], tones: readonly string[], stroke = G1, sw = 2.5, op = 1) => ps.map((p, i) => <polygon key={i} points={ptsAttr(p.pts)} fill={tones[p.tone]} stroke={stroke} strokeWidth={sw} strokeLinejoin="round" opacity={op} />);
const blk = (a: P3, b: P3) => block(a, b, U, O);

const SKIN = [SKIN_A, mixRgb(SKIN_A, SKIN_B, 0.5), SKIN_B], HAIR = [G2, G1, G1], SHIRT = ISO.labPlastic, BONE = WHITE;
const FOAM = [G4, G3, mixRgb(G3, G2, 0.5)];
const CZ = 4.5;                                                       // the head's centre height (the torso ends at 2.7, the neck at 3.4)
/** The head in profile, facing +x (units; x forward, z up from the centre): back of the head, crown, forehead, nose, lips, chin, jaw. */
const HEAD_REL: P2[] = [[-1.1, 0.1], [-1.0, 0.8], [-0.5, 1.2], [0.2, 1.27], [0.8, 1.0], [1.05, 0.5], [1.2, 0.1], [1.38, -0.15], [1.12, -0.3], [1.14, -0.5], [1.1, -0.66], [1.0, -0.8], [0.98, -1.1], [0.6, -1.25], [0, -1.1], [-0.5, -0.8], [-0.95, -0.4]];
const HEAD: P2[] = HEAD_REL.map(([x, z]) => [x, CZ + z]);
const HAIR_PTS: P2[] = [[-1.12, CZ + 0.1], [-1.02, CZ + 0.85], [-0.5, CZ + 1.28], [0.2, CZ + 1.34], [0.85, CZ + 1.04], [0.97, CZ + 0.72], [0.4, CZ + 0.78], [-0.2, CZ + 0.55], [-0.7, CZ + 0.2]];
const EAR = { x: -0.1, z: CZ - 0.1 }, MOUTH = { x: 1.1, z: CZ - 0.58 }, MIC = { x: 3.4, z: 4.0 };
const FACE_Y = 0.58;                                                  // the side of the head that looks at the camera
const S = (x: number, z: number, y = FACE_Y): P2 => P([x, y, z]);

/** A point at fraction f (0 to 1) along a polyline of screen points, and the unit normal there. */
const along = (pts: readonly P2[], f: number): { p: P2; n: P2 } => {
  const lens = pts.slice(1).map((p, i) => Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1])), tot = lens.reduce((a, b) => a + b, 0);
  let d = Math.max(0, Math.min(1, f)) * tot, i = 0;
  while (i < lens.length - 1 && d > lens[i]) { d -= lens[i]; i++; }
  const k = lens[i] ? d / lens[i] : 0, a = pts[i], b = pts[i + 1], l = lens[i] || 1;
  return { p: [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k], n: [-(b[1] - a[1]) / l, (b[0] - a[0]) / l] };
};
/** A wavy line along a path: `amp` px and `len` px per wave, moving with `ph`. Low notes are long and tall waves, high notes short and small ones. */
const wavy = (pts: readonly P2[], amp: number, len: number, ph: number, k = 1): string => {
  const tot = pts.slice(1).reduce((a, p, i) => a + Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]), 0), n = Math.max(8, Math.round(tot / 10));
  const out: P2[] = [];
  for (let i = 0; i <= Math.round(n * k); i++) { const f = i / n, { p, n: nn } = along(pts, f), w = amp * Math.sin((f * tot) / len * Math.PI * 2 - ph); out.push([p[0] + nn[0] * w, p[1] + nn[1] * w]); }
  return out.length > 1 ? smoothPath(out) : "";
};

const AIR_PATH: P2[] = [[1.28, 3.92], [0.85, 3.78], [0.4, 3.92], [0.08, 4.22], [-0.1, 4.4]].map(([x, z]) => P([x, 0.78, z]));
const BONE_PATH: P2[] = [[0.38, 3.05], [0.3, 3.55], [0.08, 4.0], [-0.08, 4.4]].map(([x, z]) => S(x, z, 0.6));
const PLAY_PATH: P2[] = ([[5.0, 0.8, 2.1], [3.4, 1.0, 3.0], [1.9, 0.92, 3.7], [1.28, 0.78, 3.92], [0.85, 0.78, 3.78], [0.4, 0.78, 3.92], [0.08, 0.78, 4.22], [-0.1, 0.62, 4.4]] as P3[]).map(P);

const Dots: React.FC<{ path: readonly P2[]; c: number; k: number; color: string; n?: number; speed?: number; r?: number }> = ({ path, c, k, color, n = 5, speed = 0.4, r = 11 }) => {
  if (k <= 0.02) return null;
  return <g opacity={k}>{Array.from({ length: n }, (_, i) => { const f = (c * speed + i / n) % 1, { p } = along(path, f); return <circle key={i} cx={p[0]} cy={p[1]} r={r * (0.7 + 0.5 * Math.sin(f * Math.PI))} fill={color} stroke={BLACK} strokeWidth={3} />; })}</g>;
};
const Trail: React.FC<{ path: readonly P2[]; k: number; color: string; w?: number; dash?: string; off?: number }> = ({ path, k, color, w = 8, dash, off = 0 }) => {
  if (k <= 0.02) return null;
  const d = smoothPath(path as P2[]);
  return <g opacity={k}><path d={d} fill="none" stroke={BLACK} strokeWidth={w + 6} strokeLinecap="round" opacity={0.9} /><path d={d} fill="none" stroke={color} strokeWidth={w} strokeLinecap="round" strokeDasharray={dash} strokeDashoffset={off} /></g>;
};

/** Sound leaves the mouth as a pressure wave that spreads out: arcs round the mouth, in the profile plane, growing and fading (period 1.5 s, 40 times in 60 s). */
const MouthArcs: React.FC<{ c: number; k: number; strong: number }> = ({ c, k, strong }) => {
  if (k <= 0.02) return null;
  return <g opacity={k}>{[0, 1, 2].map((i) => {
    const ph = (c / 1.5 + i / 3) % 1, r = 0.35 + ph * 2.5, a0 = 0.6 * (1 - 0.4 * strong);
    const pts = Array.from({ length: 11 }, (_, j) => { const a = -a0 + (2 * a0 * j) / 10; return S(MOUTH.x + r * Math.cos(a), MOUTH.z + r * Math.sin(a) * 1.0, 0.0); });
    return <path key={i} d={smoothPath(pts)} fill="none" stroke={G1} strokeWidth={7 + 3 * strong} strokeLinecap="round" opacity={(1 - ph) * (0.8 + 0.2 * strong)} />;
  })}</g>;
};

const Floor: React.FC = () => (
  <g>
    <rect x={-4000} y={-3000} width={9000} height={8000} fill={ISO.wall[0]} />
    <polygon points={ptsAttr([P([-60, -3, 0]), P([60, -3, 0]), P([60, 40, 0]), P([-60, 40, 0])])} fill={ISO.floor[0]} />
    {Array.from({ length: 30 }, (_, i) => { const k = -3 + i * 1.6, a = P([-60, k, 0]), b = P([60, k, 0]); return <line key={i} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={ISO.floor[1]} strokeWidth={3} opacity={0.8} />; })}
    {polys(blk([-60, -3.7, 0], [60, -3, 40]), ISO.wall, G3, 2)}
    {(() => { const a = P([-60, -3, 0.18]), b = P([60, -3, 0.18]); return <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={ISO.floor[2]} strokeWidth={10} />; })()}
  </g>
);

/** Acoustic foam panels on the wall: grey slabs with a diamond relief, in rows. */
const Foam: React.FC = () => {
  const Y0 = -3, Y1 = -2.86, cells: React.ReactNode[] = [];
  for (let r = 0; r < 2; r++) for (let cI = 0; cI < 24; cI++) {
    const x0 = -15.4 + cI * 1.3 + (r % 2) * 0.0, z0 = 1.9 + r * 1.3;
    cells.push(<g key={`${r}-${cI}`}>
      {polys(blk([x0, Y0, z0], [x0 + 1.15, Y1, z0 + 1.15]), FOAM, G2, 2)}
      <g transform={planeXZ(Y1 + 0.001, U, O)}>{[0.29, 0.58, 0.86].map((f, j) => <polygon key={j} points={`${x0 + f * 1.15 - 0.2},${z0 + 0.575} ${x0 + f * 1.15},${z0 + 0.575 + 0.2} ${x0 + f * 1.15 + 0.2},${z0 + 0.575} ${x0 + f * 1.15},${z0 + 0.575 - 0.2}`} fill={FOAM[0]} stroke={G2} strokeWidth={0.025} opacity={0.9} />)}</g>
    </g>);
  }
  return <g>{cells}</g>;
};

/** The head: an extruded profile (skin), the hair on top, the ear and the mouth on the side face, the neck, and the shoulders. */
const Person: React.FC<{ c: number; skull: number; ear: number }> = ({ c, skull, ear }) => {
  const open = 0.5 + 0.5 * Math.sin((c / 0.75) * Math.PI * 2);      // period 0.75 s: 80 times in 60 s
  const neck = cylinder([0.02, 0, 2.7], [0.02, 0, 3.55], 0.4, 0.4, [1, 0, 0], [0, 1, 0], U, O, 32);
  const ep = circlePts(0, 0, 1, 20).map(([x, z]) => S(EAR.x + x * 0.2, EAR.z + z * 0.3));
  const mouth = circlePts(0, 0, 1, 14).map(([x, z]) => S(MOUTH.x + x * 0.1, MOUTH.z + z * (0.05 + 0.1 * open)));
  const sk = HEAD.map(([x, z]) => S(0.02 + (x - 0.02) * 0.84, CZ + 0.05 + (z - CZ - 0.05) * 0.84, 0.6));
  const earPulse = 1 + 0.25 * ear * Math.sin(c * 9);
  return (
    <g>
      {polys(blk([-2.1, -1.3, 0], [0.25, 1.3, 2.7]), SHIRT, G1, 2.5)}
      {polys(neck, SKIN, G1, 2.5)}
      {polys(extrudeAnyXZ(HEAD, -0.55, 0.55, U, O), SKIN, G1, 2.5)}
      {polys(extrudeAnyXZ(HAIR_PTS, -0.6, 0.6, U, O), HAIR, G1, 2.5)}
      <polygon points={ptsAttr(mouth)} fill={G1} />
      <g transform={`translate(${S(EAR.x, EAR.z)[0]} ${S(EAR.x, EAR.z)[1]}) scale(${earPulse}) translate(${-S(EAR.x, EAR.z)[0]} ${-S(EAR.x, EAR.z)[1]})`}>
        <polygon points={ptsAttr(ep)} fill={SKIN[1]} stroke={G1} strokeWidth={3} />
        <path d={smoothPath(circlePts(0, 0, 1, 12).slice(2, 9).map(([x, z]) => S(EAR.x + x * 0.09, EAR.z + z * 0.16)))} fill="none" stroke={G1} strokeWidth={3} />
      </g>
      {skull > 0.02 && <g opacity={skull}><polygon points={ptsAttr(sk)} fill={BONE} fillOpacity={0.4} stroke={BONE} strokeWidth={9} strokeLinejoin="round" /><polygon points={ptsAttr(sk)} fill="none" stroke={G1} strokeWidth={3} strokeLinejoin="round" opacity={0.7} /></g>}
    </g>
  );
};

/** The standing microphone: a round base, a thin stand and a capsule with a grille ring. */
const Mic: React.FC = () => {
  const base = cylinder([MIC.x, 0, 1.6], [MIC.x, 0, 1.72], 0.55, 0.55, [1, 0, 0], [0, 1, 0], U, O, 32);
  const pole = cylinder([MIC.x, 0, 1.7], [MIC.x, 0, 3.5], 0.08, 0.08, [1, 0, 0], [0, 1, 0], U, O, 16);
  const cap = cylinder([MIC.x, 0, 3.45], [MIC.x, 0, 4.6], 0.36, 0.36, [1, 0, 0], [0, 1, 0], U, O, 32);
  const top = circlePts(0, 0, 0.36, 32).map(([x, y]) => P([MIC.x + x, y, 4.6]));
  return (
    <g>
      {polys(base, ISO.dark, G1, 2.5)}{polys(pole, ISO.metal, G1, 2.5)}{polys(cap, ISO.dark, G1, 2.5)}
      <polygon points={ptsAttr(top)} fill={ISO.dark[0]} stroke={G1} strokeWidth={3} />
      {[3.75, 4.05, 4.35].map((z) => { const ring = circlePts(0, 0, 0.37, 32).map(([x, y]) => P([MIC.x + x, y, z])); return <polygon key={z} points={ptsAttr(ring)} fill="none" stroke={G3} strokeWidth={3} opacity={0.55} />; })}
    </g>
  );
};

/** The small recorder on the desk: a box with a screen on top where a row of bars moves while it records, and a light. */
const Recorder: React.FC<{ c: number; rec: number }> = ({ c, rec }) => {
  const bars = Array.from({ length: 8 }, (_, i) => 0.04 + rec * 0.34 * Math.abs(Math.sin((c / 0.75) * Math.PI * 2 * (1 + (i % 3) * 0.5) + i * 1.3)));
  const blink = rec > 0.5 && Math.sin((c / 1.5) * Math.PI * 2) > -0.2;
  const dot = P([4.4, 0.62, 2.04]);
  return (
    <g>
      {polys(blk([4.2, -0.9, 1.6], [6.0, 0.9, 2.0]), ISO.labPlastic, G1, 2.5)}
      {polys(blk([4.3, -0.7, 2.0], [5.9, 0.5, 2.03]), ISO.dark, G1, 2)}
      {bars.map((h, i) => polys(blk([4.4 + i * 0.19, -0.1, 2.03], [4.55 + i * 0.19, 0.3, 2.03 + h]), [YELLOW, YELLOW_D, mixRgb(YELLOW_D, BLACK, 0.3)], G1, 2, 0.95))}
      <circle cx={dot[0]} cy={dot[1]} r={10} fill={blink ? YELLOW : G3} stroke={G1} strokeWidth={3} />
    </g>
  );
};

/** A plate with a short text. It is placed from a world anchor (ax, ay) plus a SCREEN offset (dx, dy) and drawn at a constant size on the screen whatever the
    camera zoom `z` is; an optional line runs to the world point `to`. White, rounded, coming in at `a`, out at `b`. */
const Tag: React.FC<{ text: string; at: P2; dx: number; dy: number; z: number; fs?: number; c: number; a: number; b?: number; hl?: string[]; to?: P2 }> = ({ text, at, dx, dy, z, fs = 46, c, a, b = 1e9, hl, to }) => {
  const k = on(c, a, b);
  if (k <= 0.02) return null;
  const x = at[0] + dx / z, y = at[1] + dy / z, f = fs / z, w = textWidth(text, f) + f * 1.1, h = f * 1.5;
  return <g opacity={Math.min(1, k * 1.5)}>{to && <><line x1={x} y1={y} x2={to[0]} y2={to[1]} stroke={BLACK} strokeWidth={5 / z} strokeLinecap="round" /><circle cx={to[0]} cy={to[1]} r={9 / z} fill={BLACK} /></>}<rect x={x - w / 2} y={y - h * 0.58} width={w} height={h} rx={h / 2} fill={WHITE} opacity={0.94} stroke={G3} strokeWidth={3 / z} /><Label text={text} x={x} y={y} fs={f} t={c} start={a} highlight={hl} /></g>;
};

/** The poster on the wall: a ring that fills 38 % (drawn in the wall's plane). */
const Poster: React.FC<{ c: number }> = ({ c }) => {
  const k = on(c, T.poster, T.panBack), fill = clamp01((c - T.ring) / 1.1);
  if (k <= 0.02) return null;
  const cx = -0.9, cz = 7.6, r = 0.85, n = Math.max(2, Math.round(60 * 0.38 * fill));
  const arc = Array.from({ length: n + 1 }, (_, i) => { const th = ((0.38 * fill * i) / n) * Math.PI * 2; return `${cx + r * Math.sin(th)},${cz + r * Math.cos(th)}`; }).join(" ");
  return (
    <g opacity={k}>
      {polys(blk([-2.4, -3.0, 6.3], [0.6, -2.84, 8.95]), [WHITE, G4, G3], G1, 2.5)}
      <g transform={planeXZ(-2.83, U, O)}>
        <circle cx={cx} cy={cz} r={r} fill="none" stroke={G3} strokeWidth={0.2} />
        {fill > 0.02 && <polyline points={arc} fill="none" stroke={YELLOW} strokeWidth={0.2} strokeLinecap="round" strokeLinejoin="round" />}
      </g>
    </g>
  );
};

const Scene = ({ beat, t, clock }: SceneProps) => {
  useFonts();
  const c = clock, cam = cam2At(CAM, c), isOutro = beat.kind === "outro";
  const air = Math.max(on(c, T.airOn, T.panMouth - 0.4), on(c, T.panMouth, T.panHead - 0.4) * 0.7 + 0 * c, on(c, T.reach - 0.2, T.panHead), on(c, T.hit, T.play), on(c, T.tip1, T.fade));
  const bone = Math.max(on(c, T.boneOn, T.panMouth - 0.4), on(c, T.panHead, T.cut), on(c, T.tip1, T.fade) * 0.5);
  const boneFlow = on(c, T.boneFlow, T.cut);
  const skull = on(c, T.skull, T.panMic - 0.3);
  const rec = on(c, T.recOn, T.panPoster - 0.2);
  const playK = on(c, T.play, T.panPoster - 0.4);
  const strong = on(c, T.arcsBig, T.panHead);
  const earK = Math.max(on(c, T.lblEar, T.panMouth - 0.2), on(c, T.play, T.panPoster - 0.4));
  const cutK = clamp01((c - T.cut) / 0.5);
  const tip = (a: number, b: number) => on(c, a, b);
  const earP = S(EAR.x, EAR.z), mouthP = S(MOUTH.x, MOUTH.z), micP = P([MIC.x, 0, 4.0]), recP = P([5.1, 0, 2.1]);
  return (
    <svg width={1080} height={1920} viewBox="0 0 1080 1920">
      <g transform={layerTransform(cam, 1)}>
        <Floor />
        <Foam />
        <Poster c={c} />
        <Person c={c} skull={skull} ear={earK} />
        {polys(blk([0.7, -2.4, 0], [6.9, 2.4, 1.6]), [mixRgb(ISO.soil[0], WHITE, 0.45), mixRgb(ISO.soil[1], WHITE, 0.45), mixRgb(ISO.soil[2], WHITE, 0.35)], G1, 2.5)}
        <MouthArcs c={c} k={0.9} strong={strong} />
        <Mic />
        <Recorder c={c} rec={rec} />
        <g transform={`translate(0 ${-2 * Math.sin((c / 5) * Math.PI * 2)})`}><IsoCup u={80} o={P([5.2, -1.7, 1.6])} t={c} /></g>
        {/* the two ways to the ear: along the cheek through the air (grey), through the skull (yellow) */}
        <Trail path={AIR_PATH} k={air * (1 - 0.5 * cutK * 0) * (isOutro ? 0 : 1)} color={G4} w={7} dash="14 18" off={-c * 60} />
        <Dots path={AIR_PATH} c={c} k={air * (isOutro ? 0 : 1)} color={WHITE} n={4} speed={0.5} r={11} />
        <Trail path={BONE_PATH} k={bone * (1 - 0.7 * on(c, T.cut, T.panPoster)) * (isOutro ? 0 : 1)} color={YELLOW} w={10} />
        {boneFlow > 0.02 && <g opacity={boneFlow}><path d={wavy(BONE_PATH, 12, 70, c * 14)} fill="none" stroke={YELLOW_D} strokeWidth={6} strokeLinecap="round" /><path d={wavy(AIR_PATH, 4, 22, c * 20)} fill="none" stroke={G1} strokeWidth={4} strokeLinecap="round" opacity={0.7} /></g>}
        <Dots path={BONE_PATH} c={c} k={bone * (1 - 0.7 * on(c, T.cut, T.panPoster)) * (isOutro ? 0 : 1)} color={YELLOW_D} n={4} speed={0.35} r={10} />
        {/* playback: the recording comes back to the ear through the air only */}
        <Trail path={PLAY_PATH} k={playK} color={G4} w={7} dash="14 18" off={-c * 60} />
        <Dots path={PLAY_PATH} c={c} k={playK} color={WHITE} n={6} speed={0.45} />
        {/* the bone path is cut off from the microphone: a cross over it */}
        {on(c, T.cross, T.panMid - 0.3) > 0.02 && (() => { const m = along(BONE_PATH, 0.55).p, k = on(c, T.cross, T.panMid - 0.3); return <g opacity={k}><line x1={m[0] - 26} y1={m[1] - 26} x2={m[0] + 26} y2={m[1] + 26} stroke={BLACK} strokeWidth={11} strokeLinecap="round" /><line x1={m[0] + 26} y1={m[1] - 26} x2={m[0] - 26} y2={m[1] + 26} stroke={BLACK} strokeWidth={11} strokeLinecap="round" /></g>; })()}
        {/* labels: a world anchor, a screen offset, constant size on the screen */}
        {(() => {
          const z = cam.zoom, mk = (text: string, at: P2, dx: number, dy: number, a: number, b: number, hl?: string[], to?: P2, fs = 46) => <Tag key={text + a} text={text} at={at} dx={dx} dy={dy} z={z} c={c} a={a} b={b} hl={hl} to={to} fs={fs} />;
          const airM = along(AIR_PATH, 0.45).p, boneM = along(BONE_PATH, 0.5).p, skullP = S(-0.75, CZ + 0.45, 0.6), posterP = P([-0.9, -2.8, 7.6]);
          return <>
            {mk("jalur udara", airM, 150, 300, T.lblAir, T.panMouth - 0.3, ["udara"], airM)}
            {mk("jalur tulang", boneM, -80, 250, T.lblBone, T.panMouth - 0.3, ["tulang"], boneM)}
            {mk("telinga", earP, 60, -250, T.lblEar, T.panMouth - 0.3, undefined, [earP[0], earP[1] - 28])}
            {mk("gelombang suara", mouthP, 250, -230, T.lblWave, T.lblViaAir - 0.2, ["suara"], undefined, 44)}
            {mk("lewat udara", airM, 60, 300, T.lblViaAir, T.lblOthers - 0.2, ["udara"], along(AIR_PATH, 0.3).p)}
            {mk("orang lain: jalur ini", airM, 60, 300, T.lblOthers, T.panHead - 0.3, ["orang"], along(AIR_PATH, 0.3).p, 44)}
            {mk("tengkorak", skullP, 100, -330, T.lblSkull, T.lblLow - 0.2, undefined, skullP)}
            {mk("nada rendah lebih kuat", earP, 0, 380, T.lblLow, T.lblHeavy - 0.2, ["rendah"], undefined, 42)}
            {mk("suara terasa lebih berat", earP, 0, 380, T.lblHeavy, T.panMic - 0.3, ["berat"], undefined, 42)}
            {mk("mikrofon", micP, -200, -260, T.lblMic, T.panMid - 0.3, undefined, [micP[0] - 36, micP[1] - 28])}
            {mk("merekam", recP, -150, -120, T.lblRec, T.cut, undefined, recP)}
            {mk("tulang tidak ikut", micP, -60, 330, T.lblNoBone, T.panMid - 0.3, ["tulang"], undefined, 44)}
            {mk("cuma jalur udara", earP, 250, 420, T.lblAirOnly, T.lblThin - 0.2, ["udara"], undefined, 44)}
            {mk("lebih tinggi, tipis", earP, 250, 420, T.lblThin, T.lblOthersEar - 0.2, ["tinggi"], undefined, 44)}
            {mk("suara di telinga orang", earP, 250, 420, T.lblOthersEar, T.panPoster - 0.3, undefined, undefined, 42)}
            {mk("38%", posterP, 0, 8, T.lblPct, T.panBack, ["38%"], undefined, 56)}
            {mk("5 detik", posterP, 330, -30, T.lblSec, T.panBack)}
            {mk("studi 1967", posterP, -190, 330, T.lblYear, T.panBack)}
            {mk("wajar kaget", earP, 300, -260, T.tip1, T.tip2 - 0.2, ["wajar"], undefined, 52)}
            {mk("otak berharap ada tulang", earP, 220, -260, T.tip2, T.tip3 - 0.2, undefined, undefined, 44)}
            {mk("bukan rusak", micP, 0, 330, T.tip3, T.fade, ["rusak"], undefined, 52)}
          </>;
        })()}
      </g>
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
      {void easeInOut}{void tip}
    </svg>
  );
};
const KICK: Record<string, string> = { hook: "REKAMAN", jalur: "JALUR", udara: "UDARA", tulang: "TULANG", mic: "MIKROFON", hasil: "JAWABANNYA", fakta: "TAPI", tips: "TIPS" };

export const Video: React.FC<{ story: StoryT; layoutDebug?: boolean }> = (p) => <StoryVideo story={p.story} scene={Scene} layoutDebug={p.layoutDebug} />;
