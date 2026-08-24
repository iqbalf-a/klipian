/* klipian — membetulkan teks caption
   ==========================================================================
   Whisper sesekali salah dengar: nama orang, istilah, kata yang diucapkan
   cepat. Sebelum ini satu-satunya jalan memperbaikinya adalah menambah baris
   di prompts/glossary.txt lalu MENTRANSKRIPSI ULANG -- belasan menit untuk
   membetulkan satu kata.

   Di sini koreksinya milik RESULT saja:

     - transkrip di cache/ tidak disentuh sama sekali
     - kata yang dibetulkan disimpan di KOREKSI, berkunci waktu mulai katanya
     - saat render, daftar kata yang sudah dibetulkan ikut dikirim ke server

   Transkrip punya alurnya sendiri; ini mode edit, bukan mode transkripsi.
   ========================================================================== */

let KOREKSI = {};        // { "12.345": "kata yang benar" }

const kunciKata = (w) => w.start.toFixed(3);

/* Kata-kata yang benar-benar masuk result, sudah dengan koreksinya. */
function kataResult() {
  if (typeof activeClip === "undefined" || !activeClip?.spans?.length) return [];
  const semua = realTranscript?.words || [];
  const keluar = [];
  for (const w of semua) {
    const masuk = activeClip.spans.some((p) => w.start >= p.start && w.end <= p.end);
    if (!masuk) continue;
    const k = kunciKata(w);
    keluar.push({
      start: w.start, end: w.end,
      asli: w.text.trim(),
      text: (KOREKSI[k] ?? w.text).trim(),
      diubah: KOREKSI[k] !== undefined,
    });
  }
  return keluar;
}

/* Bentuk yang dikirim ke server bersama permintaan render. */
function kataUntukRender() {
  return kataResult().map((w) => ({ text: w.text, start: w.start, end: w.end }));
}

/* ---------- menggambar ---------- */

function renderTeks() {
  const list = $("#teksList");
  const note = $("#teksNote");
  if (!list) return;

  const kata = kataResult();
  const diubah = kata.filter((w) => w.diubah).length;
  const reset = $("#teksResetBtn");
  if (reset) reset.disabled = diubah === 0;

  if (!kata.length) {
    list.innerHTML = `<p class="kosong-hasil">Belum ada teks. Susun result dulu di
      atas, teks captionnya muncul di sini.</p>`;
    if (note) note.textContent = "belum ada";
    return;
  }

  if (note) {
    note.textContent = diubah
      ? `${kata.length} kata · ${diubah} dibetulkan`
      : `${kata.length} kata · klik kata untuk membetulkan`;
  }

  list.innerHTML = kata.map((w) => `
    <button class="kata-teks${w.diubah ? " diubah" : ""}" data-mulai="${kunciKata(w)}"
            title="${jamRange(w.start)}${w.diubah ? ` · asalnya &quot;${escapeHTML(w.asli)}&quot;` : ""}"
    >${escapeHTML(w.text)}</button>`).join("");
}

/* ---------- membetulkan satu kata ----------
   Ditulis defensif dengan sengaja. Versi pertama mengosongkan isi tombol lalu
   menaruh <input> di dalamnya, dan menyerahkan penyimpanan sepenuhnya ke event
   blur. Dua akibatnya buruk:

     - kalau fokus tidak mendarat, blur tidak pernah terjadi dan koreksinya
       hilang tanpa jejak
     - kalau proses edit terputus, tombolnya tinggal kosong -- katanya lenyap
       dari daftar

   Sekarang keadaan edit dipegang di satu tempat, penyimpanannya idempoten,
   dan daftar SELALU digambar ulang di akhir supaya tidak ada tombol kosong. */

let sedangEdit = null;      // { kunci, semula, input }

function selesaiEdit(batal) {
  if (!sedangEdit) return;
  const { kunci, semula, input } = sedangEdit;
  sedangEdit = null;                       // dulu, supaya tidak dipanggil dua kali

  if (!batal) {
    const baru = input.value.trim();
    const asli = (realTranscript?.words || [])
      .find((w) => kunciKata(w) === kunci)?.text.trim() ?? semula;
    // Dikembalikan ke aslinya = bukan koreksi lagi.
    if (!baru || baru === asli) delete KOREKSI[kunci];
    else KOREKSI[kunci] = baru;
  }

  renderTeks();                            // tombol kosong mustahil bertahan
  if (typeof drawCaption === "function") drawCaption();
}

function mulaiEdit(b) {
  if (sedangEdit) selesaiEdit(false);      // yang sebelumnya disimpan dulu
  const kunci = b.dataset.mulai;
  const semula = b.textContent.trim();

  const input = document.createElement("input");
  input.className = "kata-input";
  input.value = semula;
  input.size = Math.max(3, semula.length);
  b.textContent = "";
  b.appendChild(input);
  sedangEdit = { kunci, semula, input };

  input.focus();
  input.select();

  input.addEventListener("blur", () => selesaiEdit(false));
  input.addEventListener("change", () => selesaiEdit(false));
  input.addEventListener("keydown", (ev) => {
    ev.stopPropagation();                  // jangan picu pintasan , . spasi
    if (ev.key === "Enter") { ev.preventDefault(); selesaiEdit(false); }
    else if (ev.key === "Escape") { ev.preventDefault(); selesaiEdit(true); }
    else if (ev.key === "Tab") {
      // berpindah ke kata sebelah, supaya bisa membetulkan beruntun
      ev.preventDefault();
      selesaiEdit(false);
      const semua = [...document.querySelectorAll(".kata-teks")];
      const i = semua.findIndex((x) => x.dataset.mulai === kunci);
      const tujuan = semua[i + (ev.shiftKey ? -1 : 1)];
      if (tujuan) mulaiEdit(tujuan);
    }
  });
}

$("#teksList")?.addEventListener("click", (e) => {
  const b = e.target.closest(".kata-teks");
  if (!b || b.querySelector("input")) return;
  mulaiEdit(b);
});

$("#teksResetBtn")?.addEventListener("click", () => {
  KOREKSI = {};
  renderTeks();
  if (typeof drawCaption === "function") drawCaption();
});

/* Video baru = transkrip lain, koreksi lama tidak berlaku. */
function resetTeks() {
  KOREKSI = {};
  renderTeks();
}
