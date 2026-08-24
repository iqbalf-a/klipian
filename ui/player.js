/* klipian — pemutar preview & alur render
   ==========================================================================
   Dua lubang di alur yang ditutup di sini:

   1. Preview 9:16 tidak bisa disetel. Tombol putar tidak memutar apa pun,
      padahal file yang dijatuhkan sudah punya object URL sejak awal.
      Sekarang video aslinya diputar DI DALAM frame, sudah ter-crop sesuai
      kotak Reframe, dan berhenti tepat di ujung klip.

   2. Tidak ada satu pun tombol yang memulai render. Antrian menampilkan
      progress dari pekerjaan yang tidak pernah dimulai. Sekarang render
      dijalankan dari layar Kandidat, atas klip yang kamu setujui.

   Rendernya masih simulasi -- belum ada ffmpeg di belakangnya -- tapi
   waktunya diturunkan dari durasi klip yang sebenarnya.
   ========================================================================== */

const video = $("#videoPreview");
const frame = $("#frame");

let activeClip = null;      // { judul, mulai, akhir } dalam detik
let isPlaying = false;

const secondsFromClock = (t) =>
  String(t).split(":").reduce((a, b) => a * 60 + Number(b), 0);

/* Ukuran dan posisi video dihitung dari kotak crop.
   Untuk menampilkan potongan selebar W% dari frame sumber di dalam kotak
   selebar F, videonya harus dilebarkan jadi F * 100/W, lalu digeser
   sejauh L% dari lebar itu. */
function attachVideoGeometry() {
  if (!video.src) return;
  const canvas = document.querySelector(".canvas");
  const c1 = document.querySelector(".canvas .crop");
  if (!canvas || !c1) return;

  const k = canvas.getBoundingClientRect();
  const r = c1.getBoundingClientRect();
  // Layar Reframe bisa sedang tersembunyi; rect-nya nol dan pembagian
  // menghasilkan NaN. Dihitung ulang nanti saat layarnya terlihat.
  if (!k.width || !k.height || !r.width) return;
  const p = {
    left: ((r.left - k.left) / k.width) * 100,
    top: ((r.top - k.top) / k.height) * 100,
    w: (r.width / k.width) * 100,
  };

  const f = frame.getBoundingClientRect();
  if (!f.width) return;
  const width = f.width * (100 / p.w);
  const height = width * 9 / 16;                    // sumber 16:9
  video.style.width = `${width}px`;
  video.style.height = `${height}px`;
  video.style.transform =
    `translate(${-(p.left / 100) * width}px, ${-(p.top / 100) * height}px)`;
}

/* Klip mana yang sedang ditinjau. Preview adalah HASILNYA: kalau ada bagian
   yang dibuang, bagian itu ikut dilompati saat diputar, persis seperti di
   berkas yang nanti dirender. */
function setClip(k) {
  if (!k) return;
  activeClip = k;
  if (!k.spans || !k.spans.length) {
    k.spans = [{ start: k.startSec ?? secondsFromClock(k.in),
                 end: (k.startSec ?? secondsFromClock(k.in)) + k.dur }];
  }
  if (video.src) video.currentTime = k.spans[0].start;
  drawTime(0);            // durasi total tetap tampil walau video belum dimuat
  renderClipTabs();
  drawTimeline();
  if (typeof renderPreview === "function") renderPreview();
}

/* Durasi keluaran klip: jumlah panjang potongan, bukan jarak awal-akhir. */
const clipOutDur = (k) =>
  (k?.spans || []).reduce((t, p) => t + (p.end - p.start), 0);

/* waktu sumber -> waktu keluaran (null kalau jatuh di bagian yang dibuang) */
function sourceToOut(k, t) {
  let passed = 0;
  for (const p of k.spans) {
    if (t < p.start) return null;
    if (t <= p.end) return passed + (t - p.start);
    passed += p.end - p.start;
  }
  return null;
}

