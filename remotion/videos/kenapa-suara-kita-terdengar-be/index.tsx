/* Kenapa suara kita terdengar beda di rekaman? — look 2d (B28): one flat home-studio set seen from the front (set kind "home-studio"): a wall of acoustic foam
   panels, a desk that runs past the frame, a microphone, a recorder and a cup on it, and one hero: a person seen from the front, big, so the mouth is in the middle
   and an ear is on each side. The two ways a voice reaches the ear are two different places in the picture: the AIR way runs OUTSIDE the head, on the right (out of the mouth,
   round the jaw, into the ear), the BONE way runs INSIDE the head, on the left (from the throat up through the jaw to the inner ear), so the two never cross. Real shapes checked
   (Wikipedia, "Sound", "Bone conduction"): sound is a pressure wave that spreads out from the mouth, so it leaves as arcs, not as a beam; bone carries low notes
   better than air; a microphone takes only the air way. One continuous camera (plan.ts CAM); the first frame is the last (the loop). */
import React from "react";
import {
  BLACK, CaptionLayer, Label, StoryVideo, TopText, YELLOW, blinkClosed, cam2At, clamp01, layerTransform, loopClock, ptsAttr, smoothPath, springAt, textWidth, useFonts,
  type P2, type SceneProps, type StoryT,
} from "../../src/design/index.ts";
import { BLUSH, G1, G2, G3, G4, ISO, SKIN_A, SKIN_B, WHITE } from "../../src/tokens.ts";
import { mixRgb } from "../../src/natureGeometry.ts";
import { CAM, T } from "./plan.ts";
import storyJson from "./story.json";
import { StingMark } from "../../src/components/StingMark.tsx";

export const story = storyJson as unknown as StoryT;

const on = (c: number, a: number, b = 1e9) => clamp01((c - a) / 0.35) * (1 - clamp01((c - b) / 0.35));
const TAU = Math.PI * 2;

/** The set, in px of the 1080 x 1920 frame at zoom 1 (x right, y down). The head is 500 px wide; one scale: a head is about 16 cm wide, so 31 px a cm
    (the microphone's capsule 5 cm wide, the recorder 16 cm, the cup 8 cm). */
const HX = 540, HY = 800, RX = 250, RY = 235, DESK_Y = 1330;
const EAR_DX = 262, EAR_Y = 812;
const MOUTH: P2 = [HX, 936], THROAT: P2 = [HX, 1085], MIC: P2 = [770, 1228], REC: P2 = [930, 1296], POSTER: P2 = [1330, 640];
const EAR_L: P2 = [HX - EAR_DX, EAR_Y], EAR_R: P2 = [HX + EAR_DX, EAR_Y], INNER_L: P2 = [312, 818];
const mirror = (pts: readonly P2[]): P2[] => pts.map(([x, y]) => [2 * HX - x, y]);
// the air way: out of the mouth, under the jaw, round the outside of the head and into the ear; the bone way: from the throat up inside the jaw to the inner ear
const AIR_R: P2[] = [[584, 944], [628, 1004], [704, 1050], [822, 1004], [886, 902], [856, 826], [796, 816]];
const BONE_R: P2[] = [[540, 1085], [592, 1012], [672, 936], [734, 860], [768, 818]];
const BONE_L = mirror(BONE_R);
// playback: from the recorder through the air, round the outside of the head, into the ear
const PLAY: P2[] = [[930, 1262], [1004, 1110], [968, 930], [880, 832], [796, 816]];

