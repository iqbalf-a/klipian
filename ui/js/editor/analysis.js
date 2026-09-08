/* klipian — analysis flow
   ==========================================================================
   Runs the Analysis stage using the ORIGINAL DURATION of the dropped file,
   not a fixed number. Progress is still simulated -- there is no engine
   behind it -- but every displayed value is derived from the real duration
   and from a speed actually measured on this engine (2.3x realtime on
   large-v3-turbo, a 42-minute Indonesian podcast finishes in 18:16).

   Wait time is compressed so it can be demonstrated; the displayed clock
   remains realistic.
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

/* Ribbon during analysis: no findings yet, so no sweep should appear.
   Instead, a scanning line that creeps across is shown. */

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
    // Without a backend, don't pretend to transcribe.
    $("#transcribeStats").innerHTML =
      "<span>Needs the backend. Run: python -m klipian serve</span>";
    return;
  }

  const start = performance.now();
  let consecutiveFailures = 0;
  analysisTimer = setInterval(async () => {
    let t;
    try {
      t = await (await fetch(`/api/transcribe/${id}`)).json();
      consecutiveFailures = 0;
    } catch {
      // Server down / job lost: stop after a few failures instead of
      // spinning the interval forever with no feedback to the user.
      if (++consecutiveFailures >= 5) {
        clearInterval(analysisTimer);
        $("#transcribeStats").innerHTML =
          "<span>Terputus dari server. Coba mulai ulang.</span>";
      }
      return;
    }

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

    // Battery warning: the difference can be twofold, and the user deserves
    // to know before waiting -- not after.
    if (t.battery && !$("#exportPanel").dataset.warning) {
      $("#exportPanel").dataset.warning = "true";
      const p = document.createElement("p");
      p.className = "step-note";
      p.style.color = "var(--danger)";
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

/* The "Search clips" button on the Prepare screen runs this flow. */
$("#run").addEventListener("click", () => {
  toStage("work");
  toScreen("analysis");
  startAnalysis();
});
