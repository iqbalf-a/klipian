/* The layout manager's debug overlay for the Studio: the safe area, the banner zone and every box the layout used, coloured by role, with the
   things it had to move shown by their id. Switch it on with the `layoutDebug` prop of a composition (the Studio's Props panel). */
import React from "react";
import { FRAME } from "../tokens.ts";
import { ZONES, bounds, type Report, type Role } from "../layout.ts";

const COLOR: Record<Role, string> = { banner: "#3b82f6", hero: "#22c55e", mascot: "#eab308", chibi: "#f97316", text: "#ef4444", badge: "#a855f7", caption: "#06b6d4", picture: "#ec4899" };

export const LayoutDebug: React.FC<{ report: Report; hasBanner?: boolean }> = ({ report, hasBanner = true }) => {
  const b = bounds(hasBanner);
  return (
    <svg width={FRAME.width} height={FRAME.height} viewBox={`0 0 ${FRAME.width} ${FRAME.height}`} style={{ position: "absolute", left: 0, top: 0, pointerEvents: "none" }}>
      <rect x={ZONES.safe.x0} y={ZONES.safe.y0} width={ZONES.safe.x1 - ZONES.safe.x0} height={ZONES.safe.y1 - ZONES.safe.y0} fill="none" stroke="#fff" strokeWidth={3} strokeDasharray="14 10" />
      <rect x={b.x0} y={b.y0} width={b.x1 - b.x0} height={b.y1 - b.y0} fill="none" stroke="#0ff" strokeWidth={2} strokeDasharray="6 8" />
      {report.boxes.map((s) => (
        <g key={s.id}>
          <rect x={s.box.x0} y={s.box.y0} width={s.box.x1 - s.box.x0} height={s.box.y1 - s.box.y0} fill={COLOR[s.role]} fillOpacity={0.12} stroke={COLOR[s.role]} strokeWidth={4} />
          <text x={s.box.x0 + 6} y={s.box.y0 + 26} fontSize={24} fill={COLOR[s.role]} fontFamily="monospace">{s.id}{report.moved.has(s.id) ? " (moved)" : ""}</text>
        </g>
      ))}
      {report.problems.map((p, i) => <text key={i} x={70} y={160 + i * 30} fontSize={26} fill="#f00" fontFamily="monospace">{p}</text>)}
    </svg>
  );
};
