/* klipian — framing sepanjang waktu
   ==========================================================================
   Framing bukan lagi "objek orang" yang dipasang per klip. Model itu
   mengandaikan tiap orang duduk di tempat yang tetap, padahal potongan
   podcast sering berganti angle: orang yang sama bisa di kiri sekarang dan
   di tengah semenit kemudian.

   Sekarang framing adalah DAFTAR TITIK di sepanjang video:

       00:00  Single, kotak di tengah
       05:12  Split, kiri di atas kanan di bawah
       07:40  Single, kotak ke kanan

   Aturannya satu kalimat: satu titik berlaku sampai titik berikutnya, dan
   perpindahannya potong keras -- tidak merayap.

   Tiap titik punya FORMAT sendiri:

     single  satu kotak mengisi penuh frame 9:16
     split   dua kotak ditumpuk atas-bawah, masing-masing separuh tinggi,
             untuk momen dua orang duduk berjauhan tapi dua-duanya mau
             kelihatan

   Ukuran kotaknya bebas digeser dan dilebarkan, tapi rasionya TERKUNCI:
   melebarkan kotak ikut menaikkan tingginya. Kotak yang rasionya tidak
   sama dengan petak tujuannya cuma akan bikin gambar gepeng.

   Cara pakainya juga satu kalimat: putar preview ke momen yang kamu mau,
   pilih formatnya, geser kotak ke orangnya, tekan "Kunci framing di sini".

   Kanvasnya menampilkan frame video ASLI pada posisi itu, bukan gambar
   contoh -- kalau tidak, kamu membingkai sesuatu yang tidak kamu lihat.
   ========================================================================== */

const INITIAL_CROP = { left: 37, top: 8, width: 26, height: 84 };

/* Dua kotak berdampingan sebagai titik awal split: kiri jadi bagian atas,
   kanan jadi bagian bawah. Tingginya sudah mengikuti rasio 9:8. */
const INITIAL_SPLIT_CROP = [
  { left: 4,  top: 17, width: 42, height: 66 },
  { left: 54, top: 17, width: 42, height: 66 },
];

/* Tinggi kotak = lebar x rasio, dihitung dalam piksel kanvas.
   single: petak tujuannya 1080x1920 -> 16/9 kali lebarnya.
   split : tiap petak 1080x960      ->  8/9 kali lebarnya. */
const RATIO = { single: 16 / 9, split: 8 / 9 };

let FRAMING = [];          // [{ id, at, format, crops }] terurut menurut `at`
let framingSeq = 0;

const cropEls = () => [...document.querySelectorAll(".canvas .crop")];

/* Format yang sedang tergambar di kanvas. */
let canvasFormat = "single";

/* Titik yang berlaku pada detik tertentu: titik terakhir yang `at`-nya
   tidak melewati detik itu. */
function pointAt(seconds) {
  let result = FRAMING[0] || null;
  for (const f of FRAMING) {
    if (f.at <= seconds + 0.001) result = f;
    else break;
  }
  return result;
}

/* Posisi X hasil interpolasi LINEAR sepanjang lintasan head tracking pada
   detik `t` (relatif ke awal titik, sama seperti satuan `keyframes[].t`).
   Di luar rentang keyframe pertama/terakhir -> dijepit ke ujungnya
   (bukan diekstrapolasi), sama seperti track_head() di facebox.py
   menahan posisi di luar sampel yang benar-benar terukur. */
function interpolatePath(keyframes, t) {
  if (!keyframes?.length) return null;
  if (t <= keyframes[0].t) return keyframes[0].left;
  const last = keyframes[keyframes.length - 1];
  if (t >= last.t) return last.left;
  for (let i = 1; i < keyframes.length; i++) {
    if (t <= keyframes[i].t) {
      const a = keyframes[i - 1], b = keyframes[i];
      const frac = (t - a.t) / (b.t - a.t || 1);
      return a.left + (b.left - a.left) * frac;
    }
  }
  return last.left;
}

/* Bentuk bingkai yang berlaku pada detik itu, selalu lengkap: format dan
   daftar kotaknya. Pemanggil tidak perlu tahu FRAMING kosong atau tidak.

   Kalau titik yang berlaku punya `tracking` (head tracking, OPSIONAL --
   lihat tombol "Track head"), X kotak PERTAMA ditimpa hasil interpolasi
   lintasan -- bukan diam di posisi kotak dasarnya. Cuma format Single
   yang didukung (v1); Y/lebar/tinggi tetap ikut kotak dasar seperti
   biasa, sama seperti aturan "melacak X saja" yang sudah ada di
   facebox.py. */
function frameAt(seconds) {
  const f = pointAt(seconds);
  const format = f ? f.format : "single";
  let crops = f ? f.crops : [INITIAL_CROP];
  if (f?.tracking?.keyframes?.length >= 2 && format === "single") {
    const left = interpolatePath(f.tracking.keyframes, seconds - f.at);
    if (left !== null) crops = [{ ...crops[0], left }];
  }
  // Rasio disamakan DI SINI, bukan cuma saat menggambar. Versi sebelumnya
  // membetulkan kotak di kanvas tapi mengirim angka bawaan yang mentah ke
  // ffmpeg -- preview terlihat benar sementara berkas hasilnya melar.
  return { format, crops: crops.map((c) => matchRatio(c, format)) };
}

/* Posisi pemutaran yang sedang ditinjau, dalam detik SUMBER. */
function reviewTime() {
  const v = $("#videoPreview");
  if (v && v.src && Number.isFinite(v.currentTime)) return v.currentTime;
  if (typeof activeClip !== "undefined" && activeClip?.spans?.length)
    return activeClip.spans[0].start;
  return 0;
}

function resetFraming() {
  FRAMING = [];
  framingSeq = 0;
  FRAMING.push({ id: `f${++framingSeq}`, at: 0, format: "single",
                 crops: [{ ...INITIAL_CROP }] });
  renderFraming();
}

/* ---------- memotong span di batas titik framing ----------
   Inilah yang membuat framing berpindah di tengah klip: satu range dipecah
   jadi beberapa potongan, masing-masing dengan bingkainya sendiri. Mesin
   render menyambungnya lagi jadi satu video.

   Potongan split membawa `crops` (dua kotak); potongan biasa membawa `crop`
   (satu kotak). Server membedakan keduanya lewat nama bidangnya. */
