/* klipian — project: save unfinished work
   ==========================================================================
   Before this, klipian saved NOTHING. Reload the page -- or close the browser
   accidentally -- and all Results, framing points, and caption corrections
   vanish. Only the transcript in cache/ and already-rendered MP4s survived.

   Now the state is saved as one JSON per video in the projects/ folder,
   not in localStorage: it survives browser cache clears, follows you when
   you switch browsers, and can be viewed or backed up as plain files --
   just like cache/ and out/.

   One video = one project. Drop the same video again and the work returns.

   Saving is AUTOMATIC and slightly delayed. Saving on every framing box
   adjustment would mean dozens of writes per second; waiting for a "save"
   button means people lose work precisely because they forgot to press it.
   ========================================================================== */

const SAVE_DELAY = 900;         // ms to wait before actually writing to disk
let saveTimer = null;
let savePending = false;        // true from first change until the disk write completes
let activeProject = null;       // name of the video currently being worked on
let lastScreen = "clips";        // the screen where work was left off

/* Screen names from project files are NOT trusted blindly: files can be
   hand-edited or come from an older version. An unrecognized name causes
   toScreen() to turn off all screens and leave an empty workspace. */
const VALID_SCREENS = ["analysis", "clips", "framing", "captions", "history"];

/* Old projects (saved before this rename) still have screen: "klip"/"teks"
   on disk -- read once here so they still resume on the right screen,
   instead of falling back to the "clips" default. New saves always write
   the English name (see projectState() below); this map only exists to
   translate what's already on disk. */
const LEGACY_SCREEN_NAMES = { klip: "clips", teks: "captions" };

/* One project can now store MORE THAN ONE Result -- the same podcast video
   naturally produces many separate clips, and previously starting clip #2
   silently overwrote the range/framing/corrections of clip #1.
   RESULT/FRAMING/CORRECTIONS/#resultTitle (result.js/framing.js/captions.js) STILL
   represent the "live state" of the active Result -- completely unchanged
   in those files. The only new addition is the persistence layer here:
   SAVED_RESULTS holds each Result as a snapshot
   { id, title, result, framing, corrections }, activeResultId points to
   the live one. See snapshotActiveResult()/loadResultIntoLiveState()
   below for the bridge between the two. */
let SAVED_RESULTS = [];
let activeResultId = null;
let resultTabSeq = 0;

/* The full state worth resuming later. Deliberately does NOT store the
   transcript: it already exists in cache/ and can be tens of thousands of words. */
function projectState() {
  // Copy the active Result to SAVED_RESULTS NOW, not just relying on the
  // switch-point snapshots (switchResult/deleteResultTab) -- otherwise, edits
  // made AFTER the last switch but BEFORE the saveProject() timer fires (900ms)
  // would never be copied into the slot.
  snapshotActiveResult();
  return {
    video: activeProject,
    results: SAVED_RESULTS,
    activeResult: activeResultId,
    // AI recommendations (imported JSON from Claude) were NEVER saved before
    // this -- reopening the same project always showed "none yet" even after
    // a previous import, forcing a redundant re-import from scratch.
    candidates: (typeof DATA !== "undefined" ? DATA.candidates : []) || [],
    caption: (typeof CAPTION_OPTIONS !== "undefined")
      ? CAPTION_OPTIONS.map((o) => o.active) : [],
    output: (typeof OPTIONS !== "undefined") ? OPTIONS.map((o) => o.active) : [],
    screen: (typeof activeScreen !== "undefined") ? activeScreen : "clips",
  };
}

/* An indicator that is ALWAYS visible, independent of the browser's built-in
   reload dialog -- that one only appears if the page has been interacted with
   (Chrome/Firefox anti-abuse policy, not something code can work around),
   so it cannot be relied on alone. This label is checked at any time, not
   only when closing the page. */
function updateSaveStatus() {
  const el = $("#statusSimpan");
  if (!el) return;
  el.textContent = savePending ? "Unsaved changes…" : "";
}

/* Actually writes to disk NOW, cancelling any pending delay. Used by both the
   timer below and the manual Save button -- both must write the SAME state,
   so only one code path actually performs the fetch. */
