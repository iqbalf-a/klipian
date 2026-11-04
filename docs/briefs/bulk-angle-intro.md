# Brief: intro (Intro & notes) di dialog Output format (bulk) + ganti nama Angle

Dari sesi Plan, 2026-11-02. Permintaan ian: di Render ada panel Angle untuk menaruh
teks intro di awal video selama beberapa detik. Fitur yang sama perlu ada di
editor, layar Clips, tombol **Output format…** (bulk untuk Result yang dicentang).
Keputusan ian: teks yang dipakai adalah **intro Angle milik tiap Result** (`slot.angle.intro`),
bukan satu teks untuk semua.

Teks intro **sudah ada** di tiap Result sejak JSON import dari brief: "A separate video for each"
(`result.js:711-723`) memanggil `carryAngleFrom([k])` per Result, jadi `slot.angle.intro` berisi intro saran
Claude untuk klip itu. Dialog ini **tidak** menulis atau meminta teks. Tugasnya hanya memasang teks yang sudah
ada itu ke video, dengan durasi yang dipilih. Result yang memang tidak punya intro (dibuat manual, atau Claude
tidak memberi intro) dilewati, dan jumlahnya disebutkan.

## Yang sudah ada (pakai ulang)

- `ui/js/editor/angle.js`: `addAngleLabel("intro")` membuat overlay teks
  `{ ...OVERLAY_DEFAULTS.text, text, box: true, start: 0, end: min(total, ANGLE_INTRO_SECONDS),
  x: 50, y: 16, size: ANGLE_INTRO_SIZE, origin: "angle-intro" }`. Penanda label intro
  adalah `origin: "angle-intro"`, dan panel Angle memakai penanda itu untuk menampilkan "on the video" / Remove.
- Result tersimpan: `SAVED_RESULTS[i]` dengan `angle`, `segments`, `overlays`
  (`projects.js:345` menyalin `OVERLAYS` Result yang terbuka ke slot-nya). Render bulk
  memakai `overlays` dari Result tersimpan (`klipian/renderreq.py:418`), jadi server tidak perlu diubah.
- `bulkOutputDialog(ids)` di `ui/js/editor/bulk.js:214`: `body` berisi baris opsi,
  `side` berisi preview. Saat Apply dipanggil `applyOutputToResults(ids, draft, keep)` (`app.js:585`).

## Kerjakan

1. **Fungsi murni di angle.js**: `withAngleIntro(overlays, intro, total, seconds, nextId)`
   mengembalikan daftar overlay baru, dengan aturan:
   - Intro kosong atau `total` 0: kembalikan `overlays` tanpa perubahan.
   - Jika sudah ada overlay `origin: "angle-intro"`: ubah `text`-nya dan `end = start + seconds`
     (dibatasi `total`). Posisi, ukuran, dan warnanya jangan diubah, sama seperti `syncAngleLabel`.
   - Jika belum ada: tambahkan overlay dengan bentuk yang sama seperti `addAngleLabel("intro")`,
     tapi `end = round2(min(total, seconds))`.
   `addAngleLabel("intro")` juga memakai fungsi ini (dengan `ANGLE_INTRO_SECONDS`), supaya bentuk
   labelnya hanya ditulis di satu tempat. Ekspor untuk Node dengan pola yang sama seperti `renderlabels.js`.

2. **Blok "Intro text" di dialog Output format** (`bulk.js`), letakkan di bawah baris opsi di `body`:
   - Checkbox "Put each Result's intro (Intro & notes) on the video", default **tidak** dicentang.
   - Input angka "seconds": default `ANGLE_INTRO_SECONDS` (2.5), min 1, max 10, step 0.5.
     Hanya aktif kalau checkbox dicentang.
   - Satu baris keterangan: "Uses the intro each Result got from the brief import · N of M ticked Results have one"
     (dari `slot.angle?.intro`). Tampilkan juga cuplikan intro Result sampel yang sedang dipreview (dipotong ±60 karakter),
     supaya terlihat teks mana yang akan dipasang.
     Kalau N = 0, checkbox disabled dan keterangan berbunyi "None of the ticked Results has an intro from the brief".
   - Gaya sama seperti baris opsi lain di dialog itu (tombol kecil berbingkai, bukan pill).

3. **Saat Apply** dengan checkbox dicentang, untuk setiap id yang punya intro:
   - `total` = jumlah durasi `segments` milik Result itu. Pakai helper yang sudah ada kalau ada;
     cari dulu sebelum menulis sendiri.
   - `slot.overlays = withAngleIntro(slot.overlays || [], slot.angle.intro, total, seconds, …)`.
   - Untuk Result yang sedang terbuka: `setOverlays(slot.overlays)`, lalu `commitOverlays()` /
     `renderAngleStates()`, supaya Timeline dan panel Angle langsung menunjukkan "on the video".
   - Simpan sekali saja (`saveProject()` sudah dipanggil di `applyOutputToResults`; jangan sampai tersimpan dua kali).
   - Catatan status (`#editNote`) menambahkan "· intro added to N".
   Checkbox tidak dicentang: overlay sama sekali tidak diubah (intro yang sudah ada tetap).

