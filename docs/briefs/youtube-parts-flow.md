# Brief: "From YouTube, parts only": Gemini first, then download only the clips

Dari sesi Plan, 2026-11-08. Permintaan ian: jalur baru tanpa mendownload video utuh.

1. tempel link YouTube (tanpa download) → 2. copy pertanyaan Ask Gemini → Gemini menjawab momen/topik →
3. tempel jawaban ke klipian → 4. copy brief untuk AI lain (mis. Claude) → 5. import JSON potongan klip →
6. **Download these N clips** (hanya rentangnya) → 7. transcribe → 8. render all.

ian setuju: **satu project per video YouTube, tiap potongan = satu video (asset) di project itu.**
Jalur lama (Add video…, From YouTube link…, Ask Gemini dengan video utuh, Transcribe) **tidak berubah**.

## Yang sudah ada (pakai ulang)
- Assets screen: `ui/index.html:278-286` (panel "Add from this profile's sources", tombol `#addVideoBtn`, `#addYouTubeBtn`),
  `ui/js/editor/assets.js:368` (`openYouTubeDialog`, `ui/js/shared/ytdl.js`).
- `ytdl.preview(url)` (`klipian/ytdl.py:384`): judul, durasi, id tanpa download. `ytdl.start/_run` (`:503`, `:544`) untuk download
  + progress `/api/ytdl/state`; credit lewat `_credit_for` / `_put_credit`; `free_name`, `file_stem`.
- Ask Gemini: `GEMINI_PROMPT`, `loadGeminiText/saveGeminiText` (`ui/js/editor/gemini.js`), `buildGeminiBrief` →
  `/api/geminibrief` → `roundtrip.build_gemini_brief(text, name, hashtag_rule)`: **tidak butuh file video**.
- Import JSON: `importJSON` / `applyCandidates` (`ui/js/editor/roundtrip.js:143,164`), `importId` per import.
- Rentang: `wantedRanges`, `mergeRanges` (pad `RANGE_PAD`=20 dtk, gabung jika jarak < `RANGE_GAP`=5) di `gemini.js` /
  `roundtrip.js:406`; Python `models.merge_ranges`.
- Multi-asset project dengan offset 1e6 per asset (`ui/js/editor/assets.js:12-80`, `activeAssetOffset`, `activeToVirtual`).
- Render all: "Select all from this brief" + "Render selected" (`ui/js/editor/bulk.js`).

## Kerjakan

