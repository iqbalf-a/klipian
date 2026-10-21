/* klipian — post text: what you paste when you upload a clip
   ==========================================================================
   Title, caption and hashtags of a Result, for the platform it is posted on.
   NOT the captions burned into the video (those are subtitles, Captions screen):
   this is the text that goes beside the video.

   It belongs to the RESULT, saved with it (`post`: { title, caption, hashtags[] },
   left out when empty). Claude can write it in the same reply that finds the
   clips (roundtrip.py: `post` per clip); adding such a suggestion to the Result
   brings it along. Everything here can be edited and is the person's own after.

   The credit line under the description is NOT typed or written by Claude: it is
   built by the server from the Sources panel's credit of each video the Result
   uses (credits.py), and only previewed here.

   postDescription() is the same text the server stores in the upload schedule
   (credits.description) -- change one, change the other.
   ========================================================================== */

const POST_TITLE_MAX = 70;
let postCreditLines = "";          // the credit line(s) of the videos this Result uses

/* "#a #b, c" -> ["#a", "#b", "#c"]: the same rules as roundtrip._hashtags. */
function parseTags(text) {
  const seen = new Set();
  const out = [];
  for (const item of String(text || "").split(/[\s,]+/)) {
    const tag = item.replace(/[^\p{L}\p{N}_]/gu, "");
    if (tag && !seen.has(tag.toLowerCase())) { seen.add(tag.toLowerCase()); out.push(`#${tag}`); }
  }
  return out;
}

/* The post text as the fields hold it, or null when all three are empty. */
function currentPost() {
  const title = ($("#postTitle")?.value || "").trim();
  const caption = ($("#postCaption")?.value || "").trim();
  const hashtags = parseTags($("#postTags")?.value);
  return (title || caption || hashtags.length) ? { title, caption, hashtags } : null;
}

/* The title as it will be on YouTube under this profile's hashtag rule (hashtags.js, the same
   logic the upload uses), and a warning when it would not fit 100 characters -- before the render. */
function updatePostPreview() {
  const box = $("#postFinalTitle");
  if (!box) return;
  const title = ($("#postTitle")?.value || "").trim();
  const tags = parseTags($("#postTags")?.value);
  const s = profileHashtagSettings();
  const plan = hashtagPlan(title, "", tags, s);
  box.textContent = plan.title || "(no title yet)";
  const count = $("#postFinalCount");
  if (count) count.textContent = `${[...plan.title].length} / 100`;
  const warn = $("#postWarn");
  if (warn) {
    const text = title ? hashtagWarning(title, tags, s) : "";
    warn.textContent = text;
    warn.hidden = !text;
  }
}

function updatePostCount() {
  const n = ($("#postTitle")?.value || "").trim().length;
  const el = $("#postTitleCount");
  if (el) {
    el.textContent = `${n} / ${POST_TITLE_MAX}`;
    el.dataset.over = String(n > POST_TITLE_MAX);
  }
  updatePostPreview();
}

/* WHICH Result the Post text panel is showing. The panel is one set of fields
   for whichever Result is open, so what it holds is only ever right for one
   Result; saving it into another would hand that Result somebody else's text
   (a Result that got the previous one's post and angle). Set whenever the fields
   are filled; checked by syncPostAngleToActive() before anything is saved. */
let postOwner = null;
const currentOwner = () => (typeof activeResultId !== "undefined" ? activeResultId : null);

function setPostFields(post) {
  postOwner = currentOwner();
  const p = post || {};
  if ($("#postTitle")) $("#postTitle").value = p.title || "";
  if ($("#postCaption")) $("#postCaption").value = p.caption || "";
  if ($("#postTags")) $("#postTags").value = (p.hashtags || []).join(" ");
  updatePostCount();
}

const clearPostFields = () => setPostFields(null);

/* Before a Result is written (snapshotActiveResult), make sure the Post text and
   Angle panels belong to it. If they were filled for another Result they are
   filled again from THIS one's saved data (empty when it has none) -- never saved
   over it. Returns true when it had to correct them. */
