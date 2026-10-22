/* klipian — preview player & render pipeline
   ==========================================================================
   Two holes in the pipeline that are patched here:

   1. 9:16 preview could not be set. The play button did nothing, even though
      the dropped file already had an object URL from the start.
      Now the source video plays INSIDE the frame, already cropped to match
      the Reframe box, and stops exactly at the clip boundary.

   2. No button started a render. The queue showed progress for a job that
      was never launched. Now rendering runs from the Candidates screen,
      for clips you have approved.

   The render is still a simulation -- no ffmpeg behind it yet -- but
   timing is derived from the actual clip duration.
   ========================================================================== */

const video = $("#videoPreview");
const frame = $("#frame");

let activeClip = null;      // { title, start, end } in seconds
let isPlaying = false;

const secondsFromClock = (t) =>
  String(t).split(":").reduce((a, b) => a * 60 + Number(b), 0);

/* Video size and position are derived from the crop box.
   To show a W%-wide slice of the source frame inside an F-wide box,
   the video is scaled to F * 100/W, then shifted L% of that width. */
/* Preview crops by scaling up the <video> and shifting it inside an
   overflow-hidden container -- identical to an ffmpeg crop, but done in
   CSS. The framing box aspect ratio is locked to the container ratio, so
   scaling by width alone is enough: height follows automatically.

   Dimensions are read from the NUMBERS in Framing, not by measuring the
   canvas box. Since Framing has its own screen now, the canvas is
   display:none whenever you are on the Clips or Text screen -- its rect
   is zero, so preview could never get valid measurements at all. */
function attachBox(v, box, crop, srcRatio = null) {
  if (!v || !box || !crop) return;
  const f = box.getBoundingClientRect();
  // The screen may be hidden; its rect is zero and division produces NaN.
  // Recalculated later when the screen becomes visible.
  if (!f.width || !crop.width) return;

  // srcRatio: the shape of THIS video, for a frame that is not the main preview (the Output format dialog's sample).
  const ratio = srcRatio || ((typeof sourceRatio === "function") ? sourceRatio() : 16 / 9);
  const width = f.width * (100 / crop.width);
  const height = width / ratio;
  v.style.width = `${width}px`;
  v.style.height = `${height}px`;
  v.style.transform =
    `translate(${-(crop.left / 100) * width}px, ${-(crop.top / 100) * height}px)`;
}

/* The picture inside the 9:16 frame, as Output Format has it (Picture,
   Background, Position): which band of the frame the picture takes, and
   whether a blurred copy is behind it. Mirrors render.picture_canvas -- the
   preview has been wrong about the render before, so the numbers here are the
   same ones: a 3:4 picture is 1080x1440 in the 1080x1920 frame (75% of its
   height), a 16:9 one is the source frame at the frame's width, which is
   (1/sourceRatio)/(16/9) of the height. */
function applyPictureFrame(f = $("#frame"), get = optionOut, srcRatio = null) {
  if (!f || typeof get !== "function") return;
  const picture = get("picture") || "9:16";
  f.dataset.picture = picture;
  f.dataset.bg = get("background") || "blur";
  if (picture === "9:16") return;
  const src = srcRatio || ((typeof sourceRatio === "function") ? sourceRatio() : 16 / 9);
  const heightPct = picture === "3:4" ? 75 : (1 / src) / (16 / 9) * 100;
  f.style.setProperty("--pic-h", `${heightPct}%`);
  f.style.setProperty("--pic-pos", String((get("position") ?? 50) / 100));
  // The render blurs with sigma 28 on a 1080-wide frame; this frame is smaller.
  const w = f.getBoundingClientRect().width;
  if (w) f.style.setProperty("--bg-blur", `${(28 * w / 1080).toFixed(1)}px`);
}

/* Whether the blurred copy is on screen right now. */
function pictureHasBlur(get = optionOut) {
  const pic = get("picture");
  return (pic === "3:4" || pic === "16:9") && get("background") === "blur";
}

/* The picture and its blurred copy laid out inside a 9:16 frame (the main preview's #frame, or the small one in
   the Output format dialog). `get(id)` answers for the options (optionOut, or the dialog's draft), `crop` is the
   framing box of the top picture, `srcRatio` the shape of the video when it is not the main one. `parts`:
   { video, box, bg, bgBox } -- the picture's <video> and the box it sits in, the blurred copy's. */
function layoutPictureInFrame(frameEl, parts, get, crop, srcRatio = null) {
  applyPictureFrame(frameEl, get, srcRatio);
  // A 16:9 picture is the whole frame whatever the framing boxes say.
  const main = get("picture") === "16:9" ? { left: 0, top: 0, width: 100, height: 100 } : crop;
  attachBox(parts.video, parts.box, main, srcRatio);
  if (pictureHasBlur(get)) {
    // The same picture again, scaled to fill the frame: a box as tall as the
    // frame with the picture's own shape, centred -- so the frame shows its
    // centre 9:16 slice, as the render's blur does.
    const aspect = get("picture") === "3:4" ? 3 / 4
      : (srcRatio || ((typeof sourceRatio === "function") ? sourceRatio() : 16 / 9));
    if (parts.bgBox) {
      parts.bgBox.style.width = `${(16 / 9) * aspect * 100}%`;
      attachBox(parts.bg, parts.bgBox, main, srcRatio);
    }
  }
  return main;
}

function attachVideoGeometry() {
  applyPictureFrame();
  if (!video.src || typeof frameAt !== "function") return;
  const b = frameAt(typeof reviewTime === "function" ? reviewTime() : 0);
  layoutPictureInFrame($("#frame"), { video, box: document.querySelector(".half.top"), bg: $("#videoBg"), bgBox: $("#bgBox") },
    optionOut, b.crops[0]);
  if (b.format === "split") {
    attachBox($("#videoPreview2"), document.querySelector(".half.bottom"),
                b.crops[1]);
  }
}

