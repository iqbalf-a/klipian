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
   sources/" error, which the History status box shows. */
const DATA = {
  file: "",
  candidates: [],
};

let QUEUE = [];

/* Render queue is not a fixed list: it contains clips that are actually being rendered. */
function buildQueue(list) {
  // The history row says which picture the file was rendered with.
  const layout = (typeof pictureSummary === "function") ? pictureSummary() : "9:16";
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
  // A slider, not three chips (ian asked for more variation). The number
  // was always continuous underneath -- it goes straight into the ASS
  // Fontsize -- so only the UI was rounding it to Small/Medium/Large. 84
  // is what "Medium" was, so an untouched project renders identically.
  { id: "size", label: "Font size", kind: "range",
    min: 32, max: 160, step: 1, def: 84, value: 84,
    hint: "In a 1080×1920 frame. The preview scales it to whatever size it's drawn at." },
  { id: "highlight", label: "Highlight", active: 0, choices: [
      { t: "Gold", out: "&H0000D6FF&", css: "#FFD600" },
      { t: "White", out: "&H00FFFFFF&", css: "#FFFFFF" },
      { t: "Green", out: "&H0076E600&", css: "#00E676" },
      { t: "Red", out: "&H004040FF&", css: "#FF4040" }] },
  // How that colour is drawn, not which colour it is -- both choices use
  // whatever Highlight above is set to (ian). "text" is the default so
  // every style written before this renders exactly as it did.
  //
  // Box draws a rounded plate on its own layer under the text, so every
  // word keeps its outline (see build_ass). It briefly didn't: the first
  // version used ASS's BorderStyle 3, which spends the outline to draw the
  // box itself.
  { id: "highlight-style", label: "Highlight style", active: 0, choices: [
      { t: "Text", out: "text" },
      { t: "Box", out: "box" }] },
  // Both axes are percentages of the frame, which is what the renderer
  // already worked in: Y is the distance UP from the bottom edge, X the
  // offset from the centre. 24 / 0 is exactly where "Middle" used to put it.
  { id: "position", label: "Y position", kind: "range",
    min: 2, max: 90, step: 1, def: 24, value: 24, unit: "%",
    hint: "Distance up from the bottom edge." },
  // ±25 rather than ±50: the shift is made by growing one side margin, and
  // those margins are also where the text wraps (see _side_margins() in
  // render.py). Past a quarter of the width the line is squeezed into a
  // column too narrow to read.
  { id: "x", label: "X position", kind: "range",
    min: -25, max: 25, step: 1, def: 0, value: 0, unit: "%",
    hint: "Offset from the centre. Negative moves left." },
  // A MAXIMUM: a line also ends at a pause or after a sentence end (shared/captionplan.js).
  { id: "per-line", label: "Words per line", active: 1, choices: [
      { t: "2", out: 2 }, { t: "3", out: 3 }, { t: "4", out: 4 }] },
  // "As spoken": a word shows when it is said (the rest of the line is laid out but invisible, so
  // nothing shifts). "Whole line": the line appears when its first word starts. Default As spoken, also
  // for projects and presets saved before this option existed.
  { id: "reveal", label: "Words appear", active: 0, choices: [
      { t: "As spoken", out: "spoken" },
      { t: "Whole line", out: "line" }] },
  { id: "outline", label: "Outline", active: 1, choices: [
      { t: "None", out: 0 },
      { t: "Medium", out: 4 },
      { t: "Thick", out: 8 }] },
  { id: "watermark", label: "Watermark", active: 0, choices: [
      { t: "On", out: true },
      { t: "Off", out: false }] },
  { id: "watermark-size", label: "Size", kind: "range",
    min: 10, max: 90, step: 1, def: 32, value: 32,
    hint: "In a 1080×1920 frame, same scale as the caption's." },
  // Opacity is written as ASS alpha (&HAA...) -- 00 = fully opaque, FF = fully
  // invisible, OPPOSITE of normal opacity intuition: the MORE FADED the
  // choice, the LARGER the alpha number. The two most faded levels (Ghost,
  // Whisper) were added after the default "Faint" but turned out still
  // visible enough on real screens -- so the default was also shifted to
  // "Faint" (no longer "Medium") so the new default starts more faded.
  { id: "watermark-opacity", label: "Opacity", active: 2, choices: [
      { t: "Ghost", out: "D8", css: .15 },
      { t: "Whisper", out: "C0", css: .25 },
      { t: "Faint", out: "A0", css: .37 },
      { t: "Medium", out: "80", css: .5 },
      { t: "Bold", out: "40", css: .75 }] },
  // The watermark used to have Top/Middle/Bottom, and those were computed
  // RELATIVE to the caption -- it always landed just under it, wherever the
  // caption went. ian asked for the two to be positioned independently, so
  // it carries its own pair of percentages on the same scale as the
  // caption's. 18 is where the old "Bottom" put it under a default caption,
  // so nothing moves for a project that never touches these.
  { id: "watermark-y", label: "Y position", kind: "range",
    min: 2, max: 90, step: 1, def: 18, value: 18, unit: "%",
    hint: "Distance up from the bottom edge. No longer tied to the caption." },
  { id: "watermark-x", label: "X position", kind: "range",
    min: -25, max: 25, step: 1, def: 0, value: 0, unit: "%",
    hint: "Offset from the centre. Negative moves left." },
];

