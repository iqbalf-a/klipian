/* The topic list rules (ui/js/remotion/topics.js): node tests/topics.test.js */
const assert = require("assert");
const { filterTopics, topicFiltered, topicNeedsAction } = require("../ui/js/remotion/topics.js");

let n = 0;
const eq = (got, want, what) => { n++; assert.deepStrictEqual(got, want, `${what}: got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`); };
const ids = (l) => l.map((p) => p.id);
const mk = (id, o) => ({ id, topic: id, title: "", composition: "", status: "draft", duration: 45, music: "sunny", created: 0, updated: 0, chip: { key: "brief" }, ...o });
const list = [
  mk("a", { topic: "Kenapa langit biru", status: "rendered", chip: { key: "selesai" }, updated: 100, created: 400, duration: 60 }),
  mk("b", { topic: "Colokan panas", title: "Colokan bisa panas?", composition: "kenapa-colokan-panas", status: "story", chip: { key: "title" }, updated: 300, created: 100, music: "tech" }),
  mk("c", { topic: "Bulan", status: "draft", updated: 200, created: 300, duration: 30 }),
  mk("d", { topic: "Api lilin", status: "checked", chip: { key: "blocked" }, updated: 50, created: 200 }),
];

eq(ids(filterTopics(list, {})), ["b", "c", "a", "d"], "default: newest changed");
eq(ids(filterTopics(list, { sort: "created" })), ["a", "c", "d", "b"], "newest created");
eq(ids(filterTopics(list, { sort: "name" })), ["d", "c", "b", "a"], "name A-Z uses the chosen title, else the topic");
eq(ids(filterTopics(list, { sort: "stage" })), ["b", "c", "a", "d"], "needs action first, then newest");

eq(ids(filterTopics(list, { q: " LANGIT " })), ["a"], "search the topic, any case");
eq(ids(filterTopics(list, { q: "bisa panas" })), ["b"], "search the chosen title");
eq(ids(filterTopics(list, { q: "kenapa-colokan" })), ["b"], "search the composition folder");
eq(ids(filterTopics(list, { q: "d" })), ["d"], "search the id");
eq(ids(filterTopics(list, { q: "zzz" })), [], "nothing matches");

eq(ids(filterTopics(list, { status: "story" })), ["b"], "status filter");
eq(ids(filterTopics(list, { need: true })), ["b", "c"], "needs action: not rendered-current, not blocked");
eq(ids(filterTopics(list, { dur: 60 })), ["a"], "duration filter");
eq(ids(filterTopics(list, { music: "tech" })), ["b"], "music filter");
eq(ids(filterTopics(list, { q: "a", need: true, dur: 45 })), ["b"], "everything combines with AND");

eq([topicFiltered({}), topicFiltered({ q: " " }), topicFiltered({ dur: 30 }), topicFiltered({ sort: "name" })], [false, false, true, false], "sorting alone is not filtering");
eq(topicNeedsAction({}), true, "a topic with no chip still needs a move");
eq(list.length, 4, "the input is untouched");
console.log(`topics: ${n} checks ok`);