const ringPts = (cx: number, cy: number, rx: number, ry: number, a0: number, a1: number, n = 16): P2[] => Array.from({ length: n + 1 }, (_, i) => { const a = ((a0 + ((a1 - a0) * i) / n) * Math.PI) / 180; return [cx + rx * Math.cos(a), cy + ry * Math.sin(a)] as P2; });
/** A point at fraction f (0 to 1) along a polyline, and the unit normal there. */
const along = (pts: readonly P2[], f: number): { p: P2; n: P2 } => {
  const lens = pts.slice(1).map((p, i) => Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1])), tot = lens.reduce((a, b) => a + b, 0);
  let d = Math.max(0, Math.min(1, f)) * tot, i = 0;
  while (i < lens.length - 1 && d > lens[i]) { d -= lens[i]; i++; }
  const k = lens[i] ? d / lens[i] : 0, a = pts[i], b = pts[i + 1], l = lens[i] || 1;
  return { p: [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k], n: [-(b[1] - a[1]) / l, (b[0] - a[0]) / l] };
};

/** A vibration that travels along a way: a thin dashed line that runs from the start to the end, small beads that run with it and an arrowhead at the end.
    `tick` is the size of a bead: bigger for the low notes of the bone, small for the air. */
const Flow: React.FC<{ path: readonly P2[]; k: number; color: string; c: number; w?: number; tick?: number; n?: number; speed?: number }> = ({ path, k, color, c, w = 4, tick = 12, n = 3, speed = 0.45 }) => {
  if (k <= 0.02) return null;
  const d = smoothPath(path as P2[]), end = path[path.length - 1], { n: nn } = along(path, 1), dir: P2 = [nn[1], -nn[0]], a = 11;
  const head: P2[] = [[end[0] + dir[0] * a, end[1] + dir[1] * a], [end[0] - dir[0] * 5 + nn[0] * a * 0.7, end[1] - dir[1] * 5 + nn[1] * a * 0.7], [end[0] - dir[0] * 5 - nn[0] * a * 0.7, end[1] - dir[1] * 5 - nn[1] * a * 0.7]];
  return (
    <g opacity={k}>
      <path d={d} fill="none" stroke={BLACK} strokeWidth={w + 2} strokeLinecap="round" strokeLinejoin="round" opacity={0.55} />
      <path d={d} fill="none" stroke={color} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" strokeDasharray="9 9" strokeDashoffset={-c * 54} />
      <polygon points={ptsAttr(head)} fill={color} stroke={BLACK} strokeWidth={2} strokeLinejoin="round" />
      {Array.from({ length: n }, (_, i) => { const f = (c * speed + i / n) % 1, { p } = along(path, f); return <circle key={i} cx={p[0]} cy={p[1]} r={(tick / 2) * (0.7 + 0.3 * Math.sin(f * Math.PI))} fill={color} stroke={BLACK} strokeWidth={1.5} />; })}
    </g>
  );
};

/** Sound leaves the mouth as a pressure wave that spreads out: arcs that grow and fade on their way to the microphone (period 1.5 s, 40 times in 60 s). */
const MouthArcs: React.FC<{ c: number; k: number; strong: number }> = ({ c, k, strong }) => {
  if (k <= 0.02) return null;
  return <g opacity={k}>{[0, 1, 2].map((i) => {
    const ph = (c / 1.5 + i / 3) % 1, r = 70 + ph * (200 + 40 * strong);
    return <path key={i} d={smoothPath(ringPts(MOUTH[0], MOUTH[1], r, r, 24, 76, 8))} fill="none" stroke={WHITE} strokeWidth={8 + 3 * strong} strokeLinecap="round" opacity={(1 - ph) * (0.7 + 0.3 * strong)} />;
  })}</g>;
};

/** The wall: acoustic foam panels in a grid (two tones and a small pyramid mark each), running past the frame on every side. */
const WALL = mixRgb(G4, WHITE, 0.35), FOAM_A = mixRgb(G4, G3, 0.25), FOAM_B = mixRgb(G4, G3, 0.6);
const Wall: React.FC = () => {
  const cells: React.ReactNode[] = [];
  for (let r = -8; r < 9; r++) for (let q = -12; q < 22; q++) {
    const x = -810 + q * 150, y = 20 + r * 150, dark = (r + q) % 2 !== 0;
    cells.push(<g key={`${r}-${q}`}><rect x={x + 7} y={y + 7} width={136} height={136} rx={12} fill={dark ? FOAM_B : FOAM_A} /><polygon points={`${x + 75},${y + 45} ${x + 105},${y + 75} ${x + 75},${y + 105} ${x + 45},${y + 75}`} fill={dark ? FOAM_A : FOAM_B} /></g>);
  }
  return <g><rect x={-3000} y={-3000} width={7000} height={7000} fill={WALL} />{cells}</g>;
};

