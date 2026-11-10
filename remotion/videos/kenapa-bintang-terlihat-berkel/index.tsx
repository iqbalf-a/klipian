/* Kenapa bintang terlihat berkelip?: one set (a flat house rooftop at night, set kind "night-rooftop": a concrete roof slab, a low parapet in the back corner,
   a water tank on its stand, a TV antenna, a plastic stool and a small telescope on a tripod; the city's roofs far behind), one hero (the star, a POINT of light,
   and its light coming down through the curved shell of air to the telescope) and one continuous camera (plan.ts CAM). The air is drawn as it really is: a
   thin shell that curves down to the horizon on both sides (B27.16), with warm and cold pockets drifting in it; each pocket bends the light a little, so the
   light wobbles at the telescope and the star goes bright and dim. The first frame is the last (the loop: every motion is periodic in 60 s). */
import React from "react";
import {
  BLACK, CaptionLayer, IsoBlock, Motes, SourceChip, StoryVideo, TipCard, TopText, YELLOW, YELLOW_D, block, cam2At, clamp01, cylinder, easeOutBack,
  isoAt, layerTransform, ptsAttr, smoothPath, springAt, toScreen, useFonts, type P2, type P3, type Poly, type SceneProps, type StoryT,
} from "../../src/design/index.ts";
import { G1, G2, G3, G4, HOT1, ISO, WHITE } from "../../src/tokens.ts";
import { mixRgb } from "../../src/natureGeometry.ts";
import { CAM, SCOPE_FRONT, STAR, T, shakeAt } from "./plan.ts";
import storyJson from "./story.json";
import { StingMark } from "../../src/components/StingMark.tsx";

export const story = storyJson as unknown as StoryT;

type Tri = readonly [string, string, string];
const U = 140, O: P2 = [563, 1633];                                            // one world unit = 1 m = 140 px; the telescope's tripod stands at the origin
const NIGHT = mixRgb(ISO.water[2], BLACK, 0.55);
const night = (t: Tri, k = 0.5): Tri => [mixRgb(t[0], NIGHT, k), mixRgb(t[1], NIGHT, k), mixRgb(t[2], NIGHT, k)];
const ROOF = night(ISO.floor, 0.52), WALLT = night(ISO.wall, 0.42), TANK = night(ISO.plastic, 0.45), TANKSTAND = night(ISO.dark, 0.25);
const SCOPE = night(ISO.plastic, 0.22), SCOPE_D = night(ISO.dark, 0.1), METALT = night(ISO.metal, 0.35), STOOL = night(ISO.labPlastic, 0.5);
const CITY = night([G3, G2, G1], 0.55), CITY_B = night([G4, G3, G2], 0.62);
const SKY_TOP = mixRgb(ISO.water[2], BLACK, 0.8), SKY_LOW = mixRgb(ISO.water[2], G2, 0.25);
const COLD = ISO.water[0], WARM = HOT1, AIR = mixRgb(ISO.water[0], WHITE, 0.4);
const FONT = { fontFamily: '"Outfit", sans-serif', fontWeight: 700 } as const;
const TAU = Math.PI * 2;

const polys = (ps: Poly[], tones: Tri, op = 1) => ps.map((p, i) => <polygon key={i} points={ptsAttr(p.pts)} fill={tones[p.tone]} stroke={tones[p.tone]} strokeWidth={1} strokeLinejoin="round" opacity={op} />);
const on = (c: number, a: number, b = 1e9) => clamp01((c - a) / 0.3) * (1 - clamp01((c - b) / 0.3));
/** A smooth noise in -1..1 that repeats every 60 s (so the loop's last frame is its first). */
const nz = (c: number, k: number) => (Math.sin(TAU * ((97 + 7 * k) * c / 60 + 0.13 * k)) + Math.sin(TAU * ((151 + 11 * k) * c / 60 + 0.31 * k)) * 0.7 + Math.sin(TAU * ((233 + 5 * k) * c / 60 + 0.57 * k)) * 0.5) / 2.2;

