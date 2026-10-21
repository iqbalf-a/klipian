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
/* The highest asset number this project has EVER handed out, saved with it
   (`assetSeq`). Taking max+1 of the current list would reuse a removed
   video's id -- and with it that video's stretch of the virtual timeline,
   where old caption corrections are still keyed. */
let assetSeq = 0;
function nextAssetNum() {
  assetSeq = Math.max(assetSeq, ...ASSETS.map((a) => assetNum(a.id))) + 1;
  return assetSeq;
}

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
  // A file dropped from outside workspace/sources/ only has a blob: URL,
  // and only while it's the active one (a project from before the drop
  // zone went away can still be holding one).
  if (a.id === activeAssetId && chosenSource?.url && chosenSource.name === a.file) return chosenSource.url;
  return profileUrl(`/workspace/sources/${encodeURIComponent(a.file)}`);
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
  // The Analyze screen's "Transcribe again" belongs to the video it was shown for.
  if (typeof hideTranscriptActions === "function") hideTranscriptActions();
  if (typeof loadCues === "function") loadCues(a.file);
  // Park the outgoing video's transcript and suggestions...
  ASSET_TRANSCRIPTS[activeAssetId] = realTranscript;
  ASSET_CANDIDATES[activeAssetId] = (typeof DATA !== "undefined" ? DATA.candidates : []) || [];
  activeAssetId = id;
  if (chosenSource?.url?.startsWith("blob:")) URL.revokeObjectURL(chosenSource.url);
  chosenSource = { kind: "file", name: a.file, url: profileUrl(`/workspace/sources/${encodeURIComponent(a.file)}`) };
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
function setAssets(list, activeId, seq) {
  ASSETS = (list || []).filter((a) => a && a.id && a.file)
    .map((a) => ({ id: a.id, kind: a.kind || "video", file: a.file }));
  assetSeq = Math.max(Number(seq) || 0, 0, ...ASSETS.map((a) => assetNum(a.id)));
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


/* ---------- which assets a Result uses ---------- */

function assetUseCount(id) {
  let n = 0;
  const all = (typeof SAVED_RESULTS !== "undefined" ? SAVED_RESULTS : []);
  for (const r of all) {
    for (const s of r.segments || r.result || []) if ((s.asset || "a1") === id) n++;
  }
  return n;
}

/* ---------- Add video: a file from anywhere on disk ----------
   Copied into workspace/sources/ (the folder the server looks videos up in)
   with a progress bar, then added to the project like one picked from the
   list. fetch() can't report upload progress, hence XMLHttpRequest. */

let videoUpload = null;          // the running request, for Cancel

const mb = (b) => `${b >= 104857600 ? Math.round(b / 1048576) : (b / 1048576).toFixed(1)} MB`;

function uploadVideo(file, paint) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    videoUpload = xhr;
    const t0 = performance.now();
    xhr.open("POST", `/api/video-upload?name=${encodeURIComponent(file.name)}`);
    xhr.setRequestHeader("Content-Type", "application/octet-stream");
    xhr.setRequestHeader("X-Klipian-Profile", PROFILE);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) paint(e.loaded, e.total, (performance.now() - t0) / 1000);
    };
    xhr.onload = () => {
      let d = {};
      try { d = JSON.parse(xhr.responseText); } catch { /* not JSON: the status says it */ }
      if (xhr.status >= 200 && xhr.status < 300 && d.name) resolve({ name: d.name, renamedFrom: d.renamedFrom || null, creditFrom: d.creditFrom || null });
      else reject(new Error(d.error || `Upload failed (${xhr.status}).`));
    };
    xhr.onerror = () => reject(new Error("Upload failed. Is klipian serve still running?"));
    xhr.onabort = () => reject(new Error("Upload cancelled."));
    xhr.send(file);
  });
}

