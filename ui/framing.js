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

const CROP_AWAL = { left: 37, top: 8, width: 26, height: 84 };

/* Dua kotak berdampingan sebagai titik awal split: kiri jadi bagian atas,
   kanan jadi bagian bawah. Tingginya sudah mengikuti rasio 9:8. */
const CROP_SPLIT_AWAL = [
  { left: 4,  top: 17, width: 42, height: 66 },
  { left: 54, top: 17, width: 42, height: 66 },
];

/* Tinggi kotak = lebar x rasio, dihitung dalam piksel kanvas.
   single: petak tujuannya 1080x1920 -> 16/9 kali lebarnya.
   split : tiap petak 1080x960      ->  8/9 kali lebarnya. */
const RASIO = { single: 16 / 9, split: 8 / 9 };

let FRAMING = [];          // [{ id, at, format, crops }] terurut menurut `at`
let framingSeq = 0;

const cropEls = () => [...document.querySelectorAll(".canvas .crop")];

/* Format yang sedang tergambar di kanvas. */
let formatKanvas = "single";

/* Titik yang berlaku pada detik tertentu: titik terakhir yang `at`-nya
   tidak melewati detik itu. */
function framingPada(detik) {
  let hasil = FRAMING[0] || null;
  for (const f of FRAMING) {
    if (f.at <= detik + 0.001) hasil = f;
    else break;
  }
  return hasil;
}

/* Bentuk bingkai yang berlaku pada detik itu, selalu lengkap: format dan
   daftar kotaknya. Pemanggil tidak perlu tahu FRAMING kosong atau tidak. */
function bingkaiPada(detik) {
  const f = framingPada(detik);
  const format = f ? f.format : "single";
  const crops = f ? f.crops : [CROP_AWAL];
  // Rasio disamakan DI SINI, bukan cuma saat menggambar. Versi sebelumnya
  // membetulkan kotak di kanvas tapi mengirim angka bawaan yang mentah ke
  // ffmpeg -- preview terlihat benar sementara berkas hasilnya melar.
  return { format, crops: crops.map((c) => samakanRasio(c, format)) };
}

/* Posisi pemutaran yang sedang ditinjau, dalam detik SUMBER. */
function waktuTinjau() {
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
                 crops: [{ ...CROP_AWAL }] });
  renderFraming();
}

/* ---------- memotong span di batas titik framing ----------
   Inilah yang membuat framing berpindah di tengah klip: satu range dipecah
   jadi beberapa potongan, masing-masing dengan bingkainya sendiri. Mesin
   render menyambungnya lagi jadi satu video.

   Potongan split membawa `crops` (dua kotak); potongan biasa membawa `crop`
   (satu kotak). Server membedakan keduanya lewat nama bidangnya. */
function spansWithFraming(ranges) {
  const keluar = [];
  for (const r of ranges) {
    const batas = [r.start];
    for (const f of FRAMING) {
      if (f.at > r.start + 0.05 && f.at < r.end - 0.05) batas.push(f.at);
    }
    batas.push(r.end);
    for (let i = 0; i < batas.length - 1; i++) {
      const b = bingkaiPada(batas[i]);
      const potongan = { start: batas[i], end: batas[i + 1] };
      if (b.format === "split" && b.crops.length >= 2) potongan.crops = b.crops;
      else potongan.crop = b.crops[0];
      keluar.push(potongan);
    }
  }
  return keluar;
}

/* ---------- menggambar ---------- */

/* Tinggi kotak diturunkan dari LEBARNYA dan rasio kanvas yang sebenarnya,
   bukan dari angka bawaan. Persentase tinggi untuk kotak berbentuk sama
   berbeda antara sumber 16:9 dan 4:3, dan kotak yang bentuknya meleset dari
   petak tujuannya bikin gambar melar saat di-scale oleh ffmpeg.

   Kalau tingginya jadi melewati tepi bawah, yang dikecilkan lebarnya --
   bukan tingginya dipotong, karena itu justru merusak rasionya. */
function rasioSumber() {
  for (const sel of ["#canvasVideo", "#videoPreview"]) {
    const v = $(sel);
    if (v?.videoWidth && v?.videoHeight) return v.videoWidth / v.videoHeight;
  }
  return 16 / 9;
}

