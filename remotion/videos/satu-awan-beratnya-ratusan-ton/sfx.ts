/* The sound of "Satu awan beratnya ratusan ton": an effect on the frame of each picture (the moments are plan.ts's), about one a second, only the approved sounds (B15). */
import type { SfxEvent } from "../../src/sfx.ts";
import type { SfxName } from "../../src/catalog.ts";
import type { StoryT } from "../../src/schema.ts";
import { FPS } from "../../src/timeline.ts";
import { makePlan } from "./plan.ts";

export const music = { track: "bed-curious", level: 0.8 } as const;

export function sfx(story: StoryT): SfxEvent[] {
  const P = makePlan(story), m = P.m, ev: SfxEvent[] = [];
  const add = (t: number, name: SfxName, why: string, vol = 1) => ev.push({ t: Math.round(Math.max(0, t) * FPS) / FPS, name, vol, why });
  add(0, "whoosh", "the camera pushes in on the diorama", 0.8);
  add(0.4, "thump", "the cloud settles", 0.5);
  add(1.2, "swish-soft", "the hook text", 0.6);
  add(2.0, "tick", "the camera settles on the cloud", 0.7);
  add(m.sting, "boing", "the mascot pops in");
  add(m.sting + 0.1, "jingle-sting", "Intip yuk!", 0.7);
  add(m.sting + 0.27, "pop", "the Intip yuk! pill");
  add(m.stingEnd - 0.15, "swish", "the mascot leaves", 0.6);
  // ukuran
  add(m.ukuran + 0.1, "swish-soft", "headline: lebar sekitar 1 km", 0.6);
  add(m.ruler, "zip", "the ruler draws across the cloud");
  add(m.ruler + 0.8, "tick", "the end ticks of the ruler", 0.7);
  add(m.ukuran + 4.2, "whoosh", "the camera pulls back", 0.5);
  add(m.ukuran + 5.8, "tick-soft", "the cube outline", 0.6);
  // isi
  add(m.isi, "zoom-whoosh", "the camera dives into the cloud", 0.7);
  [0, 0.7, 1.4, 2.1, 2.8, 3.5].forEach((d, i) => add(m.drops + d, "drip", "a droplet appears", 0.7 - i * 0.05));
  add(m.isi + 5.2, "bubble-rise", "half a gram: only a marble's worth", 0.6);
  add(m.isi + 7, "pop-soft", "the mark of half a gram", 0.6);
  // hitung
  add(m.hitung, "swish", "headline: hampir 500.000 kg", 0.6);
  [0, 0.5, 1.0, 1.5, 2.0].forEach((d, i) => add(m.hitung + 0.8 + d, "bubble-rise", "the droplets multiply", 0.55 - i * 0.05));
  add(m.many, "zip", "a billion cubic metres", 0.7);
  add(m.times, "chime", "the answer", 0.8);
  add(m.hitung + 7, "thump", "it is heavy", 0.7);
  // gajah
  add(m.gajah, "whoosh", "the camera goes down to the land", 0.6);
  for (let i = 0; i < 6; i++) add(m.eleFrom + i * 0.6, i % 2 ? "thump" : "pop-soft", "an elephant steps in", 0.6);
  add(m.gajah + 1.0, "chime-bright", "the 100 disc", 0.8);
  add(m.gajah + 6.5, "swish-soft", "the elephants leave", 0.5);
  // melayang
  add(m.melayang, "swish", "headline: berat tersebar luas", 0.6);
  add(m.melayang + 1.2, "whoosh", "the camera pans up", 0.6);
  [0, 0.6, 1.2, 1.8, 2.4].forEach((d, i) => add(m.air + d, "puff", "air rises under the cloud", 0.5 - i * 0.04));
  add(m.melayang + 6, "tick", "the weight is spread out", 0.7);
  // kecil
  add(m.kecil, "zoom-whoosh", "the camera pushes in on the tiny droplets", 0.7);
  [0.8, 1.6, 2.4, 3.2, 4.0].forEach((d, i) => add(m.kecil + d, "bubble-rise", "a droplet floats", 0.5 - i * 0.04));
  add(m.kecil + 5, "glass-ting", "lighter than dry air", 0.7);
  // hasil
  add(m.hasil, "swish", "headline: berat, tapi melayang", 0.6);
  add(m.hasil + 1.0, "chime", "heavy yet afloat", 0.8);
  add(m.hasil + 3.0, "boing", "the cloud bobs", 0.6);
  add(m.hasil + 4.5, "swish-soft", "the camera eases back", 0.5);
  const kept: SfxEvent[] = [];
  for (const e of ev.sort((a, b) => a.t - b.t)) if (!kept.some((k) => k.name === e.name && Math.abs(k.t - e.t) < 0.2)) kept.push(e);
  return kept;
}
