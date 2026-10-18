/* klipian — angle: a point of view on the clip, to make it your own
   ==========================================================================
   Re-posting someone else's clip as it is adds nothing of your own. An angle is
   what you add: a one-line take, an opening line over the first seconds
   (intro), and a few short comments over the clip (notes).

   Claude can suggest one per clip in the same reply that finds the clips
   (roundtrip.py: `angle`), and adding that suggestion to the Result brings it
   here -- but these are drafts. They are edited here, saved with the RESULT
   (`angle`: { take, intro, notes: [{ at, text }] }, left out when empty), and
   NOTHING goes into the video until "Add intro" / "Add notes" is pressed. What
   it adds are ordinary Timeline text labels: move, change or delete them there.

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

/* ---------- putting it on the Timeline ---------- */

function angleNote(text) {
  const el = $("#angleStatus");
  if (el) el.textContent = text;
}

$("#angleAddIntro")?.addEventListener("click", () => {
  const a = currentAngle();
  if (!a?.intro) { angleNote("Write an intro first."); return; }
  const total = tlxTotal();
  if (!total) { angleNote("Add moments to the Result on Clips first."); return; }
  const added = addTextOverlay({
    text: a.intro, start: 0, end: Math.min(total, ANGLE_INTRO_SECONDS), y: 16, size: ANGLE_INTRO_SIZE,
  });
  if (!added) { angleNote("The intro is already on the Timeline."); return; }
  commitOverlays();
  angleNote(`Intro added to the Timeline (0 – ${Math.min(total, ANGLE_INTRO_SECONDS)} s).`);
});

$("#angleAddNotes")?.addEventListener("click", () => {
  const a = currentAngle();
  if (!a?.notes.length) { angleNote("Write a note first."); return; }
  const total = tlxTotal();
  if (!total) { angleNote("Add moments to the Result on Clips first."); return; }
  let added = 0, skipped = 0;
  for (const n of a.notes) {
    const start = Math.max(0, Math.min(n.at, Math.max(0, total - 0.5)));
    const ok = addTextOverlay({
      text: n.text, start, end: Math.min(total, start + ANGLE_NOTE_SECONDS), y: 28, size: ANGLE_NOTE_SIZE,
    });
    if (ok) added++; else skipped++;
  }
  if (added) commitOverlays();
  angleNote(added
    ? `${added} note${added === 1 ? "" : "s"} added to the Timeline`
      + (skipped ? ` · ${skipped} already there` : "")
    : "The notes are already on the Timeline.");
});

/* ---------- wiring ---------- */

["#angleTake", "#angleIntro"].concat(
  Array.from({ length: ANGLE_NOTE_ROWS }, (_, i) => [`#angleNoteAt${i}`, `#angleNoteText${i}`]).flat(),
).forEach((sel) => {
  $(sel)?.addEventListener("input", () => {
    updateAngleCount();
    if (typeof saveProject === "function") saveProject();
  });
});

updateAngleCount();
