/* Hujan buatan: benarkah hujan bisa dipesan? — the timing of this video (pure: no React here). The formula is DESIGN.md section 0b: the hook, the "Intip yuk!" sting
   right after it, the explain beats, the result, the tips and the loop-back outro. Everything is read from the beats and the words of the narration, so the picture
   follows the voice once klipian imports one. Colours come from src/tokens.ts; easings and springs from src/motionLanguage.ts (must 3 of B16).
   One continuous take: the stage (sea, land, a cloud over them), the seeding aircraft and the ground grains, the lens into the cloud (salt draws vapour, silver
   iodide is an ice-like crystal, the drop grows heavy and falls), back out to the rain, the SEBAGIAN stamp, the two tips, and the loop-back. */
import type { BeatT, StoryT } from "../../src/schema.ts";
import { FPS, sequencePlan } from "../../src/timeline.ts";
import { wordsOfBeat } from "../../src/captions.ts";
import { cam2At, isoAt, toScreen, type Cam2, type Key2, type P2, type P3 } from "../../src/iso.ts";
import { captionBox, conflicts, textWidthEstimate, topTextBox, type Box, type Spec } from "../../src/layout.ts";
import { SAFE } from "../../src/tokens.ts";
import { CLOUD_GREY, LAND_TOP, SEA_TOP, cloudParts } from "../../src/natureGeometry.ts";

// the stage in world px at rest (camera focus 590, 960, zoom 1): the nature kit's sea and land, placed so the cloud is 62 % of the frame wide
// PLAN-SAFE-AREA-2: the caption gave back about 130 px (it ends at 1720), so the stage moves down by stageDrop px to fill the frame between the top text and the caption
export const stageDrop = 100;
export const OUT = { u: 160, o: [485, 1044 + stageDrop] as P2 };
export const CLOUD = { cx: CLOUD_GREY.cx, cy: CLOUD_GREY.cy, cz: CLOUD_GREY.cz, grow: 1.25 };
const out = (p: P3): P2 => isoAt(p, OUT.u, OUT.o);
export const CLOUD_PT = out([CLOUD.cx, CLOUD.cy, CLOUD.cz]);              // the cloud's centre
export const LAND_PT = out([1.9, 0.3, LAND_TOP]);                          // the middle of the land's top
export const SEA_PT = out([-0.5, -0.4, SEA_TOP]);
/** The cloud's box in world px (its puffs, bellies and wisps). */
export function cloudBox(): Box {
  const parts = cloudParts(CLOUD.cx, CLOUD.cy, CLOUD.cz, CLOUD.grow);
  const pts = [...parts.puffs, ...parts.back, ...parts.wisps].flatMap((p) => [out([p.x, p.y, p.z + p.r]), out([p.x, p.y, p.z - p.r]), out([p.x + p.r, p.y - p.r, p.z]), out([p.x - p.r, p.y + p.r, p.z])]);
  const bel = parts.belly.flatMap((b) => [out([b.x - b.rs, b.y + b.rs, b.z - b.rz]), out([b.x + b.rs, b.y - b.rs, b.z - b.rz])]);
  const all = [...pts, ...bel];
  return { x0: Math.min(...all.map((p) => p[0])), y0: Math.min(...all.map((p) => p[1])), x1: Math.max(...all.map((p) => p[0])), y1: Math.max(...all.map((p) => p[1])) };
}

const norm = (w: string) => w.toLowerCase().normalize("NFD").replace(/[^\p{L}\p{N}]/gu, "");
const domain = (url: string) => { try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; } };
const ramp = (t: number, a: number, d: number) => Math.max(0, Math.min(1, (t - a) / d));
const sm = (k: number) => k * k * (3 - 2 * k);
const ease = (k: number) => 1 - Math.pow(1 - k, 3);

