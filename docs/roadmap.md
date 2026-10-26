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

### P16 — Upload otomatis ke YouTube Shorts (DIBANGUN 2026-10-20; TERUJI NYATA 2026-10-22)

**Uji nyata ian (2026-10-22):**
- Upload terjadwal dari klipian (project `klipian-podcast`, status OAuth Testing, belum diaudit) berubah dari Scheduled menjadi **Public** pada waktunya. Video tidak terkunci private, jadi **audit belum diperlukan** untuk saat ini.
- Upload massal terjadwal di profile **klipian lucu** (project kedua, channel kedua) berhasil.
- Deteksi "locked private" (peringatan audit) tetap dipertahankan, karena kebijakan Google bisa berubah.

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
- Kuota per project, **dicek ian di Cloud Console 2026-10-20** (project
  `klipian-podcast`):
  - **Video Uploads per day = 100** dan **Video Uploads per minute = 100**,
    sebagai kuota upload tersendiri;
  - Queries per day = 10.000 untuk panggilan lain (`channels.list`,
    `videos.list`, cek status);
  - Search Queries per day = 100.

  Jadi upload massal dibatasi **100 video per hari per project**, jauh di
  atas kebutuhan 1–3 Shorts per hari. **Terbukti (ian, project
  `klipian-lucu`, 2026-10-22):** `videos.insert` TIDAK memakan unit Queries
  per day. 12 upload plus cek status hanya memakai 15 dari 10.000 Queries
  per day; upload hanya dihitung di **Video Uploads per day** (12/100),
  dan percobaan yang ditolak ikut dihitung (12 = 10 selesai + 2 ditolak).
  YouTube juga punya batas upload harian per channel sendiri
  (`uploadLimitExceeded`), di luar kuota API: di project itu antrean
  berhenti di video ke-11 oleh batas channel, bukan kuota project.
- **Satu project Google Cloud untuk satu channel** (ian 2026-10-20 membuat
  project `klipian podcast`). Kuota tiap channel jadi terpisah. Untuk P21-C,
  `client_secret.json` disimpan **per profile** di
  `profiles/<id>/secrets/client_secret.json`. File bersama di
  `workspace/secrets/` hanya menjadi cadangan untuk profile yang belum punya
  client sendiri.
- **Status persiapan ian (2026-10-20), project `klipian-podcast`:**
  - YouTube Data API v3 aktif;
  - OAuth consent screen External, status Testing, dengan test user dan
    scope `youtube.upload` + `youtube.readonly`;
  - OAuth client Desktop app "klipian desktop";
  - `workspace/secrets/client_secret.json` (dicek: tipe `installed`,
    project `klipian-podcast`, di-ignore git).

  Migrasi P21-A memindahkan file itu ke
  `profiles/podcast/secrets/client_secret.json`. Channel kedua memakai
  project sendiri, dan file JSON-nya **tetap bernama `client_secret.json`**
  di `profiles/<id>/secrets/` miliknya. Foldernya yang membedakan, bukan
  nama filenya. Pengaturan profile (P21-C) sebaiknya punya tombol
  "Choose client_secret.json" supaya ian tidak perlu memindah file
  sendiri. Audit belum diajukan.
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

**P16 Tahap 1, yang dibuat (2026-10-20):** upload satu baris dari dialog Detail.
- `youtube.prepare(row)` memeriksa sebelum apa pun dikirim: sudah punya `videoId`
  (tolak, cegah dobel), judul ada dan ≤ 100 (tanda `<>` dibuang), deskripsi ≤ 5000,
  file render ada (bukan "file deleted"), video vertikal dan ≤ 3 menit (ffprobe), dan
  tanggal+jam: dua-duanya terisi dan di masa depan (lewat/terisi sebagian ditolak);
  tanpa keduanya hanya boleh bila diminta "Publish now" (dua klik, merah tegas).
  `publishAt` = tanggal dan jam lokal baris dikonversi ke UTC (privacy `private` +
  `publishAt`); tag dari hashtag di deskripsi (maks 15); `selfDeclaredMadeForKids` false.
- Upload resumable per 8 MB sebagai job latar belakang (`_Net.upload`), dengan progress
  dan Cancel (dicek antar-chunk), satu upload per baris pada satu waktu. Setelah selesai
  baris diisi: `videoId`, `youtubeUrl` (shorts), status Scheduled/Posted, platform
  mencakup YouTube, `uploadedAt`, dan tanggal/jam bila publish-now. Gagal = baris tidak
  berubah. Pesan jelas: kuota habis (`quotaExceeded`/`uploadLimitExceeded`), token
  kedaluwarsa (`invalid_grant`/401), offline, 403/400 YouTube. Setelah upload `videos.list`
  mengecek apakah YouTube mengabaikan jadwal: kalau video tetap private tanpa `publishAt`
  (project belum lolos audit) job memberi peringatan "locked private".
- **Check status**: `videos.list part=status`; tampil Public/Scheduled/Private (locked)/
  sedang diproses/ditolak; video Scheduled yang sudah public di YouTube menjadi Posted.
- Guest: ditolak server (403). Dokumen: `selftest` check `upload` memakai Google palsu.

**P16 Tahap 2b, yang dibuat (2026-10-21):** cek status otomatis untuk baris Scheduled.
- `youtube.refresh_due()` (POST `/api/youtube/refresh-due`, Guest 403): baris profile ini
  berstatus Scheduled, punya `videoId`, dan tanggal+jam lokalnya sudah lewat (+2 menit
  toleransi). Id dikirim berkelompok (`_Net.video_statuses`, `videos.list part=status`,
  50 id per panggilan = 1 unit kuota, jadi 70 video = 2 panggilan). Hasil dibaca dengan
  aturan yang sama seperti Check status (`read_status`): public → Posted; masih terjadwal →
  dibiarkan; locked / rejected / processing / removed → status tidak diubah, baris diberi
  `ytWarning` (+ `ytWarningText`), dilaporkan sekali saja.
- Tenang: tidak tersambung, offline, atau tidak ada yang jatuh tempo adalah jawaban
  (`skipped`), bukan error. Paling banyak satu pengecekan sungguhan per profile per 10 menit
  (di memori dan `secrets/youtube-refresh.json`, jadi tahan restart); tombol Check status
  di Detail tidak kena batas itu.
- Dashboard: dipanggil saat panel Clips dimuat, tiap 10 menit selama halaman terlihat, dan
  sekali saat halaman kembali terlihat setelah tersembunyi lebih dari 10 menit. Tabel digambar
  ulang dan muncul toast hanya bila ada yang berubah ("N clip is now Posted on YouTube");
  peringatan tampil sebagai toast, chip kecil di samping status, dan di bagian YouTube pada
  Detail. Editor tidak memakainya.
- selftest `refresh`: due/belum (waktu depan, masa toleransi), batch 50, Posted, scheduled
  tetap, locked/removed/processing jadi peringatan sekali, profile lain tidak tersentuh,
  tidak tersambung/offline/tidak ada yang due, throttle (termasuk setelah restart) dan
  bypass Check status, Guest 403.

**P16 Tahap 2, yang dibuat (2026-10-20):** upload massal.
- Dua jalan masuk: "Schedule all Ready (N)" di kepala panel Clips dan "Upload to YouTube…"
  di bilah aksi P18 (baris terpilih). Keduanya membuka **rencana** dulu
  (`/api/youtube/bulk-plan`, tidak mengirim apa pun): daftar yang akan diunggah (judul,
  waktu tayang), daftar yang ditolak dengan alasannya (tidak ada file / "file deleted",
  tanpa judul, judul > 100, tanggal+jam kosong atau lewat, file tidak terbaca, sudah
  punya `videoId`), dan angka kuota hari ini (`UPLOAD_QUOTA_PER_DAY` = 100 per profile,
  hasil ukur ian; dihitung klipian per hari Pasifik, `secrets/youtube-usage.json`) dengan
  peringatan "N tidak muat hari ini dan tetap seperti semula". **Bulk tidak pernah
  publish langsung**: baris tanpa tanggal/jam ditolak (single upload punya "Publish now").
- Antrian (`start_bulk`): satu file demi satu, per-baris state (pending/uploading/done/
  failed) dan progress; Cancel berhenti setelah file yang sedang dikirim; berhenti bersih
  pada error kuota, token kedaluwarsa, atau offline (sisanya dibiarkan seperti semula,
  tampil "not sent"), atau pada batas kuota lokal. Error lain per baris (mis. 400)
  menandai baris itu gagal dan lanjut. Satu antrian per profile pada satu waktu; setiap
  baris diperiksa ulang tepat sebelum dikirim. Tiap profile memakai token dan client-nya
  sendiri. Dialog bisa ditutup (antrian jalan terus; toast saat selesai).
- selftest `bulk`: rencana (penolakan dan kuota), urutan, berhenti pada kuota, cancel,
  satu antrian per profile, penghitung harian.

**P16, penempatan hashtag per profile (2026-10-20):** judul Shorts biasanya memuat hashtag.
- Pengaturan profile "Hashtag placement": **Title** (bawaan untuk semua profile, termasuk
  yang sudah ada), Description (perilaku lama), atau Both; ditambah "Hashtags in the title"
  (2 atau 3, bawaan 3) dan "Add #shorts to the title" (bawaan mati). Disimpan di
  `profile.json` (`hashtagPlacement`, `titleTags`, `addShorts`).
- Diterapkan **saat upload** (`youtube.prepare`, single dan bulk) lewat `klipian/hashtags.py`,
  bukan saat baris disimpan. Baris menyimpan daftar `hashtags` (diisi `upsert_render`
  dari `post.hashtags`, tidak menimpa edit manual); baris lama tanpa daftar itu dibaca dari
  baris deskripsi yang hanya berisi hashtag. Mode Title: judul = judul baris + N hashtag
  pertama (satu per satu selama ≤ 100 karakter, berhenti di yang tidak muat, tag yang sudah
  ada di judul dilewati) + `#shorts` di akhir (tambahan di luar N); deskripsi tanpa baris
  hashtag, baris kosong dirapatkan. Both: judul seperti Title, deskripsi lengkap. Description:
  seperti dulu. Field API `tags` selalu memuat semua hashtag (dinormalisasi: huruf kecil, hanya
  huruf/angka/garis bawah, tanpa duplikat, maks 15) ditambah `shorts` bila aktif. Judul baris
  yang sudah > 100 tetap ditolak.
- Detail dialog: kolom "Hashtags" (daftar di baris) dan pratinjau "On YouTube" (judul dan
  deskripsi persis yang akan dikirim, live). Rencana bulk menampilkan judul akhir. "Copy title"
  dan "Copy description" di layar Render mengikuti penempatan yang sama.
- `ui/js/shared/hashtags.js` adalah salinan logika Python; selftest `hashtags` menjalankan
  keduanya (node) pada 12 kasus dan mensyaratkan jawaban yang sama.
