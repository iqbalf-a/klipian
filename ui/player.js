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
/* Preview memotong dengan cara memperbesar <video> lalu menggesernya di dalam
   petak yang ber-overflow hidden -- persis seperti crop di ffmpeg, tapi pakai
   CSS. Rasio kotak framing sudah dikunci sama dengan rasio petaknya, jadi
   melebarkan menurut lebar saja sudah pas: tingginya ikut sendiri.

   Ukurannya diambil dari ANGKA di FRAMING, bukan dari mengukur kotak di
   kanvas. Sejak Framing punya layarnya sendiri, kanvas itu display:none
   setiap kali kamu berada di layar Klip atau Teks -- rect-nya nol, dan
   preview tidak pernah dapat ukuran sama sekali. */
function pasangPetak(v, petak, crop) {
  if (!v || !petak || !crop) return;
  const f = petak.getBoundingClientRect();
  // Layarnya bisa sedang tersembunyi; rect-nya nol dan pembagian menghasilkan
  // NaN. Dihitung ulang nanti saat layarnya terlihat.
  if (!f.width || !crop.width) return;

  const rasio = (typeof rasioSumber === "function") ? rasioSumber() : 16 / 9;
  const width = f.width * (100 / crop.width);
  const height = width / rasio;
  v.style.width = `${width}px`;
  v.style.height = `${height}px`;
  v.style.transform =
    `translate(${-(crop.left / 100) * width}px, ${-(crop.top / 100) * height}px)`;
}

function attachVideoGeometry() {
  if (!video.src || typeof bingkaiPada !== "function") return;
  const b = bingkaiPada(typeof waktuTinjau === "function" ? waktuTinjau() : 0);
  pasangPetak(video, document.querySelector(".belah.atas"), b.crops[0]);
  if (b.format === "split") {
    pasangPetak($("#videoPreview2"), document.querySelector(".belah.bawah"),
                b.crops[1]);
  }
}

/* Klip mana yang sedang ditinjau. Preview adalah HASILNYA: kalau ada bagian
   yang dibuang, bagian itu ikut dilompati saat diputar, persis seperti di
   berkas yang nanti dirender. */
function setClip(k) {
  if (!k) return;
  activeClip = k;
  if (!k.spans || !k.spans.length) {
    // k.dur bisa datang sebagai string dari JSON impor ("54.7"); Number()
    // supaya start + dur menjumlah, bukan menyambung string ("1254.7").
    const start = k.startSec ?? secondsFromClock(k.in);
    k.spans = [{ start, end: start + Number(k.dur) }];
  }
  if (video.src) video.currentTime = k.spans[0].start;
  drawTime(0);            // durasi total tetap tampil walau video belum dimuat
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

// Ikut menampilkan jam kalau sumbernya lebih dari 1 jam -- tanpa ini
// 1:05:00 tampil "65:00". Sejajar dengan jamRange() di app.js.
const jamPendek = (d) => {
  const t = Math.max(0, Math.floor(d));
  const j = Math.floor(t / 3600);
  const m = String(Math.floor((t % 3600) / 60)).padStart(2, "0");
  const s = String(t % 60).padStart(2, "0");
  return j ? `${j}:${m}:${s}` : `${m}:${s}`;
};

function drawTime(passed) {
  const w = $("#clipTime");
  if (!w || !activeClip) return;
  w.textContent = `${jamPendek(passed)} / ${jamPendek(clipOutDur(activeClip))}`;
}


/* ---------- timeline: potongan yang dibuang tampak sebagai celah ---------- */

function drawTimeline() {
  const track = $("#tlTrack");
  if (!track) return;
  if (!activeClip) {
    // Tanpa ini, mengosongkan Result meninggalkan track dan label waktu
    // klip TERAKHIR yang dipilih -- bukan keadaan "belum ada klip" yang
    // sebenarnya sedang terjadi.
    track.innerHTML = "";
    $("#tlStartTime").textContent = "00:00";
    $("#tlEndTime").textContent = "00:00";
    const head = $("#tlHead");
    if (head) head.style.left = "0%";
    return;
  }
  const total = clipOutDur(activeClip) || 1;
  track.innerHTML = activeClip.spans.map((p) => {
    const lebar = ((p.end - p.start) / total) * 100;
    return `<span class="tl-span" style="flex:0 0 ${lebar}%"
                  title="${jamPendek(p.start)} – ${jamPendek(p.end)}"></span>`;
  }).join("");
  $("#tlStartTime").textContent = "00:00";
  $("#tlEndTime").textContent = jamPendek(total);
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
  drawCaption();
  if (typeof syncCanvasVideo === "function") syncCanvasVideo();
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
  muatFps(chosenSource.name);          // fps untuk melangkah per frame
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
    if (playBtn) playBtn.textContent = "▶";
    drawTime(clipOutDur(activeClip));
    drawHead();
    drawCaption();
    if (typeof syncCanvasVideo === "function") syncCanvasVideo();
    return;
  }
  const p = activeClip.spans[i];
  if (t < p.start - 0.001) { video.currentTime = p.start; return; }

  drawTime(sourceToOut(activeClip, t) ?? 0);
  drawHead();
  drawCaption();

  // Kanvas framing menampilkan frame yang SAMA, tanpa dipotong. Disamakan
  // tiap tick supaya ia berjalan bersama preview, bukan membeku.
  if (typeof syncCanvasVideo === "function") syncCanvasVideo();

  // Framing ikut berpindah saat pemutaran melewati titik berikutnya --
  // supaya preview benar-benar memperlihatkan apa yang akan dirender.
  if (typeof framingPada === "function") {
    const f = framingPada(t);
    if (f && f !== framingTerakhir) {
      framingTerakhir = f;
      if (typeof renderFraming === "function") renderFraming();
    }
  }
});

