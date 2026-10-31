/* klipian — the /remotion page: a fun-fact motion video from a typed topic, with no API key (klipian/motion.py)
   ==========================================================================
   The flow, top to bottom for the chosen video (Khusus, the main flow; ui/js/remotion/steps.js has the order and the one-line summaries):
     1 Video baru           the topic, the length and the options (loop, "Intip yuk!", music, voice apps) are chosen in the form on the left
     2 Brief                one file to copy into Claude Code; "Ubah pilihan" changes the options and the brief follows
     3 Ambil cerita         the story.json of the folder Claude Code made; the storyboard (texts and timing) is read and edited here
     4 Cek fakta + judul    every claim and its sources, checked or rejected by a person; one title
     5 Naskah suara         the text for each voice app, used BEFORE the voice is made
     6 Impor suara          the voice file, matched to the words; the match table
     7 Pratinjau            a half-size draft with sound
     8 Render               refused by the server until the claims, the title, the folder and the voice agree; progress, time left and Cancel
   Steps are folded: only the active one is open (the server's next step), a finished one shows a summary line. Otomatis (hidden under "Pengaturan lanjutan")
   has the AI's pasted answer in place of the folder.
   Nothing here knows a rule of the story or of the status: the next step, the chips, the render block and the lengths come from the server's detail.
   ========================================================================== */

const API = "/api/motion";
let LIST = [];
let STATUS = { installed: true };
let CUR = null;                 // the chosen video's detail (from /api/motion/project)
let POLL = null;
let newDuration = 45;
let OPEN = null;                // the id of the step that is open (one at a time)
let LAST_ACTIVE = null;         // the active step at the last draw: when it changes, the open step follows it
let NARR = null;                // { forId, exports: { <app>: export } }: the voice texts, loaded when the script step opens
let NARR_APP = null;            // the app whose text the script step shows
let PART_TO_REPLACE = null;     // the number of the part the next path replaces (set by "Ganti bagian")
const briefCache = new Map();   // `${id}:main` -> text (fetched ahead, so the Copy click can write to the clipboard at once)

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const byId = (id) => document.getElementById(id);

async function call(path, body) {
  const r = await fetch(path, body === undefined ? {} : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.ok === false || j.error) {
    const e = new Error(j.error || `gagal (${r.status})`);
    e.data = j;
    throw e;
  }
  return j;
}
const fmtEta = (s) => (s == null ? "" : `sisa ± ${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`);
const toast = (text) => (typeof showToast === "function" ? showToast(text, { ms: 6000 }) : alert(text));

// ---------------------------------------------------------------------------------------------------------------------------------------
// the list and the new-video form
// ---------------------------------------------------------------------------------------------------------------------------------------

async function loadList(selectId) {
  try {
    const j = await call(`${API}/projects`);
    LIST = j.projects;
    STATUS = j.status;
  } catch (e) {
    byId("rmList").innerHTML = `<p class="rm-empty">${esc(e.message)}</p>`;
    return;
  }
  const miss = byId("rmMissing");
  miss.hidden = STATUS.installed;
  miss.innerHTML = STATUS.installed ? "" : `<p><b>Mesin video belum siap.</b> ${esc(STATUS.message)}</p>`;
  drawList();
  const want = selectId || (location.hash || "").slice(1) || CUR?.id;
  if (want && LIST.some((p) => p.id === want)) await choose(want);
  else if (!CUR) drawIntro();
}

function drawList() {
  const list = byId("rmList");
  if (!LIST.length) { list.innerHTML = `<p class="rm-empty">Belum ada video. Tekan "Video baru".</p>`; return; }
  list.innerHTML = LIST.map((p) => `
    <button class="rm-item" type="button" role="listitem" data-id="${esc(p.id)}" aria-current="${CUR?.id === p.id}">
      <b>${esc(p.title || p.topic)}</b>
      <span class="rm-meta"><span class="rm-chip" data-state="${esc((p.chip || {}).state || "")}">${esc((p.chip || {}).label || "")}</span><span>${esc(lengthText({ planned: p.seconds ?? p.duration, voiced: p.voiced ? p.seconds : null }))}</span><span>${esc(dateText(p.updated))}</span>${p.hasStory && p.unchecked ? `<span>${p.unchecked} klaim belum dicek</span>` : ""}</span>
    </button>`).join("");
}

byId("rmList").addEventListener("click", (e) => {
  const b = e.target.closest(".rm-item");
  if (b) choose(b.dataset.id);
});

byId("rmNewBtn").addEventListener("click", () => {
  const f = byId("rmNew");
  f.hidden = !f.hidden;
  if (!f.hidden) byId("rmTopic").focus();
});
byId("rmNewCancel").addEventListener("click", () => { byId("rmNew").hidden = true; byId("rmNewErr").textContent = ""; });
byId("rmDur").addEventListener("click", (e) => {
  const b = e.target.closest("button[data-d]");
  if (!b) return;
  newDuration = Number(b.dataset.d);
  byId("rmDur").querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
});
byId("rmNew").addEventListener("submit", async (e) => {
  e.preventDefault();
  const err = byId("rmNewErr");
  err.textContent = "";
  try {
    const j = await call(`${API}/create`, { topic: byId("rmTopic").value, duration: newDuration, notes: byId("rmNotes").value, options: readOptions(byId("rmOptsNew")) });
    byId("rmNew").hidden = true;
    byId("rmTopic").value = ""; byId("rmNotes").value = "";
    await loadList(j.project.id);
  } catch (ex) { err.textContent = ex.message; }
});

// ---------------------------------------------------------------------------------------------------------------------------------------
// one video: the head, the next step, and the steps
// ---------------------------------------------------------------------------------------------------------------------------------------

function drawIntro() {
  byId("rmMain").innerHTML = `
    <section class="ws-panel rm-step rm-welcome">
      <h2>Dari topik ke video</h2>
      <ol>
        <li>Buat video baru: tulis topik, pilih durasi dan pilihan videonya (loop, "Intip yuk!", musik, aplikasi suara).</li>
        <li>Salin brief ke Claude Code yang dibuka di folder klipian. Ia mencari web, menulis cerita, dan membuat folder videonya.</li>
        <li>Pilih folder hasilnya dan ambil ceritanya, cek setiap klaim beserta sumbernya, lalu pilih judul.</li>
        <li>Buat naskah untuk aplikasi suara, impor suaranya dan cocokkan, lihat pratinjau, lalu Render. Hasilnya masuk ke Clips, siap diunggah.</li>
      </ol>
      <p class="rm-hint">Tanpa API key: klipian bekerja di komputer ini, dan AI-nya adalah Claude Code di komputer ini.</p>
    </section>`;
}

async function choose(id) {
  location.hash = id;
  stopPoll();
  NARR = null; NARR_APP = null;
  try {
    CUR = (await call(`${API}/project?id=${encodeURIComponent(id)}`)).project;
  } catch (e) {
    CUR = null;
    byId("rmMain").innerHTML = `<section class="ws-panel"><p class="rm-empty">${esc(e.message)}</p></section>`;
    return;
  }
  drawList();
  OPEN = LAST_ACTIVE = activeStepFor(CUR);
  buildDetail();
  prefetchBrief();
  if (["queued", "running"].includes(CUR.job?.state)) startPoll();
}

