/* Syarat jadi anggota DPR ternyata cuma lulus SMA? — the timing, the camera and the places of this video (pure: no React here). A flat 2D drawing (look 2d, B28) in
   its own set, the notice board of a candidate registration office seen from the front (set.json, kind "registration-board-front"): the hero is the SMA diploma pinned
   in the middle of the board; around it, at one scale, hang the sheet of the election law (Pasal 240), an ID card and the Paket C diploma; under the board runs the
   desk with a pile of candidate folders, and at its left end stands a ballot box. One continuous take: every beat is a pan to another place on the board. The sound is sfx.ts.
   Scale (B27.7): 23.57 px = 1 cm (an A4 sheet, 29.7 x 21 cm, is 700 x 495 px). An ID card 8.6 x 5.4 cm = 203 x 127 px, a ballot box 40 x 60 cm = 940 x 1416 px (shown
   whole only in its own beat), a folder seen from its edge 26 x 1.4 cm, a wall clock 30 cm across.
   Shapes drawn in their real form (B27.16): an Indonesian diploma is a landscape sheet with an emblem at the top centre, a photo at the lower left and the signature
   and seal at the lower right; an e-KTP has its photo on the right; the election ballot box is an upright white box, taller than wide, with the slot in its lid and a
   clear window in its front. */
import type { StoryT } from "../../src/schema.ts";
import { cam2At, type Cam2, type Key2 } from "../../src/iso.ts";

