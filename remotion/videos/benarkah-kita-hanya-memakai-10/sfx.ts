/* The sound of "Benarkah kita cuma pakai 10 persen otak?", written by hand against index.tsx: a sound on every object that enters, every camera move, every
   label and every state change, on the frame of its picture (the moments come from plan.ts). About one event a second. Only names of the locked set. */
import type { SfxEvent } from "../../src/sfx.ts";
import type { SfxName } from "../../src/catalog.ts";
import type { StoryT } from "../../src/schema.ts";
import { FPS } from "../../src/timeline.ts";
import { REGION_LABEL, T } from "./plan.ts";

export function sfx(_story: StoryT): SfxEvent[] {
  const ev: SfxEvent[] = [];
  const add = (t: number, name: SfxName, why: string, vol = 1) => ev.push({ t: Math.round(Math.max(0, t) * FPS) / FPS, name, vol, why });
  // hook
  add(0.2, "pop-soft", "kicker and headline", 0.8); add(T.myth + 0.15, "tick", "label: 10%?"); add(T.push, "zoom-whoosh", "the establishing push", 0.8); add(2.4, "hum", "the screen hums", 0.4);
  // sting
  add(3.0, "boing", "the mascot pops in"); add(3.1, "jingle-sting", "Intip yuk!", 0.7); add(3.27, "pop", "the pill"); add(3.85, "swish", "the mascot leaves", 0.6);
  // pindai
  add(4.1, "swish-soft", "headline", 0.7); add(T.panScan, "whoosh", "the pan to the scanner", 0.8); add(T.bedIn, "zip", "the bed slides in", 0.8);
  add(T.scanRings, "hum", "the scanner starts", 0.7); add(T.lblScan, "pop-soft", "label: brain scanner"); add(T.bedStop, "thump", "the bed stops", 0.5);
  add(8.3, "tick-soft", "scan pulse", 0.5); add(9.1, "tick-soft", "scan pulse", 0.5); add(T.panBack, "whoosh", "the pan back to the screen", 0.7);
  add(T.sweep, "zip", "the scan line sweeps", 0.7); add(T.reveal, "glass-ting", "the scan appears", 0.7);
  // aktif
  add(12.1, "swish-soft", "headline", 0.7);
  for (const l of Object.values(REGION_LABEL)) { if (!l) continue; add(l.at, "blip-alert", "a region lights up", 0.45); add(l.at + 0.15, "pop-soft", `label: ${l.text}`, 0.8); }
  add(18.0, "chime", "every part works", 0.6); add(T.night, "slide-whistle-down", "the room goes dark", 0.5); add(T.lblSleep, "pop-soft", "label: active in sleep");
  add(20.4, "tick-soft", "the brain pulses in sleep", 0.5); add(T.day, "chime-bright", "the light comes back", 0.6);
  // energi
  add(22.1, "swish-soft", "headline", 0.7); add(T.panCols, "whoosh", "the pan to the columns", 0.8); add(T.colA, "pop", "the 2 % column"); add(T.lblA, "tick", "label: weight 2%");
  add(T.colB, "slide-whistle-down", "the 20 % column rises", 0.4); add(26.3, "thump", "the tall column stands", 0.6); add(T.lblB, "tick", "label: energy 20%");
  add(T.panUp, "whoosh", "the camera rises to the brain", 0.7); add(T.flow, "bubble-rise", "energy flows to the brain", 0.7); add(T.lblWaste, "pop-soft", "label: wasteful");
  add(30.2, "tick-soft", "energy dots", 0.5);
  // cedera
  add(T.panBrain, "swish", "the push back to the brain", 0.7); add(31.4, "swish-soft", "headline", 0.7); add(T.hurtA, "click-crack", "a damaged patch"); add(T.lostA, "blip-alert", "label: hearing lost", 0.7);
  add(T.hurtB, "click-crack", "a second damaged patch"); add(T.lostB, "blip-alert", "label: sight lost", 0.7); add(T.heal, "puff", "the patches clear", 0.6);
  add(T.stamp, "thump", "the MITOS stamp"); add(T.stamp + 0.1, "chime-bright", "the verdict", 0.7); add(T.chip, "pop-soft", "the source chip"); add(38.8, "tick-soft", "the brain pulses", 0.5);
  // asal
  add(T.panDesk, "whoosh", "the pan to the desk", 0.8); add(40.6, "swish-soft", "headline", 0.7); add(T.book, "boing", "the book jumps", 0.7); add(T.lbl1936, "pop-soft", "label: 1936 book");
  add(T.tag, "pop", "the 10% tag"); add(T.twist, "squeak", "the quote is twisted", 0.7); add(T.twist + 0.2, "pop-soft", "label: twisted quote"); add(T.cross, "zip", "the 10% is struck out");
  add(46.8, "tick-soft", "the tag bobs", 0.5);
  // tips
  add(T.panTips, "whoosh", "the camera drops back to the brain", 0.7); add(48.3, "swish-soft", "headline", 0.7); add(T.wave, "hum", "the wave of activity", 0.5);
  add(T.tipA, "pop", "tip 1"); add(50.4, "tick-soft", "the wave passes", 0.5); add(T.tipB, "pop", "tip 2"); add(52.6, "zip", "the bed slides out", 0.6);
  add(53.8, "tick-soft", "the wave passes", 0.5); add(55.0, "chime", "all of it, in turns", 0.6);
  // outro
  add(T.back, "swish", "the camera pulls back", 0.6); add(57.0, "zoom-whoosh", "back to the wide shot", 0.7); add(57.6, "glass-ting", "the 10% patch returns", 0.5); add(58.6, "jingle-outro", "loop back", 0.7);
  return ev.sort((a, b) => a.t - b.t);
}
