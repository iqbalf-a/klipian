# klipian — Roadmap

Disusun 2026-10-16 di sesi analisis, untuk dibaca sesi eksekusi. Urutan di
bawah adalah urutan pengerjaan. Yang bertanda **TANYA IAN** menunggu
keputusan, jangan dikerjakan sebelum dijawab. Keputusan yang sudah
diambil diberi tanggal.

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
setiap fitur diverifikasi di `radityadika-podcast.mp4` (baseline res2,
7562941 byte; lihat catatan hash di P1). Hanya video itu yang punya transkrip di
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

**Selesai 2026-10-16**, commit `f44e5a5` `81250c6` `9afc814` `1fabd12`.
`python -m klipian selftest` lolos: migrasi dua bentuk lama, dan render
res2 dalam ~30 detik.

> **Catatan hash baseline.** Angka `d2c1aa81e59babd7ee469b2494c8c762` di
> commit-commit lama (`b94978f` sampai `1ff26e3`) adalah **32 karakter
> pertama SHA-256**, bukan md5. Sesi lama menyebutnya "sha256 `d2c1aa81…`"
> lalu memotongnya. Hash lengkapnya
> `d2c1aa81e59babd7ee469b2494c8c762e1e12bbee7d87d107b944839be3e13c9`.
> File yang sama punya md5 `0698726b12a6df2755ad47d8152bd55b`, dan md5
> inilah yang dipakai `tests/fixtures/res2/baseline.json`. Keduanya
> menunjuk byte yang sama, jadi output render **tidak pernah bergeser**.
> Mulai sekarang, sebut baseline dengan md5 `0698726b…` saja, sesuai
> selftest.

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

Selesai jika: `selftest` hijau, dan render res2 masih md5 `0698726b…`.

> **Catatan 2026-10-19: baseline tahan upgrade ffmpeg.** ffmpeg di-upgrade lewat
> winget (8.1.2 ke 9.0.2, 18 Okt 22:37) dan keenam baseline render gagal, padahal
> **stream video identik** (packet md5 sama, termasuk res2 dibandingkan dengan file
> lamanya); yang berubah hanya audio AAC (SNR 37,5 dB, selisih terbesar 0,1 dB per
> jendela 50 ms) dan tag encoder di container. Karena itu `baseline.json` sekarang
> juga mencatat `ffmpeg` (baris versi), `video_md5` (packet md5 stream video) dan
> `audio` (jumlah sampel dan RMS per 50 ms, mono 48 kHz; `klipian/fingerprint.py`).
> Perbandingan: byte sama = PASS; kalau tidak, `video_md5` harus persis sama
> (beda = FAIL, dengan versi ffmpeg lama dan baru), audio harus sama dalam
> toleransi (jumlah sampel +-2048, selisih <= 1 dB per jendela di atas -50 dBFS;
> volume setengah, audio bergeser, hilang atau lebih pendek = FAIL, diuji di
> `selftest --only fingerprint`). Hasilnya PASS dengan catatan "toolchain changed
> (ffmpeg A -> B) ... run `selftest --rebaseline` to record", tidak diam-diam.
> `selftest --rebaseline [nama...]` merekam ulang dan menolak kalau stream video
> berbeda (`--force` untuk gambar yang sengaja berubah, dengan ringkasan).
> Baseline direkam ulang dengan ffmpeg 9.0.2. **Saran untuk ian** (dijalankan ian
> sendiri): `winget pin add --id Gyan.FFmpeg`, supaya ffmpeg tidak ter-upgrade
> diam-diam; lepaskan dengan `winget pin remove --id Gyan.FFmpeg` saat memang mau
> upgrade, lalu jalankan selftest.

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
3. ~~**CLI `render` menerima project** (`--project <id>`)~~. Asumsi
   "praktis gratis" ternyata salah. Server tidak pernah menerima project,
   hanya request jadi yang disusun JS dari `captionStyle()`/`OPTIONS`,
   framing per titik, koreksi kata, dan overlay, yang tersebar di 6 file.
   Diganti dengan 3a dan 3b di bawah.

**Status 2026-10-16:** 2.1 dan 2.2 selesai (`2e1654e` … `9239a52`).
`server.py` turun dari 2257 menjadi 1251 baris; `jobs.py` 611 baris,
`projects.py` 406 baris. Selftest sekarang juga mengecek brief: brief
identik, dan 7 balasan terbaca sama.

**Keputusan 2.3 (ian, 2026-10-16): opsi C, ditambah aturan transkrip.**

Tiga opsi yang ditimbang:

| Opsi | Isi | Nasib |
|---|---|---|
| A | Salin logika penyusun request ke Python | Ditolak: duplikasi yang sama dengan yang baru dihapus di 2.2 |
| B | Penyusunan request pindah ke server, JS memakainya | **Ditunda** sampai ada kebutuhan render tanpa UI (massal atau terjadwal) |
| C | Server menyimpan request render terakhir per Result; CLI memutar ulang | **Dipilih** |

3a. **Replay request render (opsi C).**
   - Server menyimpan request render terakhir yang **selesai** per Result,
     beserta md5, sha256, ukuran, dan waktu hasilnya. Quick preview tidak
     ikut disimpan.
   - CLI `render --replay <project> [--result <id>]` memutarnya ulang ke
     lokasi sementara, lalu membandingkan hash-nya. File render milik
     ian tidak pernah ditimpa.
   - `selftest --promote` menyalin request tersimpan menjadi fixture
     baseline baru di `tests/fixtures/<nama>/`. Selftest menjalankan
     semua baseline yang ada, dan melewati (skip) baseline yang
     videonya tidak ada.

   Alasan memilih C: nol duplikasi, dan setiap Result yang dirender dari
   UI bisa menjadi baseline. Ini langsung menjawab kelemahan "semua
   pengujian baru memakai satu video": begitu Syahrini dirender di P3,
   ada baseline kedua.

   Batasan yang disadari: replay mengulang keadaan **saat dirender**,
   bukan keadaan project sekarang.

3b. **Satu aturan pemilihan transkrip.** Sekarang ada empat cara memilih
   transkrip:
   - UI `findTranscript()` (roundtrip.js:43) mengambil yang pertama
     menurut nama dari listing cache, dan dipakai di 5 tempat;
   - `server._ui_transcript()` meniru aturan UI;
   - `Cache.find_any_transcript()` (render dan jobs) mengambil yang
     terbaru;
   - CLI `_load_transcript()`.

   Kalau satu video punya dua transkrip, caption dan brief bisa memakai
   transkrip yang berbeda. Aturan baru, satu fungsi di `cache.py`:
   cocokkan dulu fingerprint (video, model, bahasa) yang persis, dan
   kalau tidak ada, ambil yang terbaru. Semua pemakai, termasuk UI lewat
   endpoint server, memakai fungsi itu.

### P3 — Siklus penuh dengan video kedua (kerja ian sebagai pengguna)

Selesaikan project Syahrini: transkripsi → 2–3 klip → diposting. Catat
setiap hambatan. Sesi eksekusi memperbaiki yang rusak. Daftar hambatan
itu yang menentukan urutan sesudah P4.

P3 boleh jalan bersamaan dengan P1/P2, karena tidak menyentuh kode.

**Hambatan #1 (2026-10-16): transkripsi gagal dengan
`open() got an unexpected keyword argument 'metadata_errors'`.**
**Selesai 2026-10-16** (`ebdabef` `e419d36` `da8afff` `a5d709b`). `.venv`
sekarang berjalan di Python 3.14.8 dengan av 18.1.0, dan selftest punya
cek decode.

- **Penyebab, sudah direproduksi:** faster-whisper 1.2.1
  (`faster_whisper/audio.py:46`) memanggil
  `av.open(..., metadata_errors="ignore")`. PyAV 19 sudah tidak menerima
  argumen itu, sedangkan PyAV 18.1 masih menerima.
  `requirements.txt` hanya menulis `faster-whisper>=1.1.0`, sehingga
  instalasi baru menarik av 19.
- **Kenapa hanya sebagian yang kena:** ada dua environment di mesin ian.
  - `.venv`: Python 3.11.15 dari uv
    (`%APPDATA%\uv\python\cpython-3.11.15…`), av 18.1.0, dependensi
    AI Framing lengkap. Transkripsi jalan. `launch.json` memakai yang ini.
  - Python 3.12.7 sistem (`%LOCALAPPDATA%\Programs\Python\Python312`),
    tempat requirements baru dipasang: av 19.0.1, dan tanpa
    torch/pyannote/opencv/soundfile. Transkripsi gagal, dan AI Framing
    juga tidak akan jalan di sini.
- **Perbaikan (tugas sesi eksekusi, setelah 2.3):**
  - Pin `av<19` di `requirements.txt`, dengan komentar yang menyebut
    alasannya. Lepas pin itu begitu faster-whisper berhenti mengirim
    `metadata_errors`.
  - Tambahkan cek ke `selftest`: decode audio beberapa detik dari video
    sampel lewat `faster_whisper.audio.decode_audio`. Dengan begitu,
    environment yang rusak ketahuan sebelum transkripsi 20 menit dimulai.
  - README bagian setup: jalankan server **dari `.venv`**, dan cara
    membuat ulang `.venv` dari Python sistem kalau Python uv dihapus.
- **Keputusan ian (2026-10-16): `.venv` dibuat ulang di atas Python
  3.14.8**, lengkap dengan dependensi AI Framing, setelah `av<19`
  terpasang.
  - Kenapa 3.14, menurut pengecekan PyPI 2026-10-16:
    - Python 3.15.0 (rilis 9 Okt) belum punya wheel Windows untuk
      ctranslate2, torch, dan onnxruntime, jadi belum bisa dipakai.
    - 3.14 didukung semua dependensi, termasuk av 18.1 (`cp311-abi3`),
      dan masih rutin mendapat rilis bugfix dengan installer Windows
      sampai 2030.
    - 3.11 dan 3.12 sudah security-only, sehingga python.org tidak lagi
      menyediakan installer. Itu alasan installer 3.11.15 tidak bisa
      ditemukan.
  - Buka lagi pertanyaan 3.15 setelah torch dan ctranslate2 merilis wheel
    `cp315`.
  - Setelah ini, `.venv` tidak lagi bergantung pada Python uv. Python
    3.12 global tidak dipakai klipian.

### P4 — Sisa-sisa library-projects

- **Selesai 2026-10-16** (`cb3983f`, `161eb77`). Keputusan ian: pilihan
  (a). Find clips memakai transkrip yang ada lewat
  `Cache.find_transcript`, dan transkripsi ulang menjadi tombol
  terpisah. Latar belakangnya:
  - Setelah 3b, editor, brief, dan render memakai
    `Cache.find_transcript`. Aturannya: transkrip dengan fingerprint
    persis kalau ada, kalau tidak ada, yang terbaru.
  - Job transkripsi (`jobs.py:~533`) masih hanya menganggap cache "kena"
    kalau fingerprint-nya persis. Fingerprint itu mencakup ukuran dan
    mtime video **serta isi `glossary.txt`**.
  - Akibatnya, mengubah glossary atau menyentuh file video membuat
    "Find clips" mentranskripsi ulang (sekitar 18 menit untuk 42 menit
    video). Padahal editor tetap menampilkan transkrip lama.
    radityadika-podcast sudah dalam keadaan ini.
  - Pilihan:
    - (a) Find clips memakai aturan yang sama, dan transkripsi ulang
      menjadi tombol terpisah;
    - (b) biarkan seperti sekarang, tapi UI memberi tahu kenapa
      transkripsi berjalan lagi.
