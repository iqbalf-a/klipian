/* klipian: Admin settings (/admin). The key is only ever sent TO the server; the page gets a hint of it back.
   The model and the template are edited as a draft: nothing is saved until Save (the key buttons act at once). */
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
let STATE = null;
let SEL = "default";
let HOURS = [];                       // the draft's upload times (the chips)
let NOTE = { text: "", bad: false };  // what the footer says besides "Unsaved changes"

async function call(path, body) {
  const r = await fetch(path, body === undefined ? {} : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) { const e = new Error(j.error || `failed (${r.status})`); e.reply = j; throw e; }
  return j;
}
const fill = (sel, list, value) => { $(sel).innerHTML = list.map((v) => `<option value="${esc(v)}"${String(v) === String(value) ? " selected" : ""}>${esc(v)}</option>`).join(""); };
const tpl = () => STATE.templates.find((x) => x.id === SEL) || STATE.templates[0];

/* ---- the draft: what the fields say now, against what the server has ---- */
function shape(o) {
  return JSON.stringify({ model: String(o.model ?? ""), name: String(o.name ?? ""), picture: String(o.picture), background: String(o.background),
    angleIntro: !!o.angleIntro, introStyle: String(o.introStyle), introSeconds: Number(o.introSeconds), framing: !!o.framing,
    maxClips: Number(o.maxClips), days: Number(o.days), hours: [...o.hours].sort(), autoUpload: !!o.autoUpload, quality: String(o.quality) });
}
function current() {
  return { model: $("#gModel").value, name: $("#tName").value, picture: $("#fPicture").value, background: $("#fBg").value,
    angleIntro: $("#fIntro").checked, introStyle: $("#fIntroStyle").value, introSeconds: $("#fIntroSec").value, framing: $("#fFraming").checked,
    maxClips: $("#fMax").value, days: $("#fDays").value, hours: HOURS, autoUpload: $("#fUpload").checked, quality: $("#fQuality").value };
}
function saved() {
  const s = tpl();
  return { model: STATE.gemini.model || "", name: s.name, picture: s.format.picture, background: s.format.background, angleIntro: s.format.angleIntro,
    introStyle: s.format.introStyle, introSeconds: s.format.introSeconds, framing: s.framing, maxClips: s.maxClips, days: s.schedule.days,
    hours: s.schedule.hours, autoUpload: s.schedule.autoUpload, quality: s.quality };
}
const dirty = () => shape(current()) !== shape(saved());

function updateFoot() {
  const d = dirty();
  const st = $("#status");
  st.dataset.bad = NOTE.bad ? "true" : "false";
  st.textContent = NOTE.bad ? NOTE.text : d ? "Unsaved changes" : NOTE.text;
  $("#save").disabled = !d;
  $("#discard").disabled = !d;
}
const note = (text, bad = false) => { NOTE = { text, bad }; updateFoot(); };

/* ---- validation: the wrong fields are marked and the message names them ---- */
function validate() {
  const c = current(), errs = [];
  const bad = (id, msg) => { errs.push(msg); $(id).setAttribute("aria-invalid", "true"); };
  document.querySelectorAll("[aria-invalid]").forEach((el) => el.removeAttribute("aria-invalid"));
  if (SEL !== "default" && !c.name.trim()) bad("#tName", "Name is empty");
  const sec = Number(c.introSeconds);
  if (c.introSeconds === "" || !(sec > 0) || sec > 10) bad("#fIntroSec", "Intro seconds must be more than 0 (at most 10)");
  const mx = Number(c.maxClips);
  if (c.maxClips === "" || !Number.isInteger(mx) || mx < 1 || mx > 10) bad("#fMax", "Most clips per run must be a whole number from 1 to 10");
  const dy = Number(c.days);
  if (c.days === "" || !Number.isInteger(dy) || dy < 0) bad("#fDays", "Start + days must be a whole number, 0 or more");
  const times = c.hours;
  if (!times.length) bad("#hours", "Keep at least one upload time");
  else if (times.some((h) => !/^([01]\d|2[0-3]):[0-5]\d$/.test(h))) bad("#hours", "Upload times must look like 18:00");
  else if (new Set(times).size !== times.length) bad("#hours", "An upload time is in the list twice");
  return errs;
}

