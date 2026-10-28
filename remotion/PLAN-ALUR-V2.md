# klipian motion, flow v2 (plan for klipian eksekusi, approved by ian)

Written by klipian motion (planning only). It merges ian's flow of 2026-10-28 with `PLAN-REMOTION-PAGE.md` (the page plan; its sections A to G stay valid; where this plan differs, **this plan wins**). Rules that hold for everything below: the AI is the **local Claude Code, by copy-paste, never an API key** (no key field, no service call); `workspace/` is never written by Claude Code; tests never touch ian's real workspace (selftest harness or a copy on another port); do not restart port 5177 while Python edits are half done and tell ian when they are complete; commit locally, do NOT push.

## The flow (ian's, 12 steps) and who does what
1. Ian types the idea ("kenapa colokan panas").
2. Options before the brief: **length 30 / 45 / 60 s**; **Loop** (default on); **"Intip yuk!"** (default on); **target voice app** (VoiceStudio / ElevenLabs / Google AI Studio: it only chooses the text format of step 5); **music** (calm / tech / none); the rest of the brief is the Style Bible.
3. **Generate brief** (klipian).
4. Ian pastes the brief into the local Claude Code.
5. Claude Code gives the **story JSON** (narration per beat, claims, titles) and builds the **custom video folder** `remotion/videos/<slug>` (following the Style Bible; runs `styleCheck`); it also prints the **narration text** in the chosen target format.
6. Ian makes the voice **outside klipian** while step 5 runs.
7. Ian **chooses the video folder** in the project (not automatic). The folders live in `D:\github-repos\klipian\remotion\videos\<slug>` (for example `...\remotion\videos\kenapa-colokan-panas`); the picker lists them and **shows the full path** of the chosen one (and a button to copy it).
8. Ian **chooses the audio file(s)** in the project (one file, or several with a common prefix).
9. Text style = the colokan's (locked, see section F).
10. **Match** (one click in klipian): the narration text is aligned to the audio, which gives word times for the captions, the beat timing and the sound.
11. **Preview**: the **full video** (with sound), a draft render.
12. **Render** (the final).

## Opinion on several audio files (ian asked): yes, support it
Rules (all in `import_voice`, before the existing flow, which still works on one `narration.wav`):
- Ian picks one or more files. Several files must share a **common prefix**, followed by a separator (`_`, `-`, space) and a **number**: `colokan_1.wav`, `colokan_2.wav`, `colokan_3.wav`. Sort them **by the number** (natural sort: 2 before 10), not by name. A number may be zero padded.
- Validate and show the list before accepting: the order, each duration, the total, and **warnings**: a missing number in the series (1, 3), a different prefix, mixed formats (fine, convert) or different sample rates (fine, convert), a part that is much louder or quieter than the others (normalise loudness with `loudnorm` or a simple RMS match, and say so).
- Join them with `ffmpeg` into the one `narration.wav` (48 kHz mono as today) with a small silence between parts (default **0.25 s**, setting 0 to 1 s), keep the originals in the project, record the parts in `voice.json` (names, durations, offsets).
- The parts **need not** match beats: the alignment runs on the joined audio against the whole narration text. (It is safer when a part ends at a sentence end; the narration text export for VoiceStudio suggests part breaks at sentence ends, about every 10 to 15 s.)
- Replace one part without redoing the others: the page lists the parts; choosing a new file for "colokan_2" replaces that part and clears the alignment.
- Limits stay (1 to 180 s total, 300 MB per file). One file works as now.

## Phase 1: voice files, the match step and the full preview (the core)
1. **Multi-file audio** as above, with tests (a fixture of three small wav files, a gap in the series, a different prefix, order 2 before 10, silence between parts, replacing one part).
2. **Match = one button**: keep the current alignment (faster-whisper words, with the even-spread fallback) and add a **match preview table** after it: per beat the expected duration (from the story) against the real one, the delta in seconds, a warning when a beat is off by more than 20% or 1.5 s, the new total length, and a **length policy**: the video follows the voice when the total differs from the chosen length by at most **15%**; beyond that, the page says so and offers two choices (edit the narration text / "continue anyway"). Show words that the recogniser could not match (numbers, terms), so ian can fix the text. Do not hide a bad match: say it. This has been tested only with synthetic voices so far; the first real run is the colokan with ian's audio, so keep the preview table honest.
3. **Subtitle export** from the aligned word times: `.srt` and `.vtt` (one cue per caption line, about 2 lines, at most 42 characters a line), saved in the project and offered as a download.
4. **Full preview video**: a new job kind `preview-video` that renders the **whole video with the narration, the sound effects and the music** at a lower cost (half size 540 by 960, the same frames and timing; use a faster `crf`/preset; no motion blur needed), saved as `preview.mp4` in the project and played in the page (`<video controls>`). The final render stays as today. Report the preview render time and how much faster it is than the final.
5. Tests and a small fixture project on the selftest harness; **no real voice, no real service**.

