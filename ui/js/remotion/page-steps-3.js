/* klipian — the /remotion page, part of ui/js/remotion/page.js (split out, no change of behaviour): steps 7 and 8: the preview and the render.
   A classic script: the names are shared with the other page-*.js files; page.js loads last and starts the page. */

// ---------------------------------------------------------------------------------------------------------------------------------------
// 7 the preview video
// ---------------------------------------------------------------------------------------------------------------------------------------

function bodyPreview(d) {
  if (!d.story) return `<p class="rm-hint">Ambil ceritanya dulu (langkah 3).</p>`;
  const pv = d.preview, job = d.job || {};
  const busy = job.kind === "preview-video" && ["queued", "running"].includes(job.state);
  return `
    <p>Draf video setengah ukuran, dengan narasi, efek suara, dan musik. Lihat dulu sebelum render final.</p>
    <div class="rm-actions"><button class="btn ${pv ? "" : "main"}" type="button" data-act="previewVideo" ${busy ? "disabled" : ""}>${pv ? "Buat pratinjau lagi" : "Buat pratinjau"}</button><span class="rm-hint" id="rmPreviewVideoNote">${busy ? esc(job.message || "") : ""}</span></div>
    ${pv && !busy ? `<video class="rm-video" controls playsinline src="${pv.url}"></video><p class="rm-hint">${pv.stale ? "Cerita atau suara berubah sejak pratinjau ini: buat lagi." : `Dibuat dalam ${pv.seconds} detik.`}</p>` : ""}`;
}

async function startPreviewVideo() {
  const j = await call(`${API}/preview-video`, { id: CUR.id });
  CUR.job = j.job;
  drawSteps();
  startPoll();
}

// ---------------------------------------------------------------------------------------------------------------------------------------
// 8 render
// ---------------------------------------------------------------------------------------------------------------------------------------

function jobHTML(job, kind) {
  if (!job || job.kind !== kind || job.state === "idle") return "";
  const active = ["queued", "running"].includes(job.state);
  return `<div class="rm-job" data-state="${esc(job.state)}">
      ${active ? `<div class="rm-bar"><i style="width:${job.percent || 0}%"></i></div>` : ""}
      <div class="rm-jobline"><span class="rm-jobmsg">${esc(job.message || "")}</span>${active ? `<span class="rm-eta">${job.percent || 0}% ${esc(fmtEta(job.eta))}</span>` : ""}
        ${active && kind === "render" ? `<button class="btn sm danger" type="button" data-act="cancel">Batal</button>` : ""}</div>
    </div>`;
}

// the render block is the server's (the same facts as the next step): the page only shows it
function bodyRender(d) {
  if (!d.story) return `<p class="rm-hint">Ambil ceritanya dulu (langkah 3).</p>`;
  const job = d.job || {};
  const busy = ["queued", "running"].includes(job.state);
  const rb = d.renderBlock || { state: "belum", can: false, text: "", reasons: [] };
  const r = d.render;
  return `
    <p class="rm-hint">Akan dirender dengan: ${d.kind === "custom" && d.composition ? `video khusus <b>${esc(d.composition)}</b>` : d.kind === "custom" ? "video khusus (folder belum dipilih)" : "template klipian"}. Panjang video: ${esc(lengthText(d.length))}.</p>
    <div class="rm-gate" data-state="${esc(rb.state)}">${rb.reasons.length && !rb.can ? `<b>${esc(rb.text)}</b><ul>${rb.reasons.map((g) => `<li>${esc(g)}</li>`).join("")}</ul>` : esc(rb.text)}</div>
    <div class="rm-actions">
      <button class="btn ${rb.state === "selesai" ? "" : "main"} large" type="button" data-act="render" ${!rb.can || busy ? "disabled" : ""}>${r ? (rb.state === "usang" ? "Render ulang" : "Render lagi") : "Render"}</button>
      <span class="rm-hint">MP4 9:16 1080×1920, 30 fps, dengan sound effect.</span>
    </div>
    ${jobHTML(job, "render")}
    ${r ? `<div class="rm-note">${r.current ? "Hasil terbaru" : "Hasil terakhir"}: <b>${esc(r.file)}</b> (${r.seconds} detik render, ${r.kind === "custom" ? "video khusus" : "template"}). <a class="rm-link" href="/workspace">Buka di Clips</a> untuk jadwal dan unggah.</div>` : ""}`;
}

async function startRender() {
  try {
    const j = await call(`${API}/render`, { id: CUR.id });
    CUR.job = j.job;
    drawSteps();
    startPoll();
  } catch (ex) {
    if (ex.data?.problems) { await refresh(); toast(ex.message); } else throw ex;
  }
}

async function cancelJob() {
  const j = await call(`${API}/cancel`, { id: CUR.id });
  CUR.job = j.job;
  drawSteps();
}

async function deleteVideo() {
  const ok = await confirmDialog({ title: "Hapus video ini?", message: `"${CUR.topic}": cerita, centang fakta dan gambar ikut terhapus. Video yang sudah ada di Clips tetap ada.`, confirmText: "Hapus", cancelText: "Batal" });
  if (!ok) return;
  await call(`${API}/delete`, { id: CUR.id });
  CUR = null;
  history.replaceState(null, "", location.pathname);
  await loadList();
  drawIntro();
}