async function writeProjectNow() {
  clearTimeout(saveTimer);
  saveTimer = null;
  if (!activeProject) return;
  savePending = true;
  updateSaveStatus();
  try {
    await fetch("/api/project", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(projectState()),
    });
  } catch { /* no backend available, work continues -- just not persisted */
  } finally {
    savePending = false;
    updateSaveStatus();
  }
}

/* Called from anywhere that modifies the work. Safe to call repeatedly:
   only the last call within one quiet period actually writes.
   savePending is set NOW (not when the timer finally fires) --
   that's what the "close/reload page" warning below reads so that
   changes still waiting for the delay are not mistaken for safely saved. */
function saveProject() {
  if (!activeProject) return;
  savePending = true;
  updateSaveStatus();
  clearTimeout(saveTimer);
  saveTimer = setTimeout(writeProjectNow, SAVE_DELAY);
}

/* Manual Save button: not strictly necessary (auto-save already runs on every
   change), but provided as an extra safety net for those who want the visual
   confirmation of "saved" before closing the page. */
$("#saveNowBtn")?.addEventListener("click", async () => {
  const btn = $("#saveNowBtn");
  if (!btn || btn.disabled) return;
  btn.disabled = true;
  btn.textContent = "Saving…";
  await writeProjectNow();
  btn.textContent = "Saved";
  setTimeout(() => { btn.textContent = "Save"; btn.disabled = false; }, 1200);
});

/* Closing the tab, reloading, or navigating away before the 900ms delay
   finishes means the latest change may not have been written yet. Browsers
   no longer allow custom messages in this dialog (for security) -- only
   the built-in warning shows, but that's enough as an "alert". */
window.addEventListener("beforeunload", (e) => {
  if (!savePending) return;
  e.preventDefault();
  e.returnValue = "";
});

/* ---------- Result: store-more-than-one per project ---------- */

/* Copy the LIVE state (RESULT/FRAMING/CORRECTIONS/title) into the active
   Result slot in SAVED_RESULTS. Called BEFORE the live state is overwritten
   by another Result (switch/delete) and at the start of projectState() --
   two layers of protection so the order of pending saveProject() timers
   does not matter. */
function snapshotActiveResult() {
  if (!activeResultId) return;
  const slot = SAVED_RESULTS.find((r) => r.id === activeResultId);
  if (!slot) return;
  slot.title = (typeof $ === "function" && $("#resultTitle")?.value.trim()) || "";
  slot.result = (typeof RESULT !== "undefined" ? RESULT : []).map((r) => ({
    id: r.id, start: r.start, end: r.end, title: r.title, source: r.source,
  }));
  slot.framing = (typeof FRAMING !== "undefined" ? FRAMING : []).map((f) => ({
    id: f.id, at: f.at, format: f.format, crops: f.crops,
    // OPTIONAL tracking (head tracking) -- a list of {t,left} if this point
    // is being tracked; otherwise the field is deliberately OMITTED entirely
    // (not `tracking: undefined`) so that old project files (from before this
    // feature existed) remain structurally identical when opened and then
    // re-saved with no tracked points.
    ...(f.tracking ? { tracking: f.tracking } : {}),
  }));
  slot.corrections = (typeof CORRECTIONS !== "undefined" ? { ...CORRECTIONS } : {});
}

/* Inverse of snapshotActiveResult(): load one SAVED_RESULTS entry into the
   live state. Used both when opening a project for the first time and when
   switching Results -- always FULL overwrite (not "if not empty" like the old
   loadProject() did), so that old Results never leak into the newly selected
   one. */
function loadResultIntoLiveState(entry) {
  if (typeof RESULT !== "undefined") {
    RESULT = Array.isArray(entry.result) ? entry.result : [];
    if (typeof resultSeq !== "undefined") {
      resultSeq = Math.max(0, ...RESULT.map((r) => parseInt(String(r.id).slice(1), 10) || 0));
    }
  }
  if (typeof FRAMING !== "undefined") {
    FRAMING = (Array.isArray(entry.framing) && entry.framing.length)
      ? entry.framing
      : [{ id: "f1", at: 0, format: "single", crops: [{ ...INITIAL_CROP }] }];
    if (typeof framingSeq !== "undefined") {
      framingSeq = Math.max(0, ...FRAMING.map((f) => parseInt(String(f.id).slice(1), 10) || 0));
    }
  }
  if (typeof CORRECTIONS !== "undefined") CORRECTIONS = entry.corrections || {};
  if ($("#resultTitle")) $("#resultTitle").value = entry.title || "";
  if (typeof renderResult === "function") renderResult();
  if (typeof renderFraming === "function") renderFraming();
  if (typeof renderCaptions === "function") renderCaptions();
}

