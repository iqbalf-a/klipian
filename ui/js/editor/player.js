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
function attachBox(v, box, crop) {
  if (!v || !box || !crop) return;
  const f = box.getBoundingClientRect();
  // The screen may be hidden; its rect is zero and division produces NaN.
  // Recalculated later when the screen becomes visible.
  if (!f.width || !crop.width) return;

  const ratio = (typeof sourceRatio === "function") ? sourceRatio() : 16 / 9;
  const width = f.width * (100 / crop.width);
  const height = width / ratio;
  v.style.width = `${width}px`;
  v.style.height = `${height}px`;
  v.style.transform =
    `translate(${-(crop.left / 100) * width}px, ${-(crop.top / 100) * height}px)`;
}

function attachVideoGeometry() {
  if (!video.src || typeof frameAt !== "function") return;
  const b = frameAt(typeof reviewTime === "function" ? reviewTime() : 0);
  attachBox(video, document.querySelector(".half.top"), b.crops[0]);
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
  if (!k.spans || !k.spans.length) {
    // k.dur may arrive as a string from imported JSON ("54.7"); Number()
    // so that start + dur adds numerically, not concatenates ("1254.7").
    const start = k.startSec ?? secondsFromClock(k.in);
    k.spans = [{ start, end: start + Number(k.dur) }];
  }
  if (video.src) video.currentTime = k.spans[0].start;
  drawTime(0);            // total duration shows even before the video loads
  drawTimeline();
  if (typeof renderPreview === "function") renderPreview();
}

/* Clip output duration: sum of segment lengths, not first-start to last-end. */
const clipOutDur = (k) =>
  (k?.spans || []).reduce((t, p) => t + (p.end - p.start), 0);

