# klipian — Brief Desain UI

Dokumen ini berdiri sendiri. Siapa pun yang membacanya tanpa konteks lain
harus bisa membangun antarmukanya.

---

## 1. Produknya apa

**klipian** memotong video panjang jadi klip vertikal 9:16 siap posting ke
TikTok, YouTube Shorts, dan Instagram Reels.

Cara kerjanya: video ditranskripsikan sampai tingkat kata, lalu AI membaca
transkrip itu dan menandai bagian yang layak jadi klip. Pengguna meninjau
kandidat, menyetel titik potong, mengatur crop dan caption, lalu render.

**Dua mode sumber:**

| Mode | Sumber | Cara momen ditemukan |
|---|---|---|
| `dialog` | podcast, talkshow, wawancara, ceramah | dari transkrip — gagasan yang utuh dan menarik |
| `gameplay` | siaran Mobile Legends dan sejenisnya | dari suara announcer (Savage, Maniac) + lonjakan hype |

**Penggunanya:** satu orang, seorang clipper, memakai ini rutin di laptopnya
sendiri.

**Sifatnya penting untuk desain:**

- **Lokal sepenuhnya.** Tidak ada akun, tidak ada unggah, tidak ada langganan.
  File tidak pernah meninggalkan disk. Ini **meja kerja**, bukan dashboard SaaS.
- **Berjalan lama.** Transkripsi video 42 menit butuh ~16 menit; siaran 2 jam
  butuh ~55 menit. Progress harus jujur dan bisa ditinggal.
- **Rasionya ekstrem.** Sumber 2 jam 22 menit menghasilkan klip 14 detik.
  Perbandingan 600:1. Itu inti nilai produknya dan harus terlihat.

---

## 2. Dari mana arah visualnya diambil

Empat sumber, semuanya spesifik untuk produk ini — bukan konvensi umum
"aplikasi video".

**Namanya.** *klipian* dibaca **kliping** — bahasa Indonesia untuk guntingan
koran yang ditempel di buku. Itu bukan permainan kata; itu deskripsi harfiah
pekerjaan aplikasinya: menggunting potongan dari sesuatu yang panjang.

**Mekanik aslinya.** AI membaca transkrip dan **menandai** bagian bagus —
persis seperti orang menstabilo teks. Penandaan itu menjadi sistem warnanya.

**Bentuk barang jadinya.** 9:16. Persegi panjang tinggi. Itu geometri dasar
produk dan harus selalu hadir.

**Lokalitasnya.** Bengkel pribadi, bukan produk berlangganan.

---

## 3. Aturan keras

### 3.1 Yang dilarang

Ini eksplisit. Klien menolak tampilan yang terasa hasil generate AI.

- ❌ Hitam pekat `#000` dengan **satu** warna aksen neon (hijau asam / merah
  vermilion). Ini bentuk paling generik untuk "dark UI aplikasi video".
- ❌ Tailwind default + shadcn/ui. `slate-950`, `rounded-xl`, `Card`, `Badge`.
- ❌ Sidebar kiri + topbar + grid kartu. Kerangka SaaS yang dipakai untuk apa saja.
- ❌ Inter, Space Grotesk, atau Geist sebagai display face.
- ❌ Gradien ungu-biru di mana pun.
- ❌ Penomoran hias `01 / 02 / 03` untuk hal yang bukan urutan.
- ❌ Ikon emoji sebagai elemen antarmuka.
- ❌ Latar krem `#F4F1EA` + serif kontras tinggi + aksen terracotta.

### 3.2 Yang wajib — periksa ulang sebelum menyatakan selesai

Delapan aturan ini pernah dilanggar. Kalau ada satu saja yang tidak terpenuhi,
desainnya belum selesai — sebagus apa pun rasanya.

1. **Panel 9:16 adalah SATU frame.** Caption adalah overlay di dalamnya,
   bukan kotak terpisah di bawahnya. Rasio frame luar tepat 9:16. Lihat 9.0.
2. **Tebal sapuan stabilo mengikuti skor**, 2px sampai 10px. Sapuan yang
   seragam berarti Ribbon sumber tidak membawa informasi, dan elemen tanda
   tangannya gagal. Lihat bagian 7.
3. **Waveform dan chip kata menempel** jadi satu blok — tanpa jarak, tanpa
   garis, tanpa elemen di antaranya. Keduanya berbagi sumbu waktu yang sama.
4. **Bar skor selalu disertai angka.** Bar abu-abu tanpa angka terbaca sebagai
   skeleton loading, bukan sebagai data.
