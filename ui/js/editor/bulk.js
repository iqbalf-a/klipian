/* klipian — the Results list: render, delete and format many Results at once (P23)
   ==========================================================================
   The Clips screen lists every Result of the project with a tick box (step 2 of the screen: 1 choose
   suggestions, 2 Results, 3 render). Above the ticked ones:

     Output format…    one Output Format (picture, background, position, resolution, quality) written into every
                       ticked Result, or only the controls you leave unlocked (applyOutputToResults, app.js);
     Delete selected   the Results go, with an Undo; rendered files and upload-schedule rows are never touched;
     Render selected   saves the project, asks the server what it would do (/api/render/plan: the clips, the
                       ones it cannot render and why, an estimate), shows that in a dialog (with each clip's
                       format and a way to change it), optionally runs AI Framing on the Results that have
                       none, and then sends {project, results} -- the server builds every request from the saved
                       Results (klipian/renderreq.py) and runs them one after another (renderSavedResults,
                       player.js). The queue is the History screen.

   "Select all from this brief" ticks the Results made from the same Claude import: each suggestion carries an
   `importId` (roundtrip.js) and a Result made only from suggestions keeps the importId of the first one
   (result.js). Older Results have none: then it ticks every Result that is made only of AI suggestions.
   ========================================================================== */

const BULK_TICKED = new Set();            // ids of the ticked Results
const BULK_FRESH = new Set();             // Results just made from suggestions: lit for a few seconds

const bulkFmtTime = (sec) => {
  const s = Math.max(0, Math.round(sec));
  return s >= 3600 ? `${Math.floor(s / 3600)} h ${Math.round((s % 3600) / 60)} min`
    : s >= 60 ? `${Math.floor(s / 60)} min ${s % 60} s` : `${s} s`;
};

/* What the framing of a Result amounts to: only the untouched 00:00 placeholder, or N points the person (or AI
   Framing, or head tracking) made. */
function bulkFramingText(points) {
  const own = (points || []).filter((p) => !p.auto);
  if (!own.length) return "auto 00:00 only";
  return `${own.length} point${own.length === 1 ? "" : "s"}` + (own.some((p) => p.tracking) ? " · tracked" : "");
}

/* What the list shows for each Result. The open one is read from the live state (its latest edits are not in
   SAVED_RESULTS until the next save); the others from what is saved. */
function bulkRows() {
  return (typeof SAVED_RESULTS !== "undefined" ? SAVED_RESULTS : []).map((r, i) => {
    const live = r.id === activeResultId;
    const segs = live ? RESULT.map((x) => ({ start: x.start, end: x.end, title: x.title, source: x.source }))
      : (Array.isArray(r.segments) ? r.segments : Array.isArray(r.result) ? r.result : []);
    const typed = live ? ($("#resultTitle")?.value.trim() || "") : (r.title || "");
    const output = live ? outputState() : r.output;
    return {
      id: r.id, live, moments: segs.length,
      title: typed || segs[0]?.title || `Result ${i + 1}`,
      duration: segs.reduce((t, x) => t + (x.end - x.start), 0),
      format: describeOutput(output),
      picture: withOutput(output, () => optionOut("picture")),
      importId: r.importId || "",
      allAi: segs.length > 0 && segs.every((x) => x.source === "ai"),
      framed: (r.framing || []).some((p) => !p.auto),
      framing: bulkFramingText(live ? FRAMING : r.framing),
      renderedAt: r.renderedAt || 0,
      postTitle: (live ? currentPost()?.title : r.post?.title) || "",
      hasPost: !!(live ? currentPost() : r.post),
    };
  });
}

const bulkAgo = (sec) => (typeof timeAgo === "function" ? timeAgo(sec) : new Date(sec * 1000).toLocaleString());

