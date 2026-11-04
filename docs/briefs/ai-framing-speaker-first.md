# Brief: AI Framing "speaker first": yang bicara selalu masuk frame

Dari sesi Plan, 2026-11-02. Lanjutan `ai-framing-one-button.md` (commit d29fdfe). Uji **hanya akun podcast** (salinan di
workspace sementara), jangan tulis apa pun ke `workspace/` ian.

## Aturan dari ian
> Shot dekat atau jauh, jangan dipaksakan semua orang masuk frame. Yang penting **1 orang yang ngomong terlihat di frame**.
> Misalnya ada 3 orang, kanan-kiri kepotong setengah tidak apa, yang penting yang ngomong masuk frame.

Jadi tujuan tiap titik: **wajah pembicara utuh dan berada di tengah kotak**. Orang lain boleh terpotong.
Memusatkan kotak di kelompok (`group`) tidak lagi menjadi tujuan.

## Perubahan di `facebox.frame_segments` (d29fdfe)

### 1. Kenali wajah tiap pembicara dulu (pass pertama, sebelum menentukan kotak)
- Telusuri semua segmen. Segmen yang **hanya berisi satu wajah utama** dan berada di dalam **satu** giliran bicara speaker X
  (diarisasi) memberi bukti kuat bahwa wajah itu X. Ambil embedding SFace-nya (`_face_embedding`) dan kumpulkan per speaker.
- Satu speaker bisa punya beberapa bukti. Simpan rata-rata embedding (dinormalisasi) atau semua embedding, lalu cocokkan dengan
  kemiripan maksimum.
- Konflik (dua speaker berbeda menunjuk ke wajah yang sama, kemiripan ≥ ambang) → yang buktinya lebih banyak menang, yang
  lain tidak punya wajah.
- Bukti dari gerakan mulut di close-up (satu wajah, mulut bergerak) tidak perlu; satu wajah + satu speaker sudah cukup.

### 2. Tentukan kotak per segmen (pass kedua), urutan prioritas:
1. **`speaker-face`**: segmen milik speaker X yang wajahnya dikenal, dan ada wajah di frame yang cocok (cosine ≥ 0,363)
   → kotak berpusat pada wajah itu.
2. **`speaker-mouth`**: wajah X tidak dikenal atau tidak cocok → gerakan mulut "clear winner" seperti sekarang, **tapi abaikan
   sampel dalam 0,4 dtk dari cut** (transisi dan efek grafis terbaca sebagai gerakan; contoh res72 t≈997).
   Wajah pemenang yang dipilih di sini juga dicatat sebagai bukti tambahan wajah X (lebih lemah dari pass 1).
3. **`single`**: hanya ada satu wajah utama → wajah itu.
4. **`largest`**: tidak ada petunjuk pembicara → wajah terbesar.
5. Tanpa wajah → `kept` (titik sebelumnya), atau `center` untuk segmen pertama.
- **Kotak selalu berpusat pada wajah terpilih** (horizontal; vertikal seperti sekarang, wajah di sekitar 35% dari atas kotak).
  Tidak lagi dipusatkan di kelompok. Kalau wajah lain kebetulan ikut masuk, itu bonus; orang yang terpotong separuh tidak apa-apa.
- Validasi: wajah **terpilih** harus utuh di dalam kotak, dengan padding 4% lebar kotak. Validasi "minimal satu wajah utuh"
  diganti dengan ini.
- `group` dihapus dari daftar `why`. Status UI menyesuaikan, misalnya "12 points: 7 on the speaker's face, 3 by mouth movement, 2 largest".

### 3. Segmen yang pembicaranya tidak ada di frame
Kalau X dikenal tapi tidak ada wajah yang cocok di segmen itu (misalnya shot reaksi), pakai gerakan mulut. Kalau tidak ada pemenang,
**pertahankan titik sebelumnya selama shot-nya sama** (kamera tidak cut). Kalau shot-nya baru, pakai `largest`.

## Tes
- Selftest fungsi murni: wajah pembicara dari pass 1 dipilih di shot lebar 3 orang (wajah lain terpotong boleh, wajah pembicara utuh);
  konflik bukti; mulut diabaikan dekat cut; pembicara tidak ada di frame → kept/largest; validasi wajah terpilih utuh.
- Semua `tests/*.test.js` + selftest penuh lolos, baseline render tidak berubah.
- **Uji nyata (salinan, akun podcast):** GJLS res72/73/74 + Ferry res19/20/21, 3:4. Untuk memverifikasi pembicara,
  **dengarkan audionya**: potong audio ±2 dtk di tiap titik shot lebar dengan ffmpeg, lalu bandingkan dengan close-up terdekat
  (siapa yang terlihat bicara di close-up pada giliran yang sama). Tabel per titik: why, wajah yang dipilih, pembicara sebenarnya
  (menurut bukti close-up/diarisasi), benar/salah. Screenshot hijau (baru) vs merah (d29fdfe), khususnya res74 t=402/413,
  res72 t=995/997/1030/1044, Ferry t≈741.

## Selesai jika
Di shot lebar, kotak berpusat pada pembicara yang dikenali dari close-up-nya (wajah lain boleh terpotong), transisi tidak lagi
memindahkan kotak, tes hijau. Commit (jangan push). Laporkan hash, tabel, dan screenshot.
