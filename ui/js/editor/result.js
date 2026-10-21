/* klipian — Result container
   ==========================================================================
   Result is ONE video: all ranges inside are joined into a single MP4.
   Two faucets fill the same container:

       timeline  ──  pick ranges yourself       ─┐
                                                  ├──>  RESULT  ──>  render
       Claude    ──  pick from recommendations  ─┘

   Two rules enforced here, not on screen:

   1. CHRONOLOGICAL ORDER. The render engine rejects clips that aren't in
      order, so ranges are always stored sorted earliest-minute first -- not
      the order you added them.

   2. NO OVERLAPPING. Ranges that touch are merged into one, because two
      overlapping clips would make the same second appear twice in the output
      video.
   ========================================================================== */

let RESULT = [];          // [{ id, start, end, title, source }]
let resultSeq = 0;

const resultTotal = () => RESULT.reduce((t, r) => t + (r.end - r.start), 0);

/* How many existing rows the last addToResult() absorbed. Read by the
   callers right after the call, so they can report a merge instead of a
   plain "added". Deliberately a module-level flag rather than a changed
   return type: addToResult() returns a REJECTION REASON or null, and both
   call sites already branch on exactly that. */
let lastAddWasMerge = 0;

/* Add one range. Returns a rejection reason string, or null on success. */
function addToResult(start, end, title, source) {
  start = Number(start); end = Number(end);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return "could not read that time";
  if (end - start < 0.5) return "range is too short";
  // Both callers (timeline selection, AI suggestions) speak in the ACTIVE
  // video's own seconds; RESULT lives on the shared virtual timeline
  // (assets.js). A no-op for the first video, whose offset is 0.
  if (typeof activeToVirtual === "function") { start = activeToVirtual(start); end = activeToVirtual(end); }

  // Merge with overlapping ranges so no second appears twice. This is the
  // right behaviour, but it USED to happen silently while the caller still
  // reported "added to Result" -- so a new clip that overlapped an existing
  // one appeared to simply vanish. `merged` is handed back so the caller
  // can say what actually happened.
  // Rule 1 above holds while the Result is still in source order. Once the
  // Timeline screen has reordered it, that order is deliberate: a new span
  // goes to the END (or into the place of the span it merged with), and
  // nothing is re-sorted out from under the edit.
  const wasInOrder = RESULT.every((r, i) => !i || RESULT[i - 1].start <= r.start);
  const overlapping = RESULT.filter((r) => start < r.end && end > r.start);
  let merged = 0;
  let at = RESULT.length;
  let volume;
  if (overlapping.length) {
    merged = overlapping.length;
    at = RESULT.indexOf(overlapping[0]);
    start = Math.min(start, ...overlapping.map((r) => r.start));
    end = Math.max(end, ...overlapping.map((r) => r.end));
    title = title || overlapping[0].title;
    volume = overlapping[0].volume;
    RESULT = RESULT.filter((r) => !overlapping.includes(r));
  }

  lastAddWasMerge = merged;
  const entry = {
    id: `r${++resultSeq}`,
    start, end,
    title: title || `Clip ${RESULT.length + 1}`,
    source: source || "manual",
  };
  if (volume !== undefined) entry.volume = volume;
  if (wasInOrder) {
    RESULT.push(entry);
    RESULT.sort((a, b) => a.start - b.start);
  } else {
    RESULT.splice(Math.min(at, RESULT.length), 0, entry);
  }
  renderResult();
  return null;
}

function removeFromResult(id) {
  const before = RESULT.map((r) => ({ ...r }));
  RESULT = RESULT.filter((r) => r.id !== id);
  renderResult();
  undoForResult("Moment removed", () => { RESULT = before; renderResult(); });
}

function clearResult() {
  const before = RESULT.map((r) => ({ ...r }));
  RESULT = [];
  renderResult();
  if (before.length) undoForResult(`${before.length} moment${before.length === 1 ? "" : "s"} cleared`,
    () => { RESULT = before; renderResult(); });
}

/* Default title: the first clip's title, or a generic name when there's a mix. */
function defaultTitle() {
  if (!RESULT.length) return "";
  return RESULT.length === 1 ? RESULT[0].title : `${RESULT[0].title} +${RESULT.length - 1}`;
}

/* Result -> a single clip the render engine understands. All ranges become spans,
   and it's those spans ffmpeg joins into one file. */
function resultAsClip() {
  if (!RESULT.length) return null;
  const typed = $("#resultTitle")?.value.trim();
  return {
    title: typed || defaultTitle(),
    spans: RESULT.map((r) => ({ start: r.start, end: r.end })),
    startSec: RESULT[0].start,
    endSec: RESULT[RESULT.length - 1].end,
    dur: Math.round(resultTotal()),
    // What the Timeline screen laid on top (compose.js).
    overlays: (typeof overlaysForRender === "function") ? overlaysForRender() : [],
    volumes: (typeof segmentVolumes === "function") ? segmentVolumes() : [],
    // The text to post it with (post.js): kept with the render so the upload
    // schedule gets a row for it.
    ...((typeof currentPost === "function" && currentPost()) ? { post: currentPost() } : {}),
  };
}