/* The `active` declared above IS each chip option's factory default, and
   `def` is each slider's. Captured here, before a project or the saved
   preset overwrites `active`, so Reset has something to go back to. */
for (const o of CAPTION_OPTIONS) o.factory = o.kind === "range" ? o.def : o.active;

/* Reading an option without caring which kind it is. Chip options answer
   with their active choice's `out`; sliders answer with their number. */
function captionOut(id) {
  const o = CAPTION_OPTIONS.find((x) => x.id === id);
  if (!o) return null;
  return o.kind === "range" ? o.value : o.choices[o.active].out;
}

/* Caption style sent to the server. This is what makes the settings on the
   Caption screen actually change the output file. */
function captionStyle() {
  return {
    font: captionOut("font"),
    size: captionOut("size"),
    highlight: captionOut("highlight"),
    highlight_style: captionOut("highlight-style"),
    position: captionOut("position"),
    x: captionOut("x"),
    per_line: captionOut("per-line"),
    reveal: captionOut("reveal"),
    outline: captionOut("outline"),
    watermark: captionOut("watermark"),
    watermark_size: captionOut("watermark-size"),
    watermark_opacity: captionOut("watermark-opacity"),
    watermark_y: captionOut("watermark-y"),
    watermark_x: captionOut("watermark-x"),
  };
}

/* GLOBAL caption/watermark preset, separate from projects. Projects store
   their OWN choices (see projectState() in projects.js) so opening an old
   project never overwrites the already-rendered style. But new projects have
   nothing to restore -- without this, they always start from factory
   defaults, forcing you to re-select watermark size/position/opacity every
   time a new video is dropped, when people usually want the same style as
   their previous project. */
const PRESET_CAPTION_KEY = profileKey("klipian:preset-caption");

/* Keyed by id, not a positional array of indices like it used to be. Two
   reasons: sliders store a VALUE, not an index into a choice list, and the
   list itself changed shape (three options became sliders, watermark
   position became two axes) -- with positions, every saved style would
   have silently re-pointed. readCaptionState() below still reads the old
   array form. */
function captionState() {
  const out = {};
  for (const o of CAPTION_OPTIONS) out[o.id] = o.kind === "range" ? o.value : o.active;
  return out;
}

/* The legacy positional format: which option each slot meant, and for the
   three that became sliders, what number each index stood for. Kept so
   projects and presets saved before the sliders still open with the style
   they were rendered at. */
const LEGACY_CAPTION_SLOTS = ["font", "size", "highlight", "position", "per-line",
  "outline", "watermark", "watermark-size", "watermark-opacity", "watermark-position"];
const LEGACY_CAPTION_VALUES = {
  size: [64, 84, 108],
  position: [16, 24, 34],
  "watermark-size": [22, 32, 46],
};

/* Where the old Top/Middle/Bottom modes actually put the watermark, as the
   single bottom-anchored percentage it carries now.

   This started as a flat table [78, 48, 18] and that was wrong for Bottom:
   that mode measured from the CAPTION's position, so a fixed number only
   held for a caption at its own default. ian's project came through with
   the caption at 16% and the watermark at 18% -- sitting on top of it,
   since the caption's own line reaches 21.7%. The formula below is the old
   one, so a migrated project keeps the placement it was rendered with.

   Top and Middle used different ASS alignments (8, measured from the top;
   5, dead centre) and are converted to the same bottom-anchored scale. */
