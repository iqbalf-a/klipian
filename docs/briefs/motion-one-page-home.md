# /remotion (Motion tab): new topic and topic list on one page

Plan session, 2026-11-04. ian: "list topik yang sudah dibuat dan topik baru berada dalam 1 halaman". He picked the layout "Form + list in the main area".

## Context
Today `ui/remotion.html` has a 320 px left column (`aside#rmSide`). The "Video baru" button opens the form inside that narrow column and pushes the topic list down, while the wide right area (`#rmMain`) shows only the intro text (`drawIntro()`, page-detail.js:8). Goal: one full-width home page with the "Topik baru" form on top and a table of every topic below it. Clicking a topic opens its steps full width, with a "← Semua topik" button back to the home page.

```
Video motion
┌ Topik baru ─────────────────────────────────┐
│ Topik [______________]   Durasi 30 45 60     │
│ Musik [Otomatis v]  ☑ Loop  ☑ "Intip yuk!"   │
│ ▸ Pilihan lain (aplikasi suara, catatan, jenis)   [Buat] │
└──────────────────────────────────────────────┘
Topik yang sudah dibuat (5)
│ Gurita punya tiga jantung! … │ Sudah dirender │ 60 detik │ 4 Nov │
│ Fakta seru tentang cegukan … │ Sudah dirender │ 45 detik │ 1 Nov │
```

## Changes (keep the code structure: page-list.js = home, page-detail.js = one video)
1. **`ui/remotion.html`**: remove `aside#rmSide` and the `rmNewBtn` button. In its place, inside `.rm-layout`, add `section#rmHome` (home view) above `section#rmMain` (detail view). `#rmHome` holds the existing form `#rmNew` (no longer `hidden`) followed by the list `#rmList`. Keep EVERY existing id and `data-opt`/`data-opt-app` attribute (`rmTopic`, `rmDur`, `rmOptsNew`, `rmNotes`, `rmNewErr`, the music `<select>` options), because `readOptions()`, music.js and the selftest read them. Rearrange the form only:
   - Row 1: Topik (wide) + Durasi (segment).
   - Row 2: Musik + Loop + "Intip yuk!".
   - `<details class="rm-adv">` "Pilihan lain": the voice-app checkboxes, Catatan untuk AI, and Jenis video (the current "Pengaturan lanjutan" select). No `<fieldset>`/`<legend>` (selftest rule).
   - "Buat" button + `#rmNewErr`. Remove `#rmNewCancel`, because the form is always shown.
2. **`ui/js/remotion/page-list.js`**:
   - Remove the `rmNewBtn` and `rmNewCancel` listeners.
   - `drawList()` renders table rows. Each row is ONE `<button class="rm-item">` so the keyboard still works, with columns for the title, the chip, the length, the date and "n klaim belum dicek". Reuse the existing data and helpers (`lengthText`, `dateText`, `chip`). Show a count in a heading "Topik yang sudah dibuat (n)". Empty text: "Belum ada video. Tulis topik di atas.".
   - After a successful create, clear the fields, then `loadList(j.project.id)` opens the new video (unchanged).
3. **View switch** (one small function, e.g. `showHome()` / the existing `choose()`):
   - Home shown when `CUR` is null: `#rmHome` visible, `#rmMain` empty or hidden.
   - `choose(id)` hides `#rmHome` and shows the detail.
   - `buildDetail()` (page-detail.js:60) puts a "← Semua topik" button (`btn quiet`) at the start of `#rmHead`, which sets `CUR = null`, `stopPoll()`, clears `location.hash` (`history.replaceState` or `location.hash = ""`), `drawList()` and shows home.
   - Add one `hashchange` listener so the browser Back button also returns home (empty hash → home; an id → `choose`).
   - `loadList()`: with no wanted id → home (in place of `drawIntro()`).
4. **`drawIntro()`**: drop it as a page. Keep its 4-step text as a closed `<details>` "Cara kerja" under the form on the home page, or delete it if that is simpler. Remove its CSS (`.rm-welcome`) if it is no longer used.
5. **`ui/css/remotion.css`**: `.rm-layout` becomes one column. Remove `.rm-side` (sticky column). Form rows use flex-wrap so they stack at phone width with no horizontal scroll. The list rows are a grid (title `1fr`, then auto columns) in the /workspace style: compact, bordered, small radius, no pill buttons (ian's UI rule).
6. Fix the comment in `page.js:4` ("in the form on the left" → "on the home page").

## Don't
- Don't change any API, server code or the step flow inside a video.
- Don't touch ian's workspace data. Never press **Buat** on 5177.

## Verify
- `python -m klipian.selftest` (the motion page checks at selftest.py ~6930–7000) and `node tests/*.test.js` pass.
- On a test copy (5178, ZZTEST profile), or read-only on 5177 without creating anything:
  - Home shows the form and the table together at 1440 px and at 375 px (no horizontal scroll).
  - Clicking a row opens the steps full width; "← Semua topik" and the browser Back both return home.
  - Opening `/remotion#<id>` directly opens that video.
  - On the test copy only: Buat makes a topic and opens it.
- Send the Plan session two screenshots (home, detail). Commit only the touched files; don't push.
