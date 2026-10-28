/* klipian — the /remotion page: a fun-fact motion video from a typed topic, with no API key (klipian/motion.py)
   ==========================================================================
   The flow, top to bottom for the chosen video:
     1 Brief         one file to copy into Claude or ChatGPT (with web search)
     2 Jawaban AI    paste the JSON back: repaired when it is a common slip, validated, or a message to paste back to the AI
     3 Storyboard    one picture per beat; narration and screen text can be edited here, then they are validated again
     4 Fakta         every claim and its sources, checked or rejected by a person; a rejected claim makes a revision brief
     5 Judul         one of the three titles
     6 Render        refused by the server until 3 and 5 are done; progress, time left and Cancel; the result is a row in Clips
   Nothing here knows a rule of the story: validation answers come from the server (which asks remotion/validate.mjs).
   ========================================================================== */

const API = "/api/motion";
const STATE_LABEL = { draft: "Baru", story: "Ada cerita", checked: "Fakta dicek", rendered: "Sudah dirender" };
let LIST = [];
let STATUS = { installed: true };
let CUR = null;                 // the chosen video's detail (from /api/motion/project)
let POLL = null;
let newDuration = 45;
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
const fmtDate = (t) => (t ? new Date(t * 1000).toLocaleDateString("id-ID", { day: "numeric", month: "short" }) : "");

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
      <span class="rm-meta"><span class="rm-state" data-s="${esc(p.status)}">${esc(STATE_LABEL[p.status] || p.status)}</span><span>${p.duration} detik</span><span>${fmtDate(p.updated)}</span>${p.hasStory && p.unchecked ? `<span>${p.unchecked} klaim belum dicek</span>` : ""}</span>
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
// one video
// ---------------------------------------------------------------------------------------------------------------------------------------

function drawIntro() {
  byId("rmMain").innerHTML = `
    <section class="ws-panel rm-step">
      <header><h2>Dari topik ke video</h2></header>
      <ol style="padding-left:18px;list-style:decimal;display:flex;flex-direction:column;gap:6px">
        <li>Buat video baru: tulis topik, pilih durasi.</li>
        <li>Salin brief, tempel ke Claude atau ChatGPT (pakai pencarian web), lalu tempel jawabannya (satu JSON) ke sini.</li>
        <li>Lihat storyboard, edit teksnya kalau perlu, dan cek setiap klaim beserta sumbernya.</li>
        <li>Pilih judul, lalu Render. Hasilnya masuk ke Clips, siap diunggah.</li>
      </ol>
      <p>Tanpa API key: klipian bekerja di komputer ini, dan AI-nya lewat salin-tempel.</p>
    </section>`;
}

async function choose(id) {
  location.hash = id;
  stopPoll();
  try {
    CUR = (await call(`${API}/project?id=${encodeURIComponent(id)}`)).project;
  } catch (e) {
    CUR = null;
    byId("rmMain").innerHTML = `<section class="ws-panel"><p class="rm-empty">${esc(e.message)}</p></section>`;
    return;
  }
  drawList();
  buildDetail();
  prefetchBrief();
  if (["queued", "running"].includes(CUR.job?.state)) startPoll();
}

async function refresh(keepPaste = true) {
  CUR = (await call(`${API}/project?id=${encodeURIComponent(CUR.id)}`)).project;
  const i = LIST.findIndex((p) => p.id === CUR.id);
  if (i >= 0) LIST[i] = { ...LIST[i], status: CUR.status, title: CUR.title, claims: CUR.claims, unchecked: CUR.unchecked, hasStory: CUR.hasStory, updated: CUR.updated };
  drawList();
  drawNext(); drawComp(); drawVoice(); drawStory(); drawFacts(); drawTitles(); drawRender(); drawNeeds();
  byId("rmState").textContent = STATE_LABEL[CUR.status] || CUR.status;
  byId("rmState").dataset.s = CUR.status;
}

async function prefetchBrief() {
  const id = CUR?.id;
  try {
    const j = await call(`${API}/brief?id=${encodeURIComponent(id)}&kind=main`);
    briefCache.set(`${id}:main`, j);
  } catch (e) { briefCache.delete(`${id}:main`); }
}