// ------------------------------------------------------------------------------------------------ the shell of air (a part of a circle around the earth's centre)
const F: P2 = [SCOPE_FRONT.x, SCOPE_FRONT.y], S: P2 = [STAR.x, STAR.y];
const EARTH: P2 = [F[0], F[1] + 1200];                                          // the observer stands on a circle of radius 1200 around it (the curve is shown, not to scale)
const RADII = [1200, 1290, 1400, 1530, 1680, 1900];                              // the boundaries of the five layers; the top of the air is at 1900
const arcPt = (r: number, th: number): P2 => [EARTH[0] + r * Math.sin(th), EARTH[1] - r * Math.cos(th)];
const arcPath = (r: number, a = -1.25, b = 1.25) => { const p = arcPt(r, a), q = arcPt(r, b); return `M ${p[0]} ${p[1]} A ${r} ${r} 0 0 1 ${q[0]} ${q[1]}`; };
/** The low star near the horizon: 15 degrees over it, to the right, on the same sky sphere as the high star. */
const LOW: P2 = [1825, 1035];
/** The planet: a small disc, just outside the air, to the upper left. */
const PLANET: P2 = [170, 640];

/** The far sky (p = 0.3): a gradient from deep blue to a paler band near the horizon, and many faint stars that twinkle a little. */
const SKY_STARS = Array.from({ length: 70 }, (_, i) => ({ x: ((i * 397) % 2600) - 760, y: ((i * 613) % 1500) - 640, r: 2 + (i % 3) * 1.2, ph: i * 0.37 }));
const Sky: React.FC<{ c: number }> = ({ c }) => (
  <g>
    {Array.from({ length: 40 }, (_, i) => <rect key={i} x={-2600} y={-2600 + i * 110} width={6400} height={111} fill={mixRgb(SKY_TOP, SKY_LOW, Math.min(1, Math.max(0, (i - 14) / 22)))} />)}
    {SKY_STARS.map((s, i) => <circle key={i} cx={s.x} cy={s.y} r={s.r} fill={WHITE} opacity={0.45 + 0.35 * nz(c, i % 9 + 20)} />)}
  </g>
);

/** The city far behind the roof (p = 0.35): two rows of low iso blocks with a few pale windows, along the two back edges. */
const CITY_O: P2 = [563, 2120];                                              // the city's base hides behind the parapet
const CITY_BLOCKS: { a: P3; b: P3 }[] = (() => {
  const out: { a: P3; b: P3 }[] = [], hs = [1.6, 2.6, 1.2, 3.4, 2.0, 4.2, 1.4, 2.8, 3.8, 1.8, 2.4, 4.6, 2.2, 3.0];
  for (let i = 0; i < 14; i++) { const y = 11 - i * 1.7; out.push({ a: [-14.5, y - 1.4, 0], b: [-13, y, Math.min(hs[i], 0.6 + i * 0.35)] }); }
  for (let i = 0; i < 14; i++) { const x = -12.6 + i * 1.8; out.push({ a: [x, -14.5, 0], b: [x + 1.5, -13, Math.min(hs[(i + 5) % 14], 0.6 + i * 0.4)] }); }
  return out.sort((p, q) => (p.a[0] + p.a[1]) - (q.a[0] + q.a[1]));
})();
const City: React.FC<{ c: number }> = ({ c }) => (
  <g>
    {CITY_BLOCKS.map((b, i) => (
      <g key={i}>
        {polys(block(b.a, b.b, 60, CITY_O), i % 2 ? CITY : CITY_B)}
        {b.b[2] > 2 && [0.35, 0.6].map((z, j) => { const p = isoAt([b.b[0], (b.a[1] + b.b[1]) / 2, b.b[2] * z], 60, CITY_O); return <rect key={j} x={p[0] - 6} y={p[1] - 8} width={12} height={16} fill={G4} opacity={0.25 + 0.15 * Math.sin(TAU * (c / 20 + i * 0.3 + j))} />; })}
      </g>
    ))}
  </g>
);