function legacyWatermarkY(mode, captionY, watermarkSize) {
  const line = (watermarkSize * 1.3 / 1920) * 100;   // the old line-height estimate
  if (mode === 0) return Math.round(100 - 16 - line);      // Top: bottom edge on the 16% line
  if (mode === 1) return Math.round(50 - line / 2);        // Middle: centred
  // Bottom: below the caption, but never inside the bottom safe zone.
  return Math.round(Math.min(Math.max(2, captionY - line - 1), Math.max(0, 20 - line)));
}

function readCaptionState(saved) {
  if (!saved || typeof saved !== "object") return false;
  const put = (id, raw) => {
    const o = CAPTION_OPTIONS.find((x) => x.id === id);
    if (!o || typeof raw !== "number" || !Number.isFinite(raw)) return;
    if (o.kind === "range") o.value = Math.min(o.max, Math.max(o.min, raw));
    // Bounds-checked: a style saved when this option had more choices than
    // it has now would otherwise point past the end of the list.
    else if (Number.isInteger(raw) && raw >= 0 && raw < o.choices.length) o.active = raw;
  };

  if (Array.isArray(saved)) {
    saved.forEach((i, slot) => {
      const id = LEGACY_CAPTION_SLOTS[slot];
      if (!id || id === "watermark-position") return;   // handled after the loop
      const table = LEGACY_CAPTION_VALUES[id];
      put(id, table ? table[i] : i);
    });
    // Last, because it reads the caption position and watermark size the
    // loop above just restored.
    const mode = saved[LEGACY_CAPTION_SLOTS.indexOf("watermark-position")];
    if (Number.isInteger(mode)) {
      put("watermark-y", legacyWatermarkY(mode, captionOut("position"), captionOut("watermark-size")));
    }
    return true;
  }
  for (const [id, raw] of Object.entries(saved)) put(id, raw);
  return true;
}

function savePresetCaption() {
  try {
    localStorage.setItem(PRESET_CAPTION_KEY, JSON.stringify(captionState()));
  } catch { /* private/full -- preset is a convenience, not a requirement */ }
}

/* Called only for NEW projects (see openProject/openProjectFromHome in
   projects.js). */
function applyPresetCaption() {
  let preset;
  try { preset = JSON.parse(localStorage.getItem(PRESET_CAPTION_KEY)); }
  catch { preset = null; }
  // A profile can carry its own default caption look (profile settings).
  if (!preset) {
    try { preset = JSON.parse(sessionStorage.getItem("klipian:profile-meta") || "{}").defaults?.captionPreset; }
    catch { preset = null; }
  }
  if (!preset) return false;
  return readCaptionState(preset);
}

/* Reset to default, per tab (ian). Style and Watermark get one each rather
   than a single button for everything, so resetting the tab you're looking
   at can't quietly undo the other one. */