/* ---- drawing from what the server has (this is also Discard) ---- */
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
  HOURS = [...s.schedule.hours];
  drawHours();
  drawKey();
  setModel(g.model || "");
  document.querySelectorAll("[aria-invalid]").forEach((el) => el.removeAttribute("aria-invalid"));
  updateFoot();
}
/* the key's part of the page: it changes at once, without touching a draft */
function drawKey() {
  const g = STATE.gemini;
  $("#gState").textContent = !g.sdk ? `The Google SDK is not installed. Run: ${g.command}`
    : g.hasKey ? `A key is saved (${g.keyHint}).` : "No key saved yet.";
  $("#gRemove").disabled = !g.hasKey;
  $("#gTest").disabled = !g.hasKey || !g.sdk;
  $("#gError").textContent = g.lastError || "";
}
function drawHours() {
  $("#hours").innerHTML = HOURS.map((h) => `<span class="admin-hour">${esc(h)} <button class="btn quiet sm" type="button" data-del="${esc(h)}" aria-label="Remove ${esc(h)}">✕</button></span>`).join("");
}
/* The model list is filled by loadModels; an empty first option means "none chosen". */
function setModel(id) {
  const sel = $("#gModel");
  if (![...sel.options].some((o) => o.value === ""))  sel.insertBefore(new Option("Choose a model…", ""), sel.firstChild);
  if (id && ![...sel.options].some((o) => o.value === id)) sel.append(new Option(id, id));
  sel.value = id;
}

async function loadModels() {
  if (!STATE.gemini.hasKey || !STATE.gemini.sdk) return;
  try {
    const { models } = await call("/api/admin/gemini/models");
    const keep = $("#gModel").value;
    const ids = models.map((m) => m.id);
    $("#gModel").innerHTML = "";
    for (const id of ids) $("#gModel").append(new Option(id, id));
    setModel(keep);
    $("#gResult").textContent = `${models.length} models for this key.`;
  } catch (e) { $("#gError").textContent = e.message; }
  updateFoot();
}

/* ---- Save: the model and the template, as one action; a refusal keeps the edits on screen ---- */
async function doSave() {
  const errs = validate();
  if (errs.length) { note(`Not saved: ${errs[0]}.`, true); return false; }
  const c = current(), was = saved();
  try {
    if (c.model !== was.model) STATE = { ...STATE, ...(await call("/api/admin/settings", { gemini: { model: c.model } })) };
    if (shape({ ...c, model: "" }) !== shape({ ...was, model: "" })) {
      const values = {
        format: { picture: c.picture, background: c.background, angleIntro: c.angleIntro, introStyle: c.introStyle, introSeconds: Number(c.introSeconds) },
        framing: c.framing, maxClips: Number(c.maxClips), schedule: { days: Number(c.days), hours: c.hours, autoUpload: c.autoUpload }, quality: Number(c.quality),
      };
      if (SEL !== "default") values.name = c.name.trim();
      STATE = { ...STATE, ...(await call("/api/admin/template", { action: "save", template: SEL, values })) };
    }
  } catch (e) { note(`Not saved: ${e.message}`, true); return false; }
  draw();
  const t = new Date();
  note(`Saved at ${String(t.getHours()).padStart(2, "0")}:${String(t.getMinutes()).padStart(2, "0")}`);
  return true;
}

/* Leaving this draft (another template, another menu, a template action): ask first when it has changes. */
async function guard() {
  if (!STATE || !dirty()) return true;
  let discard = false;
  const body = document.createElement("div");
  const b = document.createElement("button");
  b.type = "button"; b.className = "btn"; b.textContent = "Discard";
  body.append(b);
  b.addEventListener("click", () => { discard = true; document.querySelector(".confirm-dlg .confirm-cancel")?.click(); });
  const yes = await confirmDialog({ title: "Unsaved changes", message: "Save the changes to the model or the template first?", body, confirmText: "Save", cancelText: "Keep editing", tone: "primary" });
  if (yes) return doSave();
  if (discard) { draw(); note(""); return true; }
  return false;
}

async function templateAction(action, extra = {}) {
  $("#tError").textContent = "";
  try { STATE = { ...STATE, ...(await call("/api/admin/template", { action, template: SEL, ...extra })) }; return true; }
  catch (e) { $("#tError").textContent = e.message; return false; }
  finally { draw(); }
}
const newId = (before) => STATE.templates.map((x) => x.id).find((id) => !before.includes(id));

