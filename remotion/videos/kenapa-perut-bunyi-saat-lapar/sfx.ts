/* The sound of "Kenapa perut bunyi saat lapar?", written by hand against the scenes: a sound on the frame of every headline, camera move, label, bar, pill, card and the food that
   pops in or leaves. Names only from the locked set (src/catalog.ts).
   B60: the free pool is nearly empty (2026-11-28: only fabric-flap, crunch, cricket and typing are used by none of the 10 most recent videos), so this video uses exactly those four,
   eight events each (a quarter of the 34 events at most), plus the two channel jingles. They are picked for the picture: typing for text that lands, crunch for the food and the
   turn, a cloth flap for each camera move, a cricket for the hush of the lift. More sounds in the catalog (B61 d) would give this video a richer mix.
   B71 a: no event in the 0.5 s before the turn (the "jam" beat starts at 19.0) and the first sound after it is the strongest of the video. */
import type { SfxEvent } from "../../src/sfx.ts";
import type { SfxName } from "../../src/catalog.ts";
import type { StoryT } from "../../src/schema.ts";
import { FPS } from "../../src/timeline.ts";
import { BARS, CARDS, FOOD, LABELS, TREMOR, TRACK, makePlan } from "./plan.ts";

export const music = { track: "bed-lofi", level: 0.8 } as const;

export function sfx(story: StoryT): SfxEvent[] {
  const P = makePlan(story), m = P.m, ev: SfxEvent[] = [];
  const add = (t: number, name: SfxName, why: string, extra: Partial<SfxEvent> = {}) => ev.push({ t: Math.round(Math.max(0, t) * FPS) / FPS, name, vol: 1, why, ...extra });

  // the hook: the claim lands on frame 0
  add(0.05, "typing", "the claim lands on frame 0", { vol: 0.5 });
  // the sting (voice only: no mascot, no pill)
  add(m.sting, "jingle-sting", "Intip yuk!", { vol: 0.7 });
  add(m.stingEnd - 0.15, "fabric-flap", "the camera pulls back and the lift slides in", { vol: 0.8 });
  // remas: the walls squeeze all the time, even with food inside
  add(P.starts[2] + 0.05, "typing", "headline of remas", { vol: 0.4 });
  add(FOOD.a, "crunch", "the food lands in the stomach", { vol: 0.5 });
  add(5.4, "fabric-flap", "the camera pushes toward the stomach", { vol: 0.7 });
  add(LABELS.gas, "typing", "the gas and fluid labels pop in", { vol: 0.4 });
  add(7.5, "cricket", "the lift is quiet, the growl is faint", { vol: 0.6 });
  add(8.8, "crunch", "the food shifts as the wave passes", { vol: 0.35 });
  // kosong: with food it is muffled, empty it is not
  add(P.starts[3] + 0.05, "typing", "headline of kosong", { vol: 0.4 });
  add(11.4, "fabric-flap", "the camera eases right", { vol: 0.6 });
  add(FOOD.out0 + 0.2, "crunch", "the food leaves the stomach", { vol: 0.5 });
  add(13.6, "cricket", "the hush: nothing muffles the sound now", { vol: 0.6 });
  add(BARS.a1, "typing", "the first bar (with food) grows", { vol: 0.4 });
  add(15.7, "cricket", "the lift holds its breath", { vol: 0.5 });
  add(BARS.a2, "crunch", "the second bar (empty) grows long", { vol: 0.5 });
  add(17.2, "fabric-flap", "the bars fade and the camera settles", { vol: 0.5 });
  // B71 a: silence from 18.5 to 19.0, the turn starts at 19.0
  // jam: after about two hours the contractions start
  add(P.starts[4] + 0.05, "crunch", "the turn: the strongest sound of the video", { vol: 1.3 });
  add(20.0, "fabric-flap", "the camera pushes in", { vol: 0.8 });
  add(TRACK.a + 0.2, "typing", "the 2-hour track pops in", { vol: 0.4 });
  add(22.2, "cricket", "waiting, the quiet before it", { vol: 0.5 });
  add(TRACK.pill, "typing", "the hunger-contraction pill", { vol: 0.5 });
  add(TREMOR.a, "crunch", "the rings rattle the lift", { vol: 0.9 });
  add(26.6, "cricket", "the lift settles", { vol: 0.5 });
  // pesan: it is only the contents moving
  add(P.starts[5] + 0.05, "typing", "headline of pesan", { vol: 0.4 });
  add(28.4, "fabric-flap", "the camera pulls out", { vol: 0.7 });
  add(CARDS[0].a + 0.02, "crunch", "the first card pops in", { vol: 0.5 });
  add(30.8, "cricket", "a beat of quiet", { vol: 0.5 });
  add(CARDS[1].a + 0.02, "crunch", "the second card pops in", { vol: 0.45 });
  add(34.0, "cricket", "the lift is quiet again", { vol: 0.5 });
  add(CARDS[0].out, "fabric-flap", "the cards leave", { vol: 0.5 });
  // the loop-back to the first shot
  add(37.0, "fabric-flap", "the camera eases back to the first shot", { vol: 0.5 });
  add(38.0, "cricket", "the last hush before the loop", { vol: 0.4 });
  add(m.outro + 0.1, "jingle-outro", "loop-back jingle", { vol: 0.8 });
  return ev;
}
