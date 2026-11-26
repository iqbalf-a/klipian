/* The sound effects of kantor-berhantu: written by hand against index.tsx (SHOTS, the foil in the vice, the colleague's steps, the dusk desk, the shape, the foil carried across the room, the meter, the fan,
   the rings, the loop cut). B60: only 2 of the 197 catalog names are free of the 10 most recent videos (meow, car-horn), so the free pool is exhausted (B61 d: ask ian for new catalog sounds); every name
   here is one of the least used (one video of the last 10 each), none of the stock UI sounds, a camera cut gets its own name, no name on more than a quarter of the events. */
// Imported from the plain .ts modules, never from src/design/index.ts: render.mjs loads this file in Node.
import type { SfxEvent } from "../../src/sfx.ts";
import type { StoryT } from "../../src/schema.ts";

const FPS = 30;
const q = (t: number) => Math.round(t * FPS) / FPS;

export const music = { track: "bed-orbit", level: 0.8 } as const;

// the cuts of SHOTS in index.tsx (the first shot starts at 0)
const CUTS = [3.74, 5.9, 8.78, 11.88, 14.48, 16.48, 19.28, 21.7, 24.6, 27.5, 31.26, 33.5, 36.02, 38.8, 41.42, 45.14, 50.28];
const CUT_SOUNDS = ["bonk", "swipe", "sticker-peel", "tape-rip", "stapler", "pencil-tap", "eraser-rub", "mouse-click", "shutter-roll", "scissors-snip", "toggle-on", "countdown-beep", "finger-snap", "coin-drop", "cash-register", "camera-shutter", "glass-clink"] as const;

export function sfx(_story: StoryT): SfxEvent[] {
  const ev: SfxEvent[] = [];
  const add = (t: number, name: SfxEvent["name"], why: string, extra: Partial<SfxEvent> = {}) => ev.push({ t: q(t), name, vol: 1, why, ...extra });

  CUTS.forEach((t, i) => add(t, CUT_SOUNDS[i % CUT_SOUNDS.length], "cut to the next shot", { vol: 0.5 }));

  add(0.1, "notify-ding", "the hook text lands", { vol: 0.5 });
  [0.5, 1.4, 2.3].forEach((t) => add(t, "spring-boing", "the blade of the foil shakes by itself", { vol: 0.3 }));
  add(3.9, "elevator-ding", "the wide shot of the laboratory", { vol: 0.4 });
  [4.4, 4.9].forEach((t) => add(t, "keyboard-clack", "the older colleague works at his desk", { vol: 0.3 }));
  [6.3, 6.8, 7.3, 7.8, 8.3].forEach((t) => add(t, "woodblock-lo", "the colleague walks across the lab", { vol: 0.3 }));
  add(6.9, "pizzicato", "the scientist leans in, hand to his chin", { vol: 0.4 });
  add(10.1, "crowd-gasp", "the colleague: ini hantu", { vol: 0.4 });
  add(11.95, "power-down", "evening: the lab dims", { vol: 0.5 });
  add(12.8, "paper-crumple", "the scientist turns a page alone at the desk", { vol: 0.35 });
  add(14.55, "sigh", "dingin", { vol: 0.35 });
  add(15.45, "heartbeat", "murung", { vol: 0.5 });
  add(16.7, "teleport", "the shape appears at the corner of his eye", { vol: 0.45 });
  add(17.1, "static-burst", "the shape flickers", { vol: 0.3 });
  add(18.0, "low-battery", "he goes pale", { vol: 0.35 });
  add(19.45, "radar-blip", "he turns his head", { vol: 0.4 });
  add(20.0, "magic-twinkle", "the shape is gone", { vol: 0.5 });
  add(21.85, "anvil-ting", "the next day: the foil shakes in the vice", { vol: 0.45 });
  add(22.6, "chain-rattle", "the blade rattles", { vol: 0.3 });
  add(23.2, "glass-clink", "the cup on the bench trembles", { vol: 0.25 });
  add(24.8, "sniff", "the young technician leans in to whisper", { vol: 0.3 });
  add(26.3, "drum-roll", "pedangnya kerasukan", { vol: 0.3 });
  add(27.65, "lock-click", "the foil comes out of the vice", { vol: 0.5 });
  [28.2, 28.9, 29.6, 30.3, 31.0].forEach((t) => add(t, "bongo-lo", "the scientist walks the foil to the middle of the room", { vol: 0.3 }));
  add(29.9, "alarm-ring", "the swing grows wild", { vol: 0.25 });
  add(31.5, "brake-squeal", "the colleague backs away", { vol: 0.3 });
  add(32.6, "wheel-squeak", "the colleague's steps", { vol: 0.3 });
  add(33.7, "phone-buzz", "the scientist reaches for the meter", { vol: 0.35 });
  add(34.3, "usb-plug", "the meter is in his hand", { vol: 0.45 });
  add(36.15, "fan-whirr", "Biangnya: the new fan", { vol: 0.5 });
  add(36.5, "bike-bell", "the BARU tag", { vol: 0.35 });
  add(38.95, "sonar-ping", "the meter reads the room", { vol: 0.45 });
  add(40.2, "coin", "pill: 19 hertz", { vol: 0.55 });
  add(41.6, "wave-wash", "the rings leave the fan", { vol: 0.35 });
  [42.6, 43.7, 44.6].forEach((t) => add(t, "radar-blip", "a ring crosses the room", { vol: 0.3 }));
  add(45.3, "thunder-rumble", "too low to hear, but it shakes the room", { vol: 0.35 });
  add(47.1, "glockenspiel", "menggigil", { vol: 0.35 });
  add(48.1, "toy-piano", "murung", { vol: 0.35 });
  add(49.0, "harp-gliss", "the shape shows again in the waves", { vol: 0.45 });
  add(50.45, "triangle-ding", "the whole team stands round the vice", { vol: 0.4 });
  [51.0, 51.4].forEach((t) => add(t, "bongo-hi", "the foil shakes again", { vol: 0.3 }));
  add(53.7, "success-fanfare", "semua tahu sebabnya", { vol: 0.35 });
  add(55.04, "music-box", "the cut back to the first frame (the loop)", { vol: 0.5 });
  return ev.sort((a, b) => a.t - b.t);
}
