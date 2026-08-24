/* klipian — framing sepanjang waktu
   ==========================================================================
   Framing bukan lagi "objek orang" yang dipasang per klip. Model itu
   mengandaikan tiap orang duduk di tempat yang tetap, padahal potongan
   podcast sering berganti angle: orang yang sama bisa di kiri sekarang dan
   di tengah semenit kemudian.

   Sekarang framing adalah DAFTAR TITIK di sepanjang video:

       00:00  kotak di tengah
       05:12  kotak pindah ke kiri
       07:40  kotak pindah ke kanan

   Aturannya satu kalimat: satu titik berlaku sampai titik berikutnya, dan
   perpindahannya potong keras -- tidak merayap.

   Cara pakainya juga satu kalimat: putar preview ke momen yang kamu mau,
   geser kotak ke orangnya, tekan "Kunci framing di sini".

   Kanvasnya menampilkan frame video ASLI pada posisi itu, bukan gambar
   contoh -- kalau tidak, kamu membingkai sesuatu yang tidak kamu lihat.
   ========================================================================== */

const CROP_AWAL = { left: 37, top: 8, width: 26, height: 84 };

let FRAMING = [];          // [{ id, at, crop }] terurut menurut `at`
let framingSeq = 0;

const cropEl = () => document.querySelector(".canvas .crop");

let kanvasTarget = null;   // posisi yang diminta terakhir untuk kanvas

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

const cropPada = (detik) => {
  const f = framingPada(detik);
  return f ? { ...f.crop } : { ...CROP_AWAL };
};

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
  FRAMING.push({ id: `f${++framingSeq}`, at: 0, crop: { ...CROP_AWAL } });
  renderFraming();
}

/* ---------- memotong span di batas titik framing ----------
   Inilah yang membuat framing berpindah di tengah klip: satu range dipecah
   jadi beberapa potongan, masing-masing dengan crop-nya sendiri. Mesin render
   menyambungnya lagi jadi satu video. */
function spansWithFraming(ranges) {
  const keluar = [];
  for (const r of ranges) {
    const batas = [r.start];
    for (const f of FRAMING) {
      if (f.at > r.start + 0.05 && f.at < r.end - 0.05) batas.push(f.at);
    }
    batas.push(r.end);
    for (let i = 0; i < batas.length - 1; i++) {
      keluar.push({ start: batas[i], end: batas[i + 1], crop: cropPada(batas[i]) });
    }
  }
  return keluar;
}

/* ---------- menggambar ---------- */

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
   dua kali: kanvas memperlihatkan frame utuh (untuk memilih bingkai), preview
   memperlihatkan hasil sesudah dipotong dan dibingkai.

   Karena itu keduanya harus berjalan bersamaan. Dulu kanvas hanya di-seek saat
   renderFraming() kebetulan dipanggil, jadi ia membeku sementara preview
   berjalan -- dan kamu membingkai frame yang bukan frame yang sedang diputar.

   Ambangnya berbeda menurut keadaan: saat dijeda harus persis (kamu sedang
   melangkah per frame), saat berjalan boleh meleset sedikit supaya tidak
   tersendat oleh seek terus-menerus. */
function syncCanvasVideo() {
  const cv = $("#canvasVideo");
  const v = $("#videoPreview");
  if (!cv || !v) return;
  if (v.src && cv.src !== v.src) cv.src = v.src;
  if (!cv.src) return;

  // Video yang baru dipasang belum bisa di-seek; permintaan seek ke sana
  // hilang begitu saja dan kanvas tertinggal jauh di belakang preview.
  // Karena itu penyelarasan diulang begitu ia siap.
  if (cv.readyState < 1) {
    cv.addEventListener("loadedmetadata", syncCanvasVideo, { once: true });
    return;
  }
  const t = v.src ? v.currentTime : waktuTinjau();
  const ambang = v.paused ? 0.02 : 0.20;

  // Posisi tujuan disimpan, bukan cuma diminta sekali. Kalau lompatan
  // sebelumnya belum rampung, permintaan baru bisa tertelan browser -- dan
  // kanvas berhenti di posisi lama. Dengan tujuan tersimpan, permintaan
  // TERAKHIR yang selalu menang, diterapkan ulang saat lompatan selesai.
  kanvasTarget = t;
  if (cv.seeking) return;
  if (Math.abs(cv.currentTime - t) > ambang) {
    try { cv.currentTime = t; } catch { /* di luar jangkauan */ }
  }
  // Ikut berjalan/berhenti bersama preview.
  if (!v.paused && cv.paused) cv.play().catch(() => {});
  else if (v.paused && !cv.paused) cv.pause();
}

/* Begitu satu lompatan rampung, posisi tujuan terakhir diterapkan lagi kalau
   ternyata masih meleset. */
