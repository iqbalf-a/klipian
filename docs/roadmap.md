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
- Fallback `?video=` dan `legacyFile` di `/api/project`: tentukan kapan
  dihapus.
- Folder lama `out/radityadika-podcast/`, `out/cadera-gameplay-mlbb/`,
  dan `projects/legacy/` dibersihkan manual oleh ian. Jangan dihapus
  oleh sesi.
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
2.0, ±4 MB) dijalankan lewat `onnxruntime`, yang sudah terpasang sebagai
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

**Syarat lanjut ke integrasi:**
- tawa: minimal 7 dari 10 memang tawa, dan rentang "hehehe" di
  2372–2385 detik pada radityadika-podcast ikut tertangkap;
- sinyal lain: ian memutuskan per sinyal, ikut atau tidak. Sinyal yang
  mayoritas salah tidak ikut ke brief.

**Integrasi (baru dikerjakan setelah syarat terpenuhi):**
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
  stempel juga tidak ada. **TANYA IAN**, tidak mendesak: kembalikan
  ribbon sebagai peta "di mana klip ditemukan dalam episode", atau
  lepaskan dari brief desain?
- **Opsi B dari 2.3** (penyusunan request render pindah ke server). Buka
  lagi kalau ian butuh render tanpa UI. Saat itu, baseline hasil 3a
  menjadi jaring pengamannya.
