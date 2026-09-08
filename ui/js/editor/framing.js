/* klipian -- framing over time
   ==========================================================================
   Framing is no longer a "per-person object" installed per clip. That model
   assumed each person sits in a fixed position, yet podcast cuts frequently
   change angle: the same person can be on the left now and in the center a
   minute later.

   Framing is now a LIST OF POINTS along the video:

       00:00  Single, box centered
       05:12  Split, left on top right on bottom
       07:40  Single, box to the right

   The rule in one sentence: one point is valid until the next point, and
   the transition is a hard cut -- no gradual shift.

   Each point has its own FORMAT:

     single  one box filling the full 9:16 frame
     split   two boxes stacked top-bottom, each half height,
             for moments when two people sit far apart but both need
             to be visible

   The box can be freely moved and resized, but its RATIO is LOCKED:
   widening the box also raises its height. A box whose ratio does not
   match its target cell will only produce a squished image.

   Usage is also one sentence: scrub the preview to the moment you want,
   pick the format, drag the box onto the person, press "Lock framing here".

   The canvas displays the ORIGINAL video frame at that position, not a
   sample image -- otherwise you would be framing something you cannot see.
   ========================================================================== */

const INITIAL_CROP = { left: 37, top: 8, width: 26, height: 84 };

/* Two side-by-side boxes as the initial split point: left becomes the top
   half, right becomes the bottom half. Height already follows the 9:8 ratio. */
const INITIAL_SPLIT_CROP = [
  { left: 4,  top: 17, width: 42, height: 66 },
  { left: 54, top: 17, width: 42, height: 66 },
];

/* Box height = width x ratio, computed in canvas pixels.
   single: target cell 1080x1920 -> 16/9 times the width.
   split : each cell 1080x960   ->  8/9 times the width. */
const RATIO = { single: 16 / 9, split: 8 / 9 };

let FRAMING = [];          // [{ id, at, format, crops }] sorted by `at`
let framingSeq = 0;

const cropEls = () => [...document.querySelectorAll(".canvas .crop")];

/* Format currently displayed on the canvas. */
let canvasFormat = "single";

/* The point valid at a given second: the last point whose `at` has not
   passed that second yet. */
function pointAt(seconds) {
  let result = FRAMING[0] || null;
  for (const f of FRAMING) {
    if (f.at <= seconds + 0.001) result = f;
    else break;
  }
  return result;
}

/* Linearly interpolated X position along the head-tracking path at
   second `t` (relative to the start of the point, same unit as `keyframes[].t`).
   Outside the first/last keyframe range -> clamped to the endpoint
   (not extrapolated), just like track_head() in facebox.py
   holds position beyond truly measured samples. */
function interpolatePath(keyframes, t) {
  if (!keyframes?.length) return null;
  if (t <= keyframes[0].t) return keyframes[0].left;
  const last = keyframes[keyframes.length - 1];
  if (t >= last.t) return last.left;
  for (let i = 1; i < keyframes.length; i++) {
    if (t <= keyframes[i].t) {
      const a = keyframes[i - 1], b = keyframes[i];
      const frac = (t - a.t) / (b.t - a.t || 1);
      return a.left + (b.left - a.left) * frac;
    }
  }
  return last.left;
}

/* The frame shape valid at that second, always complete: format and
   box list. The caller does not need to know whether FRAMING is empty.

   If the valid point has `tracking` (head tracking, OPTIONAL --
   see the "Track head" button), the X of the FIRST box is overridden by
   the interpolated path -- it no longer stays at the base-box position.
   Only Single format is supported (v1); Y/width/height still follow the
   base box as usual, matching the existing "track X only" rule in
   facebox.py. */
function frameAt(seconds) {
  const f = pointAt(seconds);
  const format = f ? f.format : "single";
  let crops = f ? f.crops : [INITIAL_CROP];
  if (f?.tracking?.keyframes?.length >= 2 && format === "single") {
    const left = interpolatePath(f.tracking.keyframes, seconds - f.at);
    if (left !== null) crops = [{ ...crops[0], left }];
  }
  // Ratio is matched HERE, not just when drawing. The previous version
  // corrected the box on the canvas but sent raw default values to
  // ffmpeg -- the preview looked right while the output file was stretched.
  return { format, crops: crops.map((c) => matchRatio(c, format)) };
}

/* Playback position currently being reviewed, in SOURCE seconds. */
function reviewTime() {
  const v = $("#videoPreview");
  if (v && v.src && Number.isFinite(v.currentTime)) return v.currentTime;
  if (typeof activeClip !== "undefined" && activeClip?.spans?.length)
    return activeClip.spans[0].start;
  return 0;
}

function resetFraming() {
  FRAMING = [];
  framingSeq = 0;
  // `at: 0` here is just a placeholder -- this runs before the new Result
  // has any span, so the clip's real source start isn't known yet. `auto:
  // true` marks it as still that placeholder; setClip() (player.js) relocates
  // it to the clip's actual start as soon as a span exists, so its thumbnail
  // (see renderFraming()) shows a frame from THIS clip instead of always
  // source 00:00 (frame 0 of the whole source video, ian: "always the same
  // thumbnail no matter which clip"). The flag is dropped the moment the
  // user manually edits this point (lock/format toggle), so a deliberate
  // "yes I really want this point at 00:00" is never overridden.
  FRAMING.push({ id: `f${++framingSeq}`, at: 0, format: "single",
                 crops: [{ ...INITIAL_CROP }], auto: true });
  renderFraming();
}

/* ---------- splitting spans at framing-point boundaries ----------
   This is what makes framing change mid-clip: one range is split into
   multiple pieces, each with its own frame. The render engine stitches
   them back into a single video.

   Split pieces carry `crops` (two boxes); normal pieces carry `crop`
   (one box). The server distinguishes the two by field name. */
