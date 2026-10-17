/* klipian — workspace: panel Sources
   ==========================================================================
   The raw videos in workspace/sources/ (/api/workspace/sources): the input
   side of the dashboard, between the upload schedule (Clips) and what came
   out (Rendered output). Per video: size, length, when it came in, whether it
   has a transcript, and which projects use it -- so a video nothing uses is
   easy to spot.

   Requires $/escapeHTML/timeAgo from helpers.js -- loaded before this file.
   ========================================================================== */

function formatBytes(n) {
  if (n >= 1024 ** 3) return `${(n / 1024 ** 3).toFixed(1)} GB`;
  if (n >= 1024 ** 2) return `${Math.round(n / 1024 ** 2)} MB`;
  return `${Math.max(1, Math.round(n / 1024))} KB`;
}

function formatLength(sec) {
  if (sec == null) return "—";
  const s = Math.round(sec);
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  const pad = (x) => String(x).padStart(2, "0");
  return h ? `${h}:${pad(m)}:${pad(r)}` : `${m}:${pad(r)}`;
}

let SOURCES_FOLDER = "";

async function loadSources() {
  const note = $("#sourceNote");
  const list = $("#sourceList");
  let source = [];
  try {
    const d = await (await fetch("/api/workspace/sources")).json();
    source = d.source || [];
    SOURCES_FOLDER = d.folder || "";
  } catch {
    if (note) note.textContent = "needs klipian serve";
    list.innerHTML = "";
    return;
  }
  if (!source.length) {
    note.textContent = "workspace/sources/ is empty";
    list.innerHTML = `<p class="empty">No videos yet. Add one with <b>Add video…</b> on the
      Assets screen of a project, or copy the file into <code>workspace/sources/</code>.</p>`;
    return;
  }
  const total = source.reduce((t, s) => t + s.bytes, 0);
  note.textContent = `${source.length} video${source.length > 1 ? "s" : ""} in workspace/sources/ · ${formatBytes(total)}`;
  list.innerHTML = `
    <div class="ws-row sources head">
      <span>Video</span><span>Size</span><span>Length</span><span>Added</span><span>Transcript</span><span>Used by</span>
    </div>` + source.map((s) => {
      const used = s.used_by.map((u) => u.name).join(", ");
      return `
    <div class="ws-row sources">
      <span class="name" title="${escapeHTML(s.name)}">${escapeHTML(s.name)}</span>
      <span class="data">${formatBytes(s.bytes)}</span>
      <span class="data">${formatLength(s.duration)}</span>
      <span class="data">${timeAgo(s.at)}</span>
      <span class="data ${s.transcribed ? "done" : ""}">${s.transcribed ? "transcribed" : "not transcribed"}</span>
      <span class="used" data-none="${used ? "false" : "true"}" title="${escapeHTML(used)}">${used ? escapeHTML(used) : "not used"}</span>
    </div>`;
    }).join("");
}

$("#sourceOpenBtn")?.addEventListener("click", async (e) => {
  const b = e.currentTarget;
  // The label is restored from data-label, not the visible text (same
  // reason as the Rendered output buttons).
  const previous = b.dataset.label || b.textContent;
  b.dataset.label = previous;
  try {
    if (!SOURCES_FOLDER) throw new Error("not loaded yet");
    const j = await (await fetch("/api/open-folder", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ folder: SOURCES_FOLDER }),
    })).json();
    if (j.error) throw new Error(j.error);
    b.textContent = "opened";
  } catch (err) {
    b.textContent = String(err.message || "failed").slice(0, 22);
  }
  setTimeout(() => { b.textContent = previous; }, 2200);
});

loadSources();
