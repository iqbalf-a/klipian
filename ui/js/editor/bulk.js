/* klipian — render many Results at once (P23)
   ==========================================================================
   The Clips screen lists every Result of the project with a tick box. "Render selected (N)" saves the project,
   asks the server what it would do (/api/render/plan: the clips, the ones it cannot render and why, an
   estimate), shows that in a dialog, optionally runs AI Framing on the Results that have none, and then sends
   {project, results} -- the server builds every request from the saved Results (klipian/renderreq.py) and runs
   them one after another (renderSavedResults, player.js). The queue is the History screen.

   "Select all from this brief" ticks the Results made from the same Claude import: each suggestion carries an
   `importId` (roundtrip.js) and a Result made only from suggestions keeps the importId of the first one
   (result.js). Older Results have none: then it ticks every Result that is made only of AI suggestions.
   ========================================================================== */

const BULK_TICKED = new Set();            // ids of the ticked Results

const bulkFmtTime = (sec) => {
  const s = Math.max(0, Math.round(sec));
  return s >= 3600 ? `${Math.floor(s / 3600)} h ${Math.round((s % 3600) / 60)} min`
    : s >= 60 ? `${Math.floor(s / 60)} min ${s % 60} s` : `${s} s`;
};

/* What the list shows for each Result. The open one is read from the live state (its latest edits are not in
   SAVED_RESULTS until the next save); the others from what is saved. */
function bulkRows() {
  const picture = (output) => ["9:16", "16:9", "3:4"][Array.isArray(output) && Number.isInteger(output[0]) ? output[0] : 0] || "9:16";
  return (typeof SAVED_RESULTS !== "undefined" ? SAVED_RESULTS : []).map((r, i) => {
    const live = r.id === activeResultId;
    const segs = live ? RESULT.map((x) => ({ start: x.start, end: x.end, title: x.title, source: x.source }))
      : (Array.isArray(r.segments) ? r.segments : Array.isArray(r.result) ? r.result : []);
    const typed = live ? ($("#resultTitle")?.value.trim() || "") : (r.title || "");
    return {
      id: r.id, live, moments: segs.length,
      title: typed || segs[0]?.title || `Result ${i + 1}`,
      duration: segs.reduce((t, x) => t + (x.end - x.start), 0),
      picture: live ? (typeof optionOut === "function" ? optionOut("picture") : "9:16") : picture(r.output),
      importId: r.importId || "",
      allAi: segs.length > 0 && segs.every((x) => x.source === "ai"),
      framed: (r.framing || []).some((p) => !p.auto),
    };
  });
}

function renderAllResults() {
  const list = $("#allResList");
  if (!list) return;
  const rows = bulkRows();
  for (const id of [...BULK_TICKED]) if (!rows.some((r) => r.id === id && r.moments)) BULK_TICKED.delete(id);
  $("#allResNote").textContent = rows.length === 1 ? "1 Result" : `${rows.length} Results`;
  list.innerHTML = rows.map((r, i) => `
    <div class="allres-row${r.live ? " active" : ""}" data-id="${escapeHTML(r.id)}">
      <input type="checkbox" data-bulk-tick aria-label="Render ${escapeHTML(r.title)}"${BULK_TICKED.has(r.id) ? " checked" : ""}${r.moments ? "" : " disabled"}>
      <span class="num">${i + 1}</span>
      <button class="allres-name" type="button" data-bulk-open title="Open this Result">${escapeHTML(r.title)}</button>
      <span class="data">${r.moments ? `${Math.round(r.duration)}s · ${r.moments} moment${r.moments === 1 ? "" : "s"}` : "no moments yet"}</span>
      <span class="data">${escapeHTML(r.picture)}</span>
      ${r.importId ? '<span class="allres-tag" title="Made from an AI import">AI</span>' : ""}
    </div>`).join("");
  const n = BULK_TICKED.size;
  const btn = $("#bulkRenderBtn");
  if (btn) { btn.textContent = n ? `Render selected (${n})` : "Render selected"; btn.disabled = !n || renderJobId !== null; }
  const brief = $("#bulkSelectBrief");
  if (brief) brief.disabled = !rows.some((r) => r.moments);
}

$("#allResList")?.addEventListener("change", (e) => {
  const tick = e.target.closest("[data-bulk-tick]");
  if (!tick) return;
  const id = tick.closest("[data-id]").dataset.id;
  if (tick.checked) BULK_TICKED.add(id); else BULK_TICKED.delete(id);
  renderAllResults();
});

$("#allResList")?.addEventListener("click", (e) => {
  const open = e.target.closest("[data-bulk-open]");
  if (open && typeof switchResult === "function") switchResult(open.closest("[data-id]").dataset.id);
});

$("#bulkSelectAll")?.addEventListener("click", () => {
  for (const r of bulkRows()) if (r.moments) BULK_TICKED.add(r.id);
  renderAllResults();
});

$("#bulkSelectNone")?.addEventListener("click", () => { BULK_TICKED.clear(); renderAllResults(); });

/* The Results of one brief: the import of the open Result, else the latest import; Results that have no import
   id (older ones) count as of a brief when they are made only of AI suggestions. */
$("#bulkSelectBrief")?.addEventListener("click", () => {
  const rows = bulkRows().filter((r) => r.moments);
  const ids = (typeof allCandidates === "function" ? allCandidates() : []).map((k) => k.importId).filter(Boolean).sort();
  const own = rows.find((r) => r.live)?.importId;
  const wanted = own || ids[ids.length - 1] || "";
  let picked = wanted ? rows.filter((r) => r.importId === wanted) : [];
  if (!picked.length) picked = rows.filter((r) => !r.importId && r.allAi);
  BULK_TICKED.clear();
  picked.forEach((r) => BULK_TICKED.add(r.id));
  renderAllResults();
  $("#allResNote").textContent = picked.length
    ? `${picked.length} Result${picked.length === 1 ? "" : "s"} from this brief ticked`
    : "no Result from a brief yet";
});

