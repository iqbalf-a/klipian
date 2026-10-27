# Spike round 2: make the Three.js orthographic scene match the SVG tones, then measure (plan for klipian eksekusi, approved by ian)

Written by klipian motion (planning only). Round 1 (`f3f59f0`, `PLAN-SPIKE-THREE-ORTHO.md`) proved two things: the orthographic camera lands on the **same pixels** as `isoAt` (error 0.0000 px) and the **depth buffer removes the occlusion bugs** (no metal outside the hole at any gap). It did not match the **look** (darker, greyer, plug near black, no yellow outline, no background, wrong camera framing at 40.6 s), and the effort and render-time numbers were not like for like. This round fixes the look with the one idea eksekusi suggested and then measures the comparison properly. Same limits: one round, new files only, no change to any existing video or to the SVG kit.

## Why the look is wrong (from the code of round 1)
- Each part is a `meshToonMaterial` with **one colour for the whole part** (for example the whole plug body is `ISO.dark[1]`), lit by an ambient light (0.55) plus a directional light (0.85). The three.js toon shader multiplies the colour by the light, so every tone gets darker and greyer, and a part has the same tone on all its faces.
- The SVG kit does something different: the tone of a **face** is chosen by the direction it faces, with the fixed colours of `ISO` (up = light, +y = mid, +x = dark; `toneOf(n)` in `src/iso.ts`, `LIGHT = [0.25, 0.55, 1]`). Colours are never multiplied by a light.
- The demo uses a flat background colour, a guessed `U` and origin `O`, and no heat glow, scorch, earth clips, ribs, boot grooves or plate outline.