function syncPostAngleToActive(slot) {
  const id = currentOwner();
  let fixed = false;
  if (postOwner !== id) { setPostFields(slot.post); fixed = true; }
  if (typeof angleOwner !== "undefined" && angleOwner !== id && typeof setAngleFields === "function") {
    setAngleFields(slot.angle); fixed = true;
  }
  return fixed;
}

/* The suggestion that this Result was made from: the one that has `key` ("post" or
   "angle") and overlaps the Result's moments the most, its first moment counting
   a little more. null when none does. */
function suggestionForResult(key) {
  const cands = (typeof DATA !== "undefined" && DATA.candidates) || [];
  const off = (typeof activeAssetOffset === "function") ? activeAssetOffset() : 0;
  let best = null, bestScore = 0;
  for (const k of cands) {
    if (!k?.[key]) continue;
    RESULT.forEach((r, i) => {
      const overlap = Math.min(r.end, k.endSec + off) - Math.max(r.start, k.startSec + off);
      const score = overlap * (i === 0 ? 1.01 : 1);
      if (overlap > 0 && score > bestScore) { best = k; bestScore = score; }
    });
  }
  return best;
}

/* "Refill from suggestion": fill the panel from the suggestion this Result came
   from. Two clicks when something is already written (the first says so). */
function armRefill(btn, key, filled, apply, note) {
  clearTimeout(btn._armTimer);
  const label = btn.dataset.label || btn.textContent;
  btn.dataset.label = label;
  const k = suggestionForResult(key);
  if (!k) { note(`No suggestion with ${key === "post" ? "post text" : "an angle"} overlaps this Result's moments.`); return; }
  if (filled && !btn.classList.contains("danger")) {
    btn.textContent = "Replace what is written?";
    btn.classList.add("danger");
    btn._armTimer = setTimeout(() => { btn.textContent = label; btn.classList.remove("danger"); }, 4000);
    return;
  }
  btn.textContent = label;
  btn.classList.remove("danger");
  apply(k);
  note(`Filled from the suggestion "${k.title}".`);
}

/* A suggestion's post text moves into the Result when it is added -- the first
   one that has any, and only into an empty Result text (a manual range brings
   nothing, and nothing already written is replaced). */
function carryPostFrom(candidates) {
  if (currentPost()) return;
  const first = candidates.find((k) => k?.post);
  if (!first) return;
  setPostFields(first.post);
  if (typeof saveProject === "function") saveProject();
}

/* The block under the video: caption, hashtags, credit, each only if there is
   one, with a blank line between. */
function postDescription(post = currentPost()) {
  const p = post || {};
  const whole = [p.caption || "", (p.hashtags || []).join(" "), postCreditLines]
    .filter(Boolean).join("\n\n");
  // Where the hashtags go is the profile's choice (hashtags.js): in the title, in the
  // description, or both. What is copied here is what an upload would send.
  return hashtagPlan(p.title || "", whole, p.hashtags, profileHashtagSettings()).description;
}

/* The title as it would be on YouTube (with its hashtags, when the profile puts them there). */
function postTitleForCopy(post = currentPost()) {
  const p = post || {};
  return hashtagPlan(p.title || "", "", p.hashtags, profileHashtagSettings()).title;
}

/* The credit line(s) of the videos this Result is cut from, as the server builds
   them. Refreshed whenever the Result changes or the screen is opened (the credit
   is edited on the dashboard, another page). */
async function refreshPostCredit() {
  const box = $("#postCredit");
  if (!box) return;
  const files = [...new Set((typeof RESULT !== "undefined" ? RESULT : []).map((r) => toReal(r.start).file).filter(Boolean))];
  let credit = {};
  try { credit = (await (await fetch("/api/credits")).json()).credit || {}; } catch { /* no backend */ }
  const lines = [];
  for (const f of files) {
    const line = credit[f]?.line;
    if (line && !lines.includes(line)) lines.push(line);
  }
  postCreditLines = lines.join("\n");
  box.innerHTML = lines.length
    ? lines.map((l) => `<span>${escapeHTML(l)}</span>`).join("")
    : `<span class="none">No source credit yet.</span>`;
  const edit = $("#postCreditEdit");
  if (edit) edit.textContent = lines.length ? "edit" : "add one";
}

