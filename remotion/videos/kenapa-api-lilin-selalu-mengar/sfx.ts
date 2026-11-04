/* The sound of "Kenapa api lilin selalu mengarah ke atas?", written by hand against index.tsx: a sound on every object that enters, every camera move,
   every label and card and every state change, on the frame of its picture (the moments come from plan.ts). About one event a second. Only names of the
   locked set in src/catalog.ts. */
import type { SfxEvent } from "../../src/sfx.ts";
import type { SfxName } from "../../src/catalog.ts";
import type { StoryT } from "../../src/schema.ts";
import { FPS } from "../../src/timeline.ts";
import { T } from "./plan.ts";

export const music = { track: "bed-glow", level: 0.8 } as const;

export function sfx(_story: StoryT): SfxEvent[] {
  const ev: SfxEvent[] = [];
  const add = (t: number, name: SfxName, why: string, vol = 1) => ev.push({ t: Math.round(Math.max(0, t) * FPS) / FPS, name, vol, why });
  // hook
  add(T.topIn, "pop-soft", "kicker and headline come in", 0.8); add(0.8, "sizzle", "the flame flickers on the wick", 0.35); add(T.push, "whoosh", "the establishing push", 0.8); add(2.4, "tick-soft", "the flame settles in the main shot", 0.5);
  // sting
  add(3.0, "boing", "the mascot pops in"); add(3.1, "jingle-sting", "Intip yuk!", 0.7); add(3.27, "pop", "the pill"); add(3.85, "swish", "the mascot leaves", 0.6);
  // sumbu
  add(T.pan1 + 0.1, "zoom-whoosh", "the push into the candle top", 0.7); add(T.pool, "drip", "the melt pool shines", 0.7); add(T.lblPool, "pop-soft", "label: liquid wax");
  add(T.drops, "bubble-rise", "wax climbs the wick", 0.6); add(T.lblWick, "tick", "label: up the wick"); add(T.drops + 1.2, "drip", "a drop reaches the tip", 0.5);
  add(T.vapor, "puff", "the wax turns to vapour", 0.6); add(T.lblVapor, "pop-soft", "label: the vapour burns"); add(10.2, "sizzle", "the vapour catches", 0.4);
  // panas
  add(T.pan2 + 0.1, "whoosh", "the camera rises above the flame", 0.7); add(T.gas, "bubble-rise", "a bubble of hot gas leaves the tip", 0.6); add(T.lblHot, "pop-soft", "label: it expands");
  add(T.grow, "puff", "the bubbles swell", 0.6); add(T.gas + 3.6, "bubble-rise", "another bubble", 0.5); add(T.cmpCold, "glass-ting", "the cold parcel", 0.8); add(T.cmpHot, "glass-ting", "the hot parcel", 0.8);
  add(T.lblCold, "tick", "label: cold, packed"); add(T.lblCold + 0.3, "tick", "label: hot, spread"); add(T.lblLight, "chime", "lighter than air");
  // naik
  add(T.pan3 + 0.1, "swish", "the camera pulls back", 0.7); add(T.upFlow, "zip", "the hot stream rises"); add(T.downL, "swish-soft", "the cold air comes down left", 0.7); add(T.downR, "swish-soft", "and right", 0.7);
  add(T.lblUp, "pop-soft", "label: hot rises"); add(T.gravity, "thump", "the gravity arrow", 0.7); add(T.gravity + 0.3, "tick", "label: gravity"); add(T.lblDown, "pop-soft", "label: cold sinks");
  add(T.lblConv, "chime-bright", "this is convection"); add(26.2, "swish-soft", "the loop keeps turning", 0.4);
  // oksigen
  add(T.pan4 + 0.1, "zoom-whoosh", "the push to the flame's base", 0.7); add(T.inL, "swish", "fresh air flows in from the left", 0.6); add(T.inR, "swish", "and from the right", 0.6);
  add(T.lblFresh, "pop-soft", "label: fresh air"); add(T.o2, "bubble-rise", "oxygen rides the stream", 0.6); add(T.lblO2, "tick", "label: oxygen");
  add(T.stretch, "slide-whistle-down", "the flame stretches up", 0.4); add(T.lblLong, "pop-soft", "label: longer flame"); add(T.outTop, "zip", "the hot gas leaves at the top", 0.7);
  // kuning
  add(T.pan5 + 0.1, "zoom-whoosh", "the push into the flame", 0.7); add(T.soot, "sizzle", "the soot glows", 0.5); add(T.lblSoot, "pop-soft", "label: glowing soot");
  add(T.lblBlue, "tick", "label: blue base"); add(T.lblTip, "tick", "label: pointed tip"); add(T.chip, "chime", "the source chip");
  // angkasa
  add(T.pan6 + 0.1, "whoosh", "the camera slides left", 0.7); add(T.port, "pop", "the porthole opens"); add(T.ball, "glass-ting", "the flame is a ball", 0.8);
  add(T.lblSpace, "pop-soft", "label: in space, round"); add(T.lblEarth, "tick", "label: on Earth, pointed"); add(T.motes, "bubble-rise", "specks float in the cabin", 0.5);
  // tips
  add(T.pan7 + 0.1, "swish", "the camera drops", 0.7); add(T.arrows, "zip", "the hot arrow up", 0.7); add(T.arrows + 0.3, "zip", "the cold arrow down", 0.7);
  add(T.cardA, "pop", "tip card 1"); add(T.cardB, "pop", "tip card 2"); add(T.chipT, "chime", "the source chip"); add(55.0, "sizzle", "the flame flickers", 0.35);
  // outro
  add(T.back, "swish", "the camera pulls back", 0.6); add(56.6, "zoom-whoosh", "back to the wide shot", 0.7); add(58.4, "jingle-outro", "loop back", 0.7);
  return ev.sort((a, b) => a.t - b.t);
}