/* ---------- rendering ---------- */

/* Every Result change flows through here -- add, remove, clear. The save trigger
   is wired here, not in every caller: one missed caller means work silently lost,
   and that's the most annoying kind of failure. Saves are debounced so redundant
   calls from screen switches don't become a burden. */
/* Time fields are sized from what they hold: "mm:ss.d" is 7 characters, "h:mm:ss.d" is 9, so a source of an hour or
   more (or any time past it in the suggestions or the Result) widens every time field by the same two characters and
   nothing is cut off. --tw is the width of an editable time in ch, --tr of a read-only one (no tenths). Called
   whenever the video, the suggestions or the Result change. */
let timeFieldDuration = 0;
function fitTimeFields(durationSeconds) {
  if (Number.isFinite(durationSeconds)) timeFieldDuration = Math.max(0, durationSeconds);
  const longest = Math.max(timeFieldDuration,
    ...((typeof DATA !== "undefined" && DATA.candidates) || []).map((k) => Math.max(k.startSec || 0, k.endSec || 0)),
    ...(typeof RESULT !== "undefined" ? RESULT : []).map((r) => (typeof toReal === "function" ? toReal(r.end).t : r.end) || 0));
  const long = longest >= 3600 || (typeof realTranscript !== "undefined" && realTranscript?.duration >= 3600);
  document.documentElement.style.setProperty("--tw", long ? "9" : "7");
  document.documentElement.style.setProperty("--tr", long ? "7" : "5");
}

function renderResult() {
  fitTimeFields();
  if (typeof saveProject === "function") saveProject();
  if (typeof renderAllResults === "function") renderAllResults();
  const list = $("#resultList");
  const total = $("#resultTotal");
  if (!list) return;

  if (!RESULT.length) {
    list.innerHTML = `<p class="empty-message">Result is empty. Pick a suggestion above, or
      select a range yourself on the timeline.</p>`;
    if (total) total.textContent = "empty";
    const clr = $("#resultClearBtn"); if (clr) clr.disabled = true;
    const btn = $("#resultRenderBtn"); if (btn) btn.disabled = true;
    const quickPreviewBtn = $("#previewQuickBtn"); if (quickPreviewBtn) quickPreviewBtn.disabled = true;
    const summaryEl = $("#resultSummary"); if (summaryEl) summaryEl.textContent = "";
    if (typeof setResultAsPreview === "function") setResultAsPreview();
    if (typeof drawTotalTimeline === "function") drawTotalTimeline();
  if (typeof renderCaptions === "function") renderCaptions();
    return;
  }

  // Times shown in the span's own video (assetTimeLabel), never the
  // virtual second -- a span from a second episode would otherwise read
  // as "277:46:40".
  const clock = (t) => (typeof toReal === "function" ? timeRange(toReal(t).t) : timeRange(t));
  const multi = typeof isMultiAsset === "function" && isMultiAsset();
  list.classList.toggle("multi", multi);
  list.innerHTML = RESULT.map((r, i) => `
    <div class="result-row" data-result="${r.id}">
      <span class="num">${i + 1}</span>
      <span class="result-title">${escapeHTML(r.title)}</span>
      ${multi ? `<span class="data result-asset" title="${escapeHTML(toReal(r.start).file)}">${escapeHTML(assetStem(assetById(toReal(r.start).id)))}</span>` : ""}
      <span class="data result-time">${clock(r.start)} – ${clock(r.end)}</span>
      <span class="data result-dur">${Math.round(r.end - r.start)}s</span>
      <span class="source-badge" data-source="${r.source}">${r.source === "ai" ? "AI" : "manual"}</span>
      <button class="icon delete-result" data-delete-result="${r.id}"
              aria-label="Remove ${escapeHTML(r.title)} from Result">×</button>
    </div>`).join("");

  if (total) {
    total.textContent = `${RESULT.length} span${RESULT.length > 1 ? "s" : ""} · ${Math.round(resultTotal())}s`;
  }
  const clr = $("#resultClearBtn"); if (clr) clr.disabled = false;

  const titleInput = $("#resultTitle");
  if (titleInput && !titleInput.value.trim()) titleInput.placeholder = defaultTitle();
  // Not a plain `disabled = false`: a render already in flight must keep
  // both buttons locked, or a second ffmpeg job gets launched behind the
  // first (see updateRenderButtons() in player.js).
  if (typeof updateRenderButtons === "function") updateRenderButtons();
  const summaryEl = $("#resultSummary");
  if (summaryEl) {
    summaryEl.textContent = RESULT.length === 1
      ? "one MP4 file"
      : `${RESULT.length} spans joined into one MP4`;
  }

  // Preview plays the result, so update it too.
  if (typeof setResultAsPreview === "function") setResultAsPreview();
  // Timeline markers follow the result. Without this, removed clips stay
  // drawn in yellow and the bar gradually fills up with stale marks.
  if (typeof drawTotalTimeline === "function") drawTotalTimeline();
  if (typeof renderCaptions === "function") renderCaptions();
}

