/* klipian — project: menyimpan pekerjaan yang belum selesai
   ==========================================================================
   Sebelum ini klipian tidak menyimpan APA PUN. Muat ulang halaman -- atau
   tutup browser tanpa sengaja -- dan seluruh Result, titik framing, serta
   koreksi teks lenyap. Yang bertahan cuma transkrip di cache/ dan MP4 yang
   sudah terlanjur dirender.

   Sekarang keadaan itu disimpan jadi satu JSON per video di folder projects/,
   bukan di localStorage: ia bertahan walau cache browser dibersihkan, ikut
   kalau kamu ganti browser, dan bisa dilihat serta di-backup sebagai berkas
   biasa -- sama seperti cache/ dan out/.

   Satu video = satu project. Jatuhkan video yang sama, pekerjaannya kembali.

   Penyimpanannya OTOMATIS dan ditunda sesaat. Menyimpan di setiap geseran
   kotak framing berarti puluhan tulisan per detik; menunggu tombol "simpan"
   berarti orang kehilangan pekerjaan justru karena lupa menekannya.
   ========================================================================== */

const SIMPAN_TUNDA = 900;      // ms diam sebelum benar-benar ditulis
let simpanTimer = null;
let simpanTertunda = false;    // true sejak ada perubahan sampai tulisan ke disk selesai
let projectAktif = null;       // nama video yang sedang dikerjakan
let layarTerakhir = "klip";    // layar tempat pekerjaan ditinggalkan

/* Nama layar dari berkas project TIDAK dipercaya begitu saja: berkasnya bisa
   ditulis tangan atau berasal dari versi lama. Nama yang tidak dikenal
   membuat toScreen() mematikan semua layar dan menyisakan area kerja kosong. */
const LAYAR_SAH = ["analysis", "klip", "framing", "teks", "history"];

/* Seluruh keadaan yang layak dilanjutkan nanti. Sengaja TIDAK menyimpan
   transkrip: ia sudah ada di cache/ dan besarnya puluhan ribu kata. */
function keadaanProject() {
  return {
    video: projectAktif,
    title: (typeof $ === "function" && $("#hasilJudul")?.value.trim()) || "",
    result: (typeof RESULT !== "undefined" ? RESULT : []).map((r) => ({
      id: r.id, start: r.start, end: r.end, title: r.title, source: r.source,
    })),
    framing: (typeof FRAMING !== "undefined" ? FRAMING : []).map((f) => ({
      id: f.id, at: f.at, format: f.format, crops: f.crops,
    })),
    corrections: (typeof KOREKSI !== "undefined" ? KOREKSI : {}),
    // Rekomendasi AI (hasil impor JSON dari Claude) TIDAK pernah tersimpan
    // sebelum ini -- membuka lagi project yang sama selalu menampilkan "none
    // yet" walau sudah pernah diimpor, memaksa impor ulang dari awal.
    candidates: (typeof DATA !== "undefined" ? DATA.candidates : []) || [],
    caption: (typeof CAPTION_OPTIONS !== "undefined")
      ? CAPTION_OPTIONS.map((o) => o.active) : [],
    output: (typeof OPTIONS !== "undefined") ? OPTIONS.map((o) => o.active) : [],
    screen: (typeof layarAktif !== "undefined") ? layarAktif : "klip",
  };
}

/* Indikator yang SELALU kelihatan, tidak bergantung pada dialog reload
   bawaan browser -- itu cuma tampil kalau halaman sudah pernah disentuh
   (kebijakan anti-penyalahgunaan Chrome/Firefox, bukan sesuatu yang bisa
   diakali dari kode), jadi tidak bisa diandalkan sendirian. Label ini
   dibaca kapan saja, bukan cuma pas mau menutup halaman. */
function perbaruiStatusSimpan() {
  const el = $("#statusSimpan");
  if (!el) return;
  el.textContent = simpanTertunda ? "Unsaved changes…" : "";
}

/* Benar-benar menulis ke disk SEKARANG, membatalkan jeda yang masih
   berjalan kalau ada. Dipakai baik oleh timer di bawah maupun tombol Save
   manual -- keduanya harus menulis keadaan yang SAMA, jadi cuma satu jalan
   yang benar-benar melakukan fetch-nya. */
