/* The "lensa intip": the mascot's lens opens a circle. Inside the circle the CUTAWAY shows, outside the outside view stays
   (drawn by the scene before this). A black ring and a dark-yellow handle. A port of p3() in make_storyboard.py, with the
   circle animated: a clipPath whose radius grows (with a small overshoot).
   (x, y) is the centre of the circle, r its full radius in video units; the sheet's lens is r = 92 with the cutaway
   centred 30 units to the left of the centre. */
import React from "react";
import { BLACK, YELLOW_D } from "../tokens.ts";
import { Line, Ring } from "./svg.tsx";
import { Cutaway, SOCKET_BOX } from "./Socket.tsx";
import { easeOutBack } from "../motion.ts";

const SHEET_R = 92;

export const LensReveal: React.FC<{
  id?: string; x: number; y: number; r: number; variant: "tight" | "loose"; heat?: number; t: number; revealFrom?: number; revealDur?: number;
}> = ({ x, y, r, variant, heat, t, revealFrom = 0.3, revealDur = 0.8 }) => {
  const clip = `lens-clip-${React.useId().replace(/:/g, "")}`;     // unique: two scenes are on screen during a transition
  const q = r / SHEET_R;                                          // video units per sheet unit
  const p = Math.max(0, easeOutBack((t - revealFrom) / revealDur));
  const now = r * p;
  if (now < 1) return null;
  const h = 0.72 * now;
  return (
    <g transform={`translate(${x} ${y})`}>
      <defs><clipPath id={clip}><circle cx={0} cy={0} r={now} /></clipPath></defs>
      <g clipPath={`url(#${clip})`}>
        <g transform={`translate(${-30 * q} 0) scale(${q}) translate(${-SOCKET_BOX.w / 2} ${-SOCKET_BOX.h / 2})`}>
          <Cutaway loose={variant === "loose"} heat={heat ?? 1} t={t} />
        </g>
      </g>
      <Ring x={0} y={0} r={now} w={12 * q * p} stroke={BLACK} />
      <Line a={[h, h]} b={[h + 46 * q * p, h + 46 * q * p]} w={16 * q * p} stroke={YELLOW_D} />
    </g>
  );
};
