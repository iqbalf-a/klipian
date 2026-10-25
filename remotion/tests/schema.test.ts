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

console.log(`schema: ${n} checks ok`);
