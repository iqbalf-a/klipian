/* Magnet menempel di kulkas tanpa lem — the timing of this video (pure: no React here). The formula is DESIGN.md section 0b: the hook, the "Intip yuk!" sting right after it,
   the explain beats, the result, the tips and the loop-back outro. One set (B27): a kitchen wall with a fridge (the hero: a magnet holding a note on its door), a counter with a
   cup, a steel tin and an aluminium pot, a window. The camera is a function of the clock: the wide shot, the establishing push, a push or a pan inside the same set per beat,
   and the way back to the wide shot in the outro (so the last frame is the first). The domain and the ferrite beats show a magnified cut of the material in a panel over the set.
   Colours are tokens, shapes are iso kit blocks (src/iso.ts). Plain Node: no React here (B26).
   motion-exception: the hook's establishing push (zoom 0.5 to 1.25 in 1.4 s) is the registry's establishing push (B27.8); the pans stay inside 800 px a second. */
import type { StoryT } from "../../src/schema.ts";
import { FPS, sequencePlan } from "../../src/timeline.ts";
import { wordsOfBeat } from "../../src/captions.ts";
import { cam2At, isoAt, toScreen, type Cam2, type Key2, type P2, type P3 } from "../../src/iso.ts";
import { captionBox, textWidthEstimate } from "../../src/layout.ts";

/** The set's scale: 1 world unit = 50 cm (a fridge 70 cm wide and 150 cm high is 1.4 x 3.0). U px a unit, O the screen point of the world origin at rest. */
export const U = 260;
export const O: P2 = [540, 1500];
export const at = (p: P3): P2 => isoAt(p, U, O);

/** The pieces of the set as world boxes (a, b), drawing order. The fridge stands against the wall, the counter beside it, things stand on their surfaces. */
export const SET = {
  wall: { a: [-14, -0.5, 0], b: [14, 0, 9] },
  floor: { a: [-14, 0, -0.5], b: [14, 14, 0] },
  fridge: { a: [0, 0.1, 0], b: [1.4, 1.4, 3.0] },
  counter: { a: [2.4, 0.08, 0], b: [14, 1.4, 1.7] },
  counterTop: { a: [2.4, 0.08, 1.7], b: [14, 1.5, 1.8] },
  window: { x0: 3.4, x1: 6.4, z0: 3.3, z1: 6.3 },
  tin: { a: [4.6, 0.5, 1.8], b: [5.3, 1.2, 2.5] },
  pot: { a: [6.4, 0.5, 1.8], b: [7.2, 1.2, 2.6] },
  cup: { at: [3.0, 0.8, 1.8] as P3 },
  note: { a: [0.3, 1.4, 1.2], b: [1.1, 1.43, 2.2] },
} as const;
/** The door magnet: a block 15 cm wide on the note's top, its centre. */
export const MAGNET_AT: P3 = [0.7, 1.43, 2.05];
export const MAG = { w: 0.3, d: 0.1, h: 0.3 } as const;                     // x, y, z size of a magnet block
/** Where the second magnet meets the pot and the tin (the face y = 1.2). */
export const POT_FACE: P3 = [6.8, 1.2, 2.2];
export const TIN_FACE: P3 = [4.95, 1.2, 2.2];
export const FLOOR_REST_Z = 1.8 + MAG.h / 2;                                    // a magnet lying on the counter top

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
/** cubic in-out easing, the same curve as src/motion.ts easeInOut (kept here so the plan stays plain Node). */
export const ease = (x: number) => { const k = clamp01(x); return k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2; };
const norm = (w: string) => w.toLowerCase().normalize("NFD").replace(/[^\p{L}\p{N}]/gu, "");

/** A quote for a source card: a part of the claim's own text, at most two lines at the card's width (38 px, 750 px wide). */
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

