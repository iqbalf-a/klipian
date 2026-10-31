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
import { simulateCable } from "../../src/cableSim.ts";
import { BOOT_END, PLUG_PROFILE } from "../../src/socket.ts";

// the two worlds, in world px at rest (camera focus 540, 960, zoom 1)
export const OUT = { u: 150, o: [540, 900] as P2 };
export const LAB = { u: 200, o: [470, 1000] as P2 };
// named world points (src/components/Iso.tsx ISO_SOCKET_POINTS / ISO_CUT_POINTS; copied here so this file stays free of React)
export const SOCKET_PTS = { plate: [-0.95, 0.3, 1.45], grip: [0.55, 1.05, 1.25], collar: [0.95, 0.38, 0.75], junction: [0.98, 0.35, 0.7], plugTop: [0, 1.0, 1.45], center: [0, 0.3, 0.5] } as const satisfies Record<string, P3>;
export const CUT_PTS = { leaf: [2.05, 0, 0.44], pin: [-0.3, 0, -0.17] } as const satisfies Record<string, P3>;
export const contactAt = (loose: number): P3 => [1.2 - 0.2 * loose, 0.05, 0.18];
/** The cable after the plug end: straight to the left (world (-1, +1, 0) is level on the screen), so it runs above the captions and off the frame. */
export const CABLE_TO: P3[] = [[-0.9, 2.8, 0.5], [-2.6, 4.6, 0.4]];
/** Round 4: the cable is a chain of fixed length (src/cableSim.ts) that hangs from the plug's end and rests on the shelf and the plate. */
export const CABLE_LEN = 5.6;
const out = (p: P3): P2 => isoAt(p, OUT.u, OUT.o);
/** The plug's radius by height above its plate (IsoPlug in components/Iso.tsx, the same numbers): the body, then the thin strain relief. */
const plugRadius = (dy: number): number => {
  for (let i = 1; i < PLUG_PROFILE.length; i++) {
    const [a, ra, rb] = PLUG_PROFILE[i - 1], b = PLUG_PROFILE[i][0];
    if (dy <= b) return ra + (rb - ra) * ((dy - a) / (b - a));
  }
  return 0.18;
};
/** The screen points of the plug's body and cable end for a gap (the plug moves with its gap), and the cable's route on the screen. */
export function plugScreen(gap: number, cam: Cam2, cableNodes: readonly P3[] = [[0, 0.3 + gap + BOOT_END, 0.5], ...CABLE_TO]): { body: P2[]; cable: P2[] } {
  const y0 = 0.3 + gap, body: P2[] = [];
  for (let dy = 0; dy <= BOOT_END; dy += 0.08) {
    const r = plugRadius(dy);
    for (let a = 0; a < 16; a++) { const th = (a / 16) * Math.PI * 2; body.push(toScreen(cam, out([r * Math.cos(th), y0 + dy, 0.5 + r * Math.sin(th)]))); }
  }
  const cable = cableNodes.map((p) => toScreen(cam, out(p)));
  return { body, cable };
}
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

/** A quote for a source card: a part of the claim's own text, at most two lines at the card's width (38 px, 750 px wide). Never typed here:
    the words are the story's. Preference: the whole text if it fits; else the longest start that ends at a comma (the comma is dropped); else the
    longest start that fits, with "…" to show it goes on. */
export const QUOTE_FS = 38, QUOTE_W = 750;
export const quoteLines = (text: string): number => {
  let lines = 0, cur = "";
  for (const w of text.split(/\s+/).filter(Boolean)) {
    if (cur && textWidthEstimate(`${cur} ${w}`, QUOTE_FS) > QUOTE_W) { lines++; cur = w; } else cur = cur ? `${cur} ${w}` : w;
  }
  return lines + (cur ? 1 : 0);
};
export function quoteFor(text: string): string {
  const words = text.trim().split(/\s+/);
  if (quoteLines(text) <= 2) return text.trim();
  let commaCut: string | null = null, prefix: string | null = null;
  for (let k = words.length - 1; k >= 1; k--) {
    const head = words.slice(0, k).join(" ");
    if (quoteLines(head) > 2) continue;
    if (/[,;]$/.test(words[k - 1]) && !commaCut) commaCut = head.replace(/[,;]$/, "");
    if (!prefix) prefix = head;
    if (commaCut && prefix) break;
  }
  return commaCut ? `${commaCut}…` : `${prefix ?? words[0]}…`;
}