/* ---------- AI recommendations: minutes and titles only ---------- */

/* One mm:ss field + its tiny ▲▼ stepper (+/-1 second) -- typing is still
   the main path for a big correction, the stepper is for the common case
   of nudging by a second or two (see commitRecTime()). Both the input and
   the stepper stay disabled until the pencil unlocks the row, same lock
   as before -- a clickable stepper sitting in a checkbox-wrapping <label>
   would be just as easy to bump by accident as an always-editable input. */
function recTimeField(i, field, value, label) {
  return `
    <span class="rec-time-field">
      <input type="text" class="rec-time-in" value="${value}"
             data-idx="${i}" data-field="${field}" size="7" maxlength="${typeof tfMaxLength === "function" ? tfMaxLength(tfLong()) : 9}" spellcheck="false" disabled
             inputmode="decimal" aria-label="${label}">
      <span class="rec-time-step">
        <button type="button" class="rec-step" data-idx="${i}" data-field="${field}"
                data-dir="1" tabindex="-1" disabled
                aria-label="Increase ${label.charAt(0).toLowerCase()}${label.slice(1)} by 1 second">▲</button>
        <button type="button" class="rec-step" data-idx="${i}" data-field="${field}"
                data-dir="-1" tabindex="-1" disabled
                aria-label="Decrease ${label.charAt(0).toLowerCase()}${label.slice(1)} by 1 second">▼</button>
      </span>
    </span>`;
}

function renderRecommendations() {
  const list = $("#recList");
  const note = $("#recNote");
  if (!list) return;
  const undo = $("#recUndo");
  if (undo) {
    undo.hidden = !(typeof replacedSuggestions !== "undefined" && replacedSuggestions
      && replacedSuggestions.video === (chosenSource?.name || ""));
    if (!undo.hidden) undo.textContent = `Undo import (bring back ${replacedSuggestions.list.length})`;
  }
  const candidates = (DATA?.candidates) || [];
  fitTimeFields();

  // The list can change entirely (re-import from Claude) while the preview
  // still points to the old index -- close it first so it doesn't point to
  // the wrong recommendation after re-rendering.
  if (typeof closeRecPreview === "function") closeRecPreview();

  if (!candidates.length) {
    list.innerHTML = `<p class="empty-message">No suggestions yet. Import Claude's JSON on the
      Analyze screen, or just select a range on the timeline.</p>`;
    if (note) note.textContent = "none yet";
    updateRecButton();
    return;
  }

  // Intentionally minimal: minutes, title, duration. Scores and reasons don't
  // help on this screen -- all you need is "take it or leave it".
  //
  // Time IS EDITABLE: Claude sometimes points to seconds that are slightly off
  // from what was intended, and before this the only way to fix it was to
  // reject the entire recommendation and pick a range manually on the
  // timeline. Format is mm:ss, same as the "from"/"to" columns above --
  // not raw seconds -- so one convention is used across this screen.
  //
  // The input is LOCKED (disabled) until the pencil button is pressed -- this
  // row sits inside a <label> wrapping the "pick for Result" checkbox, and a
  // time field that's always clickable would be easy to bump accidentally.
  // The pencil unlocks + focuses the "start" field; once open the icon flips
  // to a checkmark (Save) -- press again to re-lock AND ensure the value
  // just typed is committed (see the #recList click listener: a manual
  // "change" dispatch, because clicking the Save button directly without
  // moving focus away from the text field first doesn't fire the browser's
  // native change event).
  list.innerHTML = candidates.map((k, i) => `
    <label class="rec-row">
      <button class="rec-play" type="button" data-play="${i}"
              aria-label="Preview ${escapeHTML(k.title)}" aria-pressed="false">▶</button>
      <input type="checkbox" data-rec="${i}">
      <span class="num">${i + 1}</span>
      <span class="rec-title">${escapeHTML(k.title)}</span>
      <span class="rec-time">
        ${recTimeField(i, "startSec", timeTenths(k.startSec), `Start time for ${escapeHTML(k.title)}`)}
        <span aria-hidden="true">–</span>
        ${recTimeField(i, "endSec", timeTenths(k.endSec), `End time for ${escapeHTML(k.title)}`)}
        <button class="rec-edit" type="button" data-edit-time="${i}"
                title="Edit time" aria-label="Edit time for ${escapeHTML(k.title)}">✎</button>
      </span>
      <span class="data rec-dur">${k.dur}s</span>
      ${typeof cueBadgesHTML === "function" ? cueBadgesHTML(k) : ""}
    </label>`).join("");
  if (note) note.textContent = `${candidates.length} suggestion${candidates.length > 1 ? "s" : ""}`;
  updateRecButton();
}

