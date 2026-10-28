# Google AI Studio narration export: script with expressions + a style description (plan for klipian eksekusi)

Written by klipian motion (planning only). Ian (2026-10-28): in panel "3 Suara", choosing **Google AI Studio** and clicking **Muat naskah** must give two things, as in his example: (1) **naskah + ekspresi** (the script with expression tags inside) and (2) **deskripsi** (the style description for the voice). Today `narration_export(story, "googleai")` in `klipian/motion.py` writes only the plain text with `<short pause>` between beats and one fixed style line.

## What the official docs say (read by klipian motion on 2026-10-28, https://ai.google.dev/gemini-api/docs/speech-generation, last updated 2026-10-12)
Verified, verbatim from the page (Gemini 3.8 Flash TTS; Indonesian is supported by 3.8 Flash TTS and 3.8 Flash-Lite TTS):
1. **Inline tags use angle brackets** (`<...>`, "for highest audio quality"), **placed inside the transcript**. For a transcript in a non-English language, **keep the tags in English**.
2. **Recommended vocal tags** (the complete list on the page): `<argh>` `<breath>` `<heavy breath>` `<exhales>` `<cackle>` `<cheer>` `<chuckle>`/`<chuckles>` `<cough>` `<cry>` `<gasp>` `<giggle>` `<groan>` `<growl>` `<grunt>` `<grr>` `<hiss>` `<laugh>`/`<laughter>` `<moan>` `<pant>` `<pff>`/`<phew>` `<scream>` `<shout>` `<shriek>` `<sigh>`/`<sighs>` `<sneeze>` `<snicker>` `<snort>` `<sob>` `<throat-clearing>` `<tsk>` `<whimper>` `<whispers>`/`<whispering>` `<yawn>` `<short pause>` `<long pause>`. The page says "stick to human vocalizations": **no sound-effect tags** (applause, thuds). Whether a name outside the list works is **not stated**: do not use any.
3. **Pauses:** `<short pause>` and `<long pause>` are both verified. Commas, `--` and `...` also give hesitation.
4. **Style (the description) is separate from the text:** sustained delivery (emotion, pace, prosody) goes in `speech_metadata.style`, a **concise** string, with English examples such as "casual, friendly", "high pitch, cheerful and excited inflection", "speaking slowly". Do not put age, gender, names or a permanent accent in it. The page says long "Audio Profile" paragraphs and multi-bullet "Director's Notes" (the format of earlier models) are the most common cause of **voice drift**; it advises a short style, and a custom voice (Voice design) for a persona. It also says: test plain TTS first with an empty style.
5. Not stated by the page: the language of the style string (the examples are English), and whether AI Studio's web page takes the same fields. **Mark both "belum diverifikasi" in the panel.** The older AI Studio format (a long paragraph "Audio Profile / Scene / Director's Notes" before the transcript) is what ian pasted; it still has value for ian's own tries, so offer it as a second, clearly labelled version.

