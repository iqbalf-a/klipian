/* The sound of "Rp14,69 miliar itu sebanyak apa?": an effect on every element, on the frame of its picture (the same moments as the picture, from plan.ts),
   about one event a second, and a thin music bed. The mixer (sfx/mix.mjs) keeps it from getting busy: cooldowns, at most 3 one-shots at once. */
import type { SfxEvent } from "../../src/sfx.ts";
import type { SfxName } from "../../src/catalog.ts";
import type { StoryT } from "../../src/schema.ts";
import { FPS } from "../../src/timeline.ts";
import { makePlan } from "./plan.ts";

/** The bed under it all (render.mjs uses it when the story names none). */
export const music = { track: "bed-sunny", level: 0.8 } as const;

export function sfx(story: StoryT): SfxEvent[] {
  const P = makePlan(story), m = P.m, ev: SfxEvent[] = [];
  const add = (t: number, name: SfxName, why: string, vol = 1, extra: Partial<SfxEvent> = {}) => ev.push({ t: Math.round(Math.max(0, t) * FPS) / FPS, name, vol, why, ...extra });
  const tag = (id: string, name: SfxName, vol = 1) => { const g = P.tags.find((x) => x.id === id); if (g) add(g.from + 0.05, name, `pill "${g.text}"`, vol); };
  const head = (b: number, why: string) => add(b + 0.05, "swish-soft", `headline: ${why}`, 0.7);

  // hook (3 s): the wide shot of the store, the push to the pile
  add(0.05, "whoosh", "the wide shot of the store opens", 0.8);
  add(0.15, "thump", "the first headline lands", 0.6);
  add(0.8, "tick", "the board's lamp blinks", 0.5);
  add(1.5, "swish", "the push to the pile starts", 0.6);
  add(2.1, "tick-soft", "the loose note lifts", 0.4);
  add(2.7, "glass-ting", "the total shines on the board", 0.6);
  // sting
  add(m.sting, "boing", "the mascot pops in");
  add(m.sting + 0.1, "jingle-sting", "Intip yuk!", 0.7);
  add(m.sting + 0.27, "pop", "the Intip yuk! pill");
  add(m.stingEnd - 0.15, "swish", "the mascot leaves", 0.6);
  // asal (8 s): the board and the 8 slips
  head(m.asal, "delapan paket");
  add(m.asal + 0.3, "zoom-whoosh", "the camera pushes to the board", 0.8);
  add(m.asal + 1.5, "tick", "the camera settles", 0.5);
  tag("paket", "pop");
  for (let i = 1; i < 8; i += 2) add(m.asal + 1.8 + i * 0.22, "tick-soft", `slip ${i + 1} lands on the pile`, 0.5);
  tag("tahun", "pop-soft");
  add(m.asal + 4.6, "glass-ting", "the board shines", 0.5);
  tag("tarif", "pop-soft");
  add(m.asal + 6.8, "tick", "the board's lamp blinks", 0.4);
  add(m.iphone - 0.3, "swish-soft", "the slips leave", 0.5);
  // iphone (8 s): the shelf of phones lights up
  head(m.iphone, "534 iPhone");
  add(m.iphone + 0.2, "whoosh", "the camera pans to the shelf", 0.7);
  add(m.iphone + 1.5, "tick", "the camera settles on the phones", 0.5);
  tag("hp-harga", "pop");
  add(m.iphone + 2.2, "bubble-rise", "the screens light up in a wave", 0.5, { dur: 2.6 });
  add(m.iphone + 2.8, "blip-alert", "a phone wakes", 0.4);
  tag("hp-n", "pop");
  add(m.iphone + 3.9, "zip", "the counter rolls to 534", 0.6, { dur: 0.8 });
  add(m.iphone + 4.5, "chime", "534 unit", 0.9);
  add(m.iphone + 5.6, "tick-soft", "a screen glints", 0.4);
  add(m.iphone + 6.6, "glass-ting", "the shelf shines", 0.5);
  // motor (7 s): the scooter
  head(m.motor, "750 lebih motor");
  add(m.motor + 0.2, "whoosh", "the camera pans across the store to the scooter", 0.8);
  add(m.motor + 1.4, "swish", "the pile passes by", 0.5);
  add(m.motor + 2.5, "thump", "the camera stops at the scooter", 0.7);
  tag("mt-harga", "pop");
  add(m.motor + 2.9, "blip-alert", "the headlight flashes", 0.6);
  tag("mt-n", "pop");
  add(m.motor + 4.5, "zip", "the counter rolls to 758", 0.6, { dur: 0.8 });
  add(m.motor + 5.1, "chime", "758 unit", 0.9);
  add(m.motor + 6.2, "tick-soft", "the headlight glows", 0.4);
  // bensin (8 s): the jerrycans
  head(m.bensin, "1,5 juta liter");
  add(m.bensin + 0.2, "whoosh", "the camera pans to the jerrycans", 0.8);
  add(m.bensin + 1.4, "swish", "the pile passes by again", 0.5);
  add(m.bensin + 2.5, "thump", "the camera stops at the jerrycans", 0.7);
  tag("bb-harga", "pop");
  add(m.bensin + 2.9, "boing", "a jerrycan hops", 0.6);
  add(m.bensin + 3.5, "drip", "petrol sloshes", 0.5);
  tag("bb-n", "pop");
  add(m.bensin + 4.7, "zip", "the counter rolls to 1.469.695", 0.6, { dur: 0.8 });
  add(m.bensin + 5.3, "chime", "1.469.695 liter", 0.9);
  add(m.bensin + 6.4, "drip", "a last drop", 0.4);
  add(m.bensin + 7.3, "tick-soft", "a phone glints above", 0.4);
  // gaji (8 s): the pay envelopes land
  head(m.gaji, "gaji 213 orang");
  add(m.gaji + 0.2, "whoosh", "the camera pans back to the counter", 0.7);
  add(m.gaji + 2.0, "tick", "the camera settles", 0.5);
  tag("gj-ump", "pop");
  for (let i = 0; i < 12; i += 2) add(m.gaji + 2.2 + i * 0.3, "pop-soft", `pay envelope ${i + 1} lands`, 0.5);
  tag("gj-n", "pop");
  add(m.gaji + 4.9, "zip", "the counter rolls to 213", 0.6, { dur: 0.8 });
  add(m.gaji + 5.5, "chime-bright", "213 orang", 0.9);
  tag("gj-12", "pop-soft");
  add(m.gaji + 7.2, "glass-ting", "the stack of twelve shines", 0.5);
  // hari (6 s): the calendar flips
  head(m.hari, "sejuta per hari");
  add(m.hari + 0.2, "zoom-whoosh", "the camera rises to the calendar", 0.8);
  tag("hr-juta", "pop");
  for (let i = 0; i < 6; i++) add(m.hari + 1.5 + i * 0.45, "tick", `a calendar sheet flips (${i + 1})`, 0.5);
  tag("hr-n", "pop");
  add(m.hari + 3.5, "zip", "the counter rolls to 40", 0.6, { dur: 0.8 });
  add(m.hari + 4.2, "thump", "the last sheet lands", 0.7);
  add(m.hari + 4.4, "chime", "40 tahun", 0.9);
  add(m.hari + 5.3, "tick-soft", "the calendar's corner curls", 0.4);
  // tips (7 s): the recap
  head(m.tips, "semua dari satu angka");
  add(m.tips + 0.2, "whoosh", "the camera pulls back to the pile", 0.7);
  add(m.tips + 0.5, "swish-soft", "the envelopes leave", 0.5);
  add(m.tips + 1.5, "tick", "the camera settles", 0.5);
  add(m.tips + 1.7, "pop", "recap card 1");
  add(m.tips + 2.7, "chime", "recap 1", 0.7);
  add(m.tips + 4.0, "pop", "recap card 2");
  add(m.tips + 5.0, "chime-bright", "recap 2", 0.7);
  add(m.tips + 6.2, "glass-ting", "the total shines", 0.5);
  // outro: back to the wide shot
  add(m.outro + 0.1, "whoosh", "the camera eases back to the wide shot", 0.6);
  add(m.outro + 1.5, "tick-soft", "the board's lamp blinks", 0.4);
  add(m.outro + 2.6, "tick-soft", "the loose note settles", 0.4);
  add(m.outro + 3.3, "jingle-outro", "loop", 0.6);
  return ev.sort((a, b) => a.t - b.t);
}
