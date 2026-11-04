/* Teko listrik paling berisik sebelum mendidih — a custom video (videos/teko-listrik-paling-berisik-se/). READ remotion/DESIGN.md FIRST.
   One set (B27): a kitchen wall and a counter that run past every edge of the frame; the electric kettle on its power base is the hero, drawn in the iso kit from src/iso.ts (a tapered
   body, a lid, a spout, a handle, and a water window on the front that is a patch of the body's own surface). The dressing is a cup (alive), two canisters and a wall socket with the
   kettle's cord. The camera is a function of the video's clock (plan.ts camAt): a wide shot, the establishing push, a push or a pan per beat, and the way back to the wide shot.
   What the video shows: the element at the bottom heats the water layer over it; vapour bubbles are born on the element, grow and let go; they rise into cooler water and collapse (a ring,
   a shock arc, a TIK); the collapses are the sound (concentric arcs round the kettle); the sound belongs to the heating-up, before the whole water boils (a wall meter); the modern kettle
   switches itself off (the power lamp). Every word comes from the checked story. Colours are tokens (the ISO tone sets). */
import React from "react";
import {
  BLACK, Brand, CaptionLayer, G1, G2, HOT1, HOT2, ISO, IsoCup, Label, Mascot, NumberLabel, Onomatopoeia, Polys, RED, SourceChip, STEAM, StoryVideo, TopText, WHITE, YELLOW,
  block, cylinder, easeInOut, isoAt, layerTransform, riseAt, smoothPath, springAt, toScreen,
  type P2, type P3, type SceneProps, type StoryT, type Tones,
} from "../../src/design/index.ts";
import { Motes } from "../../src/components/Iso.tsx";
import { CAN_AT, CUP_AT, KETTLE, O, U, WALL_Y, WIN, camAt, makePlan, stateAt, world } from "./plan.ts";
import storyJson from "./story.json";

export const story = storyJson as unknown as StoryT;

const TAU = Math.PI * 2;
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const smooth = (k: number) => { const c = clamp01(k); return c * c * (3 - 2 * c); };
const AX = [1, 0, 0] as const, AY = [0, 1, 0] as const;
const post = (x: number, y: number, z0: number, z1: number, r0: number, r1: number, u: number, o: P2) => cylinder([x, y, z0], [x, y, z1], r0, r1, AX, AY, u, o);
/** The side of a cylinder without its cap: a band round a body must not paint a lid over what is under it. */
const band = (polys: ReturnType<typeof cylinder>) => polys.slice(0, -1);
const pts = (p: readonly P2[]) => p.map((q) => `${q[0].toFixed(1)},${q[1].toFixed(1)}`).join(" ");

const HOT_TONES: Tones = [HOT1, HOT2, RED];                 // heat: light, mid, dark
const COUNTER_TOP: Tones = ISO.floor;                       // neutral counter top (yellow is current)
const CABINET: Tones = ISO.dark;

// ------------------------------------------------------------------------------------------------------ the kettle (new asset 1)
const radiusAt = (z: number): number => KETTLE.rBase + (KETTLE.rTop - KETTLE.rBase) * clamp01((z - KETTLE.z0) / (KETTLE.z1 - KETTLE.z0));
/** A point on the kettle's front surface: `a` 0..1 across the window (left to right), `b` 0..1 up it. The window is a patch of the body, so it bends with it. */
const winPt = (a: number, b: number, u: number, o: P2): P2 => {
  const th = ((WIN.th1 + (WIN.th0 - WIN.th1) * a) * Math.PI) / 180, z = WIN.z0 + (WIN.z1 - WIN.z0) * b, r = radiusAt(z) + 0.012;
  return isoAt([r * Math.cos(th), r * Math.sin(th), z], u, o) as P2;
};
/** The band of the window between heights b0 and b1, as polygon points. */
const winBand = (b0: number, b1: number, u: number, o: P2, n = 8): string => {
  const out: P2[] = [];
  for (let k = 0; k <= n; k++) out.push(winPt(k / n, b0, u, o));
  for (let k = n; k >= 0; k--) out.push(winPt(k / n, b1, u, o));
  return pts(out);
};

