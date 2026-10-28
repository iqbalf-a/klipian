/* The fuller backgrounds (P28-A3), ported from bg_brand() and bg_lab() in workspace/channel-art/klipian-intip/make_bg_options.py.
   brand: the wall with a faint field of lens rings (drifting very slowly, so the screen is never fully still), a big yellow
   spotlight behind the main subject, and the floor. lab: the dark slate "operating room" with a grid and a soft warm glow,
   for everything seen INSIDE the lens and for the 3D test. `clock` is seconds of the video itself (the drift continues across beats). */
import React from "react";
import { FLOOR_Y, FRAME, LAB, THEMES, type ThemeName } from "../tokens.ts";

/** The theme of the video being drawn (the story's `theme`); StoryVideo provides it. Outside a story it is cream. */
export const ThemeCtx = React.createContext<ThemeName>("cream");

const W = FRAME.width, H = FRAME.height;

export const Brand: React.FC<{ clock: number; spot?: { x: number; y: number; r?: number }; theme?: ThemeName }> = ({ clock, spot, theme }) => {
  const id = `rings${React.useId().replace(/:/g, "")}`;
  const ctx = React.useContext(ThemeCtx);                                  // called every time: the hooks keep their order
  const th = THEMES[theme ?? ctx];
  const sx = spot?.x ?? W / 2, sy = spot?.y ?? 900, r = (spot?.r ?? 470) * (1 + 0.012 * Math.sin(clock * 0.8));
  const dx = (clock * 6) % 120, dy = (clock * 3.4) % 240;                  // the parallax: the field slides at a few px a second
  const pattern = th.pattern === "grid"
    ? <pattern id={id} patternUnits="userSpaceOnUse" width={120} height={120} patternTransform={`translate(${dx} ${dy})`}>
        <rect x={0} y={0} width={120} height={3} fill={th.ring} /><rect x={0} y={0} width={3} height={120} fill={th.ring} />
      </pattern>
    : th.pattern === "stripes"
      ? <pattern id={id} patternUnits="userSpaceOnUse" width={60} height={60} patternTransform={`translate(${dx} ${dy}) rotate(45)`}>
          <rect x={0} y={0} width={20} height={60} fill={th.ring} />
        </pattern>
      : <pattern id={id} patternUnits="userSpaceOnUse" width={120} height={240} patternTransform={`translate(${dx} ${dy})`}>
          <circle cx={40} cy={40} r={16} fill="none" stroke={th.ring} strokeWidth={6} />
          <circle cx={100} cy={160} r={16} fill="none" stroke={th.ring} strokeWidth={6} />
        </pattern>;
  return (
    <g>
      <rect x={0} y={0} width={W} height={H} fill={th.wall} />
      <defs>{pattern}</defs>
      <rect x={0} y={0} width={W} height={FLOOR_Y} fill={`url(#${id})`} />
      <circle cx={sx} cy={sy} r={r} fill={th.spot} />
      <circle cx={sx} cy={sy} r={r * 0.78} fill={th.spotInner} />
      <rect x={0} y={FLOOR_Y} width={W} height={H - FLOOR_Y} fill={th.floor} />
      <rect x={0} y={FLOOR_Y} width={W} height={14} fill={th.floorEdge} />
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