function spansWithFraming(ranges) {
  const out = [];
  for (const r of ranges) {
    const bounds = [r.start];
    for (const f of FRAMING) {
      if (f.at > r.start + 0.05 && f.at < r.end - 0.05) bounds.push(f.at);
    }
    bounds.push(r.end);
    for (let i = 0; i < bounds.length - 1; i++) {
      const b = frameAt(bounds[i]);
      const piece = { start: bounds[i], end: bounds[i + 1] };
      if (b.format === "split" && b.crops.length >= 2) piece.crops = b.crops;
      else piece.crop = b.crops[0];
      // Keyframes are stored relative to the POINT START (f.at), but render.py
      // needs them relative to the start of THIS PIECE (bounds[i]) -- the two
      // differ when the point is locked before the start of this Result range.
      // Shifted + clamped here, same as _shift_tracking() in server.py for the
      // quick preview trimmed from the front.
      const point = pointAt(bounds[i]);
      if (b.format === "single" && point?.tracking?.keyframes?.length >= 2) {
        const shifted = point.tracking.keyframes
          .map((kf) => ({ t: round3(kf.t - (bounds[i] - point.at)), left: kf.left }))
          .filter((kf) => kf.t >= 0);
        if (shifted.length >= 2) piece.tracking = shifted;
      }
      out.push(piece);
    }
  }
  return out;
}

const round3 = (n) => Math.round(n * 1000) / 1000;

/* ---------- drawing ---------- */

/* Box height is derived from its WIDTH and the actual canvas ratio,
   not from a default value. Height percentage for same-shaped boxes
   differs between 16:9 and 4:3 sources, and a box whose shape misses
   its target cell will produce a stretched image when scaled by ffmpeg.

   If the height would exceed the bottom edge, reduce the width --
   not the height, because that would break the ratio. */
function sourceRatio() {
  for (const sel of ["#canvasVideo", "#videoPreview"]) {
    const v = $(sel);
    if (v?.videoWidth && v?.videoHeight) return v.videoWidth / v.videoHeight;
  }
  return 16 / 9;
}

function matchRatio(crop, format) {
  const baseRatio = sourceRatio();
  let width = crop.width;
  let height = width * baseRatio * RATIO[format];
  if (crop.top + height > 100) {
    height = 100 - crop.top;
    width = height / (baseRatio * RATIO[format]);
  }
  return { ...crop, width, height };
}

function applyCrop(el, p) {
  if (!el || !p) return;
  el.style.left = `${p.left}%`;
  el.style.top = `${p.top}%`;
  el.style.width = `${p.width}%`;
  el.style.height = `${p.height}%`;
}

function readCrop(el, canvas) {
  const r = el.getBoundingClientRect();
  const k = canvas.getBoundingClientRect();
  return {
    left: ((r.left - k.left) / k.width) * 100,
    top: ((r.top - k.top) / k.height) * 100,
    width: (r.width / k.width) * 100,
    height: (r.height / k.height) * 100,
  };
}

/* The framing canvas and preview are the SAME video position, displayed
   multiple times: the canvas shows the full frame (for choosing the frame),
   the preview shows the result after cropping and framing. In split format,
   the preview's bottom cell has its own video -- a single <video> element
   cannot display two different crops at once.

   Everything must run in sync. Previously the canvas was only seeked when
   renderFraming() happened to be called, so it froze while the preview
   played -- and you were framing a frame that was not the one being played.

   Thresholds differ by state: when paused it must be exact (you are
   stepping frame by frame), when playing it may drift slightly so it does
   not stutter from constant seeking. */

const followTarget = new WeakMap();   // element -> last target position

function followPreview(el) {
  const v = $("#videoPreview");
  if (!el || !v) return;
  if (v.src && el.src !== v.src) el.src = v.src;
  if (!el.src) return;

  // A newly installed video cannot be seeked yet; the seek request to it
  // is silently dropped and the element falls far behind the preview.
  // Therefore the sync is retried once it is ready.
  if (el.readyState < 1) {
    el.addEventListener("loadedmetadata", () => followPreview(el), { once: true });
    return;
  }
  // Canvas is locked to its source ratio. Without this the canvas ratio is
  // merely a side effect of layout; once it differs from the video,
  // object-fit:cover silently crops and box percentages no longer point to
  // the same part of the frame.
  if (el.id === "canvasVideo" && el.videoWidth && el.videoHeight) {
    const canvas = document.querySelector(".canvas");
    const ratio = `${el.videoWidth} / ${el.videoHeight}`;
    if (canvas && canvas.style.aspectRatio !== ratio) {
      canvas.style.aspectRatio = ratio;
    }
  }
  const t = v.src ? v.currentTime : reviewTime();
  const threshold = v.paused ? 0.02 : 0.20;

  // Target position is stored, not just requested once. If the previous
  // jump has not finished, the new request can be swallowed by the browser --
  // and the element stops at the old position. With a stored target, the
  // LAST request always wins, and is re-applied when the jump finishes.
  followTarget.set(el, t);
  if (!el.seeking && Math.abs(el.currentTime - t) > threshold) {
    try { el.currentTime = t; } catch { /* out of range */ }
  }
  // Play/pause in sync with the preview.
  if (!v.paused && el.paused) el.play().catch(() => {});
  else if (v.paused && !el.paused) el.pause();
}

/* Once a jump finishes, re-apply the last target position if it has
   drifted out of sync. */
function attachCatchUp(el) {
  el?.addEventListener("seeked", () => {
    const v = $("#videoPreview");
    const target = followTarget.get(el);
    if (!v || !v.src || target === undefined) return;
    const threshold = v.paused ? 0.02 : 0.20;
    if (Math.abs(el.currentTime - target) > threshold) {
      try { el.currentTime = target; } catch { /* out of range */ }
    }
  });
}
attachCatchUp($("#canvasVideo"));
attachCatchUp($("#videoPreview2"));

function syncCanvasVideo() {
  followPreview($("#canvasVideo"));
  // Bottom-cell video only needs to follow when it is actually used. Letting
  // it play silently during single format just wastes the decoder.
  if (canvasFormat === "split") followPreview($("#videoPreview2"));
  else $("#videoPreview2")?.pause();
}

