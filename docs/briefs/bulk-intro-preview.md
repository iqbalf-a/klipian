# Brief: dialog Output format: preview intro + tombol "White on black" tidak bisa diklik

Dari sesi Plan, 2026-11-02, berdasarkan screenshot ian dari dialog "Output format for 1 Result".

## 1. Bug: "White on black" tidak bisa diklik

Penyebab (`ui/js/editor/bulk.js:353-356`, `drawIntro`): tombol style memakai `b.disabled = !introCheck.checked`,
padahal checkbox "Put each Result's intro…" ada di BAWAH tombol. Akibatnya ian melihat dua tombol, yang satu terlihat
terpilih dan yang lain mati, tanpa petunjuk apa pun.

Perbaikan:
- Urutan di blok Intro text: eyebrow → **checkbox + seconds (baris pertama)** → tombol style → keterangan.
- Tombol style dan input seconds **tidak pernah disabled** (kecuali tidak ada Result yang punya intro). Mengklik style atau
  mengubah seconds **otomatis mencentang** checkbox, karena orang yang memilih style memang ingin intro dipasang.
- Checkbox tetap bisa dilepas. Dalam keadaan tidak dicentang, Apply tidak mengubah overlay (seperti sekarang).

## 2. Preview intro di frame contoh dialog

Frame 9:16 di kanan dialog (`side` / `.frame916`, `drawStage`) menampilkan label intro Result sampel saat checkbox dicentang,
dengan style dan posisi yang sama seperti hasil Apply.
- Overlay yang ditampilkan: `withAngleIntro(slot.overlays || [], intro, total, seconds, …)` lalu style dari pilihan
  (`withAngleBoxStyle`), lalu ambil elemen `origin: "angle-intro"`. Kalau Result sudah punya label intro yang digeser atau
  diperbesar, posisi dan ukurannya ikut tampil.
- HTML label: pisahkan cabang `kind === "text"` di `drawOverlays` (`ui/js/editor/compose.js`) menjadi fungsi
  `overlayTextHTML(e, frameHeight)` yang dipakai `drawOverlays` dan dialog ini. **Satu cara menggambar**, jangan salin CSS-nya.
  Tambahkan `<div class="overlay-layer">` (atau class yang dipakai `#overlayLayer`) di dalam `.frame916` dialog.
- Digambar ulang saat centang, style, seconds (seconds tidak mengubah tampilan, abaikan saja), atau Sample berubah.
  Frame-nya tetap still (detik ±1). Label ditampilkan apa pun detiknya, karena tujuannya preview gaya, bukan waktu.
- Result sampel tanpa intro: tidak ada label, dan keterangan di bawah frame berbunyi "this Result has no intro".

## Tes
- Node: kalau `overlayTextHTML` bisa dimuat di Node tanpa DOM, tambahkan cek kecil (light/dark menghasilkan warna yang benar).
  Kalau tidak bisa, cukup cek preview.
- Preview dengan workspace sementara (jangan sentuh `workspace/` ian): buka dialog, klik "White on black" → checkbox
  tercentang dan frame menampilkan kotak hitam; klik "Black on white" → kotak putih; lepas centang → label hilang dari
  frame dan Apply tidak mengubah overlay. **Kirim screenshot dialog** untuk kedua style.
- `node tests/*.test.js` dan `python -m klipian selftest --only bulk labelbox` lolos.

## Selesai jika
Kedua tombol style bisa diklik dan mencentang intro secara otomatis, frame contoh menampilkan intro sesuai pilihan, dan tes
hijau. Commit (jangan push), tanpa `remotion/` dan `docs/briefs/`. Laporkan hash dan screenshot.
