/* The sound of "Kenapa kita menguap saat melihat orang menguap": by hand, one sound on every card, counter, dot, bar and flip, on the frame of its picture
   (the cue times of plan.ts), about one a second. The mixer (sfx/mix.mjs) keeps at most 3 at once and ducks under a voice. Plain .ts imports only (B26). */
import type { SfxEvent } from "../../src/sfx.ts";
import type { SfxName } from "../../src/catalog.ts";
import type { StoryT } from "../../src/schema.ts";
import { FPS } from "../../src/timeline.ts";
import { CUE, makePlan } from "./plan.ts";

export const music = { track: "bed-curious", level: 0.8 } as const;

export function sfx(story: StoryT): SfxEvent[] {
  const P = makePlan(story), ev: SfxEvent[] = [];
  const add = (t: number, name: SfxName, why: string, extra: Partial<SfxEvent> = {}) => ev.push({ t: Math.round(Math.max(0, t) * FPS) / FPS, name, vol: 1, why, ...extra });
  const A = (id: string) => P.at(id);
  const top = (id: string, why: string) => add(A(id) + 0.05, "swish-soft", `headline: ${why}`, { vol: 0.7 });

  // hook: the big card, the HOAAM word, the line under it
  const h = CUE.hook;
  add(0, "whoosh", "the big card pushes in", { vol: 0.8 });
  add(h.word, "boing", "HOAAM pops in", { vol: 0.8 });
  add(h.word + 0.7, "huh", "a yawn", { vol: 0.6 });
  add(h.sub, "pop-soft", "kamu ikut juga?");
  add(h.bar, "zip", "the underline draws", { vol: 0.7 });

  // sting
  const s = P.m.sting;
  add(s, "boing", "the mascot pops in");
  add(s + 0.1, "jingle-sting", "Intip yuk!", { vol: 0.7 });
  add(s + 0.27, "pop", "the Intip yuk! pill");
  add(P.m.stingEnd - 0.15, "swish", "the mascot leaves", { vol: 0.6 });

  // tular: 50 % rolls, ten dots, five fill
  const u = CUE.tular, a = A("tular");
  top("tular", "separuh orang tertular");
  add(a + u.card, "pop-soft", "the 50 % card");
  add(a + u.roll + 0.1, "tick", "the 50 counts up");
  add(a + u.roll + u.rollDur, "thump", "50 % lands", { vol: 0.8 });
  add(a + u.grid, "swish-soft", "ten dots appear", { vol: 0.7 });
  for (let i = 0; i < 5; i += 2) add(a + u.fill + i * u.fillStep, "tick-soft", `dot ${i + 1} fills`, { vol: 0.8 });
  add(a + u.lab, "pop", "5 dari 10 card");

  // indera: three cards stack, then a flip
  const v = CUE.indera, b = A("indera");
  top("indera", "dengar, baca, menguap");
  add(b + v.c1, "pop-soft", "LIHAT card"); add(b + v.c2, "swish", "DENGAR slides in", { vol: 0.7 });
add(b + v.c3, "swish", "BACA slides in", { vol: 0.7 });
  
  add(b + v.card, "pop-soft", "kamu baca ini card");
  add(b + v.flip, "swish", "the card flips", { vol: 0.7 });

  // dekat: four bars, from family to strangers
  const d = CUE.dekat, c = A("dekat");
  top("dekat", "makin dekat, makin menular");
  [d.r0, d.r1, d.r2, d.r3].forEach((r, i) => {
    add(c + r, "swish-soft", `bar ${i + 1} slides in`, { vol: 0.7 });
    add(c + r + 0.25, "pop-soft", `bar ${i + 1} card`);
  });
  add(c + d.note, "chime", "the note under the bars", { vol: 0.7 });

  // anak: 4 tahun rolls, the age cells scan, the fourth lights
  const k = CUE.anak, e = A("anak");
  top("anak", "baru tertular umur 4");
  add(e + k.card, "pop-soft", "the 4 tahun card");
add(e + k.roll + k.rollDur - 0.1, "thump", "4 lands", { vol: 0.8 });
  add(e + k.grid, "swish-soft", "the age cells appear", { vol: 0.7 });
  for (let i = 0; i < 4; i += 2) add(e + k.scan + i * k.scanStep, "tick-soft", `cell ${i} greys`, { vol: 0.7 });
  add(e + k.mark, "chime-bright", "cell 4 lights up");
  add(e + k.lab, "pop", "sebelum itu card");

  // teori: dugaan card, EMPATI? flips to BELUM TERBUKTI
  const r = CUE.teori, f = A("teori");
  top("teori", "empati? belum terbukti");
  add(f + r.c2, "pop", "EMPATI? card");
  add(f + r.flip, "swish", "the card flips", { vol: 0.7 }); add(f + r.flip + 0.3, "thump", "BELUM TERBUKTI", { vol: 0.8 });
  add(f + r.q, "boing", "the question mark pops", { vol: 0.8 });
  add(f + r.c3, "pop-soft", "peneliti masih berdebat");

  // akhir
  const j = CUE.akhir, g = A("akhir");
  top("akhir", "menguap itu menular");
  add(g + j.c1, "thump", "MENULAR card", { vol: 0.8 });
  add(g + j.flip, "swish", "the card flips", { vol: 0.7 });
  add(g + j.c3, "chime", "menguap itu menular");
  add(g + j.c4, "huh", "hoaam", { vol: 0.6 });

  // the loop-back has no jingle and no mascot sound: one soft swish as the empty frame returns to the first card
  add(P.m.outro + 0.2, "swish-soft", "back to the empty start", { vol: 0.5 });
  return ev.sort((x, y) => x.t - y.t);
}