/** The bubbles: eight, each in its own column (spaced so two never overlap: neighbours are a golden-ratio phase apart, all with the same 3 s period that divides 60 s, so the loop-back matches). */
const BUB = Array.from({ length: 8 }, (_, i) => { const c = (i * 3) % 8; return { a: 0.14 + (0.72 * c) / 7, ph: (c * 0.382) % 1, per: 3, r: 0.06 + (0.025 * ((c * 3) % 4)) / 3 }; });
const ELEMENT_B = 0.075;       // the element's top, as a share of the window's height

type Bubble = { a: number; b: number; r: number; op: number; ring: number; ringOp: number };
/** One bubble's life: it grows on the element (0 to 30 %), lets go and rises to `reach` (30 to 85 %), then collapses (85 to 100 %). `burst` is how hard it collapses: with a low
    burst (the bubbles only let go) it just thins away, with a high one it shrinks fast and leaves a ring. */
function bubbleAt(i: number, clock: number, on: number, reach: number, burst: number): Bubble | null {
  const B = BUB[i], vis = clamp01(on * BUB.length - i);
  if (vis <= 0.01) return null;
  const f = (((clock / B.per + B.ph) % 1) + 1) % 1;
  if (f < 0.3) return { a: B.a, b: ELEMENT_B, r: B.r * smooth(f / 0.3), op: vis, ring: 0, ringOp: 0 };
  if (f < 0.85) { const k = (f - 0.3) / 0.55; return { a: B.a + 0.02 * Math.sin(k * 6 + i), b: ELEMENT_B + (reach - ELEMENT_B) * smooth(k), r: B.r * (1 + 0.15 * k), op: vis, ring: 0, ringOp: 0 }; }
  const c = (f - 0.85) / 0.15;
  return { a: B.a, b: reach, r: B.r * 1.15 * (1 - c * (0.15 + 0.85 * burst)), op: vis * (1 - c * (1 - burst)), ring: B.r * (1.1 + 1.8 * c), ringOp: vis * burst * (1 - c) * (burst > 0.35 ? 1 : 0) };
}

