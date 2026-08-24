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

let SEL = null;             // { start, end } dalam detik sumber, atau null
let seretSel = null;        // keadaan sementara saat menggeser

const durasiVideo = () =>
  realTranscript?.duration || chosenSource?.duration || 0;

/* detik -> pecahan 0..1 di sepanjang batang, dan sebaliknya */
const keFrac = (t) => { const d = durasiVideo(); return d ? Math.max(0, Math.min(1, t / d)) : 0; };
const keDetik = (frac) => Math.max(0, Math.min(durasiVideo(), frac * durasiVideo()));

/* "16:56" -> 1016. Menerima "1:02:03" juga. Kembalikan null kalau ngawur. */
function bacaWaktu(teks) {
  const bagian = String(teks).trim().split(":");
  if (!bagian.length || bagian.some((b) => b.trim() === "" || isNaN(Number(b)))) return null;
  const detik = bagian.reduce((a, b) => a * 60 + Number(b), 0);
  return Number.isFinite(detik) ? detik : null;
}

/* ---------- menggambar ---------- */

function drawTotalTimeline() {
  const bar = $("#tlTotal");
  if (!bar) return;
  const d = durasiVideo();

  const info = $("#pilihDurasi");
  if (info) info.textContent = d ? `total ${jamRange(d)}` : "belum ada video";

  // penanda: rekomendasi AI tipis, potongan result padat
  const marks = $("#tlMarks");
  if (marks) {
    const rekom = (DATA[mode]?.candidates || []).map((k) => `
      <span class="tl-mark rekom" style="left:${keFrac(k.startSec) * 100}%;
            width:${Math.max(0.4, (keFrac(k.endSec) - keFrac(k.startSec)) * 100)}%"
            title="${escapeHTML(k.title)}"></span>`).join("");
    const dipakai = RESULT.map((r) => `
      <span class="tl-mark hasil" style="left:${keFrac(r.start) * 100}%;
            width:${Math.max(0.4, (keFrac(r.end) - keFrac(r.start)) * 100)}%"
            title="${escapeHTML(r.title)}"></span>`).join("");
    marks.innerHTML = rekom + dipakai;
  }

  // skala waktu: 5 label merata
  const skala = $("#tlSkala");
  if (skala) {
    skala.innerHTML = d
      ? [0, 0.25, 0.5, 0.75, 1].map((f) => `<span>${jamRange(d * f)}</span>`).join("")
      : "";
  }
  drawSelection();
}

function drawSelection() {
  const kotak = $("#tlSel");
  const tombol = $("#selAddBtn");
  if (!kotak) return;

  if (!SEL) {
    kotak.hidden = true;
    if (tombol) tombol.disabled = true;
    $("#selDur").textContent = "0s";
    $("#selTeks").textContent = "";
    return;
  }
  kotak.hidden = false;
  kotak.style.left = `${keFrac(SEL.start) * 100}%`;
  kotak.style.width = `${Math.max(0.3, (keFrac(SEL.end) - keFrac(SEL.start)) * 100)}%`;

  // Kolom angka tidak ditimpa selagi kamu mengetik di dalamnya.
  const a = $("#selStart"), b = $("#selEnd");
  if (a && document.activeElement !== a) a.value = jamRange(SEL.start);
  if (b && document.activeElement !== b) b.value = jamRange(SEL.end);

  const dur = SEL.end - SEL.start;
  $("#selDur").textContent = `${Math.round(dur)}s`;
  if (tombol) tombol.disabled = dur < 0.5;

  // Perlihatkan omongan di dalam rentangnya -- angka saja tidak cukup untuk
  // tahu apakah potongannya benar.
  const teks = $("#selTeks");
  if (teks) {
    const kata = (realTranscript?.words || [])
      .filter((w) => w.start >= SEL.start && w.end <= SEL.end)
      .map((w) => w.text.trim());
    teks.textContent = kata.length
      ? (kata.length > 60
          ? kata.slice(0, 30).join(" ") + "  …  " + kata.slice(-20).join(" ")
          : kata.join(" "))
      : "tidak ada kata di rentang ini";
  }
}

/* ---------- menyetel seleksi ---------- */

