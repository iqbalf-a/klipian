/* Sorting and searching the workspace tables (ui/js/shared/pager.js): node tests/sort.test.js */
const assert = require("assert");
const store = {};
global.localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } };
const { createSort, parseSort, sortRows, matchesQuery } = require("../ui/js/shared/pager.js");

let n = 0;
const eq = (got, want, what) => { n++; assert.deepStrictEqual(got, want, `${what}: got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`); };
const names = (rows) => rows.map((r) => r.n);
const G = { n: (r) => r.n, v: (r) => r.v };

// text is natural (numeric) and case-insensitive; numbers are numbers
const text = [{ n: "clip 10" }, { n: "Clip 2" }, { n: "clip 1" }];
eq(names(sortRows(text, G, "n", "asc")), ["clip 1", "Clip 2", "clip 10"], "text asc is numeric, any case");
eq(names(sortRows(text, G, "n", "desc")), ["clip 10", "Clip 2", "clip 1"], "text desc");
const num = [{ n: "a", v: 9 }, { n: "b", v: 10 }, { n: "c", v: 2 }];
eq(names(sortRows(num, G, "v", "asc")), ["c", "a", "b"], "numbers asc as numbers (9 < 10)");
eq(names(sortRows(num, G, "v", "desc")), ["b", "a", "c"], "numbers desc");

// empty is always last, both ways; zero and false are values, not empty
const gaps = [{ n: "a", v: "" }, { n: "b", v: 5 }, { n: "c", v: null }, { n: "d", v: 1 }, { n: "e", v: undefined }, { n: "f", v: 0 }];
eq(names(sortRows(gaps, G, "v", "asc")), ["f", "d", "b", "a", "c", "e"], "empty last in asc, 0 counts");
eq(names(sortRows(gaps, G, "v", "desc")), ["b", "d", "f", "a", "c", "e"], "empty last in desc");
const flags = [{ n: "x", v: true }, { n: "y", v: false }];
eq(names(sortRows(flags, G, "v", "asc")), ["y", "x"], "booleans sort false before true");

// ties keep their order, in both directions
const ties = [{ n: "p", v: 1 }, { n: "q", v: 1 }, { n: "r", v: 1 }];
eq(names(sortRows(ties, G, "v", "asc")), ["p", "q", "r"], "stable asc");
eq(names(sortRows(ties, G, "v", "desc")), ["p", "q", "r"], "stable desc");
const input = [{ n: "b" }, { n: "a" }]; sortRows(input, G, "n", "asc");
eq(names(input), ["b", "a"], "sorting returns a copy");

// createSort: default, toggle same / new column, remembered, old values
let s = createSort("t1", "created");
eq([s.col(), s.dir()], ["created", "desc"], "created starts newest first");
s.toggle("created");
eq([s.col(), s.dir(), store["klipian.sort.t1"]], ["created", "asc", "created:asc"], "same column flips and is stored as col:dir");
s.toggle("title");
eq([s.col(), s.dir()], ["title", "asc"], "a new text column starts asc");
s.toggle("size");
eq([s.col(), s.dir()], ["size", "desc"], "a new size column starts desc");
s = createSort("t1", "created");
eq([s.col(), s.dir()], ["size", "desc"], "the choice is read back");
store["klipian.sort.old"] = "desc"; s = createSort("old", "created");
eq([s.col(), s.dir()], ["created", "desc"], 'an old "desc" is created:desc');
store["klipian.sort.old2"] = "asc"; s = createSort("old2", "at");
eq([s.col(), s.dir()], ["created", "asc"], 'an old "asc" is created:asc, whatever the default column');
store["klipian.sort.junk"] = "nope"; s = createSort("junk", "name");
eq([s.col(), s.dir()], ["name", "asc"], "garbage falls back to the default column");
eq(parseSort("title:desc", "created"), { col: "title", dir: "desc" }, "parseSort col:dir");

// the heading
s = createSort("h", "created");
eq([s.ariaSort("created"), s.ariaSort("title")], ["descending", "none"], "aria-sort");
eq(s.headHTML("created", "Created").includes("sort-arrow"), true, "active column has the arrow");
eq(s.headHTML("title", "Title").includes("sort-arrow"), false, "inactive column has none");
eq(s.headHTML("title", "Title").includes('data-sort="title"'), true, "data-sort carries the column");

// apply() uses the active column
s = createSort("a", "n"); s.toggle("v");
eq(names(s.apply(num, G)), ["c", "a", "b"], "apply uses the active column");

// matchesQuery
const row = { title: "Dokter Anestesi", platform: "YouTube", notes: null };
eq(matchesQuery(row, ["title", "platform"], ""), true, "empty query passes");
eq(matchesQuery(row, ["title", "platform"], "   "), true, "blank query passes");
eq(matchesQuery(row, ["title", "platform"], "dokter"), true, "substring");
eq(matchesQuery(row, ["title", "platform"], "DOKTER you"), true, "several words, any case, across fields");
eq(matchesQuery(row, ["title", "platform"], "dokter tiktok"), false, "every word must match");
eq(matchesQuery(row, ["title", "notes"], "null"), false, "an empty field is empty text, not the word null");
eq(matchesQuery(row, ["title", (r) => r.platform.slice(0, 3)], "you"), true, "a field can be a function");

console.log(`sort: ${n} checks ok`);
