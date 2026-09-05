/* klipian — workspace: panel Hasil render
   ==========================================================================
   Sumbernya /api/history -- sama seperti layar History di editor. Ditulis
   ulang di sini (bukan di-import) karena halaman ini sengaja tidak memuat
   app.js/history.js yang terikat ke elemen index.html.

   Butuh $/escapeHTML/kapan dari helpers.js -- dimuat sebelum file ini.
   ========================================================================== */

async function muatRender() {
  const note = $("#renderNote");
  let render = [];
  try {
    const d = await (await fetch("/api/history")).json();
    render = d.render || [];
  } catch {
    if (note) note.textContent = "needs klipian serve";
    $("#renderList").innerHTML = "";
    return;
  }
  if (note) {
    const mb = render.reduce((t, r) => t + r.mb, 0);
    note.textContent = render.length
      ? `${render.length} file${render.length > 1 ? "s" : ""} · ${mb.toFixed(1)} MB`
      : "belum ada yang dirender";
  }
  const list = $("#renderList");
  if (!render.length) {
    list.innerHTML = `<p class="ws-kosong">Folder out/ masih kosong.</p>`;
    return;
  }
  list.innerHTML = render.map((r, i) => `
    <div class="ws-row" data-i="${i}">
      <span class="nama">${escapeHTML(r.file)} <span class="data">— ${escapeHTML(r.video)}</span></span>
      <span class="data">${r.mb} MB</span>
      <span class="data">${kapan(r.at)}</span>
      <button class="rounded-s px-2.5 py-1 text-[12px] hover:bg-kaca" data-aksi="putar">Play</button>
      <button class="rounded-s px-2.5 py-1 text-[12px] border border-garis hover:bg-kaca" data-aksi="buka">Open folder</button>
    </div>`).join("");
  list.dataset.render = JSON.stringify(render);
}

$("#renderList")?.addEventListener("click", async (e) => {
  const b = e.target.closest("[data-aksi]");
  if (!b) return;
  const list = $("#renderList");
  const render = JSON.parse(list.dataset.render || "[]");
  const row = b.closest("[data-i]");
  const r = render[Number(row.dataset.i)];
  if (!r) return;

  if (b.dataset.aksi === "putar") {
    window.open(r.url, "_blank", "noopener");
    return;
  }
  const semula = b.textContent;
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
