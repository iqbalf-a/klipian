# Brief: Autopilot, ulangi satu run dari tahap tertentu dengan AI lain

Dari sesi Plan, 2026-11-08. Permintaan ian: kalau hasil Gemini API untuk satu run kurang memuaskan, dia mau **mengulang run itu
dari Choosing clips** dengan cara lain, mis. **manual** (Copy brief → tempel ke Claude → tempel JSON balasan).

Kerjakan **setelah** `autopilot-run-list.md` (kartu ringkas + Details + `stoppedAt`), karena tombolnya ada di kartu itu.

## Kondisi sekarang
- `AI_MODES = ("manual", "claude", "gemini")` (`autopilot.py:350`). `run["ai"]` diambil dari profile saat Start dan tidak bisa diubah.
- Mode manual sudah ada: `_step_clips` menyimpan `brief`, state `waiting`, kartu menampilkan Copy brief + kotak balasan + Continue.
- `retry` hanya untuk `failed`/`cancelled`, dan melanjutkan dari tahap yang belum `done`. Tahap yang `done` tidak pernah diulang.
- `_step_clips` keluar langsung kalau `candidates` sudah ada; `_step_schedule` memakai `run["slots"]` yang sudah diputuskan.

## Keputusan ian
Klip lama yang sudah dibuat/terjadwal **dibiarkan** (Results lama tetap di proyek, video terjadwal di YouTube tidak disentuh). Hasil
baru **ditambahkan** ke proyek yang sama. Sebelum mulai, klipian memperingatkan klip mana yang sudah terjadwal, supaya ian bisa
menghapusnya sendiri di YouTube Studio kalau tidak mau dobel.

## Kerjakan

### Server (`klipian/autopilot.py`, endpoint baru `POST /api/autopilot/rerun`)
- `rerun(rid, from_step, ai)`: hanya untuk run yang tidak aktif (`done`, `cancelled`, `failed`, atau `stalled`); `from_step` salah satu
  `clips`, `framing`, `render`, `schedule` (tahap sebelum `clips` tidak perlu diulang: video dan transkrip sama). `ai` salah satu
  `AI_MODES` (default: AI run itu); mode Gemini/Claude ditolak dengan pesan jelas kalau key-nya belum siap (cek yang sama dengan
  Check).
- Mengulang dari `clips`: hapus dari run `candidates`, `brief`, `reply`, `ai_usage`, `results`, `slots`, `stoppedAt`, `error`;
  `done` dipotong sampai sebelum `from_step`; `ai` diganti; state `queued`; `kick`. Mengulang dari tahap lain hanya memotong `done`
  dan mengosongkan bidang milik tahap itu dan sesudahnya (`results`→ tetap kalau dari `framing`; `slots` dikosongkan kalau dari
  `schedule` atau lebih awal).
- Results lama di proyek **tidak dihapus**. Simpan id Results lama di run (`previousResults`) supaya tahap results/framing/render/
  schedule hanya mengerjakan Results baru, bukan yang lama.
- Riwayat ringkas: `history` di run mendapat satu butir per ulang (`at`, `fromStep`, `ai` lama → baru, jumlah klip lama) supaya kartu
  bisa menulis "Run again from Choosing clips (Gemini API → manual) · 18:40".
- Jadwal baru: slot dihitung ulang dengan aturan yang sama (`run_slots`) dari waktu ulang, bukan dari waktu Start lama.

### UI (kartu run di `ui/js/autopilot-page.js`)
- Tombol **Run again…** (berbingkai, kecil) di kartu run yang tidak aktif, juga di baris ringkas. Membuka dialog kecil
  (`confirmDialog` atau dialog serupa yang sudah ada):
  - **From:** Choosing clips (default) · AI Framing · Render · Schedule;
  - **AI:** Manual (copy/paste) · Claude API · Gemini API, default = AI run itu; pilihan yang belum siap dimatikan dengan alasannya;
  - **peringatan** kalau run sudah punya klip terjadwal: "These 4 clips are already scheduled on YouTube and stay there: Detik Tabrakan
    Bintaro 1987 · 9 Nov 18:00, … New clips are added next to them. Delete the old ones in YouTube Studio if you do not want both.";
  - tombol **Run again** / Cancel.
- Setelah itu, run berjalan seperti biasa. Untuk manual, kartu masuk `waiting` dengan Copy brief dan kotak balasan (yang sudah ada).
- Kartu menampilkan riwayat ulang (satu baris per ulang) di bagian Details.

## Tes
- Selftest: rerun dari `clips` dengan `ai` manual → state `waiting` dengan brief, Results lama tetap di proyek dan tidak dirender
  ulang, `slots` baru; rerun ditolak untuk run aktif; rerun Gemini tanpa key ditolak; `history` terisi; run lama tanpa field baru tetap
  terbaca.
- Preview di **salinan akun podcast** (bukan workspace ian, tidak ada server kedua di workspace ian, **tidak ada upload ke YouTube**:
  upload diganti fake / "would schedule"). Satu run `done` hasil Gemini → Run again dari Choosing clips dengan Manual → tempel balasan
  JSON contoh → hasil baru dirender, slot baru, Results lama tetap. Screenshot dialog dan kartu.
- `tests/*.test.js` + selftest (motionbrief masih merah, masalah lama).

## Selesai jika
Satu run bisa diulang dari Choosing clips (atau tahap sesudahnya) dengan AI yang dipilih, klip lama aman dan diperingatkan, hasil baru
masuk proyek yang sama. Commit brief ini bersamanya. Jangan push, laporkan ke Plan.
