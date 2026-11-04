# Brief: satu tombol AI Framing yang tepat sasaran + server tidak mati lagi

Dari sesi Plan, 2026-11-02. Kata ian: dua fitur (AI Framing dan Shot framing) membingungkan. Cukup **satu tombol AI Framing**,
yang dioptimasi supaya **orang yang di-frame benar**. Saat ian mencoba AI Framing, server mati sendiri.
Uji **hanya dengan akun podcast** (salinan di workspace sementara), jangan akun komedi, dan jangan tulis apa pun ke `workspace/` ian.

## A. Server mati (kerjakan dulu, commit sendiri)

Log ian: `POST /api/speakerlocate` dua kali berurutan cepat, lalu proses berhenti tanpa traceback Python.
Dugaan Plan (verifikasi dulu): `facebox._load_face_detector()` (`facebox.py:76`) mengembalikan SATU `cv2.FaceDetectorYN`
global, dan `_detect_faces` memanggil `setInputSize()` + `detect()` di objek itu tanpa kunci. AI Framing memanggil
`/api/speakerlocate` secara paralel (`framing.js` `aiFramingFindAllPositions`, `Promise.all`), dan ThreadingHTTPServer
menjalankan tiap request di thread sendiri. Akibatnya dua thread memakai detektor yang sama → race di kode native → crash.
`_face_recognizer` (SFace) punya masalah yang sama.

- Reproduksi dulu: skrip di scratchpad yang menembak 2–4 `/api/speakerlocate` (atau langsung `_detect_faces` dari beberapa
  thread) secara bersamaan pada video podcast salinan. Catat apakah proses crash.
- Perbaikan: satu `threading.Lock` per model di `facebox.py`, membungkus `setInputSize` + `detect` (dan pemakaian recognizer).
  Jangan membuat detektor per thread kecuali lock terbukti terlalu lambat.
- Tambahkan `faulthandler.enable()` di awal `serve` (stderr), supaya crash native berikutnya meninggalkan jejak di log, bukan
  berhenti diam-diam.
- Ulangi reproduksi: tidak crash. Kalau sebelum perbaikan TIDAK bisa direproduksi, laporkan dan cari penyebab lain
  (memori: pyannote/torch dimuat bersamaan dengan request lain; lihat Task Manager/`psutil` saat AI Framing).

## B. Satu tombol AI Framing

### Yang dihapus (dari 7ddf8e4)
- Tombol **Shot framing** di layar Framing dan `shotFramingForResult`.
- Pilihan None / Shot framing / AI Framing di dialog Render selected. Kembali ke **satu centang** "Run AI Framing for clips
  without framing". Defaultnya **menyala kalau semua Result yang dirender 3:4**, selain itu mati seperti dulu.
- `/api/shotframe` dihapus dari `RANGE_ENDPOINTS`, tapi logika di `facebox.py` (`_shot_bounds`, `_merge_faces`, `_choose_box`,
  `_fits`, deteksi wajah kecil, pemilihan lewat gerakan mulut) **dipakai ulang** di bawah.

### Alur AI Framing yang baru (tujuan utama: orang yang di-frame BENAR)
Tetap memakai diarisasi (tahu kapan pembicara berganti) + scenecut (tahu kapan kamera berganti), seperti sekarang.
Yang berubah adalah cara menentukan **di mana** kotak diletakkan:

1. Client: diarize + scenecut per span seperti sekarang. Lalu **satu** request per span ke endpoint baru
   `POST /api/aiframe {video, start, end, size, turns:[{start,end,speaker}], cuts:[…]}`, **berurutan, bukan paralel**.
   `aiFramingFindAllPositions` (yang paralel) dan pemanggilan `speakerlocate`/`facetrack` per segmen dari jalur AI Framing diganti.
2. Server `facebox.frame_segments(...)` → `[{at, crop}]`:
   - Segmen = gabungan batas giliran bicara dan cut (aturan `aiFramingApply` yang sekarang, dipindah ke server).
     Segmen di bawah 0,6 dtk digabung ke sebelumnya.
   - Per segmen: deteksi semua wajah di seluruh frame (resolusi ≥1600 px, `min_frac` 0,025, gabungkan antar sampel, seperti `frame_shots`).
   - Wajah utama muat dalam kotak → kotak di kelompok itu.
   - Tidak muat → **pembicara segmen ini**:
     a. Wajah dengan gerakan mulut jelas terbesar dalam segmen itu (pasangan frame berurutan, aturan "clear winner" yang sudah ada).
     b. Kalau tidak jelas: **identitas pembicara** yang diingat. Setiap kali (a) berhasil untuk speaker X, simpan embedding SFace
        wajah itu (`_face_embedding`) sebagai wajah X. Di segmen berikutnya milik X, pilih wajah dengan embedding paling mirip
        (ambang kemiripan wajar; cosine SFace ≥ 0,36 adalah ambang "orang yang sama" menurut OpenCV).
     c. Masih tidak jelas → wajah terbesar.
   - Tanpa wajah → titik sebelumnya dipertahankan (bukan tengah). Hanya segmen pertama yang jatuh ke tengah.
   - **Validasi akhir per titik:** kotak harus berisi minimal satu wajah utuh yang terdeteksi di segmen itu. Kalau tidak ada
     (karena dijepit di tepi frame dan sebagainya), geser seperlunya. Tidak boleh ada titik yang menyorot kursi kosong.
   - Titik berurutan yang posisinya beda <3% lebar digabung.
   - Kembalikan juga `why` per titik (`group` | `speaker-mouth` | `speaker-face` | `largest` | `kept` | `center`) untuk laporan
     dan untuk status di UI ("8 points: 5 on the speaker, 2 groups, 1 kept").
3. Client menulis titik dengan bentuk yang sama seperti `aiFramingApply`. Status dan overlay progres tetap (tahap locate/apply
   boleh digabung jadi "Framing each shot…").
4. Diarisasi gagal atau tidak ada ucapan → jalankan `frame_segments` dengan `turns=[]` (murni per shot) daripada gagal total.
5. Head tracking (`track_head`) dan Split tidak berubah.

## Tes
- Selftest: kasus fungsi murni untuk pemilihan per segmen (muat → kelompok; tidak muat + mulut jelas → pembicara;
  tidak jelas + embedding cocok → pembicara yang diingat; tanpa embedding → terbesar; tanpa wajah → titik sebelumnya;
  validasi kursi kosong). Tes thread-safety: N thread memanggil `_detect_faces` bersamaan tanpa crash (jalankan di proses anak
  supaya crash tidak membunuh selftest).
- Semua `tests/*.test.js` + `python -m klipian selftest` penuh lolos. Baseline render tidak berubah.
- **Uji nyata akun podcast** (salinan): project Ferry Irwandi yang sama (res19/20/21, 3:4) **ditambah** klip "Jeda Nulis – GJLS"
  yang dipakai ian saat server mati. Per Result laporkan waktu, jumlah titik, `why` per titik, dan benar/salah (orang yang benar
  di dalam kotak), plus screenshot hijau (baru) dan merah (AI Framing lama dari commit sebelum perubahan ini) seperti sebelumnya.
  Server tidak boleh mati selama seluruh uji, termasuk bulk Render selected untuk 3 Result.

## Selesai jika
Server tidak lagi crash karena request paralel (direproduksi lalu terbukti hilang); hanya ada satu tombol AI Framing dan satu
centang di Render selected; AI Framing memilih orang yang benar di close-up, kelompok, dan shot lebar di klip podcast uji;
tes hijau. Commit A dan B terpisah, jangan push. Laporkan hash, tabel uji, dan screenshot.
