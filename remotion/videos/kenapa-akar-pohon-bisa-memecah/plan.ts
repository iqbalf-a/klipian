/* Kenapa akar pohon bisa memecahkan aspal? — the plan (pure: no React). The set is an underground cut: a road beside a tree, cut open along the face that
   looks to the viewer. The root is the hero: a path in the cut face whose tip grows (cari, ujung), whose width grows (tebal), and whose width lifts the
   asphalt (dorong). Lift is DERIVED from the width (a root thicker than the gap under the gravel presses the layers up), so the picture cannot show a root
   that lifts without being thick. Every spoken fact comes from story.json; labels are the story's own texts. */
import type { BeatT, StoryT } from "../../src/schema.ts";
import { cam2At, type Key2, type P2 } from "../../src/iso.ts";

export const U = 80;                                   // px per world unit (one unit is about half a metre: the road is 7 m wide)
export const O: P2 = [540, 1020];                      // the screen point of world (0, 0, 0)
export const ROAD_X0 = -2.3;                           // the road's edge (the curb stands at -2.6 to -2.3)
export const GRAVEL_BOTTOM = -0.9;                     // the root runs in the gravel layer; asphalt is 0.25 thick, gravel 0.65 (a unit is about 25 cm)
export const ASPHALT_T = 0.25;
export const ROOT_Z = -0.55;                            // the root's axis
export const ROOT_PATH: P2[] = [[-4.6, -0.05], [-4.35, -0.4], [-3.6, -0.55], [-2.4, -0.57], [-1, -0.55]];   // from the trunk's foot to where the tip starts (cut-face x, z)
export const DROPS: P2[] = [[2.3, -1.95], [3.1, -2.45], [2.7, -1.55], [3.6, -2.0]];       // water the root is heading for
export const BUBBLES: P2[] = [[2.0, -2.5], [3.3, -1.7], [3.9, -2.7]];                     // oxygen