/* Start a project from scratch: one empty Result, making it the sole and
   active one. Replaces the old resetResult()+resetFraming()+resetCaptions()
   trio -- now SAVED_RESULTS must also be reset, not just the live state. */
function resetProjectState() {
  SAVED_RESULTS = [{ id: `res${++resultTabSeq}`, title: "", result: [], framing: [], corrections: {} }];
  activeResultId = SAVED_RESULTS[0].id;
  if (typeof resetResult === "function") resetResult();
  if (typeof resetFraming === "function") resetFraming();
  if (typeof resetCaptions === "function") resetCaptions();
  renderResultSwitcher();
}
// RESULT/FRAMING/CORRECTIONS already have correct defaults from their
// declarations (empty array/object, one default framing point -- see
// resetFraming() in framing.js:774 which also bootstraps itself on load).
// But SAVED_RESULTS/activeResultId do NOT -- without this call both are empty
// until the first project is opened, and loadProject()/projectState() will
// save a project with NO Result at all the first time a video is dropped
// (acceptFile() only calls resetProjectState() when the video CHANGES from
// the previous one, not when it's the very first video opened).
resetProjectState();

/* "+ New Result": save what's being worked on, then start a new empty Result
   from the same video -- without a preceding snapshot, this would overwrite
   the active Result instead of adding another. */
function newResult() {
  snapshotActiveResult();
  const entry = { id: `res${++resultTabSeq}`, title: "", result: [], framing: [], corrections: {} };
  SAVED_RESULTS.push(entry);
  activeResultId = entry.id;
  if (typeof resetResult === "function") resetResult();
  if (typeof resetFraming === "function") resetFraming();
  if (typeof resetCaptions === "function") resetCaptions();
  if ($("#resultTitle")) $("#resultTitle").value = "";
  renderResultSwitcher();
  saveProject();
}

function switchResult(id) {
  if (id === activeResultId) return;
  const target = SAVED_RESULTS.find((r) => r.id === id);
  if (!target) return;
  snapshotActiveResult();
  activeResultId = id;
  loadResultIntoLiveState(target);
  renderResultSwitcher();
  saveProject();
}

/* Always keep at least one Result -- a project without any Result is
   meaningless (there is nothing for RESULT/FRAMING/CORRECTIONS to refer to),
   just like the 00:00 point in FRAMING which cannot be deleted for the same
   reason. */
function deleteResultTab(id) {
  if (SAVED_RESULTS.length <= 1) return;
  const i = SAVED_RESULTS.findIndex((r) => r.id === id);
  if (i < 0) return;
  if (id === activeResultId) {
    const neighbor = SAVED_RESULTS[i - 1] || SAVED_RESULTS[i + 1];
    switchResult(neighbor.id);   // already snapshots + loads + saveProject()
  }
  SAVED_RESULTS = SAVED_RESULTS.filter((r) => r.id !== id);
  renderResultSwitcher();
  saveProject();
}

/* The Result switcher has THREE identical instances -- the Clips, Framing,
   and Captions screens, unified via class .result-select/[data-result-action]
   (not id), so all three are re-rendered and synchronized in one go from
   here. Clips is actually where the SOURCE of a Result is chosen (spans
   added there go into the active Result) -- not just Editing (Framing/Captions)
   that needs to know which Result is active. */
function renderResultSwitcher() {
  const options = SAVED_RESULTS.map((r, i) => `
    <option value="${r.id}" ${r.id === activeResultId ? "selected" : ""}>
      ${escapeHTML(r.title || `Result ${i + 1}`)}</option>`).join("");
  document.querySelectorAll(".result-select").forEach((sel) => { sel.innerHTML = options; });
  document.querySelectorAll('[data-result-action="delete"]').forEach((b) => {
    b.disabled = SAVED_RESULTS.length <= 1;
  });
}

document.querySelectorAll(".result-select").forEach((sel) => {
  sel.addEventListener("change", () => switchResult(sel.value));
});
document.querySelectorAll('[data-result-action="new"]').forEach((b) => {
  b.addEventListener("click", () => newResult());
});
document.querySelectorAll('[data-result-action="delete"]').forEach((b) => {
  b.addEventListener("click", () => deleteResultTab(activeResultId));
});