async function refresh() {
  CUR = (await call(`${API}/project?id=${encodeURIComponent(CUR.id)}`)).project;
  const i = LIST.findIndex((p) => p.id === CUR.id);
  if (i >= 0) {
    const { id, topic, duration, seconds, voiced, status, title, chip, claims, unchecked, hasStory, updated, composition } = CUR;
    LIST[i] = { ...LIST[i], id, topic, duration, seconds, voiced, status, title, chip, claims, unchecked, hasStory, updated, composition };
  }
  const active = activeStepFor(CUR);
  if (active !== LAST_ACTIVE) { OPEN = LAST_ACTIVE = active; }     // the open step follows the work
  drawList();
  drawAll();
}

async function prefetchBrief() {
  const id = CUR?.id;
  try {
    briefCache.set(`${id}:main`, await call(`${API}/brief?id=${encodeURIComponent(id)}&kind=main&peek=1`));
  } catch (e) { briefCache.delete(`${id}:main`); }
}

function buildDetail() {
  byId("rmMain").innerHTML = `
    <section class="ws-panel rm-head" id="rmHead"></section>
    <section class="ws-panel rm-nextbar" id="stepNext"></section>
    <div class="rm-steps" id="rmSteps"></div>`;
  drawAll();
}

function drawAll() {
  drawHead();
  drawNext();
  drawSteps();
}

// the head: the chosen title (the topic until there is one), the status chip and the length (the voiced one when there is a voice)
function drawHead() {
  const d = CUR;
  const chip = d.chip || {};
  byId("rmHead").innerHTML = `
    <div class="rm-title">
      <div style="min-width:0">
        <h1>${esc(d.displayTitle || d.title || d.topic)}</h1>
        <div class="rm-meta"><span class="rm-chip" data-state="${esc(chip.state || "")}">${esc(chip.label || "")}</span><span>${esc(lengthText(d.length))}</span><span>${d.kind === "custom" ? "Khusus" : "Otomatis"}</span>${d.notes ? `<span title="${esc(d.notes)}">ada catatan</span>` : ""}</div>
      </div>
    </div>`;
}

// the next step: the sentence from the server and a link to the step (the actions themselves live in their steps, once)
function drawNext() {
  const d = CUR;
  const n = d.next || {};
  const active = activeStepFor(d);
  const chips = (d.stages || []).map((c) => `<span class="rm-chip" data-state="${esc(c.state)}">${esc(c.label)}: ${esc(c.state)}</span>`).join("");
  byId("stepNext").innerHTML = `
    <div class="rm-next"><b>Langkah berikutnya:</b> ${esc(n.text || "")}</div>
    <div class="rm-actions"><button class="btn" type="button" data-act="openStep" data-step="${esc(active)}">Buka langkah ${stepNum(d.kind, active)}</button></div>
    <div class="rm-chips">${chips}</div>`;
}

const STEP_BODY = { new: bodyNew, brief: bodyBrief, story: bodyStory, answer: bodyAnswer, facts: bodyFacts, script: bodyScript, voice: bodyVoice, preview: bodyPreview, render: bodyRender };

function drawSteps() {
  const d = CUR;
  byId("rmSteps").innerHTML = stepsFor(d.kind).map((s) => {
    const open = OPEN === s.id;
    const state = stepState(s.id, d);
    return `
      <section class="ws-panel rm-step" id="step-${s.id}" data-step="${s.id}" data-open="${open}" data-state="${esc(state)}">
        <button class="rm-acc" type="button" data-act="toggleStep" data-step="${s.id}" aria-expanded="${open}" aria-controls="body-${s.id}">
          <span class="rm-n">${s.num}</span><span class="rm-acc-title">${esc(s.title)}</span>
          <span class="rm-chip" data-state="${esc(state)}">${esc(state)}</span>
          <span class="rm-acc-sum">${esc(stepSummary(s.id, d))}</span>
        </button>
        <div class="rm-body" id="body-${s.id}" ${open ? "" : "hidden"}>${open ? STEP_BODY[s.id](d) : ""}</div>
      </section>`;
  }).join("");
  afterOpen();
}

// what a step needs once its body is in the page
function afterOpen() {
  if (OPEN === "script") ensureNarration();
  const box = byId("body-story") || byId("body-answer");
  if (box) box.querySelectorAll("[data-f],[data-item]").forEach((x) => { x.dataset.was = x.value; });
}

