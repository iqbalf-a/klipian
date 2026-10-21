/* The masked time field's pure functions (ui/js/editor/timefield.js): node tests/timefield.test.js
   Also run by `python -m klipian selftest` (check "timefield") when node is installed. */
const assert = require("assert");
const { tfMask, tfParse, tfFormat, tfMaxLength } = require("../ui/js/editor/timefield.js");

let n = 0;
const eq = (got, want, what) => { n++; assert.deepStrictEqual(got, want, `${what}: got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`); };
const secs = (text) => { const r = tfParse(text); return r.ok ? r.seconds : r.error; };

// typing: digits fill from the right
eq(tfMask("1100", false), "11:00", "1100 shows 11:00");
eq(secs(tfMask("1100", false)), 660, "1100 is 11:00");
eq(tfMask("130", false), "1:30", "130");
eq(secs("130"), 90, "130 is 1:30");
eq(tfMask("5", false), "0:05", "5");
eq(secs("5"), 5, "5 is 0:05");
eq(tfMask("11455", true), "1:14:55", "11455 on a long source");
eq(secs(tfMask("11455", true)), 3600 + 14 * 60 + 55, "11455 is 1:14:55");
eq(tfMask("11455", false), "14:55", "a short source has no hours: the extra digit drops off the left");
eq(tfMask("0005", false), "0:05", "leading zeros mean nothing");
eq(tfMask("", false), "", "empty stays empty");
eq(tfMask("12ab3", false), "1:23", "non-digits are ignored");
eq(tfMask("1100.5", false), "11:00.5", "tenths after a point");
eq(tfMask("1100,7", false), "11:00.7", "a comma is a point");
eq(tfMask("1100.57", false), "11:00.5", "one digit of tenths");
eq(tfMask(".", false), "0:00.", "a lone point");
eq(tfMask("1111111", false), "11:11", "1111111 cannot become a time: only the last 4 digits count");
eq(tfMask("1111111", true), "1:11:11", "... or the last 5 on a long source");
eq(tfMaxLength(false), 7, "maxlength short");
eq(tfMaxLength(true), 9, "maxlength long");

// parsing
eq(tfParse("11:00"), { ok: true, seconds: 660, exact: false }, "11:00");
eq(tfParse("11:00.0"), { ok: true, seconds: 660, exact: true }, "11:00.0 is exact");
eq(tfParse("1:14:55.4"), { ok: true, seconds: 3600 + 14 * 60 + 55.4, exact: true }, "1:14:55.4");
eq(tfParse("00:11:00"), { ok: true, seconds: 660, exact: false }, "00:11:00");
eq(secs("1:30:00"), 5400, "1:30:00");
eq(secs("75:00"), 4500, "75:00 with two parts is 75 minutes");
eq(secs("0"), 0, "zero");
eq(secs("00:00.0"), 0, "00:00.0");
eq(secs("190"), "use 0–59 for seconds", "190 is refused, not carried to 2:10");
eq(secs("660"), "use 0–59 for seconds", "660 is 6:60: refused, never 660 seconds");
eq(secs("99"), "use 0–59 for seconds", "99 s invalid");
eq(secs("6000"), "use 0–59 for minutes", "6000 is 60:00: refused");
eq(secs("7000"), "use 0–59 for minutes", "7000 is 70:00: refused");
eq(secs("1:75"), "use 0–59 for seconds", "1:75");
eq(secs("1:60:00"), "use 0–59 for minutes", "an hour form with 60 minutes");
eq(secs(""), "type a time", "empty");
eq(secs("   "), "type a time", "blank");
eq(secs("."), "type a time", "only a point");
eq(secs("abc"), "couldn't read that time", "letters");
eq(secs("1:2:3:4"), "couldn't read that time", "four parts");
eq(secs("11:00.x"), "couldn't read that time", "tenths that are not digits");

// formatting
eq(tfFormat(660), "11:00.0", "format 660");
eq(tfFormat(90), "01:30.0", "format 90");
eq(tfFormat(5), "00:05.0", "format 5");
eq(tfFormat(3600 + 14 * 60 + 55.4), "1:14:55.4", "format long");
eq(tfFormat(-3), "00:00.0", "never negative");
eq(tfFormat(NaN), "00:00.0", "NaN");
eq(tfFormat(59.96), "01:00.0", "rounds to tenths and carries");

// a round trip: whatever is formatted can be parsed back
for (const t of [0, 0.1, 59.9, 60, 659.9, 660, 3599.9, 3600, 4489.4, 4900]) eq(secs(tfFormat(t)), Math.round(t * 10) / 10, `round trip ${t}`);

console.log(`timefield: ${n} checks ok`);
