/* klipian — copy text to the clipboard (shared by the editor and /workspace)
   ==========================================================================
   `copyText(text)` -> Promise<boolean>. The async Clipboard API when the page
   may use it (127.0.0.1 and localhost count as secure), else a hidden textarea
   and execCommand. Call it straight from the click handler: some browsers
   refuse a write that comes after a long await following the click.
   `flashCopied(button)` shows "Copied" on the button for about two seconds (the
   label is restored from data-label, so a second click while it says
   "Copied" cannot make that the permanent label).
   ========================================================================== */

/* Plain-text copy for a browser without the async Clipboard API (or one that
   refused it): a hidden textarea and execCommand. */
function copyViaTextarea(text) {
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.setAttribute("readonly", "");
  ta.style.cssText = "position:fixed;top:0;left:0;opacity:0;pointer-events:none";
  document.body.appendChild(ta);
  ta.select();
  let ok = false;
  try { ok = document.execCommand("copy"); } catch { /* refused */ }
  ta.remove();
  return ok;
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch { return copyViaTextarea(text); }
}

function flashCopied(btn) {
  const label = btn.dataset.label || btn.textContent;
  btn.dataset.label = label;
  btn.textContent = "Copied";
  clearTimeout(btn._copiedTimer);
  btn._copiedTimer = setTimeout(() => { btn.textContent = label; }, 2000);
}
