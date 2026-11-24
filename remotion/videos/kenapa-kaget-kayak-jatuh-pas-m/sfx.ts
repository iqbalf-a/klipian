/* The sound of "Kenapa kaget kayak jatuh pas mau tidur", written by hand against the scenes: a sound on the frame of every headline, camera move, gauge, icon,
   bubble, zap, jolt, cup and card. Names only from the locked set (src/catalog.ts).
   B48 (ian, 2026-11-24: "ganti sfx agar unik"): every sound name here is one that NONE of the 10 most recent videos uses (checked against their sfx.ts), so no sound is
   shared with them. Only the fixed channel jingles (sting, outro) are the same by design. Each is picked for the picture: a knock and a doorbell for the hook's alarm,
   brake-squeal for the sinking gauge, alarm-ring for the "JATUH?!" bubble, a drum roll before the zap, a crackle for the zap, a toaster pop for the bed that hops up. */
import type { SfxEvent } from "../../src/sfx.ts";
import type { SfxName } from "../../src/catalog.ts";
import type { StoryT } from "../../src/schema.ts";
import { FPS } from "../../src/timeline.ts";
import { BUBBLE, CARDS, CUP, GAUGE, ICONS, JOLT, PILL, ZAP, makePlan } from "./plan.ts";

export const music = { track: "bed-wonder", level: 0.8 } as const;

export function sfx(story: StoryT): SfxEvent[] {
  const P = makePlan(story), m = P.m, ev: SfxEvent[] = [];
  const add = (t: number, name: SfxName, why: string, extra: Partial<SfxEvent> = {}) => ev.push({ t: Math.round(Math.max(0, t) * FPS) / FPS, name, vol: 1, why, ...extra });

  // the hook: the claim lands on frame 0 like a knock, the brain's alarm rings a doorbell
  add(0.05, "door-knock", "the claim lands on frame 0", { vol: 0.7 });
  add(1.0, "doorbell", "the brain's worry rings", { vol: 0.35 });
  // the sting (voice only: no mascot, no pill)
  add(m.sting, "jingle-sting", "Intip yuk!", { vol: 0.7 });
  add(m.stingEnd - 0.1, "drawer-slide", "the camera pulls back and the bedroom slides in", { vol: 0.5 });
  // rileks: the muscles let go
  add(P.starts[2] + 0.05, "scribble-pen", "headline of rileks", { vol: 0.4 });
  add(GAUGE.a + 0.1, "cork-pop", "the gauge card pops in", { vol: 0.5 });
  add(5.7, "leaf-rustle", "the camera eases toward the blanket", { vol: 0.3 });
  add(7.2, "door-creak", "the bed creaks as the sleeper settles", { vol: 0.25 });
  add(8.9, "brake-squeal", "the gauge sinks and slows", { vol: 0.3 });
  add(10.0, "door-creak", "the bed creaks a little more", { vol: 0.3 });
  // umum: ten icons, seven with the jolt mark
  add(P.starts[3] + 0.05, "paper-tear", "headline of umum", { vol: 0.4 });
  add(ICONS.a - 0.2, "drawer-slide", "the camera eases right", { vol: 0.3 });
  for (let i = 0; i < 10; i++) add(ICONS.a + i * ICONS.step, i % 2 ? "egg-crack" : "knife-chop", `icon ${i + 1} appears`, { vol: 0.25 });
  add(PILL.a, "microwave-ding", "the 60-70 % pill", { vol: 0.7 });
  // dugaan: the brain reads the loss of tone as a fall
  add(P.starts[4] + 0.05, "cork-pop", "headline of dugaan", { vol: 0.35 });
  add(GAUGE.a2 + 0.1, "chain-rattle", "the gauge card returns", { vol: 0.3 });
  add(22.9, "brake-squeal", "the muscle gauge drops to empty", { vol: 0.5 });
  add(BUBBLE.a, "alarm-ring", "the JATUH?! bubble rings", { vol: 0.55 });
  add(25.4, "drum-roll", "suspense before the signal", { vol: 0.5 });
  add(ZAP.a, "fire-crackle", "the signal crackles down to the blanket", { vol: 0.7 });
  add(JOLT - 0.02, "toaster-pop", "the bed pops up", { vol: 0.9 });
  add(JOLT + 0.3, "leaf-rustle", "the blanket flaps", { vol: 0.4 });
  // pemicu: a cup of coffee on the nightstand and two cards
  add(P.starts[5] + 0.05, "soda-fizz", "headline of pemicu", { vol: 0.35 });
  add(CUP.a, "gulp", "the cup lands on the nightstand", { vol: 0.5 });
  add(CARDS[0].a + 0.02, "anvil-ting", "the first tip card pops in", { vol: 0.7 });
  add(CARDS[1].a + 0.02, "clap-hands", "the second tip card pops in", { vol: 0.4 });
  add(CARDS[0].out, "paper-tear", "the cards leave", { vol: 0.3 });
  // the loop-back to the first shot
  add(37.0, "drawer-slide", "the camera eases back to the first shot", { vol: 0.35 });
  add(m.outro + 0.1, "jingle-outro", "loop-back jingle", { vol: 0.8 });
  return ev;
}