function spansWithFraming(ranges) {
  const out = [];
  for (const r of ranges) {
    const bounds = [r.start];
    for (const f of FRAMING) {
      if (f.at > r.start + 0.05 && f.at < r.end - 0.05) bounds.push(f.at);
    }
    bounds.push(r.end);
    for (let i = 0; i < bounds.length - 1; i++) {
      const b = frameAt(bounds[i]);
      const piece = { start: bounds[i], end: bounds[i + 1] };
      if (b.format === "split" && b.crops.length >= 2) piece.crops = b.crops;
      else piece.crop = b.crops[0];
      // keyframes tersimpan relatif ke AWAL TITIK (f.at), tapi render.py
      // butuhnya relatif ke awal POTONGAN ini (bounds[i]) -- dua-duanya
      // beda kalau titiknya dikunci sebelum awal rentang Result ini
      // sendiri. Digeser + dijepit di sini, sama seperti _geser_tracking()
      // di server.py buat pratinjau cepat yang dipotong dari depan.
      const point = pointAt(bounds[i]);
      if (b.format === "single" && point?.tracking?.keyframes?.length >= 2) {
        const shifted = point.tracking.keyframes
          .map((kf) => ({ t: round3(kf.t - (bounds[i] - point.at)), left: kf.left }))
          .filter((kf) => kf.t >= 0);
        if (shifted.length >= 2) piece.tracking = shifted;
      }
      out.push(piece);
    }
  }
  return out;
}

const round3 = (n) => Math.round(n * 1000) / 1000;

/* ---------- menggambar ---------- */

/* Tinggi kotak diturunkan dari LEBARNYA dan rasio kanvas yang sebenarnya,
   bukan dari angka bawaan. Persentase tinggi untuk kotak berbentuk sama
   berbeda antara sumber 16:9 dan 4:3, dan kotak yang bentuknya meleset dari
   petak tujuannya bikin gambar melar saat di-scale oleh ffmpeg.

   Kalau tingginya jadi melewati tepi bawah, yang dikecilkan lebarnya --
   bukan tingginya dipotong, karena itu justru merusak rasionya. */
function sourceRatio() {
  for (const sel of ["#canvasVideo", "#videoPreview"]) {
    const v = $(sel);
    if (v?.videoWidth && v?.videoHeight) return v.videoWidth / v.videoHeight;
  }
  return 16 / 9;
}

function matchRatio(crop, format) {
  const baseRatio = sourceRatio();
  let width = crop.width;
  let height = width * baseRatio * RATIO[format];
  if (crop.top + height > 100) {
    height = 100 - crop.top;
    width = height / (baseRatio * RATIO[format]);
  }
  return { ...crop, width, height };
}

function applyCrop(el, p) {
  if (!el || !p) return;
  el.style.left = `${p.left}%`;
  el.style.top = `${p.top}%`;
  el.style.width = `${p.width}%`;
  el.style.height = `${p.height}%`;
}

function readCrop(el, canvas) {
  const r = el.getBoundingClientRect();
  const k = canvas.getBoundingClientRect();
  return {
    left: ((r.left - k.left) / k.width) * 100,
    top: ((r.top - k.top) / k.height) * 100,
    width: (r.width / k.width) * 100,
    height: (r.height / k.height) * 100,
  };
}

/* Kanvas framing dan preview adalah SATU posisi video yang sama, ditampilkan
   beberapa kali: kanvas memperlihatkan frame utuh (untuk memilih bingkai),
   preview memperlihatkan hasil sesudah dipotong dan dibingkai. Saat format
   split, petak bawah preview punya video sendiri -- satu elemen <video> tidak
   bisa menampilkan dua potongan berbeda sekaligus.

   Semuanya harus berjalan bersamaan. Dulu kanvas hanya di-seek saat
   renderFraming() kebetulan dipanggil, jadi ia membeku sementara preview
   berjalan -- dan kamu membingkai frame yang bukan frame yang sedang diputar.

   Ambangnya berbeda menurut keadaan: saat dijeda harus persis (kamu sedang
   melangkah per frame), saat berjalan boleh meleset sedikit supaya tidak
   tersendat oleh seek terus-menerus. */

const followTarget = new WeakMap();   // elemen -> posisi tujuan terakhirnya

function followPreview(el) {
  const v = $("#videoPreview");
  if (!el || !v) return;
  if (v.src && el.src !== v.src) el.src = v.src;
  if (!el.src) return;

  // Video yang baru dipasang belum bisa di-seek; permintaan seek ke sana
  // hilang begitu saja dan elemennya tertinggal jauh di belakang preview.
  // Karena itu penyelarasan diulang begitu ia siap.
  if (el.readyState < 1) {
    el.addEventListener("loadedmetadata", () => followPreview(el), { once: true });
    return;
  }
  // Kanvas dikunci ke rasio sumbernya. Tanpa ini rasio kanvas cuma kebetulan
  // hasil tata letak; begitu ia beda dari videonya, object-fit:cover memotong
  // diam-diam dan persen kotak tidak lagi menunjuk bagian frame yang sama.
  if (el.id === "canvasVideo" && el.videoWidth && el.videoHeight) {
    const canvas = document.querySelector(".canvas");
    const ratio = `${el.videoWidth} / ${el.videoHeight}`;
    if (canvas && canvas.style.aspectRatio !== ratio) {
      canvas.style.aspectRatio = ratio;
    }
  }
  const t = v.src ? v.currentTime : reviewTime();
  const threshold = v.paused ? 0.02 : 0.20;

  // Posisi tujuan disimpan, bukan cuma diminta sekali. Kalau lompatan
  // sebelumnya belum rampung, permintaan baru bisa tertelan browser -- dan
  // elemennya berhenti di posisi lama. Dengan tujuan tersimpan, permintaan
  // TERAKHIR yang selalu menang, diterapkan ulang saat lompatan selesai.
  followTarget.set(el, t);
  if (!el.seeking && Math.abs(el.currentTime - t) > threshold) {
    try { el.currentTime = t; } catch { /* di luar jangkauan */ }
  }
  // Ikut berjalan/berhenti bersama preview.
  if (!v.paused && el.paused) el.play().catch(() => {});
  else if (v.paused && !el.paused) el.pause();
}

/* Begitu satu lompatan rampung, posisi tujuan terakhir diterapkan lagi kalau
   ternyata masih meleset. */
function attachCatchUp(el) {
  el?.addEventListener("seeked", () => {
    const v = $("#videoPreview");
    const target = followTarget.get(el);
    if (!v || !v.src || target === undefined) return;
    const threshold = v.paused ? 0.02 : 0.20;
    if (Math.abs(el.currentTime - target) > threshold) {
      try { el.currentTime = target; } catch { /* di luar jangkauan */ }
    }
  });
}
attachCatchUp($("#canvasVideo"));
attachCatchUp($("#videoPreview2"));

function syncCanvasVideo() {
  followPreview($("#canvasVideo"));
  // Video petak bawah hanya perlu ikut saat memang dipakai. Membiarkannya
  // memutar diam-diam saat format single cuma membuang decoder.
  if (canvasFormat === "split") followPreview($("#videoPreview2"));
  else $("#videoPreview2")?.pause();
}

