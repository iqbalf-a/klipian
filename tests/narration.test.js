/* The narration panel's select (ui/js/remotion/narration.js): node tests/narration.test.js */
const assert = require("assert");
const { narrationTarget, narrationAfterChange } = require("../ui/js/remotion/narration.js");

let n = 0;
const eq = (got, want, what) => { n++; assert.deepStrictEqual(got, want, `${what}: got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`); };

const video = { id: "v1", options: { voiceTarget: "voicestudio" } };
const loaded = (target) => ({ forId: "v1", target, text: "x", status: "s" });

// the project's option when nothing is picked and nothing is loaded
eq(narrationTarget(video, null, null), "voicestudio", "the project's option is the start");
eq(narrationTarget({ id: "v1" }, null, null), "voicestudio", "a video without a choice is VoiceStudio");

// after Muat naskah for Google AI Studio the select stays on Google, even though the project option says VoiceStudio
eq(narrationTarget(video, loaded("googleai"), "googleai"), "googleai", "after loading Google the select keeps Google");
eq(narrationTarget(video, loaded("googleai"), null), "googleai", "a loaded export alone keeps its target");

// a redraw without a pick keeps the loaded export's target, and an export of another video is not shown
eq(narrationTarget(video, { forId: "v2", target: "googleai" }, null), "voicestudio", "an export of another video is not used");

// a change of the select: the picked target is kept and the text shown is cleared, so the text and the label never disagree
const change = narrationAfterChange("elevenlabs");
eq(change, { picked: "elevenlabs", shown: null }, "a change clears the shown text and keeps the new target");
eq(narrationTarget(video, change.shown, change.picked), "elevenlabs", "after the change the select shows ElevenLabs, with no old text");

console.log(`narration: ${n} checks ok`);