### 1. Tombol baru + rapikan baris tombol (Assets)
- Di `.panel-head` panel "Add from this profile's sources": tiga tombol **berkelompok di kanan dengan jarak sama**:
  `Add video…` · `From YouTube link…` · **`From YouTube, parts only…`** (title: "Ask Gemini first, then download only the
  clips you pick").
- Bug CSS sekarang: `.panel-head .add-video-btn { margin-left: auto; }` (`ui/css/app.css:2473`) ada di **kedua** tombol, jadi
  ruang kosong terbagi dua dan `Add video…` melayang di tengah. Perbaiki: bungkus tombol dalam satu
  `<span class="add-video-actions">` (flex, `gap` sama, `margin-left:auto` hanya di wrapper); hapus aturan lama. Di ponsel
  wrapper turun ke baris sendiri, tombol wrap, tidak ada scroll horizontal.
- Gaya: tombol kecil berbingkai seperti /workspace, bukan pill.

### 2. Project dari link (belum ada file)
- Klik tombol → dialog: tempel link → `preview` (judul, channel, durasi, thumbnail seperti dialog YouTube sekarang) → **Start**.
- Project menyimpan `youtube: { videoId, url, title, channel, duration, stem }` dan **belum punya asset**. Nama dasar file =
  `file_stem(channel, title)`. Assets screen menampilkan kartu "YouTube: <judul> · <durasi> · not downloaded" sebagai pengganti
  "No video yet".
- Panel Ask Gemini (pertanyaan, tempat tempel jawaban, Copy brief for AI, Import) harus bisa dipakai untuk project ini tanpa
  file: kunci simpanan Gemini dan `/api/geminibrief` memakai `stem` sebagai `name`. Tombol **Open on YouTube** membuka link
  (ian bertanya ke Gemini di halaman YouTube). Jalur A (Find clips with Claude / Export) disembunyikan atau nonaktif dengan teks
  "Needs the whole video's transcript."

### 3. Import → Download these N clips
- Import JSON seperti biasa; waktu kandidat = waktu YouTube. Simpan kandidat di project dengan `importId` (seperti sekarang),
  belum dipetakan ke asset.
- Muncul **"Download these N clips"** + keterangan "about M min of video instead of <durasi>" (rentang = `mergeRanges` dengan pad
  20 dan gap 5, dijepit ke 0..durasi).
- Server: `ytdl.start(url, quality, name, section=(a, b))` → yt-dlp `download_ranges=yt_dlp.utils.download_range_func(None,
  [(a, b)])`, **tanpa** `force_keyframes_at_cuts` (cepat; pad 20 dtk menutup meleset beberapa detik). Satu job per rentang,
  berurutan, progress per rentang ("2 of 4 · 37%"). Nama file: `<stem> [12m30s-14m10s].mp4` lewat `free_name`.
  **Verifikasi** waktu mulai file nyata (keyframe) dari ffprobe/`start_time`, dan simpan offset yang **sebenarnya**.
- Credit tiap file: credit video asli + `section: [a_nyata, b_nyata]`. **Download again** (`/sources`) memakai `section` itu.
  Pastikan `credits.save()` tidak membuang field `section`.
- Setelah tiap rentang selesai: file ditambahkan sebagai asset project (urutan sesuai waktu), lalu kandidat yang jatuh di
  rentang itu dipetakan: `t_asset = t_youtube - a_nyata + offset_asset`. Kandidat yang tidak muat di satu rentang (tidak
  mungkin jika pad benar) → laporkan, jangan dibuang diam-diam.
- Gagal di tengah: rentang yang sudah selesai tetap; tombol jadi "Download the remaining K clips".

### 4. Transcribe + render
- Setelah download: tombol **"Transcribe these N clips"** yang ada, tetapi tiap file potongan ditranskripsi **utuh** (file kecil).
  Cek apakah transcribe sekarang menangani semua asset project; kalau hanya asset aktif, jalankan berurutan per asset.
- Snap titik potong ke kata seperti `snapImported` sekarang (yang belum diubah ian).
- Render: "Select all from this brief" → "Render selected" tanpa perubahan. Credit "Sumber:" di post = video asli.

## Batas yang ditulis di UI
- Klip hanya bisa digeser sejauh pad 20 dtk; lebih dari itu perlu download lagi (versi ini tanpa tombol "extend": sebutkan saja).
- Ukuran/resolusi sama dengan pilihan kualitas di dialog YouTube (1080 default, 720).

## Tes
- Selftest fungsi murni: rentang dari kandidat (pad, jepit, gabung), pemetaan waktu YouTube → asset+offset (termasuk offset
  nyata ≠ diminta), nama file rentang, credit `section` bertahan setelah `credits.save()` lain, Download again memakai `section`.
- Selftest download dengan `_net` palsu yang sudah ada (`check_ytdl`): opsi `download_ranges` diteruskan, 2 rentang → 2 asset.
- `tests/*.test.js` + selftest (motionbrief masih merah, masalah lama f68022b).
- **Uji nyata di salinan akun podcast** (jangan sentuh workspace/ ian): satu video podcast panjang, jawaban Gemini + JSON 3–4
  klip, download potongan, transcribe, preview satu klip dengan subtitle, render 1 klip. Catat ukuran/waktu vs video utuh.
  Screenshot baris tombol Assets (desktop + ponsel, light + dark).

## Selesai jika
Dari project baru, ian bisa: link → Gemini → tempel → brief → import → download potongan saja → transcribe → render all; tombol
Assets rata dengan jarak sama; jalur lama tidak berubah; tes hijau. Commit brief ini bersamanya. Jangan push, laporkan ke Plan.
