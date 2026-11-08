# Brief: end time klip jangan memotong topik

Dari sesi Plan, 2026-11-08. Laporan ian: start time dari Ask Gemini / brief AI sudah cukup akurat, tapi **end time
kadang memotong**: topiknya masih nyambung sampai 10:15, JSON dari AI berhenti di 10:00. Minta: perketat end time
supaya klip tetap satu topik yang tuntas, dan tetap ada batas durasi maksimal untuk YouTube Shorts.

## Kenapa terjadi
- Jalur Ask Gemini: brief untuk Claude (`roundtrip.build_gemini_brief`) **tidak punya transkrip**. Claude disuruh memakai
  waktu Gemini "exactly as written", jadi end time sepenuhnya tebakan Gemini, dan Gemini cenderung berhenti terlalu cepat.
- Setelah transkripsi, klipian hanya snap end ke **kata terdekat** (`SNAP_MAX` 2 dtk, `roundtrip.js:128` dan
  `roundtrip.py:707`). Itu merapikan, tidak memperpanjang ke akhir kalimat atau topik.
- Jalur A (`build_brief`, transkrip penuh): `_ONE_TOPIC` sudah ada, tapi tidak bilang "lebih baik telat beberapa detik
  daripada terpotong".

## Batas durasi (tetap)
- Tetap **30–90 detik** per klip, seperti `GEMINI_PROMPT` sekarang. (YouTube Shorts sekarang boleh sampai 3 menit, tapi
  aturan channel tetap 90.) Satu konstanta bersama, mis. `CLIP_MAX_SEC = 90` di `roundtrip.py`, dipakai brief dan
  perpanjangan di bawah; jangan tulis angka 90 di banyak tempat.
- Kalau topiknya lebih panjang dari 90 dtk: akhiri di **akhir kalimat** tempat poinnya sudah tersampaikan (aturan
  `_ONE_TOPIC` yang ada), jangan di tengah kalimat.

## Kerjakan

### 1. Pertanyaan Ask Gemini: minta kalimat terakhir
`GEMINI_PROMPT` (`ui/js/editor/gemini.js`) **dites manusia** (Gemini menolak kata klip/TikTok/viral/editing), jadi ubah
seminimal mungkin, tanpa kata-kata itu:
- "kutip kalimat pertama yang diucapkan" → "kutip kalimat pertama **dan kalimat terakhir** yang diucapkan"
- tambahkan: "Waktu selesai adalah saat kalimat terakhir topik itu selesai diucapkan; kalau kalimat berikutnya masih
  membahas hal yang sama, ikutkan."
Tulis di komentar bahwa versi baru perlu dicoba ian sekali di YouTube. Tes yang mengecek teks prompt ikut disesuaikan.

### 2. Brief Gemini → Claude: bawa kalimat terakhir
- `build_gemini_brief`: `endQuote` = kalimat terakhir yang dikutip Gemini, persis (kosong jika Gemini tidak memberi).
  Waktu tetap "exactly as written".
- Format jawaban: field opsional `endQuote` per klip (juga diizinkan di brief jalur A, tapi tidak wajib). `parse_reply_notes`
  meneruskannya ke kandidat; balasan lama tanpa `endQuote` tetap terbaca.

### 3. Perpanjang end ke akhir topik setelah transkripsi (inti perbaikan)
Fungsi murni baru di `roundtrip.py` (dan versi JS yang sama di `roundtrip.js`, seperti `snap_to_word`):
`settle_end(words, segments, start, end, end_quote, max_sec)` →
1. Kalau ada `end_quote`: cari kalimat itu di transkrip di jendela `[end - 30, end + 30]` (cocok longgar: huruf kecil, tanpa
   tanda baca, ≥ 70% kata sama berurutan). Ketemu → end = akhir kata terakhir kalimat itu.
2. Kalau tidak ada / tidak ketemu: end = akhir **kalimat (segmen)** tempat end jatuh; kalau end jatuh di jeda antar segmen,
   akhir segmen sebelumnya.