/* ---------- full source video preview, before entering Result ----------
   The 9:16 panel on the right is already taken (locked to Result), so this is
   a SEPARATE video element dedicated to viewing a recommendation's raw range
   as-is -- not yet clipped, not yet framed, because both are meaningless
   before the range enters Result.

   Sits in the Timeline panel, ABOVE the #tlTotal bar -- not in the AI
   suggestions panel -- because both point to the SAME video. This panel is
   ALWAYS visible, has its own scrub bar (.tl-scrub, see loadFullPreview()
   and the #tlScrub handler below) for free-form position seeking -- separate
   from #tlTotal which remains 100% dedicated to picking manual ranges. */

let previewIdx = null;      // index of the recommendation being previewed
let previewLimit = null;    // end-second -- video stops here on its own

// Loads the source video into #tlPreviewVideo as soon as it exists, WITHOUT
// autoplay -- the panel is now always visible (not just when a suggestion is
// playing), so it needs content as early as possible, not waiting for Play
// to be pressed.
// Called from drawTotalTimeline() every time the timeline is redrawn,
// which is already the gathering point whenever chosenSource changes.
function loadFullPreview() {
  const v = $("#tlPreviewVideo");
  if (!v || !chosenSource?.url) return;
  const absoluteSrc = new URL(chosenSource.url, location.href).href;
  if (v.src !== absoluteSrc) v.src = chosenSource.url;
}

function updateRecPlayIcon() {
  // Not just "this row is active" -- it must be "this row is active AND
  // the video is actually playing". Without the second condition, the icon
  // stays as pause forever after a manual pause or auto-stop at endSec --
  // even though the video is already idle.
  const v = $("#tlPreviewVideo");
  const nowPlaying = !!(v && !v.paused);
  document.querySelectorAll(".rec-play").forEach((b) => {
    const active = Number(b.dataset.play) === previewIdx && nowPlaying;
    b.textContent = active ? "⏸" : "▶";
    b.setAttribute("aria-pressed", String(active));
  });
  const ownPlayBtn = $("#tlPreviewPlay");
  if (ownPlayBtn) ownPlayBtn.textContent = nowPlaying ? "❚❚" : "▶";
}

function closeRecPreview() {
  $("#tlPreviewVideo")?.pause();
  previewIdx = null;
  previewLimit = null;
  const titleEl = $("#tlPreviewTitle");
  if (titleEl) titleEl.textContent = "";
  updateRecPlayIcon();
}

function playRecPreview(idx) {
  const k = (DATA?.candidates || [])[idx];
  const box = $("#tlPreview"), v = $("#tlPreviewVideo");
  if (!k || !box || !v || !chosenSource?.url) return;

  // Pressing the SAME button while playing means pause, not restart.
  if (previewIdx === idx && !v.paused) { v.pause(); return; }

  // Result preview and recommendation preview must not play simultaneously.
  if (typeof video !== "undefined" && video && !video.paused) {
    video.pause();
    if (typeof isPlaying !== "undefined") isPlaying = false;
    if (typeof playBtn !== "undefined" && playBtn) playBtn.textContent = "▶";
  }

  const titleEl = $("#tlPreviewTitle");
  if (titleEl) titleEl.textContent = `${timeRange(k.startSec)} – ${timeRange(k.endSec)} · ${k.title}`;

  previewIdx = idx;
  previewLimit = k.endSec;
  updateRecPlayIcon();

  const startPlayback = () => {
    try { v.currentTime = k.startSec; } catch { /* metadata not ready yet */ }
    v.play().catch(() => {});
  };
  // `v.src` is ALWAYS an absolute URL once read back -- the browser resolves
  // it itself -- while chosenSource.url is relative ("/workspace/sources/...").
  // Comparing them raw ALWAYS mismatches, so the video gets reloaded from
  // scratch every time Play is pressed, even for suggestions from the same
  // video: wasted buffering, and for a moment after clicking the video still
  // appears idle waiting for loadedmetadata when it should have started
  // playing immediately. Both are resolved to absolute form before comparing.
  const absoluteSrc = new URL(chosenSource.url, location.href).href;
  if (v.src !== absoluteSrc) {
    v.src = chosenSource.url;
    v.addEventListener("loadedmetadata", startPlayback, { once: true });
  } else if (v.readyState >= 1) {
    // HAVE_METADATA+: safe to set currentTime now.
    startPlayback();
  } else {
    // Same src but metadata not ready yet (loadFullPreview just set src) --
    // wait, otherwise currentTime is discarded and preview starts from 0.
    v.addEventListener("loadedmetadata", startPlayback, { once: true });
  }
}

