/* The people inside a video: chibi. One base (big round head, big shiny eyes, blush, short rounded body, mitten hands,
   short legs, black shoes, no outlines); a role changes only hair, colours and costume. A port of chibi_people.py.
   Drawn with the feet at (0, 0); u = the head's half-width. */
import React from "react";
import { BLACK, BLUSH, G1, SKIN_A, WHITE, YELLOW, YELLOW_D } from "../tokens.ts";
import type { ChibiExpression, ChibiPose } from "../catalog.ts";
import { Arc, Chord, Disc, Line, Oval, Poly, Rect, seg } from "./svg.tsx";

const blend = (rgbText: string, k: number): string => {
  const [r, g, b] = (rgbText.match(/\d+/g) ?? ["0", "0", "0"]).map(Number);
  const to = [225, 120, 120];
  return `rgb(${Math.round(r + (to[0] - r) * k)},${Math.round(g + (to[1] - g) * k)},${Math.round(b + (to[2] - b) * k)})`;
};

function Face({ u, expr, skin }: { u: number; expr: ChibiExpression; skin: string }) {
  const ey = 0.14 * u;
  const eyes = [-1, 1].map((sgn) => {
    const x = sgn * 0.42 * u;
    return (
      <g key={sgn}>
        {expr === "happy" && <Arc cx={x} cy={ey + 0.05 * u} rx={0.13 * u} ry={0.11 * u} a0={200} a1={340} w={0.075 * u} stroke={BLACK} />}
        {expr === "ouch" && <>
          <Line a={[x - 0.12 * u * sgn, ey - 0.09 * u]} b={[x + 0.1 * u * sgn, ey]} w={0.07 * u} stroke={BLACK} />
          <Line a={[x + 0.1 * u * sgn, ey]} b={[x - 0.12 * u * sgn, ey + 0.09 * u]} w={0.07 * u} stroke={BLACK} />
        </>}
        {(expr === "calm" || expr === "surprised") && <>
          <Oval x={x} y={ey} rx={0.14 * u * (expr === "surprised" ? 1.15 : 1)} ry={0.17 * u * (expr === "surprised" ? 1.15 : 1)} fill={BLACK} />
          <Disc x={x - 0.05 * u} y={ey - 0.07 * u} r={0.055 * u} fill={WHITE} />
          <Disc x={x + 0.05 * u} y={ey + 0.06 * u} r={0.028 * u} fill={WHITE} />
        </>}
        <Oval x={x + sgn * 0.16 * u} y={ey + 0.26 * u} rx={0.15 * u} ry={0.07 * u} fill={blend(skin, 0.35)} />
      </g>
    );
  });
  const my = 0.4 * u;
  return (
    <g>
      {eyes}
      {expr === "happy" && <>
        <path d={`M${-0.15 * u} ${my + 0.035 * u} A${0.15 * u} ${0.135 * u} 0 0 0 ${0.15 * u} ${my + 0.035 * u} Z`} fill={BLACK} />
        <Oval x={0} y={my + 0.1 * u} rx={0.07 * u} ry={0.035 * u} fill={BLUSH} />
      </>}
      {(expr === "surprised" || expr === "ouch") && <Oval x={0} y={my + 0.05 * u} rx={0.065 * u} ry={0.085 * u} fill={BLACK} />}
      {expr === "calm" && <Arc cx={0} cy={my} rx={0.09 * u} ry={0.05 * u} a0={20} a1={160} w={0.05 * u} stroke={BLACK} />}
    </g>
  );
}

/** Short hair: the front layer only (the base has no back layer for it). */
function HairShortFront({ u }: { u: number }) {
  const uu = u * 1.03;
  return (
    <g>
      <Chord cx={0} cy={-0.04 * u} rx={1.05 * uu} ry={0.93 * uu} a0={188} a1={352} fill={BLACK} />
      <Poly pts={[[-0.75 * u, -0.55 * u], [0.3 * u, -0.6 * u], [-0.45 * u, -0.12 * u]]} fill={BLACK} />
      {[-0.62, -0.24, 0.14, 0.52].map((k) => <Disc key={k} x={k * u} y={-0.22 * u} r={0.17 * u} fill={BLACK} />)}
      <Poly pts={[[0.1 * u, -0.88 * u], [0.45 * u, -0.8 * u], [0.4 * u, -1.15 * u]]} fill={BLACK} />
    </g>
  );
}

