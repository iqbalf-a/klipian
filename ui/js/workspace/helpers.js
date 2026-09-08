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
function kapan(detikEpoch) {
  const lalu = Date.now() / 1000 - detikEpoch;
  if (lalu < 90) return "just now";
  if (lalu < 3600) return `${Math.round(lalu / 60)} min ago`;
  if (lalu < 86400) return `${Math.round(lalu / 3600)} hr ago`;
  if (lalu < 172800) return "yesterday";
  return new Date(detikEpoch * 1000).toLocaleDateString("en-GB",
    { day: "numeric", month: "short" });
}

function jamSekarang() {
  const el = $("#wsClock");
  if (el) el.textContent = new Date().toLocaleTimeString("id-ID",
    { hour: "2-digit", minute: "2-digit" });
}
jamSekarang();
setInterval(jamSekarang, 30000);
