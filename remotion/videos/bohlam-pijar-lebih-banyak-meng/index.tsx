/* Bohlam pijar: lampu atau pemanas? — a custom video (videos/bohlam-pijar-lebih-banyak-meng/). READ remotion/DESIGN.md FIRST.
   One set (B27): a wall and a dark table (they run past every edge of the frame), the bare bulb on its stand is the hero, drawn in the iso kit from src/iso.ts (a glass bulb of
   stacked cones, a screw cap, a filament that glows). The dressing is a coffee cup (alive), a pile of books and an air conditioner on the wall. The camera is a function of the
   video's clock (plan.ts camAt): a wide shot, the establishing push, a push or a pan per beat, and the way back to the wide shot in the outro.
   What the video shows: the filament is heated by the current until it glows; of the 25 squares of energy only one turns into light and 24 into heat (red); invisible infrared
   rings; the LED beside it (same light, a little warm); the heat that adds to the air conditioner's load. Every word comes from the checked story. Colours are tokens (ISO tone sets). */
import React from "react";
import {
  BLACK, Brand, CaptionLayer, HOT1, HOT2, ISO, IsoAir, IsoCup, Label, Mascot, Polys, RED, StoryVideo, TopText, WHITE, YELLOW, YELLOW_D, G2, G3,
  block, cylinder, easeInOut, isoAt, layerTransform, springAt, toScreen,
  type P2, type P3, type SceneProps, type StoryT, type Tones,
} from "../../src/design/index.ts";
import { HeatRise } from "../../src/components/Iso.tsx";
import { AC_BOX, BAR, BOOKS_AT, BULB_R, BULB_ZC, CLOCK_AT, LED_AT, O, U, WALL_Y, camAt, makePlan, stateAt, world } from "./plan.ts";
import storyJson from "./story.json";

export const story = storyJson as unknown as StoryT;

const TAU = Math.PI * 2;
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const AX = [1, 0, 0] as const, AY = [0, 1, 0] as const;
const post = (x: number, y: number, z0: number, z1: number, r0: number, r1: number, u: number, o: P2) => cylinder([x, y, z0], [x, y, z1], r0, r1, AX, AY, u, o);

const HOT_TONES: Tones = [HOT1, HOT2, RED];                 // heat: light, mid, dark
const TABLE: Tones = ISO.dark;                              // a dark table: neutral, no yellow-looking wood
const CERAMIC: Tones = ISO.plastic;

// ------------------------------------------------------------------------------------------------------ the bulb (new asset 1; a variant for the LED)
/** The glass: [z, radius] of the stacked cones, from the neck to the crown (the incandescent is a pear, the LED a rounder, shorter dome). */
const GLASS: readonly (readonly [number, number])[] = [[3.1, 0.5], [3.5, 0.62], [3.9, 0.95], [4.2, 1.2], [4.5, 1.38], [5.0, 1.45], [5.5, 1.38], [5.9, 1.2], [6.2, 0.92], [6.4, 0.5], [6.45, 0.25]];

/** The filament's path in the plane y = 0 (x, z): two lead wires up from the cap and a zigzag coil between them. */
const FIL_PATH: P3[] = [[-0.22, 0, 3.3], [-0.22, 0, 4.55], ...Array.from({ length: 10 }, (_, i) => [-0.36 + 0.08 * i, 0, i % 2 ? 4.88 : 4.58] as P3), [0.22, 0, 4.55], [0.22, 0, 3.3]];

/** The glass's profile sampled smoothly: [z, radius] every 0.1 between the key rings of GLASS (eased, so the outline has no corners). */
const glassProfile = (): [number, number][] => {
  const out: [number, number][] = [];
  for (let i = 1; i < GLASS.length; i++) {
    const [z0, r0] = GLASS[i - 1], [z1, r1] = GLASS[i], n = Math.max(2, Math.round((z1 - z0) / 0.1));
    for (let k = i === 1 ? 0 : 1; k <= n; k++) { const q = k / n, e = q * q * (3 - 2 * q) * 0.5 + q * 0.5; out.push([z0 + (z1 - z0) * q, r0 + (r1 - r0) * e]); }
  }
  return out;
};