- **Fallback `?video=` dan `legacyFile` di `/api/project`: dihapus**
  (keputusan ian 2026-10-17). Semua project sekarang memakai id,
  `projects/legacy/` sudah tidak ada, dan workspace sudah dikosongkan.
  Jembatan untuk link `/edit/<nama-lama>` tidak dibutuhkan lagi.
  Migrasi *bentuk* project lama (`_migrate_project`, diuji selftest
  `migrate`) tetap dipertahankan.
- Folder lama `out/radityadika-podcast/`, `out/cadera-gameplay-mlbb/`,
  dan `projects/legacy/` sudah dibersihkan (2026-10-17).

**Workspace dikosongkan (ian, 2026-10-17).** Semua isi selain `samples/`
(cache, out, projects, schedule, assets) dipindahkan ke Recycle Bin,
karena semuanya hasil coba-coba. Akibatnya:
- project podcast `ea8b7a796f48` dan Syahrini `21c71db3fb68` sudah tidak
  ada, jadi P3 mulai lagi dari awal dengan video di `samples/`;
- transkrip harus dibuat ulang lewat Find clips;
- selftest tetap lolos, karena baseline render memakai
  `samples/radityadika-podcast.mp4` dan fixture di `tests/`.
- **Tombol "Add video" di layar Assets** (diputuskan ian 2026-10-16).
  Video dipilih dari mana saja di disk lalu disalin ke
  `workspace/samples/`, jadi tidak perlu lagi menyalin manual lewat
  Explorer. Download dari link tetap nonaktif untuk sekarang; kodenya
  masih ada di `3eecf52` kalau nanti dibutuhkan.
  - Pakai pola yang sudah ada di `/api/project-asset-upload` (di
    server.py; nomor barisnya berubah setelah P2): body mentah, nama file di query, ditulis per
    potongan 1 MB ke `.part`, lalu `replace`. Batas 100 MB di sana khusus
    untuk gambar/suara; video berukuran ratusan MB sampai beberapa GB
    (Syahrini 742 MB), jadi butuh batas sendiri.
  - Progress unggah wajib ditampilkan. Memakai `fetch` tidak memberi
    progress unggah, jadi pakai `XMLHttpRequest` dengan `upload.onprogress`.
  - Kalau nama file yang sama sudah ada di `samples/` dengan ukuran sama,
    pakai file yang sudah ada (satu video bisa dipakai banyak project).
    Kalau ukurannya beda, beri nama baru lewat `_free_name`. Jangan
    pernah menimpa file lain.
  - Setelah selesai, video ditambahkan ke project lewat jalur yang sama
    dengan memilih dari `samples/` (`addVideoToProject`).
  - README bagian "Put your source videos in `workspace/samples/`" dan
    Troubleshooting "not reachable in the server's folder" ikut
    diperbarui.
  - Sekalian perbaiki teks UI yang basi (ditemukan saat P5): keadaan
    kosong di Home masih menulis "Drop a video to start your first clip."
    (`ui/index.html:125`) dan "Drop a video, set the format, then pick
    clips…" (`projects.js:622`). Ganti dengan arahan ke Add video.
  - Teks di panel ekspor Analyze juga menyesatkan (ditemukan
    2026-10-16, ian sempat mengira yang diekspor hanya subtitle):
    - judulnya "Export to JSON" (`index.html:371`), dan catatannya "drop
      the JSON to your AI" (`roundtrip.js:~129`), padahal file yang
      diunduh adalah `brief-claude-<video>.md`, berisi rubrik, format
      jawaban, momen keras, dan transkrip. Yang berformat JSON adalah
      **balasan** Claude.
    - Nama file unduhan diganti dari `brief-claude-<video>.md` menjadi
      **`brief-<video>.md`** (permintaan ian 2026-10-16,
      `roundtrip.js:~155`).
    - "No transcript yet. Run this first: klipian transcribe …"
      (`roundtrip.js:~123`) menyuruh memakai CLI, padahal tombol Find
      clips ada di layar yang sama.
  - Hapus juga banner komentar kosong sisa fitur lama:
    "source ribbon" (`app.js:427`), "candidates: approve, reject, undo"
    dan "ribbon: click a sweep…" (`interactions.js:70–73`). Di bawahnya
    tidak ada kode. `RIBBON_DURATION` (`app.js:596`) masih dipakai, jadi
    jangan ikut dihapus; cukup dinamai ulang kalau perlu.

### Dashboard `/workspace` dipertahankan

Diputuskan ian 2026-10-16. Panel **Rendered output** yang membuatnya
berguna: hasil render bisa dilihat tanpa membuka Explorer. Panel Clips
(jadwal upload) belum dipakai (`clips.json` berisi 0 baris), tapi tetap
dibiarkan.

Akibatnya untuk pekerjaan lain:
- Langkah P1.3 (thumbnail keluar dari `out/`) juga merapikan panel ini,
  karena `out/` tidak lagi berisi folder `thumbs`.
- Setiap perubahan pada `/api/history` atau susunan `out/` harus dicek
  di dua tempat: layar History di editor **dan** panel Rendered output
  di `/workspace`.

### P5 — Dokumentasi menyusul kenyataan

**Selesai 2026-10-16** (`2eb2980` README, `bef1d10` workspace/README,
`0389b75` ui-design). Beberapa klaim baru dibaca dari kode, belum dilihat
di layar: Mona Sans untuk merek dan watermark, pintasan `, . < > Space`,
Output Format per Result, dan Remove dua klik. Cek di browser setelah
transkripsi Syahrini selesai.

**Dicek di browser 2026-10-17:**

| Klaim | Hasil |
|---|---|
| Output Format per Result | benar: ada pemilih "Result 1" di layar, dan `output` tersimpan per Result |
| Remove dua klik | benar: klik pertama menampilkan "Remove? (2 spans too)", lalu kembali sendiri setelah ±4 detik |
| Mona Sans untuk merek dan watermark (`ui-design.md:21`) | **sebagian salah**: watermark memang Mona Sans ExtraBold, tapi merek "klipian" memakai Geist 800 bergradien |
| Pintasan hanya `, . < > Space`, "bukan ←/→" (`ui-design.md:54`) | **salah**: `←/→` ada saat timeline preview difokuskan (1 detik; Shift 5 detik), `player.js:~201` |
| "Video ditambahkan dari `workspace/samples/` di Assets" (`ui-design.md:56`) | **basi** sejak Add video |

Koreksinya dikirim ke sesi eksekusi bersama perapian alat dengar cues.

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

### P6 — Sinyal hook: deteksi suara dan timing, uji coba dulu, baru integrasi

Disetujui ian 2026-10-16, termasuk mengunduh model YAMNet. Semula hanya
untuk tawa; diperluas ian di hari yang sama ke semua sinyal di tabel
bawah. Antrean sesi eksekusi: setelah Add video.

**Kenapa perlu.** Saat ini Claude hanya menerima teks transkrip dan daftar
"momen keras", dan keduanya lemah:
- Whisper hanya menulis 6 kata mirip tawa ("hehehe") dalam 6045 kata
  podcast 42 menit, dan semuanya di 3 menit terakhir.
- `audio_energy` menemukan 45 momen, dan semuanya berpuncak di ≥ −0,5
  dBFS. Audionya sudah di-mastering mentok, jadi "paling keras" tidak
  bisa membedakan tawa dari bicara lantang.

**Sinyal yang dibangun** (angka contoh diukur dari radityadika-podcast):

| Sinyal | Cara | Arti untuk Claude |
|---|---|---|
| Tawa | YAMNet: Laughter, Giggle, Chuckle/chortle, Belly laugh, Snicker | payoff; klip berakhir **setelah** tawa selesai |
| Tepuk tangan / sorakan | YAMNet: Applause, Cheering | payoff kuat |
| Teriakan / kaget | YAMNet: Shout, Yell, Screaming, Gasp | momen emosi; sering jadi hook pembuka |
| Musik | YAMNet: Music | **hindari**: intro, outro, iklan, dan risiko hak cipta |
| Jeda dramatis | jeda ≥ 3 detik sebelum sebuah kalimat (8 kali di podcast ini; ≥ 1,5 detik ada 61, terlalu banyak) | pola "jeda, lalu pengakuan atau punchline" |
| Bicara mendadak cepat | kata per 10 detik di atas persentil 95 (median 24, maksimum 45) | antusias, cerita memuncak |
| Energi relatif | `audio_energy` dibandingkan dengan sekitar ±60 detik (RMS, bukan puncak), bukan dengan seluruh video | pendukung; mungkin dihapus kalau sinyal YAMNet sudah cukup, diputuskan dari hasil uji coba |

Ketiga sinyal YAMNet berasal dari **satu kali jalan** model. Jeda dan
bicara cepat hanya hitungan dari timestamp kata. YAMNet (Google, Apache
2.0, 16 MB) dijalankan lewat `onnxruntime`, yang sudah terpasang sebagai
dependensi faster-whisper, jadi **tidak ada paket baru**. File ONNX
disimpan di `assets/models/` bersama lisensinya, sama seperti YuNet.

**Uji coba (spike), tanpa menyentuh pipeline:**
1. Ambil YAMNet dari sumber resmi (Kaggle Models/TF Hub `google/yamnet`),
   lalu konversi ke ONNX di environment sementara di luar repo
   (tensorflow + tf2onnx). Jangan dipasang ke `.venv`; hapus environment
   itu setelah selesai. Jangan memakai file ONNX hasil konversi pihak
   ketiga. Unduhan dan pemasangan ini perlu konfirmasi langsung dari ian
   di sesi eksekusi.
2. Skrip uji coba terpisah dari paket `klipian`:
   - audio diambil lewat ffmpeg sebagai 16 kHz mono;
   - jendela YAMNet 0,96 detik dengan hop 0,48 detik;
   - indeks kelas diambil dari `yamnet_class_map.csv` berdasarkan nama,
     jangan di-hardcode;
   - frame yang berdekatan digabung menjadi rentang per jenis sinyal;
   - jeda dramatis, bicara cepat, dan energi relatif dihitung juga.
3. Jalankan pada radityadika-podcast dan Syahrini (transkripnya sudah
   ada sejak 2026-10-16 21:56), lalu catat waktu prosesnya.
4. Tulis keluaran ke `workspace/cache/cues-spike/<video>/`, bukan `out/`:
   - tawa: 20 kandidat teratas;
   - tiap sinyal lain: 5 teratas;
   - masing-masing berupa potongan WAV ±3 detik bernomor, plus
     `list.md` berisi waktu, skor, dan kata transkrip di sekitarnya;
   - jumlah total tiap sinyal per video.
5. ian mendengarkan 10 kandidat tawa teratas per video, dan 5 teratas
   untuk tiap sinyal lain.

**Hasil uji coba (2026-10-16, commit `3bac5aa`; skrip `tools/cues_spike.py` kemudian diganti `python -m klipian cues VIDEO --listen`, yang memakai `cues.py` dan cache yang sama dengan brief):**
- Model `assets/models/yamnet.onnx` berukuran **16 MB** (bukan ±4 MB).
  Dikonversi sendiri dari Kaggle `google/yamnet`; selisih skornya
  dengan SavedModel maksimal 1,7e-06.
- Cepat: sekitar 11–12 detik per episode 42–45 menit (decode ±3,5 detik,
  YAMNet ±6 detik).
