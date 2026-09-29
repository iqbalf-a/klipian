/* klipian — real interactions
   ==========================================================================
   app.js renders the UI. This file makes the controls actually work,
   so what gets tested is the FLOW, not the pictures.

   Reframe has its own file (reframe.js) because its logic is the heaviest.
   Loaded after app.js; uses its global bindings.
   ========================================================================== */

/* ───────────────── source: a project video, or a link ────────────────────
   The Analyze screen used to open with a drop zone: drop a file and it
   became "the" video, keyed to a project by its filename. A project holds
   several videos now (assets.js), so Analyze picks one of THEM (ian);
   adding videos from samples/ is the Assets screen's job. A link box sits
   below the list, not wired up yet. */

let chosenSource = null;

/* Same clock as timeRange(), plus the one thing that is genuinely
   different here: a file whose duration ffprobe could not read says so,
   instead of silently reading as 00:00. */
const fmtDuration = (d) => (isFinite(d) ? timeRange(d) : "duration unreadable");

/* File name & duration in the topbar (#fileName/#fileDuration) -- one
   place, called whenever the video on screen changes: opening a project
   (projects.js) and switching videos (setActiveAsset, assets.js). */
function updateTopbarFile(name, durationSeconds) {
  if ($("#fileName")) $("#fileName").textContent = name || "";
  if ($("#fileDuration")) {
    $("#fileDuration").textContent = Number.isFinite(durationSeconds) ? fmtDuration(durationSeconds) : "";
  }
}

/* The Analyze screen's source panel: which of the project's videos is on
   screen, and whether "Find clips" has anything to work on. Kept under its
   old name -- every "the video changed" path already calls it. */
function drawSource(error, extraNote) {
  const button = $("#run");
  const hasSource = !!chosenSource && !error;
  $("#prepareFoot")?.toggleAttribute("hidden", !hasSource);
  if (button) button.disabled = !hasSource;
  const note = $("#analyzeSourceNote");
  if (note) {
    // realTranscript is read only once there IS a source: this also runs
    // at load (below), before roundtrip.js has declared it.
    const dur = chosenSource && (Number.isFinite(chosenSource.duration)
      ? chosenSource.duration : realTranscript?.duration);
    note.textContent = error || (chosenSource
      ? [chosenSource.name, Number.isFinite(dur) ? fmtDuration(dur) : "", extraNote || ""].filter(Boolean).join(" · ")
      : "");
  }
  if (typeof renderAnalyzeSources === "function") renderAnalyzeSources();
}

/* The link box on Analyze is on screen but does nothing yet (ian): it
   and its Download button are disabled in the markup. Downloading a link
   into samples/ was built once (yt-dlp) and taken out again -- see git
   history (commit 3eecf52) when it's wanted. */

/* No drop zone any more, but the window-level guard stays: without it a
   file dropped anywhere on the page (say, next to the Assets screen's
   image drop area) would be OPENED by the browser, abandoning the app
   along with all un-rendered work. It draws nothing; it only cancels the
   browser's default. */
const hasFiles = (e) => [...((e.dataTransfer && e.dataTransfer.types) || [])].includes("Files");

["dragenter", "dragover", "drop"].forEach((ev) =>
  window.addEventListener(ev, (e) => { if (hasFiles(e)) e.preventDefault(); }));

/* ───────────────── candidates: approve, reject, undo ──────────────────── */


/* ───────────────── ribbon: click a sweep to open its clip ─────────────── */


/* ───────────────── caption: options that update the preview live ──────── */

/* Returns the active choice OBJECT: { t, out, px?, css? }.
   Preview uses .px (small box), render uses .out. */
function captionValue(id) {
  const o = CAPTION_OPTIONS.find((x) => x.id === id);
  return o ? o.choices[o.active] : null;
}