/** The desk: its top edge and its front, running past the frame left, right and at the bottom. */
const DESK_T = mixRgb(ISO.soil[0], WHITE, 0.5), DESK_F = mixRgb(ISO.soil[1], WHITE, 0.4);
const Desk: React.FC = () => <g><rect x={-3000} y={DESK_Y} width={7000} height={3000} fill={DESK_F} /><rect x={-3000} y={DESK_Y} width={7000} height={64} fill={DESK_T} />{[330, 610].map((dy) => <rect key={dy} x={-3000} y={DESK_Y + dy} width={7000} height={10} fill={mixRgb(DESK_F, BLACK, 0.12)} />)}</g>;

/** The person, from the front: shoulders, a neck with the throat, a round head, an ear on each side, hair, two eyes and a mouth that opens and closes with the
    voice (period 0.75 s). With `skull` the bones of the head show through, pale; with `bone` they and the throat turn yellow; the ears swell with `ear`. */
const SHIRT = ISO.labPlastic[1], NECK = mixRgb(SKIN_A, SKIN_B, 0.35), EARC = mixRgb(SKIN_A, SKIN_B, 0.3), CANAL = mixRgb(SKIN_B, BLACK, 0.35);
const Person: React.FC<{ c: number; amb: number; skull: number; bone: number; ear: number; surprised: boolean; eyes: number }> = ({ c, amb, skull, bone, ear, surprised, eyes }) => {
  const open = 0.5 + 0.5 * Math.sin((amb / 0.75) * TAU), pulse = 1 + 0.14 * ear * Math.sin(c * 9), breath = 1 + 0.01 * Math.sin((amb / 2.5) * TAU), es = surprised ? 1.2 : 1;
  const tone = mixRgb(WHITE, YELLOW, bone);
  return (
    <g>
      <g transform={`translate(0 ${DESK_Y}) scale(1 ${breath}) translate(0 ${-DESK_Y})`}><rect x={250} y={1128} width={580} height={420} rx={110} fill={SHIRT} /></g>
      <rect x={470} y={980} width={140} height={190} rx={30} fill={NECK} />
      {[EAR_L, EAR_R].map((e, i) => (
        <g key={i} transform={`translate(${e[0]} ${e[1]}) scale(${pulse})`}>
          <ellipse cx={0} cy={0} rx={48} ry={70} fill={EARC} /><ellipse cx={i ? -6 : 6} cy={4} rx={20} ry={36} fill={CANAL} />
        </g>
      ))}
      <ellipse cx={HX} cy={HY} rx={RX} ry={RY} fill={SKIN_A} />
      <polygon points={ptsAttr(ringPts(HX, HY - 8, RX * 1.04, RY * 1.05, 190, 350))} fill={BLACK} />
      {[-190, -115, -38, 38, 115, 190].map((dx) => <circle key={dx} cx={HX + dx} cy={HY - 52 - Math.abs(dx) * 0.04} r={44} fill={BLACK} />)}
      <polygon points={ptsAttr([[HX + 20, HY - 222], [HX + 110, HY - 200], [HX + 96, HY - 292]])} fill={BLACK} />
      {/* the bones of the head: the outline of the skull and the jaw, seen through the face; the throat (the vocal folds) lights up with the bone way */}
      {skull > 0.02 && <path d={`${smoothPath([...ringPts(HX, HY - 22, 205, 186, 150, 390), [HX + 150, HY + 120], [HX + 96, HY + 208], [HX - 96, HY + 208], [HX - 150, HY + 120]])} Z`} fill={WHITE} fillOpacity={0.16} stroke={tone} strokeWidth={9} strokeLinejoin="round" strokeDasharray="26 14" opacity={skull} />}
      {bone > 0.02 && <ellipse cx={THROAT[0]} cy={THROAT[1]} rx={20 + 4 * open} ry={13 + 4 * open} fill={YELLOW} stroke={BLACK} strokeWidth={3} opacity={bone} />}
      {[-1, 1].map((sg) => (
        <g key={sg}>
          <ellipse cx={HX + sg * 100} cy={HY - 6} rx={32 * es} ry={40 * es * eyes} fill={BLACK} />
          {eyes > 0.5 && <><circle cx={HX + sg * 100 - 11} cy={HY - 22} r={12} fill={WHITE} /><circle cx={HX + sg * 100 + 12} cy={HY + 8} r={6} fill={WHITE} /></>}
          <ellipse cx={HX + sg * 152} cy={HY + 62} rx={36} ry={17} fill={BLUSH} opacity={0.75} />
        </g>
      ))}
      <ellipse cx={HX} cy={HY + 66} rx={15} ry={9} fill={NECK} />
      <ellipse cx={MOUTH[0]} cy={MOUTH[1]} rx={46} ry={8 + 20 * open} fill={BLACK} />
      <ellipse cx={MOUTH[0]} cy={MOUTH[1] + 4 + 12 * open} rx={24} ry={2 + 7 * open} fill={BLUSH} />
    </g>
  );
};

