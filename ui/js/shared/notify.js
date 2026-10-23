/* klipian — "it is done": a soft chime, a toast, the tab's title (shared by the editor and /workspace)
   ==========================================================================
   notifyDone({ key, title, body, kind, action }) is called by whatever tab is POLLING a long job (transcription, a
   render or a whole batch, a bulk upload, a download), so two tabs never both chime for one job: only the tab that
   watched it knows it finished. It does four small things:
     - a chime made with the Web Audio API (no audio files): two rising notes for success, one lower note for a failure;
     - the toast (armed.js showToast), with an action where one helps;
     - while the tab is hidden, the document title reads "✓ Done · klipian" / "⚠ Failed · klipian" until the tab is
       shown again;
     - only if the person switched it on: the browser's own desktop Notification (asked for at that moment, never on load).
   The settings live in "?" (the help panel, added below): sound Off / Soft / Medium / Loud (default Medium, about -12 dB)
   and the desktop notification, remembered per browser.
   Browsers keep audio locked until the page has had a click or a key: the AudioContext is created (or resumed) on the
   first one and kept. The pure parts (title swap, once-per-job guard, the notes) are tested by node tests/notify.test.js.
   ========================================================================== */

const NOTIFY_KEY = "klipian:notify";
const NOTIFY_VOLUMES = [0, 0.126, 0.25, 0.5];          // Off, Soft (-18 dB), Medium (-12 dB), Loud (-6 dB)
const NOTIFY_LABELS = ["Off", "Soft", "Medium", "Loud"];

/* The notes: [frequency Hz, start s, length s]. Success rises (about 0.4 s in all), a failure is one lower note. */
const CHIME_NOTES = {
  success: [[587.33, 0, 0.2], [880, 0.17, 0.25]],
  failure: [[329.63, 0, 0.34]],
};

/* The title while the tab is hidden: remembers the real one and gives it back. Pure. */
class TitleSwap {
  constructor() { this.original = null; }
  mark(current, kind) {
    if (this.original === null) this.original = current;
    return kind === "failure" ? "⚠ Failed · klipian" : "✓ Done · klipian";
  }
  restore() {
    const back = this.original;
    this.original = null;
    return back;                                        // null when nothing was marked
  }
}

/* "Once per job": first(key) is true the first time only. Keeps the last `max` keys. Pure. */
class OnceGuard {
  constructor(max = 200) { this.max = max; this.seen = []; }
  first(key) {
    if (key === undefined || key === null || key === "") return true;      // no key, no guard
    if (this.seen.includes(key)) return false;
    this.seen.push(key);
    if (this.seen.length > this.max) this.seen.shift();
    return true;
  }
}

const _titleSwap = new TitleSwap();
const _onceGuard = new OnceGuard();
let _audioCtx = null;
const notifyStats = { chimes: 0, last: null, toasts: 0 };     // what happened, for the tests

function notifySettings() {
  try {
    const v = JSON.parse(localStorage.getItem(NOTIFY_KEY) || "{}");
    const sound = Number.isInteger(v.sound) && v.sound >= 0 && v.sound <= 3 ? v.sound : 2;
    return { sound, desktop: v.desktop === true };
  } catch { return { sound: 2, desktop: false }; }
}

function saveNotifySettings(s) {
  try { localStorage.setItem(NOTIFY_KEY, JSON.stringify(s)); } catch { /* not persisted */ }
}

/* Create or resume the AudioContext. Called on the first click or key (browsers refuse before one) and again when a
   chime is due. Returns the context, or null when this browser has none. */
function notifyUnlock() {
  try {
    if (!_audioCtx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return null;
      _audioCtx = new Ctx();
    }
    if (_audioCtx.state === "suspended") _audioCtx.resume().catch(() => {});
  } catch { return null; }
  return _audioCtx;
}

