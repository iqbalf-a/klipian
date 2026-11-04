/* The sound of "Satu awan beratnya ratusan ton", written by hand against index.tsx: a sound on every object that enters, every camera move and every label,
   on the frame of its picture (the moments come from plan.ts). About one event a second. Only names of the locked set in src/catalog.ts. */
import type { SfxEvent } from "../../src/sfx.ts";
import type { SfxName } from "../../src/catalog.ts";
import type { StoryT } from "../../src/schema.ts";
import { FPS } from "../../src/timeline.ts";
import { T } from "./plan.ts";

export const music = { track: "bed-calm", level: 0.8 } as const;

export function sfx(_story: StoryT): SfxEvent[] {
  const ev: SfxEvent[] = [];
  const add = (t: number, name: SfxName, why: string, vol = 1) => ev.push({ t: Math.round(Math.max(0, t) * FPS) / FPS, name, vol, why });
  // hook
  add(0.2, "pop-soft", "kicker and headline come in", 0.8); add(0.9, "swish-soft", "a far cloud drifts", 0.6); add(T.push, "whoosh", "the establishing push", 0.8); add(2.5, "tick-soft", "the sun glints", 0.6);
  // sting
  add(3.0, "boing", "the mascot pops in"); add(3.1, "jingle-sting", "Intip yuk!", 0.7); add(3.27, "pop", "the pill"); add(3.85, "swish", "the mascot leaves", 0.6);
  // ukuran
  add(4.1, "swish-soft", "headline", 0.7); add(T.cube, "zip", "the cube draws itself", 0.8); add(T.kmA, "tick", "1 km across"); add(T.kmB, "tick", "1 km high");
  add(T.cubeFill, "pop-soft", "the cube fills with air"); add(8.0, "swish-soft", "the camera backs off", 0.6); add(T.volume, "tick-soft", "the volume tag"); add(10.5, "pop-soft", "a far cloud passes", 0.6); add(11.4, "swish", "the camera moves on", 0.6);
  // encer
  add(12.1, "swish-soft", "headline", 0.7); add(12.9, "whoosh", "the pan to the box", 0.8); add(T.box, "pop", "the box of air"); add(T.glass, "glass-ting", "the glass walls", 0.8);
  add(T.specks, "pop-soft", "the water specks", 0.7); add(T.marble, "pop", "the marble comes in"); add(T.marbleLand, "tick", "the marble lands"); add(T.lblMarble, "tick-soft", "label: one marble");
  add(T.lblHalf, "pop-soft", "label: half a gram"); add(19.6, "swish", "the camera leaves the box", 0.6);
  // berat
  add(20.1, "swish-soft", "headline", 0.7); add(20.3, "whoosh", "the pan back to the cloud", 0.7); add(T.vol, "pop", "1 miliar m3"); add(T.times, "pop", "times half a gram");
  add(T.equals, "zip", "the equals line", 0.8); add(T.kg, "chime-bright", "500,000 kg"); add(25.0, "thump", "the weight lands", 0.7); add(T.ton, "chime", "500 ton"); add(27.4, "swish", "the camera moves on", 0.6);
  // gajah
  add(28.1, "swish-soft", "headline", 0.7); add(28.4, "whoosh", "the pan down", 0.7); add(T.rowA, "pop-soft", "dots, row 1", 0.8); add(T.rowB, "pop-soft", "dots, row 2", 0.8);
  add(T.rowC, "pop-soft", "dots, row 3", 0.8); add(T.rowD, "pop-soft", "dots, row 4", 0.8); add(T.lblElephants, "chime", "100 gajah"); add(T.lblSpread, "tick", "label: spread out"); add(34.4, "swish", "the camera goes back up", 0.6);
  // apung
  add(35.1, "swish-soft", "headline", 0.7); add(T.air, "pop", "the air parcels"); add(T.down, "tick", "the arrow down"); add(T.up, "pop-soft", "the arrow up");
  add(T.lblLight, "chime-bright", "lighter than the air"); add(39.8, "puff", "the cloud puffs", 0.6); add(40.8, "tick-soft", "the cloud bobs", 0.6); add(41.7, "swish", "the push begins", 0.6);
  // tetes
  add(42.1, "swish-soft", "headline", 0.7); add(42.4, "zoom-whoosh", "the push in on the rim", 0.8); add(T.drops, "pop-soft", "the droplets"); add(T.lblDrops, "tick", "label: tiny droplets");
  add(45.5, "bubble-rise", "the droplets drift", 0.7); add(46.8, "drip", "one droplet", 0.7); add(47.6, "swish", "the camera lets go", 0.6);
  // akhir
  add(48.1, "swish-soft", "headline", 0.7); add(48.4, "zoom-whoosh", "the pull back out", 0.8); add(T.finalTon, "pop", "the 500 ton tag"); add(51.5, "chime", "the cloud holds it up"); add(53.0, "tick-soft", "a far cloud passes", 0.6);
  add(54.6, "puff", "the cloud puffs", 0.6); add(55.6, "swish", "the camera settles", 0.6);
  // outro
  add(56.1, "jingle-outro", "loop back", 0.7); add(57.6, "swish-soft", "the set rests", 0.5);
  return ev.sort((a, b) => a.t - b.t);
}