// Separated from renderFraming() so it can be called on EVERY timeupdate tick --
// renderFraming() redraws the entire point thumbnail strip (expensive), so it is
// only called when the active point actually changes.
// Without this separate function, the time label would only update when the
// playhead crosses a framing point, not every second of playback -- it would
// look "frozen" during playback when in fact it is simply redrawn infrequently.
function updateFramingClock() {
  const clockEl = $("#framingClock");
  if (clockEl) clockEl.textContent = `at ${timeRange(reviewTime())}`;
}

/* The Framing Points strip can be wider than its panel and scrolled
   horizontally (many points on a long video). Without this, the point
   that becomes active during playback can end up OUTSIDE the visible area
   -- its state is correct (fr-active has moved), but to the user it looks
   like it is stuck on the last point they clicked, because the active one
   never scrolls into view. */
function followActivePoint(f) {
  const bar = $("#framingList");
  const el = f && bar?.querySelector(`[data-framing="${f.id}"]`);
  if (!bar || !el) return;
  const target = el.offsetLeft - (bar.clientWidth - el.clientWidth) / 2;
  bar.scrollTo({ left: Math.max(0, target), behavior: "smooth" });
}

function renderFraming() {
  if (!FRAMING.length) resetFraming();
  const t = reviewTime();
  const active = pointAt(t);

  // Message is NOT written here: renderFraming is called after actions like
  // "lock", and writing to it would immediately clear the confirmation that
  // just appeared. The caller decides the message.
  updateFramingClock();
  const tag = $("#tagCrop1");
  if (tag) tag.textContent = active ? `from ${timeRange(active.at)}` : "";

  const bar = $("#framingList");
  if (bar) {
    // f.at is a position in the FULL SOURCE VIDEO (00:00 = start of a 42-min
    // video), not in the concatenated result -- when a Result consists of
    // several spans far apart in the source, a point can appear to "jump"
    // beyond the Result's own duration (e.g. "09:44" when the Result is only
    // 3:14). That is not a bug -- it is the true source position -- but it is
    // confusing without context. "out h:mm" in the tooltip shows that SAME
    // position relative to the concatenated result, when the point falls
    // within one of the actually used spans (null when outside any span --
    // a stale point from another clip, or the default 00:00 point).
    const outFrom = (t) => (typeof activeClip !== "undefined" && activeClip?.spans
      && typeof sourceToOut === "function") ? sourceToOut(activeClip, t) : null;

    // Every point ALWAYS gets its own thumbnail, no matter how close in time
    // to its neighbors -- the strip is a row (flex), not positioned
    // proportionally on a single fixed-width bar. When there are many points,
    // the strip itself widens and may be scrolled horizontally (see
    // overflow-x in CSS .framing-timeline) -- NOT the thumbnails shrunk or
    // some points turned into ticks without images.
    bar.innerHTML = FRAMING.map((f, i) => {
      const out = outFrom(f.at);
      // BIG number = position in the RESULT being edited (what people actually
      // see in the right preview panel) -- that is the directly meaningful
      // one, not the position in the 42-minute source video. The source is
      // still shown (smaller, below) for context/jump-back, not discarded --
      // it just is no longer the PRIMARY number so it won't be mistaken for
      // the Result position (exactly the confusion ian reported: point "07:58"
      // on a 1:25 Result looks out of range, when it is actually the true
      // source position, not a bug).
      const tooltip = `${f.format === "split" ? "Split" : "Single"} · source ${timeRange(f.at)}`;
      const thumbUrl = f.crops?.[0] && typeof chosenSource !== "undefined" && chosenSource?.name
        ? `/api/thumb?video=${encodeURIComponent(chosenSource.name)}&t=${f.at}`
          + `&left=${f.crops[0].left}&top=${f.crops[0].top}`
          + `&width=${f.crops[0].width}&height=${f.crops[0].height}&w=96`
        : "";
      return `
      <div class="fr-point${f === active ? " fr-active" : ""}"
           data-framing="${f.id}" title="${tooltip}">
        ${thumbUrl ? `<img class="fr-thumb" src="${thumbUrl}" alt="" loading="lazy">`
                    : `<span class="fr-thumb fr-thumb-empty"></span>`}
        ${f.tracking ? `<span class="fr-track-badge" title="Head tracking on">●</span>` : ""}
        <span class="fr-time">${out !== null ? timeRange(out) : "—"}</span>
        <span class="fr-time-src">src ${timeRange(f.at)}</span>
        ${i > 0 ? `<i class="delete-icon" data-delete-framing="${f.id}" role="button"
              aria-label="Delete point ${timeRange(f.at)}">×</i>` : ""}
      </div>`;
    }).join("");
  }

  const frame = frameAt(t);
  drawBox(frame.format, frame.crops);
  syncCanvasVideo();
  if (typeof attachVideoGeometry === "function") attachVideoGeometry();
  updateTrackHeadButton();
}

/* Place boxes on the canvas per format. The second box only matters in
   split; in single format it is hidden via data-format on the canvas. */
function drawBox(format, crops) {
  canvasFormat = format === "split" ? "split" : "single";
  const canvas = document.querySelector(".canvas");
  if (canvas) canvas.dataset.format = canvasFormat;
  // Preview is told too: the bottom slot only exists in split.
  const previewFrame = $("#frame");
  if (previewFrame) previewFrame.dataset.format = canvasFormat;

  const els = cropEls();
  applyCrop(els[0], matchRatio(crops[0] || INITIAL_CROP, canvasFormat));
  // The second box always has the split ratio -- it's only ever used in that format.
  applyCrop(els[1], matchRatio(crops[1] || INITIAL_SPLIT_CROP[1], "split"));

  document.querySelectorAll("[data-format-choice]").forEach((b) =>
    b.setAttribute("aria-pressed", String(b.dataset.formatChoice === canvasFormat)));
}

/* Copies the box from the canvas to the currently active point. Called
   continuously while dragging, not just on release: the preview computes
   its frame from the NUMBERS in FRAMING, so if the numbers were only
   written on pointer-up, the preview would stay frozen through the whole drag. */
