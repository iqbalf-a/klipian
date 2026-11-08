# Brief: daftar run Autopilot ringkas (expand per item), banyak run, dan run yang berhenti di tengah

Dari sesi Plan, 2026-11-08. Laporan ian (screenshot /autopilot, profile klipian podcast):
1. Run yang sudah selesai terlalu panjang: 8 baris tahap "✓ done", catatan, usage, daftar klip. Minta **expand per item**.
2. Bagaimana kalau run-nya sudah banyak?
3. Run yang berhenti di tengah belum ditangani. Contoh: "Bener-Bener Pusat Dunia Nih.." `cancelled`, Choosing clips ✓, lalu Making
   Results dan seterusnya kosong. **Tidak ada tanda di tahap mana run berhenti.** Catatan run juga terpotong ("…to the end of the
   sentenc"), karena `note` dipotong 300 karakter (`autopilot.py:598`).

## Kenapa tanda berhenti tidak muncul
`_execute` (`autopilot.py:486`) mengecek `_CANCEL` **sebelum** `update_run(step=…)`, jadi run yang dibatalkan di antara dua tahap
menyimpan `step` = tahap terakhir yang sudah selesai. `stepRow` lalu menganggap tahap itu "done" dan tidak ada baris bertanda.

## Kerjakan

### 1. Server (`klipian/autopilot.py`)
- `update_run` mengisi `updatedAt = int(time.time())` di setiap perubahan.
- Run yang berakhir `cancelled` atau `failed` menyimpan `stoppedAt` = tahap pertama yang belum ada di `done` (untuk cancel di antara
  tahap) atau tahap yang sedang jalan (untuk cancel/fail di dalam tahap). Retry menghapus `stoppedAt`.
- `note` disimpan utuh sebagai daftar (`notes: [...]`, batas wajar mis. 20 butir × 300 karakter), bukan satu string 300 karakter.
  Run lama dengan `note` string tetap terbaca.
- `public_run` menambah `stalled: true` kalau state `running`/`queued` tetapi worker profile ini di proses ini tidak hidup
  (`_WORKERS[pid]` tidak ada atau `not is_alive()`). Itu run yang tertinggal (mis. server mati di tengah, atau error di luar run).
- Retry juga boleh untuk run `stalled`: set `queued`, hapus `stoppedAt`, lalu `kick`. Tahap yang sudah `done` tidak diulang (sudah
  begitu).

### 2. Kartu run (`ui/js/autopilot-page.js`, `ui/css/autopilot.css`)
- **Ringkas secara default** untuk run `done`, `cancelled`, `failed`: satu baris berisi judul, chip state, ringkasan pendek, dan tombol
  aksi (Open project, Retry), misalnya:
  - done: "4 clips · scheduled 9 Nov 11:00–18:00";
  - cancelled: "Stopped at Making Results";
  - failed: "Failed at Render: <error singkat>".
  Klik judul atau tombol kecil **Details** (tombol berbingkai, `aria-expanded`) membuka daftar tahap, catatan lengkap, usage, dan
  daftar klip. Yang sedang dibuka diingat selama halaman terbuka saja (`Set` id di memori, ikut bertahan saat `drawRuns` menggambar
  ulang tiap polling).
- Run `running`, `queued`, `waiting`, dan yang `stalled` **selalu terbuka**.
- **Tanda berhenti:** di daftar tahap, baris `stoppedAt` bertulis "stopped here" (cancelled, warna peringatan) atau "failed" (merah).
  Tahap sesudahnya abu-abu "not run". Chip `cancelled` diberi warna peringatan (bukan abu-abu polos) supaya terlihat beda dari done.
- **Run yang macet:**
  - `stalled`: tanda "Stopped: klipian is not working on this run", tombol **Resume** (memanggil Retry) dan Cancel;
  - `running` yang `updatedAt`-nya lebih dari 10 menit lalu (tahap tanpa laporan, mis. Gemini): catatan "No progress for 12 min" di
    baris tahapnya, tetap ada Cancel. Tidak otomatis dibatalkan.

### 3. Run yang banyak
- Urutan: yang aktif (running, queued, waiting, stalled) selalu di atas, lalu sisanya dari yang terbaru.
- Filter kecil di atas daftar (tombol berbingkai seperti /workspace, bukan pill): **All · Active · Done · Stopped** (Stopped =
  cancelled + failed + stalled), dengan jumlah tiap filter.
- Halaman: pakai `createPager` yang sudah ada (`ui/js/shared/pager.js`) dengan 10 run per halaman; yang aktif tidak pernah tersembunyi
  di halaman lain (aktif selalu tampil di halaman 1 di atas).
- Tombol **Clear finished** (dengan `confirmDialog`) menghapus run `done` dan `cancelled` dari `runs.json` saja, bukan proyek, render,
  atau jadwalnya. Run yang gagal tidak ikut dihapus.

## Tes
- Selftest: `stoppedAt` untuk cancel di antara tahap dan di dalam tahap, fail di dalam tahap; Retry menghapusnya; `updatedAt` terisi;
  `stalled` saat worker tidak hidup; Clear finished hanya membuang done/cancelled; `note` string lama tetap terbaca.
- Preview `/autopilot` di **salinan akun podcast** (jangan workspace ian, jangan server kedua di workspace ian). `runs.json` salinan
  diisi ±25 run campuran: done, cancelled di antara tahap (seperti "Bener-Bener"), failed di Render, running dengan `updatedAt` 15
  menit lalu, stalled, waiting. Cek: default ringkas, Details membuka dan tetap terbuka setelah polling, tanda berhenti benar, filter
  dan halaman, Clear finished. Light dan dark, lebar 1400 dan 375. Screenshot untuk laporan.
- `tests/*.test.js` + selftest (motionbrief masih merah, masalah lama).

## Selesai jika
Run selesai tampil satu baris dan bisa dibuka, run yang berhenti jelas tandanya dan bisa dilanjutkan, daftar panjang tetap rapi
(filter + halaman + clear). Commit brief ini bersamanya. Jangan push, laporkan ke Plan.