// Dipisah dari renderFraming() supaya bisa dipanggil TIAP tick timeupdate --
// renderFraming() sendiri menggambar ulang seluruh strip thumbnail titik
// (mahal), jadi cuma dipanggil saat titik aktif benar-benar berpindah.
// Tanpa fungsi terpisah ini, label waktu cuma ikut berubah saat playhead
// melewati sebuah titik framing, bukan tiap detik berjalan -- kelihatan
// seperti "membeku" saat diputar padahal cuma jarang digambar ulang.
function updateFramingClock() {
  const clockEl = $("#framingWaktu");
  if (clockEl) clockEl.textContent = `at ${jamRange(reviewTime())}`;
}

/* Strip Framing Points bisa lebih lebar dari panelnya dan di-scroll
   horizontal (banyak titik di video yang panjang). Tanpa ini, titik yang
   jadi aktif saat playback lewat begitu saja bisa ada DI LUAR area yang
   kelihatan -- state-nya sudah benar (fr-active sudah pindah), tapi dari
   mata pengguna kelihatan seperti diam di titik terakhir yang mereka klik
   sendiri, karena yang aktif sekarang tidak pernah masuk ke pandangan. */
function followActivePoint(f) {
  const bar = $("#framingList");
  const el = f && bar?.querySelector(`[data-framing="${f.id}"]`);
  if (!bar || !el) return;
  const target = el.offsetLeft - (bar.clientWidth - el.clientWidth) / 2;
  bar.scrollTo({ left: Math.max(0, target), behavior: "smooth" });
}

function renderFraming() {
  if (!FRAMING.length) resetFraming();
  const t = reviewTime();
  const active = pointAt(t);

  // Pesan TIDAK ditulis di sini: renderFraming dipanggil sesudah aksi seperti
  // "kunci", dan menulisinya akan langsung menghapus konfirmasi yang baru saja
  // muncul. Pemanggil yang menentukan pesannya.
  updateFramingClock();
  const tag = $("#tagCrop1");
  if (tag) tag.textContent = active ? `from ${jamRange(active.at)}` : "";

  const bar = $("#framingList");
  if (bar) {
    // f.at itu posisi di VIDEO SUMBER utuh (00:00 = awal video 42 menit),
    // bukan posisi di hasil gabungan -- begitu Result terdiri dari beberapa
    // span yang saling berjauhan di sumber, titik terlihat "melompat" jauh
    // melewati durasi Result sendiri (mis. "09:44" padahal Result cuma
    // 3:14). Bukan salah -- itu memang posisi aslinya di sumber -- tapi
    // membingungkan tanpa konteks. "out h:mm" di tooltip menunjukkan posisi
    // yang SAMA itu relatif ke hasil gabungan, kalau titiknya jatuh di
    // dalam salah satu span yang benar-benar dipakai (null kalau di luar
    // span mana pun -- titik lama dari klip lain, atau titik 00:00 bawaan).
    const outFrom = (t) => (typeof activeClip !== "undefined" && activeClip?.spans
      && typeof sourceToOut === "function") ? sourceToOut(activeClip, t) : null;

    // Setiap titik SELALU dapat thumbnail-nya sendiri, seberapa pun rapat
    // waktunya dengan tetangganya -- strip-nya sebaris (flex), bukan
    // diposisikan proporsional ke waktu di atas satu bar lebar tetap. Kalau
    // titiknya banyak, striplah yang melebar dan boleh di-scroll horizontal
    // (lihat overflow-x di CSS .framing-timeline) -- BUKAN thumbnail-nya
    // yang dikecilkan atau sebagian titik dijadikan tick tanpa gambar.
    bar.innerHTML = FRAMING.map((f, i) => {
      const out = outFrom(f.at);
      // Angka BESAR = posisi di RESULT yang sedang diedit (yang benar-benar
      // dilihat orang di panel preview kanan) -- itu yang berarti langsung,
      // bukan posisi di video sumber 42 menit. Sumbernya tetap ditampilkan
      // (kecil, di bawahnya) untuk konteks/lompat-balik, bukan dibuang --
      // cuma tidak lagi jadi angka UTAMA supaya tidak disangka posisi di
      // Result (persis kebingungan yang dilaporkan ian: titik "07:58" pada
      // Result yang cuma 1:25 kelihatan seperti di luar jangkauan, padahal
      // itu memang posisi aslinya di sumber, bukan salah).
      const tooltip = `${f.format === "split" ? "Split" : "Single"} · source ${jamRange(f.at)}`;
      const thumbUrl = f.crops?.[0] && typeof chosenSource !== "undefined" && chosenSource?.name
        ? `/api/thumb?video=${encodeURIComponent(chosenSource.name)}&t=${f.at}`
          + `&left=${f.crops[0].left}&top=${f.crops[0].top}`
          + `&width=${f.crops[0].width}&height=${f.crops[0].height}&w=96`
        : "";
      return `
      <div class="fr-point${f === active ? " fr-active" : ""}"
           data-framing="${f.id}" title="${tooltip}">
        ${thumbUrl ? `<img class="fr-thumb" src="${thumbUrl}" alt="" loading="lazy">`
                    : `<span class="fr-thumb fr-thumb-kosong"></span>`}
        ${f.tracking ? `<span class="fr-track-badge" title="Head tracking on">●</span>` : ""}
        <span class="fr-time">${out !== null ? jamRange(out) : "—"}</span>
        <span class="fr-time-src">src ${jamRange(f.at)}</span>
        ${i > 0 ? `<i class="buang" data-buang-framing="${f.id}" role="button"
              aria-label="Delete point ${jamRange(f.at)}">×</i>` : ""}
      </div>`;
    }).join("");
  }

  const frame = frameAt(t);
  drawBox(frame.format, frame.crops);
  syncCanvasVideo();
  if (typeof attachVideoGeometry === "function") attachVideoGeometry();
  updateTrackHeadButton();
}

/* Menaruh kotak di kanvas sesuai format. Kotak kedua hanya berarti saat
   split; di format single ia disembunyikan lewat data-format di kanvas. */
function drawBox(format, crops) {
  canvasFormat = format === "split" ? "split" : "single";
  const canvas = document.querySelector(".canvas");
  if (canvas) canvas.dataset.format = canvasFormat;
  // Preview ikut diberi tahu: petak bawah cuma ada saat split.
  const previewFrame = $("#frame");
  if (previewFrame) previewFrame.dataset.format = canvasFormat;

  const els = cropEls();
  applyCrop(els[0], matchRatio(crops[0] || INITIAL_CROP, canvasFormat));
  // Kotak kedua selalu berasio split -- ia memang cuma dipakai di format itu.
  applyCrop(els[1], matchRatio(crops[1] || INITIAL_SPLIT_CROP[1], "split"));

  document.querySelectorAll("[data-format-pilih]").forEach((b) =>
    b.setAttribute("aria-pressed", String(b.dataset.formatPilih === canvasFormat)));
}

