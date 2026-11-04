/* Kenapa soda menyembur kalau dikocok lalu dibuka? — one cafe-counter set (set kind "cafe-counter"), one hero (a soda bottle) and one continuous camera (plan.ts CAM).
   The bottle is seen through its glass: dissolved gas as pale dots, small bubbles that the shaking makes, a speck on the wall where a bubble starts, the cap that pops
   and the foam that follows. Real shapes checked: a bottle is a round vertical cylinder with a shoulder and a narrow neck (a vertical cylinder seen in the iso camera
   has a half-width of r * 1.2247 * u and an ellipse of 0.577 of it); a gas bubble in a drink is a round sphere (surface tension), drawn as a circle with a small shine.
   The first frame is the last (the loop): the closed bottle with only a few small bubbles stands at the same place. */
import React from "react";
import {
  BLACK, CaptionLayer, IsoClock, Label, Mascot, Polys, StoryVideo, TopText, YELLOW, block, cam2At, clamp01, cylinder, easeInOut,
  isoAt, layerTransform, planeXZ, ptsAttr, springAt, textWidth, useFonts, SourceChip, type P2, type P3, type Poly, type SceneProps, type StoryT,
} from "../../src/design/index.ts";
import { ISO, G1, G2, G3, G4, WHITE } from "../../src/tokens.ts";
import { mixRgb } from "../../src/natureGeometry.ts";
import { CAM, T, bottleSlot, capFlight, capOn, dens, foamK, puddleK, shakeAmp, shakeOff, spillK, tapAt, twistK } from "./plan.ts";
import storyJson from "./story.json";

export const story = storyJson as unknown as StoryT;

const U = 150, O: P2 = [540, 1380];                                   // the counter's iso unit and origin (world px); the bottle stands on the origin
const P = (p: P3): P2 => isoAt(p, U, O);
const WOOD: readonly [string, string, string] = [mixRgb(ISO.soil[0], WHITE, 0.4), mixRgb(ISO.soil[1], WHITE, 0.25), mixRgb(ISO.soil[2], BLACK, 0.1)];
const WOOD_EDGE = mixRgb(ISO.soil[2], WHITE, 0.1);
const LIQ = [mixRgb(ISO.soil[2], BLACK, 0.25), mixRgb(ISO.soil[2], BLACK, 0.45), mixRgb(ISO.soil[2], BLACK, 0.62)];   // dark amber soda
const FOAM = [WHITE, G4, mixRgb(G4, LIQ[0], 0.25)];
const TILE: readonly [string, string, string] = [WHITE, G4, mixRgb(G4, G3, 0.5)];
const bold = { fontFamily: '"Outfit", sans-serif', fontWeight: 700 } as const;
const on = (c: number, a: number, b = 1e9) => clamp01((c - a) / 0.35) * (1 - clamp01((c - b) / 0.35));
const blk = (a: P3, b: P3) => block(a, b, U, O);
/** A small seeded random in 0..1 (the same on every render). */
const rnd = (i: number, k: number) => { const s = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return s - Math.floor(s); };

// ---- the bottle: local coordinates, origin = the centre of its base on the counter, y up is negative
const R = 1.2247 * 0.95 * U, RY = R * 0.577, BODY = 600, SHO = 105, NECK = 165, RN = 1.2247 * 0.5 * U, TOPY = -(BODY + SHO + NECK);
const LIQ_TOP = -510;
const bodyPath = `M ${-R} 0 A ${R} ${RY} 0 0 0 ${R} 0 L ${R} ${-BODY} C ${R} ${-BODY - 60} ${RN} ${-BODY - 30} ${RN} ${-BODY - SHO} L ${RN} ${TOPY} L ${-RN} ${TOPY} L ${-RN} ${-BODY - SHO} C ${-RN} ${-BODY - 30} ${-R} ${-BODY - 60} ${-R} ${-BODY} Z`;
const E1: P3 = [1, 0, 0], E2: P3 = [0, 1, 0];
const capPolys = (): Poly[] => cylinder([0, 0, 5.8], [0, 0, 6.2], 0.62, 0.62, E1, E2, U, [0, 0], 40);
const ringPolys = (): Poly[] => cylinder([0, 0, 5.74], [0, 0, 5.8], 0.66, 0.66, E1, E2, U, [0, 0], 40);