function saveBox() {
  const f = pointAt(reviewTime());
  const crops = boxOnCanvas();
  if (!f || !crops) return null;
  f.format = canvasFormat;
  f.crops = crops;
  return f;
}

/* The box currently drawn on the canvas, read back out as numbers. */
function boxOnCanvas() {
  const canvas = document.querySelector(".canvas");
  if (!canvas) return null;
  const els = cropEls();
  const n = canvasFormat === "split" ? 2 : 1;
  const out = [];
  for (let i = 0; i < n; i++) {
    if (!els[i]) return null;
    const geo = readCrop(els[i], canvas);
    if (!Number.isFinite(geo.width) || geo.width <= 0) return null;
    out.push(geo);
  }
  return out;
}

/* ---------- choosing a format ---------- */

/* Changing the format DIRECTLY creates a point at the currently reviewed
   position, instead of editing whatever point happens to be active.

   The first version edited the active point, and that destroyed work: you
   set up a split at 00:00, moved forward to 20:55, picked "Single" -- and
   the Split at 00:00 silently turned into Single too, no message at all.
   Yet the entire point of framing points is so the format CAN differ at
   different seconds.

   A point at the same second is overwritten, so toggling the format back
   and forth doesn't stack up points. */
$("#framingFormat")?.addEventListener("click", (e) => {
  const b = e.target.closest("[data-format-choice]");
  if (!b) return;
  const format = b.dataset.formatChoice;
  const t = Math.max(0, reviewTime());
  const existing = FRAMING.find((f) => Math.abs(f.at - t) < 0.35);
  if (format === canvasFormat && existing) return;

  // The box starts from that format's default layout -- single and split
  // box ratios differ, so reusing the old box would just produce a
  // squashed image.
  const crops = format === "split"
    ? INITIAL_SPLIT_CROP.map((c) => ({ ...c }))
    : [{ ...INITIAL_CROP }];

  let message;
  if (existing) {
    existing.format = format;
    existing.crops = crops;
    delete existing.auto;   // manually touched -- stop auto-relocating it
    message = `point ${timeRange(existing.at)} is now`;
  } else {
    FRAMING.push({ id: `f${++framingSeq}`, at: t, format, crops });
    FRAMING.sort((a, b2) => a.at - b2.at);
    message = `new point at ${timeRange(t)},`;
  }
  renderFraming();
  $("#reframeNote").textContent = format === "split"
    ? `${message} Split · drag the top and bottom boxes onto each person`
    : `${message} Single · drag the box onto whoever is talking`;
});

/* ---------- lock, select, delete ---------- */

$("#lockFraming")?.addEventListener("click", () => {
  const crops = boxOnCanvas() || frameAt(reviewTime()).crops;
  const t = Math.max(0, reviewTime());

  // A point at the same second is overwritten, not duplicated.
  const existing = FRAMING.find((f) => Math.abs(f.at - t) < 0.35);
  let message;
  if (existing) {
    // The base box was replaced manually -- the OLD tracking path (if any)
    // is relative to the box's now-stale position, so it's dropped here
    // instead of being left hanging using an outdated position.
    // "Track head" needs to be pressed again if this point should still be tracked.
    delete existing.tracking;
    existing.format = canvasFormat;
    existing.crops = crops;
    delete existing.auto;   // manually touched -- stop auto-relocating it
    message = `point ${timeRange(existing.at)} updated`;
  } else {
    FRAMING.push({ id: `f${++framingSeq}`, at: t, format: canvasFormat, crops });
    FRAMING.sort((a, b) => a.at - b.at);
    message = `new point locked at ${timeRange(t)}`;
  }
  renderFraming();
  if (typeof saveProject === "function") saveProject();
  $("#reframeNote").textContent =
    `${message} · ${canvasFormat === "split" ? "Split" : "Single"}`;
});

/* ---------- head tracking (optional per point) ----------
   ian: the box moves to follow the head WITHIN one framing point --
   NOT a continuous pan across the video (klipian still hard-cuts BETWEEN
   points, unchanged). Optional per point, OFF by default -- turned on
   manually via this button only on points that actually need it (ian:
   "not every point needs it"). Only Single format is supported (v1) --
   see the note in frameAt()/track_head() (facebox.py) for why. */

/* The [point.at, end) range that gets analyzed -- up to the NEXT point
   if there is one, or up to the end of the Result span containing this
   point if it's the last point (not up to the end of the full source
   video -- that could be far longer than what's actually used). */
function trackingLimit(point) {
  const idx = FRAMING.indexOf(point);
  const next = FRAMING[idx + 1];
  if (next) return next.at;
  const span = (typeof activeClip !== "undefined" && activeClip?.spans || [])
    .find((s) => point.at >= s.start - 0.05 && point.at < s.end);
  return span ? span.end : point.at;
}

async function trackHeadForPoint(point) {
  if (point.tracking) {
    // Toggling off -- reverts to a static box, doesn't delete the
    // underlying box. Reversible, per ian's request.
    delete point.tracking;
    renderFraming();
    if (typeof saveProject === "function") saveProject();
    $("#reframeNote").textContent = `head tracking off for point ${timeRange(point.at)}`;
    return;
  }
  const end = trackingLimit(point);
  if (end - point.at < 0.5) {
    $("#reframeNote").textContent =
      "head tracking needs a longer gap to the next point (or clip end).";
    return;
  }
  const btn = $("#trackHeadBtn");
  if (btn) { btn.disabled = true; btn.textContent = "Tracking…"; }
  $("#reframeNote").textContent = "head tracking: analyzing head movement …";
  $("#headTrackOverlay")?.removeAttribute("hidden");
  try {
    const r = await fetch("/api/headtrack", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        video: chosenSource?.name, start: point.at, end, crop: point.crops[0],
      }),
    });
    const d = await r.json();
    if (!d.keyframes) {
      $("#reframeNote").textContent =
        `head tracking: ${d.error || "not enough tracking data"} — point stays static.`;
      return;
    }
    point.tracking = { keyframes: d.keyframes };
    renderFraming();
    if (typeof saveProject === "function") saveProject();
    $("#reframeNote").textContent = `head tracking on for point ${timeRange(point.at)}`;
  } catch {
    $("#reframeNote").textContent = "head tracking failed — point stays static.";
  } finally {
    if (btn) { btn.disabled = false; }
    $("#headTrackOverlay")?.setAttribute("hidden", "");
    updateTrackHeadButton();
  }
}

