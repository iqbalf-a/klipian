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
    const j = await call(`${API}/create`, { topic: byId("rmTopic").value, duration: newDuration, notes: byId("rmNotes").value });
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
  drawComp(); drawVoice(); drawStory(); drawFacts(); drawTitles(); drawRender(); drawNeeds();
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

    <section class="ws-panel rm-step" id="stepComp"></section>

    <section class="ws-panel rm-step" id="stepBrief">
      <header><span class="rm-n">1</span><h2>Brief untuk AI</h2></header>
      <p>Satu file mandiri: tugas, struktur ${d.duration} detik, aturan channel dan fakta, katalog benda yang bisa dirender, serta format jawaban. Tempel ke Claude atau ChatGPT dan nyalakan pencarian web.</p>
      <div class="rm-actions">
        <button class="btn main" id="rmCopyBrief" type="button">Salin brief</button>
        <button class="btn" id="rmDownBrief" type="button">Unduh brief</button>
        <span class="rm-err" id="rmBriefErr" role="alert"></span>
      </div>
    </section>

    <section class="ws-panel rm-step" id="stepPaste">
      <header><span class="rm-n">2</span><h2>Jawaban AI</h2></header>
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
  drawComp(); drawVoice(); drawStory(); drawFacts(); drawTitles(); drawRender(); drawNeeds();
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
  const d = CUR;
  const list = d.compositions || [];
  const has = !d.composition || list.some((c) => c.slug === d.composition);
  const sel = !!d.composition;
  byId("stepComp").innerHTML = `
    <header><h2>Komposisi</h2></header>
    <div class="rm-actions">
      <select class="ws-input rm-boxed rm-select" id="rmComp" aria-label="Komposisi">
        <option value="">Template (dari cerita)</option>
        ${list.map((c) => `<option value="${esc(c.slug)}" ${d.composition === c.slug ? "selected" : ""}>${esc(c.title)} · ${esc(c.slug)}</option>`).join("")}
        ${has ? "" : `<option value="${esc(d.composition)}" selected>${esc(d.composition)}</option>`}
      </select>
      <span class="rm-hint">${sel ? "Dirender dengan adegan khusus; teks dan waktu tetap dari cerita yang sudah dicek." : "Template memakai benda dan adegan yang ada di pustaka."}</span>
    </div>
    <p>Video khusus dibuat di sesi Claude Code di folder <code>remotion/</code> (baca <code>DESIGN.md</code> dulu), dari cerita yang sudah dicek:</p>
    <div class="rm-fix"><code id="rmCmd" class="rm-cmd">cd remotion
npm run new-video nama-video "${esc(d.storyPath || "")}"
npm run studio</code>
      <div class="rm-actions"><button class="btn sm" type="button" data-act="copyCmd">Salin perintah</button><span class="rm-hint">Ganti <b>nama-video</b>; lalu pilih komposisinya di sini.</span></div></div>`;
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
  el.innerHTML = needs.length ? `<div class="rm-needs"><b>Benda yang belum ada di pustaka (kata AI):</b><ul>${needs.map((n) => `<li>${esc(n)}</li>`).join("")}</ul><p class="rm-hint">Untuk sementara dipakai benda terdekat. Brief komponen baru menyusul.</p></div>` : "";
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
    <header><span class="rm-n">2b</span><h2>Suara (narasi)</h2></header>
    <p>Rekam sendiri atau pakai file dari luar (wav, mp3, m4a, ...). klipian mencocokkan kata dengan suaranya di komputer ini, lalu setiap beat sepanjang narasinya dan takarir menyala kata demi kata. Tanpa layanan suara: tidak ada key.</p>
    ${have ? `<div class="rm-needs"><b>${esc(v.name)}</b> · ${v.duration} dtk · ${v.aligned ? `sudah dicocokkan (${esc(v.method === "whisper" ? "dari suara" : "perkiraan merata")}), video ${v.total} dtk` : v.stale ? "cerita berubah sejak dicocokkan: cocokkan lagi" : "belum dicocokkan"}${v.note ? `<br><span class="rm-hint">${esc(v.note)}</span>` : ""}</div>` : ""}
    <div class="rm-actions">
      <input class="ws-input rm-boxed rm-path" id="rmVoicePath" type="text" placeholder="Lokasi file suara, mis. D:\rekaman\narasi.wav" spellcheck="false">
      <button class="btn" type="button" data-act="voicePath">Pakai file ini</button>
      <label class="btn" for="rmVoiceFile">Pilih file…</label><input id="rmVoiceFile" type="file" accept="audio/*,video/mp4,video/webm" hidden>
      ${v && v.tts ? `<button class="btn" type="button" data-act="voiceTts" ${busy ? "disabled" : ""}>Buat dengan TTS lokal</button>` : ""}
    </div>
    <div class="rm-actions">
      <button class="btn main" type="button" data-act="voiceAlign" ${have && !busy ? "" : "disabled"}>${v && v.aligned ? "Cocokkan lagi" : "Cocokkan dengan narasi"}</button>
      ${have ? `<button class="btn danger" type="button" data-act="voiceClear" ${busy ? "disabled" : ""}>Hapus suara</button>` : ""}
      <span class="rm-hint" id="rmVoiceNote">${busy ? esc(job.message || "") : ""}</span>
    </div>`;
  byId("rmVoiceFile")?.addEventListener("change", uploadVoice);
}

async function importVoicePath() {
  const path = byId("rmVoicePath").value.trim();
  if (!path) return toast("Tulis lokasi file suaranya dulu.");
  await call(`${API}/voice`, { id: CUR.id, path });
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
    <header><span class="rm-n">3</span><h2>Storyboard</h2></header>
    <p>${d.story.beats.length} beat, ${d.story.duration} detik. Pertanyaan: <b style="color:var(--text)">${esc(d.story.question)}</b></p>
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
    <header><span class="rm-n">4</span><h2>Cek fakta</h2></header>
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
    <header><span class="rm-n">5</span><h2>Judul</h2></header>
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
    <header><span class="rm-n">6</span><h2>Render</h2></header>
    <div class="rm-gate" data-ok="${gate.length === 0}">${gate.length ? `<b>Belum bisa dirender:</b><ul>${gate.map((g) => `<li>${esc(g)}</li>`).join("")}</ul>` : "Siap dirender: semua klaim dicek dan judul dipilih."}</div>
    <div class="rm-actions">
      <button class="btn main large" type="button" data-act="render" ${gate.length || busy ? "disabled" : ""}>${r ? "Render lagi" : "Render"}</button>
      <span class="rm-hint">MP4 9:16 1080×1920, 30 fps, dengan sound effect.</span>
    </div>
    ${jobHTML(job, "render")}
    ${r ? `<div class="rm-needs">Hasil terakhir: <b>${esc(r.file)}</b> (${r.seconds} dtk render). <a href="/workspace" style="color:var(--accent)">Buka di Clips</a> untuk jadwal dan unggah.</div>` : ""}`;
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
  } else if (j.job.kind === "preview" && j.job.state === "done") {
    notifyDone({ key, title: "Gambar storyboard siap", kind: "success", quiet: true });
  }
}

loadList();
