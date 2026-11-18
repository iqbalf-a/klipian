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
