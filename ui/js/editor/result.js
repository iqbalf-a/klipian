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
  const overlapping = RESULT.filter((r) => start < r.end && end > r.start);
  if (overlapping.length) {
    start = Math.min(start, ...overlapping.map((r) => r.start));
    end = Math.max(end, ...overlapping.map((r) => r.end));
    title = title || overlapping[0].title;
    RESULT = RESULT.filter((r) => !overlapping.includes(r));
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
function defaultTitle() {
  if (!RESULT.length) return "";
  return RESULT.length === 1 ? RESULT[0].title : `${RESULT[0].title} +${RESULT.length - 1}`;
}

/* Result -> satu klip yang dimengerti mesin render. Semua range jadi spans,
   dan spans itulah yang disambung ffmpeg jadi satu berkas. */
function resultAsClip() {
  if (!RESULT.length) return null;
  const typed = $("#resultTitle")?.value.trim();
  return {
    title: typed || defaultTitle(),
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
  if (typeof saveProject === "function") saveProject();
  const list = $("#resultList");
  const total = $("#resultTotal");
  if (!list) return;

  if (!RESULT.length) {
    list.innerHTML = `<p class="empty-message">Result is empty. Pick a suggestion above, or
      select a range yourself on the timeline.</p>`;
    if (total) total.textContent = "empty";
    const clr = $("#resultClearBtn"); if (clr) clr.disabled = true;
    const btn = $("#resultRenderBtn"); if (btn) btn.disabled = true;
    const quickPreviewBtn = $("#previewCepatBtn"); if (quickPreviewBtn) quickPreviewBtn.disabled = true;
    const summaryEl = $("#resultSummary"); if (summaryEl) summaryEl.textContent = "";
    if (typeof setResultAsPreview === "function") setResultAsPreview();
    if (typeof drawTotalTimeline === "function") drawTotalTimeline();
  if (typeof renderCaptions === "function") renderCaptions();
    return;
  }

  list.innerHTML = RESULT.map((r, i) => `
    <div class="result-row" data-result="${r.id}">
      <span class="num">${i + 1}</span>
      <span class="result-title">${escapeHTML(r.title)}</span>
      <span class="data result-time">${timeRange(r.start)} – ${timeRange(r.end)}</span>
      <span class="data result-dur">${Math.round(r.end - r.start)}s</span>
      <span class="source-badge" data-source="${r.source}">${r.source === "ai" ? "AI" : "manual"}</span>
      <button class="icon delete-result" data-delete-result="${r.id}"
              aria-label="Remove ${escapeHTML(r.title)} from Result">×</button>
    </div>`).join("");

  if (total) {
    total.textContent = `${RESULT.length} span${RESULT.length > 1 ? "s" : ""} · ${Math.round(resultTotal())}s`;
  }
  const clr = $("#resultClearBtn"); if (clr) clr.disabled = false;

  const titleInput = $("#resultTitle");
  if (titleInput && !titleInput.value.trim()) titleInput.placeholder = defaultTitle();
  const btn = $("#resultRenderBtn"); if (btn) btn.disabled = false;
  const quickPreviewBtn = $("#previewCepatBtn"); if (quickPreviewBtn) quickPreviewBtn.disabled = false;
  const summaryEl = $("#resultSummary");
  if (summaryEl) {
    summaryEl.textContent = RESULT.length === 1
      ? "one MP4 file"
      : `${RESULT.length} spans joined into one MP4`;
  }

  // Preview memutar result, jadi ikut diperbarui.
  if (typeof setResultAsPreview === "function") setResultAsPreview();
  // Penanda di timeline ikut result. Tanpa ini, potongan yang sudah dibuang
  // tetap tergambar kuning dan lama-lama batangnya penuh tumpukan.
  if (typeof drawTotalTimeline === "function") drawTotalTimeline();
  if (typeof renderCaptions === "function") renderCaptions();
}

/* ---------- rekomendasi AI: menit dan judul saja ---------- */

function renderRecommendations() {
  const list = $("#recList");
  const note = $("#recNote");
  if (!list) return;
  const candidates = (DATA?.candidates) || [];

  // Daftarnya bisa berubah total (impor ulang dari Claude) sementara preview
  // masih menunjuk ke indeks lama -- ditutup dulu supaya tidak menunjuk ke
  // rekomendasi yang salah setelah render ulang.
  if (typeof closeRecPreview === "function") closeRecPreview();

  if (!candidates.length) {
    list.innerHTML = `<p class="empty-message">No suggestions yet. Import Claude's JSON on the
      Analyze screen, or just select a range on the timeline.</p>`;
    if (note) note.textContent = "none yet";
    const b = $("#recAddBtn"); if (b) b.disabled = true;
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
  //
  // Kotaknya TERKUNCI (disabled) sampai tombol pensil dipencet -- baris ini
  // ada di dalam <label> yang membungkus checkbox "pilih buat Result", dan
  // kotak waktu yang selalu bisa diklik langsung gampang tersenggol tanpa
  // sengaja. Pensil membuka kunci + fokus ke kolom "start"; begitu terbuka
  // ikonnya ganti jadi centang (Save) -- dipencet lagi buat mengunci ulang
  // SEKALIGUS memastikan nilai yang barusan diketik ter-commit (lihat
  // listener klik #recList: dispatch "change" manual, karena klik
  // langsung ke tombol Save tanpa pindah fokus dulu tidak memicu event
  // change bawaan browser).
  list.innerHTML = candidates.map((k, i) => `
    <label class="rec-row">
      <button class="rec-play" type="button" data-play="${i}"
              aria-label="Preview ${escapeHTML(k.title)}" aria-pressed="false">▶</button>
      <input type="checkbox" data-rec="${i}">
      <span class="num">${i + 1}</span>
      <span class="rec-title">${escapeHTML(k.title)}</span>
      <span class="rec-time">
        <input type="text" class="rec-time-in" value="${shortTime(k.startSec)}"
               data-idx="${i}" data-field="startSec" size="5" spellcheck="false" disabled
               aria-label="Start time for ${escapeHTML(k.title)}">
        <span aria-hidden="true">–</span>
        <input type="text" class="rec-time-in" value="${shortTime(k.endSec)}"
               data-idx="${i}" data-field="endSec" size="5" spellcheck="false" disabled
               aria-label="End time for ${escapeHTML(k.title)}">
        <button class="rec-edit" type="button" data-edit-time="${i}"
                title="Edit time" aria-label="Edit time for ${escapeHTML(k.title)}">✎</button>
      </span>
      <span class="data rec-dur">${k.dur}s</span>
    </label>`).join("");
  if (note) note.textContent = `${candidates.length} suggestion${candidates.length > 1 ? "s" : ""}`;
  updateRecButton();
}

/* ---------- pratinjau video sumber utuh, sebelum masuk Result ----------
   Panel 9:16 di kanan sudah dipakai (terkunci ke Result), jadi ini elemen
   video TERPISAH, khusus untuk melihat rentang mentah sebuah rekomendasi
   apa adanya -- belum dipotong, belum dibingkai, karena keduanya memang
   belum berarti apa-apa sebelum rentangnya masuk Result.

   Duduk di panel Timeline, DI ATAS bar #tlTotal -- bukan di panel AI
   suggestions -- karena keduanya menunjuk video yang SAMA. Panel ini SELALU
   tampil, punya bar scrub sendiri (.tl-scrub, lihat muatPreviewUtuh() dan
   handler #tlScrub di bawah) untuk pindah posisi putar bebas -- terpisah
   dari #tlTotal yang tetap 100% murni untuk memilih rentang manual. */

let previewIdx = null;      // indeks rekomendasi yang sedang dipratinjau
let previewLimit = null;    // detik akhir -- video berhenti sendiri di sini

// Memuat video sumber ke #tlPreviewVideo begitu ada, TANPA autoplay --
// panelnya sekarang selalu tampil (bukan cuma saat suggestion diputar),
// jadi harus ada isinya sedini mungkin, bukan menunggu Play ditekan.
// Dipanggil dari drawTotalTimeline() tiap kali timeline digambar ulang,
// yang sudah jadi titik kumpul setiap kali chosenSource berubah.
function loadFullPreview() {
  const v = $("#tlPreviewVideo");
  if (!v || !chosenSource?.url) return;
  const absoluteSrc = new URL(chosenSource.url, location.href).href;
  if (v.src !== absoluteSrc) v.src = chosenSource.url;
}

function updateRecPlayIcon() {
  // Bukan cuma "baris ini yang aktif" -- harus "baris ini yang aktif DAN
  // videonya benar-benar sedang jalan". Tanpa syarat kedua, ikon tetap ⏸
  // selamanya sesudah dijeda manual atau berhenti sendiri di endSec --
  // padahal videonya sudah diam.
  const v = $("#tlPreviewVideo");
  const nowPlaying = !!(v && !v.paused);
  document.querySelectorAll(".rec-play").forEach((b) => {
    const active = Number(b.dataset.play) === previewIdx && nowPlaying;
    b.textContent = active ? "⏸" : "▶";
    b.setAttribute("aria-pressed", String(active));
  });
  const ownPlayBtn = $("#tlPreviewPlay");
  if (ownPlayBtn) ownPlayBtn.textContent = nowPlaying ? "❚❚" : "▶";
}

function closeRecPreview() {
  $("#tlPreviewVideo")?.pause();
  previewIdx = null;
  previewLimit = null;
  const titleEl = $("#tlPreviewTitle");
  if (titleEl) titleEl.textContent = "";
  updateRecPlayIcon();
}

function playRecPreview(idx) {
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

  const titleEl = $("#tlPreviewTitle");
  if (titleEl) titleEl.textContent = `${shortTime(k.startSec)} – ${shortTime(k.endSec)} · ${k.title}`;

  previewIdx = idx;
  previewLimit = k.endSec;
  updateRecPlayIcon();

  const startPlayback = () => {
    try { v.currentTime = k.startSec; } catch { /* metadata belum siap */ }
    v.play().catch(() => {});
  };
  // `v.src` SELALU berupa URL absolut begitu dibaca balik -- browser
  // meresolusinya sendiri -- sedangkan chosenSource.url relatif
  // ("/workspace/samples/..."). Membandingkannya apa adanya SELALU meleset,
  // jadi video di-reload ulang dari awal setiap kali Play ditekan, bahkan
  // untuk suggestion dari
  // video yang sama: buffering yang terbuang, dan sesaat sesudah klik video
  // masih kelihatan diam menunggu loadedmetadata padahal seharusnya sudah
  // langsung jalan. Dua-duanya diresolusi ke bentuk absolut dulu sebelum
  // dibandingkan.
  const absoluteSrc = new URL(chosenSource.url, location.href).href;
  if (v.src !== absoluteSrc) {
    v.src = chosenSource.url;
    v.addEventListener("loadedmetadata", startPlayback, { once: true });
  } else if (v.readyState >= 1) {
    // HAVE_METADATA+: aman men-set currentTime sekarang.
    startPlayback();
  } else {
    // src sama tapi metadata belum siap (loadFullPreview baru men-set src) --
    // tunggu, kalau tidak currentTime dibuang dan preview mulai dari 0.
    v.addEventListener("loadedmetadata", startPlayback, { once: true });
  }
}

// Berhenti sendiri persis di detik akhir rekomendasi -- pratinjau rentang
// INI saja, bukan lanjut ke bagian video sesudahnya yang tidak relevan.
// Sekalian menggerakkan isian bar scrub dan jam "posisi / total".
$("#tlPreviewVideo")?.addEventListener("timeupdate", (e) => {
  const v = e.target;
  if (previewLimit !== null && v.currentTime >= previewLimit) v.pause();

  const jam = $("#tlPreviewTime");
  if (jam && typeof videoDuration === "function") {
    jam.textContent = `${timeRange(v.currentTime)} / ${timeRange(videoDuration())}`;
  }
  const fill = $("#tlScrubFill");
  if (fill && typeof toFraction === "function") {
    const persen = toFraction(v.currentTime) * 100;
    fill.style.width = `${persen}%`;
    $("#tlScrub")?.setAttribute("aria-valuenow", String(Math.round(persen)));
  }
});
$("#tlPreviewVideo")?.addEventListener("pause", updateRecPlayIcon);
$("#tlPreviewVideo")?.addEventListener("play", updateRecPlayIcon);

// Bar scrub: klik atau geser di mana saja langsung memindah posisi putar.
// Terpisah total dari #tlTotal (yang tetap murni untuk memilih rentang),
// jadi tidak perlu membedakan "klik" vs "drag" di satu bar yang sama.
function tlScrubSeek(clientX) {
  const bar = $("#tlScrub");
  const v = $("#tlPreviewVideo");
  if (!bar || !v || !v.src || typeof fracToSeconds !== "function") return;
  const r = bar.getBoundingClientRect();
  const frac = r.width ? Math.max(0, Math.min(1, (clientX - r.left) / r.width)) : 0;
  try { v.currentTime = fracToSeconds(frac); } catch { /* metadata belum siap */ }
}
$("#tlScrub")?.addEventListener("pointerdown", (e) => {
  const bar = $("#tlScrub"), v = $("#tlPreviewVideo");
  if (!bar || !v || !v.src) return;
  e.preventDefault();
  bar.setPointerCapture(e.pointerId);
  // Menggeser bebas ke mana saja -- kalau sedang terkunci ke rentang satu
  // rekomendasi (previewBatas), lepaskan kuncinya supaya tidak langsung
  // dijeda paksa begitu melewati batas rentang lama itu.
  previewIdx = null;
  previewLimit = null;
  const titleEl = $("#tlPreviewTitle");
  if (titleEl) titleEl.textContent = "";
  updateRecPlayIcon();
  tlScrubSeek(e.clientX);
});
$("#tlScrub")?.addEventListener("pointermove", (e) => {
  if (e.buttons !== 1) return;
  tlScrubSeek(e.clientX);
});

// Kontrol sendiri: menjeda/melanjutkan apa pun yang sedang dimuat, TANPA
// perlu kembali ke baris AI suggestion yang memuatnya. Kalau video sudah
// lewat batas akhir rekomendasi (berhenti sendiri sebelumnya), menekan Play
// di sini mengulang dari awal rentang itu -- sama seperti menekan lagi
// tombol Play di barisnya.
$("#tlPreviewPlay")?.addEventListener("click", () => {
  const v = $("#tlPreviewVideo");
  if (!v || !v.src) return;
  if (!v.paused) { v.pause(); return; }
  if (previewLimit !== null && v.currentTime >= previewLimit - 0.05) {
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
  // Browser tidak melukis frame apa pun sampai posisi digeser -- kotaknya
  // hitam polos begitu src dipasang lewat muatPreviewUtuh() (tanpa play()
  // atau seek). Nudge sekecil ini memaksa frame pertama tergambar tanpa
  // kelihatan bergeser bagi mata.
  if (v.currentTime === 0) { try { v.currentTime = 0.001; } catch { /* abaikan */ } }
});

/* Maju/mundur dalam DETIK, bukan frame -- panel ini buat menyisir video
   sumber yang bisa berjam-jam untuk MENCARI rentang, jadi langkah kasar
   lebih berguna daripada presisi frame (itu urusan preview Result di
   kanan, lihat stepFrame() di player.js). Melangkah sambil jalan itu
   aneh, jadi dijeda dulu kalau perlu. Dibiarkan bebas melewati batas
   rentang suggestion (previewBatas): justru itu gunanya -- menilai
   apakah batasnya perlu digeser sedikit. */
function tlPreviewStepSeconds(seconds) {
  const v = $("#tlPreviewVideo");
  if (!v || !v.src) return;
  if (!v.paused) v.pause();
  const limit = v.duration || Infinity;
  const target = Math.max(0, Math.min(limit, v.currentTime + seconds));
  try { v.currentTime = target; } catch { /* di luar jangkauan */ }
}
[["#tlPreviewPrev5", -5], ["#tlPreviewPrev2", -2], ["#tlPreviewPrev", -1],
 ["#tlPreviewNext", 1], ["#tlPreviewNext2", 2], ["#tlPreviewNext5", 5]]
  .forEach(([sel, n]) => $(sel)?.addEventListener("click", () => tlPreviewStepSeconds(n)));

$("#recList")?.addEventListener("click", (e) => {
  const edit = e.target.closest("[data-edit-time]");
  if (edit) {
    e.preventDefault();     // jangan sampai ikut mencentang baris
    const row = edit.closest(".rec-row");
    const inputs = row ? [...row.querySelectorAll(".rec-time-in")] : [];
    const startInput = inputs.find((el) => el.dataset.field === "startSec");
    if (!startInput) return;
    const k = (DATA?.candidates || [])[Number(edit.dataset.editTime)];
    const title = k ? escapeHTML(k.title) : "";
    const isEditing = !startInput.disabled;
    if (isEditing) {
      // Klik "Save": pastikan nilai yang barusan diketik ter-commit --
      // klik langsung ke tombol ini (tanpa pindah fokus dulu dari kolom
      // teks) TIDAK memicu event "change" bawaan browser, jadi dipicu
      // manual di sini. Aman dipanggil walau nilainya tidak berubah
      // (listener change memvalidasi ulang, bukan mengasumsikan berubah).
      inputs.forEach((inp) => inp.dispatchEvent(new Event("change", { bubbles: true })));
      inputs.forEach((inp) => { inp.disabled = true; });
      edit.textContent = "✎";
      edit.title = "Edit time";
      edit.removeAttribute("data-editing");
      edit.setAttribute("aria-label", `Edit time for ${title}`);
    } else {
      inputs.forEach((inp) => { inp.disabled = false; });
      startInput.focus();
      startInput.select();
      edit.textContent = "✓";
      edit.title = "Save time";
      edit.setAttribute("data-editing", "true");
      edit.setAttribute("aria-label", `Save time for ${title}`);
    }
    return;
  }
  const btn = e.target.closest(".rec-play");
  if (!btn) return;
  e.preventDefault();       // jangan sampai ikut mencentang baris
  playRecPreview(Number(btn.dataset.play));
});

/* Membetulkan waktu satu rekomendasi. `label` membungkus checkbox DAN kedua
   kolom ini -- klik pada teks biasa mencentang baris (perilaku <label>
   bawaan), tapi klik pada input tetap fokus ke input, bukan ikut mencentang;
   itu perilaku standar browser untuk form control bersarang, bukan sesuatu
   yang perlu ditangani manual di sini.

   Titiknya ikut dirapikan ke batas kata terdekat (snapToWord), sama seperti
   seleksi manual di timeline -- satu aturan potong berlaku di mana pun. */
$("#recList")?.addEventListener("change", (e) => {
  const inp = e.target.closest(".rec-time-in");
  if (!inp) return;
  const idx = Number(inp.dataset.idx);
  const field = inp.dataset.field;
  const k = (DATA?.candidates || [])[idx];
  if (!k) return;

  const revert = () => { inp.value = shortTime(k[field]); };
  const raw = parseTime(inp.value);
  if (raw === null) { revert(); return; }
  const snapped = (typeof snapToWord === "function")
    ? snapToWord(raw, field === "startSec" ? "start" : "end")
    : raw;

  const other = field === "startSec" ? k.endSec : k.startSec;
  if (field === "startSec" ? snapped >= other : snapped <= other) { revert(); return; }

  k[field] = snapped;
  k.dur = Math.round(k.endSec - k.startSec);
  // spans/in/out ikut disinkronkan: kalau tidak, kode yang membaca k.spans
  // (render, preview) atau k.in/k.out (tampilan) masih memakai rentang lama.
  k.spans = [{ start: k.startSec, end: k.endSec }];
  if (typeof shortTime === "function") {
    k.in = shortTime(k.startSec);
    k.out = shortTime(k.endSec);
  }
  inp.value = shortTime(snapped);
  const rowEl = inp.closest(".rec-row");
  const durEl = rowEl?.querySelector(".rec-dur");
  if (durEl) durEl.textContent = `${k.dur}s`;
  // Penanda tipis di timeline total digambar dari k.startSec/endSec -- redraw
  // supaya ia ikut pindah, bukan tetap di posisi lama sampai redraw lain.
  if (typeof drawTotalTimeline === "function") drawTotalTimeline();
});

function updateRecButton() {
  const b = $("#recAddBtn");
  if (!b) return;
  const n = document.querySelectorAll("#recList input:checked").length;
  b.disabled = n === 0;
  b.textContent = n ? `Add ${n} to Result` : "Add to Result";
}

/* ---------- kejadian ---------- */

$("#recList")?.addEventListener("change", updateRecButton);

$("#recAddBtn")?.addEventListener("click", () => {
  const selected = [...document.querySelectorAll("#recList input:checked")];
  const candidates = DATA.candidates || [];
  let rejectedCount = 0;
  for (const c of selected) {
    const k = candidates[Number(c.dataset.rec)];
    if (!k) continue;
    if (addToResult(k.startSec, k.endSec, k.title, "ai")) rejectedCount++;
    c.checked = false;
  }
  updateRecButton();
  if (rejectedCount) {
    $("#editNote").textContent = `${rejectedCount} suggestion${rejectedCount > 1 ? "s" : ""} skipped — invalid timing`;
  }
});

$("#resultList")?.addEventListener("click", (e) => {
  const b = e.target.closest("[data-delete-result]");
  if (b) removeFromResult(b.dataset.deleteResult);
});

$("#resultClearBtn")?.addEventListener("click", clearResult);

/* Video baru = result ikut dikosongkan, seperti daftar objek. */
function resetResult() {
  RESULT = [];
  resultSeq = 0;
  renderResult();
  renderRecommendations();
}

/* Render: seluruh result jadi SATU berkas. */
$("#resultRenderBtn")?.addEventListener("click", () => {
  const clip = resultAsClip();
  if (!clip) return;
  if (typeof sendRender === "function") sendRender([clip]);
});

/* Jalur manual dimulai di layar Klip: timeline ada di sana. */
$("#manualClip")?.addEventListener("click", () => toScreen("klip"));
