/* The steps of a video on the /remotion page (ui/js/remotion/steps.js): node tests/steps.test.js */
const assert = require("assert");
const S = require("../ui/js/remotion/steps.js");
const { narrationFile, narrationCopyText } = require("../ui/js/remotion/narration.js");

let n = 0;
const eq = (got, want, what) => { n++; assert.deepStrictEqual(got, want, `${what}: got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`); };

// the order: video baru, brief, story (the folder, or the AI's answer), facts and title, the voice script, the voice, the preview, the render
eq(S.stepsFor("custom").map((s) => s.id), ["new", "brief", "story", "facts", "script", "voice", "preview", "render"], "Khusus: the steps in order");
eq(S.stepsFor("template").map((s) => s.id), ["new", "brief", "answer", "facts", "script", "voice", "preview", "render"], "Otomatis: the AI's answer takes the place of the folder");
eq(S.stepsFor("custom").map((s) => s.num), [1, 2, 3, 4, 5, 6, 7, 8], "numbered 1 to 8");
eq(S.stepNum("custom", "render"), 8, "the render is step 8");
eq(S.stepNum("custom", "script") < S.stepNum("custom", "voice"), true, "the script for the voice app comes before the voice is imported");
eq(S.stepNum("custom", "preview") < S.stepNum("custom", "render"), true, "the preview comes before the final render");
eq(S.stepNum("custom", "answer"), "", "Khusus has no answer step");

// the active step follows the server's next step
const d = (key, over = {}) => ({ kind: "custom", next: { key }, briefAt: 1, renderBlock: { state: "menunggu", reasons: [] }, ...over });
eq(S.activeStepFor(d("folder", { briefAt: null })), "brief", "no brief copied yet: the brief");
eq(S.activeStepFor(d("folder")), "story", "the brief copied: the folder");
eq(S.activeStepFor(d("take")), "story", "take the story");
eq(S.activeStepFor(d("retake")), "story", "take it again");
eq(S.activeStepFor(d("take", { kind: "template" })), "answer", "Otomatis: the answer");
eq(S.activeStepFor(d("paste", { kind: "template" })), "answer", "paste the answer");
eq(["fix", "facts", "title"].map((k) => S.activeStepFor(d(k))), ["facts", "facts", "facts"], "claims and title: the facts step");
eq(S.activeStepFor(d("align")), "voice", "match the voice");
eq(S.activeStepFor(d("render")), "render", "render");
eq(S.activeStepFor(d("clips")), "render", "a current render: the render step");
eq(S.activeStepFor(d("blocked", { renderBlock: { reasons: ["Cerita di folder berubah: ambil ulang cerita dulu."] } })), "story", "blocked by a changed folder: the story step");
eq(S.activeStepFor(d("blocked", { renderBlock: { reasons: ["Suara belum dicocokkan dengan narasi: cocokkan dulu."] } })), "voice", "blocked by the voice: the voice step");
eq(S.activeStepFor(d("blocked", { renderBlock: { reasons: ["Klaim 2 belum dicek."] } })), "facts", "blocked by a claim: the facts step");

// the length: the voiced one when there is a voice, with a decimal comma
eq(S.fmtSeconds(53.3), "53,3", "a decimal comma");
eq(S.fmtSeconds(45), "45", "a whole number has no decimals");
eq(S.lengthText({ planned: 45, voiced: 53.3, seconds: 53.3 }), "53,3 detik (suara)", "the voiced length is shown, marked as the voice's");
eq(S.lengthText({ planned: 45, voiced: null, seconds: 45 }), "45 detik", "the planned length when there is no voice");

// the story's words in Indonesian
eq(["hook", "sting", "loose", "result", "tips", "normal"].map(S.kindLabel), ["Pembuka", "Intip yuk!", "Kasus longgar", "Hasil", "Tips", "Penjelasan"], "the beat kinds");
eq(["banner", "badge", "pill", "label"].map(S.itemLabel), ["Spanduk", "Lencana", "Pil", "Label"], "the item types");
eq(S.kindLabel("nonsense"), "nonsense", "an unknown word is shown as it is");
for (const raw of ["banner", "badge", "pill", "hook", "sting", "loose", "result"]) eq([...Object.values(S.BEAT_KIND_LABEL), ...Object.values(S.ITEM_LABEL)].includes(raw), false, `the raw word ${raw} is not a label`);

// the summary of a folded step is one line; the states
const full = { kind: "custom", duration: 45, options: { loop: true, sting: true, music: "sunny", voiceTargets: ["voicestudio", "elevenlabs"] }, briefAt: 1790000000,
  story: { beats: new Array(8).fill({}) }, facts: [{ status: "checked" }, { status: "checked" }], title: "Judul", folder: { state: "cerita diambil" },
  length: { planned: 45, voiced: 53.3, seconds: 53.3 }, voice: { name: "suara.wav", duration: 53.3, aligned: true }, preview: { stale: false }, next: { key: "clips" }, renderBlock: { state: "selesai" } };
eq(S.stepSummary("story", full), "8 beat · 53,3 detik (suara)", "the story step shows the voiced length");
eq(S.stepSummary("facts", full), "2 klaim dicek · judul dipilih", "the facts step");
eq(S.stepSummary("voice", full), "suara.wav · 53,3 detik · sudah dicocokkan", "the voice step");
eq(S.stepSummary("render", full), "sudah dirender", "the render step");
eq(S.stepSummary("script", full), "voicestudio, elevenlabs", "the script step lists the apps");
eq(S.stepSummary("facts", { ...full, facts: [{ status: "checked" }, { status: "pending" }] }), "1 dari 2 klaim belum dicek · judul dipilih", "claims waiting");
eq(S.stepSummary("brief", full).includes("loop") && S.stepSummary("brief", full).includes("2 aplikasi suara"), true, "the brief step names the options");
eq(S.stepState("render", full), "aktif", "the render is the active step");
eq(S.stepState("facts", full), "selesai", "the facts are done");
eq(S.stepState("voice", { ...full, voice: null }), "opsional", "no voice: optional");
eq(S.stepState("story", { ...full, folder: { state: "folder berubah" }, next: { key: "retake" } }), "aktif", "a changed folder: the story step is the active one");
eq(S.stepState("story", { ...full, folder: { state: "folder berubah" } }), "usang", "a changed folder: the story is stale when it is not the active step");

// the voice texts: file names, and the copied text is the export's text only
eq(S.folderChip("folder berubah"), "folder berubah", "a changed folder shows its chip");
eq(S.folderChip("nonsense"), "belum dipilih", "an unknown state shows belum dipilih");
eq(narrationFile("v1", "voicestudio"), "v1-naskah-voicestudio.txt", "the whole text file");
eq([1, 2].map((p) => narrationFile("v1", "voicestudio", p)), ["v1-naskah-voicestudio_1.txt", "v1-naskah-voicestudio_2.txt"], "the parts: _1.txt, _2.txt");
eq(narrationCopyText({ text: "Kalimat satu.\nKalimat dua.", info: "Total sekitar 14 detik" }), "Kalimat satu.\nKalimat dua.", "the copied text is the text, never the info");
eq(narrationCopyText(null), "", "nothing loaded: nothing to copy");

console.log(`steps: ${n} checks ok`);