const along = (pts: readonly P2[], s: number): P2 => {
  const lens = pts.slice(1).map((p, i) => Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1])), total = lens.reduce((a, b) => a + b, 0);
  let d = clamp01(s) * total;
  for (let i = 0; i < lens.length; i++) { if (d <= lens[i]) { const q = d / (lens[i] || 1); return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * q, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * q]; } d -= lens[i]; }
  return pts[pts.length - 1];
};

/** The incandescent bulb on its stand. `glow` 0..1 is how hot the filament is (cold grey, then orange, then yellow-white); `current` 0..1 shows the dots of the current in the wire. */
const Bulb: React.FC<{ u: number; o: P2; glow: number; current: number; clock: number; led?: boolean }> = ({ u, o, glow, current, clock, led = false }) => {
  const P = (x: number, y: number, z: number) => isoAt([x, y, z], u, o);
  const c = P(0, 0, BULB_ZC), pulse = 1 + 0.04 * Math.sin((TAU * clock) / 3);      // 3 s divides 60 s: the loop-back matches
  const fil = FIL_PATH.map((p) => P(p[0], p[1], p[2]));
  const hot = glow > 0.6 ? YELLOW : glow > 0.15 ? HOT2 : G2;
  const glass = led ? 0.95 : 0.3;
  return (
    <g>
      {/* the stand: a foot, a stem, a ceramic socket and the metal screw cap */}
      <Polys polys={post(0, 0, 0, 0.35, 1.1, 1.0, u, o)} tones={ISO.dark} />
      <Polys polys={post(0, 0, 0.35, 2.0, 0.15, 0.15, u, o)} tones={ISO.metal} />
      <Polys polys={post(0, 0, 2.0, 2.6, 0.62, 0.58, u, o)} tones={CERAMIC} />
      <Polys polys={post(0, 0, 2.6, 3.15, 0.5, 0.5, u, o)} tones={ISO.metal} />
      {[2.78, 2.96].map((z) => <Polys key={z} polys={post(0, 0, z, z + 0.07, 0.505, 0.505, u, o)} tones={ISO.dark} />)}
      {/* the light inside the glass (behind the glass faces) */}
      {!led && glow > 0.02 && <ellipse cx={c[0]} cy={c[1] - u * 0.1} rx={u * 2.0 * pulse} ry={u * 2.0 * pulse} fill={YELLOW} opacity={0.22 * glow} />}
      {!led && glow > 0.02 && <ellipse cx={c[0]} cy={c[1] - u * 0.05} rx={u * 1.3} ry={u * 1.3} fill={YELLOW} opacity={0.4 * glow} />}
      {led && <ellipse cx={c[0]} cy={c[1]} rx={u * 1.6 * pulse} ry={u * 1.6 * pulse} fill={YELLOW} opacity={0.18} />}
      {/* the filament: two leads and a coil (cold grey, orange, then yellow while it heats) */}
      {!led && <g>
        <polyline points={fil.map((p) => p.join(",")).join(" ")} fill="none" stroke={hot} strokeWidth={u * 0.07} strokeLinejoin="round" strokeLinecap="round" />
        {glow > 0.6 && <polyline points={fil.map((p) => p.join(",")).join(" ")} fill="none" stroke={WHITE} strokeWidth={u * 0.018} strokeLinejoin="round" strokeLinecap="round" opacity={glow} />}
        {current > 0.02 && Array.from({ length: 7 }, (_, i) => { const q = along(fil, (((clock * 0.35 + i / 7) % 1) + 1) % 1); return <circle key={i} cx={q[0]} cy={q[1]} r={u * 0.07} fill={YELLOW} opacity={current} />; })}
      </g>}
      {/* the glass: one silhouette (the envelope of the stacked cones), see-through for the incandescent, milky for the LED; the right side is the dark tone, the left the light one */}
      {(() => {
        const prof = glassProfile(), L = prof.map(([z, r]) => { const q = P(0, 0, z); return [q[0] - r * u * 1.2247, q[1]] as P2; }), R = prof.map(([z, r]) => { const q = P(0, 0, z); return [q[0] + r * u * 1.2247, q[1]] as P2; });
        const Rin = prof.map(([z, r]) => { const q = P(0, 0, z); return [q[0] + r * u * 0.62, q[1]] as P2; });
        const poly = (pts: readonly P2[]) => pts.map((q) => q.join(",")).join(" ");
        return <g>
          <polygon points={poly([...L, ...[...R].reverse()])} fill={ISO.plastic[0]} opacity={glass} />
          <polygon points={poly([...Rin, ...[...R].reverse()])} fill={ISO.plastic[2]} opacity={glass * 0.7} />
          <polygon points={poly([...L, ...[...R].reverse()])} fill="none" stroke={ISO.plastic[2]} strokeWidth={u * 0.03} strokeLinejoin="round" />
        </g>;
      })()}
      {led && <g>
        {[3.2, 3.4, 3.6].map((z) => <Polys key={z} polys={post(0, 0, z, z + 0.08, 0.62, 0.62, u, o)} tones={ISO.metal} />)}
        <circle cx={P(0, 0, 5.1)[0]} cy={P(0, 0, 5.1)[1]} r={u * 0.28} fill={YELLOW} opacity={0.85} />
      </g>}
      {/* the shine on the glass */}
      <path d={`M ${P(-0.9, 0.5, 5.6).join(" ")} Q ${P(-1.15, 0.6, 4.9).join(" ")} ${P(-0.8, 0.9, 4.2).join(" ")}`} fill="none" stroke={WHITE} strokeWidth={u * 0.07} strokeLinecap="round" opacity={0.7} />
    </g>
  );
};

