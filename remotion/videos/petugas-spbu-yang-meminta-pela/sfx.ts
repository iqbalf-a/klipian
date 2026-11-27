/* The sound of "Petugas SPBU yang meminta pelanggan menyentuh logam dulu", written by hand against the shots: a different small knock on every cut (no whoosh family),
   a sound on each thing that changes on screen (the nozzle, the van door, the horns, the seat, the jacket, the spark). B71: silence 26.7 to 27.25 before the turn,
   the strongest hit right after it (the swoop to the collar), then the spark itself. Names only from the locked set (src/catalog.ts). */
import type { SfxEvent } from "../../src/sfx.ts";
import type { SfxName } from "../../src/catalog.ts";
import type { StoryT } from "../../src/schema.ts";
import { FPS } from "../../src/timeline.ts";

export const music = { track: "bed-glow", level: 0.8 } as const;

export function sfx(_story: StoryT): SfxEvent[] {
  const ev: SfxEvent[] = [];
  const add = (t: number, name: SfxName, why: string, extra: Partial<SfxEvent> = {}) => ev.push({ t: Math.round(Math.max(0, t) * FPS) / FPS, name, vol: 0.5, why, ...extra });
  // hook: the face-off, the nozzle held back
  add(0.1, "can-tap", "the nozzle waits on the pump", { vol: 0.45 });
  add(1.6, "steam-hiss", "the hose breathes", { vol: 0.3 });
  add(3.3, "zip", "swoop to the door handle", { vol: 0.55 });
  add(4.4, "claves", "besi pintunya: a tap on the steel", { vol: 0.5 });
  // dunia
  add(5.08, "woodblock-hi", "cut to Bang Toni", { vol: 0.45 });
  add(6.2, "stomp", "the van idles", { vol: 0.3 });
  add(7.4, "kalimba-a", "cut to the phone", { vol: 0.45 });
  add(7.56, "countdown-beep", "dua puluh menit", { vol: 0.4 });
  add(9.6, "mug-clink", "cut to the long queue", { vol: 0.45 });
  add(10.4, "bee-buzz", "the queue hums", { vol: 0.25, dur: 0.8 });
  // ragu
  add(11.22, "vibraphone", "cut to Bu Yati", { vol: 0.45 });
  add(12.3, "can-tap", "Pegang besi dulu", { vol: 0.5 });
  add(14.3, "velcro-rip", "push in on the sneer", { vol: 0.4 });
  add(15.52, "rubber-band-twang", "bukan ritual", { vol: 0.45 });
  add(17.5, "marimba-low", "cut to the low angle, Bu Yati says nothing", { vol: 0.4 });
  // naik
  add(19.12, "car-horn", "the first horn", { vol: 0.55 });
  add(19.5, "car-horn", "second horn", { vol: 0.5 });
  add(19.9, "car-horn", "third horn", { vol: 0.5 });
  add(20.3, "car-horn", "fourth horn", { vol: 0.45 });
  add(20.46, "tambourine", "cut to the cab", { vol: 0.4 });
  add(21.2, "slurp", "he slides on the seat", { vol: 0.35 });
  add(22.9, "pan-clang", "he jumps down", { vol: 0.45 });
  add(23.4, "stream-trickle", "the nozzle drips", { vol: 0.3 });
  add(24.3, "chime", "the jacket crackles", { vol: 0.45 });
  add(24.9, "ratchet", "static crackle", { vol: 0.4 });
  add(25.66, "cowbell", "Salaman sama tiang dulu", { vol: 0.4 });
  // 26.7 to 27.25: silence before the turn
  add(27.25, "gong-soft", "swoop to the collar: the strongest hit", { vol: 1.0 });
  add(28.3, "zip", "Ctak: the spark", { vol: 0.9 });
  add(28.5, "balloon-pop", "he recoils", { vol: 0.45 });
  add(30.0, "xylophone-c", "cut to the shaking hand", { vol: 0.4 });
  add(31.9, "jump-8bit", "he leaps back", { vol: 0.5 });
  add(33.3, "steam-hiss", "Bu Yati sighs", { vol: 0.35 });
  // sains
  add(35.58, "pickup-8bit", "the seat slide again", { vol: 0.45 });
  add(36.2, "ratchet", "charge builds", { vol: 0.3 });
  add(37.4, "robot-chirp", "the dots pile up", { vol: 0.35 });
  add(38.0, "power-up", "crane up: ribuan volt", { vol: 0.5 });
  add(39.6, "switch", "palm on the door", { vol: 0.5 });
  add(40.6, "water-drip-echo", "the charge drains away", { vol: 0.35 });
  add(42.1, "claves", "push in on the metal", { vol: 0.45 });
  add(43.2, "stream-trickle", "vapour creeps along the ground", { vol: 0.3 });
  add(44.6, "kalimba-e", "the calm forecourt", { vol: 0.45 });
  // akhir
  add(47.12, "chime-bright", "the next morning", { vol: 0.45 });
  add(47.9, "stomp", "he climbs down", { vol: 0.3 });
  add(48.62, "can-tap", "Bang Toni pats the door", { vol: 0.6 });
  add(48.82, "can-tap", "second pat", { vol: 0.5 });
  add(49.3, "woodblock-hi", "cut to the whole queue", { vol: 0.4 });
  add(49.45, "mug-clink", "driver one pats", { vol: 0.5 });
  add(49.7, "pan-clang", "driver two pats", { vol: 0.4 });
  add(49.95, "claves", "driver three pats", { vol: 0.5 });
  add(50.2, "cowbell", "driver four pats", { vol: 0.4 });
  add(50.86, "vibraphone", "nozzle up: the loop", { vol: 0.4 });
  return ev;
}
