/* klipian — round-trip via Claude web
   ==========================================================================
   Flow:

     1  drop video on the Prepare screen
     2  the server builds a file containing rubric + transcript      -> Copy / Download
     3  that file is dropped into Claude web, ask it to "work on it"
     4  Claude web replies with JSON
     5  JSON is pasted here, the server reads it                     -> Import
     6  app cuts according to JSON, clips appear in Candidates

   No API key in this path. The only cost is your existing Claude subscription.

   Steps 2 and 5 are klipian/roundtrip.py behind /api/brief and /api/import
   (the CLI's `brief` and `import` call the same functions); this file is
   only the screen around them. The transcript used here for the UI's own
   needs (word counts, snapping a dragged boundary) is the REAL one, read
   from workspace/cache/ -- the same file the server picks for a video.
   ========================================================================== */

let realTranscript = null;                // { duration, segments[], words[] }

/* ---------- finding a transcript that matches the dropped file ----
   The server decides which file that is (Cache.find_transcript): the one
   made with the default settings if there is one, else the newest for this
   video. The brief, the captions of a render and this page all go through
   it, so they agree. */

async function findTranscript(videoName) {
  const res = await fetch(`/api/transcript?video=${encodeURIComponent(videoName)}`);
  if (!res.ok) return null;
  const d = await res.json();
  d.words = d.segments.flatMap((s) => s.words || []);
  return d;
}

/* ---------- step 2: the file for Claude ---------- */