/* Which clip is being reviewed. The preview IS the result: if any section
   was discarded, playback skips it entirely -- matching exactly what the
   rendered file will contain. */
function setClip(k) {
  if (!k) return;
  activeClip = k;
  playSpan = 0;
  if (!k.spans || !k.spans.length) {
    // k.dur may arrive as a string from imported JSON ("54.7"); Number()
    // so that start + dur adds numerically, not concatenates ("1254.7").
    const start = k.startSec ?? secondsFromClock(k.in);
    k.spans = [{ start, end: start + Number(k.dur) }];
  }
  if (video.src) vSeek(video, k.spans[0].start);
  drawTime(0);            // total duration shows even before the video loads
  drawTimeline();
  if (typeof renderPreview === "function") renderPreview();

  // The placeholder first framing point (see resetFraming() in framing.js)
  // is created before any Result span exists, at a guessed `at: 0`. Now
  // that this clip's real spans are known, slide it to match -- otherwise
  // it stays pinned to source 00:00 forever (frame 0 of the whole source
  // video), showing the same irrelevant thumbnail no matter which clip is
  // open. Only touches it while still `auto` -- a point the user has
  // actually locked/edited is never moved out from under them.
  if (typeof FRAMING !== "undefined") {
    if (typeof RESULT !== "undefined" && RESULT.length && typeof ensureStartPoint === "function") {
      // The Result has moments: its start point follows ITS first moment (not
      // whichever clip is being previewed).
      if (ensureStartPoint() && typeof renderFraming === "function") renderFraming();
    } else if (FRAMING[0]?.auto && FRAMING[0].at !== k.spans[0].start) {
      FRAMING[0].at = k.spans[0].start;
      FRAMING.sort((a, b) => a.at - b.at);
      if (typeof renderFraming === "function") renderFraming();
    }
  }
}

/* Clip output duration: sum of segment lengths, not first-start to last-end. */
const clipOutDur = (k) =>
  (k?.spans || []).reduce((t, p) => t + (p.end - p.start), 0);

/* source time -> output time (null when falling in a discarded section) */
function sourceToOut(k, t) {
  // Looks for the span holding `t` rather than walking until one starts
  // after it: the Timeline screen lets spans be put in any order, so a
  // later span in the list can start EARLIER in the source. For spans in
  // chronological order this returns exactly what the old early-exit
  // version did.
  let passed = 0;
  for (const p of k.spans) {
    if (t >= p.start && t <= p.end) return passed + (t - p.start);
    passed += p.end - p.start;
  }
  return null;
}

/* output time -> source time */
function outToSource(k, t) {
  let remaining = t;
  for (const p of k.spans) {
    const len = p.end - p.start;
    if (remaining <= len) return p.start + remaining;
    remaining -= len;
  }
  const last = k.spans[k.spans.length - 1];
  return last ? last.end : 0;
}

// shortTime() used to be declared here: the same whole-second clock as
// timeRange() (app.js) apart from Math.floor vs Math.round, which was the
// one difference and the visible bug (12:12 in the AI suggestions row,
// 12:13 in the Result row below it, for the same clip). timeRange() took
// the floor behaviour and this copy is gone -- do NOT reintroduce a
// top-level `const timeRange` here; app.js already declares it, and a
// duplicate top-level const across two plain <script> files is a fatal
// SyntaxError that silently kills this entire file.

// preciseTime() (hundredths of a second, not just whole seconds) is
// defined in framing.js, loaded before this file (see the <script> order
// in index.html) -- NOT redeclared here. ian wanted the Result preview's
// own clock to match the precision the Framing screen just got; reusing
// the one function avoids a duplicate top-level `const` across two files
// that share this global scope, which is a fatal SyntaxError, not a
// silent shadow (already learned the hard way once in this codebase).

function drawTime(passed) {
  const w = $("#clipTime");
  if (!w || !activeClip) return;
  w.textContent = `${preciseTime(passed)} / ${preciseTime(clipOutDur(activeClip))}`;
}


/* ---------- timeline: discarded segments appear as gaps ---------- */

function drawTimeline() {
  const track = $("#tlTrack");
  if (!track) return;
  if (!activeClip) {
    // Without this, clearing Result leaves the track and time labels of
    // the LAST selected clip -- not the true "no clip yet" state.
    track.innerHTML = "";
    $("#tlStartTime").textContent = "00:00";
    $("#tlEndTime").textContent = "00:00";
    const head = $("#tlHead");
    if (head) head.style.left = "0%";
    return;
  }
  const total = clipOutDur(activeClip) || 1;
  track.innerHTML = activeClip.spans.map((p) => {
    const width = ((p.end - p.start) / total) * 100;
    return `<span class="tl-span" style="flex:0 0 ${width}%"
                  title="${preciseTime(p.start)} – ${preciseTime(p.end)}"></span>`;
  }).join("");
  $("#tlStartTime").textContent = "00:00";
  $("#tlEndTime").textContent = preciseTime(total);
  drawHead();
}

function drawHead() {
  const head = $("#tlHead");
  if (!head || !activeClip || !video.src) return;
  const out = sourceToOut(activeClip, vNow(video));
  const total = clipOutDur(activeClip) || 1;
  if (out === null) return;
  head.style.left = `${Math.min(100, (out / total) * 100)}%`;
  const tl = $("#timeline");
  if (tl) tl.setAttribute("aria-valuenow", Math.round((out / total) * 100));
}

