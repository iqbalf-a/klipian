/* Kenapa akar pohon bisa memecahkan aspal? — an underground cut (set kind "underground", set.json): a small road beside a tree, cut open along the face that
   looks to the viewer. The root is the hero, drawn in that cut face; the asphalt on top is a heightfield pressed up exactly as far as the root's width
   reaches (plan.ts liftAt), so the lift always has a cause. Real shapes (B27.16): a root is a woody cylinder that THICKENS (secondary growth) and tapers to a
   rounded tip (it does not drill: the tip only lengthens), a growth ring is a circle added around the last one, and a pipe in the cut is a ring.
   Every spoken fact comes from story.json; the camera and the state come from plan.ts. */
import React from "react";
import {
  BLACK, Brand, CaptionLayer, COFFEE, COFFEE_LIGHT, FPS, G1, G2, G3, HOLE_SHADE, ISO, Label, Mascot, Motes, NumberLabel, PLASTER, SourceChip, StoryVideo, TipCard, TopText, WHITE,
  YELLOW, block, cylinder, easeOut, isoAt, layerTransform, planeXZ, ptsAttr, riseAt, springAt, swayDeg, toScreen, tipCardHeight,
  type P2, type P3, type Poly, type SceneProps, type StoryT, type Tones,
} from "../../src/design/index.ts";
import { ASPHALT_T, BUBBLES, DROPS, GRAVEL_BOTTOM, O, ROAD_X0, ROOT_PATH, ROOT_Z, U, liftAt, makePlan, widthAt } from "./plan.ts";
import storyJson from "./story.json";

export const story = storyJson as unknown as StoryT;

const C = Math.cos(Math.PI / 6);
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
/** A point of the cut face (x along the road, z up) on the screen at rest. */
const cutPt = (x: number, z: number): P2 => [C * U * x + O[0], 0.5 * U * x + O[1] - U * z];
const W3 = (p: P3): P2 => isoAt(p, U, O);
const XMIN = -16, XMAX = 16, YMIN = -16, ZMIN = -22;                                   // the slab runs past the frame on every open side (B27.1)
const BARK: Tones = [COFFEE_LIGHT, COFFEE, COFFEE];

/** The faces of a solid with the third tone made by a soft shade over the same colour (the bark has only two colours in the tokens). */
const Solid: React.FC<{ polys: readonly Poly[]; tones: Tones; shade?: boolean }> = ({ polys, tones, shade }) => (
  <g>{polys.map((p, i) => <g key={i}><polygon points={ptsAttr(p.pts)} fill={tones[p.tone]} stroke={tones[p.tone]} strokeWidth={0.8} strokeLinejoin="round" />{shade && p.tone === 2 && <polygon points={ptsAttr(p.pts)} fill={BLACK} opacity={0.2} />}</g>)}</g>
);

