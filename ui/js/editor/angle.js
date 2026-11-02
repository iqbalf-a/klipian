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
// The seconds the intro and each note stay, and the label sizes: angleintro.js.

/* The seconds in the panel's two inputs (1 to 10), or the default. */
function angleSeconds(id, fallback) {
  const v = parseFloat($(id)?.value);
  return Number.isFinite(v) ? Math.min(10, Math.max(1, v)) : fallback;
}
/* The box style of the labels this panel makes: "light" (black text on white, the default) or "dark". */
let angleBox = ANGLE_BOX_DEFAULT;
function setAngleBox(style) {
  angleBox = style === "dark" ? "dark" : "light";
  document.querySelectorAll("[data-angle-box]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.angleBox === angleBox)));
}
const introSeconds = () => angleSeconds("#angleIntroSec", ANGLE_INTRO_SECONDS);
const noteSeconds = () => angleSeconds("#angleNoteSec", ANGLE_NOTE_SECONDS);

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
  if (!(take || intro || notes.length)) return null;
  const angle = { take, intro, notes };
  // The seconds are written only when they differ from the defaults (old projects have neither).
  if (introSeconds() !== ANGLE_INTRO_SECONDS) angle.introSeconds = introSeconds();
  if (noteSeconds() !== ANGLE_NOTE_SECONDS) angle.noteSeconds = noteSeconds();
  if (angleBox !== ANGLE_BOX_DEFAULT) angle.boxStyle = angleBox;
  return angle;
}

function updateAngleCount() {
  const n = wordCount($("#angleIntro")?.value);
  const el = $("#angleIntroCount");
  if (el) {
    el.textContent = `${n} / ${ANGLE_INTRO_WORDS} words`;
    el.dataset.over = String(n > ANGLE_INTRO_WORDS);
  }
}

/* Which Result the Angle panel is showing (see postOwner in post.js). */
let angleOwner = null;

function setAngleFields(angle) {
  angleOwner = (typeof activeResultId !== "undefined") ? activeResultId : null;
  const a = angle || {};
  if ($("#angleTake")) $("#angleTake").value = a.take || "";
  if ($("#angleIntro")) $("#angleIntro").value = a.intro || "";
  if ($("#angleIntroSec")) $("#angleIntroSec").value = a.introSeconds || ANGLE_INTRO_SECONDS;
  if ($("#angleNoteSec")) $("#angleNoteSec").value = a.noteSeconds || ANGLE_NOTE_SECONDS;
  setAngleBox(a.boxStyle);
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

/* The part's text and time, written into its label (not its place, size or colour). With `duration`, also how long
   it stays (the seconds inputs changed); otherwise a length trimmed on the Timeline is left alone. */
function syncAngleLabel(part, duration = false) {
  const label = angleLabel(part);
  if (!label) return false;
  const { text, at } = anglePart(part);
  if (!text) return false;                       // an emptied field leaves the label as it is
  label.text = text;
  const total = tlxTotal();
  if (part !== "intro") {
    const start = Math.max(0, Math.min(at, Math.max(0, total - 0.5)));
    const length = duration ? noteSeconds() : label.end - label.start;
    label.start = round2(start);
    label.end = round2(Math.min(total || start + length, start + length));
  } else if (duration) {
    label.end = round2(Math.min(total || label.start + introSeconds(), label.start + introSeconds()));
  }
  return true;
}

function addAngleLabel(part) {
  const total = tlxTotal();
  if (!total) { angleStatus("Add moments to the Result on Clips first."); return; }
  const { text, at } = anglePart(part);
  if (!text) return;
  if (part === "intro") {
    OVERLAYS = withAngleIntro(OVERLAYS, text, total, introSeconds(), () => `o${++overlaySeq}`, angleBox);
  } else {
    const start = Math.max(0, Math.min(at, Math.max(0, total - 0.5)));
    OVERLAYS.push({ id: `o${++overlaySeq}`, kind: "text", ...OVERLAY_DEFAULTS.text, text, box: true,
      start: round2(start), end: round2(Math.min(total, start + noteSeconds())), x: 50, y: 28,
      size: ANGLE_NOTE_SIZE, ...BOX_LOOKS[angleBox], origin: originOf(part) });
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

/* "Refill from suggestion": the suggestion this Result came from (post.js,
   suggestionForResult). The labels already on the video follow the new words. */
$("#angleRefill")?.addEventListener("click", (e) => {
  armRefill(e.currentTarget, "angle", !!currentAngle(), (k) => {
    setAngleFields(k.angle);
    if (ANGLE_PARTS.some((part) => syncAngleLabel(part))) commitOverlays();
    if (typeof saveProject === "function") saveProject();
  }, angleStatus);
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

// The box choice: the labels already on the video change look (their text, place and size stay).
document.querySelector("#angleBoxRow")?.addEventListener("click", (e) => {
  const b = e.target.closest("[data-angle-box]");
  if (!b) return;
  setAngleBox(b.dataset.angleBox);
  OVERLAYS = withAngleBoxStyle(OVERLAYS, angleBox);
  commitOverlays();
});

// The seconds inputs: how long the labels already on the video stay, and the length of the next one added.
[["#angleIntroSec", "intro"], ["#angleNoteSec", null]].forEach(([sel, only]) => {
  $(sel)?.addEventListener("input", () => {
    const changed = ANGLE_PARTS.filter((part) => (only ? part === "intro" : part !== "intro"))
      .map((part) => syncAngleLabel(part, true)).some(Boolean);
    if (changed) commitOverlays(); else if (typeof saveProject === "function") saveProject();
  });
});

updateAngleCount();
// (renderAngleStates() runs when a Result's fields and labels are loaded, not
// here: the Timeline's OVERLAYS, in compose.js, are not defined yet at this point.)
