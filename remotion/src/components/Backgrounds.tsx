/* The fuller backgrounds (P28-A3), ported from bg_brand() and bg_lab() in workspace/channel-art/klipian-intip/make_bg_options.py.
   brand: the wall with a faint field of lens rings (drifting very slowly, so the screen is never fully still), a big yellow
   spotlight behind the main subject, and the floor. lab: the dark slate "operating room" with a grid and a soft warm glow,
   for everything seen INSIDE the lens and for the 3D test. `clock` is seconds of the video itself (the drift continues across beats). */
import React from "react";
import { BRAND, FLOOR, FLOOR_Y, FRAME, LAB, WALL } from "../tokens.ts";

const W = FRAME.width, H = FRAME.height;

export const Brand: React.FC<{ clock: number; spot?: { x: number; y: number; r?: number } }> = ({ clock, spot }) => {
  const id = `rings${React.useId().replace(/:/g, "")}`;
  const sx = spot?.x ?? W / 2, sy = spot?.y ?? 900, r = (spot?.r ?? 470) * (1 + 0.012 * Math.sin(clock * 0.8));
  const dx = (clock * 6) % 120, dy = (clock * 3.4) % 240;                  // the parallax: the field slides at a few px a second
  return (
    <g>
      <rect x={0} y={0} width={W} height={H} fill={WALL} />
      <defs>
        <pattern id={id} patternUnits="userSpaceOnUse" width={120} height={240} patternTransform={`translate(${dx} ${dy})`}>
          <circle cx={40} cy={40} r={16} fill="none" stroke={BRAND.ring} strokeWidth={6} />
          <circle cx={100} cy={160} r={16} fill="none" stroke={BRAND.ring} strokeWidth={6} />
        </pattern>
      </defs>
      <rect x={0} y={0} width={W} height={FLOOR_Y} fill={`url(#${id})`} />
      <circle cx={sx} cy={sy} r={r} fill={BRAND.spot} />
      <circle cx={sx} cy={sy} r={r * 0.78} fill={BRAND.spotInner} />
      <rect x={0} y={FLOOR_Y} width={W} height={H - FLOOR_Y} fill={FLOOR} />
      <rect x={0} y={FLOOR_Y} width={W} height={14} fill={BRAND.floorEdge} />
    </g>
  );
};

export const Lab: React.FC<{ clock: number }> = ({ clock }) => {
  const id = `grid${React.useId().replace(/:/g, "")}`;
  const dx = (clock * 4) % 240, dy = (clock * 2.4) % 240;
  const fine = [60, 120, 180];
  return (
    <g>
      <rect x={0} y={0} width={W} height={H} fill={LAB.slate} />
      <circle cx={540} cy={900} r={520} fill={LAB.glow} />
      <circle cx={540} cy={900} r={360} fill={LAB.glowInner} />
      <defs>
        <pattern id={id} patternUnits="userSpaceOnUse" width={240} height={240} patternTransform={`translate(${dx} ${dy})`}>
          {fine.map((v) => <React.Fragment key={v}>
            <rect x={v - 1} y={0} width={2} height={240} fill={LAB.grid} opacity={0.75} />
            <rect x={0} y={v - 1} width={240} height={2} fill={LAB.grid} opacity={0.75} />
          </React.Fragment>)}
          <rect x={0} y={0} width={3} height={240} fill={LAB.gridMajor} />
          <rect x={0} y={0} width={240} height={3} fill={LAB.gridMajor} />
        </pattern>
      </defs>
      <rect x={0} y={0} width={W} height={H} fill={`url(#${id})`} />
    </g>
  );
};
