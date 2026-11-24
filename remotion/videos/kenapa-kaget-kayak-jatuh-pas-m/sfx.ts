/* The sound of "Kenapa kaget kayak jatuh pas mau tidur", written by hand against the scenes: a sound on the frame of every headline, camera move, gauge, icon,
   bubble, zap, jolt, cup and card. Names only from the locked set (src/catalog.ts). */
import type { SfxEvent } from "../../src/sfx.ts";
import type { SfxName } from "../../src/catalog.ts";
import type { StoryT } from "../../src/schema.ts";
import { FPS } from "../../src/timeline.ts";
import { BUBBLE, CARDS, CUP, GAUGE, ICONS, JOLT, PILL, ZAP, makePlan } from "./plan.ts";

export const music = { track: "bed-wonder", level: 0.8 } as const;

export function sfx(story: StoryT): SfxEvent[] {
  const P = makePlan(story), m = P.m, ev: SfxEvent[] = [];
  const add = (t: number, name: SfxName, why: string, extra: Partial<SfxEvent> = {}) => ev.push({ t: Math.round(Math.max(0, t) * FPS) / FPS, name, vol: 1, why, ...extra });

  // the hook: the claim lands on frame 0, the brain pulses with a worried blip
  add(0.05, "thump", "the claim lands on frame 0", { vol: 0.6 });
  add(0.9, "key-blip", "the alarm blips", { vol: 0.45 });
  add(1.8, "tick-soft", "a second blip", { vol: 0.4 });
  // the sting (voice only: no mascot, no pill)
  add(m.sting, "jingle-sting", "Intip yuk!", { vol: 0.7 });
  add(m.stingEnd - 0.1, "swish", "the camera pulls back and the bedroom comes in", { vol: 0.5 });
  // rileks: the muscles let go
  add(P.starts[2] + 0.05, "whoosh-soft", "headline of rileks", { vol: 0.6 });
  add(GAUGE.a + 0.1, "pop-soft", "the gauge card pops in", { vol: 0.6 });
  add(5.7, "swoop", "the camera eases toward the blanket", { vol: 0.5 });
  add(7.2, "cloth-rustle", "the blanket settles", { vol: 0.35 });
  add(8.9, "slide-whistle-down", "the gauge sinks", { vol: 0.4 });
  add(10.0, "cloth-rustle", "the blanket sinks a little more", { vol: 0.3 });
  // umum: ten icons, seven with the jolt mark
  add(P.starts[3] + 0.05, "swish-soft", "headline of umum", { vol: 0.6 });
  add(ICONS.a - 0.2, "swish-down", "the camera eases right", { vol: 0.4 });
  for (let i = 0; i < 10; i++) add(ICONS.a + i * ICONS.step, i % 2 ? "tock" : "tick", `icon ${i + 1} pops in`, { vol: 0.35 });
  add(PILL.a, "marimba", "the 60-70 % pill", { vol: 0.9 });
  // dugaan: the brain reads the loss of tone as a fall
  add(P.starts[4] + 0.05, "whoosh-soft", "headline of dugaan", { vol: 0.6 });
  add(GAUGE.a2 + 0.1, "pop", "the gauge card returns", { vol: 0.6 });
  add(22.9, "slide-whistle-down", "the gauge drops fast", { vol: 0.6 });
  add(BUBBLE.a, "stamp", "the JATUH?! bubble lands", { vol: 0.8 });
  add(BUBBLE.a + 0.5, "key-blip", "alarm blip", { vol: 0.5 });
  add(ZAP.a, "click-crack", "the signal zaps down to the blanket", { vol: 0.9 });
  add(JOLT - 0.02, "boing", "the bed jolts", { vol: 0.9 });
  add(JOLT + 0.3, "fabric-flap", "the blanket flaps", { vol: 0.5 });
  // pemicu: a cup of coffee on the nightstand and two cards
  add(P.starts[5] + 0.05, "swish-soft", "headline of pemicu", { vol: 0.6 });
  add(CUP.a, "pop-wood", "the cup lands on the nightstand", { vol: 0.6 });
  add(CARDS[0].a + 0.02, "glass-ting", "the first tip card pops in", { vol: 0.9 });
  add(CARDS[1].a + 0.02, "bell-soft", "the second tip card pops in", { vol: 0.9 });
  add(CARDS[0].out, "pop-soft", "the cards leave", { vol: 0.5 });
  // the loop-back to the first shot
  add(37.0, "swish", "the camera eases back to the first shot", { vol: 0.5 });
  add(m.outro + 0.1, "jingle-outro", "loop-back jingle", { vol: 0.8 });
  return ev;
}
