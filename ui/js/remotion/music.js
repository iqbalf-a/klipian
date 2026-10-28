/* The music choices of a video, with the labels the page shows. The same labels are in klipian/motion.py (MUSIC_LABELS); a selftest checks that
   they match. The keys are the options' values. The beds of the new stage are added here only when their names are final (PLAN-VARIETY). */
const MUSIC_LABELS = { calm: "Tenang (lama)", tech: "Teknologi (lama)", none: "Tanpa musik" };

if (typeof module !== "undefined" && module.exports) module.exports = { MUSIC_LABELS };
