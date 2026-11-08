/* The intro label of a Result Autopilot builds on the server (klipian/autopilot.py build_result) is the label the editor's
   own code makes (angleintro.js withAngleIntro, with compose.js OVERLAY_DEFAULTS): node tests/autoresult.test.js
   The same fixture is checked from Python by `selftest --only autopilotresult`. */
const assert = require("assert");
const fs = require("fs");
const path = require("path");

const fx = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "autopilot-result.json"), "utf8"));
// the editor's text defaults, read from compose.js itself (a browser file: not requireable)
const compose = fs.readFileSync(path.join(__dirname, "..", "ui", "js", "editor", "compose.js"), "utf8");
const m = compose.match(/const OVERLAY_DEFAULTS = (\{[\s\S]*?\n\});/);
assert(m, "OVERLAY_DEFAULTS not found in compose.js");
global.OVERLAY_DEFAULTS = new Function(`return ${m[1]}`)();
const { withAngleIntro, ANGLE_INTRO_SECONDS } = require("../ui/js/editor/angleintro.js");

const { candidate: c, expected } = fx;
const total = c.endSec - c.startSec;
const got = withAngleIntro([], c.angle.intro, total, ANGLE_INTRO_SECONDS, () => "o1", "dark");
assert.deepStrictEqual(got, expected.overlays, `the intro label: got ${JSON.stringify(got)}`);
console.log("autoresult: 1 check ok");
