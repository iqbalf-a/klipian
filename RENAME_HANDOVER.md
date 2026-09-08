# Handover: lanjutan rename klipian ke Bahasa Inggris

Ditulis 8 September 2026, diperbarui 8 September 2026 (setelah batch
Workspace/History) supaya sesi Claude Code berikutnya — model apa pun,
termasuk model lokal/gratis lewat `claude-free` — bisa lanjut kerja ini
TANPA baca ulang histori chat sebelumnya. Baca file ini dari atas ke bawah,
urut, sebelum menyentuh kode apa pun.

## Sumber kebenaran

Rencana kerja lengkap ada di:

```
C:\Users\user\.claude\plans\squishy-floating-frost.md
```

File itu berisi status detail per-batch, glosarium istilah wajib, daftar
lengkap yang JANGAN diganti, dan bagian "Jebakan teknis" yang mencatat tiap
bug nyata yang sudah kejadian supaya tidak terulang. **Kalau isi handover
ini dan file plan itu beda, PAKAI file plan itu** — itu yang terus di-update
tiap akhir batch, file ini cuma potret ringkas.

Kalau file plan itu tidak ada / tidak kebuka, JANGAN menebak dari nol —
baca dulu commit log (`git log --oneline | grep rename`) untuk rekonstruksi
progress, lalu tanya ian.

## Status saat handover ini ditulis

- **18 dari ~22-23 batch selesai** (estimasi total direvisi naik dari
  perkiraan awal 10-13 batch, karena Fase 3 `framing.js` harus dipecah dua
  dan Fase 4 ternyata ~65 class Indonesia, bukan ~45 seperti dugaan awal).
- Fase 1 (39 token CSS), Fase 2 (133 fungsi Python), Fase 3 (identifier di
  11 modul JS editor) — **SELESAI TOTAL**.
- Fase 4 (class CSS + id HTML + `data-*` attribute, per layar) — **jalan**,
  4 dari 5 layar selesai: Framing, Clips/Result, Captions, Workspace/History.
- Commit terakhir: `5bcdc57` (`rename(fase-4/workspace-history)`), sudah
  dipush ke `origin/main`.
- Checkpoint sebelum seluruh pekerjaan rename ini dimulai: `4e0e9c2`.
- **Temuan baru yang butuh keputusan ian, JANGAN dieksekusi sendiri**:
  nilai string `data-to`/`data-screen` untuk routing tab layar — `"klip"`
  dan `"teks"` masih Indonesia (`"analysis"/"framing"/"history"` sudah
  Inggris), dipakai `toScreen()` di `app.js`/`projects.js`/`result.js`/
  `roundtrip.js` plus `id="tab-klip"/"tab-teks"`/`id="panel-klip"/
  "panel-teks"` di `index.html`. Kelihatan seperti Fase 4 biasa, TAPI
  `projects.js`'s `projectState()` menyimpan string ini APA ADANYA ke
  field `screen` di `workspace/projects/*.json` — persis kelas masalah
  `klipian:sesi-aktif`. Kalau mau diganti, wajib baca-nilai-lama sebagai
  fallback dulu. Sudah dicatat di bagian "JANGAN diganti" plan file —
  JANGAN diputuskan sendiri oleh sesi mana pun tanpa ian.

## Langkah mulai (wajib urut, jangan lompat)

1. Buka dan baca `C:\Users\user\.claude\plans\squishy-floating-frost.md`
   utuh — terutama bagian "Cara kerja berkala" dan "Jebakan teknis". Ini
   bukan opsional; sebagian besar bug yang sudah kejadian di batch-batch
   sebelumnya persis karena langkah ini dilewati.
2. `cd D:\github-repos\klipian`. Pastikan `git status` bersih dan
   `git log origin/main..HEAD` kosong (kalau tidak, batch sebelumnya belum
   beres — jangan numpuk perubahan baru di atasnya, beresi dulu).
3. Di plan file, cari tanda `- [ ]` PERTAMA yang belum tercentang di bagian
   "Fase". Per commit terakhir di atas, titik mulai berikutnya adalah
   **Layar Global/Shell** di Fase 4 (`.konfirmasi`/`.tanya*`/`data-aksi`/
   `data-hapus-*`/dll). Verifikasi ulang scope-nya lewat grep dulu, jangan
   asumsi dari catatan plan — sudah 3x kejadian di batch sebelumnya bahwa
   perkiraan awal plan meleset dari kondisi kode nyata (lihat "Koreksi" di
   tiap batch Fase 4 yang sudah selesai).
