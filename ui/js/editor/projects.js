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
let saveError = "";             // last write failure, "" once a write succeeds
let activeProject = null;       // name of the video currently being worked on
/* The open project's own id (server.py: _new_project_id). null for a
   project that hasn't been saved yet -- its first save returns one. This,
   not the video, is what the URL, the stored session, rename and delete
   address: a project names its video, the video doesn't name the project. */
let activeProjectId = null;
const PROJECT_ID_RE = /^[0-9a-f]{6,32}$/;
let lastScreen = "clips";        // the screen where work was left off

/* Screen names from project files are NOT trusted blindly: files can be
   hand-edited or come from an older version. An unrecognized name causes
   toScreen() to turn off all screens and leave an empty workspace. */
const VALID_SCREENS = ["assets", "timeline", "analysis", "clips", "framing", "captions", "render", "history", "output"];

/* Old projects (saved before this rename) still have screen: "klip"/"teks"
   on disk -- read once here so they still resume on the right screen,
   instead of falling back to the "clips" default. New saves always write
   the English name (see projectState() below); this map only exists to
   translate what's already on disk. */
const LEGACY_SCREEN_NAMES = { klip: "clips", teks: "captions", settings: "output" };

/* One project can now store MORE THAN ONE Result -- the same podcast video
   naturally produces many separate clips, and previously starting clip #2
   silently overwrote the range/framing/corrections of clip #1.
   RESULT/FRAMING/CORRECTIONS/#resultTitle (result.js/framing.js/captions.js) STILL
   represent the "live state" of the active Result -- completely unchanged
   in those files. The only new addition is the persistence layer here:
   SAVED_RESULTS holds each Result as a snapshot
   { id, title, result, framing, corrections, output }, activeResultId
   points to the live one. See snapshotActiveResult()/
   loadResultIntoLiveState() below for the bridge between the two. */
let SAVED_RESULTS = [];
let activeResultId = null;
let resultTabSeq = 0;

/* Two-step delete for the Result "x" button -- see disarmResultDelete()
   below for what this is and why. Declared up HERE rather than next to that
   function because resetProjectState() calls renderResultSwitcher() during
   load, which disarms; a `let` declared further down would still be in its
   temporal dead zone at that moment and throw. */
let resultDeleteArmed = null;   // the button currently showing "Delete?"
let resultDeleteTimer = null;

/* The full state worth resuming later. Deliberately does NOT store the
   transcript: it already exists in cache/ and can be tens of thousands of words. */
function projectState() {
  // Copy the active Result to SAVED_RESULTS NOW, not just relying on the
  // switch-point snapshots (switchResult/deleteResultTab) -- otherwise, edits
  // made AFTER the last switch but BEFORE the saveProject() timer fires (900ms)
  // would never be copied into the slot.
  snapshotActiveResult();
  return {
    // null until the first save answers with one -- the server then finds
    // the project by its first video instead. Name/createdAt are NOT sent:
    // the server keeps those, and only /api/project/rename changes the name.
    id: activeProjectId,
    // The project's videos (assets.js). No separate `video` any more: the
    // first video asset is what that field used to say. A project with no
    // asset list yet (nothing dropped) falls back to the one file it has.
    assets: (typeof ASSETS !== "undefined" && ASSETS.length) ? ASSETS
      : (activeProject ? [{ id: "a1", kind: "video", file: activeProject }] : undefined),
    activeAsset: (typeof activeAssetId !== "undefined") ? activeAssetId : undefined,
    // Only once an id has been handed out beyond the list -- a project
    // that never removed an asset doesn't need it.
    assetSeq: (typeof assetSeq !== "undefined" && typeof ASSETS !== "undefined"
      && assetSeq > Math.max(0, ...ASSETS.map((a) => assetNum(a.id)))) ? assetSeq : undefined,
    results: SAVED_RESULTS,
    activeResult: activeResultId,
    // AI recommendations (imported JSON from Claude) were NEVER saved before
    // this -- reopening the same project always showed "none yet" even after
    // a previous import, forcing a redundant re-import from scratch.
    // Every video's, each tagged with the video it was found in: only the
    // active video's are in DATA.candidates at any moment.
    candidates: allCandidates(),
    caption: (typeof captionState === "function") ? captionState() : {},
    // No project-level `output` any more -- each Result carries its own
    // (see snapshotActiveResult). Projects written before this still have
    // one, and applyProject() reads it to seed Results that lack theirs.
    screen: (typeof activeScreen !== "undefined") ? activeScreen : "clips",
  };
}

/* Every video's AI suggestions, each tagged with its video. The active
   video's are the live DATA.candidates; the others wait in
   ASSET_CANDIDATES (assets.js) until their video is opened again. */
function allCandidates() {
  const live = (typeof DATA !== "undefined" ? DATA.candidates : []) || [];
  if (typeof ASSET_CANDIDATES === "undefined") return live;
  const tag = (list, id) => list.map((c) => (c.asset === id ? c : { ...c, asset: id }));
  const out = tag(live, activeAssetId);
  for (const [id, list] of Object.entries(ASSET_CANDIDATES)) {
    if (id !== activeAssetId) out.push(...tag(list || [], id));
  }
  return out;
}

