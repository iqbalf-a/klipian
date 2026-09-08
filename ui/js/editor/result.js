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

/* Add one range. Returns a rejection reason string, or null on success. */
function addToResult(start, end, title, source) {
  start = Number(start); end = Number(end);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return "could not read that time";
  if (end - start < 0.5) return "range is too short";

  // Merge with overlapping ranges so no second appears twice.
  const overlapping = RESULT.filter((r) => start < r.end && end > r.start);
  if (overlapping.length) {
    start = Math.min(start, ...overlapping.map((r) => r.start));
    end = Math.max(end, ...overlapping.map((r) => r.end));
    title = title || overlapping[0].title;
    RESULT = RESULT.filter((r) => !overlapping.includes(r));
  }

  RESULT.push({
    id: `r${++resultSeq}`,
    start, end,
    title: title || `Clip ${RESULT.length + 1}`,
    source: source || "manual",
  });
  RESULT.sort((a, b) => a.start - b.start);
  renderResult();
  return null;
}

function removeFromResult(id) {
  RESULT = RESULT.filter((r) => r.id !== id);
  renderResult();
}

function clearResult() {
  RESULT = [];
  renderResult();
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
  };
}

/* ---------- rendering ---------- */

/* Every Result change flows through here -- add, remove, clear. The save trigger
   is wired here, not in every caller: one missed caller means work silently lost,
   and that's the most annoying kind of failure. Saves are debounced so redundant
   calls from screen switches don't become a burden. */
