/* klipian — full video timeline & range selection
   ==========================================================================
   A single bar represents the entire video. You drag on it to select a
   range, then add it to result.

   The problem this design solves: a 42-minute podcast on a 900px-wide bar
   means 1px ~ 2.8 seconds. Dragging alone will never be precise. So there
   are THREE complementary paths:

     1. rough drag  -> find the location
     2. snap to word -> cut point auto-refines to nearest word boundary
     3. type numbers -> when you already know the mm:ss

   The third is important precisely because AI recommendations give numbers:
   you can type them directly without hunting on the bar.

   Markers on the bar show AI recommendations (thin lines) and cuts already
   in result (solid blocks), so you don't select the same thing twice.
   ========================================================================== */

let SELECTION = null;       // { start, end } in source seconds, or null
let dragSelection = null;   // temporary state while dragging

const videoDuration = () =>
  realTranscript?.duration || chosenSource?.duration || 0;

/* seconds -> fraction 0..1 along the bar, and vice versa */
const toFraction = (t) => { const d = videoDuration(); return d ? Math.max(0, Math.min(1, t / d)) : 0; };
const fracToSeconds = (frac) => Math.max(0, Math.min(videoDuration(), frac * videoDuration()));

/* "16:56" -> 1016. Accepts "1:02:03" too. Returns null if garbage. */
function parseTime(text) {
  const parts = String(text).trim().split(":");
  if (!parts.length || parts.some((b) => b.trim() === "" || isNaN(Number(b)))) return null;
  const seconds = parts.reduce((a, b) => a * 60 + Number(b), 0);
  return Number.isFinite(seconds) ? seconds : null;
}

/* ---------- drawing ---------- */

function drawTotalTimeline() {
  const bar = $("#tlTotal");
  if (!bar) return;
  // Preview panel above this bar is ALWAYS visible, so it must have content
  // as early as possible -- this gathering point is already called every time
  // chosenSource changes, so it's also used to load the video.
  if (typeof loadFullPreview === "function") loadFullPreview();
  const d = videoDuration();

  const info = $("#pickDuration");
  if (info) info.textContent = d ? `total ${timeRange(d)}` : "no video loaded";

  // markers: AI recommendations thin, result cuts solid
  const marks = $("#tlMarks");
  if (marks) {
    const recMarks = (DATA?.candidates || []).map((k) => `
      <span class="tl-mark rec" style="left:${toFraction(k.startSec) * 100}%;
            width:${Math.max(0.4, (toFraction(k.endSec) - toFraction(k.startSec)) * 100)}%"
            title="${escapeHTML(k.title)}"></span>`).join("");
    const usedMarks = RESULT.map((r) => `
      <span class="tl-mark result" style="left:${toFraction(r.start) * 100}%;
            width:${Math.max(0.4, (toFraction(r.end) - toFraction(r.start)) * 100)}%"
            title="${escapeHTML(r.title)}"></span>`).join("");
    marks.innerHTML = recMarks + usedMarks;
  }

  // time scale: 5 evenly spaced labels
  const scale = $("#tlScale");
  if (scale) {
    scale.innerHTML = d
      ? [0, 0.25, 0.5, 0.75, 1].map((f) => `<span>${timeRange(d * f)}</span>`).join("")
      : "";
  }
  drawSelection();
}

function drawSelection() {
  const box = $("#tlSel");
  const button = $("#selAddBtn");
  if (!box) return;

  if (!SELECTION) {
    box.hidden = true;
    if (button) button.disabled = true;
    $("#selDur").textContent = "0s";
    $("#selText").textContent = "";
    return;
  }
  box.hidden = false;
  box.style.left = `${toFraction(SELECTION.start) * 100}%`;
  box.style.width = `${Math.max(0.3, (toFraction(SELECTION.end) - toFraction(SELECTION.start)) * 100)}%`;

  // Number fields aren't overwritten while you're typing in them.
  const a = $("#selStart"), b = $("#selEnd");
  if (a && document.activeElement !== a) a.value = timeRange(SELECTION.start);
  if (b && document.activeElement !== b) b.value = timeRange(SELECTION.end);

  const dur = SELECTION.end - SELECTION.start;
  $("#selDur").textContent = `${Math.round(dur)}s`;
  if (button) button.disabled = dur < 0.5;

  // Show the words within the range -- numbers alone aren't enough to
  // know if the cut is right.
  const wordsEl = $("#selText");
  if (wordsEl) {
    const words = (realTranscript?.words || [])
      .filter((w) => w.start >= SELECTION.start && w.end <= SELECTION.end)
      .map((w) => w.text.trim());
    wordsEl.textContent = words.length
      ? (words.length > 60
          ? words.slice(0, 30).join(" ") + "  …  " + words.slice(-20).join(" ")
          : words.join(" "))
      : "no words in this range";
  }
}

/* ---------- setting selection ---------- */

function setSelection(start, end, snap) {
  const d = videoDuration();
  if (!d) return;
  start = Math.max(0, Math.min(d, start));
  end = Math.max(0, Math.min(d, end));
  if (end < start) [start, end] = [end, start];

  // Snap is used after dragging finishes, not during -- if every pixel
  // snaps, the box jumps around and is hard to aim.
  if (snap && typeof snapToWord === "function" && realTranscript?.words?.length) {
    const a = snapToWord(start, "start");
    const b = snapToWord(end, "end");
    if (b > a) { start = a; end = b; }
  }
  SELECTION = { start, end };
  drawSelection();
}

function clearSelection() { SELECTION = null; drawSelection(); }

/* ---------- dragging on the bar ---------- */

