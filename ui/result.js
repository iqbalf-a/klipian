/* klipian — wadah Result
   ==========================================================================
   Result adalah SATU video: semua range di dalamnya disambung jadi satu MP4.
   Dua keran mengisi wadah yang sama:

       timeline  ──  pilih range sendiri     ─┐
                                              ├──>  RESULT  ──>  render
       Claude    ──  pilih dari rekomendasi  ─┘

   Dua aturan yang dipaksakan di sini, bukan di layar:

   1. URUT WAKTU. Mesin render menolak potongan yang tidak urut, jadi range
      selalu disimpan terurut menit kecil dulu -- bukan urutan kamu memasukkan.

   2. TIDAK BOLEH TUMPANG TINDIH. Range yang bersinggungan digabung jadi satu,
      karena dua potongan yang beririsan akan membuat detik yang sama muncul
      dua kali di video hasil.
   ========================================================================== */

let RESULT = [];          // [{ id, start, end, title, source }]
let resultSeq = 0;

const resultTotal = () => RESULT.reduce((t, r) => t + (r.end - r.start), 0);

/* Masukkan satu range. Mengembalikan alasan penolakan, atau null kalau masuk. */
function addToResult(start, end, title, source) {
  start = Number(start); end = Number(end);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return "could not read that time";
  if (end - start < 0.5) return "range is too short";

  // Gabung dengan yang bersinggungan supaya tidak ada detik yang dobel.
  const bersinggungan = RESULT.filter((r) => start < r.end && end > r.start);
  if (bersinggungan.length) {
    start = Math.min(start, ...bersinggungan.map((r) => r.start));
    end = Math.max(end, ...bersinggungan.map((r) => r.end));
    title = title || bersinggungan[0].title;
    RESULT = RESULT.filter((r) => !bersinggungan.includes(r));
  }

  RESULT.push({
    id: `r${++resultSeq}`,
    start, end,
    title: title || `Clip ${RESULT.length + 1}`,
    source: source || "manual",
  });
  RESULT.sort((a, b) => a.start - b.start);
  renderResult();
  return null;
}

function removeFromResult(id) {
  RESULT = RESULT.filter((r) => r.id !== id);
  renderResult();
}

function clearResult() {
  RESULT = [];
  renderResult();
}

/* Judul bawaan: judul potongan pertama, atau nama umum kalau isinya campuran. */
function judulBawaan() {
  if (!RESULT.length) return "";
  return RESULT.length === 1 ? RESULT[0].title : `${RESULT[0].title} +${RESULT.length - 1}`;
}

/* Result -> satu klip yang dimengerti mesin render. Semua range jadi spans,
   dan spans itulah yang disambung ffmpeg jadi satu berkas. */
function resultAsClip() {
  if (!RESULT.length) return null;
  const ketik = $("#hasilJudul")?.value.trim();
  return {
    title: ketik || judulBawaan(),
    spans: RESULT.map((r) => ({ start: r.start, end: r.end })),
    startSec: RESULT[0].start,
    endSec: RESULT[RESULT.length - 1].end,
    dur: Math.round(resultTotal()),
  };
}

/* ---------- menggambar ---------- */

/* Setiap perubahan Result lewat sini -- tambah, buang, kosongkan. Pemicu
   simpan dipasang di sini, bukan di tiap pemanggil: satu pemanggil yang
   terlewat berarti pekerjaan hilang diam-diam, dan itu jenis kegagalan yang
   paling menyebalkan. Penyimpanannya ditunda, jadi panggilan berlebih dari
   pergantian layar tidak jadi beban. */