function renderResult() {
  if (typeof saveProject === "function") saveProject();
  const list = $("#resultList");
  const total = $("#resultTotal");
  if (!list) return;

  if (!RESULT.length) {
    list.innerHTML = `<p class="empty-message">Result is empty. Pick a suggestion above, or
      select a range yourself on the timeline.</p>`;
    if (total) total.textContent = "empty";
    const clr = $("#resultClearBtn"); if (clr) clr.disabled = true;
    const btn = $("#resultRenderBtn"); if (btn) btn.disabled = true;
    const quickPreviewBtn = $("#previewCepatBtn"); if (quickPreviewBtn) quickPreviewBtn.disabled = true;
    const summaryEl = $("#resultSummary"); if (summaryEl) summaryEl.textContent = "";
    if (typeof setResultAsPreview === "function") setResultAsPreview();
    if (typeof drawTotalTimeline === "function") drawTotalTimeline();
  if (typeof renderCaptions === "function") renderCaptions();
    return;
  }

  list.innerHTML = RESULT.map((r, i) => `
    <div class="result-row" data-result="${r.id}">
      <span class="num">${i + 1}</span>
      <span class="result-title">${escapeHTML(r.title)}</span>
      <span class="data result-time">${timeRange(r.start)} – ${timeRange(r.end)}</span>
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
  const btn = $("#resultRenderBtn"); if (btn) btn.disabled = false;
  const quickPreviewBtn = $("#previewCepatBtn"); if (quickPreviewBtn) quickPreviewBtn.disabled = false;
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

function renderRecommendations() {
  const list = $("#recList");
  const note = $("#recNote");
  if (!list) return;
  const candidates = (DATA?.candidates) || [];

  // The list can change entirely (re-import from Claude) while the preview
  // still points to the old index -- close it first so it doesn't point to
  // the wrong recommendation after re-rendering.
  if (typeof closeRecPreview === "function") closeRecPreview();

  if (!candidates.length) {
    list.innerHTML = `<p class="empty-message">No suggestions yet. Import Claude's JSON on the
      Analyze screen, or just select a range on the timeline.</p>`;
    if (note) note.textContent = "none yet";
    const b = $("#recAddBtn"); if (b) b.disabled = true;
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
        <input type="text" class="rec-time-in" value="${shortTime(k.startSec)}"
               data-idx="${i}" data-field="startSec" size="5" spellcheck="false" disabled
               aria-label="Start time for ${escapeHTML(k.title)}">
        <span aria-hidden="true">–</span>
        <input type="text" class="rec-time-in" value="${shortTime(k.endSec)}"
               data-idx="${i}" data-field="endSec" size="5" spellcheck="false" disabled
               aria-label="End time for ${escapeHTML(k.title)}">
        <button class="rec-edit" type="button" data-edit-time="${i}"
                title="Edit time" aria-label="Edit time for ${escapeHTML(k.title)}">✎</button>
      </span>
      <span class="data rec-dur">${k.dur}s</span>
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
  if (titleEl) titleEl.textContent = `${shortTime(k.startSec)} – ${shortTime(k.endSec)} · ${k.title}`;

  previewIdx = idx;
  previewLimit = k.endSec;
  updateRecPlayIcon();

  const startPlayback = () => {
    try { v.currentTime = k.startSec; } catch { /* metadata not ready yet */ }
    v.play().catch(() => {});
  };
  // `v.src` is ALWAYS an absolute URL once read back -- the browser resolves
  // it itself -- while chosenSource.url is relative ("/workspace/samples/...").
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
      inputs.forEach((inp) => { inp.disabled = true; });
      edit.textContent = "✎";
      edit.title = "Edit time";
      edit.removeAttribute("data-editing");
      edit.setAttribute("aria-label", `Edit time for ${title}`);
    } else {
      inputs.forEach((inp) => { inp.disabled = false; });
      startInput.focus();
      startInput.select();
      edit.textContent = "✓";
      edit.title = "Save time";
      edit.setAttribute("data-editing", "true");
      edit.setAttribute("aria-label", `Save time for ${title}`);
    }
    return;
  }
  const btn = e.target.closest(".rec-play");
  if (!btn) return;
  e.preventDefault();       // prevent accidentally toggling the row's checkbox
  playRecPreview(Number(btn.dataset.play));
});

/* Correcting a single recommendation's time. The `label` wraps both the
   checkbox AND these two columns -- clicking the text toggles the row
   (default <label> behavior), but clicking an input keeps focus on the
   input without toggling; that's standard browser behavior for nested
   form controls, not something that needs manual handling here.

   The value is also snapped to the nearest word boundary (snapToWord),
   same as manual selection on the timeline -- one cutting rule applies
   everywhere. */
$("#recList")?.addEventListener("change", (e) => {
  const inp = e.target.closest(".rec-time-in");
  if (!inp) return;
  const idx = Number(inp.dataset.idx);
  const field = inp.dataset.field;
  const k = (DATA?.candidates || [])[idx];
  if (!k) return;

  const revert = () => { inp.value = shortTime(k[field]); };
  const raw = parseTime(inp.value);
  if (raw === null) { revert(); return; }
  const snapped = (typeof snapToWord === "function")
    ? snapToWord(raw, field === "startSec" ? "start" : "end")
    : raw;

  const other = field === "startSec" ? k.endSec : k.startSec;
  if (field === "startSec" ? snapped >= other : snapped <= other) { revert(); return; }

  k[field] = snapped;
  k.dur = Math.round(k.endSec - k.startSec);
  // Keep spans/in/out in sync: otherwise code that reads k.spans
  // (render, preview) or k.in/k.out (display) still uses the old range.
  k.spans = [{ start: k.startSec, end: k.endSec }];
  if (typeof shortTime === "function") {
    k.in = shortTime(k.startSec);
    k.out = shortTime(k.endSec);
  }
  inp.value = shortTime(snapped);
  const rowEl = inp.closest(".rec-row");
  const durEl = rowEl?.querySelector(".rec-dur");
  if (durEl) durEl.textContent = `${k.dur}s`;
  // The thin marker on the total timeline is drawn from k.startSec/endSec --
  // redraw so it moves along, rather than staying at the old position until
  // the next redraw.
  if (typeof drawTotalTimeline === "function") drawTotalTimeline();
});

function updateRecButton() {
  const b = $("#recAddBtn");
  if (!b) return;
  const n = document.querySelectorAll("#recList input:checked").length;
  b.disabled = n === 0;
  b.textContent = n ? `Add ${n} to Result` : "Add to Result";
}

/* ---------- events ---------- */

$("#recList")?.addEventListener("change", updateRecButton);

$("#recAddBtn")?.addEventListener("click", () => {
  const selected = [...document.querySelectorAll("#recList input:checked")];
  const candidates = DATA.candidates || [];
  let rejectedCount = 0;
  for (const c of selected) {
    const k = candidates[Number(c.dataset.rec)];
    if (!k) continue;
    if (addToResult(k.startSec, k.endSec, k.title, "ai")) rejectedCount++;
    c.checked = false;
  }
  updateRecButton();
  if (rejectedCount) {
    $("#editNote").textContent = `${rejectedCount} suggestion${rejectedCount > 1 ? "s" : ""} skipped — invalid timing`;
  }
});

$("#resultList")?.addEventListener("click", (e) => {
  const b = e.target.closest("[data-delete-result]");
  if (b) removeFromResult(b.dataset.deleteResult);
});

$("#resultClearBtn")?.addEventListener("click", clearResult);

/* New video = result is also cleared, like an object list. */
function resetResult() {
  RESULT = [];
  resultSeq = 0;
  renderResult();
  renderRecommendations();
}

/* Render: the entire result becomes ONE file. */
$("#resultRenderBtn")?.addEventListener("click", () => {
  const clip = resultAsClip();
  if (!clip) return;
  if (typeof sendRender === "function") sendRender([clip]);
});

/* Manual path starts on the Klip screen: the timeline is there. */
$("#manualClip")?.addEventListener("click", () => toScreen("klip"));
