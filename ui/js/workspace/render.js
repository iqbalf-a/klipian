/* klipian — workspace: panel Hasil render
   ==========================================================================
   Sumbernya /api/history -- sama seperti layar History di editor. Ditulis
   ulang di sini (bukan di-import) karena halaman ini sengaja tidak memuat
   app.js/history.js yang terikat ke elemen index.html.

   Butuh $/escapeHTML/kapan dari helpers.js -- dimuat sebelum file ini.
   ========================================================================== */

let RENDER = [];

async function muatRender() {
  const note = $("#renderNote");
  try {
    const d = await (await fetch("/api/history")).json();
    RENDER = d.render || [];
  } catch {
    if (note) note.textContent = "needs klipian serve";
    $("#renderList").innerHTML = "";
    return;
  }
  if (note) {
    const mb = RENDER.reduce((t, r) => t + r.mb, 0);
    note.textContent = RENDER.length
      ? `${RENDER.length} file${RENDER.length > 1 ? "s" : ""} · ${mb.toFixed(1)} MB`
      : "belum ada yang dirender";
  }
  const list = $("#renderList");
  if (!RENDER.length) {
    list.innerHTML = `<p class="ws-kosong">Folder out/ masih kosong.</p>`;
    return;
  }
  list.innerHTML = RENDER.map((r, i) => `
    <div class="ws-row" data-i="${i}">
      <span class="nama">${escapeHTML(r.file)} <span class="data">— ${escapeHTML(r.video)}</span></span>
      <span class="data">${r.mb} MB</span>
      <span class="data">${kapan(r.at)}</span>
      <button class="rounded-s px-2.5 py-1 text-[12px] hover:bg-kaca" data-aksi="putar">Play</button>
      <button class="rounded-s px-2.5 py-1 text-[12px] border border-garis hover:bg-kaca" data-aksi="buka">Open folder</button>
    </div>`).join("");
}

$("#renderList")?.addEventListener("click", async (e) => {
  const b = e.target.closest("[data-aksi]");
  if (!b) return;
  const row = b.closest("[data-i]");
  const r = RENDER[Number(row.dataset.i)];
  if (!r) return;

  if (b.dataset.aksi === "putar") {
    window.open(r.url, "_blank", "noopener");
    return;
  }
  // Label pemulih diambil dari data-label, BUKAN dari teks yang sedang
  // tampil: klik kedua saat tombol masih menulis "opened" akan mengunci
  // label sementara itu selamanya (lihat pola yang sama di history.js).
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

muatRender();