function openStep(id, scroll) {
  OPEN = id;
  drawSteps();
  if (scroll) byId(`step-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

byId("rmMain").addEventListener("click", async (e) => {
  const t = e.target.closest("button");
  if (!t) return;
  const act = t.dataset.act || t.id;
  if (!CUR) return;
  try {
    if (act === "toggleStep") return openStep(OPEN === t.dataset.step ? null : t.dataset.step, false);
    if (act === "openStep") return openStep(t.dataset.step, true);
    if (act === "rmCopyBrief") return copyBrief(t);
    if (act === "rmDownBrief") return downloadBrief("main");
    if (act === "rmPasteBtn") return pasteAnswer("main");
    if (act === "rmDelete") return deleteVideo();
    if (act === "preview") return startPreview();
    if (act === "saveEdits") return saveEdits();
    if (act === "claim") return setClaim(Number(t.dataset.i), t.dataset.s);
    if (act === "allRight") return allRight();
    if (act === "title") return setTitle(t.dataset.t);
    if (act === "render") return startRender();
    if (act === "cancel") return cancelJob();
    if (act === "voicePath") return importVoicePath();
    if (act === "voiceAlign") return alignVoice();
    if (act === "voiceClear") return clearVoice();
    if (act === "voiceTts") return ttsVoice();
    if (act === "voicePart") return pickPart(t.dataset.no);
    if (act === "voiceLength") return chooseLength(t.dataset.choice);
    if (act === "previewVideo") return startPreviewVideo();
    if (act === "saveOptions") return saveOptions();
    if (act === "takeFolder") return takeFolder();
    if (act === "copyFolderPath") return copyFolderPath();
    if (act === "narrationApp") { NARR_APP = t.dataset.app; return drawSteps(); }
    if (act === "narrationCopy") return copyNarration(t.dataset.app, t.dataset.part);
    if (act === "narrationDown") return downloadNarration(t.dataset.app, t.dataset.part);
    if (act === "copyFix") return copyFix(t);
    if (act === "copyRevise") return copyRevise(t);
    if (act === "downRevise") return downloadBrief("revise");
    if (act === "pasteRevise") return pasteAnswer("revise");
  } catch (ex) { toast(ex.message); }
});

// ---------------------------------------------------------------------------------------------------------------------------------------
// 1 video baru
// ---------------------------------------------------------------------------------------------------------------------------------------

function bodyNew(d) {
  const custom = d.kind === "custom";
  return `
    <dl class="rm-kv">
      <dt>Topik</dt><dd>${esc(d.topic)}</dd>
      <dt>Durasi</dt><dd>${d.duration} detik direncanakan${d.length && d.length.voiced != null ? `, ${esc(lengthText(d.length))}` : ""}</dd>
      ${d.notes ? `<dt>Catatan</dt><dd>${esc(d.notes)}</dd>` : ""}
      <dt>Pilihan</dt><dd>${esc(optionsSummary(d.options))}</dd>
    </dl>
    <p class="rm-hint">Pilihan video (loop, "Intip yuk!", musik, aplikasi suara) diubah di langkah 2, Brief.</p>
    <div class="rm-actions"><button class="btn danger" id="rmDelete" type="button">Hapus video</button></div>
    <details class="rm-adv">
      <summary>Pengaturan lanjutan</summary>
      <label class="ws-field">Jenis video
        <select class="ws-input rm-boxed rm-select" id="rmKind" aria-label="Jenis video">
          <option value="khusus" ${custom ? "selected" : ""}>Khusus: video buatan Claude Code, tampilan terbaik</option>
          <option value="otomatis" ${custom ? "" : "selected"}>Otomatis: template klipian, draf cepat</option>
        </select>
      </label>
      <p class="rm-hint">${custom ? "Khusus: cerita dan folder video diambil dari Claude Code (langkah 3)." : "Otomatis: jawaban AI ditempel (langkah 3), lalu dirender dengan template klipian."}</p>
    </details>`;
}

document.addEventListener("change", async (e) => {
  if (e.target.id !== "rmKind" || !CUR) return;
  const next = e.target.value === "khusus" ? "Khusus (video buatan Claude Code)" : "Otomatis (template klipian)";
  const ok = await confirmDialog({ title: "Ganti jenis video?", message: `Render berikutnya memakai ${next}. Hasil render yang lama tetap ada di Clips.`, confirmText: "Ganti", cancelText: "Batal" });
  if (!ok) return refresh();
  await call(`${API}/options`, { id: CUR.id, options: { kind: e.target.value } });
  await refresh();
});

// ---------------------------------------------------------------------------------------------------------------------------------------
// 2 brief and the options of the video
// ---------------------------------------------------------------------------------------------------------------------------------------

// the options of a video: the same controls in the form of a new video and under "Ubah pilihan" in the brief step; they shape the brief
function readOptions(root) {
  const o = {};
  root.querySelectorAll("[data-opt]").forEach((x) => { o[x.dataset.opt] = x.type === "checkbox" ? x.checked : x.value; });
  const apps = [...root.querySelectorAll("[data-opt-app]:checked")].map((x) => x.dataset.optApp);
  if (!apps.length) throw new Error("Pilih minimal satu aplikasi suara.");
  o.voiceTargets = apps;
  return o;
}

function optionsHTML(opts, id) {
  const sel = (key, list) => `<select class="ws-input rm-boxed" data-opt="${key}">${list.map(([v, l]) => `<option value="${v}" ${opts[key] === v ? "selected" : ""}>${l}</option>`).join("")}</select>`;
  const checked = opts.voiceTargets || VOICE_APP_ORDER;
  return `<div class="rm-group" id="${id}">
    <label class="rm-check"><input type="checkbox" data-opt="loop" ${opts.loop ? "checked" : ""}> Loop (akhir kembali ke adegan awal)</label>
    <label class="rm-check"><input type="checkbox" data-opt="sting" ${opts.sting ? "checked" : ""}> "Intip yuk!" setelah hook</label>
    <label class="ws-field">Musik ${sel("music", Object.entries(MUSIC_LABELS))}</label>
    <div class="rm-subgroup" role="group" aria-label="Aplikasi suara">
      <span class="rm-sublabel">Aplikasi suara (centang yang dipakai; naskahnya dibuat untuk tiap aplikasi)</span>
      ${VOICE_APP_ORDER.map((k) => `<label class="rm-check"><input type="checkbox" data-opt-app="${k}" ${checked.includes(k) ? "checked" : ""}> ${VOICE_APP_LABELS[k]}</label>`).join("")}
    </div>
  </div>`;
}

// at least one app stays checked: unchecking the last one is undone, with the reason
document.addEventListener("change", (e) => {
  if (!e.target.matches || !e.target.matches("[data-opt-app]")) return;
  const group = e.target.closest(".rm-subgroup");
  if (group && !group.querySelector("[data-opt-app]:checked")) {
    e.target.checked = true;
    toast("Pilih minimal satu aplikasi suara.");
  }
});

function bodyBrief(d) {
  return `
    <p>Satu file mandiri: tugas, struktur ${d.duration} detik, aturan channel dan fakta, katalog benda yang bisa dirender, serta format jawaban.</p>
    <p class="rm-hint">Tempel brief ke Claude Code yang dibuka di folder klipian (atau unduh lalu berikan path berkasnya). Ia mencari web sendiri. Tanpa API key.</p>
    <div class="rm-actions">
      <button class="btn main" id="rmCopyBrief" data-act="rmCopyBrief" type="button">Salin brief</button>
      <button class="btn" id="rmDownBrief" data-act="rmDownBrief" type="button">Unduh brief</button>
      <span class="rm-err" id="rmBriefErr" role="alert"></span>
    </div>
    <details class="rm-adv">
      <summary>Ubah pilihan video</summary>
      ${optionsHTML(d.options || {}, "rmOptsProject")}
      <div class="rm-actions"><button class="btn" type="button" data-act="saveOptions">Simpan pilihan</button><span class="rm-hint">Brief berikutnya memakai pilihan ini; salin brief lagi setelah mengubahnya.</span></div>
    </details>
    ${(d.optionWarnings || []).map((w) => `<div class="rm-warn">${esc(w)}</div>`).join("")}`;
}

async function saveOptions() {
  const j = await call(`${API}/options`, { id: CUR.id, options: readOptions(byId("rmOptsProject")) });
  briefCache.delete(`${CUR.id}:main`);
  CUR.options = j.options;
  CUR.optionWarnings = j.warnings;
  NARR = null;                                                  // the voice apps may have changed
  await refresh();
  prefetchBrief();
  toast("Pilihan disimpan. Brief sudah diperbarui: salin lagi.");
}

async function copyBrief(btn) {
  const cached = briefCache.get(`${CUR.id}:main`);
  if (cached) {                                                   // fetched ahead: the clipboard is written within the click
    const ok = await copyText(cached.brief);
    if (ok) { afterBriefCopied(btn); return; }
    return toast("Tidak bisa menyalin. Pakai Unduh brief.");
  }
  const j = await call(`${API}/brief?id=${encodeURIComponent(CUR.id)}&kind=main&peek=1`);
  briefCache.set(`${CUR.id}:main`, j);
  (await copyText(j.brief)) ? afterBriefCopied(btn) : toast("Tidak bisa menyalin. Pakai Unduh brief.");
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
// 3 the story: the folder Claude Code made (Khusus) or the AI's pasted answer (Otomatis), and the storyboard
// ---------------------------------------------------------------------------------------------------------------------------------------

function bodyStory(d) {
  const f = d.folder || { slug: "", path: "", state: "belum dipilih" };
  const picked = f.slug || "";
  const taken = f.state === "cerita diambil";
  return `
    <p>Claude Code menulis cerita dan membuat folder videonya. Pilih folder hasilnya, lalu ambil ceritanya.</p>
    <h3 class="rm-sub-h">Folder hasil</h3>
    <div class="rm-actions">
      <select class="ws-input rm-boxed rm-select" id="rmComp" aria-label="Folder hasil">
        <option value="">Belum dipilih</option>
        ${(d.compositions || []).map((c) => `<option value="${esc(c.slug)}" ${picked === c.slug ? "selected" : ""}>${esc(c.title)} · ${esc(c.slug)}</option>`).join("")}
      </select>
      <span class="rm-chip" data-state="${esc(folderChip(f.state))}">${esc(folderChip(f.state))}</span>
    </div>
    <div class="rm-pathrow"><code class="rm-cmd">${esc(f.path || "(belum ada folder)")}</code>${f.path ? `<button class="btn sm" type="button" data-act="copyFolderPath">Salin path</button>` : ""}</div>
    <div class="rm-actions"><button class="btn main" type="button" data-act="takeFolder" ${picked ? "" : "disabled"}>${taken ? "Ambil ulang cerita" : "Ambil cerita dari folder"}</button></div>
    <div class="rm-result" id="rmTakeResult"></div>
    ${d.story ? storyboardHTML(d) : ""}`;
}

function bodyAnswer(d) {
  return `
    <p>Tempel seluruh jawaban AI (satu blok JSON). Slip umum dibetulkan sendiri; kalau ada yang salah, klipian membuat pesan perbaikan untuk ditempel balik ke AI.</p>
    <textarea class="ws-input rm-boxed rm-paste" id="rmPaste" placeholder='{ "question": "Kenapa ...?", "titles": [...], "beats": [...] }' spellcheck="false"></textarea>
    <div class="rm-actions"><button class="btn main" id="rmPasteBtn" type="button">Periksa dan simpan</button></div>
    <div class="rm-result" id="rmPasteResult"></div>
    ${needsHTML(d)}
    ${d.story ? storyboardHTML(d) : ""}`;
}

function needsHTML(d) {
  const needs = d.needs || [];
  const warns = d.warnings || [];
  const warnHTML = warns.length ? `<div class="rm-note"><b>Saran buku gaya (belum menghalangi):</b>${errorsHTML(warns)}</div>` : "";
  return (needs.length ? `<div class="rm-note"><b>Benda yang belum ada di pustaka (kata AI):</b><ul>${needs.map((n) => `<li>${esc(n)}</li>`).join("")}</ul><p class="rm-hint">Untuk sementara dipakai benda terdekat.</p></div>` : "") + warnHTML;
}

async function takeFolder() {
  if (!CUR || !CUR.folder || !CUR.folder.slug) return toast("Pilih folder hasil dulu.");
  const out = byId("rmTakeResult");
  let j;
  try {
    j = await call(`${API}/take-folder`, { id: CUR.id, slug: CUR.folder.slug });
  } catch (ex) {
    if (ex.data && ex.data.errors) j = ex.data;
    else { if (out) out.textContent = ex.message; return; }
  }
  if (j.ok === false) {
    out.innerHTML = `<b>Cerita belum disimpan</b> (${j.errors.length} masalah)${errorsHTML(j.errors)}
      <div class="rm-fix"><div class="rm-actions"><button class="btn" type="button" data-act="copyFix">Salin pesan perbaikan</button><span class="rm-hint">Perbaiki story.json di folder itu (lewat Claude Code), lalu ambil lagi.</span></div>
      <textarea class="ws-input rm-boxed" readonly>${esc(j.fix)}</textarea></div>`;
    out.querySelector("[data-act=copyFix]")._fix = j.fix;
    return;
  }
  toast("Cerita diambil dari folder.");
  await refresh();
}

async function copyFolderPath() {
  if (!CUR || !CUR.folder || !CUR.folder.path) return;
  (await copyText(CUR.folder.path)) ? toast("Path disalin.") : toast("Tidak bisa menyalin: pilih teksnya sendiri.");
}

byId("rmMain").addEventListener("change", async (e) => {
  if (e.target.id !== "rmComp" || !CUR) return;
  try {
    await call(`${API}/update`, { id: CUR.id, project: { composition: e.target.value } });
    await refresh();
  } catch (ex) { toast(ex.message); await refresh(); }
});

function errorsHTML(errors) {
  return `<ul>${errors.map((x) => `<li>${x.path ? `<code>${esc(x.path)}</code>: ` : ""}${esc(x.message)}</li>`).join("")}</ul>`;
}

async function pasteAnswer(kind) {
  const box = byId(kind === "revise" ? "rmPasteRevise" : "rmPaste");
  const out = byId(kind === "revise" ? "rmReviseResult" : "rmPasteResult");
  const text = box.value.trim();
  if (!text) { out.dataset.ok = "false"; out.textContent = "Tempel jawaban AI dulu."; return; }
  out.dataset.ok = ""; out.textContent = "Memeriksa…";
  let j;
  try {
    j = await call(`${API}/paste`, { id: CUR.id, text, kind });
  } catch (ex) {
    j = ex.data && ex.data.errors ? ex.data : null;
    if (!j) { out.textContent = ex.message; return; }
  }
  if (j.ok === false || j.errors) {
    out.dataset.ok = "false";
    out.innerHTML = `<b>Belum bisa dipakai</b> (${j.errors.length} masalah)${errorsHTML(j.errors)}
      <div class="rm-fix"><div class="rm-actions"><button class="btn" type="button" data-act="copyFix">Salin pesan perbaikan</button><span class="rm-hint">Tempel ke AI yang sama, lalu tempel jawaban barunya di sini.</span></div>
      <textarea class="ws-input rm-boxed" readonly>${esc(j.fix)}</textarea></div>`;
    out.querySelector("[data-act=copyFix]")._fix = j.fix;
    return;
  }
  const notes = (j.notes || []).map((n) => `<li>Dibetulkan otomatis: ${esc(n)}</li>`).join("");
  toast("Cerita tersimpan.");
  box.value = "";
  await refresh();
  const o = byId(kind === "revise" ? "rmReviseResult" : "rmPasteResult");
  if (o && notes) { o.dataset.ok = "true"; o.innerHTML = `<ul>${notes}</ul>`; }
}

async function copyFix(btn) {
  const text = btn._fix || btn.closest(".rm-fix").querySelector("textarea").value;
  (await copyText(text)) ? flashCopied(btn) : toast("Tidak bisa menyalin: pilih teksnya sendiri.");
}

// the storyboard: one card per beat, its picture, and the texts that can be edited (the narration and the text on the screen). Khusus draws its own scenes, so the
// items of a scene are not shown for it; Otomatis shows the texts of the items, except a banner that holds the same words as the screen text (shown once).
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
    <p>${d.story.beats.length} beat, ${esc(lengthText(d.length))}. Pertanyaan: <b class="rm-q">${esc(d.story.question)}</b></p>
    ${(d.warnings || []).length ? `<div class="rm-note"><b>Saran buku gaya (bukan penghalang):</b><ul>${d.warnings.map((w) => `<li>${esc(w.message)}</li>`).join("")}</ul></div>` : ""}
    <div class="rm-actions">
      <button class="btn" data-act="saveEdits" type="button">Simpan teks</button>
      <button class="btn" data-act="preview" type="button" ${busy ? "disabled" : ""}>${have ? "Perbarui gambar" : "Buat gambar storyboard"}</button>
      <span class="rm-hint" id="rmPreviewNote">${busy ? esc(job.message || "") : have && stills.stale ? "Teks atau cerita berubah sejak gambar dibuat." : ""}</span>
    </div>
    <div class="rm-result" id="rmEditResult"></div>
    <div class="rm-sheet">${d.story.beats.map((b, n) => `
      <article class="rm-beat" data-beat="${esc(b.id)}" data-stale="${stills.stale}">
        <h4>${n + 1} · ${esc(kindLabel(b.kind))} <span>${fmtSeconds(b.dur)} dtk${real[b.id] != null ? ` (suara ${fmtSeconds(real[b.id])})` : ""} · ${esc(b.id)}</span></h4>
        <div class="rm-pic">${stills.files[b.id] ? `<img alt="Beat ${esc(b.id)}" src="${esc(profileUrl(stills.files[b.id]))}">` : "belum ada gambar"}</div>
        <label>Narasi<textarea class="ws-input" data-f="narration" rows="3">${esc(b.narration)}</textarea></label>
        <label>Teks layar<input class="ws-input" type="text" data-f="text" value="${esc(b.text)}"></label>
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
  if (!Object.keys(beats).length) { out.dataset.ok = ""; out.textContent = "Tidak ada yang berubah."; return; }
  out.dataset.ok = ""; out.textContent = "Memeriksa…";
  try {
    const j = await call(`${API}/update`, { id: CUR.id, edits: { beats } });
    if (j.ok === false) throw Object.assign(new Error(""), { data: j });
    await refresh();
    const o = byId("rmEditResult");
    if (o) { o.dataset.ok = "true"; o.textContent = "Tersimpan. Perbarui gambar untuk melihat hasilnya."; }
  } catch (ex) {
    const j = ex.data;
    if (j && j.errors) {
      out.dataset.ok = "false";
      out.innerHTML = `<b>Tidak disimpan</b>${errorsHTML(j.errors)}`;
    } else out.textContent = ex.message;
  }
}

async function startPreview() {
  const j = await call(`${API}/preview`, { id: CUR.id });
  CUR.job = j.job;
  drawSteps();
  startPoll();
}

// ---------------------------------------------------------------------------------------------------------------------------------------
// 4 facts and the title
// ---------------------------------------------------------------------------------------------------------------------------------------

const rejectedBeats = () => [...new Set((CUR.facts || []).filter((f) => f.status === "rejected").flatMap((f) => f.beats))];

function bodyFacts(d) {
  if (!d.story) return `<p class="rm-hint">Ambil ceritanya dulu (langkah 3).</p>`;
  const facts = d.facts || [];
  const rej = facts.some((f) => f.status === "rejected");
  const pending = facts.filter((f) => f.status !== "checked" && f.status !== "rejected").length;
  return `
    <p>Buka setiap sumber, pastikan klaimnya benar. Render baru bisa setelah semua klaim dicentang dan satu judul dipilih.</p>
    ${facts.length ? "" : `<p class="rm-hint">Cerita ini tidak punya klaim.</p>`}
    ${pending ? `<div class="rm-actions"><button class="btn ${rej ? "" : "main"}" type="button" data-act="allRight">Benar semua</button><span class="rm-hint">Menandai ${pending} klaim yang menunggu sebagai benar, dengan tanggal hari ini.</span></div>` : ""}
    <div class="rm-claims">${facts.map((f, i) => `
      <div class="rm-claim" data-s="${esc(f.status)}">
        <div class="rm-text">${i + 1}. ${esc(f.text)}</div>
        <div class="rm-src">${f.sources.map((u) => `<a href="${esc(u)}" target="_blank" rel="noopener noreferrer">${esc(u)}</a>`).join("")}</div>
        <div class="rm-row">Dipakai di: ${f.beats.map((b) => `<span class="rm-tag">${esc(b)}</span>`).join("")}${f.date ? `<span>· ${esc(f.status === "checked" ? "dicek" : "ditolak")} ${esc(f.date)}</span>` : ""}</div>
        <div class="rm-actions">
          <button class="btn sm" type="button" data-act="claim" data-i="${i}" data-s="checked" aria-pressed="${f.status === "checked"}">Benar</button>
          <button class="btn sm danger" type="button" data-act="claim" data-i="${i}" data-s="rejected" aria-pressed="${f.status === "rejected"}">Tolak</button>
          ${f.status !== "pending" ? `<button class="btn sm quiet" type="button" data-act="claim" data-i="${i}" data-s="pending">Batalkan</button>` : ""}
          ${f.status === "rejected" ? `<input class="ws-input" type="text" data-note="${i}" maxlength="500" placeholder="Kenapa ditolak? (untuk AI)" value="${esc(f.note || "")}">` : ""}
        </div>
      </div>`).join("")}</div>
    <h3 class="rm-sub-h">Judul</h3>
    <p>Pilih satu. Ini jadi judul di Clips dan di YouTube.</p>
    <div class="rm-titles">${d.story.titles.map((t) => `<button class="btn" type="button" data-act="title" data-t="${esc(t)}" aria-pressed="${d.title === t}">${esc(t)}<small>${t.length}</small></button>`).join("")}</div>
    ${rej ? `
    <h3 class="rm-sub-h">Revisi untuk klaim yang ditolak</h3>
    <p>Hanya beat yang memakai klaim itu (${rejectedBeats().map(esc).join(", ")}) yang dikirim ke AI, bukan seluruh video.</p>
    <label class="ws-field">Catatan tambahan (opsional)<input class="ws-input rm-boxed" id="rmReviseNote" type="text" maxlength="400"></label>
    <div class="rm-actions"><button class="btn main" data-act="copyRevise" type="button">Salin brief revisi</button><button class="btn" data-act="downRevise" type="button">Unduh</button></div>
    <textarea class="ws-input rm-boxed rm-paste" id="rmPasteRevise" placeholder="Tempel jawaban revisi dari AI (JSON dengan beats dan claims)" spellcheck="false"></textarea>
    <div class="rm-actions"><button class="btn" data-act="pasteRevise" type="button">Periksa dan simpan revisi</button></div>
    <div class="rm-result" id="rmReviseResult"></div>` : ""}`;
}

byId("rmMain").addEventListener("change", async (e) => {
  const n = e.target.closest("[data-note]");
  if (!n || !CUR) return;
  try { await call(`${API}/facts`, { id: CUR.id, claims: [{ index: Number(n.dataset.note), note: n.value }] }); } catch (ex) { toast(ex.message); }
});

async function setClaim(index, status) {
  const j = await call(`${API}/facts`, { id: CUR.id, claims: [{ index, status }] });
  CUR.facts = j.facts;
  await refresh();
}

// "Benar semua": asks once (the person opened the sources), then every claim that waits is checked with today's date; a rejected claim stays
async function allRight() {
  const ok = await confirmDialog({ title: "Benar semua?", message: "Sudah buka sumbernya?", confirmText: "Sudah, benar semua", cancelText: "Belum", tone: "primary" });
  if (!ok) return;
  const j = await call(`${API}/facts`, { id: CUR.id, all: "checked" });
  CUR.facts = j.facts;
  await refresh();
  toast(j.skipped ? `Klaim ditandai benar. ${j.skipped} klaim yang ditolak tidak diubah.` : "Semua klaim ditandai benar.");
}

async function copyRevise(btn) {
  const beats = rejectedBeats().join(",");
  const note = byId("rmReviseNote").value;
  const j = await call(`${API}/brief?id=${encodeURIComponent(CUR.id)}&kind=revise&beats=${encodeURIComponent(beats)}&note=${encodeURIComponent(note)}`);
  (await copyText(j.brief)) ? flashCopied(btn) : toast("Tidak bisa menyalin. Pakai Unduh.");
}

async function setTitle(t) {
  await call(`${API}/facts`, { id: CUR.id, title: t });
  await refresh();
}

// ---------------------------------------------------------------------------------------------------------------------------------------
// 5 the script for the voice app (used before the voice is made)
// ---------------------------------------------------------------------------------------------------------------------------------------

// the texts are loaded when the step opens: nothing is opened for the person, and the first checked app is the one shown
async function ensureNarration() {
  if (!CUR || !CUR.story) return;
  if (NARR && NARR.forId === CUR.id) return;
  const id = CUR.id;
  const apps = voiceAppsInOrder(CUR.options);
  try {
    const pairs = await Promise.all(apps.map(async (key) => [key, { ...(await call(`${API}/narration?id=${encodeURIComponent(id)}&target=${key}`)), forId: id }]));
    if (!CUR || CUR.id !== id) return;
    NARR = { forId: id, exports: Object.fromEntries(pairs) };
  } catch (ex) { return toast(ex.message); }
  if (OPEN === "script") drawSteps();
}

function bodyScript(d) {
  if (!d.story) return `<p class="rm-hint">Ambil ceritanya dulu (langkah 3).</p>`;
  const apps = voiceAppsInOrder(d.options);
  if (!NARR_APP || !apps.includes(NARR_APP)) NARR_APP = apps[0];
  const ex = narrationShown(NARR, d.id, NARR_APP);
  return `
    <p>Salin naskahnya ke aplikasi suara kamu, lalu buat suaranya di sana (klipian tidak memanggil layanan suara). Aplikasi yang dipakai diubah di langkah 2, Brief.</p>
    <div class="rm-tabs" role="tablist" aria-label="Aplikasi suara">${apps.map((k) => `<button class="btn" type="button" role="tab" data-act="narrationApp" data-app="${k}" aria-selected="${k === NARR_APP}" aria-pressed="${k === NARR_APP}">${esc(VOICE_APP_LABELS[k])}</button>`).join("")}</div>
    ${ex ? scriptPanel(NARR_APP, ex) : `<p class="rm-hint">Memuat naskah…</p>`}`;
}

// one app's texts: only what the app should read is in the boxes (a copy button for each); the counts, the settings and the notes are written beside them
function scriptPanel(key, ex) {
  const box = (title, text, rows, attrs, hint) => `<div class="rm-textbox"><div class="rm-boxhead"><b>${title}</b>${attrs ? `<span class="rm-boxbtns">${attrs}</span>` : ""}</div>${hint ? `<p class="rm-hint">${hint}</p>` : ""}<textarea class="ws-input rm-boxed" readonly rows="${rows}">${esc(text || "")}</textarea></div>`;
  const copyBtn = (part, label, primary) => `<button class="btn ${primary ? "main" : "sm"}" type="button" data-act="narrationCopy" data-app="${key}"${part ? ` data-part="${part}"` : ""}>${label}</button>`;
  const downBtn = (part, label) => `<button class="btn sm" type="button" data-act="narrationDown" data-app="${key}"${part ? ` data-part="${part}"` : ""}>${label}</button>`;
  let html = `<p class="rm-hint">${esc(ex.status)}. ${esc(String(ex.info || "").split("\n")[0])}</p>`;
  if (key === "voicestudio") {
    html += `<div class="rm-actions">${copyBtn("", "Salin semua", true)}${downBtn("", "Unduh semua .txt")}</div>`;
    const parts = ex.parts || [];
    html += parts.length > 1
      ? `<p class="rm-hint">Teks panjang bisa dipecah: tiap bagian teks polos dan bisa disalin atau diunduh sendiri (_1.txt, _2.txt, ...).</p>` +
        parts.map((p) => box(`Bagian ${p.no} <span class="rm-hint">sekitar ${Math.round((p.low + p.high) / 2)} detik</span>`, p.text, 4, copyBtn(String(p.no), "Salin") + downBtn(String(p.no), `Unduh _${p.no}.txt`))).join("")
      : "";
    html += box("Naskah (teks polos)", ex.text, 10, "", "VoiceStudio membaca semua karakter: tidak ada judul, jeda, atau tag di dalamnya.");
    return html;
  }
  if (key === "elevenlabs") {
    html += `<div class="rm-actions">${copyBtn("", "Salin naskah", true)}${downBtn("", "Unduh .txt")}</div>`;
    html += box("Naskah (satu permintaan; tag dan jeda dari daftar resmi)", ex.text, 10);
    html += box("Pengaturan di ElevenLabs (bukan teks untuk dibacakan)", `${ex.settings}\n${ex.model}`, 3, `<button class="btn sm" type="button" data-act="narrationCopy" data-app="${key}" data-part="settings">Salin</button>`);
    html += `<p class="rm-hint">Tag memakai kurung siku dari daftar resmi ElevenLabs. Belum diverifikasi: tag pada teks Indonesia, dan dukungan tag di Multilingual v2 dan Flash v2.5. Uji dulu tanpa tag.</p>`;
    return html;
  }
  html += `<div class="rm-actions">${copyBtn("", "Salin naskah", true)}${downBtn("", "Unduh .txt")}</div>`;
  html += box("Naskah dan ekspresi", ex.text, 10);
  html += box("Deskripsi gaya (bahasa Inggris, bukan teks untuk dibacakan)", ex.style, 3, `<button class="btn sm" type="button" data-act="narrationCopy" data-app="${key}" data-part="style">Salin</button>`);
  html += `<details class="rm-adv"><summary>Deskripsi lengkap (versi lama, opsional)</summary>${box("Versi lama", ex.styleLong, 4, `<button class="btn sm" type="button" data-act="narrationCopy" data-app="${key}" data-part="styleLong">Salin</button>`)}</details>`;
  html += `<p class="rm-hint">Tag memakai tanda &lt;...&gt; dan bahasa Inggris, sesuai dokumen Google (diperiksa 28 Okt 2026). Bahasa Indonesia didukung di Gemini 3.8 TTS. Belum diverifikasi: bahasa kolom gaya, dan apakah halaman AI Studio memakai kolom yang sama. Coba dulu tanpa gaya.</p>`;
  return html;
}

// the text to copy or download: a part of VoiceStudio's, a named field (the settings, the style), or the whole text
function narrationText(ex, part) {
  if (!part) return narrationCopyText(ex);
  if (/^\d+$/.test(part)) { const p = (ex.parts || []).find((x) => String(x.no) === part); return p ? p.text : ""; }
  if (part === "settings") return `${ex.settings}\n${ex.model}`;
  return String(ex[part] || "");
}

async function copyNarration(key, part) {
  const ex = narrationShown(NARR, CUR.id, key);
  if (!ex) return toast("Naskah belum dimuat.");
  (await copyText(narrationText(ex, part))) ? toast("Disalin.") : toast("Tidak bisa menyalin: pilih teksnya sendiri.");
}

function saveTextFile(name, text) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: name });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function downloadNarration(key, part) {
  const ex = narrationShown(NARR, CUR.id, key);
  if (!ex) return toast("Naskah belum dimuat.");
  saveTextFile(narrationFile(CUR.id, key, /^\d+$/.test(part || "") ? part : null), narrationText(ex, part));
}