/* Button label/state follows the point CURRENTLY ACTIVE at the preview
   position (pointAt(reviewTime()), same as how renderFraming() determines
   the active point for the canvas) -- called from renderFraming() so it
   always stays in sync without needing to be called manually in many places. */
function updateTrackHeadButton() {
  const btn = $("#trackHeadBtn");
  if (!btn || btn.disabled) return;
  const point = pointAt(reviewTime());
  const canTrack = point && point.format === "single";
  btn.hidden = !canTrack;
  if (!canTrack) return;
  const active = !!point.tracking;
  btn.textContent = active ? "Tracking on" : "Track head";
  btn.setAttribute("aria-pressed", String(active));
  btn.title = active
    ? "Turn off head tracking for this point"
    : "Track head movement for this point only (optional, off by default)";
}

$("#trackHeadBtn")?.addEventListener("click", () => {
  const point = pointAt(reviewTime());
  if (point) trackHeadForPoint(point);
});

$("#framingList")?.addEventListener("click", (e) => {
  const deleteIcon = e.target.closest("[data-delete-framing]");
  if (deleteIcon) {
    e.stopPropagation();
    const id = deleteIcon.dataset.deleteFraming;
    if (FRAMING.length <= 1) return;              // the 00:00 point always exists
    FRAMING = FRAMING.filter((f) => f.id !== id);
    renderFraming();
    return;
  }
  const chip = e.target.closest("[data-framing]");
  if (!chip) return;
  $("#reframeNote").textContent = "drag the box onto whoever is talking, then lock it";
  // Clicking a point = jump to its second, so you can see what's being framed.
  const f = FRAMING.find((x) => x.id === chip.dataset.framing);
  if (!f) return;
  const v = $("#videoPreview");
  if (v && v.src) {
    try { v.currentTime = f.at; } catch { /* out of range */ }
  }
  renderFraming();
});

/* ---------- drag & resize box ---------- */

(function interactiveCrop() {
  const canvas = document.querySelector(".canvas");
  if (!canvas) return;
  let active = null;
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

  canvas.addEventListener("pointerdown", (e) => {
    const crop = e.target.closest(".crop");
    if (!crop) return;
    // The second box can't be touched in single format: it's simply not
    // rendered, so dragging it would only be misleading.
    if (canvasFormat !== "split" && cropEls().indexOf(crop) > 0) return;
    const k = canvas.getBoundingClientRect();
    const c = crop.getBoundingClientRect();
    active = { crop, k, resizing: e.target.tagName === "B",
               dx: e.clientX - c.left, dy: e.clientY - c.top,
               w0: c.width, h0: c.height };
    crop.setPointerCapture(e.pointerId);
    e.preventDefault();
  });

  canvas.addEventListener("pointermove", (e) => {
    if (!active) return;
    const { crop, k } = active;
    if (active.resizing) {
      // Ratio LOCKED: height is always width x format ratio. Width is what
      // gets clamped, not height -- if height were clamped on its own, the
      // box would go squashed and the rendered output would too.
      const ratio = RATIO[canvasFormat];
      const box = crop.getBoundingClientRect();
      const maxW = Math.min(k.right - box.left, (k.bottom - box.top) / ratio);
      const w = clamp(e.clientX - box.left, 40, Math.max(40, maxW));
      const h = w * ratio;
      crop.style.width = `${(w / k.width) * 100}%`;
      crop.style.height = `${(h / k.height) * 100}%`;
    } else {
      const x = clamp(e.clientX - k.left - active.dx, 0, k.width - active.w0);
      const y = clamp(e.clientY - k.top - active.dy, 0, k.height - active.h0);
      crop.style.left = `${(x / k.width) * 100}%`;
      crop.style.top = `${(y / k.height) * 100}%`;
    }
    saveBox();
    if (typeof attachVideoGeometry === "function") attachVideoGeometry();
  });

  ["pointerup", "pointercancel"].forEach((ev) =>
    canvas.addEventListener(ev, () => {
      if (!active) return;
      active = null;
      // A drag attaches directly to the currently active point. If you want
      // this position to start at a different second, press "Lock framing here".
      const f = saveBox() || pointAt(reviewTime());
      $("#reframeNote").textContent = f
        ? `point ${timeRange(f.at)} moved · press Lock to create a new point`
        : "drag the box onto whoever is talking, then lock it";
      if (typeof attachVideoGeometry === "function") attachVideoGeometry();
    }));
})();

/* ---------- AI Framing: speaker turns -> automatic framing points ----------
   The backend (klipian/diarize.py) only knows WHO is speaking and WHEN --
   it has no idea at all which box on the canvas should be used for that person.

   Fully automatic, NO per-speaker manual confirmation anymore. The previous
   version asked ian to drag one box onto each detected speaker before
   continuing -- for a 2-person podcast that's 2 clicks, but ian pointed out
   podcasts aren't always 2 people, so one-by-one confirmation became
   impractical once there were more speakers. Each speaker's position is now
   located on its own via locate_speaker() (klipian/facebox.py) -- NOT guided
   by a manual rough box like fit_crop_to_face/track_crops, but searching from
   scratch across (almost) the entire frame, guided by mouth motion across
   several samples within that speaker turn. The risk of mis-detection from
   such a broad search (this happened before facebox.py was rewritten -- see
   that module's docstring) is contained by requiring a CLEAR mouth-motion
   winner whenever there's more than one face, with no "sharpest" fallback --
   ambiguous samples are discarded, not guessed at.

   The source video itself can change shot mid-clip (zoom out to a close-up,
   cut to another person's reaction) even though the speaker hasn't changed
   -- diarization doesn't see that at all, it only hears audio. A SEPARATE
   signal handles that: klipian/scenecut.py detects hard visual cuts via
   ffmpeg's built-in scene filter, used to split one speaker turn into
   several tracking points (see aiFramingApply) so each real cut gets its
   own framing point, instead of just the point at the start of the turn
   gradually drifting off as the shot changes. */

