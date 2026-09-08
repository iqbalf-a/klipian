/* klipian — correcting caption text
   ==========================================================================
   Whisper occasionally mishears names, jargon, or words spoken quickly. Before
   this feature, the only way to fix mistakes was adding entries to
   prompts/glossary.txt then RE-TRANSCRIBING -- over ten minutes to correct
   a single word.

   Here corrections belong to RESULT only:

     - the transcript in cache/ is never touched
     - corrected words are stored in CORRECTIONS, keyed by their start time
     - during render, the list of corrected words is sent along to the server

   The transcript has its own pipeline; this is edit mode, not transcription mode.
   ========================================================================== */

let CORRECTIONS = {};    // { "12.345": "corrected word" }

const wordKey = (w) => w.start.toFixed(3);

/* Words that actually make it into the result, with corrections applied. */
function resultWords() {
  if (typeof activeClip === "undefined" || !activeClip?.spans?.length) return [];
  const allWords = realTranscript?.words || [];
  const out = [];
  for (const w of allWords) {
    const inSpan = activeClip.spans.some((p) => w.start >= p.start && w.end <= p.end);
    if (!inSpan) continue;
    const k = wordKey(w);
    out.push({
      start: w.start, end: w.end,
      original: w.text.trim(),
      text: (CORRECTIONS[k] ?? w.text).trim(),
      edited: CORRECTIONS[k] !== undefined,
    });
  }
  return out;
}

/* The form sent to the server along with the render request. */
function wordsForRender() {
  return resultWords().map((w) => ({ text: w.text, start: w.start, end: w.end }));
}

/* ---------- filler words ("eh", "anu", "hmm"...) ----------
   This list is intentionally short and only includes PURE interjections. Words
   like "kan" or "gitu" are often used as fillers too, but both are still
   valid function words in other sentences -- removing them blindly can break
   meaning. Same lesson as the "possibly misheard word" threshold in the
   glossary (README): a loose threshold flagged 10.3% of words and almost all
   turned out to be correct. Pure interjections are much safer: the sentence
   remains intact without them, regardless of context.

   Checked against w.text (ALREADY corrected), not w.original -- if Whisper
   misheard a real word as "eh" and the user corrected it on this screen,
   that correction is what should be honored, not Whisper's guess. */
const FILLER_WORDS = new Set([
  "eh", "ee", "eee", "em", "emm", "ehm", "hmm", "hm", "mm", "anu", "euh",
]);

const isFillerWord = (text) =>
  FILLER_WORDS.has(text.toLowerCase().replace(/[^\p{L}]/gu, ""));

function fillerWordsInResult() {
  return resultWords().filter((w) => isFillerWord(w.text));
}

/* Splits each Result segment around filler words -- same mechanism as "trim
   middle" (see README): Result stays a list of time ranges, just becomes
   more shorter ranges. Remaining pieces shorter than 0.05 seconds are
   discarded rather than left as near-zero ranges that mean nothing. */
function removeFillerWords() {
  const fillers = fillerWordsInResult();
  if (!fillers.length || typeof RESULT === "undefined") return 0;
  const THRESHOLD = 0.05;
  const next = [];
  for (const r of RESULT) {
    let cursor = r.start;
    const withinSpan = fillers
      .filter((w) => w.start >= r.start && w.end <= r.end)
      .sort((a, b) => a.start - b.start);
    for (const w of withinSpan) {
      if (w.start - cursor > THRESHOLD) {
        next.push({ ...r, id: `r${++resultSeq}`, start: cursor, end: w.start });
      }
      cursor = w.end;
    }
    if (r.end - cursor > THRESHOLD) {
      next.push({ ...r, id: `r${++resultSeq}`, start: cursor, end: r.end });
    }
  }
  RESULT = next;
  renderResult();               // writes project + redraws everything
  return fillers.length;
}

/* ---------- rendering ---------- */

