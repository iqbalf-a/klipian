/* klipian — workspace: panel Clips
   ==========================================================================
   Upload schedule: status, episode source, title/hook, description +
   hashtags, TikTok caption, date & time, post-publish link. Edited
   directly in the table, saved to workspace/schedule/clips.json via
   /api/workspace/clips whenever a cell finishes editing (the "change"
   event, not a Save button).

   Table only shows INLINE columns (status, title, platform, schedule) --
   the old 13-column layout made the table 1700px wide and forced
   horizontal scrolling just to read the next row. DETAIL fields
   (episode, file, description, caption, link, notes) were moved to a
   per-row dialog, opened via the "Detail" button (see openDetail()).

   Requires $/escapeHTML from helpers.js -- loaded before this file.
   ========================================================================== */

const STATUS = ["Draft", "Ready", "Scheduled", "Posted", "Discarded"];
const PLATFORM = ["YouTube", "TikTok", "YouTube + TikTok"];
const INLINE_FIELDS = ["title", "date", "time"];
// date and time are also table cells (INLINE_FIELDS): the same row fields, edited in either place
const DETAIL_FIELDS = ["episode", "file", "description", "tiktokCaption",
  "youtubeUrl", "tiktokUrl", "notes", "date", "time"];

let CLIPS = [];
const clipSort = createSort("clips");
let DRAFT = null;                    // the "+ New clip" row being filled in: local until Save
let showGoneOnly = false;            // the "N with deleted files" filter
const SELECTED = new Set();          // ids of the ticked rows: they stay across pages and sorting
const clipPager = createPager({ key: "clips", mount: $("#clipPager"), onChange: () => drawClips() });

async function loadClips() {
  try {
    const d = await (await fetch("/api/workspace/clips")).json();
    CLIPS = d.clip || [];
  } catch {
    CLIPS = [];
    $("#clipSummary").textContent = "needs klipian serve";
    drawClips();
    return;
  }
  summarizeClips();
  drawClips();
}

/* Workspace saves are fire-and-forget on every `change`, so a failure has
   to be visible: the value stays in the input either way, and without this
   there was nothing to distinguish "saved" from "silently lost". */
function clipError(message) {
  const el = $("#clipError");
  if (!el) return;
  if (!message) { el.hidden = true; el.textContent = ""; return; }
  el.textContent = apiErrorText(message);
  el.hidden = false;
}

function updateReadyButton() {
  const btn = $("#clipScheduleReady");
  if (!btn) return;
  const n = CLIPS.filter((c) => c.status === "Ready").length;
  btn.hidden = n === 0 || IS_GUEST;
  btn.textContent = `Schedule all Ready (${n})`;
}

function updateGoneCount() {
  const btn = $("#clipGone");
  if (!btn) return;
  const n = CLIPS.filter((c) => c.fileMissing).length;
  if (!n) showGoneOnly = false;
  btn.hidden = n === 0;
  btn.textContent = showGoneOnly ? `Showing ${n} with deleted files · show all` : `${n} with deleted files`;
  btn.setAttribute("aria-pressed", String(showGoneOnly));
}

function summarizeClips() {
  const per = {};
  for (const c of CLIPS) per[c.status] = (per[c.status] || 0) + 1;
  const parts = STATUS.filter((s) => per[s]).map((s) => `${per[s]} ${s.toLowerCase()}`);
  $("#clipSummary").textContent = parts.length
    ? `${CLIPS.length} clip${CLIPS.length > 1 ? "s" : ""} · ${parts.join(" · ")}`
    : "no clips yet";
}

/* A row whose render file is gone from out/ (the server says so on every load;
   it is not stored). Draft and Ready: the row is probably not wanted, so it can be
   Discarded or deleted (each asks twice). Posted and Scheduled: just a note -- the
   row is the record of what was posted, and deleting the local file afterwards is normal. */
function goneTagHTML(c) {
  if (!c.fileMissing) return "";
  const open = c.status === "Draft" || c.status === "Ready" || !c.status;
  return `<div class="ws-gone">
      <span class="ws-gone-tag" title="${open ? "The render file is no longer in out/: this clip may not be wanted any more." : "The render file is no longer in out/. Normal after posting: this row is the record of it."}">file deleted</span>
      ${open ? `<button class="btn sm" type="button" data-gone="discard">Discard</button>
      <button class="btn sm" type="button" data-gone="delete">Delete row</button>` : ""}
    </div>`;
}

/* A row that holds nothing yet: no title, file, link, text or notes. */
const isEmptyClip = (c) => !["title", "episode", "file", "description", "tiktokCaption",
  "youtubeUrl", "tiktokUrl", "notes"].some((k) => String(c[k] || "").trim());

/* "+ New clip" is a DRAFT: a row on screen with Save and Cancel, and NOT in the file.
   It is sent to the server only by Save (or Enter in its title), so Cancel (or Esc)
   leaves nothing behind -- no row to delete, nothing in the trash. */
function draftRowHTML(d) {
  const opt = (list, cur) => list.map((v) =>
    `<option value="${v}" ${v === cur ? "selected" : ""}>${v}</option>`).join("");
  const td = "px-2 py-1 border-b border-glass-border";
  return `
    <tr class="ws-draft" data-draft>
      <td class="${td}"></td>
      <td class="${td}"><select class="ws-input ws-status" data-draft-field="status" data-v="${d.status}">${opt(STATUS, d.status)}</select></td>
      <td class="${td}"><input class="ws-input" type="text" data-draft-field="title" value="${escapeHTML(d.title)}" placeholder="New clip title / hook">
        <div class="ws-fileline"><button class="btn sm" type="button" data-draft-choose>Choose video…</button>
          <span class="data" data-draft-file>${d.file ? escapeHTML(d.file) : "no video file (for a clip klipian did not render)"}</span></div></td>
      <td class="${td}"><select class="ws-input" data-draft-field="platform">${opt(PLATFORM, d.platform)}</select></td>
      <td class="${td}"><input class="ws-input" type="date" data-draft-field="date" value="${escapeHTML(d.date)}"></td>
      <td class="${td}"><input class="ws-input" type="time" data-draft-field="time" value="${escapeHTML(d.time)}"></td>
      <td class="${td}"><span class="data ws-created">not saved yet</span></td>
      <td class="${td}" colspan="2">
        <span class="ws-draft-actions">
          <button class="btn main" type="button" data-draft-save>Save</button>
          <button class="btn" type="button" data-draft-cancel>Cancel</button>
        </span>
      </td>
    </tr>`;
}

/* What was typed into the draft row, kept when the table is redrawn meanwhile. */
function syncDraftFromDom() {
  if (!DRAFT) return;
  document.querySelectorAll("#clipBody [data-draft-field]").forEach((el) => { DRAFT[el.dataset.draftField] = el.value; });
}

/* What YouTube reported about this clip's video (youtube.refresh_due): a small chip next to the
   status, with the sentence in its title. The status itself is not changed by a warning. */
function warnChipHTML(c) {
  if (!c.ytWarning) return "";
  return ` <span class="ws-warn" data-kind="${escapeHTML(c.ytWarning)}" title="${escapeHTML(c.ytWarningText || "")}">${escapeHTML(c.ytWarning)}</span>`;
}

/* A clip with a video of its own (chosen by hand, kept in out/manual/, or rendered on /remotion into out/motion/) shows its file name under the title. */
function fileLineHTML(c) {
  if ((c.fileFolder !== "manual" && c.fileFolder !== "motion") || !c.file) return "";
  return `<div class="ws-fileline"><span class="data" title="out/${escapeHTML(c.fileFolder)}/${escapeHTML(c.file)}">${escapeHTML(c.file)}</span></div>`;
}

function row(c) {
  const opt = (list, cur) => list.map((v) =>
    `<option value="${v}" ${v === cur ? "selected" : ""}>${v}</option>`).join("");
  const f = (name, type = "text") =>
    `<input class="ws-input" type="${type}" data-field="${name}" value="${escapeHTML(c[name] || "")}">`;
  const td = "px-2 py-1 border-b border-glass-border";    // centred by pager.css
  return `
    <tr class="hover:bg-glass" data-id="${c.id}"${SELECTED.has(c.id) ? " data-selected" : ""}>
      <td class="${td}"><input type="checkbox" data-select aria-label="Select this clip"${SELECTED.has(c.id) ? " checked" : ""}></td>
      <td class="${td}">
        <select class="ws-input ws-status" data-field="status" data-v="${c.status || "Draft"}">
          ${opt(STATUS, c.status || "Draft")}
        </select>${warnChipHTML(c)}
      </td>
      <td class="${td}">${f("title")}${goneTagHTML(c)}${fileLineHTML(c)}</td>
      <td class="${td}"><select class="ws-input" data-field="platform">${opt(PLATFORM, c.platform || "YouTube + TikTok")}</select></td>
      <td class="${td}">${f("date", "date")}</td>
      <td class="${td}">${f("time", "time")}</td>
      <td class="${td}"><span class="data ws-created" title="${escapeHTML(timeAgo(c.createdAt || c.at))}">${fmtCreated(c.createdAt || c.at)}</span></td>
      <td class="${td}"><button class="btn sm" data-action="detail" type="button">Detail</button></td>
      <td class="${td}"><button class="delete-btn" data-action="delete" type="button" title="Delete this clip">✕</button></td>
    </tr>`;
}

