---
name: klipian-video
description: Make a klipian intip video from the brief the person saved in /remotion (their brief file, for example <id>-brief.md). Use when the person asks to build a klipian video, or pastes a klipian brief. Writes the story JSON, the custom video folder under remotion/videos, and prints the narration text for their voice app. Never writes to workspace/, never needs an API key, never calls a voice or other service.
---

# klipian-video: from the brief to a custom video folder

You are the local Claude Code of this computer. The person copied or saved a brief from the `/remotion` page and asks you to make the video. Work from the repository root, `D:\github-repos\klipian`.

## Rules (hold for every step)

- Never write to `workspace/`. Never read or print secrets (`client_secret*.json`, tokens, keys).
- No API key, no service call. Web search for facts is yours to do; no voice service, no upload.
- The channel's musts (DESIGN.md section 0b, B16): the small "Intip yuk!" sting right after the hook, the loop-back ending (no mascot, label, pill or voice in the outro), and a consistent object style and animation. The brief's options (loop, sting, music, voice target, kind) stay as the brief says.
- Give each fact a source URL, as the brief asks. Leave out what you cannot check.

## Steps

1. **Read the brief file** the person names. Find its sections: the task, `## Pilihan video` (the options), the structure for the length, the channel and fact rules, the catalogue, and `## Answer format`.
2. **Research** the topic with web search. Write the claims with their sources.
3. **Write the story JSON** to `remotion/stories/<slug>.json`, in the answer format of the brief. Include `"bible": 1`, `"music"` as the options say, and the beats (hook, sting, explain, result, tips, outro) that add up to the length exactly.
4. **Validate**: `node remotion/validate.mjs remotion/stories/<slug>.json`. A `warnings` list is advice; fix every error and run it again until it says `"ok":true`.
5. **Build the video folder**: `cd remotion` then `npm run new-video <slug> stories/<slug>.json`. Then edit `videos/<slug>/index.tsx` and `plan.ts` to draw the beats with the kit (DESIGN.md first; reuse the dictionary marks, at most three new assets).
6. **Check**: from `remotion`, `npm run style-check -- <slug>` must print no FAIL. Its FLAG and RENDER lines are read in your report. Then `npm run style-report -- <slug>` writes `out/<slug>/style-report.md`.
7. **Print the narration text for every voice app checked in the brief** (`Target voice apps:` in the options; all three by default). Each app has its own format, so run the command once per app, from the repository root:

   ```bash
   python -c "import json,sys; sys.path.insert(0,'.'); from klipian import motion; print(motion.narration_export(json.load(open(sys.argv[1],encoding='utf-8')), sys.argv[2])['text'])" remotion/stories/<slug>.json <target>
   ```

   `<target>` is `voicestudio`, `elevenlabs` or `googleai`. Paste the output in your answer. Tell the person the status line that the export names, and that the "Bagian N" lines are for them: remove them before the voice reads.

   **For `googleai`** the output has three blocks: `NASKAH + EKSPRESI` (the script with expression tags), `DESKRIPSI (gaya, bahasa Inggris)` (the short style, for the style field), and `DESKRIPSI LENGKAP` (the older long style, optional). Keep these rules when you answer about them:
   - Tags are in angle brackets, in English, only from the verified list in `klipian/motion_voice.py` (`EXPRESSION_TAGS`). Never a sound-effect tag.
   - Expression tags: at most one per beat and six in all. `<whispers>` before "Intip yuk!". `<chuckle>` before a sentence that turns the fact ("Tapi", "Namun", "Padahal"). Pauses: `<short pause>` between beats, `<long pause>` before the last tips.
   - The tags are only in this export. Never put them in the story JSON.
   - Say that the style is a short English description and that the language of the style field and whether AI Studio uses the same field are not verified.

   **For `voicestudio`** the script uses only `[pause 500ms]` between beats and `[pause 1s]` before the last tips. `[laughter]` appears only when the person has checked it in the panel (at most two). The description is one value per category: gender (female or male), age (child, teenager, young adult, middle-aged or elderly), and pitch (moderate pitch). The panel's VoiceStudio block has the controls for these.

   **For `elevenlabs`** the script is one request with no part headers. Beats are joined with `...` (a final full stop becomes `...`), with one `[pause]` before the last tips. Tags are from ElevenLabs' voice list only: `[whispers]` before "Intip yuk!", `[curious]` at the start of a question hook, nothing else by default. At most one tag per beat and six in all. Never a sound-effect tag, never `<break>`. The model and the settings are a note for the person, not text.

   **Tell the person** the same text is in the panel: `/remotion`, panel "3 Suara", choose "Google AI Studio", press "Muat naskah". Its three blocks each have a copy button, so they do not depend on the terminal copy.
8. **Tell the person the next steps for `/remotion`**, in plain words: in the panel "Video dari Claude Code", choose the folder `remotion/videos/<slug>` and show its full path; press **Ambil cerita dari folder**. They do not need to paste the JSON: klipian reads only that folder's `story.json`, and only when they press the button. Then make the voice outside klipian; choose the audio file or files; press Cocokkan; look at the preview; then Render. As a fallback, keep printing the story JSON in your answer, so the person can paste it if the button is not possible.

## Your answer

Keep it short: the story file path, the video folder path, the style-check result (FAIL, FLAG, RENDER lines), the narration text, and the steps for the page. Say plainly what you could not check (for example a render, which needs ian's run).
