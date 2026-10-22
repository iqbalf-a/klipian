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



/* `force`: transcribe even though a transcript already exists (the
   "Transcribe again" button). Without it the server uses the transcript it
   has -- see _run_transcribe. */
async function startAnalysis({ force = false } = {}) {
  if (analysisStop) { analysisStop(); analysisStop = null; }
  hideTranscriptActions();
  $("#transcribePanel").hidden = false;
  $("#transcribeTitle").textContent = "Transcript";
  $("#transcribeLabel").textContent = "";
  $("#transcribeLeave").hidden = true;
  $("#transcribeBar").style.width = "0%";
  $("#transcribeStats").innerHTML = "";
  const d = DATA;
  const name = chosenSource ? chosenSource.name : d.file;

  $("#analysisNote").textContent = name;
  $("#fileName").textContent = name;
  $("#error").hidden = true;
  $("#exportPanel").dataset.ready = "false";
  if (typeof invalidateBrief === "function") invalidateBrief();   // a new transcript is coming

  let id;
  try {
    const reply = await fetch("/api/transcribe", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(force ? { video: name, force: true } : { video: name }),
    }).then((r) => r.json());
    if (reply.error) throw new Error(reply.error);
    id = reply.id;
  } catch (err) {
    // Without a backend, don't pretend to transcribe.
    $("#transcribeStats").innerHTML =
      "<span>Needs the backend. Run: python -m klipian serve</span>";
    return;
  }

  let start = performance.now();

  /* Everything that is redrawn on every poll. Runs on the running ticks and
     once more at the end, so the final numbers match the last tick. */
  const paint = (t) => {
    const elapsed = (performance.now() - start) / 1000;
    // The first seconds of a run: the audio is listened to for cues (about
    // 12 s for an episode) before the transcript is made or loaded.
    if (t.state === "running" && t.stage === "cues" && !t.percent) {
      $("#transcribeStats").innerHTML = "<span>listening for laughter, music, applause …</span>";
      return;
    }
    if (t.state === "queued") {                    // another transcription (maybe another tab or profile) has Whisper's turn
      start = performance.now();                    // the time spent waiting is not transcribing time
      $("#transcribeBar").style.width = "0%";
      $("#transcribeTitle").textContent = "Transcript";
      $("#transcribeStats").innerHTML = `<span>${escapeHTML(t.queue?.text || "Waiting for its turn")}</span> `
        + `<button type="button" class="btn sm quiet" id="transcribeQueueCancel">Cancel</button>`;
      $("#transcribeQueueCancel").onclick = () => {
        fetch("/api/render/cancel", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
      };
      return;
    }
    const remaining = t.percent > 2 ? elapsed * (100 - t.percent) / t.percent : 0;

    $("#transcribeBar").style.width = `${t.percent || 0}%`;
    // What is actually running, from the job: the model and thread count the
    // server uses, not a fixed string. Cached means nothing runs at all.
    const running = t.state === "running" && !t.cached && t.stage !== "cues";
    $("#transcribeTitle").textContent = t.state === "failed" ? "Transcript"
      : running ? "Transcribing" : "Transcript";
    $("#transcribeLabel").textContent = t.model && !t.cached
      ? `${t.model} · CPU ${t.threads} threads` : "";
    $("#transcribeLeave").hidden = !(t.state === "running" && !t.cached && t.stage === "transcribe");
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
      if (t.state === "cancelled") {
        $("#transcribeStats").innerHTML = "<span>Cancelled: it was still waiting for its turn</span>";
        return;
      }
      $("#transcribeStats").innerHTML = t.cached
        ? "<span>ready</span><span>transcript loaded from cache</span>"
        : `<span>done</span><span>${timeRange(t.duration)} transcribed</span>`;
      // The source list's "not transcribed" is now stale (assets.js caches
      // the transcript listing).
      if (typeof renderAnalyzeSources === "function") { _transcriptList = null; renderAnalyzeSources(); }
      if (typeof prepareExport === "function") prepareExport(name);
      showTranscriptActions(t);
    },
  });
}

/* ---------- what to do about a transcript that already exists ---------- */

// Whisper's speed on this machine, plugged in and on battery (README,
// Performance): how long "Transcribe again" will take.
const TRANSCRIBE_SPEED = { plugged: 2.3, battery: 1.0 };
let retranscribeTimer = null;

function disarmRetranscribe() {
  clearTimeout(retranscribeTimer);
  const btn = $("#retranscribeBtn");
  if (btn) { btn.textContent = "Transcribe again"; btn.classList.remove("danger"); }
}

function hideTranscriptActions() {
  disarmRetranscribe();
  const panel = $("#transcribePanel");
  if (panel && !analysisStop) panel.hidden = true;
  $("#transcriptActions").hidden = true;
  $("#transcriptNote").hidden = true;
}

/* After the job reports a transcript (loaded from cache or just made). A
   transcript made with other settings, an older copy of the video or an older
   glossary is still the one in use; the sentence says so, and the button is
   how to replace it. */
function showTranscriptActions(t) {
  const note = $("#transcriptNote");
  note.textContent = t.cached && !t.exact
    ? "This transcript was made with older settings, an older copy of the video or an older " +
      "glossary than today's. It is still the one being used."
    : "";
  note.hidden = !note.textContent;
  $("#transcriptActions").hidden = false;
  $("#retranscribeBtn").dataset.minutes = String(Math.max(
    1, Math.round((t.duration || 0) / (t.battery ? TRANSCRIBE_SPEED.battery : TRANSCRIBE_SPEED.plugged) / 60)));
}

/* Two clicks: the first says what it costs, the second within 4 s starts it. */
$("#retranscribeBtn")?.addEventListener("click", (e) => {
  const btn = e.currentTarget;
  if (btn.classList.contains("danger")) {
    disarmRetranscribe();
    startAnalysis({ force: true });
    return;
  }
  btn.textContent = `Transcribe again? About ${btn.dataset.minutes} min`;
  btn.classList.add("danger");
  retranscribeTimer = setTimeout(disarmRetranscribe, 4000);
});

/* The "Search clips" button on the Prepare screen runs this flow. */
$("#run")?.addEventListener("click", () => {
  toStage("work");
  toScreen("analysis");
  startAnalysis();
});