const Bubbles: React.FC<{ c: number; d: number; amp: number; fresh: boolean }> = ({ c, d, amp, fresh }) => {
  const N = 54;
  return (
    <g>
      {Array.from({ length: N }, (_, i) => {
        if (i / N >= d) return null;
        const cyc = 6 + Math.floor(rnd(i, 2) * 9), a = rnd(i, 1), ph = rnd(i, 3), r = 4 + 11 * rnd(i, 4) * (0.5 + 0.5 * Math.min(1, d + 0.2));
        const yy = -24 - ((ph + (c * cyc) / 60) % 1) * 440;
        const xx = (a * 2 - 1) * (R - 34) + Math.sin(c * 1.5708 + i) * 10 * (1 + amp * 3);
        return <g key={i} opacity={Math.min(1, (d * N - i) / 2 + 0.2) * 0.95}><circle cx={xx} cy={yy} r={r} fill={WHITE} opacity={0.5} stroke={WHITE} strokeWidth={2.5} /><circle cx={xx - r * 0.3} cy={yy - r * 0.3} r={Math.max(1.5, r * 0.25)} fill={WHITE} /></g>;
      })}
    </g>
  );
};

/** The gas dissolved in the liquid: a field of tiny pale dots that twinkle (no bubble yet). */
const Dissolved: React.FC<{ c: number; k: number }> = ({ c, k }) => (
  <g opacity={k}>
    {Array.from({ length: 70 }, (_, i) => {
      const x = (rnd(i, 7) * 2 - 1) * (R - 22), y = LIQ_TOP + 30 + rnd(i, 8) * (-LIQ_TOP - 60), tw = 0.5 + 0.5 * Math.sin(c * 2.4 + i * 1.7);
      return <circle key={i} cx={x} cy={y} r={3.5} fill={WHITE} opacity={0.35 + 0.55 * tw} />;
    })}
  </g>
);

const Bottle: React.FC<{ c: number; fresh: boolean }> = ({ c, fresh }) => {
  const d = dens(c), amp = shakeAmp(c), tilt = amp * 4 * Math.sin(c * 18);
  const dissolvedK = fresh ? 0 : on(c, T.dots, T.pop) * (1 - Math.min(1, d * 1.1));
  const speckK = !fresh ? on(c, T.speck, T.pop - 0.6) : 0;
  const cyc = (c - T.grow) % 1.7, bubR = c > T.grow && c < T.pop - 0.6 ? 6 + 24 * (cyc / 1.7) : 0;
  const lab = `M ${-R} -70 A ${R} ${RY} 0 0 0 ${R} -70 L ${R} -150 A ${R} ${RY} 0 0 1 ${-R} -150 Z`;
  return (
    <g>
      <defs><clipPath id="sd-body"><path d={bodyPath} /></clipPath></defs>
      <ellipse cx={0} cy={6} rx={R + 18} ry={RY + 12} fill={BLACK} opacity={0.14} />
      <path d={bodyPath} fill={G4} opacity={0.55} />
      <g clipPath="url(#sd-body)">
        <g transform={`rotate(${tilt} 0 ${LIQ_TOP})`}>
          <rect x={-R - 4} y={LIQ_TOP} width={2 * R + 8} height={-LIQ_TOP + RY + 4} fill={LIQ[1]} />
          <rect x={R - 70} y={LIQ_TOP} width={80} height={-LIQ_TOP + RY + 4} fill={LIQ[2]} />
          <rect x={-R - 4} y={LIQ_TOP} width={46} height={-LIQ_TOP + RY + 4} fill={LIQ[0]} />
          <ellipse cx={0} cy={LIQ_TOP} rx={R} ry={RY} fill={LIQ[0]} />
          <ellipse cx={0} cy={LIQ_TOP} rx={R * 0.82} ry={RY * 0.8} fill={mixRgb(LIQ[0], WHITE, 0.25)} />
          <Dissolved c={c} k={dissolvedK} />
          <Bubbles c={c} d={d} amp={amp} fresh={fresh} />
          {speckK > 0.02 && <g opacity={speckK}>
            <polygon points={`${R - 30},-308 ${R - 20},-318 ${R - 10},-310 ${R - 14},-298 ${R - 28},-296`} fill={G1} />
            {bubR > 0 && <g><circle cx={R - 22 - bubR * 0.1} cy={-304 - bubR * 1.2} r={bubR} fill={WHITE} opacity={0.6} stroke={WHITE} strokeWidth={3} /><circle cx={R - 22 - bubR * 0.4} cy={-304 - bubR * 1.5} r={Math.max(2, bubR * 0.25)} fill={WHITE} /></g>}
          </g>}
        </g>
        <path d={lab} fill={WHITE} opacity={0.92} />
        <path d={`M ${-R} -100 A ${R} ${RY} 0 0 0 ${R} -100 L ${R} -116 A ${R} ${RY} 0 0 1 ${-R} -116 Z`} fill={G2} />
        <rect x={-R} y={-BODY - SHO - NECK} width={36} height={BODY + SHO + NECK} fill={WHITE} opacity={0.28} />
        <rect x={R - 56} y={-BODY - SHO - NECK} width={60} height={BODY + SHO + NECK + RY} fill={BLACK} opacity={0.14} />
      </g>
      <path d={bodyPath} fill="none" stroke={G2} strokeWidth={5} strokeLinejoin="round" />
      {!fresh && capOn(c) <= 0 && <ellipse cx={0} cy={TOPY} rx={RN} ry={RN * 0.577} fill={G4} stroke={G2} strokeWidth={5} />}
      {(fresh || capOn(c) > 0) && <g transform={`translate(0 ${fresh ? 0 : -6 * twistK(c)}) rotate(${fresh ? 0 : -5 * Math.sin(twistK(c) * 24)} 0 ${TOPY})`}><Polys polys={ringPolys()} tones={ISO.metal} /><Polys polys={capPolys()} tones={ISO.dark} /></g>}
    </g>
  );
};