async function tulisProjectSekarang() {
  clearTimeout(simpanTimer);
  simpanTimer = null;
  if (!projectAktif) return;
  simpanTertunda = true;
  perbaruiStatusSimpan();
  try {
    await fetch("/api/project", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(keadaanProject()),
    });
  } catch { /* tanpa backend, pekerjaan tetap jalan -- hanya tidak tersimpan */
  } finally {
    simpanTertunda = false;
    perbaruiStatusSimpan();
  }
}

/* Dipanggil dari mana saja yang mengubah pekerjaan. Aman dipanggil beruntun:
   yang benar-benar menulis hanya panggilan terakhir dalam satu jeda diam.
   simpanTertunda dinyalakan SEKARANG (bukan saat timer akhirnya jalan) --
   itulah yang dibaca peringatan "tutup/reload halaman" di bawah supaya
   perubahan yang masih menunggu jeda tidak dikira sudah aman tersimpan. */
function simpanProject() {
  if (!projectAktif) return;
  simpanTertunda = true;
  perbaruiStatusSimpan();
  clearTimeout(simpanTimer);
  simpanTimer = setTimeout(tulisProjectSekarang, SIMPAN_TUNDA);
}

/* Tombol Save manual: sebetulnya tidak perlu (auto-save sudah jalan sendiri
   tiap ada perubahan), tapi disediakan sebagai jaring pengaman tambahan buat
   yang ingin kepastian visual "sudah tersimpan" sebelum menutup halaman. */
$("#saveNowBtn")?.addEventListener("click", async () => {
  const btn = $("#saveNowBtn");
  if (!btn || btn.disabled) return;
  btn.disabled = true;
  btn.textContent = "Saving…";
  await tulisProjectSekarang();
  btn.textContent = "Saved";
  setTimeout(() => { btn.textContent = "Save"; btn.disabled = false; }, 1200);
});

/* Menutup tab, reload, atau navigasi keluar sebelum jeda 900ms selesai
   berarti perubahan terakhir belum tentu sempat tertulis. Browser tidak
   mengizinkan pesan custom di dialog ini lagi (demi keamanan) -- yang
   tampil tetap peringatan bawaannya, tapi itu sudah cukup jadi "alert". */
window.addEventListener("beforeunload", (e) => {
  if (!simpanTertunda) return;
  e.preventDefault();
  e.returnValue = "";
});

/* Memasang kembali keadaan yang tersimpan. Mengembalikan true kalau ada
   yang dipulihkan, supaya pemanggil bisa memberi tahu penggunanya. */
async function muatProject(video) {
  projectAktif = video;
  let d;
  try {
    const r = await fetch(`/api/project?video=${encodeURIComponent(video)}`);
    if (!r.ok) return false;
    d = await r.json();
  } catch { return false; }
  if (!d || d.error) return false;

  if (Array.isArray(d.result) && typeof RESULT !== "undefined") {
    RESULT = d.result;
    // resultSeq harus melewati id tertinggi yang dipulihkan, kalau tidak
    // potongan berikutnya memakai id yang sudah dipakai dan saling menimpa.
    if (typeof resultSeq !== "undefined") {
      const n = Math.max(0, ...RESULT.map((r) => parseInt(String(r.id).slice(1), 10) || 0));
      resultSeq = n;
    }
  }
  if (Array.isArray(d.framing) && d.framing.length && typeof FRAMING !== "undefined") {
    FRAMING = d.framing;
    if (typeof framingSeq !== "undefined") {
      const n = Math.max(0, ...FRAMING.map((f) => parseInt(String(f.id).slice(1), 10) || 0));
      framingSeq = n;
    }
  }
  if (d.corrections && typeof KOREKSI !== "undefined") KOREKSI = d.corrections;
  if (Array.isArray(d.candidates) && typeof DATA !== "undefined") {
    DATA.candidates = d.candidates;
    DATA.marks = d.candidates.map((k) => ({
      pos: (typeof realTranscript !== "undefined" && realTranscript?.duration)
        ? (k.startSec / realTranscript.duration) * 100 : 0,
      scores: k.total,
      // title bisa tidak ada di JSON tangan/versi lama -- jangan .split() null.
      label: (k.title || "").split(" ").slice(0, 3).join(" "),
    }));
  }
  // Indeks active harus dicek batas: berkas project bisa ditulis tangan atau
  // dari versi lama dengan jumlah pilihan berbeda. Indeks di luar batas akan
  // membuat choices[active] undefined dan menjatuhkan render caption.
  if (Array.isArray(d.caption) && typeof CAPTION_OPTIONS !== "undefined") {
    d.caption.forEach((i, k) => {
      if (CAPTION_OPTIONS[k] && Number.isInteger(i)
          && i >= 0 && i < CAPTION_OPTIONS[k].choices.length) {
        CAPTION_OPTIONS[k].active = i;
      }
    });
  }
  if (Array.isArray(d.output) && typeof OPTIONS !== "undefined") {
    d.output.forEach((i, k) => {
      if (OPTIONS[k] && Number.isInteger(i)
          && i >= 0 && i < OPTIONS[k].choices.length) {
        OPTIONS[k].active = i;
      }
    });
  }
  if (d.title && $("#hasilJudul")) $("#hasilJudul").value = d.title;
  layarTerakhir = LAYAR_SAH.includes(d.screen) ? d.screen : "klip";
  return true;
}

