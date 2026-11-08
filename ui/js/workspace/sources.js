/* klipian — the Sources page (/sources)
   ==========================================================================
   The raw videos in workspace/sources/ (/api/workspace/sources): the input
   side of the dashboard, between the upload schedule (Clips) and what came
   out (Rendered output). Per video: size, length, when it came in, whether it
   has a transcript, and which projects use it -- so a video nothing uses is
   easy to spot. A deleted video keeps its row (marked deleted, with the
   projects that used it) and, when it came from YouTube, a Download again button.

   Requires $/escapeHTML/timeAgo from helpers.js, confirmDialog/showToast from armed.js and
   _ytApi from ytdl.js -- loaded before this file.
   ========================================================================== */

function formatBytes(n) {
  if (n >= 1024 ** 3) return `${(n / 1024 ** 3).toFixed(1)} GB`;
  if (n >= 1024 ** 2) return `${Math.round(n / 1024 ** 2)} MB`;
  return `${Math.max(1, Math.round(n / 1024))} KB`;
}

function formatLength(sec) {
  if (sec == null) return "";
  const s = Math.round(sec);
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  const pad = (x) => String(x).padStart(2, "0");
  return h ? `${h}:${pad(m)}:${pad(r)}` : `${m}:${pad(r)}`;
}

let SOURCES_FOLDER = "";
let SOURCE_ROWS = [];             // what the table shows, for the credit form
let creditOpen = "";              // the video whose credit form is open
const selected = new Set();       // names of the live videos ticked for Delete selected
const sourceSort = createSort("sources", "at");
const sourceSearch = createSearch($("#sourceSearch"), () => { sourcePager.first(); drawSources(); });
const creditWho = (s) => {
  const c = s.credit || {};
  return [c.platform, c.creator].filter(Boolean).join(" · ") || (c.title ? `"${c.title}"` : "");
};
const SOURCE_GETTERS = {
  name: (s) => s.name, size: (s) => s.bytes, length: (s) => s.duration, at: (s) => s.at,
  transcribed: (s) => !!s.transcribed, used: (s) => s.used_by.length, credit: (s) => creditWho(s),
};
const SOURCE_FIELDS = ["name", (s) => s.used_by.map((u) => u.name).join(" "),
  (s) => [s.credit?.platform, s.credit?.creator, s.credit?.title].join(" ")];
let sourceSummary = "";
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
    const liveNames = new Set(source.filter((s) => !s.deleted).map((s) => s.name));
    for (const n of selected) if (!liveNames.has(n)) selected.delete(n);
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
    drawSelection();
    note.textContent = "this profile's sources folder is empty";
    list.innerHTML = `<p class="empty">No videos yet. Add one with <b>Add video…</b> on the
      Assets screen of a project, or copy the file into this profile's sources folder (<b>Open folder</b>).</p>`;
    return;
  }
  const live = source.filter((s) => !s.deleted);
  const gone = source.length - live.length;
  const total = live.reduce((t, s) => t + s.bytes, 0);
  sourceSummary = `${live.length} video${live.length === 1 ? "" : "s"} in this profile's sources · ${formatBytes(total)}`
    + (gone ? ` · ${gone} deleted` : "");
  note.textContent = sourceSummary;
  drawSources();
}

/* The current page of SOURCE_ROWS. The credit buttons carry the index into the
   WHOLE list, so it still finds its video on page 2. */