/* Clicking the timeline jumps to that position -- in OUTPUT time. */
$("#timeline")?.addEventListener("click", (e) => {
  if (!activeClip || !video.src) return;
  const r = e.currentTarget.getBoundingClientRect();
  if (!r.width) return;
  const frac = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
  vSeek(video, outToSource(activeClip, frac * clipOutDur(activeClip)));
  drawHead();
  drawCaption();
  if (typeof syncCanvasVideo === "function") syncCanvasVideo();
});

$("#timeline")?.addEventListener("keydown", (e) => {
  if (!activeClip || !video.src) return;
  const step = e.shiftKey ? 5 : 1;
  const current = sourceToOut(activeClip, vNow(video)) ?? 0;
  if (e.key === "ArrowRight") vSeek(video, outToSource(activeClip, current + step));
  else if (e.key === "ArrowLeft") vSeek(video, outToSource(activeClip, Math.max(0, current - step)));
  else return;
  e.preventDefault();
  drawHead();
});

function prepareVideo() {
  if (!chosenSource || chosenSource.kind !== "file" || !chosenSource.url) {
    frame.dataset.video = "";
    return;
  }
  video.src = chosenSource.url;
  // Which of the project's videos this element holds (assets.js: vNow/vSeek).
  video.dataset.asset = activeAssetId;
  delete video.dataset.switching;
  frame.dataset.video = "true";
  loadFps(chosenSource.name);          // fps for frame-by-frame stepping
  video.addEventListener("loadedmetadata", () => {
    attachVideoGeometry();
    if (!activeClip) return;
    // Clamped inside this file when the first span is in it; a first span
    // in another of the project's videos is a switch, which vSeek does.
    const s = activeClip.spans[0].start;
    const inThis = assetIdAt(s) === video.dataset.asset;
    vSeek(video, inThis ? Math.min(s, assetOffset(video.dataset.asset) + video.duration - 0.1) : s);
  }, { once: true });
}

/* The inverse of prepareVideo(): hand the file back.

   "+ New Project" cleared the project's data but nothing ever released
   these elements, so a new project with no video dropped yet still showed
   the previous one's footage on Clips and Framing -- and it could still
   be played (ian). FOUR elements, not one: the preview is copied into
   #canvasVideo and, in split format, #videoPreview2 (followPreview() in
   framing.js), and the timeline carries its own (result.js).

   removeAttribute then load(), not src = "": an empty src resolves
   against the page URL, so the element would try to load the document
   itself as a video. load() is what actually drops the decoded frames and
   stops the fetch -- without it the last frame stays on screen. Same
   sequence #previewQuickClose already uses further down. */
function releaseVideo() {
  for (const v of [video, $("#canvasVideo"), $("#videoPreview2"), $("#tlPreviewVideo")]) {
    if (!v) continue;
    v.pause();
    v.removeAttribute("src");
    v.load();
  }
  frame.dataset.video = "";
}

/* Spans in chronological order -- every Result until one is reordered. */
const spansInOrder = (spans) => spans.every((p, i) => !i || spans[i - 1].start <= p.start);

/* Which span of a REORDERED list is playing, so "the next one" can mean
   the next in the list rather than the next in the source. */
let playSpan = 0;
const spanHolds = (p, t) => t >= p.start - 0.001 && t < p.end + 0.001;

/* The span to be in at virtual second `t`, for spans in any order; -1
   when the last one has finished. Returning a span whose start is after
   `t` makes the caller seek there -- same contract as the sorted rule. */
function nextSpanIndex(spans, t) {
  if (!spans[playSpan]) playSpan = 0;
  const cur = spans[playSpan];
  if (spanHolds(cur, t)) return playSpan;
  const next = spans[playSpan + 1];
  // Ran straight on into the next span (they're adjacent in the source).
  if (next && spanHolds(next, t)) return ++playSpan;
  // Just played past the end of this one: on to the next in the LIST.
  if (t >= cur.end && t - cur.end < 1.5) {
    if (!next) return -1;
    playSpan++;
    return playSpan;
  }
  // A seek landed somewhere else -- whichever span holds it.
  const j = spans.findIndex((p) => spanHolds(p, t));
  if (j >= 0) { playSpan = j; return j; }
  const k = spans.findIndex((p) => p.start > t);
  if (k >= 0) playSpan = k;
  return k;
}

