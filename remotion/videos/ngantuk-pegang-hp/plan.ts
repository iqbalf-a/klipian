/* Kenapa rebahan pegang hp ngantuk, tapi hp ditaruh malah melek? — the timing of this video (pure: no React here). The formula is DESIGN.md section 0b: the hook, the
   "Intip yuk!" sting right after it, the explain beats, the result, the tips and the loop-back outro. Everything is read from the beats and the words of the narration, so
   the picture follows the voice once klipian imports one. Colours come from src/tokens.ts; easings and springs from src/motionLanguage.ts (must 3 of B16).
   One continuous take on a bed: a lit phone and a pair of eyes (lids droop while the phone is in hand, open wide when it is put down), a thought bubble that fills up with
   what the screen brings, the phone sent to another room (tip 1), and the loop-back to the opening shot. No health claims: it explains an everyday feeling. */
import type { BeatT, StoryT } from "../../src/schema.ts";
import { FPS, sequencePlan } from "../../src/timeline.ts";
import { wordsOfBeat } from "../../src/captions.ts";
import { cam2At, isoAt, toScreen, type Cam2, type Key2, type P2 } from "../../src/iso.ts";
import { captionBox, conflicts, textWidthEstimate, topTextBox, type Box, type Spec } from "../../src/layout.ts";
import { SAFE } from "../../src/tokens.ts";
import { PHONE } from "../../src/bedroomGeometry.ts";

// the stage in world px at rest (camera focus 540, 960, zoom 1): the bed is 650 px wide (60 to 70 % of the frame), the eyes above it, the thought bubble at the eyes' upper right
// PLAN-SAFE-AREA (B24): the top text starts at y 170 and the bed's base must stay inside SAFE.bottom (1600), so the stage no longer drops (stageDrop 0, it was 20 under
// PLAN-LAYOUT-BOTTOM) and the eyes and the bubble sit lower, below the top text; the bubble is pulled in from the right band (x 920)
export const stageDrop = 0;
export const OUT = { u: 150, o: [475, 960 + stageDrop] as P2 };
export const EYES = { cx: 540, cy: 680, w: 520 };
export const BUBBLE = { cx: 780, cy: 480, r: 92 };
export const PHONE_PT: P2 = isoAt([PHONE.c[0], PHONE.c[1], PHONE.c[2] + PHONE.h], OUT.u, OUT.o) as P2;
export const BED_BOX: Box = (() => {
  const pts = ([[-0.1, -0.1, -0.35], [3.1, -0.1, -0.35], [-0.1, 2.1, -0.35], [3.1, 2.1, -0.35], [0, 0, 0.5], [3, 0, 0.5], [0.15, 0.3, 0.82]] as [number, number, number][]).map((p) => isoAt(p, OUT.u, OUT.o));
  return { x0: Math.min(...pts.map((p) => p[0])), y0: Math.min(...pts.map((p) => p[1])), x1: Math.max(...pts.map((p) => p[0])), y1: Math.max(...pts.map((p) => p[1])) };
})();

const norm = (w: string) => w.toLowerCase().normalize("NFD").replace(/[^\p{L}\p{N}]/gu, "");
const domain = (url: string) => { try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; } };
const ramp = (t: number, a: number, d: number) => Math.max(0, Math.min(1, (t - a) / d));
const sm = (k: number) => k * k * (3 - 2 * k);
const mix = (a: number, b: number, k: number) => a + (b - a) * k;

export type Top = { a: number; b: number; kicker?: string; headline: string };
const KICKER: Record<string, string> = { hook: "KENAPA YA?", normal: "PENYEBABNYA", loose: "PENYEBABNYA", result: "JADI", tips: "TIPS" };
export type Plan = ReturnType<typeof makePlan>;