async function addVideoFromDisk(file) {
  const row = $("#videoUploadRow"), bar = $("#videoUploadBar"), note = $("#videoUploadNote");
  const cancel = $("#videoUploadCancel");
  const say = (text, error = false) => {
    row.hidden = false;
    note.textContent = text;
    note.dataset.error = error ? "true" : "false";
  };
  bar.style.width = "0%";
  cancel.hidden = true;
  say(`Checking ${file.name} …`);
  try {
    const chk = await (await fetch(`/api/video-check?name=${encodeURIComponent(file.name)}&size=${file.size}`)).json();
    if (chk.error) throw new Error(chk.error);
    let name = chk.reuse;
    let renamedFrom = null, creditFrom = null;
    if (name) {
      bar.style.width = "100%";
      say(`${name} is already in this profile's sources — using that copy.`);
    } else {
      if (file.size + 1024 ** 3 > chk.free) {
        throw new Error(`Not enough disk space: ${mb(file.size)} needed, ${mb(chk.free)} free.`);
      }
      cancel.hidden = false;
      const sent = await uploadVideo(file, (done, total, secs) => {
        const rate = secs > 0 ? done / secs : 0;
        const left = rate > 0 ? (total - done) / rate : 0;
        bar.style.width = `${(done / total * 100).toFixed(1)}%`;
        say(`${file.name} · ${mb(done)} of ${mb(total)} · ${Math.round(done / total * 100)}%` +
            (rate ? ` · ${mb(rate)}/s · ${left >= 60 ? `~${Math.round(left / 60)} min` : `~${Math.round(left)} s`} left` : ""));
      });
      name = sent.name;
      renamedFrom = sent.renamedFrom;
      creditFrom = sent.creditFrom;
    }
    cancel.hidden = true;
    await addVideoToProject(name);
    const notes = [];
    if (renamedFrom) notes.push(`Saved as ${name}: the space or dot before the extension in "${renamedFrom}" was removed.`);
    if (creditFrom) notes.push(`The source credit was copied from the profile "${creditFrom}" (same video).`);
    if (notes.length) say(notes.join(" ")); else row.hidden = true;
  } catch (err) {
    cancel.hidden = true;
    say(err.message, true);
  } finally {
    videoUpload = null;
  }
}