3. End **tidak pernah dimundurkan** lebih dari `SNAP_MAX` dari end asli (perbaikan ini hanya memperpanjang), dan
   `end - start ≤ max_sec`; kalau melewati batas, ambil akhir kalimat terakhir yang masih ≤ batas.
4. Kembalikan juga alasan singkat ("extended 10:00 → 10:15 to the end of the sentence") untuk catatan import.
Dipakai di: import jalur A (menggantikan snap end sekarang), `snapImported` setelah "Transcribe these N clips", dan
`snapPart` di `ytparts.js`. Kandidat yang sudah diubah ian tidak disentuh (aturan yang ada).

### 4. Jalur "parts only": pad belakang
End bisa maju sampai ~30 dtk, jadi pad **sesudah** klip di `clipRanges` untuk jalur parts naik dari 20 ke 35 dtk (pad depan
tetap 20). Kalau end yang diperpanjang tetap keluar dari part yang sudah didownload: batasi ke akhir part dan sebutkan di
catatan ("10:15 is past the downloaded part").

### 5. Brief jalur A (transkrip penuh): yang paling diperketat (tambahan ian)
ian: Ask Gemini memang tanpa transkrip, cukup pertanyaannya dibuat optimal (langkah 1). **Brief AI setelah video
ditranskripsi** yang harus paling ketat, karena di situ AI melihat transkripnya.
- `_ONE_TOPIC` (dipakai `build_brief` dan `build_api_brief`) ditambah: "End a clip only after the last sentence of its topic
  is finished. Before you write `end`, read the next two or three lines of the transcript: if they still continue the
  same point (an answer, a punchline, a conclusion, a reaction to it), the clip is not finished yet. A few seconds too late
  is better than cutting the topic short. A clip is at most {CLIP_MAX_SEC} seconds; a longer topic ends at the end of a
  sentence where its point is already made."
- Di jalur A, `endQuote` **wajib**: "`endQuote` is the last sentence of the clip, copied exactly from the transcript."
  Contoh JSON di format jawaban ikut memuatnya. Hapus kalimat "The times you give don't need to be precise" sejauh
  menyangkut `end` (start tetap boleh kira-kira); ganti dengan: klipian mencocokkan `endQuote` ke kata di transkrip.
- `scores.complete` di rubric/format: sebutkan bahwa klip yang berhenti sebelum topiknya tuntas mendapat nilai rendah.
- Saat import jalur A, `settle_end` memakai `endQuote` (langkah 3). Balasan tanpa `endQuote` tetap terbaca (memakai akhir
  kalimat).
- Selftest brief: teks aturan ada di `build_brief` dan `build_api_brief`, contoh JSON memuat `endQuote`.

## Tes
- Selftest fungsi murni `settle_end`: end di tengah kalimat → akhir kalimat; `endQuote` ditemukan 15 dtk lebih jauh →
  diperpanjang; `endQuote` tidak ketemu → akhir segmen; tidak pernah mundur > SNAP_MAX; batas 90 dtk dipotong di akhir
  kalimat; kandidat yang diubah ian tidak berubah. Versi JS diuji di `tests/` dengan kasus yang sama.
- `endQuote` lewat `build_gemini_brief` → parse → kandidat; balasan lama tanpa field tetap terbaca.
- `tests/*.test.js` + selftest (motionbrief masih merah, masalah lama f68022b).
- Uji nyata di **salinan akun podcast**: satu video yang sudah ditranskripsi + balasan JSON lama yang memotong; import ulang
  → catat berapa end yang diperpanjang dan berapa detik; cek 2 klip di preview bahwa topiknya tuntas.

## Selesai jika
End time tidak lagi berhenti sebelum kalimat/topik selesai (dalam batas 90 dtk), Gemini diminta kalimat terakhir, brief
Claude membawanya, tes hijau. Commit brief ini bersamanya. Jangan push, laporkan ke Plan.
