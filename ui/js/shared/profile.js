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

const PROFILE = (() => {
  let id = null;
  try { id = sessionStorage.getItem("klipian:profile"); } catch { /* no storage */ }
  if (!id) { try { id = localStorage.getItem("klipian:last-profile"); } catch { /* no storage */ } }
  return id || "podcast";
})();

try {
  sessionStorage.setItem("klipian:profile", PROFILE);
  localStorage.setItem("klipian:last-profile", PROFILE);
} catch { /* no storage: the default is used on every load */ }

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
      return nativeFetch(input, { ...init, headers });
    }
    return nativeFetch(input, init);
  };
})();