export function makePlan(story: StoryT) {
  const seq = sequencePlan(story);
  const B: Record<string, { a: number; b: number; beat: BeatT; index: number }> = {};
  seq.forEach((p, i) => { B[p.beat.id] = { a: p.from / FPS, b: (p.from + p.beatFrames) / FPS, beat: p.beat, index: i }; });
  const total = seq.reduce((n, p) => n + p.beatFrames, 0) / FPS;
  const beat = (id: string) => B[id] ?? { a: 0, b: total, beat: story.beats[0], index: 0 };
  /** The video second when a word is spoken (the nth word starting with `prefix`), or a share of the beat if the story no longer has it. */
  const w = (id: string, prefix: string, nth = 0, share = 0.5): number => {
    const bb = beat(id), found = wordsOfBeat(bb.beat).filter((x) => norm(x.w).startsWith(norm(prefix)))[nth];
    return Math.round((bb.a + (found ? found.a : share * bb.beat.dur)) * FPS) / FPS;
  };
  const items = (id: string) => beat(id).beat.scene.items;
  // the story's own "HP" label stands for the object, which is drawn now, so it is not a pointer label
  const labelsOf = (id: string) => items(id).flatMap((i) => (i.type === "label" && i.text !== "HP" ? [i] : []));

  // ---------------------------------------------------------------- the moments
  const m = {
    hookQ: 0.6, hookDim: 1.3, hookOpen: 1.5,
    sting: beat("intip").a, stingEnd: beat("intip").b,
    lie: beat("baring").a + 0.2, lieLabel: w("baring", "rebahan", 0, 0.1), tired: w("baring", "lelah", 0, 0.45),
    scroll: w("layar", "menggulir", 0, 0.15), notif: w("layar", "notifikasi", 0, 0.4), busy: w("layar", "pikiran", 0, 0.6), bubble: beat("layar").a + 0.7,
    upset: w("isi", "kesal", 0, 0.1), carried: w("isi", "terbawa", 0, 0.45), putDown: w("isi", "ditaruh", 0, 0.55), stare: w("isi", "melek", 0, 0.8),
    held: w("hasil", "kantuk", 0, 0.1), lit: w("hasil", "pikiran", 0, 0.4), awake: w("hasil", "melek", 0, 0.8), react: w("hasil", "melek", 0, 0.8) - 0.3,
    tips: beat("tips").a, tip1: w("tips", "satu", 0, 0.12), tip2: w("tips", "dua", 1, 0.55),
    outro: beat("outro").a, end: total,
  } as Record<string, number>;
  m.away = m.tip1 + 0.6;
  m.tipsCam = m.tips + 0.3;

  // ---------------------------------------------------------------- the cameras
  const outKeys: Key2[] = [
    { t: 0, x: 540, y: 990, zoom: 0.94 },                          // the opening shot: the loop-back returns here
    { t: 2.4, x: 540, y: 960, zoom: 1.0 },
    { t: m.sting - 0.3, x: 540, y: 960, zoom: 1.0 },
    { t: m.sting + 0.2, x: 540, y: 850, zoom: 1.0 },               // the stage settles lower so the sting has the top band
    { t: m.stingEnd + 0.6, x: 540, y: 920, zoom: 1.0 },
    { t: beat("baring").b, x: 540, y: 900, zoom: 1.05 },           // the slow push on the lying down
    { t: beat("layar").a + 1.0, x: 570, y: 880, zoom: 1.05 },
    { t: beat("layar").b, x: 570, y: 870, zoom: 1.12 },            // closer on the phone and the bubble
    { t: beat("isi").b - 1.5, x: 560, y: 820, zoom: 1.1 },
    { t: beat("hasil").b - 0.9, x: 560, y: 820, zoom: 1.1 },       // holds through the result, then settles for the tips
    { t: m.tipsCam, x: 540, y: 800, zoom: 0.74 },                  // the stage drops to make room for the tip cards
    { t: m.outro, x: 540, y: 800, zoom: 0.74 },
    { t: total - 0.2, x: 540, y: 990, zoom: 0.94 },                // home: the last frame's camera is the first one's
  ];
  const outCam = (t: number): Cam2 => cam2At(outKeys, t);

  // ---------------------------------------------------------------- the states
  /** The state before the loop blend: how lit the phone is, how far the lids are up, where the eyes look, the bubble, the phone's trip to another room. */
  const core = (t: number) => {
    const baring = beat("baring"), layar = beat("layar");
    // the phone: lit at the start, dim when it is put down (the hook, the "isi" beat), lit again for the explanation
    const on = t < m.hookDim ? 1 : t < m.lie + 0.3 ? mix(1, 0.08, sm(ramp(t, m.hookDim, 0.5))) : t < m.putDown ? mix(0.08, 1, sm(ramp(t, m.lie + 0.3, 0.6))) : mix(1, 0.08, sm(ramp(t, m.putDown, 0.5)));
    // the lids: droopy, wide open for "melek", droop through the lying down, held up by the screen with a nod, wide open again when the phone goes down, calm again in tip 2
    let open: number, look = 0.3, brow = 0.2;
    if (t < m.hookOpen) open = 0.35;
    else if (t < m.lie) { const k = sm(ramp(t, m.hookOpen, 0.6)); open = mix(0.35, 1, k); look = mix(0.3, -0.5, k); brow = mix(0.2, 1, k); }
    else if (t < layar.a) { const k = sm(ramp(t, m.lie, baring.b - m.lie)); open = mix(1, 0.22, k); look = mix(-0.5, 0.5, k); brow = mix(1, 0.1, k); }
    else if (t < m.putDown) { const k = ramp(t, layar.a, m.putDown - layar.a); open = mix(0.22, 0.5, sm(Math.min(1, k * 2))) + 0.1 * Math.sin(((t - layar.a) / 1.7) * Math.PI * 2); look = 0.4; brow = 0.3; }
    else if (t < m.tip2) { const k = sm(ramp(t, m.putDown, 0.5)); open = mix(0.5, 1, k); look = mix(0.4, -0.7, k); brow = mix(0.3, 1, k); }
    else { const k = sm(ramp(t, m.tip2, 1.6)); open = mix(1, 0.35, k); look = mix(-0.7, 0.3, k); brow = mix(1, 0.2, k); }
    const bubble = sm(ramp(t, m.bubble, 0.5)) * (1 - sm(ramp(t, m.tip2, 1.2)));
    const away = sm(ramp(t, m.away, 1.3));
    return { on, open, look, brow, bubble, away, busy: t >= beat("layar").a && t < m.putDown ? 1 : t >= m.putDown && t < m.tip2 ? 0.45 : 0 };
  };
  // the loop: from the outro on every state eases to its t = 0 value (the phone lit and back on the bed, the lids droopy, no bubble), so the last frame is the first one's
  const LOOP_EASE = Math.min(1.6, total - m.outro);
  const loopWeight = (t: number) => sm(ramp(t, m.outro, LOOP_EASE));
  const state = (t: number) => {
    const s = core(t), k = loopWeight(t);
    if (k === 0) return s;
    const h = core(0);
    return { on: mix(s.on, h.on, k), open: mix(s.open, h.open, k), look: mix(s.look, h.look, k), brow: mix(s.brow, h.brow, k), bubble: mix(s.bubble, h.bubble, k), away: mix(s.away, h.away, k), busy: mix(s.busy, h.busy, k) };
  };
  /** The z marks over the eyes when they are heavy: their opacity (0 when the lids are up). */
  const zMarks = (t: number) => Math.max(0, Math.min(1, (0.62 - state(t).open) / 0.3));

  // ---------------------------------------------------------------- texts, labels, tips, chips
  const tops: Top[] = story.beats.filter((b) => b.kind !== "sting" && b.kind !== "outro").map((b) => {
    const kicker = b.kicker ?? KICKER[b.kind];
    return { a: beat(b.id).a, b: beat(b.id).b, kicker, headline: b.headline ?? b.text };
  });
  const LABEL_FS = 46;
  type Lab = { id: string; text: string; n?: number | string; world: "out"; at: P2; off: P2; from: number; to: number };
  const labels: Lab[] = [];
  const L = (id: string, text: string | null | undefined, rest: Omit<Lab, "id" | "text" | "world">) => { if (text) labels.push({ id, text, world: "out", ...rest }); };
  const hookLabel = items("hook").flatMap((i) => (i.type === "banner" ? [i.text] : [])).at(-1);
  const EY: P2 = [EYES.cx, EYES.cy], BU: P2 = [BUBBLE.cx, BUBBLE.cy], PH = PHONE_PT;
  L("hook", hookLabel, { at: [PH[0] - 20, PH[1] + 20], off: [-190, 170], from: m.hookDim, to: beat("hook").b });
  const ba = labelsOf("baring"), la = labelsOf("layar"), isi = labelsOf("isi"), ha = labelsOf("hasil");
  L("lie", ba[0]?.text, { at: [PH[0] - 150, PH[1] + 40], off: [-100, 230], from: m.lieLabel, to: m.tired });
  L("tired", ba[1]?.text, { at: [EY[0] - 120, EY[1] - 40], off: [-150, -210], from: m.tired, to: beat("baring").b - 0.1 });
  L("scroll", la[0]?.text, { at: [PH[0], PH[1]], off: [-290, 180], from: m.scroll, to: m.notif });
  L("notif", la[1]?.text, { at: [BU[0] - 20, BU[1] - 10], off: [-410, -10], from: m.notif, to: m.busy });
  L("brain", la[2]?.text, { at: [BU[0] - 40, BU[1] + 30], off: [-370, -20], from: m.busy, to: beat("layar").b - 0.1 });
  L("upset", isi[0]?.text, { at: [BU[0] - 40, BU[1]], off: [-400, -30], from: m.upset, to: m.carried });
  L("carried", isi[1]?.text, { at: [BU[0] - 40, BU[1] + 20], off: [-370, -30], from: m.carried, to: m.stare });
  L("stare", isi[2]?.text, { at: [EY[0] + 80, EY[1] + 40], off: [-40, 215], from: m.stare, to: beat("isi").b - 0.1 });
  L("held", ha[0]?.text, { at: [PH[0] - 10, PH[1] - 10], off: [-240, -150], from: m.held, to: m.lit });
  L("lit", ha[1]?.text, { at: [BU[0] - 40, BU[1] + 10], off: [-390, -20], from: m.lit, to: m.awake });
  L("awake", ha[2]?.text, { at: [EY[0] + 40, EY[1] + 30], off: [-30, 210], from: m.awake, to: beat("hasil").b - 1.0 });
  const stepBadges = (id: string) => items(id).flatMap((i) => (i.type === "badge" ? [i.text] : []))[0];
  const steps = ["baring", "layar", "isi"].map((id) => ({ id, n: stepBadges(id), from: beat(id).a + 0.4, to: beat(id).b - 0.1 }));
  const STEP_AT: P2 = [110, 700];

  /** Where a label's pill is at `t` (its centre), where its leader ends, its box; clamped inside the safe area, below the top text, above the captions. */
  const labelAt = (l: Lab, t: number) => {
    const a = toScreen(outCam(t), l.at);
    const wPill = textWidthEstimate(l.text, LABEL_FS) + LABEL_FS * 1.1, h = LABEL_FS * 1.5;
    const top = topTextBox().y1 + 20 + h / 2, bottom = captionBox(story.captionStyle, story.platforms).y0 - 20 - h / 2;
    const x = Math.max(SAFE.left + wPill / 2, Math.min(SAFE.right - wPill / 2, a[0] + l.off[0])), y = Math.max(top, Math.min(bottom, a[1] + l.off[1]));
    return { x, y, ax: a[0], ay: a[1], w: wPill, h, box: { x0: x - wPill / 2, y0: y - h / 2, x1: x + wPill / 2, y1: y + h / 2 } as Box };
  };

  const chipFor = (idx: number) => { const c = story.claims[idx]; return c ? [...new Set(c.sources.map(domain))].join(" · ") : ""; };
  const claimsOf = (id: string) => story.claims.map((c, i) => ({ c, i })).filter(({ c }) => c.beats.includes(id)).map(({ i }) => chipFor(i));
  const chips = [
    { id: "chip-baring", text: claimsOf("baring")[0], from: beat("baring").a + 1.6, to: beat("baring").b - 0.1 },
    { id: "chip-layar", text: claimsOf("layar")[0], from: m.scroll + 0.3, to: beat("layar").b - 0.1 },
    { id: "chip-isi", text: claimsOf("isi")[0], from: m.carried + 0.3, to: beat("isi").b - 0.1 },
  ].filter((c): c is typeof c & { text: string } => !!c.text);

  const tipLabels = labelsOf("tips");
  const tipBadges = items("tips").flatMap((i) => (i.type === "badge" ? [i.text] : []));
  const tips = [0, 1].flatMap((q) => {
    const title = tipLabels[q];
    if (!title) return [];
    return [{ n: tipBadges[q] ?? String(q + 1), title: title.text, sub: title.lines?.[0], keyword: title.highlight?.[0], from: q ? m.tip2 : m.tip1, subAt: (q ? m.tip2 : m.tip1) + 0.9, to: q ? beat("tips").b - 0.1 : m.tip2 - 0.25 }];
  });
  const TIP = { x: 80, y: 412, w: 840 };                 // inside SAFE (x 60..920) and below the top text (it ends at y 397; PLAN-SAFE-AREA, B24)

  const stingPill = items("intip").flatMap((i) => (i.type === "pill" ? [i.text] : []))[0] ?? beat("intip").beat.text;
  const pillW = textWidthEstimate(stingPill, 52) + 60, rowW = 200 + 24 + pillW, rowX = 540 - rowW / 2;
  const STING = { mx: rowX + 100, my: 400, mw: 200, px: rowX + 200 + 24 + pillW / 2, py: 400, fs: 52, pillW };
  const stingPillBox = { x0: STING.px - pillW / 2, y0: STING.py - 46, x1: STING.px + pillW / 2, y1: STING.py + 46 };
  const stingMascotBox = { x0: STING.mx - STING.mw / 2, y0: STING.my - STING.mw * 0.6, x1: STING.mx + STING.mw / 2, y1: STING.my + STING.mw * 0.6 };
  const REACT = { x: 140, y: 1170, w: 220 };

  /** What is on the screen at `t` as boxes for the layout manager (src/layout.ts): the bed (the hero), the eyes, the bubble, the labels, the tip cards, the sting, the top text and the captions. */
  const specsAt = (t: number, tipH: (i: number) => number): Spec[] => {
    const specs: Spec[] = [];
    if (tops.some((x) => t >= x.a && t < x.b)) specs.push({ id: "top-text", role: "banner", box: topTextBox() });
    if (story.beats.some((b) => b.kind !== "sting" && b.kind !== "outro" && t >= beat(b.id).a && t < beat(b.id).b)) specs.push({ id: "caption", role: "caption", box: captionBox(story.captionStyle, story.platforms) });
    if (t < m.outro) {
      // the phone is the key of the picture (the bed is only its stage, so a label may lie over the blanket); the eyes and the bubble are pictures labels keep clear of
      const c = outCam(t), z = c.zoom, st = state(t), box = (cx: number, cy: number, hw: number, hh: number): Box => { const a = toScreen(c, [cx - hw, cy - hh]), b = toScreen(c, [cx + hw, cy + hh]); return { x0: a[0], y0: a[1], x1: b[0], y1: b[1] }; };
      void z;
      if (st.away < 0.5) specs.push({ id: "hero", role: "hero", box: box(PHONE_PT[0], PHONE_PT[1] - 10, 120, 100) });
      specs.push({ id: "eyes", role: "picture", box: box(EYES.cx, EYES.cy, EYES.w / 2, 148) });
      if (st.bubble > 0.4) specs.push({ id: "bubble", role: "picture", box: box(BUBBLE.cx - 7, BUBBLE.cy - 20, 123, 70) });
    }
    for (const l of labels) if (t >= l.from + 0.1 && t < l.to) specs.push({ id: `label:${l.id}`, role: "text", box: labelAt(l, t).box });
    if (t >= m.sting && t < m.stingEnd) specs.push({ id: "sting:mascot", role: "picture", box: stingMascotBox }, { id: "sting:pill", role: "text", box: stingPillBox });
    tips.forEach((tp, i) => { if (t >= tp.from + 0.2 && t < tp.to) specs.push({ id: `tip:${i}`, role: "picture", box: { x0: TIP.x, y0: TIP.y, x1: TIP.x + TIP.w, y1: TIP.y + tipH(i) } }); });
    return specs;
  };
  const problemsAt = (t: number, tipH: (i: number) => number) => conflicts(specsAt(t, tipH));

  return {
    B, beat, total, w, m, outKeys, outCam, state, zMarks, tops, labels, labelAt, LABEL_FS, chips, tips, TIP, steps, STEP_AT, stingPill, STING, REACT,
    loopWeight, specsAt, problemsAt,
  };
}
