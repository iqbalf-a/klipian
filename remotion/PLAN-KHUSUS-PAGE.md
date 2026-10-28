# /remotion for the "Khusus" kind: one panel for the Claude Code video, no paste step (plan for klipian eksekusi, approved by ian)

Written by klipian motion (planning only), from ian's note and screenshot (2026-10-28): with the kind **Khusus** (a video made in a Claude Code session) the panels "1 Brief untuk Claude Code" and "2 Jawaban dari Claude Code" feel irrelevant; the folder picker ("Hujan buatan: ... · remotion/vide...") sits inside "Jenis video" and should be its own panel, "the panel 1 again, for choosing the result". **Otomatis stays as it is** (brief and paste are its only path).

## Why the two panels are redundant for Khusus
For Khusus, Claude Code writes the story **and** builds `remotion/videos/<slug>/` (with a complete `story.json`: narration, texts, claims, titles; `validate.mjs` has checked it). Pasting the same JSON back into klipian (panel 2) copies information that already sits in that folder. The brief (panel 1) is still how Claude Code **starts**, but it needs only one short command, not a whole panel.

## The new flow for Khusus (ian's earlier flow, steps 7 and 8 made direct)
Panels in this order (the numbers follow what is shown):
1. **Video dari Claude Code** (new panel, replaces "Jenis video" for Khusus, "Brief" and "Jawaban", and holds the folder picker):
   - **Perintah:** the one-line command ("Salin perintah untuk Claude Code", as now) with a note: "Tempel di Claude Code yang dibuka di folder klipian. Ia menulis cerita dan membuat folder videonya." The brief **file** is still made and saved as today (the command points at it); only the big panel and its "Salin brief"/"Unduh brief" buttons go away for Khusus (keep them under a collapsed "Brief lengkap" line, for the rare manual use).
   - **Folder hasil:** the picker of `remotion/videos/<slug>` folders (the one from "Jenis video" moves here), with the **full path** and a copy button, and a status chip: `belum dipilih`, `cerita belum diambil`, `cerita diambil`, `folder berubah` (see below). **No dropdown inside "Jenis video"**.
   - **Ambil cerita dari folder** (the button that replaces "Periksa dan simpan"): reads `story.json` of the **chosen folder** (ian's explicit choice, the only file read), validates it with the same checks as a pasted answer (same errors, same fix message copy button shown in the panel when it is rejected, the same warnings of the bible), and saves it as the project's story. Never reads any other file of the folder, never reads a folder ian did not choose, never writes into the folder.
   - **Folder berubah:** the project keeps the hash of the story it took; when the folder's `story.json` differs, the chip says `folder berubah` and the next step says "Ambil ulang cerita" (the chips Cerita/Klaim/Judul go `usang` as for any story change).
   - Rejected story: the problems list next to the button; a rejected story is not saved (as now).
2. Then, unchanged: **Suara**, **Storyboard**, **Cek fakta**, **Judul**, **Render** (renumbered 2 to 6). For Khusus the Storyboard shows texts and timing (already folded), and the box "Benda yang belum ada di pustaka" is hidden (it only matters to the template).
3. **Jenis video** keeps a small selector (Otomatis / Khusus) only when the video is created or its kind is switched (the confirmation of the page plan stays); the **folder** is no longer in it.

## The "Langkah berikutnya" bar (Khusus)
`nextStep`: no folder chosen -> "Salin perintah ke Claude Code, lalu pilih folder hasilnya"; folder chosen, story not taken -> "Ambil cerita dari folder"; folder changed -> "Ambil ulang cerita"; then the existing steps (klaim, judul, suara, cocokkan, pratinjau, render). Update the unit tests for `nextStep` and the stage chips.

## Safety (keep ian's earlier rules)
The AI is still the local Claude Code by copy-paste of **a command**; no API key, no service call. The one new read is the explicit "Ambil cerita dari folder" of the folder ian picked: not a watcher, not automatic, not a hidden channel. Claude Code still never writes to `workspace/`. Path handling: only a direct child of `remotion/videos/`, no `..`, no symlink out; a test for each.

## Tests (selftest harness or a copy on another port; never ian's workspace; no real service)
- Take the story from a fixture folder: accepted (valid), rejected (invalid, with the problem list and the fix message), unchanged on reject.
- Path safety: a folder outside `remotion/videos/`, a `..` path and a missing `story.json` are refused.
- `folder berubah`: change the fixture's `story.json`, the chip and the next step change, the chips go `usang`.
- Otomatis: the brief and the paste panels are exactly as today.
- Page: Khusus shows the new panel and not "Brief"/"Jawaban"; the folder picker is not inside "Jenis video".

## Limits
Only `ui/remotion.html`, `ui/js/remotion/*`, `ui/css/remotion.css`, `klipian/motion.py`, `klipian/server.py` (a new endpoint for "take the story from folder"), `klipian/selftest.py`, and the skill file (its last step: "Tell ian: choose this folder in /remotion and press Ambil cerita dari folder; you do not need to paste the JSON"; keep printing the story JSON in the terminal as a fallback). No change to `remotion/` video code. No API key, no service call, nothing downloaded; do not write to `workspace/`; do not restart port 5177 while edits are half done; commit locally, do NOT push. Add the rule to `DESIGN.md` ("Khusus: the story comes from the chosen folder, never automatically").

## For ian
Panel 1 does not disappear completely: the command for Claude Code must live somewhere, so it shrinks to one line inside the new first panel. Panel 2 (paste) does go for Khusus. The risk is only that you must choose the folder yourself and press **Ambil cerita dari folder** (that is the point: no hidden reading).