// ---------------------------------------------------------------------------------------------------------------------------------------
// 6 the voice: a recorded narration (or a local text-to-speech command's), matched to the words; the beats then last as long as it
// ---------------------------------------------------------------------------------------------------------------------------------------

function bodyVoice(d) {
  if (!d.story) return `<p class="rm-hint">Ambil ceritanya dulu (langkah 3).</p>`;
  const v = d.voice;
  const job = d.job || {};
  const busy = job.kind === "voice" && ["queued", "running"].includes(job.state);
  const have = v && v.name;
  return `
    <p>Rekam sendiri atau pakai file dari luar (wav, mp3, m4a, ...). Satu file, atau beberapa file dengan nomor di akhir namanya (mis. colokan_1.wav, colokan_2.wav): urutannya dari nomor, bukan dari nama. klipian mencocokkan kata dengan suaranya di komputer ini. Tanpa layanan suara: tidak ada key.</p>
    ${have ? `<div class="rm-note"><b>${esc(v.name)}</b> · ${fmtSeconds(v.duration)} detik · ${v.aligned ? `sudah dicocokkan (${esc(v.method === "whisper" ? "dari suara" : "perkiraan merata")}), video ${fmtSeconds(v.total)} detik` : v.stale ? "cerita berubah sejak dicocokkan: cocokkan lagi" : "belum dicocokkan"}${v.note ? `<br><span class="rm-hint">${esc(v.note)}</span>` : ""}</div>` : ""}
    ${voicePartsHTML(v || {})}
    <div class="rm-actions">
      <textarea class="ws-input rm-boxed rm-path" id="rmVoicePath" rows="2" placeholder="Lokasi file suara, satu per baris, mis. D:\\rekaman\\colokan_1.wav" spellcheck="false"></textarea>
      <label class="rm-hint">Jeda antar bagian (detik) <input class="ws-input rm-boxed" id="rmVoiceGap" type="number" min="0" max="1" step="0.05" value="0.25" style="width:72px"></label>
    </div>
    <div class="rm-actions">
      <button class="btn ${have ? "" : "main"}" type="button" data-act="voicePath">${PART_TO_REPLACE ? `Ganti bagian ${PART_TO_REPLACE}` : "Pakai file ini"}</button>
      <label class="btn" for="rmVoiceFile">Pilih file…</label><input id="rmVoiceFile" type="file" accept="audio/*,video/mp4,video/webm" hidden>
      ${v && v.tts ? `<button class="btn" type="button" data-act="voiceTts" ${busy ? "disabled" : ""}>Buat dengan TTS lokal</button>` : ""}
    </div>
    <div class="rm-actions">
      <button class="btn ${have && !(v && v.aligned) ? "main" : ""}" type="button" data-act="voiceAlign" ${have && !busy ? "" : "disabled"}>${v && v.aligned ? "Cocokkan lagi" : "Cocokkan dengan narasi"}</button>
      ${have ? `<button class="btn danger" type="button" data-act="voiceClear" ${busy ? "disabled" : ""}>Hapus suara</button>` : ""}
      ${v && v.captions ? `<a class="btn sm" href="${API}/subtitles?id=${encodeURIComponent(d.id)}&format=srt" download>Unduh .srt</a><a class="btn sm" href="${API}/subtitles?id=${encodeURIComponent(d.id)}&format=vtt" download>Unduh .vtt</a>` : ""}
      <span class="rm-hint" id="rmVoiceNote">${busy ? esc(job.message || "") : ""}</span>
    </div>
    ${v && v.aligned ? voiceTableHTML(v) : ""}`;
}

