/* Kenapa gelembung sabun berwarna-warni? — a custom video, one continuous take in a bathroom corner (a new set kind "bathroom-tub", set.json): a tiled
   back wall, a bathtub with foam, a soap dish, a pot of bubble solution with its wand and a towel. The hero is one soap bubble floating over the tub.
   Shapes checked (Wikipedia: Soap bubble, Soap film, Thin-film interference): a free bubble is a sphere (the smallest surface for its air), drawn as a
   circle in every view; its colours are bands that follow the film's thickness like a contour map, thin (gold, then black spots) at the top where the
   water drains away, thicker at the bottom; the film's two surfaces (outer and inner) each reflect light. The camera and every time come from plan.ts. */
import React from "react";
import {
  BLACK, CaptionLayer, G1, G3, HOT1, HOT2, ISO, IsoBlock, Lab, Label, Mascot, Motes, OnPlane, Pill, Polys, THEMES, TipCard, TopText, WHITE, Badge,
  block, bobPx, cylinder, isoAt, layerTransform, ptsAttr, riseAt, springAt, easeInOut, easeOut, StoryVideo, type P2, type P3, type SceneProps, type StoryT,
} from "../../src/design/index.ts";
import { B, DISH, LENS_C, LENS_R, O, POT, TOWEL, TUB, U, WALL_Y, makePlan } from "./plan.ts";
import storyJson from "./story.json";

export const story = storyJson as unknown as StoryT;

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const W = (p: P3): P2 => isoAt(p, U, O);
const AXX = [1, 0, 0] as const, AYY = [0, 1, 0] as const;
const rectZ = (x0: number, x1: number, y0: number, y1: number, z: number) => ptsAttr([W([x0, y0, z]), W([x1, y0, z]), W([x1, y1, z]), W([x0, y1, z])]);
// the film's colours from the top (thinnest) down (thicker): silver, then the interference colours of a soap film (gold, orange, magenta, blue, green...)
const BANDS = [WHITE, ISO.sun[0], HOT1, ISO.brain[1], ISO.water[0], ISO.leaf[0], ISO.sun[0], ISO.brain[0], ISO.leaf[0], ISO.water[0], ISO.brain[0]] as const;
const MINT = THEMES.mint;
const TILE: readonly [string, string, string] = [MINT.wall, MINT.ring, MINT.floorEdge];
const FOAM: P3[] = [[-8.2, -4.1, 0], [-7.4, -3.2, 0], [-6.0, -4.2, 0], [-5.1, -1.1, 0], [-3.6, -3.9, 0], [-2.2, -0.9, 0], [-1.0, -3.4, 0], [0.6, -1.6, 0], [1.8, -4.0, 0], [2.3, -0.8, 0], [-6.8, -0.9, 0], [-4.4, -2.4, 0]];

/** The band edges in the bubble's own frame (-1 top .. 1 bottom): they sway all the time and slide down as the film drains. */
const edge = (k: number, u: number, t: number, drain: number) => {
  const y0 = -0.85 + k * 0.19;
  const y1 = y0 + 0.45 * drain * (1 - y0) / 2;
  return y1 + 0.06 * Math.sin(3 * u + t * 0.9 + k * 1.3) + 0.035 * Math.sin(5 * u - t * 0.6 + k);
};

