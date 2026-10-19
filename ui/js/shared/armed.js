/* klipian — two-click buttons and Undo notices (shared by the editor and /workspace)
   ==========================================================================
   armedClick(btn, { armedText, ms = 4000, strong = false })
     Call it first in a click handler: it returns false on the FIRST click (the button
     turns red and says `armedText` -- "Delete?" -- for `ms`, then goes back by
     itself) and true on the SECOND, when the action should go ahead. `strong` is for
     what costs more (a posted clip): a heavier red. The label is restored from
     data-label, so a second click while it says "Delete?" cannot make that the
     permanent label.

   showUndoToast(text, onUndo, { ms = 8000 })
     "Deleted · Undo" at the bottom of the page. One at a time (a new one replaces the
     old). `onUndo` is awaited; the notice goes when it is used, dismissed or times out.
     showToast(text) is the same without the button.
   ========================================================================== */

function armedClick(btn, { armedText = "Sure?", ms = 4000, strong = false } = {}) {
  clearTimeout(btn._armTimer);
  const label = btn.dataset.label ?? btn.innerHTML;
  btn.dataset.label = label;
  if (btn.classList.contains("armed")) {
    btn.classList.remove("armed", "danger", "strong");
    btn.innerHTML = label;
    btn.removeAttribute("aria-live");
    return true;
  }
  btn.classList.add("armed", "danger");
  btn.classList.toggle("strong", strong);
  btn.textContent = armedText;
  btn.setAttribute("aria-live", "polite");
  btn._armTimer = setTimeout(() => {
    btn.classList.remove("armed", "danger", "strong");
    btn.innerHTML = label;
    btn.removeAttribute("aria-live");
  }, ms);
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
