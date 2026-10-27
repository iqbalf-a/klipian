/* The nature kit of the 2.5D style (pilot 2, phases 1 and 1b): the sea block, the land block, the trees, the sun, the cloud (white or grey), the vapour
   that rises from inside the water, the droplets, the rain that starts behind the cloud's lower edge, the splash rings on the water and the runoff on
   the land. The geometry is in src/natureGeometry.ts (pure, tested); the tones are the ISO kit's water, soil, grass, leaf, cloud and sun sets
   (src/tokens.ts), used only by these parts.

   DEPTH ORDER (draw order, back to front; the same table as natureGeometry.ts DEPTH_ORDER):
     1. sea block (top face and sides)              the water is the back of the scene
     2. ripples and splash on the sea's top face    clipped to that face: a ring never leaves the water
     3. vapour                                      starts INSIDE the water (below its top face), so it is drawn after the sea
     4. land block (sides, then the grass top)      the land is beside the sea and higher than it
     5. runoff on the land's top face               clipped to that face; beside the trees, falling into the sea
     6. trees on the land's top face, back to front the trees cover the runoff where they touch
     7. sun                                         behind the clouds' upper edges
     8. white cloud                                 the sky cloud
     9. rain                                        drawn BEFORE the grey cloud: it starts behind the cloud's lower edge
    10. droplets                                    behind the grey cloud
    11. grey cloud                                  its puffs and belly: `dark` sets the tone, `grow` the size
   Clipped parts: a part that goes onto a face is clipped to that face's outline (`clipPath`). Every moving part is a function of `phase` (0..1 over
   the loop) or of its own state (0..1), so the loop's last frame equals its first. */
import React from "react";
import { ISO } from "../tokens.ts";
import { block, isoAt, ptsAttr, smoothPath, type P2, type P3 } from "../iso.ts";
import {
  LAND, LAND_TOP, RUNOFF, SEA, SEA_TOP, TREE_R, TREES, cloudParts, mixRgb, ripples, rainStreaks, seaTopCorners, splashRings, vapourOpacity,
  vapourWisps,
} from "../natureGeometry.ts";

const WHITE_RIPPLE = "rgb(250,250,248)";
const onFace = (x: number, y: number, z: number, u: number, o: P2): P2 => isoAt([x, y, z] as P3, u, o) as P2;

/** The sea block: its faces in the water's three tones, the ripples clipped to its top face, and a splash ring at `splashAt` (k 0..1). */
export const IsoSea: React.FC<{ u: number; o: P2; phase?: number; splash?: number; splashAt?: [number, number] }> = ({ u, o, phase = 0, splash = 0, splashAt }) => {
  const id = React.useId().replace(/:/g, "");
  const top = seaTopCorners().map(([x, y, z]) => onFace(x, y, z, u, o));
  return (
    <g>
      <defs><clipPath id={`sea${id}`}><polygon points={ptsAttr(top)} /></clipPath></defs>
      {block(SEA.a, SEA.b, u, o).map((p, i) => <polygon key={i} points={ptsAttr(p.pts)} fill={ISO.water[p.tone]} stroke={ISO.water[p.tone]} strokeWidth={0.8} strokeLinejoin="round" />)}
      <g clipPath={`url(#sea${id})`}>
        {ripples(phase).map((r, i) => <path key={i} d={smoothPath(r.pts.map(([x, y]) => onFace(x, y, SEA_TOP, u, o)), 0.5)} fill="none" stroke={WHITE_RIPPLE} strokeWidth={u * 0.04} strokeLinecap="round" />)}
        {splashRings(splash, splashAt ?? [-0.2, -0.3]).map((s, i) => {
          const circle: P2[] = Array.from({ length: 24 }, (_, k) => { const a = (k / 24) * Math.PI * 2; return onFace(s.x + s.r * Math.cos(a), s.y + s.r * Math.sin(a), SEA_TOP, u, o); });
          return <path key={i} d={smoothPath(circle, 0.5) + " Z"} fill="none" stroke={WHITE_RIPPLE} strokeWidth={u * 0.035} opacity={s.opacity} />;
        })}
      </g>
    </g>
  );
};

/** The splash on its own (the sheet's splash tile): the top of the water and its rings, clipped to that top face. k 0..1 is the drop's time. */
export const IsoSplash: React.FC<{ u: number; o: P2; k: number; at?: [number, number] }> = ({ u, o, k, at }) => {
  const id = React.useId().replace(/:/g, "");
  const top = seaTopCorners().map(([x, y, z]) => onFace(x, y, z, u, o));
  return (
    <g>
      <defs><clipPath id={`spl${id}`}><polygon points={ptsAttr(top)} /></clipPath></defs>
      <polygon points={ptsAttr(top)} fill={ISO.water[0]} />
      <g clipPath={`url(#spl${id})`}>
        {splashRings(k, at ?? [-0.2, -0.3]).map((s, i) => {
          const circle: P2[] = Array.from({ length: 24 }, (_, j) => { const a = (j / 24) * Math.PI * 2; return onFace(s.x + s.r * Math.cos(a), s.y + s.r * Math.sin(a), SEA_TOP, u, o); });
          return <path key={i} d={smoothPath(circle, 0.5) + " Z"} fill="none" stroke={WHITE_RIPPLE} strokeWidth={u * 0.035} opacity={s.opacity} />;
        })}
      </g>
    </g>
  );
};

