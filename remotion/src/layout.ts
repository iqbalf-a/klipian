/* The layout manager (P28-P): nothing overlaps and everything is inside the safe area, however the scene was written.
   Used by the story template (FunFact applies it to every beat) and by custom compositions (videos/<slug>/): a scene describes what it
   has as boxes, `resolve()` pushes the movable ones (text, pills, badges) the shortest way to a free spot, and says where they went.

   Zones of a 1080 x 1920 scene (see DESIGN.md): the banner on top; the hero (the main object, 60-70 % of the width) in the middle; callouts
   to its left and right; the persistent mascot bottom-left; a chibi bottom-right or bottom-left. A box that is already free is never moved,
   so a scene somebody laid out by hand stays as it is.
   Pure: no React, no DOM (the text width is an estimate, the same in a test and in a render), so `npm test` can check it. */
import type { ItemT } from "./schema.ts";
import { FRAME, SAFE, SHEET_TO_VIDEO as K } from "./tokens.ts";
import { FALLBACK_WIDTH, WIDTHS } from "./fontMetrics.ts";

export type Box = { x0: number; y0: number; x1: number; y1: number };
/** What a thing is, for the layout: fixed things are obstacles, movable things are pushed. */
export type Role = "banner" | "hero" | "mascot" | "chibi" | "text" | "badge";
export type Side = "left" | "right" | "above" | "below";
/** `pad` is the part of a text's box that is only its backing (it may leave the safe area, the letters may not). `anchor` is the point the box scales about (`wrapBox`: the box of a one-line text broken into two lines); (a label's x, y; a pill's centre); `minScale` below 1 lets a text shrink to fit (never below it). */
export type Spec = { id: string; role: Role; box: Box; prefer?: Side; pin?: boolean; anchor?: { x: number; y: number }; minScale?: number; wrapBox?: Box; pad?: number };
export type Move = { dx: number; dy: number; scale: number; wrap?: boolean };
export type Moves = Map<string, Move>;
export type Report = { moved: Moves; problems: string[]; boxes: Spec[] };

export const MIN_FS = 46;                                // a text is never made smaller than this (a phone screen)
export const GAP = 14;                                   // the least air between two boxes
export const HERO_CORE = 0.7;                            // the hero's core: never covered, whatever it costs
export const HERO_KEEP = 0.9;                            // the hero's key area: its box shrunk to this share (text may touch the rim, not the middle)
export const BANNER_BOTTOM = 22 * K + 20 * K * 2.6;      // where a default banner ends (y 85 + 200)

/** The zones, in video pixels. `bounds` is where text may be: inside the safe area, below the banner. */
export const ZONES = {
  banner: { x0: 16 * K, y0: 22 * K, x1: FRAME.width - 16 * K, y1: BANNER_BOTTOM },
  hero: { cx: FRAME.width / 2, cy: 930, width: 0.65 * FRAME.width },       // the middle of the screen: 60-70 % of the width
  calloutLeft: { x0: SAFE.left, x1: 300 }, calloutRight: { x0: 780, x1: SAFE.right },
  mascot: { x: 200, y: 1470, w: 300 },                                     // the persistent mascot, bottom-left
  chibiRight: { x: 790, y: 1625 }, chibiLeft: { x: 290, y: 1625 },
  safe: { x0: SAFE.left, y0: SAFE.top, x1: SAFE.right, y1: SAFE.bottom },
} as const;
export const bounds = (hasBanner = true): Box => ({ x0: SAFE.left, y0: hasBanner ? BANNER_BOTTOM + GAP : SAFE.top, x1: SAFE.right, y1: SAFE.bottom });

// ---------------------------------------------------------------------------------------------------------------------------------------
// boxes of things
// ---------------------------------------------------------------------------------------------------------------------------------------

export const around = (cx: number, cy: number, hw: number, hh = hw): Box => ({ x0: cx - hw, y0: cy - hh, x1: cx + hw, y1: cy + hh });
const grow = (b: Box, d: number): Box => ({ x0: b.x0 - d, y0: b.y0 - d, x1: b.x1 + d, y1: b.y1 + d });
const shrink = (b: Box, keep: number): Box => {
  const cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2, hw = ((b.x1 - b.x0) / 2) * keep, hh = ((b.y1 - b.y0) / 2) * keep;
  return { x0: cx - hw, y0: cy - hh, x1: cx + hw, y1: cy + hh };
};
const overlap = (a: Box, b: Box): boolean => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;
const area = (a: Box, b: Box): number => Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) * Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0));
const inside = (a: Box, w: Box): boolean => a.x0 >= w.x0 && a.x1 <= w.x1 && a.y0 >= w.y0 && a.y1 <= w.y1;
const shift = (b: Box, dx: number, dy: number): Box => ({ x0: b.x0 + dx, y0: b.y0 + dy, x1: b.x1 + dx, y1: b.y1 + dy });

