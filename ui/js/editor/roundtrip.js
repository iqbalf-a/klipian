/* klipian — round-trip via Claude web
   ==========================================================================
   Flow:

     1  drop video on the Prepare screen
     2  app builds a file containing rubric + transcript            -> Download
     3  that file is dropped into Claude web, ask it to "work on it"
     4  Claude web replies with JSON
     5  JSON is pasted here                                        -> Import
     6  app cuts according to JSON, clips appear in Candidates

   No API key in this path. The only cost is your existing Claude subscription.

   The transcript is REAL: read from workspace/cache/ populated by `klipian transcribe`.
   The server serves the project root, so the UI can reach it.
   ========================================================================== */

const ROOT = "../";                       // ui/ -> project root
let realTranscript = null;                // { duration, segments[], words[] }

/* ---------- finding a transcript that matches the dropped file ----
   The cache filename contains a fingerprint, so we match via its stem:
   radityadika-podcast.mp4 -> radityadika-podcast.*.transcript.json */

async function listCache() {
  // The klipian server provides the listing via API. If the UI is opened via
  // a plain http.server, fall back to its HTML directory listing.
  try {
    const d = await (await fetch("/api/cache")).json();
    if (d.transcript?.length) return d.transcript;
  } catch { /* fall back to directory listing */ }
  try {
    const html = await (await fetch(ROOT + "workspace/cache/")).text();
    return [...html.matchAll(/href="([^"]+\.transcript\.json)"/g)].map((m) => m[1]);
  } catch {
    return [];
  }
}

async function findTranscript(videoName) {
  const stem = videoName.replace(/\.[^.]+$/, "");
  const all = await listCache();
  const matched = all.find((f) => decodeURIComponent(f).startsWith(stem + "."));
  if (!matched) return null;
  const d = await (await fetch(ROOT + "workspace/cache/" + matched)).json();
  d.words = d.segments.flatMap((s) => s.words || []);
  return d;
}

/* ---------- step 2: building the file for Claude ---------- */

const fmtStamp = (d) => {
  const t = Math.round(d);
  return t < 3600
    ? `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`
    : `${Math.floor(t / 3600)}:${String(Math.floor((t % 3600) / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
};

async function buildBrief(name) {
  // Just one rubric now that categories were removed. This one works from the transcript,
  // so it applies to any source that has audio.
  const rubricFile = "dialog-podcast.md";
  let rubric = "";
  try { rubric = await (await fetch(ROOT + "prompts/rubrik/" + rubricFile)).text(); } catch {}
  rubric = rubric.replace(/^# .*\n+/, "").replace(/^Ini yang dibaca Claude[\s\S]*?---\s*\n+/, "");

  const row = realTranscript.segments
    .filter((s) => s.text.trim())
    .map((s) => `[${fmtStamp(s.start)}] ${s.text.trim()}`)
    .join("\n");

  // SEPARATE signal from the transcript -- purely from audio volume (see
  // klipian/audio_energy.py), triggered automatically once per video alongside
  // transcription. Whisper rarely captures laughter/strong reactions as reliable
  // text; this is actual measured evidence, not punctuation guesswork.
  // Empty if not yet analyzed OR if there simply are no prominent moments --
  // both are the same here: the section is skipped.
  let energyBlock = "";
  try {
    const d = await (await fetch(`/api/audio-energy?video=${encodeURIComponent(name)}`)).json();
    if (d.moments?.length) {
      const energyList = d.moments
        .map((m) => `- [${fmtStamp(m.start)}] – [${fmtStamp(m.end)}]`).join("\n");
      energyBlock = `

---

## Prominent audio-energy moments (from volume analysis, NOT the transcript)

The following time ranges have sound energy well above this video's own
average -- could be audience laughter, cheering, a loud reaction, or a
dramatic moment. This is a SUPPORTING signal, not a certain fact: cross-
check it against the transcript's sentences around that time before using
it as a reason for a score.

${energyList}
`;
    }
  } catch { /* no backend means nothing to fetch -- brief still works without this section */ }

  return `# Find clips — ${name}

Hello. Please read the transcript at the bottom of this file and pick moments
worth turning into short vertical videos.

**Source duration:** ${fmtStamp(realTranscript.duration)} · **${realTranscript.words.length} words**

The times you give don't need to be precise. Approximate min:sec is fine;
klipian will snap the cut points to the nearest word boundary.

---

## Evaluation rubric

${rubric}

---

## Answer format

Reply with **a single JSON block** exactly like this, no extra explanation
outside the block.

\`\`\`json
{
  "source": "${name}",
  "clips": [
    {
      "start": "0:12",
      "end": "1:07",
      "title": "Lose 300M Because of Timing",
      "hook": "exact quote from transcript",
      "scores": { "hook": 9, "complete": 8, "payoff": 9, "emotion": 8, "duration": 9 },
      "reason": "one or two sentences for a human to read"
    }
  ]
}
\`\`\`
${energyBlock}
---

## Transcript

${row}
`;
}