/** The soap bubble: a sphere (a circle on screen), its film's colour bands clipped to it, the black cap of a drained film, two window highlights and a rim. */
const Bubble: React.FC<{ c: P2; r: number; t: number; drain: number; black: number; lit?: number }> = ({ c, r, t, drain, black, lit = -1 }) => {
  const id = `bub${React.useId().replace(/:/g, "")}`;
  const us = Array.from({ length: 25 }, (_, i) => -1.1 + (i / 24) * 2.2);
  const at = (u: number, v: number): string => `${(c[0] + u * r).toFixed(1)},${(c[1] + v * r).toFixed(1)}`;
  const region = (top: (u: number) => number, bot: (u: number) => number) => [...us.map((u) => at(u, top(u))), ...[...us].reverse().map((u) => at(u, bot(u)))].join(" ");
  const nb = BANDS.length;
  const capY = (u: number) => -1.1 + 0.62 * black + 0.05 * Math.sin(4 * u + t * 1.4);
  return (
    <g>
      <defs><clipPath id={id}><circle cx={c[0]} cy={c[1]} r={r} /></clipPath></defs>
      <circle cx={c[0]} cy={c[1]} r={r} fill={WHITE} opacity={0.14} />
      <g clipPath={`url(#${id})`}>
        {BANDS.map((col, k) => {
          const top = k === 0 ? () => -1.2 : (u: number) => edge(k - 1, u, t, drain);
          const bot = k === nb - 1 ? () => 1.2 : (u: number) => edge(k, u, t, drain);
          return <polygon key={k} points={region(top, bot)} fill={col} opacity={(k === 0 ? 0.25 : 0.5) + (lit === k ? 0.35 : 0)} />;
        })}
        {lit >= 1 && <polyline points={us.map((u) => at(u, edge(lit - 1, u, t, drain))).join(" ")} fill="none" stroke={WHITE} strokeWidth={r * 0.02} strokeDasharray={`${r * 0.05} ${r * 0.04}`} />}
        {black > 0.01 && <g>
          <polygon points={region(() => -1.2, capY)} fill={G1} opacity={0.85} />
          {[[-0.35, 0.1], [0.2, 0.16], [0.45, 0.06], [-0.1, 0.22]].map(([u, d], i) => <circle key={i} cx={c[0] + u * r} cy={c[1] + (capY(u) + d) * r} r={r * 0.045 * clamp01(black * 2 - i * 0.3)} fill={G1} opacity={0.85} />)}
        </g>}
        {/* the sphere: a darker rim inside the edge */}
        <circle cx={c[0]} cy={c[1]} r={r * 0.97} fill="none" stroke={ISO.water[2]} strokeWidth={r * 0.05} opacity={0.18} />
      </g>
      {/* the window highlights (light from the top left) and the rim */}
      <path d={`M ${c[0] - r * 0.62} ${c[1] - r * 0.28} A ${r * 0.7} ${r * 0.7} 0 0 1 ${c[0] - r * 0.22} ${c[1] - r * 0.66}`} fill="none" stroke={WHITE} strokeWidth={r * 0.09} strokeLinecap="round" opacity={0.85} />
      <circle cx={c[0] - r * 0.7} cy={c[1] - r * 0.02} r={r * 0.045} fill={WHITE} opacity={0.85} />
      <path d={`M ${c[0] + r * 0.52} ${c[1] + r * 0.5} A ${r * 0.74} ${r * 0.74} 0 0 1 ${c[0] + r * 0.2} ${c[1] + r * 0.7}`} fill="none" stroke={WHITE} strokeWidth={r * 0.04} strokeLinecap="round" opacity={0.6} />
      <circle cx={c[0]} cy={c[1]} r={r} fill="none" stroke={WHITE} strokeWidth={Math.max(3, r * 0.018)} opacity={0.9} />
    </g>
  );
};

/** A wave line (screen px): amplitude, phase and colour. */
const Wave: React.FC<{ x0: number; x1: number; y: number; amp: number; ph: number; color: string; sw: number }> = ({ x0, x1, y, amp, ph, color, sw }) => (
  <polyline points={Array.from({ length: 41 }, (_, i) => { const x = x0 + ((x1 - x0) * i) / 40; return `${x.toFixed(1)},${(y + amp * Math.sin(((x - x0) / 46) + ph)).toFixed(1)}`; }).join(" ")} fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
);

const FIXED: Record<string, P2> = { kuat: [755, 812], hapus: [755, 1092], atas: [880, 585], bawah: [880, 1345] };

