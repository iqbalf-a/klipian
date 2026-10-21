/* klipian — the segmented time field
   ==========================================================================
   Every field you type a moment's time into (a suggestion's start and end, Clips from / to) works like the time input of
   the upload schedule: the text is always whole and in range, "mm:ss.d" under an hour and "h:mm:ss.d" from an hour up
   (the same rule as result.js fitTimeFields), and the caret sits in one SEGMENT at a time, highlighted:

     typing        2 digits fill a minute or second and the caret moves on (a first digit above 5 fills it at once);
                   one digit for the hour; one for the tenths. ":" "." "," or ArrowRight move to the next segment,
                   ArrowLeft to the previous one; Tab and Shift+Tab move through the segments, then leave the field.
     ArrowUp/Down  change the focused segment: hours ±1, minutes ±1, seconds ±1, tenths ±0.1, with carry, held to
                   0 … the end of the video (and never past 9:59:59.9).
     Backspace     clears the segment to 0. Enter commits, Esc puts the old value back.
   A segment can never leave its range (0–59), so there is nothing to refuse while typing; what is checked on commit is
   the rest (start before end, inside the video; result.js and timeline.js).

   A time typed with the digits of the minutes and seconds is snapped to a word, as it always was; touching the tenths or
   using the arrow keys means "exactly this" (`data-exact`, read by tfFieldParse()). Pasted text is read by tfParse:
   "11:00", "00:11:00" and "1:14:55.4" as written, digits alone from the right ("1100" = 11:00, "660" = 6:60: refused).

   The pure functions (tf*) are what the node tests in tests/timefield.test.js exercise. The value the rest of the code
   reads is still the text of the input, parsed to SECONDS by tfParse / tfFieldParse.
   ========================================================================== */

const TF_TITLE = "Type a minute or second (two digits move on by themselves), : or . or → for the next part, "
  + "↑ ↓ to change the part, Tab to move through the parts. The tenths are the last part. You can paste 11:00 or 1:14:55.4. "
  + "Esc undoes.";

const tfMaxLength = (long) => (long ? 9 : 7);
const tfMaxDigits = (long) => (long ? 5 : 4);

/* ---------- parsing and formatting (shared by paste, the tests and the change handlers) ---------- */

/* "mm:ss" shape of a digit string read from the right ("" stays empty). */
function tfDigitsText(digits) {
  if (!digits) return "";
  const ss = digits.slice(-2).padStart(2, "0");
  const rest = digits.slice(0, -2);
  if (rest.length > 2) return `${rest.slice(0, -2)}:${rest.slice(-2)}:${ss}`;
  return `${rest || "0"}:${ss}`;
}

/* What a bare number reads as: its digits right-aligned (1100 → 11:00, 5 → 0:05), the tenths after a ".". */
function tfMask(raw, long) {
  const text = String(raw ?? "");
  const cut = text.search(/[.,]/);
  const whole = cut < 0 ? text : text.slice(0, cut);
  const frac = cut < 0 ? null : text.slice(cut + 1).replace(/\D/g, "");
  const digits = whole.replace(/\D/g, "").replace(/^0+/, "").slice(-tfMaxDigits(long));
  const shown = tfDigitsText(digits);
  if (frac === null) return shown;
  return `${shown || "0:00"}.${frac.slice(0, 1)}`;
}

/* seconds -> "11:00.0", "1:14:55.4" (no hour part under an hour). */
function tfFormat(seconds) {
  const n = Number.isFinite(seconds) ? Math.max(0, Math.round(seconds * 10)) : 0;
  const t = Math.floor(n / 10);
  const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
  const p = (x) => String(x).padStart(2, "0");
  return `${h ? `${h}:${p(m)}` : p(m)}:${p(s)}.${n % 10}`;
}

