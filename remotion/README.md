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

## 3D objects, smooth cables, sound (P28-A4)

- **3D toon assets** (`src/three/`): the wall socket, the plug, the cable and the cutaway (the lens shows it, lab background) are real 3D
  models with the same toon look and top-left light as `Dissect3D`. A socket or lens item is 3D by default (`"model": "flat"` keeps the old
  2D drawing). Each 3D item is its own transparent canvas between the 2D layers; the chibi, the mascot, banners, labels, arrows, badges and
  backgrounds stay 2D. A label or arrow with `"follow": {"item": "<id>", "anchor": "contact"}` stays on that part as the object turns
  (the item needs an `id`). `Models3D` is the asset sheet to look at the models.
- **Cables** (`src/cable.ts`): a route is a polyline; every corner is rounded with a cubic curve and long horizontal stretches sag a little,
  so there are no sharp bends. The 2D cable and the `draw` animation use that path; the 3D cable is a tube along the same curve.
- **Sound effects** (`src/sfx.ts`, `sfx/`): the picture is rendered silent and `render.mjs` mixes the effects from the story and muxes
  them in as AAC (`"sound": false` for a silent MP4). Which sound plays on which motion word is the table `SFX_FOR` in `src/catalog.ts`;
  an item's `"sfx"` (a name of the closed list `SFX`, or `"none"`) overrides its entrance sound. The WAVs are synthesised by
  `npm run sfx` (see `sfx/LICENSES.md`), mixed by `sfx/mix.mjs` (a cooldown per sound, at most 3 at once, a -6 dBFS soft limiter, a `duck`
  for a future voice-over). Next to each video it writes `<name>.sfx.wav` and `<name>.sfx.txt` (the event -> sound timeline).

## Called by klipian (P28-B)

klipian (`klipian/motion.py`, the /remotion page) never copies a rule: it runs three Node scripts from this folder.

    node catalog-export.mjs      the catalogue as JSON: items and their fields (read off the zod schema by src/describe.ts), enums, limits,
                                 the sentences of STORY_RULES, the sound names and a valid example story (stories/example.json); it goes into the brief
    node validate.mjs story.json {"ok":true,...} or {"ok":false,"errors":[{"path":"beats.2.text","message":"..."}]}, from the schema in src/schema.ts
    node render.mjs job.json     "mode": "stills" (one picture per beat into the folder "out"), "still" or "video"; "outRoot": an absolute folder to write into

When the catalogue or a rule changes here (a new item type, a new enum word, a new check in `superRefine`), the brief follows by itself; a new
check should also get a sentence in `STORY_RULES` (src/catalog.ts). `npm test` covers the scripts (tests/scripts.test.ts).

## Layout, custom videos, voice (P28-P step 1)

- `src/layout.ts`: the layout manager (zones, boxes from real font metrics, the shortest way to a free place, wrap/shrink, arrow tails; `layoutDebug` overlay). FunFact applies it to every beat.
- `DESIGN.md`: the guide every video session reads first (design system, rules, quality bar, how to add an asset, how to start a video).
- `videos/<slug>/` (+ `npm run new-video <slug> [story.json]`, `templates/video/`): a custom composition `video-<slug>` made from `src/design/index.ts`, reading the checked story;
  `render.mjs` takes `"composition"` (and `"props"`), a custom video's sound comes from its `sfx.ts`. `npm run assets-sheet` renders `out/assets-sheet.png`; `CardsDemo` and `RigDemo` show the cards and the camera rig.
- Voice: a job field `"voice"` (48 kHz WAV) is mixed on top; the story's `music` bed and the effects duck under it (`sfx/mix.mjs mixTrack`); klipian (`klipian/motion_voice.py`) aligns the narration and writes `story.voiced.json`.