/* An indicator that is ALWAYS visible, independent of the browser's built-in
   reload dialog -- that one only appears if the page has been interacted with
   (Chrome/Firefox anti-abuse policy, not something code can work around),
   so it cannot be relied on alone. This label is checked at any time, not
   only when closing the page. */
function updateSaveStatus() {
  const el = $("#statusSimpan");
  if (!el) return;
  // Three states, not two: saved, waiting to save, and FAILED to save.
  // The last one used to be invisible -- it looked exactly like "saved".
  if (saveError) {
    el.textContent = `Not saved — ${saveError}`;
    el.classList.add("save-failed");
  } else {
    el.textContent = savePending ? "Unsaved changes…" : "";
    el.classList.remove("save-failed");
  }
}

/* Actually writes to disk NOW, cancelling any pending delay. Used by both the
   timer below and the manual Save button -- both must write the SAME state,
   so only one code path actually performs the fetch. */
/* The in-flight FIRST save of a new project. That save is what creates the
   project on the server, so a second save starting before its answer came
   back would create a second project for the same work -- it waits for
   this one instead, and then saves under the id it got. */
let creatingProject = null;

async function writeProjectNow() {
  clearTimeout(saveTimer);
  saveTimer = null;
  if (!activeProject) return;
  if (!activeProjectId && creatingProject) await creatingProject;
  if (!activeProjectId) {
    const run = writeProjectOnce(true);
    creatingProject = run;
    try { return await run; } finally { if (creatingProject === run) creatingProject = null; }
  }
  return writeProjectOnce(false);
}

async function writeProjectOnce(isNew) {
  savePending = true;
  updateSaveStatus();
  // savePending is cleared ONLY on a confirmed write. It used to be cleared
  // in a `finally`, so a failed save flipped the indicator to blank and
  // disarmed the close-page warning -- the exact opposite of what this file
  // exists to do. Note fetch() does NOT reject on 4xx/5xx, so `r.ok` has to
  // be checked explicitly: a disk-full or file-locked error on the server
  // comes back as a response, not as a thrown error.
  // Which project this write is FOR. A new video can be dropped while the
  // request is in flight; its answer must not hand the old project's id
  // to the new one.
  const sentFor = activeProject;
  try {
    const r = await fetch("/api/project", {
      method: "POST", headers: { "Content-Type": "application/json" },
      // `new`: a project without an id is a NEW project -- never matched to
      // an existing one by its video. Two projects can use the same episode
      // now, and matching used to be how a dropped file resumed its old
      // project, which would overwrite that project with this empty one.
      body: JSON.stringify({ ...projectState(), ...(isNew ? { new: true } : {}) }),
    });
    if (!r.ok) throw new Error(`server replied ${r.status}`);
    const reply = await r.json().catch(() => ({}));
    // First save of a new project: the server just minted its id. Only
    // now can the address bar and the stored session point at it.
    if (reply.id && !activeProjectId && activeProject === sentFor) {
      activeProjectId = reply.id;
      rememberActiveSession();
    }
    saveError = "";
    savePending = false;
  } catch (err) {
    // Work continues either way -- it just isn't on disk, and now the label
    // says so instead of pretending otherwise.
    saveError = err && err.message ? err.message : "no connection";
  }
  updateSaveStatus();
  return !savePending;
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
  // Report what actually happened. This used to say "Saved" unconditionally,
  // which is the single most misleading thing a save button can do.
  const ok = await writeProjectNow();
  btn.textContent = ok ? "Saved" : "Failed";
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
  // Output Format belongs to the Result, not the project (ian). It used to
  // sit beside `results` as one setting every Result rendered with -- so
  // giving one clip a different resolution changed them all.
  slot.output = (typeof OPTIONS !== "undefined") ? OPTIONS.map((o) => o.active) : [];
  // Live spans and points sit on the shared virtual timeline (assets.js);
  // on disk they're what they really are -- a video and a second in it.
  // `segments`: the plan's name for a Result's spans (each a segment of
  // some asset, in play order). Written as `result` until the rename; the
  // server migrates that on read, and loadResultIntoLiveState reads both.
  delete slot.result;
  slot.segments = (typeof RESULT !== "undefined" ? RESULT : []).map((r) => {
    const a = toReal(r.start);
    return { id: r.id, asset: a.id, start: a.t, end: unshift(r.end, assetOffset(a.id)),
      title: r.title, source: r.source,
      // Per-clip volume (Timeline screen); absent means 100%.
      ...(r.volume !== undefined ? { volume: r.volume } : {}) };
  });
  // Timeline elements, in output seconds. Absent when there are none, so a
  // Result that never used the Timeline saves exactly as it always did.
  if (typeof OVERLAYS !== "undefined" && OVERLAYS.length) slot.overlays = OVERLAYS.map((e) => ({ ...e }));
  else delete slot.overlays;
  slot.framing = (typeof FRAMING !== "undefined" ? FRAMING : []).map((f) => ({
    id: f.id, asset: assetIdAt(f.at), at: toReal(f.at).t,
    format: f.format, crops: f.crops,
    // OPTIONAL tracking (head tracking) -- a list of {t,left} if this point
    // is being tracked; otherwise the field is deliberately OMITTED entirely
    // (not `tracking: undefined`) so that old project files (from before this
    // feature existed) remain structurally identical when opened and then
    // re-saved with no tracked points.
    ...(f.tracking ? { tracking: f.tracking } : {}),
    // OPTIONAL auto, same omit-when-false reasoning as `tracking` above.
    // Marks the placeholder point that setClip() (player.js) may relocate to
    // the clip start. Without saving it, the flag was lost on every reload
    // and the first thumbnail went back to showing 00:00 of the SOURCE
    // instead of the clip's real first frame.
    ...(f.auto ? { auto: true } : {}),
  }));
  slot.corrections = (typeof CORRECTIONS !== "undefined" ? { ...CORRECTIONS } : {});
}

