/* The sound of "Mata kedutan? Bukan pertanda", written by hand against the scenes: a sound on the frame of every headline, camera move, window, label, twitch,
   trigger piece, stamp, chip, tip card, blink and the loop-back. Names only from the locked set (src/catalog.ts). */
import type { SfxEvent } from "../../src/sfx.ts";
import type { SfxName } from "../../src/catalog.ts";
import type { StoryT } from "../../src/schema.ts";
import { FPS } from "../../src/timeline.ts";
import { BLINKS, CARDS, CHIPS, LABELS, STAMP, TRIGGERS, makePlan } from "./plan.ts";

export const music = { track: "bed-breeze", level: 0.8 } as const;

export function sfx(story: StoryT): SfxEvent[] {
  const P = makePlan(story), m = P.m, ev: SfxEvent[] = [];
  const add = (t: number, name: SfxName, why: string, extra: Partial<SfxEvent> = {}) => ev.push({ t: Math.round(Math.max(0, t) * FPS) / FPS, name, vol: 1, why, ...extra });

  // the hook: the claim is on the screen, the lid twitches three times
  add(0.05, "thump", "the claim lands on frame 0", { vol: 0.6 });
  add(0.25, "tick", "the lid twitches", { vol: 0.5 });
  add(1.75, "key-blip", "the lid twitches again", { vol: 0.5 });
  add(2.85, "click-soft", "a last small twitch", { vol: 0.45 });
  // the sting (voice only: no mascot, no pill)
  add(m.sting, "jingle-sting", "Intip yuk!", { vol: 0.7 });
  add(m.stingEnd - 0.1, "zoom-whoosh", "the camera dives to the lid", { vol: 0.6 });
  // saraf: the window opens on the muscle and the nerve
  add(P.starts[2] + 0.05, "whoosh-soft", "headline of saraf", { vol: 0.6 });
  add(4.95, "pop", "the window opens on the lid");
  add(LABELS[0].from + 0.05, "tick-soft", "label saraf wajah", { vol: 0.7 });
  add(LABELS[1].from + 0.05, "click-soft", "label otot kelopak", { vol: 0.7 });
  add(6.6, "chime", "a signal runs down the nerve", { vol: 0.5 });
  add(7.1, "zip", "the nerve misfires: the muscle jumps", { vol: 0.55 });
  add(LABELS[2].from + 0.05, "blip-alert", "label salah kirim sinyal", { vol: 0.55 });
  add(9.0, "rattle", "the second misfire", { vol: 0.5 });
  add(10.3, "pop-soft", "the window closes", { vol: 0.6 });
  // pemicu: the triggers come in one by one
  add(10.7, "swish", "the camera pulls back wide", { vol: 0.6 });
  add(P.starts[3] + 0.05, "whoosh", "headline of pemicu", { vol: 0.55 });
  add(TRIGGERS.tidur, "bell-soft", "the moon and the late clock come in", { vol: 0.7 });
  add(TRIGGERS.stres, "huh", "the stress cloud scribbles in", { vol: 0.5 });
  add(TRIGGERS.kopi, "sizzle", "the coffee steams", { vol: 0.4 });
  add(TRIGGERS.kering, "drip", "the dry drop", { vol: 0.7 });
  add(16.4, "slide-whistle-down", "the lid gets heavy", { vol: 0.45 });
  add(18.6, "swish-soft", "the camera comes back to the eye", { vol: 0.55 });
  // lama: the answer
  add(P.starts[4] + 0.05, "whoosh-soft", "headline of lama", { vol: 0.6 });
  add(STAMP.a + 0.02, "stamp", "the FAKTA stamp lands");
  add(CHIPS[0].a + 0.02, "pop-wood", "the first time chip", { vol: 0.8 });
  add(CHIPS[1].a + 0.02, "tock", "the second time chip", { vol: 0.8 });
  add(22.6, "swish-down", "the twitch dies down", { vol: 0.4 });
  add(BLINKS[0] + 0.1, "squeak", "the eye blinks, calm", { vol: 0.35 });
  add(25.6, "glass-ting", "the eye is calm", { vol: 0.5 });
  // tips: two cards
  add(P.starts[5] + 0.05, "whoosh-soft", "headline of tips", { vol: 0.6 });
  add(CARDS[0].a + 0.02, "pop", "the first tip card pops in");
  add(CARDS[1].a + 0.02, "boing", "the second tip card pops in", { vol: 0.7 });
  add(BLINKS[1] + 0.1, "puff", "a slow relaxed blink", { vol: 0.3 });
  add(CARDS[0].out, "pop-soft", "the cards leave", { vol: 0.5 });
  // the loop-back to the first shot
  add(37.6, "swish-soft", "the camera eases back to the first shot", { vol: 0.5 });
  add(38.9, "tick", "the lid twitches: the loop starts again", { vol: 0.4 });
  add(m.outro + 0.1, "jingle-outro", "loop-back jingle", { vol: 0.8 });
  return ev;
}