/* ---------- caption hidup di preview ----------
   Dulu kotak caption berisi teks peraga yang dipaku di HTML ("bukan
   investasi, INI JUDI") -- tidak pernah berubah, dan menyesatkan karena
   bukan itu yang akan terbakar di berkas hasil.

   Sekarang isinya kata asli dari transkrip pada posisi pemutaran, dikelompok
   per baris dengan aturan yang SAMA dengan build_ass di sisi Python, dan kata
   yang sedang diucapkan disorot memakai warna dari layar Subtitle. */
function drawCaption() {
  const cap = $("#cap916");
  if (!cap) return;
  // Sumber teksnya kata yang SUDAH dibetulkan, supaya preview memperlihatkan
  // caption yang benar-benar akan terbakar di berkas hasil.
  const kata = (typeof kataResult === "function" && kataResult().length)
    ? kataResult() : realTranscript?.words;
  if (!activeClip || !kata?.length || !video.src) { cap.innerHTML = ""; return; }

  const t = video.currentTime;
  const perBaris = (typeof captionValue === "function"
    ? captionValue("per-line")?.out : 3) || 3;

  // kata yang benar-benar masuk keluaran, seperti di build_ass
  const dipakai = [];
  for (const w of kata) {
    const a = sourceToOut(activeClip, w.start);
    const b = sourceToOut(activeClip, w.end);
    if (a !== null && b !== null && b > a) dipakai.push({ a, b, teks: w.text.trim() });
  }
  if (!dipakai.length) { cap.innerHTML = ""; return; }

  const out = sourceToOut(activeClip, t);
  if (out === null) { cap.innerHTML = ""; return; }

  let i = dipakai.findIndex((w) => out < w.b);
  if (i === -1) i = dipakai.length - 1;
  const awalBaris = Math.floor(i / perBaris) * perBaris;
  const baris = dipakai.slice(awalBaris, awalBaris + perBaris);
  const sorot = i - awalBaris;

  cap.innerHTML = baris
    .map((w, j) => (j === sorot ? `<mark>${escapeHTML(w.teks)}</mark>` : escapeHTML(w.teks)))
    .join(" ");
}

/* ---------- melangkah per frame ----------
   Langkahnya dihitung di waktu KELUARAN, bukan waktu sumber. Bedanya terasa
   di sambungan antar potongan: maju satu frame di ujung potongan pertama
   mendarat di frame pertama potongan berikutnya, bukan di detik yang sudah
   kamu buang.

   fps datang dari ffprobe lewat /api/probe -- elemen <video> tidak pernah
   membocorkan angka itu. Kalau server tidak menjawab, dipakai 30 sebagai
   perkiraan yang aman untuk kebanyakan rekaman. */
let sourceFps = 30;

async function muatFps(nama) {
  if (!nama) return;
  try {
    const d = await (await fetch(`/api/probe?video=${encodeURIComponent(nama)}`)).json();
    if (d.fps && d.fps > 1 && d.fps < 200) {
      sourceFps = d.fps;
      const el = $("#fpsNote");
      if (el) el.textContent = `${Math.round(sourceFps)} fps`;
    }
  } catch { /* biarkan 30 */ }
}