/** The microphone on its small stand on the desk: a base, a stand, a capsule with a grille. `hit` rings it when the voice reaches it. */
const Mic: React.FC<{ c: number; hit: number }> = ({ c, hit }) => (
  <g>
    <rect x={MIC[0] - 7} y={MIC[1] + 60} width={14} height={DESK_Y - MIC[1] - 60} fill={G2} />
    <rect x={MIC[0] - 62} y={DESK_Y - 16} width={124} height={22} rx={11} fill={G1} />
    <rect x={MIC[0] - 44} y={MIC[1] - 80} width={88} height={160} rx={44} fill={G1} />
    <rect x={MIC[0] - 44} y={MIC[1] - 80} width={34} height={160} rx={17} fill={G2} opacity={0.6} />
    {[-40, -10, 20].map((dy) => <rect key={dy} x={MIC[0] - 38} y={MIC[1] + dy} width={76} height={7} rx={3} fill={G3} opacity={0.7} />)}
    {hit > 0.02 && [0, 1].map((i) => { const ph = (c / 0.75 + i / 2) % 1; return <ellipse key={i} cx={MIC[0]} cy={MIC[1]} rx={58 + ph * 46} ry={94 + ph * 46} fill="none" stroke={WHITE} strokeWidth={6} opacity={hit * (1 - ph)} />; })}
  </g>
);

/** The small recorder on the desk: a box with a screen where a row of bars moves while it records, and a light. A cable runs to it from the microphone. */
const Recorder: React.FC<{ c: number; rec: number }> = ({ c, rec }) => {
  const blink = rec > 0.5 && Math.sin((c / 1.5) * TAU) > -0.2;
  return (
    <g>
      <path d={`M${MIC[0] + 50} ${DESK_Y - 4} L${REC[0] - 84} ${DESK_Y - 4}`} stroke={G1} strokeWidth={6} strokeLinecap="round" />
      <rect x={REC[0] - 84} y={REC[1] - 36} width={168} height={72} rx={12} fill={G4} /><rect x={REC[0] - 84} y={REC[1] + 14} width={168} height={22} rx={10} fill={G3} />
      <rect x={REC[0] - 70} y={REC[1] - 26} width={104} height={38} rx={6} fill={BLACK} />
      {Array.from({ length: 8 }, (_, i) => { const h = 4 + rec * 26 * Math.abs(Math.sin((c / 0.75) * TAU * (1 + (i % 3) * 0.5) + i * 1.3)); return <rect key={i} x={REC[0] - 64 + i * 12} y={REC[1] + 8 - h} width={8} height={h} fill={YELLOW} />; })}
      <circle cx={REC[0] + 58} cy={REC[1] - 8} r={11} fill={blink ? YELLOW : G3} />
    </g>
  );
};

