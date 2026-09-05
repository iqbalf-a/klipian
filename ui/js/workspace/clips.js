/* klipian — workspace: panel Klip
   ==========================================================================
   Jadwal upload: status, sumber episode, judul/hook, deskripsi + hashtag,
   caption TikTok, tanggal & jam, link setelah posted. Diedit langsung di
   tabel, tersimpan ke content/schedule/clips.json lewat /api/workspace/clips
   tiap kali sebuah sel selesai diedit (event "change", bukan tombol Save).

   Butuh $/escapeHTML dari helpers.js -- dimuat sebelum file ini.
   ========================================================================== */

const STATUS = ["Draft", "Ready", "Scheduled", "Posted", "Discarded"];
const PLATFORM = ["YouTube", "TikTok", "YouTube + TikTok"];
const FIELDS = ["episode", "file", "title", "description", "tiktokCaption",
  "date", "time", "youtubeUrl", "tiktokUrl", "notes"];

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
  const f = (name, type = "text") => {
    const val = escapeHTML(c[name] || "");
    if (name === "description" || name === "tiktokCaption" || name === "notes")
      return `<textarea class="ws-input" data-field="${name}" rows="2">${val}</textarea>`;
    return `<input class="ws-input" type="${type}" data-field="${name}" value="${val}">`;
  };
  const td = "px-2 py-1 align-top border-b border-garis";
  return `
    <tr class="hover:bg-kaca" data-id="${c.id}">
      <td class="${td}">
        <select class="ws-input ws-status" data-field="status" data-v="${c.status || "Draft"}">
          ${opt(STATUS, c.status || "Draft")}
        </select>
      </td>
      <td class="${td}">${f("episode")}</td>
      <td class="${td}">${f("file")}</td>
      <td class="${td}">${f("title")}</td>
      <td class="${td}">${f("description")}</td>
      <td class="${td}">${f("tiktokCaption")}</td>
      <td class="${td}"><select class="ws-input" data-field="platform">${opt(PLATFORM, c.platform || "YouTube + TikTok")}</select></td>
      <td class="${td}">${f("date", "date")}</td>
      <td class="${td}">${f("time", "time")}</td>
      <td class="${td}">${f("youtubeUrl", "url")}</td>
      <td class="${td}">${f("tiktokUrl", "url")}</td>
      <td class="${td}">${f("notes")}</td>
      <td class="${td}"><button class="ws-hapus" data-aksi="hapus" title="Hapus klip ini">✕</button></td>
    </tr>`;
}

function gambarKlip() {
  const body = $("#klipBody");
  if (!body) return;
  if (!CLIPS.length) {
    body.innerHTML = `<tr><td colspan="13" class="ws-kosong">
      Belum ada klip. Klik "+ Klip baru" buat mulai nyatet jadwal upload.
    </td></tr>`;
    return;
  }
  body.innerHTML = CLIPS.map(baris).join("");
}

function kumpulkanBaris(tr) {
  const clip = { id: tr.dataset.id };
  clip.status = $("[data-field=status]", tr).value;
  clip.platform = $("[data-field=platform]", tr).value;
  for (const name of FIELDS) {
    const el = $(`[data-field="${name}"]`, tr);
    if (el) clip[name] = el.value;
  }
  return clip;
}

async function simpanBaris(tr) {
  const clip = kumpulkanBaris(tr);
  try {
    const j = await (await fetch("/api/workspace/clips", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(clip),
    })).json();
    if (j.error) throw new Error(j.error);
    // id klip baru datang dari server -- baris yang baru dibuat lewat
    // "+ Klip baru" belum punya id sampai simpanan pertama ini.
    tr.dataset.id = j.id;
    const i = CLIPS.findIndex((c) => c.id === clip.id || c.id === j.id);
    clip.id = j.id;
    if (i >= 0) CLIPS[i] = clip; else CLIPS.push(clip);
    ringkasKlip();
  } catch (err) {
    console.error("gagal simpan klip:", err);
  }
}

$("#klipBody")?.addEventListener("change", (e) => {
  const tr = e.target.closest("tr[data-id]");
  if (!tr) return;
  if (e.target.matches("[data-field=status]"))
    e.target.dataset.v = e.target.value;
  simpanBaris(tr);
});

$("#klipBody")?.addEventListener("click", async (e) => {
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

muatKlip();
