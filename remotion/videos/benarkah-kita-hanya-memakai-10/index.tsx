/* Benarkah kita cuma pakai 10 persen otak?: one brain scan room (set kind "scan-room": an MRI scanner with its bed, a big wall screen, the operator's desk
   with a monitor), one hero (the brain, in its real side view: the four lobes of the cerebrum, the cerebellum tucked under the back, the brainstem going
   down) and one continuous camera (plan.ts CAM). The myth (a small lit patch), the scan, every region lighting up, sleep, the energy, the damage test, the
   1936 book, the tips, and back to the first frame (loop). */
import React from "react";
import {
  BLACK, CaptionLayer, FONT_BOLD, G1, G2, G3, ISO, IsoBlock, Motes, NumberLabel, OnPlane, RED, SourceChip, StoryVideo, TipCard, TopText, WHITE,
  YELLOW, YELLOW_D, bobPx, cam2At, clamp01, easeInOut, easeOutBack, layerTransform, planeYZ, pulse01, smoothPath, springAt, toScreen, useFonts,
  type P2, type P3, type SceneProps, type StoryT, type Tones,
} from "../../src/design/index.ts";
import { mixRgb } from "../../src/natureGeometry.ts";
import { BED, CAM, N, O, REGION_LABEL, REGIONS, ROOM, T, U, W, bedX, type Region } from "./plan.ts";
import storyJson from "./story.json";
import { StingMark } from "../../src/components/StingMark.tsx";

export const story = storyJson as unknown as StoryT;

const WALLT: Tones = [ISO.wall[0], mixRgb(ISO.wall[1], WHITE, 0.25), ISO.wall[2]];
const FLOORT: Tones = ISO.floor;
const SCAN: Tones = ISO.plastic;
const DESK: Tones = ISO.labPlastic;
const DARK: Tones = ISO.dark;
const BR = ISO.brain;
const COL: Tones = ISO.metal;
const ENERGY: Tones = [mixRgb(YELLOW, WHITE, 0.35), YELLOW, YELLOW_D];
const bold = { fontFamily: FONT_BOLD, fontWeight: 700 } as const;

/** 0 to 1 over `d` s from `a`, and back to 0 over `d` s from `b`. */
const on = (c: number, a: number, b = 1e9, d = 0.35) => clamp01((c - a) / d) * (1 - clamp01((c - b) / d));
const Box: React.FC<{ a: P3; b: P3; tones: Tones }> = ({ a, b, tones }) => <IsoBlock a={a} b={b} u={U} o={O} tones={tones} />;
const path = (pts: P2[], closed = false) => smoothPath(closed ? [...pts, pts[0], pts[1]] : pts, 0.5) + (closed ? " Z" : "");
const nPts = (pts: readonly (readonly [number, number])[]) => pts.map(([x, z]) => N(x, z));
const ellN = (cx: number, cz: number, rx: number, rz: number, n = 28): P2[] => Array.from({ length: n }, (_, i) => N(cx + rx * Math.cos((i / n) * Math.PI * 2), cz + rz * Math.sin((i / n) * Math.PI * 2)));
const polyD = (pts: P2[]) => `M ${pts.map((p) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" L ")} Z`;