/** Rays of visible light round the bulb (yellow = light). Short: only a little of the energy becomes light. */
const Rays: React.FC<{ cx: number; cy: number; r: number; k: number; clock: number; long?: number }> = ({ cx, cy, r, k, clock, long = 1 }) => {
  if (k < 0.03) return null;
  return (
    <g opacity={k} strokeLinecap="round">
      {Array.from({ length: 14 }, (_, i) => {
        const a = (i / 14) * TAU + 0.2, len = (i % 2 ? 46 : 78) * long * (1 + 0.1 * Math.sin((TAU * clock) / 3 + i)), r0 = r * 1.18;
        return <line key={i} x1={cx + Math.cos(a) * r0} y1={cy + Math.sin(a) * r0 * 0.92} x2={cx + Math.cos(a) * (r0 + len)} y2={cy + Math.sin(a) * (r0 + len) * 0.92} stroke={YELLOW_D} strokeWidth={9} />;
      })}
    </g>
  );
};

/** The infrared, drawn as dashed rings that spread from the bulb and fade (it cannot be seen, so it is only a dashed outline). */
const InfraRings: React.FC<{ cx: number; cy: number; r: number; k: number; clock: number }> = ({ cx, cy, r, k, clock }) => {
  if (k < 0.03) return null;
  return (
    <g fill="none" stroke={HOT2} strokeWidth={7} strokeLinecap="round" strokeDasharray="4 22">
      {[0, 1, 2].map((i) => { const ph = (((clock / 2.5 + i / 3) % 1) + 1) % 1; return <ellipse key={i} cx={cx} cy={cy} rx={r * (1 + 1.3 * ph)} ry={r * 0.95 * (1 + 1.3 * ph)} opacity={k * Math.sin(Math.PI * ph)} />; })}
    </g>
  );
};