/** The layers of air: each band a soft tint, palest at the top (the air thins out), the boundaries faint lines. */
const AirShell: React.FC<{ c: number; glow: number }> = ({ glow }) => (
  <g>
    {RADII.slice(0, -1).map((r, i) => { const r2 = RADII[i + 1]; return <path key={i} d={arcPath((r + r2) / 2)} fill="none" stroke={AIR} strokeWidth={r2 - r} opacity={(0.07 - i * 0.01) * (1 + glow)} />; })}
    {RADII.slice(1).map((r, i) => <path key={`b${i}`} d={arcPath(r)} fill="none" stroke={AIR} strokeWidth={3} opacity={0.18 + 0.25 * glow} strokeDasharray="18 16" />)}
  </g>
);

/** The pockets of warm and cold air drifting in each layer: each moves two pockets along in 60 s (warm and cold take turns), so the loop closes. */
const SPACING = 0.16;
const Pockets: React.FC<{ c: number; warmK: number; coldK: number; ring: number }> = ({ c, warmK, coldK, ring }) => (
  <g>
    {RADII.slice(0, -1).map((r, i) => {
      const r2 = RADII[i + 1], mid = (r + r2) / 2, dir = i % 2 ? -1 : 1, span = SPACING * 16;
      return Array.from({ length: 16 }, (_, j) => {
        const th = -span / 2 + ((j * SPACING + dir * (2 * SPACING) * (c / 60) + 0.05 * i + span * 4) % span);
        const p = arcPt(mid, th), warm = (j + i) % 2 === 0, rx = mid * SPACING * 0.36 * (1 + 0.08 * Math.sin(TAU * (c / 6 + j * 0.3))), ry = (r2 - r) * 0.34;
        const k = warm ? warmK : coldK;
        return <g key={`${i}-${j}`} transform={`rotate(${(th * 180) / Math.PI} ${p[0]} ${p[1]})`}>
          <ellipse cx={p[0]} cy={p[1]} rx={rx} ry={ry} fill={warm ? WARM : COLD} opacity={0.1 + 0.22 * k} />
          {ring > 0.01 && <ellipse cx={p[0]} cy={p[1]} rx={rx * 0.8} ry={ry * 0.62} fill={WHITE} opacity={0.12 * ring} />}
        </g>;
      });
    })}
  </g>
);

/** The light of one source: points from the source down to the telescope's front, each pushed sideways by the pockets it crosses (more the further down). */
function lightPoints(from: P2, to: P2, c: number, amp: number, seed: number, n = 8): P2[] {
  const dx = to[0] - from[0], dy = to[1] - from[1], len = Math.hypot(dx, dy), nx = -dy / len, ny = dx / len;
  return Array.from({ length: n + 1 }, (_, j) => {
    const f = j / n, off = j === 0 ? 0 : amp * (7 + 6.5 * j) * nz(c * 0.7, seed + j);
    return [from[0] + dx * f + nx * off, from[1] + dy * f + ny * off] as P2;
  });
}
/** 0..1: how much of the light lands in the telescope now (the last wobble decides it). */
const brightAt = (c: number, amp: number, seed: number) => 1 - Math.min(0.85, amp * 0.5 * (1 + nz(c, seed + 40)) / 2 + amp * 0.12);

/** A star as it is seen: a point with a soft glow (no five points, B27.16); `b` is how bright it looks, `tint` its colour now. */
const Star: React.FC<{ p: P2; b: number; tint: string; s?: number }> = ({ p, b, tint, s = 1 }) => (
  <g>
    <circle cx={p[0]} cy={p[1]} r={(30 + 26 * b) * s} fill={tint} opacity={0.18 + 0.2 * b} />
    <circle cx={p[0]} cy={p[1]} r={(14 + 8 * b) * s} fill={tint} opacity={0.45 + 0.4 * b} />
    <circle cx={p[0]} cy={p[1]} r={(6 + 4 * b) * s} fill={WHITE} />
  </g>
);

/** A white plate with a bold text that pops in and out (world px of the layer it sits in). */
const Tag: React.FC<{ text: string; x: number; y: number; fs: number; c: number; a: number; b?: number; fill?: string }> = ({ text, x, y, fs, c, a, b = 1e9, fill = WHITE }) => {
  const k = on(c, a, b);
  if (k <= 0.01) return null;
  const w = text.length * fs * 0.52 + fs * 0.9, h = fs * 1.5, s = easeOutBack(clamp01((c - a) / 0.35));
  return (
    <g opacity={k} transform={`translate(${x} ${y}) scale(${s}) translate(${-x} ${-y})`}>
      <rect x={x - w / 2} y={y - h / 2} width={w} height={h} rx={h / 2} fill={fill} opacity={0.94} />
      <text x={x} y={y + fs * 0.36} fontSize={fs} textAnchor="middle" fill={BLACK} style={FONT}>{text}</text>
    </g>
  );
};

