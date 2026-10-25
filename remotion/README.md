# remotion/ — P28-A spike

A JSON storyboard goes in, a silent 1080x1920 30 fps MP4 comes out (smooth motion: springs and easing, continuous time), through ONE fixed template (`src/FunFact.tsx`). The AI
never writes render code: it only fills the story JSON (`stories/colokan-panas.json`, checked by `src/schema.ts`).

    npm install              # once (about 800 MB with the Chrome Headless Shell Remotion downloads on first render)
    npm run check            # tsc --noEmit
    npm test                 # the story schema (node runs the .ts file)
    node render.mjs job.json # job: {"mode":"still"|"video","story":"stories/x.json","out":"name.mp4","beat":"lensa"|"frame":120,"concurrency":4}
    node render.mjs job.json # also: "composition": "Dissect3D" (the 3D charger test, no story) with "gl": "angle"
    npm run studio           # Remotion Studio, to look at the motion frame by frame

`render.mjs` prints JSON lines (`progress`, `timing`, `done`, `error`), caches the bundle in `.cache/` by a hash of `src/`,
writes into `out/`, and stops on SIGINT/SIGTERM or a line `cancel` on stdin. Components and colours: `src/components/`,
`src/tokens.ts` (ported from `workspace/channel-art/klipian-intip/`). Motion: `src/motion.ts` (continuous 30 fps, springs and easing) and `src/timeline.ts`.
