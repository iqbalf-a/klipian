/* klipian — Timeline: segment order, and what goes on top of the clip
   ==========================================================================
   Stages 2 and 3 of the library-projects plan. Clips decides WHICH moments
   are in a Result; this screen decides the ORDER they play in and lays
   elements over the finished clip:

     text   -- a label ("1. Andre kepleset"), shown for as long as its bar
     image  -- a sticker or meme from the project's images
     sound  -- a sting or meme sound from the project's sounds, mixed over
     + per-clip volume, because episodes are recorded at different levels

   Elements are timed in OUTPUT seconds -- against the joined clip, not any
   one source -- and stored per Result (`overlays` in the project file).
   The server lays them on in a second ffmpeg pass (klipian/compose.py)
   that only runs when a clip has any, so a Result without them renders
   exactly as before.

   Everything the preview shows here is drawn from the same numbers the
   server gets: label position and size are in the 1080x1920 reference
   frame captions already use, so the 9:16 panel is what comes out.
   ========================================================================== */

let OVERLAYS = [];            // live elements of the active Result
let overlaySeq = 0;
let tlxSel = null;            // { type: "clip" | "el", id }

const OVERLAY_DEFAULTS = {
  text: { text: "Text", x: 50, y: 22, size: 72, color: "#FFFFFF", box: false },
  image: { x: 50, y: 45, size: 40 },
  sound: { volume: 1 },
};
const TEXT_COLORS = ["#FFFFFF", "#FFD600", "#FF4D4D", "#4DD2FF", "#000000"];

/* Called by projects.js whenever a Result is loaded or started. */
function setOverlays(list) {
  OVERLAYS = Array.isArray(list) ? list.map((e) => ({ ...e })) : [];
  overlaySeq = Math.max(0, ...OVERLAYS.map((e) => parseInt(String(e.id).slice(1), 10) || 0));
  tlxSel = null;
  syncSoundElements();
  drawOverlays();
  if (activeScreen === "timeline") renderTimeline();
}

/* ---------- output-time helpers ---------- */

const tlxClip = () => (typeof activeClip !== "undefined" ? activeClip : null);
const tlxTotal = () => (tlxClip() ? clipOutDur(tlxClip()) : 0);
function tlxNow() {
  const k = tlxClip();
  if (!k || !video?.src) return 0;
  return sourceToOut(k, vNow(video)) ?? 0;
}
function tlxSeek(out) {
  const k = tlxClip();
  if (!k || !video?.src) return;
  vSeek(video, outToSource(k, Math.max(0, Math.min(tlxTotal() - 0.01, out))));
  if (typeof drawHead === "function") drawHead();
  if (typeof drawCaption === "function") drawCaption();
  if (typeof syncCanvasVideo === "function") syncCanvasVideo();
  drawOverlays(out);
  drawTimelineHead(out);
}
const round2 = (n) => Math.round(n * 100) / 100;

/* Each RESULT entry's range in the OUTPUT -- what the clip lane draws and
   what per-clip volume is sent as. */
function segmentRanges() {
  let at = 0;
  return RESULT.map((r) => {
    const len = r.end - r.start;
    const seg = { r, start: at, end: at + len };
    at += len;
    return seg;
  });
}

/* Per-clip volume for the render: only the clips that aren't at 100%. */
function segmentVolumes() {
  return segmentRanges()
    .filter((s) => s.r.volume !== undefined && Math.abs(s.r.volume - 1) > 1e-6)
    .map((s) => ({ start: round2(s.start), end: round2(s.end), volume: s.r.volume }));
}

/* The elements as sent to the server -- without anything only the editor needs. */
function overlaysForRender() {
  // From RESULT itself, not the preview's clip: resultAsClip() calls this
  // while it's BUILDING the clip the preview is about to switch to.
  const total = typeof resultTotal === "function" ? resultTotal() : tlxTotal();
  return OVERLAYS
    .filter((e) => e.start < total)
    .map(({ id, ...e }) => ({ ...e, end: Math.min(e.end, total) }));
}

// The project's own copy (projects/<id>/assets/, see assets.js).
const assetFileUrl = (file) => projectMediaUrl(file);
const libraryOf = (kind) => ASSETS.filter((a) => a.kind === kind);

/* ---------- preview: labels and stickers in the 9:16 frame ---------- */

