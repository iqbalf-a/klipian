/* klipian — timeline video utuh & seleksi rentang
   ==========================================================================
   Satu batang mewakili seluruh video. Kamu menggeser di atasnya untuk memilih
   rentang, lalu memasukkannya ke result.

   Masalah yang harus dijawab desain ini: podcast 42 menit di batang selebar
   900 piksel berarti 1 piksel ~ 2,8 detik. Menggeser saja tidak akan pernah
   presisi. Karena itu ada TIGA jalan yang saling menutupi:

     1. geser kasar  -> cari lokasinya
     2. snap ke kata -> titiknya dirapikan otomatis ke batas kata terdekat
     3. ketik angka  -> kalau kamu sudah tahu menit:detiknya

   Yang ketiga penting justru karena rekomendasi AI memberi angka: kamu bisa
   mengetiknya langsung tanpa mencari-cari di batang.

   Penanda di batang menunjukkan rekomendasi AI (garis tipis) dan potongan
   yang sudah masuk result (blok padat), supaya tidak memilih yang sama dua
   kali.
   ========================================================================== */

let SELECTION = null;       // { start, end } dalam detik sumber, atau null
let dragSelection = null;   // keadaan sementara saat menggeser

const videoDuration = () =>
  realTranscript?.duration || chosenSource?.duration || 0;

/* detik -> pecahan 0..1 di sepanjang batang, dan sebaliknya */
const toFraction = (t) => { const d = videoDuration(); return d ? Math.max(0, Math.min(1, t / d)) : 0; };
const fracToSeconds = (frac) => Math.max(0, Math.min(videoDuration(), frac * videoDuration()));

/* "16:56" -> 1016. Menerima "1:02:03" juga. Kembalikan null kalau ngawur. */
function parseTime(text) {
  const parts = String(text).trim().split(":");
  if (!parts.length || parts.some((b) => b.trim() === "" || isNaN(Number(b)))) return null;
  const seconds = parts.reduce((a, b) => a * 60 + Number(b), 0);
  return Number.isFinite(seconds) ? seconds : null;
}

/* ---------- menggambar ---------- */

function drawTotalTimeline() {
  const bar = $("#tlTotal");
  if (!bar) return;
  // Panel pratinjau di atas bar ini SELALU tampil, jadi harus punya isi
  // sedini mungkin -- titik kumpul ini sudah dipanggil tiap kali
  // chosenSource berubah, jadi dipakai juga untuk memuat videonya.
  if (typeof loadFullPreview === "function") loadFullPreview();
  const d = videoDuration();

  const info = $("#pilihDurasi");
  if (info) info.textContent = d ? `total ${jamRange(d)}` : "no video loaded";

  // penanda: rekomendasi AI tipis, potongan result padat
  const marks = $("#tlMarks");
  if (marks) {
    const recMarks = (DATA?.candidates || []).map((k) => `
      <span class="tl-mark rekom" style="left:${toFraction(k.startSec) * 100}%;
            width:${Math.max(0.4, (toFraction(k.endSec) - toFraction(k.startSec)) * 100)}%"
            title="${escapeHTML(k.title)}"></span>`).join("");
    const usedMarks = RESULT.map((r) => `
      <span class="tl-mark hasil" style="left:${toFraction(r.start) * 100}%;
            width:${Math.max(0.4, (toFraction(r.end) - toFraction(r.start)) * 100)}%"
            title="${escapeHTML(r.title)}"></span>`).join("");
    marks.innerHTML = recMarks + usedMarks;
  }

  // skala waktu: 5 label merata
  const scale = $("#tlSkala");
  if (scale) {
    scale.innerHTML = d
      ? [0, 0.25, 0.5, 0.75, 1].map((f) => `<span>${jamRange(d * f)}</span>`).join("")
      : "";
  }
  drawSelection();
}

