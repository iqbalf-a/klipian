/* klipian — workspace: shared helpers
   ==========================================================================
   Used by clips.js, render.js, assets.js -- loaded FIRST (see <script>
   order in workspace.html). This page is standalone, doesn't load app.js:
   app.js is bound to index.html elements and doesn't need to be loaded
   here too.
   ========================================================================== */

const $ = (sel, root = document) => root.querySelector(sel);

function escapeHTML(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[c]);
}

/* "just now", "12 min ago", "3 hr ago", "yesterday", then date. */
function timeAgo(epochSeconds) {
  const elapsed = Date.now() / 1000 - epochSeconds;
  if (elapsed < 90) return "just now";
  if (elapsed < 3600) return `${Math.round(elapsed / 60)} min ago`;
  if (elapsed < 86400) return `${Math.round(elapsed / 3600)} hr ago`;
  if (elapsed < 172800) return "yesterday";
  return new Date(epochSeconds * 1000).toLocaleDateString("en-GB",
    { day: "numeric", month: "short" });
}

function updateClock() {
  const el = $("#wsClock");
  if (el) el.textContent = new Date().toLocaleTimeString("en-GB",
    { hour: "2-digit", minute: "2-digit" });
}
updateClock();
setInterval(updateClock, 30000);
