/* The sound of "Satu gelas air punya lebih banyak molekul daripada gelas di lautan": an effect on every element, on the frame of its picture (the same moments as the picture, from
   plan.ts), about one event a second, and a thin music bed. The mixer (sfx/mix.mjs) keeps it from getting busy: cooldowns, at most 3 one-shots at once. */
import type { SfxEvent } from "../../src/sfx.ts";
import type { SfxName } from "../../src/catalog.ts";
import type { StoryT } from "../../src/schema.ts";
import { FPS } from "../../src/timeline.ts";
import { makePlan } from "./plan.ts";

/** The bed under it all (render.mjs uses it because the story names none). */
export const music = { track: "bed-curious", level: 0.8 } as const;

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
  // gelas (7 s): one glass of water
  add(m.gelas + 0.05, "swish-soft", "headline: segelas air", 0.7);
  add(m.gelas + 0.3, "drip", "the water in the glass ripples", 0.6);
  add(m.gelas + 1.0, "tick", "the camera settles on the glass", 0.6);
  label("ml", "pop-soft");
  add(m.gelas + 2.6, "bubble-rise", "a molecule drifts in the water", 0.5);
  label("gram", "pop-soft");
  add(m.gelas + 5.2, "glass-ting", "the glass shines", 0.5);
  // molekul (8 s): zoom into the water
  add(m.molekul + 0.05, "swish-soft", "headline: isi gelas", 0.7);
  add(m.molekul + 0.3, "zoom-whoosh", "the camera dives into the water", 0.8);
  add(m.molekul + 1.4, "zip", "molecules come into focus", 0.7);
  add(m.molekul + 1.7, "tick-soft", "one molecule jiggles", 0.5);
  label("satu", "pop");
  add(m.molekul + 3.4, "bubble-rise", "the crowd of molecules moves", 0.6, { dur: 1.4 });
  label("isi", "chime", 0.9);
  add(m.molekul + 6.4, "glass-ting", "the big number shines", 0.6);
  // lautan (8 s): the tank of tiny glasses
  add(m.lautan + 0.05, "swish-soft", "headline: isi lautan", 0.7);
  add(m.lautan + 0.3, "whoosh", "the camera pans left to the tank", 0.7);
  add(m.lautan + 1.4, "thump", "the tank comes into the frame", 0.7);
  label("laut", "pop");
  add(m.lautan + 2.7, "zip", "the rows of tiny glasses start to fill", 0.7, { dur: 1.6 });
  add(m.lautan + 3.2, "bubble-rise", "the tank fills from the bottom", 0.6, { dur: 2.4 });
  label("gelasN", "chime", 0.9);
  add(m.lautan + 6.4, "glass-ting", "the tank shines", 0.5);
  // banding (8 s): the balance
  add(m.banding + 0.05, "swish-soft", "headline: bandingkan", 0.7);
  add(m.banding + 0.3, "whoosh", "the camera pans right to the balance", 0.7);
  add(m.banding + 1.4, "pop", "the balance comes into the frame", 0.7);
  label("kiri", "pop-soft");
  label("kanan", "pop-soft");
  add(m.banding + 3.2, "slide-whistle-down", "the beam starts to tip", 0.7);
  add(m.banding + 4.8, "thump", "the right pan settles", 0.8);
  add(m.banding + 5.0, "rattle", "the strings shake", 0.5);
  add(m.banding + 5.6, "chime-bright", "the arrow marks the winner", 0.7);
  // hasil (7 s): the verdict at the glass
  add(m.hasil + 0.05, "swish-soft", "headline: faktanya", 0.7);
  add(m.hasil + 0.3, "whoosh", "the camera returns to the glass", 0.7);
  add(m.hasil + 1.8, "pop", "the check mark pops", 0.9);
  label("fakta", "chime", 0.9);
  add(m.hasil + 4.4, "glass-ting", "the glass shines", 0.6);
  // sendok (6 s): a teaspoon
  add(m.sendok + 0.05, "swish-soft", "headline: sendok teh", 0.7);
  add(m.sendok + 0.3, "whoosh", "the camera slides to the spoon", 0.7);
  add(m.sendok + 1.3, "tick", "the spoon settles", 0.7);
  label("lima", "pop-soft");
  label("sdk", "chime", 0.9);
  add(m.sendok + 4.6, "drip", "a drop trembles in the spoon", 0.5);
  // tips (8 s): two tip cards over the set
  add(m.tips + 0.05, "swish-soft", "headline: dua hal", 0.7);
  add(m.tips + 0.3, "whoosh", "the camera drops back to leave room", 0.6);
  add(m.tips + 1.2, "pop", "tip card 1");
  add(m.tips + 2.3, "chime", "tip 1", 0.7);
  add(m.tips + 4.2, "pop", "tip card 2");
  add(m.tips + 5.3, "chime-bright", "tip 2", 0.7);
  // outro: back to the wide shot
  add(m.outro + 0.1, "whoosh", "the camera eases back to the wide shot", 0.6);
  add(m.outro + 3.3, "jingle-outro", "loop", 0.6);
  return ev.sort((a, b) => a.t - b.t);
}
