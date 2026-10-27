# The klipian intip Style Bible v1 (plan for klipian eksekusi, approved by ian)

Written by klipian motion (planning only). Decision from ian (2026-10-28): the channel is a **mix**: any everyday fact, whether it is an object that is dissected (the colokan), a process (how rain happens), a cause (why it happens) or a myth check, **and the animation model must be consistent**. The "bedah" territory of the reference channel "Kita Bedah" is not the niche (they are more detailed there); our difference is the **one system, the sources and the loop**. Pilot 1 (colokan) is the first full example; pilot 2 (rain) is paused (the nature kit stays in the repo); pilot 3 (charger) becomes the first test of this bible.

The bible is not new art. It **writes down, as rules that tests can check, what pilot 1 already does**, and adds four things that make any topic look like the same channel. Everything goes into `remotion/DESIGN.md` as a new top section "0b. The klipian intip formula (Style Bible v1)" that the other sections refer to, plus a checker.

## The five locks

### 1. The diorama stage (one base shape for every topic)
Every video is a **piece of the world on an isometric slab**: a block of wall on a shelf (colokan), a sea block beside a land block (rain), a desk corner (charger), a kitchen counter (rice cooker). Rules:
- one **stage block** per video, sitting on the `Brand` background with its yellow spot; the block has a visible thickness (two side faces with the three tones) and a base shadow that is only a flat darker tone;
- the camera is the 2.5D iso camera of the kit (axes, `VIEW = [1,1,1]`, the tone rule: top light, +y mid, +x dark, light from the top left); no other angle; the hero is 60 to 70% of the screen width;
- the **lens** (the "Intip" move) is always the same: the camera goes in, a circle grows from the part, inside it is the lab background (dark, grid), and on the way out the circle shrinks back to the part;
- a stage never has people (except when the story truly needs one), never a mascot parked in a corner.

### 2. The visual dictionary (one mark for one physical thing, across topics)
A table in `DESIGN.md`, used by every component, each row with the exact drawing recipe (shape, colour tokens, motion) and the component that draws it:
| thing | mark |
| --- | --- |
| electric current | yellow dashes flowing along the path |
| heat | red/orange wavy lines rising, plus a warm glow ring on the hot part |
| danger / hot spot | red core with a pulsing ring (only for danger) |
| water (liquid) | blue layers and streaks, three tones |
| vapour / steam | pale blue curving wisps with small bubbles, rising |
| air / wind | white curving streaks |
| sound / vibration | thin concentric arcs |
| light / radiation | yellow rays |
| cold / ice | pale cyan crystals and a blue-white glow (new, define the exact tones) |
| a force or a flow direction | a black arrow with a round tail |
Every new thing a topic needs is **added to the dictionary first** (with its recipe and a tile on the sheet), then used. A video may not invent a private mark for a thing that has a row.

