/* Kenapa baterai HP cepat habis saat dingin? — the timing of this video (pure: no React here). The formula is DESIGN.md section 0b: the hook, the "Intip yuk!" sting right after
   it, the explain beats, the result, the tips and the loop-back outro. Everything is read from the beats and the words of the narration.
   One set: a snowy park, a bench with a phone on it, pines and a lamp post (B27). The explain beats cut in to INSERTS (B25): one idea each, in a circle that opens from the phone.
   motion-exception: the hook's establishing push is 1.4 s from zoom 0.5 to 1.3 (the registered establishing push, B27.8). */
import type { BeatT, StoryT } from "../../src/schema.ts";
import { FPS, sequencePlan } from "../../src/timeline.ts";
import { wordsOfBeat } from "../../src/captions.ts";
import { cam2At, isoAt, toScreen, type Cam2, type Key2, type P2 } from "../../src/iso.ts";
import { PHONE } from "../../src/bedroomGeometry.ts";

export const U = 150;
export const PHONE_SCALE = 1.8;
const PH3: [number, number, number] = [PHONE.c[0], PHONE.c[1], PHONE.c[2] + PHONE.h];
const PH_AT: P2 = [540, 1010];                                             // the phone's centre in the world px at rest (the wide shot is centred on it)
const o0 = isoAt(PH3, U, [0, 0]);
export const O: P2 = [PH_AT[0] - o0[0], PH_AT[1] - o0[1]];
export const PHONE_PT: P2 = PH_AT;
/** The bench top (world units): the phone lies on it. */
export const BENCH = { a: [0.1, -0.7, 0.3] as [number, number, number], b: [3.9, 2.7, PHONE.c[2]] as [number, number, number] };

const norm = (w: string) => w.toLowerCase().normalize("NFD").replace(/[^\p{L}\p{N}]/gu, "");
const ramp = (t: number, a: number, d: number) => Math.max(0, Math.min(1, (t - a) / d));
const sm = (k: number) => k * k * (3 - 2 * k);
const mix = (a: number, b: number, k: number) => a + (b - a) * k;

export type Top = { a: number; b: number; kicker?: string; headline: string };
export type Plan = ReturnType<typeof makePlan>;
export type InsertKind = "ions" | "cold" | "volt" | "plate";
export type Insert = { id: string; kind: InsertKind; from: number; to: number };

