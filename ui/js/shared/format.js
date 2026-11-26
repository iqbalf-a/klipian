/* klipian — small formatters shared by the editor (index.html) and the workspace page. A classic script: the names are global. */

/* Escape one value for innerHTML (anything but null and undefined is turned into text first). */
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
