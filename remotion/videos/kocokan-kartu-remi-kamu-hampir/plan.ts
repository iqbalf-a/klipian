/* Kocokan kartu remi — the timing, the camera and the shuffles of this video (pure: no React). Look 2d (B28): a flat front view of a card table.
   One continuous world; the camera moves inside it by the clock of the whole video, so the sting and every beat share the set.
   motion-exception: the hook's establishing push (wide 0.78 to main 1.0) lasts 1.4 s as the registry's establishing push does; the pans between the places of
   the set (the deck, the row of slots on the table to the right, the wall board above) last 1.4 to 1.7 s. Every number below is read by index.tsx and sfx.ts. */
import type { StoryT } from "../../src/schema.ts";

export type Cam = { x: number; y: number; z: number };

/** The places of the set (world px). The deck stands at DECK, the slots lie on the felt to the right, the board hangs on the wall above the deck. */
export const DECK = { x: 540, y: 1255 };
export const SLOTS = { x: 1590, y: 1240 };
export const BOARD = { x: 540, y: -443 };

export const CAM_KEYS: { t: number; c: Cam }[] = [
  { t: 0, c: { x: 540, y: 1170, z: 0.78 } },
  { t: 1.5, c: { x: 540, y: 1170, z: 0.78 } },      // the wide shot of the table, the deck in the middle third
  { t: 2.9, c: { x: DECK.x, y: DECK.y, z: 1.0 } },  // establishing push to the main shot
  { t: 9.8, c: { x: DECK.x, y: DECK.y, z: 1.06 } },  // deck: a slow push
  { t: 11.5, c: { x: SLOTS.x, y: SLOTS.y, z: 1.05 } }, // pilih: pan along the table to the slots
  { t: 17.8, c: { x: SLOTS.x, y: SLOTS.y, z: 1.12 } },
  { t: 19.5, c: { x: BOARD.x, y: BOARD.y, z: 1.2 } },  // angka: pan up to the wall board
  { t: 25.4, c: { x: BOARD.x, y: BOARD.y, z: 1.26 } },
  { t: 27.0, c: { x: DECK.x, y: DECK.y, z: 1.0 } },    // acak: back to the deck
  { t: 33.4, c: { x: DECK.x, y: DECK.y, z: 1.06 } },
  { t: 35.4, c: { x: 540, y: 1040, z: 0.85 } },       // hasil: pull back to see the deck and the two strips
  { t: 40.4, c: { x: 540, y: 1040, z: 0.88 } },
  { t: 42.2, c: { x: DECK.x, y: DECK.y, z: 1.05 } },  // fakta: close on the deck
  { t: 46.6, c: { x: DECK.x, y: DECK.y, z: 1.1 } },
  { t: 48.2, c: { x: 540, y: 1100, z: 0.75 } },       // tips: the camera drops to leave room for the cards
  { t: 55.6, c: { x: 540, y: 1100, z: 0.77 } },
  { t: 58.2, c: { x: 540, y: 1170, z: 0.78 } },       // the loop-back: the wide shot of the hook
  { t: 60, c: { x: 540, y: 1170, z: 0.78 } },
];

const ease = (x: number) => (x < 0.5 ? 2 * x * x : 1 - 2 * (1 - x) * (1 - x));
export function camAt(t: number): Cam {
  const k = CAM_KEYS;
  if (t <= k[0].t) return k[0].c;
  for (let i = 1; i < k.length; i++) {
    if (t <= k[i].t) {
      const a = k[i - 1], b = k[i], u = (b.t === a.t) ? 1 : ease((t - a.t) / (b.t - a.t));
      return { x: a.c.x + (b.c.x - a.c.x) * u, y: a.c.y + (b.c.y - a.c.y) * u, z: a.c.z + (b.c.z - a.c.z) * u };
    }
  }
  return k[k.length - 1].c;
}

// ---------------------------------------------------------------------------------------------------------------- the deck and its riffle shuffles
/** The pile on the table has M cards (half of 52, to keep the picture readable): ids 0..12 are blue backs (the bottom half), 13..25 red backs. */
export const M = 26;
const lcg = (seed: number) => { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; };
/** Where the deck is cut before each riffle (the cards of 0..cut-1 are the bottom half). */
export const CUTS = [13, 12, 14, 13, 11, 14, 12, 13];
/** ORDERS[k] is the pile (bottom to top) after k riffles. The first riffle alternates one card from each half (so the stripes show); the others drop at random
    in proportion to the cards left in each half, as the Gilbert-Shannon-Reeds model does. */
