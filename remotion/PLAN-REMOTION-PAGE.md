# klipian /remotion page: a clearer motion tool (plan for klipian eksekusi, approved by ian)

Written by klipian motion (planning only). Ian: "honestly I am still confused by the motion feature that klipian has now". I read `ui/js/remotion/page.js`, `ui/remotion.html`, `klipian/motion.py` and the endpoints in `klipian/server.py`. The tool works, but it grew in layers and shows its internals instead of guiding. This round makes the page **say what to do next, what kind of video this is, and whether the output is current**. It changes the page and a few `motion.py` fields; it does not change the video code in `remotion/` or the AI brief (that is Style Bible round 2).

## What the page is today
One long page: a list of videos on the left; for the open video, sections in this order: **Komposisi**, **1 Brief untuk AI**, **2 Jawaban AI**, **2b Suara (narasi)**, **3 Storyboard**, **4 Cek fakta**, **5 Judul**, **6 Render**. `detail()` returns the story, the facts, the `gate` (reasons why a render is blocked), the `stills` state (with a stale flag), the `render` record, the `job` and the `voice` info.

## The five confusions (and what each needs)
1. **Two render engines hidden in one select.** "Komposisi" is `Template (dari cerita)` or a custom video made in a Claude Code session (`remotion/videos/<slug>`). The only explanation is one small line and a terminal command (`npm run new-video ...`). A video made as a template can be switched to a custom composition silently (this is how ian's render used the wrong look). **Fix: the kind of video becomes a visible, named choice, with a plain explanation, and the page adapts to it.**
2. **The story's scene items only matter for the template.** For a custom video only the texts and the timing count, but the Storyboard shows and lets you edit every item. **Fix: for a custom video show the texts and the timing, and fold the item details away.**
3. **Copy-paste with an outside AI.** The brief goes to another AI, the answer is pasted back, and a fix message goes back and forth. It is not clear when it is done. **Fix (the copy-paste stays, with the local Claude Code as the AI, see G): make each of the two moments one clear state ("Brief belum disalin", "Menunggu jawaban AI", "Jawaban ditolak: 3 masalah", "Cerita tersimpan"), and show the problems list next to the paste box.**
4. **No guidance and no honest status.** Nothing says what to do next; "Sudah dirender" stays after the story, the composition or the voice changed; every render creates another file named "(2)", "(3)" with no mark of which is newest. **Fix: a "next step" bar and a stale-aware render status.**
5. **Voice is half there.** The narration must be made elsewhere and its file path pasted; the local TTS button appears only when `machine.json` has `motionTts`. **Fix: a clear two-way step ("I have a narration file" / "make it here" when TTS exists), with the state of the narration (none / matched / out of date).**

## A. The "Langkah berikutnya" bar (top of the open video)
- One sentence and one button, computed by a pure function `nextStep(detail)` (in `ui/js/remotion/`, tested with a fixture list; also exposed as a field `next` in `detail()` so the server and the page agree).
- States, in order: no brief copied yet -> "Salin brief ke AI" (opens/scrolls to step 1); brief copied, no story -> "Tempel jawaban AI"; paste rejected -> "Perbaiki: N masalah" (shows the fix message copy button); story saved, claims unchecked -> "Centang N klaim lagi"; no title -> "Pilih judul"; custom video chosen but no composition folder yet -> "Buat video khusus di sesi Claude" with the exact command and a copy button; narration wanted but not matched -> "Cocokkan narasi"; everything ready -> "Render" (the primary button); render stale -> "Render ulang (cerita berubah)"; render done and current -> "Buka di Clips".
- Under it, a **status row** with one compact bordered chip per stage (Cerita, Klaim, Judul, Suara, Gambar, Render): `selesai`, `menunggu`, `usang`, `perlu perhatian`. Follow the klipian UI style: compact bordered buttons and chips like `/workspace`, small radius, no pill buttons, clear states.

## B. The kind of video is a visible choice
- When creating a video (the "Video baru" dialog), add a choice with two labelled options and one short explanation each: **Otomatis** (klipian draws it from the story with its template: fastest, plain) and **Khusus** (a custom animated video made in a Claude Code session, like the colokan: the best look; needs a session; text and timing come from the story). Default **Otomatis**; remember the choice per video (`project.json` gets `kind: "template" | "custom"`; keep `composition` as is; migrate old projects: `composition` set means `custom`).
- For **Khusus**: the page shows a block "Video khusus": the folder (if it exists), the exact `new-video` command with the story path filled in and a copy button, and a status (`belum dibuat` / `siap`). Choosing the composition happens here (a select of the existing custom videos), not in a hidden box. Switching the kind asks for a confirmation that says what changes ("render berikutnya memakai ...").
- The Storyboard follows the kind (confusion 2): **Otomatis** shows the items as today; **Khusus** shows texts and timing, and a collapsed "Detail benda (hanya template)".
- Render uses the chosen kind and **says it in the render block** ("Akan dirender dengan: Video khusus 'Kenapa colokan bisa panas?'").

## C. A render status that does not lie
- `detail()` computes `render.current` (true when the story hash, the composition, the voice and the kind equal those of the last render; the render record already has `storyHash`; add `composition`, `voiceHash`, `kind`) and `render.reasons` (a short list of what changed).
- The render block shows **Hasil terbaru** (file, date, kind, how long it took, current or "usang karena: ...") and lists older files collapsed, with the newest marked; the file name gets the kind and a time, not "(2)" ("<title> · khusus · 28 Okt 21.45.mp4"; keep Clips compatible: read how `rowId` links to Clips before renaming; if renaming is risky, only change the label shown on the page).
- The video list on the left shows the stage chip ("Siap render", "Menunggu klaim", "Render usang") instead of the plain "Sudah dirender".

## D. Voice as one clear step
- Chips: `tidak ada` / `file diimpor` / `dicocokkan` / `usang`. Two actions side by side: **Pakai file suara** (path or upload, as now) and **Buat di sini** (shown only when `motionTts` is configured; otherwise a short line says what is needed and links to the guide). After the match, show the new total length and what changed in the beats (the page already knows `v.total`).
- Keep all current voice endpoints and the alignment behaviour.

## E. Style Bible warnings on the page
After Style Bible round 2 lands, show the story's `warnings` (missing "Intip yuk!" sting, missing loop-back outro, and so on) as a compact list under the title with a hint ("bukan penghalang, saran dari Buku Gaya"). If round 2 has not landed when you build this, leave a clearly marked place for it and a test that the page ignores a missing `warnings` field. Do not block on it.

## F. Cleanups that remove confusion
- Rename the section titles so they read as steps: "1 Brief untuk AI", "2 Jawaban AI", "3 Suara (opsional)", "4 Storyboard", "5 Cek fakta", "6 Judul", "7 Render" (no "2b"), and move **Komposisi** into the new "Jenis video" block above them.
- Every empty state says what to do ("Belum ada klaim: cerita ini tidak membutuhkan sumber" only when that is true).
- Keep the Indonesian wording short and plain, as the rest of the UI. Do not change `/workspace`.

## Tests and limits
- Pure functions get unit tests: `nextStep` for every state above, the stale logic, the migration from `composition` to `kind`, the stage chips. The existing `/remotion` selftest keeps passing (extend it for the new fields; **use the selftest harness or a copy of the workspace on another port, never ian's real workspace, and no real service calls**).
- Only edit: `ui/remotion.html`, `ui/js/remotion/*`, `ui/css/remotion.css`, `klipian/motion.py` (the new fields, the migration, the stale logic), `klipian/server.py` only if a field needs an endpoint change, `klipian/selftest.py` for the motion tests. Do not touch the video code in `remotion/` or the brief text (round 2 owns them).
- Do not restart the server on port 5177 while edits are half done; tell ian when the page is ready to reload. Do not touch `workspace/`, secrets or `client_secret*.json`. Commit locally, do NOT push.
- Report with: a before | after screenshot pair of the page (render it with a test project on a copy of the workspace on another port, never with ian's data), the list of `nextStep` states with an example each, the migration, the new fields, the tests, and any confusion you saw that is not fixed.

## G. The AI is the local Claude Code, still copy-paste, never an API key (ian, 2026-10-28)
Ian's decision: **keep the copy-paste flow**; the "outside AI" is the **Claude Code that runs on this computer**; **no API key, no service call from klipian**. So:
1. Say it on the page: step 1 is "Brief untuk Claude Code" and step 2 "Jawaban dari Claude Code". The text "Tempel ke Claude atau ChatGPT dan nyalakan pencarian web" becomes: "Tempel ke Claude Code di komputer ini; ia mencari web sendiri. Tanpa API key." (The same wording goes into the brief's first paragraph in Style Bible round 2; if round 2 has landed, edit that text there too and add a test; otherwise leave a note for it.)
2. Make the copy-paste smoother **without changing it**: the "Salin brief" button also offers **"Salin perintah untuk Claude Code"**: one short sentence that points at the brief **file** klipian already saves (the download path) instead of pasting 6 pages, for example: "Baca file <path> dan kerjakan tugasnya. Periksa jawaban dengan `node remotion/validate.mjs <jawaban.json>` sebelum kamu kirim." Claude Code then answers in the terminal; ian copies the JSON block and pastes it in step 2, exactly as now. Do **not** make klipian read any file Claude Code writes by itself (no hidden channel), and do not write to `workspace/` from Claude Code.
3. The fix message (when the paste is rejected) stays copy-paste too, worded for Claude Code ("jalankan `validate.mjs` lagi sebelum menjawab").
4. No setting, field or code path for an API key is added anywhere; the page never says "API" except to say there is none.

## For ian
Which of the five confusions is the worst for you? If one of them needs a different fix than the one above, tell me before this goes out. The copy-paste with Claude Code stays (section G).