/* ---------- step 5: reading Claude's reply ---------- */

const toSeconds = (t) => {
  // Empty string/space -> NaN, not 0. Number("") is 0, so without this guard
  // "start": "" would pass Number.isFinite and become a clip starting at 0:00.
  const s = String(t ?? "").trim();
  if (!s) return NaN;
  return s.split(":").reduce((a, b) => a * 60 + Number(b), 0);
};

function extractJSON(text) {
  // JSON.parse throws a technical English error message ("Expected property
  // name or '}' ... at position 14"). Wrapped so the user sees an
  // actionable sentence instead.
  const parse = (s) => {
    try {
      return JSON.parse(s);
    } catch {
      throw new Error("The JSON block is there, but its content is broken — copy " +
                      "Claude's reply again from the start to the end of the block.");
    }
  };
  const fence = text.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
  if (fence) return parse(fence[1]);
  const a = text.indexOf("{"), b = text.lastIndexOf("}");
  if (a === -1 || b <= a) throw new Error("No JSON block found in that text.");
  return parse(text.slice(a, b + 1));
}

/* Snap to nearest word boundary. This is what Claude cannot do:
   it has no per-word timestamps. We do. */
/* How far a cut point may be shifted. Must match SNAP_MAX in
   klipian/roundtrip.py -- if one is changed, change both. A word boundary
   farther away than this means Claude pointed at silence, not at a word
   that is only slightly off. */
const SNAP_MAX = 2.0;

function snapToWord(time, side) {
  const w = realTranscript?.words;
  if (!w?.length || !Number.isFinite(time)) return time;
  const candidate = side === "start" ? w.map((x) => x.start) : w.map((x) => x.end);
  const nearest = candidate.reduce((a, b) =>
    (Math.abs(b - time) < Math.abs(a - time) ? b : a));
  return Math.abs(nearest - time) <= SNAP_MAX ? nearest : time;
}

/* Indonesian keys (klip, mulai, judul, ...) are intentionally still accepted as
   fallback. The prompt now asks for English keys, but Claude replies that were
   saved before the rename must still be importable -- and Claude occasionally
   answers using terms from the prompt prose. */
