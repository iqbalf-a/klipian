/* klipian — workspace: panel Assets
   ==========================================================================
   Contents of workspace/assets/ -- where custom watermarks, fonts, and
   templates live outside klipian's built-in defaults. Empty by default,
   which is expected behavior (see /api/workspace/assets in server.py),
   not an error.

   Requires $/escapeHTML/timeAgo from helpers.js -- loaded before this file.
   ========================================================================== */

async function loadAssets() {
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
    ? `${asset.length} file${asset.length > 1 ? "s" : ""} in workspace/assets/`
    : "workspace/assets/ is empty";
  const list = $("#assetList");
  if (!asset.length) {
    list.innerHTML = `<p class="empty">Put custom watermark/font/template files
      in the <code>workspace/assets/</code> folder if you need them outside klipian's built-ins.</p>`;
    return;
  }
  list.innerHTML = asset.map((a) => `
    <div class="ws-row">
      <span class="name">${escapeHTML(a.name)}</span>
      <span class="data">${a.kb} KB</span>
      <span class="data">${timeAgo(a.at)}</span>
    </div>`).join("");
}

loadAssets();
