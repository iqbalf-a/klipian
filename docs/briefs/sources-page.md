# Brief: halaman /sources (hapus source, tandai, download again)

Dari sesi Plan, 2026-11-02. Permintaan ian: satu menu berisi semua video source
per profile; source bisa dihapus dari UI, data project tetap ada tapi diberi
tanda bahwa source-nya sudah dihapus; tiap source yang terhapus punya tombol
**Download again**. ian memilih halaman baru `/sources`, bukan panel di /workspace.

## Yang sudah ada (pakai ulang, jangan tulis ulang)

- Panel Sources di /workspace: `ui/workspace.html:326-339` + `ui/js/workspace/sources.js`
  (tabel, pager, form credit, + From YouTube, Open folder).
- `GET /api/workspace/sources` → `_get_workspace_sources` (`klipian/server.py:1103`),
  sudah menghitung `used_by` dari semua project.
- `recycle.to_recycle_bin(path)`: hapus ke Recycle Bin (bisa di-restore).
- `confirmDialog(...)` di `ui/js/shared/armed.js` untuk konfirmasi hapus.
- `ytdl.start(url, quality)` / `_run` / `GET /api/ytdl/state` + polling di `ui/js/shared/ytdl.js`.
- Editor sudah menandai aset yang hilang: `ui/js/editor/assets.js:415-428` ("not in sources/").

## Jebakan yang harus ditangani

`credits.load()` hanya mengembalikan credit untuk file yang masih ada, dan
`credits.save()` **membuang** credit file yang sudah tidak ada. Jadi setelah
file dihapus, link YouTube-nya hilang pada `save` berikutnya. Itu sebabnya
link harus disimpan di tempat lain **sebelum** file dihapus.

## Kerjakan

### 1. Halaman `/sources` (pindahkan, bukan salin)
- `ui/sources.html` baru: kepala halaman dan topbar sama seperti `ui/workspace.html`, isinya
  section Sources dipindah dari workspace.html. `ui/js/workspace/sources.js` dipakai di
  halaman baru ini (boleh tetap di folder itu atau dipindah ke `ui/js/sources-page.js`).
  Hapus section dan `<script>` Sources dari workspace.html, juga baris "Sources" di
  shortcut-panel workspace.
- Route di `server.py` dekat baris 1384: `/sources` → `/ui/sources.html`.
- Tambah link nav `Sources` di setiap nav: `ui/index.html:48`, `ui/workspace.html:36`,
  `ui/remotion.html:24`, `ui/guide.html:417`. Urutannya Edit, Workspace, Sources, Motion.
- Gaya: tombol kecil berbingkai seperti /workspace, bukan pill.

### 2. Hapus source
- `POST /api/workspace/sources/delete {file}`:
  - Tolak (400) jika `file` bukan nama polos (`Path(file).name != file`), bukan `VIDEO_EXT`,
    atau tidak ada di `SOURCES`.
  - Jika ada credit, tulis dulu ke `SOURCES/deleted.json` (`{name: {...credit, "deleted": "YYYY-MM-DD"}}`,
    pakai temp file + rename seperti `credits.save`). Kalau tidak ada credit, tetap catat
    `{"deleted": ...}`. Baru setelah itu `to_recycle_bin(file)`.
  - Project tidak diubah sama sekali.
- UI: tombol `Delete` per baris → `confirmDialog` (tone `strong` jika `used_by` tidak kosong,
  pesan menyebut nama project yang memakainya dan bahwa file masuk Recycle Bin, edit project tetap aman).

### 3. Tandai yang sudah dihapus
- `_get_workspace_sources` menambah baris untuk setiap nama di `deleted.json`,
  ditambah setiap video yang dipakai project tapi tidak ada di folder:
  `{"name", "deleted": true, "deleted_at", "credit", "used_by", "can_redownload": bool(credit.videoId)}`,
  dengan bytes/duration `null`. Baris yang file-nya ada lagi tidak ikut dihitung.
- UI: baris terhapus diberi tanda jelas (label `deleted`, teks redup), ukuran/durasi "—",
  tanpa tombol Delete/credit. Jumlah di `#sourceNote` hanya menghitung yang masih ada.
- Editor `assets.js:425`: ubah "not in sources/" menjadi "deleted · <a href=/sources>download again</a>"
  (cukup teks + link; tombol Open tetap disabled).

### 4. Download again
- `ytdl.start(url, quality, name=None)` + `_run(..., name=None)`: jika `name` diberikan, simpan
  tepat ke nama itu (lewati `free_name`), agar project yang merujuk nama lama langsung cocok.
  Validasi di `start`: `name` ada di `deleted.json` dengan `videoId == video_id(url)` dan file belum ada;
  selain itu `YtError("other", ...)`. Jalur `_from_other` (salinan dari profile lain) juga memakai `name` ini.
- Setelah berhasil: `_put_credit(name, credit dari deleted.json tanpa "deleted")`, lalu hapus `name` dari
  `deleted.json`.
- `_post_ytdl` (`server.py:753`) meneruskan `name` dari body `/api/ytdl/start`.
- UI: tombol `Download again` hanya muncul jika `can_redownload`; progress pakai polling `ytdl.js` yang
  sudah ada; selesai → `loadSources()`. Jika tidak bisa (upload manual, tanpa link): teks
  "no link — add the file again with this name".

## Tes (wajib, tanpa menyentuh workspace/ ian)
- Tambah kasus di `check_ytdl` (`klipian/selftest.py:2199`, sudah ada `_net` palsu dan recycle palsu)
  atau check baru di dalam `run()`: download → delete → baris `deleted: true` + `can_redownload` →
  credit yang di-save untuk video lain tidak menghapus entri deleted.json → download again dengan `name`
  → file kembali dengan nama sama, credit kembali, entri deleted.json hilang. Juga: delete dengan
  `../x.mp4` ditolak.
- `python -m klipian selftest` lolos. Lihat /sources di preview (light + lebar ponsel).

## Selesai jika
/sources tampil di nav semua halaman; Delete memindahkan file ke Recycle Bin dan barisnya tetap ada
bertanda deleted beserta project yang memakainya; Download again mengembalikan file dengan nama yang
sama dan project bisa membuka video itu lagi; selftest hijau. Jangan push, laporkan ke Plan.

## Catatan risiko
- Hasil download ulang belum tentu byte-identik, jadi transkrip lama dipakai lewat fallback
  "newest transcript of this name" di `cache.find_transcript`. Timestamp span tetap sama.
- Tidak ada cek "sedang dirender" saat Delete. Render yang sedang jalan pada file itu bisa gagal.
