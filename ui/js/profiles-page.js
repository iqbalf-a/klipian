/* klipian — the profile picker (/profiles)
   ==========================================================================
   One click to enter a profile; "+ Profile baru" makes one; each card can be renamed,
   recoloured and deleted (two clicks, then the folder goes to the Recycle Bin). "Masuk
   sebagai Guest" is always there: it edits and renders, with no schedule, no post text
   and no YouTube. The choice belongs to THIS TAB (sessionStorage).
   ========================================================================== */

const $ = (s) => document.querySelector(s);
const NEXT = (() => {
  const n = new URLSearchParams(location.search).get("next") || "/";
  return n.startsWith("/") && !n.startsWith("//") ? n : "/";       // only a path on this server
})();

function enter(id) {
  try {
    sessionStorage.setItem("klipian:profile", id);
    localStorage.setItem("klipian:last-profile", id);
  } catch { /* no storage: the pages fall back to the picker */ }
  location.href = NEXT;
}

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

async function api(path, body) {
  const r = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body || {}) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new Error(j.error || `failed (${r.status})`);
  return j;
}

function showError(text) {
  $("#pickerError").textContent = text || "";
}

let LAST = null;
try { LAST = localStorage.getItem("klipian:last-profile"); } catch { /* none */ }

async function draw() {
  let data;
  try { data = await (await fetch("/api/profiles")).json(); }
  catch { showError("Cannot reach the klipian server. Start it with start.cmd."); return; }
  const grid = $("#pickerGrid");
  grid.innerHTML = data.profile.map((p) => `
    <div class="picker-card${p.id === LAST ? " last" : ""}" role="listitem" data-id="${esc(p.id)}" style="--pc:${esc(p.color)}">
      <button class="picker-enter" type="button" data-enter="${esc(p.id)}" aria-label="Masuk sebagai ${esc(p.name)}">
        <span class="picker-swatch" aria-hidden="true">${esc(p.name.slice(0, 1).toUpperCase())}</span>
        <span class="picker-name">${esc(p.name)}</span>
      </button>
      <span class="picker-tools">
        <button class="btn quiet" type="button" data-rename="${esc(p.id)}" title="Ganti nama">Nama</button>
        <input type="color" value="${esc(p.color)}" data-color="${esc(p.id)}" title="Ganti warna" aria-label="Warna ${esc(p.name)}">
        <button class="btn quiet" type="button" data-delete="${esc(p.id)}" title="Hapus profile (ke Recycle Bin)">✕</button>
      </span>
    </div>`).join("") + `
    <button class="picker-card picker-add" type="button" id="addProfile"><span class="picker-swatch">+</span><span class="picker-name">+ Profile baru</span></button>`;
  const g = data.guest;
  $("#pickerGuest").innerHTML = `
    <button class="btn picker-guest-btn" type="button" data-enter="_guest">Masuk sebagai Guest</button>
    <span class="picker-guest-note">Edit dan render saja: tanpa jadwal Clips, teks posting, atau akun YouTube.</span>
    <button class="btn quiet" type="button" id="clearGuest" title="Pindahkan semua yang dibuat Guest ke Recycle Bin">Clear guest data</button>`;
}

document.addEventListener("click", async (e) => {
  const enterBtn = e.target.closest("[data-enter]");
  if (enterBtn) { enter(enterBtn.dataset.enter); return; }
  if (e.target.closest("#addProfile")) { $("#newForm").hidden = false; $("#newName").focus(); return; }
  if (e.target.closest("#newCancel")) { $("#newForm").hidden = true; $("#newError").textContent = ""; return; }
  const ren = e.target.closest("[data-rename]");
  if (ren) {
    const card = ren.closest(".picker-card");
    const label = card.querySelector(".picker-name");
    const input = document.createElement("input");
    input.className = "picker-rename"; input.value = label.textContent; input.maxLength = 40;
    label.replaceWith(input); input.focus(); input.select();
    const done = async (save) => {
      if (save && input.value.trim() && input.value.trim() !== label.textContent) {
        try { await api("/api/profiles/update", { id: ren.dataset.rename, name: input.value }); showError(""); }
        catch (err) { showError(err.message); }
      }
      draw();
    };
    input.addEventListener("keydown", (k) => { if (k.key === "Enter") done(true); else if (k.key === "Escape") done(false); });
    input.addEventListener("blur", () => done(true), { once: true });
    return;
  }
  const del = e.target.closest("[data-delete]");
  if (del) {
    if (!armedClick(del, { armedText: "Hapus?", strong: true })) return;
    try { await api("/api/profiles/delete", { id: del.dataset.delete }); showError(""); } catch (err) { showError(err.message); }
    draw();
    return;
  }
  const clear = e.target.closest("#clearGuest");
  if (clear) {
    if (!armedClick(clear, { armedText: "Hapus data Guest?", strong: true })) return;
    try { await api("/api/profiles/clear-guest"); showError("Data Guest dipindahkan ke Recycle Bin."); } catch (err) { showError(err.message); }
  }
});

document.addEventListener("change", async (e) => {
  const c = e.target.closest("[data-color]");
  if (!c) return;
  try { await api("/api/profiles/update", { id: c.dataset.color, color: c.value }); showError(""); } catch (err) { showError(err.message); }
  draw();
});

$("#newForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    await api("/api/profiles/create", { name: $("#newName").value, color: $("#newColor").value });
    $("#newName").value = ""; $("#newForm").hidden = true; $("#newError").textContent = "";
    draw();
  } catch (err) { $("#newError").textContent = err.message; }
});

draw();
