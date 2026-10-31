/* klipian — the /remotion page, part of ui/js/remotion/page.js (split out, no change of behaviour): steps 1 to 3: the new video, the brief, the story and the storyboard.
   A classic script: the names are shared with the other page-*.js files; page.js loads last and starts the page. */

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