/* Menyalin kotak dari kanvas ke titik yang sedang berlaku. Dipanggil terus
   selama menggeser, bukan cuma saat dilepas: preview menghitung bingkainya
   dari ANGKA di FRAMING, jadi kalau angkanya baru ditulis saat pointer
   dilepas, preview diam saja sepanjang geseran. */
function saveBox() {
  const f = pointAt(reviewTime());
  const crops = boxOnCanvas();
  if (!f || !crops) return null;
  f.format = canvasFormat;
  f.crops = crops;
  return f;
}

/* Kotak yang sedang tergambar di kanvas, dibaca balik jadi angka. */
function boxOnCanvas() {
  const canvas = document.querySelector(".canvas");
  if (!canvas) return null;
  const els = cropEls();
  const n = canvasFormat === "split" ? 2 : 1;
  const out = [];
  for (let i = 0; i < n; i++) {
    if (!els[i]) return null;
    const geo = readCrop(els[i], canvas);
    if (!Number.isFinite(geo.width) || geo.width <= 0) return null;
    out.push(geo);
  }
  return out;
}

/* ---------- memilih format ---------- */

/* Mengganti format LANGSUNG membuat titik di posisi yang sedang ditinjau,
   bukan menyunting titik yang kebetulan sedang berlaku.

   Versi pertama menyunting titik yang berlaku, dan itu menghancurkan
   pekerjaan: kamu menyusun split di 00:00, maju ke 20:55, memilih
   "Single" -- dan Split di 00:00 ikut berubah jadi Single tanpa pesan
   apa pun. Padahal seluruh gunanya titik framing justru supaya format bisa
   BERBEDA di detik yang berbeda.

   Titik di detik yang sama ditimpa, jadi bolak-balik memilih format tidak
   menumpuk titik. */
$("#framingFormat")?.addEventListener("click", (e) => {
  const b = e.target.closest("[data-format-pilih]");
  if (!b) return;
  const format = b.dataset.formatPilih;
  const t = Math.max(0, reviewTime());
  const existing = FRAMING.find((f) => Math.abs(f.at - t) < 0.35);
  if (format === canvasFormat && existing) return;

  // Kotaknya dimulai dari susunan bawaan format itu -- rasio kotak single
  // dan split berbeda, jadi memakai ulang kotak lama cuma menghasilkan
  // gambar gepeng.
  const crops = format === "split"
    ? INITIAL_SPLIT_CROP.map((c) => ({ ...c }))
    : [{ ...INITIAL_CROP }];

  let message;
  if (existing) {
    existing.format = format;
    existing.crops = crops;
    message = `point ${jamRange(existing.at)} is now`;
  } else {
    FRAMING.push({ id: `f${++framingSeq}`, at: t, format, crops });
    FRAMING.sort((a, b2) => a.at - b2.at);
    message = `new point at ${jamRange(t)},`;
  }
  renderFraming();
  $("#reframeNote").textContent = format === "split"
    ? `${message} Split · drag the top and bottom boxes onto each person`
    : `${message} Single · drag the box onto whoever is talking`;
});

/* ---------- kunci, pilih, hapus ---------- */

$("#kunciFraming")?.addEventListener("click", () => {
  const crops = boxOnCanvas() || frameAt(reviewTime()).crops;
  const t = Math.max(0, reviewTime());

  // Titik di detik yang sama ditimpa, bukan digandakan.
  const existing = FRAMING.find((f) => Math.abs(f.at - t) < 0.35);
  let message;
  if (existing) {
    // Kotak dasar diganti manual -- lintasan tracking LAMA (kalau ada)
    // relatif ke posisi kotak yang sekarang sudah tidak berlaku, jadi
    // dibuang di sini, bukan dibiarkan nyangkut memakai posisi basi.
    // "Track head" perlu ditekan ulang kalau titik ini masih mau di-track.
    delete existing.tracking;
    existing.format = canvasFormat;
    existing.crops = crops;
    message = `point ${jamRange(existing.at)} updated`;
  } else {
    FRAMING.push({ id: `f${++framingSeq}`, at: t, format: canvasFormat, crops });
    FRAMING.sort((a, b) => a.at - b.at);
    message = `new point locked at ${jamRange(t)}`;
  }
  renderFraming();
  if (typeof saveProject === "function") saveProject();
  $("#reframeNote").textContent =
    `${message} · ${canvasFormat === "split" ? "Split" : "Single"}`;
});

/* ---------- head tracking (opsional per titik) ----------
   ian: kotak bergerak mengikuti kepala DI DALAM satu titik framing --
   BUKAN pan berkelanjutan lintas video (klipian tetap potong keras ANTAR
   titik, tidak berubah). Opsional per titik, default MATI -- diaktifkan
   manual lewat tombol ini cuma pada titik yang memang perlu (ian: "tidak
   semua titik perlu"). Cuma format Single yang didukung (v1) -- lihat
   catatan di frameAt()/track_head() (facebox.py) untuk alasannya. */

/* Rentang [titik.at, akhir) yang dianalisis -- sampai titik BERIKUTNYA
   kalau ada, atau sampai akhir potongan Result yang memuat titik ini
   kalau ini titik terakhir (bukan sampai akhir video sumber utuh --
   itu bisa jauh lebih panjang dari yang benar-benar dipakai). */
function trackingLimit(point) {
  const idx = FRAMING.indexOf(point);
  const next = FRAMING[idx + 1];
  if (next) return next.at;
  const span = (typeof activeClip !== "undefined" && activeClip?.spans || [])
    .find((s) => point.at >= s.start - 0.05 && point.at < s.end);
  return span ? span.end : point.at;
}

async function trackHeadForPoint(point) {
  if (point.tracking) {
    // Toggle mati -- kembali ke kotak statis, tidak menghapus kotak
    // dasarnya. Reversibel, sesuai permintaan ian.
    delete point.tracking;
    renderFraming();
    if (typeof saveProject === "function") saveProject();
    $("#reframeNote").textContent = `head tracking off for point ${jamRange(point.at)}`;
    return;
  }
  const end = trackingLimit(point);
  if (end - point.at < 0.5) {
    $("#reframeNote").textContent =
      "head tracking needs a longer gap to the next point (or clip end).";
    return;
  }
  const btn = $("#trackHeadBtn");
  if (btn) { btn.disabled = true; btn.textContent = "Tracking…"; }
  $("#reframeNote").textContent = "head tracking: analyzing head movement …";
  try {
    const r = await fetch("/api/headtrack", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        video: chosenSource?.name, start: point.at, end, crop: point.crops[0],
      }),
    });
    const d = await r.json();
    if (!d.keyframes) {
      $("#reframeNote").textContent =
        `head tracking: ${d.error || "not enough tracking data"} — point stays static.`;
      return;
    }
    point.tracking = { keyframes: d.keyframes };
    renderFraming();
    if (typeof saveProject === "function") saveProject();
    $("#reframeNote").textContent = `head tracking on for point ${jamRange(point.at)}`;
  } catch {
    $("#reframeNote").textContent = "head tracking failed — point stays static.";
  } finally {
    if (btn) { btn.disabled = false; }
    updateTrackHeadButton();
  }
}