function buildDetail() {
  const d = CUR;
  byId("rmMain").innerHTML = `
    <section class="ws-panel rm-step">
      <div class="rm-title">
        <div style="min-width:0">
          <h1>${esc(d.topic)}</h1>
          <div class="rm-meta"><span class="rm-state" id="rmState" data-s="${esc(d.status)}">${esc(STATE_LABEL[d.status] || d.status)}</span><span>${d.duration} detik</span>${d.notes ? `<span title="${esc(d.notes)}">ada catatan</span>` : ""}</div>
        </div>
        <button class="btn danger ml-auto" id="rmDelete" type="button">Hapus video</button>
      </div>
    </section>

    <section class="ws-panel rm-step" id="stepNext"></section>
    <section class="ws-panel rm-step" id="stepComp"></section>

    <section class="ws-panel rm-step" id="stepBrief">
      <header><span class="rm-n">1</span><h2>Brief untuk Claude Code</h2></header>
      <p>Satu file mandiri: tugas, struktur ${d.duration} detik, aturan channel dan fakta, katalog benda yang bisa dirender, serta format jawaban. Tempel ke Claude Code di komputer ini; ia mencari web sendiri. Tanpa API key.</p>
      <div class="rm-actions">
        <button class="btn main" id="rmCopyBrief" type="button">Salin brief</button>
        <button class="btn" id="rmDownBrief" type="button">Unduh brief</button>
        <button class="btn" type="button" data-act="copyClaudeCmd">Salin perintah untuk Claude Code</button>
        <span class="rm-err" id="rmBriefErr" role="alert"></span>
      </div>
    </section>

    <section class="ws-panel rm-step" id="stepPaste">
      <header><span class="rm-n">2</span><h2>Jawaban dari Claude Code</h2></header>
      <p>Tempel seluruh jawaban (satu blok JSON). Slip umum dibetulkan sendiri; kalau ada yang salah, klipian membuat pesan perbaikan untuk ditempel balik ke AI.</p>
      <textarea class="ws-input rm-boxed rm-paste" id="rmPaste" placeholder='{ "question": "Kenapa ...?", "titles": [...], "beats": [...] }' spellcheck="false"></textarea>
      <div class="rm-actions"><button class="btn main" id="rmPasteBtn" type="button">Periksa dan simpan</button></div>
      <div class="rm-result" id="rmPasteResult"></div>
      <div id="rmNeeds"></div>
    </section>

    <section class="ws-panel rm-step" id="stepVoice" hidden></section>
    <section class="ws-panel rm-step" id="stepStory" hidden></section>
    <section class="ws-panel rm-step" id="stepFacts" hidden></section>
    <section class="ws-panel rm-step" id="stepTitle" hidden></section>
    <section class="ws-panel rm-step" id="stepRender" hidden></section>`;
  drawNext(); drawComp(); drawVoice(); drawStory(); drawFacts(); drawTitles(); drawRender(); drawNeeds();
}

byId("rmMain").addEventListener("click", async (e) => {
  const t = e.target.closest("button");
  if (!t) return;
  const act = t.dataset.act || t.id;
  if (!CUR) return;
  try {
    if (act === "rmCopyBrief") return copyBrief(t);
    if (act === "rmDownBrief") return downloadBrief("main");
    if (act === "rmPasteBtn") return pasteAnswer("main");
    if (act === "rmDelete") return deleteVideo();
    if (act === "preview") return startPreview();
    if (act === "saveEdits") return saveEdits();
    if (act === "claim") return setClaim(Number(t.dataset.i), t.dataset.s);
    if (act === "title") return setTitle(t.dataset.t);
    if (act === "render") return startRender();
    if (act === "cancel") return cancelJob();
    if (act === "copyCmd") return copyCmd(t);
    if (act === "voicePath") return importVoicePath();
    if (act === "voiceAlign") return alignVoice();
    if (act === "voiceClear") return clearVoice();
    if (act === "voiceTts") return ttsVoice();
    if (act === "voicePart") return pickPart(t.dataset.no);
    if (act === "voiceLength") return chooseLength(t.dataset.choice);
    if (act === "previewVideo") return startPreviewVideo();
    if (act === "saveOptions") return saveOptions();
    if (act === "nextStep") return doNext(CUR.next && CUR.next.action);
    if (act === "copyClaudeCmd") return copyClaudeCmd();
    if (act === "narrationLoad") return loadNarration();
    if (act === "narrationOpenAll") return document.querySelectorAll("details.narr-block").forEach((x) => (x.open = true));
    if (act === "narrationDownAll") return downloadNarrationAll();
    if (act === "narrationCopy") return copyNarration(t.dataset.target);
    if (act === "narrationPart") return copyNarrationPart(t.dataset.target, t.dataset.part);
    if (act === "narrationDown") return downloadNarration(t.dataset.target);
    if (act === "copyFix") return copyFix(t);
    if (act === "copyRevise") return copyRevise(t);
    if (act === "downRevise") return downloadBrief("revise");
    if (act === "pasteRevise") return pasteAnswer("revise");
  } catch (ex) { toast(ex.message); }
});

const toast = (text) => (typeof showToast === "function" ? showToast(text, { ms: 6000 }) : alert(text));

// ---------------------------------------------------------------------------------------------------------------------------------------
// the composition: the template, or a video made for this story in a Claude Code session (remotion/videos/<slug>/)
// ---------------------------------------------------------------------------------------------------------------------------------------

function drawComp() {
  const d = CUR, custom = (d.kind || "template") === "custom", list = d.compositions || [];
  byId("stepComp").innerHTML = `
    <header><h2>Jenis video</h2></header>
    <div class="rm-actions">
      <select class="ws-input rm-boxed rm-select" id="rmKind" aria-label="Jenis video">
        <option value="otomatis" ${custom ? "" : "selected"}>Otomatis: template klipian, paling cepat dan sederhana</option>
        <option value="khusus" ${custom ? "selected" : ""}>Khusus: video buatan sesi Claude Code, tampilan terbaik</option>
      </select>
    </div>
    ${custom ? `
      <div class="rm-actions">
        <select class="ws-input rm-boxed rm-select" id="rmComp" aria-label="Folder video khusus">
          <option value="">Belum dipilih</option>
          ${list.map((c) => `<option value="${esc(c.slug)}" ${d.composition === c.slug ? "selected" : ""}>${esc(c.title)} · remotion/videos/${esc(c.slug)}</option>`).join("")}
        </select>
        <span class="rm-hint">${d.composition ? `Folder: <code>${esc(d.composition)}</code>` : "Pilih folder video yang sudah dibuat."}</span>
      </div>
      ${d.composition ? "" : `<div class="rm-fix"><code id="rmCmd" class="rm-cmd">npm run new-video nama-video "${esc(d.storyPath || "")}"</code>
        <div class="rm-actions"><button class="btn sm" type="button" data-act="copyCmd">Salin perintah</button><span class="rm-hint">Jalankan di sesi Claude Code, di folder <code>remotion/</code>. Ganti <b>nama-video</b>, lalu pilih folder di sini.</span></div></div>`}`
      : `<p class="rm-hint">Template memakai benda dan adegan yang ada di pustaka.</p>`}`;
}

