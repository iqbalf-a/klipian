/* Where a clip is uploaded, per platform (YouTube, TikTok, Instagram), as pure rules (no DOM).
   The server derives clip.uploadsView = {youtube|tiktok|instagram: {state, date, time, url}} (schedule.uploads_of);
   used by js/workspace/clips.js and tested by node tests/uploads.test.js. */

const UPLOAD_PLATFORMS = [{ key: "youtube", short: "YT", name: "YouTube" }, { key: "tiktok", short: "TT", name: "TikTok" }, { key: "instagram", short: "IG", name: "Instagram" }];
const UPLOAD_STATE_TEXT = { none: "Belum diupload", scheduled: "Terjadwal", done: "Sudah diupload" };
const UPLOAD_STATE_SHORT = { none: "Belum", scheduled: "Terjadwal", done: "Sudah" };

const uploadOf = (clip, key) => (clip.uploadsView && clip.uploadsView[key]) || { state: "none", date: "", time: "", url: "" };

// the text of a chip: the state is in words, never only a colour
const uploadChipText = (clip, p) => `${p.short} ${UPLOAD_STATE_SHORT[uploadOf(clip, p.key).state]}`;

// the filter values: "" (all), "<platform>:none" (not uploaded there), "<platform>:done" (uploaded there)
const UPLOAD_FILTERS = [["", "Semua upload"], ...UPLOAD_PLATFORMS.flatMap((p) => [[`${p.key}:none`, `Belum diupload di ${p.name}`], [`${p.key}:done`, `Sudah diupload di ${p.name}`]])];

function matchesUploadFilter(clip, filter) {
  if (!filter) return true;
  const [key, want] = filter.split(":");
  const state = uploadOf(clip, key).state;
  return want === "done" ? state === "done" : state !== "done";          // "not uploaded" includes scheduled: it is not up yet
}

if (typeof module !== "undefined" && module.exports) Object.assign(module.exports, { UPLOAD_PLATFORMS, UPLOAD_STATE_TEXT, uploadOf, uploadChipText, UPLOAD_FILTERS, matchesUploadFilter });
