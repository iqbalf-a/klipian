/* The "alive" 2.5D set (P28-R phase 5, DESIGN.md B25): everyday things the channel's topics keep needing, each with more parts than a plain block and a small
   continuous motion of its own, so it never sits dead on the screen. HOUSEHOLD: a desk lamp (the glow breathes and flickers a little, the shade sways), a kettle
   (steam rises, the lid rattles when it boils), a desk fan (the blades spin, the air streaks flow), an alarm clock (the second hand ticks, the bells shake when it
   rings), a cup of coffee (steam, ripples). ELECTRIC: a battery (the cells fill, the next one blinks, the bolt glows). BODY: a heart (it beats) and a brain (it
   breathes, a glow and signals that run along its folds when it is busy). Flat tones from the ISO kit (the tone rule: light on top, mid on the lower left, dark on
   the lower right) and the token colours; the organ tones are ISO.organ and ISO.brain. Every piece takes `u` (px per world unit), `o` (the screen px of the world
   origin) and `t` (seconds), and is a pure function of them: a frame always looks the same. The motions come from src/alive.ts (the sizes are the registry's). */
import React from "react";
import { BLACK, COFFEE, COFFEE_LIGHT, G1, G3, ISO, RED, STEAM, WHITE, YELLOW, YELLOW_D } from "../tokens.ts";
import { block, circlePts, cylinder, extrudeXZ, isoAt, planeYZ, ptsAttr, smoothPath, type P2, type P3 } from "../iso.ts";
import { OnPlane, Polys } from "./Iso.tsx";
import { blinkClosed, bobPx, breatheScale, flicker, heartBeat, pulse01, riseAt, spinDeg, swayDeg, tickDeg } from "../alive.ts";

const AX = [1, 0, 0] as const, AY = [0, 1, 0] as const;
/** A vertical cylinder or cone frustum from z0 (radius r0) to z1 (radius r1), centred on (x, y). */
const post = (x: number, y: number, z0: number, z1: number, r0: number, r1: number, u: number, o: P2) => cylinder([x, y, z0], [x, y, z1], r0, r1, AX, AY, u, o);
/** The side of a cylinder without its cap: a band round a body (a rim, a stripe) must not paint a lid over what is under it. */
const band = (polys: ReturnType<typeof cylinder>) => polys.slice(0, -1);
const at = (p: P3, u: number, o: P2): P2 => isoAt(p, u, o) as P2;
/** A circle lying flat at height z (an ellipse on the screen), as a polygon. */
const flatCircle = (cx: number, cy: number, z: number, r: number, u: number, o: P2, n = 32): string => ptsAttr(circlePts(cx, cy, r, n).map(([x, y]) => at([x, y, z], u, o)));

/** Wisps of steam that rise from the screen point (x, y): `h` px high, `n` wisps, each a thin wavy line that fades in and out over its life. The vapour mark's tone. */
const Steam: React.FC<{ x: number; y: number; h: number; t: number; n?: number; w?: number; phase?: number }> = ({ x, y, h, t, n = 3, w = 5, phase = 0 }) => (
  <g>
    {Array.from({ length: n }, (_, i) => {
      const k = riseAt(t, i / n + phase), a = Math.sin(Math.PI * k), sway = h * 0.09 * Math.sin(k * 6.2 + i * 2.1);
      const base = y - k * h;
      const pts: P2[] = [0, 1, 2, 3].map((s) => [x + (i - (n - 1) / 2) * h * 0.1 + sway + h * 0.05 * Math.sin(s * 1.5 + i + k * 4), base - s * h * 0.11] as P2);
      return <path key={i} d={smoothPath(pts, 0.5)} fill="none" stroke={STEAM} strokeWidth={w} strokeLinecap="round" opacity={0.85 * a} />;
    })}
  </g>
);

// ------------------------------------------------------------------------------------------------------------------------------------- household

/** A desk lamp: a round base with a metal ring, a pole, a brass shade with a dark rim and the bulb under it. `on` (0..1) is how lit it is: a glow and a cone of light
    that breathe and flicker a little; the shade sways on its pole. The light is yellow (the light mark's tone), the cone is pale. */
