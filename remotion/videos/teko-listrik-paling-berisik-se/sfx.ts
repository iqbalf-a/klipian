/* The sound of "Teko listrik paling berisik sebelum mendidih": an effect on every element that enters, every camera move, label, card and state change that matters, on the frame of
   its picture (the same moments as index.tsx and plan.ts), about one event a second, only names of the locked set (src/catalog.ts). The mixer (sfx/mix.mjs) keeps it from getting
   busy: cooldowns, at most 3 one-shots at once, ducking under a voice. Imports plain .ts modules only (B26). */
import type { SfxEvent } from "../../src/sfx.ts";
import type { SfxName } from "../../src/catalog.ts";
import type { StoryT } from "../../src/schema.ts";
import { FPS } from "../../src/timeline.ts";
import { makePlan, startsOf } from "./plan.ts";

/** The bed under it all (render.mjs uses it because the story names none). */
export const music = { track: "bed-circuit", level: 0.8 } as const;

export function sfx(story: StoryT): SfxEvent[] {
  const P = makePlan(story), m = P.m, S = startsOf(story), ev: SfxEvent[] = [];
  const add = (t: number, name: SfxName, why: string, extra: Partial<SfxEvent> = {}) => ev.push({ t: Math.round(Math.max(0, t) * FPS) / FPS, name, vol: 1, why, ...extra });
  const b = (id: string, off: number, name: SfxName, why: string, extra: Partial<SfxEvent> = {}) => add(S[id] + off, name, why, extra);

  // hook: the camera pushes in on the kettle, the first headline lands
  add(0, "whoosh", "the camera pushes in on the kettle", { vol: 0.8 });
  add(0.25, "thump", "the first headline lands", { vol: 0.6 });
  add(1.5, "swish", "the establishing push begins", { vol: 0.7 });
  add(2.3, "tick-soft", "the sound arcs round the kettle", { vol: 0.7 });
  // the sting
  add(m.sting, "boing", "the mascot pops in");
  add(m.sting + 0.1, "jingle-sting", "Intip yuk!", { vol: 0.7 });
  add(m.sting + 0.27, "pop", "the Intip yuk! pill");
  add(m.stingEnd - 0.15, "swish", "the mascot leaves", { vol: 0.6 });

  // dasar: the camera goes down to the element, it heats, the hot layer forms
  b("dasar", 0.05, "swish-soft", "headline: dasar", { vol: 0.7 });
  b("dasar", 0.8, "swish", "the camera goes down to the element", { vol: 0.7 });
  add(m.element, "sizzle", "the element heats", { vol: 0.6 });
  b("dasar", 1.3, "tick", "label pemanas");
  add(m.hotLayer, "blip-alert", "the layer over the element is hotter", { vol: 0.7 });
  b("dasar", 3.1, "tick", "label lebih panas");
  add(S.dasar + 1.4, "hum", "the element is on", { dur: m.off - S.dasar, vol: 0.5 });

  // gelembung: bubbles are born on the element, grow and let go
    b("dasar", 6.9, "tick", "label gelembung uap");
  [0.6, 2.1, 3.6, 5.1, 6.6].forEach((d, i) => b("dasar", 6 + d, "bubble-rise", `a bubble grows on the element (${i + 1})`, { vol: 0.7 }));
  add(m.detach, "pop-soft", "a bubble lets go of the element");
  b("dasar", 11.5, "tick-soft", "source chip: didih nukleat");
  b("dasar", 13.2, "pop-soft", "the last bubble lets go", { vol: 0.8 });

  // runtuh: the camera pans up, the bubbles rise into cooler water and collapse (TIK)
  b("runtuh", 0.05, "swish-soft", "headline: runtuh", { vol: 0.7 });
  b("runtuh", 0.5, "swish", "the camera pans up the window", { vol: 0.7 });
  b("runtuh", 0.7, "tick", "label air lebih dingin");
  [1.2, 2.2, 3.3, 4.4, 5.3, 6.4, 7.3].forEach((d, i) => b("runtuh", d, "click-crack", `a bubble collapses (${i + 1})`, { vol: 0.6 }));
  b("runtuh", 3.3, "pop", "TIK!", { vol: 0.8 });
  b("runtuh", 5.3, "pop", "TIK!", { vol: 0.8 });

  // kejut: the macro on a collapsing bubble, the shock arcs, the sound spreads
  b("kejut", 0.05, "swish-soft", "headline: kejut", { vol: 0.7 });
  b("kejut", 0.6, "zip", "the macro closes in on a collapse", { vol: 0.8 });
  b("kejut", 1.4, "click-crack", "a bubble collapses");
  b("kejut", 2.1, "tick", "label gelombang kejut");
  b("kejut", 3.0, "rattle", "the shock arc spreads", { vol: 0.5 });
  add(m.arcs, "thump", "the sound arcs spread from the kettle", { vol: 0.7 });
  b("kejut", 5.1, "tick-soft", "source chip: kavitasi");
  b("kejut", 6.0, "click-crack", "a bubble collapses", { vol: 0.7 });
  b("kejut", 7.0, "rattle", "the shock arc spreads", { vol: 0.5 });

  // hasil: back out, the meter on the wall fills cell by cell, the last one is the boil
  b("hasil", 0.05, "swish-soft", "headline: hasil", { vol: 0.7 });
  b("hasil", 0.4, "swish", "the camera pulls back to the whole kettle", { vol: 0.7 });
  add(m.meter, "pop-soft", "the meter comes onto the wall");
  for (let i = 0; i < 8; i++) add(S.hasil + 1.4 + i * 0.5, i === 7 ? "chime" : "tick-soft", `meter cell ${i + 1}`, { vol: 0.8 });
  b("hasil", 1.7, "tick", "label berisik");
  add(m.boilMark - 0.1, "blip-alert", "label mendidih", { vol: 0.8 });

  // fakta: a pan to the handle and the lamp, the kettle switches itself off
  b("fakta", 0.05, "swish-soft", "headline: fakta", { vol: 0.7 });
  b("fakta", 0.4, "swish", "the camera pans to the handle", { vol: 0.7 });
  add(m.off, "click-crack", "the kettle switches itself off");
  add(m.off + 0.1, "slide-whistle-down", "the element cools", { vol: 0.6 });
  b("fakta", 3.4, "tick", "label lampu mati");
  b("fakta", 3.9, "tick-soft", "source chip: kettle");
  b("fakta", 4.1, "puff", "the last steam", { vol: 0.7 });

  // tips
  b("tips", 0.05, "swish-soft", "headline: tips", { vol: 0.7 });
  b("tips", 0.4, "swish", "the camera settles for the tips", { vol: 0.7 });
  add(m.tip + 0.1, "chime", "tip 1");
  b("tips", 4.9, "chime-bright", "tip 2");
  b("tips", 5.6, "tick", "the line under the tip");

  // the loop-back: no jingle and no mascot sound; one soft thump as the kettle settles into the first shot
  add(m.outro + 0.1, "swish-soft", "the camera eases back to the wide shot", { vol: 0.6 });
  add(m.outro + 2.8, "thump", "the kettle settles", { vol: 0.5 });
  return ev.sort((a, c) => a.t - c.t);
}
