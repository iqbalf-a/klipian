/* The sound effects of teknisi-tv-keliling-yang-memot: written by hand against index.tsx (SHOTS, the button presses and shutters, Bang Jaya's walk and laugh, the wallet, the battery swap,
   the violet blink, the TV coming on, the infrared rings, Bu Rina's walk, the loop cut). */
// Imported from the plain .ts modules, never from src/design/index.ts: render.mjs loads this file in Node.
import type { SfxEvent } from "../../src/sfx.ts";
import type { StoryT } from "../../src/schema.ts";

const FPS = 30;
const q = (t: number) => Math.round(t * FPS) / FPS;

export const music = { track: "bed-curious", level: 0.8 } as const;

// the cuts of SHOTS in index.tsx (the first shot starts at 0)
const CUTS = [3.98, 5.98, 8.36, 11.54, 13.06, 14.46, 17.24, 19.08, 20.26, 21.46, 24.72, 26.28, 29.24, 30.38, 32.28, 34.66, 37.1, 39.64, 41.22, 43.14, 44.46, 46.58, 47.36];
const CUT_SOUNDS = ["whoosh", "swish", "whoosh-soft", "swoop", "zoom-whoosh", "swish-soft", "swish-down"] as const;

export function sfx(_story: StoryT): SfxEvent[] {
  const ev: SfxEvent[] = [];
  const add = (t: number, name: SfxEvent["name"], why: string, extra: Partial<SfxEvent> = {}) => ev.push({ t: q(t), name, vol: 1, why, ...extra });

  CUTS.forEach((t, i) => add(t, CUT_SOUNDS[i % CUT_SOUNDS.length], "cut to the next shot", { vol: 0.7 }));

  add(0.1, "pop", "the hook text lands");
  add(2.2, "click-soft", "the thumb on a remote button", { vol: 0.6 });
  add(2.34, "camera-shutter", "the phone photographs the remote", { vol: 0.7 });
  add(3.3, "click-soft", "the thumb on a remote button", { vol: 0.6 });
  add(3.44, "camera-shutter", "the phone photographs the remote", { vol: 0.7 });
  add(4.3, "huh", "Bu Rina: the TV is dead", { vol: 0.6 });
  add(4.9, "power-down", "the dead TV", { vol: 0.5 });
  [6.3, 6.8, 7.3, 7.8].forEach((t) => add(t, "footstep", "Bang Jaya walks in", { vol: 0.5 }));
  add(8.4, "page-flip", "Bang Jaya shows the flyer", { vol: 0.7 });
  add(9.62, "coin", "pill: Rp 3.000.000");
  add(11.7, "boing", "Bang Jaya laughs", { vol: 0.6 });
  add(12.3, "bonk", "Bang Jaya laughs again", { vol: 0.5 });
  add(13.2, "blip-alert", "Bang Jaya: remote kok difoto", { vol: 0.45 });
  add(16.3, "tick", "Pak Darto presses power", { vol: 0.55 });
  add(16.9, "tock", "Pak Darto presses power again", { vol: 0.5 });
  add(17.6, "hum", "he stares at the phone", { vol: 0.4 });
  add(19.2, "pop-soft", "the phone screen pops up, enlarged");
  add(19.7, "error-buzz", "the screen stays dark", { vol: 0.4 });
  add(20.5, "boing", "Bang Jaya gets louder", { vol: 0.5 });
  add(22.6, "tick-soft", "Bang Jaya jabs his finger", { vol: 0.4 });
  add(24.9, "key-jingle", "Bu Rina takes out her wallet", { vol: 0.6 });
  add(26.9, "zipper-pull", "Pak Darto slides the back cover", { vol: 0.5 });
  add(27.3, "click-crack", "the cover pops off", { vol: 0.6 });
  add(27.8, "can-tap", "the old batteries hit the floor", { vol: 0.6 });
  add(28.1, "tick-soft", "a battery rolls", { vol: 0.4 });
  add(28.45, "pop-wood", "two new batteries appear", { vol: 0.6 });
  add(28.9, "switch", "the batteries go in", { vol: 0.6 });
  add(30.4, "plop", "the phone screen pops up again", { vol: 0.7 });
  add(29.9, "key-blip", "he presses the button", { vol: 0.6 });
  add(31.1, "notify-ding", "the violet blink on the screen", { vol: 0.8 });
  add(31.76, "sparkle", "ungu", { vol: 0.6 });
  add(32.76, "power-up", "the TV comes on");
  add(33.1, "chime-bright", "the picture appears", { vol: 0.7 });
  add(33.4, "success-fanfare", "it works", { vol: 0.4 });
  add(34.9, "wave-wash", "the infrared rings start", { vol: 0.35 });
  add(35.4, "key-blip", "he presses the button", { vol: 0.5 });
  add(36.3, "bell-soft", "pill: cahaya inframerah");
  [37.7, 38.2, 38.7].forEach((t) => add(t, "footstep", "Bu Rina walks over", { vol: 0.5 }));
  add(37.88, "glass-ting", "pill: 940 nm", { vol: 0.8 });
  add(40.0, "slide-whistle-down", "the eye sees nothing", { vol: 0.5 });
  add(41.3, "static-burst", "the camera sensor", { vol: 0.4 });
  add(41.5, "toggle-on", "the phone sees the light", { vol: 0.7 });
  add(41.62, "camera-shutter", "the phone photographs the remote", { vol: 0.6 });
  add(43.2, "power-down", "the screen stays dark", { vol: 0.5 });
  add(43.6, "low-battery", "the remote is the problem", { vol: 0.6 });
  add(45.0, "thump", "Pak Darto shrugs", { vol: 0.4 });
  add(46.7, "bird-chirp", "the next morning", { vol: 0.5 });
  [46.9, 47.25].forEach((t) => add(t, "footstep", "Bang Jaya walks to his bench", { vol: 0.5 }));
  add(47.9, "cloth-rustle", "Bang Jaya lifts the phone", { vol: 0.5 });
  add(48.2, "camera-shutter", "he photographs the remote", { vol: 0.7 });
  add(49.0, "click-soft", "the thumb on a remote button", { vol: 0.55 });
  add(49.7, "click-soft", "the thumb on a remote button", { vol: 0.55 });
  add(50.14, "slide-whistle-up", "the cut back to the first frame (the loop)", { vol: 0.8 });
  return ev.sort((a, b) => a.t - b.t);
}