/** The width of a text in the channel font (Outfit Bold): the real advance width of every character, read from the font file (fontMetrics.ts,
    made by font-metrics.mjs), so a layout is the same in a test, in the Studio and in a render. No kerning, which is under 2 %. */
export const textWidthEstimate = (text: string, fs: number): number => [...text].reduce((w, c) => w + (WIDTHS[c] ?? FALLBACK_WIDTH), 0) * fs;

/** The box of a label (x, y = the middle or, with align "start", the start of its first line), as Label.tsx draws it, backing included. */
export function labelBox(text: string, x: number, y: number, fs: number, align: "start" | "middle" = "middle", lines: readonly string[] = []): Box {
  const rows = [text, ...lines], wide = Math.max(...rows.map((r) => textWidthEstimate(r, fs)));
  const padX = fs * 0.55, padY = fs * 0.32, hh = fs * 1.22 * rows.length + padY * 2 - fs * 0.22;
  const by = y - fs * 0.61 - padY + fs * 0.22, bx = align === "middle" ? x - wide / 2 - padX : x - padX;
  return { x0: bx, y0: by, x1: bx + wide + padX * 2, y1: by + hh };
}
/** A text broken into two balanced lines at a space (the first row, then the rest), for a label that does not fit on one. */
export function wrapText(text: string): { text: string; lines: string[] } {
  const words = text.trim().split(/\s+/);
  let best = 1, gap = Infinity;
  for (let k = 1; k < words.length; k++) {
    const a = words.slice(0, k).join(" ").length, b = words.slice(k).join(" ").length;
    if (Math.abs(a - b) < gap) { gap = Math.abs(a - b); best = k; }
  }
  return { text: words.slice(0, best).join(" "), lines: [words.slice(best).join(" ")] };
}
/** The box of a pill (x, y = its centre). */
export function pillBox(text: string, x: number, y: number, fs: number): Box {
  const w = textWidthEstimate(text, fs) + fs * 1.2, h = fs * 1.56;
  return around(x, y, w / 2, h / 2);
}
export const mascotBox = (x: number, y: number, w: number): Box => ({ x0: x - w / 2, y0: y - 0.4 * w, x1: x + w / 2, y1: y + 0.55 * w });     // the bubble and its tail
/** A chibi stands with its feet at (x, y); u is the half width of its head. Arms out add a little to each side. */
export const chibiBox = (x: number, y: number, u: number): Box => ({ x0: x - 1.4 * u, y0: y - 3.4 * u, x1: x + 1.4 * u, y1: y + 0.15 * u });

/** The box of an item of a story, or null for what takes no room (an arrow is a line). */
export function itemBox(item: ItemT): { role: Role; box: Box } | null {
  switch (item.type) {
    case "banner": {
      const y = item.y ?? 22 * K, h = (item.fs ?? 20 * K) * 2.6;
      return { role: "banner", box: { x0: 16 * K, y0: y, x1: FRAME.width - 16 * K, y1: y + h } };
    }
    case "mascot": return { role: "mascot", box: mascotBox(item.x, item.y, item.w) };
    case "chibi": return { role: "chibi", box: chibiBox(item.x, item.y, item.u) };
    case "socket": {
      if (item.view === "cutaway") return { role: "hero", box: around(item.x, item.y, 125 * K * item.s, 70 * K * item.s) };
      return { role: "hero", box: around(item.x, item.y, 62 * K * item.s) };
    }
    case "lens": return { role: "hero", box: { x0: item.x - item.r, y0: item.y - item.r, x1: item.x + 1.22 * item.r, y1: item.y + 1.22 * item.r } };
    case "stack": return { role: "hero", box: around(item.x, item.y, 40 * K * item.s, 32 * K * item.s) };
    case "pill": return { role: "text", box: pillBox(item.text, item.x, item.y, item.fs) };
    case "label": return { role: "text", box: labelBox(item.text, item.x, item.y, item.fs, item.align ?? "middle", item.lines ?? []) };
    case "badge": return { role: "badge", box: around(item.x, item.y, item.r ?? 46) };
    default: return null;
  }
}

// ---------------------------------------------------------------------------------------------------------------------------------------
// the resolver
// ---------------------------------------------------------------------------------------------------------------------------------------