// ---------------------------------------------------------------------------------------------------- the brain (side view, front to the left)
// The real shape (checked against the lateral view of the human brain): the cerebrum is an oval, higher at the back of the frontal lobe; the lateral
// sulcus runs back and up and the temporal lobe hangs under it; the central sulcus runs from the top down and forward; the occipital lobe is the back
// pole; the cerebellum sits under the occipital lobe, behind the brainstem, which goes down and slightly forward.
const CEREBRUM: [number, number][] = [[-0.92, -0.22], [-1.0, 0.12], [-0.88, 0.52], [-0.55, 0.84], [-0.05, 0.96], [0.45, 0.86], [0.82, 0.55], [1.0, 0.12], [0.95, -0.24], [0.72, -0.4], [0.38, -0.36], [0.12, -0.5], [-0.2, -0.66], [-0.52, -0.58], [-0.64, -0.38], [-0.8, -0.3]];
const LOBES: Record<"frontal" | "parietal" | "temporal" | "occipital", [number, number][]> = {
  frontal: [[-1.3, 1.3], [0.02, 1.3], [0.0, 0.96], [-0.08, 0.4], [-0.16, -0.08], [-0.58, -0.3], [-1.3, -0.3]],
  parietal: [[0.02, 1.3], [0.64, 1.3], [0.62, 0.74], [0.5, 0.02], [0.36, -0.06], [-0.16, -0.08], [-0.08, 0.4], [0.0, 0.96]],
  occipital: [[0.64, 1.3], [1.4, 1.3], [1.4, -0.7], [0.68, -0.6], [0.5, 0.02], [0.62, 0.74]],
  temporal: [[-1.3, -0.3], [-0.58, -0.3], [-0.16, -0.08], [0.36, -0.06], [0.5, 0.02], [0.68, -0.6], [0.4, -1.2], [-1.3, -1.2]],
};
const SULCI: [number, number][][] = [
  [[0.0, 0.96], [-0.04, 0.6], [-0.1, 0.25], [-0.16, -0.08]],                          // the central sulcus
  [[-0.58, -0.3], [-0.3, -0.16], [0.05, -0.1], [0.36, -0.06], [0.5, 0.04]],           // the lateral sulcus
  [[0.62, 0.74], [0.6, 0.5], [0.66, 0.3]],                                            // the parieto-occipital sulcus
];
const GYRI: [number, number][][] = [
  [[-0.82, 0.3], [-0.6, 0.42], [-0.42, 0.3], [-0.25, 0.42]], [[-0.7, 0.62], [-0.48, 0.66], [-0.3, 0.56]], [[-0.84, 0.05], [-0.62, 0.12], [-0.45, 0.02], [-0.3, 0.12]],
  [[0.12, 0.8], [0.14, 0.45], [0.08, 0.1]], [[0.3, 0.74], [0.24, 0.5], [0.34, 0.28], [0.26, 0.1]], [[0.46, 0.6], [0.4, 0.38]],
  [[-0.46, -0.42], [-0.2, -0.32], [0.08, -0.3], [0.3, -0.24]], [[-0.3, -0.54], [-0.05, -0.46], [0.2, -0.42]],
  [[0.78, 0.4], [0.86, 0.2], [0.8, 0.0]], [[0.7, -0.1], [0.84, -0.22]],
];
const CEREBELLUM = { cx: 0.56, cz: -0.6, rx: 0.36, rz: 0.22 };
const STEM: [number, number][] = [[0.06, -0.42], [0.3, -0.44], [0.32, -0.7], [0.26, -1.02], [0.08, -1.02], [0.06, -0.7]];
const MYTH = { x: -0.6, z: 0.42, r: 0.24 };                                            // the "10 %" patch of the myth, on the frontal lobe
const HURT = [{ x: -0.12, z: -0.34, r: 0.2, at: T.hurtA }, { x: 0.8, z: 0.18, r: 0.17, at: T.hurtB }];

