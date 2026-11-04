# Brief: "Shot framing": framing otomatis per shot, cepat, untuk 3:4 (dan bulk)

Dari sesi Plan, 2026-11-02. Konteks ian: targetnya kuantitas, jadi ia bulk render 16:9 + blur. Ia ingin 3:4, tetapi
AI Framing belum bisa diandalkan untuk kontennya, yaitu acara TV multi-kamera (kuis, talkshow): banyak orang,
shot berganti terus, dan sering ada shot reaksi.

## Kenapa AI Framing sekarang kurang cocok (analisis Plan, dari kode)

AI Framing (`ui/js/editor/framing.js:1060-1500`, `klipian/facebox.py`, `klipian/diarize.py`) dirancang untuk podcast:
diarisasi suara (pyannote, lambat), lalu posisi tiap pembicara dicari **sekali** (`locate_speaker`, butuh pemenang
gerakan mulut yang jelas), lalu `track_crops` per giliran bicara dan per cut, mencari **di sekitar posisi pertama itu**.
Di TV multi-kamera, posisi orang berubah antar shot, banyak wajah membuat pemenang mulut tidak jelas (hasil dibuang),
dan shot reaksi tidak berisi pembicaranya.

Kotak 3:4 dari 16:9 lebarnya sekitar 42% frame (9:16 hanya sekitar 32%), jadi untuk 3:4 biasanya cukup memastikan
**wajah-wajah utama di tiap shot** masuk kotak, tanpa perlu tahu siapa yang bicara.

## Yang dibangun

### Server: `facebox.frame_shots(video, start, end, crop_size) -> {"points": [{at, crop}]}`
- Shot: `scenecut.detect_cuts(video, start, end)` (sudah ada, di bawah 1 detik) → batas shot `[start, c1, c2, …, end]`.
  Shot yang lebih pendek dari 0,6 detik digabung ke shot sebelumnya (kedipan atau transisi).
- Per shot: ambil maksimal 4 frame merata (ffmpeg, seperti `_extract_frames`/`locate_speaker`), lalu deteksi wajah
  dengan YuNet (`_load_face_detector`) **di seluruh frame** (margin tepi 3% seperti `locate_speaker`).
  **Penting:** `_detect_faces` membuang wajah yang lebih kecil dari 15% lebar region. Untuk pencarian seluruh frame itu
  terlalu ketat, karena wajah di shot lebar TV sekitar 4–8% lebar frame. Tambahkan parameter `min_frac` (default tetap 0.15
  supaya pemanggil lama tidak berubah); `frame_shots` memakai sekitar 0.035 + skor YuNet ≥ 0.7.
- Gabungkan deteksi antar sampel (wajah dengan pusat berdekatan dianggap satu orang, ambil median posisi dan ukuran),
  lalu buang wajah yang muncul di kurang dari separuh sampel.
- Pilih posisi kotak (ukuran kotak = `crop_size`, sama seperti AI Framing; posisi saja yang dihitung, lewat `_place_box`):
  1. Tidak ada wajah: kotak di tengah frame.
  2. Semua wajah "utama" (lebar ≥ 50% wajah terbesar) muat secara horizontal dalam kotak (dengan padding 4% lebar kotak):
     kotak berpusat di tengah kelompok itu.
  3. Tidak muat: pusat pada wajah terbesar. Kalau dua wajah terbesar ukurannya beda kurang dari 15%, pakai
     `_mouth_motion` / `_pick_active_face` yang sudah ada sebagai penentu; kalau tetap seri, ambil yang lebih dekat ke tengah.
  - Vertikal: wajah ditaruh di sepertiga atas kotak (pusat wajah ≈ 35% dari atas kotak), dijepit di dalam frame.
- Shot berurutan yang posisinya beda kurang dari 3% lebar frame digabung (titik kedua dibuang), supaya tidak ada lompatan kecil.
- Endpoint: tambahkan `"/api/shotframe": ("facebox", "frame_shots", "size", "points", None)` ke `RANGE_ENDPOINTS`
  (`server.py:113`). Tidak butuh pyannote/torch, cukup opencv dan onnx yang sudah dipakai `facetrack`.

### Editor: tombol dan mode
- Di layar Framing, di samping tombol AI Framing: tombol **"Shot framing"** dengan title "One frame per camera shot,
  on the faces in it. Fast; best for TV shows and 3:4". Gaya sama seperti tombol AI Framing.
- `shotFramingForResult(id)`: per span Result → `realRange` → `/api/shotframe` dengan `size = aiFramingOutputSize()`
  → titik dikembalikan ke timeline virtual dan ditulis ke `FRAMING` dengan **bentuk titik yang sama seperti yang ditulis
  `aiFramingApply`** (salin field-nya: `at`, `crop`/`crops`, `asset`, tanpa `auto`). Titik 00:00 tetap ada (`ensureStartPoint`).
  Status memakai kotak status AI Framing yang sudah ada: "Shot framing: N shots framed".
- Berlaku hanya untuk format Single (kotak tunggal). Untuk Split tombolnya disabled dengan title, karena split = 2 kotak.

### Dialog Render selected (bulk, `bulk.js:445-525`)
- Pilihan "Run AI Framing first for clips without framing" diganti satu baris pilihan:
  **Framing for clips without framing: [None] [Shot framing] [AI Framing (speakers)]**
  (tombol kecil berbingkai, terpilih jelas, tanpa pill).
  - Default **Shot framing** kalau semua Result yang akan dirender memakai Picture 3:4. Selain itu default **None**
    (perilaku lama, AI Framing tetap mati secara bawaan).
  - Keterangan di bawah: Shot framing = "fast, one frame per shot on the faces in it"; AI Framing =
    "follows who is speaking; slower, best for podcasts".