function drawSources() {
  const list = $("#sourceList");
  const q = sourceSearch.q();
  const shown = sourceSort.apply(SOURCE_ROWS.filter((s) => matchesQuery(s, SOURCE_FIELDS, q)), SOURCE_GETTERS);
  const note = $("#sourceNote");
  if (note && SOURCE_ROWS.length) note.textContent = q ? `${shown.length} of ${SOURCE_ROWS.length} match` : sourceSummary;
  if (q && !shown.length) {
    sourcePager.slice([]);
    list.innerHTML = `<p class="empty">No video matches “${escapeHTML(q)}”. <button class="btn sm" type="button" data-clear-search>Clear search</button></p>`;
    drawSelection();
    return;
  }
  const page = sourcePager.slice(shown);
  const pageLive = page.filter((s) => !s.deleted);
  const allTicked = pageLive.length > 0 && pageLive.every((s) => selected.has(s.name));
  list.innerHTML = `
    <div class="ws-row sources head">
      <span class="pick"><input type="checkbox" data-select-page title="Select every video on this page"
        ${allTicked ? "checked" : ""} ${pageLive.length ? "" : "disabled"} aria-label="Select every video on this page"></span>${[["name", "Video"], ["size", "Size"], ["length", "Length"], ["at", "Added"],
        ["transcribed", "Transcript"], ["used", "Used by"], ["credit", "Credit"]].map(([col, label]) => `<span>${sourceSort.headHTML(col, label)}</span>`).join("")}<span></span>
    </div>` + page.map((s) => {
      const i = SOURCE_ROWS.indexOf(s);       // the index into the WHOLE list, whatever the search and sort show
      const used = s.used_by.map((u) => u.name).join(", ");
      const who = creditWho(s);
      if (s.deleted) return `
    <div class="ws-row sources gone">
      <span class="pick"></span>
      <span class="name" title="${escapeHTML(s.name)}">${escapeHTML(s.name)} <span class="data">deleted${s.deleted_at ? " " + escapeHTML(s.deleted_at) : ""}</span></span>
      <span class="data"></span><span class="data"></span><span class="data"></span><span class="data"></span>
      <span class="used" data-none="${used ? "false" : "true"}" title="${escapeHTML(used)}">${used ? escapeHTML(used) : "not used"}</span>
      <span class="data" style="white-space:normal" title="${escapeHTML(s.credit_line || "")}">${escapeHTML(who)}${s.can_redownload ? ""
        : `${who ? " · " : ""}no link: add the file again with this name`}</span>
      ${s.can_redownload
        ? `<button class="btn sm" type="button" data-again="${i}" title="Download this video again under the same name">Download again</button>`
        : "<span></span>"}
    </div>`;
      return `
    <div class="ws-row sources">
      <span class="pick"><input type="checkbox" data-select="${i}"
        ${selected.has(s.name) ? "checked" : ""} aria-label="Select ${escapeHTML(s.name)}"></span>
      <span class="name" title="${escapeHTML(s.name)}">${escapeHTML(s.name)}</span>
      <span class="data">${formatBytes(s.bytes)}</span>
      <span class="data">${formatLength(s.duration)}</span>
      <span class="data">${timeAgo(s.at)}</span>
      <span class="data ${s.transcribed ? "done" : ""}">${s.transcribed ? "transcribed" : "not transcribed"}</span>
      <span class="used" data-none="${used ? "false" : "true"}" title="${escapeHTML(used)}">${used ? escapeHTML(used) : "not used"}</span>
      <button class="credit-btn" type="button" data-credit="${i}" data-set="${who ? "true" : "false"}"
              title="${escapeHTML(s.credit_line || "Where this video came from")}">${who ? escapeHTML(who) : "+ credit"}</button>
      <button class="btn sm" type="button" data-delete="${i}" title="Move this file to the Recycle Bin">Delete</button>
    </div>${creditOpen === s.name ? creditFormHTML(s, i) : ""}`;
    }).join("");
  drawSelection();
}

