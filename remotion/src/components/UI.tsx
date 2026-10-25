/* The screen furniture: backgrounds Room and Black, and the text pieces Banner, Pill and Label (Outfit Bold). Sizes are in
   video units; the sheet's 280-unit panel is 1080 wide, so a 20-unit banner text on the sheet is fs = 77 here.
   Text appears word by word (each word springs up), and the keywords the story names turn yellow. */
import React from "react";
import { BLACK, FLOOR, FONT_BOLD, FRAME, RED, SHEET_TO_VIDEO as K, WALL, WHITE, YELLOW, YELLOW_D } from "../tokens.ts";
import { isKeyword, springAt, wordIn } from "../motion.ts";

export const Room: React.FC = () => (
  <g>
    <rect x={0} y={0} width={FRAME.width} height={FRAME.height} fill={WALL} />
    <rect x={0} y={FRAME.height - 90 * K} width={FRAME.width} height={90 * K} fill={FLOOR} />
  </g>
);

export const Black: React.FC = () => <rect x={0} y={0} width={FRAME.width} height={FRAME.height} fill={BLACK} />;

/** The width of a text in the loaded font (browser canvas): the Pill's size follows its text, as on the sheet. */
let canvas: CanvasRenderingContext2D | null = null;
export function textWidth(text: string, fs: number): number {
  if (typeof document === "undefined") return text.length * fs * 0.55;
  canvas = canvas ?? document.createElement("canvas").getContext("2d");
  if (!canvas) return text.length * fs * 0.55;
  canvas.font = `700 ${fs}px "${FONT_BOLD}", sans-serif`;
  return canvas.measureText(text).width;
}

const textStyle = { fontFamily: `"${FONT_BOLD}", sans-serif`, fontWeight: 700 } as const;

/** One line of text whose words come in one by one. (x, y) is the middle (or the start, with align "start") of the line's
    vertical centre; `lineY` shifts later lines. `fill`/`keyFill` are the normal and the keyword colour. */
const Words: React.FC<{
  text: string; x: number; y: number; fs: number; align: "start" | "middle"; fill: string; keyFill: string;
  keywords?: readonly string[]; t: number; start: number; firstIndex?: number;
}> = ({ text, x, y, fs, align, fill, keyFill, keywords, t, start, firstIndex = 0 }) => {
  const words = text.split(/\s+/).filter(Boolean);
  // Each word sits at the measured width of everything before it (so kerning and spaces are the font's own), and the whole
  // line is centred on its full measured width.
  const total = textWidth(words.join(" "), fs);
  const startX = align === "middle" ? x - total / 2 : x;
  const xs = words.map((_, i) => startX + (i === 0 ? 0 : textWidth(words.slice(0, i).join(" ") + " ", fs)));
  return (
    <g>
      {words.map((w, i) => {
        const wx = xs[i];
        const p = wordIn(t, start, firstIndex + i);
        return (
          <text key={i} x={wx} y={y + (1 - Math.min(1, p)) * fs * 0.45} fontSize={fs} fill={isKeyword(w, keywords) ? keyFill : fill}
            opacity={Math.max(0, Math.min(1, p * 2.2))} textAnchor="start" dominantBaseline="central" style={textStyle}>{w}</text>
        );
      })}
    </g>
  );
};

/** The black bar with white text near the top of a scene (it slides in as an item; its words follow). */
export const Banner: React.FC<{ text: string; fs?: number; y?: number; t: number; start: number; highlight?: readonly string[] }> =
  ({ text, fs = 20 * K, y = 22 * K, t, start, highlight }) => {
    const h = fs * 2.6;
    return (
      <g>
        <rect x={16 * K} y={y} width={FRAME.width - 32 * K} height={h} rx={10 * K} ry={10 * K} fill={BLACK} />
        <Words text={text} x={FRAME.width / 2} y={y + h / 2} fs={fs} align="middle" fill={WHITE} keyFill={YELLOW} keywords={highlight} t={t} start={start + 0.12} />
      </g>
    );
  };

/** The yellow pill ("Intip yuk!"): its width follows its text. (x, y) is its centre. It pops in as an item. */
export const Pill: React.FC<{ text: string; x: number; y: number; fs: number; t: number; start: number; highlight?: readonly string[] }> =
  ({ text, x, y, fs, t, start, highlight }) => {
    const w = textWidth(text, fs) + fs * 1.2, h = fs * 1.56;
    return (
      <g transform={`translate(${x} ${y})`}>
        <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={h / 2} ry={h / 2} fill={YELLOW} />
        <Words text={text} x={0} y={0} fs={fs} align="middle" fill={BLACK} keyFill={RED} keywords={highlight} t={t} start={start + 0.1} />
      </g>
    );
  };

/** A short label (black, red for heat or danger, white on dark). Keywords turn dark yellow on light, yellow on dark. */
export const Label: React.FC<{
  text: string; x: number; y: number; fs: number; color?: "black" | "red" | "white"; align?: "start" | "middle"; lines?: string[];
  t: number; start: number; highlight?: readonly string[];
}> = ({ text, x, y, fs, color = "black", align = "middle", lines = [], t, start, highlight }) => {
  const fill = color === "red" ? RED : color === "white" ? WHITE : BLACK;
  const keyFill = color === "white" ? YELLOW : YELLOW_D;
  let index = 0;
  return (
    <g>
      {[text, ...lines].map((ln, i) => {
        const first = index;
        index += ln.split(/\s+/).filter(Boolean).length;
        return <Words key={i} text={ln} x={x} y={y + i * fs * 1.22} fs={fs} align={align} fill={fill} keyFill={keyFill} keywords={highlight} t={t} start={start} firstIndex={first} />;
      })}
    </g>
  );
};

export { springAt };
