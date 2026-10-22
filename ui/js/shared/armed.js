/* klipian — confirmation dialogs and Undo notices (shared by the editor, /workspace and the profile picker)
   ==========================================================================
   confirmDialog(...)  (below): the confirmation of a destructive action, a native dialog.

   showUndoToast(text, onUndo, { ms = 8000 })
     "Deleted · Undo" at the bottom of the page. One at a time (a new one replaces the
     old). `onUndo` is awaited; the notice goes when it is used, dismissed or times out.
     showToast(text) is the same without the button.
   ========================================================================== */

/* ---------- confirmDialog: the confirmation of a destructive action ----------
   confirmDialog({ title, message, warning, body, confirmText = "Delete", tone = "danger", cancelText = "Cancel" })
     -> Promise<boolean>. A native <dialog>: focus starts on Cancel; Esc, the ✕, Cancel and a click on the
     backdrop answer false; the red button answers true (Enter on it too). `body` is an element shown under the
     message (the caller keeps a reference and can read its fields after the answer). tone "primary" is for a
     question that is not a deletion: the button is the accent colour. tone "strong" is for what is
     already out in the world (a posted clip, a profile, a YouTube connection): a heavier red, and the
     `warning` line stands out. tone "caution" is for an action that is not a deletion but takes effect at
     once out in the world (Publish now): the accent colour with a heavier ring, never red. Only one is open at a time (a new one answers the old one false). The Undo
     toast of an action is separate and stays: this replaces the confirm step only. */
let _confirmOpen = null;

function confirmDialog({ title = "Are you sure?", message = "", warning = "", body = null, confirmText = "Delete",
                         tone = "danger", cancelText = "Cancel" } = {}) {
  _confirmOpen?.(false);
  return new Promise((resolve) => {
    const dlg = document.createElement("dialog");
    dlg.className = "confirm-dlg";
    dlg.dataset.tone = tone;
    const el = (tag, cls, text) => {
      const e = document.createElement(tag);
      if (cls) e.className = cls;
      if (text !== undefined) e.textContent = text;
      return e;
    };
    const head = el("div", "confirm-head");
    const h = el("h2", "", title);
    h.id = "confirmDlgTitle";
    const x = el("button", "confirm-x", "✕");
    x.type = "button"; x.title = cancelText; x.setAttribute("aria-label", cancelText);
    head.append(h, x);
    dlg.setAttribute("aria-labelledby", h.id);
    const actions = el("div", "confirm-actions");
    const cancel = el("button", "btn confirm-cancel", cancelText);
    cancel.type = "button";
    const ok = el("button", "btn main confirm-ok", confirmText);
    ok.type = "button";
    actions.append(cancel, ok);
    dlg.append(head);
    if (message) dlg.append(el("p", "confirm-msg", message));
    if (body) dlg.append(body);
    if (warning) dlg.append(el("p", "confirm-warn", warning));
    dlg.append(actions);

    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      _confirmOpen = null;
      try { dlg.close(); } catch { /* already closed */ }
      dlg.remove();
      resolve(value);
    };
    _confirmOpen = finish;
    cancel.addEventListener("click", () => finish(false));
    x.addEventListener("click", () => finish(false));
    ok.addEventListener("click", () => finish(true));
    dlg.addEventListener("cancel", (e) => { e.preventDefault(); finish(false); });      // Esc
    dlg.addEventListener("click", (e) => {                                              // the backdrop
      if (e.target !== dlg) return;       // a click inside (a field of the body, a key press on it) is not the backdrop
      const r = dlg.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) finish(false);
    });
    document.body.append(dlg);
    dlg.showModal();
    cancel.focus();
  });
}

let _toastTimer = null;

/* `detail` ({ text, report }): a small muted line under the message with "Copy details" (what Google really said). */
function showToast(text, { ms = 8000, action = null, onAction = null, detail = null } = {}) {
  document.getElementById("klipianToast")?.remove();
  clearTimeout(_toastTimer);
  const box = document.createElement("div");
  box.id = "klipianToast";
  box.className = "toast";
  box.setAttribute("role", "status");
  const span = document.createElement("span");
  span.textContent = text;
  if (detail?.text) {
    const body = document.createElement("div");
    body.className = "toast-body";
    body.append(span, makeDetailLine(detail.text, detail.report));
    box.append(body);
  } else box.append(span);
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

/* A one-line muted detail with a "Copy details" button that puts `report` on the clipboard. */
function makeDetailLine(text, report) {
  const line = document.createElement("small");
  line.className = "detail-line";
  const t = document.createElement("span");
  t.textContent = text;
  const b = document.createElement("button");
  b.type = "button";
  b.className = "btn sm quiet";
  b.textContent = "Copy details";
  b.addEventListener("click", async () => {
    const ok = typeof copyText === "function" ? await copyText(report || text) : false;
    b.textContent = ok ? "Copied" : "Could not copy";
    setTimeout(() => { b.textContent = "Copy details"; }, 1800);
  });
  line.append(t, " ", b);
  return line;
}

const showUndoToast = (text, onUndo, opts = {}) =>
  showToast(text, { ...opts, action: "Undo", onAction: onUndo });