/* text -> { ok, seconds, exact } or { ok: false, error }. `exact`: a decimal point with digits was typed. */
function tfParse(text) {
  const s = String(text ?? "").trim();
  if (!s) return { ok: false, error: "type a time" };
  const cut = s.search(/[.,]/);
  const whole = cut < 0 ? s : s.slice(0, cut);
  const fracDigits = cut < 0 ? "" : s.slice(cut + 1);
  if (fracDigits && !/^\d+$/.test(fracDigits)) return { ok: false, error: "couldn't read that time" };
  if (!/^[\d:]*$/.test(whole)) return { ok: false, error: "couldn't read that time" };
  let h = 0, m = 0, sec = 0;
  if (whole.includes(":")) {
    if (!/^\d+(:\d+){1,2}$/.test(whole)) return { ok: false, error: "couldn't read that time" };
    const parts = whole.split(":").map(Number);
    if (parts.length === 3) [h, m, sec] = parts; else [m, sec] = parts;
    if (parts.length === 3 && m > 59) return { ok: false, error: "use 0–59 for minutes" };
  } else {
    const digits = whole.replace(/\D/g, "");
    if (!digits && !fracDigits) return { ok: false, error: "type a time" };
    if (whole !== digits) return { ok: false, error: "couldn't read that time" };
    const d = digits.replace(/^0+(?=\d)/, "");
    sec = Number(d.slice(-2) || 0);
    m = Number(d.slice(-4, -2) || 0);
    h = Number(d.slice(0, -4) || 0);
    if (m > 59) return { ok: false, error: "use 0–59 for minutes" };
  }
  if (sec > 59) return { ok: false, error: "use 0–59 for seconds" };
  const frac = fracDigits ? Number(`0.${fracDigits}`) : 0;
  return { ok: true, seconds: h * 3600 + m * 60 + sec + frac, exact: fracDigits.length > 0 };
}

/* ---------- the segments ---------- */

/* Where each part sits in the text, for a long ("h:mm:ss.d") or a short ("mm:ss.d") field. */
function tfSegments(long) {
  return long
    ? [{ name: "h", start: 0, end: 1, width: 1 }, { name: "m", start: 2, end: 4, width: 2 },
       { name: "s", start: 5, end: 7, width: 2 }, { name: "d", start: 8, end: 9, width: 1 }]
    : [{ name: "m", start: 0, end: 2, width: 2 }, { name: "s", start: 3, end: 5, width: 2 },
       { name: "d", start: 6, end: 7, width: 1 }];
}

/* seconds -> the whole text of a field of this shape: "0:00:40.0" (long) or "00:40.0" (short). */
function tfFixed(seconds, long) {
  const n = Number.isFinite(seconds) ? Math.max(0, Math.round(seconds * 10)) : 0;
  const t = Math.floor(n / 10);
  const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
  const p = (x) => String(x).padStart(2, "0");
  return long ? `${Math.min(9, h)}:${p(m)}:${p(s)}.${n % 10}` : `${p(Math.min(59, m + h * 60))}:${p(s)}.${n % 10}`;
}

/* A whole text in the shape of a field: a time as written (":" in it) becomes its fixed form, anything else is left. */
function tfNormalize(text, long) {
  const t = String(text ?? "");
  if (!t.includes(":")) return t;
  const r = tfParse(t);
  return r.ok ? tfFixed(r.seconds, long) : t;
}

/* The index of the segment a caret position belongs to (a separator belongs to the part before it). */
function tfSegmentAt(pos, long) {
  const segs = tfSegments(long);
  let at = 0;
  segs.forEach((s, i) => { if (pos >= s.start) at = i; });
  return at;
}

/* The text with one part replaced by `value` (a number), zero-padded to the part's width. */
function tfSetPart(text, index, value, long) {
  const seg = tfSegments(long)[index];
  return text.slice(0, seg.start) + String(value).padStart(seg.width, "0").slice(-seg.width) + text.slice(seg.end);
}

/* The number in one part of the text. */
function tfPart(text, index, long) {
  const seg = tfSegments(long)[index];
  return Number(text.slice(seg.start, seg.end)) || 0;
}

/* A digit typed into a part. `typed` is how many digits this part has taken since the caret came into it (0 or 1).
   Returns { text, advance, typed }: a minute or second takes two digits (a first one above 5 can only be the units, so it
   fills the part and moves on at once); the hour takes one and moves on; the tenths take one and stay. */
function tfTypeDigit(text, index, digit, typed, long) {
  const segs = tfSegments(long);
  const seg = segs[index];
  const last = index === segs.length - 1;
  if (seg.width === 1) return { text: tfSetPart(text, index, digit, long), advance: !last, typed: 0 };
  if (typed === 0) {
    return { text: tfSetPart(text, index, digit, long), advance: digit > 5, typed: digit > 5 ? 0 : 1 };
  }
  const tens = tfPart(text, index, long);
  return { text: tfSetPart(text, index, tens * 10 + digit, long), advance: true, typed: 0 };
}

