# DESIGN.md — klipian intip: the design system every video session reads first

Contents: [0b. The klipian intip formula (Style Bible v1)](#0b-the-klipian-intip-formula-style-bible-v1) · [the three musts (B16)](#the-three-musts-b16) · [the motion language](#the-motion-language) · [the rule log](docs/RULE-LOG.md) · [0. How to start](#0-how-to-start-a-new-video-exact-commands) · [12. Before you hand a video back](#12-before-you-hand-a-video-back)

You are making one Short for the channel **klipian intip** (fun facts, explained with a flat/semi-3D look). klipian has already written the story,
fact-checked it and kept it as JSON. **Your job is the scenes**: draw each beat from the components below, keep the checked words as the words, make it
look like the channel and pass the quality bar at the end. Read this whole file before you write a scene.

Everything here is code in `remotion/`: `npm test` checks the rules that can be checked, `npm run assets-sheet` shows what exists,
`npm run studio` is where ian reviews. Use the Remotion skills in `.claude/skills/` (start with `remotion-best-practices`) for Remotion itself.

---------------------------------------------------------------------------------------------------------------------------------------

## 0b. The klipian intip formula (Style Bible v1)

The one system behind every video, whatever the fact: an object opened up (the colokan), a process (rain), a cause, or a myth check. Written as rules that `scripts/styleCheck.mjs` and the tests can check. The other sections keep their detail; this section says what every video has in common.

Contents: [the five locks](#the-five-locks) · [the rules](#the-rules-style-bible-v1) · [the visual dictionary](#the-visual-dictionary) · [the beat formula](#the-beat-formula) · [the detail budget](#the-detail-budget) · [the checker and the checklist](#the-checker-and-the-checklist)

### The five locks

1. **Diorama set.** One set per video (B27), in the iso camera of the kit, the lens move always the same. The isometric slab is the set's floor or ground and it bleeds past the frame; the brand background and its yellow spot show only in the sky or far back, behind the set (never behind the top text, B27.11).
2. **Visual dictionary.** One mark per physical thing, in `src/dictionary.ts`. Every new thing gets its row first.
3. **One hero asset per video** at the detail budget, at most two simple supporting assets, at most three new loose supporting pieces (the hero and its set are not counted, B27.15).
4. **One beat formula** for every kind of fact, with a verdict stamp for a myth check.
5. **The rules in one checklist**, printed by `scripts/styleCheck.mjs`.

### The rules (Style Bible v1)

> **Sets, at a glance** (read before you design a set): every video gets its own set (B27.15); `src/sets.ts` lists the kinds and each video's `videos/<slug>/set.json` says which one it uses; the nature diorama (sea, land, hills, fields, trees) is taken by `cara-kerja-hujan-buatan`; a shape with a real form is drawn in that form (B27.16).

- **B1 Stage.** One set per video (B27) in the kit's iso camera (`VIEW = [1,1,1]`, top light, +y mid, +x dark); the slab of the stage (three tones and a flat darker base shadow) is the set's floor or ground, and it bleeds past the frame. The stage shapes (slab, round, strip, steps, island) still apply to that floor. The hero fills 60 to 70 % of the screen width at the main shot.
- **B2 Lens.** The "Intip" move is always the same: the camera goes in, a circle grows from the part, the lab background (dark, grid) shows inside it, and on the way out the circle shrinks back to the part.
- **B3 No parked people.** A stage has no people and no mascot parked in a corner. The mascot is for the sting, plus at most two short reactions (B11); the outro has none (B12).
- **B4 Dictionary.** Every mark is a row in `src/dictionary.ts` with its recipe and its component. A video may not invent a private mark for a thing that has a row. A row marked "to build" is a spec only: it is not drawn until it has a component and a tile.
- **B5 One hero.** One hero asset per video, at the detail budget (B6). At most two supporting assets, simple and flat. At most three new loose supporting pieces per video; the limit does not apply to the hero and its set (B27.15: each video gets its own set). The report says which pieces are new and which were reused.
- **B6 Detail budget.** The hero (and each hero of a nature video) reaches 80 % of the colokan socket + plug's **shapes and parts** (`node scripts/detailBudget.mjs`). Tone regions and quantised colours are informative only: a three-tone material cannot have more than three tones.
- **B7 Beat formula.** `hook` (an everyday hook, about 3 s: a question, a surprising statement or a myth; it does not have to start with "kenapa") → `sting` (a small mascot and the pill "Intip yuk!", about 1 s, no veil) → explain (two or three beats, each one claim) → look closer (the lens or a macro, or a zoom to the key part) → `result` (what it causes, with its source card) → a tip or a verdict → `outro` (the loop-back). Durations are 30, 45 or 60 s and the beats add up to them exactly.
- **B8 Kinds of fact.** Only the explain beats change: an object opens up (the lens); a process follows the flow around the stage (the camera follows the particles); a cause is a chain of cause and effect arrows; a myth check ends with a verdict stamp.
- **B9 Verdict stamp.** A pill on the stage: FAKTA is black on yellow, MITOS is white on black, SEBAGIAN is grey. No new colour. The stamp component is to build (no row is drawn yet).
- **B10 Text and sources.** At most six words on screen at a time, all from the story. Every claim has at least one source; every source card shows one of the story's claims.
- **B11 Mascot.** At most one sting and at most two reactions between the sting and the outro, each short. None in the outro (B12).
- **B12 Outro (the loop-back).** The outro has no voice, no mascot and no text (narration empty, the first and last frames match: the loop test). Decided by ian (2026-10-28): the sign-off (`klipian intip`, `Intip yuk fakta lain →`) and the voice of pilot 1's outro go; a video whose plan declares a loop-back (`loopWeight`) is checked by what it draws, and `styleCheck` FAILs when the story's outro still has a voice (must 2 of B16).
- **B13 Motion and sound.** A sound on every movement, at most three at once. For a custom video this is mandatory and written by hand in `sfx.ts` (a sound on every object entering, camera move, label or card, state change and alive action that matters), about 1 event a second (pilot 1: 44 in 45 s; 55 to 60 for 60 s, 30 for 30 s), only names from the locked set (B15); the style check FLAGs a default-only sfx.ts or under 0.7 a second and FAILs an unknown name. Highlights live on their object and have a meaning. Cables and strokes are never rigid; parts that go into holes are clipped; joints are smooth; in-between states are checked as strips.
- **B14 Revisions.** Every revision adds its rule to this section or to the section it touches (the motion rule of `DESIGN.md` § 6 and the nature rules of § "Nature kit" in `DESIGN-iso.md`), and its row to the rule log in `docs/RULE-LOG.md`.
- **B15 Sound (approved, locked).** Ian, 2026-10-28: "the sound effects and all the sounds are perfect". The reference is pilot 1's sound set and mix: the synthesised sounds (`sfx/synth.mjs`, `sfx/music.mjs`, listed in `sfx/LICENSES.md`), the `SFX` and `MUSIC` levels in `src/catalog.ts`, the placement (a sound on the frame of its picture, at most three at once, a cooldown per sound) and the density (about 44 events in 45 s). Existing sounds and levels change only when ian asks. A new sound is made the same way and judged against the pilot 1 mix. `styleCheck` FAILs when a sound file or level of the approved set changed (a hash of the set is recorded in `scripts/soundHash.json`). **Amended (PLAN-VARIETY stage 4):** the sound effects and their mix stay locked. The music beds are an open set: the approved beds (`bed-calm`, `bed-tech`) stay recorded in `scripts/soundHash.json` as they are, and a new bed joins only after ian listens to it (`out/music/`) and approves it, as its own entry; nothing approved is rewritten.
- **B17 Text style (locked).** The caption is a black box (`BLACK`, opacity 0.88, rounded), its text white and the spoken word yellow (`YELLOW`), in Outfit Bold (`FONT_BOLD`); the small labels and kickers are DM Mono (`FONT_MONO`); no other fonts (`src/components/Captions.tsx`, `src/tokens.ts`). `styleCheck` FAILs a literal font name in a video unless it is a registered exception in `src/motionLanguage.ts`.
- **B18 Voice apps.** The narration text is made for every voice app checked in the video's options (all three by default). Each app has its own format: the tags of that app's verified list only, in that app's own syntax, in the export only, never in the story (the rule "voice export"). The apps are the checkboxes of "Video baru" and "Pilihan video"; the panel "3 Suara" shows one block per checked app.
- **B19 Voice export.** Each voice app's export uses only the tags of that app's verified list, in that app's own syntax: Google AI Studio `<...>` (English), VoiceStudio `[pause ...]` and the optional `[laughter]`/`[sigh]`, ElevenLabs `[...]` and `...`. The tags are in the export only, never in the story; matching strips them. A tag not on the list is not written.
- **B20 Khusus: the story comes from the chosen folder, never automatically.** For the kind Khusus the story is taken only when the person presses "Ambil cerita dari folder" for the folder they chose: that button reads that folder's `story.json` alone, checks it like a pasted answer, and keeps it only when it is valid. Nothing is read in the background, no folder is written, and Claude Code never writes to `workspace/`.
- **B21 Variety.** The music bed, the theme and the stage shape of a video are chosen by its kind of fact, and not repeated from the video before. `scripts/styleReport.mjs` lists the last five videos and flags a video that repeats both the bed and the theme of the one before it: a flag, not a failure (ian decides).
- **B22 Bottom.** The caption sits as low as the calibrated safe area allows: every look's box ends at 1720 (10 px above `SAFE.bottom` 1730) and at x 930 at the most. **Centred (ian, 2026-11-08):** every look is centred on the frame (x 540), not on the safe area (x 495, which sat 45 px left of the middle); to keep the box inside x 930 the text width of `classic` and `wide` is 720 px (box 780, x 150..930), `punch` stays 700. History: 1632 (the first Shorts estimate), 1620, 1590 (the web estimate 1600), now 1720 from ian's own calibration (2026-10-31, `docs/safe/youtube-2026-10-31.jpg`). CAVEAT: one device, a tall phone (about 20:9); on a shorter phone (16:9, 18:9) YouTube usually lays the title and description over the bottom of the video, so a caption at 1720 may be covered there. It is ian's choice, taken with that risk known. Nothing but the platform interface may be below `SAFE.bottom`.
- **B23 Caption looks.** The caption has three looks, chosen by the story's `captionStyle` (PLAN-CAPTION-OPTIONS, ian to choose): `classic` (the default: two lines, 56 px), `wide` (one line, 46 px), `punch` (one line, 76 px, at most three words a page). The looks are layout only: the box, the size and the words per page change; the text style is locked (black box at 0.88 opacity, white words, the spoken word in yellow, Outfit Bold). The box of each look is its tallest box, so the scene keeps clear of any page (`captionBox(style)`). A story without `captionStyle` is classic.
- **B24 Platform safe areas.** `SAFE_PLATFORMS` (src/tokens.ts) lists the part of the frame YouTube Shorts, TikTok and Instagram Reels cover with their own interface. YouTube is obeyed and is CALIBRATED from ian's screenshot of `out/safe/calibration.mp4` played as a Short on his phone (kept as `docs/safe/youtube-2026-10-31.jpg`): top 120, bottom 1730, left 60, right 930, one device, with a margin; `SAFE` is its profile and everything the layout keeps safe follows it. The top text and the default banner start at y 170 on purpose (it looks good and keeps a margin for other phones). TikTok and Instagram are checked, never obeyed, and stay estimates from third-party measurements (sources and the date of reading are in the comment of `SAFE_PLATFORMS`) until ian calibrates them with the same clip: `npm run safe-check -- <slug>` and `style-report` flag what falls into their covered bands, as a flag and never a failure. A story's optional `platforms` (default `["youtube"]`) switches on the cross-post mode: the layout obeys the strictest listed profile (the caption bottom follows it). Recalibrate when the app changes (`npm run calibration` renders the clip again).
- **B25 Motion density and alive assets** (P28-R phase 5). A video must not hold one shot for long. (1) **Something moves about every second:** the longest stretch in which nothing in the picture moves is at most 1.25 s. (2) **Something new every 3 to 4 seconds:** an element comes in, the camera goes to another place, or the scene changes; the longest gap without it is at most 4 s. (3) **Scene variety per beat:** each explain beat has its own picture (a different hero or a different camera and set of things), not the same stage for the whole video; the opening shot comes back only in the loop-back. (4) **Alive assets:** an asset that stands in a scene moves a little all the time (it breathes, sways, bobs, blinks, spins, ticks, glows) with the sizes of `src/motionLanguage.ts` ALIVE and the functions of `src/alive.ts`; the alive set is `src/components/IsoLife.tsx` (a lamp, a kettle, a fan with its air, an alarm clock, a cup, a battery, a heart, a brain), and `IsoBed`, `SleepyEyes` and `IsoTrees` take a time to be alive too. (5) **Nothing hides behind the caption or the source chip:** a label, a tip card and a chip are boxes of the layout manager (`src/layout.ts`), so they cannot overlap, and a tip's whole phrase is one title (never a phrase cut across a title and a sub line). (6) **Measure it:** render a draft (`preview: true`), then `npm run motion-density -- <slug or file.mp4>` reads the picture (the caption band and the top text left out) at 4 samples a second and prints both numbers as PASS or FLAG; `styleReport` and `styleCheck` point to it. A flag is not a failure: ian decides. Before the fix of P28-R: kenapa-colokan-panas passes (longest still 0.25 s, longest gap 3.25 s), cara-kerja-hujan-buatan flags (3.75 s, 11 s), ngantuk-pegang-hp flags (2.75 s, 9.5 s).
- **B26 Files that render.mjs loads in Node.** `videos/<slug>/sfx.ts` and `plan.ts` are loaded by plain Node (render.mjs, the tests, styleCheck), which cannot read `.tsx`. They import only plain `.ts` modules (`src/sfx.ts`, `src/schema.ts`, `src/layout.ts`, `src/timeline.ts`, `src/iso.ts`, `src/tokens.ts`...), never `src/design/index.ts` (it re-exports `.tsx` components; the render fails with "Unknown file extension .tsx"). `index.tsx` may import from the design index. `styleCheck` FAILs a video that breaks this, and `tests/videos.test.ts` loads a scaffolded video's `sfx.ts` and `plan.ts` in Node.
- **B27 Set, not specimen.** The hero stands in the place where people meet it in daily life (its *set*): a socket in a room's wall, rain over a landscape, an organ inside a body. Never a lone object on an empty page.
  1. **Bleed.** In every shot outside the lens the set runs past the frame edges on at least two sides (left and right, or the bottom); no floating slab with empty brand background around it. The brand background and its yellow spot may show only in the sky or far back, behind the set.
  2. **Three depth layers.** Far (the set's back: what shows through the window, the wall's top, hills, the room; parallax about 0.3), the set with the hero (p = 1) and a near layer (p > 1). Pieces that stand in the set stay at p = 1 (B27.9d); their depth comes from a correct overlap. The near layer holds only loose things that touch nothing (dust `Motes`, a passing leaf, rain). The camera moves them with `layerTransform` (ian, 2026-11-03).
  3. **Fill.** In the main shot of each beat the empty background (the brand wall tones and the spot) covers at most 35 % of the picture area between the top text and the caption band. Measured from rendered frames (`npm run motion-density -- <slug>`, `fillOf`); a flag, not a failure.
  4. **Set dressing.** 2 to 4 simple, flat, three-tone pieces (from the kit, or saved as kit pieces). They do not count against B5's supporting assets, they stay below the hero's detail and contrast, and they never use a meaning colour (yellow, red, blue water) unless they mean it. The hero stays the largest and most detailed thing. For a landscape, count kinds, not instances: hills, fields and trees are three kinds, however many trees stand in a row (ian, 2026-11-04).
  5. **Inside the lens nothing changes:** the Lab (dark, grid) stays empty around the dissected part.
  6. **The lens only when the narration goes inside** (ian, 2026-11-03): where the narration itself looks inside a part or names something too small to see ("di dalam", a part, a grain, a nerve). Every other beat is a camera move inside the set (a push, a pan or a new framing of another place in it, B25.3), never a lens by habit. At most one lens per video stays (§ 2).
  7. **One scale per set** (ian, 2026-11-03: the side table was about the size of the socket). Every object in a set has its real size relative to the hero, from one table of real sizes in cm (`REAL_SIZE_CM` in the plain `.ts` module `src/roomScale.ts`, B26: a socket plate about 8.5, a side table 50 to 60 high and 40 to 50 wide, a table lamp 35 to 45, a potted plant 30 to 60, a window about 100 to 120 high, a dining table about 75 high, a chibi adult about 160, a cloud, a plane, a field, a hill in their own nature ratios). When the hero is a close-up, a big piece is shown **partly, cut by the frame**, never shrunk to fit. Only the far layer (parallax below 1) may look smaller, and only by its parallax. `tests/scale.test.ts` checks that each piece's drawn size over the hero's is within 15 % of the ratio in the table. A nature set has one scale too (`NATURE_UNIT_M` metres a unit in `src/roomScale.ts`, each kind's real size in `NATURE_SIZE_M`, held by `tests/diorama.test.ts`); the sky things that cannot be drawn true (a cloud kilometres wide, a seeding plane) are listed in `NATURE_EXAGGERATED` with their drawn size and are tested against that, not against the real one.
  8. **Establishing shot and readable dressing** (ian, 2026-11-03, after colokan v3: at true scale only a brown wedge and a yellow cone showed). (a) The hook opens on a wide shot of the set, about 1.5 s, in which the lamp and the table's edge and top are seen whole and the hero is where the story is (the plate is about 15 % of the width; large set pieces, such as the table's legs, may be cut by the frame in the wide shot as long as the recognisable part stays visible, see (b)); then the camera pushes to the hero's main shot (B1's 60 to 70 % applies from there). The loop-back eases back to that same wide shot, so the last frame is the first. The wide push is faster than a beat's push: the plan says why with a `motion-exception:` comment. (b) A piece cut by the frame shows its most recognisable part (a table's thick edge, a lamp's shade with its neck), never an anonymous shape; the window may be only a corner of its casing and the glass, cut by the frame. In a close-up a piece either reads or is out of the frame. (c) Dressing keeps off the meaning colours: no yellow lamp shade, no yellow-looking wood (yellow is current); neutral greys and taupe.
  9. **No overlap, no pass-through** (ian, 2026-11-03). Objects of a set never go into one another. (a) Every piece has a world box (x, y, z in the set's units, `ROOM.boxes` in `src/roomScale.ts`, in drawing order); two boxes never intersect, they may only touch at a face. (b) A thing that stands rests on its surface: its base z equals that surface's z (the lamp on the table top, the legs on the floor), not sunk into it and not floating. (c) The cable treats every piece as an obstacle (the table top is its floor, the lamp, the wall, the plug's body), as § 5 (Cables, in `DESIGN-iso.md`) does for the wall; a plugged-in appliance's cord ends at its cord point (`end` in `simulateCable`). (d) Pieces that touch share one parallax layer (p = 1); a piece on another layer never touches or crosses them, so a camera move cannot slide one through the other. (e) Depth order (round 6, rule 0) holds in every frame. (f) Checked by `tests/setBoxes.test.ts` (the boxes, the contacts, the layers, the cable in every frame) and by a strip of frames across every camera move, not only the resting shots.
  10. **The hero in the centre third, inside SAFE** (ian, 2026-11-04, from the colokan v6 review). In the establishing shot the hero sits in the middle third of the width and inside SAFE (x 60 to 930 for the platform that is targeted, B24), with the set's dressing to its sides; nothing the story needs hangs at the edge where the app's interface covers it. A plan test reads the hero's box at the wide shot.
  11. **No meaning colour behind the top text** (ian, 2026-11-04). The kicker and headline zone (y about 86 to 330) has no yellow or other meaning colour behind it in any frame (a yellow sun, a spot or a lamp glow behind the title reads as the thing the title is about, and makes the text hard to read). The sun, the spot and every yellow thing stay out of that band or are moved to the side.
  12. **Cables and lines bend smoothly** (ian, 2026-11-04). A cable, a line or a stream has no zigzag kinks: it bends one way at a time, over several nodes. `tests/cableSim.test.ts` counts opposite-direction neighbouring turns above 0.3 rad (a kink) and the count must be 0 in every frame.
  13. **Nature shapes** (ian, 2026-11-04, hujan review: the terraced hills read as towers). Boxes and hard steps are for man-made things only (a room, a table, a house, a field's plot). Hills, rocks, clouds and shores have soft, organic silhouettes: rounded mounds, irregular edges, no stacked blocks. The kit's stepped hill pieces are the exception to retire: draw a hill as a rounded mound, not a ziggurat.
  14. **Open water** (ian, 2026-11-04, hujan review: the sea read as a swimming pool). A sea or a lake bleeds past the frame, or runs to the horizon, on its open sides; it has no light border all round. A pale rim only where water meets land (the shore).
  15. **Own set per video** (ian, 2026-11-04, the sun video reused the rain video's whole diorama, sea and fields, as its background). (a) Each video gets its own set, designed around its hero and what explains the topic (the sun: a wide sky with a horizon and light passing through air, or the sun seen from space; not the rain video's fields and sea). (b) Never reuse another video's scene or set composition as a background, the far layer included. (c) A single piece may be reused only when it is the same thing and fits the story (a cloud in a lightning video), adapted in size, palette colour or state (a dark storm cloud); never bend the topic around an existing asset or use a merely similar one (a kettle as a pot). (d) The iso kit stays the material (camera, three tones, light), so new pieces stay in style.
      **How to obey it, in four steps** (ian, 2026-11-04, the cloud-sea-and-fields set came back behind the rainbow and the heavy-cloud videos): (1) open `src/sets.ts` and read which sets are taken and which kinds are free; (2) pick the free kind that fits where the topic really happens (a rainbow is light in the air: `sky-horizon`, not the rain video's land and sea; a topic does not stand in a place just because the weather in it is rain or cloud); (3) build the set from the iso kit (`iso.ts`), composing at most three pieces from `IsoNature.tsx` (never the sea, land, hills, fields, trees, bushes and rocks together; that is the rain video's set); (4) declare your set in `videos/<slug>/set.json`, `{"kind": "<id>"}` with a free kind, or a new kind with `name`, `fits` and `recipe` (a file inside your own video folder; never edit `src/sets.ts`, so the stock branch stays only videos). The style check FAILs a video that draws another video's set or names a kind another video declared, and FLAGs one without a set.json. A set kind is used once: the next video with a similar place designs a different place.
  16. **A shape with a real form is drawn in that form** (ian, 2026-11-04, the rainbow: it is a full circle, cut by the horizon, not a half-arc). (a) Before drawing a thing or a phenomenon, check from a source what shape it really has and draw that shape, not the shape of the postcard (a rainbow is a ring about 42 degrees around the point opposite the sun; from the ground the horizon hides the lower part, from a plane it is a full circle; the earth is a sphere; a raindrop is round, not teardrop; the moon's phases are the lit part of a sphere). (b) When the picture shows only part of a shape, the rest is cut by something in the set (the horizon, the frame, a cloud) and not drawn short. (c) The video says in its report which real shapes it checked and from which source. (d) When the real shape does not fit the frame, bend the camera, not the shape.
- **B28 Looks** (ian, 2026-11-04: the motion is not always 2.5D objects). A story has a `look` (`iso` by default, `2d`, `text`; `validate.mjs` accepts these three). The agent chooses it from the topic, in this order: `iso` when the topic has a physical thing or place that can be drawn as an iso set (a socket, a room, the rain); else `2d` when it can be drawn but not sensibly in iso (a flat diagram, a map, a side-view process); else `text` when there is nothing to draw (a statistic, a probability, a date, a comparison of sizes). The answer says why ("gaya: iso/2d/teks, karena ..."). **iso:** everything as B27 and the iso kit. **2d:** a flat 2D drawing (front or side view, no iso projection), the same palette tokens, two tones per part (base and shade), no outlines except the allow-listed marks, the same light direction; the B27 set rules still apply in 2D (own set, bleed, fill, scale, no overlap). **text:** no objects; kinetic numbers and words in rounded cards like the caption (a counter that rolls, a number that grows, comparison bars, cards that stack or flip, a timeline), Outfit and DM Mono only (B17), palette tokens, the frame filled by type and boxes (fill at most 35 %), a camera move or a new card about every 3 to 4 s (B25); the B27 set rules do not apply. **Never changes, in every look:** `TopText` and `CaptionLayer`, the "Intip yuk!" sting, the loop-back outro, per-element sfx about 1 a second (B13), the motion registry, the sources. The style check applies the iso-geometry check (must 3 e) to `iso` only: `2d` FAILs when iso helpers draw the hero, `text` is INFO.
- **B29 Sting voice** (ian, 2026-11-08). "Intip yuk!" is read plainly: the narration export puts no tag before it (no whisper, no "sstt"), for Google AI Studio and ElevenLabs alike, and the Google style says "bright and direct" on it.
- **B29 Loop clock** (ian, 2026-11-09: gurita-punya-tiga-jantung looped badly once the voice made it 62.3 s, PSNR first/last frame 26.5 dB against 41.5 dB at 60 s). Ambient motion (kelp, bubbles, waves, arms, blinks, anything with a period) must not depend on the video being a fixed length: its periods divide 60 s, so a voiced video (any length) runs it on a loop clock, `loopClock(clock, total, base)` (src/alive.ts, exported by design: `clock * base / total`, base 60 or the length the periods divide, 45 for the 45 s videos; total = the sum of the beats), a whole number of cycles from the first frame to the last. Motion tied to a beat (the swim, the heart, a reveal, the camera keys) keeps the real `clock`. Check a rendered voiced video: the first and last frame (`ffmpeg ... psnr`, the caption band y 1500 and below left out, the first frame has the caption fading in) stay above about 35 dB (60 s reference 41.5 dB; gurita fixed: 38.5 dB, was about 26 dB).
- **B30 No sound cut by the end** (ian, 2026-11-10: the closing jingle of benarkah-kita-hanya-memakai-10 was still sounding when the video ended). Every sound effect, the closing `jingle-outro` (2.2 s) above all, must finish before the last frame, because the video loops and a cut sound clicks at the loop point. `planSfx` (`src/sfx.ts`) enforces it: an event whose tail would pass the end starts earlier (to `total - length`, on a frame); loops and beds are clamped to the end. 13 of the 22 stock videos with a jingle were cut by 0.6 to 1.6 s before this. The loop stays perfect: the picture end is unchanged (B29), only the sound moves. Tested in `tests/sfx.test.ts`.
- **B31 The sting is not always in the same place** (ian, 2026-11-10: every video had the mascot at the centre, a little high, and the pill at the centre, a little low, always the same). The "Intip yuk!" sting is one mark, drawn by `StingMark` (`src/components/StingMark.tsx`; the places are in `src/stingPose.ts`): the mascot (w 220) with the pill right under it. Five poses, all inside the safe area and far above the caption band (y 1500): `top` (540, 430), `topLeft` (310, 400), `topRight` (770, 400), `midLeft` (310, 800), `midRight` (770, 800); the pill centre is 175 px under the mascot's. The pose comes from the video's slug (`stingPoseFor`, an FNV hash, never `Math.random`: a render is the same every time, so the loop and the tests are safe). A video whose hero stands where its pose would be passes `pose` to `StingMark` (name it in its plan.ts as `stingPose`). A new video uses `StingMark` and never hardcodes the mascot and pill. The timing is unchanged (the springs p and p2 and the sfx frames stay), and nothing outside the sting beat changes (B29). Tested in `tests/stingPose.test.ts`.
- **B32 The thumbnail card** (ian, 2026-11-10: the YouTube Short gets a custom thumbnail). `klipian/render.py write_thumbnail` makes `<video>.jpg` next to the MP4 (full-bleed frame at 1 s, a dark gradient from the bottom to 55% of the height, the text in bold white capitals, left aligned, above the caption band; no outline, no other element) and /workspace shows it. The text is the story's optional `thumb` (3 to 8 words, `*key words*` in yellow, one run); without it the title cut to six words is used. Rules for `thumb`: a curiosity-gap question or a surprising claim that the video really answers (no clickbait: if the video does not show it, do not say it); keep the key detail out; put a number in when the topic has one; do not repeat the title word for word. Example: `Gurita punya *3 jantung*?`, or `Darahnya biru, *kok bisa*?`. Shorts show the custom thumbnail on the channel page, in search and in lists; the Shorts feed player may still show a video frame (not verified).
- **B16 Musts.** Every video has three musts, decided by ian on 2026-10-28: (1) the small "Intip yuk!" sting right after the hook; (2) the loop-back ending (no mascot, label, pill or voice in the outro; the first and last frames match); (3) a consistent object style and animation (see "The three musts" below). Everything else in this section is a default that a topic may adapt. `styleCheck` FAILs when a must is broken.

### Animation recipe: what moves, when, how

One page for a video session. Read B27 first. Every row is a default; the rule numbers say where it comes from.

| beat | what moves | how long, how | rules |
| --- | --- | --- | --- |
| hook (about 3 s) | opens on a wide shot of the set (hero in the centre third, inside SAFE, dressing to its sides), holds about 1.5 s, then the establishing push to the main shot (hero 60 to 70 % of the width); the question or label comes in at 0.2 to 0.4 s | wide shot 1.5 s, push 1.0 to 1.5 s, zoom about 0.45 to about 1.25, `Easing.inOut(Easing.quad)` | B1, B7, B27.8, B27.10, registry |
| sting (about 1 s) | the small "Intip yuk!" mascot and pill; the world keeps moving behind it; no veil | spring, soft | B7, B16, B3 |
| each explain beat | a camera move inside the set: a push over the beat, or a pan to another place in the same set; something new every 3 to 4 s; labels in 0.2 to 0.4 s; alive assets (sway, bob, drift, rain, ripples) always moving | push 4 to 8 s (zoom at most 0.05 per second), pan 0.8 to 2.5 s; objects enter in 0.25 to 0.6 s | B25, B27.2, B27.7, B27.9, registry |
| look closer | the lens only when the narration goes inside a part or names something too small to see, at most one per video; the dive 0.7 to 1.0 s, the lab stays empty around the part; any other beat is a push to the part | dive 0.7 to 1.0 s | B2, B27.5, B27.6 |
| result | the answer on the set with its source card (and the verdict stamp for a myth check); no meaning colour behind the top text | cards 0.2 to 0.4 s | B9, B10, B27.11 |
| tips, verdict | the tip cards over the set, the camera drops to leave room; one idea per card | cards 0.2 to 0.4 s | B7, B27.11 |
| outro | the camera eases back to the wide shot of the hook, every state eases to its first value, so the last frame is the first; no voice, text or mascot | about 4 s, ease | B12, B16, B27.8 |

For `look` 2d and text (B28) the rows differ only here: **2d**: the camera moves inside a flat set (a push or a pan across the drawing), parts slide or fade in, the same eases and springs; **text**: a new card, number or bar about every 3 to 4 s, a counter rolls over 0.8 to 1.2 s, bars grow with `easeOut`, a card stacks or flips with the registry's spring, one camera push per beat; the hook opens on the biggest number or word.

### The visual dictionary

The table is `src/dictionary.ts` (the code is the source of truth; `tests/style.test.ts` checks it). Drawn rows have a tile on the mark sheet (`src/MarkSheet.tsx`):

| thing | mark | status |
| --- | --- | --- |
| electric current | yellow dashes flowing along the path (cutaway) | drawn: `IsoCutaway` |
| heat | red and orange wavy lines rising, with a warm glow ring | drawn: `HeatRise` |
| danger / hot spot | red core with a pulsing ring (danger only) | drawn: `IsoWallSocket` |
| water (liquid) | blue layers and streaks, three tones | drawn: `IsoSea`, `IsoRain` |
| vapour / steam | pale blue curving wisps with small bubbles, rising | drawn: `IsoVapour`, `SmokePuffs` |
| light / radiation | yellow rays around a disc | drawn: `IsoSun` |
| spark / electric arc | short yellow and hot-orange flecks | drawn: `Sparks` |
| force or flow direction | black arrow with a round tail (round tail to add) | drawn: `Arrow` |
| air / wind | white curving streaks | to build |
| sound / vibration | thin concentric arcs | to build |
| cold / ice | pale cyan crystals, blue-white glow (tones to define) | to build |

### The beat formula

`hook` → `sting` → explain (2 to 3 beats) → look closer → `result` → tip or verdict → `outro`. The kinds exist in the schema (`hook`, `sting`, `lens`, `normal`, `loose`, `result`, `tips`, `outro`). Per kind of fact, see B8.

### The detail budget

`node scripts/detailBudget.mjs` measures the colokan socket + plug (the bar: 119 shapes, 35 parts) and the hero candidates from the sheets, then prints whether each reaches 80 % of the shapes **and** the parts (95 shapes and 28 parts for the bar). Tone regions and quantised colours are printed as information. The nature tiles are read from `out/nature3/sheet.png`.

### The checker and the checklist

`node scripts/styleCheck.mjs <slug>` (for example `kenapa-colokan-panas`) checks what a story and its files can show: the duration and the beat formula, the sting and the reactions, the outro (B12), the words on screen, the sources, the stage, the marks a video draws (against the dictionary), the number of new assets (a human count), the verdict stamp of a myth check. It marks what needs a render as RENDER, and prints the human checklist at the end. It exits with 1 when anything is FLAG. Before you hand a video back, run it, and the flags are either fixed or named in your report.

### The three musts (B16)

The musts are checked by machine and FAIL the video. They are the only rules the checker never reports as a flag.

1. **The "Intip yuk!" sting.** The second beat is `sting` and its text is "Intip yuk!" (`styleCheck`: must 1).
2. **The loop.** The last beat is the outro, with an empty narration and, when the plan declares a loop-back, no mascot, label or pill in it (`styleCheck`: must 2; the first and last frames match by `tests/colokan.test.ts`).
3. **Consistent object style and animation.** (a) Every colour comes from `src/tokens.ts`: no literal colour and no gradient, except the entries of `STYLE_EXCEPTIONS` in `src/motionLanguage.ts`, each with its reason. (b) Easings and springs are the registry's (below). (c) The camera pushes and pans, the lens and the wipes and slides are inside their ranges. (d) The motion blur is only on a lens, slide, wipe, zoom or a pan. A video may leave a range only with a comment `motion-exception: <reason>` in its `plan.ts` and ian's OK; the checker then reports it as INFO. Not checked by machine yet: the tone rule (a part's tone comes from its face direction) and the outlines (strokes only on the allow-listed marks); the human checklist covers them.

### The motion language

`src/motionLanguage.ts` is the registry, measured from pilot 1 (its `plan.ts`, `index.tsx`, `src/motion.ts`, and its story's cameras and transitions). `styleCheck` reads it.

| what | the registry | pilot 1 measured |
| --- | --- | --- |
| easings | `easeOut`, `easeInOut`, `easeOutBack` (src/motion.ts), the push `Easing.inOut(Easing.quad)` | the same four |
| springs | default: damping 12, stiffness 150, mass 0.8; soft (arms, faces): damping 20, stiffness 120, mass 0.9 | the same two |
| an object enters | 0.25 to 0.6 s | springs settle inside it |
| a label or pill comes in | 0.2 to 0.4 s | about 0.3 s |
| camera push over a beat | 4 to 8 s, zoom at most 0.05 per second | 5 to 7 s, zoom 0.02 per second |
| camera pan | 0.8 to 2.5 s, at most 800 px per second | no pan in pilot 1 |
| establishing push (the hook's wide shot to the main shot, B27.8) | 1.0 to 1.5 s, zoom about 0.45 to about 1.25, `Easing.inOut(Easing.quad)` | colokan 1.3 s (0.46 to 1.28), hujan 1.2 s (0.46 to 1.0) |
| lens transition (the dive) | 0.7 to 1.0 s | 0.8 s |
| wipe or slide | 0.4 to 1.0 s | 0.5 and 0.6 s |
| ambient motions | hover period 1.82 s, breathe 2.5 s, blink 3.4 s (src/motion.ts) | the same |
| motion blur | only on a lens, slide, wipe, zoom or pan | none so far |

The plan's first draft gave a camera push 0.8 to 2.5 s; pilot 1's pushes last 5 to 7 s, so the registry takes the measured range.

The rule log (who asked for each rule, and when) is in `docs/RULE-LOG.md`; add a row there with every new rule (B14).

## 0. How to start a new video (exact commands)

klipian keeps each video as a project in `workspace/profiles/<profile>/motion/<project>/` (on the /remotion page: topic → brief → AI answer → fact gate). The checked
story is `story.json` there (`story.voiced.json` when a narration was aligned: durations and word times follow the voice). The page shows the exact command.

```bash
cd remotion
npm install                                   # once
npm run new-video kenapa-hujan-turun "D:/github-repos/klipian/workspace/profiles/<profile>/motion/<project>/story.json"
npm run studio                                # open the composition  video-kenapa-hujan-turun  (props panel: layoutDebug)
```

That makes `videos/kenapa-hujan-turun/` with `index.tsx` (your scenes), `sfx.ts` (your sound effects), `story.json` (a copy of the checked story) and `meta.json`.
It is registered in Root by its folder name. Then:

1. Look at `npm run assets-sheet` (`out/assets-sheet.png` and `out/assets-sheet-iso.png`, the 2.5D kit) and the `IsoDemo` / `CardsDemo` / `RigDemo` compositions: **what exists comes first**. The main style is 2.5D isometric (see "2.5D isometrik" in `DESIGN-iso.md`).
2. Write the scene function in `index.tsx`: one drawing per beat, from `src/design/index.ts`. The beat gives you `beat.text`, `beat.headline`, `beat.kicker`, `beat.narration`, `beat.words`, `beat.dur`, `beat.scene.items`, and the story gives `claims` with sources.
3. Check in Studio with `layoutDebug` on; fix what the layout manager reports. Run `npm run check && npm test`.
4. In klipian (/remotion page) choose **Komposisi → your video**; stills, render, Clips and upload work as for the template. Render time matters: say it in your report.

Never change the words of the story: if a sentence is wrong or too long, tell ian and change it in klipian (the fact gate must see it).

---------------------------------------------------------------------------------------------------------------------------------------

## 1. The frame, the palette, the meaning of colours

- 1080 × 1920, 30 fps. Everything is positioned in video pixels (x right, y down). `import { FRAME, SAFE } from "../../src/design/index.ts"`.
- **Safe area** (B24: YouTube Shorts is obeyed, calibrated on ian's phone; TikTok and Instagram are checked and stay estimates, not official): `SAFE = { left: 60, right: 930, top: 120, bottom: 1730 }`, the YouTube profile of `SAFE_PLATFORMS` (src/tokens.ts). Text, the mascot, people, labels, badges, source cards and the caption stay inside.
- Palette (`src/tokens.ts`, never type a colour by hand): `BLACK` (20), `WHITE` (250), `YELLOW` (255,212,71), `YELLOW_D` (dark yellow), greys `G1…G4`, `RED`, `HOT1/HOT2` (heat), `METAL`.
- **Meaning, always the same**: yellow = electric current (and the channel's accent); red/orange = heat or danger; grey = an object's material; light grey = metal. **Red is for meaning only, never decoration.**
- Fonts: **Outfit Bold** for text, **DM Mono** for small labels (kickers, domains, units). No other fonts.
- Flat style: no outlines, no drop shadows from objects, no paper texture. **Shadows only for depth**: holes, recesses, cavities, the plug in its socket (light from the top-left; the shadow is the base colour darkened, never black).

## 2. Backgrounds

| background | use it for |
|---|---|
| `Brand` (the lens-ring wall with a big yellow spot behind the main subject; `spot={{x,y,r}}`) | every story beat outside the lens, the hook included |
| `Lab` (dark slate with a grid and a warm glow) | everything inside the lens and every cutaway or dissection, so current and heat light up and white things do not merge with it |
| `Room` / `Black` | plain scenes (rarely) |

"Through the lens" is a move from the light world to the dark lab. At most **one** look inside per video, and only when the cause is really inside an object.

## 3. The mascot and people

**The mascot** (the yellow bubble with one magnifying-glass eye, no body) is **rare** (ian, 2026-10-26):
- the **"Intip yuk!" sting** is a **small pop**, about 200–240 px wide (the video has no full-screen veil there: the plug, the heat and the camera keep moving behind it), with the pill beside it, in the top band clear of the socket;
- the **outro is a loop-back with no mascot, no label and no pill** (ian, 2026-10-27: the mascot is not in the ending any more);
- in between, at most **2 short reactions** (about 1 s each: an `enter` delay and an `exit`) at key moments;
- **never parked in a corner for the whole video**. The validator refuses a third reaction, a reaction longer than 1.5 s and `persist` outside the sting and the outro (the outro's mascot in the story is for ian to drop, round 3);
- expressions: `curious, surprised, think, understand, laugh, ouch`; the "ting" of the lens plays on "Intip yuk!".

**How to make a seamless loop ending** (the outro beat of a video that loops, kenapa-colokan-panas, round 3):
- the state at the last frame equals the state at the first one: the camera is back on the opening shot, the plug is back in (no gap, no heat, no scorch, no ring), and no text or label is on the screen. `plan.ts` makes this a state blend from the outro on (`state(t)` eases each object to its `core(0)` value), and `tests/colokan.test.ts` checks both ends;
- anything that moves by itself (the glow breathing, the heat rise, the motes, the brand rings) must come back to its opening value or be periodic in the video length; the camera eases home by the last frame;
- no fade-out of the music at the end (the bed runs on so the seam does not dip to silence); one soft sound (`thump`) as the plug goes back in, nothing else;
- the outro beat may have an empty narration (the storyboard may drop its line); the validator allows that only for the outro.

**People (chibi) are optional.** Use one only when the story needs a person: someone doing something, a body part, a person's reaction being the point. A topic about an
object (a socket, a charger) shows just the object. Roles (so far `pemuda`), expressions `calm, happy, surprised, ouch`, poses `idle, point, ouch, wave, cheer`, costume `none|helmet`.
The chibi look: head about half the body height, big black eyes with two highlights, blushing cheeks, short round body, round hands with thumbs, short legs, black shoes, no outline.
**Hijab rule** (recorded decision): the hijabi character follows the majority view in Indonesia (Shafi'i): the whole body except face and palms; the scarf covers hair, ears and neck and falls over the chest;
long sleeves to the wrists, a loose long skirt to the shoes. What changes per role is only colour, costume, hair and props.

**Empty space is filled by the hero object, its parts, pointer labels, arrows and motion, not by characters.**

The 2.5D iso kit, depth order, nature kit, 3D objects and cables are in `DESIGN-iso.md` (look iso only).

## 6. Motion

Every beat has **2–4 moments of movement**; no screen stands still for long. The fixed vocabulary (`src/motion.ts`, `src/timeline.ts`, `src/catalog.ts`):
- enter `pop | slide | fade-up | draw | none` (items come in one after another, 4 frames apart by default), exit `pop | slide | fade-up`;
- actions `highlight` (a pulse), `shake` (**danger only**), `look`, `pose`, `expr`; living idles (hover, blink, breathing, the current always flowing);
- camera `push | pan | still`; transitions `cut | slide | wipe | zoom | lens`, **at most 3** non-cut transitions per video, the first beat has none, and "through the lens" for the one look inside;
- springs and easing at 30 fps, never stepped; words appear one by one with the keyword in yellow.

### Camera-led scenes (one continuous object)

For a scene that is one object seen from a moving camera instead of separate layouts, use the **camera rig** (`src/three/rigMath.ts`, `Host3D rig={…}`):

```tsx
import { Host3D, objectScale, WallSocket3D, Plug3D, shots, viewAt } from "../../src/design/index.ts";

const SHOTS = [
  shots.hold(0, 1),
  shots.push(1, 3, 0.55),                      // dolly in to 55 % of the distance
  shots.orbit(3, 5, 38, 12),                   // swing round to the right and a little above
  shots.dolly(5, 7, [0, -0.7, 1.2], 0.35),     // glide the target to the strain relief and close in
  shots.macro(7, 8, [0, -0.85, 1.3]),          // a macro close-up
];
const Scene = ({ t }: SceneProps) => (
  <Host3D rig={viewAt(SHOTS, t)}>
    <group scale={objectScale(1.5)}><WallSocket3D /><Plug3D /></group>
  </Host3D>
);
```

`viewAt` has no jumps between shots (checked in `npm test`); `speedAt(SHOTS, t)` tells you when the camera is fast, then wrap the scene in `CameraMotionBlur` from `@remotion/motion-blur`.
Pixel mapping (`Placed`) is only valid at the rest view; with a moving camera, place objects in world units. Labels that must follow a part: compute the screen point with the same view (see `projectToScreen`, which assumes the rest view: for a moving camera project with `cameraFromView`).
Look at the `RigDemo` composition.

## 7. Sound

- **Every transition, object and mascot effect has a sound** (`src/catalog.ts` `SFX_FOR` maps motion words to the 25 self-made sounds in `sfx/wav/`); an item's `sfx` overrides its entrance sound (`"none"` silences it). A custom video writes `videos/<slug>/sfx.ts` (`export function sfx(story)` → `[{ t, name, vol, why }]`, `t` on a frame boundary): start from `storyEvents(story)` or write it against your scenes. Sound must **land on the frame of its picture** and must not be busy: at most 3 at once, a cooldown per sound.
- **Voice**: klipian aligns the narration with faster-whisper; beats last as long as their narration (at least 1 s), `beat.words` holds the word times, `story.captions` is on. The voice is levelled to −3 dBFS; effects and the music bed **duck under it** (−9 dB / −4 dB).
- **Music bed** (`story.music = { track: "bed-calm" | "bed-tech" | "none", level }`): a quiet loop about 12 dB under the voice (louder when there is no voice). The mix never goes past −0.7 dBFS.
- Limits in the mixer: effects ceiling −6 dBFS, final ceiling 0.92, a soft limiter, no harsh top end (`npm test` checks).

## 8. Layout: zones, safe area, the layout manager

The scene is split in fixed zones (`ZONES`, `zonesFor` in `src/layout.ts`):

```
y  85..285     banner (or the top text layer: kicker + headline, y 86..330)
y 300..1340    hero object: centre x 540, 60–70 % of the width (72 % with no character at the bottom)
left/right     callouts: pointer labels, arrows, numbers, cards, around the hero
y 1470..1600   caption layer (karaoke), inside the safe area
bottom-left    the mascot, only in the sting (a small pop in the top band) and its two reactions; the outro has none
bottom corner  a chibi, only when the story needs a person
```

**Never write coordinates and hope.** Describe what is on the screen as boxes and let the manager push the texts apart:

```tsx
import { resolve, labelBox, pillBox, itemBox, cardSpec, pointerBox, ZONES } from "../../src/design/index.ts";

const specs = [
  { id: "hero", role: "hero", box: { x0: 190, y0: 520, x1: 890, y1: 1220 } },
  { id: "label-1", role: "text", box: labelBox("rapat", 733, 560, 66) },
  cardSpec("source", 60, 1250, 760, 300),
];
const { moved } = resolve(specs);            // moved.get("label-1") → { dx, dy, scale, wrap }
```

Rules it enforces: nothing overlaps (texts vs each other, the banner/top text, the caption layer, the mascot, a chibi, the core of the hero); texts stay inside the safe area; a text that already fits is **never moved**; a text moves the shortest way
(a little shorter towards its side), may break into two lines or shrink to 70 % (never below 46 px) before it travels far; badges sit on their object (they may overlap the hero) but not on text; an arrow whose tail was on a moved text moves its tail with it.
Text widths come from the real font (`src/fontMetrics.ts`, made by `node font-metrics.mjs`), so a test, the Studio and a render agree. **Turn `layoutDebug` on in Studio** to see every box, what moved and what could not be solved.
The story template applies the manager to every beat; custom scenes call `applyLayout(items, fixedLayers(story, beat))` or `resolve(specs)` themselves.

### Highlights and replacements (round 4, rules 4 and 5)

- **Every highlight** (a ring, an outline, an arrow, a glow) **lives on the object it points at**: it uses that object's plane and perspective (`OnPlane` / `planeXZ` / `isoAt`, as `PlateHighlight` does for the plate), never a flat screen-space circle. It is drawn in the z-order of its object: an object in front covers it (the plug is drawn after the plate's outline). It always has a visible meaning: a label with a leader line (`NumberLabel`, with the story's own words) or the word in the caption. An unexplained shape is a bug.
- **A thing that is replaced shows the swap**: the old part to the new part (a quick brightness pop, the outline sweeps once round it, then it stays thin until the beat ends), not just a circle that grows.
- **A label on a highlight is not a numbered step** (round 5): it has no number disc, unless the highlight really is step n of the tips. It is a short tag of at most two words from the story, and it must not repeat the line of the card or caption beside it; if the story has no such tag, the highlight has no label.

## 9. Text

- **At most 6 words per piece of screen text** (the validator counts); readable in **1 second on a phone** (headline ≥ 64 px, labels ≥ 46 px, captions 56 px, contrast: dark on the light wall, white on the lab).
- **Two text layers** (voiced videos): the **top text** (`beat.kicker` — a small mono kicker, e.g. "PIN CUMA NEMPEL DI" — over `beat.headline`, 2–4 bold words that change per sentence; it replaces the banner) and the **karaoke captions** at the bottom (1–2 lines in a dark rounded box, the word being spoken in yellow, from `beat.words`; an even estimate without a voice). Use `TopText` and `CaptionLayer`.
- **Pointer labels** (`PointerLabel`): a small pill with a leader line to a point on the object (use `projectToScreen` for a 3D part); `magnify` rings the point with a lens. **Onomatopoeia** (`Onomatopoeia`: "PLOK!", "OFF") on a yellow burst, popping with a little overshoot.
- **Source and data cards** (`SourceCard`, `SearchCard`, `NumberCard`, `BarChart`, `LineChart`, `CalendarCard`): show where a fact comes from and what a number is. Every checked claim may be shown as a source card (quote, organisation, date, domain); numbers come only from a source the story lists.

## 10. The quality bar (ian checks every video against this before it is published)

1. every object is recognisable at once, without reading its label, and every part of it is drawn correctly at the camera angle (no hidden holes, no floating pieces, parts that go into holes stay inside them while they move, joints are smooth);
2. nothing overlaps, everything is inside the safe area;
3. there is meaningful movement in every second, no long still screen;
4. screen text is readable in 1 second at phone size;
5. the sound is in sync with the movement and not busy;
6. every claim has a source and was checked;
7. the hook in the first 3 seconds makes people curious;
8. it is still nice to watch the second time on a phone.
9. every close-up is reviewed at 1:1 and at 3x (a crop of the object), and the object is on its own on the asset sheet: a close-up that "looks like a bug" fails the bar even when the layout test is green (round 4, rule 6).

## 11. How to add an asset

The library grows: **every object or scene made for one video is saved as an asset**, so the next video is faster and the brief's catalogue grows.

1. **Where the file goes**: a 2.5D isometric piece in `src/components/Iso.tsx` (geometry in `src/iso.ts`, tones from `ISO`, a tile on `AssetSheetIso`); a 2D component in `src/components/<Name>.tsx` (SVG, palette colours from `tokens.ts`, props `t` for time and a state prop such as `variant` or `heat`); a 3D model in `src/three/<Name>.tsx` (built from primitives, materials through `Mat`, no other colours); a card or text style in `src/components/Cards.tsx`.
2. **Export it** from `src/design/index.ts` so scenes import it from one place.
3. **A catalogue entry** so the klipian brief lists it next time: add the type to the story schema (`src/schema.ts`, a new item with its fields and a `.strict()` object, and the item in the `Item` union) and the enums to `src/catalog.ts` (names, states, expressions). `node catalog-export.mjs` then lists it for the brief **by itself** (the fields are read off the schema); add a sentence to `STORY_RULES` (`src/catalog.ts`) if the validator checks something about it, and an example item to `stories/example.json` if it is a main object. Render it in `FunFact.tsx` (`SceneItem` or an `Item3DLayer`) so a story can use it; give it a box in `itemBox` (`src/layout.ts`) so the layout manager keeps text off it.
4. **A tile in the asset sheet**: `src/AssetSheet.tsx` (a `Tile` with its name; add the name to `ASSET_NAMES`); run `npm run assets-sheet` and look at `out/assets-sheet.png`.
5. **Tests**: the schema test (a valid and an invalid use), the layout box, the asset-sheet name; `npm run check && npm test`.
6. **A sound** if it moves: map its enter/actions in `SFX_FOR` (or add a sound to `sfx/synth.mjs` and the `SFX` table, CC0 and listed in `sfx/LICENSES.md`).

## 12. Before you hand a video back

First run `node scripts/styleCheck.mjs <slug>` and read the rules of section 0b (The klipian intip formula, Style Bible v1): its flags are fixed or named here, and its human checklist is part of this list.


`node scripts/frames.mjs video-<slug> <folder> 0.5 3.2 9.4 ...` renders any frames into `out/<folder>/` in one browser session: check the frames around every camera move and transition.
A custom video may keep its timing in a pure `plan.ts` (when things happen, from the beats and the narration's word times; the cameras; the boxes of every frame), used by `index.tsx`, `sfx.ts` and a test that runs the layout manager's `conflicts()` frame by frame (see `tests/colokan.test.ts`). Its `sfx.ts` may export `music = { track, level }` (used when the story names no bed).

- `npm run check && npm test` pass; `layoutDebug` shows no unsolved problem;
- stills of every beat (klipian's storyboard sheet) look right; you checked frames around every transition;
- highlights have a meaning and the right z-order; cables follow the plug; recesses show all their holes (round 4, rule 8);
- parts that go into holes stay inside them while they move; joints are smooth; the in-between states were checked as a strip and a contact sheet (round 6, rules 0 to 4);
- the render time and any new asset are in your report to ian; nothing in `workspace/` was changed by hand.
