/* Kalau wakil presiden mundur, siapa penggantinya menurut UUD? — the timing, the camera and the places of this video (pure: no React here). A flat 2D drawing
   (look 2d, B28) in its own set, a state hall seen from the front (set.json, kind "state-hall-front"): the hero is the pair of high-backed chairs on the dais, the
   right one (the vice president's) empty and marked; around it stand the things the rule speaks of: a wall calendar of 60 days, a table with a ballot box and two
   envelopes, a table with the constitution on a stand, a checklist and a balance scale. No people. One continuous take: every beat is a pan to another place.
   Scale (B27.7): 4 px = 1 cm. A high-backed chair 65 x 140 cm = 260 x 560 px, the dais 20 cm = 80 px, a table 85 cm = 340 px, the ballot box 50 cm = 200 px,
   an envelope 27 x 20 cm, the ceremonial book on its stand 42 x 55 cm = 170 x 220 px, the scale 75 cm = 300 px, the wall calendar 100 x 130 cm.
   Shapes in their real form (B27.16): a balance scale is a post with a beam on a pivot and two pans that hang level whatever the beam does; a ballot box is a box
   with a slot in its lid; a high-backed chair seen from the front is a tall back, a seat cushion, two armrests and two front legs. */
import type { StoryT } from "../../src/schema.ts";
import { cam2At, type Cam2, type Key2 } from "../../src/iso.ts";

