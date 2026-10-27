# Pilot 1 "Kenapa colokan bisa panas?": plan round 6 for klipian eksekusi (approved by ian)

Written by klipian motion (planning only). Round 5 and its follow-up are on origin/main (deb360e). Ian found two more drawing bugs:

1. **A plug pin (the metal) shows up outside the hole**, on the plate, instead of going into the hole.
2. **The cable does not join the plug smoothly** (the joint at the strain relief looks like a bug).

**Where ian saw it (confirmed on the render): the moment the plug goes in**, i.e. the loop-back at about 41.9 to 42.4 s. At 42.2 s a silver pin bar sits on the plate to the right of the plug (outside the hole), and the cable joint behind the strain relief is an elbow of about 90 degrees (42.2 to 42.5 s). The same pin bug shows when the plug comes out (about 34.5 to 35.3 s). Check both moments first.

## Diagnosis (code read in `src/components/Iso.tsx`; frames of the current render)

### 1. The pins (`IsoPlug`, the `gap > 0.05` pins)
```
{gap > 0.05 && [-PIN_X, PIN_X].map((x) => <Polys polys={cylinder([x + cx, y0 - 0.74, SOCKET_Z], [x + cx, y0, SOCKET_Z], 0.1, 0.1, ...)} tones={ISO.metal} />)}
```
- A pin is a cylinder from `y0 - 0.74` (inside the wall) to `y0` (the plug's face), drawn **on top of everything**, after the socket. Whenever the plug is partly out (gap between 0.05 and about 0.75, i.e. while it is pulled out at about 34.5 to 35.3 s and while it goes back in during the loop-back at about 41 to 42.5 s), the part of the pin that is **behind the plate's front face** (y < 0.3) is drawn over the plate. In this view, -y points to the upper right of the screen, so the hidden part of the pin lands on the plate to the right of the hole: a metal bar "outside the hole". That is the bug in ian's screenshot (a metal bit on the right edge of the plug, on the white plate).
- The pins are also not clipped at the recess floor: they reach y = `y0 - 0.74`, deeper than the floor (-0.05), so even inside the hole they would pass through the floor.
- It only shows in the in-between states (gap about 0.05 to 0.75), which no frame check of the resting poses (plug in, plug out) catches.

### 2. The cable joint (`IsoPlug` strain relief + `CableLine`)
- The relief ends at `at(1.62)` with end radius 0.18 (diameter 0.36), but the cable is drawn with a stroke of 0.25 and **round caps**, starting exactly at that point: the cap and the thinner tube sit on top of the relief's last groove, with a visible step.
- The cable is drawn **after** the plug, so its start cap is on top of the relief instead of being hidden inside it.
- The chain pins its first 0.45 units along the plug axis (the stub) and then bends: the bend radius right after the stub is small, so the joint looks like an elbow (about 90 degrees) instead of a cable flowing out of the relief. The spline through the nodes also has no tangent at the start (`smoothPath(sp, 0.5)` starts toward the second node).

## A. Pins (`Iso.tsx` `IsoPlug`, `IsoWallSocket`)
1. Split each pin into two pieces at the plate's front plane (y = `PLATE_FRONT`):
   - **outside piece**: y from `PLATE_FRONT` to `y0` (the part in the air), drawn normally;
   - **inside piece**: y from `RECESS_FLOOR` to `PLATE_FRONT` (the part in the hole), drawn **clipped to the hole polygon** (the same polygon `IsoWallSocket` uses for the recess), and **ending at the recess floor**, where the pin enters its hole. Nothing of a pin may be drawn beyond the floor.
2. Draw the pins' inside piece **before the recess wall's front lip** if needed so the plate's rim covers it; the pin must look like it goes *into* the dark pin hole. Make the pin hole on the floor a little larger than the pin (hole radius about 0.17 for a pin radius 0.1), so the pin visibly sits in it.
3. Draw the pins whenever any part of them is visible: no hard `gap > 0.05` switch (it makes the pins pop in); fade or keep them from the first frame (gap 0 is covered by the plug's collar anyway).
4. Wobble: the pins follow the plug's tilt (`cx`, `tip`) as now; the clip keeps them in the hole.

## B. The cable joint (`Iso.tsx`, `cableSim.ts`, `plan.ts`)
1. **One diameter**: make the strain relief's end radius equal to the cable's radius (cable stroke 0.25 means radius 0.125: end the relief at 0.125, or widen the cable to 0.36; pick one, keep the cable at a believable thickness), so there is no step.
2. **Hide the joint**: start the cable's drawn path **inside** the relief (about 0.25 units before its end) and draw a short **collar ring** (a short cylinder, the relief's end tone, slightly wider than the cable) at the junction over the start of the path. No round cap may be visible at the junction.
3. **Tangent continuous**: add a virtual point before the first node along minus the plug axis, so the spline leaves the relief **along the axis**; make the stub 0.9 units or more; limit the turn per node for the first 6 nodes (about 0.2 rad per node) so the first bend has a radius of at least about 0.6 world units. The bend after the stub must read as a gentle droop, never an elbow.
4. Keep the rest of the chain behaviour from round 5 (gravity -z, floor, wall obstacle, fixed length).
5. **The cable must look like a cable joined to a plug, not a line stuck on it** (ian: "right now it looks like only a line attached to the plug"). Today the cable is three flat strokes (a dark one, a mid one and a thin highlight, `CableLine`) laid on a cone, so it reads as a line. Make it a part with volume:
   - **A real strain-relief boot**: a longer flexible boot (about 0.9 to 1.2 units) that tapers from the plug's back cap (radius about 0.3) to the cable's radius, with 3 or 4 flex grooves or ribs, drawn with the tone rule (top light, +y mid, +x dark) like the plug body, and **bending with the cable** (the boot's axis follows the first nodes of the chain, so it curves instead of being a straight cone with a line coming out of it). The cable enters the boot's small end, which covers the start of the cable.
   - **A tube, not a line**: draw the cable as a tube with a lit side and a shaded side: a dark base stroke, a mid stroke narrowed toward the lit side, a light stripe on the lit side that follows the curve, and a thin rim light on the shaded edge, with the thickness the same as the boot's small end. A short darker band where it leaves the boot (the sheath end), and a soft contact shadow where it touches the plug's collar or the floor.
   - **Believable size**: the cable's diameter is about one third of the plug's back cap, as in a real mains cable; no thin wire look.
   - Check it at 3x at 0.5 s, 42.2 s and 42.5 s: the eye must read "plug, boot, cable" as one object.

## C. Tests (`tests/colokan.test.ts`, `tests/cableSim.test.ts`, a new check on the pins)
- Pins: for gap in {0.05, 0.1, 0.2, 0.4, 0.75, 1.0, 1.6} and wobble in {-1, 0, 1}, every vertex of the **inside piece** projected to the screen lies inside the hole polygon, and no pin vertex is deeper than `RECESS_FLOOR`; the outside piece never has y < `PLATE_FRONT`.
- Joint: the cable's first screen tangent is within about 10 degrees of the plug axis's screen direction; the relief's end radius equals the cable radius; the first 6 nodes' turn per node is below the limit; the path's first drawn point is inside the relief (at or before `at(1.4)`).
- Boot and tube: the boot's centre line follows the first chain nodes (its end tangent equals the cable's start tangent); the boot has at least 3 grooves; the tube is drawn as at least four layers (base, body, lit stripe, rim light) with a width ratio cable : plug back cap of about 1 : 3.
- Existing checks stay green (loop, layout, captions, cable behind caption).

## D. Visual check (this is what was missing)
Add a **transition-state strip** to `AssetSheetIso` (or a separate sheet in `out/`): the plug at gap 0, 0.05, 0.1, 0.2, 0.4, 0.75, 1.6 with the camera used at 35 s and at 42 s, plus a 3x crop of the cable joint at 0.5 s, 35.2 s and 40.6 s. Also a contact sheet of every 2 frames from 34.5 to 35.6 s and from 41 to 42.5 s (the two moments the pins are partly out). Look for any metal outside the hole and any step or cap at the cable joint.

## E. Rules to add to `DESIGN.md` (ian: put what follows from the revisions into the rules)
0. **Standing rule (ian, 2026-10-28): every revision of a motion video adds its rule to `DESIGN.md`.** Each round's report must list the new rule(s) it added, or say why none applies. First one now: **depth order (occlusion)**. An object that is behind another object or behind a surface (a pin in a hole, a cable behind the plate or the caption box, a part inside a body, a thing behind the wall) must be hidden by it: draw it before the nearer object, or clip it to the opening it is seen through. Never draw a hidden part over the thing that hides it. For every pair of objects that touch or overlap, write down which one is in front, and check it in the transition frames, not only in the resting pose.
1. **A part that goes into a hole is drawn in two pieces**: the part in the air as normal, the part behind the face clipped to the hole and stopped at the floor of the hole. Nothing hidden behind a surface is drawn over that surface.
2. **Check every in-between state**, not only the resting poses: any moving part (a plug going in or out, a lid, a spring) gets a strip of intermediate values and a contact sheet of the real frames around its move.
3. **A joint has one diameter, one tangent and no visible cap**: where a cable, pipe or strap leaves a part, the stroke starts inside the part, a collar hides the joint, the diameters match and the first bend is gentle (no elbow).
4. Add to the quality bar (section 10, item 1) and the handover checklist (section 12): "parts that go into holes stay inside them while they move; joints are smooth".

## F. Verify before reporting
- `npm run check && npm test`; the frame set from D; render the MP4 and report the render time, the loop numbers (first vs last frame) and the sound events. Commit only your own paths locally. Do NOT push.

## For ian
Nothing to decide. If you see a third thing that looks wrong while you watch the new render, send me the time in the video as well as the picture (for example "35.1 s"): it makes the diagnosis much faster.
