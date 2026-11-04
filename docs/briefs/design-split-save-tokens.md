# DESIGN.md: read less per video (rule log out, iso sections apart)

Plan session, 2026-11-05. ian chose "Usul 2 saja": cut what a video session reads, without changing any rule. Run this AFTER `motion-short-create-command.md` is committed, because both touch `klipian/motion_brief.py` and the skills.

## Context
Every video session reads all of `remotion/DESIGN.md` (77 k characters, about 19 k tokens), as the brief's step 4 says (`motion_brief.py:312`: "section 0b and every rule B1 up to the last one"). Two parts of it are not needed to build a video:
- **The rule log** (`### The rule log`, line ~152, about 9.5 k characters). It is history: who asked for which rule and when. The rules themselves are already in "The rules (Style Bible v1)".
- **The iso-only sections** (about 14 k characters): `## 2.5D isometrik`, `### Depth order, holes and joints`, `## Nature kit`, `## 4. 3D objects`, `## 5. Cables`. A 2d or text video (B28) never uses them.

Expected saving: about 31 % less to read for a 2d or text video, about 12 % for an iso video. The brief itself (±38 k) is unchanged.

(Usul 1, "stable rules first, topic last", was dropped. Each Claude Code session starts with a different context (git status, memory), so the prompt cache does not carry over between sessions.)

## Changes
1. **`remotion/docs/RULE-LOG.md`** (new): move the whole `### The rule log` section there, word for word, under a title line and one sentence ("History of DESIGN.md rules: who asked and when. Not needed to build a video."). In DESIGN.md, leave one line in its place: "The rule log (who asked for each rule, and when) is in `docs/RULE-LOG.md`; add a row there with every new rule (B14)." Update rule B14 and any text that says to add rows to the log, so they point to the new file. The memory rule "each motion revision adds its rule to DESIGN.md" still holds: the rule goes into DESIGN.md, and its log row into RULE-LOG.md.
2. **`remotion/DESIGN-iso.md`** (new): move the five iso sections above, word for word and in the same order, with a title line: "DESIGN-iso.md: the 2.5D iso look (B28 look iso). Read with DESIGN.md for an iso video only." In DESIGN.md, leave one line where they were: "The 2.5D iso kit, depth order, nature kit, 3D objects and cables are in `DESIGN-iso.md` (look iso only)." Keep a rule (B-numbered) in DESIGN.md even when it is about iso. Only these whole reference sections move.
3. **`klipian/motion_brief.py`**: the reading line of step 4 (line 312) and the iso look text (line 122) say what to read per look:
   - iso: `remotion/DESIGN.md` + `remotion/DESIGN-iso.md`
   - 2d / text: `remotion/DESIGN.md` only, and "do not read DESIGN-iso.md or docs/RULE-LOG.md"
   - Look not forced (the agent chooses): read DESIGN.md first, choose the look, then DESIGN-iso.md only if it is iso.

   Update the other spots that name a moved section the same way (`grep -n "DESIGN" klipian/motion_brief.py .claude/skills/*/SKILL.md remotion/README.md`).
4. **References and tests**: grep for every string checked in DESIGN.md (`klipian/selftest.py`, `remotion/tests/design.test.ts`, `sets.test.ts`, `style.test.ts`, `scripts/styleCheck.mjs`, `scripts/styleReport.mjs`, the per-video tests). Where a check reads a sentence that moved, make it read the file the sentence now lives in. Don't weaken any check. Fix in-file links like "see section 5" that now point to the other file.
5. Brief length cap: the selftest keeps every brief under 40 000 characters; it must still pass.

## Don't
- Don't change, merge or reword any rule. This is a move, not an edit. Check that no text is lost: the lines of DESIGN.md before = the lines of DESIGN.md + DESIGN-iso.md + RULE-LOG.md after, minus the 2–3 pointer lines and titles (diff the sorted lines).
- Don't touch any video folder.

## Verify
- `python -m klipian.selftest`, `node tests/*.test.js`, and in `remotion/`: `npm run check` and `npm test` all pass.
- `python -m klipian.motion_brief_cli --look 2d "tes"`: the brief does not tell the agent to read DESIGN-iso.md. `--look iso`: it does.
- Report back to the Plan session with the character counts of DESIGN.md before and after, and of the two new files. Commit only the touched files; don't push.
