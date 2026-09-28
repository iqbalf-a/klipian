/* klipian — a project's source videos (assets)
   ==========================================================================
   A project holds a LIST of videos, not one (library-projects plan, stage 1):
   moments can be taken from several episodes and joined into one Result.

   The rest of the editor was written for exactly one source video, and
   almost all of it thinks in "source seconds": framing points sit at a
   source second, caption corrections are keyed by one, the preview skips
   between source ranges. Rather than teach every one of those files about
   assets, each video gets its own stretch of ONE long virtual timeline:

       a1:  0 ............ ~   (offset 0)
       a2:  1 000 000 .... ~   (offset 1e6 s -- 11½ days, longer than any source)
       a3:  2 000 000 .... ~

   RESULT spans, FRAMING points, CORRECTIONS keys and the preview player all
   live on that virtual timeline, so sorting, merging, "which framing point
   is active", "which words fall in this span" keep working untouched -- two
   videos can never overlap on it. Conversion to a real (video, second) pair
   happens only at the edges: playing a <video>, talking to the server,
   showing a time to a person, and saving.

   a1 has offset 0, so a single-video project -- every project made before
   this -- is on the virtual timeline exactly where it always was. Nothing
   about it changes, which is what keeps its renders byte-identical.

   The offset comes from the asset's id number (a2 -> 1e6), and ids are never
   reused, so removing a video never shifts another one's times.
   ========================================================================== */

const ASSET_STRIDE = 1e6;

let ASSETS = [];                 // [{ id, kind, file }] -- the project's library
let activeAssetId = "a1";        // the video the Analyze and Clips screens work on

/* Transcripts and AI suggestions of the videos that are NOT active. The
   active one's live where they always have: realTranscript (roundtrip.js)
   and DATA.candidates -- so everything that reads those keeps meaning
   "the video on screen" without knowing assets exist. */
const ASSET_TRANSCRIPTS = {};
let ASSET_CANDIDATES = {};

const assetNum = (id) => { const n = parseInt(String(id || "").slice(1), 10); return n > 0 ? n : 1; };
const assetOffset = (id) => (assetNum(id) - 1) * ASSET_STRIDE;
const assetById = (id) => ASSETS.find((a) => a.id === id) || null;
const assetIdAt = (vt) => `a${Math.floor(Math.max(0, vt) / ASSET_STRIDE) + 1}`;
const videoAssets = () => ASSETS.filter((a) => a.kind === "video");
const isMultiAsset = () => videoAssets().length > 1;
const activeAssetOffset = () => assetOffset(activeAssetId);
const assetStem = (a) => (a?.file || "").replace(/\.[^.]+$/, "");

/* Taking the 1e6 offset back out leaves float dust (1015.97 comes back as
   1015.9699999999721). Rounded to the microsecond -- far below one frame --
   and only when there IS an offset: the first video's seconds pass through
   untouched, bit for bit. */
const unshift = (vt, off) => (off ? Math.round((vt - off) * 1e6) / 1e6 : vt);

/* Virtual second -> the real (asset, second, file) it stands for. */
function toReal(vt) {
  const id = assetIdAt(vt);
  return { id, t: unshift(vt, assetOffset(id)), file: assetById(id)?.file || "" };
}

/* Real second in the ACTIVE video -> virtual. Everything the Clips screen
   produces (a timeline selection, an AI suggestion) is in the active
   video's own seconds; this is where it joins the shared timeline. */
const activeToVirtual = (t) => t + activeAssetOffset();

function assetUrl(a) {
  // A file dropped from outside workspace/samples/ only has a blob: URL,
  // and only while it's the active one -- see acceptFile().
  if (a.id === activeAssetId && chosenSource?.url && chosenSource.name === a.file) return chosenSource.url;
  return `/workspace/samples/${encodeURIComponent(a.file)}`;
}

function assetTranscript(id) {
  return id === activeAssetId ? realTranscript : (ASSET_TRANSCRIPTS[id] || null);
}

/* A clock for a virtual second. Single-video projects look exactly as
   before; with several, the video's name comes first so "02:10" can't be
   read as the wrong episode's 02:10. */
function assetTimeLabel(vt, fmt = timeRange) {
  const r = toReal(vt);
  return isMultiAsset() ? `${assetStem(assetById(r.id))} ${fmt(r.t)}` : fmt(r.t);
}

/* ---------- transcript words on the virtual timeline ----------
   Shifted copies are cached per transcript object: drawCaption() asks for
   these on every timeupdate, and re-shifting thousands of words four times
   a second is waste. a1 needs no copy at all -- its words already sit at
   their virtual position -- so a single-video project gets back the very
   same array it always did. */
