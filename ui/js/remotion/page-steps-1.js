/* klipian — the /remotion page, part of ui/js/remotion/page.js (split out, no change of behaviour): steps 1 to 3: the new video, the brief, the story and the storyboard.
   A classic script: the names are shared with the other page-*.js files; page.js loads last and starts the page. */

// ---------------------------------------------------------------------------------------------------------------------------------------
// 1 the new video
// ---------------------------------------------------------------------------------------------------------------------------------------

function bodyNew(d) {
  const custom = d.kind === "custom";
  return `
    <dl class="rm-kv">
      <dt>Topic</dt><dd>${esc(d.topic)}</dd>
      <dt>Duration</dt><dd>${d.duration} s planned${d.length && d.length.voiced != null ? `, ${esc(lengthText(d.length))}` : ""}</dd>
      ${d.notes ? `<dt>Notes</dt><dd>${esc(d.notes)}</dd>` : ""}
      <dt>Options</dt><dd>${esc(optionsSummary(d.options))}</dd>
    </dl>
    <p class="rm-hint">The video options (loop, "Intip yuk!", music, voice apps) are changed in step 2, Brief.</p>
    <div class="rm-actions"><button class="btn danger" id="rmDelete" type="button">Delete video</button></div>
    <details class="rm-adv">
      <summary>Advanced settings</summary>
      <label class="ws-field">Video kind
        <select class="ws-input rm-boxed rm-select" id="rmKind" aria-label="Video kind">
          <option value="khusus" ${custom ? "selected" : ""}>Custom: a video built by Claude Code, the best look</option>
          <option value="otomatis" ${custom ? "" : "selected"}>Template: klipian's template, a quick draft</option>
        </select>
      </label>
      <p class="rm-hint">${custom ? "Custom: the story and the video folder come from Claude Code (step 3)." : "Template: the AI's answer is pasted (step 3), then rendered with klipian's template."}</p>
    </details>`;
}

document.addEventListener("change", async (e) => {
  if (e.target.id !== "rmKind" || !CUR) return;
  const next = e.target.value === "khusus" ? "Custom (a video built by Claude Code)" : "Template (klipian's template)";
  const ok = await confirmDialog({ title: "Change the video kind?", message: `The next render uses ${next}. The old render stays in Clips.`, confirmText: "Change", cancelText: "Cancel" });
  if (!ok) return refresh();
  await call(`${API}/options`, { id: CUR.id, options: { kind: e.target.value } });
  await refresh();
});

// ---------------------------------------------------------------------------------------------------------------------------------------
// 2 brief and the options of the video
// ---------------------------------------------------------------------------------------------------------------------------------------

// the options of a video: the same controls in the form of a new video and under "Change the video options" in the brief step; they shape the brief
function readOptions(root) {
  const o = {};
  root.querySelectorAll("[data-opt]").forEach((x) => { o[x.dataset.opt] = x.type === "checkbox" ? x.checked : x.value; });
  const apps = [...root.querySelectorAll("[data-opt-app]:checked")].map((x) => x.dataset.optApp);
  if (!apps.length) throw new Error("Choose at least one voice app.");
  o.voiceTargets = apps;
  return o;
}

