# DESIGN.md — klipian intip: the design system every video session reads first

Contents: [0b. The klipian intip formula (Style Bible v1)](#0b-the-klipian-intip-formula-style-bible-v1) · [the three musts (B16)](#the-three-musts-b16) · [the motion language](#the-motion-language) · [the rule log](#the-rule-log) · [0. How to start](#0-how-to-start-a-new-video-exact-commands) · [12. Before you hand a video back](#12-before-you-hand-a-video-back)

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

1. **Diorama stage.** One isometric slab on the brand background with its yellow spot, the iso camera of the kit, the lens move always the same.
2. **Visual dictionary.** One mark per physical thing, in `src/dictionary.ts`. Every new thing gets its row first.
3. **One hero asset per video** at the detail budget, at most two simple supporting assets, at most three new assets.
4. **One beat formula** for every kind of fact, with a verdict stamp for a myth check.
5. **The rules in one checklist**, printed by `scripts/styleCheck.mjs`.

### The rules (Style Bible v1)

- **B1 Stage.** One stage block per video (a slab with three tones and a flat darker base shadow) on the `brand` background. The camera is the kit's iso camera (`VIEW = [1,1,1]`, top light, +y mid, +x dark). The hero fills 60 to 70 % of the screen width at the main shot.
- **B2 Lens.** The "Intip" move is always the same: the camera goes in, a circle grows from the part, the lab background (dark, grid) shows inside it, and on the way out the circle shrinks back to the part.
- **B3 No parked people.** A stage has no people and no mascot parked in a corner. The mascot is for the sting, plus at most two short reactions (B11); the outro has none (B12).
- **B4 Dictionary.** Every mark is a row in `src/dictionary.ts` with its recipe and its component. A video may not invent a private mark for a thing that has a row. A row marked "to build" is a spec only: it is not drawn until it has a component and a tile.
- **B5 One hero.** One hero asset per video, at the detail budget (B6). At most two supporting assets, simple and flat. At most three new assets per video, and the report says which assets were reused.
- **B6 Detail budget.** The hero (and each hero of a nature video) reaches 80 % of the colokan socket + plug's **shapes and parts** (`node scripts/detailBudget.mjs`). Tone regions and quantised colours are informative only: a three-tone material cannot have more than three tones.
- **B7 Beat formula.** `hook` (an everyday hook, about 3 s: a question, a surprising statement or a myth; it does not have to start with "kenapa") → `sting` (a small mascot and the pill "Intip yuk!", about 1 s, no veil) → explain (two or three beats, each one claim) → look closer (the lens or a macro, or a zoom to the key part) → `result` (what it causes, with its source card) → a tip or a verdict → `outro` (the loop-back). Durations are 30, 45 or 60 s and the beats add up to them exactly.
- **B8 Kinds of fact.** Only the explain beats change: an object opens up (the lens); a process follows the flow around the stage (the camera follows the particles); a cause is a chain of cause and effect arrows; a myth check ends with a verdict stamp.
- **B9 Verdict stamp.** A pill on the stage: FAKTA is black on yellow, MITOS is white on black, SEBAGIAN is grey. No new colour. The stamp component is to build (no row is drawn yet).
- **B10 Text and sources.** At most six words on screen at a time, all from the story. Every claim has at least one source; every source card shows one of the story's claims.
- **B11 Mascot.** At most one sting and at most two reactions between the sting and the outro, each short. None in the outro (B12).
- **B12 Outro (the loop-back).** The outro has no voice, no mascot and no text (narration empty, the first and last frames match: the loop test). Decided by ian (2026-10-28): the sign-off (`klipian intip`, `Intip yuk fakta lain →`) and the voice of pilot 1's outro go; a video whose plan declares a loop-back (`loopWeight`) is checked by what it draws, and `styleCheck` FAILs when the story's outro still has a voice (must 2 of B16).
- **B13 Motion and sound.** A sound on every movement, at most three at once. Highlights live on their object and have a meaning. Cables and strokes are never rigid; parts that go into holes are clipped; joints are smooth; in-between states are checked as strips.
- **B14 Revisions.** Every revision adds its rule to this section or to the section it touches (the motion rule of `DESIGN.md` § 6 and the nature rules of § "Nature kit").
- **B15 Sound (approved, locked).** Ian, 2026-10-28: "the sound effects and all the sounds are perfect". The reference is pilot 1's sound set and mix: the synthesised sounds (`sfx/synth.mjs`, `sfx/music.mjs`, listed in `sfx/LICENSES.md`), the `SFX` and `MUSIC` levels in `src/catalog.ts`, the placement (a sound on the frame of its picture, at most three at once, a cooldown per sound) and the density (about 44 events in 45 s). Existing sounds and levels change only when ian asks. A new sound is made the same way and judged against the pilot 1 mix. `styleCheck` FAILs when a sound file or level of the approved set changed (a hash of the set is recorded in `scripts/soundHash.json`). **Amended (PLAN-VARIETY stage 4):** the sound effects and their mix stay locked. The music beds are an open set: the approved beds (`bed-calm`, `bed-tech`) stay recorded in `scripts/soundHash.json` as they are, and a new bed joins only after ian listens to it (`out/music/`) and approves it, as its own entry; nothing approved is rewritten.
- **B17 Text style (locked).** The caption is a black box (`BLACK`, opacity 0.88, rounded), its text white and the spoken word yellow (`YELLOW`), in Outfit Bold (`FONT_BOLD`); the small labels and kickers are DM Mono (`FONT_MONO`); no other fonts (`src/components/Captions.tsx`, `src/tokens.ts`). `styleCheck` FAILs a literal font name in a video unless it is a registered exception in `src/motionLanguage.ts`.
- **B18 Voice apps.** The narration text is made for every voice app checked in the video's options (all three by default). Each app has its own format: the tags of that app's verified list only, in that app's own syntax, in the export only, never in the story (the rule "voice export"). The apps are the checkboxes of "Video baru" and "Pilihan video"; the panel "3 Suara" shows one block per checked app.
- **B19 Voice export.** Each voice app's export uses only the tags of that app's verified list, in that app's own syntax: Google AI Studio `<...>` (English), VoiceStudio `[pause ...]` and the optional `[laughter]`/`[sigh]`, ElevenLabs `[...]` and `...`. The tags are in the export only, never in the story; matching strips them. A tag not on the list is not written.
- **B20 Khusus: the story comes from the chosen folder, never automatically.** For the kind Khusus the story is taken only when the person presses "Ambil cerita dari folder" for the folder they chose: that button reads that folder's `story.json` alone, checks it like a pasted answer, and keeps it only when it is valid. Nothing is read in the background, no folder is written, and Claude Code never writes to `workspace/`.
- **B21 Variety.** The music bed, the theme and the stage shape of a video are chosen by its kind of fact, and not repeated from the video before. `scripts/styleReport.mjs` lists the last five videos and flags a video that repeats both the bed and the theme of the one before it: a flag, not a failure (ian decides).
- **B16 Musts.** Every video has three musts, decided by ian on 2026-10-28: (1) the small "Intip yuk!" sting right after the hook; (2) the loop-back ending (no mascot, label, pill or voice in the outro; the first and last frames match); (3) a consistent object style and animation (see "The three musts" below). Everything else in this section is a default that a topic may adapt. `styleCheck` FAILs when a must is broken.

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
| lens transition (the dive) | 0.7 to 1.0 s | 0.8 s |
| wipe or slide | 0.4 to 1.0 s | 0.5 and 0.6 s |
| ambient motions | hover period 1.82 s, breathe 2.5 s, blink 3.4 s (src/motion.ts) | the same |
| motion blur | only on a lens, slide, wipe, zoom or pan | none so far |

The plan's first draft gave a camera push 0.8 to 2.5 s; pilot 1's pushes last 5 to 7 s, so the registry takes the measured range.

### The rule log

Every report adds its rows (B14). The date is the day ian asked; a row without a date was asked before the log existed.

| rule | what it says | asked by | when | revision |
| --- | --- | --- | --- | --- |
| B1, B2 | one stage, the lens move | ian (pilot 1) | pilot 1 | 2ef1683 |
| B3, B11 | the mascot is rare: a small sting, at most two reactions, none in the outro | ian | 2026-10-26 | the brief (motion.py) |
| B6 | detail budget: 80 % of the colokan's shapes and parts | ian | 2026-10-28 | 2ef1683 (nature kit, pilot 2) |
| cables | cables and strokes are never rigid (B13) | ian (pilot 1) | pilot 1 | pilot 1 |
| highlights | a highlight lives on its object and has a meaning (round 4, rules 4 and 5) | ian | round 4 | section 8 |
| recesses | a recess shows all its holes (round 4, rule 8) | ian | round 4 | section 8 |
| depth order, holes, joints | the depth order of the kit, pins in holes are clipped, joints are smooth (round 6) | ian 2026-10-26 | round 6 | section 2.5D |
| in-between states | checked as strips (B13) | ian (pilot 1) | pilot 1 | pilot 1 |
| nature kit | the clearOf rule, periodic crests, no gradient or filter in IsoNature (phases 1b and 1c, pilot 2) | ian | pilot 2 (on origin/main, paused) | nature kit |
| B1 to B14 | the Style Bible v1 | ian | 2026-10-28 | 2ef1683, 110319f |
| B7, B12 | the free hook (not "kenapa"); the loop-back outro with no voice, mascot or text | ian | 2026-10-28 | round 2 |
| B15 | the sound set and its mix are approved and locked | ian | 2026-10-28 | round 2 |
| B16 | the three musts: the "Intip yuk!" sting, the loop, the object style and animation | ian | 2026-10-28 | round 2 |
| the registry | the motion language (src/motionLanguage.ts) and the colour rule | ian | 2026-10-28 | round 2 |
| B21 variety | the bed, the theme and the stage of the last five videos; a repeat of bed and theme is a flag | ian (two renders, 2026-10-28) | stage 4 |
| B15 amendment | the music beds are an open set; the sound effects and their mix stay locked | ian (2026-10-28) | stage 4 |
| music beds | four cheerful beds (sunny the default, bounce, glow, curious), measured against bed-calm | ian (2026-10-28) | stage 1 |
| themes | cream, sky, mint, peach; one per video, in the story (night waits for a light label colour) | ian (2026-10-28) | stage 2 |
| stage shapes | slab, round, strip, steps, island; three placements | ian (2026-10-28) | stage 3 |
| seeding set | the aircraft and the seed grains are dictionary marks (`aircraft`, `seed`: `src/components/IsoSeeding.tsx`, neutral tones only, never the nature tones); the growing drop is a water mark (`IsoDrop`). A story label that only names the object (the placeholder `AWAN`) is not pointer text once the object is drawn. The lens inside a cloud shows the claim as small objects: salt draws vapour, silver iodide is an ice-like crystal, the drop grows heavy and falls | hujan buatan video | 2026-10-28 | this video |

Pilots 1 and 2 are the first checked against these rows: pilot 1 passes every must except the outro's voice (its story still has narration in the outro, ian's edit); pilot 2's nature kit is not in a video yet, and its checks run on its own tests.

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

