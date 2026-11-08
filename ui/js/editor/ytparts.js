/* klipian — "From YouTube, parts only"
   ==========================================================================
   A project can start from a YouTube LINK instead of a file (project.youtube, no asset yet). Ask Gemini and the
   import work without any video; once the clips are known, only those parts (each padded 20 s) are downloaded,
   one file per part, each added to the project as an asset. The pure bits (ranges, mapping a clip from YouTube
   seconds onto the part that holds it) are at the top and tested by tests/ytparts.test.js; the screen follows.

   What a part is: { asset, file, a, b } -- `a`,`b` are the YouTube seconds the file really holds (the server
   reports the real start: ffmpeg cuts at the keyframe, the file's second 0 is `a`). A clip [s, e] in YouTube
   seconds lives in the part that holds both ends and becomes [s - a, e - a] in that file's own seconds; the
   editor's virtual offset (assets.js, 1e6 per asset) is added later, as for any other asset.
   ========================================================================== */

// the range helpers of gemini.js: globals in the page, a require in node
const ytGem = (typeof module !== "undefined" && module.exports) ? require("./gemini.js") : { clipRanges, rangesSeconds, momentSpans };

/* What to download for these candidates (YouTube seconds): each span padded, clamped to 0..duration, merged. */
function partRanges(candidates, duration) {
  const spans = ytGem.momentSpans(candidates, candidates.map((_, i) => i));
  return ytGem.clipRanges(spans, duration);
}

/* Each candidate put onto the part that holds it. `parts` = [{ asset, a, b }] in YouTube seconds. A candidate
   no part holds whole is returned in `unmapped` (reported, never dropped silently). */
function mapToParts(candidates, parts) {
  const mapped = [], unmapped = [];
  const eps = 0.05;                          // a frame of slack: the real start is measured, not exact
  for (const k of candidates) {
    const p = parts.find((x) => k.startSec >= x.a - eps && k.endSec <= x.b + eps);
    if (!p) { unmapped.push(k); continue; }
    const round = (n) => Math.round(n * 1000) / 1000;
    mapped.push({ ...k, asset: p.asset, startSec: Math.max(0, round(k.startSec - p.a)), endSec: round(k.endSec - p.a) });
  }
  return { mapped, unmapped };
}

/* Candidates in YouTube seconds that no downloaded part holds yet (what "Download the remaining" still needs). */
const remainingRanges = (ranges, parts) => ranges.filter(([a, b]) => !parts.some((p) => p.a <= a + 1 && p.b >= b - 1));

/* The clip files' name part: 12m30s-14m10s (the server names the files; this is only for the screen). */
const stampShort = (s) => { const n = Math.max(0, Math.round(s)); return n >= 3600 ? `${Math.floor(n / 3600)}:${String(Math.floor(n % 3600 / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}` : `${Math.floor(n / 60)}:${String(n % 60).padStart(2, "0")}`; };

const minutesOf = (seconds) => Math.max(1, Math.round(seconds / 60));

if (typeof module !== "undefined" && module.exports) module.exports = { partRanges, mapToParts, remainingRanges, stampShort, minutesOf };

