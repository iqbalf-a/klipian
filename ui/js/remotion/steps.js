/* The steps of a video on the /remotion page, as pure rules (no DOM): their order per kind, which one is active (from the server's next step), the one-line
   summary a finished step shows when it is folded, the state of each step, and the Indonesian names of the story's words. Used by ui/js/remotion/page.js and
   tested by node tests/steps.test.js. The facts all come from the server's detail (klipian/motion.py: next, renderBlock, length); nothing here decides a rule. */

// the steps, in order. Khusus (the main flow): the story comes from the folder Claude Code made. Otomatis (hidden under "Pengaturan lanjutan"): the AI's answer is pasted.
const STEPS_CUSTOM = ["new", "brief", "story", "facts", "script", "voice", "preview", "render"];
const STEPS_TEMPLATE = ["new", "brief", "answer", "facts", "script", "voice", "preview", "render"];
const STEP_TITLE = {
  new: "Video baru", brief: "Brief", story: "Ambil cerita dari folder Claude Code", answer: "Jawaban AI dan storyboard", facts: "Cek fakta dan judul",
  script: "Naskah suara", voice: "Impor suara dan cocokkan", preview: "Pratinjau", render: "Render",
};

function stepsFor(kind) {
  const ids = kind === "custom" ? STEPS_CUSTOM : STEPS_TEMPLATE;
  return ids.map((id, i) => ({ id, num: i + 1, title: STEP_TITLE[id] }));
}

function stepNum(kind, id) {
  const found = stepsFor(kind).find((s) => s.id === id);
  return found ? found.num : "";
}

// the step that is active now: the one the server's next step belongs to. A blocked render names its reason, so the step that can fix it is the active one.
function activeStepFor(d) {
  if (!d) return "new";
  const custom = d.kind === "custom";
  const key = d.next && d.next.key;
  if (key === "folder") return d.briefAt ? "story" : "brief";
  if (key === "brief") return "brief";
  if (key === "paste") return "answer";
  if (key === "take" || key === "retake") return custom ? "story" : "answer";
  if (key === "fix" || key === "facts" || key === "title") return "facts";
  if (key === "align") return "voice";
  if (key === "blocked") {
    const why = ((d.renderBlock && d.renderBlock.reasons) || (d.gate || []))[0] || "";
    if (/folder/i.test(why)) return custom ? "story" : "answer";
    if (/suara|narasi/i.test(why)) return "voice";
    if (/klaim|judul/i.test(why)) return "facts";
    return "render";
  }
  return "render";
}

// the folder's chip: the state as the page shows it (the states are those of motion.folder_state)
const FOLDER_STATES = ["belum dipilih", "cerita belum diambil", "cerita diambil", "folder berubah", "folder tidak lengkap"];
function folderChip(state) {
  return FOLDER_STATES.includes(state) ? state : "belum dipilih";
}

// ---------------------------------------------------------------------------------------------------------------------------------------
// words and numbers
// ---------------------------------------------------------------------------------------------------------------------------------------

// seconds with a decimal comma, and a whole number without decimals: "53,3" and "45"
function fmtSeconds(s) {
  if (s == null || Number.isNaN(Number(s))) return "";
  const n = Number(s);
  return Number.isInteger(n) ? String(n) : n.toFixed(1).replace(".", ",");
}

// the length to show: the voiced length when a voice was matched (it is the real length of the video), else the planned one
function lengthText(length) {
  if (!length) return "";
  return length.voiced != null ? `${fmtSeconds(length.voiced)} detik (suara)` : `${fmtSeconds(length.planned)} detik`;
}

function dateText(t) {
  return t ? new Date(t * 1000).toLocaleDateString("id-ID", { day: "numeric", month: "short" }) : "";
}

// the names the person reads for the words of the story (the JSON keeps its own words)
const BEAT_KIND_LABEL = { hook: "Pembuka", sting: "Intip yuk!", lens: "Intip dalam", normal: "Penjelasan", loose: "Kasus longgar", result: "Hasil", tips: "Tips", outro: "Penutup" };
const ITEM_LABEL = { banner: "Spanduk", badge: "Lencana", pill: "Pil", label: "Label", headline: "Judul besar", source: "Sumber", stamp: "Cap" };
const kindLabel = (k) => BEAT_KIND_LABEL[k] || k;
const itemLabel = (t) => ITEM_LABEL[t] || t;

