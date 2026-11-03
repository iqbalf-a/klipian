/* The nature kit of the 2.5D style (pilot 2, phases 1, 1b and 1c): the sea (its side layers, shallow and deep patches, two rows of crests with foam, a
   foam lip, glints, the cloud's shadow), the vapour with bubbles and a shimmer, the land (its strata of topsoil, sand and stone, grass patches and tufts),
   the hill step, the puddles that grow after rain, the tree shadows, the runoff's channel, the bushes and flowers, the rocks, the trees (pines of three
   tiers, round trees of three lobes), the sun, the cloud (crescent-shaded billows with back puffs and a darker underside), the rain, the droplets and the
   splash rings on the water. The geometry is in src/natureGeometry.ts (pure, tested); the tones are the ISO kit's nature sets (src/tokens.ts) and the sand
   and stone sets, used only by these parts. Flat tones only: depth comes from layers, crescents and shadows, never from gradients.

   DEPTH ORDER (draw order, back to front; the same table as natureGeometry.ts DEPTH_ORDER):
     1. sea (its side layers, then the top: patches, cloud shadow, crests, foam, glints)   the water is the back of the scene
     2. ripples and splash on the sea's top face                                          clipped to that face
     3. vapour (bubbles and a shimmer)                                                    starts INSIDE the water, so after the sea
     4. land (sides with strata, then the grass top with patches and tufts)              the land is beside the sea and higher than it
     5. hill step (behind the trees)                                                      on the land's top face
     6. puddles (grow with `wet`)                                                         on the grass, under the rain
     7. tree shadows (flat rings, offset away from the light)                             on the grass, before the trees
     8. runoff (the channel with banks, then the water)                                   clipped to the grass; beside the trees
     9. bushes and flowers                                                                 on the grass, in front of the stream
    10. rocks                                                                             on the grass
    11. trees (pines and round trees, back to front)                                      the trees cover the stream where they touch
    12. sun                                                                               behind the clouds' upper edges
    13. rain                                                                              drawn BEFORE the grey cloud: it starts behind the cloud's lower edge
    14. droplets                                                                          behind the grey cloud
    15. clouds (white, then grey: back puffs, belly, puffs, wisps; `dark` sets the tone, `grow` the size)
   THE WIDE DIORAMA (rain video, B27): `IsoSea` and `IsoLand` take `wide` (their blocks go on past every frame edge); `IsoHills` (stepped hills) and `IsoFields` (crop plots with
   rows) stand on the land after the hill step and before the puddles; the trees, bushes and rocks take longer lists (natureGeometry.ts TREES_WIDE, BUSHES_WIDE, ROCKS_WIDE);
   `IsoFarHills` and a `haze`d `IsoCloud` are far-layer pieces (parallax 0.3 and 0.6), drawn before the sea. The footprints of everything on the land are tested not to intersect.
   Clipped parts: a part that goes onto a face is clipped to that face's outline (`clipPath`). Every moving part is a function of `phase` (0..1 over
   the loop) or of its own state (0..1), so the loop's last frame equals its first. */
import React from "react";
import { ISO } from "../tokens.ts";
import { swayDeg } from "../alive.ts";
import { block, isoAt, ptsAttr, smoothPath, type P2, type P3 } from "../iso.ts";
import {
  BUSHES, CLOUD_SHADOW, FIELDS, FLOWERS, GLINTS, GLINTS_WIDE, HILL, HILLS_WIDE, LAND, LAND_TOP, PUDDLES, ROCKS, RUNOFF, SEA, SEA_TOP, STRATA_Z, TREE_R, TREE_SHADOW, TREES, WORLD,
  type Field, type HillBlock, cloudParts, crests, crestsWide, landTufts, mixRgb, ripples, rainStreaks, seaTopCorners, splashRings, vapourOpacity, vapourWisps,
} from "../natureGeometry.ts";