const domain = (url: string) => { try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; } };

export type Plan = ReturnType<typeof makePlan>;

/** PLAN-SAFE-AREA-2: the caption gave back about 130 px (it ends at 1720), so the outside view is placed lower on the screen by stageDrop px: each key's focus moves up by
    stageDrop / zoom, so the shift on the screen is the same at every zoom. The macro-lens keys (zoom above 2) stay: the view is locked on the junction there. The first and
    the last key get the same shift, so the loop-back still ends on the opening shot. */
export const stageDrop = 80;
const dropped = (keys: Key2[]): Key2[] => keys.map((k) => (k.zoom > 2 ? k : { ...k, y: k.y - stageDrop / k.zoom }));

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
  const outKeys: Key2[] = dropped([
    { t: 0, x: 520, y: 980, zoom: 0.8 },
    { t: 2.0, x: C0[0] + 20, y: C0[1] + 40, zoom: 1.28 },
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
    { t: m.tips + 0.3, x: C0[0] - 100, y: C0[1] - 250, zoom: 1.0 },
    { t: m.tip2, x: C0[0], y: C0[1], zoom: 1.18 },
    // round 2: from 38 s the tips settle at 1.1 so the pulled-out plug clears the captions and the plate and ring stay in frame
    { t: 39.2, x: C0[0], y: C0[1], zoom: 1.0 },
    { t: m.outro, x: C0[0], y: C0[1], zoom: 1.0 },
    // round 3: the outro is a loop-back; the camera eases home to the opening shot and holds there for the last 0.2 s,
    // so the last frame is exactly the first one's camera
    { t: total - 0.2, x: 520, y: 980, zoom: 0.8 },
  ]);
  const outCam = (t: number): Cam2 => cam2At(outKeys, t);

  const CT = lab(contactAt(0)), CL = lab(contactAt(1));
  const labKeys: Key2[] = [
    // step 5: the first lab frames are already close (the cutaway reads without its label; it used to be small until about 10.7 s)
    { t: m.inside, x: CT[0], y: CT[1], zoom: 0.95 },
    { t: m.inside + 0.7, x: CT[0] - 120, y: CT[1] - 40, zoom: 1.05 },
    { t: m.macro, x: CT[0] - 60, y: CT[1] - 20, zoom: 1.2 },
    { t: m.contactLabel + 0.1, x: CT[0], y: CT[1] + 50, zoom: 1.75 },
    { t: beat("kendur").a, x: CT[0] + 10, y: CT[1] + 50, zoom: 1.8 },
    { t: m.loosen + 0.2, x: CL[0], y: CL[1] + 70, zoom: 1.45 },
    { t: cardIn1 - 0.4, x: CL[0] - 10, y: CL[1] + 70, zoom: 1.4 },
    // step 7: a slow push-in while the card is up and the contact heats (22-24 s was near still)
    { t: cardIn1 + 0.2, x: CL[0], y: CL[1] + 230, zoom: 1.3 },
    { t: cardOut1, x: CL[0], y: CL[1] + 230, zoom: 1.5 },
    { t: cardOut1 + 0.6, x: CL[0], y: CL[1] + 40, zoom: 1.5 },
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
  const core = (t: number) => ({
    outHeat: t < m.inside ? 0.25 + 0.5 * sm(ramp(t, m.hookHeat, 1.6)) : t < m.tips ? 0.75 + 0.25 * sm(ramp(t, exitEnd, 1)) : 1 - sm(ramp(t, m.unplug + 0.2, 1.2)),
    scorch: t < m.exit ? 0 : t < m.replace ? sm(ramp(t, m.melt - 0.3, 1.0)) : 1 - sm(ramp(t, m.replace, 0.35)),
    // step 1: once unplugged the plug stays out (the socket is replaced, so the new plate must show: no plug in front of it)
    gap: t < m.unplug ? 0 : 1.6 * sm(ramp(t, m.unplug, 0.3)),
    wobble: t > m.wobble && t < m.wobble + 1.5 ? Math.sin((t - m.wobble) * 15) * Math.sin(Math.PI * (t - m.wobble) / 1.5) : 0,
    smoke: t >= m.exit && t < m.tips + 0.4 ? sm(ramp(t, m.melt - 0.6, 0.6)) * (1 - sm(ramp(t, m.tips, 0.4))) : 0,
    loose: sm(ramp(t, m.loosen, 0.9)),
    labHeat: t < m.hot ? 0 : t < beat("akhir").a ? 0.8 * sm(ramp(t, m.hot, 1.0)) : 0.8 + 0.2 * (0.5 + 0.5 * Math.sin((t - beat("akhir").a) * 4)),
    current: 1,
    fresh: t >= m.replace ? ramp(t, m.replace, 0.5) : 0,
  });
  // round 3, the loop: from the outro on, the plug goes back in and every object eases to its opening value (the t = 0 state),
  // so the state at the last frame is the state at the first one (tests/colokan.test.ts checks both ends)
  const LOOP_EASE = Math.min(1.6, total - m.outro);
  /** 0 until the outro, then 0 → 1 as the loop comes home (the picture crossfades its background and the wisps to their t = 0 pose by the same weight). */
  const loopWeight = (t: number) => sm(ramp(t, m.outro, LOOP_EASE));
  const state = (t: number) => {
    const s = core(t), w = loopWeight(t);
    if (w === 0) return s;
    const h = core(0), mix = (a: number, b: number) => a + (b - a) * w;
    return { ...s, outHeat: mix(s.outHeat, h.outHeat), scorch: mix(s.scorch, h.scorch), gap: mix(s.gap, h.gap), wobble: mix(s.wobble, h.wobble),
      smoke: mix(s.smoke, h.smoke), loose: mix(s.loose, h.loose), labHeat: mix(s.labHeat, h.labHeat), fresh: mix(s.fresh, h.fresh) };
  };

  // round 4: the cable is a chain (src/cableSim.ts) run once for the whole video from the plug's end, which follows the plug's gap and wobble;
  // a frame reads its nodes back, so the picture never runs the simulation itself
  const plugEnd = (t: number): [number, number, number] => { const s = state(t), cx = s.wobble * 0.05, tip = s.wobble * 0.14; return [cx + tip * (BOOT_END / 2), 0.3 + s.gap + BOOT_END, 0.5]; };
  // the world: z is up, the wall is the plane y = 0.3 (the plate front), the plug sticks out along +y, the floor is the plane z = -2.05 (ISO floor block)
  const cableFrames = simulateCable({ anchor: plugEnd, duration: total, fps: FPS, length: CABLE_LEN, axis: [0, 1, 0], stub: 0.9, floorZ: -2.05,
    wall: { face: 0.3, x0: -2.1, x1: 2.1, z0: -2.05, z1: 2.3 },
    body: (t) => { const g = state(t).gap; return { x: 0, z: 0.5, r: 0.95, y0: 0.3 + g, y1: 1.9 + g }; } });
  // from the outro on, the cable eases to its opening shape with the same loop weight as the rest, so the last frame is the first one's cable
  const cableAt = (t: number): P3[] => {
    const a = cableFrames[Math.min(cableFrames.length - 1, Math.max(0, Math.round(t * FPS)))], w = loopWeight(t);
    if (w <= 0) return a;
    return a.map((p, i) => [0, 1, 2].map((k) => p[k] + (cableFrames[0][i][k] - p[k]) * w) as [number, number, number]);
  };

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
  // round 5: the yellow outline of the plate is not a numbered step, so its label has no number disc, and it is a short tag of at most two
  // story words that is not the card's own line (the tip card above already says "Teknisi ganti stop kontak"); no tag if the story has none
  const plateTag = fromStory(story, "stop kontak");
  if (plateTag && plateTag.split(/\s+/).length <= 2) labels.push({ id: "plate", text: plateTag.toLowerCase(), world: "out", at: SOCKET_PTS.plate, off: [-330, -60], from: m.replace + 0.2, to: m.outro - 0.7 });   // ends before the second tip card (it starts at y 412 now, PLAN-SAFE-AREA)
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
    const top = topTextBox().y1 + 20 + h / 2, bottom = captionBox(story.captionStyle, story.platforms).y0 - 20 - h / 2;
    const x = Math.max(SAFE.left + wPill / 2, Math.min(SAFE.right - wPill / 2, a[0] + l.off[0])), y = Math.max(top, Math.min(bottom, a[1] + l.off[1]));
    return { x, y, ax: a[0], ay: a[1], w: wPill, h, box: { x0: x - wPill / 2, y0: y - h / 2, x1: x + wPill / 2, y1: y + h / 2 } as Box };
  };

  const claimOf = (id: string) => items(id).flatMap((i) => (i.type === "source" ? [i] : []))[0];
  const cardOf = (id: string, from: number, to: number) => {
    const src = claimOf(id);
    if (!src) return null;
    const c = story.claims[src.claim - 1];
    if (!c) return null;
    return { claim: src.claim, quote: src.quote ?? quoteFor(c.text), org: src.org, date: src.date, domain: domain(c.sources[0]), from, to };
  };
  // the source cards stand just above the caption box (1405 for the classic caption of YouTube; higher when the story is cross-posted to a stricter platform)
  const cardBottom = Math.round(captionBox(story.captionStyle, story.platforms).y0) - 4;
  const cards = [cardOf("kendur", cardIn1, cardOut1), cardOf("akhir", cardIn2, cardOut2)].filter((c): c is NonNullable<typeof c> => !!c);
  const chipFor = (claimIdx: number) => { const c = story.claims[claimIdx]; return c ? [...new Set(c.sources.map(domain))].join(" · ") : ""; };
  /** The claims of a beat that have no card in it: their domains as a chip. */
  const chipsOf = (id: string) => story.claims.map((c, i) => ({ c, i })).filter(({ c, i }) => c.beats.includes(id) && !cards.some((k) => k.claim === i + 1 && claimOf(id)?.claim === i + 1)).map(({ i }) => chipFor(i));
  // the chip line is at most 880 px at 40 px mono: when a claim has more domains, the first ones that fit are shown (the story keeps them all)
  const fitChip = (text: string): string => {
    const fits = (t: string) => [...`SUMBER  ${t}`].length * 40 * 0.6 + 44 <= 880;
    const parts = text.split(" · ");
    for (let k = parts.length; k >= 1; k--) { const t = parts.slice(0, k).join(" · "); if (fits(t)) return t; }
    return parts[0];
  };
  const chips = [
    ...(chipsOf("dalam")[0] ? [{ id: "chip-dalam", text: fitChip(chipsOf("dalam")[0]), onDark: true, from: m.macro + 0.4, to: beat("dalam").b - 0.2 }] : []),
    ...(chipsOf("akhir").filter((x) => !cards.some((k) => chipFor(k.claim - 1) === x))[0] ? [{ id: "chip-akhir", text: fitChip(chipsOf("akhir").filter((x) => !cards.some((k) => chipFor(k.claim - 1) === x))[0]), onDark: true, from: m.loop + 0.6, to: m.exit - 0.1 }] : []),
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
  const TIP = { x: 80, y: 412, w: 840 };                 // inside SAFE (x 60..920) and below the top text (it ends at y 397; PLAN-SAFE-AREA, B24)

  // the sting and the outro: the story's own pill and label texts
  const stingPill = items("sting").flatMap((i) => (i.type === "pill" ? [i.text] : []))[0] ?? beat("sting").beat.text;
  // round 3: the outro draws no text (it is the loop-back). The sting is a small row in the top band, which is clear while the
  // socket and plug fill the middle (the hero box tops out at about y 552): the mascot, then the pill, centred on x 540
  const pillW = textWidthEstimate(stingPill, 52) + 60, rowW = 200 + 24 + pillW, rowX = 540 - rowW / 2;
  const STING = { mx: rowX + 100, my: 400, mw: 200, px: rowX + 200 + 24 + pillW / 2, py: 400, fs: 52, pillW };
  const stingPillBox = { x0: STING.px - pillW / 2, y0: STING.py - 46, x1: STING.px + pillW / 2, y1: STING.py + 46 };
  const stingMascotBox = { x0: STING.mx - STING.mw / 2, y0: STING.my - STING.mw * 0.6, x1: STING.mx + STING.mw / 2, y1: STING.my + STING.mw * 0.6 };

  /** What is on the screen at `t` as boxes for the layout manager (src/layout.ts): the hero (the socket's plate and plug, or the cutaway's contact
      region), labels (text), cards, tip cards and the loop (pictures), the top text and the captions. `conflicts(specs)` must be empty. */
  const specsAt = (t: number, cardH: (quote: string) => number, tipH: (i: number) => number): Spec[] => {
    const specs: Spec[] = [];
    if (tops.some((x) => t >= x.a && t < x.b)) specs.push({ id: "top-text", role: "banner", box: topTextBox() });
    const captioned = story.beats.some((b) => b.kind !== "sting" && b.kind !== "outro" && t >= beat(b.id).a && t < beat(b.id).b);
    if (captioned) specs.push({ id: "caption", role: "caption", box: captionBox(story.captionStyle, story.platforms) });
    const inLab = t >= m.inside && t < m.exit;
    if (!inLab && t < m.outro) {
      const c = outCam(t), pts = [[-1.2, 0.3, 1.7], [1.2, 0.3, 1.7], [-1.2, 0.3, -0.7], [1.2, 0.3, -0.7], [0, 1.9, 0.5]].map((p) => toScreen(c, out(p as unknown as P3)));
      specs.push({ id: "hero", role: "hero", box: { x0: Math.min(...pts.map((p) => p[0])), y0: Math.min(...pts.map((p) => p[1])), x1: Math.max(...pts.map((p) => p[0])), y1: Math.max(...pts.map((p) => p[1])) } });
    }
    if (inLab) {
      // the key of the cutaway is the contact (the pin between the leaves): text may lie over the plastic round it, never over the contact
      const c = labCam(t), cc = toScreen(c, lab(contactAt(state(t).loose))), r = 70 + 50 * Math.min(2, c.zoom);
      specs.push({ id: "contact", role: "hero", box: { x0: cc[0] - r, y0: cc[1] - r, x1: cc[0] + r, y1: cc[1] + r } });
    }
    for (const l of labels) if (t >= l.from + 0.1 && t < l.to) specs.push({ id: `label:${l.id}`, role: "text", box: labelAt(l, t).box });
    if (t >= m.sting && t < m.stingEnd) specs.push({ id: "sting:mascot", role: "picture", box: stingMascotBox }, { id: "sting:pill", role: "text", box: stingPillBox });
    for (const cd of cards) if (t >= cd.from + 0.2 && t < cd.to) { const h = cardH(cd.quote); specs.push({ id: `card:${cd.claim}`, role: "picture", box: { x0: 90, y0: cardBottom - h, x1: 920, y1: cardBottom } }); }
    tips.forEach((tp, i) => { if (t >= tp.from + 0.2 && t < tp.to) specs.push({ id: `tip:${i}`, role: "picture", box: { x0: TIP.x, y0: TIP.y, x1: TIP.x + TIP.w, y1: TIP.y + tipH(i) } }); });
    return specs;
  };
  const problemsAt = (t: number, cardH: (q: string) => number, tipH: (i: number) => number) => conflicts(specsAt(t, cardH, tipH));

  return { cardBottom, B, beat, total, w, m, exitEnd, cardIn1, cardOut1, cardIn2, cardOut2, outKeys, labKeys, outCam, labCam, lens, outsideVisible, labVisible, state, tops, labels, labelAt, LABEL_FS, cards, chips, tips, TIP, stingPill, STING, loopWeight, specsAt, problemsAt, loopWords: [fromStory(story, "panas"), fromStory(story, "hambatan")] as const, J, plug: (t: number, cam: Cam2) => plugScreen(state(t).gap, cam, cableAt(t)), cableAt };
}