function samakanRasio(crop, format) {
  const A = rasioSumber();
  let width = crop.width;
  let height = width * A * RASIO[format];
  if (crop.top + height > 100) {
    height = 100 - crop.top;
    width = height / (A * RASIO[format]);
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

const targetIkut = new WeakMap();   // elemen -> posisi tujuan terakhirnya

function ikutiPreview(el) {
  const v = $("#videoPreview");
  if (!el || !v) return;
  if (v.src && el.src !== v.src) el.src = v.src;
  if (!el.src) return;

  // Video yang baru dipasang belum bisa di-seek; permintaan seek ke sana
  // hilang begitu saja dan elemennya tertinggal jauh di belakang preview.
  // Karena itu penyelarasan diulang begitu ia siap.
  if (el.readyState < 1) {
    el.addEventListener("loadedmetadata", () => ikutiPreview(el), { once: true });
    return;
  }
  // Kanvas dikunci ke rasio sumbernya. Tanpa ini rasio kanvas cuma kebetulan
  // hasil tata letak; begitu ia beda dari videonya, object-fit:cover memotong
  // diam-diam dan persen kotak tidak lagi menunjuk bagian frame yang sama.
  if (el.id === "canvasVideo" && el.videoWidth && el.videoHeight) {
    const canvas = document.querySelector(".canvas");
    const rasio = `${el.videoWidth} / ${el.videoHeight}`;
    if (canvas && canvas.style.aspectRatio !== rasio) {
      canvas.style.aspectRatio = rasio;
    }
  }
  const t = v.src ? v.currentTime : waktuTinjau();
  const ambang = v.paused ? 0.02 : 0.20;

  // Posisi tujuan disimpan, bukan cuma diminta sekali. Kalau lompatan
  // sebelumnya belum rampung, permintaan baru bisa tertelan browser -- dan
  // elemennya berhenti di posisi lama. Dengan tujuan tersimpan, permintaan
  // TERAKHIR yang selalu menang, diterapkan ulang saat lompatan selesai.
  targetIkut.set(el, t);
  if (!el.seeking && Math.abs(el.currentTime - t) > ambang) {
    try { el.currentTime = t; } catch { /* di luar jangkauan */ }
  }
  // Ikut berjalan/berhenti bersama preview.
  if (!v.paused && el.paused) el.play().catch(() => {});
  else if (v.paused && !el.paused) el.pause();
}

/* Begitu satu lompatan rampung, posisi tujuan terakhir diterapkan lagi kalau
   ternyata masih meleset. */
function pasangSusulan(el) {
  el?.addEventListener("seeked", () => {
    const v = $("#videoPreview");
    const tujuan = targetIkut.get(el);
    if (!v || !v.src || tujuan === undefined) return;
    const ambang = v.paused ? 0.02 : 0.20;
    if (Math.abs(el.currentTime - tujuan) > ambang) {
      try { el.currentTime = tujuan; } catch { /* di luar jangkauan */ }
    }
  });
}
pasangSusulan($("#canvasVideo"));
pasangSusulan($("#videoPreview2"));

function syncCanvasVideo() {
  ikutiPreview($("#canvasVideo"));
  // Video petak bawah hanya perlu ikut saat memang dipakai. Membiarkannya
  // memutar diam-diam saat format single cuma membuang decoder.
  if (formatKanvas === "split") ikutiPreview($("#videoPreview2"));
  else $("#videoPreview2")?.pause();
}

function renderFraming() {
  if (!FRAMING.length) resetFraming();
  const t = waktuTinjau();
  const aktif = framingPada(t);

  // Pesan TIDAK ditulis di sini: renderFraming dipanggil sesudah aksi seperti
  // "kunci", dan menulisinya akan langsung menghapus konfirmasi yang baru saja
  // muncul. Pemanggil yang menentukan pesannya.
  const jam = $("#framingWaktu");
  if (jam) jam.textContent = `at ${jamRange(t)}`;
  const tag = $("#tagCrop1");
  if (tag) tag.textContent = aktif ? `from ${jamRange(aktif.at)}` : "";

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
    const outDari = (t) => (typeof activeClip !== "undefined" && activeClip?.spans
      && typeof sourceToOut === "function") ? sourceToOut(activeClip, t) : null;

    // Setiap titik SELALU dapat thumbnail-nya sendiri, seberapa pun rapat
    // waktunya dengan tetangganya -- strip-nya sebaris (flex), bukan
    // diposisikan proporsional ke waktu di atas satu bar lebar tetap. Kalau
    // titiknya banyak, striplah yang melebar dan boleh di-scroll horizontal
    // (lihat overflow-x di CSS .framing-timeline) -- BUKAN thumbnail-nya
    // yang dikecilkan atau sebagian titik dijadikan tick tanpa gambar.
    bar.innerHTML = FRAMING.map((f, i) => {
      const out = outDari(f.at);
      // Angka BESAR = posisi di RESULT yang sedang diedit (yang benar-benar
      // dilihat orang di panel preview kanan) -- itu yang berarti langsung,
      // bukan posisi di video sumber 42 menit. Sumbernya tetap ditampilkan
      // (kecil, di bawahnya) untuk konteks/lompat-balik, bukan dibuang --
      // cuma tidak lagi jadi angka UTAMA supaya tidak disangka posisi di
      // Result (persis kebingungan yang dilaporkan ian: titik "07:58" pada
      // Result yang cuma 1:25 kelihatan seperti di luar jangkauan, padahal
      // itu memang posisi aslinya di sumber, bukan salah).
      const tip = `${f.format === "split" ? "Split" : "Single"} · source ${jamRange(f.at)}`;
      const thumbUrl = f.crops?.[0] && typeof chosenSource !== "undefined" && chosenSource?.name
        ? `/api/thumb?video=${encodeURIComponent(chosenSource.name)}&t=${f.at}`
          + `&left=${f.crops[0].left}&top=${f.crops[0].top}`
          + `&width=${f.crops[0].width}&height=${f.crops[0].height}&w=96`
        : "";
      return `
      <div class="fr-point${f === aktif ? " fr-active" : ""}"
           data-framing="${f.id}" title="${tip}">
        ${thumbUrl ? `<img class="fr-thumb" src="${thumbUrl}" alt="" loading="lazy">`
                    : `<span class="fr-thumb fr-thumb-kosong"></span>`}
        <span class="fr-time">${out !== null ? jamRange(out) : "—"}</span>
        <span class="fr-time-src">src ${jamRange(f.at)}</span>
        ${i > 0 ? `<i class="buang" data-buang-framing="${f.id}" role="button"
              aria-label="Delete point ${jamRange(f.at)}">×</i>` : ""}
      </div>`;
    }).join("");
  }

  const bingkai = bingkaiPada(t);
  gambarKotak(bingkai.format, bingkai.crops);
  syncCanvasVideo();
  if (typeof attachVideoGeometry === "function") attachVideoGeometry();
}

/* Menaruh kotak di kanvas sesuai format. Kotak kedua hanya berarti saat
   split; di format single ia disembunyikan lewat data-format di kanvas. */
function gambarKotak(format, crops) {
  formatKanvas = format === "split" ? "split" : "single";
  const canvas = document.querySelector(".canvas");
  if (canvas) canvas.dataset.format = formatKanvas;
  // Preview ikut diberi tahu: petak bawah cuma ada saat split.
  const bingkai = $("#frame");
  if (bingkai) bingkai.dataset.format = formatKanvas;

  const els = cropEls();
  applyCrop(els[0], samakanRasio(crops[0] || CROP_AWAL, formatKanvas));
  // Kotak kedua selalu berasio split -- ia memang cuma dipakai di format itu.
  applyCrop(els[1], samakanRasio(crops[1] || CROP_SPLIT_AWAL[1], "split"));

  document.querySelectorAll("[data-format-pilih]").forEach((b) =>
    b.setAttribute("aria-pressed", String(b.dataset.formatPilih === formatKanvas)));
}

/* Menyalin kotak dari kanvas ke titik yang sedang berlaku. Dipanggil terus
   selama menggeser, bukan cuma saat dilepas: preview menghitung bingkainya
   dari ANGKA di FRAMING, jadi kalau angkanya baru ditulis saat pointer
   dilepas, preview diam saja sepanjang geseran. */
function simpanKotak() {
  const f = framingPada(waktuTinjau());
  const crops = kotakDiKanvas();
  if (!f || !crops) return null;
  f.format = formatKanvas;
  f.crops = crops;
  return f;
}

/* Kotak yang sedang tergambar di kanvas, dibaca balik jadi angka. */
function kotakDiKanvas() {
  const canvas = document.querySelector(".canvas");
  if (!canvas) return null;
  const els = cropEls();
  const n = formatKanvas === "split" ? 2 : 1;
  const keluar = [];
  for (let i = 0; i < n; i++) {
    if (!els[i]) return null;
    const geo = readCrop(els[i], canvas);
    if (!Number.isFinite(geo.width) || geo.width <= 0) return null;
    keluar.push(geo);
  }
  return keluar;
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
  const t = Math.max(0, waktuTinjau());
  const sama = FRAMING.find((f) => Math.abs(f.at - t) < 0.35);
  if (format === formatKanvas && sama) return;

  // Kotaknya dimulai dari susunan bawaan format itu -- rasio kotak single
  // dan split berbeda, jadi memakai ulang kotak lama cuma menghasilkan
  // gambar gepeng.
  const crops = format === "split"
    ? CROP_SPLIT_AWAL.map((c) => ({ ...c }))
    : [{ ...CROP_AWAL }];

  let pesan;
  if (sama) {
    sama.format = format;
    sama.crops = crops;
    pesan = `point ${jamRange(sama.at)} is now`;
  } else {
    FRAMING.push({ id: `f${++framingSeq}`, at: t, format, crops });
    FRAMING.sort((a, b2) => a.at - b2.at);
    pesan = `new point at ${jamRange(t)},`;
  }
  renderFraming();
  $("#reframeNote").textContent = format === "split"
    ? `${pesan} Split · drag the top and bottom boxes onto each person`
    : `${pesan} Single · drag the box onto whoever is talking`;
});