function renderAllResults() {
  const list = $("#allResList");
  if (!list) return;
  const rows = bulkRows();
  for (const id of [...BULK_TICKED]) if (!rows.some((r) => r.id === id)) BULK_TICKED.delete(id);
  for (const r of rows) if (!r.moments) BULK_TICKED.delete(r.id);
  $("#allResNote").textContent = rows.length === 1 ? "1 Result" : `${rows.length} Results`;
  const jump = $("#jumpResults");
  if (jump) jump.textContent = `↓ Results (${rows.length})`;
  const live = rows.find((r) => r.live);
  const openName = $("#resultOpenName");
  if (openName) openName.textContent = live ? `· ${live.title}` : "";
  $("#allResEmpty").hidden = rows.some((r) => r.moments);
  list.innerHTML = rows.map((r, i) => `
    <div class="allres-row${r.live ? " active" : ""}${BULK_TICKED.has(r.id) ? " ticked" : ""}${BULK_FRESH.has(r.id) ? " fresh" : ""}" data-id="${escapeHTML(r.id)}">
      <input type="checkbox" data-bulk-tick aria-label="Select ${escapeHTML(r.title)}"${BULK_TICKED.has(r.id) ? " checked" : ""}${r.moments ? "" : " disabled"}
             ${r.moments ? "" : 'title="Nothing to render yet: this Result has no moments"'}>
      <span class="num">${i + 1}</span>
      <div class="allres-main">
        <button class="allres-name" type="button" data-bulk-open title="Open this Result">${escapeHTML(r.title)}</button>
        ${r.importId ? '<span class="allres-tag" title="Made from an AI import">AI</span>' : ""}
        <div class="allres-meta">
          <span>${r.moments ? `${Math.round(r.duration)}s · ${r.moments} moment${r.moments === 1 ? "" : "s"}` : "no moments yet"}</span>
          <span title="Output format">${escapeHTML(r.format)}</span>
          <span title="Framing">framing: ${escapeHTML(r.framing)}</span>
          ${r.hasPost ? `<span class="post-ok" title="Post text written: ${escapeHTML(r.postTitle)}">post ✓ ${escapeHTML(r.postTitle || "(no title)")}</span>`
            : '<span class="not-rendered" title="This Result has no post text yet">no post text</span>'}
          ${r.renderedAt ? `<span class="rendered" title="Last render of this Result">✓ rendered ${escapeHTML(bulkAgo(r.renderedAt))}</span>`
            : '<span class="not-rendered">not rendered</span>'}
        </div>
      </div>
      <div class="allres-actions">
        ${r.live ? '<span class="btn sm allres-editing" title="This Result is open below in Open Result: moments" aria-current="true">Editing</span>'
          : '<button class="btn sm" type="button" data-bulk-open>Open</button>'}
        <button class="btn sm quiet" type="button" data-bulk-post title="Write the post text with Claude (copy a brief, paste the reply)">Post text…</button>
        <button class="btn sm quiet allres-x" type="button" data-bulk-delete title="Delete this Result" aria-label="Delete ${escapeHTML(r.title)}">✕</button>
      </div>
    </div>`).join("");
  const n = BULK_TICKED.size;
  const none = "Tick the Results you want first";
  for (const [id, word] of [["bulkRenderBtn", "Render selected"], ["bulkPostBtn", "Write post text…"], ["bulkOutputBtn", "Output format…"], ["bulkDeleteBtn", "Delete selected"]]) {
    const b = document.getElementById(id);
    if (!b) continue;
    b.textContent = n ? `${word.replace("…", "")} (${n})${word.endsWith("…") ? "…" : ""}` : word;
    b.disabled = !n || (id === "bulkRenderBtn" && renderJobId !== null);
    b.title = !n ? none : (id === "bulkRenderBtn" && renderJobId !== null ? "A render is already running" : "");
  }
  const brief = $("#bulkSelectBrief");
  if (brief) brief.disabled = !rows.some((r) => r.moments);
}

$("#allResList")?.addEventListener("change", (e) => {
  const tick = e.target.closest("[data-bulk-tick]");
  if (!tick) return;
  const id = tick.closest("[data-id]").dataset.id;
  if (tick.checked) BULK_TICKED.add(id); else BULK_TICKED.delete(id);
  renderAllResults();
});

$("#allResList")?.addEventListener("click", (e) => {
  const id = e.target.closest("[data-id]")?.dataset.id;
  if (!id) return;
  if (e.target.closest("[data-bulk-open]") && typeof switchResult === "function") switchResult(id);
  else if (e.target.closest("[data-bulk-delete]")) deleteResultsAsked([id]);
  else if (e.target.closest("[data-bulk-post]")) writePostTextDialog([id]);
});

