# /remotion step 2 Brief: a second copy button with the short `-create` command

Plan session, 2026-11-04. ian: step 2 should offer two copy buttons: (1) the full brief as it is now, (2) a short command such as `-create [2.5d|2d|teks|-] [durasi] [loop on] [intip on] [suara default all three] "topik"`. The short button only works when the `-create` skill is installed. He chose that the command works **both locally and in the cloud**.

## The command (one spec, used by the page, the CLI and the skill)

```
-create [2.5d|iso|2d|teks] [30|45|60] [noloop] [nointip] [suara=voicestudio,googleai,elevenlabs] [musik=<id>] [catatan="..."] "<topik>"
```
- Every token before the quoted topic is optional and may come in any order. The topic is the last quoted text. An unquoted topic, as today (`-create gurita punya tiga jantung`, `-create 2d gurita ...`), must still work.
- Look: missing → the agent chooses from the topic (B28, as today). `2.5d` and `iso` both mean the iso look.
- Duration: missing → 60.
- Loop and "Intip yuk!" are on unless the command has `noloop` / `nointip`.
- Voice apps: missing → all three.
- `musik=`: one of `motion.MUSIC_TRACKS` keys or `auto`; missing → the default.
- `catatan=`: the notes for the AI; missing → none.
- The page writes only what differs from these defaults, plus the duration always. Example for a default 45 s project: `-create 45 "fakta seru tentang cegukan"`.

## Changes

1. **`klipian/motion_brief_cli.py`**: switch to `argparse` (stdlib).
   - Flags: `--look iso|2d|text`, `--duration 30|45|60`, `--no-loop`, `--no-sting`, `--voice a,b`, `--music id`, `--notes text`.
   - Build the options through `motion.normalize_options`, so a wrong value is refused with the same message as the page.
   - `brief_for(topic, look=None, **opts)` keeps working with only `(topic, look)`, as selftest:6123 uses it.
2. **`klipian/motion_brief.py`**: add `short_command(p) -> str`, built from the project (`p["topic"]`, `p["duration"]`, `options_of(p)`, `p.get("look")`). It emits the duration always and every other token only when it differs from the default. Quote the topic and the notes, replacing a `"` inside them with `'`.
3. **`klipian/server.py` `_get_motion_brief`** (line 800): for `kind=main` the reply also carries `"short": short_command(p)` and `"createSkill": (repo/.claude/skills/create/SKILL.md).is_file()`. No new endpoint. The prefetch already caches this reply, so the copy click stays instant.
4. **`ui/js/remotion/page-steps-1.js` `bodyBrief`**:
   - Two buttons: **"Salin brief lengkap"** (`btn main`, the current `rmCopyBrief`, unchanged) and **"Salin perintah -create"** (`btn`, new `data-act="rmCopyShort"`).
   - Under them, the command in a `<code class="rm-cmd">` so ian sees it before copying.
   - When `createSkill` is false: the short button is `disabled` with the hint "Perlu skill -create (.claude/skills/create) di folder klipian."
   - Copying the short command counts as the brief being copied: call the same `afterBriefCopied`.
   - Hint text: "Brief lengkap: tempel ke AI mana pun. Perintah -create: tempel ke Claude Code (lokal di folder klipian, atau sesi cloud); ia membuat videonya dan menyimpannya di main. Lalu git pull dan lanjut ke langkah 3."
   - `/workspace` button style; the `downloadBrief` button stays.
5. **`.claude/skills/create/SKILL.md`**:
   - **Parse** the tokens as in the spec above (description + heading `# -create [options] <topic>`). Pass them to `python3 -m klipian.motion_brief_cli` as the flags of change 1. Keep the safety stop (medical, financial, dangerous).
   - **Where it runs:**
     - *Cloud* (no `workspace/` folder at the repo root): exactly as today (`git checkout -q --detach origin/main`, keep the line, the selftest looks for it).
     - *Local* (`workspace/` exists, i.e. ian's own folder): **never** checkout or switch branches, stash, or reset in ian's checkout. Instead: `git fetch origin`, then `git worktree add --detach "<tmp>/klipian-create-<slug>" origin/main`. Work, commit and push from there (step 4, same rules). Run `npm ci` in its `remotion/` (node_modules is not shared). Then `git worktree remove --force` that folder, also when a step failed.
   - **Answer:** line 6 for a local run becomes "sudah di main; git pull, lalu di /remotion langkah 3 pilih folder remotion/videos/<slug>".
   - Keep every string selftest.py:6141–6144 checks, or update those checks in the same commit when a string had to change.
6. **`CLAUDE.md`** (`-create` paragraph): name the new tokens in one sentence, and say it runs locally too (worktree, ian's checkout untouched). `-create-cloud` stays unchanged.
7. **Selftest** (next to selftest.py:6122):
   - `brief_for` with `duration=45, loop=False` puts "about 45 seconds" and "Loop: no" in the brief.
   - A wrong `--voice` value is refused.
   - `short_command` on a default 45 s project is exactly `-create 45 "<topic>"`, and with loop off + music `neon` it contains `noloop` and `musik=neon`.

## Don't
- Don't change the full brief text or the other steps.
- Don't touch `-create-cloud` or ian's `workspace/`.
- Don't run the real `-create` (it pushes to main). Prove the local path by reading the skill and dry-running its git commands in a throwaway clone, not in ian's checkout.

## Verify
- `python -m klipian.selftest` and `node tests/*.test.js` pass.
- `python -m klipian.motion_brief_cli --duration 45 --no-loop --voice googleai "tes"` prints a 45 s brief with loop no and only Google AI Studio.
- On a 5178 copy with a ZZTEST motion project: step 2 shows both buttons and the command. The short button copies it and the step moves on, as with the full brief. Renaming `.claude/skills/create` in that copy disables the button with the hint.
- Send the Plan session a screenshot of step 2 and the diff summary. Commit only the touched files; don't push.