video.addEventListener("timeupdate", () => {
  if (!activeClip || !activeClip.spans?.length) return;
  // Mid-switch to another video's file (vSeek, assets.js): currentTime is
  // the new file's 0 until its metadata lands, and acting on it would seek
  // somewhere meaningless.
  if (video.dataset.switching) return;
  const t = vNow(video);

  // Skip discarded sections: as soon as one segment ends, jump to the
  // start of the next segment. This is what makes the preview match
  // the rendered output file.
  //
  // Spans in chronological order keep this exact rule -- "the first span
  // not yet finished" IS the next one when they're sorted. Once the
  // Timeline screen has put them in another order it isn't, and the next
  // span is simply the one after the current in the list (nextSpanIndex).
  const inOrder = spansInOrder(activeClip.spans);
  const i = inOrder
    ? activeClip.spans.findIndex((p) => t < p.end + 0.001)
    : nextSpanIndex(activeClip.spans, t);
  if (i === -1) {                                   // habis
    playSpan = 0;
    video.pause();
    vSeek(video, activeClip.spans[0].start);
    isPlaying = false;
    if (playBtn) playBtn.textContent = "▶";
    drawTime(clipOutDur(activeClip));
    drawHead();
    drawCaption();
    if (typeof syncCanvasVideo === "function") syncCanvasVideo();
    return;
  }
  const p = activeClip.spans[i];
  // Out of order, the next span can start EARLIER in the source than
  // where playback is -- so "not inside it" is the test, not "before it".
  if (t < p.start - 0.001 || (!inOrder && !spanHolds(p, t))) { vSeek(video, p.start); return; }

  drawTime(sourceToOut(activeClip, t) ?? 0);
  drawHead();
  drawCaption();
  // Timeline elements (compose.js): labels, stickers, sounds, clip volume.
  if (typeof composeTick === "function") composeTick(sourceToOut(activeClip, t) ?? 0);

  // The framing canvas shows the SAME frame, un-cropped. Synced every
  // tick so it advances with the preview instead of freezing.
  if (typeof syncCanvasVideo === "function") syncCanvasVideo();

  // Framing screen time label updates each tick so it doesn't appear
  // frozen during playback (see note in updateFramingClock()).
  if (typeof updateFramingClock === "function") updateFramingClock();

  // Framing switches when playback passes the next point --
  // so the preview truly reflects what will be rendered.
  if (typeof pointAt === "function") {
    const f = pointAt(t);
    if (f && f !== lastFraming) {
      lastFraming = f;
      if (typeof renderFraming === "function") renderFraming();
      if (typeof followActivePoint === "function") followActivePoint(f);
    } else if (f?.tracking?.keyframes?.length >= 2
               && typeof attachVideoGeometry === "function") {
      // This point is tracked: the box moves EVERY tick while this point
      // is still active, not just once when the point changes (code path
      // above). Untracked points keep the old path -- static until the
      // next point, with no extra per-tick work.
      attachVideoGeometry();
    }
  }
});

/* ---------- live captions in preview ----------
   The caption box used to hold demo text hardcoded in HTML ("not an
   investment, THIS IS GAMBLING") -- it never changed, and was misleading
   because it did not match what would actually burn into the output file.

   Now it shows the original transcript words at the current playback
   position, grouped per line using the SAME rules as build_ass on the
   Python side, with the currently-spoken word highlighted in the
   Subtitle screen colour. */
function drawCaption() {
  const cap = $("#cap916");
  if (!cap) return;
  // The text source is ALREADY corrected words, so preview shows the
  // captions that will actually burn into the output file.
  const words = (typeof resultWords === "function" && resultWords().length)
    ? resultWords() : realTranscript?.words;
  if (!activeClip || !words?.length || !video.src) { cap.innerHTML = ""; return; }

  const t = vNow(video);
  const wordsPerLine = (typeof captionValue === "function"
    ? captionValue("per-line")?.out : 3) || 3;
  const reveal = (typeof captionValue === "function" ? captionValue("reveal")?.out : null) || "spoken";

  // words that actually make it into the output, same as in build_ass
  const used = [];
  for (const w of words) {
    const a = sourceToOut(activeClip, w.start);
    const b = sourceToOut(activeClip, w.end);
    if (a !== null && b !== null && b > a) used.push({ a, b, text: w.text.trim() });
  }
  // In OUTPUT order. Words arrive in source order, which is the same thing
  // until the Timeline screen reorders the spans.
  used.sort((x, y) => x.a - y.a);
  if (!used.length) { cap.innerHTML = ""; return; }

  const out = sourceToOut(activeClip, t);
  if (out === null) { cap.innerHTML = ""; return; }

  // The same rules as build_ass (shared/captionplan.js): lines break at pauses, nothing is on screen in
  // silence, and "As spoken" keeps the words not yet said laid out but invisible (no shifting).
  const at = captionAt(used, wordsPerLine, reveal, out);
  if (!at) { cap.innerHTML = ""; return; }
  cap.innerHTML = at.words
    .map((w, j) => {
      const text = escapeHTML(w.text);
      if (j >= at.shown) return `<span style="visibility:hidden">${text}</span>`;
      return j === at.highlight ? `<mark>${text}</mark>` : text;
    })
    .join(" ");
}

/* ---------- frame-by-frame stepping ----------
   Steps are calculated in OUTPUT time, not source time. The difference
   matters at segment boundaries: stepping forward one frame at the end
   of a segment lands on the first frame of the next segment, not on a
   discarded second.

   fps comes from ffprobe via /api/probe -- the <video> element never
   exposes that number. If the server does not respond, 30 is used as a
   safe default for most footage. */
let sourceFps = 30;

async function loadFps(name) {
  if (!name) return;
  try {
    const d = await (await fetch(`/api/probe?video=${encodeURIComponent(name)}`)).json();
    if (d.fps && d.fps > 1 && d.fps < 200) {
      sourceFps = d.fps;
      const el = $("#fpsNote");
      if (el) el.textContent = `${Math.round(sourceFps)} fps`;
    }
  } catch { /* biarkan 30 */ }
}

/* Core stepping logic, shared by stepFrame() (frame units) and
   stepSeconds() (second units) -- the only difference is how `step`
   is computed in OUTPUT time; the rest (pause if playing, clamp to
   clip bounds, redraw) is identical. */
function stepPreview(step) {
  if (!video.src || !activeClip) return;
  if (isPlaying) {                    // stepping while playing is odd
    video.pause();
    isPlaying = false;
    playBtn.textContent = "▶";
  }
  const total = clipOutDur(activeClip);
  const current = sourceToOut(activeClip, vNow(video));
  const from = current === null ? 0 : current;
  const target = Math.max(0, Math.min(total - 1 / sourceFps / 2, from + step));
  vSeek(video, outToSource(activeClip, target));
  drawTime(target);
  drawHead();
  drawCaption();
  if (typeof syncCanvasVideo === "function") syncCanvasVideo();
}

