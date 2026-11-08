# Plan: menu **Autopilot**, dari link YouTube sampai jadwal upload

Dari sesi Plan, 2026-11-08. **Status: plan saja, belum dikirim ke /execute.** ian akan memutuskan kapan dikerjakan.

## Permintaan ian
- ian cukup paste link video. klipian mengerjakan sisanya: download, transcribe, memilih klip, render, dan menjadwalkan upload.
- Menu baru **Autopilot** di nav, terpisah dari Edit, Workspace, Sources, Motion, dan Guide.
- AI untuk tes: **Gemini API** saja. Tugasnya hanya memilih klip (JSON) dari transkrip, sekitar 2 request per akun per hari.
- Akan dipakai di **klipian podcast** dan **klipian lucu**. klipian intip berisi motion, jadi tidak cocok, tapi menu ini tetap
  muncul di **semua profile**.
- Pengaturan global (Gemini API, format output, jadwal) ada di satu **profile Admin**.

## Penting: Gemini Plus ≠ Gemini API
Langganan **Gemini Plus** (aplikasi Gemini) **tidak** memberi akses API. API butuh **API key dari Google AI Studio**
(aistudio.google.com) di akun Google yang sama. Ada free tier, atau bayar per pemakaian. Untuk 2 request per hari, free tier
biasanya cukup. Di free tier, Google boleh memakai datanya untuk melatih model. Kuota free tier berubah-ubah, jadi cek di AI
Studio saat setup.

## Keputusan ian (2026-11-08)
1. **Jumlah klip:** sampai **4 klip terbaik** yang paling berpotensi viral. **Tidak dipaksa:** video pendek (mis. 10 menit) yang
   tidak punya 4 topik utuh menghasilkan lebih sedikit klip. Brief Autopilot berkata "at most 4; fewer when the video does not
   hold that many whole topics worth posting; never pad with weak or partial topics".
2. **Akhir run: langsung dijadwalkan otomatis.** Jam diatur di Admin, default 11:00 dan 18:00. **Semua klip run tayang
   besoknya** (start tgl 8 → tgl 9), dibagi acak ke jam-jam itu (lihat "Aturan jadwal").
3. **Output Format: format khusus Autopilot yang diatur Admin.** Default: rasio **3:4**, background **blur**, **AI Framing**
   dijalankan, dan **angle intro on**: teks putih di atas latar hitam, tampil **2,5 detik** di awal klip.
4. **Nama menu: Autopilot.**
5. Gemini API **global** (satu key untuk semua profile), diatur di profile **Admin**.

## Alur (satu "run" = satu link)
1. **Link**: `ytdl.preview` untuk judul dan durasi, lalu `ytdl.start` mendownload video **utuh**, karena jalur ini butuh
   transkrip penuh.
2. **Transcribe** utuh, memakai job `/api/transcribe` yang ada (`sched.py` sudah mengatur satu job AI berat sekaligus).
3. **Project** dibuat otomatis: satu project per link, video sebagai asset pertama. Nama project = judul.
4. **Pilih klip**: `roundtrip.build_api_brief` (brief ketat: `endQuote`, `CLIP_MAX_SEC`) + aturan "at most 4, fewer is
   fine" → AI profile itu → JSON → `parse_reply_notes` (termasuk `settle_end`) → kandidat. Jawaban dengan 0 klip bukan error:
   run selesai dengan catatan "no topic worth a clip".
5. **Results** dari kandidat itu, memakai **format Autopilot** dari Admin (rasio, background, angle intro, gaya caption).
   AI Framing dijalankan untuk tiap Result kalau Admin menyalakannya (default on).
6. **Render** semua lewat `renderreq.py` + antrean render yang ada (tanpa halaman editor terbuka).
7. **Jadwal**: tiap file masuk ke Clips (`/api/workspace/clips/from-render`) dengan `post` dari AI (judul, caption, hashtag),
   lalu diberi tanggal dan jam dari slot (keputusan 2) dan **diupload terjadwal ke YouTube** lewat jalur upload yang sudah ada
   (yang dipakai "Schedule all Ready"). TikTok/Instagram mengikuti setelah fitur itu selesai di sesi lain.

Tiap langkah menyimpan statusnya di run itu. Run yang gagal di tengah bisa dilanjutkan dari langkah terakhir yang berhasil,
tanpa mengulang download atau transcribe.

### Aturan jadwal (diperbarui ian, 2026-11-08, menggantikan aturan "slot kosong berikutnya")
- **Tanggal = hari Start Autopilot + 1** (waktu lokal komputer). Start tanggal 8 → semua klip run itu tayang **tanggal 9**.
- **Semua klip run itu di tanggal yang sama**, dibagi acak ke jam-jam dari Admin (default 11:00 dan 18:00). Beberapa klip boleh
  di jam yang sama. Pembagian rata: 8 klip → 4 di 11:00 dan 4 di 18:00; 3 klip → 2 dan 1 (sisa ke jam acak); urutan klip diacak.