5. **Label waktu Ribbon sumber: mulai di kiri, akhir di kanan.** Tidak menumpuk
   di satu sisi.
6. **Tombol berubah mengikuti status.** Kartu yang sudah distempel
   `SIAP RENDER` tidak boleh masih menampilkan tombol `Setujui`.
7. **Angka konsisten di seluruh layar.** Jumlah temuan di ribbon harus cocok
   dengan jumlah kartu. Durasi klip di kartu harus cocok dengan durasi di
   layar potong.
8. **Tidak ada elemen nyasar.** Setiap tombol dan label di layar harus bisa
   ditemukan penjelasannya di dokumen ini.
9. **Jangan menerjemahkan istilah kerja ke bahasa Indonesia.** crop, render,
   preview, timeline, waveform, caption, preset, frame, safe area, in/out
   tetap Inggris. `KOTAK POTONG` dan `GELOMBANG` salah. Lihat bagian 12.

### 3.3 Jangan biarkan bidang kosong menganga

Kalau sebuah panel isinya sedikit, panelnya yang mengecil — bukan isinya yang
dibiarkan mengambang di tengah bidang kosong ratusan piksel. Kertas kosong
membuat desain terbaca belum jadi.

---

## 4. Palet

Dasar gelap dipakai karena menilai video butuh lingkungan netral gelap.
Tapi yang membedakan: **permukaan kertas terang mengambang di atas meja
gelap**, seperti kliping yang ditempel di papan.

```css
:root {
  /* meja */
  --ink:            #14161A;  /* dasar. grafit kebiruan, bukan hitam murni,
                                 supaya warna kulit di video terbaca jujur */
  --ink-raised:     #1C1F25;  /* panel yang naik satu tingkat */
  --ink-line:       #2A2F38;  /* garis pemisah */
  --ink-teks:       #9AA3B2;  /* teks sekunder di atas meja */
  --ink-teks-kuat:  #E6EAF0;  /* teks utama di atas meja */

  /* kertas — hanya untuk permukaan baca */
  --kertas:         #F2EFE6;  /* transkrip, kartu klip */
  --kertas-tua:     #E3DED0;  /* tepi, bidang mati */
  --grafit:         #4A5160;  /* teks sekunder di atas kertas */
  --grafit-kuat:    #1A1D24;  /* teks utama di atas kertas */

  /* stabilo — tanda dari AI, membawa arti */
  --stabilo-kuning: #F5D90A;  /* mode dialog */
  --stabilo-pink:   #FF4D8D;  /* mode gameplay */

  /* stempel */
  --cap-tinta:      #2F4FCC;  /* status "siap render" */

  /* keadaan */
  --bahaya:         #D64545;  /* hanya untuk kegagalan */
}
```

**Sembilan warna hidup, tiap satu punya pekerjaan.** Tidak ada warna yang
sekadar mempercantik. Kalau butuh warna baru, pekerjaannya harus disebutkan
lebih dulu.

**Dua keputusan yang sengaja diambil:**

1. **Dua stabilo, bukan satu aksen.** Kuning untuk dialog, pink untuk gameplay.
   Karena produknya memang punya dua mode, warnanya membawa informasi —
   pengguna langsung tahu tanda ini datang dari detektor yang mana.

2. **Status "disetujui" pakai stempel, bukan centang hijau.** Centang hijau
   adalah jawaban default. Cap stempel jauh lebih tepat untuk vernakular arsip
   Indonesia, dan membebaskan satu warna dari beban.

---

## 5. Tipografi

Satu keluarga huruf, dua suara — memanfaatkan sumbu lebar variable font.

```html
<link href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,400..700&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet">
```

```css
:root {
  --font-display: "Archivo", system-ui, sans-serif;
  --font-teks:    "Archivo", system-ui, sans-serif;
  --font-data:    "IBM Plex Mono", ui-monospace, monospace;
}

.display {
  font-family: var(--font-display);
  font-variation-settings: "wdth" 125, "wght" 700;
  letter-spacing: -0.01em;
}

.teks {
  font-family: var(--font-teks);
  font-variation-settings: "wdth" 100, "wght" 400;
}
```

| Peran | Font | Dipakai untuk |
|---|---|---|
| **Display** | Archivo `wdth 125` `wght 700` | judul layar, judul klip, angka besar |
| **Teks** | Archivo `wdth 100` `wght 400/500` | transkrip, deskripsi, label |
| **Data** | IBM Plex Mono `400/500` | timecode, skor, durasi, nama file, resolusi |

