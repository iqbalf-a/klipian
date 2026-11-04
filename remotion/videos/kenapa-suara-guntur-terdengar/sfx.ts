/* The sound of "Kenapa suara guntur terdengar lebih lambat dari kilat?", written by hand against index.tsx: a sound on every flash, every light dot, every ring
   that is born, every label and card and every camera move, on the frame of its picture (the moments come from plan.ts). About one event a second. Only names of
   the locked set in src/catalog.ts. */
import type { SfxEvent } from "../../src/sfx.ts";
import type { SfxName } from "../../src/catalog.ts";
import type { StoryT } from "../../src/schema.ts";
import { FPS } from "../../src/timeline.ts";
import { T } from "./plan.ts";

export const music = { track: "bed-curious", level: 0.8 } as const;

export function sfx(_story: StoryT): SfxEvent[] {
  const ev: SfxEvent[] = [];
  const add = (t: number, name: SfxName, why: string, vol = 1) => ev.push({ t: Math.round(Math.max(0, t) * FPS) / FPS, name, vol, why });
  // hook
  add(0.2, "pop-soft", "kicker and headline come in", 0.8); add(0.8, "swish-soft", "a far cloud drifts", 0.5); add(T.flashHook, "click-crack", "the first flash", 0.8); add(T.push, "whoosh", "the establishing push", 0.8); add(2.4, "tick-soft", "the wire sways", 0.5);
  // sting
  add(3.0, "boing", "the mascot pops in"); add(3.1, "jingle-sting", "Intip yuk!", 0.7); add(3.27, "pop", "the pill"); add(3.85, "swish", "the mascot leaves", 0.6);
  // lahir
  add(4.1, "swish-soft", "headline", 0.7); add(5.0, "hum", "the storm cloud rumbles", 0.5); add(T.lblKilat, "pop", "label: kilat"); add(T.lblGuntur, "pop-soft", "label: guntur");
  add(T.flashLahir, "click-crack", "the bolt"); add(T.flashLahir + 0.1, "thump", "the thunder", 0.7); add(10.0, "swish-soft", "a far cloud passes", 0.5); add(10.7, "swish", "the camera moves on", 0.6);
  // cahaya
  add(12.1, "swish-soft", "headline", 0.7); add(12.6, "tick-soft", "the sound ring waits", 0.5); add(T.flashA, "click-crack", "the bolt strikes"); add(T.flashA + 0.05, "zip", "the dot of light crosses the road", 0.9);
  add(T.lihat, "blip-alert", "LIHAT!"); add(T.lblInstan, "pop-soft", "label: instant"); add(T.lblSpeed, "chime", "300 ribu km/detik"); add(17.2, "tick-soft", "the ring creeps", 0.5); add(18.5, "swish", "the camera turns to the listener", 0.6);
  // suara
  add(T.tag3, "tick", "3 detik"); add(19.0, "swish-soft", "headline", 0.7); add(19.4, "whoosh", "the camera drifts down the road", 0.7); add(T.tag6, "tick", "6 detik");
  add(20.6, "bubble-rise", "the ring passes a post", 0.5); add(21.4, "tick-soft", "the ring nears", 0.6); add(T.tag9, "tick", "9 detik"); add(T.duar, "thump", "DUAAR: the thunder arrives"); add(T.duar + 0.05, "boing", "the burst pops", 0.8);
  add(T.lblSound, "pop-soft", "label: 343 m/detik"); add(25.4, "hum", "the thunder dies away", 0.5); add(26.4, "swish", "the camera backs off", 0.6);
  // contoh
  add(27.1, "swish-soft", "headline", 0.7); add(T.brace, "zip", "the 3 km line draws itself", 0.8); add(T.brace + 0.2, "pop", "label: 3 km"); add(T.tlBar, "pop-soft", "the timeline"); add(T.flashE, "click-crack", "the bolt strikes");
  add(T.flashE + 0.05, "zip", "the dot of light crosses", 0.9); add(29.0, "tick-soft", "second 1", 0.4); add(30.0, "tick-soft", "second 2", 0.4); add(31.0, "tick-soft", "second 3", 0.4); add(32.0, "tick-soft", "second 4", 0.4);
  add(T.tlLabel, "chime-bright", "9 detik"); add(34.0, "tick-soft", "second 6", 0.4); add(34.8, "swish", "the camera lets go", 0.6);
  // jeda
  add(35.2, "swish-soft", "headline", 0.7); add(T.slideOut, "whoosh", "the storm slides farther away", 0.7); add(37.4, "pop-soft", "the 5 km line", 0.7); add(37.8, "pop", "label: 5 km");
  add(T.flashB, "click-crack", "the bolt strikes far away", 0.8); add(T.flashB + 0.05, "zip", "the dot of light crosses", 0.8); add(T.lblGap, "chime", "label: the gap is wider"); add(T.slideBack, "whoosh", "the storm slides back", 0.6); add(41.7, "swish", "the camera settles", 0.6);
  // lipat
  add(42.1, "swish-soft", "headline", 0.7); add(T.flashC, "click-crack", "the bolt strikes"); add(T.flashC + 0.05, "zip", "the dot of light crosses", 0.9); add(T.lblC1, "pop", "label: light has arrived");
  add(T.lblC2, "pop-soft", "label: sound is barely out"); add(T.pillLipat, "chime-bright", "ratusan ribu kali"); add(47.0, "swish", "the camera moves on", 0.6);
  // hitung
  add(48.1, "swish-soft", "headline", 0.7); add(48.4, "whoosh", "the camera drops", 0.7); add(T.flashD, "click-crack", "the bolt strikes"); add(T.flashD + 0.05, "zip", "the dot of light crosses", 0.8);
  add(T.card1, "pop", "card 1"); add(T.card2, "pop", "card 2"); add(T.card3, "pop", "card 3"); add(T.pillEx, "chime", "9 / 3 = 3 km"); add(56.4, "swish", "the camera eases back", 0.6);
  // outro
  add(57.1, "jingle-outro", "loop back", 0.7); add(58.6, "swish-soft", "the set rests", 0.5);
  return ev.sort((a, b) => a.t - b.t);
}
