# content/

Folder operasional buat jalanin channel klip — bukan bagian dari kode klipian, dan sengaja di-gitignore (lihat `.gitignore`).

- `schedule/clips.json` — tracker aktif, 1 objek = 1 klip: status (Draft/Ready/Scheduled/Posted/Discarded), judul/hook, platform, tanggal & jam, sumber episode, file klip, deskripsi + hashtag YouTube, caption TikTok, link YouTube/TikTok, catatan. Diedit lewat dashboard `/workspace` (panel Klip), bukan dibuka manual — lihat bagian Workspace di README utama.
- `schedule/content-calendar.xlsx` — tracker lama sebelum `/workspace` ada, dibiarkan sebagai arsip. Tidak dibaca lagi oleh klipian.
- `assets/` — watermark/font/template custom di luar bawaan klipian, ditampilkan apa adanya di panel Assets pada `/workspace`.

File video asli tetap di `sources/` (mentah) dan `out/<nama-project>/` (hasil render klipian) — folder ini cuma nge-track jadwal, status, dan aset tambahan, bukan mindahin file.