/* Video baru dijatuhkan: kalau ia punya project, lanjutkan; kalau tidak,
   mulai dari kosong dengan nama itu sebagai kunci. */
async function bukaProject(video) {
  const adaLama = await muatProject(video);
  if (!adaLama) {
    // Project baru: tidak ada apa pun untuk dipulihkan, jadi pakai gaya
    // caption/watermark terakhir dipakai (lihat terapkanPresetCaption() di
    // app.js) alih-alih default pabrik. Panel caption sudah sempat digambar
    // dengan default SEBELUM titik ini (lihat acceptFile() di
    // interactions.js), jadi harus digambar ulang di sini juga -- kalau
    // tidak, tombol yang tersorot di layar tidak sesuai gaya yang sungguhan
    // dipakai.
    if (typeof terapkanPresetCaption === "function" && terapkanPresetCaption()) {
      if (typeof renderList === "function") renderList();
      if (typeof applyCaption === "function") applyCaption();
    }
    simpanProject();          // catat sebagai project baru
  }
  if (typeof ingatSesiAktif === "function") ingatSesiAktif(video);
  return adaLama;
}

/* ---------- daftar di beranda ---------- */

/* Perhatikan namanya: `w` itu LEBAR KELUARAN sampul, sedangkan `width` itu
   lebar CROP dalam persen frame sumber. Tertukar sekali dan ffmpeg menolak
   crop 220% -- sampulnya gagal tanpa satu pun pesan di layar. */
function urlSampul(p) {
  const BAWAAN = { left: 37, top: 4, width: 26, height: 92 };
  let c = p.crop || BAWAAN;
  // Tinggi kotak framing diturunkan saat DIBACA (samakanRasio), jadi angka
  // yang tersimpan bisa saja nol atau tidak masuk akal. ffmpeg tetap menurut
  // dan memberi sampul setinggi 2 piksel -- gagal yang tidak berbunyi apa-apa.
  const sah = Number.isFinite(c.width) && c.width > 1
           && Number.isFinite(c.height) && c.height > 1
           && c.left >= 0 && c.top >= 0
           && c.left + c.width <= 101 && c.top + c.height <= 101;
  if (!sah) c = BAWAAN;
  const q = new URLSearchParams({
    video: p.video, t: String(p.thumbAt ?? 0),
    left: String(Math.round(c.left)), top: String(Math.round(c.top)),
    width: String(Math.round(c.width)), height: String(Math.round(c.height)),
    w: "220",
  });
  return `/api/thumb?${q}`;
}

