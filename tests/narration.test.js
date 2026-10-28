/* The voice apps of a video (ui/js/remotion/narration.js): node tests/narration.test.js */
const assert = require("assert");
const { VOICE_APP_ORDER, voiceAppsInOrder, narrationShown } = require("../ui/js/remotion/narration.js");

let n = 0;
const eq = (got, want, what) => { n++; assert.deepStrictEqual(got, want, `${what}: got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`); };

// all three apps are checked by default, in the panel's order
eq(voiceAppsInOrder({}), ["voicestudio", "elevenlabs", "googleai"], "no choice made: all three in order");
eq(voiceAppsInOrder({ voiceTargets: VOICE_APP_ORDER, voiceTargetFirst: "voicestudio" }), ["voicestudio", "elevenlabs", "googleai"], "all three checked");

// a subset keeps the panel's order; the project's first app opens first
eq(voiceAppsInOrder({ voiceTargets: ["googleai", "voicestudio"], voiceTargetFirst: "voicestudio" }), ["voicestudio", "googleai"], "two checked, in order");
eq(voiceAppsInOrder({ voiceTargets: ["voicestudio", "elevenlabs", "googleai"], voiceTargetFirst: "googleai" }), ["googleai", "voicestudio", "elevenlabs"], "the first app opens first, the rest keep their order");

// a first app that is not checked is not shown first
eq(voiceAppsInOrder({ voiceTargets: ["elevenlabs"], voiceTargetFirst: "googleai" }), ["elevenlabs"], "an unchecked first app is not shown");

// a block shows only its own app's export, for this video
const state = { forId: "v1", exports: { googleai: { target: "googleai", text: "G" }, elevenlabs: { target: "elevenlabs", text: "E" } } };
eq(narrationShown(state, "v1", "googleai").text, "G", "the Google block shows the Google export");
eq(narrationShown(state, "v1", "voicestudio"), null, "an app that was not loaded shows nothing");
eq(narrationShown(state, "v2", "googleai"), null, "an export of another video is not shown");
eq(narrationShown(null, "v1", "googleai"), null, "nothing loaded yet");

console.log(`narration: ${n} checks ok`);