/* waktu keluaran -> waktu sumber */
function outToSource(k, t) {
  let sisa = t;
  for (const p of k.spans) {
    const len = p.end - p.start;
    if (sisa <= len) return p.start + sisa;
    sisa -= len;
  }
  const akhir = k.spans[k.spans.length - 1];
  return akhir ? akhir.end : 0;
}

const jamPendek = (d) =>
  `${String(Math.floor(Math.max(0, d) / 60)).padStart(2, "0")}:` +
  `${String(Math.floor(Math.max(0, d) % 60)).padStart(2, "0")}`;

function drawTime(passed) {
  const w = $("#clipTime");
  if (!w || !activeClip) return;
  w.textContent = `${jamPendek(passed)} / ${jamPendek(clipOutDur(activeClip))}`;
}

/* ---------- tab klip: preview mengikuti klip yang dipilih ---------- */

function renderClipTabs() {
  const bar = $("#clipTabs");
  if (!bar) return;
  const daftar = DATA[mode].candidates || [];
  if (!daftar.length) {
    bar.innerHTML = `<span class="kosong-tab">belum ada klip</span>`;
    return;
  }
  bar.innerHTML = daftar.map((k, i) => `
    <button class="chip klip-tab" role="tab" data-klip="${i}"
            aria-selected="${activeClip === k}"
            ${k.status === "approved" ? 'data-approved="true"' : ""}>
      <span class="nomor-klip">${i + 1}</span>${escapeHTML(k.title)}
      <span class="dur-klip">${Math.round(clipOutDur(k))}s</span>
    </button>`).join("");
}

$("#clipTabs")?.addEventListener("click", (e) => {
  const t = e.target.closest(".klip-tab");
  if (!t) return;
  const k = DATA[mode].candidates[Number(t.dataset.klip)];
  if (!k) return;
  if (typeof applyRealWords === "function" && k.startSec !== undefined && realTranscript) {
    applyRealWords(k);
  }
  setClip(k);
  if (typeof drawSpans === "function") drawSpans();
});

/* ---------- timeline: potongan yang dibuang tampak sebagai celah ---------- */

function drawTimeline() {
  const track = $("#tlTrack");
  if (!track || !activeClip) return;
  const total = clipOutDur(activeClip) || 1;
  track.innerHTML = activeClip.spans.map((p) => {
    const lebar = ((p.end - p.start) / total) * 100;
    return `<span class="tl-span" style="flex:0 0 ${lebar}%"
                  title="${jamPendek(p.start)} – ${jamPendek(p.end)}"></span>`;
  }).join("");
  drawHead();
}

function drawHead() {
  const head = $("#tlHead");
  if (!head || !activeClip || !video.src) return;
  const out = sourceToOut(activeClip, video.currentTime);
  const total = clipOutDur(activeClip) || 1;
  if (out === null) return;
  head.style.left = `${Math.min(100, (out / total) * 100)}%`;
  const tl = $("#timeline");
  if (tl) tl.setAttribute("aria-valuenow", Math.round((out / total) * 100));
}

/* Klik di timeline melompat ke posisi itu -- dalam waktu KELUARAN. */
$("#timeline")?.addEventListener("click", (e) => {
  if (!activeClip || !video.src) return;
  const r = e.currentTarget.getBoundingClientRect();
  if (!r.width) return;
  const frac = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
  video.currentTime = outToSource(activeClip, frac * clipOutDur(activeClip));
  drawHead();
});

$("#timeline")?.addEventListener("keydown", (e) => {
  if (!activeClip || !video.src) return;
  const langkah = e.shiftKey ? 5 : 1;
  const kini = sourceToOut(activeClip, video.currentTime) ?? 0;
  if (e.key === "ArrowRight") video.currentTime = outToSource(activeClip, kini + langkah);
  else if (e.key === "ArrowLeft") video.currentTime = outToSource(activeClip, Math.max(0, kini - langkah));
  else return;
  e.preventDefault();
  drawHead();
});