function stepFrame(direction) { stepPreview(direction / sourceFps); }   // direction = frame count, may be negative
function stepSeconds(seconds) { stepPreview(seconds); }                 // seconds may be negative

/* Step-button unit (frames/seconds) -- ian: needs seconds too, not just
   frames ("frames" are useful for precision at clip boundaries, "seconds"
   for larger jumps without counting frames). One set of buttons serves
   BOTH (labels + behaviour switch via this toggle), rather than
   duplicating into 12 buttons -- the 9:16 preview panel is already tight. */
let stepUnit = "frame";
const STEP_LABEL = { frame: ["5f", "2f", "1f"], seconds: ["5s", "2s", "1s"] };
const STEP_TITLE = {
  frame: ["5 frames", "2 frames", "1 frame"],
  seconds: ["5 seconds", "2 seconds", "1 second"],
};

function updateStepLabel() {
  const label = STEP_LABEL[stepUnit];
  const title = STEP_TITLE[stepUnit];
  const sizes = [5, 2, 1];
  sizes.forEach((n, i) => {
    const back = $(`#prevFrame${n === 1 ? "Btn" : n}`);
    const forward = $(`#nextFrame${n === 1 ? "Btn" : n}`);
    if (back) {
      back.querySelector("b").textContent = label[i];
      back.title = `Back ${title[i]}`;
      back.setAttribute("aria-label", `Back ${title[i]}`);
    }
    if (forward) {
      forward.querySelector("b").textContent = label[i];
      forward.title = `Forward ${title[i]}`;
      forward.setAttribute("aria-label", `Forward ${title[i]}`);
    }
  });
  // The shortcut panel (see below) also references the active unit, so
  // the "," "." labels there don't look ambiguous between frames/seconds.
  const unitEl = $("#shortcutUnitText");
  if (unitEl) unitEl.textContent = stepUnit === "frame" ? "frame" : "second";
}

$("#stepUnitBtn")?.addEventListener("click", () => {
  stepUnit = stepUnit === "frame" ? "seconds" : "frame";
  const btn = $("#stepUnitBtn");
  if (btn) {
    btn.textContent = stepUnit === "frame" ? "frame" : "sec";
    btn.setAttribute("aria-pressed", String(stepUnit === "seconds"));
    btn.setAttribute("aria-label", `Step unit: ${stepUnit === "frame" ? "frames" : "seconds"}`);
  }
  updateStepLabel();
});

/* The "?" panel's open/close lives in js/shared/topbar.js -- /workspace
   has the same button now, and the mechanics are identical. Only the
   CONTENT is still editor-specific: the shortcuts listed in
   #shortcutPanel in index.html, and the unit label kept current by
   updateStepLabel() above. */

/* Framing canvas is synced on seek and play/pause events -- not just on
   timeupdate. Scrubbing while paused does not always fire timeupdate,
   and the canvas used to be left behind at its old position. */
["seeked", "play", "pause", "loadeddata"].forEach((ev) =>
  video.addEventListener(ev, () => {
    if (typeof syncCanvasVideo === "function") syncCanvasVideo();
  }));

const rewindBtn = $("#rewindBtn");
const playBtn = $("#playBtn");
const muteBtn = $("#muteBtn");

[["#prevFrame5", -5], ["#prevFrame2", -2], ["#prevFrameBtn", -1],
 ["#nextFrameBtn", 1], ["#nextFrame2", 2], ["#nextFrame5", 5]]
  .forEach(([sel, n]) => $(sel)?.addEventListener("click",
    () => (stepUnit === "frame" ? stepFrame(n) : stepSeconds(n))));

/* Keyboard shortcuts: , and . as in most video editors; space to play.
   Ignored when typing in an input field. Follows the active unit
   (stepUnit) -- same as the buttons on the canvas. */
document.addEventListener("keydown", (e) => {
  const t = e.target;
  if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const step = (n) => (stepUnit === "frame" ? stepFrame(n) : stepSeconds(n));
  // , and . = 1 unit; Shift holds it to 5 units (< and > on the keyboard)
  if (e.key === ",") { e.preventDefault(); step(-1); }
  else if (e.key === ".") { e.preventDefault(); step(1); }
  else if (e.key === "<") { e.preventDefault(); step(-5); }
  else if (e.key === ">") { e.preventDefault(); step(5); }
  else if (e.key === " " && video.src && activeClip) { e.preventDefault(); playBtn.click(); }
});

playBtn?.addEventListener("click", () => {
  if (!video.src || !activeClip) return;
  if (isPlaying) { video.pause(); playBtn.textContent = "▶"; }
  else {
    if (sourceToOut(activeClip, vNow(video)) === null) {
      vSeek(video, activeClip.spans[0].start);
    }
    // Recommendation preview and Result preview must not play audio together.
    if (typeof closeRecPreview === "function") closeRecPreview();
    // play() rejects if immediately followed by pause() (e.g. the clip
    // ends on the same second). Swallowed so it doesn't become an
    // uncaught error.
    video.play().catch(() => {});
    playBtn.textContent = "❚❚";
  }
  isPlaying = !isPlaying;
  drawCaption();
  if (typeof syncCanvasVideo === "function") syncCanvasVideo();
});

/* Sound: the video is deliberately NOT muted anymore. Previously the
   muted attribute caused the result to play without any audio, even
   though the output file has sound. */
muteBtn?.addEventListener("click", () => {
  video.muted = !video.muted;
  muteBtn.textContent = video.muted ? "🔇" : "🔊";
  muteBtn.setAttribute("aria-pressed", String(video.muted));
  muteBtn.title = video.muted ? "Unmute" : "Mute";
  // aria-label OVERRIDES the button's text content, so without this line a
  // screen reader kept announcing "Mute" forever, including while muted.
  // #stepUnitBtn above already does this; this one was missed.
  muteBtn.setAttribute("aria-label", video.muted ? "Unmute" : "Mute");
});