$("#bulkSelectAll")?.addEventListener("click", () => {
  for (const r of bulkRows()) if (r.moments) BULK_TICKED.add(r.id);
  renderAllResults();
});

$("#bulkSelectNone")?.addEventListener("click", () => { BULK_TICKED.clear(); renderAllResults(); });

/* The Results of one brief: the import of the open Result, else the latest import; Results that have no import
   id (older ones) count as of a brief when they are made only of AI suggestions. */
$("#bulkSelectBrief")?.addEventListener("click", () => {
  const rows = bulkRows().filter((r) => r.moments);
  const ids = (typeof allCandidates === "function" ? allCandidates() : []).map((k) => k.importId).filter(Boolean).sort();
  const own = rows.find((r) => r.live)?.importId;
  const wanted = own || ids[ids.length - 1] || "";
  let picked = wanted ? rows.filter((r) => r.importId === wanted) : [];
  if (!picked.length) picked = rows.filter((r) => !r.importId && r.allAi);
  BULK_TICKED.clear();
  picked.forEach((r) => BULK_TICKED.add(r.id));
  renderAllResults();
  $("#allResNote").textContent = picked.length
    ? `${picked.length} Result${picked.length === 1 ? "" : "s"} from this brief ticked`
    : "no Result from a brief yet";
});

/* ---------- delete ---------- */

/* Ask, then remove the Results; the Undo toast gives them back. A Result is only its moments, framing points,
   caption fixes and post text: rendered files and upload-schedule rows stay where they are, and the dialog says so. */
async function deleteResultsAsked(ids) {
  const rows = bulkRows().filter((r) => ids.includes(r.id));
  if (!rows.length) return false;
  const one = rows.length === 1;
  const body = document.createElement("div");
  if (!one) {
    const ul = document.createElement("ul");
    ul.className = "bulk-plan-list";
    for (const r of rows.slice(0, 8)) { const li = document.createElement("li"); li.textContent = r.title; ul.append(li); }
    if (rows.length > 8) { const li = document.createElement("li"); li.textContent = `…and ${rows.length - 8} more`; ul.append(li); }
    body.append(ul);
  }
  const ok = await confirmDialog({
    title: one ? "Delete this Result?" : `Delete ${rows.length} Results?`,
    message: (one ? `"${rows[0].title}": its moments, framing points and caption fixes are lost.`
      : "Their moments, framing points and caption fixes are lost.") + " You can undo this for a few seconds.",
    body: one ? null : body,
    warning: "Files already rendered and rows in the upload schedule are not deleted.",
    confirmText: "Delete",
  });
  if (!ok) return false;
  const gone = removeResults(rows.map((r) => r.id));
  for (const g of gone) BULK_TICKED.delete(g.entry.id);
  renderAllResults();
  if (gone.length) {
    showUndoToast(gone.length === 1 ? "Result deleted" : `${gone.length} Results deleted`, () => { restoreResults(gone); renderAllResults(); });
  }
  return true;
}

/* After "A separate video for each" (or "Add to this Result"): scroll to step 2 and light the Results involved.
   The new ones are ticked too, so Output format… and Render selected are one click away. */
let bulkFreshTimer = null;
function bulkShowFresh(ids, { tick = true } = {}) {
  BULK_FRESH.clear();
  for (const id of ids) { BULK_FRESH.add(id); if (tick) BULK_TICKED.add(id); }
  renderAllResults();
  $(".panel.allres")?.scrollIntoView({ behavior: "smooth", block: "start" });
  clearTimeout(bulkFreshTimer);
  bulkFreshTimer = setTimeout(() => { BULK_FRESH.clear(); renderAllResults(); }, 4000);
}

$("#jumpResults")?.addEventListener("click", () => {
  $(".panel.allres")?.scrollIntoView({ behavior: "smooth", block: "start" });
});

$("#bulkDeleteBtn")?.addEventListener("click", () => { if (BULK_TICKED.size) deleteResultsAsked([...BULK_TICKED]); });

/* ---------- output format for many Results ---------- */

