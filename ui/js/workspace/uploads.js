/* Where a clip is uploaded, per platform (YouTube, TikTok, Instagram), as pure rules (no DOM).
   The server derives clip.uploadsView = {youtube|tiktok|instagram: {state, date, time, url}} (schedule.uploads_of);
   used by js/workspace/clips.js and tested by node tests/uploads.test.js. */

const UPLOAD_PLATFORMS = [{ key: "youtube", short: "YT", name: "YouTube" }, { key: "tiktok", short: "TT", name: "TikTok" }, { key: "instagram", short: "IG", name: "Instagram" }];
const UPLOAD_STATE_TEXT = { none: "Not uploaded", scheduled: "Scheduled", done: "Uploaded" };
const UPLOAD_STATE_SHORT = { none: "Not yet", scheduled: "Scheduled", done: "Uploaded" };

const uploadOf = (clip, key) => (clip.uploadsView && clip.uploadsView[key]) || { state: "none", date: "", time: "", url: "" };

// the text of a chip: the state is in words, never only a colour
const uploadChipText = (clip, p) => `${p.short} ${UPLOAD_STATE_SHORT[uploadOf(clip, p.key).state]}`;

// the filter values: "" (all), "<platform>:none" (not uploaded there), "<platform>:done" (uploaded there)
const UPLOAD_FILTERS = [["", "All uploads"], ...UPLOAD_PLATFORMS.flatMap((p) => [[`${p.key}:none`, `Not uploaded to ${p.name}`], [`${p.key}:done`, `Uploaded to ${p.name}`]])];

function matchesUploadFilter(clip, filter) {
  if (!filter) return true;
  const [key, want] = filter.split(":");
  const state = uploadOf(clip, key).state;
  return want === "done" ? state === "done" : state !== "done";          // "not uploaded" includes scheduled: it is not up yet
}

if (typeof module !== "undefined" && module.exports) Object.assign(module.exports, { UPLOAD_PLATFORMS, UPLOAD_STATE_TEXT, uploadOf, uploadChipText, UPLOAD_FILTERS, matchesUploadFilter });
