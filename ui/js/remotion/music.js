/* The music choices of a video, with the labels the page shows. The same labels are in klipian/motion.py (MUSIC_LABELS); a selftest checks that
   they match. The keys are the options' values, in the order of the select. */
const MUSIC_LABELS = { sunny: "Ceria", bounce: "Pantul", glow: "Hangat", curious: "Penasaran", calm: "Tenang (lama)", tech: "Teknologi (lama)", none: "Tanpa musik" };

if (typeof module !== "undefined" && module.exports) module.exports = { MUSIC_LABELS };
