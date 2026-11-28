/* klipian — the /remotion page, part of ui/js/remotion/page.js (split out, no change of behaviour): the list of videos and the new-video form.
   A classic script: the names are shared with the other page-*.js files; page.js loads last and starts the page. */

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
  miss.innerHTML = STATUS.installed ? "" : `<p><b>The video engine is not ready.</b> ${esc(STATUS.message)}</p>`;
  drawList();
  const want = selectId || (location.hash || "").slice(1) || CUR?.id;
  if (want && LIST.some((p) => p.id === want)) await choose(want);
  else if (!CUR) showHome();
}

// Home (no video chosen): the new-topic form and the table. A chosen video replaces it (choose() in page-detail.js).
let WANT = "";                  // the id choose() is opening: the hashchange it causes must not open it again
function showHome() {
  WANT = "";
  stopPoll();
  CUR = null;
  byId("rmMain").innerHTML = "";
  byId("rmMain").hidden = true;
  byId("rmHome").hidden = false;
  drawList();
}
window.addEventListener("hashchange", () => {
  const id = location.hash.slice(1);
  if (!id) { if (CUR) showHome(); }
  else if (id !== WANT && LIST.some((p) => p.id === id)) choose(id);
});

// the search, filters and order: kept while the page is open and in localStorage (the page is right without it)
const TOPIC_KEY = "klipian:motion-list";
const TOPIC_UI = { ...TOPIC_DEFAULT };
try { Object.assign(TOPIC_UI, JSON.parse(localStorage.getItem(TOPIC_KEY) || "{}")); } catch { /* none saved */ }
const ID_PAGER = { of: "of", rows: "Rows", rowsAria: "Rows per page", prev: "Previous", next: "Next" };
const topicPager = createPager({ key: "motion-topics", mount: byId("rmPager"), onChange: () => drawList(), labels: ID_PAGER });
let topicSig = "";                // the search, filters and order: a change of them goes back to page 1
const saveTopicUI = () => { try { localStorage.setItem(TOPIC_KEY, JSON.stringify(TOPIC_UI)); } catch { /* no storage */ } };

// the bar is built once (so typing keeps its focus while the list is redrawn by the poll); drawList only updates its states
function buildListBar() {
  const bar = byId("rmListBar");
  if (bar.dataset.built) return;
  bar.dataset.built = "1";
  const seg = (name, items) => `<div class="rm-fbar" role="group" aria-label="${name}">${items.map(([v, t]) => `<button class="btn sm" type="button" data-f="${name === "Status" ? "status" : "dur"}" data-v="${v}" aria-pressed="false">${esc(t)}</button>`).join("")}</div>`;
  bar.innerHTML = `
    <div class="rm-fbar">
      <input class="ws-input rm-boxed rm-fq" id="rmLQ" type="search" placeholder="Search topic, title, id or folder" aria-label="Search topics" autocomplete="off">
      <button class="btn sm" type="button" id="rmLClear" aria-label="Clear the search">Clear</button>
      <select class="ws-input rm-boxed" id="rmLSort" aria-label="Sort topics">${Object.entries(TOPIC_SORTS).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join("")}</select>
    </div>
    <div class="rm-fbar">
      ${seg("Status", Object.entries(TOPIC_STATUSES))}
      <button class="btn sm" type="button" data-f="need" aria-pressed="false">Needs action</button>
    </div>
    <details class="rm-adv rm-morefilters"><summary>More filters (duration, music)</summary>
      <div class="rm-fbar">${seg("Duration", [[30, "30 s"], [40, "40 s"], [45, "45 s"], [60, "60 s"]])}
      <select class="ws-input rm-boxed" id="rmLMusic" aria-label="Filter by music"></select></div>
    </details>
    <div class="rm-fbar"><span class="rm-hint" id="rmLCount" aria-live="polite"></span><button class="btn sm" type="button" id="rmLReset">Clear filters</button></div>`;
  bar.addEventListener("input", (e) => { if (e.target.id === "rmLQ") { TOPIC_UI.q = e.target.value; saveTopicUI(); drawList(); } });
  bar.addEventListener("change", (e) => {
    if (e.target.id === "rmLSort") TOPIC_UI.sort = e.target.value;
    else if (e.target.id === "rmLMusic") TOPIC_UI.music = e.target.value;
    else return;
    saveTopicUI(); drawList();
  });
  bar.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    if (b.id === "rmLClear") TOPIC_UI.q = "";
    else if (b.id === "rmLReset") Object.assign(TOPIC_UI, { ...TOPIC_DEFAULT, sort: TOPIC_UI.sort });
    else if (b.dataset.f === "status") TOPIC_UI.status = b.dataset.v;
    else if (b.dataset.f === "need") TOPIC_UI.need = !TOPIC_UI.need;
    else if (b.dataset.f === "dur") TOPIC_UI.dur = TOPIC_UI.dur === Number(b.dataset.v) ? 0 : Number(b.dataset.v);
    else return;
    saveTopicUI(); drawList();
  });
}