/* The Output Format controls of the Output Format screen (the same OPTIONS: choices, their order, hints, which
   rows show for which picture), in a dialog, prefilled with the open Result's choices. Each row can be left
   alone ("keep each Result's own"), so only the Picture, say, is changed. Resolves true when applied. */
async function bulkOutputDialog(ids) {
  let afterDraw = () => {};                      // the preview, once it is built (below)
  const draft = outputState();
  const keep = new Set();
  const body = document.createElement("div");
  body.className = "bulk-out";
  const rowsEl = {};
  const draw = () => {
    for (const id of OPTION_ROWS) {
      const o = OPTIONS.find((x) => x.id === id);
      const row = rowsEl[id];
      const k = OPTIONS.indexOf(o);
      row.hidden = o.shownWhen ? !withOutput(draft, o.shownWhen) : false;
      row.classList.toggle("kept", keep.has(id));
      if (o.kind === "range") {
        row.querySelector("input.slider").value = draft[k];
        row.querySelector("output").textContent = `${draft[k]}${o.unit || ""}`;
        row.querySelector("input.slider").disabled = keep.has(id);
      } else {
        row.querySelectorAll(".chip").forEach((b) => {
          b.setAttribute("aria-pressed", String(Number(b.dataset.pick) === (Number.isInteger(draft[k]) ? draft[k] : o.active)));
          b.disabled = keep.has(id);
        });
        row.querySelector(".hint").textContent = o.hint ? o.hint[Number.isInteger(draft[k]) ? draft[k] : o.active] : "";
      }
    }
    afterDraw();
  };
  for (const id of OPTION_ROWS) {
    const o = OPTIONS.find((x) => x.id === id);
    const k = OPTIONS.indexOf(o);
    const row = document.createElement("div");
    row.className = "option-row";
    row.dataset.option = id;
    const label = Object.assign(document.createElement("span"), { className: "eyebrow", textContent: o.label });
    row.append(label);
    if (o.kind === "range") {
      const line = document.createElement("span");
      line.className = "range-line";
      const input = Object.assign(document.createElement("input"), { className: "slider", type: "range", min: o.min, max: o.max, step: o.step, value: draft[k] });
      input.setAttribute("aria-label", o.label);
      input.addEventListener("input", () => { draft[k] = Number(input.value); draw(); });
      line.append(input, Object.assign(document.createElement("output"), { className: "data" }));
      row.append(line);
    } else {
      const choices = document.createElement("span");
      choices.className = "choices";
      for (const i of o.order || o.choices.map((_, n) => n)) {
        const chip = Object.assign(document.createElement("button"), { className: "chip", type: "button", textContent: o.choices[i] });
        chip.dataset.pick = i;
        chip.addEventListener("click", () => { draft[k] = i; draw(); });
        choices.append(chip);
      }
      row.append(choices);
    }
    row.append(Object.assign(document.createElement("span"), { className: "hint" }));
    const keepLabel = document.createElement("label");
    keepLabel.className = "bulk-out-keep";
    const keepBox = Object.assign(document.createElement("input"), { type: "checkbox" });
    keepBox.addEventListener("change", () => { if (keepBox.checked) keep.add(id); else keep.delete(id); draw(); });
    keepLabel.append(keepBox, document.createTextNode(" keep each Result's own"));
    row.append(keepLabel);
    rowsEl[id] = row;
    body.append(row);
  }
  /* ---- the preview: one of the ticked Results, as it would look with the values set here ----
     A still frame of the sample's first moment (about 1 s in) in a small 9:16 frame, laid out by the same
     function as the main preview (layoutPictureInFrame, player.js) with the draft's values -- and, for a control
     left on "keep each Result's own", the SAMPLE's own value. Two hidden-in-the-frame <video>s of its own (the
     picture and its blurred copy), so the main preview and the open Result are never touched. */
  snapshotActiveResult();                       // the saved copy of the open Result is current (the draft starts from it)
  const sampleIds = ids.filter((id) => SAVED_RESULTS.some((r) => r.id === id));
  let sampleId = sampleIds[0];
  const side = document.createElement("div");
  side.className = "bulk-out-side";
  side.innerHTML = `
    <label class="bulk-out-sample" hidden>Sample <select aria-label="Sample Result for the preview"></select></label>
    <div class="bulk-out-stage">
      <div class="frame916" data-video="true" data-format="single" data-safe="off" data-picture="9:16" data-bg="black">
        <div class="bgfill" aria-hidden="true"><div class="bgbox"><video class="video916" muted playsinline preload="auto"></video></div></div>
        <div class="half top"><video class="video916" muted playsinline preload="auto"></video></div>
        <p class="bulk-out-msg" role="status">Loading frame…</p>
      </div>
    </div>
    <p class="bulk-out-spec data" aria-live="polite"></p>`;
  const stage = side.querySelector(".frame916");
  const [vBg, vTop] = stage.querySelectorAll("video");
  const msg = stage.querySelector(".bulk-out-msg");
  const specEl = side.querySelector(".bulk-out-spec");
  const sel = side.querySelector("select");
  const titles = Object.fromEntries(bulkRows().map((r) => [r.id, r.title]));
  for (const id of sampleIds) sel.append(Object.assign(document.createElement("option"), { value: id, textContent: titles[id] || id }));
  side.querySelector(".bulk-out-sample").hidden = sampleIds.length < 2;
  let sampleTime = 0, sampleAsset = "a1", sampleLoaded = false;

  const slotOf = (id) => SAVED_RESULTS.find((r) => r.id === id);
  const drawStage = () => {
    const slot = slotOf(sampleId);
    if (!slot) return;
    // the sample's values, with the draft laid over every control that is not kept
    const eff = mergeOutput(slot.output, draft, keep);
    const vals = withOutput(eff, () => Object.fromEntries(OPTIONS.map((o) => [o.id, optionOut(o.id)])));
    const get = (id) => vals[id];
    const base = vTop.videoWidth && vTop.videoHeight ? vTop.videoWidth / vTop.videoHeight : 16 / 9;
    // the sample's own framing box at that second, re-fitted to the picture's shape (as changing Picture does)
    const pts = (slot.framing || []).filter((p) => (p.asset || "a1") === sampleAsset);
    const point = [...pts].reverse().find((p) => p.at <= sampleTime) || pts[0];
    const want = withOutput(eff, () => ratioFor("single"));
    // the sample's own box -- an untouched (auto) point is the default, which depends on this video and picture
    const own = (point && !point.auto && point.crops?.[0]) || withOutput(eff, () => defaultCropFor("single", base));
    layoutPictureInFrame(stage, { video: vTop, box: stage.querySelector(".half.top"), bg: vBg, bgBox: stage.querySelector(".bgbox") },
      get, refitCrop(own, base, want), base);
    const w = vals.resolution;
    specEl.textContent = `${w}×${Math.round(w * 16 / 9)} · ${withOutput(eff, () => optionValue("quality"))}`;
    msg.hidden = sampleLoaded;
  };
  afterDraw = drawStage;

  const loadSample = (id) => {
    sampleId = id;
    const slot = slotOf(id);
    const seg = (Array.isArray(slot?.segments) ? slot.segments : [])[0];
    sampleAsset = seg?.asset || "a1";
    sampleTime = seg ? seg.start + Math.min(1, (seg.end - seg.start) / 2) : 0;
    sampleLoaded = false;
    msg.hidden = false;
    msg.textContent = "Loading frame…";
    const asset = assetById(sampleAsset);
    if (!seg || !asset) { msg.textContent = "No frame to show for this Result."; drawStage(); return; }
    const url = assetUrl(asset);
    let pending = 0;
    const seeked = () => { if (--pending <= 0) { sampleLoaded = true; drawStage(); } };
    for (const v of [vTop, vBg]) {
      pending++;
      v.addEventListener("seeked", seeked, { once: true });
      v.addEventListener("error", () => { msg.hidden = false; msg.textContent = "The frame could not be loaded."; }, { once: true });
      const go = () => { try { v.currentTime = sampleTime; } catch { seeked(); } };
      if (v.getAttribute("src") === url && v.readyState >= 1) go();
      else { v.addEventListener("loadedmetadata", go, { once: true }); v.src = url; }
    }
    drawStage();
  };
  sel.addEventListener("change", () => loadSample(sel.value));

  const wrap = document.createElement("div");
  wrap.className = "bulk-out-wrap";
  wrap.append(body, side);
  draw();
  loadSample(sampleId);
  const names = bulkRows().filter((r) => ids.includes(r.id)).map((r) => r.title);
  const ok = await confirmDialog({
    title: `Output format for ${ids.length} Result${ids.length === 1 ? "" : "s"}`,
    message: `Starts from the open Result's format. ${names.slice(0, 3).join(", ")}${names.length > 3 ? ` and ${names.length - 3} more` : ""} ${names.length === 1 ? "gets" : "get"} what is set here.`,
    body: wrap, confirmText: "Apply", tone: "primary",
  });
  afterDraw = () => {};
  for (const v of [vTop, vBg]) { v.pause(); v.removeAttribute("src"); v.load(); }       // the sample's own decoders go
  if (!ok) return false;
  applyOutputToResults(ids, draft, keep);
  const note = $("#editNote");
  if (note) note.textContent = `Output format applied to ${ids.length} Result${ids.length === 1 ? "" : "s"}`
    + (keep.size ? ` (kept each one's own ${[...keep].join(", ")})` : "") + ".";
  return true;
}

