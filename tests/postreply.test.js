/* The merge of Claude's reply for one Result into its fields (ui/js/editor/postreply.js): node tests/postreply.test.js */
const assert = require("assert");
const { postReplyPlan } = require("../ui/js/editor/postreply.js");

let n = 0;
const eq = (got, want, what) => { n++; assert.deepStrictEqual(got, want, `${what}: got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`); };

const reply = {
  title: "Rugi Karena Timing", hook: "satu keputusan",
  post: { title: "Rugi 300 Juta", caption: "Satu keputusan. Kamu pernah?", hashtags: ["#bisnis", "#podcast"] },
  angle: { take: "Keputusan kecil mahal.", intro: "Satu keputusan ini", notes: [{ at: 4, text: "Dengar nadanya" }] },
};

// empty fields: nothing to confirm, everything filled
let p = postReplyPlan({ title: "", post: null, angle: null }, reply);
eq(p.conflicts, [], "empty fields have no conflicts");
eq(p.next, { title: "Rugi Karena Timing", post: reply.post, angle: reply.angle }, "empty fields become the reply");

// the fields that already have text are named
p = postReplyPlan({ title: "Klip lama", post: { title: "", caption: "Ada isinya", hashtags: [] }, angle: { take: "", intro: "Intro lama", notes: [] } }, reply);
eq(p.conflicts, ["Result title", "Caption", "Angle: intro"], "only what has text is a conflict");
eq(p.next.post.caption, "Satu keputusan. Kamu pernah?", "the reply replaces the caption");
eq(p.next.angle.intro, "Satu keputusan ini", "the reply replaces the intro");

// everything written: all seven are named, in the order of the panels
p = postReplyPlan({ title: "t", post: { title: "a", caption: "b", hashtags: ["#c"] }, angle: { take: "d", intro: "e", notes: [{ at: 1, text: "f" }] } }, reply);
eq(p.conflicts, ["Result title", "Post title", "Caption", "Hashtags", "Angle: take", "Angle: intro", "Angle: notes"], "all seven");

// a reply without notes keeps the notes already there, and is not a conflict for them
const noNotes = { ...reply, angle: { take: "k", intro: "i", notes: [] } };
p = postReplyPlan({ title: "", post: null, angle: { take: "", intro: "", notes: [{ at: 2, text: "tetap" }] } }, noNotes);
eq(p.conflicts, [], "notes the reply does not bring are not replaced");
eq(p.next.angle.notes, [{ at: 2, text: "tetap" }], "the notes stay");

// whitespace-only text is empty
p = postReplyPlan({ title: "   ", post: { title: " ", caption: "\n", hashtags: [] }, angle: {} }, reply);
eq(p.conflicts, [], "blank fields are empty");

// the current Result title is kept when the reply has none
p = postReplyPlan({ title: "Punyaku", post: null, angle: null }, { ...reply, title: "" });
eq(p.next.title, "Punyaku", "no title in the reply keeps the title");
eq(p.conflicts, [], "and is no conflict");

console.log(`postreply: ${n} checks ok`);