function setSelection(start, end, snap) {
  const d = durasiVideo();
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
  SEL = { start, end };
  drawSelection();
}

function clearSelection() { SEL = null; drawSelection(); }

/* ---------- geser di batang ---------- */

function fracDariEvent(e, bar) {
  const r = bar.getBoundingClientRect();
  if (!r.width) return null;
  return Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
}

$("#tlTotal")?.addEventListener("pointerdown", (e) => {
  const bar = e.currentTarget;
  if (!durasiVideo()) {
    $("#pilihNote").textContent = "belum ada video atau transkrip";
    return;
  }
  const frac = fracDariEvent(e, bar);
  if (frac === null) return;

  const grip = e.target.closest("[data-grip]");
  if (grip && SEL) {
    seretSel = { jenis: grip.dataset.grip, bar };
  } else {
    seretSel = { jenis: "baru", bar, jangkar: keDetik(frac) };
    setSelection(seretSel.jangkar, seretSel.jangkar, false);
  }
  bar.setPointerCapture(e.pointerId);
  e.preventDefault();
});

$("#tlTotal")?.addEventListener("pointermove", (e) => {
  if (!seretSel) return;
  const frac = fracDariEvent(e, seretSel.bar);
  if (frac === null) return;
  const t = keDetik(frac);
  if (seretSel.jenis === "baru") setSelection(seretSel.jangkar, t, false);
  else if (seretSel.jenis === "start") setSelection(t, SEL.end, false);
  else setSelection(SEL.start, t, false);
});

["pointerup", "pointercancel"].forEach((ev) =>
  $("#tlTotal")?.addEventListener(ev, () => {
    if (!seretSel) return;
    seretSel = null;
    if (SEL && SEL.end - SEL.start < 0.5) { clearSelection(); return; }
    if (SEL) {
      const sebelum = `${SEL.start.toFixed(2)}-${SEL.end.toFixed(2)}`;
      setSelection(SEL.start, SEL.end, true);      // dirapikan ke batas kata
      const sesudah = `${SEL.start.toFixed(2)}-${SEL.end.toFixed(2)}`;
      $("#pilihNote").textContent = sebelum === sesudah
        ? "rentang dipilih"
        : "titik potong dirapikan ke batas kata terdekat";
    }
  }));

/* ---------- ketik menit:detik ---------- */

function bacaKolomWaktu() {
  const a = bacaWaktu($("#selStart").value);
  const b = bacaWaktu($("#selEnd").value);
  if (a === null || b === null) {
    $("#pilihNote").textContent = "format waktunya menit:detik, misal 16:56";
    return;
  }
  if (b <= a) {
    $("#pilihNote").textContent = "waktu selesai harus lebih besar dari mulai";
    return;
  }
  // Angka di luar durasi video dulu dipangkas diam-diam jadi rentang nol, dan
  // tombolnya mati tanpa alasan yang kelihatan. Sekarang dikatakan.
  const d = durasiVideo();
  if (d && a >= d) {
    $("#pilihNote").textContent =
      `${jamRange(a)} melewati akhir video (${jamRange(d)})`;
    return;
  }
  if (d && b > d) {
    $("#pilihNote").textContent =
      `dipendekkan ke akhir video (${jamRange(d)})`;
  } else {
    $("#pilihNote").textContent = "rentang disetel dari angka";
  }
  setSelection(a, b, false);       // angka yang diketik dihormati apa adanya
}

["#selStart", "#selEnd"].forEach((sel) => {
  $(sel)?.addEventListener("change", bacaKolomWaktu);
  $(sel)?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); e.target.blur(); }
  });
});

/* ---------- masukkan ke result ---------- */

$("#selAddBtn")?.addEventListener("click", () => {
  if (!SEL) return;
  const judul = `Potongan ${jamRange(SEL.start)}`;
  const tolak = addToResult(SEL.start, SEL.end, judul, "manual");
  if (tolak) {
    $("#pilihNote").textContent = tolak;
    return;
  }
  $("#pilihNote").textContent = "masuk ke result";
  clearSelection();               // kotak seleksi dilepas, bukan ditinggal
});
