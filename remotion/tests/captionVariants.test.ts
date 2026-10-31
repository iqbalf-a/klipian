/* The three caption looks (PLAN-CAPTION-OPTIONS, B23): `classic` (today's caption, the default), `wide` (one line) and `punch` (at most three words a page).
   Layout only: the text style is locked (B17) and is read from the source here. `npm test`. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { makePlan as makeNgantuk } from "../videos/ngantuk-pegang-hp/plan.ts";
import { makePlan as makeRain } from "../videos/cara-kerja-hujan-buatan/plan.ts";
import { makePlan as makeColokan } from "../videos/kenapa-colokan-panas/plan.ts";
import { validateStory } from "../src/schema.ts";
import { CAPTION_STYLE_NAMES, SAFE } from "../src/tokens.ts";
import { CAPTION, CAPTION_VARIANTS, captionBox, captionVariant, textWidthEstimate, type CaptionStyle } from "../src/layout.ts";
import { pagesOf, wordsOfBeat } from "../src/captions.ts";
import { FPS } from "../src/timeline.ts";

let n = 0;
const yes = (cond: boolean, what: string) => { n++; assert.ok(cond, what); };
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const STYLES = CAPTION_STYLE_NAMES as readonly CaptionStyle[];

// --- classic is today's caption, exactly -----------------------------------------------------------------------------------------------------
const c = CAPTION_VARIANTS.classic;
yes(c.fs === 56 && c.maxTextWidth === 770 && c.maxLines === 2 && c.maxWords === Infinity && c.padX === 30 && c.padY === 22 && c.cx === (SAFE.left + SAFE.right) / 2 && c.bottom === SAFE.bottom - 10,
  "classic is the channel's caption: fs 56, 770 px, two lines, centred in the safe area, the bottom 10 px above SAFE.bottom (B24)");
yes(CAPTION === CAPTION_VARIANTS.classic && captionVariant().fs === 56 && captionVariant(undefined).maxLines === 2, "a missing style is classic");
const cb = captionBox("classic");
yes(cb.x0 === c.cx - 415 && cb.x1 === c.cx + 415 && cb.y1 === SAFE.bottom - 10 && Math.abs(cb.y0 - (cb.y1 - (2 * 56 * 1.22 + 44))) < 1e-9 && cb.x0 >= SAFE.left && cb.x1 <= SAFE.right, `classic's box: x ${cb.x0}..${cb.x1}, the top ${cb.y0.toFixed(2)} for two lines`);
yes(JSON.stringify(captionBox()) === JSON.stringify(cb), "the box with no style is the classic box");

// --- the three looks: the numbers the plan gives -----------------------------------------------------------------------------------------------
yes(CAPTION_VARIANTS.wide.fs === 46 && CAPTION_VARIANTS.wide.maxTextWidth === 800 && CAPTION_VARIANTS.wide.maxLines === 1, "wide: fs 46, 800 px (its box ends at x 920), one line");
yes(CAPTION_VARIANTS.punch.fs === 76 && CAPTION_VARIANTS.punch.maxTextWidth === 700 && CAPTION_VARIANTS.punch.maxWords === 3, "punch: fs 76, 700 px, three words a page");
for (const s of STYLES) yes(CAPTION_VARIANTS[s].bottom === SAFE.bottom - 10, `${s}: the box bottom is ${SAFE.bottom - 10} (10 px above the YouTube bottom estimate ${SAFE.bottom})`);
yes(captionBox("wide").y1 - captionBox("wide").y0 < cb.y1 - cb.y0, "wide's box is shorter than classic's (one line)");

// --- the three videos' narrations, every page of every beat, in each look ------------------------------------------------------------------
const videos = ["kenapa-colokan-panas", "ngantuk-pegang-hp", "cara-kerja-hujan-buatan"] as const;
const storyOf = (slug: string) => {
  const v = validateStory(JSON.parse(readFileSync(path.join(ROOT, "videos", slug, "story.json"), "utf8")));
  if (!v.ok) throw new Error(`the story of ${slug} is not valid: ${v.errors.join("; ")}`);
  return v.story;
};
const stories = Object.fromEntries(videos.map((slug) => [slug, storyOf(slug)]));

for (const s of STYLES) {
  const v = captionVariant(s);
  let longest = 0, pagesChecked = 0;
  for (const slug of videos) {
    for (const beat of stories[slug].beats) {
      const pages = pagesOf(wordsOfBeat(beat), v.fs, v.maxTextWidth, v.maxLines, v.maxWords);
      for (const page of pages) {
        pagesChecked++;
        const space = textWidthEstimate(" ", v.fs);
        const widths = page.lines.map((line) => line.reduce((acc, i, k) => acc + textWidthEstimate(page.words[i].w, v.fs) + (k ? space : 0), 0));
        const boxW = Math.max(...widths) + v.padX * 2;
        const x0 = v.cx - boxW / 2, x1 = v.cx + boxW / 2;
        longest = Math.max(longest, boxW);
        yes(x0 >= SAFE.left && x1 <= SAFE.right, `${s}: a page of ${slug} stays inside x ${SAFE.left}..${SAFE.right} (${x0.toFixed(0)}..${x1.toFixed(0)})`);
        yes(page.lines.length <= v.maxLines, `${s}: a page has at most ${v.maxLines} line(s)`);
        yes(page.words.length <= v.maxWords, `${s}: a page has at most ${v.maxWords} word(s)`);
      }
    }
  }
  yes(pagesChecked > 0, `${s}: the pages of the three videos were checked (${pagesChecked})`);
}

// --- conflicts() every third frame for the three videos in each look (the scene keeps clear of the variant's tallest box) ----------------
const wrapN = (text: string, fs: number, width: number) => { let lines = 0, cur = ""; for (const w of text.split(/\s+/)) { if (cur && textWidthEstimate(`${cur} ${w}`, fs) > width) { lines++; cur = w; } else cur = cur ? `${cur} ${w}` : w; } return lines + (cur ? 1 : 0); };
const cardH = (q: string) => 150 + wrapN(`“${q}”`, 38, 770) * 38 * 1.28;
for (const s of STYLES) {
  for (const slug of videos) {
    const story = { ...stories[slug], captionStyle: s };
    const P: any = slug === "ngantuk-pegang-hp" ? makeNgantuk(story) : slug === "cara-kerja-hujan-buatan" ? makeRain(story) : makeColokan(story);
    const tipH = (i: number) => { const tp = P.tips[i]; return 48 + wrapN(tp.title, 58, P.TIP.w - 170) * 66 + (tp.sub ? wrapN(tp.sub, 40, P.TIP.w - 170) * 50 + 8 : 0) + (tp.chip ? 46 : 0) + 30; };
    const bad: string[] = [];
    for (let f = 0; f < P.total * FPS; f += 3) {
      const t = f / FPS;
      const pr = slug === "kenapa-colokan-panas" ? P.problemsAt(t, cardH, tipH) : P.problemsAt(t, tipH);
      if (pr.length) bad.push(`${t.toFixed(2)}s: ${pr.join("; ")}`);
    }
    yes(bad.length === 0, `${s} with ${slug}: no overlap on any third frame (${bad.slice(0, 3).join(" | ")})`);
  }
}

// --- the schema: three names accepted, any other refused, missing = classic ----------------------------------------------------------------
const base = stories["ngantuk-pegang-hp"];
for (const s of STYLES) yes(validateStory({ ...base, captionStyle: s }).ok === true, `the schema accepts captionStyle "${s}"`);
yes(validateStory({ ...base, captionStyle: "huge" }).ok === false, "the schema refuses an unknown caption look");
const missing = validateStory({ ...base, captionStyle: undefined });
yes(missing.ok === true && missing.story.captionStyle === undefined, "a story without captionStyle stays valid (classic)");

// --- the text style is locked (B17): read from the source, in every look -------------------------------------------------------------------
const captionsSrc = readFileSync(path.join(ROOT, "src", "components", "Captions.tsx"), "utf8");
for (const want of ["fill={BLACK} opacity={0.88}", "fill={wi === act ? YELLOW : WHITE}", "opacity={wi > act ? 0.78 : 1}", "fontWeight: 700", "FONT_BOLD"]) {
  yes(captionsSrc.includes(want), `the caption's text style is unchanged: ${want}`);
}
yes(!/CAPTION_VARIANTS\.\w+\.(fill|opacity|fontFamily)/.test(captionsSrc), "no look changes the colour, the opacity or the font");
const layoutSrc = readFileSync(path.join(ROOT, "src", "layout.ts"), "utf8");
yes(!/fill|opacity|fontFamily/.test(layoutSrc.slice(layoutSrc.indexOf("CAPTION_VARIANTS"), layoutSrc.indexOf("export const captionVariant"))), "the variants hold layout numbers only (no colour, opacity or font)");

console.log(`captionVariants: ${n} checks ok`);
