/* klipian — real interactions
   ==========================================================================
   app.js renders the UI. This file makes the controls actually work,
   so what gets tested is the FLOW, not the pictures.

   Reframe has its own file (reframe.js) because its logic is the heaviest.
   Loaded after app.js; uses its global bindings.
   ========================================================================== */

/* ───────────────── source: drag file, pick file, YouTube link ─────────── */

const YT_PATTERN = /(?:youtube\.com\/(?:watch\?v=|shorts\/|live\/|embed\/)|youtu\.be\/)([\w-]{11})/;
let chosenSource = null;

const fileInput = Object.assign(document.createElement("input"), {
  type: "file", accept: "video/*,.mkv", hidden: true,
});
document.body.appendChild(fileInput);

const fmtSize = (b) => {
  const mb = b / 1048576;
  return mb >= 1024 ? `${(mb / 1024).toFixed(2)} GB` : `${Math.round(mb)} MB`;
};

const fmtDuration = (d) => {
  if (!isFinite(d)) return "duration unreadable";
  const t = Math.round(d);
  const h = Math.floor(t / 3600);
  const m = String(Math.floor((t % 3600) / 60)).padStart(2, "0");
  const s = String(t % 60).padStart(2, "0");
  return h ? `${h}:${m}:${s}` : `${m}:${s}`;
};

/* File name & duration in the topbar (#fileName/#fileDuration) -- SINGLE place,
   called from both video "becomes active" paths: acceptFile() here
   (new video dropped) and openProjectFromHome() in projects.js
   (old project re-opened via home card / session restore). Before this
   both were ONLY filled by startAnalysis() (analysis.js), which ONLY
   ran via the "Find clips" button on the home page -- opening an old
   project never triggered it, so the topbar kept showing the sample
   placeholder from app.js (radityadika-podcast.mp4, 42:03)
   FOREVER, not just momentarily, until a NEW video was dropped. */
function updateTopbarFile(name, durationSeconds) {
  if ($("#fileName")) $("#fileName").textContent = name || "";
  if ($("#fileDuration")) {
    $("#fileDuration").textContent = Number.isFinite(durationSeconds) ? fmtDuration(durationSeconds) : "";
  }
}

/* Duration and resolution are read from the actual file via the <video> element. */
function readMeta(file) {
  return new Promise((end) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () =>
      end({ duration: v.duration, width: v.videoWidth, height: v.videoHeight, url });
    v.onerror = () => end({ duration: NaN, width: 0, height: 0, url });
    v.src = url;
  });
}

async function acceptFile(file) {
  if (!file) return;
  if (!/^video\//.test(file.type) && !/\.(mkv|mov|mp4|webm)$/i.test(file.name)) {
    drawSource("That file is not a video. Use mp4, mkv, mov, or webm.");
    return;
  }
  // Revoke the previous blob URL to prevent memory leaks
  if (chosenSource && chosenSource.url && chosenSource.url.startsWith("blob:")) {
    URL.revokeObjectURL(chosenSource.url);
  }
  const meta = await readMeta(file);
  const changed = chosenSource && chosenSource.name !== file.name;
  chosenSource = { kind: "file", name: file.name, size: file.size, ...meta };
  updateTopbarFile(chosenSource.name, chosenSource.duration);
  $("#urlInput").value = "";
  drawSource();

  // New video = different person in frame, so clear the person list and
  // start over from "Person 1". resetProjectState() (projects.js) also
  // clears SAVED_RESULTS so a single new Result is created -- previous
  // video's Results must not carry over to this one.
  if (changed && typeof resetProjectState === "function") resetProjectState();

  // New video = fresh session. Without this, candidates and ribbon from the
  // previous file would carry over and clash on screen.
  if (changed || DATA.candidates.length) {
    DATA.candidates = [];
    DATA.marks = [];
    DATA.words = [];
    if (typeof realTranscript !== "undefined") realTranscript = null;
    renderList();
    if (typeof renderRecommendations === "function") renderRecommendations();
  }
  if (typeof prepareVideo === "function") {
    prepareVideo();
    setClip(DATA.candidates[0]);
  }

  // Files from outside workspace/samples/ only get a blob: URL -- preview works,
  // but transcription, thumbnails, and rendering all go through _find_video()
  // on the server and will return "video not found". Warn NOW, not after
  // waiting for a transcription that was never going to succeed.
  try {
    const available = (await (await fetch("/api/video")).json()).video || [];
    if (!available.includes(file.name)) {
      drawSource(null, "not in workspace/samples/ — move it there to transcribe and render");
      document.querySelector(".source-drop")?.setAttribute("data-state", "warn");
    }
  } catch { /* no backend -- nothing to check */ }

  // Same video = same project. If it was worked on before, Result,
  // framing points, and text corrections come back; if not, this becomes
  // the new project.
  if (typeof openProject === "function") {
    const resumed = await openProject(file.name);
    if (resumed) {
      if (typeof renderResult === "function") renderResult();
      if (typeof renderFraming === "function") renderFraming();
      if (typeof renderCaptions === "function") renderCaptions();
      if (typeof renderRecommendations === "function") renderRecommendations();
      if (typeof drawTotalTimeline === "function") drawTotalTimeline();
      drawSource(null, "picked up where you left off");
    }
  }
}

