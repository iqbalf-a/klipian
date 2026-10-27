# Spike: 2.5D with Three.js (orthographic camera, toon material), plan for klipian eksekusi (approved by ian)

Written by klipian motion (planning only). Ian's question: could Three.js make the same 2.5D look, and would it be easier for an AI agent to build and keep correct than hand-drawn SVG? Ian does **not** want to replace the SVG kit now ("only looking for the option where the Claude agent works more easily"). This is a **small, time-boxed experiment** that produces evidence. It changes no existing video.

## Why the question matters (from pilot 1)
In SVG every depth order is decided by hand (draw order, clip paths): rounds 3 to 6 were mostly occlusion and geometry bugs (circle in front of the plug, pin outside the hole, cable stuck on the wall, joint with a visible cap). A depth buffer solves that class of bug by construction. The open questions are the **look** (does 3 flat tones match the approved 2.5D picture?), the **cost** (render time, headless GL) and the **effort** (is it really less work and less checking?).

## What already exists (reuse, do not rewrite)
- `@remotion/three` and `three` 0.186 (`ThreeCanvas`, `src/three/common.tsx` `Host3D`, `src/Dissect3D.tsx`), `render.mjs` already passes `gl: "angle"` (works headless here).
- `src/three/Socket3D.tsx`, `Outlet3D.tsx` (the old semi-realistic socket, plug and cutaway, **perspective** camera), `rigMath.ts` (camera rig), `project.ts` (`projectView`, a perspective projection for labels).
- The 2.5D side: `src/iso.ts` (the exact iso projection `iso()`, `VIEW = [1,1,1]`, the tone rule, `LIGHT = [0.25, 0.55, 1]`), `ISO` tones in `src/tokens.ts`, `src/cableSim.ts` (the cable chain), `PlateHighlight`, the colokan `plan.ts` states (`gap`, `wobble`, `heat`, `scorch`, `fresh`).

## The experiment (one scene, 4 to 6 seconds)
Build the same scene as the colokan hook and tips in Three.js, as a **new** composition `IsoThreeDemo` (register it in `src/Root.tsx` like `IsoDemo`; allow it in `render.mjs`), in new files only: `src/three/IsoSocket3D.tsx`, `src/three/IsoPlug3D.tsx`, `src/three/isoCamera.ts`, `src/IsoThreeDemo.tsx`, `tests/isoThree.test.ts`.

1. **Camera**: `OrthographicCamera` (no perspective), looking along (1,1,1) in the 2.5D world (x lower right, y lower left, z up). Three's up axis is y, so map the 2.5D world `(x, y, z)` to three `(x, z, y)` carefully (and say which way you mapped it in a comment). The scale is `u` pixels per world unit, so one unit on screen is the same as in the SVG kit. **Test**: for 10 sample world points, the orthographic camera's projected pixel equals `isoAt(p, u, o)` within 1 px. This is what lets the existing labels and overlays (`NumberLabel`, captions, the layout manager) work on top unchanged.
2. **Look**: three flat tones per object by face direction, the same rule and the same colours as the SVG kit. Use `MeshToonMaterial` with a 3-step `gradientMap` (or a small custom shader) lit by one directional light along `LIGHT`, colours from `ISO` (plastic, wall, floor, dark, metal). No outlines, no shadows, no gradients; `antialias` on; render at the video size. If a three-step toon cannot match the SVG tones, say so and show the best result.
3. **Objects** (reuse the existing 2.5D dimensions so the picture matches): the wall chunk on the floor, the plate with its round recess (a real hole in the plate, the recess wall as a real cylinder, the floor, two pin holes, two earth clips), the round plug (collar, grip with ribs, back cap, strain relief boot), the **two pins as real geometry** going into the holes, and the **cable as a tube along the existing chain** (`simulateCable` nodes, `TubeGeometry` or a Catmull-Rom path), plus the plate outline highlight as a thin real outline on the plate.
4. **Motion**: the plug pulled out (gap 0 to 1.6) and back in, a small wobble, heat glow on the collar (an emissive tint), the camera of the hook (wide to close) and of the tips. Use the same timing as the colokan `plan.ts` states (import them; do not copy).
5. **Overlay**: put one SVG label and a caption box over the 3D layer (as `Host3D` does) to prove the SVG/3D hybrid works with the layout manager.

## What to measure and report (the evidence)
| What | How |
| --- | --- |
| **Look match** | the same frames side by side with the SVG video (0.5 s, 35.2 s, 40.6 s, 42.2 s equivalents): the three tones, the shapes, the heat glow. Ian will judge the picture, so make a contact sheet. Also report the mean colour error of the three tone areas against the `ISO` colours. |
| **Occlusion bugs** | a strip of the plug at gap 0, 0.05, 0.1, 0.2, 0.4, 0.75, 1.6 and the contact sheet of the plug going in: is any metal outside the hole? any cable through the wall? (By construction there should be none; confirm.) |
| **Render time** | seconds for the demo, and the projected time for 1350 frames (45 s), against the SVG baseline of about 100 to 180 s. State the CPU load and whether `gl: "angle"` worked headless. |
| **Effort** | the number of lines for the same objects (SVG kit vs Three), and a plain list of what needed manual ordering in each. |
| **Hybrid fit** | did the 3D layer plus SVG labels line up (the projection test), did the layout test still work, and any trouble with transparency or antialiasing at the edges. |
| **Cutaway / lens** | one line on whether a section (clipping plane) and the lens circle are feasible in this setup; do not build them. |

## Rules for the spike
- Time box: one round. If something does not work after a fair try (for example the 3-step toon cannot match), report that as a finding and stop; do not extend the scope.
- Do **not** change any existing video, `Iso.tsx`, `iso.ts`, `cableSim.ts` or the colokan files. Only new files, plus registering `IsoThreeDemo` in `Root.tsx` and allowing it in `render.mjs`.
- Only your own paths under `remotion/`; no Python/UI/server/workspace/secrets; no downloads, no external model files (build the shapes in code).
- `npm run check && npm test` green; check CPU load before rendering; commit locally; do NOT push.
- The standing rule: list any new rule the spike suggests for `DESIGN.md` (for example "when to use the 3D layer"). Write a short section "3D layer in 2.5D (experiment)" only if the spike is positive; otherwise write the findings in the report only.

## The report must end with a recommendation
One of: (a) Three.js orthographic is better for object scenes: use it in pilots 2 and 3 (with the hybrid for text), (b) use it only for scenes with many overlapping parts (a machine, a charger), keep SVG elsewhere, (c) stay with SVG; with the reasons from the table above. Ian decides.

## For ian
Nothing to decide for the spike itself. After it, ian looks at the contact sheet and reads the table, then decides for pilots 2 (rain) and 3 (charger).
