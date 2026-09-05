/* klipian — workspace: panel Assets
   ==========================================================================
   Isi content/assets/ -- tempat watermark/font/template custom di luar
   bawaan klipian. Kosong secara default, itu keadaan normal (lihat
   /api/workspace/assets di server.py), bukan error.

   Butuh $/escapeHTML/kapan dari helpers.js -- dimuat sebelum file ini.
   ========================================================================== */

async function muatAsset() {
  const note = $("#assetNote");
  let asset = [];
  try {
    const d = await (await fetch("/api/workspace/assets")).json();
    asset = d.asset || [];
  } catch {
    if (note) note.textContent = "needs klipian serve";
    return;
  }
  if (note) note.textContent = asset.length
    ? `${asset.length} berkas di content/assets/`
    : "content/assets/ masih kosong";
  const list = $("#assetList");
  if (!asset.length) {
    list.innerHTML = `<p class="ws-kosong">Taruh watermark/font/template custom
      di folder <code>content/assets/</code> kalau butuh di luar bawaan klipian.</p>`;
    return;
  }
  list.innerHTML = asset.map((a) => `
    <div class="ws-row">
      <span class="nama">${escapeHTML(a.name)}</span>
      <span class="data">${a.kb} KB</span>
      <span class="data">${kapan(a.at)}</span>
    </div>`).join("");
}

muatAsset();
