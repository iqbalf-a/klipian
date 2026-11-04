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
  miss.innerHTML = STATUS.installed ? "" : `<p><b>Mesin video belum siap.</b> ${esc(STATUS.message)}</p>`;
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

function drawList() {
  const list = byId("rmList");
  byId("rmListHead").textContent = `Topik yang sudah dibuat (${LIST.length})`;
  if (!LIST.length) { list.innerHTML = `<p class="rm-empty">Belum ada video. Tulis topik di atas.</p>`; return; }
  list.innerHTML = LIST.map((p) => `
    <button class="rm-item" type="button" role="listitem" data-id="${esc(p.id)}" aria-current="${CUR?.id === p.id}">
      <b>${esc(p.title || p.topic)}</b>
      <span class="rm-chip" data-state="${esc((p.chip || {}).state || "")}">${esc((p.chip || {}).label || "")}</span>
      <span>${esc(lengthText({ planned: p.seconds ?? p.duration, voiced: p.voiced ? p.seconds : null }))}</span>
      <span>${esc(dateText(p.updated))}</span>
      <span>${p.hasStory && p.unchecked ? `${p.unchecked} klaim belum dicek` : ""}</span>
    </button>`).join("");
}

byId("rmList").addEventListener("click", (e) => {
  const b = e.target.closest(".rm-item");
  if (b) choose(b.dataset.id);
});

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
    byId("rmTopic").value = ""; byId("rmNotes").value = "";
    await loadList(j.project.id);
  } catch (ex) { err.textContent = ex.message; }
});