/* ---------- kunci, pilih, hapus ---------- */

$("#kunciFraming")?.addEventListener("click", () => {
  const crops = kotakDiKanvas() || bingkaiPada(waktuTinjau()).crops;
  const t = Math.max(0, waktuTinjau());

  // Titik di detik yang sama ditimpa, bukan digandakan.
  const sama = FRAMING.find((f) => Math.abs(f.at - t) < 0.35);
  let pesan;
  if (sama) {
    sama.format = formatKanvas;
    sama.crops = crops;
    pesan = `point ${jamRange(sama.at)} updated`;
  } else {
    FRAMING.push({ id: `f${++framingSeq}`, at: t, format: formatKanvas, crops });
    FRAMING.sort((a, b) => a.at - b.at);
    pesan = `new point locked at ${jamRange(t)}`;
  }
  renderFraming();
  if (typeof simpanProject === "function") simpanProject();
  $("#reframeNote").textContent =
    `${pesan} · ${formatKanvas === "split" ? "Split" : "Single"}`;
});

$("#framingList")?.addEventListener("click", (e) => {
  const buang = e.target.closest("[data-buang-framing]");
  if (buang) {
    e.stopPropagation();
    const id = buang.dataset.buangFraming;
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
    if (formatKanvas !== "split" && cropEls().indexOf(crop) > 0) return;
    const k = canvas.getBoundingClientRect();
    const c = crop.getBoundingClientRect();
    active = { crop, k, ubah: e.target.tagName === "B",
               dx: e.clientX - c.left, dy: e.clientY - c.top,
               w0: c.width, h0: c.height };
    crop.setPointerCapture(e.pointerId);
    e.preventDefault();
  });

  canvas.addEventListener("pointermove", (e) => {
    if (!active) return;
    const { crop, k } = active;
    if (active.ubah) {
      // Rasio TERKUNCI: tingginya selalu lebar x rasio format. Yang dibatasi
      // lebarnya, bukan tingginya -- kalau tingginya yang dipotong sendiri,
      // kotaknya jadi gepeng dan hasil rendernya ikut gepeng.
      const rasio = RASIO[formatKanvas];
      const kotak = crop.getBoundingClientRect();
      const maxW = Math.min(k.right - kotak.left, (k.bottom - kotak.top) / rasio);
      const w = clamp(e.clientX - kotak.left, 40, Math.max(40, maxW));
      const h = w * rasio;
      crop.style.width = `${(w / k.width) * 100}%`;
      crop.style.height = `${(h / k.height) * 100}%`;
    } else {
      const x = clamp(e.clientX - k.left - active.dx, 0, k.width - active.w0);
      const y = clamp(e.clientY - k.top - active.dy, 0, k.height - active.h0);
      crop.style.left = `${(x / k.width) * 100}%`;
      crop.style.top = `${(y / k.height) * 100}%`;
    }
    simpanKotak();
    if (typeof attachVideoGeometry === "function") attachVideoGeometry();
  });

  ["pointerup", "pointercancel"].forEach((ev) =>
    canvas.addEventListener(ev, () => {
      if (!active) return;
      active = null;
      // Geseran langsung menempel ke titik yang sedang berlaku. Kalau kamu
      // mau posisi ini mulai di detik lain, tekan "Kunci framing di sini".
      const f = simpanKotak() || framingPada(waktuTinjau());
      $("#reframeNote").textContent = f
        ? `point ${jamRange(f.at)} moved · press Lock to create a new point`
        : "drag the box onto whoever is talking, then lock it";
      if (typeof attachVideoGeometry === "function") attachVideoGeometry();
    }));
})();

