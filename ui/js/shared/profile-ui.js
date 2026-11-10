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
    window.PROFILE_META = meta;
    slot.style.setProperty("--pc", color);
    slot.innerHTML = `
      <button class="profile-chip-btn" type="button" id="profileChipBtn" aria-haspopup="menu" aria-expanded="false"
              title="Profile: ${esc(name)}">
        <span class="profile-dot" aria-hidden="true"></span>
        <span>${esc(name)}</span>
        ${isGuest ? "" : `<span class="profile-yt" id="profileYt" data-light="grey" hidden title="YouTube"></span>`}
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

  let lastTab = "general";

  function openSettings(tab) {
    closeMenu();
    let dlg = document.getElementById("profileSettings");
    dlg?.remove();
    dlg = document.createElement("dialog");
    dlg.id = "profileSettings";
    dlg.className = "profile-settings";
    const d = meta?.defaults || {};
    const canPreset = typeof captionState === "function";
    const tabs = [["general", "General"], ["clips", "Clips & posts"], ...(isGuest ? [] : [["thumbnail", "Thumbnail"]]), ["youtube", "YouTube"], ...(isGuest ? [] : [["claude", "Claude API"]]), ["computer", "This computer"]];
    const first = tabs.some(([k]) => k === (tab || lastTab)) ? (tab || lastTab) : "general";
    const panel = (key, html) => `<div class="ps-panel" role="tabpanel" id="pstp-${key}" aria-labelledby="pst-${key}" tabindex="-1"${key === first ? "" : " hidden"}>