rewindBtn?.addEventListener("click", () => {
  if (video.src && activeClip) {
    vSeek(video, activeClip.spans[0].start);
    drawTime(0); drawHead(); drawCaption();
    if (typeof syncCanvasVideo === "function") syncCanvasVideo();
  }
});

/* Preview plays the RESULT. This is what "preview is the output" means:
   what you see in the 9:16 frame is the file that will come out,
   complete with jumps at every segment boundary. */
function setResultAsPreview() {
  if (typeof RESULT === "undefined" || !RESULT.length) {
    activeClip = null;
    drawTimeline();
    // Without this the LENGTH panel (renderPreview -> #clipInfo) keeps
    // the last selected clip's info even though Result was just cleared --
    // same symptom as the stale timeline label above.
    if (typeof renderPreview === "function") renderPreview();
    return;
  }
  const clip = resultAsClip();
  clip.spans = RESULT.map((r) => ({ start: r.start, end: r.end }));
  setClip(clip);
}


/* ───────────────── render pipeline ───────────────── */

// pollJob()'s stop handle (app.js) -- replaces the raw interval id.
let renderStop = null;
let renderJobId = null;             // id of the active render job, for cancellation

/* Both buttons below start an ffmpeg job on the server. Neither used to be
   locked while one was already running: pressing Render twice launched a
   SECOND job, overwrote renderJobId, and left the first one burning CPU
   server-side with nothing tracking it -- Cancel then only cancelled the
   second. Called from renderResult() (result.js) and from every point where
   a render starts or ends. */
function updateRenderButtons() {
  const busy = renderJobId !== null;
  const btn = $("#resultRenderBtn");
  if (btn) {
    btn.disabled = busy || !RESULT.length;
    btn.textContent = busy ? "Rendering…" : "Render";
  }
  const quick = $("#previewQuickBtn");
  // Quick preview has its own in-flight label handled in quickPreview();
  // only add the "a full render is running" reason on top of it.
  if (quick && !quick.dataset.busy) quick.disabled = busy || !RESULT.length;
}
let lastFraming = null;   // the framing point currently shown in the preview


/* REAL render via backend.
   Previously this only animated the progress bar -- no file was ever
   created, yet the queue still wrote "complete" and offered "Open folder".
   Lying labels are worse than a missing feature. Now it actually calls
   ffmpeg through klipian serve. */


/* Render the entire Result as one file. The Candidates screen "approved"
   status no longer exists -- what renders is RESULT (see resultAsClip). */
async function startRender() {
  const clip = (typeof resultAsClip === "function") ? resultAsClip() : null;
  if (!clip) return;
  return sendRender([clip]);
}

/* Send one or more clips to the server. Used by the button on the
   Candidates screen (all approved) and the preview button (the clip being
   viewed). */
async function sendRender(approved) {
  if (!approved || !approved.length) return;

  // A clip with no time points can't be rendered. Previously one like
  // this was still sent and the server crashed with KeyError 'mulai' --
  // a message that meant nothing to the user.
  const valid = approved.filter((k) =>
    (k.spans || []).every((p) => Number.isFinite(p.start) && Number.isFinite(p.end))
    && (k.spans || []).length);
  if (!valid.length) {
    renderStatus("This clip has no time points. Re-import from Claude, "
      + "or create a manual clip.", true);
    toScreen("history");
    return;
  }
  // The request is no longer put together here: the SERVER builds it from the saved Result
  // (klipian/renderreq.py, proven equal to what this function used to send), so what is
  // rendered is what is saved. This only says which Result.
  return renderSavedResults([(typeof activeResultId !== "undefined" && activeResultId) || ""]);
}

/* A name for a Result before the server has answered: its typed title, else its first moment's. */
function resultLabel(id) {
  if (id === activeResultId) {
    const clip = (typeof resultAsClip === "function") ? resultAsClip() : null;
    if (clip?.title) return clip.title;
  }
  const r = (typeof SAVED_RESULTS !== "undefined" ? SAVED_RESULTS : []).find((x) => x.id === id);
  return r?.title || r?.segments?.[0]?.title || id;
}

/* Render these Results of the open project, one after another (server: jobs.start_project_render).
   The project is saved first, so the server sees exactly what is on screen. */
