/* The sound effects of teknisi-tv-keliling-yang-memot: written by hand against index.tsx (SHOTS, the button presses and shutters, Bang Jaya's walk and laugh, the wallet, the battery swap,
   the violet blink, the TV coming on, the infrared rings, Bu Rina's walk, the loop cut). B60: every name is one that none of the 10 most recent videos uses (the 2026-11-25 pool). */
// Imported from the plain .ts modules, never from src/design/index.ts: render.mjs loads this file in Node.
import type { SfxEvent } from "../../src/sfx.ts";
import type { StoryT } from "../../src/schema.ts";
import { toNew } from "./timing.ts";

const FPS = 30;
const q = (t: number) => Math.round(toNew(t) * FPS) / FPS;   // the times below are the first timing (timing.ts)

export const music = { track: "bed-funk", level: 0.8 } as const;

// the cuts of SHOTS in index.tsx (the first shot starts at 0)
const CUTS = [3.98, 5.98, 8.36, 11.54, 13.06, 14.46, 17.24, 19.08, 20.26, 21.46, 24.72, 26.28, 29.24, 30.38, 32.28, 34.66, 37.1, 39.64, 41.22, 43.14, 44.46, 46.58, 47.36];
const CUT_SOUNDS = ["scissors-snip", "sticker-peel", "balloon-squeak", "steam-hiss", "tape-rip", "slap-hit"] as const;

export function sfx(_story: StoryT): SfxEvent[] {
  const ev: SfxEvent[] = [];
  const add = (t: number, name: SfxEvent["name"], why: string, extra: Partial<SfxEvent> = {}) => ev.push({ t: q(t), name, vol: 1, why, ...extra });

  CUTS.forEach((t, i) => add(t, CUT_SOUNDS[i % CUT_SOUNDS.length], "cut to the next shot", { vol: 0.6 }));

  add(0.1, "rimshot", "the hook text lands", { vol: 0.6 });
  add(2.2, "mouse-click", "the thumb on a remote button", { vol: 0.6 });
  add(2.34, "camera-shutter", "the phone photographs the remote", { vol: 0.7 });
  add(3.3, "mouse-click", "the thumb on a remote button", { vol: 0.6 });
  add(3.44, "camera-shutter", "the phone photographs the remote", { vol: 0.7 });
  add(4.3, "crowd-gasp", "Bu Rina: the TV is dead", { vol: 0.6 });
  add(4.9, "low-battery", "the dead TV", { vol: 0.5 });
  [6.3, 6.8, 7.3, 7.8].forEach((t) => add(t, "woodblock-lo", "Bang Jaya walks in", { vol: 0.4 }));
  add(8.4, "stapler", "Bang Jaya shows the flyer", { vol: 0.7 });
  add(9.62, "cash-register", "pill: Rp 3.000.000");
  add(11.7, "spring-boing", "Bang Jaya laughs", { vol: 0.6 });
  add(12.3, "bongo-hi", "Bang Jaya laughs again", { vol: 0.5 });
  add(13.2, "radar-blip", "Bang Jaya: remote kok difoto", { vol: 0.5 });
  add(16.3, "keyboard-clack", "Pak Sugeng presses power", { vol: 0.55 });
  add(16.9, "mouse-click", "Pak Sugeng presses power again", { vol: 0.5 });
  add(17.6, "fan-whirr", "he stares at the phone", { vol: 0.35 });
  add(19.2, "plunger-pop", "the phone screen pops up, enlarged");
  add(19.7, "powerdown-8bit", "the screen stays dark", { vol: 0.35 });
  add(20.5, "spring-boing", "Bang Jaya gets louder", { vol: 0.5 });
  add(22.6, "pencil-tap", "Bang Jaya jabs his finger", { vol: 0.5 });
  add(24.9, "key-jingle", "Bu Rina takes out her wallet", { vol: 0.6 });
  add(26.9, "zipper-pull", "Pak Sugeng slides the back cover", { vol: 0.5 });
  add(27.3, "lock-click", "the cover pops off", { vol: 0.6 });
  add(27.8, "coin-drop", "the old batteries hit the floor", { vol: 0.5 });
  add(28.1, "wheel-squeak", "a battery rolls", { vol: 0.3 });
  add(28.45, "toy-piano", "two new batteries appear", { vol: 0.6 });
  add(28.9, "usb-plug", "the batteries go in", { vol: 0.6 });
  add(30.4, "plunger-pop", "the phone screen pops up again", { vol: 0.7 });
  add(29.9, "mouse-click", "he presses the button", { vol: 0.6 });
  add(31.1, "elevator-ding", "the violet blink on the screen", { vol: 0.6 });
  add(31.76, "magic-twinkle", "ungu", { vol: 0.6 });
  add(32.76, "teleport", "the TV comes on", { vol: 0.7 });
  add(33.1, "glockenspiel", "the picture appears", { vol: 0.7 });
  add(33.4, "harp-gliss", "it works", { vol: 0.5 });
  add(34.9, "sonar-ping", "the infrared rings start", { vol: 0.4 });
  add(35.4, "mouse-click", "he presses the button", { vol: 0.5 });
  add(36.3, "triangle-ding", "pill: cahaya inframerah");
  [37.7, 38.2, 38.7].forEach((t) => add(t, "woodblock-lo", "Bu Rina walks over", { vol: 0.4 }));
  add(37.88, "xylophone-g", "pill: 940 nm", { vol: 0.8 });
  add(40.0, "sigh", "the eye sees nothing", { vol: 0.4 });
  add(41.3, "static-burst", "the camera sensor", { vol: 0.4 });
  add(41.5, "laser-zap", "the phone sees the light", { vol: 0.5 });
  add(41.62, "shutter-roll", "the phone photographs the remote", { vol: 0.6 });
  add(43.2, "powerdown-8bit", "the screen stays dark", { vol: 0.4 });
  add(43.6, "low-battery", "the remote is the problem", { vol: 0.6 });
  add(45.0, "yawn", "Pak Sugeng shrugs", { vol: 0.3 });
  add(46.7, "bird-chirp", "the next morning", { vol: 0.5 });
  [46.9, 47.25].forEach((t) => add(t, "woodblock-lo", "Bang Jaya walks to his bench", { vol: 0.4 }));
  add(47.9, "eraser-rub", "Bang Jaya lifts the phone", { vol: 0.4 });
  add(48.2, "camera-shutter", "he photographs the remote", { vol: 0.7 });
  add(49.0, "mouse-click", "the thumb on a remote button", { vol: 0.55 });
  add(49.7, "keyboard-clack", "the thumb on a remote button", { vol: 0.55 });
  add(50.14, "train-whistle", "the cut back to the first frame (the loop)", { vol: 0.7 });
  return ev.sort((a, b) => a.t - b.t);
}
