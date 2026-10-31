// node scripts/safeCheck.mjs <slug> [--platforms youtube,tiktok,instagram]
// Platform safe areas (PLAN-SAFE-AREA, B24): lists, per platform, what text or key element of a custom video falls inside that platform's covered bands (the top, the
// bottom, the left and the right edge), at every third frame. YouTube is obeyed by the layout, so it should read clean; TikTok and Instagram are only checked. The result
// is a FLAG and never a failure (exit code 0): ian decides. The numbers are estimates, not official (src/tokens.ts: SAFE_PLATFORMS).
// The right band is applied below y RIGHT_BAND_FROM only: the action buttons are a column in the lower part of the screen (an approximation, like the numbers).
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { FPS } from "../src/timeline.ts";
import { validateStory } from "../src/schema.ts";
import { PLATFORM_NAMES, SAFE_PLATFORMS } from "../src/tokens.ts";
import { textWidthEstimate } from "../src/layout.ts";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
export const RIGHT_BAND_FROM = 700;
const KEY_ROLES = new Set(["caption", "banner", "text", "badge"]);   // the text-like elements; pictures and the hero (camera-scaled, often larger than the frame) are not flagged

const wrapN = (text, fs, width) => { let lines = 0, cur = ""; for (const w of text.split(/\s+/)) { if (cur && textWidthEstimate(`${cur} ${w}`, fs) > width) { lines++; cur = w; } else cur = cur ? `${cur} ${w}` : w; } return lines + (cur ? 1 : 0); };

/** The covered bands a box falls into for one platform profile: [{ band, by }] with `by` the px it reaches into the band. */
export function bandsHit(box, p) {
  const hit = [];
  if (box.y0 < p.top) hit.push({ band: "top", by: Math.round(p.top - box.y0) });
  if (box.y1 > p.bottom) hit.push({ band: "bottom", by: Math.round(box.y1 - p.bottom) });
  if (box.x0 < p.left) hit.push({ band: "left", by: Math.round(p.left - box.x0) });
  if (box.x1 > p.right && box.y1 > RIGHT_BAND_FROM) hit.push({ band: "right", by: Math.round(box.x1 - p.right) });
  return hit;
}

/** Every key box of a video at the sampled frames: [{ t, id, role, box }]. */
export async function keyBoxes(slug, story) {
  const mod = await import(pathToFileURL(path.join(ROOT, "videos", slug, "plan.ts")).href);
  const P = mod.makePlan(story);
  const tipH = (i) => { const tp = P.tips?.[i]; if (!tp) return 200; return 48 + wrapN(tp.title, 58, P.TIP.w - 170) * 66 + (tp.sub ? wrapN(tp.sub, 40, P.TIP.w - 170) * 50 + 8 : 0) + (tp.chip ? 46 : 0) + 30; };
  const cardH = (q) => 150 + wrapN(`“${q}”`, 38, 750) * 38 * 1.28;
  const out = [];
  for (let f = 0; f < P.total * FPS; f += 3) {
    const t = f / FPS;
    const specs = P.specsAt.length >= 3 ? P.specsAt(t, cardH, tipH) : P.specsAt(t, tipH);
    for (const s of specs) if (KEY_ROLES.has(s.role) || s.id === "top-text") out.push({ t, id: s.id, role: s.role, box: s.box });
  }
  return out;
}

/** The report of a story with `boxes` (from keyBoxes or a fixture): { platform: [{ id, band, by, from, to }] } for the platforms asked. */
export function safeReport(boxes, platforms = PLATFORM_NAMES) {
  const report = {};
  for (const name of platforms) {
    const p = SAFE_PLATFORMS[name];
    const found = new Map();
    for (const b of boxes) for (const h of bandsHit(b.box, p)) {
      const key = `${b.id}|${h.band}`, e = found.get(key);
      if (e) { e.by = Math.max(e.by, h.by); e.to = b.t; } else found.set(key, { id: b.id, band: h.band, by: h.by, from: b.t, to: b.t });
    }
    report[name] = [...found.values()];
  }
  return report;
}

export function reportLines(report) {
  const lines = [];
  for (const [name, list] of Object.entries(report)) {
    const p = SAFE_PLATFORMS[name];
    const area = `top ${p.top}, bottom ${p.bottom}, left ${p.left}, right ${p.right}`;
    if (!list.length) { lines.push(`PASS  ${name}: nothing falls in the covered bands (${area})`); continue; }
    lines.push(`FLAG  ${name} (estimate, not official; ${area}): ${list.length} element(s) in a covered band`);
    for (const e of list) lines.push(`      ${e.id}: into the ${e.band} band by ${e.by} px, ${e.from.toFixed(1)}-${e.to.toFixed(1)} s`);
  }
  return lines;
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  const slug = process.argv[2];
  if (!slug) { console.error("usage: node scripts/safeCheck.mjs <slug> [--platforms youtube,tiktok,instagram]"); process.exit(2); }
  const pi = process.argv.indexOf("--platforms");
  const platforms = pi > 0 ? process.argv[pi + 1].split(",") : PLATFORM_NAMES;
  const v = validateStory(JSON.parse(readFileSync(path.join(ROOT, "videos", slug, "story.json"), "utf8")));
  if (!v.ok) { console.error(`the story of ${slug} is not valid: ${v.errors.join("; ")}`); process.exit(1); }
  const story = { ...v.story, captions: true };
  const boxes = await keyBoxes(slug, story);
  console.log(`safe-check ${slug} (captions on, every third frame; right band below y ${RIGHT_BAND_FROM}):`);
  for (const l of reportLines(safeReport(boxes, platforms))) console.log(l);
}