function stepFrame(arah) {
  if (!video.src || !activeClip) return;
  if (isPlaying) {                    // melangkah sambil berjalan itu aneh
    video.pause();
    isPlaying = false;
    playBtn.textContent = "▶";
  }
  const total = clipOutDur(activeClip);
  const kini = sourceToOut(activeClip, video.currentTime);
  const dari = kini === null ? 0 : kini;
  const langkah = arah / sourceFps;          // arah = jumlah frame, boleh minus
  const tujuan = Math.max(0, Math.min(total - 1 / sourceFps / 2, dari + langkah));
  video.currentTime = outToSource(activeClip, tujuan);
  drawTime(tujuan);
  drawHead();
  drawCaption();
  if (typeof syncCanvasVideo === "function") syncCanvasVideo();
}

/* Kanvas framing disamakan pada peristiwa seek dan putar/jeda -- bukan hanya
   pada timeupdate. Menggeser posisi saat video dijeda tidak selalu memicu
   timeupdate, dan dulu kanvas tertinggal di posisi lamanya. */
["seeked", "play", "pause", "loadeddata"].forEach((ev) =>
  video.addEventListener(ev, () => {
    if (typeof syncCanvasVideo === "function") syncCanvasVideo();
  }));

const rewindBtn = $("#rewindBtn");
const playBtn = $("#playBtn");
const muteBtn = $("#muteBtn");

[["#prevFrame5", -5], ["#prevFrame2", -2], ["#prevFrameBtn", -1],
 ["#nextFrameBtn", 1], ["#nextFrame2", 2], ["#nextFrame5", 5]]
  .forEach(([sel, n]) => $(sel)?.addEventListener("click", () => stepFrame(n)));

/* Pintasan papan tik: , dan . seperti kebiasaan editor video; spasi untuk
   putar. Diabaikan saat kamu sedang mengetik di kolom isian. */
document.addEventListener("keydown", (e) => {
  const t = e.target;
  if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  // , dan . = 1 frame; Shift menahannya jadi 5 frame (< dan > di papan tik)
  if (e.key === ",") { e.preventDefault(); stepFrame(-1); }
  else if (e.key === ".") { e.preventDefault(); stepFrame(1); }
  else if (e.key === "<") { e.preventDefault(); stepFrame(-5); }
  else if (e.key === ">") { e.preventDefault(); stepFrame(5); }
  else if (e.key === " " && video.src && activeClip) { e.preventDefault(); playBtn.click(); }
});

playBtn?.addEventListener("click", () => {
  if (!video.src || !activeClip) return;
  if (isPlaying) { video.pause(); playBtn.textContent = "▶"; }
  else {
    if (sourceToOut(activeClip, video.currentTime) === null) {
      video.currentTime = activeClip.spans[0].start;
    }
    // Preview rekomendasi dan preview Result tidak boleh berbunyi bersamaan.
    if (typeof tutupPreviewRekom === "function") tutupPreviewRekom();
    // play() menolak kalau segera disusul pause() (mis. klip habis di
    // detik yang sama). Ditelan supaya tidak jadi galat tak tertangkap.
    video.play().catch(() => {});
    playBtn.textContent = "❚❚";
  }
  isPlaying = !isPlaying;
  drawCaption();
  if (typeof syncCanvasVideo === "function") syncCanvasVideo();
});

/* Suara: video sengaja TIDAK muted lagi. Dulu atribut muted membuat result
   diputar tanpa audio sama sekali, padahal berkas hasilnya berbunyi. */
muteBtn?.addEventListener("click", () => {
  video.muted = !video.muted;
  muteBtn.textContent = video.muted ? "🔇" : "🔊";
  muteBtn.setAttribute("aria-pressed", String(video.muted));
  muteBtn.title = video.muted ? "Bunyikan" : "Bisukan";
});

rewindBtn?.addEventListener("click", () => {
  if (video.src && activeClip) {
    video.currentTime = activeClip.spans[0].start;
    drawTime(0); drawHead(); drawCaption();
    if (typeof syncCanvasVideo === "function") syncCanvasVideo();
  }
});

/* Preview memutar RESULT. Inilah maksud "preview adalah hasilnya": yang kamu
   lihat di frame 9:16 adalah berkas yang nanti keluar, lengkap dengan
   lompatan di tiap sambungan antar potongan. */
function setResultAsPreview() {
  if (typeof RESULT === "undefined" || !RESULT.length) {
    activeClip = null;
    drawTimeline();
    // Tanpa ini panel LENGTH (renderPreview -> #clipInfo) menyisakan info
    // klip terakhir yang dipilih walau Result baru saja dikosongkan --
    // gejala yang sama dengan label timeline yang basi di atas.
    if (typeof renderPreview === "function") renderPreview();
    return;
  }
  const klip = resultAsClip();
  klip.spans = RESULT.map((r) => ({ start: r.start, end: r.end }));
  setClip(klip);
}