function fracFromEvent(e, bar) {
  const r = bar.getBoundingClientRect();
  if (!r.width) return null;
  return Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
}

$("#tlTotal")?.addEventListener("pointerdown", (e) => {
  const bar = e.currentTarget;
  if (!videoDuration()) {
    $("#pickNote").textContent = "no video or transcript yet";
    return;
  }
  const frac = fracFromEvent(e, bar);
  if (frac === null) return;

  // Saved so Escape can restore to the state BEFORE this drag
  // -- not just clear the selection. Dragging the "start" grip on an existing
  // selection and regretting halfway should restore the old selection,
  // not lose everything.
  const previousSelection = SELECTION ? { ...SELECTION } : null;
  const grip = e.target.closest("[data-grip]");
  if (grip && SELECTION) {
    dragSelection = { kind: grip.dataset.grip, bar, previousSelection };
  } else {
    dragSelection = { kind: "new", bar, anchor: fracToSeconds(frac), previousSelection };
    setSelection(dragSelection.anchor, dragSelection.anchor, false);
  }
  bar.setPointerCapture(e.pointerId);
  e.preventDefault();
});

$("#tlTotal")?.addEventListener("pointermove", (e) => {
  if (!dragSelection) return;
  const frac = fracFromEvent(e, dragSelection.bar);
  if (frac === null) return;
  const t = fracToSeconds(frac);
  if (dragSelection.kind === "new") setSelection(dragSelection.anchor, t, false);
  else if (dragSelection.kind === "start") setSelection(t, SELECTION.end, false);
  else setSelection(SELECTION.start, t, false);
});

["pointerup", "pointercancel"].forEach((ev) =>
  $("#tlTotal")?.addEventListener(ev, () => {
    if (!dragSelection) return;
    dragSelection = null;
    if (SELECTION && SELECTION.end - SELECTION.start < 0.5) { clearSelection(); return; }
    if (SELECTION) {
      const before = `${SELECTION.start.toFixed(2)}-${SELECTION.end.toFixed(2)}`;
      setSelection(SELECTION.start, SELECTION.end, true);      // snapped to word boundary
      const after = `${SELECTION.start.toFixed(2)}-${SELECTION.end.toFixed(2)}`;
      $("#pickNote").textContent = before === after
        ? "range selected"
        : "cut point snapped to the nearest word boundary";
    }
  }));

/* Escape cancels. There used to be no exit at all: start dragging then
   change your mind meant dragging back until the range was under 0.5
   seconds to trigger clearSelection() -- frustrating, and dragging a grip
   on an EXISTING selection would delete everything instead of restoring
   the old selection.

   Two states:
   - Actively dragging -> restore to the selection BEFORE this drag (not
     empty, if there was one before).
   - Not dragging, but a lingering selection -> just clear it,
     "I've seen it, never mind". */
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  const t = e.target;
  if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;

  if (dragSelection) {
    const { previousSelection } = dragSelection;
    // dragSelection is cleared first, so the pointerup/pointercancel that
    // will still follow (finger/mouse may not have lifted yet) immediately
    // no-ops via `if (!dragSelection) return;` above -- the capture itself
    // is released automatically by the browser once the pointer actually lifts.
    dragSelection = null;
    if (previousSelection) setSelection(previousSelection.start, previousSelection.end, false);
    else clearSelection();
    $("#pickNote").textContent = "selection cancelled";
  } else if (SELECTION) {
    clearSelection();
    $("#pickNote").textContent = "drag on the timeline to select a range";
  }
});

/* ---------- typing mm:ss ---------- */

function readTimeColumns() {
  let a = parseTime($("#selStart").value);
  let b = parseTime($("#selEnd").value);
  if (a === null || b === null) {
    $("#pickNote").textContent = "time format is mm:ss, e.g. 16:56";
    return;
  }
  // The column displays timeRange() rounded to whole seconds. If a column
  // was NOT changed (its rounded value still matches SELECTION), preserve
  // SELECTION's precise value -- don't let display rounding shift the
  // untouched side by half a second when editing the other side.
  if (SELECTION) {
    if (Math.round(a) === Math.round(SELECTION.start)) a = SELECTION.start;
    if (Math.round(b) === Math.round(SELECTION.end)) b = SELECTION.end;
  }
  if (b <= a) {
    $("#pickNote").textContent = "end time must be later than start";
    return;
  }
  // Numbers beyond video duration used to be silently clamped to zero range,
  // and the button died with no visible reason. Now it's explained.
  const d = videoDuration();
  if (d && a >= d) {
    $("#pickNote").textContent =
      `${timeRange(a)} is past the end of the video (${timeRange(d)})`;
    return;
  }
  if (d && b > d) {
    $("#pickNote").textContent =
      `shortened to the end of the video (${timeRange(d)})`;
  } else {
    $("#pickNote").textContent = "range set from the numbers";
  }
  setSelection(a, b, false);       // typed numbers are respected as-is
}

["#selStart", "#selEnd"].forEach((sel) => {
  $(sel)?.addEventListener("change", readTimeColumns);
  $(sel)?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); e.target.blur(); }
  });
});

/* ---------- add to result ---------- */

$("#selAddBtn")?.addEventListener("click", () => {
  if (!SELECTION) return;
  const title = `Clip ${timeRange(SELECTION.start)}`;
  const rejected = addToResult(SELECTION.start, SELECTION.end, title, "manual");
  if (rejected) {
    $("#pickNote").textContent = rejected;
    return;
  }
  $("#pickNote").textContent = "added to Result";
  clearSelection();               // selection box is released, not left behind
});
