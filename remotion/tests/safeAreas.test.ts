/* The platform safe areas (PLAN-SAFE-AREA, B24): YouTube Shorts is obeyed (SAFE), TikTok and Instagram are checked, the story's `platforms` switches on the strictest
   profile. The numbers are estimates (sources and date in the comment of SAFE_PLATFORMS). `npm test`. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { makePlan as makeNgantuk } from "../videos/ngantuk-pegang-hp/plan.ts";
import { makePlan as makeRain } from "../videos/cara-kerja-hujan-buatan/plan.ts";
import { makePlan as makeColokan } from "../videos/kenapa-colokan-panas/plan.ts";
import { validateStory } from "../src/schema.ts";
import { BANNER_TOP, CAPTION_STYLE_NAMES, PLATFORM_NAMES, SAFE, SAFE_PLATFORMS, safeFor } from "../src/tokens.ts";
import { BANNER_BOTTOM, CAPTION_VARIANTS, TOP_TEXT, ZONES, captionBox, textWidthEstimate, topTextBox } from "../src/layout.ts";
import { FPS } from "../src/timeline.ts";
import { bandsHit, safeReport } from "../scripts/safeCheck.mjs";

let n = 0;
const yes = (cond: boolean, what: string) => { n++; assert.ok(cond, what); };
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

// --- the profiles --------------------------------------------------------------------------------------------------------------------------
yes(JSON.stringify([...PLATFORM_NAMES]) === JSON.stringify(["youtube", "tiktok", "instagram"]), "the three platforms");
const y = SAFE_PLATFORMS.youtube, t = SAFE_PLATFORMS.tiktok, i = SAFE_PLATFORMS.instagram;
yes(y.top === 170 && y.bottom === 1600 && y.left === 60 && y.right === 920, "the YouTube profile: top 170, bottom 1600, left 60, right 920");
yes(t.top === 140 && t.bottom === 1600 && t.left === 60 && t.right === 930, "the TikTok profile (checked, not obeyed)");
yes(i.top === 220 && i.bottom === 1500 && i.left === 65 && i.right === 1015, "the Instagram organic profile (checked, not obeyed)");
yes(SAFE === SAFE_PLATFORMS.youtube, "the working safe area SAFE is the YouTube profile");
const tokensSrc = readFileSync(path.join(ROOT, "src", "tokens.ts"), "utf8");
const doc = tokensSrc.slice(tokensSrc.indexOf("The platform safe areas"), tokensSrc.indexOf("export const SAFE_PLATFORMS"));
yes(/ESTIMATES, NOT OFFICIAL/.test(doc) && /2026-10-31/.test(doc) && /kreatli\.com/.test(doc) && /shortsafezone\.com/.test(doc) && /imagevideofit\.com/.test(doc) && /zeely\.ai/.test(doc),
  "the profiles say they are estimates, not official, with their sources and the date");

// --- what the layout keeps inside SAFE ---------------------------------------------------------------------------------------------------------
for (const s of CAPTION_STYLE_NAMES) {
  const b = captionBox(s);
  yes(b.y1 === 1590 && b.y1 <= SAFE.bottom - 10, `${s}: the tallest caption box ends at 1590`);
  yes(b.x0 >= SAFE.left && b.x1 <= SAFE.right && b.y0 >= SAFE.top, `${s}: the tallest caption box is inside SAFE (x ${b.x0}..${b.x1}, the top ${b.y0.toFixed(0)})`);
  yes(CAPTION_VARIANTS[s].bottom === 1590, `${s}: bottom 1590`);
}
yes(TOP_TEXT.y >= 170 && topTextBox().y0 >= SAFE.top, "the top text starts at 170 or below");
yes(topTextBox().x1 <= SAFE.right, "and ends inside the right edge");
yes(ZONES.banner.y0 === SAFE.top && BANNER_TOP === SAFE.top && BANNER_BOTTOM > SAFE.top, "the default banner starts at the safe top");
yes(ZONES.mascot.y + ZONES.mascot.w * 0.52 <= SAFE.bottom, "the persistent mascot's face area is above the safe bottom");

// --- the cross-post mode: the strictest of the listed profiles -----------------------------------------------------------------------------------
const both = safeFor(["youtube", "instagram"]);
yes(both.top === 220 && both.bottom === 1500 && both.left === 65 && both.right === 920, "youtube + instagram: the strictest on every edge");
yes(JSON.stringify(safeFor()) === JSON.stringify(SAFE_PLATFORMS.youtube) && JSON.stringify(safeFor(["tiktok"])) === JSON.stringify(SAFE_PLATFORMS.tiktok), "no list: YouTube; one platform: its own profile");
yes(captionBox("classic", ["youtube", "instagram"]).y1 === 1490, "the caption bottom follows the strictest profile (1490 with Instagram)");
yes(captionBox("classic").y1 === 1590 && captionBox("classic", ["youtube"]).y1 === 1590, "and stays 1590 for YouTube alone");

// --- every video, every look, the normal and the cross-post mode: the layout manager is clean -----------------------------------------------------
const videos = ["kenapa-colokan-panas", "ngantuk-pegang-hp", "cara-kerja-hujan-buatan"] as const;
const stories: Record<string, any> = {};
for (const slug of videos) {
  const v = validateStory(JSON.parse(readFileSync(path.join(ROOT, "videos", slug, "story.json"), "utf8")));
  if (!v.ok) throw new Error(`the story of ${slug}: ${v.errors.join("; ")}`);
  stories[slug] = v.story;
}
const wrapN = (text: string, fs: number, width: number) => { let lines = 0, cur = ""; for (const w of text.split(/\s+/)) { if (cur && textWidthEstimate(`${cur} ${w}`, fs) > width) { lines++; cur = w; } else cur = cur ? `${cur} ${w}` : w; } return lines + (cur ? 1 : 0); };
const cardH = (q: string) => 150 + wrapN(`“${q}”`, 38, 750) * 38 * 1.28;
for (const platforms of [undefined, ["youtube", "instagram"]] as const) {
  for (const style of CAPTION_STYLE_NAMES) {
    for (const slug of videos) {
      const story = { ...stories[slug], captions: true, captionStyle: style, ...(platforms ? { platforms: [...platforms] } : {}) };
      const P: any = slug === "ngantuk-pegang-hp" ? makeNgantuk(story) : slug === "cara-kerja-hujan-buatan" ? makeRain(story) : makeColokan(story);
      const tipH = (k: number) => { const tp = P.tips[k]; return 48 + wrapN(tp.title, 58, P.TIP.w - 170) * 66 + (tp.sub ? wrapN(tp.sub, 40, P.TIP.w - 170) * 50 + 8 : 0) + (tp.chip ? 46 : 0) + 30; };
      const bad: string[] = [];
      for (let f = 0; f < P.total * FPS; f += 3) {
        const at = f / FPS;
        const pr: string[] = slug === "kenapa-colokan-panas" ? P.problemsAt(at, cardH, tipH) : P.problemsAt(at, tipH);
        if (pr.length) bad.push(`${at.toFixed(1)}s: ${pr.join("; ")}`);
      }
      yes(bad.length === 0, `${slug} with ${style}${platforms ? " (youtube + instagram)" : ""}: the layout manager is clean (${bad.slice(0, 2).join(" | ")})`);
    }
  }
}

// --- the safe check: a fixture element inside the Instagram band is reported, YouTube stays clean ---------------------------------------------------
const fixture = [{ t: 1, id: "fixture-caption", role: "caption", box: { x0: 100, y0: 1420, x1: 900, y1: 1585 } }, { t: 2, id: "fixture-top", role: "text", box: { x0: 100, y0: 180, x1: 900, y1: 300 } }];
const rep = safeReport(fixture) as Record<string, { id: string; band: string; by: number }[]>;
yes(rep.youtube.length === 0 && rep.tiktok.length === 0, "an element inside SAFE is clean for YouTube and TikTok");
yes(rep.instagram.length === 2 && rep.instagram.some((e) => e.id === "fixture-caption" && e.band === "bottom" && e.by === 85) && rep.instagram.some((e) => e.id === "fixture-top" && e.band === "top" && e.by === 40),
  "the Instagram band reports the caption (bottom, by 85 px) and the text (top, by 40 px)");
yes(bandsHit({ x0: 100, y0: 300, x1: 1000, y1: 500 }, SAFE).length === 0 && bandsHit({ x0: 100, y0: 800, x1: 1000, y1: 900 }, SAFE).some((h) => h.band === "right"), "the right band counts below y 700 only");

// --- the story's `platforms` field ------------------------------------------------------------------------------------------------------------
const base = stories["ngantuk-pegang-hp"];
yes(validateStory({ ...base, platforms: ["youtube", "instagram"] }).ok === true && validateStory({ ...base, platforms: ["tiktok"] }).ok === true, "the schema accepts platforms");
yes(validateStory({ ...base, platforms: ["facebook"] }).ok === false && validateStory({ ...base, platforms: [] }).ok === false, "and refuses an unknown platform or an empty list");
yes(validateStory({ ...base, platforms: undefined }).ok === true, "a story without platforms is YouTube only");

console.log(`safeAreas: ${n} checks ok`);