const Kettle: React.FC<{ u: number; o: P2; clock: number; st: ReturnType<typeof stateAt> }> = ({ u, o, clock, st }) => {
  const P = (x: number, y: number, z: number) => isoAt([x, y, z], u, o) as P2;
  const wb = (b0: number, b1: number) => winBand(b0, b1, u, o);
  const win = wb(0, 1);
  const lampOn = st.lamp > 0.5;
  const lampAt = P(1.9, 0.17, 3.3);
  const e2: P3 = [0, -0.465, 0.885];
  return (
    <g>
      {/* the power base: a dark disc with a metal rim and the cord's boot */}
      <Polys polys={post(0, 0, 0, 0.5, 1.62, 1.55, u, o)} tones={ISO.dark} />
      <Polys polys={band(post(0, 0, 0.5, 0.62, 1.5, 1.45, u, o))} tones={ISO.metal} />
      {/* the body: a tapered cylinder, a dark band at the foot and at the rim */}
      <Polys polys={post(0, 0, KETTLE.z0, KETTLE.z1, KETTLE.rBase, KETTLE.rTop, u, o)} tones={ISO.labPlastic} />
      <Polys polys={band(post(0, 0, KETTLE.z0, KETTLE.z0 + 0.2, KETTLE.rBase + 0.02, KETTLE.rBase, u, o))} tones={ISO.dark} />
      <Polys polys={band(post(0, 0, KETTLE.z1 - 0.16, KETTLE.z1, KETTLE.rTop + 0.02, KETTLE.rTop + 0.02, u, o))} tones={ISO.dark} />
      {/* the water window, a patch of the body: water, the hot layer over the element, the bubbles, the element itself */}
      <g>
        <defs><clipPath id="kettle-window"><polygon points={win} /></clipPath></defs>
        <polygon points={win} fill={ISO.plastic[2]} />
        <g clipPath="url(#kettle-window)">
          <polygon points={wb(0, 0.9)} fill={ISO.water[0]} />
          <polygon points={wb(0.78, 0.9)} fill={ISO.water[1]} opacity={0.55} />
          <polygon points={wb(0.9, 1)} fill={ISO.plastic[1]} />
          {/* the layer of water just over the element is the hot one */}
          <polygon points={wb(ELEMENT_B, ELEMENT_B + 0.1 + 0.2 * st.layer)} fill={HOT1} opacity={0.85 * st.layer} />
          <polygon points={wb(ELEMENT_B, ELEMENT_B + 0.06 + 0.07 * st.layer)} fill={HOT2} opacity={0.7 * st.layer} />
          <polygon points={wb(0, ELEMENT_B)} fill={ISO.dark[1]} />
          <polygon points={wb(0, ELEMENT_B)} fill={RED} opacity={0.85 * st.heat} />
          <polygon points={wb(ELEMENT_B - 0.012, ELEMENT_B + 0.012)} fill={HOT1} opacity={st.heat} />
          {Array.from({ length: BUB.length }, (_, i) => {
            const bb = bubbleAt(i, clock, st.bubbles, st.reach, st.burst);
            if (!bb) return null;
            const c = winPt(bb.a, bb.b, u, o), r = bb.r * u, ringR = bb.ring * u;
            return (
              <g key={i}>
                {bb.ringOp > 0.02 && <ellipse cx={c[0]} cy={c[1]} rx={ringR * 0.95} ry={ringR} fill="none" stroke={WHITE} strokeWidth={u * 0.035} opacity={bb.ringOp} />}
                {bb.ringOp > 0.02 && <ellipse cx={c[0]} cy={c[1]} rx={ringR * 1.6} ry={ringR * 1.7} fill="none" stroke={ISO.water[2]} strokeWidth={u * 0.02} strokeDasharray={`${u * 0.05} ${u * 0.07}`} opacity={bb.ringOp * 0.8} />}
                {r > 0.5 && <ellipse cx={c[0]} cy={c[1]} rx={r * 0.92} ry={r} fill={WHITE} stroke={ISO.water[2]} strokeWidth={u * 0.018} opacity={0.9 * bb.op} />}
                {r > 4 && <circle cx={c[0] - r * 0.3} cy={c[1] - r * 0.3} r={r * 0.22} fill={ISO.water[0]} opacity={bb.op} />}
              </g>
            );
          })}
          <polygon points={wb(0.04, 0.11)} fill="none" />
        </g>
        <polygon points={win} fill="none" stroke={ISO.dark[0]} strokeWidth={u * 0.05} strokeLinejoin="round" />
        <polyline points={pts([winPt(0.1, 0.18, u, o), winPt(0.1, 0.78, u, o)])} fill="none" stroke={WHITE} strokeWidth={u * 0.035} strokeLinecap="round" opacity={0.55} />
      </g>
      {/* the handle (a D on the lower-right side) and its power lamp */}
      <Polys polys={block([radiusAt(3.15), -0.16, 3.15], [1.95, 0.16, 3.4], u, o)} tones={ISO.dark} />
      <Polys polys={block([radiusAt(0.95), -0.16, 0.95], [1.95, 0.16, 1.2], u, o)} tones={ISO.dark} />
      <Polys polys={block([1.78, -0.16, 0.95], [2.0, 0.16, 3.4], u, o)} tones={ISO.dark} />
      <circle cx={lampAt[0]} cy={lampAt[1]} r={u * 0.085} fill={lampOn ? YELLOW : G2} />
      {lampOn && <circle cx={lampAt[0]} cy={lampAt[1]} r={u * (0.15 + 0.03 * Math.sin((TAU * clock) / 3))} fill="none" stroke={YELLOW} strokeWidth={u * 0.025} opacity={0.6 * st.lamp} />}
      {/* the spout and the lid with its knob */}
      <Polys polys={cylinder([0, radiusAt(3.2), 3.2], [0, 1.8, 3.62], 0.32, 0.2, AX, e2, u, o)} tones={ISO.labPlastic} />
      <Polys polys={post(0, 0, KETTLE.z1, KETTLE.lidZ, KETTLE.rTop - 0.06, KETTLE.rTop - 0.34, u, o)} tones={ISO.plastic} />
      <Polys polys={post(0, 0, KETTLE.lidZ, KETTLE.lidZ + 0.2, 0.2, 0.16, u, o)} tones={ISO.dark} />
    </g>
  );
};