## Phase 2: brief options and the narration text formats
1. **Brief options** in the "Video baru" dialog and the project (`project.json` `options`): `duration`, `loop` (default true), `sting` (default true), `voiceTarget` (`voicestudio` / `elevenlabs` / `googleai`), `music` (`calm` / `tech` / `none`), `kind` as in the page plan (Otomatis template / Khusus). The brief text reflects them (a line per option, and "Loop: yes/no", "Intip yuk!: yes/no" which the Style Bible warnings read). Note: loop and the sting are musts of the channel, so the defaults are on and turning one off shows a short warning ("saluran ini mewajibkan ...").
2. **Narration text export** (a download and a copy button, per target), made from the story's narration, split into parts (suggested breaks at sentence ends):
   - **VoiceStudio**: plain text, part by part, with a header line per part ("Bagian 1 (sekitar 12 detik)"); no tags.
   - **ElevenLabs** and **Google AI Studio TTS**: the text format each tool actually understands (pauses and style hints). **Look up the official documentation for each before writing the format** (the exact tags are not known to me; do not guess: if you cannot verify a tag, leave it out and mark the format "belum diverifikasi" in the page). Never call their services.
   - Each export also has the **total estimated time** and the **estimated time per part** (2.3 to 3.2 words a second, as the planner already uses).
3. The **fix message** and the **revise brief** carry the options too.
4. Tests: the brief for each option combination; the exports for a fixture story (the splitting, the headers, no tags in the VoiceStudio export).

## Phase 3: the page (from `PLAN-REMOTION-PAGE.md`, adapted)
Do the page plan A to G with these changes: (a) **no "kind" radio on creation beyond the option above**: in step 7 the page shows **"Video: pilih folder"** (a picker of the folders in `remotion/videos/` plus "Template otomatis" as the default), with the story path and the `new-video` command shown for a new one; choosing the folder sets the composition; (b) step 8 is **"Suara: pilih berkas"** (one or several), with the parts list; (c) the "Langkah berikutnya" bar follows the 12 steps above (including "Pilih folder video", "Pilih berkas suara", "Cocokkan", "Lihat pratinjau penuh", "Render"); (d) the stage chips: Cerita, Klaim, Video, Suara, Cocokkan, Pratinjau, Render, with `usang` when the story, the folder, the voice or the match changed after the last render/preview; (e) the preview and the render blocks show the **length, the render time and whether they are current**.

## Phase 4: one procedure for the local Claude Code (a project skill)
Write a project skill `/.claude/skills/klipian-video/SKILL.md` (in the repo, not in `workspace/`) that the local Claude Code follows when it receives a klipian brief: read the brief file, research with web search, write the story JSON (validate with `node remotion/validate.mjs`), build the video folder with `npm run new-video` following the Style Bible, run `styleCheck` and `style-report`, then print the narration text in the target format and the commands for ian ("pilih folder ... di /remotion"). It must never write to `workspace/` and never need an API key. The page's "Salin perintah untuk Claude Code" (page plan G) points at this skill. Keep the skill short and checkable; test it by reading it with a fixture brief.

## F. The text style is locked (Style Bible rule)
Verified in code (`src/components/Captions.tsx`, `src/tokens.ts`): the caption is a **black box** (`BLACK`, opacity 0.88, rounded), **white** text, the spoken word **yellow** (`YELLOW`), font **Outfit Bold** (`FONT_BOLD`); small labels and kickers **DM Mono** (`FONT_MONO`); no other fonts. Add it as a rule ("B17 Text style") in `DESIGN.md` and a `styleCheck` item (a video may not draw captions with another font or colours; scan like the colour-literal check) and a golden frame of the caption in the style reference sheet.

## Order and reporting
Do the phases **in order**, one report after each (what changed, tests, how to try it on a copy, and the new rules added to `DESIGN.md`), and wait for ian's "go" before the next. Phase 1 first: it is what ian needs for the colokan's real narration.

## For ian
Preview (step 11) is a **draft of the full video** (half size, same timing, sound included), so you can watch it all before the final render. Tell me if you would rather keep full size.
