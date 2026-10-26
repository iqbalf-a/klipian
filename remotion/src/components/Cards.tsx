/* Source and data cards, pointer labels and onomatopoeia (P28-P): what a voiced explainer puts on the screen to show where a fact comes from and what
   a number is. Flat, in the house palette, no outlines, each one entering element by element (`t` = seconds into the beat, `start` = when it begins).
   (x, y) is the top-left of a card unless the name says centre; sizes are in video pixels. Describe a card to the layout manager with cardSpec(). */
import React from "react";
import { evolvePath } from "@remotion/paths";
import { BLACK, FONT_BOLD, FONT_MONO, G2, G3, G4, RED, WHITE, YELLOW, YELLOW_D } from "../tokens.ts";
import { easeOut, springAt } from "../motion.ts";
import { textWidthEstimate, type Spec } from "../layout.ts";

const bold = { fontFamily: `"${FONT_BOLD}", sans-serif`, fontWeight: 700 } as const;
const mono = { fontFamily: `"${FONT_MONO}", monospace`, fontWeight: 400 } as const;
const clamp = (x: number) => Math.max(0, Math.min(1, x));
const ramp = (t: number, from: number, dur = 0.5) => easeOut(clamp((t - from) / dur));

/** A card as a fixed zone for the layout manager. */
export const cardSpec = (id: string, x: number, y: number, w: number, h: number): Spec => ({ id, role: "hero", box: { x0: x, y0: y, x1: x + w, y1: y + h } });

/** Words broken into lines of at most `width` px at font size `fs`. */
export function wrap(text: string, fs: number, width: number): string[] {
  const lines: string[] = [];
  let cur = "";
  for (const w of text.split(/\s+/).filter(Boolean)) {
    if (cur && textWidthEstimate(`${cur} ${w}`, fs) > width) { lines.push(cur); cur = w; } else cur = cur ? `${cur} ${w}` : w;
  }
  if (cur) lines.push(cur);
  return lines;
}

const Frame: React.FC<{ x: number; y: number; w: number; h: number; t: number; start: number; fill?: string; children: React.ReactNode }> = ({ x, y, w, h, t, start, fill = WHITE, children }) => {
  const p = springAt(t, start, true);
  return (
    <g transform={`translate(${x + w / 2} ${y + h / 2}) scale(${0.9 + 0.1 * p}) translate(${-w / 2} ${-h / 2})`} opacity={Math.min(1, p * 2.2)}>
      <rect width={w} height={h} rx={26} fill={fill} />
      {children}
    </g>
  );
};

/** A quote from a source: the domain and date on top (mono), the quote, then who said it. The quote's words come in line by line. */
export const SourceCard: React.FC<{ x: number; y: number; w?: number; quote: string; org: string; domain: string; date?: string; t: number; start: number }> = ({ x, y, w = 760, quote, org, domain, date, t, start }) => {
  const fs = 38, lines = wrap(`“${quote}”`, fs, w - 80), h = 150 + lines.length * fs * 1.28;
  return (
    <Frame x={x} y={y} w={w} h={h} t={t} start={start}>
      <rect x={0} y={26} width={10} height={h - 52} rx={5} fill={YELLOW} />
      <text x={40} y={52} fontSize={22} fill={G2} style={mono}>{domain}{date ? `  ·  ${date}` : ""}</text>
      {lines.map((ln, i) => <text key={i} x={40} y={108 + i * fs * 1.28} fontSize={fs} fill={BLACK} opacity={ramp(t, start + 0.25 + i * 0.18)} style={bold}>{ln}</text>)}
      <text x={40} y={h - 32} fontSize={26} fill={YELLOW_D} opacity={ramp(t, start + 0.4 + lines.length * 0.18)} style={bold}>{org}</text>
    </Frame>
  );
};

/** A search: the query is typed word by word in the bar, then the results come in one after another. */
export const SearchCard: React.FC<{ x: number; y: number; w?: number; query: string; results: { title: string; domain: string }[]; t: number; start: number }> = ({ x, y, w = 760, query, results, t, start }) => {
  const words = query.split(/\s+/), shown = words.filter((_, i) => t >= start + 0.3 + i * 0.22).join(" "), h = 150 + results.length * 112;
  return (
    <Frame x={x} y={y} w={w} h={h} t={t} start={start}>
      <rect x={28} y={28} width={w - 56} height={80} rx={40} fill={G4} />
      <circle cx={72} cy={68} r={13} fill="none" stroke={G2} strokeWidth={5} /><line x1={82} y1={78} x2={96} y2={92} stroke={G2} strokeWidth={5} strokeLinecap="round" />
      <text x={120} y={80} fontSize={34} fill={BLACK} style={bold}>{shown}{shown !== query && Math.floor(t * 3) % 2 === 0 ? "│" : ""}</text>
      {results.map((r, i) => (
        <g key={i} opacity={ramp(t, start + 0.4 + words.length * 0.22 + i * 0.25)} transform={`translate(0 ${(1 - ramp(t, start + 0.4 + words.length * 0.22 + i * 0.25)) * 12})`}>
          <text x={44} y={160 + i * 112} fontSize={22} fill={G2} style={mono}>{r.domain}</text>
          <text x={44} y={202 + i * 112} fontSize={32} fill={BLACK} style={bold}>{r.title}</text>
        </g>
      ))}
    </Frame>
  );
};

