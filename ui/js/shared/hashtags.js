/* klipian — where a clip's hashtags go on YouTube (shared by the editor and /workspace)
   ==========================================================================
   The same logic as klipian/hashtags.py (the server applies it when a clip is uploaded; this
   is the preview and the Render screen's "Copy"). The selftest runs both on the same cases and
   requires the same answers: change one, change the other.

   hashtagPlan(title, description, hashtags, settings) -> { title, description, tags }
   settings: { placement: "title" | "description" | "both", shorts: bool, titleTags: 2 | 3 }
   `hashtags` is the row's list, or null/[] for an old row (they are read back out of the
   description's hashtag-only lines).
   ========================================================================== */

const HASHTAG_TITLE_MAX = 100;
const HASHTAG_MAX_TAGS = 15;

function normTag(tag) {
  return [...String(tag ?? "").trim().replace(/^#+/, "").toLowerCase()]
    .filter((c) => /[\p{L}\p{N}_]/u.test(c)).join("");
}

function normTags(tags, cap = HASHTAG_MAX_TAGS) {
  const out = [];
  for (const t of tags || []) {
    const n = normTag(t);
    if (n && !out.includes(n)) out.push(n);
    if (out.length >= cap) break;
  }
  return out;
}

function splitDescription(description) {
  const tags = [];
  const kept = [];
  for (const line of String(description ?? "").split(/\r?\n/)) {
    const t = line.trim();
    if (t && /^(?:#[\p{L}\p{N}_]+[\s,]*)+$/u.test(t)) {
      for (const m of t.matchAll(/#([\p{L}\p{N}_]+)/gu)) tags.push(m[1]);
    } else {
      kept.push(line);
    }
  }
  const text = kept.map((l) => l.replace(/\s+$/, "")).join("\n").replace(/\n{3,}/g, "\n\n").trim();
  return { tags, text };
}

function hashtagSettings(raw) {
  raw = raw || {};
  return {
    placement: ["title", "description", "both"].includes(raw.placement) ? raw.placement : "title",
    shorts: !!raw.shorts,
    titleTags: raw.titleTags === 2 ? 2 : 3,
  };
}

/* The profile's settings as the page knows them (profile-ui.js keeps the profile's defaults). */
function profileHashtagSettings() {
  let d = {};
  try { d = (window.PROFILE_META?.defaults) || JSON.parse(sessionStorage.getItem("klipian:profile-meta") || "{}").defaults || {}; }
  catch { d = {}; }
  return hashtagSettings({ placement: d.hashtagPlacement, shorts: d.addShorts, titleTags: d.titleTags });
}

function hashtagPlan(title, description, hashtags, settings) {
  const s = hashtagSettings(settings);
  title = String(title ?? "").split(/\s+/).filter(Boolean).join(" ");
  description = String(description ?? "");
  const { tags: own, text: without } = splitDescription(description);
  const tags = normTags(hashtags && hashtags.length ? hashtags : own);
  const apiTags = tags.concat(s.shorts && !tags.includes("shorts") ? ["shorts"] : []);
  if (s.placement === "description") return { title, description, tags: apiTags };
  const present = new Set([...title.matchAll(/#([\p{L}\p{N}_]+)/gu)].map((m) => normTag(m[1])));
  const chosen = tags.slice(0, s.titleTags).concat(s.shorts ? ["shorts"] : []);
  let final = title;
  for (const t of chosen) {
    if (present.has(t)) continue;
    if ([...final].length + 1 + [...t].length + 1 > HASHTAG_TITLE_MAX) break;
    final += ` #${t}`;
    present.add(t);
  }
  return { title: final, description: s.placement === "both" ? description : without, tags: apiTags };
}

/* "" when the title this profile wants fits 100 characters, else a sentence (hashtags.py,
   title_warning). Looks at the title WITH all the tags the profile wants in it. */
function hashtagWarning(title, hashtags, settings) {
  const s = hashtagSettings(settings);
  title = String(title ?? "").split(/\s+/).filter(Boolean).join(" ");
  const len = [...title].length;
  if (s.placement === "description") {
    return len > HASHTAG_TITLE_MAX ? `The title is ${len} characters; YouTube allows ${HASHTAG_TITLE_MAX}: shorten the title.` : "";
  }
  const tags = normTags(hashtags);
  const present = new Set([...title.matchAll(/#([\p{L}\p{N}_]+)/gu)].map((m) => normTag(m[1])));
  const wanted = tags.slice(0, s.titleTags).concat(s.shorts ? ["shorts"] : []).filter((t) => !present.has(t));
  const full = len + wanted.reduce((n, t) => n + 2 + [...t].length, 0);
  return full > HASHTAG_TITLE_MAX
    ? `The final YouTube title would be ${full} characters (YouTube allows ${HASHTAG_TITLE_MAX}): shorten the title or the hashtags.` : "";
}

if (typeof module !== "undefined") module.exports = { hashtagPlan, hashtagWarning, hashtagSettings, normTag, normTags, splitDescription };
