/* klipian — angle: a point of view on the clip, to make it your own
   ==========================================================================
   Re-posting someone else's clip as it is adds nothing of your own. An angle is
   what you add: a one-line take, an opening line over the first seconds
   (intro), and a few short comments over the clip (notes).

   Claude can suggest one per clip in the same reply that finds the clips
   (roundtrip.py: `angle`), and adding that suggestion to the Result brings it
   here -- but these are drafts. They are edited here, saved with the RESULT
   (`angle`: { take, intro, notes: [{ at, text }] }, left out when empty), and
   NOTHING goes into the video until "Add" is pressed on the intro or a note.
   What it adds are ordinary Timeline text labels: move, change or delete them
   there, or manage them from this panel (see "the labels it puts on the video").

   `at` of a note is seconds from the start of the clip. For a Result of several
   moments that is the start of the Result (its first moment), which is where
   its output time begins: a suggestion made for a later moment may want its
   times moved.
   ========================================================================== */

const ANGLE_INTRO_WORDS = 12;
const ANGLE_NOTE_ROWS = 3;
const ANGLE_INTRO_SECONDS = 2.5;       // how long the intro label stays
const ANGLE_NOTE_SECONDS = 2;          // and each note
// Label sizes in the 1080x1920 frame. The render sets a label smaller than the
// preview draws the same size (libass counts the whole line height, the preview
// the em), so these are picked by how the RENDER reads on a phone: the intro as
// large as a default label, notes a step down.
const ANGLE_INTRO_SIZE = 72;
const ANGLE_NOTE_SIZE = 56;

const wordCount = (s) => (String(s || "").trim().match(/\S+/g) || []).length;

/* The angle as the fields hold it, or null when everything is empty. */
function currentAngle() {
  const take = ($("#angleTake")?.value || "").trim();
  const intro = ($("#angleIntro")?.value || "").trim();
  const notes = [];
  for (let i = 0; i < ANGLE_NOTE_ROWS; i++) {
    const text = ($(`#angleNoteText${i}`)?.value || "").trim();
    if (!text) continue;
    const at = parseFloat($(`#angleNoteAt${i}`)?.value);
    notes.push({ at: Number.isFinite(at) ? Math.max(0, Math.round(at * 100) / 100) : 0, text });
  }
  notes.sort((a, b) => a.at - b.at);
  return (take || intro || notes.length) ? { take, intro, notes } : null;
}

function updateAngleCount() {
  const n = wordCount($("#angleIntro")?.value);
  const el = $("#angleIntroCount");
  if (el) {
    el.textContent = `${n} / ${ANGLE_INTRO_WORDS} words`;
    el.dataset.over = String(n > ANGLE_INTRO_WORDS);
  }
}

function setAngleFields(angle) {
  const a = angle || {};
  if ($("#angleTake")) $("#angleTake").value = a.take || "";
  if ($("#angleIntro")) $("#angleIntro").value = a.intro || "";
  for (let i = 0; i < ANGLE_NOTE_ROWS; i++) {
    const n = (a.notes || [])[i];
    if ($(`#angleNoteAt${i}`)) $(`#angleNoteAt${i}`).value = n ? n.at : "";
    if ($(`#angleNoteText${i}`)) $(`#angleNoteText${i}`).value = n ? n.text : "";
  }
  updateAngleCount();
  if (typeof renderAngleStates === "function") renderAngleStates();
}

const clearAngleFields = () => setAngleFields(null);

/* The first added suggestion's angle comes along, into an empty one (like the
   post text, post.js): a manual range brings nothing, and nothing already
   written is replaced. */
function carryAngleFrom(candidates) {
  if (currentAngle()) return;
  const first = candidates.find((k) => k?.angle);
  if (!first) return;
  setAngleFields(first.angle);
  if (typeof saveProject === "function") saveProject();
}

/* ---------- the labels it puts on the video ----------
   Each part (the intro, each note) can be put on the video as an ordinary
   Timeline text label, and the label remembers which part made it (`origin`:
   "angle-intro", "angle-note-0".."2"). The panel shows, per part, whether it is
   on the video and lets you add or remove it; editing the text (or a note's
   time) here changes that label, and deleting the label on the Timeline puts the
   part back to "Add". Position, size and colour changed on the Timeline are
   left alone. A label with no origin is never touched. */

const originOf = (part) => (part === "intro" ? "angle-intro" : `angle-note-${part}`);
const angleLabel = (part) => OVERLAYS.find((o) => o.origin === originOf(part));

function angleStatus(text) {
  const el = $("#angleStatus");
  if (el) el.textContent = text;
}

/* What each part says now: its text and, for a note, its start second. */
function anglePart(part) {
  if (part === "intro") return { text: ($("#angleIntro")?.value || "").trim() };
  const text = ($(`#angleNoteText${part}`)?.value || "").trim();
  const at = parseFloat($(`#angleNoteAt${part}`)?.value);
  return { text, at: Number.isFinite(at) ? Math.max(0, at) : 0 };
}

