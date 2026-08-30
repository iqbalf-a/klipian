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

/* ---------- kata pengisi ("eh", "anu", "hmm"...) ----------
   Daftarnya sengaja pendek dan hanya interjeksi MURNI. Kata seperti "kan"
   atau "gitu" sering dipakai sebagai pengisi juga, tapi keduanya tetap kata
   fungsi yang sah di kalimat lain -- membuangnya buta bisa merusak makna.
   Pelajaran yang sama seperti ambang "kata mungkin salah dengar" di
   glosarium (README): ambang longgar menandai 10,3% kata dan hampir semuanya
   ternyata benar. Interjeksi murni jauh lebih aman: kalimat tetap utuh
   tanpanya, apa pun konteksnya.

   Dicek terhadap w.text (SUDAH lewat koreksi), bukan w.asli -- kalau Whisper
   salah dengar kata sungguhan sebagai "eh" dan orangnya sudah membetulkannya
   di layar ini, koreksi itu yang harus dihormati, bukan tebakan Whisper. */
const KATA_PENGISI = new Set([
  "eh", "ee", "eee", "em", "emm", "ehm", "hmm", "hm", "mm", "anu", "euh",
]);

const kataPengisiKah = (teks) =>
  KATA_PENGISI.has(teks.toLowerCase().replace(/[^\p{L}]/gu, ""));

function kataPengisiDiResult() {
  return kataResult().filter((w) => kataPengisiKah(w.text));
}

/* Membelah tiap potongan Result di sekitar kata pengisi -- mekanisme yang
   sama dengan "buang bagian tengah" (lihat README): Result tetap daftar
   rentang waktu, cuma jadi lebih banyak rentang yang lebih pendek. Potongan
   yang tersisa lebih pendek dari 0,05 detik dibuang alih-alih ditinggalkan
   sebagai rentang nyaris-nol yang tidak berarti apa-apa. */
function buangKataPengisi() {
  const pengisi = kataPengisiDiResult();
  if (!pengisi.length || typeof RESULT === "undefined") return 0;
  const AMBANG = 0.05;
  const baru = [];
  for (const r of RESULT) {
    let kursor = r.start;
    const dalam = pengisi
      .filter((w) => w.start >= r.start && w.end <= r.end)
      .sort((a, b) => a.start - b.start);
    for (const w of dalam) {
      if (w.start - kursor > AMBANG) {
        baru.push({ ...r, id: `r${++resultSeq}`, start: kursor, end: w.start });
      }
      kursor = w.end;
    }
    if (r.end - kursor > AMBANG) {
      baru.push({ ...r, id: `r${++resultSeq}`, start: kursor, end: r.end });
    }
  }
  RESULT = baru;
  renderResult();               // menulis project + menggambar ulang semuanya
  return pengisi.length;
}

/* ---------- menggambar ---------- */

