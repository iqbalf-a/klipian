/* Overlays of a camera-led explainer (P28-P, pilot "Kenapa colokan bisa panas?"): the magnifier that hovers over a part before the camera goes through
   it, the "DIPERBESAR" frame of a macro close-up, a numbered tip card, a small source chip (domains of a claim's sources), and a loop of two causes that
   feed each other. Flat, palette only, no outlines; `t` = seconds, `start` = when it begins, `end` = when it leaves (optional). */
import React from "react";
import { BLACK, FONT_BOLD, FONT_MONO, G2, RED, WHITE, YELLOW, YELLOW_D } from "../tokens.ts";
import { clamp01, easeInOut, easeOut, springAt } from "../motion.ts";
import { textWidthEstimate, type Spec } from "../layout.ts";
import { wrap } from "./Cards.tsx";

const bold = { fontFamily: `"${FONT_BOLD}", sans-serif`, fontWeight: 700 } as const;
const mono = { fontFamily: `"${FONT_MONO}", monospace`, fontWeight: 400 } as const;
/** In and out: 0 before `start`, a spring to 1, and back to 0 over 0.35 s from `end`. */
const life = (t: number, start: number, end?: number, soft = true): number => springAt(t, start, soft) * (end === undefined ? 1 : 1 - easeInOut(clamp01((t - end) / 0.35)));

/** The magnifier (the channel's lens: a black ring and a dark-yellow handle) round a point, with a "DIPERBESAR" tag. `grow` (0..1) blows the ring up
    past the edges of the frame (the dolly through it); `children` are drawn inside the circle (clipped). */
export const Magnifier: React.FC<{ x: number; y: number; r: number; t: number; start: number; grow?: number; tag?: string; children?: React.ReactNode }> = ({ x, y, r, t, start, grow = 0, tag = "DIPERBESAR", children }) => {
  const p = springAt(t, start, false);
  if (p <= 0.001) return null;
  const id = `mag-${React.useId().replace(/:/g, "")}`;
  const R = r * p * (1 + 7 * easeInOut(grow) ** 1.4), ring = Math.max(8, 16 * (1 - grow * 0.7)), h = R * 0.72;
  const fade = 1 - clamp01((grow - 0.75) / 0.25);
  return (
    <g>
      <defs><clipPath id={id}><circle cx={x} cy={y} r={R} /></clipPath></defs>
      {children && <g clipPath={`url(#${id})`}>{children}</g>}
      <g opacity={fade}>
        <circle cx={x} cy={y} r={R} fill="none" stroke={BLACK} strokeWidth={ring} />
        <line x1={x + h} y1={y + h} x2={x + h + R * 0.42} y2={y + h + R * 0.42} stroke={YELLOW_D} strokeWidth={ring * 1.5} strokeLinecap="round" />
        {tag && grow < 0.3 && (
          <g transform={`translate(${x + R * 0.62} ${y - R * 0.86})`} opacity={clamp01((t - start - 0.2) / 0.25) * (1 - grow / 0.3)}>
            <rect x={0} y={-24} width={textWidthEstimate(tag, 26) * 0.92 + 34} height={48} rx={10} fill={YELLOW} />
            <text x={17} y={9} fontSize={26} fill={BLACK} letterSpacing={2} style={mono}>{tag}</text>
          </g>
        )}
      </g>
    </g>
  );
};