// The render authors its subtitle layer against a fixed 1080x1920 and lets
// libass scale it to the output (REF_W/REF_H in render.py), so this number
// is now the same one on both sides rather than a lucky match. It used to
// follow the output size there, which meant a style burned 50% larger at
// 720p than this preview drew it -- found by rendering one.
//
// ALL pixel sizes in the preview (caption font, outline, watermark font)
// are computed PROPORTIONAL to it, instead of the separate ".px"
// calibration numbers this started with: those only "looked right" at ONE
// window size and broke at others -- preview fine, render the wrong size
// (ian's report, for both watermark AND caption -- same bug, two elements).
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
  // Every word keeps its outline in both modes: the box is drawn on its own
  // layer under the text now, so build_ass leaves the text layer ordinary.
  // The same Outline number also sets the box's padding there, so it's
  // handed to the CSS as well.
  const boxed = captionOut("highlight-style") === "box";
  cap.dataset.highlight = boxed ? "box" : "text";
  if (frameH > 0) {
    cap.style.fontSize = `${pxFromOut(captionOut("size"), frameH)}px`;
    const thicknessPx = pxFromOut(captionOut("outline"), frameH);
    cap.style.webkitTextStroke = thicknessPx ? `${thicknessPx * 0.5}px rgba(0,0,0,.85)` : "";
    cap.style.setProperty("--box-pad", `${thicknessPx + 4}px`);
  }
  cap.style.bottom = `${captionOut("position")}%`;
  // X is a percentage of the FRAME width, so it has to be applied as a
  // translate of the full-width box, not a left offset on the text: the
  // text is centred inside that box and a left offset would move the box's
  // edge, narrowing it on one side instead of sliding the words across.
  cap.style.transform = `translateX(${captionOut("x")}%)`;
  cap.style.fontFamily = captionValue("font").out;
  // color is set as a variable on the container so the highlighted word
  // changes even when content is redrawn every timeupdate
  cap.style.setProperty("--highlight", captionValue("highlight").css);

  if (frame) frame.dataset.watermark = captionValue("watermark").out ? "on" : "off";

  const wm = document.querySelector(".watermark916");
  if (wm && frame) {
    const sizeOut = captionOut("watermark-size");
    const opacity = captionValue("watermark-opacity").css;
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

    // Its own two percentages now, read the same way the caption's are --
    // this used to reproduce _watermark_placement()'s three modes, all of
    // which measured from the caption's position. That function is gone
    // (ian wanted the two independent), and with it the only reason this
    // block needed to know the caption's margin or estimate a line height.
    wm.style.top = "auto";
    wm.style.bottom = `${captionOut("watermark-y")}%`;
    wm.style.transform = `translateX(${captionOut("watermark-x")}%)`;
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

/* One listener for both containers: the Style tab's rows and the Watermark
   tab's are the same widget over the same CAPTION_OPTIONS, only drawn into
   two places (see drawCaptionOptions() in app.js). Bound to the section so
   it survives either list being rewritten. */
$("#panel-captions")?.addEventListener("click", (e) => {
  const reset = e.target.closest("[data-reset-group]");
  if (reset) {
    if (typeof resetCaptionGroup === "function") resetCaptionGroup(reset.dataset.resetGroup);
    return;
  }
  // The stepper buttons beside a number field. One step of the option's own
  // step size, clamped, writing both controls -- the same job the "input"
  // listener below does for typing and dragging.
  const step = e.target.closest("[data-step]");
  if (step) {
    const row = step.closest(".caption-row");
    const o = CAPTION_OPTIONS.find((x) => x.id === row?.dataset.caption);
    if (!o || o.kind !== "range") return;
    o.value = Math.min(o.max, Math.max(o.min, o.value + Number(step.dataset.step) * o.step));
    const num = row.querySelector(".slider-number");
    const sl = row.querySelector(".slider");
    if (num) num.value = o.value;
    if (sl) sl.value = o.value;
    applyCaption();
    if (typeof saveProject === "function") saveProject();
    if (typeof savePresetCaption === "function") savePresetCaption();
    return;
  }

  const c = e.target.closest(".chip");
  if (!c) return;
  const row = c.closest(".caption-row");
  if (!row) return;
  const o = CAPTION_OPTIONS.find((x) => x.id === row.dataset.caption);
  if (!o) return;
  const all = [...row.querySelectorAll(".chip")];
  o.active = Number(c.dataset.pick ?? all.indexOf(c));
  all.forEach((b, i) => b.setAttribute("aria-pressed", String(i === o.active)));
  applyCaption();
  if (typeof saveProject === "function") saveProject();
  if (typeof savePresetCaption === "function") savePresetCaption();
});

/* Slider and number field are two handles on one value, so they share a
   listener and write each other. "input", not "change", so the preview
   tracks the slider while it's being dragged -- that live feedback is the
   only way to judge a position. The partner control is updated in place
   rather than through drawCaptionOptions(), which would replace the element
   under the pointer mid-drag.

   An empty or half-typed number field ("-", "1e") parses to NaN: leave the
   value alone and let the typing finish, rather than snapping the preview
   to a clamped guess on every keystroke. */
$("#panel-captions")?.addEventListener("input", (e) => {
  const el = e.target.closest(".slider, .slider-number");
  if (!el) return;
  const row = el.closest(".caption-row");
  const o = CAPTION_OPTIONS.find((x) => x.id === row?.dataset.caption);
  if (!o || o.kind !== "range") return;
  const raw = Number(el.value);
  if (el.value === "" || !Number.isFinite(raw)) return;
  o.value = Math.min(o.max, Math.max(o.min, raw));
  const partner = row.querySelector(el.classList.contains("slider") ? ".slider-number" : ".slider");
  if (partner) partner.value = o.value;
  applyCaption();
  if (typeof saveProject === "function") saveProject();
  if (typeof savePresetCaption === "function") savePresetCaption();
});

/* Typing 999 leaves the field reading 999 while the value is clamped to the
   maximum -- they disagree until the field is redrawn. Correct it when the
   field is done being edited, not on every keystroke, which would fight
   someone typing "1" on the way to "16". */
$("#panel-captions")?.addEventListener("change", (e) => {
  const el = e.target.closest(".slider-number");
  if (!el) return;
  const o = CAPTION_OPTIONS.find((x) => x.id === el.closest(".caption-row")?.dataset.caption);
  if (o && o.kind === "range") el.value = o.value;
});

/* ───────────────── cut: click pause to drop the gap ───────────────────── */


/* ───────────────── queue: cancel / retry / open folder ────────────────── */

$("#queueList")?.addEventListener("click", (e) => {
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
