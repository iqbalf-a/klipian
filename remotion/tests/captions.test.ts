/* Karaoke captions (src/captions.ts) and the layers' place in the layout: `npm test`. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { activeWord, estimateWords, pageAt, pagesOf, wordsOfBeat } from "../src/captions.ts";
import { captionBox, conflicts, fixedLayers, layoutStory, textWidthEstimate, topTextBox } from "../src/layout.ts";
import { validateStory } from "../src/schema.ts";

let n = 0;
const yes = (cond: boolean, what: string) => { n++; assert.ok(cond, what); };
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

const text = "Di dalam stop kontak ada penjepit logam yang menggigit kaki colokan supaya listrik bisa lewat";
const est = estimateWords(text, 5);
yes(est.length === 15 && est[0].a >= 0.2 && est[est.length - 1].b <= 5 - 0.3, "an even estimate keeps the words inside the beat, with a lead-in and a tail");
yes(est.every((w, i) => w.b > w.a && (i === 0 || w[`a` as "a"] >= est[i - 1].b - 1e-9)), "each word starts when the one before it ends");
yes(est.find((w) => w.w === "menggigit")!.b - est.find((w) => w.w === "menggigit")!.a > est.find((w) => w.w === "di" || w.w === "Di")!.b - est[0].a, "a long word takes longer than a short one");
yes(estimateWords("", 3).length === 0, "no narration, no words");

const pages = pagesOf(est, 56, 770);
yes(pages.length >= 2 && pages.every((p) => p.lines.length <= 2), `the words come in pages of two lines at most (${pages.length} pages)`);
yes(pages.every((p) => p.lines.every((ln) => ln.reduce((w, i) => w + textWidthEstimate(p.words[i].w, 56) + 15, 0) <= 770 + 60)), "no line is wider than the caption box");
yes(pages.flatMap((p) => p.words).map((w) => w.w).join(" ") === text, "no word is lost or reordered");
yes(pageAt(pages, 0.0) === null || pageAt(pages, 0.0) === pages[0], "before the first word nothing (or the first page) shows");
const mid = pages[1].a + 0.05;
yes(pageAt(pages, mid) === pages[1], "at a time inside the second page, the second page shows");
yes(pageAt(pages, 99) === null, "after the last word and a short hold the captions are gone");
const pg = pages[0];
yes(activeWord(pg, pg.a - 0.5) === -1 && activeWord(pg, pg.words[1].a + 0.01) === 1 && activeWord(pg, pg.b + 1) === pg.words.length - 1, "the word being spoken is the one whose time it is");
yes(wordsOfBeat({ narration: "satu dua", dur: 2, words: [{ w: "satu", a: 0.5, b: 1 }, { w: "dua", a: 1, b: 1.4 }] })[0].a === 0.5, "word times from the voice win over the estimate");

// the layers are fixed zones for the layout
const story = validateStory(JSON.parse(readFileSync(path.join(ROOT, "stories", "captions-demo.json"), "utf8")));
assert.ok(story.ok);
const s = story.story;
yes(s.captions === true && s.beats[0].headline === "Colokan kok panas?" && s.beats[0].kicker === "pin cuma nempel di", "the demo story has captions, a kicker and a headline");
const laid = layoutStory(s);
for (const b of laid.beats) {
  const layers = fixedLayers(s, b);
  yes(layers.some((l) => l.role === "caption"), `${b.id}: the caption box is a fixed zone`);
}
const cb = captionBox(), tb = topTextBox();
yes(cb.x1 <= 950 + 1 && cb.y1 <= 1632 && cb.x0 >= 60 - 1, "the caption box is inside the safe area");
yes(tb.x1 <= 950 && tb.y1 < 330 && tb.y0 >= 80, "so is the top text");
yes(conflicts([{ id: "caption", role: "caption", box: cb }, { id: "t", role: "text", box: { x0: 300, y0: 1500, x1: 600, y1: 1560 } }]).length === 1, "a text on the caption box is a conflict");

// a beat with a headline has no banner; a kicker needs a headline; word times stay inside the beat
const bad = (mutate: (x: any) => void, re: RegExp, what: string) => { const c = JSON.parse(JSON.stringify(s)); mutate(c); const v = validateStory(c); yes(!v.ok && v.errors.some((e) => re.test(e)), what); };
bad((x) => x.beats[0].scene.items.push({ type: "banner", text: "Banner" }), /no banner/, "a headline and a banner together are refused");
bad((x) => { delete x.beats[0].headline; }, /kicker goes over a headline/, "a kicker without a headline is refused");
bad((x) => { x.beats[0].words = [{ w: "halo", a: 2, b: 1 }]; }, /end after it starts/, "a word that ends before it starts is refused");
bad((x) => { x.beats[0].words = [{ w: "halo", a: 0, b: 99 }]; }, /inside the beat/, "a word that ends after its beat is refused");
bad((x) => { x.beats[0].headline = "satu dua tiga empat lima enam tujuh"; }, /6 words/, "a headline over 6 words is refused");
bad((x) => { x.music = { track: "bed-nope" }; }, /music/, "a music bed that does not exist is refused");
const okMusic = JSON.parse(JSON.stringify(s)); okMusic.music = { track: "bed-calm", level: 0.8 };
yes(validateStory(okMusic).ok, "a music bed from the list and a level are accepted");

console.log(`captions: ${n} checks ok`);
