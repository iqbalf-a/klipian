/* klipian — alur analisis
   ==========================================================================
   Menjalankan tahap Analisis memakai DURASI ASLI file yang dijatuhkan, bukan
   angka tetap. Progressnya masih simulasi -- belum ada mesin di belakangnya --
   tapi setiap angka yang ditampilkan diturunkan dari durasi sungguhan dan
   dari kecepatan yang benar-benar terukur di mesin ini (2.3x realtime pada
   large-v3-turbo, podcast Indonesia 42 menit selesai dalam 18:16).

   Waktu tunggunya dimampatkan supaya bisa diperagakan; jam yang ditampilkan
   tetap realistis.
   ========================================================================== */

let analysisTimer = null;

const fmtClock = (seconds) => {
  if (!isFinite(seconds) || seconds < 0) seconds = 0;
  const t = Math.round(seconds);
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
};

/* Ribbon selama analisis: belum ada temuan, jadi tidak boleh ada sapuan.
   Yang ditampilkan garis pemindaian yang merambat. */

async function startAnalysis() {
  clearInterval(analysisTimer);
  const d = DATA;
  const name = chosenSource ? chosenSource.name : d.file;

  $("#analysisNote").textContent = name;
  $("#fileName").textContent = name;
  $("#error").hidden = true;
  $("#exportPanel").dataset.ready = "false";

  let id;
  try {
    const reply = await fetch("/api/transcribe", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ video: name }),
    }).then((r) => r.json());
    if (reply.error) throw new Error(reply.error);
    id = reply.id;
  } catch (err) {
    // Tanpa backend, jangan berpura-pura mentranskripsi.
    $("#transcribeStats").innerHTML =
      "<span>Needs the backend. Run: python -m klipian serve</span>";
    return;
  }

  const start = performance.now();
  analysisTimer = setInterval(async () => {
    let t;
    try { t = await (await fetch(`/api/transcribe/${id}`)).json(); }
    catch { return; }

    const elapsed = (performance.now() - start) / 1000;
    const remaining = t.percent > 2 ? elapsed * (100 - t.percent) / t.percent : 0;

    $("#transcribeBar").style.width = `${t.percent || 0}%`;
    $("#fileDuration").textContent = fmtClock(t.duration || 0);
    $("#analysisNote").textContent = `${name} · ${fmtClock(t.duration || 0)}`;
    $("#transcribeStats").innerHTML = (t.cached
      ? ["from cache", "transkrip sudah ada, tidak diulang"]
      : [`${t.percent || 0}%`,
         `${fmtClock(t.position || 0)} dari ${fmtClock(t.duration || 0)}`,
         `berjalan ${fmtClock(elapsed)}`,
         `sisa ~${fmtClock(remaining)}`]
    ).map((x) => `<span>${x}</span>`).join("");

    // Peringatan baterai: bedanya bisa dua kali lipat, dan pengguna berhak
    // tahu sebelum menunggu -- bukan setelah.
    if (t.battery && !$("#exportPanel").dataset.warning) {
      $("#exportPanel").dataset.warning = "true";
      const p = document.createElement("p");
      p.className = "step-note";
      p.style.color = "var(--bahaya)";
      p.textContent = "Laptop sedang pakai baterai — transkripsi bisa dua kali " +
                      "lebih lambat. Colokkan charger untuk mempercepat.";
      $("#transcribeStats").after(p);
    }

    if (t.state !== "running") {
      clearInterval(analysisTimer);
      if (t.state === "failed") {
        $("#transcribeStats").innerHTML = `<span>Failed: ${escapeHTML(t.error)}</span>`;
        return;
      }
      $("#transcribeStats").innerHTML = t.cached
        ? "<span>siap</span><span>transkrip diambil dari cache</span>"
        : `<span>selesai</span><span>${fmtClock(t.duration)} ditranskripsi</span>`;
      if (typeof prepareExport === "function") prepareExport(name);
    }
  }, 900);
}

/* Tombol "Cari klip" di layar Siapkan menjalankan alur ini. */
$("#run").addEventListener("click", () => {
  toStage("work");
  toScreen("analysis");
  startAnalysis();
});