function drawClips() {
  const body = $("#clipBody");
  if (!body) return;
  const head = $("#clipCreatedHead");
  if (head) head.innerHTML = clipSort.headHTML("Created");
  updateGoneCount();
  updateReadyButton();
  syncDraftFromDom();
  const draftHTML = DRAFT ? draftRowHTML(DRAFT) : "";
  const add = $("#addClipBtn");
  if (add) add.disabled = !!DRAFT;
  queueMicrotask(updateBulkBar);
  if (!CLIPS.length) {
    clipPager.slice([]);
    body.innerHTML = draftHTML + (DRAFT ? "" : `<tr><td colspan="9" class="empty">
      No clips yet. Click "+ New clip" to start tracking your upload schedule.
    </td></tr>`);
    return;
  }
  body.innerHTML = draftHTML + clipPager.slice(clipSort.apply(showGoneOnly ? CLIPS.filter((c) => c.fileMissing) : CLIPS,
      (c) => c.createdAt || c.at)).map(row).join("");
}

/* Table rows only have inputs for INLINE_FIELDS -- detail fields (still
   stored in CLIPS from the previous load/save) MUST be carried along,
   not just the fields present in the DOM, so that editing in the table
   doesn't silently wipe out description/caption/link/notes that were
   filled in via the Detail dialog. */
function collectRow(tr) {
  const id = tr.dataset.id;
  const clip = { ...(CLIPS.find((c) => c.id === id) || {}), id };
  clip.status = $("[data-field=status]", tr).value;
  clip.platform = $("[data-field=platform]", tr).value;
  for (const name of INLINE_FIELDS) {
    const el = $(`[data-field="${name}"]`, tr);
    if (el) clip[name] = el.value;
  }
  return clip;
}

async function saveClip(clip) {
  try {
    const j = await (await fetch("/api/workspace/clips", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(clip),
    })).json();
    if (j.error) throw new Error(j.error);
    // New clip ID comes from the server -- rows created via "+ New clip"
    // don't have an ID until this first save.
    clip.id = j.id;
    if (j.createdAt) clip.createdAt = j.createdAt;
    const i = CLIPS.findIndex((c) => c.id === clip.id);
    if (i >= 0) CLIPS[i] = clip; else CLIPS.push(clip);
    summarizeClips();
    clipError("");
    return j.id;
  } catch (err) {
    console.error("failed to save clip:", err);
    clipError(`Not saved — ${err.message || "no connection to klipian serve"}. `
      + "The value on screen is not on disk.");
    return null;
  }
}

$("#clipCreatedHead")?.addEventListener("click", (e) => {
  if (!e.target.closest("[data-sort-created]")) return;
  clipSort.toggle();
  clipPager.first();
  drawClips();
});

$("#clipBody")?.addEventListener("change", (e) => {
  const tr = e.target.closest("tr[data-id]");
  if (!tr) return;
  if (e.target.matches("[data-select]")) {        // a tick is not an edit: nothing is saved
    if (e.target.checked) SELECTED.add(tr.dataset.id); else SELECTED.delete(tr.dataset.id);
    tr.toggleAttribute("data-selected", e.target.checked);
    updateBulkBar();
    return;
  }
  if (e.target.matches("[data-field=status]"))
    e.target.dataset.v = e.target.value;
  saveClip(collectRow(tr));
});

$("#clipGone")?.addEventListener("click", () => {
  showGoneOnly = !showGoneOnly;
  clipPager.first();
  drawClips();
});

/* Discard / Delete row on a row whose file is gone: asked first (a dialog), so one stray click
   changes nothing. */
$("#clipBody")?.addEventListener("click", async (e) => {
  const gone = e.target.closest("[data-gone]");
  if (!gone) return;
  e.stopImmediatePropagation();
  const tr = gone.closest("tr[data-id]");
  if (!tr) return;
  const gtitle = (CLIPS.find((x) => x.id === tr.dataset.id)?.title || "").trim() || "(untitled)";
  const discard = gone.dataset.gone === "discard";
  if (!(await confirmDialog(discard
    ? { title: "Discard this clip?", message: `${gtitle} — its video file is gone. It is marked Discarded and stays in the table.`, confirmText: "Discard" }
    : { title: "Delete this clip?", message: `${gtitle} — its video file is gone.` }))) return;
  if (discard) {
    const clip = collectRow(tr);
    clip.status = "Discarded";
    if (await saveClip(clip)) drawClips();
  } else {
    await deleteClips([tr.dataset.id]);          // asked already; Undo follows
  }
}, true);

$("#clipBody")?.addEventListener("click", async (e) => {
  const detail = e.target.closest('[data-action="detail"]');
  if (detail) {
    openDetail(detail.closest("tr[data-id]")?.dataset.id);
    return;
  }
  const b = e.target.closest('[data-action="delete"]');
  if (!b) return;
  const tr = b.closest("tr[data-id]");
  const id = tr?.dataset.id;
  if (!id) { tr.remove(); return; }   // empty row that was never saved
  // Two clicks. A clip that was posted or is scheduled is the record of what went
  // out, with its links: it says so, in a heavier red.
  const c = CLIPS.find((x) => x.id === id);
  // A row nobody filled in (it was saved empty before drafts existed, or after a
  // field was touched and then cleared) holds nothing to lose: one click, no trash.
  if (c && isEmptyClip(c) && !c.fileMissing) { await deleteClips([id], { empty: true }); return; }
  const posted = c && (c.status === "Posted" || c.status === "Scheduled");
  const name = ((c && c.title) || "").trim() || "(untitled)";
  if (!(await confirmDialog({
    title: "Delete this clip?", message: name, tone: posted ? "strong" : "danger",
    warning: posted ? "It is already on YouTube/TikTok; deleting the row does not remove the video there." : "",
  }))) return;
  await deleteClips([id]);
});

/* One delete for the row's x, "Delete row" and "Delete selected": the server keeps
   what it deleted (clips.trash.json), and the notice offers Undo for a few seconds.
   Undo puts the rows back exactly as they were -- every column, createdAt included,
   in the same place. fetch() does not reject on 4xx/5xx, so the body is read: a
   failed delete says so and leaves the rows on screen. */
async function deleteClips(ids, { empty = false } = {}) {
  let deleted = [];
  try {
    const j = await (await fetch("/api/workspace/clips/delete", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids, ...(empty ? { trash: false } : {}) }),
    })).json();
    if (j.error) throw new Error(j.error);
    deleted = j.deleted || [];
  } catch (err) {
    console.error("failed to delete clips:", err);
    clipError(`Not deleted — ${err.message || "no connection to klipian serve"}. `
      + "The clips are still on disk.");
    return;
  }
  clipError("");
  CLIPS = CLIPS.filter((c) => !deleted.includes(c.id));
  deleted.forEach((id) => SELECTED.delete(id));
  summarizeClips();
  drawClips();
  if (empty) return;                  // nothing in it: no notice, no Undo
  const n = deleted.length;
  showUndoToast(`${n} clip${n === 1 ? "" : "s"} deleted`, async () => {
    try {
      const j = await (await fetch("/api/workspace/clips/restore", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: deleted }),
      })).json();
      if (j.error) throw new Error(j.error);
      await loadClips();
      clipNotice(`${(j.restored || []).length} clip${(j.restored || []).length === 1 ? "" : "s"} restored`);
    } catch (err) {
      clipError(`Could not undo — ${err.message || "no connection to klipian serve"}.`);
    }
  });
}

$("#addClipBtn")?.addEventListener("click", () => {
  if (DRAFT) { $('#clipBody [data-draft-field="title"]')?.focus(); return; }
  DRAFT = { status: "Draft", platform: "YouTube + TikTok", title: "", date: "", time: "" };
  clipPager.first();
  drawClips();
  const el = $('#clipBody [data-draft-field="title"]');
  el?.focus();
  el?.closest("tr")?.scrollIntoView({ block: "nearest" });
});

