/* The two transitions of the channel (B68): a WHIP (the picture slides away fast under a horizontal blur and the next shot slides in from the other side) and a BURST (paper scraps and sparks
   fly out of the middle of the frame on the cut). Both are pure functions of the story time, drawn in CSS over the three.js canvas, so they render the same in every frame. */
import React from "react";

const ease = (u: number) => u * u * (3 - 2 * u);
const rnd = (n: number) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

/** A whip at time `at` (the cut), going `dir` (+1 = the camera swings right, -1 = left): the style of the wrapper around the canvas at time t. */
export type Whip = [at: number, dir: 1 | -1];
export function whipStyle(whips: Whip[], t: number, half = 0.16, width = 1080): React.CSSProperties {
  for (const [at, dir] of whips) {
    if (t < at - half || t >= at + half) continue;
    const u = (t - (at - half)) / (2 * half), first = u < 0.5, k = first ? ease(u * 2) : 1 - ease(u * 2 - 1);
    const x = (first ? -dir : dir) * width * 0.34 * k, blur = 26 * Math.sin(Math.PI * u);
    return { transform: `translateX(${x.toFixed(1)}px) scaleX(${(1 + 0.12 * k).toFixed(3)})`, filter: `blur(${blur.toFixed(1)}px) brightness(${(1 + 0.12 * k).toFixed(3)})` };
  }
  return {};
}

export type Burst = { at: number; colors?: string[] };
const PAPER = ["#fffaf0", "#f4efdc", "#ffd447", "#cfe9f5", "#ffffff"];
/** A burst of scraps from the middle of the frame, 0.9 s long, over everything but the captions. */
export const BurstFx: React.FC<{ bursts: Burst[]; t: number; w?: number; h?: number }> = ({ bursts, t, w = 1080, h = 1920 }) => {
  const b = bursts.find((x) => t >= x.at && t < x.at + 0.9);
  if (!b) return null;
  const tau = t - b.at, fade = 1 - tau / 0.9, cols = b.colors ?? PAPER;
  return (
    <div style={{ position: "absolute", left: 0, top: 0, width: w, height: h, pointerEvents: "none", overflow: "hidden" }}>
      {Array.from({ length: 46 }, (_, i) => {
        const a = rnd(i + 1) * Math.PI * 2, sp = 520 + rnd(i + 50) * 1100, size = 12 + rnd(i + 90) * 26;
        const x = w / 2 + Math.cos(a) * sp * tau, y = h * 0.46 + Math.sin(a) * sp * tau * 0.9 + 900 * tau * tau;   // a little gravity
        return <div key={i} style={{ position: "absolute", left: x, top: y, width: size, height: size * (0.5 + rnd(i + 20) * 0.5), background: cols[i % cols.length], opacity: Math.max(0, fade), transform: `rotate(${(rnd(i + 5) * 360 + tau * (300 + rnd(i) * 500)).toFixed(0)}deg)`, borderRadius: 2 }} />;
      })}
    </div>
  );
};
