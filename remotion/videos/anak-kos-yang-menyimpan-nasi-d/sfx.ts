/* The sound effects of anak-kos-yang-menyimpan-nasi-d: written by hand against index.tsx (SHOTS, the raps on the lid, Bu Wulan's walk, the lid, the magnifier, the plates, the friends' run, the doors that
   burst open, the spore story, the plug, the pot). B60: every name is one that none of the 10 most recent videos uses (the 2026-11-25 pool, read from their sfx.ts); no name on more than a quarter of the events;
   a camera cut gets a free name too, never the whoosh or swish family. */
// Imported from the plain .ts modules, never from src/design/index.ts: render.mjs loads this file in Node.
import type { SfxEvent } from "../../src/sfx.ts";
import type { StoryT } from "../../src/schema.ts";

const FPS = 30;
const q = (t: number) => Math.round(t * FPS) / FPS;

export const music = { track: "bed-island", level: 0.8 } as const;

// the cuts of SHOTS in index.tsx (the first shot starts at 0)
const CUTS = [3.8, 7.14, 10.22, 12.38, 15.14, 18.18, 21.98, 25.34, 29.06, 33.16, 35.56, 37.72, 39.62, 42.22, 44.34, 47.0, 48.16, 51.18];
const CUT_SOUNDS = ["claves", "castanets", "ratchet", "rubber-band-twang", "velcro-rip", "marker-squeak", "can-tap", "spray-can", "tambourine"] as const;

export function sfx(_story: StoryT): SfxEvent[] {
  const ev: SfxEvent[] = [];
  const add = (t: number, name: SfxEvent["name"], why: string, extra: Partial<SfxEvent> = {}) => ev.push({ t: q(t), name, vol: 1, why, ...extra });

  CUTS.forEach((t, i) => add(t, CUT_SOUNDS[i % CUT_SOUNDS.length], "cut to the next shot", { vol: 0.55 }));

  add(0.1, "cowbell", "the hook text lands", { vol: 0.5 });
  add(1.76, "mug-clink", "Fajar pats the lid of the dead rice cooker", { vol: 0.5 });
  add(5.9, "pickup-8bit", "Bu Wulan points two fingers at her own sharp eyes", { vol: 0.4 });
  [8.7, 9.2, 9.7].forEach((t) => add(t, "bongo-lo", "Bu Wulan strides to the kitchen", { vol: 0.35 }));
  add(9.2, "xylophone-c", "pill: 10 kamar", { vol: 0.7 });
  [10.78, 11.1, 11.42].forEach((t) => add(t, "pan-clang", "Bu Wulan raps the lid", { vol: 0.45 }));
  add(12.4, "steel-drum", "Bu Wulan: Nasi semalam itu bahaya", { vol: 0.5 });
  add(15.98, "hiccup", "Fajar grins and hops", { vol: 0.5 });
  add(18.3, "gate-squeak", "the lid swings up", { vol: 0.5 });
  add(18.8, "kalimba-a", "the magnifier pops up on the white rice", { vol: 0.6 });
  add(19.5, "bath-bubbles", "the smell of the rice rises", { vol: 0.3 });
  add(21.1, "can-tap", "the lid comes down", { vol: 0.5 });
  add(22.2, "slurp", "Fajar eats the first plate", { vol: 0.5 });
  add(22.7, "cutlery-clatter", "pill: 3 piring, the first plate on the stack", { vol: 0.6 });
  add(23.0, "slurp", "Fajar eats", { vol: 0.5 });
  add(23.3, "marimba-low", "the second plate", { vol: 0.5 });
  add(23.9, "vibraphone", "the third plate", { vol: 0.5 });
  [24.0, 24.4, 24.8].forEach((t) => add(t, "woodblock-hi", "the friends walk in to line up", { vol: 0.35 }));
  add(24.1, "slurp", "Fajar eats", { vol: 0.5 });
  add(25.4, "water-drip-echo", "Bu Wulan lays her palm on the cooker", { vol: 0.4 });
  add(25.9, "pizzicato", "the magnifier shows her palm and the warm lines", { vol: 0.5 });
  add(29.1, "school-bell", "beberapa jam kemudian", { vol: 0.4 });
  add(30.94, "thunder-rumble", "Fajar's belly begins to growl", { vol: 0.35 });
  [32.38, 32.62].forEach((t) => add(t, "snare-hit", "the belly drums", { vol: 0.5 }));
  [33.6, 34.0, 34.4, 34.8, 35.2].forEach((t) => add(t, "stomp", "the friends run down the corridor", { vol: 0.3 }));
  add(34.2, "door-slam", "door one bangs open", { vol: 0.5 });
  add(34.6, "gate-squeak", "door three swings open", { vol: 0.4 });
  add(35.56, "coin-8bit", "pill: 10 kamar, 1 WC", { vol: 0.6 });
  add(35.9, "cymbal-crash", "all ten doors burst open at once", { vol: 0.7 });
  add(35.95, "balloon-pop", "the sandals shoot out", { vol: 0.5 });
  add(36.15, "maracas", "the sandals rain down", { vol: 0.5 });
  [38.3, 39.1].forEach((t) => add(t, "jump-8bit", "someone in the line hops from foot to foot", { vol: 0.3 }));
  add(39.7, "gong-soft", "Biangnya: the spore", { vol: 0.6 });
  add(39.8, "robot-chirp", "the magnifier shows the spore", { vol: 0.45 });
  add(40.92, "modem-chirp", "pill: Bacillus cereus", { vol: 0.4 });
  add(42.5, "kettle-whistle", "the flames sweep over the spores", { vol: 0.3 });
  add(43.2, "gong-wobble", "the spore shrugs the heat off", { vol: 0.45 });
  add(44.6, "snore", "the spore sleeps in the lukewarm rice", { vol: 0.3 });
  add(45.4, "rubber-band-twang", "the shell cracks", { vol: 0.5 });
  add(46.2, "frog-croak", "the bacterium crawls out", { vol: 0.4 });
  [47.2, 47.55, 47.9].forEach((t) => add(t, "bee-buzz", "the rods split: two, four, eight", { vol: 0.3 }));
  [48.6, 49.0].forEach((t) => add(t, "water-drip-echo", "toxin drops fall", { vol: 0.4 }));
  add(49.1, "marker-squeak", "Bu Wulan picks up the plug", { vol: 0.4 });
  add(49.9, "power-up", "the plug goes into the socket", { vol: 0.6 });
  add(50.0, "pan-sizzle", "the cooker heats again, the toxin does not care", { vol: 0.4 });
  [51.5, 51.9, 52.3].forEach((t) => add(t, "kick-soft", "Fajar walks over with the pot", { vol: 0.35 }));
  add(54.3, "tambourine", "Fajar holds out the pot", { vol: 0.5 });
  add(54.74, "music-box", "the cut back to the first frame (the loop)", { vol: 0.6 });
  return ev.sort((a, b) => a.t - b.t);
}