function cancelDraft() {
  DRAFT = null;
  drawClips();                    // nothing was sent, so there is nothing to undo or clean up
}

async function saveDraft() {
  syncDraftFromDom();
  if (!DRAFT) return;
  const body = { ...DRAFT };
  try {
    const j = await (await fetch("/api/workspace/clips", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })).json();
    if (j.error) throw new Error(j.error);
    CLIPS.unshift({ ...body, id: j.id, createdAt: j.createdAt });
    DRAFT = null;
    // The new row is the newest: first when newest comes first, else last.
    if (clipSort.dir() === "desc") clipPager.first(); else clipPager.last();
    summarizeClips();
    drawClips();
    clipError("");
  } catch (err) {
    console.error("failed to create new clip:", err);
    clipError(`Could not create the clip — ${err.message || "no connection to klipian serve"}. The draft is still here.`);
  }
}

$("#clipBody")?.addEventListener("click", (e) => {
  if (e.target.closest("[data-draft-save]")) saveDraft();
  else if (e.target.closest("[data-draft-cancel]")) cancelDraft();
  else if (e.target.closest("[data-draft-choose]")) chooseClipVideo("draft");
});

/* ---------- a clip with a video of its own ("Choose video…") ---------- */

let clipFileFor = "";                    // "draft" or "detail": who asked for the picker
let detailPending = null;               // {fileFolder, title}: what Detail will save with the chosen file

/* Send the chosen file to the server (out/manual/ of this profile); resolves {file, title, existed}. */
function uploadClipFile(file, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `/api/workspace/clips/file?name=${encodeURIComponent(file.name)}`);
    xhr.setRequestHeader("Content-Type", "application/octet-stream");
    xhr.setRequestHeader("X-Klipian-Profile", PROFILE);
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(Math.round(100 * e.loaded / e.total)); };
    xhr.onload = () => {
      let d = {};
      try { d = JSON.parse(xhr.responseText); } catch { /* the status says it */ }
      if (xhr.status >= 200 && xhr.status < 300 && d.file) resolve(d);
      else reject(new Error(d.error || `Upload failed (${xhr.status}).`));
    };
    xhr.onerror = () => reject(new Error("Upload failed. Is klipian serve still running?"));
    xhr.send(file);
  });
}

function chooseClipVideo(who) {
  clipFileFor = who;
  const input = $("#clipFileInput");
  input.value = "";
  input.click();
}

$("#clipFileInput")?.addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const who = clipFileFor;
  const say = (text, bad = false) => {
    if (who === "draft") { const el = $("#clipBody [data-draft-file]"); if (el) el.textContent = text; }
    else detailNote(text, bad);
  };
  say(`Sending ${file.name} …`);
  try {
    const d = await uploadClipFile(file, (pct) => say(`Sending ${file.name} · ${pct}%`));
    if (who === "draft" && DRAFT) {
      syncDraftFromDom();
      DRAFT.file = d.file;
      DRAFT.fileFolder = "manual";
      if (!String(DRAFT.title || "").trim()) {                           // never over a title that was typed
        DRAFT.title = d.title;
        const t = $('#clipBody [data-draft-field="title"]');
        if (t) t.value = d.title;                                       // drawClips reads the inputs first
      }
      drawClips();
      $('#clipBody [data-draft-field="title"]')?.focus();
    } else if (who === "detail" && clipDialog.open) {
      const el = $('[data-field="file"]', clipDetailForm);
      if (el) el.value = d.file;
      detailPending = { fileFolder: "manual", title: d.title };
      const existing = CLIPS.find((c) => c.id === clipDialog.dataset.id);
      if (existing && !String(existing.title || "").trim()) $("#clipDetailTitle").textContent = d.title;
      detailNote(`${d.file}${d.existed ? " (the same video was already there)" : ""} — press Save to keep it.`);
    }
  } catch (err) {
    say(err.message, true);
  }
});

$("#detailChooseVideo")?.addEventListener("click", () => chooseClipVideo("detail"));

$("#clipBody")?.addEventListener("keydown", (e) => {
  const inDraft = e.target.closest("tr[data-draft]");
  if (!inDraft) return;
  if (e.key === "Escape") { e.preventDefault(); cancelDraft(); }
  else if (e.key === "Enter" && e.target.matches('[data-draft-field="title"]')) { e.preventDefault(); saveDraft(); }
});

/* ---------- bulk actions on the ticked rows ---------- */

