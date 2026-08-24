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
    caption: ['nol retreat ', 'SAVAGE'],
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
    caption: ['bukan investasi, ', 'INI JUDI'],
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
   mengganti tulisan "Ukuran" ikut mematikan captionValue("ukuran"). */
const CAPTION_OPTIONS = [
  { id: "template", label: "Template", choices: ["Tebal tengah", "Bawah tipis", "Karaoke"], active: 0, value: "Tebal tengah" },
  { id: "font", label: "Font", choices: ["Archivo", "Plex Mono"], active: 0, value: "Archivo" },
  { id: "size", label: "Ukuran", choices: ["15", "17", "21"], active: 1, value: "17 px" },
  { id: "highlight", label: "Highlight", choices: ["highlight", "putih"], active: 0, value: "highlight" },
  { id: "position", label: "Posisi", choices: ["16", "24", "34"], active: 1, value: "24 % dari bawah" },
  { id: "per-line", label: "Kata/baris", choices: ["2", "3", "4"], active: 1, value: "3" },
  { id: "outline", label: "Outline", choices: ["0", "2", "4"], active: 1, value: "2 px" },
];

let mode = "dialog";
const $ = (s) => document.querySelector(s);


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

const OPTIONS = [
  { id: "count",   label: "Jumlah klip",      choices: ["5", "10", "15", "20"], active: 1, unit: "klip" },
  { id: "duration",   label: "Durasi",           choices: ["15s", "30s", "60s", "Auto"], active: 3 },
  { id: "format",   label: "Format",           choices: ["Wajah 9:16", "Blur 9:16", "Split 9:16", "Kotak 1:1"], active: 0 },
  { id: "resolution", label: "Resolusi",         choices: ["720p", "1080p"], active: 1 },
  { id: "subtitle", label: "Bahasa subtitle",  choices: ["Indonesia", "Inggris"], active: 0 },
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
/* Lebar sapuan mengikuti skor: 2px di bawah 6.0, sampai 10px di 9.0+ */
function markWidth(scores) {
  if (scores >= 9) return 10;
  if (scores >= 8) return 8;
  if (scores >= 7) return 6;
  if (scores >= 6) return 4;
  return 2;
}

function renderRibbon() {
  const d = DATA[mode];
  $("#ribbonStrip").innerHTML = d.marks.map((m, i) => `
    <button class="mark" style="left:${m.pos}%; --w:${markWidth(m.scores)}px; --d:${i * 45}ms"
          data-label="${escapeHTML(m.label || "")}"
          ${m.pos < 8 ? 'data-edge="left"' : m.pos > 92 ? 'data-edge="right"' : ""}
          aria-label="Temuan di ${m.pos.toFixed(0)}% durasi, skor ${m.scores}"></button>`).join("");
  $("#ribbonNote").textContent = `${d.marks.length} temuan`;

  // Durasi ribbon harus dari file yang sedang dibuka, bukan angka contoh.
  // Sumber kebenarannya, berurutan: transkrip nyata -> metadata file -> data contoh.
  const totalSec =
    (typeof realTranscript !== "undefined" && realTranscript && realTranscript.duration) ||
    (typeof chosenSource !== "undefined" && chosenSource && chosenSource.duration) ||
    null;
  // Kalau durasinya belum diketahui, tampilkan strip. Menampilkan durasi
  // video contoh di sini pernah membuat header dan ribbon bertabrakan.
  $("#ribbonEnd").textContent =
    Number.isFinite(totalSec) && totalSec > 0
      ? (typeof fmtDuration === "function" ? fmtDuration(totalSec) : String(totalSec))
      : "—";
}

/* ───────────────────────── kandidat ───────────────────── */
function renderBoard() {
  const d = DATA[mode];
  const approved = d.candidates.filter((k) => k.status === "approved").length;
  $("#boardNote").textContent = `${d.candidates.length} kandidat · ${approved} disetujui`;

  if (!d.candidates.length) {
    $("#board").innerHTML = `
      <div class="empty">
        <h2>Belum ada kandidat</h2>
        <p>Ekspor berkas di layar Analisis, kerjakan di Claude, lalu impor
           balasannya. Atau tekan <b>Buat klip manual</b> untuk menentukan
           rentangnya sendiri.</p>
      </div>`;
    return;
  }

  $("#board").innerHTML = d.candidates.map((k, i) => {
    // Number() lagi di sini sebagai jaring pengaman: kandidat juga bisa datang
    // dari candidates.json lama yang tidak lewat importJSON.
    const bar = (name, raw) => {
      const value = Number.isFinite(Number(raw)) ? Number(raw) : 0;
      return `
      <div class="score-row">
        <span>${name}</span>
        <span class="score-bar"><i style="width:${value * 10}%"></i></span>
        <span class="figure">${value.toFixed(1)}</span>
      </div>`;
    };

    // Tiga status, tiga tampilan. Pil "siap render" dan tombol "Setujui"
    // tidak pernah muncul bersamaan -- itu memberi tahu dua hal yang
    // bertentangan tentang keadaan yang sama.
    // data-action, bukan teks tombol: label boleh diganti kapan saja tanpa
    // diam-diam mematikan persetujuan klip.
    const action = k.status === "approved"
      ? `<span class="pill-ready">Siap render</span><button class="btn quiet" data-action="reset">Batalkan</button>`
      : k.status === "rejected"
      ? `<button class="btn" data-action="reset">Kembalikan</button>`
      : `<button class="btn main" data-action="approve">Setujui</button><button class="btn" data-action="reject">Tolak</button>`;

    // Thumbnail diambil dari DETIK KLIPNYA, bukan frame generik: kartu harus
    // menunjukkan wajah orang saat momen itu terjadi supaya bisa dipilih
    // dengan sekali lihat.
    const image = (k.startSec !== undefined && typeof chosenSource !== "undefined"
                    && chosenSource)
      ? `/api/thumb?video=${encodeURIComponent(chosenSource.name)}` +
        `&t=${(k.startSec + 2).toFixed(1)}` +
        (() => {
          const c = typeof currentCrop === "function" ? currentCrop(k) : null;
          return c ? `&left=${c.left.toFixed(1)}&top=${c.top.toFixed(1)}` +
                     `&width=${c.width.toFixed(1)}&height=${c.height.toFixed(1)}` : "";
        })()
      : "";   // tanpa sumber, thumbnail dikosongkan -- lebih jujur daripada
              // menampilkan frame dari video lain

    return `
      <article class="card ${k.status === "approved" ? "picked" : k.status === "rejected" ? "rejected" : ""}">
        <div class="card-media">
          <div class="thumb" style="background-image:url('${image}')"></div>
          <span class="badge">${k.total.toFixed(1)}</span>
        </div>
        <div class="card-body">
          <h2>${escapeHTML(k.title)}</h2>
          <p class="quote"><span class="highlight">${escapeHTML(k.hook)}</span></p>
          <div class="score">
            ${bar("hook", k.scores.hook)}${bar("utuh", k.scores.complete)}${bar("payoff", k.scores.payoff)}
          </div>
        </div>
        <div class="card-foot">
          <span class="time">${escapeHTML(k.in)} · ${k.dur}s</span>
          <span class="actions">${action}</span>
        </div>
      </article>`;
  }).join("");
}

/* ───────────────────────── potong ────────────────────────────── */
function renderCut() {
  const d = DATA[mode];
  if (!d.words || !d.words.length) {
    $("#transcript").innerHTML =
      `<p style="color:var(--teks-samar)">Belum ada klip yang dibuka.
        Pilih kandidat, atau buat klip manual.</p>`;
    $("#wave").innerHTML = "";
    return;
  }
  $("#cutTitle").textContent = d.cut.title;
  $("#cutDur").textContent = d.cut.dur;

  // waveform: tinggi deterministik supaya tampilannya stabil antar-render
  const n = 150;
  let bar = "";
  for (let i = 0; i < n; i++) {
    const inside = i > n * 0.18 && i < n * 0.82;
    const h = 12 + Math.abs(Math.sin(i * 0.7) * 26 + Math.sin(i * 0.19) * 16);
    bar += `<i class="${inside ? "inside" : ""}" style="height:${inside ? h : h * 0.55}%"></i>`;
  }
  $("#wave").innerHTML = bar
    + `<span class="edge-choice" style="left:18%"></span>`
    + `<span class="edge-choice" style="left:82%"></span>`;

  const wordsHTML = d.words.map(([t, inside]) => {
    if (t === "|") return `<button class="gap" aria-label="Buang jeda 0.9 detik">⌫ 0.9s</button>`;
    const suspect = d.suspect.includes(t) ? " suspect" : "";
    // Roving tabindex: hanya satu kata yang masuk urutan Tab; sisanya dijangkau
    // dengan panah kiri/kanan. Membuat 50 kata semuanya tabbable justru
    // menjebak pengguna keyboard.
    return `<span class="word${inside ? " inside" : " outside"}${suspect}" role="button" tabindex="-1">${escapeHTML(t)}</span> `;
  }).join("");
  $("#transcript").innerHTML = wordsHTML;
  const first = $("#transcript .word");
  if (first) first.tabIndex = 0;
}

/* ───────────────────────── daftar ────────────────────────────── */
/* Antrian dipisah jadi dua: susunAntrian() menurunkan isinya dari klip yang
   disetujui, gambarAntrian() menggambar keadaan saat ini. Kalau digabung,
   menekan "Batalkan" akan langsung tertimpa oleh penurunan ulang. */
function drawQueue() {
  const head = document.querySelector('[data-screen="queue"] .note');
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
          <button class="chip"${i === o.active ? ' aria-pressed="true"' : ""}>${p}</button>`).join("")}
      </span>
      <span class="meta">${o.value}</span>
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
  f.querySelector(".cap916").innerHTML = `${escapeHTML(d.caption[0])}<mark>${escapeHTML(d.caption[1])}</mark>`;

  top.dataset.tag = mode === "gameplay" ? "FACECAM ← CROP 2" : "";
  main.dataset.tag = mode === "gameplay" ? "GAMEPLAY ← CROP 1" : "VIDEO ← CROP";

  document.querySelector(".canvas").style.backgroundImage =
    `url('assets/src-${mode}.jpg')`;

  // Isi bidang preview ditentukan oleh kotak crop, bukan gambar tetap.
  if (typeof refreshPreviewFromCrop === "function") refreshPreviewFromCrop();

  const clip = d.candidates.find((k) => k.status === "approved") || d.candidates[0];

  // Belum ada kandidat itu keadaan yang wajar, bukan kesalahan. Tanpa penjaga
  // ini seluruh rantai render berhenti diam-diam dan kartu mode jadi mati.
  if (!clip) {
    $("#clipInfo").innerHTML =
      `<div><div class="eyebrow">Klip terpilih</div>
        <div class="clip-title" style="color:var(--teks-samar)">belum ada</div></div>`;
    return;
  }

  const p = RIBBON_DURATION[mode];
  const pct = (v) => Math.min(v / p.scale, 1) * 100;
  const verdict = clip.dur < p.ideal[0] ? "di bawah ideal"
              : clip.dur > p.ideal[1] ? "di atas ideal" : "di dalam pita ideal";

  $("#clipInfo").innerHTML = `
    <div>
      <div class="eyebrow">Klip terpilih</div>
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
const NO_PREVIEW = ["video", "analysis", "queue"];

function toScreen(name) {
  document.querySelectorAll(".screen").forEach((s) =>
    s.classList.toggle("active", s.dataset.screen === name));
  document.querySelectorAll(".tab").forEach((t) => {
    const active = t.dataset.to === name;
    t.setAttribute("aria-selected", String(active));
    t.tabIndex = active ? 0 : -1;   // roving tabindex sesuai pola ARIA tabs
  });

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
  renderRibbon(); renderBoard(); renderCut();
  renderList(); renderAnalysis(); renderPreview();
  if (typeof renderReframe === "function") renderReframe();
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