/** The frame of a macro close-up: four corner brackets round a box and a "DIPERBESAR" tag at its top-left corner. */
export const MacroFrame: React.FC<{ box: { x0: number; y0: number; x1: number; y1: number }; t: number; start: number; end?: number; tag?: string; onDark?: boolean }> = ({ box, t, start, end, tag = "DIPERBESAR", onDark = true }) => {
  const p = life(t, start, end);
  if (p <= 0.001) return null;
  const ink = onDark ? WHITE : BLACK, k = 54, w = 7, inset = (1 - p) * 40;
  const b = { x0: box.x0 + inset, y0: box.y0 + inset, x1: box.x1 - inset, y1: box.y1 - inset };
  const corner = (x: number, y: number, sx: number, sy: number) => <path d={`M ${x} ${y + sy * k} L ${x} ${y} L ${x + sx * k} ${y}`} fill="none" stroke={ink} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" />;
  return (
    <g opacity={Math.min(1, p * 1.5)}>
      {corner(b.x0, b.y0, 1, 1)}{corner(b.x1, b.y0, -1, 1)}{corner(b.x0, b.y1, 1, -1)}{corner(b.x1, b.y1, -1, -1)}
      <rect x={b.x0 + 18} y={b.y0 + 18} width={textWidthEstimate(tag, 26) * 0.92 + 34} height={46} rx={10} fill={YELLOW} />
      <text x={b.x0 + 35} y={b.y0 + 50} fontSize={26} fill={BLACK} letterSpacing={2} style={mono}>{tag}</text>
    </g>
  );
};

/** The height of a tip card (for the layout manager). */
export const tipCardHeight = (title: string, sub: string | undefined, w: number, chip?: string): number =>
  48 + wrap(title, 58, w - 170).length * 66 + (sub ? wrap(sub, 40, w - 170).length * 50 + 8 : 0) + (chip ? 46 : 0) + 30;
export const tipCardSpec = (id: string, x: number, y: number, w: number, title: string, sub?: string, chip?: string): Spec =>
  ({ id, role: "picture", box: { x0: x, y0: y, x1: x + w, y1: y + tipCardHeight(title, sub, w, chip) } });

/** A numbered tip: a yellow number disc, the tip in bold (keyword in dark yellow), a line under it that comes in later (`subAt`), a source chip at the bottom. */
export const TipCard: React.FC<{ x: number; y: number; w?: number; n: number | string; title: string; sub?: string; chip?: string; keyword?: string; t: number; start: number; subAt?: number; end?: number }> = ({ x, y, w = 880, n, title, sub, chip, keyword, t, start, subAt, end }) => {
  const p = life(t, start, end, false);
  if (p <= 0.001) return null;
  const lines = wrap(title, 58, w - 170), subs = sub ? wrap(sub, 40, w - 170) : [], h = tipCardHeight(title, sub, w, chip);
  const subP = clamp01((t - (subAt ?? start + 0.5)) / 0.35);
  const key = (keyword ?? "").toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
  return (
    <g transform={`translate(${x} ${y + (1 - p) * 30})`} opacity={clamp01(p * 2)}>
      <rect width={w} height={h} rx={28} fill={WHITE} />
      <circle cx={74} cy={74} r={44 * (0.6 + 0.4 * p)} fill={YELLOW} />
      <text x={74} y={74} fontSize={54} fill={BLACK} textAnchor="middle" dominantBaseline="central" style={bold}>{n}</text>
      {lines.map((ln, i) => (
        <text key={i} x={140} y={92 + i * 66} fontSize={58} fill={BLACK} style={bold}>
          {ln.split(" ").map((wd, j) => <tspan key={j} fill={key && wd.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "") === key ? YELLOW_D : BLACK}>{(j ? " " : "") + wd}</tspan>)}
        </text>
      ))}
      {subs.map((ln, i) => <text key={i} x={140} y={92 + lines.length * 66 + 4 + i * 50} fontSize={40} fill={G2} opacity={subP} style={bold}>{ln}</text>)}
      {chip && <text x={140} y={h - 30} fontSize={22} fill={G2} opacity={subP} style={mono}>{chip}</text>}
    </g>
  );
};