function optionsHTML(opts, id) {
  const sel = (key, list) => `<select class="ws-input rm-boxed" data-opt="${key}">${list.map(([v, l]) => `<option value="${v}" ${opts[key] === v ? "selected" : ""}>${l}</option>`).join("")}</select>`;
  const checked = opts.voiceTargets || VOICE_APP_ORDER;
  return `<div class="rm-group" id="${id}">
    <label class="rm-check"><input type="checkbox" data-opt="loop" ${opts.loop ? "checked" : ""}> Loop (the end returns to the first scene)</label>
    <label class="rm-check"><input type="checkbox" data-opt="sting" ${opts.sting ? "checked" : ""}> "Intip yuk!" after the hook</label>
    <label class="rm-check"><input type="checkbox" data-opt="direct" ${opts.direct ? "checked" : ""}> Hook straight into the topic (no "Kenapa ..." opener)</label>
    <span class="rm-hint">Straight into the topic: "Petugas SPBU ini nunjuk angka nol, dan itu bukan basa-basi.", not "Kenapa petugas SPBU selalu bilang mulai dari nol?" Always on for Ricks.</span>
    <label class="ws-field">Look ${sel("look", LOOK_LABELS)}</label>
    <video class="rm-look-img" muted loop autoplay playsinline ${opts.look && opts.look !== "auto" ? `src="/ui/img/looks/${opts.look}.mp4"` : "hidden"}></video>
    <span class="rm-hint">Automatic: Claude Code chooses the look that fits the topic best (B28).</span>
    <label class="ws-field">Order ${sel("flow", FLOW_LABELS)}</label>
    <span class="rm-hint">Picture first: Claude Code builds the story and the picture, then you add the voice. Voice first: the story text, then the voice, then the picture is built to the voice. Change it only before the voice is made.</span>
    <label class="ws-field">Story ${sel("story", STORY_LABELS)}</label>
    <span class="rm-hint">Story + fact: made-up people in an everyday place, one true fact explained near the end (e.g. a blind grandmother who smells the rain coming: ozone from lightning).</span>
    <label class="ws-field">Music ${sel("music", Object.entries(MUSIC_LABELS))}</label>
    <div class="rm-subgroup" role="group" aria-label="Voice apps">
      <span class="rm-sublabel">Voice apps (tick the ones you use; the script is made for each app)</span>
      ${VOICE_APP_ORDER.map((k) => `<label class="rm-check"><input type="checkbox" data-opt-app="${k}" ${checked.includes(k) ? "checked" : ""}> ${VOICE_APP_LABELS[k]}</label>`).join("")}
    </div>
  </div>`;
}

// a short silent sample clip of the chosen look (ui/img/looks/<look>.mp4); none for automatic
document.addEventListener("change", (e) => {
  if (!e.target.matches || !e.target.matches('select[data-opt="look"]')) return;
  const group = e.target.closest(".rm-group");
  const sting = group?.querySelector('[data-opt="sting"]');
  if (sting) sting.checked = e.target.value !== "ricks";              // ricks has its own channel: no "Intip yuk!" unless ticked again (B46 l)
  const direct = group?.querySelector('[data-opt="direct"]');
  if (direct && e.target.value === "ricks") direct.checked = true;    // ricks always goes straight into the topic
  const flow = group?.querySelector('[data-opt="flow"]');
  if (flow && e.target.value === "ricks") flow.value = "voice";       // ricks is built to its voice (B46)
  const img = group?.querySelector(".rm-look-img");
  if (!img) return;
  img.hidden = e.target.value === "auto";
  if (img.hidden) img.pause(); else { img.src = `/ui/img/looks/${e.target.value}.mp4`; img.title = `Sample: ${e.target.selectedOptions[0].text}`; img.play().catch(() => {}); }
});

// at least one app stays checked: unchecking the last one is undone, with the reason
document.addEventListener("change", (e) => {
  if (!e.target.matches || !e.target.matches("[data-opt-app]")) return;
  const group = e.target.closest(".rm-subgroup");
  if (group && !group.querySelector("[data-opt-app]:checked")) {
    e.target.checked = true;
    toast("Choose at least one voice app.");
  }
});

function bodyBrief(d) {
  return `
    <p>One file that stands alone: the task, the structure for ${d.duration} s, the channel and fact rules, the catalogue of things that can be rendered, and the answer format.</p>
    <p class="rm-hint">Paste the brief into Claude Code opened in the klipian folder (or download it and give the file's path). It searches the web itself. No API key.</p>
    <div class="rm-actions">
      <button class="btn main" id="rmCopyBrief" data-act="rmCopyBrief" type="button">Copy the full brief</button>
      <button class="btn" id="rmDownBrief" data-act="rmDownBrief" type="button">Download the brief</button>
      <span class="rm-err" id="rmBriefErr" role="alert"></span>
    </div>
    <div class="rm-short" id="rmShort">${shortHTML(briefCache.get(`${d.id}:main`))}</div>
    <p class="rm-hint">The full brief: paste it into any AI. The -create command: paste it into Claude Code (local in the klipian folder, or a cloud session); it builds the video and saves it on main. Then git pull and go on to step 3.</p>
    <details class="rm-adv">
      <summary>Change the video options</summary>
      ${optionsHTML(d.options || {}, "rmOptsProject")}
      <div class="rm-actions"><button class="btn" type="button" data-act="saveOptions">Save options</button><span class="rm-hint">The next brief uses these options; copy the brief again after you change them.</span></div>
    </details>
    ${(d.optionWarnings || []).map((w) => `<div class="rm-warn">${esc(w)}</div>`).join("")}`;
}