let _renderProjectsInflight = null;
async function renderProjects() {
  // Dipanggil dari dua tempat saat load awal (self-invoke di bawah + hook
  // toStage("home") di app.js). Tanpa penjaga ini keduanya fetch /api/projects
  // dan menulis #projectList berbarengan. Satu panggilan yang sedang jalan
  // dibagikan ke pemanggil berikutnya, bukan diulang.
  if (_renderProjectsInflight) return _renderProjectsInflight;
  _renderProjectsInflight = (async () => {
  const wadah = $("#projectList");
  if (!wadah) return;
  let item = [];
  try {
    const d = await (await fetch("/api/projects")).json();
    item = d.project || [];
  } catch {
    // Tanpa backend tidak ada project sama sekali -- sembunyikan, jangan
    // biarkan bagian kosong menggantung di beranda.
    wadah.innerHTML = "";
    wadah.closest(".recent")?.setAttribute("hidden", "");
    return;
  }
  // Video yang tidak terjangkau server tidak bisa dilanjutkan sungguhan:
  // transkripsi, thumbnail, dan render semuanya lewat _find_video(), yang
  // hanya melihat samples/, akar project, dan out/. Ditandai di kartunya,
  // bukan dibiarkan gagal diam-diam setelah diklik.
  let tersedia = null;
  try {
    tersedia = new Set((await (await fetch("/api/video")).json()).video || []);
  } catch { tersedia = null; }

  const bagian = wadah.closest(".recent");
  if (!item.length) {
    // Isinya ikut dikosongkan, bukan cuma bagiannya disembunyikan: kartu basi
    // yang tertinggal akan berkelebat kalau bagian ini ditampilkan lagi nanti.
    wadah.innerHTML = "";
    bagian?.setAttribute("hidden", "");
    return;
  }
  bagian?.removeAttribute("hidden");

  // Penandanya menempel pada project TERSEDIA yang terbaru, bukan pada kartu
  // pertama. Kalau yang terbaru kebetulan videonya hilang, penandanya lenyap
  // sama sekali -- padahal "yang mana tadi" justru pertanyaan yang dijawabnya.
  const iTerakhir = item.findIndex((p) => !(tersedia && !tersedia.has(p.video)));

  wadah.innerHTML = item.map((p, i) => {
    const hilang = tersedia && !tersedia.has(p.video);
    // div, BUKAN button: kartunya berisi tombol Keep dan Delete, dan tombol
    // di dalam tombol adalah HTML yang tidak sah -- browser mengeluarkannya
    // dari induknya dan tata letaknya berantakan.
    return `
    <div class="project-card${hilang ? " hilang" : ""}" data-project="${escapeHTML(p.video)}"
         role="button" tabindex="0"${hilang ? ' aria-disabled="true"' : ""}>
      ${hilang
        ? '<span class="project-thumb kosong"></span>'
        : `<img class="project-thumb" alt="" loading="lazy" src="${urlSampul(p)}">`}
      ${i === iTerakhir ? '<span class="tanda-terakhir">last opened</span>' : ""}
      <span class="project-nama">${escapeHTML(p.title || p.video)}</span>
      <span class="data project-meta">${hilang
        ? "video not in samples/"
        : `${p.spans} span${p.spans === 1 ? "" : "s"} · ${Math.round(p.seconds)}s · ${kapan(p.at)}`}</span>
      <i class="buang" data-hapus-project="${escapeHTML(p.video)}" role="button"
         aria-label="Delete project ${escapeHTML(p.video)}">×</i>
      <span class="konfirmasi">
        <span class="tanya-teks">Delete this project?</span>
        <span class="tanya-sub">Spans, framing and caption fixes are lost.
          Rendered files stay in out/.</span>
        <span class="tanya-aksi">
          <button class="btn" data-hapus-batal type="button">Keep</button>
          <button class="btn bahaya" data-hapus-ya="${escapeHTML(p.video)}"
                  type="button">Delete</button>
        </span>
      </span>
    </div>`;
  }).join("");
  })();
  try { return await _renderProjectsInflight; }
  finally { _renderProjectsInflight = null; }
}

/* ---------- menghapus, dengan konfirmasi ----------
   Kartu ini memegang pekerjaan yang tidak bisa dibuat ulang: rentang yang
   dipilih, titik framing, dan tiap kata yang dibetulkan. Sekali klik langsung
   hilang adalah cara paling gampang kehilangan semua itu karena salah pencet.

   Konfirmasinya dua tombol di dalam kartunya sendiri, bukan confirm() bawaan
   browser: yang bawaan memblokir seluruh halaman dan tidak bisa menyebutkan
   APA yang hilang. Ia mundur sendiri sesudah beberapa detik didiamkan, jadi
   kartu tidak tertinggal dalam keadaan menunggu.

   Yang dihapus HANYA berkas project. MP4 di out/ dan transkrip di cache/
   tidak ikut -- itu disebut di pesannya supaya tidak ada yang mengira
   berkas hasilnya ikut lenyap. */

