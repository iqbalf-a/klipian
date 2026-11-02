/* klipian — the Intro & notes label shapes and the intro seconds (pure, so Node can test them)
   ==========================================================================
   `withAngleIntro` is the one place the intro label's shape is written: the panel's Add button (angle.js) and
   the bulk Output format dialog (bulk.js) both go through it. Tests: node tests/angleintro.test.js
   ========================================================================== */

const ANGLE_INTRO_SECONDS = 2.5;       // how long the intro label stays (default; per Result: angle.introSeconds)
const ANGLE_NOTE_SECONDS = 2;          // and each note (angle.noteSeconds)
// Label sizes in the 1080x1920 frame. The render sets a label smaller than the
// preview draws the same size (libass counts the whole line height, the preview
// the em), so these are picked by how the RENDER reads on a phone: the intro as
// large as a default label, notes a step down.
const ANGLE_INTRO_SIZE = 72;
const ANGLE_NOTE_SIZE = 56;

/* The two box styles of a label: the box and its text colour go together. "light" (black on white) is the default for
   new labels; a boxed label with no boxStyle (made before) reads as "dark" (white on black). */
const BOX_LOOKS = { light: { boxStyle: "light", color: "#111111" }, dark: { boxStyle: "dark", color: "#FFFFFF" } };
const ANGLE_BOX_DEFAULT = "light";

/* `overlays` with the box style `style` on every label the Intro & notes panel made (origin "angle-*"), colour included;
   other labels are not touched. */
function withAngleBoxStyle(overlays, style) {
  const look = BOX_LOOKS[style] || BOX_LOOKS[ANGLE_BOX_DEFAULT];
  return overlays.map((o) => (String(o.origin || "").startsWith("angle-") ? { ...o, ...look } : o));
}

/* `overlays` with the intro label for `intro` on it for `seconds` (cut at `total`, the Result's length). An existing
   intro label (origin "angle-intro") gets the text and the end only, never its place, size or colour; with none, one
   is added in `boxStyle`. An empty intro or a Result with no length leaves everything as it is. `nextId()` gives a new overlay id. */
function withAngleIntro(overlays, intro, total, seconds, nextId, boxStyle = ANGLE_BOX_DEFAULT) {
  const text = String(intro || "").trim();
  if (!text || !(total > 0)) return overlays;
  const round2 = (n) => Math.round(n * 100) / 100;
  if (overlays.some((o) => o.origin === "angle-intro")) {
    return overlays.map((o) => (o.origin !== "angle-intro" ? o
      : { ...o, text, end: round2(Math.min(total, (o.start || 0) + seconds)) }));
  }
  const base = typeof OVERLAY_DEFAULTS !== "undefined" ? OVERLAY_DEFAULTS.text : {};
  return [...overlays, { id: nextId(), kind: "text", ...base, ...(BOX_LOOKS[boxStyle] || BOX_LOOKS.light), text, box: true, start: 0,
    end: round2(Math.min(total, seconds)), x: 50, y: 16, size: ANGLE_INTRO_SIZE, origin: "angle-intro" }];
}

if (typeof module !== "undefined" && module.exports) module.exports = { withAngleIntro, withAngleBoxStyle, ANGLE_INTRO_SECONDS, ANGLE_NOTE_SECONDS };