/* Inverse of snapshotActiveResult(): load one SAVED_RESULTS entry into the
   live state. Used both when opening a project for the first time and when
   switching Results -- always FULL overwrite (not "if not empty" like the old
   loadProject() did), so that old Results never leak into the newly selected
   one. */
function loadResultIntoLiveState(entry) {
  // Stored as (asset, real second) -- see snapshotActiveResult(); placed back
  // on the virtual timeline here. A span or point with no asset predates
  // them, and belongs to the first video. Copies, not the stored objects:
  // shifting in place would corrupt SAVED_RESULTS for the next snapshot.
  const onTimeline = (x, key) => ({ ...x, [key]: x[key] + assetOffset(x.asset || "a1") });
  if (typeof RESULT !== "undefined") {
    const stored = Array.isArray(entry.segments) ? entry.segments
      : Array.isArray(entry.result) ? entry.result : null;
    RESULT = stored
      ? stored.map((r) => {
          const off = assetOffset(r.asset || "a1");
          const { asset, ...rest } = r;
          return { ...rest, start: r.start + off, end: r.end + off };
        })
      : [];
    // NOT re-sorted: the order on disk is the order they play in, which
    // the Timeline screen lets differ from source order.
    if (typeof resultSeq !== "undefined") {
      resultSeq = Math.max(0, ...RESULT.map((r) => parseInt(String(r.id).slice(1), 10) || 0));
    }
  }
  if (typeof FRAMING !== "undefined") {
    FRAMING = (Array.isArray(entry.framing) && entry.framing.length)
      ? entry.framing.map((f) => { const { asset, ...rest } = onTimeline(f, "at"); return rest; })
          .sort((a, b) => a.at - b.at)
      // `auto: true` must match resetFraming() in framing.js -- this is the
      // same untouched placeholder point, just reached via a different door.
      : [{ id: "f1", at: 0, format: "single", crops: [{ ...INITIAL_CROP }], auto: true }];
    if (typeof framingSeq !== "undefined") {
      framingSeq = Math.max(0, ...FRAMING.map((f) => parseInt(String(f.id).slice(1), 10) || 0));
    }
  }
  if (typeof CORRECTIONS !== "undefined") CORRECTIONS = entry.corrections || {};
  if (typeof setOverlays === "function") setOverlays(entry.overlays || []);
  // Bounds-checked per option, so a Result saved before an option existed
  // (or with fewer choices) just leaves that one where it is.
  if (Array.isArray(entry.output) && typeof OPTIONS !== "undefined") {
    entry.output.forEach((i, k) => {
      if (OPTIONS[k] && Number.isInteger(i) && i >= 0 && i < OPTIONS[k].choices.length) {
        OPTIONS[k].active = i;
      }
    });
    // Setting .active only changes the data; renderPrepare() is what draws
    // the chips. Without this, switching Results left the previous one's
    // choices lit while the render used this one's -- the same trap the
    // caption options had.
    if (typeof renderPrepare === "function") renderPrepare();
  }
  if ($("#resultTitle")) $("#resultTitle").value = entry.title || "";
  if (typeof renderResult === "function") renderResult();
  if (typeof renderFraming === "function") renderFraming();
  if (typeof renderCaptions === "function") renderCaptions();
}

/* Start a project from scratch: one empty Result, making it the sole and
   active one. Replaces the old resetResult()+resetFraming()+resetCaptions()
   trio -- now SAVED_RESULTS must also be reset, not just the live state. */
function resetProjectState() {
  SAVED_RESULTS = [{ id: `res${++resultTabSeq}`, title: "", segments: [], framing: [], corrections: {},
    output: (typeof OPTIONS !== "undefined") ? OPTIONS.map((o) => o.active) : [] }];
  activeResultId = SAVED_RESULTS[0].id;
  if (typeof setOverlays === "function") setOverlays([]);
  if (typeof resetResult === "function") resetResult();
  if (typeof resetFraming === "function") resetFraming();
  if (typeof resetCaptions === "function") resetCaptions();
  renderResultSwitcher();
}
// RESULT/FRAMING/CORRECTIONS already have correct defaults from their
// declarations (empty array/object, one default framing point -- see
// resetFraming() in framing.js:774 which also bootstraps itself on load).
// But SAVED_RESULTS/activeResultId do NOT -- without this call both are empty
// until the first project is opened, and projectState() would save a
// project with NO Result at all the first time a video is added.
resetProjectState();