/* Restore a previously saved state. Returns true if something was restored,
   so the caller can notify the user. */
async function loadProject(video) {
  activeProject = video;
  let d;
  try {
    const r = await fetch(`/api/project?video=${encodeURIComponent(video)}`);
    if (!r.ok) return false;
    d = await r.json();
  } catch { return false; }
  if (!d || d.error) return false;

  if (Array.isArray(d.results) && d.results.length) {
    SAVED_RESULTS = d.results;
  } else {
    // Old format (before the save-more-than-one-Result feature): a flat
    // result/framing/corrections/title at the top level -- wrap it into a
    // SINGLE implicit entry. The file is NOT rewritten now; the new format
    // will be written on the next auto-save.
    SAVED_RESULTS = [{
      id: "res1",
      title: d.title || "",
      result: Array.isArray(d.result) ? d.result : [],
      framing: Array.isArray(d.framing) ? d.framing : [],
      corrections: d.corrections || {},
    }];
  }
  activeResultId = SAVED_RESULTS.some((r) => r.id === d.activeResult)
    ? d.activeResult : SAVED_RESULTS[0].id;
  // resultTabSeq must exceed the highest restored id, otherwise the next
  // new Result would reuse an id that's already taken and overwrite it.
  resultTabSeq = Math.max(0, ...SAVED_RESULTS.map((r) => parseInt(String(r.id).slice(3), 10) || 0));
  loadResultIntoLiveState(SAVED_RESULTS.find((r) => r.id === activeResultId));
  renderResultSwitcher();
  if (Array.isArray(d.candidates) && typeof DATA !== "undefined") {
    DATA.candidates = d.candidates;
    DATA.marks = d.candidates.map((k) => ({
      pos: (typeof realTranscript !== "undefined" && realTranscript?.duration)
        ? (k.startSec / realTranscript.duration) * 100 : 0,
      scores: k.total,
      // title may be absent in hand-edited/old-version JSON -- don't .split() null.
      label: (k.title || "").split(" ").slice(0, 3).join(" "),
    }));
  }
  // Active index must be bounds-checked: project files can be hand-edited or
  // from an older version with a different number of choices. An out-of-bounds
  // index would make choices[active] undefined and break caption rendering.
  if (Array.isArray(d.caption) && typeof CAPTION_OPTIONS !== "undefined") {
    d.caption.forEach((i, k) => {
      if (CAPTION_OPTIONS[k] && Number.isInteger(i)
          && i >= 0 && i < CAPTION_OPTIONS[k].choices.length) {
        CAPTION_OPTIONS[k].active = i;
      }
    });
  }
  if (Array.isArray(d.output) && typeof OPTIONS !== "undefined") {
    d.output.forEach((i, k) => {
      if (OPTIONS[k] && Number.isInteger(i)
          && i >= 0 && i < OPTIONS[k].choices.length) {
        OPTIONS[k].active = i;
      }
    });
  }
  const savedScreen = LEGACY_SCREEN_NAMES[d.screen] || d.screen;
  lastScreen = VALID_SCREENS.includes(savedScreen) ? savedScreen : "clips";
  return true;
}

/* New video dropped: if it has a project, continue it; otherwise, start from
   scratch using that name as the key. */
async function openProject(video) {
  const hadExisting = await loadProject(video);
  if (!hadExisting) {
    // New project: nothing to restore, so use the last-used caption/watermark
    // style (see applyPresetCaption() in app.js) instead of factory defaults.
    // The caption panel was already drawn with defaults BEFORE this point
    // (see acceptFile() in interactions.js), so it must be redrawn here too --
    // otherwise the highlighted button on screen doesn't match the style that's
    // actually applied.
    if (typeof applyPresetCaption === "function" && applyPresetCaption()) {
      if (typeof renderList === "function") renderList();
      if (typeof applyCaption === "function") applyCaption();
    }
    saveProject();          // catat sebagai project baru
  }
  if (typeof rememberActiveSession === "function") rememberActiveSession(video);
  return hadExisting;
}

/* ---------- home page listing ---------- */

/* Watch the naming: `w` is the COVER OUTPUT width, while `width` is the
   CROP width as a percentage of the source frame. Swap them once and ffmpeg
   refuses a 220% crop -- the cover fails without a single error on screen. */
