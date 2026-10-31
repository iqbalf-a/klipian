/* klipian — the /remotion page: a fun-fact motion video from a typed topic, with no API key (klipian/motion.py)
   ==========================================================================
   The flow, top to bottom for the chosen video (Khusus, the main flow; ui/js/remotion/steps.js has the order and the one-line summaries):
     1 Video baru           the topic, the length and the options (loop, "Intip yuk!", music, voice apps) are chosen in the form on the left
     2 Brief                one file to copy into Claude Code; "Ubah pilihan" changes the options and the brief follows
     3 Ambil cerita         the story.json of the folder Claude Code made; the storyboard (texts and timing) is read and edited here
     4 Cek fakta + judul    every claim and its sources, checked or rejected by a person; one title
     5 Naskah suara         the text for each voice app, used BEFORE the voice is made
     6 Impor suara          the voice file, matched to the words; the match table
     7 Pratinjau            a half-size draft with sound
     8 Render               refused by the server until the claims, the title, the folder and the voice agree; progress, time left and Cancel
   Steps are folded: only the active one is open (the server's next step), a finished one shows a summary line. Otomatis (hidden under "Pengaturan lanjutan")
   has the AI's pasted answer in place of the folder.
   This file holds the step table and the job poll; page-core.js (loads first) holds the shared state and helpers; the rest is split by part: page-list.js, page-detail.js, page-steps-1.js (steps 1-3),
   page-steps-2.js (4-6), page-steps-3.js (7-8). It loads last (remotion.html) and starts the page.
   Nothing here knows a rule of the story or of the status: the next step, the chips, the render block and the lengths come from the server's detail.
   ========================================================================== */

const STEP_BODY = { new: bodyNew, brief: bodyBrief, story: bodyStory, answer: bodyAnswer, facts: bodyFacts, script: bodyScript, voice: bodyVoice, preview: bodyPreview, render: bodyRender };

// ---------------------------------------------------------------------------------------------------------------------------------------
// the job: poll while it runs, tell the person when it ends
// ---------------------------------------------------------------------------------------------------------------------------------------

function stopPoll() { if (POLL) { clearInterval(POLL); POLL = null; } }
function startPoll() {
  stopPoll();
  POLL = setInterval(tick, 1000);
}

async function tick() {
  if (!CUR) return stopPoll();
  const id = CUR.id;
  let j;
  try { j = await call(`${API}/status?id=${encodeURIComponent(id)}`); } catch { return; }
  if (!CUR || CUR.id !== id) return;
  const was = CUR.job || {};
  CUR.job = j.job;
  if (["queued", "running"].includes(j.job.state)) {
    if (j.job.kind === "render") { if (OPEN === "render") drawSteps(); }
    else if (j.job.kind === "voice") { const n = byId("rmVoiceNote"); if (n) n.textContent = `${j.job.message || ""} ${j.job.percent || 0}%`; }
    else if (j.job.kind === "preview-video") { const n = byId("rmPreviewVideoNote"); if (n) n.textContent = `${j.job.message || ""} ${j.job.percent || 0}%`; }
    else { const n = byId("rmPreviewNote"); if (n) n.textContent = `${j.job.message || ""} ${j.job.percent || 0}%`; }
    return;
  }
  stopPoll();
  await refresh();
  if (was.state === j.job.state) return;
  const key = `motion:${id}:${j.job.started}`;
  if (j.job.kind === "render" && j.job.state === "done") {
    notifyDone({ key, title: "Video motion selesai", body: CUR.title || CUR.topic, kind: "success", action: { label: "Buka Clips", onClick: () => { location.href = "/workspace"; } } });
  } else if (j.job.state === "failed") {
    notifyDone({ key, title: j.job.kind === "render" ? "Render gagal" : "Storyboard gagal", body: j.job.message || "", kind: "failure" });
  } else if (j.job.state === "cancelled") {
    notifyDone({ key, title: "Dibatalkan", kind: "failure", quiet: true });
  } else if (j.job.kind === "voice" && j.job.state === "done") {
    notifyDone({ key, title: "Narasi dicocokkan", body: j.job.note || "", kind: "success", quiet: true });
  } else if (j.job.kind === "preview-video" && j.job.state === "done") {
    notifyDone({ key, title: "Pratinjau video siap", body: j.job.message || "", kind: "success", quiet: true });
  } else if (j.job.kind === "preview" && j.job.state === "done") {
    notifyDone({ key, title: "Gambar storyboard siap", kind: "success", quiet: true });
  }
}

loadList();
