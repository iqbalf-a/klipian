/* klipian — "Add from YouTube" dialog (shared by the editor and /workspace)
   ==========================================================================
   openYouTubeDialog({ onAdded(name) })
     A link, a preview (title, channel, length, size), then Download: a background job on the
     server (klipian/ytdl.py) saves "<channel> - <title>.mp4" into this profile's sources and
     fills in its credit. The dialog may be closed while it runs; opening it again shows the
     job, and when it ends `onAdded(name)` of the last opener is called (and a notice shown).
   Uses showToast from armed.js. Builds its own DOM; its CSS is ytdl.css.
   ========================================================================== */

let _ytDlg = null;               // the <dialog>, built on first use
let _ytJob = null;               // { id, kind, timer } while a download or an update is being followed
let _ytOnAdded = null;           // what to call with the file name when the download is done
let _ytPreview = null;           // the preview currently shown
let _ytQuality = 1080;           // 1080 (default) or 720 (a smaller file)
let _ytStatusInfo = null;        // the last /api/ytdl/status (version, JS runtime)

async function _ytApi(path, body) {
  const res = await fetch(path, body === undefined ? {} : {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  let d = {};
  try { d = await res.json(); } catch { /* not JSON */ }
  if (!res.ok && !d.error) d.error = `Request failed (${res.status}).`;
  return d;
}

function _ytEl(tag, props = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === "class") el.className = v; else if (k === "text") el.textContent = v; else el[k] = v;
  }
  for (const kid of kids) if (kid) el.append(kid);
  return el;
}

function _ytBytes(n) {
  if (!n) return "";
  return n >= 1024 ** 3 ? `${(n / 1024 ** 3).toFixed(1)} GB` : `${Math.max(1, Math.round(n / 1048576))} MB`;
}
function _ytLen(sec) {
  if (sec == null) return "";
  const s = Math.round(sec), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  const p = (x) => String(x).padStart(2, "0");
  return h ? `${h}:${p(m)}:${p(r)}` : `${m}:${p(r)}`;
}

function _ytq(s) { return _ytDlg.querySelector(s); }

function _ytBuild() {
  const dlg = _ytEl("dialog", { class: "ytdl-dlg" });
  dlg.setAttribute("aria-labelledby", "ytdlTitle");
  dlg.innerHTML = `
    <div class="ytdl-col">
      <div class="ytdl-head">
        <h2 id="ytdlTitle">Add from YouTube</h2>
        <button class="ytdl-x" type="button" data-x title="Close (a download that is running goes on)">✕</button>
      </div>
      <form class="ytdl-row" data-form>
        <input type="text" data-url placeholder="https://www.youtube.com/watch?v=…" aria-label="YouTube video link" autocomplete="off" spellcheck="false">
        <button class="ytdl-btn" type="submit" data-check>Check</button>
      </form>
      <div data-card></div>
      <div class="ytdl-bar" data-bar hidden><i></i></div>
      <p class="ytdl-msg" data-msg role="status"></p>
      <p class="ytdl-detail" data-detail hidden><span data-detail-text></span> <button class="ytdl-btn" type="button" data-copy>Copy details</button></p>
      <div data-install hidden>
        <p class="ytdl-small">yt-dlp, the part that downloads, is not installed yet. Run this once, or press Install yt-dlp:</p>
        <code data-cmd></code>
      </div>
      <p class="ytdl-small">Download only content you may use; a credit is not permission. Private, age-restricted and members-only videos cannot be downloaded (klipian does not sign in).</p>
      <div class="ytdl-foot">
        <span data-ver></span>
        <button class="ytdl-btn" type="button" data-update>Update yt-dlp</button>
      </div>
      <div class="ytdl-end">
        <button class="ytdl-btn" type="button" data-stop hidden>Cancel download</button>
        <button class="ytdl-btn" type="button" data-close>Close</button>
        <button class="ytdl-btn primary" type="button" data-go hidden>Download</button>
      </div>
    </div>`;
  document.body.append(dlg);
  const q = (s) => dlg.querySelector(s);
  q("[data-x]").addEventListener("click", () => dlg.close());
  q("[data-close]").addEventListener("click", () => dlg.close());
  q("[data-form]").addEventListener("submit", (e) => { e.preventDefault(); _ytCheck(); });
  q("[data-go]").addEventListener("click", _ytGo);
  q("[data-stop]").addEventListener("click", _ytStop);
  q("[data-update]").addEventListener("click", _ytUpdate);
  q("[data-copy]").addEventListener("click", _ytCopyDetails);
  return dlg;
}

let _ytReport = "";              // what "Copy details" copies

function _ytSay(text, error = false) {
  const m = _ytq("[data-msg]");
  m.textContent = text || "";
  m.dataset.error = error ? "true" : "false";
  _ytq("[data-detail]").hidden = true;       // a new message drops the details of the old one
}

