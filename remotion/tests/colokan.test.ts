/* Pilot 1 "Kenapa colokan bisa panas?" (videos/kenapa-colokan-panas/): `npm test`. Every frame's boxes pass the layout manager (nothing overlaps, all in the
   safe area: labels, cards, tip cards, the hero, the top text, the captions), every word on the screen comes from the story (bar the channel's chrome), the
   cameras never jump while their world is on screen, and every sound lands on a frame. Plus the 2.5D kit's geometry (src/iso.ts). */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { makePlan } from "../videos/kenapa-colokan-panas/plan.ts";
import { sfx } from "../videos/kenapa-colokan-panas/sfx.ts";
import { validateStory } from "../src/schema.ts";
import { FPS } from "../src/timeline.ts";
import { block, cam2At, cylinder, extrudeXZ, iso, roundRectPts, toneOf, visible } from "../src/iso.ts";
import { conflicts, textWidthEstimate, captionBox } from "../src/layout.ts";
import { cableSamples } from "../src/cable.ts";
import { isoAt, toScreen } from "../src/iso.ts";
import { CABLE_TO, OUT, quoteLines } from "../videos/kenapa-colokan-panas/plan.ts";
import { ASSET_NAMES_FILE } from "./assetNames.ts";

let n = 0;
const yes = (c: boolean, what: string) => { n++; assert.ok(c, what); };
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const v = validateStory(JSON.parse(readFileSync(path.join(ROOT, "videos", "kenapa-colokan-panas", "story.json"), "utf8")));
if (!v.ok) throw new Error(v.errors.join("\n"));
const story = v.story, P = makePlan(story);

// the same heights the picture uses (index.tsx: SourceCard at 850 wide, TipCard)
const wrapN = (text: string, fs: number, width: number) => { let lines = 0, cur = ""; for (const w of text.split(/\s+/)) { if (cur && textWidthEstimate(`${cur} ${w}`, fs) > width) { lines++; cur = w; } else cur = cur ? `${cur} ${w}` : w; } return lines + (cur ? 1 : 0); };
const cardH = (q: string) => 150 + wrapN(`“${q}”`, 38, 770) * 38 * 1.28;
const tipH = (i: number) => { const tp = P.tips[i]; return 48 + wrapN(tp.title, 58, P.TIP.w - 170) * 66 + (tp.sub ? wrapN(tp.sub, 40, P.TIP.w - 170) * 50 + 8 : 0) + (tp.chip ? 46 : 0) + 30; };

// --- layout, frame by frame
const bad: string[] = [];
for (let f = 0; f < P.total * FPS; f += 3) { const t = f / FPS, pr = P.problemsAt(t, cardH, tipH); if (pr.length) bad.push(`${t.toFixed(2)}s: ${pr.join("; ")}`); }
yes(bad.length === 0, `no overlaps and all inside the safe area in any frame:\n${bad.slice(0, 12).join("\n")}`);

// --- every word on the screen comes from the story
const hay = JSON.stringify(story).toLowerCase();
const CHROME = ["dari luar", "di dalam", "di dalam · diperbesar", "akibatnya", "tips aman"];
const shown = [...P.tops.map((x) => x.headline), ...P.labels.map((l) => l.text), ...P.tips.flatMap((tp) => [tp.title, tp.sub ?? ""]), ...P.cards.map((c) => c.quote), P.stingPill, P.outroLabel, P.outroPill ?? "", ...P.loopWords.map((x) => x ?? "")].filter(Boolean);
for (const s of shown) yes(hay.includes(s.replace(/…$/, "").toLowerCase()), `"${s}" is in the story`);
for (const x of P.tops) yes(!x.kicker || CHROME.includes(x.kicker.toLowerCase()) || x.kicker === story.question.toUpperCase(), `kicker "${x.kicker}" is chrome or the story's question`);
yes(P.cards.length === 2 && P.tips.length === 2 && P.labels.length >= 6, `cards ${P.cards.length}, tips ${P.tips.length}, labels ${P.labels.length}`);
for (const c of P.cards) yes(story.claims[c.claim - 1].sources[0].includes(c.domain), `card ${c.claim}: the domain of its first source`);

// --- source cards: at most two lines, and a part of the claim's own text
for (const c of P.cards) {
  yes(quoteLines(c.quote) <= 2, `card ${c.claim}: the quote is at most two lines (${quoteLines(c.quote)})`);
  const words = c.quote.replace(/…$/, "").trim();
  yes(story.claims[c.claim - 1].text.includes(words), `card ${c.claim}: the quote is the claim's own words`);
}

// --- source chips: 40 px mono, at most 880 px wide; the tip chips fit their card (at 28 px)
for (const c of P.chips) yes([...`SUMBER  ${c.text}`].length * 40 * 0.6 + 44 <= 880, `chip "${c.text}" fits at 40 px`);
for (const tp of P.tips) if (tp.chip) yes(80 + 140 + [...`SUMBER  ${tp.chip}`].length * 28 * 0.6 <= 940, `tip chip "${tp.chip}" fits the tip card at 28 px`);

