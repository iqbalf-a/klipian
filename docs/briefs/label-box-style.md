# Brief: gaya label teks berkotak (intro & notes): radius, padding, tidak keluar layar, pilihan hitam/putih

Dari sesi Plan, 2026-11-02. Kerjakan SETELAH `bulk-angle-intro.md` selesai di-commit.

Kata ian: teks putih di atas kotak hitam sudah benar, tapi
1. sebagian label teksnya keluar layar di samping,
2. kotaknya masih persegi tanpa radius,
3. tidak ada jarak (padding) antara teks dan tepi kotak hitam.

Berlaku untuk semua label teks dengan `box: true` (intro, notes, dan label Timeline yang dicentang
"Dark box behind the text"), di preview DAN di hasil render. Label tanpa kotak (outline) tidak diubah.

## Penyebab (sudah dicek Plan)

- Render: `klipian/compose.py:155-182` `build_label_ass`, style `LabelBox` = libass `BorderStyle 3, Outline 18`.
  BorderStyle 3 menggambar persegi per baris dan **tidak punya radius**. Lebar wrap libass selalu
  `1080 − 40 − 40`, tidak peduli `x`, jadi label yang digeser ke kiri/kanan (`\pos`) meluber keluar frame.
- Preview: `ui/js/editor/compose.js:100-160` + `ui/css/app.css:415-433` meniru perilaku itu
  (`max-width: 92.6%` dihitung dari frame, bukan dari posisi label).
- Sudah ada cara menggambar kotak membulat: caption gaya "Box" di `klipian/render.py:222-295`
  (`_measure` dengan Pillow, `_rounded_rect` dalam mode `\p1`, fallback ke BorderStyle 3 kalau Pillow/font tidak ada).
  Pillow 12.3 terpasang di `.venv`. **Pakai ulang ini, jangan tulis ulang.**

## Desain (diputuskan Plan)

- **Satu kotak membulat untuk seluruh blok teks** (bukan kotak per baris): hitam 70% (sama seperti sekarang,
  `&H4C000000` / `rgba(0,0,0,.7)`), **radius 24**, **padding 28 kiri-kanan, 16 atas-bawah** (unit frame 1080×1920).
  Simpan sebagai konstanta bernama di kedua sisi (`LABEL_BOX_PAD_X/Y`, `LABEL_BOX_RADIUS`) dengan nilai yang sama.
- **Tidak pernah keluar frame**: lebar teks maksimum untuk label di titik `x` adalah
  `2 * min(x, W − x) − 2 * (40 + PAD_X)` (W = 1080, label berpusat di `x`), dengan batas bawah yang wajar
  (misalnya 40% lebar) dan `x` digeser ke dalam seperlunya supaya batas bawah itu muat. Logika yang sama berlaku
  untuk `y` terhadap tinggi blok (kotak tidak boleh terpotong di atas/bawah).
- **Wrap dilakukan klipian sendiri, bukan libass**: kata dipecah per baris dengan pengukuran Pillow (`_measure`,
  yang perlu ditambah agar mengenali `LABEL_FONT` "Mona Sans ExtraBold" → `assets/fonts/MonaSans-ExtraBold.ttf`).
  Pakai algoritme greedy yang diseimbangkan: cari lebar terkecil yang tetap menghasilkan jumlah baris sama.
  Baris digabung dengan `\N`, lalu `WrapStyle 2` untuk event ini (tanpa wrap otomatis libass), supaya ukuran kotak = ukuran teks.
- **Render**: per label, satu event `\p1` kotak membulat (layer 1, dari `_rounded_rect`) + satu event teks
  (layer 2, style tanpa border, `\an5\pos`). Fallback tanpa Pillow/font = perilaku lama (BorderStyle 3), tapi
  tetap dengan margin per event yang dihitung dari `x` supaya tidak keluar layar.
- **Preview**: `.ov-text.box` menjadi satu blok, `background rgba(0,0,0,.7)`, `border-radius` dan `padding` dari
  konstanta (diskalakan dengan `pxFromOut`), `max-width` dari rumus `x` di atas, `text-wrap: balance`.
  Layer ganda `.ov-box` / `.ov-fg` dihapus karena tidak dibutuhkan lagi untuk satu kotak. Patah baris preview dan render
  boleh berbeda sedikit; yang wajib sama adalah ukuran font, padding, radius, warna, dan aturan tidak keluar frame.

