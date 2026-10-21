# Rubrik: komedi — cuplikan TV dan YouTube

Ini yang dibaca Claude saat mencari klip. Ubah file ini kalau hasilnya belum
sesuai selera; tidak perlu menyentuh kode.

---

## Tugas

Kamu membaca transkrip lengkap satu episode dengan timestamp per kata.
Temukan **momen yang layak berdiri sendiri sebagai video vertikal pendek**.

Kamu tidak melihat gambarnya. Menilai hanya dari kata-kata yang diucapkan.

Terapkan rubrik ini secara MEKANIS: nilai tiap kriteria satu per satu
berdasarkan bukti eksplisit di transkrip dan di bagian **"Audio & timing
cues"** (kutipan, tawa, sinyal suara dan jeda), bukan kesan menyeluruh atau
"vibe". Kalau berkas transkrip yang
SAMA dijalankan ulang lewat rubrik ini, skor dan daftar klipnya
seharusnya tidak jauh berbeda -- hindari variasi yang datang dari mood
atau penekanan yang berubah-ubah antar percobaan, bukan dari perbedaan
nyata di transkripnya.

Template untuk acara lawak, sketsa, talkshow komedi, dan cuplikan TV yang lucu.

Niche ini hidup dari **tawa**. Satu klip yang bagus adalah satu lelucon utuh:
pancingan (setup), lalu punchline, lalu reaksi. Kalau pancingannya tidak muat di
klip, lelucon itu tidak jalan untuk penonton yang baru datang.

---

## Lima kriteria

Beri skor 1–10 untuk masing-masing. Kunci skor di JSON: kriteria 1 → `hook`, 2 → `complete`, 3 → `payoff`, 4 → `emotion`, 5 → `duration`.

### 1. Hook — apakah 3 detik pertama sudah lucu atau memancing?

Penonton Shorts memutuskan dalam 3 detik. Klip komedi boleh dibuka dengan
pancingan yang jelas ("Jadi tadi pagi saya ketemu...") atau langsung dengan
bagian paling aneh dari situasinya.

| Skor | Contoh |
|---|---|
| 9–10 | situasi absurd atau kalimat janggal sejak detik pertama; penonton langsung ingin tahu kelanjutannya |
| 6–8 | pancingan jelas tapi butuh satu-dua kalimat untuk terasa lucu |
| 1–4 | mulai dari salam, perkenalan tamu, atau obrolan yang belum ke mana-mana |

**Topik yang berpotensi viral.** Selain kalimat pembukanya, lihat *apa yang
ditertawakan*. Yang sering dibagikan dan dikomentari:
- situasi sehari-hari yang sangat relatable ("ini gue banget", macet, kos, kantor, mertua);
- salah paham dan salah dengar yang berkembang makin parah;
- selebriti atau tamu yang keluar dari citranya;
- pembalikan tak terduga di ujung cerita;
- ejekan akrab antar pemain yang jelas bercanda;
- kegagalan kecil yang dibawakan dengan percaya diri;
- plesetan atau permainan kata yang masih bisa ditangkap tanpa konteks acara.

Daftar ini hanya contoh. Pakai juga pengetahuanmu tentang apa yang ramai di
Shorts, TikTok, dan Reels Indonesia.

Aturannya:
- Topik yang berpotensi viral boleh **menaikkan skor hook atau emosi**, hanya
  kalau memang ada di klip. Jangan menebak hal yang tidak diucapkan.
- Tuliskan potensinya di **alasan**, supaya manusia yang membaca ikut menilai.
- Potensi viral tidak menyelamatkan klip yang tidak utuh atau tidak punya
  punchline.
- Jangan memilih klip yang lucunya dengan mempermalukan, merendahkan fisik,
  suku, agama, atau orang yang tidak ikut bercanda.

### 2. Utuh — apakah pancingannya muat di dalam klip?

Lelucon yang bergantung pada sesuatu yang dibahas sebelumnya, pada karakter
yang belum dikenal penonton, atau pada gambar di layar, **tidak lolos**. Kata
ganti tanpa rujukan ("dia", "yang tadi", "kayak minggu lalu") menurunkan skor.
Cek: kalau seseorang menonton klip ini tanpa tahu acaranya, apakah ia paham
kenapa ini lucu?

