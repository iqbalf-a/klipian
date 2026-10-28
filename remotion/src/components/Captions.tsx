/* The two text layers of a voiced video (P28-P): the karaoke captions at the bottom (one or two lines in a dark rounded box, the word being spoken
   in yellow) and the top text (a small mono kicker over a bold headline). Both are drawn inside the safe area; the layout manager keeps the rest of
   the scene clear of them (layout.ts: captionBox, topTextBox). */
import React from "react";
import { BLACK, FONT_BOLD, FONT_MONO, WHITE, YELLOW, YELLOW_D } from "../tokens.ts";
import { activeWord, pageAt, pagesOf, wordsOfBeat } from "../captions.ts";
import { TOP_TEXT, captionVariant, textWidthEstimate, type CaptionStyle } from "../layout.ts";
import { springAt } from "../motion.ts";

const bold = { fontFamily: `"${FONT_BOLD}", sans-serif`, fontWeight: 700 } as const;
/** The caption look of the story (PLAN-CAPTION-OPTIONS): provided by the video's story; classic when there is none. The text style does not change with it (B17). */
export const CaptionStyleCtx = React.createContext<CaptionStyle>("classic");

export const CaptionLayer: React.FC<{ beat: { narration: string; dur: number; words?: readonly { w: string; a: number; b: number }[] }; t: number }> = ({ beat, t }) => {
  const v = captionVariant(React.useContext(CaptionStyleCtx));              // read every render: the hooks keep their order
  const pages = React.useMemo(() => pagesOf(wordsOfBeat(beat), v.fs, v.maxTextWidth, v.maxLines, v.maxWords), [beat, v]);
  const page = pageAt(pages, t);
  if (!page) return null;
  const act = activeWord(page, t), space = textWidthEstimate(" ", v.fs);
  const widths = page.lines.map((line) => line.reduce((n, i, k) => n + textWidthEstimate(page.words[i].w, v.fs) + (k ? space : 0), 0));
  const boxW = Math.max(...widths) + v.padX * 2, boxH = page.lines.length * v.fs * 1.22 + v.padY * 2 - v.fs * 0.1;
  const pop = springAt(t, page.a - 0.05, true), cx = v.cx;
  const y0 = v.bottom - boxH;
  return (
    <g opacity={Math.min(1, pop * 2)} transform={`translate(0 ${(1 - pop) * 14})`}>
      <rect x={cx - boxW / 2} y={y0} width={boxW} height={boxH} rx={v.fs * 0.5} fill={BLACK} opacity={0.88} />
      {page.lines.map((line, li) => {
        let x = cx - widths[li] / 2;
        return line.map((wi, k) => {
          const w = page.words[wi], wd = textWidthEstimate(w.w, v.fs), here = x;
          x += wd + space;
          return <text key={`${li}-${k}`} x={here} y={y0 + v.padY + v.fs * 0.95 + li * v.fs * 1.22} fontSize={v.fs} fill={wi === act ? YELLOW : WHITE} opacity={wi > act ? 0.78 : 1} style={bold}>{w.w}</text>;
        });
      })}
    </g>
  );
};

/** The kicker (small, mono, upper case) over the headline (bold, up to two lines): they come in together and change with the beat. */
export const TopText: React.FC<{ kicker?: string; headline: string; t: number; onDark?: boolean }> = ({ kicker, headline, t, onDark }) => {
  const p = springAt(t, 0.05, true);
  const ink = onDark ? WHITE : BLACK, key = onDark ? YELLOW : YELLOW_D;
  const lines: string[] = [];
  let cur = "";
  for (const w of headline.split(/\s+/)) { if (cur && textWidthEstimate(`${cur} ${w}`, TOP_TEXT.fs) > TOP_TEXT.maxWidth) { lines.push(cur); cur = w; } else cur = cur ? `${cur} ${w}` : w; }
  if (cur) lines.push(cur);
  return (
    <g opacity={Math.min(1, p * 2)} transform={`translate(0 ${(1 - p) * -16})`}>
      {kicker && <text x={TOP_TEXT.x} y={TOP_TEXT.y + 30} fontSize={TOP_TEXT.kickerFs} fill={key} letterSpacing={3} style={{ fontFamily: `"${FONT_MONO}", monospace`, fontWeight: 400 }}>{kicker.toUpperCase()}</text>}
      {lines.map((ln, i) => <text key={i} x={TOP_TEXT.x} y={TOP_TEXT.y + (kicker ? 52 : 14) + TOP_TEXT.fs * (0.95 + i * 1.12)} fontSize={TOP_TEXT.fs} fill={ink} style={bold}>{ln}</text>)}
    </g>
  );
};
