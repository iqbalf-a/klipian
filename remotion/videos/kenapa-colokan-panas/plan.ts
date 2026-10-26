/* The plan of "Kenapa colokan bisa panas?" without drawing: when things happen (from the beats and the words of the narration, so the picture follows the
   voice once klipian imports one), which story text goes where, the two 2D cameras, and the boxes of every frame for the layout manager. Pure, so the
   picture (index.tsx), the sound (sfx.ts) and the test (tests/colokan.test.ts) read the same numbers. Every word on the screen comes from story.json;
   only the structural kickers, "DIPERBESAR", "SUMBER" and the onomatopoeia are the channel's own chrome. */
import type { BeatT, StoryT } from "../../src/schema.ts";
import { FPS, sequencePlan } from "../../src/timeline.ts";
import { wordsOfBeat, type CWord } from "../../src/captions.ts";
import { cam2At, isoAt, toScreen, type Cam2, type Key2, type P2, type P3 } from "../../src/iso.ts";
import { captionBox, conflicts, textWidthEstimate, topTextBox, type Box, type Spec } from "../../src/layout.ts";
import { SAFE } from "../../src/tokens.ts";

// the two worlds, in world px at rest (camera focus 540, 960, zoom 1)
export const OUT = { u: 150, o: [540, 900] as P2 };
export const LAB = { u: 200, o: [470, 1000] as P2 };
// named world points (src/components/Iso.tsx ISO_SOCKET_POINTS / ISO_CUT_POINTS; copied here so this file stays free of React)
export const SOCKET_PTS = { plate: [-0.95, 0.3, 1.45], grip: [0.55, 1.05, 1.25], collar: [0.95, 0.38, 0.75], junction: [0.98, 0.35, 0.7], plugTop: [0, 1.0, 1.45], center: [0, 0.3, 0.5] } as const satisfies Record<string, P3>;
export const CUT_PTS = { leaf: [2.05, 0, 0.44], pin: [-0.3, 0, -0.17] } as const satisfies Record<string, P3>;
export const contactAt = (loose: number): P3 => [1.2 - 0.2 * loose, 0.05, 0.18];
const out = (p: P3): P2 => isoAt(p, OUT.u, OUT.o);
const lab = (p: P3): P2 => isoAt(p, LAB.u, LAB.o);

const norm = (w: string) => w.toLowerCase().normalize("NFD").replace(/[^\p{L}\p{N}]/gu, "");

export type Sentence = { a: number; b: number; text: string; words: CWord[] };
/** The sentences of a beat (seconds into the beat), split after . ? ! */
export function sentences(beat: BeatT): Sentence[] {
  const words = wordsOfBeat(beat), out2: Sentence[] = [];
  let cur: CWord[] = [];
  words.forEach((w, i) => {
    cur.push(w);
    if (/[.?!]$/.test(w.w) || i === words.length - 1) { out2.push({ a: cur[0].a, b: cur[cur.length - 1].b, text: cur.map((c) => c.w).join(" "), words: cur }); cur = []; }
  });
  return out2;
}

/** How many words of a story text match words of a sentence (a word matches when one starts with the other, at least 4 letters). */
const overlap = (text: string, sentence: string): number => {
  const s = sentence.split(/\s+/).map(norm).filter(Boolean);
  return text.split(/\s+/).map(norm).filter(Boolean).filter((w) => s.some((x) => x === w || (w.length >= 4 && x.length >= 4 && (x.startsWith(w) || w.startsWith(x))))).length;
};

export type Top = { a: number; b: number; kicker?: string; headline: string };
const KICKER: Record<string, string> = { lens: "DARI LUAR", normal: "DI DALAM", loose: "DI DALAM · DIPERBESAR", result: "AKIBATNYA", tips: "TIPS AMAN" };
/** The top text of every sentence of a beat (seconds of the VIDEO): the beat's own kicker/headline when klipian gave one; otherwise the story text (the beat's
    text, its labels) that matches the sentence best, so the headline changes with the sentence. Tips keep the beat's text (the tip cards carry the tips). */
