# VoiceStudio narration export: valid tags, pauses and a short description (plan for klipian eksekusi, approved by ian)

Written by klipian motion (planning only). It follows `PLAN-VOICE-GOOGLE.md` (do that first; this one reuses its structure: a script block, a short description block, a status note, tests). Order: after PLAN-VOICE-GOOGLE.md.

## What the VoiceStudio repo says (read 2026-10-28 from https://github.com/debpalash/voicestudio: README, docs/expressive-speech.md, docs/voice-design.md, docs/languages.md, docs/engines/omnivoice.md, and the upstream k2-fsa/OmniVoice README)
Verified from the docs (the parser code for pauses and long-form was not read; treat those two as "from the docs"):
1. **Inline tags use square brackets.** The default engine (OmniVoice) knows exactly 13: `[laughter]` `[sigh]` `[confirmation-en]` `[question-en]` `[question-ah]` `[question-oh]` `[question-ei]` `[question-yi]` `[surprise-ah]` `[surprise-oh]` `[surprise-wa]` `[surprise-yo]` `[dissatisfaction-hnn]`. There is **no `[breath]`, no whisper tag, no emotion tag** (`[happy]`, `[excited]` do not exist). **An unknown tag is not stripped: it is read aloud as text.** So no angle-bracket Google tags and no invented tags, ever.
2. **Pauses (app level, all engines):** `[pause]` (350 ms), `[pause 500ms]`, `[pause 1s]`, up to 10 s.
3. **Description (voice design) is a separate field**, comma separated, case-insensitive, **one attribute per category**: gender `male`/`female`; age `child`, `teenager`, `young adult`, `middle-aged`, `elderly`; pitch `very low pitch`, `low pitch`, `moderate pitch`, `high pitch`, `very high pitch`; style: only `whisper`; accents only for English text and dialects only for Chinese text (not for Indonesian). **Emotion is not in the list.** Upstream says voice design is trained on Chinese and English data only: **its effect on Indonesian text is unverified**.
4. **The reference clip carries the delivery** ("the most reliable expressive control in the app"), more than any text. Indonesian is in the language table.
5. Tags such as `[question-ah]`, `[surprise-wa]` come from Mandarin data: **unverified for Indonesian**. Only `[laughter]` and `[sigh]` are used by default.

## The export (`klipian/motion.py`, `narration_export` with `target == "voicestudio"`)
Keep the other two targets unchanged. For VoiceStudio add:
- `script`: the narration in parts as today (the "Bagian N (sekitar X detik)" header lines stay as a marker for the person, with the same reminder to remove them), with **`[pause 500ms]` between two beats** and **`[pause 1s]` once, before the verdict or the last tip** if there is one. No other tag by default.
- Optional expression: **at most two tags in the whole video, only `[laughter]` or `[sigh]`**, and only when the story carries a clear place (a sentence that starts with Tapi/Namun/Padahal after a surprising result: `[sigh]` is not placed automatically; leave the optional tags **off by default** and offer a checkbox "tambah [laughter]/[sigh]" in the panel, so ian chooses). Never inside a word, never after the last sentence.
- `style` (the short description, one line, only valid values): default `female, young adult, moderate pitch` (the gender is ian's choice: two selects "Suara: perempuan/laki-laki" and "Umur" in the panel, defaults female and young adult; pitch default moderate; a `whisper` checkbox is **not** offered, because whisper would apply to the whole video).
- A status note (Indonesian): "Tag memakai kurung siku dan hanya dari daftar VoiceStudio (diperiksa 28 Okt 2026). Nada paling ditentukan oleh klip suara referensi. Belum terbukti untuk bahasa Indonesia: kolom deskripsi dan tag selain [laughter] dan [sigh]. Coba dulu tanpa tag."
- The export text for Copy and Download: the script block and the description block with labels; the header lines stay.
- `strip_tags()` (from the Google plan) also strips `[pause ...]`, `[laughter]`, `[sigh]` and the "Bagian N" lines before any alignment, with a test that the stripped script equals the story's narration.

## Tests (selftest, no real service, never ian's workspace)
- Every `[...]` tag in the VoiceStudio script is `[pause]`-family or one of the 13 tags; none is outside the list; at most two expression tags; the optional ones are absent by default.
- The description uses only allowed values, one per category.
- The ElevenLabs and Google exports are unchanged by this change.

## Limits
Same as the Google plan: only `klipian/motion.py`, `klipian/selftest.py`, `ui/remotion.html`, `ui/js/remotion/*`, `ui/css/remotion.css` (and the skill file for the VoiceStudio line); no API key, no service call, nothing downloaded; do not write to `workspace/`; do not restart port 5177 while edits are half done; commit locally, do NOT push. Add a rule to `DESIGN.md` ("voice export": tags from the target's verified list only, in the target's own syntax).

## Not in this round
The reference clip workflow (ian's own sampling work), long-form tags (`[slow]`, `[emphasis]`, `[voice:NAME]`, for Audiobook and Stories only, not the Voice page), and any other engine's tags (CosyVoice, VoxCPM2, IndexTTS2).
