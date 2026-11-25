/* The steps of a video on the /remotion page, as pure rules (no DOM): their order per kind, which one is active (from the server's next step), the one-line
   summary a finished step shows when it is folded, the state of each step, and the names the page shows for the story's words and for the states (the state ids stay as the server sends them). Used by ui/js/remotion/page.js and
   tested by node tests/steps.test.js. The facts all come from the server's detail (klipian/motion.py: next, renderBlock, length); nothing here decides a rule. */

// the steps, in order. Khusus (the main flow): the story comes from the folder Claude Code made. Otomatis (hidden under "Advanced settings"): the AI's answer is pasted.
const STEPS_CUSTOM = ["new", "brief", "story", "facts", "script", "voice", "preview", "render"];
const STEPS_TEMPLATE = ["new", "brief", "answer", "facts", "script", "voice", "preview", "render"];
// Khusus, voice first (the option "flow"): the story is pasted as text, the voice is made and matched, and only then Claude Code builds the folder to the voice
const STEPS_CUSTOM_VOICE = ["new", "brief", "answer", "facts", "script", "voice", "build", "preview", "render"];
const STEP_TITLE = {
  new: "New video", brief: "Brief", story: "Load the story from the Claude Code folder", answer: "The AI's answer and the storyboard", facts: "Check the facts and the title",
  script: "Voice script", voice: "Import the voice and match it", build: "Build the picture to the voice", preview: "Preview", render: "Render",
};
const STEP_TITLE_VOICE_FIRST = { brief: "Brief: the story and the narration text", answer: "Paste the story and the storyboard" };

// the video's order: "voice" (voice first) or "picture" (picture first, the default and every video made before the choice)
const isVoiceFirst = (d) => !!d && d.kind === "custom" && !!d.options && d.options.flow === "voice";

function stepsFor(kind, flow) {
  const voice = kind === "custom" && flow === "voice";
  const ids = voice ? STEPS_CUSTOM_VOICE : kind === "custom" ? STEPS_CUSTOM : STEPS_TEMPLATE;
  return ids.map((id, i) => ({ id, num: i + 1, title: (voice && STEP_TITLE_VOICE_FIRST[id]) || STEP_TITLE[id] }));
}

function stepNum(kind, id, flow) {
  const found = stepsFor(kind, flow).find((s) => s.id === id);
  return found ? found.num : "";
}

// the step that is active now: the one the server's next step belongs to. A blocked render names its reason, so the step that can fix it is the active one.
function activeStepFor(d) {
  if (!d) return "new";
  const custom = d.kind === "custom";
  const key = d.next && d.next.key;
  if (isVoiceFirst(d)) {                                  // voice first: the story is pasted, the voice comes next, the folder is built last
    if (key === "folder" || key === "take" || key === "retake") return "build";
    if (key === "brief") return "brief";
    if (key === "paste") return "answer";
    if (key === "voice") return "voice";
  }
  if (key === "folder") return d.briefAt ? "story" : "brief";
  if (key === "brief") return "brief";
  if (key === "paste") return "answer";
  if (key === "take" || key === "retake") return custom ? "story" : "answer";
  if (key === "fix" || key === "facts" || key === "title") return "facts";
  if (key === "align") return "voice";
  if (key === "blocked") {
    const why = ((d.renderBlock && d.renderBlock.reasons) || (d.gate || []))[0] || "";
    if (/folder/i.test(why)) return isVoiceFirst(d) ? "build" : custom ? "story" : "answer";
    if (/voice|narration/i.test(why)) return "voice";
    if (/claim|title/i.test(why)) return "facts";
    return "render";
  }
  return "render";
}

// the folder's chip: the state as the page shows it (the states are those of motion.folder_state)
const FOLDER_STATES = ["belum dipilih", "cerita belum diambil", "cerita diambil", "folder berubah", "folder tidak lengkap"];
function folderChip(state) {
  return FOLDER_STATES.includes(state) ? state : "belum dipilih";
}
// what the page shows for a state id (the ids are the server's and stay as they are: the css and the stored data use them)
const FOLDER_LABEL = { "belum dipilih": "not chosen", "cerita belum diambil": "story not loaded", "cerita diambil": "story loaded", "folder berubah": "folder changed", "folder tidak lengkap": "folder incomplete" };
const folderLabel = (state) => FOLDER_LABEL[folderChip(state)];
const STATE_LABEL = { aktif: "active", selesai: "done", usang: "stale", menunggu: "waiting", opsional: "optional", belum: "not yet", siap: "ready", perlu: "needed", baru: "new", "tidak ada": "none" };
const stateLabel = (s) => STATE_LABEL[s] || s;

// ---------------------------------------------------------------------------------------------------------------------------------------
// words and numbers
// ---------------------------------------------------------------------------------------------------------------------------------------