function coverUrl(p) {
  const DEFAULT_CROP = { left: 37, top: 4, width: 26, height: 92 };
  let c = p.crop || DEFAULT_CROP;
  // Framing box height is scaled down when READ (matchRatio), so the stored
  // value can be zero or nonsensical. ffmpeg still obeys it and produces a
  // cover 2 pixels tall -- a completely silent failure.
  const valid = Number.isFinite(c.width) && c.width > 1
           && Number.isFinite(c.height) && c.height > 1
           && c.left >= 0 && c.top >= 0
           && c.left + c.width <= 101 && c.top + c.height <= 101;
  if (!valid) c = DEFAULT_CROP;
  const q = new URLSearchParams({
    video: p.video, t: String(p.thumbAt ?? 0),
    left: String(Math.round(c.left)), top: String(Math.round(c.top)),
    width: String(Math.round(c.width)), height: String(Math.round(c.height)),
    w: "220",
  });
  return `/api/thumb?${q}`;
}

let _renderProjectsInflight = null;
async function renderProjects() {
  // Called from two places during initial load (self-invoke below + the
  // toStage("home") hook in app.js). Without this guard both would fetch
  // /api/projects and write #projectList at the same time. A single in-flight
  // call is shared with the next caller, not repeated.
  if (_renderProjectsInflight) return _renderProjectsInflight;
  _renderProjectsInflight = (async () => {
  const container = $("#projectList");
  if (!container) return;
  let items = [];
  try {
    const d = await (await fetch("/api/projects")).json();
    items = d.project || [];
  } catch {
    // Without a backend there are no projects at all -- hide it, don't leave
    // an empty section hanging on the home page.
    container.innerHTML = "";
    container.closest(".recent")?.setAttribute("hidden", "");
    return;
  }
  // Videos unreachable by the server cannot be truly continued: transcription,
  // thumbnails, and rendering all go through _find_video(), which only looks
  // in samples/, the project root, and out/. Marked on the card rather than
  // allowed to fail silently after being clicked.
  let available = null;
  try {
    available = new Set((await (await fetch("/api/video")).json()).video || []);
  } catch { available = null; }

  const section = container.closest(".recent");
  if (!items.length) {
    // Clear the contents entirely, not just hide a section: stale cards left
    // behind would flash briefly if the section is shown again later.
    container.innerHTML = "";
    section?.setAttribute("hidden", "");
    return;
  }
  section?.removeAttribute("hidden");

  // The marker sticks to the newest AVAILABLE project, not the first card.
  // If the newest one happens to have a missing video, the marker vanishes
  // entirely -- even though "which one was it?" is precisely the question
  // it's supposed to answer.
  const lastIdx = items.findIndex((p) => !(available && !available.has(p.video)));

  container.innerHTML = items.map((p, i) => {
    const missing = available && !available.has(p.video);
    // div, NOT a button: the card contains Keep and Delete buttons, and a
    // button inside a button is invalid HTML -- the browser pulls it out of
    // its parent and the layout breaks.
    return `
    <div class="project-card${missing ? " missing" : ""}" data-project="${escapeHTML(p.video)}"
         role="button" tabindex="0"${missing ? ' aria-disabled="true"' : ""}>
      ${missing
        ? '<span class="project-thumb empty"></span>'
        : `<img class="project-thumb" alt="" loading="lazy" src="${coverUrl(p)}">`}
      ${i === lastIdx ? '<span class="last-opened">last opened</span>' : ""}
      <span class="project-name">${escapeHTML(p.title || p.video)}</span>
      <span class="data project-meta">${missing
        ? "video not in samples/"
        : `${p.spans} span${p.spans === 1 ? "" : "s"} · ${Math.round(p.seconds)}s · ${timeAgo(p.at)}`}</span>
      <i class="delete-icon" data-delete-project="${escapeHTML(p.video)}" role="button"
         aria-label="Delete project ${escapeHTML(p.video)}">×</i>
      <span class="confirm">
        <span class="confirm-text">Delete this project?</span>
        <span class="confirm-sub">Spans, framing and caption fixes are lost.
          Rendered files stay in out/.</span>
        <span class="confirm-actions">
          <button class="btn" data-delete-cancel type="button">Keep</button>
          <button class="btn danger" data-delete-confirm="${escapeHTML(p.video)}"
                  type="button">Delete</button>
        </span>
      </span>
    </div>`;
  }).join("");
  })();
  try { return await _renderProjectsInflight; }
  finally { _renderProjectsInflight = null; }
}

