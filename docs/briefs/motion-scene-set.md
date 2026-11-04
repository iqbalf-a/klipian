# Brief: objek motion punya "set" (tempat aslinya), bukan objek sendirian di tengah halaman kosong

Dari sesi Plan, 2026-11-03. Untuk sesi /execute. Kerjakan bertahap, satu commit per tahap (tahap 1 → 2 → 3),
dan laporkan ke Plan setelah tiap tahap (frame-nya), jangan langsung lanjut ke tahap berikutnya.

Kata ian (dari contact sheet `remotion/out/style-audit/sheet-*.png`):
1. **colokan**: sudah bagus dan tidak sepi, tapi colokannya harus di **tembok**, bukan di papan datar yang tidak ada apa-apa.
2. **hujan buatan**: terlalu sepi. Hanya satu kotak di tengah, jadi videonya terasa kecil (tidak luas, tidak terasa pemandangan).
3. **cegukan (organ)**: lagi-lagi terlalu sepi, hanya halaman kosong dengan satu objek di tengah.

Fokus brief ini **objek dan scene saja**. Teks, caption, suara, dan timing beat tidak diubah.

## Penyebab (sudah dicek Plan)

- B1 di `remotion/DESIGN.md` § 0b mewajibkan "one isometric slab on the brand background with its yellow spot".
  Itulah yang menghasilkan "objek di atas alas, melayang di halaman kosong": hujan = slab di dalam lingkaran kuning,
  cegukan = paru-paru di dalam lingkaran kuning, colokan = pelat di atas blok polos.
- Cegukan juga tidak memakai kit 2.5D sama sekali (hero digambar 2D tampak depan langsung di `index.tsx`, tanpa
  kamera dan tanpa lens). Lihat bagian Tahap 3.

## Aturan baru (Plan memutuskan): B27 "Set, not specimen", sekaligus mengubah B1

Tulis ke `remotion/DESIGN.md` § 0b (aturan B27, ubah kalimat B1, tambahkan satu baris di rule log, tanggal 2026-11-03,
asked by ian), dengan isi berikut (bahasa Inggris, gaya file itu):