/** A small line naming where a claim comes from: "SUMBER" and the domains of its sources (mono), on a dark or light backing. (x, y) = its left middle. */
export const SourceChip: React.FC<{ x: number; y: number; text: string; t: number; start: number; end?: number; onDark?: boolean; align?: "start" | "middle" }> = ({ x, y, text, t, start, end, onDark, align = "start" }) => {
  const p = life(t, start, end);
  if (p <= 0.001) return null;
  const label = "SUMBER", fs = 24, w = (textWidthEstimate(`${label}  ${text}`, fs) * 0.95) + 40, x0 = align === "middle" ? x - w / 2 : x;
  return (
    <g opacity={clamp01(p * 2)} transform={`translate(${x0} ${y + (1 - p) * 10})`}>
      <rect x={0} y={-24} width={w} height={48} rx={24} fill={onDark ? BLACK : WHITE} opacity={onDark ? 0.75 : 0.92} />
      <text x={20} y={8} fontSize={fs} style={mono}><tspan fill={onDark ? YELLOW : YELLOW_D}>{label}</tspan><tspan fill={onDark ? WHITE : G2}>{`  ${text}`}</tspan></text>
    </g>
  );
};
export const sourceChipSpec = (id: string, x: number, y: number, text: string): Spec => {
  const w = textWidthEstimate(`SUMBER  ${text}`, 24) * 0.95 + 40;
  return { id, role: "text", box: { x0: x, y0: y - 24, x1: x + w, y1: y + 24 } };
};

/** Two causes that feed each other: a ring of two red arrows chasing round (cx, cy) and the two words on pills, each with an up arrow ("panas ↑").
    `draw` grows the ring in; the ring turns with time so the loop reads as going on. */
export const LoopArrows: React.FC<{ cx: number; cy: number; r: number; a: string; b: string; t: number; start: number; end?: number; onDark?: boolean }> = ({ cx, cy, r, a, b, t, start, end, onDark = true }) => {
  const p = life(t, start, end);
  if (p <= 0.001) return null;
  const draw = easeOut(clamp01((t - start) / 0.8)), spin = (t - start) * 50;
  const arc = (from: number, to: number) => {
    const k = (deg: number) => [cx + r * Math.cos((deg * Math.PI) / 180), cy + r * Math.sin((deg * Math.PI) / 180)] as const;
    const end2 = from + (to - from) * draw, [x0, y0] = k(from), [x1, y1] = k(end2);
    const tip = (end2 * Math.PI) / 180, tx = -Math.sin(tip), ty = Math.cos(tip), hl = 34;
    return (
      <g>
        <path d={`M ${x0} ${y0} A ${r} ${r} 0 0 1 ${x1} ${y1}`} fill="none" stroke={RED} strokeWidth={14} strokeLinecap="round" />
        {draw > 0.2 && <polygon points={`${x1 + tx * hl},${y1 + ty * hl} ${x1 - ty * hl * 0.6},${y1 + tx * hl * 0.6} ${x1 + ty * hl * 0.6},${y1 - tx * hl * 0.6}`} fill={RED} />}
      </g>
    );
  };
  const pill = (text: string, x: number, y: number, delay: number) => {
    const q = springAt(t, start + delay, false), fs = 48, w = textWidthEstimate(`${text} ↑`, fs) + fs * 1.1, h = fs * 1.5;
    return (
      <g transform={`translate(${x} ${y}) scale(${Math.max(0, q)})`}>
        <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={h / 2} fill={onDark ? WHITE : BLACK} />
        <text x={0} y={fs * 0.36} fontSize={fs} textAnchor="middle" style={bold}><tspan fill={onDark ? BLACK : WHITE}>{text} </tspan><tspan fill={RED}>↑</tspan></text>
      </g>
    );
  };
  return (
    <g opacity={clamp01(p * 2)}>
      <g transform={`rotate(${spin} ${cx} ${cy})`}>{arc(-70, 70)}{arc(110, 250)}</g>
      {pill(a, cx, cy - r, 0.15)}
      {pill(b, cx, cy + r, 0.45)}
    </g>
  );
};
/** The box of a LoopArrows (its ring and both pills), for the layout manager. */
export const loopSpec = (id: string, cx: number, cy: number, r: number, a: string, b: string): Spec => {
  const w = Math.max(textWidthEstimate(`${a} ↑`, 48), textWidthEstimate(`${b} ↑`, 48)) + 53;
  return { id, role: "picture", box: { x0: cx - Math.max(r + 24, w / 2), y0: cy - r - 36, x1: cx + Math.max(r + 24, w / 2), y1: cy + r + 36 } };
};
