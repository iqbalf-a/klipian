/* The sound of "Kipas angin tidak mendinginkan udara": an effect on every element that enters, every camera move, label, card and state change that matters, on the frame of its picture
   (the same moments as index.tsx and plan.ts), about one event a second, only names of the locked set (src/catalog.ts). The mixer (sfx/mix.mjs) keeps it from getting busy: cooldowns,
   at most 3 one-shots at once, ducking under a voice. Imports plain .ts modules only (B26). */
import type { SfxEvent } from "../../src/sfx.ts";
import type { SfxName } from "../../src/catalog.ts";
import type { StoryT } from "../../src/schema.ts";
import { FPS } from "../../src/timeline.ts";
import { makePlan, startsOf } from "./plan.ts";

/** The bed under it all (render.mjs uses it because the story names none). */
export const music = { track: "bed-neon", level: 0.8 } as const;

export function sfx(story: StoryT): SfxEvent[] {
  const P = makePlan(story), m = P.m, S = startsOf(story), ev: SfxEvent[] = [];
  const add = (t: number, name: SfxName, why: string, extra: Partial<SfxEvent> = {}) => ev.push({ t: Math.round(Math.max(0, t) * FPS) / FPS, name, vol: 1, why, ...extra });
  const b = (id: string, off: number, name: SfxName, why: string, extra: Partial<SfxEvent> = {}) => add(S[id] + off, name, why, extra);

  // hook: the camera pushes in on the fan, the first headline lands, the blades hum
  add(0, "whoosh", "the camera pushes in on the fan", { vol: 0.8 });
  add(0.25, "thump", "the first headline lands", { vol: 0.6 });
  add(0.4, "hum", "the fan runs", { dur: m.off - 0.4, vol: 0.5 });
  add(1.5, "swish", "the establishing push begins", { vol: 0.7 });
  add(2.4, "tick-soft", "the air streaks run", { vol: 0.7 });
  // the sting
  add(m.sting, "boing", "the mascot pops in");
  add(m.sting + 0.1, "jingle-sting", "Intip yuk!", { vol: 0.7 });
  add(m.sting + 0.27, "pop", "the Intip yuk! pill");
  add(m.stingEnd - 0.15, "swish", "the mascot leaves", { vol: 0.6 });

  // udara: the stream runs past the thermometer and its level stays
  b("udara", 0.05, "swish-soft", "headline: udara", { vol: 0.7 });
  b("udara", 0.6, "swish", "the camera pushes on the thermometer", { vol: 0.7 });
  [1.0, 2.0, 3.0, 4.0].forEach((d, i) => b("udara", d, "swish-soft", `a streak of air passes (${i + 1})`, { vol: 0.5 }));
  b("udara", 0.9, "tick", "label angin");
  add(m.thermo, "glass-ting", "the thermometer", { vol: 0.7 });
  b("udara", 5.5, "tick", "label suhu tetap");
  add(m.same, "blip-alert", "the level does not move", { vol: 0.6 });
  b("udara", 6.7, "tick-soft", "source chip: Ceiling fan");

  // badan: the camera pans to the skin, the drops shrink, vapour rises, the heat is carried off
  b("badan", 0.05, "swish-soft", "headline: badan", { vol: 0.7 });
  b("badan", 0.4, "swish", "the camera pans down the table to the skin", { vol: 0.7 });
  add(m.drops, "drip", "drops of sweat on the skin");
  b("badan", 2.7, "tick", "label keringat");
  [3.6, 4.6, 5.6, 6.6].forEach((d, i) => b("badan", d, "bubble-rise", `vapour rises from a drop (${i + 1})`, { vol: 0.5 }));
  b("badan", 4.7, "tick", "label menguap");
  b("badan", 7.1, "tick-soft", "source chip: Perspiration");
  b("badan", 8.2, "puff", "the last drops are gone", { vol: 0.6 });
  add(m.carry, "sizzle", "the heat of the skin leaves", { vol: 0.5 });
  b("badan", 9.9, "blip-alert", "label panas terbawa", { vol: 0.7 });
  b("badan", 12.0, "swish-soft", "the streaks carry the heat off", { vol: 0.6 });

  // motor: the camera pans back to the motor, its waste heat rises
  b("motor", 0.05, "swish-soft", "headline: motor", { vol: 0.7 });
  b("motor", 0.4, "swish", "the camera pans back to the motor", { vol: 0.7 });
  add(m.motor + 0.3, "sizzle", "the motor's heat", { vol: 0.5 });
  b("motor", 1.5, "blip-alert", "label panas motor", { vol: 0.7 });
  add(m.warm, "tick-soft", "the thermometer creeps up", { vol: 0.8 });
  b("motor", 5.3, "tick-soft", "source chip: Ceiling fan");

  // hasil: back out to the row, the verdict
  b("hasil", 0.05, "swish-soft", "headline: hasil", { vol: 0.7 });
  b("hasil", 0.4, "swish", "the camera pulls back to the whole row", { vol: 0.7 });
  add(m.verdict, "chime", "kulit: dingin", { vol: 0.8 });
  b("hasil", 3.1, "tick", "label udara: sama");
  b("hasil", 5.1, "tick-soft", "source chip: Fan (machine)");

  // tips: the fan is switched off
  b("tips", 0.05, "swish-soft", "headline: tips", { vol: 0.7 });
  b("tips", 0.4, "swish", "the camera settles for the tips", { vol: 0.7 });
  add(m.tip + 0.1, "chime", "tip 1");
  add(m.off, "click-crack", "the fan is switched off");
  add(m.off + 0.2, "slide-whistle-down", "the blades slow down", { vol: 0.6 });
  b("tips", 5.5, "chime-bright", "tip 2");
  b("tips", 6.2, "tick", "the line under the tip");

  // the loop-back: no jingle and no mascot sound; the fan starts again as the camera eases home
  add(m.outro + 0.1, "swish-soft", "the camera eases back to the wide shot", { vol: 0.6 });
  add(57, "click-crack", "the fan is switched on again", { vol: 0.5 });
  add(m.outro + 2.8, "thump", "the fan settles", { vol: 0.5 });
  return ev.sort((a, c) => a.t - c.t);
}
