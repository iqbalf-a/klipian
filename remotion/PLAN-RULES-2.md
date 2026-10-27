# Style Bible v1, round 2: make the pipeline follow the rules (plan for klipian eksekusi, approved by ian)

Written by klipian motion (planning only). Round 1 (`2ef1683`, `110319f`) wrote the bible (`DESIGN.md` section 0b, the dictionary, `styleCheck`). But the rules only live in the docs and the checker. **The AI brief that klipian gives to Claude/ChatGPT still teaches the old formula**, so every new story starts out wrong and has to be fixed by hand. This round makes the pipeline carry the rules, so a new story, a new video folder and a new report are consistent from the first step. It stays small: no new assets, no new artwork.

## What conflicts today (read in `klipian/motion.py`, lines about 740 to 815)
- `CHANNEL_RULES` says "a short outro with the logo" and "the hook is one question that starts with kenapa" (a hook rule that is too narrow: ian, 2026-10-28); `COMPOSITION` says "The 'Intip yuk!' beat: a **big mascot** in the middle (w about 560)... The **outro has the mascot again**" and "the mascot is rare: ... the sting **and the outro**"; `STRUCTURE` describes the outro as "logo and klipian intip" (4 s); the task step 1 asks only for "kenapa...".
- The bible (B3, B7 to B12) says: a **small** sting mascot (about 200 to 240 px, no veil), **no mascot, no text, no voice in the outro (loop-back)**, a free hook (any attention-grabbing everyday opening: a question, a surprising statement, a myth), **the "Intip yuk!" sting right after it**, one hero object per video, the verdict (MITOS / FAKTA / SEBAGIAN) for a myth check.
- `src/schema.ts` does not know the loop-back outro rules, except that an outro beat may have an empty narration (round 3). `tests/` have no template for a new video.