4. Kerjakan **SATU** butir fase itu saja. Jangan menyerempet butir/fase
   lain walau kelihatan gampang sekalian dikerjakan.

## 5 gerbang wajib sebelum commit — jangan skip satu pun

1. **Grep bersih**: nama lama nol sisa di seluruh repo untuk hal yang
   direname di batch ini.
2. **Klik-through nyata**: buka layar yang tersentuh di browser pakai
   `workspace/samples/podcast-test.mp4`, dan **benar-benar klik setiap
   kontrolnya** — bukan cuma memeriksa DOM lewat JavaScript atau melihat
   render pasif. Dua bug di batch terakhir (tombol hapus-dari-Result,
   tombol edit-waktu) baru ketahuan pas tombolnya diklik sungguhan; grep
   dan pengecekan DOM pasif tidak menangkap keduanya.
3. **Console bersih**: tidak ada `ReferenceError` atau request gagal baru.
   (404 lama yang memang sudah muncul dari sebelumnya boleh diabaikan —
   itu pola yang sudah dikenal, dicatat di plan, bukan regresi baru.)
4. **Commit** dengan awalan persis `rename(fase-4/<nama-layar>):` (sesuaikan
   nomor fase kalau bukan Fase 4).
5. **Centang** butirnya di plan file + update baris "Status" paling atas.

## Kesalahan yang SUDAH beberapa kali kejadian — jangan diulang

- **`data-xxx-yyy` diganti nama, tapi `.dataset.xxxYyy` (camelCase versi
  LAMA) di baris/fungsi JS lain tertinggal.** Ini gagal diam-diam sempurna:
  `.dataset.namaLama` tetap valid secara JavaScript (nilainya cuma selalu
  `undefined`), tidak ada error konsol, dan grep nol-sisa untuk teks
  `data-xxx-yyy` juga TIDAK menangkap ini (bentuk teksnya beda:
  `.dataset.xxxYyy` vs `data-xxx-yyy`). Kejadian nyata 2x di batch
  Clips/Result kemarin (tombol hapus-dari-Result dan tombol edit-waktu
  keduanya diam-diam mati). **Wajib** sesudah rename tiap `data-xxx-yyy`:
  grep terpisah untuk `.dataset.xxxYyy` (bentuk camelCase versi LAMA) di
  SELURUH `ui/js/editor/`, baru dianggap selesai kalau kedua pola nol-sisa.
- **sed/regex bisa merusak string selector `$("#id")` yang teksnya
  kebetulan sama persis dengan identifier yang sedang direname**, padahal
  string itu menunjuk id HTML ASLI yang belum diganti (jatah fase lain).
  Selector-nya jadi tidak pernah cocok — gagal diam-diam juga. Wajib
  cross-check tiap `$("#...")`/`.querySelector(...)` di file yang disentuh
  terhadap id yang BENAR-BENAR ada di `ui/index.html`.
- **Semua file `ui/js/editor/*.js` berbagi SATU global scope** (dimuat
  lewat `<script src>` biasa, BUKAN ES module). Fungsi/variabel top-level
  di satu file otomatis kepanggil dari file lain. Sebelum bilang satu
  modul "selesai", grep nama yang direname ke SELURUH folder
  `ui/js/editor/`, bukan cuma file yang lagi dikerjakan.
- **Tab browser yang sudah lama terbuka menyembunyikan breakage** — JS
  lama masih jalan di memori sampai reload penuh. Wajib `navigate` ulang
  (reload PENUH, bukan cuma re-run JavaScript di tab yang sama) sebelum
  klik-through verifikasi.
- **Jangan sed/regex teks polos untuk rename identifier** — tidak tahu
  beda kode vs komentar/string, bisa ikut menerjemahkan komentar (jatah
  Fase 5) tanpa disadari, atau merusak template literal ``${x}``. Kalau
  tidak ada tool AST-aware untuk bahasa terkait, rename manual per-simbol:
  Grep dulu semua kemunculan, baru Edit satu-satu.
- Tiap edit file statis (`ui/index.html`, `ui/css/app.css`,
  `ui/js/editor/*.js`) wajib naikkan cache-buster `v=` di `ui/index.html`:
  ```bash
  cd /d/github-repos/klipian
  NEWV=$(date +%s%3N)   # atau: powershell -c "[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()"
  sed -i "s/v=[0-9]\{9,\}/v=$NEWV/g" ui/index.html
  ```
- Perubahan di `klipian/*.py` wajib restart proses server penuh (kill PID
  yang listen di port 5177, baru `preview_start` ulang) — verifikasi lewat
  `StartTime` PID baru, jangan cuma percaya flag "reused" dari tool.
