/* klipian — interaksi nyata
   ==========================================================================
   app.js merender tampilan. File ini membuat kontrolnya benar-benar bekerja,
   supaya yang diuji adalah ALURNYA, bukan gambarnya.

   Reframe punya berkas sendiri (reframe.js) karena logikanya paling berat.
   Dimuat setelah app.js; memakai binding globalnya.
   ========================================================================== */

/* ───────────────── sumber: tarik file, pilih file, link YouTube ───────── */

const YT_PATTERN = /(?:youtube\.com\/(?:watch\?v=|shorts\/|live\/|embed\/)|youtu\.be\/)([\w-]{11})/;
let chosenSource = null;

const fileInput = Object.assign(document.createElement("input"), {
  type: "file", accept: "video/*,.mkv", hidden: true,
});
document.body.appendChild(fileInput);

const fmtSize = (b) => {
  const mb = b / 1048576;
  return mb >= 1024 ? `${(mb / 1024).toFixed(2)} GB` : `${Math.round(mb)} MB`;
};

const fmtDuration = (d) => {
  if (!isFinite(d)) return "durasi tidak terbaca";
  const t = Math.round(d);
  const h = Math.floor(t / 3600);
  const m = String(Math.floor((t % 3600) / 60)).padStart(2, "0");
  const s = String(t % 60).padStart(2, "0");
  return h ? `${h}:${m}:${s}` : `${m}:${s}`;
};

/* Durasi dan resolusi dibaca sungguhan dari file lewat elemen <video>. */
function readMeta(file) {
  return new Promise((end) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () =>
      end({ duration: v.duration, width: v.videoWidth, height: v.videoHeight, url });
    v.onerror = () => end({ duration: NaN, width: 0, height: 0, url });
    v.src = url;
  });
}

async function acceptFile(file) {
  if (!file) return;
  if (!/^video\//.test(file.type) && !/\.(mkv|mov|mp4|webm)$/i.test(file.name)) {
    drawSource("File itu bukan video. Pakai mp4, mkv, mov, atau webm.");
    return;
  }
  // Revoc blob URL sebelumnya supaya tidak memory leak
  if (chosenSource && chosenSource.url && chosenSource.url.startsWith("blob:")) {
    URL.revokeObjectURL(chosenSource.url);
  }
  const meta = await readMeta(file);
  const changed = chosenSource && chosenSource.name !== file.name;
  chosenSource = { kind: "file", name: file.name, size: file.size, ...meta };
  $("#urlInput").value = "";
  drawSource();

  // Video baru = orang di frame juga lain, jadi daftar objek dikosongkan dan
  // dimulai lagi dari "Orang 1".
  if (changed && typeof resetObjects === "function") resetObjects();

  // Video baru = sesi baru. Tanpa ini, kandidat dan ribbon dari file
  // sebelumnya ikut terbawa dan angkanya bertabrakan di layar.
  if (changed || DATA[mode].candidates.length) {
    DATA[mode].candidates = [];
    DATA[mode].marks = [];
    DATA[mode].words = [];
    if (typeof realTranscript !== "undefined") realTranscript = null;
    renderBoard(); renderList();
    if (typeof summarizeRender === "function") summarizeRender();
  }
  renderRibbon();   // ribbon ikut durasi file yang baru dijatuhkan
  if (typeof prepareVideo === "function") {
    prepareVideo();
    setClip(DATA[mode].candidates[0]);
  }
}

function acceptURL(text) {
  const matched = text.match(YT_PATTERN);
  if (matched) {
    chosenSource = { kind: "youtube", name: `youtu.be/${matched[1]}`, id: matched[1] };
    drawSource();
  } else {
    chosenSource = null;
    drawSource(text.trim() ? "Link itu bukan alamat YouTube yang dikenali." : null);
  }
}

function drawSource(error) {
  const box = document.querySelector(".source-drop");
  const button = $("#run");
  if (!box || !button) return;
  const title = box.querySelector("h2");
  const note = box.querySelector("p");

  if (error) {
    box.dataset.state = "error";
    title.textContent = "Belum bisa dipakai";
    note.textContent = error;
    button.disabled = true;
  } else if (!chosenSource) {
    box.dataset.state = "";
    title.textContent = "Tarik file ke sini";
    note.textContent = "mp4, mkv, mov — atau";
    button.disabled = true;
  } else {
    const s = chosenSource;
    box.dataset.state = "ready";
    title.textContent = s.name;
    note.textContent = s.kind === "file"
      ? `${fmtSize(s.size)} · ${fmtDuration(s.duration)}${s.width ? ` · ${s.width}×${s.height}` : ""}`
      : "video akan diunduh saat pipeline dijalankan";
    button.disabled = false;
  }
}

document.addEventListener("click", (e) => {
  if (e.target.closest(".source-actions .btn")) fileInput.click();
});
fileInput.addEventListener("change", () => acceptFile(fileInput.files[0]));
$("#urlInput").addEventListener("input", (e) => acceptURL(e.target.value));

/* Tarik-lepas berlaku di SELURUH jendela. Kalau dijatuhkan di luar layar
   Siapkan, aplikasi pindah ke sana dulu supaya hasilnya terlihat -- bukan
   diam-diam masuk ke layar yang sedang tersembunyi. */

const curtain = document.createElement("div");
curtain.className = "curtain-drop";
curtain.innerHTML = '<div class="curtain-body"><h2>Lepaskan di sini</h2>' +
                  '<p>mp4, mkv, mov, webm</p></div>';
document.body.appendChild(curtain);