document.addEventListener("change", async (e) => {
  if (e.target.id !== "rmKind" || !CUR) return;
  const next = e.target.value === "khusus" ? "Khusus (video buatan sesi Claude Code)" : "Otomatis (template klipian)";
  const ok = await confirmDialog({ title: "Ganti jenis video?", message: `Render berikutnya memakai ${next}. Hasil render yang lama tetap ada di Clips.`, confirmText: "Ganti", cancelText: "Batal" });
  if (!ok) return refresh();
  await call(`${API}/options`, { id: CUR.id, options: { kind: e.target.value } });
  await refresh();
});

// the next step: one sentence and one button, from the server's next_step (the same rules as the tests)
function drawNext() {
  const sec = byId("stepNext");
  const d = CUR;
  sec.hidden = !d;
  if (!d) return;
  const n = d.next || {};
  const chips = (d.stages || []).map((c) => `<span class="rm-chip" data-state="${esc(c.state)}">${esc(c.label)}: ${esc(c.state)}</span>`).join("");
  const label = { brief: "Salin brief", paste: "Tempel jawaban", facts: "Buka cek fakta", title: "Pilih judul", custom: "Salin perintah", align: "Cocokkan", render: "Render", clips: "Buka di Clips" }[n.action];
  const btn = label ? `<button class="btn main" type="button" data-act="nextStep">${label}</button>` : "";
  sec.innerHTML = `
    <div class="rm-next"><b>Langkah berikutnya:</b> ${esc(n.text || "")}</div>
    <div class="rm-actions">${btn}</div>
    ${n.command ? `<div class="rm-fix"><code class="rm-cmd">${esc(n.command)}</code></div>` : ""}
    <div class="rm-chips">${chips}</div>`;
}

async function doNext(action) {
  if (action === "brief") return byId("rmCopyBrief").click();
  if (action === "paste") return byId("rmPaste")?.focus();
  if (action === "facts") return byId("stepFacts").scrollIntoView({ behavior: "smooth" });
  if (action === "title") return byId("stepTitle").scrollIntoView({ behavior: "smooth" });
  if (action === "align") return alignVoice();
  if (action === "render") return startRender();
  if (action === "clips") return (location.href = "/workspace");
  if (action === "custom") return (await copyText(CUR.next.command)) ? toast("Perintah disalin.") : toast("Tidak bisa menyalin.");
}

async function copyClaudeCmd() {
  const text = `Baca file brief yang kamu unduh (${CUR.id}-brief.md) dan kerjakan tugasnya. Periksa jawaban dengan \`node remotion/validate.mjs <jawaban.json>\` sebelum kamu kirim.`;
  (await copyText(text)) ? toast("Perintah untuk Claude Code disalin.") : toast("Tidak bisa menyalin: pilih teksnya sendiri.");
}

byId("rmMain").addEventListener("change", async (e) => {
  if (e.target.id !== "rmComp" || !CUR) return;
  try {
    await call(`${API}/update`, { id: CUR.id, project: { composition: e.target.value } });
    await refresh();
  } catch (ex) { toast(ex.message); await refresh(); }
});

async function copyCmd(btn) {
  const text = byId("rmCmd").textContent;
  (await copyText(text)) ? flashCopied(btn) : toast("Tidak bisa menyalin: pilih teksnya sendiri.");
}

// ---------------------------------------------------------------------------------------------------------------------------------------
// 1 brief
// ---------------------------------------------------------------------------------------------------------------------------------------

async function copyBrief(btn) {
  const cached = briefCache.get(`${CUR.id}:main`);
  if (cached) {                                                   // fetched ahead: the clipboard is written within the click
    const ok = await copyText(cached.brief);
    return ok ? flashCopied(btn) : toast("Tidak bisa menyalin. Pakai Unduh brief.");
  }
  const j = await call(`${API}/brief?id=${encodeURIComponent(CUR.id)}&kind=main`);
  briefCache.set(`${CUR.id}:main`, j);
  (await copyText(j.brief)) ? flashCopied(btn) : toast("Tidak bisa menyalin. Pakai Unduh brief.");
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
}

