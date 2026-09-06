# workspace/

Semua berkas kerja klipian — bukan bagian dari kode, dan sengaja di-gitignore
(lihat `.gitignore`). Dulu tersebar sebagai `samples/`, `out/`, `cache/`,
`projects/`, `sources/`, dan `content/` masing-masing di root repo, digabung
jadi satu folder ini supaya jelas semua file untuk kerja ada di satu tempat.

- `samples/` — **taruh video sumbermu di sini.** Browser tidak memberi jalur
  lengkap ke server, jadi backend mencarinya berdasarkan nama berkas di
  folder ini (lihat `_find_video()` di `klipian/server.py`). Drag-drop di
  browser cuma buat preview lokal, bukan menyalin isi filenya ke server —
  copy dulu berkas fisiknya ke sini sebelum transkripsi/render bisa jalan.
- `out/` — hasil render, satu subfolder per video. Sumber datanya sama
  dengan layar History di editor dan panel Hasil render di `/workspace`.
- `cache/` — transkrip & analisis energi audio, dibuat otomatis, aman dihapus
  (akan dibuat ulang saat dibutuhkan lagi).
- `projects/` — state per video: Result yang disimpan, titik framing, koreksi
  teks caption. Satu berkas JSON per video.
- `assets/` — watermark/font/template custom di luar bawaan klipian,
  ditampilkan apa adanya di panel Assets pada `/workspace`.
- `schedule/clips.json` — tracker jadwal upload, 1 objek = 1 klip: status
  (Draft/Ready/Scheduled/Posted/Discarded), judul/hook, platform, tanggal &
  jam, sumber episode, file klip, deskripsi + hashtag YouTube, caption
  TikTok, link YouTube/TikTok, catatan. Diedit lewat dashboard `/workspace`
  (panel Klip), bukan dibuka manual — lihat bagian Workspace di README utama.
- `schedule/content-calendar.xlsx` — tracker lama sebelum `/workspace` ada,
  dibiarkan sebagai arsip. Tidak dibaca lagi oleh klipian.