export const FLOOR_Y = 1600;
export const DAIS = { x0: 60, x1: 1020, y: 1520 } as const;
export const CHAIR = { w: 260, h: 560, pres: 230, vp: 590 } as const;                       // pres, vp: the left edge of each chair
export const CHAIRS = { x0: CHAIR.pres, x1: CHAIR.vp + CHAIR.w, y0: DAIS.y - CHAIR.h, y1: DAIS.y } as const;
export const PLAQUE = { y: 840, w: 300, h: 70 } as const;
export const CAL = { x0: -660, y0: 560, w: 400, h: 520, cols: 10, rows: 6 } as const;
export const TABLE = { x0: 1240, x1: 1800, y: 1260 } as const;
export const BOX = { x0: 1560, y0: 1060, w: 200, h: 200 } as const;
export const ENV = { xs: [1290, 1420], y0: 1180, w: 110, h: 80 } as const;
export const TABLE2 = { x0: 2060, x1: 3220, y: 1260 } as const;
export const BOOK = { x0: 2200, y0: 1040, w: 170, h: 220 } as const;
export const LIST = { x0: 2420, y0: 950, w: 170, h: 200 } as const;
export const SCALE = { x: 2900, top: 960, beam: 180, drop: 110 } as const;                  // beam: half its length; drop: how far a pan hangs under the beam end

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
    kosong: at("kosong"), enam: at("enam"), dua: at("dua"), syarat: at("syarat"), periode: at("periode"), berhenti: at("berhenti"), tips: at("tips"),
  };
  // the camera: the wide shot of the hall (the chairs in the centre third), the push to the chairs, then every beat is a pan to another place; the outro returns to the wide shot
  // motion-exception: the establishing push goes from zoom 0.5 to 1.1 in 1.3 s (the registered establishing range, B27.8), faster than a beat's push
  const WIDE: Cam2 = { x: 540, y: 1060, zoom: 0.5 };
  const MAIN: Cam2 = { x: 540, y: 1180, zoom: 1.1 };
  const keys: Key2[] = [
    { t: 0, ...WIDE }, { t: 1.5, ...WIDE }, { t: 2.8, ...MAIN },
    { t: m.kosong + 0.1, ...MAIN }, { t: m.kosong + 1.6, x: 600, y: 1180, zoom: 1.3 }, { t: m.enam - 0.1, x: 605, y: 1180, zoom: 1.35 },
    { t: m.enam + 1.8, x: -460, y: 800, zoom: 1.6 }, { t: m.dua - 0.1, x: -460, y: 805, zoom: 1.66 },
    { t: m.dua + 2.6, x: 1520, y: 1170, zoom: 1.45 }, { t: m.syarat - 0.1, x: 1530, y: 1170, zoom: 1.5 },
    { t: m.syarat + 1.8, x: 2350, y: 1130, zoom: 1.95 }, { t: m.periode - 0.1, x: 2355, y: 1130, zoom: 2.0 },
    { t: m.periode + 1.6, x: 2900, y: 1080, zoom: 1.7 }, { t: m.berhenti - 0.1, x: 2900, y: 1080, zoom: 1.75 },
    { t: m.berhenti + 2.8, x: 720, y: 1200, zoom: 1.3 }, { t: m.tips - 0.1, x: 715, y: 1200, zoom: 1.34 },
    { t: m.tips + 1.1, ...MAIN }, { t: outro - 0.1, x: 540, y: 1180, zoom: 1.13 },
    { t: outro + 2.6, ...WIDE }, { t: total, ...WIDE },
  ];
  /** the pill labels: a world point on the object (`at`) and the pill's place on the screen (`box`); a `count` rolls up to its number */
  const tags: Tag[] = [
    { id: "ks-pres", from: m.kosong + 1.9, to: m.enam - 0.2, at: [360, 850], box: [310, 470], text: "Presiden tetap menjabat", fs: 42 },
    { id: "ks-vp", from: m.kosong + 4.0, to: m.enam - 0.2, at: [720, 1425], box: [600, 1470], text: "kekosongan Wakil Presiden", fs: 44 },
    { id: "en-pasal", from: m.enam + 1.9, to: m.dua - 0.2, at: [-630, 585], box: [330, 480], text: "Pasal 8 ayat (2)", fs: 46 },
    { id: "en-n", from: m.enam + 3.2, to: m.dua - 0.2, at: [-460, 1070], box: [600, 1470], text: "60 hari", fs: 64, count: { to: 60, unit: "hari" } },
    { id: "du-calon", from: m.dua + 3.0, to: m.syarat - 0.2, at: [1400, 1190], box: [340, 560], text: "2 calon dari Presiden", fs: 44 },
    { id: "du-mpr", from: m.dua + 5.4, to: m.syarat - 0.2, at: [1660, 1070], box: [720, 700], text: "MPR memilih 1", fs: 48 },
    { id: "sy-pasal", from: m.syarat + 1.9, to: m.periode - 0.2, at: [2285, 1060], box: [300, 520], text: "UUD Pasal 6", fs: 46 },
    { id: "sy-uu", from: m.syarat + 6.0, to: m.periode - 0.2, at: [2500, 1240], box: [600, 1470], text: "syarat lain: undang-undang", fs: 42 },
    { id: "pr-pasal", from: m.periode + 1.7, to: m.berhenti - 0.2, at: [2900, 975], box: [540, 500], text: "Pasal 7: jabatan yang sama", fs: 44 },
    { id: "pr-a", from: m.periode + 3.6, to: m.berhenti - 0.2, at: [2725, 1085], box: [350, 1370], text: "tak ada larangan tertulis", fs: 40 },
    { id: "pr-b", from: m.periode + 5.6, to: m.berhenti - 0.2, at: [3075, 1085], box: [690, 1475], text: "wapres bisa naik jadi presiden", fs: 40 },
    { id: "bh-dpr", from: m.berhenti + 3.0, to: m.tips - 0.2, at: [850, 1040], box: [850, 660], text: "1. usul DPR", fs: 44 },
    { id: "bh-mk", from: m.berhenti + 3.8, to: m.tips - 0.2, at: [850, 1160], box: [850, 820], text: "2. diperiksa MK", fs: 44 },
    { id: "bh-mpr", from: m.berhenti + 4.6, to: m.tips - 0.2, at: [850, 1280], box: [850, 980], text: "3. diputus MPR", fs: 44 },
  ];
  /** how far a tag's counter has rolled (0..1, B28 text recipe) */
  const roll = (g: Tag, t: number) => ease((t - g.from) / 1.0);
  const gone = (t: number) => 1 - ease((t - m.tips - 0.2) / 0.6);            // the props of the beats leave while the camera is on its way back (the loop starts clean)
  /** the calendar: how many of the 60 day cells are crossed */
  const days = (t: number) => Math.round(60 * ease((t - m.enam - 2.0) / 3.4) * gone(t));
  /** the "KOSONG" card on the empty chair (0..1) */
  const card = (t: number) => ease((t - m.kosong - 1.8) / 0.35) * (1 - ease((t - outro + 0.4) / 0.4));
  /** the two envelopes: each one's entry (0..1), and the flight of the chosen one into the box (0..1) */
  const envelopes = (t: number) => ({ a: [ease((t - m.dua - 2.8) / 0.4), ease((t - m.dua - 3.3) / 0.4)].map((v) => v * gone(t)), fly: ease((t - m.dua - 5.0) / 0.8) });
  /** the checklist: how far each of its three ticks has come (0..1) */
  const ticks = (t: number) => [2.4, 3.6, 4.8].map((d) => ease((t - m.syarat - d) / 0.3) * gone(t));
  /** the scale's beam, in degrees: it leans to one view, then the other, then hangs level (nobody has decided) */
  const tilt = (t: number) => {
    const u = t - m.periode;
    return -9 * ease((u - 3.4) / 0.6) * (1 - ease((u - 5.3) / 0.7)) + 9 * ease((u - 5.3) / 0.7) * (1 - ease((u - 7.2) / 0.8));
  };
  const lw = (t: number) => Math.min(1, Math.max(0, (t - outro) / 0.5));
  return {
    m, total, keys, starts, tags, roll, days, card, envelopes, ticks, tilt,
    loopWeight: lw,                                                // 0 at the start, 1 in the loop-back: the scene is the first beat's again at the end (the loop)
    cam: (t: number): Cam2 => cam2At(keys, t),
    tops: [] as { b: number; headline?: string }[],
  };
}

/** The hero's box at time t, in the 1080 px frame (x, y, w, h): the pair of chairs, seen through the hook's own camera (the wide shot, then the push to the main shot). */
const HOOK_KEYS: Key2[] = [{ t: 0, x: 540, y: 1060, zoom: 0.5 }, { t: 1.5, x: 540, y: 1060, zoom: 0.5 }, { t: 2.8, x: 540, y: 1180, zoom: 1.1 }];
export const HERO_BOX_AT = (t: number) => {
  const c = cam2At(HOOK_KEYS, t), x0 = 540 + c.zoom * (CHAIRS.x0 - c.x), x1 = 540 + c.zoom * (CHAIRS.x1 - c.x), y0 = 960 + c.zoom * (CHAIRS.y0 - c.y), y1 = 960 + c.zoom * (CHAIRS.y1 - c.y);
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
};
