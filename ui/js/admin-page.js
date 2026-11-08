/* klipian: Admin settings (/admin). The key is only ever sent TO the server; the page gets a hint of it back. */
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
let STATE = null;

async function call(path, body) {
  const r = await fetch(path, body === undefined ? {} : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) { const e = new Error(j.error || `failed (${r.status})`); e.reply = j; throw e; }
  return j;
}
const say = (t) => { $("#msg").textContent = t || ""; };
const fill = (sel, list, value) => { $(sel).innerHTML = list.map((v) => `<option value="${esc(v)}"${String(v) === String(value) ? " selected" : ""}>${esc(v)}</option>`).join(""); };

let SEL = "default";
const tpl = () => STATE.templates.find((x) => x.id === SEL) || STATE.templates[0];

function draw() {
  const { gemini: g, options: o } = STATE;
  if (!STATE.templates.some((x) => x.id === SEL)) SEL = "default";
  const s = tpl();
  $("#tSel").innerHTML = STATE.templates.map((x) => `<option value="${esc(x.id)}"${x.id === SEL ? " selected" : ""}>${esc(x.name)}</option>`).join("");
  $("#tDelete").disabled = SEL === "default";
  $("#tReset").disabled = SEL !== "default";
  $("#tName").value = s.name; $("#tName").disabled = SEL === "default";
  fill("#fPicture", o.pictures, s.format.picture);
  fill("#fBg", o.backgrounds, s.format.background);
  fill("#fIntroStyle", o.introStyles, s.format.introStyle);
  fill("#fQuality", o.qualities, s.quality);
  $("#fFraming").checked = s.framing;
  $("#fIntro").checked = s.format.angleIntro;
  $("#fIntroSec").value = s.format.introSeconds;
  $("#fDays").value = s.schedule.days;
  $("#fMax").value = s.maxClips;
  $("#fUpload").checked = s.schedule.autoUpload;
  $("#hours").innerHTML = s.schedule.hours.map((h) => `<span class="admin-hour">${esc(h)} <button class="btn quiet sm" type="button" data-del="${esc(h)}" aria-label="Remove ${esc(h)}">✕</button></span>`).join("");
  $("#gState").textContent = !g.sdk ? `The Google SDK is not installed. Run: ${g.command}`
    : g.hasKey ? `A key is saved (${g.keyHint}).` : "No key saved yet.";
  $("#gRemove").disabled = !g.hasKey;
  $("#gTest").disabled = !g.hasKey || !g.sdk;
  $("#gError").textContent = g.lastError || "";
  if (!$("#gModel").options.length) fill("#gModel", g.model ? [g.model] : [""], g.model);
}

async function save(body) {
  try { STATE = { ...STATE, ...(await call("/api/admin/settings", body)) }; say("Saved."); }
  catch (e) { say(e.message); }
  draw();
}

async function loadModels() {
  if (!STATE.gemini.hasKey || !STATE.gemini.sdk) return;
  try {
    const { models } = await call("/api/admin/gemini/models");
    const ids = models.map((m) => m.id);
    if (STATE.gemini.model && !ids.includes(STATE.gemini.model)) ids.unshift(STATE.gemini.model);
    fill("#gModel", ids.length ? ids : [""], STATE.gemini.model || ids[0]);
    $("#gResult").textContent = `${models.length} models for this key.`;
  } catch (e) { $("#gError").textContent = e.message; }
}

/* Change the selected template; a refused value puts the page back as the server has it. */
async function saveTemplate(values) {
  $("#tError").textContent = "";
  try { STATE = { ...STATE, ...(await call("/api/admin/template", { action: "save", template: SEL, values })) }; say("Saved."); }
  catch (e) { $("#tError").textContent = e.message; }
  draw();
}

async function templateAction(action, extra = {}) {
  $("#tError").textContent = "";
  try { STATE = { ...STATE, ...(await call("/api/admin/template", { action, template: SEL, ...extra })) }; return true; }
  catch (e) { $("#tError").textContent = e.message; return false; }
  finally { draw(); }
}

const newId = (before) => STATE.templates.map((x) => x.id).find((id) => !before.includes(id));

document.addEventListener("change", (e) => {
  const id = e.target.id;
  if (id === "tSel") { SEL = $("#tSel").value; draw(); }
  else if (id === "tName") saveTemplate({ name: $("#tName").value });
  else if (id === "fPicture" || id === "fBg" || id === "fFraming" || id === "fIntro" || id === "fIntroStyle" || id === "fIntroSec" || id === "fQuality" || id === "fDays" || id === "fUpload" || id === "fMax") {
    saveTemplate({
      format: { picture: $("#fPicture").value, background: $("#fBg").value, angleIntro: $("#fIntro").checked, introStyle: $("#fIntroStyle").value, introSeconds: Number($("#fIntroSec").value) },
      framing: $("#fFraming").checked,
      maxClips: Number($("#fMax").value),
      schedule: { days: Number($("#fDays").value), autoUpload: $("#fUpload").checked },
      quality: Number($("#fQuality").value),
    });
  } else if (id === "gModel") save({ gemini: { model: $("#gModel").value } });
});

document.addEventListener("click", async (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  if (b.id === "gSave") {
    const key = $("#gKey").value.trim();
    if (!key) { say("Paste a key first."); return; }
    $("#gKey").value = "";
    await save({ gemini: { apiKey: key } });
    loadModels();
  } else if (b.id === "gRemove") {
    await save({ gemini: { removeKey: true } });
    $("#gResult").textContent = "";
  } else if (b.id === "gTest") {
    $("#gResult").textContent = "Testing…"; $("#gError").textContent = "";
    try {
      const r = await call("/api/admin/gemini/test", {});
      $("#gResult").textContent = r.note;
      STATE.gemini = r.gemini;
    } catch (err) { $("#gResult").textContent = ""; STATE.gemini = { ...STATE.gemini, ...(err.reply || {}) }; }
    draw();
  } else if (b.id === "hAdd") {
    const v = $("#hNew").value;
    if (v) saveTemplate({ schedule: { hours: [...tpl().schedule.hours, v] } });
  } else if (b.dataset.del) {
    saveTemplate({ schedule: { hours: tpl().schedule.hours.filter((h) => h !== b.dataset.del) } });
  } else if (b.id === "tCreate" || b.id === "tDup") {
    const before = STATE.templates.map((x) => x.id);
    if (await templateAction(b.id === "tCreate" ? "create" : "duplicate", { name: $("#tNew").value || (b.id === "tDup" ? `${tpl().name} copy` : "") })) {
      $("#tNew").value = ""; SEL = newId(before) || SEL; draw();
    }
  } else if (b.id === "tReset") {
    if (await confirmDialog({ title: "Reset the Default template?", confirmText: "Reset to defaults", message: "Its format, schedule and quality go back to the original values." })) templateAction("reset");
  } else if (b.id === "tDelete") {
    if (await confirmDialog({ title: `Delete the template ${tpl().name}?`, confirmText: "Delete template", message: "Profiles that use it go back to the Default template." })) templateAction("delete");
  }
});

(async () => {
  if (PROFILE !== "_admin") { location.replace("/profiles?next=/admin"); return; }
  try { STATE = await call("/api/admin/settings"); } catch (e) { say(e.message); return; }
  draw();
  loadModels();
})();
