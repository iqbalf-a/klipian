# Three subtitle looks to choose from (plan for klipian eksekusi, approved by ian)

Written by klipian motion (planning only). Ian (2026-10-29): "make 3 subtitle display options; one of them is the current position; I will choose." Build the three as **variants of the same caption**, show them side by side on real frames, change **no default** until ian picks.

## What stays locked (B17, do not change in any variant)
Black box (`BLACK`, opacity 0.88, rounded), white text, the spoken word yellow (`YELLOW`), the not-yet-spoken words at the existing dimmer opacity, font Outfit Bold (`FONT_BOLD`). Karaoke word timing and the pop-in are unchanged. The box and its text stay inside the safe area (x 60..950, bottom edge at or above `CAPTION.bottom` 1620; nothing below y 1632).

## The three variants (a registry `CAPTION_VARIANTS` in `src/layout.ts`; today's `CAPTION` becomes the first entry)
1. **`classic` (current):** `fs` 56, `maxTextWidth` 770, up to two lines, `bottom` 1620. Reference; behaves exactly as today.
2. **`wide` (one wide line):** a **single line** per page across almost the full safe width: `fs` 46, `maxTextWidth` 860, `maxLines` 1, `bottom` 1620. The box is about 100 px tall (today's two lines make it about 180 px), so the scene gets roughly 80 px more room above it, and the text feels like a film subtitle. More page changes (about 5 to 7 words per page).
3. **`punch` (short and big):** `fs` 76, `maxTextWidth` 700, **at most 3 words per page**, one or two lines, `bottom` 1620. Fast, loud, like short-video captions: the yellow word changes more often and the box is shorter than `classic` on most pages.
The layout manager's `captionBox()` must come from the chosen variant (the **tallest box** the variant can produce, so `conflicts()` stays valid for any page), and `pagesOf` takes the variant's `fs`, `maxTextWidth`, `maxLines` and `maxWords`.

## How a video picks one
An optional story field **`captionStyle`**: `"classic"` (the default when missing, so every existing story is unchanged), `"wide"`, `"punch"`; accepted by `src/schema.ts` (anything else is refused) and passed to `Captions.tsx` through the story context (as `theme` and `stage` are). The brief names the field only **after ian has chosen** (do not add it to the brief now).

## The comparison for ian
Render stills with the captions on, for the **same three beats** of `kenapa-colokan-panas`, `ngantuk-pegang-hp` and `cara-kerja-hujan-buatan` (pick three beats where the caption has two lines in `classic`, one line, and a long sentence), each in the three variants, with the same word active in each. Write them to `remotion/out/captions/<video>-<beat>-<variant>.png` and one contact sheet `remotion/out/captions/sheet.png` (rows = beats, columns = classic | wide | punch, the variant name above each column). Print the box height and width of each next to the stills (one small table: variant, box height for 1 line and 2 lines, the free room above the box).

## Tests
Each variant: the box stays inside x 60..950 and above y 1620 for the longest page of the three videos' narrations; `conflicts()` every 3 frames is clean for the three videos in each variant (the scene keeps clear of the variant's tallest box); `classic` produces exactly today's pages and box (a test against the current values); the schema accepts the three names and refuses others; the text style constants are unchanged (a test that reads `BLACK`, the opacity and the fonts used by all variants).

## Limits and report
Only `remotion/src/layout.ts`, `src/components/Captions.tsx`, `src/schema.ts`, the story context file, tests and `DESIGN.md` (a rule "B23: caption variants are layout only; the text style is locked"). **Do not change the default and do not re-render ian's final videos.** `npm run check && npm test`. Report with the sheet path and the small table. No API key, no service call, nothing downloaded; do not write to `workspace/`; commit locally, do NOT push; do not commit other sessions' files (`scratch-nature-rules.tmp.txt`, `sleep-inertia-brief.json`, `video-story.json`).
