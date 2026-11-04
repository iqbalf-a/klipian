/* The sound of "Pelangi sebenarnya berbentuk lingkaran": an effect on every object that enters, every camera move, label, card and state change, on the frame of its picture
   (the same moments as the picture, from plan.ts), about one event a second. Only names of the locked SFX set (src/catalog.ts). The mixer (sfx/mix.mjs) keeps it from getting
   busy: cooldowns, at most 3 one-shots at once, ducking under a voice. */
import type { SfxEvent } from "../../src/sfx.ts";
import type { SfxName } from "../../src/catalog.ts";
import type { StoryT } from "../../src/schema.ts";
import { FPS } from "../../src/timeline.ts";
import { makePlan } from "./plan.ts";

export function sfx(story: StoryT): SfxEvent[] {
  const P = makePlan(story), m = P.m, ev: SfxEvent[] = [];
  const add = (t: number, name: SfxName, why: string, extra: Partial<SfxEvent> = {}) => ev.push({ t: Math.round(Math.max(0, t) * FPS) / FPS, name, vol: 1, why, ...extra });

  // the hook: the establishing push to the ring, the first headline, the rain
  add(0, "whoosh", "the camera pushes in from the wide shot", { vol: 0.8 });
  add(0.1, "thump", "the first headline lands", { vol: 0.6 });
  add(0.3, "rain-patter", "rain under the cloud", { vol: 0.3 });
  add(1.7, "chime", "the rainbow ring shines", { vol: 0.6 });
  P.tops.forEach((x, i) => { if (i) add(x.a + 0.05, "swish-soft", `headline: ${x.headline}`, { vol: 0.7 }); });

  // the sting
  add(m.sting, "boing", "the mascot pops in");
  add(m.sting + 0.1, "jingle-sting", "Intip yuk!", { vol: 0.7 });
  add(m.sting + 0.27, "pop", "the Intip yuk! pill");
  add(m.stingEnd - 0.15, "swish", "the mascot leaves", { vol: 0.6 });

  // cahaya: the rays flash in the drops, the labels
  for (let i = 0; i < 4; i++) add(m.rays + i * 0.28, "tick", `a ray of sunlight reaches drop ${i + 1}`, { vol: 0.8 });
  add(m.rays + 1.5, "glass-ting", "the drops glint", { vol: 0.6 });
  add(m.lDrop + 0.05, "pop-soft", "label: tetes air");
  add(m.lSun + 0.05, "pop-soft", "label: sinar matahari");
  add(P.starts[2] + 6.4, "drip", "a drop falls", { vol: 0.5 });
  add(P.starts[2] + 8, "whoosh", "the camera pans down to the ring's centre", { vol: 0.5 });

  // pusat: the marker, the line from the sun, the 42 degree radius
  add(m.centre, "pop", "the centre marker appears");
  add(m.lOpp + 0.05, "pop-soft", "label: lawan matahari");
  add(m.centre + 0.3, "zip", "the dashed line from the sun", { vol: 0.6 });
  add(m.l42 - 0.4, "tick", "the 42 degree radius is drawn");
  add(m.l42 + 0.05, "pop-soft", "label: sudut 42");
  add(m.l42 + 2.4, "chime-bright", "the light returns at the strongest angle", { vol: 0.6 });
  add(P.starts[4] - 0.4, "swish", "the camera pans to the horizon", { vol: 0.6 });

  // tanah: the horizon hides the lower half
  add(m.ghost, "huh", "the hidden half shows faintly", { vol: 0.7 });
  add(m.lGround + 0.05, "pop-soft", "label: cakrawala");
  add(m.lHidden + 0.05, "pop-soft", "label: bagian tertutup");
  add(P.starts[4] + 3.2, "drip", "a drop falls", { vol: 0.5 });
  add(P.starts[4] + 5.6, "tick-soft", "the ghost ring pulses", { vol: 0.6 });
  add(P.starts[4] + 8, "rain-patter", "the rain goes on", { vol: 0.3 });

  // pesawat: the aircraft climbs, the ground sinks away, the whole ring shows
  add(31.0, "whoosh", "the aircraft comes in", { vol: 0.7 });
  add(m.plane, "pop", "the aircraft appears");
  add(m.plane + 0.1, "hum", "the aircraft's engine", { dur: 14, vol: 0.5 });
  add(32.2, "slide-whistle-down", "the ground sinks away", { vol: 0.5 });
  add(m.lShadow + 0.05, "pop-soft", "label: bayangan pesawat");
  add(36.4, "chime-bright", "the whole ring shows", { vol: 0.8 });
  add(m.lCircle + 0.05, "pop-soft", "label: lingkaran penuh");
  add(38.4, "glass-ting", "the ring gleams", { vol: 0.5 });

  // hasil: the stamp
  add(P.starts[6] + 0.1, "swish", "the result's camera", { vol: 0.5 });
  add(m.verdict, "pop", "the FAKTA stamp");
  add(m.verdict + 0.05, "thump", "the stamp lands", { vol: 0.6 });
  add(P.starts[6] + 4.6, "tick", "the ring pulses once more", { vol: 0.6 });

  // tips: two cards
  add(P.starts[7] - 0.1, "zoom-whoosh", "the set drops to make room for the cards", { vol: 0.4 });
  add(m.tip1, "pop", "tip 1");
  add(m.tip1 + 0.9, "tick-soft", "tip 1's line");
  add(m.tip2, "pop", "tip 2");
  add(m.tip2 + 0.9, "tick-soft", "tip 2's line");
  add(P.starts[7] + 7.2, "drip", "a drop falls", { vol: 0.5 });

  // the loop-back
  add(m.outro - 0.2, "swish", "the camera eases back to the wide shot", { vol: 0.6 });
  add(m.outro + 0.2, "jingle-outro", "the loop-back", { vol: 0.7 });
  add(m.outro + 1.4, "rain-patter", "rain again, as at the start", { vol: 0.3 });
  add(m.outro + 2.6, "chime", "the ring shines as in the hook", { vol: 0.5 });
  return ev.sort((a, b) => a.t - b.t);
}