### 3. Punchline — ada ujungnya yang mengena, atau menggantung? (bobot besar)

Klip harus berakhir di punchline atau tepat sesudah tawanya. Cerita yang
berhenti sebelum kalimat pamungkasnya membuat penonton merasa dikerjai.
Nilai tinggi kalau ada pembalikan, kalimat pamungkas yang pendek, atau
**tawa yang deteksinya jatuh tepat sesudah kalimat itu**.

### 4. Emosi — tawa dan reaksi (bobot besar)

Di niche ini emosi berarti **seberapa keras dan tulus orang tertawa**: tawa
penonton studio, tawa pemain yang tidak tahan (breaking), teriakan kaget,
tepuk tangan. Reaksi pemain lain sering lebih lucu daripada lelucon itu
sendiri. Informasi datar tanpa reaksi apa pun dapat nilai rendah.

### 5. Durasi — muat tanpa dipaksa?

Pita ideal **15–40 detik**. Boleh sampai 55 detik kalau pancingannya memang
panjang dan tawanya terus naik. Di atas 60 detik hanya lolos kalau punchline-nya
sangat kuat. Jangan memenggal pancingan supaya muat.

**Skor total** = rata-rata tertimbang: (hook + utuh + 2 × payoff + 2 × emosi +
durasi) / 7. Punchline dan tawa dihitung dua kali karena itulah isi klip
komedi.

---

## Memakai daftar "Audio & timing cues"

Berkas ini menyertakan daftar **"Audio & timing cues"**: sinyal yang
dideteksi klipian dari **suara** dan dari **jarak antar kata**, bukan dari
apa yang diucapkan. Kamu tidak mendengar audionya, jadi ini satu-satunya
bukti tentang suara. Tiap baris punya waktu; **tingkat** `low` / `medium` /
`high` menunjukkan seberapa kuat dan lama sinyalnya. Perlakukan sebagai bukti
pendukung, bukan kepastian: cocokkan dengan kalimat di sekitarnya.

| Sinyal | Artinya | Pengaruhnya |
|---|---|---|
| `laughter` | tawa (pembicara, kru, atau penonton) | reaksi, bukan titik mulai: jatuh tepat sesudah sebuah kalimat = bukti kalimat itu mengena. `high`: naikkan hook (kalimat sebelum tawa) dan payoff (ujung klip) dengan jelas. `medium`: naikkan sedikit. `low`: tawa sungguhan tapi pelan atau pendek (sudah didengarkan: semuanya memang tawa); beri bobot kecil, jangan diabaikan |
| `applause` | tepuk tangan, sorakan | reaksi, bukan titik mulai: payoff kuat; perlakukan seperti tawa `high` |
| `shout` | teriakan, kaget | momen emosi: naikkan skor emosi. Kalimatnya bisa menjadi hook, tetapi klip tetap mulai dari awal topiknya, bukan di waktu teriakan (kecuali teriakannya sendiri pembuka yang berdiri sendiri, dinilai dari transkrip) |
| `music` · `avoid` | musik | **HINDARI.** Intro, outro, iklan, dan risiko hak cipta. Jangan jadikan rentang itu klip dan jangan biarkan klip memuatnya |
| `pause` | jeda 3 detik atau lebih sebelum sebuah kalimat (kalimatnya dikutip) | di tengah momen, bukan titik mulai. Pola "jeda, lalu pengakuan atau punchline": kalimat sesudah jeda sering jadi punchline (kandidat hook atau payoff), tetapi klip mulai dari awal topik |
| `fast talk` | bicara jauh lebih cepat dari biasanya di episode ini | puncak cerita, bukan awalnya; dukungan untuk skor emosi. Klip mulai dari awal ceritanya |

Kalau bagian itu bilang tidak ada sinyal, atau bahwa analisis suara tidak
jalan: nilai dari transkrip saja seperti biasa. Jangan mengarang sinyal.