let tanyaTimer = null;

function batalTanya() {
  clearTimeout(tanyaTimer);
  document.querySelectorAll(".project-card.tanya")
    .forEach((k) => k.classList.remove("tanya"));
}

async function hapusProject(video) {
  try {
    await fetch("/api/project", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ video, delete: true }),
    });
  } catch { /* tanpa backend tidak ada yang bisa dihapus */ }
  if (projectAktif === video) {
    projectAktif = null;   // jangan menulisnya lagi
    lupakanSesiAktif();    // reload sesudah ini jangan coba masuk ke project yang baru dihapus
  }
  renderProjects();
}

$("#projectList")?.addEventListener("click", async (e) => {
  // --- minta konfirmasi ---
  const hapus = e.target.closest("[data-hapus-project]");
  if (hapus) {
    e.stopPropagation();
    const kartu = hapus.closest(".project-card");
    batalTanya();
    kartu.classList.add("tanya");
    // Mundur sendiri: kartu yang ditinggalkan dalam keadaan bertanya akan
    // terpencet tanpa sengaja jauh setelah niatnya sudah lewat.
    tanyaTimer = setTimeout(batalTanya, 6000);
    return;
  }

  const ya = e.target.closest("[data-hapus-ya]");
  if (ya) {
    e.stopPropagation();
    batalTanya();
    await hapusProject(ya.dataset.hapusYa);
    return;
  }

  if (e.target.closest("[data-hapus-batal]")) {
    e.stopPropagation();
    batalTanya();
    return;
  }

  const kartu = e.target.closest("[data-project]");
  if (!kartu) return;
  // Kartu yang sedang bertanya tidak boleh sekaligus membuka project:
  // menekan di sekitarnya untuk membatalkan malah melompat ke editor.
  if (kartu.classList.contains("tanya")) { batalTanya(); return; }
  const video = kartu.dataset.project;
  if (kartu.classList.contains("hilang")) {
    const meta = kartu.querySelector(".project-meta");
    if (meta) meta.textContent = `move ${video} into samples/ to continue`;
    return;
  }
  await bukaProjectDariBeranda(video);
});

/* Satu jalur untuk "masuk ke project ini dan lanjutkan mengedit" -- dipakai
   klik kartu di beranda MAUPUN pemulihan otomatis saat halaman di-reload
   (lihat pulihkanSesiTerakhir()). Dulu logika ini cuma ada di dalam
   listener klik; disalin ulang di dua tempat gampang meleset kalau salah
   satu diubah belakangan. */
let _bukaProjectGen = 0;
async function bukaProjectDariBeranda(video) {
  // Klik cepat / tumpang dengan pemulihan sesi: tandai generasi. Kalau ada
  // pembukaan baru menyusul, yang lama berhenti sebelum menimpa state global
  // (chosenSource/realTranscript/RESULT/FRAMING) milik yang menang.
  const gen = ++_bukaProjectGen;
  // Blob URL dari file yang tadi di-drop tidak pernah dilepas kalau kita
  // langsung menimpanya dengan URL /samples/ -- lepaskan dulu.
  if (typeof chosenSource !== "undefined" && chosenSource
      && typeof chosenSource.url === "string" && chosenSource.url.startsWith("blob:")) {
    URL.revokeObjectURL(chosenSource.url);
  }
  // Berkasnya diambil dari samples/, bukan dari dialog berkas -- project
  // menyimpan NAMA, dan browser tidak boleh membuka path sendiri.
  chosenSource = { kind: "file", name: video, url: `/samples/${encodeURIComponent(video)}` };
  if (typeof realTranscript !== "undefined" && typeof findTranscript === "function") {
    const tr = await findTranscript(video);
    if (gen !== _bukaProjectGen) return false;   // sudah didahului pembukaan lain
    realTranscript = tr;
  }
  const ada = await muatProject(video);
  if (gen !== _bukaProjectGen) return false;
  // Jalur ini biasanya hanya membuka project yang SUDAH ada (kartu beranda
  // dan pemulihan sesi keduanya berasal dari project yang sudah tercatat),
  // tapi dijaga sama seperti bukaProject() kalau kelak dipanggil untuk video
  // yang belum pernah dibuka.
  if (!ada) {
    if (typeof terapkanPresetCaption === "function" && terapkanPresetCaption()) {
      if (typeof renderList === "function") renderList();
      if (typeof applyCaption === "function") applyCaption();
    }
  }
  if (typeof prepareVideo === "function") prepareVideo();
  if (typeof drawSource === "function") drawSource();
  if (typeof renderRecommendations === "function") renderRecommendations();
  if (typeof drawTotalTimeline === "function") drawTotalTimeline();
  ingatSesiAktif(video);
  toStage("work");
  toScreen(layarTerakhir);
  return ada;
}

