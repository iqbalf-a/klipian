/* The upload marks per platform (ui/js/workspace/uploads.js): node tests/uploads.test.js */
const assert = require("assert");
const { UPLOAD_PLATFORMS, uploadOf, uploadChipText, UPLOAD_FILTERS, matchesUploadFilter } = require("../ui/js/workspace/uploads.js");

let n = 0;
const eq = (got, want, what) => { n++; assert.deepStrictEqual(got, want, `${what}: got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`); };
const v = (yt, tt, ig) => ({ uploadsView: { youtube: { state: yt }, tiktok: { state: tt }, instagram: { state: ig } } });

const gurita = v("done", "none", "none"), sched = v("scheduled", "done", "none");
eq(uploadOf({}, "tiktok").state, "none", "a clip with no view is not uploaded anywhere");
eq(UPLOAD_PLATFORMS.map((p) => uploadChipText(gurita, p)), ["YT Sudah", "TT Belum", "IG Belum"], "chip text is words");
eq(uploadChipText(sched, UPLOAD_PLATFORMS[0]), "YT Terjadwal", "scheduled has its own word");

eq(matchesUploadFilter(gurita, ""), true, "no filter keeps all");
eq(matchesUploadFilter(gurita, "tiktok:none"), true, "gurita is not on TikTok");
eq(matchesUploadFilter(gurita, "youtube:none"), false, "gurita is on YouTube");
eq(matchesUploadFilter(gurita, "youtube:done"), true, "uploaded on YouTube");
eq(matchesUploadFilter(sched, "youtube:none"), true, "scheduled is not uploaded yet");
eq(matchesUploadFilter(sched, "youtube:done"), false, "scheduled is not 'Sudah'");
eq(matchesUploadFilter(sched, "tiktok:done"), true, "TikTok done");
eq(UPLOAD_FILTERS.length, 7, "all + 3 platforms x 2");
console.log(`uploads: ${n} checks ok`);