## A. Align the AI brief with the bible (Python text, `klipian/motion.py`)
Only the text blocks and the structure table; do not change the brief's mechanics, the catalogue export or the answer format.
1. **Hook**: "an everyday hook of about 3 seconds that makes people curious: it may be a question ('Kenapa ...?', 'Benarkah ...?'), a surprising statement or a myth; it does **not** have to start with 'kenapa'". The two things that are **required** in every video (ian, 2026-10-28): **the 'Intip yuk!' sting right after the hook, and the loop** (the loop-back ending).
2. **Sting**: "a small `mascot` (w about 220) and a small `pill` 'Intip yuk!' in the caption zone, no veil; the picture behind it keeps moving".
3. **Outro**: "a loop-back beat: **no mascot, no label, no pill, no voice** (the narration is empty), 2 to 4 s; the scene is the same as the first beat's scene so the video loops" (give the `STRUCTURE` rows an outro of "loop-back" and keep the totals equal to 30, 45 and 60 s).
4. **Mascot rule**: "the mascot is for the 'Intip yuk!' beat, plus at most 2 short reactions in between; **the outro has none**".
5. **Kinds of fact**: a short paragraph for the brief: an object (open it with the lens), a process (follow the flow), a cause (a chain of arrows), a myth check (end with the verdict stated in the `result` or `tips` beat's text: `MITOS`, `FAKTA` or `SEBAGIAN`; the stamp drawing is not built yet, so it is text only).
6. **One hero**: "choose one main object or scene for the whole video; the other things on screen are simple supporting elements".
7. Keep every existing safety rule (no health or finance topics, never teach anything dangerous).
8. The revision brief and the fix message (`build_revise_brief`, `build_fix_message`) get the same wording where they repeat these rules.
9. Test (`klipian/selftest.py` or the existing selftest style): the brief text for 30, 45 and 60 s contains the new phrases (loop-back, "no mascot" for the outro, the small sting, "Intip yuk!" required, no "must start with kenapa") and none of the old ("The outro has the mascot again", "a short outro with the logo"). Do not make a real AI call (none is needed).

10. Also reword the bible itself in `DESIGN.md`: **B7** (the hook is "an everyday hook of about 3 s", a question or a statement) and a new **B16 Musts**: every video has the **"Intip yuk!" sting right after the hook** and **the loop-back ending**; everything else in the formula is a default that a topic may adapt. `styleCheck` flags a missing sting or a missing loop as **FAIL** (not just a flag).

## B. Make the validator carry the rules (`remotion/src/schema.ts`), as warnings first
- Add **bible warnings** to the validation result (a new `warnings` list, shown in the Storyboard, **not blocking**, so pilot 1's story stays valid): the sting's mascot is wider than 260; the outro beat has a `mascot`, `label` or `pill` item or a non-empty narration; there is **no `sting` beat right after the hook with the text "Intip yuk!"** (required); there is no loop-back outro (required); more than one `lens` beat; no `source` card item in a `result` beat; a screen text of more than six words (already an error: keep).
- A story written by the old brief therefore still passes; the warnings tell ian what the bible would change. Add `bible: 1` to the story format as an optional marker: when a story sets it (the new brief asks the AI to), the warnings become **errors**. Tests for both modes; pilot 1's `story.json` (no marker) must still validate with warnings listed.
- Show the warnings in the `/remotion` Storyboard (a small list under the title; read how `needs` and the errors are shown in `ui/js/remotion/page.js` and reuse that style: a compact bordered note, no pill buttons, see the klipian UI style). Keep the change small; if it needs more than a few lines of UI, report that and leave the UI for a later round.

## C. A new video starts correct (`remotion/scripts/new-video.mjs`)
- `npm run new-video <slug> <story.json>` already scaffolds `index.tsx`, `sfx.ts`, `story.json`, `meta.json`. Also generate:
  - a `plan.ts` skeleton with the formula (hook, sting, explain, look closer, result, tip, loop-back outro), the loop weight and the state blend, copied from pilot 1's structure without its object code;
  - a `tests/<slug>.test.ts` skeleton: layout `conflicts()` every 3 frames, text from the story, sfx on frames, loop equality, `styleCheck` on the folder;
  - a printed **library checklist** before you start: the assets in the catalog by category with their detail numbers and "used by", and the dictionary marks (so the author reuses first, at most three new assets: B5).
- The generated files must compile (`npm run check`) and pass their own tests on an empty scene (a fixture story), and pilot 1 must be untouched.

## D. The report is one command (`remotion/scripts/styleReport.mjs`, `npm run style-report <slug>`)
Automate the three "needs a render" lines of `styleCheck` so a video cannot be reported without them:
- the first and last frames match (render those two frames with `scripts/frames.mjs`, PSNR/SSIM);
- the hero is 60 to 70% of the screen width at the main shot (measure the hero's bounding box on that still: the video declares it in `plan.ts` as `HERO_BOX_AT = (t) => box`, a pure function; the test checks the declared box, the report measures the still);
- the detail budget of the hero (reuse `scripts/detailBudget.mjs` on the hero's tile);
- then write `out/<slug>/style-report.md` with the pass/flag table, the numbers, the contact sheet (stills of every beat) and the human checklist, so ian reads one file.
Run it on pilot 1 and fix what it exposes (report anything that needs ian).

## E. The rule log (`DESIGN.md`, a short section "Rule log")
A table that lists every rule with: id (B1..., or the section it is in), the date, who asked (ian, plus the round), and the revision that caused it. Seed it from pilots 1 and 2 (the mascot, the loop, the cable, the recess, highlights, depth order, pins in holes, joints, in-between states, the detail budget, the nature kit rules, the style bible). From now on each report must add its rows (the standing rule B14).

**Sound is approved and locked (ian, 2026-10-28: "the sound effects and all the sounds are perfect").** Add it to the rule log and to the bible as rule B15: the synthesised sound set (`sfx/synth.mjs`, `sfx/music.mjs`), the mix levels (`SFX` and `MUSIC` tables in `src/catalog.ts`), the "sound on the frame of its picture, at most three at once, a cooldown per sound" placement, and the density of pilot 1 (about 44 events in 45 s) are the **reference**. Existing sounds and levels change only when ian asks; new sounds are made the same way (synthesised, CC0, listed in `sfx/LICENSES.md`) and are judged against the pilot 1 mix. `styleCheck` gets one more check: no sound file or level of the approved set was changed (compare a hash of the set recorded in the bible).

## Not in this round (to keep it small)
The verdict stamp component, the cold/ice and sound marks, any new artwork, pilot 3. They are specs in the bible and are built when a story needs them.

## Verify and report
- `npm run check && npm test` (and the Python selftest for the brief, if there is a cheap way to run only that test; do not touch ian's real workspace or call any real service).
- Report with: the new brief text diff (before | after), the validator warnings on pilot 1's story, the scaffold output on a fixture, `style-report` output for pilot 1, the rule log, and the new rules added.
- Limits: you may edit Python (`klipian/motion.py`, the selftest) and `ui/` only for this brief/warning work and only the lines named above; otherwise only `remotion/`. No change to `workspace/`, no secrets, no real API calls, nothing downloaded. Tests must never touch ian's real workspace (use a copy on another port or the existing selftest harness). Commit locally; do NOT push. The server on port 5177 should not be restarted while the Python edits are half done: tell ian when the edits are complete.

## For ian
Decided by ian: the hook is **free** (it does not have to start with "kenapa"); the two musts are **"Intip yuk!"** and the **loop**. One decision left: the validator starts with **warnings** (old stories still pass) and becomes strict only for stories with the `bible: 1` marker: OK? If you say yes, the brief the AI sees will already ask for the new formula.
