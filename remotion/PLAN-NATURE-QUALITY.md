# Pilot 2, phase 1c: raise the nature kit to the quality of the colokan (plan for klipian eksekusi, approved by ian)

Written by klipian motion (planning only). Ian looked at the nature kit and said, honestly: **the quality of the assets is far below the colokan**. That is right. The kit is correct (tests, depth order, loops) but it is **simple**: the sea is a slab with four white arcs, the land is a block with four cones, the cloud is a row of discs with one small highlight dot each, the rain is nine plain lines. The colokan objects were rich: many real parts, each with its own tone rule, rims and grooves, contact shadows, scorch and heat, a cutaway, and the cable. We matched the *reference picture* `hujan-25d.png`, which is itself a simple mock; ian's bar is the colokan, not the mock. So this round raises the **detail and depth** of every hero asset. **Phase 2 (the video) waits for this round.**

## The quality bar (measurable)
1. **Detail budget.** Measure the colokan socket + plug at the video's scale (a tile of it from `AssetSheetIso`): the number of drawn shapes, the number of distinct tone regions, and the number of distinct quantised colours (round each channel to 8 levels, count the colours that cover at least 0.5% of the object's area). Each nature **hero asset** (sea, land, cloud, tree, sun, rain curtain) must reach **at least 80% of those colocan numbers**, and the report states both numbers per asset.
2. **Every asset is made of parts** that each follow the tone rule, with rims, edges, layers and contact shadows (below).
3. **Side-by-side check**: a contact sheet "colokan scene frame | nature scene frame" at the same scale; ian judges it. The kit is not reported as done until it holds up next to the colokan.

## What each asset needs (the colokan's depth, in nature)
**Sea** (`IsoSea`)
- The slab has **visible depth**: the two side faces show 3 horizontal water layers that darken downward (surface, mid, deep), with a thin lighter surface band along the top edge.
- The top: a lighter **shallow band** along the near edges and a darker **deep patch** in the middle (flat tones, no gradients); **two staggered rows of wave crests** of different sizes drawn as isometric arcs with a small white foam cap, moving periodically; a thin **foam lip** along the top edges; **sun glints** (small white diamonds) that twinkle; a soft **cloud-shadow patch** (a darker flat shape on the surface) that follows the cloud.
- Where the sea meets the land: a **shore strip** (sand tone) and foam.

**Land** (`IsoLand`)
- Terrain with **strata** on the sides: 3 soil layers (top soil, clay, stone) with a few stones; the grass top with lighter **patches and tufts**, a small raised **hill step** (a second block), **rocks**, 2 **bushes**, small **flowers**, and the **runoff stream** as a real shape (a curved channel with banks, not a line); **puddles** that grow after the rain (blue patches on the grass); the `wet` state darkens the grass and soil and adds the puddles.
- **Trees, two kinds**: a **pine** of 3 stacked tiers (each tier a cone split by the light, with a shadow band under it) and a **round tree** (a crown of 3 overlapping lobes, light/mid/dark, on a trunk with a darker side); small **tree shadows** on the grass (a flat darker ellipse offset away from the light). Sizes vary; they are placed in groups with space between them.

**Cloud** (`IsoCloud`)
- A cloud of **billows**: each puff is a **crescent-shaded volume** (a light cap on the upper left, a mid body, a dark crescent on the lower right), **not a disc with a highlight dot**; a flat darker **underside band**; **back puffs** one tone darker behind the front ones (depth); a **soft rim** on the light side; 2 small **wisps** at the edges.
- The `dark` state goes white -> grey with a **darker underside band** and a **rain curtain** below (the rain starts behind the lower band, as now); a **cloud shadow** is cast on the sea/land; periodic slow breathing.

**Sun**: a **glow** of 2 flat rings (pale yellow, paler yellow) behind the disc, **alternating long and short rays** that pulse, the disc with the light face and the darker crescent.

**Rain and water in motion**
- Rain streaks in **3 depth layers** (long and bold in front, shorter and paler behind), with a **fade at the cloud's lower edge** (they appear from behind it), **splash crowns** (a small arc of 3 droplets) where they hit land, **expanding double ripples** (two ellipses on the water plane) where they hit the sea, and drops running down the land.
- **Vapour**: curving wisps **with small bubbles** that rise from inside the water and **a shimmer** (two thin offset curves) above the sea; they thin out toward the cloud; **droplets** gather under the cloud and join.

**Backdrop**: 2 layers of **distant hills** (pale blue-green, lighter with distance) and 2 **small far clouds**, on parallax layers (they move less than the foreground), plus the existing circle spot.

## Rules for the work
- Everything is **SVG** (the 2.5D kit); the tone rule and the nature colours stay as they are (blue water, green plants, brown soil, white/grey cloud, yellow sun, three tones each). New tone sets are allowed only for sand and stone.
- **Depth order**: write the table for every new pair (shadow on top of land, trees in front of the hill, rain behind the cloud's lower band, splash on the right plane, puddles under the rain), with the order tests; parts that go behind something are hidden by it.
- **Check the in-between states** with strips and contact sheets and the exact times: cloud `dark` 0 -> 1 with the shadow, rain start, splash and ripples, puddles growing, vapour entering the cloud.
- Keep all periodic, so loops close; keep the sheet fitted by bounding box; add tiles for each new part (pine, round tree, hill, shore, puddle, shadow, backdrop hills); update `NatureDemo` to show the whole scene.
- Tests: the detail-budget numbers (computed from the rendered tiles) in `tests/nature.test.ts` or a script; the per-asset part lists; depth order; periodicity; no part outside its face.

## Report (then STOP, do not start phase 2)
1. The **detail numbers** table (colokan vs each nature asset: shapes, tone regions, quantised colours).
2. The **contact sheets**: colokan scene frame | nature scene frame (same scale), the kit vs the old kit (before | after), the strips and 3x crops, with the exact times.
3. The render time of `NatureDemo`.
4. The new rules in `DESIGN.md` ("Nature kit"): for example **"a hero asset must reach the colokan's detail budget"**, **"flat tones only, depth from layers and shadows, not from gradients"**, **"shapes of natural things have variety (sizes, spacing) and each volume is crescent-shaded, never a disc with a dot"**.
5. Limits as always: only your own paths under `remotion/`, no Python/UI/server/workspace/secrets, nothing downloaded, commit locally, do NOT push, check CPU before rendering.

## For ian
This costs more than a polish round, because the kit gets many more parts. If you want a cheaper first step, say which assets matter most (my suggestion: cloud, sea and land first; backdrop and extras after); the report then comes in two parts.