function drawSelection() {
  const box = $("#tlSel");
  const button = $("#selAddBtn");
  if (!box) return;

  if (!SELECTION) {
    box.hidden = true;
    if (button) button.disabled = true;
    $("#selDur").textContent = "0s";
    $("#selTeks").textContent = "";
    return;
  }
  box.hidden = false;
  box.style.left = `${toFraction(SELECTION.start) * 100}%`;
  box.style.width = `${Math.max(0.3, (toFraction(SELECTION.end) - toFraction(SELECTION.start)) * 100)}%`;

  // Kolom angka tidak ditimpa selagi kamu mengetik di dalamnya.
  const a = $("#selStart"), b = $("#selEnd");
  if (a && document.activeElement !== a) a.value = jamRange(SELECTION.start);
  if (b && document.activeElement !== b) b.value = jamRange(SELECTION.end);

  const dur = SELECTION.end - SELECTION.start;
  $("#selDur").textContent = `${Math.round(dur)}s`;
  if (button) button.disabled = dur < 0.5;

  // Perlihatkan omongan di dalam rentangnya -- angka saja tidak cukup untuk
  // tahu apakah potongannya benar.
  const wordsEl = $("#selTeks");
  if (wordsEl) {
    const words = (realTranscript?.words || [])
      .filter((w) => w.start >= SELECTION.start && w.end <= SELECTION.end)
      .map((w) => w.text.trim());
    wordsEl.textContent = words.length
      ? (words.length > 60
          ? words.slice(0, 30).join(" ") + "  …  " + words.slice(-20).join(" ")
          : words.join(" "))
      : "no words in this range";
  }
}

/* ---------- menyetel seleksi ---------- */

function setSelection(start, end, snap) {
  const d = videoDuration();
  if (!d) return;
  start = Math.max(0, Math.min(d, start));
  end = Math.max(0, Math.min(d, end));
  if (end < start) [start, end] = [end, start];

  // Snap dipakai setelah geseran selesai, bukan selama menggeser -- kalau
  // tiap piksel ikut di-snap, kotaknya melompat-lompat dan susah diarahkan.
  if (snap && typeof snapToWord === "function" && realTranscript?.words?.length) {
    const a = snapToWord(start, "start");
    const b = snapToWord(end, "end");
    if (b > a) { start = a; end = b; }
  }
  SELECTION = { start, end };
  drawSelection();
}

function clearSelection() { SELECTION = null; drawSelection(); }

/* ---------- geser di batang ---------- */

function fracFromEvent(e, bar) {
  const r = bar.getBoundingClientRect();
  if (!r.width) return null;
  return Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
}

$("#tlTotal")?.addEventListener("pointerdown", (e) => {
  const bar = e.currentTarget;
  if (!videoDuration()) {
    $("#pilihNote").textContent = "no video or transcript yet";
    return;
  }
  const frac = fracFromEvent(e, bar);
  if (frac === null) return;

  // Disimpan supaya Escape bisa mengembalikan ke keadaan SEBELUM geseran ini
  // -- bukan cuma mengosongkan seleksi. Menggeser grip "start" pada seleksi
  // yang sudah ada dan menyesal di tengah jalan harusnya kembali ke seleksi
  // lama, bukan hilang semuanya.
  const previousSelection = SELECTION ? { ...SELECTION } : null;
  const grip = e.target.closest("[data-grip]");
  if (grip && SELECTION) {
    dragSelection = { kind: grip.dataset.grip, bar, previousSelection };
  } else {
    dragSelection = { kind: "new", bar, anchor: fracToSeconds(frac), previousSelection };
    setSelection(dragSelection.anchor, dragSelection.anchor, false);
  }
  bar.setPointerCapture(e.pointerId);
  e.preventDefault();
});

$("#tlTotal")?.addEventListener("pointermove", (e) => {
  if (!dragSelection) return;
  const frac = fracFromEvent(e, dragSelection.bar);
  if (frac === null) return;
  const t = fracToSeconds(frac);
  if (dragSelection.kind === "new") setSelection(dragSelection.anchor, t, false);
  else if (dragSelection.kind === "start") setSelection(t, SELECTION.end, false);
  else setSelection(SELECTION.start, t, false);
});

["pointerup", "pointercancel"].forEach((ev) =>
  $("#tlTotal")?.addEventListener(ev, () => {
    if (!dragSelection) return;
    dragSelection = null;
    if (SELECTION && SELECTION.end - SELECTION.start < 0.5) { clearSelection(); return; }
    if (SELECTION) {
      const before = `${SELECTION.start.toFixed(2)}-${SELECTION.end.toFixed(2)}`;
      setSelection(SELECTION.start, SELECTION.end, true);      // dirapikan ke batas kata
      const after = `${SELECTION.start.toFixed(2)}-${SELECTION.end.toFixed(2)}`;
      $("#pilihNote").textContent = before === after
        ? "range selected"
        : "cut point snapped to the nearest word boundary";
    }
  }));