**Kenapa begini:** Archivo melebar-tebal punya rasa editorial dan jarang muncul
di keluaran AI, yang hampir selalu jatuh ke sans lebar normal. Memakai satu
keluarga di dua lebar bikin tekstur halaman menyatu. Dan aplikasi editor hidup
di atas timecode — itu pantas dapat mono sungguhan, bukan angka proporsional.

### Skala

```
display-l   32px / 1.1   wdth 125  wght 700
display-m   22px / 1.2   wdth 125  wght 700
teks-l      16px / 1.5   wdth 100  wght 400
teks-m      14px / 1.5   wdth 100  wght 400
teks-s      12px / 1.4   wdth 100  wght 500   label, huruf besar, tracking .06em
data-m      13px / 1.4   mono 400
data-s      11px / 1.3   mono 500   tracking .04em
```

---

## 6. Token lain

```css
:root {
  /* spasi — kelipatan 4 */
  --s1: 4px;  --s2: 8px;  --s3: 12px; --s4: 16px;
  --s5: 24px; --s6: 32px; --s7: 48px; --s8: 64px;

  /* sudut */
  --r-kertas:  0;      /* kertas digunting itu lurus */
  --r-kontrol: 3px;    /* tombol, input, chip */
  --r-bulat:   999px;  /* hanya indikator bulat */

  /* garis */
  --garis: 1px solid var(--ink-line);

  /* bayangan — kertas di atas meja, bukan glow */
  --bayang-kertas:
    0 2px 0 rgba(0,0,0,.45),
    0 10px 28px rgba(0,0,0,.32);

  /* gerak */
  --cepat: 120ms cubic-bezier(.2,.8,.3,1);
}
```

**Sudut nol pada kertas itu keputusan, bukan penghematan.** Kertas yang
digunting punya tepi lurus. Kontrol tetap dapat 3px supaya terasa seperti
perkakas, bukan cetakan.

---

## 7. Elemen tanda tangan: Ribbon sumber

Satu elemen yang bikin aplikasi ini diingat. Pita horizontal selebar layar
yang mewakili **seluruh durasi sumber**, dengan sapuan stabilo di tempat klip
ditemukan.

```
SUMBER   cadera-gameplay-mlbb.mp4                      2:22:46
▏░░░░▌░░░░░░░░▌░▌░░░░░░░░░░░▌░░░░░░▌▌░░░░░░░░░░░░░▌░░░░░░░░░▏
 00:00                                                  2:22:46
       ▲         ▲▲                    ▲   ▲▲          ▲
     Savage   Maniac                Savage  Triple   Savage
```

**Ini memuat informasi, bukan hiasan:**

- posisi tiap temuan di dalam sumber
- kerapatan temuan — mana bagian yang produktif, mana yang kosong
- kekuatan skor lewat **ketebalan** sapuan
- mode lewat **warna** sapuan (kuning dialog, pink gameplay)

Dan hanya di sinilah rasio 600:1 itu terlihat: satu baris mewakili 2 jam 22
menit, dengan beberapa goresan tipis yang jadi barang jadinya.

**Interaksi:** arahkan kursor ke sapuan → kartu preview kecil muncul; klik →
klip terbuka di editor.

### Ukuran sapuan — ini yang membuatnya bermakna

Yang berubah adalah **lebar**; tinggi tetap 18px.

| Skor | Lebar sapuan |
|---|---|
| 9.0 – 10 | 10px |
| 8.0 – 8.9 | 8px |
| 7.0 – 7.9 | 6px |
| 6.0 – 6.9 | 4px |
| di bawah 6.0 | 2px |

```
salah  ▌    ▌    ▌    ▌    ▌      seragam — ribbon jadi penanda posisi biasa
benar  ▊  ▍   ▉    ▎  ▋           tebal = skor tinggi, terbaca sekilas
```

Sapuan yang seragam lebarnya berarti Ribbon sumber cuma menunjukkan *di mana*,
padahal tugasnya juga menunjukkan *seberapa bagus*. Kalau lebarnya seragam,
elemen tanda tangan ini gagal.

### Label dan hitungan

- `00:00` menempel di **tepi kiri**, durasi total di **tepi kanan**. Sejajar
  di satu baris di bawah ribbon. Jangan ditumpuk di sisi yang sama.
- Jumlah temuan di judul ribbon harus cocok dengan jumlah kartu di layar
  Kandidat. Kalau sebagian sudah ditolak, tulis `9 temuan · 6 tersisa`.