- **B27 Set, not specimen.** The hero stands in the place where people meet it in daily life (its *set*): a socket in a
  room's wall, rain over a landscape, an organ inside a body. Never a lone object on an empty page.
  1. **Bleed.** In every shot outside the lens, the set runs past the frame edges on at least two sides (left and
     right, or the bottom); no floating slab with empty brand background around it. The brand background and its
     yellow spot may show only in the sky or far back, behind the set.
  2. **Three depth layers.** Far (the set's back: the wall's top, hills, the room; parallax about 0.3), the set with the hero
     (p = 1) and a near layer (p > 1). Pieces that stand in the set stay at p = 1 (B27.9d); their depth comes from a correct
     overlap. The near layer holds only loose things that touch nothing (dust `Motes`, a passing leaf, rain). Decided by ian, 2026-11-03.
  3. **Fill.** In the main shot of each beat, the empty background (the brand wall tones and the spot) covers at most
     35 % of the picture area between the top text and the caption band. Measured from rendered frames (below); a flag, not a failure.
  4. **Set dressing** (simple, flat, three tones, from the kit or saved as kit pieces): 2 to 4 pieces per set. They do not
     count against B5's supporting assets, they stay below the hero's detail and contrast, and they never use a meaning
     colour (yellow, red, blue water) unless they mean it. The hero stays the largest and most detailed thing (60 to 70 % of the width at the main shot, B1).
  5. **Inside the lens nothing changes:** the Lab (dark, grid) stays empty around the dissected part.
  6. **The lens only when the narration goes inside** (ian, 2026-11-03). The magnifier dive of B2 (as in the colokan) is used
     only where the narration itself looks inside a part or names something too small to see ("di dalam", a part, a grain,
     a nerve). Every other beat is a camera move inside the set (a push, a pan or a new framing of another place in it,
     B25.3), never a lens by habit. At most one lens per video stays (§ 2).
  7. **One scale per set** (ian, 2026-11-03: the side table was about the size of the socket). Every object in a set has its
     real size relative to the hero, from one table of real sizes in cm (`REAL_SIZE_CM` in a plain `.ts` module, B26: a socket
     plate about 8.5, a plug body about 4 wide, a side table 50 to 60 high and 40 to 50 wide, a table lamp 35 to 45, a potted plant
     30 to 60, a window about 100 to 120 high, a dining table about 75 high, a chibi adult about 160, a cloud, a plane, a field, a hill
     in their own nature ratios). When the hero is a close-up, a big piece is shown **partly, cut by the frame**, never shrunk to fit.
     Only the far layer (parallax below 1) may look smaller, and only by its parallax. A test checks that each piece's drawn
     size over the hero's is within 15 % of the ratio in the table.
  8. **Establishing shot and readable dressing** (ian, 2026-11-03, after colokan v3: true scale left only a brown wedge and a
     yellow cone). (a) The hook opens on a wide shot of the set, about 1.5 s, in which every dressing piece is seen whole and
     the hero is clearly where the story is; then the camera pushes to the hero's main shot (B1's 60 to 70 % applies from there).
     The loop-back eases back to that same wide shot. (b) A piece cut by the frame shows its most recognisable part (a table's
     thick edge with something on it, a lamp's shade with its neck and bulb), never an anonymous shape. (c) Dressing keeps off
     the meaning colours: no yellow lamp shade, no yellow-looking wood (yellow is current).
  9. **No overlap, no pass-through** (ian, 2026-11-03). Objects of a set never go into one another. (a) Every piece has a world
     box (x, y, z in the set's units); two boxes never intersect, they may only touch at a face. (b) A thing that stands rests on
     its surface: its base z equals that surface's z (a lamp on the desk top, a plant on the floor), not sunk into it and not
     floating. (c) The cable treats every piece as an obstacle (the desk, the lamp, the wall, the plug's body), as § 5 does for
     the wall. (d) Pieces that touch share one parallax layer; a piece on another layer never touches or crosses them, so a
     camera move cannot slide one through the other. (e) Depth order (round 6, rule 0) holds in every frame. (f) Checked by a
     test (the boxes, the contacts, the layers) and by a strip of frames across every camera move, not only the resting shots.
- **B1 baru:** "One set per video (B27) in the kit's iso camera (...); the slab of the stage is the set's floor or ground, and it bleeds past the frame. The hero fills 60 to 70 % ..."
  (yang lain di B1 tetap). Pilihan bentuk stage (slab, round, strip, steps, island) tetap berlaku untuk lantai set itu.

**Pengukuran fill:** tambahkan ke `npm run motion-density` (atau skrip kecil di sebelahnya, pilih yang lebih sedikit kode):
pada frame preview, hitung persentase piksel yang warnanya sama dengan nada wall/spot `Brand` (toleransi kecil) di area antara
top text dan caption band, per beat (ambil median frame yang berada di luar lens dan di luar beat sting/outro). Cetak PASS (≤ 35 %) atau FLAG.
Satu tes kecil untuk fungsi hitungnya (gambar sintetis: separuh warna wall → sekitar 50 %).

## Tahap 1: colokan di tembok (`videos/kenapa-colokan-panas/`)

- Stop kontak ditanam di **tembok ruangan**: bidang tembok yang lebar (nada `ISO.wall`) meluber ke kiri, kanan, dan atas
  frame, dengan **plint/list bawah** dan **lantai** (`ISO.floor`) di bawahnya. Kabel jatuh ke lantai itu (aturan kabel § 5 tetap:
  `floorZ` mengikuti lantai baru).
- Set dressing 2 sampai 3: misalnya ujung meja kecil atau kaki meja di sisi depan (near layer, terpotong frame), dan satu
  barang dari kit yang hidup (`IsoLife`: lampu meja atau charger/baterai) di belakang atau samping. Barang itu tidak boleh
  menutupi stop kontak dan tidak memakai merah atau kuning.
- Blok polos di belakang pelat yang sekarang hilang. Pelat stop kontak duduk rata di tembok (recess dan lubangnya tetap
  seperti `IsoWallSocket`, aturan round 4 dan round 6 tetap berlaku).
- Lens ke Lab, cutaway, dan loop-back tidak diubah. Loop test (`tests/colokan.test.ts`) harus tetap hijau: dressing yang
  bergerak harus periodik atau kembali ke nilai awal.

## Tahap 2: hujan buatan jadi pemandangan (`videos/cara-kerja-hujan-buatan/`)

- Shot utama menjadi **diorama lebar** yang meluber keluar frame kiri dan kanan: laut di satu sisi, daratan dengan bukit
  (`IsoHill`), pohon, semak, batu, sawah atau ladang yang butuh hujan (set dressing baru, simpan sebagai kit piece di
  `IsoNature.tsx` dengan tile di sheet nature), dan beberapa awan di jarak berbeda (yang jauh lebih kecil dan pucat,
  parallax 0.3). Awan hero tetap satu dan paling besar.
- Kamera: beat hook dimulai dengan **shot lebar** (establishing), lalu push ke awan hero. Tiap beat explain punya framing
  sendiri di set yang sama (B25.3), misalnya pesawat terbang di atas ladang, bukan di ruang kosong.
- Aturan nature kit tetap berlaku (depth order, clipped parts, variasi bentuk, rasio ukuran, tanpa gradient).
- Lens Lab (garam, perak iodida, tetes) tidak diubah: narasinya memang masuk ke dalam awan (butir kecil), jadi lens di sini sudah sesuai B27.6.

## Tahap 3: cegukan, organ di dalam tubuh (`videos/fakta-seru-tentang-cegukan/`)

Ini paling besar: heronya sendiri harus dibangun ulang dalam kit 2.5D.
- **Body kit baru** (`src/components/IsoBody.tsx`, geometri murni di `src/bodyGeometry.ts`, baris di `src/dictionary.ts`,
  tile di sheet): torso isometrik yang dipotong (cutaway seperti `IsoCutaway`: bidang potong di-hatch) dengan trakea dan pita suara,
  dua paru-paru, dan diafragma berbentuk kubah dari `extrude`/`Polys` dengan aturan 3 tone. Saraf frenikus memakai
  tanda dictionary untuk sinyal (garis putus-putus kuning mengalir = sinyal listrik saraf; tambahkan baris dictionary "nerve signal").
  Kontraksi otot memakai `Arrow` (arah tarik), **bukan** warna merah (merah hanya untuk panas atau bahaya). Hero harus lolos detail budget (`scripts/detailBudget.mjs`, B6).
- **Set:** orang yang sedang makan di meja makan (chibi yang sudah ada sebagai near/mid layer, dengan meja, piring, dan gelas air
  sebagai dressing). Torso cutaway muncul sebagai "x-ray" pada badan orang itu. Orang ini memang dibutuhkan cerita (bagian tubuh),
  jadi B3 tidak dilanggar, tapi ia tidak diparkir di pojok: ia adalah set-nya.
- **Lens (kaca pembesar seperti colokan) hanya satu, dan hanya di beat yang narasinya masuk ke dalam** (B27.6). Baca narasi
  `story.json` dulu: kandidat paling kuat adalah beat `bunyi` (pita suara menutup, bagian kecil di dalam tenggorokan). Beat lain
  (diafragma, janin, rekor, tips) memakai gerak kamera di dalam set: push ke dada, pan ke perut, atau framing baru. Jangan pakai lens di semua beat.
  Tulis di laporan beat mana yang dipilih untuk lens dan kalimat narasi mana yang jadi alasannya.
- Otak (`IsoBrain`) dan jantung (`IsoHeart`, janin) bukan lens: tampilkan sebagai bagian dari set (otak di kepala orang yang
  sama lewat x-ray/pan ke atas; janin di perut ibu yang disederhanakan), bukan objek sendirian di lingkaran kosong.
- `FloatLabel` dan teks tips buatan sendiri diganti `NumberLabel`, kartu tips, dan `SourceCard` dari kit (beat rekor wajib
  punya SourceCard, B10). Font literal dihapus (B17). Plan memakai kamera (`cam2At`) dan kotak layout seperti `plan.ts` colokan.
- Jika body kit terlalu besar untuk satu commit, pecah menjadi 3a (kit + sheet + tes) dan 3b (video), lalu laporkan setelah 3a.

## Tes

- `npm run check && npm test` hijau setelah tiap tahap; `node scripts/styleCheck.mjs <slug>` tanpa FLAG baru.
- Fill: angka per beat sebelum dan sesudah, untuk ketiga video (sebelum = render sekarang).
- `npm run motion-density -- <slug>` sebelum dan sesudah (B25 tidak boleh memburuk).
- Frame: `node scripts/frames.mjs video-<slug> style-audit/<slug>-v2 1.5 3.5 6 8.5 12 15 19 23 27 30 34 38 43`, lalu
  buat contact sheet 7x2 seperti `out/style-audit/sheet-<slug>.png` (label waktu di tiap tile). Kirim sheet lama dan baru berdampingan.
- In-between states: dressing yang bergerak dan transisi kamera dicek sebagai strip (aturan round 6).
- Jangan sentuh `workspace/`.

## Selesai jika

Ketiga video menampilkan hero di dalam set-nya yang meluber keluar frame, dengan tiga lapis kedalaman. Fill ≤ 35 % (atau flag
yang dijelaskan) di setiap beat di luar lens, B27 dan B1 baru tertulis di DESIGN.md beserta baris rule log, tes hijau.
Commit per tahap (jangan push), tanpa `docs/briefs/`. Laporkan hash, output tes, angka fill dan density sebelum/sesudah,
dan contact sheet sebelum/sesudah.