export function makePlan(story: StoryT) {
  const seq = sequencePlan(story);
  const B: Record<string, { a: number; b: number; beat: BeatT }> = {};
  seq.forEach((p) => { B[p.beat.id] = { a: p.from / FPS, b: (p.from + p.beatFrames) / FPS, beat: p.beat }; });
  const total = seq.reduce((n, p) => n + p.beatFrames, 0) / FPS;
  const beat = (id: string) => B[id] ?? { a: 0, b: total, beat: story.beats[0] };
  /** The video second when a word is spoken (the nth word starting with `prefix`), or a share of the beat if the story no longer has it. */
  const w = (id: string, prefix: string, nth = 0, share = 0.5): number => {
    const bb = beat(id), found = wordsOfBeat(bb.beat).filter((x) => norm(x.w).startsWith(norm(prefix)))[nth];
    return Math.round((bb.a + (found ? found.a : share * bb.beat.dur)) * FPS) / FPS;
  };
  const items = (id: string) => beat(id).beat.scene.items;
  const labelOf = (id: string, nth = 0) => items(id).flatMap((i) => (i.type === "label" ? [i] : []))[nth];

  const m = {
    push: 1.5, pushEnd: 2.9, sting: beat("intip").a, stingEnd: beat("intip").b,
    kerja: beat("kerja").a, dalam: beat("dalam").a, tegangan: beat("tegangan").a, cas: beat("cas").a, hasil: beat("hasil").a, tips: beat("tips").a,
    tip1: w("tips", "satu", 0, 0.08), tip2: w("tips", "dua", 0, 0.5), react: w("hasil", "boros", 0, 0.5) - 0.2, outro: beat("outro").a, end: total,
  } as Record<string, number>;
  m.drain = 0.5;

  // ---------------------------------------------------------------- the camera on the stage
  const keys: Key2[] = [
    { t: 0, x: 540, y: 960, zoom: 0.5 },                       // the opening wide shot: the loop-back returns here
    { t: m.push, x: 540, y: 960, zoom: 0.5 },
    { t: m.pushEnd, x: 540, y: 1000, zoom: 1.6 },              // the establishing push to the main shot
    { t: m.stingEnd + 0.6, x: 540, y: 1000, zoom: 1.65 },
    { t: m.hasil, x: 540, y: 1000, zoom: 1.75 },
    { t: m.hasil + 5, x: 540, y: 1000, zoom: 1.7 },
    { t: m.tips + 0.5, x: 540, y: 1040, zoom: 1.0 },           // the stage drops to make room for the tip cards
    { t: m.outro, x: 540, y: 1040, zoom: 1.0 },
    { t: total - 0.2, x: 540, y: 960, zoom: 0.5 },             // home: the last frame's camera is the first one's
  ];
  const cam = (t: number): Cam2 => cam2At(keys, t);

  // ---------------------------------------------------------------- states
  const LOOP_EASE = Math.min(1.6, total - m.outro);
  const loopWeight = (t: number) => sm(ramp(t, m.outro, LOOP_EASE));
  /** The battery level of the phone's HUD (0..1) before the loop blend: full, then it drops fast in the cold, stays low, creeps up in the tips (the phone is kept warm). */
  const core = (t: number) => {
    let level = 0.92;
    if (t > m.push) level = mix(0.92, 0.3, sm(ramp(t, m.push, 1.6)));
    if (t > m.hasil) level = mix(0.3, 0.2, sm(ramp(t, m.hasil, 5)));
    if (t > m.tip1) level = mix(0.2, 0.5, sm(ramp(t, m.tip1, 3)));
    const cold = 1 - 0.7 * sm(ramp(t, m.tip1 + 1, 2.5));         // the cold lets go when the phone is kept warm
    return { level, cold };
  };
  const state = (t: number) => {
    const s = core(t), k = loopWeight(t);
    if (k === 0) return s;
    const h = core(0);
    return { level: mix(s.level, h.level, k), cold: mix(s.cold, h.cold, k) };
  };

  // ---------------------------------------------------------------- the inserts
  const inserts: Insert[] = [
    { id: "ions", kind: "ions", from: m.kerja + 0.3, to: m.dalam - 0.2 },
    { id: "cold", kind: "cold", from: m.dalam + 0.1, to: m.tegangan - 0.2 },
    { id: "volt", kind: "volt", from: m.tegangan + 0.3, to: m.cas - 0.2 },
    { id: "plate", kind: "plate", from: m.cas + 0.3, to: m.hasil - 0.2 },
  ];
  const OPEN_IN = 0.5, OPEN_OUT = 0.4;
  const insertOpen = (ins: Insert, t: number) => sm(Math.min(ramp(t, ins.from, OPEN_IN), ramp(ins.to - t, 0, OPEN_OUT)));
  const insertAt = (t: number): Insert | null => inserts.find((x) => t >= x.from && t < x.to && insertOpen(x, t) > 0) ?? null;

  /** How far the ions have travelled (in channel lengths) by `t`: they flow at full speed in the warm (kerja), slow down in the cold (dalam, tegangan) and speed up again at the road (fakta). */
  const speedAt = (t: number) => (t < m.dalam ? 1 : 0.3);
  const ionPhase = (t: number) => { let p = 0; for (let f = 0; f < Math.floor(t * 10); f++) p += speedAt(f / 10) * 0.1; return p * 0.28; };
  /** The cold's grip on the battery inside the inserts (0 warm, 1 cold): it grows from the "dalam" beat on. */
  const grip = (t: number) => (t < m.dalam ? 0 : sm(ramp(t, m.dalam + 0.2, 1.5)));

  // ---------------------------------------------------------------- texts
  const KICKER: Record<string, string> = { hook: "KENAPA YA?", normal: "PENYEBABNYA", lens: "DI DALAM", result: "JADI", tips: "TIPS" };
  const tops: Top[] = story.beats.filter((b) => b.kind !== "sting" && b.kind !== "outro").map((b) => ({ a: beat(b.id).a, b: beat(b.id).b, kicker: b.kicker ?? KICKER[b.kind], headline: b.headline ?? b.text }));
  type Lab = { id: string; text: string; x: number; y: number; fs: number; color: "black" | "red"; from: number; to: number; dark?: boolean };
  const labels: Lab[] = [];
  const L = (id: string, beatId: string, ins: string | null, from: number, dark = false) => {
    const l = labelOf(beatId); if (!l) return;
    const i = ins ? inserts.find((x) => x.id === ins) : null;
    labels.push({ id, text: l.text, x: l.x, y: l.y, fs: l.fs, color: l.color === "red" ? "red" : "black", from: Math.max(from, i ? i.from + 0.5 : from), to: i ? i.to - OPEN_OUT - 0.1 : beat(beatId).b - 0.2, dark });
  };
  L("ion", "kerja", "ions", m.kerja + 1.2);
  L("resist", "dalam", "cold", w("dalam", "hambatan", 0, 0.2), true);
  L("current", "tegangan", "volt", w("tegangan", "arus", 0, 0.7));
  L("plating", "cas", "plate", w("cas", "litium", 0, 0.5));
  const tipLabels = [labelOf("tips", 0), labelOf("tips", 1)];
  const tips = tipLabels.flatMap((l, q) => l ? [{ n: q + 1, title: l.text, from: q ? m.tip2 : m.tip1, to: q ? beat("tips").b - 0.1 : m.tip2 - 0.2 }] : []);
  const TIP = { x: 80, y: 412, w: 840 };
  const stingPill = items("intip").flatMap((i) => (i.type === "pill" ? [i.text] : []))[0] ?? beat("intip").beat.text;
  const STING = { mx: 400, my: 400, mw: 200, px: 690, py: 400, fs: 52, pillW: 300 };
  const REACT = { x: 160, y: 1180, w: 220 };

  return { B, beat, total, w, m, cam, state, loopWeight, tops, labels, tips, TIP, inserts, insertOpen, insertAt, ionPhase, grip, stingPill, STING, REACT, toScreen };
}

/** The hero's box at time t, in the 1080 px frame (x, y, w, h): the phone on the bench (the wide shot, then the main shot after the push). */
export const HERO_BOX_AT = (t: number) => {
  // the phone's drawn width is about 371 px at zoom 1 (the camera's zoom keys above): wide shot 0.5, the push to 1.6 over 1.5 to 2.9 s, 1.75 in the result beat, 1.0 for the tips
  const z = t < 1.5 ? 0.5 : t < 2.9 ? 0.5 + 1.1 * ((t - 1.5) / 1.4) : t < 38 ? 1.65 : t < 47 ? 1.75 : t < 57 ? 1.0 : 0.5;
  return { x: 540, y: 1010, w: 371 * z, h: 250 * z };
};
