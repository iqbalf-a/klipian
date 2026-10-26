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
s.beats[2].scene.items[1].variant = "loose";
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
    for (const it of b.scene.items) { const reaction = it.type === "mascot" && b.kind !== "sting" && b.kind !== "outro"; if (!reaction) { delete it.enter; delete it.exit; } delete it.actions; delete it.highlight; }   // a mascot reaction keeps its exit: it must be short
  }
  return story;
};
ok(stripMotion(clone()), "a story with no motion words at all");

const firstOfKind = (story: any, id: string): any => story.beats.find((b: any) => b.id === id);
const yes0 = (cond: boolean, what: string) => { n++; assert.ok(cond, what); };
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
s = clone(); s.beats[0].scene.items.push({ type: "chibi", x: 700, y: 1600, u: 150, role: "pemuda", expr: "calm", pose: "idle" }); firstOf(s, "chibi").actions = [{ at: 1, kind: "look", x: 1, y: 1 }];
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

// --- P28-A3: backgrounds, routed cables, arrows and badges, persistent mascot, snapping looks ---
for (const bg of ["room", "black", "brand", "lab"]) { s = clone(); s.beats[0].scene.bg = bg; ok(s, `the ${bg} background`); }
s = clone(); s.beats[0].scene.spot = { x: 100, y: 200, r: 300 };
ok(s, "a spotlight position");
s = clone(); s.beats[0].scene.spot = { x: 100 };
bad(s, "a spotlight without y", /spot/);
const plugOf = (story: any) => story.beats[0].scene.items.find((i: any) => i.type === "socket");
s = clone(); plugOf(s).plug = { route: [[1, 2]] };
bad(s, "a cable route of one point", /plug/);
s = clone(); plugOf(s).plug = {};
bad(s, "a plug with neither a route nor cableX and cableY", /route or cableX/);
s = clone(); plugOf(s).plug = { cableX: 10, cableY: 20 };
ok(s, "the straight cable of the first stories");
s = clone(); s.beats[0].scene.items.push({ type: "arrow", x: 10, y: 10, x2: 200, y2: 300, color: "white" });
ok(s, "an arrow");
s = clone(); s.beats[0].scene.items.push({ type: "arrow", x: 10, y: 10, x2: 200, y2: 300, color: "green" });
bad(s, "an arrow of a colour outside the palette", /color/);
s = clone(); s.beats[0].scene.items.push({ type: "badge", text: "2", x: 100, y: 100 });
ok(s, "a badge");
s = clone(); s.beats[0].scene.items.push({ type: "badge", text: "12345", x: 100, y: 100 });
bad(s, "a badge with a long text", /text/);
s = clone(); firstOf(s, "mascot").persist = true; firstOf(s, "mascot").enter = { kind: "none" };
ok(s, "a persistent mascot");
s = clone(); firstOf(s, "mascot").actions = [{ at: 0, kind: "look", x: 5, y: 6, snap: true }];
ok(s, "a look that snaps");
s = clone(); firstOf(s, "mascot").actions = [{ at: 0, kind: "look", x: 5, y: 6, snap: "yes" }];
bad(s, "a snap that is not a boolean", /snap/);

// --- the mascot is rare (ian 2026-10-26): the sting and the outro, plus at most 2 short reactions in between ---
const reaction = (delay: number, at: number) => ({ type: "mascot", x: 200, y: 1470, w: 300, expr: "surprised", pop: true, enter: { kind: "pop", delay }, exit: { kind: "pop", at } });
const reactionsIn = (story: any) => story.beats.flatMap((b: any) => b.kind === "sting" || b.kind === "outro" ? [] : b.scene.items.filter((i: any) => i.type === "mascot"));
yes0(reactionsIn(clone()).length === 2, "the colokan story has 2 short mascot reactions");
s = clone(); s.beats[2].scene.items.push(reaction(0.5, 1.5));
bad(s, "a third mascot reaction", /at most 2 times in the whole video \(this is reaction 3\)/);
s = clone(); firstOfKind(s, "kendur").scene.items.find((i: any) => i.type === "mascot").exit.at = 5;
bad(s, "a mascot reaction that stays 2.6 s", /lasts at most 1.5 s \(this one lasts 2.6 s\)/);
s = clone(); delete firstOfKind(s, "kendur").scene.items.find((i: any) => i.type === "mascot").exit;
bad(s, "a mascot that never leaves", /lasts at most 1.5 s/);
s = clone(); firstOfKind(s, "kendur").scene.items.find((i: any) => i.type === "mascot").persist = true;
bad(s, "a mascot parked in a corner", /not parked in a corner/);
s = clone(); s.beats[7].scene.items.push({ type: "mascot", x: 200, y: 1470, w: 300, expr: "laugh", persist: true }); s.beats[1].scene.items.push({ type: "mascot", x: 300, y: 1470, w: 300, expr: "laugh", persist: true });
ok(s, "any number of mascots in the sting and the outro, persistent or not");

console.log(`schema: ${n} checks ok`);