function prepareVideo() {
  if (!chosenSource || chosenSource.kind !== "file" || !chosenSource.url) {
    frame.dataset.video = "";
    return;
  }
  video.src = chosenSource.url;
  frame.dataset.video = "true";
  video.addEventListener("loadedmetadata", () => {
    attachVideoGeometry();
    if (activeClip) video.currentTime = Math.min(activeClip.spans[0].start, video.duration - 0.1);
  }, { once: true });
}

video.addEventListener("timeupdate", () => {
  if (!activeClip || !activeClip.spans?.length) return;
  const t = video.currentTime;

  // Lompati bagian yang dibuang: begitu ujung satu potongan lewat, langsung
  // pindah ke awal potongan berikutnya. Inilah yang membuat preview sama
  // dengan berkas hasil render.
  const i = activeClip.spans.findIndex((p) => t < p.end + 0.001);
  if (i === -1) {                                   // habis
    video.pause();
    video.currentTime = activeClip.spans[0].start;
    isPlaying = false;
    playBtn.textContent = "▶";
    drawTime(clipOutDur(activeClip));
    drawHead();
    return;
  }
  const p = activeClip.spans[i];
  if (t < p.start - 0.001) { video.currentTime = p.start; return; }

  drawTime(sourceToOut(activeClip, t) ?? 0);
  drawHead();
});

const rewindBtn = $("#rewindBtn");
const playBtn = $("#playBtn");

playBtn?.addEventListener("click", () => {
  if (!video.src || !activeClip) return;
  if (isPlaying) { video.pause(); playBtn.textContent = "▶"; }
  else {
    if (sourceToOut(activeClip, video.currentTime) === null) {
      video.currentTime = activeClip.spans[0].start;
    }
    video.play(); playBtn.textContent = "❚❚";
  }
  isPlaying = !isPlaying;
});

rewindBtn?.addEventListener("click", () => {
  if (video.src && activeClip) {
    video.currentTime = activeClip.spans[0].start;
    drawTime(0); drawHead();
  }
});

/* Tombol render ada di preview: yang dirender adalah klip yang sedang dilihat. */
$("#renderClipBtn")?.addEventListener("click", () => {
  if (!activeClip) return;
  kirimRender([activeClip]);
});

/* ───────────────── alur render ───────────────── */

let renderTimer = null;

function summarizeRender() {
  const n = DATA[mode].candidates.filter((k) => k.status === "approved").length;
  const el = $("#renderSummary");
  const btn = $("#renderBtn");
  if (!el || !btn) return;
  el.textContent = n
    ? `${n} klip disetujui · format ${optionValue("format")} · ${optionValue("resolution")}`
    : "Setujui dulu klip yang mau dirender";
  btn.textContent = n ? `Render ${n} klip` : "Render klip";
  btn.disabled = n === 0;
}

function optionValue(id) {
  const o = OPTIONS.find((x) => x.id === id);
  return o ? o.choices[o.active] : "";
}

$("#renderBtn").addEventListener("click", () => {
  buildQueue();
  QUEUE.forEach((r) => { r.pct = 0; r.note = "antre"; r.action = "Batalkan"; });
  drawQueue();
  toScreen("queue");
  startRender();
});

/* Render SUNGGUHAN lewat backend.
   Sebelumnya bagian ini cuma menganimasikan progress bar -- tidak ada berkas
   yang pernah dibuat, tapi antrian tetap menulis "selesai" dan menawarkan
   "Buka folder". Label yang berbohong lebih buruk daripada fitur yang belum
   ada. Sekarang benar-benar memanggil ffmpeg lewat klipian serve. */

/* Crop yang dipakai render. Diambil dari MODEL objek, bukan dari geometri
   DOM: kanvas yang belum pernah tampil melaporkan ukuran nol, dan dulu itu
   membuat UI menampilkan satu framing sementara server merender framing lain. */
