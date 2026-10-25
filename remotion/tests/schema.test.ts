/* The story schema (src/schema.ts): `npm test` (node runs the .ts file as it is). The sample story passes; what the
   channel's rules forbid fails: a component, expression or pose that does not exist, screen text over 6 words, a claim
   without a source. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validateStory, wordCount } from "../src/schema.ts";

const sample = JSON.parse(readFileSync(new URL("../stories/colokan-panas.json", import.meta.url), "utf8"));
const clone = (): any => JSON.parse(JSON.stringify(sample));
let n = 0;
const ok = (story: unknown, what: string) => {
  n++;
  const r = validateStory(story);
  assert.ok(r.ok, `${what}: should pass but: ${r.ok ? "" : r.errors.join("; ")}`);
};
const bad = (story: unknown, what: string, mention: RegExp) => {
  n++;
  const r = validateStory(story);
  assert.ok(!r.ok, `${what}: should fail`);
  if (!r.ok) assert.ok(r.errors.some((e) => mention.test(e)), `${what}: the errors should mention ${mention}: ${r.errors.join("; ")}`);
};

ok(sample, "the sample story");
assert.equal(sample.beats.length, 8, "8 beats");
n++;
assert.equal(sample.beats.reduce((a: number, b: any) => a + b.dur, 0), 42, "42 seconds");
n++;
for (const b of sample.beats) { assert.ok(wordCount(b.text) <= 6, `${b.id} screen text`); n++; }

let s = clone();
s.beats[2].scene.items[1] = { type: "hologram", x: 1, y: 1 };
bad(s, "an unknown component", /scene\.items\.1/);

s = clone();
s.beats[0].scene.items[2].expr = "furious";
bad(s, "an unknown chibi expression", /expr/);

s = clone();
s.beats[1].scene.items[0].expr = "sleepy";
bad(s, "an unknown mascot expression", /expr/);

s = clone();
s.beats[0].scene.items[2].pose = "backflip";
bad(s, "an unknown pose", /pose/);

s = clone();
s.beats[0].scene.items[2].role = "astronaut";
bad(s, "an unknown role", /role/);

s = clone();
s.beats[0].text = "satu dua tiga empat lima enam tujuh";
bad(s, "screen text over 6 words", /at most 6 words/);

s = clone();
s.beats[3].scene.items[0].text = "satu dua tiga empat lima enam tujuh";
bad(s, "a banner over 6 words", /at most 6 words/);

s = clone();
s.claims[0].sources = [];
bad(s, "a claim without a source", /claims\.0\.sources/);

s = clone();
s.claims[0].sources = ["bukan url"];
bad(s, "a source that is not a URL", /claims\.0\.sources/);

s = clone();
s.claims[0].beats = ["tidak-ada"];
bad(s, "a claim naming a beat that does not exist", /unknown beat/);

s = clone();
s.duration = 40;
bad(s, "a duration that is not the sum of the beats", /duration/);

s = clone();
s.beats[1].id = "hook";
bad(s, "two beats with one id", /two beats are called/);

s = clone();
s.beats[2].scene.items[0].variant = "loose";
bad(s, "a socket variant its view does not have", /no "loose" variant/);

s = clone();
s.beats[0].scene.bg = "space";
bad(s, "an unknown background", /bg/);

s = clone();
s.beats[0].extra = true;
bad(s, "an unexpected field", /Unrecognized key/);

s = clone();
s.titles = ["satu", "dua"];
bad(s, "fewer than 3 titles", /titles/);

// --- motion (P28-A2): an old story with no motion words still passes (it moves by the defaults); the vocabulary is closed ---
const stripMotion = (story: any) => {
  for (const b of story.beats) {
    delete b.camera; delete b.transition; delete b.blur;
    for (const it of b.scene.items) { delete it.enter; delete it.exit; delete it.actions; delete it.highlight; }
  }
  return story;
};
ok(stripMotion(clone()), "a story with no motion words at all");

const firstOf = (story: any, type: string): any => story.beats.flatMap((b: any) => b.scene.items).find((i: any) => i.type === type);
s = clone(); firstOf(s, "mascot").enter = { kind: "teleport" };
bad(s, "an unknown enter kind", /enter/);
s = clone(); firstOf(s, "mascot").exit = { kind: "explode", at: 1 };
bad(s, "an unknown exit kind", /exit/);
s = clone(); firstOf(s, "mascot").actions = [{ at: 1, kind: "dance" }];
bad(s, "an unknown action kind", /actions/);
s = clone(); firstOf(s, "mascot").actions = [{ at: 1, kind: "shake" }];
bad(s, "a shake that does not say it is danger", /actions/);
s = clone(); firstOf(s, "mascot").actions = [{ at: 1, kind: "shake", danger: true }];
ok(s, "a shake that says it is danger");
s = clone(); firstOf(s, "mascot").actions = [{ at: 99, kind: "highlight" }];
bad(s, "an action outside its beat", /outside the beat|at/);
s = clone(); firstOf(s, "mascot").enter = { kind: "pop", delay: 99 };
bad(s, "an enter delay outside its beat", /delay|outside the beat/);
s = clone(); firstOf(s, "chibi").actions = [{ at: 1, kind: "look", x: 1, y: 1 }];
bad(s, "a chibi that looks at a point (only the mascot does)", /only a mascot can look/);
s = clone(); firstOf(s, "mascot").actions = [{ at: 1, kind: "pose", pose: "point" }];
bad(s, "a mascot with a pose", /only a chibi has poses/);
s = clone(); firstOf(s, "mascot").actions = [{ at: 1, kind: "expr", expr: "calm" }];
bad(s, "a mascot with a chibi expression", /no "calm" expression/);
s = clone(); firstOf(s, "mascot").exit = { kind: "fade-up", at: 1 }; firstOf(s, "mascot").enter = { kind: "pop", delay: 2 };
bad(s, "an item that leaves before it enters", /leave before/);
s = clone(); firstOf(s, "banner").highlight = "panas";
bad(s, "highlight that is not a list", /highlight/);
s = clone(); s.beats[0].camera = { kind: "orbit" };
bad(s, "an unknown camera kind", /camera/);
s = clone(); s.beats[1].transition = { kind: "spin" };
bad(s, "an unknown transition kind", /transition/);
s = clone(); s.beats[0].transition = { kind: "slide" };
bad(s, "a transition into the first beat", /nothing to transition from/);
s = clone(); s.beats[4].transition = { kind: "zoom" };
bad(s, "more than 3 transitions", /at most 3 transitions/);
s = clone(); s.beats[3].transition = { kind: "lens", x: 1, y: 1 };
bad(s, "a lens transition without a radius", /needs x, y and r/);
s = clone(); s.beats[1].transition = { kind: "wipe", dur: 1.9 };
bad(s, "a transition longer than the beats allow", /at most 80%/);
s = clone(); s.beats[1].transition = { kind: "cut" }; s.beats[3].transition = { kind: "cut" }; s.beats[6].transition = { kind: "cut" }; s.beats[4].transition = { kind: "zoom" };
ok(s, "cuts do not count as transitions");

console.log(`schema: ${n} checks ok`);
