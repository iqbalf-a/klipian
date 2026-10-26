/* The sound of "Kenapa colokan bisa panas?": an effect on nearly every element, on the frame of its picture (the same moments as the picture, from
   plan.ts), and a thin music bed. The mixer (sfx/mix.mjs) keeps it from getting busy: cooldowns, at most 3 one-shots at once, ducking under a voice. */
import type { SfxEvent } from "../../src/sfx.ts";
import type { SfxName } from "../../src/catalog.ts";
import type { StoryT } from "../../src/schema.ts";
import { FPS } from "../../src/timeline.ts";
import { makePlan } from "./plan.ts";

/** The bed under it all (render.mjs uses it because the story names none): about 12 dB under a voice, louder while there is none. */
export const music = { track: "bed-tech", level: 0.8 } as const;

export function sfx(story: StoryT): SfxEvent[] {
  const P = makePlan(story), m = P.m, ev: SfxEvent[] = [];
  const add = (t: number, name: SfxName, why: string, extra: Partial<SfxEvent> = {}) => ev.push({ t: Math.round(Math.max(0, t) * FPS) / FPS, name, vol: 1, why, ...extra });

  add(0, "whoosh", "the camera pushes in on the socket", { vol: 0.8 });
  add(m.hookHeat, "sizzle", "the plug starts to heat", { vol: 0.55 });
  P.tops.forEach((x, i) => { if (i) add(x.a + 0.05, "swish-soft", `headline: ${x.headline}`, { vol: 0.7 }); });
  add(0.1, "thump", "the first headline lands", { vol: 0.6 });
  for (const l of P.labels) add(l.from + 0.05, l.red ? "blip-alert" : "tick", `label "${l.text}"`, { vol: l.red ? 0.8 : 1 });

  add(m.sting, "boing", "the mascot pops in");
  add(m.sting + 0.1, "jingle-sting", "Intip yuk!");
  add(m.sting + 0.27, "pop", "the Intip yuk! pill");
  add(m.stingEnd - 0.15, "swish", "the mascot leaves", { vol: 0.6 });

  add(m.magnifier, "glass-ting", "the magnifier comes over the plug");
  add(m.through, "zoom-whoosh", "the camera goes through the lens");
  add(m.inside, "glass-ting", "inside the lab", { vol: 0.6 });
  add(m.inside, "hum", "the current flows", { dur: m.exit - m.inside + 0.9, vol: 0.9 });
  add(m.macro, "zip", "macro: the camera closes in on the contact", { vol: 0.8 });
  add(m.contactLabel - 0.5, "tick-soft", "the DIPERBESAR frame", { vol: 0.8 });

  add(m.loosen, "squeak", "the spring leaves loosen");
  add(m.loosen + 0.35, "rattle", "the leaf springs away", { vol: 0.5 });
  add(m.hot, "sizzle", "the narrow contact heats up");
  for (const c of P.cards) { add(c.from, "pop-soft", `source card: ${c.org}`); add(c.to, "swish-soft", "the card leaves", { vol: 0.6 }); }
  for (const c of P.chips) add(c.from, "tick-soft", `source chip ${c.text}`);
  add(m.react, "huh", "the mascot is surprised");

  add(m.loop, "zip", "the loop draws itself", { vol: 0.8 });
  add(m.loop + 0.15, "pop-soft", "panas ↑");
  add(m.loop + 0.45, "pop-soft", "hambatan ↑");
  add(m.exit, "zoom-whoosh", "back out through the lens", { vol: 0.8 });
  add(m.melt - 0.3, "sizzle", "the plate scorches", { vol: 0.8 });
  [0, 0.9, 1.8].forEach((d) => add(m.melt - 0.4 + d, "puff", "smoke", { vol: 0.8 - d * 0.15 }));

  add(m.tips, "swish", "the camera settles for the tips", { vol: 0.7 });
  P.tips.forEach((tp, i) => { add(tp.from, i ? "chime-bright" : "chime", `tip ${tp.n}`); add(tp.subAt, "tick", "the line under the tip"); });
  add(m.unplug, "click-crack", "the plug comes out");
  add(m.unplug + 0.12, "pop", "PLOK!");
  add(m.tip2 + 0.3, "thump", "the plug goes back in", { vol: 0.7 });
  add(m.wobble, "rattle", "the plug wobbles");
  add(m.replace, "chime-bright", "a new socket plate");

  add(m.outro + 0.15, "boing", "the mascot pops in");
  add(m.outro + 0.2, "jingle-outro", "outro");
  add(m.outro + 0.6, "tick-soft", "klipian intip");
  add(m.outro + 1.1, "pop", "the last pill");
  return ev.sort((a, b) => a.t - b.t);
}
