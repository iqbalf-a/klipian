/* The sound of "Syarat jadi anggota DPR ternyata cuma lulus SMA?": an effect on every element, on the frame of its picture (the same moments as the picture, from
   plan.ts), about one event a second, and a thin music bed. The mixer (sfx/mix.mjs) keeps it from getting busy: cooldowns, at most 3 one-shots at once. */
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

  // hook (3 s): the wide shot of the office wall, the push to the diploma
  add(0.05, "whoosh", "the wide shot of the office wall opens", 0.8);
  add(0.15, "thump", "the first headline lands", 0.6);
  add(1.0, "tick", "the wall clock ticks", 0.5);
  add(1.5, "swish", "the push to the diploma starts", 0.6);
  add(2.7, "glass-ting", "the diploma's seal shines", 0.6);
  // sting
  add(m.sting, "boing", "the mascot pops in");
  add(m.sting + 0.1, "jingle-sting", "Intip yuk!", 0.7);
  add(m.sting + 0.27, "pop", "the Intip yuk! pill");
  add(m.stingEnd - 0.15, "swish", "the mascot leaves", 0.6);
  // aturan (7 s): the sheet of the law, its rows are ticked
  add(m.aturan + 0.2, "whoosh", "the camera pans to the sheet of the law", 0.7);
  add(m.aturan + 1.6, "thump", "the camera stops at the sheet", 0.6);
  tag("uu", "pop");
  for (let i = 0; i < 8; i += 2) add(m.aturan + 1.9 + i * 0.32, "tick", `row ${i + 1} of the list is ticked`, 0.5);
  tag("pasal", "pop");
  add(m.aturan + 4.2, "glass-ting", "the last row is ticked", 0.5);
  tag("daftar", "pop-soft");
  // sma (8 s): the education row, then the diploma
  add(m.sma + 0.2, "zoom-whoosh", "the camera pushes to the education row", 0.7);
  add(m.sma + 0.9, "zip", "the highlighter sweeps the row", 0.7, { dur: 0.8 });
  tag("rendah", "pop");
  add(m.sma + 2.2, "chime", "the row is the answer", 0.7);
  add(m.sma + 2.8, "whoosh", "the camera pans back to the diploma", 0.7);
  add(m.sma + 4.3, "thump", "the camera stops at the diploma", 0.6);
  add(m.sma + 4.6, "pop", "the tick badge lands on the diploma");
  tag("jenis", "pop");
  add(m.sma + 5.6, "chime-bright", "the diploma qualifies", 0.7);
  tag("sederajat", "pop-soft");
  // paketc (8 s): the two diplomas side by side, the equals sign, then the Paket C diploma
  add(m.paketc + 0.2, "whoosh", "the camera pulls back to both diplomas", 0.7);
  add(m.paketc + 1.7, "boing", "the equals sign pops between them", 0.7);
  tag("paket", "pop");
  tag("setara", "pop");
  add(m.paketc + 3.4, "chime", "setara", 0.8);
  add(m.paketc + 4.2, "swish", "the camera pushes to the Paket C diploma", 0.6);
  tag("nonformal", "pop-soft");
  add(m.paketc + 7.0, "glass-ting", "the Paket C seal shines", 0.5);
  // serang (8 s): the folders of the candidates land on the desk
  add(m.serang + 0.2, "swish", "the camera drops to the desk", 0.6);
  for (let i = 0; i < 8; i += 2) add(m.serang + 1.6 + i * 0.4, "pop-soft", `folder ${i + 1} lands on the desk`, 0.6);
  tag("kpu", "pop");
  tag("dprd", "pop");
  add(m.serang + 5.6, "thump", "the stamp comes down on the pile", 0.8);
  add(m.serang + 5.9, "chime", "the pile is accepted", 0.7);
  // fakta (7 s): back to the diploma, the verdict
  add(m.fakta + 0.2, "whoosh", "the camera pans back to the diploma", 0.7);
  add(m.fakta + 0.5, "swish-soft", "the folders leave", 0.5);
  add(m.fakta + 1.7, "thump", "the FAKTA stamp lands", 0.9);
  add(m.fakta + 2.0, "chime-bright", "FAKTA", 0.8);
  tag("sarjana", "pop");
  add(m.fakta + 4.4, "pop-soft", "the source chip", 0.6);
  add(m.fakta + 5.6, "glass-ting", "the diploma's seal shines", 0.5);
  // umur (6 s): the ID card
  add(m.umur + 0.2, "zoom-whoosh", "the camera dives to the ID card", 0.8);
  tag("usia", "pop");
  add(m.umur + 2.5, "zip", "the counter rolls to 21", 0.6, { dur: 0.8 });
  add(m.umur + 3.2, "chime", "21 tahun", 0.9);
  tag("bahasa", "pop");
  // tips (8 s): the ballot box
  add(m.tips + 0.2, "whoosh", "the camera pans to the ballot box", 0.8);
  add(m.tips + 2.6, "thump", "the camera stops at the ballot box", 0.7);
  P.drops.forEach((s, i) => { add(m.tips + s + 0.6, "tick", `ballot ${i + 1} goes into the slot`, 0.6); });
  add(m.tips + 3.1, "pop", "tip card 1");
  add(m.tips + 3.8, "chime", "tip 1", 0.7);
  add(m.tips + 4.9, "pop", "tip card 2");
  add(m.tips + 5.5, "chime-bright", "tip 2", 0.7);
  // outro: back to the wide shot
  add(m.outro + 0.1, "whoosh", "the camera eases back to the wide shot", 0.6);
  add(m.outro + 1.5, "tick-soft", "the wall clock ticks", 0.4);
  add(m.outro + 3.3, "jingle-outro", "loop", 0.6);
  return ev.sort((a, b) => a.t - b.t);
}