/** A number with its label (and a note), counting up from `from` to `value` when `count` is set. */
export const NumberCard: React.FC<{ x: number; y: number; w?: number; label: string; value: number; unit?: string; note?: string; from?: number; count?: boolean; decimals?: number; t: number; start: number; accent?: "yellow" | "red" }> = ({ x, y, w = 520, label, value, unit = "", note, from = 0, count = true, decimals = 0, t, start, accent = "yellow" }) => {
  const shown = count ? from + (value - from) * ramp(t, start + 0.25, 1.1) : value;
  const text = `${shown.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).replace(/,/g, ".")}`, h = note ? 280 : 230;
  return (
    <Frame x={x} y={y} w={w} h={h} t={t} start={start}>
      <text x={36} y={58} fontSize={26} fill={G2} style={mono}>{label.toUpperCase()}</text>
      <text x={36} y={170} fontSize={112} fill={accent === "red" ? RED : BLACK} style={bold}>{text}<tspan fontSize={52} fill={accent === "red" ? RED : YELLOW_D}> {unit}</tspan></text>
      {note && <text x={36} y={236} fontSize={28} fill={G2} opacity={ramp(t, start + 0.6)} style={bold}>{note}</text>}
    </Frame>
  );
};

/** Bars that grow one after another; the tallest is `max` (or the largest value). */
export const BarChart: React.FC<{ x: number; y: number; w?: number; h?: number; bars: { label: string; value: number; hot?: boolean }[]; max?: number; unit?: string; title?: string; t: number; start: number }> = ({ x, y, w = 760, h = 520, bars, max, unit = "", title, t, start }) => {
  const top = Math.max(...bars.map((b) => b.value)), cap = max ?? top, plot = h - (title ? 190 : 140), gap = 24, bw = (w - 80 - gap * (bars.length - 1)) / bars.length;
  return (
    <Frame x={x} y={y} w={w} h={h} t={t} start={start}>
      {title && <text x={36} y={56} fontSize={26} fill={G2} style={mono}>{title.toUpperCase()}</text>}
      {bars.map((b, i) => {
        const p = ramp(t, start + 0.3 + i * 0.22, 0.7), bh = (b.value / cap) * plot * p, bx = 40 + i * (bw + gap), by = h - 90 - bh;
        return (
          <g key={i}>
            <rect x={bx} y={by} width={bw} height={bh} rx={12} fill={b.hot ? RED : YELLOW} />
            <text x={bx + bw / 2} y={by - 14} fontSize={30} fill={BLACK} textAnchor="middle" opacity={p} style={bold}>{Math.round(b.value * p)}{unit}</text>
            <text x={bx + bw / 2} y={h - 40} fontSize={24} fill={G2} textAnchor="middle" style={mono}>{b.label}</text>
          </g>
        );
      })}
    </Frame>
  );
};

/** A line that draws itself across the points (y values), with a dot on the last one. */
export const LineChart: React.FC<{ x: number; y: number; w?: number; h?: number; points: number[]; labels?: [string, string]; title?: string; hot?: boolean; t: number; start: number }> = ({ x, y, w = 760, h = 460, points, labels, title, hot, t, start }) => {
  const lo = Math.min(...points), hi = Math.max(...points), px = (i: number) => 50 + (i / (points.length - 1)) * (w - 100), py = (v: number) => h - 90 - ((v - lo) / (hi - lo || 1)) * (h - 190);
  const d = `M ${points.map((v, i) => `${px(i)} ${py(v)}`).join(" L ")}`, draw = evolvePath(ramp(t, start + 0.3, 1.2), d), last = points.length - 1;
  return (
    <Frame x={x} y={y} w={w} h={h} t={t} start={start}>
      {title && <text x={36} y={56} fontSize={26} fill={G2} style={mono}>{title.toUpperCase()}</text>}
      <line x1={40} y1={h - 80} x2={w - 40} y2={h - 80} stroke={G3} strokeWidth={3} />
      <path d={d} fill="none" stroke={hot ? RED : BLACK} strokeWidth={9} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={draw.strokeDasharray} strokeDashoffset={draw.strokeDashoffset} />
      <circle cx={px(last)} cy={py(points[last])} r={14} fill={hot ? RED : YELLOW} opacity={ramp(t, start + 1.4, 0.3)} />
      {labels && <><text x={40} y={h - 36} fontSize={24} fill={G2} style={mono}>{labels[0]}</text><text x={w - 40} y={h - 36} fontSize={24} fill={G2} textAnchor="end" style={mono}>{labels[1]}</text></>}
    </Frame>
  );
};