async function renderSavedResults(resultIds, { note = "" } = {}) {
  const ids = resultIds.filter(Boolean);
  if (!ids.length) { renderStatus("There is no Result to render.", true); toScreen("history"); return; }
  if (renderJobId !== null) { renderStatus("A render is already running: wait for it, or cancel it first.", true); toScreen("history"); return; }
  const layout = (typeof pictureSummary === "function") ? pictureSummary() : "9:16";
  QUEUE = ids.map((id) => ({ name: resultLabel(id), resultId: id, layout, dur: "", pct: 0, busy: false,
                             note: "saving the project", action: "Cancel", act: "cancel", folder: "", url: "", mb: 0 }));
  drawQueue();
  toScreen("history");
  renderStatus("Saving the project…");
  let saved = false;
  try { saved = (typeof writeProjectNow === "function") ? !!(await writeProjectNow()) : true; } catch { saved = false; }
  if (!saved || !activeProjectId) {
    QUEUE = [];
    drawQueue();
    renderStatus("The project could not be saved, so nothing was rendered. Press Save, then Render again.", true);
    return;
  }

  let reply;
  try {
    reply = await fetch("/api/render", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ project: activeProjectId, results: ids }),
    }).then((r) => r.json());
  } catch {
    // Without a backend, say so plainly -- don't pretend to render.
    QUEUE.forEach((r) => { r.pct = 0; r.busy = false; r.note = "needs klipian serve"; r.action = "Retry"; r.act = "retry"; });
    drawQueue();
    renderStatus("Rendering needs the backend. Run: python -m klipian serve", true);
    return;
  }
  if (reply.error) {
    QUEUE = [];
    drawQueue();
    renderStatus(reply.error, true);
    return;
  }
  renderJobId = reply.id;                  // used by the Cancel buttons to notify the server
  updateRenderButtons();
  const refused = reply.refused || [];
  const refusedNote = refused.length
    ? ` · not rendered: ${refused.map((r) => `${r.title} (${r.message})`).join("; ")}` : "";
  QUEUE = reply.items.map((it) => ({ name: it.title, resultId: it.result, layout: it.layout || layout,
                                     dur: `${Math.round(it.duration)}s`, pct: 0, busy: false, note: "queued",
                                     action: "Cancel", act: "cancel", folder: "", url: "", mb: 0 }));
  drawQueue();

  /* Paint the queue rows from one server snapshot (one row per clip, in the order they run). */
  const paintQueue = (t) => {
    (t.items || []).forEach((it, i) => {
      const r = QUEUE[i];
      if (!r) return;
      if (it.output) { r.name = it.output.file; r.url = it.output.url; r.folder = it.output.folder; r.mb = it.output.mb; }
      if (it.state === "done") {
        r.pct = 100; r.busy = false; r.note = "done"; r.action = "Open folder"; r.act = "open";
        // the Results list says when each was last rendered (bulk.js)
        const slot = r.resultId && SAVED_RESULTS.find((x) => x.id === r.resultId);
        if (slot && !r.stamped) {
          r.stamped = true;
          slot.renderedAt = Math.round(Date.now() / 1000);
          if (typeof saveProject === "function") saveProject();
          if (typeof renderAllResults === "function") renderAllResults();
        }
      }
      // The server reports progress per CLIP, not within one, so `busy` drives an indeterminate bar
      // instead of inventing a number (r.pct used to be hardcoded to 55 and then snapped to 100).
      else if (it.state === "running") {
        // Real progress from ffmpeg (percent, stage, eta): a determinate bar once it has begun, else the striped one
        const known = typeof it.percent === "number" && it.percent > 0;
        r.pct = known ? it.percent : 0; r.busy = true; r.determinate = known;
        r.note = [known ? `${it.percent}%` : "starting…", fmtLeft(it.eta), it.stage].filter(Boolean).join(" · ") || it.note || "rendering";
        r.action = "Cancel"; r.act = "cancel";
      }
      else if (it.state === "failed") { r.pct = 0; r.busy = false; r.note = `failed: ${it.error || ""}`.slice(0, 80); r.action = "Retry"; r.act = "retry"; }
      else if (it.state === "cancelled") { r.pct = 0; r.busy = false; r.note = "cancelled"; r.action = "Retry"; r.act = "retry"; }
      else { r.pct = 0; r.busy = false; r.determinate = false; r.note = it.queue?.text || (fmtLeft(it.est) ? `queued · ${fmtLeft(it.est).replace(" left", "")}` : "queued"); r.action = "Cancel"; r.act = "cancel"; }
      if (it.state !== "running") r.determinate = false;
    });
    // The batch as a whole: "Clip 2 of 5 · total ~3 min left"
    const many = (t.items || []).length > 1;
    RENDER_SUMMARY = t.state === "running" || t.state === "queued"
      ? [many ? `Clip ${(t.index || 0) + 1} of ${t.items.length}` : "", many && fmtLeft(t.eta) ? `total ${fmtLeft(t.eta)}` : fmtLeft(t.eta)].filter(Boolean).join(" · ")
      : "";
    drawQueue();
  };

  const finish = () => { renderStop = null; renderJobId = null; RENDER_SUMMARY = ""; updateRenderButtons(); drawQueue(); };

  if (renderStop) renderStop();
  renderStop = pollJob(`/api/render/${reply.id}`, {
    interval: 700,
    onTick: paintQueue,
    onFail: () => {
      finish();
      QUEUE.forEach((r) => {
        if (r.pct !== 100) { r.busy = false; r.note = "lost contact"; r.action = "Retry"; r.act = "retry"; }
      });
      drawQueue();
      renderStatus("Lost contact with the server while rendering. "
        + "Run: python -m klipian serve", true);
    },
    onDone: (t) => {
      finish();
      paintQueue(t);
      if (typeof loadHistory === "function") loadHistory();   // new files enter history
      const done = (t.items || []).filter((x) => x.state === "done");
      const failed = (t.items || []).filter((x) => x.state === "failed");
      const cancelled = (t.items || []).filter((x) => x.state === "cancelled");
      const scheduled = done.filter((x) => x.schedule);
      const warnings = done.map((x) => x.warning).filter(Boolean);
      // The full ffmpeg error, in a box that wraps -- it used to be ellipsized to one line in a span
      // that was 0px wide on a narrow window.
      const bad = t.state === "failed" || (!done.length && failed.length);
      renderStatus(bad
        ? `Failed: ${t.error || failed[0]?.error || "the render failed"}`
        : (note ? `${note} · ` : "") + `${done.length} clip${done.length === 1 ? "" : "s"} done · `
          + `${done.reduce((a, x) => a + (x.output?.mb || 0), 0).toFixed(1)} MB`
          + (failed.length ? ` · ${failed.length} failed (${failed[0].error})` : "")
          + (cancelled.length ? ` · ${cancelled.length} cancelled` : "")
          + (scheduled.length ? ` · ${scheduled.length === 1
            ? (scheduled[0].schedule.created ? "added to the upload schedule (Draft)" : "upload-schedule row updated")
            : `${scheduled.length} in the upload schedule`}` : "")
          + (warnings.length ? ` · ${warnings[0]}` : "") + refusedNote,
        !!bad);
    },
  });
}

