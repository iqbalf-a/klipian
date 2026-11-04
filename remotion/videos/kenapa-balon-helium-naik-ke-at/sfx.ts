/* The sound of "Kenapa balon helium naik ke atas?", written by hand against index.tsx: a sound on every object that enters, every camera move and every label,
   on the frame of its picture (the moments come from plan.ts). About one event a second. Only names of the locked set in src/catalog.ts. */
import type { SfxEvent } from "../../src/sfx.ts";
import type { SfxName } from "../../src/catalog.ts";
import type { StoryT } from "../../src/schema.ts";
import { FPS } from "../../src/timeline.ts";
import { T } from "./plan.ts";

export const music = { track: "bed-sunny", level: 0.8 } as const;

export function sfx(_story: StoryT): SfxEvent[] {
  const ev: SfxEvent[] = [];
  const add = (t: number, name: SfxName, why: string, vol = 1) => ev.push({ t: Math.round(Math.max(0, t) * FPS) / FPS, name, vol, why });
  // hook
  add(0.2, "pop-soft", "kicker and headline come in", 0.8); add(0.9, "swish-soft", "the ribbon sways", 0.5); add(T.push, "whoosh", "the establishing push", 0.8); add(2.5, "tick-soft", "the balloon bobs", 0.5);
  // sting
  add(3.0, "boing", "the mascot pops in"); add(3.1, "jingle-sting", "Intip yuk!", 0.7); add(3.27, "pop", "the pill"); add(3.85, "swish", "the mascot leaves", 0.6);
  // udara
  add(4.1, "swish-soft", "headline", 0.7); add(T.dots, "bubble-rise", "air bubbles fill the hall", 0.7); add(5.0, "swish-soft", "the camera backs off", 0.5);
  add(T.downA, "zip", "the first arrow down", 0.8); add(T.downB, "zip", "the second arrow down", 0.8); add(6.4, "thump", "the air presses", 0.6);
  add(T.lblPress, "pop-soft", "label: air has weight"); add(8.5, "tick-soft", "a bubble drifts", 0.5); add(10.2, "swish", "the camera moves on", 0.6);
  // ringan
  add(11.1, "swish-soft", "headline", 0.7); add(T.panScale - 0.1, "whoosh", "the pan to the balance", 0.8); add(T.beam, "pop", "the balance appears");
  add(T.cubeAir, "glass-ting", "the cube of air", 0.8); add(T.cubeHe, "glass-ting", "the cube of helium", 0.8); add(T.tilt, "slide-whistle-down", "the air side sinks", 0.6);
  add(14.2, "thump", "the beam settles", 0.6); add(T.lblAir, "tick", "label: air"); add(T.lblHe, "tick", "label: helium"); add(T.lblNum, "chime", "0.18 g per litre");
  add(17.2, "swish", "the camera leaves", 0.6);
  // dorong
  add(18.1, "swish-soft", "headline", 0.7); add(17.9, "whoosh", "the pan back to the balloon", 0.7); add(T.hit, "tick-soft", "air nudges the balloon", 0.6);
  add(T.upA, "zip", "arrow up, left", 0.8); add(T.upB, "zip", "arrow up, right", 0.8); add(T.upC, "zip", "arrow up under the left", 0.8); add(T.upD, "zip", "arrow up under the right", 0.8);
  add(T.lblPush, "chime-bright", "label: the air pushes"); add(22.2, "swish-soft", "the camera pushes in", 0.5); add(T.weight, "tick", "the weight arrow"); add(T.lblWeight, "pop-soft", "label: balloon weight");
  add(T.lblDisp, "chime", "equals the displaced air"); add(25.6, "swish", "the camera settles", 0.6);
  // naik
  add(26.1, "swish-soft", "headline", 0.7); add(T.untie, "click-crack", "the ribbon lets go"); add(T.lblFree, "pop", "label: let go"); add(T.rise, "whoosh", "the balloon lifts off");
  add(28.4, "bubble-rise", "it climbs", 0.7); add(29.6, "swish-soft", "the camera follows", 0.6); add(30.8, "slide-whistle-down", "it slows near the ceiling", 0.5); add(T.bump, "boing", "it bumps the ceiling");
  add(32.6, "squeak", "the balloon rubs the ceiling", 0.6);
  // inti
  add(34.1, "swish-soft", "headline", 0.7); add(T.ghost, "glass-ting", "the ghost of displaced air"); add(T.lblBalloon, "pop-soft", "label: balloon and helium"); add(T.less, "pop", "the less-than sign");
  add(T.lblAirDisp, "pop-soft", "label: displaced air"); add(T.chime, "chime-bright", "lighter than the air"); add(39.8, "puff", "the balloon rests", 0.5);
  // batas
  add(41.2, "swish-soft", "headline", 0.7); add(T.grow, "puff", "the balloon swells", 0.7); add(T.thin, "tick-soft", "the air thins", 0.6); add(T.lblPressure, "pop-soft", "label: pressure falls");
  add(43.4, "bubble-rise", "bubbles thin out", 0.5); add(T.equal, "zip", "the balance of weights"); add(T.lblEqual, "chime", "weights equal, it stops"); add(46.4, "swish", "the camera leaves", 0.6);
  // tips
  add(47.1, "swish-soft", "headline", 0.7); add(T.tips, "whoosh", "the camera drops", 0.7); add(T.cardA, "pop", "the breath balloon"); add(48.3, "thump", "it lies on the floor", 0.6); add(T.lblBreath, "tick", "label: breath, it falls");
  add(T.cardB, "pop", "the helium balloon"); add(T.lblHelium, "chime-bright", "label: helium, it floats"); add(53.0, "tick-soft", "the balloon bobs", 0.5); add(54.4, "swish-soft", "the camera settles", 0.5);
  // outro
  add(T.fadeOld, "swish", "the camera pulls back", 0.6); add(56.5, "zoom-whoosh", "the pull back to the wide shot", 0.7); add(T.newBalloon, "pop", "a new balloon is tied"); add(58.4, "jingle-outro", "loop back", 0.7);
  return ev.sort((a, b) => a.t - b.t);
}