const WHITE_RIPPLE = "rgb(250,250,248)";
const DEEP = mixRgb(ISO.water[2], "rgb(20,20,20)", 0.35);     // the sea's deepest layer: a shade of its dark water tone
const DEEPER = mixRgb(ISO.water[2], "rgb(20,20,20)", 0.6);
/** The cloud's shadow on the water: darker than the shallow band and the deep patch as k rises (k 0..1; 0 gives the shallow band's colour). */
const shadowColour = (k: number): string => mixRgb(ISO.water[0], ISO.water[2], 0.6 * Math.max(0, Math.min(1, k)));
const onFace = (x: number, y: number, z: number, u: number, o: P2): P2 => isoAt([x, y, z] as P3, u, o) as P2;
/** A polygon on the plane x = x0 (the +x side) or y = y0 (the +y side), from z0 to z1 along its extent. */
const sideX = (x0: number, y0: number, y1: number, z0: number, z1: number, u: number, o: P2): P2[] => [onFace(x0, y0, z0, u, o), onFace(x0, y1, z0, u, o), onFace(x0, y1, z1, u, o), onFace(x0, y0, z1, u, o)];
const sideY = (y0: number, x0: number, x1: number, z0: number, z1: number, u: number, o: P2): P2[] => [onFace(x0, y0, z0, u, o), onFace(x1, y0, z0, u, o), onFace(x1, y0, z1, u, o), onFace(x0, y0, z1, u, o)];
/** A flat shape on a horizontal plane (z): a world outline projected. */
const flat = (pts: [number, number][], z: number, u: number, o: P2): P2[] => pts.map(([x, y]) => onFace(x, y, z, u, o));
const ring = (cx: number, cy: number, r: number, n = 24): [number, number][] => Array.from({ length: n }, (_, k) => { const a = (k / n) * Math.PI * 2; return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; });
/** A screen-space arc of a circle (centre c, radius r) from angle a0 to a1 (radians, SVG y down), as an SVG path. */
const arcD = (c: P2, r: number, a0: number, a1: number): string => {
  const p = (a: number): P2 => [c[0] + r * Math.cos(a), c[1] + r * Math.sin(a)];
  const s = p(a0), e = p(a1);
  return `M${s[0].toFixed(1)},${s[1].toFixed(1)} A${r.toFixed(1)},${r.toFixed(1)} 0 0 1 ${e[0].toFixed(1)},${e[1].toFixed(1)}`;
};

/** The sea: the side faces in three layers (surface, mid, deep) and a thin lighter lip on the top edge; the top face in a shallow band, a deep patch and
    a deepest core, the cloud's shadow (`shadow` 0..1), the two rows of crests with their foam, a foam lip, glints; then the splash rings (clipped). */
