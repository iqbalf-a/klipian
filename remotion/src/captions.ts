/* Karaoke captions (P28-P): the words of a beat's narration with their times, grouped into pages of one or two lines, and which word is being
   spoken now. Pure, so `npm test` can check it. The times come from the voice track (klipian aligns it with faster-whisper and writes them into
   the story's `words`); without a voice, an even estimate by the length of each word. */
import { textWidthEstimate } from "./layout.ts";

export type CWord = { w: string; a: number; b: number };
export type Page = { words: CWord[]; lines: number[][]; a: number; b: number };

/** The words of a narration spread over `dur` seconds in proportion to their length, with a short lead-in and a tail (the estimate used without a voice). */
export function estimateWords(narration: string, dur: number, lead = 0.2, tail = 0.35): CWord[] {
  const words = narration.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const span = Math.max(0.2, dur - lead - tail), total = words.reduce((n, w) => n + w.length + 2, 0);
  let t = lead;
  return words.map((w) => { const d = (span * (w.length + 2)) / total, out = { w, a: +t.toFixed(3), b: +(t + d).toFixed(3) }; t += d; return out; });
}

export const wordsOfBeat = (beat: { narration: string; dur: number; words?: readonly CWord[] }): CWord[] => (beat.words?.length ? [...beat.words] : estimateWords(beat.narration, beat.dur));

/** Pages of at most `maxLines` lines of at most `maxWidth` pixels (at font size `fs`): the page shows while its words are spoken. */
export function pagesOf(words: readonly CWord[], fs = 56, maxWidth = 760, maxLines = 2, maxWords = Infinity): Page[] {
  const pages: Page[] = [];
  let cur: CWord[] = [], lines: number[][] = [[]], width = 0;
  const space = textWidthEstimate(" ", fs);
  const flush = () => { if (cur.length) pages.push({ words: cur, lines, a: cur[0].a, b: cur[cur.length - 1].b }); cur = []; lines = [[]]; width = 0; };
  for (const w of words) {
    if (cur.length >= maxWords) flush();                         // a look with a word limit (punch: three words a page)
    const wd = textWidthEstimate(w.w, fs);
    if (lines[lines.length - 1].length && width + space + wd > maxWidth) {
      if (lines.length >= maxLines) flush(); else { lines.push([]); width = 0; }
    }
    const line = lines[lines.length - 1];
    width += (line.length ? space : 0) + wd;
    line.push(cur.length);
    cur.push(w);
  }
  flush();
  return pages;
}

/** The page on screen at time `t` (it stays until the next one starts, and a little after the last word), or null. */
export function pageAt(pages: readonly Page[], t: number, hold = 0.4): Page | null {
  let found: Page | null = null;
  pages.forEach((p, i) => { const end = i + 1 < pages.length ? pages[i + 1].a : p.b + hold; if (t >= p.a - 0.05 && t < end) found = p; });
  return found;
}

/** The index (in the page) of the word being spoken at `t`: -1 before the first, the last one after it. */
export function activeWord(page: Page, t: number): number {
  let k = -1;
  page.words.forEach((w, i) => { if (t >= w.a) k = i; });
  return k;
}
