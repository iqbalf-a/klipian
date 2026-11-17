/* klipian — the /remotion page, part of ui/js/remotion/page.js (split out, no change of behaviour): steps 4 to 6: facts and title, the voice script, the voice.
   A classic script: the names are shared with the other page-*.js files; page.js loads last and starts the page. */

// ---------------------------------------------------------------------------------------------------------------------------------------
// 4 facts and the title
// ---------------------------------------------------------------------------------------------------------------------------------------

const rejectedBeats = () => [...new Set((CUR.facts || []).filter((f) => f.status === "rejected").flatMap((f) => f.beats))];

function bodyFacts(d) {
  if (!d.story) return `<p class="rm-hint">Load the story first (step 3).</p>`;
  const facts = d.facts || [];
  const rej = facts.some((f) => f.status === "rejected");
  const pending = facts.filter((f) => f.status !== "checked" && f.status !== "rejected").length;
  return `
    <p>Open every source and make sure the claim is right. The render is allowed once every claim is checked and one title is chosen.</p>
    ${facts.length ? "" : `<p class="rm-hint">This story has no claims.</p>`}
    ${pending ? `<div class="rm-actions"><button class="btn ${rej ? "" : "main"}" type="button" data-act="allRight">All correct</button><span class="rm-hint">Marks the ${pending} waiting claim${pending === 1 ? "" : "s"} as correct, with today's date.</span></div>` : ""}
    <div class="rm-claims">${facts.map((f, i) => `
      <div class="rm-claim" data-s="${esc(f.status)}">
        <div class="rm-text">${i + 1}. ${esc(f.text)}</div>
        <div class="rm-src">${f.sources.map((u) => `<a href="${esc(u)}" target="_blank" rel="noopener noreferrer">${esc(u)}</a>`).join("")}</div>
        <div class="rm-row">Used in: ${f.beats.map((b) => `<span class="rm-tag">${esc(b)}</span>`).join("")}${f.date ? `<span>· ${esc(f.status === "checked" ? "checked" : "rejected")} ${esc(f.date)}</span>` : ""}</div>
        <div class="rm-actions">
          <button class="btn sm" type="button" data-act="claim" data-i="${i}" data-s="checked" aria-pressed="${f.status === "checked"}">Correct</button>
          <button class="btn sm danger" type="button" data-act="claim" data-i="${i}" data-s="rejected" aria-pressed="${f.status === "rejected"}">Reject</button>
          ${f.status !== "pending" ? `<button class="btn sm quiet" type="button" data-act="claim" data-i="${i}" data-s="pending">Undo</button>` : ""}
          ${f.status === "rejected" ? `<input class="ws-input" type="text" data-note="${i}" maxlength="500" placeholder="Why is it rejected? (for the AI)" value="${esc(f.note || "")}">` : ""}
        </div>
      </div>`).join("")}</div>
    <h3 class="rm-sub-h">Title</h3>
    <p>Choose one. It becomes the title in Clips and on YouTube.</p>
    <div class="rm-titles">${d.story.titles.map((t) => `<button class="btn" type="button" data-act="title" data-t="${esc(t)}" aria-pressed="${d.title === t}">${esc(t)}<small>${t.length}</small></button>`).join("")}</div>
    ${rej ? `
    <h3 class="rm-sub-h">Revision for the rejected claims</h3>
    <p>Only the beats that use those claims (${rejectedBeats().map(esc).join(", ")}) are sent to the AI, not the whole video.</p>
    <label class="ws-field">Extra notes (optional)<input class="ws-input rm-boxed" id="rmReviseNote" type="text" maxlength="400"></label>
    <div class="rm-actions"><button class="btn main" data-act="copyRevise" type="button">Copy the revision brief</button><button class="btn" data-act="downRevise" type="button">Download</button></div>
    <textarea class="ws-input rm-boxed rm-paste" id="rmPasteRevise" placeholder="Paste the AI's revision answer (JSON with beats and claims)" spellcheck="false"></textarea>
    <div class="rm-actions"><button class="btn" data-act="pasteRevise" type="button">Check and save the revision</button></div>
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

// "All correct": asks once (the person opened the sources), then every claim that waits is checked with today's date; a rejected claim stays
async function allRight() {
  const ok = await confirmDialog({ title: "All correct?", message: "Did you open the sources?", confirmText: "Yes, all correct", cancelText: "Not yet", tone: "primary" });
  if (!ok) return;
  const j = await call(`${API}/facts`, { id: CUR.id, all: "checked" });
  CUR.facts = j.facts;
  await refresh();
  toast(j.skipped ? `Claims marked correct. ${j.skipped} rejected claim${j.skipped === 1 ? " was" : "s were"} not changed.` : "All claims marked correct.");
}

async function copyRevise(btn) {
  const beats = rejectedBeats().join(",");
  const note = byId("rmReviseNote").value;
  const j = await call(`${API}/brief?id=${encodeURIComponent(CUR.id)}&kind=revise&beats=${encodeURIComponent(beats)}&note=${encodeURIComponent(note)}`);
  (await copyText(j.brief)) ? flashCopied(btn) : toast("Could not copy. Use Download.");
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
  if (!d.story) return `<p class="rm-hint">Load the story first (step 3).</p>`;
  const apps = voiceAppsInOrder(d.options);
  if (!NARR_APP || !apps.includes(NARR_APP)) NARR_APP = apps[0];
  const ex = narrationShown(NARR, d.id, NARR_APP);
  return `
    ${narrationPreview(d)}
    <p>Copy the script into your voice app and make the voice there (klipian calls no voice service). The apps are changed in step 2, Brief.</p>
    <div class="rm-tabs" role="tablist" aria-label="Voice apps">${apps.map((k) => `<button class="btn" type="button" role="tab" data-act="narrationApp" data-app="${k}" aria-selected="${k === NARR_APP}" aria-pressed="${k === NARR_APP}">${esc(VOICE_APP_LABELS[k])}</button>`).join("")}</div>
    ${ex ? scriptPanel(NARR_APP, ex) : `<p class="rm-hint">Loading the script…</p>`}`;
}

// the narration per beat as plain text with its planned seconds, read-only, so it can be read through before going to the voice
function narrationPreview(d) {
  const { rows, total } = narrationRows(d.story);
  const planned = d.duration;
  return `<div class="rm-narr"><div class="rm-boxhead"><b>Narration per beat</b><span class="rm-hint">${rows.length} beats with narration, ${fmtSeconds(total)} s in all${planned != null && Math.abs(total - planned) > 1.5 ? ` (this video is ${planned} s)` : ""}</span></div>
    <ol>${rows.map((r) => `<li><span class="rm-hint">${esc(r.id)} · ${fmtSeconds(r.dur)} s</span> ${esc(r.text)}</li>`).join("")}</ol></div>`;
}

// one app's texts: only what the app should read is in the boxes (a copy button for each); the counts, the settings and the notes are written beside them
function scriptPanel(key, ex) {
  const box = (title, text, rows, attrs, hint) => `<div class="rm-textbox"><div class="rm-boxhead"><b>${title}</b>${attrs ? `<span class="rm-boxbtns">${attrs}</span>` : ""}</div>${hint ? `<p class="rm-hint">${hint}</p>` : ""}<textarea class="ws-input rm-boxed" readonly rows="${rows}">${esc(text || "")}</textarea></div>`;
  const copyBtn = (part, label, primary) => `<button class="btn ${primary ? "main" : "sm"}" type="button" data-act="narrationCopy" data-app="${key}"${part ? ` data-part="${part}"` : ""}>${label}</button>`;
  const downBtn = (part, label) => `<button class="btn sm" type="button" data-act="narrationDown" data-app="${key}"${part ? ` data-part="${part}"` : ""}>${label}</button>`;
  let html = `<p class="rm-hint">${esc(ex.status)}. ${esc(String(ex.info || "").split("\n")[0])}</p>`;
  if (key === "voicestudio") {
    html += `<div class="rm-actions">${copyBtn("", "Copy all", true)}${downBtn("", "Download all .txt")}</div>`;
    const parts = ex.parts || [];
    html += parts.length > 1
      ? `<p class="rm-hint">A long text can be split: each part is plain text and can be copied or downloaded on its own (_1.txt, _2.txt, ...).</p>` +
        parts.map((p) => box(`Part ${p.no} <span class="rm-hint">about ${Math.round((p.low + p.high) / 2)} s</span>`, p.text, 4, copyBtn(String(p.no), "Copy") + downBtn(String(p.no), `Download _${p.no}.txt`))).join("")
      : "";
    html += box("Script (plain text)", ex.text, 10, "", "VoiceStudio reads every character: there is no title, pause or tag in it.");
    return html;
  }
  if (key === "elevenlabs") {
    html += `<div class="rm-actions">${copyBtn("", "Copy the script", true)}${downBtn("", "Download .txt")}</div>`;
    html += box("Script (one request; tags and pauses from the official list)", ex.text, 10);
    html += box("Settings in ElevenLabs (not text to be read aloud)", `${ex.settings}\n${ex.model}`, 3, `<button class="btn sm" type="button" data-act="narrationCopy" data-app="${key}" data-part="settings">Copy</button>`);
    html += `<p class="rm-hint">The tags use square brackets from ElevenLabs' official list. Not verified: tags on Indonesian text, and tag support in Multilingual v2 and Flash v2.5. Test without tags first.</p>`;
    return html;
  }
  html += `<div class="rm-actions">${copyBtn("", "Copy the script", true)}${downBtn("", "Download .txt")}</div>`;
  html += box("Script and expressions", ex.text, 10);
  html += box("Style description (not text to be read aloud)", ex.style, 3, `<button class="btn sm" type="button" data-act="narrationCopy" data-app="${key}" data-part="style">Copy</button>`);
  html += `<details class="rm-adv"><summary>Full description (old version, optional)</summary>${box("Old version", ex.styleLong, 4, `<button class="btn sm" type="button" data-act="narrationCopy" data-app="${key}" data-part="styleLong">Copy</button>`)}</details>`;
  html += `<p class="rm-hint">The tags use &lt;...&gt; and English, as Google's documents say (checked 28 Oct 2026). Indonesian is supported in Gemini 3.8 TTS. Not verified: the language of the style field, and whether the AI Studio page uses the same field. Try without a style first.</p>`;
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
  if (!ex) return toast("The script is not loaded yet.");
  (await copyText(narrationText(ex, part))) ? toast("Copied.") : toast("Could not copy: select the text yourself.");
}