// ------------------------------------------------------------------------------------------------------ the energy squares (new asset 2)
const barCell = (i: number, j: number): P3 => [BAR.x0 + i * (BAR.cell + BAR.gap), BAR.y0 + j * (BAR.cell + BAR.gap), 0];
const YELLOW_CELL = { i: 4, j: 0 };                         // the one square that becomes light (1 of 25 is 4 %: "kurang dari 5 persen")
const cellOrder = (i: number, j: number) => (i === YELLOW_CELL.i && j === YELLOW_CELL.j ? 0 : 1 + ((i * 7 + j * 3) % 24) + 0.01 * i);

/** 25 low blocks in a 5 x 5 grid: grey = electricity going in; then 24 turn into heat (orange/red) and one into light (yellow). */
const EnergyBar: React.FC<{ u: number; o: P2; show: number; conv: number; startConv: number; clock: number }> = ({ u, o, show, conv, startConv, clock }) => {
  if (show < 0.02) return null;
  const cells: { i: number; j: number; d: number }[] = [];
  for (let s = 0; s <= 2 * (BAR.n - 1); s++) for (let i = 0; i < BAR.n; i++) { const j = s - i; if (j >= 0 && j < BAR.n) cells.push({ i, j, d: s }); }
  return (
    <g>
      {cells.map(({ i, j, d }) => {
        const [x, y] = barCell(i, j), order = cellOrder(i, j), at = startConv + (order / 25) * 3.2;
        const k = clamp01((clock - at) / 0.35), turned = k > 0.5;
        const enter = clamp01(show * 1.4 - d * 0.03), h = (0.3 + 0.25 * Math.sin(Math.PI * clamp01(k))) * enter;
        const isLight = i === YELLOW_CELL.i && j === YELLOW_CELL.j;
        const tones: Tones = turned ? (isLight ? ISO.sun : HOT_TONES) : ISO.metal;
        const bob = turned && !isLight ? 0.06 * Math.sin((TAU * clock) / 3 + i + j) : 0;
        return <Polys key={`${i}-${j}`} polys={block([x, y, 0], [x + BAR.cell, y + BAR.cell, Math.max(0.02, h + bob)], u, o)} tones={tones} />;
      })}
    </g>
  );
};

// ------------------------------------------------------------------------------------------------------ the dressing
const Books: React.FC<{ u: number; o: P2 }> = ({ u, o }) => (
  <g>
    <Polys polys={block([BOOKS_AT[0], BOOKS_AT[1], 0], [BOOKS_AT[0] + 2.3, BOOKS_AT[1] + 1.6, 0.5], u, o)} tones={ISO.labPlastic} />
    <Polys polys={block([BOOKS_AT[0] + 0.1, BOOKS_AT[1] + 0.1, 0.5], [BOOKS_AT[0] + 2.1, BOOKS_AT[1] + 1.45, 0.95], u, o)} tones={ISO.dark} />
    <Polys polys={block([BOOKS_AT[0] + 0.25, BOOKS_AT[1] + 0.15, 0.95], [BOOKS_AT[0] + 2.2, BOOKS_AT[1] + 1.5, 1.35], u, o)} tones={ISO.metal} />
  </g>
);

