# Brief: jalur Ask Gemini, transkripsi hanya rentang klip hasil import

Dari sesi Plan, 2026-11-03. Lanjutan `prepare-three-paths.md` (commit af9868d). Uji di salinan akun podcast (workspace sementara),
jangan tulis apa pun ke `workspace/` ian.

## Keputusan ian
- Tombol **Transcribe** (video utuh) dan jalur A **tidak berubah**.
- Jalur B (Ask Gemini): video tetap diunduh utuh → Copy brief for Ask Gemini → tempel jawaban → Copy brief for AI → Import
  (misalnya 8 klip) → tombol **"Transcribe these 8 clips"** yang hanya mentranskripsi rentang waktu klip-klip itu.
  Alasannya: lebih hemat waktu (7 klip ≈ 10 menit audio vs 66 menit video).

## Transkripsi per rentang

- `transcribe.transcribe(..., ranges=None)`: kalau `ranges` (daftar `(start, end)` detik) diberikan, teruskan sebagai
  `clip_timestamps` ke faster-whisper (sudah dicek: versi 1.2.1 di `.venv` menerimanya). Waktu kata tetap waktu video asli. Satu
  kali muat model, satu kali jalan. `on_segment`/progres dihitung dari total panjang rentang, bukan durasi video.
  Verifikasi dulu bahwa `vad_filter` dan `clip_timestamps` bisa dipakai bersamaan; kalau tidak, laporkan pilihan yang dipakai.
- Rentang = tiap klip ±20 dtk (dijepit ke 0..durasi), lalu rentang yang bertumpuk atau berjarak < 5 dtk digabung.
- `Transcript` diberi field `ranges: list[[start, end]] | None` (None = video utuh; transkrip lama dibaca sebagai utuh).
- **Menambah, bukan mengganti:** kalau transkrip sebagian sudah ada untuk video itu, rentang baru yang belum tercakup saja yang
  ditranskripsi, lalu segmen digabung dan diurutkan, `ranges` digabung. Transkripsi utuh (tombol Transcribe biasa) selalu
  menggantikan transkrip sebagian.
- Job: pakai `/api/transcribe` dan `_run_transcribe` yang ada dengan field `ranges` di request (jangan endpoint baru kecuali perlu).
  Kunci job (`transcribe_key`) harus membedakan transkripsi utuh dan per rentang. Audio cues (Laughter dan seterusnya) tetap
  berjalan seperti sekarang (dari audio, video utuh); cue berbasis kata (Pauses, Fast talk) hanya dari kata yang ada.
- Cache: `find_transcript` tetap satu aturan untuk semua pembaca; transkrip sebagian adalah transkrip video itu dengan `ranges`.

## Siapa yang harus tahu transkripnya sebagian
- **Jalur A (Export / Find clips with Claude):** brief butuh transkrip utuh. Kalau transkripnya sebagian, panel A menulis
  "The transcript covers only the imported clips. Transcribe the whole video to use this." dan tombolnya nonaktif (atau
  `/api/brief` mengembalikan pesan itu).
- **Analyze / panel transkrip:** label "Transcript: 8 clip ranges, 9:40 of 1:06:12", tombol Transcribe tetap ada untuk video
  utuh.
- **Render / Captions:** bagian Result di luar `ranges` tidak punya kata. Kalau sebuah Result keluar dari rentang, tampilkan
  peringatan yang menyebut rentangnya ("no captions for 17:20–17:45: not transcribed") di Candidates/Render, dengan tombol
  yang mentranskripsi rentang itu (memakai jalur "menambah" di atas). Jangan gagal render.

## UI
- Setelah Import berhasil dan video **belum punya transkrip utuh**: di foot panel Import (dan di kepala Candidates di layar Clips)
  muncul tombol **"Transcribe these N clips"** dengan keterangan "about M min of audio instead of the whole video". N dan M
  dihitung dari kandidat import terakhir (setelah penggabungan rentang).
- Selama berjalan, pakai progres transkripsi yang sudah ada (`#transcribePanel`).
- **Rapikan titik potong setelah selesai:** kandidat dari import itu yang belum diubah ian di-snap ke kata (`snap_to_word`,
  aturan yang sama seperti `parse_reply_notes`). Kandidat yang sudah diubah dibiarkan. Laporkan berapa yang di-snap.
- Gaya tombol: tombol kecil berbingkai seperti `/workspace`, bukan pill.

## Tes
- Selftest fungsi murni: perhitungan rentang (padding, jepit, gabung), gabung transkrip sebagian (segmen urut, `ranges`
  digabung, rentang yang sudah tercakup tidak diulang), transkrip utuh menggantikan sebagian, transkrip lama tanpa `ranges` =
  utuh, brief A menolak transkrip sebagian, deteksi Result di luar rentang.
- Selftest transkripsi nyata yang kecil: audio sintetis/fixture yang sudah ada dengan 2 rentang → kata hanya di rentang itu,
  waktunya waktu asli.
- Semua `tests/*.test.js` + selftest penuh lolos, baseline render tidak berubah.
- **Uji nyata (salinan, akun podcast):** video podcast panjang, import JSON 7–8 klip, "Transcribe these N clips". Catat waktu
  vs transkripsi utuh (dari cache yang sudah ada atau perkiraan dari kecepatan), cek subtitle di preview satu klip, geser satu
  klip keluar rentang → peringatan + tombol tambah rentang bekerja. Screenshot.

## Selesai jika
Di jalur Ask Gemini, setelah import ada tombol untuk mentranskripsi hanya rentang klip; subtitle klip-klip itu jadi; transkripsi
utuh dan jalur A tidak berubah dan tahu kalau transkripnya sebagian; tes hijau. Commit (jangan push), tanpa `remotion/` dan
`docs/briefs/`. Laporkan hash, waktu, dan screenshot.
