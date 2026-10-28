/* The cloud-seeding set (the hujan buatan video): the seeding aircraft and the seed grains. Flat tones from the ISO kit's neutral sets (plastic, dark,
   metal), never the nature tones (those belong to IsoNature.tsx, tests/nature.test.ts). Screen-space drawings with the tone rule (light on top, mid on the
   lower left, dark on the lower right); no outlines, no gradients, no filters. `IsoPlane` flies nose to the right and is drawn about its centre;
   `IsoSeed` is a salt cluster (white cubes) or a silver iodide crystal (a cut gem of silver, an ice-like shape) about its centre. */
import React from "react";
import { ISO, WHITE } from "../tokens.ts";
import { block, ptsAttr, type P2, type P3 } from "../iso.ts";
import { Polys } from "./Iso.tsx";

/** The seeding aircraft, nose to the right, `w` px long (the drawing is 330 units long), `phase` spins the propeller (any number, it flickers). The rack under
    the near wing is where the grains leave: `PLANE_RACK` is its place in the drawing's own units (x right, y down, origin at the fuselage's centre). */
export const PLANE_RACK: P2 = [-18, 124];
export const PLANE_UNITS = 330;
export const IsoPlane: React.FC<{ x: number; y: number; w: number; phase?: number }> = ({ x, y, w, phase = 0 }) => {
  const T = ISO.dark, D = ISO.plastic, M = ISO.metal, s = w / PLANE_UNITS;      // a dark body so it reads against the white cloud, light windows, a silver fin
  const flick = 0.72 + 0.28 * Math.abs(Math.sin(phase * 19));
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      {/* the far wing and tailplane, behind the body */}
      <polygon points="-8,-16 66,-16 16,-108 -50,-108" fill={T[2]} />
      <polygon points="-130,-14 -98,-14 -124,-58 -152,-58" fill={T[2]} />
      {/* the tail fin (a dark accent), then the body: dark underside, mid body, light back */}
      <polygon points="-156,-12 -104,-12 -126,-92 -164,-92" fill={M[1]} />
      <rect x={-160} y={-36} width={322} height={72} rx={36} fill={T[2]} />
      <rect x={-160} y={-36} width={322} height={56} rx={34} fill={T[1]} />
      <rect x={-136} y={-33} width={252} height={17} rx={8} fill={T[0]} />
      {/* the cockpit and the cabin windows */}
      <polygon points="76,-26 116,-26 132,-6 68,-6" fill={D[1]} />
      {[-112, -78, -44, -10, 24].map((wx) => <circle key={wx} cx={wx} cy={-6} r={7.5} fill={D[0]} />)}
      {/* the near wing, in three bands (leading edge light, body mid, trailing edge dark), with the rack that holds the grains */}
      <polygon points="-28,18 52,18 6,120 -64,120" fill={T[1]} />
      <polygon points="-28,18 52,18 44,40 -36,40" fill={T[0]} />
      <polygon points="-64,120 6,120 2,130 -68,130" fill={T[2]} />
      <rect x={PLANE_RACK[0] - 9} y={104} width={18} height={30} rx={8} fill={M[1]} />
      {/* the nose: hub and the spinning propeller */}
      <ellipse cx={170} cy={0} rx={8} ry={56 * flick} fill={M[2]} opacity={0.55} />
      <circle cx={168} cy={0} r={10} fill={M[1]} />
    </g>
  );
};

/** The salt: a cluster of four white cubes (the tone rule on each face). `u` px per unit. */
const SaltCluster: React.FC<{ u: number; o: P2 }> = ({ u, o }) => {
  const cubes: [P3, P3][] = [[[0, 0, 0], [1, 1, 1]], [[1, 0, 0], [2, 1, 0.8]], [[0, 1, 0], [0.9, 2, 0.9]], [[0.1, 0.1, 1], [0.8, 0.8, 1.7]]];
  return <g>{cubes.map(([a, b], i) => <Polys key={i} polys={block(a, b, u, o)} tones={ISO.plastic} />)}</g>;
};
/** Silver iodide: a cut gem of silver (the metal tones), a pointed hexagon with a flat table in the middle, its facets toned by the way they face (light from the
    top left), a thick dark lower edge and a small glint: an ice-like crystal. Radius `r` px. */
const Crystal: React.FC<{ x: number; y: number; r: number; t: number }> = ({ x, y, r, t }) => {
  const tones = ISO.metal, corner = (k: number, rr: number, dx = 0, dy = 0): P2 => { const a = (-90 + 60 * k) * Math.PI / 180; return [x + dx + rr * Math.cos(a), y + dy + rr * Math.sin(a)]; };
  const ring = (rr: number, dx = 0, dy = 0) => Array.from({ length: 6 }, (_, k) => corner(k, rr, dx, dy));
  const tone = (k: number): 0 | 1 | 2 => { const f = ((-90 + 60 * k + 30) * Math.PI) / 180, b = Math.cos(f) * -0.6 + Math.sin(f) * -0.8; return b > 0.45 ? 0 : b > -0.1 ? 1 : 2; };
  const glint = 0.5 + 0.5 * Math.sin(t * 3.1);
  return (
    <g>
      <polygon points={ptsAttr(ring(r, 0.1 * r, 0.16 * r))} fill={tones[2]} />
      {[0, 1, 2, 3, 4, 5].map((k) => <polygon key={k} points={ptsAttr([corner(k, r), corner(k + 1, r), corner(k + 1, r * 0.5), corner(k, r * 0.5)])} fill={tones[tone(k)]} stroke={tones[tone(k)]} strokeWidth={0.6} strokeLinejoin="round" />)}
      <polygon points={ptsAttr(ring(r * 0.5))} fill={tones[0]} />
      <polygon points={ptsAttr([[x - r * 0.26, y - r * 0.12], [x - r * 0.1, y - r * 0.3], [x + 0.02 * r, y - r * 0.12], [x - r * 0.1, y + 0.02 * r]])} fill={WHITE} opacity={0.35 + 0.65 * glint} />
    </g>
  );
};
/** A seed grain about (x, y): "salt" is a cluster of white cubes (hygroscopic: it draws vapour in), "agi" a silver iodide crystal (ice-like). `s` px per unit. */
export const IsoSeed: React.FC<{ kind: "salt" | "agi"; x: number; y: number; s: number; t?: number }> = ({ kind, x, y, s, t = 0 }) =>
  kind === "salt" ? <SaltCluster u={s} o={[x, y - 0.15 * s]} /> : <Crystal x={x} y={y} r={s} t={t} />;
