/* The sound of "Kamu habiskan sekitar 26 tahun hidup untuk tidur": by hand, one sound on every card, counter, bar and flip, on the frame of its picture
   (the cue times of plan.ts), about one a second. The mixer (sfx/mix.mjs) keeps at most 3 at once and ducks under a voice. Plain .ts imports only (B26). */
import type { SfxEvent } from "../../src/sfx.ts";
import type { SfxName } from "../../src/catalog.ts";
import type { StoryT } from "../../src/schema.ts";
import { FPS } from "../../src/timeline.ts";
import { CUE, makePlan } from "./plan.ts";

export const music = { track: "bed-calm", level: 0.8 } as const;

export function sfx(story: StoryT): SfxEvent[] {
  const P = makePlan(story), ev: SfxEvent[] = [];
  const add = (t: number, name: SfxName, why: string, extra: Partial<SfxEvent> = {}) => ev.push({ t: Math.round(Math.max(0, t) * FPS) / FPS, name, vol: 1, why, ...extra });
  const A = (id: string) => P.at(id);

  // hook: the 26 rolls up and lands
  const h = CUE.hook;
  add(0, "whoosh", "the big card pushes in", { vol: 0.8 });
  add(h.roll + 0.15, "tick", "the 26 counts up"); add(h.roll + 0.65, "tick", "the 26 counts up", { vol: 0.8 });
  add(h.roll + h.rollDur, "thump", "the 26 lands", { vol: 0.8 });
  add(h.sub, "pop-soft", "the line under the number");
  add(h.bar, "zip", "the underline draws", { vol: 0.7 });

  // sting
  const s = P.m.sting;
  add(s, "boing", "the mascot pops in");
  add(s + 0.1, "jingle-sting", "Intip yuk!", { vol: 0.7 });
  add(s + 0.27, "pop", "the Intip yuk! pill");
  add(P.m.stingEnd - 0.15, "swish", "the mascot leaves", { vol: 0.6 });

  const top = (id: string, why: string) => add(A(id) + 0.05, "swish-soft", `headline: ${why}`, { vol: 0.7 });

  const r = CUE.rentang, a = A("rentang");
  top("rentang", "7 sampai 9 jam");
  add(a + r.c7, "pop-soft", "the 7 card slides in"); add(a + r.c9, "pop-soft", "the 9 card slides in");
  add(a + r.span, "zip", "the span between them draws", { vol: 0.8 });
  add(a + r.grid, "swish-soft", "the 24 hours appear", { vol: 0.7 });
  add(a + r.fill7 + 0.2, "tick-soft", "seven hours fill"); add(a + r.fill9, "chime", "up to nine hours");

  const q = CUE.sepertiga, b = A("sepertiga");
  top("sepertiga", "8 jam = 1/3 hari");
  add(b + q.grid, "pop-soft", "the 24 hours again");
  add(b + q.fill + 0.1, "tick-soft", "eight hours fill"); add(b + q.fill + 1.3, "tick-soft", "eight hours fill", { vol: 0.8 });
  add(b + q.card, "pop-soft", "the 8 / 24 card");
  add(b + q.flip, "swish", "the card flips to 1/3", { vol: 0.7 }); add(b + q.flip + 0.3, "pop", "1/3");
  add(b + q.thirds, "zip", "the day splits in three", { vol: 0.8 });

  const u = CUE.umur, c = A("umur");
  top("umur", "78 tahun / 3 = 26");
  add(c + u.n78, "pop-soft", "the 78 card"); add(c + u.n78 + 0.5, "tick", "the 78 counts up");
  add(c + u.div, "pop-soft", "the divide by 3 card");
  add(c + u.bar, "zip", "the life bar draws", { vol: 0.8 });
  add(c + u.big, "thump", "the 26 card lands", { vol: 0.8 }); add(c + u.big + 1.3, "chime", "26 tahun");

  const y = CUE.setahun, d = A("setahun");
  top("setahun", "2.920 jam, 120 hari");
  add(d + y.card, "pop-soft", "the 2.920 card"); add(d + y.card + 0.6, "tick", "the hours count up");
  add(d + y.grid, "pop-soft", "the 365 days appear"); add(d + y.fill, "zip", "the sleeping days fill in", { vol: 0.8 });
  add(d + y.fill + y.fillDur, "chime", "all the sleeping days"); add(d + y.lab, "pop", "120+ hari");

  const z = CUE.rentangUmur, e = A("rentang-umur");
  top("rentang-umur", "7 jam 23, 9 jam 29");
  add(e + z.r7, "pop-soft", "the 7 jam bar"); add(e + z.r7 + 0.8, "tick", "23 tahun");
  add(e + z.r8, "pop-soft", "the 8 jam bar"); add(e + z.r8 + 0.8, "tick", "26 tahun");
  add(e + z.r9, "pop-soft", "the 9 jam bar");
  add(e + z.foot, "chime", "the note under the bars");

  const o = CUE.otak, f = A("otak");
  top("otak", "otak bersih-bersih");
  add(f + o.card, "pop-soft", "the metabolic waste card");
  add(f + o.bar1, "whoosh", "the awake bar grows", { vol: 0.5 }); add(f + o.bar1 + 0.8, "tick-soft", "terjaga");
  add(f + o.bar2, "whoosh", "the sleep bar grows", { vol: 0.7 });
  add(f + o.stamp, "thump", "LEBIH CEPAT stamps in", { vol: 0.8 });

  const k = CUE.akhir, g = A("akhir");
  top("akhir", "bukan waktu hilang");
  add(g + k.c1, "pop-soft", "the 26 tahun card");
  add(g + k.c2, "swish", "the next card flips on", { vol: 0.7 }); add(g + k.c2 + 0.2, "pop-soft", "bukan waktu hilang");
  add(g + k.c3, "chime", "bagian dari hidupmu");

  // the loop-back has no jingle and no mascot sound: one soft swish as the empty frame returns to the first card
  add(P.m.outro + 0.2, "swish-soft", "back to the empty start", { vol: 0.5 });
  return ev.sort((x, y2) => x.t - y2.t);
}
