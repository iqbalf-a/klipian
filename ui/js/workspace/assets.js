/* klipian — workspace: panel Assets
   ==========================================================================
   Contents of workspace/assets/ -- where custom watermarks, fonts, and
   templates live outside klipian's built-in defaults. Empty by default,
   which is expected behavior (see /api/workspace/assets in server.py),
   not an error.

   Requires $/escapeHTML/timeAgo from helpers.js -- loaded before this file.
   ========================================================================== */

const assetPager = createPager({ key: "assets", mount: $("#assetPager"), onChange: () => drawAssets() });
let ASSETS = [];
let ASSETS_FOLDER = "";

async function loadAssets() {
  const note = $("#assetNote");
  let asset = [];
  try {
    const d = await (await fetch("/api/workspace/assets")).json();
    asset = d.asset || [];
    ASSETS = asset;
    ASSETS_FOLDER = d.folder || "";
    const open = $("#assetOpenBtn");
    if (open) open.title = ASSETS_FOLDER;
  } catch {
    if (note) note.textContent = "needs klipian serve";
    return;
  }
  if (note) note.textContent = asset.length
    ? `${asset.length} file${asset.length > 1 ? "s" : ""} in this profile's assets`
    : "this profile's assets folder is empty";
  drawAssets();
}

function drawAssets() {
  const asset = ASSETS;
  const list = $("#assetList");
  if (!asset.length) {
    assetPager.slice([]);
    list.innerHTML = `<p class="empty">Put custom watermark/font/template files
      in this profile's assets folder (<b>Open folder</b>) if you need them outside klipian's built-ins.</p>`;
    return;
  }
  list.innerHTML = assetPager.slice(asset).map((a) => `
    <div class="ws-row">
      <span class="name">${escapeHTML(a.name)}</span>
      <span class="data">${a.kb} KB</span>
      <span class="data">${timeAgo(a.at)}</span>
    </div>`).join("");
}

/* Open folder: the PROFILE's assets folder, as the server says where it is. */
$("#assetOpenBtn")?.addEventListener("click", async (e) => {
  const b = e.currentTarget;
  const previous = b.dataset.label || b.textContent;
  b.dataset.label = previous;
  try {
    if (!ASSETS_FOLDER) throw new Error("not loaded yet");
    const j = await (await fetch("/api/open-folder", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ folder: ASSETS_FOLDER }),
    })).json();
    if (j.error) throw new Error(j.error);
    b.textContent = "opened";
  } catch (err) {
    b.textContent = String(err.message || "failed").slice(0, 22);
  }
  setTimeout(() => { b.textContent = previous; }, 2200);
});

loadAssets();