/** The foam, the spray and the run down the side after the pop (local coordinates of the bottle). */
const Foam: React.FC<{ c: number }> = ({ c }) => {
  const k = foamK(c), s = spillK(c);
  if (k <= 0.01 && s <= 0.01) return null;
  const neckY = TOPY - 12, jet = c < 31.5 ? 1 : 0;
  return (
    <g>
      {Array.from({ length: 26 }, (_, i) => {
        const a = rnd(i, 11), x = (a * 2 - 1) * (50 + 90 * k), y = neckY + 5 - rnd(i, 12) * 110 * k, r = (26 + 34 * rnd(i, 13)) * (0.4 + 0.6 * k);
        const bob = 5 * Math.sin(c * 4 + i);
        return <circle key={i} cx={x} cy={y + bob} r={r} fill={FOAM[i % 3]} stroke={G3} strokeWidth={3} opacity={Math.min(1, k * 2)} />;
      })}
      {jet > 0 && k > 0.1 && Array.from({ length: 22 }, (_, i) => {
        const per = 1.5, tau = ((c - T.pop - rnd(i, 14) * per) % per + per) % per, vx = (rnd(i, 15) * 2 - 1) * 420, vy = -(900 + 700 * rnd(i, 16)), g = 2300;
        const x = vx * tau, y = neckY + vy * tau + 0.5 * g * tau * tau;
        if (y > -40) return null;
        return <circle key={i} cx={x} cy={y} r={7 + 9 * rnd(i, 17)} fill={i % 2 ? FOAM[0] : LIQ[0]} opacity={0.95 * Math.min(1, k * 3)} />;
      })}
      {Array.from({ length: 16 }, (_, i) => {
        const f = i / 15, show = clamp01(s * 16 - i);
        if (show <= 0) return null;
        const y = neckY + 30 + f * (-neckY - 40), x = RN + 10 + f * (R - RN + 8) + 4 * Math.sin(i * 2.1);
        return <circle key={i} cx={x} cy={y} r={(22 - 8 * f) * show} fill={FOAM[(i + 1) % 3]} stroke={G3} strokeWidth={3} />;
      })}
    </g>
  );
};

const Cap: React.FC<{ c: number }> = ({ c }) => {
  const f = capFlight(c);
  if (c < T.pop || f > 2.6) return null;
  const x = 150 * f, y = TOPY - 30 - (1100 * f - 0.5 * 2300 * f * f);
  return <g transform={`translate(${x} ${y}) rotate(${f * 540} 0 0)`}><Polys polys={ringPolys().map((p) => ({ ...p, pts: p.pts.map(([a, b]) => [a, b - TOPY] as P2) }))} tones={ISO.metal} /><Polys polys={capPolys().map((p) => ({ ...p, pts: p.pts.map(([a, b]) => [a, b - TOPY] as P2) }))} tones={ISO.dark} /></g>;
};