function renderCaptions() {
  const list = $("#textList");
  const note = $("#textNote");
  if (!list) return;

  const words = resultWords();
  const editedCount = words.filter((w) => w.edited).length;
  const fillerCount = words.filter((w) => isFillerWord(w.text)).length;
  const reset = $("#textResetBtn");
  if (reset) reset.disabled = editedCount === 0;
  const fillerBtn = $("#textFillerBtn");
  if (fillerBtn) {
    fillerBtn.disabled = fillerCount === 0;
    fillerBtn.textContent = fillerCount ? `Remove filler words (${fillerCount})` : "Remove filler words";
  }

  if (!words.length) {
    // Result EXISTS but its words are empty -- this can mean two different
    // things: the video was never transcribed at all (common in the manual
    // clip path -- the README deliberately says "skip steps 2 and 3", but
    // default transcription still runs automatically through the Analysis
    // screen; the issue is when this project is opened DIRECTLY to the Clips
    // screen -- via the home card or session restore -- the Analysis screen,
    // and its transcription, were never reached), or there are genuinely no
    // words falling within this clip's range. The "add a clip first" message
    // is misleading for the first case -- the clip already exists, only the
    // transcript is missing.
    const hasClip = typeof activeClip !== "undefined" && activeClip?.spans?.length;
    if (hasClip && !realTranscript) {
      list.innerHTML = `<p class="empty-message">Video ini belum ditranskripsi, jadi caption-nya
        belum ada teks untuk ditampilkan.
        <button class="btn main" id="autoCaptionBtn" type="button">Auto Caption</button></p>`;
      if (note) note.textContent = "belum ditranskripsi";
    } else {
      list.innerHTML = `<p class="empty-message">No words yet. Build a Result first and the
        caption text will show up here.</p>`;
      if (note) note.textContent = "none yet";
    }
    return;
  }

  if (note) {
    const parts = [`${words.length} words`];
    if (editedCount) parts.push(`${editedCount} corrected`);
    if (fillerCount) parts.push(`${fillerCount} filler`);
    note.textContent = parts.length > 1 ? parts.join(" · ")
      : `${words.length} words · click a word to correct it`;
  }

  list.innerHTML = words.map((w) => {
    const isFiller = isFillerWord(w.text);
    return `
    <button class="word-text${w.edited ? " edited" : ""}${isFiller ? " filler" : ""}"
            data-start="${wordKey(w)}"
            title="${timeRange(w.start)}${w.edited ? ` · was &quot;${escapeHTML(w.original)}&quot;` : ""}${isFiller ? " · filler word" : ""}"
    >${escapeHTML(w.text)}</button>`;
  }).join("");
}

/* ---------- editing a single word ----------
   Deliberately written defensively. The first version cleared the button's
   content, placed an <input> inside it, and handed off saving entirely to the
   blur event. Two bad outcomes:

     - if focus never landed, blur never fired and the correction was lost
       without a trace
     - if the edit was interrupted, the button was left empty -- the word
       appeared to vanish from the list

   Now the editing state is held in one place, saves are idempotent, and the
   list is ALWAYS redrawn at the end so no empty button can remain. */

let editingWord = null;      // { key, previousValue, input }

function finishEdit(cancel) {
  if (!editingWord) return;
  const { key, previousValue, input } = editingWord;
  editingWord = null;                      // null first, so it cannot be called twice

  if (!cancel) {
    const value = input.value.trim();
    const originalWord = (realTranscript?.words || [])
      .find((w) => wordKey(w) === key)?.text.trim() ?? previousValue;
    // Reverted to the original = no longer a correction.
    if (!value || value === originalWord) delete CORRECTIONS[key];
    else CORRECTIONS[key] = value;
  }

  renderCaptions();                        // no empty button can survive
  if (typeof drawCaption === "function") drawCaption();
  if (typeof saveProject === "function") saveProject();
}