/* The real error under the friendly message, small and muted, with a way to hand it on. */
function _ytDetail(d) {
  if (!d?.detail) return;
  const s = _ytStatusInfo || {};
  _ytReport = [`yt-dlp ${s.version || "?"} · JS runtime: ${s.jsRuntime || "none"}${s.ejs ? " + ejs" : ""}`,
    `code: ${d.code || "?"}`, d.report || d.detail].join("\n");
  _ytq("[data-detail-text]").textContent = d.detail;
  _ytq("[data-detail]").hidden = false;
}

async function _ytCopyDetails() {
  const b = _ytq("[data-copy]");
  const ok = typeof copyText === "function" ? await copyText(_ytReport) : false;
  b.textContent = ok ? "Copied" : "Could not copy";
  setTimeout(() => { b.textContent = "Copy details"; }, 1800);
}

/* What is visible: the preview card, the buttons, the bar. `busy` locks the inputs. */
function _ytShow({ card = true, go = false, stop = false, bar = false, busy = false } = {}) {
  if (!card) _ytq("[data-card]").replaceChildren();
  _ytq("[data-go]").hidden = !go;
  _ytq("[data-stop]").hidden = !stop;
  _ytq("[data-bar]").hidden = !bar;
  _ytq("[data-check]").disabled = busy;
  _ytq("[data-url]").disabled = busy;
  _ytq("[data-update]").disabled = busy;
}

/* An error reply from the server: what it said, and what to do about it. */
function _ytProblem(d) {
  _ytSay(d.error || "Something went wrong.", true);
  _ytDetail(d);
  const missing = d.code === "missing";
  if (missing) _ytq("[data-install]").hidden = false;     // (otherwise what the status said stays)
  if (missing && d.command) _ytq("[data-cmd]").textContent = d.command;
  _ytq("[data-update]").classList.toggle("hot", d.code === "outdated" || d.code === "js_runtime" || missing);
  _ytq("[data-update]").textContent = missing ? "Install yt-dlp" : "Update yt-dlp";
}

async function _ytStatus() {
  const s = await _ytApi("/api/ytdl/status");
  _ytStatusInfo = s;
  const js = s.jsRuntime ? ` · JS: ${s.jsRuntime}${s.ejs ? "" : " (solver missing)"}` : " · no JS runtime";
  _ytq("[data-ver]").textContent = s.installed ? `yt-dlp ${s.version}${js}` : "yt-dlp is not installed";
  _ytq("[data-install]").hidden = !!s.installed;
  _ytq("[data-cmd]").textContent = s.command || "";
  _ytq("[data-update]").textContent = s.installed ? "Update yt-dlp" : "Install yt-dlp";
  _ytq("[data-update]").classList.toggle("hot", !s.installed);
  if (s.installed && s.ffmpeg === false) _ytSay("ffmpeg was not found: klipian needs it to join the video and sound.", true);
  else if (s.installed && (!s.jsRuntime || !s.ejs) && !_ytJob) {
    _ytSay(!s.jsRuntime ? "No JavaScript runtime found: install Node.js (or deno) so YouTube downloads work reliably."
                        : "yt-dlp's YouTube solver is missing: press Update yt-dlp.", true);
  }
  return s;
}

async function _ytCheck() {
  const url = _ytq("[data-url]").value.trim();
  if (!url) { _ytSay("Paste a YouTube video link.", true); return; }
  _ytPreview = null;
  _ytShow({ card: false, busy: true });
  _ytSay("Looking at the video…");
  const d = await _ytApi("/api/ytdl/preview", { url, quality: _ytQuality });
  _ytShow({ card: false, busy: false });
  if (!d.ok) { _ytProblem(d); return; }
  _ytq("[data-install]").hidden = true;
  _ytPreview = d;
  const meta = [d.channel, _ytLen(d.duration), d.height ? `${d.height}p` : "", d.size ? `about ${_ytBytes(d.size)}` : ""]
    .filter(Boolean).join(" · ");
  const card = _ytEl("div", { class: "ytdl-card" },
    d.thumbnail ? _ytEl("img", { src: d.thumbnail, alt: "", referrerPolicy: "no-referrer" }) : null,
    _ytEl("div", {}, _ytEl("b", { text: d.title || "(no title)" }),
      _ytEl("div", { class: "ytdl-meta", text: meta }),
      _ytEl("div", { class: "ytdl-meta", text: `Saved as ${d.fileName}` }),
      _ytQualityPick(d)));
  _ytq("[data-card]").replaceChildren(card);
  const go = _ytq("[data-go]");
  if (d.inProfile) {
    _ytSay(`Already in this profile's sources as ${d.inProfile} — nothing to download.`);
    go.textContent = "Use it";
  } else if (d.inOtherProfile) {
    _ytSay(`The profile "${d.inOtherProfile}" already has this video: it is linked here instead of downloaded again.`);
    go.textContent = "Add it";
  } else {
    _ytSay("");
    go.textContent = "Download";
  }
  _ytShow({ go: true });
}

/* 1080p is the default. A long video is a big file (83 minutes is about 1.8 GB), so 720p is offered: the vertical
   crop of a 16:9 source uses only part of the frame anyway. Choosing one looks at the link again for the new size. */
