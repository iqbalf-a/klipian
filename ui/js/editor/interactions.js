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

/* Nama & durasi di topbar (#fileName/#fileDuration) -- SATU tempat,
   dipanggil dari kedua jalur video "jadi aktif": acceptFile() di sini
   (video baru dijatuhkan) dan openProjectFromHome() di projects.js
   (project lama dibuka lagi lewat kartu beranda/pemulihan sesi). Sebelum
   ini keduanya CUMA diisi oleh startAnalysis() (analysis.js), yang CUMA
   jalan lewat tombol "Find clips" di beranda -- membuka project lama
   tidak pernah memicunya, jadi topbar tetap menampilkan nama & durasi
   PLACEHOLDER contoh dari app.js (radityadika-podcast.mp4, 42:03)
   SELAMANYA, bukan cuma sesaat, sampai sebuah video BARU dijatuhkan. */
function updateTopbarFile(name, durationSeconds) {
  if ($("#fileName")) $("#fileName").textContent = name || "";
  if ($("#fileDuration")) {
    $("#fileDuration").textContent = Number.isFinite(durationSeconds) ? fmtDuration(durationSeconds) : "";
  }
}

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
    drawSource("That file is not a video. Use mp4, mkv, mov, or webm.");
    return;
  }
  // Revoc blob URL sebelumnya supaya tidak memory leak
  if (chosenSource && chosenSource.url && chosenSource.url.startsWith("blob:")) {
    URL.revokeObjectURL(chosenSource.url);
  }
  const meta = await readMeta(file);
  const changed = chosenSource && chosenSource.name !== file.name;
  chosenSource = { kind: "file", name: file.name, size: file.size, ...meta };
  updateTopbarFile(chosenSource.name, chosenSource.duration);
  $("#urlInput").value = "";
  drawSource();

  // Video baru = orang di frame juga lain, jadi daftar objek dikosongkan dan
  // dimulai lagi dari "Orang 1". resetProjectState() (projects.js) juga
  // mengosongkan SAVED_RESULTS jadi satu Result baru -- Result video
  // sebelumnya tidak boleh ikut terbawa ke video ini.
  if (changed && typeof resetProjectState === "function") resetProjectState();

  // Video baru = sesi baru. Tanpa ini, kandidat dan ribbon dari file
  // sebelumnya ikut terbawa dan angkanya bertabrakan di layar.
  if (changed || DATA.candidates.length) {
    DATA.candidates = [];
    DATA.marks = [];
    DATA.words = [];
    if (typeof realTranscript !== "undefined") realTranscript = null;
    renderList();
    if (typeof renderRecommendations === "function") renderRecommendations();
  }
  if (typeof prepareVideo === "function") {
    prepareVideo();
    setClip(DATA.candidates[0]);
  }

  // Berkas dari luar workspace/samples/ hanya dapat URL blob: preview jalan,
  // tapi transkripsi, thumbnail, dan render semuanya lewat _find_video() di
  // server dan akan menjawab "video not found". Diberitahukan SEKARANG, bukan
  // setelah menunggu transkripsi yang memang tidak akan pernah berhasil.
  try {
    const available = (await (await fetch("/api/video")).json()).video || [];
    if (!available.includes(file.name)) {
      drawSource(null, "not in workspace/samples/ — move it there to transcribe and render");
      document.querySelector(".source-drop")?.setAttribute("data-state", "warn");
    }
  } catch { /* tanpa backend, tidak ada yang bisa diperiksa */ }

  // Video yang sama = project yang sama. Kalau pernah dikerjakan, Result,
  // titik framing, dan koreksi teksnya kembali; kalau belum, ini jadi
  // project barunya.
  if (typeof openProject === "function") {
    const resumed = await openProject(file.name);
    if (resumed) {
      if (typeof renderResult === "function") renderResult();
      if (typeof renderFraming === "function") renderFraming();
      if (typeof renderCaptions === "function") renderCaptions();
      if (typeof renderRecommendations === "function") renderRecommendations();
      if (typeof drawTotalTimeline === "function") drawTotalTimeline();
      drawSource(null, "picked up where you left off");
    }
  }
}

function acceptURL(text) {
  const matched = text.match(YT_PATTERN);
  if (matched) {
    chosenSource = { kind: "youtube", name: `youtu.be/${matched[1]}`, id: matched[1] };
    drawSource();
  } else {
    chosenSource = null;
    drawSource(text.trim() ? "That link is not a YouTube address we recognise." : null);
  }
}

