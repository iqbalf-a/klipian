# Adopsi logika smart-crop ke AI Framing klipian

**Status: SELESAI dan terverifikasi end-to-end** (lanjutan sesi lain, lihat
"Verifikasi" di bawah). Dokumen ini awalnya ditulis sebagai handoff untuk
melanjutkan di sesi lain; bagian rencana asli dipertahankan sebagai riwayat
keputusan, bagian "SISA PEKERJAAN" sekarang berisi apa yang benar-benar
dieksekusi.

## Sumber ide
Referensi: `D:\github-repos\github-autoclipper\oentoro-autoclipper\scripts\smart_crop.py`.
Yang diambil: pemilihan wajah lewat **skor gerak mulut** (siapa yang bicara),
deteksi profil + NMS, dan logika **lock/switch** untuk memutuskan kapan
berpindah target. Yang TIDAK diambil: pan kamera kontinu & render pipe libx264
(membuang jalur kualitas Arc `h264_qsv` klipian).

## Tujuan
1. **Framing mendarat di orang yang benar-benar bicara**, bukan wajah terbesar
   di sekitar kotak kasar (masalah saat dua orang duduk berdekatan).
2. **Giliran panjang otomatis dipecah jadi beberapa Span** saat subjek bergeser
   di kursi — mengisi roadmap README "crop mengikuti orang tertentu".

## Keputusan desain (sudah dikonfirmasi user)
- **Hard-cut, BUKAN pan kontinu.** Logika lock/switch dipakai untuk MEMUTUSKAN
  kapan memecah `Span` baru. **`klipian/render.py` TIDAK diubah** — model `Span`
  statis (satu `CropBox` per potongan) sudah mendukung banyak potongan; kita
  hanya menghasilkan lebih banyak titik.
- **OpenCV saja, TANPA dependency baru.** `cv2`+`numpy` sudah ada. Tanpa
  MediaPipe/YuNet/InsightFace/pyannote-baru/PyTorch. Menjaga janji README
  "ringan ~300 MB".
- **pyannote (`diarize.py`) tetap** sumber "siapa & kapan". Mengganti diarize
  dengan gerak-mulut CV (agar lepas dari HF_TOKEN) = pekerjaan terpisah, di
  luar lingkup.

---

## SUDAH SELESAI — `klipian/facebox.py` (ditulis ulang penuh)

Terverifikasi end-to-end (lihat "Verifikasi" di bawah).

**Fase 1 — facefit sadar-pembicara (transparan ke UI, endpoint `/api/facefit`
lama otomatis lebih pintar):**
- `_load_profile_detector()` — cascade `haarcascade_profileface.xml` (dipakai
  dua arah lewat `cv2.flip`). Menangkap kepala yang menoleh.
- `_nms()` — buang deteksi kembar frontal/profil (port dari smart_crop).
- `_detect_faces(gray_region, rw)` — frontal+profil+NMS → daftar
  `{cx, bbox, mouth}` koord region, disaring ukuran `>= rw*0.15` (sama seperti
  versi lama).
- `_mouth_motion()` + `_sharpness()` + `_pick_active_face()` — pilih wajah yang
  MULUTNYA bergerak; ambigu → wajah terdekat `locked_cx`; belum ada lock →
  paling tajam. Port dari smart_crop, tapi mengembalikan WAJAH (butuh bbox),
  bukan cx saja.
- `_extract_frames()` — ambil ~4 frame ±0.2 dtk sekeliling `at` dalam SATU
  panggilan ffmpeg (filter `fps`), perlu ≥2 frame untuk diff gerak mulut.
- `fit_crop_to_face()` — dirombak: ekstrak beberapa frame → deteksi di frame
  acuan (terdekat ke `at`) → `_pick_active_face` → posisikan kotak (ukuran =
  kotak kasar, cuma posisi digeser). Signature TETAP `(video, at, rough) ->
  dict|None`, jadi server & client tidak berubah.

**Fase 2 — helper pelacakan (sekarang tersambung penuh ke server & UI, lihat di bawah):**
- `track_crops(video, start, end, rough, fps=3, min_chunk=1.2,
  deadzone_frac=0.12) -> list[{at, crop}]` — sampel ~3 fps, lacak wajah aktif
  dengan lock bergulir, lalu `_segments_from_centers()` mengeluarkan titik baru
  saat pusat bergeser > deadzone DAN bertahan >= min_chunk. Selalu ada minimal
  satu titik; tanpa wajah → satu titik memakai kotak kasar.

---

## SISA PEKERJAAN — sudah dieksekusi

### 1. Endpoint `/api/facetrack` di `klipian/server.py`
Ditambahkan persis seperti rencana, tepat setelah handler `/api/facefit`
(sekitar baris 966). Sinkron, bukan job async — belum terasa perlu diubah,
lihat catatan kecepatan di "Verifikasi".

### 2. Wiring klien `ui/framing.js`
`aiFramingLacakWajah(start, end, kasar)` ditambahkan, `aiFramingCariWajah`
(facefit titik tunggal) DIHAPUS karena sudah tidak dipanggil dari mana pun
lagi (endpoint `/api/facefit` sendiri tetap ada di server, dipertahankan
untuk kemungkinan pemakaian lain). `aiFramingTerapkan()` sekarang: tiap
rencana bawa `{at, end, kasar}`, panggil `aiFramingLacakWajah` paralel lewat
`Promise.all`, lalu SEMUA titik hasil (bisa >1 per giliran) di-flatten dan
di-push ke `FRAMING` dengan dedup `Math.abs(f.at - at) < 0.35` yang sama
seperti sebelumnya.