const Puddle: React.FC<{ k: number }> = ({ k }) => {
  if (k <= 0.01) return null;
  const rx = 150 + 330 * k, ry = rx * 0.577;
  return <g opacity={Math.min(1, k * 3)}><ellipse cx={0} cy={14} rx={rx} ry={ry} fill={LIQ[1]} stroke={LIQ[2]} strokeWidth={5} /><ellipse cx={-rx * 0.2} cy={14 - ry * 0.25} rx={rx * 0.55} ry={ry * 0.4} fill={LIQ[0]} opacity={0.7} />
    {[0, 1, 2, 3, 4].map((i) => <circle key={i} cx={(rnd(i, 21) * 2 - 1) * rx * 0.7} cy={14 + (rnd(i, 22) * 2 - 1) * ry * 0.6} r={8 + 10 * rnd(i, 23)} fill={FOAM[0]} stroke={G3} strokeWidth={3} />)}</g>;
};

/** Pressure arrows in the bottle's gas pocket: they push down on the liquid. */
const Arrow: React.FC<{ x1: number; y1: number; x2: number; y2: number; k: number; col?: string; w?: number }> = ({ x1, y1, x2, y2, k, col = BLACK, w = 12 }) => {
  if (k <= 0.02) return null;
  const ex = x1 + (x2 - x1) * k, ey = y1 + (y2 - y1) * k, a = Math.atan2(y2 - y1, x2 - x1), s = 30;
  return <g><line x1={x1} y1={y1} x2={ex} y2={ey} stroke={col} strokeWidth={w} strokeLinecap="round" />{k > 0.85 && <polygon points={`${ex},${ey} ${ex - s * Math.cos(a - 0.5)},${ey - s * Math.sin(a - 0.5)} ${ex - s * Math.cos(a + 0.5)},${ey - s * Math.sin(a + 0.5)}`} fill={col} />}</g>;
};

const Tag: React.FC<{ text: string; x: number; y: number; fs?: number; c: number; a: number; b?: number; hl?: string[]; to?: P2 }> = ({ text, x, y, fs = 50, c, a, b = 1e9, hl, to }) => {
  const k = on(c, a, b);
  if (k <= 0.02) return null;
  const w = textWidth(text, fs) + fs * 1.1, h = fs * 1.5;
  return <g opacity={Math.min(1, k * 1.5)}>{to && <><line x1={x} y1={y} x2={to[0]} y2={to[1]} stroke={BLACK} strokeWidth={5} strokeLinecap="round" /><circle cx={to[0]} cy={to[1]} r={9} fill={BLACK} /></>}<rect x={x - w / 2} y={y - h * 0.58} width={w} height={h} rx={h / 2} fill={WHITE} opacity={0.94} stroke={G3} strokeWidth={3} /><Label text={text} x={x} y={y} fs={fs} t={c} start={a} highlight={hl} /></g>;
};

// ---- the set: a counter against a tiled back corner
const Counter: React.FC = () => (
  <g>
    <rect x={-3000} y={-3000} width={8000} height={9000} fill={ISO.wall[1]} />
    <Polys polys={blk([-7, -7, -1.8], [18, 18, 0])} tones={WOOD} />
    {Array.from({ length: 26 }, (_, i) => { const y = -6 + i * 1.0, a = P([-6, y, 0.001]), b = P([18, y, 0.001]); return <line key={i} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={WOOD_EDGE} strokeWidth={4} opacity={0.55} />; })}
    {Array.from({ length: 8 }, (_, i) => { const x = -3 + i * 3.1, y = -5 + ((i * 7) % 11) * 1.4, a = P([x, y, 0.002]), b = P([x + 1.2, y, 0.002]); return <line key={i} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={WOOD_EDGE} strokeWidth={4} strokeLinecap="round" opacity={0.7} />; })}
    {/* the two back walls meet in a corner behind the counter; a tiled strip runs along the foot of both */}
    <Polys polys={blk([-7, -7, 0], [-6, 18, 24])} tones={ISO.wall} />
    <Polys polys={blk([-7, -7, 0], [18, -6, 24])} tones={ISO.wall} />
    <g transform={planeXZ(-6, U, O)}>{Array.from({ length: 26 }, (_, i) => Array.from({ length: 2 }, (_, j) => <rect key={`${i}${j}`} x={-6 + i + 0.04} y={0.04 + j} width={0.92} height={0.92} fill={TILE[(i + j) % 2 ? 0 : 1]} />))}</g>
    {Array.from({ length: 26 }, (_, i) => Array.from({ length: 2 }, (_, j) => { const y = -6 + i, z = j; const q: P2[] = [P([-6, y + 0.04, z + 0.04]), P([-6, y + 0.96, z + 0.04]), P([-6, y + 0.96, z + 0.96]), P([-6, y + 0.04, z + 0.96])]; return <polygon key={`${i}${j}`} points={ptsAttr(q)} fill={TILE[2]} />; }))}
  </g>
);

