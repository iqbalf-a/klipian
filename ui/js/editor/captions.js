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

let CORRECTIONS = {};    // { "12.345": "kata yang benar" }

const wordKey = (w) => w.start.toFixed(3);

/* Kata-kata yang benar-benar masuk result, sudah dengan koreksinya. */
function resultWords() {
  if (typeof activeClip === "undefined" || !activeClip?.spans?.length) return [];
  const allWords = realTranscript?.words || [];
  const out = [];
  for (const w of allWords) {
    const inSpan = activeClip.spans.some((p) => w.start >= p.start && w.end <= p.end);
    if (!inSpan) continue;
    const k = wordKey(w);
    out.push({
      start: w.start, end: w.end,
      original: w.text.trim(),
      text: (CORRECTIONS[k] ?? w.text).trim(),
      edited: CORRECTIONS[k] !== undefined,
    });
  }
  return out;
}

/* Bentuk yang dikirim ke server bersama permintaan render. */
function wordsForRender() {
  return resultWords().map((w) => ({ text: w.text, start: w.start, end: w.end }));
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
const FILLER_WORDS = new Set([
  "eh", "ee", "eee", "em", "emm", "ehm", "hmm", "hm", "mm", "anu", "euh",
]);

const isFillerWord = (text) =>
  FILLER_WORDS.has(text.toLowerCase().replace(/[^\p{L}]/gu, ""));

function fillerWordsInResult() {
  return resultWords().filter((w) => isFillerWord(w.text));
}

/* Membelah tiap potongan Result di sekitar kata pengisi -- mekanisme yang
   sama dengan "buang bagian tengah" (lihat README): Result tetap daftar
   rentang waktu, cuma jadi lebih banyak rentang yang lebih pendek. Potongan
   yang tersisa lebih pendek dari 0,05 detik dibuang alih-alih ditinggalkan
   sebagai rentang nyaris-nol yang tidak berarti apa-apa. */
function removeFillerWords() {
  const fillers = fillerWordsInResult();
  if (!fillers.length || typeof RESULT === "undefined") return 0;
  const THRESHOLD = 0.05;
  const next = [];
  for (const r of RESULT) {
    let cursor = r.start;
    const withinSpan = fillers
      .filter((w) => w.start >= r.start && w.end <= r.end)
      .sort((a, b) => a.start - b.start);
    for (const w of withinSpan) {
      if (w.start - cursor > THRESHOLD) {
        next.push({ ...r, id: `r${++resultSeq}`, start: cursor, end: w.start });
      }
      cursor = w.end;
    }
    if (r.end - cursor > THRESHOLD) {
      next.push({ ...r, id: `r${++resultSeq}`, start: cursor, end: r.end });
    }
  }
  RESULT = next;
  renderResult();               // menulis project + menggambar ulang semuanya
  return fillers.length;
}

/* ---------- menggambar ---------- */

function renderCaptions() {
  const list = $("#textList");
  const note = $("#textNote");
  if (!list) return;

  const words = resultWords();
  const editedCount = words.filter((w) => w.edited).length;
  const fillerCount = words.filter((w) => isFillerWord(w.text)).length;
  const reset = $("#textResetBtn");
  if (reset) reset.disabled = editedCount === 0;
  const fillerBtn = $("#textFillerBtn");
  if (fillerBtn) {
    fillerBtn.disabled = fillerCount === 0;
    fillerBtn.textContent = fillerCount ? `Remove filler words (${fillerCount})` : "Remove filler words";
  }

  if (!words.length) {
    // Result ADA tapi kata-nya kosong bisa berarti dua hal yang beda:
    // videonya belum pernah ditranskripsi sama sekali (umum di jalur klip
    // manual -- README sengaja bilang "lewati langkah 2 dan 3", tapi
    // transkripsi bawaannya tetap jalan otomatis lewat layar Analisis;
    // masalahnya kalau project ini dibuka LANGSUNG ke layar Klip -- lewat
    // kartu di beranda atau pemulihan sesi -- layar Analisis, dan
    // transkripsinya, tidak pernah tersentuh), atau memang tidak ada kata
    // yang jatuh di rentang klip ini. Pesan "tambah klip dulu" menyesatkan
    // untuk kasus pertama -- klipnya sudah ada, yang kurang cuma transkrip.
    const hasClip = typeof activeClip !== "undefined" && activeClip?.spans?.length;
    if (hasClip && !realTranscript) {
      list.innerHTML = `<p class="empty-message">Video ini belum ditranskripsi, jadi caption-nya
        belum ada teks untuk ditampilkan.
        <button class="btn main" id="autoCaptionBtn" type="button">Auto Caption</button></p>`;
      if (note) note.textContent = "belum ditranskripsi";
    } else {
      list.innerHTML = `<p class="empty-message">No words yet. Build a Result first and the
        caption text will show up here.</p>`;
      if (note) note.textContent = "none yet";
    }
    return;
  }

  if (note) {
    const parts = [`${words.length} words`];
    if (editedCount) parts.push(`${editedCount} corrected`);
    if (fillerCount) parts.push(`${fillerCount} filler`);
    note.textContent = parts.length > 1 ? parts.join(" · ")
      : `${words.length} words · click a word to correct it`;
  }

  list.innerHTML = words.map((w) => {
    const isFiller = isFillerWord(w.text);
    return `
    <button class="word-text${w.edited ? " diubah" : ""}${isFiller ? " pengisi" : ""}"
            data-start="${wordKey(w)}"
            title="${timeRange(w.start)}${w.edited ? ` · was &quot;${escapeHTML(w.original)}&quot;` : ""}${isFiller ? " · filler word" : ""}"
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

let editingWord = null;      // { key, previousValue, input }

function finishEdit(cancel) {
  if (!editingWord) return;
  const { key, previousValue, input } = editingWord;
  editingWord = null;                      // dulu, supaya tidak dipanggil dua kali

  if (!cancel) {
    const value = input.value.trim();
    const originalWord = (realTranscript?.words || [])
      .find((w) => wordKey(w) === key)?.text.trim() ?? previousValue;
    // Dikembalikan ke aslinya = bukan koreksi lagi.
    if (!value || value === originalWord) delete CORRECTIONS[key];
    else CORRECTIONS[key] = value;
  }

  renderCaptions();                        // tombol kosong mustahil bertahan
  if (typeof drawCaption === "function") drawCaption();
  if (typeof saveProject === "function") saveProject();
}

function startEdit(b) {
  if (editingWord) finishEdit(false);      // yang sebelumnya disimpan dulu
  const key = b.dataset.start;
  const previousValue = b.textContent.trim();

  const input = document.createElement("input");
  input.className = "word-input";
  input.value = previousValue;
  input.size = Math.max(3, previousValue.length);
  b.textContent = "";
  b.appendChild(input);
  editingWord = { key, previousValue, input };

  input.focus();
  input.select();

  input.addEventListener("blur", () => finishEdit(false));
  input.addEventListener("change", () => finishEdit(false));
  input.addEventListener("keydown", (ev) => {
    ev.stopPropagation();                  // jangan picu pintasan , . spasi
    if (ev.key === "Enter") { ev.preventDefault(); finishEdit(false); }
    else if (ev.key === "Escape") { ev.preventDefault(); finishEdit(true); }
    else if (ev.key === "Tab") {
      // berpindah ke kata sebelah, supaya bisa membetulkan beruntun
      ev.preventDefault();
      finishEdit(false);
      const wordButtons = [...document.querySelectorAll(".word-text")];
      const i = wordButtons.findIndex((x) => x.dataset.start === key);
      const target = wordButtons[i + (ev.shiftKey ? -1 : 1)];
      if (target) startEdit(target);
    }
  });
}

/* ---------- Auto Caption: transkripsi dipicu langsung dari layar ini ----
   Jalur manual boleh melewati layar Analisis sepenuhnya (buka project lewat
   kartu beranda / pemulihan sesi, langsung ke Klip) -- tidak ada yang pernah
   memicu transkripsi untuk video itu. Tombol ini jalur pintasnya, tanpa
   harus pindah ke Analisis dulu. */
let autoCaptionTimer = null;

async function startAutoCaption(btn) {
  const video = (typeof chosenSource !== "undefined" && chosenSource?.name)
    || (typeof DATA !== "undefined" ? DATA.file : "");
  if (!video) return;
  const note = $("#textNote");
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
    renderCaptions();
    if (typeof drawCaption === "function") drawCaption();
  }, 900);
}

$("#textList")?.addEventListener("click", (e) => {
  const autoBtn = e.target.closest("#autoCaptionBtn");
  if (autoBtn) { startAutoCaption(autoBtn); return; }
  const b = e.target.closest(".word-text");
  if (!b || b.querySelector("input")) return;
  startEdit(b);
});

$("#textResetBtn")?.addEventListener("click", () => {
  CORRECTIONS = {};
  renderCaptions();
  if (typeof drawCaption === "function") drawCaption();
});

$("#textFillerBtn")?.addEventListener("click", () => {
  // renderCaptions() (dipanggil dari dalam renderResult(), lihat
  // removeFillerWords di atas) sudah menggambar ulang daftar kata dan
  // menyimpan project -- tidak ada yang perlu dilakukan lagi di sini.
  removeFillerWords();
});

/* Video baru = transkrip lain, koreksi lama tidak berlaku. */
function resetCaptions() {
  CORRECTIONS = {};
  renderCaptions();
}