// voice first, the last step: the build brief (made after the voice is matched) and then the folder it makes
function bodyBuild(d) {
  const ready = d.voice && d.voice.aligned;
  if (!ready) return `<p class="rm-hint">The picture is built after the voice: make the voice in the step before this one and match it, and this step gives the build brief.</p>`;
  return `
    <p>The voice is matched, so Claude Code now builds the picture to it. Copy the build brief into Claude Code opened in the klipian folder.</p>
    <div class="rm-actions">
      <button class="btn main" id="rmCopyBuild" data-act="rmCopyBuild" type="button">Copy the build brief</button>
      <button class="btn" id="rmDownBuild" data-act="rmDownBuild" type="button">Download the build brief</button>
      <span class="rm-err" id="rmBriefErr" role="alert"></span>
    </div>
    <p class="rm-hint">When Claude Code is done: choose the folder it made, load the story, then match the voice again (the story file changed).</p>
    ${bodyStory(d)}`;
}

// the short -create command: shown before it is copied; disabled when this checkout has no skill that runs it
function shortHTML(c) {
  const ok = !c || c.createSkill !== false;          // not fetched yet (or the fetch failed): the click fetches it
  if (!c || !c.short) return `<div class="rm-actions"><button class="btn" id="rmCopyShort" data-act="rmCopyShort" type="button">Copy the -create command</button></div>`;
  return `<div class="rm-actions"><button class="btn" id="rmCopyShort" data-act="rmCopyShort" type="button"${ok ? "" : " disabled"}>Copy the -create command</button>${ok ? "" : `<span class="rm-hint">Needs the -create skill (.claude/skills/create) in the klipian folder.</span>`}</div>
    <code class="rm-cmd">${esc(c.short)}</code>`;
}
function drawShort() {
  const box = byId("rmShort");
  if (box && CUR) box.innerHTML = shortHTML(briefCache.get(`${CUR.id}:main`));
}

async function copyShort(btn) {
  let c = briefCache.get(`${CUR.id}:main`);
  if (!c) { c = await call(`${API}/brief?id=${encodeURIComponent(CUR.id)}&kind=main&peek=1`); briefCache.set(`${CUR.id}:main`, c); }
  if (c.createSkill === false) return toast("Needs the -create skill (.claude/skills/create) in the klipian folder.");
  (await copyText(c.short)) ? afterBriefCopied(btn) : toast("Could not copy the command.");
}

async function saveOptions() {
  const j = await call(`${API}/options`, { id: CUR.id, options: readOptions(byId("rmOptsProject")) });
  briefCache.delete(`${CUR.id}:main`);
  CUR.options = j.options;
  CUR.optionWarnings = j.warnings;
  NARR = null;                                                  // the voice apps may have changed
  await refresh();
  prefetchBrief();
  toast("Options saved. The brief was updated: copy it again.");
}

async function copyBrief(btn) {
  const cached = briefCache.get(`${CUR.id}:main`);
  if (cached) {                                                   // fetched ahead: the clipboard is written within the click
    const ok = await copyText(cached.brief);
    if (ok) { afterBriefCopied(btn); return; }
    return toast("Could not copy. Use Download the brief.");
  }
  const j = await call(`${API}/brief?id=${encodeURIComponent(CUR.id)}&kind=main&peek=1`);
  briefCache.set(`${CUR.id}:main`, j);
  (await copyText(j.brief)) ? afterBriefCopied(btn) : toast("Could not copy. Use Download the brief.");
}

// the brief was really copied: the server notes it, and the page moves on to the next step
async function afterBriefCopied(btn) {
  flashCopied(btn);
  await call(`${API}/briefed`, { id: CUR.id });
  await refresh();
}