/** A cup on the desk (dressing): its steam rises and fades (period 3 s). */
const Cup: React.FC<{ amb: number }> = ({ amb }) => (
  <g>
    <circle cx={258} cy={DESK_Y - 44} r={26} fill="none" stroke={WHITE} strokeWidth={12} />
    <rect x={150} y={DESK_Y - 84} width={104} height={84} rx={16} fill={WHITE} /><rect x={150} y={DESK_Y - 24} width={104} height={24} rx={12} fill={G4} />
    {[0, 1].map((i) => { const ph = (amb / 3 + i / 2) % 1, x = 185 + i * 34, y = DESK_Y - 100 - ph * 70; return <path key={i} d={smoothPath([[x, y], [x + 9, y - 16], [x - 7, y - 32], [x + 4, y - 48]])} fill="none" stroke={WHITE} strokeWidth={6} strokeLinecap="round" opacity={0.7 * Math.sin(ph * Math.PI)} />; })}
  </g>
);

/** The poster on the wall: a ring that fills 38 %. */
const Poster: React.FC<{ c: number }> = ({ c }) => {
  const k = on(c, T.poster, T.panBack), fill = clamp01((c - T.ring) / 1.1);
  if (k <= 0.02) return null;
  return (
    <g opacity={k}>
      <rect x={POSTER[0] - 190} y={POSTER[1] - 230} width={380} height={470} rx={18} fill={WHITE} /><rect x={POSTER[0] - 190} y={POSTER[1] + 200} width={380} height={40} rx={18} fill={G4} />
      <circle cx={POSTER[0]} cy={POSTER[1]} r={128} fill="none" stroke={G4} strokeWidth={30} />
      {fill > 0.02 && <path d={smoothPath(ringPts(POSTER[0], POSTER[1], 128, 128, -90, -90 + 360 * 0.38 * fill, 24))} fill="none" stroke={YELLOW} strokeWidth={30} strokeLinecap="round" />}
    </g>
  );
};

/** A plate with a short text. It is placed from a world anchor plus a SCREEN offset (dx, dy) and drawn at a constant size on the screen whatever the camera
    zoom `z` is; an optional line runs to the world point `to`. White, rounded, coming in at `a`, out at `b`. */
const Tag: React.FC<{ text: string; at: P2; dx: number; dy: number; z: number; fs?: number; c: number; a: number; b?: number; hl?: string[]; to?: P2 }> = ({ text, at, dx, dy, z, fs = 46, c, a, b = 1e9, hl, to }) => {
  const k = on(c, a, b);
  if (k <= 0.02) return null;
  const x = at[0] + dx / z, y = at[1] + dy / z, f = fs / z, w = textWidth(text, f) + f * 1.1, h = f * 1.5;
  return <g opacity={Math.min(1, k * 1.5)}>{to && <><line x1={x} y1={y} x2={to[0]} y2={to[1]} stroke={BLACK} strokeWidth={3 / z} strokeLinecap="round" /><circle cx={to[0]} cy={to[1]} r={6 / z} fill={BLACK} /></>}<rect x={x - w / 2} y={y - h * 0.58} width={w} height={h} rx={h / 2} fill={WHITE} opacity={0.96} stroke={G3} strokeWidth={3 / z} /><Label text={text} x={x} y={y} fs={f} t={c} start={a} highlight={hl} /></g>;
};