const ease = (k: number) => (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const seg = (t: number, a: number, b: number) => ease(clamp01((t - a) / (b - a)));
/** The root's width at cut-face x: wider near the trunk, tapering to the tip. */
export const widthAt = (x: number, w: number): number => 0.1 + (w - 0.1) * (1 - 0.5 * clamp01((x + 1) / 6)) + 0.28 * clamp01((-1 - x) / 3.6);
/** How far the road is pressed up at x: exactly what the root's top goes above the layers over it (its axis -0.55, the asphalt's underside at -0.25), only where the root has reached. */
export function liftAt(x: number, w: number, tip: number): number {
  return Math.max(0, widthAt(x, w) / 2 + ROOT_Z + ASPHALT_T) * clamp01((tip - x) / 0.9 + 0.1);
}
const mix = (a: number, b: number, k: number) => a + (b - a) * k;

export function makePlan(story: StoryT) {
  const starts = story.beats.map((_, i) => story.beats.slice(0, i).reduce((a, b) => a + b.dur, 0));
  const total = story.beats.reduce((a, b) => a + b.dur, 0);
  const at = (id: string) => { const i = story.beats.findIndex((b) => b.id === id); return { a: starts[i], b: starts[i] + story.beats[i].dur }; };
  const sting = starts[1] ?? 0, outro = starts.at(-1) ?? total;
  const B = { cari: at("cari"), ujung: at("ujung"), tebal: at("tebal"), dorong: at("dorong"), hasil: at("hasil"), fakta: at("fakta"), tips: at("tips") };
  const m = { sting, stingEnd: sting + (story.beats[1]?.dur ?? 1), react: NaN, outro, end: total, push: 1.5, ...Object.fromEntries(Object.entries(B).map(([k, v]) => [k, v.a])) as Record<keyof typeof B, number> };

  /** The state of the world at video time t: the tip's x, the root's width, how far the crack is open. At the outro it eases back to the t = 0 state (the loop). */
  const raw = (t: number) => {
    const tip = t < B.ujung.a ? mix(-0.6, 1.9, seg(t, B.cari.a + 0.6, B.cari.b)) : mix(1.9, 4.6, seg(t, B.ujung.a, B.ujung.b - 0.4));
    const w = 0.25 + 0.4 * seg(t, B.tebal.a + 0.4, B.tebal.b) + 0.75 * seg(t, B.dorong.a, B.dorong.b - 0.5);       // 0.25 → 0.65 (fills the gravel layer) → 1.4 (about 35 cm)
    return { tip, w };
  };
  const state = (t: number) => {
    const a = raw(t), z = raw(0), k = ease(clamp01((t - outro) / (story.beats.at(-1)?.dur ?? 4)));
    const tip = mix(a.tip, z.tip, k), w = mix(a.w, z.w, k);
    return { tip, w, crack: clamp01((liftAt(-0.5, w, tip) - 0.12) / 0.12) };
  };
  // the camera: keys in seconds INTO THE BEAT (the scene reads beat-local time). Focus is a screen point of the scene at rest; the hook opens wide and pushes (B27.8).
  const F = (t: number, x: number, y: number, zoom: number): Key2 => ({ t, x, y, zoom });
  const cams: Record<string, Key2[]> = {
    hook: [F(0, 470, 1000, 0.7), F(1.5, 470, 1000, 0.7), F(2.9, 600, 1050, 1.0)],
    sting: [F(0, 600, 1050, 1.0), F(1, 600, 1050, 1.04)],
    cari: [F(0, 600, 1050, 1.0), F(7, 700, 1130, 1.12)],
    ujung: [F(0, 700, 1130, 1.12), F(1.6, 790, 1180, 1.28), F(7, 830, 1195, 1.4)],
    tebal: [F(0, 830, 1195, 1.4), F(1.4, 640, 1150, 1.22), F(8, 650, 1150, 1.3)],
    dorong: [F(0, 650, 1150, 1.3), F(1.8, 700, 1080, 1.4), F(8, 720, 1075, 1.5)],
    hasil: [F(0, 720, 1075, 1.5), F(1.6, 620, 1040, 1.05), F(7, 620, 1040, 1.1)],
    fakta: [F(0, 620, 1040, 1.1), F(1.4, 300, 900, 1.25), F(6, 280, 880, 1.32)],
    tips: [F(0, 280, 880, 1.32), F(2, 620, 1010, 0.95), F(9, 620, 1010, 0.9)],
    outro: [F(0, 620, 1010, 0.9), F(4, 470, 1000, 0.7)],
  };
  const camAt = (id: string, t: number) => cam2At(cams[id] ?? cams.hook, t);

  // top texts: the kicker is the channel's chrome, the headline is the beat's own text
  const KICKER: Record<string, string> = { hook: "TANYA", cari: "LANGKAH 1", ujung: "LANGKAH 2", tebal: "LANGKAH 3", dorong: "LANGKAH 4", hasil: "JAWABANNYA", fakta: "FAKTA", tips: "TIPS" };
  const top = (b: BeatT) => (b.kind === "sting" || b.kind === "outro" ? null : { kicker: KICKER[b.id] ?? "INTIP", headline: b.text });

  /** Labels (story texts) per beat: seconds into the beat, a point on the cut face (cut-face x, z) and where the text sits on the screen at rest. */
  const labels: Record<string, { text: string; from: number; to: number; at: P2; tx: number; ty: number }[]> = {
    cari: [{ text: "air dan oksigen", from: 1.2, to: 6.6, at: [2.8, -2.0], tx: 760, ty: 1410 }],
    ujung: [{ text: "ujung muda", from: 1.6, to: 6.6, at: [4.4, -1.0], tx: 620, ty: 1440 }],
    tebal: [{ text: "kayu baru", from: 2.2, to: 7.5, at: [-0.2, -1.0], tx: 420, ty: 1460 }],
    dorong: [{ text: "jalan terangkat", from: 2.0, to: 7.6, at: [0.8, 0.2], tx: 500, ty: 560 }],
  };
  const tops = story.beats.flatMap((b, i) => { const x = top(b); return x ? [{ a: starts[i], b: starts[i] + b.dur, kicker: x.kicker, headline: x.headline }] : []; });
  const labelList = Object.entries(labels).flatMap(([id, ls]) => ls.map((l) => ({ ...l, id, from: at(id).a + l.from, to: at(id).a + l.to })));
  return { m, total, starts, B, state, cams, camAt, top, tops, labelsBy: labels, labels: labelList, loopWeight: (t: number) => ease(clamp01((t - outro) / 0.5)) };
}

/** The hero's box at time t, in the 1080 px frame: the root and the road above it (x, y, w, h); in the wide shot it is the middle of the picture. */
export const HERO_BOX_AT = (t: number) => (t < 1.5 ? { x: 400, y: 960, w: 400, h: 120 } : { x: 190, y: 900, w: 700, h: 200 });
