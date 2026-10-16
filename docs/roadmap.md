# klipian — Roadmap

Disusun 2026-10-16 di sesi analisis, untuk dibaca sesi eksekusi. Urutan di
bawah adalah urutan pengerjaan. Yang bertanda **TANYA IAN** menunggu
keputusan, jangan dikerjakan sebelum dijawab.

---

## 0. Posisi sekarang

**Rencana library-projects selesai.** Rencananya ada di
`~/.claude/plans/squishy-floating-frost.md`, dan tahap 0–3 sudah ada di `main`:

| Tahap | Commit |
|---|---|
| 0: bentuk data (id, `assets[]`, `segments`) | `fe2e9e9` `b94978f` `9e8f0e2` `5149201` |
| 1: banyak sumber dalam satu Result | `88fec04` `dd405f8` |
| 2–3: Timeline, label/sticker, suara, volume per clip | `55d8605` |
| aset per project, Remove dua langkah | `3eecf52` `1ff26e3` |

Pertanyaan yang masih terbuka di rencana itu (apakah folder output ikut
berganti nama saat project di-rename) sudah terjawab di kode: **tidak**.
`outSlug` dibekukan sejak project dibuat.

**Semua pengujian baru memakai satu video.** Sepanjang sekitar 170 commit,
setiap fitur diverifikasi di `radityadika-podcast.mp4` (baseline res2
`d2c1aa81…`, 7562941 byte). Hanya video itu yang punya transkrip di
`workspace/cache/`. Project kedua, "Raditya Dika - Apa Kabar Syahrini",
berhenti di layar Analyze tanpa transkrip.

---

## 1. Hasil audit kebersihan kode (2026-10-16)

Diukur dengan skrip AST/regex sekali jalan. Repo ini belum punya linter.

### Yang sudah bersih

- **Hampir tidak ada kode mati.** Ada 0 fungsi Python dan 1 fungsi JS
  yang tidak dipakai, 2 import Python yang tidak terpakai, dan 3 dari
  273 class CSS yang tidak dirujuk.
- **Duplikasi helper rendah.** Tidak ada nama fungsi global yang
  bertabrakan antar file editor. Satu-satunya salinan adalah
  `escapeHTML`, yang ada di dua halaman terpisah, dan itu wajar.
- **Arah dependensi Python rapi.** `models` tidak bergantung pada
  apa pun. Modul engine (`render`, `transcribe`, `facebox`, dan lainnya)
  hanya bergantung ke `ffmpeg_tools`/`models`. Hanya `server` dan `cli`
  yang merangkai semuanya.
- Komentarnya padat dan menjelaskan *kenapa*, bukan *apa*. Pertahankan.

### Utang yang nyata, urut dari dampak terbesar

1. **`server.py` (2257 baris) memegang lima urusan sekaligus:**
   - Orkestrasi render multi-sumber (`_run_render` 211 baris,
     `_asset_runs`, `_concat_renders`, `_trim_for_preview`)
   - Job transkripsi dan diarization (`_run_transcribe` 132 baris)
   - Penyimpanan dan migrasi project (baris ~882–1258: `_migrate_project`,
     `_adopt_legacy_projects`, `_project_*`)
   - Jadwal workspace dan thumbnail
   - HTTP: `do_POST` **486 baris** dan `do_GET` 285 baris, berupa rantai
     `if path ==` panjang untuk 28 route

   Akibatnya, logika "render sebuah project" hanya bisa dijangkau lewat
   HTTP.
2. **CLI tertinggal dari UI.** `cli.py render` masih menerima `video` +
   `candidates.json`, sehingga tidak bisa merender sebuah project (yang
   multi-video, punya Timeline, dan koreksi caption). Ini dampak langsung
   dari poin 1.
3. **Logika brief Claude ada dua salinan.** Pembuatan brief, ekstraksi
   JSON, snap ke batas kata, dan parsing waktu ditulis di
   `ui/js/editor/roundtrip.js` (`buildBrief`, `extractJSON`, `snapToWord`,
   `importJSON`) **dan** di `klipian/roundtrip.py` (`build_brief`,
   `extract_json`, `snap_to_word`, `parse_reply`). UI memakai yang JS,
   CLI memakai yang Python. Keduanya bisa diam-diam berbeda, padahal ini
   kontrak inti produknya.
