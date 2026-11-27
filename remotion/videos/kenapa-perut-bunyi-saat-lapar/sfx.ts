/* The sound of "Kenapa perut bunyi saat lapar?" (100 s), written by hand against the scenes: a sound on the frame of every headline, zoom, lens, label, bar, pill, card, the food
   that lands and leaves, the squeeze of the walls (log drums), bubbles (plips) and the growl (deep rumble). Names only from the locked catalog (src/catalog.ts).
   B60: none of these names is in the 10 most recent videos (the 2026-11-28 pool: bricks, log drums, plips, tones, plus typing, crunch, cricket and fabric-flap), no name on more than a
   quarter of the events, and the channel jingles are the only fixed names.
   B71 a: no event in the 0.5 s before the turn (the "jam" beat starts at 56.0) and the first sound after it is the strongest of the video. */
import type { SfxEvent } from "../../src/sfx.ts";
import type { SfxName } from "../../src/catalog.ts";
import type { StoryT } from "../../src/schema.ts";
import { FPS } from "../../src/timeline.ts";
import { BARS, CARDS, FOOD, LABELS, TRACK, TREMOR, makePlan } from "./plan.ts";

export const music = { track: "bed-lofi", level: 0.8 } as const;

export function sfx(story: StoryT): SfxEvent[] {
  const P = makePlan(story), m = P.m, ev: SfxEvent[] = [];
  const add = (t: number, name: SfxName, why: string, extra: Partial<SfxEvent> = {}) => ev.push({ t: Math.round(Math.max(0, t) * FPS) / FPS, name, vol: 1, why, ...extra });
  const S = P.starts;

  // hook: the claim lands on frame 0, the belly growls under it
  add(0.05, "typing", "the claim lands on frame 0", { vol: 0.5 });
  add(0.7, "log-drum-lo", "the belly growls", { vol: 0.6 });
  add(1.9, "deep-rumble", "the growl rolls on", { vol: 0.45 });
  add(m.sting, "jingle-sting", "Intip yuk!", { vol: 0.7 });
  // masuk: the lens opens and we dive in
  add(S[2] + 0.05, "typing", "headline of masuk", { vol: 0.4 });
  add(4.4, "sweep-pop", "the lens opens on the belly", { vol: 0.6 });
  add(5.5, "ding-long", "the lens settles and shows the gut", { vol: 0.35 });
  add(6.3, "fabric-flap", "the camera starts to zoom in", { vol: 0.7 });
  add(8.0, "stick-creak", "the lens grows", { vol: 0.4 });
  add(10.2, "fabric-flap", "the zoom speeds up", { vol: 0.7 });
  add(12.4, "plip-hi", "the stomach wall comes close", { vol: 0.5 });
  add(13.8, "deep-rumble", "inside the stomach", { vol: 0.5 });
  // lambung: food muffles the sound
  add(S[3] + 0.05, "typing", "headline of lambung", { vol: 0.4 });
  add(FOOD.a, "crunch", "the food lands in the stomach", { vol: 0.5 });
  add(17.0, "log-drum-mid", "the walls squeeze", { vol: 0.45 });
  add(LABELS.gas, "typing", "the gas label pops in", { vol: 0.4 });
  add(LABELS.fluid, "typing", "the fluid label pops in", { vol: 0.4 });
  add(19.0, "brick-click", "the food shifts", { vol: 0.3 });
  add(19.4, "plip-hi", "a gas bubble rises", { vol: 0.45 });
  add(20.7, "plip-mid", "a gas bubble rises", { vol: 0.45 });
  add(21.0, "log-drum-mid", "the walls squeeze", { vol: 0.45 });
  add(22.2, "plip-lo", "a gas bubble rises", { vol: 0.45 });
  add(23.0, "brick-click", "the food shifts", { vol: 0.3 });
  add(23.6, "plip-hi", "a gas bubble rises", { vol: 0.45 });
  add(25.0, "log-drum-mid", "the walls squeeze", { vol: 0.45 });
  add(26.0, "cricket", "muffled: the food keeps the sound in", { vol: 0.5 });
  add(27.0, "fabric-flap", "the camera eases toward the exit", { vol: 0.5 });
  // kosong: nothing muffles it
  add(S[4] + 0.05, "typing", "headline of kosong", { vol: 0.4 });
  add(FOOD.out0, "crunch", "the food leaves the stomach", { vol: 0.5 });
  add(29.6, "log-drum-lo", "the first loud growl", { vol: 0.8 });
  add(30.2, "brick-tumble", "the food tumbles into the exit", { vol: 0.35 });
  add(BARS.a1, "typing", "the first bar (with food) grows", { vol: 0.4 });
  add(31.4, "cricket", "the hush: nothing muffles the sound now", { vol: 0.5 });
  add(BARS.a2, "brick-clack", "the second bar (empty) grows long", { vol: 0.5 });
  add(33.4, "deep-rumble", "the empty stomach growls", { vol: 0.6 });
  add(34.4, "purr-hum", "the growl rings on", { vol: 0.4 });
  add(35.6, "log-drum-lo", "a louder growl", { vol: 0.85 });
  add(37.2, "deep-rumble", "the growl rolls through", { vol: 0.6 });
  add(38.6, "shaker-tick", "the bars fade", { vol: 0.3 });
  add(39.4, "fabric-flap", "the camera pushes toward the exit", { vol: 0.7 });
  add(41.3, "sweep-pop", "through the exit", { vol: 0.6 });
  // usus: the tunnel
  add(S[5] + 0.45, "typing", "headline of usus", { vol: 0.4 });
  add(42.9, "purr-hum", "the tunnel hums", { vol: 0.45 });
  add(43.6, "plip-lo", "a drop flows past", { vol: 0.45 });
  add(44.8, "brick-click", "the length card pops in", { vol: 0.4 });
  add(45.1, "plip-mid", "a drop flows past", { vol: 0.45 });
  add(47.0, "log-drum-hi", "a squeeze wave passes", { vol: 0.5 });
  add(46.5, "plip-hi", "a drop flows past", { vol: 0.45 });
  add(48.1, "plip-lo", "a drop flows past", { vol: 0.45 });
  add(49.6, "plip-mid", "a drop flows past", { vol: 0.45 });
  add(50.2, "stick-creak", "the wall flexes", { vol: 0.35 });
  add(51.2, "log-drum-hi", "a squeeze wave passes", { vol: 0.5 });
  add(52.6, "fabric-flap", "the camera drifts on", { vol: 0.5 });
  add(53.8, "cricket", "the quiet before the hunger starts", { vol: 0.45 });
  // B71 a: silence from 55.5 to 56.0, the turn starts at 56.0
  // jam: after about two hours the hunger contractions start
  add(S[6] + 0.05, "deep-rumble", "the turn: the strongest sound of the video", { vol: 1.3 });
  add(S[6] + 0.4, "typing", "headline of jam", { vol: 0.4 });
  add(57.1, "log-drum-lo", "the first hunger contraction", { vol: 0.65 });
  add(TRACK.a + 0.2, "typing", "the 2-hour track pops in", { vol: 0.4 });
  add(59.6, "cricket", "waiting, the quiet before it", { vol: 0.5 });
  add(60.6, "plip-lo", "a drop is pushed on", { vol: 0.45 });
  add(61.6, "log-drum-mid", "the waves speed up", { vol: 0.7 });
  add(62.6, "log-drum-hi", "the waves speed up", { vol: 0.7 });
  add(TRACK.pill, "stick-creak", "the hunger-contraction pill", { vol: 0.5 });
  add(TREMOR.a, "log-drum-lo", "the wave hits: the tunnel squeezes shut", { vol: 1.0 });
  add(TREMOR.a + 0.1, "deep-rumble", "and the screen shudders", { vol: 0.9 });
  add(64.4, "brick-tumble", "the contents are pushed along", { vol: 0.5 });
  add(65.6, "log-drum-mid", "the next wave", { vol: 0.6 });
  add(67.0, "deep-rumble", "the growl rolls on", { vol: 0.6 });
  add(68.4, "cricket", "the waves ease", { vol: 0.45 });
  add(69.6, "sweep-pop", "out of the tunnel", { vol: 0.55 });
  // keluar: back out
  add(S[7] + 0.05, "typing", "headline of keluar", { vol: 0.4 });
  add(72.2, "fabric-flap", "the zoom out begins", { vol: 0.7 });
  add(73.4, "ding-long", "the gut shows in the lens again", { vol: 0.35 });
  add(75.0, "plip-hi", "a last bubble", { vol: 0.45 });
  add(77.0, "stick-creak", "the lens shrinks", { vol: 0.4 });
  add(79.0, "fabric-flap", "the zoom out speeds up", { vol: 0.6 });
  add(81.0, "plip-mid", "the person comes back into view", { vol: 0.4 });
  add(83.4, "sweep-pop", "the lens closes", { vol: 0.55 });
  add(83.9, "tiny-step", "we are outside again", { vol: 0.4 });
  // pesan: it is only the contents moving
  add(S[8] + 0.05, "typing", "headline of pesan", { vol: 0.4 });
  add(85.4, "plip-mid", "a bubble in the belly", { vol: 0.35 });
  add(CARDS[0].a + 0.02, "log-drum-hi", "the first card pops in", { vol: 0.5 });
  add(88.0, "cricket", "a beat of quiet", { vol: 0.5 });
  add(CARDS[1].a + 0.02, "log-drum-mid", "the second card pops in", { vol: 0.45 });
  add(92.0, "ding-long", "the message lands", { vol: 0.4 });
  add(93.6, "cricket", "the belly is quiet", { vol: 0.45 });
  add(CARDS[0].out, "fabric-flap", "the cards leave", { vol: 0.5 });
  // the loop-back to the first shot
  add(96.6, "log-drum-lo", "the belly growls again, as in the hook", { vol: 0.5 });
  add(97.8, "deep-rumble", "the growl rolls on", { vol: 0.4 });
  add(m.outro + 0.1, "jingle-outro", "loop-back jingle", { vol: 0.8 });
  return ev;
}