/* Escape membatalkan. Dulu tidak ada jalan keluar sama sekali: mulai
   menggeser lalu berubah pikiran berarti harus menggeser balik sampai
   rentangnya kurang dari 0,5 detik supaya clearSelection() ikut kepicu --
   menjengkelkan, dan menggeser grip pada seleksi yang SUDAH ada malah
   menghapus semuanya, bukan kembali ke seleksi lama.

   Dua keadaan:
   - Sedang menggeser  -> kembali ke seleksi SEBELUM geseran ini (bukan
     kosong, kalau sebelumnya memang sudah ada seleksi).
   - Tidak sedang menggeser, tapi ada seleksi tersisa -> kosongkan saja,
     "aku sudah lihat, tidak jadi". */
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  const t = e.target;
  if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;

  if (dragSelection) {
    const { previousSelection } = dragSelection;
    // dragSelection dikosongkan lebih dulu, jadi pointerup/pointercancel yang
    // masih akan menyusul (jari/mouse belum tentu terangkat) langsung
    // no-op lewat `if (!dragSelection) return;` di atas -- capture-nya sendiri
    // dilepas otomatis oleh browser begitu pointer itu benar-benar terangkat.
    dragSelection = null;
    if (previousSelection) setSelection(previousSelection.start, previousSelection.end, false);
    else clearSelection();
    $("#pilihNote").textContent = "selection cancelled";
  } else if (SELECTION) {
    clearSelection();
    $("#pilihNote").textContent = "drag on the timeline to select a range";
  }
});

/* ---------- ketik menit:detik ---------- */

function readTimeColumns() {
  let a = parseTime($("#selStart").value);
  let b = parseTime($("#selEnd").value);
  if (a === null || b === null) {
    $("#pilihNote").textContent = "time format is mm:ss, e.g. 16:56";
    return;
  }
  // Kolom menampilkan jamRange() yang dibulatkan ke detik bulat. Kalau sebuah
  // kolom TIDAK diubah (nilai bulatnya masih sama dengan SELECTION), pertahankan
  // nilai presisi SELECTION -- jangan biarkan pembulatan tampilan menggeser
  // sisi yang tak disentuh sampai setengah detik saat mengedit sisi satunya.
  if (SELECTION) {
    if (Math.round(a) === Math.round(SELECTION.start)) a = SELECTION.start;
    if (Math.round(b) === Math.round(SELECTION.end)) b = SELECTION.end;
  }
  if (b <= a) {
    $("#pilihNote").textContent = "end time must be later than start";
    return;
  }
  // Angka di luar durasi video dulu dipangkas diam-diam jadi rentang nol, dan
  // tombolnya mati tanpa alasan yang kelihatan. Sekarang dikatakan.
  const d = videoDuration();
  if (d && a >= d) {
    $("#pilihNote").textContent =
      `${jamRange(a)} melewati akhir video (${jamRange(d)})`;
    return;
  }
  if (d && b > d) {
    $("#pilihNote").textContent =
      `dipendekkan ke akhir video (${jamRange(d)})`;
  } else {
    $("#pilihNote").textContent = "range set from the numbers";
  }
  setSelection(a, b, false);       // angka yang diketik dihormati apa adanya
}

["#selStart", "#selEnd"].forEach((sel) => {
  $(sel)?.addEventListener("change", readTimeColumns);
  $(sel)?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); e.target.blur(); }
  });
});

/* ---------- masukkan ke result ---------- */

$("#selAddBtn")?.addEventListener("click", () => {
  if (!SELECTION) return;
  const title = `Clip ${jamRange(SELECTION.start)}`;
  const rejected = addToResult(SELECTION.start, SELECTION.end, title, "manual");
  if (rejected) {
    $("#pilihNote").textContent = rejected;
    return;
  }
  $("#pilihNote").textContent = "added to Result";
  clearSelection();               // kotak seleksi dilepas, bukan ditinggal
});