const _shiftedWords = new Map();
function assetWordsVirtual(id) {
  const tr = assetTranscript(id);
  if (!tr?.words) return [];
  const off = assetOffset(id);
  if (!off) return tr.words;
  const hit = _shiftedWords.get(id);
  if (hit && hit.src === tr) return hit.words;
  const words = tr.words.map((w) => ({ ...w, start: w.start + off, end: w.end + off }));
  _shiftedWords.set(id, { src: tr, words });
  return words;
}

function resultTranscriptWords() {
  const ids = videoAssets().map((a) => a.id);
  if (ids.length <= 1) return assetWordsVirtual(ids[0] || activeAssetId);
  return ids.flatMap(assetWordsVirtual);
}

/* ---------- the preview <video> elements ----------
   Each element remembers which asset it has loaded (data-asset), so its
   own currentTime -- always REAL seconds in that file -- can be turned
   into a virtual second and back. */
function vNow(el) {
  return (el?.currentTime || 0) + assetOffset(el?.dataset.asset || activeAssetId);
}

/* Seek to a virtual second, loading the other video first if the second
   belongs to a different one. Playback resumes after the switch if it was
   running -- that's what lets the Result preview run straight through a
   join between two episodes. */
function vSeek(el, vt) {
  if (!el) return;
  const r = toReal(vt);
  const a = assetById(r.id);
  const current = el.dataset.asset || activeAssetId;
  if (a && r.id !== current) {
    const wasPlaying = !el.paused;
    el.dataset.asset = r.id;
    el.dataset.switching = "1";
    el.src = assetUrl(a);
    el.addEventListener("loadedmetadata", () => {
      delete el.dataset.switching;
      try { el.currentTime = r.t; } catch { /* out of range */ }
      if (wasPlaying) el.play().catch(() => {});
    }, { once: true });
    return;
  }
  try { el.currentTime = r.t; } catch { /* metadata not ready yet */ }
}

/* ---------- talking to the server ----------
   Everything the server does is per video and in real seconds. */

/* A virtual range -> the request fields for the video it lies in, plus the
   offset to add back to any absolute times in the reply. */
function realRange(start, end) {
  const r = toReal(start);
  const off = assetOffset(r.id);
  return { video: r.file || chosenSource?.name, start: r.t, end: unshift(end, off), offset: off };
}

/* The render payload for one clip: spans and caption words back in real
   seconds. The request names ONE video -- the first span's -- and only
   spans/words from another video carry their own `video`, so a clip from
   a single video sends exactly the payload it always did (and takes the
   server's unchanged one-encode path). */
function serverClipFields(spans, words, mainFile) {
  // `mainFile` when one request carries several clips: they share the
  // request's one `video`, so every clip must be measured against it.
  const main = mainFile || (spans.length ? toReal(spans[0].start).file : (chosenSource?.name || ""));
  const conv = (p) => {
    const r = toReal(p.start);
    const out = { ...p, start: r.t, end: unshift(p.end, assetOffset(r.id)) };
    if (r.file && r.file !== main) out.video = r.file;
    return out;
  };
  return {
    video: main,
    spans: spans.map(conv),
    words: Array.isArray(words) ? words.map(conv) : words,
  };
}

/* The Clips timeline measures itself by the transcript's duration, falling
   back to chosenSource.duration -- which only a DROPPED file has (read
   from the <video>). A video opened from a project card or picked here
   that hasn't been transcribed had neither, so its timeline was 0 seconds
   long and refused every selection. Cutting moments by hand from an
   untranscribed episode is exactly what a multi-video project invites,
   so ffprobe answers instead. */
async function ensureSourceDuration() {
  if (!chosenSource || realTranscript?.duration || Number.isFinite(chosenSource.duration)) return;
  const src = chosenSource;
  try {
    const d = await (await fetch(`/api/probe?video=${encodeURIComponent(src.name)}`)).json();
    if (chosenSource === src && Number.isFinite(d.duration)) {
      src.duration = d.duration;
      if (typeof updateTopbarFile === "function") updateTopbarFile(src.name, d.duration);
      if (typeof drawTotalTimeline === "function") drawTotalTimeline();
    }
  } catch { /* no backend -- the timeline says so already */ }
}

/* ---------- switching the active video ---------- */