export const IsoLamp: React.FC<{ u: number; o: P2; t?: number; on?: number }> = ({ u, o, t = 0, on = 1 }) => {
  const f = flicker(t, 0.1), glow = on * (0.2 + 0.1 * pulse01(t)) * f;
  const top = at([0, 0, 1.52], u, o), bulb = at([0, 0, 1.46], u, o), floorL = at([-1.15, 0.3, 0], u, o), floorR = at([1.15, 0.3, 0], u, o);
  return (
    <g>
      {on > 0.01 && <polygon points={ptsAttr([[bulb[0] - u * 0.32, bulb[1]], [bulb[0] + u * 0.32, bulb[1]], floorR, floorL])} fill={YELLOW} opacity={0.14 * on * f} />}
      <Polys polys={post(0, 0, 0, 0.14, 0.62, 0.55, u, o)} tones={ISO.dark} />
      <Polys polys={post(0, 0, 0.14, 0.2, 0.22, 0.2, u, o)} tones={ISO.metal} />
      <Polys polys={post(0, 0, 0.2, 1.55, 0.07, 0.07, u, o)} tones={ISO.metal} />
      <circle cx={at([0.42, 0.42, 0.14], u, o)[0]} cy={at([0.42, 0.42, 0.14], u, o)[1]} r={u * 0.045} fill={YELLOW_D} />
      <g transform={`rotate(${swayDeg(t, 0, 1.2)} ${top[0]} ${top[1]})`}>
        {on > 0.01 && <ellipse cx={bulb[0]} cy={bulb[1] + u * 0.1} rx={u * 1.05} ry={u * 0.6} fill={YELLOW} opacity={glow} />}
        <ellipse cx={bulb[0]} cy={bulb[1] + u * 0.04} rx={u * 0.3} ry={u * 0.17} fill={on > 0.5 ? WHITE : ISO.plastic[2]} />
        <Polys polys={post(0, 0, 1.5, 2.05, 0.66, 0.26, u, o)} tones={ISO.brass} />
        <Polys polys={band(post(0, 0, 1.5, 1.6, 0.665, 0.64, u, o))} tones={ISO.dark} />
        <ellipse cx={at([0, 0, 2.05], u, o)[0]} cy={at([0, 0, 2.05], u, o)[1]} rx={u * 0.07} ry={u * 0.04} fill={ISO.brass[0]} />
      </g>
    </g>
  );
};

/** A kettle: a metal body with a dark band, a lid with a knob, a spout and a handle. Steam rises from the spout; `boil` (0..1) makes the steam thicker and the lid
    rattle. */
export const IsoKettle: React.FC<{ u: number; o: P2; t?: number; boil?: number }> = ({ u, o, t = 0, boil = 0.5 }) => {
  const rattle = boil * 0.014 * Math.sin(t * 38), spout = at([1.0, 0.1, 1.0], u, o);
  const e2: P3 = [-0.45, 0, 0.89];
  return (
    <g>
      <Polys polys={block([-1.0, -0.12, 0.3], [-0.72, 0.12, 0.95], u, o)} tones={ISO.dark} />
      <Polys polys={block([-0.92, -0.12, 0.28], [-0.5, 0.12, 0.42], u, o)} tones={ISO.dark} />
      <Polys polys={block([-0.92, -0.12, 0.86], [-0.5, 0.12, 1.0], u, o)} tones={ISO.dark} />
      <Polys polys={post(0, 0, 0, 1.1, 0.72, 0.6, u, o)} tones={ISO.metal} />
      <Polys polys={band(post(0, 0, 0.3, 0.4, 0.725, 0.7, u, o))} tones={ISO.dark} />
      <Polys polys={cylinder([0.5, 0.1, 0.62], [1.0, 0.1, 1.0], 0.2, 0.1, AY, e2, u, o)} tones={ISO.metal} />
      <Polys polys={post(0, 0, 1.1 + rattle, 1.2 + rattle, 0.5, 0.46, u, o)} tones={ISO.dark} />
      <circle cx={at([0, 0, 1.28 + rattle], u, o)[0]} cy={at([0, 0, 1.28 + rattle], u, o)[1]} r={u * 0.09} fill={ISO.dark[0]} />
      <Steam x={spout[0]} y={spout[1] - u * 0.1} h={u * (0.9 + 0.5 * boil)} t={t} n={2 + Math.round(boil * 2)} w={u * 0.04} />
    </g>
  );
};