const Scene = ({ beat, t, clock, story: sty }: SceneProps) => {
  useFonts();
  const amb = loopClock(clock, sty.beats.reduce((a, b) => a + b.dur, 0));   // B29: the mouth, the arcs, the steam and the blink run on the loop clock
  const c = clock, cam = cam2At(CAM, c), z = cam.zoom, live = beat.kind === "outro" ? 0 : 1;
  const air = Math.max(on(c, T.airOn, T.panHead - 0.4), on(c, T.hit, T.play), on(c, T.tip1, T.fade)) * live;
  const bone = Math.max(on(c, T.boneOn, T.panMouth - 0.4), on(c, T.panHead, T.panMid - 0.3), on(c, T.tip1, T.fade) * 0.6) * live;
  const boneDim = 1 - 0.55 * on(c, T.cut, T.panPoster);
  const skull = on(c, T.skull, T.panMic - 0.3) * live, low = on(c, T.boneFlow, T.cut);
  const rec = on(c, T.recOn, T.panPoster - 0.2), playK = on(c, T.play, T.panPoster - 0.4), strong = on(c, T.arcsBig, T.panHead), hit = on(c, T.hit, T.cut);
  const earK = Math.max(on(c, T.lblEar, T.panMouth - 0.2), on(c, T.reach, T.panHead), on(c, T.play, T.panPoster - 0.4));
  const cross = on(c, T.cross, T.panMid - 0.3);
  const eyes = 1 - blinkClosed(amb, 4, 0.5), surprised = c >= T.tip1 && c < T.tip2;
  const mk = (text: string, at: P2, dx: number, dy: number, a: number, b: number, hl?: string[], to?: P2, fs = 46) => <Tag key={text + a} text={text} at={at} dx={dx} dy={dy} z={z} c={c} a={a} b={b} hl={hl} to={to} fs={fs} />;
  const airLow = along(AIR_R, 0.42).p, boneLow = along(BONE_L, 0.3).p, crossP = along(BONE_L, 0.5).p, top: P2 = [HX, HY - RY - 12];
  return (
    <svg width={1080} height={1920} viewBox="0 0 1080 1920">
      <g transform={layerTransform(cam, 1)}>
        <Wall />
        <Poster c={c} />
        <Person c={c} amb={amb} skull={skull} bone={bone * boneDim} ear={earK} surprised={surprised} eyes={eyes} />
        <MouthArcs c={amb} k={0.9} strong={strong} />
        {/* the bone way, inside the head: long wave fronts, slow (low notes) */}
        <Flow path={BONE_L} k={bone * boneDim} color={YELLOW} c={c} w={2.5} tick={9 + 4 * low} n={3} speed={0.32} />
        {bone > 0.02 && [INNER_L].map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r={10 + 2 * Math.sin(c * 9)} fill={YELLOW} stroke={BLACK} strokeWidth={3} opacity={bone * boneDim} />)}
        {cross > 0.02 && <g opacity={cross}>{[crossP].map((m, i) => <g key={i}><line x1={m[0] - 20} y1={m[1] - 20} x2={m[0] + 20} y2={m[1] + 20} stroke={BLACK} strokeWidth={8} strokeLinecap="round" /><line x1={m[0] + 20} y1={m[1] - 20} x2={m[0] - 20} y2={m[1] + 20} stroke={BLACK} strokeWidth={8} strokeLinecap="round" /></g>)}</g>}
        <Desk />
        <Cup amb={amb} />
        <Mic c={c} hit={hit} />
        <Recorder c={c} rec={rec} />
        {/* the air way, outside the head: short wave fronts, fast */}
        <Flow path={AIR_R} k={air} color={WHITE} c={c} w={2.5} tick={7} n={4} speed={0.5} />
        {/* playback: the recording comes back to the ear through the air only */}
        <Flow path={PLAY} k={playK} color={WHITE} c={c} w={2.5} tick={7} n={4} speed={0.45} />
        {/* labels: a world anchor, a screen offset, constant size on the screen */}
        {mk("jalur udara", airLow, -20, 86, T.lblAir, T.panMouth - 0.3, ["udara"], airLow)}
        {mk("jalur tulang", boneLow, -230, 110, T.lblBone, T.panMouth - 0.3, ["tulang"], boneLow)}
        {mk("telinga", EAR_L, -40, -330, T.lblEar, T.panMouth - 0.3, undefined, [EAR_L[0], EAR_L[1] - 40])}
        {mk("gelombang suara", THROAT, 0, 190, T.lblWave, T.lblViaAir - 0.2, ["suara"], undefined, 44)}
        {mk("lewat udara", THROAT, 0, 190, T.lblViaAir, T.lblOthers - 0.2, ["udara"])}
        {mk("orang lain: jalur ini", THROAT, 0, 190, T.lblOthers, T.panHead - 0.3, ["orang"], undefined, 44)}
        {mk("tulang kepala", top, 0, -70, T.lblSkull, T.lblLow - 0.2, undefined, [top[0], top[1] + 60])}
        {mk("nada rendah lebih kuat", THROAT, 0, 210, T.lblLow, T.lblHeavy - 0.2, ["rendah"], undefined, 42)}
        {mk("suara terasa lebih berat", THROAT, 0, 210, T.lblHeavy, T.panMic - 0.3, ["berat"], undefined, 42)}
        {mk("mikrofon", MIC, 200, -30, T.lblMic, T.panMid - 0.3, undefined, [MIC[0] + 46, MIC[1] - 30])}
        {mk("merekam", REC, 0, 150, T.lblRec, T.cut, undefined, [REC[0], REC[1] + 40])}
        {mk("tulang tidak ikut", MIC, -150, 260, T.lblNoBone, T.panMid - 0.3, ["tulang"], undefined, 44)}
        {mk("cuma jalur udara", THROAT, 0, 420, T.lblAirOnly, T.lblThin - 0.2, ["udara"], undefined, 44)}
        {mk("lebih tinggi, tipis", THROAT, 0, 420, T.lblThin, T.lblOthersEar - 0.2, ["tinggi"], undefined, 44)}
        {mk("suara di telinga orang", THROAT, 0, 420, T.lblOthersEar, T.panPoster - 0.3, undefined, undefined, 42)}
        {mk("38%", POSTER, 0, 8, T.lblPct, T.panBack, ["38%"], undefined, 56)}
        {mk("5 detik", POSTER, 255, -60, T.lblSec, T.panBack)}
        {mk("studi 1967", POSTER, -150, 330, T.lblYear, T.panBack)}
        {mk("wajar kaget", top, 0, -80, T.tip1, T.tip2 - 0.2, ["wajar"], undefined, 52)}
        {mk("otak berharap ada tulang", top, 0, -80, T.tip2, T.tip3 - 0.2, undefined, undefined, 44)}
        {mk("bukan rusak", top, 0, -80, T.tip3, T.fade, ["rusak"], undefined, 52)}
      </g>
      {beat.kind !== "sting" && beat.kind !== "outro" && <TopText key={beat.id} kicker={KICK[beat.id] ?? "INTIP"} headline={beat.text} t={t} />}
      {beat.kind !== "sting" && beat.kind !== "outro" && <CaptionLayer beat={beat} t={t} />}
      {beat.kind === "sting" && <StingMark slug="kenapa-suara-kita-terdengar-be" t={t} clock={c} p={springAt(c, 3.0)} p2={springAt(c, 3.25)} />}
    </svg>
  );
};
const KICK: Record<string, string> = { hook: "REKAMAN", jalur: "JALUR", udara: "UDARA", tulang: "TULANG", mic: "MIKROFON", hasil: "JAWABANNYA", fakta: "TAPI", tips: "TIPS" };

export const Video: React.FC<{ story: StoryT; layoutDebug?: boolean }> = (p) => <StoryVideo story={p.story} scene={Scene} layoutDebug={p.layoutDebug} />;
