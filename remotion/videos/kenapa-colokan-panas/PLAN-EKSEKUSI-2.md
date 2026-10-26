# Pilot 1 "Kenapa colokan bisa panas?": plan round 2 for klipian eksekusi

Written by klipian motion (planning only). Round 1 (`PLAN-EKSEKUSI.md`) is done and verified: commit d1dcade, `npm run check && npm test` green (colokan 73 checks), render `out/colokan/colokan-25d.mp4` (45 s, 45 sfx, mean -23.5 dB, peak -7.3 dB).
Ian watched the video: overall good (2.5D picture, sound effects, animation), fine for now, "to be improved further later". He gave no detailed list yet, so this round only closes the two open items below. Nothing else changes.

## Work (small; touch only the files named)

1. **Plug under the caption at 40.5 s** (`videos/kenapa-colokan-panas/plan.ts`; `index.tsx` only if needed). In the tips, the pulled-out plug body still sits behind the lower-left of the caption box ("minta teknisi menggantinya."). Move the plug (or the tips camera) so the plug and its cable stay clear of the caption box for the whole 37.5–41 s window, while the plate and the yellow ring stay fully visible and clear of the tip card. Add a check in `tests/colokan.test.ts` that the plug's screen box does not intersect the caption box at 38, 39, 40, 40.5 and 41 s (reuse the existing cable-vs-caption helper).
2. **Motion in second 1 (1.0–2.0 s)** (`plan.ts`, particles in `src/components/Iso.tsx` if needed). Measured mean frame difference: second 1 = 1.14 (lowest in the video), second 6 = 1.33. Add small meaningful motion (heat shimmer rising from the plug, glow pulse, slow push) so seconds 1 and 6 reach at least 1.5. Do not add objects or text, and keep the hook readable: the caption "Colokan kok panas?" stays as it is.
3. **Seconds 35 and 43** measure 1.47 (just under 1.5). Only if it is cheap with the same slow-push approach; skip if it costs more than a few lines.

## Verify (before reporting)
- `npm run check && npm test` pass.
- Frames at 38, 39, 40, 40.5, 41 s (plug vs caption) and 0.5, 1.0, 1.5, 6.0 s (motion), via `node scripts/frames.mjs video-kenapa-colokan-panas out/colokan/fix2 <seconds...>`.
- No ffmpeg/python load running, then `node render.mjs out/colokan-video.json`. Report the render time.
- Recompute the per-second motion (6 fps frame difference) and list any second still under 1.5.
- Commit only your own paths locally. Do not push; ian approves pushes.

## Not for eksekusi (waiting for ian)
Tick or reject the 5 claims; import the narration in `/remotion` and render from `story.voiced.json`; listen and watch on a phone; decide on publish; approve the push (5 unpushed local commits: 955c42a, d5559eb, 1b5826b, b45e4fe, d1dcade, plus this plan).
