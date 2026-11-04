# Brief: AI Framing, pembicara dari kecocokan gerakan (mulut + tangan) dengan suara, dan jumlah pembicara dari wajah

Dari sesi Plan, 2026-11-03. Lanjutan `ai-framing-speaker-first.md` (commit 6009c10, sudah di-push).
Kata ian: orang yang bicara biasanya gerak tangannya juga; **tidak apa lebih lambat, yang penting akurat dan mudah dipakai**.
Jadi tetap **satu tombol AI Framing**, tanpa opsi baru di UI. Uji **hanya akun podcast** (salinan di workspace sementara), jangan tulis
apa pun ke `workspace/` ian.

## Masalah yang tersisa (dari uji 6009c10)
1. Di shot lebar, wajah kecil membuat `_mouth_motion` berisik, dan gerak pendengar (tertawa, mengangguk) bisa mengalahkan pembicara.
2. Diarisasi menggabungkan orang: GJLS (4–5 orang) terbaca 2 speaker, Ferry (2 orang) terbaca 1. Karena itu "wajah speaker X"
   bisa berisi beberapa orang.

## 1. Skor "bicara" = kecocokan gerakan dengan suara (AV sync)

Per segmen yang perlu menentukan pembicara (setiap segmen dengan lebih dari satu wajah utama):
- **Sampel padat:** frame pada 8 fps sepanjang segmen (maksimal ±6 dtk di tengah segmen untuk segmen panjang), di resolusi deteksi yang sama.
  Lacak wajah antar frame lewat kedekatan posisi (pakai deteksi `_merge_faces` per frame, atau deteksi di frame pertama lalu jendela
  tetap per wajah, karena dalam satu shot posisi orang hampir diam).
- **Gerakan per wajah per langkah waktu** (frame differencing grayscale, sudah dipakai `_mouth_motion`):
  - mulut: `_mouth_motion` yang sudah ada;
  - badan dan tangan: area di bawah wajah, lebar ±3× lebar wajah dan tinggi ±3× tinggi wajah, dijepit ke frame dan **dipotong
    supaya tidak masuk ke area badan orang di sebelahnya** (batas tengah antar wajah).
  - Kurangi gerakan global kamera: median selisih seluruh frame per langkah, atau estimasi translasi dengan `cv2.phaseCorrelate`
    lalu align sebelum differencing. Langkah dengan gerakan global besar (zoom/geser/transisi) dibuang.
  - Normalisasi per area (rata-rata per piksel), lalu gabungkan: `act = 0.5·mulut_z + 0.5·badan_z` (z-score per wajah dalam segmen).
- **Suara:** ambil audio segmen (ffmpeg → wav 16 kHz mono, seperti `diarize_segment`), hitung envelope RMS pada langkah waktu yang sama.
- **Skor per wajah** = korelasi Pearson `act` dengan envelope (juga coba lag 0 sampai +0,2 dtk dan ambil yang terbaik), dan rata-rata `act`
  saat suara keras dikurangi saat suara pelan.
- **Pemenang jelas:** skor tertinggi ≥ 0,25 **dan** unggul ≥ 0,1 atas peringkat kedua. Kalau tidak jelas: tidak ada pemenang.
  Ambang awal; sesuaikan dari data uji dan laporkan nilai yang dipakai.

**Tempat di urutan prioritas** (`frame_segments`):
1. `av-sync`: pemenang jelas AV sync → wajah itu. Simpan sebagai bukti wajah speaker X dengan bobot "kuat".
2. `speaker-face`: wajah speaker yang dikenali (pass 1). Kalau AV sync punya pemenang jelas yang BERBEDA dari wajah ini, AV sync menang;
   catat `conflict` di laporan.
3. `single` → `largest` → `kept`/`center` seperti sekarang.
`speaker-mouth` lama diganti `av-sync` (mulut tetap bagian dari skornya). Aturan anti-loop dari 6009c10 tetap: bukti lemah tidak
boleh menimpa wajah dari pass 1. AV sync dihitung "kuat" hanya kalau pemenangnya jelas.

## 2. Jumlah pembicara dari wajah

- Di `/api/aiframe` (server), setelah pass 1: kelompokkan embedding SFace semua wajah utama dari segmen close-up (satu wajah utama)
  menjadi identitas (cosine ≥ 0,363 = orang yang sama). `N` = jumlah identitas yang muncul di ≥2 segmen (orang yang sekilas lewat tidak dihitung).
- Kalau `N` > jumlah speaker hasil diarisasi: jalankan ulang diarisasi untuk span itu dengan `min_speakers=N`
  (tambahkan parameter `min_speakers=None` ke `diarize_segment`, diteruskan ke pipeline pyannote; cek dulu di dokumentasi pyannote
  yang terpasang bahwa argumen itu diterima). Lalu pass 1 dan 2 dijalankan dengan giliran baru.
  Cache diarisasi harus ikut membedakan `min_speakers`.
- Lapor di status UI kalau ini terjadi: "found 3 people on camera; speech re-split into 3 speakers".

## Kemudahan pakai
- UI tidak berubah: satu tombol AI Framing dan satu centang di Render selected.
- Overlay progres menambah tahap "Matching movement to speech…" supaya proses yang lebih lama tidak terlihat macet.
- Status akhir tetap satu kalimat, misalnya "14 points: 9 by movement matching speech, 3 on the speaker's face, 2 largest".

## Tes
- Selftest fungsi murni:
  - korelasi: wajah dengan `act` mengikuti envelope menang atas wajah yang bergerak acak;
  - gerakan global kamera dibuang;
  - batas area badan tidak masuk ke tetangga;
  - tanpa pemenang jelas → jatuh ke prioritas berikutnya;
  - konflik AV sync vs speaker-face → AV sync menang;
  - penghitungan `N` identitas (sekilas lewat tidak dihitung).
  Gunakan data sintetis (array numpy), bukan video ian.
- Semua `tests/*.test.js` + selftest penuh lolos, baseline render tidak berubah.
- **Uji nyata (salinan, akun podcast):** GJLS res72/73/74 dan Ferry res19/20/21, 3:4, dibandingkan dengan 6009c10. Per titik shot lebar:
  why, skor AV (dua teratas), wajah yang dipilih, dan benar/salah menurut close-up terdekat + giliran diarisasi (yang baru, kalau dijalankan ulang).
  Catat juga jumlah speaker sebelum/sesudah petunjuk `N`, waktu per Result, dan screenshot hijau (baru) vs merah (6009c10).
  Tandai terang-terangan titik yang tidak bisa diverifikasi.

## Selesai jika
Di shot lebar, pembicara dipilih dari gerakan (mulut + tangan) yang cocok dengan suara, dan lebih sering benar daripada 6009c10 di klip uji.
Diarisasi tidak lagi menggabungkan orang yang terlihat berbeda di close-up. UI tetap satu tombol. Tes hijau. Commit (jangan push).
Laporkan hash, tabel perbandingan, dan screenshot.