## The export (Python, `klipian/motion.py`, `narration_export` with `target == "googleai"`)
Add to the returned dict (keep every existing key and keep the other two targets unchanged):
- `text` stays the whole text for the Copy/Download buttons, but for Google it now has **two labelled blocks**: `NASKAH + EKSPRESI` and `DESKRIPSI` (short, English), then `DESKRIPSI LENGKAP (gaya AI Studio lama)` as a third, clearly marked optional block.
- New keys: `script` (the script with tags), `style` (the short English description), `styleLong` (the long one in ian's format), `tags` (the list of tags used and where).

**Rules that place the expression, deterministic, no AI call** (by beat `kind` and position; the story's own `narration` stays clean, tags exist only in this export):
1. `<short pause>` between two beats (as now); `<long pause>` only once, before the verdict or the last tip, if the video has one.
2. The **hook**: the hook sentence is followed by `<short pause>` (no expression tag).
3. The **sting** ("Intip yuk!"): `<whispers>` before it, as in ian's example.
4. **At most one expression tag per beat and at most six in the video**; choose from a small default set by beat kind: explain beats none (calm and neutral); a surprising or "myth" result: `<chuckle>` before the "but" sentence (a sentence that starts with Tapi/Namun/Padahal); the last tip: none (warm style). The set may only contain tags from the verified list above; a **unit test fails if any tag is outside the list** and if any tag is a sound effect.
5. The tags are never put inside a word or after the last sentence of the video.
6. **The Match step must ignore tags:** the narration stored in the story has none, but if a person pastes the exported text back anywhere, `import_voice` and the alignment must strip `<...>` first (add a small `strip_tags()` and a test with the exported text of a fixture story: after stripping, equal to the story's narration).

**The style description** (`style`, English, concise, built from the beat kinds, not one fixed line): "friendly, curious and upbeat; playful on the hook, a little hushed on 'Intip yuk!', calm and neutral on the facts, warm and slightly cautious on the tips; medium pace, short natural pauses at sentence ends". Build it from the story: only mention a section that the story has (a video without tips does not get the tips sentence). Never include age, gender, names or accent. A test for the sentences chosen for a fixture story with and without tips.

**The long description** (`styleLong`): the format ian pasted: one paragraph beginning "Indonesian short-video science explainer. Friendly, curious and upbeat, ..." with the same sentences, plus the line "Say the text exactly as written; do not read the tags aloud" is **not** added (the docs say not to give meta-instructions); keep it as ian wrote it, labelled "versi lama (bisa menggeser suara; coba yang singkat dulu)".

## The panel (`ui/js/remotion/page.js`, `ui/remotion.html`, `ui/css/remotion.css`)
When the target is Google AI Studio, **Muat naskah** shows **three blocks**, each with its own **Salin** button (and the download `.txt` offers all):
1. **Naskah + ekspresi** (the script with the tags).
2. **Deskripsi (gaya)**: the short English style, to paste into the style field.
3. **Deskripsi lengkap (versi lama)**, collapsed by default.
Under them, a short note (Indonesian, plain): "Tag memakai tanda <...> dan bahasa Inggris, sesuai dokumen Google (diperiksa 28 Okt 2026). Bahasa Indonesia didukung di Gemini 3.8 TTS. Belum diverifikasi: bahasa kolom gaya, dan apakah halaman AI Studio memakai kolom yang sama. Coba dulu tanpa gaya." Keep the compact bordered buttons of the klipian UI style; no pill buttons. VoiceStudio and ElevenLabs panels stay as they are.

## Bug to fix in the same round (ian, 2026-10-28, with a screenshot)
In `narrationHTML(d)` (`ui/js/remotion/page.js`, about line 431) the select takes its selected value only from the project option `d.options.voiceTarget`. After **Muat naskah** the page calls `drawVoice()`, which redraws the select back to that option (VoiceStudio), while the text shown is the one loaded for **Google AI Studio** (the first line says "Target: Google AI Studio"). The person sees "VoiceStudio" with Google's text, and thinks Google never works. Fix: the selected value is the loaded export's target (`NARR.target`) when an export for this video is shown, else the project option; choosing a target in the select must not be reset by a redraw, and changing the select clears the shown text (so the text and the label never disagree). Add a test (or a pure helper `narrationTarget(d, NARR)` with a unit test): after loading `googleai` the target stays `googleai`; after switching to ElevenLabs the old text is cleared.

## The skill (`.claude/skills/klipian-video/SKILL.md`)
Ian also asked that the instruction given to the local Claude Code at the start of each project carry this. Update the skill's step that prints the narration text: for the target **Google AI Studio** it prints the same three blocks as the panel (script with expressions, short style, optional long style) following the rules above (angle-bracket English tags from the verified list only, at most one per beat and six in all, `<whispers>` before "Intip yuk!", tags never in the story JSON); for VoiceStudio and ElevenLabs it stays as now. It must also tell ian that **the same text is in the panel: "3 Suara", choose the app, "Muat naskah"**, so he does not depend on the terminal copy. Keep the skill short.

## Tests (selftest, no real service, never ian's workspace)
- For a fixture story: the Google export has `script`, `style`, `styleLong`; every tag is on the verified list; no more than one tag per beat and six in all; the sting has `<whispers>` before "Intip yuk!"; `strip_tags(script)` equals the story's narration (ignoring the pause spacing); the style text has no age/gender/accent words; a story without tips gets no tips sentence.
- VoiceStudio and ElevenLabs exports are unchanged (a test compares them with the output before this change).
- The page test (if there is one) that the three blocks and their buttons exist for Google only.

## Limits
Edit only `klipian/motion.py`, `klipian/selftest.py`, `ui/remotion.html`, `ui/js/remotion/*`, `ui/css/remotion.css`. No API key, no call to Google, nothing downloaded; do not write to `workspace/`; do not restart port 5177 while edits are half done (tell ian when ready to reload); commit locally, do NOT push. Report with: the export for pilot 1's story (script, short style, long style), the list of tags used, the tests, and the rule added to `DESIGN.md` (a short rule "voice export": tags only from the verified list, in English, in the export only, never in the story).

## Not in this round
The ElevenLabs tags (still not verified: look up the official page in a later round), a Voice design persona, and any call to the Google service.