/** A desk fan: a base, a pole, a motor, a guard (two rings and spokes) and three blades that spin (`speed` 0..1 of the registry's turns a second). The disc faces the
    lower right (the dark tone's side), drawn on the plane x = 0.2. */
export const IsoFan: React.FC<{ u: number; o: P2; t?: number; speed?: number }> = ({ u, o, t = 0, speed = 1 }) => {
  const cz = 1.65, angle = spinDeg(t, 2.2 * speed);
  return (
    <g>
      <Polys polys={post(0, 0, 0, 0.14, 0.6, 0.52, u, o)} tones={ISO.dark} />
      <Polys polys={post(0, 0, 0.14, cz - 0.2, 0.08, 0.08, u, o)} tones={ISO.metal} />
      <Polys polys={cylinder([-0.55, 0, cz], [0.1, 0, cz], 0.22, 0.22, AY, [0, 0, 1], u, o)} tones={ISO.dark} />
      <g transform={planeYZ(0.2, u, o)}>
        <circle cx={0} cy={cz} r={0.84} fill={ISO.plastic[0]} opacity={0.35} />
        {[0, 1, 2].map((k) => (
          <g key={k} transform={`rotate(${angle + k * 120} 0 ${cz})`}><ellipse cx={0} cy={cz - 0.36} rx={0.2} ry={0.4} fill={ISO.metal[0]} stroke={ISO.metal[2]} strokeWidth={0.02} /></g>
        ))}
        <circle cx={0} cy={cz} r={0.84} fill="none" stroke={ISO.metal[2]} strokeWidth={0.05} />
        <circle cx={0} cy={cz} r={0.52} fill="none" stroke={ISO.metal[1]} strokeWidth={0.03} />
        {[0, 1, 2, 3].map((k) => <line key={k} x1={0} y1={cz} x2={0.84 * Math.cos((k * Math.PI) / 4 * 2 + 0.4)} y2={cz + 0.84 * Math.sin((k * Math.PI) / 4 * 2 + 0.4)} stroke={ISO.metal[1]} strokeWidth={0.025} />)}
        <circle cx={0} cy={cz} r={0.15} fill={ISO.dark[1]} />
        <circle cx={0} cy={cz} r={0.06} fill={ISO.metal[0]} />
      </g>
    </g>
  );
};

/** Air and wind (the air mark): white streaks that curl and flow along a direction from the screen point (x, y), `len` px long, `n` streaks. */
export const IsoAir: React.FC<{ x: number; y: number; len: number; t: number; n?: number; w?: number }> = ({ x, y, len, t, n = 3, w = 8 }) => (
  <g>
    {Array.from({ length: n }, (_, i) => {
      const k = riseAt(t, i / n, 1.6), a = Math.sin(Math.PI * k), x0 = x + k * len * 0.6, y0 = y + (i - (n - 1) / 2) * len * 0.22 + k * len * 0.16;
      const pts: P2[] = [0, 1, 2, 3].map((s) => [x0 + s * len * 0.12, y0 + s * len * 0.04 + Math.sin(s * 1.4 + i * 2 + t * 3) * len * 0.035] as P2);
      const d = smoothPath(pts, 0.5);
      return <g key={i} opacity={0.9 * a}><path d={d} fill="none" stroke={G3} strokeWidth={w} strokeLinecap="round" transform="translate(0 3)" opacity={0.5} /><path d={d} fill="none" stroke={WHITE} strokeWidth={w} strokeLinecap="round" /></g>;
    })}
  </g>
);

/** An alarm clock: a round body with feet, a white face with twelve ticks, an hour hand, a minute hand and a second hand that ticks, two brass bells on top that shake
    when it rings (`ring` 0..1). The face is drawn on the plane y = 0.5 (it looks to the lower left, the mid tone's side). `time` is the seconds on the clock at t = 0; `speed` runs the hour and minute hands faster than real time (60 = a minute a second: the time passes), the second hand keeps its tick. */