const pad2 = (n) => String(n).padStart(2, "0");
const todayLocal = () => { const d = new Date(); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; };
const nowLocal = () => { const d = new Date(); return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`; };

function bulkNote(text) {
  const el = $("#bulkNote");
  if (el) el.textContent = text || "";
}

/* The bar shows while something is ticked; the header tick shows this page's state. */
function updateBulkBar() {
  const bar = $("#clipBulk");
  if (!bar) return;
  const wasHidden = bar.hidden;
  bar.hidden = SELECTED.size === 0;
  bar.closest("main")?.classList.toggle("bulk-open", !bar.hidden);   // room at the END of the page for the floating bar
  $("#bulkCount").textContent = `${SELECTED.size} selected`;
  if (wasHidden && !bar.hidden) bulkNote("");
  const boxes = [...document.querySelectorAll("#clipBody [data-select]")];
  const all = $("#clipSelectAll");
  if (all) {
    const on = boxes.filter((b) => b.checked).length;
    all.checked = boxes.length > 0 && on === boxes.length;
    all.indeterminate = on > 0 && on < boxes.length;
    all.disabled = boxes.length === 0;
  }
}

$("#clipSelectAll")?.addEventListener("change", (e) => {
  document.querySelectorAll("#clipBody tr[data-id]").forEach((tr) => {
    const box = $("[data-select]", tr);
    if (!box) return;
    box.checked = e.target.checked;
    if (e.target.checked) SELECTED.add(tr.dataset.id); else SELECTED.delete(tr.dataset.id);
    tr.toggleAttribute("data-selected", e.target.checked);
  });
  updateBulkBar();
});

$("#bulkDelete")?.addEventListener("click", async (e) => {
  const n = SELECTED.size;
  if (!n) return;
  const posted = [...SELECTED].filter((id) => ["Posted", "Scheduled"].includes(CLIPS.find((c) => c.id === id)?.status)).length;
  if (!(await confirmDialog({
    title: `Delete ${n} clip${n === 1 ? "" : "s"}?`, tone: posted ? "strong" : "danger",
    message: posted ? `${posted} of them ${posted === 1 ? "is" : "are"} Posted or Scheduled.` : "",
    warning: posted ? "Those are already on YouTube/TikTok; deleting the rows does not remove the videos there." : "",
  }))) return;
  await deleteClips([...SELECTED]);
});

$("#bulkClear")?.addEventListener("click", () => {
  SELECTED.clear();
  drawClips();
});

/* One request for the whole selection; the rows it changed come back and replace
   the ones on screen, in the same places (the order is by Created, which it keeps). */
async function bulkApply(body, done) {
  const ids = [...SELECTED];
  try {
    const j = await (await fetch("/api/workspace/clips/bulk", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids, ...body }),
    })).json();
    if (j.error) throw new Error(j.error);
    for (const row of j.clip) {
      const i = CLIPS.findIndex((c) => c.id === row.id);
      if (i >= 0) CLIPS[i] = row;
    }
    // Rows that no longer exist (deleted elsewhere) just leave the selection.
    for (const id of j.missing || []) SELECTED.delete(id);
    clipError("");
    SELECTED.clear();
    summarizeClips();
    drawClips();
    bulkNote("");
    clipNotice(done(j));
  } catch (err) {
    console.error("bulk action failed:", err);
    clipError(`Not saved — ${err.message || "no connection to klipian serve"}. Nothing was changed.`);
  }
}

function clipNotice(text) {
  const el = $("#clipNotice");
  if (!el) return;
  el.textContent = text || "";
  el.hidden = !text;
}

/* Mark as Posted: a small dialog asks when it went live (today and now to start with); Esc, Cancel and a
   click outside change nothing. The same server call as before (status, date, time). */
const markPostedDialog = $("#markPostedDialog");
$("#bulkPosted")?.addEventListener("click", () => {
  if (!SELECTED.size) return;
  $("#markPostedTitle").textContent = `Mark ${SELECTED.size} clip${SELECTED.size === 1 ? "" : "s"} as posted`;
  $("#markPostedDate").value = todayLocal();
  $("#markPostedTime").value = nowLocal();
  markPostedDialog.returnValue = "";
  markPostedDialog.showModal();
});
markPostedDialog?.addEventListener("click", (e) => {
  // outside the box = on the backdrop (the dialog's own padding does not count)
  const r = markPostedDialog.getBoundingClientRect();
  if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) markPostedDialog.close("cancel");
});
$("#markPostedForm")?.addEventListener("submit", (e) => {
  if (e.submitter?.value !== "ok") return;
  const date = $("#markPostedDate").value, time = $("#markPostedTime").value;
  if (!date) { e.preventDefault(); $("#markPostedDate").focus(); return; }
  // overwrite: the went-live date and time replace each clip's own upload date and time
  bulkApply({ status: "Posted", date, time, overwrite: true }, (j) => {
    const n = j.clip.length;
    return `${n} clip${n === 1 ? "" : "s"} marked Posted · went live ${date}${time ? " " + time : ""}`;
  });
});

$("#bulkSetStatus")?.addEventListener("click", () => {
  const status = $("#bulkStatus").value;
  if (!status) { bulkNote("Choose a status first."); return; }
  bulkApply({ status }, (j) => `${j.clip.length} clip${j.clip.length === 1 ? "" : "s"} set to ${status}`);
});

/* ---------- pasted links ---------- */

// What counts as a link to a post on each platform.
const LINK_RULES = {
  youtubeUrl: { platform: "YouTube", example: "youtube.com/shorts/…, youtu.be/… or youtube.com/watch?v=…",
    ok: /^https?:\/\/((www|m)\.)?youtube\.com\/(shorts\/[\w-]{6,}|watch\?(?:[^#]*&)?v=[\w-]{6,})|^https?:\/\/youtu\.be\/[\w-]{6,}/i },
  tiktokUrl: { platform: "TikTok", example: "tiktok.com/@name/video/…, vm.tiktok.com/… or tiktok.com/t/…",
    ok: /^https?:\/\/(www\.)?tiktok\.com\/(@[\w.]+\/video\/\d+|t\/[\w-]+)|^https?:\/\/(vm|vt)\.tiktok\.com\/[\w-]+/i },
};

/* Pasting a link means the clip IS posted: Draft or Ready becomes Posted, an empty
   date and time are filled, and the platform includes where the link is from.
   Scheduled and Discarded are left as they are (the person says so). Clearing a
   link changes nothing. Returns what it changed, in words. */
function applyLinkToClip(clip, was) {
  const notes = [];
  for (const [field, rule] of Object.entries(LINK_RULES)) {
    const url = (clip[field] || "").trim();
    if (!url || url === (was[field] || "").trim()) continue;      // empty or not new
    if (!(clip.platform || "").includes(rule.platform)) {
      // The other single platform, or none yet.
      clip.platform = (clip.platform || "") ? "YouTube + TikTok" : rule.platform;
      notes.push(`platform is now ${clip.platform}`);
    }
    if (clip.status === "Draft" || clip.status === "Ready" || !clip.status) {
      clip.status = "Posted";
      notes.push("status is now Posted");
    } else if (clip.status !== "Posted") {
      notes.push(`status stays ${clip.status}`);
    }
    if (clip.status === "Posted" && !(clip.date || "").trim()) {
      clip.date = todayLocal();
      if (!(clip.time || "").trim()) clip.time = nowLocal();
      notes.push(`upload date set to ${clip.date} ${clip.time}`);
    }
  }
  return notes;
}

/* ---------- Detail dialog ---------- */

const clipDialog = $("#clipDetailDialog");
const clipDetailForm = $("#clipDetailForm");

/* The Hashtags field holds "#a #b"; the row keeps a list. A row from before the list existed shows
   the hashtags found on the description's hashtag-only lines. */
const tagsToInput = (c) => (Array.isArray(c.hashtags) && c.hashtags.length ? c.hashtags : splitDescription(c.description).tags)
  .map((t) => `#${normTag(t)}`).filter((t) => t !== "#").join(" ");
const inputToTags = (text) => normTags((String(text).match(/#?[\p{L}\p{N}_]+/gu) || []));

/* What the dialog holds now, as a row: the text fields and the hashtag list. */
function detailValues() {
  const values = {};
  for (const name of DETAIL_FIELDS) {
    const el = $(`[data-field="${name}"]`, clipDetailForm);
    if (el) values[name] = el.value;
  }
  values.hashtags = inputToTags($("#detailHashtags")?.value || "");
  if (detailPending) {
    values.fileFolder = detailPending.fileFolder;
    const existing = CLIPS.find((c) => c.id === clipDialog.dataset.id);
    if (existing && !String(existing.title || "").trim()) values.title = detailPending.title;   // never over a typed title
  }
  return values;
}

/* "On YouTube": the exact title and description that would be sent, following the profile's
   hashtag setting (hashtags.js, the same logic as the server's). Live while the fields change. */
function updateYtPreview() {
  const t = $("#ytPreviewTitle"), d = $("#ytPreviewDesc");
  if (!t || !d || !clipDialog.dataset.id) return;
  const v = detailValues();
  const row = CLIPS.find((x) => x.id === clipDialog.dataset.id) || {};
  const plan = hashtagPlan(row.title || "", v.description || "", v.hashtags, profileHashtagSettings());
  t.value = plan.title;
  d.value = plan.description;
  const len = [...plan.title].length;
  t.title = `${len} of 100 characters`;
  t.dataset.over = String(len > 100);
  const when = $("#ytPreviewWhen");
  if (when) when.textContent = v.date && v.time ? `Goes to YouTube at ${v.date} ${v.time}, as scheduled.`
    : "No upload date and time yet: set them above to schedule it.";
  growText(d);
}

clipDetailForm?.addEventListener("input", (e) => {
  if (e.target.matches('[data-field="description"], [data-field="date"], [data-field="time"], #detailHashtags')) updateYtPreview();
});

function openDetail(id, focusField = "") {
  if (!id || !clipDialog) return;
  const c = CLIPS.find((x) => x.id === id);
  if (!c) return;
  clipDialog.dataset.id = id;
  detailPending = null;
  const chooseWrap = $("#detailChooseWrap");
  if (chooseWrap) chooseWrap.hidden = !!c.projectId;           // a rendered clip has its file already
  // Title here is read-only context -- edited from the table so there's
  // no single source of truth for the same field in two places.
  $("#clipDetailTitle").textContent = c.title || "(untitled)";
  $("#clipDetailTitle").dataset.title = c.title || "";
  for (const name of DETAIL_FIELDS) {
    const el = $(`[data-field="${name}"]`, clipDetailForm);
    if (el) el.value = c[name] || "";
  }
  detailNote("");
  const hashtagsEl = $("#detailHashtags");
  if (hashtagsEl) hashtagsEl.value = tagsToInput(c);
  refreshYouTubeSection(c);
  clipDialog.returnValue = "";          // Esc keeps the LAST value otherwise: a cancel would save
  clipDialog.showModal();
  updateYtPreview();
  clipDialog.querySelectorAll("textarea.ws-input").forEach(growText);
  if (focusField) $(`[data-field="${focusField}"]`, clipDetailForm)?.focus();
}

/* A text area as tall as its text: at least its own rows, at most 45% of the
   window, then it scrolls. */
function growText(el) {
  el.style.height = "auto";
  el.style.height = `${Math.min(el.scrollHeight + 2, Math.round(window.innerHeight * 0.45))}px`;
}

clipDetailForm?.addEventListener("input", (e) => {
  if (e.target.matches("textarea.ws-input")) growText(e.target);
});

/* Copy and Open buttons of the dialog. */
clipDetailForm?.addEventListener("click", async (e) => {
  const copy = e.target.closest("[data-copy], [data-copy-title]");
  const open = e.target.closest("[data-open]");
  if (copy) {
    const text = copy.hasAttribute("data-copy-title")
      ? ($("#clipDetailTitle").dataset.title || "")
      : ($(`[data-field="${copy.dataset.copy}"]`, clipDetailForm)?.value || "");
    if (!text.trim()) { copy.textContent = "Empty"; setTimeout(() => { copy.textContent = copy.dataset.label || "Copy"; }, 1200); return; }
    copy.dataset.label = copy.dataset.label || copy.textContent;
    if (await copyText(text)) flashCopied(copy);
  } else if (open) {
    const url = ($(`[data-field="${open.dataset.open}"]`, clipDetailForm)?.value || "").trim();
    if (/^https?:\/\//i.test(url)) window.open(url, "_blank", "noopener");
    else { open.textContent = "No link"; setTimeout(() => { open.textContent = "Open"; }, 1200); }
  }
});

/* ---------- upload to YouTube (P16): many rows, one queue ---------- */

const ytBulk = { jobId: null, ids: [], mode: "plan", publishMode: "schedule" };   // mode: plan | running | ended; publishMode: schedule | now

/* The one secondary button: Cancel (plan: closes, sends nothing), "Cancel after this file"
   (queue running), Close (queue over). */
function ytBulkMode(mode) {
  ytBulk.mode = mode;
  const af = $("#ytAutofill");
  if (af) af.hidden = mode !== "plan" || ytBulk.publishMode === "now";
  const bar = $("#ytModeBar");
  if (bar) bar.hidden = mode !== "plan";
  if (mode !== "plan" && $("#ytNowWarn")) $("#ytNowWarn").hidden = ytBulk.publishMode !== "now" || mode === "ended";
  $("#ytBulkCancel").textContent = mode === "running" ? "Cancel after this file" : mode === "ended" ? "Close" : "Cancel";
}

function ytBulkGoState(enabled, count, why) {
  const go = $("#ytBulkGo");
  go.hidden = false;
  go.disabled = !enabled;
  const now = ytBulk.publishMode === "now";
  go.textContent = now ? (count ? `Publish ${count} now` : "Publish now") : (count ? `Upload ${count}` : "Upload");
  go.classList.toggle("main", !now);
  go.title = enabled ? "" : (why || "");
  // The reason in plain sight, not only in the tooltip of a button that looks active.
  const reason = $("#ytBulkWhy");
  if (reason) { reason.textContent = enabled ? "" : (why || ""); reason.hidden = enabled || !why; }
}

function ytBulkRows(rows) {
  return rows.map((r) => {
    const icon = { pending: "·", uploading: "↑", done: "✓", failed: "✕", skipped: "–" }[r.state] || "·";
    const pct = r.state === "uploading" ? ` ${Math.round((r.progress || 0) * 100)}%` : "";
    return `<div class="yt-bulk-row" data-state="${r.state}"><span class="yt-bulk-icon">${icon}</span>
      <span class="yt-bulk-title">${escapeHTML(r.title || "(untitled)")}</span>
      <span class="yt-bulk-msg">${escapeHTML(r.message || "")}${pct}</span></div>`;
  }).join("");
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/* "2026-10-22" + "18:30" -> "Thu 22 Oct 18:30" (local time, like everywhere else). */
function fmtWhen(date, time) {
  const d = new Date(`${date}T${time || "00:00"}`);
  if (!date || Number.isNaN(d.getTime())) return "";
  return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}${time ? " " + time : ""}`;
}

const localDate = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const localTime = (d) => `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
/* A time YouTube will take as "in the future": more than 5 minutes ahead (the server asks for 2). */
const isFutureSlot = (date, time) => {
  const d = new Date(`${date}T${time}`);
  return !Number.isNaN(d.getTime()) && d.getTime() > Date.now() + 5 * 60 * 1000;
};

/* The dialog IS the schedule step. When it opens, every row refused only for its schedule gets a
   PROPOSED date and time from the Auto-fill settings (start, every N days/hours, in the order the rows
   were selected); the person can change the settings (the proposals follow at once) or type over a
   row. Nothing is saved while proposing. "Upload" then (a) saves every proposed/edited schedule in ONE
   request, (b) asks the server for the plan again (the server stays the judge), (c) starts the queue
   -- unless the server refuses some rows, in which case the rest waits for a second press. Cancel
   saves nothing. */
async function openYtBulk(ids, what) {
  const dlg = $("#ytBulkDialog"), list = $("#ytBulkList"), note = $("#ytBulkNote");
  $("#ytBulkTitle").textContent = `Upload ${what} to YouTube`;
  ytBulkSetPublishMode("schedule");                    // never remembered: every time the dialog opens it is Schedule
  ytBulkMode("plan");
  ytBulkGoState(false, 0, "Checking…");
  note.textContent = ""; list.innerHTML = "";
  ytShowDetail("#ytBulkDetail", "", "");
  $("#ytBulkQuota").textContent = "Checking…";
  $("#ytAutofill").hidden = true;
  $("#ytAfMsg").textContent = "";
  ytBulk.request = ids.slice();
  ytBulk.plan = null;
  ytBulk.edits = new Map();
  ytBulk.confirmed = false;
  const tomorrow = new Date(Date.now() + 24 * 3600 * 1000);
  $("#ytAfDate").value = localDate(tomorrow);
  $("#ytAfTime").value = "18:30";
  $("#ytAfEvery").value = "0";                         // 0: every clip at the same date and time
  $("#ytAfUnit").value = "day";
  $("#ytAfAll").checked = false;
  dlg.showModal();
  await ytBulkPlan();
}

/* The mode of the whole run: Schedule (each row at its own date and time) or Publish now (every row public at once). */
function ytBulkSetPublishMode(mode) {
  ytBulk.publishMode = mode;
  document.querySelectorAll("[data-ytmode]").forEach((b) => b.setAttribute("aria-checked", String(b.dataset.ytmode === mode)));
  const now = mode === "now";
  if ($("#ytNowWarn")) $("#ytNowWarn").hidden = !now;
  if ($("#ytAutofill")) $("#ytAutofill").hidden = now || ytBulk.mode !== "plan";
}

$("#ytModeBar")?.addEventListener("click", async (e) => {
  const opt = e.target.closest("[data-ytmode]");
  if (!opt || ytBulk.mode !== "plan" || opt.dataset.ytmode === ytBulk.publishMode) return;
  ytBulkSetPublishMode(opt.dataset.ytmode);
  ytBulk.confirmed = false;
  ytBulkGoState(false, 0, "Checking…");
  await ytBulkPlan();                                  // the server judges again, in the new mode
});

/* Under a message: what Google really said (one line) with "Copy details"; nothing when there is none. */
function ytShowDetail(boxSel, detail, report) {
  const box = $(boxSel);
  if (!box) return;
  box.replaceChildren();
  box.hidden = !detail;
  if (detail) box.append(makeDetailLine(detail, report));
}

/* Ask the server for the plan of the rows asked for. Returns it (or null when it cannot be read). */
async function ytBulkFetch() {
  const note = $("#ytBulkNote");
  try {
    ytBulk.status = await (await fetch("/api/youtube/status")).json();
    const plan = await (await fetch("/api/youtube/bulk-plan", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: ytBulk.request, mode: ytBulk.publishMode }),
    })).json();
    if (plan.error) { note.textContent = plan.error; return null; }
    return plan;
  } catch { note.textContent = "Cannot reach the klipian server."; return null; }
}

/* (Re)read the plan and draw one line per row, in the order they were selected. A row that can be sent
   as it is shows its saved time; one refused only for want of a schedule (or any row, when "also
   reschedule" is ticked) shows date and time inputs that ytBulkSync fills with proposals. */
async function ytBulkPlan() {
  const plan = await ytBulkFetch();
  if (plan) ytBulkDraw(plan);
}

function ytBulkDraw(plan) {
  ytBulk.plan = plan;
  ytBulk.ids = plan.ok.map((r) => r.id);
  const byId = new Map([...plan.ok.map((r) => [r.id, { ...r, okRow: true }]), ...plan.refused.map((r) => [r.id, r])]);
  $("#ytBulkList").innerHTML = ytBulk.request.filter((id) => byId.has(id)).map((id) => {
    const r = byId.get(id);
    const t = escapeHTML(r.okRow ? (r.finalTitle || r.title) : r.title);
    const inputs = `<span class="yt-bulk-when" hidden>
        <input class="ws-input" type="date" data-ytwhen="date" aria-label="Upload date of ${escapeHTML(r.title)}">
        <input class="ws-input" type="time" data-ytwhen="time" aria-label="Upload time of ${escapeHTML(r.title)}">
        <span class="yt-bulk-tag" data-ytwhen-tag></span></span>`;
    if (r.okRow) {
      return `<div class="yt-bulk-row sendable" data-kind="ok" data-state="pending" data-id="${escapeHTML(r.id)}" data-date="${escapeHTML(r.date || "")}" data-time="${escapeHTML(r.time || "")}">
        <span class="yt-bulk-icon">✓</span><span class="yt-bulk-title" title="${t}">${t}</span>
        <span class="yt-bulk-msg"><span class="yt-bulk-saved">${ytBulk.publishMode === "now" ? "publishes right away" : escapeHTML(fmtWhen(r.date, r.time) || r.when)}</span>${inputs}</span></div>`;
    }
    const detail = `<button class="btn sm" type="button" data-ytdetail="${escapeHTML(r.id)}"${r.needsSchedule || /upload date|date and time/i.test(r.message || "") ? ' data-focus="date"' : ""}>Detail</button>`;
    if (r.needsSchedule) {
      return `<div class="yt-bulk-row sched" data-kind="sched" data-state="failed" data-id="${escapeHTML(r.id)}" data-date="${escapeHTML(r.date || "")}" data-time="${escapeHTML(r.time || "")}">
        <span class="yt-bulk-icon">✕</span><span class="yt-bulk-title" title="${t}">${t}</span>
        <span class="yt-bulk-msg">${inputs}<span class="yt-bulk-hint" data-ytwhen-msg></span> ${detail}</span></div>`.replace("data-kind=\"sched\"", `data-kind="sched" data-why="${escapeHTML(r.message)}"`);
    }
    return `<div class="yt-bulk-row" data-kind="refused" data-state="failed" data-id="${escapeHTML(r.id)}"><span class="yt-bulk-icon">✕</span>
      <span class="yt-bulk-title" title="${t}">${t}</span><span class="yt-bulk-msg">${escapeHTML(r.message)} ${detail}</span></div>`;
  }).join("");
  $("#ytAutofill").hidden = ytBulk.publishMode === "now";
  ytBulkSync();
}

/* The proposals: start + i * interval for the i-th row that takes one (a row the person typed over
   keeps its place in the sequence, so the others do not shift). {slots: [Date...]} or {error}. */
function ytBulkSlots(count) {
  const date = $("#ytAfDate").value, time = $("#ytAfTime").value;
  const every = Number($("#ytAfEvery").value), unit = $("#ytAfUnit").value;
  if (!date || !time) return { error: "Pick a date and time." };
  if (!isFutureSlot(date, time)) return { error: "That time has passed: pick a time in the future." };
  const slots = gapSlotsMs(new Date(`${date}T${time}`).getTime(), every, unit, count);   // schedgap.js
  if (!slots) return { error: "The gap must be a whole number, 0 or more." };
  return { slots: slots.map((ms) => new Date(ms)) };
}

/* Bring every line of the list and the totals in line with the settings and the edits. Nothing is
   fetched or saved here. */
function ytBulkSync() {
  const plan = ytBulk.plan;
  if (!plan) return;
  const all = $("#ytAfAll").checked;
  const rows = [...document.querySelectorAll("#ytBulkList .yt-bulk-row")];
  // After the server refused some rows at Upload, the list shows its verdict as it is: no proposals. In Publish now
  // there is no schedule at all, so no row takes proposals or inputs.
  const targets = (ytBulk.confirmed || ytBulk.publishMode === "now") ? [] : rows.filter((r) => r.dataset.kind === "sched" || (all && r.dataset.kind === "ok"));
  const proposal = ytBulkSlots(targets.length);
  $("#ytAfMsg").textContent = proposal.error && targets.length ? proposal.error : "";
  // The controls say what they do: one clip needs no gap; with a gap of 0 the date and time are shared by all.
  const one = targets.length === 1, gap0 = Number($("#ytAfEvery").value) === 0;
  $("#ytAfGap").hidden = one;
  $("#ytAfDateLabel").textContent = one ? "Goes live on" : gap0 ? "Date" : "Start date";
  $("#ytAfTimeLabel").textContent = one ? "at" : gap0 ? "Time" : "Start time";
  const preview = $("#ytAfPreview"), spread = $("#ytAfSpread");
  if (proposal.slots && targets.length >= 2) {
    const when = (d) => fmtWhen(localDate(d), localTime(d));
    preview.textContent = gap0 ? `All ${targets.length} clips: ${when(proposal.slots[0])}`
      : proposal.slots.slice(0, 3).map((d, i) => `Clip ${i + 1}: ${when(d)}`).join(" · ") + (targets.length > 3 ? " · …" : "");
  } else preview.textContent = "";
  spread.hidden = !(proposal.slots && targets.length >= 2 && gap0);
  ytBulk.effective = new Map();                       // id -> {date, time} for the rows that will be sent
  ytBulk.sendIds = [];                                // every row that shows ✓
  let sendable = 0;
  rows.forEach((row) => {
    const id = row.dataset.id, kind = row.dataset.kind;
    const isTarget = targets.includes(row);
    const inputs = $(".yt-bulk-when", row);
    if (inputs) inputs.hidden = !isTarget;
    const saved = $(".yt-bulk-saved", row);
    if (saved) saved.hidden = isTarget;
    let ok = kind === "ok";
    if (isTarget) {
      const edit = ytBulk.edits.get(id);
      const slot = proposal.slots?.[targets.indexOf(row)];
      const eff = edit || (slot ? { date: localDate(slot), time: localTime(slot) } : null);
      const dI = $('[data-ytwhen="date"]', row), tI = $('[data-ytwhen="time"]', row);
      const shown = eff || { date: row.dataset.date, time: row.dataset.time };
      if (document.activeElement !== dI) dI.value = shown.date || "";
      if (document.activeElement !== tI) tI.value = shown.time || "";
      $("[data-ytwhen-tag]", row).textContent = edit ? "set by you" : eff ? "proposed" : "";
      $("[data-ytwhen-tag]", row).dataset.by = edit ? "you" : "proposed";
      let msg = "";
      ok = !!(eff && eff.date && eff.time && isFutureSlot(eff.date, eff.time));
      if (!eff) msg = proposal.error || "Set a date and time.";
      else if (!eff.date || !eff.time) msg = "Fill in both the date and the time.";
      else if (!ok) msg = "That time has passed: pick a time in the future.";
      const hint = $("[data-ytwhen-msg]", row);
      if (hint) hint.textContent = msg;
      if (ok) ytBulk.effective.set(id, eff);
    }
    if (kind === "sched" && !isTarget) {
      const hint = $("[data-ytwhen-msg]", row);
      if (hint) hint.textContent = row.dataset.why || "";
    }
    row.dataset.state = ok ? "pending" : "failed";
    $(".yt-bulk-icon", row).textContent = ok ? "✓" : "✕";
    if (ok) { sendable++; ytBulk.sendIds.push(id); }
  });
  ytBulk.sendable = sendable;
  if ($("#ytNowCount")) $("#ytNowCount").textContent = String(sendable);
  const sends = Math.min(sendable, plan.remaining);
  $("#ytBulkQuota").textContent = `Today's quota: ${plan.usedToday} of ${plan.limit} uploads used · this channel: ${plan.last24h ?? 0} in the last 24 h · this run sends ${sends}`
    + (sendable > plan.remaining ? ` · ${sendable - plan.remaining} will not fit today and stay as they are` : "")
    + (plan.hint ? ` · ${plan.hint}` : "");
  const st = ytBulk.status || {}, note = $("#ytBulkNote");
  let why = "";
  if (plan.running) why = "A bulk upload is already running for this profile.";
  else if (st.client?.state === "invalid") why = "The client_secret.json is not valid: fix it in the profile settings.";
  else if (st.light !== "green") why = "This profile is not connected to YouTube.";
  else if (!sendable) why = targets.length && proposal.error ? proposal.error
    : "Nothing can be sent yet: fix the clips marked ✕ (each has a Detail button).";
  if (st.light !== "green" || st.client?.state === "invalid") {
    note.innerHTML = `${escapeHTML(st.client?.state === "invalid" ? "The client_secret.json is not valid." : "This profile is not connected to YouTube.")}
      <button class="btn sm" type="button" id="ytBulkSettings">Open profile settings</button>`;
  } else if (plan.running) {
    note.textContent = "A bulk upload is already running for this profile.";
  } else if (!ytBulk.confirmed) note.textContent = "";
  ytBulkGoState(!why, sendable, why);
}

// Any change of the settings or of a row re-computes the proposals at once, and un-confirms a pending "send the rest".
["input", "change"].forEach((ev) => $("#ytAutofill")?.addEventListener(ev, () => { ytBulk.confirmed = false; ytBulkSync(); }));
["input", "change"].forEach((ev) => $("#ytBulkList")?.addEventListener(ev, (e) => {
  const input = e.target.closest("[data-ytwhen]");
  if (!input) return;
  const row = input.closest(".yt-bulk-row");
  const date = $('[data-ytwhen="date"]', row).value, time = $('[data-ytwhen="time"]', row).value;
  // typing over a proposal makes it the person's own; emptying both hands the row back to the proposals
  if (!date && !time) ytBulk.edits.delete(row.dataset.id); else ytBulk.edits.set(row.dataset.id, { date, time });
  ytBulk.confirmed = false;
  ytBulkSync();
}));

/* Save dates and times to the rows in ONE request (the same two fields as the table and Detail),
   and draw the table behind the dialog again. */
async function ytBulkSaveSchedule(items) {
  if (!items.length) return true;
  try {
    const j = await (await fetch("/api/workspace/clips/schedule", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rows: items }),
    })).json();
    if (j.error || !j.ok) throw new Error(j.error || "not saved");
  } catch (err) {
    $("#ytBulkNote").textContent = `Not saved — ${err.message}.`;
    return false;
  }
  await loadClips();
  return true;
}


