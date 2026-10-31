/* klipian — the /remotion page, part of ui/js/remotion/page.js (split out, no change of behaviour): one video: the head, the next step bar and the folded steps.
   A classic script: the names are shared with the other page-*.js files; page.js loads last and starts the page. */

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