/* ArrowUp / ArrowDown on a part: hours or minutes or seconds by one, tenths by 0.1, with carry, from 0 up to `max`
   seconds (the end of the video; never past 9:59:59.9). Returns the new text. */
function tfStep(text, index, dir, long, max = Infinity) {
  const seg = tfSegments(long)[index];
  const unit = { h: 3600, m: 60, s: 1, d: 0.1 }[seg.name];
  const now = tfParse(text);
  if (!now.ok) return text;
  const top = Math.min(max, long ? 9 * 3600 + 3599.9 : 3599.9);
  const next = Math.min(top, Math.max(0, Math.round((now.seconds + dir * unit) * 10) / 10));
  return tfFixed(next, long);
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { tfMask, tfParse, tfFormat, tfDigitsText, tfMaxLength, tfSegments, tfFixed, tfNormalize, tfSegmentAt,
    tfSetPart, tfPart, tfTypeDigit, tfStep };
}

/* ---------------- the fields ---------------- */

/* The longest time the project needs: whether fields use the "h:mm:ss.d" shape (result.js fitTimeFields sets --tw). */
const tfLong = () => typeof document !== "undefined"
  && document.documentElement.style.getPropertyValue("--tw").trim() === "9";

/* A field's time with `exact` as the person meant it: touching the tenths or the arrow keys is exact (never snapped to
   a word), typing minutes and seconds is not. The change handlers read this, not tfParse() directly. */
function tfFieldParse(inp) {
  const r = tfParse(inp.value);
  if (r.ok) r.exact = inp.dataset.exact === "1" || r.exact;
  return r;
}

