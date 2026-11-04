/* The sound of "Kenapa gelembung sabun berwarna-warni?": written by hand against plan.ts, one sound on the frame of each thing that enters, moves or
   changes (about one a second). Only plain .ts imports (render.mjs loads this file in Node). */
import type { SfxEvent } from "../../src/sfx.ts";
import type { SfxName } from "../../src/catalog.ts";
import type { StoryT } from "../../src/schema.ts";
import { FPS } from "../../src/timeline.ts";
import { makePlan } from "./plan.ts";

export const music = { track: "bed-curious", level: 0.8 } as const;

export function sfx(story: StoryT): SfxEvent[] {
  const P = makePlan(story), m = P.m, ev: SfxEvent[] = [];
  const add = (t: number, name: SfxName, why: string, vol = 1) => ev.push({ t: Math.round(Math.max(0, t) * FPS) / FPS, name, vol, why });
  const label = (id: string, name: SfxName = "pop-soft", vol = 0.8) => { const l = P.labels.find((x) => x.id === id); if (l) add(l.from, name, `label: ${l.text}`, vol); };

  // hook: the bathroom, the bubble floating, the push in
  add(0, "bubble-rise", "the bubble floats over the tub", 0.6);
  add(0.2, "tick", "kicker lands", 0.8);
  add(0.5, "swish-soft", "the headline", 0.7);
  add(1.5, "whoosh", "the establishing push to the bubble", 0.8);
  add(2.5, "glass-ting", "the bubble shines", 0.7);
  // sting
  add(m.sting, "boing", "the mascot pops in");
  add(m.sting + 0.1, "jingle-sting", "Intip yuk!", 0.7);
  add(m.sting + 0.27, "pop", "the pill");
  add(m.stingEnd - 0.15, "swish", "the mascot leaves", 0.6);
  // lapis (6 s): the skin of the bubble is a thin film
  add(m.lapis + 0.05, "swish-soft", "headline: setipis gelombang cahaya", 0.7);
  add(m.lapis + 0.8, "swish", "the camera drifts in", 0.5);
  label("tipis", "tick");
  add(m.lapis + 2.5, "drip", "a foam bubble bobs in the tub", 0.5);
  label("nm", "pop-soft");
  add(m.lapis + 4.6, "glass-ting", "the bands shimmer", 0.6);
  add(m.lapis + 5.5, "bubble-rise", "a small bubble drifts up", 0.6);
  // pantul (8 s): the lens into the film
  add(m.pantul, "zoom-whoosh", "the lens opens on the film");
  add(m.pantul + 0.1, "swish-soft", "headline: cahaya memantul dua kali", 0.7);
  add(m.pantul + 0.8, "glass-ting", "inside the film", 0.6);
  add(m.pantul + 1.0, "zip", "the light comes in");
  add(m.pantul + 2.0, "chime", "reflection 1 from the outer surface");
  add(m.pantul + 2.2, "tick", "label: permukaan luar", 0.8);
  add(m.pantul + 2.6, "pop", "badge 1");
  add(m.pantul + 3.6, "swish", "the light goes into the film", 0.6);
  add(m.pantul + 4.0, "tick", "label: permukaan dalam", 0.8);
  add(m.pantul + 4.6, "chime-bright", "reflection 2 from the inner surface");
  add(m.pantul + 5.2, "pop", "badge 2");
  add(m.pantul + 6.4, "hum", "two reflections side by side", 0.4);
  add(m.tabrak - 0.6, "zoom-whoosh", "the lens closes", 0.7);
  // tabrak (8 s): in step they add up, out of step they cancel
  add(m.tabrak + 0.05, "swish-soft", "headline: ada yang menguat", 0.7);
  add(m.tabrak + 0.3, "whoosh", "the camera pans beside the bubble", 0.6);
  add(m.tabrak + 1.3, "pop", "card: two waves in step");
  label("kuat", "chime-bright", 0.8);
  add(m.tabrak + 3.2, "hum", "the waves roll", 0.4);
  add(m.tabrak + 4.2, "pop", "card: two waves out of step");
  label("hapus", "slide-whistle-down", 0.7);
  add(m.tabrak + 6.6, "glass-ting", "the bands shimmer", 0.6);
  // tebal (7 s): thickness picks the colour
  add(m.tebal + 0.05, "swish-soft", "headline: beda tebal, beda warna", 0.7);
  add(m.tebal + 0.4, "swish", "the camera moves back to the bubble", 0.5);
  add(m.tebal + 1.2, "zip", "the thickness wedge slides in");
  label("atas", "tick");
  label("bawah", "tick");
  [0, 1, 2, 3, 4].forEach((i) => add(m.tebal + 2.4 + i * 0.8, "tick-soft", `contour band ${i + 1} lights up`, 0.7));
  // turun (8 s): it drains, evaporates, goes black and pops
  add(m.turun + 0.05, "swish-soft", "headline: atas menipis, lalu pecah", 0.7);
  add(m.turun + 0.6, "drip", "water runs down the film");
  label("turun", "pop-soft");
  add(m.turun + 1.8, "drip", "more water runs down", 0.7);
  add(m.turun + 2.2, "puff", "the film evaporates", 0.6);
  label("uap", "tick");
  add(m.turun + 3.6, "huh", "a dark spot appears", 0.6);
  label("hitam", "blip-alert", 0.7);
  add(m.turun + 5.4, "squeak", "the black cap grows", 0.5);
  add(P.pop, "pop", "the bubble bursts");
  add(P.pop + 0.15, "rain-patter", "the droplets fall", 0.5);
  label("pecah", "boing", 0.6);
  // pewarna (6 s): dye in the pot, the new bubble is still clear
  add(m.pewarna + 0.05, "swish-soft", "headline: dikasih pewarna? tetap bening", 0.7);
  add(m.pewarna + 0.3, "whoosh", "the camera pans to the pot", 0.6);
  add(m.pewarna + 0.6, "swish", "the pipette slides in", 0.6);
  add(m.pewarna + 1.5, "drip", "the drop of dye");
  label("pewarna", "tick");
  add(m.pewarna + 2.0, "swish-soft", "the wand rises", 0.7);
  add(P.blow, "bubble-rise", "a new bubble on the wand");
  label("bening", "chime");
  add(m.pewarna + 5.2, "glass-ting", "the new bubble shines", 0.6);
  // tips (9 s): two tip cards, the bubble floats back over the tub
  add(m.tips + 0.05, "swish-soft", "headline: gliserin dan udara lembap", 0.7);
  add(m.tips + 0.3, "whoosh", "the camera pans back with the bubble", 0.6);
  add(m.tips + 1.2, "pop", "tip card 1");
  add(m.tips + 2.4, "tick", "tip 1 line", 0.7);
  add(m.tips + 3.4, "bubble-rise", "a small bubble drifts", 0.5);
  add(m.tips + 4.6, "pop", "tip card 2");
  add(m.tips + 5.8, "tick", "tip 2 line", 0.7);
  add(m.tips + 7.2, "glass-ting", "the bubble shimmers", 0.6);
  // outro: back to the wide shot
  add(m.outro + 0.1, "whoosh", "the camera eases back to the wide shot", 0.6);
  add(m.outro + 2.2, "bubble-rise", "the bubble bobs", 0.5);
  add(m.outro + 3.3, "jingle-outro", "loop", 0.6);
  return ev.sort((a, b) => a.t - b.t);
}