- Label teks di bawah sapuan (`Rugi 300 juta`) hanya muncul untuk lima skor
  tertinggi. Sisanya tanpa label supaya ribbon tidak sesak.

**Cara menggambar sapuan stabilo.** Jangan persegi panjang datar. Goresan
stabilo asli punya ujung tidak rata dan tembus pandang:

```css
.sapuan {
  background: var(--stabilo-kuning);
  opacity: .85;
  mix-blend-mode: screen;          /* di atas meja gelap */
  clip-path: polygon(2% 0, 100% 0, 98% 100%, 0 100%);
}

.kertas .sapuan {
  mix-blend-mode: multiply;        /* di atas kertas */
  opacity: 1;
}
```

---

## 8. Tata letak

Yang **ditolak**: sidebar kiri + topbar + grid kartu.

Satu keputusan struktural menggantikannya: **panel 9:16 permanen di kanan,
dengan proporsi asli.** Setiap keputusan — crop, caption, titik potong —
dinilai terhadap bentuk itu. Kebanyakan tools menyembunyikannya di balik
tombol preview. Di sini ia tidak pernah hilang, karena itulah barang jadinya.

```
┌────────────────────────────────────────────────────────────┐
│ klipian   radityadika-podcast.mp4    42:03      dialog ▾   │  56px
├────────────────────────────────────────────────────────────┤
│ ▏░░░▌░░░░░▌░░▌░░░░░░░▌░░░░░▌░░░░░░░░░▌░░░░▌░░░░░░░░░░░░░  │  72px
│  00:00                                              42:03  │
├─────────────────────────────────────┬──────────────────────┤
│                                     │                      │
│  ┌───────────────────────────────┐  │    ┌──────────┐      │
│  │ KERTAS — area kerja           │  │    │          │      │
│  │                               │  │    │   9:16   │      │
│  │ kandidat / transkrip /        │  │    │  selalu  │      │
│  │ reframe / caption             │  │    │ terlihat │      │
│  │                               │  │    │          │      │
│  └───────────────────────────────┘  │    └──────────┘      │
│                                     │   ◀ ▶  00:14 / 00:47 │
│              flex: 1                │       360px tetap    │
├─────────────────────────────────────┴──────────────────────┤
│ ▁▃▅▇▅▃▁▂▄▆█▆▄▂▁▃▅▇▅▃▁▂▄▆█▆▄▂▁▃▅▇▅▃▁▂▄▆█▆▄▂▁▃▅▇▅▃▁▂▄▆█▆▄  │  140px
│ │saya│rugi│tiga│ratus│juta│gara-gara│satu│keputusan│       │
└────────────────────────────────────────────────────────────┘
```

Target layar: desktop 1440×900 ke atas. Ini perkakas kerja, bukan halaman
web — tidak perlu responsif sampai ponsel. Di bawah 1200px, panel 9:16 boleh
menyempit; di bawah 1000px tampilkan pesan bahwa layar terlalu sempit.

---

## 9. Komponen

### 9.0 Panel keluaran 9:16 — komponen yang paling sering salah dibuat

**Aturan tunggal: ini SATU frame, bukan dua kotak bertumpuk.**

Caption dibakar ke dalam video. Kalau caption digambar di kotak terpisah di
bawah videonya, pengguna kehilangan satu-satunya hal yang perlu dinilai:
apakah caption menutupi wajah, dan apakah ia jatuh di dalam safe area
platform. Seluruh alasan panel ini permanen jadi hilang.

```
SALAH                          BENAR
┌──────────┐                   ┌────────────────────┐ ← rasio TEPAT 9:16
│          │                   │ ┌────────────────┐ │
│  VIDEO   │  kotak 1          │ │                │ │ ← garis putus-putus
│   9:16   │                   │ │                │ │   safe area
│          │                   │ │  frame video   │ │
└──────────┘                   │ │                │ │
┌──────────┐                   │ │                │ │
│ CAPTION  │  kotak 2          │ │  ┌──────────┐  │ │
│   ini    │  terpisah         │ │  │ini  klip │  │ │ ← caption DI DALAM
└──────────┘                   │ │  └──────────┘  │ │
                               │ └────────────────┘ │
                               └────────────────────┘
                                 ◀ ▶   00:14 / 00:47  ← kontrol di luar
```

- Frame luar: `aspect-ratio: 9 / 16`, lebar mengikuti kolom, maksimal 360px
- Overlay **safe area**: garis putus-putus 1px `--ink-teks` opacity .5,
  dengan margin 16% atas, 20% bawah, 6% kiri dan kanan. Bisa dimatikan lewat
  toggle `Safe area`
