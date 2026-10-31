/* The selftest video's sound: the default events of the story. It exists so the klipian selftest renders a custom video WITH an sfx.ts, the way render.mjs loads it in
   Node: only plain .ts modules are imported here (never src/design/index.ts, which re-exports .tsx). */
import { defaultBeatSfx, type SfxEvent } from "../../src/sfx.ts";
import type { StoryT } from "../../src/schema.ts";

export function sfx(story: StoryT): SfxEvent[] {
  return defaultBeatSfx(story);
}