const Brain: React.FC<{ c: number; glow: Record<Region, number>; myth: number; hurt: number[]; on: number }> = ({ c, glow, myth, hurt, on: k }) => {
  const outline = path(nPts(CEREBRUM), true);
  const cb = ellN(CEREBELLUM.cx, CEREBELLUM.cz, CEREBELLUM.rx, CEREBELLUM.rz);
  const ink = BR[2], sw = 5;
  const blobs = (r: Region, pts: [number, number][]) => glow[r] > 0.02 ? pts.map(([x, z], i) => {
    const s = 0.8 + 0.2 * pulse01(c, i * 0.23, 1.4);
    return <polygon key={r + i} points={ellN(x, z, 0.14 * s, 0.11 * s, 18).map((p) => p.join(",")).join(" ")} fill={YELLOW} opacity={0.55 * glow[r]} />;
  }) : null;
  return (
    <g opacity={k}>
      <defs><clipPath id="cerebrum"><path d={outline} /></clipPath><clipPath id="cerebellum"><path d={polyD(cb)} /></clipPath></defs>
      {/* the brainstem and the cerebellum, behind the cerebrum */}
      <path d={polyD(nPts(STEM))} fill={BR[1]} stroke={ink} strokeWidth={sw} strokeLinejoin="round" />
      <path d={polyD(nPts([[0.22, -0.46], [0.26, -0.98], [0.3, -0.98], [0.3, -0.46]]))} fill={BR[2]} opacity={0.6} />
      <path d={polyD(cb)} fill={BR[1]} stroke={ink} strokeWidth={sw} strokeLinejoin="round" />
      <g clipPath="url(#cerebellum)">
        {[-0.12, -0.04, 0.04, 0.12].map((dz, i) => <path key={i} d={path(nPts([[0.22, -0.6 + dz], [0.45, -0.54 + dz], [0.7, -0.56 + dz], [0.92, -0.64 + dz]]))} fill="none" stroke={ink} strokeWidth={3} />)}
        <path d={polyD(cb)} fill={YELLOW} opacity={0.55 * glow.cerebellum} />
      </g>
      {/* the cerebrum: four lobes, the sulci between them, the folds */}
      <path d={outline} fill={BR[0]} />
      <g clipPath="url(#cerebrum)">
        <path d={polyD(nPts(LOBES.frontal))} fill={BR[0]} />
        <path d={polyD(nPts(LOBES.parietal))} fill={mixRgb(BR[0], BR[1], 0.35)} />
        <path d={polyD(nPts(LOBES.occipital))} fill={mixRgb(BR[0], BR[1], 0.6)} />
        <path d={polyD(nPts(LOBES.temporal))} fill={BR[1]} />
        <path d={polyD(nPts([[0.2, -0.2], [1.2, -0.2], [1.2, -1], [0.2, -1]]))} fill={BR[2]} opacity={0.18} />
        {(["frontal", "parietal", "occipital", "temporal"] as const).map((r) => <path key={r} d={polyD(nPts(LOBES[r]))} fill={YELLOW} opacity={0.42 * glow[r]} />)}
        {blobs("frontal", [[-0.6, 0.3], [-0.35, 0.6]])}{blobs("parietal", [[0.25, 0.55]])}{blobs("occipital", [[0.82, 0.15]])}{blobs("temporal", [[-0.15, -0.36], [0.2, -0.3]])}
        {GYRI.map((g, i) => <path key={i} d={path(nPts(g))} fill="none" stroke={BR[2]} strokeWidth={4} strokeLinecap="round" opacity={0.8} />)}
        {SULCI.map((g, i) => <path key={i} d={path(nPts(g))} fill="none" stroke={ink} strokeWidth={7} strokeLinecap="round" />)}
        {/* the myth's small lit patch */}
        {myth > 0.01 && <polygon points={ellN(MYTH.x, MYTH.z, MYTH.r, MYTH.r * 1.3, 24).map((p) => p.join(",")).join(" ")} fill={YELLOW} opacity={(0.6 + 0.25 * pulse01(c, 0, 1.6)) * myth} />}
        {/* the damage test: a grey patch with a red ring */}
        {HURT.map((h, i) => hurt[i] > 0.01 && <g key={i} opacity={hurt[i]}>
          <polygon points={ellN(h.x, h.z, h.r, h.r * 1.2, 22).map((p) => p.join(",")).join(" ")} fill={G2} opacity={0.85} />
        </g>)}
      </g>
      {HURT.map((h, i) => hurt[i] > 0.01 && <polygon key={i} points={ellN(h.x, h.z, h.r * 1.08, h.r * 1.3, 22).map((p) => p.join(",")).join(" ")} fill="none" stroke={RED} strokeWidth={7} strokeDasharray="16 10" opacity={hurt[i]} />)}
      <path d={outline} fill="none" stroke={ink} strokeWidth={sw + 1} strokeLinejoin="round" />
      {/* a soft shine on the top front (light from the top left) */}
      <path d={path(nPts([[-0.82, 0.42], [-0.6, 0.7], [-0.25, 0.86]]))} fill="none" stroke={WHITE} strokeWidth={9} strokeLinecap="round" opacity={0.55} />
    </g>
  );
};

