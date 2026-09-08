/* klipian — riwayat render
   ==========================================================================
   Daftar berkas yang benar-benar ada di folder out/, bukan catatan sesi.
   Bedanya penting: kalau halaman dimuat ulang atau server dimatikan, riwayat
   berbasis ingatan akan hilang padahal berkasnya masih ada di disk. Yang
   ditampilkan di sini selalu isi disk yang sebenarnya.

   Tombol "Buka folder" memanggil server, karena browser tidak boleh -- dan
   memang tidak perlu -- membuka Explorer sendiri.
   ========================================================================== */

let HISTORY = [];

/* "just now", "12 min ago", "3 hr ago", "yesterday", lalu tanggal. */
function timeAgo(epochSeconds) {
  const elapsed = Date.now() / 1000 - epochSeconds;
  if (elapsed < 90) return "just now";
  if (elapsed < 3600) return `${Math.round(elapsed / 60)} min ago`;
  if (elapsed < 86400) return `${Math.round(elapsed / 3600)} hr ago`;
  if (elapsed < 172800) return "yesterday";
  return new Date(epochSeconds * 1000).toLocaleDateString("en-GB",
    { day: "numeric", month: "short" });
}

async function loadHistory() {
  const note = $("#riwayatNote");
  try {
    const d = await (await fetch("/api/history")).json();
    HISTORY = d.render || [];
  } catch {
    HISTORY = [];
    if (note) note.textContent = "needs klipian serve";
    renderHistory();
    return;
  }
  if (note) {
    const mb = HISTORY.reduce((t, r) => t + r.mb, 0);
    note.textContent = HISTORY.length
      ? `${HISTORY.length} file${HISTORY.length > 1 ? "s" : ""} · ${mb.toFixed(1)} MB`
      : "nothing rendered yet";
  }
  renderHistory();
}

function renderHistory() {
  const list = $("#riwayatList");
  if (!list) return;

  if (!HISTORY.length) {
    list.innerHTML = `<p class="empty-message">Nothing in the out/ folder yet.
      Build a Result on the Clips screen, then press Render.</p>`;
    return;
  }

  list.innerHTML = HISTORY.map((r, i) => `
    <div class="riwayat-row" data-riwayat="${i}">
      <span class="riwayat-nama">${escapeHTML(r.file)}</span>
      <span class="data riwayat-video">${escapeHTML(r.video)}</span>
      <span class="data riwayat-mb">${r.mb} MB</span>
      <span class="data riwayat-kapan">${timeAgo(r.at)}</span>
      <button class="btn quiet" data-aksi="putar">Play</button>
      <button class="btn" data-aksi="buka">Open folder</button>
    </div>`).join("");
}

$("#riwayatList")?.addEventListener("click", async (e) => {
  const b = e.target.closest("[data-aksi]");
  if (!b) return;
  const row = b.closest("[data-riwayat]");
  const r = HISTORY[Number(row.dataset.riwayat)];
  if (!r) return;

  if (b.dataset.aksi === "putar") {
    window.open(r.url, "_blank", "noopener");
    return;
  }

  // Buka folder dikerjakan server; kegagalannya dilaporkan di tombolnya
  // sendiri supaya tidak perlu mencari pesan di tempat lain.
  //
  // Label pemulih diambil dari data-label, BUKAN dari teks yang sedang
  // tampil: klik kedua saat tombol masih menulis "dibuka" akan mengunci
  // label sementara itu selamanya.
  const previous = b.dataset.label || b.textContent;
  b.dataset.label = previous;
  try {
    const j = await (await fetch("/api/open-folder", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ folder: r.folder }),
    })).json();
    if (j.error) throw new Error(j.error);
    b.textContent = "opened";
  } catch (err) {
    b.textContent = String(err.message || "failed").slice(0, 22);
  }
  setTimeout(() => { b.textContent = previous; }, 2200);
});

$("#riwayatMuatBtn")?.addEventListener("click", loadHistory);