async function downloadBrief(kind) {
  const beats = kind === "revise" ? rejectedBeats().join(",") : "";
  const note = kind === "revise" ? (byId("rmReviseNote")?.value || "") : "";
  const j = await call(`${API}/brief?id=${encodeURIComponent(CUR.id)}&kind=${kind}&beats=${encodeURIComponent(beats)}&note=${encodeURIComponent(note)}`);
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([j.brief], { type: "text/markdown" }));
  a.download = j.file;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  if (kind === "main") await refresh();                      // the server noted the download as a copy
}

// ---------------------------------------------------------------------------------------------------------------------------------------
// 3 the story: the folder Claude Code made (Custom) or the AI's pasted answer (Template), and the storyboard
// ---------------------------------------------------------------------------------------------------------------------------------------

function bodyStory(d) {
  const f = d.folder || { slug: "", path: "", state: "belum dipilih" };
  const picked = f.slug || "";
  const taken = f.state === "cerita diambil";
  return `
    <p>Claude Code writes the story and makes the video folder. Choose the folder it made, then load the story.</p>
    <h3 class="rm-sub-h">Result folder</h3>
    <div class="rm-actions"><span class="rm-chip" data-state="${esc(folderChip(f.state))}">${esc(folderLabel(f.state))}</span>${picked ? `<button class="btn sm" type="button" data-act="pickFolder" data-slug="">Unpick</button>` : ""}</div>
    ${folderPickerHTML(d, picked)}
    <div class="rm-pathrow"><code class="rm-cmd">${esc(f.path || "(no folder yet)")}</code>${f.path ? `<button class="btn sm" type="button" data-act="copyFolderPath">Copy path</button>` : ""}</div>
    <div class="rm-actions"><button class="btn main" type="button" data-act="takeFolder" ${picked ? "" : "disabled"}>${taken ? "Load the story again" : "Load the story from the folder"}</button></div>
    <div class="rm-result" id="rmTakeResult"></div>
    ${taken ? "" : fallbackHTML(d)}
    ${d.story ? storyboardHTML(d) : ""}`;
}

// the folder picker: the search, sort and filter are remembered while the panel is open (FOLDER_UI); only the list is redrawn while typing
const FOLDER_UI = { q: "", filter: "all", sort: "recent" };

function folderPickerHTML(d, picked) {
  return `<div class="rm-fpick">
      <div class="rm-fbar">
        <input class="ws-input rm-boxed rm-fq" id="rmFQ" type="search" placeholder="Search title or slug" aria-label="Search folders" value="${esc(FOLDER_UI.q)}" autocomplete="off">
        <select class="ws-input rm-boxed" id="rmFSort" aria-label="Sort folders">${Object.entries(FOLDER_SORTS).map(([k, v]) => `<option value="${k}" ${FOLDER_UI.sort === k ? "selected" : ""}>${esc(v)}</option>`).join("")}</select>
      </div>
      <div class="rm-fbar" role="group" aria-label="Filter folders">${Object.entries(FOLDER_FILTERS).map(([k, v]) => `<button class="btn sm rm-ffilter" type="button" data-act="folderFilter" data-v="${k}" aria-pressed="${FOLDER_UI.filter === k}">${esc(v)}</button>`).join("")}
        <span class="rm-hint" id="rmFCount" aria-live="polite">${folderCountText(d, picked)}</span></div>
      <div class="rm-flist" id="rmFList"></div>
      <div class="pager" id="rmFPager" hidden></div>
    </div>`;
}

const FOLDER_STATUS_TEXT = { current: "Used by this topic", other: "Taken by another topic", free: "Not taken" };
const fmtFolderDate = (t) => (t ? new Date(t * 1000).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "");

const folderCountText = (d, picked) => `${pickFolders(d.compositions || [], FOLDER_UI, picked).length} of ${(d.compositions || []).length} folders`;

// one pager per drawn panel (its mount is made again whenever the panel is drawn); a change of the search, filter or order goes back to page 1
let folderPager = null, folderMount = null, folderSig = "";
function folderPageOf(rows) {
  const mount = byId("rmFPager");
  if (mount && mount !== folderMount) { folderMount = mount; folderPager = createPager({ key: "motion-folders", mount, onChange: redrawFolderList, labels: ID_PAGER }); folderSig = ""; }
  const sig = JSON.stringify([FOLDER_UI.q, FOLDER_UI.filter, FOLDER_UI.sort]);
  if (sig !== folderSig) { folderSig = sig; folderPager?.first(); }
  return folderPager ? folderPager.slice(rows) : rows;
}