/* Label/keadaan tombol ikut titik yang SEDANG BERLAKU di posisi preview
   (pointAt(reviewTime()), sama seperti renderFraming() menentukan
   titik aktif untuk kanvas) -- dipanggil dari renderFraming() supaya
   selalu sinkron tanpa perlu dipanggil manual di banyak tempat. */
function updateTrackHeadButton() {
  const btn = $("#trackHeadBtn");
  if (!btn || btn.disabled) return;
  const point = pointAt(reviewTime());
  const canTrack = point && point.format === "single";
  btn.hidden = !canTrack;
  if (!canTrack) return;
  const active = !!point.tracking;
  btn.textContent = active ? "Tracking on" : "Track head";
  btn.setAttribute("aria-pressed", String(active));
  btn.title = active
    ? "Turn off head tracking for this point"
    : "Track head movement for this point only (optional, off by default)";
}

$("#trackHeadBtn")?.addEventListener("click", () => {
  const point = pointAt(reviewTime());
  if (point) trackHeadForPoint(point);
});

$("#framingList")?.addEventListener("click", (e) => {
  const deleteIcon = e.target.closest("[data-buang-framing]");
  if (deleteIcon) {
    e.stopPropagation();
    const id = deleteIcon.dataset.buangFraming;
    if (FRAMING.length <= 1) return;              // titik 00:00 selalu ada
    FRAMING = FRAMING.filter((f) => f.id !== id);
    renderFraming();
    return;
  }
  const chip = e.target.closest("[data-framing]");
  if (!chip) return;
  $("#reframeNote").textContent = "drag the box onto whoever is talking, then lock it";
  // Klik titik = lompat ke detiknya, supaya kelihatan sedang membingkai apa.
  const f = FRAMING.find((x) => x.id === chip.dataset.framing);
  if (!f) return;
  const v = $("#videoPreview");
  if (v && v.src) {
    try { v.currentTime = f.at; } catch { /* di luar jangkauan */ }
  }
  renderFraming();
});

/* ---------- geser & ubah ukuran kotak ---------- */

(function interactiveCrop() {
  const canvas = document.querySelector(".canvas");
  if (!canvas) return;
  let active = null;
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

  canvas.addEventListener("pointerdown", (e) => {
    const crop = e.target.closest(".crop");
    if (!crop) return;
    // Kotak kedua tidak bisa disentuh saat format single: ia memang tidak
    // ikut dirender, jadi menggesernya cuma menyesatkan.
    if (canvasFormat !== "split" && cropEls().indexOf(crop) > 0) return;
    const k = canvas.getBoundingClientRect();
    const c = crop.getBoundingClientRect();
    active = { crop, k, resizing: e.target.tagName === "B",
               dx: e.clientX - c.left, dy: e.clientY - c.top,
               w0: c.width, h0: c.height };
    crop.setPointerCapture(e.pointerId);
    e.preventDefault();
  });

  canvas.addEventListener("pointermove", (e) => {
    if (!active) return;
    const { crop, k } = active;
    if (active.resizing) {
      // Rasio TERKUNCI: tingginya selalu lebar x rasio format. Yang dibatasi
      // lebarnya, bukan tingginya -- kalau tingginya yang dipotong sendiri,
      // kotaknya jadi gepeng dan hasil rendernya ikut gepeng.
      const ratio = RATIO[canvasFormat];
      const box = crop.getBoundingClientRect();
      const maxW = Math.min(k.right - box.left, (k.bottom - box.top) / ratio);
      const w = clamp(e.clientX - box.left, 40, Math.max(40, maxW));
      const h = w * ratio;
      crop.style.width = `${(w / k.width) * 100}%`;
      crop.style.height = `${(h / k.height) * 100}%`;
    } else {
      const x = clamp(e.clientX - k.left - active.dx, 0, k.width - active.w0);
      const y = clamp(e.clientY - k.top - active.dy, 0, k.height - active.h0);
      crop.style.left = `${(x / k.width) * 100}%`;
      crop.style.top = `${(y / k.height) * 100}%`;
    }
    saveBox();
    if (typeof attachVideoGeometry === "function") attachVideoGeometry();
  });

  ["pointerup", "pointercancel"].forEach((ev) =>
    canvas.addEventListener(ev, () => {
      if (!active) return;
      active = null;
      // Geseran langsung menempel ke titik yang sedang berlaku. Kalau kamu
      // mau posisi ini mulai di detik lain, tekan "Kunci framing di sini".
      const f = saveBox() || pointAt(reviewTime());
      $("#reframeNote").textContent = f
        ? `point ${jamRange(f.at)} moved · press Lock to create a new point`
        : "drag the box onto whoever is talking, then lock it";
      if (typeof attachVideoGeometry === "function") attachVideoGeometry();
    }));
})();

/* ---------- AI Framing: giliran bicara -> titik framing otomatis ----------
   Backend (klipian/diarize.py) cuma tahu SIAPA bicara dan KAPAN -- sama
   sekali tidak tahu kotak mana di kanvas yang harus dipakai untuk orang itu.

   Sepenuhnya otomatis, TIDAK ADA konfirmasi manual per pembicara lagi.
   Versi sebelumnya meminta ian menggeser satu kotak ke tiap pembicara yang
   terdeteksi sebelum lanjut -- untuk podcast 2 orang itu 2 klik, tapi ian
   menunjukkan podcast tidak selalu 2 orang, jadi konfirmasi satu-satu jadi
   tidak praktis begitu pembicaranya lebih banyak. Posisi tiap pembicara
   sekarang dicari sendiri lewat locate_speaker() (klipian/facebox.py) --
   BUKAN dibimbing kotak kasar manual seperti fit_crop_to_face/track_crops,
   melainkan mencari dari nol di (hampir) seluruh frame, dibimbing gerak-
   mulut lintas beberapa sampel di giliran bicara itu. Risiko salah-tangkap
   dari pencarian seluas ini (pernah terjadi sebelum facebox.py ditulis
   ulang -- lihat docstring modul itu) ditahan dengan mewajibkan pemenang
   gerak-mulut yang JELAS setiap kali ada >1 wajah, tanpa fallback "paling
   tajam" -- sampel yang ambigu dibuang, bukan ditebak.

   Video sumber sendiri bisa ganti shot di tengah klip (zoom keluar jadi
   close-up, potong ke reaksi orang lain) meski pembicaranya tidak berganti
   -- diarization sama sekali tidak melihat itu, cuma dengar suara. Sinyal
   TERPISAH untuk itu: klipian/scenecut.py mendeteksi potongan visual keras
   lewat filter scene bawaan ffmpeg, dipakai memecah satu giliran bicara
   jadi beberapa titik lacak (lihat aiFramingApply) supaya tiap potongan
   sungguhan dapat titik framing sendiri, bukan cuma titik di awal giliran
   yang lama-lama meleset begitu shot-nya berganti. */

