# Brief: Clips "Choose moments": Transcribe selected + Delete selected

Dari sesi Plan, 2026-11-03. Lanjutan 295b8d2 (sudah di-push). Permintaan ian: di layar Clips, tombol "Transcribe these 8 clips"
diganti menjadi **transcribe moment yang dipilih saja**, dan di panel **Choose moments** ada **hapus** untuk rekomendasi AI.
Uji di salinan workspace sementara, jangan tulis ke `workspace/` ian.

## 1. Transcribe selected (`#recTranscribe`, `roundtrip.js` `drawTranscribeClips` / `wantedRanges`)
- Label: **"Transcribe selected (N)"**, N = jumlah moment yang dicentang di `#recList`. Tanpa centang: tombol tetap terlihat tapi
  nonaktif, title "Tick moments above first" (pola yang sama dengan `#recAddBtn`).
- Rentang yang ditranskripsi = hanya moment yang dicentang (±20 dtk, digabung, dikurangi yang sudah tercakup), lewat
  `clipRanges`/`subtractRanges` yang sudah ada. Title tombol: "about M min of audio" dihitung dari centang itu.
- Kalau semua moment yang dicentang sudah tercakup transkrip: nonaktif, title "Already transcribed".
- Tombol tetap tersembunyi kalau video sudah punya transkrip utuh (seperti sekarang).
- Tombol di panel Import di layar Prepare (`#transcribeClips`, "Transcribe these N clips") **tidak berubah**: di sana tidak ada
  centang, jadi tetap semua klip hasil import.
- Redraw saat centang berubah.

## 2. Delete selected di Choose moments
- Tombol **"Delete selected"** di kepala panel Choose moments (dekat `#recUndo`), gaya tombol kecil berbingkai seperti
  `/workspace` (bukan pill), nonaktif tanpa centang.
- Dua klik seperti Remove di layar Assets: klik pertama mengubah teks jadi "Delete N moments?" (beberapa detik), klik kedua
  menghapus. Atau satu klik + **Undo** memakai mekanisme `#recUndo` yang sudah ada; pilih yang paling sesuai dengan kode
  sekarang dan laporkan.
- Yang dihapus: hanya kandidat yang dicentang dari `DATA.candidates` (disimpan ke project seperti perubahan kandidat lain).
  **Tidak** menghapus Result yang sudah dibuat dari moment itu, tidak menyentuh transkrip, tidak menyentuh file video.
- Setelah hapus: `#recNote`, tombol Transcribe selected, "What should the ticked moments become?" ikut diperbarui.

## Tes
- Tes Node tanpa DOM untuk fungsi murni yang baru (rentang dari moment terpilih; daftar kandidat setelah hapus).
- Semua `tests/*.test.js` + selftest penuh lolos.
- Cek di preview (salinan, workspace sementara): centang 3 dari 7 moment → "Transcribe selected (3)" dengan menit yang benar;
  hapus 2 moment → hilang dari daftar, tetap hilang setelah reload, Result yang sudah ada tidak berubah. Screenshot.

## Selesai jika
Di Choose moments ada "Transcribe selected (N)" yang hanya mentranskripsi moment tercentang dan "Delete selected" yang
menghapus moment tercentang dengan pengaman (dua klik atau undo); tes hijau. Commit (jangan push), tanpa `remotion/` dan
`docs/briefs/`. Laporkan hash dan screenshot.