/* ───────────────── alur render ───────────────── */

let renderTimer = null;
let renderJobId = null;             // id job render aktif, untuk pembatalan
let framingTerakhir = null;   // titik framing yang sedang tampil di preview


/* Yang dibaca ORANG. Untuk label di layar dan baris riwayat. */
function optionValue(id) {
  const o = OPTIONS.find((x) => x.id === id);
  return o ? o.choices[o.active] : "";
}

/* Yang dibaca MESIN. Dipakai saat menyusun permintaan render, supaya tulisan
   di tombol boleh diganti tanpa mengubah apa pun di berkas hasil. */
function optionOut(id) {
  const o = OPTIONS.find((x) => x.id === id);
  return o && o.out ? o.out[o.active] : undefined;
}


/* Render SUNGGUHAN lewat backend.
   Sebelumnya bagian ini cuma menganimasikan progress bar -- tidak ada berkas
   yang pernah dibuat, tapi antrian tetap menulis "selesai" dan menawarkan
   "Open folder". Label yang berbohong lebih buruk daripada fitur yang belum
   ada. Sekarang benar-benar memanggil ffmpeg lewat klipian serve. */


/* Render seluruh Result sebagai satu berkas. Papan kandidat status "approved"
   sudah tidak ada -- yang dirender adalah RESULT (lihat resultAsClip). */
async function startRender() {
  const klip = (typeof resultAsClip === "function") ? resultAsClip() : null;
  if (!klip) return;
  return kirimRender([klip]);
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
    const head = document.querySelector('[data-screen="history"] .note');
    if (head) head.textContent =
      "Klip ini tidak punya titik waktu. Impor ulang dari Claude, atau buat klip manual.";
    toScreen("history");
    return;
  }

  const request = {
    video: chosenSource?.name || DATA.file,
    clips: valid.map((k) => ({
      title: k.title,
      // Potongan dipecah lagi di tiap titik framing, dan masing-masing
      // membawa crop-nya sendiri. Itulah yang membuat framing bisa berpindah
      // di tengah klip.
      spans: (typeof spansWithFraming === "function")
        ? spansWithFraming(k.spans || [{ start: k.startSec, end: k.endSec }])
        : (k.spans || []).map((p) => ({ start: p.start, end: p.end })),
      style: captionStyle(),         // pengaturan layar Caption ikut terkirim
      // Teks yang sudah dibetulkan di layar Teks. Kalau tidak ada koreksi,
      // isinya sama dengan transkrip -- server tetap menerimanya apa adanya.
      words: (typeof kataUntukRender === "function") ? kataUntukRender() : undefined,
      layout: optionOut("format"),
      width: optionOut("resolution"),
    })),
  };

  // Antrian harus sejajar dengan apa yang benar-benar dikirim: server
  // melaporkan hasil per indeks, dan kalau isinya beda barisnya salah tunjuk.
  buildQueue(valid);
  QUEUE.forEach((r) => { r.pct = 0; r.note = "queued"; r.action = "Cancel"; r.act = "cancel"; });
  drawQueue();
  toScreen("history");

  let id;
  try {
    const reply = await fetch("/api/render", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    }).then((r) => r.json());
    if (reply.error) throw new Error(reply.error);
    id = reply.id;
    renderJobId = id;               // dipakai tombol Cancel untuk memberi tahu server
  } catch (err) {
    // Tanpa backend, katakan apa adanya -- jangan pura-pura merender.
    QUEUE.forEach((r) => { r.pct = 0; r.note = "needs klipian serve"; r.action = "Retry"; r.act = "retry"; });
    drawQueue();
    const head = document.querySelector('[data-screen="history"] .note');
    if (head) head.textContent =
      "Rendering needs the backend. Run: python -m klipian serve";
    return;
  }

  clearInterval(renderTimer);
  renderTimer = setInterval(async () => {
    let t;
    try { t = await (await fetch(`/api/render/${id}`)).json(); }
    catch { return; }

    // Server sudah mengonfirmasi pembatalan: hentikan polling, jangan timpa
    // baris jadi "rendering/queued" lagi.
    if (t.state === "cancelled") {
      clearInterval(renderTimer);
      renderJobId = null;
      QUEUE.forEach((r, i) => {
        if (i < t.done) { r.pct = 100; r.note = "done"; r.action = "Open folder"; r.act = "open"; }
        else { r.pct = 0; r.note = "cancelled"; r.action = "Retry"; r.act = "retry"; }
      });
      drawQueue();
      const head = document.querySelector('[data-screen="history"] .note');
      if (head) head.textContent = "Render cancelled.";
      return;
    }

    QUEUE.forEach((r, i) => {
      if (i < t.done) { r.pct = 100; r.note = "done"; r.action = "Open folder"; r.act = "open"; }
      else if (i === t.index && t.state === "running") { r.pct = 55; r.note = "rendering"; r.action = "Cancel"; r.act = "cancel"; }
      else { r.pct = 0; r.note = "queued"; r.action = "Cancel"; r.act = "cancel"; }
    });
    (t.result || []).forEach((h, i) => {
      if (QUEUE[i]) { QUEUE[i].name = h.file; QUEUE[i].url = h.url;
                        QUEUE[i].folder = h.folder; QUEUE[i].mb = h.mb; }
    });
    drawQueue();

    if (t.state !== "running") {
      clearInterval(renderTimer);
      renderJobId = null;
      if (typeof muatRiwayat === "function") muatRiwayat();   // berkas baru masuk riwayat
      const head = document.querySelector('[data-screen="history"] .note');
      if (head) head.textContent = t.state === "failed"
        ? `Failed: ${t.error}`
        : `${t.done} klip selesai · ${(t.result || []).reduce((a, h) => a + h.mb, 0).toFixed(1)} MB`;
    }
  }, 700);
}