/* Status AI Framing (proses, error, hasil) SELALU muncul di kotak kuning
   #aiFramingTanya, bukan cuma teks kecil di #reframeNote -- itu yang
   ternyata terlewat begitu saja pada percobaan pertama: pesan gagal-validasi
   memang muncul, tapi cuma teks polos berdesakan dengan elemen lain di baris
   judul, kelihatan seperti "tidak terjadi apa-apa". */
function aiFramingStatus(text) {
  const textEl = $("#aiFramingTanyaTeks");
  if (textEl) textEl.textContent = text;
  $("#aiFramingTanya")?.removeAttribute("hidden");
}

/* Ganti isi <span> teks di dalam tombol #aiFramingBtn saja -- BUKAN
   btn.textContent langsung, itu akan ikut menghapus ikon SVG-nya (lihat
   markup di index.html). */
function aiFramingBtnText(text) {
  const el = $("#aiFramingBtnTeks");
  if (el) el.textContent = text;
}

/* Overlay DI ATAS panel preview 9:16, terpisah dari kotak status di
   sidebar (aiFramingStatus) -- server bisa bekerja puluhan detik
   (diarization dkk), tanpa overlay ini preview kelihatan diam begitu
   saja seperti macet, bukan seperti sedang dianalisis.

   Persen dihitung dari BOBOT TETAP per tahap pipeline (diarize/scenecut/
   locate/terapkan), bukan dari "selesai dibagi total" yang totalnya baru
   ketahuan belakangan (jumlah pembicara baru pasti sesudah diarize,
   jumlah segmen baru pasti sesudah locate) -- kalau dihitung begitu,
   angkanya bisa melompat MUNDUR persis saat total itu berubah. Dengan
   bobot tetap, tiap tahap cuma mengisi jatahnya sendiri, jadi batangnya
   selalu maju. */
const AI_FRAMING_WEIGHT = { diarize: 40, scenecut: 10, locate: 30, terapkan: 20 };
const AI_FRAMING_OFFSET = {
  diarize: 0,
  scenecut: AI_FRAMING_WEIGHT.diarize,
  locate: AI_FRAMING_WEIGHT.diarize + AI_FRAMING_WEIGHT.scenecut,
  terapkan: AI_FRAMING_WEIGHT.diarize + AI_FRAMING_WEIGHT.scenecut + AI_FRAMING_WEIGHT.locate,
};

function aiFramingOverlayStart() {
  $("#aiFramingOverlay")?.removeAttribute("hidden");
  aiFramingOverlayProgress("diarize", 0, 1, "Analyzing…");
}

function aiFramingOverlayDone() {
  $("#aiFramingOverlay")?.setAttribute("hidden", "");
}

/* `selesai`/`total` posisi DI DALAM tahap itu saja (mis. span ke berapa
   dari berapa span), bukan lintas seluruh pipeline -- offset tahapnya
   yang menerjemahkan itu ke persen keseluruhan. */
function aiFramingOverlayProgress(stage, done, total, text) {
  const withinStage = total > 0 ? done / total : 0;
  const pct = Math.min(100, Math.round(AI_FRAMING_OFFSET[stage] + withinStage * AI_FRAMING_WEIGHT[stage]));
  const bar = $("#aiFramingOverlayBar");
  const pctEl = $("#aiFramingOverlayPct");
  const textEl = $("#aiFramingOverlayTeks");
  if (bar) bar.style.width = `${pct}%`;
  if (pctEl) pctEl.textContent = `${pct}%`;
  if (textEl && text) textEl.textContent = text;
}

/* Satu permintaan ke server, dibungkus Promise supaya bisa di-`await` di
   dalam loop -- lihat aiFramingStart() untuk alasan loopnya. */
function aiFramingDiarizeOneSpan(span) {
  return fetch("/api/diarize", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ video: chosenSource?.name, start: span.start, end: span.end }),
  })
    .then((r) => r.json())
    .then((d) => {
      if (d.error) throw new Error(d.error);
      return aiFramingPollPromise(d.id);
    });
}

function aiFramingPollPromise(id) {
  return new Promise((resolve, reject) => {
    (function check() {
      fetch(`/api/diarize/${id}`).then((r) => r.json()).then((d) => {
        if (d.state === "running") { setTimeout(check, 1500); return; }
        if (d.state === "failed") { reject(new Error(d.error || "Diarization failed.")); return; }
        resolve(d.turns || []);
      }).catch(reject);
    })();
  });
}

/* Potongan visual keras di satu span -- sinyal TAMBAHAN, bukan wajib.
   Gagal diam-diam (ffmpeg build lama tanpa filter scene, atau apa pun)
   mengembalikan array kosong, bukan melempar -- AI Framing yang sudah
   berhasil dari diarization tidak boleh ikut gagal cuma karena pelengkap
   ini tersandung. */
function aiFramingScenecutOneSpan(span) {
  return fetch("/api/scenecut", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ video: chosenSource?.name, start: span.start, end: span.end }),
  })
    .then((r) => r.json())
    .then((d) => d.cuts || [])
    .catch(() => []);
}

async function aiFramingStart() {
  if (!activeClip || !activeClip.spans?.length) {
    aiFramingStatus("Select or add a clip to Result first.");
    return;
  }
  // Result bisa berupa BEBERAPA span terpisah yang disambung jadi satu MP4
  // (menggabungkan beberapa rekomendasi AI, misalnya). Dulu di sini cuma
  // diambil awal span PERTAMA sampai akhir span TERAKHIR -- untuk Result 4
  // span yang saling berjauhan di video sumber, itu berarti menganalisis
  // SELURUH rentang di antaranya juga, termasuk bagian yang sama sekali
  // tidak ikut ke Result. Lambat, dan menghasilkan titik framing yang
  // bertebaran sampai ke bagian video yang tidak relevan. Sekarang tiap
  // span dianalisis SENDIRI-SENDIRI, cuma rentang aslinya.
  const spans = activeClip.spans;

  const btn = $("#aiFramingBtn");
  if (btn) { btn.disabled = true; aiFramingBtnText("Analyzing …"); }
  aiFramingOverlayStart();

  // Berurutan, BUKAN paralel: semua span berbagi satu model diarization
  // yang sama di server (satu instance dimuat sekali, dipakai lagi supaya
  // tidak menunggu belasan detik memuat ulang tiap kali) -- dua permintaan
  // bersamaan ke model yang sama berisiko baku rebut/hasil kacau.
  const allTurns = [];
  try {
    for (let i = 0; i < spans.length; i++) {
      aiFramingStatus(spans.length > 1
        ? `AI Framing: listening for who's talking … (span ${i + 1}/${spans.length})`
        : "AI Framing: listening for who's talking … (usually 25–35s per clip)");
      aiFramingOverlayProgress("diarize", i, spans.length,
        spans.length > 1 ? `Listening (span ${i + 1}/${spans.length})…` : "Listening for who's talking…");
      const turns = await aiFramingDiarizeOneSpan(spans[i]);
      allTurns.push(...turns);
      aiFramingOverlayProgress("diarize", i + 1, spans.length);
    }
  } catch (err) {
    aiFramingFailed(err.message);
    return;
  }

  // Potongan visual keras di video sumber -- dicari SESUDAH diarization
  // (bukan sekaligus di loop yang sama) supaya kalau ini gagal/lambat tidak
  // ikut mengacaukan pesan progres giliran bicara di atas. Gagal per span
  // diam-diam jadi array kosong (lihat aiFramingScenecutOneSpan) -- ini
  // pelengkap, AI Framing tetap jalan dari diarization saja kalau ini kosong.
  aiFramingStatus(spans.length > 1
    ? "AI Framing: checking for shot changes …"
    : "AI Framing: checking for shot changes … (usually a few seconds)");
  aiFramingOverlayProgress("scenecut", 0, spans.length, "Checking for shot changes…");
  const allCuts = [];
  for (let i = 0; i < spans.length; i++) {
    allCuts.push(...(await aiFramingScenecutOneSpan(spans[i])));
    aiFramingOverlayProgress("scenecut", i + 1, spans.length);
  }

  aiFramingFindAllPositions(allTurns, allCuts);
}