/* ---------- wiring ---------- */

["#postTitle", "#postCaption", "#postTags"].forEach((sel) => {
  $(sel)?.addEventListener("input", () => {
    updatePostCount();
    if (typeof saveProject === "function") saveProject();
  });
});

$("#postRefill")?.addEventListener("click", (e) => {
  armRefill(e.currentTarget, "post", !!currentPost(), (k) => {
    setPostFields(k.post);
    if (typeof saveProject === "function") saveProject();
  }, (t) => { if ($("#postNote")) $("#postNote").textContent = t; });
});

document.querySelectorAll("[data-post-copy]").forEach((btn) => {
  btn.addEventListener("click", async () => {
    const kind = btn.dataset.postCopy;
    const post = currentPost() || { title: "", caption: "", hashtags: [] };
    const text = kind === "title" ? postTitleForCopy(post)
      : kind === "hashtags" ? post.hashtags.join(" ")
      : postDescription(post);
    const note = $("#postNote");
    if (!text) {
      if (note) note.textContent = `Nothing to copy: the ${kind === "description" ? "description" : kind} is empty.`;
      return;
    }
    const ok = await copyText(text);
    if (note) {
      note.textContent = ok
        ? `Copied the ${kind} · ${text.length} characters`
        : `Could not copy the ${kind}. Select the text and copy it by hand.`;
    }
    if (!ok) return;
    const label = btn.dataset.label || btn.textContent;
    btn.dataset.label = label;
    btn.textContent = "Copied";
    clearTimeout(btn._copiedTimer);
    btn._copiedTimer = setTimeout(() => { btn.textContent = label; }, 2000);
  });
});

/* ---------- the post text written with Claude in the chat (no API key) ----------
   "Copy brief for this Result": the server builds a short brief of THIS clip (klipian/roundtrip.py
   build_result_brief) from the saved project: this page assembles no text. "Paste reply…": the reply goes to the server
   (the same reader and repairs as the main import), and its fields fill the Result's title, post text and angle,
   asking first when something is already written; the Undo toast puts all of it back. */

const postAiNote = (text, bad = false) => {
  const el = $("#postAiNote");
  if (el) { el.textContent = text; el.dataset.error = String(bad); }
};

async function resultBriefUrl() {
  const saved = (typeof writeProjectNow === "function") ? await writeProjectNow() : true;
  if (!saved || !activeProjectId) throw new Error("The project could not be saved, so the brief cannot be made.");
  const mode = (typeof briefRubric !== "undefined" && briefRubric) ? `&mode=${encodeURIComponent(briefRubric)}` : "";
  return `/api/result-brief?project=${encodeURIComponent(activeProjectId)}&result=${encodeURIComponent(activeResultId)}${mode}`;
}

async function fetchResultBrief() {
  const res = await fetch(await resultBriefUrl());
  if (!res.ok) {
    const d = await res.json().catch(() => ({}));
    throw new Error(d.error || "Could not build the brief for this Result.");
  }
  return res.text();
}

$("#postBriefCopy")?.addEventListener("click", async (e) => {
  const btn = e.currentTarget;
  btn.disabled = true;
  postAiNote("Building the brief…");
  try {
    const pending = fetchResultBrief();
    pending.catch(() => {});
    let wrote = false;
    // a clipboard write that comes after a long wait can be refused: hand the clipboard the promise
    if (window.ClipboardItem && navigator.clipboard?.write) {
      try {
        await navigator.clipboard.write([new ClipboardItem({ "text/plain": pending.then((t) => new Blob([t], { type: "text/plain" })) })]);
        wrote = true;
      } catch { /* fall back below, unless the brief itself failed */ }
    }
    const text = await pending;
    if (!wrote && !(await copyText(text))) throw new Error("the browser refused to copy: use Download instead");
    postAiNote(`Copied · ${(text.length / 1024).toFixed(1)} KB · paste it into Claude, then press Paste reply…`);
  } catch (err) {
    postAiNote(err.message, true);
  } finally {
    btn.disabled = false;
  }
});

