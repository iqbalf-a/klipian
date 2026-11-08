# Brief: Autopilot, satu baris + progress bar per tahap

Dari sesi Plan, 2026-11-08. Permintaan ian: di halaman Autopilot, progress bar sekarang cuma satu untuk seluruh run. Dia mau
tiap tahap punya barisnya sendiri, misalnya:

```
Download      done
Transcribe    done
Project       [██████████████░░░]  86%
Choosing clips
...
```

## Kondisi sekarang
- Server sudah per tahap: `_execute` (`klipian/autopilot.py:486`) mengisi `progress=0` di awal tiap tahap dan `_progress` melaporkan
  persen tahap itu, dan `done` berisi tahap yang sudah selesai. **Tidak ada perubahan server yang diperlukan.**
- UI `ui/js/autopilot-page.js:38-61` (`drawRuns`): satu `.ap-bar` di atas, lalu `.ap-steps` sebagai deretan label kecil dalam satu
  baris (✓ / tebal / abu-abu). CSS di `ui/css/autopilot.css:29-33`.

## Kerjakan (hanya UI)
1. Ganti `.ap-bar` + `.ap-steps` dengan **daftar tahap vertikal** (`<ol class="ap-steps">`), satu baris per `STATE.steps`. Kolom kiri
   berisi nama tahap (lebar tetap supaya bar sejajar), kolom kanan berisi statusnya:
   - tahap ada di `r.done`: **done** (warna ok);
   - tahap yang sedang jalan (`k === r.step`, state `running`): progress bar + persen (`86%`). Kalau tahap itu tidak melaporkan
     persen (progress 0 dan ada `detail`, mis. "Asking Gemini"), tampilkan teks `detail` saja tanpa bar 0%, jangan bar yang
     diam di 0. `detail` pindah ke baris tahap itu, bukan paragraf terpisah di bawah;
   - state `waiting` di tahap itu: "Waiting for the AI's reply";
   - state `failed` di tahap itu: **failed** (warna error); pesan error tetap di `.ap-error` di bawah daftar;
   - state `cancelled` di tahap itu: "cancelled";
   - tahap lain: kosong / "–" abu-abu (belum).
2. Chip state di kanan atas tetap ada, tapi tanpa persen (persennya sudah ada di baris tahap).
3. Bar tetap `role="progressbar"` dengan `aria-valuenow`/`aria-valuemin`/`aria-valuemax` dan `aria-label` nama tahapnya. Tidak ada
   animasi loop.
4. Ringkas: baris tahap kecil (font 12px, tinggi ~20px), supaya 8 tahap tidak membuat kartu run terlalu tinggi. Run yang `done` boleh
   tetap memperlihatkan semua tahap "done" (tidak perlu dilipat).
5. Di lebar 375px: nama tahap dan status tetap satu baris, bar menyusut, tidak ada scroll ke samping.

## Tes
- Preview `/autopilot` pada **salinan akun podcast** (jangan workspace asli ian, dan jangan nyalakan server kedua di workspace ian:
  server baru melanjutkan run Autopilot yang belum selesai). Isi `runs.json` salinan dengan run contoh: satu running di tahap
  project 86%, satu running di clips tanpa persen dengan detail "Asking Gemini", satu waiting, satu failed di render, satu done,
  satu cancelled.
- Light dan dark, lebar 1400 dan 375. Screenshot untuk laporan.
- `tests/*.test.js` dan selftest tetap seperti sebelumnya (motionbrief masih merah, masalah lama).

## Selesai jika
Tiap tahap punya baris sendiri dengan done / bar + persen / status, dan tidak ada bar total lagi. Commit brief ini bersamanya. Jangan
push, laporkan ke Plan.