/* One click: (a) save the proposed and typed schedules in ONE request, (b) ask the server for the plan
   again (it stays the judge), (c) start the queue. If the server refuses rows the person thought were
   fine (a time that just passed ...), they are shown and nothing starts until Upload is pressed again
   for the rest. */
async function ytBulkWatch() {
  const list = $("#ytBulkList"), note = $("#ytBulkNote");
  const watched = ytBulk.jobId;
  for (;;) {
    await new Promise((r) => setTimeout(r, 1000));
    let s;
    try { s = await (await fetch(`/api/youtube/bulk-state?id=${encodeURIComponent(ytBulk.jobId)}`)).json(); } catch { continue; }
    if (list) list.innerHTML = ytBulkRows(s.rows || []);
    $("#ytBulkQuota").textContent = `Today's quota: ${s.usedToday} of ${s.limit} uploads used`;
    if (s.state === "running") continue;
    note.textContent = s.note || (s.state === "cancelled" ? "Cancelled: the rest were not sent." : "Done.");
    ytShowDetail("#ytBulkDetail", s.detail, s.report);
    ytBulkMode("ended");
    ytBulk.jobId = null;
    await loadClips();
    // ONE notice at the end of the queue (Schedule and Publish now alike): "5 sent · 1 failed · 2 not sent", with why it stopped.
    const rows = s.rows || [];
    const sent = rows.filter((r) => r.state === "done").length;
    const failedRows = rows.filter((r) => r.state === "failed").length;
    const notSent = rows.filter((r) => r.state === "pending" || r.state === "skipped").length;
    const bits = [`${sent} ${s.mode === "now" ? "published" : "sent"}`];
    if (failedRows) bits.push(`${failedRows} failed`);
    if (notSent) bits.push(`${notSent} not sent`);
    notifyDone({
      key: `ytbulk:${watched}`,
      title: s.state === "stopped" ? "Upload stopped" : s.state === "cancelled" ? "Upload cancelled" : "Upload finished",
      body: bits.join(" · ") + (s.state === "stopped" && s.note ? `. ${s.note}` : ""),
      kind: s.state === "stopped" || failedRows ? "failure" : "success", quiet: s.state === "cancelled", ms: s.detail ? 20000 : 12000,
      detail: s.detail ? { text: s.detail, report: s.report } : null,
    });
    return;
  }
}

