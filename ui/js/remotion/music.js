/* The music choices of a video, with the labels the page shows. The same labels are in klipian/motion.py (MUSIC_LABELS); a selftest checks that
   they match. The keys are the options' values, in the order of the select. */
const MUSIC_LABELS = { sunny: "Cheerful", bounce: "Bouncy", glow: "Warm", curious: "Curious", circuit: "Technology (circuit)", neon: "Technology (neon)", pixel: "Technology (pixel)", study: "Study", breeze: "Relaxed", calm: "Calm (old)", tech: "Technology (old)", none: "No music" };

if (typeof module !== "undefined" && module.exports) module.exports = { MUSIC_LABELS };