function renderResult() {
  if (typeof simpanProject === "function") simpanProject();
  const list = $("#hasilList");
  const total = $("#hasilTotal");
  if (!list) return;

  if (!RESULT.length) {
    list.innerHTML = `<p class="kosong-hasil">Result is empty. Pick a suggestion above, or
      select a range yourself on the timeline.</p>`;
    if (total) total.textContent = "empty";
    const clr = $("#hasilClearBtn"); if (clr) clr.disabled = true;
    const btn = $("#hasilRenderBtn"); if (btn) btn.disabled = true;
    const ringkas = $("#hasilRingkas"); if (ringkas) ringkas.textContent = "";
    if (typeof setResultAsPreview === "function") setResultAsPreview();
    if (typeof drawTotalTimeline === "function") drawTotalTimeline();
  if (typeof renderTeks === "function") renderTeks();
    return;
  }

  list.innerHTML = RESULT.map((r, i) => `
    <div class="hasil-row" data-hasil="${r.id}">
      <span class="num">${i + 1}</span>
      <span class="hasil-judul">${escapeHTML(r.title)}</span>
      <span class="data hasil-waktu">${jamRange(r.start)} – ${jamRange(r.end)}</span>
      <span class="data hasil-dur">${Math.round(r.end - r.start)}s</span>
      <span class="lencana-asal" data-asal="${r.source}">${r.source === "ai" ? "AI" : "manual"}</span>
      <button class="icon buang-hasil" data-buang-hasil="${r.id}"
              aria-label="Remove ${escapeHTML(r.title)} from Result">×</button>
    </div>`).join("");

  if (total) {
    total.textContent = `${RESULT.length} span${RESULT.length > 1 ? "s" : ""} · ${Math.round(resultTotal())}s`;
  }
  const clr = $("#hasilClearBtn"); if (clr) clr.disabled = false;

  const judul = $("#hasilJudul");
  if (judul && !judul.value.trim()) judul.placeholder = judulBawaan();
  const btn = $("#hasilRenderBtn"); if (btn) btn.disabled = false;
  const ringkas = $("#hasilRingkas");
  if (ringkas) {
    ringkas.textContent = RESULT.length === 1
      ? "one MP4 file"
      : `${RESULT.length} spans joined into one MP4`;
  }

  // Preview memutar result, jadi ikut diperbarui.
  if (typeof setResultAsPreview === "function") setResultAsPreview();
  // Penanda di timeline ikut result. Tanpa ini, potongan yang sudah dibuang
  // tetap tergambar kuning dan lama-lama batangnya penuh tumpukan.
  if (typeof drawTotalTimeline === "function") drawTotalTimeline();
  if (typeof renderTeks === "function") renderTeks();
}

/* ---------- rekomendasi AI: menit dan judul saja ---------- */

function renderRecommendations() {
  const list = $("#rekomList");
  const note = $("#rekomNote");
  if (!list) return;
  const daftar = (DATA?.candidates) || [];

  // Daftarnya bisa berubah total (impor ulang dari Claude) sementara preview
  // masih menunjuk ke indeks lama -- ditutup dulu supaya tidak menunjuk ke
  // rekomendasi yang salah setelah render ulang.
  if (typeof tutupPreviewRekom === "function") tutupPreviewRekom();

  if (!daftar.length) {
    list.innerHTML = `<p class="kosong-hasil">No suggestions yet. Import Claude's JSON on the
      Analyze screen, or just select a range on the timeline.</p>`;
    if (note) note.textContent = "none yet";
    const b = $("#rekomAddBtn"); if (b) b.disabled = true;
    return;
  }

  // Sengaja ringkas: menit, judul, durasi. Skor dan alasan tidak membantu
  // memutuskan di layar ini -- yang dibutuhkan cuma "ambil atau tidak".
  //
  // Waktunya BISA DIEDIT: Claude kadang menunjuk detik yang meleset sedikit
  // dari yang dimaksud, dan sebelum ini satu-satunya jalan membetulkannya
  // adalah menolak seluruh rekomendasi lalu memilih rentang sendiri di
  // timeline. Formatnya mm:ss, sama seperti kolom "from"/"to" di atas --
  // bukan detik mentah -- supaya satu konvensi dipakai di seluruh layar ini.
  list.innerHTML = daftar.map((k, i) => `
    <label class="rekom-row">
      <button class="rekom-play" type="button" data-play="${i}"
              aria-label="Preview ${escapeHTML(k.title)}" aria-pressed="false">▶</button>
      <input type="checkbox" data-rekom="${i}">
      <span class="num">${i + 1}</span>
      <span class="rekom-judul">${escapeHTML(k.title)}</span>
      <span class="rekom-waktu">
        <input type="text" class="rekom-waktu-in" value="${jamPendek(k.startSec)}"
               data-idx="${i}" data-field="startSec" size="5" spellcheck="false"
               aria-label="Start time for ${escapeHTML(k.title)}">
        <span aria-hidden="true">–</span>
        <input type="text" class="rekom-waktu-in" value="${jamPendek(k.endSec)}"
               data-idx="${i}" data-field="endSec" size="5" spellcheck="false"
               aria-label="End time for ${escapeHTML(k.title)}">
      </span>
      <span class="data rekom-dur">${k.dur}s</span>
    </label>`).join("");
  if (note) note.textContent = `${daftar.length} suggestion${daftar.length > 1 ? "s" : ""}`;
  perbaruiTombolRekom();
}

