/* Kenapa bulan selalu menghadap kita dengan sisi yang sama?: one set (kind "space": a dark sky, the Earth and the Moon as spheres, a ring for the orbit), one hero (the
   Moon, a sphere with its dark seas on the near side and craters on the far side, and a pole on the near side that points at the Earth) and one continuous camera
   (plan.ts camAt). The Moon goes round the Earth once in 30 s and turns once in the same 30 s, so the pole always points at the Earth (the story). The first frame is
   the last (loop). Real shapes (B27.16): a sphere for the Earth and the Moon (not a flat disc), a ring in the plane of the orbit, a tidal bulge drawn as an ellipse
   stretched towards the Earth (exaggerated, and labelled so). Sizes and distances are not to scale (the Moon is 0.27 of the Earth's width, 60 Earth widths away). */
import React from "react";
import {
  BLACK, CaptionLayer, IsoBlock, Label, Mascot, StoryVideo, TopText, YELLOW, YELLOW_D, clamp01, cylinder, easeInOut, easeOutBack, iso, isoAt, layerTransform, ptsAttr,
  springAt, toScreen, useFonts, type P2, type P3, type SceneProps, type StoryT,
} from "../../src/design/index.ts";
import { ISO, WHITE } from "../../src/tokens.ts";
import { mixRgb } from "../../src/natureGeometry.ts";
import { EARTH, GHOST_PHI, SET, SPHERE_K, T, TH0, camAt, ghostTheta, ghostPos, moonPhi, moonPos, screenOf, theta, worldOf } from "./plan.ts";
import storyJson from "./story.json";

export const story = storyJson as unknown as StoryT;