/* "+ New Result": save what's being worked on, then start a new empty Result
   from the same video -- without a preceding snapshot, this would overwrite
   the active Result instead of adding another. */
function newResult() {
  snapshotActiveResult();
  // Inherits the Output Format on screen rather than starting at factory:
  // a second clip from the same video almost always wants the same file
  // shape as the first, and it's one click to change if it doesn't.
  const entry = { id: `res${++resultTabSeq}`, title: "", segments: [], framing: [], corrections: {},
    output: (typeof OPTIONS !== "undefined") ? OPTIONS.map((o) => o.active) : [] };
  SAVED_RESULTS.push(entry);
  activeResultId = entry.id;
  if (typeof setOverlays === "function") setOverlays([]);
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

/* The Result switcher has one instance per per-Result screen -- Clips,
   Output Format, Framing, Captions and Render -- unified via class
   .result-select/[data-result-action] (not id), so they're re-rendered and
   synchronized in one go from here. Clips is where the SOURCE of a Result
   is chosen (spans added there go into the active Result); the rest just
   need to know which Result they're editing. */
function renderResultSwitcher() {
  const options = SAVED_RESULTS.map((r, i) => `
    <option value="${r.id}" ${r.id === activeResultId ? "selected" : ""}>
      ${escapeHTML(r.title || `Result ${i + 1}`)}</option>`).join("");
  document.querySelectorAll(".result-select").forEach((sel) => { sel.innerHTML = options; });
  // Anything that re-renders the switcher (switching, creating, deleting a
  // Result) is a context change -- an armed "Delete?" left over from before
  // it would now refer to a different Result than the user was looking at.
  if (typeof disarmResultDelete === "function") disarmResultDelete();
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
/* Deleting a Result throws away its spans, every framing point and every
   caption correction, with no undo -- strictly MORE work than deleting a
   project, which has had a two-step confirmation all along. Yet this was a
   single unguarded click on a "×" sitting 4px from the "+" that CREATES a
   Result, both styled identically.

   The project card's .confirming overlay doesn't transplant onto a 22px
   inline button, so this is the same idea at button scale: the first click
   arms it ("Delete?", danger colours), the second one within 4s does it.
   Like the card version it backs off on its own, so an armed button can't
   sit there waiting to catch a later misclick.

   (State lives at the top of the file, not here: resetProjectState() runs
   renderResultSwitcher() during load, which calls disarmResultDelete()
   before this point in the file is reached -- a `let` declared here would
   still be in its temporal dead zone and throw.) */
function disarmResultDelete() {
  clearTimeout(resultDeleteTimer);
  resultDeleteTimer = null;
  if (resultDeleteArmed) {
    resultDeleteArmed.textContent = "×";
    resultDeleteArmed.classList.remove("danger");
    resultDeleteArmed.title = "Delete this Result";
  }
  resultDeleteArmed = null;
}

document.querySelectorAll('[data-result-action="delete"]').forEach((b) => {
  b.addEventListener("click", () => {
    if (resultDeleteArmed === b) {
      disarmResultDelete();
      deleteResultTab(activeResultId);
      return;
    }
    disarmResultDelete();   // only one armed at a time across the three screens
    resultDeleteArmed = b;
    b.textContent = "Delete?";
    b.classList.add("danger");
    b.title = "Click again to delete this Result — spans, framing and caption fixes are lost";
    resultDeleteTimer = setTimeout(disarmResultDelete, 4000);
  });
});

/* The saved project document, by `{ id }` (a card, the URL, the stored
   session) or by `{ video }` (a dropped file -- "same video = same
   project"). null if there is none or the server can't be reached. */
async function fetchProject(ref) {
  const q = ref.id ? `id=${encodeURIComponent(ref.id)}` : `video=${encodeURIComponent(ref.video || "")}`;
  try {
    const r = await fetch(`/api/project?${q}`);
    if (!r.ok) return null;
    const d = await r.json();
    return d && !d.error ? d : null;
  } catch { return null; }
}

/* Put a fetched project document into the live state. `preferFile`: the
   video to put on screen, rather than the one the project was last left on. */
function applyProject(d, preferFile) {
  activeProjectId = d.id || null;
  // The project's first video (`video` in a file the server hasn't
  // migrated -- it no longer writes that field).
  activeProject = projectPrimaryFile(d) || activeProject;

  // The project's videos, BEFORE any span is placed on the virtual
  // timeline below. A file from before assets has only `video`.
  if (typeof setAssets === "function") {
    const list = (Array.isArray(d.assets) && d.assets.length) ? d.assets
      : (d.video ? [{ id: "a1", kind: "video", file: d.video }] : []);
    const byFile = preferFile && list.find((a) => a.file === preferFile);
    setAssets(list, byFile ? byFile.id : d.activeAsset, d.assetSeq);
  }

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
      segments: Array.isArray(d.result) ? d.result : [],
      framing: Array.isArray(d.framing) ? d.framing : [],
      corrections: d.corrections || {},
    }];
  }
  activeResultId = SAVED_RESULTS.some((r) => r.id === d.activeResult)
    ? d.activeResult : SAVED_RESULTS[0].id;
  // resultTabSeq must exceed the highest restored id, otherwise the next
  // new Result would reuse an id that's already taken and overwrite it.
  resultTabSeq = Math.max(0, ...SAVED_RESULTS.map((r) => parseInt(String(r.id).slice(3), 10) || 0));
  // Output Format lives on each Result now. A project saved before that has
  // a single `output` beside `results` instead -- seed every Result that
  // doesn't carry its own from it, so none opens with the wrong file shape.
  // BEFORE loadResultIntoLiveState() below, which is what reads it.
  if (Array.isArray(d.output)) {
    for (const r of SAVED_RESULTS) {
      if (!Array.isArray(r.output)) r.output = d.output.slice();
    }
  }
  loadResultIntoLiveState(SAVED_RESULTS.find((r) => r.id === activeResultId));
  renderResultSwitcher();
  if (Array.isArray(d.candidates) && typeof DATA !== "undefined") {
    // Only the video on screen's suggestions are live; each other video's
    // wait until it's opened (setActiveAsset in assets.js).
    const mine = (c) => (c.asset || "a1") === activeAssetId;
    DATA.candidates = d.candidates.filter(mine);
    ASSET_CANDIDATES = {};
    for (const c of d.candidates.filter((c) => !mine(c))) {
      (ASSET_CANDIDATES[c.asset] ||= []).push(c);
    }
  }
  // readCaptionState() (app.js) does the bounds-checking and takes either
  // format: the object keyed by option id that's written now, or the
  // positional array of indices projects saved before the sliders.
  if (typeof readCaptionState === "function" && readCaptionState(d.caption)
      && typeof drawCaptionOptions === "function") {
    // Same trap the output options had: setting the values only changes the
    // DATA, and the chips and sliders on the Captions screen go on showing
    // the previous project's until something redraws them.
    drawCaptionOptions();
  }
  const savedScreen = LEGACY_SCREEN_NAMES[d.screen] || d.screen;
  lastScreen = VALID_SCREENS.includes(savedScreen) ? savedScreen : "clips";
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
    video: p.thumbVideo || p.video, t: String(p.thumbAt ?? 0),
    left: String(Math.round(c.left)), top: String(Math.round(c.top)),
    width: String(Math.round(c.width)), height: String(Math.round(c.height)),
    w: "220",
  });
  return `/api/thumb?${q}`;
}