/* ---------- AI Framing: giliran bicara -> titik framing otomatis ----------
   Backend (klipian/diarize.py) cuma tahu SIAPA bicara dan KAPAN -- sama
   sekali tidak tahu kotak mana di kanvas yang harus dipakai untuk orang itu.

   TIDAK butuh Split disiapkan dulu -- itu percobaan pertama yang salah:
   memaksa ian menyiapkan dua kotak referensi SEBELUM analisis jalan
   bertentangan dengan maksud "otomatis" dari fitur ini sendiri. Sekarang
   klik tombolnya LANGSUNG memulai analisis; kotak baru diminta SESUDAH
   tahu ada berapa pembicara dan kapan giliran masing-masing -- preview
   digeser ke giliran pertama tiap orang, ian tinggal geser satu kotak
   (kanvas tetap format Single) ke orang itu lalu konfirmasi. Tidak
   dibatasi dua orang: berapa pun pembicara yang terdeteksi, masing-masing
   ditanya sekali secara berurutan.

   Sengaja dibatasi ke SATU komposisi kamera tetap: kalau video sumbernya
   sendiri ganti shot di tengah klip, itu tetap dikerjakan manual seperti
   sekarang -- AI Framing tidak mencoba menebak itu. */

let aiFramingAntrian = null;   // { urutan, idx, turns, posisi }