$("#bulkPostBtn")?.addEventListener("click", () => {
  const ids = bulkRows().filter((r) => BULK_TICKED.has(r.id)).map((r) => r.id);
  if (ids.length) writePostTextDialog(ids);
});

$("#bulkOutputBtn")?.addEventListener("click", async () => {
  if (BULK_TICKED.size) { await bulkOutputDialog([...BULK_TICKED]); renderAllResults(); }
});

/* AI Framing for the Results that have no framing of their own, one after another, on the Framing screen. A
   setup problem (the optional packages are missing) stops it for the rest, which are rendered with the default
   framing. Returns a sentence for the status line. */
async function bulkAiFraming(ids) {
  const rows = bulkRows().filter((r) => ids.includes(r.id) && !r.framed);
  if (!rows.length) return "";
  const original = activeResultId;
  toScreen("framing");
  let done = 0, notes = [], setup = false;
  for (const r of rows) {
    renderStatus(`AI Framing ${done + 1} of ${rows.length}: ${r.title}…`);
    const res = await aiFramingForResult(r.id);
    if (res.ok) done++;
    else notes.push(`${r.title}: ${res.note}`);
    if (res.setup) { setup = true; break; }
  }
  if (typeof writeProjectNow === "function") await writeProjectNow();
  if (original !== activeResultId && typeof switchResult === "function") switchResult(original);
  if (setup) return "AI Framing is not available here (run `pip install -r requirements-ai-framing.txt`): "
    + (done ? `it ran on ${done}, the rest were` : "the clips were") + " rendered with the default framing";
  return `AI Framing ran on ${done} of ${rows.length}` + (notes.length ? ` (${notes[0]})` : "");
}