// ---------------------------------------------------------------------------------------------------------------------------------------
// 2 the answer
// ---------------------------------------------------------------------------------------------------------------------------------------

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
      <div class="rm-fix"><div class="rm-actions"><button class="btn main" type="button" data-act="copyFix">Salin pesan perbaikan</button><span class="rm-hint">Tempel ke AI yang sama, lalu tempel jawaban barunya di sini.</span></div>
      <textarea class="ws-input rm-boxed" readonly>${esc(j.fix)}</textarea></div>`;
    out.querySelector("[data-act=copyFix]")._fix = j.fix;
    return;
  }
  out.dataset.ok = "true";
  const notes = (j.notes || []).map((n) => `<li style="color:var(--text-muted)">Dibetulkan otomatis: ${esc(n)}</li>`).join("");
  out.innerHTML = `<b>Tersimpan.</b> Cerita lolos pemeriksaan.${notes ? `<ul style="color:inherit">${notes}</ul>` : ""}`;
  box.value = "";
  await refresh();
}

async function copyFix(btn) {
  const text = btn._fix || btn.closest(".rm-fix").querySelector("textarea").value;
  (await copyText(text)) ? flashCopied(btn) : toast("Tidak bisa menyalin: pilih teksnya sendiri.");
}

function drawNeeds() {
  const el = byId("rmNeeds");
  const needs = CUR.needs || [];
  const warns = CUR.warnings || [];
  const warnHTML = warns.length ? `<div class="rm-needs"><b>Peringatan buku gaya (belum menghalangi):</b>${errorsHTML(warns)}</div>` : "";
  el.innerHTML = (needs.length ? `<div class="rm-needs"><b>Benda yang belum ada di pustaka (kata AI):</b><ul>${needs.map((n) => `<li>${esc(n)}</li>`).join("")}</ul><p class="rm-hint">Untuk sementara dipakai benda terdekat. Brief komponen baru menyusul.</p></div>` : "") + warnHTML;
}

// ---------------------------------------------------------------------------------------------------------------------------------------
// the voice: a recorded narration (or a local text-to-speech command's), matched to the words; the beats then last as long as it
// ---------------------------------------------------------------------------------------------------------------------------------------

function drawVoice() {
  const sec = byId("stepVoice");
  const d = CUR, v = d.voice;
  sec.hidden = !d.story;
  if (!d.story) return;
  const job = d.job || {};
  const busy = job.kind === "voice" && ["queued", "running"].includes(job.state);
  const have = v && v.name;
  sec.innerHTML = `
    <header><span class="rm-n">3</span><h2>Suara (opsional)</h2></header>
    <p>Rekam sendiri atau pakai file dari luar (wav, mp3, m4a, ...). Satu file, atau beberapa file dengan nomor di akhir namanya (mis. colokan_1.wav, colokan_2.wav): urutannya dari nomor, bukan dari nama. klipian mencocokkan kata dengan suaranya di komputer ini. Tanpa layanan suara: tidak ada key.</p>
    ${have ? `<div class="rm-needs"><b>${esc(v.name)}</b> · ${v.duration} dtk · ${v.aligned ? `sudah dicocokkan (${esc(v.method === "whisper" ? "dari suara" : "perkiraan merata")}), video ${v.total} dtk` : v.stale ? "cerita berubah sejak dicocokkan: cocokkan lagi" : "belum dicocokkan"}${v.note ? `<br><span class="rm-hint">${esc(v.note)}</span>` : ""}</div>` : ""}
    ${voicePartsHTML(v || {})}
    <div class="rm-actions">
      <textarea class="ws-input rm-boxed rm-path" id="rmVoicePath" rows="2" placeholder="Lokasi file suara, satu per baris, mis. D:\\rekaman\\colokan_1.wav" spellcheck="false"></textarea>
      <label class="rm-hint">Jeda antar bagian (detik) <input class="ws-input rm-boxed" id="rmVoiceGap" type="number" min="0" max="1" step="0.05" value="0.25" style="width:72px"></label>
    </div>
    <div class="rm-actions">
      <button class="btn" type="button" data-act="voicePath">${PART_TO_REPLACE ? `Ganti bagian ${PART_TO_REPLACE}` : "Pakai file ini"}</button>
      <label class="btn" for="rmVoiceFile">Pilih file…</label><input id="rmVoiceFile" type="file" accept="audio/*,video/mp4,video/webm" hidden>
      ${v && v.tts ? `<button class="btn" type="button" data-act="voiceTts" ${busy ? "disabled" : ""}>Buat dengan TTS lokal</button>` : ""}
    </div>
    <div class="rm-actions">
      <button class="btn main" type="button" data-act="voiceAlign" ${have && !busy ? "" : "disabled"}>${v && v.aligned ? "Cocokkan lagi" : "Cocokkan dengan narasi"}</button>
      ${have ? `<button class="btn danger" type="button" data-act="voiceClear" ${busy ? "disabled" : ""}>Hapus suara</button>` : ""}
      ${v && v.captions ? `<a class="btn sm" href="${API}/subtitles?id=${encodeURIComponent(d.id)}&format=srt" download>Unduh .srt</a><a class="btn sm" href="${API}/subtitles?id=${encodeURIComponent(d.id)}&format=vtt" download>Unduh .vtt</a>` : ""}
      <span class="rm-hint" id="rmVoiceNote">${busy ? esc(job.message || "") : ""}</span>
    </div>
    ${v && v.aligned ? voiceTableHTML(v) : ""}
    ${narrationHTML(d)}`;
  byId("rmVoiceFile")?.addEventListener("change", uploadVoice);
}

// the narration text for each checked voice app (PLAN-VOICE-TARGETS): one block per app, the one the project opens first first; each block has
// its own copy and download. Google AI Studio's block keeps its three parts: the script, the short style, and the long style (optional).
let NARR = null;                // { forId, exports: { <app>: export } } from the last "Muat naskah"
function narrationHTML(d) {
  const apps = voiceAppsInOrder(d.options);
  const blocks = apps.map((key, i) => narrationBlock(d, key, narrationShown(NARR, d.id, key), i === 0)).join("");
  const loaded = !!(NARR && NARR.forId === d.id);
  return `<div class="rm-needs"><b>Naskah untuk aplikasi suara</b> (ketik atau tempel di aplikasi kamu; klipian tidak memanggil layanan suara)
    <div class="rm-actions"><button class="btn" type="button" data-act="narrationLoad">Muat naskah</button>
      <button class="btn" type="button" data-act="narrationOpenAll">Buka semua</button>
      <button class="btn" type="button" data-act="narrationDownAll" ${loaded ? "" : "disabled"}>Unduh semua</button></div>
    ${blocks}</div>`;
}

function narrationBlock(d, key, ex, open) {
  const head = ex ? `${esc(ex.status)} · ${ex.total.low}–${ex.total.high} dtk` : "belum dimuat";
  const body = ex ? narrationBody(key, ex) : `<p class="rm-hint">Tekan Muat naskah.</p>`;
  return `<details class="rm-needs narr-block" data-app="${key}" ${open ? "open" : ""}><summary><b>${esc(VOICE_APP_LABELS[key])}</b> <span class="rm-hint">${head}</span></summary>
    <div class="rm-actions"><button class="btn sm" type="button" data-act="narrationCopy" data-target="${key}" ${ex ? "" : "disabled"}>Salin semua</button><button class="btn sm" type="button" data-act="narrationDown" data-target="${key}" ${ex ? "" : "disabled"}>Unduh .txt</button></div>
    ${body}</details>`;
}

// the text of one app's export: one box, or for Google AI Studio three blocks with their own copy buttons
function narrationBody(key, shown) {
  if (shown.target !== "googleai") {
    return `<p class="rm-hint">${esc(shown.status)}</p><textarea class="ws-input rm-boxed" readonly rows="10">${esc(shown.text)}</textarea><p class="rm-hint">Baris "Bagian N" adalah penanda untuk kamu: hapus sebelum dibacakan.</p>`;
  }
  const block = (part, title, rows) => `<div class="rm-needs"><b>${title}</b> <button class="btn sm" type="button" data-act="narrationPart" data-target="${key}" data-part="${part}">Salin</button><textarea class="ws-input rm-boxed" readonly rows="${rows}">${esc(shown[part] || "")}</textarea></div>`;
  return `<p class="rm-hint">${esc(shown.status)}</p>
    ${block("script", "1 Naskah + ekspresi", 10)}
    ${block("style", "2 Deskripsi (gaya, bahasa Inggris)", 3)}
    <details class="rm-needs"><summary><b>3 Deskripsi lengkap (versi lama, opsional)</b></summary>${block("styleLong", "Versi lama", 4)}</details>
    <p class="rm-hint">Tag memakai tanda &lt;...&gt; dan bahasa Inggris, sesuai dokumen Google (diperiksa 28 Okt 2026). Bahasa Indonesia didukung di Gemini 3.8 TTS. Belum diverifikasi: bahasa kolom gaya, dan apakah halaman AI Studio memakai kolom yang sama. Coba dulu tanpa gaya.</p>`;
}

// at least one app stays checked: unchecking the last one is undone, with the reason
document.addEventListener("change", (e) => {
  if (!e.target.matches || !e.target.matches("[data-opt-app]")) return;
  const group = e.target.closest("fieldset");
  if (group && !group.querySelector("[data-opt-app]:checked")) {
    e.target.checked = true;
    toast("Pilih minimal satu aplikasi suara.");
  }
});

async function loadNarration() {
  const apps = voiceAppsInOrder(CUR.options);
  const pairs = await Promise.all(apps.map(async (key) => [key, { ...(await call(`${API}/narration?id=${encodeURIComponent(CUR.id)}&target=${key}`)), forId: CUR.id }]));
  NARR = { forId: CUR.id, exports: Object.fromEntries(pairs) };
  drawVoice();
}

async function copyNarration(key) {
  const ex = narrationShown(NARR, CUR.id, key);
  if (!ex) return toast("Muat naskah dulu.");
  (await copyText(ex.text)) ? toast("Naskah disalin.") : toast("Tidak bisa menyalin: pilih teksnya sendiri.");
}

async function copyNarrationPart(key, part) {
  const ex = narrationShown(NARR, CUR.id, key);
  if (!ex || ex[part] == null) return toast("Muat naskah dulu.");
  (await copyText(ex[part])) ? toast("Disalin.") : toast("Tidak bisa menyalin: pilih teksnya sendiri.");
}

function saveNarrationFile(name, text) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: name });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function downloadNarration(key) {
  const ex = narrationShown(NARR, CUR.id, key);
  if (!ex) return toast("Muat naskah dulu.");
  saveNarrationFile(`${CUR.id}-naskah-${key}.txt`, ex.text);
}

// all loaded apps in one file, each under its own heading
function downloadNarrationAll() {
  const apps = voiceAppsInOrder(CUR.options).filter((k) => narrationShown(NARR, CUR.id, k));
  if (!apps.length) return toast("Muat naskah dulu.");
  const text = apps.map((k) => `===== ${VOICE_APP_LABELS[k]} =====\n\n${narrationShown(NARR, CUR.id, k).text}`).join("\n\n");
  saveNarrationFile(`${CUR.id}-naskah-semua.txt`, text);
}

let PART_TO_REPLACE = null;     // the number of the part the next path replaces (set by "Ganti bagian")

function voicePartsHTML(v) {
  if (!v.parts || !v.parts.length) return "";
  const notes = (v.notes || []).map((n) => `<p class="rm-hint">${esc(n)}</p>`).join("");
  return `<div class="rm-needs"><b>Bagian (${v.parts.length}), urut dari nomornya:</b><ul>${v.parts.map((x) => `<li>${esc(x.name)} · ${x.duration} dtk, mulai ${x.offset} dtk <button class="btn sm" type="button" data-act="voicePart" data-no="${x.no}">Ganti bagian ini</button></li>`).join("")}</ul>${notes}</div>`;
}

function voiceTableHTML(v) {
  const t = v.table;
  if (!t) return "";
  const rows = t.beats.map((b) => `<tr data-warn="${b.warn}"><td><code>${esc(b.id)}</code></td><td>${b.expected.toFixed(1)}</td><td>${b.real.toFixed(1)}</td><td>${b.delta >= 0 ? "+" : ""}${b.delta.toFixed(1)}</td><td>${b.warn ? "periksa" : "sesuai"}</td></tr>`).join("");
  const pct = `${t.percent >= 0 ? "+" : ""}${t.percent.toFixed(0)}%`;
  const policy = t.lengthOk
    ? `Panjang video ${t.total.toFixed(1)} dtk (${pct} dari ${t.target} dtk): masih dalam batas 15%.`
    : `Panjang video ${t.total.toFixed(1)} dtk (${pct} dari ${t.target} dtk): di luar batas 15%. Pilih salah satu sebelum merender:`;
  const choice = t.lengthOk ? "" : `<div class="rm-actions"><button class="btn" type="button" data-act="voiceLength" data-choice="edit">Ubah teks narasi</button><button class="btn main" type="button" data-act="voiceLength" data-choice="continue" ${v.lengthChoice === "continue" ? "disabled" : ""}>${v.lengthChoice === "continue" ? "Dipilih: lanjut" : "Lanjut dengan panjang ini"}</button></div>`;
  const unmatched = (v.unmatched || []).length ? `<div class="rm-needs"><b>Kata yang tidak dikenali (periksa naskahnya):</b> ${v.unmatched.map((u) => `<code>${esc(u.w)}</code> (${esc(u.beat)})`).join(", ")}</div>` : "";
  return `<div class="rm-needs"><b>Pencocokan per beat</b><table class="rm-table"><thead><tr><th>beat</th><th>rencana dtk</th><th>nyata dtk</th><th>selisih</th><th></th></tr></thead><tbody>${rows}</tbody></table><p>${esc(policy)}</p>${choice}</div>${unmatched}`;
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
  byId("rmVoicePath").focus();
  toast(`Tulis lokasi file pengganti untuk bagian ${no}, lalu tekan Ganti bagian ${no}.`);
  drawVoice();
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
  drawVoice();
  startPoll();
}
async function startPreviewVideo() {
  const j = await call(`${API}/preview-video`, { id: CUR.id });
  CUR.job = j.job;
  drawRender();
  startPoll();
}
function previewVideoHTML(d) {
  const pv = d.preview, job = d.job || {};
  const busy = job.kind === "preview-video" && ["queued", "running"].includes(job.state);
  return `<div class="rm-needs"><b>Pratinjau video</b> (setengah ukuran, dengan narasi, efek suara, dan musik)
    <div class="rm-actions"><button class="btn" type="button" data-act="previewVideo" ${busy || !d.story ? "disabled" : ""}>${pv ? "Buat pratinjau lagi" : "Buat pratinjau"}</button><span class="rm-hint" id="rmPreviewVideoNote">${busy ? esc(job.message || "") : ""}</span></div>
    ${pv && !busy ? `<video controls playsinline style="width:100%;max-width:360px;border-radius:8px;margin-top:6px" src="${pv.url}"></video><p class="rm-hint">${pv.stale ? "Cerita atau suara berubah sejak pratinjau ini: buat lagi." : `Dibuat dalam ${pv.seconds} dtk.`}</p>` : ""}
  </div>`;
}

async function clearVoice() {
  const ok = await confirmDialog({ title: "Hapus suara?", message: "Video kembali memakai durasi dari cerita.", confirmText: "Hapus", cancelText: "Batal" });
  if (!ok) return;
  await call(`${API}/voice-clear`, { id: CUR.id });
  await refresh();
}

// ---------------------------------------------------------------------------------------------------------------------------------------
// 3 storyboard (pictures, editable text)
// ---------------------------------------------------------------------------------------------------------------------------------------

function textItems(beat) {
  return beat.scene.items.map((it, i) => ({ it, i })).filter(({ it }) => typeof it.text === "string");
}

// the options of a video: the same controls in the creation dialog and in the story step
function readOptions(root) {
  const o = {};
  root.querySelectorAll("[data-opt]").forEach((x) => { o[x.dataset.opt] = x.type === "checkbox" ? x.checked : x.value; });
  const apps = [...root.querySelectorAll("[data-opt-app]:checked")].map((x) => x.dataset.optApp);
  if (!apps.length) throw new Error("Pilih minimal satu aplikasi suara.");
  o.voiceTargets = apps;
  return o;
}
function appBoxesHTML(opts) {
  const checked = (opts && opts.voiceTargets) || VOICE_APP_ORDER;
  const hint = { voicestudio: "jeda dan tag [laughter]/[sigh]", elevenlabs: "tag ekspresi dan jeda", googleai: "tag ekspresi dan deskripsi gaya" };
  return `<fieldset class="rm-opts" role="group" aria-label="Aplikasi suara">
    <legend>Aplikasi suara (centang yang dipakai; naskahnya dibuat untuk tiap aplikasi)</legend>
    ${VOICE_APP_ORDER.map((k) => `<label class="rm-check"><input type="checkbox" data-opt-app="${k}" ${checked.includes(k) ? "checked" : ""}> ${VOICE_APP_LABELS[k]}: ${hint[k]}</label>`).join("")}
  </fieldset>`;
}

function optionsHTML(opts, prefix) {
  const sel = (key, list) => `<select class="ws-input rm-boxed" data-opt="${key}">${list.map(([v, l]) => `<option value="${v}" ${opts[key] === v ? "selected" : ""}>${l}</option>`).join("")}</select>`;
  return `<fieldset class="rm-opts" id="${prefix}">
    <legend>Pilihan video</legend>
    <label class="rm-check"><input type="checkbox" data-opt="loop" ${opts.loop ? "checked" : ""}> Loop (akhir kembali ke adegan awal)</label>
    <label class="rm-check"><input type="checkbox" data-opt="sting" ${opts.sting ? "checked" : ""}> "Intip yuk!" setelah hook</label>
    <label class="ws-field">Musik ${sel("music", [["calm", "Tenang"], ["tech", "Teknologi"], ["none", "Tanpa musik"]])}</label>
    ${appBoxesHTML(opts)}
    <div class="rm-actions"><button class="btn" type="button" data-act="saveOptions">Simpan pilihan</button><span class="rm-hint">Brief berikutnya memakai pilihan ini.</span></div>
  </fieldset>`;
}
async function saveOptions() {
  const box = byId("rmOptsProject");
  const j = await call(`${API}/options`, { id: CUR.id, options: readOptions(box) });
  CUR.options = j.options;
  CUR.optionWarnings = j.warnings;
  drawStory();
  toast("Pilihan disimpan.");
}

function drawStory() {
  const sec = byId("stepStory");
  const d = CUR;
  sec.hidden = !d.story;
  if (!d.story) return;
  const job = d.job || {};
  const busy = job.kind === "preview" && ["queued", "running"].includes(job.state);
  const stills = d.stills || { files: {}, stale: true };
  const have = Object.keys(stills.files).length > 0;
  sec.innerHTML = `
    <header><span class="rm-n">4</span><h2>Storyboard</h2></header>
    <p>${d.story.beats.length} beat, ${d.story.duration} detik. Pertanyaan: <b style="color:var(--text)">${esc(d.story.question)}</b></p>
    ${optionsHTML(d.options || {}, "rmOptsProject")}
    ${(d.optionWarnings || []).map((w) => `<div class="rm-warn">${esc(w)}</div>`).join("")}
    ${(d.warnings || []).length ? `<div class="rm-needs"><b>Saran Buku Gaya (bukan penghalang):</b><ul>${d.warnings.map((w) => `<li>${esc(w.message)}</li>`).join("")}</ul></div>` : ""}
    <div class="rm-actions">
      <button class="btn ${have ? "" : "main"}" data-act="preview" type="button" ${busy ? "disabled" : ""}>${have ? "Perbarui gambar" : "Buat gambar storyboard"}</button>
      <button class="btn main" data-act="saveEdits" type="button">Simpan teks</button>
      <span class="rm-hint" id="rmPreviewNote">${busy ? esc(job.message || "") : have && stills.stale ? "Teks atau cerita berubah sejak gambar dibuat." : ""}</span>
    </div>
    <div class="rm-result" id="rmEditResult"></div>
    <div class="rm-sheet">${d.story.beats.map((b, n) => `
      <article class="rm-beat" data-beat="${esc(b.id)}" data-stale="${stills.stale}">
        <h3>${n + 1} · ${esc(b.kind)} <span>${b.dur} dtk · ${esc(b.id)}</span></h3>
        <div class="rm-pic">${stills.files[b.id] ? `<img alt="Beat ${esc(b.id)}" src="${esc(profileUrl(stills.files[b.id]))}">` : "belum ada gambar"}</div>
        <label>Narasi<textarea class="ws-input" data-f="narration" rows="3">${esc(b.narration)}</textarea></label>
        <label>Teks layar<input class="ws-input" type="text" data-f="text" value="${esc(b.text)}"></label>
        ${textItems(b).map(({ it, i }) => `<label>${esc(it.type)}<input class="ws-input" type="text" data-item="${i}" value="${esc(it.text)}"></label>`).join("")}
      </article>`).join("")}</div>`;
  sec.querySelectorAll("[data-f],[data-item]").forEach((x) => { x.dataset.was = x.value; });
}

async function saveEdits() {
  const out = byId("rmEditResult");
  const beats = {};
  document.querySelectorAll("#stepStory .rm-beat").forEach((card) => {
    const e = {};
    card.querySelectorAll("[data-f]").forEach((x) => { if (x.value !== x.dataset.was) e[x.dataset.f] = x.value; });
    card.querySelectorAll("[data-item]").forEach((x) => { if (x.value !== x.dataset.was) (e.items ||= {})[x.dataset.item] = { text: x.value }; });
    if (Object.keys(e).length) beats[card.dataset.beat] = e;
  });
  if (!Object.keys(beats).length) { out.dataset.ok = ""; out.textContent = "Tidak ada yang berubah."; return; }
  out.dataset.ok = ""; out.textContent = "Memeriksa…";
  try {
    const j = await call(`${API}/update`, { id: CUR.id, edits: { beats } });
    if (j.ok === false) throw Object.assign(new Error(""), { data: j });
    await refresh();
    const o = byId("rmEditResult");
    o.dataset.ok = "true"; o.textContent = "Tersimpan. Perbarui gambar untuk melihat hasilnya.";
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
  drawStory();
  startPoll();
}

// ---------------------------------------------------------------------------------------------------------------------------------------
// 4 facts
// ---------------------------------------------------------------------------------------------------------------------------------------

const rejectedBeats = () => [...new Set((CUR.facts || []).filter((f) => f.status === "rejected").flatMap((f) => f.beats))];

function drawFacts() {
  const sec = byId("stepFacts");
  const d = CUR;
  sec.hidden = !d.story;
  if (!d.story) return;
  const facts = d.facts || [];
  const rej = facts.some((f) => f.status === "rejected");
  sec.innerHTML = `
    <header><span class="rm-n">5</span><h2>Cek fakta</h2></header>
    <p>Buka setiap sumber, pastikan klaimnya benar. Render baru bisa setelah semua klaim dicentang.</p>
    ${facts.length ? "" : `<p class="rm-hint">Cerita ini tidak punya klaim.</p>`}
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
    ${rej ? `
    <div class="rm-fix" id="rmRevise">
      <b style="font-size:13px">Revisi untuk klaim yang ditolak</b>
      <p>Hanya beat yang memakai klaim itu (${rejectedBeats().map(esc).join(", ")}) yang dikirim ke AI, bukan seluruh video.</p>
      <label class="ws-field">Catatan tambahan (opsional)<input class="ws-input rm-boxed" id="rmReviseNote" type="text" maxlength="400"></label>
      <div class="rm-actions"><button class="btn main" data-act="copyRevise" type="button">Salin brief revisi</button><button class="btn" data-act="downRevise" type="button">Unduh</button></div>
      <textarea class="ws-input rm-boxed rm-paste" id="rmPasteRevise" placeholder="Tempel jawaban revisi dari AI (JSON dengan beats dan claims)" spellcheck="false"></textarea>
      <div class="rm-actions"><button class="btn main" data-act="pasteRevise" type="button">Periksa dan simpan revisi</button></div>
      <div class="rm-result" id="rmReviseResult"></div>
    </div>` : ""}`;
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

async function copyRevise(btn) {
  const beats = rejectedBeats().join(",");
  const note = byId("rmReviseNote").value;
  const j = await call(`${API}/brief?id=${encodeURIComponent(CUR.id)}&kind=revise&beats=${encodeURIComponent(beats)}&note=${encodeURIComponent(note)}`);
  (await copyText(j.brief)) ? flashCopied(btn) : toast("Tidak bisa menyalin. Pakai Unduh.");
}

// ---------------------------------------------------------------------------------------------------------------------------------------
// 5 title
// ---------------------------------------------------------------------------------------------------------------------------------------

function drawTitles() {
  const sec = byId("stepTitle");
  const d = CUR;
  sec.hidden = !d.story;
  if (!d.story) return;
  sec.innerHTML = `
    <header><span class="rm-n">6</span><h2>Judul</h2></header>
    <p>Pilih satu. Ini jadi judul di Clips dan di YouTube.</p>
    <div class="rm-titles">${d.story.titles.map((t) => `<button class="btn" type="button" data-act="title" data-t="${esc(t)}" aria-pressed="${d.title === t}">${esc(t)}<small>${t.length}</small></button>`).join("")}</div>`;
}

async function setTitle(t) {
  await call(`${API}/facts`, { id: CUR.id, title: t });
  await refresh();
}

// ---------------------------------------------------------------------------------------------------------------------------------------
// 6 render
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

function drawRender() {
  const sec = byId("stepRender");
  const d = CUR;
  sec.hidden = !d.story;
  if (!d.story) return;
  const job = d.job || {};
  const busy = ["queued", "running"].includes(job.state);
  const gate = d.gate || [];
  const r = d.render;
  sec.innerHTML = `
    <header><span class="rm-n">7</span><h2>Render</h2></header>
    <p class="rm-hint">Akan dirender dengan: ${d.kind === "custom" && d.composition ? `video khusus <b>${esc(d.composition)}</b>` : d.kind === "custom" ? "video khusus (folder belum dipilih)" : "template klipian"}.</p>
    <div class="rm-gate" data-ok="${gate.length === 0}">${gate.length ? `<b>Belum bisa dirender:</b><ul>${gate.map((g) => `<li>${esc(g)}</li>`).join("")}</ul>` : "Siap dirender: semua klaim dicek dan judul dipilih."}</div>
    <div class="rm-actions">
      <button class="btn main large" type="button" data-act="render" ${gate.length || busy ? "disabled" : ""}>${r ? "Render lagi" : "Render"}</button>
      <span class="rm-hint">MP4 9:16 1080×1920, 30 fps, dengan sound effect.</span>
    </div>
    ${previewVideoHTML(d)}
    ${jobHTML(job, "render")}
    ${r ? `<div class="rm-needs">${r.current ? "Hasil terbaru" : `Hasil terakhir, <b>usang</b>: ${esc((r.reasons || []).join(", "))}`}: <b>${esc(r.file)}</b> (${r.seconds} dtk render, ${r.kind === "custom" ? "video khusus" : "template"}). <a href="/workspace" style="color:var(--accent)">Buka di Clips</a> untuk jadwal dan unggah.</div>` : ""}`;
  // the preview's progress sits in the storyboard step
  const note = byId("rmPreviewNote");
  if (note && job.kind === "preview" && busy) note.textContent = `${job.message || ""} ${job.percent || 0}%`;
}

async function startRender() {
  try {
    const j = await call(`${API}/render`, { id: CUR.id });
    CUR.job = j.job;
    drawRender();
    startPoll();
  } catch (ex) {
    if (ex.data?.problems) { await refresh(); toast(ex.message); } else throw ex;
  }
}

async function cancelJob() {
  const j = await call(`${API}/cancel`, { id: CUR.id });
  CUR.job = j.job;
  drawRender();
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
    if (j.job.kind === "render") drawRender();
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
