/* The sound of "Kenapa kita cegukan?", written by hand against the scenes: a sound on the frame of every label, camera move, nerve signal, the diaphragm's
   drop, the air in the windpipe, the voice box shutting, the food and the fizz, the card, the counter. Names only from the locked set (src/catalog.ts). */
import type { SfxEvent } from "../../src/sfx.ts";
import type { SfxName } from "../../src/catalog.ts";
import type { StoryT } from "../../src/schema.ts";
import { FPS } from "../../src/timeline.ts";
import { AIR_BUBBLE, CARD, CAM_KEYS, CHUNKS, FIZZ, HICS, HIK_AT, LABELS, SIGNALS, TWITCH, makePlan } from "./plan.ts";

export const music = { track: "bed-glow", level: 0.8 } as const;

export function sfx(story: StoryT): SfxEvent[] {
  const P = makePlan(story), m = P.m, ev: SfxEvent[] = [];
  const add = (t: number, name: SfxName, why: string, extra: Partial<SfxEvent> = {}) => ev.push({ t: Math.round(Math.max(0, t) * FPS) / FPS, name, vol: 1, why, ...extra });

  // the hook: the wide shot, the push, the first words
  add(0.05, "thump", "the first headline lands", { vol: 0.6 });
  add(1.5, "whoosh", "the establishing push to the diaphragm", { vol: 0.8 });
  // the sting
  add(m.sting, "boing", "the mascot pops in");
  add(m.sting + 0.1, "jingle-sting", "Intip yuk!", { vol: 0.7 });
  add(m.sting + 0.27, "pop", "the Intip yuk! pill");
  add(m.stingEnd - 0.15, "swish", "the mascot leaves", { vol: 0.6 });
  // a new headline at the start of every explain beat
  P.starts.forEach((s, i) => { if (i >= 2 && i < story.beats.length - 1) add(s + 0.05, "swish-soft", `headline of ${story.beats[i].id}`, { vol: 0.7 }); });
  // the camera pans (between two keys at different places)
  for (let i = 1; i < CAM_KEYS.length; i++) {
    const a = CAM_KEYS[i - 1], b = CAM_KEYS[i], far = Math.hypot(b.c.x - a.c.x, b.c.y - a.c.y) > 260 && b.t - a.t < 2.6;
    if (far && a.t > 3) add(a.t + 0.05, "swish", `camera pans to ${Math.round(b.c.y)}`, { vol: 0.7 });
  }
  add(58.4 - 1.0, "swish-soft", "the camera eases back to the wide shot", { vol: 0.6 });
  // the labels
  for (const l of LABELS) add(l.from + 0.05, "tick", `label "${l.text}"`);
  // the nerve signals and the twitch
  for (const s of SIGNALS) { add(s.a, "zip", s.up ? "a signal runs up the vagus nerve" : "a signal runs down the nerves", { vol: 0.8 });  }
  add(TWITCH.a, "rattle", "the diaphragm twitches", { vol: 0.7 });
  add(TWITCH.a + 0.1, "glass-ting", "the diaphragm lights up", { vol: 0.5 });
  // each hiccup: the drop, the air, the shut, the HIK
  HICS.forEach((h, i) => {
    add(h.drop, "thump", `hiccup ${i + 1}: the diaphragm drops`);
    add(h.drop + 0.3, "whoosh", `hiccup ${i + 1}: air rushes down the windpipe`, { vol: 0.7 });
    add(h.shut, "click-crack", `hiccup ${i + 1}: the voice box shuts`);
    add(h.shut + h.hold, "slide-whistle-down", `hiccup ${i + 1}: the diaphragm relaxes`, { vol: 0.4 });
  });
  for (const a of HIK_AT) { add(a, "pop", "HIK! bursts"); add(a + 0.15, "huh", "the hik sounds", { vol: 0.6 }); }
  // food, fizz and the swallowed air
  CHUNKS.forEach((c, i) => add(c, "tick-soft", `food chunk ${i + 1} falls`, { vol: 0.8 }));
  add(FIZZ.a, "bubble-rise", "the fizz starts in the stomach", { vol: 0.7 });
  add(FIZZ.a + 1.4, "bubble-rise", "more fizz", { vol: 0.5 });
  add(AIR_BUBBLE.grow, "puff", "the swallowed air bubble grows", { vol: 0.8 });
  add(AIR_BUBBLE.full, "squeak", "the stomach is full of air", { vol: 0.5 });
  // the reflex in order, in the akhir beat
  add(39.4, "whoosh", "the camera pulls back", { vol: 0.6 });
  add(40.2, "blip-alert", "the nerves are irritated", { vol: 0.5 });
  // the 35 ms card
  add(CARD.a, "pop-soft", "the 35 ms card pops in");
  for (let k = 0; k < 3; k++) add(CARD.count + k * 0.3, "tick-soft", "the counter rolls", { vol: 0.5 });
  add(CARD.count + 1.1, "chime", "the counter reaches 35", { vol: 0.6 });
  // the loop-back
  add(m.outro + 0.1, "jingle-outro", "loop-back jingle", { vol: 0.8 });
  return ev;
}
