/* The five stage shapes side by side (PLAN-VARIETY stage 3): the contact sheet of the registry in src/stageShapes.ts. Rendered as stills into
   out/stages/ with scripts/frames.mjs (composition "StageDemo"). It draws nothing a video uses. */
import React from "react";
import { Polys } from "./components/Iso.tsx";
import { FRAME, ISO, WALL } from "./tokens.ts";
import { STAGE_SHAPES, stageGeometry } from "./stageShapes.ts";

export const StageDemo: React.FC = () => (
  <svg width={FRAME.width} height={FRAME.height} viewBox={`0 0 ${FRAME.width} ${FRAME.height}`}>
    <rect x={0} y={0} width={FRAME.width} height={FRAME.height} fill={WALL} />
    {STAGE_SHAPES.map((shape, i) => {
      const g = stageGeometry(shape, 36, "center");
      const row = i < 3 ? [-330, 0, 330][i] : [-250, 250][i - 3];
      const dy = i < 3 ? -330 : 330;
      return (
        <g key={shape} transform={`translate(${row} ${dy})`}>
          {g.shadow && <polygon points={g.shadow.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ")} fill="rgba(60,60,60,0.18)" />}
          <Polys polys={g.polys} tones={ISO.floor} />
        </g>
      );
    })}
  </svg>
);
