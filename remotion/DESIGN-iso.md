# DESIGN-iso.md: the 2.5D iso look (B28 look iso). Read with DESIGN.md for an iso video only.

## 2.5D isometrik (the main style, ian 2026-10-26)

Every topic is drawn as **2.5D isometric SVG**: no 3D engine, the same tone rule everywhere, quick to render. Reference mock: `workspace/channel-art/klipian-intip/hujan-25d.png`.
Look at `out/assets-sheet-iso.png` (`npm run assets-sheet`) and the `IsoDemo` composition first; the pilot `videos/kenapa-colokan-panas/` uses all of it.

- **Axes** (`src/iso.ts`): x runs to the screen's lower right, y to its lower left, z up; `u` px per world unit, `o` = the screen px of the world origin. `iso(p, u)` / `isoAt(p, u, o)` give a screen point.
- **The tone rule**: three tones per material, light from the top-left: a face looking **up = light**, looking **lower-left (+y) = mid**, looking **lower-right (+x) = dark**. A face is seen when it looks towards (1, 1, 1).
  The tone sets are `ISO` in `tokens.ts` (`plastic, wall, floor, dark, metal, brass, labPlastic`; nature topics may add blue water, green plants, brown soil, three tones each). Never pick a tone by hand.
- **A block**: `<IsoBlock a={[x0,y0,z0]} b={[x1,y1,z1]} u o tones={ISO.wall} />` (right, left, top faces, back to front). Draw back to front: lower z first, then larger x, then larger y.
- **Anything flat on a face** (a socket plate, a recess, a cut face's content): draw it in that plane's own 2D coordinates inside `<OnPlane y={y0} u o>` (the plane y = y0, coordinates (x, z), z up; `planeYZ` for an x-face). Keep text out of planes (it comes out flipped).
- **An extruded outline**: `extrudeXZ(outline, y0, y1, u, o)` for a convex outline (`roundRectPts`, `circlePts`), `extrudeAnyXZ` for thin bent shapes (a spring leaf); draw with `<Polys polys tones />`.
- **A round thing**: `cylinder(a, b, ra, rb, e1, e2, u, o)` (a plug, a pin, a cable end, a screw): tone bands along the body, then the cap that faces you.
- **A hole or recess** (round 4, rule 3): the recess is **shallow** (its floor sits within about a third of the radius of the plate, so every hole and clip inside it is visible at the video's camera angle); its inner wall is a ring of faces **graded by the tone rule** (each face takes the tone of the way it looks, the far side of the hole is the one seen); the holes are darker than the floor with a **lighter rim**; the floor is one tone darker than the plate. `IsoWallSocket` is the model.
- **A cutaway**: cut along a vertical plane (y = 0, facing lower-left), hatch the cut faces (`<Hatch>` pattern over the block's mid face), cut the part above the cavity further back (a stepped cut) so what is inside is seen from above; the current runs as dashed paths on the cut plane (`smoothPath` + an animated `strokeDashoffset`), heat as a radial glow at the contact. See `IsoCutaway` (`loose` 0..1, `heat`, `current`).
- **The 2D camera and parallax**: `cam2At(keys, t)` (keys `{ t, x, y, zoom }`, eased, zoom in log space) and `<g transform={layerTransform(cam, p)}>` per layer: `p = 1` the scene, `p ≈ 0.3` the background (it moves and grows less), `p > 1` a near layer (dust: `Motes`). `toScreen(cam, pt, p)` is where a world px point is now (labels follow parts with it).
- **Through the lens**: the lab world is a second scene with its own camera, drawn clipped to a circle that grows from the part (the magnifier) until it covers the frame; on the way out the circle shrinks back to the part while the outside camera pulls back. Anchor the lab camera so the inside detail stays in the circle's middle.
- **Particles and motion lines**: `HeatRise`, `SmokePuffs` (three greys), `Sparks`, `Motes`, the current's dashes. Labels: `NumberLabel` (number disc, white pill, leader line, `red` for heat, `ring` to circle the point).
- 3D (section 4) is **optional**, for one hero shot where an object must turn or come apart; not the default.

### Depth order, holes and joints (round 6, section E of the plan)

**Standing rule (ian, 2026-10-28): every revision of a motion video adds its rule here.** Each round's report lists the rules it added, or says why none applies.

- **0. Depth order (occlusion).** An object that is behind another object, or behind a surface (a pin in a hole, a cable behind the plate or the caption box, a part inside a body, a thing behind the wall), is hidden by it: draw it before the nearer object, or clip it to the opening it is seen through. Never draw a hidden part over the thing that hides it. For every pair of objects that touch or overlap, write down which one is in front, and check it in the transition frames, not only in the resting pose.
- **1. A part that goes into a hole is drawn in two pieces**: the part in the air as normal, the part behind the face clipped to the hole and stopped at the floor of the hole. Nothing hidden behind a surface is drawn over that surface. (`src/socket.ts` `pinPieces`; the plug's pins in `IsoPlug`.)
- **2. Check every in-between state**, not only the resting poses: any moving part (a plug going in or out, a lid, a spring) gets a strip of intermediate values (gap 0, 0.05, 0.1, 0.2, 0.4, 0.75, 1.6 for the plug) and a contact sheet of the real frames around its move.
- **3. A joint has one diameter, one tangent and no visible cap**: where a cable, pipe or strap leaves a part, the stroke starts inside the part, a collar hides the joint, the diameters match (the boot ends at the cable's radius) and the first bend is gentle (a radius of at least 0.6 units; the chain turns at most seg / 0.6 per node there, `tests/colokan.test.ts`).
- **4. A cable reads as a part with volume**: a tube with a base, a body narrowed toward the lit side, a light stripe on the lit side and a rim light on the shaded edge; a boot that tapers from the back cap to the cable's diameter with flex grooves; a cable a third of the back cap's diameter.


## Nature kit (pilot 2, phase 1: the water cycle in the 2.5D style)

The nature parts are in `src/components/IsoNature.tsx`; their geometry (pure, tested) in `src/natureGeometry.ts`; the demo in `src/NatureDemo.tsx`; the asset sheet in `src/NatureSheet.tsx`. Reference: `workspace/channel-art/klipian-intip/hujan-25d.png` (read only).

- **Meaning colours** (the only ones besides the brand and the yellow of the sun, the current and the highlights): **blue = water** (`ISO.water`), **green = plants** (`ISO.grass` top, `ISO.leaf` trees), **brown = soil** (`ISO.soil`), **white and grey = cloud** (`ISO.cloudWhite`, `ISO.cloudGrey`), **yellow = sun** (`ISO.sun`). Each has three tones: light on top, mid on the lower left, dark on the lower right. The nature tones are used only by the nature parts (a test checks it).
- **Depth order** (back to front, the table in the header of `IsoNature.tsx` and `DEPTH_ORDER`): sea; ripples and splash on the sea's top face; vapour; land; trees and runoff on the land's top face; sun; rain; droplets; cloud. The demo draws in that order and a test reads its source.
- **Clipped parts stay inside their face**: a ripple, a splash ring, a runoff stream or a tree base is clipped to the face it lies on (a test checks the geometry). Nothing is drawn over what hides it.
- **Vapour starts inside the water** (below the sea's top face) and fades out toward the cloud. **Rain starts behind the cloud's lower edge** (drawn before the cloud, so the cloud hides its start). **Splash rings lie on the sea's top face**, not in the air.
- **Loops**: every moving part is periodic in its phase (0..1 over the loop), so the loop's last frame equals its first. A state (the cloud's `dark` 0..1, `grow`) is a plain number the plan drives.
- **Sounds**: `rain-patter`, `drip` and `bubble-rise` (synthesised in `sfx/synth.mjs`, CC0, in `sfx/LICENSES.md` and the `SFX` table). The rain sound is low-passed like the other sounds (at most 12 % above 9 kHz).
- Check the **in-between states** (the cloud at dark 0 to 1, the rain's start, the vapour entering the cloud, the splash rings) with strips and 3x crops at the edges before a video uses a part (`out/nature/`).
- **Phase 1b rules** (the polish round): a natural shape needs **variety**: no repeated equal circles, at least three sizes, and a flatter base than top (the cloud: seven puffs and a row of belly ellipses along its bottom). **Object sizes follow the reference's ratios** (a cloud about twice as wide as high and 60 to 85 % of the sea's width; a tree about a quarter of the land's width). Each is compared with the reference side by side before a report. Where a plan's numeric range and the ratio disagree, the ratio wins and the deviation is written in the report (the trees are 0.5 to 0.95 world units, not the plan's 0.9 to 1.3). **A sheet tile is fitted by its bounding box** (about 80 % of its drawing area, centred, the bottom 70 px kept for the label), and nothing overlaps its label. **A stream or any path passes beside or under** the things in its way, never over them: the runoff runs beside the trees, and the land stands higher than the sea so the water runs down into it.

- **Phase 1c rules** (the detail round, ian's verdict: the assets were far below the colokan). A **hero asset must reach 80 % of the colokan's detail budget** (shapes, tone regions, quantised colours on at least 0.5 % of its area), measured with `node scripts/detailBudget.mjs`; the numbers are reported per asset, and an asset that misses says so. **Flat tones only**: depth comes from layers (the sea's three side layers, the land's strata), crescents (a billow's dark base shows at its lower right), shadows (the cloud's on the sea, the tree shadows on the grass) and overlaps, never from gradients or filters (a test checks it). **Crescent-shaded volumes**: a cloud billow is a dark base, a mid body set up and left, a light cap and a rim, never a disc with one dot. **Variety**: the parts of natural things differ in size and spacing (two tree kinds, three pine tiers, a bush of three lobes, puddles of two sizes), and every new part is kept clear of the stream and the trees (tests). The **nature tone sets** stay as they are; the sand and stone sets are new for the land's strata and rocks only, and shades of the water tone are mixed for the sea's deeper layers.

## 4. 3D objects (optional: one hero shot only; semi-realistic, P28-P)

- The hero is a real 3D model (`src/three/`): `WallSocket3D`, `Plug3D` (+ `PlugHeat`), `Cutaway3D`, `Cable3D`, `Smoke3D`, and the charger in `Dissect3D`. The default **look is semi-realistic**: standard materials (matte plastic, brass-like metal, rubber), small bevels, a soft key light from the top-left plus a fill, soft self-shadows, a dim room environment so metal reflects something. `look="toon"` keeps the old flat shading.
- **The palette stays the guide**: models use palette colours through `Mat` (the palette's `METAL` colour becomes metal). Do not introduce colours.
- Light from the **top-left**, always. **Depth rule for holes**: recesses, pin holes and cavities are real depth (a darker floor and a crescent of shade on the top-left inner edge), nothing else gets a shadow.
- Build new models from primitives in the house style: rounded boxes (`roundedRect` + `extrude` with a small bevel), cylinders, spheres, tubes; ~2–10 parts; the main object is 60–70 % of the screen width; no photographic textures.
- Units: models are in *object units* (a socket plate is 2.4 wide). `Placed` puts a model at a video pixel with a story scale `s`; `projectToScreen` gives the screen position of a part (`ANCHORS`) so labels follow it.
- Colour code on a 3D object: yellow dots = current (always flowing), red/orange glow = heat at the contact, grey material, light grey metal.
- Cost: semi-realistic is about **+25 % render time** over toon (colokan, 42 s: about 80 s → 100 s on ian's machine).

## 5. Cables

A cable is a **smooth curve**: `cablePath(route)` rounds every corner (a cubic bezier through the route points, a slight sag on long horizontals, round caps and joins, constant thickness). Never draw a polyline with sharp bends.
2D: `<path d={cablePath(route)}>`, drawn with `evolvePath`. 3D: `Cable3D route=… radiusPx=…` (a tube along the same curve).

**Cables are never rigid** (round 4, rule 2). A cable that hangs from a plug or lies on a floor:
- has a **fixed length with slack** (longer than the straight distance between its ends), and is **simulated or solved deterministically per frame** (`src/cableSim.ts`: a chain of nodes, the same on every render), never a fixed polyline;
- **follows the plug** when it moves (it drags, swings and settles with a little delay) and **leaves the plug along its axis** for about the strain relief, then bends smoothly (minimum bend radius about 0.45 world units, never a hook);
- is drawn with **three tones** along the tube (a light stripe on the top side, the mid body, the dark underside, by the tone rule) and a **soft contact shadow** wherever it lies on the floor or the plate;
- **never ends in a straight run** to the edge of the screen; where it lies, it curls.

**A cable or a background object may pass behind the caption box; it never covers the text** (ian, round 5): the caption box is opaque, and the caption layer is drawn after the picture.

**The world's down axis** (round 5, rule 5.1). In the 2.5D scenes z is up, the wall is the plane y = 0.3 (the plate front, the plug sticks out along +y) and the floor is the plane z = -2.05. Gravity pulls a cable **down the z axis**; the floor is a height in z; the wall and the plug's body are **obstacles** (a cable never passes into them); the cable hangs from the plug toward the floor and lies on it. `simulateCable` takes these as `floorZ`, `wall` and `body(t)`.

**How to check a cable** (round 5): with the plug in the socket, the cable never rises above the plug's top; with the plug pulled out, it follows the plug and falls back to the floor in a soft curve, with no hook and no loop over the plug. Check it on a contact sheet of frames every 3 frames across the pull-out, not on single frames.