document.addEventListener("change", (e) => { if (e.target.id === "rmVoiceFile") uploadVoice(e); });

function voicePartsHTML(v) {
  if (!v.parts || !v.parts.length) return "";
  const notes = (v.notes || []).map((n) => `<p class="rm-hint">${esc(n)}</p>`).join("");
  return `<div class="rm-note"><b>Bagian (${v.parts.length}), urut dari nomornya:</b><ul>${v.parts.map((x) => `<li>${esc(x.name)} · ${fmtSeconds(x.duration)} detik, mulai ${fmtSeconds(x.offset)} detik <button class="btn sm" type="button" data-act="voicePart" data-no="${x.no}">Ganti bagian ini</button></li>`).join("")}</ul>${notes}</div>`;
}

// the match table: one row a beat, the numbers aligned to the right under their headings
function voiceTableHTML(v) {
  const t = v.table;
  if (!t) return "";
  const num = (x) => fmtSeconds(Number(x).toFixed(1));
  const rows = t.beats.map((b) => `<tr data-warn="${b.warn}"><td><code>${esc(b.id)}</code></td><td class="num">${num(b.expected)}</td><td class="num">${num(b.real)}</td><td class="num">${b.delta >= 0 ? "+" : "-"}${num(Math.abs(b.delta))}</td><td>${b.warn ? "periksa" : "sesuai"}</td></tr>`).join("");
  const pct = `${t.percent >= 0 ? "+" : ""}${t.percent.toFixed(0)}%`;
  const policy = t.lengthOk
    ? `Panjang video ${num(t.total)} detik (${pct} dari ${num(t.target)} detik): masih dalam batas 15%.`
    : `Panjang video ${num(t.total)} detik (${pct} dari ${num(t.target)} detik): di luar batas 15%. Pilih salah satu sebelum merender:`;
  const choice = t.lengthOk ? "" : `<div class="rm-actions"><button class="btn" type="button" data-act="voiceLength" data-choice="edit">Ubah teks narasi</button><button class="btn" type="button" data-act="voiceLength" data-choice="continue" ${v.lengthChoice === "continue" ? "disabled" : ""}>${v.lengthChoice === "continue" ? "Dipilih: lanjut" : "Lanjut dengan panjang ini"}</button></div>`;
  const unmatched = (v.unmatched || []).length ? `<div class="rm-note"><b>Kata yang tidak dikenali (periksa naskahnya):</b> ${v.unmatched.map((u) => `<code>${esc(u.w)}</code> (${esc(u.beat)})`).join(", ")}</div>` : "";
  return `<h3 class="rm-sub-h">Pencocokan per beat</h3>
    <table class="rm-table"><thead><tr><th>Beat</th><th class="num">Rencana (dtk)</th><th class="num">Nyata (dtk)</th><th class="num">Selisih</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table>
    <p>${esc(policy)}</p>${choice}${unmatched}`;
}