const ANGLE_PARTS = ["intro", 0, 1, 2];

/* Labels made before they carried an origin (the first version of this panel):
   matched once by their words, then marked, so they are managed from here too. */
function adoptAngleLabels() {
  const same = (t) => String(t || "").trim().toLowerCase();
  for (const part of ANGLE_PARTS) {
    if (angleLabel(part)) continue;
    const { text } = anglePart(part);
    if (!text) continue;
    const old = OVERLAYS.find((o) => o.kind === "text" && !o.origin && same(o.text) === same(text));
    if (old) old.origin = originOf(part);
  }
}

/* One line per part, at the right of its field: "Add", or "on the video" and "Remove". */
function renderAngleStates() {
  if (!$("#anglePanel")) return;
  adoptAngleLabels();
  for (const part of ANGLE_PARTS) {
    const box = document.querySelector(`[data-angle-act="${part}"]`);
    if (!box) continue;
    const { text } = anglePart(part);
    const label = angleLabel(part);
    box.innerHTML = label
      ? `<span class="angle-on">on the video</span><button class="btn quiet" type="button" data-angle-remove="${part}">Remove</button>`
      : `<button class="btn" type="button" data-angle-add="${part}"${text ? "" : " disabled"}>Add</button>`;
  }
}

/* The part's text and time, written into its label (not its place, size or colour). */
function syncAngleLabel(part) {
  const label = angleLabel(part);
  if (!label) return false;
  const { text, at } = anglePart(part);
  if (!text) return false;                       // an emptied field leaves the label as it is
  label.text = text;
  if (part !== "intro") {
    const total = tlxTotal();
    const start = Math.max(0, Math.min(at, Math.max(0, total - 0.5)));
    const length = label.end - label.start;
    label.start = round2(start);
    label.end = round2(Math.min(total || start + length, start + length));
  }
  return true;
}

function addAngleLabel(part) {
  const total = tlxTotal();
  if (!total) { angleStatus("Add moments to the Result on Clips first."); return; }
  const { text, at } = anglePart(part);
  if (!text) return;
  if (part === "intro") {
    OVERLAYS.push({ id: `o${++overlaySeq}`, kind: "text", ...OVERLAY_DEFAULTS.text, text, box: true,
      start: 0, end: round2(Math.min(total, ANGLE_INTRO_SECONDS)), x: 50, y: 16, size: ANGLE_INTRO_SIZE,
      origin: originOf("intro") });
  } else {
    const start = Math.max(0, Math.min(at, Math.max(0, total - 0.5)));
    OVERLAYS.push({ id: `o${++overlaySeq}`, kind: "text", ...OVERLAY_DEFAULTS.text, text, box: true,
      start: round2(start), end: round2(Math.min(total, start + ANGLE_NOTE_SECONDS)), x: 50, y: 28,
      size: ANGLE_NOTE_SIZE, origin: originOf(part) });
  }
  commitOverlays();
  angleStatus(part === "intro" ? "Intro is on the video." : `Note ${part + 1} is on the video.`);
}

document.querySelector("#anglePanel")?.addEventListener("click", (e) => {
  const add = e.target.closest("[data-angle-add]");
  const rem = e.target.closest("[data-angle-remove]");
  if (add) {
    const part = add.dataset.angleAdd === "intro" ? "intro" : Number(add.dataset.angleAdd);
    // A label with the same words but no origin (made by hand) is taken over
    // rather than duplicated.
    adoptAngleLabels();
    if (angleLabel(part)) { renderAngleStates(); return; }
    addAngleLabel(part);
  } else if (rem) {
    const part = rem.dataset.angleRemove === "intro" ? "intro" : Number(rem.dataset.angleRemove);
    OVERLAYS = OVERLAYS.filter((o) => o.origin !== originOf(part));
    tlxSel = null;
    commitOverlays();
    angleStatus("Removed from the video.");
  }
});

/* ---------- wiring ---------- */

["#angleTake", "#angleIntro"].concat(
  Array.from({ length: ANGLE_NOTE_ROWS }, (_, i) => [`#angleNoteAt${i}`, `#angleNoteText${i}`]).flat(),
).forEach((sel) => {
  $(sel)?.addEventListener("input", () => {
    updateAngleCount();
    // Editing a part that is on the video edits its label.
    const changed = ANGLE_PARTS.some((part) => syncAngleLabel(part));
    if (changed) commitOverlays(); else renderAngleStates();
    if (typeof saveProject === "function") saveProject();
  });
});

updateAngleCount();
// (renderAngleStates() runs when a Result's fields and labels are loaded, not
// here: the Timeline's OVERLAYS, in compose.js, are not defined yet at this point.)