/** The wisps of steam that rise from a screen point: thin wavy lines in the vapour tone. Each wisp lives 3 s (so it is periodic in the loop). */
const Steam: React.FC<{ x: number; y: number; h: number; t: number; k: number; n?: number }> = ({ x, y, h, t, k, n = 3 }) => {
  if (k < 0.03) return null;
  return (
    <g>
      {Array.from({ length: n }, (_, i) => {
        const r = riseAt(t, i / n, 3), a = Math.sin(Math.PI * r), sway = h * 0.1 * Math.sin(r * 6.2 + i * 2.1);
        const base = y - r * h;
        const p: P2[] = [0, 1, 2, 3].map((s) => [x + (i - (n - 1) / 2) * h * 0.12 + sway + h * 0.05 * Math.sin(s * 1.5 + i + r * 4), base - s * h * 0.11] as P2);
        return <path key={i} d={smoothPath(p, 0.5)} fill="none" stroke={STEAM} strokeWidth={Math.max(4, h * 0.05)} strokeLinecap="round" opacity={0.9 * a * k} />;
      })}
    </g>
  );
};

/** The sound mark (new asset 2): thin concentric arcs that spread from the kettle's sides and fade. Period 1.5 s divides 60 s. */
const SoundArcs: React.FC<{ cx: number; cy: number; u: number; k: number; clock: number }> = ({ cx, cy, u, k, clock }) => {
  if (k < 0.03) return null;
  const arc = (r: number, a0: number, a1: number) => {
    const A = (a: number) => [cx + r * Math.cos(a), cy + r * 0.86 * Math.sin(a)];
    const p0 = A(a0), p1 = A(a1);
    return `M ${p0[0]} ${p0[1]} A ${r} ${r * 0.86} 0 0 1 ${p1[0]} ${p1[1]}`;
  };
  return (
    <g fill="none" stroke={G2} strokeLinecap="round">
      {[0, 1, 2].map((i) => {
        const ph = (((clock / 1.5 + i / 3) % 1) + 1) % 1, r = u * (2.35 + 1.5 * ph), op = k * Math.sin(Math.PI * ph);
        return <g key={i} opacity={op} strokeWidth={u * 0.055}>
          <path d={arc(r, -0.6, 0.6)} />
          <path d={arc(r, Math.PI - 0.6, Math.PI + 0.6)} />
        </g>;
      })}
    </g>
  );
};

// ------------------------------------------------------------------------------------------------------ the heat meter on the wall (new asset 3)
const METER = { n: 8, x0: -8.0, cell: 0.38, gap: 0.06, z0: 0.6 } as const;
const meterX = (i: number) => METER.x0 + i * (METER.cell + METER.gap);
const HeatMeter: React.FC<{ u: number; o: P2; show: number; fill: number; clock: number }> = ({ u, o, show, fill, clock }) => {
  if (show < 0.02) return null;
  const len = METER.n * (METER.cell + METER.gap);
  return (
    <g opacity={show}>
      <Polys polys={block([METER.x0 - 0.25, WALL_Y, METER.z0 - 0.25], [METER.x0 + len + 0.2, WALL_Y + 0.1, METER.z0 + 1.55], u, o)} tones={ISO.dark} />
      {Array.from({ length: METER.n }, (_, i) => {
        const on = clamp01(fill * METER.n - i), last = i === METER.n - 1;
        const rise = 0.25 + 1.0 * (i / (METER.n - 1)), wig = last ? 0 : 0.07 * Math.sin((TAU * clock) / 1.5 + i * 1.3);   // the cells before the boil shake: the noisy part
        const h = on > 0.02 ? (0.18 + (rise - 0.18) * smooth(on)) + wig * on : 0.14;
        const tones: Tones = on > 0.5 ? (last ? HOT_TONES : ISO.water) : ISO.metal;
        return <Polys key={i} polys={block([meterX(i), WALL_Y + 0.1, METER.z0], [meterX(i) + METER.cell, WALL_Y + 0.32, METER.z0 + Math.max(0.1, h)], u, o)} tones={tones} />;
      })}
    </g>
  );
};

// ------------------------------------------------------------------------------------------------------ the dressing
const Canisters: React.FC<{ u: number; o: P2 }> = ({ u, o }) => (
  <g>
    {CAN_AT.map(([x, y], i) => {
      const h = i ? 1.7 : 2.2;
      return (
        <g key={i}>
          <Polys polys={post(x, y, 0, h, 0.7, 0.7, u, o)} tones={ISO.metal} />
          <Polys polys={band(post(x, y, h * 0.4, h * 0.4 + 0.2, 0.705, 0.705, u, o))} tones={ISO.dark} />
          <Polys polys={post(x, y, h, h + 0.18, 0.74, 0.7, u, o)} tones={ISO.dark} />
        </g>
      );
    })}
  </g>
);

