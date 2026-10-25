/* The screen furniture: backgrounds Room and Black, and the text pieces Banner, Pill and Label (Outfit Bold). Sizes are in
   video units; the sheet's 280-unit panel is 1080 wide, so a 20-unit banner text on the sheet is fs = 77 here. */
import React from "react";
import { BLACK, FLOOR, FONT_BOLD, FRAME, RED, SHEET_TO_VIDEO as K, WALL, WHITE, YELLOW } from "../tokens.ts";
import { easeOutBack } from "../stopmotion.ts";

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

/** The black bar with white text near the top of a scene. It drops in over the first 0.3 s. */
export const Banner: React.FC<{ text: string; fs?: number; y?: number; t: number }> = ({ text, fs = 20 * K, y = 22 * K, t }) => {
  const h = fs * 2.6;
  const drop = (1 - Math.min(1, easeOutBack(t / 0.3))) * -60;
  return (
    <g transform={`translate(0 ${drop})`}>
      <rect x={16 * K} y={y} width={FRAME.width - 32 * K} height={h} rx={10 * K} ry={10 * K} fill={BLACK} />
      <text x={FRAME.width / 2} y={y + h / 2} fontSize={fs} fill={WHITE} textAnchor="middle" dominantBaseline="central" style={textStyle}>{text}</text>
    </g>
  );
};

/** The yellow pill ("Intip yuk!"): its width follows its text. (x, y) is its centre. */
export const Pill: React.FC<{ text: string; x: number; y: number; fs: number; t: number }> = ({ text, x, y, fs, t }) => {
  const w = textWidth(text, fs) + fs * 1.2, h = fs * 1.56;
  const grow = Math.min(1.0, Math.max(0, easeOutBack((t - 0.3) / 0.25)));
  return (
    <g transform={`translate(${x} ${y}) scale(${grow})`}>
      <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={h / 2} ry={h / 2} fill={YELLOW} />
      <text x={0} y={0} fontSize={fs} fill={BLACK} textAnchor="middle" dominantBaseline="central" style={textStyle}>{text}</text>
    </g>
  );
};

/** A short label (black, red for heat or danger, white on dark). */
export const Label: React.FC<{ text: string; x: number; y: number; fs: number; color?: "black" | "red" | "white"; align?: "start" | "middle"; lines?: string[] }> =
  ({ text, x, y, fs, color = "black", align = "middle", lines = [] }) => {
    const fill = color === "red" ? RED : color === "white" ? WHITE : BLACK;
    return (
      <text x={x} y={y} fontSize={fs} fill={fill} textAnchor={align} dominantBaseline="central" style={textStyle}>
        <tspan x={x}>{text}</tspan>
        {lines.map((ln, i) => <tspan key={i} x={x} dy={fs * 1.22}>{ln}</tspan>)}
      </text>
    );
  };