$("#postBriefDownload")?.addEventListener("click", async () => {
  try {
    const text = await fetchResultBrief();
    const name = ($("#resultTitle")?.value.trim() || "result").replace(/[^\p{L}\p{N}_-]+/gu, "-").replace(/^-+|-+$/g, "") || "result";
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type: "text/markdown" }));
    a.download = `post-brief-${name}.md`;
    a.click();
    URL.revokeObjectURL(a.href);
    postAiNote(`File downloaded · ${(text.length / 1024).toFixed(1)} KB`);
  } catch (err) {
    postAiNote(err.message, true);
  }
});

/* The fields as they are now, in the shape postReplyPlan() reads. */
const postFieldsNow = () => ({ title: $("#resultTitle")?.value.trim() || "", post: currentPost(), angle: currentAngle() });

function applyPostFields(f) {
  if ($("#resultTitle")) $("#resultTitle").value = f.title || "";
  setPostFields(f.post);
  setAngleFields(f.angle);
  if (typeof snapshotActiveResult === "function") snapshotActiveResult();
  if (typeof renderResultSwitcher === "function") renderResultSwitcher();
  if (typeof saveProject === "function") saveProject();
}

async function askForReply(text = "") {
  const body = document.createElement("div");
  const area = Object.assign(document.createElement("textarea"), { rows: 10, spellcheck: false, value: text,
    placeholder: "Paste Claude's reply here (the whole message is fine: the JSON block is found in it)" });
  area.className = "post-reply-text";
  body.append(area);
  const ok = await confirmDialog({
    title: "Paste Claude's reply", message: "It fills this Result's title, the post text and the angle.",
    body, confirmText: "Read the reply", tone: "primary",
  });
  return ok ? area.value : null;
}

$("#postReplyPaste")?.addEventListener("click", async () => {
  let text = await askForReply();
  let reply = null;
  while (text !== null) {
    if (!text.trim()) { postAiNote("Nothing was pasted.", true); return; }
    try {
      const saved = (typeof writeProjectNow === "function") ? await writeProjectNow() : true;
      if (!saved || !activeProjectId) { postAiNote("The project could not be saved, so the reply cannot be read.", true); return; }
      const res = await fetch("/api/result-reply", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project: activeProjectId, result: activeResultId, text }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || d.error) throw new Error(d.error || "Could not read that reply.");
      reply = d;
      break;
    } catch (err) {
      postAiNote(err.message, true);
      text = await askForReply(text);                  // the text stays, so it can be fixed
    }
  }
  if (!reply) return;
  const before = postFieldsNow();
  const plan = postReplyPlan(before, reply);
  if (plan.conflicts.length) {
    const list = document.createElement("ul");
    list.className = "bulk-plan-list";
    for (const c of plan.conflicts) { const li = document.createElement("li"); li.textContent = c; list.append(li); }
    const go = await confirmDialog({ title: "Replace what is written?", message: "These already have text and would be replaced:",
      body: list, confirmText: "Replace", tone: "primary" });
    if (!go) { postAiNote("Nothing was changed."); return; }
  }
  applyPostFields(plan.next);
  const rendered = (typeof SAVED_RESULTS !== "undefined" ? SAVED_RESULTS : []).find((r) => r.id === activeResultId)?.renderedAt;
  const warn = $("#postWarn") && !$("#postWarn").hidden ? ` · ${$("#postWarn").textContent}` : "";
  postAiNote(`Filled from Claude's reply: title, post text and angle${reply.notes?.length ? ` (fixed in the reply: ${reply.notes.join("; ")})` : ""}`
    + warn + (rendered ? " · This Result was rendered before: its upload-schedule row takes the new text at the next render." : "") + ".");
  if (typeof undoForResult === "function") undoForResult("Post text filled from Claude's reply", () => { applyPostFields(before); postAiNote("Put back what was there."); });
});

updatePostCount();