// ---------------------------------------------------------------------------------------------------------------------------------------
// the summary of a step, one line, from the detail
// ---------------------------------------------------------------------------------------------------------------------------------------

function optionsSummary(o) {
  if (!o) return "";
  const music = (typeof MUSIC_LABELS !== "undefined" && MUSIC_LABELS[o.music]) || o.music;
  const apps = (o.voiceTargets || []).length;
  return [o.loop ? "loop" : "tanpa loop", o.sting ? '"Intip yuk!"' : 'tanpa "Intip yuk!"', `musik ${music}`, `${apps} aplikasi suara`].join(", ");
}

function stepSummary(id, d) {
  if (!d) return "";
  const claims = d.facts || [];
  const open = claims.filter((c) => c.status !== "checked").length;
  const v = d.voice;
  if (id === "new") return `${d.duration} detik · ${d.kind === "custom" ? "Khusus" : "Otomatis"}`;
  if (id === "brief") return `${d.briefAt ? `disalin ${dateText(d.briefAt)}` : "belum disalin"} · ${optionsSummary(d.options)}`;
  if (id === "story" || id === "answer") {
    if (!d.story) return id === "story" ? (d.folder ? d.folder.state : "belum dipilih") : "belum ada jawaban";
    return `${d.story.beats.length} beat · ${lengthText(d.length)}${d.folder && d.folder.state === "folder berubah" ? " · folder berubah" : ""}`;
  }
  if (id === "facts") {
    if (!d.story) return "menunggu cerita";
    return `${claims.length ? (open ? `${open} dari ${claims.length} klaim belum dicek` : `${claims.length} klaim dicek`) : "tanpa klaim"} · ${d.title ? "judul dipilih" : "judul belum dipilih"}`;
  }
  if (id === "script") return d.story ? (d.options && d.options.voiceTargets || []).map((k) => (typeof VOICE_APP_LABELS !== "undefined" && VOICE_APP_LABELS[k]) || k).join(", ") : "menunggu cerita";
  if (id === "voice") {
    if (!v || !v.name) return "belum ada suara";
    return `${v.name} · ${fmtSeconds(v.duration)} detik · ${v.aligned ? "sudah dicocokkan" : v.stale ? "cocokkan lagi" : "belum dicocokkan"}`;
  }
  if (id === "preview") return d.preview ? (d.preview.stale ? "usang: buat lagi" : "siap") : "belum dibuat";
  if (id === "render") {
    const r = d.renderBlock || {};
    return { belum: "menunggu cerita", menunggu: "belum bisa dirender", siap: "siap dirender", selesai: "sudah dirender", usang: "render lama usang" }[r.state] || "";
  }
  return "";
}

// the state of a step for its chip: aktif (the step to do now), selesai, usang, menunggu, opsional
function stepState(id, d) {
  if (!d) return "menunggu";
  if (id === activeStepFor(d)) return "aktif";
  const v = d.voice, claimsOpen = (d.facts || []).some((c) => c.status !== "checked");
  if (id === "new") return "selesai";
  if (id === "brief") return d.briefAt || d.story ? "selesai" : "menunggu";
  if (id === "story" || id === "answer") return !d.story ? "menunggu" : d.folder && d.folder.state === "folder berubah" ? "usang" : "selesai";
  if (id === "facts") return !d.story ? "menunggu" : claimsOpen || !d.title ? "menunggu" : "selesai";
  if (id === "script") return d.story ? "opsional" : "menunggu";
  if (id === "voice") return v && v.name ? (v.aligned ? "selesai" : "menunggu") : "opsional";
  if (id === "preview") return d.preview ? (d.preview.stale ? "usang" : "selesai") : "opsional";
  if (id === "render") return { selesai: "selesai", usang: "usang" }[(d.renderBlock || {}).state] || "menunggu";
  return "menunggu";
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { STEPS_CUSTOM, STEPS_TEMPLATE, STEP_TITLE, stepsFor, stepNum, activeStepFor, FOLDER_STATES, folderChip, fmtSeconds, lengthText, dateText,
    BEAT_KIND_LABEL, ITEM_LABEL, kindLabel, itemLabel, optionsSummary, stepSummary, stepState };
}