- Caption diposisikan relatif terhadap frame video, bukan terhadap kolom.
  Kata yang sedang diucapkan berlatar `--stabilo-kuning`
- Header panel: `KELUARAN 9:16` di kiri, `1080×1920` mono di kanan
- Kontrol putar dan timecode berada **di luar** frame, tepat di bawahnya

### 9.1 Transkrip-sebagai-timeline

**Ini interaksi paling penting di seluruh aplikasi.**

Di bawah waveform, kata-kata transkrip tampil sebagai chip yang bisa diklik.
Klik satu kata → in. Klik kata lain → out. Potongan otomatis
pas di batas kata, karena datanya memang berasal dari sana.

```
▁▃▅▇▅▃▁▂▄▆█▆▄▂▁▃▅▇▅▃▁▂▄▆█▆▄▂▁▃▅▇▅▃▁▂▄▆█▆▄▂
├────────────── terpilih ──────────────┤
│saya│rugi│tiga│ratus│juta│gara-gara│satu│keputusan│ini│
      ▲                                        ▲
   masuk 00:12.4                        keluar 00:19.8
```

- Kata di dalam rentang terpilih: latar `--stabilo-kuning`, teks `--grafit-kuat`
- Kata berkeyakinan rendah (`prob < 0.5`): garis bawah putus-putus
  `--bahaya` — tanda mungkin salah dengar
- Klik ganda pada kata → ubah teksnya di tempat (koreksi caption)
- Jeda lebih dari 0.6 detik antar kata: tampilkan celah `⌫ 0.9s` yang bisa
  diklik untuk dibuang

Editor video biasa tidak bisa begini. Tools berbasis teks seperti klipian
justru wajar begini — dan itu keunggulan yang harus terlihat.

**Waveform dan chip kata itu satu alat, bukan dua panel.** Keduanya menempel
langsung — tanpa jarak, tanpa garis pemisah, tanpa elemen apa pun di antaranya.
Lebarnya sama persis dan sumbu waktunya sama, karena waveform menunjukkan
*bentuk* suaranya dan chip menunjukkan *isinya*.

```
▁▃▅▇▅▃▁▂▄▆█▆▄▂▁▃▅▇▅▃▁▂▄▆█▆▄▂▁▃▅▇▅▃▁▂▄▆█▆▄▂    ← menempel
│saya│rugi│tiga│ratus│juta│gara-gara│satu│      ← tidak ada jarak
```

Menaruh waveform di dasar layar dan transkrip jauh di atasnya memutus
hubungan itu, dan menyisakan bidang kertas kosong di tengah.

**Tata letak layar POTONG:** blok gabungan ini menempati **seluruh tinggi**
area kerja. Transkrip mengisi ruang yang tersedia dan bisa digulir; waveform
menempel di bawahnya. Tidak boleh ada kertas kosong menganga.

### 9.2 Kartu klip = guntingan kertas

```
┌──────────────────────────────┐   sudut siku, --bayang-kertas
│ ┌────────┐                   │   latar --kertas
│ │        │  Rugi 300 Juta    │   judul: display-m, --grafit-kuat
│ │  9:16  │  karena Timing    │
│ │ thumb  │                   │
│ │        │  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓   │   ← sapuan stabilo di baris hook
│ └────────┘  "kamu bilang rugi│      teks hook menembus sapuan
│             300 juta..."     │
│                              │
│ 00:12 → 01:07    55d    8.6  │   ← mono, --grafit
│ hook   ▓▓▓▓▓▓▓▓▓░  9         │      bar SELALU berangka
│ utuh   ▓▓▓▓▓▓▓░░░  7         │
│ payoff ▓▓▓▓▓▓▓▓▓░  9         │
└──────────────────────────────┘
```

**Bar skor wajib disertai angka.** Bar abu-abu polos tanpa angka akan terbaca
sebagai skeleton loading, bukan sebagai data — mata membacanya sebagai
"sedang memuat". Bagian terisi memakai `--grafit-kuat`, sisanya
`--kertas-tua`, angka mono di kanan, tinggi bar 4px.

Saat disetujui, **stempel** muncul menimpa kartu:

```css
.cap {
  font-family: var(--font-data);
  font-size: 11px; font-weight: 500;
  letter-spacing: .14em; text-transform: uppercase;
  color: var(--cap-tinta);
  border: 2px solid var(--cap-tinta);
  padding: 4px 10px;
  transform: rotate(-8deg);
  opacity: .82;
}
```

