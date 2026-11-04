/* The sound of "Kenapa bulan selalu menghadap kita dengan sisi yang sama?", written by hand against index.tsx: a sound on every object that enters, every camera move, every
   label and every state change, on the frame of its picture (the moments are plan.ts T). About one event a second. Only names of the locked set in src/catalog.ts. */
import type { SfxEvent } from "../../src/sfx.ts";
import type { SfxName } from "../../src/catalog.ts";
import type { StoryT } from "../../src/schema.ts";
import { FPS } from "../../src/timeline.ts";
import { T } from "./plan.ts";

export const music = { track: "bed-curious", level: 0.8 } as const;

export function sfx(_story: StoryT): SfxEvent[] {
  const ev: SfxEvent[] = [];
  const add = (t: number, name: SfxName, why: string, vol = 1, extra: Partial<SfxEvent> = {}) => ev.push({ t: Math.round(Math.max(0, t) * FPS) / FPS, name, vol, why, ...extra });

  // hook: the wide shot of the set, then the establishing push
  add(T.head, "pop-soft", "kicker and headline come in", 0.8); add(T.push, "whoosh", "the establishing push", 0.8);
  // sting
  add(3.0, "boing", "the mascot pops in"); add(3.1, "jingle-sting", "Intip yuk!", 0.7); add(3.27, "pop", "the pill"); add(3.85, "swish", "the mascot leaves", 0.6);
  // keliling
  add(4.1, "swish-soft", "headline", 0.7); add(4.4, "whoosh", "the camera backs off to the whole ring", 0.7); add(T.ring, "zip", "the ring draws itself", 0.8);
 
  for (let i = 0; i < 8; i += 2) add(T.dot0 + i * 0.2, "tick-soft", `lap marks ${i + 1} and ${i + 2}`, 0.55);
  add(T.lblLap, "pop-soft", "label: one lap is 27 days");
  // putar
  add(11.1, "swish-soft", "headline", 0.7); add(11.5, "zoom-whoosh", "the camera dives to the Moon", 0.8); add(T.spinRing, "zip", "the turning arrow", 0.8);
  add(T.lblSpin, "pop-soft", "label: turns, 27 days");
  add(T.lblEq, "chime", "27 days = 27 days");
  // sama
  add(20.1, "swish-soft", "headline", 0.7); add(20.3, "whoosh", "the camera shows the whole ring", 0.7);
  for (let i = 0; i < 4; i++) { add(T.snap0 + i * T.snapGap, "pop", `snapshot ${i + 1} of the Moon`, 0.9); if (i % 2) add(T.snap0 + i * T.snapGap + 0.2, "tick-soft", `the lines to the Earth ${i}`, 0.5); }
  add(T.lblFace, "chime", "label: always facing the Earth");
  add(T.ghost, "glass-ting", "a Moon that does not turn"); add(T.lblGhost, "tick", "label: without a turn");
  add(T.lblAll, "chime-bright", "label: all sides show");
  // kunci
  add(34.1, "swish-soft", "headline", 0.7); add(34.4, "whoosh", "the camera goes to the pair", 0.7); add(T.bulge, "glass-ting", "the tidal bulge outline"); add(T.pull0, "tick", "the Earth pulls 1", 0.8); add(T.pull0 + 0.5, "tick", "the Earth pulls 3", 0.8);
  add(T.lblBulge, "pop-soft", "label: the bulge, exaggerated"); add(T.bar, "pop", "the turning-speed bar"); add(T.barDown, "slide-whistle-down", "the turn slows down", 0.6);
  add(T.locked, "click-crack", "locked"); add(T.locked + 0.1, "chime-bright", "the stamp: locked");
  // jauh
  add(43.1, "swish-soft", "headline", 0.7); add(43.8, "zoom-whoosh", "the camera moves in on the Moon", 0.8); add(T.cardNear, "pop", "the near-side card");
  add(T.cardFar, "pop", "the far-side card"); add(T.probe, "swish", "the spacecraft sets out", 0.7); add(T.lblLuna, "pop-soft", "label: Luna 3, 1959");
  add(48.0, "hum", "it goes behind the Moon", 0.5, { dur: 0.9 }); add(48.5, "click-crack", "the picture is taken"); add(48.6, "glass-ting", "the flash", 0.7);
  // tips
  add(50.1, "swish-soft", "headline", 0.7); add(50.8, "whoosh", "the camera backs off", 0.7); add(T.tipA, "pop", "tip 1"); add(T.tipA + 0.3, "chime", "tip 1 lands");
  add(T.tipB, "pop", "tip 2"); add(T.tipB + 0.3, "chime-bright", "tip 2 lands");
  // outro: the camera eases back to the wide shot of the hook
  add(56.9, "zoom-whoosh", "back to the wide shot", 0.7); add(T.backEnd, "puff", "the set settles", 0.4); add(58.6, "jingle-outro", "loop back", 0.7);
  return ev.sort((a, b) => a.t - b.t);
}
