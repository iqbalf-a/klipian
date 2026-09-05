/* klipian — workspace: panel Klip
   ==========================================================================
   Jadwal upload: status, sumber episode, judul/hook, deskripsi + hashtag,
   caption TikTok, tanggal & jam, link setelah posted. Diedit langsung di
   tabel, tersimpan ke content/schedule/clips.json lewat /api/workspace/clips
   tiap kali sebuah sel selesai diedit (event "change", bukan tombol Save).

   Tabel cuma menampilkan kolom INLINE (status, judul, platform, jadwal) --
   dulu 13 kolom penuh bikin tabel selebar 1700px dan wajib scroll horizontal
   cuma untuk membaca baris berikutnya. Field DETAIL (episode, file,
   deskripsi, caption, link, catatan) dipindah ke dialog per baris, dibuka
   lewat tombol "Detail" (lihat bukaDetail()).

   Butuh $/escapeHTML dari helpers.js -- dimuat sebelum file ini.
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
      <td class="${td}"><button class="ws-detail" data-aksi="detail" type="button">Detail</button></td>
      <td class="${td}"><button class="ws-hapus" data-aksi="hapus" type="button" title="Hapus klip ini">✕</button></td>
    </tr>`;
}

function gambarKlip() {
  const body = $("#klipBody");
  if (!body) return;
  if (!CLIPS.length) {
    body.innerHTML = `<tr><td colspan="7" class="ws-kosong">
      Belum ada klip. Klik "+ Klip baru" buat mulai nyatet jadwal upload.
    </td></tr>`;
    return;
  }
  body.innerHTML = CLIPS.map(baris).join("");
}

/* Baris tabel cuma punya input untuk INLINE_FIELDS -- field detail (masih
   tersimpan di CLIPS dari muat/simpan sebelumnya) HARUS ikut disalin,
   bukan cuma field yang ada di DOM, supaya edit-di-tabel tidak diam-diam
   mengosongkan deskripsi/caption/link/catatan yang sudah diisi lewat
   dialog Detail. */
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
    // id klip baru datang dari server -- baris yang baru dibuat lewat
    // "+ Klip baru" belum punya id sampai simpanan pertama ini.
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
  const detail = e.target.closest('[data-aksi="detail"]');
  if (detail) {
    bukaDetail(detail.closest("tr[data-id]")?.dataset.id);
    return;
  }
  const b = e.target.closest('[data-aksi="hapus"]');
  if (!b) return;
  const tr = b.closest("tr[data-id]");
  const id = tr?.dataset.id;
  if (!id) { tr.remove(); return; }   // baris kosong yang belum pernah disimpan
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

/* ---------- dialog Detail ---------- */

const klipDialog = $("#klipDetailDialog");
const klipDetailForm = $("#klipDetailForm");

function bukaDetail(id) {
  if (!id || !klipDialog) return;
  const c = CLIPS.find((x) => x.id === id);
  if (!c) return;
  klipDialog.dataset.id = id;
  // Judul di sini cuma KONTEKS (read-only) -- diedit dari tabel supaya
  // tidak ada dua sumber kebenaran untuk field yang sama.
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