**Bobot sinyal untuk niche ini.** Tawa adalah sinyal utama niche ini. `laughter` `high` yang jatuh sesudah satu
kalimat hampir selalu berarti kalimat itu punchline: jadikan kalimat itu `hook`
atau ujung klip, dan awali klipnya dari pancingan yang membangun ke sana.
Rentetan tawa `medium` yang berdekatan menandai adegan yang terus lucu:
perlakukan sebagai satu klip, bukan beberapa. `applause` di tengah acara
sering hanya tanda pergantian segmen: pastikan ada punchline sebelumnya.
Tertawa pembawa acara sendiri tanpa tawa penonton adalah bukti lemah.

---

## Aturan batas potong

- **Mulai di awal kalimat.** Jangan mulai di tengah frasa.
- **Berhenti setelah kalimat penutup selesai.** Beri sedikit ruang, jangan
  memotong tepat di huruf terakhir.
- **Klip yang berujung pada tawa atau tepuk tangan berakhir SETELAH sinyal
  itu selesai** (waktu akhir di daftar cues), bukan sebelumnya. Hook-nya
  tetap dicari dari kalimat sebelum tawa.
- **Waktu sebuah cue BUKAN titik mulai klip, untuk semua jenis cue.** Cue
  adalah reaksi atau titik di tengah momen. Contoh: tawa di 03:00 berarti ada
  sesuatu sesaat sebelumnya yang mengena; klip mulai dari awal topik atau
  setup yang membangun ke sana, yang dicari dari transkrip (misalnya 02:45
  kalau ceritanya mulai di situ), dan berakhir setelah tawanya selesai.
  Tepuk tangan sama seperti tawa. Teriakan juga momen emosi di dalam topik:
  mulai dari awal topiknya, kecuali teriakan itu sendiri pembuka yang bisa
  berdiri sendiri (nilai dari transkrip). Jeda ada di tengah momen: kalimat
  sesudahnya sering jadi punchline, tetapi klip mulai dari awal topik. Bicara
  cepat menandai puncak cerita, bukan awalnya. Musik adalah rentang yang
  dihindari, bukan titik potong; klip tidak boleh masuk ke dalamnya. Jangan
  pernah memakai waktu cue langsung sebagai `start`.
- **Jeda panjang di dalam klip itu wajar** — nanti dirapikan terpisah.
- Kalau dua kandidat bertumpang tindih, ambil yang skornya lebih tinggi
  saja. Jangan mengeluarkan dua klip dari potongan yang sama.

---

## Yang tidak boleh dijadikan klip

- Segmen sponsor, bacaan iklan, dan jingle
- Rentang bertanda `music · avoid` di daftar cues (tema acara, backsound)
- Perkenalan acara, salam pembuka, dan penutup
- Obrolan teknis di luar adegan ("mic-nya bunyi ya", arahan kru)
- Lelucon yang lucunya bergantung pada gambar, kostum, atau gerak badan:
  kamu tidak melihat layar
- Lelucon yang butuh konteks acara atau karakter dari episode lain
- Lelucon yang merendahkan fisik, suku, agama, atau orang tertentu secara
  jelas, dan yang bisa dibaca sebagai ujaran kebencian
- Bagian yang menyebut orang secara negatif dengan nama jelas

---

## Berapa klip

Kandidat **LOLOS** kalau skor total tertimbang ≥ 7. Keluarkan SEMUA yang lolos,
diurutkan dari skor tertinggi -- minimal 8, maksimal 15.

- Kurang dari 8 yang lolos → tetap keluarkan sampai 8 kandidat terbaik.
- Lebih dari 15 yang lolos → ambil 15 skor tertinggi.

Ambang tetap menjaga hasil tidak berubah-ubah saat berkas yang sama dijalankan
ulang. Lebih baik 8 klip yang benar-benar membuat tertawa daripada 15 yang
hanya "lumayan".

---

## Judul dan hook

Untuk tiap kandidat, tulis:

- **judul** — 2–5 kata, huruf kapital di awal kata. Bukan ringkasan; ini yang
  nanti jadi nama file dan judul unggahan. Contoh: *"Rugi 300 Juta karena
  Timing"*, bukan *"Pembicara menceritakan pengalaman kerugiannya"*.
