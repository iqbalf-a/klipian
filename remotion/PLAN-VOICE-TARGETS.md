# Voice apps as checkboxes: the narration is made in every checked format (plan for klipian eksekusi, approved by ian)

Written by klipian motion (planning only), from ian's instruction (2026-10-28): in "Video baru" the three voice apps become **checkboxes, not a dropdown; all three checked by default**; a checked app means the narration text is made in that app's own format. The three formats are the plans `PLAN-VOICE-GOOGLE.md` (sent), `PLAN-VOICE-VOICESTUDIO.md` (draft) and an ElevenLabs plan (to be written). This plan changes only the **choice** and where the formats are shown; do it **after** the Google plan has landed (it rewrites the same panel), and before or together with the other two formats.

## The option
- `options.voiceTarget` (one value) becomes **`options.voiceTargets`: a list**, any non-empty subset of `voicestudio`, `elevenlabs`, `googleai`. **Default: all three.** An empty list is refused ("pilih minimal satu aplikasi suara").
- **Migration (no data lost):** a project that has the old `voiceTarget` gets `voiceTargets` = all three (the old single choice only meant "which text to show first"; keep it as `voiceTargetFirst`, used to open that block first). `normalize_options` accepts the old key and the new key; the old key is never written again. A test with an old-style project.
- The brief's options line ("Target voice app: ...") lists every checked app ("Target voice apps: VoiceStudio, ElevenLabs, Google AI Studio (klipian writes the narration text in each format; the voices are made outside klipian)"). The fix message and the revise brief carry it too. Selftest: the brief for one, two and three checked apps.

## The dialog and the project options (`ui/js/remotion/page.js`, `ui/remotion.html`, `ui/css/remotion.css`)
- "Video baru" and the project's "Pilihan video": a group **"Aplikasi suara"** with **three checkboxes** (VoiceStudio, ElevenLabs, Google AI Studio), all checked, each with one short line of what its format adds (VoiceStudio: jeda dan tag [laughter]/[sigh]; ElevenLabs: tag ekspresi dan jeda; Google AI Studio: tag ekspresi dan deskripsi gaya). Same style as the existing "Loop" and "Intip yuk!" checkboxes. Unchecking the last one is blocked with the message above.

## The narration panel in "3 Suara"
- The dropdown is replaced by **one block per checked app, in the order VoiceStudio, ElevenLabs, Google AI Studio** (the `voiceTargetFirst` one first), each block collapsed with a compact bordered header (the app name, its status line and its total time), opened one at a time or all (a small "Buka semua" control). **Muat naskah** loads all checked apps at once (one call per app or one call returning all; the server endpoint `/api/motion/narration` accepts a list or is called per app, keep it simple). Each block has its own **Salin** and **Unduh .txt**, and one **Unduh semua** (a single file with the three, or three files: eksekusi chooses the simpler). The select-reset bug of `PLAN-VOICE-GOOGLE.md` disappears with the dropdown; keep its test (a loaded block never changes its label).
- The three blocks always show the **status note** of their format (what is verified in the official docs and what is not).

## The skill (`.claude/skills/klipian-video/SKILL.md`)
Claude Code prints the narration for **every checked app** (read the project's `options.voiceTargets` from the brief), each in its format, and says that the same texts are in the panel "3 Suara".

## Tests (selftest, no real service, never ian's workspace)
Default options are all three; an empty list is refused; the old `voiceTarget` migrates; the brief text for one, two and three apps; the narration endpoint for each app returns its own format; the exports of apps that are not checked are not shown. The page test (if any): three checkboxes, all checked by default.

## Limits
Only `klipian/motion.py`, `klipian/server.py` (only if the endpoint changes), `klipian/selftest.py`, `ui/remotion.html`, `ui/js/remotion/*`, `ui/css/remotion.css`, and the skill file. No API key, no service call, nothing downloaded; do not write to `workspace/`; do not restart port 5177 while edits are half done; commit locally, do NOT push. Add the rule to `DESIGN.md` ("voice apps: all three by default, the format of each app is its own").
