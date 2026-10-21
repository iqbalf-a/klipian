/* The masked time field's pure functions (ui/js/editor/timefield.js): node tests/timefield.test.js
   Also run by `python -m klipian selftest` (check "timefield") when node is installed. */
const assert = require("assert");
const { tfMask, tfParse, tfFormat, tfMaxLength, tfSegments, tfFixed, tfNormalize, tfSegmentAt, tfSetPart, tfPart,
  tfTypeDigit, tfStep } = require("../ui/js/editor/timefield.js");

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

// ---- the segmented field ----
eq(tfSegments(false).map((x) => [x.name, x.start, x.end]), [["m", 0, 2], ["s", 3, 5], ["d", 6, 7]], "short segments");
eq(tfSegments(true).map((x) => [x.name, x.start, x.end]), [["h", 0, 1], ["m", 2, 4], ["s", 5, 7], ["d", 8, 9]], "long segments");
eq(tfFixed(40, false), "00:40.0", "fixed short");
eq(tfFixed(40, true), "0:00:40.0", "fixed long: the hour part is always there");
eq(tfFixed(4495.4, true), "1:14:55.4", "fixed long with hours");
eq(tfFixed(3725, false), "59:05.0", "a short field never shows hours (it holds at 59 minutes)");
eq(tfNormalize("00:40.0", true), "0:00:40.0", "a short text becomes the long shape");
eq(tfNormalize("0:00:40.0", false), "00:40.0", "and back");
eq(tfNormalize("1:14:55.4", true), "1:14:55.4", "a long text stays");
eq(tfNormalize("11:00", false), "11:00.0", "no tenths: .0");
eq(tfNormalize("", false), "", "empty is left");
eq(tfNormalize("abc", false), "abc", "garbage is left");
eq(secs(tfFixed(660.5, false)), 660.5, "a fixed text parses back");
eq([0, 2, 3, 5, 6, 7].map((p) => tfSegmentAt(p, false)), [0, 0, 1, 1, 2, 2], "caret to segment, short (a separator belongs to the part before)");
eq([0, 1, 2, 4, 5, 7, 8, 9].map((p) => tfSegmentAt(p, true)), [0, 0, 1, 1, 2, 2, 3, 3], "caret to segment, long");
eq(tfSetPart("11:00.0", 1, 7, false), "11:07.0", "set the seconds");
eq(tfSetPart("0:00:00.0", 0, 1, true), "1:00:00.0", "set the hour");
eq(tfPart("11:42.5", 1, false), 42, "read the seconds");

// typing into a minute: two digits move on, a first digit above 5 moves on at once
let r = tfTypeDigit("00:00.0", 0, 1, 0, false);
eq(r, { text: "01:00.0", advance: false, typed: 1 }, "first digit 1 in the minutes");
r = tfTypeDigit(r.text, 0, 1, r.typed, false);
eq(r, { text: "11:00.0", advance: true, typed: 0 }, "second digit finishes the minutes and moves on");
r = tfTypeDigit("11:00.0", 1, 7, 0, false);
eq(r, { text: "11:07.0", advance: true, typed: 0 }, "a seconds digit above 5 fills it and moves on");
r = tfTypeDigit("11:00.0", 1, 3, 0, false);
eq(r, { text: "11:03.0", advance: false, typed: 1 }, "3 waits for a second digit");
r = tfTypeDigit(r.text, 1, 0, r.typed, false);
eq(r, { text: "11:30.0", advance: true, typed: 0 }, "3 then 0 is 30 and moves on");
r = tfTypeDigit("11:03.0", 1, 9, 1, false);
eq(r.text, "11:39.0", "3 then 9 is 39 (a second digit is taken whatever it is)");
// the tenths and the hour take one digit
eq(tfTypeDigit("11:30.0", 2, 5, 0, false), { text: "11:30.5", advance: false, typed: 0 }, "the tenths take one digit and stay");
eq(tfTypeDigit("0:00:00.0", 0, 1, 0, true), { text: "1:00:00.0", advance: true, typed: 0 }, "the hour takes one digit and moves on");
eq(tfTypeDigit("1:00:00.0", 3, 4, 0, true), { text: "1:00:00.4", advance: false, typed: 0 }, "the last part stays");
// the whole of 1:14:55 on a long source, digit by digit, segment by segment
let t = "0:00:00.0", i = 0, typed = 0;
for (const d of [1, 1, 4, 5, 5]) { const x = tfTypeDigit(t, i, d, typed, true); t = x.text; typed = x.typed; if (x.advance) { i++; typed = 0; } }
eq(t, "1:14:55.0", "1 · 14 · 55 typed straight through");
// 190 can no longer happen: the digits fill 1:9 (minutes 19, then seconds 0 -> segments) never 90 seconds
t = "00:00.0"; i = 0; typed = 0;
for (const d of [1, 9, 0]) { const x = tfTypeDigit(t, i, d, typed, false); t = x.text; typed = x.typed; if (x.advance) { i++; typed = 0; } }
eq(t, "19:00.0", "190 reads as minutes 19, seconds 0: every part stays 0–59");
eq(secs(t), 1140, "and is a valid time");

// ArrowUp / ArrowDown on a part, with carry, clamped
eq(tfStep("11:59.0", 1, 1, false), "12:00.0", "seconds up carry into the minutes");
eq(tfStep("11:00.0", 1, -1, false), "10:59.0", "seconds down borrow from the minutes");
eq(tfStep("00:00.0", 1, -1, false), "00:00.0", "never below 0");
eq(tfStep("11:00.0", 0, 1, false), "12:00.0", "minutes up");
eq(tfStep("11:00.0", 0, -1, false), "10:00.0", "minutes down");
eq(tfStep("11:00.9", 2, 1, false), "11:01.0", "tenths up carry into the seconds");
eq(tfStep("11:01.0", 2, -1, false), "11:00.9", "tenths down");
eq(tfStep("0:59:00.0", 0, 1, true), "1:59:00.0", "hours up");
eq(tfStep("1:59:59.0", 2, 1, true), "2:00:00.0", "seconds carry all the way");
eq(secs(tfStep("00:30.0", 1, 1, false, 30.5)), 30.5, "a step past the end stops at the end");
eq(secs(tfStep("59:59.0", 1, 1, false)), 3599.9, "59:59.9 is the top of a short field");
eq(tfStep("garbage", 0, 1, false), "garbage", "a broken text is left");

// Backspace on a part: zero
eq(tfSetPart("11:42.5", 1, 0, false), "11:00.5", "clear the seconds");
eq(tfSetPart("1:14:55.4", 2, 0, true), "1:14:00.4", "clear the seconds, long");

console.log(`timefield: ${n} checks ok`);
