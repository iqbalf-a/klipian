# Bug: Edit > Clips cannot play the original video, only the AI JSON suggestions

Plan session, 2026-11-04. Reported by ian.

## Symptom
On the Clips tab, the full source preview (`#tlPreview`, above the `#tlTotal` timeline) does not play the original video. Playback only works after a suggestion from the AI JSON is played (the ▶ on a `#recList` row). It should be possible to play the source freely, with no suggestion, using `#tlPreviewPlay`, the scrub bar `#tlScrub` and the ±1/2/5 s buttons. index.html:519 promises this ("ALWAYS visible ... controls can be run directly from here, not only via the Play button in the AI suggestion row").

## Relevant code (all in `ui/js/editor/`)
- `result.js:314` `loadFullPreview()` sets `#tlPreviewVideo.src` from `chosenSource.url` without playing. It is only called from `timeline.js:51` `drawTotalTimeline()`.
- `result.js:480` the `#tlPreviewPlay` handler returns early when `!v.src`. The scrub (`:426`), the keys (`:452`) and the step buttons (`:516`) do the same.
- `result.js:348` `playRecPreview()` sets the src itself. That is why playback works once a suggestion has been played.
- `chosenSource` is set in `projects.js:1242` (`enterProject`), `assets.js:221` (`setActiveAsset`) and `assets.js:633`, and cleared in `projects.js:892/1210`, `assets.js:763`.

## Step 1: reproduce, find the root cause (no guessing)
Use the usual test copy on port 5178 with ZZTEST data, never ian's workspace or 5177. Open a project that has a video and **no** AI suggestions yet, go to Clips, press ▶ under the preview, then drag the scrub bar. In the console, check `#tlPreviewVideo.src`, `chosenSource`, and whether `loadFullPreview` ran. Likely causes, to confirm or rule out:
1. On this path `loadFullPreview()` never runs, or it runs before `chosenSource` is set, and `drawTotalTimeline()` is not called again after that. The src stays empty, so every control returns early.
2. The src is set, but something clears or pauses it (`closeRecPreview()`, `releaseVideo()` in player.js:309 which loops over `#tlPreviewVideo`, or a tab switch).
3. `previewLimit` was left over from an earlier suggestion and pauses playback straight away (`timeupdate` at `:396`).
Also check a multi-video project after switching the Video picker.

## Step 2: fix once, at the root
- Smallest fix: make sure the source is loaded wherever it is needed. One option is to call `loadFullPreview()` at the start of the `#tlPreviewPlay`, scrub and step handlers, before the `!v.src` guard. Fix it in that one place; don't add copies per path. If the root cause is (2) or (3), fix that instead.
- Playing a suggestion must keep working as before (stops at `endSec`, the row's ▶/⏸ icons).

## Verify
- On 5178: a project with no AI JSON → Clips → ▶ plays from 0, the scrub seeks, ±1/2/5 s work, and the clock moves.
- After pasting the AI JSON: the suggestion ▶ still plays only its own range, then pressing the bottom ▶ after the range has ended starts that range again.
- Multi-video: switch Video → the bottom ▶ plays the new video.
- `node tests/*.test.js` in the root still passes. If you add a test, keep it small and only where the logic gets a new branch.
- Commit only the touched files. Do not push; report back to the Plan session with the root cause and the diff.