/** The roof: one concrete slab that bleeds past the frame, a seam grid, the low parapet along the two back edges with its coping. */
const Roof: React.FC = () => (
  <g>
    {polys(block([-2.4, -2.4, -0.4], [15, 15, 0], U, O), ROOF)}
    {Array.from({ length: 9 }, (_, i) => { const k = -1.4 + i * 1.6; const a = isoAt([k, -2.1, 0], U, O), b = isoAt([k, 15, 0], U, O), p = isoAt([-2.1, k, 0], U, O), q = isoAt([15, k, 0], U, O);
      return <g key={i} opacity={0.35}><line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={ROOF[2]} strokeWidth={3} /><line x1={p[0]} y1={p[1]} x2={q[0]} y2={q[1]} stroke={ROOF[2]} strokeWidth={3} /></g>; })}
    {polys(block([-2.4, -2.4, 0], [-2.1, 15, 0.9], U, O), WALLT)}
    {polys(block([-2.1, -2.4, 0], [15, -2.1, 0.9], U, O), WALLT)}
    {polys(block([-2.46, -2.46, 0.9], [-2.04, 15, 0.98], U, O), night(ISO.plastic, 0.45))}
    {polys(block([-2.04, -2.46, 0.9], [15, -2.04, 0.98], U, O), night(ISO.plastic, 0.45))}
  </g>
);

/** The water tank on its steel stand (dressing, left): it hums a little in the wind (a slow sway of its lid's highlight). */
const Tank: React.FC<{ c: number }> = ({ c }) => (
  <g>
    {[[-2.0, 1.4], [-1.0, 1.4], [-2.0, 2.4], [-1.0, 2.4]].map(([x, y], i) => <g key={i}>{polys(block([x, y, 0], [x + 0.1, y + 0.1, 0.7], U, O), TANKSTAND)}</g>)}
    {polys(block([-2.0, 1.4, 0.7], [-0.9, 2.5, 0.78], U, O), TANKSTAND)}
    {polys(cylinder([-1.45, 1.95, 0.78], [-1.45, 1.95, 1.95], 0.56, 0.56, [1, 0, 0], [0, 1, 0], U, O), TANK)}
    {polys(cylinder([-1.45, 1.95, 1.95], [-1.45, 1.95, 2.05], 0.3, 0.22, [1, 0, 0], [0, 1, 0], U, O), TANK)}
    {(() => { const p = isoAt([-1.45, 1.95, 2.05], U, O); return <ellipse cx={p[0] - 6 + 3 * Math.sin(TAU * c / 7.5)} cy={p[1] + 2} rx={12} ry={6} fill={WHITE} opacity={0.18} />; })()}
  </g>
);

/** The TV antenna (dressing, right): a mast on a small foot, cross bars that sway a little in the wind. */
const Antenna: React.FC<{ c: number }> = ({ c }) => {
  const base: P3 = [1.5, -1.7, 0], top = isoAt([1.5, -1.7, 2.7], U, O), sw = 1.6 * Math.sin(TAU * c / 6);
  return (
    <g>
      {polys(block([1.3, -1.9, 0], [1.7, -1.5, 0.12], U, O), TANKSTAND)}
      {polys(cylinder([base[0], base[1], 0.12], [base[0], base[1], 2.7], 0.035, 0.03, [1, 0, 0], [0, 1, 0], U, O), METALT)}
      <g transform={`rotate(${sw} ${top[0]} ${top[1] + 120})`}>
        {[0, 1, 2, 3].map((i) => { const a = isoAt([1.5 - 0.5 + i * 0.05, -1.7 - 0.5, 2.6 - i * 0.22], U, O), b = isoAt([1.5 + 0.5 - i * 0.05, -1.7 + 0.5, 2.6 - i * 0.22], U, O);
          return <line key={i} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={METALT[1]} strokeWidth={5} strokeLinecap="round" />; })}
      </g>
    </g>
  );
};

