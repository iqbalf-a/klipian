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
  add(2.46, "crunch", "jajan: a bite", { vol: 0.55 });
  // dunia: the laptop, the gang, Mang Udin and his menu
  add(3.4, "swipe", "cut to the laptop", { vol: 0.5 });
  add(4.7, "typing", "laptop nyala", { vol: 0.4 });
  add(6.6, "swipe", "cut to the whole gang", { vol: 0.5 });
  add(8.32, "bubble-pop", "lapar mata", { vol: 0.4 });
  add(9.0, "swipe", "cut to Mang Udin", { vol: 0.5 });
  add(10.6, "bike-bell", "pesanan: the stall bell", { vol: 0.5 });
  add(11.8, "swipe", "the camera runs along the counter", { vol: 0.5 });
  add(12.04, "sizzle", "mi instan", { vol: 0.45 });
  add(13.7, "glass-clink", "es teh", { vol: 0.5 });
  // ragu: Rani and the app, Dimas holds back
  add(14.5, "swipe", "cut to Rani", { vol: 0.5 });
  add(15.9, "phone-buzz", "aplikasi: the phone buzzes", { vol: 0.5 });
  add(16.2, "notify-ding", "kalori: the app pings", { vol: 0.5 });
  add(16.8, "swipe", "cut to the phone", { vol: 0.5 });
  add(18.9, "toggle-on", "bukan lapar: the app switches the verdict", { vol: 0.45 });
  add(19.9, "swipe", "cut to Dimas, holding back", { vol: 0.5 });
  add(21.6, "swipe", "cut to the clock", { vol: 0.45 });
  add(22.1, "tick-soft", "satu jam: the clock jumps", { vol: 0.35 });
  add(22.8, "tick-soft", "dua jam: the clock jumps", { vol: 0.35 });
  // petunjuk: Dimas hungry, the three foods, not the greens
  add(23.5, "swipe", "cut to Dimas, hungry", { vol: 0.5 });
  add(24.7, "heartbeat", "the hunger pulses", { vol: 0.4 });
  add(25.6, "swipe", "the camera runs along the counter", { vol: 0.5 });
  add(25.84, "bubble-pop", "nasi pops up", { vol: 0.55 });
  add(27.1, "sizzle", "gorengan pops up", { vol: 0.5 });
  add(28.04, "glass-clink", "es teh pops up", { vol: 0.55 });
  add(28.6, "swipe", "cut to Dimas, refusing the greens", { vol: 0.5 });
  add(28.74, "toggle-on", "bukan sayur: the pill", { vol: 0.35 });
  add(30.8, "swipe", "cut to the belly", { vol: 0.5 });
  add(31.5, "heartbeat", "perutnya minta", { vol: 0.4 });
  // studi: the gang, the study card, the clock, the first sentence of the result
  add(33.6, "swipe", "cut to the whole gang", { vol: 0.5 });
  add(35.4, "swipe", "cut to the chart", { vol: 0.5 });
  add(35.56, "notify-ding", "the study card", { vol: 0.4 });
  add(38.4, "swipe", "cut to the clock", { vol: 0.5 });
  add(38.54, "notify-ding", "the 4 hours pill", { vol: 0.4 });
  add(39.6, "countdown-beep", "empat jam: the clock starts running", { vol: 0.4 });
  add(40.2, "tick-soft", "the clock runs", { vol: 0.3 });
  // sains: the bar grows, the cravings, Rani doubts
  add(41.4, "swipe", "cut to the chart", { vol: 0.5 });
  add(43.2, "level-up", "the second bar grows", { vol: 0.55 });
  add(44.0, "swipe", "cut to Dimas, craving", { vol: 0.5 });
  add(44.9, "sparkle", "manis, asin, berkarbo", { vol: 0.4 });
  add(47.0, "swipe", "cut to Rani", { vol: 0.5 });
  add(47.92, "toggle-on", "baru satu studi: the pill", { vol: 0.4 });
  // akhir: the bed and the empty stall
  add(50.6, "swipe", "cut to the bed", { vol: 0.5 });
  add(52.2, "fabric-flap", "tidur: the blanket", { vol: 0.5 });
  add(52.7, "swipe", "cut to the empty stall", { vol: 0.5 });
  add(54.0, "wind-gust", "sepi: a gust down the gang", { vol: 0.45 });
  // outro: the loop-back to the first shot
  add(55.2, "swish-soft", "the camera flies back to the first shot", { vol: 0.5 });
  add(56.4, "jingle-outro", "loop-back jingle", { vol: 0.8 });
  return ev;
}
