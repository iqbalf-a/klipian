/* klipian — render history
   ==========================================================================
   A list of files that actually exist in the out/ folder, not a session
   log. The difference matters: if the page reloads or the server stops, a
   memory-based history would be lost even though the files are still on
   disk. What's shown here is always the real disk contents.

   The "Open folder" button calls the server, because the browser isn't
   allowed to -- and doesn't need to -- open Explorer on its own.
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
  const note = $("#historyNote");
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
  const list = $("#historyList");
  if (!list) return;

  if (!HISTORY.length) {
    list.innerHTML = `<p class="empty-message">Nothing in the out/ folder yet.
      Build a Result on the Clips screen, then press Render.</p>`;
    return;
  }

  list.innerHTML = HISTORY.map((r, i) => `
    <div class="history-row" data-history="${i}">
      <span class="history-name">${escapeHTML(r.file)}</span>
      <span class="data history-video">${escapeHTML(r.video)}</span>
      <span class="data history-mb">${r.mb} MB</span>
      <span class="data history-when">${timeAgo(r.at)}</span>
      <button class="btn quiet" data-action="play">Play</button>
      <button class="btn" data-action="open">Open folder</button>
    </div>`).join("");
}

$("#historyList")?.addEventListener("click", async (e) => {
  const b = e.target.closest("[data-action]");
  if (!b) return;
  const row = b.closest("[data-history]");
  const r = HISTORY[Number(row.dataset.history)];
  if (!r) return;

  if (b.dataset.action === "play") {
    window.open(r.url, "_blank", "noopener");
    return;
  }

  // Opening the folder is handled by the server; failures are reported on
  // the button itself so the user doesn't have to look for messages elsewhere.
  //
  // The restore label is read from data-label, NOT from the currently
  // displayed text: clicking again while the button still says "opened" would
  // lock in that temporary label forever.
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

$("#historyReloadBtn")?.addEventListener("click", loadHistory);
