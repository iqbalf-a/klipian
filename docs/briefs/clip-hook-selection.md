# Brief: pilih klip dari hook, bukan dari topik utuh (tools klip: podcast dan lucu)

Dari sesi Plan, 2026-11-18. Hanya tools klip (profil podcast dan lucu). Generate motion tidak tersentuh.

## Latar
Analisis YouTube Studio klipian podcast: Shorts baru hanya 1-15 views, traffic 87,3% dari Search dan 1,86% dari Shorts feed,
stayed to watch 0% di beberapa video, durasi 102-169 detik. Artinya video dites ke kelompok kecil, penonton swipe di 2 detik
pertama, distribusi berhenti. Penyebab di kode: prompt memilih "satu topik utuh dari setup ke payoff" (`_ONE_TOPIC`), jadi klip
selalu dibuka dari pembukaan topik, bukan dari kalimat yang menahan penonton.

## Sudah dikerjakan (Fase 1, belum di-commit)
- `roundtrip.py`: `HOOK_MIN = 8` dan aturan "strong hook" di `_ONE_TOPIC` (jawaban kosong boleh, jangan mengisi daftar).
- `autopilot.py`: `drop_weak_hooks()` dipanggil di `_step_clips` sebelum `found[:most]`; skor 0 (tidak ada skor) tetap dipertahankan; hasil
  kosong memakai jalur yang sudah ada ("No topic in this video was worth a clip.").
- `selftest.py` (`check_cliplength`) dan `tests/fixtures/brief/brief.md` (golden) diperbarui. `python -m klipian selftest` hijau.

## Durasi (sudah dikerjakan, keputusan ian 2026-11-18)
Menggantikan keputusan 2026-11-08 (60-120 / 180, `clip-length-whole-story.md`): **ideal 30-60 s, maks 90 s, di bawah 20 s hanya kalau topiknya
selesai di situ** (`CLIP_MIN_SEC = 20`). Berlaku global di `roundtrip.py`, `gemini.js`, `app.js` (RIBBON_DURATION), kedua rubrik, tes JS,
`selftest.py` dan golden brief. Risiko yang diketahui: klip pendek bisa memotong payoff; cek hasil batch pertama dengan mata.

## Fase 2: sinyal non-teks untuk kandidat
Hasil cek: heatmap "Most replayed" lewat yt-dlp (`.venv`, 2026.08.19) ADA untuk video populer kontrol, TIDAK ADA untuk tiga video
sumber podcast yang dites (0,75-3,5 juta views). Jadi heatmap hanya bonus.
1. Skor energi audio dengan ffmpeg (puncak volume, tawa, jeda kejut, tempo bicara). `cues.py` sudah menghitung tawa, jeda, dan bicara
   cepat per klip: pakai ulang dulu sebelum menulis yang baru.
2. Heatmap dipakai kalau ada (`ytdl.py`, field `heatmap`); file lokal tanpa heatmap tetap jalan.
3. Kandidat yang kuat di sinyal ini dikirim ke AI dengan skornya di prompt; AI tetap memutuskan hook.

## Fase 3: cold open hook (opsi per profil, default mati)
Tambahkan satu span di depan klip berisi kalimat `hook` lewat `_concat_filter` (`render.py`). Varian A: frame dibekukan + teks besar
gaya `thumbnail.py` selama hook (1-2 detik, bukan 3). Varian B: video tetap bergerak dengan teks besar. Kalimat hook terdengar dua kali
(awal dan tempat aslinya), itu disengaja. Belum diverifikasi: apakah render sudah bisa membekukan frame.

## Fase 4: tes
Batch 5 video per varian (durasi pendek saja; durasi pendek + A; durasi pendek + B). Bandingkan stayed to watch dan sumber traffic di
Studio setelah 3-7 hari. Setelah sekitar 20 video, masukkan contoh klip yang berhasil dan yang mentok ke prompt.

## Catatan
- Skor `hook` dari AI hanya dari teks; ambang 8 adalah tebakan awal. Lihat beberapa run nyata apakah terlalu ketat.
- Push hanya atas OK ian.

## Status Fase 2 dan 3 (2026-11-19)
- Fase 2: `cues.py` menyimpan loudness per detik (`CUES_VERSION` 2) dan memberi "loud peak" (persentil 97 dari video itu sendiri);
  heatmap disimpan `ytdl.py` ke `Cache.heatmap_path` hanya kalau ada ("most replayed", persentil 90). Keduanya baris tambahan di blok cues
  prompt, bukan chip di editor, bukan skor per kandidat.
- Fase 3: `RenderJob.cold_open` (`freeze` | `move`), opsi profil `coldOpen` (default mati), request boleh menimpa dengan `coldOpen`.
  Teks besar di pita atas (bukan di tengah, supaya tidak menutup wajah), maksimal 3 baris, ukuran mengikuti baris terpanjang.
  Segmen cold open dibingkai seperti span yang memuat hook, termasuk posisi head tracking pada detik itu.
- Dicek pada klip podcast asli (Agak Laen, 45 s, face tracking): frame beku tidak janggal, wajah tidak tertutup.
- Batas: (1) cabang multi-video (library projects) hanya memberi cold open bila hook diucapkan di run PERTAMA; hook di run lain
  dilewati tanpa error. (2) Jalur pratinjau (`server.py`) dan CLI render tidak membaca opsi ini. (3) Hook yang lebih panjang dari 2 s
  dipotong di kata utuh terakhir yang muat; teks besar memakai `thumbnail.cut_hook` (maks 7 kata).

