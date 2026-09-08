/* klipian — workspace: panel Clips
   ==========================================================================
   Upload schedule: status, episode source, title/hook, description +
   hashtags, TikTok caption, date & time, post-publish link. Edited
   directly in the table, saved to workspace/schedule/clips.json via
   /api/workspace/clips whenever a cell finishes editing (the "change"
   event, not a Save button).

   Table only shows INLINE columns (status, title, platform, schedule) --
   the old 13-column layout made the table 1700px wide and forced
   horizontal scrolling just to read the next row. DETAIL fields
   (episode, file, description, caption, link, notes) were moved to a
   per-row dialog, opened via the "Detail" button (see openDetail()).

   Requires $/escapeHTML from helpers.js -- loaded before this file.
   ========================================================================== */

const STATUS = ["Draft", "Ready", "Scheduled", "Posted", "Discarded"];
const PLATFORM = ["YouTube", "TikTok", "YouTube + TikTok"];
const INLINE_FIELDS = ["title", "date", "time"];
const DETAIL_FIELDS = ["episode", "file", "description", "tiktokCaption",
  "youtubeUrl", "tiktokUrl", "notes"];

let CLIPS = [];

async function muatKlip() {
  try {
    const d = await (await fetch("/api/workspace/clips")).json();
    CLIPS = d.clip || [];
  } catch {
    CLIPS = [];
    $("#klipRingkasan").textContent = "needs klipian serve";
    gambarKlip();
    return;
  }
  ringkasKlip();
  gambarKlip();
}

function ringkasKlip() {
  const per = {};
  for (const c of CLIPS) per[c.status] = (per[c.status] || 0) + 1;
  const bagian = STATUS.filter((s) => per[s]).map((s) => `${per[s]} ${s.toLowerCase()}`);
  $("#klipRingkasan").textContent = bagian.length
    ? `${CLIPS.length} klip · ${bagian.join(" · ")}`
    : "belum ada klip";
}

function baris(c) {
  const opt = (list, cur) => list.map((v) =>
    `<option value="${v}" ${v === cur ? "selected" : ""}>${v}</option>`).join("");
  const f = (name, type = "text") =>
    `<input class="ws-input" type="${type}" data-field="${name}" value="${escapeHTML(c[name] || "")}">`;
  const td = "px-2 py-1 align-top border-b border-garis";
  return `
    <tr class="hover:bg-kaca" data-id="${c.id}">
      <td class="${td}">
        <select class="ws-input ws-status" data-field="status" data-v="${c.status || "Draft"}">
          ${opt(STATUS, c.status || "Draft")}
        </select>
      </td>
      <td class="${td}">${f("title")}</td>
      <td class="${td}"><select class="ws-input" data-field="platform">${opt(PLATFORM, c.platform || "YouTube + TikTok")}</select></td>
      <td class="${td}">${f("date", "date")}</td>
      <td class="${td}">${f("time", "time")}</td>
      <td class="${td}"><button class="ws-detail" data-action="detail" type="button">Detail</button></td>
      <td class="${td}"><button class="delete-btn" data-action="delete" type="button" title="Hapus klip ini">✕</button></td>
    </tr>`;
}

function gambarKlip() {
  const body = $("#klipBody");
  if (!body) return;
  if (!CLIPS.length) {
    body.innerHTML = `<tr><td colspan="7" class="empty">
      Belum ada klip. Klik "+ Klip baru" buat mulai nyatet jadwal upload.
    </td></tr>`;
    return;
  }
  body.innerHTML = CLIPS.map(baris).join("");
}

/* Table rows only have inputs for INLINE_FIELDS -- detail fields (still
   stored in CLIPS from the previous load/save) MUST be carried along,
   not just the fields present in the DOM, so that editing in the table
   doesn't silently wipe out description/caption/link/notes that were
   filled in via the Detail dialog. */
function kumpulkanBaris(tr) {
  const id = tr.dataset.id;
  const clip = { ...(CLIPS.find((c) => c.id === id) || {}), id };
  clip.status = $("[data-field=status]", tr).value;
  clip.platform = $("[data-field=platform]", tr).value;
  for (const name of INLINE_FIELDS) {
    const el = $(`[data-field="${name}"]`, tr);
    if (el) clip[name] = el.value;
  }
  return clip;
}

async function simpanClip(clip) {
  try {
    const j = await (await fetch("/api/workspace/clips", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(clip),
    })).json();
    if (j.error) throw new Error(j.error);
    // New clip ID comes from the server -- rows created via "+ New clip"
    // don't have an ID until this first save.
    clip.id = j.id;
    const i = CLIPS.findIndex((c) => c.id === clip.id);
    if (i >= 0) CLIPS[i] = clip; else CLIPS.push(clip);
    ringkasKlip();
    return j.id;
  } catch (err) {
    console.error("gagal simpan klip:", err);
    return null;
  }
}

$("#klipBody")?.addEventListener("change", (e) => {
  const tr = e.target.closest("tr[data-id]");
  if (!tr) return;
  if (e.target.matches("[data-field=status]"))
    e.target.dataset.v = e.target.value;
  simpanClip(kumpulkanBaris(tr));
});

$("#klipBody")?.addEventListener("click", async (e) => {
  const detail = e.target.closest('[data-action="detail"]');
  if (detail) {
    bukaDetail(detail.closest("tr[data-id]")?.dataset.id);
    return;
  }
  const b = e.target.closest('[data-action="delete"]');
  if (!b) return;
  const tr = b.closest("tr[data-id]");
  const id = tr?.dataset.id;
  if (!id) { tr.remove(); return; }   // empty row that was never saved
  try {
    await fetch("/api/workspace/clips", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, delete: true }),
    });
  } catch (err) {
    console.error("gagal hapus klip:", err);
  }
  CLIPS = CLIPS.filter((c) => c.id !== id);
  ringkasKlip();
  gambarKlip();
});

$("#klipTambahBtn")?.addEventListener("click", async () => {
  try {
    const j = await (await fetch("/api/workspace/clips", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "Draft", platform: "YouTube + TikTok" }),
    })).json();
    if (j.error) throw new Error(j.error);
    CLIPS.unshift({ id: j.id, status: "Draft", platform: "YouTube + TikTok" });
    ringkasKlip();
    gambarKlip();
  } catch (err) {
    console.error("gagal bikin klip baru:", err);
  }
});

/* ---------- Detail dialog ---------- */

const klipDialog = $("#klipDetailDialog");
const klipDetailForm = $("#klipDetailForm");

function bukaDetail(id) {
  if (!id || !klipDialog) return;
  const c = CLIPS.find((x) => x.id === id);
  if (!c) return;
  klipDialog.dataset.id = id;
  // Title here is read-only context -- edited from the table so there's
  // no single source of truth for the same field in two places.
  $("#klipDetailJudul").textContent = c.title || "(tanpa judul)";
  for (const name of DETAIL_FIELDS) {
    const el = $(`[data-field="${name}"]`, klipDetailForm);
    if (el) el.value = c[name] || "";
  }
  klipDialog.showModal();
}

klipDialog?.addEventListener("close", async () => {
  if (klipDialog.returnValue !== "save") return;
  const id = klipDialog.dataset.id;
  const existing = CLIPS.find((c) => c.id === id);
  if (!existing) return;
  const clip = { ...existing };
  for (const name of DETAIL_FIELDS) {
    const el = $(`[data-field="${name}"]`, klipDetailForm);
    if (el) clip[name] = el.value;
  }
  await simpanClip(clip);
});

muatKlip();
