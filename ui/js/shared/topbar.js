/* klipian — topbar: theme, clock, help popover
   ==========================================================================
   The three controls on the RIGHT of the topbar, shared by both pages.
   They used to be split: theme lived in editor/app.js, the "?" popover in
   editor/player.js, the clock in workspace/helpers.js -- so the editor had
   theme + help and no clock, /workspace had a clock and neither of the
   other two. ian asked for all three, identical on both pages, which is
   only honest if there is ONE copy of each.

   Every lookup here is document.getElementById, not the `$` helper both
   pages define for themselves: app.js and workspace/helpers.js each
   declare `const $` at top level, and top-level const is shared across
   <script> tags on one page -- declaring a third would be a SyntaxError on
   whichever page loaded it second.
   ========================================================================== */

/* Theme: "auto" (follow the OS), "dark" or "light".

   "auto" is stored as the ABSENCE of data-theme, not as data-theme="auto",
   because the CSS decides it with :root:not([data-theme]) inside a
   prefers-color-scheme query -- so removing the attribute is what hands
   control back to the OS. A data-theme="auto" value would match neither
   branch and land the page on the dark defaults. */
const THEME_KEY = "klipian:theme";
const THEMES = ["auto", "dark", "light"];

function applyTheme(mode) {
  const root = document.documentElement;
  if (mode === "auto") root.removeAttribute("data-theme");
  else root.dataset.theme = mode;

  const btn = document.getElementById("themeBtn");
  if (!btn) return;
  const osIsLight = window.matchMedia?.("(prefers-color-scheme: light)").matches;
  const effective = mode === "auto" ? (osIsLight ? "light" : "dark") : mode;
  // The icon shows what you are LOOKING AT; the label says where it came
  // from. Showing "the other one" is the common alternative and it reads
  // as a lie when the answer is "whatever the system says".
  btn.textContent = effective === "light" ? "☀" : "☾";
  btn.title = mode === "auto"
    ? `Theme: follows your system (currently ${effective}): click to lock it`
    : `Theme: ${mode}: click for ${THEMES[(THEMES.indexOf(mode) + 1) % THEMES.length]}`;
  btn.setAttribute("aria-label", btn.title);
  btn.dataset.mode = mode;
}

function readTheme() {
  try {
    const v = localStorage.getItem(THEME_KEY);
    return THEMES.includes(v) ? v : "auto";
  } catch { return "auto"; }        // private window / storage blocked
}

document.getElementById("themeBtn")?.addEventListener("click", () => {
  const next = THEMES[(THEMES.indexOf(readTheme()) + 1) % THEMES.length];
  try { localStorage.setItem(THEME_KEY, next); } catch { /* not persisted */ }
  applyTheme(next);
});

// Keep the button honest while on "auto" and the OS flips underneath us.
window.matchMedia?.("(prefers-color-scheme: light)")
  .addEventListener?.("change", () => { if (readTheme() === "auto") applyTheme("auto"); });

applyTheme(readTheme());

/* Clock -- 30s interval, not 1s: it shows HH:MM, so a per-second tick
   would repaint 59 times for nothing. */
function updateTopClock() {
  const el = document.getElementById("topClock");
  if (!el) return;
  el.textContent = new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  el.title = `Time on this computer (${Intl.DateTimeFormat().resolvedOptions().timeZone})`;
}
updateTopClock();
setInterval(updateTopClock, 30000);

/* Help popover -- "?" toggles open/closed, not always visible (the topbar
   is already tight; permanent help text would crowd out everything else).
   Close again on outside click or Escape -- standard popover pattern,
   don't leave it hanging open until manually closed via its own button.

   Only the MECHANICS are shared. What's inside #shortcutPanel is written
   per page in its own HTML, because the two pages genuinely differ: the
   editor lists the transport shortcuts (they only exist where there's a
   player), /workspace explains what its three sections are. */
(function helpPopover() {
  const btn = document.getElementById("shortcutHelpBtn");
  const panel = document.getElementById("shortcutPanel");
  if (!btn || !panel) return;
  const close = () => {
    panel.hidden = true;
    btn.setAttribute("aria-expanded", "false");
  };
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    const open = panel.hidden;
    panel.hidden = !open;
    btn.setAttribute("aria-expanded", String(open));
  });
  document.addEventListener("click", (e) => {
    if (!panel.hidden && !panel.contains(e.target) && e.target !== btn) close();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !panel.hidden) close();
  });
})();


