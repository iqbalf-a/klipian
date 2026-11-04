/* The sound of "Cara kerja sedotan menyedot minuman": an effect on every element, on the frame of its picture (the same moments as the picture, from
   plan.ts), about one event a second, and a thin music bed. The mixer (sfx/mix.mjs) keeps it from getting busy: cooldowns, at most 3 one-shots at once. */
import type { SfxEvent } from "../../src/sfx.ts";
import type { SfxName } from "../../src/catalog.ts";
import type { StoryT } from "../../src/schema.ts";
import { FPS } from "../../src/timeline.ts";
import { makePlan } from "./plan.ts";

/** The bed under it all (render.mjs uses it because the story names none). */
export const music = { track: "bed-bounce", level: 0.8 } as const;

export function sfx(story: StoryT): SfxEvent[] {
  const P = makePlan(story), m = P.m, ev: SfxEvent[] = [];
  const add = (t: number, name: SfxName, why: string, vol = 1, extra: Partial<SfxEvent> = {}) => ev.push({ t: Math.round(Math.max(0, t) * FPS) / FPS, name, vol, why, ...extra });
  const label = (id: string, name: SfxName, vol = 1) => { const l = P.labels.find((x) => x.id === id); if (l) add(l.from + 0.05, name, `label "${l.text}"`, vol); };

  // hook (3 s): the wide shot, the push to the glass
  add(0.05, "whoosh", "the camera pushes in on the glass", 0.8);
  add(0.15, "thump", "the first headline lands", 0.6);
  add(1.5, "swish", "the push starts", 0.6);
  add(2.7, "glass-ting", "the glass shines", 0.6);
  // sting
  add(m.sting, "boing", "the mascot pops in");
  add(m.sting + 0.1, "jingle-sting", "Intip yuk!", 0.7);
  add(m.sting + 0.27, "pop", "the Intip yuk! pill");
  add(m.stingEnd - 0.15, "swish", "the mascot leaves", 0.6);
  // mulut (8 s): the mouth sucks, the pressure in the straw drops
  add(m.mulut + 0.05, "swish-soft", "headline: tekanan di sedotan turun", 0.7);
  add(m.mulut + 0.3, "whoosh", "the camera goes up to the mouth", 0.6);
  add(m.mulut + 1.0, "tick", "the lips close on the straw", 0.8);
  add(m.mulut + 1.6, "squeak", "the cheek starts to hollow", 0.5);
  add(m.mulut + 2.4, "puff", "air leaves the straw", 0.6);
  label("kecil", "pop-soft");
  // udara (8 s): the air presses on the drink
  add(m.udara + 0.05, "swish-soft", "headline: udara menekan minuman", 0.7);
  add(m.udara + 0.3, "whoosh", "the camera pans down to the glass", 0.6);
  add(m.udara + 0.9, "zip", "the air dots wake up", 0.6);
  add(m.udara + 1.0, "pop", "the first arrow presses down");
  add(m.udara + 1.3, "pop-soft", "the second arrow presses down", 0.8);
  label("besar", "pop-soft");
  add(m.udara + 4.4, "glass-ting", "the glass shines", 0.5);
  // dorong (9 s): the difference pushes the drink up the straw
  add(m.dorong + 0.05, "swish-soft", "headline: selisih tekanan mendorong", 0.7);
  add(m.dorong + 0.4, "swish", "the camera widens on the straw", 0.6);
  add(m.dorong + 1.0, "zip", "the yellow arrows start up the straw", 0.8);
  add(m.dorong + 1.1, "drip", "the drink starts to climb", 0.7);
  add(m.dorong + 2.0, "bubble-rise", "the drink climbs", 0.7, { dur: 1.6 });
  label("naik", "pop-soft");
  add(m.dorong + 3.4, "tick", "the drink passes the rim", 0.7);
  add(m.dorong + 4.4, "glass-ting", "the drink reaches the mouth", 0.8);
  add(m.dorong + 5.2, "drip", "the surface in the glass drops", 0.6);
  // batas (9 s): the very tall tube
  add(m.batas + 0.05, "swish-soft", "headline: air naik sekitar 10 meter", 0.7);
  add(m.batas + 0.3, "zoom-whoosh", "the camera goes far up and left", 0.8);
  add(m.batas + 1.0, "pop", "the tub appears", 0.7);
  add(m.batas + 1.4, "zip", "the tube grows up", 0.8, { dur: 1.2 });
  label("bak", "pop-soft");
  add(m.batas + 3.2, "bubble-rise", "the water climbs", 0.7, { dur: 2.4 });
  add(m.batas + 4.2, "tick", "the break mark", 0.6);
  label("laut", "chime");
  add(m.batas + 5.8, "tick", "the water stops at the line", 0.8);
  add(m.batas + 6.4, "glass-ting", "the top line shines", 0.7);
  // hasil (9 s): pushed, not pulled
  add(m.hasil + 0.05, "swish-soft", "headline: didorong, bukan ditarik", 0.7);
  add(m.hasil + 0.3, "whoosh", "the camera returns to the glass", 0.6);
  add(m.hasil + 1.4, "pop", "the arrows press down again");
  label("didorong", "pop-soft");
  add(m.hasil + 3.4, "swish", "the grey arrow up", 0.6);
  add(m.hasil + 3.7, "click-crack", "the cross over it", 0.7);
  label("ditarik", "huh", 0.7);
  add(m.hasil + 6.6, "glass-ting", "the glass shines", 0.5);
  // tips (9 s): two tip cards over the set
  add(m.tips + 0.05, "swish-soft", "headline: mulut turunkan, udara dorong", 0.7);
  add(m.tips + 0.3, "whoosh", "the camera drops to leave room", 0.6);
  add(m.tips + 1.2, "pop", "tip card 1");
  add(m.tips + 2.3, "chime", "tip 1", 0.7);
  add(m.tips + 4.4, "pop", "tip card 2");
  add(m.tips + 5.4, "chime-bright", "tip 2", 0.7);
  // outro: back to the wide shot
  add(m.outro + 0.1, "whoosh", "the camera eases back to the wide shot", 0.6);
  add(m.outro + 3.3, "jingle-outro", "loop", 0.6);
  return ev.sort((a, b) => a.t - b.t);
}