// Stops automatically at the recommendation's end-second -- preview THIS
// range only, not the irrelevant video section that follows.
// Also updates the scrub bar fill and the "position / total" clock.
$("#tlPreviewVideo")?.addEventListener("timeupdate", (e) => {
  const v = e.target;
  if (previewLimit !== null && v.currentTime >= previewLimit) v.pause();

  const jam = $("#tlPreviewTime");
  if (jam && typeof videoDuration === "function") {
    jam.textContent = `${timeRange(v.currentTime)} / ${timeRange(videoDuration())}`;
  }
  const fill = $("#tlScrubFill");
  if (fill && typeof toFraction === "function") {
    const persen = toFraction(v.currentTime) * 100;
    fill.style.width = `${persen}%`;
    $("#tlScrub")?.setAttribute("aria-valuenow", String(Math.round(persen)));
  }
});
$("#tlPreviewVideo")?.addEventListener("pause", updateRecPlayIcon);
$("#tlPreviewVideo")?.addEventListener("play", updateRecPlayIcon);

// Scrub bar: click or drag anywhere to jump the playback position.
// Completely separate from #tlTotal (which stays purely for picking ranges),
// so there's no need to distinguish "click" vs "drag" on a single bar.
function tlScrubSeek(clientX) {
  const bar = $("#tlScrub");
  const v = $("#tlPreviewVideo");
  if (!bar || !v || !v.src || typeof fracToSeconds !== "function") return;
  const r = bar.getBoundingClientRect();
  const frac = r.width ? Math.max(0, Math.min(1, (clientX - r.left) / r.width)) : 0;
  try { v.currentTime = fracToSeconds(frac); } catch { /* metadata not ready yet */ }
}
$("#tlScrub")?.addEventListener("pointerdown", (e) => {
  const bar = $("#tlScrub"), v = $("#tlPreviewVideo");
  if (!bar || !v || !v.src) return;
  e.preventDefault();
  bar.setPointerCapture(e.pointerId);
  // Free-seeking anywhere -- if currently locked to a single recommendation's
  // range (previewBatas), release the lock so playback isn't immediately
  // force-paused when crossing that old range boundary.
  previewIdx = null;
  previewLimit = null;
  const titleEl = $("#tlPreviewTitle");
  if (titleEl) titleEl.textContent = "";
  updateRecPlayIcon();
  tlScrubSeek(e.clientX);
});
$("#tlScrub")?.addEventListener("pointermove", (e) => {
  if (e.buttons !== 1) return;
  tlScrubSeek(e.clientX);
});

/* This element declares role="slider" with a full set of aria-valuemin/max/
   now, and tabindex="0" -- so it is focusable and announced as adjustable --
   but it had no key handling at all, only pointer events. Arrows did
   nothing. Its visual twin #timeline (player.js) has had one all along, so
   two identical-looking scrub bars behaved differently.
   Same step convention as there: 1s, 5s with Shift, Home/End to the ends. */
$("#tlScrub")?.addEventListener("keydown", (e) => {
  const v = $("#tlPreviewVideo");
  if (!v || !v.src || !Number.isFinite(v.duration)) return;
  const step = e.shiftKey ? 5 : 1;
  let t = v.currentTime;
  if (e.key === "ArrowRight" || e.key === "ArrowUp") t += step;
  else if (e.key === "ArrowLeft" || e.key === "ArrowDown") t -= step;
  else if (e.key === "Home") t = 0;
  else if (e.key === "End") t = v.duration;
  else if (e.key === "PageUp") t += 10;
  else if (e.key === "PageDown") t -= 10;
  else return;
  e.preventDefault();
  // Keyboard seeking is free seeking, same as a pointer drag: release the
  // single-recommendation lock so playback isn't force-paused at an old
  // range boundary.
  previewIdx = null;
  previewLimit = null;
  const titleEl = $("#tlPreviewTitle");
  if (titleEl) titleEl.textContent = "";
  updateRecPlayIcon();
  try { v.currentTime = Math.max(0, Math.min(v.duration, t)); } catch { /* not ready */ }
});

// Standalone controls: pause/resume whatever is loaded, WITHOUT needing to
// go back to the AI suggestion row that loaded it. If the video already
// passed the recommendation's end boundary (auto-stopped earlier), pressing
// Play here restarts from the beginning of that range -- same as pressing
// the Play button on its row again.
$("#tlPreviewPlay")?.addEventListener("click", () => {
  const v = $("#tlPreviewVideo");
  if (!v || !v.src) return;
  if (!v.paused) { v.pause(); return; }
  if (previewLimit !== null && v.currentTime >= previewLimit - 0.05) {
    const k = (DATA?.candidates || [])[previewIdx];
    if (k) { try { v.currentTime = k.startSec; } catch { /* metadata not ready yet */ } }
  }
  v.play().catch(() => {});
});

/* Aspect ratio is locked to the SOURCE'S native ratio once metadata arrives,
   rather than staying at the CSS default of 16:9. Landscape sources that
   aren't exactly 16:9 (rare, but they exist) would cause the box to jump
   in size once the video finishes loading if this isn't handled -- locked
   once at the start so there's no jump at all. */
