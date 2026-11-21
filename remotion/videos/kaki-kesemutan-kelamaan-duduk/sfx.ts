/* The sound of "Kesemutan? Sarafmu kejepit", written by hand against the scenes: a sound on the frame of every headline, camera move, window, label, arrow,
   the pinch, the release, the needles, the tip cards, the wiggle and the loop-back. Names only from the locked set (src/catalog.ts). */
import type { SfxEvent } from "../../src/sfx.ts";
import type { SfxName } from "../../src/catalog.ts";
import type { StoryT } from "../../src/schema.ts";
import { FPS } from "../../src/timeline.ts";
import { CARDS, FIRE, LABELS, WEIGHT, WIGGLE, makePlan } from "./plan.ts";

export const music = { track: "bed-sunny", level: 0.8 } as const;

export function sfx(story: StoryT): SfxEvent[] {
  const P = makePlan(story), m = P.m, ev: SfxEvent[] = [];
  const add = (t: number, name: SfxName, why: string, extra: Partial<SfxEvent> = {}) => ev.push({ t: Math.round(Math.max(0, t) * FPS) / FPS, name, vol: 1, why, ...extra });

  // the hook: the claim is already on the screen, the needles flicker at the foot
  add(0.05, "thump", "the claim lands on frame 0", { vol: 0.6 });
  add(0.6, "key-blip", "the first needles flicker", { vol: 0.5 });
  add(1.3, "tick", "needles at the foot", { vol: 0.5 });
  add(2.1, "click-soft", "needles again", { vol: 0.5 });
  // the sting (voice only: no mascot, no pill)
  add(m.sting, "jingle-sting", "Intip yuk!", { vol: 0.7 });
  add(m.stingEnd - 0.1, "zoom-whoosh", "the camera dives to the thigh", { vol: 0.6 });
  // saraf: the window opens on the nerve and the vessel
  add(P.starts[2] + 0.05, "whoosh-soft", "headline of saraf", { vol: 0.6 });
  add(4.95, "pop", "the window opens on the thigh");
  add(LABELS[0].from + 0.05, "tick", "label saraf", { vol: 0.7 });
  add(LABELS[1].from + 0.05, "click-soft", "label pembuluh darah", { vol: 0.7 });
  add(7.0, "chime", "a signal runs to the brain", { vol: 0.5 });
  add(7.9, "tick-soft", "the next signal", { vol: 0.5 });
  add(8.8, "hum", "the nerve is alive", { vol: 0.35 });
  add(9.45, "pop-soft", "the window closes", { vol: 0.6 });
  // duduk: the weight comes down on the thigh
  add(9.8, "swish", "the camera pulls back to the whole leg", { vol: 0.6 });
  add(P.starts[3] + 0.05, "whoosh-soft", "headline of duduk", { vol: 0.6 });
  add(LABELS[2].from + 0.05, "tock", "label berat badan", { vol: 0.7 });
  [0, 1, 2].forEach((i) => add(WEIGHT.a + 0.3 + i * 0.25 + 0.4, i === 2 ? "thump" : "pop-wood", `the weight arrow ${i + 1} lands`, { vol: 0.55 }));
  add(14.6, "slide-whistle-down", "the foot goes thick", { vol: 0.5 });
  add(16.4, "huh", "something is off", { vol: 0.4 });
  add(17.9, "swoop", "the camera drops to the foot", { vol: 0.6 });
  // berdiri: the thigh lifts and the foot fills with needles
  add(P.starts[4] + 0.05, "swish-soft", "headline of berdiri", { vol: 0.6 });
  add(19.5, "boing", "the thigh lifts off the seat");
  add(19.9, "blip-alert", "the needles start", { vol: 0.55 });
  const nn: SfxName[] = ["key-blip", "tick-soft", "tock", "click-soft", "tick", "key-blip"];
  nn.forEach((n, i) => add(20.6 + i * 0.75, n, `needles ${i + 1}`, { vol: 0.5 }));
  add(25.1, "swish-down", "the leg sits down again", { vol: 0.6 });
  add(25.8, "thump", "the thigh lands on the seat", { vol: 0.55 });
  // jepit: the window again, the pinch, the release
  add(P.starts[5] + 0.05, "whoosh-soft", "headline of jepit", { vol: 0.6 });
  add(26.8, "pop", "the window opens again");
  add(LABELS[3].from + 0.05, "tock", "label dijepit", { vol: 0.7 });
  add(LABELS[4].from + 0.05, "tick", "label darah berkurang", { vol: 0.7 });
  add(28.0, "thump", "the nerve is pinched flat", { vol: 0.8 });
  add(28.3, "slide-whistle-down", "the signal dies", { vol: 0.5 });
  add(FIRE.a, "boing", "released: the nerve fires");
  add(29.6, "glass-ting", "the nerve lights up", { vol: 0.6 });
  add(LABELS[5].from + 0.05, "click-soft", "label menyala lagi", { vol: 0.7 });
  add(30.3, "zip", "sparks run along the nerve", { vol: 0.5 });
  add(30.9, "bubble-rise", "blood returns", { vol: 0.5 });
  add(31.6, "swish-soft", "the window closes", { vol: 0.5 });
  // tips: two cards and a wiggling foot
  add(P.starts[6] + 0.05, "whoosh-soft", "headline of tips", { vol: 0.6 });
  add(CARDS[0].a + 0.02, "pop", "the first tip card pops in");
  add(CARDS[1].a + 0.02, "pop-wood", "the second tip card pops in", { vol: 0.9 });
  add(WIGGLE.a + 0.4, "squeak", "the foot wiggles", { vol: 0.4 });
  add(WIGGLE.a + 1.9, "squeak", "the foot wiggles again", { vol: 0.35 });
  add(CARDS[0].out, "pop-soft", "the cards leave", { vol: 0.5 });
  // the loop-back to the first shot
  add(37.6, "swish-soft", "the camera eases back to the first shot", { vol: 0.5 });
  add(m.outro + 0.1, "jingle-outro", "loop-back jingle", { vol: 0.8 });
  return ev;
}
