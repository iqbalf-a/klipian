/* The sound of "Dimas begadang dan jajan tiap jam", written by hand against the shots: a swipe on every cut, a sound on each thing that
   changes on screen (the laptop keys, the stall bell, the phone, the foods, the clock, the chart, the bed). Names only from the locked set
   (src/catalog.ts); most are from the B48 catalog growth, so the choice differs from the last ten videos. */
import type { SfxEvent } from "../../src/sfx.ts";
import type { SfxName } from "../../src/catalog.ts";
import type { StoryT } from "../../src/schema.ts";
import { FPS } from "../../src/timeline.ts";

export const music = { track: "bed-lofi", level: 0.8 } as const;

export function sfx(_story: StoryT): SfxEvent[] {
  const ev: SfxEvent[] = [];
  const add = (t: number, name: SfxName, why: string, extra: Partial<SfxEvent> = {}) => ev.push({ t: Math.round(Math.max(0, t) * FPS) / FPS, name, vol: 0.6, why, ...extra });
  // the hook: Dimas at the laptop at night, snacking
  add(0.1, "typing", "Dimas types at the laptop", { vol: 0.5 });
  add(1.4, "cricket", "the night around the room", { vol: 0.35 });
  add(2.3, "crunch", "jajan: a bite", { vol: 0.55 });
  // dunia: the gang, then Mang Udin
  add(3.22, "swipe", "cut to the whole gang", { vol: 0.5 });
  add(4.52, "bubble-pop", "lapar mata", { vol: 0.4 });
  add(5.52, "swipe", "cut to Mang Udin", { vol: 0.5 });
  add(6.7, "bike-bell", "pesanan: the stall bell", { vol: 0.5 });
  // ragu: Rani and the app
  add(8.14, "swipe", "cut to Rani", { vol: 0.5 });
  add(9.68, "phone-buzz", "aplikasi: the phone buzzes", { vol: 0.5 });
  add(10.08, "notify-ding", "kalori: the app pings", { vol: 0.5 });
  add(10.84, "swipe", "cut to the phone", { vol: 0.5 });
  add(12.5, "toggle-on", "bukan lapar: the app switches the verdict", { vol: 0.45 });
  // petunjuk: Dimas, then the three foods
  add(13.94, "swipe", "cut to Dimas, hungry", { vol: 0.5 });
  add(15.0, "heartbeat", "the hunger pulses", { vol: 0.4 });
  add(16.16, "swipe", "the camera runs along the counter", { vol: 0.5 });
  add(16.78, "bubble-pop", "nasi pops up", { vol: 0.55 });
  add(17.44, "sizzle", "gorengan pops up", { vol: 0.5 });
  add(18.38, "glass-clink", "es teh pops up", { vol: 0.55 });
  add(18.74, "gulp", "manis: a gulp", { vol: 0.5 });
  // sains: the studio, the clock, the chart
  add(19.84, "swipe", "cut to the room: the study", { vol: 0.5 });
  add(19.9, "notify-ding", "the study card", { vol: 0.4 });
  add(21.68, "countdown-beep", "empat jam: the clock starts running", { vol: 0.4 });
  add(22.4, "tick-soft", "the clock runs", { vol: 0.3 });
  add(23.4, "swipe", "cut to the chart", { vol: 0.5 });
  add(23.66, "level-up", "the second bar grows", { vol: 0.55 });
  add(24.7, "sparkle", "ngidam manis dan karbo", { vol: 0.4 });
  // akhir: the bed and the empty stall
  add(25.8, "swipe", "cut to the bed", { vol: 0.5 });
  add(27.66, "fabric-flap", "tidur: the blanket", { vol: 0.5 });
  add(28.82, "swipe", "cut to the empty stall", { vol: 0.5 });
  add(29.58, "wind-gust", "sepi: a gust down the gang", { vol: 0.45 });
  // outro: the loop-back to the first shot
  add(30.3, "swish-soft", "the camera flies back to the first shot", { vol: 0.5 });
  add(30.4, "jingle-outro", "loop-back jingle", { vol: 0.8 });
  return ev;
}