/* ======================================================================= the screen (browser only) */
if (typeof document !== "undefined") (function () {
  const $q = (s) => document.querySelector(s);
  const panel = $q("#ytPanel");
  if (!panel) return;

  /* null, or { videoId, url, title, channel, duration, stem, quality, answer, reply, candidates, parts, importId } */
  window.YT = null;
  let busy = false;
  let cancel = false;

  const say = (el, text, error = false) => { if (el) { el.textContent = text || ""; el.dataset.error = error ? "true" : "false"; } };

  window.ytReset = () => { window.YT = null; draw(); };
  window.ytLoad = (y) => {
    window.YT = y && y.videoId ? { quality: 1080, candidates: [], parts: [], ...y } : null;
    draw();
    if (typeof renderAssets === "function") renderAssets();
  };
  /* What the project file keeps (projectState, projects.js). */
  window.ytSaveState = () => (window.YT ? { ...window.YT } : undefined);
  const save = () => { if (typeof saveProject === "function") saveProject(); };

  /* ---------- starting a project from a link ---------- */
  window.startYouTubePartsProject = () => {
    openYouTubeDialog({
      choose: true,
      onChosen: async (pv) => {
        if (window.YT || videoAssets().length) startNewProject();      // else this empty project is used
        const stem = (pv.fileName || "").replace(/\.mp4$/i, "") || pv.title || "YouTube video";
        window.YT = { videoId: pv.id, url: pv.url, title: pv.title || "", channel: pv.channel || "", duration: pv.duration || 0,
          stem, quality: 1080, answer: "", reply: "", candidates: [], parts: [] };
        draw();
        if (typeof writeProjectNow === "function") await writeProjectNow();
        if (typeof renderAssets === "function") renderAssets();
        draw();
      },
    });
  };
  $q("#addYouTubePartsBtn")?.addEventListener("click", () => {
    // a project that has nothing yet is used as it is; one that has a video or a link stays saved and a new one starts
    if ((window.YT || videoAssets().length) && !confirm("This starts a new project from the YouTube link. The current project stays saved.")) return;
    window.startYouTubePartsProject();
  });

  /* ---------- drawing ---------- */
  function draw() {
    const y = window.YT;
    panel.hidden = !y;
    if (!y) return;
    const got = y.parts.length;
    $q("#ytTitle").textContent = `YouTube: ${y.title || y.videoId}`;
    $q("#ytMeta").textContent = [y.channel, y.duration ? stampShort(y.duration) : "",
      got ? `${got} part${got === 1 ? "" : "s"} downloaded` : "not downloaded"].filter(Boolean).join(" · ");
    $q("#ytOpen").href = y.url;
    const ans = $q("#ytAnswer"), rep = $q("#ytReply");
    if (document.activeElement !== ans) ans.value = y.answer || "";
    if (document.activeElement !== rep) rep.value = y.reply || "";
    $q("#ytCopyBrief").disabled = !ans.value.trim();
    $q("#ytImport").disabled = !rep.value.trim() || busy || got > 0;
    $q("#ytImport").title = got > 0 ? "Parts are already downloaded: start a new project to import another reply" : "";
    $q("#ytQuality").value = String(y.quality || 1080);
    drawClips();
  }

  function remaining() {
    const y = window.YT;
    return remainingRanges(partRanges(y.candidates, y.duration), y.parts);
  }

  function drawClips() {
    const y = window.YT;
    const list = $q("#ytClips"), go = $q("#ytDownload"), info = $q("#ytCost");
    const n = y.candidates.length;
    list.innerHTML = n ? y.candidates.map((k) => `<li><b>${escapeHTML(k.title || "Clip")}</b>
      <span class="data">${stampShort(k.startSec)}–${stampShort(k.endSec)}${mapToParts([k], y.parts).mapped.length ? " · downloaded" : ""}</span></li>`).join("") : "";
    const rest = remaining();
    const unmapped = rest.length ? 0 : mapToParts(y.candidates, y.parts).unmapped.length;
    go.hidden = !n || (!rest.length && !unmapped);
    go.disabled = busy || !rest.length;
    if (!n) { info.textContent = ""; return; }
    if (!rest.length) {
      info.textContent = unmapped ? `${unmapped} clip${unmapped === 1 ? "" : "s"} fell outside the downloaded parts and could not be placed.` : "";
      return;
    }
    const secs = ytGem.rangesSeconds(rest);
    const partial = y.parts.length > 0;
    go.textContent = partial ? `Download the remaining ${rest.length} clip${rest.length === 1 ? "" : "s"}`
      : `Download these ${n} clip${n === 1 ? "" : "s"}`;
    info.textContent = `${rest.length} file${rest.length === 1 ? "" : "s"}, about ${minutesOf(secs)} min of video instead of ${y.duration ? stampShort(y.duration) : "the whole video"}`;
  }

  /* ---------- Ask Gemini, without a file ---------- */
  $q("#ytCopyPrompt").addEventListener("click", async (e) => {
    const ok = await copyText(GEMINI_PROMPT);
    say($q("#ytNote"), ok ? "Copied · paste it into 'Ask about this video' on YouTube" : "Could not copy: the browser refused.", !ok);
    if (ok) flashLabel(e.currentTarget, "Copied");
  });
  $q("#ytAnswer").addEventListener("input", (e) => {
    if (!window.YT) return;
    window.YT.answer = e.target.value;
    $q("#ytCopyBrief").disabled = !e.target.value.trim();
    save();
  });
  $q("#ytReply").addEventListener("input", (e) => {
    if (!window.YT) return;
    window.YT.reply = e.target.value;
    $q("#ytImport").disabled = !e.target.value.trim() || busy;
    save();
  });
  $q("#ytCopyBrief").addEventListener("click", async (e) => {
    const note = $q("#ytNote");
    try {
      const text = await buildGeminiBrief(window.YT.stem, $q("#ytAnswer").value);
      if (!(await copyText(text))) throw new Error("the browser refused to copy");
      say($q("#ytNote"), `Copied · ${(text.length / 1024).toFixed(0)} KB · paste it into Claude or another AI`);
      flashLabel(e.currentTarget, "Copied");
    } catch (err) { say(note, err.message, true); }
  });
  $q("#ytQuality").addEventListener("change", (e) => { if (window.YT) { window.YT.quality = Number(e.target.value); save(); } });

  /* ---------- import the AI's reply (YouTube seconds, no transcript to snap to yet) ---------- */
  $q("#ytImport").addEventListener("click", async () => {
    const y = window.YT, note = $q("#ytNote");
    try {
      const res = await fetch("/api/import", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ video: y.stem, text: y.reply }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Could not read that reply.");
      const importId = Date.now().toString(36);
      y.importId = importId;
      y.candidates = d.candidates.map((k) => ({ ...k, importId }));
      say(note, `${y.candidates.length} clip${y.candidates.length === 1 ? "" : "s"} read. Cut points snap to words once the parts are transcribed.`);
      save();
      drawClips();
    } catch (err) { say(note, err.message, true); }
  });

  /* ---------- download the parts, one range after the other ---------- */
  function follow(id, onTick) {
    return new Promise((resolve) => {
      const timer = setInterval(async () => {
        const s = await _ytApi(`/api/ytdl/state?id=${encodeURIComponent(id)}`);
        if (s.state === "queued" || s.state === "running") { onTick(s); return; }
        clearInterval(timer);
        resolve(s);
      }, 700);
    });
  }

  async function downloadParts() {
    const y = window.YT, note = $q("#ytNote"), bar = $q("#ytBar");
    const todo = remaining();
    if (!todo.length || busy) return;
    busy = true; cancel = false;
    $q("#ytCancel").hidden = false;
    $q("#ytDownload").disabled = true;
    bar.hidden = false;
    let done = 0;
    try {
      for (const [a, b] of todo) {
        if (cancel) break;
        const label = `${done + 1} of ${todo.length}`;
        say(note, `Starting ${label}…`);
        const r = await _ytApi("/api/ytdl/start", { url: y.url, quality: y.quality || 1080, section: [a, b] });
        if (!r.ok) throw new Error(r.error || "The download failed.");
        let s;
        if (r.id) {
          window._ytPartJob = r.id;
          s = await follow(r.id, (t) => {
            bar.firstElementChild.style.width = `${t.percent || 0}%`;
            say(note, t.percent ? `${label} · ${t.percent}%${t.eta != null ? ` · ~${t.eta} s left` : ""}` : `${label} · downloading the part (no percentage for a part)…`);
          });
        } else s = { state: "done", name: r.name, section: [a, b] };
        if (s.state === "cancelled") break;
        if (s.state !== "done") throw new Error(s.message || "The download failed.");
        await addPart(s.name, s.section || [a, b]);
        done++;
      }
      say(note, cancel ? `Cancelled after ${done} of ${todo.length}. Press the button to get the rest.`
        : `${done} part${done === 1 ? "" : "s"} downloaded. Transcribing them next…`);
      if (!cancel) await transcribeParts();
    } catch (err) {
      say(note, `${err.message} ${done ? `${done} of ${todo.length} parts are kept; press the button again for the rest.` : ""}`.trim(), true);
    } finally {
      busy = false;
      bar.hidden = true;
      $q("#ytCancel").hidden = true;
      draw();
    }
  }
  $q("#ytDownload").addEventListener("click", downloadParts);
  $q("#ytCancel").addEventListener("click", async () => {
    cancel = true;
    if (window._ytPartJob) await _ytApi("/api/ytdl/cancel", { id: window._ytPartJob });
  });

  /* One part is in sources/: add it as an asset and put its clips on it. */
  async function addPart(file, section) {
    const y = window.YT;
    const asset = await addVideoToProject(file);
    if (!asset) throw new Error(`${file} could not be added to the project.`);
    const part = { asset: asset.id, file, a: section[0], b: section[1] };
    y.parts.push(part);
    // this part's clips, in the file's own seconds, on the asset that is on screen now (a new one: no clips yet)
    DATA.candidates = mapToParts(y.candidates, [part]).mapped;
    if (typeof renderList === "function") renderList();
    if (typeof renderRecommendations === "function") renderRecommendations();
    save();
    if (typeof renderAssets === "function") renderAssets();
    draw();
  }

  /* Every part is transcribed whole (they are short), one after the other, then its clips snap to words. */
  async function transcribeParts() {
    const y = window.YT, note = $q("#ytNote"), bar = $q("#ytBar");
    const todo = y.parts.filter((p) => !p.transcribed);
    bar.hidden = false;
    let n = 0;
    for (const p of todo) {
      n++;
      const label = `Transcribing ${n} of ${todo.length}`;
      say(note, `${label}…`);
      const r = await fetch("/api/transcribe", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ video: p.file }) }).then((x) => x.json());
      if (r.error) throw new Error(r.error);
      const t = await new Promise((resolve) => pollJob(`/api/transcribe/${r.id}`, {
        interval: 900,
        onTick: (j) => { bar.firstElementChild.style.width = `${j.percent || 0}%`; say(note, `${label} · ${j.percent || 0}%`); },
        onDone: resolve, onFail: () => resolve({ state: "failed", error: "Disconnected from the server." }),
      }));
      if (t.state !== "done") throw new Error(`Transcribing ${p.file} failed: ${t.error || t.state}`);
      const tr = await findTranscript(p.file);
      ASSET_TRANSCRIPTS[p.asset] = tr;
      if (p.asset === activeAssetId) realTranscript = tr;
      snapPart(p, tr);
      p.transcribed = true;
      save();
    }
    say(note, "Done. Open Analyze → Choose moments / Clips: use “Select all from this brief”, then Render selected.");
  }

  /* Move a part's clips to the nearest word boundary (the same limit as snapToWord, roundtrip.js). */
  function snapPart(p, tr) {
    const words = tr?.segments ? tr.segments.flatMap((s) => s.words || []) : (tr?.words || []);
    if (!words.length) return;
    const near = (time, side) => {
      const c = words.map((w) => (side === "start" ? w.start : w.end));
      const best = c.reduce((a, b) => (Math.abs(b - time) < Math.abs(a - time) ? b : a));
      return Math.abs(best - time) <= SNAP_MAX ? best : time;
    };
    const fix = (k) => (k.asset === p.asset ? { ...k, startSec: near(k.startSec, "start"), endSec: near(k.endSec, "end") } : k);
    if (activeAssetId === p.asset) DATA.candidates = (DATA.candidates || []).map(fix);
    else if (ASSET_CANDIDATES[p.asset]) ASSET_CANDIDATES[p.asset] = ASSET_CANDIDATES[p.asset].map(fix);
    if (typeof renderList === "function") renderList();
    if (typeof renderRecommendations === "function") renderRecommendations();
  }

  draw();
})();
