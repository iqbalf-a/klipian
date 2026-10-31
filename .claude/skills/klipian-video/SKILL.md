---
name: klipian-video
description: Make a klipian intip video from the klipian brief the person pastes into this session, or from a brief file whose path they give. Use when the person asks to build a klipian video, or pastes a klipian brief. Writes the story JSON, the custom video folder under remotion/videos, and prints the narration text for their voice app. Never writes to workspace/, never needs an API key, never calls a voice or other service.
---

# klipian-video: from the brief to a custom video folder

You are the local Claude Code of this computer. The person copied a brief from the `/remotion` page and pastes it here, or gives you the path of a downloaded brief file, and asks you to make the video. klipian does not keep a brief file on disk: never assume one is saved. Work from the repository root, `D:\github-repos\klipian`.

**The brief is the instruction.** It is written so that any agent can follow it: numbered hard rules first, the exact files to produce, then numbered steps, each with the command to run and the result to expect, a fallback, and the common mistakes. Do the brief's steps in its order and use its exact paths and names (its slug). This file only adds what holds for you.

## Rules (hold for every step)

- Never write to `workspace/`. Never read or print secrets (`client_secret*.json`, tokens, keys).
- No API key, no service call. Web search for facts is yours to do; no voice service, no upload.
- The channel's musts (DESIGN.md section 0b, B16): the small "Intip yuk!" sting right after the hook, the loop-back ending (no mascot, label, pill or voice in the outro), and a consistent object style and animation. The brief's options (loop, sting, music, voice target, kind) stay as the brief says.
- Give each fact a source URL, as the brief asks. Leave out what you cannot check.
- Never say a command passed without its output.

## Steps

1. **Get the brief.** Use the text the person pasted into this session. If they give a path, read that file. If they give only a name such as `<id>-brief.md`, ask for its path before you go on; do not search for it. Find its sections: `## 1. Hard rules`, `## 2. What you must produce`, `## 3. Steps`, the fallback, the common mistakes, `## Pilihan video` (the options), and `## Answer format`.
2. **Do the brief's Steps 1 to 8.** In short: research and write the story to `remotion/stories/<slug>.json`; `node remotion/validate.mjs remotion/stories/<slug>.json` until it says `"ok":true`; from `remotion`, `npm run new-video <slug> stories/<slug>.json`; draw the beats in `videos/<slug>/index.tsx` and `plan.ts` (DESIGN.md first; reuse the dictionary marks, at most three new assets); `npm run style-check -- <slug>` must print no FAIL; render one still (`node render.mjs out/<slug>/job.json`) and `npm run style-report -- <slug>`.
3. **Print the narration text for every voice app the brief lists** (`Target voice apps:`), with the brief's command (it uses `motion.narration_export(story, target)['text']`; `<target>` is `voicestudio`, `elevenlabs` or `googleai`). Paste each output as it is. What the export gives is exactly what the person copies:
   - `voicestudio`: plain narration only, one line per beat. Nothing else is in it: VoiceStudio reads every character aloud.
   - `elevenlabs`: one script; tags only from ElevenLabs' own list.
   - `googleai`: the script with expression tags from the verified list in `klipian/motion_voice.py` (`EXPRESSION_TAGS`), at most one per beat and six in all; the style description is a separate value. The tags are only in this export, never in the story JSON.
   The same texts are in the page: `/remotion`, step "Naskah suara", with a copy button each.
4. **Tell the person the next steps for `/remotion`**, in plain words: in step 3 ("Ambil cerita dari folder Claude Code"), choose the folder `remotion/videos/<slug>` and show its full path; press **Ambil cerita dari folder**. They do not need to paste the JSON. Then make the voice outside klipian; step 6 imports the audio file and matches it; look at the preview; then Render.
5. **If you cannot run commands or write files**, use the brief's fallback: the first line `FALLBACK: story only, no video folder`, the story JSON, the narration as plain text. Do not claim a folder, a validation or a style check.

## Your answer

Keep it short: the story file path, the video folder path, the style-check result (FAIL, FLAG lines), the still picture's path, the narration text, and the steps for the page. Say plainly what you could not check (for example a full render, which needs ian's run).