/** A month: the days in a grid, the highlighted ones circled in yellow one after another. */
export const CalendarCard: React.FC<{ x: number; y: number; w?: number; month: string; days?: number; startDay?: number; highlight: number[]; t: number; start: number }> = ({ x, y, w = 640, month, days = 30, startDay = 0, highlight, t, start }) => {
  const cell = (w - 60) / 7, rows = Math.ceil((days + startDay) / 7), h = 150 + rows * cell;
  return (
    <Frame x={x} y={y} w={w} h={h} t={t} start={start}>
      <text x={36} y={64} fontSize={34} fill={BLACK} style={bold}>{month}</text>
      {["S", "S", "R", "K", "J", "S", "M"].map((d, i) => <text key={i} x={30 + cell * (i + 0.5)} y={116} fontSize={22} fill={G2} textAnchor="middle" style={mono}>{d}</text>)}
      {Array.from({ length: days }, (_, k) => {
        const i = k + startDay, cx = 30 + cell * ((i % 7) + 0.5), cy = 150 + cell * (Math.floor(i / 7) + 0.5), hi = highlight.indexOf(k + 1), p = hi >= 0 ? ramp(t, start + 0.5 + hi * 0.25, 0.4) : 0;
        return (
          <g key={k}>
            {hi >= 0 && <circle cx={cx} cy={cy} r={cell * 0.42 * p} fill={YELLOW} />}
            <text x={cx} y={cy + 10} fontSize={28} fill={BLACK} textAnchor="middle" style={bold}>{k + 1}</text>
          </g>
        );
      })}
    </Frame>
  );
};

/** A small pill with a leader line to a point on an object (a 2D spot or the screen position of a 3D part: use projectToScreen). `magnify` rings the
    point with a small lens. The pill sits at (x, y) (its centre); the line is drawn from it to (ax, ay). */
export const PointerLabel: React.FC<{ text: string; x: number; y: number; ax: number; ay: number; fs?: number; magnify?: boolean; red?: boolean; t: number; start: number }> = ({ text, x, y, ax, ay, fs = 34, magnify, red, t, start }) => {
  const p = springAt(t, start, true), line = ramp(t, start + 0.1, 0.35), w = textWidthEstimate(text, fs) + fs * 1.1, h = fs * 1.5;
  const ex = ax + (x - ax) * (1 - line), ey = ay + (y - ay) * (1 - line);
  return (
    <g opacity={Math.min(1, p * 2)}>
      <line x1={x} y1={y} x2={ex} y2={ey} stroke={red ? RED : BLACK} strokeWidth={5} strokeLinecap="round" />
      {magnify ? <circle cx={ax} cy={ay} r={34 * p} fill="none" stroke={red ? RED : BLACK} strokeWidth={6} /> : <circle cx={ax} cy={ay} r={11 * p} fill={red ? RED : BLACK} />}
      <g transform={`translate(${x} ${y}) scale(${0.85 + 0.15 * p})`}>
        <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={h / 2} fill={red ? RED : YELLOW} />
        <text x={0} y={fs * 0.36} fontSize={fs} fill={red ? WHITE : BLACK} textAnchor="middle" style={bold}>{text}</text>
      </g>
    </g>
  );
};
export const pointerBox = (text: string, x: number, y: number, fs = 34): Spec => { const w = textWidthEstimate(text, fs) + fs * 1.1, h = fs * 1.5; return { id: `pointer:${text}`, role: "text", box: { x0: x - w / 2, y0: y - h / 2, x1: x + w / 2, y1: y + h / 2 } }; };

/** A sound written out ("PLOK!", "OFF"): big, bold, tilted, on a yellow burst; it pops in with a little overshoot and settles. */
export const Onomatopoeia: React.FC<{ text: string; x: number; y: number; fs?: number; rot?: number; red?: boolean; t: number; start: number }> = ({ text, x, y, fs = 96, rot = -8, red, t, start }) => {
  const p = springAt(t, start, false), w = textWidthEstimate(text, fs), r = Math.max(w, fs * 1.4) * 0.62;
  const burst = Array.from({ length: 16 }, (_, i) => { const a = (i / 16) * Math.PI * 2, rr = i % 2 ? r * 0.82 : r * 1.1; return `${Math.cos(a) * rr * 1.15},${Math.sin(a) * rr * 0.72}`; }).join(" ");
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot}) scale(${p})`} opacity={Math.min(1, p * 3)}>
      <polygon points={burst} fill={red ? RED : YELLOW} />
      <text x={0} y={fs * 0.34} fontSize={fs} fill={red ? WHITE : BLACK} textAnchor="middle" style={bold}>{text}</text>
    </g>
  );
};
