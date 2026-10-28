# The empty bottom: move the caption lower and balance the scene (plan for klipian eksekusi, approved by ian)

Written by klipian motion (planning only). Ian (2026-10-28), looking at a frame of the rain video ("Disebar ke awan"): "the bottom part is still empty; maybe the subtitle can move down a little more."

## What the numbers say (read in `src/layout.ts` and `src/tokens.ts`)
- The caption box ends at `CAPTION.bottom = 1600`. The safe area ends at `SAFE.bottom = 1632` (the Shorts interface covers the bottom 15 %, y > 1632, and the right 12 %). **So the caption can move down by at most about 30 px**: text below y 1632 is hidden by the YouTube buttons and title on a phone. The empty strip ian sees is mostly the unsafe zone (y 1632 to 1920) and the floor band of the brand background: it cannot carry text.
- So moving only the subtitle is a small gain. The real fix has two parts: the caption goes as low as is safe, and the **scene is balanced lower** so the picture fills the space the caption leaves above it.

## What to do
1. **Caption lower, safely:** `CAPTION.bottom` from 1600 to **1620** (a 12 px margin to 1632). It is one constant used by `Captions.tsx` and by `captionBox()` (the layout manager keeps the scene clear of it), so every video follows. Tests that name 1600 follow the constant. Check with the caption of two lines and of one line at the widest allowed text.
2. **Balance the scene vertically.** Measure first, on stills of `kenapa-colokan-panas`, `ngantuk-pegang-hp` and `cara-kerja-hujan-buatan` (one still per beat kind, with captions on): the gap between the lowest scene content and the top of the caption box, and the gap between the title zone and the highest scene content. Report the numbers in a small table. Then add **one shared constant `STAGE_DROP` (px)** that moves the diorama stage and the hero down for **new stories** (try 40 px; choose the value that keeps `conflicts()` clean, the hero 60 to 70 % rule and the label zones valid) and applies **only to videos that opt in** through their `plan.ts` (`stageDrop`), so pilot 1 and the existing videos do not move unless ian approves. For `ngantuk-pegang-hp` and `cara-kerja-hujan-buatan` try the opt-in and show before | after stills; keep it only if the layout checks pass.
3. **The floor band below the stage** (the grey strip near y 1670 and below): do not try to put text there. If the strip still looks empty after 1 and 2, propose (do not apply) one option for ian: a softer floor tone per theme, or the stage drawn a little larger. Tokens only, no new colour literals.
4. **New rule** (add to `DESIGN.md` and the rule log): "The caption sits as low as the safe area allows (`CAPTION.bottom` 1620); nothing but the Shorts interface may be below y 1632."

## Verify and report
`npm run check && npm test` (the layout tests every 3 frames for all videos). Before | after stills of one beat of each of the three videos with the caption on. Say which videos moved (the caption moves in all; the stage only for those that opted in). Do not re-render ian's final videos.

## Limits
Only `remotion/src/layout.ts`, `src/components/Captions.tsx`, the plans of the opted-in videos, tests, `DESIGN.md`. No API key, no service call, nothing downloaded; do not write to `workspace/`; commit locally, do NOT push; do not commit files of other sessions.