async function importVoicePath() {
  const lines = byId("rmVoicePath").value.split(/\r?\n/).map((x) => x.trim().replace(/^"|"$/g, "")).filter(Boolean);
  if (!lines.length) return toast("Tulis lokasi file suaranya dulu.");
  if (PART_TO_REPLACE) {
    const no = PART_TO_REPLACE;
    PART_TO_REPLACE = null;
    await call(`${API}/voice-part`, { id: CUR.id, no, path: lines[0] });
  } else if (lines.length > 1) {
    const gap = Number(byId("rmVoiceGap")?.value ?? 0.25);
    await call(`${API}/voice-parts`, { id: CUR.id, paths: lines, gap });
  } else {
    await call(`${API}/voice`, { id: CUR.id, path: lines[0] });
  }
  await refresh();
}
function pickPart(no) {
  PART_TO_REPLACE = Number(no);
  drawSteps();
  byId("rmVoicePath")?.focus();
  toast(`Tulis lokasi file pengganti untuk bagian ${no}, lalu tekan Ganti bagian ${no}.`);
}
async function chooseLength(choice) {
  if (choice === "edit") return toast("Ubah teks narasi di langkah 3, lalu cocokkan lagi.");
  await call(`${API}/voice-length`, { id: CUR.id, choice });
  await refresh();
}
async function uploadVoice(e) {
  const f = e.target.files[0];
  if (!f) return;
  const r = await fetch(`${API}/voice-upload?id=${encodeURIComponent(CUR.id)}&name=${encodeURIComponent(f.name)}`, { method: "POST", body: f });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) return toast(j.error || "Gagal mengunggah suara.");
  await refresh();
}
async function ttsVoice() {
  await call(`${API}/voice-tts`, { id: CUR.id });
  await refresh();
}
async function alignVoice() {
  const j = await call(`${API}/voice-align`, { id: CUR.id });
  CUR.job = j.job;
  drawSteps();
  startPoll();
}
async function clearVoice() {
  const ok = await confirmDialog({ title: "Hapus suara?", message: "Video kembali memakai durasi dari cerita.", confirmText: "Hapus", cancelText: "Batal" });
  if (!ok) return;
  await call(`${API}/voice-clear`, { id: CUR.id });
  await refresh();
}