function aiFramingFailed(message) {
  const btn = $("#aiFramingBtn");
  if (btn) { btn.disabled = false; aiFramingBtnText("AI Framing"); }
  aiFramingStatus(`AI Framing failed: ${message}`);
  aiFramingOverlayDone();
}

/* Ukuran kotak KELUARAN buat locate_speaker() -- diambil dari kotak yang
   sedang ada di kanvas (format Single) kalau ada, supaya ukuran yang
   sudah disetel ian sebelumnya (zoom keluar/masuk) ikut dipakai, bukan
   dipatok balik ke ukuran bawaan. Posisinya sendiri (left/top) diabaikan
   di sini -- locate_speaker() yang menentukan posisi dari wajah yang
   ditemukan, bukan dari kotak yang sedang tampil. */
function aiFramingOutputSize() {
  const box = canvasFormat === "single" ? boxOnCanvas() : null;
  const w = box?.[0];
  return {
    width: (w && Number.isFinite(w.width)) ? w.width : INITIAL_CROP.width,
    height: (w && Number.isFinite(w.height)) ? w.height : INITIAL_CROP.height,
  };
}

/* Cari posisi SATU pembicara secara otomatis dari giliran bicara
   pertamanya -- lihat locate_speaker() di klipian/facebox.py. Gagal (tidak
   ada wajah yang lolos syarat gerak-mulut jelas) -> null; pembicara itu
   dilewati sama seperti dulu "Skip this speaker" manual, bukan menjatuhkan
   seluruh AI Framing. */
function aiFramingFindSpeaker(turn, size) {
  return fetch("/api/speakerlocate", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      video: chosenSource?.name, start: turn.start, end: turn.end, size,
    }),
  })
    .then((r) => r.json())
    .then((d) => d.crop || null)
    .catch(() => null);
}

async function aiFramingFindAllPositions(turns, cuts) {
  const btn = $("#aiFramingBtn");

  if (!turns.length) {
    if (btn) { btn.disabled = false; aiFramingBtnText("AI Framing"); }
    aiFramingStatus("AI Framing: no speech detected in this clip.");
    aiFramingOverlayDone();
    return;
  }

  // Giliran PERTAMA tiap pembicara -- posisinya cuma perlu dicari sekali
  // per orang, bukan tiap giliran mereka bicara.
  const firstTurn = new Map();
  for (const t of turns) if (!firstTurn.has(t.speaker)) firstTurn.set(t.speaker, t);
  const speakerList = [...firstTurn.entries()].sort((a, b) => a[1].start - b[1].start);

  const size = aiFramingOutputSize();
  aiFramingStatus(speakerList.length > 1
    ? `AI Framing: locating ${speakerList.length} speakers …`
    : "AI Framing: locating the speaker …");
  aiFramingOverlayProgress("locate", 0, speakerList.length,
    speakerList.length > 1 ? `Locating ${speakerList.length} speakers…` : "Locating the speaker…");

  // Paralel -- tiap pencarian independen (rentang video beda-beda), dan
  // menunggu satu-satu untuk banyak pembicara bisa lama tanpa alasan.
  // Progres tetap ikut per pencarian yang SELESAI (bukan cuma sesudah
  // semuanya beres sekaligus) -- setiap .then() di sini nebeng jalan
  // pencarian aslinya, TIDAK mengubah hasil atau urutan Promise.all.
  let locateDone = 0;
  const results = await Promise.all(
    speakerList.map(([, turn]) => aiFramingFindSpeaker(turn, size).then((r) => {
      locateDone++;
      aiFramingOverlayProgress("locate", locateDone, speakerList.length);
      return r;
    })));

  const positions = {};
  speakerList.forEach(([speaker], i) => { if (results[i]) positions[speaker] = results[i]; });

  if (btn) { btn.disabled = false; aiFramingBtnText("AI Framing"); }

  if (!Object.keys(positions).length) {
    aiFramingStatus("AI Framing: couldn't confidently locate any speaker's face "
      + "(no clear mouth-motion winner) — try again, or set the frame manually.");
    aiFramingOverlayDone();
    return;
  }

  aiFramingApply(turns, positions, cuts);
}

/* Kotak yang sudah dites di sini KASAR, cuma posisi orang secara umum
   (ditandai manual sekali di titik Split acuan) -- meleset dikit dari
   wajah sungguhan itu wajar. Tanpa perbaikan, titik yang dihasilkan AI
   Framing cuma menyalin mentah-mentah koordinat kasar itu ke SELURUH
   segmen, dan kalau geseran awalnya kurang pas, hasilnya bisa menyorot
   kursi kosong -- persis keluhan yang mau diperbaiki. Jadi segmen
   [start, end) yang sudah dipecah aiFramingApply (per giliran bicara,
   atau lebih kecil lagi kalau ada potongan visual di dalamnya) dilacak
   lewat deteksi wajah sungguhan (klipian/facebox.py) untuk MENEMUKAN
   posisi yang benar -- track_crops() sengaja mengembalikan SATU titik per
   panggilan (posisi median dari banyak sampel), bukan memecah sendiri
   lagi berdasar gerak wajah: alasan untuk titik BARU sudah diputuskan di
   sini (giliran/potongan), bukan oleh gerak orang duduk yang wajar.
   Gagal/videonya belum ada -> jatuh ke satu titik kotak kasar. */
