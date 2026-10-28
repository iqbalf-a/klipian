# ElevenLabs narration export: expression tags, pauses without SSML, the model note (plan for klipian eksekusi)

Written by klipian motion (planning only). Part of the three-format voice work with `PLAN-VOICE-GOOGLE.md`, `PLAN-VOICE-VOICESTUDIO.md` and `PLAN-VOICE-TARGETS.md` (the checkboxes). Today the ElevenLabs export is plain text ("tag jeda Eleven v3 belum diverifikasi, tidak dipakai"). It can now carry real controls.

## What the official docs say (read 2026-10-28; sources: https://elevenlabs.io/docs/overview/capabilities/text-to-speech/best-practices, .../text-to-speech, https://elevenlabs.io/docs/overview/models, .../text-to-speech/eleven-v4)
Caveats: the Eleven v3 page itself returned 404; none of the pages showed a "last updated" date; the pages were read through a summarising tool, so wording not quoted below is not verified word for word.
1. **Tags use square brackets**, placed before or after the text they change: `[whispers] I never knew it could be this way`. Official list (Eleven v4 section): voice-related `[laughs]` `[laughs harder]` `[starts laughing]` `[wheezing]` `[whispers]` `[sighs]` `[exhales]` `[sarcastic]` `[curious]` `[excited]` `[crying]` `[snorts]` `[mischievously]`; sound effects `[gunshot]` `[applause]` `[clapping]` `[explosion]` `[swallows]` `[gulps]`; experimental `[strong X accent]` `[sings]` `[woo]` `[fart]`. **We never use the sound-effect and experimental ones.**
2. **Free-form descriptive tags are allowed**: `[low, gravelly voice]`, `[Quiet, measured narration]`, `[Brief pause]`. The docs advise tags that describe the voice quality clearly.
3. **Which models:** Eleven v4 (`eleven_v4`, recommended) and Eleven v3 follow audio tags; Eleven v4 Turbo and v3 Conversational list "audio tags" too. **Multilingual v2 and Flash v2.5: tag support not stated (unverified).**
4. **Pauses:** `<break time="1.5s" />` (up to 3 s) is **not supported on v4 and v3** ("do not support SSML break tags"); too many breaks in one request make the voice unstable. On v4 and v3 use ellipses `...` (pause and weight), dashes `-`/`--` (short pause, less consistent), the tags `[pause]` `[Brief pause]` `[long pause]` (they appear in the docs' examples; no limit stated) and sentence structure. Capital letters add emphasis.
5. **Indonesian** is listed for v4, v4 Turbo, v3, Multilingual v2 and Flash v2.5 (not Flash v2). **Whether tags stay in English for non-English text is not addressed** (every example uses English tags): write them in English and mark "belum diverifikasi".
6. **The delivery settings live outside the text** (Stability and Similarity on v4; Style and Speed sliders do not exist on v4). **There is no separate style/description field for TTS** (Voice Design makes a new voice from a description: it is not a per-script style). Lower Stability = more expressive and varied; higher = steadier. The models are not deterministic; a `seed` helps.
7. **Descriptive words in the text are spoken** ("she said excitedly" is read aloud): never write them; use tags.
8. **Limits:** 10,000 characters per request on v4, 5,000 on v3: a 45 s video is far below, so the whole narration is one request (no splitting needed). If someone does split, the docs advise the `previous_text`/`next_text` parameters for prosody.
9. Tags "are not perfect yet", land more readily when the voice was trained on that delivery, and can be read as a sound effect.

## The export (`klipian/motion.py`, `narration_export` with `target == "elevenlabs"`)
Keep VoiceStudio and Google as in their own plans. For ElevenLabs return, besides the existing keys: `script` (the one-request text, **no "Bagian N" split**: one block with the whole narration; the per-part time estimate stays in the head line as information), `settings` (a short note, below), `model` (the recommended model line).
- **Between two beats:** `...` at the end of the sentence before (an ellipsis keeps the sentence's own punctuation: replace a final `.` with `...`), **never `<break>`**; `[pause]` only once, before the verdict or the last tip (a "long pause").
- **The hook:** no tag. **The sting "Intip yuk!":** `[whispers]` before it (the same decision as the Google export, so the three apps give the same performance).
- **Expression tags:** at most one per beat and **six in the whole video**, only from the voice-related list above (`[whispers]`, `[curious]`, `[laughs]`, `[sighs]`, `[excited]`, `[exhales]`); defaults: `[curious]` before the hook if it is a question, `[whispers]` on the sting, nothing on explain beats, and on the last tip nothing (the settings note carries the warmth). **Never** a sound-effect or experimental tag; never a descriptive sentence in the text.
- **The settings note** (a short text block under the script, English values with Indonesian labels): "Model: Eleven v4 (Eleven v3 jika v4 tidak ada). Stability: rendah ke sedang (lebih ekspresif); Similarity: sedang. Speed dan Style tidak ada di v4. Uji dulu tanpa tag." Say in the status note that this is a setting in ElevenLabs, not text.
- **The status note** (Indonesian): "Tag memakai kurung siku dan bahasa Inggris, dari daftar resmi ElevenLabs (diperiksa 28 Okt 2026). Jeda dibuat dengan ... dan [pause] karena <break> tidak didukung di Eleven v4 dan v3. Belum diverifikasi: tag pada teks Indonesia, dan dukungan tag di Multilingual v2 dan Flash v2.5."
- `strip_tags()` (from the Google plan) must also strip ElevenLabs tags (`[...]`) and the ellipsis pauses (a trailing `...` returns to `.`) so alignment compares the story's narration: a test with the exported text of a fixture story.

## Tests (selftest, no real service, never ian's workspace)
Every `[...]` in the ElevenLabs script is on the verified voice-related list or `[pause]`; no `<break` anywhere; at most six expression tags; the sting has `[whispers]` before "Intip yuk!"; the script has no "Bagian N" header; the stripped script equals the story's narration; the VoiceStudio and Google exports are unchanged by this change.

## Limits
Only `klipian/motion.py`, `klipian/selftest.py`, `ui/remotion.html`, `ui/js/remotion/*`, `ui/css/remotion.css`, and the skill file. No API key, no call to ElevenLabs, nothing downloaded; do not write to `workspace/`; do not restart port 5177 while edits are half done; commit locally, do NOT push. Add a row to the `DESIGN.md` rule "voice export" (tags only from the target's verified list, in the target's own syntax, in the export only).

## Not in this round
Voice Design, a custom voice, pronunciation dictionaries, IPA, and any call to the ElevenLabs service.