/* ---------- tetap di layar yang sama setelah reload ----------
   Sebelumnya reload SELALU kembali ke beranda drop-video, walau tadi
   sedang di tengah mengedit klip -- project SENDIRI sudah tersimpan
   otomatis, tapi "sedang membuka project yang mana" cuma hidup di memori
   tab yang sekarang, hilang begitu di-reload. localStorage bertahan lewat
   reload (beda dari variabel biasa), jadi cukup buat menyimpan PENUNJUK
   video mana yang sedang dibuka -- bukan project-nya sendiri, yang tetap
   di berkas seperti sebelumnya. */
const KUNCI_SESI = "klipian:sesi-aktif";

function ingatSesiAktif(video) {
  try { localStorage.setItem(KUNCI_SESI, video); } catch { /* privat/penuh -- lupakan saja */ }
}

function lupakanSesiAktif() {
  try { localStorage.removeItem(KUNCI_SESI); } catch { /* sama */ }
}

/* Dipanggil sekali saat halaman dimuat. Balik true kalau berhasil masuk
   lagi ke project terakhir -- pemanggil TIDAK perlu jatuh ke toStage("home")
   kalau ini sukses. */
async function pulihkanSesiTerakhir() {
  let video;
  try { video = localStorage.getItem(KUNCI_SESI); } catch { return false; }
  if (!video) return false;

  // Video-nya mungkin sudah dipindah/dihapus sejak terakhir dibuka --
  // diperiksa dulu lewat /api/video, bukan langsung dicoba lalu gagal
  // diam-diam di tengah proses muat.
  try {
    const daftar = (await (await fetch("/api/video")).json()).video || [];
    if (!daftar.includes(video)) { lupakanSesiAktif(); return false; }
  } catch {
    return false;   // server belum siap/offline -- jangan pura-pura berhasil
  }

  const ada = await bukaProjectDariBeranda(video);
  if (!ada) { lupakanSesiAktif(); return false; }  // video ada tapi project-nya sendiri hilang
  return true;
}

/* Kartu sudah bukan <button>, jadi Enter dan Spasi tidak lagi gratis.
   Tanpa ini kartunya bisa difokus tapi tidak bisa dijalankan dari papan
   ketik sama sekali. */
$("#projectList")?.addEventListener("keydown", (e) => {
  if (e.key !== "Enter" && e.key !== " ") return;
  const kartu = e.target.closest?.(".project-card");
  if (!kartu) return;
  e.preventDefault();
  kartu.click();
});

/* Menyalakan diri sendiri. app.js menjalankan toStage("home") di akhir
   berkasnya sendiri -- jauh sebelum berkas ini sempat dimuat -- jadi hook di
   sana belum melihat renderProjects() saat halaman pertama kali dibuka.
   Modul yang bergantung pada urutan muat adalah modul yang menunggu untuk
   putus; ia mengurus permulaannya sendiri. */
renderProjects();

/* Sama alasannya: toStage("home") di app.js sudah keburu jalan sebelum
   berkas ini dimuat, jadi "coba lanjutkan project terakhir" juga diurus di
   sini, bukan di sana. Beranda sempat kelihatan sekilas dulu (wajar --
   memeriksa /api/video dan memuat project itu proses async), lalu ditimpa
   toStage("work") begitu pulihkanSesiTerakhir() selesai kalau memang ada
   yang bisa dilanjutkan. */
pulihkanSesiTerakhir();