/** The moments the camera follows (seconds): the end of the sting, the ends of logam, domain, sejajar, the start and end of hasil, alum, lentur, tips, and the video's end. */
export type CamTimes = { stingEnd: number; logamB: number; domainB: number; sejajarB: number; hasilA: number; hasilB: number; alumA: number; alumB: number; lenturA: number; lenturB: number; tipsA: number; tipsB: number; total: number };
const FIX = (p: P3, zoom: number, dy = 0) => { const a = at(p); return { x: a[0], y: a[1] + dy, zoom }; };
const DOOR: P3 = [0.7, 1.4, 1.5], NOTE: P3 = [0.7, 1.4, 1.9];
export const camKeysFor = (T: CamTimes): Key2[] => [
  { t: 0, ...FIX(DOOR, 0.5) },
  { t: 1.5, ...FIX(DOOR, 0.5) },                                  // the wide shot of the set, 1.5 s
  { t: 2.9, ...FIX(DOOR, 1.25) },                                 // the establishing push: the fridge is 60 to 70 % of the width
  { t: T.stingEnd, ...FIX(DOOR, 1.22) },                          // sting: the world keeps moving
  { t: T.logamB, ...FIX(NOTE, 1.2) },                            // logam: a slow push to the magnet on the note (0.034 zoom a second)
  { t: T.domainB, ...FIX(NOTE, 1.2) },                           // domain: the set behind the panel keeps pushing
  { t: T.sejajarB - 0.4, ...FIX(NOTE, 1.2) },
  { t: T.hasilA + 2.2, ...FIX(DOOR, 1.1) },                       // hasil: the camera pulls out to see the whole fridge
  { t: T.hasilB, ...FIX(DOOR, 1.16) },
  { t: T.alumA + 1.9, ...FIX([6.4, 1.2, 2.1], 1.12) },            // alum: a pan along the counter to the pot (a bit under 800 px a second)
  { t: T.alumB, ...FIX(POT_FACE, 1.3) },
  { t: T.lenturA + 1.6, ...FIX([5.6, 1.2, 2.1], 1.2) },           // lentur: a short pan to the tin while the panel is up
  { t: T.lenturB, ...FIX([5.6, 1.2, 2.1], 1.24) },
  { t: T.tipsA + 1.2, ...FIX([5.6, 1.2, 2.1], 0.92) },            // tips: out, the tin, the pot and the cup in one shot
  { t: T.tipsB, ...FIX([5.6, 1.2, 2.1], 1.0) },
  { t: T.total - 0.2, ...FIX(DOOR, 0.5) },                        // outro: back to the hook's wide shot, the last frame is the first
];
/** This story's moments (beats 3 + 1 + 7 + 9 + 8 + 7 + 6 + 6 + 9 + 4 = 60 s); makePlan reads them from the story, HERO_BOX_AT from here. */
const T0: CamTimes = { stingEnd: 4, logamB: 11, domainB: 20, sejajarB: 28, hasilA: 28, hasilB: 35, alumA: 35, alumB: 41, lenturA: 41, lenturB: 47, tipsA: 47, tipsB: 56, total: 60 };


