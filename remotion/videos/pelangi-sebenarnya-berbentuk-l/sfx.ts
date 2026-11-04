/* The sound of "Pelangi sebenarnya berbentuk lingkaran", written by hand against index.tsx: a sound on every object that enters, every camera move, label and
   state change, on the frame of its picture (the moments come from plan.ts). About one event a second. Only names of the locked set in src/catalog.ts. */
import type { SfxEvent } from "../../src/sfx.ts";
import type { SfxName } from "../../src/catalog.ts";
import type { StoryT } from "../../src/schema.ts";
import { FPS } from "../../src/timeline.ts";
import { T } from "./plan.ts";

export const music = { track: "bed-glow", level: 0.8 } as const;

export function sfx(_story: StoryT): SfxEvent[] {
  const ev: SfxEvent[] = [];
  const add = (t: number, name: SfxName, why: string, vol = 1) => ev.push({ t: Math.round(Math.max(0, t) * FPS) / FPS, name, vol, why });
  // hook: the arc, cut by the ground
  add(0.15, "pop-soft", "kicker and headline come in", 0.8); add(0.7, "glass-ting", "the rainbow shimmers", 0.6); add(1.5, "swish-soft", "a far cloud drifts", 0.5); add(2.3, "tick-soft", "the sun glints", 0.6);
  // sting
  add(3.0, "boing", "the mascot pops in"); add(3.1, "jingle-sting", "Intip yuk!", 0.7); add(3.27, "pop", "the pill"); add(3.85, "swish", "the mascot leaves", 0.6);
  // tetes
  add(T.slabDown, "slide-whistle-down", "the ground sinks away", 0.7); add(4.15, "swish-soft", "headline", 0.7); add(4.5, "zoom-whoosh", "the push in on the drop", 0.8);
  add(T.ray - 0.8, "pop", "the drop appears"); add(T.rayIn, "zip", "the sunlight arrives", 0.8); add(T.lblIn, "tick", "label: masuk");
  add(T.rayBack, "tick-soft", "the light inside the drop", 0.8); add(T.lblBack, "pop-soft", "label: memantul"); add(T.rayBack + 0.55, "tick-soft", "it turns at the back", 0.7);
  add(T.rayOut, "whoosh", "the light leaves the drop", 0.7); add(T.lblOut, "tick", "label: keluar"); add(T.split, "glass-ting", "the colours split", 0.8);
  add(T.lblColours, "pop-soft", "label: merah"); add(T.lblColours + 0.4, "pop-soft", "label: ungu"); add(12.4, "swish", "the camera lets go", 0.6);
  // cincin
  add(13.9, "swish-soft", "headline", 0.7); add(14.1, "zoom-whoosh", "the pull back out", 0.8); add(T.sweep, "zip", "the ring draws itself", 0.9); add(16.0, "bubble-rise", "the bands glow", 0.5);
  add(T.sweepEnd, "chime-bright", "the ring is whole"); add(T.axis, "swish", "the line from the sun", 0.7); add(T.axis + 0.6, "pop", "the point opposite the sun");
  add(T.axisLbl, "tick", "label: titik seberang matahari"); add(T.angle, "zip", "the angle line", 0.7); add(T.angleLbl, "chime", "label: 42 degrees"); add(T.centreLbl, "tick-soft", "label: pusat cincin");
  add(23.2, "swish", "the camera settles", 0.6);
  // cakrawala
  add(23.9, "swish-soft", "headline", 0.7); add(T.slabUp, "thump", "the ground rises", 0.9); add(T.slabUp + 0.9, "rattle", "it settles on the horizon", 0.5);
  add(T.cutLbl, "tick", "label: cakrawala"); add(28.0, "puff", "a cloud passes", 0.5); add(T.cutLbl2, "pop-soft", "label: separuh tersembunyi"); add(T.hide, "glass-ting", "the hidden part shows as a ghost", 0.7);
  add(32.0, "swish", "the camera creeps down", 0.5);
  // pesawat
  add(32.9, "swish-soft", "headline", 0.7); add(T.slabDown2, "slide-whistle-down", "the ground sinks away", 0.7); add(T.plane, "whoosh", "the plane flies in", 0.8);
  add(T.mist, "pop", "the shadow lands on the deck"); add(T.mist + 0.3, "puff", "mist rises", 0.6); add(T.lblPlane, "chime", "label: cincin utuh"); add(37.6, "hum", "the plane keeps flying", 0.4);
  add(38.6, "swish", "the camera moves in", 0.6);
  // glory
  add(38.9, "swish-soft", "headline", 0.7); add(40.2, "zoom-whoosh", "the push in on the shadow", 0.8); add(T.glory, "glass-ting", "the small glory appears");
  add(T.lblGlory, "tick", "label: glory"); add(T.lblRain, "pop-soft", "label: pelangi 42"); add(T.lblSize, "chime-bright", "label: 5 to 20 degrees"); add(47.2, "swish", "the camera lets go", 0.6);
  // tips
  add(47.9, "swish-soft", "headline", 0.7); add(48.2, "zoom-whoosh", "the pull back out", 0.7); add(T.sunWarn, "boing", "the sun pulses", 0.7);
  add(T.backArrow, "zip", "the arrow from the sun", 0.8); add(T.lblBack2, "tick", "label: punggung ke matahari"); add(T.lblOpp, "chime", "label: pelangi di seberang");
  add(54.0, "thump", "the ground starts to rise", 0.7); add(T.slabUp2 + 0.9, "rattle", "it settles on the horizon", 0.5);
  // outro: the plane has left, the arc is back
  add(56.1, "jingle-outro", "loop back", 0.7); add(57.6, "glass-ting", "the rainbow shimmers", 0.4);
  return ev.sort((a, b) => a.t - b.t);
}