export type Top = { a: number; b: number; kicker?: string; headline: string };
const KICKER: Record<string, string> = { normal: "CARA KERJA", loose: "CARA KERJA", result: "HASILNYA", tips: "TIPS" };

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
  // the story's own "AWAN" label stands for the cloud object, which is drawn now, so it is not a pointer label
  const labelsOf = (id: string) => items(id).flatMap((i) => (i.type === "label" && i.text !== "AWAN" ? [i] : []));
  const highlight = (id: string) => items(id).flatMap((i) => (i.type === "banner" ? i.highlight ?? [] : []))[0] ?? null;

  // ---------------------------------------------------------------- the moments
  const m = {
    hookQ: 0.6, hookLabel: 1.3,
    sting: beat("intip").a, stingEnd: beat("intip").b,
    plane: beat("kirim").a + 0.15, planeDur: 3.3, seedLabel: w("kirim", "bahan", 0, 0.1) + 0.1, ground: w("kirim", "generator", 0, 0.65) - 0.9,
    magnifier: beat("kirim").b - 1.2, through: beat("kirim").b - 0.9, inside: beat("inti").a,
    salt: w("inti", "serbuk", 0, 0.1), saltLabel: w("inti", "garam", 0, 0.1) + 0.05, pull: w("inti", "menarik", 0, 0.3), agi: w("inti", "perak", 0, 0.55), agiLabel: w("inti", "kristal", 0, 0.75),
    stick: w("tumbuh", "tempat", 0, 0.2), small: w("tumbuh", "uap", 0, 0.15), big: w("tumbuh", "tetes", 0, 0.45), fall: w("tumbuh", "jatuh", 0, 0.8) - 0.1,
    verdict: beat("hasil").a + 0.3, helps: w("hasil", "garam", 0, 0.1), notButton: w("hasil", "bukan", 0, 0.45), debate: w("hasil", "ilmuwan", 0, 0.65), react: w("hasil", "ilmuwan", 0, 0.65) - 0.1,
    tips: beat("tips").a, tip1: w("tips", "satu", 0, 0.12), tip2: w("tips", "dua", 1, 0.55),
    outro: beat("outro").a, end: total,
  } as Record<string, number>;
  m.groundLabel = m.ground + 0.3;
  m.exit = Math.min(m.fall + 1.2, beat("tumbuh").b - 0.95);          // the lens leaves the cloud as the drop has fallen
  m.exitEnd = m.exit + 0.9;
  m.rainOn = m.exitEnd - 0.35;
  m.rainOff = Math.max(m.rainOn + 2.5, m.notButton + 0.6);
  m.tipsCam = m.tips + 0.3;

  // ---------------------------------------------------------------- the cameras
  const C = CLOUD_PT, L0 = LAND_PT;
  const outKeys: Key2[] = [
    { t: 0, x: 590, y: 1010, zoom: 0.94 },                          // the opening shot: the loop-back returns here
    { t: 2.4, x: 590, y: 985, zoom: 1.0 },
    { t: m.sting - 0.3, x: 590, y: 980, zoom: 1.0 },
    { t: m.sting + 0.2, x: 590, y: 835, zoom: 1.0 },                // the stage settles lower so the sting has the top band
    { t: m.stingEnd + 0.6, x: 590, y: 980, zoom: 1.0 },
    { t: m.magnifier - 0.2, x: 590, y: 960, zoom: 1.04 },           // the slow push on the seeding (kirim)
    { t: m.through, x: C[0], y: C[1], zoom: 1.35 },                 // centred on the cloud for the dive
    { t: m.inside + 0.05, x: C[0], y: C[1], zoom: 2.6 },
    { t: m.exit, x: C[0], y: C[1], zoom: 2.2 },
    { t: m.exitEnd + 0.7, x: 590, y: 980, zoom: 1.04 },             // pulled back out to the rain
    { t: m.verdict + 4, x: 590, y: 980, zoom: 1.08 },
    { t: m.tipsCam, x: 590, y: 790, zoom: 0.74 },                   // the stage drops to make room for the tip cards
    { t: m.outro, x: 590, y: 790, zoom: 0.74 },
    { t: total - 0.2, x: 590, y: 1010, zoom: 0.94 },                // home: the last frame's camera is the first one's
  ];
  const outCam = (t: number): Cam2 => cam2At(outKeys, t);

  /** The magnifier over the cloud: its radius, how far it has blown up (0..1) and whether it is drawn. Appears, hovers, dives; on the way out it shrinks to nothing. */
  const lens = (t: number): { r: number; grow: number; show: boolean } => {
    if (t < m.magnifier || t >= m.exitEnd) return { r: 0, grow: 0, show: false };
    if (t < m.inside) return { r: 210, grow: sm(ramp(t, m.through, m.inside - m.through)), show: true };
    if (t < m.exit) return { r: 210, grow: 1, show: true };
    const k = ramp(t, m.exit, m.exitEnd - m.exit), g = 1 - sm(Math.min(1, k / 0.7)), shrink = sm(Math.max(0, (k - 0.7) / 0.3));
    return { r: 210 * (1 - shrink), grow: g, show: true };
  };
  const insideLens = (t: number) => t >= m.inside - 0.05 && t < m.exit + 0.5;
  const outsideVisible = (t: number) => t < m.inside + 0.05 || t >= m.exit - 0.2;

  // ---------------------------------------------------------------- the states of the stage
  const core = (t: number) => {
    const rain = ramp(t, m.rainOn, 0.6) * (1 - ramp(t, m.rainOff, 0.9));
    const dark = sm(ramp(t, beat("tumbuh").a + 2.5, m.exit + 0.3 - beat("tumbuh").a - 2.5)) * (1 - sm(ramp(t, m.rainOff + 0.5, 3)));
    return {
      dark, rain,
      wet: sm(ramp(t, m.rainOn + 0.5, m.rainOff - m.rainOn)) * (1 - sm(ramp(t, m.tips + 2, m.outro + 1.2 - m.tips - 2))),
      splash: rain > 0.05 ? (t * 0.8) % 1 : 0,
    };
  };
  // the loop: from the outro on every state eases to its t = 0 value (they are all 0 there), so the last frame is the first one's
  const LOOP_EASE = Math.min(1.6, total - m.outro);
  const loopWeight = (t: number) => sm(ramp(t, m.outro, LOOP_EASE));
  const state = (t: number) => {
    const s = core(t), k = loopWeight(t);
    return k === 0 ? s : { dark: s.dark * (1 - k), rain: s.rain * (1 - k), wet: s.wet * (1 - k), splash: s.splash * (1 - k) };
  };
  const phase = (t: number) => (t / total) % 1;                      // the sea's ambient loop is periodic in the video's length

  /** The seeding aircraft's place in world px at `t` (null when it is not flying): level across the stage, in front of the cloud's upper puffs. */
  const planeAt = (t: number): { x: number; y: number; w: number } | null => {
    const k = (t - m.plane) / m.planeDur;
    if (k < 0 || k > 1) return null;
    return { x: -260 + 1640 * k, y: 500 - 14 * Math.sin(k * Math.PI), w: 250 };
  };
  const RACK = { dx: (-18 * 250) / 330, dy: (124 * 250) / 330 };                // the rack under the near wing, from the plane's centre, in px
  /** The grains: from the aircraft's rack they sink into the cloud's face; from the ground they rise to its belly. `a` is the opacity, `s` the size in px. */
  type Grain = { x: number; y: number; a: number; s: number; kind: "salt" | "agi"; front: boolean };
  const grains = (t: number): Grain[] => {
    const g: Grain[] = [];
    const cb = cloudBox(), x0 = cb.x0 + 120, x1 = cb.x1 - 120;
    for (let i = 0; i < 16; i++) {
      const tr = m.plane + 0.5 + i * 0.1, tau = t - tr;
      if (tau < 0 || tau > 1.0) continue;
      const pk = (tr - m.plane) / m.planeDur, px = -260 + 1640 * pk, py = 500 - 14 * Math.sin(pk * Math.PI);
      if (px < x0 || px > x1) continue;
      const k = Math.min(1, tau / 0.9), x = px + RACK.dx + 30 * tau - 10 * Math.sin(i * 2.3 + tau * 4), y = py + RACK.dy + 150 * (1 - (1 - k) * (1 - k));
      g.push({ x, y, a: sm(ramp(tau, 0, 0.12)) * (1 - sm(ramp(tau, 0.5, 0.5))), s: 10 + 2 * Math.sin(i * 1.7) ** 2 + 3 * (1 - tau), kind: i % 2 ? "agi" : "salt", front: true });
    }
    for (let i = 0; i < 14; i++) {
      const tr = m.ground + i * 0.17, tau = t - tr;
      if (tau < 0 || tau > 2.2) continue;
      const k = tau / 2.2, x = L0[0] - 40 + 70 * Math.sin(i * 1.3) + (CLOUD_PT[0] - L0[0] + 40) * ease(k) + 26 * Math.sin(k * 7 + i), y = L0[1] - 10 + (CLOUD_PT[1] + 70 - (L0[1] - 10)) * k;
      g.push({ x, y, a: sm(ramp(tau, 0, 0.2)) * (1 - sm(ramp(tau, 1.7, 0.5))), s: 12, kind: i % 2 ? "agi" : "salt", front: false });
    }
    return g;
  };

  // ---------------------------------------------------------------- the lab (screen px: the inside of the cloud under the lens)
  const LAB = { salt: [330, 950] as P2, agi: [760, 950] as P2, mid: [540, 790] as P2 };
  /** Vapour dots drift to the salt, and stick round it. `i` 0..13; returns the dot's place and its state. */
  const DOTS = 14;
  const dotAt = (i: number, t: number): { x: number; y: number; stuck: number } => {
    const a = (i / DOTS) * Math.PI * 2 + 0.4, ring = 78 + 18 * (i % 3);
    const hx = LAB.salt[0] + ring * Math.cos(a), hy = LAB.salt[1] + ring * Math.sin(a) * 0.8;
    const sx = hx + 420 * Math.cos(a + 0.5), sy = hy + 360 * Math.sin(a + 0.5);
    const k = ramp(t, m.pull + (i % 7) * 0.22, 1.1), e = ease(k);
    return { x: sx + (hx - sx) * e, y: sy + (hy - sy) * e, stuck: k };
  };
  /** The salt grain's place: left of the lab in "inti", it moves to the middle for "tumbuh". The drop that grows round it, and its fall. */
  const saltPos = (t: number): P2 => {
    const k = sm(ramp(t, beat("inti").b - 0.6, 1.4));
    return [LAB.salt[0] + (LAB.mid[0] - LAB.salt[0]) * k, LAB.salt[1] + (LAB.mid[1] - LAB.salt[1]) * k];
  };
  const dropAt = (t: number): { cx: number; cy: number; r: number; stretch: number; merge: number } => {
    const merge = sm(ramp(t, m.stick + 0.3, 1.8)), grow = sm(ramp(t, m.big - 0.4, m.fall - m.big + 0.1));
    const fallK = ramp(t, m.fall, 1.3), p = saltPos(t);
    return { cx: p[0], cy: p[1] + 560 * fallK * fallK, r: 34 + 38 * merge + 56 * grow, stretch: Math.min(1, fallK * 2.5) * (1 - ramp(t, m.fall + 1.1, 0.3)), merge };
  };

  // ---------------------------------------------------------------- texts, labels, tips, chips
  const tops: Top[] = story.beats.filter((b) => b.kind !== "sting" && b.kind !== "outro").map((b) => {
    const kicker = b.kicker ?? (b.kind === "hook" ? story.question.toUpperCase() : KICKER[b.kind]);
    return { a: beat(b.id).a, b: beat(b.id).b, kicker, headline: b.headline ?? b.text };
  });
  const LABEL_FS = 46;
  type Lab = { id: string; text: string; n?: number | string; red?: boolean; ring?: boolean; world: "out" | "lab"; at: P2 | ((t: number) => P2); off: P2; from: number; to: number };
  const labels: Lab[] = [];
  const L = (id: string, text: string | null | undefined, rest: Omit<Lab, "id" | "text">) => { if (text) labels.push({ id, text, ...rest }); };
  const hookLabel = labelsOf("hook")[0]?.text ?? items("hook").flatMap((i) => (i.type === "banner" ? [i.text] : [])).at(-1);
  L("hook", hookLabel, { world: "out", at: [C[0], C[1] + 100], off: [0, 290], from: m.hookLabel, to: beat("hook").b });
  const k = labelsOf("kirim"), n = labelsOf("inti"), tb = labelsOf("tumbuh"), hs = labelsOf("hasil");
  L("seed", k[0]?.text, { world: "out", at: [C[0] - 40, C[1] + 30], off: [-40, 215], from: m.seedLabel, to: m.ground - 0.2 });
  L("ground", k[1]?.text, { world: "out", at: [L0[0] - 30, L0[1] + 30], off: [-250, -40], from: m.groundLabel, to: m.magnifier });
  L("salt", n[0]?.text, { n: 2, world: "lab", at: [LAB.salt[0], LAB.salt[1] - 60], off: [0, -230], from: m.saltLabel, to: beat("inti").b - 0.2 });
  L("pull", n[1]?.text, { world: "lab", at: [LAB.salt[0] + 40, LAB.salt[1] + 100], off: [0, 190], from: m.pull, to: beat("inti").b - 0.2 });
  L("agi", n[2]?.text, { world: "lab", at: [LAB.agi[0], LAB.agi[1] - 80], off: [20, -220], from: m.agi, to: beat("inti").b - 0.2 });
  L("ice", n[3]?.text, { world: "lab", at: [LAB.agi[0] + 20, LAB.agi[1] + 80], off: [0, 190], from: m.agiLabel, to: beat("inti").b - 0.2 });
  L("small", tb[0]?.text, { n: 3, world: "lab", at: (t: number) => { const d = dropAt(t); return [d.cx - d.r * 0.7, d.cy - d.r * 0.5]; }, off: [-110, -230], from: m.small, to: m.big - 0.2 });
  L("big", tb[1]?.text, { world: "lab", at: (t: number) => { const d = dropAt(t); return [d.cx + d.r * 0.6, d.cy - d.r * 0.4]; }, off: [90, -250], from: m.big, to: m.fall + 0.15 });
  L("rain", tb[2]?.text, { world: "lab", at: (t: number) => { const d = dropAt(t); return [d.cx, d.cy + d.r * 0.7]; }, off: [-10, 210], from: m.fall + 0.2, to: m.exit + 0.3 });
  L("helps", hs[0]?.text, { world: "out", at: [C[0] - 140, C[1] + 100], off: [-70, 190], from: m.helps, to: m.notButton });
  L("button", hs[1]?.text, { red: false, world: "out", at: [C[0], C[1] + 100], off: [10, 200], from: m.notButton, to: m.debate - 0.2 });
  L("debate", hs[2]?.text, { world: "out", at: [C[0] + 120, C[1] + 100], off: [60, 230], from: m.debate, to: beat("hasil").b - 0.1 });
  const stepBadges = (id: string) => items(id).flatMap((i) => (i.type === "badge" ? [i.text] : []))[0];
  const steps = ["kirim", "inti", "tumbuh"].map((id) => ({ id, n: stepBadges(id), from: beat(id).a + 0.4, to: beat(id).b - 0.1 }));

  /** Where a label's pill is at `t` (its centre), where its leader ends, its box; clamped inside the safe area, below the top text, above the captions. */
  const labelAt = (l: Lab, t: number) => {
    const p = typeof l.at === "function" ? l.at(t) : l.at;
    const a = l.world === "out" ? toScreen(outCam(t), p) : p;
    const wTxt = textWidthEstimate(l.text, LABEL_FS), wPill = wTxt + LABEL_FS * 1.1 + (l.n !== undefined ? LABEL_FS * 1.5 + 8 : 0), h = LABEL_FS * 1.5;
    const top = topTextBox().y1 + 20 + h / 2, bottom = captionBox(story.captionStyle, story.platforms).y0 - 20 - h / 2;
    const x = Math.max(SAFE.left + wPill / 2, Math.min(SAFE.right - wPill / 2, a[0] + l.off[0])), y = Math.max(top, Math.min(bottom, a[1] + l.off[1]));
    return { x, y, ax: a[0], ay: a[1], w: wPill, h, box: { x0: x - wPill / 2, y0: y - h / 2, x1: x + wPill / 2, y1: y + h / 2 } as Box };
  };

  const chipFor = (idx: number) => { const c = story.claims[idx]; return c ? [...new Set(c.sources.map(domain))].join(" · ") : ""; };
  const fitChip = (text: string): string => {
    const fits = (s: string) => [...`SUMBER  ${s}`].length * 40 * 0.6 + 44 <= 880;
    const parts = text.split(" · ");
    for (let q = parts.length; q >= 1; q--) { const s = parts.slice(0, q).join(" · "); if (fits(s)) return s; }
    return parts[0];
  };
  const claimsOf = (id: string) => story.claims.map((c, i) => ({ c, i })).filter(({ c }) => c.beats.includes(id)).map(({ i }) => fitChip(chipFor(i)));
  // the source chip stands just above the caption box (y 1385 for the classic caption of YouTube at its old place; it follows the caption now, PLAN-SAFE-AREA-2)
  const chipY = Math.round(captionBox(story.captionStyle, story.platforms).y0) - 54;
  const chips = [
    { id: "chip-kirim", text: claimsOf("kirim")[0], onDark: false, from: beat("kirim").a + 1.2, to: m.magnifier },
    { id: "chip-inti", text: claimsOf("inti")[0], onDark: true, from: m.inside + 1.0, to: beat("inti").b - 0.2 },
    { id: "chip-tumbuh", text: claimsOf("tumbuh")[0], onDark: true, from: m.small + 0.2, to: m.fall - 0.2 },
    { id: "chip-hasil", text: claimsOf("hasil")[0], onDark: false, from: m.helps + 0.3, to: m.notButton },
    { id: "chip-hasil2", text: claimsOf("hasil")[1], onDark: false, from: m.notButton + 0.4, to: beat("hasil").b - 0.1 },
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
  const verdictWord = (highlight("hasil") ?? "SEBAGIAN").replace(/[^\p{L}]/gu, "");
  const pillW = textWidthEstimate(stingPill, 52) + 60, rowW = 200 + 24 + pillW, rowX = 540 - rowW / 2;
  const STING = { mx: rowX + 100, my: 400, mw: 200, px: rowX + 200 + 24 + pillW / 2, py: 400, fs: 52, pillW };
  const stingPillBox = { x0: STING.px - pillW / 2, y0: STING.py - 46, x1: STING.px + pillW / 2, y1: STING.py + 46 };
  const stingMascotBox = { x0: STING.mx - STING.mw / 2, y0: STING.my - STING.mw * 0.6, x1: STING.mx + STING.mw / 2, y1: STING.my + STING.mw * 0.6 };
  const STAMP = { x: 790, y: 470, fs: 50 };
  const REACT = { x: 150, y: 1190, w: 230 };

  /** What is on the screen at `t` as boxes for the layout manager (src/layout.ts): the cloud (the hero), the labels, the tip cards, the sting, the top text and the captions. */
  const specsAt = (t: number, tipH: (i: number) => number): Spec[] => {
    const specs: Spec[] = [];
    if (tops.some((x) => t >= x.a && t < x.b)) specs.push({ id: "top-text", role: "banner", box: topTextBox() });
    if (story.beats.some((b) => b.kind !== "sting" && b.kind !== "outro" && t >= beat(b.id).a && t < beat(b.id).b)) specs.push({ id: "caption", role: "caption", box: captionBox(story.captionStyle, story.platforms) });
    if (!insideLens(t) && t < m.outro) {
      const c = outCam(t), cb = cloudBox(), a = toScreen(c, [cb.x0, cb.y0]), b = toScreen(c, [cb.x1, cb.y1]);
      specs.push({ id: "hero", role: "hero", box: { x0: a[0], y0: a[1], x1: b[0], y1: b[1] } });
    }
    for (const l of labels) if (t >= l.from + 0.1 && t < l.to) specs.push({ id: `label:${l.id}`, role: "text", box: labelAt(l, t).box });
    if (t >= m.sting && t < m.stingEnd) specs.push({ id: "sting:mascot", role: "picture", box: stingMascotBox }, { id: "sting:pill", role: "text", box: stingPillBox });
    tips.forEach((tp, i) => { if (t >= tp.from + 0.2 && t < tp.to) specs.push({ id: `tip:${i}`, role: "picture", box: { x0: TIP.x, y0: TIP.y, x1: TIP.x + TIP.w, y1: TIP.y + tipH(i) } }); });
    return specs;
  };
  const problemsAt = (t: number, tipH: (i: number) => number) => conflicts(specsAt(t, tipH));

  return {
    chipY, B, beat, total, w, m, outKeys, outCam, lens, insideLens, outsideVisible, state, phase, tops, labels, labelAt, LABEL_FS, chips, tips, TIP, steps, stingPill, STING, STAMP, REACT, verdictWord,
    loopWeight, specsAt, problemsAt, planeAt, grains, LAB, DOTS, dotAt, saltPos, dropAt, RACK,
  };
}
