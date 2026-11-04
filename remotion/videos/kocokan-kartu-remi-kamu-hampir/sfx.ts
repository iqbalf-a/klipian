/* The sound of "Kocokan kartu remi", written by hand against the scenes: a sound on the frame of every tile, card drop, camera pan, number roll, riffle, label and
   card. Names only from the locked set (src/catalog.ts). Every number comes from plan.ts, so the picture and the sound agree. */
import type { SfxEvent } from "../../src/sfx.ts";
import type { SfxName } from "../../src/catalog.ts";
import type { StoryT } from "../../src/schema.ts";
import { FPS } from "../../src/timeline.ts";
import { BOARD_T, CAM_KEYS, DROPS, FAKTA, HASIL, HOOK_Q, LABELS, RESET, SHUF, SUM_AT, TILES, TILES_OUT, TIPS, makePlan } from "./plan.ts";

export const music = { track: "bed-bounce", level: 0.8 } as const;

export function sfx(story: StoryT): SfxEvent[] {
  const P = makePlan(story), m = P.m, ev: SfxEvent[] = [];
  const add = (t: number, name: SfxName, why: string, extra: Partial<SfxEvent> = {}) => ev.push({ t: Math.round(Math.max(0, t) * FPS) / FPS, name, vol: 1, why, ...extra });

  // the hook: the first headline, the question mark, the establishing push
  add(0.05, "thump", "the first headline lands", { vol: 0.6 });
  add(HOOK_Q, "pop", "the question mark bursts");
  add(1.5, "whoosh", "the establishing push to the deck", { vol: 0.8 });
  // the sting
  add(m.sting, "boing", "the mascot pops in");
  add(m.sting + 0.1, "jingle-sting", "Intip yuk!", { vol: 0.7 });
  add(m.sting + 0.27, "pop", "the Intip yuk! pill");
  add(m.stingEnd - 0.15, "swish", "the mascot leaves", { vol: 0.6 });
  // the camera pans (between two keys that differ a lot)
  for (let i = 1; i < CAM_KEYS.length; i++) {
    const a = CAM_KEYS[i - 1], b = CAM_KEYS[i], far = Math.hypot(b.c.x - a.c.x, b.c.y - a.c.y) > 160 || Math.abs(b.c.z - a.c.z) > 0.12;
    if (far && a.t > 3 && b.t - a.t < 2.6) add(a.t + 0.05, "whoosh", `the camera moves (${Math.round(b.c.x)}, ${Math.round(b.c.y)})`, { vol: 0.65 });
  }
  // deck: the four suit tiles, the sum
  TILES.forEach((t, i) => add(t, "pop-soft", `suit tile ${i + 1} pops in`));
  add(SUM_AT, "chime", "52 cards: the sum", { vol: 0.7 });
  add(TILES_OUT, "swish-soft", "the tiles leave", { vol: 0.5 });
  // pilih: a card drops into each slot
  DROPS.forEach((d, i) => add(d.t, i === DROPS.length - 1 ? "thump" : "tick", `a card drops in slot ${i + 1}: ${d.n}`));
  add(DROPS[DROPS.length - 1].t + 0.35, "chime-bright", "one choice left", { vol: 0.6 });
  // angka: the board and its rolling number
  add(BOARD_T.pop, "pop", "the board lights up");
  for (let k = 0; k < 3; k++) add(BOARD_T.mant + k * 0.32, "tick-soft", "the number rolls", { vol: 0.6 });
  add(BOARD_T.expA, "zip", "the exponent starts to count", { vol: 0.7 });
  for (let k = 1; k <= 5; k++) add(BOARD_T.expA + k * 0.5, "tick", "the exponent ticks", { vol: 0.55 });
  add(BOARD_T.expB, "chime", "the exponent reaches 67", { vol: 0.7 });
  add(BOARD_T.stamp, "pop", "52! bursts");
  // acak: every riffle (the halves part, the cards fall in, the pile settles)
  SHUF.forEach((s, i) => {
    add(s.a + s.d * 0.4, "rattle", `riffle ${i + 1}: the cards fall into each other`, { vol: i === 0 ? 0.8 : 0.55 });
    add(s.a + s.d * 0.92, i === 6 ? "chime-bright" : "tick-soft", `riffle ${i + 1}: the pile settles${i < 7 ? `, dot ${i + 1} lights` : ""}`, { vol: 0.6 });
  });
  // hasil: the strips, the sign, the source
  add(HASIL.stripA, "tick-soft", "strip one fills", { vol: 0.6 });
  add(HASIL.stripB, "tick-soft", "strip two fills", { vol: 0.6 });
  add(HASIL.neq, "pop", "the not-equal sign");
  add(HASIL.chipA, "swish-soft", "the source chip", { vol: 0.5 });
  // fakta
  add(FAKTA.glow, "hum", "a pool of light behind the deck", { vol: 0.35, dur: 2.2 });
  add(FAKTA.baru, "pop", "BARU! bursts");
  add(FAKTA.baru + 0.15, "huh", "the surprise", { vol: 0.55 });
  // labels
  for (const l of LABELS.filter((x) => x.text === "52 kartu" || x.text === "belum pernah ada")) add(l.from + 0.05, "tick", `label "${l.text}"`, { vol: 0.8 });
  // tips: two cards
  TIPS.forEach((tp, i) => add(tp.a, "pop-soft", `tip card ${i + 1}`));
  // the loop-back: the pile pops back to a fresh deck, the jingle
  add(RESET, "pop-soft", "the pile pops back to a fresh deck", { vol: 0.7 });
  add(m.outro + 0.1, "jingle-outro", "loop-back jingle", { vol: 0.8 });
  return ev.sort((a, b) => a.t - b.t);
}