/** Where a thing sits relative to the middle of the hero decides the side it prefers to stay on when it has to move. */
export function sideOf(box: Box, hero: Box | null): Side {
  const cx = (box.x0 + box.x1) / 2, cy = (box.y0 + box.y1) / 2;
  if (!hero) return cx < FRAME.width / 2 ? "left" : "right";
  const hx = (hero.x0 + hero.x1) / 2, hy = (hero.y0 + hero.y1) / 2, dx = (cx - hx) / (hero.x1 - hero.x0), dy = (cy - hy) / (hero.y1 - hero.y0);
  return Math.abs(dx) >= Math.abs(dy) ? (dx < 0 ? "left" : "right") : (dy < 0 ? "above" : "below");
}

const STEP = 16, REACH = 1000;
const OFFSETS: [number, number, number][] = (() => {            // every offset on a grid, nearest first
  const out: [number, number, number][] = [];
  for (let dx = -REACH; dx <= REACH; dx += STEP) for (let dy = -REACH; dy <= REACH; dy += STEP) out.push([dx, dy, Math.hypot(dx, dy)]);
  return out.sort((a, b) => a[2] - b[2] || a[0] - b[0] || a[1] - b[1]);
})();
const toward = (side: Side | undefined, dx: number, dy: number): boolean =>
  side === "left" ? dx < 0 : side === "right" ? dx > 0 : side === "above" ? dy < 0 : side === "below" ? dy > 0 : false;

/** Pushes the movable specs (roles "text" and "badge", unless `pin`) off whatever they overlap and back inside the safe area, the shortest way
    (a little shorter towards their preferred side). The fixed ones (banner, hero, mascot, chibi) never move; the hero only counts as an obstacle
    in its key area. Returns where each moved thing went, what could not be solved (a sentence each) and the boxes it used. */