/* AI Framing status (in progress, error, result) ALWAYS appears in the
   yellow #aiFramingStatus box, not just as small text in #reframeNote --
   that's exactly what got overlooked on the first attempt: the
   validation-failure message did appear, but only as plain text crammed
   in with other elements on the title row, looking like "nothing happened". */
function aiFramingStatus(text) {
  const textEl = $("#aiFramingStatusText");
  if (textEl) textEl.textContent = text;
  $("#aiFramingStatus")?.removeAttribute("hidden");
}

/* Only replace the <span> text content inside the #aiFramingBtn button --
   NOT btn.textContent directly, that would also wipe out its SVG icon
   (see the markup in index.html). */
function aiFramingBtnText(text) {
  const el = $("#aiFramingBtnText");
  if (el) el.textContent = text;
}

/* Overlay ON TOP of the 9:16 preview panel, separate from the status box
   in the sidebar (aiFramingStatus) -- the server can work for tens of
   seconds (diarization etc.), and without this overlay the preview would
   look frozen as if stuck, not like it's being analyzed.

   Percent is computed from FIXED WEIGHTS per pipeline stage (diarize/
   scenecut/locate/apply), not from "done divided by total" where the
   total is only known later (speaker count is only certain after diarize,
   segment count only certain after locate) -- computed that way, the
   number could jump BACKWARD exactly when that total changes. With fixed
   weights, each stage only fills its own share, so the bar always moves
   forward. */
const AI_FRAMING_WEIGHT = { diarize: 40, scenecut: 10, locate: 30, apply: 20 };
const AI_FRAMING_OFFSET = {
  diarize: 0,
  scenecut: AI_FRAMING_WEIGHT.diarize,
  locate: AI_FRAMING_WEIGHT.diarize + AI_FRAMING_WEIGHT.scenecut,
  apply: AI_FRAMING_WEIGHT.diarize + AI_FRAMING_WEIGHT.scenecut + AI_FRAMING_WEIGHT.locate,
};

function aiFramingOverlayStart() {
  $("#aiFramingOverlay")?.removeAttribute("hidden");
  aiFramingOverlayProgress("diarize", 0, 1, "Analyzing…");
}

function aiFramingOverlayDone() {
  $("#aiFramingOverlay")?.setAttribute("hidden", "");
}

/* `done`/`total` are position WITHIN that stage only (e.g. which span
   out of how many spans), not across the whole pipeline -- the stage's
   offset is what translates that into an overall percentage. */
function aiFramingOverlayProgress(stage, done, total, text) {
  const withinStage = total > 0 ? done / total : 0;
  const pct = Math.min(100, Math.round(AI_FRAMING_OFFSET[stage] + withinStage * AI_FRAMING_WEIGHT[stage]));
  const bar = $("#aiFramingOverlayBar");
  const pctEl = $("#aiFramingOverlayPct");
  const textEl = $("#aiFramingOverlayText");
  if (bar) bar.style.width = `${pct}%`;
  if (pctEl) pctEl.textContent = `${pct}%`;
  if (textEl && text) textEl.textContent = text;
}

/* One request to the server, wrapped in a Promise so it can be `await`ed
   inside a loop -- see aiFramingStart() for why the loop exists. */
function aiFramingDiarizeOneSpan(span) {
  return fetch("/api/diarize", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ video: chosenSource?.name, start: span.start, end: span.end }),
  })
    .then((r) => r.json())
    .then((d) => {
      if (d.error) throw new Error(d.error);
      return aiFramingPollPromise(d.id);
    });
}

function aiFramingPollPromise(id) {
  return new Promise((resolve, reject) => {
    (function check() {
      fetch(`/api/diarize/${id}`).then((r) => r.json()).then((d) => {
        if (d.state === "running") { setTimeout(check, 1500); return; }
        if (d.state === "failed") { reject(new Error(d.error || "Diarization failed.")); return; }
        resolve(d.turns || []);
      }).catch(reject);
    })();
  });
}

/* Hard visual cuts within one span -- an ADDITIONAL signal, not required.
   Fails silently (old ffmpeg build without the scene filter, or whatever
   else) by returning an empty array instead of throwing -- AI Framing that
   already succeeded from diarization must not fail just because this
   extra piece stumbled. */
function aiFramingScenecutOneSpan(span) {
  return fetch("/api/scenecut", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ video: chosenSource?.name, start: span.start, end: span.end }),
  })
    .then((r) => r.json())
    .then((d) => d.cuts || [])
    .catch(() => []);
}