4. **JS editor berbagi satu scope global.** Ada 14 file `<script>` klasik
   tanpa `import`/`export`, sehingga urutan tag di `index.html` menjadi
   kontrak tersembunyi. Ada 57 `let` level atas (16 di `projects.js`,
   8 di `player.js`, 8 di `assets.js`). Belum menimbulkan bug, tapi setiap
   fitur baru menambah state global.
5. **Fungsi raksasa lain:** `render.build_ass` (237 baris),
   `render._concat_filter` (114), `framing.js aiFramingApply` (147),
   `player.js sendRender` (142).
6. **Sisa migrasi:**
   - Di [projects.js:23](../ui/js/editor/projects.js) ada `activeProject`
     berkomentar "name of the video currently being worked on". Variabel
     itu sekarang berisi nama video *utama*, sementara identitas project
     ada di `activeProjectId`. Namanya menyesatkan.
   - Thumbnail ditulis ke `out/<video-stem>/thumbs/`
     ([server.py:1293](../klipian/server.py)), padahal render sekarang
     ditulis ke `out/<outSlug>/`. Akibatnya `out/` berisi folder bernama
     video, termasuk folder yatim `out/cadera-gameplay-mlbb/` dari project
     yang sudah dihapus.

### Remeh, cukup sekali sapu

- Import tidak terpakai: `subprocess` di `compose.py:32`, `Transcript` di
  `render.py:27`.
- Fungsi JS tidak terpakai: `assetsUsedBy` di `ui/js/editor/assets.js:265`.
- Class CSS tidak dirujuk: `.foot-actions`, `.tools-cut`, `.object-name`.
- `anthropic` di `requirements.txt` tidak diimpor di mana pun ("fase 2"
  yang tidak pernah terjadi), padahal README menjual "no API key".
- `assets/MonaSans-LICENSE.txt` identik dengan
  `assets/fonts/MonaSans-LICENSE.txt`. Hapus yang di root.
- Bahasa komentar campur: `requirements.txt` dan `.gitignore` berbahasa
  Indonesia, sisanya Inggris. Kode dan komentar sebaiknya Inggris saja.

---

## 2. Urutan kerja

### P1 — Jaring pengaman dan sapu bersih (sebelum fitur apa pun)

1. **`python -m klipian selftest`**. Menjadikan ritual "res2
   byte-identical" satu perintah:
   - render project baseline lalu bandingkan md5-nya;
   - jalankan `_migrate_project` pada fixture bentuk lama (datar,
     `result`, `video`) dan bandingkan hasilnya dengan bentuk yang
     diharapkan.

   Fixture-nya disalin ke `tests/fixtures/`, jangan bergantung pada
   `workspace/`. Video baseline tetap lokal, jadi selftest melewati
   (skip, bukan gagal) jika videonya tidak ada.
2. Sapu semua butir di "Remeh" di atas.
3. Pindahkan thumbnail ke `workspace/cache/thumbs/` supaya `out/` hanya
   berisi hasil render.
4. Ganti nama `activeProject` menjadi `primaryVideo` (atau nama serupa)
   beserta komentarnya.

Selesai jika: `selftest` hijau, dan render res2 masih `d2c1aa81…`.

### P2 — Rapikan struktur (setelah P1, karena butuh selftest)

1. **Pecah `server.py` tanpa mengubah perilaku:**
   - `klipian/projects.py`: penyimpanan, migrasi, legacy, ringkasan
     project;
   - `klipian/jobs.py`: `_run_render`, `_run_transcribe`, `_run_diarize`
     beserta registry job;
   - logika multi-sumber (`_asset_runs`, `_concat_renders`,
     `_trim_for_preview`) pindah ke `render.py`, di sebelah `render()`;
   - `server.py` tinggal HTTP. Rantai `if path ==` diganti tabel route
     (pola `/api/facetrack` di baris ~118 sudah menunjukkan caranya).

   Selesai jika: `selftest` hijau di setiap langkah, satu commit per
   modul yang dipindah.