- Jumlah temuan, podcast / Syahrini:

  | Sinyal | Podcast | Syahrini | Catatan |
  |---|---|---|---|
  | Tawa | 47 | 47 | 17 di podcast berpuncak ≥ 0,5 |
  | Tepuk tangan | 0 | 0 | |
  | Teriakan | 0 | 1 | |
  | Musik | 22 | 12 | podcast total hanya 0,5 menit |
  | Jeda ≥ 3 detik | 8 | 3 | |
  | Bicara cepat | 17 | 18 | |
  | Energi relatif ≥ +6 dB | 63 | 61 | terlalu banyak untuk bermakna |

- Rentang "hehehe" 2372–2385 detik **tertangkap tapi lemah**: puncak 0,45,
  peringkat 21 dari 47. Tawanya pelan dan tertimpa bicara (Speech 0,80).
- Dibandingkan dengan 10 kandidat yang dulu dipilih Claude tanpa data
  tawa: kandidat itu mencakup 27% episode dan memuat 6–7 dari 20 tawa
  teratas. Itu kira-kira sama dengan kebetulan. Lima dari 10 tawa
  teratas jatuh di 10 menit pertama, padahal Claude tidak memilih satu
  klip pun di sana. Jadi ada dua kemungkinan: detektornya meleset, atau
  data tawa memang akan menunjukkan momen yang selama ini terlewat. Hanya
  telinga yang bisa menjawab.

**Syarat lanjut ke integrasi:**
- tawa: minimal 7 dari 10 memang tawa, dan rentang "hehehe" di
  2372–2385 detik pada radityadika-podcast ikut tertangkap;
- sinyal lain: ian memutuskan per sinyal, ikut atau tidak. Sinyal yang
  mayoritas salah tidak ikut ke brief.

**Integrasi selesai 2026-10-16** (`e511a56` … `83d9b14`). Isinya:
- `klipian/cues.py`; tahap "cues" di Find clips; `GET /api/cues`;
- bagian brief "Audio & timing cues", menggantikan `audio_energy` yang
  dihapus;
- `cues` per kandidat saat import;
- chip ⓘ di Analyze, penanda di timeline Clips, dan lencana di saran AI.

Untuk podcast, bagian cues di brief berisi sekitar 70 baris, termasuk
26 tawa berlevel low. Kalau terlalu ramai, ubah tabel `LEVELS` di
`cues.py` (tidak perlu deteksi ulang). Mengubah `DETECT` perlu menaikkan
`CUES_VERSION`. File lama `workspace/cache/*.energy.json` sudah tidak
dipakai.

**Validasi pertama (2026-10-17, podcast, satu kali jalan Claude).**
Brief baru yang berisi cues dibandingkan dengan 10 kandidat lama yang
dibuat tanpa cues. Balasannya diproses lewat `parse_reply` dengan cues.

| | Lama (tanpa cues) | Baru (dengan cues) |
|---|---|---|
| Jumlah klip / cakupan episode | 10 / 25% | 8 / 14% |
| Klip di 10 menit pertama | 0 | 1 |
| Klip yang berakhir tepat setelah tawa | 0/10 | 3/8 |
| Tawa yang tertangkap (dibanding kebetulan) | 15/47 = 32% (kebetulan 25%) | 12/47 = 26% (kebetulan 14%), kira-kira 1,8× |

- Kelima waktu tawa yang disebut Claude di alasannya (13:37, 38:25,
  38:41, 21:39, 23:12) **cocok semua** dengan deteksi, termasuk
  tingkatnya. Claude membaca bagian cues dengan benar dan tidak
  mengarang.
- Lima klip lama bertahan, tiga pilihan baru, dan empat klip lama
  dibuang, di antaranya "Sirup" yang memuat tawa high di 11:08.
- Tujuh dari sepuluh tawa high tetap tidak dipilih. Sebagian besar
  memang bukan cerita yang bisa berdiri sendiri, misalnya basa-basi
  soal posisi duduk di 0:49. Tawa adalah penanda, bukan klip.
- Belum bisa disimpulkan dari satu kali jalan, karena Claude juga
  bervariasi antar percobaan.
- Tawa low ikut dipakai sebagai alasan, misalnya "tawa kecil di awal"
  2:50 untuk pilihan baru "Ketahuan Habis Belanja". Ketepatan level low
  belum pernah didengar.

  **Tindak lanjut:** dengarkan tawa low yang dipakai Claude (2:50, 20:47,
  23:09, 23:14, 38:41). Kalau sebagian besar salah, keluarkan level low
  dari brief lewat tabel `LEVELS`; tidak perlu deteksi ulang.

  **Hasil dengar ian (2026-10-17): 5 dari 5 memang tawa.** Padahal
  semuanya deteksi tersingkat (satu jendela, ±1 detik) dengan skor
  hanya 0,31–0,38. Level low **tetap masuk brief**, dan ambang 0,30
  dipertahankan. Kalau nanti ingin menangkap lebih banyak tawa pelan,
  ambang di bawah 0,30 baru boleh diuji dengan sesi dengar lagi.

**Perbaikan tampilan (permintaan ian 2026-10-16, setelah dicek di layar).**
Catatan "hook apa saja yang dicari" hanya muncul sebelum analisis suara
pertama kali jalan. Sesudahnya kalimat itu menyusut menjadi "found: 47
laughter · 1 shouts", terselip abu-abu di panel Transcribing. Chip di
langkah 2 juga redup (opacity 0,45) sampai transkrip ada.

Perbaikannya:
- bagian tetap **"Hooks Find clips listens for"** di atas tombol Find
  clips: enam baris dengan ⓘ dan status per sinyal;
- kalimat di panel Transcribing dirapikan;
- bentuk tunggal "1 shout".

**Keputusan ian (2026-10-16): lanjut integrasi tanpa sesi mendengarkan.**
Permintaannya: tawa dimasukkan ke brief **dan** ke result JSON, dan layar
Analyze memberi catatan sinyal apa saja yang tertangkap. Karena syarat
"7 dari 10" tidak diuji dengan telinga, dipakai nilai awal yang bisa
diubah:
- **Masuk brief:** tawa (semua ≥ 0,3, bertingkat), musik (sebagai
  "avoid"), jeda ≥ 3 detik, dan bicara cepat. Tepuk tangan, sorakan,
  dan teriakan tetap dideteksi dan masuk kalau ada; untuk podcast
  biasanya nol, dan chip-nya tampil "none found".
- **Energi:** bagian lama "Prominent audio-energy moments" (puncak global)
  diganti bagian baru. Energi relatif tidak masuk brief sendirian (63
  temuan, terlalu banyak); ia hanya ikut menentukan tingkat tawa.
- **Tingkat awal tawa:**
  - high: puncak ≥ 0,6, atau puncak ≥ 0,5 dan panjang ≥ 2,5 detik;
  - medium: puncak ≥ 0,45;
  - low: sisanya, asal ≥ 0,3.

  Dengan aturan ini, rentang "hehehe" 39:35 (puncak 0,45) masuk medium.
  Ambang disimpan di satu tempat, supaya mudah disetel setelah ian
  mendengar hasilnya.
- **"Result JSON":** saat balasan Claude diimpor, setiap kandidat diberi
  daftar `cues` yang jatuh di dalamnya atau sampai 5 detik sesudahnya.
  Ini dihitung oleh klipian, bukan Claude, jadi deterministik. Daftar itu
  disimpan di project dan tampil di kartu kandidat dan timeline Clips.

**Integrasi:**
- `klipian/cues.py`, dengan cache `<stem>.<fp>.cues.json`. Sinyal suara
  bisa langsung dihitung; jeda dan bicara cepat menunggu transkrip.
- Tahap baru di `_run_transcribe`, di sebelah `energy`: sekali per
  video, dan tidak fatal kalau gagal. Kegagalan dicatat, tidak ditelan
  diam-diam, karena UI harus bisa bilang "tidak terdeteksi" atau "gagal".
- **Brief:** satu bagian "Audio & timing cues", diurutkan menurut waktu.
  - Setiap rentang diberi **tingkat** low / medium / high (permintaan
    ian), contohnya `[12:05]–[12:09] laughter · high (4.1 s)` dan
    `[0:00]–[0:42] music · avoid`.
  - Tingkat dihitung dari skor, durasi, dan kerasnya dibanding sekitar.
    Ambangnya ditetapkan dari hasil uji coba, bukan ditebak.
  - Rubrik `dialog-podcast.md` ikut diperbarui: jelaskan tiap sinyal dan
    bagaimana tingkat memengaruhi skor hook, payoff, dan emosi.
  - Fixture brief di selftest sengaja diperbarui di commit yang sama.
- **UI, layar Analyze, panel ekspor** (permintaan ian): satu baris chip
  per sinyal yang menunjukkan apa yang tertangkap **dan masuk ke file
  brief**, misalnya `Laughter 23 · Applause 4 · Shout 2 · Music 3 (avoid)
  · Pauses 8 · Fast talk 12`.
  - Tiap chip punya ikon info ⓘ dengan tooltip singkat: apa sinyalnya,
    dari mana dideteksi, dan bagaimana Claude memakainya.
  - Chip redup dengan teks "none found" kalau jumlahnya nol, dan
    "not run" atau "failed" kalau deteksinya tidak jalan. Jangan sampai
    kosong diam-diam.
  - Ikon digambar sebagai SVG atau glyph teks seperti ikon lain di UI,
    bukan emoji (`ui-design.md` §3.1). Warnanya pakai token yang ada.
- **Layar Clips:** penanda per jenis sinyal di timeline, dengan legenda
  yang sama dengan chip.
- **Aturan batas klip:** klip berakhir setelah tawa atau tepuk tangan
  selesai. Hook tetap dicari dari kalimat sebelumnya.

### P7 — Temuan audit kedua (2026-10-17): kode, UI, fungsional

Diuji di server lokal dan browser (1024 px dan 1440×900), memakai project
Syahrini `21c71db3fb68` dan podcast. Semua data dipulihkan dari cadangan
setelah pengujian. Kesehatan kode tetap baik: tidak ada kode mati, dan
XSS aman. Judul berisi `<b>`/`<img onerror>` dari balasan AI tampil
sebagai teks.

**Tinggi**
1. **Server tidak memeriksa Host maupun Origin.**
   - Masalah: setiap situs yang sedang terbuka di browser bisa mengirim
     POST lintas-situs ke `127.0.0.1:5177`, misalnya memulai render atau
     transkripsi, mengunggah ke `samples/` (sampai 10 GB), menimpa
     project, atau membuka folder. DNS rebinding juga bisa *membaca*
     project dan transkrip.
   - Bukti: GET dengan `Host: evil.example` dijawab 200, dan POST
     `text/plain` dengan `Origin: https://evil.example` sampai ke handler.
   - Perbaikan, di pintu masuk `do_GET`/`do_POST`:
     - tolak Host selain `127.0.0.1:<port>` dan `localhost:<port>`;
     - tolak POST yang membawa Origin asing;
     - endpoint JSON wajib `Content-Type: application/json`, supaya
       browser memaksa preflight.
2. **Import balasan AI diam-diam mengganti semua saran lama.**
   - Masalah: 13 saran menjadi 1 tanpa konfirmasi dan tanpa undo.
   - Perbaikan: konfirmasi dua langkah ("Replace 13 suggestions?"),
     pilihan Replace / Add, atau minimal simpan set sebelumnya supaya bisa
     di-undo.

**Sedang**
3. **Pindah layar dianggap mengubah project.**
   - Masalah: Analyze, Output Format, Framing, dan Render memunculkan
     "Unsaved changes…" lalu `POST /api/project` setiap kali dibuka. Ada
     lebih dari 10 penulisan dalam satu menit, dan `at` berubah sehingga
     "x ago" dan "last opened" di Home ikut berubah.
   - Perbaikan: layar terakhir disimpan diam-diam, tanpa menandai project
     berubah.