$("#ytBulkGo")?.addEventListener("click", async (e) => {
  const go = e.currentTarget, note = $("#ytBulkNote");
  go.disabled = true; note.textContent = "Starting…";
  try {
    const now = ytBulk.publishMode === "now";
    if (!ytBulk.confirmed) {
      const items = now ? [] : [...ytBulk.effective].map(([id, w]) => ({ id, date: w.date, time: w.time }));
      if (items.length) note.textContent = `Saving ${items.length} schedule${items.length === 1 ? "" : "s"}…`;
      if (!(await ytBulkSaveSchedule(items))) { go.disabled = false; return; }
      const plan = await ytBulkFetch();
      if (!plan) { go.disabled = false; return; }
      const sent = new Set(plan.ok.map((r) => r.id));
      const dropped = ytBulk.sendIds.filter((id) => !sent.has(id));
      if (dropped.length) {
        ytBulk.edits = new Map();
        ytBulk.confirmed = true;
        ytBulkDraw(plan);
        note.textContent = `${dropped.length} clip${dropped.length === 1 ? " was" : "s were"} refused by the check (marked ✕). `
          + (plan.ok.length ? `Press Upload ${plan.ok.length} to send the rest.` : "Nothing is left to send.");
        return;
      }
      ytBulk.ids = plan.ok.map((r) => r.id);
    }
    if (now) {
      // The last word before anything goes public: a strong confirmation (focus starts on Cancel).
      const known = new Map((ytBulk.plan?.ok || []).map((r) => [r.id, r.finalTitle || r.title]));
      const titles = ytBulk.ids.map((id) => known.get(id) || id);
      const list = document.createElement("ul");
      list.className = "bulk-plan-list";
      for (const t of titles.slice(0, 12)) { const li = document.createElement("li"); li.textContent = t; list.append(li); }
      if (titles.length > 12) { const li = document.createElement("li"); li.textContent = `…and ${titles.length - 12} more`; list.append(li); }
      const go2 = await confirmDialog({
        title: `Publish ${ytBulk.ids.length} video${ytBulk.ids.length === 1 ? "" : "s"} now?`,
        message: `These ${ytBulk.ids.length} video${ytBulk.ids.length === 1 ? "" : "s"} go PUBLIC on YouTube right away, one after another, as soon as each finishes uploading. This cannot be undone from klipian.`,
        body: list, confirmText: "Publish now", tone: "caution",
      });
      if (!go2) { note.textContent = "Nothing was sent."; go.disabled = false; return; }
    }
    const j = await (await fetch("/api/youtube/bulk-start", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: ytBulk.ids, mode: ytBulk.publishMode }),
    })).json();
    if (j.error) { note.textContent = j.error; ytShowDetail("#ytBulkDetail", j.detail, j.report); go.disabled = false; return; }
    ytShowDetail("#ytBulkDetail", "", "");
    ytBulk.jobId = j.id;
    go.hidden = true; ytBulkMode("running"); note.textContent = "Uploading one clip after another. You can close this window; it goes on.";
    ytBulkWatch();
  } catch (err) { note.textContent = `Could not start: ${err.message}`; go.disabled = false; }
});