/* A short soft chime. Returns true when it was scheduled (false when the sound is off or there is no audio). */
function chime(kind = "success", volumeStep = notifySettings().sound) {
  const gain = NOTIFY_VOLUMES[volumeStep] || 0;
  if (!gain) return false;
  const ctx = notifyUnlock();
  if (!ctx) return false;
  const t0 = ctx.currentTime + 0.02;
  for (const [freq, start, length] of CHIME_NOTES[kind === "failure" ? "failure" : "success"]) {
    const osc = ctx.createOscillator(), env = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    env.gain.setValueAtTime(0.0001, t0 + start);
    env.gain.linearRampToValueAtTime(gain, t0 + start + 0.012);
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + start + length);
    osc.connect(env).connect(ctx.destination);
    osc.start(t0 + start);
    osc.stop(t0 + start + length + 0.02);
  }
  notifyStats.chimes += 1;
  notifyStats.last = kind;
  return true;
}

/* Tell the person a long job ended. `key` (the job id) makes it happen once per job in this tab.
   kind: "success" | "failure". action: { label, onClick } for the toast. detail: { text, report } (armed.js showToast).
   quiet: no chime and no title marker (a job the person cancelled). */
function notifyDone({ key, title, body = "", kind = "success", action = null, ms = 12000, detail = null, quiet = false } = {}) {
  if (!_onceGuard.first(key)) return false;
  if (!quiet) chime(kind);                               // quiet: the person stopped it themselves, only the toast
  const text = body ? `${title}: ${body}` : title;
  if (typeof showToast === "function") {
    notifyStats.toasts += 1;
    showToast(text, { ms, action: action?.label || null, onAction: action?.onClick || null, detail });
  }
  if (document.hidden && !quiet) {
    document.title = _titleSwap.mark(document.title, kind);
    const s = notifySettings();
    if (s.desktop && typeof Notification !== "undefined" && Notification.permission === "granted") {
      try { new Notification(title, { body, tag: key || "klipian" }); } catch { /* not shown */ }
    }
  }
  return true;
}

if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      const back = _titleSwap.restore();
      if (back !== null) document.title = back;
    }
  });
  window.addEventListener("focus", () => {
    const back = _titleSwap.restore();
    if (back !== null) document.title = back;
  });
  for (const ev of ["pointerdown", "keydown"]) document.addEventListener(ev, () => notifyUnlock(), { capture: true, passive: true });
}

/* The settings, inside the "?" panel (both pages have one): a section with the sound volume and the desktop notification. */
function notifyMountSettings() {
  const panel = document.getElementById("shortcutPanel");
  if (!panel || document.getElementById("notifySettings")) return;
  const s = notifySettings();
  const box = document.createElement("div");
  box.id = "notifySettings";
  box.className = "notify-settings";
  box.innerHTML = `<p class="shortcut-sub">When a job finishes</p>
    <label class="notify-row">Sound <select id="notifySound" aria-label="Sound when a job finishes">
      ${NOTIFY_LABELS.map((l, i) => `<option value="${i}"${i === s.sound ? " selected" : ""}>${l}</option>`).join("")}</select></label>
    <label class="notify-row"><input type="checkbox" id="notifyDesktop"${s.desktop ? " checked" : ""}> Desktop notification (when this tab is in the background)</label>
    <p class="notify-note" id="notifyNote" role="status"></p>`;
  const guide = panel.querySelector(".shortcut-guide");
  panel.insertBefore(box, guide || null);
  box.querySelector("#notifySound").addEventListener("change", (e) => {
    const next = { ...notifySettings(), sound: Number(e.target.value) };
    saveNotifySettings(next);
    chime("success", next.sound);                      // a click is a gesture: this also unlocks the audio, and lets the person hear the level
  });
  box.querySelector("#notifyDesktop").addEventListener("change", async (e) => {
    const note = box.querySelector("#notifyNote");
    if (!e.target.checked) { saveNotifySettings({ ...notifySettings(), desktop: false }); note.textContent = ""; return; }
    if (typeof Notification === "undefined") { e.target.checked = false; note.textContent = "This browser has no desktop notifications."; return; }
    const answer = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();   // asked now, never on load
    const ok = answer === "granted";
    e.target.checked = ok;
    saveNotifySettings({ ...notifySettings(), desktop: ok });
    note.textContent = ok ? "" : "The browser did not allow notifications for this site.";
  });
}
if (typeof document !== "undefined") notifyMountSettings();

if (typeof module !== "undefined" && module.exports) module.exports = { TitleSwap, OnceGuard, CHIME_NOTES, NOTIFY_VOLUMES };