function folderListHTML(d, picked) {
  const all = d.compositions || [], rows = pickFolders(all, FOLDER_UI, picked), page = folderPageOf(rows);
  if (!rows.length) return `<p class="rm-hint">No folder matches.</p>`;
  return page.map((c) => {
    const st = folderStatus(c, picked);
    return `<button class="rm-frow" type="button" data-act="pickFolder" data-slug="${esc(c.slug)}" data-status="${st}" aria-pressed="${st === "current"}">
      <span class="rm-frow-t"><b>${esc(c.title)}</b><code>${esc(c.slug)}</code></span>
      <span class="rm-frow-m">${c.duration ? `${esc(c.duration)} s · ` : ""}${esc(fmtFolderDate(c.modified))}</span>
      <span class="rm-chip" data-state="${st === "free" ? "" : st === "current" ? "aktif" : "perlu"}">${FOLDER_STATUS_TEXT[st]}${st === "other" ? `: ${esc(c.takenBy)}` : ""}</span>
    </button>`;
  }).join("");
}

function redrawFolderList() {
  const el = byId("rmFList");
  const picked = (CUR && CUR.folder && CUR.folder.slug) || "";
  if (el && CUR) { el.innerHTML = folderListHTML(CUR, picked); byId("rmFCount").textContent = folderCountText(CUR, picked); }
  document.querySelectorAll(".rm-ffilter").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.v === FOLDER_UI.filter)));
}

async function pickFolder(slug) {
  if (!CUR || slug === ((CUR.folder && CUR.folder.slug) || "")) return;
  try {
    await call(`${API}/update`, { id: CUR.id, project: { composition: slug } });
    await refresh();
  } catch (ex) { toast(ex.message); await refresh(); }
}

// the fallback of the brief: an assistant that cannot run commands answers with the story only; it is pasted here, and the video is not made until a session that can run commands makes the folder
function fallbackHTML(d) {
  return `<details class="rm-fallback" ${d.story && !(d.folder && d.folder.slug) ? "open" : ""}>
      <summary>The agent cannot run commands?</summary>
      <p class="rm-hint">Paste its answer here (the first line <code>FALLBACK: story only, no video folder</code> and the story's JSON block). The story is saved, but the video is not made yet: open the same brief in a Claude Code session that can run commands, then choose the folder it made.</p>
      <textarea class="ws-input rm-boxed rm-paste" id="rmPaste" placeholder='{ "question": "Kenapa ...?", "titles": [...], "beats": [...] }' spellcheck="false"></textarea>
      <div class="rm-actions"><button class="btn" id="rmPasteBtn" type="button">Check and save</button></div>
      <div class="rm-result" id="rmPasteResult"></div>
    </details>`;
}

function bodyAnswer(d) {
  return `
    <p>Paste the AI's whole answer (one JSON block). Common slips are fixed automatically; when something is wrong, klipian writes a fix message to paste back to the AI.</p>
    <textarea class="ws-input rm-boxed rm-paste" id="rmPaste" placeholder='{ "question": "Kenapa ...?", "titles": [...], "beats": [...] }' spellcheck="false"></textarea>
    <div class="rm-actions"><button class="btn main" id="rmPasteBtn" type="button">Check and save</button></div>
    <div class="rm-result" id="rmPasteResult"></div>
    ${needsHTML(d)}
    ${d.story ? storyboardHTML(d) : ""}`;
}

function needsHTML(d) {
  const needs = d.needs || [];
  const warns = d.warnings || [];
  const warnHTML = warns.length ? `<div class="rm-note"><b>Style guide advice (does not block):</b>${errorsHTML(warns)}</div>` : "";
  return (needs.length ? `<div class="rm-note"><b>Things not in the library yet (the AI says):</b><ul>${needs.map((n) => `<li>${esc(n)}</li>`).join("")}</ul><p class="rm-hint">For now the nearest thing is used.</p></div>` : "") + warnHTML;
}