/* ---------- pratinjau video sumber utuh, sebelum masuk Result ----------
   Panel 9:16 di kanan sudah dipakai (terkunci ke Result), jadi ini elemen
   video TERPISAH, khusus untuk melihat rentang mentah sebuah rekomendasi
   apa adanya -- belum dipotong, belum dibingkai, karena keduanya memang
   belum berarti apa-apa sebelum rentangnya masuk Result.

   Duduk di panel Timeline, DI ATAS bar #tlTotal -- bukan di panel AI
   suggestions -- karena keduanya menunjuk video yang SAMA: sebuah playhead
   pasif di #tlTotal bergerak mengikuti posisi video ini, memberi konteks
   "rentang ini ada di menit berapa dari total 42:03". Bar itu sendiri
   TIDAK berubah perilakunya -- klik/geser di sana tetap murni untuk
   memilih rentang manual, playhead tidak bisa disentuh. */

let previewIdx = null;      // indeks rekomendasi yang sedang dipratinjau
let previewBatas = null;    // detik akhir -- video berhenti sendiri di sini

function ikonPlayRekom() {
  // Bukan cuma "baris ini yang aktif" -- harus "baris ini yang aktif DAN
  // videonya benar-benar sedang jalan". Tanpa syarat kedua, ikon tetap ⏸
  // selamanya sesudah dijeda manual atau berhenti sendiri di endSec --
  // padahal videonya sudah diam.
  const v = $("#tlPreviewVideo");
  const sedangMain = !!(v && !v.paused);
  document.querySelectorAll(".rekom-play").forEach((b) => {
    const aktif = Number(b.dataset.play) === previewIdx && sedangMain;
    b.textContent = aktif ? "⏸" : "▶";
    b.setAttribute("aria-pressed", String(aktif));
  });
  const tombolSendiri = $("#tlPreviewPlay");
  if (tombolSendiri) tombolSendiri.textContent = sedangMain ? "❚❚" : "▶";
}

function tutupPreviewRekom() {
  $("#tlPreviewVideo")?.pause();
  previewIdx = null;
  previewBatas = null;
  $("#tlPreview")?.setAttribute("hidden", "");
  $("#tlPlayhead")?.setAttribute("hidden", "");
  ikonPlayRekom();
}

function putarPreviewRekom(idx) {
  const k = (DATA?.candidates || [])[idx];
  const box = $("#tlPreview"), v = $("#tlPreviewVideo");
  if (!k || !box || !v || !chosenSource?.url) return;

  // Menekan tombol yang SAMA saat sedang jalan berarti jeda, bukan mengulang.
  if (previewIdx === idx && !v.paused) { v.pause(); return; }

  // Preview Result dan preview rekomendasi tidak boleh berbunyi bersamaan.
  if (typeof video !== "undefined" && video && !video.paused) {
    video.pause();
    if (typeof isPlaying !== "undefined") isPlaying = false;
    if (typeof playBtn !== "undefined" && playBtn) playBtn.textContent = "▶";
  }

  box.removeAttribute("hidden");
  $("#tlPlayhead")?.removeAttribute("hidden");
  const titleEl = $("#tlPreviewTitle");
  if (titleEl) titleEl.textContent = `${jamPendek(k.startSec)} – ${jamPendek(k.endSec)} · ${k.title}`;

  previewIdx = idx;
  previewBatas = k.endSec;
  ikonPlayRekom();

  const mulai = () => {
    try { v.currentTime = k.startSec; } catch { /* metadata belum siap */ }
    v.play().catch(() => {});
  };
  // `v.src` SELALU berupa URL absolut begitu dibaca balik -- browser
  // meresolusinya sendiri -- sedangkan chosenSource.url relatif ("/samples/
  // ..."). Membandingkannya apa adanya SELALU meleset, jadi video di-reload
  // ulang dari awal setiap kali Play ditekan, bahkan untuk suggestion dari
  // video yang sama: buffering yang terbuang, dan sesaat sesudah klik video
  // masih kelihatan diam menunggu loadedmetadata padahal seharusnya sudah
  // langsung jalan. Dua-duanya diresolusi ke bentuk absolut dulu sebelum
  // dibandingkan.
  const srcAbsolut = new URL(chosenSource.url, location.href).href;
  if (v.src !== srcAbsolut) {
    v.src = chosenSource.url;
    v.addEventListener("loadedmetadata", mulai, { once: true });
  } else {
    mulai();
  }
}