${html}      </div>`;
    dlg.innerHTML = `
      <form method="dialog" id="profileSettingsForm" class="ps-form">
        <h2 class="ps-head" id="profileSettingsTitle">Profile settings</h2>
        <div class="ps-main">
          <div class="ps-tabs" role="tablist" aria-label="Settings" aria-orientation="vertical">${tabs.map(([k, name]) =>
            `<button type="button" class="ps-tab" role="tab" id="pst-${k}" data-tab="${k}" aria-controls="pstp-${k}" aria-selected="${k === first}" tabindex="${k === first ? 0 : -1}">${name}</button>`).join("")}</div>
          <div class="ps-body">
            ${panel("general", `        <label>Name <input type="text" name="name" maxlength="40" value="${esc(meta?.name || "")}"></label>
        <label>Colour <input type="color" name="color" value="${esc(meta?.color || "#e8b923")}"></label>
        <label>Watermark text <input type="text" name="watermark" maxlength="40" value="${esc(d.watermark || "")}" placeholder="klipian"></label>
`)}
            ${panel("clips", `        <section class="yt-box" id="rubricBox" aria-label="Rubric">
          <label>Default rubric (Find clips, Copy brief)
            <select name="rubric" id="rubricSel">
              <option value="${esc(d.rubric || "dialog")}" selected>${esc(d.rubric || "dialog")}</option>
            </select></label>
          <div class="row yt-actions">
            <button class="btn quiet" type="button" data-rb="new">New rubric from template…</button>
            <button class="btn quiet" type="button" data-rb="open" hidden>Open file</button>
            <button class="btn quiet" type="button" data-rb="folder">Open folder</button>
            <button class="btn quiet" type="button" data-rb="delete" hidden>Delete…</button>
          </div>
          <div class="row" id="rubricNew" hidden>
            <select id="rubricTemplate" aria-label="Template"></select>
            <input type="text" id="rubricName" maxlength="60" placeholder="Name, e.g. Komedi Radio" aria-label="Rubric name">
            <button class="btn quiet" type="button" data-rb="create">Create</button>
          </div>
          <p class="note" id="rubricMsg" role="status"></p>
        </section>
        <label>Hashtag placement (YouTube)
          <select name="hashtagPlacement">
            <option value="title"${d.hashtagPlacement === "description" || d.hashtagPlacement === "both" ? "" : " selected"}>In the title</option>
            <option value="description"${d.hashtagPlacement === "description" ? " selected" : ""}>In the description</option>
            <option value="both"${d.hashtagPlacement === "both" ? " selected" : ""}>In both</option>
          </select></label>
        <label>Hashtags in the title
          <select name="titleTags">
            <option value="2"${d.titleTags === 2 ? " selected" : ""}>2</option>
            <option value="3"${d.titleTags === 2 ? "" : " selected"}>3</option>
          </select></label>
        <label class="check"><input type="checkbox" name="addShorts"${d.addShorts ? " checked" : ""}> Add #shorts to the title</label>
        ${canPreset ? `<p class="note">Caption look: ${d.captionPreset ? "a default is saved." : "none saved yet."}
          <button class="btn quiet" type="button" data-pm="preset">Use the current caption look as this profile's default</button></p>` : ""}
`)}
            ${isGuest ? "" : panel("thumbnail", `        <section class="yt-box" id="thumbBox" aria-label="Thumbnail style">
          <h3>Thumbnail style <small>(the card made for every video of this profile)</small></h3>
          <div class="th-grid">
            <label>Font <select name="th_font"><option value="mona">Mona Sans ExtraBold</option><option value="arialblack">Arial Black</option><option value="impact">Impact</option><option value="arial">Arial Bold</option><option value="verdana">Verdana Bold</option></select></label>
            <label>Size (% of width) <input type="number" name="th_size" min="4" max="20" step="0.5"></label>
            <label>Text colour <input type="color" name="th_color"></label>
            <label>Highlight colour (*word*) <input type="color" name="th_accent"></label>
            <label>Outline colour <input type="color" name="th_outlineColor"></label>
            <label>Outline width (0 = none) <input type="number" name="th_outline" min="0" max="20" step="1"></label>
            <label>Sticker border colour <input type="color" name="th_outer"></label>
            <label>Sticker border width (0 = none) <input type="number" name="th_outerWidth" min="0" max="20" step="1"></label>
            <label>Shadow offset (0 = none) <input type="number" name="th_shadow" min="0" max="15" step="1"></label>
            <label>Tilt (degrees) <input type="number" name="th_rotate" min="-10" max="10" step="0.5"></label>
            <label>Line height <input type="number" name="th_lineHeight" min="0.8" max="1.5" step="0.05"></label>
            <label>Text width (% of the card) <input type="number" name="th_width" min="40" max="96" step="1"></label>
            <label>Position <select name="th_position"><option value="auto">Auto (no face, no caption)</option><option value="top">Top</option><option value="middle">Middle</option><option value="lower">Lower third</option></select></label>
            <label>Align <select name="th_align"><option value="left">Left</option><option value="center">Centre</option></select></label>
            <label>Bottom gradient (0 = off) <input type="number" name="th_gradient" min="0" max="1" step="0.05"></label>
            <label>Max lines <select name="th_lines"><option>1</option><option>2</option><option>3</option><option>4</option></select></label>
            <label>Max block height (% of the card) <input type="number" name="th_maxHeight" min="10" max="50" step="1"></label>
            <label class="check"><input type="checkbox" name="th_autoSize"> Auto size (fill the box: the lines and size that make the text biggest; Size is the cap)</label>
            <label class="check"><input type="checkbox" name="th_caps"> ALL CAPS</label>
          </div>
          <label>Sample text <input type="text" id="thText" maxlength="80" value="Dia ngomong gini di depan *semua orang*"></label>
          <div class="row yt-actions"><button class="btn quiet" type="button" id="thReset">Reset to default</button></div>
          <img class="th-preview" id="thPreview" alt="Thumbnail preview" hidden>
          <p class="note" id="thMsg" role="status">The preview uses this profile's newest rendered video (a plain frame if it has none). Kept with Save.</p>
        </section>
`)}
            ${panel("youtube", `        <section class="yt-box" id="ytBox" aria-label="YouTube account">
          <h3>YouTube account</h3>
          <div class="yt-row" id="ytClientRow"><span class="yt-badge" data-light="grey">Client</span><span class="yt-row-text" id="ytClientText">Checking…</span></div>
          <div class="yt-row" id="ytAccountRow"><span class="yt-badge" data-light="grey">Account</span><span class="yt-row-text" id="ytLine">Checking…</span></div>
          <div class="row yt-actions" id="ytActions"></div>
          <input type="file" id="ytFile" accept=".json,application/json" hidden>
          <p class="note" id="ytMsg" role="status"></p>
        </section>
`)}
            ${isGuest ? "" : panel("claude", `        ${isGuest ? "" : `<section class="yt-box" id="claudeBox" aria-label="Anthropic API">
          <h3>Anthropic API <small>(Find clips with Claude)</small></h3>
          <p class="note" id="claudeState">Checking…</p>
          <label>API key <input type="password" id="claudeKey" autocomplete="off" spellcheck="false" placeholder="sk-ant-…"></label>
          <div class="row yt-actions">
            <button class="btn quiet" type="button" data-cl="save">Save key</button>
            <button class="btn quiet" type="button" data-cl="test">Test</button>
            <button class="btn quiet" type="button" data-cl="remove">Remove key</button>
          </div>
          <label>Model <select id="claudeModel"><option value="">Newest Opus of this account (default)</option></select></label>
          <label>Effort <select id="claudeEffort"></select></label>
          <p class="note" id="claudeMsg" role="status"></p>
          <div id="claudeUsage"></div>
        </section>`}
`)}
            ${panel("computer", `        <section class="yt-box" aria-label="This computer">
          <h3>This computer <small>(every profile and tab)</small></h3>
          <label>Renders at the same time
            <select id="machineRenders"><option value="1">1 (default)</option><option value="2">2</option></select></label>
          <p class="note" id="machineMsg" role="status">Transcription and speaker analysis always run one at a time. Jobs wait their turn,
            taking turns between profiles. Saved as soon as you change it.</p>
        </section>
`)}
          </div>
        </div>
        <div class="ps-foot">
          <div class="ps-foot-text">
            <p class="note" id="profileSettingsNote" role="status"></p>
            <p class="note ps-hint">Name, colour, watermark, rubric and hashtags are kept with Save. YouTube, Claude and This computer save at once.</p>
          </div>
          <div class="row">
            <button class="btn quiet" type="submit" value="cancel">Close</button>
            <button class="btn main" type="submit" value="save">Save</button>
          </div>
        </div>
      </form>`;
    dlg.setAttribute("aria-labelledby", "profileSettingsTitle");
    document.body.append(dlg);
    lastTab = first;
    const showTab = (key, focus) => {
      for (const b of dlg.querySelectorAll(".ps-tab")) {
        const on = b.dataset.tab === key;
        b.setAttribute("aria-selected", String(on));
        b.tabIndex = on ? 0 : -1;
        if (on && focus) b.focus();
      }
      for (const p of dlg.querySelectorAll(".ps-panel")) p.hidden = p.id !== `pstp-${key}`;
      lastTab = key;
      dlg.querySelector(".ps-body").scrollTop = 0;
    };
    const tablist = dlg.querySelector(".ps-tabs");
    tablist.addEventListener("click", (e) => { const b = e.target.closest(".ps-tab"); if (b) showTab(b.dataset.tab, false); });
    tablist.addEventListener("keydown", (e) => {
      const all = [...tablist.querySelectorAll(".ps-tab")];
      const at = all.indexOf(document.activeElement);
      const step = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
      let to = -1;
      if (step && at >= 0) to = (at + step + all.length) % all.length;
      else if (e.key === "Home") to = 0;
      else if (e.key === "End") to = all.length - 1;
      if (to < 0) return;
      e.preventDefault();
      showTab(all[to].dataset.tab, true);
    });
    // closing: Close and Save are the buttons; the backdrop and Esc ask first when a field was changed
    const formState = () => JSON.stringify([...new FormData(dlg.querySelector("form"))]);
    let saved = formState(), asking = false;
    const tryClose = async () => {
      if (asking) return;
      if (formState() !== saved) {
        asking = true;
        const ok = typeof confirmDialog === "function"
          ? await confirmDialog({ title: "Discard the changes?", message: "You changed this profile's settings and did not save them.", confirmText: "Discard", cancelText: "Keep editing", tone: "primary" })
          : window.confirm("Discard the changes you have not saved?");
        asking = false;
        if (!ok) return;
      }
      dlg.close();
    };
    let downOnBackdrop = false;
    dlg.addEventListener("pointerdown", (e) => { downOnBackdrop = e.target === dlg; });
    dlg.addEventListener("click", (e) => { if (e.target === dlg && downOnBackdrop) tryClose(); downOnBackdrop = false; });
    dlg.addEventListener("cancel", (e) => { e.preventDefault(); tryClose(); });
    dlg.addEventListener("submit", async (e) => {
      if (e.submitter?.value !== "save") return;
      const f = Object.fromEntries(new FormData(dlg.querySelector("form")));
      try {
        const j = await post("/api/profiles/update", { id: PROFILE, name: f.name, color: f.color,
          defaults: { watermark: f.watermark, rubric: f.rubric, hashtagPlacement: f.hashtagPlacement,
            titleTags: Number(f.titleTags), addShorts: !!f.addShorts },
          ...(isGuest ? {} : { thumbStyle: thumbChanges(dlg) }) });
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
    youTubeSection(dlg);
    machineSection(dlg);
    if (!isGuest) { claudeSection(dlg); thumbSection(dlg); }
    rubricSection(dlg).finally(() => { saved = formState(); });      // the rubric list fills the select: that is not a change
    return dlg;
  }

  /* ---- the thumbnail style: the form fields th_*, the live preview (the server draws it with the same code as the real card) ---- */
  const TH_NUM = ["size", "outline", "gradient", "outerWidth", "shadow", "rotate", "lineHeight", "width", "maxHeight"], TH_SEL = ["font", "position", "align"], TH_COL = ["color", "accent", "outlineColor", "outer"];
  function thumbForm(dlg) {
    const g = (n) => dlg.querySelector(`[name="th_${n}"]`), o = {};
    for (const n of TH_NUM) if (g(n).value !== "") o[n] = Number(g(n).value);
    for (const n of [...TH_SEL, ...TH_COL]) o[n] = g(n).value;
    o.lines = Number(g("lines").value); o.caps = g("caps").checked; o.autoSize = g("autoSize").checked;
    return o;
  }
  /* only what differs from the profile's default is saved: a later change of the default reaches a profile that did not touch it */
  function thumbChanges(dlg) {
    const cur = thumbForm(dlg), def = meta?.thumbDefault || {}, out = {};
    for (const k of Object.keys(cur)) if (String(cur[k]).toLowerCase() !== String(def[k]).toLowerCase()) out[k] = cur[k];       // a colour input answers in lower case
    return out;
  }
  function thumbSection(dlg) {
    const g = (n) => dlg.querySelector(`[name="th_${n}"]`), img = dlg.querySelector("#thPreview"), msg = dlg.querySelector("#thMsg");
    const fill = (st) => {
      for (const n of [...TH_NUM, ...TH_SEL, ...TH_COL, "lines"]) g(n).value = String(st[n]);
      g("caps").checked = !!st.caps; g("autoSize").checked = !!st.autoSize;
    };
    fill({ ...(meta?.thumbDefault || {}), ...(meta?.thumbStyle || {}) });
    let timer = 0, seq = 0, url = "";
    const draw = async () => {
      const mine = ++seq;
      try {
        const r = await fetch("/api/thumbnail/preview", { method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ style: thumbForm(dlg), text: dlg.querySelector("#thText").value }) });
        if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "no preview");
        const blob = await r.blob();
        if (mine !== seq) return;                                   // a newer change is already on its way
        if (url) URL.revokeObjectURL(url);
        url = URL.createObjectURL(blob); img.src = url; img.hidden = false;
      } catch (err) { img.hidden = true; msg.textContent = `No preview: ${err.message}`; }
    };
    const later = () => { clearTimeout(timer); timer = setTimeout(draw, 350); };       // debounced
    dlg.querySelector("#thumbBox").addEventListener("input", later);
    dlg.querySelector("#thReset").addEventListener("click", () => { fill(meta?.thumbDefault || {}); later(); });
    dlg.addEventListener("close", () => { if (url) URL.revokeObjectURL(url); });
    draw();
  }

  /* ---- settings of this computer, not of the profile (workspace/machine.json) ---- */
  async function machineSection(dlg) {
    const sel = dlg.querySelector("#machineRenders"), msg = dlg.querySelector("#machineMsg");
    try {
      const j = await (await fetch("/api/profiles/machine")).json();
      sel.value = String(j.renderJobs || 1);
    } catch { msg.textContent = "Could not read this computer's settings."; }
    sel.addEventListener("change", async () => {
      try {
        const r = await fetch("/api/profiles/machine", { method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ renderJobs: Number(sel.value) }) });
        const j = await r.json();
        if (j.error) throw new Error(j.error);
        msg.textContent = `Saved: ${j.renderJobs} render${j.renderJobs === 1 ? "" : "s"} at a time.`;
      } catch (err) { msg.textContent = `Not saved: ${err.message}`; }
    });
  }

  /* ---- rubrics per niche (P26): built-in, templates, and the person's own in workspace/rubrics ---- */
  async function rubricSection(dlg) {
    const sel = dlg.querySelector("#rubricSel"), msg = dlg.querySelector("#rubricMsg");
    const tpl = dlg.querySelector("#rubricTemplate"), nameIn = dlg.querySelector("#rubricName");
    const call = async (path, body) => {
      const r = await fetch(path, body === undefined ? {} : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      return r.json().catch(() => ({ error: "no answer" }));
    };
    const say = (t, bad) => { msg.dataset.error = bad ? "true" : "false"; msg.textContent = t; };
    let data = null;
    const mine = () => data?.workspace.find((x) => x.id === sel.value);
    function paint(want) {
      const keep = want ?? sel.value;
      sel.innerHTML = "";
      const add = (v, t) => sel.append(Object.assign(document.createElement("option"), { value: v, textContent: t }));
      for (const x of data.builtin) add(x.id, x.name);
      for (const x of data.workspace) add(x.id, x.name + (x.missing.length ? " (incomplete)" : ""));
      if (keep && ![...sel.options].some((o) => o.value === keep)) add(keep, `${keep} (missing)`);
      sel.value = keep || "dialog";
      tpl.innerHTML = data.templates.map((t) => `<option value="${esc(t.id)}">${esc(t.name)}</option>`).join("");
      const m = mine();
      dlg.querySelector('[data-rb="open"]').hidden = !m;
      dlg.querySelector('[data-rb="delete"]').hidden = !m;
      if (m?.missing.length) say(`This rubric is missing ${m.missing.join("; ")}. It will not be used until it is fixed.`, true);
      else if (keep && ![...data.builtin, ...data.workspace].some((x) => x.id === keep)) say(`The rubric "${keep}" is not there any more: Dialog / podcast is used until you choose another.`, true);
      else say("");
    }
    const load = async (want) => { const j = await call("/api/rubrics"); if (j.ok) { data = j; paint(want); } else say(j.error || "Could not read the rubrics.", true); };
    await load(sel.value);
    sel.addEventListener("change", () => paint());
    const choose = async (id) => {            // the chosen rubric is saved at once, like the caption look
      const j = await call("/api/profiles/update", { id: PROFILE, defaults: { rubric: id } });
      if (j.profile) { meta = j.profile; draw(); }
    };
    dlg.querySelector("#rubricBox").addEventListener("click", async (e) => {
      const act = e.target.closest("[data-rb]")?.dataset.rb;
      if (!act) return;
      if (act === "new") { dlg.querySelector("#rubricNew").hidden = false; nameIn.focus(); }
      else if (act === "create") {
        const j = await call("/api/rubrics/create", { template: tpl.value, name: nameIn.value });
        if (!j.ok) return say(j.error, true);
        nameIn.value = "";
        dlg.querySelector("#rubricNew").hidden = true;
        await load(j.id);
        await choose(j.id);
        say(`Made workspace/rubrics/${j.id}.md and chose it. Open the file to adapt it to your channel.`);
      } else if (act === "open" || act === "folder") {
        const j = await call("/api/rubrics/open", act === "open" ? { id: sel.value } : {});
        if (!j.ok) say(j.error, true);
      } else if (act === "delete") {
        const m = mine();
        if (!m) return;
        const ok = typeof confirmDialog === "function"
          ? await confirmDialog({ title: "Delete this rubric?", message: `"${m.name}" goes to the Recycle Bin. A profile that uses it falls back to Dialog / podcast.`, confirmText: "Delete" })
          : window.confirm(`Delete "${m.name}"?`);
        if (!ok) return;
        const j = await call("/api/rubrics/delete", { id: m.id });
        if (!j.ok) return say(j.error, true);
        await load("dialog");
        await choose("dialog");
        say(`Deleted "${m.name}" (it is in the Recycle Bin). Dialog / podcast is the default now.`);
      }
    });
  }

  /* ---- the Anthropic API (P24): the key is typed here, kept on the server, and never shown again ---- */
  async function claudeSection(dlg) {
    const state = dlg.querySelector("#claudeState"), msg = dlg.querySelector("#claudeMsg");
    const key = dlg.querySelector("#claudeKey"), model = dlg.querySelector("#claudeModel"), effort = dlg.querySelector("#claudeEffort");
    const call = async (path, body) => {
      const r = await fetch(path, body === undefined ? {} : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      return r.json().catch(() => ({ error: "no answer" }));
    };
    const say = (t, bad) => { msg.dataset.error = bad ? "true" : "false"; msg.textContent = t; };
    function paint(st) {
      const src = { saved: "A key is saved for this workspace.", env: "Using the key from the ANTHROPIC_API_KEY environment variable.", none: "No key yet." }[st.keySource] || "";
      state.textContent = (st.sdk ? "" : `The Anthropic package is not installed. Run: ${st.command}  `) + src;
      key.value = "";
      effort.innerHTML = st.efforts.map((e) => `<option value="${esc(e)}"${e === st.effort ? " selected" : ""}>${esc(e)}${e === "high" ? " (default)" : ""}</option>`).join("");
      if (st.model && ![...model.options].some((o) => o.value === st.model)) model.append(new Option(st.model, st.model));
      model.value = st.model || "";
    }
    async function usage() {
      const u = await call("/api/claude/usage");
      const box = dlg.querySelector("#claudeUsage");
      if (!u.months?.length) { box.textContent = ""; return; }
      const n = (v) => Number(v || 0).toLocaleString("en");
      box.innerHTML = `<table class="claude-usage"><thead><tr><th>Month</th><th>Calls</th><th>Input</th><th>Output</th><th>Cache read</th><th>Cost (estimate)</th></tr></thead><tbody>`
        + u.months.map((m) => `<tr><td>${esc(m.month)}</td><td>${n(m.calls)}</td><td>${n(m.input)}</td><td>${n(m.output)}</td><td>${n(m.cacheRead)}</td><td>$${m.cost.toFixed(2)}${m.unpriced ? "+" : ""}</td></tr>`).join("")
        + `</tbody></table>`;
    }
    const st = await call("/api/claude/status");
    if (st.error) { state.textContent = st.error; return; }
    paint(st);
    usage();
    async function loadModels(s) {
      if (!s.sdk || !s.hasKey) return;
      const m = await call("/api/claude/models");
      if (m.ok) for (const x of m.models) if (![...model.options].some((o) => o.value === x.id)) model.append(new Option(x.name || x.id, x.id));
      model.value = s.model || "";
    }
    loadModels(st);
    const save = async (body, done) => {
      const j = await call("/api/claude/settings", body);
      if (j.error) return say(j.error, true);
      paint(j);
      say(done);
      loadModels(j);
    };
    model.addEventListener("change", () => save({ model: model.value }, "Model saved."));
    effort.addEventListener("change", () => save({ effort: effort.value }, "Effort saved."));
    dlg.querySelector("#claudeBox").addEventListener("click", async (e) => {
      const act = e.target.closest("[data-cl]")?.dataset.cl;
      if (!act) return;
      if (act === "save") {
        if (!key.value.trim()) return say("Type the key first.", true);
        await save({ apiKey: key.value.trim() }, "Key saved. Use Test to check it.");
      } else if (act === "remove") {
        await save({ removeKey: true }, "Key removed.");
      } else if (act === "test") {
        say("Testing…");
        const j = await call("/api/claude/test", {});
        say(j.ok ? j.note : (j.command ? `${j.error} Run: ${j.command}` : j.error), !j.ok);
        if (j.ok) usage();
      }
    });
  }

  /* Other scripts (the bulk upload dialog) can open the settings at the YouTube section. */
  window.openProfileSettings = (opts = {}) => {
    return openSettings({ rubricBox: "clips", ytBox: "youtube", claudeBox: "claude" }[opts.section]);
  };

  /* ---- the YouTube account (P21-C): what the token is, never the token itself ---- */
  const YT_HELP = {
    none: "Not linked. Choose the client_secret.json of this channel's Google Cloud project, then Connect.",
    no_client: "No client yet. Choose this channel's client_secret.json (the guide has the steps).",
    no_library: "The YouTube packages are not installed. Run: .venv\\Scripts\\python.exe -m pip install -r requirements-youtube.txt",
    expired: "The connection expired (a Testing project's token lasts about 7 days). Connect again.",
    different: "The token is valid but belongs to another channel than the saved one. Connect again to accept it.",
    not_test_user: "Google refused the sign-in: add this Google account as a Test user (Google Auth Platform > Audience > Test users), then Connect.",
    offline: "Could not reach Google; the last known state is shown.",
  };

  /* Where in /guide each state of the YouTube account is explained. */
  const YT_GUIDE = { none: "youtube-client", no_client: "youtube-client", expired: "youtube-expired", different: "youtube-expired",
    not_test_user: "youtube-test-user", offline: "youtube-status", no_library: "youtube-status" };

  async function youTubeSection(dlg) {
    const line = dlg.querySelector("#ytLine"), msg = dlg.querySelector("#ytMsg"), box = dlg.querySelector("#ytActions");
    const file = dlg.querySelector("#ytFile");
    let busy = false;

    const btn = (act, label, extra = "") => `<button class="btn quiet" type="button" data-yt="${act}" ${extra}>${label}</button>`;
    function paint(j) {
      const st = j.state || "none";
      const c = j.client || { state: j.hasClient ? "valid" : "missing" };
      // Row 1: the client_secret.json, judged here with no network.
      const cLight = c.state === "valid" ? "green" : c.state === "invalid" ? "red" : "grey";
      dlg.querySelector("#ytClientRow .yt-badge").dataset.light = cLight;
      dlg.querySelector("#ytClientRow .yt-badge").textContent = c.state === "valid" ? "Client ✓" : c.state === "invalid" ? "Client ✕" : "Client";
      dlg.querySelector("#ytClientText").innerHTML = c.state === "valid"
        ? `Valid${c.projectId ? ` · project <b>${esc(c.projectId)}</b>` : ""} · ${c.source === "shared" ? "shared fallback (workspace/secrets)" : "this profile"}`
        : c.state === "invalid" ? esc(c.reason || "This file is not a usable client_secret.json.") : "Not chosen yet.";
      // Row 2: the YouTube account. Green only when the client is valid too (the chip's dot says the same).
      const aLight = st === "ok" ? (c.state === "valid" ? "green" : "yellow")
        : st === "not_test_user" ? "red" : (st === "none" || st === "no_client" || st === "no_library") ? "grey" : "yellow";
      const badge = dlg.querySelector("#ytAccountRow .yt-badge");
      badge.dataset.light = aLight;
      badge.textContent = st === "ok" ? "Connected ✓" : st === "expired" ? "Expired" : st === "different" ? "Other channel"
        : st === "not_test_user" ? "Not a test user" : st === "offline" ? "Offline" : "Not connected";
      const when = j.checkedAt ? `checked ${new Date(j.checkedAt * 1000).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}` : "";
      const thumb = j.channel?.thumb ? `<img class="yt-thumb" src="${esc(j.channel.thumb)}" alt="" referrerpolicy="no-referrer">` : "";
      const who = j.channel?.title ? `${thumb}<b>${esc(j.channel.title)}</b>` : "";
      line.innerHTML = st === "ok" ? `${who}${when ? " · " + when : ""}`
        : st === "offline" ? `last known: ${who || esc(YT_HELP.offline)}${when ? " · " + when : ""}`
        : esc(YT_HELP[st] || j.message || st)
          + (YT_GUIDE[st] ? ` <a class="yt-guide" href="${guideUrl("#" + YT_GUIDE[st])}" target="_blank" rel="noopener">Panduan</a>` : "");
      msg.textContent = j.message && st === "ok" ? j.message : (st === "offline" ? j.message : "");
      const linked = st === "ok" || st === "expired" || st === "different" || st === "offline";
      box.innerHTML = [
        btn("client", j.hasClient ? "Change client_secret.json…" : "Choose client_secret.json…"),
        `<a class="btn quiet yt-guide-btn" href="${guideUrl("#youtube")}" target="_blank" rel="noopener">Setup guide</a>`,
        (st !== "ok") ? btn("connect", st === "expired" || st === "different" ? "Connect again" : "Connect YouTube",
          c.state === "valid" ? "" : `disabled title="${c.state === "invalid" ? "The client_secret.json is not valid: choose a correct one first." : "Choose the client_secret.json first."}"`) : "",
        linked ? btn("check", "Check connection") : "",
        linked ? btn("disconnect", "Disconnect") : "",
      ].join("");
      window.refreshYouTubeDot?.();
    }
    async function call(path, body) {
      const r = await fetch(path, body === undefined ? {} : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      return r.json().catch(() => ({ error: "no answer" }));
    }
    async function refresh(check) {
      try { paint(await call(check ? "/api/youtube/status?check=1" : "/api/youtube/status")); }
      catch { line.textContent = "Cannot reach the klipian server."; }
    }

    box.addEventListener("click", async (e) => {
      const b = e.target.closest("[data-yt]");
      if (!b || busy) return;
      const act = b.dataset.yt;
      msg.textContent = "";
      if (act === "client") { file.click(); return; }
      if (act === "disconnect") {
        if (!(await confirmDialog({
          title: "Disconnect from YouTube?", tone: "strong", confirmText: "Disconnect",
          message: "klipian asks Google to cancel its access and forgets this profile's login. Videos already uploaded stay on YouTube.",
          warning: "Uploading and the status checks stop until you connect again.",
        }))) return;
      }
      busy = true;
      try {
        if (act === "check") { line.textContent = "Checking with YouTube…"; paint(await call("/api/youtube/check", {})); }
        else if (act === "disconnect") { const j = await call("/api/youtube/disconnect", {}); paint(j); msg.textContent = j.message || ""; }
        else if (act === "connect") {
          const j = await call("/api/youtube/connect", {});
          if (j.error) { msg.textContent = j.error; await refresh(false); return; }
          line.textContent = "Sign in with Google in the tab that opened…";
          for (let i = 0; i < 240; i++) {                  // up to ~6 minutes
            await new Promise((r) => setTimeout(r, 1500));
            const s = await call(`/api/youtube/connect-state?id=${encodeURIComponent(j.id)}`);
            if (s.state === "done") { paint(s.status); return; }
            if (s.state === "failed" || s.state === "missing") {
              msg.textContent = s.message || "Connecting failed.";
              await refresh(false);
              if (s.code && YT_HELP[s.code]) line.textContent = YT_HELP[s.code];
              return;
            }
          }
          msg.textContent = "Timed out waiting for the sign-in.";
        }
      } finally { busy = false; }
    });
    file.addEventListener("change", async () => {
      const f = file.files[0];
      file.value = "";
      if (!f) return;
      const j = await call("/api/youtube/client", { text: await f.text() });
      if (j.error) { msg.textContent = j.error; return; }
      paint(j);
      msg.textContent = "client_secret.json saved for this profile.";
    });
    await refresh(true);
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
      if (!(await confirmDialog({
        title: "Clear the Guest data?", tone: "strong", confirmText: "Clear guest data",
        message: "Everything the Guest made (sources, projects, renders) goes to the Recycle Bin.",
      }))) return;
      try {
        await post("/api/profiles/clear-guest");
        location.href = "/";                  // the pages start empty again
      } catch (err) { showToast(`Could not clear: ${err.message}`); }
    }
  });
  document.addEventListener("pointerdown", (e) => { if (!slot.contains(e.target)) closeMenu(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeMenu(); });

  // The chip's YouTube dot: green (linked and checked), yellow (needs attention), grey (not linked).
  async function paintYouTube() {
    const dot = document.getElementById("profileYt");
    if (!dot) return;
    try {
      const j = await (await fetch("/api/youtube/status")).json();
      if (!j.ok && !j.state) return;
      const s = j.state || "none";
      dot.dataset.light = j.light || "grey";                    // the same colour the badges show
      dot.title = `YouTube: ${j.channel?.title || (s === "none" ? "not linked" : s)}`;
      dot.hidden = false;
    } catch { /* the dot stays hidden */ }
  }

  draw();
  load().then(paintYouTube);
  window.refreshYouTubeDot = paintYouTube;
})();
