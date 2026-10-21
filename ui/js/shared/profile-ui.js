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
        <section class="yt-box" id="ytBox" aria-label="YouTube account">
          <h3>YouTube account</h3>
          <div class="yt-row" id="ytClientRow"><span class="yt-badge" data-light="grey">Client</span><span class="yt-row-text" id="ytClientText">Checking…</span></div>
          <div class="yt-row" id="ytAccountRow"><span class="yt-badge" data-light="grey">Account</span><span class="yt-row-text" id="ytLine">Checking…</span></div>
          <div class="row yt-actions" id="ytActions"></div>
          <input type="file" id="ytFile" accept=".json,application/json" hidden>
          <p class="note" id="ytMsg" role="status"></p>
        </section>
        ${isGuest ? "" : `<section class="yt-box" id="claudeBox" aria-label="Anthropic API">
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
          defaults: { watermark: f.watermark, rubric: f.rubric, hashtagPlacement: f.hashtagPlacement,
            titleTags: Number(f.titleTags), addShorts: !!f.addShorts } });
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
    if (!isGuest) claudeSection(dlg);
    return dlg;
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
    const dlg = openSettings();
    if (opts.section) dlg?.querySelector(`#${opts.section}`)?.scrollIntoView({ block: "center" });
    return dlg;
  };

  /* ---- the YouTube account (P21-C): what the token is, never the token itself ---- */
  const YT_HELP = {
    none: "Not linked. Choose the client_secret.json of this channel's Google Cloud project, then Connect.",
    no_client: "No client yet. Choose this channel's client_secret.json (see the setup checklist in docs/roadmap.md, P16).",
    no_library: "The YouTube packages are not installed. Run: .venv\\Scripts\\python.exe -m pip install -r requirements-youtube.txt",
    expired: "The connection expired (a Testing project's token lasts about 7 days). Connect again.",
    different: "The token is valid but belongs to another channel than the saved one. Connect again to accept it.",
    not_test_user: "Google refused the sign-in: add this Google account as a Test user (Google Auth Platform > Audience > Test users), then Connect.",
    offline: "Could not reach Google; the last known state is shown.",
  };

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
        : esc(YT_HELP[st] || j.message || st);
      msg.textContent = j.message && st === "ok" ? j.message : (st === "offline" ? j.message : "");
      const linked = st === "ok" || st === "expired" || st === "different" || st === "offline";
      box.innerHTML = [
        btn("client", j.hasClient ? "Change client_secret.json…" : "Choose client_secret.json…"),
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