async function aiFramingTrackFace(start, end, rough) {
  try {
    const r = await fetch("/api/facetrack", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ video: chosenSource?.name, start, end, crop: rough }),
    });
    const d = await r.json();
    return (d.points && d.points.length) ? d.points : [{ at: start, crop: rough }];
  } catch {
    return [{ at: start, crop: rough }];
  }
}

async function aiFramingApply(turns, positions, cuts) {
  const cutList = (cuts || []).slice().sort((a, b) => a - b);

  // Daftar rencana dulu, baru pelacakan wajahnya dijalankan PARALEL untuk
  // semua giliran -- kalau berurutan, klip dengan banyak giliran bicara
  // (mis. 15 titik) bisa makan belasan detik cuma menunggu satu-satu.
  // Video sumber sering sudah berpindah shot SEBELUM diarization yakin
  // giliran bicara baru resmi mulai (orang barunya kelihatan dulu sesaat
  // sebelum benar-benar bicara) -- t.start yang datang dari audio jadi
  // TELAT dibanding potongan videonya sendiri. Tanpa koreksi ini, hasil
  // render kelihatan berganti frame DUA KALI: sekali dari potongan video
  // sungguhan, sekali lagi (telat) saat framing kita baru menyusul di
  // t.start (laporan nyata dari ian). 2 detik dipilih sebagai jendela
  // toleransi -- cukup untuk selisih audio/visual yang wajar, tidak
  // sampai menyerempet ke giliran SEBELUMNYA yang tidak terkait.
  const START_TOLERANCE = 2;

  // Giliran yang benar-benar perlu titik (pembicara dikenal & baru
  // dibanding giliran sebelumnya) -- dikumpulkan dulu SEBELUM logika
  // potongan supaya "giliran sebelumnya" di bawah selalu berarti giliran
  // yang IKUT DIPAKAI, bukan giliran mentah yang mungkin dilewati.
  const selectedTurns = [];
  let previousSpeaker = null;
  for (const t of turns) {
    const rough = positions[t.speaker];
    if (!rough) continue;                          // pembicara yang dilewati
    if (t.speaker === previousSpeaker) continue; // pembicara sama, tidak perlu titik baru
    previousSpeaker = t.speaker;
    selectedTurns.push({ turn: t, rough });
  }

  // Tahap 1 -- KLAIM: tiap giliran boleh mengambil SATU potongan di jendela
  // toleransi sebelum t.start-nya sebagai awal sebenarnya. Diproses lebih
  // dulu, terpisah dari tahap pemecahan giliran SEBELUMNYA di bawah --
  // supaya potongan yang sebenarnya menandai pergantian ORANG tidak keburu
  // "termakan" jadi pemecah di TENGAH giliran orang lama (kasar/kotak yang
  // salah kalau sampai kejadian).
  const claimedCuts = new Set();
  const turnStarts = selectedTurns.map(({ turn: t }) => {
    const candidate = cutList.find((c) => !claimedCuts.has(c)
      && c >= t.start - START_TOLERANCE && c <= t.start);
    if (candidate !== undefined) claimedCuts.add(candidate);
    return candidate !== undefined ? candidate : t.start;
  });

  // Tahap 2 -- PECAH: video sumber sendiri bisa berganti shot DI TENGAH
  // satu giliran bicara (zoom keluar jadi close-up, potong ke reaksi orang
  // lain) meski micnya masih orang yang sama -- diarization tidak melihat
  // itu sama sekali. Potongan yang jatuh di dalam rentang giliran ini
  // (dan BELUM terklaim giliran berikutnya di tahap 1) memecahnya jadi
  // beberapa titik lacak, supaya tiap potongan sungguhan dapat titik
  // framing sendiri, bukan cuma titik di awal giliran yang lama-lama
  // meleset begitu shot-nya berganti. Akhir giliran ini dijepit ke awal
  // sebenarnya giliran BERIKUTNYA (kalau lebih awal dari t.end sendiri) --
  // tanpa ini, giliran berikutnya yang "mencuri mundur" waktunya lewat
  // klaim di Tahap 1 akan tumpang tindih dengan ekor giliran ini.
  const plan = [];
  let cutsUsed = 0;
  selectedTurns.forEach(({ turn: t, rough }, i) => {
    const actualStart = turnStarts[i];
    const actualEnd = (i + 1 < turnStarts.length)
      ? Math.min(t.end, turnStarts[i + 1]) : t.end;
    const cutsInTurn = cutList.filter((c) => !claimedCuts.has(c)
      && c > actualStart && c < actualEnd);
    let cursor = actualStart;
    for (const boundary of [...cutsInTurn, actualEnd]) {
      plan.push({ at: cursor, end: boundary, rough });
      cursor = boundary;
    }
    cutsUsed += cutsInTurn.length + (actualStart !== t.start ? 1 : 0);
  });

  if (!plan.length) {
    // Bukan kegagalan -- cuma tidak ada giliran yang perlu berganti kotak
    // (misal cuma satu pembicara sepanjang klip). Dulu ini dilaporkan
    // sebagai "0 titik ditambahkan" yang kelihatan seperti error padahal
    // benar begini adanya.
    aiFramingStatus("AI Framing: no switching needed for this clip.");
    aiFramingOverlayDone();
    return;
  }

  aiFramingStatus(
    `AI Framing: tracking ${plan.length} segment${plan.length === 1 ? "" : "s"} onto each face …`);
  aiFramingOverlayProgress("terapkan", 0, plan.length,
    `Tracking ${plan.length} segment${plan.length === 1 ? "" : "s"}…`);
  let applyDone = 0;
  const resultsPerTurn = await Promise.all(
    plan.map((r) => aiFramingTrackFace(r.at, r.end, r.rough).then((result) => {
      applyDone++;
      aiFramingOverlayProgress("terapkan", applyDone, plan.length);
      return result;
    })));

  let added = 0;
  for (const pointList of resultsPerTurn) {
    for (const point of pointList) {
      const crop = { ...point.crop };
      const existing = FRAMING.find((f) => Math.abs(f.at - point.at) < 0.35);
      if (existing) {
        existing.format = "single";
        existing.crops = [crop];
      } else {
        FRAMING.push({ id: `f${++framingSeq}`, at: point.at, format: "single", crops: [crop] });
        added++;
      }
    }
  }
  FRAMING.sort((a, b) => a.at - b.at);
  renderFraming();
  if (typeof saveProject === "function") saveProject();

  aiFramingStatus(
    `AI Framing: ${added} framing point${added === 1 ? "" : "s"} added across `
    + `${plan.length} segment${plan.length === 1 ? "" : "s"}, tracking each speaker's face`
    + (cutsUsed
        ? ` (${cutsUsed} shot change${cutsUsed === 1 ? "" : "s"} detected mid-turn). `
        : ". ")
    + "Review and adjust if needed.");
  aiFramingOverlayDone();
}

$("#aiFramingBtn")?.addEventListener("click", aiFramingStart);

resetFraming();
