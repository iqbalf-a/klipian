/* The sound of "Kenapa kaget kayak jatuh pas mau tidur", written by hand against the scenes: a sound on the frame of every headline, camera move, gauge, icon,
   bubble, zap, jolt, cup and card. Names only from the locked set (src/catalog.ts).
   B48 (ian, 2026-11-24: "10 video terakhir gunakan aset yang berbeda"): no sound name here is one of the stock UI sounds the last 10 videos share (whoosh-soft, swish,
   swish-soft, pop, pop-soft, tick, tick-soft, tock, click-soft, thump, pop-wood, swoop, zoom-whoosh, slide-whistle-down, boing, key-blip, glass-ting, bell-soft...).
   Each name is in at most 1 of those 10 videos (most in none), picked for the picture: a heartbeat for the worried brain, a low-battery for the muscle gauge,
   an alarm for the "JATUH?!" bubble, a drum roll before the zap, a toaster pop for the bed that hops up. The fixed channel jingles (sting, outro) stay. */
import type { SfxEvent } from "../../src/sfx.ts";
import type { SfxName } from "../../src/catalog.ts";
import type { StoryT } from "../../src/schema.ts";
import { FPS } from "../../src/timeline.ts";
import { BUBBLE, CARDS, CUP, GAUGE, ICONS, JOLT, PILL, ZAP, makePlan } from "./plan.ts";

export const music = { track: "bed-wonder", level: 0.8 } as const;

export function sfx(story: StoryT): SfxEvent[] {
  const P = makePlan(story), m = P.m, ev: SfxEvent[] = [];
  const add = (t: number, name: SfxName, why: string, extra: Partial<SfxEvent> = {}) => ev.push({ t: Math.round(Math.max(0, t) * FPS) / FPS, name, vol: 1, why, ...extra });

  // the hook: the claim lands on frame 0 with a heartbeat, the brain's worry blips twice
  add(0.05, "heartbeat", "the claim lands on frame 0", { vol: 0.8 });
  add(1.0, "heartbeat", "the worried brain beats again", { vol: 0.55 });
  add(1.95, "countdown-beep", "a single worried beep", { vol: 0.35 });
  // the sting (voice only: no mascot, no pill)
  add(m.sting, "jingle-sting", "Intip yuk!", { vol: 0.7 });
  add(m.stingEnd - 0.1, "swipe", "the camera pulls back and the bedroom comes in", { vol: 0.5 });
  // rileks: the muscles let go
  add(P.starts[2] + 0.05, "drawer-slide", "headline of rileks", { vol: 0.5 });
  add(GAUGE.a + 0.1, "power-up", "the gauge card switches on", { vol: 0.5 });
  add(5.7, "wind-gust", "the camera eases toward the blanket", { vol: 0.3 });
  add(7.2, "leaf-rustle", "the blanket settles", { vol: 0.35 });
  add(8.9, "power-down", "the gauge sinks", { vol: 0.45 });
  add(10.0, "door-creak", "the bed creaks as the sleeper sinks", { vol: 0.3 });
  // umum: ten icons, seven with the jolt mark
  add(P.starts[3] + 0.05, "zipper-pull", "headline of umum", { vol: 0.45 });
  add(ICONS.a - 0.2, "wind-gust", "the camera eases right", { vol: 0.3 });
  for (let i = 0; i < 10; i++) add(ICONS.a + i * ICONS.step, i % 2 ? "can-tap" : "typing", `icon ${i + 1} appears`, { vol: 0.3 });
  add(PILL.a, "microwave-ding", "the 60-70 % pill", { vol: 0.7 });
  // dugaan: the brain reads the loss of tone as a fall
  add(P.starts[4] + 0.05, "page-flip", "headline of dugaan", { vol: 0.5 });
  add(GAUGE.a2 + 0.1, "power-up", "the gauge card returns", { vol: 0.4 });
  add(22.9, "low-battery", "the muscle gauge drops to empty", { vol: 0.6 });
  add(BUBBLE.a, "alarm-ring", "the JATUH?! bubble rings", { vol: 0.55 });
  add(25.4, "drum-roll", "suspense before the signal", { vol: 0.5 });
  add(ZAP.a, "static-burst", "the signal zaps down to the blanket", { vol: 0.8 });
  add(JOLT - 0.02, "toaster-pop", "the bed pops up", { vol: 0.9 });
  add(JOLT + 0.3, "fabric-flap", "the blanket flaps", { vol: 0.5 });
  // pemicu: a cup of coffee on the nightstand and two cards
  add(P.starts[5] + 0.05, "velcro-rip", "headline of pemicu", { vol: 0.4 });
  add(CUP.a, "glass-clink", "the cup lands on the nightstand", { vol: 0.6 });
  add(CARDS[0].a + 0.02, "coin", "the first tip card pops in", { vol: 0.8 });
  add(CARDS[1].a + 0.02, "anvil-ting", "the second tip card pops in", { vol: 0.7 });
  add(CARDS[0].out, "puff", "the cards leave", { vol: 0.5 });
  // the loop-back to the first shot
  add(37.0, "wind-gust", "the camera eases back to the first shot", { vol: 0.35 });
  add(m.outro + 0.1, "jingle-outro", "loop-back jingle", { vol: 0.8 });
  return ev;
}
