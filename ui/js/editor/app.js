/* klipian — interface prototype
   Data is separated from rendering so this structure can be directly moved to
   React: each render() function below is equivalent to one component. */

/* Prevent XSS: escape HTML characters before injecting into innerHTML */
function escapeHTML(s) {
  if (typeof s !== "string") return "";
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/* One file, one flow. DATA used to be mode-locked -- podcast and MLBB had
   separate examples -- but the way clips are assembled turned out to be
   identical: drop file, set frames, fix text. That category only added
   one choice at the front without changing anything after.

   What used to live here: a 60-word hardcoded Indonesian transcript
   (`words`), `suspect`, `cut`, `layout`, `marks`, and a real filename and
   duration -- all left over from the prototype. Every one of them was
   WRITE-ONLY or never referenced at all by the time the real transcript
   pipeline landed: `words` was only ever reset to [] , `marks` was computed
   twice (roundtrip.js and projects.js) and persisted into every project
   file without anything ever reading it, and `suspect`/`cut`/`layout` had
   no references anywhere.

   `file` stays, as the empty fallback for the three places that do
   `chosenSource?.name || DATA.file`. It used to hold a real filename, which
   meant a render with no source silently targeted THAT video instead of
   failing -- now the server gets "" and answers with a clear "not in
   samples/" error, which the History status box shows. */
const DATA = {
  file: "",
  candidates: [],
};

let QUEUE = [];

/* Render queue is not a fixed list: it contains clips that are actually being rendered. */
function buildQueue(list) {
  // Used to be locked to "face in center" regardless of choice, so the history
  // row would lie if you picked Blur background.
  const layout = (typeof optionValue === "function") ? optionValue("format") : "Crop";
  // Without argument: derive from RESULT -- that's what's actually being
  // rendered (one merged file, see resultAsClip()). Candidate board with
  // "approved" status no longer exists; filtering by status here is ALWAYS
  // empty and makes the queue screen look blank even while rendering.
  // With argument: exactly that clip -- used by the render button in preview
  // which only sends one clip, so the queue row aligns with server results.
  let approved = list;
  if (!approved) {
    const clip = (typeof resultAsClip === "function") ? resultAsClip() : null;
    approved = clip ? [clip] : [];
  }
  QUEUE = approved.map((k) => ({
    // Title first, not filename guess. The title->filename rule lives on
    // the server (safe_filename); guessing again here once produced a
    // different name from the file actually written. The real name
    // overwrites it once the server reports back.
    name: k.title,
    clip: k,       // held so duration updates if the clip is trimmed
    layout, dur: `${k.dur}s`,
    pct: 0,
    note: "queued",
    action: "Cancel", act: "cancel",
    folder: "",   // filled by server after render completes
    url: "",
    mb: 0,
  }));
}

/* id is machine-readable, label is human-readable. They used to be one and
   the same, so changing the label "Ukuran" would also break captionValue("ukuran").

   Each choice has three facets:
     t    button text
     out  value SENT TO THE RENDER  (ASS size, percentage, ASS color)
     px   value for on-screen preview, whose box is much smaller

   Originally there was only the pixel preview number, and that number never
   reached the output file -- so changing it changed nothing.

   ASS colors use &HAABBGGRR& format (blue-green-red, opposite of web hex). */
const CAPTION_OPTIONS = [
  { id: "font", label: "Font", active: 0, choices: [
      { t: "Arial", out: "Arial" },
      { t: "Impact", out: "Impact" },
      { t: "Verdana", out: "Verdana" }] },
  // No .px field here -- preview calculates screen size directly
  // from .out (pxFromOut() in interactions.js), same as watermark-size.
  { id: "size", label: "Size", active: 1, choices: [
      { t: "Small", out: 64 },
      { t: "Medium", out: 84 },
      { t: "Large", out: 108 }] },
  { id: "highlight", label: "Highlight", active: 0, choices: [
      { t: "Gold", out: "&H0000D6FF&", css: "#FFD600" },
      { t: "White", out: "&H00FFFFFF&", css: "#FFFFFF" },
      { t: "Green", out: "&H0076E600&", css: "#00E676" },
      { t: "Red", out: "&H004040FF&", css: "#FF4040" }] },
  { id: "position", label: "Position", active: 1, choices: [
      { t: "Bottom", out: 16, px: 16 },
      { t: "Middle", out: 24, px: 24 },
      { t: "Top", out: 34, px: 34 }] },
  { id: "per-line", label: "Words per line", active: 1, choices: [
      { t: "2", out: 2 }, { t: "3", out: 3 }, { t: "4", out: 4 }] },
  { id: "outline", label: "Outline", active: 1, choices: [
      { t: "None", out: 0 },
      { t: "Medium", out: 4 },
      { t: "Thick", out: 8 }] },
  { id: "watermark", label: "Watermark", active: 0, choices: [
      { t: "On", out: true },
      { t: "Off", out: false }] },
  // No .px field here (unlike the caption size option above) --
  // watermark preview calculates screen size directly from .out (see
  // applyCaption() in interactions.js), not a separate calibration number.
  { id: "watermark-size", label: "Watermark size", active: 1, choices: [
      { t: "Small", out: 22 },
      { t: "Medium", out: 32 },
      { t: "Large", out: 46 }] },
  // Opacity is written as ASS alpha (&HAA...) -- 00 = fully opaque, FF = fully
  // invisible, OPPOSITE of normal opacity intuition: the MORE FADED the
  // choice, the LARGER the alpha number. The two most faded levels (Ghost,
  // Whisper) were added after the default "Faint" but turned out still
  // visible enough on real screens -- so the default was also shifted to
  // "Faint" (no longer "Medium") so the new default starts more faded.
  { id: "watermark-opacity", label: "Watermark opacity", active: 2, choices: [
      { t: "Ghost", out: "D8", css: .15 },
      { t: "Whisper", out: "C0", css: .25 },
      { t: "Faint", out: "A0", css: .37 },
      { t: "Medium", out: "80", css: .5 },
      { t: "Bold", out: "40", css: .75 }] },
  // "Bottom" does NOT mean flush with the bottom edge -- its position is
  // calculated relative to the currently active caption position (see
  // marginWatermark() in interactions.js and the equivalent in build_ass()),
  // so the watermark always lands exactly below the caption regardless of
  // where the caption is.
  { id: "watermark-position", label: "Watermark position", active: 2, choices: [
      { t: "Top", out: "top" },
      { t: "Middle", out: "middle" },
      { t: "Bottom", out: "bottom" }] },
];

/* Caption style sent to the server. This is what makes the settings on the
   Caption screen actually change the output file. */
function captionStyle() {
  const nilai = (id) => {
    const o = CAPTION_OPTIONS.find((x) => x.id === id);
    return o ? o.choices[o.active] : null;
  };
  return {
    font: nilai("font").out,
    size: nilai("size").out,
    highlight: nilai("highlight").out,
    position: nilai("position").out,
    per_line: nilai("per-line").out,
    outline: nilai("outline").out,
    watermark: nilai("watermark").out,
    watermark_size: nilai("watermark-size").out,
    watermark_opacity: nilai("watermark-opacity").out,
    watermark_position: nilai("watermark-position").out,
  };
}

/* GLOBAL caption/watermark preset, separate from projects. Projects store
   their OWN choices (see projectState() in projects.js) so opening an old
   project never overwrites the already-rendered style. But new projects have
   nothing to restore -- without this, they always start from factory
   defaults, forcing you to re-select watermark size/position/opacity every
   time a new video is dropped, when people usually want the same style as
   their previous project. */
const PRESET_CAPTION_KEY = "klipian:preset-caption";

function savePresetCaption() {
  try {
    localStorage.setItem(PRESET_CAPTION_KEY,
      JSON.stringify(CAPTION_OPTIONS.map((o) => o.active)));
  } catch { /* private/full -- preset is a convenience, not a requirement */ }
}

/* Called only for NEW projects (see openProject/openProjectFromHome in
   projects.js). Same as project restoration in loadProject(): indices are
   bounds-checked because old presets may come from a CAPTION_OPTIONS layout
   whose number of choices has changed. */
function applyPresetCaption() {
  let preset;
  try { preset = JSON.parse(localStorage.getItem(PRESET_CAPTION_KEY)); }
  catch { return false; }
  if (!Array.isArray(preset)) return false;
  preset.forEach((i, k) => {
    if (CAPTION_OPTIONS[k] && Number.isInteger(i)
        && i >= 0 && i < CAPTION_OPTIONS[k].choices.length) {
      CAPTION_OPTIONS[k].active = i;
    }
  });
  return true;
}

const $ = (s) => document.querySelector(s);

/* THE whole-second clock: mm:ss, or h:mm:ss past an hour. Lives here, in
   the earliest-loaded file, because framing/timeline/result/history all
   need it (it used to live in result.js and framing.js called it before it
   was declared, so the Framing screen threw on page load).

   There used to be three of these. fmtClock() in analysis.js was a
   byte-for-byte duplicate apart from its guard, and shortTime() in
   player.js differed only in using Math.floor where this used Math.round.
   That one difference was visible: the SAME clip read "12:12" in the AI
   suggestions row and "12:13" in the Result row stacked directly below it.

   FLOOR is the correct rounding, so that is what survived. These strings
   are typed back in: the AI-suggestion start/end fields show this format
   and parse it again, so a clip starting at 732.6s has to render as 12:12
   -- rounding up to 12:13 would move the clip start a second later than
   where it actually is every time the field round-trips.

   preciseTime() (framing.js) is the deliberate exception -- hundredths,
   for the framing points and the preview clock. fmtStamp() (roundtrip.js)
   is the other one: it drops the leading zero on minutes to match the
   Python fmt_time() that parses it back. */
const timeRange = (d) => {
  const t = Number.isFinite(d) ? Math.max(0, Math.floor(d)) : 0;
  const j = Math.floor(t / 3600);
  const m = String(Math.floor((t % 3600) / 60)).padStart(2, "0");
  const s = String(t % 60).padStart(2, "0");
  return j ? `${j}:${m}:${s}` : `${m}:${s}`;
};


/* ═══════════════════════════ stage navigation ═══════════════════════════
   There used to be a separate Home stage for choosing a mode -- Podcast,
   Live MLBB, Restream MPL, TV Shows -- before dropping the file. That mode
   was removed: regardless of source, the work is the same (drop file, set
   frame, fix text), so the category was just one extra upfront choice that
   changed nothing afterward.

   Two stages remain: home (drop file) and work. */

const OPTIONS = [
  // Three parts, three different jobs:
  //
  //   label   what is being decided
  //   choices the choice names
  //   hint    WHAT THE CONSEQUENCE IS -- one sentence, changes with selection
  //
  // Without the hint, the row just reads "Format: Crop / Blur background" and
  // doesn't answer "format of what?". The old label "Wajah 9:16 / Blur 9:16"
  // was also wrong: there's no face detection here, the box is placed
  // manually. "9:16" is needed -- but in the label, not repeated on both
  // choices.
  //
  // `out` separates what the MACHINE reads from what PEOPLE read. Previously
  // render branched via optionValue("format").startsWith("Blur") -- meaning
  // changing the button text silently changed the output file layout.
  { id: "format", label: "Fill the 9:16 frame",
    choices: ["Crop", "Blur background"], out: ["face", "blur"], active: 0,
    hint: ["A tall slice of the source video. The left and right edges are cut off.",
           "The whole frame in the middle, with a blurred copy filling the space above and below."] },
  // 2K and 4K are APPENDED, never inserted: a project stores each option's
  // active INDEX (see projectState()), so putting a new choice in front of
  // an existing one would silently re-point every project already saved.
  { id: "resolution", label: "Resolution", choices: ["720p", "1080p", "2K", "4K"],
    out: [720, 1080, 1440, 2160], active: 1,
    hint: ["720×1280 — smaller file, faster render.",
           "1080×1920 — full size for TikTok, Reels and Shorts.",
           "1440×2560 — beyond what the platforms show; only worth it if the source is larger.",
           "2160×3840 — upscaled unless the source really is 4K, and much slower to render."] },
  // The render used to hardcode -crf 21. Lower is better quality and a
  // bigger file; these three sit either side of that old value, so
  // "Balanced" reproduces exactly what every earlier render produced.
  { id: "quality", label: "Quality", choices: ["Smaller file", "Balanced", "Best"],
    out: [26, 21, 17], active: 1,
    hint: ["Noticeably lighter files. Fine for talking heads, softer on fast motion.",
           "The setting everything was rendered at until now.",
           "Keeps detail in motion and gradients, at roughly double the size."] },
];

function renderPrepare() {
  $("#options").innerHTML = OPTIONS.map((o) => `
    <div class="option-row" data-option="${o.id}">
      <span class="eyebrow">${escapeHTML(o.label)}</span>
      <span class="choices">
        ${o.choices.map((p, i) => `<button class="chip"${i === o.active ? ' aria-pressed="true"' : ""}>${escapeHTML(p)}</button>`).join("")}
      </span>
      <span class="hint">${escapeHTML(o.hint ? o.hint[o.active] : "")}</span>
    </div>`).join("");
  summarizeOptions();
}

/* Hint follows the currently active choice. It's rewritten in place, not
   through renderPrepare(), so keyboard focus doesn't leave the chip that
   was just pressed. */
function refreshHint(row, o) {
  const el = row.querySelector(".hint");
  if (el && o.hint) el.textContent = o.hint[o.active];
}

/* Summary is derived from OPTIONS, not from five hardcoded slots. The
   previous version read value[2] through value[4] even though OPTIONS only
   had two, so the row showed "... undefined · undefined · undefined". */
function summarizeOptions() {
  $("#optionsSummary").textContent =
    OPTIONS.map((o) => o.choices[o.active]).join(" · ");
}

function toStage(stage) {
  $("#app").dataset.stage = stage;
  if (stage === "home") {
    renderPrepare();
    // Project list is re-read every time we return to home, not once on
    // load: otherwise, the project just worked on won't appear.
    if (typeof renderProjects === "function") renderProjects();
  }
}

/* ───────────────────────── source ribbon ───────────────────────── */



/* ───────────────────── job polling ──────────────────────────
   Every long server task (transcribe, render, auto-caption, diarize) has
   the same shape: POST to start, then poll GET /api/<x>/<id> until the
   state stops being "running". That shape was written out four separate
   times, with four DIFFERENT failure policies -- two of them retried
   forever, so killing `klipian serve` mid-render left the tab hammering a
   dead port while the UI sat on "rendering" with no end and no error.

   One implementation, one policy. Returns a stop() so a caller can cancel
   (the render Cancel button, a screen change) without reaching for the
   interval id.

     url          GET endpoint, already including the job id
     interval     ms between polls
     onTick(job)  called on every successful poll while still running
     onDone(job)  called once, when state stops being "running"
     onFail(err)  called once, after `maxFailures` consecutive failures
     maxFailures  default 5 -- a single blip shouldn't end a long render */
function pollJob(url, { interval = 800, onTick, onDone, onFail, maxFailures = 5 } = {}) {
  let failures = 0;
  let stopped = false;
  let timer = null;

  const stop = () => { stopped = true; clearInterval(timer); timer = null; };

  timer = setInterval(async () => {
    if (stopped) return;
    let job;
    try {
      const r = await fetch(url);
      job = await r.json();
      failures = 0;
    } catch (err) {
      if (++failures >= maxFailures) {
        stop();
        if (onFail) onFail(err instanceof Error ? err : new Error(String(err)));
      }
      return;
    }
    if (stopped) return;          // a callback may have stopped us meanwhile
    if (job.state === "running") { if (onTick) onTick(job); return; }
    stop();
    if (onDone) onDone(job);
  }, interval);

  return stop;
}

/* Render outcomes and queue counters. Deliberately NOT #historyNote --
   that span belongs to loadHistory() alone now. See the markup comment on
   #renderStatus in index.html for the race and the clipping this fixes.
   `failed` switches it to the danger styling. */
function renderStatus(text, failed) {
  const el = $("#renderStatus");
  if (!el) return;
  if (!text) { el.hidden = true; el.textContent = ""; el.classList.remove("failed"); return; }
  el.textContent = text;
  el.classList.toggle("failed", !!failed);
  el.hidden = false;
}

/* ───────────────────────── queue ────────────────────────────── */
/* Queue is split in two: buildQueue() derives its content from approved
   clips, drawQueue() renders the current state. If merged, pressing
   "Cancel" would immediately be overwritten by the re-derivation. */
function drawQueue() {
  // `busy` rather than a percentage: the server reports progress per CLIP
  // (done/index/total), never a fraction WITHIN the clip being rendered,
  // so a running row has no honest number -- see the .working bar below.
  const running = QUEUE.filter((r) => r.busy).length;
  const end = QUEUE.filter((r) => r.pct === 100).length;
  const queued = QUEUE.length - running - end;
  if (QUEUE.length) {
    renderStatus(`${running} running · ${queued} queued · ${end} done`);
  }

  $("#queueList").innerHTML = QUEUE.length
    ? QUEUE.map((r) => `
        <div class="row queue-row">
          <div class="title">${escapeHTML(r.name)}</div>
          <span class="meta">${r.layout}</span>
          <span class="meta">${r.clip ? r.clip.dur + "s" : r.dur}</span>
          <span class="progress ${r.pct === 100 ? "done" : ""}${r.busy ? " working" : ""}"
          ><i style="width:${r.busy ? 100 : r.pct}%"></i></span>
          <span class="meta">${r.note}</span>
          <button class="btn ${r.pct === 100 ? "main" : ""}"
                  data-action="${r.pct === 100 ? "open" : (r.act || "cancel")}"
          >${r.action}</button>
        </div>`).join("")
    : `<div class="row" style="grid-template-columns:1fr"><div>
         <div class="title">Nothing rendered yet</div>
         <div class="sub">Build a Result on the Clips screen, then press Render.</div>
       </div></div>`;
}

function renderList() {
  // Don't overwrite the QUEUE if a render is in progress -- folder data
  // and server progress will be lost if buildQueue() is called again.
  if (!QUEUE.length || QUEUE.every((r) => r.pct === 0 && !r.busy && !r.folder)) {
    buildQueue();
  }
  drawQueue();

  $("#captionList").innerHTML = CAPTION_OPTIONS.map((o) => `
    <div class="row" data-caption="${o.id}" style="grid-template-columns:130px 1fr auto">
      <span class="eyebrow">${o.label}</span>
      <span style="display:flex;gap:var(--s2)">
        ${o.choices.map((p, i) => `
          <button class="chip"${i === o.active ? ' aria-pressed="true"' : ""}
                  ${p.css ? `style="--color-dot:${p.css}"` : ""}
                  data-pick="${i}">${p.css ? '<i class="color-dot"></i>' : ""}${p.t}</button>`).join("")}
      </span>
      <span class="meta">${o.choices[o.active].t}</span>
    </div>`).join("");
}

/* Pleasant clip length to watch: one whole idea, not a cut-off sentence. */
const RIBBON_DURATION = { ideal: [30, 45], scale: 75, hint: "sweet spot 30–45s" };

function renderPreview() {
  const d = DATA;
  const f = $("#frame");
  const top = f.querySelector(".field.top");
  const main = f.querySelector(".field.main");
  f.dataset.layout = d.layout;

  // What's reviewed in preview is RESULT, not candidates. The approve/reject
  // candidate board no longer exists.
  const clip = (typeof activeClip !== "undefined" && activeClip) ? activeClip : null;

  // `frame.dataset.video` used to be set ONCE in prepareVideo(), when the file
  // was first dropped -- never re-evaluated after. As a result, once Result
  // was emptied, the <video> element stayed frozen on the last frame it played
  // (video.src was still there), appearing to still have content when Result
  // was actually empty. Now it's re-evaluated every time the preview is drawn,
  // following the PRESENCE/ABSENCE of a clip -- not just the presence of a
  // video source.
  f.dataset.video = clip ? "true" : "";
  if (!clip && typeof video !== "undefined" && video && !video.paused) {
    // Video that keeps running quietly behind a hidden screen just burns
    // CPU with nobody watching.
    video.pause();
    if (typeof isPlaying !== "undefined") isPlaying = false;
    if (typeof playBtn !== "undefined" && playBtn) playBtn.textContent = "▶";
  }

  // Caption content is NOT written here anymore. It used to be filled with
  // preview text from DATA.caption, which had nothing to do with the clip
  // being viewed. Now drawCaption() fills it from the original transcript.
  if (typeof drawCaption === "function") drawCaption();

  top.dataset.tag = "";
  main.dataset.tag = "VIDEO ← CROP";

  // Preview field content is determined by the crop box, not a fixed image.
  if (typeof refreshPreviewFromCrop === "function") refreshPreviewFromCrop();

  const info = $("#clipInfo");
  if (!info) return;

  // No clip yet is a normal state, not an error. Without this guard the
  // LENGTH panel would keep the last clip's info even after Result is emptied.
  if (!clip) {
    info.innerHTML =
      `<div><div class="eyebrow">Result</div>
        <div class="clip-title" style="color:var(--text-faint)">nothing selected</div></div>`;
    return;
  }

  const p = RIBBON_DURATION;
  const pct = (v) => Math.min(v / p.scale, 1) * 100;
  const verdict = clip.dur < p.ideal[0] ? "under the sweet spot"
              : clip.dur > p.ideal[1] ? "over the sweet spot" : "in the sweet spot";

  info.innerHTML = `
    <div>
      <div class="eyebrow">Result${clip.spans && clip.spans.length > 1
        ? ` &middot; ${clip.spans.length} spans` : ""}</div>
      <div class="clip-title">${escapeHTML(clip.title)}</div>
    </div>
    <div class="meter">
      <div class="meter-head">
        <span>LENGTH</span><span class="meter-value">${clip.dur}s · ${verdict}</span>
      </div>
      <div class="meter-bar">
        <span class="meter-ideal"
              style="left:${pct(p.ideal[0])}%;right:${100 - pct(p.ideal[1])}%"></span>
        <span class="meter-tick" style="left:${pct(clip.dur)}%"></span>
      </div>
      <div class="meter-foot"><span>0</span><span>${p.hint}</span><span>${p.scale}s</span></div>
    </div>`;
}

/* ───────────────────────── navigation ──────────────────────────── */
// "video" was in this list for a screen that no longer exists -- index.html
// has analysis / clips / framing / captions / history.
const NO_PREVIEW = ["analysis", "history"];

/* Three screens that edit the same result. Split into separate menus so
   each screen has one concern: Clips picks the cuts, Framing adjusts the
   frame, Text handles words and appearance. */
// Render joins them: it shows the same preview and is where the Result is
// finally judged, so it needs the same redraw on arrival.
const RESULT_SCREENS = ["clips", "framing", "captions", "render"];

/* The currently active screen. Saved with the project so "Continue" brings
   you back to where you left off -- if you were adjusting framing, you
   return to Framing, not thrown into Clips every time. */
let activeScreen = "clips";

function toScreen(name) {
  activeScreen = name;
  // On .app, not .stage: the stage's columns AND the elements placed into
  // them are both restyled per screen (see the Settings layout in app.css),
  // and .app is the common ancestor of all of them.
  $("#app").dataset.screen = name;
  if (typeof saveProject === "function") saveProject();
  document.querySelectorAll(".screen").forEach((s) =>
    s.classList.toggle("active", s.dataset.screen === name));
  document.querySelectorAll(".tab").forEach((t) => {
    const active = t.dataset.to === name;
    t.setAttribute("aria-selected", String(active));
    t.tabIndex = active ? 0 : -1;   // roving tabindex per ARIA tabs pattern
  });

  if (name === "history" && typeof loadHistory === "function") loadHistory();

  // The LENGTH readout and the two buttons live only on this screen now, so
  // arriving is the moment they have to be made current -- renderPreview()
  // is otherwise driven by playback and result switching, neither of which
  // has to have happened before you come here.
  if (name === "render") {
    if (typeof renderPreview === "function") renderPreview();
    if (typeof updateRenderButtons === "function") updateRenderButtons();
  }

  // Clips, Framing, and Text all three edit the SAME result, and the preview
  // shows the combined output of all three. So all three are redrawn on any
  // of the three screens -- if only the active screen were drawn, the preview
  // would show stale state from a sibling screen. They all write short lists,
  // so it's cheap.
  if (RESULT_SCREENS.includes(name)) {
    if (typeof renderFraming === "function") setTimeout(renderFraming, 0);
    if (typeof renderRecommendations === "function") renderRecommendations();
    if (typeof renderResult === "function") renderResult();
    if (typeof renderCaptions === "function") renderCaptions();
    if (typeof drawTotalTimeline === "function") drawTotalTimeline();
  }

  const hasPreview = !NO_PREVIEW.includes(name);
  $("#stage").classList.toggle("has-preview", hasPreview);
  $("#preview").style.display = hasPreview ? "" : "none";

  /* Video geometry depends on canvas size, which only exists after the
     screen comes out of display:none. ResizeObserver doesn't always fire
     on that transition, so it's called explicitly: once after layout is
     done, once more as a safety net. */
  if (typeof attachVideoGeometry === "function") {
    setTimeout(attachVideoGeometry, 0);
    setTimeout(attachVideoGeometry, 160);
  }
  // Preview watermark size (see applyCaption() in interactions.js) since
  // the last fix is calculated from getBoundingClientRect().height of
  // .frame916 -- same problem as the video geometry above: if called before
  // the panel exits display:none, its height reads as 0 and the watermark
  // falls back to a nearly invisible size. Called again here with the exact
  // same pattern.
  if (typeof applyCaption === "function") {
    setTimeout(applyCaption, 0);
    setTimeout(applyCaption, 160);
  }
}

/* renderAnalysis() used to live here, writing `${DATA.file} · ${DATA.duration}`
   into #analysisNote before a video was chosen. Both fields were removed
   from DATA when it was trimmed down to its real, live fields (file/
   candidates) -- this was the one caller nobody updated, so the note sat
   showing the literal string " · undefined" on a fresh Analyze screen.
   #analysisNote already gets a real value the moment startAnalysis()
   (analysis.js) actually has something to report; the markup default in
   index.html now covers the time before that, same as every sibling
   screen's work-head note. */
function drawAll() {
  renderList(); renderPreview();
}

/* ───────────────────────── wiring ────────────────────────────── */
$("#tabs")?.addEventListener("click", (e) => {
  const t = e.target.closest(".tab");
  if (t) toScreen(t.dataset.to);
});


// Left/right arrows switch tabs, per ARIA Authoring Practices.
$("#tabs")?.addEventListener("keydown", (e) => {
  if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
  const all = [...document.querySelectorAll(".tab")];
  const i = all.indexOf(document.activeElement);
  if (i < 0) return;
  const j = (i + (e.key === "ArrowRight" ? 1 : -1) + all.length) % all.length;
  all[j].focus();
  toScreen(all[j].dataset.to);
  e.preventDefault();
});


$("#safeBtn")?.addEventListener("click", (e) => {
  const on = $("#frame").dataset.safe === "on";
  $("#frame").dataset.safe = on ? "off" : "on";
  e.currentTarget.setAttribute("aria-pressed", String(!on));
});

/* Theme lived here until /workspace needed the same button -- it's in
   js/shared/topbar.js now, since that page can't load app.js (bound to
   index.html's elements). Storage pattern is unchanged, and still the
   same one the sidebar preference below uses. */

/* Sidebar (Analyze/Clips/Framing/etc tabs) can be hidden for screens
   that are short on width (e.g. the Framing panel, whose canvas+Framing
   Points need horizontal room -- see .canvas in app.css). Stored in
   localStorage so the choice survives a reload, same pattern as the
   active-session key in projects.js -- not just this tab's state. */
const SIDEBAR_KEY = "klipian:sidebar-tersembunyi";
function applySidebar(collapsed) {
  $("#app").dataset.sidebar = collapsed ? "hidden" : "";
  const showBtn = $("#showSidebarBtn");
  if (showBtn) showBtn.hidden = !collapsed;
}
function setSidebar(collapsed) {
  applySidebar(collapsed);
  try { localStorage.setItem(SIDEBAR_KEY, collapsed ? "1" : "0"); } catch { /* private/full */ }
}
$("#hideSidebarBtn")?.addEventListener("click", () => setSidebar(true));
$("#showSidebarBtn")?.addEventListener("click", () => setSidebar(false));
try { applySidebar(localStorage.getItem(SIDEBAR_KEY) === "1"); } catch { /* default: stays visible */ }

/* Two document-level handlers used to live here, driving `.word` markup
   from the ORIGINAL transcript editor. Captions was rebuilt on `.word-text`
   (see renderCaptions() in captions.js) and `.word` stopped being rendered,
   but the handlers stayed bound -- querying the whole document for nothing
   on every keydown and every click in the app. Removed along with the
   ~110 lines of `.word`/`.tools`/`.wave`/`.transcript` CSS they styled.
*/

// Going home is a DELIBERATE decision to leave the project -- a reload
// after that should stay on home, not get pulled automatically back into
// the project that was just left.
const goHomeDeliberately = () => {
  if (typeof forgetActiveSession === "function") forgetActiveSession();
  toStage("home");
};
$("#toHome")?.addEventListener("click", goHomeDeliberately);
$("#toMenuBtn")?.addEventListener("click", goHomeDeliberately);

$("#options")?.addEventListener("click", (e) => {
  const c = e.target.closest(".chip");
  if (!c) return;
  const row = c.closest(".option-row");
  const o = OPTIONS.find((x) => x.id === row.dataset.option);
  o.active = [...row.querySelectorAll(".chip")].indexOf(c);
  row.querySelectorAll(".chip").forEach((b, i) =>
    b.setAttribute("aria-pressed", String(i === o.active)));
  refreshHint(row, o);
  if (typeof saveProject === "function") saveProject();
  summarizeOptions();
  // The "Blur background" choice decides whether the Framing screen's work is
  // used at all, so its warning there has to react from here.
  if (typeof updateFramingLayoutWarning === "function") updateFramingLayoutWarning();
});

drawAll();
toScreen("clips");
toStage("home");