function drawSource(error, extraNote) {
  const box = document.querySelector(".source-drop");
  const button = $("#run");
  if (!box || !button) return;

  // Format dan Resolusi tidak berarti apa-apa sebelum ada videonya, dan
  // sebagai panel penuh ia mendorong daftar project keluar layar di jendela
  // pendek -- persis saat daftar itu paling dibutuhkan.
  const hasSource = !!chosenSource && !error;
  $("#options")?.toggleAttribute("hidden", !hasSource);
  $("#prepareFoot")?.toggleAttribute("hidden", !hasSource);
  const title = box.querySelector("h2");
  const note = box.querySelector("p");

  if (error) {
    box.dataset.state = "error";
    title.textContent = "Can't use this";
    note.textContent = error;
    button.disabled = true;
  } else if (!chosenSource) {
    box.dataset.state = "";
    title.textContent = "Drag a video here";
    note.textContent = "mp4, mkv, mov — or";
    button.disabled = true;
  } else {
    const s = chosenSource;
    box.dataset.state = "ready";
    title.textContent = s.name;
    // Project lama dibuka lewat kartu beranda/pemulihan sesi: chosenSource
    // di jalur itu cuma {kind,name,url} -- TIDAK ada size/duration/width
    // sungguhan (bukan hasil readMeta() dari <video>, sumbernya cuma nama
    // dari catatan project). Dulu ketiganya dipaksa ditampilkan (fmtSize/
    // fmtDuration dipanggil ke undefined) dan hasilnya "NaN MB · durasi
    // tidak terbaca" -- sekarang bagian yang memang tidak diketahui
    // dilewati, bukan ditampilkan rusak. Durasi masih bisa didapat dari
    // transkrip yang sudah pernah dibuat untuk video ini, kalau ada.
    let details;
    if (s.kind === "file") {
      const parts = [];
      if (Number.isFinite(s.size)) parts.push(fmtSize(s.size));
      const duration = Number.isFinite(s.duration) ? s.duration
        : (typeof realTranscript !== "undefined" ? realTranscript?.duration : undefined);
      if (Number.isFinite(duration)) parts.push(fmtDuration(duration));
      if (s.width) parts.push(`${s.width}×${s.height}`);
      details = parts.length ? parts.join(" · ") : "resuming this project";
    } else {
      details = "the video will be downloaded when the pipeline runs";
    }
    // Catatan tambahan dipakai saat project lama dipulihkan, supaya orang tahu
    // pekerjaannya kembali dan tidak mengira harus mulai dari nol lagi.
    note.textContent = extraNote ? `${details} · ${extraNote}` : details;
    button.disabled = false;
  }
}

document.addEventListener("click", (e) => {
  if (e.target.closest(".source-actions .btn")) fileInput.click();
});
fileInput.addEventListener("change", () => acceptFile(fileInput.files[0]));
$("#urlInput").addEventListener("input", (e) => acceptURL(e.target.value));

/* Tarik-lepas hanya di PANEL drop, bukan sepanjang jendela.
   Dulu ada tirai yang menutupi seluruh layar begitu berkas ditarik masuk.
   Niatnya supaya tidak ada tempat yang meleset, tapi hasilnya seluruh
   antarmuka tertutup untuk sebuah sasaran yang sebenarnya cuma satu kotak --
   dan kotak itu sudah punya keadaan sorotnya sendiri, yang justru tidak
   pernah kelihatan karena tertutup tirai.

   Penjaga di tingkat jendela tetap ada, tapi ia TIDAK menggambar apa pun:
   tugasnya cuma membatalkan perilaku bawaan browser. Tanpa itu, berkas yang
   dijatuhkan meleset dari panel akan DIBUKA oleh browser -- aplikasinya
   ditinggalkan begitu saja beserta seluruh hasil kerja yang belum dirender. */

const hasFiles = (e) => [...((e.dataTransfer && e.dataTransfer.types) || [])].includes("Files");

["dragenter", "dragover", "drop"].forEach((ev) =>
  window.addEventListener(ev, (e) => { if (hasFiles(e)) e.preventDefault(); }));

const dropPanel = document.querySelector(".source-drop");
if (dropPanel) {
  // Penghitung, bukan satu bendera: dragleave ikut menembak setiap kali
  // pointer melintasi anak-anak di dalam panel, jadi sorotannya berkedip.
  let dragCount = 0;
  const highlight = (on) => {
    if (on) dropPanel.dataset.drag = "true";
    else delete dropPanel.dataset.drag;
  };

  dropPanel.addEventListener("dragenter", (e) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    dragCount++;
    highlight(true);
  });

  dropPanel.addEventListener("dragover", (e) => {
    if (!hasFiles(e)) return;
    e.preventDefault();                    // wajib, kalau tidak drop diabaikan
    e.dataTransfer.dropEffect = "copy";
  });

  dropPanel.addEventListener("dragleave", (e) => {
    if (!hasFiles(e)) return;
    dragCount = Math.max(0, dragCount - 1);
    if (dragCount === 0) highlight(false);
  });

  dropPanel.addEventListener("drop", (e) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    e.stopPropagation();
    dragCount = 0;
    highlight(false);
    acceptFile(e.dataTransfer.files[0]);
  });
}