function renderTeks() {
  const list = $("#teksList");
  const note = $("#teksNote");
  if (!list) return;

  const kata = kataResult();
  const diubah = kata.filter((w) => w.diubah).length;
  const pengisi = kata.filter((w) => kataPengisiKah(w.text)).length;
  const reset = $("#teksResetBtn");
  if (reset) reset.disabled = diubah === 0;
  const pengisiBtn = $("#teksPengisiBtn");
  if (pengisiBtn) {
    pengisiBtn.disabled = pengisi === 0;
    pengisiBtn.textContent = pengisi ? `Remove filler words (${pengisi})` : "Remove filler words";
  }

  if (!kata.length) {
    // Result ADA tapi kata-nya kosong bisa berarti dua hal yang beda:
    // videonya belum pernah ditranskripsi sama sekali (umum di jalur klip
    // manual -- README sengaja bilang "lewati langkah 2 dan 3", tapi
    // transkripsi bawaannya tetap jalan otomatis lewat layar Analisis;
    // masalahnya kalau project ini dibuka LANGSUNG ke layar Klip -- lewat
    // kartu di beranda atau pemulihan sesi -- layar Analisis, dan
    // transkripsinya, tidak pernah tersentuh), atau memang tidak ada kata
    // yang jatuh di rentang klip ini. Pesan "tambah klip dulu" menyesatkan
    // untuk kasus pertama -- klipnya sudah ada, yang kurang cuma transkrip.
    const adaKlip = typeof activeClip !== "undefined" && activeClip?.spans?.length;
    if (adaKlip && !realTranscript) {
      list.innerHTML = `<p class="kosong-hasil">Video ini belum ditranskripsi, jadi caption-nya
        belum ada teks untuk ditampilkan.
        <button class="btn main" id="autoCaptionBtn" type="button">Auto Caption</button></p>`;
      if (note) note.textContent = "belum ditranskripsi";
    } else {
      list.innerHTML = `<p class="kosong-hasil">No words yet. Build a Result first and the
        caption text will show up here.</p>`;
      if (note) note.textContent = "none yet";
    }
    return;
  }

  if (note) {
    const bagian = [`${kata.length} words`];
    if (diubah) bagian.push(`${diubah} corrected`);
    if (pengisi) bagian.push(`${pengisi} filler`);
    note.textContent = bagian.length > 1 ? bagian.join(" · ")
      : `${kata.length} words · click a word to correct it`;
  }

  list.innerHTML = kata.map((w) => {
    const isPengisi = kataPengisiKah(w.text);
    return `
    <button class="kata-teks${w.diubah ? " diubah" : ""}${isPengisi ? " pengisi" : ""}"
            data-mulai="${kunciKata(w)}"
            title="${jamRange(w.start)}${w.diubah ? ` · was &quot;${escapeHTML(w.asli)}&quot;` : ""}${isPengisi ? " · filler word" : ""}"
    >${escapeHTML(w.text)}</button>`;
  }).join("");
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
  if (typeof simpanProject === "function") simpanProject();
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

/* ---------- Auto Caption: transkripsi dipicu langsung dari layar ini ----
   Jalur manual boleh melewati layar Analisis sepenuhnya (buka project lewat
   kartu beranda / pemulihan sesi, langsung ke Klip) -- tidak ada yang pernah
   memicu transkripsi untuk video itu. Tombol ini jalur pintasnya, tanpa
   harus pindah ke Analisis dulu. */
let autoCaptionTimer = null;

async function mulaiAutoCaption(btn) {
  const video = (typeof chosenSource !== "undefined" && chosenSource?.name)
    || (typeof DATA !== "undefined" ? DATA.file : "");
  if (!video) return;
  const note = $("#teksNote");
  if (btn) btn.disabled = true;
  if (note) note.textContent = "memulai transkripsi …";

  let id;
  try {
    const reply = await fetch("/api/transcribe", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ video }),
    }).then((r) => r.json());
    if (reply.error) throw new Error(reply.error);
    id = reply.id;
  } catch {
    if (note) note.textContent = "Butuh backend. Jalankan: python -m klipian serve";
    if (btn) btn.disabled = false;
    return;
  }

  clearInterval(autoCaptionTimer);
  autoCaptionTimer = setInterval(async () => {
    let t;
    try { t = await (await fetch(`/api/transcribe/${id}`)).json(); }
    catch { return; }                        // server sesaat tidak menyahut -- coba lagi

    if (t.state === "running") {
      if (note) note.textContent = `mentranskripsi … ${t.percent || 0}%`;
      return;
    }
    clearInterval(autoCaptionTimer);
    if (t.state === "failed") {
      if (note) note.textContent = `Transkripsi gagal: ${t.error}`;
      if (btn) btn.disabled = false;
      return;
    }
    // done: transkrip sudah ada di cache/, tinggal dibaca ke sisi klien.
    if (typeof findTranscript === "function") {
      realTranscript = await findTranscript(video);
    }
    renderTeks();
    if (typeof drawCaption === "function") drawCaption();
  }, 900);
}

$("#teksList")?.addEventListener("click", (e) => {
  const autoBtn = e.target.closest("#autoCaptionBtn");
  if (autoBtn) { mulaiAutoCaption(autoBtn); return; }
  const b = e.target.closest(".kata-teks");
  if (!b || b.querySelector("input")) return;
  mulaiEdit(b);
});

$("#teksResetBtn")?.addEventListener("click", () => {
  KOREKSI = {};
  renderTeks();
  if (typeof drawCaption === "function") drawCaption();
});

$("#teksPengisiBtn")?.addEventListener("click", () => {
  // renderTeks() (dipanggil dari dalam renderResult(), lihat buangKataPengisi
  // di atas) sudah menggambar ulang daftar kata dan menyimpan project --
  // tidak ada yang perlu dilakukan lagi di sini.
  buangKataPengisi();
});

/* Video baru = transkrip lain, koreksi lama tidak berlaku. */
function resetTeks() {
  KOREKSI = {};
  renderTeks();
}
