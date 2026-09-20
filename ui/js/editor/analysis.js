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

// pollJob()'s stop handle (app.js) -- replaces the raw interval id.
let analysisStop = null;



async function startAnalysis() {
  if (analysisStop) { analysisStop(); analysisStop = null; }
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

  /* Everything that is redrawn on every poll. Runs on the running ticks and
     once more at the end, so the final numbers match the last tick. */
  const paint = (t) => {
    const elapsed = (performance.now() - start) / 1000;
    const remaining = t.percent > 2 ? elapsed * (100 - t.percent) / t.percent : 0;

    $("#transcribeBar").style.width = `${t.percent || 0}%`;
    $("#fileDuration").textContent = timeRange(t.duration || 0);
    $("#analysisNote").textContent = `${name} · ${timeRange(t.duration || 0)}`;
    $("#transcribeStats").innerHTML = (t.cached
      ? ["from cache", "transcript already exists, not repeated"]
      : [`${t.percent || 0}%`,
         `${timeRange(t.position || 0)} of ${timeRange(t.duration || 0)}`,
         `running ${timeRange(elapsed)}`,
         `~${timeRange(remaining)} left`]
    ).map((x) => `<span>${x}</span>`).join("");

    // Battery warning: the difference can be twofold, and the user deserves
    // to know before waiting -- not after.
    if (t.battery && !$("#exportPanel").dataset.warning) {
      $("#exportPanel").dataset.warning = "true";
      const p = document.createElement("p");
      p.className = "step-note";
      p.style.color = "var(--danger)";
      p.textContent = "Laptop is running on battery — transcription can be twice " +
                      "as slow. Plug in the charger to speed it up.";
      $("#transcribeStats").after(p);
    }

  };

  if (analysisStop) analysisStop();
  analysisStop = pollJob(`/api/transcribe/${id}`, {
    interval: 900,
    onTick: paint,
    onFail: () => {
      analysisStop = null;
      $("#transcribeStats").innerHTML =
        "<span>Disconnected from the server. Try starting over.</span>";
    },
    onDone: (t) => {
      analysisStop = null;
      paint(t);
      if (t.state === "failed") {
        $("#transcribeStats").innerHTML = `<span>Failed: ${escapeHTML(t.error)}</span>`;
        return;
      }
      $("#transcribeStats").innerHTML = t.cached
        ? "<span>ready</span><span>transcript loaded from cache</span>"
        : `<span>done</span><span>${timeRange(t.duration)} transcribed</span>`;
      if (typeof prepareExport === "function") prepareExport(name);
    },
  });
}

/* The "Search clips" button on the Prepare screen runs this flow. */
$("#run")?.addEventListener("click", () => {
  toStage("work");
  toScreen("analysis");
  startAnalysis();
});
