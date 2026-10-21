# Rubrik: motivasi — cerita, pelajaran hidup, dan kutipan

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

Template untuk ceramah motivasi, cerita perjuangan, dan nasihat hidup.

Niche ini hidup dari **cerita yang tulus dan satu kalimat yang layak dikutip**.
Satu klip yang bagus membawa penonton dari satu keadaan ke keadaan lain
(jatuh → bangkit, ragu → yakin) dan berakhir di kalimat yang ingin mereka
simpan. Kalimat inspirasi yang kosong dan klise tidak berguna: nilai dari
isi yang ada di transkrip, bukan dari nadanya.

---

## Lima kriteria

Beri skor 1–10 untuk masing-masing. Kunci skor di JSON: kriteria 1 → `hook`, 2 → `complete`, 3 → `payoff`, 4 → `emotion`, 5 → `duration`.

### 1. Hook — apakah 3 detik pertama menahan orang?

| Skor | Contoh |
|---|---|
| 9–10 | pengakuan jujur, titik terendah, atau kalimat tajam — *"Saya pernah tidur di terminal karena tidak punya uang kos"* |
| 6–8 | pernyataan yang menarik tapi butuh satu kalimat untuk terasa |
| 1–4 | salam, "teman-teman sekalian", pembukaan umum tanpa isi |

**Topik yang berpotensi viral.** Yang sering dibagikan dan disimpan:
- kegagalan dan titik terendah yang diceritakan tanpa dramatisasi;
- uang, keluarga, dan pengorbanan orang tua;
- titik balik: satu kejadian yang mengubah arah hidup;
- nasihat yang berlawanan dengan arus ("berhenti membandingkan dirimu");
- kutipan pendek yang bisa dijadikan caption orang lain;
- pengalaman yang sangat relatable (capek, takut gagal, merasa tertinggal);
- kerja keras yang nyata dengan angka dan waktu yang jelas.

Daftar ini hanya contoh. Pakai juga pengetahuanmu tentang apa yang ramai di
Shorts, TikTok, dan Reels Indonesia.

Aturannya:
- Topik yang berpotensi viral boleh **menaikkan skor hook atau emosi**, hanya
  kalau memang diucapkan di klip.
- Tuliskan potensinya di **alasan**.
- Potensi viral tidak menyelamatkan klip yang tidak utuh atau tanpa penutup.
- **Jangan memilih inspirasi palsu**: janji kaya cepat, "pasti berhasil kalau
  percaya", atau klaim yang tidak didukung ceritanya. Klip yang jujur soal
  proses dan harga yang dibayar lebih baik daripada yang hanya menjual
  semangat.

### 2. Utuh — bisa dimengerti tanpa nonton ceramahnya?

Cerita harus punya awal, tengah, dan akhir di dalam klip: siapa, apa yang
terjadi, apa akibatnya. Rujukan ke bagian sebelumnya (*"seperti yang tadi
saya ceritakan"*) menurunkan skor.

### 3. Payoff — ada kalimat penutup yang mengendap?

Nilai tinggi kalau klip berakhir di **satu kalimat yang layak dikutip**:
pendek, konkret, dan lahir dari cerita di klip itu, bukan slogan yang
ditempelkan. Cerita yang berhenti sebelum pelajarannya keluar dapat nilai
rendah.

### 4. Emosi — apakah menggerakkan sesuatu? (bobot besar)

Haru, tersentuh, tersentil, lega, bangkit. Tanda di transkrip: suara
bergetar atau jeda panjang sebelum satu kalimat (cues `pause`), tawa getir,
tepuk tangan sesudah satu kalimat, pengakuan yang belum pernah diceritakan.
Nasihat yang benar tapi datar tanpa cerita dapat nilai rendah.

### 5. Durasi — muat tanpa dipaksa?

Pita ideal **35–55 detik**: cerita butuh ruang. Boleh 25–75 detik. Jangan
memotong cerita di tengah supaya muat; lebih baik skor durasi rendah daripada
klip yang kehilangan titik baliknya.

**Skor total** = rata-rata tertimbang: (hook + utuh + payoff + 2 × emosi +
durasi) / 6.

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

**Bobot sinyal untuk niche ini.** `pause` adalah sinyal penting di niche ini: jeda panjang sebelum satu kalimat
sering berarti pengakuan atau kalimat yang paling bermakna (kandidat hook atau
payoff), tetapi klip tetap mulai dari awal ceritanya. `applause` sesudah satu
kalimat berarti kalimat itu mengena: jadikan kandidat penutup dan akhiri klip
sesudah tepuk tangannya selesai. `shout` yang bernada semangat bukan tanda
emosi sedih: baca dari kalimat di sekitarnya. `music · avoid` (musik latar
atau lagu pengiring ceramah) dihindari karena hak cipta.

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

- Segmen sponsor, penjualan kursus atau buku, dan ajakan daftar
- Rentang bertanda `music · avoid` di daftar cues
- Perkenalan, salam panjang, dan doa pembuka atau penutup
- Obrolan teknis di luar materi
- Janji hasil yang tidak masuk akal (kaya cepat, sembuh pasti) dan klaim yang
  menyesatkan
- Cerita tentang orang lain yang membuka aib atau data pribadi yang jelas
- Bagian yang menyebut orang secara negatif dengan nama jelas

---

## Berapa klip

Kandidat **LOLOS** kalau skor total tertimbang ≥ 7. Keluarkan SEMUA yang lolos,
diurutkan dari skor tertinggi -- minimal 6, maksimal 12.

- Kurang dari 6 yang lolos → tetap keluarkan sampai 6 kandidat terbaik.
- Lebih dari 12 yang lolos → ambil 12 skor tertinggi.

Lebih baik beberapa klip yang benar-benar menyentuh daripada banyak klip
bernada sama.

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
- **caption** — 1–3 kalimat dalam bahasa santai, hangat dan tulus, tanpa menggurui dan tanpa jargon motivator, diakhiri
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
- Bahasa santai, hangat dan tulus, tanpa jargon motivator.
- **Variasikan polanya antar klip.** Jangan membuka semua klip dengan kalimat yang
  sama (misalnya selalu "Ternyata..."), dan jangan memakai kerangka yang itu-itu
  saja. Teks yang berpola sama di setiap klip terbaca seperti template.
