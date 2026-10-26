# Pilot 1 "Kenapa colokan bisa panas?": hand-over (2.5D isometric)

Commits (local, not pushed): 955c42a (semi-realistic 3D socket set and overlays, kept in the library but not used), d5559eb (the 2.5D kit and this video), plus this note.
`npm run check && npm test` pass (including tests/colokan.test.ts, 64 checks).

## Done
- **2.5D kit (reusable)**
  - `src/iso.ts`: pure geometry. Axes (x lower right, y lower left, z up); the tone rule (top light, +y mid, +x dark; seen when facing (1,1,1)); `block`, `extrudeXZ` / `extrudeAnyXZ`, `cylinder`, `planeXZ` / `planeYZ`, `roundRectPts`, `circlePts`, `smoothPath`; the 2D camera `cam2At`, `layerTransform` (parallax depth p) and `toScreen`.
  - `src/tokens.ts` `ISO`: three tones each for plastic, wall, floor, dark, metal, brass and labPlastic.
  - `src/components/Iso.tsx`:
    - generic pieces: Polys, IsoBlock, OnPlane, Hatch;
    - IsoWallSocket: wall chunk and floor, plate, recess, pin holes, centre screw, earth clips, plate screws, `scorch`, collar `heat`;
    - IsoPlug: `gap`, `wobble`, `heat`, ribs, strain relief, smooth cable;
    - IsoCutaway: stepped cut, hatched cut faces, brass leaves with `loose` 0..1, pin, terminal, wire, yellow current dashes, hot glow;
    - particles: HeatRise, SmokePuffs, Sparks, Motes.
  - `src/components/Overlays.tsx`: NumberLabel, Magnifier, MacroFrame, TipCard (+ tipCardHeight / tipCardSpec), SourceChip, LoopArrows, `monoWidth`.
  - `src/layout.ts`: role `picture` (cards and diagrams must not overlap each other, the hero or text).
  - `src/three/project.ts` (`projectView`) and `src/three/Outlet3D.tsx`: the optional 3D set.
  - Everything is exported from `src/design/index.ts`.
- **Library pages**
  - `AssetSheetIso` in `src/AssetSheet.tsx` (`npm run assets-sheet` → `out/assets-sheet-iso.png`);
  - the `IsoDemo` composition (`src/IsoDemo.tsx`), registered in `src/Root.tsx`;
  - `DESIGN.md` section "2.5D isometrik", plus notes in sections 0, 11 and 12.
- **Tools**
  - `scripts/frames.mjs <composition> <folder> <seconds...>`: any frames in one browser session.
  - `render.mjs`: the bundle hash includes `videos/`; a video's `sfx.ts` may export `music`; AssetSheetIso and IsoDemo are allowed compositions.
- **This video**
  - `plan.ts` (pure):
    - moments from the narration's word times (so a real voice re-times everything);
    - per-sentence headlines picked from the story's texts;
    - both cameras and the lens circle (in through the magnifier, out through a shrinking circle);
    - object states; labels, cards, chips and tips all read from story.json;
    - `specsAt` for the layout check.
  - `index.tsx`: one continuous SVG take with no cuts: brand wall outside, dark lab inside the lens, mascot only in the sting, one reaction and the outro.
  - `sfx.ts`: 62 events plus `music = bed-tech`.
  - `tests/colokan.test.ts`: layout conflicts every 3 frames, text from the story, smooth cameras, sfx on frames, iso geometry, asset names, picture role.
- **Stills** (in `out/`, not in git):
  - every beat: `out/colokan/stills/` (`sheet.png`);
  - frames around every move: `out/col1/sheet.png`, `out/col2/sheet.png`.

## Next
1. **Full MP4 with sound.** Held back because the CPU was at about 90% (VoiceStudio and the klipian server). When it is free:
   `node render.mjs out/colokan-video.json`
   The job file is `{"mode":"video","composition":"video-kenapa-colokan-panas","story":"videos/kenapa-colokan-panas/story.json","out":"colokan/colokan-25d.mp4","concurrency":4}`.
   Then check audio sync and clutter in `out/colokan/colokan-25d.sfx.txt`, and give the render time.
2. **Voice.** When a narration is imported, render from `story.voiced.json` with `"voice"`. plan.ts follows `beat.words` by itself; recheck the frames around the moves.
3. **Score against the quality bar** after watching the MP4, and report to ian in Indonesian. Studio: `npm run studio` → `video-kenapa-colokan-panas`, with `layoutDebug` in Props.

## Known issues
- In the tips the plug hides most of the plate, so the new plate (yellow ring at "menggantinya") barely reads. Pull the plug out, or orbit the camera, for tip 2.
- In the hook the cable runs behind the caption box (background, but noticeable).
- The source-card quotes are long (3–4 lines) for their roughly 3 seconds on screen.
- The cutaway only reads well when zoomed; at the first lab frames (about 9.6–10.5 s) it is small.
- No motion blur on the fast dolly (9.05–10 s) or the exit (about 28.2–29.1 s).
- The kickers ("DARI LUAR", "DI DALAM", "DI DALAM · DIPERBESAR", "AKIBATNYA", "TIPS AMAN") are chrome; a beat's own `kicker` / `headline` in the story wins.
- The five claims are still "pending" in klipian's fact gate; text updates automatically if one is rejected.
- Brass leaves use a muted warm metal (`ISO.brass`) so they never read as the yellow of current.