- **Jangan pernah ganti VALUE key localStorage** yang sudah tersimpan di
  browser user (`klipian:sesi-aktif`, `klipian:preset-caption`,
  `klipian:sidebar-tersembunyi`, dll) atau **key JSON project tersimpan**
  di `workspace/projects/*.json` — hanya nama KONSTANTA JS yang
  merujuknya boleh diganti. Daftar lengkap ada di plan bagian
  "JANGAN diganti".
- **Bukan cuma nama `data-*` attribute yang bisa jadi kunci data
  tersimpan — NILAI (VALUE) attribute-nya juga bisa.** Kejadian nyata di
  batch Captions: `data-to="klip"`/`data-to="teks"` kelihatan seperti
  identifier UI biasa (Fase 4), tapi nilai string itu ternyata disalin
  apa adanya ke field `screen` di `projectState()` lalu tersimpan ke
  `workspace/projects/*.json`. **Sebelum rename NILAI string apa pun**
  yang dipakai sebagai `data-*` attribute value, argumen fungsi navigasi/
  state, atau semacamnya — grep dulu apakah string persis itu juga muncul
  di dekat kode yang menulis ke `localStorage`/`fetch(..., {method:
  "POST"...})`/objek yang dikembalikan fungsi bernama `xxxState()` atau
  `saveXxx()`. Kalau ya, berhenti dan lapor, jangan diputuskan sendiri.

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
  lagi tiap kali.** Alasan ian: gunanya batch kecil adalah tiap langkah
  jadi titik aman yang bisa di-revert; kalau numpuk belum dipush,
  manfaatnya hilang. Izin ini terbatas untuk pekerjaan rename ini saja —
  di luar itu, kebiasaan normal tetap berlaku (commit dulu, tunggu ian
  untuk push).
- **Trigger manual saja.** ian yang bilang "lanjutkan"/"lanjut rename" —
  baru ambil butir berikutnya. Jangan bikin job terjadwal/otomatis untuk
  ini: kerusakan Fase 4 tidak melempar error apa pun, hasilnya wajib
  dilihat mata orang yang tahu tampilan benarnya seperti apa.

## Kalau nemu masalah yang tidak bisa diselesaikan sendiri

**Berhenti, jangan tebak-tebakan.** Kondisi yang wajib berhenti dan lapor
ke ian dulu:

- Ada nama yang ternyata dipakai sebagai kunci data tersimpan (cek daftar
  "JANGAN diganti" di plan) — jangan diputuskan sendiri untuk diganti.
- Klik-through nemu yang rusak dan penyebabnya tidak ketemu dalam sekali
  duduk — `git revert` batch itu, lapor, jangan ditumpuk perbaikan
  tebak-tebakan di atasnya.
- Butir yang dikerjakan ternyata jauh lebih besar dari dugaan di plan —
  pecah jadi dua batch, jangan dipaksa selesai sekaligus.

## Sisa pekerjaan setelah handover ini (ringkasan, detail lengkap di plan)

- **Fase 4** — 1 layar tersisa: Global/shell
  (`.konfirmasi`/`.tanya*`/`data-aksi`/`data-hapus-*`/dll). Plus satu item
  yang ditunda dari Fase 1: key tema Indonesia di `ui/tailwind.config.js`
  yang membentuk nama class Tailwind (`.bg-kaca`, `.text-teks-samar`,
  dll) — harus dikerjakan barengan `workspace.src.css`. Plus satu item
  yang BELUM ada di layar mana pun secara eksplisit dan butuh keputusan
  ian dulu: rename nilai `data-to`/`data-screen="klip"/"teks"` (lihat
  bagian "Status" di atas) — JANGAN dikerjakan sampai ian memutuskan
  pendekatan migrasinya.
- **Fase 5** — terjemahkan ~1.239 baris komentar Indonesia ke Inggris
  (sengaja terakhir, supaya komentar tidak basi duluan sebelum identifier
  yang disebutnya stabil).
- **Fase 6** — sapuan penutup, cache-buster final, klik-through penuh dari
  nol, update memori konvensi jadi "semua Inggris".

Di luar lingkup rename ini (identifier), ada daftar terpisah "Temuan
sampingan" di plan — teks yang DIBACA PENGGUNA yang ternyata masih
Indonesia di beberapa layar (Workspace, `roundtrip.js`, `timeline.js`,
`player.js`, dan terparah `analysis.js`). Itu bukan bagian dari rename
identifier ini — jangan ditambal diam-diam, tawarkan ke ian sebagai
pekerjaan terpisah kalau relevan.