function currentCrop(clip) {
  if (typeof cropForClip === "function") return cropForClip(clip || null);
  return null;
}

/* Render klip yang disetujui di layar Kandidat. */
async function startRender() {
  const approved = DATA[mode].candidates.filter((k) => k.status === "approved");
  if (!approved.length) return;
  return kirimRender(approved);
}

/* Kirim satu atau banyak klip ke server. Dipakai tombol di layar Kandidat
   (semua yang disetujui) dan tombol di preview (klip yang sedang dilihat). */
async function kirimRender(approved) {
  if (!approved || !approved.length) return;


  // Klip tanpa waktu detik tidak bisa dirender. Sebelumnya yang seperti ini
  // tetap dikirim dan server jatuh dengan KeyError 'mulai' -- pesan yang
  // tidak berarti apa-apa bagi pengguna.
  const valid = approved.filter((k) =>
    (k.spans || []).every((p) => Number.isFinite(p.start) && Number.isFinite(p.end))
    && (k.spans || []).length);
  if (!valid.length) {
    const head = document.querySelector('[data-screen="queue"] .note');
    if (head) head.textContent =
      "Klip ini tidak punya titik waktu. Impor ulang dari Claude, atau buat klip manual.";
    toScreen("queue");
    return;
  }

  const request = {
    video: chosenSource?.name || DATA[mode].file,
    clips: valid.map((k) => ({
      title: k.title,
      spans: (k.spans || [{ start: k.startSec, end: k.endSec }])
                  .map((p) => ({ start: p.start, end: p.end })),
      crop: currentCrop(k),          // tiap klip memakai objeknya sendiri
      layout: optionValue("format").startsWith("Blur") ? "blur" : "face",
      width: optionValue("resolution") === "720p" ? 720 : 1080,
    })),
  };

  // Antrian harus sejajar dengan apa yang benar-benar dikirim: server
  // melaporkan hasil per indeks, dan kalau isinya beda barisnya salah tunjuk.
  buildQueue(valid);
  QUEUE.forEach((r) => { r.pct = 0; r.note = "antre"; r.action = "Batalkan"; });
  drawQueue();
  toScreen("queue");

  let id;
  try {
    const reply = await fetch("/api/render", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    }).then((r) => r.json());
    if (reply.error) throw new Error(reply.error);
    id = reply.id;
  } catch (err) {
    // Tanpa backend, katakan apa adanya -- jangan pura-pura merender.
    QUEUE.forEach((r) => { r.pct = 0; r.note = "butuh klipian serve"; r.action = "Batalkan"; });
    drawQueue();
    const head = document.querySelector('[data-screen="queue"] .note');
    if (head) head.textContent =
      "Render butuh backend. Jalankan: python -m klipian serve";
    return;
  }

  clearInterval(renderTimer);
  renderTimer = setInterval(async () => {
    let t;
    try { t = await (await fetch(`/api/render/${id}`)).json(); }
    catch { return; }

    QUEUE.forEach((r, i) => {
      if (i < t.done) { r.pct = 100; r.note = "selesai"; r.action = "Buka folder"; }
      else if (i === t.index && t.state === "running") { r.pct = 55; r.note = "merender"; r.action = "Batalkan"; }
      else { r.pct = 0; r.note = "antre"; r.action = "Batalkan"; }
    });
    (t.result || []).forEach((h, i) => {
      if (QUEUE[i]) { QUEUE[i].name = h.file; QUEUE[i].url = h.url;
                        QUEUE[i].folder = h.folder; QUEUE[i].mb = h.mb; }
    });
    drawQueue();

    if (t.state !== "running") {
      clearInterval(renderTimer);
      const head = document.querySelector('[data-screen="queue"] .note');
      if (head) head.textContent = t.state === "failed"
        ? `Gagal: ${t.error}`
        : `${t.done} klip selesai · ${(t.result || []).reduce((a, h) => a + h.mb, 0).toFixed(1)} MB`;
    }
  }, 700);
}