const WALL_SOCKET = { x: -9.9, z: 0.85 } as const;
/** A wall socket low on the wall and the kettle's cord that lies along the counter to it (a smooth curve, never a zigzag). */
const SocketAndCord: React.FC<{ u: number; o: P2 }> = ({ u, o }) => {
  const P = (x: number, y: number, z: number) => isoAt([x, y, z], u, o) as P2;
  const cord = smoothPath([P(-1.78, -0.45, 0.14), P(-4.0, -1.0, 0.07), P(-7.0, -1.7, 0.07), P(-9.5, -2.0, 0.3), P(-9.9, -2.0, WALL_SOCKET.z - 0.02)], 0.5);
  return (
    <g>
      <Polys polys={block([WALL_SOCKET.x - 0.45, WALL_Y, WALL_SOCKET.z - 0.1], [WALL_SOCKET.x + 0.45, WALL_Y + 0.14, WALL_SOCKET.z + 0.9], u, o)} tones={ISO.plastic} />
      {[-0.16, 0.16].map((dx) => <Polys key={dx} polys={block([WALL_SOCKET.x + dx - 0.05, WALL_Y + 0.14, WALL_SOCKET.z + 0.5], [WALL_SOCKET.x + dx + 0.05, WALL_Y + 0.17, WALL_SOCKET.z + 0.7], u, o)} tones={ISO.dark} />)}
      <path d={cord} fill="none" stroke={G1} strokeWidth={u * 0.075} strokeLinecap="round" strokeLinejoin="round" />
    </g>
  );
};