## Pilihan warna kotak (permintaan ian)

Dua pilihan:
1. **Teks hitam, kotak putih: default untuk label baru.**
2. **Teks putih, kotak hitam.**

- Data: field overlay baru `boxStyle: "light" | "dark"`. `light` = kotak `#FFFFFF` 90% + teks `#111111`;
  `dark` = kotak hitam 70% + teks `#FFFFFF`. Memilih style juga mengisi `color` overlay dengan warna teks pasangannya.
  Label berkotak lama tanpa `boxStyle` dibaca sebagai `dark`, supaya project lama tampil persis seperti sebelumnya.
  Label baru (intro, notes, dan "Dark box behind the text" di Timeline) memakai default `light`.
- `compose.py clean_elements` meneruskan `boxStyle` (whitelist dua nilai; nilai lain dianggap `dark`), dan warna kotak `\p1`
  serta fallback BorderStyle 3 (`BackColour`/`OutlineColour`) mengikuti nilai itu. Preview memakai warna yang sama.
- **Menu Render, panel Intro & notes**: satu baris pilihan "Box: [Black on white] [White on black]" (tombol kecil
  berbingkai, keadaan terpilih jelas, tanpa pill), disimpan di `angle.boxStyle` per Result (hanya ditulis kalau
  bukan default; ikut jebakan "objek angle dibangun ulang" di brief bulk). Mengganti pilihan mengubah `boxStyle` + `color`
  label intro/notes Result itu yang sudah ada di video, sedangkan teks, posisi, dan ukurannya tetap.
- **Output format (bulk)**: pilihan yang sama di blok Intro text, defaultnya mengikuti Result sampel. Saat Apply dengan
  centang intro aktif, pilihan itu ditulis ke `angle.boxStyle` dan ke label intro/notes (origin `angle-*`) tiap Result.
- **Timeline inspector** (`compose.js:357`): checkbox "Dark box behind the text" diganti label "Box" dengan tiga tombol:
  None / Black on white / White on black, yang mengatur `box` dan `boxStyle` sekaligus.

## Tes
- Selftest (cari check yang menguji `build_label_ass`/compose; kalau tidak ada, tambahkan check kecil di
  `klipian/selftest.py`, jalankan lewat `run()`):
  - label `x=50` dengan teks 12 kata pada ukuran 72 → beberapa baris, dan semua titik kotak berada di dalam 0..1080;
  - label `x=10` dan `x=90` → kotak tetap di dalam frame;
  - satu kata sangat panjang → tidak crash, kotak tetap di dalam frame (`x` digeser atau ukuran dibatasi);
  - tanpa Pillow (monkeypatch `_measure` → None) → fallback BorderStyle 3 dengan margin per event, tetap di dalam frame;
  - label tanpa kotak: output ASS identik dengan sebelumnya.
  - `boxStyle: "light"` → kotak putih + teks gelap di ASS; tanpa `boxStyle` → hitam/putih seperti dulu; nilai ngawur → `dark`.
- Node: satu test kecil, ganti style di panel/bulk mengubah `boxStyle` + `color` label `angle-*` dan tidak menyentuh label lain.
- Visual: render dan screenshot KEDUA style.
- Baseline render: `python -m klipian selftest` penuh. Jika baseline `tests/fixtures/*` berisi label berkotak lalu
  berubah, LAPORKAN ke Plan, jangan `--rebaseline` sendiri.
- Visual, dengan workspace sementara (KLIPIAN_WORKSPACE di scratchpad, jangan sentuh `workspace/` ian):
  render satu klip pendek berisi intro 12 kata di `x=50` dan satu note di `x=15`, ambil frame dengan ffmpeg, lalu
  bandingkan dengan screenshot preview. Kirim kedua gambar dalam laporan.

## Selesai jika
Label berkotak di preview dan render tampil sebagai satu kotak membulat dengan padding (putih+teks hitam default, atau hitam+teks putih, bisa dipilih di panel Intro & notes, bulk Output format, dan Timeline), tidak pernah keluar
frame di posisi mana pun, label tanpa kotak tidak berubah, dan selftest hijau. Commit (jangan push), tanpa
`remotion/` dan `docs/briefs/`. Laporkan hash, output tes, dan kedua gambar.
