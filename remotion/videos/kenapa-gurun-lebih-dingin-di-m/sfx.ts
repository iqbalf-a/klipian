/* The sound of "Kenapa gurun lebih dingin di malam hari?", written by hand against the scenes: a sound on the frame of every headline, camera pan, label, the sun's rays,
   the sunset, the heat that rises, the town's bounce, the thermometer falling, the cards, the cloud and the loop-back. Names only from the locked set (src/catalog.ts). */
import type { SfxEvent } from "../../src/sfx.ts";
import type { SfxName } from "../../src/catalog.ts";
import type { StoryT } from "../../src/schema.ts";
import { FPS } from "../../src/timeline.ts";
import { BOUNCE, CAM_KEYS, CURVE, FREE, JACKET, LABELS, RAYS, RISE, TOWN, makePlan } from "./plan.ts";

export const music = { track: "bed-breeze", level: 0.8 } as const;

export function sfx(story: StoryT): SfxEvent[] {
  const P = makePlan(story), m = P.m, ev: SfxEvent[] = [];
  const add = (t: number, name: SfxName, why: string, extra: Partial<SfxEvent> = {}) => ev.push({ t: Math.round(Math.max(0, t) * FPS) / FPS, name, vol: 1, why, ...extra });

  // the hook: the wide shot, the push, a day that passes in a flash
  add(0.05, "thump", "the first headline lands", { vol: 0.6 });
  add(1.3, "swoop", "the sun races to the horizon", { vol: 0.6 });
  add(1.5, "whoosh", "the establishing push to the thermometer", { vol: 0.8 });
  add(2.2, "slide-whistle-down", "the red column drops", { vol: 0.5 });
  // the sting
  add(m.sting, "boing", "the mascot pops in");
  add(m.sting + 0.1, "jingle-sting", "Intip yuk!", { vol: 0.7 });
  add(m.sting + 0.27, "pop", "the Intip yuk! pill");
  add(m.stingEnd - 0.15, "swish", "the mascot leaves", { vol: 0.6 });
  // a new headline at the start of every explain beat
  const heads: SfxName[] = ["swish-soft", "whoosh-soft", "swish-soft", "whoosh-soft", "swish-down", "swish-soft", "whoosh-soft"];
  P.starts.forEach((s, i) => { if (i >= 2 && i < story.beats.length - 1) add(s + 0.05, heads[i - 2], `headline of ${story.beats[i].id}`, { vol: 0.6 }); });
  // the camera pans (between two keys at different places)
  for (let i = 1; i < CAM_KEYS.length; i++) {
    const a = CAM_KEYS[i - 1], b = CAM_KEYS[i], far = Math.hypot(b.c.x - a.c.x, b.c.y - a.c.y) > 200 && b.t - a.t < 2.6;
    if (far && a.t > 3.5 && a.t < 57) add(a.t + 0.05, "swish", `camera pans to ${Math.round(b.c.x)},${Math.round(b.c.y)}`, { vol: 0.65 });
  }
  // the labels, each with its own small tick
  const ticks: SfxName[] = ["tick", "key-blip", "click-soft", "tock", "tick-soft"];
  LABELS.forEach((l, i) => add(l.from + 0.05, ticks[i % ticks.length], `label "${l.text}"`, { vol: 0.7 }));
  // siang: the sun's rays, the sand heats
  add(RAYS.a, "chime-bright", "the sun's rays reach the sand", { vol: 0.6 });
  add(5.6, "hum", "the sun warms the sand", { vol: 0.4 });
  add(8.5, "sizzle", "the sand glows hot", { vol: 0.5 });
  add(10.6, "puff", "heat shimmers up", { vol: 0.4 });
  // malam: sunset, the heat rises and leaves, the stars come out
  add(12.4, "swoop", "the sun sinks", { vol: 0.6 });
  add(RISE.a, "puff", "the heat lifts off the sand", { vol: 0.5 });
  add(15.2, "slide-whistle-down", "the red column falls", { vol: 0.5 });
  add(16.0, "glass-ting", "the stars are out", { vol: 0.6 });
  add(RISE.a + 1.2, "bubble-rise", "the heat rises into the sky", { vol: 0.5 });
  // lembap: the town, vapour and a cloud
  add(TOWN.a, "pop", "the cloud and the vapour appear");
  add(22.5, "drip", "vapour droplets", { vol: 0.45 });
  add(23.6, "bubble-rise", "heat rises from the roofs", { vol: 0.5 });
  add(25.0, "boing", "the heat bounces back down", { vol: 0.55 });
  add(26.2, "plop", "the town stays warm", { vol: 0.5 });
  // kering: a clear sky, nothing holds the heat
  add(FREE.a + 0.4, "zip", "the heat shoots out to space", { vol: 0.6 });
  add(31.2, "tick-soft", "only a few vapour dots", { vol: 0.5 });
  add(33.4, "slide-whistle-down", "the red column drops further", { vol: 0.5 });
  add(34.8, "glass-ting", "a clear night sky", { vol: 0.5 });
  // pasir: the day and night curve
  add(CURVE.a, "pop", "the sand's curve card pops in");
  add(CURVE.sweep, "zip", "the curve is drawn", { vol: 0.5 });
  add(38.2, "marimba", "the curve climbs", { vol: 0.5 });
  add(40.2, "swish-down", "the curve falls fast", { vol: 0.5 });
  add(CURVE.out, "pop-soft", "the card leaves", { vol: 0.5 });
  // fakta: a cloud over the desert holds some heat back
  add(43.4, "whoosh-soft", "the cloud drifts in", { vol: 0.6 });
  add(BOUNCE.a, "puff", "the heat meets the cloud", { vol: 0.5 });
  add(46.3, "boing", "the heat comes back down", { vol: 0.5 });
  add(47.6, "chime", "the column rises a little", { vol: 0.6 });
  // tips: the jacket
  add(JACKET.a, "pop", "the jacket card pops in");
  add(50.1, "bell-soft", "the jacket", { vol: 0.5 });
  add(51.4, "pop-wood", "the tip lands", { vol: 0.5 });
  add(48.3, "puff", "the cloud melts away", { vol: 0.4 });
  add(JACKET.out, "pop-soft", "the card leaves", { vol: 0.5 });
  // the loop-back: the day returns
  add(56.5, "chime-bright", "the sun comes back", { vol: 0.6 });
  add(57.6, "swish-soft", "the camera eases back", { vol: 0.5 });
  add(m.outro + 0.1, "jingle-outro", "loop-back jingle", { vol: 0.8 });
  return ev;
}