/* The body of the plan dialog: what will be rendered (each clip with its format), what cannot be, the estimate,
   a way to change the format before it is too late, and the AI Framing choice. */
function bulkPlanBody(plan, eligible) {
  const box = document.createElement("div");
  box.className = "bulk-plan";
  const add = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; e.textContent = text; box.append(e); return e; };
  add("p", "bulk-plan-sum", `${plan.items.length} clip${plan.items.length === 1 ? "" : "s"} · ${bulkFmtTime(plan.totalDuration)} of video · `
    + `about ${bulkFmtTime(plan.estimateSeconds)} to render (${plan.estimateHow})`);
  const rows = bulkRows();
  const ul = document.createElement("ul");
  ul.className = "bulk-plan-list";
  for (const it of plan.items) {
    const li = document.createElement("li");
    const fmt = rows.find((r) => r.id === it.result)?.format || it.layout;
    li.textContent = `${it.title} — ${Math.round(it.duration)}s · ${fmt}`;
    ul.append(li);
  }
  box.append(ul);
  const formats = new Set(plan.items.map((it) => rows.find((r) => r.id === it.result)?.format));
  const fmtRow = document.createElement("div");
  fmtRow.className = "bulk-plan-fmt";
  const fmtBtn = document.createElement("button");
  fmtBtn.type = "button";
  fmtBtn.className = "btn quiet";
  fmtBtn.textContent = "Output format…";
  fmtBtn.addEventListener("click", () => {
    box.dataset.changeFormat = "1";
    box.closest("dialog")?.querySelector(".confirm-cancel")?.click();      // close this, change the format, plan again
  });
  fmtRow.append(fmtBtn, document.createTextNode(formats.size > 1
    ? ` These clips are not all the same shape (${[...formats].join(", ")}).`
    : ` Every clip is ${[...formats][0] || "the default"}. Change it before rendering if that is not what you want.`));
  box.append(fmtRow);
  if (plan.refused.length) {
    add("p", "bulk-plan-bad", `${plan.refused.length} cannot be rendered and will be left out:`);
    const bad = document.createElement("ul");
    bad.className = "bulk-plan-list bad";
    for (const r of plan.refused) {
      const li = document.createElement("li");
      li.textContent = `${r.title} — ${r.message}`;
      bad.append(li);
    }
    box.append(bad);
  }
  const label = document.createElement("label");
  label.className = "bulk-plan-ai";
  const check = document.createElement("input");
  check.type = "checkbox";
  check.id = "bulkPlanAi";
  label.append(check, document.createTextNode(" Run AI Framing first for clips without framing"));
  const sub = document.createElement("span");
  sub.className = "bulk-plan-sub";
  sub.textContent = eligible
    ? `${eligible} of these clip${eligible === 1 ? " has" : "s have"} no framing yet: AI Framing finds who is speaking and frames them (slower; off by default).`
    : "Every clip here already has its framing.";
  label.append(document.createElement("br"), sub);
  check.disabled = !eligible;
  box.append(label);
  return box;
}

