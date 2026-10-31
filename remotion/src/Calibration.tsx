/* The calibration clip (PLAN-SAFE-AREA, B24): a light grid with every line labelled by its value, to be played in each app (YouTube Shorts, TikTok, Instagram
   Reels) so the covered bands can be read off a screenshot: the lines that stay visible are inside the safe area. Horizontal lines every 50 px from y 0 to 300 and
   from y 1400 to 1900; vertical lines every 25 px from x 850 to 1080. Each value is written in large text at several places, so a covered part never hides it.
   A separate composition ("Calibration"): it draws nothing a video uses. Rendered by scripts/calibrationClip.mjs into out/safe/calibration.mp4 (6 s). */
import React from "react";
import { FONT_BOLD, FRAME } from "./tokens.ts";

const bold = { fontFamily: `"${FONT_BOLD}", sans-serif`, fontWeight: 700 } as const;
const range = (a: number, b: number, step: number) => { const out: number[] = []; for (let v = a; v <= b; v += step) out.push(v); return out; };
const HORIZ = [...range(0, 300, 50), ...range(1400, 1900, 50)];
const VERT = range(850, 1080, 25);

export const Calibration: React.FC = () => (
  <svg width={FRAME.width} height={FRAME.height} viewBox={`0 0 ${FRAME.width} ${FRAME.height}`}>
    <rect width={FRAME.width} height={FRAME.height} fill="rgb(245,245,240)" />
    {range(0, 1080, 100).map((x) => <line key={`gx${x}`} x1={x} y1={0} x2={x} y2={1920} stroke="rgb(215,215,208)" strokeWidth={2} />)}
    {range(0, 1920, 100).map((y) => <line key={`gy${y}`} x1={0} y1={y} x2={1080} y2={y} stroke="rgb(215,215,208)" strokeWidth={2} />)}
    {HORIZ.map((y) => {
      const major = y % 100 === 0;
      const ty = y === 0 ? 36 : y - 8;                                  // just above its line (the first line: just below)
      return (
        <g key={`h${y}`}>
          <line x1={0} y1={y} x2={1080} y2={y} stroke={major ? "rgb(220,40,40)" : "rgb(40,90,200)"} strokeWidth={major ? 4 : 3} />
          {[40, 380, 720].map((x) => <text key={x} x={x + (y === 0 ? 160 : 0)} y={ty} fontSize={34} fill={major ? "rgb(180,20,20)" : "rgb(20,60,160)"} style={bold}>y {y}</text>)}
        </g>
      );
    })}
    {VERT.map((x) => {
      const major = x % 50 === 0;
      return (
        <g key={`v${x}`}>
          <line x1={x} y1={0} x2={x} y2={1920} stroke={major ? "rgb(220,40,40)" : "rgb(40,90,200)"} strokeWidth={major ? 3 : 2} />
          {[420, 760, 1100, 1340].map((y) => <text key={y} transform={`translate(${x - 4} ${y}) rotate(-90)`} fontSize={22} fill={major ? "rgb(180,20,20)" : "rgb(20,60,160)"} style={bold}>x {x}</text>)}
        </g>
      );
    })}
    <text x={40} y={620} fontSize={52} fill="rgb(30,30,30)" style={bold}>klipian calibration</text>
    <text x={40} y={690} fontSize={34} fill="rgb(30,30,30)" style={bold}>screenshot this in the app's player:</text>
    <text x={40} y={738} fontSize={34} fill="rgb(30,30,30)" style={bold}>the lines still visible are the safe area</text>
    <text x={40} y={1000} fontSize={30} fill="rgb(60,60,60)" style={bold}>1080 x 1920, y from 0 to 300 and 1400 to 1900 (every 50 px),</text>
    <text x={40} y={1040} fontSize={30} fill="rgb(60,60,60)" style={bold}>x from 850 to 1080 (every 25 px)</text>
  </svg>
);