4. **Saran lama tidak punya lencana hook.**
   - Masalah: 13 saran Syahrini diimpor sebelum cues ada, jadi tidak
     punya `cues`.
   - Perbaikan: hitung `cues.for_range` saat project dimuat atau
     ditampilkan untuk kandidat yang belum punya, bukan hanya saat import.
5. **Quick preview ditulis ke `out/<nama video>/.preview/`**
   (server.py `_post_preview`).
   - Masalah: folder bernama video muncul lagi di `out/`, yang dibaca
     dashboard. Untuk project multi-video, preview juga memakai nama
     video pertama.
   - Perbaikan: pindahkan ke `cache/previews/`, seperti thumbnail.
6. **Layar History bertentangan dengan dirinya sendiri.**
   - Masalah: tertulis "Nothing rendered yet", tapi di bawahnya tampil
     file render dari project lain.
   - Perbaikan: pisahkan "project ini" dari "project lain", atau perbaiki
     teks keadaan kosongnya.
7. **Panel "Transcribing" di Analyze menyesatkan.**
   - Masalah: panel tetap tampil saat tidak ada yang berjalan (progress
     kosong dan tulisan "You can leave this running"). Labelnya juga
     ditulis mati "large-v3-turbo · CPU 22 threads" (`index.html:355`),
     padahal transkripsi memakai 8 thread (`DEFAULT_THREADS`).
   - Perbaikan: sembunyikan panel atau tampilkan status "transcript
     ready", dan ambil model serta thread dari server.

**Rendah**
8. Quick preview tidak menunjukkan progres. Pernah sekitar 70 detik
   hanya bertuliskan "Rendering…", waktu itu laptop di baterai. Tampilkan
   setidaknya waktu berjalan.
9. Di lebar 1000–1200 px, judul di daftar AI suggestions menimpa kolom
   waktu.
10. Kartu di Home hitam polos selama thumbnail pertama dibuat. Perlu
    placeholder atau tanda loading.
11. `paths.find_video` menolak nama yang mengandung `..` di mana saja
    (misalnya `Wow... ep.mp4`), padahal Add video menerimanya. Unggahan
    berhasil, lalu video dinyatakan "not in samples". Cukup periksa
    komponen path, bukan substring.
12. `/api/import` dengan `clips: []` menjawab "JSON does not have a
    \"clips\" list.", padahal list-nya ada tapi kosong.
13. Sesi browser yang masih mengingat project yang sudah dihapus memicu
    404 di console. Hapus sesi tersimpan saat project tidak ditemukan.
14. Layar Timeline menyisakan bidang kosong besar di bawah inspector
    (`ui-design.md` §3.3).

### P8 — `samples/` menjadi `sources/`, dan panel Sources di dashboard

Keputusan ian (2026-10-17): nama `samples` terlalu ambigu. Kata itu juga
dipakai `facebox.py` untuk "sampel pengukuran". Struktur workspace
menjadi:

```
workspace/
├── sources/    video mentah (raw), satu salinan dipakai banyak project
├── assets/     library bersama: logo, banner, template (sudah ada)
├── projects/   project + aset per project + rekaman render
├── out/        hasil render per project
├── cache/      transkrip, cues, thumbnail, preview
└── schedule/   jadwal upload (dashboard)
```

1. **Ganti nama `samples` → `sources`** di kode, UI, dan dokumen (sekitar
   15 file):
   - server: `paths.py`, `server.py` (`WORKSPACE_SERVED`, upload),
     `jobs.py`, `projects.py`, `selftest.py`;
   - URL `/workspace/samples/…` yang dipakai pemutar;
   - label UI seperti "Add from workspace/samples/";
   - pesan galat "not in samples/";
   - kedua README dan `ui-design.md`.

   Arti lain kata "samples" di `facebox.py` tetap. Folder di disk
   dipindah **sekali**; tidak ada fallback ke nama lama, karena workspace
   baru dikosongkan dan tidak ada project yang merujuknya.
2. **`find_video` hanya mencari di `sources/`.** Sekarang fungsi itu juga
   mencari di root workspace dan di `out/`, sehingga hasil render bisa
   terbaca sebagai sumber. Itu melanggar keputusan "aset video = video
   mentah saja".
3. **Panel "Sources" di `/workspace`**, dengan gaya yang sama seperti
   panel Assets ("3 files in workspace/assets/"):
   - judul: `Sources` + `3 videos in workspace/sources/ · 1.4 GB`;
   - per baris: nama file, ukuran, durasi, tanggal masuk, status
     transkrip (transcribed / not transcribed, lewat
     `Cache.find_transcript`), dan **dipakai oleh project mana** (nama,
     atau "not used"), supaya video yang tidak dipakai mudah dikenali;
   - tombol `Open folder` untuk membuka `workspace/sources/`;
   - keadaan kosong: arahkan ke Add video… di layar Assets editor, atau
     salin file ke `workspace/sources/`;
   - urutan panel di dashboard: Clips → **Sources** → Rendered output →
     Assets (masuk → keluar → pendukung);
   - endpoint baru `GET /api/workspace/sources`. Durasi diambil dengan
     ffprobe dan di-cache per fingerprint, supaya dashboard tidak lambat.

### P9 — Tombol "Copy brief" di samping "Download file"

Keputusan ian (2026-10-17): dari daftar ide fitur, yang dikerjakan
sekarang hanya ini. Panel "Export for Claude" di Analyze punya dua
pilihan: **Download file** (seperti sekarang) dan **Copy** (brief
langsung ke clipboard, untuk ditempel ke chat Claude).

- Tombol Copy aktif dan nonaktif bersama tombol Download, mengikuti
  ada atau tidaknya transkrip.
- Isinya sama persis dengan file yang diunduh: `buildBrief` yang sama,
  dari `/api/brief`.
- **Brief diambil lebih dulu** begitu transkrip siap, lalu disimpan,
  supaya klik Copy langsung menulis ke clipboard tanpa menunggu fetch.
  Beberapa browser menolak `navigator.clipboard.writeText` kalau ada
  `await` panjang di antara klik dan penulisan. Kalau brief belum
  siap, pakai `ClipboardItem` dengan promise, atau fallback
  `<textarea>` + `execCommand('copy')`.
- Umpan balik: tombol berubah menjadi "Copied" selama ±2 detik, dan
  catatannya menulis `Copied · 51 KB · ~14,800 tokens · paste it into
  Claude`. Kalau gagal, tulis alasannya dan sarankan Download.
- `http://127.0.0.1` dan `http://localhost` termasuk *secure context*,
  jadi Clipboard API tersedia tanpa HTTPS.

Ide lain dari daftar yang sama (paste reply, render banyak saran, render
→ jadwal upload, preset caption, judul hook, notifikasi, transkripsi
massal, cari di transkrip, buang jeda) **belum dipilih**. Catatannya ada
di percakapan sesi analisis 2026-10-17, dan bisa diangkat kapan saja.

### P10 — Bentuk gambar 3:4 dan 16:9 di Output Format

Permintaan ian (2026-10-18): Output Format mendapat opsi **3:4** dan
**16:9 (horizontal)**, dalam dua cara:
- (A) hanya gambarnya yang 3:4 atau 16:9, sementara file tetap 9:16
  dengan latar;
- (B) file akhirnya sendiri berukuran 3:4 atau 16:9.

Keputusan ian:
- **bertahap**: A dulu, B setelah A dicoba;
- posisi gambar di dalam 9:16 **bisa diatur** (default di tengah);
- latarnya **hitam atau blur**;
- **default latar: Black** untuk 3:4 dan 16:9 yang baru dipilih (ian,
  2026-10-18). Result lama yang dulu "Blur background" tetap Blur: pilihan
  Background disimpan `null` selama belum dipilih, dan `output` lama
  berindeks Picture 16:9 tanpa entri Background dibaca sebagai Blur yang
  sudah dipilih (`applyOutput`, `app.js`). Request render atau CLI tanpa
  `background` tetap memakai default lama (blur).

**Kondisi sekarang** (dibaca dari kode 2026-10-18):
- `app.js` ~367: opsi `format` "Fill the 9:16 frame" punya pilihan
  Crop (`face`) dan Blur background (`blur`).
- File selalu 9:16 (`out_width`, dengan tinggi = lebar × 16/9).
- `render.build_filter`: `blur` menggabungkan semua span, membuat latar
  dari potongan 9:16 yang di-blur, lalu meletakkan frame utuh selebar W
  di tengah. `face` memotong per span dengan kotak framing berasio 9:16
  (`framing.js` `RATIO`, dan split 8:9 per sel).
- Caption, label, dan watermark ditulis di ruang 1080×1920
  (`render.REF_W/REF_H`, `compose.py`).
- Project menyimpan `output` sebagai **indeks** pilihan. Menyisipkan
  pilihan baru di depan akan menggeser arti indeks project lama; pilihan
  baru hanya boleh ditambahkan di belakang, atau disimpan di kunci baru.

**Tahap 1 (A): gambar 3:4 / 16:9 di dalam file 9:16**

- Output Format per Result:
  - **Picture**: `9:16` (seperti Crop sekarang) · `3:4` · `16:9`;
  - **Background** (muncul kalau Picture bukan 9:16): `Black` · `Blur`;
  - **Position** (muncul kalau Picture bukan 9:16): slider vertikal
    0–100%, default 50 = tengah, supaya gambar bisa digeser ke atas dan
    caption menempati area di bawahnya;
  - Resolution dan Quality tetap.
- **Kompatibilitas:**
  - project lama "Crop" = Picture 9:16;
  - project lama "Blur background" = Picture 16:9 + Background Blur +
    Position 50;
  - keduanya harus ter-render **byte-identical** seperti sebelumnya.
    res2 sudah dijaga selftest. Untuk Blur, render satu klip sebelum
    perubahan, lalu bandingkan sesudahnya, dan jadikan baseline selftest
    kalau praktis.
- **3:4:** kotak framing dikunci ke 3:4 (rasio di `framing.js`
  mengikuti Picture), termasuk AI Framing, head tracking, dan
  `track_head` di server. Hasilnya diskalakan ke lebar W (1080×1440 pada
  1080p), lalu diletakkan di kanvas 9:16 pada y = (H − h) × posisi.
- **16:9:** memakai frame utuh tanpa kotak crop, sama seperti Blur
  sekarang. Layar Framing memberi tahu bahwa 16:9 memakai seluruh frame.
- **Split (dua kotak)** hanya berlaku untuk Picture 9:16. Untuk 3:4/16:9
  pilihannya dinonaktifkan dengan keterangan.
- **Latar Black** = kanvas warna hitam. **Blur** = rantai blur yang
  sekarang, digeneralisasi untuk 3:4 juga.
- **Preview 9:16, quick preview, dan thumbnail** harus menunjukkan
  komposisi yang sama dengan hasil render: bar hitam atau blur, dan
  posisi gambarnya.
- Caption dan label tetap di ruang 1080×1920. Slider Y Position caption
  yang sudah ada bisa memindahkan caption ke area latar.
- Render multi-sumber dan pass compose (label, sticker, suara) tidak
  berubah, karena keduanya bekerja di kanvas 9:16.

**Tahap 2 (B): file akhir 3:4 dan 16:9** (baru setelah tahap 1 dicoba)

- Kanvas file mengikuti bentuk: 3:4 = 1080×1440, 16:9 = 1920×1080 pada
  1080p. Label resolusi mengacu ke sisi pendek.
