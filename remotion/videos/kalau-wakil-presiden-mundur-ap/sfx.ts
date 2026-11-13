/* The sound of "Kalau wakil presiden mundur": an effect on every element, on the frame of its picture (the same moments as the picture, from plan.ts), about one
   event a second, and a thin music bed. This video spreads its events over the sound families (catalog.ts SFX_FAMILIES) and uses the variety set of 2026-11-13: stamp for the gavel, page-flip for the
   book, pop-wood for the ticks, plop for the envelopes, tock for the calendar, marimba and bell-soft for the results, on the bed-study bed, so it does not sound like the other videos. The mixer (sfx/mix.mjs) keeps it from getting busy. */
import type { SfxEvent } from "../../src/sfx.ts";
import type { SfxName } from "../../src/catalog.ts";
import type { StoryT } from "../../src/schema.ts";
import { FPS } from "../../src/timeline.ts";
import { makePlan } from "./plan.ts";

/** The bed under it all (render.mjs uses it when the story names none). */
export const music = { track: "bed-study", level: 0.8 } as const;

export function sfx(story: StoryT): SfxEvent[] {
  const P = makePlan(story), m = P.m, ev: SfxEvent[] = [];
  const add = (t: number, name: SfxName, why: string, vol = 1, extra: Partial<SfxEvent> = {}) => ev.push({ t: Math.round(Math.max(0, t) * FPS) / FPS, name, vol, why, ...extra });
  const tag = (id: string, name: SfxName, vol = 1) => { const g = P.tags.find((x) => x.id === id); if (g) add(g.from + 0.05, name, `pill "${g.text}"`, vol); };
  let heads = 0;
  const head = (b: number, why: string) => add(b + 0.05, (["swish-soft", "swoop", "swish-down"] as const)[heads++ % 3], `headline: ${why}`, 0.7);

  // hook (3 s): the wide shot of the hall, the push to the chairs
  add(0.05, "stamp", "a gavel opens the hall", 0.8);
  add(0.2, "thump", "the first headline lands", 0.6);
  add(0.9, "squeak", "a lamp sways on its cord", 0.6);
  add(1.5, "zoom-whoosh", "the push to the chairs starts", 0.6);
  add(2.2, "huh", "one chair is empty", 0.6);
  add(2.8, "glass-ting", "the camera settles on the two chairs", 0.5);
  // sting
  add(m.sting, "boing", "the mascot pops in");
  add(m.sting + 0.1, "jingle-sting", "Intip yuk!", 0.7);
  add(m.sting + 0.27, "pop", "the Intip yuk! pill");
  add(m.stingEnd - 0.15, "swish", "the mascot leaves", 0.6);
  // kosong (8 s): the empty chair gets its card
  head(m.kosong, "kekosongan Wakil Presiden");
  add(m.kosong + 0.3, "zoom-whoosh", "the camera pushes to the chairs", 0.7);
  add(m.kosong + 1.6, "tick", "the camera settles", 0.5);
  add(m.kosong + 1.8, "puff", "the KOSONG card lands on the seat", 0.7);
  tag("ks-pres", "pop-soft");
  add(m.kosong + 3.0, "squeak", "a lamp sways", 0.5);
  tag("ks-vp", "pop");
  add(m.kosong + 4.6, "slide-whistle-down", "the empty chair glows", 0.5);
  add(m.kosong + 5.8, "glass-ting", "the plaque shines", 0.4);
  add(m.kosong + 6.9, "tick-soft", "the card settles", 0.4);
  // enam (8 s): the calendar of 60 days
  head(m.enam, "60 hari");
  add(m.enam + 0.2, "whoosh", "the camera pans to the calendar", 0.8);
  add(m.enam + 1.8, "thump", "the camera stops at the calendar", 0.6);
  tag("en-pasal", "pop");
  for (let i = 0; i < 6; i++) add(m.enam + 2.2 + i * 0.5, "tock", `day cells are crossed (${(i + 1) * 10})`, 0.5);
  tag("en-n", "pop");
  add(m.enam + 3.7, "zip", "the counter rolls to 60", 0.6, { dur: 0.8 });
  add(m.enam + 5.4, "stamp", "day 60: the limit", 0.8);
  add(m.enam + 5.6, "bell-soft", "60 hari", 0.8);
  add(m.enam + 6.8, "page-flip", "the calendar's corner curls", 0.5);
  // dua (8 s): two envelopes, one goes into the box
  head(m.dua, "dua calon, satu pilihan");
  add(m.dua + 0.2, "whoosh", "the camera pans across the hall to the ballot table", 0.8);
  add(m.dua + 1.3, "swish", "the chairs pass by", 0.5);
  add(m.dua + 2.6, "thump", "the camera stops at the table", 0.6);
  add(m.dua + 2.8, "plop", "envelope 1 lands", 0.8);
  tag("du-calon", "pop");
  add(m.dua + 3.3, "plop", "envelope 2 lands", 0.8);
  add(m.dua + 4.2, "click-soft", "the two envelopes wait", 0.6);
  add(m.dua + 5.0, "slide-whistle-down", "one envelope flies to the box", 0.6);
  tag("du-mpr", "pop");
  add(m.dua + 5.8, "rattle", "it drops into the ballot box", 0.8);
  add(m.dua + 6.3, "marimba", "chosen", 0.8);
  add(m.dua + 7.3, "tick-soft", "the box sits still", 0.4);
  // syarat (8 s): the constitution and the checklist
  head(m.syarat, "syarat calon");
  add(m.syarat + 0.2, "whoosh-soft", "the camera pans to the book", 0.8);
  add(m.syarat + 1.8, "tick", "the camera settles on the book", 0.5);
  tag("sy-pasal", "pop");
  add(m.syarat + 2.4, "pop-wood", "tick 1: WNI sejak lahir", 0.6);
  add(m.syarat + 3.0, "page-flip", "a page of the book turns", 0.6);
  add(m.syarat + 3.6, "pop-wood", "tick 2: tidak pernah mengkhianati negara", 0.6);
  add(m.syarat + 4.2, "page-flip", "another page turns", 0.5);
  add(m.syarat + 4.8, "pop-wood", "tick 3: mampu menjalankan tugas", 0.6);
  add(m.syarat + 5.2, "chime", "three of three", 0.7);
  tag("sy-uu", "pop-soft");
  add(m.syarat + 7.0, "glass-ting", "the cover shines", 0.4);
  // periode (9 s): the scale leans one way, the other, then hangs level
  head(m.periode, "ahli berbeda pendapat");
  add(m.periode + 0.2, "swoop", "the camera slides to the scale", 0.9);
  add(m.periode + 1.6, "tick", "the camera settles on the scale", 0.5);
  tag("pr-pasal", "pop");
  add(m.periode + 2.6, "huh", "the question", 0.6);
  add(m.periode + 3.4, "squeak", "the beam leans left", 0.8);
  tag("pr-a", "pop-soft");
  add(m.periode + 4.4, "click-soft", "the left pan hangs low", 0.6);
  add(m.periode + 5.3, "squeak", "the beam swings right", 0.8);
  tag("pr-b", "pop-soft");
  add(m.periode + 6.4, "click-soft", "the right pan hangs low", 0.6);
  add(m.periode + 7.2, "squeak", "the beam comes back level", 0.7);
  add(m.periode + 8.0, "bell-soft", "level: not decided", 0.7);
  // berhenti (6 s): back to the chairs, three steps
  head(m.berhenti, "DPR, MK, MPR");
  add(m.berhenti + 0.2, "whoosh-soft", "the camera pans back across the hall", 0.9);
  add(m.berhenti + 1.4, "swish", "the ballot table passes by", 0.5);
  add(m.berhenti + 2.8, "thump", "the camera stops at the empty chair", 0.6);
  tag("bh-dpr", "pop-wood");
  tag("bh-mk", "plop");
  tag("bh-mpr", "pop");
  add(m.berhenti + 5.0, "stamp", "the gavel: decided by MPR", 0.8);
  add(m.berhenti + 5.5, "tick-soft", "the card on the seat", 0.4);
  // tips (5 s): the recap
  head(m.tips, "60 hari, 2 calon, 1 pilihan");
  add(m.tips + 0.2, "swish", "the camera pulls back to both chairs", 0.6);
  add(m.tips + 1.2, "pop", "recap card 1");
  add(m.tips + 1.9, "marimba", "recap 1", 0.8);
  add(m.tips + 2.6, "pop", "recap card 2");
  add(m.tips + 3.3, "bell-soft", "recap 2", 0.8);
  add(m.tips + 4.3, "tick-soft", "a lamp sways", 0.4);
  // outro: back to the wide shot
  add(m.outro - 0.3, "puff", "the KOSONG card leaves", 0.5);
  add(m.outro + 0.1, "whoosh", "the camera eases back to the wide shot", 0.6);
  add(m.outro + 1.5, "squeak", "a lamp sways", 0.4);
  add(m.outro + 2.6, "click-soft", "the hall is still", 0.5);
  add(m.outro + 3.3, "jingle-outro", "loop", 0.6);
  return ev.sort((a, b) => a.t - b.t);
}