Isinya: `SIAP RENDER`.

**Aturan status kartu — tombol mengikuti status:**

| Status | Tampilan |
|---|---|
| Baru | tombol `Setujui` dan `Tolak`, tanpa stempel |
| Disetujui | stempel `SIAP RENDER`, tombol tinggal `Batalkan` |
| Ditolak | seluruh kartu redup 40%, tombol tinggal `Kembalikan` |

Stempel `SIAP RENDER` dan tombol `Setujui` **tidak boleh muncul bersamaan** —
itu memberi tahu pengguna dua hal yang bertentangan tentang status yang sama.

### 9.3 Kotak reframe

Menarik kotak di atas frame sumber, dengan preview 9:16 langsung di kanan.

```
   Sumber 16:9                      Keluaran 9:16
┌──────────────────────┐           ┌─────────┐
│         ╔══════╗     │           │ facecam │
│         ║      ║     │  ──────►  ├─────────┤
│ ┌────┐  ║ crop ║     │           │gameplay │
│ │face│  ╚══════╝     │           ├─────────┤
│ └────┘               │           │ CAPTION │
└──────────────────────┘           └─────────┘
```

- Pegangan sudut, rasio dikunci ke 9:16 (tahan `Alt` untuk melepas kunci)
- Untuk mode gameplay ada **dua** kotak: gameplay dan facecam
- Facecam dideteksi otomatis dan **ditawarkan** sebagai kotak yang bisa
  digeser, bukan dipaksakan
- Tombol **Simpan preset** dengan nama, misalnya `Cadera — kiri bawah`
- Video berikutnya dari streamer sama dicocokkan otomatis ke preset itu

### 9.4 Studio caption

- Pilihan gaya tersimpan sebagai template
- Preview langsung di panel 9:16, bukan di kotak terpisah
- Yang bisa diatur: font, ukuran, warna highlight kata aktif, posisi
  vertikal, jumlah kata per baris, tebal outline
- **Panduan safe area** per platform ditampilkan sebagai overlay garis
  putus-putus — supaya caption tidak tertutup tombol like dan nama akun

### 9.5 Antrian render

Daftar baris, bukan kartu. Tiap baris: nama klip, layout, durasi, progress
bar tipis, dan waktu tersisa. Selesai → tombol **Buka folder**.

---

## 10. Keadaan kosong, sedang bekerja, dan gagal

**Kosong** — undangan bertindak, bukan gambar sedih.

> **Belum ada video.**
> Tarik file ke sini, atau pilih dari folder.

**Sedang bekerja** — jujur soal waktu, karena bisa 55 menit.

> Transkripsi `cadera-gameplay-mlbb.mp4`
> `████████░░░░░░░░░░` 38%  ·  54:12 dari 2:22:46
> berjalan 21:04 · sisa ~34:10
>
> Bisa ditinggal. Hasilnya disimpan otomatis.

**Gagal** — sebutkan apa yang terjadi dan apa yang harus dilakukan. Jangan
minta maaf, jangan kabur.

> **ffmpeg tidak ditemukan.**
> klipian butuh ffmpeg untuk membaca video. Pasang lalu tambahkan foldernya
> ke PATH. — `Cara memasang`

---

## 11. Gerak

**Satu momen terorkestrasi.** Ketika analisis selesai, sapuan stabilo masuk ke
Ribbon sumber **satu per satu dari kiri ke kanan**, jeda 40ms antar sapuan,
masing-masing melebar dari 0 ke lebar penuh dalam 180ms. Seperti orang menarik
stabilo di atas kertas.

Itu momen bayaran dari 23 menit menunggu. Jangan disia-siakan, dan jangan
disaingi animasi lain.

Selain itu: transisi status 120ms, tidak lebih. Menumpuk efek justru bikin
desain terasa hasil generate.

```css
@media (prefers-reduced-motion: reduce) {
  * { animation: none !important; transition-duration: 1ms !important; }
}
```

---

## 12. Nada tulisan

Bahasa Indonesia sebagai dasar, dengan istilah kerja tetap dalam bahasa
Inggris. Kalimat aktif, tanpa basa-basi. Nama tombol sama persis dengan yang
terjadi setelah diklik.

| Jangan | Pakai |
|---|---|
| Submit | Cari klip |
| Processing... | Transkripsi berjalan |
| Success! ✓ | Selesai — 12 kandidat |
| Are you sure? | Hapus klip ini? |
| Analyze video | Cari klip |
| Export | Render |
| No data available | Belum ada video. Tarik file ke sini. |
| DIALOG GANTI | mode: dialog ▾ |

