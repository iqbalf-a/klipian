# Brief: AI Framing untuk acara TV komedi (Arisan) di 3:4

Dari sesi Plan, 2026-11-03. Lanjutan AI Framing av-sync (66362aa). ian sekarang ingin AI Framing bisa dipakai di akun
**klipian-lucu** untuk acara "Arisan" (Trans7 / 7 Comedy) dengan Picture **3:4**. Uji di **salinan** project klipian-lucu di
workspace sementara; jangan tulis apa pun ke `workspace/` ian. Aturan lama tetap: **yang bicara harus utuh di frame, orang lain
boleh terpotong**, satu tombol AI Framing, tidak apa lebih lambat.

## Keputusan ian
- **PALING PENTING: framing berpindah tepat ketika scene (cut kamera) di source berpindah.** Setiap cut harus punya titik
  framing baru di waktu cut itu, tanpa telat dan tanpa cut yang terlewat. Kalau titik terlambat walau beberapa frame, kotak dari
  shot lama terlihat di shot baru (wajah terpotong/kursi kosong). Ini diukur dan diperbaiki lebih dulu dari poin lain.
- Shot dengan teks pertanyaan kuis (bar di bawah layar, hampir selebar frame) **tetap 3:4; teks boleh terpotong**. Tidak perlu
  mundur ke 16:9 blur.

## Yang Plan lihat di footage (contact sheet, `7 Comedy - WENDI JADI KAPTEN ... ARISAN (07 10 26).mp4`, 1547–1595 dan 600–696)
- Close-up 1 orang dan shot 2–3 orang di depan mic: mirip podcast.
- **Shot lebar** sering: host dan 3–5 peserta berdiri utuh di depan, **puluhan peserta lain berdiri di belakang**; wajah depan
  kira-kira 2–4% lebar frame, wajah belakang lebih kecil dan lebih tinggi di frame.
- Komedi fisik: joget, menunjuk, lari; gerak badan besar.
- Peserta yang menjawab berdiri di **mic stand** di tengah panggung.
- Shot sangat pendek (2–4 dtk), shot grafis tanpa orang (papan ARISAN), audio penuh tawa penonton dan musik.

## Langkah 0: ukur dulu (sebelum mengubah kode)
Jalankan AI Framing yang sekarang (66362aa+) pada 3 Result Arisan di salinan, Picture 3:4. Pilih Result yang berisi shot lebar,
misalnya dari project `25d2e4e6e1f7` (Wendi), `1327780f720e` (Ariel), `f64f17a5b61d` (Rusuh). Laporkan per titik: why, jumlah
wajah terdeteksi, jumlah orang (`N`) dan speaker sebelum/sesudah re-diarisasi, waktu per Result, dan benar/salah (yang bicara
utuh di kotak). Ini dasar perbandingan; kirim tabelnya bersama hasil akhir.

## Perbaikan (sesuaikan dengan temuan langkah 0; laporkan yang tidak perlu)
0. **Titik tepat di setiap cut (prioritas utama).**
   - Ukur di 3 Result Arisan: daftar cut sebenarnya (cek per frame di sekitar tiap perubahan, contact sheet/frame-diff) vs cut yang
     ditemukan `scenecut.detect_cuts` (ambang 0,35) vs waktu titik framing. Laporkan cut terlewat, cut palsu, dan selisih waktu
     titik terhadap cut (dalam frame).
   - Set Arisan sangat berwarna dan sering ada transisi/wipe dan zoom cepat; sesuaikan deteksi (ambang, metrik, atau pemeriksaan
     dua tahap) sampai **tidak ada cut yang terlewat** di klip uji, tanpa banyak cut palsu.
   - Waktu titik = frame pertama shot baru (dibulatkan ke frame, bukan ke sampel kasar). Pastikan render dan preview memakai
     kotak baru tepat mulai frame itu (cek di render, bukan hanya di data).
   - Segmen pendek < 0,6 dtk tetap digabung **kecuali** itu shot sungguhan (cut di kedua sisi): shot 0,5 dtk tetap dapat titik sendiri
     supaya kotaknya tidak salah orang. Laporkan pilihan yang dipakai.
   - Di dalam satu shot (tanpa cut), kotak hanya pindah kalau yang bicara berpindah dan keluar dari kotak; kalau masih di dalam
     kotak, jangan pindah (hindari lompatan yang tidak perlu).
1. **Penonton latar tidak dihitung.** Wajah "utama" = wajah di lapisan depan: relatif terhadap wajah depan terbesar di segmen
   (misalnya ≥ 50% lebarnya) dan posisi vertikal sejajar orang depan; wajah kecil yang jauh lebih tinggi di frame (barisan
   belakang) dibuang dari pemilihan dan dari hitungan `N`. Hitungan `N` dibatasi (misalnya maksimal 6) supaya re-diarisasi tidak
   meminta puluhan speaker. Pastikan klip podcast (GJLS/Ferry) tidak berubah hasilnya.
2. **Deteksi wajah kecil di shot lebar.** Kalau perlu, turunkan `min_frac` / naikkan resolusi deteksi untuk shot lebar sehingga
   wajah 2–4% terdeteksi stabil. Ukur dampak waktu.
3. **Gerak badan lebih berbobot di shot lebar.** Di av-sync, kalau wajah kecil (mulut tidak terbaca), bobot badan/tangan dinaikkan
   (misalnya `act = 0.2·mulut + 0.8·badan` di bawah ukuran wajah tertentu), dengan area badan lebih tinggi karena orang berdiri
   utuh. Tawa/musik membuat envelope audio berisik: pertimbangkan memakai envelope dari pita frekuensi suara (±300–3000 Hz)
   atau envelope yang sudah dibersihkan, kalau terbukti lebih baik di data uji.
4. **Mic stand sebagai petunjuk lemah (opsional, hanya kalau langkah 0 menunjukkan perlu).** Kalau satu orang depan berdiri di
   depan mic di tengah dan av-sync tidak punya pemenang jelas, pilih dia sebelum `largest`. Deteksi mic boleh sederhana
   (garis vertikal tipis gelap di bawah wajah); kalau tidak andal, lewati dan laporkan.
5. **Waktu proses:** banyak shot pendek; laporkan waktu per Result.
6. Teks kuis: tidak ada perlakuan khusus (keputusan ian).

## Tes
- Selftest fungsi murni untuk tiap aturan baru (penonton latar dibuang, batas `N`, bobot badan di wajah kecil, mic sebagai
  petunjuk kalau dibuat), dengan data sintetis.
- Semua `tests/*.test.js` + selftest penuh lolos, baseline render tidak berubah.
- **Regresi podcast:** GJLS res72/73/74 dan Ferry res19/20/21 hasilnya sama atau lebih baik daripada 66362aa (tabel singkat).
- **Uji nyata Arisan:** 3 Result dari langkah 0, sebelum vs sesudah: tabel per titik + screenshot hijau (baru) vs merah (lama)
  untuk shot lebar, close-up, 2–3 orang di mic, dan shot dengan teks kuis.

## Selesai jika
Di Arisan 3:4, setiap cut di klip uji punya titik framing tepat di frame cut itu (tabel cut sebenarnya vs titik, nol terlewat);
yang bicara utuh di kotak di shot lebar lebih sering daripada sebelum perubahan, penonton latar tidak memengaruhi
pilihan, podcast tidak memburuk, tes hijau. Commit (jangan push), tanpa `remotion/` dan `docs/briefs/`. Laporkan hash, tabel
sebelum/sesudah, waktu, dan screenshot.
