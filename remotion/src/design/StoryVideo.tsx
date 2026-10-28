/* The frame of a custom video (videos/<slug>/): it reads the CHECKED story, so the fact-checked words, the beats and their lengths are the
   ones used, and it draws each beat with the scene function you give it. Beats overlap by their transitions exactly as in the template
   (the story's `transition` words: slide, wipe, zoom, through the lens), so the video lasts the sum of the beats. */
import React from "react";
import { ThemeCtx } from "../components/Backgrounds.tsx";
import { CaptionStyleCtx } from "../components/Captions.tsx";
import { useCurrentFrame } from "remotion";
import { linearTiming, TransitionSeries } from "@remotion/transitions";
import type { BeatT, StoryT } from "../schema.ts";
import { FPS, sequencePlan, transitionInto } from "../timeline.ts";
import { presentationFor } from "../transitions.tsx";
import { FRAME } from "../tokens.ts";
import { useFonts } from "../FunFact.tsx";
import { applyLayout } from "../layout.ts";
import { LayoutDebug } from "../components/LayoutDebug.tsx";

/** What a scene function gets: the beat, its index, `t` = seconds into the beat (it goes on during a transition), `clock` = seconds of the video
    (backgrounds drift and idles run on it, so they carry over from beat to beat), and the whole story. */
export type SceneProps = { beat: BeatT; index: number; t: number; clock: number; story: StoryT };
export type Scene = (props: SceneProps) => React.ReactNode;

const BeatFrame: React.FC<{ beat: BeatT; index: number; start: number; story: StoryT; scene: Scene; debug: boolean }> = ({ beat, index, start, story, scene, debug }) => {
  const frame = useCurrentFrame();
  return (
    <div style={{ position: "relative", width: FRAME.width, height: FRAME.height, overflow: "hidden" }}>
      {scene({ beat, index, t: frame / FPS, clock: (start + frame) / FPS, story })}
      {debug && <LayoutDebug report={applyLayout(beat.scene.items).report} />}
    </div>
  );
};

export const StoryVideo: React.FC<{ story: StoryT; scene: Scene; layoutDebug?: boolean }> = ({ story, scene, layoutDebug = false }) => {
  useFonts();
  const children: React.ReactNode[] = [];
  sequencePlan(story).forEach((p, i) => {
    const tr = transitionInto(story, i);
    if (i > 0 && tr.frames > 0) children.push(<TransitionSeries.Transition key={`tr-${p.beat.id}`} presentation={presentationFor(p.beat.transition!)} timing={linearTiming({ durationInFrames: tr.frames })} />);
    children.push(
      <TransitionSeries.Sequence key={p.beat.id} durationInFrames={p.sequenceFrames}>
        <BeatFrame beat={p.beat} index={i} start={p.from} story={story} scene={scene} debug={layoutDebug} />
      </TransitionSeries.Sequence>);
  });
  return (
    <ThemeCtx.Provider value={story.theme ?? "cream"}>
      <CaptionStyleCtx.Provider value={story.captionStyle ?? "classic"}><TransitionSeries>{children}</TransitionSeries></CaptionStyleCtx.Provider>
    </ThemeCtx.Provider>
  );
};