function drawSelection() {
  const b = $("#sourceDeleteSelBtn");
  if (!b) return;
  b.hidden = !selected.size;
  b.textContent = `Delete selected (${selected.size})`;
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
        <button class="btn main"
                type="submit">Save</button>
        <button class="btn"
                type="button" data-credit-cancel>Cancel</button>
        <span class="data" id="creditPreview" role="status">${escapeHTML(s.credit_line || "nothing entered yet")}</span>
      </div>
    </form>`;
}

$("#sourceList")?.addEventListener("change", (e) => {
  const one = e.target.closest("[data-select]");
  if (one) {
    const s = SOURCE_ROWS[Number(one.dataset.select)];
    if (one.checked) selected.add(s.name); else selected.delete(s.name);
    drawSources();
    return;
  }
  const page = e.target.closest("[data-select-page]");
  if (page) {
    for (const s of sourcePager.slice(SOURCE_ROWS)) {
      if (s.deleted) continue;
      if (page.checked) selected.add(s.name); else selected.delete(s.name);
    }
    drawSources();
  }
});

$("#sourceList")?.addEventListener("click", (e) => {
  const sortBtn = e.target.closest("[data-sort]");
  if (sortBtn) { sourceSort.toggle(sortBtn.dataset.sort); sourcePager.first(); drawSources(); return; }
  if (e.target.closest("[data-clear-search]")) { sourceSearch.clear(); sourcePager.first(); drawSources(); return; }
  const del = e.target.closest("[data-delete]");
  if (del) { deleteSource(SOURCE_ROWS[Number(del.dataset.delete)]); return; }
  const again = e.target.closest("[data-again]");
  if (again) { downloadAgain(SOURCE_ROWS[Number(again.dataset.again)], again); return; }
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

async function deleteSource(s) {
  const names = s.used_by.map((u) => u.name).join(", ");
  const ok = await confirmDialog({
    title: "Delete this video?",
    message: `${s.name} goes to the Recycle Bin (you can restore it there).`
      + (names ? ` Projects that use it (${names}) keep their data; the video shows as deleted there.` : ""),
    warning: names ? "A project uses this video." : "",
    tone: names ? "strong" : "danger",
  });
  if (!ok) return;
  try {
    const r = await fetch("/api/workspace/sources/delete", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ file: s.name }),
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error || "could not delete");
    showToast("Moved to the Recycle Bin.");
  } catch (err) {
    showToast(String(err.message || "could not delete"));
  }
  loadSources();
}

/* Delete selected: one confirm, then the same endpoint once per file, in turn. */
async function deleteSelected() {
  const rows = SOURCE_ROWS.filter((s) => !s.deleted && selected.has(s.name));
  if (!rows.length) return;
  const used = rows.filter((s) => s.used_by.length).map((s) => s.name);
  const ok = await confirmDialog({
    title: `Delete ${rows.length} video${rows.length === 1 ? "" : "s"}?`,
    message: `${rows.map((s) => s.name).join(", ")} go to the Recycle Bin (you can restore them there).`
      + (used.length ? ` Projects that use them keep their data; the videos show as deleted there.` : ""),
    warning: used.length ? `A project uses ${used.length === rows.length ? "every one of them" : `${used.length} of them`}.` : "",
    tone: used.length ? "strong" : "danger",
  });
  if (!ok) return;
  const failed = [];
  for (const s of rows) {
    try {
      const r = await fetch("/api/workspace/sources/delete", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ file: s.name }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "could not delete");
      selected.delete(s.name);
    } catch (err) {
      failed.push(`${s.name}: ${err.message || "could not delete"}`);
    }
  }
  showToast(failed.length ? `Not deleted: ${failed.join("; ")}` : `Moved ${rows.length} to the Recycle Bin.`);
  loadSources();
}

$("#sourceDeleteSelBtn")?.addEventListener("click", deleteSelected);

/* Download again: the same YouTube video, saved under the same name so projects find it. */
async function downloadAgain(s, btn) {
  btn.disabled = true;
  const fail = (m) => { showToast(m); loadSources(); };
  const d = await _ytApi("/api/ytdl/start", { url: `https://youtu.be/${s.credit.videoId}`, name: s.name });
  if (d.error) return fail(d.error);
  if (!d.id) return loadSources();                  // copied from another profile at once
  for (;;) {
    await new Promise((r) => setTimeout(r, 1000));
    const st = await _ytApi(`/api/ytdl/state?id=${encodeURIComponent(d.id)}`);
    if (st.state === "queued" || st.state === "running") { btn.textContent = `${st.percent || 0}%`; continue; }
    return st.state === "done" ? loadSources() : fail(st.message || "the download did not finish");
  }
}

$("#sourceYtBtn")?.addEventListener("click", () => openYouTubeDialog({ onAdded: () => loadSources() }));

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