function acceptURL(text) {
  const matched = text.match(YT_PATTERN);
  if (matched) {
    chosenSource = { kind: "youtube", name: `youtu.be/${matched[1]}`, id: matched[1] };
    drawSource();
  } else {
    chosenSource = null;
    drawSource(text.trim() ? "That link is not a YouTube address we recognise." : null);
  }
}

function drawSource(error, extraNote) {
  const box = document.querySelector(".source-drop");
  const button = $("#run");
  if (!box || !button) return;

  // Format & Resolution mean nothing before a video is loaded, and as a full
  // panel it pushes the project list off-screen on short windows -- exactly
  // when that list is needed most.
  const hasSource = !!chosenSource && !error;
  $("#options")?.toggleAttribute("hidden", !hasSource);
  $("#prepareFoot")?.toggleAttribute("hidden", !hasSource);
  const title = box.querySelector("h2");
  const note = box.querySelector("p");

  if (error) {
    box.dataset.state = "error";
    title.textContent = "Can't use this";
    note.textContent = error;
    button.disabled = true;
  } else if (!chosenSource) {
    box.dataset.state = "";
    title.textContent = "Drag a video here";
    note.textContent = "mp4, mkv, mov — or";
    button.disabled = true;
  } else {
    const s = chosenSource;
    box.dataset.state = "ready";
    title.textContent = s.name;
    // Old project opened via home card / session restore: chosenSource on
    // that path is only {kind,name,url} -- NO real size/duration/width
    // (not the readMeta() result from <video>, just the name from the
    // project record). Previously all three were forced to display (fmtSize/
    // fmtDuration called on undefined, producing "NaN MB · unreadable
    // duration") -- now the parts that are genuinely unknown are skipped
    // rather than displayed broken. Duration can still be recovered from
    // a transcript that was already made for this video, if one exists.
    let details;
    if (s.kind === "file") {
      const parts = [];
      if (Number.isFinite(s.size)) parts.push(fmtSize(s.size));
      const duration = Number.isFinite(s.duration) ? s.duration
        : (typeof realTranscript !== "undefined" ? realTranscript?.duration : undefined);
      if (Number.isFinite(duration)) parts.push(fmtDuration(duration));
      if (s.width) parts.push(`${s.width}×${s.height}`);
      details = parts.length ? parts.join(" · ") : "resuming this project";
    } else {
      details = "the video will be downloaded when the pipeline runs";
    }
    // Extra note is used when an old project is restored, so the user knows
    // their work is back and doesn't think they have to start from scratch.
    note.textContent = extraNote ? `${details} · ${extraNote}` : details;
    button.disabled = false;
  }
}

document.addEventListener("click", (e) => {
  if (e.target.closest(".source-actions .btn")) fileInput.click();
});
fileInput.addEventListener("change", () => acceptFile(fileInput.files[0]));
$("#urlInput").addEventListener("input", (e) => acceptURL(e.target.value));

/* Drag-and-drop only in the DROP PANEL, not across the whole window.
   There used to be a curtain that covered the entire screen once a file
   was dragged in. The intent was so no drop zone would be missed, but
   the result was the entire UI hidden behind a curtain for what was
   actually just one box -- and that box already had its own highlight
   state, which never got seen because the curtain was on top.

   The window-level guard is still there, but it does NOT draw anything:
   its only job is to cancel the browser's default behavior. Without it,
   a file dropped outside the panel would be OPENED by the browser -- the
   app gets abandoned along with all the un-rendered work. */

const hasFiles = (e) => [...((e.dataTransfer && e.dataTransfer.types) || [])].includes("Files");

["dragenter", "dragover", "drop"].forEach((ev) =>
  window.addEventListener(ev, (e) => { if (hasFiles(e)) e.preventDefault(); }));