function resetCaptionGroup(group) {
  for (const o of CAPTION_OPTIONS) {
    const isWatermark = o.id.startsWith("watermark");
    if ((group === "watermark") !== isWatermark) continue;
    if (o.kind === "range") o.value = o.def;
    else o.active = o.factory;
  }
  drawCaptionOptions();
  applyCaption();
  if (typeof saveProject === "function") saveProject();
  savePresetCaption();
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

/* The fields you TYPE a time into (a suggestion's start/end, Clips from/to) show
   tenths of a second: "03:12.4". A time with a decimal point is taken as exactly
   that; one without is snapped to a word (snapManual). */
const timeTenths = (d) => {
  const n = Number.isFinite(d) ? Math.max(0, Math.round(d * 10)) : 0;
  return `${timeRange(Math.floor(n / 10))}.${n % 10}`;
};

/* Snapping a time that was TYPED, so a cut does not land inside a word. Much
   tighter than importing a reply (snapToWord, roundtrip.js: 2 s, nearest word
   either way -- what a rough time from Claude needs), because here the person
   means a time: at most MANUAL_SNAP_MAX seconds, and in one direction, the one
   that keeps the word whole:
     start: the last word that starts at or before the time; else the first
            word that starts after it;
     end:   the first word that ends at or after the time; else the last word
            that ends before it.
   Nothing within reach -> the time as typed. Returns { time, word } (`word` is
   the text of the word it landed on, or null when the time was kept). */
const MANUAL_SNAP_MAX = 0.6;

function snapManual(time, side) {
  const words = (typeof realTranscript !== "undefined" && realTranscript?.words) || [];
  if (!words.length || !Number.isFinite(time)) return { time, word: null };
  const within = (t) => Math.abs(t - time) <= MANUAL_SNAP_MAX + 1e-9;
  let pick = null;
  if (side === "start") {
    for (const w of words) if (w.start <= time + 1e-9 && within(w.start)) pick = w;     // the last one
    if (!pick) pick = words.find((w) => w.start > time && within(w.start)) || null;
    return pick ? { time: pick.start, word: String(pick.text).trim() } : { time, word: null };
  }
  pick = words.find((w) => w.end >= time - 1e-9 && within(w.end)) || null;
  if (!pick) for (const w of words) if (w.end < time && within(w.end)) pick = w;
  return pick ? { time: pick.end, word: String(pick.text).trim() } : { time, word: null };
}

/* What to tell the person about a typed time: that it was moved (and why), or that
   it was taken exactly. `typed` is what they entered, `res` what snapManual gave. */
function timeSetNote(label, side, typed, res) {
  if (res.word && Math.abs(res.time - typed) > 0.001) {
    return `${label} moved to ${timeTenths(res.time)} — the ${side === "start" ? "start" : "end"} of "${res.word}", `
      + `so no word is cut. Type ${timeTenths(typed)} for exactly ${timeRange(typed)}.`;
  }
  return `${label} set to exactly ${timeTenths(res.time)}`;
}


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
  // `out` separates what the MACHINE reads from what PEOPLE read. Previously
  // render branched via optionValue("format").startsWith("Blur") -- meaning
  // changing the button text silently changed the output file layout.
  //
  // WHAT IS SAVED. A Result stores `output` as one entry per option, in THIS
  // order: the active INDEX of a choice option, the number of a range one.
  // So the order and the meaning of every index are fixed once saved:
  //   - choices are only ever APPENDED, new options only ever go at the END;
  //   - `order` (below) is how they are SHOWN, and may differ;
  //   - a Result saved before an option existed has no entry for it, and gets
  //     the option's default (see applyOutput) -- which is what makes the
  //     older ones migrate by themselves:
  //       "Crop" (index 0 of the first option)             = Picture 9:16
  //       "Blur background" (index 1), no Background saved = Picture 16:9,
  //                                  Background Blur, Position 50 -- exactly
  //                                  what that choice rendered as.
  { id: "picture", label: "Picture",
    choices: ["9:16", "16:9", "3:4"], out: ["9:16", "16:9", "3:4"], active: 0, def: 0,
    order: [0, 2, 1],                      // shown 9:16 · 3:4 · 16:9
    hint: ["Fills the whole 9:16 frame with a tall slice of the source. The left and right edges are cut off.",
           "The whole source frame across the width, with the space above and below filled by the background.",
           "A 3:4 slice of the source across the width, with the space above and below filled by the background."] },
  // 2K and 4K are APPENDED, never inserted: see above.
  { id: "resolution", label: "Resolution", choices: ["720p", "1080p", "2K", "4K"],
    out: [720, 1080, 1440, 2160], active: 1, def: 1,
    hint: ["720×1280 — smaller file, faster render.",
           "1080×1920 — full size for TikTok, Reels and Shorts.",
           "1440×2560 — beyond what the platforms show; only worth it if the source is larger.",
           "2160×3840 — upscaled unless the source really is 4K, and much slower to render."] },
  // The render used to hardcode -crf 21. Lower is better quality and a
  // bigger file; these three sit either side of that old value, so
  // "Balanced" reproduces exactly what every earlier render produced.
  { id: "quality", label: "Quality", choices: ["Smaller file", "Balanced", "Best"],
    out: [26, 21, 17], active: 1, def: 1,
    hint: ["Noticeably lighter files. Fine for talking heads, softer on fast motion.",
           "The setting everything was rendered at until now.",
           "Keeps detail in motion and gradients, at roughly double the size."] },
  // Around a picture that is not 9:16. Blur is index 0 because it is what the
  // only such layout ("Blur background") always had.
  //
  // OPTIONAL: nothing is chosen until the person picks one, and until then the
  // background is Black (`fallback`) -- that is the default for a 3:4 or 16:9
  // picture that was just selected. "Not chosen" is saved as null in `output`,
  // which is what tells it apart from a chosen Blur (index 0) and from an entry
  // that is missing altogether (a Result saved before this option existed; see
  // applyOutput for what that one means).
  { id: "background", label: "Background", choices: ["Blur", "Black"], out: ["blur", "black"],
    active: 1, def: 1, optional: true, fallback: 1, chosen: false, order: [1, 0],      // shown Black · Blur
    shownWhen: () => optionOut("picture") !== "9:16",
    hint: ["A blurred copy of the picture fills the space above and below it.",
           "Plain black above and below the picture."] },
  // Where the picture sits in the 9:16 frame: 0 at the top, 100 at the bottom.
  // A number in `output`, not an index.
  { id: "position", label: "Position", kind: "range", min: 0, max: 100, step: 1, unit: "%",
    value: 50, def: 50,
    shownWhen: () => optionOut("picture") !== "9:16",
    hint: ["How far down the free space the picture sits: 0% at the top, 50% in the middle, "
           + "100% at the bottom. Captions can then use the space below it."] },
];

