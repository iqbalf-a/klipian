/* The sound of "Kenapa AC meneteskan air?": an effect on every element that enters, every camera move, label, card and state change that matters, on the frame of its
   picture (the same moments as index.tsx and plan.ts), about one event a second, only names of the locked set (src/catalog.ts). The mixer (sfx/mix.mjs) keeps it from
   getting busy: cooldowns, at most 3 one-shots at once, ducking under a voice. Imports plain .ts modules only (B26). */
import type { SfxEvent } from "../../src/sfx.ts";
import type { SfxName } from "../../src/catalog.ts";
import type { StoryT } from "../../src/schema.ts";
import { FPS } from "../../src/timeline.ts";
import { makePlan, startsOf } from "./plan.ts";

/** The bed under it all (render.mjs uses it when the story names none). */
export const music = { track: "bed-bounce", level: 0.8 } as const;

export function sfx(story: StoryT): SfxEvent[] {
  const P = makePlan(story), m = P.m, S = startsOf(story), ev: SfxEvent[] = [];
  const add = (t: number, name: SfxName, why: string, extra: Partial<SfxEvent> = {}) => ev.push({ t: Math.round(Math.max(0, t) * FPS) / FPS, name, vol: 1, why, ...extra });
  const b = (id: string, off: number, name: SfxName, why: string, extra: Partial<SfxEvent> = {}) => add(S[id] + off, name, why, extra);

  // hook: the wide shot with the hose dripping outside, the headline, the establishing push to the indoor unit
  add(0, "drip", "a drop falls from the hose into the drain", { vol: 0.7 });
  add(0.25, "thump", "the first headline lands", { vol: 0.6 });
  add(0.4, "hum", "the AC runs", { dur: 2.4, vol: 0.4 });
  add(1.2, "drip", "the next drop", { vol: 0.6 });
  add(1.5, "zoom-whoosh", "the establishing push to the indoor unit", { vol: 0.7 });
  add(2.6, "swish-soft", "the louver swings", { vol: 0.5 });
  // the sting
  add(m.sting, "boing", "the mascot pops in");
  add(m.sting + 0.1, "jingle-sting", "Intip yuk!", { vol: 0.7 });
  add(m.sting + 0.27, "pop", "the Intip yuk! pill");
  add(m.stingEnd - 0.15, "swish", "the mascot leaves", { vol: 0.6 });

  // udara: warm room air streams into the top grille, carrying vapour
  b("udara", 0.05, "swish-soft", "headline: udara", { vol: 0.7 });
  b("udara", 0.5, "swish", "the camera pushes up to the intake", { vol: 0.6 });
  add(m.air, "tick", "label udara hangat");
  b("udara", 1.8, "swish-soft", "a streak of air goes in", { vol: 0.5 });
  add(m.vapour, "bubble-rise", "the vapour dots appear", { vol: 0.6 });
  b("udara", 3.4, "swish-soft", "a streak of air goes in", { vol: 0.5 });
  b("udara", 4.6, "tick-soft", "source chip: Dehumidifier");
  b("udara", 5.6, "bubble-rise", "more vapour drifts in", { vol: 0.5 });
  b("udara", 6.6, "swish-soft", "the label leaves", { vol: 0.4 });

  // dingin: the cover lifts, the cold coil, cold air out of the louver
  b("dingin", 0.05, "swish-soft", "headline: dingin", { vol: 0.7 });
  add(m.open, "click-crack", "the front cover unlatches", { vol: 0.6 });
  add(m.open + 0.3, "whoosh", "the cover lifts away", { vol: 0.6 });
  add(m.coil, "glass-ting", "the evaporator coil, label", { vol: 0.7 });
  b("dingin", 2.0, "hum", "the cross-flow fan turns", { dur: 2.0, vol: 0.4 });
  add(m.coldOut, "swish", "cold air out of the louver", { vol: 0.6 });
  b("dingin", 3.0, "tick", "label udara dingin");
  b("dingin", 4.4, "swish-soft", "a cold streak", { vol: 0.5 });
  b("dingin", 5.6, "tick-soft", "source chip: Air conditioning");
  b("dingin", 6.8, "swish-soft", "the camera keeps pushing in", { vol: 0.4 });

  // embun: drops grow on the fins and fall into the pan
  b("embun", 0.05, "swish-soft", "headline: embun", { vol: 0.7 });
  add(m.dew, "glass-ting", "the first drops on the fins", { vol: 0.6 });
  b("embun", 0.8, "tick", "label embun");
  b("embun", 1.6, "drip", "a drop runs down a fin", { vol: 0.6 });
  add(m.fall, "drip", "a drop falls into the pan", { vol: 0.7 });
  b("embun", 2.8, "tick", "label menetes");
  b("embun", 3.8, "drip", "another drop lands", { vol: 0.6 });
  b("embun", 5.4, "tick-soft", "source chip: Dew point");
  b("embun", 6.0, "drip", "another drop lands", { vol: 0.6 });
  b("embun", 7.2, "bubble-rise", "the pan fills a little", { vol: 0.5 });

  // selang: the pan, the pan along the hose to the outside, the drip into the drain
  b("selang", 0.05, "swish-soft", "headline: selang", { vol: 0.7 });
  add(m.pan, "tick", "label bak penampung");
  b("selang", 1.1, "tick-soft", "source chip: Condensate pump");
  b("selang", 1.4, "slide-whistle-down", "the water runs down the hose", { vol: 0.5 });
  b("selang", 2.4, "whoosh", "the camera pans along the hose outside", { vol: 0.6 });
  add(m.out, "tick", "label selang buang");
  b("selang", 4.2, "drip", "a drop falls outside", { vol: 0.7 });
  b("selang", 5.0, "tick", "label ke luar rumah");
  b("selang", 6.0, "drip", "a drop splashes in the drain", { vol: 0.6 });

  // hasil: back out to the house and the garden, the verdict
  b("hasil", 0.05, "swish-soft", "headline: hasil", { vol: 0.7 });
  b("hasil", 0.4, "zoom-whoosh", "the camera pulls back", { vol: 0.6 });
  add(m.verdict, "chime", "netes di luar: wajar", { vol: 0.8 });
  b("hasil", 2.6, "tick", "label udara lebih kering");
  b("hasil", 3.6, "drip", "the drip goes on outside", { vol: 0.5 });
  b("hasil", 4.4, "tick-soft", "source chip: Dehumidifier");
  b("hasil", 6.0, "drip", "the drip goes on outside", { vol: 0.5 });

  // bocor: the outlet clogs, the pan overflows, drops fall inside, a puddle grows
  b("bocor", 0.05, "swish-soft", "headline: bocor", { vol: 0.7 });
  b("bocor", 0.4, "swish", "the camera pans to the bedroom floor", { vol: 0.6 });
  add(m.clog, "blip-alert", "label tersumbat: the dirt in the outlet", { vol: 0.7 });
  b("bocor", 2.2, "huh", "the drip outside stops", { vol: 0.6 });
  add(m.leak, "drip", "the first drop falls inside", { vol: 0.8 });
  b("bocor", 3.4, "blip-alert", "label netes di dalam", { vol: 0.6 });
  b("bocor", 4.6, "drip", "another drop on the floor", { vol: 0.7 });
  b("bocor", 5.0, "tick-soft", "source chip: Dehumidifier");
  b("bocor", 6.1, "drip", "the puddle grows", { vol: 0.7 });

  // tips: two tips, the outlet is cleared, the drip goes back outside
  b("tips", 0.05, "swish-soft", "headline: tips", { vol: 0.7 });
  add(m.tip1, "chime", "tip 1: rawat berkala");
  add(m.clean, "puff", "the dirt is cleared from the outlet", { vol: 0.6 });
  b("tips", 2.2, "drip", "the drip is back outside", { vol: 0.6 });
  add(m.tip2, "chime-bright", "tip 2: panggil teknisi");
  b("tips", 5.0, "swish-soft", "the puddle dries", { vol: 0.5 });
  b("tips", 5.6, "click-crack", "the cover shuts", { vol: 0.5 });

  // the loop-back: no jingle and no mascot sound; the camera eases home to the wide shot
  add(m.outro + 0.1, "swish-soft", "the camera eases back to the wide shot", { vol: 0.6 });
  add(m.outro + 1.4, "drip", "a drop outside", { vol: 0.5 });
  add(m.outro + 2.6, "drip", "a drop outside", { vol: 0.5 });
  add(m.outro + 3.5, "thump", "the wide shot settles", { vol: 0.4 });
  return ev.sort((a, c) => a.t - c.t);
}
