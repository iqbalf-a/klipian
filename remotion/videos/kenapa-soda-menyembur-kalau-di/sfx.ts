/* The sound of "Kenapa soda menyembur kalau dikocok lalu dibuka?", written by hand against index.tsx: a sound on every object that enters, every camera move,
   every label and every state change, on the frame of its picture (the moments come from plan.ts). About one event a second. Only names of the locked set in src/catalog.ts. */
import type { SfxEvent } from "../../src/sfx.ts";
import type { SfxName } from "../../src/catalog.ts";
import type { StoryT } from "../../src/schema.ts";
import { FPS } from "../../src/timeline.ts";
import { T } from "./plan.ts";

export const music = { track: "bed-bounce", level: 0.8 } as const;

export function sfx(_story: StoryT): SfxEvent[] {
  const ev: SfxEvent[] = [];
  const add = (t: number, name: SfxName, why: string, vol = 1) => ev.push({ t: Math.round(Math.max(0, t) * FPS) / FPS, name, vol, why });
  // hook
  add(0.2, "pop-soft", "kicker and headline come in", 0.8); add(0.9, "tick-soft", "the ice cubes bob", 0.5); add(T.push, "whoosh", "the establishing push", 0.8); add(2.4, "swish-soft", "the bottle sways", 0.5);
  // sting
  add(3.0, "boing", "the mascot pops in"); add(3.1, "jingle-sting", "Intip yuk!", 0.7); add(3.27, "pop", "the pill"); add(3.85, "swish", "the mascot leaves", 0.6);
  // tekanan
  add(4.1, "swish-soft", "headline", 0.7); add(T.dots, "bubble-rise", "gas dots appear in the drink", 0.7); add(T.lblGas, "pop-soft", "label: dissolved gas");
  add(6.2, "swish", "the camera pushes in", 0.5); add(T.pressA, "zip", "arrow down, left", 0.8); add(T.pressB, "zip", "arrow down, middle", 0.8); add(T.pressC, "zip", "arrow down, right", 0.8);
  add(8.3, "thump", "the gas presses", 0.6); add(T.lblPress, "tick", "label: pressure"); add(9.4, "tick-soft", "the cap holds", 0.5); add(T.lblCap, "pop-soft", "label: the cap holds it"); add(11.2, "swish", "the camera moves in", 0.6);
  // kocok
  add(12.1, "swish-soft", "headline", 0.7); add(12.6, "whoosh", "the camera closes on the bottle", 0.7);
  for (let i = 0; i < 6; i++) add(T.shakeA + i * 0.75, i % 2 ? "rattle" : "boing", "the bottle is shaken", 0.55);
  add(T.shakeA + 4.4, "bubble-rise", "bubbles fill the liquid", 0.7); add(T.lblSmall, "pop-soft", "label: small bubbles"); add(16.0, "tick-soft", "bubbles drift", 0.5);
  add(T.speck, "click-crack", "the speck on the wall"); add(T.lblDust, "tick", "label: dust or rough spot"); add(T.grow, "bubble-rise", "a bubble starts from the speck", 0.7); add(T.lblSpot, "pop-soft", "label: where a bubble starts");
  add(T.chip, "glass-ting", "source chip", 0.7); add(21.4, "swish", "the camera leaves", 0.6);
  // buka
  add(22.1, "swish-soft", "headline", 0.7); add(22.9, "whoosh", "the camera goes to the neck", 0.7); add(T.twist, "squeak", "the cap twists", 0.7); add(24.8, "tick-soft", "the cap gives", 0.6);
  add(T.pop, "click-crack", "the pop"); add(T.pop + 0.05, "puff", "the gas rushes out"); add(T.pop + 0.15, "zoom-whoosh", "foam shoots up", 0.8); add(T.lblDrop, "slide-whistle-down", "pressure drops", 0.6);
  add(26.8, "bubble-rise", "bubbles multiply", 0.8); add(T.lblMore, "chime-bright", "label: more bubbles"); add(T.spill, "sizzle", "foam runs down", 0.6); add(29.2, "drip", "drops fall on the counter", 0.6);
  add(T.lblOut, "pop-soft", "label: it spills"); add(30.6, "swish", "the camera pulls back", 0.6); add(31.8, "drip", "drops fall", 0.5);
  // hasil
  add(33.1, "swish-soft", "headline", 0.7); add(T.lblFoam, "pop", "label: foam sprays"); add(35.0, "sizzle", "the foam dies down", 0.4);
  add(T.wipe, "swish", "the counter is wiped", 0.7); add(T.swapOut, "whoosh", "the old bottle leaves", 0.7); add(T.swapIn, "pop", "the new bottle arrives"); add(T.swapIn + 0.5, "thump", "it lands on the counter", 0.6);
  add(T.dissolveA, "bubble-rise", "bubbles start to dissolve", 0.6); add(T.clock, "pop", "the clock"); add(T.lblMin, "tick", "label: some minutes"); add(39.6, "tick-soft", "the clock ticks", 0.5);
  add(40.4, "tick-soft", "the clock ticks", 0.5); add(T.dissolveA + 2.6, "chime", "label: bubbles dissolve"); add(41.6, "swish", "the camera settles", 0.5);
  // tepuk
  add(42.1, "swish-soft", "headline", 0.7); add(42.7, "whoosh", "the camera closes in", 0.7); add(T.tap1, "thump", "tap 1", 0.7); add(T.tap2, "thump", "tap 2", 0.7); add(T.tap3, "thump", "tap 3", 0.7);
  add(T.cardN, "pop", "label: 1,031 cans"); add(T.lblNo, "blip-alert", "label: no difference", 0.7); add(47.2, "swish", "the camera leaves", 0.6);
  // tips
  add(48.1, "swish-soft", "headline", 0.7); add(48.7, "whoosh", "the camera moves to the clock", 0.7); add(T.clockIn, "pop-soft", "the clock comes back"); add(T.lblWait, "tick", "label: wait first");
  add(50.8, "tick-soft", "the clock ticks", 0.5); add(51.6, "tick-soft", "the clock ticks", 0.5); add(T.arrowAway, "zip", "the arrow away from the face", 0.8); add(T.lblAway, "chime", "label: cap away from the face");
  add(54.6, "swish-soft", "the camera settles", 0.5);
  // outro
  add(T.fadeOut, "swish", "the camera pulls back", 0.6); add(56.5, "zoom-whoosh", "the pull back to the wide shot", 0.7); add(57.8, "tick-soft", "the ice cubes bob", 0.5); add(58.4, "jingle-outro", "loop back", 0.7);
  return ev.sort((a, b) => a.t - b.t);
}
