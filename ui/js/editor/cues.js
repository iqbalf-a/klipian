/* klipian — audio and timing cues
   ==========================================================================
   What klipian detected from the SOUND and the word timings (klipian/cues.py):
   laughter, applause/cheering, shouts, music (to avoid), long pauses, fast
   talk. They go into the brief for Claude, and onto each imported candidate
   (`cues`). This file shows them:

     Analyze   a chip per signal in the export panel, a note before and after
     Clips     a marker per cue on the timeline, a legend, a badge row on each
               AI suggestion

   `CUES` holds the active video's answer from GET /api/cues:
     { video, status: { audio, audio_error, timing }, cues: [...], counts }
   ========================================================================== */

let CUES = { video: null, status: { audio: "not run", audio_error: "", timing: "no transcript" }, cues: [], counts: {} };

/* One place for how each signal is named and explained. `source` says which
   detector must have run for the chip to mean anything. */
const CUE_KINDS = [
  { kind: "laughter", label: "Laughter", one: "Laughter", short: "a laugh after a line: it landed", source: "audio",
    what: "Laughter in the recording: the speakers', the crew's or an audience's.",
    how: "Detected from the sound by a small model that runs on this computer, not from the words.",
    use: "Claude is told where it is and how strong. A laugh right after a line is evidence the line landed. It is a reaction, not a starting point: the clip starts where the topic begins and ends after the laugh." },
  { kind: "applause", label: "Applause", one: "Applause", short: "a payoff; the clip should end after it", source: "audio",
    what: "Clapping and cheering.",
    how: "Detected from the sound by a small model that runs on this computer.",
    use: "Treated like strong laughter: a payoff, a reaction. The clip starts where its topic begins and ends after the applause." },
  { kind: "shout", label: "Shouts", one: "Shout", short: "strong emotion; the topic still starts the clip", source: "audio",
    what: "Shouting, yelling, screaming and gasps.",
    how: "Detected from the sound by a small model that runs on this computer.",
    use: "A sign of a strong emotion. The clip still starts at the beginning of its topic, not at the shout, unless the shout is itself a self-contained opening." },
  { kind: "music", label: "Music", one: "Music", short: "to avoid: intros, ads, copyright", source: "audio", avoid: true,
    what: "Longer stretches of music: intros, outros, ads.",
    how: "Detected from the sound by a small model that runs on this computer.",
    use: "Marked 'avoid': a stretch to keep out, not a cut point. A clip should not run into it (and it is a copyright risk)." },
  { kind: "pause", label: "Pauses", one: "Pause", short: "silence before a confession or punchline", source: "timing",
    what: "Three seconds or more of silence between two words.",
    how: "Counted from the transcript's word times, not from the audio.",
    use: "Sits in the middle of a moment. The line after the pause is quoted: often the punchline, but the clip starts at the beginning of its topic." },
  { kind: "fast talk", label: "Fast talk", one: "Fast talk", short: "an excited, building story", source: "timing",
    what: "Stretches where the speaker talks much faster than usual in this video.",
    how: "Counted from the transcript's word times: words per 10 s above the 95th percentile of this video.",
    use: "The peak of an excited story, not its start; supports the emotion score. The clip starts where the story begins." },
];

