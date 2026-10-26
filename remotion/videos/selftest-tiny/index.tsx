/* The selftest's custom composition: the smallest video made from the design system, to prove a custom composition goes through the same path
   (klipian project -> stills -> render -> Clips) as the template. Hidden from the Komposisi list (meta.json). */
import React from "react";
import { Banner, Brand, Label, Mascot, StoryVideo, type SceneProps, type StoryT } from "../../src/design/index.ts";
import storyJson from "./story.json";

export const story = storyJson as unknown as StoryT;

const Scene = ({ beat, t, clock }: SceneProps) => (
  <svg width={1080} height={1920} viewBox="0 0 1080 1920">
    <Brand clock={clock} />
    <Banner text={beat.text} t={t} start={0} />
    <Mascot x={540} y={900} w={520} expr="curious" t={t} clock={clock} />
    <Label text={beat.id} x={540} y={1400} fs={64} t={t} start={0.3} />
  </svg>
);

export const Video: React.FC<{ story: StoryT; layoutDebug?: boolean }> = (p) => <StoryVideo story={p.story} scene={Scene} layoutDebug={p.layoutDebug} />;
