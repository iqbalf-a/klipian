# Handover: lanjutan rename klipian ke Bahasa Inggris

Ditulis 8 September 2026, diperbarui 8 September 2026 (setelah Fase 5
selesai + banyak bug nyata ketemu & diperbaiki) supaya sesi Claude Code
berikutnya — model apa pun, termasuk model lokal/gratis lewat
`claude-free` — bisa lanjut kerja ini TANPA baca ulang histori chat
sebelumnya. Baca file ini dari atas ke bawah, urut, sebelum menyentuh
kode apa pun.

## Sumber kebenaran

Rencana kerja lengkap ada di:

```
C:\Users\user\.claude\plans\squishy-floating-frost.md
```

File itu berisi status detail per-batch, glosarium istilah wajib, daftar
lengkap yang JANGAN diganti, daftar task konkret yang masih tersisa, dan
bagian "Jebakan teknis" yang mencatat tiap bug nyata yang sudah kejadian
supaya tidak terulang. **Kalau isi handover ini dan file plan itu beda,
PAKAI file plan itu** — itu yang terus di-update tiap akhir batch, file
ini cuma potret ringkas.

Kalau file plan itu tidak ada / tidak kebuka, JANGAN menebak dari nol —
baca dulu commit log (`git log --oneline | grep rename`) untuk rekonstruksi
progress, lalu tanya ian.

## ⚠️ Baca ini dulu sebelum percaya centang "selesai" di mana pun

Kejadian nyata 8 September 2026, 2x berturut-turut: batch sebelumnya
mengklaim Fase 5 "selesai total" di commit message-nya, padahal
**`framing.js` (1111 baris) cuma tersentuh ~35%** dan **tiga docstring
modul Python utuh** (`audio_energy.py`, `transcribe.py`, `__init__.py`)
sama sekali tidak tersentuh — grep nol-sisa yang dipakai batch itu tidak
menangkapnya karena yang tersisa berupa KALIMAT PANJANG tanpa kata kunci
yang gampang di-grep, bukan identifier pendek. Ketahuan baru setelah sesi
lain menjalankan sapuan yang jauh lebih ketat (baca docstring langsung,
cek titik-berhenti hunk diff terakhir, baca manual file besar dari awal
sampai akhir). **Jangan ulangi pola ini**: kalau melanjutkan/memverifikasi
klaim "sudah selesai" dari batch/sesi lain, jalankan ulang sapuan sendiri
— jangan cukup percaya grep nol-sisa nama identifier sekali jalan. Detail
lengkap metodenya ada di plan file, bagian "Cara verifikasi Fase 5 benar-
benar tuntas".

## Status saat handover ini ditulis

- **Fase 1-5 SELESAI** (token CSS, Python, identifier JS 11 modul,
  class/id/`data-*` per layar, komentar+docstring+teks user-facing yang
  disetujui). **Fase 6 (penutup) BERIKUTNYA.**
- Commit terakhir: `8a315ae`, sudah dipush ke `origin/main`.
- Checkpoint sebelum seluruh pekerjaan rename ini dimulai: `4e0e9c2`.
- **Temuan yang butuh keputusan ian, JANGAN dieksekusi sendiri**: nilai
  string `data-to`/`data-screen` untuk routing tab layar — `"klip"` dan
  `"teks"` masih Indonesia, dipakai `toScreen()` di banyak berkas JS, DAN
  tersimpan APA ADANYA ke field `screen` di `workspace/projects/*.json`
  lewat `projectState()` (projects.js) — persis kelas masalah
  `klipian:sesi-aktif`. Kalau mau diganti, wajib baca-nilai-lama sebagai
  fallback dulu. JANGAN diputuskan sendiri oleh sesi mana pun tanpa ian.

## Sisa pekerjaan KONKRET (per 8 September 2026 — cek plan file untuk versi terbaru)

Ini bukan dugaan, sudah dicek langsung lewat grep di kode nyata:

1. **Widget konfirmasi-hapus kartu project di Beranda** (Fase 4,
   Global/shell — batch lama `3ea1a43` cuma merename `data-*` attribute-
   nya, CSS class & classList state-nya BELUM): `.tanya`, `.konfirmasi`,
   `.tanya-teks`, `.tanya-sub`, `.tanya-aksi`, `.hilang`,
   `.tanda-terakhir`, `.nama-objek`. Lokasi: `ui/js/editor/projects.js`
   baris ~492-544 (`classList.add/remove/contains`), `ui/css/app.css`
   baris ~1187-1237 dan ~1551-1552.
2. **Sistem chip highlight caption** (Fase 4, jatah Layar Captions — SUDAH
   DUA KALI ditunda, termasuk saat batch Captions asli `4aea5aa` benar-
   benar jalan): `data-pilih` + `.titik` (class titik-warna) di
   `ui/js/editor/app.js` sekitar baris 340. **Hati-hati nama pengganti**:
   `titik` sudah dipakai luas untuk arti "framing point" → `point` di
   seluruh codebase lain — chip ini butuh nama LAIN (mis.
   `.highlight-dot`), JANGAN pakai `point` di sini.
