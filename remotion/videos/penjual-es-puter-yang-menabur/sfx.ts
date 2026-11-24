/* The sound effects of penjual-es-puter-yang-menabur: written by hand against index.tsx (SHOTS, pills, the salt tosses, the crank, the melt, the frost, the thermometer). */
// Imported from the plain .ts modules, never from src/design/index.ts: render.mjs loads this file in Node.
import type { SfxEvent } from "../../src/sfx.ts";
import type { StoryT } from "../../src/schema.ts";

const FPS = 30;
const q = (t: number) => Math.round(t * FPS) / FPS;

export const music = { track: "bed-picnic", level: 0.8 } as const;

// the cuts of SHOTS in index.tsx (the first shot starts at 0)
const CUTS = [3.36, 5.16, 6.9, 8.66, 12.68, 13.92, 15.94, 19.98, 21.74, 24.94, 26.42, 28.36, 29.78, 32.66, 35.72, 36.84, 38.94, 43.18, 45.62, 47.36];
const CUT_SOUNDS = ["whoosh", "swish", "whoosh-soft", "swoop", "zoom-whoosh", "swish-soft", "swish-down"] as const;

export function sfx(_story: StoryT): SfxEvent[] {
  const ev: SfxEvent[] = [];
  const add = (t: number, name: SfxEvent["name"], why: string, extra: Partial<SfxEvent> = {}) => ev.push({ t: q(t), name, vol: 1, why, ...extra });

  CUTS.forEach((t, i) => add(t, CUT_SOUNDS[i % CUT_SOUNDS.length], "cut to the next shot", { vol: 0.7 }));

  add(0.1, "pop", "the hook text lands");
  add(1.36, "pop-wood", "pill: 3 genggam garam");
  [1.55, 2.05, 2.55].forEach((t) => add(t, "rattle", "a handful of salt goes onto the ice", { vol: 0.55 }));
  [3.7, 4.2, 4.7].forEach((t) => add(t, "footstep", "Tono walks up to the cart", { vol: 0.55 }));
  add(3.6, "engine-rev", "a scooter passes behind", { vol: 0.35 });
  add(5.2, "huh", "Tono: es kok digaramin", { vol: 0.7 });
  add(12.75, "boing", "Tono laughs", { vol: 0.6 });
  add(13.1, "tock", "Tono laughs", { vol: 0.5 });
  add(14.0, "blip-alert", "Tono is sure: garam bikin es meleleh", { vol: 0.5 });
  [20.1, 20.7, 21.3].forEach((t) => add(t, "tick-soft", "the crank turns", { vol: 0.45 }));
  add(20.84, "tick", "pill: 30 menit");
  [21.9, 22.5, 23.1, 23.7, 24.3].forEach((t) => add(t, "click-soft", "the crank turns", { vol: 0.4 }));
  add(23.2, "squeak", "Tono's arm aches", { vol: 0.5 });
  add(24.2, "engine-rev", "a scooter passes behind", { vol: 0.35 });
  add(25.0, "hum", "the midday heat", { vol: 0.5 });
  [26.7, 27.25, 27.8, 28.4].forEach((t) => add(t, "drip", "the ice melts into water", { vol: 0.6 }));
  add(27.0, "water-pour", "meltwater runs down", { vol: 0.5 });
  add(28.6, "level-up", "Tono thinks he is winning", { vol: 0.5 });
  add(29.9, "puff", "the drum starts to smoke with cold", { vol: 0.7 });
  add(31.5, "glass-ting", "frost spreads over the drum", { vol: 0.6 });
  add(32.8, "wood-crack", "the batter cracks as it hardens", { vol: 0.7 });
  add(33.2, "click-crack", "the batter cracks as it hardens", { vol: 0.6 });
  add(33.6, "metal-clang", "the lid comes off", { vol: 0.6 });
  add(34.9, "pop-soft", "a scoop of es puter appears");
  add(35.0, "chime-bright", "it is real es puter", { vol: 0.7 });
  add(35.85, "slide-whistle-down", "Tono's jaw drops", { vol: 0.7 });
  add(36.95, "plop", "the thermometer pops in");
  add(38.5, "power-down", "the red column falls", { vol: 0.5 });
  add(41.62, "key-blip", "pill: minus 20 derajat");
  add(43.4, "bubble-rise", "the melting ice takes heat from the batter", { vol: 0.6 });
  add(44.3, "sizzle", "heat flows into the ice", { vol: 0.5 });
  add(45.75, "stamp", "the batter turns solid", { vol: 0.6 });
  add(46.4, "sparkle", "frozen", { vol: 0.7 });
  add(47.9, "cloth-rustle", "Tono asks for the salt", { vol: 0.5 });
  [48.0, 48.5].forEach((t) => add(t, "footstep", "Tono steps to the cart", { vol: 0.5 }));
  add(49.64, "bell-soft", "pill: 3 genggam garam");
  [49.7, 50.02, 50.34].forEach((t) => add(t, "rattle", "Tono sprinkles salt like Pak Darto", { vol: 0.55 }));
  add(50.6, "slide-whistle-up", "the cut back to the first frame (the loop)", { vol: 0.8 });
  return ev.sort((a, b) => a.t - b.t);
}