let _overlayKey = "";
function drawOverlays(out) {
  const layer = $("#overlayLayer");
  const frame = $("#frame");
  if (!layer || !frame) return;
  const t = out ?? tlxNow();
  const visible = tlxClip() ? OVERLAYS.filter((e) => e.kind !== "sound" && t >= e.start && t < e.end) : [];
  const h = frame.getBoundingClientRect().height;
  // Rebuilt only when what's visible (or how it looks) changes -- this runs
  // on every timeupdate.
  const key = `${h}|` + visible.map((e) => JSON.stringify(e)).join("|");
  if (key === _overlayKey) return;
  _overlayKey = key;
  layer.innerHTML = visible.map((e) => {
    const pos = `left:${e.x}%;top:${e.y}%`;
    if (e.kind === "text") {
      // Same reference as the captions (pxFromOut, interactions.js): a
      // size is px in the 1080x1920 frame, scaled to this panel.
      const px = typeof pxFromOut === "function" ? pxFromOut(e.size, h) : e.size / 4;
      return `<div class="ov-text${e.box ? " box" : ""}" style="${pos};font-size:${px}px;color:${escapeHTML(e.color)}">`
        + `${escapeHTML(e.text).replace(/\n/g, "<br>")}</div>`;
    }
    return `<img class="ov-image" alt="" src="${assetFileUrl(e.file)}" style="${pos};width:${e.size}%">`;
  }).join("");
}

/* ---------- preview: sounds ----------
   One <audio> per sound element, started and stopped against the output
   clock. The browser can't play above 100%, so a sound set louder previews
   at full volume -- the render applies the real level. */
const soundEls = new Map();

function syncSoundElements() {
  const ids = new Set(OVERLAYS.filter((e) => e.kind === "sound").map((e) => e.id));
  for (const [id, a] of soundEls) {
    if (!ids.has(id)) { a.pause(); soundEls.delete(id); }
  }
  for (const e of OVERLAYS) {
    if (e.kind !== "sound") continue;
    let a = soundEls.get(e.id);
    if (!a || a.dataset.file !== e.file) {
      a?.pause();
      a = new Audio(assetFileUrl(e.file));
      a.preload = "auto";
      a.dataset.file = e.file;
      soundEls.set(e.id, a);
    }
  }
}

function syncSounds(out) {
  const playing = video && !video.paused && !video.dataset.switching;
  const t = out ?? tlxNow();
  for (const e of OVERLAYS) {
    if (e.kind !== "sound") continue;
    const a = soundEls.get(e.id);
    if (!a) continue;
    const inside = t >= e.start && t < e.end;
    if (playing && inside) {
      a.volume = Math.max(0, Math.min(1, e.volume ?? 1)) * (video.muted ? 0 : 1);
      const want = t - e.start;
      if (a.paused) {
        try { a.currentTime = want; } catch { /* not loaded yet */ }
        a.play().catch(() => {});
      } else if (Math.abs(a.currentTime - want) > 0.35) {
        try { a.currentTime = want; } catch { /* ignore */ }
      }
    } else if (!a.paused) {
      a.pause();
    }
  }
}

/* The playing clip's own volume, previewed on the <video> itself. */
function applySegmentVolume(out) {
  if (!video) return;
  const seg = segmentRanges().find((s) => out >= s.start && out < s.end);
  const v = seg?.r.volume ?? 1;
  video.volume = Math.max(0, Math.min(1, v));
}

/* One hook for player.js: everything here that follows the clock. */
function composeTick(out) {
  drawOverlays(out);
  syncSounds(out);
  applySegmentVolume(out);
  drawTimelineHead(out);
}
["pause", "play", "seeked"].forEach((ev) => video?.addEventListener(ev, () => {
  if (!video.dataset.switching) composeTick(tlxNow());
}));

/* ---------- the Timeline screen ---------- */

function niceStep(total) {
  for (const s of [1, 2, 5, 10, 15, 30, 60, 120, 300]) if (total / s <= 10) return s;
  return 600;
}

function renderTimeline() {
  renderLanes();
  renderInspector();
}

/* The lanes alone -- what an inspector edit redraws, so the slider or text
   field being used isn't replaced under the pointer mid-drag. */
