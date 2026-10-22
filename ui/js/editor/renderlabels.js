/* The words for a render's picture and its time left (shared by the render rows, the plan and the Results list).
   Pure, so node tests/renderlabels.test.js can run it; klipian/jobs.py layout_label() says the same for the server. */

/* What the picture looks like in the 9:16 frame: "9:16", or "16:9 · blur bg · center". `position` is the
   picture's vertical place in the frame (0 = top, 100 = bottom): 50 reads "center", 0 "top", 100 "bottom", any other
   "pos 30%". The same words as layout_label() in klipian/jobs.py (the server's own label for the plan). */
function layoutLabel(picture, background, position) {
  if (picture === "9:16") return "9:16";
  const n = Math.round(Number(position));
  const pos = Number.isFinite(n) ? n : 50;
  const where = pos === 50 ? "center" : pos === 0 ? "top" : pos === 100 ? "bottom" : `pos ${pos}%`;
  return `${picture} · ${background === "black" ? "black" : "blur"} bg · ${where}`;
}

/* A time left, short: "~38 s left", "~4 min left", "~1 h 05 min left". Nothing under 3 seconds or when unknown. */
function fmtLeft(seconds) {
  if (seconds == null || !(seconds >= 3)) return "";
  const s = Math.round(seconds);
  if (s < 90) return `~${s} s left`;
  if (s < 3600) return `~${Math.round(s / 60)} min left`;
  return `~${Math.floor(s / 3600)} h ${String(Math.round((s % 3600) / 60)).padStart(2, "0")} min left`;
}

if (typeof module !== "undefined" && module.exports) module.exports = { layoutLabel, fmtLeft };