async function aiFramingStart() {
  if (!activeClip || !activeClip.spans?.length) {
    aiFramingStatus("Select or add a clip to Result first.");
    return;
  }
  // A Result can be SEVERAL separate spans stitched into one MP4 (merging
  // several AI recommendations, for example). This used to just take from
  // the start of the FIRST span to the end of the LAST span -- for a
  // Result with 4 spans far apart in the source video, that meant also
  // analyzing the ENTIRE range in between, including parts that never made
  // it into the Result at all. Slow, and produced framing points scattered
  // into irrelevant parts of the video. Now each span is analyzed
  // SEPARATELY, only its actual range.
  const spans = activeClip.spans;

  const btn = $("#aiFramingBtn");
  if (btn) { btn.disabled = true; aiFramingBtnText("Analyzing …"); }
  aiFramingOverlayStart();

  // Sequential, NOT parallel: all spans share the same single diarization
  // model on the server (one instance loaded once, reused so it doesn't
  // wait ten-plus seconds reloading every time) -- two simultaneous
  // requests to the same model risk contention/garbled results.
  const allTurns = [];
  try {
    for (let i = 0; i < spans.length; i++) {
      aiFramingStatus(spans.length > 1
        ? `AI Framing: listening for who's talking … (span ${i + 1}/${spans.length})`
        : "AI Framing: listening for who's talking … (usually 25–35s per clip)");
      aiFramingOverlayProgress("diarize", i, spans.length,
        spans.length > 1 ? `Listening (span ${i + 1}/${spans.length})…` : "Listening for who's talking…");
      const turns = await aiFramingDiarizeOneSpan(spans[i]);
      allTurns.push(...turns);
      aiFramingOverlayProgress("diarize", i + 1, spans.length);
    }
  } catch (err) {
    aiFramingFailed(err.message);
    return;
  }

  // Hard visual cuts in the source video -- looked up AFTER diarization
  // (not in the same loop at once) so that if this fails/is slow it
  // doesn't mess up the speaker-turn progress messages above. A per-span
  // failure silently becomes an empty array (see aiFramingScenecutOneSpan)
  // -- this is supplementary, AI Framing still works from diarization
  // alone if this comes back empty.
  aiFramingStatus(spans.length > 1
    ? "AI Framing: checking for shot changes …"
    : "AI Framing: checking for shot changes … (usually a few seconds)");
  aiFramingOverlayProgress("scenecut", 0, spans.length, "Checking for shot changes…");
  const allCuts = [];
  for (let i = 0; i < spans.length; i++) {
    allCuts.push(...(await aiFramingScenecutOneSpan(spans[i])));
    aiFramingOverlayProgress("scenecut", i + 1, spans.length);
  }

  aiFramingFindAllPositions(allTurns, allCuts);
}

function aiFramingFailed(message) {
  const btn = $("#aiFramingBtn");
  if (btn) { btn.disabled = false; aiFramingBtnText("AI Framing"); }
  aiFramingStatus(`AI Framing failed: ${message}`);
  aiFramingOverlayDone();
}

/* OUTPUT box size for locate_speaker() -- taken from the box currently
   on the canvas (Single format) if there is one, so a size ian already
   adjusted (zoomed in/out) carries over instead of snapping back to the
   default size. Its position (left/top) is ignored here -- locate_speaker()
   determines the position from the face it finds, not from the box
   currently shown. */
function aiFramingOutputSize() {
  const box = canvasFormat === "single" ? boxOnCanvas() : null;
  const w = box?.[0];
  return {
    width: (w && Number.isFinite(w.width)) ? w.width : INITIAL_CROP.width,
    height: (w && Number.isFinite(w.height)) ? w.height : INITIAL_CROP.height,
  };
}

/* Automatically finds the position of ONE speaker from their first
   turn -- see locate_speaker() in klipian/facebox.py. Fails (no face
   passes the clear mouth-motion requirement) -> null; that speaker is
   skipped just like the old manual "Skip this speaker", instead of
   dropping AI Framing entirely. */
function aiFramingFindSpeaker(turn, size) {
  return fetch("/api/speakerlocate", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      video: chosenSource?.name, start: turn.start, end: turn.end, size,
    }),
  })
    .then((r) => r.json())
    .then((d) => d.crop || null)
    .catch(() => null);
}

async function aiFramingFindAllPositions(turns, cuts) {
  const btn = $("#aiFramingBtn");

  if (!turns.length) {
    if (btn) { btn.disabled = false; aiFramingBtnText("AI Framing"); }
    aiFramingStatus("AI Framing: no speech detected in this clip.");
    aiFramingOverlayDone();
    return;
  }

  // Each speaker's FIRST turn -- their position only needs to be found
  // once per person, not for every turn they speak.
  const firstTurn = new Map();
  for (const t of turns) if (!firstTurn.has(t.speaker)) firstTurn.set(t.speaker, t);
  const speakerList = [...firstTurn.entries()].sort((a, b) => a[1].start - b[1].start);

  const size = aiFramingOutputSize();
  aiFramingStatus(speakerList.length > 1
    ? `AI Framing: locating ${speakerList.length} speakers …`
    : "AI Framing: locating the speaker …");
  aiFramingOverlayProgress("locate", 0, speakerList.length,
    speakerList.length > 1 ? `Locating ${speakerList.length} speakers…` : "Locating the speaker…");

  // Parallel -- each search is independent (different video ranges), and
  // waiting one by one for many speakers could take needlessly long.
  // Progress still follows each search as it FINISHES (not only after
  // everything is done at once) -- each .then() here just rides along
  // the actual search, it does NOT change the result or Promise.all's order.
  let locateDone = 0;
  const results = await Promise.all(
    speakerList.map(([, turn]) => aiFramingFindSpeaker(turn, size).then((r) => {
      locateDone++;
      aiFramingOverlayProgress("locate", locateDone, speakerList.length);
      return r;
    })));

  const positions = {};
  speakerList.forEach(([speaker], i) => { if (results[i]) positions[speaker] = results[i]; });

  if (btn) { btn.disabled = false; aiFramingBtnText("AI Framing"); }

  if (!Object.keys(positions).length) {
    aiFramingStatus("AI Framing: couldn't confidently locate any speaker's face "
      + "(no clear mouth-motion winner) — try again, or set the frame manually.");
    aiFramingOverlayDone();
    return;
  }

  aiFramingApply(turns, positions, cuts);
}

/* The box tested here is ROUGH, just a person's general position (marked
   manually once at the reference Split point) -- being slightly off from
   the actual face is expected. Without correction, the points AI Framing
   produces would just copy that rough coordinate verbatim across the
   ENTIRE segment, and if the initial placement is a bit off, the result
   can end up highlighting an empty chair -- exactly the complaint this is
   meant to fix. So the [start, end) segment already split by
   aiFramingApply (per speaker turn, or smaller still if there's a visual
   cut inside it) is tracked via real face detection (klipian/facebox.py)
   to FIND the correct position -- track_crops() deliberately returns ONE
   point per call (the median position across many samples), not splitting
   further on its own based on face movement: the reason for a NEW point
   is already decided here (turn/cut), not by a sitting person's normal
   movement. Fails/video not ready yet -> falls back to a single rough-box
   point. */