const fmtStamp = (d) => {
  const t = Math.round(d);
  return t < 3600
    ? `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`
    : `${Math.floor(t / 3600)}:${String(Math.floor((t % 3600) / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
};

/* Which rubric the brief carries: "" = this profile's default (Profile settings), else a rubric id chosen
   here. Remembered per profile, which is how the Guest (no profile settings) picks one. */
let briefRubric = (() => {
  try { return localStorage.getItem(`klipian:briefRubric:${PROFILE}`) || ""; } catch { return ""; }
})();

/* The server builds it (rubric, audio and timing cues, transcript). */
async function buildBrief(name) {
  const res = await fetch(`/api/brief?video=${encodeURIComponent(name)}${briefRubric ? `&mode=${encodeURIComponent(briefRubric)}` : ""}`);
  if (!res.ok) {
    const d = await res.json().catch(() => ({}));
    throw new Error(d.error || "Could not build the file for Claude.");
  }
  return res.text();
}

/* The brief, fetched as soon as the transcript is ready and kept, so a click on
   Copy can write to the clipboard at once. Some browsers refuse a clipboard
   write that comes after a long await following the click. Dropped whenever
   what it was built from may have changed: another video, a new transcript,
   the cues arriving. `briefGen` lets a slow fetch that was overtaken throw its
   answer away instead of storing it. */
let briefCache = null;                    // { name, text }
let briefGen = 0;

function invalidateBrief() {
  briefGen++;
  briefCache = null;
}

async function refreshBrief() {
  invalidateBrief();
  const gen = briefGen;
  const name = chosenSource?.name;
  if (!name || $("#exportPanel")?.dataset.ready !== "true") return;
  try {
    const text = await buildBrief(name);
    if (gen === briefGen && chosenSource?.name === name) briefCache = { name, text };
  } catch { /* the click will fetch it and say why if it still fails */ }
}

/* The rubric select above the cues: the profile's default, the built-in ones and the workspace's own. */
async function drawRubricPick() {
  const sel = $("#briefRubric"), note = $("#rubricNote");
  if (!sel) return;
  let d;
  try {
    const r = await fetch(`/api/rubrics${briefRubric ? `?mode=${encodeURIComponent(briefRubric)}` : ""}`);
    d = await r.json();
    if (!r.ok) throw new Error(d.error || "failed");
  } catch { return; }                       // no backend: the select stays empty
  const all = [...d.builtin, ...d.workspace];
  if (briefRubric && !all.some((x) => x.id === briefRubric)) briefRubric = "";   // one that was deleted
  sel.innerHTML = "";
  const opt = (value, text) => sel.append(Object.assign(document.createElement("option"), { value, textContent: text }));
  opt("", "Profile default");
  for (const x of all) opt(x.id, x.name + (x.missing?.length ? " (incomplete)" : ""));
  sel.value = briefRubric;
  note.dataset.error = "false";
  const cur = d.current || {};
  if (cur.error) { note.dataset.error = "true"; note.textContent = cur.error; }
  else {
    const used = all.find((x) => x.id === cur.id);
    note.textContent = cur.note || (used ? `The file for Claude uses: ${used.name}` : "");
    if (used) sel.options[0].textContent = `Profile default (${used.name})`;
  }
}

$("#briefRubric")?.addEventListener("change", (e) => {
  briefRubric = e.target.value;
  try { localStorage.setItem(`klipian:briefRubric:${PROFILE}`, briefRubric); } catch { /* no storage */ }
  drawRubricPick();
  refreshBrief();
});

/* ---------- step 5: reading Claude's reply ---------- */

/* Snap to nearest word boundary -- for a boundary the user drags (timeline.js,
   result.js). Importing a reply does the same on the server, with the same
   limit; if SNAP_MAX changes, change it in klipian/roundtrip.py too. A word
   boundary farther away than this means the time points at silence, not at a
   word that is only slightly off. */
const SNAP_MAX = 2.0;

function snapToWord(time, side) {
  const w = realTranscript?.words;
  if (!w?.length || !Number.isFinite(time)) return time;
  const candidate = side === "start" ? w.map((x) => x.start) : w.map((x) => x.end);
  const nearest = candidate.reduce((a, b) =>
    (Math.abs(b - time) < Math.abs(a - time) ? b : a));
  return Math.abs(nearest - time) <= SNAP_MAX ? nearest : time;
}

/* Claude's reply -> candidates, read by the server (roundtrip.parse_reply).
   Rejects with a message meant to be shown as is. */
let lastImportNotes = [];       // what the server repaired in the last reply it read (said in the note)

async function importJSON(text) {
  let res;
  try {
    res = await fetch("/api/import", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ video: chosenSource?.name || "", text }),
    });
  } catch {
    throw new Error("Reading the reply needs the backend. Run: python -m klipian serve");
  }
  const d = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(d.error || "Could not read that reply.");
  lastImportNotes = d.notes || [];
  // which import a suggestion came from: the Results made from it carry it too (bulk.js, "from this brief")
  const importId = Date.now().toString(36);
  for (const k of d.candidates) k.importId = importId;
  return d.candidates;
}

/* ---------- wiring results into the rest of the app ---------- */

function applyCandidates(candidates) {
  const d = DATA;
  d.candidates = candidates;
  // realTranscript can be null if JSON is imported before the transcript loads;
  // importJSON/snapToWord tolerate it, so don't blindly deref here either.
  // DATA.marks used to be computed here (and again in projects.js) and
  // persisted into every project file. Nothing ever read it -- the ribbon
  // it fed was removed with the candidate board.

  renderList(); renderPreview();
  // Suggestions are in the ACTIVE video's own seconds, while the preview
  // runs on the virtual timeline (assets.js) -- the same thing only for the
  // first video. For any other, leave the preview on the Result.
  if (typeof setClip === "function" && !(typeof activeAssetOffset === "function" && activeAssetOffset())) {
    setClip(candidates[0]);
  }

}


/* ---------- wiring controls ---------- */

async function prepareExport(videoName) {
  const panel = $("#exportPanel"), note = $("#exportNote");
  const buttons = [$("#copyBrief"), $("#downloadBrief"), $("#findWithClaude")];
  note.textContent = "searching for transcript ...";
  const previous = realTranscript;
  invalidateBrief();
  realTranscript = await findTranscript(videoName);
  if (typeof loadCues === "function") loadCues(videoName);

  if (!realTranscript) {
    panel.dataset.ready = "false";
    buttons.forEach((b) => { b.disabled = true; });
    note.textContent = "No transcript yet. Click Find clips to make one.";
    return;
  }
  panel.dataset.ready = "true";
  if (typeof drawCueChips === "function") drawCueChips();
  buttons.forEach((b) => { b.disabled = false; });
  refreshBrief();
  drawRubricPick();
  note.textContent =
    `${realTranscript.words.length.toLocaleString("en")} words · ${fmtStamp(realTranscript.duration)} · drop the file into Claude to find clips`;
  $("#importPanel").dataset.ready = "true";

  // If the user already added manual clips BEFORE this transcript arrived
  // (e.g. transcription was still running when "Create manual clip" was pressed),
  // the captions are empty because kataResult() has nothing to map yet -- and
  // nothing triggers a redraw once the transcript finally becomes available.
  // An explicit redraw here closes that gap.
  if (!previous && typeof RESULT !== "undefined" && RESULT.length) {
    if (typeof drawCaption === "function") drawCaption();
    if (typeof renderCaptions === "function") renderCaptions();
  }
}

// copyText() and copyViaTextarea() live in js/shared/clipboard.js (the /workspace
// dashboard copies text too).

$("#copyBrief")?.addEventListener("click", async (e) => {
  const btn = e.currentTarget, note = $("#exportNote");
  const name = chosenSource?.name || "video.mp4";
  let text = briefCache?.name === name ? briefCache.text : null;
  try {
    if (text !== null) {
      // The usual path: fetched already, so the write follows the click directly.
      if (!(await copyText(text))) throw new Error("the browser refused to copy");
    } else {
      // Not fetched yet (clicked right after the transcript appeared, or the
      // cues just changed): hand the clipboard a promise, which browsers that
      // have ClipboardItem accept for exactly this.
      const pending = buildBrief(name);
      pending.catch(() => {});            // read below; no unhandled rejection
      let wrote = false;
      if (window.ClipboardItem && navigator.clipboard?.write) {
        try {
          await navigator.clipboard.write([new ClipboardItem({
            "text/plain": pending.then((t) => new Blob([t], { type: "text/plain" })),
          })]);
          wrote = true;
        } catch { /* fall back below, unless the brief itself failed */ }
      }
      text = await pending;
      if (!wrote && !(await copyText(text))) throw new Error("the browser refused to copy");
      briefCache = { name, text };
    }
  } catch (err) {
    note.textContent = `Could not copy (${err.message}). Use Download file instead.`;
    return;
  }
  note.textContent =
    `Copied · ${(text.length / 1024).toFixed(0)} KB · ~${Math.round(text.length / 3.5).toLocaleString("en")} tokens · paste it into Claude`;
  // Restored from data-label, not the visible text: a second click while it
  // still says "Copied" would otherwise make that the permanent label.
  const label = btn.dataset.label || btn.textContent;
  btn.dataset.label = label;
  btn.textContent = "Copied";
  clearTimeout(btn._copiedTimer);
  btn._copiedTimer = setTimeout(() => { btn.textContent = label; }, 2000);
});

$("#downloadBrief")?.addEventListener("click", async () => {
  const name = chosenSource?.name || "video.mp4";
  let text;
  try {
    text = await buildBrief(name);
  } catch (err) {
    $("#exportNote").textContent = err.message;
    return;
  }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type: "text/markdown" }));
  a.download = `brief-${name.replace(/\.[^.]+$/, "")}.md`;
  a.click();
  URL.revokeObjectURL(a.href);
  $("#exportNote").textContent =
    `File downloaded · ${(text.length / 1024).toFixed(0)} KB · ~${Math.round(text.length / 3.5).toLocaleString("en")} tokens`;
});

/* ---------- Find clips with Claude (P24): the server holds the key, makes the call and imports the reply ---------- */

let claudeRun = null;           // { id, video } while a call is in flight

async function claudeApi(path, body) {
  let res;
  try {
    res = await fetch(path, body === undefined ? {} : {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  } catch {
    throw new Error("This needs the backend. Run: python -m klipian serve");
  }
  const d = await res.json().catch(() => ({}));
  if (!res.ok || d.ok === false || d.error) {
    const e = new Error(d.error || `failed (${res.status})`);
    e.code = d.code; e.command = d.command;
    throw e;
  }
  return d;
}

function claudeConfirmBody(plan) {
  const box = document.createElement("div");
  box.className = "claude-plan";
  const row = (k, v) => {
    const r = document.createElement("div");
    r.className = "claude-plan-row";
    const a = document.createElement("span"); a.textContent = k;
    const b = document.createElement("b"); b.textContent = v;
    r.append(a, b);
    box.append(r);
  };
  row("Model", plan.model + (plan.modelHow ? ` (${plan.modelHow})` : ""));
  row("Effort", plan.effort);
  const rubricName = $("#briefRubric")?.selectedOptions?.[0]?.textContent;
  if (rubricName) row("Rubric", rubricName.replace(/^Profile default \((.*)\)$/, "$1"));
  row("Input", `${plan.inputTokens.toLocaleString("en")} tokens`);
  row("Clips asked for", `about ${plan.count}`);
  row("Estimated cost", plan.cost
    ? `$${plan.cost.low.toFixed(2)} – $${plan.cost.high.toFixed(2)}${plan.cost.assumed ? " (price assumed by model family)" : ""}`
    : "unknown (no price known for this model)");
  const n = document.createElement("p");
  n.className = "note";
  n.textContent = "An estimate: Claude's thinking and answer are billed as output and are not known until it is done. "
    + "The part of the file that is the same for every episode is cached, so the next one costs less.";
  box.append(n);
  return box;
}

function claudeProblem(note, err) {
  note.dataset.error = "true";
  note.textContent = err.command ? `${err.message} Run: ${err.command}` : err.message;
  if (err.code === "no_key" || err.code === "auth") {
    const b = document.createElement("button");
    b.type = "button"; b.className = "btn quiet"; b.textContent = "Open Profile settings";
    b.addEventListener("click", () => window.openProfileSettings?.({ section: "claudeBox" }));
    note.append(" ", b);
  }
}

$("#findWithClaude")?.addEventListener("click", async () => {
  const btn = $("#findWithClaude"), note = $("#exportNote");
  const name = chosenSource?.name || "";
  if (claudeRun) {
    btn.disabled = true;
    try { await claudeApi("/api/claude/cancel", { id: claudeRun.id }); } catch { /* the poll shows the result */ }
    return;
  }
  note.dataset.error = "false";
  let plan;
  btn.disabled = true;
  try {
    note.textContent = "Counting tokens…";
    const st = await claudeApi("/api/claude/status");
    if (!st.sdk) throw Object.assign(new Error("The Anthropic package is not installed."), { command: st.command });
    if (!st.hasKey) throw Object.assign(new Error("No API key yet."), { code: "no_key" });
    plan = await claudeApi("/api/claude/plan", { video: name, count: 12, rubric: briefRubric });
  } catch (err) {
    claudeProblem(note, err);
    btn.disabled = false;
    return;
  }
  btn.disabled = false;
  const have = (DATA?.candidates || []).length;
  const ok = await confirmDialog({
    title: "Find clips with Claude",
    body: claudeConfirmBody(plan),
    warning: have ? `This replaces the ${have} suggestion${have === 1 ? "" : "s"} now on the Clips screen (Undo import brings them back).` : "",
    confirmText: "Send to Claude", tone: "primary",
  });
  if (!ok) { note.textContent = ""; return; }
  let job;
  try {
    job = await claudeApi("/api/claude/find", { video: name, count: plan.count, rubric: briefRubric });
  } catch (err) { claudeProblem(note, err); return; }
  claudeRun = { id: job.id, video: name };
  btn.textContent = "Cancel";
  const label = { sending: "Sending the episode to Claude…", thinking: "Claude is thinking…", writing: "Claude is writing the list…",
                  importing: "Importing the clips…", preparing: "Getting ready…" };
  let s = {};
  for (;;) {
    await new Promise((r) => setTimeout(r, 1000));
    try { s = await claudeApi(`/api/claude/job?id=${encodeURIComponent(job.id)}`); } catch { s = { state: "failed", message: "Lost contact with the server." }; }
    if (s.state === "missing") s = { state: "failed", message: "The job was lost (the server restarted?)." };
    if (s.state !== "running") break;
    note.textContent = label[s.step] || s.message || "Working…";
  }
  claudeRun = null;
  btn.textContent = "Find clips with Claude";
  btn.disabled = false;
  if (s.state === "cancelled") { note.textContent = s.message; return; }
  if (s.state !== "done") {
    claudeProblem(note, { message: s.message || "Claude could not find clips.", code: s.code, command: s.command });
    if (s.reply) {
      $("#pasteJSON").value = s.reply;           // kept so it can be fixed by hand and imported
      $("#importBtn").disabled = false;
      note.append(" The reply is in the box below.");
    }
    return;
  }
  const candidates = s.candidates || [];
  const importId = Date.now().toString(36);
  for (const k of candidates) k.importId = importId;
  replacedSuggestions = have ? { video: name, list: DATA.candidates } : null;
  lastImportNotes = s.notes || [];
  applyCandidates(candidates);
  const u = s.usage || {};
  DATA.claudeUsage = [...(DATA.claudeUsage || []), { at: Date.now(), model: s.model, input: u.input, output: u.output,
    cacheRead: u.cacheRead, cacheWrite: u.cacheWrite, cost: u.cost, seconds: u.seconds }];
  note.dataset.error = "false";
  note.textContent = `${candidates.length} suggestion${candidates.length === 1 ? "" : "s"} from ${s.model} (${s.how})`
    + (u.cost != null ? ` · about $${u.cost.toFixed(2)}` : "")
    + (u.cacheRead ? ` · ${u.cacheRead.toLocaleString("en")} tokens read from cache` : "")
    + (lastImportNotes.length ? `. Fixed in the reply: ${lastImportNotes.join("; ")}.` : "");
  if (typeof renderRecommendations === "function") renderRecommendations();
  if (typeof saveProject === "function") saveProject();
  toScreen("clips");
});

$("#pasteJSON")?.addEventListener("input", (e) => {
  $("#importBtn").disabled = !e.target.value.trim();
  disarmImport();
  // The button sits below a tall box; after pasting, bring it into view.
  if (e.target.value.trim()) $("#importBtn").scrollIntoView({ block: "nearest" });
  $("#importNote").dataset.error = "false";
  $("#importNote").textContent = "";
});

/* Importing a reply REPLACES the suggestions that are there. Two clicks when
   there are any (the first says how many go), and the set that was replaced is
   kept so "Undo import" on the Clips screen can give it back once. */
let importArmTimer = null;
let replacedSuggestions = null;       // { video, list } -- what the last import replaced

function disarmImport() {
  clearTimeout(importArmTimer);
  const btn = $("#importBtn");
  if (btn) { btn.textContent = "Cut into clips"; btn.classList.remove("danger"); }
}

$("#importBtn")?.addEventListener("click", async () => {
  const note = $("#importNote");
  const btn = $("#importBtn");
  const have = (DATA?.candidates || []).length;
  if (have && !btn.classList.contains("danger")) {
    btn.textContent = `Replace ${have} suggestion${have === 1 ? "" : "s"}?`;
    btn.classList.add("danger");
    importArmTimer = setTimeout(disarmImport, 4000);
    return;
  }
  disarmImport();
  try {
    const candidates = await importJSON($("#pasteJSON").value);
    replacedSuggestions = have ? { video: chosenSource?.name || "", list: DATA.candidates } : null;
    applyCandidates(candidates);
    note.dataset.error = "false";
    note.textContent = `${candidates.length} suggestion${candidates.length === 1 ? "" : "s"} imported`
      + (have ? ` (replaced ${have})` : "")
      + (lastImportNotes.length ? `. Fixed in the reply: ${lastImportNotes.join("; ")}.` : "");
    if (typeof renderRecommendations === "function") renderRecommendations();
    if (typeof saveProject === "function") saveProject();
    toScreen("clips");          // recommendations are not the final destination, result is
  } catch (err) {
    note.dataset.error = "true";
    note.textContent = err.message;
    note.style.whiteSpace = "pre-wrap";       // the message shows the line and a caret under the spot
  }
});

$("#recUndo")?.addEventListener("click", () => {
  if (!replacedSuggestions || replacedSuggestions.video !== (chosenSource?.name || "")) return;
  const { list } = replacedSuggestions;
  replacedSuggestions = null;
  applyCandidates(list);
  if (typeof renderRecommendations === "function") renderRecommendations();
  if (typeof saveProject === "function") saveProject();
});

/* .json files can be dropped directly onto the paste box */
$("#pasteJSON")?.addEventListener("drop", async (e) => {
  const f = e.dataTransfer?.files?.[0];
  if (!f) return;
  e.preventDefault();
  e.stopPropagation();
  $("#pasteJSON").value = await f.text();
  $("#importBtn").disabled = false;
  $("#importBtn").scrollIntoView({ block: "nearest" });
});
