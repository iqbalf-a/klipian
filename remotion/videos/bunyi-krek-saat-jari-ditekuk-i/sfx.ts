/* The sound of "Bunyi krek jari: bukan tulang patah", written by hand against the scenes: a sound on the frame of every headline, camera move, window, label, arrow,
   the gauge, the gas dots, the crack, the tip cards and the loop-back. Names only from the locked set (src/catalog.ts). */
import type { SfxEvent } from "../../src/sfx.ts";
import type { SfxName } from "../../src/catalog.ts";
import type { StoryT } from "../../src/schema.ts";
import { FPS } from "../../src/timeline.ts";
import { CARDS, CRACK, GATHER, LABELS, PULL, makePlan } from "./plan.ts";

export const music = { track: "bed-clockwork", level: 0.8 } as const;

export function sfx(story: StoryT): SfxEvent[] {
  const P = makePlan(story), m = P.m, ev: SfxEvent[] = [];
  const add = (t: number, name: SfxName, why: string, extra: Partial<SfxEvent> = {}) => ev.push({ t: Math.round(Math.max(0, t) * FPS) / FPS, name, vol: 1, why, ...extra });

  // the hook: the claim is on the screen, a knuckle clicks as the hint of the sound arcs pulses
  add(0.05, "thump", "the claim lands on frame 0", { vol: 0.6 });
  add(0.7, "finger-snap", "a knuckle clicks", { vol: 0.5 });
  add(1.7, "wood-crack", "another click", { vol: 0.4 });
  // the sting (voice only: no mascot, no pill)
  add(m.sting, "jingle-sting", "Intip yuk!", { vol: 0.7 });
  add(m.stingEnd - 0.1, "swish", "the camera pulls back and the piano comes in", { vol: 0.5 });
  // cairan: the window opens on the middle joint
  add(P.starts[2] + 0.05, "whoosh-soft", "headline of cairan", { vol: 0.6 });
  add(4.95, "zoom-whoosh", "the camera dives to the joint", { vol: 0.6 });
  add(5.65, "pop", "the window opens on the joint");
  add(LABELS[0].from + 0.05, "tick", "label tulang", { vol: 0.7 });
  add(LABELS[1].from + 0.05, "click-soft", "label cairan sendi", { vol: 0.7 });
  add(8.6, "water-pour", "the fluid shimmers", { vol: 0.25 });
  add(10.5, "swoop", "the camera eases out to the pulled finger", { vol: 0.6 });
  // tarik: the finger is pulled, the surfaces hold, then let go all at once
  add(P.starts[3] + 0.05, "swish-soft", "headline of tarik", { vol: 0.6 });
  add(LABELS[2].from + 0.05, "tock", "label ditarik", { vol: 0.7 });
  add(PULL.a + 0.3, "pop-wood", "the pull arrow draws", { vol: 0.6 });
  add(13.4, "squeak", "the surfaces cling", { vol: 0.35 });
  add(15.0, "squeak", "the pull builds", { vol: 0.4 });
  add(16.75, "boing", "the surfaces let go", { vol: 0.8 });
  add(LABELS[3].from + 0.05, "slide-whistle-down", "label tekanan turun, the pressure falls", { vol: 0.5 });
  add(19.4, "swish-down", "the camera goes back in", { vol: 0.5 });
  // rongga: the gas gathers, the cavity opens on the crack
  add(P.starts[4] + 0.05, "whoosh-soft", "headline of rongga", { vol: 0.6 });
  add(GATHER.a, "bubble-rise", "gas comes out of the fluid", { vol: 0.5 });
  add(23.7, "key-blip", "the dots gather", { vol: 0.35 });
  add(25.1, "tick-soft", "the dots meet", { vol: 0.4 });
  add(CRACK - 0.02, "click-crack", "the crack: the cavity opens", { vol: 1 });
  add(CRACK + 0.05, "bubble-pop", "the cavity", { vol: 0.5 });
  add(LABELS[4].from + 0.05, "glass-ting", "label rongga gas", { vol: 0.6 });
  add(28.0, "pop-soft", "the window closes", { vol: 0.6 });
  // tips: two cards and the finger back at rest
  add(28.6, "swish-soft", "the camera pulls back to the finger", { vol: 0.5 });
  add(P.starts[5] + 0.05, "whoosh-soft", "headline of tips", { vol: 0.6 });
  add(CARDS[0].a + 0.02, "marimba", "the first tip card pops in");
  add(CARDS[1].a + 0.02, "bell-soft", "the second tip card pops in", { vol: 0.9 });
  add(CARDS[0].out, "pop-soft", "the cards leave", { vol: 0.5 });
  // the loop-back to the first shot
  add(37.6, "swish", "the camera eases back to the first shot", { vol: 0.5 });
  add(m.outro + 0.1, "jingle-outro", "loop-back jingle", { vol: 0.8 });
  return ev;
}
