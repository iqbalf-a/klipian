/* The voice apps of a video, as pure rules (no DOM): which apps are checked, their order in the panel, and which export a block shows.
   Used by ui/js/remotion/page.js and tested by node tests/narration.test.js. */

// the apps, in the order of the panel (VoiceStudio, ElevenLabs, Google AI Studio)
const VOICE_APP_ORDER = ["voicestudio", "elevenlabs", "googleai"];
const VOICE_APP_LABELS = { voicestudio: "VoiceStudio", elevenlabs: "ElevenLabs", googleai: "Google AI Studio" };

// the checked apps in the panel's order: the one the project opens first comes first, the rest keep their order
function voiceAppsInOrder(options) {
  const checked = (options && options.voiceTargets) || VOICE_APP_ORDER;
  const list = VOICE_APP_ORDER.filter((k) => checked.includes(k));
  const first = options && options.voiceTargetFirst;
  return list.includes(first) ? [first, ...list.filter((k) => k !== first)] : list;
}

// the export a block shows: only the one loaded for this video and this app, never another app's text
function narrationShown(state, forId, key) {
  return state && state.forId === forId && state.exports && state.exports[key] ? state.exports[key] : null;
}

if (typeof module !== "undefined" && module.exports) module.exports = { VOICE_APP_ORDER, VOICE_APP_LABELS, voiceAppsInOrder, narrationShown };

// the file name of a text the person downloads: the whole text, or one plain part of VoiceStudio's (colokan-naskah-voicestudio_1.txt, _2.txt, ...)
function narrationFile(id, key, part) {
  return part == null ? `${id}-naskah-${key}.txt` : `${id}-naskah-${key}_${part}.txt`;
}

// what the person copies into the app: the text of the export and nothing else (the counts, the settings and the notes are in `info`, shown beside it)
function narrationCopyText(ex) {
  return ex ? String(ex.text || "") : "";
}

if (typeof module !== "undefined" && module.exports) Object.assign(module.exports, { narrationFile, narrationCopyText });