$("#ytBulkCancel")?.addEventListener("click", async () => {
  if (ytBulk.mode !== "running") { $("#ytBulkDialog").close(); return; }   // Cancel / Close: nothing is sent
  if (!ytBulk.jobId) return;
  await fetch("/api/youtube/bulk-cancel", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: ytBulk.jobId }) });
  $("#ytBulkNote").textContent = "Stopping after the file being sent…";
});

$("#ytBulkClose")?.addEventListener("click", () => $("#ytBulkDialog").close());

/* From the dialog: a refused clip's Detail, and the profile settings at the YouTube section. */
$("#ytBulkDialog")?.addEventListener("click", (e) => {
  const d = e.target.closest("[data-ytdetail]");
  if (d) { $("#ytBulkDialog").close(); openDetail(d.dataset.ytdetail, d.dataset.focus || ""); return; }
  if (e.target.closest("#ytBulkSettings")) { $("#ytBulkDialog").close(); window.openProfileSettings?.({ section: "ytBox" }); }
});

$("#bulkYouTube")?.addEventListener("click", () => {
  const ids = [...SELECTED];
  if (ids.length) openYtBulk(ids, `${ids.length} selected clip${ids.length === 1 ? "" : "s"}`);
});

$("#clipScheduleReady")?.addEventListener("click", () => {
  const ids = CLIPS.filter((c) => c.status === "Ready").map((c) => c.id);
  if (ids.length) openYtBulk(ids, `all ${ids.length} Ready clip${ids.length === 1 ? "" : "s"}`);
});

/* ---------- upload to YouTube (P16): one row, from the Detail dialog ---------- */

let ytUploading = null;                 // { jobId, rowId } while an upload runs

function ytMsg(text, detail = "", report = "") {
  const el = $("#ytUploadMsg");
  if (el) el.textContent = text || "";
  ytShowDetail("#ytUploadDetail", detail, report);
}

/* What the section offers for this row: Upload (when it can be), Check status (when it
   has a videoId), and why not otherwise. */
