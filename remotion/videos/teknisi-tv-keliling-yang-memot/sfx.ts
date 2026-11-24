/* The sound effects of teknisi-tv-keliling-yang-memot: written by hand against index.tsx (SHOTS, the button presses and shutters, Bang Jaya's walk and laugh, the wallet, the battery swap,
   the violet blink, the TV coming on, the infrared rings, Bu Rina's walk, the loop cut). */
// Imported from the plain .ts modules, never from src/design/index.ts: render.mjs loads this file in Node.
import type { SfxEvent } from "../../src/sfx.ts";
import type { StoryT } from "../../src/schema.ts";

const FPS = 30;
const q = (t: number) => Math.round(t * FPS) / FPS;

export const music = { track: "bed-funk", level: 0.8 } as const;

// the cuts of SHOTS in index.tsx (the first shot starts at 0)
const CUTS = [3.98, 5.98, 8.36, 11.54, 13.06, 14.46, 17.24, 19.08, 20.26, 21.46, 24.72, 26.28, 29.24, 30.38, 32.28, 34.66, 37.1, 39.64, 41.22, 43.14, 44.46, 46.58, 47.36];
const CUT_SOUNDS = ["rain-patter", "slurp", "bee-buzz"] as const;

export function sfx(_story: StoryT): SfxEvent[] {
  const ev: SfxEvent[] = [];
  const add = (t: number, name: SfxEvent["name"], why: string, extra: Partial<SfxEvent> = {}) => ev.push({ t: q(t), name, vol: 1, why, ...extra });

  CUTS.forEach((t, i) => add(t, CUT_SOUNDS[i % CUT_SOUNDS.length], "cut to the next shot", { vol: 0.7 }));

  add(0.1, "cymbal-crash", "the hook text lands", { vol: 0.4 });
  add(2.2, "key-jingle", "the thumb on a remote button", { vol: 0.6 });
  add(2.34, "camera-shutter", "the phone photographs the remote", { vol: 0.7 });
  add(3.3, "key-jingle", "the thumb on a remote button", { vol: 0.6 });
  add(3.44, "camera-shutter", "the phone photographs the remote", { vol: 0.7 });
  add(4.3, "meow", "Bu Rina: the TV is dead", { vol: 0.6 });
  add(4.9, "low-battery", "the dead TV", { vol: 0.5 });
  [6.3, 6.8, 7.3, 7.8].forEach((t) => add(t, "rain-patter", "Bang Jaya walks in", { vol: 0.5 }));
  add(8.4, "zipper-pull", "Bang Jaya shows the flyer", { vol: 0.7 });
  add(9.62, "key-jingle", "pill: Rp 3.000.000");
  add(11.7, "frog-croak", "Bang Jaya laughs", { vol: 0.6 });
  add(12.3, "frog-croak", "Bang Jaya laughs again", { vol: 0.5 });
  add(13.2, "bird-chirp", "Bang Jaya: remote kok difoto", { vol: 0.45 });
  add(16.3, "key-jingle", "Pak Darto presses power", { vol: 0.55 });
  add(16.9, "key-jingle", "Pak Darto presses power again", { vol: 0.5 });
  add(17.6, "bee-buzz", "he stares at the phone", { vol: 0.4 });
  add(19.2, "slurp", "the phone screen pops up, enlarged");
  add(19.7, "low-battery", "the screen stays dark", { vol: 0.4 });
  add(20.5, "frog-croak", "Bang Jaya gets louder", { vol: 0.5 });
  add(22.6, "key-jingle", "Bang Jaya jabs his finger", { vol: 0.4 });
  add(24.9, "key-jingle", "Bu Rina takes out her wallet", { vol: 0.6 });
  add(26.9, "zipper-pull", "Pak Darto slides the back cover", { vol: 0.5 });
  add(27.3, "glass-break", "the cover pops off", { vol: 0.3 });
  add(27.8, "glass-break", "the old batteries hit the floor", { vol: 0.6 });
  add(28.1, "rain-patter", "a battery rolls", { vol: 0.4 });
  add(28.45, "slurp", "two new batteries appear", { vol: 0.6 });
  add(28.9, "zipper-pull", "the batteries go in", { vol: 0.6 });
  add(30.4, "slurp", "the phone screen pops up again", { vol: 0.7 });
  add(29.9, "key-jingle", "he presses the button", { vol: 0.6 });
  add(31.1, "kettle-whistle", "the violet blink on the screen", { vol: 0.8 });
  add(31.76, "bird-chirp", "ungu", { vol: 0.6 });
  add(32.76, "train-whistle", "the TV comes on");
  add(33.1, "bird-chirp", "the picture appears", { vol: 0.7 });
  add(33.4, "cymbal-crash", "it works", { vol: 0.4 });
  add(34.9, "rain-patter", "the infrared rings start", { vol: 0.35 });
  add(35.4, "key-jingle", "he presses the button", { vol: 0.5 });
  add(36.3, "kettle-whistle", "pill: cahaya inframerah");
  [37.7, 38.2, 38.7].forEach((t) => add(t, "rain-patter", "Bu Rina walks over", { vol: 0.5 }));
  add(37.88, "bird-chirp", "pill: 940 nm", { vol: 0.8 });
  add(40.0, "thunder-rumble", "the eye sees nothing", { vol: 0.5 });
  add(41.3, "static-burst", "the camera sensor", { vol: 0.4 });
  add(41.5, "kettle-whistle", "the phone sees the light", { vol: 0.7 });
  add(41.62, "camera-shutter", "the phone photographs the remote", { vol: 0.6 });
  add(43.2, "low-battery", "the screen stays dark", { vol: 0.5 });
  add(43.6, "low-battery", "the remote is the problem", { vol: 0.6 });
  add(45.0, "meow", "Pak Darto shrugs", { vol: 0.4 });
  add(46.7, "bird-chirp", "the next morning", { vol: 0.5 });
  [46.9, 47.25].forEach((t) => add(t, "rain-patter", "Bang Jaya walks to his bench", { vol: 0.5 }));
  add(47.9, "zipper-pull", "Bang Jaya lifts the phone", { vol: 0.5 });
  add(48.2, "camera-shutter", "he photographs the remote", { vol: 0.7 });
  add(49.0, "key-jingle", "the thumb on a remote button", { vol: 0.55 });
  add(49.7, "key-jingle", "the thumb on a remote button", { vol: 0.55 });
  add(50.14, "train-whistle", "the cut back to the first frame (the loop)", { vol: 0.8 });
  return ev.sort((a, b) => a.t - b.t);
}