/* ---------- delete, with confirmation ----------
   This card holds work that cannot be recreated: the selected ranges,
   framing points, and every corrected word. One click straight to gone
   is the easiest way to lose all of that from a misclick.

   Confirmation is two buttons inside the card itself, not the browser's
   built-in confirm(): the built-in one blocks the whole page and can't
   say WHAT is being lost. It backs off on its own after a few seconds of
   no action, so the card doesn't stay stuck waiting.

   What's deleted is ONLY the project file. The MP4 in out/ and the
   transcript in cache/ are not touched -- that's stated in the message so
   nobody thinks the output files vanish too. */

let confirmTimer = null;

function cancelConfirm() {
  clearTimeout(confirmTimer);
  document.querySelectorAll(".project-card.confirming")
    .forEach((k) => k.classList.remove("confirming"));
}

async function deleteProject(video) {
  try {
    await fetch("/api/project", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ video, delete: true }),
    });
  } catch { /* without a backend there's nothing to delete */ }
  if (activeProject === video) {
    activeProject = null;   // don't write it again
    forgetActiveSession();  // a reload after this shouldn't try to enter the just-deleted project
  }
  renderProjects();
}

$("#projectList")?.addEventListener("click", async (e) => {
  // --- ask for confirmation ---
  const deleteIcon = e.target.closest("[data-delete-project]");
  if (deleteIcon) {
    e.stopPropagation();
    const card = deleteIcon.closest(".project-card");
    cancelConfirm();
    card.classList.add("confirming");
    // Auto-dismiss: a card left in the "confirming" state would be
    // accidentally clicked long after the intent has passed.
    confirmTimer = setTimeout(cancelConfirm, 6000);
    return;
  }

  const confirmBtn = e.target.closest("[data-delete-confirm]");
  if (confirmBtn) {
    e.stopPropagation();
    cancelConfirm();
    await deleteProject(confirmBtn.dataset.deleteConfirm);
    return;
  }

  if (e.target.closest("[data-delete-cancel]")) {
    e.stopPropagation();
    cancelConfirm();
    return;
  }

  const card = e.target.closest("[data-project]");
  if (!card) return;
  // A card in "confirming" state must not also open the project:
  // clicking around to cancel would jump into the editor instead.
  if (card.classList.contains("confirming")) { cancelConfirm(); return; }
  const video = card.dataset.project;
  if (card.classList.contains("missing")) {
    const meta = card.querySelector(".project-meta");
    if (meta) meta.textContent = `move ${video} into workspace/samples/ to continue`;
    return;
  }
  await openProjectFromHome(video);
});

/* One path for "enter this project and continue editing" -- used by BOTH
   clicking a card on the home screen AND automatic restore when the page
   is reloaded (see restoreLastSession()). This logic used to live only
   inside the click listener; copying it to two places is easy to get out
   of sync if only one is changed later. */