3. **`ui/tailwind.config.js` theme key** (ditunda dari Fase 1): `kaca`,
   `kaca-kuat`, `garis`, `garis-terang`, `teks`, `teks-lemah`,
   `teks-samar`, `aksen`, `aksen-lembut`, `bahaya`, `boxShadow.kartu`.
   BUKAN kerja terjemah biasa — key ini membentuk NAMA CLASS Tailwind
   (`.bg-kaca`, `.text-teks-samar`, dll) dipakai puluhan kali di
   `ui/workspace.html` + `ui/css/workspace.src.css`. Ganti key → cari-
   ganti SEMUA pemakaian class di kedua berkas → build ulang
   `npx tailwindcss -c ui/tailwind.config.js -i ui/css/workspace.src.css
   -o ui/css/workspace.css --minify` SEBELUM commit (browser menyajikan
   `workspace.css`, bukan `.src.css`).
4. **`data-to`/`data-screen` screen-routing values** — BUTUH KEPUTUSAN IAN
   DULU (lihat bagian Status di atas).
5. **Fase 6 — penutup**: belum mulai sama sekali. Sapuan akhir + cache-
   buster final + klik-through penuh dari nol (drop video → Find clips →
   Framing termasuk AI Framing + Track head → Captions → Render) + update
   memori konvensi (`project_klipian.md`) jadi "semua Inggris".

## Langkah mulai (wajib urut, jangan lompat)

1. Buka dan baca `C:\Users\user\.claude\plans\squishy-floating-frost.md`
   utuh — terutama "Cara kerja berkala", "Cara verifikasi Fase 5 benar-
   benar tuntas", dan "Jebakan teknis". Ini bukan opsional.
2. `cd D:\github-repos\klipian`. Pastikan `git status` bersih dan
   `git log origin/main..HEAD` kosong.
3. Ambil SATU butir dari daftar "Sisa pekerjaan KONKRET" di atas (atau
   cari `- [ ]` pertama di plan file kalau daftar ini sudah basi).
4. Kerjakan **SATU** butir itu saja. Jangan menyerempet butir lain.

## 5 gerbang wajib sebelum commit — jangan skip satu pun

1. **Grep bersih** — DENGAN AMBANG RENDAH (≥2 kata penanda Indonesia per
   baris, bukan cuma keberadaan 1 kata), diterapkan ke SELURUH baris file
   (bukan cuma baris yang "kelihatan seperti komentar" — kalimat pendek
   tanpa prefix `#`/`//` gampang lolos). Untuk file besar (>500 baris),
   JANGAN percaya cuma karena namanya muncul di `git diff --stat` batch
   sebelumnya — cek titik berhenti hunk diff terakhirnya.
2. **Klik-through nyata**: buka layar yang tersentuh di browser pakai
   `workspace/samples/podcast-test.mp4`, dan **benar-benar klik setiap
   kontrolnya** — bukan cuma memeriksa DOM lewat JavaScript. Banyak bug
   sesi ini (tombol Reload History, timeline marker color, dst) baru
   ketahuan pas tombolnya diklik sungguhan.
3. **Console bersih**: tidak ada `ReferenceError` atau request gagal baru.
   (404 lama yang memang sudah muncul dari sebelumnya boleh diabaikan.)
4. **Commit** dengan awalan `rename(<fase>/<nama>):` yang jelas.
5. **Centang** butirnya di plan file + update baris "Status" paling atas
   + hapus dari daftar "Sisa pekerjaan KONKRET" di file ini kalau relevan.

## Kesalahan yang SUDAH beberapa kali kejadian — jangan diulang

- **Batch bisa mengklaim "selesai" padahal cuma separuh jalan** — lihat
  peringatan besar di atas. Verifikasi ulang, jangan cuma percaya.
- **`data-xxx-yyy` diganti nama, tapi `.dataset.xxxYyy` (camelCase versi
  LAMA) di baris/fungsi JS lain tertinggal.** Gagal diam-diam sempurna:
  tidak ada error konsol, dan grep nol-sisa untuk teks `data-xxx-yyy` juga
  TIDAK menangkap ini. **Wajib** sesudah rename tiap `data-xxx-yyy`: grep
  terpisah untuk `.dataset.xxxYyy` (camelCase versi LAMA) di SELURUH
  `ui/js/editor/`.
- **Rename class CSS di satu sisi (mis. CSS) tapi lupa sisi lain (mis. JS
  yang generate markup) → styling diam-diam tidak pernah ter-apply.**
  Kejadian nyata: `.tl-mark.rekom/.hasil` di `timeline.js` tidak pernah
  di-update walau `app.css` sudah punya `.tl-mark.rec/.result` dari batch
  jauh sebelumnya — marker timeline kehilangan warna tanpa error apa pun.
  Sama untuk id: `#riwayatMuatBtn` (HTML) vs `#historyMuatBtn` (JS, sudah
  direname) — tombol Reload History diam-diam mati. **Wajib** cross-check
  SETIAP `$("#...")`/class yang disentuh terhadap yang BENAR-BENAR ada di
  file lain, bukan cuma grep nol-sisa nama lama.