export const IsoSea: React.FC<{ u: number; o: P2; phase?: number; splash?: number; splashAt?: [number, number]; shadow?: number; wide?: boolean }> = ({ u, o, phase = 0, splash = 0, splashAt, shadow = 0, wide = false }) => {
  const id = React.useId().replace(/:/g, "");
  const box = wide ? WORLD.sea : SEA;      // wide: the diorama's sea, which goes on past every frame edge (B27.1)
  const top = (wide ? [[box.a[0], box.a[1], SEA_TOP], [box.b[0], box.a[1], SEA_TOP], [box.b[0], box.b[1], SEA_TOP], [box.a[0], box.b[1], SEA_TOP]] as P3[] : seaTopCorners()).map(([x, y, z]) => onFace(x, y, z, u, o));
  const [x0, y0] = box.a, [x1, y1] = box.b, zt = SEA_TOP, zb = SEA.a[2];
  const z1 = zt - 0.12, zm = (z1 + zb) / 2;
  const band: [number, number][] = [[z1, zt], [zm, z1], [zb, zm]];
  const xFaceColours = [ISO.water[2], DEEP, DEEPER], yFaceColours = [ISO.water[1], ISO.water[2], DEEP];
  const shadowTone = shadowColour(shadow);
  return (
    <g>
      <defs><clipPath id={`sea${id}`}><polygon points={ptsAttr(top)} /></clipPath></defs>
      {/* the +x side (dark), then the +y side (mid), each in three layers */}
      {band.map(([a, b], i) => <polygon key={`x${i}`} points={ptsAttr(sideX(x1, y0, y1, a, b, u, o))} fill={xFaceColours[i]} stroke={xFaceColours[i]} strokeWidth={0.6} />)}
      {band.map(([a, b], i) => <polygon key={`y${i}`} points={ptsAttr(sideY(y1, x0, x1, a, b, u, o))} fill={yFaceColours[i]} stroke={yFaceColours[i]} strokeWidth={0.6} />)}
      <polygon points={ptsAttr(sideY(y1, x0, x1, zt - 0.035, zt, u, o))} fill={ISO.water[0]} />
      {/* the top: shallow band, deep patch, deepest core, the cloud's shadow */}
      <polygon points={ptsAttr(top)} fill={ISO.water[0]} />
      <polygon points={ptsAttr(flat([[x0 + 0.35, y0 + 0.35], [x1 - 0.35, y0 + 0.35], [x1 - 0.35, y1 - 0.35], [x0 + 0.35, y1 - 0.35]], zt, u, o))} fill={ISO.water[1]} />
      <polygon points={ptsAttr(flat([[x0 + 0.9, y0 + 0.8], [x1 - 0.8, y0 + 0.8], [x1 - 0.8, y1 - 0.7], [x0 + 0.9, y1 - 0.7]], zt, u, o))} fill={ISO.water[2]} />
      {shadow > 0 && <polygon points={ptsAttr(flat(ring(CLOUD_SHADOW.x, CLOUD_SHADOW.y, CLOUD_SHADOW.r), zt, u, o))} fill={shadowTone} />}
      <g clipPath={`url(#sea${id})`}>
        {(wide ? crestsWide(phase) : crests(phase)).map((c, i) => (
          <g key={`c${i}`}>
            <path d={smoothPath(c.pts.map(([x, y]) => onFace(x, y, zt, u, o)), 0.5)} fill="none" stroke={WHITE_RIPPLE} strokeWidth={u * 0.035} strokeLinecap="round" />
            <path d={smoothPath(c.cap.map(([x, y]) => onFace(x, y, zt, u, o)), 0.5)} fill="none" stroke={WHITE_RIPPLE} strokeWidth={u * 0.03} strokeLinecap="round" opacity={0.9} />
          </g>
        ))}
        {ripples(phase).map((r, i) => <path key={`r${i}`} d={smoothPath(r.pts.map(([x, y]) => onFace(x, y, zt, u, o)), 0.5)} fill="none" stroke={WHITE_RIPPLE} strokeWidth={u * 0.02} strokeLinecap="round" opacity={0.6} />)}
        <polygon points={ptsAttr(top)} fill="none" stroke={WHITE_RIPPLE} strokeWidth={u * 0.03} opacity={0.85} strokeLinejoin="round" />
        {(wide ? GLINTS_WIDE : GLINTS).map(([x, y], i) => {
          const d = 0.06, o2 = 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(2 * Math.PI * phase + i * 1.7));
          return <polygon key={`g${i}`} points={ptsAttr(flat([[x, y - d], [x + d, y], [x, y + d], [x - d, y]], zt, u, o))} fill={WHITE_RIPPLE} opacity={o2} />;
        })}
        {splashRings(splash, splashAt ?? [-0.2, -0.3]).map((s, i) => {
          const circle: P2[] = Array.from({ length: 24 }, (_, k) => { const a = (k / 24) * Math.PI * 2; return onFace(s.x + s.r * Math.cos(a), s.y + s.r * Math.sin(a), zt, u, o); });
          return <path key={`s${i}`} d={smoothPath(circle, 0.5) + " Z"} fill="none" stroke={WHITE_RIPPLE} strokeWidth={u * 0.035} opacity={s.opacity} />;
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

/** The vapour: wisps that start inside the water and fade toward the cloud, with small bubbles on them and a shimmer (two thin curves) above the sea.
    `k` (0..1) is how much vapour there is. */
export const IsoVapour: React.FC<{ u: number; o: P2; k: number; phase?: number }> = ({ u, o, k, phase = 0 }) => (
  <g>
    {vapourWisps(k, phase).map((w, i) => w.slice(1).map((p, s) => {
      const a = isoAt(w[s], u, o), b = isoAt(p, u, o), f = (s + 1) / (w.length - 1);
      return <line key={`${i}-${s}`} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={ISO.water[0]} strokeWidth={u * 0.04} strokeLinecap="round" opacity={vapourOpacity(f, 1)} />;
    }))}
    {vapourWisps(k, phase).map((w, i) => [3, 7, 10].map((j, n) => {
      const c = isoAt(w[j], u, o), f = j / (w.length - 1);
      return <circle key={`b${i}-${n}`} cx={c[0] + u * 0.05} cy={c[1] - u * 0.03 * n} r={u * (0.03 + 0.01 * n)} fill="none" stroke={ISO.water[0]} strokeWidth={u * 0.012} opacity={vapourOpacity(f, k)} />;
    }))}
    {k > 0 && [0, 1].map((i) => {
      const pts = Array.from({ length: 9 }, (_, s) => { const f = s / 8; return onFace(-0.5 + 1.1 * f, -0.9 + 0.4 * i, SEA_TOP + 0.1 + 0.06 * i + 0.02 * Math.sin(2 * Math.PI * phase + i + f * 4), u, o); });
      return <path key={`sh${i}`} d={smoothPath(pts, 0.5)} fill="none" stroke={ISO.water[0]} strokeWidth={u * 0.02} strokeLinecap="round" opacity={0.5 * k} />;
    })}
  </g>
);

/** The land block: the sides in strata (topsoil, sand, stone, each in the soil, sand or stone tones of its face), the grass top (a little darker when
    wet), its lighter patches and small tufts. */
export const IsoLand: React.FC<{ u: number; o: P2; wet?: number; wide?: boolean; box?: { a: readonly number[]; b: readonly number[] } }> = ({ u, o, wet = 0, wide = false, box: given }) => {
  const LB = given ?? (wide ? WORLD.land : LAND);      // wide: the diorama's land (B27.1); box: a small slab for a sheet tile
  const grass = ISO.grass.map((c) => (wet > 0 ? mixRgb(c, "rgb(96,118,88)", 0.25 * wet) : c));
  const patch = mixRgb(grass[0], ISO.cloudWhite[0], 0.35);
  const topCorners = flat([[LB.a[0], LB.a[1]], [LB.b[0], LB.a[1]], [LB.b[0], LB.b[1]], [LB.a[0], LB.b[1]]], LAND_TOP, u, o);
  const strata = [0, 1, 2];
  const sandRow = [ISO.soil[2], ISO.sand[2], ISO.stone[2]], sandCol = [ISO.soil[1], ISO.sand[1], ISO.stone[1]];
  const patches: [number, number][][] = [[[1.2, -0.25], [1.38, -0.3], [1.34, -0.14], [1.16, -0.1]], [[2.3, 0.7], [2.5, 0.66], [2.48, 0.8], [2.28, 0.85]], [[1.1, 0.7], [1.22, 0.66], [1.2, 0.8], [1.08, 0.82]]];
  const tufts: [number, number][] = [[1.25, 0.1], [1.9, -0.3], [2.5, 0.5], [1.7, 0.85], [2.2, 0.85], [1.4, -0.45]];
  return (
    <g>
      {strata.map((i) => <polygon key={`x${i}`} points={ptsAttr(sideX(LB.b[0], LB.a[1], LB.b[1], STRATA_Z[i + 1], STRATA_Z[i], u, o))} fill={sandRow[i]} stroke={sandRow[i]} strokeWidth={0.6} />)}
      {strata.map((i) => <polygon key={`y${i}`} points={ptsAttr(sideY(LB.b[1], LB.a[0], LB.b[0], STRATA_Z[i + 1], STRATA_Z[i], u, o))} fill={sandCol[i]} stroke={sandCol[i]} strokeWidth={0.6} />)}
      <polygon points={ptsAttr(topCorners)} fill={grass[0]} stroke={grass[1]} strokeWidth={0.8} strokeLinejoin="round" />
      {!given && patches.map((p, i) => <polygon key={`p${i}`} points={ptsAttr(flat(p, LAND_TOP, u, o))} fill={patch} />)}
      {(wide ? [...tufts, ...landTufts()] : given ? [] : tufts).map(([x, y], i) => <polygon key={`t${i}`} points={ptsAttr([onFace(x - 0.04, y, LAND_TOP, u, o), onFace(x, y + 0.07, LAND_TOP, u, o), onFace(x + 0.04, y, LAND_TOP, u, o)])} fill={grass[2]} />)}
    </g>
  );
};

/** The hill step: a raised block on the land's back, in the grass top and the soil sides. */
export const IsoHill: React.FC<{ u: number; o: P2 }> = ({ u, o }) => (
  <g>
    {block(HILL.a, HILL.b, u, o).map((p, i) => <polygon key={i} points={ptsAttr(p.pts)} fill={p.tone === 0 ? ISO.grass[0] : ISO.soil[p.tone]} stroke={p.tone === 0 ? ISO.grass[1] : ISO.soil[p.tone]} strokeWidth={0.8} strokeLinejoin="round" />)}
  </g>
);

/** The puddles: flat blue ovals on the grass that grow with `wet` (0..1; none when dry). */
export const IsoPuddles: React.FC<{ u: number; o: P2; wet: number }> = ({ u, o, wet }) => (
  <g>
    {wet > 0 && PUDDLES.map((p, i) => {
      const r = p.r * (0.5 + 0.5 * Math.min(1, wet));
      return (
        <g key={i}>
          <polygon points={ptsAttr(flat(ring(p.x, p.y, r), LAND_TOP, u, o))} fill={ISO.water[1]} />
          <polygon points={ptsAttr(flat(ring(p.x - r * 0.25, p.y + r * 0.2, r * 0.45), LAND_TOP, u, o))} fill={ISO.water[0]} />
        </g>
      );
    })}
  </g>
);

/** The tree shadows: a flat ring on the grass at each foot, shifted away from the light (drawn before the trees). */
export const IsoTreeShadows: React.FC<{ u: number; o: P2; list?: typeof TREES }> = ({ u, o, list = TREES }) => (
  <g>
    {list.map((t, i) => <polygon key={i} points={ptsAttr(flat(ring(t.x + TREE_SHADOW.dx, t.y + TREE_SHADOW.dy, TREE_SHADOW.r), LAND_TOP, u, o))} fill={ISO.grass[2]} />)}
  </g>
);

/** The trees: pines (three tiers, each a cone split down its axis by the light, with a shaded band under it) and round trees (three lobes on a trunk).
    Back to front. */
/** `time` (seconds) makes the trees alive (B25): each crown sways a degree or two about its trunk's foot (the trees take turns: half of them sway the other way, and the
    periods differ), and every sway is 0 at t = 0, so a loop that starts at 0 has no jump; `swayAmp` (0..1) turns it down (the loop-back's last frames). Without `time` they are still. */
export const IsoTrees: React.FC<{ u: number; o: P2; list?: typeof TREES; time?: number; swayAmp?: number }> = ({ u, o, list = TREES, time, swayAmp = 1 }) => (
  <g>
    {list.map((t, i) => {
      if (t.kind === "round") {
        const trunkBot = onFace(t.x, t.y, LAND_TOP, u, o), trunkTop = onFace(t.x, t.y, LAND_TOP + 0.3 * t.h, u, o), tw = u * 0.05;
        const crown = onFace(t.x, t.y, LAND_TOP + 0.62 * t.h, u, o), rr = u * 0.42 * t.h;
        const lobes: [number, number, number][] = [[0, 0, 1], [-0.55, 0.25, 0.78], [0.5, 0.3, 0.8]];
        return (
          <g key={i} transform={time === undefined ? undefined : `rotate(${swayDeg(time, (i % 2) * 0.5, 1.4 * swayAmp, 3.2 + 0.45 * (i % 3))} ${trunkBot[0]} ${trunkBot[1]})`}>
            <polygon points={ptsAttr([[trunkBot[0] - tw, trunkBot[1]], [trunkBot[0] + tw, trunkBot[1]], [trunkTop[0] + tw, trunkTop[1]], [trunkTop[0] - tw, trunkTop[1]]])} fill={ISO.soil[1]} />
            {lobes.map(([dx, dy, k], j) => {
              const cx = crown[0] + dx * rr, cy = crown[1] + dy * rr * 0.6, r = rr * k;
              return (
                <g key={j}>
                  <circle cx={cx + r * 0.1} cy={cy + r * 0.14} r={r} fill={ISO.leaf[2]} />
                  <circle cx={cx} cy={cy} r={r * 0.9} fill={ISO.leaf[1]} />
                  <circle cx={cx - r * 0.26} cy={cy - r * 0.28} r={r * 0.46} fill={ISO.leaf[0]} />
                </g>
              );
            })}
          </g>
        );
      }
      const foot0 = onFace(t.x, t.y, LAND_TOP, u, o), tw = u * 0.05;
      const tiers = [0, 1, 2].map((j) => {
        const z = LAND_TOP + t.h * (0.22 + 0.26 * j), R = TREE_R * (1.2 - 0.2 * j) * Math.sqrt(t.h / 0.7);
        return { z, R, apexZ: z + t.h * 0.46 };
      });
      const shade = mixRgb(ISO.leaf[2], "rgb(40,60,40)", 0.4);
      return (
        <g key={i} transform={time === undefined ? undefined : `rotate(${swayDeg(time, (i % 2) * 0.5, 1.4 * swayAmp, 3.2 + 0.45 * (i % 3))} ${foot0[0]} ${foot0[1]})`}>
          <polygon points={ptsAttr([[foot0[0] - tw, foot0[1]], [foot0[0] + tw, foot0[1]], [foot0[0] + tw, foot0[1] - t.h * u * 0.22], [foot0[0] - tw, foot0[1] - t.h * u * 0.22]])} fill={ISO.soil[1]} />
          {tiers.map((ti, j) => {
            const foot = onFace(t.x, t.y, ti.z, u, o), apex = onFace(t.x, t.y, ti.apexZ, u, o);
            const left = onFace(t.x - ti.R, t.y, ti.z, u, o), right = onFace(t.x + ti.R, t.y, ti.z, u, o);
            const lift = (p: P2, k: number): P2 => [p[0] + (apex[0] - p[0]) * k, p[1] + (apex[1] - p[1]) * k];
            return (
              <g key={j}>
                <polygon points={ptsAttr([foot, right, [right[0], right[1] + u * 0.05], [foot[0], foot[1] + u * 0.05]])} fill={shade} />
                <polygon points={ptsAttr([apex, left, foot])} fill={ISO.leaf[1]} stroke={ISO.leaf[1]} strokeWidth={0.6} strokeLinejoin="round" />
                <polygon points={ptsAttr([apex, foot, right])} fill={ISO.leaf[2]} stroke={ISO.leaf[2]} strokeWidth={0.6} strokeLinejoin="round" />
                <polygon points={ptsAttr([apex, lift(left, 0.25), lift(foot, 0.25)])} fill={ISO.leaf[0]} />
              </g>
            );
          })}
        </g>
      );
    })}
  </g>
);

/** The bushes and the flowers: each bush three lobes (light, mid, dark) with a shadow; each flower five white petals and a soil-toned centre. */
export const IsoBushes: React.FC<{ u: number; o: P2; bushes?: typeof BUSHES; flowers?: typeof FLOWERS }> = ({ u, o, bushes = BUSHES, flowers = FLOWERS }) => (
  <g>
    {bushes.map((b, i) => {
      const c = onFace(b.x, b.y, LAND_TOP + b.r * 0.9, u, o), r = u * b.r;
      return (
        <g key={`b${i}`}>
          <ellipse cx={c[0] + r * 0.2} cy={c[1] + r * 1.1} rx={r * 1.7} ry={r * 0.45} fill={ISO.grass[2]} />
          <circle cx={c[0] - r * 0.6} cy={c[1]} r={r * 0.8} fill={ISO.leaf[2]} />
          <circle cx={c[0] + r * 0.6} cy={c[1]} r={r * 0.8} fill={ISO.leaf[1]} />
          <circle cx={c[0]} cy={c[1] - r * 0.4} r={r * 0.9} fill={ISO.leaf[0]} />
        </g>
      );
    })}
    {flowers.map(([x, y], i) => {
      const c = onFace(x, y, LAND_TOP, u, o), r = u * 0.02;
      return (
        <g key={`f${i}`}>
          {[0, 1, 2, 3, 4].map((k) => <circle key={k} cx={c[0] + r * 1.4 * Math.cos((k / 5) * Math.PI * 2)} cy={c[1] + r * 1.4 * Math.sin((k / 5) * Math.PI * 2)} r={r} fill={ISO.cloudWhite[0]} />)}
          <circle cx={c[0]} cy={c[1]} r={r * 0.7} fill={ISO.soil[2]} />
        </g>
      );
    })}
  </g>
);

/** The rocks: small blocks of stone on the grass (three faces in the stone tones). */
export const IsoRocks: React.FC<{ u: number; o: P2; list?: typeof ROCKS }> = ({ u, o, list = ROCKS }) => (
  <g>
    {list.map((r, i) => block([r.x - r.s, r.y - r.s, LAND_TOP] as P3, [r.x + r.s, r.y + r.s, LAND_TOP + r.h] as P3, u, o).map((p, j) => (
      <polygon key={`${i}-${j}`} points={ptsAttr(p.pts)} fill={ISO.stone[p.tone]} stroke={ISO.stone[p.tone]} strokeWidth={0.6} strokeLinejoin="round" />
    )))}
  </g>
);

/** The stepped hills of the wide diorama: each a stack of blocks, a step smaller each time, in the hill step's tones (grass top, soil sides). Back to front. */
export const IsoHills: React.FC<{ u: number; o: P2; list?: HillBlock[][] }> = ({ u, o, list = HILLS_WIDE }) => (
  <g>
    {list.map((h, i) => (
      <g key={i}>
        {h.map((b, k) => block(b.a as P3, b.b as P3, u, o).map((p, j) => (
          <polygon key={`${k}-${j}`} points={ptsAttr(p.pts)} fill={p.tone === 0 ? ISO.grass[0] : k === 0 ? ISO.soil[p.tone] : ISO.grass[p.tone]} stroke={p.tone === 0 ? ISO.grass[1] : k === 0 ? ISO.soil[p.tone] : ISO.grass[p.tone]} strokeWidth={0.8} strokeLinejoin="round" />
        )))}
      </g>
    ))}
  </g>
);

/** The crop fields: a flat plot of soil on the grass with rows of green plants (`rows`, along x or y); the soil is a little darker when wet. */
export const IsoFields: React.FC<{ u: number; o: P2; list?: Field[]; wet?: number }> = ({ u, o, list = FIELDS, wet = 0 }) => {
  const soil = mixRgb(ISO.soil[0], ISO.soil[2], 0.35 * Math.max(0, Math.min(1, wet)));
  return (
    <g>
      {list.map((f, i) => {
        const [x0, y0] = f.a, [x1, y1] = f.b, n = f.rows;
        return (
          <g key={i}>
            <polygon points={ptsAttr(flat([[x0, y0], [x1, y0], [x1, y1], [x0, y1]], LAND_TOP, u, o))} fill={soil} stroke={ISO.soil[1]} strokeWidth={0.8} strokeLinejoin="round" />
            {Array.from({ length: n }, (_, k) => {
              const t0 = (k + 0.3) / n, t1 = (k + 0.7) / n;
              const poly: [number, number][] = f.dir === "x"
                ? [[x0 + 0.12, y0 + (y1 - y0) * t0], [x1 - 0.12, y0 + (y1 - y0) * t0], [x1 - 0.12, y0 + (y1 - y0) * t1], [x0 + 0.12, y0 + (y1 - y0) * t1]]
                : [[x0 + (x1 - x0) * t0, y0 + 0.12], [x0 + (x1 - x0) * t1, y0 + 0.12], [x0 + (x1 - x0) * t1, y1 - 0.12], [x0 + (x1 - x0) * t0, y1 - 0.12]];
              return <polygon key={k} points={ptsAttr(flat(poly, LAND_TOP, u, o))} fill={k % 2 ? ISO.leaf[1] : ISO.leaf[0]} />;
            })}
          </g>
        );
      })}
    </g>
  );
};

/** Far hills: two flat ridges in layer px, the back one paler, each a smooth skyline over a flat base (`base`), tinted towards the sky by `haze` (0..1). A far-layer piece
    (B27.2: parallax about 0.3): it has no light and shade of its own, so depth comes from the haze. `crest` is the skyline's height, `x0`..`x1` its extent. */
export const IsoFarHills: React.FC<{ x0: number; x1: number; crest: number; base: number; haze?: number }> = ({ x0, x1, crest, base, haze = 0.55 }) => {
  const ridge = (shift: number, amp: number, k: number) => {
    const n = 14, pts: P2[] = Array.from({ length: n + 1 }, (_, i) => { const f = i / n; return [x0 + (x1 - x0) * f, crest + shift - amp * (0.55 + 0.45 * Math.sin(f * 17 + k) * Math.sin(f * 5 + k * 2))] as P2; });
    return smoothPath(pts, 0.5) + ` L ${x1} ${base} L ${x0} ${base} Z`;
  };
  return (
    <g>
      <path d={ridge(-30, 70, 1)} fill={mixRgb(ISO.grass[0], ISO.wall[0], Math.min(1, haze + 0.2))} />
      <path d={ridge(10, 60, 4)} fill={mixRgb(ISO.grass[1], ISO.wall[0], haze)} />
    </g>
  );
};

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

/** A cloud: its back puffs (one tone darker), the flat underside (the belly ellipses and a darker band under them), the front puffs as crescent-shaded
    volumes (a dark base, a mid body set up and left so the dark shows as a crescent at the lower right, a light cap at the upper left, a rim on the
    light side, a fold), and two wisps at its ends. The tones are cloudWhite (dark 0) to cloudGrey (dark 1). `grow` scales it; `phase` breathes it. */
export const IsoCloud: React.FC<{ u: number; o: P2; cx: number; cy: number; cz: number; dark?: number; grow?: number; phase?: number; haze?: number }> = ({ u, o, cx, cy, cz, dark = 0, grow = 1, phase = 0, haze = 0 }) => {
  // haze (0..1): a far cloud, paler (its tones mixed towards the sky) so it sits back in the picture
  const tone = (t: 0 | 1 | 2) => mixRgb(mixRgb(ISO.cloudWhite[t], ISO.cloudGrey[t], dark), ISO.wall[0], haze);
  const back = mixRgb(tone(2), "rgb(120,120,120)", 0.3), backBody = mixRgb(tone(2), tone(1), 0.5);
  const parts = cloudParts(cx, cy, cz, grow, phase);
  const project = (p: { x: number; y: number; z: number }) => isoAt([p.x, p.y, p.z] as P3, u, o) as P2;
  const billow = (p: { x: number; y: number; z: number; r: number }, i: number, k: "front" | "back" | "wisp") => {
    const c = project(p), r = p.r * u;
    const base = k === "back" ? back : tone(2), body = k === "back" ? backBody : tone(1);
    return (
      <g key={`${k}${i}`}>
        <circle cx={c[0] + r * 0.12} cy={c[1] + r * 0.14} r={r} fill={base} />
        <circle cx={c[0] - r * 0.04} cy={c[1] - r * 0.04} r={r * 0.9} fill={body} />
        <circle cx={c[0] - r * 0.26} cy={c[1] - r * 0.28} r={r * 0.46} fill={tone(0)} />
        {k !== "back" && <path d={arcD(c, r * 0.8, Math.PI * 1.1, Math.PI * 1.45)} fill="none" stroke={tone(0)} strokeWidth={r * 0.08} strokeLinecap="round" />}
        {k !== "back" && <path d={arcD(c, r * 0.5, Math.PI * 0.2, Math.PI * 0.7)} fill="none" stroke={tone(2)} strokeWidth={r * 0.07} strokeLinecap="round" />}
        {k !== "back" && <circle cx={c[0] - r * 0.42} cy={c[1] - r * 0.5} r={r * 0.08} fill={tone(0)} />}
      </g>
    );
  };
  return (
    <g>
      {parts.back.map((p, i) => billow(p, i, "back"))}
      {parts.belly.map((b, i) => {
        const c = isoAt([b.x, b.y, b.z] as P3, u, o) as P2;
        return (
          <g key={`b${i}`}>
            <ellipse cx={c[0]} cy={c[1] + u * 0.05} rx={b.rs * 1.22 * u} ry={b.rz * u * 1.3} fill={tone(2)} />
            <ellipse cx={c[0]} cy={c[1] + u * 0.02} rx={b.rs * 1.1 * u} ry={b.rz * u} fill={tone(1)} />
          </g>
        );
      })}
      {parts.puffs.map((p, i) => billow(p, i, "front"))}
      {parts.wisps.map((p, i) => billow(p, i, "wisp"))}
    </g>
  );
};

/** The cloud's shadow on the sea (drawn with the sea; this tile on its own draws the same flat ring). */
export const IsoCloudShadow: React.FC<{ u: number; o: P2; k: number }> = ({ u, o, k }) => (
  <polygon points={ptsAttr(flat(ring(CLOUD_SHADOW.x, CLOUD_SHADOW.y, CLOUD_SHADOW.r), SEA_TOP, u, o))} fill={shadowColour(k)} />
);

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

/** The runoff: a stream on the land's top face, beside the trees, from the back toward the land's edge, clipped to that face: a channel of soil with
    its banks, then the water in it; then a short thin fall over the edge into the sea (its splash ring comes from IsoSea). `k` (0..1) is the water. */
export const IsoRunoff: React.FC<{ u: number; o: P2; k: number }> = ({ u, o, k }) => {
  const id = React.useId().replace(/:/g, "");
  const top = flat([[LAND.a[0], LAND.a[1]], [LAND.b[0], LAND.a[1]], [LAND.b[0], LAND.b[1]], [LAND.a[0], LAND.b[1]]], LAND_TOP, u, o);
  const path = RUNOFF.onLandPath.map(([x, y]) => onFace(x, y, LAND_TOP, u, o));
  const fall = RUNOFF.fall.map(([x, y, z]) => onFace(x, y, z, u, o));
  return (
    <g opacity={k}>
      <defs><clipPath id={`land${id}`}><polygon points={ptsAttr(top)} /></clipPath></defs>
      <g clipPath={`url(#land${id})`}>
        <path d={smoothPath(path, 0.5)} fill="none" stroke={ISO.soil[2]} strokeWidth={u * 0.13} strokeLinecap="round" />
        <path d={smoothPath(path, 0.5)} fill="none" stroke={ISO.water[1]} strokeWidth={u * 0.07} strokeLinecap="round" />
      </g>
      <line x1={fall[0][0]} y1={fall[0][1]} x2={fall[1][0]} y2={fall[1][1]} stroke={ISO.water[1]} strokeWidth={u * 0.05} strokeLinecap="round" />
    </g>
  );
};

/** A water drop about (cx, cy), radius r px: a dark base set to the lower right, the mid body up and left, a light cap and a white glint (the cloud billow's
    crescent shading in the water tones). `stretch` (0..1) draws it falling: taller than wide, a small tail above it. Flat tones only. */
export const IsoDrop: React.FC<{ cx: number; cy: number; r: number; stretch?: number }> = ({ cx, cy, r, stretch = 0 }) => {
  const sy = 1 + 0.35 * stretch, sx = 1 - 0.12 * stretch;
  return (
    <g transform={`translate(${cx} ${cy}) scale(${sx} ${sy})`}>
      {stretch > 0 && <path d={`M ${-r * 0.78} ${-r * 0.3} Q ${-r * 0.2} ${-r * 0.85} 0 ${-r * (1.1 + 0.9 * stretch)} Q ${r * 0.2} ${-r * 0.85} ${r * 0.78} ${-r * 0.3} Z`} fill={ISO.water[1]} />}
      <circle cx={r * 0.1} cy={r * 0.12} r={r} fill={ISO.water[2]} />
      <circle cx={-r * 0.03} cy={-r * 0.03} r={r * 0.9} fill={ISO.water[1]} />
      <circle cx={-r * 0.28} cy={-r * 0.3} r={r * 0.42} fill={ISO.water[0]} />
      <circle cx={-r * 0.42} cy={-r * 0.46} r={r * 0.1} fill={WHITE_RIPPLE} />
    </g>
  );
};