/* Defined here, with OPTIONS (which draws itself as this file loads), not in
   player.js: that one loads later.

   Human-readable values. For UI labels and history rows. */
function optionValue(id) {
  const o = OPTIONS.find((x) => x.id === id);
  if (!o) return "";
  return o.kind === "range" ? `${o.value}${o.unit || ""}` : o.choices[o.active];
}

/* Machine-readable values. Used when building the render request, so the
   button labels can change without altering anything in the output file. */
function optionOut(id) {
  const o = OPTIONS.find((x) => x.id === id);
  if (!o) return undefined;
  return o.kind === "range" ? o.value : o.out ? o.out[o.active] : undefined;
}

/* The order the rows are SHOWN in on the Output Format screen: the picture, what
   goes around it, then the file. (OPTIONS itself is in saved order, see above.) */
const OPTION_ROWS = ["picture", "background", "position", "resolution", "quality"];

/* What a Result saves for the options, one entry each, in OPTIONS order. */
function outputState() {
  return OPTIONS.map((o) => (o.kind === "range" ? o.value
    : o.optional && !o.chosen ? null : o.active));
}

/* Put a saved `output` back. An entry that is missing (saved before the option
   existed) or out of range becomes the option's default, NOT whatever the last
   Result left there: opening an older Result after a newer one must not carry
   the newer one's Background and Position along. */
function applyOutput(saved) {
  const list = Array.isArray(saved) ? saved : [];
  OPTIONS.forEach((o, k) => {
    const raw = list[k];
    const valid = Number.isInteger(raw) && raw >= 0 && raw < (o.choices ? o.choices.length : 0);
    if (o.kind === "range") {
      o.value = (typeof raw === "number" && Number.isFinite(raw))
        ? Math.min(o.max, Math.max(o.min, raw)) : o.def;
    } else if (o.optional) {
      // A choice that was made, or none yet (null, or any other value).
      o.chosen = valid;
      o.active = valid ? raw : o.fallback;
    } else {
      o.active = valid ? raw : o.def;
    }
  });
  const bg = OPTIONS.find((o) => o.id === "background");
  if (bg && savedBlurLayout(list)) { bg.chosen = true; bg.active = 0; }
}

/* A Result from before Background existed whose picture is the second one
   ("Blur background", now 16:9) has NO background entry at all -- not even a
   null -- and was always rendered on a blurred copy. That is a real choice
   that was never written down, so it is read as one: Blur, chosen, and saved
   as such the next time the project is written. (Black, the default for a
   picture just selected, must not take it over.) A 9:16 one needs nothing:
   it has no background to speak of until it is switched to 3:4 or 16:9. */
function savedBlurLayout(list) {
  const k = OPTIONS.findIndex((o) => o.id === "background");
  return list[0] === 1 && list[k] === undefined;
}

/* The background a saved `output` stands for, as the render names it. Used by
   the Home cover, which has the saved array and not the live options. */
function savedBackground(list) {
  const o = OPTIONS.find((x) => x.id === "background");
  const raw = list[OPTIONS.indexOf(o)];
  if (Number.isInteger(raw) && raw >= 0 && raw < o.choices.length) return o.out[raw];
  return savedBlurLayout(list) ? "blur" : o.out[o.fallback];
}

/* One line saying what the picture is, for the queue and the summary:
   "9:16", or "3:4 · black · 30%". */
function pictureSummary() {
  const pic = optionOut("picture");
  if (pic === "9:16") return "9:16";
  return `${pic} · ${optionOut("background")} · ${optionOut("position")}%`;
}


/* ───────── the Output Format of Results that are NOT open (bulk.js) ─────────
   OPTIONS holds the open Result's choices; a saved Result has only its `output` array. These read and write
   such an array through the same definitions, by laying it over OPTIONS for a moment and putting the open
   Result's choices back -- so a missing entry, an out-of-range one or an old "Blur background" mean here exactly
   what they mean when the Result is opened (applyOutput above), and nothing is restated. */