**Pemilih mode di header** ditulis `mode: dialog ▾` — satu label dengan kata
kunci mode dan panah dropdown. Bukan dua kata bersanding tanpa hubungan yang
jelas, dan bukan tombol berjudul kata kerja.

### Jangan paksakan menerjemahkan

**Aturan:** kalau istilah Inggrisnya yang justru dipakai sehari-hari oleh
clipper Indonesia, **pakai istilah Inggrisnya.** Terjemahan paksa terdengar
kaku dan malah bikin antarmukanya terasa asing — kebalikan dari yang dituju.

Dua kesalahan nyata dari percobaan sebelumnya: label `KOTAK POTONG` untuk
crop box, dan `GELOMBANG · PEAKS DARI BACKEND` yang setengah diterjemahkan.
Tidak ada clipper yang bicara begitu.

**Tetap Inggris** — istilah kerja yang memang dipakai apa adanya:

```
crop        render      preview     timeline    caption
layout      preset      export      thumbnail   hook
facecam     waveform    frame       timecode    safe area
in / out    split       blur        zoom        watermark
hashtag     mode        dialog      gameplay    peaks
```

**Bahasa Indonesia** — kata umum, bukan istilah teknis:

```
setujui     tolak       batalkan    kembalikan  simpan
hapus       cari klip   buka folder klip        kandidat
sumber      durasi      temuan      kata        jeda
terpilih    berjalan    sisa        selesai     antrian
```

**Padanan yang harus dihindari:**

| Jangan | Pakai |
|---|---|
| kotak potong | crop box |
| garis waktu | timeline |
| gelombang suara | waveform |
| tangkapan wajah | facecam |
| tanda air | watermark |
| pratinjau | preview |
| titik masuk / titik keluar | in / out |
| area aman | safe area |
| bingkai | frame |
| keyakinan rendah | mungkin salah dengar |

**Menempelkan kata Indonesia ke istilah Inggris juga terlarang.** Pilih satu:
`WAVEFORM`, bukan `GELOMBANG · PEAKS DARI BACKEND`.

### Nama yang sempat salah, dan pelajarannya

Percobaan sebelumnya memakai **"Papan guntingan"** untuk layar kandidat,
**"Pita Sumber"** untuk ribbon, dan **"Meja"** untuk daftar video. Ketiganya
terdengar puitis di dokumen tapi janggal dipakai — nama layar bukan tempat
menaruh metafora.

Yang dipakai sekarang:

| Dulu | Sekarang | Kenapa |
|---|---|---|
| Papan guntingan | **Kandidat** | sama dengan nama tab; tidak ada istilah baru untuk dihafal |
| Pita Sumber | **Sumber** (label UI), *ribbon sumber* (nama komponen) | "pita" terbaca sebagai pita rambut |
| Meja | **Video** | pengguna mencari videonya, bukan mejanya |
| Keluaran 9:16 | **Preview 9:16** | "preview" sudah dipakai di tempat lain; jangan dua nama untuk satu hal |

**Aturannya:** metafora desain hidup di dokumen ini dan di kepala perancang.
Yang muncul di layar adalah kata yang paling langsung menyebut isinya.

### Tiga aturan tulisan yang mudah terlewat

1. **Satuan konsisten di semua layar.** Kalau layar potong menulis `14.3s`,
   kartu dan antrian tidak boleh menulis `14d`. Pilih satu, pakai di mana-mana.
2. **Keterangan jangan mengulang judul.** Judul `Video` dengan keterangan
   `3 video` membuang satu baris. Tulis `3 file · 1 sedang diproses`.
3. **Satu data, satu kebenaran.** Kalau topbar menyebut file A, layar analisis
   tidak boleh menampilkan progress file B. Pengguna akan membaca dua kebenaran
   tentang hal yang sama dan berhenti percaya pada keduanya.

---

## 13. Alur layar

```
1  MEJA        daftar video, tarik file baru, status tiap video
      ↓
2  ANALISIS    progress transkripsi → progress pemilihan klip
      ↓
3  KANDIDAT    kartu klip: setujui / tolak
      ↓
4  EDITOR      potong · reframe · caption   (tiga tab, panel 9:16 tetap)
      ↓
5  ANTRIAN     render berjalan → buka folder
```

Ribbon sumber hadir di layar 2 sampai 4. Panel 9:16 hadir di layar 3 dan 4.

---

## 14. Aksesibilitas

