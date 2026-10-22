/* The gap between clips of the bulk upload's Schedule (clips.js): minutes | hours | days. Pure, so
   node tests/schedgap.test.js can run it. */

const GAP_MS = { minute: 60 * 1000, hour: 3600 * 1000, day: 24 * 3600 * 1000 };

/* The step in milliseconds, or null when the gap is not a whole number of 0 or more (or the unit is unknown). */
function gapStepMs(every, unit) {
  if (!Number.isFinite(every) || !Number.isInteger(every) || every < 0 || !GAP_MS[unit]) return null;
  return every * GAP_MS[unit];
}

/* start + i * gap for i < count, as milliseconds; null when the gap is invalid. */
function gapSlotsMs(startMs, every, unit, count) {
  const step = gapStepMs(every, unit);
  return step === null ? null : Array.from({ length: count }, (_, i) => startMs + i * step);
}

if (typeof module !== "undefined" && module.exports) module.exports = { gapStepMs, gapSlotsMs };
