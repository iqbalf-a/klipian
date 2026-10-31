# remotion/

The video engine of klipian's **Motion** page (`/remotion`). A video here is made from one JSON story, and rendered with Remotion into a 1080x1920, 30 fps MP4 with sound effects and a music bed. Two kinds:

- **Khusus** (the main flow): a video made for its story in a Claude Code session: `videos/<slug>/` holds the composition (`index.tsx`, `plan.ts`, `sfx.ts`, `meta.json`, `story.json`).
- **Otomatis** (older): the fixed template `src/FunFact.tsx`, filled from the story.

klipian (`klipian/motion.py`) never copies a rule from here: it runs the Node scripts below and reads their answers.

## Commands

    npm install                      once (about 800 MB, with the Chrome Headless Shell Remotion downloads on the first render)
    npm run check                    tsc --noEmit
    npm test                         every node test (the story schema, the layout, the style rules, the videos)
    node validate.mjs story.json     {"ok":true,...} or {"ok":false,"errors":[...]}: the story against src/schema.ts
    node catalog-export.mjs          the catalogue (items, enums, limits, examples) as JSON: it goes into the brief
    node render.mjs job.json         a job: {"mode":"still"|"stills"|"video","story":"stories/x.json","out":"name.mp4","composition":"video-<slug>"}
    npm run new-video <slug> [story.json]   a new video folder from templates/video/ (and the library checklist)
    npm run style-check -- <slug>    the musts and the motion language of a video (a FAIL stops it)
    npm run style-report -- <slug>   stills, the loop check, the variety and the safe-area flags in out/<slug>/style-report.md
    npm run safe-check -- <slug>     what falls inside the YouTube, TikTok and Instagram covered bands (a flag, never a failure)
    npm run calibration              renders out/safe/calibration.mp4 (a grid to play in each app and screenshot)
    npm run assets-sheet             out/assets-sheet.png: the asset library on one sheet
    npm run sfx                      synthesises the sound effects and the music beds (sfx/LICENSES.md)
    npm run clean-cache              keeps the newest render bundle in .cache/ and removes the rest (a render keeps the newest two by itself)
    npm run studio                   Remotion Studio, to look at the motion frame by frame

`render.mjs` prints JSON lines (`progress`, `timing`, `done`, `error`), writes into `out/` (or an `outRoot`), caches the bundle in `.cache/`, and stops on SIGINT or a line `cancel` on stdin.

## Where things are

| what | where |
| --- | --- |
| the rules (style bible, the musts, the rule log B1 to the latest, safe areas, caption looks) | **`DESIGN.md`**: the one source; read it before drawing anything |
| the story schema and its rules | `src/schema.ts` (zod), `src/catalog.ts` (the closed lists, the rule sentences) |
| the layout manager, the safe area, the caption looks | `src/layout.ts`, `src/tokens.ts` (`SAFE`, `SAFE_PLATFORMS`, `CAPTION_VARIANTS`) |
| the isometric kit, the dictionary of marks, the stage shapes, the themes | `src/iso.ts`, `src/components/Iso*.tsx`, `src/dictionary.ts`, `src/stageShapes.ts`, `src/tokens.ts` |
| motion and time | `src/motion.ts`, `src/motionLanguage.ts`, `src/timeline.ts` |
| sound | `sfx/` (the effects and the music beds; the approved effects are locked, rule B15) |
| the stories and the example stories | `stories/` (`example.json` and `example-habit.json` are the examples of the brief) |
| the videos made so far | `videos/<slug>/` |
| the history of the finished plans | `docs/PLANS.md` (read a plan with `git show <commit>:remotion/<file>`) |
| big decisions | `docs/roadmap.md` at the repository root (P28) |

## Rules for work here

Commit locally, never push; never write to `workspace/`; no API key and no call to a voice or other service; do not re-render a video the person has already rendered unless asked.
