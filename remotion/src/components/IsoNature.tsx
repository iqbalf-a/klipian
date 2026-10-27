/* The nature kit of the 2.5D style (pilot 2, phase 1): the sea block, the land block with cone trees, the sun, a cloud that darkens and grows, the
   vapour that rises from inside the water, the droplets, the rain that starts behind the cloud's lower edge, the splash rings on the water and the
   runoff on the land. The geometry is in src/natureGeometry.ts (pure, tested); the tones are the ISO kit's water, soil, grass, leaf, cloud and sun
   sets (src/tokens.ts), used only by these parts.

   DEPTH ORDER (draw order, back to front; the same table as natureGeometry.ts DEPTH_ORDER):
     1. sea block (top face and sides)               the water is the back of the scene
     2. ripples and splash on the sea's top face     clipped to that face: a ring never leaves the water
     3. vapour                                       starts INSIDE the water (below its top face), so it is drawn after the sea
     4. land block (sides, then the grass top)       the land is beside the sea, not in front of it
     5. trees on the land's top face                 after the land top
     6. runoff on the land's top face                clipped to that face
     7. sun                                          behind the cloud's upper edge, so before the cloud
     8. rain                                         drawn BEFORE the cloud: it starts behind the cloud's lower edge
     9. droplets                                     behind the cloud
    10. cloud                                        its puffs: the dark tone and the size follow `dark` and `grow`
   Clipped parts: a part that goes into or onto a face is clipped to that face's outline (`clipPath`), so no part is drawn over what hides it. Every
   moving part is a function of `phase` (0..1 over the loop) or of its own state (0..1), so the loop's last frame equals its first. */
import React from "react";
import { ISO } from "../tokens.ts";
import { block, isoAt, ptsAttr, smoothPath, type P2, type P3 } from "../iso.ts";
import {
  LAND, LAND_TOP, SEA, SEA_TOP, cloudPuffs, mixRgb, ripples, rainStreaks, seaTopCorners, splashRings, vapourOpacity, vapourWisps,
} from "../natureGeometry.ts";

const WHITE_RIPPLE = "rgb(250,250,248)";

/** A point on a horizontal face z = z0 (the sea top, the land top) in the 2.5D projection. */
const onFace = (x: number, y: number, z: number, u: number, o: P2): P2 => isoAt([x, y, z] as P3, u, o) as P2;

