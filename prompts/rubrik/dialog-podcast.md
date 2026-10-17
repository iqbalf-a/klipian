# Rubrik: dialog — podcast, talkshow, wawancara

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

---

## Lima kriteria

Beri skor 1–10 untuk masing-masing.

### 1. Hook — apakah 3 detik pertama menahan orang?

Penonton memutuskan lanjut atau scroll dalam 3 detik. Kalimat pembuka klip
harus sudah menaruh sesuatu di meja.

| Skor | Contoh |
|---|---|
| 9–10 | angka mengejutkan, pengakuan, pertanyaan menohok — *"Saya rugi 300 juta gara-gara satu keputusan"* |
| 6–8 | pernyataan menarik tapi butuh satu kalimat untuk terasa |
| 1–4 | mulai dari basa-basi, "jadi gini", "oke lanjut", nama orang tanpa konteks |

Kalau transkrip menunjukkan penonton/kru tertawa ramai atau bereaksi keras
tepat sesudah suatu kalimat (tertulis sebagai "(tertawa)", "haha", "wkwk",
atau interjeksi serupa), itu bukti nyata ada sesuatu yang mengena di
kalimat sebelumnya -- bobot skor hook-nya naik. Reaksi ini sinyal langsung
dari penonton sungguhan, bukan tebakan.

Bagian **"Audio & timing cues"** di berkas ini memuat bukti yang lebih
kuat lagi (lihat di bawah): tawa yang dideteksi dari suaranya, bukan
menunggu Whisper kebetulan menuliskannya.

### 2. Utuh — bisa dimengerti tanpa nonton episodenya?

Klip yang mengacu ke hal yang dibahas 20 menit sebelumnya akan
membingungkan. Kalau ada kata ganti tanpa rujukan ("dia", "itu tadi",
"kayak yang gue bilang"), skornya turun.

### 3. Payoff — ada kesimpulannya, atau menggantung?

Klip harus tuntas. Cerita yang berhenti sebelum jawabannya keluar membuat
penonton merasa dikerjai, dan itu terbaca di kolom komentar.

Nilai tinggi kalau ada punchline, pelajaran, atau pembalikan di ujungnya.

### 4. Emosi — apakah menggerakkan sesuatu?

Kaget, lucu, marah, terharu, relatable, kontroversial. Informasi datar yang
benar tapi tidak menggerakkan apa pun dapat nilai rendah — betapapun
bermanfaatnya.

### 5. Durasi — muat tanpa dipaksa?

Pita ideal **30–45 detik**. Boleh 20–60 detik dengan skor menurun bertahap.

Di atas 75 detik hanya lolos kalau payoff-nya sangat kuat. Jangan memotong
gagasan supaya masuk pita — lebih baik skor durasinya rendah tapi klipnya
utuh, daripada dipenggal dan kehilangan maknanya.

**Skor total** = rata-rata kelima kriteria.

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
- Perkenalan, salam pembuka, dan penutup episode
- Obrolan teknis di luar topik ("mic-nya bunyi ya", "sebentar, ini ngerekam?")
- Momen yang lucunya bergantung pada apa yang terlihat di layar — kamu tidak
  melihat gambar, jadi kamu tidak bisa menilainya
- Bagian yang menyebut orang secara negatif dengan nama jelas

---

## Berapa klip

Kandidat **LOLOS** kalau skor total (rata-rata lima kriteria) ≥ 7. Keluarkan
SEMUA yang lolos, diurutkan dari skor tertinggi -- minimal 8, maksimal 15.

- Kurang dari 8 yang lolos ambang 7 → tetap keluarkan sampai 8 kandidat
  terbaik yang ada (meski sebagian di bawah ambang), supaya jumlahnya
  cukup untuk ditinjau.
- Lebih dari 15 yang lolos → ambil 15 skor tertinggi saja.

Ambang skor eksplisit ini penting untuk konsistensi: tanpa ambang, klip
yang skornya pas-pasan di sekitar peringkat ke-8/ke-15 gampang berubah
masuk-keluar daftar tiap kali rubrik ini dijalankan ulang, padahal
skornya sendiri nyaris sama. Dengan ambang tetap, keputusan "lolos atau
tidak" tidak bergantung pada kandidat lain di episode yang sama.

Lebih baik mengeluarkan 8 yang benar-benar layak daripada 15 dengan lima di
antaranya asal cukup. Pengguna meninjau semuanya secara manual; kandidat
lemah cuma menambah kerja.

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
