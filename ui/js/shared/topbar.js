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
    ? `Theme: follows your system (currently ${effective}) — click to lock it`
    : `Theme: ${mode} — click for ${THEMES[(THEMES.indexOf(mode) + 1) % THEMES.length]}`;
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
  if (el) el.textContent = new Date().toLocaleTimeString("en-GB",
    { hour: "2-digit", minute: "2-digit" });
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
