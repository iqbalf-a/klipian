/* klipian — workspace: panel Assets
   ==========================================================================
   Contents of workspace/assets/ -- where custom watermarks, fonts, and
   templates live outside klipian's built-in defaults. Empty by default,
   which is expected behavior (see /api/workspace/assets in server.py),
   not an error.

   Requires $/escapeHTML/kapan from helpers.js -- loaded before this file.
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
    ? `${asset.length} berkas di workspace/assets/`
    : "workspace/assets/ masih kosong";
  const list = $("#assetList");
  if (!asset.length) {
    list.innerHTML = `<p class="empty">Taruh watermark/font/template custom
      di folder <code>workspace/assets/</code> kalau butuh di luar bawaan klipian.</p>`;
    return;
  }
  list.innerHTML = asset.map((a) => `
    <div class="ws-row">
      <span class="name">${escapeHTML(a.name)}</span>
      <span class="data">${a.kb} KB</span>
      <span class="data">${kapan(a.at)}</span>
    </div>`).join("");
}

muatAsset();