/* ---- tabs (the same pattern as the Profile settings tabs) ---- */
function tabs(list, attr, panelPrefix, onShow) {
  const show = (key, focus) => {
    for (const b of list.querySelectorAll("[role=tab]")) {
      const on = b.dataset[attr] === key;
      b.setAttribute("aria-selected", String(on)); b.tabIndex = on ? 0 : -1;
      if (on && focus) b.focus();
      const p = document.getElementById(b.getAttribute("aria-controls"));
      if (p) p.hidden = !on;
    }
    onShow?.(key);
  };
  list.addEventListener("click", async (e) => {
    const b = e.target.closest("[role=tab]");
    if (!b || b.getAttribute("aria-selected") === "true") return;
    if (attr === "tab" && !(await guard())) return;
    show(b.dataset[attr], false);
  });
  list.addEventListener("keydown", async (e) => {
    const all = [...list.querySelectorAll("[role=tab]")], at = all.indexOf(document.activeElement);
    const step = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
    let to = -1;
    if (step && at >= 0) to = (at + step + all.length) % all.length;
    else if (e.key === "Home") to = 0;
    else if (e.key === "End") to = all.length - 1;
    if (to < 0) return;
    e.preventDefault();
    if (attr === "tab" && !(await guard())) return;
    show(all[to].dataset[attr], true);
  });
}
tabs($(".adm-tabs"), "tab");
tabs($(".adm-subtabs"), "sub");

/* ---- the fields only change the draft ---- */
document.addEventListener("input", (e) => {
  if (e.target.closest(".adm-body") && e.target.id !== "gKey" && e.target.id !== "tNew" && e.target.id !== "hNew") {
    e.target.removeAttribute("aria-invalid");
    NOTE = { text: "", bad: false };
    updateFoot();
  }
});
document.addEventListener("change", async (e) => {
  if (e.target.id === "tSel") {
    const next = $("#tSel").value;
    if (!(await guard())) { $("#tSel").value = SEL; return; }
    SEL = next; draw(); note("");
  } else if (e.target.closest(".adm-body")) { NOTE = { text: "", bad: false }; updateFoot(); }
});

document.addEventListener("click", async (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  if (b.id === "save") await doSave();
  else if (b.id === "discard") { draw(); note(""); }
  else if (b.id === "gSave") {
    const key = $("#gKey").value.trim();
    if (!key) { note("Paste a key first.", true); return; }
    $("#gKey").value = "";
    try { STATE = { ...STATE, ...(await call("/api/admin/settings", { gemini: { apiKey: key } })) }; note("Key saved."); } catch (err) { note(err.message, true); }
    drawKey();
    loadModels();
  } else if (b.id === "gRemove") {
    try { STATE = { ...STATE, ...(await call("/api/admin/settings", { gemini: { removeKey: true } })) }; note("Key removed."); } catch (err) { note(err.message, true); }
    drawKey();
    $("#gResult").textContent = "";
  } else if (b.id === "gTest") {
    $("#gResult").textContent = "Testing…"; $("#gError").textContent = "";
    try {
      const r = await call("/api/admin/gemini/test", {});
      $("#gResult").textContent = r.note;
      STATE.gemini = r.gemini;
    } catch (err) { $("#gResult").textContent = ""; STATE.gemini = { ...STATE.gemini, ...(err.reply || {}) }; }
    drawKey();
  } else if (b.id === "hAdd") {
    const v = $("#hNew").value;
    if (!v) return;
    if (HOURS.includes(v)) { note(`${v} is in the list already.`, true); return; }
    HOURS = [...HOURS, v].sort(); drawHours(); $("#hours").removeAttribute("aria-invalid"); NOTE = { text: "", bad: false }; updateFoot();
  } else if (b.dataset.del) {
    HOURS = HOURS.filter((h) => h !== b.dataset.del); drawHours(); NOTE = { text: "", bad: false }; updateFoot();
  } else if (b.id === "tCreate" || b.id === "tDup") {
    if (!(await guard())) return;
    const before = STATE.templates.map((x) => x.id);
    if (await templateAction(b.id === "tCreate" ? "create" : "duplicate", { name: $("#tNew").value || (b.id === "tDup" ? `${tpl().name} copy` : "") })) {
      $("#tNew").value = ""; SEL = newId(before) || SEL; draw(); note("");
    }
  } else if (b.id === "tReset") {
    if (!(await guard())) return;
    if (await confirmDialog({ title: "Reset the Default template?", confirmText: "Reset to defaults", message: "Its format, schedule and quality go back to the original values." })) { await templateAction("reset"); note(""); }
  } else if (b.id === "tDelete") {
    if (!(await guard())) return;
    if (await confirmDialog({ title: `Delete the template ${tpl().name}?`, confirmText: "Delete template", message: "Profiles that use it go back to the Default template." })) { await templateAction("delete"); note(""); }
  }
});

window.addEventListener("beforeunload", (e) => { if (STATE && dirty()) { e.preventDefault(); e.returnValue = ""; } });

(async () => {
  if (PROFILE !== "_admin") { location.replace("/profiles?next=/admin"); return; }
  try { STATE = await call("/api/admin/settings"); } catch (e) { note(e.message, true); return; }
  draw();
  loadModels();
})();