/* ───────────────── quick preview: a real render, trimmed short ────
   Different from the 9:16 panel above -- that's a CSS approximation, and
   an approximation can drift from the real ASS/ffmpeg output (exactly
   what happened with the watermark opacity bug). This calls REAL ffmpeg
   via /api/preview, just trimmed to PREVIEW_MAX_SECONDS seconds on the
   server to stay "quick". */
async function quickPreview() {
  const resultClip = (typeof resultAsClip === "function") ? resultAsClip() : null;
  const btn = $("#previewQuickBtn");
  const note = $("#previewQuickNote");
  if (!resultClip || !resultClip.spans?.length) return;

  // The server gives no progress for a preview (one synchronous ffmpeg run),
  // so what can be shown honestly is that it is running and for how long.
  // On battery this has taken over a minute.
  const startedAt = performance.now();
  const tick = () => {
    const s = Math.floor((performance.now() - startedAt) / 1000);
    if (btn) btn.textContent = `Rendering… ${s} s`;
    if (note) note.textContent = s >= 15 ? "Still rendering: it is real video, and slower on battery." : "";
  };
  const ticker = setInterval(tick, 1000);
  if (btn) { btn.dataset.busy = "1"; btn.disabled = true; btn.textContent = "Rendering… 0 s"; }
  if (note) note.textContent = "";

  // Same as sendRender(): spans are split again at each framing point
  // so the crop actually previewed matches the one selected.
  const framed = (typeof spansWithFraming === "function")
    ? spansWithFraming(resultClip.spans)
    : resultClip.spans;

  // A long clip (minutes-long) is almost never represented by just its
  // FIRST 3 seconds -- the scrub position currently being viewed in the
  // preview panel is the moment actually being checked, so the preview
  // starts from there instead of always from the beginning.
  const currentPosition = (video?.src && typeof sourceToOut === "function")
    ? sourceToOut(resultClip, vNow(video)) : null;
  const startFrom = currentPosition ?? 0;

  // A preview is a few seconds of ONE video: only the run of spans from
  // the video the scrub position is in goes to the server (which previews
  // one file), with startFrom made relative to where that run begins.
  let runStart = 0, passed = 0;
  let run = [];
  for (const p of framed) {
    const len = p.end - p.start;
    // Same video AND still moving forward through it -- the server's
    // RenderJob rejects spans that go backwards, which a reordered Result
    // can have within one video (same rule as asset_runs in render.py).
    const sameVideo = run.length && assetIdAt(run[0].start) === assetIdAt(p.start)
      && p.start >= run[run.length - 1].end;
    if (!sameVideo) {
      if (run.length && startFrom < passed) break;
      run = [];
      runStart = passed;
    }
    run.push(p);
    passed += len;
  }
  const real = serverClipFields(run,
    (typeof wordsForRender === "function") ? wordsForRender() : undefined);
  const mainFile = real.video;
  const clip = {
    title: resultClip.title,
    spans: real.spans,
    style: captionStyle(),
    // Only this video's words, and without a `video` of their own: the
    // preview request's one video IS theirs.
    words: Array.isArray(real.words) ? real.words.filter((w) => !w.video) : real.words,
    picture: optionOut("picture"),
    background: optionOut("background"),
    position: optionOut("position"),
    width: optionOut("resolution"),
    quality: optionOut("quality"),
    // Timeline elements in WHOLE-clip seconds; the server re-times them to
    // this piece from overlayBase (below) and its own start.
    ...(resultClip.overlays?.length ? { overlays: resultClip.overlays } : {}),
    ...(resultClip.volumes?.length ? { volumes: resultClip.volumes } : {}),
  };

  try {
    const reply = await fetch("/api/preview", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ video: mainFile || chosenSource?.name || DATA.file, clip,
                             startFrom: Math.max(0, startFrom - runStart), overlayBase: runStart }),
    }).then((r) => r.json());
    if (reply.error) throw new Error(reply.error);
    showQuickPreview(reply.url);
    // So it's clear WHICH span is being viewed -- without this, people
    // might assume the preview always starts from the beginning of the
    // clip, when it now follows the scrub position (see startFrom above).
    if (note) note.textContent = `previewing ${timeRange(startFrom)}–${timeRange(startFrom + (reply.duration || 0))}`
      + (reply.warning ? ` · ${reply.warning}` : "");
  } catch (err) {
    if (note) note.textContent = err.message || "Preview failed.";
  } finally {
    clearInterval(ticker);
    if (btn) { delete btn.dataset.busy; btn.textContent = "Quick preview"; }
    updateRenderButtons();
  }
}

function showQuickPreview(url) {
  const wrap = $("#previewQuickWrap");
  const video = $("#previewQuickVideo");
  if (!wrap || !video) return;
  video.src = url;               // unique filename per request -- no cache-buster needed
  video.play().catch(() => {});  // autoplay may be blocked by the browser -- not an error
  wrap.hidden = false;
}

$("#previewQuickBtn")?.addEventListener("click", quickPreview);

$("#previewQuickClose")?.addEventListener("click", () => {
  const wrap = $("#previewQuickWrap");
  const video = $("#previewQuickVideo");
  if (video) { video.pause(); video.removeAttribute("src"); video.load(); }
  if (wrap) wrap.hidden = true;
});