/* The area switch, ONE copy for every page. A page only has `<nav class="tabs area-switch" aria-label="Area" data-area="edit|workspace|sources|motion|autopilot|guide">`
   (and data-guide="#motion" for a guide anchor); the links are made here. A profile that only makes Motion videos (/api/profiles "focus": "motion", from
   klipian/profiles.py) gets Motion first and its brand link goes to /create-motion, so it does not land on an empty Edit screen. */
(function areaSwitch() {
  const navs = [...document.querySelectorAll("nav.area-switch[data-area]")];
  if (!navs.length) return;
  // Four goals in the bar; Edit, Sources and Autopilot are one goal ("Cut": clips from a long video) with a second row under the bar.
  const PAGES = { edit: "/", sources: "/sources", autopilot: "/autopilot", motion: "/create-motion", workspace: "/library", guide: "/guide" };
  const GROUPS = { create: ["motion"], cut: ["edit", "sources", "autopilot"], clips: ["workspace"], guide: ["guide"] };
  const LABEL = { create: "Create Motion", cut: "Cut Clips", clips: "Library", guide: "Guide", edit: "Edit", sources: "Sources", autopilot: "Autopilot" };
  const ORDER = { edit: ["cut", "clips", "create", "guide"], motion: ["create", "clips", "cut", "guide"] };
  const groupOf = (area) => Object.keys(GROUPS).find((g) => GROUPS[g].includes(area));
  const draw = (focus) => {
    for (const nav of navs) {
      const here = groupOf(nav.dataset.area);
      nav.replaceChildren(...ORDER[focus].map((g) => {
        const a = document.createElement("a");
        a.href = PAGES[GROUPS[g][0]] + (g === "guide" ? nav.dataset.guide || "" : "");
        a.textContent = LABEL[g];
        if (g === here) a.setAttribute("aria-current", "page");
        return a;
      }));
      const head = nav.closest("header");
      if (head.nextElementSibling?.classList.contains("subnav")) head.nextElementSibling.remove();   // draw() runs again once the profile focus is known
      if (here === "cut") {
        const sub = document.createElement("nav");
        sub.className = "subnav";
        sub.setAttribute("aria-label", "Cut");
        sub.replaceChildren(...GROUPS.cut.map((k) => {
          const a = document.createElement("a");
          a.href = PAGES[k];
          a.textContent = LABEL[k];
          if (k === nav.dataset.area) a.setAttribute("aria-current", "page");
          return a;
        }));
        head.after(sub);
      }
    }
    const brand = document.querySelector("a.brand");
    if (brand) brand.setAttribute("href", focus === "motion" ? "/create-motion" : "/");
  };
  let cached = null;
  try { cached = JSON.parse(sessionStorage.getItem("klipian:profile-meta") || "null"); } catch { /* no storage */ }
  draw(cached && cached.focus === "motion" ? "motion" : "edit");   // the last known order, so the links do not reorder when the fetch answers
  let id = null;
  try { id = sessionStorage.getItem("klipian:profile"); } catch { /* no storage */ }
  if (!id) return;
  fetch("/api/profiles").then((r) => r.json()).then((j) => {
    const mine = (j.profile || []).find((p) => p.id === id);
    draw(mine && mine.focus === "motion" ? "motion" : "edit");
  }).catch(() => { /* the default order stays */ });
})();


/* Show the page all at once: it stays invisible until the bar, the profile chip, the fonts and everything the page fetched on load have arrived and
   nothing has been asked for 120 ms (or 1.5 s at most), so no panel slides in after another.
   shortcut: images and anything a click loads later still arrive on their own; the requests are counted by the fetch wrapper in topbar-build.js. */
(function uiReveal() {
  const root = document.documentElement;
  if (!root.classList.contains("ui-pending")) return;
  const t0 = performance.now();
  let quiet = t0;
  const chipReady = () => { const c = document.getElementById("profileChip"); return !c || c.children.length > 0; };
  let fontsOk = false;
  (document.fonts?.ready || Promise.resolve()).then(() => { fontsOk = true; });
  (function wait() {
    const now = performance.now();
    if (window.uiBusy?.() > 0 || document.readyState !== "complete") quiet = now;
    if ((fontsOk && chipReady() && now - quiet >= 120) || now - t0 > 1500) {
      requestAnimationFrame(() => root.classList.remove("ui-pending"));
      return;
    }
    setTimeout(wait, 30);
  })();
})();