// ---------------------------------------------------------------------------------------------------------------------------------------
// 7 the preview video
// ---------------------------------------------------------------------------------------------------------------------------------------

function bodyPreview(d) {
  if (!d.story) return `<p class="rm-hint">Ambil ceritanya dulu (langkah 3).</p>`;
  const pv = d.preview, job = d.job || {};
  const busy = job.kind === "preview-video" && ["queued", "running"].includes(job.state);
  return `
    <p>Draf video setengah ukuran, dengan narasi, efek suara, dan musik. Lihat dulu sebelum render final.</p>
    <div class="rm-actions"><button class="btn ${pv ? "" : "main"}" type="button" data-act="previewVideo" ${busy ? "disabled" : ""}>${pv ? "Buat pratinjau lagi" : "Buat pratinjau"}</button><span class="rm-hint" id="rmPreviewVideoNote">${busy ? esc(job.message || "") : ""}</span></div>
    ${pv && !busy ? `<video class="rm-video" controls playsinline src="${pv.url}"></video><p class="rm-hint">${pv.stale ? "Cerita atau suara berubah sejak pratinjau ini: buat lagi." : `Dibuat dalam ${pv.seconds} detik.`}</p>` : ""}`;
}

async function startPreviewVideo() {
  const j = await call(`${API}/preview-video`, { id: CUR.id });
  CUR.job = j.job;
  drawSteps();
  startPoll();
}

