# Pilot 1 "Kenapa colokan bisa panas?": plan round 5 for klipian eksekusi (approved by ian)

Written by klipian motion (planning only). Round 4 (6288bc0) fixed the socket recess and the yellow circles. What is left from ian's three revisions: **the cable still looks wrong**, plus **one label problem** on the new highlight. Everything else stays as it is.

## Diagnosis

### 1. The cable hooks up and loops: gravity is on the wrong axis (root cause, `src/cableSim.ts`)
In this scene's world, **z is up**, the wall face is the plane y = 0.3 (the plate front), the plug sticks out along **+y** (toward the viewer, lower left), and the floor (the shelf) is at z = -2.05. In `simulateCable`:
- "gravity" is `pos[i][1] - SINK`, i.e. it pulls the free nodes along **-y, toward the wall**, not down (-z);
- the "ground" is `ground(x, z)`, a function that returns a **y** (the wall/plate front), and the floor test is `if (y < ground(x,z) + RADIUS) y = ...`.
So the cable is being pressed flat **against the wall face** and slides around on it. It is never pulled down to the floor. That is why it climbs over the plug in a hook and a small loop in the hook shot (0.5 s), curls up above the plug at 34.8–36.8 s and "rests on the plate" at 40.6 s. The chain length, bend limit and follow-the-plug logic are fine; the physics frame is wrong. The contact shadows in `CableLine` (`p[1] < 0.36`) test "close to the wall", not "close to the floor", for the same reason.
This also explains the gaps eksekusi listed: the 90 degree bend at the stub, the length error up to 30%, the straight run of 36%.

### 2. The highlight label (`plan.ts` line about `replaceWord`)
- It is numbered **1**, but it sits on tip **2** (the card above says 2).
- Its words ("teknisi ganti stop kontak") repeat the card's own line right above it.

## A. Fix the cable physics (`src/cableSim.ts`, `plan.ts`, `Iso.tsx` `CableLine`)
1. **Gravity down = -z.** Apply the sink to the z component of the free nodes, not y.
2. **The floor is a height in z**: the shelf/floor top is at z = -2.05 (use the same constant as the floor block in `IsoWallSocket`; the floor extends beyond the shelf: the cable may lie past its edge and leave the frame, no invisible wall). `ground` becomes `floorZ(x, y)` (a z), constant -2.05.
3. **The wall is an obstacle, not the ground**: the cable must not enter y < 0.3 where the wall/plate is (push nodes out to y >= 0.3 + RADIUS inside the wall's footprint x in [-2.1, 2.1], z in [-2.05, 2.3]). Keep the plug body as an obstacle (a cylinder around the plug's axis, which runs along **y**: radius 0.95, from y = 0.3 + gap to y = 1.9 + gap, centre x, z = 0.5), and fix its test accordingly (the current code tests `y` against `y0..y1` and pushes in x/z: that part is already right for an axis along y; keep it).
4. **The start shape** (warm-up) should not be a sine wave above the plug: start hanging: out along the axis for the stub, then straight down. The warm-up (3 s) then settles it.
5. Keep: fixed length (5.6), 24 nodes, deterministic, loop blend. Set `FIRST_BEND` so the first free link may turn **down** from the axis (up to 120 degrees, with a small minimum bend radius); the "never hangs back down" rule was written for the wrong gravity and must go: a cable leaving the strain relief **should** droop down.
6. **Expected look** (acceptance, to be checked with frames):
   - plug in the socket (hook, 0–3 s): the cable leaves the strain relief toward the viewer for about its stub length, then falls in a smooth curve to the floor, then lies on the floor and runs off toward the lower left of the frame (or along the floor to the right), never above the plug's top edge on screen;
   - plug pulled out (about 34.5–40.5 s): the plug moves toward the viewer, the cable gets pulled, swings, then the slack falls to the floor and lies in a soft S-curve; no hook, no loop over the plug;
   - plug wobbles (tip 2): the cable sways a little;
   - lab shots do not draw this cable.
7. `CableLine` contact shadow: draw the soft shadow ellipse where a node is within about 0.12 of the floor (z close to -2.05), under the node, not where it is near the wall.
8. Clean up `plugScreen` / `SOCKET_PTS` / `CABLE_TO` leftovers that only the old cable used, but keep `cableTo` working for the other users (AssetSheetIso, IsoDemo).

## B. The highlight label (`plan.ts`, `Overlays.tsx` if needed)
- No number disc on this label (it is not a step): use the label style without `n`, or use the tip's own number (2) only if the style needs one.
- Do not repeat the card's words: use a **short tag of at most 2 words taken from the story** that is not the card's line, e.g. "stop kontak" or "diganti" (pick from the story's own texts with `fromStory`; if none fits, no label). Keep the leader line to the plate outline.
- It must not touch the cable, the plug or the tip card (layout test).

## C. Tests
- Cable (`tests/cableSim.test.ts`): after the settle, the mean z of the free nodes is lower than the anchor's z; with the plug in, the lowest node is within 0.1 of the floor (z = -2.05 + RADIUS); no node has y < 0.3 inside the wall footprint; no node is inside the plug body; the chain length is constant within **1%** (the plan asks for it; round 4 got 30%); no straight run longer than 35% of the length; the sharpest turn is under MAX_BEND; the plug moving (pull out and back in) gives a continuous cable (the largest node jump per frame under a limit); the highest point of the cable on screen is not above the plug's top at any frame where the plug is in the socket.
- Colokan: the label has no number or uses 2; its text is from the story and is not equal to the card's line; the layout checker has no conflict with the cable's screen box at the tips frames.
- Loop: the first and last frames still match.

## D. Docs (`remotion/DESIGN.md`)
- Section 5 (cables): "gravity is the world's down axis (-z in 2.5D); the floor is a height in that axis; the wall is an obstacle"; a short "how to check a cable": it must never be higher than where it leaves the plug unless the plug is pulled.
- Highlights section: "a label on a highlight is not a numbered step; it must not repeat the text beside it".

## E. Verify before reporting
- `npm run check && npm test`.
- Frames (`node scripts/frames.mjs video-kenapa-colokan-panas out/colokan/r5 <seconds...>`): 0, 1, 2, 3 s; 20 s; 33.5, 34.5, 35.2, 36, 37, 38, 40.6 s; 43, 44.5, 44.95 s. Plus a 3x crop of the cable at 0.5 s, 35.2 s and 40.6 s.
- **A short clip of the pull-out and the plug going back in** (round 4 skipped it): extract frames every 3 frames from 34.5 to 41 s into one contact sheet and look at the cable; no jitter, no hook, no loop, no straight pipe.
- Loop numbers (first vs last frame) must stay as in round 4. Render time and the count of sound events in the report.
- Commit only your own paths locally. Do NOT push.

## For ian
Nothing to decide. This round only fixes the cable (it was drawn against the wall instead of hanging down) and the label (wrong number, repeated words).