// ------------------------------------------------------------------------------------------------------ the picture
const Picture: React.FC<SceneProps> = ({ beat, t, clock, story: s }) => {
  const P = React.useMemo(() => makePlan(s), [s]);
  const m = P.m, st = stateAt(clock), cam = camAt(clock), top = P.tops.find((x) => clock >= x.a && clock < x.b);
  const u = U, o = O;
  const lastBeat = beat.kind === "outro";
  const at = (p: P3): P2 => toScreen(cam, world(p));
  const winAt = (a: number, b: number): P2 => toScreen(cam, winPt(a, b, u, o));
  const kettleMid = world([0, 0, 2.1]);
  const spout = world([0, 1.8, 3.62]);
  const bt = t;
  const L = (id: string) => beat.id === id;
  // the pills sit clear of the panel (the first under it, the second to its right); the leaders end on a cell: [pill y, anchor x, anchor y] are read from the cell's screen point
  const cellTop = (i: number): P2 => at([meterX(i) + METER.cell / 2, WALL_Y + 0.2, METER.z0 + 0.5]);
  const meterLabel = [cellTop(2)[0], 640, cellTop(2)[1]] as const, boilLabel = [cellTop(METER.n - 1)[0], 600, cellTop(METER.n - 1)[1]] as const;
  const lampL = at([1.9, 0.17, 3.3]);
  return (
    <div style={{ position: "absolute", inset: 0, width: 1080, height: 1920 }}>
      <svg width={1080} height={1920} viewBox="0 0 1080 1920" style={{ position: "absolute", inset: 0 }}>
        {/* the far layer: the brand wall (the kitchen wall covers it, but it keeps the theme behind the set) */}
        <g transform={layerTransform(cam, 0.3)}><Brand clock={clock} spot={{ x: 540, y: 400 }} /></g>
        <g transform={layerTransform(cam, 1)}>
          {/* the wall, the counter top and the cabinet run past the frame on every side */}
          <Polys polys={block([-90, WALL_Y - 0.6, -14], [90, WALL_Y, 40], u, o)} tones={ISO.wall} />
          <Polys polys={block([-90, WALL_Y, -14], [90, 5.8, -0.5], u, o)} tones={CABINET} />
          <Polys polys={block([-90, WALL_Y, -0.5], [90, 5.8, 0], u, o)} tones={COUNTER_TOP} />
          <HeatMeter u={u} o={o} show={st.meter} fill={st.fill} clock={clock} />
          <SocketAndCord u={u} o={o} />
          <Canisters u={u} o={o} />
          <IsoCup u={104} o={world([CUP_AT[0], CUP_AT[1], 0])} t={clock} />
          <SoundArcs cx={kettleMid[0]} cy={kettleMid[1]} u={u} k={st.sound} clock={clock} />
          <Kettle u={u} o={o} clock={clock} st={st} />
          <Steam x={spout[0]} y={spout[1] - 8} h={u * (0.9 + 0.5 * st.steam)} t={clock} k={st.steam} n={3} />
        </g>
        {cam.zoom < 2.2 && <g transform={layerTransform(cam, 1.35)}><Motes t={clock} color={WHITE} opacity={0.35} n={10} /></g>}

        {/* labels on their parts (screen px through the camera, beat-local time) */}
        {L("dasar") && bt > 1.2 && bt < 5.6 && <NumberLabel text="pemanas" x={250} y={winAt(0.5, 0.03)[1] + 110} ax={winAt(0.15, 0.03)[0]} ay={winAt(0.15, 0.03)[1]} fs={46} t={t} start={1.3} end={5.5} />}
        {L("dasar") && bt > 3.0 && bt < 6.0 && <NumberLabel text="lebih panas" red x={250} y={winAt(0.2, 0.2)[1] - 60} ax={winAt(0.12, 0.2)[0]} ay={winAt(0.12, 0.2)[1]} fs={46} t={t} start={3.1} end={5.9} />}
        {L("dasar") && bt > 6.8 && bt < 13.6 && <NumberLabel text="gelembung uap" x={265} y={winAt(0.1, 0.45)[1] - 70} ax={winAt(0.1, 0.12)[0]} ay={winAt(0.1, 0.12)[1]} fs={44} t={t} start={6.9} end={13.5} />}
        {L("runtuh") && bt > 0.6 && bt < 7.6 && <NumberLabel text="air lebih dingin" x={265} y={winAt(0.1, 0.8)[1] - 40} ax={winAt(0.1, 0.8)[0]} ay={winAt(0.1, 0.8)[1]} fs={44} t={t} start={0.7} end={7.5} />}
        {L("kejut") && bt > 2.0 && bt < 7.6 && <NumberLabel text="gelombang kejut" x={265} y={winAt(0.2, 0.75)[1] - 130} ax={winAt(0.1, 0.62)[0]} ay={winAt(0.1, 0.62)[1]} fs={44} t={t} start={2.1} end={7.5} />}
        {L("hasil") && bt > 1.6 && bt < 6.6 && <NumberLabel text="berisik" x={270} y={meterLabel[1] + 20} ax={meterLabel[0]} ay={meterLabel[2]} fs={46} t={t} start={1.7} end={6.5} />}
        {L("hasil") && bt > 5.0 && bt < 6.9 && <NumberLabel text="mendidih" red x={790} y={boilLabel[1] + 20} ax={boilLabel[0]} ay={boilLabel[2]} fs={46} t={t} start={5.1} end={6.9} />}
        {L("fakta") && bt > 3.3 && bt < 5.9 && <NumberLabel text="lampu mati" x={760} y={lampL[1] - 150} ax={lampL[0]} ay={lampL[1]} fs={46} t={t} start={3.4} end={5.8} />}
                {L("tips") && bt > 0.6 && bt < 4.6 && <Label text="desis saat memanas: wajar" x={540} y={540} fs={50} t={t} start={0.7} />}
        {L("tips") && bt > 4.8 && bt < 9 && <Label text="bau gosong? cabut, tanya teknisi" color="red" x={540} y={540} fs={46} t={t} start={4.9} />}

        {/* the TIK of a collapse, and the sources */}
        {L("runtuh") && bt > 3.2 && bt < 4.6 && <Onomatopoeia text="TIK!" x={winAt(0.85, 0.65)[0] + 120} y={winAt(0.85, 0.65)[1]} fs={64} rot={-9} t={t} start={3.3} />}
        {L("runtuh") && bt > 5.2 && bt < 6.5 && <Onomatopoeia text="TIK!" x={winAt(0.1, 0.6)[0] - 120} y={winAt(0.1, 0.6)[1]} fs={64} rot={8} t={t} start={5.3} />}
        {L("dasar") && bt > 11.4 && bt < 13.8 && <SourceChip x={90} y={1500} text="Wikipedia: didih nukleat" t={t} start={11.5} end={13.6} />}
        {L("kejut") && bt > 5.0 && bt < 7.8 && <SourceChip x={90} y={1500} text="Wikipedia: kavitasi" t={t} start={5.1} end={7.7} />}
        {L("fakta") && bt > 3.8 && bt < 5.9 && <SourceChip x={90} y={1500} text="Wikipedia: kettle" t={t} start={3.9} end={5.8} />}

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