/* Whether the home screen currently has anything to browse. Set by
   renderProjects() on every call, read by updateHomeView(). */
let homeHasProjects = false;

/* Home is a single view (project hub) now -- see the markup comment in
   index.html. This only has to pick between "recent projects" and "no
   projects yet", both driven by the same signal. renderProjects() calls
   this on every return to home, so it always reflects the CURRENT list,
   never a stale mode left over from a previous visit. */
function updateHomeView() {
  $(".recent")?.toggleAttribute("hidden", !homeHasProjects);
  $("#homeEmpty")?.toggleAttribute("hidden", homeHasProjects);
  const title = $("#homeTitle");
  const sub = $("#homeSub");
  if (title) title.textContent = homeHasProjects ? "Continue where you left off" : "Start a new clip";
  if (sub) {
    sub.textContent = homeHasProjects
      ? "Pick up an existing project, or start something new."
      : "Drop a video, set the format, then pick clips from the transcript.";
  }
}

/* "+ New Project" -- both instances (the recent-projects header and the
   empty-state placeholder share this class, see index.html). Goes
   straight into the editor, on the Assets screen: a project starts by
   adding its videos, and the first one added creates it
   (addVideoToProject, assets.js).

   Proactively clears whatever project was last open in this tab --
   without this, visiting Clips/Framing/Captions before adding a video
   would show the previous project's leftovers instead of a clean slate. */
function startNewProject() {
  if (chosenSource?.url?.startsWith("blob:")) URL.revokeObjectURL(chosenSource.url);
  chosenSource = null;
  activeProject = null;
  activeProjectId = null;
  if (typeof setAssets === "function") setAssets([], null);
  // Clearing the DATA isn't enough -- the <video> elements hold the file
  // themselves and went on showing (and playing) it. See releaseVideo().
  if (typeof releaseVideo === "function") releaseVideo();
  if (typeof DATA !== "undefined") DATA.candidates = [];
  if (typeof realTranscript !== "undefined") realTranscript = null;
  resetProjectState();
  forgetActiveSession();
  if (typeof updateTopbarFile === "function") updateTopbarFile("", NaN);
  if (typeof drawSource === "function") drawSource();
  if (typeof renderList === "function") renderList();
  if (typeof renderRecommendations === "function") renderRecommendations();
  toStage("work");
  // A project starts by adding its videos (ian: Analyze only picks from
  // the project's own videos, or takes a link).
  toScreen("assets");
}
document.querySelectorAll(".new-project-btn").forEach((b) =>
  b.addEventListener("click", startNewProject));

