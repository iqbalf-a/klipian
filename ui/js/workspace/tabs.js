/* /library: the three panels (Clips, Rendered output, Assets) one at a time. The tab is kept in the address (#render, #assets) so Back and a reload return to it. */
(function () {
  const TABS = { clips: "panelClips", render: "panelRender", assets: "panelAssets" };
  const bar = document.getElementById("wsTabs");
  function show(key) {
    if (!TABS[key]) key = "clips";
    for (const [k, id] of Object.entries(TABS)) {
      const on = k === key;
      const panel = document.getElementById(id);
      if (panel) panel.hidden = !on;
      const tab = bar.querySelector(`[data-panel="${id}"]`);
      tab.setAttribute("aria-selected", String(on));
      tab.setAttribute("aria-pressed", String(on));
    }
  }
  const keyOf = () => location.hash.slice(1);
  bar.addEventListener("click", (e) => {
    const b = e.target.closest("button[data-panel]");
    if (!b) return;
    const key = Object.keys(TABS).find((k) => TABS[k] === b.dataset.panel);
    history.replaceState(null, "", key === "clips" ? location.pathname : `#${key}`);
    show(key);
  });
  window.addEventListener("hashchange", () => show(keyOf()));
  show(keyOf());
})();