$("#tlPreviewVideo")?.addEventListener("loadedmetadata", (e) => {
  const v = e.target;
  if (v.videoWidth && v.videoHeight) {
    v.style.aspectRatio = `${v.videoWidth} / ${v.videoHeight}`;
  }
  // Browsers don't paint any frame until the position is nudged -- the box
  // is blank black once src is set via loadFullPreview() (no play() or seek).
  // A nudge this tiny forces the first frame to render without any visible
  // shift to the eye.
  if (v.currentTime === 0) { try { v.currentTime = 0.001; } catch { /* ignore */ } }
});

/* Step forward/backward in SECONDS, not frames -- this panel is for scrubbing
   through source videos that can be hours long to FIND ranges, so coarse
   steps are more useful than frame precision (that's the Result preview's
   job on the right, see stepFrame() in player.js). Stepping while playing
   is awkward, so it pauses first if needed. Allowed to freely cross the
   suggestion's range boundary (previewBatas): that's exactly the point --
   judging whether the boundary needs a slight nudge. */
function tlPreviewStepSeconds(seconds) {
  const v = $("#tlPreviewVideo");
  if (!v || !v.src) return;
  if (!v.paused) v.pause();
  const limit = v.duration || Infinity;
  const target = Math.max(0, Math.min(limit, v.currentTime + seconds));
  try { v.currentTime = target; } catch { /* out of range */ }
}
[["#tlPreviewPrev5", -5], ["#tlPreviewPrev2", -2], ["#tlPreviewPrev", -1],
 ["#tlPreviewNext", 1], ["#tlPreviewNext2", 2], ["#tlPreviewNext5", 5]]
  .forEach(([sel, n]) => $(sel)?.addEventListener("click", () => tlPreviewStepSeconds(n)));

$("#recList")?.addEventListener("click", (e) => {
  const edit = e.target.closest("[data-edit-time]");
  if (edit) {
    e.preventDefault();     // prevent accidentally toggling the row's checkbox
    const row = edit.closest(".rec-row");
    const inputs = row ? [...row.querySelectorAll(".rec-time-in")] : [];
    const steps = row ? [...row.querySelectorAll(".rec-step")] : [];
    const startInput = inputs.find((el) => el.dataset.field === "startSec");
    if (!startInput) return;
    const k = (DATA?.candidates || [])[Number(edit.dataset.editTime)];
    const title = k ? escapeHTML(k.title) : "";
    const isEditing = !startInput.disabled;
    if (isEditing) {
      // "Save" click: ensure the value just typed is committed --
      // clicking this button directly (without moving focus away from the
      // text field first) does NOT fire the browser's native "change" event,
      // so it's dispatched manually here. Safe to call even when the value
      // hasn't changed (the change listener re-validates rather than
      // assuming a change occurred).
      inputs.forEach((inp) => inp.dispatchEvent(new Event("change", { bubbles: true })));
      inputs.forEach((inp) => {                      // one that is still refused goes back to what it was
        if (inp.getAttribute("aria-invalid") === "true") {
          const kk = (DATA?.candidates || [])[Number(inp.dataset.idx)];
          if (kk) inp.value = timeTenths(kk[inp.dataset.field]);
          tfClear(inp);
        }
      });
      inputs.forEach((inp) => { inp.disabled = true; });
      steps.forEach((s) => { s.disabled = true; });
      edit.textContent = "✎";
      edit.title = "Edit time";
      edit.removeAttribute("data-editing");
      edit.setAttribute("aria-label", `Edit time for ${title}`);
    } else {
      inputs.forEach((inp) => { inp.disabled = false; });
      steps.forEach((s) => { s.disabled = false; });
      startInput.focus();
      startInput.select();
      edit.textContent = "✓";
      edit.title = "Save time";
      edit.setAttribute("data-editing", "true");
      edit.setAttribute("aria-label", `Save time for ${title}`);
    }
    return;
  }
  const step = e.target.closest(".rec-step");
  if (step) {
    e.preventDefault();     // prevent accidentally toggling the row's checkbox
    const k = (DATA?.candidates || [])[Number(step.dataset.idx)];
    if (!k) return;
    commitRecTime(Number(step.dataset.idx), step.dataset.field,
                  k[step.dataset.field] + Number(step.dataset.dir));
    return;
  }
  const btn = e.target.closest(".rec-play");
  if (!btn) return;
  e.preventDefault();       // prevent accidentally toggling the row's checkbox
  playRecPreview(Number(btn.dataset.play));
});

/* The keys (digits from the right, ArrowUp/Down 0.1 s or 1 s with Shift, Enter, Esc) and the mask live in
   timefield.js; what is left here is committing the value on "change". The ▲▼ buttons step by 1 s. */

/* Correcting a single recommendation's time. The `label` wraps both the
   checkbox AND these two columns -- clicking the text toggles the row
   (default <label> behavior), but clicking an input keeps focus on the
   input without toggling; that's standard browser behavior for nested
   form controls, not something that needs manual handling here.

   A typed time without a decimal point is snapped to a word (snapManual,
   app.js: 0.6 s at most, in the direction that keeps the word whole); one WITH
   a decimal point ("03:12.0") is taken exactly -- `exact`. The same rule as the
   from/to fields on the Clips screen.

   Shared between manual typing (the "change" listener below) and the
   ▲▼ stepper / arrow-key nudge above, so every path validates, snaps,
   and syncs k.dur/k.spans/k.in/k.out the same way. Returns whether the
   new time was accepted. */