// --- the hook's cable never runs under the captions (it leaves level to the left, above them)
{
  const cap = captionBox(), u = 150;
  const end: [number, number, number] = [0, 0.3 + 1.62, 0.5];                 // the plug's cable end at rest (IsoPlug, gap 0)
  const cable = [end, ...CABLE_TO];
  let worst = Infinity;
  for (let f = 0; f < P.m.inside * FPS; f += 3) {
    const t = f / FPS;
    if (!P.outsideVisible(t)) continue;
    const cam = P.outCam(t), pts = cableSamples(cable.map((p) => { const q = toScreen(cam, isoAt(p, OUT.u, OUT.o)); return [q[0], q[1]] as [number, number]; }), undefined, 6);
    const margin = u * 0.16 * cam.zoom;
    for (const [x, y] of pts) {
      const inX = x > cap.x0 - margin && x < cap.x1 + margin, inY = y > cap.y0 - margin && y < cap.y1 + margin;
      if (inX && inY) worst = Math.min(worst, t);
    }
  }
  yes(worst === Infinity, `the cable never runs under the captions (first clash at ${worst}s)`);
}

// --- the cameras are smooth while their world is on screen; the moments are in order
const jump = (cam: (t: number) => { x: number; y: number; zoom: number }, show: (t: number) => boolean) => {
  let worst = 0;
  for (let f = 1; f < P.total * FPS; f++) { const a = (f - 1) / FPS, b = f / FPS; if (!show(a) || !show(b)) continue; const p = cam(a), q = cam(b); worst = Math.max(worst, Math.hypot(q.x - p.x, q.y - p.y) * Math.min(p.zoom, q.zoom), Math.abs(Math.log(q.zoom / p.zoom)) * 1000); }
  return worst;
};
yes(jump(P.outCam, P.outsideVisible) < 260, `the outside camera moves at most a little per frame (${jump(P.outCam, P.outsideVisible).toFixed(0)})`);
yes(jump(P.labCam, (t) => t >= P.m.inside && t < P.m.exit) < 260, `the lab camera too (${jump(P.labCam, (t) => t >= P.m.inside && t < P.m.exit).toFixed(0)})`);
const order = [P.m.hookLabel, P.m.sting, P.m.magnifier, P.m.through, P.m.inside, P.m.macro, P.m.loosen, P.m.hot, P.m.exit, P.m.melt, P.m.tips, P.m.unplug, P.m.tip2, P.m.replace, P.m.outro];
yes(order.every((x, i) => i === 0 || x > order[i - 1]), "the moments come in story order");
yes(Math.abs(P.total - story.duration) < 0.01, "the video lasts the story's duration");

// --- sound
const ev = sfx(story);
yes(ev.length >= 45, `${ev.length} sound effects (nearly every element)`);
yes(ev.every((e) => Math.abs(e.t * FPS - Math.round(e.t * FPS)) < 1e-6 && e.t < P.total), "every sound on a frame, inside the video");

// --- the 2.5D kit: tones and visibility, projections, the camera
yes(toneOf([0, 0, 1]) === 0 && toneOf([0, 1, 0]) === 1 && toneOf([1, 0, 0]) === 2, "top light, left mid, right dark");
yes(visible([1, 0, 0]) && visible([0, 1, 0]) && visible([0, 0, 1]) && !visible([-1, 0, 0]) && !visible([0, 0, -1]), "faces towards (1, 1, 1) are seen");
yes(iso([1, 0, 0])[0] > 0 && iso([1, 0, 0])[1] > 0 && iso([0, 1, 0])[0] < 0 && iso([0, 0, 1])[1] < 0, "x lower right, y lower left, z up");
yes(block([0, 0, 0], [1, 1, 1], 100).map((p) => p.tone).join() === "2,1,0", "a block: right, left, top, back to front");
const ex = extrudeXZ(roundRectPts(0, 0, 2, 2, 0.3), 0, 0.3, 100);
yes(ex[ex.length - 1].tone === 1 && ex.slice(0, -1).some((p) => p.tone === 0) && ex.slice(0, -1).some((p) => p.tone === 2), "an extruded plate: a light top side, a dark right side, its face mid");
const cy = cylinder([0, 0, 0], [0, 1, 0], 1, 1, [1, 0, 0], [0, 0, 1], 100);
yes(cy.length >= 3 && cy[cy.length - 1].tone === 1, "a cylinder along y: tone bands, then its mid cap");
const keys = [{ t: 0, x: 0, y: 0, zoom: 1 }, { t: 1, x: 100, y: 0, zoom: 4 }];
yes(cam2At(keys, 0.5).x === 50 && Math.abs(cam2At(keys, 0.5).zoom - 2) < 1e-9 && cam2At(keys, 2).x === 100, "the 2D camera eases between keys, zoom in log space");
for (const name of ["iso wall socket", "iso plug", "iso cutaway tight", "iso cutaway loose", "number label", "tip card"]) yes(ASSET_NAMES_FILE.includes(`"${name}"`), `the asset sheet shows "${name}"`);

// the layout manager knows pictures: two cards on top of each other (the old tips-screen bug) are reported, side by side they are not
yes(conflicts([{ id: "a", role: "picture", box: { x0: 100, y0: 500, x1: 500, y1: 800 } }, { id: "b", role: "picture", box: { x0: 300, y0: 700, x1: 700, y1: 1000 } }]).some((c) => c.includes("overlaps")), "two overlapping pictures are a conflict");
yes(conflicts([{ id: "a", role: "picture", box: { x0: 100, y0: 500, x1: 500, y1: 800 } }, { id: "b", role: "picture", box: { x0: 100, y0: 830, x1: 500, y1: 1000 } }]).length === 0, "pictures apart are fine");

console.log(`colokan: ${n} checks ok`);
