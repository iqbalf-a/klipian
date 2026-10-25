/* The mascot: the klipian logo come alive. A yellow speech bubble with a dot eye and ONE magnifier eye, no body.
   A port of bubble() and face() in workspace/channel-art/klipian-intip/make_v2.py and mascot() / pill() in make_mascot.py.
   Drawn around its own centre (0, 0); <Mascot> places, squashes, tilts and brings it to life: it hovers, blinks, and the
   pupil of its lens looks around (or at a point, when the story says so). */
import React from "react";
import { BLACK, WHITE, YELLOW, YELLOW_D } from "../tokens.ts";
import type { MascotExpression } from "../catalog.ts";
import { Arc, Disc, Line, Oval, Poly, Ring, seg } from "./svg.tsx";
import { blink as blinkAt, hover } from "../motion.ts";

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

const PUPIL: Record<string, [number, number]> = { think: [-0.25, -0.35], surprised: [0, 0], ouch: [-0.3, 0.3] };
const DEFAULT_PUPIL: [number, number] = [0.15, 0.1];
/** Where the lens's pupil rests for an expression (fractions of the lens radius). */
export const pupilFor = (expr: string): [number, number] => PUPIL[expr] ?? DEFAULT_PUPIL;
/** The lens centre relative to the bubble's centre, for aiming the pupil at a point. */
export const lensCentre = (w: number): [number, number] => [w * 0.14, -w * 0.8 * 0.08];

function Face({ w, expr, ink, lensFill, pupil, open }: { w: number; expr: MascotExpression; ink: string; lensFill: string; pupil: [number, number]; open: number }) {
  const h = w * 0.8;
  const ex = -w * 0.18, ey = -h * 0.04;
  const lx = w * 0.14, ly = -h * 0.08, lr = w * 0.17;
  const big = expr === "surprised" || expr === "ouch";
  const gx = (pupil[0] - pupilFor(expr)[0]) * w * 0.07, gy = (pupil[1] - pupilFor(expr)[1]) * w * 0.07;   // the dot eye's share of the gaze
  const hx = lx + lr * 0.7, hy = ly + lr * 0.7;
  const bx = ex, by = -h * 0.22;
  const mx = -w * 0.02, my = h * 0.22;
  return (
    <g>
      {/* the dot eye (it blinks) */}
      {/* both eyes look the same way: the dot eye shifts with the lens pupil, and both blink together */}
      {expr === "laugh" || expr === "understand"
        ? <Arc cx={ex + gx} cy={ey + w * 0.02 + gy} rx={w * 0.06} ry={w * 0.05} a0={200} a1={340} w={w * 0.04} stroke={ink} />
        : big
          ? <><Oval x={ex + gx} y={ey + gy} rx={w * 0.08} ry={w * 0.08 * open} fill={lensFill} /><Oval x={ex + gx * 1.5} y={ey + gy * 1.5} rx={w * 0.05} ry={w * 0.05 * open} fill={ink} /></>
          : <Oval x={ex + gx} y={ey + gy} rx={w * 0.06} ry={w * 0.06 * open} fill={ink} />}
      {/* the lens eye: white disc, black ring, pupil, glint, handle */}
      <Disc x={lx} y={ly} r={lr} fill={lensFill} />
      <Ring x={lx} y={ly} r={lr} w={w * 0.045} stroke={ink} />
      <Oval x={lx + lr * pupil[0]} y={ly + lr * pupil[1]} rx={w * (big ? 0.055 : 0.08)} ry={w * (big ? 0.055 : 0.08) * (0.25 + 0.75 * open)} fill={ink} />
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

/** The bubble and its face, at the origin, width w. `pupil` (fractions of the lens radius) and `open` (1 = eye open) bring it to life. */
export const MascotArt: React.FC<{ w: number; expr: MascotExpression; body?: "yellow" | "black"; pupil?: [number, number]; open?: number }> =
  ({ w, expr, body = "yellow", pupil, open = 1 }) => {
    const bodyColor = body === "black" ? BLACK : YELLOW;
    const ink = body === "black" ? YELLOW : BLACK;
    return <g><Bubble w={w} body={bodyColor} /><Face w={w} expr={expr} ink={ink} lensFill={WHITE} pupil={pupil ?? pupilFor(expr)} open={open} /></g>;
  };

export const Mascot: React.FC<{
  x: number; y: number; w: number; expr: MascotExpression; t: number; sparks?: boolean; rot?: number; body?: "yellow" | "black";
  squash?: number;                                     // 0..~0.3: the pop's squash and stretch, from the entrance spring
  look?: { x: number; y: number; mix: number } | null; // the point the lens looks at (video coordinates) and how far it has turned
  bump?: number;                                       // a small swell right after the face changed
  phase?: number;                                      // desynchronises blink and drift between mascots
  clock?: number;                                      // seconds of the whole video: the idles (hover, blink, drift) run on it, so a mascot that stays across beats does not restart
}> = ({ x, y, w, expr, t, sparks, rot = 0, body = "yellow", squash = 0, look = null, bump = 0, phase = 0, clock }) => {
  const c = clock ?? t;
  const rest = pupilFor(expr);
  let pupil: [number, number] = [rest[0] + 0.07 * Math.sin(c * 0.9 + phase), rest[1] + 0.06 * Math.cos(c * 0.7 + phase)];   // it looks around a little
  if (look) {
    const [lx, ly] = lensCentre(w);
    const dx = look.x - (x + lx), dy = look.y - (y + ly), len = Math.hypot(dx, dy) || 1;
    pupil = [pupil[0] + ((dx / len) * 0.5 - pupil[0]) * look.mix, pupil[1] + ((dy / len) * 0.5 - pupil[1]) * look.mix];
  }
  const sx = (1 + squash) * (1 + 0.05 * bump), sy = (1 - squash) * (1 + 0.05 * bump);
  const sparkColor = body === "yellow" ? YELLOW_D : YELLOW;
  const sparkPhase = (t * 1.6) % 1;                    // the sparks flash in and fade, once in a while
  return (
    <g transform={`translate(${x} ${y + hover(c, w * 0.012)})`}>
      <g transform={`rotate(${rot + 1.4 * Math.sin(c * 1.3 + phase)}) scale(${sx} ${sy})`}>
        <MascotArt w={w} expr={expr} body={body} pupil={pupil} open={blinkAt(c, 3.4, phase)} />
      </g>
      {sparks && [-60, -35, -10].map((a, i) => {
        const k = Math.max(0, Math.min(1, (sparkPhase - i * 0.08) * 2.2));
        const grow = Math.sin(Math.PI * Math.min(1, k));
        const p0: [number, number] = [w * 0.58 * Math.cos((a * Math.PI) / 180), -w * 0.1 + w * 0.5 * Math.sin((a * Math.PI) / 180)];
        return <Line key={a} a={seg(p0, w * 0.04 * (1 - grow), a)} b={seg(p0, w * (0.04 + 0.08 * grow), a)} w={w * 0.035 * Math.min(1, grow * 2)} stroke={sparkColor} />;
      })}
    </g>
  );
};