function commitRecTime(idx, field, rawSeconds, exact = false) {
  const k = (DATA?.candidates || [])[idx];
  if (!k || !Number.isFinite(rawSeconds)) return false;
  const side = field === "startSec" ? "start" : "end";
  const res = (!exact && typeof snapManual === "function") ? snapManual(rawSeconds, side)
    : { time: rawSeconds, word: null };
  const snapped = res.time;

  const other = field === "startSec" ? k.endSec : k.startSec;
  if (field === "startSec" ? snapped >= other : snapped <= other) return false;

  k[field] = snapped;
  k.dur = Math.round(k.endSec - k.startSec);
  // Keep spans/in/out in sync: otherwise code that reads k.spans
  // (render, preview) or k.in/k.out (display) still uses the old range.
  k.spans = [{ start: k.startSec, end: k.endSec }];
  if (typeof timeRange === "function") {
    k.in = timeRange(k.startSec);
    k.out = timeRange(k.endSec);
  }
  const row = document.querySelector(`.rec-row .rec-time-in[data-idx="${idx}"]`)?.closest(".rec-row");
  if (row) {
    const startEl = row.querySelector('.rec-time-in[data-field="startSec"]');
    const endEl = row.querySelector('.rec-time-in[data-field="endSec"]');
    if (startEl) startEl.value = timeTenths(k.startSec);
    if (endEl) endEl.value = timeTenths(k.endSec);
    const durEl = row.querySelector(".rec-dur");
    if (durEl) durEl.textContent = `${k.dur}s`;
  }
  // The thin marker on the total timeline is drawn from k.startSec/endSec --
  // redraw so it moves along, rather than staying at the old position until
  // the next redraw.
  if (typeof drawTotalTimeline === "function") drawTotalTimeline();
  return { ...res, typed: rawSeconds, side };
}

$("#recList")?.addEventListener("change", (e) => {
  const inp = e.target.closest(".rec-time-in");
  if (!inp) return;
  const idx = Number(inp.dataset.idx);
  const field = inp.dataset.field;
  const k = (DATA?.candidates || [])[idx];
  if (!k) return;
  const note = $("#recNote");
  const parsed = tfParse(inp.value);
  // A rejected value is shown, not undone: the field goes red and says why (Esc puts the old value back). The
  // reasons differ (not a time, seconds or minutes past 59, before the start / after the end), so it says which.
  if (!parsed.ok) {
    tfInvalid(inp, parsed.error);
    if (note) note.textContent = `${parsed.error} (the time stays ${tfFormat(k[field])} until you fix or press Esc)`;
    return;
  }
  // Past the end of the video: the end of the video
  const length = (typeof videoDuration === "function") ? videoDuration() : 0;
  let clamped = false;
  if (length && parsed.seconds > length) { parsed.seconds = length; parsed.exact = true; clamped = true; }
  // Left alone (the text is still what the field showed): nothing to commit, so a
  // blur or the Save button never re-snaps a time that was not touched.
  if (inp.value.trim() === timeTenths(k[field])) return;
  const done = commitRecTime(idx, field, parsed.seconds, parsed.exact);
  if (!done) {
    tfInvalid(inp, field === "startSec" ? "start must stay before the end" : "end must stay after the start");
    if (note) {
      note.textContent = field === "startSec"
        ? `start must stay before the end (${timeTenths(k.endSec)})`
        : `end must stay after the start (${timeTenths(k.startSec)})`;
    }
    return;
  }
  tfClear(inp);
  if (note) note.textContent = (clamped ? "shortened to the end of the video · " : "") + timeSetNote(done.side, done.side, done.typed, done);
});

function updateRecButton() {
  const b = $("#recAddBtn");
  if (!b) return;
  const n = document.querySelectorAll("#recList input:checked").length;
  const moments = `${n} moment${n === 1 ? "" : "s"}`;
  const none = "Tick moments above first";
  b.disabled = n === 0;
  b.textContent = n ? `Add ${n} to this Result` : "Add to this Result";
  b.title = n ? "Merge the ticked moments into the open Result: one render gives one file" : none;
  $("#recOneLine").textContent = n ? `${moments} → 1 video` : none;
  const each = $("#recEachBtn");
  if (each) {
    each.disabled = n === 0;
    each.textContent = n > 1 ? `Make ${n} separate Results` : n === 1 ? "Make its own Result" : "Make separate Results";
    each.title = n ? "Each ticked moment becomes its own Result (it keeps the open Result's output format): Render selected then gives one file each" : none;
    $("#recManyLine").textContent = n ? `${moments} → ${n} video${n === 1 ? "" : "s"}` : none;
  }
}