async function takeFolder() {
  if (!CUR || !CUR.folder || !CUR.folder.slug) return toast("Choose the result folder first.");
  const out = byId("rmTakeResult");
  let j;
  try {
    j = await call(`${API}/take-folder`, { id: CUR.id, slug: CUR.folder.slug });
  } catch (ex) {
    if (ex.data && ex.data.errors) j = ex.data;
    else { if (out) out.textContent = ex.message; return; }
  }
  if (j.ok === false) {
    out.innerHTML = `<b>The story was not saved</b> (${j.errors.length} problem${j.errors.length === 1 ? "" : "s"})${errorsHTML(j.errors)}
      <div class="rm-fix"><div class="rm-actions"><button class="btn" type="button" data-act="copyFix">Copy the fix message</button><span class="rm-hint">Fix story.json in that folder (through Claude Code), then load it again.</span></div>
      <textarea class="ws-input rm-boxed" readonly>${esc(j.fix)}</textarea></div>`;
    out.querySelector("[data-act=copyFix]")._fix = j.fix;
    return;
  }
  toast("Story loaded from the folder.");
  await refresh();
}

async function copyFolderPath() {
  if (!CUR || !CUR.folder || !CUR.folder.path) return;
  (await copyText(CUR.folder.path)) ? toast("Path copied.") : toast("Could not copy: select the text yourself.");
}

byId("rmMain").addEventListener("input", (e) => {
  if (e.target.id === "rmFQ") { FOLDER_UI.q = e.target.value; redrawFolderList(); }
});
byId("rmMain").addEventListener("change", (e) => {
  if (e.target.id === "rmFSort") { FOLDER_UI.sort = e.target.value; redrawFolderList(); }
});

function errorsHTML(errors) {
  return `<ul>${errors.map((x) => `<li>${x.path ? `<code>${esc(x.path)}</code>: ` : ""}${esc(x.message)}</li>`).join("")}</ul>`;
}

async function pasteAnswer(kind) {
  const box = byId(kind === "revise" ? "rmPasteRevise" : "rmPaste");
  const out = byId(kind === "revise" ? "rmReviseResult" : "rmPasteResult");
  const text = box.value.trim();
  if (!text) { out.dataset.ok = "false"; out.textContent = "Paste the AI's answer first."; return; }
  out.dataset.ok = ""; out.textContent = "Checking…";
  let j;
  try {
    j = await call(`${API}/paste`, { id: CUR.id, text, kind });
  } catch (ex) {
    j = ex.data && ex.data.errors ? ex.data : null;
    if (!j) { out.textContent = ex.message; return; }
  }
  if (j.ok === false || j.errors) {
    out.dataset.ok = "false";
    out.innerHTML = `<b>Cannot be used yet</b> (${j.errors.length} problem${j.errors.length === 1 ? "" : "s"})${errorsHTML(j.errors)}
      <div class="rm-fix"><div class="rm-actions"><button class="btn" type="button" data-act="copyFix">Copy the fix message</button><span class="rm-hint">Paste it to the same AI, then paste its new answer here.</span></div>
      <textarea class="ws-input rm-boxed" readonly>${esc(j.fix)}</textarea></div>`;
    out.querySelector("[data-act=copyFix]")._fix = j.fix;
    return;
  }
  const notes = (j.notes || []).map((n) => `<li>Fixed automatically: ${esc(n)}</li>`).join("");
  toast("Story saved.");
  box.value = "";
  await refresh();
  const o = byId(kind === "revise" ? "rmReviseResult" : "rmPasteResult");
  if (o && notes) { o.dataset.ok = "true"; o.innerHTML = `<ul>${notes}</ul>`; }
}

async function copyFix(btn) {
  const text = btn._fix || btn.closest(".rm-fix").querySelector("textarea").value;
  (await copyText(text)) ? flashCopied(btn) : toast("Could not copy: select the text yourself.");
}