const SPACE = mixRgb(BLACK, ISO.water[2], 0.32), SPACE_FAR = mixRgb(BLACK, ISO.water[2], 0.14);
const MOON = ISO.stone, EARTH_T = ISO.water, LAND = ISO.grass;
const MARIA = mixRgb(MOON[2], MOON[1], 0.25), RING = WHITE;
const V: P3 = [1 / Math.sqrt(3), 1 / Math.sqrt(3), 1 / Math.sqrt(3)];
const dot3 = (a: P3, b: P3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm3 = (a: P3): P3 => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const cross3 = (a: P3, b: P3): P3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const rotZ = (v: P3, phi: number): P3 => [v[0] * Math.cos(phi) - v[1] * Math.sin(phi), v[0] * Math.sin(phi) + v[1] * Math.cos(phi), v[2]];
const lonlat = (lon: number, lat: number): P3 => { const a = (lon * Math.PI) / 180, b = (lat * Math.PI) / 180; return [Math.cos(b) * Math.cos(a), Math.cos(b) * Math.sin(a), Math.sin(b)]; };
const on = (c: number, a: number, b = 1e9) => clamp01((c - a) / 0.35) * (1 - clamp01((c - b) / 0.35));
const pop = (c: number, a: number) => easeOutBack(clamp01((c - a) / 0.5));

/** A round patch on a unit sphere (centre `d` in world, angular radius `ang`), as the outline on the screen. The part that turns away is pushed to the limb. */
function patch(d: P3, ang: number, R: number, n = 26): P2[] | null {
  if (dot3(d, V) < -Math.sin(ang) - 0.02) return null;
  const up: P3 = Math.abs(d[2]) > 0.95 ? [1, 0, 0] : [0, 0, 1];
  const e1 = norm3(cross3(up, d)), e2 = cross3(d, e1), out: P2[] = [];
  for (let k = 0; k < n; k++) {
    const th = (k / n) * Math.PI * 2;
    let p: P3 = [d[0] * Math.cos(ang) + Math.sin(ang) * (e1[0] * Math.cos(th) + e2[0] * Math.sin(th)), d[1] * Math.cos(ang) + Math.sin(ang) * (e1[1] * Math.cos(th) + e2[1] * Math.sin(th)), d[2] * Math.cos(ang) + Math.sin(ang) * (e1[2] * Math.cos(th) + e2[2] * Math.sin(th))];
    const s = dot3(p, V);
    if (s < 0) p = norm3([p[0] - s * V[0], p[1] - s * V[1], p[2] - s * V[2]]);
    out.push(iso([p[0] * R, p[1] * R, p[2] * R], 1));
  }
  return out;
}

type Patch = { lon: number; lat: number; a: number; kind: "sea" | "crater" | "land" };
const MOON_PATCHES: Patch[] = [
  // the near side (centred on the point under the pole): the big dark seas
  { lon: -28, lat: 26, a: 0.46, kind: "sea" }, { lon: 14, lat: 18, a: 0.36, kind: "sea" }, { lon: 34, lat: -8, a: 0.3, kind: "sea" }, { lon: -8, lat: -26, a: 0.3, kind: "sea" },
  { lon: -48, lat: -6, a: 0.2, kind: "sea" }, { lon: 4, lat: 52, a: 0.18, kind: "crater" }, { lon: 20, lat: -50, a: 0.22, kind: "crater" },
  // the far side: craters, almost no seas
  { lon: 180, lat: 18, a: 0.2, kind: "crater" }, { lon: 160, lat: -34, a: 0.24, kind: "crater" }, { lon: 204, lat: 8, a: 0.17, kind: "crater" }, { lon: 192, lat: -52, a: 0.24, kind: "crater" },
  { lon: 148, lat: 38, a: 0.16, kind: "crater" }, { lon: 214, lat: 48, a: 0.18, kind: "crater" }, { lon: 172, lat: 30, a: 0.12, kind: "sea" }, { lon: 130, lat: -8, a: 0.15, kind: "crater" },
  { lon: 226, lat: -20, a: 0.15, kind: "crater" },
];
const EARTH_PATCHES: Patch[] = [
  { lon: 20, lat: 20, a: 0.62, kind: "land" }, { lon: 100, lat: -12, a: 0.5, kind: "land" }, { lon: 200, lat: 34, a: 0.56, kind: "land" }, { lon: 280, lat: -24, a: 0.46, kind: "land" }, { lon: 330, lat: 52, a: 0.3, kind: "land" },
];

/** A sphere in the kit's light (from the top left): the dark tone is the disc, the mid tone a disc moved to the top left, the light tone a smaller one: three tones. */
const Sphere: React.FC<{ id: string; x: number; y: number; R: number; phi: number; tones: readonly [string, string, string]; patches: Patch[]; op?: number; ink?: string; seaFill?: string }> = ({ id, x, y, R, phi, tones, patches, op = 1, ink, seaFill }) => {
  const sr = R * SPHERE_K, line = ink ?? mixRgb(tones[2], BLACK, 0.4);
  return (
    <g transform={`translate(${x} ${y})`} opacity={op}>
      <defs><clipPath id={`sp-${id}`}><circle r={sr} /></clipPath></defs>
      <circle r={sr} fill={tones[2]} />
      <g clipPath={`url(#sp-${id})`}>
        <circle cx={-0.1 * sr} cy={-0.1 * sr} r={0.94 * sr} fill={tones[1]} />
        <circle cx={-0.3 * sr} cy={-0.3 * sr} r={0.5 * sr} fill={tones[0]} />
        {patches.map((p, i) => {
          const pts = patch(rotZ(lonlat(p.lon, p.lat), phi), p.a, R);
          if (!pts) return null;
          return p.kind === "crater"
            ? <polygon key={i} points={ptsAttr(pts)} fill={mixRgb(tones[1], tones[2], 0.35)} stroke={line} strokeWidth={Math.max(1.5, R * 0.035)} strokeLinejoin="round" opacity={0.9} />
            : <polygon key={i} points={ptsAttr(pts)} fill={p.kind === "land" ? LAND[1] : (seaFill ?? MARIA)} stroke={p.kind === "land" ? LAND[2] : line} strokeWidth={Math.max(1.2, R * 0.025)} strokeLinejoin="round" opacity={0.92} />;
        })}
      </g>
      <circle r={sr} fill="none" stroke={line} strokeWidth={Math.max(2, R * 0.05)} />
    </g>
  );
};

/** The pole on the near side: a thin rod out of the surface along the direction the near side looks, with a ball on its tip. It shows at any angle where the dark seas are hidden. */
const Pole: React.FC<{ x: number; y: number; R: number; phi: number; k?: number; tone?: readonly [string, string, string]; ball?: string; keyId: string }> = ({ x, y, R, phi, k = 1, tone = ISO.metal, ball = YELLOW, keyId }) => {
  const n: P3 = [Math.cos(phi), Math.sin(phi), 0], e1: P3 = [-Math.sin(phi), Math.cos(phi), 0], e2: P3 = [0, 0, 1];
  const a: P3 = [n[0] * R * 0.96, n[1] * R * 0.96, 0], len = 1.15 * k, b: P3 = [n[0] * R * (0.96 + len), n[1] * R * (0.96 + len), 0];
  const polys = cylinder(a, b, R * 0.045, R * 0.045, e1, e2, 1, [x, y], 16);
  const tip = isoAt(b, 1, [x, y]);
  return <g key={keyId} opacity={k > 0.02 ? 1 : 0}>
    {polys.map((p, i) => <polygon key={i} points={ptsAttr(p.pts)} fill={tone[p.tone]} stroke={tone[2]} strokeWidth={1.5} strokeLinejoin="round" />)}
    <circle cx={tip[0]} cy={tip[1]} r={R * 0.17 * k} fill={ball} stroke={YELLOW_D} strokeWidth={Math.max(2, R * 0.04)} />
  </g>;
};

/** The Moon with its pole, in the right drawing order (the pole behind the Moon when it points away from us). */
const MoonWithPole: React.FC<{ id: string; x: number; y: number; R: number; phi: number; op?: number; tones?: readonly [string, string, string]; pole?: boolean; ghost?: boolean }> = ({ id, x, y, R, phi, op = 1, tones = MOON, pole = true, ghost }) => {
  const away = Math.cos(phi) + Math.sin(phi) < 0;
  const p = pole ? <Pole x={x} y={y} R={R} phi={phi} keyId={id + "p"} tone={ghost ? ISO.dark : ISO.metal} ball={ghost ? WHITE : YELLOW} /> : null;
  return <g opacity={op}>{away && p}<Sphere id={id} x={x} y={y} R={R} phi={phi} tones={tones} patches={MOON_PATCHES} seaFill={ghost ? mixRgb(tones[2], tones[1], 0.4) : undefined} />{!away && p}</g>;
};

/** Points of a circle in the plane z = 0 around a world centre, between two angles, in the world px of the set. */
const arcPts = (centre: P3, r: number, a0: number, a1: number, n = 48): P2[] => Array.from({ length: n + 1 }, (_, k) => { const a = a0 + ((a1 - a0) * k) / n; return isoAt([centre[0] + r * Math.cos(a), centre[1] + r * Math.sin(a), centre[2]], 1, [SET.cx, SET.cy]); });
const line = (pts: P2[]) => pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");
const BACK: [number, number] = [(3 * Math.PI) / 4, (7 * Math.PI) / 4], FRONT: [number, number] = [-Math.PI / 4, (3 * Math.PI) / 4];

const Stars: React.FC<{ c: number }> = ({ c }) => (
  <g>
    {Array.from({ length: 150 }, (_, i) => {
      const x = -1700 + ((i * 397) % 4300), y = -1500 + ((i * 613) % 4700), r = 2 + (i % 4) * 1.1, tw = 0.55 + 0.45 * Math.sin((c / (i % 2 ? 3 : 6) + i * 0.17) * Math.PI * 2);
      return <circle key={i} cx={x} cy={y} r={r} fill={WHITE} opacity={tw * (0.5 + (i % 3) * 0.2)} />;
    })}
  </g>
);

const Arrow2: React.FC<{ x1: number; y1: number; x2: number; y2: number; color: string; k: number; w?: number }> = ({ x1, y1, x2, y2, color, k, w = 8 }) => {
  const ex = x1 + (x2 - x1) * k, ey = y1 + (y2 - y1) * k, a = Math.atan2(y2 - y1, x2 - x1), s = w * 2.4;
  return <g opacity={k > 0 ? 1 : 0}><line x1={x1} y1={y1} x2={ex} y2={ey} stroke={color} strokeWidth={w} strokeLinecap="round" />
    <polygon points={`${ex},${ey} ${ex - s * Math.cos(a - 0.5)},${ey - s * Math.sin(a - 0.5)} ${ex - s * Math.cos(a + 0.5)},${ey - s * Math.sin(a + 0.5)}`} fill={color} /></g>;
};

const Scene = ({ beat, t, clock }: SceneProps) => {
  useFonts();
  const c = clock;
  const cam = camAt(c);
  const th = theta(c), phi = moonPhi(c), mp = moonPos(c), gp = ghostPos(c), gth = ghostTheta(c);
  const depthOf = (a: number) => Math.cos(a) + Math.sin(a);                         // > 0: in front of the Earth (nearer the viewer)
  const MR = SET.moonR;
  const earthPhi = (c / 5) * Math.PI * 2;                                           // the Earth turns once in 5 s (12 turns in 60 s: the loop)

  // ---- what the beats add: every one has its time in plan.ts T (and sfx.ts reads the same)
  const ringK = clamp01((c - T.ring) / (T.ringEnd - T.ring)) * (1 - clamp01((c - 56.2) / 1.6)) ;
  const lap = on(c, T.lblLap, 12.0);
  const lapStart = theta(T.lblLap);
  const lapArc = lap > 0.02 && c < 12.1 ? arcPts(worldOf(0, 0), SET.ring, lapStart, Math.max(lapStart + 0.001, th), 80) : null;
  const dots = Array.from({ length: 8 }, (_, i) => ({ a: TH0 + (i * Math.PI) / 4, k: on(c, T.dot0 + i * 0.2, 12.0) }));
  const snapAng = [300, 350, 40, 80].map((d) => (d * Math.PI) / 180);        // the stamps sit where the Moon is not during this beat
  const snapK = [0, 1, 2, 3].map((i) => pop(c, T.snap0 + i * T.snapGap) * (1 - clamp01((c - T.snapOut) / 0.5)));
  const lineK = on(c, T.snap0 - 0.2, T.snapOut);
  const ghostK = pop(c, T.ghost) * (1 - clamp01((c - 33.6) / 0.5));
  const bulgeK = on(c, T.bulge, 42.8);
  const spinK = on(c, T.spinRing, 19.6);
  const axisK = on(c, T.axis, 19.6);
  const probeS = clamp01((c - T.probe) / (T.probeEnd - T.probe));
  const probeOn = c >= T.probe && c < T.probeEnd + 0.6;

  // ---- the drawing list, back to front
  type Part = { d: number; node: React.ReactNode };
  const parts: Part[] = [];
  parts.push({ d: depthOf(th), node: <MoonWithPole key="moon" id="moon" x={mp[0]} y={mp[1]} R={MR} phi={phi} /> });
  if (ghostK > 0.02) {
    parts.push({ d: depthOf(gth), node: <g key="ghost">
      <MoonWithPole id="ghost" x={gp[0]} y={gp[1]} R={MR * (0.75 + 0.25 * ghostK)} phi={GHOST_PHI} op={0.92 * ghostK} tones={ISO.plastic} ghost />
      {/* the direction it keeps: a ray that never turns */}
      <line x1={gp[0] + iso([Math.cos(GHOST_PHI) * MR * 2.1, Math.sin(GHOST_PHI) * MR * 2.1, 0], 1)[0]} y1={gp[1] + iso([Math.cos(GHOST_PHI) * MR * 2.1, Math.sin(GHOST_PHI) * MR * 2.1, 0], 1)[1]}
        x2={gp[0] + iso([Math.cos(GHOST_PHI) * 360, Math.sin(GHOST_PHI) * 360, 0], 1)[0] * ghostK} y2={gp[1] + iso([Math.cos(GHOST_PHI) * 360, Math.sin(GHOST_PHI) * 360, 0], 1)[1] * ghostK}
        stroke={WHITE} strokeWidth={5} strokeDasharray="14 12" strokeLinecap="round" opacity={0.7 * ghostK} />
    </g> });
  }
  snapAng.forEach((a, i) => { if (snapK[i] > 0.02) { const p = screenOf(a); parts.push({ d: depthOf(a), node: <MoonWithPole key={`snap${i}`} id={`snap${i}`} x={p[0]} y={p[1]} R={MR * 0.72 * snapK[i]} phi={a + Math.PI} op={0.88} /> }); } });
  if (probeOn) {
    const psi = th + Math.PI + probeS * Math.PI, r = MR * 2.3, w = worldOf(th), pw: P3 = [w[0] + r * Math.cos(psi), w[1] + r * Math.sin(psi), MR * 0.55 * Math.sin(probeS * Math.PI)];
    const pp = isoAt(pw, 1, [SET.cx, SET.cy]), vis = on(c, T.probe, T.probeEnd + 0.3);
    parts.push({ d: depthOf(th) + (Math.cos(psi) + Math.sin(psi)) * 0.4, node: <g key="probe" opacity={vis}>
      <path d={line(Array.from({ length: 28 }, (_, k) => { const s = (probeS * k) / 27, ps = th + Math.PI + s * Math.PI; const q: P3 = [w[0] + r * Math.cos(ps), w[1] + r * Math.sin(ps), MR * 0.55 * Math.sin(s * Math.PI)]; return isoAt(q, 1, [SET.cx, SET.cy]); }))} fill="none" stroke={WHITE} strokeWidth={3} strokeDasharray="4 10" strokeLinecap="round" opacity={0.6} />
      {/* a small spacecraft: a body and two panels (the kit's boxes) */}
      <g transform={`translate(0 ${3 * Math.sin(c * 4)})`}>
        <IsoBlock a={[-36, -14, -1.5]} b={[-11, 14, 1.5]} u={1} o={pp} tones={ISO.brass} /><IsoBlock a={[11, -14, -1.5]} b={[36, 14, 1.5]} u={1} o={pp} tones={ISO.brass} />
        <IsoBlock a={[-11, -11, -9]} b={[11, 11, 9]} u={1} o={pp} tones={ISO.metal} />
      </g>
    </g> });
  }
  const back = parts.filter((p) => p.d < 0).sort((a, b) => a.d - b.d), front = parts.filter((p) => p.d >= 0).sort((a, b) => a.d - b.d);

  const near = (a: number): P2 => isoAt(worldOf(a), 1, [SET.cx, SET.cy]);
  const tidalAng = Math.atan2(iso([Math.cos(phi), Math.sin(phi), 0], 1)[1], iso([Math.cos(phi), Math.sin(phi), 0], 1)[0]);
  const projLen = Math.hypot(...iso([Math.cos(phi), Math.sin(phi), 0], 1)) / SPHERE_K;
  const toEarth: P2 = [EARTH[0] - mp[0], EARTH[1] - mp[1]], toEarthLen = Math.hypot(toEarth[0], toEarth[1]) || 1;
  const un: P2 = [toEarth[0] / toEarthLen, toEarth[1] / toEarthLen];

  // ---- HUD (screen space): labels and the cards, so they stay one size whatever the camera does
  const hud = (txt: string, y: number, a: number, b: number, fs = 54, hi?: string[], x = 540) => <g opacity={on(c, a, b)}><Label text={txt} x={x} y={y} fs={fs} t={c} start={a} highlight={hi} onDark /></g>;
  const gs = toScreen(cam, gp), ms = toScreen(cam, mp);
  const barK = 1 - easeInOut(clamp01((c - T.barDown) / (T.barEnd - T.barDown)));

  return (
    <svg width={1080} height={1920} viewBox="0 0 1080 1920">
      <rect x={0} y={0} width={1080} height={1920} fill={SPACE} />
      <rect x={0} y={1000} width={1080} height={920} fill={SPACE_FAR} opacity={0.5} />
      <g transform={layerTransform(cam, 0.25)}><Stars c={c} /></g>
      <g transform={layerTransform(cam, 1)}>
        {/* the orbit: a faint ring all the time, a bright one that draws itself in the first explanation */}
        <path d={line(arcPts([0, 0, 0], SET.ring, BACK[0], BACK[1]))} fill="none" stroke={RING} strokeWidth={4} opacity={0.2} />
        {ringK > 0.01 && <path d={line(arcPts([0, 0, 0], SET.ring, BACK[0], BACK[1]))} pathLength={1} strokeDasharray={`${ringK} 1`} fill="none" stroke={RING} strokeWidth={6} strokeLinecap="round" opacity={0.75} />}
        {lineK > 0.02 && [th, ...snapAng].map((a, i) => { const p = i === 0 ? mp : near(a); return <line key={i} x1={p[0]} y1={p[1]} x2={EARTH[0]} y2={EARTH[1]} stroke={WHITE} strokeWidth={4} strokeDasharray="12 12" opacity={0.55 * lineK * (i === 0 ? 1 : snapK[i - 1])} />; })}
        {lapArc && <path d={line(lapArc)} fill="none" stroke={WHITE} strokeWidth={10} strokeLinecap="round" opacity={0.85 * lap} />}
        {back.map((p) => p.node)}

        <Sphere id="earth" x={EARTH[0]} y={EARTH[1]} R={SET.earthR} phi={earthPhi} tones={EARTH_T} patches={EARTH_PATCHES} />

        <path d={line(arcPts([0, 0, 0], SET.ring, FRONT[0], FRONT[1]))} fill="none" stroke={RING} strokeWidth={4} opacity={0.2} />
        {ringK > 0.01 && <path d={line(arcPts([0, 0, 0], SET.ring, FRONT[0], FRONT[1]))} pathLength={1} strokeDasharray={`${ringK} 1`} fill="none" stroke={RING} strokeWidth={6} strokeLinecap="round" opacity={0.75} />}
        {dots.map((d, i) => d.k > 0.02 && <circle key={i} cx={near(d.a)[0]} cy={near(d.a)[1]} r={11 * d.k} fill={WHITE} opacity={0.9 * d.k} />)}
        {/* the way it goes: two chevrons ahead of the Moon */}
        {on(c, T.arrow, 12.0) > 0.02 && <g opacity={on(c, T.arrow, 12.0)}>{[0.34, 0.46].map((s, i) => { const p = near(th + s), q = near(th + s + 0.05), ang = Math.atan2(q[1] - p[1], q[0] - p[0]); return <polygon key={i} points={`${p[0] + 22 * Math.cos(ang)},${p[1] + 22 * Math.sin(ang)} ${p[0] + 22 * Math.cos(ang + 2.4)},${p[1] + 22 * Math.sin(ang + 2.4)} ${p[0] + 22 * Math.cos(ang - 2.4)},${p[1] + 22 * Math.sin(ang - 2.4)}`} fill={WHITE} />; })}</g>}
        {front.map((p) => p.node)}

        {/* the axis and the turn of the Moon on its own axis (the second explanation) */}
        {axisK > 0.02 && <g opacity={axisK}>
          <line x1={mp[0]} y1={mp[1] - MR * SPHERE_K * 1.05} x2={mp[0]} y2={mp[1] - MR * SPHERE_K * 1.05 - 12 * axisK} stroke={WHITE} strokeWidth={5} strokeDasharray="10 8" strokeLinecap="round" />
          <line x1={mp[0]} y1={mp[1] + MR * SPHERE_K * 1.05} x2={mp[0]} y2={mp[1] + MR * SPHERE_K * 1.05 + 12 * axisK} stroke={WHITE} strokeWidth={5} strokeDasharray="10 8" strokeLinecap="round" />
        </g>}
        {spinK > 0.02 && (() => {
          const centre = worldOf(th), cc: P3 = [centre[0], centre[1], 0], rr = MR * 1.38;
          const arcAt = (a0: number, a1: number) => line(Array.from({ length: 40 }, (_, k) => { const a = a0 + ((a1 - a0) * k) / 39; return isoAt([cc[0] + rr * Math.cos(a), cc[1] + rr * Math.sin(a), 0], 1, [SET.cx, SET.cy]); }));
          const headA = phi + 0.6, hp = isoAt([cc[0] + rr * Math.cos(headA), cc[1] + rr * Math.sin(headA), 0], 1, [SET.cx, SET.cy]);
          const hq = isoAt([cc[0] + rr * Math.cos(headA + 0.08), cc[1] + rr * Math.sin(headA + 0.08), 0], 1, [SET.cx, SET.cy]), ha = Math.atan2(hq[1] - hp[1], hq[0] - hp[0]);
          return <g opacity={spinK}>
            <path d={arcAt(headA - 2.4, headA)} fill="none" stroke={WHITE} strokeWidth={9} strokeLinecap="round" />
            <polygon points={`${hp[0] + 30 * Math.cos(ha)},${hp[1] + 30 * Math.sin(ha)} ${hp[0] + 22 * Math.cos(ha + 2.2)},${hp[1] + 22 * Math.sin(ha + 2.2)} ${hp[0] + 22 * Math.cos(ha - 2.2)},${hp[1] + 22 * Math.sin(ha - 2.2)}`} fill={WHITE} />
          </g>;
        })()}

        {/* the tidal bulge, exaggerated: the Moon is stretched a little towards the Earth, and the Earth pulls at it */}
        {bulgeK > 0.02 && <g opacity={bulgeK}>
          <ellipse cx={mp[0]} cy={mp[1]} rx={MR * SPHERE_K * (1 + 0.28 * projLen) * (0.9 + 0.1 * bulgeK)} ry={MR * SPHERE_K * (1.02 - 0.0 * projLen)} fill="none" stroke={WHITE} strokeWidth={5} strokeDasharray="14 10"
            transform={`rotate(${(tidalAng * 180) / Math.PI} ${mp[0]} ${mp[1]})`} opacity={0.9} />
          {[-1, 0, 1].map((s, i) => { const k = clamp01((c - (T.pull0 + i * 0.25)) / 0.4); const o: P2 = [-un[1] * s * 46, un[0] * s * 46]; const p0: P2 = [mp[0] + un[0] * (MR * SPHERE_K + 20) + o[0], mp[1] + un[1] * (MR * SPHERE_K + 20) + o[1]];
            return <Arrow2 key={i} x1={p0[0]} y1={p0[1]} x2={p0[0] + un[0] * 74} y2={p0[1] + un[1] * 74} color={WHITE} k={k} w={7} />; })}
        </g>}

        {/* a flash where the spacecraft takes its picture */}
        {c >= 48.5 && c < 49.2 && (() => { const k = (c - 48.5) / 0.7; const r = MR * 2.3, w = worldOf(th), ps = th + Math.PI + probeS * Math.PI; const q = isoAt([w[0] + r * Math.cos(ps), w[1] + r * Math.sin(ps), 0], 1, [SET.cx, SET.cy]);
          return <circle cx={q[0]} cy={q[1]} r={20 + 90 * k} fill="none" stroke={WHITE} strokeWidth={6 * (1 - k)} opacity={1 - k} />; })()}

        {/* the wobble of the last beat (libration): the pole swings a little to each side */}
        {on(c, T.wobble, 55.6) > 0.02 && (() => { const centre = worldOf(th), cc: P3 = [centre[0], centre[1], 0], rr = MR * 2.35, base = th + Math.PI;
          const arc = line(Array.from({ length: 30 }, (_, k) => { const a = base - 0.34 + (0.68 * k) / 29; return isoAt([cc[0] + rr * Math.cos(a), cc[1] + rr * Math.sin(a), 0], 1, [SET.cx, SET.cy]); }));
          return <path d={arc} fill="none" stroke={WHITE} strokeWidth={7} strokeLinecap="round" strokeDasharray="2 14" opacity={on(c, T.wobble, 55.6)} />; })()}
      </g>

      {[0, 1, 2, 3, 4, 5].map((i) => <rect key={i} x={0} y={0} width={1080} height={400 - i * 62} fill={SPACE} opacity={0.2} />)}
      {/* HUD: labels and cards in screen space (the numbers of the story are in the labels) */}
      {beat.kind !== "sting" && beat.kind !== "outro" && <g>
        {hud("1 keliling = 27 hari", 1390, T.lblLap, 11.9)}
        {hud("Bulan", 1290, T.lblMoon, 11.9, 52, ["Bulan"], 330)}
        {hud("putar 27 hari", 1470, T.lblSpin, 19.6, 54, ["27"])}
        {hud("27 hari = 27 hari", 1400, T.lblEq, 19.6, 54, ["="])}
        {hud("selalu menghadap Bumi", 1400, T.lblFace, T.snapOut, 52, ["Bumi"])}
        {hud("tanpa putaran", Math.min(1450, gs[1] + 105), T.lblGhost, 33.8, 50, ["tanpa"], Math.max(230, Math.min(850, gs[0])))}
        {hud("bulan nyata", Math.max(420, ms[1] - 105), T.lblReal, 33.8, 50, ["nyata"], Math.max(230, Math.min(850, ms[0])))}
        {hud("semua sisi terlihat", 1400, T.lblAll, 33.8, 52, ["semua"])}
        {hud("tonjolan (dilebihkan)", 1180, T.lblBulge, 38.4, 48, ["tonjolan"])}
        {hud("tarikan Bumi", 1290, T.lblPull, 38.4, 50, ["tarikan"])}
        {hud("jutaan tahun", 1430, T.lblYears, 42.8, 52, ["jutaan"])}
        <g opacity={on(c, T.bar, 42.8)}>
          <rect x={170} y={1330} width={740} height={34} rx={17} fill={WHITE} opacity={0.25} />
          <rect x={170} y={1330} width={740 * barK} height={34} rx={17} fill={YELLOW} />
        </g>
        {hud("putaran melambat", 1280, T.bar, T.locked - 0.2, 46, ["melambat"])}
        <g opacity={on(c, T.locked, 42.8)} transform={`translate(540 1320) scale(${pop(c, T.locked)}) translate(-540 -1320)`}>
          <rect x={340} y={1274} width={400} height={92} rx={46} fill={YELLOW} /><text x={540} y={1338} fontSize={58} textAnchor="middle" fill={BLACK} style={{ fontFamily: '"Outfit", sans-serif', fontWeight: 700 }}>terkunci!</text>
        </g>
        {/* the two sides side by side: each is the same Moon turned half a lap */}
        <g opacity={on(c, T.cardNear, 49.6)} transform={`translate(0 ${(1 - pop(c, T.cardNear)) * 40})`}>
          <rect x={90} y={1130} width={400} height={330} rx={44} fill={WHITE} opacity={0.12} />
          <Sphere id="cardNear" x={290} y={1260} R={74} phi={Math.PI / 4} tones={MOON} patches={MOON_PATCHES} />
        </g>
        <g opacity={on(c, T.cardFar, 49.6)} transform={`translate(0 ${(1 - pop(c, T.cardFar)) * 40})`}>
          <rect x={590} y={1130} width={400} height={330} rx={44} fill={WHITE} opacity={0.12} />
          <Sphere id="cardFar" x={790} y={1260} R={74} phi={Math.PI / 4 + Math.PI} tones={MOON} patches={MOON_PATCHES} />
        </g>
        {hud("sisi dekat", 1440, T.lblNear, 49.6, 44, ["dekat"], 290)}
        {hud("sisi jauh", 1440, T.lblFar, 49.6, 44, ["jauh"], 790)}
        {hud("Luna 3, 1959", 700, T.lblLuna, 49.6, 52, ["1959"])}
        {/* tips */}
        <g opacity={on(c, T.tipA, 56)} transform={`translate(0 ${(1 - pop(c, T.tipA)) * 30})`}>
          <circle cx={150} cy={1290} r={44} fill={YELLOW} /><text x={150} y={1308} fontSize={52} textAnchor="middle" fill={BLACK} style={{ fontFamily: '"Outfit", sans-serif', fontWeight: 700 }}>1</text>
          <Label text="bercak gelap selalu sama" x={600} y={1304} fs={50} t={c} start={T.tipA} highlight={["selalu", "sama"]} onDark />
        </g>
        <g opacity={on(c, T.tipB, 56)} transform={`translate(0 ${(1 - pop(c, T.tipB)) * 30})`}>
          <circle cx={150} cy={1420} r={44} fill={YELLOW} /><text x={150} y={1438} fontSize={52} textAnchor="middle" fill={BLACK} style={{ fontFamily: '"Outfit", sans-serif', fontWeight: 700 }}>2</text>
          <Label text="goyang kecil: 59% terlihat" x={610} y={1434} fs={50} t={c} start={T.tipB} highlight={["59%"]} onDark />
        </g>
      </g>}
      {beat.kind !== "sting" && beat.kind !== "outro" && <TopText key={beat.id} kicker={beat.kind === "hook" ? "KENAPA BULAN" : beat.kind === "result" ? "JAWABANNYA" : "INTIP BULAN"} headline={beat.text} t={t} onDark />}
      {beat.kind !== "sting" && beat.kind !== "outro" && <CaptionLayer beat={beat} t={t} />}
      {beat.kind === "sting" && (() => {
        const p = springAt(c, 3.0), p2 = springAt(c, 3.25);
        return <g>
          <g transform={`translate(540 720) scale(${Math.max(0, p)}) translate(-540 -720)`}><Mascot x={540} y={720} w={220} expr="curious" t={t} clock={c} squash={0.18 * (1 - p)} /></g>
          <g transform={`translate(540 1489) scale(${Math.max(0, p2)}) translate(-540 -1489)`}>
            <rect x={-210 + 540} y={1443} width={420} height={92} rx={46} fill={YELLOW} />
            <text x={540} y={1507} fontSize={56} textAnchor="middle" fill={BLACK} style={{ fontFamily: '"Outfit", sans-serif', fontWeight: 700 }}>Intip yuk!</text>
          </g>
        </g>;
      })()}
    </svg>
  );
};

export const Video: React.FC<{ story: StoryT; layoutDebug?: boolean }> = (p) => <StoryVideo story={p.story} scene={Scene} layoutDebug={p.layoutDebug} />;
