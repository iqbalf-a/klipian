/* The sound of "Kenapa suara kita terdengar beda di rekaman?", written by hand against index.tsx: a sound on every label, every camera move, every path that
   draws itself, the poster's ring, the recorder and the cut across the bone path, on the frame of its picture (the moments come from plan.ts). About one
   event a second. Only names of the locked set in src/catalog.ts. */
import type { SfxEvent } from "../../src/sfx.ts";
import type { SfxName } from "../../src/catalog.ts";
import type { StoryT } from "../../src/schema.ts";
import { FPS } from "../../src/timeline.ts";
import { T } from "./plan.ts";

export const music = { track: "bed-curious", level: 0.8 } as const;

export function sfx(_story: StoryT): SfxEvent[] {
  const ev: SfxEvent[] = [];
  const add = (t: number, name: SfxName, why: string, vol = 1) => ev.push({ t: Math.round(Math.max(0, t) * FPS) / FPS, name, vol, why });
  // hook (0 to 3): the head speaks, the camera pushes in
  add(0.15, "pop-soft", "kicker and headline come in", 0.8); add(0.7, "tick-soft", "the first sound arc leaves the mouth", 0.5);
  add(T.push, "whoosh", "the establishing push", 0.8); add(2.4, "thump", "the camera settles", 0.6);
  // sting
  add(3.0, "boing", "the mascot pops in"); add(3.1, "jingle-sting", "Intip yuk!", 0.7); add(3.27, "pop", "the pill"); add(3.85, "swish", "the mascot leaves", 0.6);
  // jalur (4 to 12)
  add(4.1, "swish-soft", "headline", 0.7); add(T.airOn, "zip", "the air path draws itself", 0.8); add(T.lblAir, "pop-soft", "label: jalur udara");
  add(T.boneOn, "zip", "the bone path draws itself", 0.8); add(T.lblBone, "pop-soft", "label: jalur tulang"); add(T.lblEar, "tick", "label: telinga");
  add(T.ping, "glass-ting", "the ear pulses where both paths meet", 0.8);
  // udara (12 to 20)
  add(12.05, "swish-soft", "headline", 0.7); add(T.panMouth, "whoosh", "the pan to the mouth", 0.8); add(T.arcsBig, "thump", "the arcs grow", 0.6);
  add(T.lblWave, "pop-soft", "label: gelombang suara"); add(T.lblViaAir, "pop-soft", "label: lewat udara"); add(T.lblOthers, "pop-soft", "label: orang lain");
  add(T.reach, "glass-ting", "the wave reaches the ear", 0.8);
  // tulang (20 to 28)
  add(20.0, "swish-soft", "headline", 0.7); add(T.panHead, "whoosh", "the pan to the head", 0.8); add(T.skull, "zoom-whoosh", "the skull shows through", 0.7);
  add(T.lblSkull, "pop-soft", "label: tengkorak"); add(T.boneFlow, "hum", "the vibration runs through the bone", 0.6); add(T.lblLow, "pop-soft", "label: nada rendah");
  add(T.lblHeavy, "pop-soft", "label: terasa berat"); add(27.4, "swish-soft", "the labels leave", 0.5);
  // mic (28 to 35)
  add(28.0, "swish-soft", "headline", 0.7); add(T.panMic, "whoosh", "the pan to the microphone", 0.8); add(T.lblMic, "pop-soft", "label: mikrofon");
  add(T.hit, "tick", "the arcs reach the microphone"); add(T.recOn, "click-crack", "the recorder starts", 0.8); add(T.lblRec, "pop-soft", "label: merekam");
  add(T.cut, "squeak", "the bone path fades from the recorder", 0.7); add(T.lblNoBone, "pop-soft", "label: tulang tidak ikut"); add(T.cross, "click-crack", "the cross over the bone path", 0.7);
  // hasil (35 to 42)
  add(35.05, "swish-soft", "headline", 0.7); add(T.panMid, "whoosh", "the pan back to the head", 0.8); add(T.play, "zip", "the recording comes back through the air", 0.8);
  add(T.lblAirOnly, "pop-soft", "label: cuma jalur udara"); add(T.lblThin, "pop-soft", "label: lebih tinggi, tipis"); add(T.lblOthersEar, "pop-soft", "label: suara di telinga orang");
  // fakta (42 to 48)
  add(42.0, "swish-soft", "headline", 0.7); add(T.panPoster, "whoosh", "the pan up to the poster", 0.8); add(T.poster, "pop", "the poster comes in");
  add(T.ring, "zip", "the ring fills", 0.7); add(T.lblPct, "chime", "label: 38%"); add(T.lblSec, "pop-soft", "label: 5 detik"); add(T.lblYear, "pop-soft", "label: studi 1967");
  // tips (48 to 57)
  add(48.0, "swish-soft", "headline", 0.7); add(T.panBack, "whoosh", "the pan back down", 0.8); add(T.tip1, "chime", "tip 1: wajar kaget");
  add(T.tip2, "chime-bright", "tip 2: otak berharap ada tulang"); add(T.tip3, "chime", "tip 3: bukan rusak"); add(T.fade, "swish", "the tips leave", 0.6);
  // outro: the loop-back has no jingle and no mascot sound; the camera eases out to the wide shot of the hook
  add(57.2, "whoosh", "the camera eases back to the wide shot", 0.6); add(59.3, "thump", "the set settles into the first frame", 0.4);
  return ev.sort((a, b) => a.t - b.t);
}