- **Brief dan impor (tambahan, 2026-10-20):** brief (Copy brief / Download) kini memuat blok
  "Hashtags for this profile" yang dibangun saat brief dibuat dari pengaturan profile
  permintaan, dengan angka konkret ("the first 3 hashtags in the YouTube title, plus #shorts.
  `post.title` + ' ' + the first 3 hashtags + ' #shorts' must be at most 100 characters in
  total"; mode Description: "Hashtags go in the description only … title at most 100 characters
  and no hashtags"; Both). Teks rubrik statis tetap menjadikan "judul maks 70" sebagai target
  gaya, blok yang dibangun adalah batas keras. AI juga diminta `post.youtubeTitle` (judul akhir
  persis seperti di YouTube, sebagai contoh bentuk jadi). klipian TIDAK memercayainya: saat impor
  server menyusun judul akhir sendiri dari title + hashtags (`hashtags.plan`) dan, bila judul
  yang diinginkan profile (judul + N hashtag + #shorts) melewati 100 karakter, menambah
  `postWarning` pada kandidat; Post panel menampilkan pratinjau "On YouTube" dan peringatan yang
  sama secara langsung (`hashtagWarning`, kembaran JS) sebelum render. `youtubeTitle` yang
  berbeda dari susunan klipian diabaikan tanpa peringatan; balasan lama tanpa `youtubeTitle`
  tetap valid. Fixture: `brief.md` diperbarui (blok hashtag dengan aturan Title N=3 + #shorts
  dan contoh `youtubeTitle`), balasan baru `with-youtube-title.txt` dan entrinya di
  `imports.expected.json`; kasus peringatan panjang judul ada di check `brief`.
- Rubrik `dialog-podcast.md` ("Teks posting"): hashtag diurutkan dari yang paling spesifik,
  tanpa `#shorts`, tanpa spasi. Fixture brief punya salinan rubrik sendiri, jadi tidak perlu
  diubah.

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
audit; BELUM dibangun). Catatan 2026-10-20: karena profile, Sync berjalan
per profile dengan token profile itu sendiri (`secrets/youtube.json`) dan
hanya butuh `youtube.readonly`, yang sudah diminta saat Connect (scope
`youtube.upload` + `youtube.readonly`), jadi tidak ada persiapan Google
tambahan. Yang dicocokkan adalah baris jadwal profile itu saja.**
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

### P21 — Profile per channel, tanpa password (DIBANGUN 2026-10-20: A, B, G, C; TERUJI NYATA 2026-10-22 dengan dua channel; D dikerjakan di P26)

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
- **Satu source boleh dipakai di beberapa profile** (keputusan ian
  2026-10-20: antar profile tidak ada hubungan apa pun). Yang
  berlaku:
  - Setiap profile menyimpan source di `sources/`-nya sendiri, dengan
    project, render, jadwal, dan kredit (`credits.json`) masing-masing.
  - Tidak ada tautan, sinkron, atau peringatan "dipakai di profile lain".
    Menghapus atau mengganti nama di satu profile tidak memengaruhi
    profile lain.
  - Transkrip, cue, dan thumbnail diambil dari `cache/` bersama, yang
    kuncinya fingerprint video. Video yang sama di profile kedua langsung
    siap tanpa transkripsi ulang.
  - Hemat disk (opsional): Add video boleh membuat hardlink NTFS kalau file
    identik sudah ada di profile lain pada drive yang sama. Hardlink tetap
    dua nama yang berdiri sendiri, jadi menghapus satu tidak menghapus
    yang lain. Kalau beda drive atau gagal, file disalin biasa.

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

**Pengaturan profile → Akun YouTube** (permintaan ian 2026-10-20: "untuk
saat ini youtube dulu saja"). Ditautkan ke P16 dan P18-A.

Setiap profile punya bagian **Akun YouTube** di pengaturannya. Platform lain
(TikTok, Instagram) belum masuk. Bagian ini dirancang sebagai daftar akun
per platform, jadi platform lain nanti cukup menambah baris tanpa mengubah
susunannya.

- **Kredensial:**
  - `client_secret.json` (OAuth client Desktop app) **per profile** di
    `profiles/<id>/secrets/`, karena satu project Google Cloud untuk satu
    channel (lihat P16). File di `workspace/secrets/` hanya cadangan.
  - Token disimpan per profile di `profiles/<id>/secrets/youtube.json`.
  - Token tidak pernah dikirim ke browser, ditulis ke log, atau masuk git.
    Browser hanya menerima status.
- **Tautkan akun:**
  - Tombol "Connect YouTube" membuka login Google lewat OAuth loopback,
    sama seperti di P16.
  - Scope yang diminta: `youtube.upload` dan `youtube.readonly`.
  - Akun Google dan channel dipilih di halaman Google. Untuk Brand Account,
    channel dipilih di layar itu.
  - Setelah berhasil, klipian langsung memanggil `channels.list mine=true`
    dan menyimpan nama channel, ID, dan thumbnail-nya sebagai label.
- **Satu channel hanya untuk satu profile:** kalau channel yang dipilih
  sudah tertaut ke profile lain, klipian menolak dengan pesan "Channel X
  sudah dipakai profile Y". Ini mencegah dua profile meng-upload ke
  channel yang sama tanpa sengaja.
- **Cek validitas** (tombol "Check connection", juga otomatis saat halaman
  pengaturan dibuka dan sebelum setiap upload): klipian me-refresh token
  lalu memanggil `channels.list mine=true`. Statusnya satu dari:

  | Status | Arti | Tindakan yang ditawarkan |
  |---|---|---|
  | Tidak tertaut | belum ada token | Connect YouTube |
  | Tertaut ✓ | token bisa di-refresh dan channel cocok; tampil "dicek <waktu>" | Check connection, Disconnect |
  | Kedaluwarsa | refresh ditolak (`invalid_grant`), biasanya karena token "Testing" berumur ±7 hari atau akses dicabut | Connect ulang |
  | Channel berbeda | token valid tapi channel-nya bukan yang tersimpan | Connect ulang atau terima channel baru |
  | Client belum ada | `client_secret.json` tidak ada atau rusak | tautan ke checklist persiapan P16 |
  | Akun bukan test user | Google menolak login karena akun belum didaftarkan sebagai test user (selama status "Testing") | petunjuk menambahkan test user |
  | Tidak bisa dicek | tidak ada internet atau Google tidak menjawab; status terakhir tetap ditampilkan | Coba lagi |

- **Disconnect:**
  - Dua klik (`armedClick`, P20).
  - Mencabut token di Google (revoke), lalu memindahkan `youtube.json` ke
    Recycle Bin.
  - Kalau revoke gagal karena offline, token tetap dibuang dari profile
    dan statusnya memberi tahu.
- **Di luar halaman pengaturan:**
  - Chip profile di topbar menampilkan titik status YouTube: hijau, kuning
    untuk kedaluwarsa, atau abu-abu untuk tidak tertaut.
  - Upload dari Clips (P16) selalu memakai akun profile itu, dan
    menolak dengan tautan ke pengaturan kalau statusnya bukan Tertaut.
- Selama OAuth client berstatus "Testing", setiap akun Google pemilik
  channel harus didaftarkan sebagai test user (catat di checklist P16).
- P21-A sebaiknya selesai sebelum P16, supaya P16 langsung dibuat per
  profile.

**Guest** (permintaan ian 2026-10-20: "tambahkan sebagai guest, ... tidak
perlu menyimpan analisis di clips. untuk guest edit videonya saja").

Guest adalah pilihan tetap di halaman pilih profile ("Masuk sebagai Guest").
Tidak dibuat, tidak bisa diganti nama, dan tidak bisa dihapus. Guest
**hanya untuk mengedit dan me-render video**, tanpa catatan jadwal atau
akun.

- **Yang tetap ada:**
  - Add video, transkripsi, Clips/Result, caption, framing, Timeline,
    watermark;
  - render dan Open folder.
- **Yang tidak ada:**
  - Render tidak membuat atau memperbarui baris jadwal Clips (`jobs.py`
    melewati `schedule`). Pesan render tidak menyebut "added to the upload
    schedule".
  - Panel Post (teks posting, Angle) dan nama file berbasis judul
    unggahan (P17). File render memakai nama klip biasa.
  - Di dashboard: tabel Clips, Mark as Posted, Sync dari YouTube, dan
    "Add to schedule" di Rendered output disembunyikan. Sources dan
    Rendered output tetap ada.
  - Bagian Akun YouTube (P21-C) dan upload (P16) tidak muncul. Server
    juga menolak endpoint jadwal dan YouTube untuk Guest, jadi bukan hanya
    disembunyikan di UI.
- **Data:**
  - Folder sendiri `workspace/profiles/_guest/`, dengan susunan yang sama
    tapi tanpa `schedule/` dan `secrets/`.
  - Project tetap tersimpan, supaya reload tidak menghilangkan editan.
  - Cache bersama tetap dipakai, jadi video yang sudah ditranskripsi di
    profile lain langsung siap.
  - Tombol "Clear guest data" (dua klik, P20) memindahkan isi `_guest/`
    ke Recycle Bin. Cache bersama tidak ikut dihapus.
- **Tampilan:** chip topbar bertuliskan "Guest" dengan warna netral, tanpa
  titik status YouTube.
- **Asumsi yang perlu dikonfirmasi ian:** Find clips (saran AI) dan Copy
  brief tetap tersedia untuk Guest sebagai alat bantu memilih momen,
  tetapi hasilnya hanya masuk ke Result dan tidak menghasilkan teks
  posting atau baris Clips. Kalau Guest sebaiknya tanpa analisis AI sama
  sekali, cukup sembunyikan kedua tombol itu.

**Tahapan:**

| Tahap | Isi |
|---|---|
| P21-A | Folder per profile, migrasi "podcast", profile per permintaan (`contextvars`), dan selftest yang membuktikan dua profile tidak saling bocor |
| P21-B | Halaman pilih profile, chip di topbar, buat/ganti nama/hapus, dan pengaturan bawaan per profile |
| P21-G | Guest: tanpa jadwal Clips, tanpa Post, dan tanpa YouTube (ditolak juga di server), dengan data di `_guest/` dan tombol "Clear guest data". Dikerjakan bersama P21-B |
| P21-C | Pengaturan Akun YouTube per profile: Connect, cek validitas dengan status yang jelas, Disconnect, satu channel untuk satu profile. Bisa selesai sebelum fitur upload P16, karena pengecekan hanya memanggil `channels.list` |
| P21-D | Rubrik baru `prompts/rubrik/` untuk cuplikan lucu TV/YouTube. Perlu masukan ian soal kriteria "lucu yang layak diklip" |


**P21-A, yang dibuat (2026-10-20):**
- `paths.py`: `WORKSPACE`, `SOURCES`, `PROJECTS_DIR`, `OUT_ROOT`, `SCHEDULE_DIR`,
  `ASSETS`, `SECRETS` adalah folder "malas" (`_Dyn`) yang dihitung saat dipakai, dari
  profile permintaan atau job saat itu (`contextvars`), bukan saat import. `cache/`
  tetap bersama. `$KLIPIAN_WORKSPACE` menunjuk workspace lain (salinan uji).
- Server: setiap `/api/...` (kecuali `/api/profiles*` dan `/api/version`) dan media
  `/workspace/sources|out/...` wajib membawa profile: header `X-Klipian-Profile`, atau
  `?profile=` untuk `<video>`/`<img>`/`<a>` yang tidak bisa mengirim header. Tanpa itu
  400, profile yang tidak ada 404 (`needProfile`, banner di halaman). Thread job
  menyalin context saat mulai. URL render/riwayat yang dikirim server memuat
  `?profile=`.
- Klien: `ui/js/shared/profile.js` (dimuat pertama) menyimpan profile per TAB
  (`sessionStorage`), menambahkan header ke semua `fetch /api/...`, dan menyediakan
  `profileUrl()` dan `profileKey()` (preset caption dan sesi aktif per profile; tema,
  pager, urutan tetap global).
- Migrasi (`profiles.migrate_legacy`): berjalan otomatis **saat server start** (belum
  ada job), atau `python -m klipian migrate-profiles` (menolak bila server terdeteksi
  berjalan; `--force` untuk melewati). Mencadangkan semua JSON beserta hash ke
  `workspace/backups/migrate-<waktu>/` (manifest berisi sha256 dan jumlah file per
  folder), memindah dengan rename (drive sama), memeriksa hash dan jumlah/ukuran file
  sesudahnya, dan memindah balik bila ada yang tidak cocok. Tidak melakukan apa-apa
  bila tidak ada yang perlu dipindah; menolak bila folder lama dan baru sama-sama
  berisi. CLI memakai `--profile` / `$KLIPIAN_PROFILE` (bawaan `podcast`) dan menolak
  jalan sebelum migrasi.
- selftest: berjalan di workspace sementara (`workspace/.selftest-*`, tautan keras ke
  video dan asset yang dibutuhkan baseline), dengan check baru `profiles` (dua profile
  tidak saling melihat project, baris jadwal, render, source, asset; tanpa profile
  ditolak; job render yang dimulai di profile A menulis ke A walaupun tab pindah ke B).


**P21-B dan P21-G, yang dibuat (2026-10-20):**
- Halaman `/profiles` (`ui/profiles.html`): kartu profile berwarna (satu klik masuk),
  "+ Profile baru" (nama + warna), ganti nama, warna, hapus (`armedClick`; folder ke
  Recycle Bin lewat `klipian/recycle.py`, SHFileOperation), "Masuk sebagai Guest" tetap
  di bawah, dan "Clear guest data" (dua klik, isi `_guest` ke Recycle Bin, cache
  bersama tetap). Tab tanpa profile diarahkan ke picker (`?next=`); profile yang
  dihapus membuat tab kembali ke picker.
- Chip profile berwarna di topbar editor dan dashboard (`profile-ui.js`): menu Switch
  profile, Profile settings (nama, warna, teks watermark, rubrik bawaan, "pakai tampilan
  caption sekarang sebagai bawaan"), dan untuk Guest "Clear guest data". Bawaan
  profile: teks watermark masuk ke render lewat `style.watermark_text` (kosong tetap
  "klipian", jadi baseline tidak berubah), rubrik bawaan dipakai `/api/brief` bila
  `mode` tidak diberikan, preset caption dipakai proyek baru bila belum ada preset di
  localStorage profile itu.
- Guest: `_guest/` dibuat saat dipakai, tanpa `schedule/` dan `secrets/`. Server
  menolak `/api/workspace/clips*` dan `/api/youtube*` dengan 403 untuk Guest. Render
  tidak membuat baris jadwal, nama file memakai judul klip (post.title diabaikan), panel
  Post dan Angle serta tabel Clips disembunyikan (`html[data-guest]`), dan tombol
  "Add to schedule" tidak muncul.
- Satu source di beberapa profile: Add video membuat hardlink bila file identik (nama,
  ukuran, sha256) sudah ada di profile lain di drive yang sama, kalau tidak disalin
  (`profiles.place_source`). Menghapus satu nama tidak menghapus yang lain (diuji).

**P21-C, yang dibuat (2026-10-20):**
- `klipian/youtube.py`. Semua panggilan ke Google lewat empat fungsi di `_Net`
  (`flow`, `refresh`, `channels`, `revoke`), jadi uji mengganti keempatnya dan tidak pernah
  menjangkau Google. Token dan client secret tidak pernah dikirim ke browser, ditulis ke
  log, atau dicetak: halaman hanya menerima `state`, kalimat penjelasan, dan label
  channel (nama, id, thumbnail). Dependensi opsional: `requirements-youtube.txt`
  (sudah dipasang di `.venv`).
- File per profile: `secrets/client_secret.json` (cadangan: `workspace/secrets/`) dan
  `secrets/youtube.json` (token + channel + status terakhir). "Choose
  client_secret.json" di pengaturan profile membaca file di browser dan mengirim
  isinya ke server, yang memvalidasi (kunci `installed`, `client_id` berakhiran
  `.apps.googleusercontent.com`, ada `client_secret`) sebelum menyimpannya dan tidak
  pernah mengulang isinya.
- Status: Tidak tertaut, Tertaut ✓ (nama channel + waktu cek), Kedaluwarsa
  (`invalid_grant`), Channel berbeda, Client belum ada, Akun bukan test user
  (`access_denied` saat login), Tidak bisa dicek (offline; status terakhir tetap dan
  ditandai), dan paket belum terpasang. Tombol: Connect YouTube / Connect ulang,
  Check connection (refresh + `channels.list mine=true`), Disconnect (dua klik: revoke di
  Google lalu `youtube.json` ke Recycle Bin; kalau offline token tetap dibuang dan
  pesan menyebut cara mencabut manual). Satu channel hanya untuk satu profile: login
  yang menghasilkan channel profile lain ditolak ("Channel X is already used by the
  profile Y") dan tidak meninggalkan token. Titik status di chip: hijau/kuning/abu.
- API: `/api/youtube/status[?check=1]`, `/client`, `/connect` (+ `/connect-state`),
  `/check`, `/disconnect`; Guest ditolak 403.
- Catatan: membuka pengaturan profile memanggil `check` (jaringan) hanya bila profile
  itu sudah punya token; tanpa token tidak ada panggilan keluar.

### Audit setelah P16/P21 (2026-10-20)

Hasil audit ian/sesi analisis setelah profile, Guest, YouTube, dan hashtag:
- **Kata-kata di UI** yang masih menyebut folder lama (`workspace/sources/`,
  `workspace/assets/`) diganti dengan nama pendek ("this profile's sources") dan tombol
  **Open folder** yang membuka folder profile (path lengkapnya di tooltip, dari server, jadi
  tidak bisa basi). Panel Assets di `/workspace` mendapat tombol Open folder. "Assets"
  sekarang per profile (`profiles/<id>/assets/`), dan teksnya mengatakan itu.
- **README.md** punya bagian *Profiles* dan *YouTube upload*, jalur lama diperbaiki;
  `workspace/README.md` ditulis ulang untuk susunan baru (cache bersama, `profiles/<id>/`,
  `_guest`, `secrets/` cadangan, `backups/migrate-*`, jangan commit secrets).
- **Kredit antar profile:** Add video yang menautkan/menyalin source identik (sha256) dari
  profile lain menyalin entri kredit file itu ke `sources/credits.json` profile ini bila
  belum ada (tidak pernah menimpa), dan halaman menyebutnya. Selftest `profiles` memeriksa
  kasus disalin dan tidak ditimpa.

### P22 — Add from YouTube: unduh source langsung di klipian (DIBANGUN 2026-10-20; TERUJI NYATA 2026-10-22: unduh lewat yt-dlp dengan Node.js berhasil, dan 3 video klipian lucu dari source unduhan ter-upload)

Permintaan ian (2026-10-20): "sepertinya sekarang sudah saatnya mengaktifkan
fitur download youtube". ian sudah punya tool `D:\github-repos\youtube-downloader`
(Tkinter + yt-dlp, MP4/MP3, nama file `%(title).180B [%(id)s].%(ext)s`).
Tool itu **tidak diubah**: klipian memakai yt-dlp langsung dengan logika
serupa. Keputusan ian: nama file `Channel - Judul`, ada pratinjau, kredit
terisi otomatis, MP4 1080p H.264, job dengan progress dan cancel, tanpa unduh
ulang, dan yt-dlp opsional dengan tombol update.

- **Tempat:**
  - tab **From YouTube link** di Add video (editor);
  - tombol **+ From YouTube** di panel Sources (dashboard).

  File masuk ke `sources/` milik **profile permintaan**. Guest juga boleh
  (sumber untuk diedit), dan kreditnya tetap disimpan di profile Guest.
- **Pratinjau:** `extract_info(download=False)` menampilkan judul, channel,
  durasi, thumbnail, dan perkiraan ukuran. Unduhan baru berjalan setelah
  dikonfirmasi.
- **Nama file:** `<channel> - <judul>.mp4`, dengan aturan:
  - karakter terlarang Windows dibuang, juga spasi dan titik di ujung nama
    (sama seperti `paths.safe_dirname`), tanpa nama perangkat;
  - maksimal ±150 karakter;
  - bentrok nama untuk video *berbeda* ditambah ` (2)`;
  - ID video tidak masuk nama file.

  Contoh yang sudah ada: `Raditya Dika - Apa Kabar Syahrini.mp4`.
- **Kredit otomatis** di `credits.json` profile:
  - `platform` = YouTube, `creator` = nama channel, `title` = judul video,
    `url` = link kanonik `https://www.youtube.com/watch?v=<id>`;
  - ID video dan tanggal unduh disimpan untuk deteksi duplikat;
  - kredit yang sudah ada tidak ditimpa.
- **Format:**
  - MP4 maksimal 1080p, video H.264 bila tersedia:
    `bv*[vcodec^=avc1][height<=1080]+ba[ext=m4a]/b[ext=mp4][height<=1080]/bv*[height<=1080]+ba/b`;
  - digabung ke mp4 dengan ffmpeg yang sudah dipakai klipian;
  - tanpa 4K atau AV1, karena keluaran Shorts 1080 dan file besar hanya
    memperlambat transkripsi dan render.
- **Job latar belakang:**
  - menyalin context profile;
  - progress persen, kecepatan, ETA, dan Cancel;
  - file sementara di folder `.part` yang dibersihkan saat batal atau gagal;
  - dialog boleh ditutup;
  - satu link = satu video (`noplaylist`).
- **Tanpa unduh ulang:**
  - ID yang sudah ada di profile ini → pakai file yang ada;
  - ID yang ada di profile lain → hardlink dan salin kredit (lewat
    `profiles.place_source`, P21).
- **Dependensi:**
  - `requirements-download.txt` (yt-dlp), opsional seperti
    `requirements-youtube.txt`. Kalau belum terpasang, dialog menampilkan
    perintah pemasangannya;
  - tombol **Update yt-dlp** (pip install -U di `.venv`), karena YouTube
    sering berubah dan yt-dlp lama bisa gagal;
  - versi yt-dlp ditampilkan.
- **Batasan:** tanpa login atau cookies, tanpa melewati DRM, video privat,
  batas umur, atau paywall, dan tanpa MP3.
- **Pesan error yang jelas:** link bukan video YouTube, video privat atau
  dihapus, live yang belum selesai, jaringan, ffmpeg tidak ada, dan yt-dlp
  perlu diperbarui.
- **Hak cipta:** satu kalimat pengingat kecil di dialog ("unduh hanya konten
  yang boleh kamu pakai; kredit bukan izin"), tanpa memblokir apa pun.
- **Selftest (tanpa jaringan, yt-dlp ditiru):**
  - nama file dari channel dan judul, termasuk karakter aneh, ujung
    spasi/titik, panjang, dan bentrok nama;
  - kredit terisi dan tidak ditimpa;
  - duplikat ID di profile yang sama dan di profile lain;
  - cancel membersihkan `.part`;
  - error dipetakan ke pesan yang benar;
  - yt-dlp tidak terpasang.

### P23 — Render massal dari hasil brief

Permintaan ian (2026-10-21): "fitur render bulk terutama dari result ai json
brief". Hasil impor brief Claude adalah Result-Result terpisah, dan saat ini
setiap Result harus dibuka lalu dirender satu per satu.

**Kenapa perlu pekerjaan dasar dulu:**
- Request render disusun browser dari Result yang **sedang terbuka**
  (`player.js` sendRender, dengan data dari 6 file: framing, koreksi kata,
  `captionStyle()`, overlay, Output Format, dan post).
- Keputusan 2.3 menunda **opsi B** ("penyusunan request pindah ke server")
  sampai ada kebutuhan render tanpa UI, massal atau terjadwal. Render massal
  adalah kebutuhan itu.

**Rancangan:**
1. **Penyusun request di server.**
   - Python membaca Result tersimpan di project (span, titik framing,
     koreksi kata, overlay/volume, post) dan pengaturan project (gaya
     caption dan Output Format), lalu menyusun request yang sama persis
     dengan yang dibuat `sendRender`.
   - **Uji identik:** untuk setiap Result yang punya request render terakhir
     tersimpan (`projects/<id>/renders/<result>.json`, replay 3a), request
     susunan server harus **sama** dengan request tersimpan. Bidang yang
     memang berbeda karena waktu harus disebutkan dan dijelaskan.
   - Pengujian memakai salinan project ian di scratch, ditambah fixture
     selftest.
   - Setelah lolos, render satuan dari editor juga memakai penyusun
     server, jadi aturannya hanya satu. JS cukup mengirim
     `{project, results:[…]}`.
2. **Tampilan di editor, layar Clips (daftar Result):**
   - centang per Result, tombol **Select all from this brief** (Result
     dari impor yang sama), dan tombol **Render selected (N)**;
   - sebelum mulai, ringkasan berisi jumlah klip, total durasi, perkiraan
     waktu, dan klip yang ditolak beserta alasannya (tanpa span, video
     source hilang, dan sebagainya).
3. **Antrean di History:** berurutan, dengan progress dan Cancel per klip.
   Setiap klip yang selesai masuk jadwal Clips sebagai Draft (teks posting,
   hashtag, dan kredit), sama seperti render satuan. Request terakhir per
   Result tetap disimpan untuk replay.
4. **Framing:** Result hasil impor belum punya titik framing, jadi
   dirender dengan framing bawaan (titik 00:00). Ada pilihan **"Run AI
   Framing first for clips without framing"** yang **mati secara bawaan**.
   Kalau dinyalakan, AI Framing (pergantian pembicara) dijalankan per klip
   tanpa titik framing, hasilnya disimpan ke Result, lalu klip dirender.
5. **Profile:** job menyalin context profile (P21). Guest boleh merender,
   tapi tanpa baris jadwal.

**Fase 1 selesai (2026-10-21): penyusun request di server, `klipian/renderreq.py`.**
- `build_request(project, result_id, words_of=, size_of=)` menyusun request yang sama dengan `sendRender`
  untuk satu Result tersimpan, dengan aturan yang sama (`spansWithFraming`, `ensureStartPoint`,
  `matchRatio`, `serverClipFields`, koreksi kata, overlay/volume, `captionStyle`, `applyOutput`, pembulatan
  gaya JavaScript). Tidak menulis apa pun.
- **Bukti identik** pada salinan project ian (scratch, hanya baca): 25 Result punya request terakhir
  tersimpan, 2 belum pernah dirender. **24 identik**, dengan satu pengecualian yang diharapkan: render
  sebelum 4cde304 belum punya `style.reveal` ("Words appear"). **1 berbeda** (`2a95bfd6b9a0/res8`): proyek
  disimpan 7,5 jam setelah render terakhirnya, dan Result itu sejak itu diubah (gambar 16:9 → 9:16 dan satu
  titik framing baru), jadi request susunan server memang berbeda.
- selftest `renderreq`: project fixture (`tests/fixtures/renderreq/`) dengan titik framing, koreksi, overlay,
  volume, dua video, Result terbalik dan Result kosong; request yang disusun harus sama dengan
  `expected.json` dan dicek dengan tangan pada angka kuncinya. Fixture baseline render (`request.json`)
  adalah request tanpa dokumen project, jadi tidak bisa disusun ulang dari project.

**Fase 2 dan 3 selesai (2026-10-21).**
- `POST /api/render` menerima `{project, results:[…]}`: server menyusun request tiap Result dari project tersimpan
  dan menjalankannya satu per satu sebagai satu job (`jobs.start_project_render`); tiap klip mencatat request
  terakhir, baris jadwal Draft, dan entri History persis seperti render satuan (Guest tanpa baris jadwal). Cancel
  per klip dan Cancel all. Render satuan editor sekarang menyimpan project lalu hanya mengirim id Result; bentuk
  lama `{video, clips}` tetap ada untuk CLI/replay dan tes. Bukti byte: render dari editor untuk satu Result
  salinan project ian sama persis (md5) dengan replay request lamanya.
- `POST /api/render/plan`: ringkasan sebelum mulai (klip, total durasi, perkiraan dari kecepatan render terakhir
  atau 30 dtk per klip, yang ditolak dan alasannya).
- Editor, layar Clips: daftar "All Results" dengan centang, "Select all from this brief" (Result dengan
  `importId` yang sama; yang lama tanpa id: semua Result yang hanya berisi saran AI), "Render selected (N)", dan
  tombol baru "As its own Result" di saran AI (satu Result per saran yang dicentang, karena impor hanya membuat
  saran, bukan Result). Pilihan "Run AI Framing first for clips without framing" (mati secara bawaan) menjalankan
  alur AI Framing editor per Result di layar Framing, menyimpan titiknya ke Result, lalu merender; kalau paket
  opsionalnya tidak ada, klip dirender dengan framing bawaan.
- selftest `batch`: urutan, penolakan beralasan, baris jadwal dan request terakhir, cancel satu/yang sedang
  jalan/semua, Guest.

**Status:** dikirim ke sesi eksekusi 2026-10-21.

### P24 — Find clips lewat Claude API (tanpa salin-tempel)

Arah ian (2026-10-21): ingin menambah channel dan mencari niche yang cocok,
jadi butuh otomasi yang lebih banyak dan mudah. Langkah paling repot sekarang
adalah Copy brief → tempel ke Claude → salin balasan → impor. **Dikerjakan
setelah P23.**

- **Tombol "Find clips with Claude"** di layar Analyze/Clips. Brief yang sama
  (`/api/brief`, rubrik profile, aturan hashtag P16, JSON murni) dikirim ke
  Claude API. Balasannya diimpor lewat jalur yang sama dengan impor manual
  (`roundtrip`, termasuk perbaikan JSON f238480 dan 6b22735). Jalur
  salin-tempel tetap ada.
- **SDK:** paket resmi `anthropic` (Python), sebagai dependensi opsional
  `requirements-claude.txt`.
  - Panggilan **streaming** (`messages.stream` + `get_final_message`),
    karena transkrip 1–2 jam bisa puluhan ribu token.
  - `thinking: {type: "adaptive"}`.
  - `max_tokens` cukup besar untuk 10–20 kandidat.
- **Model:** dipilih di pengaturan. Bawaannya Opus terbaru yang tersedia
  di akun; cek lewat Models API saat dibangun. `claude-opus-4-8` adalah
  bawaan yang dikenal, dan model Claude 5 lebih baru bila akun
  mendukungnya. Tidak pernah diturunkan diam-diam ke model lebih murah.
- **Prompt caching:** bagian statis (rubrik, aturan, contoh JSON) diletakkan
  di depan dengan `cache_control`, lalu transkrip dan cues di belakang.
  Analisis ulang episode yang sama juga bisa memakai cache.
- **JSON:** pakai structured output (`output_config.format` dengan skema
  kandidat) supaya balasan selalu JSON valid. Kalau tidak cocok dengan
  bentuk balasan yang ada, tetap pakai parser + perbaikan yang ada.
- **API key:** dimasukkan ian sendiri di Settings, disimpan di
  `workspace/secrets/anthropic.json` (bersama untuk semua profile, atau per
  profile kalau ian mau tagihan terpisah). Kalau ada, `ANTHROPIC_API_KEY`
  juga dihormati. Key tidak pernah ke browser, log, atau git.
- **Biaya dan transparansi:**
  - sebelum kirim: hitung token (`count_tokens`) dan perkiraan biaya;
  - sesudah: catat token input, output, dan cache dari `usage` per brief
    di project, dan tampilkan ringkasannya per profile per bulan.
- **Error:** typed exception SDK (rate limit, overloaded, auth, koneksi),
  retry bawaan SDK, pesan yang jelas, dan stop reason `refusal` atau
  `max_tokens` ditangani. Tidak ada impor sebagian diam-diam.
- **Job latar belakang** dengan progress (mengirim / Claude berpikir /
  mengimpor) dan Cancel. Hasilnya muncul sebagai Result baru seperti impor
  manual, dengan id impor untuk "Select all from this brief" (P23).

### P25 — Autopilot: dari link sampai Draft

Satu halaman per profile: tempel satu atau beberapa link YouTube (atau pilih
source yang sudah ada). Setiap video berjalan berurutan:

1. unduh (P22);
2. transkripsi;
3. Find clips (P24);
4. ambil **N klip teratas** berdasarkan skor (N diatur, bawaan 5);
5. AI Framing opsional;
6. render massal (P23);
7. masuk Clips sebagai **Draft**.

**Upload tidak otomatis:** ian meninjau, lalu memakai Upload massal. Ada
progres per video per langkah. Video yang gagal di satu langkah berhenti di
situ dengan alasannya, dan video lain tetap jalan. Bisa ditinggal (job
server) dan bisa di-Cancel. Bergantung pada P22, P23, dan P24.

### P26 — Rubrik per niche

Perluasan P21-D.
- **Rubrik baru dari template** di pengaturan profile, misalnya:
  - komedi/cuplikan TV;
  - edukasi/explainer;
  - gaming;
  - motivasi;
  - podcast (yang ada).
- Rubrik disalin ke `prompts/rubrik/<nama>.md` dan bisa diedit. Bagian
  wajib (Teks posting, aturan kredit, aturan JSON) dicek seperti selftest
  rubrik podcast.
- Rubrik bawaan profile dipakai Find clips dan Copy brief.
- Membuat channel uji baru cukup: buat profile → pilih rubrik → connect
  YouTube → Autopilot.

### P27 — Dashboard niche

Untuk memutuskan niche mana yang dilanjutkan.
- **Data per klip** (videoId dari upload): views, like, komentar dari Data
  API `videos.list part=statistics` (murah, 50 id per panggilan), plus rata-
  rata durasi tonton dan persentase ditonton dari **YouTube Analytics API**
  (scope tambahan `yt-analytics.readonly`, jadi profile perlu Connect
  ulang).
- **Tampilan:** per profile per minggu (klip tayang, total views, median
  views per klip, retensi rata-rata), lalu perbandingan antar profile, dan
  klip terbaik/terburuk per niche dengan rubrik dan sumbernya.
- **Penarikan data:** berkala dengan throttle seperti P16 Tahap 2b, dan
  disimpan lokal per profile.

**Status P24–P27 (2026-10-21):** dicatat. P24 dikirim ke sesi eksekusi
setelah P23 selesai, dan P25–P27 menyusul sesuai urutan.

**P23 lanjutan dari pemakaian ian (2026-10-21):** layar Clips disusun mengikuti
langkah: 1 Choose suggestions, 2 Results (daftar klip yang akan di-render),
3 Render, lalu "Open Result: moments" sebagai rincian baris yang terbuka.
Tiap baris: judul, durasi, jumlah momen, format output, framing, dan kapan
terakhir di-render. Aksi massal di bawah daftar: **Output format...** (satu
format ditulis ke semua Result yang dicentang, per kontrol bisa "keep each
Result's own"), **Delete selected** dan hapus per baris (dialog + Undo; file
render dan baris jadwal tidak pernah dihapus), **Render selected**. Dialog
rencana render menampilkan format tiap klip dan tombol Output format...
sebelum render. "As separate Results" memakai format Result yang terbuka.
Selftest renderreq: format yang diterapkan masuk ke request Result terpilih
saja.

Di bawah daftar saran ada dua pilihan yang jelas berbeda: **One video from
these moments** (saran yang dicentang digabung ke Result yang terbuka: satu
render, satu file; "N moments -> 1 video") atau **A separate video for each**
(satu Result per saran; "N moments -> N videos"), dengan "or" di antaranya dan
petunjuk visual kecil. Setelah yang kedua, Result baru dicentang dan disorot di
langkah 2; setelah yang pertama, catatan menyebut Result tujuan.

**P26 selesai di kode (2026-10-21):** template di `prompts/rubrik/templates/`
(komedi-tv, edukasi, gaming, motivasi; struktur wajib sama dengan
dialog-podcast, bobot per niche ada di teks rubrik). Rubrik buatan sendiri
disimpan di `workspace/rubrics/<slug>.md` (dibagi semua profile, tidak masuk
git), dibuat dari template lewat Profile settings ("New rubric from
template..."), bisa dibuka (file/folder) dan dihapus (ke Recycle Bin; profile
yang memakainya jatuh ke dialog dengan catatan). Bagian wajib dicek saat
dipakai dan saat disimpan; rubrik yang kurang satu bagian ditolak dengan nama
bagiannya. Rubrik bawaan `gameplay` dikecualikan dari cek itu (lebih tua).
Find clips, Copy brief dan Download memakai rubrik default profile, atau
pilihan per brief di layar Analyze (ini jalan Guest memilih). Blok sistem yang
di-cache tetap byte-stabil per rubrik. Selftest `rubrics`.

**P24 selesai di kode (belum dicoba dengan key asli):** backend `claude_api.py`
+ `/api/claude/*`, tombol "Find clips with Claude" (dialog konfirmasi: model,
token input, perkiraan biaya, jumlah klip), bagian "Anthropic API" di Profile
settings (key, Test, model, effort, tabel pemakaian), pemakaian per brief
disimpan di project. Diuji dengan klien palsu dan SDK asli lewat mock
transport; panggilan pertama dengan key asli dilakukan ian. Harga adalah
perkiraan (konstanta `PRICES` di `claude_api.py`).

### P28 — Motion Studio (`/remotion`): konten animasi dengan Remotion (RENCANA, belum matang)

Ide ian (2026-10-21): sedang ramai Shorts berisi animasi motion yang dibuat
dengan Claude + Remotion, dan ini bisa menjadi niche baru bertema motion.
Usulnya ada fitur `/remotion` untuk edit manual seperti aplikasi editor, dan
kalau memungkinkan juga memakai AI agent untuk mengedit kode. **Status:
dicatat saja, masih rencana dan belum matang** (keputusan ian 2026-10-21).

**Bagian yang sudah pasti:** hasil render motion masuk ke alur yang sudah ada
di klipian, jadi tidak perlu membangun ulang:
- baris Clips (seperti klip manual, `fileFolder` `motion`);
- teks posting dan hashtag (P16);
- upload satu klip atau massal dengan jadwal (P16, termasuk dialog jadwal
  bertahap);
- cek status otomatis (Tahap 2b);
- profile per channel (P21).

**Rancangan awal (bisa berubah; bagian AI agent dan editor digantikan oleh
"Penerapan di klipian" di bawah):**
- **Jangan membangun editor dari nol.** Remotion Studio (editor lokal
  berbasis browser, dengan pratinjau, timeline, dan props) dipakai untuk edit
  manual. Klipian hanya mengelola project, membuka Studio, merender, lalu
  menyerahkan hasilnya ke Clips.
- **Project per profile** di `profiles/<id>/motion/<project>/`. Templat awal
  9:16 1080×1920 (kinetic typography, explainer, grafik/data, quote card)
  memakai warna dan font profile.
- **AI agent**, bertahap:
  - awal: tombol Open folder / Open in VS Code atau Claude Code, sehingga ian
    memakai agent yang sudah ada;
  - lanjut: panel AI (Claude API, key P24) yang mengusulkan perubahan sebagai
    **diff yang harus disetujui**, lalu klipian menjalankan cek TypeScript dan
    merender satu frame pratinjau. Error dikirim balik ke Claude. Setiap
    project punya riwayat git sendiri untuk Undo.
- **Keamanan:** kode buatan AI berjalan di komputer ian (Node). Karena itu:
  - setiap perubahan lewat persetujuan;
  - agent hanya boleh menyentuh folder project-nya;
  - tidak ada pemasangan paket baru tanpa persetujuan.
- **Render:** `remotion render` sebagai job latar belakang dengan progress
  dan Cancel. Hasilnya masuk ke `out/motion/` dan menjadi baris di Clips.

**Pertanyaan terbuka sebelum dikerjakan:**
1. Lisensi Remotion untuk pemakaian ian. Setahu kita gratis untuk individu
   dan perusahaan kecil; cek di situs Remotion.
2. Waktu render di mesin ian, dengan spike P28-A: template 10 detik
   1080×1920.
3. Seberapa jauh editor sendiri di klipian dibutuhkan, dibandingkan cukup
   Remotion Studio.
4. Panel AI di klipian, atau cukup Claude Code di luar.
5. Profile, channel, dan rubrik ide konten untuk niche motion.

**Format pertama: "fun fact"** (ian 2026-10-25; masih rencana). Shorts edukasi
singkat dengan pola "kenapa X terjadi?", dijelaskan dalam 30–45 detik, dibuat
dengan Remotion + Claude. Awalnya direncanakan bergaya stop-motion; setelah
melihat hasil spike P28-A, ian menggantinya dengan **gerak halus** (lihat
P28-A2).
Contoh topik: kenapa colokan listrik bisa panas lalu MCB turun.
- **Akurasi adalah modal utama channel fakta.** Contoh awal ian menyebut
  "hanya 1 arus yang menyentuh, jadi panas". Itu keliru: kalau satu kaki tidak
  menyentuh, rangkaian terputus. Penjelasan yang benar: kontak longgar membuat
  hambatan di titik kontak naik, titik itu panas, isolasi bisa rusak atau
  korsleting, lalu MCB turun; MCB juga turun karena beban berlebih. Karena itu
  cek fakta adalah langkah WAJIB, bukan opsi.
- **Tagline:** "Kok Bisa?" sudah dipakai channel edukasi animasi Indonesia yang
  dikenal, jadi hindari. Usulan: "Oh, Gitu Toh!", "Ternyata Begini.",
  "1 Menit Paham.", "Ilmu Receh, Paham Beneran.", "Bongkar Sebentar."
  (cek ketersediaannya di YouTube). Profile dan channel sendiri (P21).
- **Alur:**
  1. **Ide → naskah** (Claude, lewat brief salin-tempel atau API P24): satu
     pertanyaan, jawaban 30–45 detik dalam bahasa santai, hook di 3 detik
     pertama, dan **daftar sumber** (tautan) untuk setiap klaim.
  2. **Cek fakta** oleh ian: naskah dan sumber ditampilkan berdampingan.
     Naskah belum boleh dirender sebelum ditandai "fakta dicek". Tanda ini
     disimpan beserta tanggal dan sumbernya.
  3. **Storyboard JSON**:
     - adegan (durasi dan teks di layar);
     - objek dari pustaka aset sederhana (colokan, stop kontak, percikan,
       panah, label);
     - gerak (masuk, goyang, meledak kecil);
     - kalimat narasi per adegan.
     Satu skema tetap, divalidasi seperti balasan brief (perbaikan JSON
     f238480 berlaku).
  4. **Template Remotion** (diperbarui 2026-10-25: gerak halus, datar; lihat
     style bible dan P28-A2; rencana awal stop-motion 8–12 fps, tekstur kertas
     dan goyangan acak dibatalkan).
     Claude MENGISI template dari storyboard, tidak menulis kode bebas (lihat
     aturan keamanan di atas). Warna dan font dari profile.
  5. **Suara:**
     - rekaman suara ian (paling natural), dengan potongan per adegan dari
       satu file;
     - atau TTS bahasa Indonesia (pilihan nanti, dengan catatan lisensi dan
       biaya).
     Waktu adegan menyesuaikan durasi narasi.
  6. **Caption:** mesin caption klipian ("As spoken", 4cde304) dari
     transkripsi narasi.
  7. **Render → Clips → upload:** baris Clips `fileFolder` `motion`, teks
     posting dan hashtag (dengan sumber di deskripsi bila perlu), lalu upload
     satu atau massal terjadwal (P16).
- **Langkah pertama yang disarankan:** satu video percobaan topik colokan
  (versi yang sudah dikoreksi), dibuat manual dengan Claude + Remotion di luar
  klipian. Tujuannya menilai gaya, waktu produksi, dan respons penonton
  sebelum membangun fiturnya.

**Identitas channel motion: klipian intip** (keputusan ian 2026-10-25,
setelah beberapa putaran pilihan; masih rencana, belum dibangun).
- **Nama:** klipian intip.
- **Tagline dan catchphrase:** **"Intip yuk!"** (sama). Pola "Kita ___!" sengaja
  dihindari karena terlalu mirip channel lain ("Kita bedah!"). "Kok bisa?" juga
  dihindari.
- **Logo:** pilihan A, yaitu gelembung klipian (siluet yang sama dengan klipian
  lucu dan podcast) dengan satu mata kaca pembesar. Lembar pilihan dan
  perbandingan ada di `workspace/channel-art/klipian-motion/`.
- **Warna:** hitam, kuning klipian dan abu-abu (keputusan ian 2026-10-25,
  menggantikan aksen biru langit dan coral). Merah hanya untuk makna (luka,
  bahaya), tidak untuk hiasan; maskot tidak punya varian biru atau ungu.
  **Huruf:** Outfit Bold dan DM Mono. **Bunyi khas:** "ting" kaca
  pembesar saat "Intip yuk!", "pop" saat objek muncul, dan jingle penutup
  1 detik.
- **Format tetap (30–45 detik):**
  - 0–3 dtk: hook berupa pertanyaan sehari-hari;
  - 3–4 dtk: "Intip yuk!" (maskot muncul "pop", melar, lensa membesar,
    "ting", lalu pindah ke pojok dan cerita mulai; ± 1,2 detik);
  - 4–35 dtk: penjelasan 2–3 langkah;
  - 35–42 dtk: tips;
  - 42–45 dtk: logo dan "klipian intip".
- **Contoh topik pertama** (fakta sudah dikoreksi):
  "Kenapa pas masak nasi sambil nyetrika, listrik langsung jepret? Intip yuk!"
  Rice cooker dan setrika sama-sama memakai elemen pemanas berdaya besar.
  Rumah berdaya kecil (900/1.300 VA) melewati batas, lalu MCB turun untuk
  melindungi kabel. Tipsnya: nyalakan bergantian. Angka daya dicek dari
  sumber.
- **Karakter: dua lapis** (keputusan ian 2026-10-25, seperti channel edukasi
  yang maskotnya berbeda dari tokoh di videonya). Lembar acuan:
  `workspace/channel-art/klipian-intip/maskot-dan-gaya.png`.
  - **Maskot** = logo yang hidup, selalu sama: gelembung kuning dengan satu
    mata kaca pembesar, **tanpa badan**. Gerak lewat lompat, miring, squash
    dan stretch, kedip, serta lensa yang membesar; prop boleh melayang di
    dekatnya. Ekspresi: penasaran, kaget, berpikir, paham, tertawa, aduh.
    Muncul di pembuka "Intip yuk!", reaksi di pojok 1–2 kali per video
    (maksimal ± 1 detik), penutup, ikon dan stiker.
  - **Orang di dalam video: chibi** (revisi ian 2026-10-25, acuan gaya
    chibi kawaii; digambar sendiri, tidak menyalin gambar acuan). Peran
    berganti sesuai cerita (pemuda, ibu, kakak berhijab, bapak, anak, adik,
    ...), dasarnya tetap: kepala ± setengah tinggi badan, mata hitam besar
    dengan 2 kilau, pipi merona, badan pendek membulat, tangan bulat dengan
    jempol, kaki pendek, sepatu hitam, tanpa garis tepi. Kaca pembesar hanya
    milik maskot.
  - Tokoh berhijab mengikuti pendapat mayoritas di Indonesia (Syafi'i:
    seluruh tubuh kecuali wajah dan telapak tangan). Kerudung menutup
    rambut, telinga dan leher, dan terulur menutup dada (An-Nur 31). Lengan
    panjang sampai pergelangan, rok panjang yang longgar sampai sepatu.
  - Yang diganti per peran hanya **warna, kostum, rambut dan prop** (contoh:
    biasa, koki, teknisi listrik dengan helm, peneliti dengan jas lab).
    Baju abu-abu/hitam dengan aksen kuning; kostum boleh putih atau kuning.
  - Satu rig Remotion: kepala, rambut depan dan belakang, badan, 2 lengan,
    2 kaki. Fakta tubuh tetap bisa diperagakan (tangan kena pisau: plester
    dan tetes merah di tangan bulat).
  - Gambar penghasil: `make_mascot.py` dan `chibi_people.py` di folder yang
    sama.
  - Tidak dipakai: orang bergaya stickman, kepala tanpa gelembung
    (`karakter-pilihan-kepala.png`), dan stickman/chibi berkepala gelembung.
- **Gaya animasi (style bible):**
  - **gerak halus 30 fps** (keputusan ian 2026-10-25, setelah video spike
    P28-A terasa kaku, patah-patah dan semua objek bergetar): pegas dan
    easing, bukan langkah 12 fps; getar hanya untuk makna (bahaya). Setiap
    beat punya 2–4 momen gerak (masuk berurutan, gerak diam yang hidup,
    kamera, transisi), lihat P28-A2;
  - **datar** (keputusan ian 2026-10-25, setelah membandingkan dengan
    tekstur kertas + bayangan jatuh: `datar-vs-kertas.png`): tanpa tekstur
    kertas, tanpa garis tepi, tanpa bayangan jatuh dari benda;
  - **benda utama = 3D toon** (keputusan ian 2026-10-25, setelah A3: benda
    2D terlalu datar dan sulit dikenali, sedangkan uji 3D charger "sudah
    bagus"): stop kontak, colokan, charger dan potongannya dibuat sebagai aset
    3D toon (`@remotion/three`, palet yang sama, cahaya kiri atas) dengan
    bentuk yang mirip benda asli; tokoh chibi, maskot, teks, label, ikon dan
    panah tetap 2D. Potongan dalam 3D memakai bidang potong. Kabel = kurva
    halus (tanpa sudut runcing);
  - **sound effect** (keputusan ian 2026-10-25): semua transisi, efek objek
    dan efek maskot bersuara, kecuali voice over. Suara dibuat sendiri secara
    lokal (sintesis) atau dari paket CC0, jadi bebas lisensi dan aman dari
    Content ID; tanpa layanan atau API. Setiap kata gerak di JSON punya suara
    bawaan, dengan jeda minimum per suara, level yang tidak ramai, dan ruang
    untuk voice over nanti (efek dikecilkan saat ada suara narasi);
  - **latar** (keputusan ian 2026-10-25, setelah video A2 terasa sepi dengan
    dinding putih polos): adegan cerita memakai **B, pola lensa + sorot
    kuning**: dinding dengan pola cincin lensa samar dan lingkaran kuning besar
    di belakang objek utama. Semua yang **di dalam lensa dan bedah 3D**
    memakai **C, ruang bedah gelap**: abu tua dengan grid dan cahaya kuning di
    tengah, supaya arus dan panas menyala dan benda putih terpisah dari latar.
    "Tembus lensa" = pindah dari dunia terang ke ruang bedah gelap. Objek utama
    ± 60–70% lebar layar, dengan elemen pendukung (panah, ikon, angka, label
    penunjuk) supaya satu layar tidak sepi. Contoh:
    `workspace/channel-art/klipian-intip/pilihan-latar.png`;
  - **bayangan hanya untuk kedalaman**: lubang, ceruk, rongga, celah (lubang
    stop kontak, ceruk tempat colokan masuk, rongga di potongan). Cahaya dari
    kiri atas, jadi bayangannya sabit keras di tepi dalam kiri atas; warnanya
    warna dasar yang digelapkan (bukan hitam), tanpa gradasi. Contoh:
    `workspace/channel-art/klipian-intip/datar-dengan-kedalaman.png`. Di
    Remotion menjadi satu komponen/aturan (`Hole`/`Recess`) di pustaka aset;
  - maksimal 3 transisi;
  - teks layar maksimal 6 kata per adegan.
- **Bedah benda dengan "lensa intip"** (keputusan ian 2026-10-25). Ini ciri
  khas channel: lensa maskot membuka lingkaran; di dalam lingkaran terlihat
  potongan benda, di luar tetap tampak luar (di Remotion: lapisan SVG luar
  dan dalam + clip-path lingkaran yang mengikuti lensa).
  - Dipakai hanya kalau sebabnya tersembunyi di dalam benda. Kalau tidak
    (mis. listrik jepret karena rice cooker + setrika), cukup meteran atau
    diagram, tanpa bedah.
  - Tingkat: 1 situasi (orang chibi) → 2 benda dari luar → 3 potongan dalam
    → 4 partikel (hanya kalau perlu, mis. arus berdesakan).
  - Maksimal satu kali masuk ke dalam per video, 3–5 bagian, label pendek,
    dilihat dari samping, satu benda per adegan, datar tanpa garis tepi.
  - Kode warna: kuning = arus listrik (titik mengalir), merah/oranye =
    panas atau bahaya, abu-abu = bahan benda, abu muda = logam.
  - Contoh lengkap: `workspace/channel-art/klipian-intip/storyboard-colokan-panas.png`
    ("Kenapa colokan bisa panas?", 8 panel, ± 42 detik: hook, "Intip yuk!",
    lensa intip, jepit rapat, jepit kendur dan titik panas, akibat, 2 tips,
    penutup). Faktanya dicek ke sumber: kontak kendur menaikkan hambatan
    kontak dan memanaskan titik itu, bisa melelehkan plastik dan memicu
    kebakaran walau MCB tidak turun; colokan bertumpuk juga memanaskan
    kabel dan stop kontak.
  - Charger konslet: lebih sering di pangkal kabel atau karena air, bukan
    di dalam kepala charger; dicek sebelum dijadikan naskah.
- **Persiapan channel:**
  - akun dan channel sendiri;
  - **verifikasi di youtube.com/verify sejak awal** (pelajaran dari batas
    upload klipian lucu);
  - Google Cloud project sendiri (Guide);
  - profile klipian "klipian intip" dengan rubrik fun fact;
  - channel art (`workspace/channel-art/klipian-intip/`);
  - ritme awal 1–2 video per hari, dijadwalkan.
- **Pilar konten:** listrik dan rumah, dapur, tubuh sehari-hari, benda
  sekitar. Daftar 10 topik awal ada di percakapan 2026-10-25. Setiap topik
  dicek faktanya, dan topik kesehatan/keuangan dihindari atau sangat
  hati-hati.
- **Tahapan:**
  - minggu 1: identitas (logo, channel art, lembar karakter, style bible);
  - minggu 2: 3 video percobaan manual (Claude + Remotion);
  - minggu 3: putuskan otomasi di klipian (P28-A).

**Penerapan di klipian: alur dan endpoint** (keputusan ian 2026-10-25;
menggantikan "panel AI dengan diff" di rancangan awal, dan menjawab
pertanyaan terbuka 3 dan 4).
- **Prinsip 1: tanpa API key.** klipian sendiri hanya bekerja lokal (seperti
  transcribe dengan faster-whisper). Semua analisis AI lewat **salin-tempel
  brief** ke Claude atau ChatGPT. Claude API (P24) tidak dipakai di motion.
  Suara juga begitu: rekaman, TTS lokal, atau file dari luar yang diimpor;
  tidak ada key layanan suara di klipian.
- **Prinsip 2: video konsisten lewat pustaka aset.** Maskot, tokoh chibi,
  benda, latar, lensa intip, palet, font dan bunyi adalah aset tetap (komponen
  Remotion). Katalog di brief dibuat **dari pustaka itu**, jadi AI hanya bisa
  memilih yang benar-benar bisa dirender.
- **Prinsip 3: AI mengisi data, bukan menulis kode.** AI mengembalikan JSON,
  lalu klipian merendernya dengan template Remotion yang tetap. JSON bisa
  divalidasi, dan teks bisa diedit langsung di klipian tanpa AI.
- **Remotion, bukan HyperFrames.** Kita butuh pustaka komponen yang dipakai
  ulang (Mascot, Chibi, LensReveal, Socket, Meter, ...), dan itu cocok sebagai
  komponen React. Remotion juga punya Studio dan render dari Node (Node sudah
  ada sejak P22).
- **Alur: satu brief, satu jawaban** (usul ian 2026-10-25):
  1. **Input** di halaman `/remotion` (profile klipian intip): topik, misalnya
     "fakta seru tentang colokan listrik panas"; durasi 30 / 45 / 60 detik
     (default 45; 60 untuk topik yang butuh 3 langkah penjelasan); catatan
     opsional.
  2. **klipian membuat satu brief** mandiri (Copy brief / Download file, sama
     seperti brief klip). Isinya:
     - tugas: ubah topik menjadi satu pertanyaan "kenapa…?";
     - struktur menurut durasi: hook 0–3 detik, "Intip yuk!" ± 1 detik,
       penjelasan, tips, penutup ± 4 detik (45 detik ≈ 8 beat, 60 detik ≈
       10–12 beat);
     - aturan channel: bahasa santai, teks layar maksimal 6 kata, satu kali
       bedah benda lewat lensa intip (hanya kalau sebabnya di dalam benda),
       kode warna, hindari kesehatan/keuangan, jangan mengajarkan hal
       berbahaya;
     - aturan fakta: setiap klaim wajib punya sumber (URL); kalau ragu,
       jangan dipakai;
     - katalog dari pustaka aset: tokoh (peran, ekspresi, pose, kostum),
       ekspresi maskot, benda dan state-nya, latar, bunyi; hanya ini yang
       boleh dipakai;
     - aturan judul, deskripsi dan hashtag dari profile (sama dengan klip);
     - format jawaban: skema JSON dan contoh singkat;
     - benda yang belum ada tidak dikarang, tetapi ditulis di `needs`.
  3. **AI** (sebaiknya dengan web search) mengembalikan **satu JSON**: 3 pilihan
     judul, pertanyaan hook, beat (durasi, narasi, teks layar, adegan: latar,
     tokoh, benda, maskot, lensa, bunyi), klaim dengan sumber dan beat yang
     memakainya, deskripsi, hashtag, `needs`.
  4. **Tempel ke klipian → validasi:** komponen/ekspresi/state yang tidak ada,
     durasi meleset, teks layar lebih dari 6 kata, klaim tanpa sumber →
     klipian membuat pesan perbaikan untuk ditempel balik ke AI.
  5. **Pratinjau dan gerbang fakta (wajib):** gambar diam per beat
     (renderStill), tampil seperti lembar storyboard; teks bisa diedit
     langsung; setiap klaim dan sumbernya dicentang ian (disimpan dengan
     tanggal); pilih judul. Tanpa centang semua klaim, tidak bisa render.
  6. **Klaim ditolak:** klipian membuat **brief revisi** hanya untuk beat yang
     memakai klaim itu, bukan mengulang semuanya.
  7. **Suara** (ian sedang riset opsinya): rekaman atau TTS per beat; durasi
     suara menentukan panjang beat. Takarir dari teks narasi, waktunya
     disejajarkan dengan faster-whisper yang sudah ada.
  8. **Render** lewat antrean pekerjaan berat yang sudah ada (sched): MP4 9:16
     1080×1920 30 fps dengan gerak halus (P28-A2). Hasilnya
     menjadi baris Clips (`fileFolder` `motion`).
  9. **Upload** lewat fitur single/bulk terjadwal yang sudah ada (P16).
- **Benda baru = satu-satunya tempat AI menulis kode.** Kalau jawaban AI
  berisi `needs`, klipian membuat **brief komponen** (juga salin-tempel): satu file TSX,
  hanya SVG, warna dari token palet, props `state` dan `t`, tanpa import selain
  yang diizinkan. klipian menjalankan cek tipe dan aturan import, merender
  gambar uji, lalu ian menyetujui atau menolak. Yang disetujui masuk pustaka
  dan dipakai ulang tanpa AI; katalog di brief ikut bertambah.
- **Susunan teknis:**
  - **UI:** halaman `/remotion` di klipian (vanilla JS, gaya tombol
    /workspace). Alur sehari-hari tidak perlu membuka UI Remotion.
  - **Server klipian (Python, 5177):** endpoint `/api/motion/...`; proyek
    video disimpan sebagai JSON di workspace profile
    (`profiles/<id>/motion/<project>/`).
  - **Proyek Remotion:** folder `remotion/` di repo (template dan pustaka
    komponen). Tidak ada server Node yang menyala terus: Python menjalankan
    `node remotion/render.mjs <job.json>`, yang mem-bundle sekali (di-cache
    sampai komponen berubah), memanggil `renderStill` atau `renderMedia`, dan
    mencetak progres sebagai baris JSON di stdout. Python membacanya untuk
    persen, ETA dan Cancel, seperti render klip.
  - **Remotion Studio opsional:** tombol "Buka di Studio" menjalankan Studio
    di `127.0.0.1` (port lain, misalnya 3123) dengan props proyek itu, untuk
    melihat gerak frame demi frame. Hanya untuk melihat; yang tersimpan tetap
    JSON di klipian. Dimatikan dari klipian.
- **Endpoint usulan:**

  | Endpoint | Fungsi |
  |---|---|
  | `GET /api/motion/projects` | daftar video motion di profile |
  | `POST /api/motion/create` | proyek baru dari topik, durasi, catatan |
  | `GET /api/motion/brief?id=&kind=main\|revise\|component` | teks brief untuk ditempel ke AI |
  | `POST /api/motion/paste` | tempel hasil AI; divalidasi, atau pesan perbaikan |
  | `POST /api/motion/facts` | simpan centang gerbang fakta dan judul terpilih |
  | `POST /api/motion/update` | edit teks narasi atau layar dari UI |
  | `POST /api/motion/preview` | gambar diam per beat |
  | `POST /api/motion/render` | render MP4 lewat antrean, hasil ke Clips |
  | `GET /api/motion/status` | progres, ETA, error |
  | `POST /api/motion/cancel` | batalkan render |
  | `POST /api/motion/component` | uji komponen baru (cek tipe + gambar uji), setujui/tolak |
  | `POST /api/motion/studio` | buka atau tutup Remotion Studio (opsional) |

- **Keamanan:** Node hanya dijalankan klipian dengan argumen file job; Studio
  hanya di localhost; kode komponen dari AI tidak dirender sebelum lolos cek
  tipe dan aturan import, menghasilkan gambar uji, dan disetujui ian.

**P28-A — spike (rencana kerja untuk sesi eksekusi).** Tujuan: membuktikan
"JSON → template Remotion → MP4" dengan storyboard colokan panas, mengukur
waktunya di mesin ian, dan mengecek lisensi. **Tanpa** perubahan server, UI,
atau workspace klipian.
1. **Proyek `remotion/`** di root repo: `package.json` dengan versi pasti
   (remotion, @remotion/cli, @remotion/bundler, @remotion/renderer, react,
   react-dom, typescript, zod). `.gitignore`: `remotion/node_modules/`,
   `remotion/out/`, `remotion/.cache/`. Font Outfit dan DM Mono (OFL) ikut di
   `remotion/public/fonts/` beserta lisensinya.
2. **Token dan komponen** (meniru lembar acuan; sumber bentuknya di skrip
   Python `workspace/channel-art/klipian-intip/`: `make_v2.py` untuk
   gelembung dan wajah maskot, `chibi_people.py`, `make_mascot.py`,
   `make_storyboard.py`, plus PNG-nya):
   - `tokens.ts`: palet hitam/kuning/abu, merah hanya untuk makna, warna
     panas, logam;
   - `Mascot`: gelembung + satu mata lensa; 6 ekspresi; squash/stretch,
     miring, kilau; masuk "pop";
   - `Chibi`: minimal pemuda (rambut pendek) dengan ekspresi calm, happy,
     surprised, ouch, pose idle, point, ouch, dan kostum helm;
   - `LensReveal`: lingkaran clip-path yang bergerak, cincin hitam dan gagang
     kuning; di dalam lingkaran tampil potongan, di luar tampak luar;
   - `Socket`: tampak luar (polos, berasap/gosong) dan potongan (rapat,
     kendur) dengan titik arus yang mengalir dan cahaya panas 0–1;
   - `Banner`, `Pill`, `Label`, latar `Room` dan `Black`.
3. **Komposisi `FunFact`** 1080×1920, 30 fps, durasi = jumlah durasi beat.
   Stop-motion: waktu animasi dibulatkan ke langkah 12 fps, dengan goyangan
   kecil acak tapi deterministik (seed dari id beat). *(Dibatalkan oleh
   P28-A2: gerak halus.)*
4. **Skema storyboard (zod)** dan `stories/colokan-panas.json` berisi 8 beat
   dari `storyboard-colokan-panas.png`, plus klaim dengan sumber dan teks
   posting. Koordinat dalam satuan frame 1080×1920.
5. **`render.mjs <job.json>`:** job berisi mode (`still` atau `video`), path
   story, path keluaran, dan frame (untuk still). Bundle di-cache berdasarkan
   hash isi `src/`. Progres sebagai baris JSON (`progress`, `done`, `error`).
   Cancel lewat sinyal (cancelSignal Remotion) saat proses dihentikan.
   Keluaran ke `remotion/out/`.
6. **Pemeriksaan:** `npm run check` (tsc --noEmit) dan tes skema: story contoh
   lolos; komponen, ekspresi atau pose yang tidak ada ditolak; teks layar
   lebih dari 6 kata ditolak; klaim tanpa sumber ditolak. Selftest klipian
   tetap lulus (tidak ada kode Python yang berubah).
7. **Ukur dan laporkan:**
   - waktu bundle pertama dan dari cache;
   - waktu `renderStill` per beat;
   - waktu render penuh ± 42 detik dan ukuran MP4, dengan concurrency default
     dan 4/8;
   - ukuran `node_modules` dan unduhan Chrome Headless Shell;
   - ringkasan lisensi Remotion (remotion.dev/license) untuk pemakaian
     perorangan ian.
   Jangan mengukur saat ian sedang transkripsi atau render.
8. **Hasil yang diserahkan ke ian:** MP4 colokan panas (tanpa suara), 8
   gambar diam per beat, angka di atas, dan catatan apa yang sulit ditiru
   dari lembar acuan.
Belum termasuk (untuk P28-B ke atas): halaman `/remotion`, endpoint, brief,
suara, takarir, brief komponen, render massal.

**Hasil P28-A** (b60a44f, 2026-10-25; ditambah bayangan kedalaman 3609fde):
JSON → template → MP4 terbukti. Video 42 detik dirender ± 60 detik
(concurrency default paling cepat, hasil identik setiap render), gambar diam
± 2,5 detik per beat, bundle pertama ± 15 detik lalu dari cache,
`node_modules` ± 800 MB (termasuk Chrome render ± 280 MB). Lisensi Remotion
gratis untuk perorangan, termasuk konten yang dimonetisasi. **Penilaian ian:**
sangat kaku, patah-patah, semua objek bergetar, animasi terlalu sedikit;
channel acuan membedah benda (misalnya kepala charger) secara 3D dengan gerak.

**P28-A2 — spike gerak halus dan uji bedah 3D** (keputusan ian 2026-10-25;
rencana kerja untuk sesi eksekusi). Batasan sama dengan P28-A: hanya
`remotion/`, tanpa perubahan klipian, versi paket pasti, commit lokal.
1. **Gerak halus untuk video colokan panas** (isi dan durasi 42 detik tetap):
   - buang langkah 12 fps dan goyangan acak; waktu kontinu 30 fps, gerak
     dengan `spring()` dan `interpolate` + easing;
   - **pustaka gerak** (`motion.ts`), kosakata tetap yang dipilih AI lewat
     JSON:
     - masuk/keluar: `pop`, `slide` (arah), `fade-up`, `draw` (jalur kabel
       dan arus, `@remotion/paths`), dengan jeda berurutan 3–5 frame
       otomatis menurut urutan item;
     - diam yang hidup: maskot melayang, berkedip, pupil lensa melirik ke
       target; chibi bernapas, berkedip, pose lengan berpindah dengan pegas;
       arus mengalir terus;
     - penekanan: `highlight` (denyut), `shake` (hanya untuk bahaya);
     - kamera per beat: `push` (zoom pelan 1.00 → 1.08), `pan`, `still`;
     - transisi antar beat: `slide`, `wipe`, `zoom`, `cut`
       (`@remotion/transitions`), dan **tembus lensa**: lingkaran lensa
       membesar sampai memenuhi layar dan beat potongan berikutnya ada di
       dalamnya;
     - teks: kata muncul satu per satu, kata kunci menyala kuning
       (`highlight` di JSON);
     - motion blur tipis untuk gerak cepat (`@remotion/motion-blur`), kalau
       biaya rendernya masuk akal;
   - skema: per item `enter`, `exit`, `actions` (`[{at, kind, ...}]`), per beat
     `camera` dan `transition`; semuanya opsional dengan bawaan yang tetap
     bergerak, dan divalidasi dari kosakata di atas;
   - `stories/colokan-panas.json` diisi dengan gerak itu, lalu dirender ulang.
2. **Uji bedah 3D**, komposisi terpisah `Dissect3D` (6–8 detik, 1080×1920):
   - `@remotion/three` (React Three Fiber + three, versi pasti dan cocok
     dengan React 19);
   - benda: **kepala charger** dari bentuk dasar di kode (cangkang, 2 kaki,
     port USB; di dalam: papan PCB, trafo, kapasitor, chip);
   - tampilan toon/datar dengan palet klipian intip, cahaya dari kiri atas,
     latar `WALL`;
   - gerak: benda masuk berputar dengan pegas, kamera mengitari ± 30°,
     cangkang terbelah dan terangkat, bagian dalam memisah berurutan
     (exploded view), label 2D muncul, titik arus kuning mengalir, satu
     bagian menyala panas; fakta tidak diklaim (hanya uji visual);
   - ukur: waktu render per detik video, pengaturan GL Chrome yang dipakai
     di Windows, masalah yang ditemui.
3. **Serahkan ke ian:** MP4 colokan versi halus, MP4 uji 3D, beberapa frame
   pembanding (lama vs baru), angka render, dan penilaian: apakah bedah 3D
   layak menjadi adegan "hero" per video (tokoh dan maskot tetap 2D).

**Hasil P28-A2 sampai A4** (e8e6362, 3e58e62, 2e3a4ad, 123198b; sudah di-push
2026-10-26): gerak halus dengan kosakata gerak tetap, latar `brand`/`lab`,
benda utama 3D toon (stop kontak, colokan, potongan; uji bedah charger), kabel
kurva halus, 25 sound effect buatan sendiri dengan mixer, dan skill resmi
Remotion di `remotion/.claude/skills`. ian menilai hasil A4 oke.

**P28-B — halaman `/remotion` di klipian** (rencana kerja untuk sesi
eksekusi, 2026-10-26). Alur satu brief di atas menjadi fitur; tanpa API key,
semuanya lokal.
1. **Satu sumber kebenaran:** katalog dan skema tetap di `remotion/` (TS +
   zod). Dua skrip Node kecil dipanggil Python: `catalog-export.mjs` (katalog
   sebagai JSON untuk isi brief) dan `validate.mjs <story.json>` (hasil zod
   sebagai JSON: ok, atau daftar kesalahan dengan path). Python tidak
   menyalin aturan.
2. **Modul `klipian/motion.py`** (meniru pola `ytdl.py`): proyek per profile di
   `profiles/<id>/motion/<slug>/` berisi `project.json` (topik, durasi
   30/45/60, catatan, status, judul terpilih), `story.json` (jawaban AI
   terakhir yang lolos validasi, plus riwayat versi), `facts.json` (centang
   per klaim dengan tanggal), dan `out/` (gambar diam, MP4).
3. **Brief:** `build_brief(project)` membuat satu file mandiri (Copy brief /
   Download, seperti brief klip): tugas, struktur menurut durasi, aturan
   channel dan fakta, katalog dari `catalog-export`, aturan judul/hashtag dari
   profile (`hashtags.brief_rule`), format jawaban dengan contoh, dan `needs`.
   `build_revise_brief(project, beat_ids, note)` untuk klaim yang ditolak, dan
   `build_fix_message(errors)` untuk JSON yang tidak lolos.
4. **Endpoint** sesuai tabel di atas (`/api/motion/...`), kecuali `component`
   dan `studio` (P28-D). Tempel jawaban: perbaiki JSON yang umum rusak
   (perbaikan f238480), validasi lewat `validate.mjs`, simpan atau kembalikan
   pesan perbaikan.
5. **Pratinjau:** gambar diam per beat lewat `render.mjs` mode still, di
   antrean berat (sched) sebagai pekerjaan ringan.
6. **Gerbang fakta:** render ditolak server selama ada klaim yang belum
   dicentang atau ditolak; judul harus dipilih.
7. **Render:** `render.mjs` mode video lewat sched (grup render yang sama),
   progres dari baris JSON stdout, Cancel dengan menulis `cancel` ke stdin,
   ETA seperti render klip, dan bunyi selesai (notify.js). Hasilnya menjadi
   baris Clips (`fileFolder` `motion`) dengan judul terpilih, deskripsi dan
   hashtag dari story, siap upload single/bulk (P16).
8. **UI `/remotion`** (vanilla JS, gaya tombol /workspace, topbar dan
   profile yang sama): daftar proyek; form baru (topik, durasi, catatan);
   Copy brief / Download; kotak tempel dengan hasil validasi dan Copy pesan
   perbaikan; lembar storyboard (gambar diam per beat, narasi dan teks layar
   bisa diedit lalu divalidasi ulang); daftar fakta (klaim, sumber sebagai
   tautan, centang/tolak, brief revisi); pilih judul; Render dengan progres,
   ETA, Cancel; tautan ke baris Clips. Pesan dan label dalam bahasa
   Indonesia yang sama dengan halaman lain.
9. **Tes:** selftest baru di salinan port 5178 dengan story kecil (2 beat,
   ± 2 detik) supaya render nyata tetap cepat; brief, fix message, validasi,
   gerbang fakta, Cancel, baris Clips; tidak menyentuh workspace ian;
   selftest penuh harus lulus.
Belum termasuk: suara narasi dan takarir (P28-C), brief komponen baru,
Studio, render massal (P28-D).

**Evaluasi P28-B (ian 2026-10-26): belum layak publish.** Uji topik "kenapa
hujan turun" menghasilkan slide teks: pustaka aset baru berisi benda listrik,
jadi AI yang hanya boleh memakai katalog tidak punya awan, matahari atau laut;
teks juga tertutup maskot dan chibi karena koordinat ditulis AI tanpa
pengatur tata letak. Template data-saja menjaga konsistensi, tetapi membatasi
kualitas pada isi pustaka.

**Keputusan: produksi per video di Claude Code + pengatur tata letak** (ian
2026-10-26, pilihan B + C).
- **Alur baru:** klipian tetap membuat brief, menerima jawaban AI, menjalankan
  gerbang fakta, merender, membuat baris Clips dan meng-upload (P28-B tetap
  dipakai). Di antara gerbang fakta dan render ada **satu sesi Claude Code di
  folder `remotion/`** (dengan skill Remotion) yang menulis adegan khusus untuk
  video itu dari story yang sudah dicek, memakai design system channel. ian
  meninjau dan merevisi lewat Remotion Studio. Tetap tanpa API key di klipian:
  Claude Code berjalan terpisah dengan langganan ian.
- **Design system** = komponen yang sudah ada (palet, maskot, chibi, latar
  `brand`/`lab`, benda 3D toon, kabel, kosakata gerak, transisi, sound effect,
  area aman) ditambah panduan tertulis `remotion/DESIGN.md` yang wajib dibaca
  setiap sesi video.
- **Pustaka tumbuh:** setiap benda atau adegan baru yang dibuat untuk satu
  video disimpan sebagai aset di pustaka (dengan nama, state, contoh), jadi
  video berikutnya lebih cepat dan katalog brief ikut bertambah.
- **Pengatur tata letak otomatis (C):** zona tetap (banner atas, objek utama
  tengah, keterangan samping, maskot kiri bawah), label dan teks didorong
  supaya tidak saling menutup atau menutup objek, semua di area aman. Dipakai
  oleh template data dan oleh adegan khusus.
- **Video khusus di klipian:** proyek motion bisa menunjuk komposisi khusus
  (`remotion/videos/<slug>/`) selain template; render, gerbang fakta, Clips
  dan upload sama.

**Tokoh dan maskot secukupnya** (ian 2026-10-26):
- **Orang (chibi) tidak wajib.** Dipakai hanya kalau cerita memang butuh
  manusia: ada orang yang melakukan sesuatu (mencabut colokan, memasak),
  bagian tubuh (tangan kena pisau), atau reaksi orang yang jadi inti adegan.
  Topik tentang benda (stop kontak, charger) cukup bendanya sendiri.
- **Maskot jangan terlalu sering.** Wajib di pembuka "Intip yuk!" dan
  penutup; di tengah paling banyak 1–2 reaksi singkat (± 1 detik) pada momen
  penting (misalnya kaget saat titik panas muncul). Tidak ada maskot yang
  diam di pojok sepanjang video (menggantikan aturan maskot `persist` di
  pojok dari A3).
- Layar yang lebih kosong diisi oleh benda utama yang besar, bagian-bagiannya,
  label penunjuk, panah dan gerak, bukan oleh tokoh.

**Batas mutu sebelum publish** (dinilai ian, untuk setiap video):
1. setiap benda langsung dikenali tanpa membaca label;
2. tidak ada yang saling menutup, semua di area aman;
3. di setiap detik ada gerak yang bermakna, tidak ada layar diam yang lama;
4. teks layar terbaca dalam 1 detik di ukuran HP;
5. suara sinkron dengan gerak, tidak ramai;
6. setiap klaim bersumber dan dicentang;
7. hook 3 detik pertama memancing penasaran;
8. ditonton ulang di HP tetap enak.

**P28-P — 3 video uji coba** (rencana 2026-10-26):
- **Langkah 1 (sesi eksekusi):** pengatur tata letak, `remotion/DESIGN.md`,
  struktur `remotion/videos/<slug>/` (komposisi khusus yang memakai komponen
  design system), dukungan komposisi khusus di `render.mjs` dan proyek
  motion klipian, serta cara mendaftarkan aset baru ke pustaka dan katalog.
- **Langkah 2 (sesi Claude Code "klipian motion" di folder `remotion/`):**
  satu video demi satu, setiap video melewati batas mutu sebelum lanjut:
  1. "Kenapa colokan bisa panas?" (dibuat ulang sampai layak, aset listrik
     sudah ada);
  2. "Kenapa hujan turun?" (aset alam baru: matahari, laut, uap, awan, tetes);
  3. "Kenapa charger bisa panas?" (bedah 3D charger yang sudah ada).
  Naskah dan fakta tiap video lewat brief klipian dan gerbang fakta seperti
  biasa.
- **Langkah 3:** ian menilai ketiganya. Kalau layak, lanjut publish dan
  P28-C (suara). Kalau tidak, catat apa yang kurang sebelum membuat lebih
  banyak.

**Tahapan usulan (diperbarui 2026-10-25):** P28-A spike (di atas, selesai) →
P28-A2 gerak halus dan uji bedah 3D → P28-B
halaman `/remotion` dan endpoint: input topik dan durasi, brief, tempel dan
validasi, pratinjau dan gerbang fakta, brief revisi, render → Clips → P28-C
suara dan takarir (setelah riset ian; tanpa key layanan suara) → P28-D brief
komponen baru dan render massal.

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
