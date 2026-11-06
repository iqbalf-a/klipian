# Brief: layar Prepare, tombol "Transcribe" + 3 jalur mencari klip (termasuk Ask Gemini)

Dari sesi Plan, 2026-11-03. Konteks ian: YouTube punya panel **"Ask about this video"** (Gemini) di sebagian video. Gemini bisa
menyebut momen menarik beserta waktu mulai/selesai dan kutipan kalimat pembukanya, dan waktunya sudah dicek ian: **pas**.
Video tetap diunduh utuh dan **tetap ditranskripsi** (subtitle butuh transkrip). Yang berubah hanya cara mencari klip.

## Alur yang diminta ian

1. **Transcribe** (tombol `#run` yang sekarang bernama "Find clips" diganti namanya).
2. Lalu tiga pilihan, sejajar dan jelas terpisah:
   1. **Or cut it yourself**: tetap seperti sekarang (`.manual-path`, "Open Clips").
   2. **Export for Claude or other AI** → **Import the AI's reply**: step 2 + 3 yang sekarang, hanya ganti nama.
   3. **Ask Gemini**: salin prompt untuk Gemini di YouTube → tempel jawaban Gemini → **Copy brief** untuk dirapikan AI lain jadi
      JSON → jawabannya ditempel ke **Import the AI's reply** yang sama (tidak membuat kotak import kedua).

## Perubahan UI (`ui/index.html` Prepare, `ui/js/editor/analysis.js`, `roundtrip.js`, `interactions.js`, `cues.js`)

- `#run`: teks "Find clips" → **"Transcribe"**. Ubah juga semua teks yang menyebutnya: "Hooks Find clips listens for" →
  "Hooks klipian listens for", "No transcript yet. Click Find clips to make one." → "… Click Transcribe …", komentar dan title
  terkait. Tombol "Find clips with Claude" (API) **tidak** diubah namanya.
- Step 2: judul "Export for Claude" → **"Export for Claude or other AI"**. Isinya tetap (Copy, Download file, Find clips with
  Claude, Rubric, cue chips).
- Step 3: judul "Import Claude's reply" → **"Import the AI's reply"**.
- Panel baru **"Ask Gemini"** (gaya step yang sama, tombol kecil berbingkai, bukan pill), ditempatkan sebagai pilihan ketiga
  setelah step 2, dengan nomor/penanda yang tidak membingungkan bersama nomor 2 dan 3 (misalnya urutan visual: cut it yourself,
  lalu "A · Export for Claude or other AI", "B · Ask Gemini", lalu Import yang dipakai keduanya; usulkan susunan yang paling
  jelas dan kirim screenshot). Isinya:
  1. Keterangan satu baris: "For YouTube videos with 'Ask about this video'. Ask, paste the answer here, then let any AI
     turn it into JSON."
  2. Tombol **"Copy brief for Ask Gemini"** (permintaan ian): menyalin prompt tetap di bawah (konstanta di JS, tidak bisa
     diedit di UI), status "Copied · paste it into 'Ask about this video' on YouTube". klipian tidak bisa tahu apakah sebuah
     video YouTube punya fitur Ask, jadi panel dan tombol selalu tampil; keterangan di poin 1 yang menjelaskan bahwa ini hanya
     untuk video yang punya Ask.
  3. Textarea **"Paste Gemini's answer"**.
  4. **Copy brief for AI** (aktif kalau textarea tidak kosong): menyalin brief buatan server (lihat bawah) ke clipboard, status
     seperti Copy di step 2 ("Copied · N KB · paste it into Claude or another AI"). Opsional juga **Download file**.
