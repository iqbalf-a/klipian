# Rubrik: gameplay — Mobile Legends

Berbeda mendasar dari rubrik dialog. Di sini momen ditemukan dari **kejadian
di dalam game**, bukan dari gagasan yang diucapkan.

Kuncinya: announcer MLBB berbahasa Inggris dan sangat konsisten, jadi
Whisper menuliskannya sebagai teks biasa lengkap dengan timestamp. Tidak
perlu computer vision, tidak perlu membaca killfeed.

---

## Tahap 1 — cari jangkar dari suara announcer

Setiap kemunculan kata kunci di bawah adalah **jangkar**: titik pasti bahwa
sesuatu terjadi.

| Kata kunci announcer | Bobot |
|---|---|
| Savage | 10 |
| Maniac | 9 |
| Legendary | 8 |
| Triple Kill | 7 |
| Double Kill | 5 |
| First Blood | 5 |
| Aced | 8 |
| Shutdown | 4 |

Kata kunci lain yang sering muncul dan layak dijadikan jangkar lemah:
`Lord`, `Turtle`, `destroyed`, `has been slain`.

**Catatan penting:** Whisper kadang salah dengar. `Savage` bisa jadi
`salvage`, `Maniac` jadi `manic`, `Aced` jadi `ace`. Terima variasi ini.

---

## Tahap 2 — perluas jangkar jadi klip

```
                    jangkar
                       │
   ── build-up ──►     ▼     ◄── reaksi ──
   8 detik sebelum  Savage   6 detik sesudah
   └──────────────────────────────────────┘
                  klip ~14 detik
```

- **Build-up 6–10 detik sebelum jangkar** — penonton perlu melihat
  situasinya genting sebelum kejadiannya. Tanpa ini, Savage cuma terasa
  seperti angka yang muncul.
- **Reaksi 4–8 detik sesudah** — teriakan streamer itu setengah dari nilai
  klipnya. Potong setelah reaksinya reda, jangan di tengah teriakan.

Kalau ada dua jangkar berjarak kurang dari 12 detik, gabungkan jadi satu
klip. Jangan keluarkan dua klip yang bertumpang tindih.

---

## Tahap 3 — nilai kandidatnya

### 1. Hook (bobot terbesar)

Untuk gameplay, hook bukan kalimat — melainkan **seberapa cepat aksinya
mulai**. Klip yang tiga detik pertamanya masih menunggu itu gagal.

Skor tinggi kalau jangkarnya kuat (Savage, Maniac) dan build-up-nya sudah
tegang sejak detik pertama.

### 2. Utuh

Bisa dimengerti tanpa tahu jalannya pertandingan? Comeback dari
ketertinggalan jauh butuh konteks yang tidak selalu terbaca dalam 20 detik —
turunkan skornya kalau begitu.

### 3. Payoff

Ada penutup yang jelas: musuh tumbang, objektif diambil, streamer bereaksi.
Klip yang berhenti saat keadaan masih menggantung dapat nilai rendah.

### 4. Reaksi streamer

Khas mode ini, menggantikan kriteria "emosi". Teriakan, tawa, umpatan,
atau diam yang tiba-tiba — semuanya menambah nilai. Aksi hebat tanpa reaksi
apa pun terasa datar.

Nilai dari transkrip suara streamer di sekitar jangkar.

### 5. Durasi

Pita ideal **15–25 detik**. Terima 10–35 detik.

Jauh lebih pendek daripada dialog, dan itu memang seharusnya: satu Savage
tidak butuh konteks panjang. Di atas 45 detik hampir selalu berarti ada
bagian menunggu yang harusnya dibuang.

**Skor total** = rata-rata kelima kriteria.

---

## Yang tidak boleh dijadikan klip

- Layar pemilihan hero, layar hasil, dan lobi
- Bacaan donasi dan sapaan penonton, kecuali kebetulan berbarengan dengan aksi
- Momen di menit-menit awal yang belum ada taruhannya, walau ada Double Kill
- Bagian di mana streamer menyebut pemain lain secara kasar dengan nama jelas

---

## Berapa klip

Keluarkan **10–20 kandidat** untuk siaran 2 jam ke atas, diurutkan dari skor
tertinggi. Siaran panjang biasanya punya banyak momen layak — tapi tetap
jangan memaksa mengisi kuota.

---

## Judul dan hook

- **judul** — 2–5 kata, menyebut kejadiannya. Contoh: *"Savage Menit 41, Nol
  Retreat"*, bukan *"Momen bagus dari streamer"*.
- **hook** — kutipan persis dari transkrip di sekitar jangkar. Boleh berupa
  suara announcer (*"savage!"*) atau reaksi streamer (*"nol retreat bro"*).
- **alasan** — satu atau dua kalimat, kenapa klip ini layak.
