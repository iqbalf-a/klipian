/* klipian — workspace: panel Render Results
   ==========================================================================
   Source is /api/history -- same as the History panel in the editor.
   Rewritten here (not imported) because this page intentionally avoids
   loading app.js/history.js, which are tied to elements in index.html.

   Requires $/escapeHTML/timeAgo from helpers.js -- loaded before this file.
   ========================================================================== */

let RENDER = [];

async function loadRender() {
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
      : "nothing rendered yet";
  }
  const list = $("#renderList");
  if (!RENDER.length) {
    list.innerHTML = `<p class="empty">Nothing in the out/ folder yet.</p>`;
    return;
  }
  list.innerHTML = RENDER.map((r, i) => `
    <div class="ws-row" data-i="${i}">
      <span class="name">${escapeHTML(r.file)} <span class="data">— ${escapeHTML(r.video)}</span></span>
      <span class="data">${r.mb} MB</span>
      <span class="data">${timeAgo(r.at)}</span>
      <button class="rounded-s px-2.5 py-1 text-[12px] hover:bg-kaca" data-action="play">Play</button>
      <button class="rounded-s px-2.5 py-1 text-[12px] border border-garis hover:bg-kaca" data-action="open">Open folder</button>
    </div>`).join("");
}

$("#renderList")?.addEventListener("click", async (e) => {
  const b = e.target.closest("[data-action]");
  if (!b) return;
  const row = b.closest("[data-i]");
  const r = RENDER[Number(row.dataset.i)];
  if (!r) return;

  if (b.dataset.action === "play") {
    window.open(r.url, "_blank", "noopener");
    return;
  }
  // Restore label is read from data-label, NOT from the current visible
  // text: clicking again while the button still says "opened" would lock
  // that temporary label in permanently (same pattern as history.js).
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

loadRender();