const dropPanel = document.querySelector(".source-drop");
if (dropPanel) {
  // Counter, not a single flag: dragleave fires every time the pointer
  // crosses a child element inside the panel, so the highlight would flicker.
  let dragCount = 0;
  const highlight = (on) => {
    if (on) dropPanel.dataset.drag = "true";
    else delete dropPanel.dataset.drag;
  };

  dropPanel.addEventListener("dragenter", (e) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    dragCount++;
    highlight(true);
  });

  dropPanel.addEventListener("dragover", (e) => {
    if (!hasFiles(e)) return;
    e.preventDefault();                    // required, otherwise drop is ignored
    e.dataTransfer.dropEffect = "copy";
  });

  dropPanel.addEventListener("dragleave", (e) => {
    if (!hasFiles(e)) return;
    dragCount = Math.max(0, dragCount - 1);
    if (dragCount === 0) highlight(false);
  });

  dropPanel.addEventListener("drop", (e) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    e.stopPropagation();
    dragCount = 0;
    highlight(false);
    acceptFile(e.dataTransfer.files[0]);
  });
}

/* ───────────────── candidates: approve, reject, undo ──────────────────── */


/* ───────────────── ribbon: click a sweep to open its clip ─────────────── */


/* ───────────────── caption: options that update the preview live ──────── */

/* Returns the active choice OBJECT: { t, out, px?, css? }.
   Preview uses .px (small box), render uses .out. */
function captionValue(id) {
  const o = CAPTION_OPTIONS.find((x) => x.id === id);
  return o ? o.choices[o.active] : null;
}

// PlayResY in render is ALWAYS out_width*16/9 rounded to even -- 1920 for
// the default resolution (1080p, see OPTIONS in app.js). ALL pixel sizes in
// preview (caption font, outline, watermark font) are now computed
// PROPORTIONAL to this, instead of separate ".px" calibration numbers as
// before -- those fixed values only "looked right" at ONE specific window
// size / combination, and broke at others: preview looked fine but actual
// render was wrong size (ian's report, for both watermark AND caption --
// same bug, different element).
const PLAYRES_Y_DEFAULT = 1920;
const pxFromOut = (out, frameH) => (out / PLAYRES_Y_DEFAULT) * frameH;

function applyCaption() {
  const cap = document.querySelector(".cap916");
  const frame = document.querySelector(".frame916");
  if (!cap) return;

  const frameH = frame ? frame.getBoundingClientRect().height : 0;
  // If the panel is still display:none (script just loaded, not yet on the
  // work screen) or hasn't been given final size by the browser, rect is 0 --
  // safer to DO NOTHING (toScreen() in app.js re-calls applyCaption() once
  // the panel actually shows, and the ResizeObserver below catches size
  // changes after that) rather than writing near-zero sizes that get stuck
  // until some other trigger fires.
  if (frameH > 0) {
    cap.style.fontSize = `${pxFromOut(captionValue("size").out, frameH)}px`;
    const thicknessPx = pxFromOut(captionValue("outline").out, frameH);
    cap.style.webkitTextStroke = thicknessPx ? `${thicknessPx * 0.5}px rgba(0,0,0,.85)` : "";
  }
  cap.style.bottom = `${captionValue("position").px}%`;
  cap.style.fontFamily = captionValue("font").out;
  // color is set as a variable on the container so the highlighted word
  // changes even when content is redrawn every timeupdate
  cap.style.setProperty("--highlight", captionValue("highlight").css);

  if (frame) frame.dataset.watermark = captionValue("watermark").out ? "on" : "off";

  const wm = document.querySelector(".watermark916");
  if (wm && frame) {
    const sizeOut = captionValue("watermark-size").out;
    const opacity = captionValue("watermark-opacity").css;
    const position = captionValue("watermark-position").out;
    if (frameH > 0) wm.style.fontSize = `${pxFromOut(sizeOut, frameH)}px`;
    // opacity CSS on the ELEMENT, not rgba() on the text color -- rgba()
    // only fades the letter content, while the text-shadow underneath (see
    // .watermark916 in app.css) stays fully opaque. The result looks like
    // dirty gray at low opacity (content nearly invisible, dark shadow still
    // full-strength) instead of clean faded white. Element opacity fades
    // BOTH together, matching the OutlineColour alpha that is now set equal
    // to PrimaryColour in build_ass() -- both sides (preview and render)
    // are now truly consistent.
    wm.style.color = "#fff";
    wm.style.opacity = opacity;

    // Exactly the same logic as _watermark_placement() in
    // klipian/render.py -- line height estimated at 1.3x font size,
    // as a PERCENTAGE of PLAYRES_Y_DEFAULT (same way the render divides
    // by H). No longer depends on frameH here -- the percentage is the
    // same at any screen size, only the px font-size above needs to know
    // the actual frameH.
    const lineHeightPercent = (sizeOut * 1.3 / PLAYRES_Y_DEFAULT) * 100;

    wm.style.top = "auto";
    wm.style.bottom = "auto";
    wm.style.transform = "none";
    if (position === "top") {
      wm.style.top = `${Math.max(0, 16 - lineHeightPercent)}%`;
    } else if (position === "middle") {
      wm.style.top = "50%";
      wm.style.transform = "translateY(-50%)";
    } else {
      // Two conditions at once, same as _watermark_placement() "bottom"
      // variant in render.py: below caption, BUT must not enter the safe
      // zone (bottom:20% in CSS .safe) -- min() of both.
      const capMargin = captionValue("position").px;
      const belowCaption = Math.max(2, capMargin - lineHeightPercent - 1);
      const safeZoneLimit = Math.max(0, 20 - lineHeightPercent);
      wm.style.bottom = `${Math.min(belowCaption, safeZoneLimit)}%`;
    }
  }
}