let bulkBusy = false;

$("#bulkRenderBtn")?.addEventListener("click", async () => {
  if (bulkBusy || renderJobId !== null) return;
  const ids = bulkRows().filter((r) => BULK_TICKED.has(r.id)).map((r) => r.id);
  if (!ids.length) return;
  bulkBusy = true;
  const btn = $("#bulkRenderBtn");
  const label = btn.textContent;
  btn.disabled = true;
  btn.textContent = "Checking…";
  try {
    for (;;) {                                    // again after the format was changed from the plan dialog
      // The server looks at the SAVED project, so what is on screen is saved first
      const saved = (typeof writeProjectNow === "function") ? await writeProjectNow() : true;
      if (!saved || !activeProjectId) { $("#editNote").textContent = "The project could not be saved: nothing was rendered."; return; }
      let plan;
      try {
        plan = await (await fetch("/api/render/plan", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ project: activeProjectId, results: ids }),
        })).json();
      } catch { $("#editNote").textContent = "Rendering needs the backend. Run: python -m klipian serve"; return; }
      if (plan.error) { $("#editNote").textContent = plan.error; return; }
      if (!plan.items.length) {
        await confirmDialog({
          title: "Nothing can be rendered", confirmText: "OK", cancelText: "Close", tone: "primary",
          message: plan.refused.map((r) => `${r.title}: ${r.message}`).join("\n"),
        });
        return;
      }
      const rows = bulkRows();
      const eligible = rows.filter((r) => plan.items.some((i) => i.result === r.id) && !r.framed).length;
      const body = bulkPlanBody(plan, eligible);
      const go = await confirmDialog({
        title: `Render ${plan.items.length} clip${plan.items.length === 1 ? "" : "s"}?`, body, tone: "primary",
        confirmText: `Render ${plan.items.length}`,
      });
      if (!go && body.dataset.changeFormat) {
        await bulkOutputDialog(plan.items.map((i) => i.result));
        continue;
      }
      if (!go) return;
      const withAi = !!body.querySelector("#bulkPlanAi")?.checked;
      const okIds = plan.items.map((i) => i.result);
      const aiNote = withAi ? await bulkAiFraming(okIds) : "";
      await renderSavedResults(okIds, { note: aiNote });
      return;
    }
  } finally {
    bulkBusy = false;
    btn.textContent = label;
    renderAllResults();
  }
});

renderAllResults();