/* source time -> output time (null when falling in a discarded section) */
function sourceToOut(k, t) {
  let passed = 0;
  for (const p of k.spans) {
    if (t < p.start) return null;
    if (t <= p.end) return passed + (t - p.start);
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

// Includes hours when the source exceeds 1 hour -- without this,
// 1:05:00 would display as "65:00". Matches timeRange() in app.js.
const shortTime = (d) => {
  const t = Math.max(0, Math.floor(d));
  const j = Math.floor(t / 3600);
  const m = String(Math.floor((t % 3600) / 60)).padStart(2, "0");
  const s = String(t % 60).padStart(2, "0");
  return j ? `${j}:${m}:${s}` : `${m}:${s}`;
};

function drawTime(passed) {
  const w = $("#clipTime");
  if (!w || !activeClip) return;
  w.textContent = `${shortTime(passed)} / ${shortTime(clipOutDur(activeClip))}`;
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
                  title="${shortTime(p.start)} – ${shortTime(p.end)}"></span>`;
  }).join("");
  $("#tlStartTime").textContent = "00:00";
  $("#tlEndTime").textContent = shortTime(total);
  drawHead();
}

function drawHead() {
  const head = $("#tlHead");
  if (!head || !activeClip || !video.src) return;
  const out = sourceToOut(activeClip, video.currentTime);
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
  video.currentTime = outToSource(activeClip, frac * clipOutDur(activeClip));
  drawHead();
  drawCaption();
  if (typeof syncCanvasVideo === "function") syncCanvasVideo();
});

$("#timeline")?.addEventListener("keydown", (e) => {
  if (!activeClip || !video.src) return;
  const step = e.shiftKey ? 5 : 1;
  const current = sourceToOut(activeClip, video.currentTime) ?? 0;
  if (e.key === "ArrowRight") video.currentTime = outToSource(activeClip, current + step);
  else if (e.key === "ArrowLeft") video.currentTime = outToSource(activeClip, Math.max(0, current - step));
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
  frame.dataset.video = "true";
  loadFps(chosenSource.name);          // fps for frame-by-frame stepping
  video.addEventListener("loadedmetadata", () => {
    attachVideoGeometry();
    if (activeClip) video.currentTime = Math.min(activeClip.spans[0].start, video.duration - 0.1);
  }, { once: true });
}

video.addEventListener("timeupdate", () => {
  if (!activeClip || !activeClip.spans?.length) return;
  const t = video.currentTime;

  // Skip discarded sections: as soon as one segment ends, jump to the
  // start of the next segment. This is what makes the preview match
  // the rendered output file.
  const i = activeClip.spans.findIndex((p) => t < p.end + 0.001);
  if (i === -1) {                                   // habis
    video.pause();
    video.currentTime = activeClip.spans[0].start;
    isPlaying = false;
    if (playBtn) playBtn.textContent = "▶";
    drawTime(clipOutDur(activeClip));
    drawHead();
    drawCaption();
    if (typeof syncCanvasVideo === "function") syncCanvasVideo();
    return;
  }
  const p = activeClip.spans[i];
  if (t < p.start - 0.001) { video.currentTime = p.start; return; }

  drawTime(sourceToOut(activeClip, t) ?? 0);
  drawHead();
  drawCaption();

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

  const t = video.currentTime;
  const wordsPerLine = (typeof captionValue === "function"
    ? captionValue("per-line")?.out : 3) || 3;

  // words that actually make it into the output, same as in build_ass
  const used = [];
  for (const w of words) {
    const a = sourceToOut(activeClip, w.start);
    const b = sourceToOut(activeClip, w.end);
    if (a !== null && b !== null && b > a) used.push({ a, b, text: w.text.trim() });
  }
  if (!used.length) { cap.innerHTML = ""; return; }

  const out = sourceToOut(activeClip, t);
  if (out === null) { cap.innerHTML = ""; return; }

  // Each line's display window must MATCH build_ass: a new line STARTS
  // exactly when its first word is spoken, not earlier just because the
  // previous line ended. Previously the check was "which word hasn't ended
  // yet" (out < w.b) without verifying it had started -- so as soon as
  // there was a gap before the next line, the entire line (including words
  // not yet spoken) appeared for the duration of that gap (reported by ian:
  // "text appeared but the speaker hasn't talked yet").
  let line = null, highlight = -1;
  for (let g = 0; g < used.length; g += wordsPerLine) {
    const group = used.slice(g, g + wordsPerLine);
    const next = used[g + wordsPerLine];        // first word of the following line
    const start = group[0].a;
    const end = next ? next.a : group[group.length - 1].b + 0.4;
    if (out < start || out >= end) continue;
    line = group;
    // The highlighted word persists until the NEXT word truly starts
    // (not just until the end of the word itself) -- matching build_ass,
    // so the highlight doesn't blink empty during a mid-line pause.
    highlight = group.length - 1;
    for (let j = 0; j < group.length; j++) {
      const groupEnd = j < group.length - 1 ? group[j + 1].a : end;
      if (out < groupEnd) { highlight = j; break; }
    }
    break;
  }
  if (!line) { cap.innerHTML = ""; return; }

  cap.innerHTML = line
    .map((w, j) => (j === highlight ? `<mark>${escapeHTML(w.text)}</mark>` : escapeHTML(w.text)))
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
  const current = sourceToOut(activeClip, video.currentTime);
  const from = current === null ? 0 : current;
  const target = Math.max(0, Math.min(total - 1 / sourceFps / 2, from + step));
  video.currentTime = outToSource(activeClip, target);
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

/* Keyboard shortcut panel -- "?" toggles open/closed, not always visible
   (the 9:16 preview panel is already tight; permanent help text would
   crowd out other buttons). Close again on outside click or Escape --
   standard popover pattern, don't leave it hanging open until manually
   closed via its own button. */
(function shortcutHelp() {
  const btn = $("#shortcutHelpBtn");
  const panel = $("#shortcutPanel");
  if (!btn || !panel) return;
  const close = () => {
    panel.hidden = true;
    btn.setAttribute("aria-expanded", "false");
  };
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    const open = panel.hidden;
    panel.hidden = !open;
    btn.setAttribute("aria-expanded", String(open));
  });
  document.addEventListener("click", (e) => {
    if (!panel.hidden && !panel.contains(e.target) && e.target !== btn) close();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !panel.hidden) close();
  });
})();

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
    if (sourceToOut(activeClip, video.currentTime) === null) {
      video.currentTime = activeClip.spans[0].start;
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
});

rewindBtn?.addEventListener("click", () => {
  if (video.src && activeClip) {
    video.currentTime = activeClip.spans[0].start;
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

let renderTimer = null;
let renderJobId = null;             // id of the active render job, for cancellation
let lastFraming = null;   // the framing point currently shown in the preview


/* Human-readable values. For UI labels and history rows. */
function optionValue(id) {
  const o = OPTIONS.find((x) => x.id === id);
  return o ? o.choices[o.active] : "";
}

/* Machine-readable values. Used when building the render request, so the
   button labels can change without altering anything in the output file. */
function optionOut(id) {
  const o = OPTIONS.find((x) => x.id === id);
  return o && o.out ? o.out[o.active] : undefined;
}


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
    const head = document.querySelector('[data-screen="history"] .note');
    if (head) head.textContent =
      "This clip has no time points. Re-import from Claude, or create a manual clip.";
    toScreen("history");
    return;
  }

  const request = {
    video: chosenSource?.name || DATA.file,
    clips: valid.map((k) => ({
      title: k.title,
      // Spans are split again at each framing point, and each one carries
      // its own crop. That's what lets framing change mid-clip.
      spans: (typeof spansWithFraming === "function")
        ? spansWithFraming(k.spans || [{ start: k.startSec, end: k.endSec }])
        : (k.spans || []).map((p) => ({ start: p.start, end: p.end })),
      style: captionStyle(),         // Caption screen settings are sent along too
      // Words already corrected on the Captions screen. If there are no
      // corrections, this matches the transcript -- the server accepts it as-is either way.
      words: (typeof wordsForRender === "function") ? wordsForRender() : undefined,
      layout: optionOut("format"),
      width: optionOut("resolution"),
    })),
  };

  // The queue must line up with what's actually sent: the server reports
  // results by index, and if the contents differ the rows point to the wrong thing.
  buildQueue(valid);
  QUEUE.forEach((r) => { r.pct = 0; r.note = "queued"; r.action = "Cancel"; r.act = "cancel"; });
  drawQueue();
  toScreen("history");

  let id;
  try {
    const reply = await fetch("/api/render", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    }).then((r) => r.json());
    if (reply.error) throw new Error(reply.error);
    id = reply.id;
    renderJobId = id;               // used by the Cancel button to notify the server
  } catch (err) {
    // Without a backend, say so plainly -- don't pretend to render.
    QUEUE.forEach((r) => { r.pct = 0; r.note = "needs klipian serve"; r.action = "Retry"; r.act = "retry"; });
    drawQueue();
    const head = document.querySelector('[data-screen="history"] .note');
    if (head) head.textContent =
      "Rendering needs the backend. Run: python -m klipian serve";
    return;
  }

  clearInterval(renderTimer);
  renderTimer = setInterval(async () => {
    let t;
    try { t = await (await fetch(`/api/render/${id}`)).json(); }
    catch { return; }

    // The server already confirmed the cancellation: stop polling, don't
    // overwrite the row back to "rendering/queued".
    if (t.state === "cancelled") {
      clearInterval(renderTimer);
      renderJobId = null;
      QUEUE.forEach((r, i) => {
        if (i < t.done) { r.pct = 100; r.note = "done"; r.action = "Open folder"; r.act = "open"; }
        else { r.pct = 0; r.note = "cancelled"; r.action = "Retry"; r.act = "retry"; }
      });
      drawQueue();
      const head = document.querySelector('[data-screen="history"] .note');
      if (head) head.textContent = "Render cancelled.";
      return;
    }

    QUEUE.forEach((r, i) => {
      if (i < t.done) { r.pct = 100; r.note = "done"; r.action = "Open folder"; r.act = "open"; }
      else if (i === t.index && t.state === "running") { r.pct = 55; r.note = "rendering"; r.action = "Cancel"; r.act = "cancel"; }
      else { r.pct = 0; r.note = "queued"; r.action = "Cancel"; r.act = "cancel"; }
    });
    (t.result || []).forEach((h, i) => {
      if (QUEUE[i]) { QUEUE[i].name = h.file; QUEUE[i].url = h.url;
                        QUEUE[i].folder = h.folder; QUEUE[i].mb = h.mb; }
    });
    drawQueue();

    if (t.state !== "running") {
      clearInterval(renderTimer);
      renderJobId = null;
      if (typeof loadHistory === "function") loadHistory();   // new file enters history
      const head = document.querySelector('[data-screen="history"] .note');
      if (head) head.textContent = t.state === "failed"
        ? `Failed: ${t.error}`
        : `${t.done} clip${t.done === 1 ? "" : "s"} done · ${(t.result || []).reduce((a, h) => a + h.mb, 0).toFixed(1)} MB`;
    }
  }, 700);
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

  if (btn) { btn.disabled = true; btn.textContent = "Rendering…"; }
  if (note) note.textContent = "";

  const clip = {
    title: resultClip.title,
    // Same as sendRender(): spans are split again at each framing point
    // so the crop actually previewed matches the one selected.
    spans: (typeof spansWithFraming === "function")
      ? spansWithFraming(resultClip.spans)
      : resultClip.spans,
    style: captionStyle(),
    words: (typeof wordsForRender === "function") ? wordsForRender() : undefined,
    layout: optionOut("format"),
    width: optionOut("resolution"),
  };

  // A long clip (minutes-long) is almost never represented by just its
  // FIRST 3 seconds -- the scrub position currently being viewed in the
  // preview panel is the moment actually being checked, so the preview
  // starts from there instead of always from the beginning.
  const currentPosition = (video?.src && typeof sourceToOut === "function")
    ? sourceToOut(resultClip, video.currentTime) : null;
  const startFrom = currentPosition ?? 0;

  try {
    const reply = await fetch("/api/preview", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ video: chosenSource?.name || DATA.file, clip, startFrom }),
    }).then((r) => r.json());
    if (reply.error) throw new Error(reply.error);
    showQuickPreview(reply.url);
    // So it's clear WHICH span is being viewed -- without this, people
    // might assume the preview always starts from the beginning of the
    // clip, when it now follows the scrub position (see startFrom above).
    if (note) note.textContent = `previewing ${shortTime(startFrom)}–${shortTime(startFrom + (reply.duration || 0))}`;
  } catch (err) {
    if (note) note.textContent = err.message || "Preview failed.";
  } finally {
    if (btn) { btn.disabled = !RESULT.length; btn.textContent = "Quick preview"; }
  }
}

function showQuickPreview(url) {
  const wrap = $("#previewQuickWrap");
  const video = $("#previewQuickVideo");
  if (!wrap || !video) return;
  video.src = url;               // ?t=... in the url already makes it different each time
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