const cueInfoIcon = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
  stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <circle cx="12" cy="12" r="9"/><path d="M12 11 L12 16"/><circle cx="12" cy="7.8" r=".6" fill="currentColor"/></svg>`;

/* The name for a count: "1 Shout", "2 Shouts"; "Laughter" and "Fast talk" do not change. */
const cueLabel = (def, n) => (n === 1 ? def.one : def.label);

/* "found" | "none" | "notrun" | "failed", and the words for it. The one place
   that decides what a signal's status is: the chips, the legend and the
   "Hooks Find clips listens for" list all read it. */
function cueState(def) {
  const s = CUES.status || {};
  const n = (CUES.counts || {})[def.kind] || 0;
  const detector = def.source === "audio" ? s.audio : s.timing;
  if (detector === "failed") return { state: "failed", text: "failed" };
  if (detector === "no transcript") return { state: "notrun", text: "waiting for transcript" };
  if (detector !== "ok") return { state: "notrun", text: "not run yet" };
  return n ? { state: "found", text: String(n) } : { state: "none", text: "none found" };
}

function cueChipHTML(def, { info = true } = {}) {
  const st = cueState(def);
  return `<span class="cue-chip" role="listitem" data-kind="${def.kind}" data-state="${st.state}">
    <i class="cue-dot" aria-hidden="true"></i>
    <span class="cue-label">${cueLabel(def, (CUES.counts || {})[def.kind] || 0)}${def.avoid ? " (avoid)" : ""}</span>
    <b>${st.text}</b>
    ${info ? `<button class="cue-info" type="button" data-cue-info="${def.kind}"
      aria-label="About ${def.label}">${cueInfoIcon}</button>` : ""}
  </span>`;
}

/* The chips in "Export for Claude": what went into the brief. Only once there
   is a transcript to build it from; before that the panel is dimmed, and
   counts on it would promise a file that can't be downloaded yet. */
function drawCueChips() {
  const box = $("#cueChips");
  if (box) {
    const ready = $("#exportPanel")?.dataset.ready === "true";
    box.innerHTML = ready
      ? CUE_KINDS.map((d) => cueChipHTML(d)).join("")
      : `<span class="cue-wait">The cues found in the video are added to this file once the transcript is ready.</span>`;
  }
  drawHooksList();
}

/* "Hooks Find clips listens for", above the Find clips button: every signal
   it looks for, always shown, with its own status (a count, none found, not
   run yet, waiting for the transcript, failed). */
function drawHooksList() {
  const box = $("#hooksList");
  if (!box) return;
  box.innerHTML = CUE_KINDS.map((d) => {
    const st = cueState(d);
    const n = (CUES.counts || {})[d.kind] || 0;
    return `<li class="hook-row" data-kind="${d.kind}" data-state="${st.state}">
      <i class="cue-dot" aria-hidden="true"></i>
      <span class="hook-name">${cueLabel(d, n)}${d.avoid ? " (avoid)" : ""}</span>
      <span class="hook-short">${d.short}</span>
      <button class="cue-info" type="button" data-cue-info="${d.kind}" aria-label="About ${d.label}">${cueInfoIcon}</button>
      <b class="hook-status">${st.text}</b>
    </li>`;
  }).join("");
  const s = CUES.status || {};
  const note = $("#hooksNote");
  if (note) {
    note.hidden = s.audio !== "failed";
    note.textContent = s.audio === "failed"
      ? `The audio analysis failed (${s.audio_error || "unknown error"}). Pauses and fast talk still come from the transcript.`
      : "";
  }
}

async function loadCues(videoName) {
  if (!videoName) return;
  try {
    const d = await (await fetch(`/api/cues?video=${encodeURIComponent(videoName)}`)).json();
    CUES = { video: videoName, status: d.status, cues: d.cues || [], counts: d.counts || {} };
  } catch {
    CUES = { video: videoName, status: { audio: "not run", audio_error: "", timing: "no transcript" }, cues: [], counts: {} };
  }
  drawCueChips();
  if (typeof drawTotalTimeline === "function") drawTotalTimeline();
}

/* The active video's cues, or none while another video's are loaded. */
function activeCues() {
  return (typeof chosenSource !== "undefined" && chosenSource?.name === CUES.video) ? CUES.cues : [];
}

/* ---------- Clips: timeline markers, legend, badges ---------- */

function cueTitle(c) {
  const when = c.end > c.start + 0.5 ? `${timeRange(c.start)}–${timeRange(c.end)}` : timeRange(c.start);
  return `${c.kind}${c.level ? ` · ${c.level}` : ""} · ${when}`;
}

/* Thin bands along the bottom of the timeline bar, one colour per kind. */
function cueMarksHTML() {
  return activeCues().map((c) => `
    <span class="tl-mark cue" data-kind="${c.kind}" data-level="${c.level || ""}"
          style="left:${toFraction(c.start) * 100}%;
                 width:${Math.max(0.3, (toFraction(c.end) - toFraction(c.start)) * 100)}%"
          title="${escapeHTML(cueTitle(c))}"></span>`).join("");
}

function drawCueLegend() {
  const el = $("#cueLegend");
  if (!el) return;
  const present = CUE_KINDS.filter((d) => (CUES.counts || {})[d.kind]);
  el.hidden = !present.length;
  el.innerHTML = present.map((d) => cueChipHTML(d, { info: false })).join("");
}

/* The row under an AI suggestion: its strongest cues, in time order. */
function cueBadgesHTML(k) {
  const cues = Array.isArray(k.cues) ? k.cues : [];
  if (!cues.length) return "";
  const rank = { high: 3, medium: 2, low: 1, avoid: 0 };
  const shown = [...cues].sort((a, b) => (rank[b.level] ?? 1) - (rank[a.level] ?? 1)).slice(0, 4)
    .sort((a, b) => a.start - b.start);
  const more = cues.length - shown.length;
  return `<span class="rec-cues">${shown.map((c) => `
      <span class="cue-badge" data-kind="${c.kind}" title="${escapeHTML(cueTitle(c))}">
        <i class="cue-dot" aria-hidden="true"></i>${c.kind}${c.level ? ` ${c.level}` : ""} ${timeRange(c.start)}</span>`).join("")}
      ${more > 0 ? `<span class="cue-badge more">+${more}</span>` : ""}</span>`;
}

/* ---------- the explanation behind each chip's (i) ----------
   One floating element, not a CSS tooltip: the chips live inside panels that
   clip anything that sticks out. */
function showCueTip(btn) {
  const def = CUE_KINDS.find((d) => d.kind === btn.dataset.cueInfo);
  const tip = $("#cueTip");
  if (!def || !tip) return;
  tip.innerHTML = `<b>${def.label}</b><p>${def.what}</p><p><span>Detected</span> ${def.how}</p><p><span>For Claude</span> ${def.use}</p>`;
  tip.hidden = false;
  const r = btn.getBoundingClientRect();
  const w = tip.offsetWidth, h = tip.offsetHeight;
  let left = Math.min(Math.max(8, r.left + r.width / 2 - w / 2), window.innerWidth - w - 8);
  let top = r.top - h - 8;
  if (top < 8) top = r.bottom + 8;
  tip.style.left = `${left}px`;
  tip.style.top = `${top}px`;
}
function hideCueTip() { const tip = $("#cueTip"); if (tip) tip.hidden = true; }

document.addEventListener("mouseover", (e) => { const b = e.target.closest?.(".cue-info"); if (b) showCueTip(b); });
document.addEventListener("mouseout", (e) => { if (e.target.closest?.(".cue-info")) hideCueTip(); });
document.addEventListener("focusin", (e) => { const b = e.target.closest?.(".cue-info"); if (b) showCueTip(b); });
document.addEventListener("focusout", (e) => { if (e.target.closest?.(".cue-info")) hideCueTip(); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape") hideCueTip(); });

drawCueChips();
