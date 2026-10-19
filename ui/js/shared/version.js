/* klipian — is the server older than the page? (shared by the editor and /workspace)
   ==========================================================================
   The pages are read from disk on every request, so they are always the newest; the
   server's Python is what it loaded when it started. After an update the page can call
   an endpoint the running server does not have ("unknown endpoint"). This puts a banner
   at the top that cannot be missed:
     - /api/version says the code on disk is not what the server runs (checked at load,
       when the tab is shown again, and every minute), or
     - the server does not have /api/version at all (it is older than this check), or
     - any API reply is "unknown endpoint".
   It only ever shows a message; nothing is restarted from here.
   ========================================================================== */

const STALE_MESSAGE = "klipian was updated. Restart the server (Ctrl+C, then start.cmd) to use it.";

function showStaleBanner() {
  if (document.getElementById("staleBanner")) return;
  const bar = document.createElement("div");
  bar.id = "staleBanner";
  bar.className = "stale-banner";
  bar.setAttribute("role", "alert");
  bar.textContent = STALE_MESSAGE;
  document.body.prepend(bar);
}

/* "unknown endpoint" as the person should read it. */
function apiErrorText(message) {
  return /unknown endpoint/i.test(String(message || "")) ? STALE_MESSAGE : String(message || "");
}

(function watchServerVersion() {
  const nativeFetch = window.fetch.bind(window);
  window.fetch = async (...args) => {
    const reply = await nativeFetch(...args);
    if (reply.status === 404) {
      reply.clone().json().then((j) => { if (/unknown endpoint/i.test(j?.error || "")) showStaleBanner(); }).catch(() => {});
    }
    return reply;
  };
  async function check() {
    try {
      const reply = await nativeFetch("/api/version", { cache: "no-store" });
      if (reply.status === 404) { showStaleBanner(); return; }       // a server from before this check
      const v = await reply.json();
      if (v.stale) showStaleBanner();
    } catch { /* no server to ask: the pages say so elsewhere */ }
  }
  check();
  document.addEventListener("visibilitychange", () => { if (!document.hidden) check(); });
  setInterval(check, 60000);
})();
