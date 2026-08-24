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
  if (!Number.isFinite(start) || !Number.isFinite(end)) return "waktunya tidak terbaca";
  if (end - start < 0.5) return "rentangnya terlalu pendek";

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
    title: title || `Potongan ${RESULT.length + 1}`,
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

function renderResult() {
  const list = $("#hasilList");
  const total = $("#hasilTotal");
  if (!list) return;

  if (!RESULT.length) {
    list.innerHTML = `<p class="kosong-hasil">Result masih kosong. Pilih rekomendasi di
      atas, atau seleksi rentang sendiri di timeline.</p>`;
    if (total) total.textContent = "kosong";
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
              aria-label="Buang ${escapeHTML(r.title)} dari result">×</button>
    </div>`).join("");

  if (total) {
    total.textContent = `${RESULT.length} potongan · ${Math.round(resultTotal())} detik`;
  }
  const clr = $("#hasilClearBtn"); if (clr) clr.disabled = false;

  const judul = $("#hasilJudul");
  if (judul && !judul.value.trim()) judul.placeholder = judulBawaan();
  const btn = $("#hasilRenderBtn"); if (btn) btn.disabled = false;
  const ringkas = $("#hasilRingkas");
  if (ringkas) {
    ringkas.textContent = RESULT.length === 1
      ? "jadi 1 berkas MP4"
      : `${RESULT.length} potongan disambung jadi 1 berkas MP4`;
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
  const daftar = (DATA[mode]?.candidates) || [];

  if (!daftar.length) {
    list.innerHTML = `<p class="kosong-hasil">Belum ada rekomendasi. Impor JSON dari
      Claude di layar Analisis, atau langsung seleksi sendiri di timeline.</p>`;
    if (note) note.textContent = "belum ada";
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
      <span class="data rekom-waktu">${jamRange(k.startSec)} – ${jamRange(k.endSec)}</span>
      <span class="data rekom-dur">${k.dur}s</span>
    </label>`).join("");
  if (note) note.textContent = `${daftar.length} rekomendasi`;
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

$("#rekomAddBtn")?.addEventListener("click", () => {
  const dipilih = [...document.querySelectorAll("#rekomList input:checked")];
  const daftar = DATA[mode].candidates || [];
  let ditolak = 0;
  for (const c of dipilih) {
    const k = daftar[Number(c.dataset.rekom)];
    if (!k) continue;
    if (addToResult(k.startSec, k.endSec, k.title, "ai")) ditolak++;
    c.checked = false;
  }
  perbaruiTombolRekom();
  if (ditolak) {
    $("#editNote").textContent = `${ditolak} rekomendasi dilewati karena waktunya tidak sah`;
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

/* Jalur manual dimulai di layar Edit: timeline ada di sana. */
$("#manualClip")?.addEventListener("click", () => toScreen("edit"));
