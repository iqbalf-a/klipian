/* klipian — jalur manual & model potongan
   ==========================================================================
   Dua jalur menuju klip yang sama:

     A. round-trip Claude   drop -> ekspor -> Claude web -> impor
     B. manual              drop -> tentukan rentang sendiri

   Keduanya berakhir di editor yang sama. Yang membedakan hanya dari mana
   angka in/out berasal.

   ── Perubahan model yang penting ──────────────────────────────────────────
   Klip bukan lagi satu rentang, melainkan DAFTAR POTONGAN:

       clip.spans = [ {start, end}, {start, end}, ... ]

   Ini yang memungkinkan membuang bagian di tengah ("menit 2 diskip").
   Konsekuensinya: durasi keluaran = jumlah panjang potongan, dan caption
   harus dipetakan ke timeline KELUARAN, bukan timeline sumber -- setelah
   satu bagian dibuang, semua kata sesudahnya bergeser maju.

   Mekanisme yang sama juga yang membuang jeda panjang. Satu model, dua
   kegunaan.
   ========================================================================== */

/* Pastikan setiap klip punya potongan, termasuk yang datang dari impor. */
function ensureSpans(k) {
  if (!k.spans || !k.spans.length) {
    k.spans = [{ start: k.startSec ?? 0, end: k.endSec ?? 0 }];
  }
  return k;
}

const outputDuration = (k) =>
  (k.spans || []).reduce((t, p) => t + (p.end - p.start), 0);

/* Peta waktu sumber -> waktu keluaran. Dipakai caption nanti: kata di detik
   ke-150 sumber mungkin jatuh di detik ke-90 keluaran kalau ada yang dibuang. */
function toOutputTime(k, sourceSeconds) {
  let passed = 0;
  for (const p of k.spans) {
    if (sourceSeconds < p.start) return null;          // berada di bagian yang dibuang
    if (sourceSeconds <= p.end) return passed + (sourceSeconds - p.start);
    passed += p.end - p.start;
  }
  return null;
}

/* Buang rentang [a,b] dari daftar potongan; potongan yang terpotong dibelah. */
function dropRange(k, a, b) {
  const next = [];
  for (const p of k.spans) {
    if (b <= p.start || a >= p.end) { next.push(p); continue; }   // tidak bersinggungan
    if (a > p.start) next.push({ start: p.start, end: a });
    if (b < p.end) next.push({ start: b, end: p.end });
  }
  k.spans = next.filter((p) => p.end - p.start > 0.15);
  k.dur = Math.round(outputDuration(k));
  return k;
}

function drawSpans() {
  const k = DATA[mode].candidates.find((x) => x.title === $("#cutTitle").textContent);
  const note = $("#spansNote"), dur = $("#outDur");
  if (!k || !note) return;
  ensureSpans(k);
  const n = k.spans.length;
  note.textContent = n === 1 ? "1 potongan utuh" : `${n} potongan disambung`;
  dur.textContent = `durasi keluaran ${Math.round(outputDuration(k))}s`;
  $("#cutDur").textContent = `${Math.round(outputDuration(k))}s`;

  // Antrian menampilkan durasi klip yang sama. Tanpa ini barisnya masih
  // menulis 15s padahal potongannya sudah dibuang dan berkasnya jadi 11s.
  if (typeof drawQueue === "function" && typeof QUEUE !== "undefined" && QUEUE.length) {
    drawQueue();
  }
}

/* ---------- jalur manual: buat klip tanpa Claude ---------- */

$("#manualClip").addEventListener("click", () => {
  const total = (typeof realTranscript !== "undefined" && realTranscript)
    ? realTranscript.duration
    : (chosenSource?.duration || 600);

  // Mulai dari rentang tengah yang masuk akal; pengguna menggesernya sendiri
  // dengan mengklik kata, sama seperti klip hasil impor.
  const start = Math.max(0, total * 0.25);
  const end = Math.min(total, start + 45);

  const clip = ensureSpans({
    title: "Klip manual",
    hook: "Belum ada catatan — kamu yang menentukan rentangnya.",
    in: fmtStamp(start), out: fmtStamp(end),
    startSec: start, endSec: end,
    dur: Math.round(end - start),
    total: 0,
    scores: { hook: 0, complete: 0, payoff: 0 },
    reason: "Dibuat manual, tanpa penilaian AI.",
    manual: true,
  });

  const d = DATA[mode];
  d.candidates = [clip, ...d.candidates.filter((x) => !x.manual)];
  d.marks = d.candidates.map((x) => ({
    pos: (x.startSec / total) * 100,
    scores: x.total || 6,
    label: x.title.split(" ").slice(0, 3).join(" "),
  }));

  renderRibbon(); renderBoard(); renderList();
  if (typeof applyRealWords === "function" && typeof realTranscript !== "undefined" && realTranscript) {
    applyRealWords(clip);
  } else {
    $("#cutTitle").textContent = clip.title;
    $("#cutRange").textContent = `in ${clip.in} · out ${clip.out}`;
  }
  if (typeof setClip === "function") setClip(clip);
  if (typeof summarizeRender === "function") summarizeRender();
  drawSpans();
  toScreen("cut");
});

/* ---------- membuang bagian di tengah klip ---------- */

$("#dropSection").addEventListener("click", () => {
  const picked = [...document.querySelectorAll(".word.inside")];
  if (!picked.length) {
    $("#spansNote").textContent = "pilih dulu kata-kata yang mau dibuang";
    return;
  }
  const k = DATA[mode].candidates.find((x) => x.title === $("#cutTitle").textContent);
  if (!k || !realTranscript) return;
  ensureSpans(k);

  // petakan chip terpilih kembali ke waktu sumber lewat urutan katanya
  const all = [...document.querySelectorAll(".word")];
  const clipWords = realTranscript.words.filter(
    (w) => w.end > k.spans[0].start - 12 && w.start < k.spans.at(-1).end + 12);
  const iStart = all.indexOf(picked[0]);
  const iEnd = all.indexOf(picked.at(-1));
  const a = clipWords[iStart]?.start, b = clipWords[iEnd]?.end;
  if (a === undefined || b === undefined) return;

  // Chip juga menampilkan konteks di luar rentang klip. Membuang bagian
  // yang memang bukan bagian klip tidak berarti apa-apa -- katakan saja.
  const inside = k.spans.some((p) => b > p.start && a < p.end);
  if (!inside) {
    $("#spansNote").textContent = "Bagian itu di luar klip — pilih kata yang tersorot";
    return;
  }

  dropRange(k, a, b);
  picked.forEach((el) => { el.classList.remove("inside"); el.classList.add("dropped"); });
  drawSpans();
});