$("#addVideoBtn")?.addEventListener("click", () => { if (!videoUpload) $("#videoFileInput").click(); });
$("#videoUploadCancel")?.addEventListener("click", () => videoUpload?.abort());
// From a YouTube link (shared/ytdl.js): the download lands in the sources folder with its credit
// filled in, and is added to this project like a file chosen from disk.
$("#addYouTubeBtn")?.addEventListener("click", () => openYouTubeDialog({
  onAdded: async (name) => { try { await addVideoToProject(name); } catch (err) { showToast?.(String(err.message || err)); } },
}));
$("#videoFileInput")?.addEventListener("change", async (e) => {
  const files = [...e.target.files];
  e.target.value = "";             // choosing the same file again must fire "change" again
  const btn = $("#addVideoBtn");
  btn.disabled = true;
  for (const f of files) await addVideoFromDisk(f);
  btn.disabled = false;
});

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

  // Where each video came from (credits.py), shown under it with a way to edit.
  let credits = {};
  try { credits = (await (await fetch("/api/credits")).json()).credit || {}; } catch { /* no backend */ }

  const vids = videoAssets();
  if (note) note.textContent = vids.length
    ? `${vids.length} video${vids.length === 1 ? "" : "s"} in this project`
    : "no video yet";

  list.innerHTML = vids.length ? vids.map((a) => {
    const uses = assetUseCount(a.id);
    const missing = _sampleList && !_sampleList.includes(a.file);
    const active = a.id === activeAssetId;
    return `
    <div class="asset-row${active ? " active" : ""}${missing ? " missing" : ""}" data-asset-row="${a.id}">
      <span class="asset-kind" aria-hidden="true">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"
             stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="14" height="14" rx="2"/>
          <path d="M17 10 L21 7 L21 17 L17 14"/></svg>
      </span>
      <span class="asset-name" title="${escapeHTML(a.file)}">${escapeHTML(a.file)}</span>
      <span class="data asset-meta">${missing ? "not in sources/"
        : `${hasTranscript(a.file) ? "transcribed" : "not transcribed"} · ${uses} span${uses === 1 ? "" : "s"} used`}</span>
      ${active ? '<span class="asset-active">on screen</span>'
        : `<button class="btn quiet" type="button" data-asset-open="${a.id}"${missing ? " disabled" : ""}>Open</button>`}
      <button class="btn quiet" type="button" data-asset-remove="${a.id}"
              title="${uses ? "Remove from this project — its spans in the Results go with it" : "Remove from this project (the file stays in sources/)"}">Remove</button>
      <span class="data asset-credit">${credits[a.file]?.line
        ? `${escapeHTML(credits[a.file].line)} · <a href="/workspace#panelSources" target="_blank" rel="noopener">edit</a>`
        : `No source credit yet · <a href="/workspace#panelSources" target="_blank" rel="noopener">add one</a>`}</span>
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
        : `<p class="empty-message">Every video in this profile's sources is already in this project.
             Add another with Add video… to use it.</p>`;
    }
  }
  await renderMediaAssets();
}

/* ---------- images & sounds (Timeline elements) ---------- */

/* How many Timeline elements, across every Result, use this file. */
function mediaUseCount(file) {
  let n = 0;
  const all = (typeof SAVED_RESULTS !== "undefined" ? SAVED_RESULTS : []);
  for (const r of all) {
    const list = r.id === activeResultId && typeof OVERLAYS !== "undefined" ? OVERLAYS : (r.overlays || []);
    for (const e of list) if (e.file === file) n++;
  }
  return n;
}

/* A project's images and sounds live in ITS OWN folder, projects/<id>/assets/
   (ian). The profile's library (profiles/<id>/assets/: logos, banners, templates)
   is only a place to IMPORT from: importing copies the file in, so the
   project keeps working however the library file changes later. */
const projectMediaUrl = (file) =>
  profileUrl(`/api/project-asset-file?id=${encodeURIComponent(activeProjectId || "")}&name=${encodeURIComponent(file)}`);

/* Uploads and imports need the project's folder, which needs an id -- a
   project that has never been saved gets one now. */
async function ensureProjectId() {
  if (!activeProjectId && typeof writeProjectNow === "function") await writeProjectNow();
  return activeProjectId;
}

async function renderMediaAssets() {
  const list = $("#assetMediaList");
  const shared = $("#assetSharedList");
  if (!list) return;
  const note = $("#assetMediaNote");
  if (!activeProjectId) {
    list.innerHTML = `<p class="empty-message">Add a video first — images and sounds are kept in the project's own folder.</p>`;
    if (shared) shared.innerHTML = "";
    if (note) note.textContent = "";
    return;
  }
  let own = null, lib = null;
  try { own = (await (await fetch(`/api/project-assets?id=${encodeURIComponent(activeProjectId)}`)).json()).asset || []; } catch { own = null; }
  try { lib = (await (await fetch("/api/workspace/assets")).json()).asset || []; } catch { lib = null; }
  const media = ASSETS.filter((a) => a.kind === "image" || a.kind === "sound");
  const listed = new Set(media.map((a) => a.file));
  if (note) note.textContent = media.length ? `${media.length} in this project · projects/${activeProjectId}/assets/` : "";

  const icon = (kind, url) => kind === "image"
    ? `<img class="asset-thumb" alt="" loading="lazy" src="${url}">`
    : `<span class="asset-kind" aria-hidden="true"><svg width="16" height="16" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
         <path d="M4 10 L4 14 L8 14 L13 18 L13 6 L8 10 Z"/><path d="M17 9 Q19 12 17 15"/></svg></span>`;
  const rows = media.map((a) => {
    const uses = mediaUseCount(a.file);
    return `
    <div class="asset-row" data-asset-row="${a.id}">
      ${icon(a.kind, projectMediaUrl(a.file))}
      <span class="asset-name" title="${escapeHTML(a.file)}">${escapeHTML(a.file)}</span>
      <span class="data asset-meta">${a.kind} · ${uses} use${uses === 1 ? "" : "s"}</span>
      <span></span>
      <button class="btn quiet" type="button" data-asset-remove="${a.id}"
              title="${uses ? "Remove from this project — its Timeline elements go with it" : "Take it off this list"} (the file stays in the project's folder)">Remove</button>
    </div>`;
  }).concat((own || []).filter((f) => !listed.has(f.name)).map((f) => `
    <div class="asset-row">
      ${icon(f.kind, projectMediaUrl(f.name))}
      <span class="asset-name" title="${escapeHTML(f.name)}">${escapeHTML(f.name)}</span>
      <span class="data asset-meta">${f.kind} · in the project's folder, not listed</span>
      <span></span>
      <button class="btn" type="button" data-media-add="${escapeHTML(f.name)}" data-kind="${f.kind}">Add</button>
    </div>`));
  list.innerHTML = own === null
    ? `<p class="empty-message">Needs the backend. Run: python -m klipian serve</p>`
    : (rows.join("") || `<p class="empty-message">No images or sounds yet. Drop some below, or import from the shared library.</p>`);

  if (shared) {
    const media2 = (lib || []).filter((f) => f.kind === "image" || f.kind === "sound");
    shared.innerHTML = media2.length ? media2.map((f) => `
      <div class="asset-row">
        ${icon(f.kind, `/api/workspace/asset-file?name=${encodeURIComponent(f.name)}`)}
        <span class="asset-name" title="${escapeHTML(f.name)}">${escapeHTML(f.name)}</span>
        <span class="data asset-meta">${f.kind} · shared</span>
        <span></span>
        <button class="btn quiet" type="button" data-media-import="${escapeHTML(f.name)}"
                title="Copy into this project">Import</button>
      </div>`).join("")
      : `<p class="empty-message">This profile's assets folder has no images or sounds (Assets on the Workspace page opens it).</p>`;
  }
}

