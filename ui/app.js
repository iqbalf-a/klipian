/* klipian — prototipe antarmuka
   Data dipisah dari render supaya struktur ini langsung bisa dipindah ke React:
   tiap fungsi render() di bawah setara satu komponen. */

/* Cegah XSS: escape karakter HTML sebelum di-inject ke innerHTML */
function escapeHTML(s) {
  if (typeof s !== "string") return "";
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/* Satu berkas, satu alur. Dulu DATA berkunci mode -- podcast dan MLBB
   punya contoh sendiri-sendiri -- tapi caranya menyusun klip ternyata
   sama saja: jatuhkan berkas, atur bingkai, betulkan teks. Kategori itu
   cuma menambah satu pilihan di depan tanpa mengubah apa pun sesudahnya. */
const DATA = {
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
};

let QUEUE = [];

/* Antrian render bukan daftar tetap: isinya klip yang benar-benar dirender. */
function buildQueue(daftar) {
  // Dulu dipatok "wajah di tengah" apa pun pilihannya, jadi baris riwayat
  // berbohong kalau kamu memilih Blur background.
  const layout = (typeof optionValue === "function") ? optionValue("format") : "Crop";
  // Tanpa argumen: turunkan dari RESULT -- itulah yang benar-benar dirender
  // (satu berkas gabungan, lihat resultAsClip()). Papan kandidat dengan status
  // "approved" sudah tidak ada; memfilter status di sini SELALU kosong dan
  // membuat layar antrian tampak hampa walau render sedang berjalan.
  // Dengan argumen: persis klip itu -- dipakai tombol render di preview yang
  // hanya mengirim satu klip, supaya baris antrian sejajar dengan hasil server.
  let approved = daftar;
  if (!approved) {
    const klip = (typeof resultAsClip === "function") ? resultAsClip() : null;
    approved = klip ? [klip] : [];
  }
  QUEUE = approved.map((k) => ({
    // Judulnya dulu, bukan tebakan nama berkas. Aturan judul->nama berkas ada
    // di server (safe_filename); menebaknya lagi di sini pernah menghasilkan
    // nama yang berbeda dari berkas yang benar-benar ditulis. Nama asli
    // menimpanya begitu server melapor.
    name: k.title,
    clip: k,       // dipegang supaya durasinya ikut kalau klipnya dipotong
    layout, dur: `${k.dur}s`,
    pct: 0,
    note: "queued",
    action: "Cancel", act: "cancel",
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
  { id: "size", label: "Size", active: 1, choices: [
      { t: "Small", out: 64, px: 14 },
      { t: "Medium", out: 84, px: 17 },
      { t: "Large", out: 108, px: 22 }] },
  { id: "highlight", label: "Highlight", active: 0, choices: [
      { t: "Gold", out: "&H0000D6FF&", css: "#FFD600" },
      { t: "White", out: "&H00FFFFFF&", css: "#FFFFFF" },
      { t: "Green", out: "&H0076E600&", css: "#00E676" },
      { t: "Red", out: "&H004040FF&", css: "#FF4040" }] },
  { id: "position", label: "Position", active: 1, choices: [
      { t: "Bottom", out: 16, px: 16 },
      { t: "Middle", out: 24, px: 24 },
      { t: "Top", out: 34, px: 34 }] },
  { id: "per-line", label: "Words per line", active: 1, choices: [
      { t: "2", out: 2 }, { t: "3", out: 3 }, { t: "4", out: 4 }] },
  { id: "outline", label: "Outline", active: 1, choices: [
      { t: "None", out: 0, px: 0 },
      { t: "Medium", out: 4, px: 2 },
      { t: "Thick", out: 8, px: 4 }] },
  { id: "watermark", label: "Watermark", active: 0, choices: [
      { t: "On", out: true },
      { t: "Off", out: false }] },
  // Tidak ada field .px di sini (beda dari opsi ukuran caption di atas) --
  // preview watermark menghitung ukuran layar langsung dari .out (lihat
  // applyCaption() di interactions.js), bukan angka kalibrasi terpisah.
  { id: "watermark-size", label: "Watermark size", active: 1, choices: [
      { t: "Small", out: 22 },
      { t: "Medium", out: 32 },
      { t: "Large", out: 46 }] },
  // Opacity ditulis sebagai alpha ASS (&HAA...) -- 00 = penuh, FF = tak
  // kelihatan sama sekali, KEBALIKAN dari intuisi opacity biasa: makin
  // PUDAR pilihannya, makin BESAR angka alpha-nya. Dua tingkat paling pudar
  // (Ghost, Whisper) ditambah setelah "Faint" bawaan ternyata masih
  // kelihatan cukup terang di layar sungguhan -- bawaannya juga digeser ke
  // "Faint" (bukan lagi "Medium") supaya kondisi baru default-nya lebih
  // pudar dari sebelumnya.
  { id: "watermark-opacity", label: "Watermark opacity", active: 2, choices: [
      { t: "Ghost", out: "D8", css: .15 },
      { t: "Whisper", out: "C0", css: .25 },
      { t: "Faint", out: "A0", css: .37 },
      { t: "Medium", out: "80", css: .5 },
      { t: "Bold", out: "40", css: .75 }] },
  // "Bottom" TIDAK berarti mepet tepi bawah -- posisinya dihitung relatif
  // ke posisi caption yang sedang aktif (lihat marginWatermark() di
  // interactions.js dan fungsi sejenis di build_ass()), supaya watermark
  // selalu jatuh tepat di bawah caption apa pun posisi caption-nya.
  { id: "watermark-position", label: "Watermark position", active: 2, choices: [
      { t: "Top", out: "top" },
      { t: "Middle", out: "middle" },
      { t: "Bottom", out: "bottom" }] },
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
    watermark: nilai("watermark").out,
    watermark_size: nilai("watermark-size").out,
    watermark_opacity: nilai("watermark-opacity").out,
    watermark_position: nilai("watermark-position").out,
  };
}

/* Preset caption/watermark GLOBAL, terpisah dari project. Project menyimpan
   pilihan MILIKNYA sendiri (lihat keadaanProject() di projects.js) supaya
   membuka project lama tidak pernah mengubah gaya yang sudah dirender.
   Tapi project BARU tidak punya apa-apa untuk dipulihkan -- tanpa ini ia
   selalu mulai dari default pabrik, memaksa pilih ulang ukuran/posisi/opacity
   watermark tiap kali video baru dijatuhkan, padahal biasanya orang mau gaya
   yang sama seperti project sebelumnya. */
const KUNCI_PRESET_CAPTION = "klipian:preset-caption";

function simpanPresetCaption() {
  try {
    localStorage.setItem(KUNCI_PRESET_CAPTION,
      JSON.stringify(CAPTION_OPTIONS.map((o) => o.active)));
  } catch { /* privat/penuh -- preset cuma kenyamanan, bukan keharusan */ }
}

/* Dipanggil hanya untuk project BARU (lihat bukaProject/bukaProjectDariBeranda
   di projects.js). Sama seperti pemulihan project di muatProject(): indeks
   dicek batas, karena preset lama bisa berasal dari susunan CAPTION_OPTIONS
   yang sudah berubah jumlah pilihannya. */
function terapkanPresetCaption() {
  let preset;
  try { preset = JSON.parse(localStorage.getItem(KUNCI_PRESET_CAPTION)); }
  catch { return false; }
  if (!Array.isArray(preset)) return false;
  preset.forEach((i, k) => {
    if (CAPTION_OPTIONS[k] && Number.isInteger(i)
        && i >= 0 && i < CAPTION_OPTIONS[k].choices.length) {
      CAPTION_OPTIONS[k].active = i;
    }
  });
  return true;
}

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


/* ═══════════════════════════ navigasi tahap ═══════════════════════════
   Dulu ada tahap Beranda tersendiri untuk memilih mode -- Podcast, Live MLBB,
   Restream MPL, Tayangan TV -- sebelum berkasnya dijatuhkan. Mode itu dibuang:
   apa pun sumbernya, yang dikerjakan sama saja (jatuhkan berkas, atur bingkai,
   betulkan teks), jadi kategorinya cuma satu pilihan tambahan di depan yang
   tidak mengubah apa pun sesudahnya.

   Sisa dua tahap: beranda (jatuhkan berkas) dan kerja. */

const OPTIONS = [
  // Tiga bagian, tiga tugas berbeda:
  //
  //   label   apa yang sedang diputuskan
  //   choices nama pilihannya
  //   hint    APA AKIBATNYA -- satu kalimat, ikut berganti saat dipilih
  //
  // Tanpa hint, barisnya cuma berbunyi "Format: Crop / Blur background" dan
  // tidak menjawab "format apanya?". Label lama "Wajah 9:16 / Blur 9:16" juga
  // salah: tidak ada deteksi wajah di sini, kotaknya ditaruh sendiri. "9:16"
  // memang perlu -- tapi tempatnya di label, bukan diulang di kedua pilihan.
  //
  // `out` memisahkan yang DIBACA MESIN dari yang DIBACA ORANG. Sebelumnya
  // render bercabang lewat optionValue("format").startsWith("Blur") -- artinya
  // mengganti tulisan di tombol diam-diam mengubah layout berkas hasil.
  { id: "format", label: "Fill the 9:16 frame",
    choices: ["Crop", "Blur background"], out: ["face", "blur"], active: 0,
    hint: ["A tall slice of the source video. The left and right edges are cut off.",
           "The whole frame in the middle, with a blurred copy filling the space above and below."] },
  { id: "resolution", label: "Resolution", choices: ["720p", "1080p"],
    out: [720, 1080], active: 1,
    hint: ["720×1280 — smaller file, faster render.",
           "1080×1920 — full size for TikTok, Reels and Shorts."] },
];

function renderPrepare() {
  $("#options").innerHTML = OPTIONS.map((o) => `
    <div class="option-row" data-option="${o.id}">
      <span class="eyebrow">${escapeHTML(o.label)}</span>
      <span class="choices">
        ${o.choices.map((p, i) => `<button class="chip"${i === o.active ? ' aria-pressed="true"' : ""}>${escapeHTML(p)}</button>`).join("")}
      </span>
      <span class="hint">${escapeHTML(o.hint ? o.hint[o.active] : "")}</span>
    </div>`).join("");
  summarizeOptions();
}

/* Keterangan ikut pilihan yang sedang aktif. Ditulis ulang di tempat, bukan
   lewat renderPrepare(), supaya fokus keyboard tidak lepas dari chip yang
   baru saja ditekan. */
function refreshHint(row, o) {
  const el = row.querySelector(".hint");
  if (el && o.hint) el.textContent = o.hint[o.active];
}

/* Ringkasannya diturunkan dari OPTIONS, bukan dari lima slot yang dipatok.
   Versi sebelumnya membaca value[2] sampai value[4] padahal OPTIONS tinggal
   dua, jadi barisnya berbunyi "... undefined · undefined · undefined". */
function summarizeOptions() {
  $("#optionsSummary").textContent =
    OPTIONS.map((o) => o.choices[o.active]).join(" · ");
}

function toStage(stage) {
  $("#app").dataset.stage = stage;
  if (stage === "home") {
    renderPrepare();
    // Daftar project dibaca ulang tiap kembali ke beranda, bukan sekali saat
    // muat: kalau tidak, project yang baru saja dikerjakan tidak muncul.
    if (typeof renderProjects === "function") renderProjects();
  }
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
      ? `${running} running · ${queued} queued · ${end} done`
      : "no clips approved yet";
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
                  data-action="${r.pct === 100 ? "open" : (r.act || "cancel")}"
          >${r.action}</button>
        </div>`).join("")
    : `<div class="row" style="grid-template-columns:1fr"><div>
         <div class="title">No clips approved yet</div>
         <div class="sub">Approve a candidate and it will show up here.</div>
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

/* Panjang klip yang enak ditonton: satu gagasan utuh, bukan potongan kalimat. */
const RIBBON_DURATION = { ideal: [30, 45], scale: 75, hint: "sweet spot 30–45s" };

function renderPreview() {
  const d = DATA;
  const f = $("#frame");
  const top = f.querySelector(".field.top");
  const main = f.querySelector(".field.main");
  f.dataset.layout = d.layout;

  // Yang ditinjau di preview adalah RESULT, bukan kandidat. Papan kandidat
  // dengan status setuju/tolak sudah tidak ada.
  const clip = (typeof activeClip !== "undefined" && activeClip) ? activeClip : null;

  // `frame.dataset.video` dulu diset SEKALI di prepareVideo(), saat berkas
  // baru dijatuhkan -- tidak pernah dievaluasi ulang setelahnya. Akibatnya
  // begitu Result dikosongkan, elemen <video> tetap tampil membeku di frame
  // terakhir yang sempat diputar (video.src-nya memang masih ada), seolah
  // masih ada isi padahal Result sudah kosong. Sekarang ini dievaluasi ulang
  // setiap kali preview digambar, mengikuti ADA/TIDAKNYA klip -- bukan
  // sekadar ada/tidaknya sumber video.
  f.dataset.video = clip ? "true" : "";
  if (!clip && typeof video !== "undefined" && video && !video.paused) {
    // Video yang terus jalan diam-diam di belakang layar tersembunyi cuma
    // membakar CPU tanpa ada yang melihatnya.
    video.pause();
    if (typeof isPlaying !== "undefined") isPlaying = false;
    if (typeof playBtn !== "undefined" && playBtn) playBtn.textContent = "▶";
  }

  // Isi caption TIDAK ditulis di sini lagi. Dulu diisi teks peraga dari
  // DATA.caption, yang tidak ada hubungannya dengan klip yang sedang
  // dilihat. Sekarang drawCaption() mengisinya dari transkrip asli.
  if (typeof drawCaption === "function") drawCaption();

  top.dataset.tag = "";
  main.dataset.tag = "VIDEO ← CROP";

  // Isi bidang preview ditentukan oleh kotak crop, bukan gambar tetap.
  if (typeof refreshPreviewFromCrop === "function") refreshPreviewFromCrop();

  const info = $("#clipInfo");
  if (!info) return;

  // Belum ada klip itu keadaan yang wajar, bukan kesalahan. Tanpa penjaga
  // ini panel LENGTH menyisakan info klip terakhir walau Result dikosongkan.
  if (!clip) {
    info.innerHTML =
      `<div><div class="eyebrow">Result</div>
        <div class="clip-title" style="color:var(--teks-samar)">nothing selected</div></div>`;
    return;
  }

  const p = RIBBON_DURATION;
  const pct = (v) => Math.min(v / p.scale, 1) * 100;
  const verdict = clip.dur < p.ideal[0] ? "under the sweet spot"
              : clip.dur > p.ideal[1] ? "over the sweet spot" : "in the sweet spot";

  info.innerHTML = `
    <div>
      <div class="eyebrow">Result${clip.spans && clip.spans.length > 1
        ? ` &middot; ${clip.spans.length} spans` : ""}</div>
      <div class="clip-title">${escapeHTML(clip.title)}</div>
    </div>
    <div class="meter">
      <div class="meter-head">
        <span>LENGTH</span><span class="meter-value">${clip.dur}s · ${verdict}</span>
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

/* Tiga layar yang menyunting result yang sama. Dipisah jadi menu sendiri
   supaya tiap layar punya satu urusan: Klip memilih potongannya, Framing
   mengatur bingkainya, Teks mengurus kata dan tampilannya. */
const LAYAR_RESULT = ["klip", "framing", "teks"];

/* Layar yang sedang dibuka. Disimpan bersama project supaya "Continue"
   mengembalikanmu ke tempat kamu berhenti -- kalau kamu sedang mengatur
   framing, kembali ke Framing, bukan dilempar ke Clips setiap kali. */
let layarAktif = "klip";

function toScreen(name) {
  layarAktif = name;
  if (typeof simpanProject === "function") simpanProject();
  document.querySelectorAll(".screen").forEach((s) =>
    s.classList.toggle("active", s.dataset.screen === name));
  document.querySelectorAll(".tab").forEach((t) => {
    const active = t.dataset.to === name;
    t.setAttribute("aria-selected", String(active));
    t.tabIndex = active ? 0 : -1;   // roving tabindex sesuai pola ARIA tabs
  });

  if (name === "history" && typeof muatRiwayat === "function") muatRiwayat();

  // Klip, Framing, dan Teks bertiga menyunting result yang SAMA, dan
  // preview-nya menampilkan hasil gabungan ketiganya. Jadi ketiganya digambar
  // ulang di layar mana pun dari ketiga itu -- kalau hanya layar yang sedang
  // dibuka yang digambar, preview memperlihatkan keadaan basi dari layar
  // sebelah. Semuanya menulis daftar pendek, jadi murah.
  if (LAYAR_RESULT.includes(name)) {
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
  // Ukuran watermark preview (lihat applyCaption() di interactions.js) sejak
  // fix terakhir dihitung dari getBoundingClientRect().height milik
  // .frame916 -- masalah yang SAMA seperti geometri video di atas: kalau
  // dipanggil sebelum panel keluar dari display:none, tingginya kebaca 0
  // dan watermark jatuh ke fallback nyaris tak kelihatan. Dipanggil ulang
  // di sini dengan pola yang sama persis.
  if (typeof applyCaption === "function") {
    setTimeout(applyCaption, 0);
    setTimeout(applyCaption, 160);
  }
}

/* Layar analisis mengacu ke file yang sedang dibuka. Kalau sudah ada file
   yang dijatuhkan, analisis.js yang menimpanya dengan nama file sungguhan. */
function renderAnalysis() {
  const d = DATA;
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

// Kembali ke beranda itu keputusan SENGAJA meninggalkan project -- reload
// sesudahnya semestinya tetap di beranda, bukan ditarik balik otomatis ke
// project yang baru saja ditinggalkan.
const keBerandaSengaja = () => {
  if (typeof lupakanSesiAktif === "function") lupakanSesiAktif();
  toStage("home");
};
$("#toHome").addEventListener("click", keBerandaSengaja);
$("#toMenuBtn").addEventListener("click", keBerandaSengaja);
$("#run").addEventListener("click", () => { toStage("work"); toScreen("analysis"); });

$("#options").addEventListener("click", (e) => {
  const c = e.target.closest(".chip");
  if (!c) return;
  const row = c.closest(".option-row");
  const o = OPTIONS.find((x) => x.id === row.dataset.option);
  o.active = [...row.querySelectorAll(".chip")].indexOf(c);
  row.querySelectorAll(".chip").forEach((b, i) =>
    b.setAttribute("aria-pressed", String(i === o.active)));
  refreshHint(row, o);
  if (typeof simpanProject === "function") simpanProject();
  summarizeOptions();
});

$("#fileName").textContent = DATA.file;
$("#fileDuration").textContent = DATA.duration;
drawAll();
toScreen("klip");
toStage("home");