export const IsoClock: React.FC<{ u: number; o: P2; t?: number; ring?: number; time?: number; speed?: number }> = ({ u, o, t = 0, ring = 0, time = 7 * 3600 + 58 * 60, speed = 1 }) => {
  const secs = time + t, fast = time + t * speed, h = ((fast / 3600) % 12) * 30, m = ((fast / 60) % 60) * 6, s = tickDeg(secs);
  const shake = ring * 3 * Math.sin(t * 46), face = 0.68, cz = 0.95, hand = (deg: number, len: number, back = 0): [number, number, number, number] => [-back * Math.sin((deg * Math.PI) / 180), cz - back * Math.cos((deg * Math.PI) / 180), len * Math.sin((deg * Math.PI) / 180), cz + len * Math.cos((deg * Math.PI) / 180)];
  const bell = (x: number, sgn: number) => { const c = at([x, 0.25, cz + 0.88], u, o); return <g transform={`rotate(${shake * sgn} ${c[0]} ${c[1]})`}><Polys polys={post(x, 0.25, cz + 0.76, cz + 0.98, 0.26, 0.2, u, o)} tones={ISO.brass} /></g>; };
  return (
    <g>
      <Polys polys={block([-0.62, 0.05, 0], [-0.42, 0.2, 0.25], u, o)} tones={ISO.dark} />
      <Polys polys={block([0.42, 0.05, 0], [0.62, 0.2, 0.25], u, o)} tones={ISO.dark} />
      {bell(-0.52, 1)}{bell(0.52, -1)}
      <Polys polys={block([-0.05, 0.22, cz + 0.78], [0.05, 0.28, cz + 0.98], u, o)} tones={ISO.metal} />
      <Polys polys={extrudeXZ(circlePts(0, cz, 0.84, 44), 0, 0.5, u, o)} tones={ISO.brass} />
      <OnPlane y={0.5} u={u} o={o}>
        <circle cx={0} cy={cz} r={face + 0.04} fill={ISO.brass[2]} />
        <circle cx={0} cy={cz} r={face} fill={WHITE} />
        {Array.from({ length: 12 }, (_, i) => { const a = (i * Math.PI) / 6, big = i % 3 === 0; return <line key={i} x1={Math.sin(a) * (face - (big ? 0.15 : 0.09))} y1={cz + Math.cos(a) * (face - (big ? 0.15 : 0.09))} x2={Math.sin(a) * (face - 0.03)} y2={cz + Math.cos(a) * (face - 0.03)} stroke={G1} strokeWidth={big ? 0.045 : 0.025} strokeLinecap="round" />; })}
        {(() => { const [x1, y1, x2, y2] = hand(h, 0.34, 0.05); return <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={BLACK} strokeWidth={0.07} strokeLinecap="round" />; })()}
        {(() => { const [x1, y1, x2, y2] = hand(m, 0.5, 0.06); return <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={BLACK} strokeWidth={0.05} strokeLinecap="round" />; })()}
        {(() => { const [x1, y1, x2, y2] = hand(s, 0.56, 0.12); return <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={RED} strokeWidth={0.022} strokeLinecap="round" />; })()}
        <circle cx={0} cy={cz} r={0.06} fill={BLACK} />
      </OnPlane>
    </g>
  );
};