- Klip lain yang sudah terjadwal tidak memindahkan jadwal ini (tidak ada "slot terpakai").
- Fungsi murni, dengan tes: tanggal start, daftar jam, dan jumlah klip → daftar (tanggal, jam). Tes: tanggal selalu besoknya
  (juga di akhir bulan/tahun), jumlah per jam selisih paling banyak 1, semua klip dapat jadwal.

## Alur yang diharapkan ian (2026-11-08)
1. Paste link video YouTube.
2. Klik **Check** (satu klik): klipian memeriksa bahwa **YouTube client** (OAuth client yang dipasang di klipian) dan **akun
   YouTube** profile itu sudah terhubung dan token masih berlaku, plus AI profile itu siap. Hasilnya tampil sebagai daftar
   centang (link valid, judul + durasi, YouTube client ✓, akun YouTube ✓ <nama channel>, AI ✓). Kalau ada yang kurang, tampil
   apa yang kurang dan tautan ke tempat memperbaikinya.
3. Klik **Start Autopilot** (aktif hanya kalau semua centang hijau).
4. Semua proses berjalan sendiri sampai upload terjadwal selesai.

## Halaman baru `/autopilot` (profile biasa)
- Nav: `Edit · Workspace · Sources · Motion · Autopilot · Guide` di semua halaman. Gaya tombol kecil berbingkai, bukan pill.
- Atas: kolom **Paste YouTube link** dan tombol **Start**. Bisa beberapa link sekaligus; semuanya masuk antrean dan dikerjakan
  satu per satu.
- Daftar run: judul, langkah sekarang (Download 42% / Transcribe / Choosing clips / Framing / Render 2 of 4 / Scheduled),
  jumlah klip dan jadwalnya ("3 clips · 9 Nov 11:00, 9 Nov 18:00, 10 Nov 11:00"), link ke project di Edit, tombol Retry pada
  langkah yang gagal, dan Cancel.
- Pengaturan di profile biasa hanya satu: **AI** = `Gemini API` / `Claude API` (yang sudah ada) / `Manual`.
  Manual = klipian berhenti di "Waiting for the AI's reply", brief siap di-copy, lalu ian menempel JSON (cara ian sekarang
  dengan Claude Free). Gemini memakai key dari Admin; kalau belum ada: "Gemini API is not set up yet: open the Admin profile".
- Profile yang belum siap (AI belum dipilih, Gemini belum diatur, YouTube belum terhubung) melihat halaman yang sama dengan
  catatan yang menyebut apa yang kurang, dan tombol Start nonaktif. Tidak ada yang disembunyikan per profile.

## Profile Admin
- Satu profile khusus yang tetap, seperti Guest: id `_admin`, nama "Admin", selalu ada, tidak bisa dihapus atau diganti nama,
  dan tidak dibuat dari "+ New profile". Polanya mengikuti `GUEST` di `klipian/profiles.py` / `paths.py`.
- Isinya **hanya pengaturan global**. Admin tidak punya sources, projects, out, atau jadwal (tanpa folder itu). Setelah dipilih
  di halaman profile, ia langsung membuka halaman **Admin settings**; menu Edit, Workspace, Sources, Motion, dan Autopilot
  tidak tampil untuk Admin.
- **Admin settings** untuk sekarang:
  - **Gemini API**: key, model (dari daftar model akun, bukan nama yang ditulis mati), **Test key**, error terakhir.
    Key disimpan di `workspace/secrets` tingkat global, tidak pernah dikirim ke browser utuh.
  - **Autopilot format**: rasio (default 3:4), background (default blur), AI Framing (default on), angle intro (default on,
    teks putih, latar hitam, 2,5 dtk), gaya caption (default: gaya caption bawaan klipian). Kontrolnya memakai pilihan yang
    sudah ada di Output Format editor, bukan daftar baru.
  - **Autopilot schedule**: jam-jam upload (default 11:00 dan 18:00; bisa diubah, ditambah, atau dihapus), **tanggal tayang =
    hari Start + N hari** (default N = 1, besoknya), upload otomatis on/off (default on; off = berhenti di Ready).
  - **Template Autopilot (ian, 2026-11-08).** Format, AI Framing, angle intro, jam, N hari, upload otomatis, dan kualitas
    download disimpan sebagai **template** bernama. Admin bisa membuat, menyalin (Duplicate), mengubah, mengganti nama, dan
    menghapus template. Selalu ada satu template **Default** dengan nilai default di atas (bisa diubah, tidak bisa dihapus,
    punya **Reset to defaults**). Contoh pemakaian: "Podcast" (3:4, blur, 11:00 + 18:00) dan "Lucu" (jam lain).
  - Tiap profile biasa memilih **template mana** yang dipakai di halaman Autopilot (di samping pilihan AI); default: Default.
    Template yang dihapus → profile yang memakainya kembali ke Default.
  - Template juga berisi **jumlah klip maksimal** (default 4, bisa diatur; "fewer is fine" tetap berlaku).
  - **Jam yang sudah lewat** saat jadwal dihitung (mis. N = 0, atau run selesai larut): klip itu pindah ke **jam berikutnya**
    di daftar jam; kalau jam terakhir hari itu (mis. 18:00) juga sudah lewat, ke jam pertama besoknya (11:00). Pembagian rata
    tetap berlaku di antara jam yang masih tersedia.
  - Run menyalin isi template saat di-start, jadi mengubah template berlaku untuk run berikutnya, bukan yang sedang berjalan.
  - Kualitas download (default 1080).
  - Pengaturan ini berlaku untuk semua profile.