- Ruang referensi caption, label, dan watermark per kanvas (ASS PlayRes),
  bukan dikunci 1080×1920.
- Panel preview, safe area, dan posisi default caption menyesuaikan
  bentuk.
- Baseline selftest baru per bentuk.

### P11 — Teks posting per klip, dan kredit sumber

Pertanyaan ian (2026-10-18): apakah judul, caption, dan hashtag bisa
dibuat dari JSON setiap klip, dan apakah sumber asli perlu dicantumkan.

Istilah: "caption" di klipian berarti subtitle yang dibakar ke video.
Teks saat mengunggah disebut **teks posting**.

Keputusan ian:
- teks posting dibuat Claude di balasan yang sama, ditampilkan dengan
  tombol Copy, dan otomatis membuat baris jadwal setelah render;
- kredit diisi **per video sumber**;
- label kredit di video **opsional per klip**.

**Catatan hak cipta** (disampaikan ke ian, bukan nasihat hukum): kredit
itu etis, sering diwajibkan kreator yang membuka program clipper, dan
YouTube Shorts punya "Related video" untuk menautkan episode asli.
Tapi **kredit bukan izin**. Mengunggah ulang tanpa izin tetap berisiko
klaim Content ID atau strike.

**A. Kredit per video sumber**
- Disimpan sebagai data pengguna, bukan cache:
  `workspace/sources/credits.json`, berisi
  `{ "<nama file>": { platform, creator, title, url } }`. Ikut
  dibersihkan kalau videonya dihapus dari Sources.
- Diisi dan diedit di panel **Sources** dashboard (per baris), dan
  terlihat (dengan link edit) di layar Assets editor untuk video
  project.
- **Bentuk baris kredit ditentukan klipian, bukan Claude**, supaya tidak
  ada nama atau link yang dikarang. Contoh:
  `Sumber: YouTube Raditya Dika — "Apa Kabar Syahrini" (url)`. Kalau
  Result memakai beberapa video, kreditnya digabung tanpa duplikat.
- Brief menyertakan info sumber di kepala, misalnya
  `Source: YouTube · Raditya Dika · "Apa Kabar Syahrini"`, supaya Claude
  tahu siapa kreator dan bintang tamunya. Brief juga melarang Claude
  menulis baris kredit sendiri.

**B. Teks posting dari Claude**
- Format jawaban di brief mendapat bagian opsional per klip:
  `"post": { "title", "caption", "hashtags" }`.
- Aturan di rubrik `dialog-podcast.md`, bagian baru "Teks posting":
  - `title`: judul unggahan, maksimal 70 karakter, boleh lebih panjang
    dari judul file 2–5 kata;
  - `caption`: 1–3 kalimat bahasa santai sesuai podcast, diakhiri
    pertanyaan atau ajakan, tanpa hashtag di dalamnya;
  - `hashtags`: 5–8 tag huruf kecil, memuat nama kreator atau tamu kalau
    relevan, tanpa tag menyesatkan;
  - dilarang clickbait bohong dan dilarang mengaku sebagai kreator.
- `parse_reply` menerima `post` sebagai opsional. Balasan lama tanpa
  `post` tetap terbaca. Fixture brief dan import diperbarui dengan
  sengaja, ditambah satu balasan fixture yang memuat `post`.
- `post` disimpan di kandidat, lalu dibawa ke Result saat
  ditambahkan. Result campuran memakai `post` kandidat pertama. Rentang
  manual mulai dengan kolom kosong.

**C. Layar Render: panel "Post text"**
- Isinya Title, Caption, dan Hashtags yang bisa diedit (tersimpan per
  Result), ditambah pratinjau baris kredit otomatis.
- Tombol Copy:
  - **Copy title**;
  - **Copy description** (caption + baris kosong + hashtag + baris
    kosong + kredit);
  - **Copy hashtags**.

**D. Jadwal upload otomatis**
- Setelah render selesai, buat baris **Draft** di
  `schedule/clips.json`, dengan isi:
  - title dari `post.title` (atau judul Result);
  - hook, file hasil render, `episode` = baris kredit;
  - `description` dan `tiktokCaption` = blok deskripsi seperti di atas.
- Baris ditautkan ke project id + result id. Render ulang Result yang
  sama **memperbarui** baris itu (file selalu, kolom teks hanya kalau
  masih kosong), jadi editan ian di dashboard tidak tertimpa.

**E. Label kredit di video (opsional per klip)**
- Tombol "+ Credit" di Timeline menambahkan label teks kecil, misalnya
  `Sumber: YouTube · Raditya Dika`, di posisi default yang tidak
  mengganggu caption.
- Label ini bisa diedit dan dipindahkan seperti label lain, dan tidak
  pernah ditambahkan otomatis.

### P12 — Sudut pandang per klip: nilai tambah di atas potongan

Latar belakang: pada 1 Okt 2026 YouTube mengumumkan bahwa rekomendasi
Shorts akan lebih mengutamakan konten orisinal dan **mengurangi
jangkauan kanal yang terutama mengunggah ulang klip orang lain tanpa
perubahan berarti**.
- Yang *tidak* dihitung orisinal: crop, flip, kecepatan, filter, caption
  hasil transkripsi, dan edit template. Output klipian apa adanya
  termasuk kategori ini.
- Yang dihitung: komentar sendiri, edit yang unik, dan penceritaan.
- Monetisasi tetap mengikuti kebijakan *reused content*.

Sumber: laporan pihak ketiga yang mengutip TeamYouTube, misalnya
outlierkit.com dan relevantaudience.com, 2026-10-18. Tanggal efektifnya
belum dikonfirmasi YouTube.

Ian setuju mencobanya (2026-10-18).

**Prinsipnya: Claude menyarankan, ian yang memiliki.** Saran sudut
pandang adalah draf. Nilai orisinalnya datang dari pandangan ian, jadi
semuanya bisa diedit dan tidak pernah dipasang otomatis. Teks
buatan AI yang selalu berpola sama bisa saja dinilai YouTube sebagai
"template". Klipian tidak menjanjikan apa pun soal algoritma.

**Tahap 1: saran berbasis teks**
- **Balasan Claude** mendapat bagian opsional per klip:
  ```json
  "angle": {
    "take":  "satu kalimat: sudut pandang atau kenapa momen ini penting",
    "intro": "teks pembuka ≤ 12 kata, ±2–3 detik, membingkai klip dari sudut pandang clipper",
    "notes": [ { "at": "0:14", "text": "komentar pop-up ≤ 8 kata" } ]
  }
  ```
  - `intro` **bukan** ringkasan kutipan, melainkan konteks atau
    pandangan yang belum dimiliki penonton.
  - `notes`: 0–3 komentar singkat; `at` relatif terhadap awal klip.
- **Rubrik `dialog-podcast.md`**, bagian baru "Sudut pandang":
  - harus menambah sesuatu: konteks, pendapat, kaitan ke topik yang
    lebih luas, atau pertanyaan;
  - jangan mengulang kutipan;
  - jangan merendahkan atau menyerang tamu, jangan menyesatkan;
  - jangan mengaku sebagai kreator;
  - bahasa santai sesuai podcast;
  - variasikan pola antar klip, jangan semua dimulai dengan kalimat
    yang sama.
- **`parse_reply`:** `angle` opsional, dengan normalisasi seperti
  `post`. Waktu `notes` dibatasi ke durasi klip. Disimpan di kandidat dan
  dibawa ke Result.
- **UI, panel "Angle"** di layar Render, di samping Post text, atau di
  Timeline:
  - menampilkan take, intro, dan notes, semuanya bisa diedit;
  - **"Add intro"** memasang `intro` sebagai label teks di awal klip
    (0 – ±2,5 detik, posisi atas atau tengah, kotak gelap);
  - **"Add notes"** memasang `notes` sebagai label bertimer di waktu
    output yang sesuai (dipetakan dari waktu di dalam klip);
  - semuanya elemen Timeline biasa: bisa dipindah, diubah, dihapus, dan
    tidak pernah dipasang otomatis.
- `take` juga bisa dipakai ian sebagai bahan caption teks posting. Ia
  tidak otomatis masuk ke `post.caption`.

**Tahap 2 (nanti, setelah tahap 1 dicoba): voiceover sendiri**
- Merekam suara ian dari mikrofon langsung di aplikasi (MediaRecorder)
  sebagai elemen suara Timeline, memakai skrip `intro` sebagai contekan.
- Volume diatur manual, sesuai keputusan lama "tanpa ducking otomatis".
- Ini kontribusi orisinal yang paling kuat.

**P12b — ukuran label di preview disamakan dengan render** (ian, 2026-10-19;
render jadi acuan dan tidak diubah, semua baseline selftest tetap)
- Penyebab: libass memakai ukuran font ASS sebagai tinggi baris penuh
  (ascent + descent), CSS memakai em. Mona Sans ExtraBold: unitsPerEm 1000,
  hhea 1090 / -320, jadi em = 1000/1410 = 0,709 dari ukuran ASS, dan satu baris
  = ukuran ASS. Preview memakai ukuran ASS sebagai em: label 1,41x terlalu besar,
  dan tinggi kotaknya terlalu kecil.
- Terukur di render (34, 56, 72, 96): tinggi kotak = ukuran + 36 (padding 18 di
  tiap sisi), jarak antarbaris = ukuran, huruf kapital H = 0,50 ukuran, outline
  tetap 5 unit, kotak digambar per baris dan tumpang tindih, semua kotak di
  bawah semua teks.
- Sesudah kalibrasi (compose.js `LABEL_EM`, `LABEL_LINE`, `LABEL_PAD`,
  `LABEL_OUTLINE`, kotak per baris dalam dua lapis), preview vs render: tinggi
  kotak 70/92/108/132 sama persis; lebar kotak "Perhatikan bagian ini"
  283,5/446,8/565,5/743,6 vs 284/442/558/732 (selisih terbesar 1,6%); lebar
  "HHHH" 109,8/158,2/193,4/246,1 vs 110/158/194/246; dua baris ukuran 96:
  227,9 x 141,1 vs 228 x 142.
- Watermark: masalah yang sama (font sama). Preview 70/102/147 vs render
  50/72/102 pada ukuran 22/32/46 (1,4x); sekarang 49,7/72,3/104. Diubah.
- Caption karaoke: TIDAK cocok dan tidak diubah. Tinggi huruf kapital Arial
  84 di render 52 unit vs 63 di preview (sekitar 1,2x; metrik Arial:
  hhea 1854/-434 per 2048 = 1,117 em per baris), dan lebar "HHHH" beda lebih
  jauh karena bobot 800 disintesis. Pilihan font caption banyak, tiap font
  punya metrik sendiri, jadi koreksinya per font; layak jadi pekerjaan
  tersendiri.

**P12c: laporan ian 2026-10-19, dari layar Render (Result 11).**
Ian bingung cara kerja Post text dan Angle, label intro tidak bisa
dihapus dari layar Render, dan teks label keluar dari kotaknya di preview.

1. **Bug preview: teks keluar dari kotak.**
   - Penyebab: di `compose.js` (`drawOverlays`), lapisan kotak
     (`.ov-box > span`) memakai padding horizontal, sedangkan lapisan
     teks (`.ov-fg`) tidak. Lebar isi kedua lapisan berbeda, sehingga
     lapisan kotak dipotong menjadi dua baris sementara teks tetap satu
     baris. Hasilnya kotak dan teks tidak sejajar. Bug ini masuk lewat
     `6f47f68`.
   - Render (libass) tidak terkena.
   - Perbaikan: kedua lapisan harus dipotong ke baris secara identik,
     misalnya dengan padding horizontal transparan yang sama di
     `.ov-fg`, atau padding kotak lewat `box-shadow`/`outline` yang
     tidak mengubah lebar.
