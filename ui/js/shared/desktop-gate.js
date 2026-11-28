/* klipian is a desktop tool (timeline, framing, tables): below MIN_WIDTH CSS px a full-screen notice covers the page instead of a broken layout.
   Shown again on resize, so a narrow window on a computer gets it too. */
(function desktopGate() {
  const MIN_WIDTH = 1024;
  const gate = document.createElement("div");
  gate.className = "desktop-gate";
  gate.setAttribute("role", "alertdialog");
  gate.setAttribute("aria-modal", "true");
  gate.setAttribute("aria-labelledby", "dgTitle");
  gate.hidden = true;
  gate.innerHTML = `<div class="desktop-gate-box">
    <p class="desktop-gate-brand">klipian</p>
    <h1 id="dgTitle">Open klipian on a computer</h1>
    <p>klipian is made for a desktop screen: editing, framing and the Library table do not fit a phone.
    This window is <b id="dgWidth"></b> px wide; it needs at least ${MIN_WIDTH} px.</p>
    <p class="desktop-gate-hint">On a computer? Make the window wider or zoom out (Ctrl and minus).</p>
  </div>`;
  const check = () => {
    const small = window.innerWidth < MIN_WIDTH;
    gate.hidden = !small;
    document.documentElement.classList.toggle("desktop-gated", small);
    if (small) gate.querySelector("#dgWidth").textContent = window.innerWidth;
  };
  const mount = () => { document.body.appendChild(gate); check(); };
  if (document.body) mount(); else document.addEventListener("DOMContentLoaded", mount);
  window.addEventListener("resize", check);
})();