let _openProjectGen = 0;
async function openProjectFromHome(video) {
  // Fast click / race with session restore: tag the generation. If a new
  // open follows, the old one stops before overwriting the winner's
  // global state (chosenSource/realTranscript/RESULT/FRAMING).
  const gen = ++_openProjectGen;
  // The blob URL from the previously dropped file is never released if we
  // immediately overwrite it with a /workspace/samples/ URL -- revoke it first.
  if (typeof chosenSource !== "undefined" && chosenSource
      && typeof chosenSource.url === "string" && chosenSource.url.startsWith("blob:")) {
    URL.revokeObjectURL(chosenSource.url);
  }
  // The file is fetched from workspace/samples/, not a file dialog --
  // projects store the NAME, and browsers can't open local paths directly.
  chosenSource = { kind: "file", name: video, url: `/workspace/samples/${encodeURIComponent(video)}` };
  // Name first, shown right away -- chosenSource on this path has no
  // .duration (it's not the result of readMeta() from a <video>, just a
  // name from the project record). Overwritten again below once the
  // transcript (if any) supplies the real duration.
  if (typeof updateTopbarFile === "function") updateTopbarFile(video, NaN);
  if (typeof realTranscript !== "undefined" && typeof findTranscript === "function") {
    const tr = await findTranscript(video);
    if (gen !== _openProjectGen) return false;   // superseded by another open
    realTranscript = tr;
    if (typeof updateTopbarFile === "function") {
      updateTopbarFile(video, tr?.duration);
    }
  }
  const existed = await loadProject(video);
  if (gen !== _openProjectGen) return false;
  // This path usually only opens a project that ALREADY exists (both the
  // home card and session restore come from a project that's already on
  // record), but it's guarded the same as openProject() in case it's ever
  // called for a video that's never been opened before.
  if (!existed) {
    // New project: there's NO guarantee RESULT/FRAMING/CORRECTIONS/
    // SAVED_RESULTS/candidates are currently empty in memory -- if a
    // previous video was worked on in the same tab without a reload, its
    // contents still belong to THAT video, not this one. The drop-file
    // path (acceptFile() in interactions.js) already clears this via
    // resetProjectState(); this path (home card / session restore) hasn't,
    // and a new project arriving via this path is theoretically possible --
    // see the comment on openProjectFromHome().
    resetProjectState();
    if (typeof DATA !== "undefined") { DATA.candidates = []; DATA.marks = []; }
    if (typeof applyPresetCaption === "function" && applyPresetCaption()) {
      if (typeof renderList === "function") renderList();
      if (typeof applyCaption === "function") applyCaption();
    }
  }
  if (typeof prepareVideo === "function") prepareVideo();
  if (typeof drawSource === "function") drawSource();
  if (typeof renderRecommendations === "function") renderRecommendations();
  if (typeof drawTotalTimeline === "function") drawTotalTimeline();
  rememberActiveSession(video);
  toStage("work");
  toScreen(lastScreen);
  return existed;
}

/* ---------- stay on the same screen after a reload ----------
   Previously a reload ALWAYS returned to the drop-video home screen, even
   if you were in the middle of editing a clip -- the project ITSELF was
   already auto-saved, but "which project is currently open" only lived in
   the current tab's memory, lost the moment it's reloaded. localStorage
   survives a reload (unlike a normal variable), so it's enough to store a
   POINTER to which video is currently open -- not the project itself,
   which still lives in a file as before. */
const SESSION_KEY = "klipian:sesi-aktif";

function rememberActiveSession(video) {
  try { localStorage.setItem(SESSION_KEY, video); } catch { /* privat/penuh -- lupakan saja */ }
}

function forgetActiveSession() {
  try { localStorage.removeItem(SESSION_KEY); } catch { /* sama */ }
}

/* Called once when the page loads. Returns true if it successfully
   re-entered the last project -- the caller does NOT need to fall back to
   toStage("home") if this succeeds. */
async function restoreLastSession() {
  let video;
  try { video = localStorage.getItem(SESSION_KEY); } catch { return false; }
  if (!video) return false;

  // The video may have been moved/deleted since it was last opened --
  // checked first via /api/video, instead of trying directly and failing
  // silently partway through loading.
  try {
    const available = (await (await fetch("/api/video")).json()).video || [];
    if (!available.includes(video)) { forgetActiveSession(); return false; }
  } catch {
    return false;   // server not ready yet/offline -- don't pretend it succeeded
  }

  const existed = await openProjectFromHome(video);
  if (!existed) { forgetActiveSession(); return false; }  // video exists but its project is gone
  return true;
}

/* The card is no longer a <button>, so Enter and Space aren't free anymore.
   Without this the card could be focused but never activated from the
   keyboard at all. */
$("#projectList")?.addEventListener("keydown", (e) => {
  if (e.key !== "Enter" && e.key !== " ") return;
  const card = e.target.closest?.(".project-card");
  if (!card) return;
  e.preventDefault();
  card.click();
});

/* Kicks itself off. app.js runs toStage("home") at the end of its own
   file -- long before this file has had a chance to load -- so the hook
   there hasn't seen renderProjects() when the page first opens. A module
   that depends on load order is a module waiting to break; it handles
   its own startup. */
renderProjects();

/* Same reason: toStage("home") in app.js already ran before this file
   loaded, so "try to continue the last project" is also handled here,
   not there. Home briefly flashes first (expected -- checking /api/video
   and loading the project is an async process), then gets overwritten by
   toStage("work") once restoreLastSession() finishes, if there really is
   something to continue. */
restoreLastSession();