function addMediaAsset(file, kind) {
  if (!file || ASSETS.some((a) => a.file === file && a.kind === kind)) return null;
  const next = nextAssetNum();
  const a = { id: `a${next}`, kind, file };
  ASSETS.push(a);
  if (typeof saveProject === "function") saveProject();
  return a;
}

async function uploadMedia(files) {
  const note = $("#assetMediaNote");
  const id = await ensureProjectId();
  if (!id) { if (note) note.textContent = "add a video to the project first"; return; }
  for (const f of files) {
    if (note) note.textContent = `uploading ${f.name} …`;
    try {
      const r = await fetch(`/api/project-asset-upload?id=${encodeURIComponent(id)}&name=${encodeURIComponent(f.name)}`, {
        method: "POST", headers: { "Content-Type": "application/octet-stream" }, body: f,
      });
      const d = await r.json();
      if (!r.ok || d.error) throw new Error(d.error || `server replied ${r.status}`);
      addMediaAsset(d.name, d.kind);
    } catch (err) {
      await renderMediaAssets();
      if (note) note.textContent = `${f.name}: ${err.message}`;
      return;
    }
  }
  await renderMediaAssets();
}

async function importMedia(name) {
  const note = $("#assetMediaNote");
  const id = await ensureProjectId();
  if (!id) { if (note) note.textContent = "add a video to the project first"; return; }
  try {
    const r = await fetch("/api/project-asset-import", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, name }),
    });
    const d = await r.json();
    if (!r.ok || d.error) throw new Error(d.error || `server replied ${r.status}`);
    addMediaAsset(d.name, d.kind);
  } catch (err) {
    await renderMediaAssets();
    if (note) note.textContent = `${name}: ${err.message}`;
    return;
  }
  await renderMediaAssets();
}

$("#assetFileInput")?.addEventListener("change", (e) => {
  const files = [...(e.target.files || [])];
  e.target.value = "";
  if (files.length) uploadMedia(files);
});
$("#assetDrop")?.addEventListener("dragover", (e) => { e.preventDefault(); $("#assetDrop").classList.add("over"); });
$("#assetDrop")?.addEventListener("dragleave", () => $("#assetDrop").classList.remove("over"));
$("#assetDrop")?.addEventListener("drop", (e) => {
  e.preventDefault();
  $("#assetDrop").classList.remove("over");
  const files = [...(e.dataTransfer?.files || [])];
  if (files.length) uploadMedia(files);
});

/* Add a video from sources/ to the project -- from the Assets screen or a
   anywhere else later -- and put it on screen. The FIRST video is also
   the moment a new project starts: there's no drop zone any more to do
   that (ian), so this does what dropping a file used to. */