/** The sea block: its three visible faces in the water's three tones, with the top face drawn after its sides. */
export const IsoSea: React.FC<{ u: number; o: P2; phase?: number; ripples?: boolean; splash?: number }> = ({ u, o, phase = 0, ripples: showRipples = true, splash = 0 }) => {
  const id = React.useId().replace(/:/g, "");
  const top = seaTopCorners().map(([x, y, z]) => onFace(x, y, z, u, o));
  return (
    <g>
      <defs><clipPath id={`sea${id}`}><polygon points={ptsAttr(top)} /></clipPath></defs>
      {block(SEA.a, SEA.b, u, o).map((p, i) => <polygon key={i} points={ptsAttr(p.pts)} fill={ISO.water[p.tone]} stroke={ISO.water[p.tone]} strokeWidth={0.8} strokeLinejoin="round" />)}
      <g clipPath={`url(#sea${id})`}>
        {showRipples && ripples(phase).map((r, i) => (
          <path key={i} d={smoothPath(r.pts.map(([x, y]) => onFace(x, y, SEA_TOP, u, o)), 0.5)} fill="none" stroke={WHITE_RIPPLE} strokeWidth={u * 0.04} strokeLinecap="round" />
        ))}
        {splashRings(splash).map((s, i) => {
          const circle: P2[] = Array.from({ length: 24 }, (_, k) => { const a = (k / 24) * Math.PI * 2; return onFace(s.x + s.r * Math.cos(a), s.y + s.r * Math.sin(a), SEA_TOP, u, o); });
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

/** The land block: the soil sides, the grass top, and three cone trees on the top face (drawn after the top). */
export const IsoLand: React.FC<{ u: number; o: P2; trees?: boolean; wet?: number }> = ({ u, o, trees = true, wet = 0 }) => {
  const polys = block(LAND.a, LAND.b, u, o);
  const grass = ISO.grass.map((c) => (wet > 0 ? mixRgb(c, "rgb(96,118,88)", 0.25 * wet) : c));
  const soil = ISO.soil;
  const tree = (x: number, y: number, h: number) => {
    const base = [onFace(x - 0.22, y, LAND_TOP, u, o), onFace(x + 0.22, y, LAND_TOP, u, o)], apex = isoAt([x, y, LAND_TOP + h] as P3, u, o) as P2;
    return (
      <g key={`${x}-${y}`}>
        <polygon points={ptsAttr([base[0], apex, [(base[0][0] + base[1][0]) / 2, (base[0][1] + base[1][1]) / 2]])} fill={ISO.leaf[1]} />
        <polygon points={ptsAttr([[(base[0][0] + base[1][0]) / 2, (base[0][1] + base[1][1]) / 2], apex, base[1]])} fill={ISO.leaf[2]} />
      </g>
    );
  };
  return (
    <g>
      {polys.map((p, i) => <polygon key={i} points={ptsAttr(p.pts)} fill={p.tone === 0 ? grass[0] : soil[p.tone]} stroke={p.tone === 0 ? grass[1] : soil[p.tone]} strokeWidth={0.8} strokeLinejoin="round" />)}
      {trees && [[1.1, 0.0, 1.0], [1.5, -0.2, 1.25], [1.9, 0.2, 0.9]].map(([x, y, h]) => tree(x, y, h))}
    </g>
  );
};

/** The sun: a disc in the sun tones (light, then a darker lower-right crescent) with rays that pulse with `phase` (periodic). */
export const IsoSun: React.FC<{ cx: number; cy: number; r: number; phase?: number }> = ({ cx, cy, r, phase = 0 }) => (
  <g>
    {Array.from({ length: 8 }, (_, i) => {
      const a = (i / 8) * Math.PI * 2, k = 1 + 0.08 * Math.sin(2 * Math.PI * phase + i);
      return <line key={i} x1={cx + Math.cos(a) * r * 1.25} y1={cy + Math.sin(a) * r * 1.25} x2={cx + Math.cos(a) * r * (1.25 + 0.38 * k)} y2={cy + Math.sin(a) * r * (1.25 + 0.38 * k)} stroke={ISO.sun[2]} strokeWidth={r * 0.14} strokeLinecap="round" />;
    })}
    <circle cx={cx} cy={cy} r={r} fill={ISO.sun[2]} />
    <circle cx={cx - r * 0.06} cy={cy - r * 0.06} r={r * 0.94} fill={ISO.sun[0]} />
    <circle cx={cx - r * 0.02} cy={cy - r * 0.02} r={r * 0.88} fill={ISO.sun[1]} opacity={0.35} />
  </g>
);

/** The cloud: layered puffs in the three tones (a light highlight top, the mid body, a dark underside). `dark` (0..1) turns it from white to grey,
    `grow` (1 = normal size) scales it, `phase` breathes the puffs (periodic). */
export const IsoCloud: React.FC<{ u: number; o: P2; dark?: number; grow?: number; phase?: number }> = ({ u, o, dark = 0, grow = 1, phase = 0 }) => {
  const tone = (t: 0 | 1 | 2) => mixRgb(ISO.cloudWhite[t], ISO.cloudGrey[t], dark);
  return (
    <g>
      {cloudPuffs(grow, phase).map((p, i) => {
        const c = isoAt([p.x, p.y, p.z] as P3, u, o) as P2, r = p.r * u;
        return (
          <g key={i}>
            <circle cx={c[0] + r * 0.12} cy={c[1] + r * 0.18} r={r} fill={tone(2)} />
            <circle cx={c[0]} cy={c[1]} r={r * 0.94} fill={tone(1)} />
            <circle cx={c[0] - r * 0.22} cy={c[1] - r * 0.24} r={r * 0.5} fill={tone(0)} />
          </g>
        );
      })}
    </g>
  );
};

/** The rain: streaks that fall from just below the cloud's lower edge. Drawn BEFORE the cloud, so the cloud hides where they start. */
export const IsoRain: React.FC<{ u: number; o: P2; k: number; phase?: number }> = ({ u, o, k, phase = 0 }) => (
  <g opacity={k}>
    {rainStreaks(phase).map((s, i) => { const a = isoAt(s.a, u, o), b = isoAt(s.b, u, o); return <line key={i} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={ISO.water[1]} strokeWidth={u * 0.05} strokeLinecap="round" />; })}
  </g>
);

/** The droplets: small water drops that gather under the cloud (drawn behind it). `k` is how many show. */
export const IsoDroplets: React.FC<{ u: number; o: P2; k: number }> = ({ u, o, k }) => (
  <g>
    {[[-0.9, 0.2, 2.1], [-0.4, -0.2, 2.0], [0.2, 0.3, 2.05], [0.7, -0.1, 2.15]].map(([x, y, z], i) => {
      const c = isoAt([x, y, z] as P3, u, o);
      return <circle key={i} cx={c[0]} cy={c[1]} r={u * 0.05} fill={ISO.water[1]} opacity={Math.max(0, Math.min(1, k * 4 - i * 0.6))} />;
    })}
  </g>
);

/** The runoff: a thin blue stream on the land's top face from the land toward the sea, clipped to that face. */
export const IsoRunoff: React.FC<{ u: number; o: P2; k: number }> = ({ u, o, k }) => {
  const id = React.useId().replace(/:/g, "");
  const top = [[LAND.a[0], LAND.a[1], LAND_TOP], [LAND.b[0], LAND.a[1], LAND_TOP], [LAND.b[0], LAND.b[1], LAND_TOP], [LAND.a[0], LAND.b[1], LAND_TOP]].map(([x, y, z]) => onFace(x, y, z, u, o));
  const path = [[1.0, -0.6], [1.2, -0.1], [1.0, 0.3]].map(([x, y]) => onFace(x, y, LAND_TOP, u, o));
  return (
    <g opacity={k}>
      <defs><clipPath id={`land${id}`}><polygon points={ptsAttr(top)} /></clipPath></defs>
      <path clipPath={`url(#land${id})`} d={smoothPath(path, 0.5)} fill="none" stroke={ISO.water[1]} strokeWidth={u * 0.07} strokeLinecap="round" />
    </g>
  );
};