export function topTexts(story: StoryT, beat: BeatT, start: number): Top[] {
  if (beat.kind === "sting" || beat.kind === "outro") return [];
  const ss = sentences(beat);
  const kicker = beat.kicker ?? (beat.kind === "hook" ? story.question.toUpperCase() : KICKER[beat.kind]);
  if (beat.headline || beat.kind === "tips" || beat.kind === "hook") return [{ a: start, b: start + beat.dur, kicker, headline: beat.headline ?? beat.text }];
  const cands = [beat.text, ...beat.scene.items.flatMap((i) => (i.type === "label" ? [i.text] : []))];
  return ss.map((s, k) => {
    let best = beat.text, score = overlap(beat.text, s.text);
    for (const c of cands) { const o = overlap(c, s.text); if (o > score) { best = c; score = o; } }
    return { a: start + (k ? s.a - 0.15 : 0), b: start + (k + 1 < ss.length ? ss[k + 1].a - 0.15 : beat.dur), kicker, headline: best };
  });
}

/** A phrase as the story says it (from the narration, the texts, the labels), or null if the story no longer has it. */
export function fromStory(story: StoryT, phrase: string): string | null {
  const hay = story.beats.flatMap((b) => [b.narration, b.text, ...b.scene.items.flatMap((i) => ("text" in i ? [i.text] : []))]).join(" ");
  const m = hay.match(new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));
  return m ? m[0] : null;
}

