/* klipian — the /remotion page, part of ui/js/remotion/page.js (split out, no change of behaviour): steps 4 to 6: facts and title, the voice script, the voice.
   A classic script: the names are shared with the other page-*.js files; page.js loads last and starts the page. */

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