const AirCon: React.FC<{ u: number; o: P2; load: number; clock: number }> = ({ u, o, load, clock }) => {
  const a = AC_BOX.a, b = AC_BOX.b, P = (x: number, y: number, z: number) => isoAt([x, y, z], u, o);
  const vent = P((a[0] + b[0]) / 2, b[1], a[2] + 0.1);
  return (
    <g>
      <Polys polys={block(a, b, u, o)} tones={ISO.metal} />
      <Polys polys={block([a[0] + 0.3, b[1], a[2] + 0.12], [b[0] - 0.3, b[1] + 0.06, a[2] + 0.34], u, o)} tones={ISO.dark} />
      {[0.6, 0.9, 1.2].map((dz) => <Polys key={dz} polys={block([a[0] + 0.3, b[1], a[2] + dz + 0.1], [b[0] - 0.3, b[1] + 0.03, a[2] + dz + 0.16], u, o)} tones={ISO.labPlastic} />)}
      <circle cx={P(b[0] - 0.45, b[1] + 0.04, b[2] - 0.35)[0]} cy={P(b[0] - 0.45, b[1] + 0.04, b[2] - 0.35)[1]} r={u * 0.08} fill={G3} />
      <IsoAir x={vent[0] - u * 0.3} y={vent[1] + u * 0.1} len={u * (1.4 + 0.5 * load)} t={clock * (0.7 + 0.8 * load)} n={2 + Math.round(3 * load)} w={9} />
    </g>
  );
};