- **sed/regex bisa merusak string selector `$("#id")`** yang teksnya
  kebetulan sama dengan identifier yang direname, padahal string itu
  menunjuk id HTML ASLI yang belum diganti. Wajib cross-check tiap
  `$("#...")` terhadap id yang BENAR-BENAR ada di `ui/index.html`.
- **Semua file `ui/js/editor/*.js` DAN `ui/js/workspace/*.js` berbagi
  SATU global scope per grup** (dimuat lewat `<script src>` biasa, BUKAN
  ES module). Sebelum bilang satu modul "selesai", grep nama yang
  direname ke SELURUH folder terkait.
- **Tab browser yang sudah lama terbuka menyembunyikan breakage** — wajib
  `navigate` ulang (reload PENUH) sebelum klik-through verifikasi.
- **Jangan sed/regex teks polos untuk rename identifier** — bisa merusak
  komentar/string/template literal tanpa disadari. Grep dulu semua
  kemunculan, baru Edit satu-satu untuk identifier; sed HANYA aman untuk
  pola string persis yang sudah dikonfirmasi lewat grep (mis.
  `class="nama-lama"` → `class="nama-baru"` di seluruh file sekaligus).
- Tiap edit file statis wajib naikkan cache-buster `v=` di `ui/index.html`:
  ```bash
  cd /d/github-repos/klipian
  NEWV=$(date +%s%3N)
  sed -i "s/v=[0-9]\{9,\}/v=$NEWV/g" ui/index.html
  ```
- Perubahan di `klipian/*.py` wajib restart proses server penuh (kill PID
  di port 5177, lalu `preview_start` ulang) — verifikasi lewat log server
  bersih setelah start, bukan cuma percaya flag "reused" dari tool.
- **Jangan pernah ganti VALUE key localStorage** yang sudah tersimpan
  (`klipian:sesi-aktif`, `klipian:preset-caption`,
  `klipian:sidebar-tersembunyi`, dll) atau **key/value JSON project
  tersimpan** di `workspace/projects/*.json` — hanya nama KONSTANTA JS
  yang merujuknya boleh diganti. Ini juga berlaku untuk NILAI (bukan cuma
  nama) `data-*` attribute yang ternyata disalin ke state tersimpan (lihat
  `data-to="klip"/"teks"` di atas). Daftar lengkap ada di plan bagian
  "JANGAN diganti".

## Data safety

- Uji klik-through SELALU pakai `workspace/samples/podcast-test.mp4`
  (video color-bar 55 detik, disposable).
- **Jangan pernah** pakai project asli ian (`radityadika-podcast.mp4`)
  untuk uji apa pun yang menulis data.
- Sesudah tiap batch, bersihkan artefak test:
  ```bash
  rm -f workspace/projects/podcast-test.*.json workspace/cache/podcast-test.*.json
  rm -rf workspace/out/podcast-test
  ```

## Izin yang sudah disetujui ian (berlaku KHUSUS untuk kerja rename ini)

- **Push tiap batch setelah lolos 5 gerbang di atas — tidak perlu tanya
  lagi tiap kali.** Izin ini terbatas untuk pekerjaan rename ini saja —
  di luar itu, kebiasaan normal tetap berlaku (commit dulu, tunggu ian
  untuk push).
- **Trigger manual saja.** ian yang bilang "lanjutkan"/"lanjut rename" —
  baru ambil butir berikutnya. Jangan bikin job terjadwal/otomatis:
  kerusakan Fase 4/5 tidak melempar error apa pun, hasilnya wajib dilihat
  mata orang yang tahu tampilan benarnya seperti apa.
- **Teks user-facing (bukan cuma identifier/komentar) boleh diterjemahkan
  juga** kalau ketemu selama kerja rename — sudah disetujui ian secara
  eksplisit 8 September 2026 untuk kategori ini (sejalan dengan keputusan
  26 Agustus 2026 bahwa semua teks pengguna harus Inggris). Ini BUKAN izin
  untuk memperluas scope ke hal lain di luar itu.

## Kalau nemu masalah yang tidak bisa diselesaikan sendiri

**Berhenti, jangan tebak-tebakan.** Kondisi yang wajib berhenti dan lapor
ke ian dulu:

- Ada nama ATAU NILAI yang ternyata dipakai sebagai kunci/data tersimpan
  (cek daftar "JANGAN diganti" di plan) — jangan diputuskan sendiri.
- Klik-through nemu yang rusak dan penyebabnya tidak ketemu dalam sekali
  duduk — `git revert` batch itu, lapor, jangan ditumpuk perbaikan
  tebak-tebakan di atasnya.
- Butir yang dikerjakan ternyata jauh lebih besar dari dugaan — pecah jadi
  dua batch, jangan dipaksa selesai sekaligus.