function renderLanes() {
  const lanes = $("#tlxLanes");
  if (!lanes) return;
  const total = tlxTotal();
  const note = $("#tlxNote");
  if (!RESULT.length || !total) {
    $("#tlxRuler").innerHTML = "";
    ["#tlxClips", "#tlxText", "#tlxImage", "#tlxSound"].forEach((s) => { $(s).innerHTML = ""; });
    if (note) note.textContent = "add moments to the Result on Clips first";
    return;
  }
  if (note) {
    note.textContent = `${RESULT.length} clip${RESULT.length === 1 ? "" : "s"} · ${preciseTime(total)}`
      + (OVERLAYS.length ? ` · ${OVERLAYS.length} element${OVERLAYS.length === 1 ? "" : "s"}` : "");
  }
  const pct = (t) => `${(t / total) * 100}%`;

  const step = niceStep(total);
  let ticks = "";
  for (let t = 0; t <= total + 1e-6; t += step) ticks += `<span style="left:${pct(t)}">${timeRange(t)}</span>`;
  $("#tlxRuler").innerHTML = ticks;

  const multi = isMultiAsset();
  $("#tlxClips").innerHTML = segmentRanges().map((s, i) => {
    const sel = tlxSel?.type === "clip" && tlxSel.id === s.r.id;
    const vol = s.r.volume ?? 1;
    return `<div class="tlx-seg${sel ? " sel" : ""}" draggable="true" data-seg="${s.r.id}" data-idx="${i}"
         style="left:${pct(s.start)};width:${pct(s.end - s.start)}"
         title="${escapeHTML(s.r.title)} · ${escapeHTML(assetTimeLabel(s.r.start))} – ${escapeHTML(timeRange(toReal(s.r.end).t))}">
      <b>${i + 1}</b><span>${escapeHTML(s.r.title)}</span>
      ${multi ? `<i>${escapeHTML(assetStem(assetById(toReal(s.r.start).id)))}</i>` : ""}
      ${Math.abs(vol - 1) > 1e-6 ? `<em>${Math.round(vol * 100)}%</em>` : ""}
    </div>`;
  }).join("");

  const bar = (e) => {
    const sel = tlxSel?.type === "el" && tlxSel.id === e.id;
    const label = e.kind === "text" ? e.text : e.file;
    return `<div class="tlx-bar ${e.kind}${sel ? " sel" : ""}" data-el="${e.id}"
         style="left:${pct(e.start)};width:${pct(Math.max(0.05, Math.min(total, e.end) - e.start))}"
         title="${escapeHTML(label)} · ${preciseTime(e.start)} – ${preciseTime(e.end)}">
      <b class="tlx-grip l" data-grip="start"></b><span>${escapeHTML(label)}</span><b class="tlx-grip r" data-grip="end"></b>
    </div>`;
  };
  $("#tlxText").innerHTML = OVERLAYS.filter((e) => e.kind === "text").map(bar).join("");
  $("#tlxImage").innerHTML = OVERLAYS.filter((e) => e.kind === "image").map(bar).join("");
  $("#tlxSound").innerHTML = OVERLAYS.filter((e) => e.kind === "sound").map(bar).join("");
  drawTimelineHead(tlxNow());
}

function drawTimelineHead(out) {
  const head = $("#tlxHead");
  const total = tlxTotal();
  if (!head) return;
  head.hidden = !total;
  if (total) head.style.left = `${Math.min(100, (out / total) * 100)}%`;
  const clock = $("#tlxTime");
  if (clock) clock.textContent = `${preciseTime(out)} / ${preciseTime(total)}`;
}

/* ---------- inspector ---------- */

function field(label, html) { return `<label class="tlx-field"><span>${label}</span>${html}</label>`; }
function rangeField(label, key, value, min, max, step, unit = "") {
  return field(label, `<span class="tlx-range"><input type="range" data-key="${key}" min="${min}" max="${max}"
      step="${step}" value="${value}"><output>${value}${unit}</output></span>`);
}