// seconds with one decimal, and a whole number without decimals: "53.3" and "45"
function fmtSeconds(s) {
  if (s == null || Number.isNaN(Number(s))) return "";
  const n = Number(s);
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

// the length to show: the voiced length when a voice was matched (it is the real length of the video), else the planned one
function lengthText(length) {
  if (!length) return "";
  return length.voiced != null ? `${fmtSeconds(length.voiced)} s (voice)` : `${fmtSeconds(length.planned)} s`;
}

function dateText(t) {
  return t ? new Date(t * 1000).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "";
}

// the names the person reads for the words of the story (the JSON keeps its own words)
const BEAT_KIND_LABEL = { hook: "Hook", sting: "Intip yuk!", lens: "Look inside", normal: "Explanation", loose: "Loose case", result: "Result", tips: "Tips", outro: "Outro" };
const ITEM_LABEL = { banner: "Banner", badge: "Badge", pill: "Pill", label: "Label", headline: "Headline", source: "Source", stamp: "Stamp" };
const kindLabel = (k) => BEAT_KIND_LABEL[k] || k;
const itemLabel = (t) => ITEM_LABEL[t] || t;

// ---------------------------------------------------------------------------------------------------------------------------------------
// the summary of a step, one line, from the detail
// ---------------------------------------------------------------------------------------------------------------------------------------

// what the video tells (B47): klipian/motion.py STORY_KINDS
const STORY_LABELS = [["fakta", "Fact (explain it)"], ["dongeng", "Story + fact (a made-up story carried by one true fact)"], ["kisah", "True story (a sourced real event with a twist)"]];
// the look of a Khusus video (B28): auto leaves the choice to Claude Code; the others force it
// the order of a Khusus video: klipian/motion.py FLOW_CHOICES
const FLOW_LABELS = [["picture", "Picture first"], ["voice", "Voice first"]];
const LOOK_LABELS = [["auto", "Automatic (chosen from the topic)"], ["iso", "2.5D isometric"], ["2d", "2D"], ["text", "Text"], ["ricks", "Ricks (3D diorama + stick cast, voice first)"]];

function optionsSummary(o) {
  if (!o) return "";
  const music = (typeof MUSIC_LABELS !== "undefined" && MUSIC_LABELS[o.music]) || o.music;
  const apps = (o.voiceTargets || []).length;
  const look = o.look && o.look !== "auto" ? (LOOK_LABELS.find(([v]) => v === o.look) || [])[1] : "";
  return [...(o.flow === "voice" ? ["voice first"] : []), ...(look ? [`look ${look}`] : []), o.loop ? "loop" : "no loop", o.sting ? '"Intip yuk!"' : 'no "Intip yuk!"', ...(o.direct ? ["hook straight in"] : []), ...(o.story === "dongeng" ? ["story + fact"] : []), ...(o.story === "kisah" ? ["true story"] : []), `music ${music}`, `${apps} voice app${apps === 1 ? "" : "s"}`].join(", ");
}

function stepSummary(id, d) {
  if (!d) return "";
  const claims = d.facts || [];
  const open = claims.filter((c) => c.status !== "checked").length;
  const v = d.voice;
  if (id === "new") return `${d.duration} s · ${d.kind === "custom" ? "Custom" : "Template"}`;
  if (id === "brief") return `${d.briefAt ? `copied ${dateText(d.briefAt)}` : "not copied yet"} · ${optionsSummary(d.options)}`;
  if (id === "build") return d.voice && d.voice.aligned ? folderLabel(d.folder ? d.folder.state : "") : "after the voice is matched";
  if (id === "story" || id === "answer") {
    if (!d.story) return id === "story" ? folderLabel(d.folder ? d.folder.state : "") : "no answer yet";
    return `${d.story.beats.length} beats · ${lengthText(d.length)}${!isVoiceFirst(d) && d.folder && d.folder.state === "folder berubah" ? " · folder changed" : ""}`;
  }
  if (id === "facts") {
    if (!d.story) return "waiting for the story";
    return `${claims.length ? (open ? `${open} of ${claims.length} claims not checked` : `${claims.length} claims checked`) : "no claims"} · ${d.title ? "title chosen" : "no title chosen"}`;
  }
  if (id === "script") return d.story ? (d.options && d.options.voiceTargets || []).map((k) => (typeof VOICE_APP_LABELS !== "undefined" && VOICE_APP_LABELS[k]) || k).join(", ") : "waiting for the story";
  if (id === "voice") {
    if (!v || !v.name) return "no voice yet";
    return `${v.name} · ${fmtSeconds(v.duration)} s · ${v.aligned ? "matched" : v.stale ? "match again" : "not matched yet"}`;
  }
  if (id === "preview") return d.preview ? (d.preview.stale ? "stale: make it again" : "ready") : "not made yet";
  if (id === "render") {
    const r = d.renderBlock || {};
    return { belum: "waiting for the story", menunggu: "cannot be rendered yet", siap: "ready to render", selesai: "rendered", usang: "the old render is stale" }[r.state] || "";
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
  if (id === "build") return !(v && v.aligned) ? "menunggu" : d.folder && d.folder.state === "cerita diambil" ? "selesai" : d.folder && d.folder.state === "folder berubah" ? "usang" : "menunggu";
  if (id === "story" || id === "answer") return !d.story ? "menunggu" : !isVoiceFirst(d) && d.folder && d.folder.state === "folder berubah" ? "usang" : "selesai";
  if (id === "facts") return !d.story ? "menunggu" : claimsOpen || !d.title ? "menunggu" : "selesai";
  if (id === "script") return d.story ? "opsional" : "menunggu";
  if (id === "voice") return v && v.name ? (v.aligned ? "selesai" : "menunggu") : "opsional";
  if (id === "preview") return d.preview ? (d.preview.stale ? "usang" : "selesai") : "opsional";
  if (id === "render") return { selesai: "selesai", usang: "usang" }[(d.renderBlock || {}).state] || "menunggu";
  return "menunggu";
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { STEPS_CUSTOM, STEPS_CUSTOM_VOICE, STEPS_TEMPLATE, STEP_TITLE, isVoiceFirst, FLOW_LABELS, stepsFor, stepNum, activeStepFor, FOLDER_STATES, folderChip, folderLabel, stateLabel, fmtSeconds, lengthText, dateText,
    BEAT_KIND_LABEL, ITEM_LABEL, kindLabel, itemLabel, optionsSummary, stepSummary, stepState };
}