// ---------------------------------------------------------------------------------------------------- the room
const Floor: React.FC = () => {
  const lines: React.ReactNode[] = [];
  for (let i = -8; i <= 8; i += 1) { const a = W([i, 0, 0]), b = W([i, 8, 0]); lines.push(<line key={`x${i}`} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={FLOORT[2]} strokeWidth={3} opacity={0.45} />); }
  for (let j = 1; j <= 8; j += 1) { const a = W([-8, j, 0]), b = W([8, j, 0]); lines.push(<line key={`y${j}`} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={FLOORT[2]} strokeWidth={3} opacity={0.45} />); }
  return <g>{lines}</g>;
};

const Scanner: React.FC<{ c: number; rings: number }> = ({ c, rings }) => {
  const { a, b } = ROOM.scanner, x0 = b[0];
  return (
    <g>
      <Box a={a} b={b} tones={SCAN} />
      {/* a grey band round the body and the bore on the front face (the face that looks to the lower right) */}
      <Box a={[a[0] - 0.001, a[1], 1.7]} b={[b[0] + 0.001, b[1], 1.78]} tones={ISO.labPlastic} />
      <g transform={planeYZ(x0 + 0.002, U, O)}>
        <circle cx={ROOM.bore.y} cy={ROOM.bore.z} r={ROOM.bore.r + 0.12} fill={ISO.labPlastic[1]} />
        <circle cx={ROOM.bore.y} cy={ROOM.bore.z} r={ROOM.bore.r + 0.04} fill={ISO.labPlastic[2]} />
        <circle cx={ROOM.bore.y} cy={ROOM.bore.z} r={ROOM.bore.r} fill={G1} />
        <circle cx={ROOM.bore.y + 0.06} cy={ROOM.bore.z - 0.05} r={ROOM.bore.r * 0.78} fill={G2} opacity={0.35} />
        <circle cx={ROOM.bore.y} cy={ROOM.bore.z} r={ROOM.bore.r + 0.08} fill="none" stroke={WHITE} strokeWidth={0.018} opacity={0.4 + 0.4 * pulse01(c, 0, 2)} />
        {[0, 1, 2].map((i) => { const k = rings > 0 ? ((c * 0.7 + i / 3) % 1) : 0; return rings > 0.01 && <circle key={i} cx={ROOM.bore.y} cy={ROOM.bore.z} r={ROOM.bore.r + 0.14 + 0.5 * k} fill="none" stroke={YELLOW_D} strokeWidth={0.03} opacity={rings * (1 - k)} />; })}
        <rect x={0.55} y={1.45} width={0.22} height={0.08} rx={0.03} fill={G2} />
        <circle cx={0.6} cy={1.49} r={0.022} fill={WHITE} opacity={0.5 + 0.5 * pulse01(c, 0.3, 1.2)} />
      </g>
    </g>
  );
};

const Bed: React.FC<{ k: number }> = ({ k }) => {
  const [x0, x1] = bedX(k), xs = Math.max(ROOM.scanner.b[0], x0);
  return (
    <g>
      <Box a={ROOM.bedBase.a} b={[ROOM.bedBase.b[0], ROOM.bedBase.b[1], BED.z0]} tones={DESK} />
      <Box a={[xs, BED.y0, BED.z0]} b={[x1, BED.y1, BED.z1]} tones={SCAN} />
      <Box a={[Math.max(xs, x1 - 0.45), BED.y0 + 0.08, BED.z1]} b={[x1 - 0.08, BED.y1 - 0.08, BED.z1 + 0.08]} tones={ISO.plastic} />
    </g>
  );
};

