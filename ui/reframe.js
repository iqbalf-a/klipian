/* klipian — reframe
   ==========================================================================
   Framing tidak lagi dipilih dari preset tetap ("Wajah kiri", "Wajah kanan"),
   melainkan dari OBJEK yang kamu buat sendiri:

       Orang 1   Orang 2   Orang 3   + Tambah orang

   Alasannya: jumlah orang di frame berbeda tiap video. Podcast berdua cukup
   dua objek; podcast berempat butuh empat. Preset tetap tidak pernah cocok.

   Aturan mainnya:

   1. OBJEK MILIK SATU PROYEK. Drop video baru -> daftar objek dikosongkan,
      karena orangnya memang lain.

   2. SATU KLIP MEMAKAI SATU OBJEK. Klip menyimpan objek pilihannya sendiri
      (klip.objectId), jadi klip 1 boleh menyorot Orang 1 dan klip 2 menyorot
      Orang 3 tanpa render ulang.

   3. KOTAK YANG DIGESER LANGSUNG TERSIMPAN ke objek yang sedang dipilih --
      bukan cuma menempel di DOM. Render membaca angka itu, jadi hasilnya
      selalu sama dengan yang ditunjukkan preview.

   Mode gameplay tetap punya kotak facecam terpisah (kotak kedua); yang jadi
   objek hanyalah subjek utamanya.

   Kanvasnya dipaksa 16:9 (lihat app.css) supaya persentase kotak memetakan
   tepat ke piksel gambar sumber.
   ========================================================================== */

/* Kotak awal per objek. Objek pertama di tengah (paling sering benar untuk
   satu pembicara), objek berikutnya menyebar kiri-kanan supaya tidak menumpuk
   dan langsung mendekati posisi orang di podcast berdua atau bertiga. */
const CROP_AWAL = { top: 8, width: 26, height: 84 };
const KIRI_AWAL = [37, 12, 60, 24, 72, 2, 84];

/* Kotak facecam mode gameplay -- bukan objek, tidak ikut daftar. */
const FACECAM_AWAL = { left: 4, top: 56, width: 13, height: 36 };

const REFRAME_NOTE = {
  dialog: "geser kotak ke wajah orangnya · satu objek per klip",
  gameplay: "kotak besar untuk gameplay · kotak kecil untuk facecam",
};

let OBJECTS = [];            // [{ id, name, crop:{left,top,width,height} }]
let activeObjectId = null;
let objectSeq = 0;

const cropBox = () => [...document.querySelectorAll(".canvas .crop")];
const activeObject = () => OBJECTS.find((o) => o.id === activeObjectId) || OBJECTS[0] || null;

/* Angka crop objek yang sedang dipilih. Dipakai render, dan sengaja diambil
   dari model -- bukan dari DOM -- supaya tetap benar walau kanvasnya belum
   pernah tampil dan geometrinya belum bisa diukur. */
function activeObjectCrop() {
  const o = activeObject();
  return o ? { ...o.crop } : null;
}

/* Crop milik satu klip. Klip yang belum punya objek memakai yang sedang aktif. */
function cropForClip(clip) {
  if (!clip) return activeObjectCrop();
  const o = OBJECTS.find((x) => x.id === clip.objectId);
  return o ? { ...o.crop } : activeObjectCrop();
}

function addObject(name) {
  const i = OBJECTS.length;
  const o = {
    id: `obj${++objectSeq}`,
    name: name || `Orang ${i + 1}`,
    crop: { ...CROP_AWAL, left: KIRI_AWAL[i % KIRI_AWAL.length] },
  };
  OBJECTS.push(o);
  activeObjectId = o.id;
  return o;
}

/* Dipanggil saat video baru dijatuhkan: orangnya lain, objeknya ikut ganti. */
function resetObjects() {
  OBJECTS = [];
  activeObjectId = null;
  objectSeq = 0;
  addObject();
  if (typeof DATA !== "undefined") {
    for (const d of Object.values(DATA)) {
      (d.candidates || []).forEach((k) => { delete k.objectId; });
    }
  }
  if (document.querySelector(".canvas")) renderReframe();
}

function applyCrop(el, p) {
  if (!el) return;
  if (!p) { el.style.display = "none"; return; }
  el.style.display = "";
  el.style.left = `${p.left}%`;
  el.style.top = `${p.top}%`;
  el.style.width = `${p.width}%`;
  el.style.height = `${p.height}%`;
}

/* Persen crop -> background-size/position pada bidang preview.
   Rumus baku: untuk menampilkan potongan selebar W% dari gambar, ukuran
   latarnya (100/W)*100 persen, dan posisinya L/(100-W)*100 persen. */
