/* The sound of "Tinggi badanmu pagi hari lebih tinggi 1 cm, kok bisa?", written by hand against the scenes: a sound on the frame of every label, camera pan, headline,
   weight arrow, the head dropping and rising, the water leaving and coming back, the cards and the clock. Names only from the locked set (src/catalog.ts). */
import type { SfxEvent } from "../../src/sfx.ts";
import type { SfxName } from "../../src/catalog.ts";
import type { StoryT } from "../../src/schema.ts";
import { FPS } from "../../src/timeline.ts";
import { BED_CARD, BRACKETS, CARD, CAM_KEYS, DETAIL, LABELS, LOAD_ARROWS, LOAD_KEYS, NOTE, makePlan } from "./plan.ts";

export const music = { track: "bed-curious", level: 0.8 } as const;

export function sfx(story: StoryT): SfxEvent[] {
  const P = makePlan(story), m = P.m, ev: SfxEvent[] = [];
  const add = (t: number, name: SfxName, why: string, extra: Partial<SfxEvent> = {}) => ev.push({ t: Math.round(Math.max(0, t) * FPS) / FPS, name, vol: 1, why, ...extra });

  // the hook: the wide shot, the push, the first words, the day that passes and the head that drops
  add(0.05, "thump", "the first headline lands", { vol: 0.6 });
  add(1.5, "whoosh", "the establishing push to the person", { vol: 0.8 });
  add(3.4, "slide-whistle-down", "the day passes, the head sinks", { vol: 0.5 });
  add(4.4, "tick", "the yellow marker stays at the morning height", { vol: 0.6 });
  // the sting
  add(m.sting, "boing", "the mascot pops in");
  add(m.sting + 0.1, "jingle-sting", "Intip yuk!", { vol: 0.7 });
  add(m.sting + 0.27, "pop", "the Intip yuk! pill");
  add(m.stingEnd - 0.15, "swish", "the mascot leaves", { vol: 0.6 });
  add(m.stingEnd + 0.3, "chime", "the next morning: the sun is back", { vol: 0.5 });
  // a new headline at the start of every explain beat
  P.starts.forEach((s, i) => { if (i >= 2 && i < story.beats.length - 1) add(s + 0.05, "swish-soft", `headline of ${story.beats[i].id}`, { vol: 0.7 }); });
  // the camera pans (between two keys at different places)
  for (let i = 1; i < CAM_KEYS.length; i++) {
    const a = CAM_KEYS[i - 1], b = CAM_KEYS[i], far = Math.hypot(b.c.x - a.c.x, b.c.y - a.c.y) > 150 && b.t - a.t < 2.6;
    if (far && a.t > 3) add(a.t + 0.05, "swish", `camera pans to ${Math.round(b.c.x)},${Math.round(b.c.y)}`, { vol: 0.7 });
  }
  add(58.6 - 1.0, "swish-soft", "the camera eases back to the wide shot", { vol: 0.6 });
  // the labels
  for (const l of LABELS) add(l.from + 0.05, "tick", `label "${l.text}"`);
  // the vertebrae light up one after another in the tulang beat
  [7.2, 9.2].forEach((t, i) => add(t, "tick-soft", `a vertebra ticks ${i + 1}`, { vol: 0.5 }));
  add(10.7, "glass-ting", "the discs are marked", { vol: 0.6 });
  // the disc detail bubble
  add(DETAIL.a, "pop", "the magnified disc pops in");
  add(DETAIL.a + 0.2, "glass-ting", "the lit disc", { vol: 0.5 });
  [14.4, 16.0].forEach((t) => add(t, "drip", "water bobs in the disc", { vol: 0.4 }));
  add(DETAIL.b - 0.3, "pop-soft", "the bubble closes", { vol: 0.5 });
  // the load: arrows press, the water is squeezed out, the head sinks
  add(LOAD_ARROWS.a, "thump", "the weight presses down", { vol: 0.8 });
  [22.0, 24.2].forEach((t, i) => add(t, "drip", `water squeezed out ${i + 1}`, { vol: 0.5 }));
  add(LOAD_KEYS[5].t, "slide-whistle-down", "the head sinks", { vol: 0.5 });
  add(LOAD_ARROWS.b, "puff", "the weight is gone", { vol: 0.5 });
  // the night: lying down, the water comes back, the discs swell
  add(BED_CARD.a, "pop-soft", "the lying-down card pops in");
  [30.8, 33.0].forEach((t, i) => add(t, "bubble-rise", `water goes back into the disc ${i + 1}`, { vol: 0.5 }));
  add(33.6, "boing", "the disc swells", { vol: 0.4 });
  add(BED_CARD.b, "pop-soft", "the card leaves", { vol: 0.5 });
  // the result: the morning, the night, the 1 cm bracket and the note
  add(37.6, "chime-bright", "the morning: the head is at its highest", { vol: 0.6 });
  add(38.4, "whoosh", "the head rises to the line", { vol: 0.5 });
  add(39.4, "slide-whistle-down", "the night: the head comes down", { vol: 0.5 });
  for (const b of BRACKETS) add(b.a + 0.1, "click-crack", "the 1 cm bracket snaps on", { vol: 0.7 });
  add(NOTE.a + 0.1, "pop-soft", "the note: the picture is exaggerated", { vol: 0.5 });
    // the fakta: the card and the counter
  add(CARD.a, "pop-soft", "the number card pops in");
  for (let k = 0; k < 2; k++) add(CARD.count + k * 0.3, "tick-soft", "the counter rolls", { vol: 0.5 });
  add(CARD.count + 1.2, "chime", "the counter stops at 1.9", { vol: 0.6 });
  add(CARD.out, "swish-soft", "the card leaves", { vol: 0.5 });
  // the tips: the morning again, the tip card
  add(52.0, "pop", "the tip card pops in");
  add(52.6, "chime-bright", "the sun is back", { vol: 0.5 });
  // the loop-back
  add(m.outro + 0.1, "jingle-outro", "loop-back jingle", { vol: 0.8 });
  return ev;
}
