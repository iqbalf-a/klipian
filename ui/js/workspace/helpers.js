/* klipian — workspace: helper bersama
   ==========================================================================
   Dipakai oleh clips.js, render.js, assets.js -- dimuat PALING AWAL (lihat
   urutan <script> di workspace.html). Halaman ini berdiri sendiri, tidak
   memuat app.js: app.js terikat ke elemen index.html dan tidak perlu
   dibebankan ke sini juga.
   ========================================================================== */

const $ = (sel, root = document) => root.querySelector(sel);

function escapeHTML(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[c]);
}

/* "just now", "12 min ago", "3 hr ago", "yesterday", lalu tanggal. */
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
