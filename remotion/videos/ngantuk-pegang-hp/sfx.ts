/* The sound of "Kenapa rebahan pegang hp ngantuk, tapi hp ditaruh malah melek?": an effect on nearly every movement, on the frame of its picture (the same moments as the
   picture, from plan.ts), and a thin music bed. The mixer (sfx/mix.mjs) keeps it from getting busy: cooldowns, at most 3 one-shots at once, ducking under a voice.
   Only the approved sounds (B15) are used; none is new. */
import type { SfxEvent } from "../../src/sfx.ts";
import type { SfxName } from "../../src/catalog.ts";
import type { StoryT } from "../../src/schema.ts";
import { FPS } from "../../src/timeline.ts";
import { makePlan } from "./plan.ts";

/** The bed under it all (render.mjs uses it when the story names none): the brief asks for the calm bed. */
export const music = { track: "bed-calm", level: 0.8 } as const;

export function sfx(story: StoryT): SfxEvent[] {
  const P = makePlan(story), m = P.m, ev: SfxEvent[] = [];
  const add = (t: number, name: SfxName, why: string, extra: Partial<SfxEvent> = {}) => ev.push({ t: Math.round(Math.max(0, t) * FPS) / FPS, name, vol: 1, why, ...extra });

  add(0, "whoosh", "the camera pushes in on the bed", { vol: 0.7 });
  add(m.hookQ, "tick", "the question mark pops");
  add(m.hookDim, "click-crack", "the screen goes dark", { vol: 0.6 });
  add(m.hookOpen, "pop", "the eyes open wide");
  P.tops.forEach((x, i) => { if (i >= P.tops.length - 2) add(x.a + 0.05, "swish-soft", `headline: ${x.headline}`, { vol: 0.7 }); });

  add(m.sting, "boing", "the mascot pops in");
  add(m.sting + 0.1, "jingle-sting", "Intip yuk!", { vol: 0.7 });
  add(m.sting + 0.27, "pop", "the Intip yuk! pill");
  add(m.stingEnd - 0.15, "swish", "the mascot leaves", { vol: 0.6 });

  add(m.lie, "swish-soft", "lying down", { vol: 0.8 });
  add(m.lie + 0.4, "glass-ting", "the screen lights up", { vol: 0.5 });
  add(m.tired, "slide-whistle-down", "the lids get heavy", { vol: 0.4 });
  add(m.scroll, "tick-soft", "scrolling", { vol: 0.9 });
  add(m.bubble, "pop", "the thought bubble pops up", { vol: 0.8 });
  add(m.notif, "blip-alert", "a notification", { vol: 0.6 });
  add(m.busy, "bubble-rise", "the mind stays busy", { vol: 0.6 });
  add(m.upset, "tick", "what the content brings", { vol: 0.7 });
  add(m.putDown, "thump", "the phone is put down", { vol: 0.5 });
  add(m.putDown + 0.25, "pop", "the eyes open wide", { vol: 0.7 });
  add(m.awake, "huh", "wide awake", { vol: 0.5 });

  add(m.tips, "swish", "the camera settles for the tips", { vol: 0.7 });
  P.tips.forEach((tp, i) => { add(tp.from, i ? "chime-bright" : "chime", `tip ${tp.n}`); add(tp.subAt, "tick", "the line under the tip"); });
  add(m.away, "whoosh", "the phone goes to another room", { vol: 0.6 });

  // B25: each insert's circle opens with a soft swish, and the notifications that fly in beside the phone each blip
  P.inserts.forEach((x) => add(x.from + 0.05, "swish-soft", `the picture cuts in: ${x.id}`, { vol: 0.6 }));
  P.toasts.slice(1).forEach((tt, i) => add(tt.from + 0.05, "blip-alert", `a notification ${i + 2}`, { vol: 0.45 }));

  // the loop-back has no jingle and no mascot sound: the bed runs on so the seam does not dip to silence
  P.labels.forEach((l) => add(l.from + 0.05, "tick", `label ${l.text}`, { vol: 0.8 }));
  P.steps.forEach((sd) => add(sd.from, "tick-soft", `step ${sd.n}`, { vol: 0.8 }));
  // thin the pairs of the same sound that land within 0.2 s of each other (the mixer's cooldowns would drop one anyway; this keeps the list honest)
  const kept: SfxEvent[] = [];
  for (const e of ev.sort((a, b) => a.t - b.t)) if (!kept.some((k) => k.name === e.name && Math.abs(k.t - e.t) < 0.2)) kept.push(e);
  return kept;
}
