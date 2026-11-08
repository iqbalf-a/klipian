# Brief: halaman Admin dengan menu terpisah + tombol Save; model Gemini terlihat di Autopilot

Dari sesi Plan, 2026-11-08. Permintaan ian:
1. Halaman Admin terlalu panjang ke bawah: buat **menu terpisah**.
2. Tambahkan **tombol Save** supaya jelas perubahan sudah tersimpan.
3. Di halaman **Autopilot**, tampilkan **model Gemini** yang sedang dipakai (diatur Admin).

## Kondisi sekarang
- `ui/admin.html`: empat kartu berurutan ke bawah: Gemini API, Autopilot templates, Format, Schedule.
- `ui/js/admin-page.js:79-104`: tiap `change` langsung menyimpan (model, field template), tanpa Save. Save key / Remove key
  sudah tombol sendiri.
- `ui/js/autopilot-page.js`: model hanya muncul di baris run setelah run memakai Gemini.

## Kerjakan

### 1. Menu di kiri (seperti tab Profile settings, gaya yang sama)
- **Gemini API**: key (Save key / Remove key tetap seperti sekarang, langsung tersimpan), Model, Test key, status.
- **Templates**: pilih template di atas (Template, New, Duplicate selected, Rename, Delete, Reset to defaults), lalu dua
  sub-bagian untuk template yang dipilih: **Format** (ratio, background, AI Framing, angle intro, intro style + detik, caption
  style, most clips per run, download quality) dan **Schedule** (jam, Start + N hari, auto upload). Sub-bagian boleh berupa tab
  kecil di dalam panel atau dua kotak bersebelahan di layar lebar; yang penting tidak memanjang ke bawah.
- Isi panel di-scroll sendiri; kepala halaman dan footer tetap. Menu jadi baris yang bisa digeser di atas pada ≤640px.
  Tab memakai tombol kecil berbingkai, bukan pill, dengan `role="tablist"` dan panah keyboard.

### 2. Save yang jelas
- Perubahan **Model** dan semua field template **tidak lagi tersimpan otomatis**. Footer tetap: catatan status di kiri, **Discard**
  dan **Save** di kanan.
- Ada perubahan → footer menulis "Unsaved changes" dan Save menyala. Setelah Save berhasil → "Saved at 14:32" (jam
  tersimpan), Save mati sampai ada perubahan lagi. Gagal → pesan error, perubahan tetap di layar.
- Pindah template, pindah menu, atau meninggalkan halaman dengan perubahan yang belum di-Save → tanya dengan `confirmDialog`
  (Save / Discard / Keep editing; untuk meninggalkan halaman cukup `beforeunload`).
- Save key / Remove key / Test key tetap aksi langsung (bukan bagian dari Save), dan footer menyebutnya dalam satu baris kecil:
  "The API key saves at once. Model and templates are kept with Save."
- Validasi sebelum Save (jam format HH:MM dan tidak dobel, N ≥ 0, detik intro > 0, most clips ≥ 1): field yang salah ditandai,
  Save ditolak dengan pesan yang menyebut field-nya.

### 3. Model di halaman Autopilot
- Di bagian pilihan AI profile: kalau AI = Gemini API, tulis "Model: <model dari Admin> (set in Admin)" dengan tautan ke `/admin`.
  Belum ada model → "No model chosen in Admin".
- Daftar centang **Check** menyebut model yang akan dipakai: "AI ✓ Gemini API · gemini-3.8-flash".
- Run menyimpan model yang dipakai saat Start (sudah ada di `ai_usage`); baris run tetap memakai itu, bukan model Admin sekarang.
- Endpoint profile biasa boleh membaca **nama model saja** (bukan key) dari pengaturan global, mis. lewat status Autopilot yang
  sudah ada.

## Tes
- Preview `/admin` dan `/autopilot`, light dan dark, lebar 1400 / 900 / 375: tidak ada scroll panjang, Save/Discard selalu
  terlihat.
- Ubah field → "Unsaved changes"; Save → tersimpan (muat ulang halaman, nilai tetap); Discard → kembali; pindah template dengan
  perubahan → ditanya; jam dobel / N negatif → ditolak.
- Selftest yang ada (autopilot, profiles, http) tetap PASS; tambah cek bahwa endpoint profile biasa tidak pernah mengirim key.

## Selesai jika
Admin rapi per menu dengan Save yang jelas, Autopilot menampilkan model Admin. Commit brief ini bersamanya. Jangan push,
laporkan ke Plan.