4. **Guide**: satu kalimat di `ui/guide.html` dekat baris 311 (bagian Output format…).

5. **Ganti nama "Angle" → "Intro & notes"** (keputusan ian: nama Angle membingungkan).
   HANYA teks yang dilihat pengguna. Nama di kode, id elemen, kunci data `angle`, `origin: "angle-intro"`, dan
   prompt/balasan Claude (`roundtrip.py`) tetap, supaya project lama tidak perlu migrasi.
   - `ui/index.html:1003` judul panel: `Intro & notes`.
   - `ui/js/editor/postreply.js:11`: `"Intro & notes: take"`, `"Intro & notes: intro"`, `"Intro & notes: notes"`,
     lalu sesuaikan `tests/postreply.test.js:21,27`.
   - `ui/guide.html:350`: `<b>Intro & notes</b>`.
   - Teks di dialog bulk (langkah 2): "Put each Result's intro (Intro & notes) on the video" dan
     "None of the ticked Results has an intro from the brief".
   - Setelahnya `grep -rn "Angle" ui/` hanya boleh menemukan komentar dan nama fungsi, bukan teks yang tampil.

6. **Durasi intro dan notes bisa diatur, dengan nilai default** (permintaan ian).
   - Panel Intro & notes (`ui/index.html` dekat 1003): dua input angka kecil, "Intro shows for [2.5] s" dan
     "Each note shows for [2] s" (min 1, max 10, step 0.5). Defaultnya `ANGLE_INTRO_SECONDS` / `ANGLE_NOTE_SECONDS`.
   - Disimpan per Result di `angle.introSeconds` / `angle.noteSeconds`, dan HANYA ditulis kalau berbeda dari default.
     Project lama tanpa field ini memakai default.
     **Jebakan**: objek `angle` dibangun ulang di beberapa tempat dan field baru akan hilang kalau tidak ikut disalin:
     `currentAngle()` / `setAngleFields()` (angle.js), `post.js:333-335`, `projects.js:328-329`,
     `postreply.js:38-41` (merge balasan Claude harus mempertahankan dua field ini dari `cur.angle`). Cek semuanya.
   - `addAngleLabel` dan `syncAngleLabel` memakai durasi dari input, bukan konstanta. Mengubah input memperbarui
     `end` label intro/notes yang sudah ada di video (start, posisi, ukuran, dan warna tetap), sama seperti saat
     teksnya diedit.
   - Dialog bulk (langkah 2): input seconds defaultnya intro seconds milik Result sampel (atau default). Saat Apply,
     nilai itu juga ditulis ke `slot.angle.introSeconds` tiap Result yang diberi intro, supaya panel menunjukkan angka yang sama.

## Tes
- `node tests/postreply.test.js` lolos setelah label diganti.
- `tests/angleintro.test.js` (Node, pola `tests/renderlabels.test.js`): tambah baru; intro yang sudah ada
  diperbarui dan posisi/ukurannya tetap; `seconds` lebih besar dari `total` dipotong; intro kosong tidak mengubah apa pun;
  label lain (tanpa origin) tidak disentuh.
- `tests/postreply.test.js`: tambah satu kasus: `introSeconds`/`noteSeconds` yang sudah ada tetap tersimpan setelah
  balasan Claude di-merge.
- Preview: ubah "Intro shows for" menjadi 4, lalu label intro di Timeline menjadi 0–4 s. Reload project, angkanya masih 4.
  Result lain yang belum diubah tetap 2.5.
- Cek di preview dengan workspace sementara (KLIPIAN_WORKSPACE di scratchpad, jangan sentuh `workspace/` ian):
  project dengan 2 Result yang punya intro dan 1 yang tidak → Output format… → centang, 4 s → Apply. Pastikan
  Timeline Result yang terbuka menunjukkan label 0–4 s, panel Angle berbunyi "on the video", dan Result yang tidak
  punya intro tidak berubah.
- `python -m klipian selftest --only bulk renderreq` lolos.

## Selesai jika
Dialog Output format punya blok Intro text; Apply memasang atau memperbarui label intro di tiap Result yang punya
intro, dengan durasi sesuai input; panel bernama "Intro & notes" dengan durasi intro/notes yang bisa diatur
(default 2.5 s / 2 s) dan tersimpan per Result; render bulk menampilkannya; tes Node dan selftest hijau. Commit (jangan push),
tanpa file `remotion/` dan `docs/briefs/` yang untracked. Laporkan ke Plan.