/* ───────────────── kandidat: setujui, tolak, batalkan ────────────────── */


/* ───────────────── ribbon: klik sapuan membuka klipnya ───────────────── */


/* ───────────────── caption: opsi mengubah preview seketika ───────────── */

/* Mengembalikan OBJEK pilihan yang sedang aktif: { t, out, px?, css? }.
   Preview memakai .px (kotaknya kecil), render memakai .out. */
function captionValue(id) {
  const o = CAPTION_OPTIONS.find((x) => x.id === id);
  return o ? o.choices[o.active] : null;
}

// PlayResY di render SELALU out_width*16/9 dibulatkan genap -- 1920 untuk
// resolusi bawaan (1080p, lihat OPTIONS di app.js). SEMUA ukuran piksel di
// preview (font caption, outline, font watermark) dihitung PROPORSIONAL
// terhadap ini, bukan angka kalibrasi ".px" terpisah seperti sebelumnya --
// nilai tetap itu cuma "kelihatan pas" di SATU ukuran jendela/kombinasi
// tertentu, dan meleset di kombinasi lain: preview tampil wajar tapi hasil
// render sungguhan beda ukuran (laporan ian, untuk watermark MAUPUN
// caption -- keduanya bug yang sama, cuma elemen berbeda).
const PLAYRES_Y_DEFAULT = 1920;
const pxFromOut = (out, frameH) => (out / PLAYRES_Y_DEFAULT) * frameH;

function applyCaption() {
  const cap = document.querySelector(".cap916");
  const frame = document.querySelector(".frame916");
  if (!cap) return;

  const frameH = frame ? frame.getBoundingClientRect().height : 0;
  // Kalau panel masih display:none (skrip baru dimuat, belum pindah ke
  // layar kerja) atau belum diberi ukuran akhir oleh browser, rect-nya 0 --
  // lebih aman DIAMKAN dulu (toScreen() di app.js memanggil ulang
  // applyCaption() begitu panel benar-benar tampil, dan ResizeObserver di
  // bawah menangkap perubahan ukuran sesudahnya) daripada menulis ukuran
  // nyaris nol yang tersangkut sampai ada pemicu lain.
  if (frameH > 0) {
    cap.style.fontSize = `${pxFromOut(captionValue("size").out, frameH)}px`;
    const thicknessPx = pxFromOut(captionValue("outline").out, frameH);
    cap.style.webkitTextStroke = thicknessPx ? `${thicknessPx * 0.5}px rgba(0,0,0,.85)` : "";
  }
  cap.style.bottom = `${captionValue("position").px}%`;
  cap.style.fontFamily = captionValue("font").out;
  // warna dipasang sebagai variabel di wadahnya supaya kata yang disorot
  // ikut berubah walau isinya digambar ulang tiap timeupdate
  cap.style.setProperty("--highlight", captionValue("highlight").css);

  if (frame) frame.dataset.watermark = captionValue("watermark").out ? "on" : "off";

  const wm = document.querySelector(".watermark916");
  if (wm && frame) {
    const sizeOut = captionValue("watermark-size").out;
    const opacity = captionValue("watermark-opacity").css;
    const position = captionValue("watermark-position").out;
    if (frameH > 0) wm.style.fontSize = `${pxFromOut(sizeOut, frameH)}px`;
    // opacity CSS di ELEMEN-nya, BUKAN rgba() di warna teks -- rgba() cuma
    // memudarkan isi hurufnya, sedangkan text-shadow di bawahnya (lihat
    // .watermark916 di app.css) tetap gelap solid. Hasilnya kelihatan
    // abu-abu kotor di opacity rendah (isi nyaris tak kelihatan, bayangan
    // gelapnya masih penuh), bukan putih pudar bersih. opacity elemen
    // memudarkan KEDUANYA sekaligus, sama seperti alpha OutlineColour yang
    // kini disamakan dengan PrimaryColour di build_ass() -- dua sisi
    // (preview dan render) sekarang benar-benar konsisten.
    wm.style.color = "#fff";
    wm.style.opacity = opacity;

    // Sama persis logikanya dengan _watermark_placement() di
    // klipian/render.py -- tinggi baris diperkirakan 1.3x ukuran font,
    // sebagai PERSEN dari PLAYRES_Y_DEFAULT (persis seperti render membagi
    // dengan H). Tidak lagi bergantung frameH di sini -- persennya sama
    // di ukuran layar berapa pun, cuma font-size dalam px di atas yang
    // perlu tahu frameH sungguhan.
    const lineHeightPercent = (sizeOut * 1.3 / PLAYRES_Y_DEFAULT) * 100;

    wm.style.top = "auto";
    wm.style.bottom = "auto";
    wm.style.transform = "none";
    if (position === "top") {
      wm.style.top = `${Math.max(0, 16 - lineHeightPercent)}%`;
    } else if (position === "middle") {
      wm.style.top = "50%";
      wm.style.transform = "translateY(-50%)";
    } else {
      // Dua syarat sekaligus, sama seperti _watermark_placement() versi
      // "bottom" di render.py: di bawah caption, TAPI tidak boleh sampai
      // masuk zona aman (bottom:20% di CSS .safe) -- min() dari keduanya.
      const capMargin = captionValue("position").px;
      const belowCaption = Math.max(2, capMargin - lineHeightPercent - 1);
      const safeZoneLimit = Math.max(0, 20 - lineHeightPercent);
      wm.style.bottom = `${Math.min(belowCaption, safeZoneLimit)}%`;
    }
  }
}