### 3. Verifikasi — sudah dilakukan
1. **Sintaks**: `facebox.py`, `server.py` lolos `py_compile`; `framing.js`
   lolos `node --check`.
2. **Unit langsung** (`fit_crop_to_face`/`track_crops` tanpa server) di
   `samples/radityadika-podcast.mp4` (podcast 2 orang) rentang 168–203 dtk:
   `track_crops` mengeluarkan 8 titik, bergantian antara dua klaster posisi
   X (≈ 3–20% dan ≈ 47–51% dari lebar frame) — konsisten dengan dua orang
   duduk berdekatan.
3. **Endpoint HTTP langsung** (`curl POST /api/facetrack`) — dikonfirmasi
   mengembalikan bentuk `{"points": [...]}` yang benar.
4. **End-to-end lewat browser sungguhan**: `aiFramingDiarizeSatuSpan` dulu
   dijalankan sungguhan (bukan data buatan) di klip nyata "Aura Istri Selalu
   Tahu" (169.32–202.98 dtk) — diarization mengembalikan **1 giliran**
   (`SPEAKER_00` sepanjang klip). `aiFramingTerapkan(turns, posisi)` lalu
   dipanggil langsung (melewati UI drag-konfirmasi kotak per pembicara,
   yang tidak diubah dan tidak diuji ulang di sini) dengan kotak kasar milik
   project sungguhan. Hasil: **8 titik masuk ke `FRAMING`**, terurut,
   `top`/`width`/`height` identik dengan kotak kasar (cuma `left` yang
   berubah, sesuai desain "posisi saja, bukan zoom").

### Catatan dari verifikasi — BUKAN bug, tapi perlu diperhatikan
Diarization menandai **satu** giliran (`SPEAKER_00`) untuk seluruh 34 detik
klip itu, tapi `track_crops` tetap mengeluarkan **8 titik** di dalam satu
giliran itu. Ini konsisten dengan desain: `track_crops` tidak tahu-menahu
soal label pembicara pyannote, ia murni mengikuti wajah yang MULUTNYA
bergerak secara visual di dalam rentang yang diberikan. Kalau orang KEDUA di
frame kebetulan ikut bergerak mulutnya (bereaksi, ketawa, dsb.) sementara
pyannote tetap mengaitkan audio ke satu speaker, kotaknya bisa ikut
berpindah ke orang kedua itu. Belum diuji: apakah frekuensi 8 titik/34 detik
ini wajar (percakapan memang bolak-balik cepat) atau `min_chunk`/
`deadzone_frac` perlu dilonggarkan. Butuh pengecekan visual (render MP4
sungguhan, tonton sambungannya) untuk memastikan.

### Belum diuji sama sekali (jujur, bukan diklaim selesai)
- Alur UI penuh: klik tombol AI Framing → drag kotak per pembicara →
  konfirmasi lewat mouse sungguhan (verifikasi di atas melewati langkah ini
  dengan memanggil `aiFramingTerapkan` langsung dari console).
- Render MP4 sungguhan dari hasil banyak-titik ini, dan tonton sambungan
  antar potongannya mulus atau tidak.
- Klip 1-orang statis (regresi: pastikan tidak pecah berlebihan).
- Klip tanpa wajah sama sekali (fallback ke kotak kasar).
- Klip dengan wajah profil (menoleh) — cabang `_load_profile_detector()`
  belum pernah tersentuh deteksi nyata di pengujian ini.

Uji unit cepat tanpa UI (masih berlaku persis seperti semula):
```bash
.venv\Scripts\python.exe -c "from pathlib import Path; from klipian.facebox import fit_crop_to_face, track_crops; v=Path('samples/NAMA.mp4'); print(fit_crop_to_face(v, 12.0, {'left':37,'top':4,'width':26,'height':92})); print(track_crops(v, 10.0, 25.0, {'left':37,'top':4,'width':26,'height':92}))"
```

---

## Titik integrasi kunci (referensi cepat)
- `klipian/facebox.py` — dirombak (Fase 1) + `track_crops` (Fase 2). Selesai.
- `klipian/server.py` — `/api/facefit` (lama, dipertahankan) diikuti
  `/api/facetrack` (baru).
- `ui/framing.js` — `aiFramingLacakWajah` (baru) dipanggil dari
  `aiFramingTerapkan`, hasilnya di-flatten lalu di-push ke `FRAMING` dengan
  dedup by-`at`. `aiFramingCariWajah` (lama) sudah dihapus, tidak dipakai lagi.
- `klipian/diarize.py` `diarize_segment` — turn punya `{start,end,speaker}`.
- `klipian/render.py` `Span`/`CropBox` — TIDAK diubah; sudah dukung banyak
  potongan.

## Di luar lingkup (catatan masa depan)
- Pan sinematik kontinu (crop dinamis ffmpeg) — ditolak demi estetika hard-cut.
- "Objek bernama": UI klik-pilih wajah yang dilacak — dibangun di atas lock
  `track_crops`.
- Gerak-mulut CV sebagai pengganti pyannote (lepas dari HF_TOKEN) — refaktor
  terpisah.
- Fitur lain dari referensi yang layak dipertimbangkan (dari analisis awal):
  BGM sidechain ducking (`opensource-clipping/.../audio_bgm.py`, ~67 baris),
  deteksi audio-only untuk mode gameplay (`Auto-clipper/.../audio_detector.py`),
  voice-trigger "clip it", split-screen podcast.
```
