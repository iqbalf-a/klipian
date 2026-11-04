/* The sound of "Pluto belum sekali pun mengelilingi Matahari sejak ditemukan": an effect on every element, on the frame of its picture (the same moments as the picture, from
   plan.ts), about one event a second, and a thin music bed. The mixer (sfx/mix.mjs) keeps it from getting busy: cooldowns, at most 3 one-shots at once. */
import type { SfxEvent } from "../../src/sfx.ts";
import type { SfxName } from "../../src/catalog.ts";
import type { StoryT } from "../../src/schema.ts";
import { FPS } from "../../src/timeline.ts";
import { makePlan } from "./plan.ts";

/** The bed under it all (render.mjs uses it because the story names none). */
export const music = { track: "bed-glow", level: 0.8 } as const;

export function sfx(story: StoryT): SfxEvent[] {
  const P = makePlan(story), m = P.m, ev: SfxEvent[] = [];
  const add = (t: number, name: SfxName, why: string, vol = 1, extra: Partial<SfxEvent> = {}) => ev.push({ t: Math.round(Math.max(0, t) * FPS) / FPS, name, vol, why, ...extra });
  const label = (id: string, name: SfxName, vol = 1) => { const l = P.labels.find((x) => x.id === id); if (l) add(l.from + 0.05, name, `label "${l.text}"`, vol); };
  const head = (b: number, why: string) => add(b + 0.05, "swish-soft", `headline: ${why}`, 0.7);

  // hook (3 s): the wide shot of the wall, the push to the chart
  add(0.05, "whoosh", "the camera pushes in on the chart", 0.8);
  add(0.15, "thump", "the first headline lands", 0.6);
  add(0.7, "tick", "Pluto's ring pulses", 0.5);
  add(1.5, "swish", "the push starts", 0.6);
  add(2.0, "tick-soft", "a star twinkles on the chart", 0.4);
  add(2.7, "glass-ting", "the chart shines", 0.6);
  // sting
  add(m.sting, "boing", "the mascot pops in");
  add(m.sting + 0.1, "jingle-sting", "Intip yuk!", 0.7);
  add(m.sting + 0.27, "pop", "the Intip yuk! pill");
  add(m.stingEnd - 0.15, "swish", "the mascot leaves", 0.6);
  // temu (8 s): the discovery point
  head(m.temu, "ditemukan 1930");
  add(m.temu + 0.3, "zoom-whoosh", "the camera dives to Pluto's spot", 0.8);
  add(m.temu + 1.4, "tick", "the camera settles", 0.6);
  label("y1930", "pop");
  add(m.temu + 3.0, "tick-soft", "the plates blink", 0.5);
  add(m.temu + 3.6, "tick-soft", "the plates blink again", 0.4);
  label("lowell", "pop-soft");
  add(m.temu + 5.2, "glass-ting", "Pluto shines", 0.5);
  add(m.temu + 6.4, "tick", "the telescope sways", 0.4);
  // tahun (9 s): a full orbit sweeps by
  head(m.tahun, "satu tahun Pluto");
  add(m.tahun + 0.3, "whoosh", "the camera pulls back to the chart", 0.7);
  add(m.tahun + 1.2, "zip", "Pluto sets off along its orbit", 0.7, { dur: 1.2 });
  add(m.tahun + 2.0, "bubble-rise", "the yellow trail grows", 0.5, { dur: 4.4 });
  label("x248", "chime", 0.9);
  add(m.tahun + 4.0, "tick-soft", "the ruler marker slides", 0.4);
  add(m.tahun + 6.0, "swish-soft", "Pluto speeds past the Sun", 0.5);
  add(m.tahun + 7.0, "thump", "the loop closes", 0.8);
  label("satu", "pop-soft");
  add(m.tahun + 8.2, "glass-ting", "the chart shines", 0.5);
  // jalan (9 s): only 96 years so far
  add(m.jalan, "slide-whistle-down", "Pluto rewinds to 1930", 0.5);
  head(m.jalan, "baru 96 tahun");
  add(m.jalan + 0.4, "whoosh", "the camera moves to the ruler", 0.7);
  add(m.jalan + 1.0, "zip", "Pluto runs to today", 0.7, { dur: 1.2 });
  add(m.jalan + 2.0, "bubble-rise", "the trail grows to 2026", 0.5, { dur: 3.4 });
  add(m.jalan + 3.4, "tick", "the ruler fills", 0.4);
  label("y2026", "pop");
  add(m.jalan + 5.6, "thump", "Pluto stops at today", 0.7);
  label("sep", "chime", 0.9);
  add(m.jalan + 7.4, "tick-soft", "the half-way tick", 0.5);
  add(m.jalan + 8.2, "glass-ting", "the half-way tick shines", 0.5);
  // hasil (8 s): back to the start in 2178
  head(m.hasil, "kembali ke titik awal");
  add(m.hasil + 0.3, "whoosh", "the camera follows Pluto", 0.7);
  add(m.hasil + 0.7, "zip", "Pluto runs on", 0.7, { dur: 1.2 });
  add(m.hasil + 1.8, "bubble-rise", "the trail nears the start", 0.5, { dur: 2.2 });
  add(m.hasil + 3.2, "tick", "Pluto slows down", 0.5);
  add(m.hasil + 3.6, "pop", "the label 2178 appears", 0.8);
  label("y2178", "chime-bright", 0.9);
  add(m.hasil + 4.2, "thump", "the loop is closed", 0.8);
  label("pertama", "pop-soft");
  add(m.hasil + 6.0, "glass-ting", "the first orbit shines", 0.6);
  // neptunus (8 s): the ring and the crossing
  add(m.neptunus, "slide-whistle-down", "Pluto rewinds to 1962", 0.5);
  head(m.neptunus, "orbit lonjong");
  add(m.neptunus + 0.3, "zoom-whoosh", "the camera dives to the crossing", 0.8);
  add(m.neptunus + 1.0, "zip", "Pluto sets off again", 0.6, { dur: 1.0 });
  add(m.neptunus + 1.4, "tick", "the camera settles", 0.5);
  label("nep", "pop");
  add(m.neptunus + 2.6, "hum", "Pluto goes inside Neptune's ring", 0.5, { dur: 1.6 });
  add(m.neptunus + 3.4, "bubble-rise", "the blue stretch glows", 0.5, { dur: 1.6 });
  label("r32", "chime", 0.9);
  add(m.neptunus + 5.4, "tick-soft", "Neptune keeps its distance", 0.5);
  add(m.neptunus + 6.6, "swish", "Pluto leaves the ring", 0.5);
  add(m.neptunus + 7.4, "glass-ting", "the chart shines", 0.5);
  // tips (10 s)
  head(m.tips, "fakta");
  add(m.tips + 0.2, "whoosh", "the camera pulls back", 0.7);
  add(m.tips + 0.5, "zip", "Pluto runs a full loop", 0.6, { dur: 1.0 });
  add(m.tips + 1.4, "thump", "the full loop is drawn", 0.7);
  add(m.tips + 1.6, "pop", "tip card 1");
  add(m.tips + 2.6, "chime", "tip 1", 0.7);
  add(m.tips + 4.0, "tick", "the ruler marker blinks", 0.4);
  add(m.tips + 5.0, "pop", "tip card 2");
  add(m.tips + 6.0, "chime-bright", "tip 2", 0.7);
  add(m.tips + 8.2, "glass-ting", "the chart shines", 0.5);
  // outro: back to the wide shot
  add(m.outro + 0.1, "whoosh", "the camera eases back to the wide shot", 0.6);
  add(m.outro + 1.5, "tick-soft", "a star twinkles", 0.4);
  add(m.outro + 3.3, "jingle-outro", "loop", 0.6);
  return ev.sort((a, b) => a.t - b.t);
}
