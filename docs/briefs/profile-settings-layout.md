# Brief: jendela Profile settings lebih lebar, pakai tab, tombol selalu terlihat

Dari sesi Plan, 2026-11-08. Laporan ian: jendela Profile settings terlalu sempit dan terlalu panjang. Tombol Close/Save ada di
paling bawah dan harus di-scroll, dan klik di luar jendela tidak menutupnya.

## Kondisi sekarang
- `ui/js/shared/profile-ui.js:60-170` (`openSettings`): satu `<dialog class="profile-settings">` berisi satu kolom panjang:
  Name, Colour, Watermark, Rubric, YouTube account, Anthropic API, Hashtag placement, Hashtags in title, #shorts, Caption look,
  This computer, lalu Close/Save.
- `ui/css/profiles.css:65-88`: `width: min(92vw, 460px)`, tidak ada `max-height`, jadi jendelanya setinggi isinya.
- `window.openProfileSettings({section})` (`profile-ui.js:325`) dipakai dialog bulk upload untuk membuka langsung di bagian
  YouTube (`ytBox`), sekarang dengan `scrollIntoView`.
- Beberapa bagian menyimpan langsung tanpa Save (Claude key, Renders at the same time, YouTube connect, rubric). Save hanya
  menyimpan field form (name, colour, watermark, rubric, hashtag, #shorts).

## Kerjakan
1. **Lebih lebar, tinggi terbatas:** `width: min(94vw, 880px)`, `max-height: min(86vh, 720px)`. Isi di tengah bisa di-scroll
   sendiri; judul di atas dan baris tombol di bawah **selalu terlihat** (header/footer tetap, body `overflow:auto`).
2. **Tab di kiri** (seperti menu samping editor), satu bagian per tab:
   - **General**: Name, Colour, Watermark text.
   - **Clips & posts**: Default rubric (dengan tombolnya), Hashtag placement, Hashtags in the title, Add #shorts, Caption look.
   - **YouTube**: YouTube account (client, account, tombol).
   - **Claude API**: bagian Anthropic API (tidak ada untuk Guest, sama seperti sekarang).
   - **This computer**: Renders at the same time.
   Di lebar ≤ 640px tab pindah ke atas sebagai satu baris yang bisa digeser, dialog memenuhi layar (dengan margin 8px).
   Tab memakai tombol kecil berbingkai seperti /workspace, bukan pill; tab aktif jelas (latar + garis), bisa dengan keyboard
   (panah atas/bawah atau kiri/kanan, `role="tablist"`/`tab`/`tabpanel`, `aria-selected`).
3. **Footer:** catatan status (`#profileSettingsNote`) di kiri, **Close** dan **Save** di kanan, selalu terlihat. Tulis kecil di
   footer: "Name, colour, watermark, rubric and hashtags are kept with Save. YouTube, Claude and This computer save at once."
   supaya jelas mana yang butuh Save.
4. **Klik di luar menutup.** Klik di backdrop (di luar kotak dialog) = Close. Kalau ada perubahan form yang belum di-Save,
   tanya dulu dengan `confirmDialog` ("Discard the changes you have not saved?" · Discard / Keep editing). Esc mengikuti aturan
   yang sama. Jangan menutup kalau klik dimulai di dalam dialog lalu dilepas di luar (mis. memilih teks di input):
   pakai `pointerdown` + `click` yang keduanya di backdrop.
5. `openProfileSettings({section: "ytBox"})` membuka **tab YouTube** (bukan scroll). Tab terakhir yang dibuka diingat selama
   halaman terbuka saja.
6. Tidak ada field atau perilaku simpan yang berubah; hanya tata letak dan cara menutup.

## Tes
- Cek di preview pada /workspace, /, /sources (semua halaman yang memuat `profile-ui.js`), light dan dark, lebar 1400, 900, dan
  375: tombol Save/Close terlihat tanpa scroll halaman; isi tab panjang (YouTube, Claude) scroll di dalam dialog.
- Klik backdrop tanpa perubahan → tertutup; dengan perubahan → ditanya; seret dari input ke luar → tidak tertutup; Esc sama.
- Dialog bulk upload "open YouTube settings" → tab YouTube terbuka.
- Save masih menyimpan semua field (termasuk field di tab yang tidak sedang dibuka).
- Screenshot sebelum/sesudah untuk laporan.

## Selesai jika
Jendela lebar dengan tab, tombol selalu terlihat, klik luar menutup (dengan tanya kalau ada perubahan), tidak ada perilaku
simpan yang berubah. Commit brief ini bersamanya. Jangan push, laporkan ke Plan.