/* Status AI Framing (error, proses, tanya) SELALU muncul di kotak kuning
   #aiFramingTanya, bukan cuma teks kecil di #reframeNote -- itu yang
   ternyata terlewat begitu saja pada percobaan pertama: pesan gagal-validasi
   memang muncul, tapi cuma teks polos berdesakan dengan elemen lain di baris
   judul, kelihatan seperti "tidak terjadi apa-apa". Kotak ini dipakai untuk
   SEMUA status, dengan tombol pilihan ditampilkan hanya saat memang ada
   pertanyaan untuk dijawab. */
function aiFramingStatus(teks, { tombol = false } = {}) {
  const isiTeks = $("#aiFramingTanyaTeks");
  if (isiTeks) isiTeks.textContent = teks;
  const grup = $("#aiFramingTanya .ai-framing-tombol");
  if (grup) grup.hidden = !tombol;
  $("#aiFramingTanya")?.removeAttribute("hidden");
}

/* Satu permintaan ke server, dibungkus Promise supaya bisa di-`await` di
   dalam loop -- lihat aiFramingMulai() untuk alasan loopnya. */
function aiFramingDiarizeSatuSpan(span) {
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
    (function cek() {
      fetch(`/api/diarize/${id}`).then((r) => r.json()).then((d) => {
        if (d.state === "running") { setTimeout(cek, 1500); return; }
        if (d.state === "failed") { reject(new Error(d.error || "Diarization failed.")); return; }
        resolve(d.turns || []);
      }).catch(reject);
    })();
  });
}