- Fokus keyboard terlihat jelas: `outline: 2px solid var(--stabilo-kuning);
  outline-offset: 2px`
- Kontras teks minimum 4.5:1 — sudah terpenuhi oleh `--grafit-kuat` di atas
  `--kertas` dan `--ink-teks-kuat` di atas `--ink`
- Warna tidak pernah jadi satu-satunya penanda: mode punya label teks, skor
  punya angka, status punya tulisan pada stempel
- Pintasan keyboard di editor: `Space` putar/jeda, `←/→` geser satu frame,
  `I` in, `O` out, `Enter` setujui

---

## 15. Stack

| Bagian | Pilihan |
|---|---|
| Framework | React 19 + Vite |
| Styling | CSS Modules + custom properties — **bukan** Tailwind, **bukan** shadcn |
| State | Zustand |
| Komponen | dibuat sendiri, sekitar 12 buah, tanpa component library |
| Waveform | canvas; peaks dihitung di backend Python, dikirim sebagai JSON |
| Video | `<video>` + HTTP range dari FastAPI |
| Progress | Server-Sent Events |

**Kenapa bukan Tailwind + shadcn:** justru kombinasi itu yang menghasilkan
tampilan seragam yang ditolak di bagian 3. Bukan karena Tailwind jelek, tapi
gravitasi default-nya terlalu kuat. Sistem token buatan sendiri memberi kendali
penuh, dan jumlah CSS untuk aplikasi sebesar ini masih kecil.

**Waveform jangan dihitung di browser.** Video 2 jam 22 menit tidak boleh
di-decode di sisi klien. Backend menghitung peaks sekali lalu menyimpannya
bersama transkrip.

---

## 16. Kalau dokumen ini dipakai sebagai brief

Yang paling berharga untuk dilihat lebih dulu, berurutan:

1. **Layar KANDIDAT** — papan kandidat dengan Ribbon sumber di atasnya.
   Ini wajah aplikasinya.
2. **Layar EDITOR, tab potong** — transkrip-sebagai-timeline, dengan waveform
   menempel di bawahnya. Ini interaksi yang paling menentukan.
3. **Layar EDITOR, tab reframe — mode `gameplay`, DUA kotak.** Gameplay dan
   facecam sekaligus, dengan preview bertumpuk di panel 9:16.

   Yang dites harus **gameplay**, bukan dialog. Satu kotak crop di video
   podcast tidak ada yang meragukan; kasus sulitnya adalah dua kotak yang
   dipetakan ke dua bidang berbeda dalam satu frame vertikal. Itu yang
   perlu dilihat lebih dulu.

   ```
     Sumber 16:9                    Keluaran 9:16
   ┌──────────────────────┐         ┌─────────┐
   │         ╔══════╗     │         │ facecam │ ← dari kotak 2
   │         ║kotak1║     │  ────►  ├─────────┤
   │ ╔════╗  ║gamepl║     │         │gameplay │ ← dari kotak 1
   │ ║ktk2║  ╚══════╝     │         ├─────────┤
   │ ╚════╝               │         │ CAPTION │
   └──────────────────────┘         └─────────┘
   ```

Ketiganya memakai token di bagian 4-6 tanpa kecuali. Kalau ada kebutuhan
warna atau ukuran baru, sebutkan dulu pekerjaannya.

Satu risiko yang diambil sadar: **kertas terang di dalam editor gelap**
melawan konvensi aplikasi video. Alasannya kuat — transkrip adalah permukaan
baca utama, dan membaca teks panjang di latar gelap lebih melelahkan. Kalau
saat dibangun terasa menyilaukan, ini bagian pertama yang ditinjau ulang,
bukan palet stabilonya.

### Periksa sebelum menyatakan selesai

Jalankan ulang delapan aturan di bagian 3.2 terhadap hasilnya:

- [ ] Panel 9:16 satu frame, caption overlay di dalamnya
- [ ] Tebal sapuan stabilo bervariasi mengikuti skor
- [ ] Waveform menempel langsung ke chip kata
- [ ] Setiap bar skor punya angka
- [ ] Label waktu ribbon: kiri dan kanan, tidak menumpuk
- [ ] Tombol kartu berubah setelah disetujui atau ditolak
- [ ] Jumlah temuan cocok dengan jumlah kartu, durasi cocok antar layar
- [ ] Tidak ada elemen yang tidak dijelaskan dokumen ini
- [ ] Tidak ada bidang kertas kosong menganga
- [ ] Tidak ada istilah kerja yang diterjemahkan paksa ke bahasa Indonesia
