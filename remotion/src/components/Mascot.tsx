/* The mascot: the klipian logo come alive. A yellow speech bubble with a dot eye and ONE magnifier eye, no body.
   A port of bubble() and face() in workspace/channel-art/klipian-intip/make_v2.py and mascot() / pill() in make_mascot.py.
   Drawn around its own centre (0, 0); <Mascot> places, squashes, tilts and pops it. */
import React from "react";
import { BLACK, WHITE, YELLOW, YELLOW_D } from "../tokens.ts";
import type { MascotExpression } from "../catalog.ts";
import { Arc, Disc, Line, Poly, Ring, seg } from "./svg.tsx";
import { easeOutBack } from "../stopmotion.ts";

function Bubble({ w, body }: { w: number; body: string }) {
  const h = w * 0.8, x0 = -w / 2, y0 = -h / 2, tipR = w * 0.045;
  const tip: [number, number] = [x0 + w * 0.13, y0 + h * 1.13];
  const a: [number, number] = [x0 + w * 0.16, y0 + h * 0.8], b: [number, number] = [x0 + w * 0.42, y0 + h * 0.9];
  const tan = (pt: [number, number], sign: number): [number, number] => {
    const dx = tip[0] - pt[0], dy = tip[1] - pt[1], len = Math.hypot(dx, dy);
    return [tip[0] - (dy / len) * sign * tipR, tip[1] + (dx / len) * sign * tipR];
  };
  return (
    <g>
      <Poly pts={[a, b, tan(b, -1), tan(a, 1)]} fill={body} />
      <Disc x={tip[0]} y={tip[1]} r={tipR} fill={body} />
      <rect x={x0} y={y0} width={w} height={h} rx={h * 0.42} ry={h * 0.42} fill={body} />
    </g>
  );
}

function Face({ w, expr, ink, lensFill }: { w: number; expr: MascotExpression; ink: string; lensFill: string }) {
  const h = w * 0.8;
  const ex = -w * 0.18, ey = -h * 0.04;
  const lx = w * 0.14, ly = -h * 0.08, lr = w * 0.17;
  const pupilAt = ({ think: [-0.25, -0.35], surprised: [0, 0], ouch: [-0.3, 0.3] } as Record<string, [number, number]>)[expr] ?? [0.15, 0.1];
  const big = expr === "surprised" || expr === "ouch";
  const hx = lx + lr * 0.7, hy = ly + lr * 0.7;
  const bx = ex, by = -h * 0.22;
  const mx = -w * 0.02, my = h * 0.22;
  return (
    <g>
      {/* the dot eye */}
      {expr === "laugh" || expr === "understand"
        ? <Arc cx={ex} cy={ey + w * 0.02} rx={w * 0.06} ry={w * 0.05} a0={200} a1={340} w={w * 0.04} stroke={ink} />
        : big
          ? <><Disc x={ex} y={ey} r={w * 0.08} fill={lensFill} /><Disc x={ex} y={ey} r={w * 0.05} fill={ink} /></>
          : <Disc x={ex} y={ey} r={w * 0.06} fill={ink} />}
      {/* the lens eye: white disc, black ring, pupil, glint, handle */}
      <Disc x={lx} y={ly} r={lr} fill={lensFill} />
      <Ring x={lx} y={ly} r={lr} w={w * 0.045} stroke={ink} />
      <Disc x={lx + lr * pupilAt[0]} y={ly + lr * pupilAt[1]} r={w * (big ? 0.055 : 0.08)} fill={ink} />
      <Disc x={lx + lr * 0.35} y={ly - lr * 0.3} r={w * 0.02} fill={lensFill} />
      <Line a={[hx, hy]} b={[hx + w * 0.1, hy + w * 0.1]} w={w * 0.05} stroke={ink} />
      {/* brow */}
      {(expr === "curious" || expr === "think") && <Arc cx={bx} cy={by} rx={w * 0.07} ry={w * 0.04} a0={200} a1={340} w={w * 0.035} stroke={ink} />}
      {big && <Arc cx={bx} cy={by - w * 0.04} rx={w * 0.07} ry={w * 0.04} a0={200} a1={340} w={w * 0.035} stroke={ink} />}
      {/* mouth */}
      {expr === "curious" && <Arc cx={mx} cy={my} rx={w * 0.055} ry={w * 0.028} a0={20} a1={160} w={w * 0.032} stroke={ink} />}
      {expr === "surprised" && <Disc x={mx} y={my + w * 0.02} r={w * 0.05} fill={ink} />}
      {expr === "ouch" && <Arc cx={mx} cy={my + w * 0.05} rx={w * 0.07} ry={w * 0.035} a0={200} a1={340} w={w * 0.032} stroke={ink} />}
      {expr === "understand" && <Arc cx={mx} cy={my} rx={w * 0.1} ry={w * 0.05} a0={15} a1={165} w={w * 0.035} stroke={ink} />}
      {expr === "laugh" && <path d={`M${mx - w * 0.12} ${my + w * 0.01} A${w * 0.12} ${w * 0.11} 0 0 0 ${mx + w * 0.12} ${my + w * 0.01} Z`} fill={ink} />}
      {expr === "think" && <Line a={[mx - w * 0.07, my + w * 0.02]} b={[mx + w * 0.04, my]} w={w * 0.03} stroke={ink} />}
    </g>
  );
}

/** The bubble and its face, at the origin, width w. */
export const MascotArt: React.FC<{ w: number; expr: MascotExpression; body?: "yellow" | "black" }> = ({ w, expr, body = "yellow" }) => {
  const bodyColor = body === "black" ? BLACK : YELLOW;
  const ink = body === "black" ? YELLOW : BLACK;
  return <g><Bubble w={w} body={bodyColor} /><Face w={w} expr={expr} ink={ink} lensFill={WHITE} /></g>;
};

/** The squash and stretch of the "pop" entrance, by seconds into the beat (the sheet's sting: lens, pop!, stretch, settle). */
export function popShape(t: number): { sx: number; sy: number; grow: number } {
  if (t < 0.2) return { sx: 1.25, sy: 0.72, grow: easeOutBack(t / 0.2) };
  if (t < 0.4) return { sx: 0.88, sy: 1.14, grow: 1 };
  if (t < 0.6) return { sx: 1.06, sy: 0.96, grow: 1 };
  return { sx: 1, sy: 1, grow: 1 };
}

export const Mascot: React.FC<{
  x: number; y: number; w: number; expr: MascotExpression; t: number; sparks?: boolean; rot?: number; pop?: boolean; body?: "yellow" | "black";
}> = ({ x, y, w, expr, t, sparks, rot = 0, pop, body = "yellow" }) => {
  const shape = pop ? popShape(t) : { sx: 1, sy: 1 + 0.018 * Math.sin(t * 5), grow: 1 };
  const sparkColor = body === "yellow" ? YELLOW_D : YELLOW;
  return (
    <g transform={`translate(${x} ${y})`}>
      <g transform={`rotate(${rot}) scale(${shape.sx * shape.grow} ${shape.sy * shape.grow})`}>
        <MascotArt w={w} expr={expr} body={body} />
      </g>
      {sparks && (t * 12) % 4 < 3 && [-60, -35, -10].map((a) => {
        const p0: [number, number] = [w * 0.58 * Math.cos((a * Math.PI) / 180), -w * 0.1 + w * 0.5 * Math.sin((a * Math.PI) / 180)];
        return <Line key={a} a={p0} b={seg(p0, w * 0.1, a)} w={w * 0.035} stroke={sparkColor} />;
      })}
    </g>
  );
};
