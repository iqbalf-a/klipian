/* The sound of "Kenapa langit berwarna biru?": written by hand against plan.ts, one sound on the frame of each thing that enters, moves or changes
   (about one a second). Only plain .ts imports (render.mjs loads this file in Node). */
import type { SfxEvent } from "../../src/sfx.ts";
import type { SfxName } from "../../src/catalog.ts";
import type { StoryT } from "../../src/schema.ts";
import { FPS } from "../../src/timeline.ts";
import { makePlan } from "./plan.ts";

export const music = { track: "bed-curious", level: 0.8 } as const;

export function sfx(story: StoryT): SfxEvent[] {
  const P = makePlan(story), m = P.m, ev: SfxEvent[] = [];
  const add = (t: number, name: SfxName, why: string, vol = 1) => ev.push({ t: Math.round(Math.max(0, t) * FPS) / FPS, name, vol, why });

  // hook: the wide shot of the air column, the push in
  add(0, "hum", "the sun is on", 0.5);
  add(0.2, "tick", "kicker lands", 0.8);
  add(0.5, "swish-soft", "the headline", 0.7);
  add(1.5, "whoosh", "the establishing push to the column", 0.8);
  add(2.4, "glass-ting", "the glass of air catches the light");
  // sting
  add(m.sting, "boing", "the mascot pops in");
  add(m.sting + 0.1, "jingle-sting", "Intip yuk!", 0.7);
  add(m.sting + 0.27, "pop", "the pill");
  add(m.stingEnd - 0.15, "swish", "the mascot leaves", 0.6);
  // cahaya (7 s): the white beam meets the prism and splits
  add(m.cahaya + 0.05, "swish-soft", "headline: putih itu semua warna", 0.7);
  add(m.cahaya + 0.4, "whoosh", "the camera swings to the sun", 0.6);
  add(m.cahaya + 0.7, "pop", "the prism pops in");
  add(m.cahaya + 1.6, "zip", "the white beam hits the prism");
  add(m.cahaya + 1.9, "chime", "it splits into colours");
  [0, 1, 2, 3, 4].forEach((i) => add(m.cahaya + 2.0 + i * 0.25, "tick-soft", `colour ray ${i + 1} goes out`, 0.7));
  add(m.cahaya + 3.1, "pop-soft", "label: semua warna");
  add(m.cahaya + 4.6, "hum", "the sun hums", 0.4);
  add(m.cahaya + 6.2, "swish", "the prism leaves", 0.6);
  // udara (8 s): the light meets the gas of the air
  add(m.udara + 0.05, "swish-soft", "headline: menabrak gas di udara", 0.7);
  add(m.udara + 0.8, "whoosh", "the camera moves to the middle of the column", 0.6);
  [0, 1, 2, 3, 4].forEach((i) => add(m.udara + 0.6 + i * 0.4, "pop-soft", `gas molecule ${i + 1} appears`, 0.6));
  add(m.udara + 2.7, "pop-soft", "label: gas di udara");
  add(m.udara + 2.5, "puff", "the beam bumps into a molecule");
  [0, 1, 2].forEach((i) => add(m.udara + 3.2 + i * 0.9, "tick", `a flash of light bounces away ${i + 1}`, 0.7));
  add(m.udara + 6.2, "bubble-rise", "gas drifts", 0.5);
  add(m.udara + 7.2, "swish", "the camera starts to move down the beam", 0.5);
  // biru (8 s): blue is scattered, red goes straight
  add(m.biru + 0.05, "swish-soft", "headline: biru terhambur paling kuat", 0.7);
  add(m.biru + 0.3, "zip", "the beam splits in blue and red");
  add(m.biru + 1.2, "slide-whistle-down", "the camera slides down", 0.5);
  add(m.biru + 1.4, "chime-bright", "the blue stays in the air");
  [0, 1, 2, 3].forEach((i) => add(m.biru + 1.6 + i * 0.6, "pop-soft", `a blue drop flies out ${i + 1}`, 0.7));
  add(m.biru + 2.6, "pop-soft", "label: gelombang pendek");
  add(m.biru + 4.8, "pop-soft", "label: gelombang panjang");
  add(m.biru + 5.2, "sizzle", "red goes straight through", 0.5);
  add(m.biru + 6.6, "glass-ting", "the air glows blue", 0.8);
  // mata (8 s): blue arrives from everywhere
  add(m.mata + 0.05, "swish-soft", "headline: biru datang dari mana-mana", 0.7);
  add(m.mata + 0.5, "pop", "the eye appears");
  add(m.mata + 1.0, "huh", "the eye looks up", 0.6);
  [0, 1, 2, 3, 4, 5].forEach((i) => add(m.mata + 1.1 + i * 0.5, "tick-soft", `blue light reaches the eye ${i + 1}`, 0.7));
  add(m.mata + 2.6, "pop-soft", "label: dari segala arah");
  add(m.mata + 4.2, "whoosh", "the camera pulls back", 0.6);
  add(m.mata + 5.4, "chime", "the whole sky is blue", 0.7);
  add(m.mata + 7.0, "squeak", "the eye blinks", 0.5);
  // ungu (8 s): violet joins, the eye sees blue with white
  add(m.ungu + 0.05, "swish-soft", "headline: ungu ikut, tampak biru", 0.7);
  add(m.ungu + 0.5, "whoosh", "the camera pushes to the eye", 0.6);
  [0, 1, 2].forEach((i) => add(m.ungu + 1.0 + i * 0.7, "tick", `a violet drop reaches the eye ${i + 1}`, 0.7));
  add(m.ungu + 3.7, "boing", "the colour chip pops up");
  add(m.ungu + 4.3, "pop-soft", "label: biru keputihan");
  add(m.ungu + 5.4, "chime-bright", "the eye makes blue with white", 0.8);
  add(m.ungu + 7.2, "swish", "the camera leaves the eye", 0.5);
  // senja (9 s): the sun goes down, the light crosses a long layer of air
  add(m.senja + 0.05, "swish-soft", "headline: senja, biru habis", 0.7);
  add(m.senja + 0.4, "slide-whistle-down", "the sun sinks", 0.7);
  add(m.senja + 1.6, "whoosh", "the camera pans to the far left", 0.7);
  add(m.senja + 2.0, "hum", "a long low layer of air", 0.5);
  add(m.senja + 2.6, "pop-soft", "label: udara lebih panjang");
  [0, 1, 2, 3].forEach((i) => add(m.senja + 3.0 + i * 0.6, "pop-soft", `blue is thrown out ${i + 1}`, 0.7));
  add(m.senja + 5.4, "sizzle", "the light turns red", 0.7);
  add(m.senja + 5.6, "pop-soft", "label: tersisa merah");
  add(m.senja + 7.0, "chime", "the red light reaches the eye", 0.7);
  add(m.senja + 8.2, "swish", "the camera starts to come back", 0.5);
  // hasil (4 s): back to the blue sky
  add(m.hasil + 0.05, "swish-soft", "headline: udara menghamburkan biru", 0.7);
  add(m.hasil + 0.5, "slide-whistle-down", "the sun climbs back up", 0.4);
  add(m.hasil + 1.2, "glass-ting", "the air turns blue again", 0.8);
  add(m.hasil + 3.0, "tick", "the camera settles", 0.6);
  // outro: back to the opening shot, nothing is said
  add(m.outro + 0.1, "whoosh", "the loop-back pulls out to the wide shot", 0.7);
  add(m.outro + 1.6, "glass-ting", "the air clears", 0.5);
  add(m.outro + 2.8, "jingle-outro", "the loop closes", 0.6);
  return ev.sort((a, b) => a.t - b.t);
}