/* ---------- events ---------- */

/* A Result made only of suggestions keeps the import of the first one (bulk.js: "Select all from this brief"). */
function tagResultWithImport(suggestions) {
  const slot = (typeof SAVED_RESULTS !== "undefined") ? SAVED_RESULTS.find((r) => r.id === activeResultId) : null;
  const first = suggestions.find((k) => k?.importId);
  if (slot && first && !slot.importId && RESULT.length && RESULT.every((r) => r.source === "ai")) slot.importId = first.importId;
  if (typeof renderAllResults === "function") renderAllResults();
}

$("#recList")?.addEventListener("change", updateRecButton);

/* "Each as its own Result": a Result per ticked suggestion (the first goes into the open Result when that is
   still empty), so a whole brief can be ticked in the Results list and rendered at once (bulk.js). */
$("#recEachBtn")?.addEventListener("click", () => {
  const selected = [...document.querySelectorAll("#recList input:checked")];
  const candidates = DATA.candidates || [];
  let made = 0, skipped = 0;
  const fresh = [];
  for (const c of selected) {
    const k = candidates[Number(c.dataset.rec)];
    c.checked = false;
    if (!k) continue;
    if (RESULT.length && typeof newResult === "function") newResult();
    if (addToResult(k.startSec, k.endSec, k.title, "ai")) { skipped++; continue; }
    if (typeof carryPostFrom === "function") carryPostFrom([k]);
    if (typeof carryAngleFrom === "function") carryAngleFrom([k]);
    tagResultWithImport([k]);
    fresh.push(activeResultId);
    made++;
  }
  updateRecButton();
  $("#editNote").textContent = `${made} Result${made === 1 ? "" : "s"} ready: set their output format, then Render selected.`
    + (skipped ? ` (${skipped} skipped: invalid timing)` : "");
  // the new Results are ticked and lit in step 2, so the next move is in front of the person
  if (typeof bulkShowFresh === "function") bulkShowFresh(fresh);
});

$("#recAddBtn")?.addEventListener("click", () => {
  const selected = [...document.querySelectorAll("#recList input:checked")];
  const candidates = DATA.candidates || [];
  let rejectedCount = 0;
  let mergedCount = 0;
  const added = [];
  for (const c of selected) {
    const k = candidates[Number(c.dataset.rec)];
    if (!k) continue;
    added.push(k);
    if (addToResult(k.startSec, k.endSec, k.title, "ai")) rejectedCount++;
    else mergedCount += lastAddWasMerge;
    c.checked = false;
  }
  updateRecButton();
  // The first suggestion's post text comes along, into an empty one (post.js).
  if (typeof carryPostFrom === "function") carryPostFrom(added);
  if (typeof carryAngleFrom === "function") carryAngleFrom(added);
  tagResultWithImport(added);
  // Overlapping suggestions are merged into one span on purpose, but adding
  // three and seeing one row appear reads as two of them being dropped.
  const parts = [];
  if (rejectedCount) {
    parts.push(`${rejectedCount} suggestion${rejectedCount > 1 ? "s" : ""} skipped — invalid timing`);
  }
  if (mergedCount) {
    parts.push(`${mergedCount} overlapping span${mergedCount > 1 ? "s" : ""} merged`);
  }
  const openTitle = (typeof bulkRows === "function" ? bulkRows().find((r) => r.live)?.title : "") || "the open Result";
  parts.unshift(`Added to ${openTitle}: render it from step 3 / the Render screen.`);
  $("#editNote").textContent = parts.join(" · ");
  if (typeof bulkShowFresh === "function") bulkShowFresh([activeResultId], { tick: false });
});

$("#resultList")?.addEventListener("click", (e) => {
  const b = e.target.closest("[data-delete-result]");
  if (b) removeFromResult(b.dataset.deleteResult);
});

$("#resultClearBtn")?.addEventListener("click", clearResult);

/* The title had NO listener at all: snapshotActiveResult() reads the field,
   but only when something else already triggered a save. So typing a title
   and then reloading lost it, while typing a title and then clicking another
   screen kept it -- the same change persisting or not depending on what you
   happened to do next. "input" rather than "change" so the debounced save
   also covers closing the tab straight after typing, without blur. */
$("#resultTitle")?.addEventListener("input", () => {
  if (typeof saveProject === "function") saveProject();
});

/* New video = result is also cleared, like an object list. */
function resetResult() {
  RESULT = [];
  resultSeq = 0;
  if (typeof clearPostFields === "function") clearPostFields();
  if (typeof clearAngleFields === "function") clearAngleFields();
  renderResult();
  renderRecommendations();
}

/* Render: the entire result becomes ONE file. */
$("#resultRenderBtn")?.addEventListener("click", () => {
  const clip = resultAsClip();
  if (!clip) return;
  if (typeof sendRender === "function") sendRender([clip]);
});

/* Manual path starts on the Clips screen: the timeline is there. */
$("#manualClip")?.addEventListener("click", () => toScreen("clips"));
