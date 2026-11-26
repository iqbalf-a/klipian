/* The sound of "Kenapa HP panas dicas sambil main game": written by hand, and short on purpose. B60 and B61 say every sound name must be one that NONE of the 10 most recent
   videos uses (only the two channel jingles may repeat). The locked catalog has 197 names and 195 of them are used by those 10 videos, so only "car-horn" and "meow" are free:
   the pool is too short for a 60 s video (about 55 events). Nothing is reused silently: this file holds the two jingles and one car horn (the warning when the screen dims),
   so the density is far under 0.7 a second and the style check will FLAG it. ian: please add sounds to the catalog (B15, B61 d: fewer than 40 are free), then the events below
   (a sound on every card, label, flip, camera move, gauge step and the heat of each part, all listed in plan.ts) are written against the free names. */
import type { SfxEvent } from "../../src/sfx.ts";
import type { SfxName } from "../../src/catalog.ts";
import type { StoryT } from "../../src/schema.ts";
import { FPS } from "../../src/timeline.ts";
import { RESULT, makePlan } from "./plan.ts";

export const music = { track: "bed-orbit", level: 0.8 } as const;

export function sfx(story: StoryT): SfxEvent[] {
  const m = makePlan(story).m, ev: SfxEvent[] = [];
  const add = (t: number, name: SfxName, why: string, extra: Partial<SfxEvent> = {}) => ev.push({ t: Math.round(Math.max(0, t) * FPS) / FPS, name, vol: 1, why, ...extra });
  add(m.sting, "jingle-sting", "Intip yuk!", { vol: 0.7 });
  add(RESULT[0].a, "car-horn", "the warning: the screen dims and the phone slows itself", { vol: 0.5 });
  add(m.outro + 0.1, "jingle-outro", "loop-back jingle", { vol: 0.8 });
  return ev;
}