/** A plastic stool next to the telescope (dressing): a seat on four legs. */
const Stool: React.FC = () => (
  <g>
    {[[0.92, 0.72], [1.22, 0.72], [0.92, 1.02], [1.22, 1.02]].map(([x, y], i) => <g key={i}>{polys(block([x, y, 0], [x + 0.06, y + 0.06, 0.42], U, O), STOOL)}</g>)}
    <IsoBlock a={[0.86, 0.66, 0.42]} b={[1.34, 1.14, 0.47]} u={U} o={O} tones={STOOL} />
  </g>
);

/** The telescope: three legs, a mount, and the white tube that points at the star (its front end is SCOPE_FRONT). */
const D: P3 = [-0.461, -0.293, 0.838], M: P3 = [0, 0, 1.1];
const at = (k: number): P3 => [M[0] + D[0] * k, M[1] + D[1] * k, M[2] + D[2] * k];
const E1: P3 = [0.537, -0.844, 0], E2: P3 = [0.707, 0.45, 0.545];                // two unit vectors across the tube
const LEGS: P3[] = [[0.45, 0, 0], [-0.22, 0.4, 0], [-0.22, -0.4, 0]];
const Telescope: React.FC = () => (
  <g>
    {LEGS.filter((p) => p[1] <= 0).map((p, i) => <g key={i}>{polys(cylinder(p, [0, 0, 1.0], 0.025, 0.025, [0, 0, 1], [1, 0, 0], U, O), SCOPE_D)}</g>)}
    {polys(block([-0.08, -0.08, 0.95], [0.08, 0.08, 1.1], U, O), SCOPE_D)}
    {polys(cylinder(at(-0.4), at(0.6), 0.075, 0.095, E1, E2, U, O), SCOPE)}
    {polys(cylinder(at(0.46), at(0.6), 0.1, 0.1, E1, E2, U, O), SCOPE_D)}
    {polys(cylinder(at(-0.44), at(-0.4), 0.04, 0.04, E1, E2, U, O), SCOPE_D)}
    {LEGS.filter((p) => p[1] > 0).map((p, i) => <g key={i}>{polys(cylinder(p, [0, 0, 1.0], 0.025, 0.025, [0, 0, 1], [1, 0, 0], U, O), SCOPE_D)}</g>)}
  </g>
);

/** The light of the star: the wobbling path and the dashed straight line it would take without the air (belok). */
const Light: React.FC<{ pts: P2[]; b: number; w?: number; op?: number }> = ({ pts, b, w = 12, op = 1 }) => (
  <g opacity={op}>
    <path d={smoothPath(pts)} fill="none" stroke={YELLOW} strokeWidth={w * 2.2} strokeLinecap="round" opacity={0.18 * (0.5 + b)} />
    <path d={smoothPath(pts)} fill="none" stroke={YELLOW} strokeWidth={w} strokeLinecap="round" opacity={0.55 + 0.4 * b} />
    <path d={smoothPath(pts)} fill="none" stroke={WHITE} strokeWidth={w * 0.32} strokeLinecap="round" opacity={0.5 + 0.5 * b} />
  </g>
);

/** A bracket along a path in the air (ufuk: the short way and the long way through the air). */
const Path2: React.FC<{ a: P2; b: P2; k: number; color: string }> = ({ a, b, k, color }) => k > 0.01 ? (
  <line x1={a[0]} y1={a[1]} x2={a[0] + (b[0] - a[0]) * k} y2={a[1] + (b[1] - a[1]) * k} stroke={color} strokeWidth={14} strokeLinecap="round" strokeDasharray="2 26" />
) : null;

/** Where a line from `a` towards `b` leaves the air (radius 1900). */
const exitAir = (a: P2, b: P2): P2 => {
  const dx = b[0] - a[0], dy = b[1] - a[1], fx = a[0] - EARTH[0], fy = a[1] - EARTH[1], A = dx * dx + dy * dy, B = 2 * (fx * dx + fy * dy), Cc = fx * fx + fy * fy - RADII.at(-1)! ** 2;
  const s = (-B + Math.sqrt(B * B - 4 * A * Cc)) / (2 * A);
  return [a[0] + dx * s, a[1] + dy * s];
};