/** A cup of coffee on a saucer: the cup flares up, a dark liquid with a rim, a handle; steam rises and two ripples spread on the surface. */
export const IsoCup: React.FC<{ u: number; o: P2; t?: number }> = ({ u, o, t = 0 }) => {
  const top = at([0, 0, 0.78], u, o);
  return (
    <g>
      <Polys polys={post(0, 0, 0, 0.08, 0.98, 0.9, u, o)} tones={ISO.plastic} />
      <Polys polys={block([0.48, -0.08, 0.5], [0.84, 0.08, 0.62], u, o)} tones={ISO.plastic} />
      <Polys polys={block([0.74, -0.08, 0.26], [0.86, 0.08, 0.62], u, o)} tones={ISO.plastic} />
      <Polys polys={block([0.4, -0.08, 0.26], [0.84, 0.08, 0.38], u, o)} tones={ISO.plastic} />
      <Polys polys={post(0, 0, 0.08, 0.78, 0.38, 0.56, u, o)} tones={ISO.plastic} />
      <polygon points={flatCircle(0, 0, 0.7, 0.5, u, o)} fill={COFFEE} />
      {[0, 1].map((i) => {
        const k = riseAt(t, i / 2, 2.2), r = 0.12 + 0.34 * k;
        return <polygon key={i} points={flatCircle(0, 0, 0.7, r, u, o)} fill="none" stroke={COFFEE_LIGHT} strokeWidth={u * 0.02} opacity={0.8 * (1 - k)} />;
      })}
      <polygon points={flatCircle(0, 0, 0.78, 0.56, u, o, 40)} fill="none" stroke={ISO.plastic[0]} strokeWidth={u * 0.03} />
      <Steam x={top[0]} y={top[1] - u * 0.15} h={u * 0.9} t={t} n={3} w={u * 0.04} />
    </g>
  );
};

// ------------------------------------------------------------------------------------------------------------------------------------- electric

/** A battery: a dark body with a label stripe, a metal cap, and a face (the plane y = 0.4) with four cells. `level` (0..1) is how many are full; while it charges the
    next cell blinks and the bolt glows. */
export const IsoBattery: React.FC<{ u: number; o: P2; t?: number; level?: number; charging?: boolean }> = ({ u, o, t = 0, level = 0.5, charging = true }) => {
  const full = Math.floor(level * 4 + 1e-9), p = pulse01(t, 0, 1.2);
  return (
    <g>
      {charging && <ellipse cx={at([0, 0.4, 0.4], u, o)[0]} cy={at([0, 0.4, 0.4], u, o)[1]} rx={u * 2.0} ry={u * 1.1} fill={YELLOW} opacity={0.1 + 0.12 * p} />}
      <Polys polys={block([1.0, -0.2, 0.22], [1.22, 0.2, 0.58], u, o)} tones={ISO.metal} />
      <Polys polys={block([-1.2, -0.4, 0], [1.0, 0.4, 0.8], u, o)} tones={ISO.dark} />
      <Polys polys={block([-1.2, -0.4, 0.8], [1.0, 0.4, 0.84], u, o)} tones={ISO.plastic} />
      <OnPlane y={0.4} u={u} o={o}>
        {[0, 1, 2, 3].map((i) => {
          const on = i < full ? 1 : i === full && charging ? 0.25 + 0.75 * p : 0;
          return <g key={i}><rect x={-1.05 + i * 0.5} y={0.14} width={0.42} height={0.52} rx={0.07} fill={ISO.dark[2]} /><rect x={-1.05 + i * 0.5} y={0.14} width={0.42} height={0.52} rx={0.07} fill={YELLOW} opacity={on} /></g>;
        })}
        {charging && <path d="M0.05 0.78 L-0.08 0.5 L0.0 0.5 L-0.05 0.28 L0.1 0.56 L0.02 0.56 Z" fill={YELLOW_D} transform="translate(0.5 0.02)" opacity={0.9} />}
      </OnPlane>
    </g>
  );
};

// ------------------------------------------------------------------------------------------------------------------------------------- body
// The organs are flat marks with a little relief, like the sleepy eyes (src/components/IsoBedroom.tsx): the shape faces the viewer (a heart seen from the side of an
// iso plane is not a heart any more), and its thickness is a few copies of the outline in the dark tone stepped to the lower right (light from the top-left), the face in
// the mid tone and a lighter inset at its upper left. `o` is the screen point of the centre, `u` the size: the heart is about 1.9 u wide, the brain 2.4 u.

