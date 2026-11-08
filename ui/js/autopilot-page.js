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

function drawRuns() {
  const list = $("#apRunList");
  if (!STATE.runs.length) { list.innerHTML = '<p class="ap-note">No run yet.</p>'; return; }
  // keep what is being typed in a reply box while the list is redrawn
  const typed = {};
  list.querySelectorAll("textarea[data-reply]").forEach((t) => { typed[t.dataset.reply] = t.value; });
  list.innerHTML = STATE.runs.map((r) => {
    const label = STATE.labels[r.step] || "";
    const bar = r.state === "running" ? `<div class="ap-bar" role="progressbar" aria-valuenow="${r.progress}" aria-valuemin="0" aria-valuemax="100"><i style="width:${r.progress}%"></i></div>` : "";
    const steps = STATE.steps.map((k) => (r.done.includes(k) ? `<s>✓ ${esc(STATE.labels[k])}</s>` : k === r.step && r.state !== "done" ? `<b>${esc(STATE.labels[k])}</b>` : `<span>${esc(STATE.labels[k])}</span>`)).join("");
    const u = r.ai_usage;
    const usage = u ? `<p class="ap-note">Gemini · ${esc(u.model)} · ${(u.input / 1000).toFixed(u.input < 10000 ? 1 : 0)}k in / ${(u.output / 1000).toFixed(u.output < 10000 ? 1 : 0)}k out · ${esc(new Date(u.at * 1000).toLocaleString())}</p>` : "";
    const clips = (r.results || []).length
      ? `<ul class="ap-clips">${r.results.map((c) => `<li>${esc(c.title)}${whenText(c) ? ` · ${esc(whenText(c))}` : ""}</li>`).join("")}</ul>` : "";
    const stateText = r.state === "running" ? `${label}${r.progress ? ` ${r.progress}%` : ""}` : r.state === "waiting" ? "Waiting for the AI's reply" : r.state;
    const reply = r.state === "waiting" ? `
      <div class="ap-reply">
        <div class="ap-actions"><button class="btn" type="button" data-copy-brief="${esc(r.id)}">Copy brief</button>
          <span class="ap-note">Give it to the AI, then paste its JSON reply here.</span></div>
        <textarea data-reply="${esc(r.id)}" spellcheck="false" placeholder="Paste the AI's reply (JSON)">${esc(typed[r.id] || "")}</textarea>
        <div class="ap-actions"><button class="btn main" type="button" data-send-reply="${esc(r.id)}">Continue</button><span class="ap-error" data-reply-error="${esc(r.id)}"></span></div>
      </div>` : "";
    const actions = [
      r.project ? `<a class="btn" href="/edit/${esc(r.project)}">Open project</a>` : "",
      ["failed", "cancelled"].includes(r.state) ? `<button class="btn" type="button" data-retry="${esc(r.id)}">Retry</button>` : "",
      ["queued", "running", "waiting"].includes(r.state) ? `<button class="btn" type="button" data-cancel="${esc(r.id)}">Cancel</button>` : "",
    ].join("");
    return `<article class="ws-panel ap-run" data-run="${esc(r.id)}">
      <div class="ap-run-top"><span class="ap-run-title">${esc(r.title || r.url)}</span><span class="ap-chip" data-state="${esc(r.state)}">${esc(stateText)}</span></div>
      ${bar}
      <div class="ap-steps">${steps}</div>
      ${r.detail && r.state === "running" ? `<p class="ap-note">${esc(r.detail)}</p>` : ""}
      ${r.error ? `<p class="ap-error">${esc(r.error)}</p>` : ""}
      ${r.note ? `<p class="ap-note">${esc(r.note)}</p>` : ""}
      ${(r.framingNotes || []).length ? `<p class="ap-note">AI Framing skipped: ${esc(r.framingNotes.join("; "))}</p>` : ""}
      ${usage}${clips}${reply}
      <div class="ap-actions">${actions}</div>
    </article>`;
  }).join("");
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
    if (b.dataset.retry) { await call("/api/autopilot/retry", { id: b.dataset.retry }); refresh(); }
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