$("#canvasVideo")?.addEventListener("seeked", () => {
  const cv = $("#canvasVideo"), v = $("#videoPreview");
  if (!cv || !v || !v.src || kanvasTarget === null) return;
  const ambang = v.paused ? 0.02 : 0.20;
  if (Math.abs(cv.currentTime - kanvasTarget) > ambang) {
    try { cv.currentTime = kanvasTarget; } catch { /* di luar jangkauan */ }
  }
});

function renderFraming() {
  if (!FRAMING.length) resetFraming();
  const t = waktuTinjau();
  const aktif = framingPada(t);

  // Pesan TIDAK ditulis di sini: renderFraming dipanggil sesudah aksi seperti
  // "kunci", dan menulisinya akan langsung menghapus konfirmasi yang baru saja
  // muncul. Pemanggil yang menentukan pesannya.
  const jam = $("#framingWaktu");
  if (jam) jam.textContent = `posisi ${jamRange(t)}`;
  const tag = $("#tagCrop1");
  if (tag) tag.textContent = aktif ? `berlaku dari ${jamRange(aktif.at)}` : "";

  const bar = $("#framingList");
  if (bar) {
    bar.innerHTML = FRAMING.map((f, i) => `
      <button class="chip" data-framing="${f.id}"${f === aktif ? ' aria-pressed="true"' : ""}>
        ${jamRange(f.at)}${i > 0
          ? `<i class="buang" data-buang-framing="${f.id}" role="button"
                aria-label="Hapus titik ${jamRange(f.at)}">×</i>` : ""}
      </button>`).join("");
  }

  applyCrop(cropEl(), aktif ? aktif.crop : CROP_AWAL);
  syncCanvasVideo();
  if (typeof attachVideoGeometry === "function") attachVideoGeometry();
}

/* ---------- kunci, pilih, hapus ---------- */

$("#kunciFraming")?.addEventListener("click", () => {
  const canvas = document.querySelector(".canvas");
  const el = cropEl();
  if (!canvas || !el) return;
  const geo = readCrop(el, canvas);
  const crop = (Number.isFinite(geo.width) && geo.width > 0)
    ? geo : cropPada(waktuTinjau());
  const t = Math.max(0, waktuTinjau());

  // Titik di detik yang sama ditimpa, bukan digandakan.
  const sama = FRAMING.find((f) => Math.abs(f.at - t) < 0.35);
  let pesan;
  if (sama) {
    sama.crop = crop;
    pesan = `titik ${jamRange(sama.at)} diperbarui`;
  } else {
    FRAMING.push({ id: `f${++framingSeq}`, at: t, crop });
    FRAMING.sort((a, b) => a.at - b.at);
    pesan = `titik baru dikunci di ${jamRange(t)}`;
  }
  renderFraming();
  $("#reframeNote").textContent = pesan;
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
  $("#reframeNote").textContent = "geser kotak ke orang yang bicara, lalu kunci";
  // Klik titik = lompat ke detiknya, supaya kelihatan sedang membingkai apa.
  const f = FRAMING.find((x) => x.id === chip.dataset.framing);
  if (!f) return;
  const v = $("#videoPreview");
  if (v && v.src) {
    const sumber = (typeof outToSource === "function" && activeClip)
      ? f.at : f.at;
    try { v.currentTime = sumber; } catch { /* di luar jangkauan */ }
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
      const kotak = crop.getBoundingClientRect();
      const w = clamp(e.clientX - kotak.left, 40, k.right - kotak.left);
      const h = Math.min(w * 16 / 9, k.bottom - kotak.top);
      crop.style.width = `${(w / k.width) * 100}%`;
      crop.style.height = `${(h / k.height) * 100}%`;
    } else {
      const x = clamp(e.clientX - k.left - active.dx, 0, k.width - active.w0);
      const y = clamp(e.clientY - k.top - active.dy, 0, k.height - active.h0);
      crop.style.left = `${(x / k.width) * 100}%`;
      crop.style.top = `${(y / k.height) * 100}%`;
    }
    if (typeof attachVideoGeometry === "function") attachVideoGeometry();
  });

  ["pointerup", "pointercancel"].forEach((ev) =>
    canvas.addEventListener(ev, () => {
      if (!active) return;
      active = null;
      // Geseran langsung menempel ke titik yang sedang berlaku. Kalau kamu
      // mau posisi ini mulai di detik lain, tekan "Kunci framing di sini".
      const f = framingPada(waktuTinjau());
      const geo = readCrop(cropEl(), canvas);
      if (f && Number.isFinite(geo.width) && geo.width > 0) f.crop = geo;
      $("#reframeNote").textContent = f
        ? `titik ${jamRange(f.at)} digeser · tekan Kunci untuk membuat titik baru`
        : "geser kotak ke orang yang bicara, lalu kunci";
    }));
})();

resetFraming();
