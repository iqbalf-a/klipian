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
let SOURCE_ROWS = [];             // what the table shows, for the credit form
let creditOpen = "";              // the video whose credit form is open
const sourcePager = createPager({ key: "sources", mount: $("#sourcePager"), onChange: () => drawSources() });

async function loadSources() {
  const note = $("#sourceNote");
  const list = $("#sourceList");
  let source = [];
  try {
    const d = await (await fetch("/api/workspace/sources")).json();
    source = d.source || [];
    SOURCE_ROWS = source;
    SOURCES_FOLDER = d.folder || "";
    const open = $("#sourceOpenBtn");
    if (open) open.title = SOURCES_FOLDER;          // where the files really are, whatever the profile
  } catch {
    if (note) note.textContent = "needs klipian serve";
    list.innerHTML = "";
    sourcePager.slice([]);
    return;
  }
  if (!source.length) {
    sourcePager.slice([]);
    note.textContent = "this profile's sources folder is empty";
    list.innerHTML = `<p class="empty">No videos yet. Add one with <b>Add video…</b> on the
      Assets screen of a project, or copy the file into this profile's sources folder (<b>Open folder</b>).</p>`;
    return;
  }
  const total = source.reduce((t, s) => t + s.bytes, 0);
  note.textContent = `${source.length} video${source.length > 1 ? "s" : ""} in this profile's sources · ${formatBytes(total)}`;
  drawSources();
}

/* The current page of SOURCE_ROWS. The credit buttons carry the index into the
   WHOLE list, so it still finds its video on page 2. */
function drawSources() {
  const list = $("#sourceList");
  const first = SOURCE_ROWS.length ? SOURCE_ROWS.indexOf(sourcePager.slice(SOURCE_ROWS)[0]) : 0;
  list.innerHTML = `
    <div class="ws-row sources head">
      <span>Video</span><span>Size</span><span>Length</span><span>Added</span><span>Transcript</span><span>Used by</span><span>Credit</span>
    </div>` + sourcePager.slice(SOURCE_ROWS).map((s, k) => {
      const i = first + k;
      const used = s.used_by.map((u) => u.name).join(", ");
      const c = s.credit || {};
      const who = [c.platform, c.creator].filter(Boolean).join(" · ") || (c.title ? `"${c.title}"` : "");
      return `
    <div class="ws-row sources">
      <span class="name" title="${escapeHTML(s.name)}">${escapeHTML(s.name)}</span>
      <span class="data">${formatBytes(s.bytes)}</span>
      <span class="data">${formatLength(s.duration)}</span>
      <span class="data">${timeAgo(s.at)}</span>
      <span class="data ${s.transcribed ? "done" : ""}">${s.transcribed ? "transcribed" : "not transcribed"}</span>
      <span class="used" data-none="${used ? "false" : "true"}" title="${escapeHTML(used)}">${used ? escapeHTML(used) : "not used"}</span>
      <button class="credit-btn" type="button" data-credit="${i}" data-set="${who ? "true" : "false"}"
              title="${escapeHTML(s.credit_line || "Where this video came from")}">${who ? escapeHTML(who) : "+ credit"}</button>
    </div>${creditOpen === s.name ? creditFormHTML(s, i) : ""}`;
    }).join("");
}

/* The credit of a source video: where it came from, kept in
   workspace/sources/credits.json. The line under a post (Sumber: ...) is built
   from these four fields by klipian; nobody has to type it. */
function creditFormHTML(s, i) {
  const c = s.credit || {};
  const field = (key, label, ph) => `
      <label class="ws-field">${label}
        <input class="ws-input" type="${key === "url" ? "url" : "text"}" data-credit-field="${key}"
               maxlength="${{ platform: 40, creator: 80, title: 200, url: 500 }[key]}"
               placeholder="${ph}" value="${escapeHTML(c[key] || "")}"></label>`;
  return `
    <form class="credit-form" data-credit-form="${i}">
      ${field("platform", "Platform", "YouTube")}
      ${field("creator", "Creator", "Raditya Dika")}
      ${field("title", "Title", "Apa Kabar Syahrini")}
      ${field("url", "Link", "https://…")}
      <div class="actions">
        <button class="rounded-s bg-accent text-[13px] font-semibold px-3 py-1.5 text-accent-text hover:brightness-110"
                type="submit">Save</button>
        <button class="rounded-s px-2.5 py-1 text-[12px] border border-glass-border hover:bg-glass"
                type="button" data-credit-cancel>Cancel</button>
        <span class="data" id="creditPreview" role="status">${escapeHTML(s.credit_line || "nothing entered yet")}</span>
      </div>
    </form>`;
}

$("#sourceList")?.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-credit]");
  if (btn) {
    const s = SOURCE_ROWS[Number(btn.dataset.credit)];
    creditOpen = creditOpen === s.name ? "" : s.name;
    drawSources();
    return;
  }
  if (e.target.closest("[data-credit-cancel]")) { creditOpen = ""; drawSources(); }
});

$("#sourceList")?.addEventListener("submit", async (e) => {
  const form = e.target.closest("[data-credit-form]");
  if (!form) return;
  e.preventDefault();
  const s = SOURCE_ROWS[Number(form.dataset.creditForm)];
  const body = { file: s.name };
  form.querySelectorAll("[data-credit-field]").forEach((el) => { body[el.dataset.creditField] = el.value; });
  const note = form.querySelector("#creditPreview");
  try {
    const r = await fetch("/api/credit", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error || "could not save");
    creditOpen = "";
    loadSources();
  } catch (err) {
    if (note) note.textContent = String(err.message || "could not save");
  }
});

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