/* AI Framing for the Results that have no framing of their own, one after another, on the Framing screen. A
   setup problem (the optional packages are missing) stops it for the rest, which are rendered with the default
   framing. Returns a sentence for the status line. */
async function bulkAiFraming(ids) {
  const rows = bulkRows().filter((r) => ids.includes(r.id) && !r.framed);
  if (!rows.length) return "";
  const original = activeResultId;
  toScreen("framing");
  let done = 0, notes = [], setup = false;
  for (const r of rows) {
    renderStatus(`AI Framing ${done + 1} of ${rows.length}: ${r.title}…`);
    const res = await aiFramingForResult(r.id);
    if (res.ok) done++;
    else notes.push(`${r.title}: ${res.note}`);
    if (res.setup) { setup = true; break; }
  }
  if (typeof writeProjectNow === "function") await writeProjectNow();
  if (original !== activeResultId && typeof switchResult === "function") switchResult(original);
  if (setup) return "AI Framing is not available here (run `pip install -r requirements-ai-framing.txt`): "
    + (done ? `it ran on ${done}, the rest were` : "the clips were") + " rendered with the default framing";
  return `AI Framing ran on ${done} of ${rows.length}` + (notes.length ? ` (${notes[0]})` : "");
}

/* The body of the plan dialog: what will be rendered, what cannot be, the estimate, and the AI Framing choice. */
function bulkPlanBody(plan, eligible) {
  const box = document.createElement("div");
  box.className = "bulk-plan";
  const add = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; e.textContent = text; box.append(e); return e; };
  add("p", "bulk-plan-sum", `${plan.items.length} clip${plan.items.length === 1 ? "" : "s"} · ${bulkFmtTime(plan.totalDuration)} of video · `
    + `about ${bulkFmtTime(plan.estimateSeconds)} to render (${plan.estimateHow})`);
  const ul = document.createElement("ul");
  ul.className = "bulk-plan-list";
  for (const it of plan.items) {
    const li = document.createElement("li");
    li.textContent = `${it.title} — ${Math.round(it.duration)}s · ${it.layout}`;
    ul.append(li);
  }
  box.append(ul);
  if (plan.refused.length) {
    add("p", "bulk-plan-bad", `${plan.refused.length} cannot be rendered and will be left out:`);
    const bad = document.createElement("ul");
    bad.className = "bulk-plan-list bad";
    for (const r of plan.refused) {
      const li = document.createElement("li");
      li.textContent = `${r.title} — ${r.message}`;
      bad.append(li);
    }
    box.append(bad);
  }
  const label = document.createElement("label");
  label.className = "bulk-plan-ai";
  const check = document.createElement("input");
  check.type = "checkbox";
  check.id = "bulkPlanAi";
  label.append(check, document.createTextNode(" Run AI Framing first for clips without framing"));
  const sub = document.createElement("span");
  sub.className = "bulk-plan-sub";
  sub.textContent = eligible
    ? `${eligible} of these clip${eligible === 1 ? " has" : "s have"} no framing yet: AI Framing finds who is speaking and frames them (slower; off by default).`
    : "Every clip here already has its framing.";
  label.append(document.createElement("br"), sub);
  check.disabled = !eligible;
  box.append(label);
  return box;
}

let bulkBusy = false;

$("#bulkRenderBtn")?.addEventListener("click", async () => {
  if (bulkBusy || renderJobId !== null) return;
  const rows = bulkRows();
  const ids = rows.filter((r) => BULK_TICKED.has(r.id)).map((r) => r.id);
  if (!ids.length) return;
  bulkBusy = true;
  const btn = $("#bulkRenderBtn");
  const label = btn.textContent;
  btn.disabled = true;
  btn.textContent = "Checking…";
  try {
    // The server looks at the SAVED project, so what is on screen is saved first
    const saved = (typeof writeProjectNow === "function") ? await writeProjectNow() : true;
    if (!saved || !activeProjectId) { $("#editNote").textContent = "The project could not be saved: nothing was rendered."; return; }
    let plan;
    try {
      plan = await (await fetch("/api/render/plan", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project: activeProjectId, results: ids }),
      })).json();
    } catch { $("#editNote").textContent = "Rendering needs the backend. Run: python -m klipian serve"; return; }
    if (plan.error) { $("#editNote").textContent = plan.error; return; }
    if (!plan.items.length) {
      await confirmDialog({
        title: "Nothing can be rendered", confirmText: "OK", cancelText: "Close", tone: "primary",
        message: plan.refused.map((r) => `${r.title}: ${r.message}`).join("\n"),
      });
      return;
    }
    const eligible = rows.filter((r) => plan.items.some((i) => i.result === r.id) && !r.framed).length;
    const body = bulkPlanBody(plan, eligible);
    const go = await confirmDialog({
      title: `Render ${plan.items.length} clip${plan.items.length === 1 ? "" : "s"}?`, body, tone: "primary",
      confirmText: `Render ${plan.items.length}`,
    });
    if (!go) return;
    const withAi = !!body.querySelector("#bulkPlanAi")?.checked;
    const okIds = plan.items.map((i) => i.result);
    const aiNote = withAi ? await bulkAiFraming(okIds) : "";
    await renderSavedResults(okIds, { note: aiNote });
  } finally {
    bulkBusy = false;
    btn.textContent = label;
    renderAllResults();
  }
});

renderAllResults();