let dragCount = 0;
const hasFiles = (e) => [...((e.dataTransfer && e.dataTransfer.types) || [])].includes("Files");

window.addEventListener("dragenter", (e) => {
  if (!hasFiles(e)) return;
  e.preventDefault();
  dragCount++;
  document.body.dataset.drag = "true";
});

window.addEventListener("dragover", (e) => {
  if (!hasFiles(e)) return;
  e.preventDefault();                      // wajib, kalau tidak drop diabaikan
  e.dataTransfer.dropEffect = "copy";
});

window.addEventListener("dragleave", (e) => {
  if (!hasFiles(e)) return;
  dragCount = Math.max(0, dragCount - 1);
  if (dragCount === 0) delete document.body.dataset.drag;
});

window.addEventListener("drop", (e) => {
  if (!hasFiles(e)) return;
  e.preventDefault();
  dragCount = 0;
  delete document.body.dataset.drag;
  if ($("#app").dataset.stage !== "prepare") toStage("prepare");
  acceptFile(e.dataTransfer.files[0]);
});

/* ───────────────── kandidat: setujui, tolak, batalkan ────────────────── */

$("#board").addEventListener("click", (e) => {
  const b = e.target.closest(".btn");
  if (!b) return;
  const i = [...$("#board").children].indexOf(b.closest(".card"));
  const k = DATA[mode].candidates[i];
  if (!k) return;
  // data-action, bukan teks tombol: mengganti label "Setujui" jadi apa pun
  // tidak boleh diam-diam mematikan persetujuan klip.
  const action = b.dataset.action;
  k.status = action === "approve" ? "approved"
           : action === "reject" ? "rejected"
           : undefined;      // reset: Batalkan dan Kembalikan sama-sama ke awal
  renderBoard();
  renderRibbon();
  renderList();            // antrian ikut berubah: isinya klip yang disetujui
  renderPreview();
  if (typeof summarizeRender === "function") summarizeRender();
});

/* ───────────────── ribbon: klik sapuan membuka klipnya ───────────────── */

$("#ribbonStrip").addEventListener("click", (e) => {
  const m = e.target.closest(".mark");
  if (!m) return;
  const k = DATA[mode].candidates[[...$("#ribbonStrip").children].indexOf(m)];
  if (!k) return;
  if (typeof applyRealWords === "function" && k.startSec !== undefined) {
    applyRealWords(k);                     // transkrip ikut pindah ke klip itu
  } else {
    $("#cutTitle").textContent = k.title;
    $("#cutDur").textContent = `${k.dur}s`;
  }
  if (typeof setClip === "function") setClip(k);
  toScreen("cut");
});

/* ───────────────── caption: opsi mengubah preview seketika ───────────── */

function captionValue(id) {
  // dicari lewat id, bukan awalan label -- label boleh diganti kapan saja
  const o = CAPTION_OPTIONS.find((x) => x.id === id);
  return o ? o.choices[o.active] : null;
}

function applyCaption() {
  const cap = document.querySelector(".cap916");
  if (!cap) return;
  cap.style.fontSize = `${captionValue("size")}px`;
  cap.style.bottom = `${captionValue("position")}%`;
  const thickness = Number(captionValue("outline"));
  cap.style.webkitTextStroke = thickness ? `${thickness * 0.5}px rgba(0,0,0,.85)` : "";
  const mark = cap.querySelector("mark");
  if (mark) mark.style.background = captionValue("highlight") === "putih" ? "#fff" : "var(--aksen)";
}

$("#captionList").addEventListener("click", (e) => {
  const c = e.target.closest(".chip");
  if (!c) return;
  const row = c.closest(".row");
  const o = CAPTION_OPTIONS.find((x) => x.id === row.dataset.caption);
  if (!o) return;
  const all = [...row.querySelectorAll(".chip")];
  o.active = all.indexOf(c);
  o.value = o.choices[o.active];
  all.forEach((b, i) => b.setAttribute("aria-pressed", String(i === o.active)));
  row.querySelector(".meta").textContent = o.value;
  applyCaption();
});

/* ───────────────── potong: klik jeda membuang celahnya ──────────────── */

$("#transcript").addEventListener("click", (e) => {
  const j = e.target.closest(".gap");
  if (j) j.replaceWith(document.createTextNode(" "));
});

/* ───────────────── antrian: batalkan / ulangi / buka folder ──────────── */

$("#queueList").addEventListener("click", (e) => {
  const b = e.target.closest(".btn");
  if (!b) return;
  const i = [...$("#queueList").children].indexOf(b.closest(".row"));
  const r = QUEUE[i];
  if (!r) return;
  const action = b.dataset.action;

  if (action === "open") {
    // Backend yang membuka Explorer -- browser tidak boleh, dan tidak perlu.
    if (!r.folder) { b.textContent = "folder belum siap"; setTimeout(drawQueue, 2000); return; }
    fetch("/api/open-folder", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ folder: r.folder }),
    }).then((x) => x.json()).then((j) => {
      if (j.error) { b.textContent = j.error.slice(0, 24); setTimeout(drawQueue, 2500); }
    }).catch(() => { b.textContent = "butuh klipian serve"; setTimeout(drawQueue, 2500); });
    return;
  }
  if (action === "cancel") { r.pct = 0; r.note = "dibatalkan"; r.action = "Ulangi"; }
  else if (action === "retry") { r.pct = 4; r.note = "berjalan"; r.action = "Batalkan"; }
  drawQueue();
});

drawSource();
applyCaption();
