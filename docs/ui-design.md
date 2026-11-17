# klipian: desain UI (keadaan sekarang)

Dokumen pendek ini menjelaskan UI yang ada. Sumber kebenarannya kode: `ui/css/tokens.css` (token) dan
`ui/css/brand.css` (tombol, topbar). Kalau dokumen ini dan kode berbeda, kode yang benar; perbaiki dokumennya.

Brief awal (2026-10, 839 baris) ada di `docs/briefs/ui-design-brief-awal.md`. Sebagian besar isinya sengaja
tidak diikuti (stack, tipografi, palet, alur layar). Nomor `§` di `docs/roadmap.md` menunjuk ke brief awal itu.
Jangan mengubah UI supaya cocok dengan brief awal.

## Dasar

- JavaScript biasa tanpa build step, server `http.server` dari stdlib Python. Hanya `ui/css/workspace.css` yang
  dibangun (Tailwind, dari `workspace.src.css`); jangan diedit tangan.
- Satu pengguna, satu mesin, layar desktop. UI berbahasa Inggris.
- Tema gelap dan terang; semua warna lewat token, tidak ada warna literal di CSS halaman.

## Acuan

Halaman `/workspace` adalah acuan bentuk: tombol kecil berbingkai, padat, keadaan jelas (aktif, mati,
bahaya), pilihan yang terpisah satu sama lain. Tidak ada tombol berbentuk pil.

## Token

| Hal | Token | Catatan |
|---|---|---|
| Latar | `--bg-0` sampai `--bg-3` | makin besar makin terangkat |
| Teks | `--text`, `--text-muted`, `--text-faint` | |
| Aksen | `--accent` (kuning), `--accent-text`, `--accent-soft` | satu tombol utama per area |
| Status | `--ok`, `--warn`, `--danger` | `--ok` dan `--warn` mengikuti tema (alias `--status-posted` dan `--accent`) |
| Ukuran huruf | `--t-10` `--t-11` `--t-12` `--t-13` `--t-14` `--t-17` `--t-20` `--t-24` `--t-29` | tidak ada ukuran setengah (11.5, 12.5) |
| Jarak | `--s1` (4px) sampai `--s8` (64px) | |
| Huruf | Geist (UI), Geist Mono (timecode, durasi, nama file) | Mona Sans ExtraBold hanya untuk watermark di video |

## Radius

| Token | Nilai | Untuk |
|---|---|---|
| `--r-ctl` | 4px 10px 10px 4px | semua kontrol: tombol, input, select. Sudut awal lebih tajam: ciri klipian |
| `--r-xs` | 4px | thumbnail, tag, kbd, baris di dalam menu |
| `--r-s` | 10px | kotak kecil |
| `--r-m` | 14px | dialog, menu, kartu |
| `--r-l` | 20px | panel halaman Edit |
| `--r-pill` | 999px | hanya yang bukan tombol: saklar segmen, chip pilihan, tag status |

## Tombol (`brand.css`)

| Kelas | Pakai untuk |
|---|---|
| `.btn` | tombol biasa: bingkai 1px, transparan, 12px, tinggi 28px |
| `.btn.main` | aksi utama, isi warna aksen, sama tinggi dengan `.btn`; satu per area |
| `.btn.sm` | baris padat, 11px |
| `.btn.quiet` | tanpa bingkai, untuk aksi tersier atau ikon |
| `.btn.danger` | aksi merusak |
| `.btn.large` | satu aksi besar per halaman (Render) |

Tombol mati: opacity .4 dan kursor `not-allowed`. `button`, `input`, `select`, `textarea` mewarisi huruf UI.

## Yang belum seragam

- Tinggi kontrol di luar tombol: kotak cari 30px, input dan select tabel Clips 32px, pager 25 sampai 28px.
- `workspace.css` masih memakai kelas Tailwind dengan ukuran sendiri.
