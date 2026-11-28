/* klipian — the topbar, ONE component for every page. A page has only
     <header data-topbar="motion" [data-guide="#motion"]> optional <template data-slot="lead"> and <template data-slot="help"> </header>
   and this file (loaded right after the header, before the first paint) makes the rest: the brand, the area menu, the profile chip, theme, "?" and the clock.
   "lead" replaces the brand when a page has more on the left (Edit: Home and the file name); "help" is the page's own text in the "?" panel.
   shared/topbar.js then wires the menu, the theme, the clock and the "?". */
(function buildTopbar() {
  const h = document.querySelector("header[data-topbar]");
  if (!h) return;
  document.documentElement.classList.add("ui-pending");   // the page is shown all at once by topbar.js (uiReveal), not piece by piece
  // count the page's own requests, so the page can wait until what it fetches (lists, status) has arrived before it shows (uiReveal in topbar.js)
  let inflight = 0;
  window.uiBusy = () => inflight;
  const realFetch = window.fetch;
  window.fetch = function (...a) {
    inflight++;
    const p = realFetch.apply(this, a);
    const done = () => { inflight--; };
    p.then(done, done);
    return p;
  };
  const area = h.dataset.topbar;
  const slot = (n) => h.querySelector(`template[data-slot="${n}"]`)?.innerHTML;
  const lead = slot("lead") ?? '<a class="brand" href="/" title="Back to editor">klipian</a>';
  const guideLink = area === "guide" ? "" : `<p class="shortcut-guide"><a href="/guide${h.dataset.guide || ""}" target="_blank" rel="noopener">Guide →</a></p>`;
  const help = slot("help") ?? ({
    guide: "<p>Use the contents on the left to jump to a topic.</p>",
    autopilot: "<p>Paste YouTube links: klipian downloads them, picks the clips, renders and schedules the upload.</p>",
  }[area] || "<p>The area and the profile are in the bar above.</p>") + guideLink;
  h.innerHTML = `${lead}
    <nav class="tabs area-switch" aria-label="Area" id="areaSwitch" data-area="${area}" data-guide="${h.dataset.guide || ""}"></nav>
    <div id="profileChip"></div>
    <button class="btn quiet" id="themeBtn" type="button" aria-live="polite"></button>
    <div class="shortcut-help">
      <button class="btn quiet" id="shortcutHelpBtn" type="button" title="Help and the guide" aria-label="Help" aria-expanded="false">?</button>
      <div class="shortcut-panel" id="shortcutPanel" hidden role="region" aria-label="Help">${help}</div>
    </div>
    <span id="topClock"></span>`;
})();
