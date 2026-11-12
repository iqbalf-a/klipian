/* Rp14,69 miliar itu sebanyak apa? — the timing, the camera and the sums of this video (pure: no React here). A flat 2D drawing (look 2d, B28) in its own set, a
   general store seen from the front (set.json, kind "general-store-front"): the hero is the pile of money on the counter under its total board; around it stand the
   things the money is compared with (a shelf of phones, a parked scooter, jerrycans of petrol, a wall calendar). One continuous take: every beat is a pan to another
   place in the store. The sound is sfx.ts.
   Scale (B27.7): 8 px = 1 cm (K scales the pieces drawn at 11 px a cm). A brick of 1000 notes of Rp100.000 (Rp100 juta) is about 15 x 6.5 x 10 cm, drawn 121 x 80 px
   front-on; Rp14,69 miliar is 147 bricks, drawn 6 wide and 5 high (5 rows deep behind). A phone 15 cm = 116 px, a 20 l jerrycan 39 cm = 313 px, a scooter 187 cm
   long = 1490 px and about 100 cm high = 800 px (shown whole in its own beat, cut by the frame elsewhere), a wall calendar 24 x 34 cm.
   Shapes drawn in their real form (B27.16): a banknote brick is a box with paper bands (not a fan of notes); a scooter in side view has a step-through floor between the
   leg shield and the seat; a jerrycan is a flat-sided can with a pressed X and three handles on top. */
import type { StoryT } from "../../src/schema.ts";
import { cam2At, type Cam2, type Key2 } from "../../src/iso.ts";

/** The sums (every price is a claim of the story, with its source). */
export const TOTAL = 14_696_955_002;
export const PRICE = { iphone: 27_499_000, motor: 19_380_000, liter: 10_000, ump: 5_729_876, perDay: 1_000_000 } as const;
export const COUNT = {
  iphone: Math.floor(TOTAL / PRICE.iphone),             // 534
  motor: Math.floor(TOTAL / PRICE.motor),               // 758
  liter: Math.floor(TOTAL / PRICE.liter),               // 1.469.695
  orang: Math.floor(TOTAL / (PRICE.ump * 12)),          // 213
  tahun: Math.floor(TOTAL / PRICE.perDay / 365.25),     // 40
} as const;

export const K = 8 / 11;
export const FLOOR_Y = 1600;
export const COUNTER = { x0: -140, x1: 930, y: 1240 } as const;
export const BRICK = { w: 121, h: 80, cols: 6, rows: 5 } as const;
export const PILE = { x0: 177, x1: 177 + BRICK.w * BRICK.cols, y0: COUNTER.y - BRICK.h * BRICK.rows, y1: COUNTER.y } as const;
export const BOARD = { x0: 190, x1: 890, y0: 600, y1: 770 } as const;
export const SHELF = { x0: 980, x1: 2500, rows: [560, 730, 900], step: 84, w: 78, h: 160 } as const;   // w, h: the phone as drawn, before K
export const CANS = { xs: [1000, 1262, 1524, 1786, 2048, 2310], w: 320, h: 430 } as const;   // w, h: the can as drawn, before K
export const CAL = { x0: -130, y0: 250, w: 260, h: 370 } as const;                          // w, h: the sheet as drawn, before K
export const ENV = { x0: -70, w: 190, h: 16, n: 12 } as const;
export const SCOOTER = { front: -420, rear: -1800, r: 250, at: -380 } as const;             // drawn at 11 px a cm, placed with K: the front wheel stands at x = at

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const ease = (k: number) => { const c = clamp01(k); return c < 0.5 ? 2 * c * c : 1 - Math.pow(-2 * c + 2, 2) / 2; };

export type Tag = { id: string; from: number; to: number; at: [number, number]; box: [number, number]; text: string; fs: number; count?: { to: number; unit: string } };