async function aiFramingMulai() {
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
  if (btn) { btn.disabled = true; btn.textContent = "Analyzing …"; }

  // Berurutan, BUKAN paralel: semua span berbagi satu model diarization
  // yang sama di server (satu instance dimuat sekali, dipakai lagi supaya
  // tidak menunggu belasan detik memuat ulang tiap kali) -- dua permintaan
  // bersamaan ke model yang sama berisiko baku rebut/hasil kacau.
  const semuaTurns = [];
  try {
    for (let i = 0; i < spans.length; i++) {
      aiFramingStatus(spans.length > 1
        ? `AI Framing: listening for who's talking … (span ${i + 1}/${spans.length})`
        : "AI Framing: listening for who's talking … (usually 25–35s per clip)");
      const turns = await aiFramingDiarizeSatuSpan(spans[i]);
      semuaTurns.push(...turns);
    }
  } catch (err) {
    aiFramingGagal(err.message);
    return;
  }

  aiFramingSiapkanAntrian(semuaTurns);
}

function aiFramingGagal(pesan) {
  const btn = $("#aiFramingBtn");
  if (btn) { btn.disabled = false; btn.textContent = "AI Framing"; }
  aiFramingStatus(`AI Framing failed: ${pesan}`);
}

function aiFramingSiapkanAntrian(turns) {
  const btn = $("#aiFramingBtn");
  if (btn) { btn.disabled = false; btn.textContent = "AI Framing"; }

  if (!turns.length) {
    aiFramingStatus("AI Framing: no speech detected in this clip.");
    return;
  }

  // Urutan pembicara menurut giliran PERTAMA mereka -- yang paling awal
  // ditanya duluan, supaya video yang diputar untuk konfirmasi juga
  // berurutan secara alami, bukan lompat maju-mundur. SEMUA pembicara
  // ditanya, termasuk kalau cuma satu -- tidak ada lagi kotak referensi
  // bawaan untuk diam-diam dipakai ulang, jadi posisinya harus benar-benar
  // dikonfirmasi minimal sekali.
  const pertama = new Map();
  for (const t of turns) if (!pertama.has(t.speaker)) pertama.set(t.speaker, t);
  const urutan = [...pertama.values()].sort((a, b) => a.start - b.start);

  aiFramingAntrian = { urutan, idx: 0, turns, posisi: {} };
  aiFramingTanyaBerikutnya();
}

function aiFramingTanyaBerikutnya() {
  const a = aiFramingAntrian;
  if (!a || a.idx >= a.urutan.length) {
    if (a) aiFramingTerapkan(a.turns, a.posisi);
    aiFramingAntrian = null;
    return;
  }
  const turn = a.urutan[a.idx];

  // Digeser ke giliran pertama orang ini supaya kelihatan/kedengaran
  // langsung siapa yang dimaksud -- lebih meyakinkan daripada menebak dari
  // label "SPEAKER_00" yang tidak berarti apa-apa. renderFraming() dipanggil
  // supaya kanvas ikut menggambar ulang bingkai yang berlaku di detik baru
  // ini -- kotak yang ian geser sesaat lagi adalah kotak PERTAMA di kanvas
  // itu, apa pun formatnya sekarang.
  const v = $("#videoPreview");
  if (v && v.src) {
    try { v.currentTime = turn.start; } catch { /* metadata belum siap */ }
  }
  renderFraming();

  aiFramingStatus(
    (a.urutan.length > 1
      ? `Speaker ${a.idx + 1}/${a.urutan.length}, first heard at ${jamRange(turn.start)} — `
      : `Only speaker detected, first heard at ${jamRange(turn.start)} — `)
    + "drag the box onto them, then confirm.",
    { tombol: true });
}

$("#aiFramingTanya")?.addEventListener("click", (e) => {
  const a = aiFramingAntrian;
  if (!a) return;
  const set = e.target.closest("[data-ai-set]");
  const lewati = e.target.closest("[data-ai-lewati]");
  if (!set && !lewati) return;
  if (set) {
    // Kotak PERTAMA di kanvas -- itu yang ian baru saja geser ke orangnya.
    // Kalau kanvas kebetulan format Split (dua kotak), kotak kedua
    // diabaikan; alur ini cuma pakai satu kotak per pembicara.
    const kotak = kotakDiKanvas();
    if (kotak && kotak[0]) {
      a.posisi[a.urutan[a.idx].speaker] = { ...kotak[0] };
    }
  }
  a.idx++;
  aiFramingTanyaBerikutnya();
});