const Desk: React.FC<{ c: number; bookLift: number }> = ({ c, bookLift }) => {
  const { a, b } = ROOM.desk, m = ROOM.monitor, bk = ROOM.book, leg = 0.05;
  const wave = Array.from({ length: 24 }, (_, i) => [m.a[0] + 0.06 + (i / 23) * (m.b[0] - m.a[0] - 0.12), 1.2 + 0.06 * Math.sin(i * 0.9 + c * 4) * Math.sin(i * 0.37 + c)] as P2);
  return (
    <g>
      {[[a[0], a[1]], [b[0] - leg, a[1]], [a[0], b[1] - leg], [b[0] - leg, b[1] - leg]].map(([x, y], i) => <Box key={i} a={[x, y, 0]} b={[x + leg, y + leg, a[2]]} tones={ISO.metal} />)}
      <Box a={a} b={b} tones={DESK} />
      <Box a={[4.58, 0.5, 0.75]} b={[4.72, 0.6, 0.95]} tones={DARK} />
      <Box a={m.a} b={m.b} tones={DARK} />
      <OnPlane y={m.b[1] + 0.001} u={U} o={O}>
        <rect x={m.a[0] + 0.04} y={m.a[2] + 0.04} width={m.b[0] - m.a[0] - 0.08} height={m.b[2] - m.a[2] - 0.08} fill={G1} />
        <path d={smoothPath(wave, 0.5)} fill="none" stroke={G3} strokeWidth={0.012} />
        <rect x={m.a[0] + 0.08} y={1.0} width={0.25 + 0.1 * pulse01(c, 0, 2.4)} height={0.03} fill={G2} />
      </OnPlane>
      <g transform={`translate(0 ${-bookLift * 36})`}>
        <Box a={bk.a} b={[bk.b[0], bk.b[1], bk.a[2] + 0.012]} tones={DARK} />
        <Box a={[bk.a[0] + 0.01, bk.a[1], bk.a[2] + 0.012]} b={[bk.b[0], bk.b[1] - 0.01, bk.b[2] - 0.012]} tones={ISO.plastic} />
        <Box a={[bk.a[0], bk.a[1], bk.b[2] - 0.012]} b={[bk.b[0], bk.b[1], bk.b[2]]} tones={DARK} />
      </g>
    </g>
  );
};

/** The wall screen: a dark frame on the wall, a dark display with a faint grid, the brain drawn on its face. */
const ScreenFrame: React.FC = () => {
  const { a, b } = ROOM.screen;
  return <Box a={a} b={b} tones={DARK} />;
};
const Display: React.FC<{ c: number; sweep: number; lit: number }> = ({ c, sweep, lit }) => {
  const { a, b } = ROOM.screen;
  const grid: React.ReactNode[] = [];
  for (let x = a[0] + 0.3; x < b[0] - 0.1; x += 0.3) grid.push(<line key={`g${x}`} x1={x} y1={a[2] + 0.08} x2={x} y2={b[2] - 0.08} stroke={G2} strokeWidth={0.006} opacity={0.5} />);
  for (let z = a[2] + 0.3; z < b[2] - 0.1; z += 0.3) grid.push(<line key={`h${z}`} x1={a[0] + 0.08} y1={z} x2={b[0] - 0.08} y2={z} stroke={G2} strokeWidth={0.006} opacity={0.5} />);
  const sz = b[2] - 0.1 - sweep * (b[2] - a[2] - 0.2);
  return (
    <OnPlane y={b[1] + 0.0005} u={U} o={O}>
      <rect x={a[0] + 0.07} y={a[2] + 0.07} width={b[0] - a[0] - 0.14} height={b[2] - a[2] - 0.14} fill={mixRgb(G1, BLACK, 0.4)} />
      <g opacity={0.6 + 0.4 * lit}>{grid}</g>
      {sweep > 0 && sweep < 1 && <rect x={a[0] + 0.08} y={sz - 0.015} width={b[0] - a[0] - 0.16} height={0.03} fill={WHITE} opacity={0.85} />}
      <circle cx={b[0] - 0.18} cy={b[2] - 0.17} r={0.03} fill={RED} opacity={0.4 + 0.5 * pulse01(c, 0, 1)} />
    </OnPlane>
  );
};

// ---------------------------------------------------------------------------------------------------- the states
function glowAt(c: number): Record<Region, number> {
  const g = {} as Record<Region, number>;
  REGIONS.forEach((r, i) => {
    const at = r === "stem" ? T.cer : REGION_LABEL[r]?.at ?? T.occ;
    let v = 0;
    if (c >= at && c < T.night) v = clamp01((c - at) / 0.4) * (0.85 + 0.15 * pulse01(c, i * 0.2, 1.6));
    else if (c >= T.night && c < T.day) v = 0.85 + (0.4 - 0.85) * clamp01((c - T.night) / 0.8) + 0.12 * pulse01(c, i * 0.17, 2.4);
    else if (c >= T.day && c < T.wave) v = 0.4 + 0.45 * clamp01((c - T.day) / 0.6) + 0.15 * pulse01(c, i * 0.17, 1.6);
    else if (c >= T.wave) { const wave = 0.35 + 0.6 * Math.max(0, Math.sin((c - T.wave) * 2.2 - i * 1.05)), k = clamp01((c - T.wave) / 0.6); v = (0.7 * (1 - k) + wave * k) * (1 - clamp01((c - T.back) / 1.4)); }
    g[r] = clamp01(v);
  });
  return g;
}

