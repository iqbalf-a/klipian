/* klipian — two-click buttons and Undo notices (shared by the editor and /workspace)
   ==========================================================================
   armedClick(btn, { armedText, ms = 4000, strong = false })
     Call it first in a click handler: it returns false on the FIRST click (the button
     turns red and says `armedText` -- "Delete?" -- for `ms`, then goes back by
     itself; a press elsewhere or Esc cancels it sooner) and true on the SECOND, when
     the action should go ahead. Only one button is armed at a time. `strong` is for
     what costs more (a posted clip): a heavier red. The label is restored from
     data-label, so a second click while it says "Delete?" cannot make that the
     permanent label.

   showUndoToast(text, onUndo, { ms = 8000 })
     "Deleted · Undo" at the bottom of the page. One at a time (a new one replaces the
     old). `onUndo` is awaited; the notice goes when it is used, dismissed or times out.
     showToast(text) is the same without the button.
   ========================================================================== */

let _armedBtn = null;                       // the one button that is armed right now

/* Back to normal: the label, the colour, the hint, the listeners. Called by the
   timeout, by the confirming click, and by both ways of cancelling. */
function disarm(btn) {
  if (!btn || !btn.classList.contains("armed")) return;
  clearTimeout(btn._armTimer);
  btn.classList.remove("armed", "danger", "strong");
  if (btn.dataset.label !== undefined) btn.innerHTML = btn.dataset.label;
  btn.removeAttribute("aria-live");
  if (btn._armTitle !== undefined) { btn.title = btn._armTitle; delete btn._armTitle; }
  document.removeEventListener("pointerdown", btn._armOutside, true);
  document.removeEventListener("keydown", btn._armKey, true);
  if (_armedBtn === btn) _armedBtn = null;
}

function armedClick(btn, { armedText = "Sure?", ms = 4000, strong = false } = {}) {
  if (btn.classList.contains("armed")) {      // the second click: go ahead
    disarm(btn);
    return true;
  }
  disarm(_armedBtn);                          // only one armed at a time
  btn.dataset.label = btn.innerHTML;
  btn._armTitle = btn.title;
  btn.classList.add("armed", "danger");
  btn.classList.toggle("strong", strong);
  btn.textContent = armedText;
  btn.title = "Click again to confirm · Esc or click elsewhere to cancel";
  btn.setAttribute("aria-live", "polite");
  // A press anywhere else cancels (the press itself is not stopped, so the click
  // still does what it was going to); so does Esc -- which, inside a dialog, must
  // not close the dialog as well.
  btn._armOutside = (e) => { if (!btn.contains(e.target)) disarm(btn); };
  btn._armKey = (e) => {
    if (e.key !== "Escape") return;
    if (btn.closest("dialog")) e.preventDefault();
    disarm(btn);
  };
  document.addEventListener("pointerdown", btn._armOutside, true);
  document.addEventListener("keydown", btn._armKey, true);
  btn._armTimer = setTimeout(() => disarm(btn), strong ? Math.max(ms, 6000) : ms);
  _armedBtn = btn;
  return false;
}

let _toastTimer = null;

function showToast(text, { ms = 8000, action = null, onAction = null } = {}) {
  document.getElementById("klipianToast")?.remove();
  clearTimeout(_toastTimer);
  const box = document.createElement("div");
  box.id = "klipianToast";
  box.className = "toast";
  box.setAttribute("role", "status");
  const span = document.createElement("span");
  span.textContent = text;
  box.append(span);
  const close = () => { clearTimeout(_toastTimer); box.remove(); };
  if (action) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "toast-action";
    b.textContent = action;
    b.addEventListener("click", async () => {
      b.disabled = true;
      try { await onAction?.(); } finally { close(); }
    });
    box.append(b);
  }
  const x = document.createElement("button");
  x.type = "button";
  x.className = "toast-x";
  x.setAttribute("aria-label", "Dismiss");
  x.textContent = "\u2715";
  x.addEventListener("click", close);
  box.append(x);
  document.body.append(box);
  _toastTimer = setTimeout(close, ms);
  return box;
}

const showUndoToast = (text, onUndo, opts = {}) =>
  showToast(text, { ...opts, action: "Undo", onAction: onUndo });
