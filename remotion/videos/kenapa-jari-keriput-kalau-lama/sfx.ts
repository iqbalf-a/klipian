/* The sound of "Kenapa jari keriput kalau lama di air?", written by hand against index.tsx: a sound on every object that enters, every camera move, every label and
   every state change, on the frame of its picture (the moments come from plan.ts). About one event a second. Only names of the locked set in src/catalog.ts. */
import type { SfxEvent } from "../../src/sfx.ts";
import type { SfxName } from "../../src/catalog.ts";
import type { StoryT } from "../../src/schema.ts";
import { FPS } from "../../src/timeline.ts";
import { LABELS, T } from "./plan.ts";

export const music = { track: "bed-curious", level: 0.8 } as const;

export function sfx(_story: StoryT): SfxEvent[] {
  const ev: SfxEvent[] = [];
  const add = (t: number, name: SfxName, why: string, vol = 1) => ev.push({ t: Math.round(Math.max(0, t) * FPS) / FPS, name, vol, why });
  // hook: the wide shot, the push to the finger
  add(0.2, "pop-soft", "kicker and headline come in", 0.8); add(0.8, "drip", "the pool ripples", 0.5); add(T.push, "whoosh", "the establishing push", 0.8); add(2.5, "bubble-rise", "bubbles drift past the lens", 0.4);
  // sting
  add(3.0, "boing", "the mascot pops in"); add(3.1, "jingle-sting", "Intip yuk!", 0.7); add(3.27, "pop", "the pill"); add(3.85, "swish", "the mascot leaves", 0.6);
  // dulu: drops land, the finger is thought to swell
  add(4.1, "swish-soft", "headline", 0.7); add(T.drop1, "drip", "drop 1 lands", 0.8); add(T.drop2, "drip", "drop 2 lands", 0.8); add(T.drop3, "drip", "drop 3 lands", 0.8); add(T.drop4, "drip", "drop 4 lands", 0.8);
  add(T.swell, "puff", "the finger swells a little", 0.6); add(10.3, "swish", "the camera moves on", 0.6);
  // saraf: the slice comes in, the nerve carries a signal
  add(11.1, "swish-soft", "headline", 0.7); add(T.sliceIn - 0.3, "whoosh", "the pan to the slice", 0.8); add(T.nerveOn, "hum", "the signal runs along the nerve", 0.5);
  add(T.sliceIn, "glass-ting", "the slice of the finger", 0.8); add(14.6, "tick-soft", "a signal dot reaches the slice", 0.5); add(T.pulse, "blip-alert", "the nerve fires", 0.5);
  add(15.4, "tick-soft", "a signal dot", 0.4); add(17.6, "tick-soft", "a signal dot", 0.4); add(19.6, "swish", "the camera leaves", 0.6);
  // darah: the vessels narrow, the skin loses tension, the wrinkles build
  add(20.1, "swish-soft", "headline", 0.7); add(T.vesselOn - 0.3, "whoosh", "the pan out to slice and heart", 0.7); add(T.heartOn, "thump", "the heart beats", 0.5);
  add(T.vesselOn, "squeak", "the vessels begin to narrow"); add(23.4, "rattle", "the skin of the slice ripples", 0.4); add(T.wrinkleUp, "swish-soft", "the first wrinkles show", 0.6);
  add(24.4, "tick", "wrinkle", 0.5); add(25.6, "tick", "wrinkle", 0.5); add(26.7, "tick", "wrinkle", 0.5); add(T.wrinkleTop, "thump", "the finger is wrinkled", 0.6); add(28.4, "swish", "the camera moves on", 0.6);
  // guna: the wet bar, the grip, the water pushed out
  add(29.1, "swish-soft", "headline", 0.7); add(T.bar - 0.3, "whoosh", "the pan to the fingertip", 0.8); add(T.bar, "thump", "the wet bar slides in", 0.7);
  add(T.gripOn + 0.2, "squeak", "the fingertip grips the bar", 0.7); add(T.drain, "bubble-rise", "water is pushed out along the grooves", 0.7);
  add(33.0, "drip", "water drips off", 0.5); add(35.0, "drip", "water drips off", 0.5); add(36.4, "tick-soft", "the grip holds", 0.5); add(37.9, "swish", "the camera moves on", 0.6);
  // ujung: the tip, the keratin, no hair
  add(38.1, "swish-soft", "headline", 0.7); add(T.tipPan, "zoom-whoosh", "the push in on the tip", 0.6); add(41.4, "tick-soft", "the skin of the tip", 0.4);
  add(T.hairOn, "pop-soft", "the hairs appear", 0.6); add(44.2, "swish-soft", "the hairs sway", 0.4); add(45.5, "swish", "the camera leaves the tip", 0.6);
  // debat: the scale
  add(46.1, "swish-soft", "headline", 0.7); add(T.scale - 0.4, "whoosh", "the pan out to the whole finger", 0.8); add(T.scale, "pop", "the scale appears");
  add(T.scale + 0.3, "glass-ting", "the plate of 2014", 0.7); add(T.scale + 0.7, "glass-ting", "the plate of 2021", 0.7); add(50.2, "slide-whistle-down", "the beam tilts", 0.5);
  add(53.2, "tick-soft", "the scale settles", 0.4);
  // the labels: a tick as each one lands (a warning-free soft pop for the question marks)
  for (const l of LABELS) add(l.from + 0.1, l.id === "ujung" ? "huh" : "tick", `label "${l.text}"`, 0.7);
  // outro: the wrinkles ease away, the camera backs off to the wide shot, one soft thump as the finger is smooth again
  add(T.wrinkleDown, "swish-soft", "the wrinkles ease away", 0.5); add(57.2, "whoosh", "the camera backs off to the wide shot", 0.6); add(59.2, "jingle-outro", "the loop-back", 0.5);
  return ev.sort((a, b) => a.t - b.t);
}