const Menu: React.FC = () => (
  <g>
    <Polys polys={blk([-4.2, -6, 1.0], [-0.8, -5.85, 4.6])} tones={ISO.dark} />
    <g transform={planeXZ(-5.85, U, O)} stroke={WHITE} strokeWidth={0.06} strokeLinecap="round" fill="none" opacity={0.9}>
      {[3.7, 3.1, 2.5, 1.9].map((z, i) => <line key={i} x1={-3.8} y1={z} x2={-3.8 + 1.4 + (i % 2) * 0.9} y2={z} />)}
      {[3.7, 3.1, 2.5, 1.9].map((z, i) => <line key={`b${i}`} x1={-1.5} y1={z} x2={-1.2} y2={z} />)}
      <circle cx={-2.6} cy={3.9} r={0.18} /><circle cx={-2.3} cy={4.15} r={0.12} />
    </g>
  </g>
);

const Shelf: React.FC<{ c: number }> = ({ c }) => (
  <g>
    <Polys polys={blk([-6, -5, 1.1], [-4.9, -1.2, 1.3])} tones={WOOD} />
    {[-4.4, -3.2, -2.0].map((y, i) => (
      <g key={i} transform={`translate(0 ${-1.5 * Math.sin(c * 1.0472 + i)})`}>
        <Polys polys={cylinder([-5.45, y, 1.3], [-5.45, y, 2.2], 0.34, 0.42, E1, E2, U, O, 28)} tones={i === 1 ? ISO.dark : ISO.plastic} />
      </g>
    ))}
  </g>
);

const IceBucket: React.FC<{ c: number }> = ({ c }) => (
  <g>
    <Polys polys={cylinder([2.8, -2.6, 0], [2.8, -2.6, 3.0], 1.25, 1.45, E1, E2, U, O, 40)} tones={ISO.metal} />
    {[[-0.45, -0.2], [0.35, 0.3], [0.1, -0.55]].map(([dx, dy], i) => <g key={i} transform={`translate(0 ${-4 * Math.sin(c * 1.3614 + i * 2)})`}><Polys polys={blk([2.8 + dx - 0.3, -2.6 + dy - 0.3, 3.0], [2.8 + dx + 0.3, -2.6 + dy + 0.3, 3.55])} tones={TILE} /></g>)}
  </g>
);

const Glass: React.FC = () => (
  <g>
    <Polys polys={cylinder([-1.6, 1.6, 0], [-1.6, 1.6, 2.2], 0.45, 0.55, E1, E2, U, O, 32)} tones={ISO.plastic} />
    <Polys polys={cylinder([-1.6, 1.6, 0.05], [-1.6, 1.6, 1.3], 0.4, 0.5, E1, E2, U, O, 32)} tones={ISO.water} />
  </g>
);

/** Loose dust in the air, in front of everything (the near layer): it touches nothing. */
const Dust: React.FC<{ c: number }> = ({ c }) => (
  <g>{Array.from({ length: 12 }, (_, i) => <circle key={i} cx={-200 + rnd(i, 31) * 1500 + 14 * Math.sin(c * 0.733 + i)} cy={200 + rnd(i, 32) * 1500 + 20 * Math.sin(c * 0.5236 + i * 2)} r={3 + 3 * rnd(i, 33)} fill={WHITE} opacity={0.35} />)}</g>
);

