# /remotion: a "Gaya video" choice (Otomatis / 2.5D isometrik / 2D / Teks) for a new topic

Plan session, 2026-11-05. ian: when making a new topic, offer the video type: 2.5D isometric, 2D, text, or auto. Run this AFTER the DESIGN split task (it touches `motion_brief.py` again).

## Context
B28 has three looks (`motion_brief.LOOKS = ("iso", "2d", "text")`), and `build_brief(p)` / `short_command(p)` already read `p.get("look")`. But the page never sets it: `motion.create()` (motion.py:353) does not store a look, and the form has no field. So every page brief says "the agent chooses", and only `-create 2d ...` typed by hand can force one. The existing "Jenis video" (Khusus / Otomatis, in "Pilihan lain") is a different thing: who builds the video. Name the new field **"Gaya video"** so the two are not confused.

## Changes
1. **Store it as an option.** In `klipian/motion.py`:
   - `DEFAULT_OPTIONS["look"] = "auto"`.
   - `normalize_options` accepts `"auto" | "iso" | "2d" | "text"` and refuses anything else with a message listing the choices, the same way music is validated.
   - Old projects without the key read as `"auto"`.

   This way `create()`, `set_options()` (the "Ubah pilihan video" in step 2) and the brief all get it with no new plumbing.
2. **Brief + command.** `build_brief` and `short_command` take the look from `options_of(p)["look"]` (with `"auto"` → `None`, i.e. the agent chooses). Keep `p.get("look")` working as a fallback, because `motion_brief_cli` passes `look` that way. A forced look gives `2.5d` / `2d` / `teks` in the short command (already mapped in `LOOK_TOKEN`).
3. **Form (`ui/remotion.html`, form `#rmNew`):** in row 2, before Musik, add `<select class="ws-input rm-boxed" data-opt="look">` labelled **"Gaya video"** with:
   - `Otomatis (dipilih sesuai topik)` (auto, selected)
   - `2.5D isometrik`
   - `2D`
   - `Teks`

   One `rm-hint` line under it: "Otomatis: Claude Code memilih gaya yang paling cocok dengan topik (B28)."
4. **`readOptions` / `optionsHTML`** (`ui/js/remotion/page-steps-1.js:45/54`): read and render `data-opt="look"`, so it can also be changed in step 2 "Ubah pilihan video", like music. `optionsSummary` (`steps.js:81`) shows the forced look, e.g. "gaya 2D". Nothing is shown for Otomatis.
5. **Kind Otomatis (template):** the look does not apply there. If `kind` is `otomatis`, the brief ignores it (no error).
6. **Selftest:**
   - Default look is `auto`, and a wrong look is refused.
   - A project with look `2d` gives a brief with only the 2d look rules and `short_command` contains `2d`.
   - `auto` gives the "you choose" text and no look token.
   - `check_briefbuttons` and `check_music` still pass.

## Don't
- No change to the look rules themselves, the skill, or the server routes beyond what the options already carry.
- Don't touch ian's workspace. Test create on a 5178 copy only.

## Verify
- `python -m klipian.selftest`, `node tests/*.test.js` pass.
- On a 5178 copy:
  - Make a ZZTEST topic with Gaya video = Teks. Step 2's command shows `teks`, and the full brief has only the text look rules.
  - Change it to Otomatis in "Ubah pilihan video": the command loses the token.
  - An old project with no look opens without an error.
- Screenshot of the form and step 2 for the Plan session. Commit only the touched files; don't push.