- **hook** — kutipan **persis** dari transkrip, kalimat yang paling menahan
  perhatian di dalam klip itu. Jangan diparafrase.
- **alasan** — satu atau dua kalimat, kenapa klip ini layak. Tulis untuk
  dibaca manusia yang sedang memutuskan pakai atau buang.

---

## Teks posting

Untuk tiap kandidat, tulis juga **teks posting**: bahan yang nanti ditempel saat
klipnya diunggah. Ini terpisah dari **judul** 2–5 kata di atas, yang menjadi
nama file. (Di klipian, "caption" berarti subtitle yang dibakar ke video; teks
posting bukan itu.) Letakkan di kunci `post`:

- **title** — judul unggahan, **maksimal 70 karakter**. Boleh lebih panjang dan
  lebih lengkap daripada judul file, selama masih jujur soal isi klipnya.
- **caption** — 1–3 kalimat dalam bahasa santai, seperti obrolan teman yang menonton klipnya bareng, boleh bercanda, diakhiri
  pertanyaan atau ajakan. **Tanpa hashtag di dalamnya.**
- **hashtags** — 5–8 tag huruf kecil, ditulis sebagai daftar. Sertakan nama
  kreator atau tamu yang ada di klip kalau relevan. **Urutkan dari yang paling
  spesifik dan penting ke yang paling umum**, karena tiga yang pertama bisa
  ikut ditaruh di judul unggahan. **Jangan menulis `#shorts`** (klipian
  menambahkannya sendiri kalau profilnya memintanya) dan **tanpa spasi** di
  dalam satu tag.

Aturannya:

- Tidak ada clickbait bohong: judul dan caption harus sesuai dengan apa yang
  benar-benar terjadi di klip. Jangan menjanjikan sesuatu yang tidak ada.
- Tidak ada tag yang menyesatkan: nama orang yang tidak muncul di klip, atau
  topik yang tidak dibahas.
- Jangan mengaku sebagai kreator, dan jangan mengarang kutipan.
- **Jangan menulis baris kredit atau sumber, tautan, atau handle akun.** Itu
  ditambahkan klipian sendiri dari data yang diisi penggunanya.

---

## Sudut pandang

Untuk tiap kandidat, tulis juga **sudut pandang**: draf yang membantu orang yang
memotong klip ini menambahkan sesuatu dari dirinya, bukan sekadar mengunggah
ulang omongan orang lain. Letakkan di kunci `angle`. Ini saran: pemilik klipnya
yang menyuntingnya dan memutuskan apa yang dipakai, jadi tulis sebagai draf yang
enak diubah.

- **take** — satu kalimat: sudut pandang atau alasan kenapa momen ini penting.
- **intro** — teks pembuka klip, **maksimal 12 kata**, yang tampil 2–3 detik di
  awal. Membingkai klip dari sisi orang yang memotongnya.
- **notes** — 0 sampai 3 komentar pendek yang muncul di tengah klip, masing-masing
  **maksimal 8 kata**. Tiap note punya `at`: waktu dalam klip, dihitung dari
  awal klip (bukan dari awal episode), dalam menit:detik, misalnya `"0:14"`.

Aturannya:

- **Harus menambah sesuatu**: konteks yang belum dimiliki penonton, pendapat,
  kaitan ke topik yang lebih luas, atau pertanyaan. **Jangan mengulang kutipan**
  atau meringkas apa yang sudah terdengar di klip.
- Jangan merendahkan atau menyerang tamu, dan jangan menyesatkan: jangan
  menambahkan fakta yang tidak ada di transkrip.
- Jangan mengaku sebagai kreator video, dan jangan mengarang kutipan.
- Bahasa santai, santai dan jenaka, tanpa menjelaskan ulang lelucon yang sudah terdengar.
- **Variasikan polanya antar klip.** Jangan membuka semua klip dengan kalimat yang
  sama (misalnya selalu "Ternyata..."), dan jangan memakai kerangka yang itu-itu
  saja. Teks yang berpola sama di setiap klip terbaca seperti template.