1. Look at `npm run assets-sheet` (`out/assets-sheet.png` and `out/assets-sheet-iso.png`, the 2.5D kit) and the `IsoDemo` / `CardsDemo` / `RigDemo` compositions: **what exists comes first**. The main style is 2.5D isometric (see "2.5D isometrik").
2. Write the scene function in `index.tsx`: one drawing per beat, from `src/design/index.ts`. The beat gives you `beat.text`, `beat.headline`, `beat.kicker`, `beat.narration`, `beat.words`, `beat.dur`, `beat.scene.items`, and the story gives `claims` with sources.
3. Check in Studio with `layoutDebug` on; fix what the layout manager reports. Run `npm run check && npm test`.
4. In klipian (/remotion page) choose **Komposisi → your video**; stills, render, Clips and upload work as for the template. Render time matters: say it in your report.

Never change the words of the story: if a sentence is wrong or too long, tell ian and change it in klipian (the fact gate must see it).

---------------------------------------------------------------------------------------------------------------------------------------

## 1. The frame, the palette, the meaning of colours

- 1080 × 1920, 30 fps. Everything is positioned in video pixels (x right, y down). `import { FRAME, SAFE } from "../../src/design/index.ts"`.
- **Safe area** (the Shorts interface covers the bottom 15 % and the right 12 %): `SAFE = { left: 60, right: 950, top: 120, bottom: 1632 }`. Text, the mascot, people and badges stay inside.
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