async function addVideoToProject(file) {
  const existing = videoAssets().find((a) => a.file === file);
  if (existing) {
    await setActiveAsset(existing.id);
    renderAssets();
    return existing;
  }
  const first = !videoAssets().length;
  const a = addAsset(file);
  if (!a) return null;
  const tr = await findTranscript(file).catch(() => null);
  if (typeof loadCues === "function") loadCues(file);
  if (!first) {
    ASSET_TRANSCRIPTS[a.id] = tr;
    await setActiveAsset(a.id);
    renderAssets();
    return a;
  }
  primaryVideo = file;
  activeAssetId = a.id;
  chosenSource = { kind: "file", name: file, url: profileUrl(`/workspace/sources/${encodeURIComponent(file)}`) };
  realTranscript = tr;
  ASSET_TRANSCRIPTS[a.id] = tr;
  if (typeof DATA !== "undefined") DATA.candidates = [];
  // A new project starts from the last-used caption/watermark style
  // (applyPresetCaption, app.js), not factory defaults.
  if (typeof applyPresetCaption === "function" && applyPresetCaption()) {
    if (typeof renderList === "function") renderList();
    if (typeof applyCaption === "function") applyCaption();
  }
  if (typeof updateTopbarFile === "function") updateTopbarFile(file, tr?.duration);
  await ensureSourceDuration();
  if (typeof prepareVideo === "function") prepareVideo();
  if (typeof drawSource === "function") drawSource();
  if (typeof renderRecommendations === "function") renderRecommendations();
  if (typeof drawTotalTimeline === "function") drawTotalTimeline();
  // Written now, not on the next autosave: this first save is what gives
  // the project its id, its URL and its folder for images and sounds.
  if (typeof writeProjectNow === "function") await writeProjectNow();
  renderAssets();
  return a;
}

/* Analyze's source list: the project's videos, one of which is on screen.
   Picking one here is all "choose a video" means now. */
async function renderAnalyzeSources() {
  const list = $("#analyzeAssetList");
  if (!list) return;
  const vids = videoAssets();
  if (!vids.length) {
    list.innerHTML = `<p class="empty-message">This project has no video yet. Add one on the
      <button class="btn quiet" type="button" data-goto="assets">Assets</button> screen.</p>`;
    return;
  }
  let cached = _transcriptList;
  if (!cached) {
    try { cached = _transcriptList = (await (await fetch("/api/cache")).json()).transcript || []; } catch { cached = []; }
  }
  const transcribed = (file) => {
    const stem = file.replace(/\.[^.]+$/, "");
    return cached.some((f) => decodeURIComponent(f).startsWith(stem + "."));
  };
  list.innerHTML = vids.map((a) => {
    const on = a.id === activeAssetId;
    return `
    <button type="button" class="asset-row asset-pick${on ? " active" : ""}" data-asset-pick="${a.id}"
            aria-pressed="${on}">
      <span class="asset-kind" aria-hidden="true">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"
             stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="14" height="14" rx="2"/>
          <path d="M17 10 L21 7 L21 17 L17 14"/></svg>
      </span>
      <span class="asset-name" title="${escapeHTML(a.file)}">${escapeHTML(a.file)}</span>
      <span class="data asset-meta">${transcribed(a.file) ? "transcribed" : "not transcribed"}</span>
      ${on ? '<span class="asset-active">selected</span>' : "<span></span>"}
      <span></span>
    </button>`;
  }).join("");
}

$("#analyzeAssetList")?.addEventListener("click", async (e) => {
  const go = e.target.closest("[data-goto]");
  if (go) { toScreen(go.dataset.goto); return; }
  const pick = e.target.closest("[data-asset-pick]");
  if (pick) await setActiveAsset(pick.dataset.assetPick);
});

function addAsset(file) {
  if (!file || videoAssets().some((a) => a.file === file)) return null;
  const next = nextAssetNum();
  const a = { id: `a${next}`, kind: "video", file };
  ASSETS.push(a);
  if (typeof saveProject === "function") saveProject();
  return a;
}

/* Remove an asset from the project. Always allowed -- a project can be
   left with no assets at all (ian) -- but what used it goes with it: a
   video's spans in every Result, an image's or sound's Timeline elements.
   That's why the button asks first (see the click handler). The file
   itself is never deleted: a video stays in sources/, an image or sound
   stays in the project's folder and can be added back. */