function withOutput(saved, fn) {
  const keep = outputState();
  applyOutput(saved);
  try { return fn(); } finally { applyOutput(keep); }
}

/* One entry per option, defaults filled in as opening the Result would. */
function normalizedOutput(saved) {
  return withOutput(saved, outputState);
}

/* A short line for a list: "9:16 · 1080p", "16:9 · blur bg · 1080p". */
function describeOutput(saved) {
  return withOutput(saved, () => {
    const pic = optionOut("picture");
    const bg = pic === "9:16" ? "" : ` · ${optionOut("background")} bg`;
    return `${pic}${bg} · ${optionValue("resolution")}`;
  });
}

/* `draft` is an output array (outputState() shape). Every option not in `keep` (a Set of option ids) is written
   over what the Result has; the others stay as the Result has them. */
function mergeOutput(saved, draft, keep) {
  const base = normalizedOutput(saved);
  return OPTIONS.map((o, k) => (keep.has(o.id) ? base[k] : draft[k]));
}

/* Write a format into saved Results (the open one included), save, and redraw whatever shows it. */
function applyOutputToResults(ids, draft, keep) {
  snapshotActiveResult();
  for (const id of ids) {
    const slot = SAVED_RESULTS.find((r) => r.id === id);
    if (slot) slot.output = mergeOutput(slot.output, draft, keep);
  }
  const open = SAVED_RESULTS.find((r) => r.id === activeResultId);
  if (open && ids.includes(open.id)) {
    applyOutput(open.output);
    renderPrepare();
    optionsChanged();
  }
  renderResultSwitcher();
  saveProject();
}

function renderPrepare() {
  const choiceRow = (o) => `
      <span class="choices">
        ${(o.order || o.choices.map((_, i) => i)).map((i) =>
          `<button class="chip" data-pick="${i}"${i === o.active ? ' aria-pressed="true"' : ""}>${escapeHTML(o.choices[i])}</button>`).join("")}
      </span>`;
  const rangeRow = (o) => `
      <span class="range-line">
        <input class="slider" type="range" min="${o.min}" max="${o.max}" step="${o.step}"
               value="${o.value}" aria-label="${escapeHTML(o.label)}">
        <output class="data">${o.value}${o.unit || ""}</output>
      </span>`;
  $("#options").innerHTML = OPTION_ROWS.map((id) => OPTIONS.find((x) => x.id === id)).map((o) => `
    <div class="option-row" data-option="${o.id}">
      <span class="eyebrow">${escapeHTML(o.label)}</span>
      ${o.kind === "range" ? rangeRow(o) : choiceRow(o)}
      <span class="hint">${escapeHTML(o.kind === "range" ? o.hint[0] : o.hint ? o.hint[o.active] : "")}</span>
    </div>`).join("");
  updateOptionRows();
  summarizeOptions();
  if (typeof attachVideoGeometry === "function") attachVideoGeometry();
}

/* Background and Position only mean something for a picture that is not 9:16;
   for 9:16 their rows are hidden (not removed, so keyboard focus survives a
   change of Picture). */
function updateOptionRows() {
  for (const o of OPTIONS) {
    if (!o.shownWhen) continue;
    const row = document.querySelector(`#options .option-row[data-option="${o.id}"]`);
    if (row) row.hidden = !o.shownWhen();
  }
}

/* Hint follows the currently active choice. It's rewritten in place, not
   through renderPrepare(), so keyboard focus doesn't leave the chip that
   was just pressed. */
function refreshHint(row, o) {
  const el = row.querySelector(".hint");
  if (el && o.hint && o.kind !== "range") el.textContent = o.hint[o.active];
}