## A. A tone-by-normal material (`src/three/isoTone.ts`, new)
1. A custom material (a small `ShaderMaterial`, or `MeshBasicMaterial` with `onBeforeCompile`) that outputs `ISO[kind][tone]` where `tone` is computed **per fragment from the world-space face normal** with the same thresholds as `toneOf` (convert the normal from three's axes back to the 2.5D axes: `(x, y, z)` three = `(x, z, y)` 2.5D). **No lighting, no ambient, no shadows, no gradients**: exactly three flat colours per material, as in the SVG kit. A curved surface (the plug body, the boot) then shows hard tone bands, like the SVG `cylinder()` facets. Use `flatShading` or enough segments so the bands look like the SVG ones (compare at 3x).
2. Materials by kind: `plastic`, `wall`, `floor`, `dark`, `metal`, `brass` and `labPlastic`: a prop `kind` on the material picks the `ISO` triple.
3. **Pure-function test** (`tests/isoThree.test.ts`): the tone function used by the shader (write it in plain TypeScript, and keep the GLSL as the same constants) equals `toneOf` for the six axis normals and for 200 random normals. Also test that every colour that the material can output is in `ISO`.
4. Leave the old `Toon` in place only if something still needs it; otherwise remove it from the demo.

## B. Bring the demo to the SVG framing and look
1. Use the colokan video's own `OUT.u` and `OUT.o` (and its camera at each frame) instead of the guessed `U = 150`, `O = [540, 900]`, so the 3D and the SVG framing are the same. Add a test that the 3D camera lands the plate centre `SOCKET_PTS.center` on the same pixel as `outPt` of the video at 0.5, 35.2, 40.6 and 42.2 s (within 1 px).
2. Background: put the real `Brand` (the ring wall and the yellow spot) in SVG **behind** a transparent 3D canvas, as the hybrid is meant to work, with the same `spot` as the video. The 3D layer is `alpha: true`.
3. Missing parts, drawn as real geometry so the depth buffer orders them: earth clips (bent tabs on the recess wall), plug ribs (thin boxes on the grip), strain-relief grooves, the cable collar, **the yellow plate outline** (a thin flat ribbon on the plate front, in `YELLOW`, with the same sweep and flash as `PlateHighlight`), the heat glow (flat transparent rings on the plate plane in front of the plate and behind the plug), and the scorch tint (colour change of the plate, as `scorch`).
4. Use the plan's states for all of them (`st.gap`, `st.heat`/`outHeat`, `st.scorch`, `st.fresh`, `st.wobble`), do not copy numbers.
5. Fix the demo's caption box overflow (use the SVG `CaptionLayer` of the video instead of the hand-made rectangle) and keep the one number label over the 3D.

## C. Measure the comparison properly (the evidence)
Render the same frames from the SVG video and from the 3D demo and compare:
- **Colour error**: at 0.5, 35.2, 40.6, 42.2 s. Build a mask of the object area (the pixels where the SVG frame is not the background, excluding text, labels and captions), then report the **mean absolute RGB error** over the mask and the **share of pixels with an error above 16 (of 255)**. Also the three-tone **histogram**: how many of the object's pixels are within 6 of each `ISO` colour in each picture. Target for "matches": mean error at most 8 and the share above 16 at most 10%; report the real numbers even if they miss.
- **Edges**: crop 3x of an edge (the plug's rim, the boot, the plate corner) in both: does the 3D edge look as crisp as the SVG one? State the `antialias` setting; if the edges are worse, say how much (and try rendering at 2x and downscaling once).
- **Contact sheet**: SVG | 3D side by side at 0.5, 35.2, 40.6, 42.2 s plus the gap strip (0.05, 0.2, 0.75, 1.6 out and 0.1, 0.4 in). Ian judges the picture, so make it easy to read.
- **Render time, like for like**: the same 6 s window (33.5 to 39.5 s), video only, no sound, same `concurrency`, same machine state: the SVG colokan composition (use `render.mjs` with a frame range or a one-off job; if it has no range, say how you did it) and the 3D demo. Report seconds per frame and the projected seconds for 1350 frames, plus the CPU load before the run.
- **Effort**: lines of code for the same set of parts in SVG (`IsoWallSocket` + `IsoPlug` + `PlateHighlight` + `CableLine`) and in 3D (all new files), and a plain list of what needed hand ordering in each.
- **Layout fit**: run the layout manager's `conflicts()` over the 3D demo's boxes for a few frames (the projection test says the boxes are the same); say if anything breaks.
- **Cutaway**: one paragraph only (clipping plane, the hatch and the lens circle), no build.

## D. Rules for this round
- Only new files under `remotion/` (`src/three/isoTone.ts`, changes inside `src/three/IsoSocket3D.tsx`, `IsoPlug3D.tsx`, `src/IsoThreeDemo.tsx`, `tests/isoThree.test.ts`, a script for the comparison under `scripts/` if needed). No change to `Iso.tsx`, `iso.ts`, `cableSim.ts` or the colokan files. No Python/UI/server/workspace/secrets, no downloads, shapes in code only.
- `npm run check && npm test` green; check the CPU load before each render; commit locally; do NOT push.
- Time box: one round. A finding that something cannot match is a result: say so and stop.
- Standing rule: list the rules this suggests for `DESIGN.md` (for example "a 3D layer takes its tones by face normal from `ISO`, never from lighting", "a 3D layer is judged by a contact sheet and numbers against the SVG frames"). Write the "3D layer in 2.5D" section in `DESIGN.md` **only if the result is positive**.

## The report must end with a recommendation, with the numbers
One of: (a) use Three.js orthographic for object scenes in pilots 2 and 3 (text and labels stay SVG); (b) use it only for scenes with many overlapping parts (the charger, a machine) and keep SVG for the rest; (c) stay with SVG. Give the deciding numbers: the colour error, the render time ratio, the line counts and the list of hand-ordered things. Ian decides.

## For ian
Nothing to decide for this round. After it, ian looks at the contact sheet and the numbers and chooses for pilot 3 (charger). Pilot 2 (rain) can start with the SVG kit meanwhile if ian wishes.