function _ytQualityPick(d) {
  if (d.inProfile || d.inOtherProfile) return null;
  const sel = _ytEl("select", { class: "ytdl-q", ariaLabel: "Video quality" });
  for (const [v, t] of [[1080, "1080p (best)"], [720, "720p (smaller)"]]) {
    sel.append(Object.assign(document.createElement("option"), { value: v, textContent: t, selected: v === (d.quality || 1080) }));
  }
  sel.addEventListener("change", () => { _ytQuality = Number(sel.value); _ytCheck(); });
  return _ytEl("div", { class: "ytdl-meta" }, document.createTextNode("Quality "), sel);
}

function _ytFollow(id, kind) {
  clearInterval(_ytJob?.timer);
  const tick = async () => {
    const s = await _ytApi(`/api/ytdl/state?id=${encodeURIComponent(id)}`);
    if (_ytJob?.id !== id) return;
    const open = _ytDlg.open;
    if (s.state === "queued" || s.state === "running") {
      const bits = [s.message || ""];
      if (kind === "download") {
        if (s.percent != null) bits.push(`${s.percent}%`);
        if (s.speed) bits.push(`${_ytBytes(s.speed)}/s`);
        if (s.eta != null) bits.push(s.eta >= 60 ? `~${Math.round(s.eta / 60)} min left` : `~${s.eta} s left`);
        _ytq("[data-bar] i").style.width = `${s.percent || 0}%`;
      }
      _ytSay(bits.filter(Boolean).join(" · "));
      return;
    }
    clearInterval(_ytJob.timer);
    _ytJob = null;
    if (kind === "update") {
      _ytShow({ card: !!_ytPreview, go: !!_ytPreview, busy: false });
      if (s.state === "done") { _ytSay(s.message); await _ytStatus(); }
      else _ytProblem({ error: s.message, code: s.code });
      return;
    }
    if (s.state === "done") {
      _ytShow({ card: !!_ytPreview, bar: true, busy: false });
      _ytq("[data-bar] i").style.width = "100%";
      _ytSay(`Added as ${s.name}.` + (s.creditWritten ? " The source credit is filled in." : ""));
      if (!open) showToast?.(`Downloaded ${s.name}`);
      _ytOnAdded?.(s.name);
    } else if (s.state === "cancelled") {
      _ytShow({ card: !!_ytPreview, go: !!_ytPreview, busy: false });
      _ytSay("Cancelled. Nothing was kept.");
    } else {
      _ytShow({ card: !!_ytPreview, go: !!_ytPreview, busy: false });
      if (!open) showToast?.(s.message || "The YouTube download failed");
      _ytProblem({ error: s.message, code: s.code, command: s.command, detail: s.detail, report: s.report });
    }
  };
  _ytJob = { id, kind, timer: setInterval(tick, 700) };
  tick();
}

async function _ytGo() {
  if (!_ytPreview) return;
  _ytShow({ go: false, busy: true });
  _ytSay("Starting…");
  const d = await _ytApi("/api/ytdl/start", { url: _ytPreview.url, quality: _ytPreview.quality || _ytQuality });
  if (!d.ok) { _ytShow({ go: true, busy: false }); _ytProblem(d); return; }
  if (!d.id) {                                 // already here, or linked from another profile
    _ytShow({ go: false, busy: false });
    _ytSay(d.copiedFrom ? `Added as ${d.name}, linked from the profile "${d.copiedFrom}" (credit copied).`
                        : `Using ${d.name}, already in this profile's sources.`);
    _ytOnAdded?.(d.name);
    return;
  }
  _ytShow({ stop: true, bar: true, busy: true });
  _ytq("[data-bar] i").style.width = "0%";
  _ytFollow(d.id, "download");
}

async function _ytStop() {
  if (!_ytJob) return;
  _ytq("[data-stop]").disabled = true;
  await _ytApi("/api/ytdl/cancel", { id: _ytJob.id });
  _ytq("[data-stop]").disabled = false;
}

async function _ytUpdate() {
  _ytShow({ go: false, busy: true, card: !!_ytPreview });
  _ytSay("Updating yt-dlp (this can take a minute)…");
  const d = await _ytApi("/api/ytdl/update", {});
  if (!d.ok) { _ytShow({ go: !!_ytPreview, busy: false, card: !!_ytPreview }); _ytProblem(d); return; }
  _ytFollow(d.id, "update");
}

async function openYouTubeDialog({ onAdded } = {}) {
  if (!_ytDlg) _ytDlg = _ytBuild();
  _ytOnAdded = onAdded || null;
  if (!_ytJob) {
    _ytPreview = null;
    _ytq("[data-url]").value = "";
    _ytShow({ card: false, busy: false });
    _ytSay("");
  }
  if (!_ytDlg.open) _ytDlg.showModal();
  if (!_ytJob) _ytq("[data-url]").focus();
  await _ytStatus();
}