/** The vapour: wisps that start inside the water and fade toward the cloud. `k` (0..1) is how much vapour there is. */
export const IsoVapour: React.FC<{ u: number; o: P2; k: number; phase?: number }> = ({ u, o, k, phase = 0 }) => (
  <g>
    {vapourWisps(k, phase).map((w, i) => w.slice(1).map((p, s) => {
      const a = isoAt(w[s], u, o), b = isoAt(p, u, o), f = (s + 1) / (w.length - 1);
      return <line key={`${i}-${s}`} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={ISO.water[0]} strokeWidth={u * 0.04} strokeLinecap="round" opacity={vapourOpacity(f, 1)} />;
    }))}
  </g>
);

/** The land block: the soil sides, the grass top (a little darker when wet). */
export const IsoLand: React.FC<{ u: number; o: P2; wet?: number }> = ({ u, o, wet = 0 }) => {
  const polys = block(LAND.a, LAND.b, u, o);
  const grass = ISO.grass.map((c) => (wet > 0 ? mixRgb(c, "rgb(96,118,88)", 0.25 * wet) : c));
  return (
    <g>
      {polys.map((p, i) => <polygon key={i} points={ptsAttr(p.pts)} fill={p.tone === 0 ? grass[0] : ISO.soil[p.tone]} stroke={p.tone === 0 ? grass[1] : ISO.soil[p.tone]} strokeWidth={0.8} strokeLinejoin="round" />)}
    </g>
  );
};

/** The trees: one cone per tree, split down its axis by the light (the left half the mid leaf tone, the right half the dark one, a light
    highlight near the apex). The two halves share the apex and the axis's foot, so there is no seam. A short brown trunk. Back to front. */
export const IsoTrees: React.FC<{ u: number; o: P2 }> = ({ u, o }) => (
  <g>
    {TREES.map((t, i) => {
      const foot = onFace(t.x, t.y, LAND_TOP, u, o), apex = onFace(t.x, t.y, LAND_TOP + t.h, u, o);
      const left = onFace(t.x - TREE_R, t.y, LAND_TOP, u, o), right = onFace(t.x + TREE_R, t.y, LAND_TOP, u, o);
      const lift = (p: P2, k: number): P2 => [p[0] + (apex[0] - p[0]) * k, p[1] + (apex[1] - p[1]) * k];
      const trunkBot = onFace(t.x, t.y, LAND_TOP, u, o), trunkTop = onFace(t.x, t.y, LAND_TOP + 0.3, u, o);
      const tw = u * 0.07;
      return (
        <g key={i}>
          <polygon points={ptsAttr([[trunkBot[0] - tw, trunkBot[1]], [trunkBot[0] + tw, trunkBot[1]], [trunkTop[0] + tw, trunkTop[1]], [trunkTop[0] - tw, trunkTop[1]]])} fill={ISO.soil[1]} />
          <polygon points={ptsAttr([apex, left, foot])} fill={ISO.leaf[1]} stroke={ISO.leaf[1]} strokeWidth={0.6} strokeLinejoin="round" />
          <polygon points={ptsAttr([apex, foot, right])} fill={ISO.leaf[2]} stroke={ISO.leaf[2]} strokeWidth={0.6} strokeLinejoin="round" />
          <polygon points={ptsAttr([apex, lift(left, 0.25), lift(foot, 0.25)])} fill={ISO.leaf[0]} />
        </g>
      );
    })}
  </g>
);

/** The sun: a disc in the sun tones (light, then a darker lower-right crescent) with alternating long and short rays (round caps) that pulse
    slowly with `phase` (periodic). */
export const IsoSun: React.FC<{ cx: number; cy: number; r: number; phase?: number }> = ({ cx, cy, r, phase = 0 }) => (
  <g>
    {Array.from({ length: 8 }, (_, i) => {
      const a = (i / 8) * Math.PI * 2, long = i % 2 === 0, pulse = 1 + 0.06 * Math.sin(2 * Math.PI * phase + i);
      const r0 = r * 1.2, r1 = r * (long ? 1.75 : 1.45) * pulse;
      return <line key={i} x1={cx + Math.cos(a) * r0} y1={cy + Math.sin(a) * r0} x2={cx + Math.cos(a) * r1} y2={cy + Math.sin(a) * r1} stroke={ISO.sun[2]} strokeWidth={r * (long ? 0.18 : 0.14)} strokeLinecap="round" />;
    })}
    <circle cx={cx} cy={cy} r={r} fill={ISO.sun[2]} />
    <circle cx={cx - r * 0.06} cy={cy - r * 0.06} r={r * 0.94} fill={ISO.sun[0]} />
    <circle cx={cx - r * 0.02} cy={cy - r * 0.02} r={r * 0.88} fill={ISO.sun[1]} opacity={0.35} />
  </g>
);