// Berhenti sendiri persis di detik akhir rekomendasi -- pratinjau rentang
// INI saja, bukan lanjut ke bagian video sesudahnya yang tidak relevan.
// Sekalian menggerakkan playhead di bar #tlTotal dan jam "posisi / total".
$("#tlPreviewVideo")?.addEventListener("timeupdate", (e) => {
  const v = e.target;
  if (previewBatas !== null && v.currentTime >= previewBatas) v.pause();

  const jam = $("#tlPreviewTime");
  if (jam && typeof durasiVideo === "function") {
    jam.textContent = `${jamRange(v.currentTime)} / ${jamRange(durasiVideo())}`;
  }
  const head = $("#tlPlayhead");
  if (head && typeof keFrac === "function") {
    head.style.left = `${keFrac(v.currentTime) * 100}%`;
  }
});
$("#tlPreviewVideo")?.addEventListener("pause", ikonPlayRekom);
$("#tlPreviewVideo")?.addEventListener("play", ikonPlayRekom);
$("#tlPreviewClose")?.addEventListener("click", tutupPreviewRekom);

// Kontrol sendiri: menjeda/melanjutkan apa pun yang sedang dimuat, TANPA
// perlu kembali ke baris AI suggestion yang memuatnya. Kalau video sudah
// lewat batas akhir rekomendasi (berhenti sendiri sebelumnya), menekan Play
// di sini mengulang dari awal rentang itu -- sama seperti menekan lagi
// tombol Play di barisnya.
$("#tlPreviewPlay")?.addEventListener("click", () => {
  const v = $("#tlPreviewVideo");
  if (!v || !v.src) return;
  if (!v.paused) { v.pause(); return; }
  if (previewBatas !== null && v.currentTime >= previewBatas - 0.05) {
    const k = (DATA?.candidates || [])[previewIdx];
    if (k) { try { v.currentTime = k.startSec; } catch { /* metadata belum siap */ } }
  }
  v.play().catch(() => {});
});

/* Rasio kotak dikunci ke rasio SUMBER ASLI begitu metadatanya datang, bukan
   dibiarkan pada nilai 16:9 di CSS. Sumber landscape yang bukan persis 16:9
   (jarang, tapi ada) akan membuat kotaknya melompat ukuran begitu videonya
   selesai dimuat kalau ini tidak dikerjakan -- dikunci sekali di awal supaya
   tidak ada lompatan sama sekali. */
$("#tlPreviewVideo")?.addEventListener("loadedmetadata", (e) => {
  const v = e.target;
  if (v.videoWidth && v.videoHeight) {
    v.style.aspectRatio = `${v.videoWidth} / ${v.videoHeight}`;
  }
});

/* Maju/mundur satu frame -- untuk memastikan pas TIDAK memotong kata atau
   memulai di tengah gerakan, sama seperti kontrol serupa di preview Result.
   Melangkah sambil jalan itu aneh, jadi dijeda dulu kalau perlu. Dibiarkan
   bebas melewati batas rentang suggestion (previewBatas): justru itu
   gunanya -- menilai apakah batasnya perlu digeser sedikit. */