- Tanpa password: klipian berjalan di komputer ian sendiri (localhost). Admin memisahkan pengaturan, bukan mengamankannya.
  Kalau nanti perlu dikunci, itu fase terpisah.

## Bagian server
- `klipian/gemini_api.py` baru, meniru bentuk `claude_api.py`, tetapi settings-nya (key, model) **global**: `list_models`,
  job berlatar, hasil teks → `parse_reply_notes`. Pakai **SDK resmi Google** (`google-genai`) dengan output JSON berskema
  (skema = `REPLY_SCHEMA` yang ada). Error yang jelas: key salah, kuota habis (429: tunggu lalu coba lagi sekali), jawaban
  terpotong.
- `klipian/autopilot.py` baru: daftar run per profile (`workspace/profiles/<p>/autopilot/runs.json`), mesin langkah, satu run
  aktif per profile, pengaturan global Admin (`workspace/autopilot.json`), fungsi slot jadwal. Memanggil modul yang sudah ada
  (ytdl, jobs transcribe, roundtrip, AI framing, renderreq, schedule, youtube). Tidak ada logika pemilihan klip atau render baru.
- Pembuatan Result dari kandidat di server. Sekarang ini dikerjakan di browser (`result.js`, plus angle intro di
  `angleintro.js`), jadi perlu satu fungsi server dengan aturan yang sama, dicek seperti `renderreq` (Result buatan server =
  Result buatan editor untuk kandidat dan format yang sama).
- Endpoint: `POST /api/autopilot/start {urls}`, `GET /api/autopilot/runs`, `POST /api/autopilot/retry|cancel {id}`,
  `POST /api/autopilot/reply {id, text}` (mode Manual), `GET|POST /api/autopilot/profile-settings` (pilihan AI),
  `GET|POST /api/admin/settings` (hanya dari profile Admin), `POST /api/admin/gemini/test`.

## Urutan kerja yang disarankan (tiap fase bisa di-commit dan dicoba sendiri)
1. **Profile Admin** + Admin settings (format, jadwal, Gemini key tersimpan) + fungsi slot jadwal dengan tes.
2. **Halaman Autopilot + mode Manual** + run engine: link → download → transcribe → brief siap → tempel JSON → Results
   (format Admin, AI Framing, angle intro) → render → jadwal + upload YouTube. Sudah bisa dipakai dengan Claude Free.
3. **Gemini API** sebagai AI otomatis (Test key, run tanpa berhenti).
4. Claude API sebagai pilihan (modulnya sudah ada, tinggal dipasang di run).

## Tes
- Fungsi murni: slot jadwal (slot terpakai dilewati, slot lewat dilewati, dua run tidak bertabrakan, jam dari Admin), aturan
  "at most 4" di brief, Result buatan server = buatan editor, Admin tidak punya folder kerja dan tidak bisa dihapus.
- Gemini dengan klien palsu (tanpa jaringan): jawaban valid, key salah, 429, jawaban terpotong.
- Uji nyata di **salinan akun podcast** (jangan sentuh workspace/ ian, jangan upload ke channel asli; upload diuji sampai
  "would schedule" atau ke channel tes): satu video 60+ menit dan satu video ±10 menit (harus menghasilkan < 4 klip kalau
  topiknya sedikit).

## Risiko
- Kualitas pilihan klip Gemini belum dibandingkan dengan Claude. Coba di 2–3 video yang sama dulu.
- Upload otomatis tanpa dicek: klip yang jelek ikut terjadwal. Bisa dibatalkan dari Clips / YouTube Studio sebelum jamnya.
  Admin bisa mematikan upload otomatis (berhenti di Ready).
- Video panjang + AI Framing + render memakan waktu dan CPU. Run dikerjakan satu per satu, dan antrean bisa berjalan semalaman.
- Membuat Result di server adalah satu-satunya bagian baru yang besar; perlu selftest pembanding dengan editor.