// Font-size caption & watermark di atas dalam PX ABSOLUT (lewat
// pxFromOut()), dihitung sekali tiap applyCaption() dipanggil -- beda dari
// posisi (top/bottom pakai %, yang otomatis mengikuti ukuran wadahnya tanpa
// perlu dihitung ulang). Kalau .frame916 berubah ukuran SESUDAH
// applyCaption() terakhir jalan (jendela di-resize, panel Claude di sebelah
// dibuka/ditutup, dsb.), px yang tersimpan jadi basi -- tetap segitu
// padahal frame-nya sudah beda tinggi. ResizeObserver menangkap perubahan
// itu dan menghitung ulang.
const frame916ResizeObserver = new ResizeObserver(() => {
  if (typeof applyCaption === "function") applyCaption();
});
const _frame916 = document.querySelector(".frame916");
if (_frame916) frame916ResizeObserver.observe(_frame916);

$("#captionList").addEventListener("click", (e) => {
  const c = e.target.closest(".chip");
  if (!c) return;
  const row = c.closest(".row");
  const o = CAPTION_OPTIONS.find((x) => x.id === row.dataset.caption);
  if (!o) return;
  const all = [...row.querySelectorAll(".chip")];
  o.active = Number(c.dataset.pilih ?? all.indexOf(c));
  all.forEach((b, i) => b.setAttribute("aria-pressed", String(i === o.active)));
  row.querySelector(".meta").textContent = o.choices[o.active].t;
  applyCaption();
  if (typeof saveProject === "function") saveProject();
  if (typeof simpanPresetCaption === "function") simpanPresetCaption();
});

/* ───────────────── potong: klik jeda membuang celahnya ──────────────── */


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
    if (!r.folder) { b.textContent = "folder not ready"; setTimeout(drawQueue, 2000); return; }
    fetch("/api/open-folder", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ folder: r.folder }),
    }).then((x) => x.json()).then((j) => {
      if (j.error) { b.textContent = j.error.slice(0, 24); setTimeout(drawQueue, 2500); }
    }).catch(() => { b.textContent = "needs klipian serve"; setTimeout(drawQueue, 2500); });
    return;
  }
  // `act` yang dibaca mesin, `action` yang dibaca orang. Dulu cabangnya
  // membandingkan LABEL tombol, jadi menerjemahkan label memutus tombolnya.
  if (action === "cancel") {
    // Beri tahu server supaya ffmpeg yang sedang berjalan benar-benar
    // dihentikan -- dulu Cancel cuma kosmetik dan job jalan terus di server.
    r.note = "cancelling…";
    drawQueue();
    if (typeof renderJobId !== "undefined" && renderJobId) {
      fetch("/api/render/cancel", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: renderJobId }),
      }).catch(() => { /* poll akan menampilkan keadaan sebenarnya */ });
    }
    // Status akhir ("cancelled") datang dari poll begitu server mengonfirmasi.
  } else if (action === "retry") {
    // Retry menjalankan ulang render Result dari awal.
    if (typeof startRender === "function") startRender();
  }
});

drawSource();
applyCaption();
