/* The sound of "Charger nyolok tanpa HP", written by hand against the scenes: a sound on the frame of the hook, the lamp, the camera moves, the lens, the labels, the
   cards, the switch and the loop-back. Names only from the locked set (src/catalog.ts). */
import type { SfxEvent } from "../../src/sfx.ts";
import type { SfxName } from "../../src/catalog.ts";
import type { StoryT } from "../../src/schema.ts";
import { FPS } from "../../src/timeline.ts";
import { CARDS, LABELS, LENS, SWITCH, makePlan } from "./plan.ts";

export const music = { track: "bed-neon", level: 0.8 } as const;

export function sfx(story: StoryT): SfxEvent[] {
  const P = makePlan(story), m = P.m, ev: SfxEvent[] = [];
  const add = (t: number, name: SfxName, why: string, extra: Partial<SfxEvent> = {}) => ev.push({ t: Math.round(Math.max(0, t) * FPS) / FPS, name, vol: 1, why, ...extra });
  // the hook: the claim is on the screen, the lamp pulses
  add(0.05, "thump", "the claim lands on frame 0", { vol: 0.6 });
  add(1.1, "hum", "the charger hums", { vol: 0.3 });
  add(1.9, "tick-soft", "the lamp on the strip", { vol: 0.5 });
  // the sting (voice only)
  add(m.sting, "jingle-sting", "Intip yuk!", { vol: 0.7 });
  add(m.stingEnd - 0.2, "zoom-whoosh", "the camera pulls back from the charger", { vol: 0.6 });
  add(4.0, "pop-soft", "the desk and the wall come in", { vol: 0.5 });
  // tanya
  add(P.starts[2] + 0.05, "whoosh-soft", "headline of tanya", { vol: 0.6 });
  add(LABELS[0].from + 0.05, "tick", "label tanpa HP", { vol: 0.7 });
  add(6.2, "click-soft", "the cord's current runs", { vol: 0.45 });
  add(7.15, "tick-soft", "the lamp pulses", { vol: 0.35 });
  add(8.6, "tock", "the question holds", { vol: 0.4 });
  // dalam: the lens
  add(9.2, "swoop", "the camera pushes to the charger", { vol: 0.6 });
  add(LENS.open + 0.05, "pop", "the lens opens", { vol: 0.9 });
  add(P.starts[3] + 0.05, "whoosh-soft", "headline of dalam", { vol: 0.6 });
  add(LABELS[1].from + 0.05, "tick", "label trafo", { vol: 0.7 });
  add(12.2, "hum", "the transformer hums", { vol: 0.35 });
  add(13.4, "key-blip", "a thin current runs", { vol: 0.45 });
  add(LABELS[2].from + 0.05, "click-soft", "label rangkaian", { vol: 0.7 });
  add(15.8, "tick-soft", "the circuit waits", { vol: 0.4 });
  add(17.0, "blip-alert", "nothing goes out to the port", { vol: 0.35 });
  add(LENS.close + 0.05, "pop-soft", "the lens shuts", { vol: 0.7 });
  // bukti
  add(P.starts[4] + 0.05, "swish-soft", "headline of bukti", { vol: 0.6 });
  add(19.7, "swish", "down the cable", { vol: 0.6 });
  add(21.4, "tock", "label from the socket", { vol: 0.6 });
  add(LABELS[3].from + 0.05, "tick", "label stopkontak", { vol: 0.7 });
  add(22.6, "slide-whistle-down", "no phone to charge", { vol: 0.4 });
  add(24.6, "swoop", "back to the charger", { vol: 0.5 });
  // jawab: the answer
  add(P.starts[5] + 0.05, "whoosh-soft", "headline of jawab", { vol: 0.6 });
  add(CARDS[0].a + 0.02, "chime", "the modern number lands", { vol: 0.8 });
  add(CARDS[1].a + 0.02, "pop-wood", "the old number lands", { vol: 0.8 });
  add(29.8, "hum", "it keeps running", { vol: 0.35 });
  // tips
  add(P.starts[6] + 0.05, "swish-soft", "headline of tips", { vol: 0.6 });
  add(CARDS[2].a + 0.02, "pop", "the first tip card pops in");
  add(CARDS[3].a + 0.02, "pop-wood", "the second tip card pops in", { vol: 0.9 });
  add(SWITCH.off, "switch", "the strip's switch goes off");
  add(SWITCH.off + 0.4, "slide-whistle-down", "the charger falls asleep", { vol: 0.45 });
  add(CARDS[0].out + 0.2, "pop-soft", "the cards leave", { vol: 0.5 });
  // the loop-back to the first shot
  add(36.6, "swish-soft", "the camera eases back to the big charger", { vol: 0.5 });
  add(SWITCH.on, "switch", "the switch is back on", { vol: 0.6 });
  add(37.7, "tick-soft", "the lamp is lit again", { vol: 0.4 });
  add(m.outro + 0.1, "jingle-outro", "loop-back jingle", { vol: 0.8 });
  return ev.sort((a, b) => a.t - b.t);
}
