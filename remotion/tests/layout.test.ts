/* The layout manager (src/layout.ts): `npm test`. A crowded scene resolves with nothing overlapping and everything in the safe area; the
   hujan-style scene (texts on top of the chibi and the mascot) no longer covers them; what somebody laid out by hand stays where it is;
   fixed things never move; the result is the same every time. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { applyLayout, zonesFor, bounds, conflicts, itemBox, labelBox, resolve, specsOfItems, textWidthEstimate, wrapText, type Spec } from "../src/layout.ts";
import { validateStory, type ItemT } from "../src/schema.ts";
import { SAFE } from "../src/tokens.ts";

let n = 0;
const yes = (cond: boolean, what: string) => { n++; assert.ok(cond, what); };
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const story = (name: string) => { const v = validateStory(JSON.parse(readFileSync(path.join(ROOT, "stories", `${name}.json`), "utf8"))); assert.ok(v.ok, name); return (v as { story: { beats: { id: string; scene: { items: ItemT[] } }[] } }).story; };

// --- the text width is the font's own ------------------------------------------------------------------------------------------------------
const w116 = textWidthEstimate("klipian intip", 116);
yes(w116 > 600 && w116 < 800, `"klipian intip" at 116 px is about 700 px wide (${w116.toFixed(0)})`);
yes(textWidthEstimate("mmmm", 100) > 2 * textWidthEstimate("iiii", 100), "an m is much wider than an i");
yes(textWidthEstimate("", 50) === 0, "no text, no width");
yes(wrapText("laut dan sungai").text === "laut dan" && wrapText("laut dan sungai").lines[0] === "sungai", "a text breaks into two balanced lines");

// --- a crowded scene: eight labels dropped on one spot -------------------------------------------------------------------------------------
const L = (text: string, x: number, y: number, fs = 60): ItemT => ({ type: "label", text, x, y, fs } as ItemT);
const crowd: ItemT[] = [
  { type: "banner", text: "Banner", fs: 77 } as ItemT,
  { type: "socket", x: 540, y: 900, s: 1.2, view: "outside", variant: "plain" } as ItemT,
  { type: "mascot", x: 200, y: 1470, w: 300, expr: "curious", persist: true } as ItemT,
  { type: "chibi", x: 760, y: 1625, u: 150, role: "pemuda", expr: "calm", pose: "idle" } as ItemT,
  ...["satu", "dua tiga", "empat lima", "enam", "tujuh delapan", "sembilan", "sepuluh", "sebelas"].map((t) => L(t, 540, 900)),
];
const crowded = applyLayout(crowd);
yes(conflicts(specsOfItems(crowd)).length >= 8, `the crowd overlaps itself before (${conflicts(specsOfItems(crowd)).length} conflicts)`);
yes(conflicts(crowded.report.boxes).length === 0, `and nothing overlaps after: ${conflicts(crowded.report.boxes).join("; ")}`);
yes(crowded.report.problems.length === 0, "every text found its place");
const area = bounds(true);
for (const s of crowded.report.boxes.filter((b) => b.role === "text")) {
  const pad = s.pad ?? 0;
  yes(s.box.x0 + pad >= area.x0 && s.box.x1 - pad <= area.x1 && s.box.y0 >= area.y0 && s.box.y1 <= area.y1, `${s.id} is inside the safe area, below the banner`);
}

// --- the hujan-style scene -------------------------------------------------------------------------------------------------------------------
const hujan = story("layout-crowded").beats[0].scene.items;
const before = conflicts(specsOfItems(hujan));
const need = (what: string, c: string[]) => c.filter((x) => x.includes(what));
yes(need("chibi", before).length >= 1 && need("mascot", before).length >= 1 && need("banner", before).length >= 1, `before: texts cover the chibi, the mascot and the banner (${before.length} conflicts)`);
const fixed = applyLayout(hujan);
const after = conflicts(fixed.report.boxes);
yes(after.length === 0, `after: nothing covers anything (${after.join("; ")})`);
yes(fixed.report.problems.length === 0, "and every text found a place");
const boxOf = (id: string) => fixed.report.boxes.find((b) => b.id === id)!.box;
const kinds = hujan.map((it, i) => ({ it, i })).filter(({ it }) => it.type === "label" || it.type === "pill");
for (const { it, i } of kinds) {
  const mine = boxOf(`${i}:${it.type}`);
  for (const other of ["chibi", "mascot", "banner"]) {
    const j = hujan.findIndex((x) => x.type === other), o = boxOf(`${j}:${other}`);
    yes(!(mine.x0 < o.x1 && mine.x1 > o.x0 && mine.y0 < o.y1 && mine.y1 > o.y0), `${it.type} ${i} does not cover the ${other}`);
  }
}
for (const [id, m] of fixed.report.moved) yes(Math.hypot(m.dx, m.dy) < 700, `${id} moved ${Math.hypot(m.dx, m.dy).toFixed(0)} px: a short way`);
const smaller = [...fixed.report.moved.values()].filter((m) => m.scale < 1);
yes(smaller.every((m) => m.scale >= 0.7), "a text is made smaller by at most 30 %");
const laid = fixed.items.filter((it) => it.type === "label") as { fs: number; text: string }[];
yes(laid.every((l) => l.fs >= 46), "and never below 46 px, so it stays readable on a phone");

// --- what was laid out by hand stays ------------------------------------------------------------------------------------------------------------
const colokan = story("colokan-panas");
for (const b of colokan.beats) {
  const r = applyLayout(b.scene.items);
  yes(r.report.problems.length === 0, `colokan ${b.id}: nothing unsolved`);
  for (const [id, m] of r.report.moved) yes(Math.hypot(m.dx, m.dy) <= 30 && m.scale === 1 && !m.wrap, `colokan ${b.id} ${id}: a hand-made layout moves at most a nudge (${m.dx}, ${m.dy})`);
}
yes(conflicts(applyLayout(colokan.beats[3].scene.items).report.boxes).length === 0, "colokan 'rapat' has no conflicts after the layout");

// --- the rules ------------------------------------------------------------------------------------------------------------------------------------
yes(JSON.stringify(applyLayout(hujan).items) === JSON.stringify(applyLayout(hujan).items), "the same scene is laid out the same way every time");
const again = applyLayout(fixed.items);
yes(again.report.moved.size === 0, "a scene that was laid out is not moved again");
const specs = specsOfItems(hujan), res = resolve(specs);
for (const s of specs.filter((x) => x.role === "banner" || x.role === "hero" || x.role === "mascot" || x.role === "chibi")) yes(!res.moved.has(s.id), `${s.id} is fixed: it never moves`);
const arrowScene: ItemT[] = [
  { type: "banner", text: "x", fs: 77 } as ItemT, { type: "mascot", x: 540, y: 900, w: 600, expr: "curious" } as ItemT,
  L("air jatuh", 540, 900, 70), { type: "arrow", x: 540, y: 960, x2: 540, y2: 1300, w: 12 } as ItemT];
const moved = applyLayout(arrowScene);
const lab = moved.items[2] as { x: number; y: number }, arr = moved.items[3] as { x: number; y: number; x2: number; y2: number };
yes(lab.x !== 540 || lab.y !== 900, "a text on the mascot moved");
yes(arr.x === lab.x - 0 + (arr.x - lab.x) && arr.x2 === 540 && arr.y2 === 1300, "the arrow keeps its head where it was");
yes(arr.x - lab.x === 0 && arr.y - lab.y === 60, "and its tail went with the text");

// a custom scene describes its boxes itself
const custom: Spec[] = [
  { id: "hero", role: "hero", box: { x0: 200, y0: 600, x1: 880, y1: 1300 } },
  { id: "a", role: "text", box: { x0: 400, y0: 800, x1: 700, y1: 880 } },
  { id: "b", role: "text", box: { x0: 420, y0: 810, x1: 720, y1: 890 } },
  { id: "pinned", role: "text", pin: true, box: { x0: 100, y0: 300, x1: 400, y1: 380 } },
];
const cr = resolve(custom, { hasBanner: false });
yes(cr.moved.has("a") && cr.moved.has("b") && !cr.moved.has("pinned") && conflicts(cr.boxes).length === 0, "custom specs: texts leave the hero and each other, a pinned one stays");
const huge = resolve([{ id: "t", role: "text", box: { x0: 0, y0: 200, x1: 1080, y1: 1800 } }], { hasBanner: false });
yes(huge.problems.length === 1, "a box bigger than the safe area is reported, not hidden");
const lb = labelBox("rapat", 733, 560, 66);
yes(lb.x1 - lb.x0 > 150 && lb.x1 - lb.x0 < 400 && lb.y1 - lb.y0 > 60 && lb.y1 - lb.y0 < 140, "a label's box is about its size");
yes(itemBox({ type: "arrow", x: 1, y: 1, x2: 2, y2: 2 } as ItemT) === null, "an arrow is a line: no box");

// the mascot and the chibi are optional: without them the hero is bigger and lower, and the callouts use the whole height
const withKids = zonesFor({ mascot: true, chibi: true }), alone = zonesFor();
yes(alone.hero.x1 - alone.hero.x0 > withKids.hero.x1 - withKids.hero.x0 && alone.hero.y1 > withKids.hero.y1, "without a mascot or a chibi the hero is bigger and lower");
yes(alone.calloutLeft.y1 > withKids.calloutLeft.y1 && alone.calloutLeft.y1 === SAFE.bottom, "and the callouts reach down to the safe area");
yes(alone.hero.x1 - alone.hero.x0 <= 0.75 * 1080 && withKids.hero.x1 - withKids.hero.x0 >= 0.6 * 1080, "the hero stays at 60-75 % of the width");

console.log(`layout: ${n} checks ok`);
