/* The sound of "Hujan buatan: benarkah hujan bisa dipesan?": an effect on nearly every movement, on the frame of its picture (the same moments as the picture, from
   plan.ts), and a thin music bed. The mixer (sfx/mix.mjs) keeps it from getting busy: cooldowns, at most 3 one-shots at once, ducking under a voice.
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

  add(0, "whoosh", "the camera pushes in on the stage", { vol: 0.8 });
  add(m.hookQ, "tick", "the question mark pops");
  add(m.hookLabel, "rain-patter", "hujan turun?", { vol: 0.7 });
  P.tops.forEach((x, i) => { if (i >= P.tops.length - 2) add(x.a + 0.05, "swish-soft", `headline: ${x.headline}`, { vol: 0.7 }); });

  add(m.sting, "boing", "the mascot pops in");
  add(m.sting + 0.1, "jingle-sting", "Intip yuk!", { vol: 0.7 });
  add(m.sting + 0.27, "pop", "the Intip yuk! pill");
  add(m.stingEnd - 0.15, "swish", "the mascot leaves", { vol: 0.6 });

  add(m.plane, "whoosh", "the seeding aircraft flies in", { vol: 0.6 });
  [0.5, 0.8, 1.1, 1.4].forEach((d, i) => add(m.plane + d + 0.4, "pop-soft", "grains leave the rack", { vol: 0.7 - i * 0.1 }));
  add(m.ground, "puff", "grains rise from the ground", { vol: 0.6 });
  add(m.ground + 0.25, "zip", "they climb to the cloud", { vol: 0.5 });

  add(m.magnifier, "glass-ting", "the magnifier comes over the cloud");
  add(m.through, "zoom-whoosh", "the camera goes through the lens");
  add(m.inside, "glass-ting", "inside the cloud", { vol: 0.6 });
  add(m.pull, "bubble-rise", "vapour is drawn to the salt", { vol: 0.7 });
  add(m.agi, "chime", "the silver iodide crystal", { vol: 0.6 });
  add(m.stick, "drip", "a drop sticks to the grain", { vol: 0.8 });
  add(m.big, "bubble-rise", "the drop swells", { vol: 0.8 });
  add(m.fall, "slide-whistle-down", "the heavy drop falls", { vol: 0.5 });
  add(m.exit, "zoom-whoosh", "back out of the cloud", { vol: 0.8 });

  for (let d = 0, i = 0; m.rainOn + d < m.rainOff + 0.4; d += 0.9, i++) add(m.rainOn + d, "rain-patter", "rain falls", { vol: Math.max(0.3, 0.8 - i * 0.12) });
  add(m.verdict, "pop", "the SEBAGIAN stamp");

  add(m.tips, "swish", "the camera settles for the tips", { vol: 0.7 });
  P.tips.forEach((tp, i) => { add(tp.from, i ? "chime-bright" : "chime", `tip ${tp.n}`); add(tp.subAt, "tick", "the line under the tip"); });

  // the loop-back has no jingle and no mascot sound: the bed runs on so the seam does not dip to silence
  P.labels.forEach((l) => add(l.from + 0.05, "tick", `label ${l.text}`, { vol: 0.8 }));
  // thin the pairs of the same sound that land within 0.2 s of each other (the mixer's cooldowns would drop one anyway; this keeps the list honest)
  const kept: SfxEvent[] = [];
  for (const e of ev.sort((a, b) => a.t - b.t)) if (!kept.some((k) => k.name === e.name && Math.abs(k.t - e.t) < 0.2)) kept.push(e);
  return kept;
}