/** A heart outline, centred on (0, 0), half width 1 (screen axes: y down). */
const heartOutline = (n = 64): P2[] => Array.from({ length: n }, (_, k) => {
  const a = (k / n) * Math.PI * 2;
  return [Math.pow(Math.sin(a), 3), -(13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a)) / 16] as P2;
});
/** The relief of a shape: the thickness as stepped copies to the lower right, then the face, then the lighter inset at the upper left. */
const Relief: React.FC<{ pts: P2[]; cx: number; cy: number; r: number; tones: readonly [string, string, string]; depth?: number }> = ({ pts, cx, cy, r, tones, depth = 0.16 }) => {
  const draw = (k: number, scale: number, dx = 0, dy = 0) => ptsAttr(pts.map(([x, y]) => [cx + dx + x * r * scale, cy + dy + y * r * scale] as P2));
  const steps = 5;
  return (
    <g>
      {Array.from({ length: steps }, (_, i) => { const k = (steps - i) / steps; return <polygon key={i} points={draw(k, 1, depth * r * k * 0.8, depth * r * k)} fill={tones[2]} stroke={tones[2]} strokeWidth={1} strokeLinejoin="round" />; })}
      <polygon points={draw(0, 1)} fill={tones[1]} stroke={tones[1]} strokeWidth={1} strokeLinejoin="round" />
      <polygon points={draw(0, 0.8, -0.1 * r, -0.12 * r)} fill={tones[0]} opacity={0.9} />
    </g>
  );
};

/** A heart: the relief shape in the organ tones that beats (lub-dub: it swells, then swells again), a ring that spreads out on each beat, a highlight and two vessels
    folded on its face. `bpm` beats a minute. */
export const IsoHeart: React.FC<{ u: number; o: P2; t?: number; bpm?: number }> = ({ u, o, t = 0, bpm = 72 }) => {
  const b = heartBeat(t, bpm), r = u * 0.95 * (1 + 0.09 * b), [cx, cy] = o;
  return (
    <g>
      <circle cx={cx} cy={cy} r={r * (1.15 + 0.5 * b)} fill="none" stroke={ISO.organ[0]} strokeWidth={u * 0.05} opacity={0.75 * b} />
      <rect x={cx + r * 0.02} y={cy - r * 0.98} width={r * 0.2} height={r * 0.34} rx={r * 0.08} fill={ISO.organ[2]} transform={`rotate(14 ${cx} ${cy})`} />
      <rect x={cx - r * 0.2} y={cy - r * 0.95} width={r * 0.17} height={r * 0.3} rx={r * 0.08} fill={ISO.organ[1]} transform={`rotate(-12 ${cx} ${cy})`} />
      <Relief pts={heartOutline()} cx={cx} cy={cy} r={r} tones={ISO.organ} />
      <circle cx={cx - r * 0.5} cy={cy - r * 0.18} r={r * 0.045} fill={WHITE} opacity={0.7} />
      <circle cx={cx + r * 0.52} cy={cy - r * 0.05} r={r * 0.04} fill={ISO.organ[0]} />
      <path d={`M ${cx - r * 0.62} ${cy - r * 0.3} Q ${cx - r * 0.7} ${cy - r * 0.62} ${cx - r * 0.38} ${cy - r * 0.7}`} fill="none" stroke={WHITE} strokeWidth={r * 0.07} strokeLinecap="round" opacity={0.75} />
      <path d={`M ${cx + r * 0.1} ${cy - r * 0.5} Q ${cx + r * 0.0} ${cy - r * 0.05} ${cx - r * 0.24} ${cy + r * 0.12}`} fill="none" stroke={ISO.organ[2]} strokeWidth={r * 0.05} strokeLinecap="round" />
      <path d={`M ${cx + r * 0.3} ${cy - r * 0.55} Q ${cx + r * 0.42} ${cy - r * 0.25} ${cx + r * 0.55} ${cy - r * 0.18}`} fill="none" stroke={ISO.organ[2]} strokeWidth={r * 0.04} strokeLinecap="round" />
    </g>
  );
};

