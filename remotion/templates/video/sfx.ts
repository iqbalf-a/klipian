/* The sound effects of __SLUG__: a list of { t (seconds into the video, on a frame), name (src/catalog.ts SFX), vol, why }. Delete this file to get
   the default (the jingles of the sting and the outro and a whoosh at each transition). Start from the template's own events with
   `storyEvents(story)` (src/sfx.ts), or write them by hand against your scenes: sounds must land on the frame of their picture. */
// Imported from the plain .ts modules, never from src/design/index.ts: render.mjs loads this file in Node, which cannot read the .tsx components that index re-exports.
import { defaultBeatSfx, type SfxEvent } from "../../src/sfx.ts";
import type { StoryT } from "../../src/schema.ts";

export function sfx(story: StoryT): SfxEvent[] {
  return defaultBeatSfx(story);
}
