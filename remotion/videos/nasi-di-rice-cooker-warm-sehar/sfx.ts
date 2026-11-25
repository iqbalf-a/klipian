/* The sound of "Nasi di rice cooker warm seharian bisa basi?", written by hand against the scenes: a sound on the frame of every headline, camera move, card, pill, the lamp,
   the mercury, the cracking shells, the rods and the drops. Names only from the locked set (src/catalog.ts).
   B60/B61: every name here is one that NONE of the 10 most recent videos uses (read from their sfx.ts); only the channel jingles repeat. The free pool was only 13 names
   (car-horn, glass-break, hi-hat, kalimba-e, meow, page-flip, punch-soft, rain-patter, sniff, stream-trickle, ukulele-strum, water-splash, wave-wash), so no name is used for more
   than about a quarter of the events and the odd ones (car-horn, meow) are left out; ian is asked to add sounds to the catalog (B61 d). */
import type { SfxEvent } from "../../src/sfx.ts";
import type { SfxName } from "../../src/catalog.ts";
import type { StoryT } from "../../src/schema.ts";
import { FPS } from "../../src/timeline.ts";
import { CARD, CRACK, DOUBLE, DROPS, FLAME, LAMP, PILLS, RACUN_CARDS, SPLIT, STAMP, THERMO, TIP_CARDS, makePlan } from "./plan.ts";

export const music = { track: "bed-curious", level: 0.8 } as const;

export function sfx(story: StoryT): SfxEvent[] {
  const P = makePlan(story), m = P.m, ev: SfxEvent[] = [];
  const add = (t: number, name: SfxName, why: string, extra: Partial<SfxEvent> = {}) => ev.push({ t: Math.round(Math.max(0, t) * FPS) / FPS, name, vol: 1, why, ...extra });

  // the hook: the claim lands on frame 0, a sniff at the rice
  add(0.05, "punch-soft", "the claim lands on frame 0", { vol: 0.7 });
  add(0.9, "sniff", "a sniff at the steaming rice", { vol: 0.35 });
  // the sting (voice only: no mascot, no pill)
  add(m.sting, "jingle-sting", "Intip yuk!", { vol: 0.7 });
  add(m.stingEnd - 0.1, "wave-wash", "the camera pulls back and the counter comes in", { vol: 0.45 });
  // spora: the magnified card, the flame that cannot hurt the spores
  add(P.starts[2] + 0.05, "page-flip", "headline of spora", { vol: 0.4 });
  add(CARD.a + 0.05, "kalimba-e", "the magnified card pops in", { vol: 0.5 });
  add(5.7, "wave-wash", "the camera pushes toward the card", { vol: 0.3 });
  add(FLAME.a, "ukulele-strum", "the flame comes in", { vol: 0.35 });
  add(FLAME.a + 1.3, "hi-hat", "the heat hits the spores", { vol: 0.4 });
  add(FLAME.a + 2.1, "hi-hat", "the ring goes out, the spores stay shut", { vol: 0.3 });
  // panas: the thermometer, the mercury climbs above 60
  add(P.starts[3] + 0.05, "page-flip", "headline of panas", { vol: 0.4 });
  add(THERMO.a, "ukulele-strum", "the thermometer slides in", { vol: 0.4 });
  add(THERMO.rise0, "stream-trickle", "the mercury climbs", { vol: 0.35 });
  add(THERMO.rise0 + 1.1, "stream-trickle", "the mercury is nearly there", { vol: 0.25 });
  add(PILLS.hot.a, "kalimba-e", "the 60 degree pill", { vol: 0.6 });
  add(15.4, "sniff", "the steam keeps rising", { vol: 0.25 });
  add(16.5, "wave-wash", "the camera eases back", { vol: 0.3 });
  // turun: the lamp goes out, the mercury falls, the shells crack, the rods multiply, the drops fall
  add(P.starts[4] + 0.05, "page-flip", "headline of turun", { vol: 0.4 });
  add(LAMP.off, "punch-soft", "the warm lamp goes out", { vol: 0.6 });
  add(THERMO.fall0 + 0.1, "stream-trickle", "the mercury falls", { vol: 0.35 });
  add(PILLS.cold.a, "kalimba-e", "the 5 to 60 pill", { vol: 0.6 });
  add(CRACK, "glass-break", "the first shell cracks", { vol: 0.3 });
  add(CRACK + 0.5, "hi-hat", "the second shell cracks", { vol: 0.3 });
  add(SPLIT, "hi-hat", "the rods divide in two", { vol: 0.4 });
  add(SPLIT + 0.7, "hi-hat", "and divide again", { vol: 0.3 });
  add(DOUBLE, "hi-hat", "four rods at every spore", { vol: 0.4 });
  add(DROPS, "rain-patter", "the toxin drops fall", { vol: 0.4 });
  add(DROPS + 0.9, "rain-patter", "more drops", { vol: 0.3 });
  add(CARD.b - 0.2, "wave-wash", "the card leaves, the camera drops", { vol: 0.3 });
  // racun: the verdict, the reheated rice and the rice that looks the same
  add(P.starts[5] + 0.05, "page-flip", "headline of racun", { vol: 0.4 });
  add(STAMP.a, "punch-soft", "the SEBAGIAN stamp", { vol: 0.7 });
  add(RACUN_CARDS[0].a, "kalimba-e", "the reheating card pops in", { vol: 0.5 });
  add(RACUN_CARDS[0].a + 1.0, "sniff", "the flame under the rice", { vol: 0.3 });
  add(RACUN_CARDS[1].a, "kalimba-e", "the normal rice card pops in", { vol: 0.5 });
  add(RACUN_CARDS[1].a + 1.2, "stream-trickle", "steam from the normal rice", { vol: 0.25 });
  // tips: two cards
  add(P.starts[6] + 0.05, "page-flip", "headline of tips", { vol: 0.4 });
  add(TIP_CARDS[0].a, "kalimba-e", "the first tip card pops in", { vol: 0.6 });
  add(PILLS.tip.a, "hi-hat", "the 60 degree pill again", { vol: 0.35 });
  add(TIP_CARDS[1].a, "kalimba-e", "the second tip card pops in", { vol: 0.6 });
  add(34.6, "ukulele-strum", "a light chord under the tips", { vol: 0.3 });
  // the loop-back to the first shot
  add(37.0, "wave-wash", "the camera eases back to the first shot", { vol: 0.4 });
  add(LAMP.on, "water-splash", "the warm lamp is on again", { vol: 0.3 });
  add(m.outro + 0.1, "jingle-outro", "loop-back jingle", { vol: 0.8 });
  return ev;
}