/* Kotak yang sudah dites di sini KASAR, cuma posisi orang secara umum
   (ditandai manual sekali di titik Split acuan) -- meleset dikit dari
   wajah sungguhan itu wajar. Tanpa perbaikan, titik yang dihasilkan AI
   Framing cuma menyalin mentah-mentah koordinat kasar itu ke SELURUH
   giliran, dan kalau orangnya bergeser di kursi atau geseran awalnya
   kurang pas, hasilnya bisa menyorot kursi kosong -- persis keluhan yang
   mau diperbaiki. Jadi SELURUH giliran [start, end) dilacak lewat deteksi
   wajah sungguhan (klipian/facebox.py), bukan cuma titik awalnya -- bisa
   mengembalikan LEBIH dari satu titik kalau subjeknya bergeser cukup jauh
   selama giliran itu. klipian tetap potong keras (bukan pan kontinu); ini
   cuma memastikan titik potongnya ikut gerak orangnya. Gagal/videonya
   belum ada -> jatuh ke satu titik kotak kasar, sama seperti server-side
   track_crops() kalau tidak ada wajah sama sekali. */
async function aiFramingLacakWajah(start, end, kasar) {
  try {
    const r = await fetch("/api/facetrack", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ video: chosenSource?.name, start, end, crop: kasar }),
    });
    const d = await r.json();
    return (d.points && d.points.length) ? d.points : [{ at: start, crop: kasar }];
  } catch {
    return [{ at: start, crop: kasar }];
  }
}

async function aiFramingTerapkan(turns, posisi) {
  // Daftar rencana dulu, baru pelacakan wajahnya dijalankan PARALEL untuk
  // semua giliran -- kalau berurutan, klip dengan banyak giliran bicara
  // (mis. 15 titik) bisa makan belasan detik cuma menunggu satu-satu.
  const rencana = [];
  let pembicaraSebelumnya = null;
  for (const t of turns) {
    const kasar = posisi[t.speaker];
    if (!kasar) continue;                          // pembicara yang dilewati
    if (t.speaker === pembicaraSebelumnya) continue; // pembicara sama, tidak perlu titik baru
    pembicaraSebelumnya = t.speaker;
    rencana.push({ at: t.start, end: t.end, kasar });
  }

  if (!rencana.length) {
    // Bukan kegagalan -- cuma tidak ada giliran yang perlu berganti kotak
    // (misal cuma satu pembicara sepanjang klip). Dulu ini dilaporkan
    // sebagai "0 titik ditambahkan" yang kelihatan seperti error padahal
    // benar begini adanya.
    aiFramingStatus("AI Framing: no switching needed for this clip.");
    return;
  }

  aiFramingStatus(
    `AI Framing: tracking ${rencana.length} turn${rencana.length === 1 ? "" : "s"} onto each face …`);
  const hasilPerGiliran = await Promise.all(
    rencana.map((r) => aiFramingLacakWajah(r.at, r.end, r.kasar)));

  let ditambah = 0;
  for (const titikDaftar of hasilPerGiliran) {
    for (const titik of titikDaftar) {
      const crop = { ...titik.crop };
      const sama = FRAMING.find((f) => Math.abs(f.at - titik.at) < 0.35);
      if (sama) {
        sama.format = "single";
        sama.crops = [crop];
      } else {
        FRAMING.push({ id: `f${++framingSeq}`, at: titik.at, format: "single", crops: [crop] });
        ditambah++;
      }
    }
  }
  FRAMING.sort((a, b) => a.at - b.at);
  renderFraming();
  if (typeof simpanProject === "function") simpanProject();

  aiFramingStatus(
    `AI Framing: ${ditambah} framing point${ditambah === 1 ? "" : "s"} added across `
    + `${rencana.length} turn${rencana.length === 1 ? "" : "s"}, tracking each speaker's face. `
    + "Review and adjust if needed.");
}

$("#aiFramingBtn")?.addEventListener("click", aiFramingMulai);

resetFraming();
