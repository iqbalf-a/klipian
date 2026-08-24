# klipian

Memotong podcast dan siaran panjang jadi klip vertikal 9:16 siap posting ke
TikTok, YouTube Shorts, dan Instagram Reels.

`klip` + `ian` — terbaca "kliping".

Berjalan **sepenuhnya di laptopmu**. Tidak ada akun, tidak ada unggahan,
tidak ada langganan. Dan **tidak butuh API key.**

---

## Menjalankan

```bash
cd D:\github-repos\klipian && .venv\Scripts\python.exe -m klipian serve
```

Lalu buka **http://127.0.0.1:5177**

Server ini yang menjalankan Whisper dan ffmpeg. Tanpa dia, UI cuma halaman
statis: tombol Cari klip dan Render tidak punya apa pun untuk dipanggil, dan
akan mengatakannya terang-terangan.

Terikat ke `127.0.0.1` saja — server menjalankan ffmpeg dan membuka Explorer
atas permintaan HTTP, jadi tidak boleh terjangkau dari jaringan.

### Instalasi pertama kali

Butuh **Python 3.10+** dan **ffmpeg** di PATH.

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

Ringan (~300 MB) karena **tidak memakai PyTorch** — faster-whisper berjalan di
atas CTranslate2. Bobot model Whisper diunduh sekali saat dipakai pertama:
1,6 GB untuk `large-v3-turbo`.

**Taruh videomu di `samples/`.** Browser tidak memberi jalur lengkap ke server,
jadi backend mencarinya berdasarkan nama berkas di folder itu.

---

## Alur kerja

Ada dua jalan menuju klip yang sama. Keduanya berakhir di editor yang sama.

### A. Lewat Claude — tanpa API key

```
1  BERANDA    pilih mode: Podcast / Live MLBB / Restream MPL / Tayangan TV
2  SIAPKAN    tarik video, atur jumlah klip · durasi · format · resolusi
                                                          [ Cari klip ]
3  ANALISIS   ① transkripsi berjalan di mesinmu
              ② [ Unduh berkas ]  →  jatuhkan ke Claude, minta "kerjakan"
              ③ tempel balasan JSON  →  [ Potong jadi klip ]
4  KANDIDAT   tinjau kartu, tiap kartu memakai frame dari detik klipnya
                                                  Setujui / Tolak
                                                     [ Render klip ]
5  ANTRIAN    progress nyata  →  [ Buka folder ]  →  MP4
```

Langkah 2 dan 3 memakai langganan Claude yang sudah kamu punya — bukan API
berbayar. Keuntungan yang tidak ada di jalur API: **kamu melihat pertimbangan
Claude sebelum apa pun dirender, dan bisa mendebatnya.**

### B. Manual — tanpa Claude sama sekali

Di layar Analisis, tekan **Buat klip manual**. Lewati langkah ② dan ③; kamu
yang menentukan rentangnya dengan mengklik kata di transkrip.

### Menyunting sebelum render

| Layar | Yang bisa dilakukan |
|---|---|
| **Potong** | klik kata untuk in/out · buang bagian di tengah · buang jeda |
| **Reframe** | geser dan ubah ukuran crop, preview 9:16 ikut seketika |
| **Caption** | gaya, ukuran, posisi, highlight — preview langsung |

Klip bukan satu rentang, melainkan **daftar potongan**. Membuang bagian di
tengah membelahnya jadi dua, dan caption otomatis dipetakan ulang ke timeline
keluaran — kata yang tadinya di detik 650 sumber jatuh di detik 11 keluaran.

---

## Perintah baris perintah

UI sudah mencakup semuanya, tapi tiap tahap bisa dijalankan sendiri.

```bash
python -m klipian info video.mp4
```

```bash
python -m klipian transcribe video.mp4 --srt
```

```bash
python -m klipian brief video.mp4 --mode dialog
```

```bash
python -m klipian import video.mp4 balasan.json
```

```bash
python -m klipian render video.mp4 out/video/candidates.json --only 1 --crop 58 8 26 84
```

| Perintah | Fungsi |
|---|---|
| `info` | metadata media, cek encoder |
| `transcribe` | transkripsi word-level, hasilnya di-cache |
| `brief` | susun berkas untuk dijatuhkan ke Claude |
| `import` | baca balasan JSON, geser ke batas kata |
| `render` | hasilkan MP4 9:16 |
| `serve` | jalankan UI dengan semua fungsi hidup |

---

## Kenapa dirancang begini

### Timestamp per kata itu pondasinya

Tanpa timestamp per kata, caption karaoke mustahil dan pemotongan akan
memenggal kata di tengah. Subtitle biasa (SRT) hanya punya timestamp per
kalimat — tidak cukup.

### Pembagian tugas dengan Claude

| Siapa | Mengerjakan |
|---|---|
| Claude | menilai isi, memberi waktu **kira-kira** menit:detik |
| klipian | menggeser waktu itu ke **batas kata terdekat** |

Claude tidak punya timestamp per kata dan tidak perlu punya. Memaksanya presisi
milidetik justru bikin rapuh. Pada uji nyata pergeserannya 0,01–1,77 detik;
yang terbesar terjadi saat tebakan jatuh di tengah jeda.

### Cache transkrip

Transkripsi dibayar **sekali per video**, dikunci pada sidik jari berkas +
model + bahasa. Menyetel rubrik atau mengulang pemotongan tidak mengulangnya.

### Glosarium

