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