- Panel Ask Gemini **tidak menunggu transkrip** (bisa dikerjakan selagi transkripsi berjalan). Import juga sudah bisa tanpa
  transkrip (`_import_reply`), tetapi tetap sarankan menunggu transkrip supaya titik potong menempel ke kata: kalau Import
  ditekan sebelum transkrip ada, tampilkan catatan di `#importNote` ("Cut points are not snapped to words until the
  transcript is ready"), jangan diblokir.
- Teks jawaban Gemini yang ditempel disimpan per video di `localStorage` (`klipian:gemini:${PROFILE}:${video}`), supaya tidak
  hilang saat pindah layar. Dibungkus try/catch seperti `briefRubric`.

### Prompt Gemini (sudah diuji ian, jangan diubah kata-katanya)

Gemini **menolak** prompt yang menyebut klip, TikTok/Shorts, viral, atau mengedit. Prompt ini lolos:

```text
Apa saja 4 bagian paling menarik dari video ini? Tiap bagian berdurasi minimal 30 detik dan maksimal 90 detik. Pastikan tiap bagian membahas satu topik yang utuh dan tidak terpotong; kalau harus dipotong, mulai tepat di awal kalimat dan selesai tepat di akhir kalimat. Cari momen ketika pembicara menyampaikan pendapat yang tegas atau kontroversial, cerita lucu, fakta mengejutkan, pengakuan pribadi, atau tips praktis. Untuk tiap bagian, sebutkan waktu mulai dan selesai, kutip kalimat pertama yang diucapkan, dan jelaskan dalam satu kalimat kenapa bagian itu menarik. Urutkan dari yang paling menarik.
```

## Server: brief "rapikan jawaban Gemini jadi JSON"

- `roundtrip.build_gemini_brief(gemini_text: str, name: str, hashtag_rule: str) -> str`: teks pendek, **tanpa transkrip**:
  - Penjelasan: di bawah ini daftar momen dari sebuah video (nama `name`) beserta waktu mulai/selesai, kutipan, dan alasan.
    Ubah menjadi JSON klip.
  - Aturan: pakai waktu mulai dan selesai **persis seperti tertulis** (jangan mengarang atau menggeser); `hook` = kutipan
    persis; `reason` dari alasannya; isi `title`, `post`, dan `angle` sesuai format; skor 1–10 boleh diperkirakan dari urutan
    (yang pertama paling tinggi); momen tanpa waktu dilewati. Klip lebih dari 90 detik **tetap ditulis apa adanya** (ian
    memendekkannya sendiri di Candidates).
  - Lalu bagian `_answer_format(name, hashtag_rule)` yang sudah ada, supaya bentuk JSON dan aturan hashtag profil sama persis
    dengan brief biasa.
  - Lalu jawaban Gemini apa adanya, di dalam blok yang jelas ditandai sebagai data (bukan instruksi).
- Endpoint `POST /api/geminibrief {video, text}` → `{text}` (pakai `_profiles.hashtag_settings()` seperti `/api/brief`).
  Tolak `text` kosong atau lebih dari 50 KB dengan pesan yang jelas.
- Jawaban AI-nya diimpor lewat `/api/import` yang sudah ada, tanpa perubahan parser. Pastikan link YouTube di dalam teks tidak
  mengganggu (`watch?t=285s` bisa ikut ke JSON di tempat lain; parser hanya membaca `start`/`end`).

## Tes

- Selftest `build_gemini_brief`: memuat jawaban Gemini contoh (di bawah), berisi `_answer_format` yang sama dengan brief biasa,
  dan menandai teks Gemini sebagai data.
- Selftest import: JSON contoh hasil merapikan (7 klip dari contoh di bawah, `start`/`end` mm:ss) → 7 kandidat dengan waktu yang
  sama, dengan dan tanpa transkrip.
- Tes Node (kalau bisa tanpa DOM): penyimpanan teks Gemini per video.
- Semua `tests/*.test.js` + selftest penuh lolos.
- **Cek di preview** (workspace sementara, jangan `workspace/` ian): tombol Transcribe, tiga pilihan, Copy brief for Ask Gemini, Copy
  brief aktif/nonaktif, catatan import sebelum transkrip ada. Screenshot.
- Uji nyata satu kali: tempel brief hasil Copy ke Claude (bisa lewat API key di profil uji kalau ada, atau tempel balasan JSON
  buatan sendiri), Import, dan pastikan 7 klip muncul di Candidates dengan waktu yang sama dengan jawaban Gemini.

### Contoh jawaban Gemini (dari ian, video podcast Raditya Dika, untuk fixture tes)

```text
1. Teknik Mengingat PIN ATM (4:45 - 5:05): "Ini jujur ya pin ATM aku suka lupa." Momen ini menarik karena menunjukkan aplikasi praktis dari teknik daya ingat.
2. Tips Menghapus Makeup dengan Cepat (57:42 - 58:17): "Hapus dosa-dosa di wajah sih ngapusnya itu gampang banget." Solusi praktis bagi penonton yang malas membersihkan wajah.
3. Metode Loci untuk Mengingat Barang (17:45 - 23:09): "Itu nama metodenya tuh Losai Method atau metode lokasi." Penjelasan langkah demi langkah membangun istana memori.
4. Penjelasan Konsep Wonyongism (6:17 - 7:11): "Jadi originalnya itu tuh ada K-pop Idol namanya Wonyong kan?" Membahas tren media sosial anak muda.
5. Alter Ego untuk Mengatasi Komentar Negatif (29:33 - 30:35): "Tapi yang menurut aku paling ampuh dan praktikal itu bikin alter ego." Perspektif kesehatan mental kreator.
6. Mengapa Otak Kanan Lebih Kuat Mengingat (16:12 - 16:56): "Jadi, fun fact kita kan terbagi di dua lobus ya, kanan dan kiri." Penjelasan ilmiah yang menarik.
7. Mindset dalam Hubungan (56:39 - 57:25): "Depends on kayak emotional capability kayak gitu loh." Pesan inspiratif soal kemandirian.
```

## Selesai jika

Tombol bernama Transcribe; layar Prepare menampilkan tiga jalur yang jelas (cut it yourself, export for Claude or other AI,
Ask Gemini) dan satu Import untuk dua jalur AI; Copy brief for Ask Gemini dan Copy brief for AI bekerja; brief Gemini memakai format JSON yang
sama dengan brief biasa; tes hijau. Commit (jangan push), tanpa `remotion/` dan `docs/briefs/`. Laporkan hash dan screenshot.