`prompts/glossary.txt` menampung nama dan istilah yang sering salah didengar.
Dipakai dua kali: sebagai `hotwords` ke Whisper (disisipkan ulang tiap jendela
30 detik, jadi tetap dikenali sampai akhir), dan sebagai koreksi setelahnya.

Isinya dari bukti, bukan tebakan: `transcribe` mencetak daftar **"kata mungkin
salah dengar"** di akhir. Daftar itu bukan sekadar `keyakinan < 50%` — ambang
polos menandai 10,3% kata dan hampir semuanya kata sambung yang sebenarnya
benar. Setelah kata fungsi disaring, tinggal 1,4%, dan yang tersisa memang
salah: `biokul`, `biukan`, `radhi`.

---

## Performa

Diukur langsung di **Intel Core Ultra 9 185H** (16C/22T, tanpa GPU diskrit).

| Tahap | Colok listrik | Pakai baterai |
|---|---|---|
| Transkripsi `large-v3-turbo` | **2,3× realtime** | **~1,0× realtime** |
| Podcast 42 menit | 18 menit | ~42 menit |
| Render klip 13 detik | ~14 detik | lebih lambat |

**Colokkan charger sebelum transkripsi panjang.** Selisihnya lebih dari dua
kali lipat — Intel membatasi daya CPU saat di baterai, dan Whisper adalah
beban yang paling terasa terkena. klipian mendeteksi ini dan memperingatkan
di layar Analisis.

Jumlah thread diset 8, bukan bawaan faster-whisper. Bawaannya (`0`)
diterjemahkan CTranslate2 jadi 4 thread saja. Diukur di 185H: 8 thread paling
cepat, dan 22 thread justru **turun** karena E-core ikut dipakai.

Proyeksi siaran MLBB 2 jam 22 menit: transkripsi sekitar 62 menit.

CTranslate2 hanya memakai CPU — iGPU Arc dan NPU tidak dipakai untuk
transkripsi. Tapi Arc **dipakai** untuk encoding lewat `h264_qsv`.

---

## Mode

| Mode | Sumber | Cara momen dicari |
|---|---|---|
| **Podcast** | talkshow, wawancara, ceramah | gagasan utuh dari transkrip |
| **Live MLBB** | siaran streamer sendiri | announcer + reaksi streamer |
| Restream MPL | nonton bareng siaran resmi | teriakan caster, fase draft dibuang |
| Tayangan TV | variety show, komedi | punchline dari transkrip + tawa |

Dua yang pertama diprioritaskan. Menambah mode tidak butuh kode baru — cukup
satu file rubrik di `prompts/rubrik/`.

---

## Struktur

```
klipian/
├── klipian/           mesin
│   ├── models.py        Word, Segment, Transcript  ← kontrak inti
│   ├── transcribe.py    faster-whisper word-level
│   ├── roundtrip.py     brief untuk Claude + impor balasannya
│   ├── render.py        potongan → concat → crop → caption → MP4
│   ├── server.py        API lokal: transkripsi, render, thumbnail
│   └── cli.py
├── ui/                antarmuka
│   ├── index.html       kerangka + semua layar
│   ├── app.js           data & penggambaran tampilan
│   ├── interactions.js  drop file, kandidat, caption, antrian
│   ├── reframe.js       crop interaktif
│   ├── analysis.js      menjalankan transkripsi
│   ├── player.js        pemutar + kirim render
│   ├── roundtrip.js     ekspor brief + impor balasan Claude
│   └── manual.js        potong manual tanpa Claude
├── prompts/rubrik/    kriteria penilaian, bisa disunting tanpa sentuh kode
├── samples/           taruh videomu di sini
├── cache/             transkrip (dibuat otomatis)
└── out/               hasil render
```

---

## Status

- [x] Ingest, transkripsi word-level, cache, glosarium
- [x] Pemilihan klip lewat round-trip Claude, tanpa API key
- [x] Jalur manual tanpa Claude
- [x] Model potongan: buang bagian di tengah klip
- [x] Reframe: crop menggerakkan preview, preset per mode
- [x] Caption `.ass` karaoke, dipetakan ke timeline keluaran
- [x] Render MP4 9:16 dengan akselerasi Intel Arc
- [x] UI penuh — semua tahap bisa dijalankan tanpa terminal
- [ ] Layout `split` dua orang dan `blur` di UI
- [ ] Deteksi facecam otomatis untuk mode gameplay
- [ ] Objek bernama di Reframe (crop mengikuti orang tertentu)
- [ ] Riwayat performa untuk menyetel rubrik dari hasil nyata

---

## Kalau ada yang tidak jalan

**"Butuh backend. Jalankan: python -m klipian serve"** — UI dibuka tanpa
server. Jalankan perintah di bagian atas.

**"tidak ada di folder yang dijangkau server"** — videonya belum ada di
`samples/`.

**MP4 hasil render 0 byte** — ffmpeg masih menulis. Tunggu baris antrian
berbunyi `selesai` sebelum membuka folder.

**Transkripsi jauh lebih lama dari biasanya** — cek apakah laptop sedang
pakai baterai. Di baterai kecepatannya turun dari 2,3× jadi sekitar 1,0×
realtime; podcast 42 menit yang biasanya 18 menit jadi ~42 menit. klipian
memperingatkan ini di layar Analisis.

**Transkripsi lama** — memang, walau sudah dicolok. Video 42 menit butuh
sekitar 18 menit. Yang sudah pernah ditranskripsi langsung siap dan tertulis
"diambil dari cache".