const domain = (url: string) => { try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; } };

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
  const labelsOf = (id: string) => items(id).flatMap((i) => (i.type === "label" ? [i] : []));
  const highlight = (id: string) => items(id).flatMap((i) => (i.type === "banner" ? i.highlight ?? [] : []))[0] ?? null;

  // ---------------------------------------------------------------- the moments
  const m = {
    hookHeat: 0.8, hookLabel: w("hook", "panas", 0, 0.7),
    sting: beat("sting").a, stingEnd: beat("sting").b,
    socketLabel: w("lensa", "stop", 0, 0.3), plugLabel: w("lensa", "kontak", 0, 0.4) + 0.3,
    magnifier: w("lensa", "zoom", 0, 0.55), through: beat("dalam").a - 0.95, inside: beat("dalam").a,
    leafLabel: w("dalam", "penjepit", 0, 0.15), pinLabel: w("dalam", "kaki", 0, 0.35), macro: w("dalam", "listrik", 0, 0.55), contactLabel: w("dalam", "titik", 0, 0.75),
    loosen: w("kendur", "kendur", 0, 0.2) - 0.25, narrowLabel: w("kendur", "sempit", 0, 0.35), jam: w("kendur", "listrik", 0, 0.45),
    hot: w("kendur", "hambatan", 0, 0.7), react: w("kendur", "panas", 0, 0.9) - 0.05,
    loop: beat("akhir").a + 0.15, exit: w("akhir", "akhirnya", 0, 0.5) - 0.45, melt: w("akhir", "meleleh", 0, 0.7), fire: w("akhir", "kebakaran", 0, 0.85),
    tips: beat("tips").a, tip1: w("tips", "satu", 0, 0.12), unplug: w("tips", "berhenti", 0, 0.3), tech1: w("tips", "teknisi", 0, 0.45),
    tip2: w("tips", "dua", 1, 0.55), wobble: w("tips", "goyang", 0, 0.62), tech2: w("tips", "teknisi", 1, 0.85), replace: w("tips", "mengganti", 0, 0.9),
    outro: beat("outro").a, end: total,
  };
  const exitEnd = m.exit + 0.9;
  const cardIn1 = m.jam + 0.6, cardOut1 = Math.min(m.react - 0.2, cardIn1 + 3.2);
  const cardIn2 = m.melt + 0.4, cardOut2 = beat("akhir").b - 0.15;

  // ---------------------------------------------------------------- the cameras
  const J = out(SOCKET_PTS.junction), C0 = out(SOCKET_PTS.center);
  const outKeys: Key2[] = [
    { t: 0, x: 520, y: 980, zoom: 0.8 },
    { t: 1.1, x: C0[0] + 20, y: C0[1] + 40, zoom: 1.28 },
    { t: m.sting, x: C0[0] + 10, y: C0[1] + 30, zoom: 1.36 },
    { t: m.stingEnd, x: C0[0], y: C0[1] + 20, zoom: 1.32 },
    { t: m.plugLabel + 0.4, x: C0[0] - 60, y: C0[1] + 50, zoom: 1.2 },
    { t: m.through, x: J[0], y: J[1], zoom: 1.9 },
    { t: m.inside + 0.05, x: J[0], y: J[1], zoom: 9 },
    { t: m.exit, x: J[0], y: J[1], zoom: 7 },
    { t: exitEnd + 0.6, x: C0[0] + 10, y: C0[1] + 40, zoom: 1.25 },
    { t: cardIn2 - 0.3, x: C0[0] + 10, y: C0[1] + 40, zoom: 1.25 },
    { t: cardIn2 + 0.35, x: C0[0] + 20, y: C0[1] + 230, zoom: 1.05 },
    { t: cardOut2, x: C0[0] + 20, y: C0[1] + 230, zoom: 1.05 },
    { t: m.tips + 0.6, x: C0[0] + 10, y: C0[1] - 250, zoom: 1.0 },
    { t: m.tip2, x: C0[0] + 30, y: C0[1] - 240, zoom: 1.04 },
    { t: m.outro, x: C0[0] - 10, y: C0[1] - 250, zoom: 1.08 },
    { t: m.outro + 1.2, x: C0[0], y: C0[1] - 700, zoom: 0.75 },
  ];
  const outCam = (t: number): Cam2 => cam2At(outKeys, t);

  const CT = lab(contactAt(0)), CL = lab(contactAt(1));
  const labKeys: Key2[] = [
    { t: m.inside, x: CT[0], y: CT[1], zoom: 0.62 },
    { t: m.inside + 0.7, x: CT[0] - 120, y: CT[1] - 40, zoom: 0.78 },
    { t: m.macro, x: CT[0] - 60, y: CT[1] - 20, zoom: 0.86 },
    { t: m.contactLabel + 0.1, x: CT[0], y: CT[1] + 50, zoom: 1.75 },
    { t: beat("kendur").a, x: CT[0] + 10, y: CT[1] + 50, zoom: 1.8 },
    { t: m.loosen + 0.2, x: CL[0], y: CL[1] + 70, zoom: 1.45 },
    { t: cardIn1 - 0.4, x: CL[0] - 10, y: CL[1] + 70, zoom: 1.4 },
    { t: cardIn1 + 0.2, x: CL[0], y: CL[1] + 230, zoom: 1.3 },
    { t: cardOut1, x: CL[0], y: CL[1] + 230, zoom: 1.3 },
    { t: cardOut1 + 0.6, x: CL[0], y: CL[1] + 40, zoom: 1.35 },
    { t: m.exit, x: CL[0], y: CL[1] + 30, zoom: 1.2 },
    { t: exitEnd, x: CL[0], y: CL[1], zoom: 0.5 },
  ];
  /** The circle the lab is seen through: the magnifier, the dolly through it, and on the way out a circle that shrinks back to the junction. */
  const lens = (t: number): { x: number; y: number; r: number } | null => {
    const jt = toScreen(outCam(t), J);
    if (t < m.magnifier || t >= exitEnd) return null;
    if (t < m.inside) {
      const p = Math.min(1, (t - m.magnifier) / 0.35), g = Math.max(0, (t - m.through) / (m.inside - m.through));
      const ease = 1 - Math.pow(1 - p, 3), grow = g < 0.5 ? 4 * g * g * g : 1 - Math.pow(-2 * g + 2, 3) / 2;
      return { x: jt[0], y: jt[1], r: 190 * ease * (1 + 9 * Math.pow(grow, 1.6)) };
    }
    if (t < m.exit) return { x: 540, y: 960, r: 2400 };
    const k = (t - m.exit) / (exitEnd - m.exit), e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
    return { x: jt[0], y: jt[1], r: 1800 * (1 - e) };
  };
  /** The lab camera: by its keys while we are inside; before and on the way out it is anchored so the contact stays in the middle of the circle. */
  const labCam = (t: number): Cam2 => {
    const c = cam2At(labKeys, t), L = lens(t);
    if (!L || (t >= m.inside && t < m.exit)) return c;
    const anchor = t < m.inside ? CT : CL;
    return { zoom: c.zoom, x: anchor[0] - (L.x - 540) / c.zoom, y: anchor[1] - (L.y - 960) / c.zoom };
  };
  const outsideVisible = (t: number) => t < m.inside + 0.05 || t >= m.exit;
  const labVisible = (t: number) => lens(t) !== null;

  // ---------------------------------------------------------------- the states of the objects
  const ramp = (t: number, a: number, d: number) => Math.max(0, Math.min(1, (t - a) / d));
  const sm = (k: number) => k * k * (3 - 2 * k);
  const state = (t: number) => ({
    outHeat: t < m.inside ? 0.25 + 0.5 * sm(ramp(t, m.hookHeat, 1.6)) : t < m.tips ? 0.75 + 0.25 * sm(ramp(t, exitEnd, 1)) : 1 - sm(ramp(t, m.unplug + 0.2, 1.2)),
    scorch: t < m.exit ? 0 : t < m.replace ? sm(ramp(t, m.melt - 0.3, 1.0)) : 1 - sm(ramp(t, m.replace, 0.35)),
    gap: t < m.unplug ? 0 : t < m.tip2 ? 1.6 * sm(ramp(t, m.unplug, 0.3)) : 1.6 * (1 - sm(ramp(t, m.tip2 + 0.15, 0.35))),
    wobble: t > m.wobble && t < m.wobble + 1.5 ? Math.sin((t - m.wobble) * 15) * Math.sin(Math.PI * (t - m.wobble) / 1.5) : 0,
    smoke: t >= m.exit && t < m.tips + 0.4 ? sm(ramp(t, m.melt - 0.6, 0.6)) * (1 - sm(ramp(t, m.tips, 0.4))) : 0,
    loose: sm(ramp(t, m.loosen, 0.9)),
    labHeat: t < m.hot ? 0 : t < beat("akhir").a ? 0.8 * sm(ramp(t, m.hot, 1.0)) : 0.8 + 0.2 * (0.5 + 0.5 * Math.sin((t - beat("akhir").a) * 4)),
    current: 1,
    fresh: t >= m.replace ? ramp(t, m.replace, 0.5) : 0,
  });

  // ---------------------------------------------------------------- texts, labels, cards
  const tops: Top[] = story.beats.flatMap((b) => topTexts(story, b, beat(b.id).a));
  const dalamLabels = labelsOf("dalam"), kendurLabels = labelsOf("kendur");
  type Lab = { id: string; text: string; n?: number; red?: boolean; world: "out" | "lab"; at: P3 | ((t: number) => P3); off: P2; from: number; to: number; ring?: boolean };
  const labels: Lab[] = [];
  const hookWord = highlight("hook");
  if (hookWord) labels.push({ id: "hook-heat", text: hookWord, red: true, world: "out", at: SOCKET_PTS.collar, off: [240, -330], from: m.hookLabel, to: m.sting });
  const socketWord = fromStory(story, "stop kontak"), plugWord = fromStory(story, "colokan");
  if (socketWord) labels.push({ id: "socket", text: socketWord.toLowerCase(), n: 1, world: "out", at: SOCKET_PTS.plate, off: [-40, -300], from: m.socketLabel, to: m.magnifier + 0.2 });
  if (plugWord) labels.push({ id: "plug", text: plugWord.toLowerCase(), n: 2, world: "out", at: SOCKET_PTS.grip, off: [-40, 380], from: m.plugLabel, to: m.magnifier + 0.2 });
  if (dalamLabels[0]) labels.push({ id: "leaf", text: dalamLabels[0].text, n: 1, world: "lab", at: CUT_PTS.leaf, off: [60, -360], from: m.leafLabel, to: m.macro });
  if (dalamLabels[1]) labels.push({ id: "pin", text: dalamLabels[1].text, n: 2, world: "lab", at: CUT_PTS.pin, off: [-10, 330], from: m.pinLabel, to: m.macro });
  const touch = highlight("dalam");
  if (touch) labels.push({ id: "contact", text: touch, n: 3, world: "lab", at: contactAt(0), off: [-120, 330], from: m.contactLabel, to: beat("kendur").a + 0.3, ring: true });
  if (kendurLabels[0]) labels.push({ id: "narrow", text: kendurLabels[0].text, red: true, world: "lab", at: (t: number) => contactAt(state(t).loose), off: [-60, -330], from: m.narrowLabel, to: cardIn1 - 0.1, ring: true });
  const meltWord = highlight("akhir");
  if (meltWord) labels.push({ id: "melt", text: meltWord, red: true, world: "out", at: SOCKET_PTS.collar, off: [130, -300], from: m.melt, to: cardIn2 - 0.05 });

  const LABEL_FS = 46;
  /** Where a label's pill is at `t` (its centre), where its leader ends, its box; clamped inside the safe area, below the top text, above the captions. */
  const labelAt = (l: Lab, t: number) => {
    const cam = l.world === "out" ? outCam(t) : labCam(t);
    const p = typeof l.at === "function" ? l.at(t) : l.at;
    const a = toScreen(cam, l.world === "out" ? out(p) : lab(p));
    const wTxt = textWidthEstimate(l.text, LABEL_FS), wPill = wTxt + LABEL_FS * 1.1 + (l.n ? LABEL_FS * 1.5 + 8 : 0), h = LABEL_FS * 1.5;
    const top = topTextBox().y1 + 20 + h / 2, bottom = captionBox().y0 - 20 - h / 2;
    const x = Math.max(SAFE.left + wPill / 2, Math.min(SAFE.right - wPill / 2, a[0] + l.off[0])), y = Math.max(top, Math.min(bottom, a[1] + l.off[1]));
    return { x, y, ax: a[0], ay: a[1], w: wPill, h, box: { x0: x - wPill / 2, y0: y - h / 2, x1: x + wPill / 2, y1: y + h / 2 } as Box };
  };

  const claimOf = (id: string) => items(id).flatMap((i) => (i.type === "source" ? [i] : []))[0];
  const cardOf = (id: string, from: number, to: number) => {
    const src = claimOf(id);
    if (!src) return null;
    const c = story.claims[src.claim - 1];
    if (!c) return null;
    return { claim: src.claim, quote: src.quote ?? c.text, org: src.org, date: src.date, domain: domain(c.sources[0]), from, to };
  };
  const cards = [cardOf("kendur", cardIn1, cardOut1), cardOf("akhir", cardIn2, cardOut2)].filter((c): c is NonNullable<typeof c> => !!c);
  const chipFor = (claimIdx: number) => { const c = story.claims[claimIdx]; return c ? [...new Set(c.sources.map(domain))].join(" · ") : ""; };
  /** The claims of a beat that have no card in it: their domains as a chip. */
  const chipsOf = (id: string) => story.claims.map((c, i) => ({ c, i })).filter(({ c, i }) => c.beats.includes(id) && !cards.some((k) => k.claim === i + 1 && claimOf(id)?.claim === i + 1)).map(({ i }) => chipFor(i));
  const chips = [
    ...(chipsOf("dalam")[0] ? [{ id: "chip-dalam", text: chipsOf("dalam")[0], onDark: true, from: m.macro + 0.4, to: beat("dalam").b - 0.2 }] : []),
    ...(chipsOf("akhir").filter((x) => !cards.some((k) => chipFor(k.claim - 1) === x))[0] ? [{ id: "chip-akhir", text: chipsOf("akhir").filter((x) => !cards.some((k) => chipFor(k.claim - 1) === x))[0], onDark: true, from: m.loop + 0.6, to: m.exit - 0.1 }] : []),
  ];

  // the tips: label items in pairs (title, line under it), each with the claim that fits it best as its chip
  const tipLabels = labelsOf("tips");
  const tipSentences = sentences(beat("tips").beat).slice(1);
  const tipsClaims = story.claims.map((c, i) => ({ c, i })).filter(({ c }) => c.beats.includes("tips"));
  const tips = [0, 1].flatMap((k) => {
    const title = tipLabels[k * 2], sub = tipLabels[k * 2 + 1];
    if (!title) return [];
    const s = tipSentences[k]?.text ?? title.text;
    const best = tipsClaims.reduce<{ i: number; o: number } | null>((acc, { c, i }) => { const o = overlap(c.text, s); return !acc || o > acc.o ? { i, o } : acc; }, null);
    const badge = items("tips").flatMap((i) => (i.type === "badge" ? [i.text] : []))[k] ?? String(k + 1);
    return [{ n: badge, title: title.text, sub: sub?.text, keyword: title.highlight?.[0], chip: best ? chipFor(best.i) : undefined, from: k ? m.tip2 : m.tip1, subAt: k ? m.tech2 : m.tech1, to: k ? beat("tips").b - 0.1 : m.tip2 - 0.25 }];
  });
  const TIP = { x: 80, y: 360, w: 860 };

  // the sting and the outro: the story's own pill and label texts
  const stingPill = items("sting").flatMap((i) => (i.type === "pill" ? [i.text] : []))[0] ?? beat("sting").beat.text;
  const outroLabel = items("outro").flatMap((i) => (i.type === "label" ? [i.text] : []))[0] ?? beat("outro").beat.text;
  const outroPill = items("outro").flatMap((i) => (i.type === "pill" ? [i.text] : []))[0] ?? null;

  /** What is on the screen at `t` as boxes for the layout manager (src/layout.ts): the hero (the socket's plate and plug, or the cutaway's contact
      region), labels (text), cards, tip cards and the loop (pictures), the top text and the captions. `conflicts(specs)` must be empty. */
  const specsAt = (t: number, cardH: (quote: string) => number, tipH: (i: number) => number): Spec[] => {
    const specs: Spec[] = [];
    if (tops.some((x) => t >= x.a && t < x.b)) specs.push({ id: "top-text", role: "banner", box: topTextBox() });
    const captioned = story.beats.some((b) => b.kind !== "sting" && b.kind !== "outro" && t >= beat(b.id).a && t < beat(b.id).b);
    if (captioned) specs.push({ id: "caption", role: "caption", box: captionBox() });
    const inLab = t >= m.inside && t < m.exit;
    if (!inLab && t < m.outro && (t < m.sting || t >= m.stingEnd)) {
      const c = outCam(t), pts = [[-1.2, 0.3, 1.7], [1.2, 0.3, 1.7], [-1.2, 0.3, -0.7], [1.2, 0.3, -0.7], [0, 1.9, 0.5]].map((p) => toScreen(c, out(p as unknown as P3)));
      specs.push({ id: "hero", role: "hero", box: { x0: Math.min(...pts.map((p) => p[0])), y0: Math.min(...pts.map((p) => p[1])), x1: Math.max(...pts.map((p) => p[0])), y1: Math.max(...pts.map((p) => p[1])) } });
    }
    if (inLab) {
      // the key of the cutaway is the contact (the pin between the leaves): text may lie over the plastic round it, never over the contact
      const c = labCam(t), cc = toScreen(c, lab(contactAt(state(t).loose))), r = 70 + 50 * Math.min(2, c.zoom);
      specs.push({ id: "contact", role: "hero", box: { x0: cc[0] - r, y0: cc[1] - r, x1: cc[0] + r, y1: cc[1] + r } });
    }
    for (const l of labels) if (t >= l.from + 0.1 && t < l.to) specs.push({ id: `label:${l.id}`, role: "text", box: labelAt(l, t).box });
    for (const cd of cards) if (t >= cd.from + 0.2 && t < cd.to) { const h = cardH(cd.quote); specs.push({ id: `card:${cd.claim}`, role: "picture", box: { x0: 90, y0: 1405 - h, x1: 940, y1: 1405 } }); }
    tips.forEach((tp, i) => { if (t >= tp.from + 0.2 && t < tp.to) specs.push({ id: `tip:${i}`, role: "picture", box: { x0: TIP.x, y0: TIP.y, x1: TIP.x + TIP.w, y1: TIP.y + tipH(i) } }); });
    return specs;
  };
  const problemsAt = (t: number, cardH: (q: string) => number, tipH: (i: number) => number) => conflicts(specsAt(t, cardH, tipH));

  return { B, beat, total, w, m, exitEnd, cardIn1, cardOut1, cardIn2, cardOut2, outKeys, labKeys, outCam, labCam, lens, outsideVisible, labVisible, state, tops, labels, labelAt, LABEL_FS, cards, chips, tips, TIP, stingPill, outroLabel, outroPill, specsAt, problemsAt, loopWords: [fromStory(story, "panas"), fromStory(story, "hambatan")] as const, J };
}