function saveTextFile(name, text) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: name });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function downloadNarration(key, part) {
  const ex = narrationShown(NARR, CUR.id, key);
  if (!ex) return toast("The script is not loaded yet.");
  saveTextFile(narrationFile(CUR.id, key, /^\d+$/.test(part || "") ? part : null), narrationText(ex, part));
}

// ---------------------------------------------------------------------------------------------------------------------------------------
// 6 the voice: a recorded narration (or a local text-to-speech command's), matched to the words; the beats then last as long as it
// ---------------------------------------------------------------------------------------------------------------------------------------

function bodyVoice(d) {
  if (!d.story) return `<p class="rm-hint">Load the story first (step 3).</p>`;
  const v = d.voice;
  const job = d.job || {};
  const busy = job.kind === "voice" && ["queued", "running"].includes(job.state);
  const have = v && v.name;
  return `
    <p>Record it yourself or use a file from outside (wav, mp3, m4a, ...). One file, or several files with a number at the end of the name (e.g. colokan_1.wav, colokan_2.wav): the order comes from the number, not the name. klipian matches the words to the voice on this computer. No voice service: no key.</p>
    ${narrationPreview(d)}
    ${have ? `<audio class="rm-audio" controls preload="metadata" src="${esc(profileUrl(`${API}/voice-file?id=${encodeURIComponent(d.id)}&v=${v.at || 0}`))}"></audio>` : ""}
    ${have ? `<div class="rm-note"><b>${esc(v.name)}</b> · ${fmtSeconds(v.duration)} s · ${v.aligned ? `matched (${esc(v.method === "whisper" ? "from the voice" : "an even estimate")}), video ${fmtSeconds(v.total)} s` : v.stale ? "the story changed since it was matched: match it again" : "not matched yet"}${v.note ? `<br><span class="rm-hint">${esc(v.note)}</span>` : ""}</div>` : ""}
    ${voicePartsHTML(v || {})}
    <div class="rm-actions">
      <textarea class="ws-input rm-boxed rm-path" id="rmVoicePath" rows="2" placeholder="Path of the voice file, one per line, e.g. D:\\rekaman\\colokan_1.wav" spellcheck="false"></textarea>
      <label class="rm-hint">Pause between parts (s) <input class="ws-input rm-boxed" id="rmVoiceGap" type="number" min="0" max="1" step="0.05" value="0.25" style="width:72px"></label>
    </div>
    <div class="rm-actions">
      <button class="btn ${have ? "" : "main"}" type="button" data-act="voicePath">${PART_TO_REPLACE ? `Replace part ${PART_TO_REPLACE}` : "Use this file"}</button>
      <label class="btn" for="rmVoiceFile">Choose file…</label><input id="rmVoiceFile" type="file" accept="audio/*,video/mp4,video/webm" hidden>
      ${v && v.tts ? `<button class="btn" type="button" data-act="voiceTts" ${busy ? "disabled" : ""}>Make it with local TTS</button>` : ""}
    </div>
    <div class="rm-actions">
      <button class="btn ${have && !(v && v.aligned) ? "main" : ""}" type="button" data-act="voiceAlign" ${have && !busy ? "" : "disabled"}>${v && v.aligned ? "Match again" : "Match with the narration"}</button>
      ${have ? `<button class="btn danger" type="button" data-act="voiceClear" ${busy ? "disabled" : ""}>Delete voice</button>` : ""}
      ${v && v.captions ? `<a class="btn sm" href="${esc(profileUrl(`${API}/subtitles?id=${encodeURIComponent(d.id)}&format=srt`))}" download>Download .srt</a><a class="btn sm" href="${esc(profileUrl(`${API}/subtitles?id=${encodeURIComponent(d.id)}&format=vtt`))}" download>Download .vtt</a>` : ""}
      <span class="rm-hint" id="rmVoiceNote">${busy ? esc(job.message || "") : ""}</span>
    </div>
    ${v && v.aligned ? voiceTableHTML(v) : ""}`;
}

