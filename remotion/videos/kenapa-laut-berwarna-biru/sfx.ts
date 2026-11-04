/* The sound of "Kenapa laut berwarna biru?": written by hand against plan.ts, one sound on the frame of each thing that enters, moves or changes
   (about one a second). Only plain .ts imports (render.mjs loads this file in Node). */
import type { SfxEvent } from "../../src/sfx.ts";
import type { SfxName } from "../../src/catalog.ts";
import type { StoryT } from "../../src/schema.ts";
import { FPS } from "../../src/timeline.ts";
import { makePlan } from "./plan.ts";

export const music = { track: "bed-glow", level: 0.8 } as const;

export function sfx(story: StoryT): SfxEvent[] {
  const P = makePlan(story), m = P.m, ev: SfxEvent[] = [];
  const add = (t: number, name: SfxName, why: string, vol = 1) => ev.push({ t: Math.round(Math.max(0, t) * FPS) / FPS, name, vol, why });

  // hook: the bench, the lamp, the push in on the tank
  add(0, "hum", "the lamp is on", 0.5);
  add(0.2, "tick", "kicker lands", 0.8);
  add(0.5, "swish-soft", "the headline", 0.7);
  add(1.5, "whoosh", "the establishing push to the tank", 0.8);
  add(2.4, "glass-ting", "the water catches the light");
  // sting
  add(m.sting, "boing", "the mascot pops in");
  add(m.sting + 0.1, "jingle-sting", "Intip yuk!", 0.7);
  add(m.sting + 0.27, "pop", "the pill");
  add(m.stingEnd - 0.15, "swish", "the mascot leaves", 0.6);
  // cahaya (7 s): the white light enters and splits
  add(m.cahaya + 0.05, "swish-soft", "headline: campuran banyak warna", 0.7);
  add(m.cahaya + 0.9, "zip", "the white beam reaches the surface");
  add(m.cahaya + 1.2, "chime", "it splits into colours");
  [0, 1, 2, 3, 4].forEach((i) => add(m.cahaya + 1.25 + i * 0.3, "tick-soft", `colour strip ${i + 1} goes down`, 0.7));
  add(m.cahaya + 2.6, "pop-soft", "label: semua warna");
  add(m.cahaya + 4.2, "drip", "a drop in the water", 0.6);
  add(m.cahaya + 5.5, "swish", "the camera drifts to the tank", 0.5);
  // serap (8 s): red is absorbed first
  add(m.serap + 0.05, "swish-soft", "headline: merah habis duluan", 0.7);
  add(m.serap + 0.4, "whoosh", "the camera pans over", 0.6);
  add(m.serap + 1.4, "blip-alert", "the red strip starts to fade");
  add(m.serap + 2.2, "sizzle", "the red is soaked up", 0.6);
  add(m.serap + 2.9, "squeak", "orange follows", 0.6);
  add(m.serap + 3.6, "tick", "yellow follows", 0.7);
  add(m.serap + 4.6, "tick-soft", "green follows");
  add(m.serap + 1.6, "pop-soft", "label: merah habis");
  add(m.serap + 5.6, "bubble-rise", "bubbles in the tank", 0.7);
  add(m.serap + 6.8, "hum", "the deep water darkens", 0.5);
  // sebar (8 s): the blue stays and is scattered
  add(m.sebar + 0.05, "swish-soft", "headline: biru menyebar", 0.7);
  add(m.sebar + 0.8, "chime-bright", "the blue stays");
  [0, 1, 2, 3].forEach((i) => add(m.sebar + 1 + i * 0.7, "pop-soft", `a blue drop flies out ${i + 1}`, 0.7));
  add(m.sebar + 1.2, "pop-soft", "label: biru menyebar");
  add(m.sebar + 4.2, "bubble-rise", "bubbles", 0.6);
  add(m.sebar + 5.2, "glass-ting", "the tank glows blue", 0.8);
  add(m.sebar + 6.6, "whoosh", "the camera pulls back", 0.6);
  // hasil (8 s): the blue arrives at the eye
  add(m.hasil + 0.05, "swish-soft", "headline: biru sampai ke mata", 0.7);
  add(m.hasil + 0.6, "pop", "an eye appears");
  [0, 1, 2, 3, 4].forEach((i) => add(m.hasil + 1.0 + i * 0.7, "tick-soft", `blue light travels to the eye ${i + 1}`, 0.7));
  add(m.hasil + 2.0, "pop-soft", "label: sampai ke mata");
  add(m.hasil + 4.8, "huh", "the eye blinks", 0.6);
  add(m.hasil + 6.2, "chime", "the sea is blue", 0.7);
  // langit (7 s): not only a mirror of the sky
  add(m.langit + 0.05, "swish-soft", "headline: bukan cuma pantulan", 0.7);
  add(m.langit + 0.4, "whoosh", "the camera rises to the surface", 0.6);
  add(m.langit + 0.8, "pop", "a cloud floats in");
  add(m.langit + 1.5, "zip", "the sky's reflection bounces off the surface", 0.8);
  add(m.langit + 2.2, "pop-soft", "label: bukan cuma langit");
  add(m.langit + 3.4, "drip", "the surface ripples", 0.7);
  add(m.langit + 5.0, "tick", "the beam keeps going down", 0.7);
  add(m.langit + 6.3, "swish", "the cloud leaves", 0.6);
  // dalam (8 s): the depth scale
  add(m.dalam + 0.05, "swish-soft", "headline: biru menembus lebih dalam", 0.7);
  add(m.dalam + 0.4, "thump", "the depth scale stands up", 0.8);
  [0, 1, 2, 3].forEach((i) => add(m.dalam + 0.8 + i * 0.35, "tick-soft", `scale mark ${i + 1}`, 0.7));
  add(m.dalam + 2.0, "pop-soft", "label: merah 50 m");
  add(m.dalam + 3.0, "slide-whistle-down", "the camera follows the scale down", 0.6);
  add(m.dalam + 4.2, "pop-soft", "label: biru 200 m");
  add(m.dalam + 4.6, "zip", "the blue strip runs the whole column");
  add(m.dalam + 6.3, "bubble-rise", "bubbles", 0.6);
  // pantai (6 s): sediment turns the water green
  add(m.pantai + 0.05, "swish-soft", "headline: bisa hijau, bisa cokelat", 0.7);
  add(m.pantai + 0.4, "whoosh", "the camera pans to the beaker", 0.6);
  add(m.pantai + 0.9, "puff", "the sediment is stirred up");
  add(m.pantai + 1.5, "bubble-rise", "sediment drifts up", 0.7);
  add(m.pantai + 1.8, "pop-soft", "label: keruh jadi hijau");
  add(m.pantai + 3.0, "drip", "a drop falls into the beaker", 0.7);
  add(m.pantai + 4.4, "tick", "the murk settles in", 0.7);
  add(m.pantai + 5.4, "swish", "the camera starts to pull back", 0.6);
  // outro: back to the opening shot, nothing else is said
  add(m.outro + 0.1, "whoosh", "the loop-back pulls out to the wide shot", 0.7);
  add(m.outro + 1.6, "glass-ting", "the water clears", 0.5);
  add(m.outro + 2.8, "jingle-outro", "the loop closes", 0.6);
  return ev.sort((a, b) => a.t - b.t);
}