if (typeof document !== "undefined") {
  const SEL = ".rec-time-in, #selStart, #selEnd";
  const isField = (el) => !!el && el.matches?.(SEL);
  const field = (e) => (e.target.closest ? e.target.closest(SEL) : null);

  /* An input's text is always a whole time of the project's shape: whatever the page writes into one of these
     (timeTenths(...) "00:40.0", a hand-typed "11:00") comes out as "0:00:40.0" / "11:00.0". */
  const native = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");
  Object.defineProperty(HTMLInputElement.prototype, "value", {
    configurable: true,
    get() { return native.get.call(this); },
    set(v) { native.set.call(this, isField(this) ? tfNormalize(v, tfLong()) : v); },
  });

  document.querySelectorAll("#selStart, #selEnd").forEach((el) => { el.value = el.value; });     // the page's own text, made whole

  /* Red, with the reason, until the next keystroke or Esc. */
  window.tfInvalid = (inp, message) => {
    inp.setAttribute("aria-invalid", "true");
    inp.classList.add("tf-bad");
    inp.title = message;
  };
  window.tfClear = (inp) => {
    inp.removeAttribute("aria-invalid");
    inp.classList.remove("tf-bad");
    inp.title = TF_TITLE;
  };

  const segOf = (inp) => tfSegmentAt(inp.selectionStart ?? 0, tfLong());
  function select(inp, index) {
    const segs = tfSegments(tfLong());
    const s = segs[Math.max(0, Math.min(segs.length - 1, index))];
    inp._typed = 0;
    try { inp.setSelectionRange(s.start, s.end); } catch { /* not focusable */ }
  }
  function setText(inp, text, index, exact) {
    native.set.call(inp, text);
    if (exact) inp.dataset.exact = "1";
    window.tfClear(inp);
    select(inp, index);
  }
  const maxSeconds = () => {
    const d = (typeof videoDuration === "function") ? videoDuration() : 0;
    return d > 0 ? d : Infinity;
  };

  document.addEventListener("focusin", (e) => {
    const inp = field(e);
    if (!inp) return;
    if (!inp.classList.contains("tf-bad")) inp.dataset.prev = inp.value;     // a refused text is not what Esc goes back to
    inp._committed = inp.value;
    delete inp.dataset.exact;
    inp.maxLength = tfMaxLength(tfLong());
    if (!inp.classList.contains("tf-bad")) inp.title = TF_TITLE;
    if (!inp.disabled) { inp.value = inp.value; select(inp, 0); }
  });

  /* A click puts the caret somewhere: the part it is in is selected. */
  document.addEventListener("mouseup", (e) => {
    const inp = field(e);
    if (inp && !inp.disabled && document.activeElement === inp) select(inp, segOf(inp));
  });

  /* A change is sent when the person leaves the field with a different time (setting the text by script sends none). */
  document.addEventListener("focusout", (e) => {
    const inp = field(e);
    if (!inp || inp.disabled) return;
    if (inp.value !== inp._committed) { inp._committed = inp.value; inp.dispatchEvent(new Event("change", { bubbles: true })); }
  });
  document.addEventListener("change", (e) => { const inp = field(e); if (inp) inp._committed = inp.value; }, true);

  /* Anything that still reaches the text (a drop, a browser's autofill): made whole again, or put back. */
  document.addEventListener("input", (e) => {
    const inp = field(e);
    if (!inp) return;
    const r = tfParse(inp.value);
    if (r.ok && inp.value.includes(":")) inp.value = inp.value;           // the setter makes it whole
    else native.set.call(inp, inp.dataset.prev ?? inp.value);
    select(inp, 0);
  });

  document.addEventListener("paste", (e) => {
    const inp = field(e);
    if (!inp) return;
    e.preventDefault();
    const text = ((e.clipboardData || window.clipboardData)?.getData("text") ?? "").trim();
    // text with colons is a time as written; digits alone are read from the right ("660" is 6:60: refused)
    const r = tfParse(text.includes(":") ? text : tfMask(text, tfLong()));
    if (!r.ok) { window.tfInvalid(inp, r.error); return; }
    setText(inp, tfFixed(r.seconds, tfLong()), 0, r.exact);
  });

  /* One key on a field: true when it was a key of the field (the caller then stops the browser's own handling). */
  function handleKey(inp, key, shiftKey) {
    const long = tfLong();
    const last = tfSegments(long).length - 1;
    const i = segOf(inp);
    if (key === "Escape") {
      native.set.call(inp, inp.dataset.prev ?? inp.value);
      delete inp.dataset.exact;
      window.tfClear(inp);
      select(inp, i);
      return true;
    }
    if (key === "Enter") { inp.blur(); return true; }
    if (key === "Tab") {
      const to = i + (shiftKey ? -1 : 1);
      if (to >= 0 && to <= last) { select(inp, to); return true; }
      return false;                                                       // leaves the field
    }
    if (key === "ArrowRight" || key === ":" || key === "." || key === ",") { select(inp, Math.min(last, i + 1)); return true; }
    if (key === "ArrowLeft") { select(inp, Math.max(0, i - 1)); return true; }
    if (key === "ArrowUp" || key === "ArrowDown") {
      setText(inp, tfStep(inp.value, i, key === "ArrowUp" ? 1 : -1, long, maxSeconds()), i, true);
      return true;
    }
    if (key === "Backspace" || key === "Delete") {
      setText(inp, tfSetPart(inp.value, i, 0, long), i, tfSegments(long)[i].name === "d");
      return true;
    }
    if (/^[0-9]$/.test(key)) {
      const r = tfTypeDigit(inp.value, i, Number(key), inp._typed || 0, long);
      const name = tfSegments(long)[i].name;
      native.set.call(inp, r.text);
      if (name === "d") inp.dataset.exact = "1";                         // the tenths were typed: exactly this
      window.tfClear(inp);
      if (r.advance) { select(inp, Math.min(last, i + 1)); } else { select(inp, i); inp._typed = r.typed; }
      return true;
    }
    return key.length === 1;                                              // a letter could never be saved
  }

  document.addEventListener("keydown", (e) => {
    const inp = field(e);
    if (!inp || inp.disabled || e.ctrlKey || e.metaKey || e.altKey) return;   // shortcuts (copy, paste, select all)
    if (handleKey(inp, e.key, e.shiftKey)) e.preventDefault();
  });

  /* Text that arrives without a key (an on-screen keyboard, an input method): its characters are keys. */
  document.addEventListener("beforeinput", (e) => {
    const inp = field(e);
    if (!inp || inp.disabled || !e.data || e.inputType !== "insertText") return;
    e.preventDefault();
    for (const ch of e.data) handleKey(inp, ch, false);
  });
}