function removeAsset(id) {
  const a = assetById(id);
  if (!a) return false;
  // Measure and edit what's on screen NOW, not the last snapshot.
  if (typeof snapshotActiveResult === "function") snapshotActiveResult();
  const all = (typeof SAVED_RESULTS !== "undefined" ? SAVED_RESULTS : []);

  if (a.kind !== "video") {
    for (const r of all) {
      if (!Array.isArray(r.overlays)) continue;
      r.overlays = r.overlays.filter((e) => e.file !== a.file);
      if (!r.overlays.length) delete r.overlays;
    }
    ASSETS = ASSETS.filter((x) => x.id !== id);
    if (typeof OVERLAYS !== "undefined" && OVERLAYS.some((e) => e.file === a.file)) {
      OVERLAYS = OVERLAYS.filter((e) => e.file !== a.file);
      if (typeof commitOverlays === "function") commitOverlays();
    }
    if (typeof saveProject === "function") saveProject();
    return true;
  }

  for (const r of all) {
    const key = Array.isArray(r.segments) ? "segments" : "result";
    if (Array.isArray(r[key])) r[key] = r[key].filter((s) => (s.asset || "a1") !== id);
  }
  ASSETS = ASSETS.filter((x) => x.id !== id);
  delete ASSET_TRANSCRIPTS[id];
  delete ASSET_CANDIDATES[id];
  _shiftedWords.delete(id);
  if (typeof RESULT !== "undefined" && RESULT.some((r) => assetIdAt(r.start) === id)) {
    RESULT = RESULT.filter((r) => assetIdAt(r.start) !== id);
    if (typeof renderResult === "function") renderResult();
  }
  // The project's first video may have been this one.
  primaryVideo = videoAssets()[0]?.file || null;
  if (activeAssetId === id) {
    const next = videoAssets()[0];
    if (next) setActiveAsset(next.id);
    else clearActiveVideo();
  }
  if (typeof saveProject === "function") saveProject();
  return true;
}

/* The project's last video just went: nothing is on screen any more. */
function clearActiveVideo() {
  if (chosenSource?.url?.startsWith("blob:")) URL.revokeObjectURL(chosenSource.url);
  chosenSource = null;
  realTranscript = null;
  activeAssetId = "a1";
  if (typeof DATA !== "undefined") DATA.candidates = [];
  if (typeof releaseVideo === "function") releaseVideo();
  if (typeof updateTopbarFile === "function") updateTopbarFile("", NaN);
  if (typeof clearSelection === "function") clearSelection();
  if (typeof drawSource === "function") drawSource();
  if (typeof renderRecommendations === "function") renderRecommendations();
  if (typeof drawTotalTimeline === "function") drawTotalTimeline();
}

/* What removing this asset would take with it, for the confirm label. */
function removalCost(a) {
  if (a.kind === "video") {
    if (typeof snapshotActiveResult === "function") snapshotActiveResult();
    const n = assetUseCount(a.id);
    return n ? ` (${n} span${n === 1 ? "" : "s"} too)` : "";
  }
  const n = mediaUseCount(a.file);
  return n ? ` (${n} element${n === 1 ? "" : "s"} too)` : "";
}

/* Asked first, in a dialog that says what goes with the asset (the spans or elements that use it). */
async function confirmRemoveAsset(a) {
  const m = removalCost(a).match(/\((\d+) (span|element)s? too\)/);
  const n = m ? Number(m[1]) : 0;
  const name = a.file || (a.kind === "video" ? "this video" : "this item");
  return confirmDialog({
    title: `Remove ${name} from this project?`, confirmText: "Remove",
    message: n ? `${n} ${m[2]}${n === 1 ? "" : "s"} that use${n === 1 ? "s" : ""} it ${n === 1 ? "goes" : "go"} with it.`
               : "Nothing in the project uses it. The file itself stays in the sources / assets folder.",
  });
}

$("#panel-assets")?.addEventListener("click", async (e) => {
  const rm = e.target.closest("[data-asset-remove]");
  const add = e.target.closest("[data-asset-add]");
  if (add) {
    add.disabled = true;
    await addVideoToProject(add.dataset.assetAdd);
    return;
  }
  const open = e.target.closest("[data-asset-open]");
  if (open) {
    await setActiveAsset(open.dataset.assetOpen);
    toScreen("clips");
    return;
  }
  if (rm) {
    const a = assetById(rm.dataset.assetRemove);
    if (!a) return;
    if (!(await confirmRemoveAsset(a))) return;
    removeAsset(rm.dataset.assetRemove);
    renderAssets();
    return;
  }
  const media = e.target.closest("[data-media-add]");
  if (media) { addMediaAsset(media.dataset.mediaAdd, media.dataset.kind); renderMediaAssets(); return; }
  const imp = e.target.closest("[data-media-import]");
  if (imp) { imp.disabled = true; importMedia(imp.dataset.mediaImport); }
});

document.querySelectorAll(".asset-select").forEach((sel) =>
  sel.addEventListener("change", () => setActiveAsset(sel.value)));
