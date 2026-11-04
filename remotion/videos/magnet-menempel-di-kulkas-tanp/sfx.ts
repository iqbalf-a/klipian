/* The sound of "Magnet menempel di kulkas tanpa lem": a sound on every object that enters, every camera move, label, panel, state change and alive action that matters, on the frame
   of its picture (the same moments as the picture, from plan.ts), about one event a second. Only names of the locked set (src/catalog.ts SFX). The mixer (sfx/mix.mjs) keeps it
   from getting busy: cooldowns, at most 3 one-shots at once. */
// Imported from the plain .ts modules, never from src/design/index.ts: render.mjs loads this file in Node, which cannot read the .tsx components that index re-exports.
import type { SfxEvent } from "../../src/sfx.ts";
import type { SfxName } from "../../src/catalog.ts";
import type { StoryT } from "../../src/schema.ts";
import { FPS } from "../../src/timeline.ts";
import { makePlan } from "./plan.ts";

/** The bed under it all (render.mjs uses it because the story names none). */
export const music = { track: "bed-bounce", level: 0.8 } as const;

export function sfx(story: StoryT): SfxEvent[] {
  const P = makePlan(story), m = P.m, B = P.beat, ev: SfxEvent[] = [];
  const add = (t: number, name: SfxName, why: string, extra: Partial<SfxEvent> = {}) => ev.push({ t: Math.round(Math.max(0, t) * FPS) / FPS, name, vol: 1, why, ...extra });

  // hook: the wide shot, the push to the fridge, the ring round the magnet
  add(0, "whoosh", "the camera pushes in on the fridge", { vol: 0.8 });
  add(0.25, "swish-soft", "the first headline comes in", { vol: 0.7 });
  add(m.ring, "tick", "the ring round the magnet", { vol: 0.9 });
  add(1.6, "zoom-whoosh", "the establishing push", { vol: 0.6 });
  add(2.6, "pop-soft", "the ring leaves", { vol: 0.6 });

  // sting
  add(m.sting, "boing", "the mascot pops in");
  add(m.sting + 0.1, "jingle-sting", "Intip yuk!", { vol: 0.7 });
  add(m.sting + 0.27, "pop", "the Intip yuk! pill");
  add(m.stingEnd - 0.15, "swish", "the mascot leaves", { vol: 0.6 });

  // logam: iron, nickel, cobalt
  add(B("logam").a + 0.1, "swish-soft", "headline: besi, nikel, kobalt", { vol: 0.7 });
  add(B("logam").a + 1.4, "tick", "label: feromagnetik");
  add(B("logam").a + 1.7, "tick-soft", "the source chip", { vol: 0.8 });
  add(B("logam").a + 3.4, "pop-soft", "the door is lit as a ferromagnetic part", { vol: 0.5 });
  add(B("logam").a + 5.6, "tick-soft", "the camera settles on the note", { vol: 0.5 });

  // domain: the panel opens on the inside of the iron
  add(B("domain").a + 0.1, "swish-soft", "headline: domain mungil", { vol: 0.7 });
  add(m.panel1, "glass-ting", "the magnified panel opens", { vol: 0.8 });
  add(m.panel1 + 0.15, "pop", "the panel pops");
  add(B("domain").a + 2.0, "tick", "label: domain acak");
  [3.4, 5.4, 7.2].forEach((d, i) => add(B("domain").a + d, "tick-soft", `the domains jiggle ${i + 1}`, { vol: 0.5 }));

  // sejajar: the magnet comes, the domains turn
  add(B("sejajar").a + 0.1, "swish-soft", "headline: domain jadi sejajar", { vol: 0.7 });
  add(m.magIn, "whoosh", "the magnet comes down", { vol: 0.6 });
  add(m.magIn + 1.3, "thump", "the magnet stops above the slab", { vol: 0.6 });
  for (let i = 0; i < 15; i += 2) add(m.alignFrom + 0.16 * i, "tick-soft", `domain ${i + 1} turns`, { vol: 0.55 });
  add(m.alignFrom + 0.16 * 15 + 0.3, "chime", "all the domains line up");
  add(B("sejajar").a + 3.2, "tick", "label: domain sejajar");
  add(B("sejajar").a + 5.2, "pop-soft", "source card: OpenStax");
  add(B("sejajar").b - 0.3, "swish-soft", "the card and the panel leave", { vol: 0.6 });

  // hasil: the pull holds the magnet
  add(B("hasil").a + 0.1, "swish-soft", "headline: tarikan, bukan lem", { vol: 0.7 });
  add(B("hasil").a + 0.4, "zoom-whoosh", "the camera pulls out to the fridge", { vol: 0.6 });
  add(m.pull, "pop", "the pull arrows");
  add(m.pull + 0.5, "hum", "the pull holds", { dur: 2.0, vol: 0.5 });
  add(m.holds, "chime", "the magnet is held");
  add(B("hasil").a + 5.0, "tick-soft", "the camera drifts", { vol: 0.5 });

  // alum: the pan to the counter, the magnet drops off the pot
  add(B("alum").a + 0.1, "swish", "the pan along the counter", { vol: 0.8 });
  add(B("alum").a + 0.2, "swish-soft", "headline: aluminium nyaris tak ditarik", { vol: 0.6 });
  add(m.mag2In, "pop", "the loose magnet comes in");
  add(m.mag2In + 0.7, "swish-soft", "the magnet goes toward the pot", { vol: 0.6 });
  add(m.mag2Touch, "tick", "the magnet touches the pot");
  add(B("alum").a + 3.1, "tick-soft", "label: sangat lemah", { vol: 0.6 });
  add(m.mag2Fall, "slide-whistle-down", "the magnet does not hold and falls", { vol: 0.8 });
  add(m.mag2Fall + 0.36, "thump", "it lands on the counter", { vol: 0.7 });
  add(m.mag2Fall + 0.6, "tick-soft", "a small bounce", { vol: 0.5 });

  // lentur: ferrite powder in plastic
  add(B("lentur").a + 0.1, "swish-soft", "headline: bubuk ferit plus plastik", { vol: 0.7 });
  add(m.panel2, "glass-ting", "the magnified panel opens", { vol: 0.8 });
  add(m.panel2 + 0.15, "pop", "the panel pops");
  add(B("lentur").a + 1.2, "tick", "label: ferit");
  add(B("lentur").a + 1.6, "tick-soft", "the source chip", { vol: 0.8 });
  add(B("lentur").a + 3.0, "tick-soft", "the grains twinkle", { vol: 0.5 });
  add(B("lentur").b - 0.2, "swish-soft", "the panel leaves", { vol: 0.6 });

  // tips: the tin holds a magnet, the pot does not
  add(B("tips").a + 0.1, "swish", "the camera settles on the counter", { vol: 0.7 });
  add(B("tips").a + 0.2, "swish-soft", "headline: besi nempel, aluminium tidak", { vol: 0.6 });
  add(m.mag3In - 0.2, "pop", "badge 1");
  add(m.mag3In, "click-crack", "the magnet snaps onto the tin");
  add(m.mag3In + 0.15, "chime", "it holds");
  add(m.potTry - 0.2, "pop", "badge 2");
  add(m.potTry + 0.1, "huh", "the pot does not hold", { vol: 0.8 });
  add(B("tips").a + 7.2, "tick-soft", "the camera drifts", { vol: 0.5 });

  // outro: the loop-back, no jingle; the magnets leave and the camera eases to the wide shot
  add(m.outro - 0.1, "whoosh", "the camera eases back to the wide shot", { vol: 0.7 });
  add(m.outro + 0.2, "pop-soft", "the loose magnets leave", { vol: 0.5 });
  add(m.outro + 1.4, "thump", "the wide shot settles", { vol: 0.5 });
  return ev.sort((a, b) => a.t - b.t);
}
