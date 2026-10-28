/* The five stage shapes at the video's own scale (PLAN-VARIETY stage 3, fixed in stage 3 of the second round): one tile per shape, the stage drawn with the
   kit's unit (u = 100) and a small block on top of it, so the hero's place and the shadow are visible. A separate composition ("StageDemo") rendered as
   stills into out/stages/ with scripts/frames.mjs. It draws nothing a video uses. */
import React from "react";
import { Polys } from "./components/Iso.tsx";
import { Brand, ThemeCtx } from "./components/Backgrounds.tsx";
import type { StoryT } from "./schema.ts";
import { block, type P2, type Poly } from "./iso.ts";
import { FRAME, ISO, WALL } from "./tokens.ts";
import { STAGE_SHAPES, heroScale, stageGeometry } from "./stageShapes.ts";

const COLS = 2, TILE_W = FRAME.width / COLS, TILE_H = 640, U = 100;
const CENTER: P2 = [540, 1180];                       // where stageGeometry puts the centre of a stage (the frame's middle, the video's floor line)

/** One tile: its stage at the centre, a small block standing on its top. Coordinates are the stage's own (the tile is moved with a transform). */
const StageTile: React.FC<{ shape: (typeof STAGE_SHAPES)[number] }> = ({ shape }) => {
  const g = stageGeometry(shape, U, "center");
  const obj: Poly[] = block([-0.35, 0.1, g.top], [0.35, 0.6, g.top + 0.7], U, CENTER);
  return (
    <g>
      {g.shadow && <polygon points={g.shadow.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ")} fill="rgba(60,60,60,0.18)" />}
      <Polys polys={g.polys} tones={ISO.floor} />
      <Polys polys={obj} tones={ISO.plastic} />
      <circle cx={g.center[0]} cy={g.center[1]} r={4} fill="rgb(200,40,40)" />
    </g>
  );
};

export const StageDemo: React.FC = () => (
  <svg width={FRAME.width} height={FRAME.height} viewBox={`0 0 ${FRAME.width} ${FRAME.height}`}>
    <rect x={0} y={0} width={FRAME.width} height={FRAME.height} fill={WALL} />
    {STAGE_SHAPES.map((shape, i) => {
      const col = i % COLS, row = Math.floor(i / COLS);
      const tx = col * TILE_W + TILE_W / 2 - CENTER[0], ty = row * TILE_H + TILE_H / 2 - CENTER[1];
      return (
        <g key={shape} transform={`translate(${tx} ${ty})`}>
          <StageTile shape={shape} />
        </g>
      );
    })}
  </svg>
);

/** The hero fixture (PLAN-VARIETY stage 3, round two): one story's stage drawn on the channel's background at the hero rule's scale (the stage with the hero
    on it fills 60 to 70 % of the width), with the story's theme. A composition ("HeroStageFixture") for stills: the story is its input. */
export const HeroStageFixture: React.FC<{ story: StoryT }> = ({ story }) => {
  const shape = story.stage ?? "slab";
  const u = heroScale(shape);
  const g = stageGeometry(shape, u, "center");
  const obj: Poly[] = block([-0.35, 0.1, g.top], [0.35, 0.6, g.top + 0.7], u, [540, 1180]);
  return (
    <ThemeCtx.Provider value={story.theme ?? "cream"}>
      <svg width={FRAME.width} height={FRAME.height} viewBox={`0 0 ${FRAME.width} ${FRAME.height}`}>
        <Brand clock={0} />
        {g.shadow && <polygon points={g.shadow.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ")} fill="rgba(60,60,60,0.18)" />}
        <Polys polys={g.polys} tones={ISO.floor} />
        <Polys polys={obj} tones={ISO.plastic} />
      </svg>
    </ThemeCtx.Provider>
  );
};