function mapToField(field, p, image) {
  if (!field || !p) return;
  field.style.backgroundImage = `url('${image}')`;
  field.style.backgroundSize = `${(100 / p.width) * 100}% ${(100 / p.height) * 100}%`;
  field.style.backgroundPosition =
    `${p.width >= 100 ? 50 : (p.left / (100 - p.width)) * 100}% ` +
    `${p.height >= 100 ? 50 : (p.top / (100 - p.height)) * 100}%`;
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

/* Preview 9:16 selalu mengikuti kotak crop yang sedang ada di kanvas. */
function refreshPreviewFromCrop(simpan) {
  const canvas = document.querySelector(".canvas");
  if (!canvas) return;
  const image = `assets/src-${mode}.jpg`;
  const [c1, c2] = cropBox();
  const frame = $("#frame");
  const main = frame.querySelector(".field.main");
  const top = frame.querySelector(".field.top");

  if (c1 && c1.style.display !== "none") {
    const geo = readCrop(c1, canvas);
    // Kanvas yang belum tergambar melaporkan ukuran nol; jangan timpa angka
    // objek dengan NaN, pakai yang tersimpan.
    const p = Number.isFinite(geo.width) && geo.width > 0 ? geo : activeObjectCrop();
    // Hanya disimpan kalau memang sedang digeser. Kalau setiap penggambaran
    // ikut menulis balik, angka objek melayang sedikit demi sedikit karena
    // pembulatan piksel.
    if (simpan && p && geo.width > 0) {
      const o = activeObject();
      if (o) o.crop = p;
    }
    mapToField(main, p, image);
  }
  const hasFacecam = c2 && c2.style.display !== "none";
  frame.dataset.layout = hasFacecam ? "double" : "single";
  if (hasFacecam) mapToField(top, readCrop(c2, canvas), image);
  if (typeof attachVideoGeometry === "function") attachVideoGeometry();
}

function renderObjectList() {
  const bar = $("#objectList");
  if (!bar) return;
  bar.innerHTML = OBJECTS.map((o) => `
    <button class="chip" data-object="${o.id}"${o.id === activeObjectId ? ' aria-pressed="true"' : ""}>
      <span class="nama-objek">${escapeHTML(o.name)}</span>${OBJECTS.length > 1
        ? `<i class="buang" data-buang="${o.id}" role="button" aria-label="Hapus ${escapeHTML(o.name)}">×</i>`
        : ""}
    </button>`).join("");
}

function renderReframe() {
  if (!OBJECTS.length) addObject();
  const [c1, c2] = cropBox();
  $("#reframeNote").textContent = REFRAME_NOTE[mode] || "";
  $("#tagCrop1").textContent = activeObject() ? activeObject().name : "";
  if (mode === "gameplay") $("#tagCrop2").textContent = "Facecam";

  renderObjectList();
  applyCrop(c1, activeObjectCrop());
  applyCrop(c2, mode === "gameplay" ? FACECAM_AWAL : null);
  refreshPreviewFromCrop();
}

/* ---------- daftar objek: pilih, tambah, ganti nama, hapus ---------- */

$("#objectList")?.addEventListener("click", (e) => {
  const buang = e.target.closest("[data-buang]");
  if (buang) {
    e.stopPropagation();
    const id = buang.dataset.buang;
    if (OBJECTS.length <= 1) return;                 // minimal satu objek
    OBJECTS = OBJECTS.filter((o) => o.id !== id);
    if (activeObjectId === id) activeObjectId = OBJECTS[0].id;
    for (const d of Object.values(DATA)) {
      (d.candidates || []).forEach((k) => { if (k.objectId === id) delete k.objectId; });
    }
    renderReframe();
    return;
  }
  const chip = e.target.closest(".chip");
  if (!chip) return;
  activeObjectId = chip.dataset.object;
  // Klip yang sedang dibuka ikut memakai objek ini.
  const clip = klipTerbuka();
  if (clip) clip.objectId = activeObjectId;
  renderReframe();
  if (typeof summarizeRender === "function") summarizeRender();
});

/* Klik dua kali pada namanya untuk mengganti nama. */
$("#objectList")?.addEventListener("dblclick", (e) => {
  const label = e.target.closest(".nama-objek");
  if (!label) return;
  const id = label.closest(".chip").dataset.object;
  const o = OBJECTS.find((x) => x.id === id);
  if (!o) return;
  label.contentEditable = "true";
  label.focus();
  document.getSelection().selectAllChildren(label);

  const simpan = () => {
    label.contentEditable = "false";
    const nama = label.textContent.trim();
    o.name = nama || o.name;
    renderReframe();
  };
  label.addEventListener("blur", simpan, { once: true });
  label.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter") { ev.preventDefault(); label.blur(); }
    if (ev.key === "Escape") { label.textContent = o.name; label.blur(); }
  });
});

$("#addObject")?.addEventListener("click", () => {
  addObject();
  const clip = klipTerbuka();
  if (clip) clip.objectId = activeObjectId;
  renderReframe();
});

/* Klip yang sedang dibuka di layar Potong -- objek yang dipilih menempel ke sini. */
function klipTerbuka() {
  const judul = $("#cutTitle")?.textContent;
  if (!judul || typeof DATA === "undefined") return null;
  return (DATA[mode].candidates || []).find((k) => k.title === judul) || null;
}

/* Geser dan ubah ukuran; preview ikut bergerak seketika. */
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
    active = { crop, k, change: e.target.tagName === "B",
              dx: e.clientX - c.left, dy: e.clientY - c.top, w0: c.width, h0: c.height };
    crop.setPointerCapture(e.pointerId);
    e.preventDefault();
  });

  canvas.addEventListener("pointermove", (e) => {
    if (!active) return;
    const { crop, k } = active;
    if (active.change) {
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
    refreshPreviewFromCrop(true);          // geseran ini yang disimpan
  });

  ["pointerup", "pointercancel"].forEach((ev) =>
    canvas.addEventListener(ev, () => { active = null; }));
})();

resetObjects();
