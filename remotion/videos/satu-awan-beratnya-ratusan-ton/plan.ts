/* Satu awan beratnya ratusan ton — the timing of this video (pure: no React here). The hook, the "Intip yuk!" sting, the explain beats, the result and the
   loop-back outro, all read from the beats of the story. One continuous take on the nature stage: a white cumulus cloud over the land, water droplets in and
   around it, a row of elephants as the weight, the camera moving beat by beat. Colours from src/tokens.ts; easings from src/motionLanguage.ts. */
import type { StoryT } from "../../src/schema.ts";
import { FPS, sequencePlan } from "../../src/timeline.ts";
import { cam2At, isoAt, type Cam2, type Key2, type P2, type P3 } from "../../src/iso.ts";
import { CLOUD_GREY, LAND_TOP } from "../../src/natureGeometry.ts";

export const stageDrop = 100;
export const OUT = { u: 160, o: [485, 1044 + stageDrop] as P2 };
export const CLOUD = { cx: CLOUD_GREY.cx, cy: CLOUD_GREY.cy, cz: CLOUD_GREY.cz, grow: 1.25 };
const out = (p: P3): P2 => isoAt(p, OUT.u, OUT.o);
/** The establishing shot (B27.8, B27.10): the cloud in the middle third inside SAFE, the diorama running past both sides and the bottom. */
export const WIDE = { x: 610, y: 1000, zoom: 0.46 };
export const SPOT = { x: 540, y: 640, r: 200 };
export const spotK = (zoom: number): number => { const k = Math.max(0, Math.min(1, (zoom - 1.12) / 0.5)); return 1 - k * k * (3 - 2 * k); };
export const FAR = {
  hills: { x0: -900, x1: 1900, crest: 640, base: 1500 },
  clouds03: [{ o: [150, 415] as P2, u: 60, grow: 0.7 }, { o: [900, 470] as P2, u: 55, grow: 0.6 }],
  clouds06: [{ o: [-88, 346] as P2, u: 100, grow: 0.87 }, { o: [1236, 410] as P2, u: 90, grow: 0.8 }],
};
export const CLOUD_PT = out([CLOUD.cx, CLOUD.cy, CLOUD.cz]);
export const LAND_PT = out([1.9, 0.3, LAND_TOP]);

const ramp = (t: number, a: number, d: number) => Math.max(0, Math.min(1, (t - a) / d));
const sm = (k: number) => k * k * (3 - 2 * k);
export type Top = { a: number; b: number; kicker?: string; headline: string };
const KICKER: Record<string, string> = { normal: "CARA HITUNG", loose: "CARA HITUNG", result: "JADI", tips: "TIPS" };
export type Plan = ReturnType<typeof makePlan>;