2. **Angle mengelola labelnya sendiri.**
   - Label yang dibuat Add intro dan Add notes diberi tanda asal
     (misalnya `origin: "angle-intro"` / `"angle-note-<n>"`).
   - Di panel Angle, setiap baris menunjukkan statusnya ("on the video")
     dengan tombol **Remove**.
   - Mengubah teks Intro atau Note memperbarui label yang tertaut.
   - Menghapus label di Timeline mengubah statusnya kembali menjadi
     "Add".
   - Label tanpa tanda asal tidak tersentuh.
3. **Penjelasan di UI.**
   - **Post text** = teks untuk diunggah dan tidak masuk ke video.
   - **Angle** = draf ide; hanya intro dan notes yang masuk ke video,
     dan hanya kalau ditambahkan.
   - Penjelasannya singkat, di kepala masing-masing panel, ditambah satu
     baris "Labels on the video: edit or delete them here or on the
     Timeline".

**P11b: laporan ian 2026-10-19, dari dialog Detail jadwal upload.**
1. **Bug: Post text dan Angle bocor ke Result berikutnya.**
   - Bukti di project ca457bc104b4 ("Bocah-bocah Jadi Ibu-ibu"):
     - res16 (segmen "Sewa Rumah Buat 10 Kucing") membawa `post` dan
       `angle` milik res15 ("Kebiasaan Aneh Cewek Saat Ngaca…");
     - res22 membawa milik res21 ("Sabun yang Wanginya Kayak Kerang").
   - Akibatnya, jadwal upload punya dua baris berjudul sama untuk klip
     yang berbeda.
   - Dugaan: kolom panel tidak dikosongkan saat Result baru dibuat atau
     dipilih, lalu isi yang tertinggal tersimpan ke Result baru.
   - Perbaikan:
     - setiap kali Result berganti atau dibuat, panel diisi dari Result
       itu sendiri (kosong kalau tidak punya);
     - tambahkan tombol "Refill from suggestion" untuk mengisi ulang dari
       kandidat Result itu sendiri;
     - data ian **tidak** diubah otomatis.
2. **Dialog Detail di dashboard:**
   - kolom Description dan TikTok caption terlalu kecil (3 baris);
   - kolom lain (Source episode, YouTube/TikTok link, Notes) nyaris tidak
     terlihat;
   - belum ada tombol Copy.
   - Perbaikan:
     - dialog lebih lebar;
     - textarea tumbuh mengikuti isinya, minimal ±8 baris dan maksimal
       ±45% tinggi layar, lalu scroll;
     - semua kolom terlihat jelas sebagai kolom input;
     - tombol Copy untuk title, description, dan TikTok caption;
     - tombol Open untuk link yang sudah terisi.
3. **Pagination di semua tabel** (permintaan ian, 2026-10-19).
   - Tabel di dashboard: Clips (jadwal upload, sekarang 19 baris),
     Sources, Rendered output, dan Assets. Di editor: History.
   - Perilaku seragam lewat satu komponen bersama:
     - ukuran halaman bisa dipilih (10/25/50, default 10) dan diingat per
       tabel di `localStorage` (try/catch);
     - Prev/Next dan nomor halaman, plus keterangan `1–10 of 19`;
     - kontrol pagination disembunyikan kalau semua baris muat satu
       halaman;
     - setelah baris dihapus atau ditambah, halaman tetap masuk akal;
     - baris baru dari render muncul di urutan yang sama seperti
       sekarang.
   - Jumlah di judul panel (misalnya "19 clips · 16 draft · 3 posted")
     tetap menghitung semua baris, bukan hanya halaman aktif.

### P13 — Framing: titik 00:00 selalu ada, dan lock tidak terbawa antar Result

Laporan ian (2026-10-19), kata-katanya: "pastikan lock frame di menit
00:00 di tengah. kadang saya buat lock frame menit 2 ternyata menit 00
belum di-lock … framing lock terbawa walaupun beda result".

**Bukti di data ian** (dibaca, tidak diubah):
- Project Syahrini `85f92e4cce2d`, **res3** (klip 2225,3–2283,1 detik)
  punya 12 titik framing. Titik pertamanya di 1980,3, dan **9 titik di
  1980–2015 berada di luar klipnya**. Rentang itu persis rentang **res4**
  (klip 1980,3–2022,0). Artinya, titik lock res4 tersimpan juga di res3.
- Titik framing disimpan dalam **detik sumber**, dan `pointAt(t)`
  mengambil titik terakhir yang ≤ t. Akibatnya, di awal klip res3 yang
  terpakai adalah titik nyasar dari res4, bukan titik 00:00 di tengah.
  Ini cocok dengan keluhan "menit 00 belum di-lock".
- Project lain tidak punya titik di luar klipnya. Banyak Result hanya
  punya titik `auto` (placeholder, belum pernah di-lock); itu normal.

**Kondisi kode** (`framing.js`, `projects.js`, `player.js`):
- `resetFraming()` membuat titik placeholder `{at: 0, auto: true}` dengan
  `initialCrop()`, yaitu crop tengah (`left 37, width 26` untuk 9:16,
  `left 30, width 39` untuk 3:4).
- `setClip()` memindahkan placeholder itu ke awal klip selama masih
  `auto`.
- `snapshotActiveResult()` menyimpan `FRAMING` (global) ke slot Result
  aktif. Ini mekanisme yang sama dengan bocornya Post text/Angle di
  P11b: kalau `FRAMING` masih milik Result lain saat snapshot, titiknya
  ikut tersimpan.

**Perbaikan:**
1. **Pemilik state per Result untuk SEMUA state live**, bukan hanya
   Post text/Angle. Mencakup `FRAMING`, `CORRECTIONS`, overlay/Timeline,
   `output`, `RESULT`, dan `post`/`angle`. Satu guard di
   `snapshotActiveResult`: kalau state live bukan milik Result aktif,
   jangan pernah menulis ke slot itu; isi ulang dari slot.
   Reproduksi dulu jalurnya, misalnya Result selector di layar
   Framing/Timeline/Render, menambah saran saat Result lain aktif, atau
   memindah rentang di Clips.
