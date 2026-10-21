/* klipian — the masked time field
   ==========================================================================
   Every field you type a moment's time into (a suggestion's start and end, Clips from / to) behaves like a time
   picker: digits fill from the RIGHT, so 1100 is 11:00.0, 130 is 1:30.0, 5 is 0:05.0, and on a source of an hour or more
   11455 is 1:14:55.0. The last two digits are the seconds, the two before them the minutes, the rest the hours.
   A "." (or ",") followed by a digit sets the tenths; without it the tenths stay .0 and the time is snapped to a word
   as before (the field's old rule: a typed decimal point means "exactly this").

   The format follows the project (the same rule as result.js fitTimeFields): "mm:ss.d" (7 characters) under an hour,
   "h:mm:ss.d" (9) from an hour up; maxlength comes from it, so nothing longer can be typed.

   Seconds or minutes above 59 are NOT carried: "190" is refused (red, with the reason), never read as 2:10.
   A bare number is never seconds: "660" is 6:60, refused. Pasted text may carry colons ("11:00", "1:14:55.4",
   "00:11:00") or be digits only, which are read from the right.

   Keys: ArrowUp / ArrowDown change the time by 0.1 s (Shift: 1 s); the ▲▼ buttons keep their 1 s; Enter or leaving the
   field commits; Esc puts the old value back. (Not per-segment editing: the caret does not sit in h / mm / ss.)

   The pure functions (tf*) are what the node check in tests exercises; the value handed to the rest of the code is
   still seconds, parsed by the "change" handlers that already existed (result.js, timeline.js).
   ========================================================================== */

const TF_TITLE = "Type digits from the right: 1100 = 11:00.0, 130 = 1:30.0, 5 = 0:05.0 "
  + "(on a long source, 11455 = 1:14:55.0). A . and a digit set the tenths. Seconds and minutes go to 59. "
  + "Pasting 11:00 or 1:14:55.4 works too. A number without a colon is never read as seconds. Esc undoes.";

const tfMaxDigits = (long) => (long ? 5 : 4);
const tfMaxLength = (long) => (long ? 9 : 7);

/* "mm:ss" shape of a digit string read from the right ("" stays empty). */
function tfDigitsText(digits) {
  if (!digits) return "";
  const ss = digits.slice(-2).padStart(2, "0");
  const rest = digits.slice(0, -2);
  if (rest.length > 2) return `${rest.slice(0, -2)}:${rest.slice(-2)}:${ss}`;
  return `${rest || "0"}:${ss}`;
}

/* What the field shows while typing: the digits of whatever is in it, right-aligned, and the tenths after a ".". */
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

/* seconds -> the text a field shows after a commit ("11:00.0", "1:14:55.4"). */
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

/* The longest time the project needs: whether fields use the "h:mm:ss.d" shape (result.js fitTimeFields sets --tw). */
const tfLong = () => typeof document !== "undefined"
  && document.documentElement.style.getPropertyValue("--tw").trim() === "9";

if (typeof module !== "undefined" && module.exports) {
  module.exports = { tfMask, tfParse, tfFormat, tfDigitsText, tfMaxLength };
}

/* ---------------- the fields ---------------- */

if (typeof document !== "undefined") {
  const SEL = ".rec-time-in, #selStart, #selEnd";
  const field = (e) => (e.target.closest ? e.target.closest(SEL) : null);

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

  document.addEventListener("focusin", (e) => {
    const inp = field(e);
    if (!inp) return;
    if (!inp.classList.contains("tf-bad")) inp.dataset.prev = inp.value;     // a refused text is not what Esc goes back to
    inp.maxLength = tfMaxLength(tfLong());
    if (!inp.classList.contains("tf-bad")) inp.title = TF_TITLE;
    if (!inp.disabled) inp.select();
  });

  document.addEventListener("input", (e) => {
    const inp = field(e);
    if (!inp || e.inputType === "historyUndo") return;
    window.tfClear(inp);
    const masked = tfMask(inp.value, tfLong());
    if (masked !== inp.value) inp.value = masked;
    try { inp.setSelectionRange(inp.value.length, inp.value.length); } catch { /* not focusable */ }
  });

  document.addEventListener("paste", (e) => {
    const inp = field(e);
    if (!inp) return;
    e.preventDefault();
    const text = (e.clipboardData || window.clipboardData)?.getData("text") ?? "";
    // text with colons is a time as written (read by the change handler); digits alone are read from the right
    const t = text.trim();
    inp.value = t.includes(":") ? t : tfMask(t, tfLong());
    window.tfClear(inp);
  });

  document.addEventListener("keydown", (e) => {
    const inp = field(e);
    if (!inp) return;
    if (e.key === "Escape") {
      e.preventDefault();
      inp.value = inp.dataset.prev ?? inp.value;
      window.tfClear(inp);
      return;
    }
    if (e.key === "Enter") { e.preventDefault(); inp.blur(); return; }
    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      const parsed = tfParse(inp.value);
      if (!parsed.ok) return;
      const step = (e.shiftKey ? 1 : 0.1) * (e.key === "ArrowUp" ? 1 : -1);
      const next = Math.max(0, Math.round((parsed.seconds + step) * 10) / 10);
      inp.value = tfFormat(next);                               // a decimal point: taken exactly, not snapped
      window.tfClear(inp);
      inp.dispatchEvent(new Event("change", { bubbles: true }));
      return;
    }
    if (e.ctrlKey || e.metaKey || e.key.length > 1) return;     // shortcuts, Backspace, Tab, arrows ...
    if (!/[0-9.,]/.test(e.key)) e.preventDefault();             // a letter could never be saved
  });
}