// Caption & watermark font-size above is in ABSOLUTE PX (via
// pxFromOut()), computed once per applyCaption() call -- unlike position
// (top/bottom use %, which automatically follows container size without
// needing recalculation). If .frame916 changes size AFTER the last
// applyCaption() run (window resized, Claude side panel opened/closed,
// etc.), the stored px values go stale -- still the same even though the
// frame is now a different height. ResizeObserver catches that change
// and recomputes.
const frame916ResizeObserver = new ResizeObserver(() => {
  if (typeof applyCaption === "function") applyCaption();
});
const _frame916 = document.querySelector(".frame916");
if (_frame916) frame916ResizeObserver.observe(_frame916);

$("#captionList").addEventListener("click", (e) => {
  const c = e.target.closest(".chip");
  if (!c) return;
  const row = c.closest(".row");
  const o = CAPTION_OPTIONS.find((x) => x.id === row.dataset.caption);
  if (!o) return;
  const all = [...row.querySelectorAll(".chip")];
  o.active = Number(c.dataset.pilih ?? all.indexOf(c));
  all.forEach((b, i) => b.setAttribute("aria-pressed", String(i === o.active)));
  row.querySelector(".meta").textContent = o.choices[o.active].t;
  applyCaption();
  if (typeof saveProject === "function") saveProject();
  if (typeof savePresetCaption === "function") savePresetCaption();
});

/* ───────────────── cut: click pause to drop the gap ───────────────────── */


/* ───────────────── queue: cancel / retry / open folder ────────────────── */

$("#queueList").addEventListener("click", (e) => {
  const b = e.target.closest(".btn");
  if (!b) return;
  const i = [...$("#queueList").children].indexOf(b.closest(".row"));
  const r = QUEUE[i];
  if (!r) return;
  const action = b.dataset.action;

  if (action === "open") {
    // Backend opens Explorer -- browser can't and shouldn't.
    if (!r.folder) { b.textContent = "folder not ready"; setTimeout(drawQueue, 2000); return; }
    fetch("/api/open-folder", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ folder: r.folder }),
    }).then((x) => x.json()).then((j) => {
      if (j.error) { b.textContent = j.error.slice(0, 24); setTimeout(drawQueue, 2500); }
    }).catch(() => { b.textContent = "needs klipian serve"; setTimeout(drawQueue, 2500); });
    return;
  }
  // `act` is what the machine reads, `action` is what humans read. The old
  // branch compared the BUTTON LABEL, so translating the label broke the
  // button.
  if (action === "cancel") {
    // Tell the server to actually stop the running ffmpeg -- previously
    // Cancel was only cosmetic and the job kept running on the server.
    r.note = "cancelling…";
    drawQueue();
    if (typeof renderJobId !== "undefined" && renderJobId) {
      fetch("/api/render/cancel", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: renderJobId }),
      }).catch(() => { /* the poll will show the real state */ });
    }
    // Final status ("cancelled") comes from the poll once the server confirms.
  } else if (action === "retry") {
    // Retry re-runs the Result render from the start.
    if (typeof startRender === "function") startRender();
  }
});

drawSource();
applyCaption();