export const BOARD = { x0: -760, x1: 1840, y0: 400, y1: 1400 } as const;
export const LAW = { x0: -620, y0: 450, w: 495, h: 700, rowY: 670, pitch: 56, rows: 8, key: 4 } as const;   // key: row "e", the education line
export const KTP = { x0: -60, y0: 1180, w: 203, h: 127 } as const;
export const IJAZAH = { x0: 190, y0: 600, w: 700, h: 495 } as const;
export const PAKET = { x0: 1040, y0: 600, w: 700, h: 495 } as const;
export const DESK_Y = 1500;
export const BOX = { x0: -1900, x1: -960, y0: 84, y1: DESK_Y } as const;
export const FOLDERS = { x0: 1090, w: 620, h: 34, n: 8 } as const;
export const CLOCK = { x: 1560, y: -180, r: 150 } as const;
export const WINDOW = { x0: -500, y0: -300, w: 420, h: 460 } as const;

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
    aturan: at("aturan"), sma: at("sma"), paketc: at("paketc"), serang: at("serang"), fakta: at("fakta"), umur: at("umur"), tips: at("tips"),
  };
  // the camera: the wide shot of the office wall (the diploma in the centre third), the push to the diploma, then every beat is a pan to another place on the board
  // motion-exception: the establishing push goes from zoom 0.5 to 1.0 in 1.3 s (the registered establishing range, B27.8), faster than a beat's push
  const WIDE: Cam2 = { x: 540, y: 760, zoom: 0.5 };
  const MAIN: Cam2 = { x: 540, y: 800, zoom: 1.0 };
  const rowE = LAW.rowY + LAW.key * LAW.pitch + 14;
  const keys: Key2[] = [
    { t: 0, ...WIDE }, { t: 1.5, ...WIDE }, { t: 2.8, ...MAIN },
    { t: m.aturan + 0.1, ...MAIN }, { t: m.aturan + 1.6, x: -372, y: 885, zoom: 1.12 }, { t: m.sma - 0.1, x: -372, y: 885, zoom: 1.18 },
    { t: m.sma + 1.2, x: -372, y: rowE - 60, zoom: 1.55 }, { t: m.sma + 2.7, x: -372, y: rowE - 60, zoom: 1.6 },
    { t: m.sma + 4.3, x: 540, y: 800, zoom: 1.1 }, { t: m.paketc - 0.1, x: 540, y: 800, zoom: 1.16 },
    { t: m.paketc + 1.5, x: 965, y: 800, zoom: 0.68 }, { t: m.paketc + 4.2, x: 965, y: 800, zoom: 0.7 },
    { t: m.paketc + 5.6, x: 1390, y: 800, zoom: 1.05 }, { t: m.serang - 0.1, x: 1390, y: 800, zoom: 1.08 },
    { t: m.serang + 1.5, x: 1390, y: 1080, zoom: 1.0 }, { t: m.fakta - 0.1, x: 1390, y: 1080, zoom: 1.05 },
    { t: m.fakta + 1.5, x: 540, y: 800, zoom: 1.05 }, { t: m.umur - 0.1, x: 540, y: 800, zoom: 1.1 },
    { t: m.umur + 2.0, x: 42, y: 1244, zoom: 2.2 }, { t: m.tips - 0.1, x: 42, y: 1244, zoom: 2.28 },
    { t: m.tips + 2.6, x: -1430, y: 800, zoom: 0.62 }, { t: outro - 0.1, x: -1430, y: 800, zoom: 0.64 },
    { t: outro + 2.6, ...WIDE }, { t: total, ...WIDE },
  ];
  /** the pill labels: a world point on the object (`at`) and the pill's place on the screen (`box`); a `count` rolls up to its number */
  const tags: Tag[] = [
    { id: "uu", from: m.aturan + 1.8, to: m.sma - 0.2, at: [-500, 520], box: [330, 395], text: "UU No. 7 Tahun 2017", fs: 46 },
    { id: "pasal", from: m.aturan + 3.0, to: m.sma - 0.2, at: [-250, 590], box: [770, 395], text: "Pasal 240", fs: 46 },
    { id: "daftar", from: m.aturan + 4.8, to: m.sma - 0.2, at: [-372, 1100], box: [540, 1440], text: "daftar syarat calon", fs: 46 },
    { id: "rendah", from: m.sma + 1.5, to: m.sma + 2.8, at: [-372, rowE + 30], box: [540, 1250], text: "paling rendah tamat SMA", fs: 46 },
    { id: "jenis", from: m.sma + 4.9, to: m.paketc - 0.2, at: [540, 640], box: [540, 560], text: "SMA, MA, SMK", fs: 56 },
    { id: "sederajat", from: m.sma + 6.3, to: m.paketc - 0.2, at: [540, 1080], box: [540, 1420], text: "atau yang sederajat", fs: 46 },
    { id: "paket", from: m.paketc + 2.0, to: m.paketc + 4.0, at: [1390, 640], box: [760, 640], text: "Paket C", fs: 56 },
    { id: "setara", from: m.paketc + 3.0, to: m.paketc + 4.0, at: [965, 900], box: [540, 1300], text: "setara SMA", fs: 60 },
    { id: "nonformal", from: m.paketc + 5.9, to: m.serang - 0.2, at: [1390, 1060], box: [540, 1420], text: "jalur nonformal", fs: 46 },
    { id: "kpu", from: m.serang + 2.0, to: m.fakta - 0.2, at: [1390, 1080], box: [420, 1040], text: "KPU Kabupaten Serang", fs: 46 },
    { id: "dprd", from: m.serang + 4.4, to: m.fakta - 0.2, at: [1400, 1420], box: [540, 1440], text: "calon anggota DPRD", fs: 46 },
    { id: "sarjana", from: m.fakta + 3.2, to: m.umur - 0.2, at: [540, 640], box: [540, 470], text: "tanpa wajib sarjana", fs: 46 },
    { id: "usia", from: m.umur + 2.1, to: m.tips - 0.2, at: [42, 1190], box: [540, 620], text: "21 tahun", fs: 64, count: { to: 21, unit: "tahun" } },
    { id: "bahasa", from: m.umur + 3.9, to: m.tips - 0.2, at: [42, 1300], box: [540, 1290], text: "bahasa Indonesia", fs: 46 },
  ];
  /** how far a tag's counter has rolled (0..1 over 1.0 s, B28 text recipe) */
  const roll = (g: Tag, t: number) => ease((t - g.from) / 1.0);
  /** the ticks on the law sheet: how many of the 8 rows are ticked, and how visible they are (they leave before the camera comes back) */
  const ticks = (t: number) => ({ n: Math.max(0, Math.min(LAW.rows, Math.floor((t - m.aturan - 1.9) / 0.32) + 1)), a: t < m.aturan + 1.9 ? 0 : 1 - ease((t - m.sma - 3.2) / 0.5) });
  /** the highlighter over the education row (0..1 sweeps in, then fades as the camera leaves) */
  const mark = (t: number) => ease((t - m.sma - 0.9) / 0.8) * (1 - ease((t - m.sma - 3.4) / 0.6));
  /** the folders on the desk: how many of the 8 have landed, and how visible the pile is (it leaves before the loop-back) */
  const folders = (t: number) => ({ n: Math.max(0, Math.min(FOLDERS.n, Math.floor((t - m.serang - 1.6) / 0.4) + 1)), a: t < m.serang + 1.6 ? 0 : 1 - ease((t - m.fakta - 0.2) / 0.6) });
  /** the ballot that falls into the box's slot in the tips beat: 0..1 per drop, three drops */
  const DROPS = [2.9, 4.4, 5.9];
  const drop = (t: number) => { const d = DROPS.map((s) => (t - m.tips - s) / 0.7).find((k) => k >= 0 && k < 1); return d === undefined ? -1 : d; };
  const lw = (t: number) => Math.min(1, Math.max(0, (t - outro) / 0.5));
  return {
    m, total, keys, starts, tags, roll, ticks, mark, folders, drop, drops: DROPS,
    loopWeight: lw,                                                // 0 at the start, 1 in the loop-back: the scene is the first beat's again at the end (the loop)
    cam: (t: number): Cam2 => cam2At(keys, t),
    tops: [] as { b: number; headline?: string }[],
  };
}

/** The hero's box at time t, in the 1080 px frame (x, y, w, h): the SMA diploma, seen through the hook's own camera (the wide shot, then the push to the main shot). */
const HOOK_KEYS: Key2[] = [{ t: 0, x: 540, y: 760, zoom: 0.5 }, { t: 1.5, x: 540, y: 760, zoom: 0.5 }, { t: 2.8, x: 540, y: 800, zoom: 1.0 }];
export const HERO_BOX_AT = (t: number) => {
  const c = cam2At(HOOK_KEYS, t), x0 = 540 + c.zoom * (IJAZAH.x0 - c.x), y0 = 960 + c.zoom * (IJAZAH.y0 - c.y);
  return { x: x0, y: y0, w: c.zoom * IJAZAH.w, h: c.zoom * IJAZAH.h };
};
