# Rubrik: gaming — momen permainan dan reaksi

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

Template untuk siaran dan rekaman gameplay umum (tidak khusus satu game). Untuk Mobile Legends dengan kata kunci announcer, pakai rubrik gameplay bawaan.

Niche ini menemukan momen dari **kejadian di dalam game dan reaksi pemainnya**,
bukan dari gagasan yang diucapkan. Kamu tidak melihat layar: bukti satu-satunya
adalah suara announcer atau game (kalau ada), komentar pemain, dan sinyal di
daftar cues.

---

## Lima kriteria

Beri skor 1–10 untuk masing-masing. Kunci skor di JSON: kriteria 1 → `hook`, 2 → `complete`, 3 → `payoff`, 4 → `emotion`, 5 → `duration`.

Cari dulu **jangkar**: titik yang pasti ada kejadian. Contohnya announcer atau
game menyebut kill streak, "clutch", "ace", "wipe", "headshot", "victory";
atau pemain berteriak, tertawa, mengumpat, atau tiba-tiba diam. Whisper sering
salah dengar nama istilah game: terima variasinya. Lalu perluas jangkar:
**6–10 detik build-up** sebelumnya dan **4–8 detik reaksi** sesudahnya.
Jangkar yang berjarak kurang dari 12 detik digabung menjadi satu klip.

### 1. Hook — seberapa cepat aksinya mulai?

Untuk gameplay hook bukan kalimat, melainkan **seberapa cepat tegangnya mulai**.
Klip yang tiga detik pertamanya masih menunggu gagal.

| Skor | Contoh |
|---|---|
| 9–10 | situasi genting atau aksi sejak detik pertama; jangkar kuat (wipe, clutch 1 lawan banyak, kill streak besar) |
| 6–8 | build-up wajar, tegang mulai di detik 3–5 |
| 1–4 | jalan kaki, loading, menu, atau pemain menjelaskan hal lain dulu |

**Topik yang berpotensi viral.** Yang sering dibagikan di komunitas gaming:
- clutch menang dari posisi hampir mustahil;
- kegagalan konyol (fail) yang diceritakan dengan tawa;
- kill streak besar dan momen langka;
- bug atau kejadian aneh yang tidak terduga;
- reaksi berlebihan pemain (rage, panik, tertawa tidak tahan);
- komentar atau ejekan lucu antar teman satu tim;
- momen "hampir" yang berakhir pecah tawa.

Daftar ini hanya contoh. Pakai juga pengetahuanmu tentang apa yang ramai di
Shorts, TikTok, dan Reels Indonesia.

Aturannya:
- Topik yang berpotensi viral boleh **menaikkan skor hook atau emosi**, hanya
  kalau ada bukti di transkrip atau cues.
- Tuliskan potensinya di **alasan**.
- Potensi viral tidak menyelamatkan klip yang tidak utuh atau tanpa penutup.
- Jangan memilih klip yang isinya hinaan kasar terhadap pemain lain dengan
  nama jelas.

### 2. Utuh — bisa dimengerti tanpa tahu jalannya pertandingan?

Comeback dari ketertinggalan jauh atau momen yang butuh tahu skor dan posisi
tidak selalu terbaca dalam 20 detik: turunkan skornya kalau begitu. Klip yang
jelas "siapa melawan siapa dan apa taruhannya" dari ucapan pemain sendiri
dapat nilai tinggi.

### 3. Payoff — ada penutup yang jelas?

Musuh tumbang, objektif diambil, pemain mati dengan gaya, atau fail yang
sempurna. Klip yang berhenti saat keadaan masih menggantung dapat nilai
rendah.

### 4. Emosi — reaksi pemain (bobot besar)

Teriakan, tawa, umpatan, atau diam yang tiba-tiba menambah nilai: reaksi
pemain adalah setengah dari nilai klip gaming. Aksi hebat tanpa reaksi apa
pun terasa datar. Nilai dari komentar pemain di sekitar jangkar dan dari cues
`shout` dan `laughter`.

### 5. Durasi — muat tanpa dipaksa?

Pita ideal **15–30 detik**. Terima 10–45 detik. Di atas 50 detik hampir selalu
berarti ada bagian menunggu yang seharusnya dibuang.

**Skor total** = rata-rata tertimbang: (2 × hook + utuh + payoff + 2 × emosi +
durasi) / 7.

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

**Bobot sinyal untuk niche ini.** Untuk gaming, `shout` dan `laughter` adalah bukti kuat reaksi pemain:
`shout` `high` di sekitar jangkar menaikkan skor emosi dengan jelas. Klipnya
tetap mulai dari build-up, bukan dari waktu teriakan. `pause` panjang di tengah
siaran sering berarti pemain menunggu atau menonton: bukan momen. `music ·
avoid` sering berarti lobi, menu, atau musik latar yang berisiko hak cipta:
jangan masuk ke rentang itu. Suara game yang keras bisa terdeteksi sebagai
`shout`: cocokkan dengan komentar pemain.

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

- Layar pemilihan karakter, loading, hasil pertandingan, dan lobi
- Bacaan donasi dan sapaan penonton, kecuali kebetulan berbarengan dengan aksi
- Momen awal permainan yang belum ada taruhannya
- Rentang bertanda `music · avoid`
- Momen yang lucunya atau hebatnya hanya terlihat di layar tanpa ada ucapan
  atau suara yang menandainya: kamu tidak melihatnya
- Bagian di mana pemain menyebut pemain lain secara kasar dengan nama jelas

---

## Berapa klip

Kandidat **LOLOS** kalau skor total tertimbang ≥ 7. Keluarkan SEMUA yang lolos,
diurutkan dari skor tertinggi -- minimal 8, maksimal 20 untuk siaran dua jam ke
atas (maksimal 12 untuk yang lebih pendek).

- Kurang dari 8 yang lolos → tetap keluarkan sampai 8 kandidat terbaik.
- Lebih dari batas atas → ambil yang skornya tertinggi.

Jangan memaksa mengisi kuota, dan jangan mengeluarkan dua klip yang
bertumpang tindih.

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
- **caption** — 1–3 kalimat dalam bahasa santai, santai dan seru, seperti pemain yang menceritakan momennya ke teman satu tim, diakhiri
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
- Bahasa santai, santai dan seru, seperti sesama gamer.
- **Variasikan polanya antar klip.** Jangan membuka semua klip dengan kalimat yang
  sama (misalnya selalu "Ternyata..."), dan jangan memakai kerangka yang itu-itu
  saja. Teks yang berpola sama di setiap klip terbaca seperti template.