function renderInspector() {
  const box = $("#tlxInspector");
  if (!box) return;
  if (!tlxSel) {
    box.innerHTML = `<p class="empty-message">Select a clip or an element on the timeline.
      Drag clips to change their order; drag an element's bar to move it, its ends to trim it.</p>`;
    return;
  }
  if (tlxSel.type === "clip") {
    const i = RESULT.findIndex((r) => r.id === tlxSel.id);
    const r = RESULT[i];
    if (!r) { tlxSel = null; renderInspector(); return; }
    const seg = segmentRanges()[i];
    const vol = Math.round((r.volume ?? 1) * 100);
    box.innerHTML = `
      <div class="tlx-insp-head"><span class="eyebrow">Clip ${i + 1}</span><b>${escapeHTML(r.title)}</b></div>
      <p class="data tlx-sub">${escapeHTML(assetTimeLabel(r.start))} – ${escapeHTML(timeRange(toReal(r.end).t))}
        · plays ${preciseTime(seg.start)} – ${preciseTime(seg.end)}</p>
      ${rangeField("Volume", "volume", vol, 0, 200, 5, "%")}
      <div class="tlx-actions">
        <button class="btn quiet" type="button" data-act="earlier"${i === 0 ? " disabled" : ""}>◀ Earlier</button>
        <button class="btn quiet" type="button" data-act="later"${i === RESULT.length - 1 ? " disabled" : ""}>Later ▶</button>
        <button class="btn quiet" type="button" data-act="sound-here" title="A sound starting where this clip starts — a transition sting">+ Sound at start</button>
        <button class="btn quiet" type="button" data-act="sort">Source order</button>
      </div>`;
    return;
  }
  const e = OVERLAYS.find((x) => x.id === tlxSel.id);
  if (!e) { tlxSel = null; renderInspector(); return; }
  const times = `
    <div class="tlx-row">
      ${field("Start", `<input class="input" type="number" data-key="start" step="0.1" min="0" value="${round2(e.start)}">`)}
      ${field("End", `<input class="input" type="number" data-key="end" step="0.1" min="0" value="${round2(e.end)}">`)}
    </div>`;
  const place = `${rangeField("X", "x", Math.round(e.x), 0, 100, 1, "%")}${rangeField("Y", "y", Math.round(e.y), 0, 100, 1, "%")}`;
  let body = "";
  if (e.kind === "text") {
    body = `
      ${field("Text", `<textarea class="input" data-key="text" rows="2">${escapeHTML(e.text)}</textarea>`)}
      ${times}${place}
      ${rangeField("Size", "size", e.size, 24, 200, 2)}
      <div class="tlx-field"><span>Colour</span><span class="tlx-colors">${TEXT_COLORS.map((c) =>
        `<button type="button" class="tlx-color${c.toUpperCase() === String(e.color).toUpperCase() ? " on" : ""}"
                 data-color="${c}" style="background:${c}" aria-label="Colour ${c}"></button>`).join("")}</span></div>
      <label class="tlx-check"><input type="checkbox" data-key="box"${e.box ? " checked" : ""}> Dark box behind the text</label>`;
  } else {
    const lib = libraryOf(e.kind);
    body = `
      ${field(e.kind === "image" ? "Image" : "Sound", `<select class="input" data-key="file">${lib.map((a) =>
        `<option value="${escapeHTML(a.file)}"${a.file === e.file ? " selected" : ""}>${escapeHTML(a.file)}</option>`).join("")}</select>`)}
      ${times}
      ${e.kind === "image" ? `${place}${rangeField("Width", "size", Math.round(e.size), 5, 100, 1, "%")}`
        : rangeField("Volume", "volume", Math.round((e.volume ?? 1) * 100), 0, 200, 5, "%")}`;
  }
  box.innerHTML = `
    <div class="tlx-insp-head"><span class="eyebrow">${e.kind}</span>
      <button class="btn quiet" type="button" data-act="delete">Delete</button></div>
    ${body}`;
}

/* ---------- editing ---------- */

function commitOverlays() {
  _overlayKey = "";
  syncSoundElements();
  drawOverlays();
  renderTimeline();
  if (typeof saveProject === "function") saveProject();
}