function startEdit(b) {
  if (editingWord) finishEdit(false);      // save the previous edit first
  const key = b.dataset.start;
  const previousValue = b.textContent.trim();

  const input = document.createElement("input");
  input.className = "word-input";
  input.value = previousValue;
  input.size = Math.max(3, previousValue.length);
  b.textContent = "";
  b.appendChild(input);
  editingWord = { key, previousValue, input };

  input.focus();
  input.select();

  input.addEventListener("blur", () => finishEdit(false));
  input.addEventListener("change", () => finishEdit(false));
  input.addEventListener("keydown", (ev) => {
    ev.stopPropagation();                  // don't trigger , . space shortcuts
    if (ev.key === "Enter") { ev.preventDefault(); finishEdit(false); }
    else if (ev.key === "Escape") { ev.preventDefault(); finishEdit(true); }
    else if (ev.key === "Tab") {
      // move to the adjacent word so you can correct words in sequence
      ev.preventDefault();
      finishEdit(false);
      const wordButtons = [...document.querySelectorAll(".word-text")];
      const i = wordButtons.findIndex((x) => x.dataset.start === key);
      const target = wordButtons[i + (ev.shiftKey ? -1 : 1)];
      if (target) startEdit(target);
    }
  });
}

/* ---------- Auto Caption: transcription triggered directly from this screen -
   The manual path can skip the Analysis screen entirely (open a project via
   the home card / session restore, jump straight to Clip) -- nothing ever
   triggered transcription for that video. This button is the shortcut,
   without having to navigate to Analysis first. */
let autoCaptionTimer = null;

async function startAutoCaption(btn) {
  const video = (typeof chosenSource !== "undefined" && chosenSource?.name)
    || (typeof DATA !== "undefined" ? DATA.file : "");
  if (!video) return;
  const note = $("#textNote");
  if (btn) btn.disabled = true;
  if (note) note.textContent = "starting transcription …";

  let id;
  try {
    const reply = await fetch("/api/transcribe", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ video }),
    }).then((r) => r.json());
    if (reply.error) throw new Error(reply.error);
    id = reply.id;
  } catch {
    if (note) note.textContent = "Backend required. Run: python -m klipian serve";
    if (btn) btn.disabled = false;
    return;
  }

  clearInterval(autoCaptionTimer);
  autoCaptionTimer = setInterval(async () => {
    let t;
    try { t = await (await fetch(`/api/transcribe/${id}`)).json(); }
    catch { return; }                        // server temporarily unreachable -- retry

    if (t.state === "running") {
      if (note) note.textContent = `transcribing … ${t.percent || 0}%`;
      return;
    }
    clearInterval(autoCaptionTimer);
    if (t.state === "failed") {
      if (note) note.textContent = `Transcription failed: ${t.error}`;
      if (btn) btn.disabled = false;
      return;
    }
    // done: transcript is already in cache/, just need to load it on the client side.
    if (typeof findTranscript === "function") {
      realTranscript = await findTranscript(video);
    }
    renderCaptions();
    if (typeof drawCaption === "function") drawCaption();
  }, 900);
}

$("#textList")?.addEventListener("click", (e) => {
  const autoBtn = e.target.closest("#autoCaptionBtn");
  if (autoBtn) { startAutoCaption(autoBtn); return; }
  const b = e.target.closest(".word-text");
  if (!b || b.querySelector("input")) return;
  startEdit(b);
});

$("#textResetBtn")?.addEventListener("click", () => {
  CORRECTIONS = {};
  renderCaptions();
  if (typeof drawCaption === "function") drawCaption();
});

$("#textFillerBtn")?.addEventListener("click", () => {
  // renderCaptions() (called from inside renderResult(), see
  // removeFillerWords above) already redraws the word list and
  // saves the project -- nothing else to do here.
  removeFillerWords();
});

/* New video = different transcript, old corrections no longer apply. */
function resetCaptions() {
  CORRECTIONS = {};
  renderCaptions();
}