function HelmetFront({ u }: { u: number }) {
  const uu = u * 1.06;
  return (
    <g>
      <Chord cx={0} cy={-0.32 * u} rx={1.05 * uu} ry={0.93 * uu} a0={180} a1={360} fill={YELLOW} />
      <Rect x0={-1.22 * u} y0={-0.42 * u} x1={1.22 * u} y1={-0.28 * u} r={0.07 * u} fill={YELLOW_D} />
      <Rect x0={-0.1 * u} y0={-1.28 * u} x1={0.1 * u} y1={-0.42 * u} fill={YELLOW_D} />
    </g>
  );
}

const POSES: Record<ChibiPose, [number, number]> = {   // arm angles (left, right) from the shoulder; 90 = straight down
  idle: [115, 65], wave: [115, -55], cheer: [-130, -50], point: [115, -15], ouch: [-160, 20],
};

export const Chibi: React.FC<{
  u: number; expr: ChibiExpression; pose: ChibiPose; costume?: "none" | "helmet"; shirt?: string; stripe?: string | null; skin?: string; t?: number;
}> = ({ u, expr, pose, costume = "none", shirt = G1, stripe = YELLOW, skin = SKIN_A, t = 0 }) => {
  const hip = -0.62 * u, top = hip - 0.95 * u;
  const [al, ar] = POSES[pose];
  const bob = 1 + 0.012 * Math.sin(t * 6);
  const arms = ([["l", al, -1], ["r", ar, 1]] as const).map(([side, ang, sgn]) => {
    const sh: [number, number] = [sgn * 0.52 * u, top + 0.28 * u];
    const end = seg(sh, 0.62 * u, ang);
    const thumb = seg(end, 0.16 * u, ang - 70 * sgn);
    return (
      <g key={side}>
        <Line a={sh} b={end} w={0.32 * u} stroke={shirt} />
        <Disc x={end[0]} y={end[1]} r={0.18 * u} fill={skin} />
        <Disc x={thumb[0]} y={thumb[1]} r={0.07 * u} fill={skin} />
      </g>
    );
  });
  const hc: [number, number] = [0, top - 0.8 * u];
  return (
    <g transform={`scale(1 ${bob})`}>
      {[-1, 1].map((sgn) => (
        <g key={sgn}>
          <Line a={[sgn * 0.3 * u, hip]} b={[sgn * 0.3 * u, -0.16 * u]} w={0.38 * u} stroke={BLACK} />
          <Rect x0={sgn * 0.3 * u - 0.24 * u} y0={-0.24 * u} x1={sgn * 0.3 * u + 0.24 * u} y1={0} r={0.11 * u} fill={BLACK} />
        </g>
      ))}
      {arms}
      <Rect x0={-0.62 * u} y0={top} x1={0.62 * u} y1={hip + 0.1 * u} r={0.34 * u} fill={shirt} />
      {stripe && <Rect x0={-0.62 * u} y0={top + 0.5 * u} x1={0.62 * u} y1={top + 0.62 * u} fill={stripe} />}
      <g transform={`translate(${hc[0]} ${hc[1]})`}>
        <Oval x={0} y={0} rx={1.05 * u} ry={0.93 * u} fill={skin} />
        <Face u={u} expr={expr} skin={skin} />
        <HairShortFront u={u} />
        {costume === "helmet" && <HelmetFront u={u} />}
      </g>
      {costume === "helmet" && [0.3, 0.62].map((k) => <Rect key={k} x0={-0.62 * u} y0={top + k * u} x1={0.62 * u} y1={top + (k + 0.1) * u} fill={YELLOW} />)}
    </g>
  );
};