// ---------------------------------------------------------------------------------------------------------------------------------------
// 8 render
// ---------------------------------------------------------------------------------------------------------------------------------------

function jobHTML(job, kind) {
  if (!job || job.kind !== kind || job.state === "idle") return "";
  const active = ["queued", "running"].includes(job.state);
  return `<div class="rm-job" data-state="${esc(job.state)}">
      ${active ? `<div class="rm-bar"><i style="width:${job.percent || 0}%"></i></div>` : ""}
      <div class="rm-jobline"><span class="rm-jobmsg">${esc(job.message || "")}</span>${active ? `<span class="rm-eta">${job.percent || 0}% ${esc(fmtEta(job.eta))}</span>` : ""}
        ${active && kind === "render" ? `<button class="btn sm danger" type="button" data-act="cancel">Batal</button>` : ""}</div>
    </div>`;
}

// the render block is the server's (the same facts as the next step): the page only shows it
function bodyRender(d) {
  if (!d.story) return `<p class="rm-hint">Ambil ceritanya dulu (langkah 3).</p>`;
  const job = d.job || {};
  const busy = ["queued", "running"].includes(job.state);
  const rb = d.renderBlock || { state: "belum", can: false, text: "", reasons: [] };
  const r = d.render;
  return `
    <p class="rm-hint">Akan dirender dengan: ${d.kind === "custom" && d.composition ? `video khusus <b>${esc(d.composition)}</b>` : d.kind === "custom" ? "video khusus (folder belum dipilih)" : "template klipian"}. Panjang video: ${esc(lengthText(d.length))}.</p>
    <div class="rm-gate" data-state="${esc(rb.state)}">${rb.reasons.length && !rb.can ? `<b>${esc(rb.text)}</b><ul>${rb.reasons.map((g) => `<li>${esc(g)}</li>`).join("")}</ul>` : esc(rb.text)}</div>
    <div class="rm-actions">
      <button class="btn ${rb.state === "selesai" ? "" : "main"} large" type="button" data-act="render" ${!rb.can || busy ? "disabled" : ""}>${r ? (rb.state === "usang" ? "Render ulang" : "Render lagi") : "Render"}</button>
      <span class="rm-hint">MP4 9:16 1080×1920, 30 fps, dengan sound effect.</span>
    </div>
    ${jobHTML(job, "render")}
    ${r ? `<div class="rm-note">${r.current ? "Hasil terbaru" : "Hasil terakhir"}: <b>${esc(r.file)}</b> (${r.seconds} detik render, ${r.kind === "custom" ? "video khusus" : "template"}). <a class="rm-link" href="/workspace">Buka di Clips</a> untuk jadwal dan unggah.</div>` : ""}`;
}

async function startRender() {
  try {
    const j = await call(`${API}/render`, { id: CUR.id });
    CUR.job = j.job;
    drawSteps();
    startPoll();
  } catch (ex) {
    if (ex.data?.problems) { await refresh(); toast(ex.message); } else throw ex;
  }
}

async function cancelJob() {
  const j = await call(`${API}/cancel`, { id: CUR.id });
  CUR.job = j.job;
  drawSteps();
}

async function deleteVideo() {
  const ok = await confirmDialog({ title: "Hapus video ini?", message: `"${CUR.topic}": cerita, centang fakta dan gambar ikut terhapus. Video yang sudah ada di Clips tetap ada.`, confirmText: "Hapus", cancelText: "Batal" });
  if (!ok) return;
  await call(`${API}/delete`, { id: CUR.id });
  CUR = null;
  history.replaceState(null, "", location.pathname);
  await loadList();
  drawIntro();
}

// ---------------------------------------------------------------------------------------------------------------------------------------
// the job: poll while it runs, tell the person when it ends
// ---------------------------------------------------------------------------------------------------------------------------------------

function stopPoll() { if (POLL) { clearInterval(POLL); POLL = null; } }
function startPoll() {
  stopPoll();
  POLL = setInterval(tick, 1000);
}

async function tick() {
  if (!CUR) return stopPoll();
  const id = CUR.id;
  let j;
  try { j = await call(`${API}/status?id=${encodeURIComponent(id)}`); } catch { return; }
  if (!CUR || CUR.id !== id) return;
  const was = CUR.job || {};
  CUR.job = j.job;
  if (["queued", "running"].includes(j.job.state)) {
    if (j.job.kind === "render") { if (OPEN === "render") drawSteps(); }
    else if (j.job.kind === "voice") { const n = byId("rmVoiceNote"); if (n) n.textContent = `${j.job.message || ""} ${j.job.percent || 0}%`; }
    else if (j.job.kind === "preview-video") { const n = byId("rmPreviewVideoNote"); if (n) n.textContent = `${j.job.message || ""} ${j.job.percent || 0}%`; }
    else { const n = byId("rmPreviewNote"); if (n) n.textContent = `${j.job.message || ""} ${j.job.percent || 0}%`; }
    return;
  }
  stopPoll();
  await refresh();
  if (was.state === j.job.state) return;
  const key = `motion:${id}:${j.job.started}`;
  if (j.job.kind === "render" && j.job.state === "done") {
    notifyDone({ key, title: "Video motion selesai", body: CUR.title || CUR.topic, kind: "success", action: { label: "Buka Clips", onClick: () => { location.href = "/workspace"; } } });
  } else if (j.job.state === "failed") {
    notifyDone({ key, title: j.job.kind === "render" ? "Render gagal" : "Storyboard gagal", body: j.job.message || "", kind: "failure" });
  } else if (j.job.state === "cancelled") {
    notifyDone({ key, title: "Dibatalkan", kind: "failure", quiet: true });
  } else if (j.job.kind === "voice" && j.job.state === "done") {
    notifyDone({ key, title: "Narasi dicocokkan", body: j.job.note || "", kind: "success", quiet: true });
  } else if (j.job.kind === "preview-video" && j.job.state === "done") {
    notifyDone({ key, title: "Pratinjau video siap", body: j.job.message || "", kind: "success", quiet: true });
  } else if (j.job.kind === "preview" && j.job.state === "done") {
    notifyDone({ key, title: "Gambar storyboard siap", kind: "success", quiet: true });
  }
}

loadList();
