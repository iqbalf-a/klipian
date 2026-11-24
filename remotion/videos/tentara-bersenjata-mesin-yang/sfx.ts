/* The sound effects of tentara-bersenjata-mesin-yang: written by hand against index.tsx (SHOTS, pills, gun, hit, medal, lookout, fence). */
// Imported from the plain .ts modules, never from src/design/index.ts: render.mjs loads this file in Node.
import type { SfxEvent } from "../../src/sfx.ts";
import type { StoryT } from "../../src/schema.ts";

const FPS = 30;
const q = (t: number) => Math.round(t * FPS) / FPS;

export const music = { track: "bed-bounce", level: 0.8 } as const;

// the cuts of SHOTS in index.tsx (the first shot starts at 0)
const CUTS = [4.4, 6.9, 9.2, 11.1, 13.42, 17.54, 19.38, 21.78, 25.68, 28.74, 31.34, 34.38, 38.04, 40.12, 41.5, 43.52, 45.3, 47.5, 49.0, 51.16, 53.2, 55.52, 57.3];
const CUT_SOUNDS = ["whoosh", "swish", "whoosh-soft", "swoop"] as const;

export function sfx(_story: StoryT): SfxEvent[] {
  const ev: SfxEvent[] = [];
  const add = (t: number, name: SfxEvent["name"], why: string, extra: Partial<SfxEvent> = {}) => ev.push({ t: q(t), name, vol: 1, why, ...extra });

  CUTS.forEach((t, i) => add(t, CUT_SOUNDS[i % CUT_SOUNDS.length], "cut to the next shot", { vol: 0.7 }));

  add(0.1, "pop", "the hook text lands");
  add(8.52, "pop", "pill: setinggi 1,5 m");
  add(12.02, "pop", "pill: 2 senapan mesin");
  add(24.18, "pop", "pill: emu 50 km/jam");
  add(44.38, "pop", "pill: dikabarkan");

  // the guns: one crack every 0.16 s inside each burst (the bursts of BURSTS in index.tsx), the first one shakes the camera
  const BURSTS: [number, number][] = [[14.05, 14.7], [15.1, 15.7], [16.3, 16.9], [22.2, 23.0], [23.6, 24.4], [26.5, 27.2], [49.6, 50.8]];
  BURSTS.forEach(([a, b]) => { for (let u = a; u < b - 0.01; u += 0.16) add(u, "click-crack", "gun burst", { vol: u === a ? 1.2 : 0.7 }); });
  add(14.05, "thump", "the first shot shakes the camera", { vol: 0.8 });
  add(20.4, "metal-clang", "the gun jams", { vol: 0.9 });
  add(20.9, "error-buzz", "the gun jams", { vol: 0.6 });

  add(21.78, "engine-rev", "the truck sets off after the emus", { vol: 1.2 });
  add(26.9, "thump", "a bullet hits the emu", { vol: 0.9 });
  add(27.08, "bonk", "and bounces off the thick skin");
  add(29.0, "footstep", "the hit emu runs on", { vol: 0.8 });

  add(33.2, "paper-crumple", "the newspaper reaches parliament", { vol: 0.7 });
  add(34.7, "coin", "the medal drops for the emu");
  add(35.1, "sparkle", "the medal lands", { vol: 0.7 });

  add(41.5, "engine-rev", "the soldiers are sent back", { vol: 1.0 });
  add(45.3, "blip-alert", "the lookout emu raises its head");
  add(47.5, "huh", "the lookout warns the others");
  add(49.2, "wind-gust", "the whole flock bolts", { vol: 0.8 });

  add(51.3, "cloth-rustle", "the soldiers pack up");
  add(53.5, "success-fanfare", "the emu is named the winner", { vol: 0.7 });
  add(55.6, "wood-crack", "the fence goes up", { vol: 0.7 });
  [56.0, 56.3, 56.6].forEach((t) => add(t, "pop-wood", "a fence post goes in", { vol: 0.7 }));
  add(58.46, "slide-whistle-up", "the cut back to the first frame (the loop)", { vol: 0.8 });
  return ev.sort((a, b) => a.t - b.t);
}