export function makePlan(story: StoryT) {
  const starts = story.beats.map((_, i) => story.beats.slice(0, i).reduce((a, b) => a + b.dur, 0));
  const total = story.beats.reduce((a, b) => a + b.dur, 0);
  const at = (id: string) => starts[Math.max(0, story.beats.findIndex((b) => b.id === id))] ?? 0;
  const sting = starts[1] ?? 0;                                   // must 1: the "Intip yuk!" sting is the second beat
  const outro = starts.at(-1) ?? total;                           // must 2: the loop-back outro is the last beat
  const m = {
    sting, stingEnd: sting + (story.beats[1]?.dur ?? 1), react: NaN, outro, end: total,
    asal: at("asal"), iphone: at("iphone"), motor: at("motor"), bensin: at("bensin"), gaji: at("gaji"), hari: at("hari"), tips: at("tips"),
  };
  // the camera: the wide shot of the store (the pile in the centre third), the push to the pile, then every beat is a pan to another place; the outro returns to the wide shot
  // motion-exception: the establishing push goes from zoom 0.5 to 1.0 in 1.3 s (the registered establishing range, B27.8), faster than a beat's push
  const WIDE: Cam2 = { x: 540, y: 1060, zoom: 0.5 };
  const MAIN: Cam2 = { x: 540, y: 1000, zoom: 1.0 };
  const keys: Key2[] = [
    { t: 0, ...WIDE }, { t: 1.5, ...WIDE }, { t: 2.8, ...MAIN },
    { t: m.asal + 0.1, ...MAIN }, { t: m.asal + 1.6, x: 540, y: 900, zoom: 1.2 }, { t: m.iphone - 0.1, x: 540, y: 905, zoom: 1.26 },
    { t: m.iphone + 1.5, x: 1180, y: 880, zoom: 1.25 }, { t: m.motor - 0.1, x: 1210, y: 880, zoom: 1.3 },
    { t: m.motor + 2.5, x: -820, y: 1050, zoom: 0.72 }, { t: m.bensin - 0.1, x: -840, y: 1050, zoom: 0.75 },
    { t: m.bensin + 2.5, x: 1270, y: 1660, zoom: 1.45 }, { t: m.gaji - 0.1, x: 1290, y: 1660, zoom: 1.5 },
    { t: m.gaji + 2.0, x: -70, y: 1120, zoom: 1.5 }, { t: m.hari - 0.1, x: -65, y: 1120, zoom: 1.55 },
    { t: m.hari + 1.3, x: -60, y: 385, zoom: 1.85 }, { t: m.tips - 0.1, x: -60, y: 385, zoom: 1.92 },
    { t: m.tips + 1.5, x: 580, y: 1100, zoom: 1.0 }, { t: outro - 0.1, x: 580, y: 1100, zoom: 1.03 },
    { t: outro + 2.6, ...WIDE }, { t: total, ...WIDE },
  ];
  /** the pill labels: a world point on the object (`at`) and the pill's place on the screen (`box`); a `count` rolls up to its number */
  const tags: Tag[] = [
    { id: "paket", from: m.asal + 1.8, to: m.iphone - 0.2, at: [420, 870], box: [300, 470], text: "8 paket", fs: 56 },
    { id: "tahun", from: m.asal + 3.6, to: m.iphone - 0.2, at: [700, 610], box: [660, 580], text: "2024 sampai 2026", fs: 46 },
    { id: "tarif", from: m.asal + 5.6, to: m.iphone - 0.2, at: [540, 1010], box: [480, 1350], text: "tarif: rate card", fs: 46 },
    { id: "hp-harga", from: m.iphone + 1.7, to: m.motor - 0.2, at: [1040, 590], box: [330, 420], text: "Rp27.499.000", fs: 46 },
    { id: "hp-n", from: m.iphone + 3.4, to: m.motor - 0.2, at: [1300, 1040], box: [560, 1330], text: "534 unit", fs: 60, count: { to: COUNT.iphone, unit: "unit" } },
    { id: "mt-harga", from: m.motor + 2.6, to: m.bensin - 0.2, at: [-560, 900], box: [600, 480], text: "Rp19.380.000", fs: 46 },
    { id: "mt-n", from: m.motor + 4.0, to: m.bensin - 0.2, at: [-1000, 1150], box: [400, 640], text: "758 unit", fs: 60, count: { to: COUNT.motor, unit: "unit" } },
    { id: "bb-harga", from: m.bensin + 2.6, to: m.gaji - 0.2, at: [1090, 1320], box: [350, 1010], text: "Rp10.000 per liter", fs: 46 },
    { id: "bb-n", from: m.bensin + 4.2, to: m.gaji - 0.2, at: [1400, 1590], box: [580, 1180], text: "1.469.695 liter", fs: 56, count: { to: COUNT.liter, unit: "liter" } },
    { id: "gj-ump", from: m.gaji + 2.1, to: m.hari - 0.2, at: [25, 1215], box: [560, 520], text: "UMP Rp5.729.876", fs: 46 },
    { id: "gj-n", from: m.gaji + 4.4, to: m.hari - 0.2, at: [-40, 1060], box: [420, 690], text: "213 orang", fs: 60, count: { to: COUNT.orang, unit: "orang" } },
    { id: "gj-12", from: m.gaji + 6.0, to: m.hari - 0.2, at: [100, 1236], box: [600, 1330], text: "12 bulan gaji", fs: 46 },
    { id: "hr-juta", from: m.hari + 1.4, to: m.tips - 0.2, at: [-36, 270], box: [540, 480], text: "Rp1 juta per hari", fs: 46 },
    { id: "hr-n", from: m.hari + 3.0, to: m.tips - 0.2, at: [-36, 510], box: [540, 1350], text: "40 tahun", fs: 64, count: { to: COUNT.tahun, unit: "tahun" } },
  ];
  /** how far a tag's counter has rolled (0..1 over 1.0 s, B28 text recipe) */
  const roll = (g: Tag, t: number) => ease((t - g.from) / 1.0);
  /** the phones light up in a wave over the iphone beat (0..1), and go dark again before the next beat */
  const lit = (t: number) => ease((t - m.iphone - 1.6) / 3.2) * (1 - ease((t - m.motor + 0.4) / 0.4));
  /** the envelopes on the counter: how many of the 12 have landed, and how visible the stack is (it leaves before the loop-back) */
  const envelopes = (t: number) => ({ n: Math.max(0, Math.min(ENV.n, Math.floor((t - m.gaji - 2.2) / 0.3) + 1)), a: t < m.gaji + 2.2 ? 0 : 1 - ease((t - m.tips - 0.2) / 0.6) });
  /** the calendar: the flip of the top sheet (0..1, a sawtooth while the hari beat counts) */
  const flipping = (t: number) => t >= m.hari + 1.4 && t < m.hari + 4.2;
  const flip = (t: number) => (flipping(t) ? ((t - m.hari - 1.4) * 5) % 1 : 0);
  const lw = (t: number) => Math.min(1, Math.max(0, (t - outro) / 0.5));
  return {
    m, total, keys, starts, tags, roll, lit, envelopes, flip, flipping,
    loopWeight: lw,                                                // 0 at the start, 1 in the loop-back: the scene is the first beat's again at the end (the loop)
    cam: (t: number): Cam2 => cam2At(keys, t),
    tops: [] as { b: number; headline?: string }[],
  };
}

/** The hero's box at time t, in the 1080 px frame (x, y, w, h): the pile of money, seen through the hook's own camera (the wide shot, then the push to the main shot). */
const HOOK_KEYS: Key2[] = [{ t: 0, x: 540, y: 1060, zoom: 0.5 }, { t: 1.5, x: 540, y: 1060, zoom: 0.5 }, { t: 2.8, x: 540, y: 1000, zoom: 1.0 }];
export const HERO_BOX_AT = (t: number) => {
  const c = cam2At(HOOK_KEYS, t), x0 = 540 + c.zoom * (PILE.x0 - c.x), x1 = 540 + c.zoom * (PILE.x1 - c.x), y0 = 960 + c.zoom * (PILE.y0 - c.y), y1 = 960 + c.zoom * (PILE.y1 - c.y);
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
};
