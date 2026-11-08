# Brief: "Intip yuk!" tanpa "sstt!"

Dari sesi Plan, 2026-11-08. Permintaan ian: di halaman Motion, saat generate narasi, bagian tagline
"Intip yuk!" tidak perlu ada "sstt!": langsung saja "Intip yuk!".

## Penyebab
Teks story-nya sudah bersih ("Intip yuk!"). Suara "sstt!" datang dari export narasi
(`klipian/motion_voice_export.py`), yang menyuruh suara AI berbisik di sting:
- Google: `<whispers>` sebelum "Intip yuk!" (`_google_script`, sekitar baris 99-101), ditambah
  gaya `"a little hushed on 'Intip yuk!'"` (`_google_style`, baris 61-62).
- ElevenLabs: `[whispers]` sebelum "Intip yuk!" (`_elevenlabs`, sekitar baris 161-163).
Model suara membaca bisikan itu sebagai "sstt!". VoiceStudio sudah polos (`_plain`), tidak perlu diubah.

## Kerjakan
- Hapus aturan whispers di sting, baik Google maupun ElevenLabs. Sting tidak diberi tag apa pun.
  Tag lain (`<chuckle>`, `[curious]`, pause) tetap.
- Gaya Google: hapus bagian "hushed"; kalau ada sting, tulis `"bright and direct on 'Intip yuk!'"`
  supaya model tidak menambah bunyi apa pun sebelum tagline.
- Perbarui docstring kedua fungsi dan komentar yang menyebut whispers.
- Selftest: `klipian/selftest.py:6699-6700` dan `6816-6817` sekarang **mewajibkan** whispers. Balik
  jadi: script berisi "Intip yuk!" **tanpa** tag apa pun tepat sebelumnya (tidak ada `<whispers>`,
  `[whispers]`), dan gaya Google tidak memuat "hushed". Sesuaikan juga komentar di 6671 dan 6785.
- Tambah aturan di `remotion/DESIGN.md` dekat B7/B16 (memory: tiap revisi motion menambah aturannya):
  "Sting voice: 'Intip yuk!' is read plainly, with no whisper tag and no 'sstt' before it (ian, 2026-11-08)."
- Cek juga `ui/js/remotion/narration.js` dan teks bantuan di halaman Motion: kalau ada yang menyebut
  whisper/bisik untuk sting, samakan.

## Tes
`python -m klipian selftest`: cek export Google dan ElevenLabs hijau dengan aturan baru
(`motionbrief` masih merah karena masalah lama f68022b; sebutkan saja). Buka satu video di /remotion
langkah narasi dan lihat script yang di-copy: "Intip yuk!" tanpa tag.

## Selesai jika
Script Google dan ElevenLabs tidak lagi punya whispers di sting, selftest sesuai, aturan masuk DESIGN.md.
Commit brief ini bersamanya. Jangan push, laporkan ke Plan.

## Catatan
Video yang audionya sudah dibuat tetap berbunyi "sstt": harus generate ulang suaranya kalau mau diganti.