// the storyboard: one card per beat, its picture, and the texts that can be edited (the narration and the text on the screen). Custom draws its own scenes, so the
// items of a scene are not shown for it; Template shows the texts of the items, except a banner that holds the same words as the screen text (shown once).
function storyboardHTML(d) {
  const job = d.job || {};
  const busy = job.kind === "preview" && ["queued", "running"].includes(job.state);
  const stills = d.stills || { files: {}, stale: true };
  const have = Object.keys(stills.files).length > 0;
  const custom = d.kind === "custom";
  const real = {};
  if (d.voice && d.voice.aligned && d.voice.table) d.voice.table.beats.forEach((b) => { real[b.id] = b.real; });
  return `
    <h3 class="rm-sub-h">Storyboard</h3>
    <p>${d.story.beats.length} beats, ${esc(lengthText(d.length))}. Question: <b class="rm-q">${esc(d.story.question)}</b></p>
    ${(d.warnings || []).length ? `<div class="rm-note"><b>Style guide advice (does not block):</b><ul>${d.warnings.map((w) => `<li>${esc(w.message)}</li>`).join("")}</ul></div>` : ""}
    <div class="rm-actions">
      <button class="btn" data-act="saveEdits" type="button">Save texts</button>
      <button class="btn" data-act="preview" type="button" ${busy ? "disabled" : ""}>${have ? "Update the pictures" : "Make the storyboard pictures"}</button>
      <span class="rm-hint" id="rmPreviewNote">${busy ? esc(job.message || "") : have && stills.stale ? "The texts or the story changed since the pictures were made." : ""}</span>
    </div>
    <div class="rm-result" id="rmEditResult"></div>
    <div class="rm-sheet">${d.story.beats.map((b, n) => `
      <article class="rm-beat" data-beat="${esc(b.id)}" data-stale="${stills.stale}">
        <h4>${n + 1} · ${esc(kindLabel(b.kind))} <span>${fmtSeconds(b.dur)} s${real[b.id] != null ? ` (voice ${fmtSeconds(real[b.id])})` : ""} · ${esc(b.id)}</span></h4>
        <div class="rm-pic">${stills.files[b.id] ? `<img alt="Beat ${esc(b.id)}" src="${esc(profileUrl(stills.files[b.id]))}">` : "no picture yet"}</div>
        <label>Narration<textarea class="ws-input" data-f="narration" rows="3">${esc(b.narration)}</textarea></label>
        <label>Screen text<input class="ws-input" type="text" data-f="text" value="${esc(b.text)}"></label>
        ${custom ? "" : textItems(b).map(({ it, i }) => `<label>${esc(itemLabel(it.type))}<input class="ws-input" type="text" data-item="${i}" value="${esc(it.text)}"></label>`).join("")}
      </article>`).join("")}</div>`;
}

function textItems(beat) {
  return beat.scene.items.map((it, i) => ({ it, i })).filter(({ it }) => typeof it.text === "string" && !(it.type === "banner" && it.text === beat.text));
}

async function saveEdits() {
  const out = byId("rmEditResult");
  const beats = {};
  document.querySelectorAll("#body-story .rm-beat, #body-answer .rm-beat").forEach((card) => {
    const e = {};
    card.querySelectorAll("[data-f]").forEach((x) => { if (x.value !== x.dataset.was) e[x.dataset.f] = x.value; });
    card.querySelectorAll("[data-item]").forEach((x) => { if (x.value !== x.dataset.was) (e.items ||= {})[x.dataset.item] = { text: x.value }; });
    if (e.text !== undefined) {                                   // the banner that held the same words follows the screen text (it is shown once)
      const beat = CUR.story.beats.find((b) => b.id === card.dataset.beat);
      beat.scene.items.forEach((it, i) => { if (it.type === "banner" && it.text === beat.text) (e.items ||= {})[i] = { text: e.text }; });
    }
    if (Object.keys(e).length) beats[card.dataset.beat] = e;
  });
  if (!Object.keys(beats).length) { out.dataset.ok = ""; out.textContent = "Nothing changed."; return; }
  out.dataset.ok = ""; out.textContent = "Checking…";
  try {
    const j = await call(`${API}/update`, { id: CUR.id, edits: { beats } });
    if (j.ok === false) throw Object.assign(new Error(""), { data: j });
    await refresh();
    const o = byId("rmEditResult");
    if (o) { o.dataset.ok = "true"; o.textContent = "Saved. Update the pictures to see the result."; }
  } catch (ex) {
    const j = ex.data;
    if (j && j.errors) {
      out.dataset.ok = "false";
      out.innerHTML = `<b>Not saved</b>${errorsHTML(j.errors)}`;
    } else out.textContent = ex.message;
  }
}

async function startPreview() {
  const j = await call(`${API}/preview`, { id: CUR.id });
  CUR.job = j.job;
  drawSteps();
  startPoll();
}