const Picture: React.FC<{ story: StoryT; clock: number }> = ({ story: s, clock }) => {
  const P = React.useMemo(() => makePlan(s), [s]);
  const lw = P.loopWeight(clock), t = clock * (1 - lw);                 // the idles settle as the loop comes home: the last frame is the first
  const cam = P.cam(clock);
  const tubId = `tub${React.useId().replace(/:/g, "")}`, lensId = `lens${React.useId().replace(/:/g, "")}`;
  const bub = P.bubble(clock);
  const bc = W(bub.c), br = bub.r * U;
  const bob = bobPx(t, 0, 10);
  const ring = P.ring(clock);
  const tint = P.tint(clock);
  const potTop = 5.5 + POT.h;
  const pip = P.pipette(clock), drop = P.drop(clock);
  const tipZ = potTop + 1.1 + (1 - pip) * 7;
  const burst = P.burst(clock);
  const grav = P.gravity(clock), vap = P.vapour(clock);
  const contour = P.contour(clock);
  // the lens: a circle that grows from the bubble's skin to the middle of the frame
  const lk = P.lens(clock);
  const skin = P.screen(clock, [B[0] - 0.75, B[1] + 0.75, B[2] + 0.5]);
  const lc: P2 = [skin[0] + (LENS_C[0] - skin[0]) * lk, skin[1] + (LENS_C[1] - skin[1]) * lk];
  const rays = P.rays(clock);
  const [wa, wb] = P.waves(clock);
  const wedge = P.wedge(clock);
  return (
    <svg width={1080} height={1920} viewBox="0 0 1080 1920" style={{ position: "absolute", inset: 0 }}>
      <rect width={1080} height={1920} fill={MINT.wall} />
      <defs>
        <clipPath id={tubId}><polygon points={rectZ(TUB.ix0, TUB.ix1, TUB.iy0, TUB.iy1, TUB.h)} /></clipPath>
      </defs>
      <g transform={layerTransform(cam, 1)}>
        {/* the tiled back wall (20 cm tiles), bleeding past every edge of the frame */}
        <IsoBlock a={[-34, WALL_Y - 0.4, -0.6]} b={[34, WALL_Y, 34]} u={U} o={O} tones={TILE} />
        <OnPlane y={WALL_Y} u={U} o={O}>
          {Array.from({ length: 17 }, (_, j) => <rect key={`h${j}`} x={-34} y={j * 2 - 0.03} width={68} height={0.06} fill={WHITE} opacity={0.8} />)}
          {Array.from({ length: 34 }, (_, j) => <rect key={`v${j}`} x={-34 + j * 2 - 0.03} y={0} width={0.06} height={34} fill={WHITE} opacity={0.8} />)}
          {/* a darker tile band at the height of the tub's rim */}
          <rect x={-34} y={TUB.h + 0.5} width={68} height={0.5} fill={MINT.floorEdge} opacity={0.7} />
        </OnPlane>
        {/* the towel on its rail (a dressing piece on the wall, 54 cm long) */}
        <IsoBlock a={[TOWEL.x0 - 0.4, WALL_Y, TOWEL.z1]} b={[TOWEL.x1 + 0.4, WALL_Y + 0.35, TOWEL.z1 + 0.2]} u={U} o={O} tones={ISO.metal} />
        <IsoBlock a={[TOWEL.x0, WALL_Y + 0.05, TOWEL.z0]} b={[TOWEL.x1, WALL_Y + 0.3, TOWEL.z1]} u={U} o={O} tones={ISO.stone} />
        <IsoBlock a={[TOWEL.x0, WALL_Y + 0.3, TOWEL.z0 + 0.7]} b={[TOWEL.x1, WALL_Y + 0.32, TOWEL.z0 + 1.0]} u={U} o={O} tones={ISO.metal} />
        {/* the floor, with its tile joints */}
        <IsoBlock a={[-34, WALL_Y, -0.6]} b={[34, 30, 0]} u={U} o={O} tones={ISO.floor} />
        {Array.from({ length: 16 }, (_, j) => <polyline key={`fx${j}`} points={ptsAttr([W([-34, WALL_Y + j * 2, 0]), W([34, WALL_Y + j * 2, 0])])} fill="none" stroke={WHITE} strokeWidth={4} opacity={0.6} />)}
        {Array.from({ length: 34 }, (_, j) => <polyline key={`fy${j}`} points={ptsAttr([W([-34 + j * 2, WALL_Y, 0]), W([-34 + j * 2, 30, 0])])} fill="none" stroke={WHITE} strokeWidth={4} opacity={0.6} />)}

        {/* the bathtub: the shell, the inside, the water with foam that bobs */}
        <IsoBlock a={[TUB.x0, TUB.y0, 0]} b={[TUB.x1, TUB.y1, TUB.h]} u={U} o={O} tones={ISO.plastic} />
        <polygon points={rectZ(TUB.ix0, TUB.ix1, TUB.iy0, TUB.iy1, TUB.h)} fill={ISO.plastic[1]} />
        <g clipPath={`url(#${tubId})`}>
          <Polys polys={block([TUB.ix0, TUB.iy0, 0], [TUB.ix1, TUB.iy1, TUB.water], U, O)} tones={ISO.water} />
          {FOAM.map((f, i) => { const p = W([f[0], f[1], TUB.water]); return <circle key={i} cx={p[0]} cy={p[1] + bobPx(t, i / 7, 5)} r={(0.32 + (i % 3) * 0.12) * U * (1 + 0.05 * Math.sin(t * 1.3 + i))} fill={WHITE} opacity={0.92} />; })}
        </g>
        <polygon points={rectZ(TUB.ix0, TUB.ix1, TUB.iy0, TUB.iy1, TUB.h)} fill="none" stroke={WHITE} strokeWidth={5} strokeLinejoin="round" />

        {/* the soap dish and the soap bar on the deck */}
        <IsoBlock a={[DISH.x0, DISH.y0, TUB.h]} b={[DISH.x1, DISH.y1, TUB.h + 0.15]} u={U} o={O} tones={ISO.metal} />
        <IsoBlock a={[DISH.x0 + 0.15, DISH.y0 + 0.2, TUB.h + 0.15]} b={[DISH.x1 - 0.15, DISH.y1 - 0.2, TUB.h + 0.45]} u={U} o={O} tones={ISO.brain} />

        {/* the pot of bubble solution; its liquid turns pink when the dye drops in */}
        <Polys polys={cylinder([POT.x, POT.y, TUB.h], [POT.x, POT.y, potTop], POT.r, POT.r, AXX, AYY, U, O)} tones={ISO.plastic} />
        <Polys polys={cylinder([POT.x, POT.y, TUB.h + 0.35], [POT.x, POT.y, TUB.h + 0.7], POT.r + 0.01, POT.r + 0.01, AXX, AYY, U, O)} tones={ISO.leaf} />
        {(() => { const c = W([POT.x, POT.y, potTop - 0.05]); return <g>
          <ellipse cx={c[0]} cy={c[1]} rx={POT.r * U * 0.87} ry={POT.r * U * 0.5} fill={ISO.water[0]} />
          <ellipse cx={c[0]} cy={c[1]} rx={POT.r * U * 0.87} ry={POT.r * U * 0.5} fill={ISO.brain[1]} opacity={tint} />
          <ellipse cx={c[0]} cy={c[1]} rx={POT.r * U * 0.87} ry={POT.r * U * 0.5} fill="none" stroke={WHITE} strokeWidth={4} />
        </g>; })()}
        {/* the wand: a stick in the pot and a ring that rises to blow a new bubble */}
        {(() => { const a = W([POT.x, POT.y, potTop - 0.1]), b = W([ring[0], ring[1], ring[2] - 0.36]); return <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={ISO.organ[1]} strokeWidth={0.09 * U} strokeLinecap="round" />; })()}
        <OnPlane y={POT.y} u={U} o={O}>
          <circle cx={POT.x} cy={ring[2]} r={0.34} fill={WHITE} opacity={0.18} stroke={ISO.organ[1]} strokeWidth={0.08} />
        </OnPlane>

        {/* the pipette of dye: slides in from above, lets one drop go, slides out */}
        {pip > 0.01 && <g>
          <Polys polys={cylinder([POT.x, POT.y, tipZ], [POT.x, POT.y, tipZ + 1.4], 0.06, 0.12, AXX, AYY, U, O, 24)} tones={ISO.plastic} />
          <Polys polys={cylinder([POT.x, POT.y, tipZ + 1.4], [POT.x, POT.y, tipZ + 2.0], 0.2, 0.2, AXX, AYY, U, O, 24)} tones={ISO.organ} />
        </g>}
        {drop >= 0 && (() => { const p = W([POT.x, POT.y, potTop + 1.1 - drop * 1.15]); return <circle cx={p[0]} cy={p[1]} r={0.1 * U} fill={ISO.brain[1]} />; })()}

        {/* the hero: the soap bubble */}
        {bub.on && <Bubble c={[bc[0], bc[1] + bob]} r={br} t={t} drain={bub.drain} black={bub.black} lit={contour >= 0 ? contour + 1 : -1} />}
        {/* the burst: a ring that flies apart and droplets that fall */}
        {burst >= 0 && <g opacity={1 - burst}>
          <circle cx={bc[0]} cy={bc[1] + bob} r={br * (1 + 0.5 * easeOut(burst))} fill="none" stroke={WHITE} strokeWidth={10} strokeDasharray="30 46" />
          {Array.from({ length: 12 }, (_, j) => { const a = (j / 12) * Math.PI * 2; const d = br * (0.9 + 0.6 * burst); return <circle key={j} cx={bc[0] + Math.cos(a) * d} cy={bc[1] + bob + Math.sin(a) * d + 500 * burst * burst} r={9} fill={ISO.water[0]} />; })}
        </g>}
        {/* the drain: the water runs down the film (arrows), the film evaporates at the top (wisps) */}
        {grav > 0.01 && [-0.86, 0.86].map((side, i) => (
          <g key={i} opacity={grav}>
            {[0, 1, 2].map((j) => { const k = riseAt(t, j / 3, 1.2); const a = -0.5 + k * 1.0; return <circle key={j} cx={bc[0] + side * br * Math.sqrt(1 - a * a) * 0.98} cy={bc[1] + bob + a * br} r={10} fill={ISO.water[1]} opacity={Math.sin(Math.PI * k)} />; })}
          </g>
        ))}
        {vap > 0.01 && [-0.3, 0, 0.3].map((u, i) => {
          const k = riseAt(t, i / 3, 1.8);
          const x = bc[0] + u * br + 18 * Math.sin(t * 2 + i), y0 = bc[1] + bob - br * 0.95 - k * 160;
          return <path key={i} d={`M ${x} ${y0 + 60} q 18 -30 0 -60`} fill="none" stroke={ISO.water[0]} strokeWidth={9} strokeLinecap="round" opacity={vap * Math.sin(Math.PI * k)} />;
        })}
      </g>

      {/* the near layer: small loose bubbles and dust that drift up (they touch nothing) */}
      <g transform={layerTransform(cam, 1.25)}>
        {[[180, 0.1, 22], [880, 0.35, 16], [300, 0.6, 12], [760, 0.8, 26], [520, 0.45, 10]].map(([x, k0, r], i) => {
          const k = riseAt(t, k0, 9);
          return <circle key={i} cx={x + 30 * Math.sin(t * 0.7 + i)} cy={1900 - k * 1600} r={r} fill={WHITE} opacity={0.18} stroke={WHITE} strokeWidth={3} />;
        })}
        <Motes t={t} color={WHITE} opacity={0.3} n={10} />
      </g>

      {/* the lens (the pantul beat): inside the film, light reflects from its outer and its inner surface */}
      {lk > 0.01 && <g>
        <defs><clipPath id={lensId}><circle cx={lc[0]} cy={lc[1]} r={LENS_R * lk} /></clipPath></defs>
        <g clipPath={`url(#${lensId})`}>
          <Lab clock={clock} />
          {(() => {
            const [cx, cy] = LENS_C, top = cy - 70, bot = cy + 70;
            const curve = (y: number) => `M ${cx - 420} ${y + 30} Q ${cx} ${y - 30} ${cx + 420} ${y + 30}`;
            const p0: P2 = [cx - 330, cy - 360], p1: P2 = [cx - 110, top - 1], p2: P2 = [cx - 30, bot - 1], p3: P2 = [cx + 50, top - 1];
            const r1: P2 = [cx + 110, cy - 360], r2: P2 = [cx + 270, cy - 360];
            const seg = (a: P2, b: P2, k: number, color: string, sw: number, op = 1) => k > 0.01 ? <line x1={a[0]} y1={a[1]} x2={a[0] + (b[0] - a[0]) * k} y2={a[1] + (b[1] - a[1]) * k} stroke={color} strokeWidth={sw} strokeLinecap="round" strokeDasharray="34 16" strokeDashoffset={-clock * 120} opacity={op} /> : null;
            return <g>
              <path d={`${curve(top)} L ${cx + 420} ${bot + 30} Q ${cx} ${bot - 30} ${cx - 420} ${bot + 30} Z`} fill={ISO.water[0]} opacity={0.55} />
              <path d={curve(top)} fill="none" stroke={WHITE} strokeWidth={7} />
              <path d={curve(bot)} fill="none" stroke={WHITE} strokeWidth={7} />
              {seg(p0, p1, rays[0], WHITE, 12)}
              {seg(p1, r1, rays[1], ISO.sun[0], 12)}
              {seg(p1, p2, rays[2] > 0 ? Math.min(1, rays[2] * 2) : 0, WHITE, 8, 0.7)}
              {seg(p2, p3, rays[2] > 0.5 ? (rays[2] - 0.5) * 2 : 0, WHITE, 8, 0.7)}
              {seg(p3, r2, rays[3], ISO.brain[0], 12)}
              {rays[1] > 0.6 && <g transform={`translate(0 ${(1 - springAt(clock, P.m.pantul + 2.5)) * 20})`}><Badge text="1" x={r1[0] - 50} y={r1[1] + 70} r={34} /></g>}
              {rays[3] > 0.6 && <g transform={`translate(0 ${(1 - springAt(clock, P.m.pantul + 5.1)) * 20})`}><Badge text="2" x={r2[0] + 30} y={r2[1] + 90} r={34} /></g>}
              {clock > P.m.pantul + 2.2 && <Label text="permukaan luar" x={cx + 230} y={top - 30} fs={36} color="white" t={clock} start={P.m.pantul + 2.2} />}
              {clock > P.m.pantul + 4.0 && <Label text="permukaan dalam" x={cx + 60} y={bot + 90} fs={40} color="white" t={clock} start={P.m.pantul + 4.0} />}
            </g>;
          })()}
        </g>
        <circle cx={lc[0]} cy={lc[1]} r={LENS_R * lk} fill="none" stroke={WHITE} strokeWidth={10} />
      </g>}

      {/* the two wave cards (the tabrak beat): in step they add up, out of step they cancel */}
      {wa > 0.01 && <g opacity={wa} transform={`translate(${(1 - wa) * 40} 0)`}>
        <rect x={590} y={600} width={330} height={250} rx={28} fill={WHITE} opacity={0.94} />
        <Wave x0={615} x1={895} y={650} amp={14} ph={-clock * 4} color={ISO.water[1]} sw={6} />
        <Wave x0={615} x1={895} y={690} amp={14} ph={-clock * 4} color={ISO.water[1]} sw={6} />
        <Wave x0={615} x1={895} y={752} amp={28} ph={-clock * 4} color={ISO.water[2]} sw={11} />
      </g>}
      {wb > 0.01 && <g opacity={wb} transform={`translate(${(1 - wb) * 40} 0)`}>
        <rect x={590} y={880} width={330} height={250} rx={28} fill={WHITE} opacity={0.94} />
        <Wave x0={615} x1={895} y={930} amp={14} ph={-clock * 4} color={HOT2} sw={6} />
        <Wave x0={615} x1={895} y={970} amp={14} ph={-clock * 4 + Math.PI} color={HOT2} sw={6} />
        <Wave x0={615} x1={895} y={1032} amp={1.5} ph={0} color={G3} sw={11} />
      </g>}

      {/* the thickness wedge beside the bubble (the tebal beat): thin at the top, thick at the bottom, in the film's colours */}
      {wedge > 0.01 && <g opacity={wedge} transform={`translate(${(1 - wedge) * 30} 0)`}>
        {BANDS.map((col, k) => {
          const y0 = 640 + (k * 620) / BANDS.length, y1 = 640 + ((k + 1) * 620) / BANDS.length, w0 = 6 + 64 * (k / BANDS.length), w1 = 6 + 64 * ((k + 1) / BANDS.length);
          return <polygon key={k} points={`${880 - w0 / 2},${y0} ${880 + w0 / 2},${y0} ${880 + w1 / 2},${y1} ${880 - w1 / 2},${y1}`} fill={col} opacity={k === 0 ? 0.6 : 0.9} />;
        })}
        <polygon points={`877,640 883,640 915,1260 845,1260`} fill="none" stroke={BLACK} strokeWidth={3} opacity={0.5} />
      </g>}

      {/* labels on the parts (they follow the camera) */}
      {P.labels.map((l) => {
        if (clock < l.from - 0.05 || clock > l.to + 0.4) return null;
        const p = FIXED[l.id] ?? P.screen(clock, l.at);
        const x = Math.max(300, Math.min(780, p[0])), y = Math.max(420, Math.min(1380, p[1]));
        return <g key={l.id} opacity={1 - clamp01((clock - l.to) / 0.3)}><Label text={l.text} x={FIXED[l.id] ? p[0] : x} y={FIXED[l.id] ? p[1] : y} fs={l.id === "kuat" || l.id === "hapus" ? 40 : 46} t={clock} start={l.from} /></g>;
      })}

      {/* the tips over the set */}
      {P.tipCards.map((c) => <TipCard key={c.n} x={110} y={c.n === 1 ? 1130 : 1330} w={810} n={c.n} title={c.title} sub={c.sub} t={clock} start={c.from} subAt={c.subAt} end={P.m.outro} />)}
    </svg>
  );
};

