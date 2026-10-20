/* klipian — which profile this tab is working in (shared by the editor and /workspace)
   ==========================================================================
   A profile is one channel: its own sources, projects, renders, schedule and assets
   (klipian/profiles.py). It is chosen PER TAB (sessionStorage), never per server, so two
   tabs can work in two profiles side by side. Every API call carries it in the
   X-Klipian-Profile header; a <video>, <img> or <a> cannot send a header, so those URLs
   get ?profile= (profileUrl()). The server refuses a call that has neither.

   Loaded FIRST on every page. The settings that belong to a profile (preset, last
   session, ...) are kept under profileKey(), so another profile never sees them;
   klipian:theme stays global.
   ========================================================================== */

const PROFILE_PICKER = "/profiles";

/* This tab's profile. A tab that has none (a new tab, a bookmark) goes to the picker
   first and comes back here: "Satu klik untuk masuk". */
const PROFILE = (() => {
  let id = null;
  try { id = sessionStorage.getItem("klipian:profile"); } catch { /* no storage */ }
  if (!id) {
    // Without any storage the picker could never remember the choice: fall back to the
    // last profile rather than loop.
    let storageWorks = true;
    try { sessionStorage.setItem("klipian:probe", "1"); sessionStorage.removeItem("klipian:probe"); }
    catch { storageWorks = false; }
    if (storageWorks) {
      location.replace(`${PROFILE_PICKER}?next=${encodeURIComponent(location.pathname + location.search)}`);
      return "";
    }
    try { id = localStorage.getItem("klipian:last-profile"); } catch { /* none */ }
  }
  return id || "podcast";
})();

document.documentElement.dataset.guest = PROFILE === "_guest" ? "true" : "false";
const IS_GUEST = PROFILE === "_guest";

const profileKey = (key) => `p:${PROFILE}:${key}`;

function profileUrl(url) {
  return `${url}${url.includes("?") ? "&" : "?"}profile=${encodeURIComponent(PROFILE)}`;
}

(function sendProfileWithApiCalls() {
  const nativeFetch = window.fetch.bind(window);
  window.fetch = (input, init = {}) => {
    const url = typeof input === "string" ? input : (input?.url || "");
    const path = url.startsWith("http") ? new URL(url).pathname : url.split("?")[0];
    if (path.startsWith("/api/") && !path.startsWith("/api/profiles")) {
      const headers = new Headers(init.headers || (typeof input !== "string" ? input.headers : undefined));
      headers.set("X-Klipian-Profile", PROFILE);
      return nativeFetch(input, { ...init, headers }).then((reply) => {
        // This profile was deleted (or never existed): back to the picker.
        if (reply.status === 404) {
          reply.clone().json().then((j) => {
            if (j?.needProfile) {
              try { sessionStorage.removeItem("klipian:profile"); } catch { /* none */ }
              location.replace(`${PROFILE_PICKER}?next=${encodeURIComponent(location.pathname)}`);
            }
          }).catch(() => {});
        }
        return reply;
      });
    }
    return nativeFetch(input, init);
  };
})();
