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

  if (!daftar.length) {
    list.innerHTML = `<p class="kosong-hasil">No suggestions yet. Import Claude's JSON on the
      Analyze screen, or just select a range on the timeline.</p>`;
    if (note) note.textContent = "none yet";
    const b = $("#rekomAddBtn"); if (b) b.disabled = true;
    return;
  }

  // Sengaja ringkas: menit, judul, durasi. Skor dan alasan tidak membantu
  // memutuskan di layar ini -- yang dibutuhkan cuma "ambil atau tidak".
  list.innerHTML = daftar.map((k, i) => `
    <label class="rekom-row">
      <input type="checkbox" data-rekom="${i}">
      <span class="num">${i + 1}</span>
      <span class="rekom-judul">${escapeHTML(k.title)}</span>
      <span class="data rekom-waktu"><input type="text" class="rekom-sec" value="${k.startSec.toFixed(1)}" data-field="startSec" data-idx="${i}" title="Start (detik)"> – <input type="text" class="rekom-sec" value="${k.endSec.toFixed(1)}" data-field="endSec" data-idx="${i}" title="End (detik)"></span>
      <span class="data rekom-dur">${k.dur}s</span>
    </label>`).join("");
  if (note) note.textContent = `${daftar.length} suggestion${daftar.length > 1 ? "s" : ""}`;
  perbaruiTombolRekom();
}

function perbaruiTombolRekom() {
  const b = $("#rekomAddBtn");
  if (!b) return;
  const n = document.querySelectorAll("#rekomList input:checked").length;
  b.disabled = n === 0;
  b.textContent = n ? `Masukkan ${n} ke result` : "Masukkan ke result";
}

/* ---------- kejadian ---------- */

$("#rekomList")?.addEventListener("change", perbaruiTombolRekom);

/* --- Editable time in AI suggestion panel --- */
$("#rekomList")?.addEventListener("change", (e) => {
  const inp = e.target.closest(".rekom-sec");
  if (!inp) return;
  const idx = Number(inp.dataset.idx);
  const field = inp.dataset.field;
  const daftar = DATA?.candidates;
  if (!daftar || !daftar[idx]) return;
  const val = parseFloat(inp.value);
  if (isNaN(val) || val < 0) { inp.value = daftar[idx][field].toFixed(1); return; }
  daftar[idx][field] = val;
  /* recalc dur and refresh sibling fields */
  const k = daftar[idx];
  k.dur = Math.round((k.endSec - k.startSec) * 10) / 10;
  /* re-render just the dur display */
  const row = inp.closest(".rekom-row");
  if (row) {
    const durEl = row.querySelector(".rekom-dur");
    if (durEl) durEl.textContent = k.dur + "s";
  }
});

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