/* "12 Sep 2026" -- a date, not "3 days ago" like the edited time beside
   it: when a project was STARTED is a fixed fact worth reading exactly. */
function createdLabel(seconds) {
  const d = new Date((Number(seconds) || 0) * 1000);
  if (!seconds || Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
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
    // an empty section hanging on the home page. Falls through to the
    // drop-video view, same as a genuine first run.
    container.innerHTML = "";
    homeHasProjects = false;
    updateHomeView();
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

  if (!items.length) {
    // Clear the contents entirely, not just hide a section: stale cards left
    // behind would flash briefly if the section is shown again later.
    container.innerHTML = "";
    homeHasProjects = false;
    updateHomeView();
    return;
  }
  homeHasProjects = true;
  updateHomeView();

  // The marker sticks to the newest AVAILABLE project, not the first card.
  // If the newest one happens to have a missing video, the marker vanishes
  // entirely -- even though "which one was it?" is precisely the question
  // it's supposed to answer.
  const lastIdx = items.findIndex((p) => !(available && !available.has(p.video)));

  container.innerHTML = items.map((p, i) => {
    const missing = available && !available.has(p.video);
    const name = p.name || p.video;
    // div, NOT a button: the card contains Keep and Delete buttons, and a
    // button inside a button is invalid HTML -- the browser pulls it out of
    // its parent and the layout breaks.
    return `
    <div class="project-card${missing ? " missing" : ""}" data-project="${escapeHTML(p.id)}"
         data-video="${escapeHTML(p.video)}"
         role="button" tabindex="0"${missing ? ' aria-disabled="true"' : ""}>
      ${missing
        ? '<span class="project-thumb empty"></span>'
        : `<img class="project-thumb" alt="" loading="lazy" src="${coverUrl(p)}">`}
      ${i === lastIdx ? '<span class="last-opened">last opened</span>' : ""}
      <span class="project-name" title="${escapeHTML(name)}">${escapeHTML(name)}</span>
      <span class="data project-meta">${missing
        ? "video not in samples/"
        : `${p.spans} span${p.spans === 1 ? "" : "s"} · ${Math.round(p.seconds)}s · ${timeAgo(p.at)}`}</span>
      <span class="data project-created">created ${createdLabel(p.createdAt)}</span>
      <i class="rename-icon" data-rename-project="${escapeHTML(p.id)}" role="button"
         tabindex="0" aria-label="Rename project ${escapeHTML(name)}" title="Rename">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>
        </svg></i>
      <i class="delete-icon" data-delete-project="${escapeHTML(p.id)}" role="button"
         tabindex="0" aria-label="Delete project ${escapeHTML(name)}">×</i>
      <span class="confirm">
        <span class="confirm-text">Delete this project?</span>
        <span class="confirm-sub">Spans, framing and caption fixes are lost.
          Rendered files stay in out/.</span>
        <span class="confirm-actions">
          <button class="btn" data-delete-cancel type="button">Keep</button>
          <button class="btn danger" data-delete-confirm="${escapeHTML(p.id)}"
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

async function deleteProject(id) {
  try {
    await fetch("/api/project", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, delete: true }),
    });
  } catch { /* without a backend there's nothing to delete */ }
  if (activeProjectId === id) {
    activeProject = null;   // don't write it again
    activeProjectId = null;
    forgetActiveSession();  // a reload after this shouldn't try to enter the just-deleted project
  }
  renderProjects();
}

/* ---------- rename, in place on the card ----------
   The name used to BE the video's filename. Now a project has its own
   (server.py: `name`), because a project holding five episodes has no
   single filename to be called by. The render folder deliberately does
   not follow a rename -- see _project_out_dir(). */
function startRename(card) {
  const label = card.querySelector(".project-name");
  if (!label || card.querySelector(".project-rename")) return;
  cancelConfirm();
  const input = document.createElement("input");
  input.className = "project-rename";
  input.type = "text";
  input.maxLength = 80;
  input.value = label.textContent;
  input.setAttribute("aria-label", "Project name");
  label.hidden = true;
  label.after(input);
  input.focus();
  input.select();

  let done = false;
  const finish = async (save) => {
    if (done) return;
    done = true;
    const name = input.value.trim().replace(/\s+/g, " ");
    input.remove();
    label.hidden = false;
    if (!save || !name || name === label.textContent) return;
    const before = label.textContent;
    label.textContent = name;       // optimistic; put back if it fails
    label.title = name;
    try {
      const r = await fetch("/api/project/rename", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: card.dataset.project, name }),
      });
      if (!r.ok) throw new Error(String(r.status));
      label.textContent = (await r.json()).name || name;
      label.title = label.textContent;
    } catch {
      label.textContent = before;
      label.title = before;
    }
  };
  input.addEventListener("keydown", (e) => {
    // Stop here: the card's own keydown turns Enter/Space into a click that
    // would open the project, and Space must type a space.
    e.stopPropagation();
    if (e.key === "Enter") { e.preventDefault(); finish(true); }
    else if (e.key === "Escape") { e.preventDefault(); finish(false); }
  });
  input.addEventListener("blur", () => finish(true));
}

/* Same as the framing-point icon: role="button" on an <i> has to be given
   Enter/Space by hand. Covers the confirm/cancel buttons too -- those ARE
   real <button>s, so the browser already fires click for them; this only
   has to catch the icon. */
$("#projectList")?.addEventListener("keydown", (e) => {
  if (e.key !== "Enter" && e.key !== " ") return;
  const icon = e.target.closest("[data-delete-project], [data-rename-project]");
  if (!icon) return;
  e.preventDefault();
  icon.click();
});

$("#projectList")?.addEventListener("click", async (e) => {
  // Typing the new name: clicks inside the box stay inside it.
  if (e.target.closest(".project-rename")) { e.stopPropagation(); return; }
  const renameIcon = e.target.closest("[data-rename-project]");
  if (renameIcon) {
    e.stopPropagation();
    startRename(renameIcon.closest(".project-card"));
    return;
  }

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
  if (card.classList.contains("missing")) {
    const meta = card.querySelector(".project-meta");
    if (meta) meta.textContent = `move ${card.dataset.video} into workspace/samples/ to continue`;
    return;
  }
  await openProjectFromHome(card.dataset.project);
});

/* One path for "enter this project and continue editing" -- used by BOTH
   clicking a card on the home screen AND automatic restore when the page
   is reloaded (see restoreLastSession()). This logic used to live only
   inside the click listener; copying it to two places is easy to get out
   of sync if only one is changed later. */
let _openProjectGen = 0;
/* Opening a project awaits a transcript fetch, a project fetch and a video
   load, and used to show NOTHING while it did -- click a card on the home
   screen and the page just sat there. This is also the page-load restore
   path (restoreLastSession), so a cold start looked frozen too.
   The card marks itself busy; toStage("work") at the end takes the whole
   home screen away, so nothing has to clear it on the success path. */
function markProjectCardBusy(id) {
  const cards = document.querySelectorAll("[data-project]");
  for (const c of cards) {
    const isThis = c.dataset.project === id;
    c.classList.toggle("loading", isThis);
    // Clicking a second card mid-load would race the first open; the
    // generation guard below already discards the loser, but the cards
    // should not both look active either.
    c.setAttribute("aria-busy", String(isThis));
  }
}

async function openProjectFromHome(id) {
  // Fast click / race with session restore: tag the generation. If a new
  // open follows, the old one stops before overwriting the winner's
  // global state (chosenSource/realTranscript/RESULT/FRAMING).
  const gen = ++_openProjectGen;
  markProjectCardBusy(id);
  const d = await fetchProject({ id });
  if (gen !== _openProjectGen) return false;
  if (!d || !projectActiveFile(d)) { markProjectCardBusy(""); return false; }
  return enterProject(d, gen);
}

/* Everything after the project document is in hand -- shared by a card
   click and by session restore, which fetches the document itself first
   so it can check the video is still there before entering. */
/* A project's first video. */
function projectPrimaryFile(d) {
  const list = (Array.isArray(d.assets) ? d.assets : []).filter((a) => a && (a.kind || "video") === "video");
  return list[0]?.file || d.video || "";
}

/* The video a project opens on: the one it was left on, else its first. */
function projectActiveFile(d) {
  const list = (Array.isArray(d.assets) ? d.assets : []).filter((a) => a && (a.kind || "video") === "video");
  return (list.find((a) => a.id === d.activeAsset) || list[0])?.file || d.video || "";
}

async function enterProject(d, gen) {
  const video = projectActiveFile(d);
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
  // .duration, just a name from the project record. Overwritten again
  // below once the transcript (or ffprobe) supplies the real duration.
  if (typeof updateTopbarFile === "function") updateTopbarFile(video, NaN);
  if (typeof realTranscript !== "undefined" && typeof findTranscript === "function") {
    const tr = await findTranscript(video);
    if (gen !== _openProjectGen) return false;   // superseded by another open
    realTranscript = tr;
    if (typeof updateTopbarFile === "function") {
      updateTopbarFile(video, tr?.duration);
    }
  }
  // Always an existing project on this path -- it was fetched above -- so
  // the old "no project yet, start one" branch that used to sit here is
  // gone: a project only starts when its first video is added
  // (addVideoToProject, assets.js).
  applyProject(d, video);
  // No transcript = no duration to draw the Clips timeline with.
  if (typeof ensureSourceDuration === "function") ensureSourceDuration();
  if (typeof prepareVideo === "function") prepareVideo();
  if (typeof drawSource === "function") drawSource();
  if (typeof renderRecommendations === "function") renderRecommendations();
  if (typeof drawTotalTimeline === "function") drawTotalTimeline();
  rememberActiveSession();
  toStage("work");
  toScreen(lastScreen);
  // The other videos' transcripts, for captions on spans taken from them.
  // After entering: nothing on screen waits on these.
  if (typeof loadAssetTranscripts === "function" && typeof isMultiAsset === "function" && isMultiAsset()) {
    loadAssetTranscripts().then(() => {
      if (gen !== _openProjectGen) return;
      if (typeof renderCaptions === "function") renderCaptions();
      if (typeof drawCaption === "function") drawCaption();
    });
  }
  return true;
}

/* ---------- stay on the same screen after a reload ----------
   Previously a reload ALWAYS returned to the drop-video home screen, even
   if you were in the middle of editing a clip -- the project ITSELF was
   already auto-saved, but "which project is currently open" only lived in
   the current tab's memory, lost the moment it's reloaded. localStorage
   survives a reload (unlike a normal variable), so it's enough to store a
   POINTER to which project is currently open -- its id -- not the project
   itself, which still lives in a file as before. Browsers that last ran
   the version before ids hold a video filename here instead;
   restoreLastSession() still understands that. */
const SESSION_KEY = "klipian:sesi-aktif";

/* ...and in the address bar as well (ian): /edit/<project id>.

   The address used to carry <stem>.<fingerprint>, the project file's name
   when files were keyed by the video's size+mtime -- so re-encoding or
   restoring the video from a backup changed it. The id is minted once
   and stored in the project, so it doesn't. Links in the old shape still
   open: the server remembers which project each old file became
   (`legacyFile`, see _resolve_project_id), and the address is rewritten to
   the id as soon as the project opens.

   replaceState, never pushState: this mirrors state that already changed,
   it isn't itself a navigation. Pushing would stack an entry every time a
   project opens (session restore included) and make Back walk back through
   projects without actually reopening them -- the page doesn't re-run on
   popstate. */
function writeProjectUrl(id) {
  const url = id ? `/edit/${encodeURIComponent(id)}` : "/";
  if (location.pathname !== url) history.replaceState(null, "", url);
}

/* The project id in the current URL, if any. */
function urlProjectId() {
  const m = location.pathname.match(/^\/edit\/(.+)$/);
  if (!m) return "";
  try { return decodeURIComponent(m[1]); } catch { return ""; }
}

/* A project that hasn't been saved yet has no id -- nothing to point at.
   writeProjectNow() calls this again once its first save returns one. */
function rememberActiveSession() {
  if (!activeProjectId) return;
  try { localStorage.setItem(SESSION_KEY, activeProjectId); } catch { /* private/full -- skip */ }
  writeProjectUrl(activeProjectId);
}

function forgetActiveSession() {
  try { localStorage.removeItem(SESSION_KEY); } catch { /* same */ }
  writeProjectUrl(null);
}

/* Called once when the page loads: enters the project named by the URL,
   or failing that the one this browser had open last. Returns true if it
   succeeded -- the caller does NOT need to fall back to toStage("home")
   then.

   The URL wins over the stored session: an explicit address is a stronger
   statement of intent than "what this browser had open last time". */
async function restoreLastSession() {
  let stored = "";
  try { stored = localStorage.getItem(SESSION_KEY) || ""; } catch { /* blocked */ }
  const urlId = urlProjectId();
  const ref = urlId ? { id: urlId }
    : PROJECT_ID_RE.test(stored) ? { id: stored }
    : stored ? { video: stored }        // pointer written before ids
    : null;
  if (!ref) return false;

  // Opening failed. A dead /edit/ link goes to Home with the address
  // cleared -- NOT to whatever this browser had open last: silently
  // substituting another project, and then rewriting the address to claim
  // it was the one asked for, gives no sign the link was dead. And it must
  // not throw away the stored session either, which points at a
  // different, possibly still-valid project.
  const giveUp = () => {
    if (urlId) writeProjectUrl(null);
    else forgetActiveSession();
    return false;
  };

  const gen = ++_openProjectGen;
  let d;
  try {
    const q = ref.id ? `id=${encodeURIComponent(ref.id)}` : `video=${encodeURIComponent(ref.video)}`;
    const r = await fetch(`/api/project?${q}`);
    if (r.status === 404) return giveUp();
    if (!r.ok) return false;
    d = await r.json();
  } catch {
    return false;   // server not ready yet/offline -- don't pretend it succeeded
  }
  if (gen !== _openProjectGen) return false;   // a card was clicked meanwhile
  if (!d || !projectActiveFile(d)) return giveUp();

  // The video may have been moved/deleted since it was last opened --
  // checked first via /api/video, instead of trying directly and failing
  // silently partway through loading.
  try {
    const available = (await (await fetch("/api/video")).json()).video || [];
    if (!available.includes(projectActiveFile(d))) return giveUp();
  } catch {
    return false;
  }
  if (gen !== _openProjectGen) return false;
  return enterProject(d, gen);
}

/* The card is no longer a <button>, so Enter and Space aren't free anymore.
   Without this the card could be focused but never activated from the
   keyboard at all. */
$("#projectList")?.addEventListener("keydown", (e) => {
  if (e.key !== "Enter" && e.key !== " ") return;
  // Only for the card ITSELF. A key on anything inside it -- the rename box,
  // the rename/delete icons (handled by the listener above), Keep/Delete
  // buttons -- used to fall through to here as well and click the card
  // right after, which cancelled the delete confirmation it had just opened.
  if (e.target.closest?.(".project-rename, [data-delete-project], [data-rename-project], button")) return;
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
