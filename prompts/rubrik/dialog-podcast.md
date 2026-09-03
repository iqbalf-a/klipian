# Rubrik: dialog — podcast, talkshow, wawancara

Ini yang dibaca Claude saat mencari klip. Ubah file ini kalau hasilnya belum
sesuai selera; tidak perlu menyentuh kode.

---

## Tugas

Kamu membaca transkrip lengkap satu episode dengan timestamp per kata.
Temukan **momen yang layak berdiri sendiri sebagai video vertikal pendek**.

Kamu tidak melihat gambarnya. Menilai hanya dari kata-kata yang diucapkan.

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

Kalau berkas ini juga menyertakan bagian **"Momen energi audio menonjol"**,
itu sinyal yang LEBIH KUAT lagi -- diukur langsung dari volume suara, bukan
menunggu Whisper kebetulan menuliskannya sebagai teks. Kalau rentang waktu
di daftar itu jatuh tepat sesudah sebuah kalimat, perlakukan sama seperti
tawa yang tertulis di atas: bukti nyata, bukan tebakan. Kedua sinyal ini
saling melengkapi, bukan gantian -- boleh dipakai bersama.

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

## Aturan batas potong

- **Mulai di awal kalimat.** Jangan mulai di tengah frasa.
- **Berhenti setelah kalimat penutup selesai.** Beri sedikit ruang, jangan
  memotong tepat di huruf terakhir.
- **Jeda panjang di dalam klip itu wajar** — nanti dirapikan terpisah.
- Kalau dua kandidat bertumpang tindih, ambil yang skornya lebih tinggi
  saja. Jangan mengeluarkan dua klip dari potongan yang sama.

---

## Yang tidak boleh dijadikan klip

- Segmen sponsor dan bacaan iklan
- Perkenalan, salam pembuka, dan penutup episode
- Obrolan teknis di luar topik ("mic-nya bunyi ya", "sebentar, ini ngerekam?")
- Momen yang lucunya bergantung pada apa yang terlihat di layar — kamu tidak
  melihat gambar, jadi kamu tidak bisa menilainya
- Bagian yang menyebut orang secara negatif dengan nama jelas

---

## Berapa klip

Keluarkan **8–15 kandidat**, diurutkan dari skor tertinggi.

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