/** A cloud: a flat underside (the belly ellipses, the dark tone), the puffs (the dark underside layer, the mid body, the light bumps upper left),
    in the tones of `cloudWhite` (dark 0) to `cloudGrey` (dark 1). `grow` scales it; `phase` breathes the puffs (periodic). */
export const IsoCloud: React.FC<{ u: number; o: P2; cx: number; cy: number; cz: number; dark?: number; grow?: number; phase?: number }> = ({ u, o, cx, cy, cz, dark = 0, grow = 1, phase = 0 }) => {
  const tone = (t: 0 | 1 | 2) => mixRgb(ISO.cloudWhite[t], ISO.cloudGrey[t], dark);
  const parts = cloudParts(cx, cy, cz, grow, phase);
  return (
    <g>
      {parts.belly.map((b, i) => {
        const c = isoAt([b.x, b.y, b.z] as P3, u, o) as P2;
        return <ellipse key={`b${i}`} cx={c[0]} cy={c[1] + u * 0.03} rx={b.rs * 1.22 * u} ry={b.rz * u} fill={tone(2)} />;
      })}
      {parts.puffs.map((p, i) => {
        const c = isoAt([p.x, p.y, p.z] as P3, u, o) as P2, r = p.r * u;
        return (
          <g key={i}>
            <circle cx={c[0] + r * 0.1} cy={c[1] + r * 0.16} r={r} fill={tone(2)} />
            <circle cx={c[0]} cy={c[1]} r={r * 0.94} fill={tone(1)} />
            <circle cx={c[0] - r * 0.24} cy={c[1] - r * 0.26} r={r * 0.5} fill={tone(0)} />
          </g>
        );
      })}
    </g>
  );
};

/** The rain: streaks that fall from just below the grey cloud's lower edge, drawn BEFORE the grey cloud. */
export const IsoRain: React.FC<{ u: number; o: P2; k: number; phase?: number }> = ({ u, o, k, phase = 0 }) => (
  <g opacity={k}>
    {rainStreaks(phase).map((s, i) => { const a = isoAt(s.a, u, o), b = isoAt(s.b, u, o); return <line key={i} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={ISO.water[1]} strokeWidth={u * 0.05} strokeLinecap="round" />; })}
  </g>
);

/** The droplets: small water drops that gather under the grey cloud (drawn behind it). `k` is how many show. */
export const IsoDroplets: React.FC<{ u: number; o: P2; k: number }> = ({ u, o, k }) => (
  <g>
    {[[-0.9, 0.2, 2.1], [-0.4, -0.2, 2.0], [0.2, 0.3, 2.05], [0.7, -0.1, 2.15]].map(([x, y, z], i) => {
      const c = isoAt([x, y, z] as P3, u, o);
      return <circle key={i} cx={c[0]} cy={c[1]} r={u * 0.05} fill={ISO.water[1]} opacity={Math.max(0, Math.min(1, k * 4 - i * 0.6))} />;
    })}
  </g>
);

/** The runoff: a thin stream on the land's top face, beside the trees, from the back toward the land's edge, clipped to that face; then a short thin
    fall over the edge into the sea (its splash ring comes from IsoSea). `k` (0..1) is how much water there is. */
export const IsoRunoff: React.FC<{ u: number; o: P2; k: number }> = ({ u, o, k }) => {
  const id = React.useId().replace(/:/g, "");
  const top = [[LAND.a[0], LAND.a[1]], [LAND.b[0], LAND.a[1]], [LAND.b[0], LAND.b[1]], [LAND.a[0], LAND.b[1]]].map(([x, y]) => onFace(x, y, LAND_TOP, u, o));
  const path = RUNOFF.onLandPath.map(([x, y]) => onFace(x, y, LAND_TOP, u, o));
  const fall = RUNOFF.fall.map(([x, y, z]) => onFace(x, y, z, u, o));
  return (
    <g opacity={k}>
      <defs><clipPath id={`land${id}`}><polygon points={ptsAttr(top)} /></clipPath></defs>
      <path clipPath={`url(#land${id})`} d={smoothPath(path, 0.5)} fill="none" stroke={ISO.water[1]} strokeWidth={u * 0.07} strokeLinecap="round" />
      <line x1={fall[0][0]} y1={fall[0][1]} x2={fall[1][0]} y2={fall[1][1]} stroke={ISO.water[1]} strokeWidth={u * 0.05} strokeLinecap="round" />
    </g>
  );
};