function importJSON(text) {
  const data = extractJSON(text);
  const raw = data.clips || data.klip || [];
  if (!raw.length) throw new Error('JSON does not have a "clips" list.');

  const result = raw.map((k) => {
    // Clips without timestamps are skipped, not accepted as 0:00. Without this
    // guard toSeconds(undefined) returns NaN, and the always-false NaN comparison
    // causes snapToWord to return the first word -- one field Claude forgot to
    // write turns into a clip starting at the beginning of the video.
    const m0 = toSeconds(k.start ?? k.mulai);
    const s0 = toSeconds(k.end ?? k.selesai);
    if (!Number.isFinite(m0) || !Number.isFinite(s0) || s0 <= m0) return null;

    // Re-check after snapping: each side moves independently, so a range that
    // was valid before can end up inverted. If so, fall back to the original
    // numbers from Claude.
    let m = snapToWord(m0, "start");
    let s = snapToWord(s0, "end");
    if (s <= m) { m = m0; s = s0; }

    // Scores are COERCED to numbers here, at the boundary where external data
    // enters. Claude occasionally writes "nine" or "9" (string), and non-numeric
    // values slip through until renderBoard calls value.toFixed() and throws --
    // the Candidates board is permanently broken until the page reloads.
    const scores = k.scores || k.skor || {};
    const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
    const nums = Object.values(scores)
      .map(Number).filter(Number.isFinite);
    return {
      title: (k.title || k.judul || "Untitled").trim(),
      hook: (k.hook || "").trim(),
      in: fmtStamp(m), out: fmtStamp(s),
      startSec: m, endSec: s,
      dur: Math.round(s - m),
      total: nums.length ? +(nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(1) : 0,
      scores: {
        hook: num(scores.hook),
        complete: num(scores.complete ?? scores.self_contained),
        payoff: num(scores.payoff),
      },
      reason: (k.reason || k.alasan || "").trim(),
      spans: [{ start: m, end: s }],   // one whole piece until split
    };
  // AI order is preserved, NOT re-sorted by score. Scores are not displayed
  // on the Clip screen, so re-sorting only makes "recommendation #1" on
  // screen differ from #1 in the JSON.
  }).filter((k) => k && k.dur > 0);

  if (!result.length) throw new Error("All clips have zero or negative duration.");
  return result;
}

/* ---------- wiring results into the rest of the app ---------- */

function applyCandidates(candidates) {
  const d = DATA;
  d.candidates = candidates;
  // realTranscript can be null if JSON is imported before the transcript loads;
  // importJSON/snapToWord tolerate it, so don't blindly deref here either.
  const dur = realTranscript?.duration;
  d.marks = candidates.map((k) => ({
    pos: dur ? (k.startSec / dur) * 100 : 0,
    scores: k.total,
    label: (k.title || "").split(" ").slice(0, 3).join(" "),
  }));

  // Cut screen transcript uses real words around the top clip


  renderList(); renderPreview();
  if (typeof setClip === "function") setClip(candidates[0]);

}


/* ---------- wiring controls ---------- */

async function prepareExport(videoName) {
  const panel = $("#exportPanel"), button = $("#downloadBrief"), note = $("#exportNote");
  note.textContent = "searching for transcript ...";
  const previous = realTranscript;
  realTranscript = await findTranscript(videoName);

  if (!realTranscript) {
    panel.dataset.ready = "false";
    button.disabled = true;
    note.textContent = `No transcript yet. Run this first: klipian transcribe ${videoName}`;
    return;
  }
  panel.dataset.ready = "true";
  button.disabled = false;
  note.textContent =
    `${realTranscript.words.length.toLocaleString("en")} words · ${fmtStamp(realTranscript.duration)} · drop the JSON to your AI to analyze it`;
  $("#importPanel").dataset.ready = "true";

  // If the user already added manual clips BEFORE this transcript arrived
  // (e.g. transcription was still running when "Create manual clip" was pressed),
  // the captions are empty because kataResult() has nothing to map yet -- and
  // nothing triggers a redraw once the transcript finally becomes available.
  // An explicit redraw here closes that gap.
  if (!previous && typeof RESULT !== "undefined" && RESULT.length) {
    if (typeof drawCaption === "function") drawCaption();
    if (typeof renderCaptions === "function") renderCaptions();
  }
}

$("#downloadBrief").addEventListener("click", async () => {
  const name = chosenSource?.name || "video.mp4";
  const text = await buildBrief(name);
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type: "text/markdown" }));
  a.download = `brief-claude-${name.replace(/\.[^.]+$/, "")}.md`;
  a.click();
  URL.revokeObjectURL(a.href);
  $("#exportNote").textContent =
    `File downloaded · ${(text.length / 1024).toFixed(0)} KB · ~${Math.round(text.length / 3.5).toLocaleString("en")} tokens`;
});

$("#pasteJSON").addEventListener("input", (e) => {
  $("#importBtn").disabled = !e.target.value.trim();
  $("#importNote").dataset.error = "false";
  $("#importNote").textContent = "";
});

$("#importBtn").addEventListener("click", () => {
  const note = $("#importNote");
  try {
    const candidates = importJSON($("#pasteJSON").value);
    applyCandidates(candidates);
    note.dataset.error = "false";
    note.textContent = `${candidates.length} suggestions imported`;
    if (typeof renderRecommendations === "function") renderRecommendations();
    toScreen("klip");          // recommendations are not the final destination, result is
  } catch (err) {
    note.dataset.error = "true";
    note.textContent = err.message;
  }
});

/* .json files can be dropped directly onto the paste box */
$("#pasteJSON").addEventListener("drop", async (e) => {
  const f = e.dataTransfer?.files?.[0];
  if (!f) return;
  e.preventDefault();
  e.stopPropagation();
  $("#pasteJSON").value = await f.text();
  $("#importBtn").disabled = false;
});
