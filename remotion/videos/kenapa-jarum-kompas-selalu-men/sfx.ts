/* The sound of "Kenapa jarum kompas selalu menunjuk utara?", written by hand against index.tsx: a sound on every object that enters, every camera move, every
   label, the needle's swings and the magnet's slides, on the frame of its picture (the moments come from plan.ts). About one event a second. Only names of
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
  // hook (0 to 3)
  add(0.15, "pop-soft", "kicker and headline come in", 0.8); add(T.kick1, "swish", "the needle is flicked", 0.7); add(1.2, "tick-soft", "the needle swings", 0.6);
  add(T.push, "whoosh", "the establishing push", 0.8); add(2.4, "tick", "the needle settles", 0.6);
  // sting
  add(3.0, "boing", "the mascot pops in"); add(3.1, "jingle-sting", "Intip yuk!", 0.7); add(3.27, "pop", "the pill"); add(3.85, "swish", "the mascot leaves", 0.6);
  // jarum (4 to 10)
  add(4.1, "swish-soft", "headline", 0.7); add(T.lblU, "pop-soft", "label: ujung utara"); add(T.lblS, "pop-soft", "label: ujung selatan"); add(T.lblPivot, "tick", "label: poros");
  add(6.9, "swish-soft", "the labels leave", 0.5); add(T.magIn, "whoosh", "the bar magnet slides in", 0.8); add(7.9, "click-crack", "the needle snaps to the magnet", 0.8);
  add(8.2, "pop-soft", "label: the magnet pulls", 0.7); add(T.magOut, "swish", "the magnet slides out", 0.7); add(9.6, "tick-soft", "the needle rings back", 0.6);
  // bumi (10 to 18)
  add(10.1, "swish-soft", "headline", 0.7); add(T.panG, "whoosh", "the pan to the globe", 0.8); add(11.8, "thump", "the globe settles", 0.6);
  add(T.cut, "zoom-whoosh", "the globe opens up", 0.8); add(T.core, "glass-ting", "the outer core lights up"); add(T.flow, "bubble-rise", "the liquid starts to flow", 0.7);
  add(T.lblLiquid, "pop-soft", "label: liquid iron and nickel"); add(15.4, "tick-soft", "the flow turns", 0.6); add(T.lblCrust, "tick", "label: outer core");
  add(17.2, "hum", "the field hums", 0.5); add(T.uncut, "swish", "the globe closes", 0.7);
  // garis (18 to 26)
  add(18.1, "swish-soft", "headline", 0.7); add(T.loop1, "zip", "the first field loop draws", 0.8); add(T.loop2, "zip", "the second loop draws", 0.7); add(T.loop3, "zip", "the third loop draws", 0.7);
  add(T.lblLines, "pop-soft", "label: garis medan"); add(T.tilt, "tick", "the magnetic axis"); add(T.tilt + 0.3, "pop-soft", "label: 11 degrees", 0.7);
  add(T.mini, "pop", "the small needles"); add(T.mini + 0.4, "pop-soft", "the second needle", 0.7); add(T.mini + 0.8, "pop-soft", "the third needle", 0.7); add(22.0, "tick-soft", "the needles align", 0.6);
  add(T.panC, "whoosh", "the pan back to the compass", 0.8); add(T.kick2, "swish", "the needle is flicked", 0.7); add(T.flowT, "zip", "the field lines run over the map", 0.8);
  add(24.2, "tick-soft", "the needle settles", 0.6); add(T.lblAlign, "pop-soft", "label: the needle follows");
  // kutub (26 to 34)
  add(26.1, "swish-soft", "headline", 0.7); add(T.panG2, "whoosh", "the pan to the globe", 0.8); add(T.bar, "pop", "the magnet inside the globe");
  add(T.kS, "tick", "label: south pole"); add(T.needleG, "boing", "the needle appears", 0.8); add(T.kN, "tick", "label: needle north end");
  add(T.arrows, "zip", "the pull draws itself", 0.8); add(T.arrows + 0.5, "chime", "opposites attract", 0.8); add(T.lblPull, "pop-soft", "label: opposite poles pull");
  add(32.8, "hum", "the field hums", 0.5); add(T.fadeG, "swish", "the globe fades", 0.7);
  // hasil (34 to 41)
  add(34.1, "swish-soft", "headline", 0.7); add(T.panC2, "whoosh", "the pan to the compass", 0.8); add(35.6, "tick-soft", "the needle sways", 0.6);
  add(T.noChip, "pop", "chip: cari utara"); add(T.noStrike, "zip", "the strike-through", 0.8); add(37.2, "slide-whistle-down", "the idea falls", 0.6);
  add(T.yesChip, "chime-bright", "chip: ikut medan"); add(39.0, "tick", "the needle follows the lines", 0.6); add(40.2, "tick-soft", "the lines flow", 0.5);
  // fakta (41 to 47)
  add(41.1, "swish-soft", "headline", 0.7); add(41.8, "whoosh", "the camera pushes in", 0.7); add(T.tnLine, "zip", "the true north line draws", 0.8); add(T.lblTrue, "pop-soft", "label: utara sejati");
  add(T.decl, "swish", "the needle drifts off", 0.7); add(T.arc, "zip", "the angle arc draws", 0.7); add(T.lblDecl, "pop-soft", "label: utara jarum"); add(T.lblDecl + 0.4, "tick", "label: selisih");
  add(45.4, "tick-soft", "the numbers change with time", 0.5); add(T.declBack, "swish-soft", "the needle returns", 0.6);
  // tips (47 to 56)
  add(47.1, "swish-soft", "headline", 0.7); add(T.panT, "whoosh", "the camera pulls back", 0.8); add(T.magIn2, "whoosh", "the magnet slides in", 0.8); add(T.magIn2 + 0.6, "click-crack", "the needle is pulled", 0.8);
  add(T.lblMag, "pop-soft", "label: magnet"); add(51.0, "rattle", "the needle shakes", 0.5); add(T.magOut2, "swish", "the magnet slides out", 0.7);
  add(T.iron, "thump", "the block of iron is marked", 0.7); add(T.lblIron, "pop-soft", "label: besi besar"); add(T.dip, "pop", "the card comes in"); add(T.dip + 0.6, "slide-whistle-down", "the needle dips", 0.7);
  add(T.dipEnd, "swish", "the card leaves", 0.6);
  // outro
  add(56.4, "whoosh", "the camera pulls back to the wide shot", 0.8); add(58.2, "tick-soft", "the needle sways", 0.5); add(59.4, "jingle-outro", "the loop closes", 0.6);
  return ev.sort((a, b) => a.t - b.t);
}
