/* klipian: Autopilot (/autopilot). Links -> Check -> Start; the run list follows the server (polled while a run is going). */
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
let STATE = null;
let CHECKED = "";                       // the links text the last green Check was for
let timer = null;

async function call(path, body) {
  const r = await fetch(path, body === undefined ? {} : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new Error(j.error || `failed (${r.status})`);
  return j;
}
const links = () => $("#apUrls").value.split(/\s+/).map((s) => s.trim()).filter(Boolean);
const say = (t) => { $("#apMsg").textContent = t || ""; };

function drawSettings() {
  const s = STATE.settings;
  $("#apAi").value = s.ai;
  const model = $("#apModel");
  model.hidden = s.ai !== "gemini";
  model.innerHTML = STATE.ai.geminiModel ? `Model: ${esc(STATE.ai.geminiModel)} (<a href="/admin">set in Admin</a>)` : `<a href="/admin">No model chosen in Admin</a>`;
  $("#apTpl").innerHTML = STATE.templates.map((t) => `<option value="${esc(t.id)}"${t.id === s.template ? " selected" : ""}>${esc(t.name)}</option>`).join("");
  $("#apTplNote").textContent = (STATE.templates.find((t) => t.id === s.template) || {}).summary || "";
}

function whenText(r) {
  return r.date ? `${r.date} ${r.time}` : "";
}

const AI_NAMES = { manual: "Manual (copy/paste)", claude: "Claude API", gemini: "Gemini API" };
const STALE_MIN = 10;                    // a running step with no sign of life for this long says so (it is not cancelled)
const FILTERS = [["all", "All"], ["active", "Active"], ["done", "Done"], ["stopped", "Stopped"]];
let FILTER = "all";
const OPEN = new Set();                  // finished runs whose Details are open: kept here so the 2 s redraw does not close them
let pager = null;

/* active: going or waiting for the person; stopped: cancelled, failed, or "running" with nobody working on it. */
const kindOf = (r) => (r.stalled || r.state === "failed" || r.state === "cancelled" ? "stopped" : r.state === "done" ? "done" : "active");
const isOpenNow = (r) => r.stalled || ["queued", "running", "waiting"].includes(r.state);
const staleMin = (r) => (r.state === "running" && !r.stalled && r.updatedAt ? Math.floor((Date.now() / 1000 - r.updatedAt) / 60) : 0);
const shortText = (s, n) => { s = String(s || "").replace(/\s+/g, " ").trim(); return s.length > n ? s.slice(0, n - 1) + "…" : s; };
const dayText = (d) => { const x = new Date(`${d}T00:00:00`); return Number.isNaN(x.getTime()) ? d : x.toLocaleDateString("en-GB", { day: "numeric", month: "short" }); };

/* The stopped step of an older run (no stoppedAt) is the step it was on. */
const stoppedStep = (r) => r.stoppedAt || (["failed", "cancelled"].includes(r.state) || r.stalled ? r.step : "");

/* One row of a run's step list: the name, then what that step is doing. */
function stepRow(r, k) {
  const name = esc(STATE.labels[k]);
  const here = k === r.step && r.state !== "done";
  const stop = stoppedStep(r);
  const stopped = r.state === "failed" || r.state === "cancelled" || r.stalled;
  const after = stop && STATE.steps.indexOf(k) > STATE.steps.indexOf(stop) && !r.done.includes(k);
  let cls = "", cell = "";
  if (r.done.includes(k)) { cls = "done"; cell = "done"; }
  else if (stop === k && r.state === "failed") { cls = "failed"; cell = "failed"; }
  else if (stop === k && stopped) { cls = "cancelled"; cell = "stopped here"; }
  else if (after && stopped) { cls = "skipped"; cell = "not run"; }
  else if (here && r.state === "running") {
    cls = "running";
    const stale = staleMin(r) >= STALE_MIN ? `<span class="ap-stale">No progress for ${staleMin(r)} min</span>` : "";
    cell = (r.progress > 0
      ? `<span class="ap-bar" role="progressbar" aria-label="${name}" aria-valuenow="${r.progress}" aria-valuemin="0" aria-valuemax="100"><i style="width:${r.progress}%"></i></span><span class="ap-pct">${r.progress}%</span>${r.detail ? `<span class="ap-detail faint">${esc(r.detail)}</span>` : ""}`
      : `<span class="ap-detail">${esc(r.detail || "Working…")}</span>`) + stale;
  } else if (here && r.state === "waiting") { cls = "waiting"; cell = "Waiting for the AI's reply"; }
  else if (here && r.state === "queued") { cls = "queued"; cell = "queued"; }
  return `<li class="ap-step ${cls}"><span class="ap-step-name">${name}</span><span class="ap-step-state">${cell}</span></li>`;
}

/* The one line of a finished run. */
function summaryText(r) {
  const stop = STATE.labels[stoppedStep(r)] || "";
  if (r.state === "failed") return `Failed at ${stop || "a step"}${r.error ? `: ${shortText(r.error, 80)}` : ""}`;
  if (r.state === "cancelled") return `Stopped at ${stop || "a step"}`;
  const n = (r.results || []).length;
  const dated = (r.results || []).filter((c) => c.date);
  const clips = `${n} clip${n === 1 ? "" : "s"}`;
  if (!dated.length) return n ? `${clips} · ready in Clips` : "No clip worth making";
  const days = [...new Set(dated.map((c) => c.date))].sort();
  const times = dated.map((c) => c.time).filter(Boolean).sort();
  const day = days.length === 1 ? dayText(days[0]) : `${dayText(days[0])} – ${dayText(days[days.length - 1])}`;
  return `${clips} · scheduled ${day}${times.length ? ` ${times[0]}${times[0] === times[times.length - 1] ? "" : `–${times[times.length - 1]}`}` : ""}`;
}

function runHTML(r, typed) {
  const label = STATE.labels[r.step] || "";
  const going = isOpenNow(r);
  const open = going || OPEN.has(r.id);
  const steps = `<ol class="ap-steps">${STATE.steps.map((k) => stepRow(r, k)).join("")}</ol>`;
  const u = r.ai_usage;
  const usage = u ? `<p class="ap-note">Gemini · ${esc(u.model)} · ${(u.input / 1000).toFixed(u.input < 10000 ? 1 : 0)}k in / ${(u.output / 1000).toFixed(u.output < 10000 ? 1 : 0)}k out · ${esc(new Date(u.at * 1000).toLocaleString())}</p>` : "";
  const clips = (r.results || []).length
    ? `<ul class="ap-clips">${r.results.map((c) => `<li>${esc(c.title)}${whenText(c) ? ` · ${esc(whenText(c))}` : ""}</li>`).join("")}</ul>` : "";
  const stateText = r.stalled ? "stalled" : r.state === "running" ? label : r.state === "waiting" ? "Waiting for the AI's reply" : r.state;
  const reply = r.state === "waiting" ? `
    <div class="ap-reply">
      <div class="ap-actions"><button class="btn" type="button" data-copy-brief="${esc(r.id)}">Copy brief</button>
        <span class="ap-note">Give it to the AI, then paste its JSON reply here.</span></div>
      <textarea data-reply="${esc(r.id)}" spellcheck="false" placeholder="Paste the AI's reply (JSON)">${esc(typed[r.id] || "")}</textarea>
      <div class="ap-actions"><button class="btn main" type="button" data-send-reply="${esc(r.id)}">Continue</button><span class="ap-error" data-reply-error="${esc(r.id)}"></span></div>
    </div>` : "";
  const actions = [
    r.project ? `<a class="btn" href="/edit/${esc(r.project)}">Open project</a>` : "",
    r.stalled ? `<button class="btn" type="button" data-retry="${esc(r.id)}">Resume</button>` : "",
    !r.stalled && ["failed", "cancelled"].includes(r.state) ? `<button class="btn" type="button" data-retry="${esc(r.id)}">Retry</button>` : "",
    going ? `<button class="btn" type="button" data-cancel="${esc(r.id)}">Cancel</button>` : "",
    going ? "" : `<button class="btn" type="button" data-rerun="${esc(r.id)}">Run again…</button>`,
    going ? "" : `<button class="btn" type="button" data-toggle="${esc(r.id)}" aria-expanded="${open}" aria-controls="apd-${esc(r.id)}">${open ? "Hide details" : "Details"}</button>`,
  ].join("");
  const detail = `${steps}
    ${r.error ? `<p class="ap-error">${esc(r.error)}</p>` : ""}
    ${(r.notes || []).map((n) => `<p class="ap-note">${esc(n)}</p>`).join("")}
    ${(r.history || []).map((h) => `<p class="ap-note">Run again from ${esc(STATE.labels[h.fromStep] || h.fromStep)}${h.ai[0] !== h.ai[1] ? ` (${esc(AI_NAMES[h.ai[0]] || h.ai[0])} → ${esc(AI_NAMES[h.ai[1]] || h.ai[1])})` : ""} · ${esc(new Date(h.at).toLocaleString())}</p>`).join("")}
    ${(r.framingNotes || []).length ? `<p class="ap-note">AI Framing skipped: ${esc(r.framingNotes.join("; "))}</p>` : ""}
    ${usage}${clips}${reply}`;
  const sum = r.stalled ? `<p class="ap-summary" data-kind="cancelled">Stopped: klipian is not working on this run</p>`
    : going ? "" : `<p class="ap-summary" data-kind="${esc(r.state)}">${esc(summaryText(r))}</p>`;
  return `<article class="ws-panel ap-run${open ? "" : " ap-collapsed"}" data-run="${esc(r.id)}">
    <div class="ap-run-top"><span class="ap-run-title">${esc(r.title || r.url)}</span><span class="ap-chip" data-state="${esc(r.stalled ? "stalled" : r.state)}">${esc(stateText)}</span></div>
    ${sum}
    <div class="ap-detail-box" id="apd-${esc(r.id)}"${open ? "" : " hidden"}>${detail}</div>
    <div class="ap-actions">${actions}</div>
  </article>`;
}

function drawRuns() {
  const list = $("#apRunList");
  const bar = $("#apBar");
  if (!STATE.runs.length) { list.innerHTML = '<p class="ap-note">No run yet.</p>'; bar.innerHTML = ""; $("#apPager").hidden = true; return; }
  // keep what is being typed in a reply box, and the focused button, while the list is redrawn
  const typed = {};
  list.querySelectorAll("textarea[data-reply]").forEach((t) => { typed[t.dataset.reply] = t.value; });
  const el = document.activeElement;
  const focus = el && el.closest && el.closest("#apBar, #apRunList")
    ? ["data-toggle", "data-filter", "data-clear"].map((a) => el.hasAttribute(a) && `[${a}="${el.getAttribute(a)}"]`).find(Boolean) : "";
  const count = (k) => STATE.runs.filter((r) => k === "all" || kindOf(r) === k).length;
  const finishedN = STATE.runs.filter((r) => ["done", "cancelled"].includes(r.state) && !r.stalled).length;
  bar.innerHTML = `<div class="ap-filters" role="group" aria-label="Show runs">${FILTERS.map(([k, name]) =>
    `<button type="button" class="btn ap-filter" data-filter="${k}" aria-pressed="${FILTER === k}">${name} <span class="ap-count">${count(k)}</span></button>`).join("")}</div>
    ${finishedN ? `<button type="button" class="btn" data-clear="1">Clear finished</button>` : ""}`;
  // going runs on top, then newest first (the server list is newest first)
  const shown = STATE.runs.filter((r) => FILTER === "all" || kindOf(r) === FILTER);
  const ordered = [...shown.filter(isOpenNow), ...shown.filter((r) => !isOpenNow(r))];
  pager ||= createPager({ key: "autopilot-runs", mount: $("#apPager"), onChange: drawRuns });
  const rows = pager.slice(ordered);
  list.innerHTML = rows.length ? rows.map((r) => runHTML(r, typed)).join("") : `<p class="ap-note">No run here.</p>`;
  if (focus) (list.querySelector(focus) || bar.querySelector(focus))?.focus();
}

/* Run again…: from which step, with which AI; says first which clips are on YouTube already and stay there. */
async function rerunDialog(id) {
  const info = await call(`/api/autopilot/rerun-info?id=${encodeURIComponent(id)}`);
  const run = STATE.runs.find((r) => r.id === id) || {};
  const froms = [["clips", "Choosing clips"], ["framing", "AI Framing"], ["render", "Render"], ["schedule", "Schedule"]];
  const start = info.ai[info.current]?.ok ? info.current : "manual";      // the run's own AI, unless it is not ready any more
  const body = document.createElement("div");
  body.className = "ap-rerun";
  body.innerHTML = `<div class="ap-row"><label for="rrFrom">From</label><select id="rrFrom">${froms.map(([k, n]) => `<option value="${k}"${k !== "clips" && !info.hasResults ? " disabled" : ""}>${esc(n)}${k !== "clips" && !info.hasResults ? " (no clips yet)" : ""}</option>`).join("")}</select></div>
    <div class="ap-row"><label for="rrAi">AI</label><select id="rrAi">${Object.keys(AI_NAMES).map((k) => `<option value="${k}"${k === start ? " selected" : ""}${info.ai[k].ok ? "" : " disabled"}>${esc(AI_NAMES[k])}${info.ai[k].ok ? "" : ` (${esc(info.ai[k].detail || "not ready")})`}</option>`).join("")}</select></div>
    <p class="ap-note" id="rrAiNote"></p><p class="ap-error" id="rrWarn"></p>`;
  const from = body.querySelector("#rrFrom"), ai = body.querySelector("#rrAi");
  const paint = () => {
    ai.disabled = from.value !== "clips";
    body.querySelector("#rrAiNote").textContent = ai.disabled ? "The AI only matters when the clips are chosen again." : "";
    const list = info.uploaded.map((c) => `${c.title}${c.date ? ` · ${dayText(c.date)} ${c.time}` : ""}`).join(", ");
    body.querySelector("#rrWarn").textContent = !info.uploaded.length ? ""
      : `${info.uploaded.length === 1 ? "This clip is" : `These ${info.uploaded.length} clips are`}${info.uploaded.length === 1 ? " already scheduled on YouTube and stays" : " already scheduled on YouTube and stay"} there: ${list}. ${from.value === "clips" ? "New clips are added next to them." : "Rendering and scheduling again makes new copies of them."} Delete the old ones in YouTube Studio if you do not want both.`;
  };
  from.addEventListener("change", paint);
  paint();
  if (!(await confirmDialog({ title: "Run again", message: `${run.title || run.url}: the clips made before stay in the project.`, body, confirmText: "Run again", tone: "primary" }))) return;
  await call("/api/autopilot/rerun", { id, from: from.value, ai: ai.disabled ? "" : ai.value });
  FILTER = "all"; OPEN.delete(id);
  refresh();
}

async function refresh() {
  try { STATE = await call("/api/autopilot/state"); } catch (e) { say(e.message); return; }
  drawSettings();
  drawRuns();
  clearTimeout(timer);
  if (STATE.runs.some((r) => ["queued", "running"].includes(r.state))) timer = setTimeout(refresh, 2000);
}

function drawChecks(res) {
  $("#apChecks").innerHTML = res.items.map((i) => `<li class="ap-check" data-ok="${i.ok}"><span class="ap-tick" aria-hidden="true">${i.ok ? "✓" : "✗"}</span>
    <span>${esc(i.label)}${i.detail ? ` · ${esc(i.detail)}` : ""}</span>${i.fix ? `<span class="ap-sub">${esc(i.fix)}${i.link ? ` <a href="${esc(i.link)}">Open</a>` : ""}</span>` : ""}</li>`).join("");
}

function setStart(ok) { $("#apStart").disabled = !ok; }

$("#apUrls").addEventListener("input", () => { if (CHECKED !== links().join("\n")) { setStart(false); $("#apChecks").innerHTML = ""; } });

$("#apCheck").addEventListener("click", async () => {
  const urls = links();
  setStart(false); say("Checking…");
  try {
    const res = await call("/api/autopilot/check", { urls });
    drawChecks(res);
    CHECKED = res.ok ? urls.join("\n") : "";
    setStart(res.ok);
    say(res.ok ? "Everything is ready." : "Something is missing: see the list.");
  } catch (e) { say(e.message); }
});

$("#apStart").addEventListener("click", async () => {
  const urls = links();
  if (urls.join("\n") !== CHECKED) { say("The links changed: Check again."); setStart(false); return; }
  setStart(false);
  try {
    const r = await call("/api/autopilot/start", { urls });
    $("#apUrls").value = ""; CHECKED = ""; $("#apChecks").innerHTML = "";
    say(r.runs.length ? `${r.runs.length} run${r.runs.length === 1 ? "" : "s"} started.` : "Those links already have a run going.");
    refresh();
  } catch (e) { say(e.message); }
});

async function saveSetting(fields) {
  try { await call("/api/autopilot/settings", fields); say("Saved."); } catch (e) { say(e.message); }
  refresh();
}
$("#apAi").addEventListener("change", () => saveSetting({ ai: $("#apAi").value }));
$("#apTpl").addEventListener("change", () => saveSetting({ template: $("#apTpl").value }));

document.addEventListener("click", async (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  try {
    if (b.dataset.toggle) {
      const id = b.dataset.toggle;
      if (OPEN.has(id)) OPEN.delete(id); else OPEN.add(id);
      drawRuns();
    } else if (b.dataset.filter) { FILTER = b.dataset.filter; pager?.first(); drawRuns(); }
    else if (b.dataset.clear) {
      const n = STATE.runs.filter((r) => ["done", "cancelled"].includes(r.state) && !r.stalled).length;
      if (await confirmDialog({ title: "Clear finished runs?", message: `This takes ${n} done and cancelled run${n === 1 ? "" : "s"} off the list. The projects, renders and the YouTube schedule stay. Failed runs stay on the list.`, confirmText: "Clear", tone: "primary" })) {
        await call("/api/autopilot/clear", {});
        refresh();
      }
    } else if (b.dataset.rerun) { await rerunDialog(b.dataset.rerun); }
    else if (b.dataset.retry) { await call("/api/autopilot/retry", { id: b.dataset.retry }); refresh(); }
    else if (b.dataset.cancel) { await call("/api/autopilot/cancel", { id: b.dataset.cancel }); refresh(); }
    else if (b.dataset.copyBrief) {
      const text = await (await fetch(`/api/autopilot/brief?id=${encodeURIComponent(b.dataset.copyBrief)}`, { headers: { "X-Klipian-Profile": PROFILE } })).text();
      b.textContent = (await copyText(text)) ? "Copied" : "Copy failed";
      setTimeout(() => { b.textContent = "Copy brief"; }, 2000);
    } else if (b.dataset.sendReply) {
      const id = b.dataset.sendReply;
      const box = document.querySelector(`textarea[data-reply="${id}"]`);
      const err = document.querySelector(`[data-reply-error="${id}"]`);
      err.textContent = "";
      try { await call("/api/autopilot/reply", { id, text: box.value }); refresh(); }
      catch (x) { err.textContent = x.message; }
    }
  } catch (x) { say(x.message); }
});

refresh();