// ------------------------------------------------------------------------------------------------------ the picture
const Picture: React.FC<SceneProps> = ({ beat, t, clock, story: s }) => {
  const P = React.useMemo(() => makePlan(s), [s]);
  const m = P.m, st = stateAt(clock), cam = camAt(clock), top = P.tops.find((x) => clock >= x.a && clock < x.b);
  const o = O, u = U;
  const ledP = easeInOut(st.led), ledS = 0.15 + 0.85 * ledP;
  const bulbC = world([0, 0, BULB_ZC]);
  const lastBeat = beat.kind === "outro";
  // labels (screen px, placed through the camera so they stay on their part): the filament, the light and the heat
  const at = (p: P3): P2 => toScreen(cam, world(p));
  const filL = at([0.5, 0, 4.9]), yc = barCell(YELLOW_CELL.i, YELLOW_CELL.j), cellL = at([yc[0] + 0.2, yc[1] + 0.2, 0.6]), hotL = at([BAR.x0 + 0.3, BAR.y0 + 1.2, 0.6]);
  const bt = t;
  return (
    <div style={{ position: "absolute", inset: 0, width: 1080, height: 1920 }}>
      <svg width={1080} height={1920} viewBox="0 0 1080 1920" style={{ position: "absolute", inset: 0 }}>
        {/* the far layer: the brand wall (never seen: the wall of the set covers it, but it keeps the theme behind the set) */}
        <g transform={layerTransform(cam, 0.3)}><Brand clock={clock} spot={{ x: 540, y: 400 }} /></g>
        <g transform={layerTransform(cam, 1)}>
          {/* the wall and the table run past the frame on every side */}
          <Polys polys={block([-90, WALL_Y - 0.6, -14], [90, WALL_Y, 40], u, o)} tones={ISO.wall} />
          <AirCon u={u} o={o} load={st.ac} clock={clock} />
          {[[-13.6, -1.2], [13.2, -1.2], [-13.6, 5.0], [13.2, 5.0]].map(([x, y], i) => <Polys key={i} polys={block([x, y, -14], [x + 0.7, y + 0.7, -0.7], u, o)} tones={TABLE} />)}
          <Polys polys={block([-14, WALL_Y, -0.7], [14, 5.8, 0], u, o)} tones={TABLE} />
          <Books u={u} o={o} />
          <IsoCup u={300} o={world([CLOCK_AT[0], CLOCK_AT[1], 0])} t={clock} />
          {/* the hero: its rays and rings are behind-and-around it, its heat rises above it */}
          <InfraRings cx={bulbC[0]} cy={bulbC[1]} r={BULB_R * u * 1.3} k={st.ir} clock={clock} />
          <Bulb u={u} o={o} glow={st.glow} current={st.current} clock={clock} />
          <Rays cx={bulbC[0]} cy={bulbC[1]} r={BULB_R * u * 1.1} k={st.glow} clock={clock} />
          <g>
            {[-1, 0, 1].map((i) => <HeatRise key={i} x={bulbC[0] + i * 120} y={bulbC[1] - BULB_R * u * 1.1 + Math.abs(i) * 60} k={st.heat * (i ? 0.8 : 1)} t={clock + i * 0.4} scale={1.25} />)}
          </g>
          {/* the heat that reaches the air conditioner (it adds to its load) */}
          {st.near > 0.02 && <HeatRise x={world([-11.6, -1.2, 4.4])[0]} y={world([-11.6, -1.2, 4.4])[1] + 40} k={st.near} t={clock} scale={0.9} />}
          <EnergyBar u={u} o={o} show={st.bar} conv={st.conv} startConv={m.convStart} clock={clock} />
          {/* the LED bulb beside it: the same light, little heat */}
          {ledP > 0.01 && (() => {
            const lo = world([LED_AT[0], LED_AT[1], 0]), lc = isoAt([0, 0, BULB_ZC], u, lo);
            return (
              <g transform={`translate(${lo[0]} ${lo[1]}) scale(${ledS}) translate(${-lo[0]} ${-lo[1]})`} opacity={ledP}>
                <Bulb u={u} o={lo} glow={1} current={0} clock={clock} led />
                <Rays cx={lc[0]} cy={lc[1]} r={BULB_R * u * 1.1} k={1} clock={clock} long={1.0} />
                <HeatRise x={lc[0]} y={lc[1] - BULB_R * u * 1.1} k={0.18} t={clock} scale={0.8} />
              </g>
            );
          })()}
        </g>
        {/* labels on their parts */}
        {beat.id === "listrik" && bt > 6.2 && bt < 10.8 && <Label text="filamen" x={Math.min(900, filL[0] + 230)} y={filL[1] - 40} fs={46} t={t} start={6.3} />}
        {beat.id === "panas" && bt > 3.2 && bt < 7.6 && <Label text="cahaya" x={Math.min(920, cellL[0] + 190)} y={cellL[1] - 60} fs={46} t={t} start={3.3} />}
        {beat.id === "panas" && bt > 5.0 && bt < 7.8 && <Label text="panas" color="red" x={Math.max(180, hotL[0] - 190)} y={hotL[1] - 30} fs={50} t={t} start={5.1} />}

        {/* the mascot: the small "Intip yuk!" sting (no veil: the world keeps moving behind it) */}
        {clock >= m.sting - 0.1 && clock < m.stingEnd + 0.15 && (() => {
          const p = springAt(clock, m.sting), out2 = 1 - easeInOut(clamp01((clock - m.stingEnd + 0.18) / 0.25));
          const mx = 400, my = 440, px = 700, py = 440, pillW = 300;
          return <g>
            <g transform={`translate(${mx} ${my}) scale(${Math.max(0, p) * out2}) translate(${-mx} ${-my})`}><Mascot x={mx} y={my} w={200} expr="curious" t={clock - m.sting} clock={clock} squash={0.18 * (1 - p)} /></g>
            <g transform={`translate(${px} ${py}) scale(${Math.max(0, springAt(clock, m.sting + 0.25)) * out2}) translate(${-px} ${-py})`}>
              <rect x={px - pillW / 2} y={py - 46} width={pillW} height={92} rx={46} fill={YELLOW} />
              <text x={px} y={py + 18} fontSize={52} textAnchor="middle" fill={BLACK} style={{ fontFamily: '"Outfit", sans-serif', fontWeight: 700 }}>Intip yuk!</text>
            </g>
          </g>;
        })()}

        {/* the channel's text: the kicker and headline at the top, the caption at the bottom */}
        {top && <TopText key={`${top.a}`} kicker={top.kicker} headline={top.headline} t={clock - top.a} />}
        {!lastBeat && beat.kind !== "sting" && <CaptionLayer beat={beat} t={t} />}
      </svg>
    </div>
  );
};

export const Video: React.FC<{ story: StoryT; layoutDebug?: boolean }> = (p) => <StoryVideo story={p.story} scene={(sp) => <Picture {...sp} />} layoutDebug={p.layoutDebug} />;