export function makePlan(story: StoryT) {
  const seq = sequencePlan(story);
  const B: Record<string, { a: number; b: number; beat: (typeof story.beats)[number]; index: number }> = {};
  seq.forEach((p, i) => { B[p.beat.id] = { a: p.from / FPS, b: (p.from + p.beatFrames) / FPS, beat: p.beat, index: i }; });
  const total = seq.reduce((n, p) => n + p.beatFrames, 0) / FPS;
  const beat = (id: string) => B[id] ?? { a: 0, b: total, beat: story.beats[0], index: 0 };
  /** The video second when a word is spoken (the nth word starting with `prefix`), or a share of the beat if the story no longer has it. */
  const w = (id: string, prefix: string, nth = 0, share = 0.5): number => {
    const bb = beat(id), found = wordsOfBeat(bb.beat).filter((x) => norm(x.w).startsWith(norm(prefix)))[nth];
    return Math.round((bb.a + (found ? found.a : share * bb.beat.dur)) * FPS) / FPS;
  };
  const starts = story.beats.map((_, i) => story.beats.slice(0, i).reduce((a, b) => a + b.dur, 0));
  const sting = starts[1] ?? 0;                                   // must 1: the "Intip yuk!" sting is the second beat
  const outro = starts.at(-1) ?? total;                           // must 2: the loop-back outro is the last beat
  const m = {
    sting, stingEnd: sting + (story.beats[1]?.dur ?? 1), outro, end: total, react: NaN,
    ring: 1.0,                                                     // the hook: the magnet's ring pulses
    panel1: beat("domain").a + 0.3, panel1End: beat("sejajar").b - 0.2,                // the domain panel stays up over both beats
    magIn: beat("sejajar").a + 0.5, alignFrom: beat("sejajar").a + 2.1,
    pull: w("hasil", "tarikan", 0, 0.1), holds: w("hasil", "menahan", 0, 0.45),
    panel2: beat("lentur").a + 0.3, panel2End: beat("lentur").b - 0.15,
    mag2In: beat("alum").a + 1.9, mag2Touch: beat("alum").a + 3.0, mag2Fall: Math.max(beat("alum").a + 3.4, w("alum", "tidak", 0, 0.7)),
    mag3In: w("tips", "besi", 1, 0.55), potTry: w("tips", "aluminium", 0, 0.8),
  };

  // ---------------------------------------------------------------- the camera
  const keys = camKeysFor({ stingEnd: m.stingEnd, logamB: beat("logam").b, domainB: beat("domain").b, sejajarB: beat("sejajar").b, hasilA: beat("hasil").a, hasilB: beat("hasil").b, alumA: beat("alum").a, alumB: beat("alum").b, lenturA: beat("lentur").a, lenturB: beat("lentur").b, tipsA: beat("tips").a, tipsB: beat("tips").b, total });
  const cam = (t: number): Cam2 => cam2At(keys, t);

  // ---------------------------------------------------------------- the moving things
  /** The loose magnet of the alum beat: it comes in toward the pot, touches, does not hold and drops on the counter. Centre in world units, size k (0 = not there). */
  const magnet2 = (t: number): { p: P3; k: number } => {
    const rest: P3 = [POT_FACE[0] - 0.55, 1.38, FLOOR_REST_Z];
    if (t < m.mag2In - 0.2 || t >= outro) return { p: [POT_FACE[0], 2.6, POT_FACE[2]], k: 0 };
    const k = clamp01((t - (m.mag2In - 0.2)) / 0.3) * (1 - clamp01((t - outro) / 0.3));
    if (t < m.mag2Touch) {
      const e = ease((t - m.mag2In) / (m.mag2Touch - m.mag2In));
      return { p: [POT_FACE[0], 2.6 + (POT_FACE[1] + MAG.d / 2 - 2.6) * e, POT_FACE[2]], k };
    }
    if (t < m.mag2Fall) return { p: [POT_FACE[0], POT_FACE[1] + MAG.d / 2, POT_FACE[2]], k };
    const f = t - m.mag2Fall, z = Math.max(FLOOR_REST_Z, POT_FACE[2] - 4.4 * f * f), bounce = z <= FLOOR_REST_Z ? 0.06 * Math.abs(Math.sin((f - Math.sqrt((POT_FACE[2] - FLOOR_REST_Z) / 4.4)) * 9)) * Math.exp(-(f - 0.3) * 2) : 0;
    const slide = clamp01(f / 0.9);
    return { p: [POT_FACE[0] + (rest[0] - POT_FACE[0]) * ease(slide), POT_FACE[1] + MAG.d / 2 + (rest[1] - POT_FACE[1] - MAG.d / 2) * ease(slide), z + bounce], k };
  };
  /** The magnet that holds on the tin (tips): pops in, stays until the outro. */
  const magnet3 = (t: number): number => clamp01((t - m.mag3In) / 0.3) * (1 - clamp01((t - outro) / 0.3));

  // ---------------------------------------------------------------- the domain panel (screen px)
  const cb = captionBox(story.captionStyle, story.platforms);
  const cardBottom = Math.round(cb.y0) - 4;
  const PANEL = { x0: 100, y0: 430, x1: 920, y1: Math.min(1260, cardBottom - 270) };
  const claim = (i: number) => story.claims[i - 1];
  const cardOf = story.beats.flatMap((b) => b.scene.items.filter((it) => it.type === "source").map((it) => (it.type === "source" ? { beat: b.id, claim: it.claim, org: it.org, date: it.date, quote: it.quote ?? quoteFor(claim(it.claim).text), domain: domain(claim(it.claim).sources[0]) } : null)))[0] ?? null;
  const chipFor = (idx: number): string => { const c = story.claims[idx - 1]; return c ? [...new Set(c.sources.map(domain))].join(" · ") : ""; };
  const chips = [{ beat: "logam", text: chipFor(1) }, { beat: "alum", text: chipFor(3) }, { beat: "lentur", text: chipFor(4) }].filter((c) => c.text);

  return {
    m, total, B, beat, w, cam, keys, magnet2, magnet3, PANEL, cardBottom, cardOf, chips,
    // 0 at the start, 1 in the loop-back: the scene is the first beat's again at the end (the loop)
    loopWeight: (t: number) => clamp01((t - outro) / 0.5),
    tops: story.beats.filter((b) => b.kind !== "sting" && b.kind !== "outro").map((b) => ({ a: beat(b.id).a, b: beat(b.id).b, headline: b.text })) as { a: number; b: number; headline?: string }[],
    labels: story.beats.flatMap((b) => b.scene.items.filter((i) => i.type === "label").map((i) => ({ to: beat(b.id).b, text: i.type === "label" ? i.text : "" }))) as { to: number; text: string }[],
  };
}

/** The hero's box at time t, in the 1080 px frame (x, y, w, h): the fridge seen through the camera. */
export const HERO_BOX_AT = (t: number) => {
  const c = cam2At(camKeysFor(T0), t), s = SET.fridge;
  const pts = [s.a[0], s.b[0]].flatMap((x) => [s.a[1], s.b[1]].flatMap((y) => [s.a[2], s.b[2]].map((z) => toScreen(c, at([x, y, z]))))) as P2[];
  const x0 = Math.min(...pts.map((p) => p[0])), x1 = Math.max(...pts.map((p) => p[0])), y0 = Math.min(...pts.map((p) => p[1])), y1 = Math.max(...pts.map((p) => p[1]));
  return { x: (x0 + x1) / 2, y: (y0 + y1) / 2, w: x1 - x0, h: y1 - y0 };
};
