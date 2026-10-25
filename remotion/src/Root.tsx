import React from "react";
import { Composition } from "remotion";
import { FunFact } from "./FunFact.tsx";
import { FPS, totalFrames } from "./timeline.ts";
import { Dissect3D, DISSECT_SECONDS } from "./Dissect3D.tsx";
import { FRAME } from "./tokens.ts";
import { validateStory, type StoryT } from "./schema.ts";
import sample from "../stories/colokan-panas.json";

const parsed = validateStory(sample);
if (!parsed.ok) throw new Error("stories/colokan-panas.json is not a valid story:\n" + parsed.errors.join("\n"));

export const Root: React.FC = () => (
  <>
  <Composition
    id="FunFact"
    component={FunFact}
    width={FRAME.width}
    height={FRAME.height}
    fps={FRAME.fps}
    durationInFrames={totalFrames(parsed.story)}
    defaultProps={{ story: parsed.story as StoryT }}
    // The video lasts the sum of the beats of the story it is given (the Studio's, or the one render.mjs passes in).
    calculateMetadata={({ props }) => ({ durationInFrames: Math.max(1, totalFrames(props.story)) })}
  />
  {/* the 3D dissection test (P28-A2): a charger head, flat toon shading, no story */}
  <Composition id="Dissect3D" component={Dissect3D} width={FRAME.width} height={FRAME.height} fps={FPS} durationInFrames={Math.round(DISSECT_SECONDS * FPS)} />
  </>
);