export const ORDERS: number[][] = (() => {
  const o: number[][] = [Array.from({ length: M }, (_, i) => i)];
  for (let k = 0; k < CUTS.length; k++) {
    const prev = o[k], A = prev.slice(0, CUTS[k]), B = prev.slice(CUTS[k]), r = lcg(11 + k * 37), out: number[] = [];
    let a = 0, b = 0, turn = 0;
    while (a < A.length || b < B.length) {
      const ra = A.length - a, rb = B.length - b;
      const fromA = k === 0 ? (turn % 2 === 0 ? a < A.length : b >= B.length) : (rb === 0 ? true : ra === 0 ? false : r() < ra / (ra + rb));
      out.push(fromA ? A[a++] : B[b++]);
      turn++;
    }
    o.push(out);
  }
  return o;
})();
/** The seven riffles of the acak beat (the first one slow, told step by step) and the one more in the tips beat. a = start, d = length (s). */
export const SHUF: { a: number; d: number }[] = [
  { a: 26.8, d: 2.6 }, { a: 29.5, d: 0.7 }, { a: 30.2, d: 0.7 }, { a: 30.9, d: 0.7 }, { a: 31.6, d: 0.7 }, { a: 32.3, d: 0.7 }, { a: 33.0, d: 0.7 },
  { a: 49.0, d: 1.4 },
];
/** At RESET the pile pops back to a fresh deck, so the last frame is the first (the loop). */
export const RESET = 56.2;

// ---------------------------------------------------------------------------------------------------------------- the moments of each beat
/** deck: the four suit tiles pop in, then the sum. */
export const TILES = [5.0, 5.7, 6.4, 7.1];
export const SUM_AT = 8.2;
export const TILES_OUT = 9.7;
/** pilih: the cards that drop into the slots (time, the number on the card) and the "terus berkurang" label. */
export const DROPS: { t: number; n: string }[] = [
  { t: 11.7, n: "52" }, { t: 13.1, n: "51" }, { t: 14.4, n: "50" }, { t: 15.5, n: "…" }, { t: 16.4, n: "2" }, { t: 17.1, n: "1" },
];
/** angka: the board's number rolls (mantissa), the exponent counts to 67, the 67 cells fill, then the stamp. */
export const BOARD_T = { pop: 19.7, mant: 20.0, expA: 21.0, expB: 24.0, stamp: 24.6 };
export const EXP = 67, MANT = 8.07;
/** hasil: the two strips fill, the not-equal sign, the source chip. */
export const HASIL = { stripA: 35.6, stripB: 36.0, neq: 37.4, chipA: 38.0, chipB: 40.6 };
/** fakta: the glow, the BARU! burst and the label. */
export const FAKTA = { glow: 41.6, baru: 42.6, label: 43.8, end: 46.8 };
/** tips: the two cards (screen space). */
export const TIPS = [{ a: 47.8, b: 55.0 }, { a: 51.8, b: 55.0 }];
/** hook: the question mark burst. */
export const HOOK_Q = 1.0;

/** The seven dots under the deck that light up as each riffle ends (acak). */
export const DOTS_FROM = 26.6;
export const dotLit = (i: number) => SHUF[i].a + SHUF[i].d * 0.92;

export function makePlan(story: StoryT) {
  const starts = story.beats.map((_, i) => story.beats.slice(0, i).reduce((a, b) => a + b.dur, 0));
  const total = story.beats.reduce((a, b) => a + b.dur, 0);
  const sting = starts[1] ?? 0;                                   // must 1: the "Intip yuk!" sting is the second beat
  const outro = starts.at(-1) ?? total;                           // must 2: the loop-back outro is the last beat
  const m = { sting, stingEnd: sting + (story.beats[1]?.dur ?? 1), react: NaN, outro, end: total };
  return {
    m, total, starts,
    // 0 at the start, 1 in the loop-back: the scene is the first beat's again at the end (the loop)
    loopWeight: (t: number) => Math.min(1, Math.max(0, (t - outro) / 0.5)),
    tops: [] as { b: number; headline?: string }[],
    labels: [] as { to: number; text: string }[],
  };
}

/** The hero's box at time t, in the 1080 px frame (x, y, w, h): the pile of cards (about 440 px wide plus its ledges, 616 high). */
export const HERO_BOX_AT = (t: number) => {
  const c = camAt(t);
  return { x: 540 + (580 - c.x) * c.z, y: 960 + (1140 - c.y) * c.z, w: 560 * c.z, h: 700 * c.z };
};

/** The labels on the set (world coordinates, seconds of the video): shown from `from` to `to`. */
export type WLabel = { text: string; x: number; y: number; fs: number; from: number; to: number; start?: boolean };
export const LABELS: WLabel[] = [
  { text: "terus berkurang", x: 1590, y: 1520, fs: 50, from: 15.4, to: 17.9 },
  { text: "52 kartu", x: 540, y: 1700, fs: 56, from: 8.3, to: 9.8 },
  { text: "kocokanmu", x: 176, y: 500, fs: 40, from: 35.6, to: 40.4, start: true },
  { text: "kocokan lain", x: 176, y: 660, fs: 40, from: 36.0, to: 40.4, start: true },
  { text: "belum pernah ada", x: 540, y: 1700, fs: 52, from: 43.8, to: 46.8 },
];
