# Rubrik: edukasi — penjelasan dan tips

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

Template untuk explainer, tips praktis, kelas, dan penjelasan sains atau keuangan.

Niche ini hidup dari **satu hal yang bisa dibawa pulang**. Satu klip yang bagus
mengajarkan tepat satu gagasan, lengkap dengan alasannya, sehingga penonton
bisa menjelaskan ulang ke temannya sesudah 40 detik.

---

## Lima kriteria

Beri skor 1–10 untuk masing-masing. Kunci skor di JSON: kriteria 1 → `hook`, 2 → `complete`, 3 → `payoff`, 4 → `emotion`, 5 → `duration`.

### 1. Hook — apakah 3 detik pertama menjanjikan sesuatu yang berguna?

| Skor | Contoh |
|---|---|
| 9–10 | mitos yang dibongkar, angka konkret, atau kesalahan umum — *"Kebanyakan orang salah menabung, ini sebabnya"* |
| 6–8 | pertanyaan yang jelas atau janji manfaat yang spesifik |
| 1–4 | "jadi hari ini kita akan bahas...", definisi buku teks, perkenalan topik yang panjang |

**Topik yang berpotensi viral.** Selain kalimat pembukanya, lihat *apa yang
diajarkan*. Yang sering dibagikan:
- uang yang konkret (gaji, cicilan, harga, hemat berapa);
- mitos yang dibongkar atau "yang selama ini kita kira salah";
- tips yang bisa dipakai hari itu juga;
- fakta yang mengejutkan dengan angka atau perbandingan;
- kesalahan yang sering dilakukan dan cara menghindarinya;
- penjelasan sederhana untuk hal yang biasanya terasa rumit;
- kesehatan, karier, belajar, dan teknologi sehari-hari.

Daftar ini hanya contoh. Pakai juga pengetahuanmu tentang apa yang ramai di
Shorts, TikTok, dan Reels Indonesia.

Aturannya:
- Topik yang berpotensi viral boleh **menaikkan skor hook atau emosi**, hanya
  kalau memang dibahas di klip.
- Tuliskan potensinya di **alasan**.
- Potensi viral tidak menyelamatkan klip yang tidak utuh atau tanpa
  kesimpulan.
- Jangan memilih klip yang berisi klaim kesehatan atau keuangan yang berbahaya
  atau jelas menyesatkan, walau potensi viralnya besar.

### 2. Utuh — bisa dipahami tanpa nonton kelasnya?

Penjelasan yang bergantung pada slide, papan tulis, atau bagian sebelumnya
(*"seperti rumus tadi"*) tidak lolos. Istilah teknis harus dijelaskan di dalam
klip atau cukup umum. Kata ganti tanpa rujukan menurunkan skor.

### 3. Payoff — ada takeaway yang jelas? (bobot besar)

Klip harus selesai di **kesimpulan yang bisa dibawa pulang**: aturan, langkah,
angka, atau jawaban dari pertanyaan di awal. Nilai tinggi kalau ada **contoh
konkret atau angka** yang membuatnya nyata. Penjelasan yang berhenti sebelum
jawabannya keluar dapat nilai rendah.

### 4. Emosi — apakah ada rasa ingin tahu atau "oh, begitu"?

Di niche ini emosi berarti **kejutan dan relevansi**: "ternyata begitu",
"ini yang gue alami", rasa lega karena akhirnya paham, atau rasa tersentil.
Penjelasan yang benar tapi datar dan tanpa contoh dapat nilai rendah.

### 5. Durasi — muat tanpa dipaksa?

Pita ideal **30–50 detik**. Boleh 20–70 detik dengan skor menurun bertahap.
Jangan memenggal langkah di tengah supaya muat: klip yang utuh dengan skor
durasi rendah lebih baik daripada dua langkah dari tiga.

**Skor total** = rata-rata tertimbang: (hook + utuh + 2 × payoff + emosi +
durasi) / 6. Takeaway dihitung dua kali.

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

**Bobot sinyal untuk niche ini.** Niche ini lebih bergantung pada transkrip daripada pada suara. `laughter` dan
`applause` yang jatuh sesudah satu kalimat menandai kalimat yang mengena
(sering analogi atau kejutan), tetapi tidak wajib ada. `pause` sebelum satu
kalimat sering berarti kesimpulan atau penekanan: kandidat payoff. `fast
talk` bisa berarti penjelasan yang terburu-buru: jangan menaikkan skor utuh
karenanya. `music · avoid` tetap dihindari.

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

- Segmen sponsor dan bacaan iklan
- Rentang bertanda `music · avoid` di daftar cues
- Perkenalan, daftar isi ("hari ini kita bahas tiga hal"), dan penutup
- Obrolan teknis di luar materi ("sudah kelihatan slide-nya?")
- Penjelasan yang bergantung pada gambar, grafik, atau layar: kamu tidak
  melihatnya
- Klaim kesehatan, hukum, atau keuangan yang berbahaya, tidak lengkap, atau
  tidak bisa diperiksa dari transkrip
- Bagian yang menyebut orang atau lembaga secara negatif dengan nama jelas

---

## Berapa klip

Kandidat **LOLOS** kalau skor total tertimbang ≥ 7. Keluarkan SEMUA yang lolos,
diurutkan dari skor tertinggi -- minimal 6, maksimal 15.

- Kurang dari 6 yang lolos → tetap keluarkan sampai 6 kandidat terbaik.
- Lebih dari 15 yang lolos → ambil 15 skor tertinggi.

Satu gagasan, satu klip: jangan mengeluarkan dua klip yang mengajarkan hal
yang sama dari potongan yang bertumpang tindih.

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
- **caption** — 1–3 kalimat dalam bahasa santai, jelas dan ramah, seperti guru yang tidak menggurui, diakhiri
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
- Bahasa santai, jelas dan ramah, tanpa menggurui.
- **Variasikan polanya antar klip.** Jangan membuka semua klip dengan kalimat yang
  sama (misalnya selalu "Ternyata..."), dan jangan memakai kerangka yang itu-itu
  saja. Teks yang berpola sama di setiap klip terbaca seperti template.
