# Brief: klip lebih panjang dan utuh (cerita, bukan potongan 30 detik)

Dari sesi Plan, 2026-11-08. Laporan ian setelah Autopilot dengan Gemini API (gemini-3.7-flash): konteks masih terpotong, dan 4
klip semuanya ~30 detikan, terlalu singkat untuk satu cerita atau topik.

## Bukti (run "TRAGEDI BINTARO 1", proyek podcast 2b41e99b573b, storytelling Nessie Judge)
- Durasi klip: 59, 55, 35, 32 detik.
- Klip "Vonis Janggal" berakhir di 944.6 dan klip "Nasib Pilu Masinis" mulai tepat di 944.6: **satu cerita dipecah jadi dua klip**.

## Penyebab
1. Rubric `prompts/rubrik/dialog-podcast.md` bagian "5. Durasi": **"Pita ideal 30–45 detik. Boleh 20–60"**. Skor `duration` mendorong
   model memotong pendek. `komedi-tv.md`: 15–40.
2. `CLIP_MAX_SEC = 90` (`klipian/roundtrip.py:223`) membatasi semua brief dan `settle_end`.
3. Tidak ada aturan minimum, tidak ada aturan "dua momen bersebelahan dari cerita yang sama digabung", dan tidak ada langkah
   "bagi transkrip jadi topik dulu, baru pilih".

## Keputusan ian
- **Ideal 60–120 detik, maksimum 180 detik** (batas YouTube Shorts sekarang). Di bawah 45 detik hanya kalau topiknya memang selesai
  di situ.
- **Satu angka untuk semua** (semua profile, semua jalur). Bukan pengaturan per template.

## Kerjakan
1. **Konstanta bersama** di `roundtrip.py`: `CLIP_MIN_SEC = 45`, `CLIP_IDEAL = (60, 120)`, `CLIP_MAX_SEC = 180`. Twin di
   `ui/js/editor/gemini.js` (dan di mana pun 90 masih tertulis: grep `90` di roundtrip.py/.js, gemini.js, ytparts.js, autopilot). Satu
   komentar menyebut tempat-tempatnya.
2. **Rubric**: bagian "5. Durasi" di `dialog-podcast.md` dan `komedi-tv.md` ditulis ulang ke pita yang sama: ideal 60–120 detik, 45–60
   dan 120–180 boleh dengan skor turun bertahap, di bawah 45 hanya kalau topiknya benar-benar selesai di situ (skor rendah kalau
   karena dipotong), tidak pernah lebih dari 180. Pertahankan kalimat "Jangan memotong gagasan supaya masuk pita". Rubric buatan
   ian sendiri (custom) tidak diubah, tapi lihat poin 3.
3. **`_ONE_TOPIC`** (dipakai `build_brief` dan `build_api_brief`, jadi Autopilot ikut) ditambah, dalam bahasa Inggris seperti sekarang:
   - "A clip tells one story or one topic from its setup to its payoff: the question or situation, what happens, and how it ends or
     what it means. Aim for {ideal} seconds; never more than {max}. A clip under {min} seconds is right only when the topic itself is
     that short; a clip that is short because it stops early is wrong."
   - "Before you choose, split the whole transcript into its topics or story parts, each with where it starts and ends. Then pick
     whole topics from that list. Do not pick a piece from the middle of a topic."
   - "Two neighbouring moments of the same story become one clip, not two. Clips must not touch or overlap unless they are clearly
     different topics."
   - "The duration band here replaces any duration band in the rubric."
   Hapus kalimat lama yang bertentangan (mis. "at most 90 seconds" diganti konstanta baru).
4. **Pertanyaan Ask Gemini** (`GEMINI_PROMPT` di `gemini.js`, dites manusia, ubah seminimal mungkin): ganti pita 30–90 ke 60–120 (paling
   lama 180) tanpa kata klip/TikTok/viral/editing; tambah "satu cerita utuh dari awal sampai akhir". Komentar: ian perlu mencobanya
   sekali di YouTube. `build_gemini_brief`: kalimat "A clip longer than … is still written as it is" pakai konstanta baru.
5. **Gemini API** (`gemini_api.find_clips`): kalau google-genai 3.0.0 dan model yang dipilih mendukung pengaturan thinking (cek di
   dokumentasi/SDK yang terpasang, jangan menebak nama parameter), pakai level thinking tertinggi untuk pemilihan klip; kalau model
   menolak, ulangi tanpa itu (pola fallback yang sama dengan schema). Kalau tidak didukung, lewati poin ini dan sebutkan di laporan.
6. **Cek setelah import di Autopilot** (`_step_clips`/`_import_reply`, fungsi murni yang bisa dites): klip yang bersentuhan atau tumpang
   tindih (jarak < 2 dtk) **dan** gabungannya ≤ `CLIP_MAX_SEC` digabung jadi satu (judul/hook dari yang pertama, `endQuote` dari yang
   terakhir, catat di note run). Klip < `CLIP_MIN_SEC` tidak dibuang, hanya dicatat di note run ("2 clips are under 45 s").
7. `settle_end` memakai `CLIP_MAX_SEC` baru (180) otomatis; tidak ada perubahan lain di situ.

## Tes
- Selftest brief: teks aturan baru ada di `build_brief` dan `build_api_brief`; 90 tidak tertulis lagi di brief; rubric bawaan memuat
  60–120.
- Selftest fungsi gabung (poin 6): dua klip bersentuhan → satu; gabungan > 180 → tetap dua; klip terpisah 30 dtk → tetap dua.
- `tests/*.test.js` (yang mengecek teks `GEMINI_PROMPT` ikut disesuaikan) + selftest (motionbrief masih merah, masalah lama).
- Uji nyata dengan Gemini API di **salinan akun podcast** (transkrip TRAGEDI BINTARO dan "Bener-Bener Pusat Dunia" sudah ada): jalankan
  `find_clips` sekali per video lewat brief baru, **tanpa render dan tanpa upload**. Laporkan durasi tiap klip sebelum (59/55/35/32)
  dan sesudah, judulnya, dan apakah ada cerita yang masih terpecah. Jangan menyalakan server kedua di workspace ian.

## Selesai jika
Brief dan rubric mendorong klip 60–120 detik berisi satu cerita utuh (maks 180), klip bersebelahan dari cerita yang sama digabung, uji
nyata menunjukkan klip lebih panjang. Commit brief ini bersamanya. Jangan push, laporkan ke Plan.