/** Catmull-Rom samples through points (the root's centre line is smooth, B27.12). */
function sample(pts: readonly P2[], n = 8): P2[] {
  const out: P2[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    for (let s = 0; s < n; s++) {
      const k = s / n, k2 = k * k, k3 = k2 * k;
      out.push([0, 1].map((d) => 0.5 * (2 * p1[d] + (-p0[d] + p2[d]) * k + (2 * p0[d] - 5 * p1[d] + 4 * p2[d] - p3[d]) * k2 + (-p0[d] + 3 * p1[d] - 3 * p2[d] + p3[d]) * k3)) as unknown as P2);
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
}

/** The root as a polygon in cut-face coordinates: wide near the trunk, narrowing to a rounded tip. */
function rootPoly(tip: number, w: number): { poly: P2[]; top: P2[]; centre: P2[] } {
  const pts: P2[] = [...ROOT_PATH.filter((p) => p[0] < tip - 0.4), [tip, ROOT_Z]];
  const c = sample(pts, 8), left: P2[] = [], right: P2[] = [], top: P2[] = [];
  c.forEach((p, i) => {
    const a = c[Math.max(0, i - 1)], b = c[Math.min(c.length - 1, i + 1)];
    const dx = b[0] - a[0], dz = b[1] - a[1], len = Math.hypot(dx, dz) || 1, nx = -dz / len, nz = dx / len;
    const round = Math.sqrt(clamp01((tip - p[0]) / 0.45 + 0.02));                         // the tip closes in a round end
    const hw = (widthAt(p[0], w) / 2) * round;
    left.push([p[0] + nx * hw, p[1] + nz * hw]); right.push([p[0] - nx * hw, p[1] - nz * hw]);
    top.push([p[0] + nx * hw * 0.45, p[1] + nz * hw * 0.45 + hw * 0.3]);
  });
  return { poly: [...left, ...right.reverse()], top, centre: c };
}

const Cut: React.FC<{ pts: readonly P2[]; fill: string; opacity?: number }> = ({ pts, fill, opacity }) => <polygon points={pts.map((p) => `${p[0]},${p[1]}`).join(" ")} fill={fill} opacity={opacity} />;

const STONES: P2[] = Array.from({ length: 70 }, (_, i) => [ROAD_X0 + 0.15 + ((i * 37) % 100) * 0.145, -0.3 - ((i * 53) % 60) * 0.0105]);
const GRAINS: P2[] = Array.from({ length: 90 }, (_, i) => [-15 + ((i * 29) % 100) * 0.3, -1.1 - ((i * 47) % 100) * 0.19]);

type Cam = ReturnType<ReturnType<typeof makePlan>["camAt"]>;

const Scene = ({ beat, t, clock, story: s }: SceneProps) => {
  const P = React.useMemo(() => makePlan(s), [s]);
  const st = P.state(clock), cam: Cam = P.camAt(beat.id, t), w = st.w, tip = st.tip;
  const lift = (x: number) => (x < ROAD_X0 ? 0 : liftAt(x, w, tip));
  const xs: number[] = []; for (let x = ROAD_X0; x <= XMAX + 0.01; x += 0.5) xs.push(x);
  const root = rootPoly(tip, w);
  const topOf = (x: number) => lift(x);

  // ---- the cut face (drawn in the plane y = 0, coordinates (x, z))
  const crackX = -0.5, crackOpen = st.crack;
  const zTop = topOf(crackX), zBot = GRAVEL_BOTTOM + 0.3;
  const zig = [0, 1, 2, 3, 4, 5].map((k) => zTop + (zBot - zTop) * (k / 5));
  const jag = [0.0, 0.07, -0.05, 0.08, -0.04, 0.03];
  const cutFace = (
    <g transform={planeXZ(0, U, O)}>
      <Cut pts={[[XMIN, 0], [XMAX, 0], [XMAX, ZMIN], [XMIN, ZMIN]]} fill={ISO.soil[1]} />
      {GRAINS.map((g, i) => <circle key={i} cx={g[0]} cy={g[1]} r={0.045 + (i % 3) * 0.02} fill={i % 2 ? ISO.soil[2] : ISO.soil[0]} opacity={0.7} />)}
      <Cut pts={[[XMIN, 0], [ROAD_X0 - 0.3, 0], [ROAD_X0 - 0.3, -0.38], [XMIN, -0.38]]} fill={ISO.grass[1]} />
      {/* the gravel base under the road, stretched with the road above it */}
      <Cut pts={[...xs.map((x) => [x, -ASPHALT_T + topOf(x)] as P2), [XMAX, GRAVEL_BOTTOM], [ROAD_X0, GRAVEL_BOTTOM]]} fill={ISO.stone[1]} />
      {STONES.map((g, i) => <circle key={i} cx={g[0]} cy={Math.min(g[1] + topOf(g[0]), -ASPHALT_T + topOf(g[0]) - 0.04)} r={0.05 + (i % 4) * 0.012} fill={i % 2 ? ISO.stone[2] : ISO.stone[0]} />)}
      {/* a buried pipe, cut across: a ring (the dressing; the pipe stays at its place) */}
      <circle cx={9.2} cy={-3.7} r={0.72} fill={ISO.metal[1]} /><circle cx={9.2} cy={-3.7} r={0.5} fill={HOLE_SHADE} opacity={0.55} /><circle cx={9.2} cy={-3.7} r={0.72} fill="none" stroke={ISO.metal[2]} strokeWidth={0.06} />
      {/* water and oxygen the root is looking for (round drops, B27.16) */}
      {DROPS.map((d, i) => { const gone = clamp01((tip - d[0] + 0.5) / 0.7); return gone >= 1 ? null : <circle key={i} cx={d[0]} cy={d[1] + 0.03 * Math.sin(clock * 2 + i)} r={(0.12 + 0.025 * Math.sin(clock * 3 + i * 2)) * (1 - gone)} fill={ISO.water[1]} />; })}
      {BUBBLES.map((d, i) => { const gone = clamp01((tip - d[0] + 0.5) / 0.7); return gone >= 1 ? null : <circle key={i} cx={d[0]} cy={d[1] + 0.25 * riseAt(clock, i / 3, 3.2) - 0.1} r={0.075 * (1 - gone)} fill={WHITE} stroke={G3} strokeWidth={0.02} />; })}
      {/* the root: bark body, a lighter back, rootlets that sway, the pale tip */}
      <Cut pts={root.poly} fill={COFFEE} />
      <polyline points={root.top.map((p) => `${p[0]},${p[1]}`).join(" ")} fill="none" stroke={COFFEE_LIGHT} strokeWidth={Math.max(0.05, w * 0.28)} strokeLinecap="round" strokeLinejoin="round" opacity={0.9} />
      {[-3.4, -2.3, -1.2, 0.2, 1.4, 2.6].filter((x) => x < tip - 0.5).map((x, i) => {
        const hw = widthAt(x, w) / 2, len = 0.55 + 0.1 * (i % 3), sw = 0.07 * Math.sin(clock * 1.3 + i * 1.7);
        return <path key={i} d={`M ${x} ${ROOT_Z - hw * 0.9} Q ${x + sw} ${ROOT_Z - hw - len * 0.5} ${x - 0.15 + sw * 2} ${ROOT_Z - hw - len}`} fill="none" stroke={COFFEE} strokeWidth={0.045} strokeLinecap="round" />;
      })}
      <circle cx={tip} cy={ROOT_Z} r={Math.max(0.05, widthAt(tip, w) / 2) * 0.8} fill={PLASTER} />
      {/* the asphalt: a heightfield, pressed up by the root */}
      <Cut pts={[...xs.map((x) => [x, topOf(x)] as P2), ...[...xs].reverse().map((x) => [x, -ASPHALT_T + topOf(x)] as P2)]} fill={ISO.dark[1]} />
      {crackOpen > 0.02 && <Cut pts={[...zig.map((z, k) => [crackX + jag[k] - 0.07 * crackOpen, z] as P2), ...[...zig].reverse().map((z, k2) => [crackX + jag[5 - k2] + 0.07 * crackOpen, z] as P2)]} fill={G1} opacity={0.95} />}
      <Cut pts={[[ROAD_X0 - 0.3, 0], [ROAD_X0, 0], [ROAD_X0, -0.38], [ROAD_X0 - 0.3, -0.38]]} fill={ISO.stone[1]} />
    </g>
  );

  // ---- the top of the set (grass, curb, the road as strips that follow the lift, lane dashes, a crack line)
  const roadStrip = (x0: number, x1: number): Poly => ({ tone: 0, pts: [W3([x0, YMIN, topOf(x0)]), W3([x1, YMIN, topOf(x1)]), W3([x1, 0, topOf(x1)]), W3([x0, 0, topOf(x0)])] });
  const top = (
    <g>
      <polygon points={ptsAttr([W3([XMIN, YMIN, 0]), W3([ROAD_X0 - 0.3, YMIN, 0]), W3([ROAD_X0 - 0.3, 0, 0]), W3([XMIN, 0, 0])])} fill={ISO.grass[0]} />
      {xs.slice(0, -1).map((x, i) => <polygon key={i} points={ptsAttr(roadStrip(x, xs[i + 1]).pts)} fill={ISO.dark[0]} stroke={ISO.dark[0]} strokeWidth={0.8} />)}
      {[-12, -8, -4].map((y) => {
        const pts = [[5.8, y], [6.2, y], [6.2, y + 2], [5.8, y + 2]].map(([x, yy]) => W3([x, yy, topOf(x) + 0.01]));
        return <polygon key={y} points={ptsAttr(pts)} fill={WHITE} opacity={0.9} />;
      })}
      {crackOpen > 0.02 && <polyline points={ptsAttr([[0, 0.0], [0.12, -0.7], [-0.08, -1.4], [0.1, -2.2], [-0.05, -3.0]].map(([dx, y]) => W3([crackX + dx, y, topOf(crackX + dx) + 0.01])))} fill="none" stroke={G1} strokeWidth={4 + 8 * crackOpen} strokeLinejoin="round" strokeLinecap="round" />}
      <Solid polys={block([ROAD_X0 - 0.3, YMIN, 0], [ROAD_X0, 0, 0.14], U, O)} tones={ISO.stone} />
    </g>
  );

  // ---- the tree on the grass strip (a trunk, a crown that sways) and a lamp post on the curb side
  const foot: P3 = [-4.6, -0.5, 0];
  const trunk = cylinder(foot, [foot[0], foot[1], 3.6], 0.8, 0.55, [1, 0, 0], [0, 1, 0], U, O);
  const crownAt = W3([foot[0], foot[1], 4.6]);
  const lobes: { dx: number; dy: number; r: number }[] = [{ dx: -48, dy: 10, r: 112 }, { dx: 62, dy: 14, r: 100 }, { dx: 6, dy: -64, r: 118 }];
  const tree = (
    <g>
      <Solid polys={trunk} tones={BARK} shade />
      <g transform={`rotate(${swayDeg(clock, 0, 1.6, 4.2)} ${W3(foot)[0]} ${W3(foot)[1]})`}>
        {lobes.map((l, i) => <g key={i}>
          <circle cx={crownAt[0] + l.dx + 9} cy={crownAt[1] + l.dy + 12} r={l.r} fill={ISO.leaf[2]} />
          <circle cx={crownAt[0] + l.dx} cy={crownAt[1] + l.dy} r={l.r} fill={ISO.leaf[1]} />
          <circle cx={crownAt[0] + l.dx - l.r * 0.28} cy={crownAt[1] + l.dy - l.r * 0.3} r={l.r * 0.55} fill={ISO.leaf[0]} />
        </g>)}
      </g>
    </g>
  );
  const lampBase: P3 = [-3.4, -6.2, 0];
  const lamp = (
    <g>
      <Solid polys={block([lampBase[0], lampBase[1], 0], [lampBase[0] + 0.22, lampBase[1] + 0.22, 3.6], U, O)} tones={ISO.metal} />
      <Solid polys={block([lampBase[0] - 0.5, lampBase[1] - 0.1, 3.6], [lampBase[0] + 0.7, lampBase[1] + 0.32, 3.85], U, O)} tones={ISO.dark} />
    </g>
  );

  // ---- the metal post the trunk swallows (the fact beat): a stub from the trunk, a bark collar grows over it
  const postA = W3([foot[0] + 0.5, foot[1] + 0.6, 1.3]), postB = W3([foot[0] + 1.9, foot[1] + 0.6, 1.3]);
  const collar = s.beats.find((b) => b.id === "fakta") && clock >= P.B.fakta.a ? clamp01((clock - P.B.fakta.a - 1.5) / 3) : 0;
  const post = (
    <g>
      <Solid polys={block([foot[0] + 0.5, foot[1] + 0.5, 1.2], [foot[0] + 1.9, foot[1] + 0.72, 1.45], U, O)} tones={ISO.metal} />
      <ellipse cx={postA[0] + (postB[0] - postA[0]) * 0.25 * collar} cy={postA[1] + (postB[1] - postA[1]) * 0.25 * collar + 4} rx={30 + 70 * collar} ry={44 + 20 * collar} fill={COFFEE} opacity={collar > 0 ? 1 : 0} />
    </g>
  );
  const showPost = beat.id === "fakta" || (clock >= P.B.fakta.a && clock < P.B.tips.a + 3);

  // ---- overlays in screen space (the camera moves their anchors, they stay upright)
  const labelEls = (P.labelsBy[beat.id] ?? []).map((l, i) => {
    const a = toScreen(cam, cutPt(l.at[0], l.at[1]));
    return <NumberLabel key={i} text={l.text} x={l.tx} y={l.ty} ax={a[0]} ay={a[1]} fs={46} t={t} start={l.from} end={l.to} />;
  });
  const rings = beat.id === "tebal" ? 1 + [3.2, 4.4, 5.6, 6.8].filter((a) => t >= a).length : 0;
  const ringCard = beat.id === "tebal" && t >= 1.5 && t < 7.6 ? (() => {
    const p = springAt(t, 1.5) * (1 - clamp01((t - 7.2) / 0.4)), cx = 800, cy = 700;
    return <g transform={`translate(${cx} ${cy}) scale(${Math.max(0, p)}) translate(${-cx} ${-cy})`}>
      <rect x={cx - 175} y={cy - 190} width={350} height={400} rx={36} fill={WHITE} stroke={G2} strokeWidth={3} />
      <circle cx={cx} cy={cy - 20} r={150} fill={COFFEE} />
      {Array.from({ length: rings }, (_, k) => { const kk = rings - 1 - k, r = 22 + kk * 30, born = [1.5, 3.2, 4.4, 5.6, 6.8][rings - 1 - kk], pop = easeOut(clamp01((t - born) / 0.35)); return <circle key={k} cx={cx} cy={cy - 20} r={r * (kk === rings - 1 ? pop : 1)} fill="none" stroke={k % 2 ? COFFEE_LIGHT : PLASTER} strokeWidth={9} opacity={0.95} />; })}
      <circle cx={cx} cy={cy - 20} r={9} fill={PLASTER} />
      <Label text="cincin kayu" x={cx} y={cy + 178} fs={40} t={t} start={1.9} />
    </g>;
  })() : null;
  const up = beat.id === "hasil" && t >= 1.0 ? [0, 1, 2].map((k) => {
    const x = 0.2 + k * 1.8, a = toScreen(cam, cutPt(x, -0.45 + 0.06 * Math.sin(clock * 3 + k))), b = toScreen(cam, cutPt(x, 0.45 + liftAt(x, w, tip)));
    const pop = easeOut(clamp01((t - 1.0 - k * 0.25) / 0.3));
    return <g key={k} opacity={pop}><line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1] + 26} stroke={BLACK} strokeWidth={9} strokeLinecap="round" /><polygon points={`${b[0]},${b[1]} ${b[0] - 22},${b[1] + 34} ${b[0] + 22},${b[1] + 34}`} fill={BLACK} /></g>;
  }) : null;
  const tipH = (title: string, sub?: string) => tipCardHeight(title, sub, 880);
  const tipCards = beat.id === "tips" ? <>
    <TipCard x={100} y={1500 - tipH("Hati-hati melangkah", "kalau jalan terangkat")} w={880} n={1} title="Hati-hati melangkah" sub="kalau jalan terangkat" t={t} start={0.8} subAt={1.6} end={3.2} />
    <TipCard x={100} y={1500 - tipH("Laporkan ke pengelola", "jalan yang retak")} w={880} n={2} title="Laporkan ke pengelola" sub="jalan yang retak" t={t} start={3.2} subAt={4.0} />
  </> : null;
  const chip = (id: string, a: number, b: number) => beat.id === id ? <SourceChip x={90} y={1496} text="en.wikipedia.org" t={t} start={a} end={b} /> : null;
  const topEl = P.top(beat);

  return (
    <svg width={1080} height={1920} viewBox="0 0 1080 1920">
      <Brand clock={clock} spot={{ x: 900, y: 760, r: 300 }} />
      <g transform={layerTransform(cam, 1)}>
        {top}
        {lamp}
        {tree}
        {showPost && post}
        {cutFace}
      </g>
      <g transform={layerTransform(cam, 1.35)}><Motes t={clock} color={WHITE} opacity={0.35} n={10} /></g>
      {labelEls}
      {ringCard}
      {up}
      {tipCards}
      {chip("hasil", 3.0, 6.6)}
      {chip("fakta", 4.2, 5.8)}
      {beat.kind === "sting" && (() => { const p = springAt(t, 0); return <g>
        <g transform={`translate(540 720) scale(${Math.max(0, p)}) translate(-540 -720)`}><Mascot x={540} y={720} w={220} expr="curious" t={t} clock={clock} /></g>
        <g transform={`translate(540 1489) scale(${Math.max(0, springAt(t, 0.2))}) translate(-540 -1489)`}><rect x={340} y={1443} width={400} height={92} rx={46} fill={YELLOW} /><text x={540} y={1507} fontSize={56} textAnchor="middle" fill={BLACK} style={{ fontFamily: '"Outfit", sans-serif', fontWeight: 700 }}>Intip yuk!</text></g>
      </g>; })()}
      {topEl && <TopText kicker={topEl.kicker} headline={topEl.headline} t={t} />}
      {beat.kind !== "sting" && beat.kind !== "outro" && <CaptionLayer beat={beat} t={t} />}
    </svg>
  );
};

export const Video: React.FC<{ story: StoryT; layoutDebug?: boolean }> = (p) => <StoryVideo story={p.story} scene={Scene} layoutDebug={p.layoutDebug} />;
void FPS;
