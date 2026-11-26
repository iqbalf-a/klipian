/* The sound effects of kantor-berhantu (90 s): written by hand against index.tsx (SHOTS, the worker who runs out, the creak, the shape at the corner of his eye, the gas bottle, the spare foil in the vice,
   the whisper, the foil carried across the room, the fan, the 19 hertz pill, the rings and their reflection, the loop cut). B60: only 2 of the 197 catalog names are free of the 10 most recent videos
   (meow, car-horn), so the free pool is exhausted (B61 d: ask ian for new catalog sounds); every name here is one of the least used (one video of the last 10 each), none of the stock UI sounds, a camera cut
   gets its own name, no name on more than a quarter of the events. */
// Imported from the plain .ts modules, never from src/design/index.ts: render.mjs loads this file in Node.
import type { SfxEvent } from "../../src/sfx.ts";
import type { StoryT } from "../../src/schema.ts";

const FPS = 30;
const q = (t: number) => Math.round(t * FPS) / FPS;

export const music = { track: "bed-rainy", level: 0.8 } as const;

// the cuts of SHOTS in index.tsx (the first shot starts at 0)
const CUTS = [4.4, 6.2, 8.82, 10.24, 12.76, 16.9, 21.18, 25.52, 27.84, 29.98, 32.78, 36.06, 38.42, 40.5, 43.24, 46.32, 49.58, 51.98, 54.46, 57.2, 59.24, 61.34, 62.92, 68.92, 74.9, 77.4, 82.5, 84.98];
const CUT_SOUNDS = ["bonk", "swipe", "sticker-peel", "tape-rip", "stapler", "pencil-tap", "eraser-rub", "mouse-click", "shutter-roll", "scissors-snip", "toggle-on", "countdown-beep", "finger-snap", "coin-drop", "cash-register", "camera-shutter", "glass-clink"] as const;

export function sfx(_story: StoryT): SfxEvent[] {
  const ev: SfxEvent[] = [];
  const add = (t: number, name: SfxEvent["name"], why: string, extra: Partial<SfxEvent> = {}) => ev.push({ t: q(t), name, vol: 1, why, ...extra });

  CUTS.forEach((t, i) => add(t, CUT_SOUNDS[i % CUT_SOUNDS.length], "cut to the next shot", { vol: 0.5 }));

  add(0.1, "notify-ding", "the hook text lands", { vol: 0.5 });
  [0.5, 1.4, 2.3, 3.2].forEach((t) => add(t, "spring-boing", "the blade of the foil vibrates by itself", { vol: 0.3 }));
  add(4.55, "elevator-ding", "the wide shot of the laboratory", { vol: 0.4 });
  [5.0, 5.5].forEach((t) => add(t, "keyboard-clack", "the older colleague works at his desk", { vol: 0.3 }));
  [6.3, 6.8, 7.3, 7.8].forEach((t) => add(t, "woodblock-lo", "the colleague walks across the lab", { vol: 0.3 }));
  add(8.95, "alarm-ring", "one worker runs out of the building", { vol: 0.25 });
  [9.2, 9.5, 9.8, 10.1].forEach((t) => add(t, "bongo-lo", "his running steps", { vol: 0.3 }));
  add(10.9, "sigh", "another one is gloomy", { vol: 0.35 });
  add(11.6, "chain-rattle", "he shivers", { vol: 0.25 });
  add(14.1, "crowd-gasp", "the colleague: ini hantu", { vol: 0.4 });
  add(17.05, "power-down", "evening: the lab dims", { vol: 0.5 });
  add(18.6, "paper-crumple", "Vic turns a page alone at the desk", { vol: 0.35 });
  add(21.3, "heartbeat", "murung", { vol: 0.5 });
  add(23.0, "glass-clink", "the cup on the bench trembles", { vol: 0.25 });
  add(24.2, "thunder-rumble", "the room creaks", { vol: 0.3 });
  add(26.4, "pizzicato", "he ignores it and works on", { vol: 0.3 });
  add(28.0, "teleport", "the shape appears at the corner of his eye", { vol: 0.45 });
  add(28.9, "static-burst", "the shape flickers", { vol: 0.3 });
  add(30.4, "radar-blip", "he turns his head", { vol: 0.4 });
  add(31.2, "magic-twinkle", "the shape is gone", { vol: 0.5 });
  [33.1, 33.6].forEach((t) => add(t, "wheel-squeak", "he steps to the gas bottle", { vol: 0.3 }));
  add(34.5, "sniff", "he checks for a leak", { vol: 0.3 });
  add(35.4, "lock-click", "no leak", { vol: 0.4 });
  add(36.8, "low-battery", "he must be tired", { vol: 0.35 });
  add(38.55, "triangle-ding", "next day, a spare foil in his hand", { vol: 0.35 });
  add(41.85, "usb-plug", "the foil is clamped in the vice", { vol: 0.45 });
  [42.5, 43.0].forEach((t) => add(t, "brake-squeal", "he steps away", { vol: 0.2 }));
  add(43.5, "anvil-ting", "the blade starts to vibrate", { vol: 0.45 });
  [44.2, 45.0, 45.8].forEach((t) => add(t, "bike-bell", "the blade vibrates wildly", { vol: 0.25 }));
  add(46.5, "drum-roll", "the whisper", { vol: 0.3 });
  add(47.8, "glockenspiel", "pedangnya kerasukan", { vol: 0.35 });
  [50.0, 50.8, 51.6, 52.4, 53.2].forEach((t) => add(t, "bongo-hi", "he carries the foil across the room", { vol: 0.3 }));
  add(52.4, "phone-buzz", "the swing is strongest in the middle", { vol: 0.35 });
  add(54.0, "wave-wash", "it fades", { vol: 0.3 });
  add(54.9, "toy-piano", "he looks for the cause", { vol: 0.35 });
  add(57.35, "fan-whirr", "the new extractor fan", { vol: 0.5 });
  add(57.8, "camera-shutter", "the BARU tag", { vol: 0.3 });
  add(59.5, "sonar-ping", "the fan hums", { vol: 0.45 });
  add(60.0, "coin", "pill: 19 hertz", { vol: 0.55 });
  [61.6, 62.4].forEach((t) => add(t, "harp-gliss", "too low to hear", { vol: 0.3 }));
  add(63.2, "success-fanfare", "the book of symptoms", { vol: 0.3 });
  [65.0, 66.5, 68.0].forEach((t) => add(t, "toggle-on", "the symptoms, one by one", { vol: 0.25 }));
  add(69.2, "swipe", "the rings meet the wall", { vol: 0.3 });
  [70.5, 72.0, 73.4].forEach((t) => add(t, "countdown-beep", "a ring crosses the room", { vol: 0.3 }));
  add(75.2, "sticker-peel", "the paper", { vol: 0.3 });
  [77.0, 79.0].forEach((t) => add(t, "mouse-click", "he writes", { vol: 0.25 }));
  add(80.9, "tape-rip", "the shape shows again in the waves", { vol: 0.4 });
  add(82.7, "scissors-snip", "the ghost was a sound", { vol: 0.4 });
  add(85.1, "stapler", "the whole team stands round the vice", { vol: 0.4 });
  [85.8, 86.6, 87.4].forEach((t) => add(t, "pencil-tap", "the foil vibrates again", { vol: 0.3 }));
  add(88.6, "cash-register", "semua tahu sebabnya", { vol: 0.35 });
  add(89.5, "music-box", "the cut back to the first frame (the loop)", { vol: 0.5 });
  return ev.sort((a, b) => a.t - b.t);
}
