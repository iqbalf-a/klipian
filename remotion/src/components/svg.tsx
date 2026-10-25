/* The few drawing primitives the sheet's Python used (disc, ring, line, arc, chord), as SVG. Everything is flat fills
   (rings and lines are strokes only where the Python drew them as strokes); there are no outlines on shapes. */
import React from "react";

const rad = (deg: number): number => (deg * Math.PI) / 180;

export const seg = (p: readonly [number, number], length: number, angle: number): [number, number] =>
  [p[0] + length * Math.cos(rad(angle)), p[1] + length * Math.sin(rad(angle))];

/** Points of an elliptical arc from a0 to a1 degrees (y down, like PIL), as an SVG path "M x y L x y ...". */
export function arcPoints(cx: number, cy: number, rx: number, ry: number, a0: number, a1: number, steps = 28): string {
  let d = "";
  for (let i = 0; i <= steps; i++) {
    const a = rad(a0 + ((a1 - a0) * i) / steps);
    d += `${i === 0 ? "M" : "L"}${(cx + rx * Math.cos(a)).toFixed(2)} ${(cy + ry * Math.sin(a)).toFixed(2)} `;
  }
  return d;
}

export const Disc: React.FC<{ x: number; y: number; r: number; fill: string }> = ({ x, y, r, fill }) =>
  <circle cx={x} cy={y} r={Math.max(0, r)} fill={fill} />;

export const Oval: React.FC<{ x: number; y: number; rx: number; ry: number; fill: string }> = ({ x, y, rx, ry, fill }) =>
  <ellipse cx={x} cy={y} rx={Math.max(0, rx)} ry={Math.max(0, ry)} fill={fill} />;

export const Ring: React.FC<{ x: number; y: number; r: number; w: number; stroke: string }> = ({ x, y, r, w, stroke }) =>
  <circle cx={x} cy={y} r={Math.max(0, r)} fill="none" stroke={stroke} strokeWidth={w} />;

export const Line: React.FC<{ a: readonly [number, number]; b: readonly [number, number]; w: number; stroke: string }> = ({ a, b, w, stroke }) =>
  <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={stroke} strokeWidth={w} strokeLinecap="round" />;

/** A stroked arc with round ends (PIL drew it as a row of discs). */
export const Arc: React.FC<{ cx: number; cy: number; rx: number; ry: number; a0: number; a1: number; w: number; stroke: string }> =
  ({ cx, cy, rx, ry, a0, a1, w, stroke }) =>
    <path d={arcPoints(cx, cy, rx, ry, a0, a1)} fill="none" stroke={stroke} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" />;

/** PIL's chord: the part of an ellipse between its arc (a0..a1) and the straight line joining the ends. */
export const Chord: React.FC<{ cx: number; cy: number; rx: number; ry: number; a0: number; a1: number; fill: string }> =
  ({ cx, cy, rx, ry, a0, a1, fill }) => <path d={`${arcPoints(cx, cy, rx, ry, a0, a1)}Z`} fill={fill} />;

/** A round opening with depth: the shade fills it, then the base is drawn shifted down-right and clipped to the opening,
    which leaves a hard crescent on the upper-left inner edge (light from the top-left). `off` is a fraction of r. */
export const Hole: React.FC<{ x: number; y: number; r: number; fill: string; shade: string; off?: number }> =
  ({ x, y, r, fill, shade, off = 0.3 }) => {
    const id = `hole${React.useId().replace(/:/g, "")}`;
    return (
      <g>
        <clipPath id={id}><circle cx={x} cy={y} r={r} /></clipPath>
        <circle cx={x} cy={y} r={r} fill={shade} />
        <circle cx={x + r * off} cy={y + r * off} r={r} fill={fill} clipPath={`url(#${id})`} />
      </g>
    );
  };

export const Rect: React.FC<{ x0: number; y0: number; x1: number; y1: number; r?: number; fill: string }> =
  ({ x0, y0, x1, y1, r = 0, fill }) =>
    <rect x={Math.min(x0, x1)} y={Math.min(y0, y1)} width={Math.abs(x1 - x0)} height={Math.abs(y1 - y0)} rx={r} ry={r} fill={fill} />;

export const Poly: React.FC<{ pts: ReadonlyArray<readonly [number, number]>; fill: string }> = ({ pts, fill }) =>
  <polygon points={pts.map((p) => `${p[0]},${p[1]}`).join(" ")} fill={fill} />;