async function addElement(kind) {
  const total = tlxTotal();
  const note = $("#tlxNote");
  if (!total) { if (note) note.textContent = "add moments to the Result on Clips first"; return; }
  const at = Math.min(tlxNow(), Math.max(0, total - 0.5));
  const e = { id: `o${++overlaySeq}`, kind, start: round2(at), end: round2(Math.min(total, at + 3)),
              ...OVERLAY_DEFAULTS[kind] };
  if (kind !== "text") {
    const lib = libraryOf(kind);
    if (!lib.length) {
      if (note) note.textContent = `no ${kind === "image" ? "images" : "sounds"} in this project yet — add some on the Assets screen`;
      return;
    }
    e.file = lib[0].file;
  }
  if (kind === "sound") e.end = round2(Math.min(total, at + await soundLength(e.file)));
  OVERLAYS.push(e);
  tlxSel = { type: "el", id: e.id };
  commitOverlays();
}

/* How long a sound file plays -- its bar is that long by default. */
function soundLength(file) {
  return new Promise((done) => {
    const a = new Audio(assetFileUrl(file));
    a.preload = "metadata";
    a.onloadedmetadata = () => done(Number.isFinite(a.duration) ? a.duration : 2);
    a.onerror = () => done(2);
  });
}

function moveClip(from, to) {
  if (from === to || from < 0 || to < 0 || from >= RESULT.length || to >= RESULT.length) return;
  const [r] = RESULT.splice(from, 1);
  RESULT.splice(to, 0, r);
  renderResult();          // saves, and re-points the preview at the new order
  renderTimeline();
}

$("#tlxAddText")?.addEventListener("click", () => addElement("text"));
$("#tlxAddImage")?.addEventListener("click", () => addElement("image"));
$("#tlxAddSound")?.addEventListener("click", () => addElement("sound"));

/* Seek by clicking the ruler or an empty stretch of a lane. */
$("#tlxLanes")?.addEventListener("pointerdown", (ev) => {
  if (ev.target.closest(".tlx-seg, .tlx-bar")) return;
  const lanes = $("#tlxLanes");
  const r = lanes.getBoundingClientRect();
  if (!r.width || !tlxTotal()) return;
  tlxSeek(((ev.clientX - r.left) / r.width) * tlxTotal());
  if (tlxSel) { tlxSel = null; renderTimeline(); }
});

/* Clip blocks: click selects, drag reorders. */
$("#tlxClips")?.addEventListener("click", (ev) => {
  const seg = ev.target.closest(".tlx-seg");
  if (!seg) return;
  tlxSel = { type: "clip", id: seg.dataset.seg };
  const s = segmentRanges()[Number(seg.dataset.idx)];
  if (s) tlxSeek(s.start);
  renderTimeline();
});
$("#tlxClips")?.addEventListener("dragstart", (ev) => {
  const seg = ev.target.closest(".tlx-seg");
  if (!seg) return;
  ev.dataTransfer.setData("text/plain", seg.dataset.idx);
  ev.dataTransfer.effectAllowed = "move";
});
$("#tlxClips")?.addEventListener("dragover", (ev) => { ev.preventDefault(); ev.dataTransfer.dropEffect = "move"; });
$("#tlxClips")?.addEventListener("drop", (ev) => {
  ev.preventDefault();
  const from = Number(ev.dataTransfer.getData("text/plain"));
  const lane = $("#tlxClips").getBoundingClientRect();
  const out = ((ev.clientX - lane.left) / lane.width) * tlxTotal();
  // The drop point's clip, or the last one past the end.
  const segs = segmentRanges();
  let to = segs.findIndex((s) => out < s.end);
  if (to < 0) to = segs.length - 1;
  moveClip(from, to);
});

/* Element bars: drag the middle to move, an end to trim. */
let barDrag = null;
document.addEventListener("pointerdown", (ev) => {
  const barEl = ev.target.closest?.(".tlx-bar");
  if (!barEl) return;
  const e = OVERLAYS.find((x) => x.id === barEl.dataset.el);
  if (!e) return;
  ev.preventDefault();
  const lane = barEl.parentElement.getBoundingClientRect();
  barDrag = { e, mode: ev.target.closest("[data-grip]")?.dataset.grip || "move",
              x0: ev.clientX, s0: e.start, e0: e.end, perPx: tlxTotal() / (lane.width || 1), moved: false };
  tlxSel = { type: "el", id: e.id };
  barEl.setPointerCapture?.(ev.pointerId);
});
document.addEventListener("pointermove", (ev) => {
  if (!barDrag) return;
  const { e, mode, x0, s0, e0, perPx } = barDrag;
  const d = (ev.clientX - x0) * perPx;
  if (Math.abs(ev.clientX - x0) > 2) barDrag.moved = true;
  const total = tlxTotal();
  const len = e0 - s0;
  if (mode === "move") {
    e.start = round2(Math.max(0, Math.min(total - len, s0 + d)));
    e.end = round2(e.start + len);
  } else if (mode === "start") {
    e.start = round2(Math.max(0, Math.min(e0 - 0.2, s0 + d)));
  } else {
    e.end = round2(Math.max(s0 + 0.2, Math.min(total, e0 + d)));
  }
  _overlayKey = "";
  renderLanes();
  drawOverlays();
});
document.addEventListener("pointerup", () => {
  if (!barDrag) return;
  const { e, moved } = barDrag;
  barDrag = null;
  if (!moved) tlxSeek(e.start);
  commitOverlays();
});

