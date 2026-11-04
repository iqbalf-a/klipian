/* The sound of "Kenapa baterai HP cepat habis saat dingin?": a sound on every object that enters, camera move, label, card, state change and alive action, on the frame of its
   picture (the same moments as plan.ts), about one event a second, and a thin music bed. Only the approved sounds (B15) are used; none is new. The mixer (sfx/mix.mjs) keeps it from
   getting busy: cooldowns, at most 3 one-shots at once, ducking under a voice. */
import type { SfxEvent } from "../../src/sfx.ts";
import type { SfxName } from "../../src/catalog.ts";
import type { StoryT } from "../../src/schema.ts";
import { FPS } from "../../src/timeline.ts";
import { makePlan } from "./plan.ts";

/** The bed under it all (render.mjs uses it when the story names none). */
export const music = { track: "bed-curious", level: 0.8 } as const;

export function sfx(story: StoryT): SfxEvent[] {
  const P = makePlan(story), m = P.m, ev: SfxEvent[] = [];
  const add = (t: number, name: SfxName, why: string, extra: Partial<SfxEvent> = {}) => ev.push({ t: Math.round(Math.max(0, t) * FPS) / FPS, name, vol: 1, why, ...extra });

  // the hook: the wide shot of the snowy park, the headline, the push, the battery bar that drops
  add(0, "whoosh", "the wide shot of the snowy park opens", { vol: 0.6 });
  add(0.2, "thump", "the first headline lands", { vol: 0.5 });
  add(0.9, "tick-soft", "the first snow lands on the bench", { vol: 0.6 });
  add(m.push, "zoom-whoosh", "the establishing push to the phone", { vol: 0.7 });
  add(m.push + 0.3, "slide-whistle-down", "the battery bar drops", { vol: 0.5 });
  add(m.push + 1.3, "blip-alert", "the bar is nearly empty", { vol: 0.5 });

  add(m.sting, "boing", "the mascot pops in");
  add(m.sting + 0.1, "jingle-sting", "Intip yuk!", { vol: 0.7 });
  add(m.sting + 0.27, "pop", "the Intip yuk! pill");
  add(m.stingEnd - 0.15, "swish", "the mascot leaves", { vol: 0.6 });

  // each insert's circle opens with a swish; what happens inside it gets its own sound
  P.inserts.forEach((x) => add(x.from + 0.02, "swish-soft", `the picture cuts in: ${x.id}`, { vol: 0.6 }));
  add(m.kerja + 0.1, "swish-soft", "the headline: ion litium", { vol: 0.5 });
  add(m.kerja + 0.8, "pop-soft", "the battery pops in", { vol: 0.7 });
  add(m.kerja + 1.6, "tick-soft", "the first ions run", { vol: 0.6 });
  add(m.kerja + 3.4, "hum", "the ions flow through the electrolyte", { vol: 0.35, dur: 2.6 });
  add(m.kerja + 5.4, "tick", "the flow goes on", { vol: 0.5 });

  add(m.dalam + 0.1, "glass-ting", "the look inside the cold battery", { vol: 0.6 });
  add(m.dalam + 0.9, "pop", "the snowflakes drift in", { vol: 0.5 });
  add(m.dalam + 1.8, "squeak", "the resistance walls rise", { vol: 0.6 });
  add(m.dalam + 3.0, "rattle", "the ions jam against the walls", { vol: 0.45 });
  add(m.dalam + 5.0, "slide-whistle-down", "the ions slow down", { vol: 0.4 });
  add(m.dalam + 6.6, "tick-soft", "the label: hambatan naik", { vol: 0.6 });

  add(m.tegangan + 0.3, "whoosh", "the two meters rise in", { vol: 0.5 });
  add(m.tegangan + 1.2, "pop", "the voltage arrow drops", { vol: 0.6 });
  add(m.tegangan + 2.2, "slide-whistle-down", "the voltage falls", { vol: 0.5 });
  add(m.tegangan + 3.6, "tick", "the current falls too", { vol: 0.6 });
  add(m.tegangan + 5.2, "blip-alert", "less current can be taken", { vol: 0.5 });
  add(m.tegangan + 6.6, "tick-soft", "the meters hold", { vol: 0.5 });

  add(m.cas + 0.3, "click-crack", "the frozen plate", { vol: 0.6 });
  add(m.cas + 1.2, "tick-soft", "the first lithium spike", { vol: 0.6 });
  add(m.cas + 2.4, "rattle", "the spikes grow", { vol: 0.5 });
  add(m.cas + 3.6, "blip-alert", "the warning sign pulses", { vol: 0.7 });
  add(m.cas + 5.0, "huh", "it is dangerous", { vol: 0.5 });
  add(m.cas + 6.4, "tick", "the label: litium menempel", { vol: 0.6 });

  add(m.hasil, "swish", "back to the phone on the bench", { vol: 0.7 });
  add(m.hasil + 1.2, "slide-whistle-down", "the bar creeps down", { vol: 0.4 });
  add(m.hasil + 3.0, "tick-soft", "snow keeps falling", { vol: 0.5 });
  add(m.react, "huh", "the mascot is surprised", { vol: 0.5 });
  add(m.react + 0.1, "boing", "the mascot pops", { vol: 0.5 });

  add(m.tips, "swish", "the camera settles for the tips", { vol: 0.7 });
  P.tips.forEach((tp, i) => add(tp.from, i ? "chime-bright" : "chime", `tip ${tp.n}`));
  add(m.tip1 + 1.0, "whoosh", "the phone is kept warm", { vol: 0.4 });
  add(m.tip1 + 2.4, "tick-soft", "the bar climbs", { vol: 0.5 });
  add(m.tip2 + 1.0, "tick", "wait until it is warm", { vol: 0.5 });
  add(m.tip2 + 3.0, "pop-soft", "the cold lets go", { vol: 0.5 });
  add(m.outro, "swish-soft", "the camera eases back to the wide shot", { vol: 0.4 });
  add(m.outro + 1.4, "thump", "the seam: the snowy park again", { vol: 0.4 });

  P.labels.forEach((l) => add(l.from + 0.05, l.color === "red" ? "blip-alert" : "tick", `label ${l.text}`, { vol: 0.8 }));
  const kept: SfxEvent[] = [];
  for (const e of ev.sort((a, b) => a.t - b.t)) if (!kept.some((k) => k.name === e.name && Math.abs(k.t - e.t) < 0.2)) kept.push(e);
  return kept;
}