export function resolve(specs: readonly Spec[], opts: { hasBanner?: boolean } = {}): Report {
  const hasBanner = opts.hasBanner ?? specs.some((s) => s.role === "banner");
  const area0 = bounds(hasBanner);
  const fixed = specs.filter((s) => s.role === "banner" || s.role === "hero" || s.role === "mascot" || s.role === "chibi" || s.pin);
  const hardFor = (keep: number, badge = false) => fixed.filter((s) => !(badge && s.role === "hero")).map((s) => ({ id: s.id, box: grow(s.role === "hero" ? shrink(s.box, keep) : s.box, s.role === "banner" ? GAP : GAP / 2) }));
  const placed: { id: string; box: Box }[] = [];
  const moved: Moves = new Map();
  const problems: string[] = [];
  const movable = specs.filter((s) => !fixed.includes(s)).sort((a, b) => a.box.y0 - b.box.y0 || a.box.x0 - b.box.x0 || a.id.localeCompare(b.id));
  const hero = specs.find((s) => s.role === "hero")?.box ?? null;
  // what a movable thing tries, each with a price (how much worse than "where it was, as it was"): as it is; broken into two lines; a little
  // smaller; both; and over the rim of the hero. The cheapest way to a free place wins, so a text never travels far when a change of size is enough.
  const ATTEMPTS = [
    { scale: 1, wrap: false, keep: HERO_KEEP, price: 0 }, { scale: 1, wrap: true, keep: HERO_KEEP, price: 40 },
    { scale: 0.88, wrap: false, keep: HERO_KEEP, price: 70 }, { scale: 0.88, wrap: true, keep: HERO_KEEP, price: 90 },
    { scale: 0.78, wrap: true, keep: 0.8, price: 160 }, { scale: 0.7, wrap: true, keep: 0.7, price: 260 },
  ];
  const boxFor = (s: Spec, k: number, wrap: boolean): Box => {
    const b = wrap && s.wrapBox ? s.wrapBox : s.box;
    if (k === 1 || !s.anchor) return b;
    const a = s.anchor, f = (v: number, o: number) => o + k * (v - o);
    return { x0: f(b.x0, a.x), y0: f(b.y0, a.y), x1: f(b.x1, a.x), y1: f(b.y1, a.y) };
  };
  const padless = (b: Box, s: Spec): Box => (s.pad ? { ...b, x0: b.x0 + s.pad, x1: b.x1 - s.pad } : b);
  const allowed = (s: Spec, at: (typeof ATTEMPTS)[number]): boolean => (at.scale === 1 || (!!s.anchor && (s.minScale ?? 1) <= at.scale)) && (!at.wrap || !!s.wrapBox);

  for (const s of movable) {
    const prefer = s.prefer ?? sideOf(s.box, hero);
    let best: (Move & { cost: number }) | null = null;
    for (const at of ATTEMPTS) {
      if (!allowed(s, at) || (best && best.cost <= at.price)) continue;
      const hard = hardFor(at.keep, s.role === "badge"), base = boxFor(s, at.scale, at.wrap);
      const clash = (b: Box): number => [...hard, ...placed].reduce((n, o) => n + (overlap(grow(b, GAP / 2), o.box) ? area(grow(b, GAP / 2), o.box) + 1 : 0), 0);
      const ok = (b: Box): boolean => inside(padless(b, s), area0) && clash(b) === 0;
      // staying where it is only needs the hero's core to be free (so a text that was placed on a rim is not moved again); moving aims at the key area
      const stayHard = at.price === 0 ? hardFor(HERO_CORE, s.role === "badge") : hard;
      const stays = inside(padless(base, s), area0) && [...stayHard, ...placed].every((o) => !overlap(grow(base, GAP / 2), o.box));
      let found: { dx: number; dy: number; key: number } | null = stays ? { dx: 0, dy: 0, key: 0 } : null;
      if (!found) {
        for (const [dx, dy, d] of OFFSETS) {
          if (found && d * 0.85 >= found.key) break;               // nothing further away can beat it
          if (best && d * 0.85 + at.price >= best.cost) break;     // nor beat the best attempt so far
          const key = d * (toward(prefer, dx, dy) ? 0.85 : 1);
          if (found && key >= found.key) continue;
          if (ok(shift(base, dx, dy))) found = { dx, dy, key };
        }
      }
      if (found && (!best || found.key + at.price < best.cost)) best = { dx: found.dx, dy: found.dy, scale: at.scale, wrap: at.wrap, cost: found.key + at.price };
    }
    if (!best) {                                                   // no free spot at all: the least overlap, and say so
      const at = [...ATTEMPTS].reverse().find((a) => allowed(s, a)) ?? ATTEMPTS[0];
      const hard = hardFor(at.keep, s.role === "badge"), base = boxFor(s, at.scale, at.wrap);
      const clash = (b: Box): number => [...hard, ...placed].reduce((n, o) => n + area(grow(b, GAP / 2), o.box), 0);
      let least = Infinity;
      for (const [dx, dy] of OFFSETS) {
        const b = shift(base, dx, dy);
        if (!inside(padless(b, s), area0)) continue;
        const c = clash(b);
        if (c < least) { least = c; best = { dx, dy, scale: at.scale, wrap: at.wrap, cost: 0 }; }
      }
      problems.push(`${s.id}: no free place for it in the safe area`);
    }
    const mv: Move = best ? { dx: best.dx, dy: best.dy, scale: best.scale, ...(best.wrap ? { wrap: true } : {}) } : { dx: 0, dy: 0, scale: 1 };
    if (mv.dx || mv.dy || mv.scale !== 1 || mv.wrap) moved.set(s.id, mv);
    placed.push({ id: s.id, box: shift(boxFor(s, mv.scale, !!mv.wrap), mv.dx, mv.dy) });
  }
  const finalBox = (s: Spec): Box => (moved.has(s.id) ? shift(boxFor(s, moved.get(s.id)!.scale, !!moved.get(s.id)!.wrap), moved.get(s.id)!.dx, moved.get(s.id)!.dy) : s.box);
  return { moved, problems, boxes: specs.map((s) => ({ ...s, box: finalBox(s) })) };
}

/** Every overlap left in a set of boxes (movable against anything, and out of the safe area): for tests and the debug overlay. */
export function conflicts(specs: readonly Spec[]): string[] {
  const out: string[] = [];
  const area0 = bounds(specs.some((s) => s.role === "banner"));
  specs.forEach((a, i) => {
    if ((a.role === "text" || a.role === "badge") && !inside(a.pad ? { ...a.box, x0: a.box.x0 + a.pad, x1: a.box.x1 - a.pad } : a.box, area0)) out.push(`${a.id} is outside the safe area`);
    specs.slice(i + 1).forEach((b) => {
      const bothFixed = [a, b].every((s) => s.role !== "text" && s.role !== "badge");
      if (bothFixed || (a.role === "badge" && b.role === "hero") || (b.role === "badge" && a.role === "hero")) return;   // a badge sits on its object by design; two fixed things (a chibi beside a hero) are the scene's own business
      const ba = a.role === "hero" ? shrink(a.box, HERO_CORE) : a.box, bb = b.role === "hero" ? shrink(b.box, HERO_CORE) : b.box;
      if (overlap(ba, bb)) out.push(`${a.id} overlaps ${b.id}`);
    });
  });
  return out;
}

