# Brief: AI Framing, orang yang tertawa tidak boleh mengalahkan yang bicara

Dari sesi Plan, 2026-11-03. Lanjutan `ai-framing-arisan.md` (commit d4f6927, belum di-push). ian: **"Perbaiki tawa dulu"**.
Uji di salinan project klipian-lucu (Arisan) dan regresi podcast, di workspace sementara; jangan tulis apa pun ke `workspace/` ian.

## Kasus
Wendi res9 **1586.12** (`av-sync`) dan **1591.28** (`speaker-face`): two-shot close-up, host berkacamata bicara di mic, kotak 3:4
duduk di peserta bertopi yang **tertawa**. Di komedi ini akan sering terjadi: pendengar tertawa (mulut terbuka lebar, badan
berguncang) saat orang lain bicara, dan tawanya ikut terdengar.

Dua jalur yang salah, keduanya perlu dicek:
1. **av-sync:** gerak tawa ikut naik-turun bersama envelope RMS (yang berisi suara host + tawa).
2. **speaker-face:** wajah yang "dikenali" sebagai speaker itu adalah si peserta. Dugaan Plan: pass 1 (`_learn_faces`) belajar dari
   **shot reaksi**, yaitu segmen satu wajah (peserta tertawa) di dalam giliran bicara host, lalu menyimpan wajah peserta sebagai
   wajah host. Di acara TV, shot reaksi saat orang lain bicara itu biasa.

## Langkah 0: diagnosis
Untuk 1586.12 dan 1591.28 (dan semua titik `speaker-face`/`av-sync` di 3 Result Arisan uji): skor av-sync dua teratas (mulut dan
badan terpisah), bukti pass 1 untuk speaker itu (segmen mana, wajah siapa: simpan crop wajahnya ke scratchpad), dan apakah ada cue
`laughter` (`cues.py`) yang tumpang tindih. Laporkan penyebab yang terbukti, bukan dugaan.

## Perbaikan (pilih yang terbukti perlu dari langkah 0; laporkan yang dilewati)
A. **Pass 1 hanya belajar dari wajah yang benar-benar bicara.** Segmen satu wajah di dalam giliran speaker X jadi bukti wajah X
   hanya kalau gerak mulut wajah itu cocok dengan suara (skor av-sync mulut ≥ ambang, misalnya 0,25). Shot reaksi (tertawa,
   diam, mengangguk) tidak jadi bukti. Kalau bukti X jadi kosong, X tidak punya wajah (jatuh ke av-sync/largest), lebih baik daripada
   wajah yang salah.
B. **Envelope "ucapan", bukan sekadar keras-pelan.** Untuk korelasi av-sync, pakai envelope yang hanya menyala saat ada **ucapan**:
   misalnya RMS dikalikan aktivitas kata dari transkrip (kata Whisper ada di waktu itu; tawa jarang ditulis sebagai kata), dan/atau
   bagian yang ditandai cue `laughter` diberi bobot rendah atau dibuang dari korelasi. Transkrip utuh ada untuk video Arisan uji;
   kalau transkrip tidak ada atau sebagian dan tidak mencakup segmen, kembali ke RMS seperti sekarang.
C. **Bentuk gerak tawa (opsional, hanya kalau A+B belum cukup).** Bicara = mulut membuka-menutup cepat mengikuti suku kata (≈3–8 Hz);
   tawa = mulut terbuka lama + badan berguncang. Misalnya penalti untuk wajah yang mulutnya terbuka terus sepanjang jendela.
   Kalau tidak andal, lewati dan laporkan.
- Mic stand tetap tidak dibuat.

## Bukti untuk ian (karena sesi eksekusi tidak bisa mendengar)
Untuk titik yang hasilnya berubah dan titik yang "belum bisa dipastikan" (Ariel 1579.24, 1606.64, Rusuh 1563.93, podcast res72
962.96 dan 1006.7): buat potongan MP4 pendek **dengan suara** (±3 dtk, 16:9 utuh dengan kotak lama merah dan baru hijau
digambar di atasnya) di scratchpad, plus satu daftar (`review.txt`) berisi file, waktu, why lama/baru. ian akan menonton dan
menilai. Jangan masukkan ke repo.

## Tes
- Selftest fungsi murni: shot reaksi tidak jadi bukti pass 1; envelope ucapan dari kata (tawa tanpa kata tidak menyala); bagian
  `laughter` tidak menaikkan skor tawa; tanpa transkrip → perilaku lama.
- Semua `tests/*.test.js` + selftest penuh lolos, baseline render tidak berubah.
- Uji nyata: Wendi res9 (khususnya 1586.12/1591.28 harus pindah ke host berkacamata), Ariel res27, Rusuh res20, dan regresi
  podcast GJLS res72/73/74 + Ferry res19/20/21 dibandingkan d4f6927 (tabel per titik yang berubah + screenshot).

## Selesai jika
Di Wendi 1586.12 dan 1591.28 kotak ada di host yang bicara; shot reaksi tidak lagi mengajarkan wajah yang salah; podcast tidak
memburuk; ada potongan video bersuara untuk titik yang perlu dinilai ian; tes hijau. Commit (jangan push), tanpa `remotion/`
dan `docs/briefs/`. Laporkan hash, diagnosis, tabel, path potongan video.
