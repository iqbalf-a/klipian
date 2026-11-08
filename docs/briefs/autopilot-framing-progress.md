# Brief: Autopilot, klip melewati 180 detik dan AI Framing tanpa progress

Dari sesi Plan, 2026-11-08. Laporan ian: run "Bener-Bener Pusat Dunia Nih.." (Run again dari Choosing clips, Manual) menulis
**"AI Framing 1 of 3 · No progress for 10 min"**.

## Yang ditemukan
1. **Server sebenarnya bekerja.** Proses klipian ian memakai CPU penuh (±9 core) selama itu. Tidak macet, hanya diam.
2. **AI Framing hanya melapor di antara klip.** `_step_framing` (`autopilot.py`) memanggil `report` sekali per klip, lalu
   `deps.ai_framing` (`autopilot_deps.py:188`) menjalankan `jobs._run_diarize` + `facebox.frame_segments` tanpa callback. Satu klip
   panjang bisa makan 12–30+ menit (juga terlihat di uji /execute), jadi `updatedAt` diam dan muncul "No progress". Cancel juga
   baru berlaku setelah klip itu selesai.
3. **Klipnya terlalu panjang: 335, 84, 351 detik** (`run.candidates[].dur`). Batas 180 detik tidak ditegakkan di Autopilot: balasan
   manual dari Claude mengabaikan batas, dan aturan brief "A clip longer than … is still written as it is; the person shortens it
   later" tidak berlaku di Autopilot karena tidak ada orang yang memendekkan. Klip 5–6 menit itulah yang membuat AI Framing sangat lama.

## Kerjakan
1. **Tegakkan `CLIP_MAX_SEC` di Autopilot** (fungsi murni di `autopilot.py`, dipakai `_step_clips` untuk semua mode AI, setelah
   `merge_touching`): klip yang lebih dari `CLIP_MAX_SEC` dipotong di **akhir kalimat (segmen) terakhir** yang masih ≤ `start +
   CLIP_MAX_SEC`, memakai transkrip video itu (`settle_end`/segmen yang sudah ada, jangan logika baru kalau bisa dipakai ulang).
   Hapus `endQuote` klip itu. Catat di notes run: "Clip "X" was 5:35, cut to 2:58 at the end of a sentence." Merge juga tidak boleh
   menghasilkan klip > `CLIP_MAX_SEC` (sudah begitu, pastikan selftest).
2. **Progress di dalam AI Framing:** `deps.ai_framing(project, result, report)` menerima callback. Laporkan tahap di dalam satu klip
   dengan persen keseluruhan step (klip i dari n, ditambah bagian di dalam klip), mis. "AI Framing 1 of 3 · finding speakers 40%",
   "AI Framing 1 of 3 · following faces 70%". Sumbernya yang sudah ada: `jobs.JOBS[job_id]["percent"/"stage"]` untuk diarize (baca
   berkala atau teruskan callback ke `_run_diarize` kalau bisa), dan callback/hitungan frame di `facebox.frame_segments` (tambahkan
   parameter `progress=None` opsional, tanpa mengubah perilaku pemanggil lain). Paling jarang tiap ~5 detik, supaya `runs.json` tidak
   ditulis terlalu sering.
   Callback itu juga mengecek `_CANCEL`, jadi **Cancel berhenti di dalam klip**, bukan setelah klip selesai.
3. Ambang "No progress for N min" di UI tetap 10 menit. Dengan laporan di dalam klip, tanda itu hanya muncul kalau memang macet.

## Tes
- Selftest: klip 335 dtk → dipotong ≤ 180 di akhir segmen, dengan note; klip 84 dtk tidak berubah; berlaku untuk mode manual, Claude,
  dan Gemini; merge tidak pernah > 180.
- Selftest dengan deps palsu: `ai_framing` memanggil report beberapa kali di dalam satu klip; Cancel di tengah klip menghentikan
  step.
- Uji nyata di **salinan akun podcast** (bukan workspace ian; jangan server kedua di workspace ian): satu Result ±60 dtk, jalankan
  AI Framing lewat Autopilot. Catat berapa kali progress berubah dan berapa lama totalnya. Tidak ada render dan tidak ada upload.
- `tests/*.test.js` + selftest (motionbrief masih merah, masalah lama).

## Selesai jika
Autopilot tidak pernah membuat klip > 180 detik, AI Framing melaporkan progress di dalam klip dan bisa dibatalkan di tengah. Commit
brief ini bersamanya. Jangan push, laporkan ke Plan.
