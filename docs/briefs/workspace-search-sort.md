# Brief: search + sort per kolom di /workspace dan /sources

Dari sesi Plan, 2026-11-08. Permintaan ian: tambahkan **search** di /workspace dan /sources,
dan header tabel bisa diklik untuk **order by** kolom itu.

Tabel yang kena: **Clips** dan **Rendered output** (/workspace), **Sources** (/sources).
Assets tidak (biasanya kosong, isinya beberapa file saja).

## Yang sudah ada (pakai ulang, jangan tulis ulang)

- `ui/js/shared/pager.js`: `createPager` (slice/first/last) dan `createSort(key)`, yang sekarang
  **hanya** mengurutkan berdasarkan Created (`apply(rows, time)`, `toggle()`, `headHTML(label)`,
  tombol `data-sort-created`, disimpan di `localStorage klipian.sort.<key>` = `"asc"|"desc"`).
  Dipakai di 2 tempat saja: `ui/js/workspace/clips.js:26,178,193,240,406` dan
  `ui/js/workspace/render.js:11,47,49,62`.
- CSS `.sort-head` / `.sort-arrow` di `ui/css/pager.css:47-61`. Input pakai class `ws-input`.
- Pola export untuk tes node: `ui/js/workspace/schedgap.js` (baris terakhir) + `tests/schedgap.test.js`.

## Kerjakan

### 1. `createSort` jadi per kolom (ganti di tempat, bukan helper baru)
- `createSort(key, defaultCol = "created")`. State: `{col, dir}`. Disimpan sebagai `"<col>:<dir>"`;
  nilai lama `"asc"`/`"desc"` dibaca sebagai kolom `created` (jangan sampai pilihan ian hilang).
- `apply(rows, getters)`: `getters` = `{ col: (row) => value }`. Angka dibandingkan sebagai angka,
  teks dengan `localeCompare(b, undefined, { numeric: true, sensitivity: "base" })`. Nilai kosong
  (`""`, `null`, `undefined`) **selalu di bawah**, apa pun arahnya. Seri tetap urutan aslinya.
- `toggle(col)`: kolom yang sama → balik arah; kolom baru → `desc` untuk waktu/ukuran/panjang,
  `asc` untuk teks (getter boleh ditandai, mis. daftar `numericCols`, atau cukup: kolom baru selalu
  mulai `asc` kecuali `created`/`at`/`size`/`length` — pilih yang paling sederhana, tulis di komentar).
- `headHTML(col, label)`: tombol `class="sort-head" data-sort="<col>"`; panah hanya di kolom aktif;
  `aria-label="Sort by <label>, …"`. Di `<th>` tabel Clips set `aria-sort="ascending|descending"` pada
  kolom aktif.
- Satu handler klik per tabel lewat `e.target.closest("[data-sort]")` → `toggle` → `pager.first()` →
  gambar ulang. Hapus `data-sort-created`.

### 2. Search
- Satu `<input type="search" class="ws-input">` di baris judul tiap panel (Clips, Rendered output,
  Sources), lebar kecil (~200px), placeholder "Search…", `aria-label` jelas. Esc mengosongkan.
- Fungsi bersama di `pager.js`: `matchesQuery(row, fields, q)` — case-insensitive, substring, semua
  kata di `q` harus ketemu (dipisah spasi) di gabungan field. Kosong = semua lolos.
- Urutan: **filter → sort → pager.slice**. Tiap ketikan: `pager.first()` lalu gambar ulang.
  Tidak disimpan di localStorage (pencarian per kunjungan saja).
- Saat ada query: catatan jumlah di panel jadi mis. "3 of 19 match"; kalau 0, baris kosong
  "No clip matches “x”" dengan tombol kecil **Clear search**.
- Field yang dicari:
  - Clips: title, status, platform, episode, file, description, tiktokCaption, notes, date.
  - Rendered output: file, video.
  - Sources: name, nama di used_by, credit (platform, creator, title).

### 3. Kolom yang bisa di-sort
- **Clips**: Status, Title / hook, Platform, Upload date (`date + " " + time`, kosong di bawah),
  Created (default, desc). Time tidak (sudah ikut Upload date). Ubah `<th>` di
  `ui/workspace.html:130-139` agar isinya diisi dari JS seperti `#clipCreatedHead` sekarang
  (atau beri id per th) — jangan buat dua sumber label.
- **Rendered output**: File, Size (`mb`), Created (default, desc).
- **Sources**: Video (`name`), Size (`bytes`), Length (`duration`), Added (`at`, default desc),
  Transcript (`transcribed`), Used by (jumlah `used_by`), Credit (teks `who`). Baris deleted ikut
  diurutkan biasa.

## Jebakan

- **Sources pakai index ke `SOURCE_ROWS`** (`data-select`, `data-credit`, `data-delete`, `data-again`,
  `data-credit-form`) yang dihitung dari `first + k` (`sources.js:73,82`). Setelah filter/sort itu
  salah. Ganti jadi `SOURCE_ROWS.indexOf(s)` (seperti render.js). Tes: sort lalu klik Delete/credit di
  halaman 2 → video yang benar.
- **Clips bisa diedit di tabel.** Jangan gambar ulang/urut ulang setelah `saveClip` (sekarang memang
  tidak). Kalau baris pindah posisi setelah ian mengetik, itu bug.
- **Baris draft "+ New clip"** selalu di atas, tidak ikut filter/sort.
- Setelah draft disimpan (`clips.js:406`): logika `desc → first / asc → last` hanya benar untuk kolom
  Created. Ganti dengan: kosongkan search jika baris baru tidak cocok, lalu buka halaman yang memuat
  baris baru (tambah `goTo(index)` di pager: `page = Math.floor(index / size)`).
- Filter "N with deleted files" (`showGoneOnly`) digabung dengan search (AND).
- "Select all on this page" (Clips dan Sources) tetap bekerja pada baris yang tampil saja.
- Gaya: input berbingkai kecil seperti tombol /workspace, bukan pill (lihat memory klipian UI style).

## Tes (wajib)
- `pager.js` diberi export node (pola schedgap.js). `tests/sort.test.js` baru:
  teks vs angka (`"clip 2"` < `"clip 10"`), kosong selalu di bawah di asc dan desc, seri stabil,
  `toggle` kolom sama/baru, nilai lama `"desc"` di localStorage → `created:desc`,
  `matchesQuery` (beberapa kata, huruf besar/kecil, field kosong). `node tests/sort.test.js` hijau.
- `python -m klipian selftest` tetap hijau.
- Preview /workspace dan /sources: cari, sort tiap kolom, ganti halaman, light + dark + lebar ponsel
  (input search turun ke baris sendiri di ponsel, tidak ada scroll horizontal halaman).

## Selesai jika
Ketiga tabel bisa dicari dan diurutkan per kolom; pilihan sort diingat per tabel; aksi baris
(Delete, credit, Download again, Detail, ceklis) tetap kena baris yang benar setelah sort/filter;
tes hijau. Commit brief ini bersama perubahannya. Jangan push, laporkan ke Plan.
