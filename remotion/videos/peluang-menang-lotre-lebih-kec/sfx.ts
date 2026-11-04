/* The sound of "Lotre vs petir": an effect on every card, number, tile and camera move, on the frame of its picture (the same named times as index.tsx, from
   plan.ts T), about one a second. The mixer keeps it from getting busy: cooldowns, at most 3 one-shots at once, ducking under a voice. */
// Imported from the plain .ts modules, never from src/design/index.ts: render.mjs loads this file in Node.
import type { SfxEvent } from "../../src/sfx.ts";
import type { SfxName } from "../../src/catalog.ts";
import type { StoryT } from "../../src/schema.ts";
import { FPS } from "../../src/timeline.ts";
import { T, makePlan } from "./plan.ts";

/** The bed under it all: curious and light, under a voice. */
export const music = { track: "bed-curious", level: 0.8 } as const;

export function sfx(story: StoryT): SfxEvent[] {
  const P = makePlan(story), ev: SfxEvent[] = [];
  const add = (beat: string, t: number, name: SfxName, why: string, extra: Partial<SfxEvent> = {}) =>
    ev.push({ t: Math.round(Math.max(0, P.at(beat) + t) * FPS) / FPS, name, vol: 1, why, ...extra });

  add("hook", 0, "whoosh", "the camera pushes in on the two cards", { vol: 0.8 });
  add("hook", T.hook.cardL + 0.05, "pop", "card LOTRE");
  add("hook", T.hook.cardR + 0.05, "pop", "card PETIR");
  add("hook", T.hook.vs, "boing", "VS pops between them");
  add("hook", T.hook.wiggle, "tick", "VS wiggles", { vol: 0.7 });

  add("sting", 0, "boing", "the mascot pops in");
  add("sting", 0.1, "jingle-sting", "Intip yuk!", { vol: 0.7 });
  add("sting", 0.27, "pop", "the Intip yuk! pill");
  add("sting", 0.85, "swish", "the mascot leaves", { vol: 0.6 });

  for (const id of ["jackpot", "petir"] as const) {
    const k = T[id];
    add(id, k.label, "swish-soft", "the label card slides in", { vol: 0.7 });
    add(id, k.roll, "hum", "the number rolls", { dur: k.rollDur, vol: 0.7 });
    add(id, k.land, "thump", "the number lands", { vol: 0.8 });
    add(id, k.grid, "zip", "the dots sweep in", { vol: 0.7 });
    add(id, k.winner, id === "jackpot" ? "chime" : "chime-bright", "the one yellow dot pops");
    add(id, k.tag, "pop-soft", "the note card");
    add(id, k.push, "swish", "the camera pushes in", { vol: 0.6 });
  }

  const b = T.banding;
  add("banding", b.label, "swish-soft", "the label card slides in", { vol: 0.7 });
  add("banding", b.barA, "zip", "the jackpot bar grows");
  add("banding", b.barB, "tick", "the thin petir bar appears");
  add("banding", b.roll, "hum", "the multiplier rolls", { dur: b.rollDur, vol: 0.7 });
  add("banding", b.land, "thump", "the multiplier lands", { vol: 0.8 });
  add("banding", b.push, "swish", "the camera pans down", { vol: 0.6 });
  add("banding", b.formula, "pop-soft", "the division card");
  add("banding", b.tick, "tick-soft", "the card settles");

  const s = T.setahun;
  add("setahun", s.label, "swish-soft", "the label card slides in", { vol: 0.7 });
  add("setahun", s.tiles, "zip", "the 239 tiles sweep in", { dur: s.tilesDur, vol: 0.7 });
  add("setahun", s.push, "swish", "the camera pushes in", { vol: 0.6 });
  add("setahun", s.winner, "chime", "the one yellow tile pops");
  add("setahun", s.roll, "hum", "the multiplier rolls", { dur: s.rollDur, vol: 0.7 });
  add("setahun", s.land, "thump", "the multiplier lands", { vol: 0.8 });
  add("setahun", s.tag, "pop-soft", "the second note");

  const f = T.fakta;
  add("fakta", f.stamp, "thump", "the FAKTA stamp slams down");
  add("fakta", f.cardL, "pop-soft", "card jackpot");
  add("fakta", f.cardR, "pop-soft", "card petir");
  add("fakta", f.less, "boing", "the less-than sign pops");
  add("fakta", f.tag, "pop-soft", "the verdict note");
  add("fakta", f.tick, "tick", "the cards settle", { vol: 0.7 });

  const h = T.hadiah;
  add("hadiah", h.label, "swish-soft", "the label card slides in", { vol: 0.7 });
  add("hadiah", h.roll, "hum", "the number rolls", { dur: h.rollDur, vol: 0.7 });
  add("hadiah", h.land, "thump", "the number lands", { vol: 0.8 });
  add("hadiah", h.tiles, "zip", "the 25 tiles sweep in", { vol: 0.7 });
  add("hadiah", h.winner, "chime-bright", "the one yellow tile pops");
  add("hadiah", h.tag, "pop-soft", "the jackpot note");
  add("hadiah", h.tick, "tick-soft", "the note settles");

  const p = T.tips;
  add("tips", p.t1, "pop", "tip 1"); add("tips", p.t1 + 0.25, "tick", "the number of tip 1", { vol: 0.7 });
  add("tips", p.t2, "pop", "tip 2"); add("tips", p.t2 + 0.25, "tick", "the number of tip 2", { vol: 0.7 });
  add("tips", p.t3, "chime", "tip 3"); add("tips", p.t3 + 0.25, "tick", "the number of tip 3", { vol: 0.7 });
  add("tips", p.push, "swish", "the camera settles for the loop", { vol: 0.7 });

  add("outro", 0, "whoosh", "back to the two cards", { vol: 0.7 });
  add("outro", 0.1, "jingle-outro", "the loop-back jingle");
  return ev.sort((a, b) => a.t - b.t);
}
