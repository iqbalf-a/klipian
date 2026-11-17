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
  // hook: the wide shot, the push to the fingertip in the water
  add(0.2, "pop-soft", "kicker and headline come in", 0.8); add(0.8, "drip", "the water ripples round the finger", 0.5); add(T.push, "whoosh", "the establishing push", 0.8); add(2.5, "bubble-rise", "bubbles rise along the finger", 0.4);
  // sting
  add(3.0, "boing", "the mascot pops in"); add(3.1, "jingle-sting", "Intip yuk!", 0.7); add(3.27, "pop", "the pill"); add(3.85, "swish", "the mascot leaves", 0.6);
  // dulu: drops fly to the pad and soak in, the finger swells a little
  add(4.1, "swish-soft", "headline", 0.7); add(T.drop1, "drip", "drop 1 soaks in", 0.8); add(T.drop2, "drip", "drop 2 soaks in", 0.8); add(T.drop3, "drip", "drop 3 soaks in", 0.8); add(T.drop4, "drip", "drop 4 soaks in", 0.8);
  add(T.swellA + 0.6, "puff", "the finger swells a little", 0.6); add(10.3, "swish", "the camera moves on", 0.6);
  // saraf: the nerve lights up and a signal runs down it
  add(11.1, "swish-soft", "headline", 0.7); add(T.nerveOn - 0.3, "whoosh", "the pan out to the whole fingertip", 0.8); add(T.nerveOn, "glass-ting", "the nerve appears", 0.8); add(T.signalA, "hum", "the signal runs along the nerve", 0.5);
  add(14.6, "tick-soft", "a signal dot", 0.5); add(T.pulse, "blip-alert", "the nerve fires at the pad", 0.5);
  add(15.4, "tick-soft", "a signal dot", 0.4); add(17.6, "tick-soft", "a signal dot", 0.4); add(19.6, "swish", "the camera leaves", 0.6);
  // darah: the vessels narrow, the skin folds, the front view of the pad shows the grooves
  add(20.1, "swish-soft", "headline", 0.7); add(T.vesselOn - 0.3, "whoosh", "the pan to the pad's vessels", 0.7); add(T.vesselOn, "thump", "the vessels appear", 0.5);
  add(T.vesselA + 0.4, "squeak", "the vessels begin to narrow"); add(T.wrinkleUp, "swish-soft", "the first folds show", 0.6); add(T.insetOn, "pop", "the front view of the pad", 0.8);
  add(24.4, "tick", "a groove", 0.5); add(25.6, "tick", "a groove", 0.5); add(26.7, "tick", "a groove", 0.5); add(T.wrinkleTop, "thump", "the fingertip is wrinkled", 0.6); add(28.4, "swish", "the camera moves on", 0.6);
  // guna: the wet slab slides in, the water is pushed out along the grooves
  add(29.1, "swish-soft", "headline", 0.7); add(T.barIn, "whoosh", "the wet slab slides in", 0.8); add(T.touch, "squeak", "the pad grips the slab", 0.8);
  add(T.drainA, "bubble-rise", "water is pushed out along the grooves", 0.7); add(33.0, "drip", "water runs down the film", 0.5); add(35.0, "drip", "water runs down the film", 0.5); add(36.4, "tick-soft", "the grip holds", 0.5); add(T.barOut, "swish", "the slab slides away", 0.6);
  // ujung: the tip, the thick keratin, the hairs of the back
  add(38.1, "swish-soft", "headline", 0.7); add(T.tipPan, "zoom-whoosh", "the push in on the tip", 0.6); add(41.4, "tick-soft", "the thick skin of the tip", 0.4);
  add(T.hairOn, "pop-soft", "the hairs grow out", 0.6); add(44.2, "swish-soft", "the hairs sway", 0.4); add(45.5, "swish", "the camera leaves the finger", 0.6);
  // debat: the balance
  add(46.1, "swish-soft", "headline", 0.7); add(T.scaleIn - 0.4, "whoosh", "the pan out to the finger and the balance", 0.8); add(T.scaleIn, "pop", "the balance appears");
  add(T.scaleIn + 0.9, "glass-ting", "the pan of 2014", 0.7); add(T.scaleIn + 1.4, "glass-ting", "the pan of 2021", 0.7); add(50.6, "slide-whistle-down", "the beam swings", 0.5);
  add(53.2, "tick-soft", "the balance settles", 0.4);
  // the labels: a tick as each one lands (a soft huh for the question mark)
  for (const l of LABELS) add(l.from + 0.1, l.id === "ujung" ? "huh" : "tick", `label "${l.text}"`, 0.7);
  // outro: the folds ease away, the camera backs off to the wide shot
  add(T.wrinkleDown, "swish-soft", "the folds ease away", 0.5); add(57.2, "whoosh", "the camera backs off to the wide shot", 0.6); add(59.2, "jingle-outro", "the loop-back", 0.5);
  return ev.sort((a, b) => a.t - b.t);
}