2. **Satu sumber kebenaran untuk brief Claude.** Server membuat brief dan
   mem-parse balasan memakai `roundtrip.py`, lewat endpoint
   `/api/brief` dan `/api/import`. `roundtrip.js` tinggal UI (unduh,
   tempel, tampilkan). Rubrik dibaca server, bukan di-`fetch` browser.
3. **CLI `render` menerima project** (`--project <id>`), memakai jalur
   yang sama dengan server. Ini praktis gratis setelah langkah 1.

### P3 — Siklus penuh dengan video kedua (kerja ian sebagai pengguna)

Selesaikan project Syahrini: transkripsi → 2–3 klip → diposting. Catat
setiap hambatan. Sesi eksekusi memperbaiki yang rusak. Daftar hambatan
itu yang menentukan urutan sesudah P4.

P3 boleh jalan bersamaan dengan P1/P2, karena tidak menyentuh kode.

### P4 — Sisa-sisa library-projects

- Fallback `?video=` dan `legacyFile` di `/api/project`: tentukan kapan
  dihapus.
- Folder lama `out/radityadika-podcast/`, `out/cadera-gameplay-mlbb/`,
  dan `projects/legacy/` dibersihkan manual oleh ian. Jangan dihapus
  oleh sesi.
- Memasukkan video masih harus disalin manual ke `workspace/samples/`.
  **TANYA IAN**: perlu tombol "Add video" yang menyalin file, atau
  download link (yt-dlp, kodenya ada di `3eecf52`)? Tunggu hasil P3.

### P5 — Dokumentasi menyusul kenyataan

- README:
  - Workflow masih menyebut "drop a video"; perbarui.
  - Daftar layar belum memuat Assets dan Timeline.
  - Structure: `projects/` sekarang per id, ada `projects/<id>/assets/`,
    dan susunan modul berubah setelah P2.
- `docs/ui-design.md`: pertahankan prinsipnya (palet, panel 9:16 sebagai
  satu frame, aturan istilah kerja). Tandai bagian yang sengaja tidak
  diikuti, beserta alasannya:
  - Stack React/Vite/FastAPI: kenyataannya vanilla JS tanpa build step,
    dan server pakai stdlib.
  - Font Archivo: kenyataannya Geist dan Mona Sans.
  - Alur Meja→Antrian: kenyataannya
    Home→Assets→Analyze→Clips→Framing→Captions→Timeline→Render.
  - Nada UI berbahasa Indonesia: kenyataannya UI berbahasa Inggris.

### P6 — Mode gameplay (**TANYA IAN**: apakah akan mengklip MLBB?)

Layout split (dua kotak bertumpuk) sudah ada di `framing.js`. Yang kurang:

- Pilihan rubrik di UI. `roundtrip.js` masih hardcode `dialog-podcast.md`.
  Kalau P2.2 selesai, pilihan ini tinggal satu parameter.
- Sinyal hype/announcer ke brief. `audio_energy.py` sudah ada.
- Preset framing per streamer.

---

## 3. Diparkir, sengaja tidak dikerjakan

- **Migrasi JS ke ES modules** (`type="module"`, `import`/`export`). Ini
  perbaikan nyata untuk utang nomor 4, tapi menyentuh 14 file sekaligus
  dan tidak bisa diverifikasi oleh selftest render. Kerjakan hanya jika
  global state mulai menimbulkan bug, atau pecah per file saat file itu
  sedang disentuh untuk alasan lain.
- **Dashboard `/workspace`.** `clips.json` berisi 0 baris dan
  `content-calendar.xlsx` masih ada, jadi tampaknya belum dipakai. Jangan
  tambah fitur sampai dipakai. **TANYA IAN**: dipertahankan atau
  dibekukan?
- **Migrasi ke React/FastAPI seperti di brief desain:** tidak perlu.