document.addEventListener("change", (e) => { if (e.target.id === "rmVoiceFile") uploadVoice(e); });

function voicePartsHTML(v) {
  if (!v.parts || !v.parts.length) return "";
  const notes = (v.notes || []).map((n) => `<p class="rm-hint">${esc(n)}</p>`).join("");
  return `<div class="rm-note"><b>Parts (${v.parts.length}), in the order of their numbers:</b><ul>${v.parts.map((x) => `<li>${esc(x.name)} · ${fmtSeconds(x.duration)} s, starts at ${fmtSeconds(x.offset)} s <button class="btn sm" type="button" data-act="voicePart" data-no="${x.no}">Replace this part</button></li>`).join("")}</ul>${notes}</div>`;
}

// the match table: one row a beat, the numbers aligned to the right under their headings
function voiceTableHTML(v) {
  const t = v.table;
  if (!t) return "";
  const num = (x) => fmtSeconds(Number(x).toFixed(1));
  const rows = t.beats.map((b) => `<tr data-warn="${b.warn}"><td><code>${esc(b.id)}</code></td><td class="num">${num(b.expected)}</td><td class="num">${num(b.real)}</td><td class="num">${b.delta >= 0 ? "+" : "-"}${num(Math.abs(b.delta))}</td><td>${b.warn ? "check" : "ok"}</td></tr>`).join("");
  const pct = `${t.percent >= 0 ? "+" : ""}${t.percent.toFixed(0)}%`;
  const policy = t.lengthOk
    ? `Video length ${num(t.total)} s (${pct} against ${num(t.target)} s): inside the 15% limit.`
    : `Video length ${num(t.total)} s (${pct} against ${num(t.target)} s): outside the 15% limit. Choose one before you render:`;
  const choice = t.lengthOk ? "" : `<div class="rm-actions"><button class="btn" type="button" data-act="voiceLength" data-choice="edit">Edit the narration</button><button class="btn" type="button" data-act="voiceLength" data-choice="continue" ${v.lengthChoice === "continue" ? "disabled" : ""}>${v.lengthChoice === "continue" ? "Chosen: continue" : "Continue with this length"}</button></div>`;
  const unmatched = (v.unmatched || []).length ? `<div class="rm-note"><b>Words not recognised (check the script):</b> ${v.unmatched.map((u) => `<code>${esc(u.w)}</code> (${esc(u.beat)})`).join(", ")}</div>` : "";
  return `<h3 class="rm-sub-h">Match per beat</h3>
    <table class="rm-table"><thead><tr><th>Beat</th><th class="num">Planned (s)</th><th class="num">Real (s)</th><th class="num">Difference</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table>
    <p>${esc(policy)}</p>${choice}${unmatched}`;
}

async function importVoicePath() {
  const lines = byId("rmVoicePath").value.split(/\r?\n/).map((x) => x.trim().replace(/^"|"$/g, "")).filter(Boolean);
  if (!lines.length) return toast("Write the path of the voice file first.");
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
  toast(`Write the path of the replacement file for part ${no}, then press Replace part ${no}.`);
}
async function chooseLength(choice) {
  if (choice === "edit") return toast("Edit the narration in step 3, then match again.");
  await call(`${API}/voice-length`, { id: CUR.id, choice });
  await refresh();
}
async function uploadVoice(e) {
  const f = e.target.files[0];
  if (!f) return;
  const r = await fetch(`${API}/voice-upload?id=${encodeURIComponent(CUR.id)}&name=${encodeURIComponent(f.name)}`, { method: "POST", body: f });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) return toast(j.error || "Could not upload the voice.");
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
  const ok = await confirmDialog({ title: "Delete the voice?", message: "The video goes back to the durations of the story.", confirmText: "Delete", cancelText: "Cancel" });
  if (!ok) return;
  await call(`${API}/voice-clear`, { id: CUR.id });
  await refresh();
}