async function refreshYouTubeSection(c) {
  const btn = $("#ytUploadBtn"), check = $("#ytCheckBtn"), cancel = $("#ytCancelBtn"), bar = $("#ytProgress");
  if (!btn) return;
  bar.hidden = true; cancel.hidden = true; ytMsg("");
  if (c.ytWarning) ytMsg(`YouTube: ${c.ytWarningText || c.ytWarning}`);
  btn.disabled = false; btn.dataset.row = c.id;
  const running = ytUploading && ytUploading.rowId === c.id;
  check.hidden = !c.videoId;
  $("#ytUploadState").textContent = c.videoId ? `uploaded · ${c.videoId}` : "";
  if (c.videoId) { btn.disabled = true; btn.title = "Already uploaded"; return; }
  if (running) { btn.disabled = true; cancel.hidden = false; bar.hidden = false; return; }
  if (!c.file || c.fileMissing) { btn.disabled = true; ytMsg("There is no render file for this clip (file deleted)."); return; }
  try {
    const j = await (await fetch("/api/youtube/status")).json();
    if (j.state !== "ok") {
      btn.disabled = true;
      ytMsg(j.state === "none" || j.state === "no_client"
        ? "This profile is not connected to YouTube: open the profile settings (the chip at the top) and connect it."
        : (j.message || `YouTube: ${j.state}. Open the profile settings.`));
    }
  } catch { btn.disabled = true; ytMsg("Cannot reach the klipian server."); }
}

async function ytSaveFirst(id) {
  // The upload reads the SAVED row, so what is in the dialog is saved first.
  await saveDetail(id, detailValues());
}

async function ytPoll(jobId, rowId) {
  const bar = $("#ytProgress"), cancel = $("#ytCancelBtn"), btn = $("#ytUploadBtn");
  for (;;) {
    await new Promise((r) => setTimeout(r, 800));
    let s;
    try { s = await (await fetch(`/api/youtube/upload-state?id=${encodeURIComponent(jobId)}`)).json(); }
    catch { continue; }
    if (clipDialog.dataset.id === rowId && bar) { bar.hidden = false; bar.value = s.progress || 0; }
    if (s.state === "uploading") continue;
    ytUploading = null;
    await loadClips();
    const c = CLIPS.find((x) => x.id === rowId);
    if (s.state === "done") {
      notifyDone({ key: `ytup:${jobId}`, title: "Upload finished", body: `${c?.title || "clip"}${s.warning ? " — see the note" : ""}`, ms: 10000 });
      if (clipDialog.open && clipDialog.dataset.id === rowId) {
        await refreshYouTubeSection(c);
        ytMsg(`${s.status}: ${s.url}${s.warning ? " — " + s.warning : ""}`);
      }
      else if (s.warning) clipNotice(`${c?.title || "Clip"}: ${s.warning}`);
    } else {
      if (clipDialog.open && clipDialog.dataset.id === rowId) {
        cancel.hidden = true; bar.hidden = true; btn.disabled = false;
        ytMsg(s.state === "cancelled" ? "Upload cancelled. Nothing was published." : (s.message || "The upload failed."), s.detail, s.report);
      }
      if (s.state === "failed") {
        notifyDone({ key: `ytup:${jobId}`, kind: "failure", title: "Upload failed", body: `${c?.title || "Clip"}: ${s.message || "the upload failed."}`,
          ms: 20000, detail: s.detail ? { text: s.detail, report: s.report } : null });
      }
    }
    return;
  }
}

$("#ytUploadBtn")?.addEventListener("click", async (e) => {
  const btn = e.currentTarget;
  const id = clipDialog.dataset.id;
  const v = detailValues();                      // what the dialog shows now, saved first by ytSaveFirst
  const when = v.date && v.time ? `${v.date} ${v.time}` : "";
  const publishNow = !when;
  // Publishing at once cannot be taken back from klipian, so it asks (a dialog, with the title that will
  // be on YouTube); a scheduled upload goes with one click: its date and time are shown right above the
  // button and it can be changed or cancelled in YouTube Studio.
  if (publishNow && !(await confirmDialog({
    title: "Publish this clip now?", tone: "caution", confirmText: "Publish now",
    message: $("#ytPreviewTitle")?.value || $("#clipDetailTitle")?.dataset.title || "",
    warning: "It goes public on YouTube straight away; this cannot be undone from klipian.",
  }))) return;
  btn.disabled = true; ytMsg("Saving, then uploading…");
  try {
    await ytSaveFirst(id);
    const j = await (await fetch("/api/youtube/upload", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ row: id, publishNow }),
    })).json();
    if (j.error) { btn.disabled = false; ytMsg(j.error, j.detail, j.report); return; }
    ytUploading = { jobId: j.id, rowId: id };
    $("#ytCancelBtn").hidden = false; $("#ytProgress").hidden = false; $("#ytProgress").value = 0;
    ytMsg("Uploading… you can close this window; the upload goes on.");
    ytPoll(j.id, id);
  } catch (err) { btn.disabled = false; ytMsg(`Could not start: ${err.message}`); }
});

$("#ytCancelBtn")?.addEventListener("click", async () => {
  if (!ytUploading) return;
  await fetch("/api/youtube/upload-cancel", { method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: ytUploading.jobId }) });
  ytMsg("Cancelling after the current piece…");
});

$("#ytCheckBtn")?.addEventListener("click", async () => {
  const id = clipDialog.dataset.id;
  ytMsg("Asking YouTube…");
  try {
    const j = await (await fetch("/api/youtube/video-status", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ row: id }),
    })).json();
    ytMsg(j.error || j.text, j.detail, j.report);
    if (!j.error) { await loadClips(); }
  } catch (err) { ytMsg(`Could not check: ${err.message}`); }
});

function detailNote(text, bad = false) {
  const el = $("#clipDetailNote");
  if (!el) return;
  el.textContent = text || "";
  el.hidden = !text;
  el.classList.toggle("text-danger", bad);
}

/* A link that is not a link to a post is refused, and the dialog stays open. Only a
   link that was changed is checked, so an old value never blocks a save. */
clipDetailForm?.addEventListener("submit", (e) => {
  if (e.submitter?.value !== "save") return;
  const existing = CLIPS.find((c) => c.id === clipDialog.dataset.id);
  for (const [field, rule] of Object.entries(LINK_RULES)) {
    const el = $(`[data-field="${field}"]`, clipDetailForm);
    const url = (el?.value || "").trim();
    if (url && url !== (existing?.[field] || "").trim() && !rule.ok.test(url)) {
      e.preventDefault();
      detailNote(`That is not a ${rule.platform} link to a post (${rule.example}).`, true);
      el.focus();
      return;
    }
  }
  detailNote("");
  const values = detailValues();
  // Saved from HERE, with a copy of what is in the form now. The dialog's `close`
  // event is no place for it: it arrives later, as its own task (late, or not at
  // all while the page is hidden), by which time the dialog may be open for another
  // row. Esc and Close never reach this handler, so they never save.
  saveDetail(clipDialog.dataset.id, values);
});

async function saveDetail(id, values) {
  const existing = CLIPS.find((c) => c.id === id);
  if (!existing) return;
  const clip = { ...existing, ...values };
  const notes = applyLinkToClip(clip, existing);
  const saved = await saveClip(clip);
  if (saved) drawClips();                          // the table shows what Detail changed (date, time ...)
  if (saved && notes.length) clipNotice(`${clip.title || "Clip"}: ${notes.join(" · ")}`);
}

/* ---------- the automatic status check of Scheduled rows (youtube.refresh_due) ---------- */

const YT_REFRESH_MS = 10 * 60 * 1000;
let ytRefreshBusy = false, ytRefreshLast = 0;

/* Ask the server to look at the Scheduled rows whose time has passed. It answers quietly when the
   profile is not connected, is offline, has nothing due or was checked a moment ago; only a change
   (Posted, a new warning) redraws the table and shows a notice. */
async function ytRefreshDue() {
  if (IS_GUEST || ytRefreshBusy) return;
  ytRefreshBusy = true;
  ytRefreshLast = Date.now();
  try {
    const j = await (await fetch("/api/youtube/refresh-due", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: "{}",
    })).json();
    if (!j.ok) return;
    const posted = j.posted || [], warnings = j.warnings || [];
    if (!posted.length && !warnings.length) return;
    await loadClips();
    if (posted.length) showToast(`${posted.length} clip${posted.length === 1 ? " is" : "s are"} now Posted on YouTube.`);
    for (const w of warnings) {
      const title = CLIPS.find((c) => c.id === w.id)?.title || "A clip";
      showToast(`${title}: ${w.message}`, { ms: 12000 });
    }
  } catch { /* offline or the server is busy: the next check tries again */ }
  finally { ytRefreshBusy = false; }
}

// While the page is visible: every 10 minutes; and once when it comes back after being hidden longer.
setInterval(() => { if (document.visibilityState === "visible") ytRefreshDue(); }, YT_REFRESH_MS);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && Date.now() - ytRefreshLast > YT_REFRESH_MS) ytRefreshDue();
});

// The Guest has no schedule (the server refuses it, and the panel is not shown).
if (!IS_GUEST) loadClips().then(ytRefreshDue);
