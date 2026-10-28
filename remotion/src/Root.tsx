import React from "react";
import { Composition } from "remotion";
import { FunFact } from "./FunFact.tsx";
import { FPS, totalFrames } from "./timeline.ts";
import { Dissect3D, DISSECT_SECONDS } from "./Dissect3D.tsx";
import { Models3D } from "./Models3D.tsx";
import { AssetSheet, AssetSheetIso } from "./AssetSheet.tsx";
import { CardsDemo } from "./CardsDemo.tsx";
import { RigDemo, RIG_DEMO_SECONDS } from "./RigDemo.tsx";
import { IsoDemo, ISO_DEMO_SECONDS } from "./IsoDemo.tsx";
import { IsoThreeDemo, ISO_THREE_SECONDS } from "./IsoThreeDemo.tsx";
import { NatureDemo, NATURE_DEMO_SECONDS } from "./NatureDemo.tsx";
import { ThemeCtx } from "./components/Backgrounds.tsx";
import { NatureSheet } from "./NatureSheet.tsx";
import { MarkSheet } from "./MarkSheet.tsx";
import { SHEET_HEIGHT } from "./natureGeometry.ts";
import { FRAME } from "./tokens.ts";
import { validateStory, type StoryT } from "./schema.ts";
import sample from "../stories/colokan-panas.json";
import { VIDEOS } from "./videoRegistry.ts";

const parsed = validateStory(sample);
if (!parsed.ok) throw new Error("stories/colokan-panas.json is not a valid story:\n" + parsed.errors.join("\n"));

/** A custom video inside its story's background theme (PLAN-VARIETY stage 2): the story's `theme`, cream when it has none. The video itself is unchanged. */
const themed: Record<string, React.ComponentType<{ story: StoryT; layoutDebug?: boolean }>> = Object.fromEntries(VIDEOS.map((v) => {
  const Themed: React.FC<{ story: StoryT; layoutDebug?: boolean }> = (props) => (
    <ThemeCtx.Provider value={props.story.theme ?? "cream"}><v.Video {...props} /></ThemeCtx.Provider>
  );
  return [v.id, Themed];
}));

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
  {/* the 3D toon assets on one sheet, for looking at them (P28-A4) */}
  <Composition id="Models3D" component={Models3D} width={FRAME.width} height={FRAME.height} fps={FPS} durationInFrames={90} />
  {/* every asset of the library on one sheet, with its name (npm run assets-sheet) */}
  <Composition id="AssetSheet" component={AssetSheet} width={FRAME.width} height={FRAME.height} fps={FPS} durationInFrames={30} />
  <Composition id="AssetSheetIso" component={AssetSheetIso} width={FRAME.width} height={FRAME.height} fps={FPS} durationInFrames={30} />
  <Composition id="RigDemo" component={RigDemo} width={FRAME.width} height={FRAME.height} fps={FPS} durationInFrames={RIG_DEMO_SECONDS * FPS} />
  <Composition id="IsoDemo" component={IsoDemo} width={FRAME.width} height={FRAME.height} fps={FPS} durationInFrames={ISO_DEMO_SECONDS * FPS} />
  <Composition id="MarkSheet" component={MarkSheet} width={FRAME.width} height={FRAME.height} fps={FPS} durationInFrames={1} />
  <Composition id="NatureSheet" component={NatureSheet} width={FRAME.width} height={SHEET_HEIGHT} fps={FPS} durationInFrames={1} />
  <Composition id="NatureDemo" component={NatureDemo} width={FRAME.width} height={FRAME.height} fps={FPS} durationInFrames={NATURE_DEMO_SECONDS * FPS} />
  <Composition id="IsoThreeDemo" component={IsoThreeDemo} width={FRAME.width} height={FRAME.height} fps={FPS} durationInFrames={ISO_THREE_SECONDS * FPS} />
  <Composition id="CardsDemo" component={CardsDemo} width={FRAME.width} height={FRAME.height} fps={FPS} durationInFrames={90} />
  {/* the custom videos (videos/<slug>/): each one reads its checked story and is registered by its folder name */}
  {VIDEOS.map((v) => (
    <Composition key={v.id} id={v.id} component={themed[v.id]} width={FRAME.width} height={FRAME.height} fps={FRAME.fps} durationInFrames={totalFrames(v.story)}
      defaultProps={{ story: v.story as StoryT }} calculateMetadata={({ props }) => ({ durationInFrames: Math.max(1, totalFrames(props.story)) })} />
  ))}
  </>
);