/* ───────────────── pratinjau cepat: render sungguhan, dipotong pendek ────
   Beda dari panel 9:16 di atas -- itu tiruan CSS, dan tiruan bisa meleset
   dari hasil ASS/ffmpeg asli (persis yang terjadi pada bug opacity
   watermark). Ini memanggil ffmpeg SUNGGUHAN lewat /api/preview, cuma
   dipotong PREVIEW_MAX_DETIK detik di server supaya tetap "cepat". */
async function previewCepat() {
  const klip = (typeof resultAsClip === "function") ? resultAsClip() : null;
  const btn = $("#previewCepatBtn");
  const note = $("#previewCepatNote");
  if (!klip || !klip.spans?.length) return;

  if (btn) { btn.disabled = true; btn.textContent = "Rendering…"; }
  if (note) note.textContent = "";

  const clip = {
    title: klip.title,
    // Sama seperti kirimRender(): potongan dipecah lagi di tiap titik
    // framing supaya crop yang dipratinjau sungguhan sesuai yang dipilih.
    spans: (typeof spansWithFraming === "function")
      ? spansWithFraming(klip.spans)
      : klip.spans,
    style: captionStyle(),
    words: (typeof kataUntukRender === "function") ? kataUntukRender() : undefined,
    layout: optionOut("format"),
    width: optionOut("resolution"),
  };

  // Klip yang panjang (menit-an) nyaris tidak pernah terwakili oleh 3 detik
  // PERTAMANYA saja -- posisi scrub yang sedang dilihat di panel preview
  // itulah momen yang sebenarnya mau dicek, jadi pratinjau dimulai dari
  // situ, bukan selalu dari awal.
  const posisiSekarang = (video?.src && typeof sourceToOut === "function")
    ? sourceToOut(klip, video.currentTime) : null;
  const mulaiDari = posisiSekarang ?? 0;

  try {
    const reply = await fetch("/api/preview", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ video: chosenSource?.name || DATA.file, clip, mulaiDari }),
    }).then((r) => r.json());
    if (reply.error) throw new Error(reply.error);
    tampilkanPreviewCepat(reply.url);
    // Supaya jelas potongan MANA yang sedang dilihat -- tanpa ini orang
    // bisa kira pratinjau selalu dari awal klip, padahal sekarang ikut
    // posisi scrub (lihat mulaiDari di atas).
    if (note) note.textContent = `previewing ${jamPendek(mulaiDari)}–${jamPendek(mulaiDari + (reply.duration || 0))}`;
  } catch (err) {
    if (note) note.textContent = err.message || "Preview failed.";
  } finally {
    if (btn) { btn.disabled = !RESULT.length; btn.textContent = "Quick preview"; }
  }
}

function tampilkanPreviewCepat(url) {
  const wrap = $("#previewCepatWrap");
  const video = $("#previewCepatVideo");
  if (!wrap || !video) return;
  video.src = url;               // ?t=... di url sudah membuatnya beda tiap kali
  video.play().catch(() => {});  // autoplay boleh ditolak browser -- bukan galat
  wrap.hidden = false;
}

$("#previewCepatBtn")?.addEventListener("click", previewCepat);

$("#previewCepatTutup")?.addEventListener("click", () => {
  const wrap = $("#previewCepatWrap");
  const video = $("#previewCepatVideo");
  if (video) { video.pause(); video.removeAttribute("src"); video.load(); }
  if (wrap) wrap.hidden = true;
});

