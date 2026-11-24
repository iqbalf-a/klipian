/* The sound of "Petugas SPBU yang Melarang Pelanggan Menekan Nozzle Lagi", written by hand against the shots:
   whoosh on cuts, sounds for SPBU pump clicks, gas spray, car engine, venturi vacuum, diaphragm click, floor wipe.
   Names only from the locked set (src/catalog.ts); choices differ from the last ten videos. */
import type { SfxEvent } from "../../src/sfx.ts";
import type { SfxName } from "../../src/catalog.ts";
import type { StoryT } from "../../src/schema.ts";
import { FPS } from "../../src/timeline.ts";

export const music = { track: "bed-sparkle", level: 0.8 } as const;

export function sfx(_story: StoryT): SfxEvent[] {
  const ev: SfxEvent[] = [];
  const add = (t: number, name: SfxName, why: string, extra: Partial<SfxEvent> = {}) =>
    ev.push({ t: Math.round(Math.max(0, t) * FPS) / FPS, name, vol: 0.6, why, ...extra });

  // Hook (0 - 2.52s): Pak Rudi holds nozzle, hook text
  add(0.1, "metal-clang", "nozzle picked up", { vol: 0.5 });
  add(1.0, "swish", "Pak Rudi gesture", { vol: 0.4 });
  add(1.88, "click-soft", "nozzle trigger click", { vol: 0.6 });

  // Dunia (2.52 - 9.94s): klik, berhenti sendiri, angkat tangan, Hendra mikir lebay
  add(2.52, "whoosh", "cut to world wide shot", { vol: 0.5 });
  add(3.24, "car-horn", "SPBU ambiance", { vol: 0.3 });
  add(3.58, "click-crack", "nozzle shuts off (klik!)", { vol: 0.7 });
  add(5.1, "cloth-rustle", "Pak Rudi raises hand", { vol: 0.5 });
  add(6.42, "whoosh-soft", "camera pans to Hendra", { vol: 0.4 });
  add(7.4, "huh", "Hendra looks skeptical", { vol: 0.5 });
  add(8.8, "toggle-on", "Hendra thinks it is lebay", { vol: 0.4 });

  // Ragu (9.94 - 15.86s): Pelanggan komplain, Hendra bilang santai, tekan lagi
  add(9.94, "whoosh", "cut to customer and Hendra", { vol: 0.5 });
  add(10.6, "engine-rev", "scooter engine idling", { vol: 0.35 });
  add(11.8, "swish-soft", "Hendra talks to customer", { vol: 0.4 });
  add(12.8, "finger-snap", "tekan lagi sedikit", { vol: 0.5 });
  add(14.64, "whoosh-soft", "pan to Pak Rudi shaking head", { vol: 0.45 });
  add(14.98, "bonk", "Pak Rudi shakes head firmly", { vol: 0.45 });

  // Petunjuk (15.86 - 23.12s): Nozzle berhenti, lubang kecil, pegas mengunci
  add(15.86, "whoosh", "cut to nozzle close-up", { vol: 0.5 });
  add(16.5, "stream-trickle", "fuel stops flowing", { vol: 0.5 });
  add(18.4, "blip-alert", "camera reveals tiny hole at nozzle tip", { vol: 0.55 });
  add(19.32, "bubble-pop", "hole submerged in fuel", { vol: 0.6 });
  add(21.12, "switch", "internal spring lock mechanism", { vol: 0.65 });
  add(22.34, "can-tap", "trigger latch locks tight", { vol: 0.5 });

  // Puncak (23.12 - 31.06s): Hendra tekan lagi, bensin menyembur, lantai basah, Pak Rudi ambil lap
  add(23.12, "whoosh", "cut to Hendra at pump", { vol: 0.5 });
  add(24.24, "click-crack", "Hendra forces the trigger", { vol: 0.7 });
  add(25.18, "water-splash", "gasoline spills out!", { vol: 0.75 });
  add(25.72, "wave-wash", "fuel rushes over car and floor", { vol: 0.6 });
  add(26.8, "water-pour", "fuel pooling on ground", { vol: 0.55 });
  add(27.64, "squeak", "customer panics", { vol: 0.6 });
  add(28.22, "whoosh-soft", "cut to Pak Rudi ready with cloth", { vol: 0.5 });
  add(29.26, "cloth-rustle", "Pak Rudi grabs rag instantly", { vol: 0.6 });
  add(30.14, "footstep", "Pak Rudi steps in to manage spill", { vol: 0.45 });

  // Sains (31.06 - 46.56s): Efek Venturi diagram, vakum, lubang tertutup, diafragma, bunyi klik
  add(31.06, "zoom-whoosh", "cut into nozzle cutaway diagram", { vol: 0.6 });
  add(32.48, "glass-ting", "Venturi diagram title pops", { vol: 0.5 });
  add(33.76, "wind-gust", "fast fuel flow creates low pressure", { vol: 0.5 });
  add(35.36, "bubble-rise", "vacuum formed in small channel", { vol: 0.55 });
  add(36.74, "stream-trickle", "air drawn through sensing port", { vol: 0.5 });
  add(38.0, "notify-ding", "air sensing port indicator", { vol: 0.5 });
  add(39.48, "bubble-pop", "rising fuel blocks the sensing hole", { vol: 0.6 });
  add(40.46, "thump", "sudden air blockage", { vol: 0.5 });
  add(41.6, "power-up", "vacuum pressure spikes dramatically", { vol: 0.6 });
  add(42.54, "velcro-rip", "diaphragm snaps upward", { vol: 0.65 });
  add(43.92, "metal-clang", "main valve snaps shut", { vol: 0.7 });
  add(45.4, "chime-bright", "klik! auto shutoff successful", { vol: 0.75 });

  // Akhir (46.56 - 48.78s): Hendra mengelap lantai, Pak Rudi mengangguk
  add(46.56, "whoosh", "cut to Hendra cleaning floor", { vol: 0.5 });
  add(47.18, "cloth-rustle", "Hendra mops up the floor", { vol: 0.55 });
  add(48.18, "tock", "Pak Rudi gives approving nod", { vol: 0.45 });

  // Outro (48.78 - 49.48s): Loop back to hook scene
  add(48.8, "swish-soft", "camera flies back to hook framing", { vol: 0.5 });
  add(49.1, "sparkle", "loop holds", { vol: 0.6 });

  return ev;
}