/* The summary is derived from OPTIONS: what is shown, in the order it is shown. */
function summarizeOptions() {
  const parts = [];
  for (const id of OPTION_ROWS) {
    const o = OPTIONS.find((x) => x.id === id);
    if (o.shownWhen && !o.shownWhen()) continue;
    parts.push(o.kind === "range" ? `${o.value}${o.unit || ""}` : o.choices[o.active]);
  }
  $("#optionsSummary").textContent = parts.join(" · ");
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
    // "queued": waiting for its turn on this computer (sched.py); the job's `queue.text` says for what
    if (job.state === "running" || job.state === "queued") { if (onTick) onTick(job); return; }
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

  // "Cancel all" only makes sense while several clips are queued
  const cancelAll = $("#queueCancelAll");
  if (cancelAll) cancelAll.hidden = !(typeof renderJobId !== "undefined" && renderJobId !== null && QUEUE.filter((r) => r.pct !== 100).length > 1);

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
         <div class="title">Nothing is rendering</div>
         <div class="sub">A render started from the Render screen shows its progress here.</div>
       </div></div>`;
}

function renderList() {
  // Don't overwrite the QUEUE if a render is in progress -- folder data
  // and server progress will be lost if buildQueue() is called again.
  if (!QUEUE.length || QUEUE.every((r) => r.pct === 0 && !r.busy && !r.folder)) {
    buildQueue();
  }
  drawQueue();

  drawCaptionOptions();
}

/* The Captions screen splits these across a Style tab and a Watermark tab
   (ian), so they're drawn into two containers by id prefix rather than one
   flat list. Nothing else distinguishes them -- every watermark option is
   named "watermark…" and no style option is -- so the prefix IS the group,
   and adding a new option to either tab is still just an entry in
   CAPTION_OPTIONS.

   Rows are stacked, label above chips, for the same reason .option-row is:
   they live in a --w-config column now, and a 130px label column left no
   room for five colour chips. The trailing .meta echoing the active choice
   went with it -- the pressed chip already says which one it is. */
function drawCaptionOptions() {
  const chips = (o) => `
    <span class="choices">
      ${o.choices.map((p, i) => `
        <button class="chip"${i === o.active ? ' aria-pressed="true"' : ""}
                ${p.css ? `style="--color-dot:${p.css}"` : ""}
                data-pick="${i}">${p.css ? '<i class="color-dot"></i>' : ""}${escapeHTML(p.t)}</button>`).join("")}
    </span>`;
  const slider = (o) => `
    <input class="slider" type="range" min="${o.min}" max="${o.max}" step="${o.step}"
           value="${o.value}" aria-label="${escapeHTML(o.label)}">`;
  // A real number field, not a read-out (ian): dragging is for finding a
  // value, typing is for setting one you already know -- and a slider alone
  // can't be told "84". It sits on the label's line, where the read-out was,
  // because it answers the question the label asks.
  //
  // The steppers are drawn here rather than left to the browser: the native
  // spinner only appears on hover, sits at whatever size Chromium picks,
  // and is styled for a light form -- three reasons it looked wrong next to
  // everything else. Same chevron as the sidebar toggle, at stepper size.
  const chevron = (d) => `<svg width="9" height="9" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" stroke-width="3.5" stroke-linecap="round"
      stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`;
  const number = (o) => `
    <span class="num-field">
      <input class="slider-number" type="number" min="${o.min}" max="${o.max}" step="${o.step}"
             value="${o.value}" aria-label="${escapeHTML(o.label)} value">
      <span class="num-step">
        <button type="button" data-step="1" tabindex="-1"
                aria-label="Increase ${escapeHTML(o.label)}">${chevron("M5 15 L12 8 L19 15")}</button>
        <button type="button" data-step="-1" tabindex="-1"
                aria-label="Decrease ${escapeHTML(o.label)}">${chevron("M5 9 L12 16 L19 9")}</button>
      </span>
    </span>`;
  const row = (o) => `
    <div class="caption-row" data-caption="${o.id}">
      <span class="eyebrow">${escapeHTML(o.label)}${o.kind === "range"
        ? `${number(o)}${o.unit ? `<i class="slider-unit">${o.unit}</i>` : ""}` : ""}</span>
      ${o.kind === "range" ? slider(o) : chips(o)}
      ${o.hint ? `<span class="hint">${escapeHTML(o.hint)}</span>` : ""}
    </div>`;
  const style = $("#captionList");
  const mark = $("#watermarkList");
  if (style) style.innerHTML = CAPTION_OPTIONS.filter((o) => !o.id.startsWith("watermark")).map(row).join("");
  if (mark) mark.innerHTML = CAPTION_OPTIONS.filter((o) => o.id.startsWith("watermark")).map(row).join("");
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
const NO_PREVIEW = ["assets", "analysis", "history"];

/* Three screens that edit the same result. Split into separate menus so
   each screen has one concern: Clips picks the cuts, Framing adjusts the
   frame, Text handles words and appearance. */
// Render joins them: it shows the same preview and is where the Result is
// finally judged, so it needs the same redraw on arrival.
const RESULT_SCREENS = ["clips", "timeline", "framing", "captions", "render", "output"];

/* The currently active screen. Saved with the project so "Continue" brings
   you back to where you left off -- if you were adjusting framing, you
   return to Framing, not thrown into Clips every time. */
let activeScreen = "clips";

function toScreen(name) {
  activeScreen = name;
  // On .app, not .stage: the stage's columns AND the elements placed into
  // them are both restyled per screen (see the Output Format layout in app.css),
  // and .app is the common ancestor of all of them.
  $("#app").dataset.screen = name;
  // Which screen the work was left on is remembered, but looking at a screen
  // is not a change to the project: no "Unsaved changes", no write, no new
  // `at` (see rememberScreen and saveProject in projects.js).
  if (typeof rememberScreen === "function") rememberScreen(name);
  document.querySelectorAll(".screen").forEach((s) =>
    s.classList.toggle("active", s.dataset.screen === name));
  document.querySelectorAll(".tab").forEach((t) => {
    const active = t.dataset.to === name;
    t.setAttribute("aria-selected", String(active));
    t.tabIndex = active ? 0 : -1;   // roving tabindex per ARIA tabs pattern
  });

  if (name === "history" && typeof loadHistory === "function") loadHistory();
  if (name === "assets" && typeof renderAssets === "function") renderAssets();
  // After the Result-screen redraws below have set the preview's clip.
  if (name === "timeline" && typeof renderTimeline === "function") setTimeout(renderTimeline, 0);

  // The LENGTH readout and the two buttons live only on this screen now, so
  // arriving is the moment they have to be made current -- renderPreview()
  // is otherwise driven by playback and result switching, neither of which
  // has to have happened before you come here.
  if (name === "render") {
    if (typeof refreshPostCredit === "function") refreshPostCredit();
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

/* Caption sub-tabs. Plain show/hide -- each panel's contents are already
   drawn and kept current by renderCaptions()/drawCaptionOptions(), so
   switching is only a matter of which one is on screen. aria-pressed, not
   the ARIA tabs pattern: these are toggle buttons over sibling panels, and
   claiming role="tab" would promise arrow-key navigation that isn't here. */
$("#captionTabs")?.addEventListener("click", (e) => {
  const b = e.target.closest(".subtab");
  if (!b) return;
  const pick = b.dataset.subtab;
  document.querySelectorAll("#captionTabs .subtab").forEach((t) =>
    t.setAttribute("aria-pressed", String(t.dataset.subtab === pick)));
  document.querySelectorAll("#panel-captions .subtab-panel").forEach((p) => {
    p.hidden = p.dataset.subtabPanel !== pick;
  });
});

$("#options")?.addEventListener("click", (e) => {
  const c = e.target.closest(".chip");
  if (!c) return;
  const row = c.closest(".option-row");
  const o = OPTIONS.find((x) => x.id === row.dataset.option);
  // The chip's own index: the chips may be shown in another order than the
  // choices are stored in (`order`).
  o.active = Number(c.dataset.pick);
  if (o.optional) o.chosen = true;      // from here on it is the person's choice
  row.querySelectorAll(".chip").forEach((b) =>
    b.setAttribute("aria-pressed", String(Number(b.dataset.pick) === o.active)));
  refreshHint(row, o);
  updateOptionRows();
  if (typeof saveProject === "function") saveProject();
  summarizeOptions();
  optionsChanged();
});

$("#options")?.addEventListener("input", (e) => {
  const input = e.target.closest("input.slider");
  if (!input) return;
  const o = OPTIONS.find((x) => x.id === input.closest(".option-row")?.dataset.option);
  if (!o || o.kind !== "range") return;
  o.value = Math.min(o.max, Math.max(o.min, Number(input.value)));
  const out = input.closest(".option-row").querySelector("output");
  if (out) out.textContent = `${o.value}${o.unit || ""}`;
  if (typeof saveProject === "function") saveProject();
  summarizeOptions();
  optionsChanged();
});

/* What the other screens do when the Picture, Background or Position moves:
   the Framing screen's box ratio and its note, and the preview's composition.
   Each is optional: a screen not loaded yet simply has nothing to update. */
function optionsChanged() {
  if (typeof updateFramingLayoutWarning === "function") updateFramingLayoutWarning();
  if (typeof onPictureChanged === "function") onPictureChanged();
  // The preview shows the same composition the render will make.
  if (typeof attachVideoGeometry === "function") attachVideoGeometry();
  if (typeof syncCanvasVideo === "function") syncCanvasVideo();
}

drawAll();
toScreen("clips");
toStage("home");