## Status cold open, perbaikan setelah tes render nyata (2026-11-20)
- Sebab klip "Tensi 230" tidak dapat cold open: hook AI ("Kemarin itu dia bangun tidur. Tensinya 230 per 130") ada di transkrip pada
  detik 1376-1381, SEBELUM klip mulai (1401); di dalam klip kalimatnya "Abi begitu bangun tensinya 2 .30 per 1 .30" (angka dipecah
  jadi "2" + ".30"). Pencocokan persis tidak menemukan, dan cold open dilewati diam-diam.
- `render.hook_match` sekarang: persis dulu, lalu hampir-persis (angka bertetangga digabung, awalan kata >= 4 huruf sama, minimal
  50% token hook dan >= 3 token terdengar berurutan, ada angka atau kata 5+ huruf, jendela mulai dan berakhir di kata hook). Hook yang
  tidak berhubungan, atau hanya satu kata sama, tidak cocok.
- Tidak diam-diam lagi: `jobs.cold_open_for` mengembalikan catatan; ditulis ke konsol server dan ke hasil render (`coldNote`).
- Varian "Frozen frame" sekarang = satu frame beku (momen hook, atau frame pertama klip kalau hook tidak ketemu) + teks besar gaya
  thumbnail (`thumbnail.STICKER`: Impact, kuning, stroke gelap, border putih, miring, kata `*...*` dari kolom `thumb` berwarna aksen;
  fallback `cut_hook`) + suara TTS Gemini (`klipian/tts.py`). Lama beku = lama suara + 0,25 s, 1-3 s; suara lebih dari 3 s: teks
  dipotong dan disuarakan ulang, tidak pernah suara dipotong. Suara asli klip tidak ikut. Level suara disamakan ke suara klip
  (`tts.clip_gain_db`, ebur128 pada 20 s pertama; hasil uji -10,2 LUFS vs klip -11,4).
- TTS: model `gemini-3.8-flash-tts`, voice `Fola`, lewat `v1beta` (di API default model ini 404). Pengaturan di file settings Gemini:
  `ttsModel`, `ttsVoice`, `ttsStyle` (default kosong). Petunjuk gaya di dalam teks ("Say energetically: ...") DIBACAKAN oleh model
  ini (didengar dengan Whisper), jadi tidak dipakai; energi hanya dari tanda "!" di akhir. Cache `workspace/cache/tts/` per
  (teks, model, voice, style): render ulang tidak memanggil Google. Free tier: 3 permintaan per menit (satu kali tunggu otomatis).
- Opsi profil baru `coldVoice`: kosong = suara AI, `original` = suara asli klip di bawah frame beku. TTS gagal (tanpa key, kuota,
  jaringan) = render tanpa cold open dan alasannya di catatan; render tidak gagal. "Moving video" tetap memakai suara asli klip.
- Batas: pratinjau (`server.py`) dan CLI render masih tidak membaca opsi ini.
- Koreksi TTS (2026-11-20, setelah dokumentasi Gemini 3.8 TTS dibaca): model ini memperlakukan `text` sebagai transkrip persis, jadi
  arahan gaya yang ditaruh di depan teks (atau "## Transcript:") ikut DIBACAKAN. Gaya dikirim sebagai anotasi `speech_metadata`
  (`style`) lewat Interactions API (`client.interactions.create`, `v1beta`, voice di `generation_config.speech_config`). Default
  `tts.DEFAULT_STYLE` (bahasa Indonesia santai, energik, dramatis, tempo cepat, tekanan di kata kunci, tanpa jeda di awal); ubah lewat
  `ttsStyle` di file settings Gemini ("" = tanpa gaya). Gaya ikut kunci cache dan tidak masuk teks layar. Hook yang sama: tanpa
  gaya ±3,1 s, dengan gaya ±2,0 s (lebih cepat). Freeze = panjang suara + 0,1 s, suara diberi fade-out 40 ms supaya sambungan ke video
  tidak berbunyi klik; caption mulai tepat saat video mulai (digeser sebesar freeze).
- Pengaturan dipindah (keputusan ian, 2026-11-20, "Panel render + Admin"): pilihan cold open (Off / Frozen frame / Moving video) dan
  sumber suara (suara AI / suara asli klip) ada di dialog render ("Render N clips?", `bulkPlanBody` di `bulk.js`), diingat di
  localStorage (`klipian.coldOpen`, default Off) dan dikirim di request `/api/render` sebagai `coldOpen` dan `coldVoice`;
  `jobs.start_project_render` menaruhnya di tiap klip lewat `jobs.clean_cold`. Default profil tidak dibaca lagi: field lama
  `coldOpen`/`coldVoice` di profil yang sudah ada tetap termuat, diabaikan, dan hilang pada save berikutnya. Profile settings tidak
  memuat apa pun soal freeze atau TTS. Gaya, model, dan voice TTS + tombol Save voice / Try voice ada di Admin settings, tab Gemini
  API (`/api/admin/tts`, `/api/admin/tts/try`; endpoint Admin saja), tetap tersimpan di file settings Gemini.