function syncListBar(shown) {
  const bar = byId("rmListBar");
  bar.hidden = !LIST.length;
  if (!LIST.length) return;
  const q = byId("rmLQ");
  if (q.value !== TOPIC_UI.q) q.value = TOPIC_UI.q;
  byId("rmLSort").value = TOPIC_UI.sort;
  const musics = [...new Set(LIST.map((p) => p.music).filter(Boolean))].sort();
  if (TOPIC_UI.music && !musics.includes(TOPIC_UI.music)) musics.push(TOPIC_UI.music);
  const sel = byId("rmLMusic");
  sel.innerHTML = `<option value="">All music</option>${musics.map((m) => `<option value="${esc(m)}">Music: ${esc(m)}</option>`).join("")}`;
  sel.value = TOPIC_UI.music;
  bar.querySelectorAll("button[data-f]").forEach((b) => {
    const on = b.dataset.f === "status" ? TOPIC_UI.status === b.dataset.v : b.dataset.f === "need" ? TOPIC_UI.need : TOPIC_UI.dur === Number(b.dataset.v);
    b.setAttribute("aria-pressed", String(on));
  });
  byId("rmLClear").hidden = !TOPIC_UI.q;
  byId("rmLReset").hidden = !topicFiltered(TOPIC_UI);
  byId("rmLCount").textContent = `${shown} of ${LIST.length} topics`;
}

function drawList() {
  const list = byId("rmList");
  buildListBar();
  const rows = filterTopics(LIST, TOPIC_UI);
  syncListBar(rows.length);
  const sig = JSON.stringify([TOPIC_UI.q, TOPIC_UI.status, TOPIC_UI.need, TOPIC_UI.dur, TOPIC_UI.music, TOPIC_UI.sort]);
  if (sig !== topicSig) { topicSig = sig; topicPager.first(); }
  const visible = topicPager.slice(rows);
  if (!LIST.length && byId("rmNew").hidden) showNewForm(true);
  if (!LIST.length) { list.innerHTML = `<p class="rm-empty">No video yet. Press "+ New video" to start.</p>`; return; }
  if (!rows.length) { list.innerHTML = `<p class="rm-empty">No topic matches. <button class="btn sm" type="button" data-act="topicReset">Clear filters</button></p>`; return; }
  const titleCount = {};
  for (const p of LIST) { const k = (p.title || p.topic || "").trim().toLowerCase(); titleCount[k] = (titleCount[k] || 0) + 1; }
  list.innerHTML = visible.map((p) => {
    const dup = titleCount[(p.title || p.topic || "").trim().toLowerCase()] > 1;
    const done = (p.chip || {}).key === "done";
    return `
    <div class="rm-item" role="listitem" tabindex="0" data-id="${esc(p.id)}" aria-current="${CUR?.id === p.id}">
      <b>${esc(p.title || p.topic)}${dup ? ` <small class="rm-dup" title="Another topic has the same title">same title · #${esc(String(p.id).slice(-4))}</small>` : ""}</b>
      <span class="rm-chip" data-state="${esc((p.chip || {}).state || "")}">${esc((p.chip || {}).label || "")}</span>
      <span>${esc(lengthText({ planned: p.seconds ?? p.duration, voiced: p.voiced ? p.seconds : null }))}</span>
      <span>${esc(dateText(p.updated))}</span>
      <span>${p.hasStory && p.unchecked ? `${p.unchecked} fact${p.unchecked === 1 ? "" : "s"} to check` : ""}</span>
      <span class="rm-item-act">
        ${done ? `<a class="btn sm" href="/library">Library</a>` : `<button class="btn sm main" type="button" data-id="${esc(p.id)}">Continue</button>`}
        <a class="btn sm quiet" href="${profileUrl(`/remotion?id=${encodeURIComponent(p.id)}`)}" target="_blank" rel="noopener" title="Open this video in Remotion Studio, in a new tab">Studio ↗</a>
      </span>
    </div>`;
  }).join("");
}

byId("rmList").addEventListener("click", (e) => {
  if (e.target.closest("[data-act=topicReset]")) { Object.assign(TOPIC_UI, { ...TOPIC_DEFAULT, sort: TOPIC_UI.sort }); saveTopicUI(); return drawList(); }
  if (e.target.closest("a")) return;                      // Library / Studio links go where they point
  const b = e.target.closest(".rm-item");
  if (b) choose(b.dataset.id);
});
byId("rmList").addEventListener("keydown", (e) => {
  const b = e.key === "Enter" && e.target.classList.contains("rm-item") ? e.target : null;
  if (b) choose(b.dataset.id);
});

// "+ New video" opens the form above the list; it opens by itself when there is no video yet
function showNewForm(on) {
  byId("rmNew").hidden = !on;
  byId("rmNewBtn").setAttribute("aria-expanded", String(on));
  if (on) byId("rmTopic").focus();
}
byId("rmNewBtn").addEventListener("click", () => showNewForm(byId("rmNew").hidden));
byId("rmNewCancel").addEventListener("click", () => showNewForm(false));

byId("rmDur").addEventListener("click", (e) => {
  const b = e.target.closest("button[data-d]");
  if (!b) return;
  newDuration = Number(b.dataset.d);
  byId("rmDurCustom").value = "";
  byId("rmDur").querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
});
// a typed length replaces the quick choices (the server checks 15 to 180 s)
byId("rmDurCustom").addEventListener("input", (e) => {
  const n = Math.round(Number(e.target.value));
  if (!n) return;
  newDuration = n;
  byId("rmDur").querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(Number(x.dataset.d) === n)));
});
byId("rmNew").addEventListener("submit", async (e) => {
  e.preventDefault();
  const err = byId("rmNewErr");
  err.textContent = "";
  try {
    const j = await call(`${API}/create`, { topic: byId("rmTopic").value, duration: newDuration, notes: byId("rmNotes").value, options: readOptions(byId("rmOptsNew")) });
    byId("rmTopic").value = ""; byId("rmNotes").value = "";
    await loadList(j.project.id);
  } catch (ex) { err.textContent = ex.message; }
});
