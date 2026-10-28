/* The narration panel's pure parts (no DOM): which voice target the select shows, and what a change of the select does to the text shown.
   Used by ui/js/remotion/page.js and tested by node tests/narration.test.js. */

// the target the select shows: the one the person just picked, else the target of the export shown for this video, else the project's option
function narrationTarget(d, shown, picked) {
  if (picked) return picked;
  if (shown && shown.forId === d.id && shown.target) return shown.target;
  return (d.options && d.options.voiceTarget) || "voicestudio";
}

// a change of the select clears the text shown: the text and the label never disagree
function narrationAfterChange(picked) {
  return { picked, shown: null };
}

if (typeof module !== "undefined" && module.exports) module.exports = { narrationTarget, narrationAfterChange };
