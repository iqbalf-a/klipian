/* klipian — the profile chip in the topbar, and the profile's settings (both pages)
   ==========================================================================
   Shows WHO this tab is working as (a colour and a name, so the wrong channel is hard to
   edit by mistake). The menu: Switch profile (the picker), Profile settings (name, colour,
   the watermark's words, the default rubric, the caption look), and for the Guest
   "Clear guest data". The profile's defaults are kept in sessionStorage for the editor
   (applyPresetCaption in editor/app.js reads them for a new project).
   ========================================================================== */

(function profileChip() {
  const slot = document.getElementById("profileChip");
  if (!slot) return;
  const isGuest = PROFILE === "_guest";
  let meta = null;

  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

  async function post(path, body) {
    const r = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body || {}) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j.error) throw new Error(j.error || `failed (${r.status})`);
    return j;
  }

  function draw() {
    const name = meta ? meta.name : PROFILE;
    const color = meta ? meta.color : "#8b8f98";
    slot.className = "profile-chip";
    slot.style.setProperty("--pc", color);
    slot.innerHTML = `
      <button class="profile-chip-btn" type="button" id="profileChipBtn" aria-haspopup="menu" aria-expanded="false"
              title="Profile: ${esc(name)}">
        <span class="profile-dot" aria-hidden="true"></span>
        <span>${esc(name)}</span>
        ${isGuest ? "" : `<span class="profile-yt" id="profileYt" data-state="none" hidden title="YouTube"></span>`}
      </button>
      <div class="profile-menu" id="profileMenu" role="menu" hidden>
        <button type="button" role="menuitem" data-pm="switch">Switch profile…</button>
        ${isGuest
          ? `<button type="button" role="menuitem" data-pm="clear">Clear guest data</button>`
          : `<button type="button" role="menuitem" data-pm="settings">Profile settings…</button>`}
      </div>`;
    try { sessionStorage.setItem("klipian:profile-meta", JSON.stringify(meta || {})); } catch { /* no storage */ }
  }

  async function load() {
    try {
      const d = await (await fetch("/api/profiles")).json();
      meta = isGuest ? d.guest : d.profile.find((p) => p.id === PROFILE) || null;
    } catch { /* no server: the chip shows the id */ }
    draw();
  }

  function closeMenu() {
    const m = document.getElementById("profileMenu");
    if (m) m.hidden = true;
    document.getElementById("profileChipBtn")?.setAttribute("aria-expanded", "false");
  }

  function openSettings() {
    closeMenu();
    let dlg = document.getElementById("profileSettings");
    dlg?.remove();
    dlg = document.createElement("dialog");
    dlg.id = "profileSettings";
    dlg.className = "profile-settings";
    const d = meta?.defaults || {};
    const canPreset = typeof captionState === "function";
    dlg.innerHTML = `
      <form method="dialog" id="profileSettingsForm">
        <h2>Profile settings</h2>
        <label>Name <input type="text" name="name" maxlength="40" value="${esc(meta?.name || "")}"></label>
        <label>Colour <input type="color" name="color" value="${esc(meta?.color || "#e8b923")}"></label>
        <label>Watermark text <input type="text" name="watermark" maxlength="40" value="${esc(d.watermark || "")}" placeholder="klipian"></label>
        <label>Default rubric (Find clips)
          <select name="rubric">
            <option value="dialog"${d.rubric !== "gameplay" ? " selected" : ""}>Dialog / podcast</option>
            <option value="gameplay"${d.rubric === "gameplay" ? " selected" : ""}>Gameplay</option>
          </select></label>
        ${canPreset ? `<p class="note">Caption look: ${d.captionPreset ? "a default is saved." : "none saved yet."}
          <button class="btn quiet" type="button" data-pm="preset">Use the current caption look as this profile's default</button></p>` : ""}
        <p class="note" id="profileSettingsNote" role="status"></p>
        <div class="row">
          <button class="btn quiet" type="submit" value="cancel">Close</button>
          <button class="btn main" type="submit" value="save">Save</button>
        </div>
      </form>`;
    document.body.append(dlg);
    dlg.addEventListener("submit", async (e) => {
      if (e.submitter?.value !== "save") return;
      const f = Object.fromEntries(new FormData(dlg.querySelector("form")));
      try {
        const j = await post("/api/profiles/update", { id: PROFILE, name: f.name, color: f.color,
          defaults: { watermark: f.watermark, rubric: f.rubric } });
        meta = j.profile;
        draw();
      } catch (err) {
        e.preventDefault();                    // keep the dialog open, say why
        dlg.querySelector("#profileSettingsNote").textContent = err.message;
      }
    });
    dlg.addEventListener("click", async (e) => {
      if (!e.target.closest('[data-pm="preset"]')) return;
      try {
        const j = await post("/api/profiles/update", { id: PROFILE, defaults: { captionPreset: captionState() } });
        meta = j.profile;
        draw();
        dlg.querySelector("#profileSettingsNote").textContent = "Saved: new projects in this profile start with this caption look.";
      } catch (err) { dlg.querySelector("#profileSettingsNote").textContent = err.message; }
    });
    dlg.addEventListener("close", () => dlg.remove());
    dlg.showModal();
  }

  slot.addEventListener("click", async (e) => {
    if (e.target.closest("#profileChipBtn")) {
      const m = document.getElementById("profileMenu");
      m.hidden = !m.hidden;
      document.getElementById("profileChipBtn").setAttribute("aria-expanded", String(!m.hidden));
      return;
    }
    const item = e.target.closest("[data-pm]");
    if (!item) return;
    if (item.dataset.pm === "switch") {
      location.href = `${PROFILE_PICKER}?next=${encodeURIComponent(location.pathname)}`;
    } else if (item.dataset.pm === "settings") {
      openSettings();
    } else if (item.dataset.pm === "clear") {
      if (!armedClick(item, { armedText: "Clear guest data?", strong: true })) return;
      try {
        await post("/api/profiles/clear-guest");
        location.href = "/";                  // the pages start empty again
      } catch (err) { showToast(`Could not clear: ${err.message}`); }
    }
  });
  document.addEventListener("pointerdown", (e) => { if (!slot.contains(e.target)) closeMenu(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeMenu(); });

  draw();
  load();
})();