const Scene = ({ beat, t, clock }: SceneProps) => {
  useFonts();
  const c = clock, cam = cam2At(CAM, c), isOutro = beat.kind === "outro";
  const slot = bottleSlot(c), sh = shakeOff(c);
  const bx = O[0] + slot.x + sh.dx, by = O[1] + sh.dy * 0.0 - Math.abs(sh.dy) * 0.6;
  const taps = [tapAt(c, T.tap1), tapAt(c, T.tap2), tapAt(c, T.tap3)];
  const tapK = Math.max(...taps);
  const pk = (a: number) => easeInOut(clamp01((c - a) / 0.5)), pulse = 6 * Math.sin(c * 6);
  const gasK = on(c, T.pressA - 0.2, T.shakeA - 0.4);
  return (
    <svg width={1080} height={1920} viewBox="0 0 1080 1920">
      <g transform={layerTransform(cam, 1)}>
        <Counter />
        <Menu />
        <Shelf c={c} />
        <IceBucket c={c} />
        <Glass />
        <g transform={`translate(${O[0] + 3.0 * 0} ${O[1]})`}><Puddle k={puddleK(c)} /></g>
        {/* the clock that waits: it stands on the counter at the right */}
        {c > T.clock - 0.4 && c < T.fadeOut + 0.6 && <g opacity={on(c, T.clock, T.clock + 3.6) + on(c, T.clockIn, T.fadeOut - 0.2)}><IsoClock u={130} o={P([2.6, 0.2, 0])} t={c} speed={900} /></g>}
        <g transform={`translate(${bx} ${by}) rotate(${sh.rot})`}>
          <Bottle c={c} fresh={slot.fresh} />
          {!slot.fresh && <Foam c={c} />}
          {/* the gas pocket pushes down, the cap holds it */}
          {!slot.fresh && gasK > 0.02 && <g opacity={gasK}>
            {[-70, 0, 70].map((x, i) => <Arrow key={i} x1={x} y1={-BODY - 150 + pulse * 0.2 - 40} x2={x} y2={-BODY - 20 + pulse * 0.6} k={pk([T.pressA, T.pressB, T.pressC][i])} />)}
          </g>}
          {!slot.fresh && c >= T.lblCap - 0.3 && c < T.shakeA - 0.4 && <Arrow x1={0} y1={TOPY + 150 + pulse} x2={0} y2={TOPY + 40} k={pk(T.lblCap)} col={BLACK} />}
          {/* the shake and the taps: short strokes beside the bottle */}
          {shakeAmp(c) > 0.2 && [-1, 1].map((s) => <path key={s} d={`M ${s * (R + 36)} -420 q ${s * 26} 50 0 100 M ${s * (R + 70)} -440 q ${s * 30} 70 0 140`} fill="none" stroke={BLACK} strokeWidth={9} strokeLinecap="round" opacity={shakeAmp(c)} />)}
          {tapK > 0.05 && [0, 1, 2].map((i) => taps[i] > 0.05 && <g key={i} opacity={taps[i]}><circle cx={R + 4} cy={-300 + i * 30} r={20 + 70 * (1 - taps[i])} fill="none" stroke={BLACK} strokeWidth={8} /><circle cx={R + 4} cy={-300 + i * 30} r={9} fill={BLACK} /></g>)}
        </g>
        {!slot.fresh && <g transform={`translate(${bx} ${by})`}><Cap c={c} /></g>}
        {/* labels */}
        <Tag text="gas terlarut" x={bx + 250} y={by - 380} c={c} a={T.lblGas} b={T.shakeA - 0.4} hl={["gas"]} to={[bx + 80, by - 300]} />
        <Tag text="tekanan" x={bx + 280} y={by - 700} c={c} a={T.lblPress} b={T.shakeA - 0.4} hl={["tekanan"]} to={[bx + 70, by - 640]} />
        <Tag text="tutup menahan" x={bx - 250} y={by - 960} c={c} a={T.lblCap} b={T.shakeA - 0.4} fs={46} to={[bx - 60, by + TOPY - 30]} />
        <Tag text="gelembung kecil" x={bx - 270} y={by - 520} c={c} a={T.lblSmall} b={T.lblDust - 0.3} hl={["kecil"]} to={[bx - 90, by - 380]} />
        <Tag text="debu, bagian kasar" x={bx - 270} y={by - 470} c={c} a={T.lblDust} b={T.twist - 0.5} fs={44} to={[bx + R - 24, by - 304]} />
        <Tag text="titik awal gelembung" x={bx + 200} y={by - 680} c={c} a={T.lblSpot} b={T.twist - 0.5} fs={44} hl={["awal"]} to={[bx + R - 40, by - 360]} />
        {c >= T.chip - 0.2 && c < T.chipEnd + 0.6 && <SourceChip x={bx - 150} y={by + 150} text="livescience.com" t={c} start={T.chip} end={T.chipEnd} />}
        <Tag text="tekanan turun" x={bx + 230} y={by - 1020} c={c} a={T.lblDrop} b={T.lblMore - 0.2} hl={["turun"]} fs={48} to={[bx + 30, by + TOPY - 60]} />
        <Tag text="makin banyak gelembung" x={bx} y={by - 1020} c={c} a={T.lblMore} b={T.spill - 0.2} fs={46} hl={["banyak"]} />
        <Tag text="minuman tumpah" x={bx + 250} y={by - 260} c={c} a={T.lblOut} b={T.lblFoam - 0.2} fs={48} hl={["tumpah"]} to={[bx + R + 20, by - 340]} />
        <Tag text="busa menyembur" x={bx} y={by - 1020} c={c} a={T.lblFoam} b={T.wipe} fs={52} hl={["busa"]} />
        <Tag text="beberapa menit" x={bx - 250} y={by - 560} c={c} a={T.lblMin} b={T.dissolveB + 1} fs={48} hl={["menit"]} />
        <Tag text="gelembung larut lagi" x={bx + 240} y={by - 340} c={c} a={T.dissolveA + 1.4} b={T.dissolveB + 1} fs={44} />
        <Tag text="1.031 kaleng bir" x={bx} y={by - 960} c={c} a={T.cardN} b={T.lblNo - 0.3} fs={54} hl={["1.031"]} />
        <Tag text="tepuk: tidak beda" x={bx} y={by - 960} c={c} a={T.lblNo} b={47.9} fs={52} hl={["tidak"]} />
        <Tag text="diamkan dulu" x={P([2.6, 0.2, 0])[0] + 190} y={P([2.6, 0.2, 0])[1] - 340} c={c} a={T.lblWait} b={T.fadeOut - 0.3} fs={50} hl={["diamkan"]} />
        {c >= T.arrowAway - 0.2 && c < T.fadeOut && <g opacity={on(c, T.arrowAway, T.fadeOut - 0.4)}>
          <Arrow x1={bx + 40} y1={by + TOPY - 60} x2={bx + 340} y2={by + TOPY - 60} k={pk(T.arrowAway)} w={16} />
        </g>}
        <Tag text="tutup menjauh dari wajah" x={bx + 330} y={by + TOPY + 30} c={c} a={T.lblAway} b={T.fadeOut - 0.3} fs={42} hl={["menjauh"]} />
      </g>
      <g transform={layerTransform(cam, 1.25)}><Dust c={c} /></g>
      {beat.kind !== "sting" && beat.kind !== "outro" && <TopText key={beat.id} kicker={KICK[beat.id] ?? "INTIP"} headline={beat.text} t={t} />}
      {beat.kind !== "sting" && beat.kind !== "outro" && <CaptionLayer beat={beat} t={t} />}
      {!isOutro && beat.kind === "sting" && (() => {
        const p = springAt(c, 3.0), p2 = springAt(c, 3.25);
        return <g>
          <g transform={`translate(540 720) scale(${Math.max(0, p)}) translate(-540 -720)`}><Mascot x={540} y={720} w={220} expr="curious" t={t} clock={c} squash={0.18 * (1 - p)} /></g>
          <g transform={`translate(540 1489) scale(${Math.max(0, p2)}) translate(-540 -1489)`}>
            <rect x={330} y={1443} width={420} height={92} rx={46} fill={YELLOW} />
            <text x={540} y={1507} fontSize={56} textAnchor="middle" fill={BLACK} style={bold}>Intip yuk!</text>
          </g>
        </g>;
      })()}
    </svg>
  );
};
const KICK: Record<string, string> = { hook: "SODA", tekanan: "TEKANAN", kocok: "KOCOK", buka: "BUKA", hasil: "HASILNYA", tepuk: "TAPI", tips: "TIPS" };

export const Video: React.FC<{ story: StoryT; layoutDebug?: boolean }> = (p) => <StoryVideo story={p.story} scene={Scene} layoutDebug={p.layoutDebug} />;