async function setActiveAsset(id) {
  const a = assetById(id);
  if (!a || id === activeAssetId) return;
  // Park the outgoing video's transcript and suggestions...
  ASSET_TRANSCRIPTS[activeAssetId] = realTranscript;
  ASSET_CANDIDATES[activeAssetId] = (typeof DATA !== "undefined" ? DATA.candidates : []) || [];
  activeAssetId = id;
  if (chosenSource?.url?.startsWith("blob:")) URL.revokeObjectURL(chosenSource.url);
  chosenSource = { kind: "file", name: a.file, url: `/workspace/samples/${encodeURIComponent(a.file)}` };
  // ...and bring in the incoming one's. Fetched if it was never loaded.
  realTranscript = ASSET_TRANSCRIPTS[id] ?? (await findTranscript(a.file).catch(() => null));
  ASSET_TRANSCRIPTS[id] = realTranscript;
  if (typeof DATA !== "undefined") DATA.candidates = ASSET_CANDIDATES[id] || [];
  if (typeof updateTopbarFile === "function") updateTopbarFile(a.file, realTranscript?.duration);
  await ensureSourceDuration();
  if (typeof clearSelection === "function") clearSelection();
  if (typeof closeRecPreview === "function") closeRecPreview();
  if (typeof drawSource === "function") drawSource();
  if (typeof renderRecommendations === "function") renderRecommendations();
  if (typeof drawTotalTimeline === "function") drawTotalTimeline();
  renderAssets();
  if (typeof saveProject === "function") saveProject();
}

/* Load every non-active video's transcript, so a Result mixing videos has
   captions (and a preview caption line) for all of them, not just the one
   on screen. Called once when a project opens. */
async function loadAssetTranscripts() {
  await Promise.all(videoAssets().filter((a) => a.id !== activeAssetId && !ASSET_TRANSCRIPTS[a.id])
    .map(async (a) => { ASSET_TRANSCRIPTS[a.id] = await findTranscript(a.file).catch(() => null); }));
}

/* Replace the whole library -- opening a project, or starting a new one
   (empty list). Caches from the previous project go with it. */
function setAssets(list, activeId) {
  ASSETS = (list || []).filter((a) => a && a.id && a.file)
    .map((a) => ({ id: a.id, kind: a.kind || "video", file: a.file }));
  const first = videoAssets()[0]?.id || "a1";
  activeAssetId = assetById(activeId)?.kind === "video" ? activeId : first;
  for (const k of Object.keys(ASSET_TRANSCRIPTS)) delete ASSET_TRANSCRIPTS[k];
  ASSET_CANDIDATES = {};
  _shiftedWords.clear();
  // A dropped file is loaded into the preview (prepareVideo) BEFORE the
  // project is looked up, so the element was tagged with the previous
  // project's active id. It holds the file now on screen.
  const v = document.querySelector("#videoPreview");
  if (v?.src && chosenSource?.url && v.src === new URL(chosenSource.url, location.href).href) {
    v.dataset.asset = activeAssetId;
  }
  renderAssets();
}

/* The project's first video names it for "same video = same project" and
   is the `video` field older readers of the file still look at. */
const primaryAssetFile = () => videoAssets()[0]?.file || "";

/* ---------- which assets a Result uses ---------- */

function assetsUsedBy(spans) {
  return new Set((spans || []).map((s) => assetIdAt(s.start)));
}

function assetUseCount(id) {
  let n = 0;
  const all = (typeof SAVED_RESULTS !== "undefined" ? SAVED_RESULTS : []);
  for (const r of all) {
    for (const s of r.result || []) if ((s.asset || "a1") === id) n++;
  }
  return n;
}

/* ---------- Assets screen ---------- */

let _sampleList = null;          // cache of /api/video for this render
let _transcriptList = null;      // cache of /api/cache names