2. **Titik di awal klip selalu ada.**
   - Setiap Result punya titik framing yang tepat di awal klip (momen
     pertama) dengan crop tengah sesuai Picture (9:16/3:4).
   - Titik ini dibuat otomatis, tetap ada walaupun ian me-lock titik lain
     yang lebih lambat, dan ikut bergeser kalau awal klip berubah, selama
     ian belum mengeditnya.
   - Di strip Framing points, titik ini tampil sebagai `00:00 · centered
     (default)`, supaya jelas sudah ada dan terkunci di tengah. Begitu
     ian mengeditnya, labelnya berubah menjadi titik biasa.
   - Titik ini tidak bisa dihapus (aturan lama "the 00:00 point always
     exists").
3. **Titik di luar klip tidak dipakai.**
   - Saat memuat dan saat render, titik framing yang jatuh di luar
     semua rentang Result itu diabaikan, kecuali titik awal-klip.
   - Untuk data lama, di layar Framing ada keterangan
     `9 framing points outside this clip` dan tombol **Remove them**,
     dikonfirmasi dua klik. Tidak dihapus otomatis.
   - Render ulang Result yang terkena (res3) setelah dibersihkan.

### P14 — Edit waktu manual: snap kecil, searah, dan terlihat

Laporan ian (2026-10-19): mengedit waktu saran dari JSON Claude,
misalnya akhir 03:10 diubah menjadi 03:12, kadang "menolak" dan kembali
ke 03:11 atau 03:13.

**Penyebab** (`result.js` `commitRecTime`, `roundtrip.js` `snapToWord`,
`app.js` `timeRange`):
- waktu yang diketik digeser ke batas kata **terdekat** sampai
  `SNAP_MAX = 2,0` detik, ke arah mana pun;
- tampilannya dibulatkan ke bawah ke detik penuh (`timeRange` memakai
  `Math.floor`);
- tidak ada pemberitahuan bahwa waktunya digeser.

Contohnya, kata yang berakhir di 191,7 tampil sebagai 03:11, dan kata
yang berakhir di 193,2 tampil sebagai 03:13. Snap 2 detik memang
dibutuhkan untuk waktu perkiraan dari Claude, tapi terlalu jauh untuk
waktu yang sengaja diketik.

Kondisi lain: `setSelection(..., snap)` di `timeline.js` (from/to di
layar Clips, setelah drag) memakai snap yang sama.

**Keputusan ian (2026-10-19):**
- **Hanya untuk ketikan manual** (waktu saran AI di Clips, from/to
  Clips, dan field waktu lain yang diketik). Snap saat import balasan
  Claude tetap 2,0 detik dan ke kata terdekat.
- **Snap maksimal 0,6 detik dan searah:**
  - awal: start kata terakhir yang ≤ waktu ketik dalam 0,6 detik; kalau
    tidak ada, start kata pertama setelahnya dalam 0,6 detik; kalau
    tidak ada juga, waktu persis;
  - akhir: end kata pertama yang ≥ waktu ketik dalam 0,6 detik; kalau
    tidak ada, end kata terakhir sebelumnya dalam 0,6 detik; kalau
    tidak ada juga, waktu persis.

  Dengan aturan ini, klip tidak terpotong lebih pendek dari yang
  diketik.
- **Persepuluhan detik** ditampilkan di field waktu yang bisa diedit
  (`mm:ss.s`), supaya nilai tersimpan terlihat.
- **Beri tahu kalau digeser**, misalnya: `end moved to 03:12.4, the end
  of "kata", so no word is cut. Type 03:12.0 for exactly 03:12.`
- **Desimal = waktu persis tanpa snap:** mengetik `03:12.0` atau
  `192.5` dipakai apa adanya. `parseTime` menerima `mm:ss.s`,
  `h:mm:ss.s`, dan detik polos.

### P15 — Kolom "Created" dan urutan di tabel Clips dan Rendered output

Permintaan ian (2026-10-19), kata-katanya: "tabel result clips tambahkan
header order by file tersebut dibuat". Keputusan ian: **kedua tabel**
(Clips jadwal upload dan Rendered output), **default terbaru di atas**.

**Kondisi sekarang:**
- Baris jadwal (`schedule/clips.json`) punya `at`, tapi nilainya
  **diperbarui setiap kali baris disimpan** (`server.py` ~957 dan ~1173,
  `schedule.py` ~94). Jadi `at` adalah "terakhir diubah", bukan "dibuat",
  dan tidak bisa dipakai.
- Rendered output (`/api/history`) sudah diurutkan dengan `st_mtime`
  terbaru di atas, tanpa kolom waktu yang jelas dan tanpa header yang bisa
  diklik.

**Yang dibuat:**
- **Clips:**
  - kolom baru **Created** = waktu file klip itu dirender, yaitu waktu
    pembuatan file hasil render di `out/<slug>.<projectId>/<file>`
    (`st_birthtime`, cadangannya mtime);
  - untuk baris tanpa file (dibuat lewat "+ New clip"), dipakai waktu
    baris dibuat;
  - simpan `createdAt` yang stabil di baris (diisi saat dibuat, tidak
    pernah diubah oleh edit);
  - migrasi sekali untuk baris lama: ambil waktu file kalau filenya
    ada, kalau tidak pakai `at`.
- **Rendered output:** kolom **Created** = waktu pembuatan file.
- **Kedua tabel:**
  - header **Created** bisa diklik untuk membalik urutan (▼ terbaru di
    atas sebagai default, ▲ terlama di atas);
  - pilihan urutan diingat per tabel di `localStorage`;
  - pengurutan dilakukan **sebelum** pagination;
  - format tanggal absolut (`18 Oct 14:32`) dengan tooltip relatif
    ("2 hours ago");
  - baris baru (render atau "+ New clip") tampil di posisi yang benar
    sesuai urutan aktif.

### P16 — Upload otomatis ke YouTube Shorts (DITUNDA, rencana saja)

Permintaan ian (2026-10-19): upload otomatis dari jadwal, mulai dari
YouTube Shorts, sekaligus memperbarui baris di `/workspace` Clips. Ian
memutuskan **menunda dulu dan menyiapkan rencananya**.

**Jalurnya:** YouTube Data API v3 (`videos.insert`) dengan OAuth milik
ian. Otomasi klik YouTube Studio lewat browser **tidak** dipakai, karena
melanggar ketentuan layanan YouTube dan mudah rusak.

**Batasan dari Google** (sumber pihak ketiga, dicek 2026-10-19; pastikan
lagi di dokumen resmi sebelum mulai):
- Project Google Cloud yang **belum lolos audit** (dibuat setelah 28 Juli
  2020): video hasil upload API **terkunci private** dan tidak bisa
  dibuka. Supaya bisa publik, project harus lolos **YouTube API Services
  compliance audit**.
- Kuota per project: angka 1.600 unit per upload dari 10.000 per hari,
  atau 100 upload per hari sejak Juni 2026, masih simpang siur. Cek di
  Cloud Console. Untuk 1–3 Shorts per hari, keduanya cukup.
- OAuth client berstatus "Testing": refresh token kedaluwarsa setelah
  ±7 hari, jadi perlu Connect ulang mingguan. Status "In production"
  tanpa verifikasi Google memunculkan layar "unverified app" saat ian
  login sendiri, tapi token bertahan lama. Ian yang memilih.

**Persiapan ian (di luar klipian):**
1. Google Cloud Console, login dengan akun Google pemilik kanal, lalu
   buat project baru (misalnya `klipian`).
2. APIs & Services → Library → **YouTube Data API v3** → Enable.
3. Layar persetujuan OAuth (Google Auth Platform):
   - tipe External;
   - nama app, email support;
   - tambahkan email sendiri sebagai **Test user**;
   - scope `youtube.upload` dan `youtube.readonly`.
4. Credentials → Create credentials → **OAuth client ID** → tipe
   **Desktop app** → unduh JSON-nya, lalu simpan sebagai
   `workspace/secrets/client_secret.json` (`workspace/*` tidak masuk git).
5. Catat kuota upload di halaman Quotas.
6. **Audit** dikerjakan *setelah* Tahap 1 jadi, karena formulirnya butuh
   penjelasan dan demo cara aplikasi dipakai. Sesi analisis akan
   menyusunkan teks pengajuannya. Sampai audit lolos, upload hanya
   untuk uji (private).

**Tahap 1 (klipian), satu klip dari jadwal:**
- dependensi opsional `requirements-youtube.txt` (`google-api-python-client`,
  `google-auth-oauthlib`), seperti AI Framing;
- `klipian/youtube.py`, berisi OAuth loopback dan token di
  `workspace/secrets/` (tidak pernah dikirim ke browser atau ditulis ke
  log);
- tombol **Connect YouTube** di dashboard (menampilkan nama kanal);
- tombol **Upload to YouTube** per baris/Detail:
  - file, title (≤100), description, tags dari hashtag;
  - `publishAt` dari upload date + time; kalau kosong, langsung publik;
  - `selfDeclaredMadeForKids` = false;
  - cek: video vertikal dan ≤ 3 menit;
- upload resumable sebagai job latar belakang, dengan progress dan
  cancel;
- setelah selesai, baris diperbarui: status Scheduled/Posted,
  `youtubeUrl`, `videoId`;
- pengaman upload dobel; pesan yang jelas untuk kuota habis dan video
  terkunci private karena belum diaudit;
- tombol **Check status**.

**Tahap 2:** "Schedule all Ready" (upload massal dengan jadwal masing-masing).

**Tahap 3:** TikTok Content Posting API (aplikasinya juga perlu review).

### P17 — Nama file render = judul unggahan, dipisah "-"

Saran ian (2026-10-19): nama file disamakan dengan title/hook, karena
YouTube mengisi judul otomatis dari nama file, dan menurut ian YouTube
membaca `podcast-radit` sebagai "podcast radit".

Bahwa YouTube Studio mengisi judul default dari nama file sudah umum
diketahui. Pengubahan "-" menjadi spasi belum terkonfirmasi dari sumber
resmi; ian cukup cek sekali dengan satu upload. Setelah P16 jalan,
judul akan diisi lewat API, jadi aturan ini terutama berguna untuk
upload manual.

**Sekarang:** `render.safe_filename(k["title"])` memakai judul Result
(2–5 kata), lalu **mengubah semuanya menjadi huruf kecil**. Contohnya
`dihujat-fans-gara-gara-peluk-artis.mp4`. Judul unggahan (`post.title`)
tidak dipakai. Dua Result dengan judul sama akan menulis ke file yang
sama di folder project dan saling menimpa; ini sempat terjadi pada
res15/res16 karena bug P11b.

**Aturan baru:**
- **Sumber nama**, urut: `post.title` → judul Result → judul segmen
  pertama → `clip-N`.
- **Huruf besar dan kecil dipertahankan.** Spasi menjadi `-`; tanda
  hubung yang sudah ada tetap (`Gara-gara`); karakter yang dilarang
  Windows (`<>:"/\|?*`), emoji, dan simbol lain dibuang. Huruf Unicode
  dan angka tetap dipakai. Separator ganda dirapatkan, tanpa `-` di awal
  atau akhir, dan panjang maksimal ±100 karakter. Aturan nama perangkat
  Windows yang dicadangkan (`CON` dan sejenisnya) tetap berlaku.
  Contoh: `Dihujat-Satu-TikTok-Gara-gara-Peluk-Artis.mp4`.
- **Tidak saling menimpa:** kalau nama itu sudah dipakai file Result
  lain di folder project yang sama, tambahkan `-2`, `-3`, dan seterusnya.
  Render ulang Result yang sama boleh menimpa file miliknya sendiri.
- **Kalau judul berubah lalu dirender ulang:** file baru memakai nama
  baru, dan baris jadwal mendapat `file` baru. File lama **tidak
  dihapus** (aman); History menampilkan keduanya.
- File yang sudah ada tidak diganti namanya. Aturan baru hanya berlaku
  untuk render berikutnya.
- Satu aturan untuk server dan CLI. Byte isi video tidak berubah, jadi
  baseline selftest tetap identik.

### P18 — Menyamakan status jadwal dengan video yang sudah diunggah

Keluhan ian (2026-10-19): bingung menyamakan video yang sudah diunggah
dengan baris di Clips, karena status harus diubah satu per satu.
Keputusan ian: **kerjakan B dulu**, dan A setelah ian menyiapkan Google
Cloud.

**B — Edit massal dan tempel link (dikerjakan sekarang):**
- Kolom **centang** per baris di tabel Clips, ditambah centang "pilih
  semua di halaman ini". Pilihan bertahan saat pindah halaman (P11b),
  dan jumlah yang dipilih ditampilkan.
- Bilah aksi muncul kalau ada yang dicentang:
  - **Mark as Posted**: status Posted, tanggal dan jam unggah = sekarang
    (bisa diubah sebelum diterapkan); tanggal yang sudah terisi tidak
    ditimpa;
  - **Set status…** untuk status lain (Ready, Scheduled, Discarded);
  - **Clear selection**.
- **Tempel link mengisi status:** di dialog Detail, mengisi YouTube link
  atau TikTok link otomatis:
  - mengubah status Draft/Ready menjadi **Posted**;
  - mengisi tanggal dan jam unggah kalau masih kosong;
  - menyesuaikan platform kalau perlu.

  Link yang tidak valid ditolak dengan pesan. Menghapus link tidak
  menurunkan status otomatis.
- Satu kali simpan per aksi massal (server menerima daftar id). Edit
  massal tidak mengubah `createdAt` (P15).

**A — Sync from YouTube (setelah ian menyiapkan Google Cloud; tanpa
audit):**
- Persiapan sama dengan P16 sampai OAuth client Desktop app, cukup
  dengan scope `youtube.readonly`. Audit Google hanya berlaku untuk
  upload, jadi tidak diperlukan di sini. Alternatif API key hanya
  membaca video publik (tidak termasuk yang terjadwal/private).
- Tombol **Sync from YouTube** di dashboard:
  - mengambil daftar video kanal (uploads playlist: id, judul, status,
    `publishAt`/`publishedAt`);
  - mencocokkan ke baris jadwal lewat judul yang dinormalisasi (huruf
    kecil, tanpa tanda baca/hashtag); kalau gagal, lewat nama file
    (judul default YouTube = nama file, lihat P17);
  - **layar konfirmasi** dengan kelompok cocok / mungkin cocok / tidak
    ketemu; ian mencentang, lalu klik Apply;
  - baris yang dikonfirmasi: status Posted/Scheduled, `youtubeUrl`,
    tanggal dan jam tayang, dan `videoId`.
- Baris yang sudah punya `videoId` dilewati, kecuali status di YouTube
  berubah.

### P19 — Sinkron file render ↔ jadwal, dan kerapian tabel Clips

**A. Sinkron** (keputusan ian 2026-10-19). Menghapus file render tidak
mengubah baris jadwal, dan baris itu tidak tahu filenya sudah hilang.
Aturannya: **tidak ada yang dihapus otomatis.**
- Baris Clips yang `file`-nya tidak ada lagi di folder project di `out/`
  mendapat tanda **file deleted**:
  - status **Draft/Ready**: tandanya menyarankan membuang baris, dengan
    aksi cepat "Discard" atau "Delete row", keduanya dikonfirmasi;
  - status **Posted/Scheduled**: tanda informatif saja, dan baris tetap
    dipertahankan. Menghapus file lokal setelah posting itu wajar; baris
    jadwal adalah catatan apa yang sudah diposting.
  - Ada filter atau penghitung "N with deleted files" di kepala panel,
    dan bisa dipilih massal lewat centang P18.
- **Rendered output:** file yang tidak punya baris jadwal (dirender
  sebelum P11, atau barisnya sudah dihapus) diberi tanda **not in
  schedule** dan tombol **Add to schedule**. Tombol itu membuat baris
  Draft dari rekaman render/Result kalau ada (title, post text, kredit,
  projectId/resultId), atau dari nama file saja.
- Render ulang yang membuat file lagi otomatis menghilangkan tanda file
  deleted.
- Pemeriksaan dilakukan saat panel dimuat (server membandingkan dengan isi
  `out/`), tanpa job latar belakang.

**B. Kerapian tabel Clips** (screenshot ian 2026-10-19, kata-katanya:
"style select box tidak tengah simetris"):
- Sel memakai `align-top`, sehingga checkbox, tanggal Created, dan tombol
  Detail lebih tinggi daripada select dan input lain.
- Isi select Status dan Platform, posisi panah, dan padding-nya tidak
  simetris.
- Perbaikan:
  - semua sel rata tengah secara vertikal;
  - tinggi semua kontrol dalam satu baris sama (select, input
    tanggal/jam, tombol, checkbox);
  - select dengan padding kiri-kanan yang sama dan panah di posisi tetap;
  - ikon input tanggal/jam terlihat jelas.

### P20 — Konfirmasi dan undo saat menghapus

Pertanyaan ian (2026-10-19): "apakah tidak ada verifikasi saat delete data di
clips?" Ternyata ✕ di tabel Clips langsung menghapus. Keputusan: ✕ jadi dua
klik, ada "Deleted · Undo" beberapa detik, dan semua tombol hapus lain diaudit.

**Pembagian:** aksi yang menghilangkan catatan penting (baris jadwal, project)
dikonfirmasi dua klik DAN bisa di-undo. Aksi kecil yang mudah diulang di
editor (satu momen, satu titik framing, satu elemen Timeline) tidak
bertanya, cukup diberi Undo. Undo di editor hanya berlaku untuk Result yang
sedang terbuka: kalau sudah pindah Result, Undo menolak dengan pesan, karena
state itu sekarang milik Result lain (lihat `liveOwner`, P13).

**Mekanisme:**
- `ui/js/shared/armed.js`: `armedClick(btn, {armedText, strong})` (klik
  pertama menyalakan "Delete?" selama 4 detik, klik kedua melanjutkan) dan
  `showUndoToast(text, onUndo)` (±8 detik, satu per waktu).
- Baris jadwal: server menyimpan baris yang dihapus (semua kolom dan
  posisinya) di `workspace/schedule/clips.trash.json` (200 terakhir) SEBELUM
  menghapus. Undo memanggil `/api/workspace/clips/restore`; baris kembali
  persis, termasuk `createdAt`. Karena penghapusan sungguhan terjadi di
  server segera setelah dua klik, menutup tab saat notifikasi tampil tidak
  menghilangkan apa pun yang tidak dimaksudkan: barisnya tetap ada di trash
  dan bisa dikembalikan lewat endpoint yang sama.
- Project: salinan JSON-nya disimpan di `workspace/projects/.trash/` (20
  terakhir) sebelum dihapus; Undo memanggil `/api/project/restore`.
- Hapus massal ("Delete selected" di bilah aksi P18): konfirmasi menyebut
  jumlah ("Delete 3 clips?"), dan lebih tegas bila ada yang Posted/Scheduled.

| Tombol | Layar | Sebelum | Sekarang |
|---|---|---|---|
| ✕ baris Clips | Dashboard | langsung hapus | dua klik ("Delete?"; "Delete posted clip?" merah tegas untuk Posted/Scheduled) + Undo |
| Delete row (file hilang, P19) | Dashboard | dua klik | dua klik + Undo |
| Discard (file hilang, P19) | Dashboard | dua klik | tetap (hanya mengubah status, bisa diubah lagi) |
| Delete selected | Dashboard | belum ada | baru: dua klik dengan jumlah + Undo |
| Hapus project (×) | Home | kartu konfirmasi Keep/Delete | tetap + Undo (salinan di `.trash`) |
| × Result | Editor | dua klik | tetap (tidak diubah) |
| Remove aset/video | Editor | dua klik + jumlah yang ikut hilang | tetap |
| Remove them (titik framing di luar klip, P13) | Editor | dua klik | tetap |
| ✕ momen di Result | Editor | langsung | Undo |
| Clear Result | Editor | langsung | Undo |
| Hapus filler words | Editor | langsung | Undo |
| Reset koreksi kata | Editor | langsung | Undo |
| × titik framing | Editor | langsung | Undo |
| Delete elemen Timeline (tombol dan tombol Delete/Backspace) | Editor | langsung | Undo |
| Remove label Angle | Editor | langsung | tetap: bisa ditambahkan lagi dengan Add (teksnya tetap di panel) |
| Undo import (saran Claude) | Editor | sudah ada | tetap |
| Sources, Rendered output, Assets | Dashboard | tidak ada tombol hapus | tidak berubah |

### P21 — Profile per channel, tanpa password (DITUNDA, rencana saja)

Ide ian (2026-10-20): nanti akan ada lebih dari satu akun klipian. Sudah ada
"klipian podcast", dan mungkin menyusul "klipian" untuk cuplikan lucu dari TV
atau YouTube. Usulnya ada pilihan seperti sign in, tanpa password, cukup
profile. Setiap profile bisa upload otomatis dengan akun YouTube yang
berbeda. **Status: dicatat saja, belum dikerjakan** (keputusan ian
2026-10-20).

**Konsep:** satu profile untuk satu channel. Setiap profile punya sources,
projects, render, jadwal Clips, assets, dan akun YouTube sendiri. klipian
berjalan di komputer ian, jadi tidak perlu password. Profile hanya pemisah
data, bukan pengaman.

**Susunan folder:**
```
workspace/
  cache/                 ← tetap dipakai bersama (transkrip, cue, probe, thumbs)
  profiles/
    podcast/             ← isi workspace sekarang dipindah ke sini
      profile.json       (nama, warna, pengaturan bawaan)
      sources/ projects/ out/ schedule/ assets/ secrets/
    lucu/ ...
```
- `cache/` dipakai bersama karena isinya per video. Video yang sama di dua
  profile tidak perlu ditranskripsi ulang.
- **Migrasi:** isi workspace sekarang menjadi profile "podcast" lewat skrip,
  dengan cadangan dan pengecekan sebelum dan sesudah, seperti saat rename
  video `Ibu-ibu .mp4`. Tautan render `/workspace/out/...` dibaca dari profile
  yang sedang dipakai, jadi data project lama tidak perlu ditulis ulang.
- **Yang belum diputuskan:** apakah satu source boleh dipakai di dua
  profile. Usulnya: source terpisah per profile, dan transkripnya diambil
  dari cache bersama.

**Profile dipilih per tab, bukan per server.**
- Hari ini `WORKSPACE` adalah konstanta yang disalin saat import:
  - `paths.py`: `WORKSPACE`
  - `projects.py`: `PROJECTS`
  - `schedule.py`: `CLIPS_PATH`, `OUT_DIR`, `TRASH_PATH`
  - `server.py`: `ASSETS_DIR`
  - `credits.py`, `jobs.py`
  - `cli.py`: `DEFAULT_CACHE`, `DEFAULT_OUT`
- Rancangan:
  - Setiap permintaan API membawa profile, misalnya lewat header.
  - Server menyimpannya di `contextvars` per permintaan, lalu
    `paths.workspace()` membacanya. Server tidak menyimpan "profile aktif"
    global.
  - Job render atau analisis menyalin context saat mulai, jadi tetap menulis
    ke profile asalnya meskipun tab pindah profile.
- Alasannya: dua tab bisa memakai dua profile tanpa saling menimpa. Ini
  masalah yang sama dengan kebocoran Result dan Post (`liveOwner`, P13).
- Pengaturan di localStorage diberi awalan profile, misalnya
  `klipian:preset-caption` dan `klipian:sesi-aktif`. `klipian:theme` tetap
  global.

**Tampilan:**
- Halaman pertama berisi pilihan profile (kotak nama dan warna) dan
  "+ Profile baru". Satu klik untuk masuk.
- Chip profile berwarna di topbar untuk berpindah, supaya tidak salah
  mengedit channel.
- Pengaturan bawaan per profile: teks watermark, rubrik bawaan, dan preset
  caption.
- Hapus profile dengan dua klik (`armedClick`, P20), lalu foldernya masuk
  Recycle Bin.

**Upload YouTube per profile** (ditautkan ke P16 dan P18-A):
- `client_secret.json` cukup satu dan dipakai bersama (`workspace/secrets/`).
- Token login disimpan per profile di `profiles/<id>/secrets/`. Tiap
  profile login dengan akun atau channel-nya sendiri.
- Halaman profile menampilkan "Terhubung ke: <nama channel>". Upload dari
  Clips selalu memakai akun profile itu.
- Selama OAuth client berstatus "Testing", setiap akun Google harus
  didaftarkan sebagai test user.
- Dua channel dalam satu akun Google (Brand Account) dipilih saat login.
- P21-A sebaiknya selesai sebelum P16, supaya P16 langsung dibuat per
  profile.

**Tahapan:**

| Tahap | Isi |
|---|---|
| P21-A | Folder per profile, migrasi "podcast", profile per permintaan (`contextvars`), dan selftest yang membuktikan dua profile tidak saling bocor |
| P21-B | Halaman pilih profile, chip di topbar, buat/ganti nama/hapus, dan pengaturan bawaan per profile |
| P21-C | Login YouTube per profile (bagian dari P16/P18-A) |
| P21-D | Rubrik baru `prompts/rubrik/` untuk cuplikan lucu TV/YouTube. Perlu masukan ian soal kriteria "lucu yang layak diklip" |

---

## 3. Diparkir, sengaja tidak dikerjakan

- **Mode gameplay.** ian tidak akan mengklip MLBB dalam waktu dekat
  (diputuskan 2026-10-16). Kalau nanti dibuka lagi: layout split (dua
  kotak bertumpuk) sudah ada di `framing.js`. Yang kurang:
  - pilihan rubrik di UI (`roundtrip.js` masih hardcode
    `dialog-podcast.md`; setelah P2.2 ini tinggal satu parameter);
  - sinyal hype/announcer ke brief (`audio_energy.py` sudah ada);
  - preset framing per streamer.

- **Migrasi JS ke ES modules** (`type="module"`, `import`/`export`). Ini
  perbaikan nyata untuk utang nomor 4, tapi menyentuh 14 file sekaligus
  dan tidak bisa diverifikasi oleh selftest render. Kerjakan hanya jika
  global state mulai menimbulkan bug, atau pecah per file saat file itu
  sedang disentuh untuk alasan lain.
- **Migrasi ke React/FastAPI seperti di brief desain:** tidak perlu.
- **Menerapkan glossary baru ke transkrip lama** (dinilai 2026-10-16,
  setelah Find clips memakai transkrip yang ada; `cb3983f`, `161eb77`).
  - Jangan terapkan saat transkrip dimuat. Transkrip hanya menyimpan
    teks yang *sudah* dikoreksi, jadi tidak ada teks mentah untuk
    dikoreksi ulang.
  - `Glossary.apply` aman kalau dijalankan sekali, tapi tidak kalau dua
    kali: fix `a→b` lalu `b→c` akan mengubah `a` menjadi `c`.
  - Fix yang dihapus dari glossary juga tidak pernah ditarik dari
    transkrip lama.
  - Efek terbesar glossary sebenarnya ada di hotwords dan
    initial_prompt saat Whisper berjalan, dan itu tidak bisa diulang.
  - Rancangan aman kalau nanti dibutuhkan: mulai transkripsi berikutnya,
    simpan teks mentah per kata (field `raw`), lalu sediakan aksi
    eksplisit "Re-apply glossary" yang selalu bekerja dari `raw`. Untuk
    transkrip yang sudah ada, satu-satunya jalan tetap Transcribe again.
- **Ribbon sumber** (elemen tanda tangan di `ui-design.md` §7). Ribbon ini
  sudah tidak ada di UI; yang tersisa hanya banner komentar kosong, yang
  ikut dibersihkan bersama Add video. Kartu kandidat dengan skor dan
  stempel juga tidak ada. **Dilepas dari brief desain** (keputusan ian
  2026-10-17). Timeline di layar Clips sudah menjadi penggantinya: saran
  AI tampil sebagai blok dan hook sebagai penanda, di sepanjang durasi
  episode.
- **Opsi B dari 2.3** (penyusunan request render pindah ke server). Buka
  lagi kalau ian butuh render tanpa UI. Saat itu, baseline hasil 3a
  menjadi jaring pengamannya.