function tlPreviewStepFrame(arah) {
  const v = $("#tlPreviewVideo");
  if (!v || !v.src) return;
  if (!v.paused) v.pause();
  const fps = (typeof sourceFps === "number" && sourceFps > 0) ? sourceFps : 30;
  const batas = v.duration || Infinity;
  const tujuan = Math.max(0, Math.min(batas - 1 / fps / 2, v.currentTime + arah / fps));
  try { v.currentTime = tujuan; } catch { /* di luar jangkauan */ }
}
$("#tlPreviewPrev")?.addEventListener("click", () => tlPreviewStepFrame(-1));
$("#tlPreviewNext")?.addEventListener("click", () => tlPreviewStepFrame(1));

$("#rekomList")?.addEventListener("click", (e) => {
  const btn = e.target.closest(".rekom-play");
  if (!btn) return;
  e.preventDefault();       // jangan sampai ikut mencentang baris
  putarPreviewRekom(Number(btn.dataset.play));
});

/* Membetulkan waktu satu rekomendasi. `label` membungkus checkbox DAN kedua
   kolom ini -- klik pada teks biasa mencentang baris (perilaku <label>
   bawaan), tapi klik pada input tetap fokus ke input, bukan ikut mencentang;
   itu perilaku standar browser untuk form control bersarang, bukan sesuatu
   yang perlu ditangani manual di sini.

   Titiknya ikut dirapikan ke batas kata terdekat (snapToWord), sama seperti
   seleksi manual di timeline -- satu aturan potong berlaku di mana pun. */
$("#rekomList")?.addEventListener("change", (e) => {
  const inp = e.target.closest(".rekom-waktu-in");
  if (!inp) return;
  const idx = Number(inp.dataset.idx);
  const field = inp.dataset.field;
  const k = (DATA?.candidates || [])[idx];
  if (!k) return;

  const kembalikan = () => { inp.value = jamPendek(k[field]); };
  const mentah = bacaWaktu(inp.value);
  if (mentah === null) { kembalikan(); return; }
  const detik = (typeof snapToWord === "function")
    ? snapToWord(mentah, field === "startSec" ? "start" : "end")
    : mentah;

  const lain = field === "startSec" ? k.endSec : k.startSec;
  if (field === "startSec" ? detik >= lain : detik <= lain) { kembalikan(); return; }

  k[field] = detik;
  k.dur = Math.round(k.endSec - k.startSec);
  inp.value = jamPendek(detik);
  const baris = inp.closest(".rekom-row");
  const durEl = baris?.querySelector(".rekom-dur");
  if (durEl) durEl.textContent = `${k.dur}s`;
});

function perbaruiTombolRekom() {
  const b = $("#rekomAddBtn");
  if (!b) return;
  const n = document.querySelectorAll("#rekomList input:checked").length;
  b.disabled = n === 0;
  b.textContent = n ? `Add ${n} to Result` : "Add to Result";
}

/* ---------- kejadian ---------- */

$("#rekomList")?.addEventListener("change", perbaruiTombolRekom);

$("#rekomAddBtn")?.addEventListener("click", () => {
  const dipilih = [...document.querySelectorAll("#rekomList input:checked")];
  const daftar = DATA.candidates || [];
  let ditolak = 0;
  for (const c of dipilih) {
    const k = daftar[Number(c.dataset.rekom)];
    if (!k) continue;
    if (addToResult(k.startSec, k.endSec, k.title, "ai")) ditolak++;
    c.checked = false;
  }
  perbaruiTombolRekom();
  if (ditolak) {
    $("#editNote").textContent = `${ditolak} suggestion${ditolak > 1 ? "s" : ""} skipped — invalid timing`;
  }
});

$("#hasilList")?.addEventListener("click", (e) => {
  const b = e.target.closest("[data-buang-hasil]");
  if (b) removeFromResult(b.dataset.buangHasil);
});

$("#hasilClearBtn")?.addEventListener("click", clearResult);

/* Video baru = result ikut dikosongkan, seperti daftar objek. */
function resetResult() {
  RESULT = [];
  resultSeq = 0;
  renderResult();
  renderRecommendations();
}

/* Render: seluruh result jadi SATU berkas. */
$("#hasilRenderBtn")?.addEventListener("click", () => {
  const klip = resultAsClip();
  if (!klip) return;
  if (typeof kirimRender === "function") kirimRender([klip]);
});

/* Jalur manual dimulai di layar Klip: timeline ada di sana. */
$("#manualClip")?.addEventListener("click", () => toScreen("klip"));
