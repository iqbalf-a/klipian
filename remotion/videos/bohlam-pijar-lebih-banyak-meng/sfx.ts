/* The sound effects of bohlam-pijar-lebih-banyak-meng: the default beat sounds (the sting's jingle, the outro's, a whoosh at each transition) plus an effect on the main
   moments of the picture, on the frame of each (the same times as plan.ts). */
// Imported from the plain .ts modules, never from src/design/index.ts: render.mjs loads this file in Node, which cannot read the .tsx components that index re-exports.
import { defaultBeatSfx, type SfxEvent } from "../../src/sfx.ts";
import type { SfxName } from "../../src/catalog.ts";
import type { StoryT } from "../../src/schema.ts";
import { FPS } from "../../src/timeline.ts";
import { makePlan, startsOf } from "./plan.ts";

export function sfx(story: StoryT): SfxEvent[] {
  const P = makePlan(story), m = P.m, S = startsOf(story);
  const ev: SfxEvent[] = [...defaultBeatSfx(story)];
  const add = (t: number, name: SfxName, why: string, vol = 1) => ev.push({ t: Math.round(Math.max(0, t) * FPS) / FPS, name, vol, why });
  add(0, "whoosh", "the camera pushes in on the bulb", 0.7);
  add(0.3, "hum", "the lit bulb hums softly", 0.5);
  add(m.off, "click-crack", "the switch: the bulb goes dark", 0.8);
  add(m.on, "click-crack", "the switch: the current flows again", 0.8);
  add(m.on + 0.3, "hum", "the filament heats up", 0.7);
  add(S.pijar + 0.1, "swish-soft", "the camera pulls back from the filament", 0.6);
  add(S.panas + 1.6, "whoosh", "the camera pans down to the 25 squares", 0.6);
  add(m.convStart, "glass-ting", "the one square that becomes light", 0.8);
  for (let k = 0; k < 4; k++) add(m.convStart + 0.6 + k * 0.8, "pop-soft", "squares turn into heat", 0.7);
  add(m.convStart + 1.2, "sizzle", "the heat squares", 0.5);
  add(S.infra + 1.3, "swish", "the invisible rings spread", 0.6);
  add(m.ledIn, "pop", "the LED bulb grows in", 0.9);
  add(m.ledIn + 0.2, "chime", "the LED shines the same", 0.6);
  add(S.ac + 0.5, "whoosh", "the camera pans to the air conditioner", 0.7);
  add(S.ac + 2.0, "hum", "the air conditioner works harder", 0.6);
  add(S.tips + 0.2, "swish-soft", "back to the two bulbs", 0.6);
  add(S.outro + 0.1, "whoosh", "the loop-back to the wide shot", 0.6);
  return ev.sort((a, b) => a.t - b.t);
}