const Scene = ({ beat, t, clock, story: s }: SceneProps) => (
  <div style={{ position: "absolute", inset: 0, width: 1080, height: 1920 }}>
    <Picture story={s} clock={clock} />
    <svg width={1080} height={1920} viewBox="0 0 1080 1920" style={{ position: "absolute", inset: 0 }}>
      {beat.kind !== "sting" && beat.kind !== "outro" && <TopText kicker={beat.kicker} headline={beat.headline ?? beat.text} t={t} />}
      {beat.kind === "sting" && (() => {
        const p = springAt(t, 0), out = 1 - easeInOut(clamp01((t - 0.75) / 0.25));
        return <g>
          <g transform={`translate(540 720) scale(${Math.max(0, p) * out}) translate(-540 -720)`}><Mascot x={540} y={720} w={220} expr="curious" t={t} squash={0.18 * (1 - p)} /></g>
          <g opacity={out}><Pill text="Intip yuk!" x={540} y={1489} fs={56} t={t} start={0.2} /></g>
        </g>;
      })()}
      {beat.kind !== "sting" && beat.kind !== "outro" && <CaptionLayer beat={beat} t={t} />}
    </svg>
  </div>
);

export const Video: React.FC<{ story: StoryT; layoutDebug?: boolean }> = (p) => <StoryVideo story={p.story} scene={Scene} layoutDebug={p.layoutDebug} />;