const Scene = ({ beat, t, clock }: SceneProps) => {
  useFonts();
  const c = clock, cam = cam2At(CAM, c), kind = beat.kind, isOutro = kind === "outro", hide = isOutro || kind === "sting";
  const amp = shakeAt(c), pts = lightPoints(S, F, c, amp, 1), b = brightAt(c, amp, 1);
  const tintK = on(c, T.colour, 33.6), tintPick = nz(c * 0.5, 13);
  const tint = tintK > 0.01 ? mixRgb(YELLOW, tintPick > 0.2 ? COLD : tintPick < -0.2 ? WHITE : YELLOW, tintK) : YELLOW;
  const ghost = on(c, T.ghost, 25.8), lens = on(c, T.lens, 25.8);
  const planetK = on(c, T.planet, 40.8), rays = on(c, T.rays, 40.8);
  const lowK = on(c, T.low, 46.8), lowB = brightAt(c, 2.2, 7), lowPts = lightPoints(LOW, F, c, 2.2, 7);
  const highPath = clamp01((c - T.pathHigh) / 0.6) * (1 - clamp01((c - 46.8) / 0.3)), lowPath = clamp01((c - T.pathLow) / 0.8) * (1 - clamp01((c - 46.8) / 0.3));
  const warmK = on(c, T.warm, 17.6), coldK = on(c, T.cold, 17.6);
  const meter = on(c, T.meter, 33.6);
  const kicker = kind === "hook" ? "LANGIT MALAM" : kind === "result" ? "JAWABANNYA" : kind === "tips" ? "COBA SENDIRI" : "INTIP BINTANG";
  return (
    <svg width={1080} height={1920} viewBox="0 0 1080 1920">
      <defs>
        {/* nothing yellow or warm behind the top text (B27.11): the light, the stars and the warm pockets are cut off above y 350 of the screen */}
        <clipPath id="belowTitle"><rect x={-20} y={350} width={1120} height={1600} /></clipPath>
      </defs>
      <g transform={layerTransform(cam, 0.3)}><Sky c={c} /></g>
      <g transform={layerTransform(cam, 0.35)}><City c={c} /></g>
      <g transform={layerTransform(cam, 1)}><AirShell c={c} glow={on(c, T.layers, 17.6) + 0.5 * lowK} /></g>
      <g clipPath="url(#belowTitle)">
        <g transform={layerTransform(cam, 1)}>
          <Pockets c={c} warmK={warmK} coldK={coldK} ring={lens} />
          {/* the planet: a small steady disc; in its beat its light comes as many thin paths that wobble apart and add up to a steady glow */}
          <g>
            <circle cx={PLANET[0]} cy={PLANET[1]} r={34 + 10 * planetK} fill={mixRgb(ISO.sand[0], WHITE, 0.3)} opacity={0.22 + 0.15 * planetK} />
            <circle cx={PLANET[0]} cy={PLANET[1]} r={13 + 5 * planetK} fill={ISO.sand[0]} />
            <rect x={PLANET[0] - 13 - 5 * planetK} y={PLANET[1] - 3} width={26 + 10 * planetK} height={4} fill={ISO.sand[2]} opacity={0.7} />
          </g>
          {/* jauh: rings that say "a point" */}
          {on(c, T.rings, 9.6) > 0.01 && [0, 1, 2].map((i) => { const k = ((c - T.rings) / 1.6 + i / 3) % 1; return <circle key={i} cx={S[0]} cy={S[1]} r={30 + 110 * k} fill="none" stroke={WHITE} strokeWidth={4} opacity={(1 - k) * 0.6 * on(c, T.rings, 9.6)} />; })}
        </g>
      </g>
      <g transform={layerTransform(cam, 1)}>
        <Roof />
        <Tank c={c} />
        <Antenna c={c} />
      </g>
      <g clipPath="url(#belowTitle)">
        <g transform={layerTransform(cam, 1)}>
          {rays > 0.01 && [-8, -4, 0, 4, 8].map((d, i) => <Light key={i} pts={lightPoints([PLANET[0] + d, PLANET[1]], [F[0] + d * 0.6, F[1]], c + i * 0.37, 1, 20 + i)} b={0.8} w={4} op={rays * 0.75} />)}
          {/* the low star near the horizon (ufuk): its light crosses far more air, so it wobbles much more */}
          {lowK > 0.01 && <g opacity={lowK}><Light pts={lowPts} b={lowB} w={8} op={0.8} /><Star p={LOW} b={lowB} tint={mixRgb(YELLOW, nz(c, 31) > 0 ? COLD : WHITE, 0.5)} s={1.7} /></g>}
          <Path2 a={F} b={exitAir(F, S)} k={highPath} color={WHITE} />
          <Path2 a={F} b={exitAir(F, LOW)} k={lowPath} color={WARM} />
          {/* belok: the straight way the light would go without the air */}
          {ghost > 0.01 && <line x1={S[0]} y1={S[1]} x2={F[0]} y2={F[1]} stroke={WHITE} strokeWidth={5} strokeDasharray="14 14" opacity={0.6 * ghost} />}
          <Light pts={pts} b={b} />
          <g opacity={clamp01((toScreen(cam, S)[1] - 380) / 90)}><Star p={S} b={b} tint={tint} /></g>
        </g>
      </g>
      <g transform={layerTransform(cam, 1)}>
        <Telescope />
        <Stool />
        {/* the telescope's mouth glows with what arrives: bright, dim */}
        <circle cx={F[0]} cy={F[1]} r={18 + 10 * b} fill={YELLOW} opacity={0.15 + 0.5 * b * (1 - lowK * 0.4)} />
        {!hide && <>
          <Tag text="titik cahaya" x={S[0] + 210} y={S[1] - 10} fs={46} c={c} a={T.tagTitik} b={9.8} fill={YELLOW} />
          <Tag text="sangat jauh" x={S[0] - 190} y={S[1] + 110} fs={42} c={c} a={T.tagJauh} b={9.8} />
          <Tag text="hangat" x={arcPt(1460, -0.18)[0]} y={arcPt(1460, -0.18)[1]} fs={44} c={c} a={T.warm} b={17.6} fill={mixRgb(WARM, WHITE, 0.4)} />
          <Tag text="dingin" x={arcPt(1605, 0.12)[0]} y={arcPt(1605, 0.12)[1]} fs={44} c={c} a={T.cold} b={17.6} fill={mixRgb(COLD, WHITE, 0.4)} />
          <Tag text="udara bergolak" x={F[0] + 250} y={F[1] - 260} fs={44} c={c} a={T.tagGolak} b={17.6} />
          <Tag text="lurus" x={(S[0] + F[0]) / 2 - 150} y={(S[1] + F[1]) / 2 - 120} fs={40} c={c} a={T.tagLurus} b={25.8} />
          <Tag text="dibelokkan" x={(S[0] + F[0]) / 2 + 200} y={(S[1] + F[1]) / 2 + 40} fs={44} c={c} a={T.tagBelok} b={25.8} fill={YELLOW} />
          <Tag text="lensa goyang" x={(S[0] + F[0]) / 2 - 120} y={(S[1] + F[1]) / 2 + 200} fs={42} c={c} a={T.tagLensa} b={25.8} />
          <Tag text="planet: tenang" x={PLANET[0] + 30} y={PLANET[1] - 100} fs={42} c={c} a={T.tagPlanet} b={40.8} />
          <Tag text="cakram kecil" x={PLANET[0] + 40} y={PLANET[1] + 90} fs={40} c={c} a={T.tagCakram} b={40.8} fill={mixRgb(ISO.sand[0], WHITE, 0.4)} />
          <Tag text="bintang: berkelip" x={S[0] + 190} y={S[1] - 110} fs={40} c={c} a={T.tagBintang} b={40.8} fill={YELLOW} />
          <Tag text="jalur pendek" x={F[0] + 150} y={F[1] - 520} fs={74} c={c} a={T.pathHigh + 0.4} b={46.8} />
          <Tag text="jalur panjang" x={(F[0] + LOW[0]) / 2 + 60} y={(F[1] + LOW[1]) / 2 + 120} fs={74} c={c} a={T.pathLow + 0.5} b={46.8} fill={mixRgb(WARM, WHITE, 0.3)} />
          <Tag text="udara lebih tebal" x={LOW[0] - 520} y={LOW[1] - 190} fs={70} c={c} a={T.tagTebal} b={46.8} fill={YELLOW} />
        </>}
      </g>
      <g transform={layerTransform(cam, 1.3)}><Motes t={c} n={14} opacity={0.12} /></g>
      {/* kedip: a meter of how much light arrives, drawn over the last 3 seconds; the dot takes the star's colour */}
      {!hide && meter > 0.01 && (() => {
        const x0 = 640, x1 = 900, y0 = 820, y1 = 1150, n = 48;
        const trace = Array.from({ length: n + 1 }, (_, i) => { const tt = c - 3 + (3 * i) / n, bb = brightAt(tt, shakeAt(tt), 1); return [x0 + ((x1 - x0) * i) / n, y1 - 30 - bb * (y1 - y0 - 80)] as P2; });
        const last = trace[n];
        return (
          <g opacity={meter} transform={`translate(0 ${(1 - springAt(c, T.meter, true)) * 30})`}>
            <rect x={x0 - 40} y={y0 - 90} width={x1 - x0 + 80} height={y1 - y0 + 120} rx={36} fill={WHITE} opacity={0.94} />
            <text x={(x0 + x1) / 2} y={y0 - 38} fontSize={36} textAnchor="middle" fill={BLACK} style={{ fontFamily: '"DM Mono", monospace', fontWeight: 400 }}>CAHAYA MASUK</text>
            <line x1={x0} y1={y1 - 30} x2={x1} y2={y1 - 30} stroke={G3} strokeWidth={4} />
            <path d={smoothPath(trace)} fill="none" stroke={YELLOW_D} strokeWidth={8} strokeLinecap="round" />
            <circle cx={last[0]} cy={last[1]} r={18} fill={tint} stroke={YELLOW_D} strokeWidth={4} />
          </g>
        );
      })()}
      {!hide && <>
        <Tag text="terang" x={780} y={1260} fs={46} c={c} a={T.tagTerang} b={33.6} fill={YELLOW} />
        <Tag text="redup" x={780} y={1360} fs={46} c={c} a={T.tagRedup} b={33.6} fill={G4} />
        <Tag text="warna berganti" x={760} y={1460} fs={44} c={c} a={T.tagWarna} b={33.6} fill={mixRgb(COLD, WHITE, 0.4)} />
        <SourceChip x={540} y={1430} text="Wikipedia: Twinkling" t={c} start={T.chip} end={40.8} align="middle" />
        <TipCard x={100} y={1080} w={880} n={1} title="Titik tenang biasanya planet" keyword="planet" t={c} start={T.card1} end={55.8} />
        <TipCard x={100} y={1240} w={880} n={2} title="Tinggi di atas: jarang berkelip" keyword="Tinggi" t={c} start={T.card2} end={55.8} />
        <TipCard x={100} y={1400} w={880} n={3} title="Hubble di angkasa: tanpa kelip" keyword="Hubble" t={c} start={T.card3} end={55.8} />
        <SourceChip x={540} y={1590} text="Wikipedia: Hubble Space Telescope" t={c} start={T.chipTips} end={55.8} align="middle" />
      </>}
      {/* the text layers: kicker + headline on top (not on the sting or the outro), the caption below; the mascot only in the sting */}
      {!hide && <TopText key={beat.id} kicker={kicker} headline={beat.text} t={t} onDark />}
      {!hide && <CaptionLayer beat={beat} t={t} />}
      {kind === "sting" && (() => {
        const p = springAt(c, 3.0), p2 = springAt(c, 3.25);
        return <g>
          <StingMark slug="kenapa-bintang-terlihat-berkel" t={t} clock={c} p={p} p2={p2} />
        </g>;
      })()}
    </svg>
  );
};

export const Video: React.FC<{ story: StoryT; layoutDebug?: boolean }> = (p) => <StoryVideo story={p.story} scene={Scene} layoutDebug={p.layoutDebug} />;