- `bulkShotFraming(ids)` meniru `bulkAiFraming` (urutan, status, `writeProjectNow`, kembali ke Result asal), tapi
  memanggil `shotFramingForResult`. Tidak ada setup-check torch; kalau opencv tidak ada, tampilkan pesan setup yang sama.

## Tes
- Selftest `check_shotframe` (jalankan lewat `run()`), dengan **video sintetis** buatan ffmpeg/opencv (jangan pakai video ian):
  dua "shot" (cut keras) dengan gambar wajah di posisi berbeda. Kalau YuNet butuh wajah sungguhan, pakai crop wajah dari
  fixture yang sudah ada di repo. Kalau tidak ada, uji logika pemilihan sebagai fungsi murni
  (`_choose_box(faces, W, H, crop_size)`) dengan daftar wajah buatan:
  - tanpa wajah → tengah;
  - 2 wajah berdekatan → berpusat di kelompok;
  - 2 wajah berjauhan dan beda ukuran → wajah terbesar;
  - kotak tidak pernah keluar frame;
  - shot pendek digabung, posisi hampir sama digabung.
- `_detect_faces` dengan default `min_frac` menghasilkan hal yang sama seperti sebelumnya (selftest facebox lama tetap lolos).
- Semua `tests/*.test.js` + `python -m klipian selftest` penuh lolos.
- **Uji nyata (laporkan, jangan ubah data ian):** salin 1 project Clips ian yang berisi beberapa Result ke workspace
  sementara (KLIPIAN_WORKSPACE di scratchpad; boleh hardlink/salin source video-nya ke sana, **jangan tulis apa pun ke
  `workspace/` ian**). Jalankan Shot framing pada 3 Result dengan Picture 3:4, catat waktu per Result dibanding AI Framing,
  dan kirim 3–4 screenshot preview dari shot yang berbeda (shot lebar, close-up, shot reaksi).

## Selesai jika
Tombol Shot framing di layar Framing dan pilihan framing di dialog Render selected berfungsi; Shot framing menghasilkan satu
titik per shot pada wajah-wajah di shot itu, kotak tidak pernah keluar frame, dan jauh lebih cepat daripada AI Framing;
AI Framing lama tidak berubah; tes hijau. Commit (jangan push), tanpa `remotion/` dan `docs/briefs/`. Laporkan hash,
waktu, dan screenshot.

## Catatan risiko
- Shot lebar dengan banyak orang yang tersebar tidak muat dalam 3:4, sehingga hasilnya "wajah terbesar", belum tentu pembicaranya.
- Wajah yang menoleh ke samping atau sangat kecil bisa lolos dari deteksi (hasilnya tengah).

## Lanjutan setelah uji podcast (Plan, 2026-11-02, disetujui ian)

Hasil uji akun podcast (Ferry Irwandi, 3 Result 3:4): di close-up Shot framing setara dengan AI Framing (beda <2%) dan
25–40x lebih cepat. Di shot lebar keduanya gagal. Uji framing **hanya dengan akun podcast**, jangan akun komedi.
Penyimpangan yang sudah dilaporkan (frame_shots mengembalikan list; tie-break pusat) diterima.

1. **Commit Shot framing** setelah poin 2 dan 3 selesai (satu commit per poin boleh).
2. **Shot lebar:**
   - Deteksi wajah kecil: naikkan resolusi deteksi `frame_shots` (frame sampel di-resize ke lebar ≥ 1600 px, atau
     resolusi asli kalau lebih kecil) dan `min_frac` sekitar 0.025. Ukur dampaknya ke waktu (target: tetap < 10 dtk untuk klip 70 dtk).
   - Kalau wajah utama tidak muat dalam 3:4: pilih **yang bicara**. Ambil pasangan frame berurutan (jarak ±0,2 dtk) di
     2–3 titik dalam shot, ukur `_mouth_motion` per wajah, lalu pilih wajah dengan gerakan mulut jelas terbesar
     (pakai aturan "clear winner" yang sama seperti `_pick_active_face`). Kalau tidak ada pemenang jelas, pilih wajah terbesar
     (bukan tengah). Tie-break ke tengah hanya kalau ukurannya juga setara.
   - Tes: tambahkan kasus fungsi murni (wajah tidak muat + skor mulut → pembicara; tanpa pemenang → terbesar).
3. **Bug ukuran kotak AI Framing:** di res21, AI Framing memakai lebar 31,6% (ukuran lama), bukan ukuran 3:4 yang sedang
   dipakai (sekitar 42%). Cari sebabnya di `aiFramingOutputSize()` (`framing.js:1336`, `boxOnCanvas()` dari kotak lama dengan
   rasio lain?) dan perbaiki supaya ukuran output selalu mengikuti rasio Picture yang aktif (kotak di kanvas yang rasionya beda
   → pakai `initialCrop()` atau refit ke rasio itu). Shot framing memakai fungsi yang sama, jadi otomatis ikut benar.
   Tes Node kecil kalau bisa dimuat tanpa DOM; kalau tidak, cek di preview.
4. Ulangi uji podcast yang sama (salinan, workspace sementara) untuk ketiga Result: tabel waktu, benar/salah per titik
   (khususnya shot lebar t≈741 di res19), dan screenshot hijau/merah seperti sebelumnya.