// ---------------------------------------------------------------------------------------------------------------------------------------
// the story's items
// ---------------------------------------------------------------------------------------------------------------------------------------

export const itemId = (index: number, item: ItemT): string => `${index}:${item.type}`;

/** The specs of a beat's items (by index), and for every arrow whose tail sits on a text the index of that text, so the tail goes along. */
export function specsOfItems(items: readonly ItemT[]): Spec[] {
  const heroes = items.map((it) => itemBox(it)).filter((b) => b?.role === "hero");
  const hero = heroes.length ? heroes.reduce((a, b) => ({ x0: Math.min(a!.box.x0, b!.box.x0), y0: Math.min(a!.box.y0, b!.box.y0), x1: Math.max(a!.box.x1, b!.box.x1), y1: Math.max(a!.box.y1, b!.box.y1) }) as never)?.box ?? null : null;
  const specs: Spec[] = [];
  items.forEach((it, i) => {
    const b = itemBox(it);
    if (!b) return;
    const text = it.type === "label" || it.type === "pill";
    specs.push({ id: itemId(i, it), role: b.role, box: b.box, prefer: b.role === "text" || b.role === "badge" ? sideOf(b.box, hero) : undefined,
      anchor: text ? { x: it.x, y: it.y } : undefined, pad: it.type === "label" ? it.fs * 0.55 : undefined, minScale: text ? Math.max(0.7, MIN_FS / it.fs) : undefined,
      wrapBox: it.type === "label" && !it.lines?.length && it.text.trim().split(/\s+/).length > 1 ? (() => { const w = wrapText(it.text); return labelBox(w.text, it.x, it.y, it.fs, it.align ?? "middle", w.lines); })() : undefined });
  });
  return specs;
}

/** The items with their texts, pills and badges moved (and a text made a little smaller when it has to be) to where they do not overlap, and the
    tail of an arrow that was on a moved text moved with it. */
export function applyLayout(items: readonly ItemT[]): { items: ItemT[]; report: Report } {
  const specs = specsOfItems(items);
  const report = resolve(specs);
  const out = items.map((it) => ({ ...it })) as ItemT[];
  items.forEach((it, i) => {
    const m = report.moved.get(itemId(i, it));
    if (!m || !(it.type === "label" || it.type === "pill" || it.type === "badge")) return;
    const o = out[i] as { x: number; y: number; fs?: number };
    o.x = it.x + m.dx; o.y = it.y + m.dy;
    if (it.type !== "badge" && m.scale !== 1) o.fs = Math.round(it.fs * m.scale);
    if (it.type === "label" && m.wrap) Object.assign(o, wrapText(it.text));
    for (let j = 0; j < items.length; j++) {                      // an arrow whose tail was on this text keeps its head and its tail follows
      const a = items[j];
      if (a.type !== "arrow") continue;
      const near = grow(itemBox(it)!.box, 60);
      if (a.x >= near.x0 && a.x <= near.x1 && a.y >= near.y0 && a.y <= near.y1) {
        const oa = out[j] as { x: number; y: number };
        oa.x = a.x + m.dx; oa.y = a.y + m.dy;
      }
    }
  });
  return { items: out, report };
}

/** A story with the layout of every beat applied (a beat's report is not kept: use applyLayout for the debug overlay). */
export function layoutStory<S extends { beats: { scene: { items: ItemT[] } }[] }>(story: S): S {
  return { ...story, beats: story.beats.map((b) => ({ ...b, scene: { ...b.scene, items: applyLayout(b.scene.items).items } })) };
}

/** The zones of a scene given what is in it (ian 2026-10-26: people and the mascot are optional): without a mascot or a chibi at the bottom, the hero
    sits lower and bigger and the callouts may use the whole height down to the safe area; with them, the hero keeps clear of their corner. */
export function zonesFor(present: { mascot?: boolean; chibi?: boolean } = {}): { hero: Box; calloutLeft: Box; calloutRight: Box } {
  const crowded = !!(present.mascot || present.chibi);
  const cx = ZONES.hero.cx, cy = crowded ? ZONES.hero.cy : 980, hw = (crowded ? 0.65 : 0.72) * FRAME.width / 2, hh = hw;
  const top = BANNER_BOTTOM + GAP, bottom = crowded ? 1340 : SAFE.bottom;
  return {
    hero: { x0: cx - hw, y0: cy - hh, x1: cx + hw, y1: cy + hh },
    calloutLeft: { x0: SAFE.left, y0: top, x1: cx - hw - GAP, y1: bottom }, calloutRight: { x0: cx + hw + GAP, y0: top, x1: SAFE.right, y1: bottom },
  };
}
