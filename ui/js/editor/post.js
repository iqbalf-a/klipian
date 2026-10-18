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

function updatePostCount() {
  const n = ($("#postTitle")?.value || "").trim().length;
  const el = $("#postTitleCount");
  if (el) {
    el.textContent = `${n} / ${POST_TITLE_MAX}`;
    el.dataset.over = String(n > POST_TITLE_MAX);
  }
}

function setPostFields(post) {
  const p = post || {};
  if ($("#postTitle")) $("#postTitle").value = p.title || "";
  if ($("#postCaption")) $("#postCaption").value = p.caption || "";
  if ($("#postTags")) $("#postTags").value = (p.hashtags || []).join(" ");
  updatePostCount();
}

const clearPostFields = () => setPostFields(null);

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
  return [p.caption || "", (p.hashtags || []).join(" "), postCreditLines]
    .filter(Boolean).join("\n\n");
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

document.querySelectorAll("[data-post-copy]").forEach((btn) => {
  btn.addEventListener("click", async () => {
    const kind = btn.dataset.postCopy;
    const post = currentPost() || { title: "", caption: "", hashtags: [] };
    const text = kind === "title" ? post.title
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

updatePostCount();
