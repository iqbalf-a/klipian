# Pilot 2, phase 1b: polish the nature kit before the video (plan for klipian eksekusi, approved by ian)

Written by klipian motion (planning only). Phase 1 is committed (318f16d): the structure is right (tests, depth order, periodic motion, depth-order table, sounds), but the look is below the approved reference `workspace/channel-art/klipian-intip/hujan-25d.png` (read only). This round fixes the four visible gaps, then stops again for ian's look. **Phase 2 (the video) does not start in this round.**

## What is wrong (from `out/nature/contact-vs-ref.png` and `out/nature/sheet.png`)
1. **The cloud** (`cloudPuffs` in `src/natureGeometry.ts`): five round puffs with nearly equal radii (0.45 to 0.72), clumped around one centre, so it reads as a small cluster of balls. The reference cloud is **wide** (about 2 : 1), has a **flat, slightly curved underside**, 6 to 8 puffs of clearly different sizes, a dark underside layer, a mid body and light bumps toward the upper left. Also the cloud is small next to the sea (the reference cloud is about 70% of the sea's width on screen). The white cloud's tones are almost the same as the white tile it sits on, so it hardly shows.
2. **The trees** (`IsoLand`, the `tree()` helper): narrow, dark cones placed at the land's edge, overlapping, with a small notch where the two halves meet. The reference trees are lighter greens, wider cones with a lighter left half and a darker right half, and sit inside the land's top face.
3. **The runoff** (`IsoRunoff`): drawn after the trees (`DEPTH_ORDER` has "trees" before "runoff"), so the stream crosses the tree bases. It should run beside the trees, under them if they touch, and end at the sea.
4. **The asset sheet** (`NatureSheet.tsx`): the land tile is cut off at the bottom and overlaps its label; the clouds sit in a corner, not centred; the tile positions are hand-guessed (`o = [cx, cy + 70]`) instead of fitted.
5. Minor: the sun's rays are plain equal lines (the reference alternates long and short and they are slightly thicker).

## A. The cloud (`src/natureGeometry.ts`, `IsoCloud` in `IsoNature.tsx`)
- New `cloudPuffs`: 7 puffs with at least **three distinct radii** (for example 0.9, 0.7, 0.6, 0.5, 0.45 in the cloud's own unit), laid out in a **wide row**: a big puff in the middle, medium ones on both sides, small ones on the upper left and the far right, and **two or three flat "belly" ellipses** along the bottom so the underside is flatter than the top. Total width about twice the height.
- Tones by the tone rule, as the reference: a dark underside layer (tone 2) slightly offset down-right, the mid body (tone 1), the light bumps (tone 0) up and to the left. The white and the grey cloud use `cloudWhite` and `cloudGrey`; `dark` 0..1 blends between them as now. Make the white cloud's mid/dark tones a touch stronger so it reads on a pale background.
- Scale: the cloud's on-screen width about **60 to 85% of the sea block's** width at the demo's scale (the reference: about 380 px of 560 px).
- Keep: `grow`, the slow periodic breathing, the rain starting behind the cloud's lower edge (the rain's start height follows the new, flatter underside: use the lowest belly edge as `CLOUD_BOTTOM`), the droplets near the underside.
- Two clouds in the demo, as the reference: the white one first, the grey rain cloud after it.

## B. The trees (`IsoLand`)
- A cone is **one silhouette**, split down its axis by the light: the left half mid tone, the right half dark tone, a small light highlight near the apex; no seam notch (one shared apex and one shared base edge; test that the two halves share the same vertices on the axis). A short brown trunk.
- Lighter greens: the leaf tones should match the reference's grass/leaf (about (152,190,120) top family for the grass, the trees a little darker but clearly green, not near-black). Update `ISO.leaf` if needed.
- 4 trees, different heights (0.9 to 1.3) and widths, **inside the land's top face with a margin of at least 0.25 from every edge**, not overlapping each other's footprint, drawn **back to front** (sort by depth: the one with the smaller x + y first).

## C. The runoff (`IsoRunoff`, `DEPTH_ORDER`)
- Order: land top, **runoff**, **trees**, so the trees cover the stream where they touch. Move "runoff" before "trees" in `DEPTH_ORDER` and in the file header, and update the depth test.
- Path: beside the trees (at least 0.3 from every tree's footprint centre), from the back of the land toward the edge nearest the sea, then over the land's edge as a short thin fall into the sea's top face, with a small splash ring there. Clipped to the land top while on it; the part on the sea is clipped to the sea's top face. Wet state: the land darkens a little as now.

## D. The sun
Alternate long and short rays, slightly thicker with round caps, a slow periodic pulse of the length; keep the light disc with the darker crescent.

## E. The asset sheet (`NatureSheet.tsx`)
- Fit each tile **by its bounding box**: compute the asset's screen bounding box from its geometry (a pure function, tested), scale it to fit in about 80% of the tile's drawing area, centre it, and keep the **bottom 70 px for the label**; nothing may overlap the label.
- Tile background: the wall colour with a faint pale-yellow circle (the Brand spot) so the white cloud reads; both clouds side by side in one wide tile ("cloud: white and grey").
- Add tiles: trees (alone), droplets, splash rings, runoff on the land, and the whole scene.
- Test: for every tile, the bounding box is inside the tile, centred within 8 px, and does not touch the label area.

## F. Tests (`tests/nature.test.ts`)
Keep the 39 existing checks and add: the cloud has at least three distinct radii and a flat underside (the lowest puffs' bottoms within 0.15 of each other), its width/height ratio between 1.8 and 2.6, and its on-screen width is 60 to 85% of the sea's; every tree footprint is inside the land top with margin 0.25 and the footprints do not overlap; the tree halves share their axis vertices (no notch); the runoff path stays at least 0.3 from every tree footprint and starts on the land and ends on the sea's top face; `DEPTH_ORDER` has runoff before trees; the sheet tile checks above; the sun has long and short rays.

## G. Verify and report (then STOP)
- `npm run check && npm test`.
- A **contact sheet: `hujan-25d.png` | the kit** at the same scale and framing: the sea, the land with trees, the sun, the white cloud and the grey cloud raining, so ian can compare directly (the reference's labels and caption are not needed). Give the exact times of the demo you used.
- Strips of the in-between states: cloud `dark` 0, 0.25, 0.5, 0.75, 1; the rain start; the runoff reaching the sea; splash. 3x crops at the cloud's lower edge, the tree/land edge and where the runoff meets the sea. The new sheet.
- Add the new rules to `DESIGN.md` ("Nature kit"): natural shapes need **variety** (no repeated equal circles: at least three sizes, a flatter base than top); object sizes follow the reference's **ratios** and are compared with the reference side by side before they are reported; sheet tiles are **fitted by bounding box** and never overlap their label; a stream or any path **passes beside or under** things that stand in its way, never over them.
- Limits as before: only your own paths under `remotion/`, no Python/UI/server/workspace/secrets, nothing downloaded, sounds unchanged, commit locally, do NOT push, check CPU before rendering. Do not start phase 2.

## For ian
After this round, look at the contact sheet next to the reference. Phase 2 starts when you say so and the story "Kenapa hujan turun?" exists in `/remotion`.
