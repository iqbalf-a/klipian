/* The folder picker rules (ui/js/remotion/folders.js): node tests/folders.test.js */
const assert = require("assert");
const { folderStatus, pickFolders } = require("../ui/js/remotion/folders.js");

let n = 0;
const eq = (got, want, what) => { n++; assert.deepStrictEqual(got, want, `${what}: got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`); };
const slugs = (l) => l.map((c) => c.slug);

const list = [
  { slug: "api-lilin", title: "Kenapa api lilin", duration: 60, modified: 300, takenBy: "topik lain" },
  { slug: "bulan", title: "Bulan menghadap", duration: 45, modified: 100, takenBy: null },
  { slug: "colokan", title: "Colokan panas", duration: null, modified: 200, takenBy: null },
  { slug: "dingin", title: "Dingin", duration: 60, modified: 400, takenBy: null },
];

eq(folderStatus(list[0], "bulan"), "other", "taken by another topic");
eq(folderStatus(list[1], "bulan"), "current", "the picked one is this topic's");
eq(folderStatus(list[2], "bulan"), "free", "nobody took it");

eq(slugs(pickFolders(list)), ["dingin", "api-lilin", "colokan", "bulan"], "default: newest first");
eq(slugs(pickFolders(list, { sort: "name" })), ["bulan", "colokan", "dingin", "api-lilin"], "name A-Z by title");
eq(slugs(pickFolders(list, { sort: "duration" })), ["bulan", "dingin", "api-lilin", "colokan"], "duration ascending, none last, ties newest");
eq(slugs(pickFolders(list, { sort: "free" }, "bulan")), ["dingin", "colokan", "api-lilin", "bulan"], "untaken first (free), then taken");

eq(slugs(pickFolders(list, { q: "  LILIN " })), ["api-lilin"], "search is case-insensitive and trimmed, matches the title");
eq(slugs(pickFolders(list, { q: "colokan" })), ["colokan"], "search matches the slug");
eq(slugs(pickFolders(list, { q: "zzz" })), [], "no match");

eq(slugs(pickFolders(list, { filter: "free" }, "bulan")), ["dingin", "colokan"], "filter: free");
eq(slugs(pickFolders(list, { filter: "taken" }, "bulan")), ["api-lilin", "bulan"], "filter: taken counts this topic's own folder");
eq(slugs(pickFolders(list, { filter: "free", q: "l" }, "")), ["colokan", "bulan"], "search and filter together, newest first");
eq(list.length, 4, "the input is not reordered or changed in length");

console.log(`folders: ${n} checks ok`);
