/* The sound of "Petir lebih panas dari permukaan matahari", written by hand against index.tsx: a sound on every object that enters, every camera move, label and
   state change, on the frame of its picture (the moments come from plan.ts). About one event a second. Only names of the locked set in src/catalog.ts. */
import type { SfxEvent } from "../../src/sfx.ts";
import type { SfxName } from "../../src/catalog.ts";
import type { StoryT } from "../../src/schema.ts";
import { FPS } from "../../src/timeline.ts";
import { T } from "./plan.ts";

export const music = { track: "bed-neon", level: 0.8 } as const;

export function sfx(_story: StoryT): SfxEvent[] {
  const ev: SfxEvent[] = [];
  const add = (t: number, name: SfxName, why: string, vol = 1) => ev.push({ t: Math.round(Math.max(0, t) * FPS) / FPS, name, vol, why });
  const [s0, s1, s2, s3, s4, s5] = T.strikes;
  // hook: the wide set, a first quick strike, the push in
  add(0.2, "pop-soft", "kicker and headline come in", 0.8); add(0.5, "rain-patter", "the rain starts", 0.5); add(s0, "click-crack", "a quick strike", 0.9); add(s0 + 0.1, "sizzle", "the bolt buzzes", 0.6);
  add(T.push, "whoosh", "the establishing push", 0.8); add(2.4, "hum", "the storm cloud hums", 0.5);
  // sting
  add(3.0, "boing", "the mascot pops in"); add(3.1, "jingle-sting", "Intip yuk!", 0.7); add(3.27, "pop", "the pill"); add(3.85, "swish", "the mascot leaves", 0.6);
  // arus: the current runs through the air
  add(4.1, "swish-soft", "headline", 0.7); add(5.0, "hum", "the cloud charges", 0.6); add(5.7, "tick", "the air tightens", 0.6); add(s1, "click-crack", "the bolt strikes"); add(s1 + 0.1, "zip", "the current runs down", 0.8);
  add(T.glowA, "sizzle", "the air glows", 0.7); add(7.6, "bubble-rise", "the glow pulses", 0.5); add(8.8, "tick-soft", "a window flickers", 0.5); add(s2, "click-crack", "the second strike", 0.9);
  add(s2 + 0.1, "zip", "the current again", 0.7); add(11.0, "hum", "the channel hums", 0.5); add(12.5, "swish", "the camera moves on", 0.6);
  // panas: the red gauge
  add(13.1, "swish-soft", "headline", 0.7); add(13.2, "whoosh", "the pan to the gauge", 0.7); add(s3, "click-crack", "the strike that heats"); add(s3 + 0.15, "sizzle", "the air burns", 0.8);
  add(T.gaugeA, "pop", "the red gauge appears"); add(16.0, "slide-whistle-down", "the gauge climbs", 0.4); add(T.lblA, "chime-bright", "30,000 label"); add(19.0, "tick-soft", "the gauge shimmers", 0.5);
  add(20.4, "hum", "the heat hums", 0.5); add(21.6, "swish", "the camera moves on", 0.6);
  // matahari: the sun's gauge
  add(22.1, "swish-soft", "headline", 0.7); add(22.3, "whoosh", "the pan to the sun", 0.7); add(T.gaugeB, "pop", "the sun gauge appears"); add(T.sun, "chime", "the sun lights up", 0.8);
  add(T.lblB, "chime-bright", "5,500 label"); add(27.0, "tick", "the sun glints", 0.6); add(28.6, "puff", "the sun pulses", 0.5); add(29.5, "swish", "the camera moves on", 0.6);
  // banding: four more pieces make about five
  add(30.1, "swish-soft", "headline", 0.7); add(30.9, "whoosh", "the camera pulls back", 0.7); add(T.seg[0], "pop", "piece two"); add(T.seg[1], "pop", "piece three"); add(T.seg[2], "pop", "piece four");
  add(T.seg[3], "pop", "piece five"); add(T.line, "zip", "the dashed line to the top", 0.8); add(T.lblX5, "chime-bright", "about five times"); add(36.8, "tick-soft", "the gauges settle", 0.5);
  add(38.3, "swish", "the camera moves on", 0.6);
  // dentum: the thunder
  add(39.1, "swish-soft", "headline", 0.7); add(39.6, "whoosh", "the camera goes back to the cloud", 0.7); add(s4, "click-crack", "the strike"); add(s4 + 0.25, "thump", "the air jumps");
  add(T.rings[0], "thump", "the first ring", 0.9); add(T.rings[0] + 0.15, "rattle", "the thunder rolls", 0.9); add(T.rings[1], "thump", "the second ring", 0.8); add(T.rings[2], "thump", "the third ring", 0.7);
  add(T.rings[0] + 0.3, "tick-soft", "label: thunder", 0.6); add(44.0, "rain-patter", "the rain again", 0.5); add(45.4, "hum", "the cloud rumbles away", 0.5); add(46.5, "swish", "the camera moves on", 0.6);
  // singkat: a flash, then it cools
  add(47.1, "swish-soft", "headline", 0.7); add(47.7, "zoom-whoosh", "the push on the channel", 0.8); add(s5, "click-crack", "the very short strike"); add(T.lblUs, "tick", "label: dozens of microseconds");
  add(T.cool, "sizzle", "the channel starts to cool", 0.6); add(T.lblCool, "pop-soft", "label: cools"); add(52.0, "slide-whistle-down", "the gauge drops", 0.5); add(53.4, "puff", "the last of the heat", 0.6);
  add(54.6, "bubble-rise", "the gauges sink away", 0.5); add(55.1, "swish", "the camera leaves the gauges", 0.6);
  // outro
  add(56.1, "jingle-outro", "loop back", 0.7); add(57.6, "swish-soft", "the set rests", 0.5);
  return ev.sort((a, b) => a.t - b.t);
}