async function aiFramingTrackFace(start, end, rough) {
  try {
    const r = await fetch("/api/facetrack", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ video: chosenSource?.name, start, end, crop: rough }),
    });
    const d = await r.json();
    return (d.points && d.points.length) ? d.points : [{ at: start, crop: rough }];
  } catch {
    return [{ at: start, crop: rough }];
  }
}

async function aiFramingApply(turns, positions, cuts) {
  const cutList = (cuts || []).slice().sort((a, b) => a - b);

  // Plan the list first, then run face tracking IN PARALLEL for all
  // turns -- if sequential, a clip with many speaker turns (e.g. 15
  // points) could take ten-plus seconds just waiting one by one.
  // The source video often changes shot BEFORE diarization is confident a
  // new speaker turn has officially started (the new person is visible
  // briefly before actually speaking) -- t.start coming from audio ends up
  // LATE compared to the video's own cut. Without this correction, the
  // rendered result appears to change frame TWICE: once from the actual
  // video cut, once more (late) when our framing finally catches up at
  // t.start (a real report from ian). 2 seconds was chosen as the
  // tolerance window -- enough for normal audio/visual offset, not so
  // much that it bleeds into an unrelated PREVIOUS turn.
  const START_TOLERANCE = 2;

  // Turns that actually need a point (known speaker & new compared to the
  // previous turn) -- collected BEFORE the cut logic so "previous turn"
  // below always means a turn that was ACTUALLY USED, not a raw turn that
  // may have been skipped.
  const selectedTurns = [];
  let previousSpeaker = null;
  for (const t of turns) {
    const rough = positions[t.speaker];
    if (!rough) continue;                          // a skipped speaker
    if (t.speaker === previousSpeaker) continue; // same speaker, no new point needed
    previousSpeaker = t.speaker;
    selectedTurns.push({ turn: t, rough });
  }

  // Stage 1 -- CLAIM: each turn may take ONE cut within the tolerance
  // window before its t.start as its real start. Processed first, separate
  // from the PREVIOUS-turn splitting stage below -- so a cut that actually
  // marks a change of PERSON doesn't get "eaten" as a splitter in the
  // MIDDLE of the old person's turn (a rough/wrong box if that happens).
  const claimedCuts = new Set();
  const turnStarts = selectedTurns.map(({ turn: t }) => {
    const candidate = cutList.find((c) => !claimedCuts.has(c)
      && c >= t.start - START_TOLERANCE && c <= t.start);
    if (candidate !== undefined) claimedCuts.add(candidate);
    return candidate !== undefined ? candidate : t.start;
  });

  // Stage 2 -- SPLIT: the source video itself can change shot IN THE
  // MIDDLE of one speaker turn (zoom out to a close-up, cut to another
  // person's reaction) even though the mic is still the same person --
  // diarization doesn't see that at all. A cut that falls within this
  // turn's range (and hasn't ALREADY been claimed by the next turn in
  // stage 1) splits it into several tracking points, so each real cut gets
  // its own framing point, instead of just the point at the start of the
  // turn gradually drifting off as the shot changes. This turn's end is
  // clamped to the NEXT turn's actual start (if earlier than its own
  // t.end) -- without this, a next turn that "steals back" time via a
  // Stage 1 claim would overlap with this turn's tail.
  const plan = [];
  let cutsUsed = 0;
  selectedTurns.forEach(({ turn: t, rough }, i) => {
    const actualStart = turnStarts[i];
    const actualEnd = (i + 1 < turnStarts.length)
      ? Math.min(t.end, turnStarts[i + 1]) : t.end;
    const cutsInTurn = cutList.filter((c) => !claimedCuts.has(c)
      && c > actualStart && c < actualEnd);
    let cursor = actualStart;
    for (const boundary of [...cutsInTurn, actualEnd]) {
      plan.push({ at: cursor, end: boundary, rough });
      cursor = boundary;
    }
    cutsUsed += cutsInTurn.length + (actualStart !== t.start ? 1 : 0);
  });

  if (!plan.length) {
    // Not a failure -- there's simply no turn that needs a box switch
    // (e.g. only one speaker throughout the clip). This used to be
    // reported as "0 points added", which looked like an error when
    // that's genuinely correct.
    aiFramingStatus("AI Framing: no switching needed for this clip.");
    aiFramingOverlayDone();
    return;
  }

  aiFramingStatus(
    `AI Framing: tracking ${plan.length} segment${plan.length === 1 ? "" : "s"} onto each face …`);
  aiFramingOverlayProgress("apply", 0, plan.length,
    `Tracking ${plan.length} segment${plan.length === 1 ? "" : "s"}…`);
  let applyDone = 0;
  const resultsPerTurn = await Promise.all(
    plan.map((r) => aiFramingTrackFace(r.at, r.end, r.rough).then((result) => {
      applyDone++;
      aiFramingOverlayProgress("apply", applyDone, plan.length);
      return result;
    })));

  let added = 0;
  for (const pointList of resultsPerTurn) {
    for (const point of pointList) {
      const crop = { ...point.crop };
      const existing = FRAMING.find((f) => Math.abs(f.at - point.at) < 0.35);
      if (existing) {
        existing.format = "single";
        existing.crops = [crop];
      } else {
        FRAMING.push({ id: `f${++framingSeq}`, at: point.at, format: "single", crops: [crop] });
        added++;
      }
    }
  }
  FRAMING.sort((a, b) => a.at - b.at);
  renderFraming();
  if (typeof saveProject === "function") saveProject();

  aiFramingStatus(
    `AI Framing: ${added} framing point${added === 1 ? "" : "s"} added across `
    + `${plan.length} segment${plan.length === 1 ? "" : "s"}, tracking each speaker's face`
    + (cutsUsed
        ? ` (${cutsUsed} shot change${cutsUsed === 1 ? "" : "s"} detected mid-turn). `
        : ". ")
    + "Review and adjust if needed.");
  aiFramingOverlayDone();
}

$("#aiFramingBtn")?.addEventListener("click", aiFramingStart);

resetFraming();