/* Inspector inputs. */
$("#tlxInspector")?.addEventListener("input", (ev) => {
  const el = ev.target.closest("[data-key]");
  if (!el || !tlxSel) return;
  const key = el.dataset.key;
  if (tlxSel.type === "clip") {
    const r = RESULT.find((x) => x.id === tlxSel.id);
    if (!r || key !== "volume") return;
    const v = Number(el.value) / 100;
    if (Math.abs(v - 1) < 1e-6) delete r.volume; else r.volume = v;
    el.nextElementSibling && (el.nextElementSibling.textContent = `${el.value}%`);
    applySegmentVolume(tlxNow());
    renderTimelineLanesOnly();
    if (typeof saveProject === "function") saveProject();
    return;
  }
  const e = OVERLAYS.find((x) => x.id === tlxSel.id);
  if (!e) return;
  if (key === "text") e.text = el.value;
  else if (key === "box") e.box = el.checked;
  else if (key === "file") e.file = el.value;
  else if (key === "volume") e.volume = Number(el.value) / 100;
  else if (key === "start" || key === "end") {
    const n = Number(el.value);
    if (!Number.isFinite(n)) return;
    const total = tlxTotal();
    if (key === "start") e.start = round2(Math.max(0, Math.min(e.end - 0.1, n)));
    else e.end = round2(Math.max(e.start + 0.1, Math.min(total, n)));
  } else {
    e[key] = Number(el.value);
  }
  const out = el.nextElementSibling;
  if (out?.tagName === "OUTPUT") out.textContent = `${el.value}${key === "size" && e.kind === "text" ? "" : "%"}`;
  _overlayKey = "";
  if (key === "file") syncSoundElements();
  drawOverlays();
  renderTimelineLanesOnly();
  if (typeof saveProject === "function") saveProject();
});

const renderTimelineLanesOnly = () => renderLanes();

$("#tlxInspector")?.addEventListener("click", (ev) => {
  const color = ev.target.closest("[data-color]");
  if (color && tlxSel?.type === "el") {
    const e = OVERLAYS.find((x) => x.id === tlxSel.id);
    if (e) { e.color = color.dataset.color; commitOverlays(); }
    return;
  }
  const act = ev.target.closest("[data-act]")?.dataset.act;
  if (!act || !tlxSel) return;
  if (act === "delete") {
    OVERLAYS = OVERLAYS.filter((x) => x.id !== tlxSel.id);
    tlxSel = null;
    commitOverlays();
    return;
  }
  const i = RESULT.findIndex((r) => r.id === tlxSel.id);
  if (act === "earlier") moveClip(i, i - 1);
  else if (act === "later") moveClip(i, i + 1);
  else if (act === "sort") {
    RESULT.sort((a, b) => a.start - b.start);
    renderResult();
    renderTimeline();
  } else if (act === "sound-here") {
    const s = segmentRanges()[i];
    if (s) { tlxSeek(s.start); addElement("sound"); }
  }
});

document.addEventListener("keydown", (ev) => {
  if (activeScreen !== "timeline" || tlxSel?.type !== "el") return;
  const t = ev.target;
  if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT")) return;
  if (ev.key === "Delete" || ev.key === "Backspace") {
    ev.preventDefault();
    OVERLAYS = OVERLAYS.filter((x) => x.id !== tlxSel.id);
    tlxSel = null;
    commitOverlays();
  }
});

window.addEventListener("resize", () => { _overlayKey = ""; drawOverlays(); });
