/* Kenapa colokan bisa panas? — a custom video (videos/kenapa-colokan-panas/). READ remotion/DESIGN.md FIRST.
   It reads the CHECKED story (story.json), so the fact-checked words, the beats and their lengths are the ones used; the scenes are yours.
   Draw each beat in `Scene`, from the design system (src/design/index.ts): backgrounds, the hero object, labels, arrows, motion.
   Texts go through the layout manager so nothing overlaps: describe what is on the screen as boxes, `resolve` moves the texts. */
import React from "react";
import { Banner, Brand, Label, StoryVideo, ZONES, applyLayout, type ItemT, type SceneProps, type StoryT } from "../../src/design/index.ts";
import storyJson from "./story.json";

export const story = storyJson as unknown as StoryT;

/** One beat. `t` is the seconds into the beat, `clock` the seconds of the whole video. Replace the body: this one only shows the beat's text. */
const Scene = ({ beat, t, clock }: SceneProps) => {
  // the story's own items (if the story has any) go through the layout manager; a scene made only of your own components skips this
  const items: ItemT[] = applyLayout(beat.scene.items).items;
  return (
    <svg width={1080} height={1920} viewBox="0 0 1080 1920">
      <Brand clock={clock} spot={{ x: ZONES.hero.cx, y: ZONES.hero.cy }} />
      <Banner text={beat.text} t={t} start={0} />
      {items.filter((i) => i.type === "label").map((i, k) => i.type === "label" && <Label key={k} text={i.text} x={i.x} y={i.y} fs={i.fs} lines={i.lines} t={t} start={0.4 + k * 0.15} />)}
    </svg>
  );
};

export const Video: React.FC<{ story: StoryT; layoutDebug?: boolean }> = (p) => <StoryVideo story={p.story} scene={Scene} layoutDebug={p.layoutDebug} />;
