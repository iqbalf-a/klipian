/* klipian — round-trip via Claude web
   ==========================================================================
   Flow:

     1  drop video on the Prepare screen
     2  the server builds a file containing rubric + transcript      -> Download
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

/* The server builds it (rubric, audio and timing cues, transcript). */
async function buildBrief(name) {
  const res = await fetch(`/api/brief?video=${encodeURIComponent(name)}`);
  if (!res.ok) {
    const d = await res.json().catch(() => ({}));
    throw new Error(d.error || "Could not build the file for Claude.");
  }
  return res.text();
}

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
  const panel = $("#exportPanel"), button = $("#downloadBrief"), note = $("#exportNote");
  note.textContent = "searching for transcript ...";
  const previous = realTranscript;
  realTranscript = await findTranscript(videoName);
  if (typeof loadCues === "function") loadCues(videoName);

  if (!realTranscript) {
    panel.dataset.ready = "false";
    button.disabled = true;
    note.textContent = "No transcript yet. Click Find clips to make one.";
    return;
  }
  panel.dataset.ready = "true";
  if (typeof drawCueChips === "function") drawCueChips();
  button.disabled = false;
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
      + (have ? ` (replaced ${have})` : "");
    if (typeof renderRecommendations === "function") renderRecommendations();
    if (typeof saveProject === "function") saveProject();
    toScreen("clips");          // recommendations are not the final destination, result is
  } catch (err) {
    note.dataset.error = "true";
    note.textContent = err.message;
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