/** The folds of the brain, in unit coordinates (half width 1, screen axes: y down): a few curves across each lobe. Each is a list of points. */
const BRAIN_FOLDS: P2[][] = [
  [[-0.78, -0.2], [-0.55, -0.42], [-0.3, -0.32], [-0.1, -0.5]], [[-0.82, 0.05], [-0.52, -0.08], [-0.34, 0.1], [-0.1, -0.02]],
  [[-0.7, 0.3], [-0.42, 0.18], [-0.28, 0.36], [-0.08, 0.26]], [[0.12, -0.5], [0.3, -0.34], [0.52, -0.46], [0.78, -0.2]],
  [[0.1, -0.02], [0.32, 0.1], [0.5, -0.06], [0.82, 0.06]], [[0.1, 0.26], [0.3, 0.36], [0.46, 0.2], [0.7, 0.3]],
];
const brainOutline = (n = 72): P2[] => Array.from({ length: n }, (_, k) => {
  const a = (k / n) * Math.PI * 2, r = 0.9 + 0.055 * Math.sin(5 * a) + 0.03 * Math.sin(9 * a + 1);
  return [r * Math.cos(a), 0.74 * r * Math.sin(a)] as P2;
});

/** A brain: the relief shape in the brain tones, the folds across it, a short stem under it and a yellow glow behind it. It breathes; `busy` (0..1) makes the glow brighter
    and the signals (small yellow dots) run along the folds faster and in more places. */
export const IsoBrain: React.FC<{ u: number; o: P2; t?: number; busy?: number }> = ({ u, o, t = 0, busy = 0.4 }) => {
  const [cx, cy] = o, r = u * 1.2 * breatheScale(t, 0, 0.025), glow = 0.14 + 0.22 * busy * pulse01(t, 0, 1.6 - 0.8 * busy) + 0.05 * busy;
  const dots = BRAIN_FOLDS.flatMap((fold, i) => (i / BRAIN_FOLDS.length < 0.3 + 0.7 * busy ? [{ i, fold }] : []));
  const P = ([x, y]: P2): P2 => [cx + x * r, cy + y * r];
  const along = (fold: P2[], k: number): P2 => { const f = k * (fold.length - 1), j = Math.min(fold.length - 2, Math.floor(f)), q = f - j; return [fold[j][0] + (fold[j + 1][0] - fold[j][0]) * q, fold[j][1] + (fold[j + 1][1] - fold[j][1]) * q]; };
  return (
    <g>
      <ellipse cx={cx} cy={cy} rx={r * 1.3} ry={r * 1.05} fill={YELLOW} opacity={glow} />
      <rect x={cx - r * 0.1} y={cy + r * 0.5} width={r * 0.22} height={r * 0.42} rx={r * 0.07} fill={ISO.brain[2]} />
      <Relief pts={brainOutline()} cx={cx} cy={cy} r={r} tones={ISO.brain} depth={0.12} />
      <path d={`M ${cx} ${cy - r * 0.62} Q ${cx + r * 0.05} ${cy} ${cx} ${cy + r * 0.62}`} fill="none" stroke={ISO.brain[2]} strokeWidth={r * 0.045} strokeLinecap="round" />
      {BRAIN_FOLDS.map((fold, i) => <path key={i} d={smoothPath(fold.map(P), 0.5)} fill="none" stroke={ISO.brain[2]} strokeWidth={r * 0.04} strokeLinecap="round" />)}
      {dots.map(({ i, fold }) => { const k = riseAt(t, i * 0.17, 1.3 - 0.6 * busy), p = P(along(fold, k)); return <circle key={i} cx={p[0]} cy={p[1]} r={r * 0.055} fill={YELLOW} opacity={Math.sin(Math.PI * k)} />; })}
      <path d={`M ${cx - r * 0.6} ${cy - r * 0.3} Q ${cx - r * 0.74} ${cy - r * 0.05} ${cx - r * 0.62} ${cy + r * 0.12}`} fill="none" stroke={WHITE} strokeWidth={r * 0.05} strokeLinecap="round" opacity={0.6} />
    </g>
  );
};

/** Eyes that blink on their own: the same drawing as SleepyEyes with the blink of src/alive.ts laid over the open eyes (only when they are open enough to blink). */
export const aliveOpen = (open: number, t: number, period = 3.4, phase = 0): number => (open > 0.7 ? open * (1 - 0.92 * blinkClosed(t, period, phase)) : open);
/** A small bob for a thing that floats (px), e.g. a floating icon next to the head. */
export const floatY = (t: number, phase = 0, px = 6): number => bobPx(t, phase, px);