export function makePlan(story: StoryT) {
  const seq = sequencePlan(story);
  const B: Record<string, { a: number; b: number; beat: StoryT["beats"][number]; index: number }> = {};
  seq.forEach((p, i) => { B[p.beat.id] = { a: p.from / FPS, b: (p.from + p.beatFrames) / FPS, beat: p.beat, index: i }; });
  const total = seq.reduce((n, p) => n + p.beatFrames, 0) / FPS;
  const beat = (id: string) => B[id] ?? { a: 0, b: total, beat: story.beats[0], index: 0 };
  const m = {
    sting: beat("intip").a, stingEnd: beat("intip").b, react: NaN,
    ukuran: beat("ukuran").a, ruler: beat("ukuran").a + 1.2,
    isi: beat("isi").a, drops: beat("isi").a + 0.8,
    hitung: beat("hitung").a, many: beat("hitung").a + 2.5, times: beat("hitung").a + 4.5,
    gajah: beat("gajah").a, eleFrom: beat("gajah").a + 1.8,
    melayang: beat("melayang").a, air: beat("melayang").a + 1.5,
    kecil: beat("kecil").a, hasil: beat("hasil").a,
    outro: beat("outro").a, end: total,
  } as Record<string, number>;

  const C = CLOUD_PT, L0 = LAND_PT;
  const outKeys: Key2[] = [
    // motion-exception: the establishing shot is a push from zoom 0.46 to 1.0 in 1.2 s, faster than a beat's push (4-8 s); it is the one wide shot of the video and the loop-back eases home to it
    { t: 0, ...WIDE },
    { t: 1.5, ...WIDE },
    { t: 2.7, x: 590, y: 985, zoom: 1.0 },
    { t: m.sting - 0.3, x: 590, y: 980, zoom: 1.0 },
    { t: m.sting + 0.2, x: 590, y: 835, zoom: 1.0 },
    { t: m.stingEnd + 0.6, x: 590, y: 960, zoom: 1.0 },
    { t: m.ukuran + 6.5, x: 590, y: 960, zoom: 0.9 },                 // ukuran: a slow pull-back to see the whole cloud with its width marked
    { t: m.isi + 1.0, x: C[0], y: C[1], zoom: 1.4 },                  // isi: a push into the cloud's droplets
    { t: m.hitung - 0.01, x: C[0], y: C[1] + 20, zoom: 1.5 },
    { t: m.hitung + 6, x: C[0], y: C[1] + 20, zoom: 1.2 },            // hitung: the droplets multiply, the camera drifts back
    { t: m.gajah + 1.2, x: L0[0] - 40, y: L0[1] - 230, zoom: 0.92 },    // gajah: down to the land, the row of elephants
    { t: m.gajah + 7.6, x: L0[0] - 40, y: L0[1] - 250, zoom: 1.0 },
    { t: m.melayang + 1.2, x: C[0], y: C[1] + 40, zoom: 0.8 },        // melayang: a pan up to the cloud, air rising under it
    { t: m.melayang + 7, x: C[0], y: C[1] + 40, zoom: 0.92 },
    { t: m.kecil + 1.0, x: C[0], y: C[1], zoom: 1.5 },                // kecil: a push to the tiny droplets
    { t: m.hasil, x: C[0], y: C[1], zoom: 1.4 },
    { t: m.hasil + 3, x: 590, y: 900, zoom: 0.95 },
    { t: m.outro, x: 590, y: 880, zoom: 0.8 },
    { t: total - 0.2, ...WIDE },
  ];
  const outCam = (t: number): Cam2 => cam2At(outKeys, t);

  const LOOP_EASE = Math.min(1.6, total - m.outro);
  const loopWeight = (t: number) => sm(ramp(t, m.outro, LOOP_EASE));
  const phase = (t: number) => (t / total) % 1;
  /** how many droplets show (0..1): they come in at "isi", multiply at "hitung", stay through "kecil", go with the loop-back */
  const dropK = (t: number) => (ramp(t, m.drops, 1.2) * 0.5 + ramp(t, m.many, 2.0) * 0.5) * (1 - ramp(t, m.gajah + 0.2, 0.6)) + ramp(t, m.kecil, 1.0) * (1 - ramp(t, m.hasil + 1.5, 1.0)) * 1;
  const rulerK = (t: number) => sm(ramp(t, m.ruler, 0.8)) * (1 - sm(ramp(t, m.isi - 0.6, 0.5)));
  const eleN = (t: number) => Math.floor(ramp(t, m.eleFrom, 4.2) * 6 + 0.0001);
  const eleFade = (t: number) => 1 - sm(ramp(t, m.melayang - 0.2, 0.7));
  const airK = (t: number) => sm(ramp(t, m.air, 0.8)) * (1 - sm(ramp(t, m.kecil - 0.3, 0.6)));
  const hundredK = (t: number) => sm(ramp(t, m.gajah + 1.0, 0.5)) * (1 - sm(ramp(t, m.melayang - 0.2, 0.5)));

  const tops: Top[] = story.beats.filter((b) => b.kind !== "sting" && b.kind !== "outro").map((b) => ({ a: beat(b.id).a, b: beat(b.id).b, kicker: b.kicker ?? (b.kind === "hook" ? story.question.toUpperCase() : KICKER[b.kind]), headline: b.headline ?? b.text }));
  const labels: { from: number; to: number; text: string }[] = [];
  const STING = { mx: 330, my: 400, mw: 200, px: 650, py: 400, fs: 52, pillW: 300 };
  return { B, beat, total, m, outKeys, outCam, loopWeight, phase, dropK, rulerK, eleN, eleFade, airK, hundredK, tops, labels, STING };
}

/** The hero's box at time t, in the 1080 px frame (x, y, w, h): the cloud, from the camera. */
export const HERO_BOX_AT = (_t: number) => ({ x: 540, y: 960, w: 0, h: 0 });