async function renderAssets() {
  const list = $("#assetList");
  const addList = $("#assetAddList");
  const note = $("#assetNote");
  // The picker on Analyze/Clips: only when there's a choice to make, so a
  // single-video project looks exactly as it always did.
  document.querySelectorAll(".asset-picker").forEach((wrap) => {
    wrap.hidden = !isMultiAsset();
    const sel = wrap.querySelector(".asset-select");
    if (sel) {
      sel.innerHTML = videoAssets().map((a) =>
        `<option value="${a.id}"${a.id === activeAssetId ? " selected" : ""}>${escapeHTML(a.file)}</option>`).join("");
    }
  });
  if (!list) return;

  if (typeof SAVED_RESULTS !== "undefined" && typeof snapshotActiveResult === "function") snapshotActiveResult();
  try { _sampleList = (await (await fetch("/api/video")).json()).video || []; } catch { _sampleList = null; }
  try { _transcriptList = (await (await fetch("/api/cache")).json()).transcript || []; } catch { _transcriptList = []; }
  const hasTranscript = (file) => {
    const stem = file.replace(/\.[^.]+$/, "");
    return (_transcriptList || []).some((f) => decodeURIComponent(f).startsWith(stem + "."));
  };

  const vids = videoAssets();
  if (note) note.textContent = vids.length
    ? `${vids.length} video${vids.length === 1 ? "" : "s"} in this project`
    : "no video yet";

  list.innerHTML = vids.length ? vids.map((a) => {
    const uses = assetUseCount(a.id);
    const missing = _sampleList && !_sampleList.includes(a.file);
    const active = a.id === activeAssetId;
    const removable = vids.length > 1 && uses === 0;
    return `
    <div class="asset-row${active ? " active" : ""}${missing ? " missing" : ""}" data-asset-row="${a.id}">
      <span class="asset-kind" aria-hidden="true">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"
             stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="14" height="14" rx="2"/>
          <path d="M17 10 L21 7 L21 17 L17 14"/></svg>
      </span>
      <span class="asset-name" title="${escapeHTML(a.file)}">${escapeHTML(a.file)}</span>
      <span class="data asset-meta">${missing ? "not in samples/"
        : `${hasTranscript(a.file) ? "transcribed" : "not transcribed"} · ${uses} span${uses === 1 ? "" : "s"} used`}</span>
      ${active ? '<span class="asset-active">on screen</span>'
        : `<button class="btn quiet" type="button" data-asset-open="${a.id}"${missing ? " disabled" : ""}>Open</button>`}
      <button class="btn quiet" type="button" data-asset-remove="${a.id}"${removable ? "" : " disabled"}
              title="${removable ? "Remove from this project" : (uses ? "Used by a Result — remove its spans first" : "A project keeps at least one video")}">Remove</button>
    </div>`;
  }).join("") : `<p class="empty-message">No video yet. Add one below.</p>`;

  if (addList) {
    if (_sampleList === null) {
      addList.innerHTML = `<p class="empty-message">Needs the backend. Run: python -m klipian serve</p>`;
    } else {
      const inProject = new Set(vids.map((a) => a.file));
      const free = _sampleList.filter((f) => !inProject.has(f));
      addList.innerHTML = free.length ? free.map((f) => `
        <div class="asset-row">
          <span class="asset-name" title="${escapeHTML(f)}">${escapeHTML(f)}</span>
          <span class="data asset-meta">${hasTranscript(f) ? "transcribed" : "not transcribed"}</span>
          <button class="btn" type="button" data-asset-add="${escapeHTML(f)}">Add</button>
        </div>`).join("")
        : `<p class="empty-message">Every video in workspace/samples/ is already in this project.
             Put another file there to add it.</p>`;
    }
  }
}

function addAsset(file) {
  if (!file || videoAssets().some((a) => a.file === file)) return null;
  const next = Math.max(0, ...ASSETS.map((a) => assetNum(a.id))) + 1;
  const a = { id: `a${next}`, kind: "video", file };
  ASSETS.push(a);
  if (typeof saveProject === "function") saveProject();
  return a;
}

function removeAsset(id) {
  // Count against what's on screen NOW, not the last snapshot.
  if (typeof snapshotActiveResult === "function") snapshotActiveResult();
  if (videoAssets().length <= 1 || assetUseCount(id) > 0) return false;
  ASSETS = ASSETS.filter((a) => a.id !== id);
  delete ASSET_TRANSCRIPTS[id];
  delete ASSET_CANDIDATES[id];
  _shiftedWords.delete(id);
  if (activeAssetId === id) setActiveAsset(videoAssets()[0].id);
  if (typeof saveProject === "function") saveProject();
  return true;
}

$("#panel-assets")?.addEventListener("click", async (e) => {
  const add = e.target.closest("[data-asset-add]");
  if (add) {
    add.disabled = true;
    const a = addAsset(add.dataset.assetAdd);
    if (a) ASSET_TRANSCRIPTS[a.id] = await findTranscript(a.file).catch(() => null);
    renderAssets();
    return;
  }
  const open = e.target.closest("[data-asset-open]");
  if (open) {
    await setActiveAsset(open.dataset.assetOpen);
    toScreen("clips");
    return;
  }
  const rm = e.target.closest("[data-asset-remove]");
  if (rm) { removeAsset(rm.dataset.assetRemove); renderAssets(); }
});

document.querySelectorAll(".asset-select").forEach((sel) =>
  sel.addEventListener("change", () => setActiveAsset(sel.value)));