const Scene = ({ beat, t, clock }: SceneProps) => {
  useFonts();
  const c = clock;
  const cam = cam2At(CAM, c);
  const scr = (p: P2): P2 => toScreen(cam, p, 1);
  const isOutro = beat.kind === "outro";

  const myth = c < T.sweep ? 1 : c >= T.back ? clamp01((c - T.back - 0.8) / 0.9) : 1 - clamp01((c - T.sweep) / 0.5);
  const sweep = c >= T.sweep && c < T.reveal + 0.3 ? clamp01((c - T.sweep) / (T.reveal - T.sweep)) : 0;
  const glow = glowAt(c);
  const hurt = HURT.map((h) => on(c, h.at, T.heal, 0.3));
  const bedK = easeInOut(clamp01((c - T.bedIn) / (T.bedStop - T.bedIn))) * (1 - easeInOut(clamp01((c - 52.6) / 1.8)));
  const rings = on(c, T.scanRings, T.panBack, 0.4);
  const night = on(c, T.night, T.day, 0.8);
  const colA = easeOutBack(clamp01((c - T.colA) / 0.6)) * (1 - clamp01((c - T.panDesk) / 0.4));
  const colB = easeInOut(clamp01((c - T.colB) / 1.1)) * (1 - clamp01((c - T.panDesk) / 0.4));
  const bookLift = c >= T.book && c < T.book + 1.2 ? Math.sin(((c - T.book) / 1.2) * Math.PI) * easeOutBack(clamp01((c - T.book) / 0.5)) : 0;
  const lit = Math.max(...REGIONS.map((r) => glow[r]));

  // the energy: dots that run from the top of the tall column up to the brain
  const flowOn = on(c, T.flow, T.panBrain + 1.2, 0.4);
  const from = W([2.75, 2.45, 1.2]), to = N(-0.1, 0.2), mid: P2 = [from[0] + 260, (from[1] + to[1]) / 2];
  const flowPts: P2[] = [from, mid, to];
  const along = (k: number): P2 => { const u = 1 - k; return [u * u * from[0] + 2 * u * k * mid[0] + k * k * to[0], u * u * from[1] + 2 * u * k * mid[1] + k * k * to[1]]; };

  const colAB: [P3, P3] = [ROOM.colA.a, [ROOM.colA.b[0], ROOM.colA.b[1], Math.max(0.001, ROOM.colA.b[2] * colA)]];
  const colBB: [P3, P3] = [ROOM.colB.a, [ROOM.colB.b[0], ROOM.colB.b[1], Math.max(0.001, ROOM.colB.b[2] * colB)]];

  const tag = on(c, T.tag, T.panTips - 0.2, 0.3), twist = easeOutBack(clamp01((c - T.twist) / 0.5)), cross = easeInOut(clamp01((c - T.cross) / 0.4));
  const tagAt = scr(W([4.12, 0.85, 1.25])), tagY = tagAt[1] + bobPx(c, 0, 6);

  const stamp = springAt(c, T.stamp), stampOn = on(c, T.stamp, T.panDesk - 0.3, 0.3);

  return (
    <svg width={1080} height={1920} viewBox="0 0 1080 1920">
      <g transform={layerTransform(cam, 0.3)}><rect x={-3000} y={-4000} width={7000} height={9000} fill={WALLT[1]} /></g>
      <g transform={layerTransform(cam, 1)}>
        <Box a={ROOM.wall.a} b={ROOM.wall.b} tones={WALLT} />
        <Box a={ROOM.floor.a} b={ROOM.floor.b} tones={FLOORT} />
        <Floor />
        {/* the skirting along the wall */}
        <Box a={[-8, 0, 0]} b={[8, 0.03, 0.1]} tones={DESK} />
        <ScreenFrame />
        <Scanner c={c} rings={rings} />
        <Desk c={c} bookLift={bookLift} />
        <Bed k={bedK} />
        {colA > 0.01 && <Box a={colAB[0]} b={colAB[1]} tones={COL} />}
        {colB > 0.01 && <Box a={colBB[0]} b={colBB[1]} tones={ENERGY} />}
        {night > 0.01 && <rect x={-3000} y={-4000} width={7000} height={9000} fill={BLACK} opacity={0.38 * night} />}
        <Display c={c} sweep={sweep} lit={lit} />
        <Brain c={c} glow={glow} myth={myth} hurt={hurt} on={1} />
        {flowOn > 0.01 && <g opacity={flowOn}>
          <path d={smoothPath(flowPts, 0.5)} fill="none" stroke={YELLOW_D} strokeWidth={6} strokeDasharray="4 18" strokeLinecap="round" opacity={0.6} />
          {Array.from({ length: 9 }, (_, i) => { const k = ((c - T.flow) * 0.45 + i / 9) % 1, p = along(k); return <circle key={i} cx={p[0]} cy={p[1]} r={14} fill={YELLOW} stroke={YELLOW_D} strokeWidth={4} />; })}
        </g>}
      </g>
      <g transform={layerTransform(cam, 1.25)}><Motes t={c} color={WHITE} n={14} opacity={0.22} /></g>

      {/* labels on the set, in screen space, each pinned to its point */}
      {!isOutro && <>
        <NumberLabel text="10%?" x={scr(N(-0.6, 0.42))[0] - 40} y={scr(N(-0.6, 0.42))[1] - 230} ax={scr(N(-0.6, 0.42))[0]} ay={scr(N(-0.6, 0.42))[1]} fs={58} t={c} start={T.myth} end={T.pushEnd + 0.9} />
        <NumberLabel text="pemindai otak" x={760} y={1250} ax={scr(W([-0.4, 1.0, 0.6]))[0]} ay={scr(W([-0.4, 1.0, 0.6]))[1]} t={c} start={T.lblScan} end={T.panBack} />
        {(Object.entries(REGION_LABEL) as [Region, { text: string; at: number; to: P2 }][]).map(([r, l], i) => {
          const a = scr(N(l.to[0], l.to[1])), side = l.to[0] < 0.2 ? -1 : 1, up = l.to[1] > 0 ? -1 : 1;
          return <NumberLabel key={r} text={l.text} x={Math.min(900, Math.max(180, a[0] + side * 150))} y={a[1] + up * (130 + (i % 2) * 40)} ax={a[0]} ay={a[1]} t={c} start={l.at + 0.15} end={T.night} />;
        })}
        <NumberLabel text="saat tidur pun aktif" x={540} y={scr(N(0, -1.05))[1] + 120} ax={scr(N(0.1, -0.3))[0]} ay={scr(N(0.1, -0.3))[1]} t={c} start={T.lblSleep} end={T.day + 0.3} />
        <NumberLabel text="berat 2%" x={Math.max(200, scr(W([2.05, 2.45, 0.12]))[0] - 120)} y={scr(W([2.05, 2.45, 0.12]))[1] + 200} ax={scr(W([2.05, 2.45, 0.12]))[0]} ay={scr(W([2.05, 2.45, 0.12]))[1]} t={c} start={T.lblA} end={T.panUp} />
        <NumberLabel text="energi 20%" x={scr(W([2.75, 2.45, 1.2]))[0] + 120} y={scr(W([2.75, 2.45, 1.2]))[1] - 150} ax={scr(W([2.75, 2.45, 1.2]))[0]} ay={scr(W([2.75, 2.45, 1.2]))[1]} t={c} start={T.lblB} end={T.panUp} />
        <NumberLabel text="boros kalau 90% nganggur" x={420} y={scr(W([2.75, 2.45, 1.2]))[1] - 170} ax={scr(W([2.75, 2.45, 1.2]))[0]} ay={scr(W([2.75, 2.45, 1.2]))[1]} t={c} start={T.lblWaste} end={T.panBrain + 0.6} />
        <NumberLabel text="pendengaran hilang" red x={scr(N(-0.12, -0.34))[0] - 60} y={scr(N(-0.12, -0.34))[1] + 300} ax={scr(N(-0.12, -0.34))[0]} ay={scr(N(-0.12, -0.34))[1]} t={c} start={T.lostA} end={T.heal} />
        <NumberLabel text="penglihatan hilang" red x={scr(N(0.8, 0.18))[0] - 140} y={scr(N(0.8, 0.18))[1] - 380} ax={scr(N(0.8, 0.18))[0]} ay={scr(N(0.8, 0.18))[1]} t={c} start={T.lostB} end={T.heal} />
        <NumberLabel text="buku 1936" x={scr(W([4.12, 0.85, 0.8]))[0] - 120} y={scr(W([4.12, 0.85, 0.8]))[1] + 230} ax={scr(W([4.12, 0.85, 0.8]))[0]} ay={scr(W([4.12, 0.85, 0.8]))[1]} t={c} start={T.lbl1936} end={T.panTips - 0.2} />
        <NumberLabel text="kutipan dipelintir" x={540} y={scr(W([4.12, 0.85, 0.8]))[1] + 360} ax={tagAt[0]} ay={tagY + 50} t={c} start={T.twist + 0.2} end={T.panTips - 0.2} />
      </>}

      {/* the "10%" tag of the myth over the book: it twists, then it is struck out */}
      {tag > 0.01 && <g opacity={tag} transform={`translate(${tagAt[0]} ${tagY}) rotate(${-12 * twist}) scale(${0.6 + 0.4 * easeOutBack(clamp01((c - T.tag) / 0.5))})`}>
        <rect x={-120} y={-58} width={240} height={116} rx={58} fill={WHITE} stroke={BLACK} strokeWidth={6} />
        <text x={0} y={26} fontSize={76} textAnchor="middle" fill={BLACK} style={bold}>10%</text>
        {cross > 0 && <line x1={-140} y1={0} x2={-140 + 280 * cross} y2={0} stroke={BLACK} strokeWidth={14} strokeLinecap="round" />}
      </g>}

      {/* the verdict stamp (B9: MITOS is white on black) and the source chip */}
      {stampOn > 0.01 && <g opacity={stampOn} transform={`translate(540 1300) rotate(-6) scale(${Math.max(0, stamp)})`}>
        <rect x={-210} y={-70} width={420} height={140} rx={70} fill={BLACK} />
        <text x={0} y={34} fontSize={96} textAnchor="middle" fill={WHITE} style={bold}>MITOS</text>
      </g>}
      {c >= T.chip && c < T.panDesk + 0.4 && <SourceChip x={80} y={1400} text="Wikipedia · Ten-percent-of-the-brain myth" t={c} start={T.chip} end={T.panDesk - 0.3} />}

      {/* the tips */}
      <TipCard x={80} y={412} w={840} n={1} title="Hampir seluruh otak terpakai" t={c} start={T.tipA} end={T.tipB - 0.3} />
      <TipCard x={80} y={412} w={840} n={2} title="Bergantian, tidak sekaligus" t={c} start={T.tipB} end={T.back - 0.2} />

      {beat.kind !== "sting" && !isOutro && <TopText key={beat.id} kicker={KICKER[beat.id] ?? "INTIP OTAK"} headline={beat.text} t={t} />}
      {beat.kind !== "sting" && !isOutro && <CaptionLayer beat={beat} t={t} />}
      {beat.kind === "sting" && (() => {
        const p = springAt(c, 3.0), p2 = springAt(c, 3.25);
        return <g>
          <StingMark slug="benarkah-kita-hanya-memakai-10" pose="top" t={t} clock={c} p={p} p2={p2} />
        </g>;
      })()}
    </svg>
  );
};

const KICKER: Record<string, string> = {
  hook: "MITOS ATAU FAKTA", pindai: "INTIP HASIL SCAN", aktif: "TIAP BAGIAN PUNYA TUGAS", energi: "OTAK BOROS ENERGI", cedera: "JAWABANNYA", asal: "ASAL ANGKA 10%", tips: "INGAT YA",
};

export const Video: React.FC<{ story: StoryT; layoutDebug?: boolean }> = (p) => <StoryVideo story={p.story} scene={Scene} layoutDebug={p.layoutDebug} />;
