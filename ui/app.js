/* klipian — prototipe antarmuka
   Data dipisah dari render supaya struktur ini langsung bisa dipindah ke React:
   tiap fungsi render() di bawah setara satu komponen. */

/* Cegah XSS: escape karakter HTML sebelum di-inject ke innerHTML */
function escapeHTML(s) {
  if (typeof s !== "string") return "";
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

const DATA = {
  gameplay: {
    file: "cadera-gameplay-mlbb.mp4",
    duration: "2:22:46",
    layout: "double",
    candidates: [],
    marks: [],
    cut: { title: "Savage Menit 41, Nol Retreat", in: "41:15.4", out: "41:29.6", dur: "14.3s" },
    words: [
      ["oke",0],["oke",0],["tahan",0],["dulu",0],["jangan",0],["mundur",0],["dulu",0],
      ["dia",0],["udah",0],["tipis",0],["banget",0],["ini",0],["percaya",0],["gua",0],
      ["|",0],
      ["masuk",1],["masuk",1],["masuk",1],["Double",1],["Kill",1],["gas",1],["terus",1],
      ["jangan",1],["back",1],["Triple",1],["Kill",1],["anjir",1],["Savage",1],
      ["nol",1],["retreat",1],["bro",1],["nol",1],["retreat",1],
      ["|",0],
      ["gila",0],["sih",0],["ini",0],["gua",0],["kira",0],["udah",0],["abis",0],
      ["tadi",0],["darahnya",0],["tinggal",0],["seuprit",0],["doang",0],
    ],
    suspect: ["seuprit", "anjir"],
  },

  dialog: {
    file: "radityadika-podcast.mp4",
    duration: "42:03",
    layout: "single",
    candidates: [],
    marks: [],
    cut: { title: "Rugi 300 Juta karena Timing", in: "00:12.4", out: "01:07.1", dur: "54.7s" },
    words: [
      ["dan",0],["ini",0],["yang",0],["jarang",0],["aku",0],["cerita",0],["ke",0],["orang",0],
      ["|",0],
      ["saya",1],["rugi",1],["tiga",1],["ratus",1],["juta",1],["gara-gara",1],["satu",1],
      ["keputusan",1],["dan",1],["orang",1],["selalu",1],["nanya",1],["uangnya",1],["ke",1],
      ["mana",1],["padahal",1],["yang",1],["hilang",1],["itu",1],["bukan",1],["uangnya",1],
      ["tapi",1],["dua",1],["tahun",1],["yang",1],["saya",1],["pakai",1],["buat",1],
      ["percaya",1],["sama",1],["orang",1],["yang",1],["salah",1],
      ["|",0],
      ["time",0],["itu",0],["saya",0],["pikir",0],["kalau",0],["angkanya",0],["large",0],
      ["berarti",0],["seriusnya",0],["juga",0],["large",0],["ternyata",0],["false",0],
      ["begitu",0],["cara",0],["kerjanya",0],
    ],
    suspect: ["gara-gara", "seriusnya"],
  },
};

let QUEUE = [];

/* Antrian render bukan daftar tetap: isinya klip yang benar-benar kamu
   setujui di papan Kandidat, dengan layout mengikuti mode. */
function buildQueue(daftar) {
  const d = DATA[mode];
  const layout = mode === "gameplay" ? "facecam + gameplay" : "wajah di tengah";
  // Tanpa argumen: klip yang disetujui. Dengan argumen: persis klip itu --
  // dipakai tombol render di preview yang hanya mengirim satu klip, supaya
  // baris antrian sejajar dengan hasil yang dilaporkan server.
  const approved = daftar || d.candidates.filter((k) => k.status === "approved");
  QUEUE = approved.map((k) => ({
    // Judulnya dulu, bukan tebakan nama berkas. Aturan judul->nama berkas ada
    // di server (safe_filename); menebaknya lagi di sini pernah menghasilkan
    // nama yang berbeda dari berkas yang benar-benar ditulis. Nama asli
    // menimpanya begitu server melapor.
    name: k.title,
    clip: k,       // dipegang supaya durasinya ikut kalau klipnya dipotong
    layout, dur: `${k.dur}s`,
    pct: 0,
    note: "antre",
    action: "Batalkan",
    folder: "",   // diisi server setelah render selesai
    url: "",
    mb: 0,
  }));
}

/* id dipakai kode, label dibaca manusia. Dulu keduanya satu dan sama, jadi
   mengganti tulisan "Ukuran" ikut mematikan captionValue("ukuran").

   Tiap pilihan punya tiga sisi:
     t    tulisan di tombol
     out  nilai yang DIKIRIM KE RENDER  (ukuran ASS, persen, warna ASS)
     px   nilai untuk preview di layar, yang kotaknya jauh lebih kecil

   Dulu yang ada cuma angka piksel preview, dan angka itu tidak pernah sampai
   ke berkas hasil -- jadi mengubahnya tidak mengubah apa pun.

   Warna ASS berformat &HAABBGGRR& (biru-hijau-merah, kebalikan hex web). */
const CAPTION_OPTIONS = [
  { id: "font", label: "Font", active: 0, choices: [
      { t: "Arial", out: "Arial" },
      { t: "Impact", out: "Impact" },
      { t: "Verdana", out: "Verdana" }] },
  { id: "size", label: "Ukuran", active: 1, choices: [
      { t: "Kecil", out: 64, px: 14 },
      { t: "Sedang", out: 84, px: 17 },
      { t: "Besar", out: 108, px: 22 }] },
  { id: "highlight", label: "Warna sorot", active: 0, choices: [
      { t: "Emas", out: "&H0000D6FF&", css: "#FFD600" },
      { t: "Putih", out: "&H00FFFFFF&", css: "#FFFFFF" },
      { t: "Hijau", out: "&H0076E600&", css: "#00E676" },
      { t: "Merah", out: "&H004040FF&", css: "#FF4040" }] },
  { id: "position", label: "Posisi", active: 1, choices: [
      { t: "Bawah", out: 16, px: 16 },
      { t: "Tengah", out: 24, px: 24 },
      { t: "Atas", out: 34, px: 34 }] },
  { id: "per-line", label: "Kata/baris", active: 1, choices: [
      { t: "2", out: 2 }, { t: "3", out: 3 }, { t: "4", out: 4 }] },
  { id: "outline", label: "Outline", active: 1, choices: [
      { t: "Tanpa", out: 0, px: 0 },
      { t: "Sedang", out: 4, px: 2 },
      { t: "Tebal", out: 8, px: 4 }] },
];

/* Gaya caption yang dikirim ke server. Inilah yang membuat pengaturan di
   layar Caption benar-benar mengubah berkas hasil. */
function captionStyle() {
  const nilai = (id) => {
    const o = CAPTION_OPTIONS.find((x) => x.id === id);
    return o ? o.choices[o.active] : null;
  };
  return {
    font: nilai("font").out,
    size: nilai("size").out,
    highlight: nilai("highlight").out,
    position: nilai("position").out,
    per_line: nilai("per-line").out,
    outline: nilai("outline").out,
  };
}

let mode = "dialog";
const $ = (s) => document.querySelector(s);

/* mm:ss (atau j:mm:ss) dari detik. Dipakai framing, timeline, result, dan
   riwayat -- jadi tempatnya di sini, di berkas yang dimuat paling awal.
   Sebelumnya tinggal di result.js dan framing.js memakainya sebelum sempat
   dideklarasikan, jadi layar Framing melempar galat saat halaman dimuat. */
const jamRange = (d) => {
  const t = Math.max(0, Math.round(d));
  const j = Math.floor(t / 3600);
  const m = String(Math.floor((t % 3600) / 60)).padStart(2, "0");
  const s = String(t % 60).padStart(2, "0");
  return j ? `${j}:${m}:${s}` : `${m}:${s}`;
};


/* ═════════════════════════ mode & navigasi tahap ═════════════════════════
   Mode bukan sekadar tema warna: ia menentukan CARA momen dicari.
   Podcast dicari dari gagasan yang diucapkan; MLBB dari kejadian di dalam
   game. Karena itu mode dipilih lebih dulu, sebelum file dimuat. */

const MODES = [
  { id: "podcast", name: "Podcast", color: "dialog", ready: true,
    sub: "talkshow, wawancara, ceramah",
    looksFor: "Gagasan yang utuh dan menarik, dibaca dari transkrip.",
    badge: "Prioritas" },
  { id: "live-mlbb", name: "Live MLBB", color: "gameplay", ready: true,
    sub: "siaran streamer sendiri",
    looksFor: "Momen bagus dan lucu, dari announcer game plus reaksi streamer.",
    badge: "Prioritas" },
  { id: "restream-mpl", name: "Restream MPL", color: "gameplay", ready: false,
    sub: "nonton bareng siaran resmi",
    looksFor: "Teriakan caster plus reaksi streamer. Fase draft dan iklan dibuang.",
    badge: "Menyusul" },
  { id: "tayangan", name: "Tayangan TV", color: "dialog", ready: false,
    sub: "variety show, komedi",
    looksFor: "Punchline dan momen ngakak, dari transkrip plus tawa.",
    badge: "Menyusul" },
];

/* Hanya opsi yang BENAR-BENAR mengubah berkas hasil.
   Dulu ada tiga lagi -- Jumlah klip, Durasi, Bahasa subtitle -- yang tidak
   pernah dibaca kode mana pun. Kontrol yang berbohong lebih buruk daripada
   kontrol yang tidak ada.

   Jumlah dan panjang klip sekarang kamu tentukan sendiri di layar Edit:
   sebanyak yang kamu masukkan ke result, sepanjang range yang kamu pilih. */
const OPTIONS = [
  { id: "format", label: "Format", choices: ["Wajah 9:16", "Blur 9:16"], active: 0 },
  { id: "resolution", label: "Resolusi", choices: ["720p", "1080p"], active: 1 },
];

const PROJECT = [
  { name: "radityadika-podcast.mp4", mode: "podcast", right: "6 kandidat · 2 disetujui" },
  { name: "cadera-gameplay-mlbb.mp4", mode: "live-mlbb", right: "6 kandidat · 1 disetujui" },
  { name: "bincang-sore-ep14.mp4", mode: "podcast", right: "transkripsi 38% · sisa ~16:06" },
];

let activeMode = MODES[0];

function renderHome() {
  $("#modeGrid").innerHTML = MODES.map((m) => `
    <button class="mode-card" data-mode="${m.id}" data-color="${m.color}" data-ready="${m.ready}">
      <span class="badge-mode">${m.badge}</span>
      <h2>${m.name}</h2>
      <span class="sub">${m.sub}</span>
      <span class="search">${m.looksFor}</span>
    </button>`).join("");

  $("#resume").innerHTML = `<p class="eyebrow">Lanjutkan yang sedang jalan</p>` +
    PROJECT.map((v) => {
      const m = MODES.find((x) => x.id === v.mode);
      return `<button class="resume-row" data-mode="${v.mode}">
        <span class="name">${v.name}</span>
        <span class="sub" style="color:var(--teks-samar);font-size:var(--t-12)">${m.name}</span>
        <span class="right">${v.right} →</span>
      </button>`;
    }).join("");
}

function renderPrepare() {
  $("#prepareTitle").textContent = activeMode.name;
  $("#prepareSub").textContent = activeMode.looksFor;
  $("#options").innerHTML = OPTIONS.map((o) => `
    <div class="option-row" data-option="${o.id}">
      <span class="eyebrow">${o.label}</span>
      <span class="choices">
        ${o.choices.map((p, i) => `<button class="chip"${i === o.active ? ' aria-pressed="true"' : ""}>${p}</button>`).join("")}
      </span>
    </div>`).join("");
  summarizeOptions();
}

function summarizeOptions() {
  const value = OPTIONS.map((o) => o.choices[o.active]);
  $("#optionsSummary").textContent =
    `${value[0]} klip · ${value[1]} · ${value[2]} · ${value[3]} · subtitle ${value[4]}`;
}

function toStage(stage) {
  $("#app").dataset.stage = stage;
  if (stage === "prepare") renderPrepare();
}

function pickMode(id) {
  activeMode = MODES.find((m) => m.id === id) || MODES[0];
  // dua mode MLBB berbagi data contoh yang sama di prototipe ini
  mode = activeMode.color === "gameplay" ? "gameplay" : "dialog";
  const d = DATA[mode];
  $("#app").dataset.mode = mode;
  $("#modeMark").textContent = activeMode.name;
  $("#fileName").textContent = d.file;
  $("#fileDuration").textContent = d.duration;
  drawAll();
}

/* ───────────────────────── ribbon sumber ───────────────────────── */



/* ───────────────────────── daftar ────────────────────────────── */
/* Antrian dipisah jadi dua: susunAntrian() menurunkan isinya dari klip yang
   disetujui, gambarAntrian() menggambar keadaan saat ini. Kalau digabung,
   menekan "Batalkan" akan langsung tertimpa oleh penurunan ulang. */
function drawQueue() {
  const head = document.querySelector('[data-screen="history"] .note');
  if (head) {
    const running = QUEUE.filter((r) => r.pct > 0 && r.pct < 100).length;
    const end = QUEUE.filter((r) => r.pct === 100).length;
    const queued = QUEUE.filter((r) => r.pct === 0).length;
    head.textContent = QUEUE.length
      ? `${running} berjalan · ${queued} antre · ${end} selesai`
      : "belum ada klip yang disetujui";
  }

  $("#queueList").innerHTML = QUEUE.length
    ? QUEUE.map((r) => `
        <div class="row" style="grid-template-columns:1fr auto auto auto auto auto">
          <div class="title">${escapeHTML(r.name)}</div>
          <span class="meta">${r.layout}</span>
          <span class="meta">${r.clip ? r.clip.dur + "s" : r.dur}</span>
          <span class="progress ${r.pct === 100 ? "done" : ""}"><i style="width:${r.pct}%"></i></span>
          <span class="meta">${r.note}</span>
          <button class="btn ${r.pct === 100 ? "main" : ""}"
                  data-action="${r.pct === 100 ? "open" : r.action === "Ulangi" ? "retry" : "cancel"}"
          >${r.action}</button>
        </div>`).join("")
    : `<div class="row" style="grid-template-columns:1fr"><div>
         <div class="title">Belum ada klip yang disetujui</div>
         <div class="sub">Setujui kandidat di papan Kandidat, klipnya muncul di sini.</div>
       </div></div>`;
}

function renderList() {
  // Jangan overwrite ANTRIAN kalau sedang ada render berjalan — data folder
  // dan progress dari server akan hilang kalau susunAntrian() dipanggil ulang.
  if (!QUEUE.length || QUEUE.every((r) => r.pct === 0 && !r.folder)) {
    buildQueue();
  }
  drawQueue();

  $("#captionList").innerHTML = CAPTION_OPTIONS.map((o) => `
    <div class="row" data-caption="${o.id}" style="grid-template-columns:130px 1fr auto">
      <span class="eyebrow">${o.label}</span>
      <span style="display:flex;gap:var(--s2)">
        ${o.choices.map((p, i) => `
          <button class="chip"${i === o.active ? ' aria-pressed="true"' : ""}
                  ${p.css ? `style="--titik:${p.css}"` : ""}
                  data-pilih="${i}">${p.css ? '<i class="titik"></i>' : ""}${p.t}</button>`).join("")}
      </span>
      <span class="meta">${o.choices[o.active].t}</span>
    </div>`).join("");
}

/* ───────────────────────── panel 9:16 ────────────────────────── */

/* Pita durasi ideal berbeda per mode. Satu Savage tidak butuh konteks, jadi
   jauh lebih pendek daripada satu gagasan utuh di podcast. */
const RIBBON_DURATION = {
  gameplay: { ideal: [15, 25], scale: 45, hint: "ideal gameplay 15–25 detik" },
  dialog:   { ideal: [30, 45], scale: 75, hint: "ideal dialog 30–45 detik" },
};

function renderPreview() {
  const d = DATA[mode];
  const f = $("#frame");
  const top = f.querySelector(".field.top");
  const main = f.querySelector(".field.main");
  f.dataset.layout = d.layout;
  // Isi caption TIDAK ditulis di sini lagi. Dulu diisi teks peraga dari
  // DATA[mode].caption, yang tidak ada hubungannya dengan klip yang sedang
  // dilihat. Sekarang drawCaption() mengisinya dari transkrip asli.
  if (typeof drawCaption === "function") drawCaption();

  top.dataset.tag = mode === "gameplay" ? "FACECAM ← CROP 2" : "";
  main.dataset.tag = mode === "gameplay" ? "GAMEPLAY ← CROP 1" : "VIDEO ← CROP";

  document.querySelector(".canvas").style.backgroundImage =
    `url('assets/src-${mode}.jpg')`;

  // Isi bidang preview ditentukan oleh kotak crop, bukan gambar tetap.
  if (typeof refreshPreviewFromCrop === "function") refreshPreviewFromCrop();

  // Yang ditinjau di preview adalah RESULT, bukan kandidat. Papan kandidat
  // dengan status setuju/tolak sudah tidak ada.
  const clip = (typeof activeClip !== "undefined" && activeClip) ? activeClip : null;

  // Belum ada kandidat itu keadaan yang wajar, bukan kesalahan. Tanpa penjaga
  // ini seluruh rantai render berhenti diam-diam dan kartu mode jadi mati.
  if (!clip) {
    $("#clipInfo").innerHTML =
      `<div><div class="eyebrow">Result</div>
        <div class="clip-title" style="color:var(--teks-samar)">masih kosong</div></div>`;
    return;
  }

  const p = RIBBON_DURATION[mode];
  const pct = (v) => Math.min(v / p.scale, 1) * 100;
  const verdict = clip.dur < p.ideal[0] ? "di bawah ideal"
              : clip.dur > p.ideal[1] ? "di atas ideal" : "di dalam pita ideal";

  $("#clipInfo").innerHTML = `
    <div>
      <div class="eyebrow">Result${clip.spans && clip.spans.length > 1
        ? ` &middot; ${clip.spans.length} potongan` : ""}</div>
      <div class="clip-title">${escapeHTML(clip.title)}</div>
    </div>
    <div class="meter">
      <div class="meter-head">
        <span>DURASI</span><span class="meter-value">${clip.dur} detik · ${verdict}</span>
      </div>
      <div class="meter-bar">
        <span class="meter-ideal"
              style="left:${pct(p.ideal[0])}%;right:${100 - pct(p.ideal[1])}%"></span>
        <span class="meter-tick" style="left:${pct(clip.dur)}%"></span>
      </div>
      <div class="meter-foot"><span>0</span><span>${p.hint}</span><span>${p.scale}s</span></div>
    </div>`;
}

/* ───────────────────────── navigasi ──────────────────────────── */
const NO_PREVIEW = ["video", "analysis", "history"];

function toScreen(name) {
  document.querySelectorAll(".screen").forEach((s) =>
    s.classList.toggle("active", s.dataset.screen === name));
  document.querySelectorAll(".tab").forEach((t) => {
    const active = t.dataset.to === name;
    t.setAttribute("aria-selected", String(active));
    t.tabIndex = active ? 0 : -1;   // roving tabindex sesuai pola ARIA tabs
  });

  if (name === "history" && typeof muatRiwayat === "function") muatRiwayat();

  if (name === "edit") {
    if (typeof renderFraming === "function") setTimeout(renderFraming, 0);
    if (typeof renderRecommendations === "function") renderRecommendations();
    if (typeof renderResult === "function") renderResult();
    if (typeof renderTeks === "function") renderTeks();
    if (typeof drawTotalTimeline === "function") drawTotalTimeline();
  }

  const hasPreview = !NO_PREVIEW.includes(name);
  $("#stage").classList.toggle("has-preview", hasPreview);
  $("#preview").style.display = hasPreview ? "" : "none";

  /* Geometri video bergantung pada ukuran kanvas, yang baru ada setelah
     layarnya keluar dari display:none. ResizeObserver ternyata tidak selalu
     menembak pada transisi itu, jadi dipanggil eksplisit: sekali setelah
     tata letak selesai, sekali lagi sebagai jaring pengaman. */
  if (typeof attachVideoGeometry === "function") {
    setTimeout(attachVideoGeometry, 0);
    setTimeout(attachVideoGeometry, 160);
  }
}

/* Layar analisis mengacu ke file yang sedang dibuka. Kalau sudah ada file
   yang dijatuhkan, analisis.js yang menimpanya dengan nama file sungguhan. */
function renderAnalysis() {
  const d = DATA[mode];
  const el = $("#analysisNote");
  if (el) el.textContent = `${d.file} · ${d.duration}`;
}

function drawAll() {
  renderList(); renderAnalysis(); renderPreview();
}

/* ───────────────────────── pasang ────────────────────────────── */
$("#tabs").addEventListener("click", (e) => {
  const t = e.target.closest(".tab");
  if (t) toScreen(t.dataset.to);
});


// Panah kiri/kanan berpindah tab, sesuai ARIA Authoring Practices.
$("#tabs").addEventListener("keydown", (e) => {
  if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
  const all = [...document.querySelectorAll(".tab")];
  const i = all.indexOf(document.activeElement);
  if (i < 0) return;
  const j = (i + (e.key === "ArrowRight" ? 1 : -1) + all.length) % all.length;
  all[j].focus();
  toScreen(all[j].dataset.to);
  e.preventDefault();
});

// Panah kiri/kanan berpindah antar kata di transkrip.
document.addEventListener("keydown", (e) => {
  if (!document.activeElement?.classList.contains("word")) return;
  if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
  const all = [...document.querySelectorAll(".word")];
  const i = all.indexOf(document.activeElement);
  const j = Math.max(0, Math.min(all.length - 1, i + (e.key === "ArrowRight" ? 1 : -1)));
  all[i].tabIndex = -1;
  all[j].tabIndex = 0;
  all[j].focus();
  e.preventDefault();
});

$("#safeBtn").addEventListener("click", (e) => {
  const on = $("#frame").dataset.safe === "on";
  $("#frame").dataset.safe = on ? "off" : "on";
  e.currentTarget.setAttribute("aria-pressed", String(!on));
});

// klik kata → tetapkan in, klik kata kedua → tetapkan out
let anchor = null;
document.addEventListener("click", (e) => {
  const k = e.target.closest(".word");
  if (!k) return;
  const all = [...document.querySelectorAll(".word")];
  const i = all.indexOf(k);
  if (anchor === null) {
    anchor = i;
    all.forEach((w) => w.classList.remove("inside"));
    k.classList.add("inside");
  } else {
    const [a, b] = [Math.min(anchor, i), Math.max(anchor, i)];
    all.forEach((w, j) => w.classList.toggle("inside", j >= a && j <= b));
    anchor = null;
  }
});

$("#modeGrid").addEventListener("click", (e) => {
  const k = e.target.closest(".mode-card");
  if (!k) return;
  pickMode(k.dataset.mode);
  toStage("prepare");
});

$("#resume").addEventListener("click", (e) => {
  const b = e.target.closest(".resume-row");
  if (!b) return;
  pickMode(b.dataset.mode);
  toStage("work");
  toScreen("candidates");
});

$("#backHome").addEventListener("click", () => toStage("home"));
$("#toHome").addEventListener("click", () => toStage("home"));
$("#toMenuBtn").addEventListener("click", () => toStage("home"));
$("#run").addEventListener("click", () => { toStage("work"); toScreen("analysis"); });

$("#options").addEventListener("click", (e) => {
  const c = e.target.closest(".chip");
  if (!c) return;
  const row = c.closest(".option-row");
  const o = OPTIONS.find((x) => x.id === row.dataset.option);
  o.active = [...row.querySelectorAll(".chip")].indexOf(c);
  row.querySelectorAll(".chip").forEach((b, i) =>
    b.setAttribute("aria-pressed", String(i === o.active)));
  summarizeOptions();
});

renderHome();
pickMode("podcast");
toScreen("candidates");
toStage("home");
