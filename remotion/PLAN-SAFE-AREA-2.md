# Safe areas, round 2: YouTube calibrated on ian's phone, caption at 1720 (plan for klipian eksekusi, approved by ian)

Written by klipian motion (planning only). Ian uploaded `out/safe/calibration.mp4` as a Short and sent a screenshot of the YouTube player on his phone (2026-10-31). Ian chose **caption bottom 1720**.

## What the screenshot shows (screen 720 x 1600; the video is shown whole at scale 0.667, between the app's top bar and the bottom bar)
- **Top:** the labels "y 0" and "y 50" are fully visible; the back arrow, search and menu sit on a black bar **outside** the video. Nothing covers the top of the video on this phone.
- **Bottom:** the title ("calibration") is drawn **below** the video, on the black bar. Only the channel row ("@klipian.podcast" and its avatar) covers the video: about **y 1830 and below**, on the left (x up to about 410).
- **Right:** the action buttons (Like, Save, Share, Remix, the audio icon) cover about **x 955 and right**, from about **y 1050** to the bottom. Above y 1050 the right edge is clear.
- **Caveat:** one phone, tall (about 20:9). On shorter phones (16:9 or 18:9) YouTube usually lays the title and description **over** the bottom of the video. 1720 keeps about 110 px between the caption and the channel row on ian's phone; it is ian's choice with that risk known.

## What to change
1. **The YouTube profile** in `SAFE_PLATFORMS` (the comment says: "calibrated on ian's phone 2026-10-31, one device; the earlier web estimates are kept in the comment"): `top` 120, `bottom` 1730, `left` 60, `right` 930. `SAFE` stays equal to the YouTube profile. TikTok and Instagram stay estimates until ian calibrates them with the same clip.
2. **Caption:** every variant (`classic`, `wide`, `punch`) ends at **`bottom` 1720**. Update B22 (1590 to 1720) with the reason (the calibration) and the caveat.
3. **Top text:** keep `TOP_TEXT.y` 170 (it looks good and keeps a margin for other phones); the safe top for other elements is 120.
4. **Use the room the caption gives back (about 130 px):** for each video (`kenapa-colokan-panas`, `ngantuk-pegang-hp`, `cara-kerja-hujan-buatan`) measure the free band between the scene and the caption box again and move the scene down with the existing `stageDrop` (and the matching label, badge and source-card positions in `plan.ts`) so the picture fills the frame evenly between the top text and the caption: keep the hero rule (60 to 70 % of the width at the main shot), `conflicts()` clean every 3 frames, and every element above 1730 and left of 930. Report the chosen drop per video and before | after stills (`out/safe2/compare-<video>-<t>.png`).
5. **The safe-check and the overlay** use the new YouTube profile; regenerate `out/safe/sheet.png` as `out/safe2/sheet.png`.
6. **Keep the evidence:** copy ian's screenshot (`C:\Users\user\AppData\Local\Temp\claude\D--github-repos-klipian\2be52f25-d85c-4bfe-86d6-1bde291e3adc\images\32.jpg`) into the repo as `remotion/docs/safe/youtube-2026-10-31.jpg` and name it in the profile's comment and in `DESIGN.md` (B24: "YouTube calibrated from ian's screenshot; recalibrate when the app changes").
7. **The brief's catalogue line** about the safe area reads the constants (no typed numbers).

## Tests
The YouTube profile values; every caption variant's tallest box ends at 1720 and stays inside x 60..930; the top text at 170; `conflicts()` clean for all videos; the cross-post mode still picks the strictest profile (Instagram's bottom 1500 wins when listed); tests that named 1590 or 1600 read the constants.

## Limits and report
Only `remotion/src/tokens.ts`, `src/layout.ts`, the video plans, `scripts/safeCheck.mjs`, tests, `DESIGN.md`, `remotion/docs/safe/`. `npm run check && npm test` and the Python selftest. Do not re-render ian's final videos; no API key, no service call, nothing uploaded or downloaded; do not write to `workspace/`; commit locally, do NOT push; do not commit other sessions' files. Report the drops, the stills and the sheet.