### 3. One hero asset per video (the detail budget)
- Each video has **one hero asset** that reaches the **detail budget** (measured with `scripts/detailBudget.mjs`: at least 80% of the colokan's number of shapes, a part count and a rim/layer list), and **at most two supporting assets** that are simple and flat (sea and land in a rain video are supporting; the cloud and the rain are the hero).
- The budget metric is corrected for nature and household props: shapes and distinct parts count; "tone regions" stay informative only (a three-tone material cannot have more than three tones). State the numbers in each report.
- A new asset goes into the library first (a tile on a sheet, a catalog entry, a test), and the library page is checked before building a new one (the report says which assets were reused and how many are new). **At most three new assets per video** (one hero, two supporting).

### 4. One beat formula for every kind of fact
`hook` (an everyday question: "Kenapa ...?" or "Benarkah ...?", 3 s) -> `sting` ("Intip yuk!", a small mascot, 1 s) -> **explain** (two or three beats, each one claim) -> **look closer** (the lens or a macro, only if there is something inside to see; else a zoom to the key part) -> **result** (what that causes, with the source card) -> **tip** or **verdict** -> `outro` (the loop-back). The kinds already exist in the schema (`hook`, `sting`, `lens`, `normal`, `loose`, `result`, `tips`, `outro`). Per type of fact only the content of the explain beats changes:
- *object* (colokan, charger): the explain beats open it up (the lens);
- *process* (rain): the explain beats follow the flow around the stage (the camera follows the particles);
- *cause* ("why does X happen"): a chain of cause and effect arrows;
- *myth check* ("Benarkah ...?"): the same, ending with a **verdict stamp** (MITOS / FAKTA / SEBAGIAN) drawn as a pill on the stage, color-coded (no new color: black on yellow for FAKTA, white on black for MITOS, grey for SEBAGIAN).
Durations are the existing 30, 45 and 60 s; the sum must be exact.

### 5. The rules that every video already obeys (collected in one place)
The bible links, not repeats, the rules already in `DESIGN.md` and adds a **one-page checklist** (see "The checker" below): the tone rule; flat tones only; meaning colours; the nature colours only for nature; two text layers (kicker + headline, karaoke caption), at most 6 words on screen; sources and a fact check for every claim; mascot small (the sting), at most 2 reactions, none in the outro; **the loop-back ending**; a sound on every movement with at most 3 at once; depth order; highlights live on their object and have a meaning; cables and strokes never rigid; parts that go into holes are clipped; joints smooth; check in-between states; every revision adds its rule.

## The checker (so the bible can be tested)
- `scripts/styleCheck.mjs <slug>` (and a test hook in `tests/`): for a video folder it checks what can be checked by machine: the beat kinds follow the formula (hook first, sting second, outro last, the kinds allowed); the outro has no mascot and no text; the first and last frames match (reuse the loop test); every screen text is from the story; at most one mascot sting and at most two reactions; the stage block exists and the hero is 60 to 70% of the width at the main shot; the dictionary marks used by the video are the ones in the table (list the marks drawn from a registry); the number of new assets is at most three; the sources: every claim in the story has at least one source; the detail budget of the hero asset is reached.
- A **human checklist** for the rest (ian's eight quality-bar points + "does it look like the same channel as pilot 1?"), printed by the script at the end.
- Run it for pilot 1 (colokan) now, as the first proof: report what it passes and what it flags.

## What eksekusi does in this round
1. Write the new top section in `remotion/DESIGN.md` ("The klipian intip formula (Style Bible v1)") with the five locks, the dictionary table, the formula, the detail-budget corrections and the checklist. Keep it short and checkable. Update the table of contents and the "Before you hand a video back" section to point to it.
2. Implement the **dictionary registry** in code (`src/dictionary.ts`: a list of `{ id, thing, mark, component }` and a test that every component that draws a mark is in it), and add tiles on the asset sheets for the marks that exist (current, heat, danger, water, vapour, air, sound, light, force arrow); add the missing ones only as spec rows marked "to build" (do not draw cold/ice or sound now).
3. Implement `scripts/styleCheck.mjs` and run it on pilot 1.
4. Correct the detail-budget script (`scripts/detailBudget.mjs`) as described (shapes and parts count; tone regions informational), and re-measure the colokan, the cloud/sea/land and the trees with it.
5. Report with: the new `DESIGN.md` section; the styleCheck output for pilot 1; the dictionary registry; the detail-budget table; any rule from pilot 1 that the bible exposed as missing. **Do not draw new assets and do not start pilot 3 in this round.**
6. Limits: only your own paths under `remotion/`; no Python/UI/server/workspace/secrets; nothing downloaded; `npm run check && npm test` green; commit locally; do NOT push; list the new rules added.

## After the bible: pilot 3 (the charger) is its first test
ian then decides the charger story; the plan for it will name the one hero asset (the charger) and at most two supporting ones, and the report ends with the styleCheck output.

## For ian
Two decisions to confirm, both cheap to change later: (1) the verdict stamp colours (black on yellow / white on black / grey) and the wording MITOS / FAKTA / SEBAGIAN; (2) "at most three new assets per video" as the cost limit. If you want a different number, tell me.
