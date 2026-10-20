/* klipian — workspace: panel Render Results
   ==========================================================================
   Source is /api/history -- same as the History panel in the editor.
   Rewritten here (not imported) because this page intentionally avoids
   loading app.js/history.js, which are tied to elements in index.html.

   Requires $/escapeHTML/timeAgo from helpers.js -- loaded before this file.
   ========================================================================== */

let RENDER = [];
const renderSort = createSort("render");
const renderPager = createPager({ key: "render", mount: $("#renderPager"), onChange: () => drawRender() });

async function loadRender() {
  const note = $("#renderNote");
  try {
    const d = await (await fetch("/api/history")).json();
    RENDER = d.render || [];
  } catch {
    if (note) note.textContent = "needs klipian serve";
    $("#renderList").innerHTML = "";
    renderPager.slice([]);
    return;
  }
  if (note) {
    const mb = RENDER.reduce((t, r) => t + r.mb, 0);
    const loose = IS_GUEST ? 0 : RENDER.filter((r) => r.scheduled === false).length;
    note.textContent = RENDER.length
      ? `${RENDER.length} file${RENDER.length > 1 ? "s" : ""} · ${mb.toFixed(1)} MB`
        + (loose ? ` · ${loose} not in the schedule` : "")
      : "nothing rendered yet";
  }
  drawRender();
}

/* The current page of RENDER; data-i stays the index into the whole list. */
function drawRender() {
  const list = $("#renderList");
  if (!RENDER.length) {
    renderPager.slice([]);
    list.innerHTML = `<p class="empty">Nothing in the out/ folder yet.</p>`;
    return;
  }
  const page = renderPager.slice(renderSort.apply(RENDER, (r) => r.created || r.at));
  list.innerHTML = `
    <div class="ws-row head">
      <span>File</span><span>Size</span><span>${renderSort.headHTML("Created")}</span><span></span><span></span><span></span>
    </div>` + page.map((r) => `
    <div class="ws-row render" data-i="${RENDER.indexOf(r)}">
      <span class="name" title="${escapeHTML(r.file)}">${escapeHTML(r.file)} <span class="data">— ${escapeHTML(r.video)}</span></span>
      <span class="data">${r.mb} MB</span>
      <span class="data" title="${escapeHTML(timeAgo(r.created || r.at))}">${fmtCreated(r.created || r.at)}</span>
      ${r.scheduled === false && !IS_GUEST
        ? `<button class="ws-mini ws-add-schedule" type="button" data-action="schedule" title="This file has no row in the upload schedule">Add to schedule</button>`
        : `<span></span>`}
      <button class="rounded-s px-2.5 py-1 text-[12px] hover:bg-glass" data-action="play">Play</button>
      <button class="rounded-s px-2.5 py-1 text-[12px] border border-glass-border hover:bg-glass" data-action="open">Open folder</button>
    </div>`).join("");
}

$("#renderList")?.addEventListener("click", async (e) => {
  if (e.target.closest("[data-sort-created]")) {
    renderSort.toggle();
    renderPager.first();
    drawRender();
    return;
  }
  const b = e.target.closest("[data-action]");
  if (!b) return;
  const row = b.closest("[data-i]");
  const r = RENDER[Number(row.dataset.i)];
  if (!r) return;

  if (b.dataset.action === "play") {
    window.open(r.url, "_blank", "noopener");
    return;
  }
  if (b.dataset.action === "schedule") {
    b.disabled = true;
    try {
      const j = await (await fetch("/api/workspace/clips/from-render", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folder: r.video, file: r.file }),
      })).json();
      if (j.error) throw new Error(j.error);
      await loadRender();                // the file now has a row: its tag goes
      if (typeof loadClips === "function") await loadClips();
    } catch (err) {
      b.disabled = false;
      b.textContent = String(err.message || "failed").slice(0, 24);
      setTimeout(() => { b.textContent = "Add to schedule"; }, 2500);
    }
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
