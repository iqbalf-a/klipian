/* klipian — riwayat render
   ==========================================================================
   Daftar berkas yang benar-benar ada di folder out/, bukan catatan sesi.
   Bedanya penting: kalau halaman dimuat ulang atau server dimatikan, riwayat
   berbasis ingatan akan hilang padahal berkasnya masih ada di disk. Yang
   ditampilkan di sini selalu isi disk yang sebenarnya.

   Tombol "Buka folder" memanggil server, karena browser tidak boleh -- dan
   memang tidak perlu -- membuka Explorer sendiri.
   ========================================================================== */

let RIWAYAT = [];

/* "just now", "12 min ago", "3 hr ago", "yesterday", lalu tanggal. */
function kapan(detikEpoch) {
  const lalu = Date.now() / 1000 - detikEpoch;
  if (lalu < 90) return "just now";
  if (lalu < 3600) return `${Math.round(lalu / 60)} min ago`;
  if (lalu < 86400) return `${Math.round(lalu / 3600)} hr ago`;
  if (lalu < 172800) return "yesterday";
  return new Date(detikEpoch * 1000).toLocaleDateString("en-GB",
    { day: "numeric", month: "short" });
}

async function muatRiwayat() {
  const note = $("#riwayatNote");
  try {
    const d = await (await fetch("/api/history")).json();
    RIWAYAT = d.render || [];
  } catch {
    RIWAYAT = [];
    if (note) note.textContent = "needs klipian serve";
    gambarRiwayat();
    return;
  }
  if (note) {
    const mb = RIWAYAT.reduce((t, r) => t + r.mb, 0);
    note.textContent = RIWAYAT.length
      ? `${RIWAYAT.length} file${RIWAYAT.length > 1 ? "s" : ""} · ${mb.toFixed(1)} MB`
      : "nothing rendered yet";
  }
  gambarRiwayat();
}

function gambarRiwayat() {
  const list = $("#riwayatList");
  if (!list) return;

  if (!RIWAYAT.length) {
    list.innerHTML = `<p class="kosong-hasil">Nothing in the out/ folder yet.
      Build a Result on the Clips screen, then press Render.</p>`;
    return;
  }

  list.innerHTML = RIWAYAT.map((r, i) => `
    <div class="riwayat-row" data-riwayat="${i}">
      <span class="riwayat-nama">${escapeHTML(r.file)}</span>
      <span class="data riwayat-video">${escapeHTML(r.video)}</span>
      <span class="data riwayat-mb">${r.mb} MB</span>
      <span class="data riwayat-kapan">${kapan(r.at)}</span>
      <button class="btn quiet" data-aksi="putar">Play</button>
      <button class="btn" data-aksi="buka">Open folder</button>
    </div>`).join("");
}

$("#riwayatList")?.addEventListener("click", async (e) => {
  const b = e.target.closest("[data-aksi]");
  if (!b) return;
  const baris = b.closest("[data-riwayat]");
  const r = RIWAYAT[Number(baris.dataset.riwayat)];
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
  const semula = b.dataset.label || b.textContent;
  b.dataset.label = semula;
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
  setTimeout(() => { b.textContent = semula; }, 2200);
});

$("#riwayatMuatBtn")?.addEventListener("click", muatRiwayat);
